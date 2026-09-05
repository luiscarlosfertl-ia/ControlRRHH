import fs from "node:fs";
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
