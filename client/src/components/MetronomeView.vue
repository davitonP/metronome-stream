<script setup>
import { computed } from 'vue'
import { useMetronome } from '../composables/useMetronome.js'
import { getAudioContext } from '../lib/audio.js'
import SessionControl from './SessionControl.vue'
import BpmControl from './BpmControl.vue'
import TimeSignature from './TimeSignature.vue'
import BeatIndicator from './BeatIndicator.vue'
import LatencySlider from './LatencySlider.vue'

const {
  bpm,
  beatsPerBar,
  currentBeat,
  isPlaying,
  userLatency,
  sessionId,
  loading,
  initialized,
  initialize,
  joinSession,
  requestStart,
  requestStop,
  setBpm,
  setTimeSignature,
  setLatency,
} = useMetronome()

const buttonLabel = computed(() => {
  if (loading.value) return 'Loading...'
  if (!initialized.value) return 'Ready? (Click to Initialize)'
  return isPlaying.value ? 'Stop Metronome' : 'Start Metronome'
})

const buttonClass = computed(() => {
  if (!initialized.value) {
    return 'bg-green-600 hover:bg-green-500 shadow-green-500/30 focus:ring-green-500'
  }
  return isPlaying.value
    ? 'bg-red-600 hover:bg-red-500 shadow-red-500/30 focus:ring-red-500'
    : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/30 focus:ring-blue-500'
})

async function onMainButton() {
  // Init perezoso en el primer gesto del usuario
  if (!initialized.value) {
    await initialize()
    return
  }

  // Reanudar AudioContext (estamos dentro de un gesto del usuario)
  const ctx = getAudioContext()
  if (ctx && ctx.state === 'suspended') await ctx.resume()

  if (isPlaying.value) {
    requestStop()
  } else {
    requestStart()
  }
}
</script>

<template>
  <div class="bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700">
    <SessionControl :current-session="sessionId" @join="joinSession" />

    <BpmControl :bpm="bpm" @update:bpm="setBpm" />

    <BeatIndicator :beats-per-bar="beatsPerBar" :current-beat="currentBeat" />

    <TimeSignature :beats-per-bar="beatsPerBar" @update:beats-per-bar="setTimeSignature" />

    <div class="mb-6">
      <button
        class="w-full py-4 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-60"
        :class="buttonClass"
        :disabled="loading"
        @click="onMainButton"
      >
        {{ buttonLabel }}
      </button>
    </div>

    <LatencySlider :latency="userLatency" @update:latency="setLatency" />
  </div>
</template>
