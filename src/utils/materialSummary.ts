import {
  DISCIPLINES,
  DISCIPLINE_LABELS,
  type Discipline,
  type Plan,
  type PlanConnection,
  type PlanObject,
  type SiteLine,
  type SiteObject,
} from '../types'
import { findLineDef, findObjectDef, objectView } from './catalog'
import { formatMeters, lineLengthMeters } from './geo'
import { pxPerMeter, polylineLengthMeters } from './scale'
import { aggregateCuts } from './cutlist'

export interface ObjectGroup {
  label: string
  dims?: string
  count: number
}

export interface LineGroup {
  label: string
  unitLengthM?: number
  sectionable: boolean
  runs: number[]
  uncalibratedRuns: number
}

export interface MaterialSummary {
  objectGroups: Map<Discipline, Map<string, ObjectGroup>>
  lineGroups: Map<Discipline, Map<string, LineGroup>>
  powerByLayer: Map<Discipline, number>
  powerTotal: number
  progressByLayer: Map<Discipline, { done: number; total: number }>
  progressTotal: { done: number; total: number }
  hasAnything: boolean
}

const fmtDim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','))

export function computeMaterialSummary(data: {
  siteObjects: SiteObject[]
  siteLines: SiteLine[]
  planObjects: PlanObject[]
  planConnections: PlanConnection[]
  plans: Plan[]
}): MaterialSummary {
  const { siteObjects, siteLines, planObjects, planConnections, plans } = data
  const objectGroups = new Map<Discipline, Map<string, ObjectGroup>>()
  const lineGroups = new Map<Discipline, Map<string, LineGroup>>()

  const objGroup = (layer: Discipline, label: string, dims?: string) => {
    let byLabel = objectGroups.get(layer)
    if (!byLabel) objectGroups.set(layer, (byLabel = new Map()))
    const key = `${label}|${dims ?? ''}`
    let g = byLabel.get(key)
    if (!g) byLabel.set(key, (g = { label, dims, count: 0 }))
    return g
  }
  const lnGroup = (layer: Discipline, label: string, init: Omit<LineGroup, 'label' | 'runs' | 'uncalibratedRuns'>) => {
    let byLabel = lineGroups.get(layer)
    if (!byLabel) lineGroups.set(layer, (byLabel = new Map()))
    let g = byLabel.get(label)
    if (!g) byLabel.set(label, (g = { label, runs: [], uncalibratedRuns: 0, ...init }))
    return g
  }

  for (const o of siteObjects) {
    const view = objectView(o)
    const dims = view.isPoint ? undefined : `${fmtDim(o.widthM)} × ${fmtDim(o.heightM)} m`
    objGroup(o.layer, `${view.label}${o.spec ? ` ${o.spec}` : ''}`, dims).count++
  }
  for (const o of planObjects) {
    const def = findObjectDef(o.layer, o.symbolType)
    const dims =
      def?.point || (o.widthM === undefined && o.heightM === undefined)
        ? undefined
        : `${fmtDim(o.widthM ?? def?.w ?? 1)} × ${fmtDim(o.heightM ?? def?.h ?? 1)} m`
    objGroup(o.layer, `${def?.label ?? o.symbolType} (plan importé)`, dims).count++
  }

  for (const l of siteLines) {
    const def = findLineDef(l.layer, l.lineType)
    if (def?.noRecap) continue
    const g = lnGroup(l.layer, `${def?.label ?? l.lineType}${l.spec ? ` ${l.spec}` : ''}`, {
      unitLengthM: def?.unitLengthM,
      sectionable: def?.sectionable ?? false,
    })
    g.runs.push(lineLengthMeters(l.points))
  }

  const planScale = new Map(plans.map((p) => [p.id, pxPerMeter(p.calibration)]))
  for (const c of planConnections) {
    const label = `${c.cableType || 'Câble'} (plan importé)`
    const g = lnGroup(c.layer, label, { sectionable: true })
    const length = polylineLengthMeters(c.points, planScale.get(c.planId) ?? null)
    if (length === null) g.uncalibratedRuns++
    else g.runs.push(length)
  }

  const powerByLayer = new Map<Discipline, number>()
  let powerTotal = 0
  for (const o of siteObjects) {
    if (!o.powerKw) continue
    powerByLayer.set(o.layer, (powerByLayer.get(o.layer) ?? 0) + o.powerKw)
    powerTotal += o.powerKw
  }

  const progressByLayer = new Map<Discipline, { done: number; total: number }>()
  for (const item of [...siteObjects, ...siteLines]) {
    const def = 'lineType' in item ? findLineDef(item.layer, item.lineType) : undefined
    if (def?.noRecap) continue
    const p = progressByLayer.get(item.layer) ?? { done: 0, total: 0 }
    p.total++
    if (item.status === 'done' || item.status === 'checked') p.done++
    progressByLayer.set(item.layer, p)
  }
  const progressTotal = [...progressByLayer.values()].reduce(
    (acc, p) => ({ done: acc.done + p.done, total: acc.total + p.total }),
    { done: 0, total: 0 },
  )

  const hasAnything =
    [...objectGroups.values()].some((m) => m.size > 0) || [...lineGroups.values()].some((m) => m.size > 0)

  return { objectGroups, lineGroups, powerByLayer, powerTotal, progressByLayer, progressTotal, hasAnything }
}

/**
 * Suggestion de câbles de secours (spare) pour un type de câble : un
 * pourcentage du nombre de tronçons prévus, minimum 1 dès qu'il y a un
 * tirage, dans la longueur la plus utilisée.
 */
export function spareSuggestion(
  counts: Map<number, number>,
  sparePct: number,
): { size: number; count: number } | null {
  if (sparePct <= 0) return null
  let pieces = 0
  let bestSize = 0
  let bestN = 0
  for (const [size, n] of counts) {
    pieces += n
    if (n > bestN || (n === bestN && size > bestSize)) {
      bestSize = size
      bestN = n
    }
  }
  if (!pieces) return null
  return { size: bestSize, count: Math.max(1, Math.ceil((pieces * sparePct) / 100)) }
}

/** Lignes texte du récap matériel, incluant les découpes de tronçons. */
export function materialSummaryText(
  summary: MaterialSummary,
  projectName: string,
  sizes: number[],
  sparePct = 0,
): string[] {
  const out: string[] = [`RÉCAP MATÉRIEL — ${projectName}`, '']
  for (const d of DISCIPLINES) {
    const objs = [...(summary.objectGroups.get(d)?.values() ?? [])]
    const lns = [...(summary.lineGroups.get(d)?.values() ?? [])]
    if (!objs.length && !lns.length) continue
    out.push(DISCIPLINE_LABELS[d].toUpperCase())
    const layerPower = summary.powerByLayer.get(d)
    if (layerPower) out.push(`Puissance : ${layerPower.toFixed(1)} kW`)
    for (const g of objs) out.push(`- ${g.label}${g.dims ? ` (${g.dims})` : ''} × ${g.count}`)
    for (const g of lns) {
      const total = g.runs.reduce((s, r) => s + r, 0)
      let line = `- ${g.label} : ${g.runs.length} tirage(s), ${formatMeters(total)}`
      if (g.unitLengthM) {
        const elements = g.runs.reduce((s, r) => s + Math.ceil(r / g.unitLengthM!), 0)
        line += ` → ${elements} éléments de ${g.unitLengthM} m`
      }
      if (g.sectionable && sizes.length) {
        const cuts = aggregateCuts(g.runs, sizes)
        if (cuts) {
          const parts = [...cuts.counts.entries()].sort((a, b) => b[0] - a[0]).map(([size, n]) => `${n}× ${size} m`)
          line += ` → tronçons : ${parts.join(', ')} (fourni ${formatMeters(cuts.supplied)})`
          const spare = spareSuggestion(cuts.counts, sparePct)
          if (spare) line += ` → spare : +${spare.count}× ${spare.size} m`
        }
      }
      if (g.uncalibratedRuns) line += ` (+${g.uncalibratedRuns} tirage(s) sur plan non calibré)`
      out.push(line)
    }
    out.push('')
  }
  if (summary.powerTotal > 0) out.push(`PUISSANCE TOTALE : ${summary.powerTotal.toFixed(1)} kW`)
  if (summary.progressTotal.total > 0)
    out.push(`MONTAGE : ${summary.progressTotal.done}/${summary.progressTotal.total} installés`)
  return out
}
