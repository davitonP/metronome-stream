<script setup>
import ToolCard from './components/ToolCard.vue'
</script>

<template class="bg-slate-950 text-slate-100 font-sans">
  <!-- Background blobs -->
  <div class="fixed inset-0 -z-10 overflow-hidden">
    <div class="blob-1 absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-cyan-500/8 blur-3xl"></div>
    <div class="blob-2 absolute top-1/3 right-0 h-[400px] w-[400px] rounded-full bg-violet-500/8 blur-3xl"></div>
    <div class="blob-3 absolute bottom-0 left-1/3 h-[350px] w-[350px] rounded-full bg-emerald-500/6 blur-3xl"></div>
  </div>

  <div class="flex min-h-screen flex-col">
    <!-- Main content -->
    <div class="flex flex-1 items-stretch px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div class="flex w-full flex-col gap-6 rounded-2xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/60 backdrop-blur-xl lg:flex-row lg:p-8">

        <!-- Left column: hero + info -->
        <header class="flex shrink-0 flex-col gap-6 lg:w-[380px] lg:justify-between">
          <div>
            <p class="text-xs uppercase tracking-[0.35em] text-cyan-300/60">Toolkit Music</p>
            <h1 class="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-[2.75rem] lg:leading-[1.15]">Herramientas para músicos y bandas.</h1>
            <p class="mt-4 text-sm leading-7 text-slate-400">Navega rápidamente entre utilidades para practicar, sincronizar ensayos y afinar tu sonido con precisión.</p>
          </div>

          <div class="flex flex-col gap-4">
            <div class="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-5 shadow-lg shadow-slate-950/40 ring-1 ring-slate-700/40">
              <p class="text-[0.65rem] uppercase tracking-[0.35em] text-slate-500">Sesión rápida</p>
              <p class="mt-2 text-2xl font-semibold text-cyan-300">5+ herramientas</p>
              <p class="mt-1.5 text-xs leading-5 text-slate-500">Todo en un solo panel oscuro, pensado para el ritmo creativo y el trabajo de grupo.</p>
            </div>
            <div class="rounded-2xl border border-slate-800/60 bg-slate-950/50 p-5">
              <p class="text-[0.65rem] uppercase tracking-[0.3em] text-slate-500">Consejo</p>
              <p class="mt-2 text-xs leading-6 text-slate-500">Comienza por una sesión compartida en el metrónomo y ajusta la latencia antes de tocar.</p>
            </div>
          </div>
        </header>

        <!-- Right column: tool cards -->
        <section class="flex flex-1 flex-col gap-5 overflow-y-auto">
          <!-- Active tools -->
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ToolCard title="Afinador" description="Afina guitarra y bajo con precisión en tiempo real." icon="🎸" link="/tuner" color="from-emerald-400 to-emerald-600" :active='true'/>
            <ToolCard title="Monitor de voz" description="Visualiza notas vocales y mejora tu afinación en vivo." icon="🎤" link="/vocal-monitor" color="from-pink-400 to-pink-600" :active='true'/>
            <ToolCard title="Metrónomo" description="Ritmo estable con BPM ajustable y sesiones colaborativas." icon="♪" link="/metronome" color="from-cyan-400 to-cyan-600" :active='true' />
            <ToolCard title="Secuencias" description="Lleva el ritmo con una secuencia de acordes." icon="♬" link="/secuencia" color="from-orange-500/30 to-orange-600/30" :active='true' />
          </div>

          <!-- Coming soon -->
          <div>
            <p class="mb-3 text-[0.65rem] uppercase tracking-[0.35em] text-slate-600">Próximamente</p>
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ToolCard title="Secuencias" description="Patrones y efectos creativos para tu flujo musical." icon="♬" link="/secuencia" color="from-orange-500/30 to-orange-600/30" :active='false' />
                <ToolCard title="Loop Station" description="Graba, apila y mezcla loops en tiempo real desde tu instrumento o voz." icon="🔁" link="/loopstation" color="from-amber-500/30 to-amber-600/30" :active='false' />
                <ToolCard title="Acordes" description="Progresiones de acordes, transposición y referencia rápida de escalas." icon="🎹" link="/acordes" color="from-sky-500/30 to-sky-600/30" :active='false' />
                <ToolCard title="Ear Training" description="Entrena tu oído con intervalos, acordes y dictados melódicos interactivos." icon="👂" link="/ear-training" color="from-rose-500/30 to-rose-600/30" :active='false' />
            </div>
          </div>
        </section>

      </div>
    </div>

    <!-- Footer -->
    <footer class="px-6 pb-4 text-center">
      <p class="text-[0.6rem] uppercase tracking-[0.3em] text-slate-700">Toolkit Music · hecho para bandas</p>
    </footer>
  </div>
</template>
