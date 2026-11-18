<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'
import AppHeader from './components/layout/AppHeader.vue'
import MapView from './components/map/MapView.vue'
import { useWeatherData } from './composables/useWeatherData'
import type { BaseMapId, MunicipalitySummary } from './types/geography'
import type { WeatherVariableKey } from './types/weather'

const {
  selectedVariable,
  weatherById,
  metadata,
  isLoadingWeather,
  weatherError,
  activeVariableDefinition,
  availableVariableCount,
  temperatureDomain,
  availabilityState,
  setSelectedVariable,
  getMunicipalityWeather,
  loadWeatherData,
} = useWeatherData()

const activeBaseMap = ref<BaseMapId>('light')
const municipalities = shallowRef<readonly MunicipalitySummary[]>([])
const mapViewRef = ref<InstanceType<typeof MapView> | null>(null)

function handleVariableChange(nextVariable: WeatherVariableKey): void {
  setSelectedVariable(nextVariable)
}

function handleBaseMapChange(nextBaseMap: BaseMapId): void {
  activeBaseMap.value = nextBaseMap
  mapViewRef.value?.applyBaseMap(nextBaseMap)
}

function handleMunicipalitiesLoaded(list: readonly MunicipalitySummary[]): void {
  municipalities.value = list
}

function handleSelectMunicipality(municipalityId: string): void {
  mapViewRef.value?.selectMunicipalityById(municipalityId)
}

onMounted(() => {
  void loadWeatherData()
})
</script>

<template>
  <div class="relative h-full w-full overflow-hidden">
    <AppHeader
      :selected-variable="selectedVariable"
      :active-base-map="activeBaseMap"
      :availability-state="availabilityState"
      :metadata="metadata"
      :is-loading-weather="isLoadingWeather"
      :municipalities="municipalities"
      :get-municipality-weather="getMunicipalityWeather"
      @update:selected-variable="handleVariableChange"
      @update:active-base-map="handleBaseMapChange"
      @select-municipality="handleSelectMunicipality"
      @refresh-weather="loadWeatherData"
    />

    <main class="h-full w-full">
      <MapView
        ref="mapViewRef"
        :selected-variable="selectedVariable"
        :active-variable-definition="activeVariableDefinition"
        :temperature-domain="temperatureDomain"
        :availability-state="availabilityState"
        :available-variable-count="availableVariableCount"
        :metadata="metadata"
        :weather-error="weatherError"
        :weather-version-trigger="weatherById"
        :get-municipality-weather="getMunicipalityWeather"
        @update:active-base-map="activeBaseMap = $event"
        @municipalities-loaded="handleMunicipalitiesLoaded"
        @retry-weather="loadWeatherData"
      />
    </main>
  </div>
</template>
