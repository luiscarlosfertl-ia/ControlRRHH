import test from "node:test";
import assert from "node:assert/strict";
import {
  nextDirection,
  resolveSchedule,
  pairPunches,
  projectAttendance,
} from "../src/attendance.js";
import { chooseIdentity } from "../src/facevision.js";
import { schemas, defaults } from "../src/validation.js";
const person = {
  _id: "p1",
  employeeNumber: 1,
  name: "Persona de prueba",
  groupId: "g1",
  hireDate: "2020-01-01",
};
function context() {
  return {
    settings: { ...defaults, timeZone: "UTC" },
    shifts: [
      {
        _id: "s1",
        name: "Mañana",
        start: "08:00",
        end: "16:00",
        active: true,
        breakMinutes: 0,
        toleranceMinutes: 5,
      },
    ],
    assignments: [
      {
        _id: "a1",
        name: "Grupo",
        groupId: "g1",
        shiftId: "s1",
        startDate: "2020-01-01",
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        active: true,
      },
    ],
    patterns: [],
    absences: [],
    extensions: [],
    holidays: [],
  };
}
const punch = (id, direction, stamp) => ({
  _id: id,
  direction,
  occurredAt: `${stamp}:00Z`,
});
test("fichaje alterna sin depender de turno, fecha ni procesamiento", () => {
  assert.equal(nextDirection(), "in");
  assert.equal(
    nextDirection({
      direction: "in",
      processed: true,
      occurredAt: "2000-01-01",
    }),
    "out",
  );
  assert.equal(nextDirection({ direction: "out" }), "in");
});
test("turno normal computa 8 horas y ningún extra", () => {
  const [row] = projectAttendance(
    person,
    "2026-08-03",
    "2026-08-03",
    [
      punch("1", "in", "2026-08-03T08:00"),
      punch("2", "out", "2026-08-03T16:00"),
    ],
    context(),
  );
  assert.equal(row.normalMinutes, 480);
  assert.equal(row.outsideMinutes, 0);
  assert.deepEqual(row.punchIds, ["1", "2"]);
});
test("fuera de turno no se convierte en extra sin autorización", () => {
  const [row] = projectAttendance(
    person,
    "2026-08-03",
    "2026-08-03",
    [
      punch("1", "in", "2026-08-03T07:30"),
      punch("2", "out", "2026-08-03T17:00"),
    ],
    context(),
  );
  assert.equal(row.outsideMinutes, 90);
  assert.equal(row.extra50Minutes, 0);
  assert.ok(row.anomalies.length);
});
test("extensión aprobada cubre sólo tiempo realmente fichado", () => {
  const ctx = context();
  ctx.extensions.push({
    personId: "p1",
    status: "approved",
    date: "2026-08-03",
    start: "16:00",
    end: "18:00",
  });
  const [row] = projectAttendance(
    person,
    "2026-08-03",
    "2026-08-03",
    [
      punch("1", "in", "2026-08-03T08:00"),
      punch("2", "out", "2026-08-03T17:00"),
    ],
    ctx,
  );
  assert.equal(row.extra50Minutes, 60);
});
test("turno nocturno pertenece al día de comienzo", () => {
  const ctx = context();
  ctx.shifts[0].start = "22:00";
  ctx.shifts[0].end = "06:00";
  const rows = projectAttendance(
    person,
    "2026-08-03",
    "2026-08-04",
    [
      punch("1", "in", "2026-08-03T22:00"),
      punch("2", "out", "2026-08-04T06:00"),
    ],
    ctx,
  );
  assert.equal(rows[0].normalMinutes, 480);
  assert.equal(rows[1].workedMinutes, 0);
});
test("entrada de madrugada se asocia al turno del día anterior", () => {
  const ctx = context();
  ctx.shifts[0].start = "22:00";
  ctx.shifts[0].end = "06:00";
  const [row] = projectAttendance(
    person,
    "2026-08-03",
    "2026-08-03",
    [
      punch("1", "in", "2026-08-04T00:30"),
      punch("2", "out", "2026-08-04T06:00"),
    ],
    ctx,
  );
  assert.equal(row.normalMinutes, 330);
  assert.equal(row.lateMinutes, 150);
});
test("asignación personal prima y dos personales producen conflicto", () => {
  const ctx = context();
  ctx.assignments.push({ ...ctx.assignments[0], personId: "p1", groupId: "" });
  assert.equal(resolveSchedule(person, "2026-08-03", ctx).name, "Mañana");
  ctx.assignments.push({ ...ctx.assignments[1] });
  assert.equal(resolveSchedule(person, "2026-08-03", ctx).conflict, true);
});
test("rotación se repite con descanso y fechas previas a ancla", () => {
  const ctx = context();
  ctx.patterns.push({
    _id: "pat",
    active: true,
    anchorDate: "2026-08-03",
    sequence: ["s1", ""],
  });
  ctx.assignments[0].shiftId = "";
  ctx.assignments[0].patternId = "pat";
  assert.equal(resolveSchedule(person, "2026-08-04", ctx).rest, true);
  assert.equal(resolveSchedule(person, "2026-08-05", ctx).name, "Mañana");
  assert.equal(resolveSchedule(person, "2026-08-02", ctx).rest, true);
});
test("ausencia aprobada evita falta injustificada", () => {
  const ctx = context();
  ctx.absences.push({
    personId: "p1",
    status: "approved",
    startDate: "2026-08-03",
    endDate: "2026-08-03",
    type: "vacation",
  });
  assert.equal(
    projectAttendance(person, "2026-08-03", "2026-08-03", [], ctx)[0].absence,
    "vacation",
  );
});
test("entradas abiertas no quedan marcadas como procesadas", () => {
  const [row] = projectAttendance(
    person,
    "2026-08-03",
    "2026-08-03",
    [punch("1", "in", "2026-08-03T08:00")],
    context(),
  );
  assert.deepEqual(row.punchIds, []);
  assert.ok(row.anomalies.includes("Entrada abierta"));
  assert.equal(row.absence, "");
});
test("duración máxima y salida huérfana se señalan", () => {
  const result = pairPunches([
    punch("1", "out", "2026-08-03T08:00"),
    punch("2", "in", "2026-08-03T09:00"),
    punch("3", "out", "2026-08-05T16:00"),
  ]);
  assert.equal(result.pairs.length, 0);
  assert.equal(result.anomalies.length, 2);
});
test("tolerancia no redondea ni borra los minutos reales", () => {
  const [row] = projectAttendance(
    person,
    "2026-08-03",
    "2026-08-03",
    [
      punch("1", "in", "2026-08-03T08:04"),
      punch("2", "out", "2026-08-03T16:00"),
    ],
    context(),
  );
  assert.equal(row.lateMinutes, 0);
  assert.equal(row.normalMinutes, 476);
});
test("100% configurable cruza medianoche por fecha efectiva", () => {
  const ctx = context();
  ctx.settings.extra100Weekdays = [7];
  ctx.extensions = [
    {
      personId: "p1",
      status: "approved",
      date: "2026-08-08",
      start: "23:00",
      end: "02:00",
    },
  ];
  const [row] = projectAttendance(
    person,
    "2026-08-08",
    "2026-08-08",
    [
      punch("1", "in", "2026-08-08T23:00"),
      punch("2", "out", "2026-08-09T02:00"),
    ],
    ctx,
  );
  assert.equal(row.extra50Minutes, 60);
  assert.equal(row.extra100Minutes, 120);
});
test("FaceVision rechaza catálogo incompleto y ambigüedad", () => {
  const people = [{ _id: "p1" }, { _id: "p2" }],
    result = {
      status: "ok",
      facesDetected: 1,
      results: [
        { id: "p1", verified: true, similarity: 0.85 },
        { id: "p2", verified: true, similarity: 0.83 },
      ],
    };
  assert.throws(() => chooseIdentity(result, people, 0.72, 0.05), /ambigua/);
  assert.throws(
    () =>
      chooseIdentity(
        { ...result, results: result.results.slice(0, 1) },
        people,
        0.72,
        0.05,
      ),
    /completó/,
  );
  result.results[1].similarity = 0.4;
  assert.equal(chooseIdentity(result, people, 0.72, 0.05).person._id, "p1");
});
test("fechas imposibles y turno vacío se rechazan", () => {
  assert.equal(
    schemas.shifts.safeParse({ name: "Turno", start: "08:00", end: "08:00" })
      .success,
    false,
  );
  assert.equal(
    schemas.holidays.safeParse({ name: "Feriado", date: "2026-02-30" }).success,
    false,
  );
});
