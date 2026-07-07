import type { LatLng } from '../types'

const M_PER_DEG_LAT = 111320

/** Meters per degree of longitude at the given latitude. */
function mPerDegLng(lat: number) {
  return M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)
}

/** Project a GPS point to local meters relative to `ref` (equirectangular, fine at site scale). */
export function toLocalMeters(ref: LatLng, p: LatLng): { x: number; y: number } {
  return {
    x: (p.lng - ref.lng) * mPerDegLng(ref.lat),
    y: (p.lat - ref.lat) * M_PER_DEG_LAT,
  }
}

/** Inverse of toLocalMeters. */
export function fromLocalMeters(ref: LatLng, m: { x: number; y: number }): LatLng {
  return {
    lat: ref.lat + m.y / M_PER_DEG_LAT,
    lng: ref.lng + m.x / mPerDegLng(ref.lat),
  }
}

/** Geodesic length of a polyline, in meters. */
export function lineLengthMeters(points: LatLng[]): number {
  if (points.length < 2) return 0
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const a = toLocalMeters(points[0], points[i - 1])
    const b = toLocalMeters(points[0], points[i])
    total += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return total
}

/** Area of a GPS polygon in square meters (shoelace on the local projection). */
export function polygonAreaM2(points: LatLng[]): number {
  if (points.length < 3) return 0
  const ref = points[0]
  const local = points.map((p) => toLocalMeters(ref, p))
  let sum = 0
  for (let i = 0; i < local.length; i++) {
    const a = local[i]
    const b = local[(i + 1) % local.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

/** Centroid of a GPS polygon (average of vertices — good enough for centering the view). */
export function polygonCenter(points: LatLng[]): LatLng {
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length
  return { lat, lng }
}

/**
 * Corners of a rotated rectangle on the ground.
 * `rotation` in degrees clockwise from north; width runs east-west at 0°.
 */
export function rectangleCorners(center: LatLng, widthM: number, heightM: number, rotation: number): LatLng[] {
  const rad = (-rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const hw = widthM / 2
  const hh = heightM / 2
  const cornersLocal = [
    { x: -hw, y: hh },
    { x: hw, y: hh },
    { x: hw, y: -hh },
    { x: -hw, y: -hh },
  ]
  return cornersLocal.map((c) =>
    fromLocalMeters(center, { x: c.x * cos - c.y * sin, y: c.x * sin + c.y * cos }),
  )
}

export function formatMeters(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(1)} m`
}

export function formatArea(m2: number): string {
  if (m2 >= 10000) return `${(m2 / 10000).toFixed(2)} ha`
  return `${Math.round(m2).toLocaleString('fr-FR')} m²`
}
