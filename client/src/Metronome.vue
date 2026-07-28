<script setup>
import MetronomeView from './components/MetronomeView.vue'
</script>

<template>
  <div class="bg-slate-950 text-slate-100 font-sans min-h-screen">
    <!-- Background blobs -->
    <div class="fixed inset-0 -z-10 overflow-hidden">
      <div class="blob-1 absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-cyan-500/8 blur-3xl"></div>
      <div class="blob-2 absolute top-1/3 right-0 h-[400px] w-[400px] rounded-full bg-violet-500/8 blur-3xl"></div>
      <div class="blob-3 absolute bottom-0 left-1/3 h-[350px] w-[350px] rounded-full bg-emerald-500/6 blur-3xl"></div>
    </div>

    <div class="flex min-h-screen flex-col">
      <div class="flex flex-1 items-stretch px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div class="flex w-full flex-col gap-6 rounded-2xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/60 backdrop-blur-xl lg:flex-row lg:p-8">

          <!-- Left column: hero + info -->
          <header class="flex shrink-0 flex-col gap-6 lg:w-[380px] lg:justify-between">
            <div>
              <p class="text-xs uppercase tracking-[0.35em] text-cyan-300/60">Toolkit Music</p>
              <h1 class="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-[2.75rem] lg:leading-[1.15]">Metrónomo.</h1>
              <p class="mt-4 max-w-md text-base leading-7 text-slate-300">Mantén a toda la banda en el mismo pulso desde el primer compás. Crea una sesión compartida, ajusta el tempo con precisión y corrige la latencia para que el click se escuche alineado con el beat visual.</p>
            </div>

            <div class="flex flex-col gap-4">
              <div class="rounded-2xl border border-cyan-400/25 bg-slate-900/90 p-5 shadow-lg shadow-slate-950/40 ring-1 ring-cyan-200/10 backdrop-blur-sm">
                <p class="text-[0.68rem] uppercase tracking-[0.28em] text-slate-400">Paso 1 · Crear sesión</p>
                <p class="mt-2 text-base font-semibold text-cyan-200">Define un nombre compartido</p>
                <p class="mt-2 text-sm leading-6 text-slate-200">Escribe un nombre claro para que todos entren al mismo espacio y reciban exactamente el mismo tempo.</p>
              </div>
              <div class="rounded-2xl border border-violet-400/25 bg-slate-900/90 p-5 shadow-lg shadow-slate-950/40 ring-1 ring-violet-200/10 backdrop-blur-sm">
                <p class="text-[0.68rem] uppercase tracking-[0.28em] text-slate-400">Paso 2 · Configurar ritmo</p>
                <p class="mt-2 text-base font-semibold text-violet-200">Ajusta BPM y compás</p>
                <p class="mt-2 text-sm leading-6 text-slate-200">Usa el slider o los botones ± para afinar el tempo y selecciona el compás que van a tocar antes de iniciar.</p>
              </div>
              <div class="rounded-2xl border border-emerald-400/25 bg-slate-900/90 p-5 shadow-lg shadow-slate-950/35 ring-1 ring-emerald-200/10 backdrop-blur-sm">
                <p class="text-[0.68rem] uppercase tracking-[0.28em] text-slate-400">Consejo pro · Sincronía</p>
                <p class="mt-2 text-base font-semibold text-emerald-200">Corrige la latencia de audio</p>
                <p class="mt-2 text-sm leading-6 text-slate-200">Si el click suena adelantado o atrasado respecto al beat visual, ajusta "Audio Sync" en milisegundos hasta que ambos queden alineados.</p>
              </div>
            </div>
          </header>

          <!-- Right column: metronome -->
          <section class="flex flex-1 flex-col gap-5 overflow-y-auto items-center justify-center">
            <MetronomeView />
          </section>

        </div>
      </div>

      <footer class="px-6 pb-4 text-center">
        <p class="text-[0.6rem] uppercase tracking-[0.3em] text-slate-700">Toolkit Music · hecho para bandas</p>
      </footer>
    </div>
  </div>
</template>
