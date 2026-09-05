import React, { useEffect, useState } from "react";
import { Button, Checkbox, TextInput } from "@patternfly/react-core";
import { Building2 } from "lucide-react";
import { api, today } from "./api.js";
import { Dialog, ErrorBox } from "./components.jsx";

export function CompanyPresets() {
  const [items, setItems] = useState([]),
    [selected, setSelected] = useState(null),
    [startDate, setStartDate] = useState(today()),
    [demo, setDemo] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = () =>
    api("/presets")
      .then(setItems)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  function select(item) {
    setSelected(item);
    setError("");
    setStartDate(item.installation?.startDate || today());
    setDemo(item.installation?.includeDemoPeople || false);
  }
  async function apply() {
    setBusy(true);
    setError("");
    try {
      await api(`/presets/${selected.id}/apply`, {
        method: "POST",
        body: { startDate, includeDemoPeople: demo },
      });
      setNotice(
        `${selected.name}: preconfiguración integrada. Revisá Grupos, Horarios, Asignaciones y Terminales${demo ? "; también Personas (DEMO)" : ""}.`,
      );
      setSelected(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel preset-section" data-help="presets">
      <h2>Preconfiguraciones por tipo de empresa</h2>
      <p className="muted">
        Ejemplos operativos editables, sin convenio. Se agregan una sola vez y
        no reemplazan tus datos ni reglas. No generan rostros ni fichadas.
      </p>
      {!selected && <ErrorBox error={error} />}
      {notice && (
        <div className="success-notice" role="status">
          {notice}
        </div>
      )}
      <div className="preset-grid">
        {items.map((item) => (
          <article className="preset-card" key={item.id}>
            <Building2 size={23} />
            <h3>{item.name}</h3>
            <p>{item.description}</p>
            <p className="muted">
              2 grupos · 2 horarios · 2 asignaciones
              {item.rotating ? " · 2 ciclos" : ""} · 1 terminal desactivada
            </p>
            <Button
              variant="secondary"
              isDisabled={item.installation?.status === "ready"}
              onClick={() => select(item)}
            >
              {item.installation?.status === "ready"
                ? "Aplicada"
                : item.installation
                  ? "Continuar instalación"
                  : "Ver y configurar"}
            </Button>
          </article>
        ))}
      </div>
      {selected && (
        <Dialog
          title={`Preconfigurar · ${selected.name}`}
          onClose={() => !busy && setSelected(null)}
          footer={
            <>
              <Button
                isLoading={busy}
                isDisabled={busy || !startDate}
                onClick={apply}
              >
                Agregar preconfiguración
              </Button>
              <Button
                variant="link"
                isDisabled={busy}
                onClick={() => setSelected(null)}
              >
                Cancelar
              </Button>
            </>
          }
        >
          <ErrorBox error={error} />
          <p>{selected.description}</p>
          <ul>
            {selected.shifts.map((s, i) => (
              <li key={s.name}>
                {selected.groups[i]}: {s.name}, {s.start}–{s.end}
                {selected.rotating ? " (posición inicial del ciclo)" : ""}
              </li>
            ))}
          </ul>
          <label htmlFor="preset-start">
            Vigencia inicial{selected.rotating ? " / día 1 del ciclo" : ""}
          </label>
          <TextInput
            id="preset-start"
            type="date"
            value={startDate}
            isDisabled={busy || Boolean(selected.installation)}
            onChange={(_, v) => setStartDate(v)}
          />
          <Checkbox
            id="preset-demo"
            label="Agregar 20 legajos ficticios DEMO (10 por grupo), activos y asignados"
            isChecked={demo}
            isDisabled={busy || Boolean(selected.installation)}
            onChange={(_, v) => setDemo(v)}
          />
          <p className="muted">
            Los legajos DEMO se incluyen en las listas y el procesamiento.
            Desactivalos cuando termines las pruebas. Sin correo, documento,
            rostros ni fichadas; cupo vacacional 0. Pausas y tolerancias 0,
            editables. La terminal no tiene enlace ni cámara habilitada hasta
            que la actives. Feriados y reglas de extras se conservan sin
            cambios.
          </p>
        </Dialog>
      )}
    </section>
  );
}
