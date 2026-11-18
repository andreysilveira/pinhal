import type { FeatureLike } from 'ol/Feature'
import Fill from 'ol/style/Fill'
import Stroke from 'ol/style/Stroke'
import Style from 'ol/style/Style'
import type { TemperatureScaleDomain } from '../types/weather'
import {
  interpolateViridisRgb,
  NO_DATA_RGBA,
  normalizeTemperatureInDomain,
} from './temperatureColors'

const QUANTIZATION_STEPS = 256
const BORDER_STROKE = new Stroke({
  color: 'rgba(15, 23, 42, 0.38)',
  width: 0.7,
})

const NO_DATA_BORDER_STROKE = new Stroke({
  color: 'rgba(71, 85, 105, 0.5)',
  width: 0.65,
  lineDash: [3, 3],
})

const NO_DATA_STYLE = new Style({
  fill: new Fill({ color: NO_DATA_RGBA }),
  stroke: NO_DATA_BORDER_STROKE,
  zIndex: 1,
})

/**
 * Fixed-size cache of 256 Viridis polygon styles.
 * Prevents creating `Style` / `Fill` objects during map pan, zoom, or pointer movements.
 */
const bucketStyleCache: (Style | undefined)[] = new Array<Style | undefined>(QUANTIZATION_STEPS)

function getBucketStyle(bucketIndex: number): Style {
  const clamped = Math.max(0, Math.min(QUANTIZATION_STEPS - 1, bucketIndex))
  const existing = bucketStyleCache[clamped]
  if (existing) {
    return existing
  }

  const normalized = clamped / (QUANTIZATION_STEPS - 1)
  const { r, g, b } = interpolateViridisRgb(normalized)
  const created = new Style({
    fill: new Fill({ color: `rgba(${r}, ${g}, ${b}, 0.82)` }),
    stroke: BORDER_STROKE,
    zIndex: 2,
  })
  bucketStyleCache[clamped] = created
  return created
}

export function getChoroplethStyleForTemperature(
  temperature: number | null | undefined,
  domain: TemperatureScaleDomain,
): Style {
  if (temperature === null || temperature === undefined || !Number.isFinite(temperature)) {
    return NO_DATA_STYLE
  }

  const normalized = normalizeTemperatureInDomain(temperature, domain)
  const bucket = Math.round(normalized * (QUANTIZATION_STEPS - 1))
  return getBucketStyle(bucket)
}

/**
 * Dual-stroke halo style used exclusively on the temporary highlight overlay layer.
 * Ensures high visual contrast regardless of underlying Viridis luminance.
 */
const HIGHLIGHT_STYLES: Style[] = [
  new Style({
    stroke: new Stroke({
      color: 'rgba(255, 255, 255, 0.96)',
      width: 4.4,
    }),
    zIndex: 99,
  }),
  new Style({
    fill: new Fill({
      color: 'rgba(255, 255, 255, 0.14)',
    }),
    stroke: new Stroke({
      color: '#0f172a',
      width: 2.1,
    }),
    zIndex: 100,
  }),
]

export function getMunicipalityHighlightStyle(_feature?: FeatureLike): Style[] {
  return HIGHLIGHT_STYLES
}
