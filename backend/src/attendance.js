import { DateTime } from "luxon";

export function nextDirection(last) {
  return last?.direction === "in" ? "out" : "in";
}
const minutes = (a, b) => Math.max(0, (b - a) / 60000);
const interval = (day, start, end, zone) => {
  const from = DateTime.fromISO(`${day}T${start}`, { zone });
  let to = DateTime.fromISO(`${day}T${end}`, { zone });
  if (to <= from) to = to.plus({ days: 1 });
  return [from.toMillis(), to.toMillis()];
};
export function resolveSchedule(person, day, context) {
  const weekday = DateTime.fromISO(day).weekday;
  const choices = context.assignments.filter(
    (a) =>
      a.active &&
      a.startDate <= day &&
      (!a.endDate || a.endDate >= day) &&
      a.weekdays.includes(weekday) &&
      (a.personId === String(person._id) ||
        (!a.personId && a.groupId && a.groupId === person.groupId)),
  );
  const specific = choices.filter((a) => a.personId);
  const applicable = specific.length ? specific : choices;
  if (applicable.length > 1)
    return { conflict: true, name: "Asignaciones superpuestas", intervals: [] };
  const assignment = applicable[0];
  if (!assignment) return null;
  let shiftId = assignment.shiftId;
  if (assignment.patternId) {
    const pattern = context.patterns.find(
      (p) => String(p._id) === assignment.patternId && p.active,
    );
    if (!pattern?.sequence.length)
      return { conflict: true, name: "Patrón no disponible", intervals: [] };
    const days = Math.round(
      DateTime.fromISO(day).diff(DateTime.fromISO(pattern.anchorDate), "days")
        .days,
    );
    shiftId =
      pattern.sequence[
        ((days % pattern.sequence.length) + pattern.sequence.length) %
          pattern.sequence.length
      ];
    if (!shiftId)
      return { rest: true, name: "Descanso", intervals: [], assignment };
  }
  const shift = context.shifts.find(
    (s) => String(s._id) === shiftId && s.active,
  );
  if (!shift)
    return { conflict: true, name: "Turno no disponible", intervals: [] };
  const location = assignment.location || person.location;
  const holiday = context.holidays.find(
    (h) =>
      h.active && h.date === day && (!h.location || h.location === location),
  );
  return {
    ...shift,
    intervals: [
      interval(day, shift.start, shift.end, context.settings.timeZone),
    ],
    holiday: holiday?.name,
    assignment,
  };
}
export function pairPunches(punches, maximumHours = 24) {
  const pairs = [],
    anomalies = [];
  let entry;
  for (const p of [...punches]
    .filter((p) => !p.voided)
    .sort(
      (a, b) =>
        +new Date(a.occurredAt) - +new Date(b.occurredAt) ||
        String(a._id).localeCompare(String(b._id)),
    )) {
    if (p.direction === "in") {
      if (entry) anomalies.push({ punch: entry, code: "Entrada sin salida" });
      entry = p;
    } else if (!entry) anomalies.push({ punch: p, code: "Salida sin entrada" });
    else {
      const length = minutes(
        +new Date(entry.occurredAt),
        +new Date(p.occurredAt),
      );
      if (length <= 0 || length > maximumHours * 60)
        anomalies.push({
          punch: entry,
          code: "Duración fuera del máximo",
          paired: p,
        });
      else
        pairs.push({
          start: +new Date(entry.occurredAt),
          end: +new Date(p.occurredAt),
          ids: [String(entry._id), String(p._id)],
        });
      entry = null;
    }
  }
  if (entry) anomalies.push({ punch: entry, code: "Entrada abierta" });
  return { pairs, anomalies };
}
function workday(person, stamp, context) {
  const local = DateTime.fromMillis(stamp, { zone: context.settings.timeZone }),
    today = local.toISODate(),
    previous = local.minus({ days: 1 }).toISODate();
  const prior = resolveSchedule(person, previous, context);
  if (prior?.intervals.some(([a, b]) => stamp >= a && stamp < b))
    return previous;
  return today;
}
// Pure calculation. Original clock punches are not edited or interpreted at capture time.
export function projectAttendance(person, from, to, punches, context) {
  const zone = context.settings.timeZone,
    rows = new Map();
  for (
    let d = DateTime.fromISO(from);
    d.toISODate() <= to;
    d = d.plus({ days: 1 })
  ) {
    const day = d.toISODate();
    if (
      person.hireDate > day ||
      (person.terminationDate && person.terminationDate < day)
    )
      continue;
    const shift = resolveSchedule(person, day, context);
    const leave = context.absences.find(
      (a) =>
        a.personId === String(person._id) &&
        a.status === "approved" &&
        a.startDate <= day &&
        a.endDate >= day,
    );
    const expected =
      shift?.intervals.reduce((sum, [a, b]) => sum + minutes(a, b), 0) || 0;
    rows.set(day, {
      personId: String(person._id),
      personName: person.name,
      employeeNumber: person.employeeNumber,
      date: day,
      shiftName: shift?.name || "Sin turno",
      expectedMinutes: Math.max(0, expected - (shift?.breakMinutes || 0)),
      workedMinutes: 0,
      normalMinutes: 0,
      outsideMinutes: 0,
      extra50Minutes: 0,
      extra100Minutes: 0,
      lateMinutes: 0,
      earlyMinutes: 0,
      absence: leave?.type || "",
      anomalies: shift?.conflict ? ["Asignación ambigua o incompleta"] : [],
      segments: [],
      punchIds: [],
      policy: { ...context.settings, shift, leave: leave?._id },
      status: "review",
    });
  }
  const { pairs, anomalies } = pairPunches(
    punches,
    context.settings.maxPairHours,
  );
  for (const pair of pairs) {
    const row = rows.get(workday(person, pair.start, context));
    if (!row) continue;
    const shift = row.policy.shift,
      normal = shift?.intervals || [];
    const authorized = context.extensions
      .filter(
        (e) =>
          e.personId === String(person._id) &&
          e.status === "approved" &&
          e.date === row.date,
      )
      .map((e) => interval(e.date, e.start, e.end, zone));
    const boundaries = new Set([pair.start, pair.end]);
    for (const [a, b] of [...normal, ...authorized])
      for (const edge of [a, b])
        if (edge > pair.start && edge < pair.end) boundaries.add(edge);
    for (
      let d = DateTime.fromMillis(pair.start, { zone }).startOf("day");
      d.toMillis() < pair.end;
      d = d.plus({ days: 1 })
    ) {
      for (const edge of [
        d.toMillis(),
        context.settings.saturday100From && d.weekday === 6
          ? DateTime.fromISO(
              `${d.toISODate()}T${context.settings.saturday100From}`,
              { zone },
            ).toMillis()
          : null,
      ])
        if (edge > pair.start && edge < pair.end) boundaries.add(edge);
    }
    const ordered = [...boundaries].sort((a, b) => a - b);
    for (let i = 1; i < ordered.length; i++) {
      const a = ordered[i - 1],
        b = ordered[i],
        mid = (a + b) / 2,
        amount = minutes(a, b);
      const inside = normal.some(([s, e]) => mid >= s && mid < e),
        approved = authorized.some(([s, e]) => mid >= s && mid < e);
      const local = DateTime.fromMillis(mid, { zone });
      const holiday = context.holidays.some(
        (h) =>
          h.active &&
          h.date === local.toISODate() &&
          (!h.location ||
            h.location === (shift?.assignment?.location || person.location)),
      );
      const hundred =
        context.settings.extra100Weekdays.includes(local.weekday) ||
        (context.settings.countHolidayAs100 && holiday) ||
        (local.weekday === 6 &&
          context.settings.saturday100From &&
          local.toFormat("HH:mm") >= context.settings.saturday100From);
      const kind = inside
        ? "normal"
        : approved
          ? hundred
            ? "extra100"
            : "extra50"
          : "outside";
      row.workedMinutes += amount;
      if (inside) row.normalMinutes += amount;
      else {
        row.outsideMinutes += amount;
        if (approved)
          row[`${hundred ? "extra100" : "extra50"}Minutes`] += amount;
      }
      row.segments.push({
        start: new Date(a).toISOString(),
        end: new Date(b).toISOString(),
        kind,
      });
    }
    row.punchIds.push(...pair.ids);
    if (row.absence)
      row.anomalies.push("Fichadas durante una ausencia aprobada");
  }
  for (const anomaly of anomalies) {
    const row = rows.get(
      workday(person, +new Date(anomaly.punch.occurredAt), context),
    );
    if (row) {
      row.anomalies.push(anomaly.code);
      if (anomaly.paired)
        row.punchIds.push(
          String(anomaly.punch._id),
          String(anomaly.paired._id),
        );
    }
  }
  for (const row of rows.values()) {
    const shift = row.policy.shift;
    if (row.segments.length && shift?.intervals.length) {
      const first = +new Date(row.segments[0].start),
        last = +new Date(row.segments.at(-1).end);
      const [start, end] = shift.intervals[0];
      const late = minutes(start, first);
      row.lateMinutes = late > (shift.toleranceMinutes || 0) ? late : 0;
      row.earlyMinutes = minutes(last, end);
      // Unpaid scheduled break reduces computable normal time once per workday.
      row.normalMinutes = Math.max(
        0,
        row.normalMinutes - (shift.breakMinutes || 0),
      );
    }
    if (
      !row.workedMinutes &&
      row.expectedMinutes &&
      !row.absence &&
      !row.anomalies.length &&
      row.date < DateTime.now().setZone(zone).toISODate() &&
      !shift?.holiday
    )
      row.absence = "unjustified";
    if (row.workedMinutes && !shift?.intervals.length)
      row.anomalies.push("Fichadas sin turno aplicable");
    if (row.outsideMinutes > row.extra50Minutes + row.extra100Minutes)
      row.anomalies.push("Horas fuera de turno sin autorización");
    row.anomalies = [...new Set(row.anomalies)];
    for (const field of Object.keys(row).filter((k) => k.endsWith("Minutes")))
      row[field] = Math.round(row[field] * 100) / 100;
  }
  return [...rows.values()];
}
