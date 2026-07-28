<script setup>
const props = defineProps({
  bpm: { type: Number, default: 90 },
})
const emit = defineEmits(['update:bpm'])

function setBpm(value) {
  const clamped = Math.min(250, Math.max(20, Number(value)))
  emit('update:bpm', clamped)
}
</script>

<template>
  <div>
    <div class="text-center mb-8">
      <h3 class="text-gray-400 uppercase tracking-widest text-sm font-semibold mb-2">BPM</h3>
      <h1 class="text-7xl font-black text-blue-500 tabular-nums tracking-tighter">{{ bpm }}</h1>
    </div>

    <div class="mb-8">
      <label class="text-xs text-gray-500 font-medium uppercase block mb-3">Tempo (BPM)</label>
      <div class="flex items-center gap-4">
        <button
          class="w-10 h-10 flex items-center justify-center bg-gray-700 hover:bg-gray-600 active:bg-blue-600 rounded-full text-white font-bold transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Bajar BPM"
          @click="setBpm(bpm - 1)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
          </svg>
        </button>

        <input
          type="range"
          name="bpm"
          min="20"
          max="250"
          step="1"
          :value="bpm"
          class="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          @input="setBpm($event.target.value)"
        />

        <button
          class="w-10 h-10 flex items-center justify-center bg-gray-700 hover:bg-gray-600 active:bg-blue-600 rounded-full text-white font-bold transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Subir BPM"
          @click="setBpm(bpm + 1)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
