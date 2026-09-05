# ControlRRHH on-premise en Docker

## Dos ediciones, una misma aplicación

ControlRRHH se instala sin usar ni modificar la base, las cuentas o la biometría de Origen Ingenio.

- **Edición pública:** `app` + `mongo`. Incluye personas, grupos, horarios, rotaciones, fichadas supervisadas, procesamiento, calendario, revisión, ausencias, extensiones, auditoría e informes. No utiliza cámaras ni biometría.
- **Edición biométrica:** agrega `facevision` privado y habilita alta de tres rostros, prueba facial y terminales desacopladas. La lógica laboral y la base siguen siendo las mismas.

El Compose base contiene únicamente los dos servicios públicos. `compose.facevision.yaml` agrega la dependencia privada cuando se usa `--facevision`. Esta separación evita que una instalación pública falle por no disponer del motor facial.

Requisitos: Docker Engine o Docker Desktop con contenedores Linux, Docker Compose v2 con `up --wait` y Node.js 22 o superior para el asistente multiplataforma. La primera construcción necesita Internet. El puerto local predeterminado es 3110.

## Instalación pública desde el código

```powershell
git clone https://github.com/luiscarlosfertl-ia/ControlRRHH.git
cd ControlRRHH
npm install
node scripts/docker.mjs prepare
node scripts/docker.mjs build 0.1.0
node scripts/docker.mjs start
node scripts/docker.mjs status
```

Abrir **http://localhost:3110** y crear el primer administrador. No existe una cuenta ni contraseña predeterminada. `prepare` crea `.deploy/compose.env` y secretos aleatorios; repetirlo conserva las claves existentes. La base comienza vacía y persiste en el volumen `controlrrhh_mongo_data`.

En esta edición la API publica `features.faceVision=false`, oculta acciones biométricas y conserva **Registro supervisado** en Fichadas. La carga manual requiere persona, instante, entrada/salida y motivo; después sigue el mismo procesamiento y auditoría.

La imagen pública `0.1.0` ya está disponible en GHCR. Para instalarla sin construir la aplicación:

```powershell
node scripts/docker.mjs prepare
node scripts/docker.mjs pull 0.1.0 --registry
node scripts/docker.mjs start --registry
```

La única imagen pública es `ghcr.io/luiscarlosfertl-ia/control-rrhh-app`. Las etiquetas `0.1.0`, `0.1` y `latest` se publicaron con el mismo digest, SBOM y atestación; la descarga anónima está habilitada. FaceVision no se publica en GHCR.

## Instalación con FaceVision privado

El runtime facial no está en Git. En un equipo autorizado se genera dentro de `.deploy/facevision` desde el SDK privado:

```powershell
node scripts/docker.mjs prepare --sdk "C:\codigosNode\sdk-faceVision" --python "C:\codigosNode\sdk-faceVision\venv312\Scripts\python.exe"
node scripts/docker.mjs prepare --models "C:\Users\luis_\.insightface\models\buffalo_l" --model-rights-confirmed
node scripts/docker.mjs build 0.1.0
node scripts/docker.mjs build-facevision 0.1.0
node scripts/docker.mjs start --facevision
node scripts/docker.mjs status --facevision
```

`build-facevision` exige `hr_runtime.py`, `hr_fast_face.py` y `source-manifest.json` en `.deploy/facevision`; nunca los genera dentro del árbol Git. El overlay establece `FACEVISION_ENABLED=true`, conecta la app a `http://facevision:8007` y espera su healthcheck antes de iniciar la API.

Los modelos InsightFace no se descargan ni publican. El operador debe comprobar sus derechos de uso y distribución; `--model-rights-confirmed` registra esa decisión operativa, no concede una licencia. No cambiar pesos en una instalación enrolada sin plan de compatibilidad y nuevo enrolamiento.

Para combinar app pública con FaceVision local:

```powershell
node scripts/docker.mjs pull 0.1.0 --registry
node scripts/docker.mjs start --registry --facevision
```

## Secretos y datos

`.deploy` está ignorado por Git y por el build de la app. Contiene configuración, contexto FaceVision privado, modelos, TLS, backups y secretos. No compartir esa carpeta públicamente.

Respaldar especialmente:

- `.deploy/secrets/biometric.key`;
- `.deploy/secrets/mongo-app.txt` y `mongo-root.txt`;
- `.deploy/compose.env`;
- certificados TLS y backups de Mongo.

Perder `biometric.key` impide descifrar catálogos y capturas biométricas. En Windows se deben restringir las ACL de `.deploy`; en cualquier host conviene usar cifrado de disco y almacenamiento protegido para las copias.

## Inicio y salud

`start` ejecuta `docker compose up -d --no-build --wait`. Mongo debe superar su healthcheck antes de que se cree la app. Con `--facevision`, también espera el healthcheck facial. `restart: unless-stopped` recupera los contenedores cuando vuelve a iniciar el motor Docker, pero no inicia Docker por sí mismo.

```powershell
node scripts/docker.mjs logs
node scripts/docker.mjs status
node scripts/docker.mjs stop
```

No exponer Mongo 27017 ni FaceVision 8007 al host o a Internet. La red entre servicios es interna; sólo se publica el puerto web.

## Tablets y cámaras en la LAN

El modo biométrico requiere HTTPS confiable para usar la cámara desde una tablet. Colocar certificado y clave en `.deploy/tls/server.pem` y `.deploy/tls/server-key.pem`, definir `LAN_BIND`/`HTTPS_PORT` y ejecutar:

Antes de habilitar LAN, iniciar una vez sin `--lan`, abrir `http://127.0.0.1:3110` y crear la cuenta administradora. La composición base sólo publica HTTP en el loopback del host y admite el puente privado de Docker durante ese alta única; la superposición LAN deshabilita expresamente esa confianza.

```powershell
node scripts/docker.mjs start --facevision --lan
```

Abrir `https://NOMBRE-O-IP-DEL-SERVIDOR:3445` usando un nombre incluido en el certificado y confiable en la tablet. La cámara utilizada es la del dispositivo que abre el enlace; no se monta dentro del contenedor. Abrir en el firewall sólo el puerto HTTPS para la LAN autorizada.

La edición pública puede exponerse por HTTPS con `start --lan`, pero no solicita cámara.

## Actualización

Para una actualización pública construida localmente:

```powershell
node scripts/docker.mjs backup
npm test
node scripts/docker.mjs build 0.1.1
node scripts/docker.mjs start
node scripts/docker.mjs status
```

Si también cambió el motor privado:

```powershell
node scripts/docker.mjs build-facevision 0.1.1
node scripts/docker.mjs start --facevision
```

Para una app publicada:

```powershell
node scripts/docker.mjs backup --registry
node scripts/docker.mjs pull 0.1.1 --registry
node scripts/docker.mjs start --registry
```

Agregar `--facevision` y/o `--lan` en todas las operaciones que correspondan a esa instalación. Las etiquetas no se reutilizan: el asistente rechaza sobrescribir imágenes locales y sólo actualiza `APP_VERSION` después de una construcción o descarga correcta.

`start` recrea servicios y conserva el volumen y los secretos. No usar `docker compose down -v`; borraría la base. Una etiqueta anterior revierte código, no datos ni migraciones.

## Backup, rollback y traslado

`backup` detiene únicamente la app, ejecuta `mongodump` y la reinicia si estaba activa. El archivo queda en `.deploy/backups`; no contiene secretos.

```powershell
node scripts/docker.mjs backup
node scripts/docker.mjs select 0.1.0
node scripts/docker.mjs start
```

Para exportar las imágenes públicas y Mongo:

```powershell
node scripts/docker.mjs save
```

Para incluir la imagen privada en una entrega autorizada:

```powershell
node scripts/docker.mjs save --facevision
```

El TAR no incluye base, secretos, certificados ni modelos. En destino se deben transferir esos elementos por un canal protegido o generar claves nuevas para una instalación vacía. No reutilizar la misma clave entre clientes independientes.

## Publicación de versiones

El workflow `.github/workflows/publish-containers.yml` responde sólo a etiquetas semánticas `vX.Y.Z`, ejecuta pruebas y build, y publica exclusivamente `control-rrhh-app` con SBOM y atestación de procedencia. FaceVision no aparece como contexto, matriz o paquete del workflow.

```powershell
npm test
npm run build
git tag v0.1.0
git push origin v0.1.0
```

## Validación operativa requerida

Antes de declarar una versión productiva se debe comprobar desde una instalación vacía:

1. construcción/descarga y healthchecks;
2. alta inicial y login;
3. creación de personas, horarios y asignaciones;
4. entrada/salida supervisada, procesamiento, revisión e informe;
5. persistencia después de recrear contenedores;
6. backup y restauración aislada;
7. con biometría: alta de tres capturas, prueba, fichaje y tablet HTTPS;
8. reinicio del host y recuperación del servicio.

La aplicación no es liquidación salarial ni certificación legal. FaceVision tampoco representa prueba de vida certificada.

Referencias: [perfiles de Compose](https://docs.docker.com/compose/how-tos/profiles/), [orden y healthchecks](https://docs.docker.com/compose/how-tos/startup-order/), [secretos](https://docs.docker.com/compose/how-tos/use-secrets/) y [backup Mongo](https://www.mongodb.com/docs/database-tools/mongodump/).
