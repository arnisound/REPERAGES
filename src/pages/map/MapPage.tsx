import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L, { type Map as LeafletMap } from 'leaflet'
import { Check, Globe, Layers, LocateFixed, MapPin, Pentagon, Trash2, Undo2, X } from 'lucide-react'
import { db } from '../../db/db'
import { createPoint, setProjectZone, updateSiteObject } from '../../db/actions'
import { categoryDivIcon, userLocationIcon } from '../../utils/mapIcons'
import { getCurrentPosition, useWatchPosition } from '../../hooks/useGeolocation'
import {
  DISCIPLINES,
  DISCIPLINE_COLORS,
  DISCIPLINE_LABELS,
  POINT_CATEGORY_COLORS,
  POINT_CATEGORY_LABELS,
  type Discipline,
  type LatLng,
  type PointCategory,
  type SiteLine,
  type SiteObject,
} from '../../types'
import { findLineDef, objectView } from '../../utils/catalog'
import { formatArea, polygonAreaM2, rectangleCorners } from '../../utils/geo'
import { BASE_LAYERS, findBaseLayer } from '../../utils/baseLayers'
import Modal from '../../components/Modal'
import TopBar from '../../components/TopBar'
import { SiteLinePanel, SiteObjectPanel } from '../../components/SitePanels'

const DEFAULT_CENTER: [number, number] = [46.6034, 1.8883] // France

type Mode = 'view' | 'zone' | 'point'

type Selection = { kind: 'object'; id: string } | { kind: 'line'; id: string } | null

const vertexIcon = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:4px;background:#a78bfa;border:2px solid #0b1220;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

const moveHandleIcon = L.divIcon({
  className: '',
  html: `<div style="width:34px;height:34px;border-radius:50%;background:rgba(56,189,248,0.25);border:2px dashed #38bdf8;display:flex;align-items:center;justify-content:center">
    <div style="width:8px;height:8px;border-radius:50%;background:#38bdf8"></div>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
})

function pointObjectIcon(color: string, glyph: string, selected: boolean) {
  const size = selected ? 30 : 24
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;background:${color};
      border:2px solid ${selected ? '#fff' : '#0b1220'};display:flex;align-items:center;justify-content:center;
      font:700 ${size * 0.38}px sans-serif;color:#0b1220;box-shadow:0 1px 4px rgba(0,0,0,0.5)
    ">${glyph}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function ClickCatcher({ onClick }: { onClick: (p: LatLng, onShape: boolean) => void }) {
  useMapEvents({
    click(e) {
      // Leaflet fires the map click even when the tap landed on a shape
      // (same DOM listener); flag it so view mode doesn't clear a selection
      // that the shape's own handler just made.
      const target = e.originalEvent.target as HTMLElement | null
      const onShape = !!target?.closest?.('.leaflet-interactive')
      onClick({ lat: e.latlng.lat, lng: e.latlng.lng }, onShape)
    },
  })
  return null
}

function ScaleControl() {
  const map = useMap()
  useEffect(() => {
    const ctrl = L.control.scale({ imperial: false, position: 'bottomleft' })
    ctrl.addTo(map)
    return () => {
      ctrl.remove()
    }
  }, [map])
  return null
}

/** Fit the initial view once: zone > points > user position > default. */
function InitialView({
  ready,
  zone,
  points,
  userPosition,
}: {
  ready: boolean
  zone?: LatLng[]
  points?: { lat: number; lng: number }[]
  userPosition: LatLng | null
}) {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    if (done.current || !ready) return
    if (zone && zone.length >= 3) {
      map.fitBounds(L.latLngBounds(zone.map((p) => [p.lat, p.lng])), { padding: [40, 40] })
      done.current = true
    } else if (points && points.length > 0) {
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [60, 60], maxZoom: 18 })
      done.current = true
    } else if (userPosition) {
      map.setView([userPosition.lat, userPosition.lng], 17)
      done.current = true
    }
  }, [ready, zone, points, userPosition, map])
  return null
}

export default function MapPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const project = useLiveQuery(() => (projectId ? db.projects.get(projectId) : undefined), [projectId])
  const points = useLiveQuery(
    () => (projectId ? db.points.where('projectId').equals(projectId).toArray() : []),
    [projectId],
  )
  const siteObjects =
    useLiveQuery(() => (projectId ? db.siteObjects.where('projectId').equals(projectId).toArray() : []), [projectId]) ?? []
  const siteLines =
    useLiveQuery(() => (projectId ? db.siteLines.where('projectId').equals(projectId).toArray() : []), [projectId]) ?? []

  const { position } = useWatchPosition(true)
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null)
  const [baseLayer, setBaseLayer] = useState('osm')
  const [showBasePicker, setShowBasePicker] = useState(false)
  const baseDef = findBaseLayer(baseLayer)

  const [mode, setMode] = useState<Mode>('view')
  const [zoneDraft, setZoneDraft] = useState<LatLng[]>([])
  const [selection, setSelection] = useState<Selection>(null)

  const [showLayerSheet, setShowLayerSheet] = useState(false)
  const [visibleLayers, setVisibleLayers] = useState<Set<Discipline>>(new Set(DISCIPLINES))
  const [showPoints, setShowPoints] = useState(true)
  const [showZone, setShowZone] = useState(true)

  const [pendingPoint, setPendingPoint] = useState<LatLng | null>(null)
  const [pointLabel, setPointLabel] = useState('')
  const [pointCategory, setPointCategory] = useState<PointCategory>('autre')
  const [pointNotes, setPointNotes] = useState('')

  const zone = project?.zone
  const zoneArea = useMemo(() => (zone && zone.length >= 3 ? polygonAreaM2(zone) : null), [zone])
  const draftArea = zoneDraft.length >= 3 ? polygonAreaM2(zoneDraft) : null

  const selectedObject: SiteObject | null =
    selection?.kind === 'object' ? siteObjects.find((o) => o.id === selection.id) ?? null : null
  const selectedLine: SiteLine | null =
    selection?.kind === 'line' ? siteLines.find((l) => l.id === selection.id) ?? null : null

  function resetTools() {
    setMode('view')
    setZoneDraft([])
  }

  function startZoneEdit() {
    setSelection(null)
    setZoneDraft(zone ? [...zone] : [])
    setMode('zone')
  }

  async function handleMapClick(p: LatLng, onShape: boolean) {
    if (!projectId) return
    // In view mode a tap on a shape is handled by the shape itself (selection).
    if (mode === 'view' && onShape) return
    if (mode === 'zone') {
      setZoneDraft((d) => [...d, p])
      return
    }
    if (mode === 'point') {
      setPendingPoint(p)
      return
    }
    setSelection(null)
  }

  async function saveZone() {
    if (!projectId || zoneDraft.length < 3) return
    await setProjectZone(projectId, zoneDraft)
    resetTools()
    // The zone is now the site plan's work surface — take the user there.
    navigate(`/projects/${projectId}/site-plan`)
  }

  async function clearZone() {
    if (!projectId) return
    if (!confirm('Effacer la zone du site ?')) return
    await setProjectZone(projectId, undefined)
    resetTools()
  }

  async function handleCreatePoint(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId || !pendingPoint || !pointLabel.trim()) return
    const point = await createPoint({
      projectId,
      lat: pendingPoint.lat,
      lng: pendingPoint.lng,
      label: pointLabel.trim(),
      category: pointCategory,
      notes: pointNotes.trim() || undefined,
    })
    setPendingPoint(null)
    setPointLabel('')
    setPointNotes('')
    setPointCategory('autre')
    resetTools()
    navigate(`/projects/${projectId}/points/${point.id}`)
  }

  async function handleLocate() {
    try {
      const pos = position ?? (await getCurrentPosition())
      mapInstance?.flyTo([pos.lat, pos.lng], Math.max(mapInstance.getZoom(), 18))
    } catch (err) {
      alert((err as Error).message)
    }
  }

  function selectShape(sel: Selection, e: L.LeafletMouseEvent) {
    if (mode !== 'view') return // let the tap fall through to the map (add vertex / point)
    // Passing the Leaflet event (not originalEvent) marks it as stopped for
    // Leaflet's own dispatcher, which suppresses the subsequent map click.
    L.DomEvent.stopPropagation(e as unknown as Event)
    setSelection(sel)
  }

  const zonePositions = (mode === 'zone' ? zoneDraft : zone) ?? []

  return (
    <>
      <TopBar
        title="Carte du site"
        action={
          <button className="icon-btn" onClick={() => setShowLayerSheet(true)} aria-label="Calques" type="button">
            <Layers size={20} />
          </button>
        }
      />
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={6}
          maxZoom={22}
          style={{ height: '100%', width: '100%' }}
          ref={setMapInstance}
        >
          <TileLayer
            key={baseDef.id}
            attribution={baseDef.attribution}
            url={baseDef.url}
            maxZoom={22}
            maxNativeZoom={baseDef.maxNativeZoom}
          />
          <ScaleControl />
          <InitialView
            ready={project !== undefined && points !== undefined}
            zone={zone}
            points={points}
            userPosition={position ? { lat: position.lat, lng: position.lng } : null}
          />
          <ClickCatcher onClick={handleMapClick} />

          {position && <Marker position={[position.lat, position.lng]} icon={userLocationIcon} />}

          {/* Site zone */}
          {showZone && zonePositions.length >= 2 && (
            <Polygon
              positions={zonePositions.map((p) => [p.lat, p.lng] as [number, number])}
              pathOptions={{
                color: '#a78bfa',
                weight: 3,
                dashArray: '8 6',
                fillColor: '#a78bfa',
                fillOpacity: mode === 'zone' ? 0.08 : 0.05,
                interactive: false,
              }}
            />
          )}
          {mode === 'zone' &&
            zoneDraft.map((p, i) => (
              <Marker
                key={i}
                position={[p.lat, p.lng]}
                icon={vertexIcon}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const ll = (e.target as L.Marker).getLatLng()
                    setZoneDraft((d) => d.map((v, j) => (j === i ? { lat: ll.lat, lng: ll.lng } : v)))
                  },
                }}
              />
            ))}

          {/* Site lines (drawn in the site plan, displayed here georeferenced) */}
          {siteLines
            .filter((l) => visibleLayers.has(l.layer))
            .map((l) => {
              const def = findLineDef(l.layer, l.lineType)
              const selected = selection?.kind === 'line' && selection.id === l.id
              return (
                <Polyline
                  key={l.id}
                  positions={l.points.map((p) => [p.lat, p.lng] as [number, number])}
                  pathOptions={{
                    color: DISCIPLINE_COLORS[l.layer],
                    weight: selected ? 6 : 4,
                    dashArray: def?.dashed ? '10 8' : undefined,
                    opacity: 0.9,
                  }}
                  eventHandlers={{ click: (e) => selectShape({ kind: 'line', id: l.id }, e) }}
                />
              )
            })}

          {/* Site objects at real scale — keyed on z so restacking re-adds layers in order */}
          {[...siteObjects]
            .sort((a, b) => (a.z ?? 0) - (b.z ?? 0) || a.createdAt - b.createdAt)
            .filter((o) => visibleLayers.has(o.layer))
            .map((o) => {
              const view = objectView(o)
              const color = view.color
              const selected = selection?.kind === 'object' && selection.id === o.id
              if (view.isPoint) {
                return (
                  <Marker
                    key={`${o.id}:${o.z ?? 0}`}
                    position={[o.center.lat, o.center.lng]}
                    icon={pointObjectIcon(color, view.glyph, selected)}
                    eventHandlers={{
                      click: (e) => selectShape({ kind: 'object', id: o.id }, e as L.LeafletMouseEvent),
                    }}
                  >
                    {o.label && (
                      <Tooltip permanent direction="bottom" offset={[0, 14]} className="site-obj-label">
                        {o.label}
                      </Tooltip>
                    )}
                  </Marker>
                )
              }
              const corners = rectangleCorners(o.center, o.widthM, o.heightM, o.rotation)
              return (
                <Polygon
                  key={`${o.id}:${o.z ?? 0}`}
                  positions={corners.map((p) => [p.lat, p.lng] as [number, number])}
                  pathOptions={{
                    color: selected ? '#ffffff' : color,
                    weight: selected ? 3 : 2,
                    fillColor: color,
                    fillOpacity: 0.35,
                  }}
                  eventHandlers={{ click: (e) => selectShape({ kind: 'object', id: o.id }, e) }}
                >
                  <Tooltip permanent direction="center" className="site-obj-label">
                    {o.label || view.glyph}
                  </Tooltip>
                </Polygon>
              )
            })}

          {/* Move handle for the selected object */}
          {selectedObject && (
            <Marker
              position={[selectedObject.center.lat, selectedObject.center.lng]}
              icon={moveHandleIcon}
              draggable
              zIndexOffset={1000}
              eventHandlers={{
                dragend: (e) => {
                  const ll = (e.target as L.Marker).getLatLng()
                  updateSiteObject(selectedObject.id, { center: { lat: ll.lat, lng: ll.lng } })
                },
              }}
            />
          )}

          {/* GPS reference points */}
          {showPoints &&
            points?.map((p) => (
              <Marker key={p.id} position={[p.lat, p.lng]} icon={categoryDivIcon(POINT_CATEGORY_COLORS[p.category])}>
                <Popup>
                  <strong>{p.label}</strong>
                  <br />
                  {POINT_CATEGORY_LABELS[p.category]}
                  <br />
                  <button
                    className="btn secondary"
                    style={{ marginTop: 8, minHeight: 34, padding: '6px 12px' }}
                    onClick={() => navigate(`/projects/${projectId}/points/${p.id}`)}
                  >
                    Voir la fiche
                  </button>
                </Popup>
              </Marker>
            ))}
        </MapContainer>

        {/* Info chip */}
        {mode === 'view' && zoneArea !== null && (
          <div className="map-chip">Zone du site : {formatArea(zoneArea)}</div>
        )}

        {/* Right-side buttons */}
        <div className="map-fab-col">
          <button className="icon-btn" onClick={handleLocate} type="button" aria-label="Me localiser">
            <LocateFixed size={20} />
          </button>
          <button
            className={`icon-btn ${baseLayer !== 'osm' ? 'active' : ''}`}
            onClick={() => setShowBasePicker(true)}
            type="button"
            aria-label="Fond de carte"
          >
            <Globe size={20} />
          </button>
        </div>

        {/* Bottom toolbar / mode panels */}
        {mode === 'view' && !selection && (
          <div className="map-toolbar">
            <button className="btn secondary" onClick={startZoneEdit} type="button">
              <Pentagon size={18} /> {zone && zone.length >= 3 ? 'Modifier la zone' : 'Délimiter la zone'}
            </button>
            <button
              className="btn secondary"
              onClick={() => {
                setSelection(null)
                setMode('point')
              }}
              type="button"
            >
              <MapPin size={18} /> Repère GPS
            </button>
            {zone && zone.length >= 3 && (
              <button className="btn" onClick={() => navigate(`/projects/${projectId}/site-plan`)} type="button">
                Ouvrir le plan
              </button>
            )}
          </div>
        )}

        {mode === 'zone' && (
          <div className="map-panel">
            <div className="map-panel-row">
              <span className="map-panel-title">
                Délimitez la zone du site — touchez la carte pour ajouter des sommets
                {draftArea !== null && ` · ${formatArea(draftArea)}`}
              </span>
            </div>
            <div className="map-panel-row">
              <button
                className="btn secondary"
                onClick={async () => {
                  // Relevé de terrain : marcher le long des façades/limites et
                  // enregistrer un sommet à chaque arrêt.
                  try {
                    const pos = position ?? (await getCurrentPosition())
                    setZoneDraft((d) => [...d, { lat: pos.lat, lng: pos.lng }])
                    mapInstance?.panTo([pos.lat, pos.lng])
                  } catch (err) {
                    alert((err as Error).message)
                  }
                }}
                type="button"
              >
                <LocateFixed size={18} /> + à ma position
              </button>
              <button
                className="btn secondary"
                onClick={() => setZoneDraft((d) => d.slice(0, -1))}
                disabled={zoneDraft.length === 0}
                type="button"
              >
                <Undo2 size={18} />
              </button>
              <button className="btn" onClick={saveZone} disabled={zoneDraft.length < 3} type="button">
                <Check size={18} /> Valider → plan
              </button>
              {zone && zone.length >= 3 && (
                <button className="btn danger" onClick={clearZone} type="button">
                  <Trash2 size={18} />
                </button>
              )}
              <button className="btn secondary" onClick={resetTools} type="button">
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        {mode === 'point' && !pendingPoint && (
          <div className="map-panel">
            <div className="map-panel-row">
              <span className="map-panel-title">Touchez la carte pour poser un repère GPS à la main</span>
            </div>
            <div className="map-panel-row">
              <button
                className="btn"
                onClick={async () => {
                  try {
                    const pos = position ?? (await getCurrentPosition())
                    setPendingPoint({ lat: pos.lat, lng: pos.lng })
                  } catch (err) {
                    alert((err as Error).message)
                  }
                }}
                type="button"
              >
                <LocateFixed size={18} /> À ma position (GPS)
              </button>
              <button className="btn secondary" onClick={resetTools} type="button">
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Selection panels (shared with the site plan) */}
        {selectedObject && mode === 'view' && (
          <SiteObjectPanel
            object={selectedObject}
            moveHint="Glissez la poignée bleue pour déplacer l'objet"
            onClose={() => setSelection(null)}
          />
        )}
        {selectedLine && mode === 'view' && <SiteLinePanel line={selectedLine} onClose={() => setSelection(null)} />}
      </div>

      {/* Base map picker */}
      {showBasePicker && (
        <Modal title="Fond de carte" onClose={() => setShowBasePicker(false)}>
          <div className="list">
            {BASE_LAYERS.map((b) => (
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

      {/* Layer visibility sheet */}
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
            <label className="list-item" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showZone}
                onChange={() => setShowZone((v) => !v)}
                style={{ width: 20, height: 20 }}
              />
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#a78bfa', flexShrink: 0 }} />
              <span className="list-item-body">Zone du site</span>
            </label>
          </div>
        </Modal>
      )}

      {/* New GPS point modal */}
      {pendingPoint && (
        <Modal title="Nouveau repère" onClose={() => setPendingPoint(null)}>
          <form onSubmit={handleCreatePoint}>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>
              {pendingPoint.lat.toFixed(6)}, {pendingPoint.lng.toFixed(6)}
            </p>
            <div className="field">
              <label>Nom du repère *</label>
              <input
                value={pointLabel}
                onChange={(e) => setPointLabel(e.target.value)}
                autoFocus
                placeholder="Entrée scène, arrivée EDF…"
              />
            </div>
            <div className="field">
              <label>Catégorie</label>
              <select value={pointCategory} onChange={(e) => setPointCategory(e.target.value as PointCategory)}>
                {Object.entries(POINT_CATEGORY_LABELS).map(([value, lbl]) => (
                  <option key={value} value={value}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea value={pointNotes} onChange={(e) => setPointNotes(e.target.value)} placeholder="Détails techniques, contraintes…" />
            </div>
            <button type="submit" className="btn block">
              Ajouter le repère
            </button>
          </form>
        </Modal>
      )}
    </>
  )
}
