import mongoose from "mongoose";
import express from "express";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { createApp, initialize } from "./app.js";
import { root, validateBiometricKey } from "./security.js";
import { mongoConnection } from "./runtimeConfig.js";
if (fs.existsSync(path.join(root, ".env")))
  process.loadEnvFile(path.join(root, ".env"));
const dbName = process.env.MONGO_DB || "control_rrhh";
if (!/^control_rrhh(?:_[a-z0-9_]+)?$/.test(dbName))
  throw new Error("La base debe ser exclusiva de ControlRRHH.");
if (process.env.NODE_ENV === "production") validateBiometricKey();
await mongoose.connect(mongoConnection(), {
  dbName,
});
await initialize();
const app = createApp(),
  dist = path.join(root, "frontend/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("/{*splat}", (_req, res) =>
    res.sendFile(path.join(dist, "index.html")),
  );
}
const bindHost = process.env.HTTP_HOST || "127.0.0.1";
app.listen(Number(process.env.PORT || 3100), bindHost, () =>
  console.log(
    `ControlRRHH http://${bindHost}:${process.env.PORT || 3100} · base ${dbName}`,
  ),
);
if (process.env.TLS_CERT && process.env.TLS_KEY)
  https
    .createServer(
      {
        cert: fs.readFileSync(process.env.TLS_CERT),
        key: fs.readFileSync(process.env.TLS_KEY),
        minVersion: "TLSv1.2",
      },
      app,
    )
    .listen(
      Number(process.env.HTTPS_PORT || 3444),
      process.env.LAN_HOST || "0.0.0.0",
      () => console.log("ControlRRHH HTTPS LAN activo"),
    );
