import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet'
import type { Map as LeafletMap } from 'leaflet'
import { LocateFixed, Plus } from 'lucide-react'
import { db } from '../db/db'
import { createPoint } from '../db/actions'
import { categoryDivIcon, userLocationIcon } from '../utils/mapIcons'
import { getCurrentPosition, useWatchPosition } from '../hooks/useGeolocation'
import { POINT_CATEGORY_COLORS, POINT_CATEGORY_LABELS, type PointCategory } from '../types'
import Modal from '../components/Modal'
import TopBar from '../components/TopBar'

const DEFAULT_CENTER: [number, number] = [46.6034, 1.8883] // France

function ClickCatcher({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function FlyToControl({ onLocate }: { onLocate: () => void }) {
  return (
    <button
      className="icon-btn"
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 500,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
      }}
      onClick={onLocate}
      type="button"
      aria-label="Me localiser"
    >
      <LocateFixed size={20} />
    </button>
  )
}

export default function MapPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const points = useLiveQuery(
    () => (projectId ? db.points.where('projectId').equals(projectId).toArray() : []),
    [projectId],
  )
  const { position } = useWatchPosition(true)
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(null)
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState<PointCategory>('autre')
  const [notes, setNotes] = useState('')
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null)

  const center = useMemo<[number, number]>(() => {
    if (points && points.length > 0) return [points[0].lat, points[0].lng]
    if (position) return [position.lat, position.lng]
    return DEFAULT_CENTER
  }, [points, position]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLocate() {
    try {
      const pos = await getCurrentPosition()
      mapInstance?.flyTo([pos.lat, pos.lng], 18)
    } catch (err) {
      alert((err as Error).message)
    }
  }

  async function handleAddAtMyPosition() {
    try {
      const pos = position ?? (await getCurrentPosition())
      setPending({ lat: pos.lat, lng: pos.lng })
    } catch (err) {
      alert((err as Error).message)
    }
  }

  async function handleCreatePoint(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId || !pending || !label.trim()) return
    const point = await createPoint({
      projectId,
      lat: pending.lat,
      lng: pending.lng,
      label: label.trim(),
      category,
      notes: notes.trim() || undefined,
    })
    setPending(null)
    setLabel('')
    setNotes('')
    setCategory('autre')
    navigate(`/projects/${projectId}/points/${point.id}`)
  }

  return (
    <>
      <TopBar title="Carte" />
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <MapContainer center={center} zoom={points && points.length ? 17 : 6} style={{ height: '100%', width: '100%' }} ref={setMapInstance}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickCatcher onClick={(lat, lng) => setPending({ lat, lng })} />
          {position && <Marker position={[position.lat, position.lng]} icon={userLocationIcon} />}
          {points?.map((p) => (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={categoryDivIcon(POINT_CATEGORY_COLORS[p.category])}
            >
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
        <FlyToControl onLocate={handleLocate} />
      </div>
      <button className="fab" onClick={handleAddAtMyPosition} aria-label="Ajouter un repère">
        <Plus size={26} />
      </button>

      {pending && (
        <Modal title="Nouveau repère" onClose={() => setPending(null)}>
          <form onSubmit={handleCreatePoint}>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>
              {pending.lat.toFixed(6)}, {pending.lng.toFixed(6)}
            </p>
            <div className="field">
              <label>Nom du repère *</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} autoFocus placeholder="Entrée scène, arrivée EDF…" />
            </div>
            <div className="field">
              <label>Catégorie</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as PointCategory)}>
                {Object.entries(POINT_CATEGORY_LABELS).map(([value, lbl]) => (
                  <option key={value} value={value}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Détails techniques, contraintes…" />
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
