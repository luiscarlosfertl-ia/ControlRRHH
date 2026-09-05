# ControlRRHH

- Aplicación nueva e independiente. No mutar bases, cuentas o capturas de Origen Ingenio.
- Leer docs/architecture.md y reconstruir UI → API → servicio → modelo antes de modificar.
- Listas y relaciones usan ResourceTable de frontend/src/components.jsx sobre PatternFly. Páginas 50, filtros server-side, orden, acciones sticky. Calendario es el adaptador temporal documentado.
- No mezclar captura cruda con cálculo de turnos. No aprobar jornadas ni registrar rostros reales como parte de pruebas automatizadas.
- Nunca imprimir contraseñas, claves de terminal, BIOMETRIC_KEY, fotos o embeddings en logs.
- Mantener modelos y validaciones alineados; escribir pruebas de regresión para cada cambio de lógica temporal.
- npm test usa exclusivamente bases temporales control_rrhh_test_<hex>. No borrar la base operativa.
