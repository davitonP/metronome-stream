<script setup>
defineProps({
  latency: { type: Number, default: 0 },
})
const emit = defineEmits(['update:latency'])
</script>

<template>
  <div class="mb-8 bg-gray-900/50 p-4 rounded-xl border border-gray-700/50">
    <div class="flex justify-between items-center mb-3">
      <label class="text-xs text-gray-500 font-medium uppercase">⏱️ Audio Sync</label>
      <span class="text-xs font-mono bg-gray-700 px-2 py-1 rounded text-gray-300">{{ latency }} ms</span>
    </div>
    <input
      type="range"
      min="-200"
      max="200"
      step="10"
      :value="latency"
      class="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400 focus:outline-none"
      @input="emit('update:latency', Number($event.target.value))"
    />
  </div>
</template>
