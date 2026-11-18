<script setup lang="ts">
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  RefreshCw,
  Search,
  X,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { BaseMapId, MunicipalitySummary } from '../../types/geography'
import type {
  DataAvailabilityState,
  MunicipalityWeather,
  WeatherDatasetMetadata,
  WeatherVariableKey,
} from '../../types/weather'
import { formatTimestampPtBr, normalizeSearchText } from '../../utils/geoUtils'
import { formatTemperatureValue } from '../../utils/temperatureColors'
import MapBaseSelector from '../map/MapBaseSelector.vue'
import WeatherVariableSelector from '../weather/WeatherVariableSelector.vue'

const props = defineProps<{
  selectedVariable: WeatherVariableKey
  activeBaseMap: BaseMapId
  availabilityState: DataAvailabilityState
  metadata: WeatherDatasetMetadata | null
  isLoadingWeather: boolean
  municipalities: readonly MunicipalitySummary[]
  getMunicipalityWeather: (id: string) => MunicipalityWeather | null
}>()

const emit = defineEmits<{
  'update:selectedVariable': [value: WeatherVariableKey]
  'update:activeBaseMap': [value: BaseMapId]
  selectMunicipality: [municipalityId: string]
  refreshWeather: []
}>()

const searchQuery = ref('')
const isSearchOpen = ref(false)
const highlightedIndex = ref(0)
const isInfoOpen = ref(false)
const headerRootRef = ref<HTMLElement | null>(null)
const faviconUrl = `${import.meta.env.BASE_URL}favicon.svg`

const filteredMunicipalities = computed<readonly MunicipalitySummary[]>(() => {
  const normalized = normalizeSearchText(searchQuery.value)
  if (!normalized) {
    return props.municipalities.slice(0, 8)
  }

  const startsWithMatches: MunicipalitySummary[] = []
  const containsMatches: MunicipalitySummary[] = []

  for (const item of props.municipalities) {
    const candidate = normalizeSearchText(item.municipalityName)
    if (candidate.startsWith(normalized)) {
      startsWithMatches.push(item)
    } else if (candidate.includes(normalized)) {
      containsMatches.push(item)
    }
    if (startsWithMatches.length >= 10) break
  }

  return [...startsWithMatches, ...containsMatches].slice(0, 10)
})

const statusBadge = computed(() => {
  switch (props.availabilityState) {
    case 'loading':
      return {
        label: 'Carregando...',
        classes: 'bg-slate-100 text-slate-700',
      }
    case 'ready':
      return {
        label: 'Atualizado',
        classes: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20',
      }
    case 'partial':
      return {
        label: 'Dados parciais',
        classes: 'bg-amber-50 text-amber-800 ring-1 ring-amber-600/25',
      }
    case 'stale':
      return {
        label: 'Desatualizado',
        classes: 'bg-amber-50 text-amber-800 ring-1 ring-amber-600/25',
      }
    case 'demo':
      return {
        label: 'Demonstração',
        classes: 'bg-purple-50 text-purple-800 ring-1 ring-purple-600/25',
      }
    case 'unavailable':
      return {
        label: 'Sem dados',
        classes: 'bg-rose-50 text-rose-800 ring-1 ring-rose-600/25',
      }
  }
})

function openSearch(): void {
  isSearchOpen.value = true
  highlightedIndex.value = 0
}

function chooseMunicipality(item: MunicipalitySummary): void {
  searchQuery.value = item.municipalityName
  isSearchOpen.value = false
  emit('selectMunicipality', item.municipalityId)
}

function clearSearch(): void {
  searchQuery.value = ''
  highlightedIndex.value = 0
}

function handleSearchKeydown(event: KeyboardEvent): void {
  const list = filteredMunicipalities.value
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    isSearchOpen.value = true
    if (list.length > 0) {
      highlightedIndex.value = (highlightedIndex.value + 1) % list.length
    }
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    isSearchOpen.value = true
    if (list.length > 0) {
      highlightedIndex.value = (highlightedIndex.value - 1 + list.length) % list.length
    }
  } else if (event.key === 'Enter') {
    const selected = list[highlightedIndex.value]
    if (isSearchOpen.value && selected) {
      event.preventDefault()
      chooseMunicipality(selected)
    }
  } else if (event.key === 'Escape') {
    isSearchOpen.value = false
  }
}

function getPreviewTemperature(municipalityId: string): string {
  const record = props.getMunicipalityWeather(municipalityId)
  const val = record ? record[props.selectedVariable] : null
  return formatTemperatureValue(val)
}

function handleOutsidePointerDown(event: PointerEvent): void {
  const root = headerRootRef.value
  if (root && event.target instanceof Node && !root.contains(event.target)) {
    isSearchOpen.value = false
    isInfoOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handleOutsidePointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleOutsidePointerDown)
})
</script>

<template>
  <header
    ref="headerRootRef"
    class="pointer-events-none fixed inset-x-0 top-0 z-20 p-2 sm:p-3.5"
  >
    <div class="mx-auto flex flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between lg:gap-2">
      <!-- Top Row on Mobile / Left Group on Desktop: Brand Identity + Municipality Search -->
      <div class="flex items-center justify-between gap-2 lg:justify-start">
        <!-- Brand Identity + Dataset Metadata Trigger -->
        <div class="pointer-events-auto relative flex items-center gap-2 rounded-xl bg-white/92 backdrop-blur-md px-2.5 py-1.5 shadow-sm ring-1 ring-slate-900/10 shrink-0">
          <img
            :src="faviconUrl"
            alt=""
            class="h-6 w-6 sm:h-7 sm:w-7 rounded-lg shrink-0"
            width="28"
            height="28"
          />
          <div class="leading-tight">
            <div class="flex items-center gap-1.5">
              <h1 class="text-sm font-extrabold tracking-tight text-slate-900">
                Pinhal
              </h1>
              <span
                class="hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                :class="statusBadge.classes"
              >
                <CheckCircle2
                  v-if="availabilityState === 'ready'"
                  class="h-3 w-3"
                  aria-hidden="true"
                />
                <Clock
                  v-else-if="availabilityState === 'stale' || availabilityState === 'loading'"
                  class="h-3 w-3"
                  aria-hidden="true"
                />
                <AlertTriangle v-else class="h-3 w-3" aria-hidden="true" />
                {{ statusBadge.label }}
              </span>
            </div>
            <p class="hidden sm:block text-[11px] font-medium text-slate-500">
              Meteorologia • Paraná (399 municípios)
            </p>
          </div>

          <button
            type="button"
            :aria-expanded="isInfoOpen"
            aria-label="Informações e metadados da coleta meteorológica"
            title="Fonte dos dados e horário da coleta"
            class="rounded-lg p-1 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-700"
            @click="isInfoOpen = !isInfoOpen"
          >
            <Info class="h-4 w-4" aria-hidden="true" />
          </button>

          <!-- Dataset Metadata Popover -->
          <div
            v-if="isInfoOpen"
            role="dialog"
            aria-label="Metadados meteorológicos"
            class="absolute left-0 top-full mt-2 w-72 sm:w-80 rounded-xl bg-white p-3.5 text-xs text-slate-700 shadow-xl ring-1 ring-slate-900/12 z-40"
          >
            <div class="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
              <span class="font-bold text-slate-900">Metadados Meteorológicos</span>
              <button
                type="button"
                aria-label="Atualizar dados meteorológicos"
                :disabled="isLoadingWeather"
                class="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-200 disabled:opacity-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-700"
                @click="emit('refreshWeather')"
              >
                <RefreshCw
                  class="h-3 w-3"
                  :class="{ 'animate-spin': isLoadingWeather }"
                  aria-hidden="true"
                />
                Atualizar
              </button>
            </div>

            <dl v-if="metadata" class="space-y-1.5 text-[11px]">
              <div class="flex justify-between gap-2">
                <dt class="text-slate-500">Fonte:</dt>
                <dd class="font-semibold text-slate-900 text-right">
                  <a
                    v-if="metadata.sourceUrl"
                    :href="metadata.sourceUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="underline decoration-slate-300 hover:text-teal-700"
                  >
                    {{ metadata.source }}
                  </a>
                  <span v-else>{{ metadata.source }}</span>
                </dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt class="text-slate-500">Referência:</dt>
                <dd class="font-medium text-slate-800 tabular-nums">
                  {{ formatTimestampPtBr(metadata.updatedAt) }}
                </dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt class="text-slate-500">Coleta:</dt>
                <dd class="font-medium text-slate-800 tabular-nums">
                  {{ formatTimestampPtBr(metadata.collectedAt) }}
                </dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt class="text-slate-500">Cobertura:</dt>
                <dd class="font-semibold text-slate-900 tabular-nums">
                  {{ metadata.availableMunicipalities }} / {{ metadata.totalMunicipalities }} municípios
                </dd>
              </div>
              <div class="pt-1.5 border-t border-slate-100 text-[10px] text-slate-500 leading-relaxed">
                Malha municipal: IBGE (API v3 Malhas). Inspirado funcionalmente no projeto
                <a
                  href="https://github.com/kauevestena/simepar_map"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="underline hover:text-slate-800"
                >Simepar Map</a>.
              </div>
            </dl>
            <p v-else class="text-slate-500">
              Metadados indisponíveis no momento.
            </p>
          </div>
        </div>

        <!-- Accessible Municipality Combobox -->
        <div class="pointer-events-auto relative min-w-0 flex-1 max-w-56 sm:max-w-60">
          <div class="flex items-center rounded-xl bg-white/92 backdrop-blur-md px-2.5 py-1.5 shadow-sm ring-1 ring-slate-900/10">
            <Search class="h-3.5 w-3.5 text-slate-500 shrink-0" aria-hidden="true" />
            <input
              v-model="searchQuery"
              type="text"
              role="combobox"
              aria-label="Buscar município do Paraná"
              aria-autocomplete="list"
              :aria-expanded="isSearchOpen"
              aria-controls="pinhal-municipality-listbox"
              placeholder="Buscar município..."
              class="w-full min-w-0 bg-transparent pl-2 pr-1 text-xs font-medium text-slate-900 placeholder:text-slate-500 focus:outline-none"
              @focus="openSearch"
              @input="openSearch"
              @keydown="handleSearchKeydown"
            />
            <button
              v-if="searchQuery"
              type="button"
              aria-label="Limpar busca de município"
              class="rounded p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
              @click="clearSearch"
            >
              <X class="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <ul
            v-if="isSearchOpen && filteredMunicipalities.length > 0"
            id="pinhal-municipality-listbox"
            role="listbox"
            aria-label="Municípios encontrados"
            class="absolute right-0 lg:left-0 lg:right-auto mt-1.5 max-h-64 w-64 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-xl bg-white py-1 shadow-xl ring-1 ring-slate-900/12 z-40"
          >
            <li
              v-for="(item, idx) in filteredMunicipalities"
              :key="item.municipalityId"
              role="option"
              :aria-selected="idx === highlightedIndex"
              class="flex items-center justify-between gap-2 px-3 py-2 text-xs cursor-pointer transition-colors"
              :class="
                idx === highlightedIndex
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-800'
              "
              @mouseenter="highlightedIndex = idx"
              @mousedown.prevent="chooseMunicipality(item)"
            >
              <span
                class="min-w-0 flex-1 truncate font-medium"
                :class="idx === highlightedIndex ? 'text-white' : 'text-slate-900'"
              >
                {{ item.municipalityName }}
              </span>
              <span
                class="shrink-0 font-bold tabular-nums text-[11px]"
                :class="idx === highlightedIndex ? 'text-teal-300' : 'text-slate-600'"
              >
                {{ getPreviewTemperature(item.municipalityId) }}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <!-- Second Row on Mobile / Right Group on Desktop: Variable Selector + Base Map Selector -->
      <div class="pointer-events-auto flex items-center justify-between gap-1.5 sm:justify-start lg:justify-end">
        <WeatherVariableSelector
          :model-value="selectedVariable"
          @update:model-value="emit('update:selectedVariable', $event)"
        />

        <MapBaseSelector
          :model-value="activeBaseMap"
          @update:model-value="emit('update:activeBaseMap', $event)"
        />
      </div>
    </div>
  </header>
</template>
