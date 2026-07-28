import { ref, onMounted, onUnmounted } from 'vue'
import { useSocket } from './useSocket.js'
import { useTimeSync, getSyncTime } from './useTimeSync.js'
import { initMetronome } from '../lib/metronome.js'
import { getAudioContext } from '../lib/audio.js'

const DURATION_MS = 60000

/**
 * Orquesta el estado reactivo del metrónomo y su cableado con Socket.IO.
 */
export function useMetronome() {
  const { socket } = useSocket()
  const { syncCompleted, onSyncUpdate } = useTimeSync()

  // Estado reactivo
  const bpm = ref(90)
  const beatsPerBar = ref(4)
  const currentBeat = ref(-1) // -1 = ningún beat activo
  const isPlaying = ref(false)
  const userLatency = ref(0)
  const sessionId = ref('default')
  const loading = ref(false)
  const initialized = ref(false)

  let metronome = null
  let unsubscribeSync = null

  function onBeat(beatIndex) {
    // Destello reactivo del beat activo
    currentBeat.value = beatIndex
    setTimeout(() => {
      if (currentBeat.value === beatIndex) currentBeat.value = -1
    }, 100)
  }

  /** Inicialización perezosa: crea AudioContext + carga buffers (requiere gesto del usuario). */
  async function initialize() {
    if (initialized.value || loading.value) return true
    loading.value = true
    metronome = await initMetronome({
      bpm: bpm.value,
      beatsPerBar: beatsPerBar.value,
      getSyncTime,
      onBeat,
    })
    loading.value = false

    if (!metronome) {
      console.error('No se pudo inicializar el metrónomo')
      return false
    }
    metronome.setUserLatency(userLatency.value)
    unsubscribeSync = onSyncUpdate((detail) => metronome.onTimeSyncUpdate(detail))
    initialized.value = true
    return true
  }

  function joinSession(id) {
    const next = (id ?? sessionId.value).trim() || 'default'
    sessionId.value = next
    socket.emit('join-session', next)
    // Detener metrónomo al cambiar de sesión para evitar confusión
    if (metronome && metronome.isPlaying) {
      metronome.stop()
      isPlaying.value = false
    }
  }

  /** Solicita al servidor iniciar el metrónomo (autoritativo). Si no hay sync, arranca local. */
  function requestStart() {
    if (!syncCompleted.value) {
      console.warn('⚠ Sin time-sync todavía, arrancando localmente')
      metronome.start(Date.now() + 500)
      isPlaying.value = true
      return
    }
    socket.emit('metronome-start', {
      bpm: bpm.value,
      durationMs: DURATION_MS,
      sessionId: sessionId.value,
    })
    isPlaying.value = true
  }

  function requestStop() {
    if (metronome) metronome.stop()
    socket.emit('metronome-stop', { sessionId: sessionId.value })
    isPlaying.value = false
  }

  function setBpm(value) {
    const next = Number(value)
    bpm.value = next
    if (metronome) metronome.setBPM(next)
    // Si está sonando, re-emitir para re-sincronizar a todos
    if (metronome && metronome.isPlaying) {
      socket.emit('metronome-start', {
        bpm: next,
        durationMs: DURATION_MS,
        sessionId: sessionId.value,
      })
    }
  }

  function setTimeSignature(count) {
    beatsPerBar.value = count
    if (metronome) metronome.setTimeSignature(count)
  }

  function setLatency(value) {
    userLatency.value = Number(value)
    if (metronome) metronome.setUserLatency(userLatency.value)
  }

  // --- Cableado de eventos de socket ---
  const onMetronomeStart = (data) => {
    console.log('Recibido metronome-start', data)
    if (!metronome) {
      console.warn("⚠ Metrónomo no listo — el usuario aún no ha interactuado")
      return
    }
    if (data.bpm && data.bpm !== bpm.value) {
      metronome.setBPM(data.bpm)
      bpm.value = data.bpm
    }
    if (metronome.isPlaying) metronome.stop()
    const ctx = getAudioContext()
    if (ctx && ctx.state === 'suspended') ctx.resume()
    metronome.start(data.startAt)
    isPlaying.value = true
  }

  const onMetronomeStop = () => {
    console.log('Recibido metronome-stop')
    if (metronome) metronome.stop()
    isPlaying.value = false
  }

  const onConnect = () => {
    // Re-unirse a la sesión al (re)conectar
    socket.emit('join-session', sessionId.value)
  }

  onMounted(() => {
    socket.on('metronome-start', onMetronomeStart)
    socket.on('metronome-stop', onMetronomeStop)
    socket.on('connect', onConnect)
    if (socket.connected) socket.emit('join-session', sessionId.value)
  })

  onUnmounted(() => {
    socket.off('metronome-start', onMetronomeStart)
    socket.off('metronome-stop', onMetronomeStop)
    socket.off('connect', onConnect)
    if (unsubscribeSync) unsubscribeSync()
    if (metronome) metronome.stop()
  })

  return {
    // estado
    bpm,
    beatsPerBar,
    currentBeat,
    isPlaying,
    userLatency,
    sessionId,
    loading,
    initialized,
    syncCompleted,
    // acciones
    initialize,
    joinSession,
    requestStart,
    requestStop,
    setBpm,
    setTimeSignature,
    setLatency,
  }
}
