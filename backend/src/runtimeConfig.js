import fs from "node:fs";

export function faceVisionEnabled(env = process.env) {
  const value = env.FACEVISION_ENABLED;
  if (value === undefined || value === "") return true;
  if (["1", "true", "yes", "on"].includes(String(value).toLowerCase()))
    return true;
  if (["0", "false", "no", "off"].includes(String(value).toLowerCase()))
    return false;
  throw new Error("FACEVISION_ENABLED debe ser true o false");
}

export function initialSetupAllowed(remoteAddress, env = process.env) {
  const address = String(remoteAddress || "").replace(/^::ffff:/, "");
  if (["127.0.0.1", "::1"].includes(address)) return true;
  if (env.INITIAL_SETUP_TRUST_CONTAINER_NETWORK !== "true") return false;
  return (
    /^10\./.test(address) ||
    /^192\.168\./.test(address) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address)
  );
}

export function mongoConnection(env = process.env) {
  if (!env.MONGO_PASSWORD_FILE)
    return env.MONGO_URI || "mongodb://127.0.0.1:27017";
  const password = fs.readFileSync(env.MONGO_PASSWORD_FILE, "utf8").trim();
  if (!password || !env.MONGO_USER)
    throw new Error("Credenciales Mongo incompletas");
  const host = env.MONGO_HOST || "mongo",
    port = env.MONGO_PORT || "27017",
    db = env.MONGO_DB || "control_rrhh";
  if (!/^[a-zA-Z0-9.-]+$/.test(host) || !/^\d+$/.test(port))
    throw new Error("Destino Mongo inválido");
  return `mongodb://${encodeURIComponent(env.MONGO_USER)}:${encodeURIComponent(password)}@${host}:${port}/${db}?authSource=${encodeURIComponent(db)}`;
}
