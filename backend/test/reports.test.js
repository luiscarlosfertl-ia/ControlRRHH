import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { DateTime } from "luxon";
import { createApp, initialize } from "../src/app.js";
import { Account, Person, Review, Punch } from "../src/models.js";

test("informes: rango, personas, totales completos, filtros, fichadas nocturnas y privacidad", async () => {
  const dbName = `control_rrhh_test_${crypto.randomBytes(8).toString("hex")}`;
  await mongoose.connect("mongodb://127.0.0.1:27017", { dbName });
  await initialize();
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let cookie = "";
  async function request(path, status = 200, body) {
    const response = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    assert.equal(response.status, status, JSON.stringify(data));
    if (response.headers.has("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    return data;
  }
  const url = (mode, extra = {}) =>
    `/reports/${mode}?${new URLSearchParams({ from: "2026-06-01", to: "2026-07-25", ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : v])) })}`;
  try {
    await request(url("days"), 401);
    await request("/auth/setup", 200, {
      name: "QA informes",
      email: "reports@example.test",
      password: "Temporary-Reports-42",
    });
    const [a, b] = await Person.create([
      { name: "Persona A", employeeNumber: 1, active: false },
      { name: "Persona B", employeeNumber: 2 },
    ]);
    const [entry, exit, unrelated] = await Punch.create([
      {
        personId: String(a._id),
        occurredAt: new Date("2026-06-01T22:00:03-03:00"),
        direction: "in",
        source: "facevision",
        terminalId: "qa",
        requestId: "a",
        similarity: 0.91,
        hasCapture: true,
        captureEncrypted: "private-not-returned",
        processed: true,
      },
      {
        personId: String(a._id),
        occurredAt: new Date("2026-06-02T06:00:09-03:00"),
        direction: "out",
        source: "manual",
        terminalId: "qa",
        requestId: "b",
        processed: true,
      },
      {
        personId: String(b._id),
        occurredAt: new Date(),
        direction: "in",
        terminalId: "qa",
        requestId: "c",
      },
    ]);
    const rows = Array.from({ length: 55 }, (_, i) => ({
      personId: String(a._id),
      personName: a.name,
      employeeNumber: 1,
      date: DateTime.fromISO("2026-06-01").plus({ days: i }).toISODate(),
      status: i % 2 ? "approved" : "review",
      expectedMinutes: 480,
      workedMinutes: 600,
      normalMinutes: 450,
      outsideMinutes: 120,
      extra50Minutes: 60,
      extra100Minutes: 30,
      lateMinutes: i === 0 ? 5 : 0,
      earlyMinutes: i === 1 ? 10 : 0,
      absence: i === 2 ? "vacation" : "",
      manuallyEdited: i === 0,
      manualHistory: [{ reason: "private-history-not-returned" }],
      policy: { timeZone: "America/Argentina/Buenos_Aires" },
      punchIds:
        i === 0
          ? [String(entry._id), String(exit._id), String(unrelated._id)]
          : [],
    }));
    await Review.insertMany([
      ...rows,
      {
        personId: String(b._id),
        personName: b.name,
        employeeNumber: 2,
        date: "2026-06-01",
        normalMinutes: 0,
        absence: "unjustified",
        status: "review",
      },
    ]);
    const originals = await Review.find().select("+manualHistory").lean();
    const report = await request(url("days"));
    assert.equal(report.items.length, 50);
    assert.equal(report.total, 56);
    assert.equal(report.pages, 2);
    assert.equal(report.totals.normalMinutes, 55 * 450);
    assert.equal(report.totals.workedMinutes, 55 * 600);
    assert.equal(report.totals.unapprovedMinutes, 55 * 30);
    assert.equal(report.totals.extra50Minutes, 55 * 60);
    assert.equal(report.totals.vacationDays, 1);
    assert.equal(report.totals.unjustifiedDays, 1);
    assert.equal(report.totals.absenceDays, 2);
    assert.equal(report.totals.lateDays, 1);
    assert.equal(report.totals.earlyMinutes, 10);
    assert.equal(report.totals.manualDays, 1);
    assert.equal(report.items[0].punches, undefined);
    assert.equal(report.items[0].manualHistory, undefined);
    const second = await request(url("days", { page: 2 }));
    assert.equal(second.items.length, 6);
    assert.deepEqual(second.totals, report.totals);
    const people = await request(url("people"));
    assert.equal(people.total, 2);
    assert.equal(people.items[0].days, 55);
    assert.equal(people.items[0].normalMinutes, 24750);
    const selected = await request(url("days", { personIds: [String(b._id)] }));
    assert.equal(selected.total, 1);
    const search = await request(url("people", { search: "2" }));
    assert.equal(search.total, 1);
    assert.equal(search.items[0].personName, b.name);
    const filtered = await request(
      url("days", {
        filters: { status: ["approved"] },
        sort: "date",
        direction: "desc",
      }),
    );
    assert.equal(filtered.total, 27);
    assert.equal(filtered.totals.normalMinutes, 27 * 450);
    assert.ok(filtered.items[0].date > filtered.items[1].date);
    const values = await request(
      url("days/values/date", {
        from: "2026-06-01",
        to: "2026-06-02",
        personIds: [String(a._id)],
      }),
    );
    assert.deepEqual(
      values.values.map((x) => x.value),
      ["2026-06-01", "2026-06-02"],
    );
    const night = await request(
      url("days", {
        from: "2026-06-01",
        to: "2026-06-01",
        personIds: [String(a._id)],
        includePunches: true,
      }),
    );
    assert.equal(night.items[0].punches.length, 2);
    assert.equal(night.items[0].missingPunches, 1);
    assert.equal(
      night.items[0].punches[1].occurredAt,
      exit.occurredAt.toISOString(),
    );
    assert.equal(night.items[0].punches[0].hasCapture, true);
    assert.equal(night.items[0].punches[0].captureEncrypted, undefined);
    assert.ok(!JSON.stringify(night).includes("private-"));
    const empty = await request(
      url("days", { from: "2020-01-01", to: "2020-01-31" }),
    );
    assert.equal(empty.total, 0);
    assert.equal(empty.totals.normalMinutes, 0);
    for (const params of [
      { from: "2026-02-30" },
      { to: "2025-01-01" },
      { to: "2028-01-01" },
      { personIds: ["bad"] },
      { filters: { captureEncrypted: ["x"] } },
      { sort: "manualHistory" },
      { personIds: '{"$ne":null}' },
    ])
      await request(url("days", params), 400);
    await Account.updateOne({ _id: "owner" }, { $set: { role: "reviewer" } });
    assert.equal((await request(url("people"))).total, 2);
    assert.deepEqual(
      await Review.find().select("+manualHistory").lean(),
      originals,
    );
  } finally {
    await new Promise((r) => server.close(r));
    assert.match(mongoose.connection.name, /^control_rrhh_test_[a-f0-9]{16}$/);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
