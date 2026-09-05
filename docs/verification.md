# Verificación inicial · 2026-09-04

- 24 pruebas automatizadas aprobadas: motor temporal, API HTTP contra Mongo temporal y contrato FaceVision simulado. No confundir el proveedor simulado del test con verificación biométrica real.
- Casos: turnos nocturnos, entrada después de medianoche, tolerancia, ausencia aprobada, descanso rotativo, prioridad individual, asignación ambigua, extensión autorizada, recargo por fecha efectiva, entrada abierta, duración máxima y salida huérfana.
- API: sesión y CSRF, permisos, legajo incremental sin email, edición optimista, listas/filtros de 55 personas, procesamiento reintentable, preservación de aprobadas, cupo vacacional, colisión de licencias, clave de terminal y revocación, replay y duplicados.
- FaceVision: prueba de contrato HTTP simulada de tres capturas, almacenamiento cifrado, catálogo no expuesto en listados, búsqueda batch completa, fallo cerrado ante catálogo parcial, fichaje y revocación. Servicio real responde en POST `/face-auth/detect` y rechazó una imagen sintética inválida con 400. No se registraron rostros reales ni se verificó identidad real en esta entrega.
- Navegador: sesión en servidor QA loopback 3101 con base temporal propia; primera y segunda página (50 + 5); búsqueda del valor 55 en filtro y aplicación; edición de persona; selector de grupo sobre formulario; doble lista con origen deshabilitado, incorporación y retiro del destino.
- Capturas visuales revisadas en ancho de teléfono (pantalla inicial) y 1280 px (administración y modales). Corrección del paginado visible y controles centrados de Dual list tras revisión.
- Build Vite completado. npm audit sin vulnerabilidades en la verificación final.

La base operativa `control_rrhh` queda separada y sin personas/fichadas de QA. Prueba pendiente con cámara física, persona autorizada, tres capturas reales y terminal. También queda pendiente la habilitación HTTPS/certificado de una tablet real y la puesta a punto para producción descrita en README.

## Ampliación: prueba facial y plantillas de empresa

25 pruebas aprobadas. Se amplió el contrato FaceVision simulado: prueba correcta, legajo diferente, catálogo incompleto, no coincidencia y revocación; ninguna prueba genera fichadas. Prueba de preconfiguraciones en Mongo temporal: permisos, validación, personas existentes preservadas, legajos únicos, ciclos resueltos, relaciones, terminal desactivada, reglas intactas, instalación con/sin DEMO y reintento sin sobrescribir una edición. No se activó cámara ni se tomó biometría real para QA.

Navegador: vista previa de Industria, aplicación explícita con 20 DEMO en base temporal, confirmación y botón Aplicada, acciones faciales en la tabla y ayuda en el formulario. Compilación final correcta. No se aplicaron plantillas en la base operativa.

## Calendario unificado, edición y evidencia visual

27 pruebas aprobadas: nuevos casos de edición con horario nocturno, totales y pausa, rechazo de solapamiento/rangos inválidos, permisos, versión obsoleta, bloqueo de aprobadas, historial antes/después, auditoría y preservación al reprocesar; fichadas originales intactas. Evidencia de FaceVision simulado: cifrado persistido, exclusión en listas/detalles/replay, lectura autenticada, auditoría de consulta, rechazo sin sesión, y ausencia de foto en marca manual.

QA visual en base temporal: una celda con planificación 06–14 y procesado 8 h; apertura de detalle, modal de edición, corrección ficticia a 15 h con motivo, guardado, actualización a 9 h y marcador Manual tanto en detalle como calendario, historial antes/después. No se capturó imagen real ni se editó jornada de la base operativa. Pendiente prueba física de nueva fichada facial y su imagen.

## Asistencia, paseos y navegación

29 pruebas aprobadas. Nuevas comprobaciones: todos los recursos tienen conceptos, secuencias, relaciones y campos editables documentados; circuitos con rutas válidas e identificadores únicos; normalización de navegación y ruta desconocida.

QA visual en servidor 3101/base temporal: paseo de Personas con seis pasos (encabezado, búsqueda, columnas, comandos, acciones y paginado), resaltado y foco; ayuda del formulario de persona sobre sus campos, cierre sin guardar; centro con cinco circuitos; circuito Cierre diario completo entre Fichadas, Revisión, Calendario y Auditoría, Anterior/Siguiente/Finalizar; Volver retorna al Calendario con URL y selector sincronizados. No se ejecutaron operaciones de negocio mediante los paseos ni se usó cámara real. Build de producción verificado.

## Informes

30 pruebas aprobadas. Nuevo caso API aislado: sesión obligatoria y lectura reviewer; 56 jornadas con paginado 50+6 y totales completos; acumulación por persona, selección y búsqueda de legajo; filtros/orden y valores restringidos al período; ausencias por tipo, tardanzas, salidas anticipadas, manuales; fuera sin autorización sin duplicar extras. Marcas nocturnas conservadas por ID, exclusión de marca de otra persona, referencia ausente señalada, sin foto cifrada/historial manual en respuesta. Fechas imposibles, rangos invertidos/excesivos e inyección de filtros/orden rechazados. Revisiones originales intactas.

QA visual en base temporal: generación del resumen, totales de 8 horas, detalle diario, modal de tramos, anexo entrada/salida con segundos, filtro de legajo, apertura de días de una persona y selección paginada de otra persona sin jornadas (resultado vacío). No se escribieron registros operativos ni se capturaron rostros.

## Empaquetado Docker

32 pruebas aprobadas: nuevas pruebas de clave por archivo (hex y binaria), rechazo de claves inválidas/ausentes en producción, conexión Mongo por secreto codificado y defaults nativos preservados; inspección estática de contextos sin datos, red interna y dependencias saludables. Frontend compilado. YAML de ambos Compose validado con parser local (no equivale a `docker compose config`). Perfil FaceVision exportado desde código activo y probado en Python 3.12 local con los modelos CPU reales: salud, detección sin rostro, rechazo de enrolamiento/búsqueda de una imagen negra y ausencia de rutas ajenas a RRHH. No se capturaron personas ni se copió biometría de Origen.

Preparación local generó secretos nuevos privados y contexto exportado en `.deploy`, sin copiar pesos ni importar la base operativa. Las claves previas se conservan al repetir prepare. SDK original no modificado; servicios nativos no reiniciados. **Docker no está disponible:** pendientes build de imágenes, resolución Linux de dependencias, arranque con Compose, persistencia, backup/restore y HTTPS en tablet. No hay archivo de imagen Docker publicado/generado todavía.

## Identidad visual Origen Ingenio

34 pruebas aprobadas. Se incorporó una verificación estática de los tokens oficiales (`#ff6500`, `#df5500`, `#fff2e8`, `#182333`, `#dfe5eb`), del color del navegador, del filtro compartido y del valor inicial de colores configurables. La prueba también impide reintroducir los principales violetas anteriores y confirma que éxito/error conservan verde/rojo. Los PNG horizontal e isotipo se verifican por firma y presencia dentro de los activos empaquetables. Build de producción correcto. QA visual sobre base temporal en acceso y Resumen: logo horizontal legible sobre fondo suave y barra blanca; isotipo correctamente centrado en navegación compacta. Marca, navegación activa, botón primario, encabezados y avatares mantienen la paleta naranja. La base temporal fue eliminada al finalizar.

## Repositorio público, app pública y FaceVision privado

35 pruebas aprobadas y frontend compilado. La publicación se redefinió para abrir el repositorio y sólo la imagen `control-rrhh-app`. El workflow de etiquetas `vX.Y.Z` no contiene matriz, contexto ni nombre de paquete FaceVision. El runtime y manifiesto facial se eliminaron del árbol público y se ignoran explícitamente; `prepare` los genera dentro de `.deploy/facevision` desde el SDK privado y `build-facevision` crea únicamente una imagen local. `compose.registry.yaml` sustituye sólo la app. Se añadieron créditos y bitácora de desarrollo con atribución transparente “Desarrollado con Codex”. El historial alcanzable se auditó sin runtime/modelos/secretos FaceVision, el remoto público `luiscarlosfertl-ia/ControlRRHH` quedó creado y su primer CI en GitHub Actions finalizó correctamente. No se construyó ni publicó todavía la imagen GHCR: Docker no está instalado localmente y falta crear una etiqueta de versión y confirmar la visibilidad pública irreversible del paquete.
