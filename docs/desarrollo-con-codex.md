# Desarrollo de ControlRRHH con Codex

## Autoría y colaboración

ControlRRHH fue dirigido y definido por **Luis Carlos Fertl**. El diseño técnico, la implementación, las pruebas y la documentación se realizaron de forma colaborativa con **Codex de OpenAI**, con revisión y decisiones finales humanas.

La frase **“Desarrollado con Codex”** se usa como atribución textual de la herramienta. No representa patrocinio, certificación ni propiedad de OpenAI sobre el producto.

## Tiempo registrado

La primera etapa funcional quedó desarrollada el **4 de septiembre de 2026**. Los archivos del proyecto registran una ventana cronológica aproximada desde las **13:19** hasta las **23:54 (America/Argentina/Buenos_Aires)**: unas **10 h 34 min** entre el primer y el último cambio de esa jornada. Es tiempo transcurrido observable, no una medición exacta de dedicación activa.

## Cómo se realizó, paso a paso

1. Se definió una aplicación independiente, una base MongoDB exclusiva y la prohibición de reutilizar cuentas, personas o biometría de Origen Ingenio.
2. Se construyó el recorrido React/PatternFly → API Express → validación y permisos → servicios → modelos Mongoose.
3. Se implementaron autenticación inicial, administración de personas con legajo incremental, grupos, horarios, ciclos rotativos y asignaciones vigentes.
4. Se separó la captura cruda del cálculo laboral: cada fichada alterna entrada/salida según la última marca y sólo después se procesa contra horarios y reglas.
5. Se integró FaceVision mediante contrato HTTP: alta de tres rostros, prueba sin fichar, identificación, umbral, margen, bloqueo de duplicados y terminal desacoplada.
6. Se agregaron preconfiguraciones para industria, comercio y servicios, con datos DEMO opcionales y sin reglas legales asumidas.
7. Se desarrollaron procesamiento, revisión, calendario unificado, edición manual versionada y auditoría antes/después.
8. Se incorporó evidencia visual cifrada por fichada facial, acceso restringido y auditoría de cada visualización.
9. Se creó asistencia contextual: centro de ayuda, paseos por vista, ayuda de diálogos, circuitos completos y navegación Volver.
10. Se añadieron informes por período, personas, resumen y detalle diario, incidencias, tipos de horas y fichadas originales opcionales.
11. Se preparó Docker para app, Mongo y FaceVision, con secretos por archivo, HTTPS LAN, backup, rollback y versiones inmutables.
12. Se alineó la interfaz con la paleta naranja de Origen Ingenio y se incorporaron los logotipos propios de ControlRRHH.
13. Se preparó la publicación abierta de la app con CI, imagen GHCR, SBOM y procedencia, manteniendo FaceVision y los datos sensibles fuera de Git.

## Método de trabajo con Codex

En cada capacidad se reconstruyó primero el recorrido activo de interfaz, API, servicio y modelo. Luego se aplicaron cambios pequeños, se añadieron pruebas de regresión y se verificaron el backend, la compilación del frontend y los archivos de despliegue. Las pruebas usan bases temporales `control_rrhh_test_*`; no borran ni modifican la base operativa.

## Separación pública/privada

El repositorio público incluye la aplicación ControlRRHH, el contrato de integración y las herramientas para preparar un despliegue propio. No incluye:

- runtime generado de FaceVision ni su repositorio fuente;
- modelos biométricos o sus pesos;
- claves, certificados, capturas, embeddings o bases de datos;
- directorios locales `.deploy`, `.local`, backups o releases exportadas.

FaceVision se exporta y construye localmente desde una copia privada autorizada. La imagen pública de ControlRRHH se conecta a ese servicio privado por la red interna de Docker.

## Alcance

La solución es una primera versión funcional y configurable. No constituye certificación legal, liquidación de nómina ni prueba de vida biométrica certificada. Antes de producción requiere políticas de privacidad y retención, validación con personal autorizado, respaldo/recuperación, pruebas de carga y revisión normativa de cada organización.
