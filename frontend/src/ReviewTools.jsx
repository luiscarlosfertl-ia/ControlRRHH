import React, { useEffect, useState } from "react";
import {
  Button,
  TextInput,
  FormSelect,
  FormSelectOption,
} from "@patternfly/react-core";
import { api, format, labels } from "./api.js";
import { Dialog, ErrorBox } from "./components.jsx";
const kinds = ["normal", "outside", "extra50", "extra100"];
function localStamp(iso, zone) {
  const date = new Date(iso),
    parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(date)
        .map((p) => [p.type, p.value]),
    );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${String(date.getUTCMilliseconds()).padStart(3, "0")}`;
}
export function ReviewEditor({ row, onClose, onSaved }) {
  const zone = row.policy?.timeZone || "UTC";
  const normalRaw = (row.segments || [])
    .filter((s) => s.kind === "normal")
    .reduce((n, s) => n + (Date.parse(s.end) - Date.parse(s.start)) / 60000, 0);
  const [data, setData] = useState({
    version: row.version || 0,
    reason: "",
    segments: (row.segments || []).map((s) => ({
      ...s,
      start: localStamp(s.start, zone),
      end: localStamp(s.end, zone),
    })),
    unpaidBreakMinutes:
      row.unpaidBreakMinutes ?? Math.max(0, normalRaw - row.normalMinutes),
    lateMinutes: row.lateMinutes || 0,
    earlyMinutes: row.earlyMinutes || 0,
    absence: row.absence || "",
  });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const update = (key, value) => setData((d) => ({ ...d, [key]: value }));
  const segment = (index, key, value) =>
    update(
      "segments",
      data.segments.map((s, i) => (i === index ? { ...s, [key]: value } : s)),
    );
  async function save() {
    setBusy(true);
    setError("");
    try {
      const saved = await api(`/reviews/${row._id}/edit`, {
        method: "POST",
        body: data,
      });
      onSaved(saved);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      wide
      title={`Edición manual · ${row.personName} · ${row.date}`}
      onClose={onClose}
      footer={
        <>
          <Button
            isLoading={busy}
            isDisabled={busy || data.reason.trim().length < 5}
            onClick={save}
          >
            Guardar con auditoría
          </Button>
          <Button variant="link" isDisabled={busy} onClick={onClose}>
            Cancelar
          </Button>
        </>
      }
    >
      <ErrorBox error={error} />
      <p className="muted">
        Zona: {zone}. Modifica sólo la jornada procesada. Las fichadas y sus
        capturas permanecen intactas. Los totales se calculan desde estos
        tramos; las extras seleccionadas quedan como ajuste manual auditado.
      </p>
      {data.segments.map((s, i) => (
        <fieldset className="review-segment-editor" key={i} disabled={busy}>
          <legend>Tramo {i + 1}</legend>
          <div className="form-grid">
            <label>
              Desde
              <TextInput
                aria-label={`Desde tramo ${i + 1}`}
                type="datetime-local"
                step="0.001"
                value={s.start}
                onChange={(_, v) => segment(i, "start", v)}
              />
            </label>
            <label>
              Hasta
              <TextInput
                aria-label={`Hasta tramo ${i + 1}`}
                type="datetime-local"
                step="0.001"
                value={s.end}
                onChange={(_, v) => segment(i, "end", v)}
              />
            </label>
            <label>
              Clasificación
              <FormSelect
                aria-label={`Clasificación tramo ${i + 1}`}
                value={s.kind}
                onChange={(_, v) => segment(i, "kind", v)}
              >
                {kinds.map((k) => (
                  <FormSelectOption key={k} value={k} label={labels[k]} />
                ))}
              </FormSelect>
            </label>
            <Button
              variant="link"
              onClick={() =>
                update(
                  "segments",
                  data.segments.filter((_, n) => n !== i),
                )
              }
            >
              Quitar tramo {i + 1}
            </Button>
          </div>
        </fieldset>
      ))}
      <Button
        variant="secondary"
        isDisabled={busy || data.segments.length >= 64}
        onClick={() =>
          update("segments", [
            ...data.segments,
            {
              start: `${row.date}T08:00`,
              end: `${row.date}T09:00`,
              kind: "normal",
            },
          ])
        }
      >
        Agregar tramo
      </Button>
      <div className="form-grid review-edit-fields">
        {[
          ["unpaidBreakMinutes", "Pausa no paga (minutos normales)"],
          ["lateMinutes", "Llegada tardía (minutos)"],
          ["earlyMinutes", "Salida anticipada (minutos)"],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <TextInput
              aria-label={label}
              type="number"
              min={0}
              value={data[key]}
              onChange={(_, v) => update(key, Number(v))}
            />
          </label>
        ))}
        <label>
          Ausencia
          <FormSelect
            aria-label="Ausencia de jornada"
            value={data.absence}
            onChange={(_, v) => update("absence", v)}
          >
            {[
              "",
              "vacation",
              "medical",
              "permission",
              "unjustified",
              "suspension",
            ].map((v) => (
              <FormSelectOption
                key={v}
                value={v}
                label={v ? labels[v] : "Sin ausencia"}
              />
            ))}
          </FormSelect>
        </label>
        <label className="full-field">
          Motivo obligatorio
          <TextInput
            aria-label="Motivo de edición manual"
            value={data.reason}
            onChange={(_, v) => update("reason", v)}
          />
        </label>
      </div>
      <p className="muted">
        Las incidencias del cálculo original se conservan para su revisión.
        Reprocesar no sobrescribe una jornada editada manualmente.
      </p>
    </Dialog>
  );
}
export function ReviewHistory({ row, onClose }) {
  const [items, setItems] = useState([]),
    [error, setError] = useState("");
  useEffect(() => {
    api(`/reviews/${row._id}/history`)
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message));
  }, [row._id]);
  return (
    <Dialog
      wide
      title={`Auditoría de edición · ${row.personName}`}
      onClose={onClose}
    >
      <ErrorBox error={error} />
      {!items.length && <p>Sin ediciones manuales.</p>}
      {[...items].reverse().map((item) => (
        <article className="review-change" key={item.id}>
          <h3>
            {new Date(item.at).toLocaleString()} ·{" "}
            {item.actorName || item.actor}
          </h3>
          <p>{item.reason}</p>
          <div className="form-grid">
            {["before", "after"].map((side) => (
              <div key={side}>
                <h4>{side === "before" ? "Antes" : "Después"}</h4>
                <dl>
                  {Object.keys(item.before)
                    .filter((k) => k !== "segments")
                    .map((k) => (
                      <React.Fragment key={k}>
                        <dt>
                          {{
                            workedMinutes: "Presencia",
                            normalMinutes: "Normales",
                            outsideMinutes: "Fuera de turno",
                            extra50Minutes: "Extra 50%",
                            extra100Minutes: "Extra 100%",
                            lateMinutes: "Tardanza",
                            earlyMinutes: "Salida anticipada",
                            absence: "Ausencia",
                            unpaidBreakMinutes: "Pausa no paga",
                          }[k] || k}
                        </dt>
                        <dd>{format(item[side][k], k)}</dd>
                      </React.Fragment>
                    ))}
                </dl>
                <ul>
                  {item[side].segments.map((s, i) => (
                    <li key={i}>
                      {new Date(s.start).toLocaleString()} –{" "}
                      {new Date(s.end).toLocaleString()} · {labels[s.kind]}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </article>
      ))}
    </Dialog>
  );
}
export function PunchEvidence({ row, onClose }) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    api(`/punches/${row._id}/capture`)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [row._id]);
  return (
    <Dialog title="Evidencia visual de fichada" onClose={onClose}>
      <ErrorBox error={error} />
      {data && (
        <>
          <h3>
            {data.personName} · Legajo {data.employeeNumber}
          </h3>
          <p>
            {format(data.direction)} ·{" "}
            {new Date(data.occurredAt).toLocaleString()}
          </p>
          <img
            className="punch-evidence"
            src={data.image}
            alt={`Captura de la fichada de ${data.personName}`}
          />
          <p>Índice de coincidencia: {data.similarity?.toFixed(3)}</p>
          <p className="muted">
            Imagen original de esta fichada. Acceso registrado en auditoría.
          </p>
        </>
      )}
    </Dialog>
  );
}
