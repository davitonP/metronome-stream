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

## Requisitos
- Node.js 18+ (recomendado 20+)
- pnpm (recomendado, existe `pnpm-lock.yaml`)

## Instalación
```bash path=null start=null
pnpm install
```

## Ejecutar en desarrollo
```bash path=null start=null
pnpm dev
```
Servidor disponible por defecto en `http://localhost:3000`.

## Ejecutar en producción/local simple
```bash path=null start=null
pnpm start
```

## Scripts disponibles
- `pnpm start`: inicia el servidor (`server/index.js`)
- `pnpm dev`: inicia con `--watch`
- `pnpm build:css`: observa y compila `public/assets/css/index.css` a `public/assets/css/output.css`

## Rutas HTTP actuales
- `GET /` → `public/metronome.html`
- `GET /metronome` → `public/metronome.html`
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
