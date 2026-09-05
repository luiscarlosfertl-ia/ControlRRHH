import assert from "node:assert/strict";
import crypto from "node:crypto";

const base = process.env.CONTROL_RRHH_URL || "http://127.0.0.1:3110";
let cookie = "";

async function request(path, method = "GET", body, expected = 200) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));
  assert.equal(response.status, expected, `${path}: ${JSON.stringify(data)}`);
  const session = response.headers.get("set-cookie");
  if (session) cookie = session.split(";", 1)[0];
  return data;
}

for (let attempt = 0; attempt < 60; attempt += 1) {
  try {
    const health = await request("/api/health");
    if (health.ok) break;
  } catch (error) {
    if (attempt === 59) throw error;
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

const health = await request("/api/health");
assert.equal(health.app, "ControlRRHH");
assert.deepEqual(health.features, { faceVision: false });

const suffix = crypto.randomBytes(8).toString("hex");
const setup = await request("/api/auth/setup", "POST", {
  name: "Docker Smoke",
  email: `docker-smoke-${suffix}@example.test`,
  password: `Smoke-${crypto.randomBytes(18).toString("base64url")}`,
});
assert.equal(setup.account.role, "admin");
assert.deepEqual(setup.features, { faceVision: false });

const group = await request(
  "/api/resources/groups",
  "POST",
  {
    name: `Grupo smoke ${suffix}`,
    department: "Prueba Docker",
  },
  201,
);
const today = new Date().toISOString().slice(0, 10);
const person = await request(
  "/api/resources/people",
  "POST",
  {
    name: `Persona smoke ${suffix}`,
    hireDate: today,
    groupId: group._id,
    annualLeaveDays: 0,
  },
  201,
);
await request("/api/attendance/manual", "POST", {
  personId: person._id,
  occurredAt: new Date(Date.now() - 60_000).toISOString(),
  direction: "in",
  reason: "Validación automatizada del contenedor público",
  requestId: crypto.randomUUID(),
});
const punches = await request("/api/resources/punches?pending=true");
assert.equal(punches.total, 1);
await request(`/api/people/${person._id}/face`, "POST", {}, 503);

console.log(
  "OK: edición pública operativa, marcación supervisada y biometría aislada.",
);
