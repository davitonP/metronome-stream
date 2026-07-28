import { ref, onMounted, onUnmounted } from 'vue'
import { useSocket } from './useSocket.js'

const NUM_SAMPLES = 20 // muestras para mayor precisión
const RESYNC_INTERVAL = 30000 // re-sincroniza cada 30s

function getNow() {
  const n = Date.now()
  return Number.isFinite(n) ? n : new Date().getTime()
}

// Estado singleton compartido
const timeOffset = ref(0)
const syncCompleted = ref(false)
const lastRtt = ref(0)

// Suscriptores que reaccionan a cada actualización de sync (p. ej. el metrónomo)
const listeners = new Set()

/** Tiempo sincronizado con el servidor (ms). */
export function getSyncTime() {
  return getNow() + timeOffset.value
}

let initialized = false
let resyncTimer = null

function syncTime(socket) {
  const samples = []

  function takeSample(index) {
    if (index >= NUM_SAMPLES) {
      if (samples.length === 0) {
        console.error('No se pudo sincronizar: sin muestras válidas')
        return
      }
      // Ordena por RTT y promedia el mejor 30%
      samples.sort((a, b) => a.rtt - b.rtt)
      const bestSamples = samples.slice(0, Math.max(1, Math.floor(samples.length * 0.3)))
      const avgOffset = bestSamples.reduce((sum, s) => sum + s.offset, 0) / bestSamples.length
      const bestSample = samples[0]

      timeOffset.value = avgOffset
      syncCompleted.value = true
      lastRtt.value = bestSample.rtt

      console.log(`✓ Sync completado. Offset: ${avgOffset.toFixed(2)}ms (Mejor RTT: ${bestSample.rtt.toFixed(2)}ms)`)

      // Notifica a los suscriptores (reemplaza el CustomEvent 'time-sync-update')
      const detail = { offset: avgOffset, rtt: bestSample.rtt }
      listeners.forEach((cb) => cb(detail))
      return
    }

    const t0 = getNow()
    socket.emit('time-sync', t0)

    socket.once('time-sync-response', (data) => {
      const t3 = getNow()
      const rtt = t3 - t0
      const serverTime = Number(data?.serverTime)
      if (!Number.isFinite(serverTime) || !Number.isFinite(rtt)) {
        setTimeout(() => takeSample(index + 1), 80)
        return
      }
      const estimatedServerTime = serverTime + rtt / 2
      const offset = estimatedServerTime - t3
      if (Number.isFinite(offset)) {
        samples.push({ offset, rtt })
      }
      setTimeout(() => takeSample(index + 1), 80)
    })
  }

  takeSample(0)
}

/**
 * Composable de sincronización de tiempo tipo NTP.
 * Arranca la sincronización al montar y se re-sincroniza periódicamente y al reconectar.
 */
export function useTimeSync() {
  const { socket } = useSocket()

  const onConnect = () => syncTime(socket)

  onMounted(() => {
    if (initialized) return
    initialized = true

    if (socket.connected) syncTime(socket)
    socket.on('connect', onConnect)
    resyncTimer = setInterval(() => syncTime(socket), RESYNC_INTERVAL)
  })

  onUnmounted(() => {
    // El estado es singleton; solo limpiamos si desmontamos el owner inicial.
    if (resyncTimer) {
      clearInterval(resyncTimer)
      resyncTimer = null
    }
    socket.off('connect', onConnect)
    initialized = false
  })

  /** Suscribe un callback a cada actualización de sync. Devuelve función para desuscribir. */
  function onSyncUpdate(cb) {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }

  return { timeOffset, syncCompleted, lastRtt, getSyncTime, onSyncUpdate }
}
