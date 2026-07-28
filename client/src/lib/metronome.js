// ===================================
// Clase Metronomo (portada de metronome.js)
// Sin dependencias de window: recibe getSyncTime, getAudioContext y onBeat por inyección.
// ===================================

import { getAudioContext, loadAudioBuffer } from './audio.js'

const DEFAULT_SOUND = '/assets/secuencias/metronome_sound/metronome2.mp3'
const DEFAULT_DOWNBEAT = '/assets/secuencias/metronome_sound/metronome1.mp3'

export class Metronomo {
  /**
   * @param {object} opts
   * @param {number} opts.bpm
   * @param {number} [opts.beatsPerBar=4]
   * @param {() => number} opts.getSyncTime - devuelve el tiempo sincronizado del servidor (ms)
   * @param {() => AudioContext} opts.getAudioContext
   * @param {(beatIndex: number) => void} [opts.onBeat] - callback para UI reactiva
   * @param {AudioBuffer} opts.audioBuffer
   * @param {AudioBuffer} opts.downbeatBuffer
   */
  constructor({ bpm, beatsPerBar = 4, getSyncTime, getAudioContext, onBeat, audioBuffer, downbeatBuffer }) {
    this.bpm = bpm
    this.isPlaying = false
    this.nextNoteTime = 0.0
    this.timerID = null
    this.audioContext = null
    this.userLatency = 0 // ms

    // Inyecciones
    this._getSyncTime = getSyncTime
    this._getAudioContext = getAudioContext
    this._onBeat = onBeat || (() => {})
    this.audioBuffer = audioBuffer
    this.downbeatBuffer = downbeatBuffer

    // Lógica de beats
    this.currentBeat = 0
    this.beatsPerBar = beatsPerBar

    // Lógica de chequeo de sincronía
    this.startAtServerTime = 0
  }

  /**
   * Reacciona a una actualización del offset de tiempo (llamado por el composable de sync).
   * @param {{ offset: number, rtt: number }} detail
   */
  onTimeSyncUpdate(detail) {
    if (this.isPlaying) {
      this.checkSync(detail)
    }
  }

  checkSync() {
    if (!this.isPlaying || !this.audioContext || !this.startAtServerTime) return

    const currentServerTime = this._getSyncTime()
    const secondsPerBeat = 60.0 / this.bpm

    const timeSinceStart = currentServerTime - this.startAtServerTime

    // Índice del próximo beat y su tiempo objetivo (servidor)
    const nextBeatIndex = Math.ceil(timeSinceStart / 1000 / secondsPerBeat)
    const targetServerTime = this.startAtServerTime + (nextBeatIndex * secondsPerBeat * 1000)

    const delayToTarget = (targetServerTime - currentServerTime + this.userLatency) / 1000
    const targetAudioTime = this.audioContext.currentTime + delayToTarget

    const drift = this.nextNoteTime - targetAudioTime
    // drift > 0: vamos tarde/lentos; drift < 0: vamos rápido/temprano

    if (Math.abs(drift) > 0.005) {
      // Umbral: 5ms
      console.log(`⚠ Sync check: Drift ${(drift * 1000).toFixed(2)}ms. Corrigiendo...`)

      if (Math.abs(drift) < 0.05) {
        // Corrección suave: acercar un 50%
        this.nextNoteTime -= drift * 0.5
      } else {
        // Corrección dura
        this.nextNoteTime = targetAudioTime
        this.currentBeat = nextBeatIndex % this.beatsPerBar
      }
    }
  }

  setUserLatency(latencyMs) {
    this.userLatency = latencyMs
    console.log(`🔧 Latencia de usuario ajustada: ${this.userLatency}ms`)
  }

  start(startAtServerTime) {
    if (this.isPlaying) return

    this.startAtServerTime = startAtServerTime

    this.audioContext = this._getAudioContext()
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume()
    }

    this.isPlaying = true
    this.currentBeat = 0

    const currentServerTime = this._getSyncTime()
    const currentAudioTime = this.audioContext.currentTime

    const delaySeconds = (startAtServerTime - currentServerTime + this.userLatency) / 1000
    this.nextNoteTime = currentAudioTime + delaySeconds

    const secondsPerBeat = 60.0 / this.bpm
    if (delaySeconds < 0) {
      const beatsMissed = Math.ceil(Math.abs(delaySeconds) / secondsPerBeat)
      this.nextNoteTime += beatsMissed * secondsPerBeat
      console.warn(`⚠ Inicio tardío. Se saltaron ${beatsMissed} beats para alcanzar.`)
    }

    console.log(`⏱ Metrónomo programado para iniciar en ${delaySeconds.toFixed(3)}s`)
    this.scheduler()
  }

  scheduler() {
    if (!this.isPlaying) return

    // Programa notas con lookahead de 0.1s
    while (this.nextNoteTime < this.audioContext.currentTime + 0.1) {
      this.scheduleNote(this.nextNoteTime)
      this.nextNote()
    }

    this.timerID = setTimeout(() => this.scheduler(), 25)
  }

  nextNote() {
    const secondsPerBeat = 60.0 / this.bpm
    this.nextNoteTime += secondsPerBeat
    this.currentBeat = (this.currentBeat + 1) % this.beatsPerBar
  }

  scheduleNote(time) {
    const isDownbeat = this.currentBeat === 0
    const buffer = isDownbeat ? this.downbeatBuffer : this.audioBuffer

    if (!buffer) return

    const source = this.audioContext.createBufferSource()
    source.buffer = buffer
    source.connect(this.audioContext.destination)
    source.start(time)

    // Notifica a la UI (reactivo en Vue) en lugar de tocar el DOM directamente
    this._onBeat(this.currentBeat)
  }

  stop() {
    this.isPlaying = false
    if (this.timerID) clearTimeout(this.timerID)
  }

  setBPM(bpm) {
    this.bpm = bpm
  }

  setTimeSignature(beatsPerBar) {
    this.beatsPerBar = beatsPerBar
    this.currentBeat = this.currentBeat % this.beatsPerBar
    console.log(`🎵 Compás actualizado: ${beatsPerBar} beats por compás`)
  }
}

/**
 * Inicializa el metrónomo cargando los buffers de audio.
 * @param {object} opts
 * @param {number} [opts.bpm=90]
 * @param {number} [opts.beatsPerBar=4]
 * @param {() => number} opts.getSyncTime
 * @param {(beatIndex: number) => void} [opts.onBeat]
 * @returns {Promise<Metronomo|null>}
 */
export async function initMetronome({ bpm = 90, beatsPerBar = 4, getSyncTime, onBeat } = {}) {
  try {
    const ctx = getAudioContext()
    const audioBuffer = await loadAudioBuffer(DEFAULT_SOUND, ctx)
    const downbeatBuffer = await loadAudioBuffer(DEFAULT_DOWNBEAT, ctx)
    console.log('Buffers de audio del metrónomo cargados correctamente')

    return new Metronomo({
      bpm,
      beatsPerBar,
      getSyncTime,
      getAudioContext,
      onBeat,
      audioBuffer,
      downbeatBuffer,
    })
  } catch (error) {
    console.error('Error inicializando el metrónomo:', error)
    return null
  }
}
