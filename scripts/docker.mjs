import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  dir = path.join(root, ".deploy");
const args = process.argv.slice(2),
  command = args[0],
  flag = (name) => args.includes(name),
  value = (name) => args[args.indexOf(name) + 1];
const configPath = path.join(dir, "compose.env"),
  sourcePath = path.join(dir, "source.json");
function run(binary, argv, env = {}) {
  const result = spawnSync(binary, argv, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...env },
    windowsHide: true,
  });
  if (result.error)
    throw new Error(
      `No se pudo ejecutar ${binary}. Verificá su instalación y PATH.`,
    );
  if (result.status !== 0)
    throw new Error(
      `${binary} terminó con error (${result.status}). No se continúa.`,
    );
}
function fresh(file, data, mode = 0o444) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, data, { flag: "wx", mode });
}
function config() {
  if (!fs.existsSync(configPath)) throw new Error("Ejecutá prepare primero.");
  return fs.readFileSync(configPath, "utf8");
}
function version() {
  return config()
    .match(/^APP_VERSION=(.+)$/m)?.[1]
    .trim();
}
function checkVersion(v) {
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$/.test(v || ""))
    throw new Error("Versión requerida, por ejemplo 0.1.0 o 0.1.1-rc1.");
  return v;
}
function setVersion(v) {
  fs.writeFileSync(
    configPath,
    config().replace(/^APP_VERSION=.+$/m, `APP_VERSION=${checkVersion(v)}`),
  );
}
function compose(argv, env = {}, options = {}) {
  config();
  run(
    "docker",
    [
      "compose",
      "--env-file",
      configPath,
      "-f",
      "compose.yaml",
      ...(flag("--registry") ? ["-f", "compose.registry.yaml"] : []),
      ...(flag("--lan") ? ["-f", "compose.lan.yaml"] : []),
      ...argv,
    ],
    env,
  );
}
function prepare() {
  for (const folder of [
    "",
    "facevision",
    "secrets",
    "backups",
    "tls",
  ])
    fs.mkdirSync(path.join(dir, folder), { recursive: true, mode: 0o700 });
  const previous = fs.existsSync(sourcePath)
    ? JSON.parse(fs.readFileSync(sourcePath, "utf8"))
    : {};
  const sdk = flag("--sdk") ? path.resolve(value("--sdk")) : previous.sdk;
  const python = flag("--python")
    ? value("--python")
    : previous.python || "python";
  if (sdk) {
    run(python, [
      "deploy/facevision/export_profile.py",
      sdk,
      path.join(root, "deploy/facevision"),
    ]);
    fs.writeFileSync(sourcePath, JSON.stringify({ sdk, python }, null, 2));
  }
  fresh(
    configPath,
    "APP_VERSION=0.1.3\nHTTP_PORT=3110\nHTTPS_PORT=3445\nLAN_BIND=0.0.0.0\n",
    0o600,
  );
  for (const name of ["biometric.key", "mongo-root.txt", "mongo-app.txt"])
    fresh(
      path.join(dir, "secrets", name),
      crypto.randomBytes(32).toString("hex"),
    );
  const password = fs
    .readFileSync(path.join(dir, "secrets/mongo-root.txt"), "utf8")
    .trim();
  fresh(
    path.join(dir, "secrets/mongo-tools.yml"),
    `uri: "mongodb://admin@localhost:27017/?authSource=admin"\npassword: ${JSON.stringify(password)}\n`,
  );
  console.log(
    "Preparado. Secretos existentes conservados. Revisá .deploy y docs/docker.md antes de iniciar.",
  );
}
try {
  if (command === "prepare") prepare();
  else if (command === "build") {
    const tag = checkVersion(args[1]);
    prepare();
    const image = `controlrrhh-app:${tag}`;
    const exists = spawnSync("docker", ["image", "inspect", image], {
      stdio: "ignore",
      windowsHide: true,
    });
    if (exists.status === 0)
      throw new Error(
        "Esa versión de la app ya existe. Usá otra etiqueta para conservar rollback.",
      );
    compose(["config", "--quiet"], { APP_VERSION: tag });
    compose(["build", "--pull", "app", "facevision"], { APP_VERSION: tag });
    setVersion(tag);
    console.log(`App ${tag} construida. start inicia la edición pública.`);
  } else if (command === "build-facevision") {
    const tag = checkVersion(args[1]);
    prepare();
    const image = `controlrrhh-facevision:${tag}`;
    const exists = spawnSync("docker", ["image", "inspect", image], {
      stdio: "ignore",
      windowsHide: true,
    });
    if (exists.status === 0)
      throw new Error(
        "Esa versión de FaceVision ya existe. Usá otra etiqueta para conservar rollback.",
      );
    compose(["config", "--quiet"], { APP_VERSION: tag });
    compose(
      ["build", "--pull", "facevision"],
      { APP_VERSION: tag },
      {},
    );
    setVersion(tag);
    console.log(
      `FaceVision ${tag} construido. La imagen incluye el runtime y los modelos públicos autorizados.`,
    );
  } else if (command === "start") {
    compose(["up", "-d", "--no-build", "--wait", "--wait-timeout", "300"]);
    console.log(
      flag("--lan")
        ? "Abierto por HTTPS en el puerto configurado; usar certificado confiable."
        : "Abrí http://localhost:3110 (o HTTP_PORT configurado). Creá el primer administrador.",
    );
  } else if (command === "pull") {
    if (!flag("--registry"))
      throw new Error("pull requiere --registry para usar la imagen GHCR.");
    const tag = checkVersion(args[1]);
    compose(["pull", "app", "facevision"], { APP_VERSION: tag });
    setVersion(tag);
    console.log(
      `Aplicación y FaceVision ${tag} descargados y seleccionados. Ejecutá start --registry${flag("--lan") ? " --lan" : ""}.`,
    );
  } else if (command === "select") {
    const tag = checkVersion(args[1]);
    const images = [
      `controlrrhh-app:${tag}`,
      `controlrrhh-facevision:${tag}`,
    ];
    for (const image of images)
      run("docker", ["image", "inspect", "--format", "{{.Id}}", image]);
    setVersion(tag);
    console.log(
      `Seleccionada ${tag}. Ejecutá start${flag("--lan") ? " --lan" : ""}. No restaura datos.`,
    );
  } else if (command === "backup") {
    const filename = `control_rrhh-${new Date().toISOString().replace(/[:.]/g, "-")}.archive.gz`;
    const state = spawnSync(
      "docker",
      [
        "compose",
        "--env-file",
        configPath,
        "-f",
        "compose.yaml",
        "ps",
        "--status",
        "running",
        "-q",
        "app",
      ],
      { cwd: root, encoding: "utf8", windowsHide: true },
    );
    if (state.status !== 0)
      throw new Error("No se pudo verificar el estado previo del servicio.");
    const running = Boolean(state.stdout.trim());
    compose(["stop", "app"]);
    try {
      compose([
        "exec",
        "-T",
        "mongo",
        "mongodump",
        "--config=/run/secrets/mongo_tools",
        "--db=control_rrhh",
        `--archive=/backups/${filename}`,
        "--gzip",
      ]);
    } finally {
      if (running) compose(["start", "app"]);
    }
    console.log(
      `Backup: .deploy/backups/${filename}. Respaldá claves por separado; sin ellas no se recupera biometría.`,
    );
  } else if (command === "save") {
    const tag = checkVersion(version()),
      folder = path.join(root, "releases");
    fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
    const target = path.join(folder, `controlrrhh-${tag}.tar`);
    if (fs.existsSync(target))
      throw new Error("El archivo de versión ya existe; no se sobrescribe.");
    const images = [
      `controlrrhh-app:${tag}`,
      `controlrrhh-facevision:${tag}`,
      "mongo:8.0",
    ];
    run("docker", ["image", "save", "--output", target, ...images]);
    console.log(
      "Imágenes exportadas. No contienen la base, las claves ni certificados. Ver guía de traslado.",
    );
  } else if (command === "status") compose(["ps"]);
  else if (command === "stop") compose(["stop"]);
  else if (command === "logs") compose(["logs", "--tail", "100"]);
  else
    throw new Error(
      "Uso: node scripts/docker.mjs prepare|build VERSION|build-facevision VERSION|pull VERSION --registry|start|select VERSION|backup|save|status|stop|logs [--registry] [--lan]",
    );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
