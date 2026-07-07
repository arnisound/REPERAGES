import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Layers, Plus, Ruler, Cable, RotateCw, RotateCcw, Trash2, X, Check } from 'lucide-react'
import { db } from '../../db/db'
import {
  addPlanConnection,
  addPlanObject,
  deletePlanConnection,
  deletePlanObject,
  setPlanCalibration,
  updatePlanConnection,
  updatePlanObject,
} from '../../db/actions'
import { usePhotoUrl } from '../../hooks/usePhotoUrl'
import { DISCIPLINES, DISCIPLINE_COLORS, DISCIPLINE_LABELS, type Discipline } from '../../types'
import { OBJECT_CATALOG, findObjectDef } from '../../utils/catalog'
import { pxPerMeter, polylineLengthMeters, formatMeters } from '../../utils/scale'
import TopBar from '../../components/TopBar'
import Modal from '../../components/Modal'
import PlanCanvas, { type CanvasMode } from './PlanCanvas'

export default function PlanEditorPage() {
  const { projectId, planId } = useParams<{ projectId: string; planId: string }>()
  const navigate = useNavigate()
  const plan = useLiveQuery(() => (planId ? db.plans.get(planId) : undefined), [planId])
  const objects = useLiveQuery(() => (planId ? db.planObjects.where('planId').equals(planId).toArray() : []), [planId]) ?? []
  const connections =
    useLiveQuery(() => (planId ? db.planConnections.where('planId').equals(planId).toArray() : []), [planId]) ?? []
  const imageUrl = usePhotoUrl(plan?.photoId)

  const [visibleLayers, setVisibleLayers] = useState<Set<Discipline>>(new Set(DISCIPLINES))
  const [mode, setMode] = useState<CanvasMode>('view')
  const [showLayerSheet, setShowLayerSheet] = useState(false)
  const [showPlaceSheet, setShowPlaceSheet] = useState(false)
  const [showCableSheet, setShowCableSheet] = useState(false)
  const [placeLayerTab, setPlaceLayerTab] = useState<Discipline>('electricite')
  const [placeSymbolType, setPlaceSymbolType] = useState<string | null>(null)
  const [placeLayer, setPlaceLayer] = useState<Discipline | null>(null)

  const [cableLayer, setCableLayer] = useState<Discipline>('audio')
  const [cableType, setCableType] = useState('')
  const [cableDraftPoints, setCableDraftPoints] = useState<{ x: number; y: number }[]>([])
  const [cableFromObjectId, setCableFromObjectId] = useState<string | null>(null)

  const [calibrationPoints, setCalibrationPoints] = useState<{ x: number; y: number }[]>([])
  const [showCalibrationPrompt, setShowCalibrationPrompt] = useState(false)
  const [calibrationDistance, setCalibrationDistance] = useState('')

  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)

  const scale = useMemo(() => pxPerMeter(plan?.calibration ?? null), [plan?.calibration])
  const selectedObject = objects.find((o) => o.id === selectedObjectId) ?? null
  const selectedConnection = connections.find((c) => c.id === selectedConnectionId) ?? null

  if (!plan || !planId || !projectId) return null

  function toggleLayer(layer: Discipline) {
    setVisibleLayers((prev) => {
      const next = new Set(prev)
      if (next.has(layer)) next.delete(layer)
      else next.add(layer)
      return next
    })
  }

  function resetTools() {
    setMode('view')
    setPlaceSymbolType(null)
    setPlaceLayer(null)
    setCableDraftPoints([])
    setCableFromObjectId(null)
    setCalibrationPoints([])
  }

  function startPlace(layer: Discipline, symbolType: string) {
    setPlaceLayer(layer)
    setPlaceSymbolType(symbolType)
    setShowPlaceSheet(false)
    setMode('place')
    setSelectedObjectId(null)
    setSelectedConnectionId(null)
  }

  function startCable() {
    setShowCableSheet(false)
    setMode('cable')
    setCableDraftPoints([])
    setCableFromObjectId(null)
    setSelectedObjectId(null)
    setSelectedConnectionId(null)
  }

  function startCalibrate() {
    setMode('calibrate')
    setCalibrationPoints([])
    setSelectedObjectId(null)
    setSelectedConnectionId(null)
  }

  async function finishCable(toObjectId: string | null, points: { x: number; y: number }[], fromObjectId: string | null) {
    if (!planId) return
    if (points.length >= 2) {
      await addPlanConnection({
        planId,
        layer: cableLayer,
        fromObjectId,
        toObjectId,
        points,
        cableType: cableType.trim() || undefined,
      })
    }
    resetTools()
  }

  async function handleCanvasTap(point: { x: number; y: number }, hitObjectId: string | null) {
    if (!planId) return
    if (mode === 'calibrate') {
      const next = [...calibrationPoints, point]
      if (next.length >= 2) {
        setCalibrationPoints(next.slice(0, 2))
        setShowCalibrationPrompt(true)
      } else {
        setCalibrationPoints(next)
      }
      return
    }
    if (mode === 'place' && placeLayer && placeSymbolType) {
      const def = findObjectDef(placeLayer, placeSymbolType)
      await addPlanObject({
        planId,
        layer: placeLayer,
        symbolType: placeSymbolType,
        x: point.x,
        y: point.y,
        widthM: def?.w,
        heightM: def?.h,
      })
      return
    }
    if (mode === 'cable') {
      if (cableDraftPoints.length === 0) {
        setCableFromObjectId(hitObjectId)
        setCableDraftPoints([point])
        return
      }
      const next = [...cableDraftPoints, point]
      if (hitObjectId) {
        setCableDraftPoints(next)
        await finishCable(hitObjectId, next, cableFromObjectId)
      } else {
        setCableDraftPoints(next)
      }
      return
    }
    // view mode: tap on empty canvas clears selection
    setSelectedObjectId(null)
    setSelectedConnectionId(null)
  }

  async function handleConfirmCalibration(e: React.FormEvent) {
    e.preventDefault()
    if (!planId) return
    const meters = parseFloat(calibrationDistance.replace(',', '.'))
    if (!meters || meters <= 0 || calibrationPoints.length < 2) return
    await setPlanCalibration(planId, {
      p1: calibrationPoints[0],
      p2: calibrationPoints[1],
      realDistanceMeters: meters,
    })
    setShowCalibrationPrompt(false)
    setCalibrationDistance('')
    resetTools()
  }

  const connectionLength = selectedConnection ? polylineLengthMeters(selectedConnection.points, scale) : null

  return (
    <div className="app-shell">
      <div className="app-main">
        <TopBar
          title={plan.name}
          onBack={() => navigate(`/projects/${projectId}/plans`)}
          action={
            <button className="icon-btn" onClick={() => setShowLayerSheet(true)} aria-label="Calques" type="button">
              <Layers size={20} />
            </button>
          }
        />
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          {imageUrl && (
            <PlanCanvas
              imageUrl={imageUrl}
              imageWidth={plan.imageWidth}
              imageHeight={plan.imageHeight}
              objects={objects}
              connections={connections}
              visibleLayers={visibleLayers}
              mode={mode}
              pxPerMeter={scale}
              selectedObjectId={selectedObjectId}
              selectedConnectionId={selectedConnectionId}
              calibrationPoints={calibrationPoints}
              cableDraftPoints={cableDraftPoints}
              onCanvasTap={handleCanvasTap}
              onObjectDragEnd={(id, x, y) => updatePlanObject(id, { x, y })}
              onSelectObject={setSelectedObjectId}
              onSelectConnection={setSelectedConnectionId}
            />
          )}

          {/* Scale indicator */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '6px 10px',
              fontSize: 12,
              color: scale ? 'var(--text-dim)' : '#facc15',
            }}
          >
            {scale ? `Échelle : ${(1 / scale).toFixed(4)} m/px` : 'Non calibré'}
          </div>

          {/* Mode toolbars */}
          {mode === 'view' && (
            <div className="plan-toolbar">
              <button className="btn secondary" onClick={startCalibrate} type="button">
                <Ruler size={18} /> Calibrer
              </button>
              <button className="btn secondary" onClick={() => setShowPlaceSheet(true)} type="button">
                <Plus size={18} /> Objet
              </button>
              <button className="btn secondary" onClick={() => setShowCableSheet(true)} type="button">
                <Cable size={18} /> Câble
              </button>
            </div>
          )}
          {mode === 'place' && (
            <div className="plan-toolbar">
              <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>Touchez le plan pour placer un objet</span>
              <button className="btn secondary" onClick={resetTools} type="button">
                <Check size={18} /> Terminer
              </button>
            </div>
          )}
          {mode === 'cable' && (
            <div className="plan-toolbar">
              <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                {cableDraftPoints.length === 0 ? 'Touchez le point de départ' : 'Touchez un point suivant ou terminez'}
              </span>
              {cableDraftPoints.length >= 2 && (
                <button
                  className="btn secondary"
                  onClick={() => finishCable(null, cableDraftPoints, cableFromObjectId)}
                  type="button"
                >
                  <Check size={18} /> Terminer
                </button>
              )}
              <button className="btn danger" onClick={resetTools} type="button">
                <X size={18} /> Annuler
              </button>
            </div>
          )}
          {mode === 'calibrate' && (
            <div className="plan-toolbar">
              <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                Touchez 2 points dont vous connaissez la distance réelle ({calibrationPoints.length}/2)
              </span>
              <button className="btn danger" onClick={resetTools} type="button">
                <X size={18} /> Annuler
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Layer visibility sheet */}
      {showLayerSheet && (
        <Modal title="Calques" onClose={() => setShowLayerSheet(false)}>
          <div className="list">
            {DISCIPLINES.map((d) => (
              <label key={d} className="list-item" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={visibleLayers.has(d)}
                  onChange={() => toggleLayer(d)}
                  style={{ width: 20, height: 20 }}
                />
                <span
                  style={{ width: 12, height: 12, borderRadius: '50%', background: DISCIPLINE_COLORS[d], flexShrink: 0 }}
                />
                <span className="list-item-body">{DISCIPLINE_LABELS[d]}</span>
              </label>
            ))}
          </div>
        </Modal>
      )}

      {/* Place object sheet */}
      {showPlaceSheet && (
        <Modal title="Ajouter un objet" onClose={() => setShowPlaceSheet(false)}>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
            {DISCIPLINES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setPlaceLayerTab(d)}
                className={placeLayerTab === d ? 'btn' : 'btn secondary'}
                style={{ flexShrink: 0, minHeight: 38, padding: '8px 14px' }}
              >
                {DISCIPLINE_LABELS[d]}
              </button>
            ))}
          </div>
          <div className="list">
            {OBJECT_CATALOG[placeLayerTab].map((sym) => (
              <div key={sym.type} className="list-item" onClick={() => startPlace(placeLayerTab, sym.type)}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: sym.point ? '50%' : 6,
                    background: DISCIPLINE_COLORS[placeLayerTab],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    color: '#0b1220',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {sym.glyph}
                </span>
                <div className="list-item-body">
                  <div className="list-item-title" style={{ fontWeight: 500 }}>
                    {sym.label}
                  </div>
                  {!sym.point && (
                    <div className="list-item-sub">
                      {sym.w} × {sym.h} m
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Cable sheet */}
      {showCableSheet && (
        <Modal title="Tracer un câble / une ligne" onClose={() => setShowCableSheet(false)}>
          <div className="field">
            <label>Calque</label>
            <select value={cableLayer} onChange={(e) => setCableLayer(e.target.value as Discipline)}>
              {DISCIPLINES.map((d) => (
                <option key={d} value={d}>
                  {DISCIPLINE_LABELS[d]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Type de câble (optionnel)</label>
            <input value={cableType} onChange={(e) => setCableType(e.target.value)} placeholder="XLR, RJ45, DMX, 3G2.5…" />
          </div>
          <button className="btn block" onClick={startCable} type="button">
            Commencer le tracé
          </button>
        </Modal>
      )}

      {/* Calibration distance prompt */}
      {showCalibrationPrompt && (
        <Modal title="Distance réelle" onClose={() => setShowCalibrationPrompt(false)}>
          <form onSubmit={handleConfirmCalibration}>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>
              Quelle est la distance réelle entre ces deux points, en mètres ?
            </p>
            <div className="field">
              <input
                autoFocus
                inputMode="decimal"
                value={calibrationDistance}
                onChange={(e) => setCalibrationDistance(e.target.value)}
                placeholder="ex: 5.5"
              />
            </div>
            <button type="submit" className="btn block">
              Valider l'échelle
            </button>
          </form>
        </Modal>
      )}

      {/* Object properties */}
      {selectedObject && (
        <Modal title="Objet" onClose={() => setSelectedObjectId(null)}>
          <div className="field">
            <label>Type</label>
            <input disabled value={findObjectDef(selectedObject.layer, selectedObject.symbolType)?.label ?? selectedObject.symbolType} />
          </div>
          {!findObjectDef(selectedObject.layer, selectedObject.symbolType)?.point && (
            <div className="field">
              <label>Dimensions réelles (m)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  step={0.1}
                  min={0.1}
                  defaultValue={selectedObject.widthM ?? findObjectDef(selectedObject.layer, selectedObject.symbolType)?.w ?? 1}
                  onBlur={(e) => updatePlanObject(selectedObject.id, { widthM: parseFloat(e.target.value) || 1 })}
                  style={{ flex: 1 }}
                />
                ×
                <input
                  type="number"
                  step={0.1}
                  min={0.1}
                  defaultValue={selectedObject.heightM ?? findObjectDef(selectedObject.layer, selectedObject.symbolType)?.h ?? 1}
                  onBlur={(e) => updatePlanObject(selectedObject.id, { heightM: parseFloat(e.target.value) || 1 })}
                  style={{ flex: 1 }}
                />
              </div>
              {!scale && (
                <p style={{ fontSize: 12, color: '#facc15', marginTop: 6 }}>
                  Calibrez le plan pour que les objets s'affichent à leurs dimensions réelles.
                </p>
              )}
            </div>
          )}
          <div className="field">
            <label>Nom / repère</label>
            <input
              defaultValue={selectedObject.label ?? ''}
              onBlur={(e) => updatePlanObject(selectedObject.id, { label: e.target.value || undefined })}
            />
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea
              defaultValue={selectedObject.notes ?? ''}
              onBlur={(e) => updatePlanObject(selectedObject.id, { notes: e.target.value || undefined })}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn secondary"
              type="button"
              onClick={() => updatePlanObject(selectedObject.id, { rotation: selectedObject.rotation - 15 })}
            >
              <RotateCcw size={18} />
            </button>
            <button
              className="btn secondary"
              type="button"
              onClick={() => updatePlanObject(selectedObject.id, { rotation: selectedObject.rotation + 15 })}
            >
              <RotateCw size={18} />
            </button>
            <button
              className="btn danger"
              style={{ flex: 1 }}
              type="button"
              onClick={async () => {
                await deletePlanObject(selectedObject.id)
                setSelectedObjectId(null)
              }}
            >
              <Trash2 size={18} /> Supprimer
            </button>
          </div>
        </Modal>
      )}

      {/* Connection properties */}
      {selectedConnection && (
        <Modal title="Câble / ligne" onClose={() => setSelectedConnectionId(null)}>
          <div className="field">
            <label>Calque</label>
            <input disabled value={DISCIPLINE_LABELS[selectedConnection.layer]} />
          </div>
          <div className="field">
            <label>Type de câble</label>
            <input
              defaultValue={selectedConnection.cableType ?? ''}
              onBlur={(e) => updatePlanConnection(selectedConnection.id, { cableType: e.target.value || undefined })}
            />
          </div>
          <div className="field">
            <label>Longueur estimée</label>
            <input disabled value={formatMeters(connectionLength)} />
          </div>
          <button
            className="btn danger block"
            type="button"
            onClick={async () => {
              await deletePlanConnection(selectedConnection.id)
              setSelectedConnectionId(null)
            }}
          >
            <Trash2 size={18} /> Supprimer
          </button>
        </Modal>
      )}
    </div>
  )
}
