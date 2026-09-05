export const viewHelp = {
  reports: {
    title: "Informes",
    concept:
      "Consulta jornadas ya procesadas por día laboral, sin recalcular. Resume horas, ausencias y puntualidad por persona. Fuera de turno incluye extras; no sumes ambas columnas. Las fichadas vinculadas conservan sus instantes originales, incluso al cruzar medianoche.",
    sequence: [
      "Elegí desde/hasta y Todas o una selección de personas; generá el informe.",
      "Alterná resumen por persona y detalle diario. Los totales incluyen todas las páginas del resultado filtrado.",
      "Abrí el detalle de una persona para ver sus días, tramos e incidencias.",
      "Activá Incluir fichadas originales para anexarlas a cada jornada. La cámara abre la evidencia con acceso auditado.",
    ],
    related: ["reviews", "punches", "schedule"],
  },
  dashboard: {
    title: "Resumen",
    concept:
      "Los indicadores reúnen personas activas, entradas abiertas, jornadas por revisar y solicitudes. Una entrada abierta es una persona cuya última fichada fue entrada; no implica por sí sola una falta.",
    sequence: [
      "Revisá indicadores y últimos movimientos.",
      "Entrá al calendario para comparar planificación y resultado.",
      "Atendé solicitudes y jornadas pendientes desde sus módulos.",
    ],
    related: ["schedule", "punches", "reviews"],
  },
  people: {
    title: "Personas",
    concept:
      "El legajo identifica a la persona y se numera automáticamente; no requiere correo ni crea una cuenta de acceso. Grupo y vigencia laboral conectan la persona con la planificación. El catálogo facial se configura después de guardar.",
    sequence: [
      "Creá la persona con fecha de ingreso y grupo si corresponde.",
      "Guardá; abrí Registrar rostros en las acciones de la fila.",
      "Documentá autorización y registrá tres capturas; probá sin fichar.",
      "Verificá su asignación y la terminal que podrá reconocerla.",
    ],
    related: ["groups", "assignments", "terminals"],
  },
  groups: {
    title: "Grupos y equipos",
    concept:
      "Agrupan personas en cuadrillas o equipos. La pertenencia al grupo permite heredar una asignación; el grupo por sí solo no define horarios.",
    sequence: [
      "Creá un grupo con área y destino.",
      "Abrí Asignar personas y usá la doble lista paginada.",
      "Al agregar, origen permanece deshabilitado; al quitar, vuelve a estar disponible.",
      "Vinculá el grupo con un horario o rotación en Asignaciones.",
    ],
    related: ["people", "assignments"],
  },
  shifts: {
    title: "Horarios",
    concept:
      "Definen inicio, fin, pausa no paga y tolerancia. Si fin es menor a inicio, el turno termina al día siguiente. Crear un horario no lo aplica a ninguna persona hasta asignarlo.",
    sequence: [
      "Creá el rango de inicio y fin.",
      "Definí pausa y tolerancia en minutos.",
      "Usalo directamente en Asignaciones o dentro de una rotación.",
      "Verificá el resultado en Calendario.",
    ],
    related: ["patterns", "assignments", "schedule"],
  },
  patterns: {
    title: "Rotaciones",
    concept:
      "Una secuencia repetitiva de turnos y descansos. La fecha del día 1 ancla el ciclo; cada casilla de la secuencia representa un día. Una casilla sin turno es descanso.",
    sequence: [
      "Creá primero los horarios a utilizar.",
      "Elegí fecha del día 1 y ordená turnos/descansos.",
      "Guardá el ciclo y asignalo a persona o grupo.",
      "Revisá la repetición mensual en Calendario.",
    ],
    related: ["shifts", "assignments", "schedule"],
  },
  assignments: {
    title: "Asignaciones",
    concept:
      "Conectan quién trabaja (persona o grupo) con cuándo (horario fijo o rotación), vigencia, días y destino. Una asignación individual tiene prioridad sobre la grupal. Dos asignaciones del mismo nivel coincidentes generan conflicto.",
    sequence: [
      "Elegí persona o grupo, no ambos.",
      "Elegí turno fijo o patrón, no ambos.",
      "Definí vigencia y días aplicables; para un ciclo continuo incluí todos sus días.",
      "Verificá calendario y corregí superposiciones antes de procesar.",
    ],
    related: ["people", "groups", "shifts", "patterns", "schedule"],
  },
  schedule: {
    title: "Calendario",
    concept:
      "Cada celda reúne planificación vigente y jornada procesada. Sin procesar no significa ausencia ni cero horas: todavía no hay cálculo. Manual indica corrección auditada. El procesamiento no se realiza al abrir el calendario.",
    sequence: [
      "Elegí mes y buscá persona.",
      "Compará horario superior con presencia y estado inferior.",
      "Abrí una celda para ver el detalle.",
      "Si existe jornada en revisión, podés editar con motivo; una aprobada requiere reapertura.",
    ],
    related: ["assignments", "punches", "reviews"],
  },
  punches: {
    title: "Fichadas",
    concept:
      "Son registros originales: legajo, instante, entrada/salida y coincidencia. El fichaje alterna según la última marca, sin analizar turnos. El procesamiento posterior genera jornadas y retira los pares procesados de pendientes.",
    sequence: [
      "Fichá desde una terminal o usá registro supervisado con motivo.",
      "Revisá pendientes; la cámara de la fila abre la evidencia guardada.",
      "Procesá un rango de hasta 31 días, sin fechas futuras.",
      "Las entradas abiertas siguen pendientes; revisá las jornadas resultantes.",
    ],
    related: ["terminals", "reviews", "schedule"],
  },
  reviews: {
    title: "Revisión de jornadas",
    concept:
      "Compara fichadas con planificación y autorizaciones. Fuera de turno incluye también intervalos clasificados como extras: no sumes ambos como si fueran categorías independientes. Editar modifica la proyección, nunca las fichadas originales.",
    sequence: [
      "Abrí el detalle para revisar tramos e incidencias.",
      "Si hay un error, usá el lápiz, ajustá tramos y explicá el motivo.",
      "Consultá Historial manual para ver antes/después, usuario y fecha.",
      "Aprobá; si hay incidencias, indicá observación. Las correcciones manuales y aprobadas se conservan al reprocesar.",
    ],
    related: ["punches", "schedule", "audit"],
  },
  absences: {
    title: "Vacaciones y ausencias",
    concept:
      "Son solicitudes de vacaciones, licencia médica, permiso, falta o suspensión. El efecto en el cálculo corresponde a solicitudes aprobadas. El cupo vacacional se configura por persona, sin convenio precargado.",
    sequence: [
      "Elegí persona, tipo, fechas y motivo.",
      "Dividí por año calendario los pedidos que cruzan de año.",
      "Revisá cupo y superposiciones antes de aprobar.",
      "Procesá las fechas afectadas; jornadas manuales/aprobadas no se sobrescriben.",
    ],
    related: ["people", "settings", "reviews"],
  },
  extensions: {
    title: "Extensiones",
    concept:
      "Autorizan un rango adicional para una persona y día laboral. No crean horas trabajadas: sólo se computa la parte efectivamente fichada fuera del turno y cubierta por la aprobación.",
    sequence: [
      "Indicá persona, día, rango y motivo.",
      "Aprobá o rechazá la solicitud.",
      "Procesá las fichadas de ese rango.",
      "Revisá categoría 50/100 según reglas configuradas, sin asumir legislación.",
    ],
    related: ["settings", "punches", "reviews"],
  },
  holidays: {
    title: "Feriados",
    concept:
      "Fechas generales o por ubicación. La ubicación vacía aplica a todas; si se informa debe coincidir con el destino efectivo. La clasificación extra de feriados depende de Configuración.",
    sequence: [
      "Ingresá nombre y fecha.",
      "Dejá ubicación vacía o indicá destino específico.",
      "Revisá las reglas de feriados.",
      "Procesá y revisá el resultado; el feriado no crea una fichada.",
    ],
    related: ["settings", "assignments", "reviews"],
  },
  terminals: {
    title: "Terminales FaceVision",
    concept:
      "Una terminal es una vista autónoma con enlace privado revocable. Utiliza la cámara del dispositivo donde se abre. Grupo vacío considera todo el catálogo activo; un grupo restringe candidatos. La terminal no concede acceso administrativo.",
    sequence: [
      "Creá/activá la terminal y ajustá tiempos, duplicados y coincidencia.",
      "Generá enlace privado; el anterior queda revocado.",
      "Abrilo en el dispositivo autorizado; cámara remota requiere HTTPS confiable.",
      "La persona debe tener tres capturas y estar activa. Tras fichar, retirará el rostro para habilitar al siguiente.",
    ],
    related: ["people", "punches", "settings"],
  },
  audit: {
    title: "Auditoría",
    concept:
      "Registra operaciones con actor y fecha. La edición manual conserva antes/después en el historial de jornada; consultar una captura también genera evento. La auditoría no sustituye las fichadas originales.",
    sequence: [
      "Buscá y filtrá por operación o actor.",
      "Abrí el detalle del evento.",
      "Para comparar una corrección, abrí Historial manual en Revisión.",
      "Para evidencia de marcación, consultá la captura en Fichadas.",
    ],
    related: ["reviews", "punches"],
  },
  settings: {
    title: "Configuración",
    concept:
      "Reglas generales: zona horaria, duración máxima de pareo, vacaciones y categorías de extras. Son genéricas, no una certificación laboral. Las preconfiguraciones agregan datos relacionados sin reemplazar los existentes.",
    sequence: [
      "Definí organización, zona y reglas.",
      "Si estás iniciando, revisá una plantilla por tipo de empresa.",
      "Opcionalmente incluí 20 legajos DEMO, que participan del procesamiento hasta desactivarlos.",
      "Comprobá horarios, grupos y asignaciones creados.",
    ],
    related: ["people", "groups", "assignments", "holidays"],
  },
  help: {
    title: "Asistencia y ayuda",
    concept:
      "Biblioteca local de conceptos y circuitos. Los paseos resaltan controles reales y explican su uso. No crean registros, no activan cámaras y no aprueban ni procesan datos automáticamente.",
    sequence: [
      "Buscá un tema o elegí un circuito.",
      "Iniciá el paseo de una vista o el recorrido entre vistas.",
      "Usá Anterior/Siguiente para avanzar, Escape o Cerrar para salir.",
      "En un formulario, Ayuda del diálogo explica sus campos.",
    ],
    related: ["dashboard", "settings"],
  },
};
export const fieldHelp = {
  name: "Nombre descriptivo para localizar el registro en las listas.",
  document: "Documento de la persona; no reemplaza el número de legajo.",
  email: "Opcional para el legajo. No crea una cuenta administrativa.",
  personId: "Persona destinataria. En asignaciones es alternativa al grupo.",
  groupId:
    "Grupo relacionado. En asignaciones permite herencia grupal; en terminales limita quién puede fichar.",
  shiftId:
    "Horario fijo. En asignaciones elegí éste o una rotación, nunca ambos.",
  patternId:
    "Secuencia rotativa. Requiere fecha ancla y turnos previamente definidos.",
  department:
    "Área/sección descriptiva. El horario efectivo depende de la asignación.",
  location:
    "Sede, línea o destino. También se usa para feriados específicos por ubicación.",
  active:
    "Habilita el registro para la operación. Desactivar no borra su historial.",
  hireDate:
    "Inicio de la relación laboral: limita desde cuándo se procesa la persona.",
  terminationDate:
    "Fin de la relación laboral, opcional. Limita fechas posteriores.",
  annualLeaveDays:
    "Cupo anual de vacaciones configurable. Cero no concede días automáticamente.",
  start: "Hora inicial del tramo.",
  end: "Hora final: si es menor al inicio, termina al día siguiente.",
  breakMinutes:
    "Pausa no paga descontada del tiempo normal computable; no modifica las fichadas.",
  toleranceMinutes:
    "Margen para clasificar tardanza. No redondea ni borra minutos originales.",
  anchorDate: "Fecha del día 1 desde la que se repite toda la secuencia.",
  sequence:
    "Un elemento por día del ciclo. Elegí horario o descanso sin turno.",
  startDate:
    "Comienzo de vigencia o solicitud; verificá el recurso que estás editando.",
  endDate: "Fin inclusivo del rango. En asignaciones puede quedar vacío.",
  weekdays:
    "Días de semana aplicables. Un ciclo continuo suele requerir los siete días.",
  reason: "Motivo trazable para justificar la solicitud o intervención.",
  type: "Clasificación de la ausencia. Se aplica al cálculo cuando la solicitud está aprobada.",
  date: "Día laboral de referencia; puede abarcar una continuación después de medianoche.",
  color: "Color visual del horario o grupo; no altera los cálculos.",
  duplicateSeconds:
    "Tiempo de bloqueo entre marcas consecutivas de una misma persona.",
  detectionDelayMs:
    "Espera con rostro detectado antes de iniciar el contador, en milisegundos.",
  countdownMs: "Duración de cada número del contador.",
  resultMs: "Tiempo que se muestra el OK o error antes del siguiente usuario.",
  matchThreshold:
    "Umbral de similitud FaceVision; no es probabilidad. Subirlo exige coincidencia más estricta.",
  ambiguityMargin:
    "Separación mínima entre los dos mejores candidatos para evitar identidades ambiguas.",
};
export const circuits = [
  {
    id: "setup",
    title: "Puesta en marcha completa",
    description:
      "Reglas → equipos → personas → horarios → asignación → calendario.",
    views: [
      "settings",
      "groups",
      "people",
      "shifts",
      "patterns",
      "assignments",
      "schedule",
    ],
  },
  {
    id: "face",
    title: "Alta facial y primer fichaje",
    description:
      "Legajo y tres capturas → prueba → terminal → fichada → revisión.",
    views: ["people", "terminals", "punches", "reviews", "schedule"],
  },
  {
    id: "daily",
    title: "Cierre diario y correcciones",
    description:
      "Evidencia → procesamiento → revisión manual → calendario → auditoría.",
    views: ["punches", "reviews", "schedule", "audit"],
  },
  {
    id: "leave",
    title: "Vacaciones y permisos",
    description:
      "Cupo → solicitud → reglas y feriados → procesamiento → revisión.",
    views: ["people", "absences", "settings", "holidays", "punches", "reviews"],
  },
  {
    id: "extra",
    title: "Horas adicionales",
    description: "Asignación → extensión autorizada → fichadas → revisión.",
    views: ["assignments", "extensions", "punches", "reviews"],
  },
];
export function viewSteps(view) {
  const help = viewHelp[view] || viewHelp.dashboard;
  const step = (target, title, body) => ({ view, target, title, body });
  const list = [step("[data-help='heading']", help.title, help.concept)];
  if (view === "reports")
    list.push(
      step(
        "[data-help='report-controls']",
        "Período y personas",
        help.sequence[0],
      ),
      step(
        "[data-help='report-result']",
        "Resultados y fichadas",
        help.sequence.slice(1).join(" "),
      ),
    );
  else if (!["dashboard", "schedule", "settings", "help"].includes(view))
    list.push(
      step(
        "[data-help='list-search']",
        "Buscar registros",
        "Buscá en la lista. La búsqueda y los filtros se resuelven sobre todos los registros, no sólo sobre la página visible.",
      ),
      step(
        "[data-help='list-columns']",
        "Filtros y ordenamiento",
        "Tocá el título para ordenar o el filtro para seleccionar valores. Los filtros se combinan; podés limpiarlos desde la barra.",
      ),
      step(
        "[data-help='list-commands']",
        "Acciones de la lista",
        help.sequence[0],
      ),
      step(
        "[data-help='row-actions']",
        "Acciones del registro",
        help.sequence.slice(1).join(" "),
      ),
      step(
        "[data-help='list-pagination']",
        "Páginas",
        "Cada página muestra hasta 50 registros. Los filtros y el orden se mantienen al cambiar de página.",
      ),
    );
  else if (view === "schedule")
    list.push(
      step(
        "[data-help='calendar-controls']",
        "Mes y persona",
        help.sequence[0],
      ),
      step(
        "[data-help='calendar']",
        "Planificado y procesado",
        help.sequence.slice(1).join(" "),
      ),
    );
  else if (view === "settings")
    list.push(
      step("[data-help='settings']", "Reglas generales", help.sequence[0]),
      step(
        "[data-help='presets']",
        "Plantillas integradas",
        help.sequence.slice(1).join(" "),
      ),
    );
  else
    list.push(
      step(
        "[data-help='view-content']",
        "Cómo continuar",
        help.sequence.join(" "),
      ),
    );
  return list;
}
