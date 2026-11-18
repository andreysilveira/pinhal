import Attribution from 'ol/control/Attribution'
import ScaleLine from 'ol/control/ScaleLine'
import { isEmpty as isExtentEmpty } from 'ol/extent'
import Feature from 'ol/Feature'
import GeoJSON from 'ol/format/GeoJSON'
import type Geometry from 'ol/geom/Geometry'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import OlMap from 'ol/Map'
import { fromLonLat, transformExtent } from 'ol/proj'
import OSM from 'ol/source/OSM'
import VectorSource from 'ol/source/Vector'
import View from 'ol/View'
import { onBeforeUnmount, ref, shallowRef, watch, type ComputedRef, type Ref } from 'vue'
import {
  BASE_MAP_OPTIONS,
  DATA_PROJECTION,
  MAP_PROJECTION,
  PARANA_CENTER_LONLAT,
  PARANA_LONLAT_EXTENT,
} from '../constants/mapConfig'
import { fetchMunicipalitiesGeoJson } from '../services/weatherService'
import type { BaseMapId, MunicipalitySummary } from '../types/geography'
import type {
  MunicipalityWeather,
  TemperatureScaleDomain,
  WeatherVariableKey,
} from '../types/weather'
import { extractMunicipalityProperties } from '../utils/geoUtils'
import {
  getChoroplethStyleForTemperature,
  getMunicipalityHighlightStyle,
} from '../utils/mapStyles'

export interface UseOpenLayersOptions {
  readonly selectedVariable: Ref<WeatherVariableKey>
  readonly temperatureDomain: ComputedRef<TemperatureScaleDomain>
  readonly getMunicipalityWeather: (municipalityId: string) => MunicipalityWeather | null
  readonly weatherVersionTrigger: Ref<unknown>
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function computeResponsivePadding(): [number, number, number, number] {
  if (typeof window === 'undefined') {
    return [84, 36, 56, 36]
  }
  const isMobile = window.innerWidth < 640
  return isMobile ? [108, 48, 112, 18] : [88, 44, 64, 56]
}

export function useOpenLayers(options: UseOpenLayersOptions) {
  const activeBaseMap = ref<BaseMapId>('light')
  const isLoadingGeodata = ref<boolean>(true)
  const geodataError = ref<string | null>(null)
  const municipalitiesList = shallowRef<readonly MunicipalitySummary[]>([])

  const mapInstance = shallowRef<OlMap | null>(null)
  const municipalitiesSource = new VectorSource<Feature<Geometry>>()
  const highlightSource = new VectorSource<Feature<Geometry>>()

  const lightOption = BASE_MAP_OPTIONS.find((b) => b.id === 'light')!
  const osmOption = BASE_MAP_OPTIONS.find((b) => b.id === 'osm')!

  const lightLayer = new TileLayer({
    className: 'ol-layer pinhal-basemap-light',
    visible: activeBaseMap.value === 'light',
    preload: 2,
    zIndex: 0,
    source: new OSM({
      attributions: lightOption.attributions,
    }),
  })

  const osmLayer = new TileLayer({
    className: 'ol-layer pinhal-basemap-osm',
    visible: activeBaseMap.value === 'osm',
    preload: 2,
    zIndex: 0,
    source: new OSM({
      attributions: osmOption.attributions,
    }),
  })

  const municipalitiesLayer = new VectorLayer({
    className: 'ol-layer pinhal-layer-municipalities',
    source: municipalitiesSource,
    zIndex: 10,
    updateWhileAnimating: true,
    updateWhileInteracting: true,
    style: (feature) => {
      const munId = String(feature.get('municipalityId') ?? feature.getId() ?? '')
      const record = munId ? options.getMunicipalityWeather(munId) : null
      const temperature = record ? record[options.selectedVariable.value] : null
      return getChoroplethStyleForTemperature(temperature, options.temperatureDomain.value)
    },
  })

  const highlightLayer = new VectorLayer({
    className: 'ol-layer pinhal-layer-highlight',
    source: highlightSource,
    zIndex: 20,
    updateWhileAnimating: true,
    updateWhileInteracting: true,
    style: getMunicipalityHighlightStyle,
  })

  function initializeMap(targetElement: HTMLElement): OlMap {
    if (mapInstance.value) {
      mapInstance.value.setTarget(targetElement)
      return mapInstance.value
    }

    const defaultExtent = transformExtent(
      [...PARANA_LONLAT_EXTENT],
      DATA_PROJECTION,
      MAP_PROJECTION,
    )

    const view = new View({
      projection: MAP_PROJECTION,
      center: fromLonLat([...PARANA_CENTER_LONLAT], MAP_PROJECTION),
      zoom: 7,
      minZoom: 5.5,
      maxZoom: 14,
      constrainOnlyCenter: false,
      extent: [
        defaultExtent[0]! - 900_000,
        defaultExtent[1]! - 700_000,
        defaultExtent[2]! + 900_000,
        defaultExtent[3]! + 700_000,
      ],
    })

    const map = new OlMap({
      target: targetElement,
      layers: [lightLayer, osmLayer, municipalitiesLayer, highlightLayer],
      view,
      controls: [
        new ScaleLine({
          units: 'metric',
        }),
        new Attribution({
          collapsible: true,
          collapsed: false,
          tipLabel: 'Atribuições cartográficas e fontes de dados',
        }),
      ],
    })

    mapInstance.value = map
    fitToParana(false)
    return map
  }

  async function loadMunicipalitiesGeoJson(): Promise<void> {
    isLoadingGeodata.value = true
    geodataError.value = null

    try {
      const geojsonPayload = await fetchMunicipalitiesGeoJson()
      const format = new GeoJSON()
      const features = format.readFeatures(geojsonPayload, {
        dataProjection: DATA_PROJECTION,
        featureProjection: MAP_PROJECTION,
      })

      const summaries: MunicipalitySummary[] = []
      for (const feature of features) {
        const props = extractMunicipalityProperties(feature)
        if (props) {
          feature.setId(props.municipalityId)
          summaries.push({
            municipalityId: props.municipalityId,
            municipalityName: props.municipalityName,
            regionName: props.regionName,
            centroidLon: props.centroidLon,
            centroidLat: props.centroidLat,
          })
        }
      }

      summaries.sort((a, b) => a.municipalityName.localeCompare(b.municipalityName, 'pt-BR'))

      municipalitiesSource.clear(true)
      municipalitiesSource.addFeatures(features)
      municipalitiesList.value = summaries

      fitToParana(false)
    } catch (err: unknown) {
      geodataError.value =
        err instanceof Error
          ? err.message
          : 'Erro ao carregar os limites municipais do Paraná.'
    } finally {
      isLoadingGeodata.value = false
    }
  }

  function setBaseMap(baseMapId: BaseMapId): void {
    activeBaseMap.value = baseMapId
    lightLayer.setVisible(baseMapId === 'light')
    osmLayer.setVisible(baseMapId === 'osm')
  }

  function fitToParana(animated = true): void {
    const map = mapInstance.value
    if (!map) return

    const sourceExtent = municipalitiesSource.getExtent()
    const targetExtent =
      sourceExtent && !isExtentEmpty(sourceExtent)
        ? sourceExtent
        : transformExtent([...PARANA_LONLAT_EXTENT], DATA_PROJECTION, MAP_PROJECTION)

    const duration = animated && !prefersReducedMotion() ? 320 : 0
    map.getView().fit(targetExtent, {
      padding: computeResponsivePadding(),
      maxZoom: 9,
      duration,
    })
  }

  function zoomByDelta(delta: number): void {
    const map = mapInstance.value
    if (!map) return
    const view = map.getView()
    const currentZoom = view.getZoom() ?? 7
    const nextZoom = Math.max(
      view.getMinZoom(),
      Math.min(view.getMaxZoom(), currentZoom + delta),
    )

    if (prefersReducedMotion()) {
      view.setZoom(nextZoom)
    } else {
      view.animate({ zoom: nextZoom, duration: 200 })
    }
  }

  function zoomIn(): void {
    zoomByDelta(0.8)
  }

  function zoomOut(): void {
    zoomByDelta(-0.8)
  }

  function getFeatureByMunicipalityId(municipalityId: string): Feature<Geometry> | null {
    return municipalitiesSource.getFeatureById(municipalityId) ?? null
  }

  watch([options.selectedVariable, options.weatherVersionTrigger], () => {
    municipalitiesLayer.changed()
  })

  onBeforeUnmount(() => {
    if (mapInstance.value) {
      mapInstance.value.setTarget(undefined)
      mapInstance.value = null
    }
  })

  return {
    mapInstance,
    municipalitiesLayer,
    municipalitiesSource,
    highlightSource,
    activeBaseMap,
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
  }
}
