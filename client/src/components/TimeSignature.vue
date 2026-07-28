<script setup>
defineProps({
  beatsPerBar: { type: Number, default: 4 },
})
const emit = defineEmits(['update:beatsPerBar'])

const options = [
  { label: '4/4', beats: 4 },
  { label: '3/4', beats: 3 },
  { label: '2/4', beats: 2 },
  { label: '6/8', beats: 6 },
]
</script>

<template>
  <div class="mb-8 bg-gray-900/50 p-4 rounded-xl w-full border border-gray-700/50">
    <label class="text-xs text-gray-500 font-medium uppercase block mb-3">♫ Compás</label>
    <div class="flex items-center gap-2 w-full">
      <button
        v-for="opt in options"
        :key="opt.label"
        class="flex-1 py-2 flex items-center justify-center rounded-lg text-white font-bold transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        :class="beatsPerBar === opt.beats ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600 active:bg-blue-600'"
        :aria-label="`Compás ${opt.label}`"
        @click="emit('update:beatsPerBar', opt.beats)"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>
