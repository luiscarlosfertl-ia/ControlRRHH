// Isolated visual QA only. Never points at the operational database.
import mongoose from "mongoose";
import crypto from "node:crypto";
import express from "express";
import path from "node:path";
import { createApp, initialize } from "../backend/src/app.js";
import {
  Account,
  Counter,
  Person,
  Group,
  Shift,
  Assignment,
  Terminal,
  Punch,
  Review,
} from "../backend/src/models.js";
import { root, passwordHash, hash } from "../backend/src/security.js";
import { DateTime } from "luxon";
const name = `control_rrhh_test_${crypto.randomBytes(8).toString("hex")}`;
await mongoose.connect("mongodb://127.0.0.1:27017", { dbName: name });
await initialize();
await Account.create({
  _id: "owner",
  name: "Administración QA",
  email: "qa@example.test",
  password: await passwordHash("QA-Local-Only-2026"),
  role: "admin",
});
const group = await Group.create({
  name: "Cuadrilla de prueba",
  department: "Aserradero",
  location: "Planta de prueba",
});
const shift = await Shift.create({
  name: "Mañana de prueba",
  start: "06:00",
  end: "14:00",
  active: true,
  breakMinutes: 0,
  toleranceMinutes: 5,
  color: "#8293dd",
});
await Assignment.create({
  name: "Turno de prueba",
  groupId: String(group._id),
  shiftId: String(shift._id),
  startDate: "2026-01-01",
  weekdays: [1, 2, 3, 4, 5],
  active: true,
});
const people = await Person.insertMany(
  Array.from({ length: 55 }, (_, i) => ({
    name: `Persona prueba ${String(i + 1).padStart(2, "0")}`,
    employeeNumber: i + 1,
    hireDate: "2026-01-01",
    groupId: i < 10 ? String(group._id) : "",
    department: i < 10 ? "Aserradero" : "Administración",
    location: "Planta de prueba",
    annualLeaveDays: 14,
    active: true,
  })),
);
await Counter.updateOne(
  { _id: "employee" },
  { $set: { value: 55 } },
  { upsert: true },
);
await Terminal.create({
  name: "Terminal de prueba",
  location: "Planta de prueba",
  tokenHash: hash(crypto.randomUUID()),
  active: true,
});
await Punch.create({
  personId: String(people[0]._id),
  personName: people[0].name,
  employeeNumber: 1,
  occurredAt: new Date(),
  direction: "in",
  source: "manual",
  terminalId: "qa",
  requestId: crypto.randomUUID(),
  reason: "QA sintético",
});
const reviewDate = DateTime.now()
  .setZone("America/Argentina/Buenos_Aires")
  .minus({ days: 1 })
  .toISODate();
const from = DateTime.fromISO(`${reviewDate}T06:00`, {
    zone: "America/Argentina/Buenos_Aires",
  }),
  to = from.plus({ hours: 8 });
const reportPunches = await Punch.create([
  {
    personId: String(people[0]._id),
    personName: people[0].name,
    employeeNumber: 1,
    occurredAt: from.toJSDate(),
    direction: "in",
    source: "manual",
    terminalId: "qa-report",
    requestId: crypto.randomUUID(),
    processed: true,
    reason: "Informe QA sintético",
  },
  {
    personId: String(people[0]._id),
    personName: people[0].name,
    employeeNumber: 1,
    occurredAt: to.toJSDate(),
    direction: "out",
    source: "manual",
    terminalId: "qa-report",
    requestId: crypto.randomUUID(),
    processed: true,
    reason: "Informe QA sintético",
  },
]);
await Review.create({
  personId: String(people[0]._id),
  personName: people[0].name,
  employeeNumber: 1,
  date: reviewDate,
  shiftName: shift.name,
  status: "review",
  expectedMinutes: 480,
  workedMinutes: 480,
  normalMinutes: 480,
  outsideMinutes: 0,
  extra50Minutes: 0,
  extra100Minutes: 0,
  lateMinutes: 0,
  earlyMinutes: 0,
  absence: "",
  anomalies: [],
  segments: [{ start: from.toISO(), end: to.toISO(), kind: "normal" }],
  policy: {
    timeZone: "America/Argentina/Buenos_Aires",
    shift: { name: shift.name, start: "06:00", end: "14:00" },
  },
  punchIds: reportPunches.map((p) => String(p._id)),
});
const app = createApp(),
  dist = path.join(root, "frontend/dist");
app.use(express.static(dist));
app.get("/{*splat}", (_req, res) =>
  res.sendFile(path.join(dist, "index.html")),
);
const server = app.listen(3101, "127.0.0.1", () =>
  console.log(JSON.stringify({ qa: "http://127.0.0.1:3101", database: name })),
);
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await new Promise((resolve) => server.close(resolve));
  if (!/^control_rrhh_test_[a-f0-9]{16}$/.test(mongoose.connection.name))
    throw new Error("Unsafe cleanup target");
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log("QA database removed");
  process.exit();
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, close);
