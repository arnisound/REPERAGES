import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Cable, Check, Globe, Grid3x3, Layers, Map as MapIcon, Package, Pentagon, Undo2, X } from 'lucide-react'
import { db } from '../../db/db'
import { addSiteLine, addSiteObject, updateSiteObject } from '../../db/actions'
import {
  DISCIPLINES,
  DISCIPLINE_COLORS,
  DISCIPLINE_LABELS,
  type Discipline,
  type LatLng,
} from '../../types'
import type { LineDef, ObjectDef } from '../../utils/catalog'
import { formatArea, formatMeters, lineLengthMeters, polygonAreaM2 } from '../../utils/geo'
import Modal from '../../components/Modal'
import TopBar from '../../components/TopBar'
import { LinePickerModal, ObjectPickerModal } from '../../components/CatalogPickers'
import { SiteLinePanel, SiteObjectPanel } from '../../components/SitePanels'
import SitePlanCanvas, { gridStep, type SitePlanBase, type SitePlanMode, type SiteSelection } from './SitePlanCanvas'

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

  const [mode, setMode] = useState<SitePlanMode>('view')
  const [selection, setSelection] = useState<SiteSelection>(null)
  const [placeTarget, setPlaceTarget] = useState<{ layer: Discipline; def: ObjectDef } | null>(null)
  const [lineTarget, setLineTarget] = useState<{ layer: Discipline; def: LineDef } | null>(null)
  const [lineDraft, setLineDraft] = useState<LatLng[]>([])
  const [showObjectPicker, setShowObjectPicker] = useState(false)
  const [showLinePicker, setShowLinePicker] = useState(false)
  const [showLayerSheet, setShowLayerSheet] = useState(false)
  const [visibleLayers, setVisibleLayers] = useState<Set<Discipline>>(new Set(DISCIPLINES))
  const [showPoints, setShowPoints] = useState(true)
  const [baseLayer, setBaseLayer] = useState<SitePlanBase>('osm')
  const [viewScale, setViewScale] = useState(10)

  if (!projectId || project === undefined) return null

  const zone = project?.zone
  const selectedObject = selection?.kind === 'object' ? objects.find((o) => o.id === selection.id) ?? null : null
  const selectedLine = selection?.kind === 'line' ? lines.find((l) => l.id === selection.id) ?? null : null
  const draftLength = lineDraft.length >= 2 ? lineLengthMeters(lineDraft) : null

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
                  Délimitez d'abord la zone du site sur la carte : elle sera exportée ici comme plan de travail à
                  l'échelle.
                </p>
                <button className="btn" onClick={() => navigate(`/projects/${projectId}/map`)} type="button">
                  Ouvrir la carte
                </button>
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
  }

  async function handleTap(gps: LatLng) {
    if (!projectId) return
    if (mode === 'place' && placeTarget) {
      await addSiteObject({
        projectId,
        layer: placeTarget.layer,
        symbolType: placeTarget.def.type,
        center: gps,
        widthM: placeTarget.def.w,
        heightM: placeTarget.def.h,
      })
      return
    }
    if (mode === 'line') {
      setLineDraft((d) => [...d, gps])
    }
  }

  async function finishLine() {
    if (!projectId || !lineTarget || lineDraft.length < 2) return
    await addSiteLine({ projectId, layer: lineTarget.layer, lineType: lineTarget.def.type, points: lineDraft })
    resetTools()
  }

  return (
    <div className="app-shell">
      <div className="app-main">
        <TopBar
          title="Plan du site"
          onBack={() => navigate(`/projects/${projectId}/plans`)}
          action={
            <button className="icon-btn" onClick={() => setShowLayerSheet(true)} aria-label="Calques" type="button">
              <Layers size={20} />
            </button>
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
            lineDraft={lineDraft}
            onTap={handleTap}
            onSelect={setSelection}
            onObjectMove={(id, gps) => updateSiteObject(id, { center: gps })}
            onDraftPointMove={(i, gps) => setLineDraft((d) => d.map((p, j) => (j === i ? gps : p)))}
            onViewScaleChange={setViewScale}
          />

          <div className="map-chip">
            Zone : {formatArea(polygonAreaM2(zone))} · Grille {gridStep(viewScale)} m · Nord ↑
          </div>

          {/* Background toggle: plan → satellite → aucun */}
          <div className="map-fab-col">
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

          {mode === 'view' && !selection && (
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
            </div>
          )}

          {mode === 'place' && placeTarget && (
            <div className="map-panel">
              <div className="map-panel-row">
                <span className="map-panel-title">Touchez le plan pour placer : {placeTarget.def.label}</span>
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
                  {draftLength !== null && ` · ${formatMeters(draftLength)}`}
                  {draftLength !== null &&
                    lineTarget.def.unitLengthM &&
                    ` · ${Math.ceil(draftLength / lineTarget.def.unitLengthM)} éléments`}
                </span>
              </div>
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
          onPick={(layer, def) => {
            setPlaceTarget({ layer, def })
            setShowObjectPicker(false)
            setMode('place')
            setSelection(null)
          }}
          onClose={() => setShowObjectPicker(false)}
        />
      )}
      {showLinePicker && (
        <LinePickerModal
          onPick={(layer, def) => {
            setLineTarget({ layer, def })
            setLineDraft([])
            setShowLinePicker(false)
            setMode('line')
            setSelection(null)
          }}
          onClose={() => setShowLinePicker(false)}
        />
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
          </div>
        </Modal>
      )}
    </div>
  )
}
