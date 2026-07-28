<script setup>
defineProps({
  beatsPerBar: { type: Number, default: 4 },
  currentBeat: { type: Number, default: -1 },
})
</script>

<template>
  <div class="flex justify-center gap-6 mb-10">
    <div
      v-for="i in beatsPerBar"
      :key="i"
      class="beat w-6 h-6 rounded-full transition-all duration-100 shadow-inner"
      :class="currentBeat === i - 1
        ? 'bg-blue-500 scale-125 shadow-[0_0_15px_rgba(59,130,246,0.8)] ring-2 ring-blue-300'
        : 'bg-gray-700'"
    ></div>
  </div>
</template>
