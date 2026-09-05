import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import crypto from "node:crypto";
import { createApp, initialize } from "../src/app.js";
import {
  Account,
  Person,
  Group,
  Shift,
  Assignment,
  Pattern,
  Terminal,
  Punch,
  Settings,
  PresetInstallation,
} from "../src/models.js";
import { resolveSchedule } from "../src/attendance.js";

test("preconfiguraciones: permisos, referencias integradas, opciones, aislamiento y reintento", async () => {
  const dbName = `control_rrhh_test_${crypto.randomBytes(8).toString("hex")}`;
  await mongoose.connect("mongodb://127.0.0.1:27017", { dbName });
  await initialize();
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let cookie = "";
  async function req(path, method = "GET", body, expected = 200) {
    const r = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", Cookie: cookie },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await r.json();
    assert.equal(r.status, expected, JSON.stringify(data));
    if (r.headers.has("set-cookie"))
      cookie = r.headers.get("set-cookie").split(";")[0];
    return data;
  }
  try {
    const options = { startDate: "2026-09-07", includeDemoPeople: true };
    await req("/presets/industry/apply", "POST", options, 401);
    await req("/auth/setup", "POST", {
      name: "QA presets",
      email: "presets@example.test",
      password: "Temporary-Presets-42",
    });
    assert.equal((await req("/presets")).length, 3);
    await req("/presets/missing/apply", "POST", options, 404);
    await req(
      "/presets/industry/apply",
      "POST",
      { ...options, startDate: "invalid" },
      400,
    );
    const existing = await req(
      "/resources/people",
      "POST",
      { name: "Persona existente QA", hireDate: "2026-01-01" },
      201,
    );
    const settings = await Settings.findById("main").lean();
    await Account.updateOne({ _id: "owner" }, { $set: { role: "reviewer" } });
    await req("/presets/industry/apply", "POST", options, 403);
    await req(
      `/people/${existing._id}/face/test`,
      "POST",
      { captures: { near: "data:image/jpeg;base64,AAAA" } },
      403,
    );
    await Account.updateOne({ _id: "owner" }, { $set: { role: "admin" } });
    const applied = await req("/presets/industry/apply", "POST", options);
    assert.equal(applied.counts.people, 20);
    assert.equal(applied.counts.patterns, 2);
    assert.equal(await Person.countDocuments(), 21);
    const people = await Person.find({ name: /^DEMO/ }).lean();
    assert.equal(new Set(people.map((p) => p.employeeNumber)).size, 20);
    assert.ok(
      people.every(
        (p) =>
          p.employeeNumber > existing.employeeNumber &&
          !p.faceEnabled &&
          !p.faceCount &&
          p.annualLeaveDays === 0,
      ),
    );
    const shifts = await Shift.find().lean(),
      groups = await Group.find().lean(),
      patterns = await Pattern.find().lean(),
      assignments = await Assignment.find().lean();
    assert.ok(
      people.every((p) => groups.some((g) => String(g._id) === p.groupId)),
    );
    assert.ok(
      assignments.every((a) =>
        patterns.some((p) => String(p._id) === a.patternId),
      ),
    );
    assert.ok(
      patterns.every(
        (p) =>
          p.sequence.length === 14 &&
          p.sequence.every(
            (id) => !id || shifts.some((s) => String(s._id) === id),
          ),
      ),
    );
    const terminal = await Terminal.findOne().select("+tokenHash");
    const context = {
      shifts,
      groups,
      patterns,
      assignments,
      settings,
      holidays: [],
    };
    const first = people.find((p) => p.name.endsWith("01"));
    assert.equal(resolveSchedule(first, "2026-09-07", context).start, "06:00");
    assert.equal(resolveSchedule(first, "2026-09-12", context).rest, true);
    assert.equal(resolveSchedule(first, "2026-09-14", context).start, "14:00");
    assert.equal(terminal.active, false);
    assert.equal(terminal.tokenHash, undefined);
    assert.equal(await Punch.countDocuments(), 0);
    assert.deepEqual(await Settings.findById("main").lean(), settings);
    await Shift.updateOne(
      { _id: shifts[0]._id },
      { $set: { name: "Mi horario editado" } },
    );
    const replay = await req("/presets/industry/apply", "POST", options);
    assert.equal(replay.replay, true);
    assert.equal(await Person.countDocuments(), 21);
    assert.equal(
      (await Shift.findById(shifts[0]._id)).name,
      "Mi horario editado",
    );
    await req(
      "/presets/industry/apply",
      "POST",
      { ...options, includeDemoPeople: false },
      409,
    );
    // Simulate an interrupted installation marker: existing records remain untouched.
    await PresetInstallation.updateOne(
      { _id: "industry" },
      { $set: { status: "applying" } },
    );
    await req("/presets/industry/apply", "POST", options);
    assert.equal(await Person.countDocuments(), 21);
    assert.equal(
      (await Shift.findById(shifts[0]._id)).name,
      "Mi horario editado",
    );
    await req("/presets/commerce/apply", "POST", {
      ...options,
      includeDemoPeople: false,
    });
    await req("/presets/services/apply", "POST", {
      ...options,
      includeDemoPeople: false,
    });
    assert.equal(await Person.countDocuments(), 21);
    assert.equal(await Group.countDocuments(), 6);
    assert.equal(await Assignment.countDocuments(), 6);
    assert.equal(await Terminal.countDocuments(), 3);
    const allAssignments = await Assignment.find().lean();
    const commerceAssignment = allAssignments.find((a) =>
      a.name.startsWith("Comercio"),
    );
    const commerceContext = {
      ...context,
      assignments: allAssignments,
      shifts: await Shift.find().lean(),
    };
    assert.equal(
      resolveSchedule(
        { _id: "test", groupId: commerceAssignment.groupId },
        "2026-09-13",
        commerceContext,
      ),
      null,
    );
    assert.ok(
      resolveSchedule(
        { _id: "test", groupId: commerceAssignment.groupId },
        "2026-09-12",
        commerceContext,
      ).intervals.length,
    );
    const next = await req(
      "/resources/people",
      "POST",
      { name: "Persona posterior QA", hireDate: "2026-01-01" },
      201,
    );
    assert.equal(next.employeeNumber, 22);
  } finally {
    await new Promise((r) => server.close(r));
    assert.match(mongoose.connection.name, /^control_rrhh_test_[a-f0-9]{16}$/);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
