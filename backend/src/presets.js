import crypto from "node:crypto";
import { z } from "zod";
import { date, schemas } from "./validation.js";
import { resources, Counter, PresetInstallation } from "./models.js";
import { locked, fail, audit } from "./security.js";

// Operational examples only: do not install legislation, biometric or attendance evidence.
export const presets = [
  {
    id: "industry",
    name: "Industria",
    department: "Producción",
    location: "Planta",
    description:
      "Dos cuadrillas rotativas: 5 días de mañana, 2 de descanso, 5 de tarde y 2 de descanso. La segunda cuadrilla inicia por la tarde.",
    shifts: [
      { name: "Mañana", start: "06:00", end: "14:00" },
      { name: "Tarde", start: "14:00", end: "22:00" },
    ],
    groups: ["Cuadrilla A", "Cuadrilla B"],
    rotating: true,
    weekdays: [1, 2, 3, 4, 5, 6, 7],
  },
  {
    id: "commerce",
    name: "Comercio",
    department: "Atención y ventas",
    location: "Sucursal",
    description:
      "Dos equipos con horario fijo de lunes a sábado: apertura y cierre.",
    shifts: [
      { name: "Apertura", start: "08:00", end: "14:00" },
      { name: "Cierre", start: "14:00", end: "20:00" },
    ],
    groups: ["Equipo apertura", "Equipo cierre"],
    rotating: false,
    weekdays: [1, 2, 3, 4, 5, 6],
  },
  {
    id: "services",
    name: "Servicios y oficinas",
    department: "Administración",
    location: "Oficina",
    description:
      "Dos equipos con horario fijo de lunes a viernes: administración y soporte.",
    shifts: [
      { name: "Administración", start: "09:00", end: "17:00" },
      { name: "Soporte", start: "10:00", end: "18:00" },
    ],
    groups: ["Equipo administración", "Equipo soporte"],
    rotating: false,
    weekdays: [1, 2, 3, 4, 5],
  },
];
export const presetOptions = z.object({
  startDate: date,
  includeDemoPeople: z.boolean().default(false),
});
const stableId = (key, resource, index) =>
  crypto
    .createHash("sha256")
    .update(`controlrrhh:preset:v1:${key}:${resource}:${index}`)
    .digest("hex")
    .slice(0, 24);
export async function applyPreset(key, options, actor) {
  const preset = presets.find((p) => p.id === key);
  if (!preset) fail("Preconfiguración no disponible", 404);
  const requested = presetOptions.parse(options);
  return locked(`preset:${key}`, async () => {
    let installation = await PresetInstallation.findById(key);
    if (installation) {
      if (
        installation.startDate !== requested.startDate ||
        installation.includeDemoPeople !== requested.includeDemoPeople
      )
        fail(
          "Esta plantilla ya se inició con otras opciones. Continuá con las originales y editá luego los registros creados.",
          409,
        );
      if (installation.status === "ready")
        return { ...installation.toObject(), replay: true };
    } else
      installation = await PresetInstallation.create({
        _id: key,
        ...requested,
        status: "applying",
      });
    const counts = {};
    async function insert(resource, index, values) {
      const _id = stableId(key, resource, index),
        Model = resources[resource];
      // Deterministic identities permit resuming partial installation without overwriting edits.
      if (!(await Model.exists({ _id }))) {
        const parsed = schemas[resource].parse(values);
        if (resource === "people")
          parsed.employeeNumber = (
            await Counter.findOneAndUpdate(
              { _id: "employee" },
              { $inc: { value: 1 } },
              { upsert: true, new: true },
            )
          ).value;
        await Model.create({ _id, ...parsed });
      }
      counts[resource] = (counts[resource] || 0) + 1;
      return _id;
    }
    const shiftIds = [];
    for (const [i, shift] of preset.shifts.entries())
      shiftIds.push(
        await insert("shifts", i, {
          ...shift,
          name: `${preset.name} · ${shift.name}`,
          breakMinutes: 0,
          toleranceMinutes: 0,
        }),
      );
    for (const [i, groupName] of preset.groups.entries()) {
      const groupId = await insert("groups", i, {
        name: `${preset.name} · ${groupName}`,
        department: preset.department,
        location: preset.location,
      });
      let patternId = "";
      if (preset.rotating)
        patternId = await insert("patterns", i, {
          name: `${preset.name} · Ciclo ${i + 1}`,
          anchorDate: requested.startDate,
          sequence: [
            ...Array(5).fill(shiftIds[i]),
            "",
            "",
            ...Array(5).fill(shiftIds[1 - i]),
            "",
            "",
          ],
        });
      await insert("assignments", i, {
        name: `${preset.name} · ${groupName}`,
        groupId,
        patternId,
        shiftId: patternId ? "" : shiftIds[i],
        startDate: requested.startDate,
        weekdays: preset.weekdays,
        department: preset.department,
        location: preset.location,
      });
      if (requested.includeDemoPeople)
        for (let n = 0; n < 10; n++)
          await insert("people", i * 10 + n, {
            name: `DEMO · ${preset.name} · Persona ${String(i * 10 + n + 1).padStart(2, "0")}`,
            groupId,
            department: preset.department,
            location: preset.location,
            hireDate: requested.startDate,
            annualLeaveDays: 0,
          });
    }
    await insert("terminals", 0, {
      name: `${preset.name} · Terminal de ejemplo`,
      location: preset.location,
      active: false,
    });
    installation.status = "ready";
    installation.counts = counts;
    await installation.save();
    await audit(actor, "preset.applied", "presets", key, {
      ...requested,
      counts,
    });
    return installation.toObject();
  });
}
