<script setup>
import { computed, onUnmounted, ref } from 'vue'

const MODES = {
  guitar: {
    label: 'Guitarra',
    minFrequency: 60,
    maxFrequency: 400,
    strings: [
      { name: 'E (grave)', frequency: 82.41 },
      { name: 'A', frequency: 110 },
      { name: 'D', frequency: 146.83 },
      { name: 'G', frequency: 196 },
      { name: 'B', frequency: 246.94 },
      { name: 'E (aguda)', frequency: 329.63 },
    ],
  },
  bass: {
    label: 'Bajo',
    minFrequency: 30,
    maxFrequency: 200,
    strings: [
      { name: 'E', frequency: 41.2 },
      { name: 'A', frequency: 55 },
      { name: 'D', frequency: 73.42 },
      { name: 'G', frequency: 98 },
    ],
  },
}
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const mode = ref('guitar')
const isListening = ref(false)
const status = ref('Listo para afinar.')
const frequency = ref(null)
const note = ref(null)
const cents = ref(null)
const activeString = ref(null)

let audioContext
let analyser
let mediaStream
let animationFrame
let lastAnalysis = 0

const activeMode = computed(() => MODES[mode.value])
const noteLabel = computed(() => note.value?.name ?? '—')
const octaveLabel = computed(() => note.value ? `Octava ${note.value.octave}` : '—')
const frequencyLabel = computed(() => frequency.value ? `${frequency.value.toFixed(1)} Hz` : '— Hz')
const centsLabel = computed(() => cents.value === null ? '—' : `${cents.value > 0 ? '+' : ''}${cents.value}¢`)
const needlePosition = computed(() => cents.value === null ? 50 : 50 + Math.max(-50, Math.min(50, cents.value)) / 2)
const needleClass = computed(() => {
  if (cents.value === null || Math.abs(cents.value) <= 10) return 'bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
  if (Math.abs(cents.value) <= 30) return 'bg-yellow-400 shadow-[0_0_20px_rgba(251,191,36,0.35)]'
  return 'bg-red-400 shadow-[0_0_20px_rgba(239,68,68,0.35)]'
})

function clearReading() {
  frequency.value = null
  note.value = null
  cents.value = null
  activeString.value = null
}

function closestString(value) {
  return activeMode.value.strings.reduce((closest, string) => {
    return Math.abs(value - string.frequency) < Math.abs(value - closest.frequency) ? string : closest
  })
}

function readNote(value) {
  const midi = 69 + 12 * Math.log2(value / 440)
  const roundedMidi = Math.round(midi)
  const target = closestString(value)
  const tolerance = mode.value === 'guitar' ? 30 : 15

  frequency.value = value
  note.value = {
    name: NOTE_NAMES[(roundedMidi + 120) % 12],
    octave: Math.floor(roundedMidi / 12) - 1,
  }
  activeString.value = Math.abs(value - target.frequency) <= tolerance ? target.name : null
  cents.value = Math.round(1200 * Math.log2(value / (activeString.value ? target.frequency : 440 * 2 ** ((roundedMidi - 69) / 12))))
}

function detectFrequency(samples, sampleRate) {
  let rms = 0
  for (const sample of samples) rms += sample * sample
  if (Math.sqrt(rms / samples.length) < 0.01) return null

  const minLag = Math.floor(sampleRate / activeMode.value.maxFrequency)
  const maxLag = Math.min(Math.ceil(sampleRate / activeMode.value.minFrequency), Math.floor(samples.length / 2))
  let bestLag = 0
  let bestCorrelation = -Infinity

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0
    for (let i = 0; i < samples.length - lag; i += 1) {
      correlation += samples[i] * samples[i + lag]
    }
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation
      bestLag = lag
    }
  }

  return bestLag ? sampleRate / bestLag : null
}

function monitorPitch(timestamp) {
  if (!analyser || !audioContext) return

  if (timestamp - lastAnalysis >= 120) {
    lastAnalysis = timestamp
    const samples = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(samples)
    const detectedFrequency = detectFrequency(samples, audioContext.sampleRate)
    if (detectedFrequency) readNote(detectedFrequency)
    else clearReading()
  }
  animationFrame = requestAnimationFrame(monitorPitch)
}

async function startTuner() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Este navegador no permite capturar audio.')
    }

    audioContext = new AudioContextClass()
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 4096
    audioContext.createMediaStreamSource(mediaStream).connect(analyser)
    await audioContext.resume()

    isListening.value = true
    status.value = 'Micrófono activo. Toca una cuerda.'
    animationFrame = requestAnimationFrame(monitorPitch)
  } catch (error) {
    status.value = error.name === 'NotAllowedError'
      ? 'Necesitas permitir el acceso al micrófono.'
      : 'No se pudo iniciar el micrófono.'
    stopTuner()
  }
}

function stopTuner() {
  if (animationFrame) cancelAnimationFrame(animationFrame)
  animationFrame = null
  mediaStream?.getTracks().forEach((track) => track.stop())
  mediaStream = null
  analyser?.disconnect()
  analyser = null
  audioContext?.close()
  audioContext = null
  isListening.value = false
  clearReading()
}

function toggleTuner() {
  if (isListening.value) {
    stopTuner()
    status.value = 'Afinador detenido.'
  } else {
    startTuner()
  }
}

function changeMode(nextMode) {
  mode.value = nextMode
  clearReading()
}

onUnmounted(stopTuner)
</script>

<template>
  <div class="min-h-screen bg-slate-950 font-sans text-slate-100">
    <div class="fixed inset-0 -z-10 overflow-hidden">
      <div class="blob-1 absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-cyan-500/8 blur-3xl"></div>
      <div class="blob-2 absolute top-1/3 right-0 h-[400px] w-[400px] rounded-full bg-violet-500/8 blur-3xl"></div>
      <div class="blob-3 absolute bottom-0 left-1/3 h-[350px] w-[350px] rounded-full bg-emerald-500/6 blur-3xl"></div>
    </div>

    <main class="mx-auto flex min-h-screen max-w-screen-2xl items-center p-4 sm:p-6 lg:p-8">
      <div class="flex w-full flex-col gap-6 rounded-2xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/60 backdrop-blur-xl lg:flex-row lg:p-8">
        <header class="flex shrink-0 flex-col gap-6 lg:w-[380px] lg:justify-between">
          <div>
            <p class="text-xs uppercase tracking-[0.35em] text-cyan-300/60">Toolkit Music</p>
            <h1 class="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Afinador.</h1>
            <p class="mt-4 max-w-md text-base leading-7 text-slate-300">Afina tu instrumento con precisión. Detecta cada nota en tiempo real y ajusta hasta encontrar el centro exacto.</p>
          </div>
          <div class="space-y-4 text-sm leading-6 text-slate-200">
            <div class="rounded-2xl border border-emerald-400/25 bg-slate-900/90 p-5"><p class="text-xs uppercase tracking-[0.28em] text-slate-400">Paso 1</p><p class="mt-2 font-semibold text-emerald-200">Elige instrumento</p><p class="mt-1">Selecciona guitarra o bajo según las cuerdas que vas a afinar.</p></div>
            <div class="rounded-2xl border border-cyan-400/25 bg-slate-900/90 p-5"><p class="text-xs uppercase tracking-[0.28em] text-slate-400">Paso 2</p><p class="mt-2 font-semibold text-cyan-200">Activa el micrófono</p><p class="mt-1">Toca una cuerda al aire en un ambiente lo más silencioso posible.</p></div>
          </div>
        </header>

        <section class="flex flex-1 flex-col gap-5 xl:flex-row">
          <div class="flex-1 rounded-2xl border border-slate-800/80 bg-slate-950/80 p-6 sm:p-8">
            <p class="text-sm uppercase tracking-[0.35em] text-emerald-300/80">Afinador de {{ activeMode.label }}</p>
            <h2 class="mt-4 text-3xl font-semibold text-white">Nota detectada</h2>
            <p class="mt-2 text-sm text-slate-400" aria-live="polite">{{ status }}</p>

            <div class="mt-8 rounded-2xl border border-slate-800/90 bg-slate-900/80 p-6 text-center sm:p-8">
              <div class="inline-flex h-32 w-32 items-center justify-center rounded-full bg-slate-800/80 text-6xl font-black text-white shadow-inner shadow-slate-950/40">{{ noteLabel }}</div>
              <p class="mt-4 text-sm uppercase tracking-[0.35em] text-slate-400">{{ octaveLabel }}</p>

              <div class="mt-8 grid gap-3 sm:grid-cols-3">
                <div class="rounded-2xl bg-slate-950/80 p-4 text-left ring-1 ring-slate-800/80"><p class="text-xs uppercase tracking-[0.25em] text-slate-500">Frecuencia</p><p class="mt-3 text-xl font-semibold text-white">{{ frequencyLabel }}</p></div>
                <div class="rounded-2xl bg-slate-950/80 p-4 text-left ring-1 ring-slate-800/80"><p class="text-xs uppercase tracking-[0.25em] text-slate-500">Desviación</p><p class="mt-3 text-xl font-semibold text-white">{{ centsLabel }}</p></div>
                <div class="rounded-2xl bg-slate-950/80 p-4 text-left ring-1 ring-slate-800/80"><p class="text-xs uppercase tracking-[0.25em] text-slate-500">Modo</p><p class="mt-3 text-xl font-semibold text-emerald-300">{{ activeMode.label }}</p></div>
              </div>

              <div class="mt-8 rounded-2xl border border-slate-800/80 bg-slate-900/70 px-6 py-6">
                <div class="relative h-3 rounded-full bg-slate-800/80"><div class="absolute inset-y-0 left-1/2 w-px bg-slate-600/70"></div><div class="absolute top-0 h-full w-4 -translate-x-1/2 rounded-full transition-all duration-150" :class="needleClass" :style="{ left: `${needlePosition}%` }"></div></div>
                <div class="mt-4 flex justify-between text-[11px] uppercase tracking-[0.25em] text-slate-500"><span>Plano</span><span>Afinado</span><span>Agudo</span></div>
              </div>

              <button class="mt-8 w-full rounded-2xl px-6 py-4 font-semibold text-slate-950 transition active:scale-95" :class="isListening ? 'bg-rose-400 hover:bg-rose-300' : 'bg-emerald-500 hover:bg-emerald-400'" @click="toggleTuner">{{ isListening ? 'Detener afinador' : 'Iniciar micrófono' }}</button>
            </div>
          </div>

          <aside class="w-full space-y-4 rounded-2xl border border-slate-800/80 bg-slate-950/80 p-6 xl:w-80">
            <div class="rounded-2xl border border-slate-800/80 bg-slate-900/80 p-5">
              <p class="text-sm uppercase tracking-[0.25em] text-emerald-300/80">Selecciona el modo</p>
              <div class="mt-4 grid grid-cols-2 gap-3">
                <button v-for="(_, key) in MODES" :key="key" class="rounded-2xl px-4 py-3 text-sm font-semibold transition active:scale-95" :class="mode === key ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-100 hover:bg-slate-600'" @click="changeMode(key)">{{ MODES[key].label }}</button>
              </div>
            </div>
            <div class="rounded-2xl border border-slate-800/80 bg-slate-900/80 p-5">
              <p class="text-sm uppercase tracking-[0.25em] text-slate-500">Cuerdas / guía de notas</p>
              <ul class="mt-4 space-y-2">
                <li v-for="string in activeMode.strings" :key="string.name" class="flex items-center justify-between rounded-xl border p-3 text-sm transition" :class="activeString === string.name ? 'border-emerald-400 bg-emerald-400/10 text-white ring-1 ring-emerald-400' : 'border-slate-800 bg-slate-950/80 text-slate-300'"><span class="font-semibold">{{ string.name }}</span><span class="text-xs text-slate-400">{{ string.frequency.toFixed(2) }} Hz</span></li>
              </ul>
            </div>
          </aside>
        </section>
      </div>
    </main>
  </div>
</template>
