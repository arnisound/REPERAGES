import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import { addPhotoToPoint, deletePoint, removePhotoFromPoint, updatePoint } from '../db/actions'
import { POINT_CATEGORY_COLORS, POINT_CATEGORY_LABELS, type PointCategory } from '../types'
import TopBar from '../components/TopBar'
import PhotoThumb from '../components/PhotoThumb'
import PhotoLightbox from '../components/PhotoLightbox'

export default function PointDetailPage() {
  const { projectId, pointId } = useParams<{ projectId: string; pointId: string }>()
  const navigate = useNavigate()
  const point = useLiveQuery(() => (pointId ? db.points.get(pointId) : undefined), [pointId])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null)

  if (!point) return null

  async function handleField(field: 'label' | 'category' | 'notes', value: string) {
    if (!pointId) return
    await updatePoint(pointId, { [field]: value })
  }

  async function handlePhotos(e: React.ChangeEvent<HTMLInputElement>) {
    if (!pointId) return
    const files = e.target.files
    if (!files) return
    for (const file of files) {
      await addPhotoToPoint(pointId, file)
    }
    e.target.value = ''
  }

  async function handleDelete() {
    if (!pointId) return
    if (!confirm(`Supprimer le repère "${point?.label}" ?`)) return
    await deletePoint(pointId)
    navigate(`/projects/${projectId}/map`)
  }

  return (
    <>
      <TopBar title={point.label} onBack={() => navigate(`/projects/${projectId}/map`)} />
      <div className="app-body">
        <div className="page">
          <div className="card">
            <span
              className="badge"
              style={{ background: POINT_CATEGORY_COLORS[point.category] + '33', color: POINT_CATEGORY_COLORS[point.category] }}
            >
              {POINT_CATEGORY_LABELS[point.category]}
            </span>
            <p style={{ marginTop: 10, fontSize: 13, color: 'var(--text-dim)' }}>
              {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
            </p>
          </div>

          <div className="card">
            <div className="field">
              <label>Nom</label>
              <input defaultValue={point.label} onBlur={(e) => handleField('label', e.target.value)} />
            </div>
            <div className="field">
              <label>Catégorie</label>
              <select
                defaultValue={point.category}
                onChange={(e) => handleField('category', e.target.value as PointCategory)}
              >
                {Object.entries(POINT_CATEGORY_LABELS).map(([value, lbl]) => (
                  <option key={value} value={value}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea defaultValue={point.notes ?? ''} onBlur={(e) => handleField('notes', e.target.value)} />
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3>Photos</h3>
              <button className="btn secondary" onClick={() => fileInputRef.current?.click()} type="button">
                <Camera size={18} /> Ajouter
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                hidden
                onChange={handlePhotos}
              />
            </div>
            {point.photoIds.length === 0 ? (
              <p className="empty-state" style={{ padding: '20px 0' }}>
                Aucune photo pour ce repère.
              </p>
            ) : (
              <div className="photo-grid">
                {point.photoIds.map((pid) => (
                  <PhotoThumb
                    key={pid}
                    photoId={pid}
                    onClick={() => setLightboxPhoto(pid)}
                    onRemove={() => pointId && removePhotoFromPoint(pointId, pid)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <button className="btn danger block" onClick={handleDelete} type="button">
              <Trash2 size={18} /> Supprimer ce repère
            </button>
          </div>
        </div>
      </div>
      {lightboxPhoto && <PhotoLightbox photoId={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />}
    </>
  )
}
