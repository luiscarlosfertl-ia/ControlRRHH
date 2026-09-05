import React, { useEffect, useRef, useState } from "react";
import { Button, TextInput, Checkbox, Alert } from "@patternfly/react-core";
import { Check, X, Camera } from "lucide-react";
import { api, format } from "./api.js";
import { Dialog, ErrorBox } from "./components.jsx";
import { Brand } from "./Brand.jsx";
export function snapshot(video) {
  const canvas = document.createElement("canvas"),
    width = Math.min(640, video.videoWidth);
  if (!width) throw new Error("Esperando imagen de cámara");
  canvas.width = width;
  canvas.height = Math.round((video.videoHeight * width) / video.videoWidth);
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  return { near: canvas.toDataURL("image/jpeg", 0.8) };
}
export function FaceEnrollment({ person, onClose, onSaved, testOnly = false }) {
  const video = useRef(),
    [error, setError] = useState(""),
    [count, setCount] = useState(person.faceCount || 0),
    [busy, setBusy] = useState(false),
    [authorization, setAuthorization] = useState(""),
    [agreed, setAgreed] = useState(false),
    [ready, setReady] = useState(false),
    [result, setResult] = useState(null),
    [captures, setCaptures] = useState([]);
  useEffect(() => {
    let live = true,
      stream;
    api(`/people/${person._id}/face`)
      .then((d) => live && setCaptures(d.captures))
      .catch((e) => live && setError(e.message));
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("La cámara requiere HTTPS o localhost.");
      return () => {
        live = false;
      };
    }
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      })
      .then((s) => {
        stream = s;
        if (!live) return s.getTracks().forEach((t) => t.stop());
        video.current.srcObject = s;
        setReady(true);
      })
      .catch(
        (e) => live && setError("No se pudo abrir la cámara: " + e.message),
      );
    return () => {
      live = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  async function enroll() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const result = await api(`/people/${person._id}/face`, {
        method: "POST",
        body: { captures: snapshot(video.current), authorization },
      });
      setCount(result.faceCount);
      const catalog = await api(`/people/${person._id}/face`);
      setCaptures(catalog.captures);
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function testFace() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(
        await api(`/people/${person._id}/face/test`, {
          method: "POST",
          body: { captures: snapshot(video.current) },
        }),
      );
    } catch (e) {
      setResult({
        matched: false,
        message: `${e.message} No se generó ninguna fichada.`,
      });
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    if (
      !confirm(
        "¿Revocar el catálogo facial? Se eliminarán las tres capturas y sus plantillas.",
      )
    )
      return;
    try {
      await api(`/people/${person._id}/face`, { method: "DELETE" });
      setCount(0);
      setCaptures([]);
      setResult(null);
      onSaved();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Dialog
      title={`${testOnly ? "Probar rostro" : "Registro facial"} · ${person.name}`}
      onClose={onClose}
    >
      <ErrorBox error={error} />
      <p className="muted">
        {testOnly
          ? "Mirá de frente y probá la coincidencia con el catálogo activo. Esta prueba no marca entrada ni salida."
          : `Registrá tres capturas nítidas de la misma persona mirando de frente, variando levemente la posición. ${count}/3 capturas guardadas.`}
      </p>
      {result && (
        <Alert
          isInline
          variant={result.matched ? "success" : "danger"}
          title={
            result.matched
              ? `${result.personName} · Legajo ${result.employeeNumber}`
              : "Prueba no satisfactoria"
          }
        >
          {result.message}
          {Number.isFinite(result.similarity) && (
            <p>
              Índice de similitud: {result.similarity.toFixed(3)} · Umbral:{" "}
              {result.threshold}. No representa una probabilidad.
            </p>
          )}
        </Alert>
      )}
      <video
        className="enrollment-video"
        ref={video}
        autoPlay
        muted
        playsInline
      />
      {!testOnly && (
        <>
          <div className="capture-strip">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                {captures[i] ? (
                  <img src={captures[i].image} alt={`Captura ${i + 1}`} />
                ) : (
                  <Camera size={26} />
                )}
                <span>Captura {i + 1}</span>
              </div>
            ))}
          </div>
          <label>
            Referencia de autorización para uso biométrico
            <TextInput
              aria-label="Autorización biométrica"
              value={authorization}
              onChange={(_, v) => setAuthorization(v)}
              placeholder="Ej. consentimiento archivado en legajo"
            />
          </label>
          <Checkbox
            id="face-authorization"
            label="La persona fue informada y autorizó el fichaje facial y la conservación de su captura como evidencia."
            isChecked={agreed}
            onChange={(_, v) => setAgreed(v)}
          />
          <p className="muted">
            Fotos y plantillas cifradas. Existe alternativa de fichaje
            supervisado. FaceVision no certifica prueba de vida.
          </p>
        </>
      )}
      <div className="toolbar-actions">
        {!testOnly && (
          <Button
            isDisabled={
              !ready ||
              !agreed ||
              authorization.trim().length < 5 ||
              count >= 3 ||
              busy
            }
            isLoading={busy}
            onClick={enroll}
          >
            Capturar {Math.min(count + 1, 3)} de 3
          </Button>
        )}
        <Button
          variant={testOnly ? "primary" : "secondary"}
          isDisabled={!ready || count !== 3 || !person.active || busy}
          isLoading={busy}
          onClick={testFace}
        >
          Probar rostro · sin fichar
        </Button>
        {!testOnly && (
          <Button variant="danger" isDisabled={!count || busy} onClick={revoke}>
            Revocar catálogo
          </Button>
        )}
      </div>
    </Dialog>
  );
}
export function Kiosk() {
  const id = location.pathname.split("/").at(-1),
    storage = `cr-terminal-${id}`,
    token =
      new URLSearchParams(location.hash.slice(1)).get("token") ||
      sessionStorage.getItem(storage) ||
      "";
  if (token) sessionStorage.setItem(storage, token);
  const video = useRef(),
    [state, setState] = useState("loading"),
    [text, setText] = useState("Preparando cámara"),
    [name, setName] = useState(""),
    [clock, setClock] = useState(new Date()),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let alive = true,
      stream;
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      headers = { "X-Terminal-Key": token },
      base = `/kiosk/${id}`;
    async function run() {
      try {
        const config = await api(`${base}/config`, { headers });
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error("La cámara requiere HTTPS o localhost.");
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
        if (!alive) return stream.getTracks().forEach((t) => t.stop());
        video.current.srcObject = stream;
        await video.current.play();
        let waiting = false,
          absent = 0;
        while (alive) {
          setState("idle");
          setName("");
          setText(waiting ? "Esperando a la próxima persona" : "");
          let detected;
          try {
            detected = await api(`${base}/detect`, {
              method: "POST",
              headers,
              body: { captures: snapshot(video.current) },
            });
          } catch (e) {
            if (alive) {
              setText(e.message);
              await wait(1500);
            }
            continue;
          }
          if (!alive) break;
          if (waiting) {
            absent = detected.absent ? absent + 1 : 0;
            if (absent >= 2) waiting = false;
            await wait(300);
            continue;
          }
          if (!detected.detected) {
            if (detected.multiple) setText("Una persona a la vez");
            await wait(250);
            continue;
          }
          setState("detected");
          await wait(config.detectionDelayMs);
          let stable = true;
          for (let n = 1; n <= 3 && alive; n++) {
            setText(String(n));
            await wait(config.countdownMs);
            const presence = await api(`${base}/detect`, {
              method: "POST",
              headers,
              body: { captures: snapshot(video.current) },
            }).catch(() => ({ detected: false }));
            if (!presence.detected) {
              stable = false;
              break;
            }
          }
          if (!alive) break;
          if (!stable) continue;
          setState("flash");
          setText("");
          const payload = {
            captures: snapshot(video.current),
            requestId: crypto.randomUUID(),
          };
          try {
            let result;
            try {
              result = await api(`${base}/mark`, {
                method: "POST",
                headers,
                body: payload,
              });
            } catch (first) {
              await wait(500);
              result = await api(`${base}/mark`, {
                method: "POST",
                headers,
                body: payload,
              });
            }
            if (!alive) break;
            setState("success");
            setName(result.personName);
            setText(
              result.duplicate
                ? "Fichada ya registrada"
                : `${format(result.direction)} registrada`,
            );
          } catch (e) {
            if (!alive) break;
            setState("failure");
            setText(e.message);
          }
          await wait(config.resultMs);
          waiting = true;
          absent = 0;
        }
      } catch (e) {
        if (alive) {
          setState("fatal");
          setText(e.message);
        }
      }
    }
    run();
    return () => {
      alive = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [retry]);
  return (
    <div className="kiosk">
      <header>
        <Brand className="kiosk-brand" />
        <div className="kiosk-time">
          <strong>{clock.toLocaleTimeString("es-AR")}</strong>
          <small>
            {clock.toLocaleDateString("es-AR", {
              day: "numeric",
              month: "long",
            })}
          </small>
        </div>
      </header>
      <main>
        <div className={`face-oval ${state}`}>
          <video ref={video} autoPlay muted playsInline />
          <div className="face-message" role="status">
            {state === "success" && <Check size={88} strokeWidth={3} />}
            {state === "failure" && <X size={88} strokeWidth={3} />}
            {name && <strong>{name}</strong>}
            <span className={/^\d$/.test(text) ? "countdown" : ""}>{text}</span>
            {state === "fatal" && (
              <Button onClick={() => setRetry((n) => n + 1)}>
                Reintentar cámara
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
