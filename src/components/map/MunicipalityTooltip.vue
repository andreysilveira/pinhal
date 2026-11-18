<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { computed } from 'vue'
import type {
  HoveredMunicipalityInfo,
  TemperatureScaleDomain,
  WeatherVariableDefinition,
} from '../../types/weather'
import {
  formatTemperatureValue,
  temperatureToSolidColor,
} from '../../utils/temperatureColors'

const props = defineProps<{
  info: HoveredMunicipalityInfo | null
  variable: WeatherVariableDefinition
  domain: TemperatureScaleDomain
}>()

const emit = defineEmits<{
  close: []
}>()

const selectedValue = computed<number | null>(() => {
  if (!props.info?.weather) return null
  return props.info.weather[props.variable.key]
})

const swatchColor = computed<string>(() => {
  return temperatureToSolidColor(selectedValue.value, props.domain)
})

const isInteractiveCard = computed<boolean>(() => {
  return props.info?.interactionMode === 'touch' || props.info?.interactionMode === 'keyboard'
})

const tooltipDynamicStyle = computed<Record<string, string> | undefined>(() => {
  if (!props.info) return undefined
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
  if (isInteractiveCard.value && vw < 640) {
    return undefined
  }

  const cardWidth = 248
  const cardHeight = 132
  const offset = 16
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800

  let left = props.info.screenX + offset
  let top = props.info.screenY + offset

  if (left + cardWidth + 12 > vw) {
    left = Math.max(12, props.info.screenX - cardWidth - offset)
  }
  if (top + cardHeight + 16 > vh) {
    top = Math.max(72, props.info.screenY - cardHeight - offset)
  }

  return {
    left: `${Math.round(left)}px`,
    top: `${Math.round(top)}px`,
  }
})
</script>

<template>
  <Transition
    enter-active-class="transition duration-100 ease-out"
    enter-from-class="opacity-0 scale-95"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="transition duration-75 ease-in"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-95"
  >
    <div
      v-if="info"
      role="status"
      aria-live="polite"
      :class="[
        'z-30 rounded-xl bg-slate-900/95 text-slate-50 backdrop-blur-md shadow-xl ring-1 ring-white/15 px-3.5 py-3',
        isInteractiveCard ? 'pointer-events-auto' : 'pointer-events-none',
        isInteractiveCard
          ? 'fixed left-3 right-3 bottom-28 sm:bottom-auto sm:right-auto sm:w-64'
          : 'fixed w-60',
      ]"
      :style="tooltipDynamicStyle"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 truncate">
            Município • {{ info.regionName }}
          </p>
          <h2 class="text-sm font-bold leading-snug text-white truncate">
            {{ info.municipalityName }}
          </h2>
        </div>

        <button
          v-if="isInteractiveCard"
          type="button"
          aria-label="Fechar informações do município"
          class="shrink-0 -mr-1 -mt-1 rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-400"
          @click="emit('close')"
        >
          <X class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div class="mt-2.5 flex items-center justify-between gap-2 rounded-lg bg-white/8 px-2.5 py-2">
        <div class="flex items-center gap-2 min-w-0">
          <span
            class="h-3 w-3 shrink-0 rounded-full ring-2 ring-white/80"
            :style="{ backgroundColor: swatchColor }"
            aria-hidden="true"
          />
          <span class="text-xs text-slate-200 truncate">
            {{ variable.label }}
          </span>
        </div>
        <span class="text-sm font-extrabold tabular-nums text-white shrink-0">
          {{ formatTemperatureValue(selectedValue) }}
        </span>
      </div>

      <div
        v-if="info.weather"
        class="mt-2 flex items-center justify-between text-[11px] text-slate-300 tabular-nums"
      >
        <span>
          Mín: <strong class="font-semibold text-sky-300">{{ formatTemperatureValue(info.weather.minimumTemperature) }}</strong>
        </span>
        <span>
          Máx: <strong class="font-semibold text-amber-300">{{ formatTemperatureValue(info.weather.maximumTemperature) }}</strong>
        </span>
      </div>
      <p v-else class="mt-2 text-[11px] text-amber-300/90">
        Sem informações meteorológicas para este município.
      </p>
    </div>
  </Transition>
</template>
