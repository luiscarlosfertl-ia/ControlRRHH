import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { DateTime } from "luxon";
import { z } from "zod";
import {
  Account,
  Session,
  Counter,
  Person,
  Group,
  Shift,
  Pattern,
  Assignment,
  Absence,
  Extension,
  Holiday,
  Terminal,
  Punch,
  Review,
  Settings,
  PresetInstallation,
  resources,
} from "./models.js";
import { schemas, defaults, date } from "./validation.js";
import {
  fail,
  hash,
  passwordHash,
  checkPassword,
  encrypt,
  decrypt,
  locked,
  audit,
} from "./security.js";
import { capture, callFace, presence, identify } from "./facevision.js";
import { presets, applyPreset } from "./presets.js";
import { editSchema, editedValues, snapshotReview } from "./reviewEditing.js";
import { attendanceReport } from "./reports.js";
import {
  nextDirection,
  projectAttendance,
  resolveSchedule,
} from "./attendance.js";

const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (e) {
    next(e);
  }
};
const safe = (doc) => {
  const item = doc.toObject ? doc.toObject() : { ...doc };
  for (const key of [
    "password",
    "faceEncrypted",
    "tokenHash",
    "captureEncrypted",
    "manualHistory",
  ])
    delete item[key];
  return item;
};
const actor = (req) => req.account?._id || "terminal";
const oid = (value) => {
  if (!mongoose.isValidObjectId(value)) fail("Identificador inválido");
  return value;
};
const regex = (value) =>
  new RegExp(
    String(value)
      .slice(0, 120)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    "i",
  );
const readOnly = new Set(["punches", "reviews", "audit"]);
const parsers = {
  page: (v) => Math.max(1, Math.floor(Number(v) || 1)),
  filters: (v) => {
    try {
      const data = JSON.parse(v || "{}");
      return data && typeof data === "object" && !Array.isArray(data)
        ? data
        : {};
    } catch {
      return {};
    }
  },
};
const publicColumns = {
  people: [
    "employeeNumber",
    "name",
    "email",
    "department",
    "location",
    "groupId",
    "active",
    "faceCount",
  ],
  groups: ["name", "department", "location", "active"],
  shifts: [
    "name",
    "start",
    "end",
    "breakMinutes",
    "toleranceMinutes",
    "active",
  ],
  patterns: ["name", "anchorDate", "active"],
  assignments: [
    "name",
    "startDate",
    "endDate",
    "department",
    "location",
    "active",
  ],
  absences: ["personName", "type", "startDate", "endDate", "days", "status"],
  extensions: ["personName", "date", "start", "end", "status"],
  holidays: ["name", "date", "location", "active"],
  terminals: ["name", "location", "active"],
  punches: [
    "employeeNumber",
    "personName",
    "direction",
    "occurredAt",
    "source",
    "similarity",
    "processed",
    "hasCapture",
  ],
  reviews: [
    "personName",
    "date",
    "shiftName",
    "workedMinutes",
    "normalMinutes",
    "outsideMinutes",
    "extra50Minutes",
    "extra100Minutes",
    "status",
    "manuallyEdited",
  ],
  audit: ["actor", "action", "entity", "createdAt"],
};
function queryFor(req, resource) {
  const query = {},
    fields = publicColumns[resource];
  if (req.query.search)
    query.$or = fields
      .filter((k) => resources[resource].schema.path(k)?.instance === "String")
      .map((k) => ({ [k]: regex(req.query.search) }));
  for (const [key, value] of Object.entries(parsers.filters(req.query.filters)))
    if (fields.includes(key) && Array.isArray(value) && value.length <= 50)
      query[key] = { $in: value };
  if (resource === "punches" && req.query.pending === "true")
    query.processed = false;
  if (resource === "reviews" && req.query.month) {
    if (!/^\d{4}-\d{2}$/.test(req.query.month)) fail("Mes inválido");
    query.date = {
      $gte: `${req.query.month}-01`,
      $lte: `${req.query.month}-31`,
    };
  }
  return query;
}
async function context() {
  return {
    settings: await Settings.findById("main").lean(),
    shifts: await Shift.find().lean(),
    patterns: await Pattern.find().lean(),
    assignments: await Assignment.find().lean(),
    absences: await Absence.find({ status: "approved" }).lean(),
    extensions: await Extension.find({ status: "approved" }).lean(),
    holidays: await Holiday.find().lean(),
  };
}
async function references(data) {
  for (const [field, Model] of [
    ["personId", Person],
    ["groupId", Group],
    ["shiftId", Shift],
    ["patternId", Pattern],
  ])
    if (
      data[field] &&
      !(await Model.exists({ _id: data[field], active: { $ne: false } }))
    )
      fail(`Referencia no disponible: ${field}`);
  for (const shiftId of data.sequence || [])
    if (shiftId && !(await Shift.exists({ _id: shiftId, active: true })))
      fail("La secuencia incluye un turno no disponible.");
}
export async function appendPunch({
  person,
  terminal,
  requestId,
  similarity = null,
  occurredAt = new Date(),
  direction,
  source = "facevision",
  reason = "",
  accountId = "",
  captures,
}) {
  return locked(`person:${person._id}`, async () => {
    const existing = await Punch.findOne({
      terminalId: String(terminal._id),
      requestId,
    }).lean();
    if (existing) return { ...safe(existing), replay: true };
    if (
      !(await Person.exists({
        _id: person._id,
        active: true,
        ...(source === "facevision" ? { faceEnabled: true, faceCount: 3 } : {}),
      }))
    )
      fail("Persona no habilitada", 409);
    const last = await Punch.findOne({ personId: String(person._id) })
      .sort({ occurredAt: -1, _id: -1 })
      .lean();
    if (
      source === "facevision" &&
      last &&
      +occurredAt - +last.occurredAt < terminal.duplicateSeconds * 1000
    )
      return { ...safe(last), duplicate: true };
    if (
      source === "facevision" &&
      !(await Terminal.exists({
        _id: terminal._id,
        active: true,
        tokenHash: terminal.tokenHash,
      }))
    )
      fail("Terminal revocada durante la captura", 401);
    const result = await Punch.create({
      personId: String(person._id),
      employeeNumber: person.employeeNumber,
      personName: person.name,
      occurredAt,
      direction: direction || nextDirection(last),
      source,
      terminalId: String(terminal._id),
      requestId,
      similarity,
      hasCapture: source === "facevision" && Boolean(captures),
      ...(source === "facevision" && captures
        ? { captureEncrypted: encrypt({ image: capture({ captures }).near }) }
        : {}),
      reason,
      actor: accountId,
    });
    await audit(
      accountId || `terminal:${terminal._id}`,
      "punch.created",
      "punches",
      result._id,
      { personId: String(person._id), direction: result.direction },
    );
    return safe(result);
  });
}
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "img-src": ["'self'", "data:", "blob:"],
          "connect-src": ["'self'"],
          "script-src": ["'self'"],
          "style-src": ["'self'", "'unsafe-inline'"],
        },
      },
    }),
  );
  app.use(cookieParser(), express.json({ limit: "1mb" }));
  app.use("/api", (_req, res, next) => {
    res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    next();
  });
  app.use("/api", (req, _res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin
    ) {
      let host;
      try {
        host = new URL(req.headers.origin).host;
      } catch {
        return next(
          Object.assign(new Error("Origen inválido"), { status: 403 }),
        );
      }
      if (host !== req.headers.host)
        return next(
          Object.assign(new Error("Origen no autorizado"), { status: 403 }),
        );
    }
    next();
  });
  const loginLimiter = rateLimit({
    windowMs: 60000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  });
  app.get("/api/health", (_req, res) =>
    res.json({ ok: mongoose.connection.readyState === 1, app: "ControlRRHH" }),
  );
  app.get(
    "/api/auth/state",
    wrap(async (req, res) => {
      const session =
        req.cookies.cr_session &&
        (await Session.findOne({
          _id: hash(req.cookies.cr_session),
          expiresAt: { $gt: new Date() },
        }));
      const account =
        session &&
        (await Account.findOne({
          _id: session.accountId,
          active: true,
        }).lean());
      res.json({
        setupRequired: !(await Account.exists({ _id: "owner" })),
        account: account ? safe(account) : null,
      });
    }),
  );
  async function sessionResponse(req, res, account) {
    const token = crypto.randomBytes(32).toString("base64url");
    await Session.create({
      _id: hash(token),
      accountId: account._id,
      expiresAt: new Date(Date.now() + 8 * 3600000),
    });
    res.cookie("cr_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: req.secure,
      maxAge: 8 * 3600000,
      path: "/",
    });
    res.json({ account: safe(account) });
  }
  app.post(
    "/api/auth/setup",
    loginLimiter,
    wrap(async (req, res) => {
      if (
        !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
          req.socket.remoteAddress,
        )
      )
        fail("La configuración inicial se realiza desde el servidor.", 403);
      const b = z
        .object({
          name: z.string().min(2).max(100),
          email: z.string().email(),
          password: z.string().min(12).max(128),
        })
        .parse(req.body);
      if (await Account.exists({ _id: "owner" }))
        fail("La aplicación ya está configurada.", 409);
      const owner = await Account.create({
        _id: "owner",
        name: b.name,
        email: b.email.toLowerCase(),
        password: await passwordHash(b.password),
        role: "admin",
      });
      await audit("owner", "setup.completed", "accounts", "owner");
      await sessionResponse(req, res, owner);
    }),
  );
  app.post(
    "/api/auth/login",
    loginLimiter,
    wrap(async (req, res) => {
      const b = z
        .object({ email: z.string().email(), password: z.string().max(128) })
        .parse(req.body);
      const account = await Account.findOne({
        email: b.email.toLowerCase(),
        active: true,
      }).select("+password");
      if (!account || !(await checkPassword(b.password, account.password)))
        fail("Credenciales inválidas.", 401);
      await sessionResponse(req, res, account);
    }),
  );
  app.post(
    "/api/auth/logout",
    wrap(async (req, res) => {
      if (req.cookies.cr_session)
        await Session.deleteOne({ _id: hash(req.cookies.cr_session) });
      res.clearCookie("cr_session");
      res.json({ ok: true });
    }),
  );
  app.use(
    "/api/kiosk/:id",
    rateLimit({
      windowMs: 60000,
      limit: 180,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
    wrap(async (req, _res, next) => {
      const token = req.get("X-Terminal-Key") || "";
      const terminal = await Terminal.findOne({
        _id: oid(req.params.id),
        active: true,
      })
        .select("+tokenHash")
        .lean();
      if (!terminal || !token || terminal.tokenHash !== hash(token))
        fail("Enlace de terminal inválido o revocado.", 401);
      req.terminal = terminal;
      next();
    }),
  );
  app.get("/api/kiosk/:id/config", (req, res) => res.json(safe(req.terminal)));
  app.post(
    "/api/kiosk/:id/detect",
    wrap(async (req, res) => res.json(await presence(capture(req.body)))),
  );
  app.post(
    "/api/kiosk/:id/mark",
    rateLimit({
      windowMs: 10000,
      limit: 5,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
    wrap(async (req, res) => {
      const requestId = z.string().uuid().parse(req.body.requestId);
      if (req.body.direction !== undefined)
        fail("La dirección se determina por la última fichada.");
      const replay = await Punch.findOne({
        terminalId: req.params.id,
        requestId,
      }).lean();
      if (replay) return res.json({ ...safe(replay), replay: true });
      const captures = capture(req.body);
      const people = await Person.find({
        active: true,
        faceEnabled: true,
        faceCount: 3,
        ...(req.terminal.groupId ? { groupId: req.terminal.groupId } : {}),
      })
        .select("+faceEncrypted")
        .lean();
      const { person, similarity } = await identify(
        captures,
        people,
        req.terminal,
      );
      res.json(
        await appendPunch({
          person,
          similarity,
          terminal: req.terminal,
          requestId,
          captures,
        }),
      );
    }),
  );
  app.use(
    "/api",
    wrap(async (req, _res, next) => {
      const session =
        req.cookies.cr_session &&
        (await Session.findOne({
          _id: hash(req.cookies.cr_session),
          expiresAt: { $gt: new Date() },
        }));
      req.account =
        session &&
        (await Account.findOne({
          _id: session.accountId,
          active: true,
        }).lean());
      if (!req.account) fail("Iniciá sesión para continuar.", 401);
      next();
    }),
  );
  app.use("/api", (req, res, next) => {
    if (
      req.account.role !== "admin" &&
      req.method !== "GET" &&
      !/^\/reviews\/[^/]+\/decision$/.test(req.path)
    )
      return res.status(403).json({ message: "Requiere administración." });
    next();
  });
  app.get(
    "/api/settings",
    wrap(async (_req, res) => res.json(await Settings.findById("main").lean())),
  );
  app.get(
    "/api/reports/:mode/values/:field",
    wrap(async (req, res) => {
      res
        .set("Cache-Control", "no-store")
        .json(
          await attendanceReport(req.params.mode, req.query, req.params.field),
        );
    }),
  );
  app.get(
    "/api/reports/:mode",
    wrap(async (req, res) => {
      res
        .set("Cache-Control", "no-store")
        .json(await attendanceReport(req.params.mode, req.query));
    }),
  );
  app.get(
    "/api/presets",
    wrap(async (_req, res) => {
      const installations = await PresetInstallation.find().lean();
      res.json(
        presets.map((p) => ({
          ...p,
          installation: installations.find((i) => i._id === p.id) || null,
        })),
      );
    }),
  );
  app.post(
    "/api/presets/:key/apply",
    wrap(async (req, res) => {
      res.json(await applyPreset(req.params.key, req.body, actor(req)));
    }),
  );
  app.put(
    "/api/settings",
    wrap(async (req, res) => {
      const b = schemas.settings.parse(req.body);
      await Settings.updateOne({ _id: "main" }, { $set: b });
      await audit(actor(req), "settings.updated", "settings", "main", b);
      res.json(b);
    }),
  );
  app.get(
    "/api/dashboard",
    wrap(async (_req, res) => {
      const config = await Settings.findById("main").lean(),
        day = DateTime.now().setZone(config.timeZone).startOf("day").toJSDate();
      const [people, pending, review, requests, latest] = await Promise.all([
        Person.countDocuments({ active: true }),
        Punch.countDocuments({ processed: false }),
        Review.countDocuments({ status: "review" }),
        Absence.countDocuments({ status: "requested" }),
        Punch.find({ occurredAt: { $gte: day } })
          .sort({ occurredAt: -1 })
          .limit(8)
          .lean(),
      ]);
      const last = await Punch.aggregate([
        { $sort: { occurredAt: -1, _id: -1 } },
        { $group: { _id: "$personId", direction: { $first: "$direction" } } },
        { $match: { direction: "in" } },
        { $count: "count" },
      ]);
      res.json({
        people,
        pending,
        review,
        requests,
        present: last[0]?.count || 0,
        latest,
      });
    }),
  );
  app.get(
    "/api/schedule",
    wrap(async (req, res) => {
      const from = date.parse(req.query.from),
        to = date.parse(req.query.to);
      if (
        to < from ||
        DateTime.fromISO(to).diff(DateTime.fromISO(from), "days").days > 31
      )
        fail("Seleccioná hasta 31 días.");
      const p = parsers.page(req.query.page),
        q = {
          active: true,
          ...(req.query.search ? { name: regex(req.query.search) } : {}),
        },
        total = await Person.countDocuments(q),
        people = await Person.find(q)
          .sort({ employeeNumber: 1 })
          .skip((p - 1) * 50)
          .limit(50)
          .lean(),
        ctx = await context();
      const reviews = await Review.find({
        personId: { $in: people.map((p) => String(p._id)) },
        date: { $gte: from, $lte: to },
      }).lean();
      res.json({
        people: people.map((person) => ({
          ...person,
          days: Array.from(
            {
              length:
                Math.round(
                  DateTime.fromISO(to).diff(DateTime.fromISO(from), "days")
                    .days,
                ) + 1,
            },
            (_, i) => {
              const day = DateTime.fromISO(from).plus({ days: i }).toISODate();
              return {
                date: day,
                schedule: resolveSchedule(person, day, ctx),
                review: reviews.find(
                  (r) => r.personId === String(person._id) && r.date === day,
                ),
                absence: ctx.absences.find(
                  (a) =>
                    a.personId === String(person._id) &&
                    a.startDate <= day &&
                    a.endDate >= day,
                )?.type,
              };
            },
          ),
        })),
        total,
        page: p,
      });
    }),
  );
  app.post(
    "/api/attendance/manual",
    wrap(async (req, res) => {
      const b = z
        .object({
          personId: z.string(),
          occurredAt: z.string().datetime({ offset: true }),
          direction: z.enum(["in", "out"]),
          reason: z.string().min(5).max(500),
          requestId: z.string().uuid(),
        })
        .parse(req.body);
      const person = await Person.findById(oid(b.personId)).lean();
      if (!person) fail("Persona no encontrada", 404);
      if (+new Date(b.occurredAt) > Date.now())
        fail("No se puede fichar en el futuro.");
      const config = await Settings.findById("main").lean(),
        day = DateTime.fromISO(b.occurredAt)
          .setZone(config.timeZone)
          .toISODate();
      if (
        await Review.exists({
          personId: b.personId,
          status: "approved",
          date: {
            $gte: DateTime.fromISO(day).minus({ days: 1 }).toISODate(),
            $lte: day,
          },
        })
      )
        fail("Reabrí la jornada aprobada antes de agregar evidencia.", 409);
      res.json(
        await appendPunch({
          person,
          terminal: { _id: "manual", duplicateSeconds: 0 },
          ...b,
          occurredAt: new Date(b.occurredAt),
          source: "manual",
          accountId: actor(req),
        }),
      );
    }),
  );
  app.post(
    "/api/attendance/process",
    wrap(async (req, res) => {
      const from = date.parse(req.body.from),
        to = date.parse(req.body.to),
        ctx = await context();
      if (
        to < from ||
        DateTime.fromISO(to).diff(DateTime.fromISO(from), "days").days > 31 ||
        to > DateTime.now().setZone(ctx.settings.timeZone).toISODate()
      )
        fail("Procesá hasta 31 días, sin fechas futuras.");
      const people = await Person.find({ hireDate: { $lte: to } }).lean();
      let updated = 0,
        preserved = 0;
      for (const person of people)
        await locked(`person:${person._id}`, async () => {
          const punches = await Punch.find({
            personId: String(person._id),
            occurredAt: {
              $gte: DateTime.fromISO(from, { zone: ctx.settings.timeZone })
                .minus({ days: 2 })
                .toJSDate(),
              $lt: DateTime.fromISO(to, { zone: ctx.settings.timeZone })
                .plus({ days: 3 })
                .toJSDate(),
            },
          }).lean();
          for (const row of projectAttendance(person, from, to, punches, ctx)) {
            const approved = await Review.findOne({
              personId: row.personId,
              date: row.date,
              $or: [{ status: "approved" }, { manuallyEdited: true }],
            }).lean();
            if (approved) {
              preserved++;
              continue;
            }
            const saved = await Review.findOneAndUpdate(
              { personId: row.personId, date: row.date },
              { $set: row, $inc: { version: 1 } },
              { upsert: true, new: true },
            );
            // Save projection first. A retry safely completes the raw-record marker after a crash.
            await Punch.updateMany(
              { _id: { $in: row.punchIds } },
              { $set: { processed: true, processingId: String(saved._id) } },
            );
            updated++;
          }
        });
      await audit(actor(req), "attendance.processed", "reviews", from, {
        from,
        to,
        updated,
        preserved,
      });
      res.json({ updated, preserved });
    }),
  );
  app.get(
    "/api/punches/:id/capture",
    wrap(async (req, res) => {
      const item = await Punch.findById(oid(req.params.id)).select(
        "+captureEncrypted",
      );
      if (!item) fail("Fichada no encontrada", 404);
      if (!item.captureEncrypted)
        fail(
          "Esta fichada no tiene captura guardada. Sólo las nuevas fichadas faciales conservan la imagen.",
          404,
        );
      res.set("Cache-Control", "no-store");
      await audit(actor(req), "punch.capture.viewed", "punches", item._id);
      res.json({
        image: decrypt(item.captureEncrypted).image,
        personName: item.personName,
        employeeNumber: item.employeeNumber,
        occurredAt: item.occurredAt,
        direction: item.direction,
        similarity: item.similarity,
      });
    }),
  );
  app.get(
    "/api/reviews/:id/history",
    wrap(async (req, res) => {
      const item = await Review.findById(oid(req.params.id)).select(
        "+manualHistory",
      );
      if (!item) fail("Jornada no encontrada", 404);
      res.json({ items: item.manualHistory || [] });
    }),
  );
  app.post(
    "/api/reviews/:id/edit",
    wrap(async (req, res) => {
      const data = editSchema.parse(req.body);
      const initial = await Review.findById(oid(req.params.id));
      if (!initial) fail("Jornada no encontrada", 404);
      let result;
      await locked(`person:${initial.personId}`, async () => {
        const item = await Review.findById(initial._id).select(
          "+manualHistory",
        );
        if (item.status !== "review")
          fail("Reabrí la jornada aprobada antes de editarla.", 409);
        if ((item.version || 0) !== data.version)
          fail(
            "La jornada cambió. Cerrá y volvé a abrir antes de editar.",
            409,
          );
        if (item.manualHistory.length >= 100)
          fail("Se alcanzó el límite de 100 ediciones de esta jornada.", 409);
        const after = editedValues(item, data);
        const change = {
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          actor: actor(req),
          actorName: req.account.name,
          reason: data.reason,
          before: snapshotReview(item.toObject()),
          after,
        };
        item.manualHistory.push(change);
        Object.assign(item, after, { manuallyEdited: true });
        await item.save();
        await audit(
          actor(req),
          "review.manual_edit",
          "reviews",
          item._id,
          change,
        );
        result = safe(item);
      });
      res.json(result);
    }),
  );
  app.post(
    "/api/reviews/:id/decision",
    wrap(async (req, res) => {
      const b = z
        .object({
          status: z.enum(["approved", "review"]),
          notes: z.string().max(500).default(""),
        })
        .parse(req.body);
      const item = await Review.findById(oid(req.params.id));
      if (!item) fail("Jornada no encontrada", 404);
      await locked(`person:${item.personId}`, async () => {
        if (
          b.status === "approved" &&
          item.anomalies.length &&
          b.notes.trim().length < 5
        )
          fail("Indicá el motivo de aprobación de las incidencias.");
        item.status = b.status;
        item.notes = b.notes;
        item.reviewedBy = actor(req);
        item.reviewedAt = new Date();
        await item.save();
      });
      await audit(actor(req), `review.${b.status}`, "reviews", item._id, {
        notes: b.notes,
      });
      res.json(safe(item));
    }),
  );
  app.post(
    ["/api/absences/:id/decision", "/api/extensions/:id/decision"],
    (req, _res, next) => {
      req.params.resource = req.path.split("/")[2];
      next();
    },
    wrap(async (req, res) => {
      const status = z
          .enum(["approved", "rejected", "requested"])
          .parse(req.body.status),
        Model = resources[req.params.resource],
        item = await Model.findById(oid(req.params.id));
      if (!item) fail("Solicitud no encontrada", 404);
      await locked(`person:${item.personId}`, async () => {
        if (status === "approved" && req.params.resource === "absences") {
          if (
            await Absence.exists({
              _id: { $ne: item._id },
              personId: item.personId,
              status: "approved",
              startDate: { $lte: item.endDate },
              endDate: { $gte: item.startDate },
            })
          )
            fail("Se superpone con otra ausencia aprobada.", 409);
          if (item.type === "vacation") {
            const person = await Person.findById(item.personId),
              year = item.startDate.slice(0, 4),
              used = await Absence.find({
                _id: { $ne: item._id },
                personId: item.personId,
                type: "vacation",
                status: "approved",
                startDate: { $gte: `${year}-01-01`, $lte: `${year}-12-31` },
              }).lean();
            if (
              used.reduce((sum, x) => sum + x.days, 0) + item.days >
              person.annualLeaveDays
            )
              fail("La solicitud supera el cupo anual configurado.", 409);
          }
        }
        item.status = status;
        item.reviewedBy = actor(req);
        item.reviewedAt = new Date();
        await item.save();
      });
      await audit(
        actor(req),
        `request.${status}`,
        req.params.resource,
        item._id,
      );
      res.json(safe(item));
    }),
  );
  app.post(
    "/api/people/:id/face/test",
    rateLimit({
      windowMs: 60000,
      limit: 20,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
    wrap(async (req, res) => {
      const selected = await Person.findById(oid(req.params.id)).lean();
      if (!selected) fail("Persona no encontrada", 404);
      if (!selected.active || !selected.faceEnabled || selected.faceCount !== 3)
        fail(
          "La prueba requiere una persona activa con tres capturas registradas.",
          422,
        );
      const people = await Person.find({
        active: true,
        faceEnabled: true,
        faceCount: 3,
      })
        .select("+faceEncrypted")
        .lean();
      const { person, similarity } = await identify(capture(req.body), people, {
        matchThreshold: 0.72,
        ambiguityMargin: 0.05,
      });
      const matched = String(person._id) === String(selected._id);
      await audit(actor(req), "face.tested", "people", selected._id, {
        matched,
        similarity,
      });
      // Never call appendPunch here. Probe images are not retained.
      res.json({
        matched,
        similarity,
        threshold: 0.72,
        ambiguityMargin: 0.05,
        personName: matched ? selected.name : "",
        employeeNumber: matched ? selected.employeeNumber : null,
        message: matched
          ? "Rostro reconocido. No se generó ninguna fichada."
          : "El rostro no corresponde a esta persona. No se generó ninguna fichada.",
      });
    }),
  );
  app.post(
    "/api/people/:id/face",
    wrap(async (req, res) => {
      const person = await Person.findById(oid(req.params.id)).select(
        "+faceEncrypted",
      );
      if (!person) fail("Persona no encontrada", 404);
      const authorization = z
          .string()
          .trim()
          .min(5)
          .max(300)
          .parse(req.body.authorization),
        captures = capture(req.body);
      const template = (await callFace("enroll", { captures })).template;
      if (!template) fail("FaceVision no generó plantilla", 503);
      await locked("face-enrollment", () =>
        locked(`person:${person._id}`, async () => {
          const current = await Person.findById(person._id).select(
              "+faceEncrypted",
            ),
            entries = current.faceEncrypted
              ? decrypt(current.faceEncrypted)
              : [];
          if (entries.length >= 3)
            fail(
              "El catálogo ya tiene tres capturas. Revocá antes de reemplazarlo.",
              409,
            );
          if (entries.length) {
            const verification = await callFace("verify", {
              captures,
              templates: entries.map((e) => e.template),
              threshold: 0.72,
            });
            if (
              !verification.verified ||
              !Number.isFinite(verification.similarity) ||
              verification.similarity < 0.72
            )
              fail(
                "La captura no coincide con el rostro ya registrado para esta persona.",
                422,
              );
          }
          const others = await Person.find({
            _id: { $ne: person._id },
            active: true,
            faceEnabled: true,
            faceCount: 3,
          })
            .select("+faceEncrypted")
            .lean();
          if (others.length) {
            const result = await callFace("search", {
              captures,
              threshold: 0.72,
              candidates: others.map((p) => ({
                id: String(p._id),
                templates: decrypt(p.faceEncrypted).map((x) => x.template),
              })),
            });
            if (
              result.facesDetected !== 1 ||
              result.results?.length !== others.length ||
              result.results.some(
                (r) => r.error || !Number.isFinite(r.similarity),
              )
            )
              fail("No se pudo comprobar duplicación de rostros.", 503);
            if (result.results.some((r) => r.verified && r.similarity >= 0.72))
              fail("Este rostro ya está registrado en otra persona.", 409);
          }
          entries.push({
            template,
            image: captures.near,
            createdAt: new Date().toISOString(),
          });
          current.faceEncrypted = encrypt(entries);
          current.faceCount = entries.length;
          current.faceEnabled = entries.length === 3;
          current.faceAuthorization = authorization;
          await current.save();
          res.json({
            faceCount: entries.length,
            faceEnabled: current.faceEnabled,
          });
        }),
      );
      await audit(actor(req), "face.enrolled", "people", person._id);
    }),
  );
  app.get(
    "/api/people/:id/face",
    wrap(async (req, res) => {
      if (req.account.role !== "admin")
        fail("El catálogo biométrico requiere administración.", 403);
      const p = await Person.findById(oid(req.params.id)).select(
        "+faceEncrypted",
      );
      if (!p) fail("Persona no encontrada", 404);
      await audit(actor(req), "face.catalog.viewed", "people", p._id);
      res.json({
        captures: p.faceEncrypted
          ? decrypt(p.faceEncrypted).map((x) => ({
              image: x.image,
              createdAt: x.createdAt,
            }))
          : [],
      });
    }),
  );
  app.delete(
    "/api/people/:id/face",
    wrap(async (req, res) => {
      await locked(`person:${oid(req.params.id)}`, () =>
        Person.updateOne(
          { _id: req.params.id },
          {
            $set: { faceEnabled: false, faceCount: 0, faceAuthorization: "" },
            $unset: { faceEncrypted: 1 },
          },
        ),
      );
      await audit(actor(req), "face.revoked", "people", req.params.id);
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/terminals/:id/link",
    wrap(async (req, res) => {
      const token = crypto.randomBytes(32).toString("base64url"),
        item = await Terminal.findOneAndUpdate(
          { _id: oid(req.params.id), active: true },
          { $set: { tokenHash: hash(token) } },
        );
      if (!item) fail("Terminal no disponible", 404);
      await audit(actor(req), "terminal.key.rotated", "terminals", item._id);
      res.json({ path: `/kiosk/${item._id}#token=${token}` });
    }),
  );
  app.get(
    "/api/resources/:resource/values/:field",
    wrap(async (req, res) => {
      const { resource, field } = req.params;
      if (!publicColumns[resource]?.includes(field))
        fail("Columna no disponible");
      const query = queryFor(
          { ...req, query: { ...req.query, search: "" } },
          resource,
        ),
        page = parsers.page(req.query.page);
      const values = await resources[resource].aggregate([
        { $match: query },
        { $group: { _id: `$${field}` } },
        {
          $project: {
            _id: 0,
            value: "$_id",
            label: {
              $convert: {
                input: "$_id",
                to: "string",
                onNull: "",
                onError: "",
              },
            },
          },
        },
        ...(req.query.search
          ? [{ $match: { label: regex(req.query.search) } }]
          : []),
        { $sort: { label: 1 } },
        { $skip: (page - 1) * 50 },
        { $limit: 51 },
      ]);
      res.json({ values: values.slice(0, 50), hasMore: values.length > 50 });
    }),
  );
  app.get(
    "/api/resources/:resource",
    wrap(async (req, res) => {
      const r = req.params.resource,
        Model = resources[r];
      if (!Model) fail("Recurso no disponible", 404);
      const query = queryFor(req, r),
        page = parsers.page(req.query.page),
        sort = publicColumns[r].includes(req.query.sort)
          ? req.query.sort
          : r === "people"
            ? "employeeNumber"
            : "createdAt",
        direction = req.query.direction === "asc" ? 1 : -1;
      const [items, total] = await Promise.all([
        Model.find(query)
          .sort({ [sort]: direction, _id: 1 })
          .skip((page - 1) * 50)
          .limit(50)
          .lean(),
        Model.countDocuments(query),
      ]);
      res.json({
        items: items.map(safe),
        total,
        page,
        pages: Math.max(1, Math.ceil(total / 50)),
      });
    }),
  );
  app.get(
    "/api/resources/:resource/:id",
    wrap(async (req, res) => {
      const Model = resources[req.params.resource];
      if (!Model) fail("Recurso no disponible", 404);
      const item = await Model.findById(oid(req.params.id)).lean();
      if (!item) fail("Registro no encontrado", 404);
      res.json(safe(item));
    }),
  );
  app.post(
    "/api/resources/:resource",
    wrap(async (req, res) => {
      const r = req.params.resource;
      if (!schemas[r] || readOnly.has(r)) fail("Operación no disponible", 403);
      const b = schemas[r].parse(req.body);
      await references(b);
      if (r === "people")
        b.employeeNumber = (
          await Counter.findOneAndUpdate(
            { _id: "employee" },
            { $inc: { value: 1 } },
            { new: true, upsert: true },
          )
        ).value;
      if (r === "absences" || r === "extensions") {
        const person = await Person.findById(b.personId);
        b.personName = person.name;
        b.status = "requested";
      }
      if (r === "absences") {
        if (b.startDate.slice(0, 4) !== b.endDate.slice(0, 4))
          fail("Dividí la solicitud por año calendario.");
        const ctx = await context(),
          person = await Person.findById(b.personId).lean();
        b.days = 0;
        for (
          let d = DateTime.fromISO(b.startDate);
          d.toISODate() <= b.endDate;
          d = d.plus({ days: 1 })
        ) {
          const shift = resolveSchedule(person, d.toISODate(), ctx);
          if (
            ctx.settings.leaveCountMode === "calendar" ||
            (shift?.intervals.length && !shift.holiday)
          )
            b.days++;
        }
        if (!b.days) fail("La solicitud no incluye días computables.");
      }
      if (r === "terminals") b.tokenHash = hash(crypto.randomBytes(32));
      const item = await resources[r].create(b);
      await audit(actor(req), "resource.created", r, item._id);
      res.status(201).json(safe(item));
    }),
  );
  app.put(
    "/api/resources/:resource/:id",
    wrap(async (req, res) => {
      const r = req.params.resource;
      if (
        !schemas[r] ||
        readOnly.has(r) ||
        ["absences", "extensions"].includes(r)
      )
        fail("Creá una nueva solicitud; se conserva la original.", 403);
      const b = schemas[r].parse(req.body);
      await references(b);
      const item = await resources[r].findOneAndUpdate(
        {
          _id: oid(req.params.id),
          version: z.number().int().nonnegative().parse(req.body.version),
        },
        { $set: b, $inc: { version: 1 } },
        { new: true, runValidators: true },
      );
      if (!item) fail("El registro cambió. Actualizá antes de guardar.", 409);
      await audit(actor(req), "resource.updated", r, item._id);
      res.json(safe(item));
    }),
  );
  app.use("/api", (_req, res) =>
    res.status(404).json({ message: "Ruta no disponible" }),
  );
  app.use((error, _req, res, _next) => {
    const status =
      error instanceof z.ZodError
        ? 400
        : error.code === 11000
          ? 409
          : error.status || 500;
    res.status(status).json({
      message:
        error instanceof z.ZodError
          ? error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join(" · ")
          : status === 500
            ? "Error interno. Reintentá o revisá el registro del servidor."
            : error.message,
    });
    if (status === 500) console.error(error.name, error.message);
  });
  return app;
}
export async function initialize() {
  for (const Model of [
    Account,
    Session,
    Counter,
    PresetInstallation,
    ...Object.values(resources),
    Settings,
  ])
    await Model.init();
  await Settings.updateOne(
    { _id: "main" },
    { $setOnInsert: defaults },
    { upsert: true },
  );
}
