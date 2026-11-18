<script setup lang="ts">
import { AlertCircle, Clock, FlaskConical, Loader2 } from 'lucide-vue-next'
import { computed, onMounted, ref, type ComputedRef, type Ref } from 'vue'
import { EXPECTED_PARANA_MUNICIPALITIES } from '../../constants/mapConfig'
import { useMunicipalityInteraction } from '../../composables/useMunicipalityInteraction'
import { useOpenLayers } from '../../composables/useOpenLayers'
import type { BaseMapId, MunicipalitySummary } from '../../types/geography'
import type {
  DataAvailabilityState,
  MunicipalityWeather,
  TemperatureScaleDomain,
  WeatherDatasetMetadata,
  WeatherVariableDefinition,
  WeatherVariableKey,
} from '../../types/weather'
import { formatTimestampPtBr } from '../../utils/geoUtils'
import MapControls from './MapControls.vue'
import MunicipalityTooltip from './MunicipalityTooltip.vue'
import TemperatureLegend from './TemperatureLegend.vue'

const props = defineProps<{
  selectedVariable: WeatherVariableKey
  activeVariableDefinition: WeatherVariableDefinition
  temperatureDomain: TemperatureScaleDomain
  availabilityState: DataAvailabilityState
  availableVariableCount: number
  metadata: WeatherDatasetMetadata | null
  weatherError: string | null
  weatherVersionTrigger: unknown
  getMunicipalityWeather: (municipalityId: string) => MunicipalityWeather | null
}>()

const emit = defineEmits<{
  'update:activeBaseMap': [value: BaseMapId]
  municipalitiesLoaded: [list: readonly MunicipalitySummary[]]
  retryWeather: []
}>()

const mapContainerRef = ref<HTMLElement | null>(null)

const selectedVariableRef = computed(() => props.selectedVariable) as unknown as Ref<WeatherVariableKey>
const temperatureDomainRef = computed(() => props.temperatureDomain) as ComputedRef<TemperatureScaleDomain>
const weatherTriggerRef = computed(() => props.weatherVersionTrigger)

const {
  mapInstance,
  municipalitiesLayer,
  highlightSource,
  isLoadingGeodata,
  geodataError,
  municipalitiesList,
  initializeMap,
  loadMunicipalitiesGeoJson,
  setBaseMap,
  fitToParana,
  zoomIn,
  zoomOut,
  getFeatureByMunicipalityId,
} = useOpenLayers({
  selectedVariable: selectedVariableRef,
  temperatureDomain: temperatureDomainRef,
  getMunicipalityWeather: props.getMunicipalityWeather,
  weatherVersionTrigger: weatherTriggerRef,
})

const {
  activeMunicipalityInfo,
  bindToMap,
  clearActiveMunicipality,
  focusMunicipalityFeature,
} = useMunicipalityInteraction({
  mapInstance,
  municipalitiesLayer,
  highlightSource,
  getMunicipalityWeather: props.getMunicipalityWeather,
})

const activeHoveredTemperature = computed<number | null>(() => {
  const weather = activeMunicipalityInfo.value?.weather
  if (!weather) return null
  return weather[props.selectedVariable]
})

const hasMissingMunicipalities = computed<boolean>(() => {
  return (
    props.availableVariableCount > 0 &&
    props.availableVariableCount < EXPECTED_PARANA_MUNICIPALITIES
  )
})

function applyBaseMap(id: BaseMapId): void {
  setBaseMap(id)
  emit('update:activeBaseMap', id)
}

function selectMunicipalityById(municipalityId: string): void {
  const feature = getFeatureByMunicipalityId(municipalityId)
  focusMunicipalityFeature(feature)
}

defineExpose({
  applyBaseMap,
  selectMunicipalityById,
})

onMounted(async () => {
  if (mapContainerRef.value) {
    const map = initializeMap(mapContainerRef.value)
    bindToMap(map)
  }
  await loadMunicipalitiesGeoJson()
  emit('municipalitiesLoaded', municipalitiesList.value)
})
</script>

<template>
  <section
    aria-label="Mapa meteorológico interativo dos 399 municípios do Paraná"
    class="relative h-full w-full select-none overflow-hidden bg-slate-200"
  >
    <!-- Full-Viewport OpenLayers Canvas -->
    <div ref="mapContainerRef" class="pinhal-map h-full w-full" />

    <!-- Non-blocking Contextual Status Banners (Stale / Demo / Unavailable / Geodata Error) -->
    <div
      class="pointer-events-none fixed inset-x-0 top-24 sm:top-18 z-20 flex flex-col items-center gap-2 px-3"
    >
      <div
        v-if="isLoadingGeodata"
        role="status"
        class="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-slate-900/90 px-4 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-md"
      >
        <Loader2 class="h-3.5 w-3.5 animate-spin text-teal-300" aria-hidden="true" />
        <span>Carregando malha municipal do Paraná (IBGE)...</span>
      </div>

      <div
        v-if="geodataError"
        role="alert"
        class="pointer-events-auto inline-flex items-center gap-2 rounded-xl bg-rose-950/92 px-4 py-2 text-xs font-medium text-rose-100 shadow-lg ring-1 ring-rose-400/30"
      >
        <AlertCircle class="h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
        <span>{{ geodataError }}</span>
      </div>

      <div
        v-else-if="availabilityState === 'unavailable'"
        role="alert"
        class="pointer-events-auto inline-flex flex-wrap items-center gap-2 rounded-xl bg-amber-950/92 px-3.5 py-2 text-xs text-amber-100 shadow-lg ring-1 ring-amber-400/30"
      >
        <AlertCircle class="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
        <span>
          Dados meteorológicos indisponíveis ({{ weatherError || 'falha de comunicação' }}). O mapa permanece navegável.
        </span>
        <button
          type="button"
          class="rounded-md bg-amber-300 px-2 py-0.5 text-[11px] font-bold text-amber-950 hover:bg-amber-200 cursor-pointer"
          @click="emit('retryWeather')"
        >
          Tentar novamente
        </button>
      </div>

      <div
        v-else-if="availabilityState === 'demo'"
        role="status"
        class="pointer-events-auto inline-flex items-center gap-2 rounded-xl bg-purple-950/92 px-3.5 py-1.5 text-xs font-medium text-purple-100 shadow-lg ring-1 ring-purple-400/30"
      >
        <FlaskConical class="h-4 w-4 shrink-0 text-purple-300" aria-hidden="true" />
        <span>
          Exibindo conjunto de dados de demonstração fictício (modo offline).
        </span>
      </div>

      <div
        v-else-if="availabilityState === 'stale' && metadata"
        role="status"
        class="pointer-events-auto inline-flex items-center gap-2 rounded-xl bg-slate-900/90 px-3.5 py-1.5 text-xs font-medium text-amber-200 shadow-lg ring-1 ring-amber-400/25"
      >
        <Clock class="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
        <span>
          Dados meteorológicos com última atualização em {{ formatTimestampPtBr(metadata.updatedAt || metadata.collectedAt) }}.
        </span>
      </div>
    </div>

    <!-- Navigation Controls (Right-Center on Mobile, Top-Left below header on Desktop) -->
    <div
      class="pointer-events-none fixed right-2.5 top-1/2 -translate-y-1/2 sm:right-auto sm:left-3.5 sm:top-24 lg:top-20 sm:translate-y-0 z-10"
    >
      <MapControls
        @zoom-in="zoomIn"
        @zoom-out="zoomOut"
        @reset-extent="fitToParana(true)"
      />
    </div>

    <!-- Bottom-Right Meteorological Legend (positioned cleanly above attribution) -->
    <div class="pointer-events-none fixed right-2.5 bottom-10 sm:right-3.5 sm:bottom-9 z-10">
      <TemperatureLegend
        :domain="temperatureDomain"
        :variable="activeVariableDefinition"
        :active-temperature="activeHoveredTemperature"
        :has-missing-municipalities="hasMissingMunicipalities"
      />
    </div>

    <!-- Dynamic Floating Municipality Tooltip (Hover on Desktop / Tap & Keyboard Card) -->
    <MunicipalityTooltip
      :info="activeMunicipalityInfo"
      :variable="activeVariableDefinition"
      :domain="temperatureDomain"
      @close="clearActiveMunicipality"
    />
  </section>
</template>
