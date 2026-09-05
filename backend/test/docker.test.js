import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mongoConnection } from "../src/runtimeConfig.js";

test("Docker: secretos desde archivos, clave biométrica estricta y conexión Mongo sin cambiar defaults", () => {
  const folder = fs.mkdtempSync(
    path.join(os.tmpdir(), "controlrrhh-docker-test-"),
  );
  const file = path.join(folder, "secret"),
    keyURL = new URL("../src/security.js", import.meta.url).href;
  const probe = (env) =>
    spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `const m=await import(${JSON.stringify(keyURL)}); m.validateBiometricKey(); const s=m.encrypt({test:true}); if(!m.decrypt(s).test) process.exit(2);`,
      ],
      {
        env: {
          ...process.env,
          NODE_ENV: "production",
          BIOMETRIC_KEY: "",
          BIOMETRIC_KEY_FILE: file,
          ...env,
        },
        encoding: "utf8",
      },
    );
  try {
    fs.writeFileSync(file, "a".repeat(64));
    assert.equal(probe({}).status, 0);
    fs.writeFileSync(file, Buffer.alloc(32, 1));
    assert.equal(probe({}).status, 0);
    fs.writeFileSync(file, "b".repeat(64) + "invalid");
    assert.notEqual(probe({}).status, 0);
    assert.notEqual(
      probe({ BIOMETRIC_KEY_FILE: "", BIOMETRIC_KEY: "" }).status,
      0,
    );
    fs.writeFileSync(file, "synthetic@password:");
    assert.equal(mongoConnection({}), "mongodb://127.0.0.1:27017");
    assert.equal(
      mongoConnection({ MONGO_URI: "mongodb://fixture" }),
      "mongodb://fixture",
    );
    assert.equal(
      mongoConnection({ MONGO_PASSWORD_FILE: file, MONGO_USER: "controlrrhh" }),
      "mongodb://controlrrhh:synthetic%40password%3A@mongo:27017/control_rrhh?authSource=control_rrhh",
    );
    assert.throws(() => mongoConnection({ MONGO_PASSWORD_FILE: file }));
    assert.throws(() =>
      mongoConnection({
        MONGO_PASSWORD_FILE: file,
        MONGO_USER: "a",
        MONGO_HOST: "bad/path",
      }),
    );
  } finally {
    assert.ok(
      folder.startsWith(path.join(os.tmpdir(), "controlrrhh-docker-test-")),
    );
    fs.rmSync(folder, { recursive: true });
  }
});

test("Docker: build sin datos locales, endpoints internos y dependencias saludables", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const dockerfile = fs.readFileSync(path.join(root, "Dockerfile"), "utf8"),
    compose = fs.readFileSync(path.join(root, "compose.yaml"), "utf8"),
    ignore = fs.readFileSync(path.join(root, ".dockerignore"), "utf8");
  assert.ok(ignore.startsWith("**"));
  assert.ok(!ignore.includes("!.deploy"));
  assert.ok(!dockerfile.includes("COPY . "));
  assert.match(dockerfile, /USER node/);
  assert.match(compose, /FACEVISION_URL: http:\/\/facevision:8007/);
  assert.match(compose, /BIOMETRIC_KEY_FILE: \/run\/secrets\/biometric_key/);
  assert.equal((compose.match(/condition: service_healthy/g) || []).length, 2);
  assert.equal((compose.match(/^    ports:/gm) || []).length, 1);
  assert.ok(!compose.includes(':27017"') && !compose.includes(':8007"'));
});

test("GitHub público: publica sólo app y mantiene FaceVision fuera del repositorio", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
  const workflow = read(".github/workflows/publish-containers.yml"),
    registry = read("compose.registry.yaml"),
    ignore = read(".gitignore"),
    dockerScript = read("scripts/docker.mjs");

  assert.match(workflow, /tags:\s*\n\s*- "v\*\.\*\.\*"/);
  assert.match(workflow, /RELEASE_TAG: \$\{\{ github\.ref_name \}\}/);
  assert.match(workflow, /packages: write/);
  assert.match(workflow, /password: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
  assert.match(workflow, /ghcr\.io\/luiscarlosfertl-ia\/control-rrhh-app/);
  assert.doesNotMatch(workflow, /control-rrhh-facevision/);
  assert.doesNotMatch(workflow, /deploy\/facevision/);
  assert.match(workflow, /sbom: true/);
  assert.match(workflow, /provenance: mode=max/);
  assert.match(registry, /control-rrhh-app:\$\{APP_VERSION/);
  assert.doesNotMatch(registry, /facevision/);

  for (const excluded of [
    ".deploy/",
    ".local/",
    "*.pem",
    "*.key",
    "*.onnx",
    "*.archive",
  ])
    assert.ok(ignore.includes(excluded), excluded);
  for (const privateRuntime of [
    "deploy/facevision/hr_runtime.py",
    "deploy/facevision/hr_fast_face.py",
    "deploy/facevision/source-manifest.json",
  ]) {
    assert.ok(ignore.includes(privateRuntime), privateRuntime);
    assert.equal(fs.existsSync(path.join(root, privateRuntime)), false);
  }
  assert.match(dockerScript, /command === "build-facevision"/);
  assert.match(dockerScript, /compose\(\["pull", "app"\]/);
});
