import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, TextInput } from "@patternfly/react-core";
import { viewHelp, fieldHelp, circuits, viewSteps } from "./helpContent.js";

export function HelpCenter({ go, start }) {
  const [search, setSearch] = useState("");
  const match = (text) =>
    text
      .toLocaleLowerCase("es")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .includes(
        search
          .toLocaleLowerCase("es")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, ""),
      );
  const topics = Object.entries(viewHelp).filter(([, h]) =>
    match(h.title + " " + h.concept + " " + h.sequence.join(" ")),
  );
  return (
    <section className="help-center">
      <div className="page-heading" data-help="heading">
        <div>
          <span className="eyebrow">APRENDER Y OPERAR</span>
          <h1>Asistencia y ayuda</h1>
          <p>
            Conceptos, relaciones entre datos y circuitos paso a paso. Los
            paseos no modifican registros.
          </p>
        </div>
      </div>
      <TextInput
        aria-label="Buscar ayuda"
        placeholder="Buscar: legajo, rotación, fichadas, vacaciones…"
        value={search}
        onChange={(_, v) => setSearch(v)}
      />
      <h2>Circuitos completos</h2>
      <div className="help-card-grid">
        {circuits
          .filter((c) => match(c.title + " " + c.description))
          .map((c) => (
            <article className="panel help-card" key={c.id}>
              <h3>{c.title}</h3>
              <p>{c.description}</p>
              <ol>
                {c.views.map((v) => (
                  <li key={v}>{viewHelp[v].title}</li>
                ))}
              </ol>
              <Button
                variant="secondary"
                onClick={() =>
                  start(
                    c.views.map((view) => ({
                      view,
                      target: "[data-help='heading']",
                      title: viewHelp[view].title,
                      body: viewHelp[view].concept,
                      instructions: viewHelp[view].sequence,
                    })),
                    c.title,
                  )
                }
              >
                Iniciar circuito: {c.title}
              </Button>
            </article>
          ))}
      </div>
      <h2>Cómo se integra cada vista</h2>
      <div className="help-card-grid">
        {topics.map(([key, h]) => (
          <article className="panel help-card" key={key}>
            <h3>{h.title}</h3>
            <p>{h.concept}</p>
            <ol>
              {h.sequence.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <p className="muted">
              Se relaciona con:{" "}
              {h.related.map((v) => viewHelp[v].title).join(" · ")}
            </p>
            <div className="toolbar-actions">
              <Button variant="secondary" onClick={() => go(key)}>
                Abrir {h.title}
              </Button>
              <Button
                variant="link"
                onClick={() => start(viewSteps(key), `Paseo · ${h.title}`)}
              >
                Paseo guiado
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!topics.length && <p role="status">No hay temas con esa búsqueda.</p>}
    </section>
  );
}
export function Assistance({ view, go, run, setRun }) {
  const [index, setIndex] = useState(0),
    [rect, setRect] = useState(null),
    [found, setFound] = useState(false),
    [height, setHeight] = useState(340);
  const card = useRef(),
    previousFocus = useRef(null);
  useEffect(() => {
    if (!run || !card.current) return;
    const observer = new ResizeObserver(() =>
      setHeight(card.current?.offsetHeight || 340),
    );
    observer.observe(card.current);
    return () => observer.disconnect();
  }, [run]);
  useEffect(() => {
    function helpDialog(event) {
      const { scope, title } = event.detail,
        root = document.querySelector(`[data-help-scope="${scope}"]`);
      if (!root) return;
      const fields = [...root.querySelectorAll("[data-help-field]")];
      const steps = [
        {
          view,
          element: root,
          title,
          body: "Este diálogo trabaja sobre el registro seleccionado. La ayuda no completa ni guarda datos. Cerrá el paseo para volver a operar.",
        },
      ];
      if (fields.length)
        fields.forEach((el) =>
          steps.push({
            view,
            element: el,
            title: el.dataset.helpLabel || el.dataset.helpField,
            body:
              fieldHelp[el.dataset.helpField] ||
              "Dato del registro. Revisá su relación con la persona, el grupo y la vigencia antes de guardar.",
          }),
        );
      else
        [
          ...root.querySelectorAll(
            "input:not([type=password]),select,textarea,button[aria-label]",
          ),
        ]
          .filter(
            (el) =>
              !el.closest("[data-tour-card]") && el.getClientRects().length,
          )
          .slice(0, 30)
          .forEach((el) => {
            const title =
              el.getAttribute("aria-label") ||
              el.closest("label")?.textContent ||
              "Control del diálogo";
            steps.push({
              view,
              element: el,
              title,
              body: title.includes("Motivo")
                ? "Explicá la intervención. Queda asociado a la operación y su auditoría."
                : title.includes("tramo")
                  ? "Intervalo de la jornada procesada. Las fechas usan la zona horaria indicada; no deben superponerse. No altera fichadas originales."
                  : title.includes("Autorización")
                    ? "Referencia documentada de autorización biométrica. La ayuda no activa la cámara ni toma capturas."
                    : "Usá este control para revisar o completar el dato indicado. Guardar o confirmar sigue siendo una acción explícita tuya.",
            });
          });
      setRun({ title: `Ayuda · ${title}`, steps, scope });
    }
    addEventListener("control-help-dialog", helpDialog);
    return () => removeEventListener("control-help-dialog", helpDialog);
  }, [view]);
  useEffect(() => {
    if (!run) return;
    previousFocus.current = document.activeElement;
    setIndex(0);
    return () => {
      if (previousFocus.current?.isConnected) previousFocus.current.focus();
    };
  }, [run]);
  const step = run?.steps[index];
  useEffect(() => {
    if (!run || !step) return;
    setRect(null);
    setFound(false);
    if (step.view !== view) return;
    let first = true;
    const update = () => {
      const root = document.querySelector(`[data-active-view="${view}"]`);
      const target = step.element?.isConnected
        ? step.element
        : step.target
          ? root?.querySelector(step.target) ||
            (root?.matches(step.target) ? root : null)
          : null;
      if (!target || !target.getClientRects().length) {
        setFound(false);
        setRect(null);
        return;
      }
      if (first) {
        target.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "instant",
        });
        first = false;
      }
      const r = target.getBoundingClientRect();
      const next = {
        left: Math.max(4, r.left - 4),
        top: Math.max(4, r.top - 4),
        width: Math.min(r.width + 8, innerWidth - 8),
        height: Math.min(r.height + 8, innerHeight - 8),
      };
      setRect((old) =>
        JSON.stringify(old) === JSON.stringify(next) ? old : next,
      );
      setFound(true);
    };
    update();
    const timer = setInterval(update, 350);
    card.current?.focus();
    addEventListener("resize", update);
    addEventListener("scroll", update, true);
    const escape = (e) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        setRun(null);
      }
    };
    addEventListener("keydown", escape, true);
    return () => {
      clearInterval(timer);
      removeEventListener("resize", update);
      removeEventListener("scroll", update, true);
      removeEventListener("keydown", escape, true);
    };
  }, [run, index, view]);
  if (!run || !step) return null;
  const close = () => setRun(null);
  function move(next) {
    const destination = run.steps[next];
    if (destination.view !== view && go(destination.view) === false) return;
    setIndex(next);
  }
  const width = Math.min(390, innerWidth - 24);
  let top =
    rect && rect.top + rect.height + height + 20 < innerHeight
      ? rect.top + rect.height + 12
      : Math.max(12, innerHeight - height - 16);
  let left = rect
    ? Math.max(12, Math.min(rect.left, innerWidth - width - 12))
    : Math.max(12, innerWidth - width - 16);
  if (rect && top < rect.top + rect.height && left < rect.left + rect.width) {
    if (rect.left + rect.width + width + 24 < innerWidth)
      left = rect.left + rect.width + 12;
    else if (rect.top > height + 24) top = rect.top - height - 12;
  }
  const dialogRoot =
    run.scope && document.querySelector(`[data-help-scope="${run.scope}"]`);
  return createPortal(
    <>
      {rect && found && (
        <div className="tour-highlight" style={rect} aria-hidden="true" />
      )}
      <section
        className="tour-card"
        data-tour-card
        ref={card}
        tabIndex={-1}
        role="region"
        aria-label="Paseo asistido"
        style={{ width, top, left }}
      >
        <div className="tour-card-header">
          <span>{run.title}</span>
          <Button variant="plain" aria-label="Cerrar paseo" onClick={close}>
            ×
          </Button>
        </div>
        <p className="muted" aria-live="polite">
          Paso {index + 1} de {run.steps.length} · {viewHelp[step.view]?.title}
        </p>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        {step.instructions && (
          <ol>
            {step.instructions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        )}
        {!found && (
          <p className="tour-missing">
            Este elemento no está disponible ahora. Puede requerir registros
            cargados o un diálogo abierto. Podés continuar el paseo.
          </p>
        )}
        <div className="toolbar-actions">
          <Button
            variant="secondary"
            isDisabled={index === 0}
            onClick={() => move(index - 1)}
          >
            Anterior
          </Button>
          <Button
            onClick={() =>
              index === run.steps.length - 1 ? close() : move(index + 1)
            }
          >
            {index === run.steps.length - 1 ? "Finalizar" : "Siguiente"}
          </Button>
        </div>
        <small>
          Podés cerrar el paseo en cualquier momento. No ejecuta operaciones.
        </small>
      </section>
    </>,
    dialogRoot || document.body,
  );
}
