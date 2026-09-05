import React, { useEffect, useState, useId } from "react";
import { createPortal } from "react-dom";
import {
  Button,
  TextInput,
  TextArea,
  FormSelect,
  FormSelectOption,
  Checkbox,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Pagination,
  Alert,
  Label,
  Spinner,
} from "@patternfly/react-core";
import { Table, Thead, Tbody, Tr, Th, Td } from "@patternfly/react-table";
import {
  Search,
  Filter,
  ArrowUpDown,
  Plus,
  RefreshCw,
  Eye,
  Pencil,
  X,
  Check,
  ChevronRight,
} from "lucide-react";
import { api, query, format, labels } from "./api.js";
import { catalog, initial } from "./catalog.js";
export const IconButton = ({ title, children, ...props }) => (
  <Button variant="plain" title={title} aria-label={title} {...props}>
    {children}
  </Button>
);
export const ErrorBox = ({ error }) =>
  error ? <Alert variant="danger" title={error} isInline /> : null;
export function Dialog({ title, children, onClose, footer, wide = false }) {
  const helpId = useId().replace(/:/g, "");
  return (
    <Modal
      isOpen
      variant={wide ? "large" : "medium"}
      onClose={onClose}
      aria-label={title}
    >
      <ModalHeader title={title} />
      <ModalBody>
        <div data-help-scope={helpId}>
          <Button
            variant="link"
            className="dialog-help-button"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("control-help-dialog", {
                  detail: { scope: helpId, title },
                }),
              )
            }
          >
            Ayuda del diálogo
          </Button>
          {children}
        </div>
      </ModalBody>
      {footer && <ModalFooter>{footer}</ModalFooter>}
    </Modal>
  );
}
export function Badge({ value }) {
  return (
    <Label
      color={
        value === "approved" || value === true || value === "in"
          ? "green"
          : value === "rejected" || value === false
            ? "red"
            : value === "review" || value === "requested"
              ? "orange"
              : "blue"
      }
    >
      {format(value)}
    </Label>
  );
}
// Single shared list adapter: PatternFly table, server filters/sort, 50-row paging,
// anchored portalled filters and right-sticky accessible action buttons.
export function ResourceTable({
  resource,
  onSelect,
  onCreate,
  onEdit,
  onView,
  extraActions,
  refresh = 0,
  params = {},
  toolbar,
  columns: overrideColumns,
  endpoint,
  title,
  onResult,
  renderRowDetail,
  renderCell,
  isSelectionDisabled,
  emptyMessage,
}) {
  const tableId = useId().replace(/:/g, "");
  const [state, setState] = useState({ items: [], total: 0 }),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState(""),
    [direction, setDirection] = useState("asc"),
    [filters, setFilters] = useState({}),
    [popup, setPopup] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0);
  const columns = overrideColumns || catalog[resource].columns,
    paramsKey = JSON.stringify(params),
    source = endpoint || `/resources/${resource}`;
  useEffect(() => {
    let live = true;
    setBusy(true);
    setError("");
    onResult?.(null);
    api(
      `${source}?${query({ page, search, sort, direction, filters, ...params })}`,
    )
      .then((data) => {
        if (live) {
          setState(data);
          onResult?.(data);
          if (page > data.pages) setPage(data.pages);
        }
      })
      .catch((e) => {
        if (live) {
          setError(e.message);
          onResult?.({ error: e.message });
          setState({ items: [], total: 0 });
        }
      })
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
  }, [
    resource,
    source,
    page,
    search,
    sort,
    direction,
    JSON.stringify(filters),
    refresh,
    reload,
    paramsKey,
  ]);
  return (
    <section className="resource-table">
      <div className="table-toolbar">
        <div className="searchbox">
          <Search size={17} />
          <TextInput
            aria-label="Buscar registros"
            data-help="list-search"
            placeholder="Buscar en la lista…"
            value={search}
            onChange={(_, v) => {
              setSearch(v);
              setPage(1);
            }}
          />
        </div>
        <div className="toolbar-actions" data-help="list-commands">
          {toolbar}
          {Object.keys(filters).length > 0 && (
            <Button variant="link" onClick={() => setFilters({})}>
              Limpiar filtros
            </Button>
          )}
          <IconButton
            title="Actualizar"
            onClick={() => setReload((n) => n + 1)}
          >
            <RefreshCw size={17} />
          </IconButton>
          {onCreate && (
            <Button onClick={onCreate} icon={<Plus size={17} />}>
              Nuevo ingreso
            </Button>
          )}
        </div>
      </div>
      <ErrorBox error={error} />
      <div className="table-scroll">
        <Table aria-label={title || catalog[resource].title} variant="compact">
          <Thead data-help="list-columns">
            <Tr>
              {columns.map(([key, label]) => (
                <Th key={key}>
                  <div className="column-head">
                    <button
                      onClick={() => {
                        setSort(key);
                        setDirection(
                          sort === key && direction === "asc" ? "desc" : "asc",
                        );
                        setPage(1);
                      }}
                    >
                      {label}
                      <ArrowUpDown
                        size={12}
                        className={sort === key ? "active-sort" : ""}
                      />
                    </button>
                    <IconButton
                      title={`Filtrar ${label}`}
                      onClick={(e) =>
                        setPopup({
                          key,
                          label,
                          rect: e.currentTarget
                            .closest("th")
                            .getBoundingClientRect(),
                        })
                      }
                    >
                      <Filter
                        size={13}
                        fill={
                          filters[key]?.length ? "var(--oi-orange)" : "none"
                        }
                      />
                    </IconButton>
                  </div>
                </Th>
              ))}
              <Th className="sticky-actions">Acciones</Th>
            </Tr>
          </Thead>
          <Tbody>
            {state.items.map((row) => (
              <React.Fragment key={row._id}>
                <Tr>
                  {columns.map(([key, label]) => (
                    <Td key={key} dataLabel={label}>
                      {renderCell?.(row, key) ??
                        (key === "name" || key === "personName" ? (
                          <span className="person-cell">
                            <span className="mini-avatar">
                              {String(row[key] || "?")
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")}
                            </span>
                            <strong>{row[key]}</strong>
                          </span>
                        ) : ["active", "status", "direction"].includes(key) ? (
                          <Badge value={row[key]} />
                        ) : (
                          format(row[key], key)
                        ))}
                    </Td>
                  ))}
                  <Td className="sticky-actions">
                    <div className="row-actions" data-help="row-actions">
                      {onSelect ? (
                        <IconButton
                          title="Seleccionar"
                          isDisabled={isSelectionDisabled?.(row)}
                          onClick={() => onSelect(row)}
                        >
                          <Check size={17} />
                        </IconButton>
                      ) : (
                        <>
                          <IconButton
                            title="Ver detalle"
                            onClick={() => onView?.(row)}
                          >
                            <Eye size={16} />
                          </IconButton>
                          {onEdit && (
                            <IconButton
                              title="Editar"
                              onClick={() => onEdit(row)}
                            >
                              <Pencil size={16} />
                            </IconButton>
                          )}
                          {extraActions?.(row)}
                        </>
                      )}
                    </div>
                  </Td>
                </Tr>
                {renderRowDetail && (
                  <Tr>
                    <Td colSpan={columns.length + 1}>{renderRowDetail(row)}</Td>
                  </Tr>
                )}
              </React.Fragment>
            ))}
            {!state.items.length && (
              <Tr>
                <Td colSpan={columns.length + 1}>
                  <div className="empty-state">
                    {busy ? (
                      <Spinner size="md" />
                    ) : (
                      <>
                        <div className="empty-symbol">
                          <Search size={25} />
                        </div>
                        <strong>
                          {emptyMessage || "No hay registros todavía"}
                        </strong>
                        <p>
                          {emptyMessage
                            ? "Revisá el período, las personas y los filtros aplicados."
                            : search || Object.keys(filters).length
                              ? "Probá con otros filtros."
                              : "Los registros aparecerán aquí cuando comiences a trabajar."}
                        </p>
                      </>
                    )}
                  </div>
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </div>
      <Pagination
        data-help="list-pagination"
        widgetId={`resource-${resource}-${tableId}`}
        perPageOptions={[{ title: "50", value: 50 }]}
        itemCount={state.total}
        perPage={50}
        page={page}
        onSetPage={(_, p) => setPage(p)}
        isCompact
        isLastFullPageShown
        titles={{
          ofWord: "de",
          paginationAriaLabel: "Paginación",
          toNextPageAriaLabel: "Página siguiente",
          toPreviousPageAriaLabel: "Página anterior",
        }}
      />
      {popup && (
        <FilterPanel
          resource={resource}
          endpoint={source}
          params={params}
          popup={popup}
          filters={filters}
          onClose={() => setPopup(null)}
          onApply={(values) => {
            setFilters((current) => {
              const next = { ...current };
              if (values.length) next[popup.key] = values;
              else delete next[popup.key];
              return next;
            });
            setPage(1);
            setPopup(null);
          }}
        />
      )}
    </section>
  );
}
function FilterPanel({
  resource,
  endpoint,
  params = {},
  popup,
  filters,
  onClose,
  onApply,
}) {
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [values, setValues] = useState([]),
    [more, setMore] = useState(false),
    [selected, setSelected] = useState(filters[popup.key] || []),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setBusy(true);
    api(
      `${endpoint || `/resources/${resource}`}/values/${popup.key}?${query({ ...params, page, search, filters })}`,
    )
      .then((data) => {
        if (live) {
          setValues((v) => (page === 1 ? data.values : [...v, ...data.values]));
          setMore(data.hasMore);
        }
      })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
  }, [page, search]);
  useEffect(() => {
    const close = (e) => {
      if (e.key === "Escape") onClose();
    };
    const reposition = () => onClose();
    window.addEventListener("keydown", close);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition);
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition);
    };
  }, []);
  const left = Math.max(8, Math.min(popup.rect.left, window.innerWidth - 288)),
    top = Math.max(
      8,
      Math.min(popup.rect.bottom + 4, window.innerHeight - 360),
    );
  return createPortal(
    <div
      className="filter-popup"
      role="dialog"
      aria-label={`Filtro ${popup.label}`}
      style={{ left, top }}
    >
      <header>
        <strong>{popup.label}</strong>
        <IconButton title="Cerrar filtro" onClick={onClose}>
          <X size={15} />
        </IconButton>
      </header>
      <TextInput
        autoFocus
        aria-label="Buscar valores del filtro"
        placeholder="Buscar valores…"
        value={search}
        onChange={(_, v) => {
          setSearch(v);
          setPage(1);
        }}
      />
      <ErrorBox error={error} />
      <div
        className="filter-values"
        onScroll={(e) => {
          if (
            more &&
            !busy &&
            e.currentTarget.scrollTop + e.currentTarget.clientHeight >=
              e.currentTarget.scrollHeight - 20
          )
            setPage((p) => p + 1);
        }}
      >
        {values.map((item, i) => (
          <Checkbox
            key={`${item.label}-${i}`}
            id={`filter-${i}`}
            label={format(item.value)}
            isChecked={selected.includes(item.value)}
            onChange={(_, checked) =>
              setSelected((v) =>
                checked
                  ? [...v, item.value]
                  : v.filter((x) => x !== item.value),
              )
            }
          />
        ))}
        {busy && <Spinner size="sm" />}
      </div>
      <Button onClick={() => onApply(selected)}>Aplicar filtro</Button>
    </div>,
    document.body,
  );
}
export function Relation({ resource, value, onChange, label, initialLabel }) {
  const [open, setOpen] = useState(false),
    [name, setName] = useState(initialLabel || "");
  useEffect(() => {
    let active = true;
    if (value)
      api(`/resources/${resource}/${value}`)
        .then((row) => active && setName(row.name))
        .catch(() => active && setName("Referencia no disponible"));
    else setName("");
    return () => {
      active = false;
    };
  }, [resource, value]);
  return (
    <>
      <div className="relation">
        <Button variant="control" onClick={() => setOpen(true)}>
          {value
            ? name || `Seleccionado · ${value.slice(-6)}`
            : `Seleccionar ${label || catalog[resource].singular}`}
          <Search size={16} />
        </Button>
        {value && (
          <IconButton
            title="Quitar selección"
            onClick={() => {
              onChange("");
              setName("");
            }}
          >
            <X size={15} />
          </IconButton>
        )}
      </div>
      {open && (
        <Dialog
          title={`Seleccionar ${catalog[resource].title.toLowerCase()}`}
          wide
          onClose={() => setOpen(false)}
        >
          <ResourceTable
            resource={resource}
            onSelect={(row) => {
              onChange(row._id);
              setName(row.name);
              setOpen(false);
            }}
          />
        </Dialog>
      )}
    </>
  );
}
export function Field({ field, value, onChange }) {
  const { key, label, type } = field;
  if (type === "relation")
    return <Relation {...field} value={value} onChange={onChange} />;
  if (type === "boolean")
    return (
      <Checkbox
        id={`field-${key}`}
        label={label}
        isChecked={Boolean(value)}
        onChange={(_, v) => onChange(v)}
      />
    );
  if (type === "select")
    return (
      <FormSelect
        aria-label={label}
        value={value}
        onChange={(_, v) => onChange(v)}
      >
        {field.options.map((v) => (
          <FormSelectOption key={v} value={v} label={labels[v] || v} />
        ))}
      </FormSelect>
    );
  if (type === "weekdays")
    return (
      <div className="weekday-picker">
        {["L", "M", "X", "J", "V", "S", "D"].map((v, i) => (
          <Button
            key={i}
            variant={value?.includes(i + 1) ? "primary" : "secondary"}
            onClick={() =>
              onChange(
                value?.includes(i + 1)
                  ? value.filter((n) => n !== i + 1)
                  : [...(value || []), i + 1],
              )
            }
          >
            {v}
          </Button>
        ))}
      </div>
    );
  if (type === "sequence")
    return (
      <div className="sequence">
        {(value || []).map((id, i) => (
          <div key={i}>
            <span>Día {i + 1}</span>
            <Relation
              resource="shifts"
              value={id}
              onChange={(v) =>
                onChange(value.map((old, index) => (i === index ? v : old)))
              }
              label="turno · vacío = descanso"
            />
            <IconButton
              title="Quitar día"
              onClick={() => onChange(value.filter((_, index) => index !== i))}
            >
              <X size={16} />
            </IconButton>
          </div>
        ))}
        <Button
          variant="secondary"
          onClick={() => onChange([...(value || []), ""])}
        >
          Agregar día
        </Button>
        <small>
          Sin turno seleccionado = descanso. El ciclo vuelve al día 1 al
          terminar.
        </small>
      </div>
    );
  if (type === "textarea")
    return (
      <TextArea
        aria-label={label}
        value={value || ""}
        onChange={(_, v) => onChange(v)}
      />
    );
  return (
    <TextInput
      aria-label={label}
      type={type}
      step={type === "number" ? "any" : undefined}
      value={value ?? ""}
      onChange={(_, v) => onChange(type === "number" ? Number(v) : v)}
    />
  );
}
export function Editor({ resource, record, onClose, onSaved }) {
  const [data, setData] = useState(() => initial(resource, record)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save() {
    setBusy(true);
    try {
      await api(`/resources/${resource}${record ? "/" + record._id : ""}`, {
        method: record ? "PUT" : "POST",
        body: data,
      });
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={`${record ? "Editar" : "Nueva/o"} ${catalog[resource].singular}`}
      onClose={onClose}
      footer={
        <>
          <Button isLoading={busy} isDisabled={busy} onClick={save}>
            Guardar
          </Button>
          <Button variant="link" onClick={onClose}>
            Cancelar
          </Button>
        </>
      }
    >
      <ErrorBox error={error} />
      <div className="form-grid">
        {resource === "people" && (
          <p className="full-field muted">
            Primero guardá la persona. Después, en su fila, abrí «Registrar
            rostros» para capturar las tres imágenes o «Probar rostro» para
            verificar sin fichar.
          </p>
        )}
        {catalog[resource].fields.map((field) => (
          <div
            key={field.key}
            data-help-field={field.key}
            data-help-label={field.label}
            className={
              ["sequence", "weekdays", "textarea"].includes(field.type)
                ? "full-field"
                : ""
            }
          >
            {field.type !== "boolean" && <label>{field.label}</label>}
            <Field
              field={field}
              value={data[field.key]}
              onChange={(v) => setData((d) => ({ ...d, [field.key]: v }))}
            />
          </div>
        ))}
      </div>
    </Dialog>
  );
}
export function Detail({ resource, row, onClose }) {
  return (
    <Dialog
      title={row.name || row.personName || catalog[resource].title}
      onClose={onClose}
    >
      <dl className="detail-grid">
        {[
          ...new Map([
            ...catalog[resource].columns,
            ...catalog[resource].fields.map((f) => [f.key, f.label]),
            ["reason", "Motivo"],
            ["anomalies", "Incidencias"],
            ["notes", "Observaciones"],
          ]).entries(),
        ]
          .filter(([key]) => row[key] !== undefined)
          .map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{format(row[key], key)}</dd>
            </div>
          ))}
      </dl>
    </Dialog>
  );
}
