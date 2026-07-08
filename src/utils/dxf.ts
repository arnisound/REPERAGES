/**
 * Export DXF (R12 ASCII) du plan du site.
 *
 * Le DWG est un format propriétaire fermé ; le DXF est le format d'échange
 * d'Autodesk : AutoCAD, QCAD, LibreCAD, DraftSight… l'ouvrent nativement et
 * l'enregistrent en DWG. Coordonnées en mètres, X = est, Y = nord, un calque
 * CAO par discipline.
 */
import {
  DISCIPLINES,
  DISCIPLINE_LABELS,
  type Discipline,
  type LatLng,
  type SiteLine,
  type SiteObject,
} from '../types'
import { findLineDef, objectView } from './catalog'
import { lineLengthMeters, polygonCenter, rectangleCorners, toLocalMeters } from './geo'

/** Index de couleur AutoCAD (ACI) par discipline. */
const DXF_COLORS: Record<Discipline, number> = {
  implantation: 7, // blanc/noir
  structures: 8, // gris
  electricite: 2, // jaune
  eau: 4, // cyan
  reseau: 5, // bleu
  video: 6, // magenta
  audio: 3, // vert
  lumiere: 30, // orange
  securite: 1, // rouge
}

const layerName = (d: Discipline) =>
  DISCIPLINE_LABELS[d]
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/g, '_')

function num(n: number) {
  return n.toFixed(3)
}

export function generateDxf(zone: LatLng[], objects: SiteObject[], lines: SiteLine[]): string {
  const ref = polygonCenter(zone)
  const local = (p: LatLng) => toLocalMeters(ref, p)
  const out: string[] = []
  const w = (...vals: (string | number)[]) => out.push(...vals.map(String))

  const line = (layer: string, color: number, a: { x: number; y: number }, b: { x: number; y: number }) => {
    w(0, 'LINE', 8, layer, 62, color, 10, num(a.x), 20, num(a.y), 30, 0, 11, num(b.x), 21, num(b.y), 31, 0)
  }
  const text = (layer: string, color: number, p: { x: number; y: number }, height: number, value: string) => {
    w(0, 'TEXT', 8, layer, 62, color, 10, num(p.x), 20, num(p.y), 30, 0, 40, num(height), 1, value)
  }
  const circle = (layer: string, color: number, p: { x: number; y: number }, r: number) => {
    w(0, 'CIRCLE', 8, layer, 62, color, 10, num(p.x), 20, num(p.y), 30, 0, 40, num(r))
  }

  // --- HEADER ---
  w(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$INSUNITS', 70, 6, 0, 'ENDSEC')

  // --- TABLES (calques) ---
  const layers: [string, number][] = [
    ['ZONE', 7],
    ...DISCIPLINES.map((d) => [layerName(d), DXF_COLORS[d]] as [string, number]),
  ]
  w(0, 'SECTION', 2, 'TABLES', 0, 'TABLE', 2, 'LAYER', 70, layers.length)
  for (const [name, color] of layers) {
    w(0, 'LAYER', 2, name, 70, 0, 62, color, 6, 'CONTINUOUS')
  }
  w(0, 'ENDTAB', 0, 'ENDSEC')

  // --- ENTITIES ---
  w(0, 'SECTION', 2, 'ENTITIES')

  // Zone du site (polygone fermé)
  const zonePts = zone.map(local)
  for (let i = 0; i < zonePts.length; i++) {
    line('ZONE', 7, zonePts[i], zonePts[(i + 1) % zonePts.length])
  }

  // Objets : contour réel + libellé ; pictogrammes en cercle
  for (const o of objects) {
    const layer = layerName(o.layer)
    const color = DXF_COLORS[o.layer]
    const view = objectView(o)
    const center = local(o.center)
    const label = `${view.label}${o.spec ? ` ${o.spec}` : ''}${o.label ? ` — ${o.label}` : ''}`
    if (view.isPoint) {
      circle(layer, color, center, 0.4)
      text(layer, color, { x: center.x + 0.5, y: center.y }, 0.3, label)
    } else {
      const corners = rectangleCorners(o.center, o.widthM, o.heightM, o.rotation).map(local)
      for (let i = 0; i < 4; i++) line(layer, color, corners[i], corners[(i + 1) % 4])
      text(layer, color, { x: center.x - o.widthM / 2, y: center.y }, Math.min(0.5, o.heightM / 3), label)
    }
  }

  // Lignes (câbles, barrières, murs…) + longueur
  for (const l of lines) {
    const layer = layerName(l.layer)
    const color = DXF_COLORS[l.layer]
    const def = findLineDef(l.layer, l.lineType)
    const pts = l.points.map(local)
    for (let i = 1; i < pts.length; i++) line(layer, color, pts[i - 1], pts[i])
    const mid = pts[Math.floor((pts.length - 1) / 2)]
    const length = lineLengthMeters(l.points)
    text(
      layer,
      color,
      { x: mid.x + 0.3, y: mid.y + 0.3 },
      0.4,
      `${def?.label ?? l.lineType}${l.spec ? ` ${l.spec}` : ''} ${length.toFixed(1)}m`,
    )
  }

  w(0, 'ENDSEC', 0, 'EOF')
  return out.join('\r\n')
}
