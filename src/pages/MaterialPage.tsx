import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ClipboardCopy, ClipboardList } from 'lucide-react'
import { db } from '../db/db'
import {
  DISCIPLINES,
  DISCIPLINE_COLORS,
  DISCIPLINE_LABELS,
  type Discipline,
} from '../types'
import { findLineDef, findObjectDef, objectView } from '../utils/catalog'
import { formatMeters, lineLengthMeters } from '../utils/geo'
import { pxPerMeter, polylineLengthMeters } from '../utils/scale'
import { SECTION_SIZES, aggregateCuts } from '../utils/cutlist'
import TopBar from '../components/TopBar'

interface ObjectGroup {
  label: string
  /** Dimensions réelles (affichées pour tout ce qui a une emprise au sol). */
  dims?: string
  count: number
}

interface LineGroup {
  label: string
  unitLengthM?: number
  sectionable: boolean
  runs: number[]
  uncalibratedRuns: number
}

const DEFAULT_SIZES = [5, 10, 20]

export default function MaterialPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const project = useLiveQuery(() => (projectId ? db.projects.get(projectId) : undefined), [projectId])
  const siteObjects =
    useLiveQuery(() => (projectId ? db.siteObjects.where('projectId').equals(projectId).toArray() : []), [projectId]) ?? []
  const siteLines =
    useLiveQuery(() => (projectId ? db.siteLines.where('projectId').equals(projectId).toArray() : []), [projectId]) ?? []
  const plans =
    useLiveQuery(() => (projectId ? db.plans.where('projectId').equals(projectId).toArray() : []), [projectId]) ?? []
  const planObjects =
    useLiveQuery(async () => {
      if (!projectId) return []
      const planList = await db.plans.where('projectId').equals(projectId).toArray()
      const all = await Promise.all(planList.map((p) => db.planObjects.where('planId').equals(p.id).toArray()))
      return all.flat()
    }, [projectId]) ?? []
  const planConnections =
    useLiveQuery(async () => {
      if (!projectId) return []
      const planList = await db.plans.where('projectId').equals(projectId).toArray()
      const all = await Promise.all(planList.map((p) => db.planConnections.where('planId').equals(p.id).toArray()))
      return all.flat()
    }, [projectId]) ?? []

  const [sizes, setSizes] = useState<number[]>(DEFAULT_SIZES)

  useEffect(() => {
    if (!projectId) return
    const stored = localStorage.getItem(`cable-sizes:${projectId}`)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) setSizes(parsed.filter((n) => typeof n === 'number'))
      } catch {
        /* valeur corrompue : on garde le défaut */
      }
    }
  }, [projectId])

  function toggleSize(length: number) {
    setSizes((prev) => {
      const next = prev.includes(length) ? prev.filter((s) => s !== length) : [...prev, length].sort((a, b) => a - b)
      if (projectId) localStorage.setItem(`cable-sizes:${projectId}`, JSON.stringify(next))
      return next
    })
  }

  const { objectGroups, lineGroups } = useMemo(() => {
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

    const fmtDim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','))
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

    return { objectGroups, lineGroups }
  }, [siteObjects, planObjects, siteLines, planConnections, plans])

  const hasAnything =
    [...objectGroups.values()].some((m) => m.size > 0) || [...lineGroups.values()].some((m) => m.size > 0)

  // Bilan de puissance (kW) par calque et progression de montage
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

  function buildSummaryText(): string {
    const out: string[] = [`RÉCAP MATÉRIEL — ${project?.name ?? ''}`, '']
    for (const d of DISCIPLINES) {
      const objs = [...(objectGroups.get(d)?.values() ?? [])]
      const lns = [...(lineGroups.get(d)?.values() ?? [])]
      if (!objs.length && !lns.length) continue
      out.push(DISCIPLINE_LABELS[d].toUpperCase())
      const layerPower = powerByLayer.get(d)
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
            const parts = [...cuts.counts.entries()]
              .sort((a, b) => b[0] - a[0])
              .map(([size, n]) => `${n}× ${size} m`)
            line += ` → tronçons : ${parts.join(', ')} (fourni ${formatMeters(cuts.supplied)})`
          }
        }
        if (g.uncalibratedRuns) line += ` (+${g.uncalibratedRuns} tirage(s) sur plan non calibré)`
        out.push(line)
      }
      out.push('')
    }
    if (powerTotal > 0) out.push(`PUISSANCE TOTALE : ${powerTotal.toFixed(1)} kW`)
    if (progressTotal.total > 0) out.push(`MONTAGE : ${progressTotal.done}/${progressTotal.total} installés`)
    return out.join('\n')
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildSummaryText())
      alert('Récap copié dans le presse-papiers.')
    } catch {
      alert('Impossible de copier automatiquement — sélectionnez le texte manuellement.')
    }
  }

  return (
    <>
      <TopBar
        title="Matériel"
        action={
          hasAnything ? (
            <button className="icon-btn" onClick={handleCopy} aria-label="Copier le récap" type="button">
              <ClipboardCopy size={20} />
            </button>
          ) : undefined
        }
      />
      <div className="app-body">
        <div className="page">
          {!hasAnything && (
            <div className="empty-state">
              <ClipboardList size={36} style={{ marginBottom: 10, opacity: 0.6 }} />
              <p>Rien à compter pour l'instant.</p>
              <p>Placez des objets et tracez des câbles sur le plan du site : le décompte se fait tout seul.</p>
            </div>
          )}

          {hasAnything && (
            <div className="card" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, marginBottom: 10 }}>Tronçons de câble disponibles</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SECTION_SIZES.map((s) => (
                  <button
                    key={s.length}
                    type="button"
                    className={sizes.includes(s.length) ? 'btn' : 'btn secondary'}
                    style={{ minHeight: 38, padding: '8px 14px' }}
                    onClick={() => toggleSize(s.length)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 10 }}>
                Chaque tirage est couvert par des tronçons entiers parmi les longueurs cochées — le décompte indique
                combien de câbles de chaque taille prévoir.
              </p>
            </div>
          )}

          {hasAnything && (powerTotal > 0 || progressTotal.total > 0) && (
            <div className="card" style={{ marginBottom: 12, display: 'flex', gap: 12 }}>
              {powerTotal > 0 && (
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{powerTotal.toFixed(1)} kW</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Puissance totale</div>
                </div>
              )}
              {progressTotal.total > 0 && (
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>
                    {progressTotal.done}/{progressTotal.total}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Montage</div>
                </div>
              )}
            </div>
          )}

          {DISCIPLINES.map((d) => {
            const objs = [...(objectGroups.get(d)?.values() ?? [])]
            const lns = [...(lineGroups.get(d)?.values() ?? [])]
            if (!objs.length && !lns.length) return null
            const layerPower = powerByLayer.get(d)
            const progress = progressByLayer.get(d)
            return (
              <div className="card" key={d} style={{ marginBottom: 12 }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, marginBottom: 10 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: DISCIPLINE_COLORS[d] }} />
                  <span style={{ flex: 1 }}>{DISCIPLINE_LABELS[d]}</span>
                  {layerPower ? (
                    <span style={{ fontSize: 12, color: DISCIPLINE_COLORS.electricite }}>{layerPower.toFixed(1)} kW</span>
                  ) : null}
                  {progress && progress.total > 0 && (
                    <span
                      style={{
                        fontSize: 12,
                        color: progress.done === progress.total ? 'var(--success)' : 'var(--text-dim)',
                      }}
                    >
                      {progress.done}/{progress.total}
                    </span>
                  )}
                </h3>

                {objs.length > 0 && (
                  <div style={{ marginBottom: lns.length ? 14 : 0 }}>
                    {objs.map((g) => (
                      <div
                        key={`${g.label}|${g.dims ?? ''}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          gap: 12,
                          padding: '6px 0',
                          borderBottom: '1px solid var(--border)',
                          fontSize: 14,
                        }}
                      >
                        <span>
                          {g.label}
                          {g.dims && (
                            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}> · {g.dims}</span>
                          )}
                        </span>
                        <strong>× {g.count}</strong>
                      </div>
                    ))}
                  </div>
                )}

                {lns.map((g) => {
                  const total = g.runs.reduce((s, r) => s + r, 0)
                  const elements = g.unitLengthM
                    ? g.runs.reduce((s, r) => s + Math.ceil(r / g.unitLengthM!), 0)
                    : null
                  const cuts = g.sectionable && sizes.length ? aggregateCuts(g.runs, sizes) : null
                  return (
                    <div key={g.label} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <span>{g.label}</span>
                        <strong>
                          {g.runs.length} tirage(s) · {formatMeters(total)}
                        </strong>
                      </div>
                      {elements !== null && (
                        <div style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 4 }}>
                          → {elements} éléments de {g.unitLengthM} m
                        </div>
                      )}
                      {cuts && (
                        <div style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 4 }}>
                          → Tronçons :{' '}
                          {[...cuts.counts.entries()]
                            .sort((a, b) => b[0] - a[0])
                            .map(([size, n]) => `${n}× ${size} m`)
                            .join(', ')}{' '}
                          · fourni {formatMeters(cuts.supplied)} · chute {formatMeters(Math.max(0, cuts.supplied - total))}
                        </div>
                      )}
                      {g.uncalibratedRuns > 0 && (
                        <div style={{ color: '#facc15', fontSize: 13, marginTop: 4 }}>
                          +{g.uncalibratedRuns} tirage(s) sur plan non calibré (longueur inconnue)
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
