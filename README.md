# secuencias-stream
Aplicación Node.js para sincronizar un metrónomo en tiempo real entre varios dispositivos usando Socket.IO y corrección horaria tipo NTP.

## Qué hace este proyecto
- Sincroniza tiempo cliente-servidor para reducir drift entre dispositivos.
- Permite agrupar usuarios por sesión (`sessionId`) para controlar un metrónomo compartido.
- Programa el inicio del metrónomo con tiempo autoritativo del servidor.
- Permite ajustar latencia de audio en el cliente para afinar la percepción de sincronía.
- Sirve archivos de audio con soporte de `Range requests` (streaming parcial) en `/audio/:filename`.

## Stack técnico
- Node.js + Express 5
- Socket.IO
- `precise-time-ntp` para sincronización temporal
- Tailwind CSS (CLI y versión browser, según la vista)
- Frontend del metrónomo: Vue 3 (Composition API) + Vite en `client/`

## Requisitos
- Node.js 18+ (recomendado 20+)
- pnpm (recomendado, existe `pnpm-lock.yaml`)

## Instalación
```bash path=null start=null
pnpm install
```

## Ejecutar en desarrollo
El frontend del metrónomo vive en `client/` (Vue 3 + Vite) y el backend en `server/`. En desarrollo se corren **dos procesos**:
```bash path=null start=null
# Terminal 1 · backend Express + Socket.IO (puerto 3000)
pnpm dev

# Terminal 2 · dev server de Vite con HMR (proxy a :3000 para /socket.io, /audio y /assets)
pnpm dev:client
```
Abre la URL que imprime Vite (por defecto `http://localhost:5173`). El backend queda en `http://localhost:3000`.
La primera vez, instala las dependencias del cliente:
```bash path=null start=null
pnpm --dir client install
```

## Ejecutar en producción/local simple
Compila la SPA y luego arranca el servidor, que sirve el build en `/metronome`:
```bash path=null start=null
pnpm build:client
pnpm start
```
El build se genera en `server/public-dist/` y Express lo sirve automáticamente si existe.

## Scripts disponibles
- `pnpm start`: inicia el servidor (`server/index.js`)
- `pnpm dev`: inicia el backend con `--watch`
- `pnpm dev:client`: dev server de Vite (frontend Vue con HMR y proxy)
- `pnpm build:client`: compila la SPA de Vue a `server/public-dist/`
- `pnpm build:css`: observa y compila `public/assets/css/index.css` a `public/assets/css/output.css` (vistas legacy)

## Rutas HTTP actuales
- `GET /` → `public/index.html` (legacy)
- `GET /metronome` → SPA de Vue (`server/public-dist/index.html`) si hay build; si no, `public/metronome.html`
- `GET /timeSync` → `public/timeSync.html`
- `GET /audio/:filename` → streaming de audio desde `public/assets/secuencias/` (incluye soporte de rango)

## Flujo de sincronización (resumen)
1. El cliente realiza múltiples muestras de ida/vuelta (`time-sync`).
2. Calcula un offset de reloj con las muestras de menor latencia.
3. Al iniciar el metrónomo, el servidor asigna `startAt` en el futuro.
4. Todos los clientes de la misma sesión reciben `metronome-start` y programan audio en base a ese `startAt`.

## Estructura principal
```text path=null start=null
server/
  index.js                # API HTTP + Socket.IO + estado de sesiones
public/
  metronome.html          # UI principal del metrónomo sincronizado
  timeSync.html           # vista de prueba de sincronización
  assets/js/
    timeSync.js
    metronome.js
    utils.js
  assets/secuencias/      # audios y sonidos del metrónomo
```

## Nota sobre archivos legacy/prototipo
Existen archivos como `public/index.html`, `public/master.html`, `public/assets/js/client.js` y `public/assets/js/client-webaudio.js` que usan eventos/endpoints (por ejemplo `/songs`, `start`, `pause`) que hoy no están implementados en `server/index.js`.

Si vas a evolucionar la app, toma `metronome.html` + `timeSync.js` + `metronome.js` como base actual.

## Licencia
MIT. Ver `LICENSE`.
