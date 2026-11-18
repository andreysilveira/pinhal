<script setup lang="ts">
import { Layers } from 'lucide-vue-next'
import { BASE_MAP_OPTIONS } from '../../constants/mapConfig'
import type { BaseMapId } from '../../types/geography'

defineProps<{
  modelValue: BaseMapId
}>()

const emit = defineEmits<{
  'update:modelValue': [value: BaseMapId]
}>()
</script>

<template>
  <div
    role="radiogroup"
    aria-label="Mapa-base cartográfico"
    class="inline-flex items-center gap-0.5 rounded-xl bg-white/92 backdrop-blur-md p-1 shadow-sm ring-1 ring-slate-900/10"
  >
    <span
      class="hidden lg:inline-flex items-center pl-2 pr-1 text-slate-500"
      title="Selecionar mapa-base"
      aria-hidden="true"
    >
      <Layers class="h-3.5 w-3.5" />
    </span>
    <button
      v-for="option in BASE_MAP_OPTIONS"
      :key="option.id"
      type="button"
      role="radio"
      :aria-checked="modelValue === option.id"
      :aria-label="`Mapa-base ${option.label}`"
      :title="`${option.label} — ${option.description}`"
      class="rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      :class="
        modelValue === option.id
          ? 'bg-slate-800 text-white shadow-xs'
          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
      "
      @click="emit('update:modelValue', option.id)"
    >
      <span class="hidden xl:inline">{{ option.label }}</span>
      <span class="xl:hidden">{{ option.shortLabel }}</span>
    </button>
  </div>
</template>
