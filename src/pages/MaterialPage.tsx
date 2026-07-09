import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ClipboardCopy, ClipboardList } from 'lucide-react'
import { db } from '../db/db'
import { DISCIPLINES, DISCIPLINE_COLORS, DISCIPLINE_LABELS } from '../types'
import { formatMeters } from '../utils/geo'
import { SECTION_SIZES, aggregateCuts } from '../utils/cutlist'
import { computeMaterialSummary, materialSummaryText } from '../utils/materialSummary'
import TopBar from '../components/TopBar'

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

  const summary = useMemo(
    () => computeMaterialSummary({ siteObjects, siteLines, planObjects, planConnections, plans }),
    [siteObjects, planObjects, siteLines, planConnections, plans],
  )
  const { objectGroups, lineGroups, powerByLayer, powerTotal, progressByLayer, progressTotal, hasAnything } = summary

  function buildSummaryText(): string {
    return materialSummaryText(summary, project?.name ?? '', sizes).join('\n')
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
