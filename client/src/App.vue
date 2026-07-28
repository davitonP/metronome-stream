<script setup>
import { ref, computed } from 'vue'
import Home from './Home.vue'
// import Metronome from './Metronome.vue'
// import VocalMonitor from './VocalMonitor.vue'
import NotFound from './NotFound.vue'

</script>

<template>
  <p>
    <strong>Current route path:</strong> {{ $route.fullPath }}
  </p>
  <nav>
    <RouterLink to="/">Go to Home</RouterLink>
    <RouterLink to="/metronome">Go to Metronome</RouterLink>
  </nav>
  <main>
    <RouterView />
  </main>
</template>
