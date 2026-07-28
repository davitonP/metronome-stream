import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// Backend Express + Socket.IO durante el desarrollo
const BACKEND = 'http://localhost:3000'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    proxy: {
      // WebSocket + long-polling de Socket.IO
      '/socket.io': { target: BACKEND, ws: true, changeOrigin: true },
      // Streaming de audio y assets legacy servidos por Express
      '/audio': { target: BACKEND, changeOrigin: true },
      '/assets': { target: BACKEND, changeOrigin: true },
    },
  },
  build: {
    // Express sirve este directorio en producción
    outDir: fileURLToPath(new URL('../server/public-dist', import.meta.url)),
    emptyOutDir: true,
  },
})
