import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Guard, Audit } from "./models.js";
const scrypt = promisify(crypto.scrypt);
export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export const hash = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");
export const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
export async function passwordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${(await scrypt(password, salt, 64)).toString("hex")}`;
}
export async function checkPassword(password, stored) {
  const [salt, expected] = stored.split(":");
  const actual = await scrypt(password, salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(expected, "hex"));
}
let encryptionKey;
export function validateBiometricKey() {
  key();
}
function key() {
  if (encryptionKey) return encryptionKey;
  const configured = process.env.BIOMETRIC_KEY_FILE
    ? fs.readFileSync(process.env.BIOMETRIC_KEY_FILE)
    : process.env.BIOMETRIC_KEY;
  if (configured) {
    if (Buffer.isBuffer(configured) && configured.length === 32)
      encryptionKey = configured;
    else {
      const hex = String(configured).trim();
      if (!/^[a-f\d]{64}$/i.test(hex)) fail("BIOMETRIC_KEY inválida.", 503);
      encryptionKey = Buffer.from(hex, "hex");
    }
    return encryptionKey;
  }
  if (process.env.NODE_ENV === "production")
    fail("Configure BIOMETRIC_KEY o BIOMETRIC_KEY_FILE para producción.", 503);
  const dir = path.join(root, ".local");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "biometric.key");
  if (!fs.existsSync(file))
    fs.writeFileSync(file, crypto.randomBytes(32), { mode: 0o600, flag: "wx" });
  return (encryptionKey = fs.readFileSync(file));
}
export function encrypt(data) {
  const iv = crypto.randomBytes(12),
    cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  return Buffer.concat([
    iv,
    cipher.update(JSON.stringify(data)),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
}
export function decrypt(text) {
  const raw = Buffer.from(text, "base64"),
    decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key(),
      raw.subarray(0, 12),
    );
  decipher.setAuthTag(raw.subarray(-16));
  return JSON.parse(
    Buffer.concat([
      decipher.update(raw.subarray(12, -16)),
      decipher.final(),
    ]).toString(),
  );
}
export async function locked(id, task) {
  const owner = crypto.randomUUID();
  try {
    await Guard.updateOne(
      { _id: id, until: { $lte: new Date() } },
      { $set: { owner, until: new Date(Date.now() + 60000) } },
      { upsert: true },
    );
  } catch (e) {
    if (e.code === 11000)
      fail("Operación en curso. Reintentá en unos segundos.", 409);
    throw e;
  }
  try {
    return await task();
  } finally {
    await Guard.updateOne({ _id: id, owner }, { $set: { until: new Date(0) } });
  }
}
export const audit = (actor, action, entity, entityId, detail = {}) =>
  Audit.create({ actor, action, entity, entityId: String(entityId), detail });
