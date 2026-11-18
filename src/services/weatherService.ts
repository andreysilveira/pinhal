import type { MunicipalityGeoJsonCollection } from '../types/geography'
import type { MunicipalityWeather, WeatherDatasetResponse } from '../types/weather'

function resolveDataUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL || './'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  const cleanedPath = relativePath.replace(/^\/+/, '')
  return `${normalizedBase}${cleanedPath}`
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  return null
}

function validateMunicipalityWeatherItem(raw: unknown): MunicipalityWeather | null {
  if (!isObjectRecord(raw)) return null
  const municipalityId = typeof raw.municipalityId === 'string' ? raw.municipalityId.trim() : ''
  const municipalityName =
    typeof raw.municipalityName === 'string' ? raw.municipalityName.trim() : ''

  if (!municipalityId || !municipalityName) {
    return null
  }

  return {
    municipalityId,
    municipalityName,
    currentTemperature: parseNullableNumber(raw.currentTemperature),
    maximumTemperature: parseNullableNumber(raw.maximumTemperature),
    minimumTemperature: parseNullableNumber(raw.minimumTemperature),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
  }
}

export async function fetchMunicipalitiesGeoJson(): Promise<MunicipalityGeoJsonCollection> {
  const url = resolveDataUrl('data/municipalities.geojson')
  const response = await fetch(url, {
    headers: { Accept: 'application/geo+json, application/json' },
  })

  if (!response.ok) {
    throw new Error(`Falha ao carregar malha municipal do Paraná (HTTP ${response.status})`)
  }

  const payload: unknown = await response.json()
  if (
    !isObjectRecord(payload) ||
    payload.type !== 'FeatureCollection' ||
    !Array.isArray(payload.features)
  ) {
    throw new Error('Formato inválido de GeoJSON para os municípios do Paraná')
  }

  return payload as unknown as MunicipalityGeoJsonCollection
}

export async function fetchWeatherDataset(): Promise<WeatherDatasetResponse> {
  const url = `${resolveDataUrl('data/temperatures.json')}?v=${Math.floor(Date.now() / 60000)}`
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Falha ao carregar dados meteorológicos (HTTP ${response.status})`)
  }

  const payload: unknown = await response.json()
  if (
    !isObjectRecord(payload) ||
    !isObjectRecord(payload.metadata) ||
    !Array.isArray(payload.municipalities)
  ) {
    throw new Error('Estrutura JSON de dados meteorológicos inválida')
  }

  const validMunicipalities: MunicipalityWeather[] = []
  for (const item of payload.municipalities) {
    const parsed = validateMunicipalityWeatherItem(item)
    if (parsed) {
      validMunicipalities.push(parsed)
    }
  }

  const meta = payload.metadata
  const statusRaw = meta.status
  const status =
    statusRaw === 'complete' ||
    statusRaw === 'partial' ||
    statusRaw === 'demo' ||
    statusRaw === 'error'
      ? statusRaw
      : 'partial'

  return {
    metadata: {
      source: typeof meta.source === 'string' ? meta.source : 'Fonte não especificada',
      sourceUrl: typeof meta.sourceUrl === 'string' ? meta.sourceUrl : '',
      attribution: typeof meta.attribution === 'string' ? meta.attribution : undefined,
      collectedAt: typeof meta.collectedAt === 'string' ? meta.collectedAt : '',
      updatedAt: typeof meta.updatedAt === 'string' ? meta.updatedAt : '',
      totalMunicipalities:
        typeof meta.totalMunicipalities === 'number' ? meta.totalMunicipalities : 399,
      availableMunicipalities: validMunicipalities.length,
      status,
      isDemo: Boolean(meta.isDemo),
      staleAfterHours:
        typeof meta.staleAfterHours === 'number' ? meta.staleAfterHours : undefined,
    },
    municipalities: validMunicipalities,
  }
}
