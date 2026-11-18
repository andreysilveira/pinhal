import { computed, ref, shallowRef } from 'vue'
import { DEFAULT_STALE_HOURS, EXPECTED_PARANA_MUNICIPALITIES, WEATHER_VARIABLES } from '../constants/mapConfig'
import { fetchWeatherDataset } from '../services/weatherService'
import type {
  DataAvailabilityState,
  MunicipalityWeather,
  TemperatureScaleDomain,
  WeatherDatasetMetadata,
  WeatherVariableDefinition,
  WeatherVariableKey,
} from '../types/weather'
import { isDatasetTimestampStale } from '../utils/geoUtils'
import { computeTemperatureDomain } from '../utils/temperatureColors'

export function useWeatherData() {
  const selectedVariable = ref<WeatherVariableKey>('currentTemperature')
  const weatherById = shallowRef<ReadonlyMap<string, MunicipalityWeather>>(new Map())
  const metadata = shallowRef<WeatherDatasetMetadata | null>(null)
  const isLoadingWeather = ref<boolean>(true)
  const weatherError = ref<string | null>(null)

  const activeVariableDefinition = computed<WeatherVariableDefinition>(() => {
    return (
      WEATHER_VARIABLES.find((item) => item.key === selectedVariable.value) ??
      WEATHER_VARIABLES[0]!
    )
  })

  const activeVariableValues = computed<readonly (number | null)[]>(() => {
    const key = selectedVariable.value
    const values: (number | null)[] = []
    for (const item of weatherById.value.values()) {
      values.push(item[key])
    }
    return values
  })

  const availableVariableCount = computed<number>(() => {
    let count = 0
    for (const val of activeVariableValues.value) {
      if (val !== null && Number.isFinite(val)) {
        count += 1
      }
    }
    return count
  })

  const temperatureDomain = computed<TemperatureScaleDomain>(() => {
    return computeTemperatureDomain(activeVariableValues.value)
  })

  const isStale = computed<boolean>(() => {
    const meta = metadata.value
    if (!meta) return false
    const referenceIso = meta.collectedAt || meta.updatedAt
    const threshold = meta.staleAfterHours ?? DEFAULT_STALE_HOURS
    return isDatasetTimestampStale(referenceIso, threshold)
  })

  const availabilityState = computed<DataAvailabilityState>(() => {
    if (isLoadingWeather.value && weatherById.value.size === 0) {
      return 'loading'
    }
    if (weatherById.value.size === 0 || availableVariableCount.value === 0) {
      return 'unavailable'
    }
    if (metadata.value?.isDemo || metadata.value?.status === 'demo') {
      return 'demo'
    }
    if (isStale.value) {
      return 'stale'
    }
    if (availableVariableCount.value < EXPECTED_PARANA_MUNICIPALITIES) {
      return 'partial'
    }
    return 'ready'
  })

  function setSelectedVariable(variable: WeatherVariableKey): void {
    selectedVariable.value = variable
  }

  function getMunicipalityWeather(municipalityId: string): MunicipalityWeather | null {
    return weatherById.value.get(municipalityId) ?? null
  }

  async function loadWeatherData(): Promise<void> {
    isLoadingWeather.value = true
    weatherError.value = null

    try {
      const response = await fetchWeatherDataset()
      const nextMap = new Map<string, MunicipalityWeather>()
      for (const entry of response.municipalities) {
        nextMap.set(entry.municipalityId, entry)
      }

      if (nextMap.size === 0) {
        throw new Error('O conjunto de dados meteorológicos retornou vazio.')
      }

      weatherById.value = nextMap
      metadata.value = response.metadata
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar os dados meteorológicos no momento.'
      weatherError.value = message
      // Note: if weatherById already holds a previous valid dataset, it is intentionally preserved.
    } finally {
      isLoadingWeather.value = false
    }
  }

  return {
    selectedVariable,
    weatherById,
    metadata,
    isLoadingWeather,
    weatherError,
    activeVariableDefinition,
    availableVariableCount,
    temperatureDomain,
    isStale,
    availabilityState,
    setSelectedVariable,
    getMunicipalityWeather,
    loadWeatherData,
  }
}
