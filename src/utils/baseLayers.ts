/** Fonds de carte disponibles (serveurs de tuiles gratuits, sans clé API). */
export interface BaseLayerDef {
  id: string
  label: string
  /** Gabarit slippy-map avec {s} {z} {x} {y}. */
  url: string
  attribution: string
  maxNativeZoom: number
}

export const BASE_LAYERS: BaseLayerDef[] = [
  {
    id: 'osm',
    label: 'Plan (OpenStreetMap)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxNativeZoom: 19,
  },
  {
    id: 'sat',
    label: 'Satellite (Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri — Source: Esri, Maxar, Earthstar Geographics',
    maxNativeZoom: 19,
  },
  {
    id: 'topo',
    label: 'Topographique (relief)',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap, SRTM — © OpenTopoMap (CC-BY-SA)',
    maxNativeZoom: 17,
  },
  {
    id: 'esritopo',
    label: 'Terrain (Esri Topo)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    maxNativeZoom: 19,
  },
  {
    id: 'light',
    label: 'Clair épuré (CARTO)',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxNativeZoom: 20,
  },
  {
    id: 'dark',
    label: 'Sombre (CARTO)',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxNativeZoom: 20,
  },
]

export function findBaseLayer(id: string): BaseLayerDef {
  return BASE_LAYERS.find((b) => b.id === id) ?? BASE_LAYERS[0]
}

/** URL concrète d'une tuile pour les rendus hors Leaflet (canvas du plan). */
export function tileUrl(def: BaseLayerDef, z: number, x: number, y: number): string {
  return def.url.replace('{s}', 'a').replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))
}
