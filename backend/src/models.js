import mongoose from "mongoose";
const { Schema } = mongoose;
const opts = {
  timestamps: true,
  versionKey: "version",
  optimisticConcurrency: true,
};
const create = (name, fields, indexes = []) => {
  const schema = new Schema(fields, opts);
  indexes.forEach(([keys, options]) => schema.index(keys, options));
  return mongoose.model(name, schema);
};
export const Account = create(
  "Account",
  {
    _id: String,
    email: String,
    name: String,
    password: { type: String, select: false },
    role: { type: String, enum: ["admin", "reviewer"], default: "admin" },
    active: { type: Boolean, default: true },
  },
  [[{ email: 1 }, { unique: true }]],
);
export const Session = create(
  "Session",
  { _id: String, accountId: String, expiresAt: Date },
  [[{ expiresAt: 1 }, { expireAfterSeconds: 0 }]],
);
export const Counter = create("Counter", { _id: String, value: Number });
export const Person = create(
  "Person",
  {
    employeeNumber: { type: Number, required: true },
    name: { type: String, required: true },
    email: String,
    document: String,
    department: String,
    location: String,
    groupId: String,
    active: { type: Boolean, default: true },
    hireDate: String,
    terminationDate: String,
    annualLeaveDays: { type: Number, default: 0 },
    faceEnabled: { type: Boolean, default: false },
    faceCount: { type: Number, default: 0 },
    faceAuthorization: String,
    faceEncrypted: { type: String, select: false },
  },
  [[{ employeeNumber: 1 }, { unique: true }], [{ groupId: 1, active: 1 }]],
);
export const Group = create("Group", {
  name: { type: String, required: true },
  department: String,
  location: String,
  color: String,
  active: { type: Boolean, default: true },
});
export const Shift = create("Shift", {
  name: String,
  start: String,
  end: String,
  breakMinutes: Number,
  toleranceMinutes: Number,
  color: String,
  active: { type: Boolean, default: true },
});
export const Pattern = create("Pattern", {
  name: String,
  anchorDate: String,
  sequence: [String],
  active: { type: Boolean, default: true },
});
export const Assignment = create(
  "Assignment",
  {
    name: String,
    personId: String,
    groupId: String,
    shiftId: String,
    patternId: String,
    startDate: String,
    endDate: String,
    weekdays: [Number],
    department: String,
    location: String,
    active: { type: Boolean, default: true },
  },
  [
    [{ personId: 1, startDate: 1 }, {}],
    [{ groupId: 1, startDate: 1 }, {}],
  ],
);
export const Absence = create("Absence", {
  personId: String,
  personName: String,
  type: String,
  startDate: String,
  endDate: String,
  days: Number,
  reason: String,
  status: { type: String, default: "requested" },
  reviewedBy: String,
  reviewedAt: Date,
});
export const Extension = create("Extension", {
  personId: String,
  personName: String,
  date: String,
  start: String,
  end: String,
  reason: String,
  status: { type: String, default: "requested" },
  reviewedBy: String,
  reviewedAt: Date,
});
export const Holiday = create("Holiday", {
  name: String,
  date: String,
  location: String,
  active: { type: Boolean, default: true },
});
export const Terminal = create("Terminal", {
  name: String,
  location: String,
  active: { type: Boolean, default: true },
  tokenHash: { type: String, select: false },
  groupId: String,
  duplicateSeconds: { type: Number, default: 30 },
  detectionDelayMs: { type: Number, default: 1000 },
  countdownMs: { type: Number, default: 500 },
  resultMs: { type: Number, default: 2500 },
  matchThreshold: { type: Number, default: 0.72 },
  ambiguityMargin: { type: Number, default: 0.05 },
});
export const Punch = create(
  "Punch",
  {
    personId: String,
    employeeNumber: Number,
    personName: String,
    occurredAt: Date,
    direction: { type: String, enum: ["in", "out"] },
    source: String,
    terminalId: String,
    requestId: String,
    similarity: Number,
    captureEncrypted: { type: String, select: false },
    hasCapture: { type: Boolean, default: false },
    reason: String,
    actor: String,
    processed: { type: Boolean, default: false },
    processingId: String,
  },
  [
    [{ terminalId: 1, requestId: 1 }, { unique: true }],
    [{ personId: 1, occurredAt: 1 }, {}],
    [{ processed: 1, occurredAt: 1 }, {}],
  ],
);
export const Review = create(
  "Review",
  {
    personId: String,
    personName: String,
    employeeNumber: Number,
    date: String,
    status: { type: String, default: "review" },
    shiftName: String,
    expectedMinutes: Number,
    workedMinutes: Number,
    normalMinutes: Number,
    outsideMinutes: Number,
    extra50Minutes: Number,
    extra100Minutes: Number,
    lateMinutes: Number,
    earlyMinutes: Number,
    absence: String,
    anomalies: [String],
    segments: [Schema.Types.Mixed],
    punchIds: [String],
    policy: Schema.Types.Mixed,
    reviewedBy: String,
    reviewedAt: Date,
    notes: String,
    manuallyEdited: { type: Boolean, default: false },
    manualHistory: { type: [Schema.Types.Mixed], select: false, default: [] },
    unpaidBreakMinutes: Number,
  },
  [
    [{ personId: 1, date: 1 }, { unique: true }],
    [{ date: 1, employeeNumber: 1 }, {}],
  ],
);
export const Audit = create(
  "Audit",
  {
    actor: String,
    action: String,
    entity: String,
    entityId: String,
    detail: Schema.Types.Mixed,
  },
  [[{ createdAt: -1 }, {}]],
);
export const Guard = create("Guard", {
  _id: String,
  owner: String,
  until: Date,
});
export const Settings = create("Settings", {
  _id: String,
  companyName: String,
  timeZone: String,
  extra100Weekdays: [Number],
  weekendStart: String,
  saturday100From: String,
  maxPairHours: Number,
  countHolidayAs100: Boolean,
  leaveCountMode: String,
});
export const PresetInstallation = create("PresetInstallation", {
  _id: String,
  startDate: String,
  includeDemoPeople: Boolean,
  status: String,
  counts: Schema.Types.Mixed,
});
export const resources = {
  people: Person,
  groups: Group,
  shifts: Shift,
  patterns: Pattern,
  assignments: Assignment,
  absences: Absence,
  extensions: Extension,
  holidays: Holiday,
  terminals: Terminal,
  punches: Punch,
  reviews: Review,
  audit: Audit,
};
