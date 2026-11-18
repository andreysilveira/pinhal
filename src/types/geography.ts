export type BaseMapId = 'light' | 'osm'

export interface BaseMapOption {
  readonly id: BaseMapId
  readonly label: string
  readonly shortLabel: string
  readonly description: string
  readonly attributions: string
}

export interface MunicipalityFeatureProperties {
  readonly municipalityId: string
  readonly municipalityName: string
  readonly regionName: string
  readonly centroidLon: number
  readonly centroidLat: number
  readonly areaKm2: number | null
}

export interface GeoJsonPolygonGeometry {
  readonly type: 'Polygon' | 'MultiPolygon'
  readonly coordinates: readonly unknown[]
}

export interface MunicipalityGeoJsonFeature {
  readonly type: 'Feature'
  readonly id?: string
  readonly properties: MunicipalityFeatureProperties
  readonly geometry: GeoJsonPolygonGeometry
}

export interface MunicipalityGeoJsonCollection {
  readonly type: 'FeatureCollection'
  readonly metadata?: {
    readonly state: string
    readonly uf: string
    readonly ibgeStateCode: string
    readonly municipalityCount: number
    readonly crs: string
    readonly source: string
    readonly sourceUrl: string
  }
  readonly features: readonly MunicipalityGeoJsonFeature[]
}

export interface MunicipalitySummary {
  readonly municipalityId: string
  readonly municipalityName: string
  readonly regionName: string
  readonly centroidLon: number
  readonly centroidLat: number
}
