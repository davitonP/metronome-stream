import { createMemoryHistory, createRouter } from 'vue-router'

import HomeView from './Home.vue'
const MetronomeView = () => import('./Metronome.vue')
const tunerView = () => import('./tuner.vue')
// import AboutView from './Metronome.vue'

const routes = [
  { path: '/', component: HomeView },
  { path: '/metronome', component: MetronomeView },
  { path: '/tuner', component: tunerView },
]

export const router = createRouter({
  history: createMemoryHistory(),
  routes,
})
