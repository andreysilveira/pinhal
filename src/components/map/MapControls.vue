<script setup lang="ts">
import { Maximize2, Minus, Plus } from 'lucide-vue-next'

defineEmits<{
  zoomIn: []
  zoomOut: []
  resetExtent: []
}>()
</script>

<template>
  <nav
    aria-label="Controles de navegação do mapa"
    class="pointer-events-auto flex flex-col overflow-hidden rounded-xl bg-white/92 backdrop-blur-md shadow-md ring-1 ring-slate-900/12"
  >
    <button
      type="button"
      aria-label="Aproximar mapa (Zoom in)"
      title="Aproximar mapa"
      class="flex h-9 w-9 items-center justify-center text-slate-800 transition-colors hover:bg-slate-100 active:bg-slate-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-teal-700"
      @click="$emit('zoomIn')"
    >
      <Plus class="h-4 w-4" aria-hidden="true" />
    </button>
    <div class="h-px w-full bg-slate-200/80" aria-hidden="true" />
    <button
      type="button"
      aria-label="Afastar mapa (Zoom out)"
      title="Afastar mapa"
      class="flex h-9 w-9 items-center justify-center text-slate-800 transition-colors hover:bg-slate-100 active:bg-slate-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-teal-700"
      @click="$emit('zoomOut')"
    >
      <Minus class="h-4 w-4" aria-hidden="true" />
    </button>
    <div class="h-px w-full bg-slate-200/80" aria-hidden="true" />
    <button
      type="button"
      aria-label="Reenquadrar estado do Paraná"
      title="Enquadrar todo o Paraná"
      class="flex h-9 w-9 items-center justify-center text-slate-800 transition-colors hover:bg-slate-100 active:bg-slate-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-teal-700"
      @click="$emit('resetExtent')"
    >
      <Maximize2 class="h-4 w-4" aria-hidden="true" />
    </button>
  </nav>
</template>
