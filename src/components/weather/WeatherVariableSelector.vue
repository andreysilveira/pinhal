<script setup lang="ts">
import { ArrowDown, ArrowUp, Thermometer } from 'lucide-vue-next'
import { WEATHER_VARIABLES } from '../../constants/mapConfig'
import type { WeatherVariableKey } from '../../types/weather'

defineProps<{
  modelValue: WeatherVariableKey
}>()

const emit = defineEmits<{
  'update:modelValue': [value: WeatherVariableKey]
}>()

function selectVariable(key: WeatherVariableKey): void {
  emit('update:modelValue', key)
}
</script>

<template>
  <div
    role="radiogroup"
    aria-label="Variável meteorológica"
    class="inline-flex items-center rounded-xl bg-white/92 backdrop-blur-md p-1 shadow-sm ring-1 ring-slate-900/10"
  >
    <button
      v-for="variable in WEATHER_VARIABLES"
      :key="variable.key"
      type="button"
      role="radio"
      :aria-checked="modelValue === variable.key"
      :aria-label="variable.label"
      :title="`${variable.label} — ${variable.description}`"
      class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      :class="
        modelValue === variable.key
          ? 'bg-slate-900 text-white shadow-xs'
          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
      "
      @click="selectVariable(variable.key)"
    >
      <Thermometer
        v-if="variable.key === 'currentTemperature'"
        class="h-3.5 w-3.5 shrink-0 text-teal-400"
        :class="modelValue === variable.key ? 'text-teal-300' : 'text-teal-700'"
        aria-hidden="true"
      />
      <ArrowUp
        v-else-if="variable.key === 'maximumTemperature'"
        class="h-3.5 w-3.5 shrink-0"
        :class="modelValue === variable.key ? 'text-amber-300' : 'text-amber-600'"
        aria-hidden="true"
      />
      <ArrowDown
        v-else
        class="h-3.5 w-3.5 shrink-0"
        :class="modelValue === variable.key ? 'text-sky-300' : 'text-sky-700'"
        aria-hidden="true"
      />
      <span class="hidden md:inline">{{ variable.label }}</span>
      <span class="md:hidden">{{ variable.shortLabel }}</span>
    </button>
  </div>
</template>
