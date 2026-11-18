import type { TemperatureScaleDomain } from '../types/weather'

interface RgbTuple {
  readonly r: number
  readonly g: number
  readonly b: number
}

/**
 * Perceptually uniform Viridis scientific colormap (11 stops from 0.0 to 1.0).
 * Accessible under common forms of color-vision deficiency (deuteranopia/protanopia).
 */
export const VIRIDIS_STOPS: readonly RgbTuple[] = [
  { r: 68, g: 1, b: 84 }, // #440154 (0.0)
  { r: 72, g: 36, b: 117 }, // #482475 (0.1)
  { r: 65, g: 68, b: 135 }, // #414487 (0.2)
  { r: 53, g: 95, b: 141 }, // #355f8d (0.3)
  { r: 42, g: 120, b: 142 }, // #2a788e (0.4)
  { r: 33, g: 145, b: 140 }, // #21918c (0.5)
  { r: 34, g: 168, b: 132 }, // #22a884 (0.6)
  { r: 68, g: 191, b: 112 }, // #44bf70 (0.7)
  { r: 122, g: 209, b: 81 }, // #7ad151 (0.8)
  { r: 189, g: 223, b: 38 }, // #bddf26 (0.9)
  { r: 253, g: 231, b: 37 }, // #fde725 (1.0)
] as const

export const NO_DATA_RGBA = 'rgba(148, 163, 184, 0.52)'
export const NO_DATA_HEX = '#94a3b8'

const ptBrNumberFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function clamp01(value: number): number {
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

export function normalizeTemperatureInDomain(
  temperature: number,
  domain: TemperatureScaleDomain,
): number {
  const span = domain.max - domain.min
  if (span <= 0.0001) {
    return 0.5
  }
  return clamp01((temperature - domain.min) / span)
}

export function interpolateViridisRgb(normalizedT: number): RgbTuple {
  const t = clamp01(normalizedT)
  const scaled = t * (VIRIDIS_STOPS.length - 1)
  const lowerIndex = Math.floor(scaled)
  const upperIndex = Math.min(lowerIndex + 1, VIRIDIS_STOPS.length - 1)
  const fraction = scaled - lowerIndex

  const start = VIRIDIS_STOPS[lowerIndex] ?? VIRIDIS_STOPS[0]!
  const end = VIRIDIS_STOPS[upperIndex] ?? VIRIDIS_STOPS[VIRIDIS_STOPS.length - 1]!

  return {
    r: Math.round(start.r + (end.r - start.r) * fraction),
    g: Math.round(start.g + (end.g - start.g) * fraction),
    b: Math.round(start.b + (end.b - start.b) * fraction),
  }
}

/**
 * Centralized conversion of temperature (°C) to RGBA color string.
 */
export function temperatureToColor(
  temperature: number | null | undefined,
  domain: TemperatureScaleDomain,
  alpha = 0.82,
): string {
  if (temperature === null || temperature === undefined || !Number.isFinite(temperature)) {
    return NO_DATA_RGBA
  }

  const normalized = normalizeTemperatureInDomain(temperature, domain)
  const { r, g, b } = interpolateViridisRgb(normalized)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function temperatureToSolidColor(
  temperature: number | null | undefined,
  domain: TemperatureScaleDomain,
): string {
  if (temperature === null || temperature === undefined || !Number.isFinite(temperature)) {
    return NO_DATA_HEX
  }
  const normalized = normalizeTemperatureInDomain(temperature, domain)
  const { r, g, b } = interpolateViridisRgb(normalized)
  return `rgb(${r}, ${g}, ${b})`
}

export function computeTemperatureDomain(
  values: readonly (number | null | undefined)[],
): TemperatureScaleDomain {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (const val of values) {
    if (val !== null && val !== undefined && Number.isFinite(val)) {
      if (val < min) min = val
      if (val > max) max = val
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 10, max: 30, unit: '°C' }
  }

  if (Math.abs(max - min) < 0.5) {
    return {
      min: Math.floor((min - 1) * 10) / 10,
      max: Math.ceil((max + 1) * 10) / 10,
      unit: '°C',
    }
  }

  return {
    min: Math.round(min * 10) / 10,
    max: Math.round(max * 10) / 10,
    unit: '°C',
  }
}

export function buildViridisCssGradient(direction = 'to right'): string {
  const stops = VIRIDIS_STOPS.map((stop, idx) => {
    const pct = Math.round((idx / (VIRIDIS_STOPS.length - 1)) * 100)
    return `rgb(${stop.r}, ${stop.g}, ${stop.b}) ${pct}%`
  })
  return `linear-gradient(${direction}, ${stops.join(', ')})`
}

export function formatTemperatureValue(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'Indisponível'
  }
  return `${ptBrNumberFormatter.format(value)} °C`
}

export function formatScaleNumber(value: number): string {
  return ptBrNumberFormatter.format(value)
}
