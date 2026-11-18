import type { FeatureLike } from 'ol/Feature'
import { DEFAULT_STALE_HOURS } from '../constants/mapConfig'
import type { MunicipalityFeatureProperties } from '../types/geography'

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function extractMunicipalityProperties(
  feature: FeatureLike,
): MunicipalityFeatureProperties | null {
  const rawId = feature.get('municipalityId') ?? feature.getId()
  const rawName = feature.get('municipalityName')

  if (typeof rawId !== 'string' || typeof rawName !== 'string' || !rawId || !rawName) {
    return null
  }

  const rawRegion = feature.get('regionName')
  const rawLon = feature.get('centroidLon')
  const rawLat = feature.get('centroidLat')
  const rawArea = feature.get('areaKm2')

  return {
    municipalityId: rawId,
    municipalityName: rawName,
    regionName: typeof rawRegion === 'string' && rawRegion ? rawRegion : 'Paraná',
    centroidLon: typeof rawLon === 'number' ? rawLon : -51.32,
    centroidLat: typeof rawLat === 'number' ? rawLat : -24.62,
    areaKm2: typeof rawArea === 'number' ? rawArea : null,
  }
}

export function formatTimestampPtBr(isoString: string | null | undefined): string {
  if (!isoString) return 'Horário indisponível'
  const parsed = new Date(isoString)
  if (Number.isNaN(parsed.getTime())) {
    return isoString
  }
  return dateTimeFormatter.format(parsed)
}

export function isDatasetTimestampStale(
  isoString: string | null | undefined,
  staleAfterHours = DEFAULT_STALE_HOURS,
): boolean {
  if (!isoString) return true
  const parsed = new Date(isoString)
  if (Number.isNaN(parsed.getTime())) return false

  const elapsedMs = Date.now() - parsed.getTime()
  return elapsedMs > staleAfterHours * 60 * 60 * 1000
}
