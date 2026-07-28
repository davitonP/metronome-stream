<script setup>
defineProps({
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    icon: { type: String, default: '' },
    link: { type: String, default: '' },
    color: { type: String, default: '' },
    active: { type: Boolean, default: false },
})
</script>

<template>
    <RouterLink v-if=active :to=link>
        <div class="card-tool group relative overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/60 backdrop-blur-sm hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/5">
            <div class="h-1 bg-gradient-to-r" v-bind:class="color"></div>
            <div class="flex h-full flex-row justify-between p-5">
                <div class="grow">
                <h2 class="text-lg font-semibold text-white group-hover:text-emerald-200">{{ title }}</h2>
                <p class="mt-2 text-sm leading-6 text-slate-400">{{ description }}</p>
                </div>
                <div class="mt-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-3xl ring-1 ring-emerald-500/20">{{ icon }}</div>
            </div>
        </div>
    </RouterLink>
    <div v-else class="card-soon group relative overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/40 backdrop-blur-sm opacity-75 hover:opacity-90 transition-opacity">
        <div class="h-1 bg-gradient-to-r from-amber-500/30 to-amber-600/30"></div>
        <div class="flex h-full flex-row justify-between p-5">
            <div class="grow">
            <h2 class="text-lg font-semibold text-slate-300">{{ title }}</h2>
            <p class="mt-2 text-sm leading-6 text-slate-500">{{ description }}</p>
            </div>
            <div class="mt-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/5 text-3xl ring-1 ring-amber-500/10">{{ icon }}</div>
        </div>
    </div>
</template>


