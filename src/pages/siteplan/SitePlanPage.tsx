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
import {
  DISCIPLINES,
  DISCIPLINE_COLORS,
  DISCIPLINE_LABELS,
  type Discipline,
  type LatLng,
} from '../../types'
import { LINE_CATALOG, type LineDef, type PlacePayload } from '../../utils/catalog'
import { formatArea, formatMeters, lineLengthMeters, offsetLatLng, polygonAreaM2, polygonCenter } from '../../utils/geo'
import Modal from '../../components/Modal'
import TopBar from '../../components/TopBar'
import { LinePickerModal, ObjectPickerModal } from '../../components/CatalogPickers'
import { SiteLinePanel, SiteObjectPanel } from '../../components/SitePanels'
import SitePlanCanvas, {
  gridStep,
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

  const [mode, setMode] = useState<SitePlanMode>('view')
  const [selection, setSelection] = useState<SiteSelection>(null)
  const [multiIds, setMultiIds] = useState<Set<string>>(new Set())
  const [placeTarget, setPlaceTarget] = useState<PlacePayload | null>(null)
  const [lineTarget, setLineTarget] = useState<{ layer: Discipline; def: LineDef; spec?: string } | null>(null)
  const [lineDraft, setLineDraft] = useState<LatLng[]>([])
  const [cotedLength, setCotedLength] = useState('')
  const [showObjectPicker, setShowObjectPicker] = useState(false)
  const [showLinePicker, setShowLinePicker] = useState(false)
  const [showLayerSheet, setShowLayerSheet] = useState(false)
  const [visibleLayers, setVisibleLayers] = useState<Set<Discipline>>(new Set(DISCIPLINES))
  const [showPoints, setShowPoints] = useState(true)
  const [baseLayer, setBaseLayer] = useState<SitePlanBase>('osm')
  const [viewScale, setViewScale] = useState(10)
  const [overlayEditId, setOverlayEditId] = useState<string | null>(null)
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map())
  const exportHandle = useRef<SitePlanCanvasHandle | null>(null)
  const [showExport, setShowExport] = useState(false)

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
    setMultiIds(new Set())
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
    const moves: Promise<unknown>[] = []
    for (const obj of objects) {
      if (multiIds.has(obj.id)) {
        moves.push(updateSiteObject(obj.id, { center: offsetLatLng(obj.center, eastM, northM) }))
      }
    }
    for (const line of lines) {
      if (multiIds.has(line.id)) {
        moves.push(updateSiteLine(line.id, { points: line.points.map((p) => offsetLatLng(p, eastM, northM)) }))
      }
    }
    await Promise.all(moves)
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
      setLineDraft((d) => [...d, gps])
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

  function exportPng() {
    const dataUrl = exportHandle.current?.exportImage(2400)
    if (!dataUrl) return
    const name = (project?.name ?? 'plan').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    saveAs(dataUrlToBlob(dataUrl), `plan-${name}.png`)
    setShowExport(false)
  }

  function exportPrint() {
    const dataUrl = exportHandle.current?.exportImage(2400)
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
    await addSiteLine({
      projectId,
      layer: lineTarget.layer,
      lineType: lineTarget.def.type,
      points: lineDraft,
      spec: lineTarget.spec,
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
            onDraftPointMove={(i, gps) => setLineDraft((d) => d.map((p, j) => (j === i ? gps : p)))}
            onViewScaleChange={setViewScale}
            exportRef={exportHandle}
          />

          <div className="map-chip">
            Zone : {formatArea(polygonAreaM2(zone))} · Grille {gridStep(viewScale)} m · Nord ↑
          </div>

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
              onClick={() => setBaseLayer((b) => (b === 'osm' ? 'sat' : b === 'sat' ? 'none' : 'osm'))}
              type="button"
              aria-label="Fond de carte"
              title={baseLayer === 'osm' ? 'Fond : plan' : baseLayer === 'sat' ? 'Fond : satellite' : 'Fond : aucun'}
            >
              {baseLayer === 'osm' ? <MapIcon size={20} /> : baseLayer === 'sat' ? <Globe size={20} /> : <Grid3x3 size={20} />}
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
                  onClick={() => setLineDraft((d) => d.slice(0, -1))}
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

      {showExport && (
        <Modal title="Exporter le plan" onClose={() => setShowExport(false)}>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 14 }}>
            La vue actuelle du plan est exportée telle quelle (cadrez et choisissez les calques avant d'exporter).
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="btn block" onClick={exportPrint} type="button">
              Dossier à imprimer / PDF
            </button>
            <button className="btn secondary block" onClick={exportPng} type="button">
              Télécharger l'image (PNG)
            </button>
          </div>
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
