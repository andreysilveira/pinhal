import type { BaseMapOption } from '../types/geography'
import type { WeatherVariableDefinition } from '../types/weather'

/**
 * Geographic bounding box for Paraná state in EPSG:4326 [minLon, minLat, maxLon, maxLat]
 */
export const PARANA_LONLAT_EXTENT: readonly [number, number, number, number] = [
  -54.62,
  -26.72,
  -48.02,
  -22.51,
]

export const PARANA_CENTER_LONLAT: readonly [number, number] = [-51.32, -24.62]

export const DATA_PROJECTION = 'EPSG:4326'
export const MAP_PROJECTION = 'EPSG:3857'

export const EXPECTED_PARANA_MUNICIPALITIES = 399
export const DEFAULT_STALE_HOURS = 6

export const BASE_MAP_OPTIONS: readonly BaseMapOption[] = [
  {
    id: 'light',
    label: 'Mapa Claro',
    shortLabel: 'Claro',
    description:
      'Mapa-base claro monocromático derivado do OpenStreetMap para alto contraste coroplético',
    attributions:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
  },
  {
    id: 'osm',
    label: 'OpenStreetMap',
    shortLabel: 'OSM',
    description: 'Mapa colaborativo padrão colorido do OpenStreetMap',
    attributions:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
  },
] as const

export const WEATHER_VARIABLES: readonly WeatherVariableDefinition[] = [
  {
    key: 'currentTemperature',
    label: 'Temperatura atual',
    shortLabel: 'Atual',
    description: 'Temperatura do ar a 2 metros registrada/modelada no momento',
    unit: '°C',
  },
  {
    key: 'maximumTemperature',
    label: 'Temperatura máxima',
    shortLabel: 'Máxima',
    description: 'Temperatura máxima prevista para o dia atual',
    unit: '°C',
  },
  {
    key: 'minimumTemperature',
    label: 'Temperatura mínima',
    shortLabel: 'Mínima',
    description: 'Temperatura mínima prevista para o dia atual',
    unit: '°C',
  },
] as const
