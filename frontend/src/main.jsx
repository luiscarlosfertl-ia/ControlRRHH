import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Button,
  TextInput,
  FormSelect,
  FormSelectOption,
  Checkbox,
  Pagination,
  DualListSelector,
  DualListSelectorPane,
  DualListSelectorList,
  DualListSelectorListItem,
  DualListSelectorControl,
  DualListSelectorControlsWrapper,
} from "@patternfly/react-core";
import { Table, Thead, Tbody, Tr, Th, Td } from "@patternfly/react-table";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Clock3,
  Layers,
  Umbrella,
  ScanFace,
  CircleCheck,
  Camera,
  Pencil,
  Settings2,
  ClipboardCheck,
  History,
  ArrowRight,
  ArrowLeft,
  Plus,
  Check,
  X,
  Link,
  LogOut,
  Menu,
  ChevronRight,
  CalendarRange,
  Timer,
  Building2,
  RefreshCw,
  Download,
  CircleHelp,
  MoveLeft,
  Ambulance,
} from "lucide-react";
import "@patternfly/react-core/dist/styles/base.css";
import "./styles.css";
import { api, query, today, format, labels } from "./api.js";
import { catalog } from "./catalog.js";
import {
  ResourceTable,
  Dialog,
  Editor,
  Detail,
  IconButton,
  ErrorBox,
  Relation,
  Field,
  Badge,
} from "./components.jsx";
import { FaceEnrollment, Kiosk } from "./FaceCamera.jsx";
import { CompanyPresets } from "./Presets.jsx";
import { ReviewEditor, ReviewHistory, PunchEvidence } from "./ReviewTools.jsx";
import { HelpCenter, Assistance } from "./Assistance.jsx";
import { viewSteps, viewHelp } from "./helpContent.js";
import { useViewNavigation } from "./navigation.js";
import { Reports } from "./Reports.jsx";
import { Brand, CodexCredit } from "./Brand.jsx";

const nav = [
  ["dashboard", "Resumen", LayoutDashboard],
  ["people", "Personas", Users],
  ["schedule", "Calendario", CalendarDays],
  ["punches", "Fichadas", Clock3],
  ["reviews", "Revisión de jornadas", ClipboardCheck],
  ["absences", "Vacaciones y ausencias", Umbrella],
  ["extensions", "Extensiones", Timer],
  ["groups", "Grupos y equipos", Layers],
  ["shifts", "Horarios", Clock3],
  ["patterns", "Rotaciones", RefreshCw],
  ["assignments", "Asignaciones", CalendarRange],
  ["holidays", "Feriados", CalendarDays],
  ["terminals", "Terminales FaceVision", ScanFace],
  ["audit", "Auditoría", History],
  ["settings", "Configuración", Settings2],
  ["help", "Asistencia y ayuda", CircleHelp],
  ["reports", "Informes", ClipboardCheck],
];
function App() {
  const [auth, setAuth] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    api("/auth/state")
      .then(setAuth)
      .catch((e) => setError(e.message));
  }, []);
  if (error)
    return (
      <div className="loading-screen">
        <ErrorBox error={error} />
        <Button onClick={() => location.reload()}>Reintentar</Button>
      </div>
    );
  if (!auth) return <div className="loading-screen">Cargando ControlRRHH…</div>;
  if (!auth.account)
    return (
      <Auth
        setup={auth.setupRequired}
        onSuccess={(account) => setAuth({ account })}
      />
    );
  return (
    <Workspace
      account={auth.account}
      onLogout={async () => {
        await api("/auth/logout", { method: "POST" });
        setAuth({ account: null, setupRequired: false });
      }}
    />
  );
}
function Auth({ setup, onSuccess }) {
  const [data, setData] = useState({ name: "", email: "", password: "" }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await api(`/auth/${setup ? "setup" : "login"}`, {
        method: "POST",
        body: data,
      });
      onSuccess(result.account);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <aside>
        <Brand />
        <div>
          <span className="eyebrow">PERSONAS · TIEMPO · EQUIPOS</span>
          <h1>
            El tiempo de tu equipo,
            <br />
            <em>en un mismo lugar.</em>
          </h1>
          <p>
            Planificá jornadas. Acompañá a las personas.
            <br />
            Transformá fichadas en información clara.
          </p>
          <div className="auth-illustration">
            <div className="mock-avatar">CR</div>
            <div>
              <strong>Una jornada más simple</strong>
              <span>Planificación → Fichaje → Revisión</span>
            </div>
            <Check />
          </div>
        </div>
        <small>
          ControlRRHH · Aplicación independiente · <CodexCredit compact />
        </small>
      </aside>
      <main>
        <form onSubmit={submit}>
          <span className="eyebrow">BIENVENIDO A CONTROLRRHH</span>
          <h2>{setup ? "Creá tu administración" : "Iniciar sesión"}</h2>
          <p>
            {setup
              ? "Elegí las credenciales de esta nueva aplicación. No utiliza cuentas de Origen Ingenio."
              : "Ingresá para administrar personas y jornadas."}
          </p>
          <ErrorBox error={error} />
          {setup && (
            <label>
              Tu nombre
              <TextInput
                aria-label="Tu nombre"
                value={data.name}
                onChange={(_, v) => setData({ ...data, name: v })}
                isRequired
              />
            </label>
          )}
          <label>
            Correo de administración
            <TextInput
              type="email"
              aria-label="Correo de administración"
              value={data.email}
              onChange={(_, v) => setData({ ...data, email: v })}
              isRequired
            />
          </label>
          <label>
            Contraseña
            <TextInput
              type="password"
              aria-label="Contraseña"
              value={data.password}
              onChange={(_, v) => setData({ ...data, password: v })}
              isRequired
              autoComplete={setup ? "new-password" : "current-password"}
            />
            {setup && (
              <small>
                Mínimo 12 caracteres. No hay contraseña predeterminada.
              </small>
            )}
          </label>
          <Button type="submit" isBlock isLoading={busy} isDisabled={busy}>
            {setup ? "Crear administración" : "Ingresar"}
            <ArrowRight size={17} />
          </Button>
          <div className="auth-foot">
            <ScanFace size={18} /> Fichaje FaceVision independiente de la sesión
            administrativa.
          </div>
        </form>
      </main>
    </div>
  );
}
export function Workspace({ account, onLogout }) {
  const { view, go, back, canBack } = useViewNavigation(nav.map((x) => x[0]));
  const [collapsed, setCollapsed] = useState(false),
    [run, setRun] = useState(null);
  const navigate = (name) => {
    if (go(name) !== false) setRun(null);
  };
  const start = (steps, title) => {
    if (go(steps[0].view) === false) return;
    setRun({ steps, title });
  };
  const item = nav.find((x) => x[0] === view) || nav[0];
  return (
    <div className={`app-shell ${collapsed ? "nav-collapsed" : ""}`}>
      <aside className="sidebar">
        <Brand />
        <div className="workspace-name">
          <span className="workspace-icon">
            <Building2 size={18} />
          </span>
          <div>
            <strong>Mi organización</strong>
            <small>Gestión de personas</small>
          </div>
        </div>
        <nav>
          {nav.map(([key, label, Icon], i) => (
            <React.Fragment key={key}>
              {[0, 7, 12].includes(i) && (
                <span className="nav-section">
                  {i === 0
                    ? "ESPACIO DE TRABAJO"
                    : i === 7
                      ? "PLANIFICACIÓN"
                      : "ADMINISTRACIÓN"}
                </span>
              )}
              <button
                className={view === key ? "active" : ""}
                onClick={() => navigate(key)}
              >
                <Icon size={18} />
                <span>{label}</span>
                {view === key && <span className="nav-dot" />}
              </button>
            </React.Fragment>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-status">
            <span className="online-dot" /> ControlRRHH <small>v0.1</small>
          </div>
          <CodexCredit compact />
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <IconButton
            title="Alternar navegación"
            onClick={() => setCollapsed((v) => !v)}
          >
            <Menu size={20} />
          </IconButton>
          <div className="breadcrumb">
            Mi organización <ChevronRight size={14} />
            <strong>{item[1]}</strong>
          </div>
          <div className="topbar-end">

          <IconButton
            title="Volver"
            isDisabled={!canBack}
            onClick={() => {
              setRun(null);
              back();
            }}
          >
            <MoveLeft size={20}/>
          </IconButton>
          <IconButton
            title="Paseo de esta vista"
            onClick={() =>
              start(viewSteps(view), `Paseo · ${viewHelp[view].title}`)
            }
          >
            <Ambulance size={20} />
          </IconButton>

            <span className="today-label">
              {new Date().toLocaleDateString("es-AR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <span className="user-avatar">{account.name?.slice(0, 1)}</span>
            <div className="user-info">
              <strong>{account.name}</strong>
              <small>Administración</small>
            </div>
            <IconButton title="Cerrar sesión" onClick={onLogout}>
              <LogOut size={17} />
            </IconButton>
          </div>
        </header>
        {/* <div className="assistance-bar" aria-label="Navegación y asistencia">

          <IconButton
            title="Volver"
            isDisabled={!canBack}
            onClick={() => {
              setRun(null);
              back();
            }}
          >
            <MoveLeft size={20}/>
          </IconButton>
          <IconButton
            title="Paseo de esta vista"
            onClick={() =>
              start(viewSteps(view), `Paseo · ${viewHelp[view].title}`)
            }
          >
            <Ambulance size={20} />
          </IconButton>
        </div> */}
        <main
          className="workspace-content"
          data-active-view={view}
          data-help="view-content"
        >
          {view === "reports" ? (
            <Reports />
          ) : view === "help" ? (
            <HelpCenter go={navigate} start={start} />
          ) : view === "dashboard" ? (
            <Dashboard go={navigate} name={account.name} />
          ) : view === "schedule" ? (
            <Schedule />
          ) : view === "settings" ? (
            <Settings />
          ) : (
            <ResourcePage
              key={view}
              resource={catalog[view] ? view : "people"}
              go={navigate}
            />
          )}
        </main>
        <Assistance view={view} go={go} run={run} setRun={setRun} />
      </div>
    </div>
  );
}
function PageHeading({ eyebrow, title, description, children }) {
  return (
    <div className="page-heading" data-help="heading">
      <div>
        <span className="eyebrow">{eyebrow || "GESTIÓN DE PERSONAS"}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="toolbar-actions">{children}</div>
    </div>
  );
}
function Dashboard({ go, name }) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    api("/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <PageHeading
        eyebrow="TU DÍA, EN PERSPECTIVA"
        title={`Hola, ${name.split(" ")[0]}`}
        description="Una mirada clara al tiempo y a las personas de tu organización."
      >
        <Button
          variant="secondary"
          onClick={() => go("schedule")}
          icon={<CalendarDays size={17} />}
        >
          Ver calendario
        </Button>
        <Button onClick={() => go("people")} icon={<Plus size={17} />}>
          Administrar personas
        </Button>
      </PageHeading>
      <ErrorBox error={error} />
      <div className="kpi-grid">
        {[
          [
            Users,
            "Personas activas",
            data?.people,
            "Legajos de la organización",
            "people",
          ],
          [
            Clock3,
            "Entradas abiertas",
            data?.present,
            "Última fichada de entrada",
            "punches",
          ],
          [
            ClipboardCheck,
            "Jornadas por revisar",
            data?.review,
            "Esperan tu validación",
            "reviews",
          ],
          [
            Umbrella,
            "Solicitudes pendientes",
            data?.requests,
            "Vacaciones y ausencias",
            "absences",
          ],
        ].map(([Icon, label, value, subtitle, target], i) => (
          <button
            className={`kpi-card kpi-${i}`}
            key={label}
            onClick={() => go(target)}
          >
            <div>
              <span>{label}</span>
              <Icon size={20} />
            </div>
            <strong>{value ?? "—"}</strong>
            <small>
              {subtitle}
              <ArrowRight size={14} />
            </small>
          </button>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>La operación, paso a paso</h2>
              <p>Cada etapa conserva su propia información.</p>
            </div>
          </div>
          <div className="workflow-cards">
            {[
              [
                CalendarDays,
                "01",
                "Planificá",
                "Horarios, rotaciones y equipos.",
                "schedule",
              ],
              [
                ScanFace,
                "02",
                "Registrá",
                "FaceVision o marcación supervisada.",
                "terminals",
              ],
              [
                ClipboardCheck,
                "03",
                "Revisá",
                "Jornadas, diferencias y autorizaciones.",
                "reviews",
              ],
            ].map(([Icon, number, title, subtitle, target]) => (
              <button key={title} onClick={() => go(target)}>
                <div>
                  <Icon size={24} />
                  <span>{number}</span>
                </div>
                <h3>{title}</h3>
                <p>{subtitle}</p>
                <ArrowRight size={17} />
              </button>
            ))}
          </div>
          <div className="pending-banner">
            <span className="pending-icon">
              <Timer size={22} />
            </span>
            <div>
              <strong>{data?.pending || 0} fichadas sin procesar</strong>
              <p>El cálculo de turnos se realiza después del fichaje.</p>
            </div>
            <Button variant="link" onClick={() => go("punches")}>
              Ir a fichadas <ArrowRight size={16} />
            </Button>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Accesos rápidos</h2>
              <p>Lo que necesitás, a mano.</p>
            </div>
          </div>
          <div className="quick-links">
            {[
              [
                "people",
                Users,
                "Directorio de personas",
                "Legajos y registro facial",
              ],
              [
                "absences",
                Umbrella,
                "Vacaciones y permisos",
                "Solicitudes y aprobaciones",
              ],
              [
                "terminals",
                ScanFace,
                "Terminales de fichaje",
                "Cámaras y enlaces privados",
              ],
              [
                "settings",
                Settings2,
                "Reglas de cómputo",
                "Políticas genéricas configurables",
              ],
            ].map(([target, Icon, title, description]) => (
              <button key={target} onClick={() => go(target)}>
                <span>
                  <Icon size={19} />
                </span>
                <div>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </div>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
        </section>
      </div>
      <section className="panel recent-panel">
        <div className="panel-heading">
          <div>
            <h2>Últimos movimientos</h2>
            <p>Fichadas de hoy, en tiempo del servidor.</p>
          </div>
          <Button variant="link" onClick={() => go("punches")}>
            Ver todas <ArrowRight size={15} />
          </Button>
        </div>
        {data?.latest.length ? (
          <div className="activity-list">
            {data.latest.map((p) => (
              <div key={p._id}>
                <span className="mini-avatar">{p.personName.slice(0, 1)}</span>
                <strong>{p.personName}</strong>
                <Badge value={p.direction} />
                <span>{format(p.occurredAt, "occurredAt")}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-activity">
            <Clock3 size={28} />
            <div>
              <strong>Todavía no hay movimientos de hoy</strong>
              <p>Las nuevas fichadas aparecerán aquí.</p>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
function ResourcePage({ resource, go }) {
  const [editor, setEditor] = useState(null),
    [detail, setDetail] = useState(null),
    [face, setFace] = useState(null),
    [group, setGroup] = useState(null),
    [link, setLink] = useState(""),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [processing, setProcessing] = useState(false),
    [manual, setManual] = useState(false),
    [all, setAll] = useState(false),
    [reviewDecision, setReviewDecision] = useState(null);
  const [reviewEdit, setReviewEdit] = useState(null),
    [reviewHistory, setReviewHistory] = useState(null),
    [evidence, setEvidence] = useState(null);
  const config = catalog[resource],
    mutable = !["punches", "reviews", "audit"].includes(resource),
    reload = () => setRevision((n) => n + 1);
  async function decision(row, status) {
    try {
      await api(`/${resource}/${row._id}/decision`, {
        method: "POST",
        body: { status },
      });
      reload();
    } catch (e) {
      setError(e.message);
    }
  }
  async function getLink(row) {
    if (
      !confirm(
        "Se generará un enlace privado nuevo. Los enlaces anteriores de esta terminal dejarán de funcionar.",
      )
    )
      return;
    try {
      const result = await api(`/terminals/${row._id}/link`, {
        method: "POST",
      });
      setLink(location.origin + result.path);
    } catch (e) {
      setError(e.message);
    }
  }
  const actions = (row) => (
    <>
      {resource === "punches" && (
        <IconButton
          title={
            row.hasCapture ? "Ver captura de fichada" : "Sin captura guardada"
          }
          isDisabled={!row.hasCapture}
          onClick={() => setEvidence(row)}
        >
          <Camera size={17} />
        </IconButton>
      )}
      {resource === "reviews" && (
        <>
          <IconButton
            title="Editar jornada con auditoría"
            isDisabled={row.status !== "review"}
            onClick={() => setReviewEdit(row)}
          >
            <Pencil size={17} />
          </IconButton>
          <IconButton
            title="Auditoría de edición manual"
            isDisabled={!row.manuallyEdited}
            onClick={() => setReviewHistory(row)}
          >
            <History size={17} />
          </IconButton>
        </>
      )}
      {resource === "people" && (
        <>
          <IconButton title="Registrar rostros" onClick={() => setFace(row)}>
            <ScanFace size={17} />
          </IconButton>
          <IconButton
            title="Probar rostro · sin fichar"
            isDisabled={!row.active || row.faceCount !== 3}
            onClick={() => setFace({ ...row, testOnly: true })}
          >
            <CircleCheck size={17} />
          </IconButton>
        </>
      )}
      {resource === "groups" && (
        <IconButton title="Asignar personas" onClick={() => setGroup(row)}>
          <Users size={17} />
        </IconButton>
      )}
      {resource === "terminals" && (
        <IconButton title="Generar enlace privado" onClick={() => getLink(row)}>
          <Link size={17} />
        </IconButton>
      )}
      {["absences", "extensions"].includes(resource) && (
        <>
          <IconButton
            title="Aprobar solicitud"
            isDisabled={row.status === "approved"}
            onClick={() => decision(row, "approved")}
          >
            <Check size={17} />
          </IconButton>
          <IconButton
            title="Rechazar solicitud"
            isDisabled={row.status === "rejected"}
            onClick={() => decision(row, "rejected")}
          >
            <X size={17} />
          </IconButton>
        </>
      )}
      {resource === "reviews" && (
        <IconButton
          title={
            row.status === "approved" ? "Reabrir revisión" : "Aprobar jornada"
          }
          onClick={() => setReviewDecision(row)}
        >
          {row.status === "approved" ? (
            <RefreshCw size={17} />
          ) : (
            <Check size={17} />
          )}
        </IconButton>
      )}
    </>
  );
  return (
    <>
      <PageHeading title={config.title} description={config.description} />
      {resource === "reviews" && (
        <div className="info-strip">
          <ClipboardCheck size={17} />
          Las jornadas aprobadas requieren reapertura para editar. Las
          correcciones manuales quedan auditadas y se conservan al reprocesar.
        </div>
      )}
      <ErrorBox error={error} />
      {notice && (
        <div className="success-notice" role="status">
          {notice}
        </div>
      )}
      <ResourceTable
        resource={resource}
        refresh={revision}
        params={resource === "punches" ? { pending: String(!all) } : {}}
        onCreate={mutable ? () => setEditor({}) : undefined}
        onEdit={
          mutable && !["absences", "extensions"].includes(resource)
            ? (row) => setEditor(row)
            : undefined
        }
        onView={setDetail}
        extraActions={actions}
        toolbar={
          resource === "punches" ? (
            <>
              <Checkbox
                id="all-punches"
                label="Incluir procesadas"
                isChecked={all}
                onChange={(_, v) => setAll(v)}
              />
              <Button variant="secondary" onClick={() => go("terminals")}>
                Terminales
              </Button>
              <Button variant="secondary" onClick={() => setManual(true)}>
                Registro supervisado
              </Button>
              <Button onClick={() => setProcessing(true)}>Procesar</Button>
            </>
          ) : null
        }
      />
      {editor && (
        <Editor
          resource={resource}
          record={editor._id ? editor : null}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            reload();
          }}
        />
      )}
      {detail &&
        (resource === "reviews" ? (
          <ReviewDetail
            row={detail}
            onClose={() => setDetail(null)}
            onSaved={reload}
          />
        ) : (
          <Detail
            resource={resource}
            row={detail}
            onClose={() => setDetail(null)}
          />
        ))}
      {face && (
        <FaceEnrollment
          person={face}
          testOnly={Boolean(face.testOnly)}
          onClose={() => setFace(null)}
          onSaved={reload}
        />
      )}
      {reviewEdit && (
        <ReviewEditor
          row={reviewEdit}
          onClose={() => setReviewEdit(null)}
          onSaved={() => {
            setReviewEdit(null);
            reload();
          }}
        />
      )}
      {reviewHistory && (
        <ReviewHistory
          row={reviewHistory}
          onClose={() => setReviewHistory(null)}
        />
      )}
      {evidence && (
        <PunchEvidence row={evidence} onClose={() => setEvidence(null)} />
      )}
      {group && (
        <GroupMembers
          group={group}
          onClose={() => setGroup(null)}
          onSaved={reload}
        />
      )}
      {link && (
        <Dialog
          title="Enlace privado de la terminal"
          onClose={() => setLink("")}
        >
          <p>
            Copialo sólo al dispositivo autorizado. Para una tablet se necesita
            HTTPS confiable en ambos dispositivos.
          </p>
          <TextInput aria-label="Enlace privado" value={link} readOnly />
          <div className="toolbar-actions">
            <Button
              onClick={() =>
                navigator.clipboard
                  .writeText(link)
                  .then(() => setNotice("Enlace copiado."))
                  .catch(() =>
                    setError("Seleccioná y copiá el enlace manualmente."),
                  )
              }
            >
              Copiar enlace
            </Button>
            <Button
              component="a"
              href={link}
              target="_blank"
              rel="noreferrer"
              variant="secondary"
            >
              Abrir terminal
            </Button>
          </div>
        </Dialog>
      )}
      {processing && (
        <ProcessDialog
          onClose={() => setProcessing(false)}
          onDone={(d) => {
            setNotice(
              `${d.updated} jornadas calculadas. ${d.preserved} aprobadas conservadas.`,
            );
            setProcessing(false);
            reload();
          }}
        />
      )}
      {manual && (
        <ManualDialog
          onClose={() => setManual(false)}
          onDone={() => {
            setManual(false);
            reload();
          }}
        />
      )}
      {reviewDecision && (
        <ReviewDecision
          row={reviewDecision}
          onClose={() => setReviewDecision(null)}
          onDone={() => {
            setReviewDecision(null);
            reload();
          }}
        />
      )}
    </>
  );
}
function ProcessDialog({ onClose, onDone }) {
  const [from, setFrom] = useState(today().slice(0, 7) + "-01"),
    [to, setTo] = useState(today()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run() {
    setBusy(true);
    try {
      onDone(
        await api("/attendance/process", {
          method: "POST",
          body: { from, to },
        }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Procesar fichadas"
      onClose={onClose}
      footer={
        <Button isLoading={busy} isDisabled={busy} onClick={run}>
          Calcular jornadas
        </Button>
      }
    >
      <ErrorBox error={error} />
      <p>
        Hasta 31 días por ejecución. Los resultados quedan en revisión; las
        entradas abiertas continúan pendientes.
      </p>
      <div className="form-grid">
        <label>
          Desde
          <TextInput
            type="date"
            aria-label="Procesar desde"
            value={from}
            onChange={(_, v) => setFrom(v)}
          />
        </label>
        <label>
          Hasta
          <TextInput
            type="date"
            aria-label="Procesar hasta"
            value={to}
            onChange={(_, v) => setTo(v)}
          />
        </label>
      </div>
    </Dialog>
  );
}
function ManualDialog({ onClose, onDone }) {
  const [data, setData] = useState({
      personId: "",
      occurredAt: "",
      direction: "in",
      reason: "",
      requestId: crypto.randomUUID(),
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await api("/attendance/manual", {
        method: "POST",
        body: { ...data, occurredAt: new Date(data.occurredAt).toISOString() },
      });
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Registro supervisado"
      onClose={onClose}
      footer={
        <Button isDisabled={busy} onClick={save}>
          Guardar evidencia
        </Button>
      }
    >
      <ErrorBox error={error} />
      <div className="form-grid">
        <label className="full-field">
          Persona
          <Relation
            resource="people"
            value={data.personId}
            onChange={(v) => setData({ ...data, personId: v })}
          />
        </label>
        <label>
          Fecha y hora local
          <TextInput
            aria-label="Fecha y hora"
            type="datetime-local"
            step="1"
            value={data.occurredAt}
            onChange={(_, v) => setData({ ...data, occurredAt: v })}
          />
        </label>
        <label>
          Movimiento
          <FormSelect
            aria-label="Movimiento"
            value={data.direction}
            onChange={(_, v) => setData({ ...data, direction: v })}
          >
            <FormSelectOption value="in" label="Entrada" />
            <FormSelectOption value="out" label="Salida" />
          </FormSelect>
        </label>
        <label className="full-field">
          Motivo
          <TextInput
            aria-label="Motivo"
            value={data.reason}
            onChange={(_, v) => setData({ ...data, reason: v })}
          />
        </label>
      </div>
    </Dialog>
  );
}
function ReviewDecision({ row, onClose, onDone }) {
  const [notes, setNotes] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await api(`/reviews/${row._id}/decision`, {
        method: "POST",
        body: {
          status: row.status === "approved" ? "review" : "approved",
          notes,
        },
      });
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={row.status === "approved" ? "Reabrir jornada" : "Aprobar jornada"}
      onClose={onClose}
      footer={
        <Button isDisabled={busy} onClick={save}>
          Confirmar
        </Button>
      }
    >
      <ErrorBox error={error} />
      <p>
        {row.personName} · {row.date}
      </p>
      <p>{row.anomalies.join(" · ")}</p>
      <label>
        Observaciones
        <TextInput
          aria-label="Observaciones de revisión"
          value={notes}
          onChange={(_, v) => setNotes(v)}
        />
      </label>
    </Dialog>
  );
}
function ReviewDetail({ row: initialRow, onClose, onSaved, planned }) {
  const [row, setRow] = useState(initialRow),
    [editing, setEditing] = useState(false),
    [history, setHistory] = useState(false);
  const zone = row.policy?.timeZone || "UTC";
  const localMinute = (iso) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .format(iso instanceof Date ? iso : new Date(iso))
      .split(":")
      .map(Number);
    return parts[0] * 60 + parts[1];
  };
  return (
    <Dialog title={`${row.personName} · ${row.date}`} wide onClose={onClose}>
      <div className="toolbar-actions">
        <Button
          variant="secondary"
          isDisabled={row.status !== "review"}
          onClick={() => setEditing(true)}
        >
          Editar con auditoría
        </Button>
        <Button
          variant="link"
          isDisabled={!row.manuallyEdited}
          onClick={() => setHistory(true)}
        >
          Historial manual
        </Button>
      </div>
      <p>
        Planificado:{" "}
        {planned?.name ||
          row.policy?.shift?.name ||
          row.shiftName ||
          "Sin turno"}{" "}
        · {planned?.start || row.policy?.shift?.start || "—"} –{" "}
        {planned?.end || row.policy?.shift?.end || "—"}
      </p>
      {row.manuallyEdited && (
        <div className="info-strip">
          Edición manual auditada · las fichadas originales no se modificaron.
        </div>
      )}
      <div className="review-metrics">
        {[
          ["workedMinutes", "Presencia"],
          ["normalMinutes", "Normales"],
          ["outsideMinutes", "Fuera de turno"],
          ["extra50Minutes", "Extra 50%"],
          ["extra100Minutes", "Extra 100%"],
        ].map(([key, label]) => (
          <div key={key}>
            <small>{label}</small>
            <strong>{format(row[key], key)}</strong>
          </div>
        ))}
      </div>
      <p>
        {row.shiftName} · <Badge value={row.status} />
      </p>
      <div className="gantt-axis">
        {[0, 6, 12, 18, 24].map((h) => (
          <span key={h}>{h}:00</span>
        ))}
      </div>
      <div className="gantt-track">
        {row.segments.map((s, i) => {
          const start = localMinute(s.start),
            startsNextDay =
              new Intl.DateTimeFormat("en-CA", {
                timeZone: zone,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(new Date(s.start)) > row.date,
            duration = (+new Date(s.end) - +new Date(s.start)) / 60000,
            width = Math.min(duration, 1440 - start);
          return (
            <React.Fragment key={i}>
              <div
                className={`gantt-bar ${s.kind}${startsNextDay ? " next-day" : ""}`}
                style={{ left: `${start / 14.4}%`, width: `${width / 14.4}%` }}
                title={`${labels[s.kind]}: ${new Date(s.start).toLocaleString()} – ${new Date(s.end).toLocaleString()}`}
              />
              {duration > width && (
                <div
                  className={`gantt-bar ${s.kind} next-day`}
                  style={{ left: 0, width: `${(duration - width) / 14.4}%` }}
                  title="Continuación del día siguiente"
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div className="legend">
        {["normal", "outside", "extra50", "extra100"].map((k) => (
          <span key={k}>
            <i className={k} />
            {labels[k]}
          </span>
        ))}
      </div>
      <p>El tramo inferior indica continuación después de medianoche.</p>
      <dl className="detail-grid">
        <div>
          <dt>Llegada tardía</dt>
          <dd>{format(row.lateMinutes, "lateMinutes")}</dd>
        </div>
        <div>
          <dt>Salida anticipada</dt>
          <dd>{format(row.earlyMinutes, "earlyMinutes")}</dd>
        </div>
        <div>
          <dt>Ausencia</dt>
          <dd>{format(row.absence)}</dd>
        </div>
        <div>
          <dt>Incidencias</dt>
          <dd>{row.anomalies.join(" · ") || "Sin incidencias"}</dd>
        </div>
      </dl>
      {editing && (
        <ReviewEditor
          row={row}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setRow(saved);
            setEditing(false);
            onSaved?.();
          }}
        />
      )}
      {history && <ReviewHistory row={row} onClose={() => setHistory(false)} />}
    </Dialog>
  );
}
function Schedule() {
  const [month, setMonth] = useState(today().slice(0, 7)),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [data, setData] = useState({ people: [], total: 0 }),
    [error, setError] = useState(""),
    [detail, setDetail] = useState(null),
    [revision, setRevision] = useState(0);
  const days = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5)),
    0,
  ).getDate();
  useEffect(() => {
    let live = true;
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    api(
      `/schedule?${query({ from: month + "-01", to: `${month}-${days}`, page, search })}`,
    )
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [month, search, page, revision]);
  return (
    <>
      <PageHeading
        title="Calendario del equipo"
        description="Una sola vista: horario planificado y resultado procesado en cada día. Abrí la celda para revisar o editar."
      />
      <div className="panel">
        <div className="table-toolbar" data-help="calendar-controls">
          <TextInput
            aria-label="Buscar persona"
            placeholder="Buscar persona…"
            value={search}
            onChange={(_, v) => {
              setSearch(v);
              setPage(1);
            }}
          />
            <Button
              variant="secondary"
              onClick={() => setRevision((n) => n + 1)}
            >
              Actualizar
            </Button>
          <div className="toolbar-actions">

            <TextInput
              type="month"
              aria-label="Mes"
              value={month}
              onChange={(_, v) => {
                setMonth(v);
                setPage(1);
              }}
            />
          </div>
        </div>
        <ErrorBox error={error} />
        <div className="calendar-scroll" data-help="calendar">
          <Table aria-label="Calendario mensual" variant="compact">
            <Thead>
              <Tr>
                <Th className="calendar-person">Persona</Th>
                {Array.from({ length: days }, (_, i) => (
                  <Th key={i}>
                    <span className="calendar-day">
                      {i + 1}
                      <small>
                        {new Date(
                          `${month}-${String(i + 1).padStart(2, "0")}T12:00:00`,
                        ).toLocaleDateString("es", { weekday: "narrow" })}
                      </small>
                    </span>
                  </Th>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {data.people.map((person) => (
                <Tr key={person._id}>
                  <Td className="calendar-person">
                    <strong>{person.name}</strong>
                    <small>Legajo {person.employeeNumber}</small>
                  </Td>
                  {person.days.map((day) => (
                    <Td key={day.date}>
                      <button
                        className={`calendar-slot unified ${day.schedule?.conflict || day.review?.anomalies?.length ? "conflict" : day.schedule?.intervals.length ? "assigned" : ""}`}
                        aria-label={`${person.name} · ${day.date} · ${day.review ? "Procesado" : "Sin procesar"}`}
                        onClick={() => setDetail({ person, day })}
                      >
                        <span className="calendar-planned">
                          {day.schedule?.conflict
                            ? "Conflicto"
                            : day.schedule?.rest
                              ? "Descanso"
                              : day.schedule?.start
                                ? `${day.schedule.start}–${day.schedule.end}`
                                : "Sin turno"}
                        </span>
                        {day.absence && <small>{format(day.absence)}</small>}
                        <span
                          className={`calendar-actual ${day.review?.status === "approved" ? "approved" : ""}`}
                        >
                          {day.review
                            ? format(day.review.workedMinutes, "workedMinutes")
                            : "Sin procesar"}
                        </span>
                        {day.review && (
                          <small>
                            {day.review.status === "approved"
                              ? "Aprobado"
                              : "En revisión"}
                            {day.review.manuallyEdited ? " · Manual" : ""}
                          </small>
                        )}
                      </button>
                    </Td>
                  ))}
                </Tr>
              ))}
            </Tbody>
          </Table>
          {!data.people.length && (
            <div className="empty-state">
              Agregá personas y asignaciones para comenzar a planificar.
            </div>
          )}
        </div>
        <Pagination
          itemCount={data.total}
          perPage={50}
          perPageOptions={[{ title: "50", value: 50 }]}
          page={page}
          onSetPage={(_, v) => setPage(v)}
          isCompact
        />
      </div>
      {detail &&
        (detail.day.review ? (
          <ReviewDetail
            row={detail.day.review}
            planned={detail.day.schedule}
            onSaved={() => setRevision((n) => n + 1)}
            onClose={() => setDetail(null)}
          />
        ) : (
          <Dialog
            title={`${detail.person.name} · ${detail.day.date}`}
            onClose={() => setDetail(null)}
          >
            <h3>{detail.day.schedule?.name || "Sin turno"}</h3>
            <p>
              {detail.day.schedule?.start} – {detail.day.schedule?.end}
            </p>
            <p>{format(detail.day.absence)}</p>
            <p>{detail.day.schedule?.holiday || ""}</p>
            <p>{detail.day.schedule?.assignment?.name}</p>
          </Dialog>
        ))}
    </>
  );
}
function Settings() {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    api("/settings")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  const fields = [
    { key: "companyName", label: "Organización", type: "text" },
    { key: "timeZone", label: "Zona horaria IANA", type: "text" },
    {
      key: "maxPairHours",
      label: "Máximo de horas entre entrada y salida",
      type: "number",
    },
    {
      key: "leaveCountMode",
      label: "Cómputo de licencias",
      type: "select",
      options: ["calendar", "working"],
    },
    {
      key: "extra100Weekdays",
      label: "Días con categoría extra 100% (ninguno = genérico)",
      type: "weekdays",
    },
    {
      key: "saturday100From",
      label: "Sábados: extra 100% desde (opcional)",
      type: "time",
    },
    {
      key: "countHolidayAs100",
      label: "Categorizar extras autorizadas en feriados al 100%",
      type: "boolean",
    },
  ];
  return (
    <>
      <PageHeading
        title="Configuración"
        description="Políticas genéricas. No se aplica automáticamente ningún convenio laboral."
      />
      <div className="panel settings-panel" data-help="settings">
        <ErrorBox error={error} />
        {saved && <div className="success-notice">Configuración guardada.</div>}
        {data && (
          <>
            <div className="form-grid">
              {fields.map((field) => (
                <div
                  key={field.key}
                  className={field.type === "weekdays" ? "full-field" : ""}
                >
                  <label>{field.label}</label>
                  <Field
                    field={field}
                    value={data[field.key]}
                    onChange={(v) => {
                      setData({ ...data, [field.key]: v });
                      setSaved(false);
                    }}
                  />
                </div>
              ))}
            </div>
            <p className="muted">
              calendar = días corridos · working = días con turno asignado, sin
              feriados. Las extras requieren una extensión aprobada.
            </p>
            <Button
              onClick={() =>
                api("/settings", { method: "PUT", body: data })
                  .then(() => setSaved(true))
                  .catch((e) => setError(e.message))
              }
            >
              Guardar reglas
            </Button>
          </>
        )}
      </div>
      <CompanyPresets />
    </>
  );
}
function GroupMembers({ group, onClose, onSaved }) {
  const [source, setSource] = useState({ items: [], total: 0 }),
    [target, setTarget] = useState({ items: [], total: 0 }),
    [sourcePage, setSourcePage] = useState(1),
    [targetPage, setTargetPage] = useState(1),
    [search, setSearch] = useState(""),
    [targetSearch, setTargetSearch] = useState(""),
    [selected, setSelected] = useState(null),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    api(
      `/resources/people?${query({ search, page: sourcePage, sort: "employeeNumber", direction: "asc" })}`,
    )
      .then((d) => live && setSource(d))
      .catch((e) => live && setError(e.message));
    api(
      `/resources/people?${query({ search: targetSearch, page: targetPage, filters: { groupId: [group._id] }, sort: "employeeNumber", direction: "asc" })}`,
    )
      .then((d) => live && setTarget(d))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [sourcePage, targetPage, search, targetSearch, version]);
  async function move(add) {
    if (!selected) return;
    if (
      add &&
      selected.groupId &&
      selected.groupId !== group._id &&
      !confirm("La persona pertenece a otro grupo. ¿Cambiar su grupo?")
    )
      return;
    setBusy(true);
    try {
      await api(`/resources/people/${selected._id}`, {
        method: "PUT",
        body: { ...selected, groupId: add ? group._id : "" },
      });
      setSelected(null);
      setVersion((v) => v + 1);
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={`Personas · ${group.name}`} wide onClose={onClose}>
      <ErrorBox error={error} />
      <DualListSelector>
        <DualListSelectorPane
          title="Personas disponibles"
          actions={[
            <Pagination
              key="source-pages"
              widgetId="source-pages"
              itemCount={source.total}
              page={sourcePage}
              perPage={50}
              perPageOptions={[{ title: "50", value: 50 }]}
              onSetPage={(_, v) => setSourcePage(v)}
              isCompact
            />,
          ]}
          searchInput={
            <TextInput
              aria-label="Buscar personas disponibles"
              value={search}
              onChange={(_, v) => {
                setSearch(v);
                setSourcePage(1);
              }}
            />
          }
        >
          <DualListSelectorList>
            {source.items.map((p) => (
              <DualListSelectorListItem
                id={`source-${p._id}`}
                key={p._id}
                isDisabled={p.groupId === group._id}
                isSelected={selected?._id === p._id}
                onOptionSelect={() => setSelected(p)}
              >
                {p.employeeNumber} · {p.name}
              </DualListSelectorListItem>
            ))}
          </DualListSelectorList>
        </DualListSelectorPane>
        <DualListSelectorControlsWrapper>
          <DualListSelectorControl
            aria-label="Asignar al grupo"
            icon={<ArrowRight size={18} />}
            isDisabled={busy || !selected || selected.groupId === group._id}
            onClick={() => move(true)}
          />
          <DualListSelectorControl
            aria-label="Quitar del grupo"
            icon={<ArrowLeft size={18} />}
            isDisabled={busy || !selected || selected.groupId !== group._id}
            onClick={() => move(false)}
          />
        </DualListSelectorControlsWrapper>
        <DualListSelectorPane
          title={group.name}
          isChosen
          actions={[
            <Pagination
              key="target-pages"
              widgetId="target-pages"
              itemCount={target.total}
              page={targetPage}
              perPage={50}
              perPageOptions={[{ title: "50", value: 50 }]}
              onSetPage={(_, v) => setTargetPage(v)}
              isCompact
            />,
          ]}
          searchInput={
            <TextInput
              aria-label="Buscar personas asignadas"
              value={targetSearch}
              onChange={(_, v) => {
                setTargetSearch(v);
                setTargetPage(1);
              }}
            />
          }
        >
          <DualListSelectorList>
            {target.items.map((p) => (
              <DualListSelectorListItem
                id={`target-${p._id}`}
                key={p._id}
                isSelected={selected?._id === p._id}
                onOptionSelect={() => setSelected(p)}
              >
                {p.employeeNumber} · {p.name}
              </DualListSelectorListItem>
            ))}
          </DualListSelectorList>
        </DualListSelectorPane>
      </DualListSelector>
      <p className="muted">
        Asignar no elimina a la persona de la lista de origen: queda
        deshabilitada hasta quitarla del grupo.
      </p>
    </Dialog>
  );
}
createRoot(document.getElementById("root")).render(
  location.pathname.startsWith("/kiosk/") ? <Kiosk /> : <App />,
);
