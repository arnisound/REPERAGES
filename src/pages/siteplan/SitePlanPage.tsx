import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { saveAs } from 'file-saver'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Cable,
  Check,
  ClipboardCheck,
  Copy,
  Download,
  Globe,
  Grid3x3,
  Layers,
  Map as MapIcon,
  MousePointerClick,
  Package,
  Pentagon,
  Redo2,
  Ruler,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { db } from '../../db/db'
import {
  addSiteLine,
  addSiteObject,
  deleteSiteLine,
  deleteSiteObject,
  duplicateSiteLine,
  duplicateSiteObject,
  setProjectZone,
  updatePlan,
  updateSiteLine,
  updateSiteObject,
} from '../../db/actions'
import { getCurrentPosition } from '../../hooks/useGeolocation'
import { pxPerMeter } from '../../utils/scale'
import { canRedo, canUndo, redo, subscribeHistory, undo } from '../../utils/history'
import { BASE_LAYERS } from '../../utils/baseLayers'
import {
  DISCIPLINES,
  DISCIPLINE_COLORS,
  DISCIPLINE_LABELS,
  type Discipline,
  type LatLng,
} from '../../types'
import { LINE_CATALOG, type DistOption, type LineDef, type PlacePayload } from '../../utils/catalog'
import { formatArea, formatMeters, lineLengthMeters, offsetLatLng, polygonAreaM2, polygonCenter } from '../../utils/geo'
import { generateDxf } from '../../utils/dxf'
import { aggregateCuts } from '../../utils/cutlist'
import { computeMaterialSummary, spareSuggestion } from '../../utils/materialSummary'
import Modal from '../../components/Modal'
import TopBar from '../../components/TopBar'
import { LinePickerModal, ObjectPickerModal } from '../../components/CatalogPickers'
import { SiteLinePanel, SiteObjectPanel } from '../../components/SitePanels'
import PrintFrameOverlay from './PrintFrameOverlay'
import SitePlanCanvas, {
  gridStep,
  type CropRect,
  type OverlayItem,
  type SitePlanBase,
  type SitePlanCanvasHandle,
  type SitePlanMode,
  type SiteSelection,
} from './SitePlanCanvas'

export default function SitePlanPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const project = useLiveQuery(() => (projectId ? db.projects.get(projectId) : undefined), [projectId])
  const objects =
    useLiveQuery(() => (projectId ? db.siteObjects.where('projectId').equals(projectId).toArray() : []), [projectId]) ?? []
  const lines =
    useLiveQuery(() => (projectId ? db.siteLines.where('projectId').equals(projectId).toArray() : []), [projectId]) ?? []
  const points =
    useLiveQuery(() => (projectId ? db.points.where('projectId').equals(projectId).toArray() : []), [projectId]) ?? []
  const plans =
    useLiveQuery(() => (projectId ? db.plans.where('projectId').equals(projectId).toArray() : []), [projectId]) ?? []
  // Objets/câbles des plans importés — pour un récap matériel complet à l'export
  const planObjects =
    useLiveQuery(async () => {
      if (!projectId) return []
      const list = await db.plans.where('projectId').equals(projectId).toArray()
      return (await Promise.all(list.map((p) => db.planObjects.where('planId').equals(p.id).toArray()))).flat()
    }, [projectId]) ?? []
  const planConnections =
    useLiveQuery(async () => {
      if (!projectId) return []
      const list = await db.plans.where('projectId').equals(projectId).toArray()
      return (await Promise.all(list.map((p) => db.planConnections.where('planId').equals(p.id).toArray()))).flat()
    }, [projectId]) ?? []

  const [mode, setMode] = useState<SitePlanMode>('view')
  const [selection, setSelection] = useState<SiteSelection>(null)
  const [multiIds, setMultiIds] = useState<Set<string>>(new Set())
  const [placeTarget, setPlaceTarget] = useState<PlacePayload | null>(null)
  const [lineTarget, setLineTarget] = useState<{ layer: Discipline; def: LineDef; spec?: string } | null>(null)
  const [lineDraft, setLineDraft] = useState<LatLng[]>([])
  // Id d'objet aimanté pour chaque point du tracé (ancrage des extrémités)
  const [draftSnaps, setDraftSnaps] = useState<(string | null)[]>([])
  const [cotedLength, setCotedLength] = useState('')
  const [showObjectPicker, setShowObjectPicker] = useState(false)
  const [showLinePicker, setShowLinePicker] = useState(false)
  const [showLayerSheet, setShowLayerSheet] = useState(false)
  const [visibleLayers, setVisibleLayers] = useState<Set<Discipline>>(new Set(DISCIPLINES))
  const [showPoints, setShowPoints] = useState(true)
  const [baseLayer, setBaseLayer] = useState<SitePlanBase>('osm')
  const [showBasePicker, setShowBasePicker] = useState(false)
  const [viewScale, setViewScale] = useState(10)
  const [overlayEditId, setOverlayEditId] = useState<string | null>(null)
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map())
  const exportHandle = useRef<SitePlanCanvasHandle | null>(null)
  const [showExport, setShowExport] = useState(false)
  // Zone d'impression : cadre en pixels-écran, ratio A4 paysage par défaut
  const [printFrame, setPrintFrame] = useState<CropRect | null>(null)
  const [busy, setBusy] = useState('')

  // Historique annuler/rétablir (les hooks Dexie enregistrent, on affiche l'état)
  const historyTick = useSyncExternalStore(subscribeHistory, () => `${canUndo()}:${canRedo()}`)
  const undoEnabled = historyTick.startsWith('true')
  const redoEnabled = historyTick.endsWith('true')
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Object URLs des images de plans superposés (créées/révoquées avec la visibilité)
  const visibleOverlayPlans = plans.filter((p) => p.overlay?.visible || p.id === overlayEditId)
  const overlayPhotoKey = visibleOverlayPlans.map((p) => p.photoId).sort().join(',')
  useEffect(() => {
    let cancelled = false
    const urls = new Map<string, string>()
    ;(async () => {
      for (const photoId of overlayPhotoKey.split(',').filter(Boolean)) {
        const photo = await db.photos.get(photoId)
        if (photo) urls.set(photoId, URL.createObjectURL(photo.blob))
      }
      if (!cancelled) setPhotoUrls(urls)
      else urls.forEach((u) => URL.revokeObjectURL(u))
    })()
    return () => {
      cancelled = true
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [overlayPhotoKey])

  if (!projectId || project === undefined) return null

  const zone = project?.zone
  const selectedObject = selection?.kind === 'object' ? objects.find((o) => o.id === selection.id) ?? null : null
  const selectedLine = selection?.kind === 'line' ? lines.find((l) => l.id === selection.id) ?? null : null
  const draftLength = lineDraft.length >= 2 ? lineLengthMeters(lineDraft) : null
  const overlayPlan = overlayEditId ? plans.find((p) => p.id === overlayEditId) ?? null : null

  const overlayItems: OverlayItem[] = visibleOverlayPlans.flatMap((p) => {
    const url = photoUrls.get(p.photoId)
    const ov = p.overlay
    if (!url || !ov) return []
    return [
      {
        id: p.id,
        url,
        center: ov.center,
        rotation: ov.rotation,
        widthM: ov.widthM,
        heightM: ov.widthM * (p.imageHeight / p.imageWidth),
        opacity: ov.opacity,
        editing: p.id === overlayEditId,
      },
    ]
  })

  async function toggleOverlay(planId: string) {
    const plan = plans.find((p) => p.id === planId)
    if (!plan || !zone) return
    if (plan.overlay) {
      await updatePlan(plan.id, { overlay: { ...plan.overlay, visible: !plan.overlay.visible } })
    } else {
      // Largeur initiale exacte si le plan est calibré, sinon 30 m à ajuster.
      const scale = pxPerMeter(plan.calibration)
      await updatePlan(plan.id, {
        overlay: {
          visible: true,
          center: polygonCenter(zone),
          rotation: 0,
          widthM: scale ? plan.imageWidth / scale : 30,
          opacity: 0.7,
        },
      })
    }
  }

  async function createIndoorPlan() {
    if (!projectId) return
    // Lieu intérieur : le GPS situe grossièrement le bâtiment, la précision
    // vient ensuite des murs saisis aux cotes. Zone de travail 40×40 m.
    let center = { lat: 46.6034, lng: 1.8883 }
    try {
      const pos = await getCurrentPosition()
      center = { lat: pos.lat, lng: pos.lng }
    } catch {
      /* pas de GPS : zone posée sur la position par défaut, déplaçable ensuite */
    }
    await setProjectZone(projectId, [
      offsetLatLng(center, -20, 20),
      offsetLatLng(center, 20, 20),
      offsetLatLng(center, 20, -20),
      offsetLatLng(center, -20, -20),
    ])
  }

  if (!zone || zone.length < 3) {
    return (
      <div className="app-shell">
        <div className="app-main">
          <TopBar title="Plan du site" onBack={() => navigate(`/projects/${projectId}/plans`)} />
          <div className="app-body">
            <div className="page">
              <div className="empty-state">
                <Pentagon size={36} style={{ marginBottom: 10, opacity: 0.6 }} />
                <p>Aucune zone délimitée pour cet événement.</p>
                <p style={{ marginBottom: 20 }}>
                  En extérieur, délimitez la zone du site sur la carte : elle devient le plan de travail à l'échelle.
                  Pour un lieu intérieur, créez directement un plan et dessinez les murs aux cotes (ligne « Mur /
                  cloison », saisie des longueurs).
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 340, margin: '0 auto' }}>
                  <button className="btn" onClick={() => navigate(`/projects/${projectId}/map`)} type="button">
                    Ouvrir la carte (extérieur)
                  </button>
                  <button className="btn secondary" onClick={createIndoorPlan} type="button">
                    Créer un plan intérieur (croquis coté)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function resetTools() {
    setMode('view')
    setPlaceTarget(null)
    setLineTarget(null)
    setLineDraft([])
    setDraftSnaps([])
    setMultiIds(new Set())
  }

  /**
   * Aimantation du tracé de câble : si le point tapé est à moins de ~24 px
   * écran du centre d'un objet visible, il s'y accroche (et l'extrémité sera
   * ancrée : elle suivra l'objet déplacé).
   */
  function snapToObject(gps: LatLng): { gps: LatLng; objectId: string | null } {
    const thresholdM = 24 / viewScale
    let best: { id: string; center: LatLng; d: number } | null = null
    for (const o of objects) {
      if (!visibleLayers.has(o.layer)) continue
      const d = lineLengthMeters([o.center, gps])
      if (d <= thresholdM && (!best || d < best.d)) best = { id: o.id, center: o.center, d }
    }
    return best ? { gps: best.center, objectId: best.id } : { gps, objectId: null }
  }

  /** Départ de câble depuis un objet (assistant de distribution du panneau). */
  function startCableFrom(objectId: string, center: LatLng, opt: DistOption) {
    const def = LINE_CATALOG[opt.layer].find((l) => l.type === opt.lineType)
    if (!def) return
    setSelection(null)
    setLineTarget({ layer: opt.layer, def, spec: opt.spec })
    setLineDraft([center])
    setDraftSnaps([objectId])
    setMode('line')
  }

  function toggleMulti(id: string) {
    if (mode === 'check') {
      // Mode montage : chaque tap fait avancer le statut.
      const obj = objects.find((o) => o.id === id)
      const line = obj ? undefined : lines.find((l) => l.id === id)
      const current = (obj ?? line)?.status ?? 'todo'
      const next = current === 'todo' ? 'done' : current === 'done' ? 'checked' : 'todo'
      if (obj) updateSiteObject(id, { status: next })
      else if (line) updateSiteLine(id, { status: next })
      return
    }
    setMultiIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleGroupMove(eastM: number, northM: number) {
    // Objets d'abord : leurs câbles ancrés suivent via updateSiteObject.
    for (const obj of objects) {
      if (multiIds.has(obj.id)) {
        await updateSiteObject(obj.id, { center: offsetLatLng(obj.center, eastM, northM) })
      }
    }
    for (const line of lines) {
      if (!multiIds.has(line.id)) continue
      const points = line.points.map((p) => offsetLatLng(p, eastM, northM))
      // Extrémité ancrée à un objet resté en place : elle y reste aimantée.
      const pin = (anchorId: string | undefined, index: number) => {
        if (!anchorId || multiIds.has(anchorId)) return
        const target = objects.find((o) => o.id === anchorId)
        if (target) points[index] = target.center
      }
      pin(line.anchors?.start, 0)
      pin(line.anchors?.end, points.length - 1)
      await updateSiteLine(line.id, { points })
    }
  }

  async function handleDuplicateMulti() {
    const newIds = new Set<string>()
    for (const id of multiIds) {
      if (objects.some((o) => o.id === id)) {
        const copy = await duplicateSiteObject(id)
        if (copy) newIds.add(copy.id)
      } else if (lines.some((l) => l.id === id)) {
        const copy = await duplicateSiteLine(id)
        if (copy) newIds.add(copy.id)
      }
    }
    // Work continues on the copies: drag them to their spot right away.
    setMultiIds(newIds)
  }

  async function handleDeleteMulti() {
    if (!confirm(`Supprimer ${multiIds.size} élément(s) ?`)) return
    for (const id of multiIds) {
      if (objects.some((o) => o.id === id)) await deleteSiteObject(id)
      else if (lines.some((l) => l.id === id)) await deleteSiteLine(id)
    }
    setMultiIds(new Set())
  }

  async function handleTap(gps: LatLng) {
    if (!projectId) return
    if (mode === 'place' && placeTarget) {
      const p = placeTarget
      await addSiteObject({
        projectId,
        layer: p.layer,
        symbolType: p.symbolType,
        center: gps,
        widthM: p.w,
        heightM: p.h,
        spec: p.spec,
        // Les modèles perso figent leur apparence sur l'objet (indépendants du catalogue).
        color: p.custom ? p.color : undefined,
        glyph: p.custom ? p.glyph : undefined,
        typeLabel: p.custom ? p.typeLabel : undefined,
        isPoint: p.custom ? p.point : undefined,
      })
      return
    }
    if (mode === 'line') {
      // Les câbles/tuyaux s'aimantent aux objets ; pas les barrières ni les cotes.
      const snap = lineTarget?.def.sectionable ? snapToObject(gps) : { gps, objectId: null }
      setLineDraft((d) => [...d, snap.gps])
      setDraftSnaps((s) => [...s, snap.objectId])
    }
  }

  function dataUrlToBlob(dataUrl: string): Blob {
    const [head, body] = dataUrl.split(',')
    const mime = head.match(/data:(.*?);/)?.[1] ?? 'image/png'
    const bin = atob(body)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new Blob([bytes], { type: mime })
  }

  const slug = () => (project?.name ?? 'plan').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const captureCrop = () => printFrame ?? undefined
  const cableSizes = (() => {
    if (!projectId) return [5, 10, 20]
    try {
      const s = localStorage.getItem(`cable-sizes:${projectId}`)
      const p = s ? JSON.parse(s) : null
      return Array.isArray(p) && p.length ? (p as number[]) : [5, 10, 20]
    } catch {
      return [5, 10, 20]
    }
  })()
  const sparePct = projectId ? parseInt(localStorage.getItem(`spare-pct:${projectId}`) ?? '0', 10) || 0 : 0

  function exportPng() {
    const dataUrl = exportHandle.current?.exportImage({ crop: captureCrop() })
    if (!dataUrl) return
    saveAs(dataUrlToBlob(dataUrl), `plan-${slug()}.png`)
    setShowExport(false)
    setPrintFrame(null)
  }

  async function exportPdf() {
    const dataUrl = exportHandle.current?.exportImage({ crop: captureCrop() })
    if (!dataUrl || !zone) return
    setBusy('Génération du PDF…')
    try {
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageW = 297
      const pageH = 210
      const margin = 12
      const rgb = (hex: string): [number, number, number] => [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
      ]

      // ---------- PAGE 1 : plan ----------
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(17)
      pdf.setTextColor(20)
      pdf.text(project?.name ?? 'Plan du site', margin, margin + 4)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(90)
      const infoBits = [
        project?.client && `Client : ${project.client}`,
        project?.venueName,
        project?.address,
        project?.eventDate && `Date : ${project.eventDate}`,
        `Zone : ${formatArea(polygonAreaM2(zone))}`,
        `Grille : ${gridStep(viewScale)} m`,
        'Nord en haut',
      ].filter(Boolean) as string[]
      pdf.text(infoBits.join('  ·  '), margin, margin + 10)

      const img = new Image()
      img.src = dataUrl
      await new Promise((resolve) => {
        img.onload = resolve
      })
      const availW = pageW - 2 * margin
      const availH = pageH - margin - 32
      const ratio = Math.min(availW / img.width, availH / img.height)
      const imgW = img.width * ratio
      const imgH = img.height * ratio
      pdf.addImage(dataUrl, 'PNG', margin + (availW - imgW) / 2, margin + 14, imgW, imgH)

      // Légende des calques visibles
      pdf.setFontSize(8)
      let lx = margin
      const legendY = pageH - margin
      for (const d of DISCIPLINES.filter((d) => visibleLayers.has(d))) {
        pdf.setFillColor(...rgb(DISCIPLINE_COLORS[d]))
        pdf.circle(lx + 1.2, legendY - 1, 1.2, 'F')
        pdf.setTextColor(60)
        pdf.text(DISCIPLINE_LABELS[d], lx + 3.4, legendY)
        lx += pdf.getTextWidth(DISCIPLINE_LABELS[d]) + 10
      }

      // ---------- PAGES SUIVANTES : récap matériel ----------
      const summary = computeMaterialSummary({
        siteObjects: objects,
        siteLines: lines,
        planObjects,
        planConnections,
        plans,
      })
      if (summary.hasAnything) {
        pdf.addPage()
        let y = margin + 4
        const lineH = 5
        const ensure = (needed = lineH) => {
          if (y + needed > pageH - margin) {
            pdf.addPage()
            y = margin + 4
          }
        }
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(15)
        pdf.setTextColor(20)
        pdf.text('Récapitulatif matériel', margin, y)
        y += 8
        pdf.setFontSize(9)
        pdf.setTextColor(60)
        const totals: string[] = []
        if (summary.powerTotal > 0) totals.push(`Puissance totale : ${summary.powerTotal.toFixed(1)} kW`)
        if (summary.progressTotal.total > 0)
          totals.push(`Montage : ${summary.progressTotal.done}/${summary.progressTotal.total} installés`)
        if (sparePct > 0) totals.push(`Spare câbles : +${sparePct} %`)
        if (totals.length) {
          pdf.text(totals.join('   ·   '), margin, y)
          y += 7
        }

        for (const d of DISCIPLINES) {
          const objs = [...(summary.objectGroups.get(d)?.values() ?? [])]
          const lns = [...(summary.lineGroups.get(d)?.values() ?? [])]
          if (!objs.length && !lns.length) continue
          ensure(10)
          // Titre de calque
          pdf.setFillColor(...rgb(DISCIPLINE_COLORS[d]))
          pdf.circle(margin + 1.6, y - 1.4, 1.6, 'F')
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(11)
          pdf.setTextColor(20)
          const power = summary.powerByLayer.get(d)
          const prog = summary.progressByLayer.get(d)
          const suffix = [power ? `${power.toFixed(1)} kW` : '', prog ? `${prog.done}/${prog.total} posés` : '']
            .filter(Boolean)
            .join(' · ')
          pdf.text(`${DISCIPLINE_LABELS[d]}${suffix ? `   (${suffix})` : ''}`, margin + 4, y)
          y += 6
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(9)
          pdf.setTextColor(40)

          for (const g of objs) {
            ensure()
            pdf.text(`•  ${g.label}${g.dims ? ` — ${g.dims}` : ''}`, margin + 6, y)
            pdf.text(`× ${g.count}`, pageW - margin, y, { align: 'right' })
            y += lineH
          }
          for (const g of lns) {
            ensure()
            const total = g.runs.reduce((s, r) => s + r, 0)
            pdf.text(`•  ${g.label}`, margin + 6, y)
            pdf.text(`${g.runs.length} tirage(s) · ${formatMeters(total)}`, pageW - margin, y, { align: 'right' })
            y += lineH
            pdf.setTextColor(110)
            if (g.unitLengthM) {
              const el = g.runs.reduce((s, r) => s + Math.ceil(r / g.unitLengthM!), 0)
              ensure()
              pdf.text(`    → ${el} éléments de ${g.unitLengthM} m`, margin + 6, y)
              y += lineH
            }
            if (g.sectionable && cableSizes.length) {
              const cuts = aggregateCuts(g.runs, cableSizes)
              if (cuts) {
                const parts = [...cuts.counts.entries()]
                  .sort((a, b) => b[0] - a[0])
                  .map(([size, n]) => `${n}× ${size} m`)
                ensure()
                pdf.text(
                  `    → tronçons : ${parts.join(', ')} (fourni ${formatMeters(cuts.supplied)}, chute ${formatMeters(
                    Math.max(0, cuts.supplied - total),
                  )})`,
                  margin + 6,
                  y,
                )
                y += lineH
                const spare = spareSuggestion(cuts.counts, sparePct)
                if (spare) {
                  ensure()
                  pdf.text(`    → spare conseillé : +${spare.count}× ${spare.size} m`, margin + 6, y)
                  y += lineH
                }
              }
            }
            if (g.uncalibratedRuns) {
              ensure()
              pdf.text(`    → +${g.uncalibratedRuns} tirage(s) sur plan non calibré`, margin + 6, y)
              y += lineH
            }
            pdf.setTextColor(40)
          }
          y += 3
        }
      }

      // Pied de page : numéros
      const pageCount = pdf.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i)
        pdf.setFontSize(7)
        pdf.setTextColor(150)
        pdf.text(`${project?.name ?? ''} — Repérages · page ${i}/${pageCount}`, pageW / 2, pageH - 4, {
          align: 'center',
        })
      }
      pdf.save(`plan-${slug()}.pdf`)
      setShowExport(false)
      setPrintFrame(null)
    } finally {
      setBusy('')
    }
  }

  async function exportDxf(withMap: boolean) {
    if (!zone) return
    setBusy(withMap ? 'Récupération de la cartographie…' : 'Génération du DXF…')
    try {
      const dxf = await generateDxf(zone, objects, lines, { withMap })
      saveAs(new Blob([dxf], { type: 'application/dxf' }), `plan-${slug()}.dxf`)
    } finally {
      setBusy('')
      setShowExport(false)
    }
  }

  function exportPrint() {
    const dataUrl = exportHandle.current?.exportImage({ crop: captureCrop() })
    if (!dataUrl || !zone) return
    const legend = DISCIPLINES.filter((d) => visibleLayers.has(d))
      .map(
        (d) =>
          `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:14px">
            <span style="width:11px;height:11px;border-radius:50%;background:${DISCIPLINE_COLORS[d]};display:inline-block"></span>${DISCIPLINE_LABELS[d]}
          </span>`,
      )
      .join('')
    const win = window.open('', '_blank')
    if (!win) {
      alert("Impossible d'ouvrir la vue d'impression (bloqueur de popups ?)")
      return
    }
    win.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
      <title>Plan — ${project?.name ?? ''}</title>
      <style>
        body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; margin: 24px; color: #111; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        .meta { color: #555; font-size: 13px; margin-bottom: 12px; }
        img { width: 100%; border: 1px solid #ccc; border-radius: 6px; }
        .legend { margin-top: 10px; font-size: 13px; }
        @media print { .noprint { display: none; } }
      </style></head><body>
      <h1>${project?.name ?? 'Plan du site'}</h1>
      <div class="meta">
        ${project?.venueName ? project.venueName + ' · ' : ''}${project?.eventDate ?? ''}
        · Zone : ${formatArea(polygonAreaM2(zone))} · Grille : ${gridStep(viewScale)} m · Nord en haut
      </div>
      <img src="${dataUrl}" alt="Plan du site" />
      <div class="legend">${legend}</div>
      <p class="noprint" style="margin-top:16px"><button onclick="window.print()" style="padding:10px 18px;font-size:15px">Imprimer / Enregistrer en PDF</button></p>
    </body></html>`)
    win.document.close()
    setShowExport(false)
  }

  async function finishLine() {
    if (!projectId || !lineTarget || lineDraft.length < 2) return
    const start = draftSnaps[0] ?? undefined
    const end = draftSnaps[lineDraft.length - 1] ?? undefined
    await addSiteLine({
      projectId,
      layer: lineTarget.layer,
      lineType: lineTarget.def.type,
      points: lineDraft,
      spec: lineTarget.spec,
      anchors: start || end ? { start, end } : undefined,
    })
    resetTools()
  }

  return (
    <div className="app-shell">
      <div className="app-main">
        <TopBar
          title="Plan du site"
          onBack={() => navigate(`/projects/${projectId}/plans`)}
          action={
            <>
              <button className="icon-btn" onClick={() => setShowExport(true)} aria-label="Exporter" type="button">
                <Download size={20} />
              </button>
              <button className="icon-btn" onClick={() => setShowLayerSheet(true)} aria-label="Calques" type="button">
                <Layers size={20} />
              </button>
            </>
          }
        />
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <SitePlanCanvas
            zone={zone}
            objects={objects}
            lines={lines}
            points={points}
            visibleLayers={visibleLayers}
            showPoints={showPoints}
            mode={mode}
            baseLayer={baseLayer}
            selection={selection}
            multiIds={multiIds}
            lineDraft={lineDraft}
            draftSnaps={draftSnaps}
            overlays={overlayItems}
            onTap={handleTap}
            onSelect={setSelection}
            onToggleMulti={toggleMulti}
            onOverlayMove={(id, gps) => {
              const p = plans.find((pl) => pl.id === id)
              if (p?.overlay) updatePlan(id, { overlay: { ...p.overlay, center: gps } })
            }}
            onObjectMove={(id, gps) => updateSiteObject(id, { center: gps })}
            onObjectRotate={(id, rotation) => updateSiteObject(id, { rotation })}
            onGroupMove={handleGroupMove}
            onDraftPointMove={(i, gps) => {
              // Ré-évalue l'aimantation quand on repositionne un point du tracé
              const snap = lineTarget?.def.sectionable ? snapToObject(gps) : { gps, objectId: null }
              setLineDraft((d) => d.map((p, j) => (j === i ? snap.gps : p)))
              setDraftSnaps((s) => s.map((v, j) => (j === i ? snap.objectId : v)))
            }}
            onViewScaleChange={setViewScale}
            exportRef={exportHandle}
          />

          <div className="map-chip">
            Zone : {formatArea(polygonAreaM2(zone))} · Grille {gridStep(viewScale)} m · Nord ↑
          </div>

          {/* Cadre de zone d'impression (déplaçable + redimensionnable) */}
          {printFrame && (
            <PrintFrameOverlay frame={printFrame} onChange={setPrintFrame} onExport={() => setShowExport(true)} />
          )}

          {/* Background toggle: plan → satellite → aucun */}
          <div className="map-fab-col">
            <button
              className="icon-btn"
              onClick={() => undo()}
              disabled={!undoEnabled}
              style={{ opacity: undoEnabled ? 1 : 0.35 }}
              type="button"
              aria-label="Annuler"
            >
              <Undo2 size={20} />
            </button>
            <button
              className="icon-btn"
              onClick={() => redo()}
              disabled={!redoEnabled}
              style={{ opacity: redoEnabled ? 1 : 0.35 }}
              type="button"
              aria-label="Rétablir"
            >
              <Redo2 size={20} />
            </button>
            <button
              className={`icon-btn ${baseLayer !== 'none' ? 'active' : ''}`}
              onClick={() => setShowBasePicker(true)}
              type="button"
              aria-label="Fond de carte"
            >
              {baseLayer === 'none' ? <Grid3x3 size={20} /> : baseLayer === 'sat' ? <Globe size={20} /> : <MapIcon size={20} />}
            </button>
          </div>

          {/* Réglage d'un plan superposé */}
          {overlayPlan?.overlay && (
            <div className="map-panel">
              <div className="map-panel-row">
                <span className="map-panel-title">Superposition : {overlayPlan.name} — glissez le plan pour le placer</span>
              </div>
              <div className="map-panel-row">
                <label style={{ fontSize: 13, color: 'var(--text-dim)' }}>Rotation</label>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={overlayPlan.overlay.rotation}
                  onChange={(e) =>
                    updatePlan(overlayPlan.id, {
                      overlay: { ...overlayPlan.overlay!, rotation: parseInt(e.target.value, 10) },
                    })
                  }
                />
                <span style={{ fontSize: 13, width: 44, textAlign: 'right' }}>{overlayPlan.overlay.rotation}°</span>
              </div>
              <div className="map-panel-row">
                <label style={{ fontSize: 13, color: 'var(--text-dim)' }}>Largeur (m)</label>
                <input
                  type="number"
                  step={0.5}
                  min={1}
                  value={overlayPlan.overlay.widthM}
                  onChange={(e) =>
                    updatePlan(overlayPlan.id, {
                      overlay: { ...overlayPlan.overlay!, widthM: parseFloat(e.target.value) || 1 },
                    })
                  }
                  style={{ width: 90 }}
                />
                <label style={{ fontSize: 13, color: 'var(--text-dim)' }}>Opacité</label>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={overlayPlan.overlay.opacity}
                  onChange={(e) =>
                    updatePlan(overlayPlan.id, {
                      overlay: { ...overlayPlan.overlay!, opacity: parseFloat(e.target.value) },
                    })
                  }
                />
              </div>
              <div className="map-panel-row">
                <button className="btn block" onClick={() => setOverlayEditId(null)} type="button">
                  <Check size={18} /> Terminer le réglage
                </button>
              </div>
            </div>
          )}

          {mode === 'view' && !selection && !overlayPlan && (
            <div className="map-toolbar">
              <button
                className="btn secondary"
                onClick={() => {
                  setSelection(null)
                  setShowObjectPicker(true)
                }}
                type="button"
              >
                <Package size={18} /> Objet
              </button>
              <button
                className="btn secondary"
                onClick={() => {
                  setSelection(null)
                  setShowLinePicker(true)
                }}
                type="button"
              >
                <Cable size={18} /> Ligne
              </button>
              <button
                className="btn secondary"
                onClick={() => {
                  setSelection(null)
                  setMultiIds(new Set())
                  setMode('multi')
                }}
                type="button"
              >
                <MousePointerClick size={18} /> Sélection
              </button>
              <button
                className="btn secondary"
                onClick={() => {
                  const def = LINE_CATALOG.implantation.find((l) => l.type === 'cote')
                  if (!def) return
                  setLineTarget({ layer: 'implantation', def })
                  setLineDraft([])
                  setSelection(null)
                  setMode('line')
                }}
                type="button"
              >
                <Ruler size={18} /> Mesurer
              </button>
              <button
                className="btn secondary"
                onClick={() => {
                  setSelection(null)
                  setMode('check')
                }}
                type="button"
              >
                <ClipboardCheck size={18} /> Montage
              </button>
            </div>
          )}

          {mode === 'check' && (
            <div className="map-panel">
              <div className="map-panel-row">
                <span className="map-panel-title">
                  Montage : {[...objects, ...lines].filter((i) => i.status === 'done' || i.status === 'checked').length}
                  {' / '}
                  {objects.length + lines.length} — tapez un élément pour avancer son statut
                </span>
              </div>
              <div className="map-panel-row" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                1 tap = installé (✓ vert) · 2 taps = vérifié (✓ bleu) · 3 taps = à faire
              </div>
              <div className="map-panel-row">
                <button className="btn block" onClick={resetTools} type="button">
                  <Check size={18} /> Terminer
                </button>
              </div>
            </div>
          )}

          {mode === 'multi' && (
            <div className="map-panel">
              <div className="map-panel-row">
                <span className="map-panel-title">
                  {multiIds.size === 0
                    ? 'Touchez les objets et lignes à sélectionner'
                    : `${multiIds.size} sélectionné(s) — glissez un objet pour déplacer le groupe`}
                </span>
              </div>
              <div className="map-panel-row">
                <button className="btn secondary" onClick={handleDuplicateMulti} disabled={multiIds.size === 0} type="button">
                  <Copy size={18} /> Dupliquer
                </button>
                <button className="btn danger" onClick={handleDeleteMulti} disabled={multiIds.size === 0} type="button">
                  <Trash2 size={18} />
                </button>
                <button className="btn" onClick={resetTools} type="button">
                  <Check size={18} /> Terminer
                </button>
              </div>
            </div>
          )}

          {mode === 'place' && placeTarget && (
            <div className="map-panel">
              <div className="map-panel-row">
                <span className="map-panel-title">
                  Touchez le plan pour placer : {placeTarget.typeLabel}
                  {placeTarget.spec ? ` ${placeTarget.spec}` : ''}
                </span>
                <button className="btn" onClick={resetTools} type="button">
                  <Check size={18} /> Terminer
                </button>
              </div>
            </div>
          )}

          {mode === 'line' && lineTarget && (
            <div className="map-panel">
              <div className="map-panel-row">
                <span className="map-panel-title">
                  {lineTarget.def.label}
                  {lineTarget.spec ? ` ${lineTarget.spec}` : ''}
                  {draftLength !== null && ` · ${formatMeters(draftLength)}`}
                  {draftLength !== null &&
                    lineTarget.def.unitLengthM &&
                    ` · ${Math.ceil(draftLength / lineTarget.def.unitLengthM)} éléments`}
                </span>
              </div>
              {/* Segment coté : longueur au mètre laser + direction (croquis intérieur) */}
              {lineDraft.length >= 1 && (
                <div className="map-panel-row">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Longueur (m)"
                    value={cotedLength}
                    onChange={(e) => setCotedLength(e.target.value)}
                    style={{ width: 110 }}
                  />
                  {(
                    [
                      ['↑', 0, 1],
                      ['→', 1, 0],
                      ['↓', 0, -1],
                      ['←', -1, 0],
                    ] as const
                  ).map(([arrow, dx, dy]) => (
                    <button
                      key={arrow}
                      className="btn secondary"
                      style={{ minWidth: 44, padding: '8px 10px' }}
                      disabled={!(parseFloat(cotedLength.replace(',', '.')) > 0)}
                      onClick={() => {
                        const len = parseFloat(cotedLength.replace(',', '.'))
                        if (!(len > 0)) return
                        setLineDraft((d) => [...d, offsetLatLng(d[d.length - 1], dx * len, dy * len)])
                        setDraftSnaps((s) => [...s, null])
                      }}
                      type="button"
                    >
                      {arrow}
                    </button>
                  ))}
                </div>
              )}
              <div className="map-panel-row">
                <button
                  className="btn secondary"
                  onClick={() => {
                    setLineDraft((d) => d.slice(0, -1))
                    setDraftSnaps((s) => s.slice(0, -1))
                  }}
                  disabled={lineDraft.length === 0}
                  type="button"
                >
                  <Undo2 size={18} />
                </button>
                <button className="btn" onClick={finishLine} disabled={lineDraft.length < 2} type="button">
                  <Check size={18} /> Terminer
                </button>
                <button className="btn secondary" onClick={resetTools} type="button">
                  <X size={18} />
                </button>
              </div>
            </div>
          )}

          {selectedObject && mode === 'view' && (
            <SiteObjectPanel
              object={selectedObject}
              moveHint="Glissez l'objet sur le plan pour le déplacer"
              onStartCable={(opt) => startCableFrom(selectedObject.id, selectedObject.center, opt)}
              onClose={() => setSelection(null)}
            />
          )}
          {selectedLine && mode === 'view' && <SiteLinePanel line={selectedLine} onClose={() => setSelection(null)} />}
        </div>
      </div>

      {showObjectPicker && (
        <ObjectPickerModal
          onPick={(payload) => {
            setPlaceTarget(payload)
            setShowObjectPicker(false)
            setMode('place')
            setSelection(null)
          }}
          onClose={() => setShowObjectPicker(false)}
        />
      )}
      {showLinePicker && (
        <LinePickerModal
          onPick={(layer, def, spec) => {
            setLineTarget({ layer, def, spec })
            setLineDraft([])
            setShowLinePicker(false)
            setMode('line')
            setSelection(null)
          }}
          onClose={() => setShowLinePicker(false)}
        />
      )}

      {showBasePicker && (
        <Modal title="Fond du plan" onClose={() => setShowBasePicker(false)}>
          <div className="list">
            {[{ id: 'none', label: 'Aucun (grille seule)' }, ...BASE_LAYERS].map((b) => (
              <div
                key={b.id}
                className="list-item"
                style={baseLayer === b.id ? { borderColor: 'var(--accent)' } : undefined}
                onClick={() => {
                  setBaseLayer(b.id)
                  setShowBasePicker(false)
                }}
              >
                <span className="list-item-body list-item-title" style={{ fontWeight: 500 }}>
                  {b.label}
                </span>
                {baseLayer === b.id && <Check size={18} style={{ color: 'var(--accent)' }} />}
              </div>
            ))}
          </div>
        </Modal>
      )}

      {showExport && (
        <Modal title="Exporter le plan" onClose={() => setShowExport(false)}>
          {busy ? (
            <p className="empty-state">{busy}</p>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 12,
                  marginBottom: 14,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                }}
              >
                <div style={{ flex: 1, fontSize: 13 }}>
                  <strong>Cadrage : {printFrame ? "zone d'impression" : 'vue actuelle'}</strong>
                  <div style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 2 }}>
                    {printFrame
                      ? 'Le cadre bleu définit ce qui sera exporté.'
                      : "Toute la vue visible sera exportée. Définissez un cadre pour n'imprimer qu'une partie."}
                  </div>
                </div>
                <button
                  className={printFrame ? 'btn' : 'btn secondary'}
                  style={{ minHeight: 40, padding: '8px 12px' }}
                  onClick={() => {
                    if (printFrame) {
                      setPrintFrame(null)
                    } else {
                      const sz = exportHandle.current?.getSize()
                      if (sz && sz.width && sz.height) {
                        // Cadre A4 paysage centré (~85 % de la vue)
                        const fw = Math.min(sz.width * 0.85, sz.height * 0.85 * (297 / 210))
                        const fh = fw * (210 / 297)
                        setPrintFrame({ x: (sz.width - fw) / 2, y: (sz.height - fh) / 2, w: fw, h: fh })
                      }
                      setShowExport(false)
                    }
                  }}
                  type="button"
                >
                  {printFrame ? 'Retirer le cadre' : 'Définir un cadre'}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button className="btn block" onClick={exportPdf} type="button">
                  Dossier PDF complet (plan + récap matériel)
                </button>
                <button className="btn secondary block" onClick={exportPng} type="button">
                  Image PNG haute résolution
                </button>
                <button className="btn secondary block" onClick={exportPrint} type="button">
                  Aperçu à imprimer (navigateur)
                </button>
                <button className="btn secondary block" onClick={() => exportDxf(true)} type="button">
                  DXF + cartographie (AutoCAD / DWG)
                </button>
                <button className="btn secondary block" onClick={() => exportDxf(false)} type="button">
                  DXF seul (sans fond de carte)
                </button>
                <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  Le PDF reprend toutes les infos de l'événement, le plan puis le récap matériel détaillé sur autant de
                  pages que nécessaire. Le DXF contient la zone, les objets et câbles en entités CAO (mètres, un calque
                  par discipline) ; l'option « + cartographie » ajoute les bâtiments et voiries alentour depuis
                  OpenStreetMap (nécessite une connexion).
                </p>
              </div>
            </>
          )}
        </Modal>
      )}

      {showLayerSheet && (
        <Modal title="Calques" onClose={() => setShowLayerSheet(false)}>
          <div className="list">
            {DISCIPLINES.map((d) => (
              <label key={d} className="list-item" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={visibleLayers.has(d)}
                  onChange={() =>
                    setVisibleLayers((prev) => {
                      const next = new Set(prev)
                      if (next.has(d)) next.delete(d)
                      else next.add(d)
                      return next
                    })
                  }
                  style={{ width: 20, height: 20 }}
                />
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: DISCIPLINE_COLORS[d], flexShrink: 0 }} />
                <span className="list-item-body">{DISCIPLINE_LABELS[d]}</span>
              </label>
            ))}
            <label className="list-item" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showPoints}
                onChange={() => setShowPoints((v) => !v)}
                style={{ width: 20, height: 20 }}
              />
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#64748b', flexShrink: 0 }} />
              <span className="list-item-body">Repères GPS</span>
            </label>
            {plans.length > 0 && (
              <>
                <h3 style={{ fontSize: 13, color: 'var(--text-dim)', margin: '8px 0 0' }}>
                  Plans importés (superposer au site)
                </h3>
                {plans.map((p) => (
                  <label key={p.id} className="list-item" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!p.overlay?.visible}
                      onChange={() => toggleOverlay(p.id)}
                      style={{ width: 20, height: 20 }}
                    />
                    <span className="list-item-body">{p.name}</span>
                    {p.overlay?.visible && (
                      <button
                        className="btn secondary"
                        style={{ minHeight: 36, padding: '6px 12px' }}
                        onClick={(e) => {
                          e.preventDefault()
                          setOverlayEditId(p.id)
                          setShowLayerSheet(false)
                        }}
                        type="button"
                      >
                        Régler
                      </button>
                    )}
                  </label>
                ))}
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
