import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import crypto from "node:crypto";
import { createApp, initialize } from "../src/app.js";
import { Account, Review, Punch, Audit } from "../src/models.js";
import { editedValues } from "../src/reviewEditing.js";

test("edición de revisión: totales, horario nocturno y validación de tramos", () => {
  const row = {
    date: "2026-08-03",
    policy: { timeZone: "America/Argentina/Buenos_Aires" },
  };
  const data = {
    segments: [
      { start: "2026-08-03T22:00", end: "2026-08-04T06:00", kind: "normal" },
      { start: "2026-08-04T06:00", end: "2026-08-04T07:00", kind: "extra50" },
    ],
    unpaidBreakMinutes: 30,
    lateMinutes: 0,
    earlyMinutes: 0,
    absence: "",
  };
  const value = editedValues(row, data);
  assert.equal(value.workedMinutes, 540);
  assert.equal(value.normalMinutes, 450);
  assert.equal(value.outsideMinutes, 60);
  assert.equal(value.extra50Minutes, 60);
  assert.equal(value.segments[0].start, "2026-08-04T01:00:00.000Z");
  assert.throws(() => editedValues(row, { ...data, unpaidBreakMinutes: 481 }));
  assert.throws(() =>
    editedValues(row, {
      ...data,
      segments: [...data.segments, data.segments[0]],
    }),
  );
  assert.throws(() =>
    editedValues(row, {
      ...data,
      segments: [{ ...data.segments[0], end: "2026-08-05T07:00" }],
    }),
  );
  assert.throws(() =>
    editedValues(row, {
      ...data,
      segments: [{ ...data.segments[0], end: data.segments[0].start }],
    }),
  );
});

test("API revisión manual: auditoría antes/después, concurrencia, calendario y preservación", async () => {
  const dbName = `control_rrhh_test_${crypto.randomBytes(8).toString("hex")}`;
  await mongoose.connect("mongodb://127.0.0.1:27017", { dbName });
  await initialize();
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let cookie = "";
  async function req(path, method = "GET", body, expected = 200) {
    const response = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", Cookie: cookie },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    assert.equal(response.status, expected, JSON.stringify(data));
    if (response.headers.has("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    return data;
  }
  try {
    await req("/auth/setup", "POST", {
      name: "QA revisión",
      email: "revision@example.test",
      password: "Temporary-Review-42",
    });
    const person = await req(
      "/resources/people",
      "POST",
      { name: "Persona revisión QA", hireDate: "2026-01-01" },
      201,
    );
    const shift = await req(
      "/resources/shifts",
      "POST",
      { name: "Mañana QA", start: "08:00", end: "16:00" },
      201,
    );
    await req(
      "/resources/assignments",
      "POST",
      {
        name: "Asignación QA",
        personId: person._id,
        shiftId: shift._id,
        startDate: "2026-01-01",
        weekdays: [1, 2, 3, 4, 5],
      },
      201,
    );
    for (const [direction, hour] of [
      ["in", "08"],
      ["out", "16"],
    ])
      await req("/attendance/manual", "POST", {
        personId: person._id,
        reason: "Registro QA",
        occurredAt: `2026-08-03T${hour}:00:00-03:00`,
        direction,
        requestId: crypto.randomUUID(),
      });
    const range = { from: "2026-08-03", to: "2026-08-03" };
    await req("/attendance/process", "POST", range);
    const row = (await req("/resources/reviews")).items[0];
    const originals = await Punch.find().sort({ _id: 1 }).lean();
    await req(`/punches/${originals[0]._id}/capture`, "GET", undefined, 404);
    const data = {
      version: row.version,
      reason: "Corrección autorizada de jornada QA",
      segments: [
        { start: "2026-08-03T08:00", end: "2026-08-03T16:00", kind: "normal" },
        { start: "2026-08-03T16:00", end: "2026-08-03T17:00", kind: "extra50" },
      ],
      unpaidBreakMinutes: 30,
      lateMinutes: 0,
      earlyMinutes: 0,
      absence: "",
    };
    await req(`/reviews/${row._id}/edit`, "POST", { ...data, reason: "" }, 400);
    await Account.updateOne({ _id: "owner" }, { $set: { role: "reviewer" } });
    await req(`/reviews/${row._id}/edit`, "POST", data, 403);
    await Account.updateOne({ _id: "owner" }, { $set: { role: "admin" } });
    const edited = await req(`/reviews/${row._id}/edit`, "POST", data);
    assert.equal(edited.manuallyEdited, true);
    assert.equal(edited.status, "review");
    assert.equal(edited.normalMinutes, 450);
    assert.equal(edited.extra50Minutes, 60);
    assert.equal(edited.manualHistory, undefined);
    await req(`/reviews/${row._id}/edit`, "POST", data, 409);
    const history = await req(`/reviews/${row._id}/history`);
    assert.equal(history.items.length, 1);
    assert.equal(history.items[0].before.normalMinutes, 480);
    assert.equal(history.items[0].after.normalMinutes, 450);
    assert.equal(history.items[0].actor, "owner");
    assert.equal(
      await Audit.countDocuments({
        action: "review.manual_edit",
        entityId: row._id,
      }),
      1,
    );
    assert.deepEqual(await Punch.find().sort({ _id: 1 }).lean(), originals);
    await req("/attendance/process", "POST", range);
    const preserved = await Review.findById(row._id).lean();
    assert.equal(preserved.normalMinutes, 450);
    assert.equal(preserved.version, edited.version);
    const calendar = await req("/schedule?from=2026-08-03&to=2026-08-03");
    assert.equal(calendar.people[0].days[0].schedule.start, "08:00");
    assert.equal(calendar.people[0].days[0].review.normalMinutes, 450);
    assert.equal(calendar.people[0].days[0].review.manualHistory, undefined);
    await req(`/reviews/${row._id}/decision`, "POST", {
      status: "approved",
      notes: "Aprobación QA",
    });
    await req(
      `/reviews/${row._id}/edit`,
      "POST",
      { ...data, version: edited.version + 1 },
      409,
    );
    await req(`/reviews/${row._id}/decision`, "POST", { status: "review" });
    const reopened = await Review.findById(row._id).lean();
    await req(`/reviews/${row._id}/edit`, "POST", {
      ...data,
      version: reopened.version,
      lateMinutes: 5,
    });
    assert.equal((await req(`/reviews/${row._id}/history`)).items.length, 2);
  } finally {
    await new Promise((r) => server.close(r));
    assert.match(mongoose.connection.name, /^control_rrhh_test_[a-f0-9]{16}$/);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
