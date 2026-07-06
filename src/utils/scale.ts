import type { Calibration } from '../types'

export function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** Pixels per meter in the plan image's natural coordinate space. */
export function pxPerMeter(calibration: Calibration | null): number | null {
  if (!calibration) return null
  const pxDist = distance(calibration.p1, calibration.p2)
  if (pxDist === 0 || calibration.realDistanceMeters <= 0) return null
  return pxDist / calibration.realDistanceMeters
}

export function polylineLengthMeters(points: { x: number; y: number }[], scale: number | null): number | null {
  if (!scale || points.length < 2) return null
  let total = 0
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i])
  return total / scale
}

export function formatMeters(m: number | null): string {
  if (m === null) return '—'
  return `${m.toFixed(2)} m`
}
