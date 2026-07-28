import { createMemoryHistory, createRouter } from 'vue-router'

import HomeView from './Home.vue'
const MetronomeView = () => import('./Metronome.vue')
// import AboutView from './Metronome.vue'

const routes = [
  { path: '/', component: HomeView },
  { path: '/metronome', component: MetronomeView },
]

export const router = createRouter({
  history: createMemoryHistory(),
  routes,
})
