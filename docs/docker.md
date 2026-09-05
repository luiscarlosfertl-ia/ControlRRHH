# ControlRRHH + FaceVision en Docker

## Alcance y requisitos

Tres contenedores Linux: `app` (frontend compilado + API), `facevision` (perfil RRHH CPU) y `mongo` (base autenticada independiente). No usa ni altera el Mongo o FaceVision de Origen, ni importa datos de la instalación nativa. El puerto local 3110 evita colisionar con su puerto 3100.

Requiere Docker Engine o Docker Desktop con contenedores Linux y Docker Compose v2 con `up --wait`; Node 22+ y Python 3.12 para preparar/construir desde código. FaceVision se construye en el equipo autorizado desde el SDK privado; para ejecutar imágenes ya construidas no hace falta el SDK original ni Python del host. La primera construcción necesita Internet para dependencias; los contenedores no descargan modelos al arrancar. Orientado a Linux amd64/PC x86-64 (Mongo requiere CPU compatible/AVX). CPU, sin GPU en esta receta. Dimensionar RAM/CPU con pruebas de carga; comenzar con 8 GB RAM disponibles para Docker y 4 CPU es una referencia, no un mínimo validado.

**Estado de esta entrega:** Docker no está instalado/disponible en el PATH de la máquina de desarrollo. Se validaron código, pruebas y el perfil FaceVision con modelos locales; no se construyeron imágenes ni se probó Compose en un motor Docker. Ejecutar los pasos siguientes y validar antes de uso operativo.

El perfil RRHH extrae mediante AST las funciones activas de `sdk-faceVision/app.py` y copia `hr_fast_face.py`, con SHA-256 de procedencia. Conserva Haar para presencia, InsightFace buffalo_l CPU y el contrato de plantillas `facevision-insightface-single-v1`. Incluye `/face-auth/detect`, `/enroll`, `/search` y `/health`; **no** incluye OCR/DNI, RENAPER, pagos, panel QA, sesiones ni el resto de la aplicación FaceVision. El runtime generado queda en `.deploy/facevision`, excluido de Git, y se usa sólo como contexto privado de construcción. El SDK original no se modifica.

Los modelos preentrenados de InsightFace tienen condiciones distintas de la licencia del código. Verificar derechos de uso comercial y redistribución antes de copiar o entregar pesos: [licencia oficial](https://github.com/deepinsight/insightface#license). No se descargan ni incluyen automáticamente en las imágenes. El indicador `--model-rights-confirmed` es una confirmación del operador, no una concesión de licencia.

## Publicación pública y FaceVision privado

El repositorio `luiscarlosfertl-ia/ControlRRHH` y la imagen de aplicación se publican. La única imagen prevista en GitHub Container Registry es:

- `ghcr.io/luiscarlosfertl-ia/control-rrhh-app`

FaceVision **no se publica** como código ni como paquete. Su runtime se genera en `.deploy/facevision` desde el SDK privado y su imagen `controlrrhh-facevision:VERSION` se construye localmente. Tampoco se publican modelos, datos, claves, certificados, capturas, embeddings o backups.

La visibilidad del repositorio y del paquete GHCR se configura por separado. La primera publicación puede crear el paquete privado; un administrador debe abrirlo en GitHub, entrar a **Package settings** y usar **Change visibility → Public**. GitHub advierte que un paquete público no puede volver a privado. Hacer pública la imagen permite descargar y extraer sus capas, incluyendo backend y frontend compilado. La visibilidad pública no define por sí sola una licencia de uso.

El workflow `.github/workflows/publish-containers.yml` se ejecuta únicamente al subir una etiqueta `vX.Y.Z`. Prueba la aplicación, compila el frontend y publica sólo `control-rrhh-app` con etiquetas `X.Y.Z`, `X.Y` y `latest`, SBOM y atestación de procedencia. Usa el `GITHUB_TOKEN` temporal del workflow; no requiere guardar un token personal.

Para publicar una nueva versión de la app:

```powershell
npm test
npm run build
git add .
git commit -m "Preparar ControlRRHH 0.1.1"
git tag v0.1.1
git push origin main --follow-tags
```

El workflow no accede a `C:\codigosNode\sdk-faceVision` y no puede construir ni publicar FaceVision.

Para instalar o actualizar desde las imágenes públicas:

```powershell
node scripts/docker.mjs prepare --sdk "C:\codigosNode\sdk-faceVision" --python "C:\codigosNode\sdk-faceVision\venv312\Scripts\python.exe"
node scripts/docker.mjs prepare --models "C:\Users\luis_\.insightface\models\buffalo_l" --model-rights-confirmed
node scripts/docker.mjs build-facevision 0.1.1
node scripts/docker.mjs pull 0.1.1 --registry
node scripts/docker.mjs start --registry --lan
node scripts/docker.mjs status --registry --lan
```

Omitir `--lan` si se usa sólo localhost. `build-facevision` refresca el perfil privado desde `.deploy/source.json`; `pull` descarga sólo la app pública. Ambas imágenes deben tener la misma versión. `start --registry` cambia únicamente la procedencia de la app y conserva FaceVision local, el volumen Mongo, los secretos y los modelos.

## 1. Preparar una vez

Desde PowerShell:

```powershell
cd C:\Users\luis_\Documents\Playground\ControlRRHH
docker version
docker compose version
node scripts/docker.mjs prepare --sdk "C:\codigosNode\sdk-faceVision" --python "C:\codigosNode\sdk-faceVision\venv312\Scripts\python.exe"
```

Genera `.deploy/compose.env`, contexto FaceVision y claves aleatorias locales. **Volver a ejecutar prepare no regenera claves ni cambia la versión elegida.** No se imprimen los secretos. Guardar copia protegida de `.deploy/secrets`; especialmente `biometric.key`, cuya pérdida impide descifrar fotos y plantillas. Mongo usa un usuario `controlrrhh` con permisos sólo sobre su base y otro administrador interno para inicialización/backups.

Después de verificar los derechos correspondientes, incorporar los cinco archivos `.onnx` del mismo motor:

```powershell
node scripts/docker.mjs prepare --models "C:\Users\luis_\.insightface\models\buffalo_l" --model-rights-confirmed
```

No cambiar los pesos de un sistema enrolado sin un plan de compatibilidad y nuevo enrolamiento. Si existen archivos distintos, el script bloquea su reemplazo.

`.deploy` está fuera de Git y del build de la app. En Linux su directorio padre es privado; archivos de secretos/modelos son legibles por los usuarios no-root dentro de los contenedores mediante montajes de sólo lectura. En Windows revisar ACL de `.deploy`, restringiéndola al operador, administradores y servicio Docker. Compose local monta archivos: **no es una bóveda de secretos cifrada**. Cifrar disco y backups; no compartir la carpeta completa públicamente.

## 2. Construir e iniciar

```powershell
node scripts/docker.mjs build 0.1.0
node scripts/docker.mjs start
node scripts/docker.mjs status
```

Abrir **http://localhost:3110**. Crear el primer administrador: no hay cuenta ni contraseña predeterminada. La base nueva estará vacía. Cambiar `HTTP_PORT` en `.deploy/compose.env` si hace falta, luego iniciar otra vez.

`start` ejecuta `up -d --no-build --wait`: inicia Mongo, carga modelos FaceVision, comprueba salud y recién después inicia la API. `restart: unless-stopped` permite recuperar servicios cuando el motor Docker arranca. No inicia Docker por sí mismo: en Windows habilitar inicio de Docker Desktop al iniciar sesión; para servidor sin sesión, usar un host Linux con Docker habilitado al arranque. Los servicios detenidos explícitamente con `stop` requieren `start`.

## 3. Tablets y cámaras en la LAN

HTTP por IP no habilita la cámara del navegador. Preparar un certificado TLS válido para el nombre/IP que usarán las tablets y confiable en esos dispositivos; no omitir validación de certificados. Colocar certificado/cadena en `.deploy/tls/server.pem` y clave privada en `.deploy/tls/server-key.pem`, legibles dentro del contenedor y protegidos por la carpeta privada del host.

Primero crear el administrador local, después habilitar LAN:

```powershell
node scripts/docker.mjs start --lan
```

Abrir `https://NOMBRE-O-IP-DEL-SERVIDOR:3445` usando el nombre incluido en el certificado, ingresar y generar los enlaces de terminal desde esa URL. Permitir cámara en la tablet. **La cámara es la de la tablet**: no se monta webcam USB en Docker. HTTPS se termina directamente en Node; no se habilita confianza general en cabeceras proxy.

Configurar `LAN_BIND` y `HTTPS_PORT` en `.deploy/compose.env`. Abrir únicamente ese puerto en firewall para la LAN autorizada, nunca Mongo 27017 ni FaceVision 8007. No se abrió firewall ni se instaló certificado en esta entrega. Usar `--lan` también al actualizar/iniciar esa instalación; `start` sin el override retira la configuración HTTPS. Los certificados no se renuevan automáticamente.

## 4. Nueva versión después de cambiar código

```powershell
node scripts/docker.mjs backup --lan
npm test
node scripts/docker.mjs build 0.1.1
node scripts/docker.mjs start --lan
node scripts/docker.mjs status --lan
```

Omitir `--lan` si se usa sólo localhost. Las pruebas requieren el Mongo local de desarrollo y usan bases temporales: no se ejecutan contra el volumen operativo de Docker. `build` refresca el perfil desde el SDK guardado en `.deploy/source.json`, compila frontend y crea `controlrrhh-app:0.1.1` y `controlrrhh-facevision:0.1.1`. No reutilizar etiquetas: si ya existen localmente, se rechaza la reconstrucción para conservar rollback. Sólo cambia `APP_VERSION` tras un build exitoso.

No hace falta recrear datos: `start` reemplaza los contenedores que cambiaron y conserva el volumen `controlrrhh_mongo_data` y los secretos. No cambiar el nombre del proyecto Compose ni borrar `.deploy`. Nunca usar `docker compose down -v` ni limpiar volúmenes de esta instalación. `down` sin `-v` tampoco es necesario para actualizar.

Versionar cambios de esquema por separado, con migraciones y prueba de restauración antes del despliegue. La etiqueta identifica una entrega; bases `node:22-bookworm-slim`, `python:3.12-slim-bookworm` y `mongo:8.0`, y dependencias Python transitivas pueden recibir revisiones. Para repetibilidad binaria conservar las imágenes exportadas; en producción fijar además sus digests. No cambiar de versión mayor de Mongo sin el procedimiento oficial de compatibilidad.

## 5. Backup y rollback

`backup` detiene sólo `app`, exporta `control_rrhh` con `mongodump --gzip --archive` y reinicia el contenedor de app si antes estaba corriendo, incluso si falla la copia. La pausa evita escrituras durante el dump en Mongo standalone. No usar mientras otra integración escriba directamente en esa base. El archivo queda en `.deploy/backups`; no contiene los secretos. Respaldar claves, config y certificados por separado, en almacenamiento cifrado.

Para volver al código anterior que aún está disponible:

```powershell
node scripts/docker.mjs select 0.1.0
node scripts/docker.mjs start --lan
```

Esto **no restaura ni revierte datos**. Sólo es seguro si el esquema sigue siendo compatible. Si requiere restauración, detener escritores y restaurar primero en una instalación aislada, con la misma clave biométrica, validando conteos y descifrado. No automatizamos sobrescritura de la base ni `--drop`.

## 6. Entregar en otra PC/servidor

```powershell
node scripts/docker.mjs save
```

Genera `releases/controlrrhh-VERSION.tar` con ambas imágenes y Mongo (debe haber sido descargado al iniciar). No contiene datos, secretos, modelos ni certificados. El transporte completo necesita:

1. Ese archivo de imágenes, `compose.yaml`, `compose.lan.yaml`, `deploy/mongo-init.js`, `deploy/mongo-health.js` y `scripts/docker.mjs` respetando estructura.
2. `.deploy/compose.env`, el contexto pequeño `.deploy/facevision`, `.deploy/models/buffalo_l` con sus licencias/derechos y directorios `.deploy/backups`/`.deploy/tls`.
3. Secretos propios de la instalación destino: para una copia de la instalación, transferir los existentes de forma segura; para una instalación nueva, preparar en desarrollo una carpeta separada con nuevas claves, nunca regenerarlas sobre una base existente. No entregar la misma clave a clientes independientes.

En destino, con Docker Linux y Node instalados:

```powershell
docker image load --input releases/controlrrhh-0.1.1.tar
node scripts/docker.mjs start
```

Para iniciar sin Node: `docker compose --env-file .deploy/compose.env -f compose.yaml up -d --no-build --wait --wait-timeout 300` (agregar `-f compose.lan.yaml` antes de `up` para LAN). El contexto fuente FaceVision no se usa al arrancar con imágenes ya cargadas y `--no-build`.

El volumen de Mongo no viaja dentro de la imagen. Para trasladar datos usar dump/restore con misma versión mayor o compatibilidad y misma clave de cifrado, en destino vacío y sin escrituras. Nunca compartir archivos de volumen Mongo entre el servicio nativo y Docker.

## 7. Migrar la instalación nativa actual (opcional, no realizado)

El Docker inicial crea una base vacía; no continuará los datos actuales hasta migrarlos. Planificar una ventana sin fichadas, respaldar exclusivamente `control_rrhh`, copiar **la misma** clave desde `.local/biometric.key` (32 bytes binarios) o desde el proveedor de `BIOMETRIC_KEY` actual al secreto Docker, y restaurar únicamente esa base en un destino vacío. No reemplazar clave de una instalación Docker que ya tenga biometría. La aplicación admite secreto de 32 bytes o 64 caracteres hex. Validar catálogos y captura autorizada, luego redirigir terminales. No tocar bases de Origen ni el SDK compartido.

## Operación y validación de entrega

```powershell
node scripts/docker.mjs logs
node scripts/docker.mjs status
node scripts/docker.mjs stop
```

Antes de producción: verificar los tres servicios saludables, alta/login propio, flujo real autorizado de tres capturas/prueba/fichado, reporte, persistencia tras recrear app, copia/restauración aislada y tablet HTTPS. La prueba sintética de modelo no prueba identidad real ni resistencia a fotografías.

Referencias: [orden y salud en Compose](https://docs.docker.com/compose/how-tos/startup-order/), [secretos por archivo](https://docs.docker.com/compose/how-tos/use-secrets/), [reinicio automático](https://docs.docker.com/engine/containers/start-containers-automatically/), [backup Mongo](https://www.mongodb.com/docs/database-tools/mongodump/).
