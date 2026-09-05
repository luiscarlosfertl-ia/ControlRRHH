import React, { useState } from "react";
import { Button, Checkbox, TextInput, Label } from "@patternfly/react-core";
import { Search, Camera } from "lucide-react";
import {
  ResourceTable,
  Dialog,
  IconButton,
  ErrorBox,
  Badge,
} from "./components.jsx";
import { PunchEvidence } from "./ReviewTools.jsx";
import { format, today } from "./api.js";

const hours = [
  ["expectedMinutes", "Planificadas"],
  ["workedMinutes", "Presencia bruta"],
  ["normalMinutes", "Normales netas"],
  ["outsideMinutes", "Fuera de turno (total)"],
  ["unapprovedMinutes", "Fuera sin autorización"],
  ["extra50Minutes", "Extra 50%"],
  ["extra100Minutes", "Extra 100%"],
  ["lateMinutes", "Tardanza"],
  ["earlyMinutes", "Salida anticipada"],
];
const counts = [
  ["days", "Jornadas procesadas"],
  ["reviewDays", "En revisión"],
  ["approvedDays", "Aprobadas"],
  ["manualDays", "Con edición manual"],
  ["lateDays", "Días con tardanza"],
  ["earlyDays", "Días con salida anticipada"],
  ["absenceDays", "Días con ausencia"],
  ["vacationDays", "Vacaciones"],
  ["medicalDays", "Licencia médica"],
  ["permissionDays", "Permisos"],
  ["unjustifiedDays", "Faltas"],
  ["suspensionDays", "Suspensiones"],
];
const identity = [
  ["employeeNumber", "Legajo"],
  ["personName", "Persona"],
];
const dayColumns = [
  ...identity,
  ["date", "Día laboral"],
  ["shiftName", "Horario"],
  ...hours,
  ["absence", "Ausencia"],
  ["status", "Estado"],
  ["manuallyEdited", "Edición manual"],
];
const personColumns = [...identity, ...hours, ...counts];
const stamp = (value, zone) =>
  new Date(value).toLocaleString("es-AR", {
    timeZone: zone || "UTC",
    hour12: false,
  });
const reportFormat = (value, key) =>
  key.endsWith("Minutes") && Number.isFinite(value)
    ? `${Math.floor(Math.round(value * 60) / 3600)} h ${Math.floor((Math.round(value * 60) % 3600) / 60)} m${Math.round(value * 60) % 60 ? ` ${Math.round(value * 60) % 60} s` : ""}`
    : format(value, key);
function Totals({ data }) {
  if (!data) return <p role="status">Consultando totales…</p>;
  if (data.error) return null;
  return (
    <div className="report-totals" aria-label="Totales del informe">
      <h3>Totales de todo el resultado filtrado · {data.total} registros</h3>
      <dl className="detail-grid">
        {hours.map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{reportFormat(data.totals[key], key)}</dd>
          </div>
        ))}
      </dl>
      <details>
        <summary>Resumen de ausencias, puntualidad y estados</summary>
        <dl className="detail-grid">
          {counts.map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{data.totals[key]}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
function Punches({ row, onEvidence }) {
  return (
    <section
      className="report-punches"
      aria-label={`Fichadas de ${row.personName} ${row.date}`}
    >
      <strong>Fichadas originales · {row.policy?.timeZone || "UTC"}</strong>
      {!row.punches?.length && (
        <p>No hay fichadas originales vinculadas a esta jornada.</p>
      )}
      {row.punches?.map((p) => (
        <div className="report-punch" key={p._id}>
          <Badge value={p.direction} />
          <span>{stamp(p.occurredAt, row.policy?.timeZone)}</span>
          <span>
            {format(p.source)} · Coincidencia: {format(p.similarity)}
          </span>
          {p.reason && <span>{p.reason}</span>}
          {p.hasCapture && (
            <IconButton
              title="Ver captura de fichada"
              onClick={() => onEvidence(p)}
            >
              <Camera size={16} />
            </IconButton>
          )}
        </div>
      ))}
      {row.missingPunches > 0 && (
        <p role="alert">
          {row.missingPunches} referencia(s) de fichada no disponibles.
        </p>
      )}
    </section>
  );
}
function DailyDetail({ row, onClose, onEvidence }) {
  return (
    <Dialog
      wide
      title={`${row.personName} · Legajo ${row.employeeNumber} · ${row.date}`}
      onClose={onClose}
    >
      <dl className="detail-grid">
        {[
          ...dayColumns.slice(2),
          ["anomalies", "Incidencias"],
          ["notes", "Observaciones"],
        ].map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{reportFormat(row[key], key)}</dd>
          </div>
        ))}
      </dl>
      <h3>Tramos procesados · {row.policy?.timeZone || "UTC"}</h3>
      {!row.segments?.length && <p>Sin tramos de presencia procesados.</p>}
      <ol>
        {row.segments?.map((s, i) => (
          <li key={i}>
            {stamp(s.start, row.policy?.timeZone)} →{" "}
            {stamp(s.end, row.policy?.timeZone)} · {format(s.kind)}
          </li>
        ))}
      </ol>
      {row.punches ? (
        <Punches row={row} onEvidence={onEvidence} />
      ) : (
        <p>
          Activá «Incluir fichadas originales» para ver la evidencia vinculada.
        </p>
      )}
      <p className="muted">
        Los tramos pueden contener ajustes manuales. Las fichadas originales no
        se alteran.
      </p>
    </Dialog>
  );
}
export function Reports() {
  const [from, setFrom] = useState(() => `${today().slice(0, 7)}-01`),
    [to, setTo] = useState(today),
    [all, setAll] = useState(true),
    [people, setPeople] = useState([]),
    [picker, setPicker] = useState(false),
    [range, setRange] = useState(null),
    [mode, setMode] = useState("people"),
    [include, setInclude] = useState(false),
    [result, setResult] = useState(null),
    [error, setError] = useState(""),
    [day, setDay] = useState(null),
    [person, setPerson] = useState(null),
    [evidence, setEvidence] = useState(null),
    [revision, setRevision] = useState(0);
  function generate() {
    setError("");
    if (
      !from ||
      !to ||
      to < from ||
      (Date.parse(to) - Date.parse(from)) / 86400000 > 365
    )
      return setError(
        "Seleccioná fechas válidas: desde/hasta, hasta 366 días.",
      );
    if (!all && !people.length)
      return setError("Seleccioná al menos una persona o elegí Todas.");
    setRange({ from, to, personIds: all ? [] : people.map((p) => p._id) });
    setRevision((n) => n + 1);
  }
  const params = range && { ...range, includePunches: String(include) };
  const daily = (scope, tableKey) => (
    <ResourceTable
      key={tableKey}
      resource="reviews"
      title="Detalle diario del informe"
      emptyMessage="No hay jornadas procesadas para esta consulta"
      endpoint="/reports/days"
      params={scope}
      columns={dayColumns}
      renderCell={(row, key) =>
        key.endsWith("Minutes") ? reportFormat(row[key], key) : undefined
      }
      onView={setDay}
      renderRowDetail={
        include
          ? (row) => <Punches row={row} onEvidence={setEvidence} />
          : undefined
      }
    />
  );
  return (
    <>
      <div className="page-heading" data-help="heading">
        <div>
          <span className="eyebrow">GESTIÓN DE PERSONAS</span>
          <h1>Informes de asistencia</h1>
          <p>Jornadas procesadas, resumen por persona y detalle diario.</p>
        </div>
      </div>
      <section className="panel report-controls" data-help="report-controls">
        <div className="form-grid">
          <label>
            Fecha desde
            <TextInput
              aria-label="Fecha desde"
              type="date"
              value={from}
              onChange={(_, v) => setFrom(v)}
            />
          </label>
          <label>
            Fecha hasta
            <TextInput
              aria-label="Fecha hasta"
              type="date"
              value={to}
              onChange={(_, v) => setTo(v)}
            />
          </label>
        </div>
        <div className="toolbar-actions">
          <Checkbox
            id="report-all"
            label="Todas las personas"
            isChecked={all}
            onChange={(_, v) => setAll(v)}
          />
          <Button
            variant="secondary"
            icon={<Search size={16} />}
            onClick={() => setPicker(true)}
          >
            Seleccionar personas ({people.length})
          </Button>
          <Checkbox
            id="report-punches"
            label="Incluir fichadas originales"
            isChecked={include}
            onChange={(_, v) => setInclude(v)}
          />
          <Button onClick={generate}>Generar informe</Button>
        </div>
        {!all && (
          <div className="report-selection">
            {people.map((p) => (
              <Label
                key={p._id}
                onClose={() =>
                  setPeople((items) => items.filter((x) => x._id !== p._id))
                }
              >
                {p.employeeNumber} · {p.name}
              </Label>
            ))}
          </div>
        )}
        <ErrorBox error={error} />
        <p className="muted">
          Días laborales inclusivos; hasta 366 días. Incluye personas inactivas
          con jornadas en el rango. Un día sin procesar no se informa como
          falta. Las ausencias se cuentan por jornadas, no como saldo
          vacacional.
        </p>
      </section>
      {range && (
        <section className="panel report-result" data-help="report-result">
          <h2>
            {range.from} → {range.to} ·{" "}
            {range.personIds.length
              ? `${range.personIds.length} persona(s)`
              : "Todas las personas"}
          </h2>
          <div className="toolbar-actions">
            <Button
              variant={mode === "people" ? "primary" : "secondary"}
              onClick={() => setMode("people")}
            >
              Resumen por persona
            </Button>
            <Button
              variant={mode === "days" ? "primary" : "secondary"}
              onClick={() => setMode("days")}
            >
              Detalle diario
            </Button>
          </div>
          <p className="muted">
            Sólo datos guardados: no recalcula ni aprueba. Fuera de turno total
            incluye las extras: no sumar ambas columnas. Presencia bruta incluye
            pausas; normales netas las descuentan. Los filtros de columnas se
            aplican a la vista elegida.
          </p>
          <ResourceTable
            key={`${mode}-${JSON.stringify(range)}`}
            resource="reviews"
            title={
              mode === "people"
                ? "Resumen por persona"
                : "Detalle diario del informe"
            }
            endpoint={`/reports/${mode}`}
            emptyMessage="No hay jornadas procesadas para esta consulta"
            params={params}
            refresh={revision}
            onResult={setResult}
            columns={mode === "people" ? personColumns : dayColumns}
            renderCell={(row, key) =>
              key.endsWith("Minutes") ? reportFormat(row[key], key) : undefined
            }
            onView={mode === "people" ? setPerson : setDay}
            renderRowDetail={
              mode === "days" && include
                ? (row) => <Punches row={row} onEvidence={setEvidence} />
                : undefined
            }
          />
          <Totals data={result} />
        </section>
      )}
      {picker && (
        <Dialog
          wide
          title={`Seleccionar personas · ${people.length} seleccionadas`}
          onClose={() => setPicker(false)}
          footer={<Button onClick={() => setPicker(false)}>Listo</Button>}
        >
          <p>
            Podés seleccionar hasta 100 personas. Para el plantel completo, usá
            Todas.
          </p>
          <ResourceTable
            resource="people"
            isSelectionDisabled={(p) =>
              people.length >= 100 || people.some((x) => x._id === p._id)
            }
            onSelect={(p) => {
              if (people.some((x) => x._id === p._id)) return;
              if (people.length >= 100) return;
              setPeople((items) => [...items, p]);
              setAll(false);
            }}
            renderCell={(p, key) =>
              key === "name" && people.some((x) => x._id === p._id) ? (
                <strong>{p.name} · Seleccionada</strong>
              ) : undefined
            }
          />
        </Dialog>
      )}
      {person && (
        <Dialog
          wide
          title={`Detalle por persona · ${person.personName} · Legajo ${person.employeeNumber}`}
          onClose={() => setPerson(null)}
        >
          <p>
            {range.from} → {range.to}. Totales del resumen seleccionado.
          </p>
          <dl className="detail-grid">
            {[...hours, ...counts].map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{reportFormat(person[key], key)}</dd>
              </div>
            ))}
          </dl>
          {daily({ ...params, personIds: [person.personId] }, person.personId)}
        </Dialog>
      )}
      {day && (
        <DailyDetail
          row={day}
          onClose={() => setDay(null)}
          onEvidence={setEvidence}
        />
      )}
      {evidence && (
        <PunchEvidence row={evidence} onClose={() => setEvidence(null)} />
      )}
    </>
  );
}
