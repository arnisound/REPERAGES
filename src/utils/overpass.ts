import type { LatLng } from '../types'

export interface MapFeature {
  kind: 'building' | 'road' | 'water' | 'other'
  points: LatLng[]
  closed: boolean
}

/** Boîte englobante (élargie) d'un polygone. */
export function bboxOf(poly: LatLng[], padM: number): { s: number; w: number; n: number; e: number } {
  const lats = poly.map((p) => p.lat)
  const lngs = poly.map((p) => p.lng)
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2
  const dLat = padM / 111320
  const dLng = padM / (111320 * Math.cos((midLat * Math.PI) / 180))
  return {
    s: Math.min(...lats) - dLat,
    w: Math.min(...lngs) - dLng,
    n: Math.max(...lats) + dLat,
    e: Math.max(...lngs) + dLng,
  }
}

/**
 * Récupère les contours cartographiques (bâtiments, routes, cours d'eau)
 * dans l'emprise de la zone via l'API Overpass (OpenStreetMap).
 * Nécessite une connexion ; renvoie [] en cas d'échec.
 */
export async function fetchMapFeatures(zone: LatLng[], padM = 60): Promise<MapFeature[]> {
  const b = bboxOf(zone, padM)
  const bbox = `${b.s},${b.w},${b.n},${b.e}`
  const query = `[out:json][timeout:25];(
    way["building"](${bbox});
    way["highway"](${bbox});
    way["waterway"](${bbox});
    way["natural"="water"](${bbox});
  );out geom;`
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ]
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(query) })
      if (!res.ok) continue
      const json = await res.json()
      const features: MapFeature[] = []
      for (const el of json.elements ?? []) {
        if (el.type !== 'way' || !Array.isArray(el.geometry)) continue
        const points: LatLng[] = el.geometry.map((g: { lat: number; lon: number }) => ({ lat: g.lat, lng: g.lon }))
        if (points.length < 2) continue
        const tags = el.tags ?? {}
        let kind: MapFeature['kind'] = 'other'
        if (tags.building) kind = 'building'
        else if (tags.highway) kind = 'road'
        else if (tags.waterway || tags.natural === 'water') kind = 'water'
        const first = points[0]
        const last = points[points.length - 1]
        const closed = kind === 'building' || (first.lat === last.lat && first.lng === last.lng)
        features.push({ kind, points, closed })
      }
      return features
    } catch {
      /* essai suivant */
    }
  }
  return []
}
