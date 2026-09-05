export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Error ${response.status}`);
  return data;
}
export const query = (object) =>
  new URLSearchParams(
    Object.entries(object)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : v]),
  ).toString();
export const today = () => new Date().toLocaleDateString("en-CA");
export const labels = {
  in: "Entrada",
  out: "Salida",
  approved: "Aprobado",
  review: "En revisión",
  requested: "Pendiente",
  rejected: "Rechazado",
  vacation: "Vacaciones",
  medical: "Licencia médica",
  permission: "Permiso",
  unjustified: "Falta",
  suspension: "Suspensión",
  facevision: "FaceVision",
  manual: "Supervisada",
  normal: "Dentro de turno",
  outside: "Fuera de turno",
  extra50: "Extra 50%",
  extra100: "Extra 100%",
};
export function format(value, key = "") {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (key.endsWith("Minutes"))
    return `${Math.floor(value / 60)} h ${Math.round(value % 60)} m`;
  if (key.endsWith("At")) return new Date(value).toLocaleString("es-AR");
  if (Array.isArray(value)) return value.join(" · ") || "—";
  if (typeof value === "object") return JSON.stringify(value);
  return labels[value] || String(value);
}
