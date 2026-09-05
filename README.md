# ControlRRHH

Aplicación independiente de control horario, React + PatternFly, Node/Express y MongoDB. Base nueva `control_rrhh`, sin importar personas o biometría de Origen Ingenio.

Proyecto público creado por Luis Carlos Fertl con asistencia de desarrollo de Codex. La aplicación y su imagen `ghcr.io/luiscarlosfertl-ia/control-rrhh-app` son publicables; **FaceVision permanece privado**. El runtime facial, sus modelos, manifiestos generados, claves, capturas, embeddings, base y configuración local no forman parte del repositorio ni de la imagen pública. Ver [créditos y desarrollo paso a paso](docs/desarrollo-con-codex.md) y [publicación y actualización](docs/docker.md#publicación-pública-y-facevision-privado).

> **Desarrollado con Codex.** Dirección del producto, requisitos y decisiones de publicación: Luis Carlos Fertl. Implementación, documentación y verificación realizadas de forma colaborativa con Codex de OpenAI.

## Ejecutar

Para instalar on-premise, ver **[ControlRRHH en Docker](docs/docker.md)**. La edición pública ejecuta app + Mongo y usa fichadas supervisadas; la edición biométrica agrega FaceVision privado con `--facevision`. Ambas conservan la misma planificación, procesamiento, revisión, auditoría e informes.

Inicio público desde el código:

```powershell
git clone https://github.com/luiscarlosfertl-ia/ControlRRHH.git
cd ControlRRHH
npm install
node scripts/docker.mjs prepare
node scripts/docker.mjs build 0.1.0
node scripts/docker.mjs start
```

Abrir http://localhost:3110 y crear el primer administrador. No hay credenciales predeterminadas.

Para ejecución nativa de desarrollo requiere Node 22 o superior, MongoDB local y, sólo si se habilita biometría, un servicio FaceVision compatible en `http://127.0.0.1:8007`.

```powershell
cd C:\Users\luis_\Documents\Playground\ControlRRHH
npm install
npm run build
npm start
```

Abrir http://127.0.0.1:3100. Crear el primer administrador desde el servidor; no hay contraseña predeterminada. No se reutiliza la cuenta de Origen.

Desarrollo con recarga frontend: `npm run dev`, web http://127.0.0.1:5190. Backend 3100. No arrancar dos backends sobre el mismo puerto.

## Flujo de trabajo

1. Configurar organización, zona horaria y reglas genéricas.
2. Crear grupos y personas. El legajo es incremental y no requiere correo. El cupo de vacaciones se define por persona.
3. Crear horarios, ciclos rotativos y asignaciones vigentes a persona o grupo. Un día sin turno dentro del ciclo es descanso; la fecha ancla indica el día 1.
4. En la edición biométrica, registrar tres capturas de la misma persona con referencia de autorización. El catálogo queda cifrado; puede revocarse. No se importa biometría de otra aplicación.
5. En la edición biométrica, crear una terminal y generar su enlace privado. En la edición pública, usar Registro supervisado desde Fichadas.
6. Fichar: alterna entrada/salida según la última ficha de ese legajo, independientemente de turnos. Guarda hora del servidor con segundos y coincidencia. Evita duplicados consecutivos. Alternativa manual supervisada con motivo.
7. Procesar un rango de hasta 31 días. Se generan jornadas en revisión; pares completos salen de pendientes. Entradas abiertas siguen pendientes. Reintentar es seguro si se interrumpió el marcador de procesamiento.
8. Revisar normales, fuera de turno y extras autorizadas, faltas, tardanzas y salidas anticipadas. Aprobar con observación cuando hay incidencias. Una jornada aprobada debe reabrirse para recalcular.
9. Solicitar y aprobar/rechazar licencias o extensiones. Las vacaciones controlan cupo y superposición; las extensiones sólo computan tiempo efectivamente fichado.

## Asistencia y navegación

**Asistencia y ayuda** abre una biblioteca con buscador, conceptos, relaciones entre datos y secuencias de uso. Incluye cinco circuitos: puesta en marcha, alta facial y primer fichaje, cierre diario y correcciones, vacaciones y permisos, y horas adicionales.

**Paseo de esta vista** resalta los controles de la pantalla activa y explica su significado con **Anterior / Siguiente / Finalizar**. **Ayuda del diálogo** recorre los campos de formularios abiertos. Se puede cerrar con **Cerrar paseo** o Escape; no completa datos, activa cámaras, procesa ni aprueba registros. Si un control depende de tener registros, el paseo lo informa y permite continuar.

Los circuitos navegan entre módulos y presentan las instrucciones de cada etapa; ejecutar las operaciones sigue siendo una decisión del usuario. La barra superior incorpora **Ir a otra vista** y **Volver** (historial de navegación de esta carga de la aplicación). El selector, la pantalla y la URL se mantienen sincronizados.

## Informes de asistencia

En **Informes**, elegí fecha desde/hasta (días laborales inclusivos, hasta 366 días), **Todas las personas** o una selección de hasta 100 personas desde la lista paginada, y **Generar informe**. Incluye personas inactivas si tienen jornadas procesadas. No interpreta días sin procesar como faltas ni recalcula al consultar.

**Resumen por persona** acumula horas planificadas, presencia bruta, normales netas, fuera de turno total, fuera sin autorización, extras 50/100, tardanza y salida anticipada. Incluye cantidad de jornadas en revisión/aprobadas/manuales, días con tardanza/salida anticipada y ausencias desglosadas por tipo. **Detalle diario** muestra cada jornada; el ojo abre tramos, incidencias y observaciones. El ojo del resumen abre todos los días de esa persona en el período.

Los totales incluyen todas las páginas del resultado filtrado, no sólo las 50 filas visibles. Filtros y orden se aplican a cada vista: en resumen filtran acumulados por persona; en detalle filtran jornadas. Las ausencias se cuentan por jornada procesada y no equivalen al saldo/cupo vacacional. Presencia bruta incluye pausas; normales netas las descuentan. Fuera de turno total incluye las extras: no sumar ambas columnas. Los resultados no constituyen liquidación salarial.

**Incluir fichadas originales** anexa entrada/salida, instante con segundos, origen y coincidencia a cada jornada diaria. Usa las referencias originales del procesamiento, incluyendo marcas después de medianoche; no reconstruye marcas a partir de una corrección manual. Las capturas sólo se cargan al pulsar su cámara, con la autorización y auditoría existentes. Si falta una referencia se informa. Sin exportación de archivos en esta versión.

## Calendario, correcciones y evidencia

**Calendario** reúne en cada día el horario planificado y la presencia procesada, con estado y marcador Manual. Al abrir una jornada procesada se puede ver el detalle o **Editar con auditoría**. También está el lápiz en **Revisión de jornadas**.

La edición requiere administrador y motivo: permite agregar/quitar/cambiar tramos, su categoría, pausa no paga, tardanza, salida anticipada y ausencia. Recalcula totales, sin alterar fichadas ni borrar incidencias originales. Las aprobadas se deben reabrir. El antes/después, usuario, fecha y motivo quedan en **Historial manual** y Auditoría. Reprocesar conserva correcciones manuales; no existe un reinicio automático de esas correcciones.

**Fichadas → ícono de cámara** abre la captura original de una nueva fichada facial. Se guarda cifrada junto a la marca, no en el catálogo de tres rostros. Sólo usuarios autenticados de administración/revisión acceden y queda auditoría de visualización. Marcas anteriores, manuales y pruebas de rostro no tienen captura retrospectiva. Retención/purga automática no implementada: definir plazos internos y respaldar de forma protegida base y clave de cifrado antes de producción.

## Alta y prueba facial

Esta capacidad sólo aparece cuando `FACEVISION_ENABLED=true`. En **Personas**, guardar primero el legajo. En las acciones de su fila: **Registrar rostros** (ícono de rostro), autorizar cámara, indicar la referencia de autorización y completar las tres capturas de la misma persona. Se habilita el reconocimiento al completar 3/3. Para reemplazarlas, revocar el catálogo y volver a registrar.

**Probar rostro · sin fichar** está disponible en la fila y dentro del catálogo completo. Muestra si corresponde al legajo elegido, su nombre e índice de similitud; no genera fichadas ni conserva la foto de prueba. Usa el catálogo activo, umbral 0,72 y margen 0,05, no los ajustes particulares de una terminal. Una terminal debe validarse también con sus propios parámetros. Requiere administración y cámara en localhost o HTTPS.

## Preconfiguraciones

En **Configuración → Preconfiguraciones por tipo de empresa**, elegir Industria, Comercio o Servicios y oficinas, revisar los horarios y definir vigencia. Industria agrega dos ciclos alternados 5 trabajo / 2 descanso, mañana/tarde; Comercio horarios fijos lunes–sábado; Oficinas lunes–viernes. Cada opción integra 2 grupos, 2 horarios, 2 asignaciones y 1 terminal desactivada, sin clave; Industria incluye 2 ciclos.

Opcionalmente agrega 20 personas **DEMO** activas (10 por grupo) con legajos únicos, sin correo, biometría ni fichadas. Se incluyen en el procesamiento: desactivarlas al finalizar las pruebas. Cupo vacacional, pausas y tolerancias iniciales 0, editables. No modifica reglas, feriados, cupos o personas existentes. No instala normativa ni horas extra aprobadas. Aplicar es explícito y de una sola vez por plantilla; repetir no duplica ni sobrescribe ediciones. Si se interrumpe, continuar con las opciones originales.

## Colecciones

`accounts`, `sessions`, `people`, `groups`, `shifts`, `patterns`, `assignments`, `absences`, `extensions`, `holidays`, `terminals`, `punches`, `reviews`, `audits`, `settings`, `counters`, `guards`, `presetinstallations` (nombres pluralizados por Mongoose). Ver `backend/src/models.js`. Hay índices únicos de legajo, idempotencia y jornada persona/fecha.

## Configuración de entorno

Variables opcionales: `MONGO_URI` (default mongodb://127.0.0.1:27017), `MONGO_DB` (sólo nombres control_rrhh*), `PORT` (3100), `FACEVISION_ENABLED` (default nativo `true`) y `FACEVISION_URL` (http://127.0.0.1:8007). El Compose público establece `FACEVISION_ENABLED=false`; el overlay privado lo habilita.

Biometría: `BIOMETRIC_KEY`, 32 bytes hex. En desarrollo se crea una clave privada en `.local/biometric.key`. **Respaldar la clave junto con la base, en un almacén separado y protegido**: perderla impide recuperar las capturas. No subirla a Git. En producción es obligatoria la variable; restringir además ACL y cifrado de disco.

LAN/tablet: completar primero el alta del administrador en `http://127.0.0.1:3110`; luego configurar `TLS_CERT`, `TLS_KEY`, opcional `HTTPS_PORT=3444` y `LAN_HOST`. El certificado debe ser confiable en la tablet. El listener HTTP sólo escucha loopback; no se abrió firewall ni se publicó a Internet. El enlace se debe generar desde la URL HTTPS que usará el dispositivo. No usar HTTP por IP para cámaras ni omitir validación de certificados. Preferir proxy/LAN aislada y endpoint de kiosco dedicado antes de producción.

## Verificación y alcance

`npm test`: pruebas unitarias y API con base temporal `control_rrhh_test_<aleatorio>`, creada y eliminada por el test. Nunca elimina la base operativa. `npm run build`: frontend de producción. `npm audit`: dependencias.

Esta entrega es una primera versión funcional, no una certificación laboral ni un sistema de nómina. Incluye administración, reglas y revisión, no liquidación salarial ni exportación contable. No incluye portal de autoservicio del empleado, notificaciones externas, geolocalización, captura offline ni prueba de vida certificada. El balance vacacional es anual por cupo, sin devengamiento ni arrastre automático. No corrige evidencia original por borrado: se conserva y se requiere revisión supervisada.

Antes de producción: validación con personal de prueba autorizado y la cámara física, definición de retención biométrica, políticas internas, respaldo/restauración, pruebas de carga y transacciones con Mongo replica set para alta disponibilidad. Un resultado FaceVision no garantiza resistencia a fotografías. Las aprobaciones no aplican sanciones automáticamente.

Más detalles en [arquitectura](docs/architecture.md), [referencias de interfaz](docs/research.md), [créditos](CREATORS.md) y [bitácora de desarrollo](docs/desarrollo-con-codex.md).
