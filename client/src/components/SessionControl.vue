<script setup>
import { ref } from 'vue'

const props = defineProps({
  currentSession: { type: String, default: 'default' },
})
const emit = defineEmits(['join'])

const input = ref(props.currentSession)

function join() {
  emit('join', input.value)
}
</script>

<template>
  <div class="mb-6 bg-gray-900/50 p-4 rounded-xl border border-gray-700/50">
    <label class="text-xs text-gray-500 font-medium uppercase block mb-2">🎵 Sesión</label>
    <div class="flex gap-2">
      <input
        v-model="input"
        type="text"
        class="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        placeholder="Nombre de sesión"
        @keyup.enter="join"
      />
      <button
        class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
        @click="join"
      >
        Unirse
      </button>
    </div>
    <p class="text-[10px] text-gray-400 mt-2">
      <span class="text-green-400 font-mono">{{ currentSession }}</span>
    </p>
  </div>
</template>
