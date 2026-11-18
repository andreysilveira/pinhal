<script setup lang="ts">
import { computed } from 'vue'
import type { TemperatureScaleDomain, WeatherVariableDefinition } from '../../types/weather'
import {
  buildViridisCssGradient,
  formatScaleNumber,
  NO_DATA_RGBA,
  normalizeTemperatureInDomain,
} from '../../utils/temperatureColors'

const props = defineProps<{
  domain: TemperatureScaleDomain
  variable: WeatherVariableDefinition
  activeTemperature: number | null
  hasMissingMunicipalities: boolean
}>()

const gradientStyle = computed(() => ({
  backgroundImage: buildViridisCssGradient('to right'),
}))

const midValue = computed<number>(() => {
  return (props.domain.min + props.domain.max) / 2
})

const markerPercent = computed<number | null>(() => {
  if (props.activeTemperature === null || !Number.isFinite(props.activeTemperature)) {
    return null
  }
  return Math.round(normalizeTemperatureInDomain(props.activeTemperature, props.domain) * 100)
})
</script>

<template>
  <aside
    aria-label="Legenda de temperatura"
    class="pointer-events-auto w-56 sm:w-64 rounded-xl bg-white/92 backdrop-blur-md px-3.5 py-2.5 shadow-md ring-1 ring-slate-900/12 text-slate-900"
  >
    <div class="flex items-baseline justify-between gap-2 mb-1.5">
      <span class="text-xs font-semibold tracking-tight text-slate-800 truncate">
        {{ variable.label }}
      </span>
      <span class="text-[11px] font-bold text-slate-600 shrink-0">
        ({{ domain.unit }})
      </span>
    </div>

    <div class="relative py-1">
      <div
        class="h-3 w-full rounded-full ring-1 ring-slate-900/15 shadow-inner"
        :style="gradientStyle"
        role="img"
        :aria-label="`Escala contínua de ${formatScaleNumber(domain.min)} °C até ${formatScaleNumber(domain.max)} °C`"
      />
      <!-- Live pointer marker when hovering or focusing a municipality -->
      <div
        v-if="markerPercent !== null"
        class="pointer-events-none absolute top-0.5 -translate-x-1/2 transition-all duration-75"
        :style="{ left: `${markerPercent}%` }"
        aria-hidden="true"
      >
        <div class="h-4 w-2 rounded-sm bg-slate-950 ring-2 ring-white shadow-sm" />
      </div>
    </div>

    <div class="mt-1 flex items-center justify-between text-[11px] font-semibold tabular-nums text-slate-700">
      <span>{{ formatScaleNumber(domain.min) }}°C</span>
      <span class="text-slate-500 font-medium">{{ formatScaleNumber(midValue) }}°C</span>
      <span>{{ formatScaleNumber(domain.max) }}°C</span>
    </div>

    <div
      v-if="hasMissingMunicipalities"
      class="mt-1.5 pt-1.5 border-t border-slate-200/80 flex items-center gap-1.5 text-[10px] text-slate-600"
    >
      <span
        class="inline-block h-2.5 w-2.5 rounded-xs border border-dashed border-slate-500"
        :style="{ backgroundColor: NO_DATA_RGBA }"
        aria-hidden="true"
      />
      <span>Município sem dados disponíveis</span>
    </div>
  </aside>
</template>
