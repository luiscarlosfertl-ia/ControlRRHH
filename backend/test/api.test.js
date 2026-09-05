import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import crypto from "node:crypto";
import { createApp, initialize, appendPunch } from "../src/app.js";
import { Person, Punch, Review, Account, Terminal } from "../src/models.js";
import { hash } from "../src/security.js";

test("API completa aislada: sesión, catálogos, fichadas, revisión, permisos e idempotencia", async (t) => {
  const dbName = `control_rrhh_test_${crypto.randomBytes(8).toString("hex")}`;
  await mongoose.connect("mongodb://127.0.0.1:27017", { dbName });
  await initialize();
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  async function request(
    path,
    method = "GET",
    body,
    status = 200,
    headers = {},
  ) {
    const response = await fetch(base + "/api" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    assert.equal(response.status, status, JSON.stringify(data));
    if (response.headers.has("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    return data;
  }
  try {
    await t.test(
      "no sesión bloquea datos, primer administrador único y CSRF",
      async () => {
        await request("/resources/people", "GET", undefined, 401);
        await request("/auth/setup", "POST", {
          name: "QA",
          email: "qa@example.test",
          password: "Temporary-testing-42",
        });
        await request(
          "/auth/setup",
          "POST",
          {
            name: "QA2",
            email: "qa2@example.test",
            password: "Temporary-testing-42",
          },
          409,
        );
        await request(
          "/resources/groups",
          "POST",
          { name: "Mal origen" },
          403,
          { Origin: "https://evil.example" },
        );
      },
    );
    const group = await request(
      "/resources/groups",
      "POST",
      { name: "Grupo QA", department: "Aserradero" },
      201,
    );
    const person = await request(
      "/resources/people",
      "POST",
      {
        name: "Persona QA",
        hireDate: "2026-01-01",
        groupId: group._id,
        annualLeaveDays: 14,
      },
      201,
    );
    const shift = await request(
      "/resources/shifts",
      "POST",
      { name: "Mañana", start: "08:00", end: "16:00" },
      201,
    );
    await request(
      "/resources/assignments",
      "POST",
      {
        name: "Asignación QA",
        groupId: group._id,
        shiftId: shift._id,
        startDate: "2026-01-01",
        weekdays: [1, 2, 3, 4, 5, 6, 7],
      },
      201,
    );
    await t.test(
      "legajo autoincremental, email opcional, edición optimista",
      async () => {
        assert.equal(person.employeeNumber, 1);
        assert.equal(person.email, "");
        await request(
          `/resources/people/${person._id}`,
          "PUT",
          { ...person, name: "Persona QA editada", version: 99 },
          409,
        );
        const updated = await request(
          `/resources/people/${person._id}`,
          "PUT",
          { ...person, name: "Persona QA editada" },
        );
        assert.equal(updated.version, 1);
        await request(
          "/resources/people",
          "POST",
          { name: "Inválida", hireDate: "2026-13-01" },
          400,
        );
      },
    );
    await t.test("filtro paginado de valores y lista > 50", async () => {
      await Person.insertMany(
        Array.from({ length: 55 }, (_, i) => ({
          employeeNumber: i + 2,
          name: `Prueba ${String(i).padStart(2, "0")}`,
          hireDate: "2026-01-01",
          active: true,
        })),
      );
      assert.equal(
        (await request("/resources/people?page=1")).items.length,
        50,
      );
      assert.equal((await request("/resources/people?page=2")).items.length, 6);
      const values = await request("/resources/people/values/name?page=1");
      assert.equal(values.values.length, 50);
      assert.equal(values.hasMore, true);
      assert.equal(
        (await request("/resources/people/values/name?search=Prueba%2054"))
          .values[0].value,
        "Prueba 54",
      );
    });
    await t.test(
      "manual, procesamiento, marcador e inmutabilidad de aprobadas",
      async () => {
        const common = { personId: person._id, reason: "Prueba aislada" };
        await request("/attendance/manual", "POST", {
          ...common,
          occurredAt: "2026-08-03T08:00:00-03:00",
          direction: "in",
          requestId: crypto.randomUUID(),
        });
        await request("/attendance/manual", "POST", {
          ...common,
          occurredAt: "2026-08-03T16:00:00-03:00",
          direction: "out",
          requestId: crypto.randomUUID(),
        });
        assert.equal(
          (await request("/resources/punches?pending=true")).total,
          2,
        );
        await request("/attendance/process", "POST", {
          from: "2026-08-03",
          to: "2026-08-03",
        });
        assert.equal(
          (await request("/resources/punches?pending=true")).total,
          0,
        );
        const row = await Review.findOne({
          personId: person._id,
          date: "2026-08-03",
        }).lean();
        assert.equal(row.normalMinutes, 480);
        await request(`/reviews/${row._id}/decision`, "POST", {
          status: "approved",
          notes: "Validado en QA",
        });
        await request("/attendance/process", "POST", {
          from: "2026-08-03",
          to: "2026-08-03",
        });
        assert.equal((await Review.findById(row._id)).status, "approved");
        await request(
          "/attendance/manual",
          "POST",
          {
            ...common,
            occurredAt: "2026-08-03T17:00:00-03:00",
            direction: "out",
            requestId: crypto.randomUUID(),
          },
          409,
        );
      },
    );
    await t.test("licencias, cupo y solapamiento", async () => {
      const a = await request(
        "/resources/absences",
        "POST",
        {
          personId: person._id,
          type: "vacation",
          startDate: "2026-08-10",
          endDate: "2026-08-12",
          reason: "Vacaciones de prueba",
        },
        201,
      );
      assert.equal(a.days, 3);
      await request(`/absences/${a._id}/decision`, "POST", {
        status: "approved",
      });
      const b = await request(
        "/resources/absences",
        "POST",
        {
          personId: person._id,
          type: "vacation",
          startDate: "2026-08-11",
          endDate: "2026-08-14",
          reason: "Solapamiento de prueba",
        },
        201,
      );
      await request(
        `/absences/${b._id}/decision`,
        "POST",
        { status: "approved" },
        409,
      );
    });
    await t.test(
      "terminal sin clave no accede; rotación y privilegios",
      async () => {
        const terminal = await request(
          "/resources/terminals",
          "POST",
          { name: "Terminal QA" },
          201,
        );
        assert.equal(terminal.tokenHash, undefined);
        await request(`/kiosk/${terminal._id}/config`, "GET", undefined, 401);
        const link = await request(
            `/terminals/${terminal._id}/link`,
            "POST",
            {},
          ),
          key = link.path.split("#token=")[1];
        const cfg = await request(
          `/kiosk/${terminal._id}/config`,
          "GET",
          undefined,
          200,
          { "X-Terminal-Key": key },
        );
        assert.equal(cfg.tokenHash, undefined);
        await request(`/terminals/${terminal._id}/link`, "POST", {});
        await request(`/kiosk/${terminal._id}/config`, "GET", undefined, 401, {
          "X-Terminal-Key": key,
        });
        await Account.updateOne(
          { _id: "owner" },
          { $set: { role: "reviewer" } },
        );
        await request(
          "/resources/groups",
          "POST",
          { name: "No autorizado" },
          403,
        );
        await Account.updateOne({ _id: "owner" }, { $set: { role: "admin" } });
      },
    );
    await t.test(
      "dirección facial serializada, duplicados y replay persistente",
      async () => {
        const p = await Person.create({
            employeeNumber: 100,
            name: "Facial QA",
            hireDate: "2026-01-01",
            active: true,
            faceEnabled: true,
            faceCount: 3,
          }),
          terminal = await Terminal.create({
            name: "SDK QA",
            active: true,
            tokenHash: hash("test-only"),
            duplicateSeconds: 30,
          });
        const id = crypto.randomUUID(),
          first = await appendPunch({
            person: p,
            terminal,
            requestId: id,
            similarity: 0.9,
          });
        assert.equal(first.direction, "in");
        assert.equal(
          (
            await appendPunch({
              person: p,
              terminal,
              requestId: id,
              similarity: 0.9,
            })
          ).replay,
          true,
        );
        assert.equal(
          (
            await appendPunch({
              person: p,
              terminal,
              requestId: crypto.randomUUID(),
              similarity: 0.9,
            })
          ).duplicate,
          true,
        );
        await Punch.updateOne(
          { _id: first._id },
          { $set: { occurredAt: new Date(Date.now() - 60000) } },
        );
        assert.equal(
          (
            await appendPunch({
              person: p,
              terminal,
              requestId: crypto.randomUUID(),
              similarity: 0.9,
            })
          ).direction,
          "out",
        );
        assert.equal(
          await Punch.countDocuments({ personId: String(p._id) }),
          2,
        );
      },
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    assert.match(mongoose.connection.name, /^control_rrhh_test_[a-f0-9]{16}$/);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
