import { z } from "zod";
import { DateTime } from "luxon";
import { Review, Punch } from "./models.js";
import { date } from "./validation.js";
import { fail } from "./security.js";

const minuteFields = [
  "expectedMinutes",
  "workedMinutes",
  "normalMinutes",
  "outsideMinutes",
  "extra50Minutes",
  "extra100Minutes",
  "lateMinutes",
  "earlyMinutes",
];
const absenceTypes = [
  "vacation",
  "medical",
  "permission",
  "unjustified",
  "suspension",
];
const counts = [
  "days",
  "lateDays",
  "earlyDays",
  "absenceDays",
  "reviewDays",
  "approvedDays",
  "manualDays",
  ...absenceTypes.map((t) => `${t}Days`),
];
const numeric = [...minuteFields, "unapprovedMinutes", ...counts];
const dayColumns = [
  "employeeNumber",
  "personName",
  "date",
  "shiftName",
  "status",
  "absence",
  "manuallyEdited",
  ...minuteFields,
  "unapprovedMinutes",
];
const personColumns = ["employeeNumber", "personName", ...numeric];
const escape = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const parseJSON = (v, fallback) => {
  try {
    return v ? JSON.parse(v) : fallback;
  } catch {
    fail("Filtros inválidos");
  }
};
const schema = z.object({
  from: date,
  to: date,
  personIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(100),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  search: z.string().max(120).default(""),
  sort: z.string().max(50).default(""),
  direction: z.enum(["asc", "desc"]).default("asc"),
  includePunches: z.enum(["true", "false"]).default("false"),
  filters: z.record(
    z
      .array(
        z.union([
          z.string().max(240),
          z.number().finite(),
          z.boolean(),
          z.null(),
        ]),
      )
      .max(50),
  ),
});
const sum = (fields) =>
  Object.fromEntries(fields.map((k) => [k, { $sum: `$${k}` }]));
const flag = (condition) => ({ $cond: [condition, 1, 0] });

// Reports only read persisted projections. Never re-run attendance or expose biometric fields.
export async function attendanceReport(mode, query, valueField) {
  if (!["days", "people"].includes(mode)) fail("Informe inexistente", 404);
  const q = schema.parse({
    ...query,
    personIds: parseJSON(query.personIds, []),
    filters: parseJSON(query.filters, {}),
  });
  if (
    q.to < q.from ||
    DateTime.fromISO(q.to).diff(DateTime.fromISO(q.from), "days").days > 365
  )
    fail("Seleccioná un rango de hasta 366 días.");
  const columns = mode === "days" ? dayColumns : personColumns;
  const fields = {
    ...Object.fromEntries(
      minuteFields.map((k) => [k, { $ifNull: [`$${k}`, 0] }]),
    ),
    days: { $literal: 1 },
    lateDays: flag({ $gt: ["$lateMinutes", 0] }),
    earlyDays: flag({ $gt: ["$earlyMinutes", 0] }),
    absenceDays: flag({ $ne: [{ $ifNull: ["$absence", ""] }, ""] }),
    reviewDays: flag({ $eq: ["$status", "review"] }),
    approvedDays: flag({ $eq: ["$status", "approved"] }),
    manualDays: flag({ $eq: ["$manuallyEdited", true] }),
    ...Object.fromEntries(
      absenceTypes.map((t) => [`${t}Days`, flag({ $eq: ["$absence", t] })]),
    ),
  };
  const pipeline = [
    {
      $match: {
        date: { $gte: q.from, $lte: q.to },
        ...(q.personIds.length ? { personId: { $in: q.personIds } } : {}),
      },
    },
    // Explicit projection: aggregates do not honor Mongoose select:false.
    {
      $project: {
        personId: 1,
        personName: 1,
        employeeNumber: 1,
        date: 1,
        shiftName: 1,
        status: 1,
        absence: 1,
        manuallyEdited: 1,
        segments: 1,
        punchIds: 1,
        "policy.timeZone": 1,
        anomalies: 1,
        notes: 1,
        ...Object.fromEntries(minuteFields.map((k) => [k, 1])),
      },
    },
    { $set: fields },
    {
      $set: {
        unapprovedMinutes: {
          $max: [
            0,
            {
              $subtract: [
                "$outsideMinutes",
                { $add: ["$extra50Minutes", "$extra100Minutes"] },
              ],
            },
          ],
        },
      },
    },
  ];
  if (mode === "people")
    pipeline.push(
      { $sort: { date: 1, _id: 1 } },
      {
        $group: {
          _id: "$personId",
          personName: { $last: "$personName" },
          employeeNumber: { $last: "$employeeNumber" },
          ...sum(numeric),
        },
      },
      { $set: { personId: "$_id" } },
    );
  const filter = {};
  if (!valueField && q.search)
    filter.$or = [
      { personName: { $regex: escape(q.search), $options: "i" } },
      ...(mode === "days"
        ? [{ shiftName: { $regex: escape(q.search), $options: "i" } }]
        : []),
      ...(/^\d+$/.test(q.search) ? [{ employeeNumber: Number(q.search) }] : []),
    ];
  for (const [key, values] of Object.entries(q.filters)) {
    if (!columns.includes(key)) fail("Columna de filtro inválida");
    if (values.length && key !== valueField) filter[key] = { $in: values };
  }
  pipeline.push({ $match: filter });
  if (valueField) {
    if (!columns.includes(valueField)) fail("Columna inválida");
    pipeline.push(
      { $group: { _id: `$${valueField}` } },
      {
        $set: {
          label: {
            $convert: { input: "$_id", to: "string", onNull: "", onError: "" },
          },
        },
      },
    );
    if (q.search)
      pipeline.push({
        $match: { label: { $regex: escape(q.search), $options: "i" } },
      });
    const values = await Review.aggregate([
      ...pipeline,
      { $sort: { _id: 1 } },
      { $skip: (q.page - 1) * 50 },
      { $limit: 51 },
    ]).option({ maxTimeMS: 15000 });
    return {
      values: values
        .slice(0, 50)
        .map((v) => ({ value: v._id ?? null, label: v.label })),
      hasMore: values.length > 50,
    };
  }
  if (q.sort && !columns.includes(q.sort)) fail("Orden inválido");
  const sort = q.sort
    ? { [q.sort]: q.direction === "desc" ? -1 : 1, _id: 1 }
    : { employeeNumber: 1, ...(mode === "days" ? { date: 1 } : {}), _id: 1 };
  const [result] = await Review.aggregate([
    ...pipeline,
    {
      $facet: {
        items: [{ $sort: sort }, { $skip: (q.page - 1) * 50 }, { $limit: 50 }],
        total: [{ $count: "count" }],
        totals: [{ $group: { _id: null, ...sum(numeric) } }, { $unset: "_id" }],
      },
    },
  ]).option({ maxTimeMS: 15000 });
  if (mode === "days" && q.includePunches === "true") {
    const ids = [
      ...new Set(result.items.flatMap((r) => r.punchIds || [])),
    ].filter((id) => /^[a-f\d]{24}$/i.test(id));
    const punches = await Punch.find({ _id: { $in: ids } })
      .select(
        "personId occurredAt direction source similarity hasCapture reason",
      )
      .sort({ occurredAt: 1, _id: 1 })
      .lean();
    for (const row of result.items) {
      row.punches = punches.filter(
        (p) =>
          p.personId === row.personId && row.punchIds.includes(String(p._id)),
      );
      row.missingPunches =
        new Set(row.punchIds || []).size - row.punches.length;
    }
  }
  return {
    items: result.items,
    total: result.total[0]?.count || 0,
    pages: Math.max(1, Math.ceil((result.total[0]?.count || 0) / 50)),
    page: q.page,
    totals: result.totals[0] || Object.fromEntries(numeric.map((k) => [k, 0])),
    from: q.from,
    to: q.to,
  };
}
