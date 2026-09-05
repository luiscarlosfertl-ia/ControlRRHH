import React from "react";

export function Brand({ className = "" }) {
  return (
    <div
      className={`brand ${className}`.trim()}
      role="img"
      aria-label="ControlRRHH · Personas, tiempo y equipos"
    >
      <img
        className="brand-logo brand-logo-horizontal"
        src="/branding/control-rrhh-horizontal.png"
        alt=""
        aria-hidden="true"
      />
      <img
        className="brand-logo brand-logo-mark"
        src="/branding/control-rrhh-mark.png"
        alt=""
        aria-hidden="true"
      />
    </div>
  );
}

export function CodexCredit({ compact = false }) {
  return (
    <span className={`codex-credit${compact ? " codex-credit-compact" : ""}`}>
      Desarrollado con <strong>Codex</strong>
    </span>
  );
}
