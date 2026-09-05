import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import mongoose from "mongoose";
import crypto from "node:crypto";
import { Person, Punch, Audit } from "../src/models.js";

test("contrato FaceVision: 3 capturas cifradas, coincidencia, fichaje y revocación", async () => {
  const sdk = express();
  sdk.use(express.json());
  let searchFailure = false,
    noMatch = false;
  sdk.post("/face-auth/enroll", (_req, res) =>
    res.json({
      status: "ok",
      template: { version: "test-only", embeddings: { near: [1, 0, 0] } },
    }),
  );
  sdk.post("/face-auth/verify", (_req, res) =>
    res.json({ status: "ok", verified: true, similarity: 0.95 }),
  );
  sdk.post("/face-auth/search", (req, res) =>
    res.json({
      status: "ok",
      facesDetected: 1,
      results: searchFailure
        ? []
        : req.body.candidates.map((c, i) => ({
            id: c.id,
            verified: !noMatch && i === 0,
            similarity: !noMatch && i === 0 ? 0.95 : 0.3,
          })),
    }),
  );
  sdk.post("/face-auth/detect", (_req, res) =>
    res.json({
      status: "ok",
      facesDetected: 1,
      faces: [{ x: 0.35, y: 0.3, width: 0.3, height: 0.4 }],
    }),
  );
  const sdkServer = sdk.listen(0, "127.0.0.1");
  await new Promise((resolve) => sdkServer.once("listening", resolve));
  process.env.FACEVISION_URL = `http://127.0.0.1:${sdkServer.address().port}`;
  process.env.BIOMETRIC_KEY = crypto.randomBytes(32).toString("hex");
  const { createApp, initialize } = await import("../src/app.js");
  const dbName = `control_rrhh_test_${crypto.randomBytes(8).toString("hex")}`;
  await mongoose.connect("mongodb://127.0.0.1:27017", { dbName });
  await initialize();
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let cookie = "";
  async function req(path, method = "GET", body, expected = 200, headers = {}) {
    const r = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const d = await r.json();
    assert.equal(r.status, expected, JSON.stringify(d));
    if (r.headers.has("set-cookie"))
      cookie = r.headers.get("set-cookie").split(";")[0];
    return d;
  }
  try {
    await req("/auth/setup", "POST", {
      name: "QA Face",
      email: "face@example.test",
      password: "Temporary-Face-Test-42",
    });
    const person = await req(
        "/resources/people",
        "POST",
        { name: "Persona facial ficticia", hireDate: "2020-01-01" },
        201,
      ),
      payload = {
        captures: { near: "data:image/jpeg;base64,AAAA" },
        authorization: "Autorización ficticia exclusivamente QA",
      };
    await req(`/people/${person._id}/face/test`, "POST", payload, 422);
    for (let n = 1; n <= 3; n++) {
      const result = await req(`/people/${person._id}/face`, "POST", payload);
      assert.equal(result.faceCount, n);
      assert.equal(result.faceEnabled, n === 3);
    }
    const stored = await Person.findById(person._id)
      .select("+faceEncrypted")
      .lean();
    assert.ok(stored.faceEncrypted);
    assert.ok(!stored.faceEncrypted.includes("data:image"));
    const publicPerson = await req(`/resources/people/${person._id}`);
    assert.equal(publicPerson.faceEncrypted, undefined);
    assert.equal((await req(`/people/${person._id}/face`)).captures.length, 3);
    const probe = await req(`/people/${person._id}/face/test`, "POST", payload);
    assert.equal(probe.matched, true);
    assert.equal(probe.personName, person.name);
    assert.equal(probe.similarity, 0.95);
    assert.equal(await Punch.countDocuments(), 0);
    const other = await Person.create({
      employeeNumber: 999,
      name: "Otra persona QA",
      active: true,
      faceCount: 3,
      faceEnabled: true,
      faceEncrypted: stored.faceEncrypted,
    });
    const mismatch = await req(
      `/people/${other._id}/face/test`,
      "POST",
      payload,
    );
    assert.equal(mismatch.matched, false);
    assert.equal(mismatch.personName, "");
    noMatch = true;
    await req(`/people/${person._id}/face/test`, "POST", payload, 422);
    noMatch = false;
    searchFailure = true;
    await req(`/people/${person._id}/face/test`, "POST", payload, 503);
    searchFailure = false;
    assert.equal(await Punch.countDocuments(), 0);
    const terminal = await req(
        "/resources/terminals",
        "POST",
        { name: "Terminal QA Face" },
        201,
      ),
      link = await req(`/terminals/${terminal._id}/link`, "POST", {}),
      headers = { "X-Terminal-Key": link.path.split("#token=")[1] };
    assert.equal(
      (
        await req(
          `/kiosk/${terminal._id}/detect`,
          "POST",
          payload,
          200,
          headers,
        )
      ).detected,
      true,
    );
    const mark = { captures: payload.captures, requestId: crypto.randomUUID() },
      result = await req(
        `/kiosk/${terminal._id}/mark`,
        "POST",
        mark,
        200,
        headers,
      );
    assert.equal(result.direction, "in");
    assert.equal(result.similarity, 0.95);
    assert.equal(result.hasCapture, true);
    assert.equal(result.captureEncrypted, undefined);
    const evidenceStored = await Punch.findById(result._id)
      .select("+captureEncrypted")
      .lean();
    assert.ok(
      evidenceStored.captureEncrypted &&
        !evidenceStored.captureEncrypted.includes("data:image"),
    );
    const evidence = await req(`/punches/${result._id}/capture`);
    assert.equal(evidence.image, payload.captures.near);
    assert.equal(evidence.personName, person.name);
    assert.equal(
      (await req("/resources/punches")).items[0].captureEncrypted,
      undefined,
    );
    assert.equal(
      (await req(`/resources/punches/${result._id}`)).captureEncrypted,
      undefined,
    );
    assert.equal(
      await Audit.countDocuments({
        action: "punch.capture.viewed",
        entityId: String(result._id),
      }),
      1,
    );
    const savedCookie = cookie;
    cookie = "";
    await req(`/punches/${result._id}/capture`, "GET", undefined, 401);
    cookie = savedCookie;
    assert.equal(
      (await req(`/kiosk/${terminal._id}/mark`, "POST", mark, 200, headers))
        .replay,
      true,
    );
    assert.equal(
      (await Punch.findById(result._id).select("+captureEncrypted"))
        .captureEncrypted,
      evidenceStored.captureEncrypted,
    );
    searchFailure = true;
    await req(
      `/kiosk/${terminal._id}/mark`,
      "POST",
      { ...mark, requestId: crypto.randomUUID() },
      503,
      headers,
    );
    assert.equal(await Punch.countDocuments(), 1);
    await req(`/people/${person._id}/face`, "DELETE");
    await req(`/people/${person._id}/face/test`, "POST", payload, 422);
    assert.equal((await Person.findById(person._id)).faceEnabled, false);
    assert.equal((await req(`/people/${person._id}/face`)).captures.length, 0);
  } finally {
    await new Promise((r) => server.close(r));
    await new Promise((r) => sdkServer.close(r));
    assert.match(mongoose.connection.name, /^control_rrhh_test_[a-f0-9]{16}$/);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
