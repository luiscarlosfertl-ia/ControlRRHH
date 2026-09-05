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
const models = [
  "det_10g.onnx",
  "w600k_r50.onnx",
  "1k3d68.onnx",
  "2d106det.onnx",
  "genderage.onnx",
];
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
function compose(argv, env = {}) {
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
function requireModels() {
  for (const name of models)
    if (!fs.existsSync(path.join(dir, "models/buffalo_l", name)))
      throw new Error(
        "Faltan modelos autorizados. Ejecutá prepare con --models y --model-rights-confirmed.",
      );
}
function prepare() {
  for (const folder of [
    "",
    "facevision",
    "secrets",
    "backups",
    "tls",
    "models/buffalo_l",
  ])
    fs.mkdirSync(path.join(dir, folder), { recursive: true, mode: 0o700 });
  // Docker's non-root FaceVision user needs to read the mounted directory.
  // The parent .deploy stays private on the host.
  fs.chmodSync(path.join(dir, "models/buffalo_l"), 0o755);
  const previous = fs.existsSync(sourcePath)
    ? JSON.parse(fs.readFileSync(sourcePath, "utf8"))
    : {};
  const sdk = flag("--sdk") ? path.resolve(value("--sdk")) : previous.sdk;
  const python = flag("--python")
    ? value("--python")
    : previous.python || "python";
  if (!sdk) throw new Error("Indicá --sdk con la carpeta sdk-faceVision.");
  run(python, [
    "deploy/facevision/export_profile.py",
    sdk,
    path.join(dir, "facevision"),
  ]);
  for (const name of ["Dockerfile", "requirements.txt", ".dockerignore"])
    fs.copyFileSync(
      path.join(root, "deploy/facevision", name),
      path.join(dir, "facevision", name),
    );
  fs.writeFileSync(sourcePath, JSON.stringify({ sdk, python }, null, 2));
  fresh(
    configPath,
    "APP_VERSION=0.1.0\nHTTP_PORT=3110\nHTTPS_PORT=3445\nLAN_BIND=0.0.0.0\n",
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
    `uri: "mongodb://admin@127.0.0.1:27017/?authSource=admin"\npassword: ${JSON.stringify(password)}\n`,
  );
  if (flag("--models")) {
    if (!flag("--model-rights-confirmed"))
      throw new Error(
        "Antes de copiar modelos, confirmá derechos de uso/distribución con --model-rights-confirmed.",
      );
    const source = path.resolve(value("--models"));
    for (const name of models)
      if (!fs.existsSync(path.join(source, name)))
        throw new Error(`Modelo faltante: ${name}`);
    for (const name of models) {
      const target = path.join(dir, "models/buffalo_l", name);
      if (fs.existsSync(target)) {
        const digest = (file) =>
          crypto
            .createHash("sha256")
            .update(fs.readFileSync(file))
            .digest("hex");
        if (digest(target) !== digest(path.join(source, name)))
          throw new Error(
            "Modelo diferente: no se reemplaza un motor facial en uso automáticamente.",
          );
      } else
        fs.copyFileSync(
          path.join(source, name),
          target,
          fs.constants.COPYFILE_EXCL,
        );
      fs.chmodSync(target, 0o444);
    }
  }
  console.log(
    "Preparado. Secretos existentes conservados. Revisá .deploy y docs/docker.md antes de iniciar.",
  );
}
try {
  if (command === "prepare") prepare();
  else if (command === "build") {
    const tag = checkVersion(args[1]);
    // Updating the app must not silently retain an old FaceVision source profile.
    prepare();
    for (const image of [
      `controlrrhh-app:${tag}`,
      `controlrrhh-facevision:${tag}`,
    ]) {
      const exists = spawnSync("docker", ["image", "inspect", image], {
        stdio: "ignore",
        windowsHide: true,
      });
      if (exists.status === 0)
        throw new Error(
          "Esa versión ya existe. Usá otra etiqueta para conservar rollback.",
        );
    }
    compose(["config", "--quiet"], { APP_VERSION: tag });
    compose(["build", "--pull", "app", "facevision"], { APP_VERSION: tag });
    setVersion(tag);
    console.log(
      `Imágenes ${tag} construidas. start recrea servicios sin borrar volúmenes.`,
    );
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
        "Esa versión privada de FaceVision ya existe. Usá otra etiqueta para conservar rollback.",
      );
    compose(["config", "--quiet"], { APP_VERSION: tag });
    compose(["build", "--pull", "facevision"], { APP_VERSION: tag });
    setVersion(tag);
    console.log(
      `FaceVision privado ${tag} construido localmente. El código generado permanece en .deploy.`,
    );
  } else if (command === "start") {
    requireModels();
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
    compose(["pull", "app"], { APP_VERSION: tag });
    setVersion(tag);
    console.log(
      `App pública ${tag} descargada y seleccionada. FaceVision debe existir localmente con la misma versión. Ejecutá start --registry${flag("--lan") ? " --lan" : ""}.`,
    );
  } else if (command === "select") {
    const tag = checkVersion(args[1]);
    for (const image of [
      `controlrrhh-app:${tag}`,
      `controlrrhh-facevision:${tag}`,
    ])
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
    run("docker", [
      "image",
      "save",
      "--output",
      target,
      `controlrrhh-app:${tag}`,
      `controlrrhh-facevision:${tag}`,
      "mongo:8.0",
    ]);
    console.log(
      "Imágenes exportadas. No contienen la base, las claves, certificados ni modelos. Ver guía de traslado.",
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
