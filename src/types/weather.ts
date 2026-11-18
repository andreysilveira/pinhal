export type WeatherVariableKey =
  | 'currentTemperature'
  | 'maximumTemperature'
  | 'minimumTemperature'

export interface WeatherVariableDefinition {
  readonly key: WeatherVariableKey
  readonly label: string
  readonly shortLabel: string
  readonly description: string
  readonly unit: '°C'
}

export interface MunicipalityWeather {
  readonly municipalityId: string
  readonly municipalityName: string
  readonly currentTemperature: number | null
  readonly maximumTemperature: number | null
  readonly minimumTemperature: number | null
  readonly updatedAt: string
}

export type DatasetCollectionStatus = 'complete' | 'partial' | 'demo' | 'error'

export interface WeatherDatasetMetadata {
  readonly source: string
  readonly sourceUrl: string
  readonly attribution?: string
  readonly collectedAt: string
  readonly updatedAt: string
  readonly totalMunicipalities: number
  readonly availableMunicipalities: number
  readonly status: DatasetCollectionStatus
  readonly isDemo?: boolean
  readonly staleAfterHours?: number
}

export interface WeatherDatasetResponse {
  readonly metadata: WeatherDatasetMetadata
  readonly municipalities: readonly MunicipalityWeather[]
}

export type DataAvailabilityState =
  | 'loading'
  | 'ready'
  | 'partial'
  | 'stale'
  | 'demo'
  | 'unavailable'

export interface TemperatureScaleDomain {
  readonly min: number
  readonly max: number
  readonly unit: '°C'
}

export interface HoveredMunicipalityInfo {
  readonly municipalityId: string
  readonly municipalityName: string
  readonly regionName: string
  readonly weather: MunicipalityWeather | null
  readonly screenX: number
  readonly screenY: number
  readonly interactionMode: 'hover' | 'touch' | 'keyboard'
}
