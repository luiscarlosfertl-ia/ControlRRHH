import { fail, decrypt } from "./security.js";
import { faceVisionEnabled } from "./runtimeConfig.js";
export function capture(body) {
  const near = body?.captures?.near;
  if (
    typeof near !== "string" ||
    near.length > 900000 ||
    !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(near)
  )
    fail("Captura facial inválida.");
  return { near };
}
export async function callFace(operation, body) {
  if (!faceVisionEnabled())
    fail(
      "FaceVision está deshabilitado en esta instalación. Usá marcación supervisada.",
      503,
    );
  const base = (process.env.FACEVISION_URL || "http://127.0.0.1:8007").replace(
    /\/+$/,
    "",
  );
  let response;
  try {
    response = await fetch(`${base}/face-auth/${operation}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(operation === "detect" ? 4000 : 30000),
    });
  } catch {
    fail("FaceVision no está disponible. Usá marcación supervisada.", 503);
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.status !== "ok")
    fail(
      result?.message || "No se pudo detectar un rostro válido.",
      response.status === 422 ? 422 : 503,
    );
  return result;
}
export async function presence(captures) {
  const result = await callFace("detect", { captures });
  if (
    !Array.isArray(result.faces) ||
    result.faces.length !== result.facesDetected
  )
    fail("Respuesta de FaceVision incompleta.", 503);
  const b = result.faces[0];
  const centered =
    b &&
    ["x", "y", "width", "height"].every(
      (k) => Number.isFinite(b[k]) && b[k] >= 0 && b[k] <= 1,
    ) &&
    Math.pow((b.x + b.width / 2 - 0.5) / 0.22, 2) +
      Math.pow((b.y + b.height / 2 - 0.5) / 0.38, 2) <=
      0.75 &&
    b.width >= 0.12 &&
    b.width <= 0.5 &&
    b.height >= 0.2 &&
    b.height <= 0.76;
  return {
    detected: result.facesDetected === 1 && Boolean(centered),
    absent: result.facesDetected === 0,
    multiple: result.facesDetected > 1,
  };
}
export function chooseIdentity(result, people, threshold, margin) {
  if (
    result?.status !== "ok" ||
    result.facesDetected !== 1 ||
    !Array.isArray(result.results) ||
    result.results.length !== people.length
  )
    fail("FaceVision no completó la comparación.", 503);
  const ids = new Set(people.map((p) => String(p._id))),
    found = new Set();
  for (const r of result.results) {
    if (
      !ids.has(r.id) ||
      found.has(r.id) ||
      r.error ||
      !Number.isFinite(r.similarity) ||
      r.similarity < 0 ||
      r.similarity > 1
    )
      fail("Comparación facial incompleta.", 503);
    found.add(r.id);
  }
  const sorted = [...result.results].sort(
      (a, b) => b.similarity - a.similarity,
    ),
    best = sorted[0];
  if (!best || !best.verified || best.similarity < threshold)
    fail("Rostro no reconocido", 422);
  if (sorted[1] && best.similarity - sorted[1].similarity < margin)
    fail("Coincidencia ambigua. Solicitá registro supervisado.", 422);
  return {
    person: people.find((p) => String(p._id) === best.id),
    similarity: best.similarity,
  };
}
export async function identify(captures, people, terminal) {
  if (!people.length)
    fail("No hay personas habilitadas con tres capturas faciales.", 422);
  const data = await callFace("search", {
    captures,
    threshold: terminal.matchThreshold,
    candidates: people.map((p) => ({
      id: String(p._id),
      templates: decrypt(p.faceEncrypted).map((x) => x.template),
    })),
  });
  return chooseIdentity(
    data,
    people,
    terminal.matchThreshold,
    terminal.ambiguityMargin,
  );
}
