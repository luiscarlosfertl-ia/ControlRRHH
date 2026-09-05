import { z } from "zod";
import { DateTime } from "luxon";
import { fail } from "./security.js";
const minutes = z.number().finite().min(0).max(2880);
const stamp = z.union([
  z.string().datetime({ offset: true }),
  z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?$/),
]);
export const editSchema = z.object({
  version: z.number().int().min(0),
  reason: z.string().trim().min(5).max(500),
  segments: z
    .array(
      z.object({
        start: stamp,
        end: stamp,
        kind: z.enum(["normal", "outside", "extra50", "extra100"]),
      }),
    )
    .max(64),
  unpaidBreakMinutes: minutes,
  lateMinutes: minutes,
  earlyMinutes: minutes,
  absence: z.enum([
    "",
    "vacation",
    "medical",
    "permission",
    "unjustified",
    "suspension",
  ]),
});
export const snapshotReview = (row) =>
  Object.fromEntries(
    [
      "segments",
      "workedMinutes",
      "normalMinutes",
      "outsideMinutes",
      "extra50Minutes",
      "extra100Minutes",
      "lateMinutes",
      "earlyMinutes",
      "absence",
      "unpaidBreakMinutes",
    ].map((k) => [
      k,
      row[k] ?? (k === "segments" ? [] : k === "absence" ? "" : 0),
    ]),
  );
export function editedValues(row, data) {
  const normalize = (stamp) => {
    const value = DateTime.fromISO(stamp, {
      zone: row.policy?.timeZone || "UTC",
    });
    if (
      !value.isValid ||
      (!/(Z|[+-]\d\d:\d\d)$/.test(stamp) &&
        !value.toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS").startsWith(stamp))
    )
      fail("Fecha u hora local inválida para la zona de la jornada.");
    return value.toUTC().toISO();
  };
  const segments = data.segments
    .map((s) => ({ ...s, start: normalize(s.start), end: normalize(s.end) }))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const boundary = DateTime.fromISO(row.date, {
    zone: row.policy?.timeZone || "UTC",
  }).startOf("day");
  let previousEnd = 0,
    normal = 0,
    outside = 0,
    extra50 = 0,
    extra100 = 0,
    worked = 0;
  for (const s of segments) {
    const start = Date.parse(s.start),
      end = Date.parse(s.end);
    if (end <= start || start < previousEnd)
      fail("Los tramos deben tener duración positiva y no superponerse.");
    if (
      start < boundary.toMillis() ||
      end > boundary.plus({ days: 2 }).toMillis()
    )
      fail(
        "Los tramos deben estar dentro del día laboral o su continuación al día siguiente.",
      );
    previousEnd = end;
    const amount = (end - start) / 60000;
    worked += amount;
    if (s.kind === "normal") normal += amount;
    else outside += amount;
    if (s.kind === "extra50") extra50 += amount;
    if (s.kind === "extra100") extra100 += amount;
  }
  if (data.unpaidBreakMinutes > normal)
    fail("La pausa no paga no puede superar los minutos normales.");
  return {
    segments,
    workedMinutes: worked,
    normalMinutes: normal - data.unpaidBreakMinutes,
    outsideMinutes: outside,
    extra50Minutes: extra50,
    extra100Minutes: extra100,
    unpaidBreakMinutes: data.unpaidBreakMinutes,
    lateMinutes: data.lateMinutes,
    earlyMinutes: data.earlyMinutes,
    absence: data.absence,
  };
}
