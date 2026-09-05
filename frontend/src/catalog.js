import { today } from "./api.js";
const f = (key, label, type = "text", extra = {}) => ({
  key,
  label,
  type,
  ...extra,
});
const common = [f("active", "Activo", "boolean")];
const person = f("personId", "Persona", "relation", { resource: "people" });
const group = f("groupId", "Grupo", "relation", { resource: "groups" });
const shift = f("shiftId", "Turno fijo", "relation", { resource: "shifts" });
export const catalog = {
  people: {
    title: "Personas",
    description: "Legajos, equipos y registro facial en un solo lugar.",
    singular: "persona",
    columns: [
      ["employeeNumber", "Legajo"],
      ["name", "Persona"],
      ["department", "Área"],
      ["location", "Ubicación"],
      ["faceCount", "Capturas"],
      ["active", "Activo"],
    ],
    fields: [
      f("name", "Nombre completo"),
      f("document", "Documento"),
      f("email", "Correo (opcional)", "email"),
      f("department", "Área / sección"),
      f("location", "Sede / línea"),
      group,
      f("hireDate", "Fecha de ingreso", "date"),
      f("terminationDate", "Fecha de baja (opcional)", "date"),
      f("annualLeaveDays", "Cupo anual de vacaciones (días)", "number"),
      ...common,
    ],
    defaults: { hireDate: today(), annualLeaveDays: 0, active: true },
  },
  groups: {
    title: "Grupos y equipos",
    description: "Organizá cuadrillas, departamentos y destinos.",
    singular: "grupo",
    columns: [
      ["name", "Grupo"],
      ["department", "Área"],
      ["location", "Ubicación"],
      ["active", "Activo"],
    ],
    fields: [
      f("name", "Nombre"),
      f("department", "Área"),
      f("location", "Ubicación"),
      f("color", "Color", "color"),
      ...common,
    ],
  },
  shifts: {
    title: "Horarios",
    description: "Turnos diarios y nocturnos, pausas y tolerancias.",
    singular: "horario",
    columns: [
      ["name", "Horario"],
      ["start", "Inicio"],
      ["end", "Fin"],
      ["breakMinutes", "Pausa no paga"],
      ["toleranceMinutes", "Tolerancia"],
      ["active", "Activo"],
    ],
    fields: [
      f("name", "Nombre"),
      f("start", "Inicio", "time"),
      f("end", "Fin (día siguiente si es menor al inicio)", "time"),
      f("breakMinutes", "Pausa no paga (minutos)", "number"),
      f("toleranceMinutes", "Tolerancia de entrada (minutos)", "number"),
      f("color", "Color", "color"),
      ...common,
    ],
    defaults: {
      start: "08:00",
      end: "16:00",
      breakMinutes: 0,
      toleranceMinutes: 5,
      active: true,
    },
  },
  patterns: {
    title: "Rotaciones",
    description: "Secuencias repetitivas de turnos y días de descanso.",
    singular: "patrón",
    columns: [
      ["name", "Patrón"],
      ["anchorDate", "Día 1 del ciclo"],
      ["active", "Activo"],
    ],
    fields: [
      f("name", "Nombre"),
      f("anchorDate", "Fecha del día 1 del ciclo", "date"),
      f("sequence", "Secuencia de días", "sequence"),
      ...common,
    ],
    defaults: { anchorDate: today(), sequence: [""], active: true },
  },
  assignments: {
    title: "Asignaciones",
    description:
      "Una asignación individual tiene prioridad sobre la de su grupo.",
    singular: "asignación",
    columns: [
      ["name", "Asignación"],
      ["startDate", "Desde"],
      ["endDate", "Hasta"],
      ["department", "Área"],
      ["location", "Destino"],
      ["active", "Activo"],
    ],
    fields: [
      f("name", "Descripción"),
      person,
      group,
      shift,
      f("patternId", "Patrón rotativo", "relation", { resource: "patterns" }),
      f("startDate", "Vigente desde", "date"),
      f("endDate", "Hasta (opcional)", "date"),
      f("weekdays", "Días aplicables", "weekdays"),
      f("department", "Área de destino"),
      f("location", "Sede / línea de destino"),
      ...common,
    ],
    defaults: { startDate: today(), weekdays: [1, 2, 3, 4, 5], active: true },
  },
  absences: {
    title: "Vacaciones y ausencias",
    description: "Solicitudes, cupos y autorizaciones trazables.",
    singular: "solicitud",
    columns: [
      ["personName", "Persona"],
      ["type", "Tipo"],
      ["startDate", "Desde"],
      ["endDate", "Hasta"],
      ["days", "Días"],
      ["status", "Estado"],
    ],
    fields: [
      person,
      f("type", "Tipo", "select", {
        options: [
          "vacation",
          "medical",
          "permission",
          "unjustified",
          "suspension",
        ],
      }),
      f("startDate", "Desde", "date"),
      f("endDate", "Hasta", "date"),
      f("reason", "Motivo", "textarea"),
    ],
    defaults: { type: "vacation", startDate: today(), endDate: today() },
  },
  extensions: {
    title: "Extensiones de jornada",
    description:
      "Autorizá rangos adicionales; se computan sólo las horas realmente fichadas.",
    singular: "extensión",
    columns: [
      ["personName", "Persona"],
      ["date", "Fecha"],
      ["start", "Desde"],
      ["end", "Hasta"],
      ["status", "Estado"],
    ],
    fields: [
      person,
      f("date", "Día laboral", "date"),
      f("start", "Desde", "time"),
      f("end", "Hasta", "time"),
      f("reason", "Motivo", "textarea"),
    ],
    defaults: { date: today(), start: "16:00", end: "18:00" },
  },
  holidays: {
    title: "Feriados",
    description: "Calendario general o específico por ubicación.",
    singular: "feriado",
    columns: [
      ["name", "Feriado"],
      ["date", "Fecha"],
      ["location", "Ubicación"],
      ["active", "Activo"],
    ],
    fields: [
      f("name", "Nombre"),
      f("date", "Fecha", "date"),
      f("location", "Ubicación (vacío = todas)"),
      ...common,
    ],
    defaults: { date: today(), active: true },
  },
  terminals: {
    title: "Terminales FaceVision",
    description: "Pantallas autónomas de fichaje para notebook y tablets.",
    singular: "terminal",
    columns: [
      ["name", "Terminal"],
      ["location", "Ubicación"],
      ["active", "Activo"],
    ],
    fields: [
      f("name", "Nombre"),
      f("location", "Ubicación"),
      group,
      f("duplicateSeconds", "Bloqueo de duplicados (segundos)", "number"),
      f("detectionDelayMs", "Espera antes del contador (ms)", "number"),
      f("countdownMs", "Duración de cada número (ms)", "number"),
      f("resultMs", "Duración de OK / error (ms)", "number"),
      f("matchThreshold", "Coincidencia mínima (0,72–0,99)", "number"),
      f("ambiguityMargin", "Diferencia mínima entre candidatos", "number"),
      ...common,
    ],
    defaults: {
      duplicateSeconds: 30,
      detectionDelayMs: 1000,
      countdownMs: 500,
      resultMs: 2500,
      matchThreshold: 0.72,
      ambiguityMargin: 0.05,
      active: true,
    },
  },
  punches: {
    title: "Fichadas",
    description:
      "Evidencia original sin procesar. La captura no analiza turnos.",
    columns: [
      ["employeeNumber", "Legajo"],
      ["personName", "Persona"],
      ["direction", "Movimiento"],
      ["occurredAt", "Fecha y hora"],
      ["source", "Origen"],
      ["similarity", "Coincidencia"],
      ["hasCapture", "Captura"],
    ],
    fields: [],
  },
  reviews: {
    title: "Revisión de jornadas",
    description: "Compará lo planificado con lo fichado antes de aprobar.",
    columns: [
      ["personName", "Persona"],
      ["date", "Día laboral"],
      ["shiftName", "Turno"],
      ["normalMinutes", "Normales"],
      ["outsideMinutes", "Fuera de turno"],
      ["extra50Minutes", "Extra 50%"],
      ["extra100Minutes", "Extra 100%"],
      ["status", "Estado"],
      ["manuallyEdited", "Edición manual"],
    ],
    fields: [],
  },
  audit: {
    title: "Auditoría",
    description: "Historial de operaciones administrativas y fichajes.",
    columns: [
      ["createdAt", "Fecha"],
      ["actor", "Actor"],
      ["action", "Operación"],
      ["entity", "Recurso"],
    ],
    fields: [],
  },
};
export function initial(resource, record) {
  return (
    record ||
    Object.fromEntries(
      catalog[resource].fields.map((field) => [
        field.key,
        catalog[resource].defaults?.[field.key] ??
          (field.type === "number"
            ? 0
            : field.type === "boolean"
              ? true
              : field.type === "weekdays"
                ? [1, 2, 3, 4, 5]
                : field.type === "sequence"
                  ? [""]
                  : field.type === "color"
                    ? "#ff6500"
                    : ""),
      ]),
    )
  );
}
