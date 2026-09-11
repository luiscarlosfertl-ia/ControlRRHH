# ControlRRHH on-premise en Docker

## Distribución completa

ControlRRHH se instala sin usar ni modificar la base, las cuentas o la biometría de Origen Ingenio.

- `app` + `mongo` + `facevision` se inician en conjunto. Incluye personas, grupos, horarios, rotaciones, alta de tres rostros, prueba facial, terminales, fichadas supervisadas, procesamiento, calendario, revisión, ausencias, extensiones, auditoría e informes.
- FaceVision y Mongo sólo viven en la red interna de Docker. La imagen facial lleva el runtime CPU y los modelos requeridos; las capturas, plantillas enroladas, secretos y base se crean y permanecen en cada instalación.

El Compose base contiene los tres servicios y espera los healthchecks de Mongo y FaceVision. `compose.facevision.yaml` queda sólo como archivo de compatibilidad para comandos antiguos.

Requisitos: Docker Engine o Docker Desktop con contenedores Linux, Docker Compose v2 con `up --wait` y Node.js 22 o superior para el asistente multiplataforma. La primera construcción necesita Internet. El puerto local predeterminado es 3110.

## Instalación pública desde el código

```powershell
git clone https://github.com/luiscarlosfertl-ia/ControlRRHH.git
cd ControlRRHH
npm install
node scripts/docker.mjs prepare
node scripts/docker.mjs build 0.1.2
node scripts/docker.mjs start
node scripts/docker.mjs status
```

Abrir **http://localhost:3110** y crear el primer administrador. No existe una cuenta ni contraseña predeterminada. `prepare` crea `.deploy/compose.env` y secretos aleatorios; repetirlo conserva las claves existentes. La base comienza vacía y persiste en el volumen `controlrrhh_mongo_data`.

La API publica `features.faceVision=true`: en **Personas** aparecen **Registrar rostros** y **Probar rostro · sin fichar**. **Registro supervisado** se conserva como alternativa auditada.

La versión completa `0.1.2` se publica en GHCR. Para instalarla sin construir la aplicación:

```powershell
node scripts/docker.mjs prepare
node scripts/docker.mjs pull 0.1.2 --registry
node scripts/docker.mjs start --registry
```

Cada versión completa publica `ghcr.io/luiscarlosfertl-ia/control-rrhh-app` y `ghcr.io/luiscarlosfertl-ia/control-rrhh-facevision`, con la misma etiqueta, SBOM y procedencia. `pull` descarga ambas imágenes.

## Actualizar el runtime facial

El perfil RRHH publicado vive en `deploy/facevision` y contiene un manifiesto de funciones exportadas desde el SDK autorizado. Para regenerarlo antes de una nueva versión, ejecutar `node scripts/docker.mjs prepare --sdk "C:\codigosNode\sdk-faceVision" --python "C:\codigosNode\sdk-faceVision\venv312\Scripts\python.exe"`, revisar el diff y publicar una nueva etiqueta. El build descarga los modelos `buffalo_l` una vez y los deja dentro de la imagen; el usuario final no debe aportar SDK, modelos ni usar `--facevision`.

## Secretos y datos

`.deploy` está ignorado por Git y por el build de la app. Contiene configuración local, TLS, backups y secretos. No compartir esa carpeta públicamente.

Respaldar especialmente:

- `.deploy/secrets/biometric.key`;
- `.deploy/secrets/mongo-app.txt` y `mongo-root.txt`;
- `.deploy/compose.env`;
- certificados TLS y backups de Mongo.

Perder `biometric.key` impide descifrar catálogos y capturas biométricas. En Windows se deben restringir las ACL de `.deploy`; en cualquier host conviene usar cifrado de disco y almacenamiento protegido para las copias.

## Inicio y salud

`start` ejecuta `docker compose up -d --no-build --wait`. Mongo y FaceVision deben superar sus healthchecks antes de que se cree la app. `restart: unless-stopped` recupera los contenedores cuando vuelve a iniciar el motor Docker, pero no inicia Docker por sí mismo.

```powershell
node scripts/docker.mjs logs
node scripts/docker.mjs status
node scripts/docker.mjs stop
```

No exponer Mongo 27017 ni FaceVision 8007 al host o a Internet. La red entre servicios es interna; sólo se publica el puerto web.

## Tablets y cámaras en la LAN

El modo biométrico requiere HTTPS confiable para usar la cámara desde una tablet. Colocar certificado y clave en `.deploy/tls/server.pem` y `.deploy/tls/server-key.pem`, definir `LAN_BIND`/`HTTPS_PORT` y ejecutar:

Antes de habilitar LAN, iniciar una vez sin `--lan`, abrir `http://localhost:3110` y crear la cuenta administradora. La composición base sólo publica HTTP en el loopback del host y admite el puente privado de Docker durante ese alta única; la superposición LAN deshabilita expresamente esa confianza.

```powershell
node scripts/docker.mjs start --lan
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

Para una app publicada:

```powershell
git pull --ff-only
node scripts/docker.mjs backup --registry
node scripts/docker.mjs pull 0.1.2 --registry
node scripts/docker.mjs start --registry
```

`git pull --ff-only` incorpora el Compose y el asistente que conocen el servicio facial. Agregar `--lan` cuando corresponda. Las etiquetas no se reutilizan: el asistente rechaza sobrescribir imágenes locales y sólo actualiza `APP_VERSION` después de una construcción o descarga correcta. No usar `docker compose down -v`: borraría la base y los catálogos faciales.

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

El TAR incluye las imágenes app, FaceVision y Mongo, pero no la base, secretos ni certificados. En destino se deben transferir esos elementos por un canal protegido o generar claves nuevas para una instalación vacía. No reutilizar la misma clave entre clientes independientes.

## Publicación de versiones

El workflow `.github/workflows/publish-containers.yml` responde a etiquetas semánticas `vX.Y.Z`, ejecuta pruebas y build, y publica ambas imágenes con SBOM y atestación de procedencia.

```powershell
npm test
npm run build
git tag v0.1.2
git push origin v0.1.2
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
