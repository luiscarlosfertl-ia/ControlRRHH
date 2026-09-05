import { z } from "zod";
import { DateTime, IANAZone } from "luxon";
const text = z.string().trim().max(240),
  name = text.min(2),
  id = z.string().regex(/^[a-f\d]{24}$/i),
  optionalId = z.union([id, z.literal("")]).default("");
export const date = z
  .string()
  .refine(
    (x) => /^\d{4}-\d{2}-\d{2}$/.test(x) && DateTime.fromISO(x).isValid,
    "Fecha inválida",
  );
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endDate = z.union([date, z.literal("")]).default("");
const active = z.boolean().default(true);
export const schemas = {
  people: z.object({
    name,
    email: z.union([z.string().email(), z.literal("")]).default(""),
    document: text.default(""),
    department: text.default(""),
    location: text.default(""),
    groupId: optionalId,
    active,
    hireDate: date,
    terminationDate: endDate,
    annualLeaveDays: z.number().int().min(0).max(365).default(0),
  }),
  groups: z.object({
    name,
    department: text.default(""),
    location: text.default(""),
    color: text.default("#6579d5"),
    active,
  }),
  shifts: z
    .object({
      name,
      start: time,
      end: time,
      breakMinutes: z.number().int().min(0).max(600).default(0),
      toleranceMinutes: z.number().int().min(0).max(120).default(5),
      color: text.default("#6579d5"),
      active,
    })
    .refine(
      (x) => x.start !== x.end,
      "El turno debe tener inicio y fin distintos",
    ),
  patterns: z.object({
    name,
    anchorDate: date,
    sequence: z.array(optionalId).min(1).max(90),
    active,
  }),
  assignments: z
    .object({
      name,
      personId: optionalId,
      groupId: optionalId,
      shiftId: optionalId,
      patternId: optionalId,
      startDate: date,
      endDate,
      weekdays: z.array(z.number().int().min(1).max(7)).min(1),
      department: text.default(""),
      location: text.default(""),
      active,
    })
    .refine(
      (x) => Boolean(x.personId) !== Boolean(x.groupId),
      "Elegí persona o grupo, no ambos",
    )
    .refine(
      (x) => Boolean(x.shiftId) !== Boolean(x.patternId),
      "Elegí turno o patrón, no ambos",
    )
    .refine((x) => !x.endDate || x.endDate >= x.startDate, "Vigencia inválida"),
  absences: z
    .object({
      personId: id,
      type: z.enum([
        "vacation",
        "medical",
        "permission",
        "unjustified",
        "suspension",
      ]),
      startDate: date,
      endDate: date,
      reason: name,
    })
    .refine((x) => x.endDate >= x.startDate, "Rango inválido"),
  extensions: z
    .object({ personId: id, date, start: time, end: time, reason: name })
    .refine((x) => x.start !== x.end, "Rango vacío"),
  holidays: z.object({ name, date, location: text.default(""), active }),
  terminals: z.object({
    name,
    location: text.default(""),
    groupId: optionalId,
    active,
    duplicateSeconds: z.number().int().min(5).max(600).default(30),
    detectionDelayMs: z.number().int().min(300).max(5000).default(1000),
    countdownMs: z.number().int().min(200).max(2000).default(500),
    resultMs: z.number().int().min(1000).max(10000).default(2500),
    matchThreshold: z.number().min(0.72).max(0.99).default(0.72),
    ambiguityMargin: z.number().min(0.02).max(0.3).default(0.05),
  }),
  settings: z.object({
    companyName: name,
    timeZone: z
      .string()
      .refine((x) => IANAZone.isValidZone(x), "Zona IANA inválida"),
    extra100Weekdays: z.array(z.number().int().min(1).max(7)),
    saturday100From: z.union([time, z.literal("")]),
    maxPairHours: z.number().min(1).max(36),
    countHolidayAs100: z.boolean(),
    leaveCountMode: z.enum(["calendar", "working"]),
  }),
};
export const defaults = {
  companyName: "ControlRRHH",
  timeZone: "America/Argentina/Buenos_Aires",
  extra100Weekdays: [],
  saturday100From: "",
  maxPairHours: 24,
  countHolidayAs100: false,
  leaveCountMode: "calendar",
};
