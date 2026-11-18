import { getCenter } from 'ol/extent'
import Feature from 'ol/Feature'
import type Geometry from 'ol/geom/Geometry'
import type VectorLayer from 'ol/layer/Vector'
import type OlMap from 'ol/Map'
import type MapBrowserEvent from 'ol/MapBrowserEvent'
import type VectorSource from 'ol/source/Vector'
import { computed, onBeforeUnmount, ref, shallowRef, type ShallowRef } from 'vue'
import type { HoveredMunicipalityInfo, MunicipalityWeather } from '../types/weather'
import { extractMunicipalityProperties } from '../utils/geoUtils'

export interface UseMunicipalityInteractionOptions {
  readonly mapInstance: ShallowRef<OlMap | null>
  readonly municipalitiesLayer: VectorLayer<VectorSource<Feature<Geometry>>>
  readonly highlightSource: VectorSource<Feature<Geometry>>
  readonly getMunicipalityWeather: (municipalityId: string) => MunicipalityWeather | null
}

export function useMunicipalityInteraction(options: UseMunicipalityInteractionOptions) {
  const activeFeature = shallowRef<Feature<Geometry> | null>(null)
  const activeMunicipalityId = ref<string | null>(null)
  const screenX = ref<number>(0)
  const screenY = ref<number>(0)
  const interactionMode = ref<'hover' | 'touch' | 'keyboard'>('hover')

  let detachListeners: (() => void) | null = null

  const activeMunicipalityInfo = computed<HoveredMunicipalityInfo | null>(() => {
    const feature = activeFeature.value
    if (!feature) return null
    const props = extractMunicipalityProperties(feature)
    if (!props) return null

    return {
      municipalityId: props.municipalityId,
      municipalityName: props.municipalityName,
      regionName: props.regionName,
      weather: options.getMunicipalityWeather(props.municipalityId),
      screenX: screenX.value,
      screenY: screenY.value,
      interactionMode: interactionMode.value,
    }
  })

  function applyHighlightFeature(feature: Feature<Geometry> | null): void {
    const nextId = feature
      ? String(feature.get('municipalityId') ?? feature.getId() ?? '')
      : null

    if (nextId === activeMunicipalityId.value) {
      return
    }

    options.highlightSource.clear(true)
    if (feature && nextId) {
      options.highlightSource.addFeature(feature)
      activeFeature.value = feature
      activeMunicipalityId.value = nextId
    } else {
      activeFeature.value = null
      activeMunicipalityId.value = null
    }
  }

  function clearActiveMunicipality(): void {
    interactionMode.value = 'hover'
    applyHighlightFeature(null)
  }

  function findMunicipalityAtPixel(
    map: OlMap,
    pixel: number[],
  ): Feature<Geometry> | null {
    const found = map.forEachFeatureAtPixel(
      pixel,
      (feature) => feature as Feature<Geometry>,
      {
        layerFilter: (layer) => layer === options.municipalitiesLayer,
        hitTolerance: 3,
      },
    )
    return found ?? null
  }

  function handlePointerMove(event: MapBrowserEvent<PointerEvent>): void {
    if (event.dragging) {
      return
    }

    const pointerType = event.originalEvent?.pointerType
    if (pointerType === 'touch') {
      return
    }

    const map = event.map
    const feature = findMunicipalityAtPixel(map, event.pixel)
    const targetElement = map.getTargetElement()

    if (targetElement) {
      targetElement.style.cursor = feature ? 'pointer' : ''
    }

    // Keep explicitly tapped or searched card open until closed or replaced by click/tap
    if (
      activeMunicipalityId.value !== null &&
      (interactionMode.value === 'touch' || interactionMode.value === 'keyboard')
    ) {
      return
    }

    if (feature) {
      interactionMode.value = 'hover'
      screenX.value = event.pixel[0] ?? 0
      screenY.value = event.pixel[1] ?? 0
      applyHighlightFeature(feature)
    } else if (interactionMode.value === 'hover') {
      clearActiveMunicipality()
    }
  }

  function handleSingleClick(event: MapBrowserEvent<PointerEvent>): void {
    const map = event.map
    const feature = findMunicipalityAtPixel(map, event.pixel)

    if (feature) {
      interactionMode.value = 'touch'
      screenX.value = event.pixel[0] ?? 0
      screenY.value = event.pixel[1] ?? 0
      const clickedId = String(feature.get('municipalityId') ?? feature.getId() ?? '')
      if (activeMunicipalityId.value !== clickedId) {
        applyHighlightFeature(feature)
      } else {
        activeFeature.value = feature
      }
    } else {
      clearActiveMunicipality()
    }
  }

  function focusMunicipalityFeature(feature: Feature<Geometry> | null): void {
    const map = options.mapInstance.value
    if (!map || !feature) return

    const geometry = feature.getGeometry()
    if (!geometry) return

    const extent = geometry.getExtent()
    const center = getCenter(extent)

    interactionMode.value = 'keyboard'
    applyHighlightFeature(feature)

    const view = map.getView()
    view.animate(
      {
        center,
        zoom: Math.max(view.getZoom() ?? 7.5, 8.6),
        duration: 280,
      },
      () => {
        const pixel = map.getPixelFromCoordinate(center)
        if (pixel) {
          screenX.value = pixel[0] ?? window.innerWidth / 2
          screenY.value = pixel[1] ?? window.innerHeight / 2
        }
      },
    )

    const immediatePixel = map.getPixelFromCoordinate(center)
    if (immediatePixel) {
      screenX.value = immediatePixel[0] ?? window.innerWidth / 2
      screenY.value = immediatePixel[1] ?? window.innerHeight / 2
    }
  }

  function bindToMap(map: OlMap): void {
    if (detachListeners) {
      detachListeners()
      detachListeners = null
    }

    const onPointerMove = (evt: unknown) => {
      handlePointerMove(evt as MapBrowserEvent<PointerEvent>)
    }
    const onSingleClick = (evt: unknown) => {
      handleSingleClick(evt as MapBrowserEvent<PointerEvent>)
    }

    map.on('pointermove', onPointerMove)
    map.on('singleclick', onSingleClick)

    const viewport = map.getViewport()
    const onPointerLeave = () => {
      if (interactionMode.value === 'hover') {
        clearActiveMunicipality()
      }
      const targetEl = map.getTargetElement()
      if (targetEl) {
        targetEl.style.cursor = ''
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && activeMunicipalityId.value) {
        clearActiveMunicipality()
      }
    }

    if (viewport) {
      viewport.addEventListener('pointerleave', onPointerLeave)
    }
    window.addEventListener('keydown', onKeyDown)

    detachListeners = () => {
      map.un('pointermove', onPointerMove)
      map.un('singleclick', onSingleClick)
      if (viewport) {
        viewport.removeEventListener('pointerleave', onPointerLeave)
      }
      window.removeEventListener('keydown', onKeyDown)
    }
  }

  onBeforeUnmount(() => {
    if (detachListeners) {
      detachListeners()
      detachListeners = null
    }
  })

  return {
    activeMunicipalityInfo,
    activeMunicipalityId,
    interactionMode,
    bindToMap,
    clearActiveMunicipality,
    focusMunicipalityFeature,
  }
}
