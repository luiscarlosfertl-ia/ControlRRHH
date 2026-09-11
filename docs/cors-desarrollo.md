# Diagnóstico de CORS y `Origen no autorizado`

## Qué protege la aplicación

En desarrollo hay dos servidores:

```text
Navegador (http://localhost:5190)
  -> proxy Vite (/api)
  -> API Express (http://localhost:3100)
```

El navegador sólo conoce `localhost:5190`: el `fetch` usa una URL relativa,
`/api/...`. Por eso no necesita CORS entre el frontend y el proxy. La API, por
su parte, comprueba las peticiones que modifican datos: el encabezado `Origin`
debe coincidir con el encabezado `Host`. Esta es una defensa contra CSRF; evita
que otra web pueda usar la cookie de sesión para enviar cambios.

## El caso que apareció

La solicitud era `POST /api/auth/setup`, con `Origin: http://localhost:5190`,
pero al llegar a Express llevaba `Host: localhost:3100`. Los puertos son parte
del origen, así que no coinciden y la API responde `403 {"message":"Origen no
autorizado"}`.

No es correcto solucionar eso habilitando `Access-Control-Allow-Origin: *` ni
desactivando la validación de origen: permitiría solicitudes de sitios ajenos y
debilitaría la protección de la sesión.

La configuración de `frontend/vite.config.js` deja explícito
`changeOrigin: false`. Así Vite conserva `Host: localhost:5190` al reenviar
`/api`, que coincide con el `Origin` legítimo del navegador.

## Lista de verificación si vuelve a ocurrir

1. Confirmá la URL: con `npm run dev` abrí exactamente
   `http://localhost:5190`; no uses `127.0.0.1`, una IP LAN ni otro puerto.
   `localhost` y `127.0.0.1` son orígenes distintos.
2. En DevTools → Network, abrí la petición fallida. Para una escritura debe
   verse `Origin: http://localhost:5190`. Un `403` con el texto **Origen no
   autorizado** viene de la protección CSRF, no de una política CORS del
   navegador.
3. Verificá que la llamada de frontend sea relativa (`/api/...`) y no
   `http://localhost:3100/api/...`. La primera pasa por Vite; la segunda es
   una llamada cross-origin y no es el recorrido soportado.
4. Revisá `frontend/vite.config.js`: el proxy `/api` debe apuntar a 3100 y
   conservar `changeOrigin: false`.
5. Reiniciá `npm run dev` después de cambiar `vite.config.js`. Vite lee esta
   configuración sólo al iniciar. También verificá que no haya otro backend
   ocupando el puerto 3100.
6. Si el navegador muestra un mensaje que contiene literalmente
   **blocked by CORS policy**, inspeccioná la URL solicitada: normalmente
   indica que se saltó el proxy. No agregues CORS amplio a la API sin definir
   primero qué origen externo y qué autenticación deben permitirse.

En producción la web compilada la sirve el mismo Express/Nginx local, por lo
que navegador y API comparten origen. Para una futura UI en otro dominio se
debe diseñar una lista explícita de orígenes permitidos, método/headers y
política de cookies; no reutilizar el proxy de desarrollo como solución.
