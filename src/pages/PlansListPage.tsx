import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, LayoutGrid } from 'lucide-react'
import { db } from '../db/db'
import { addPhoto, createPlan } from '../db/actions'
import TopBar from '../components/TopBar'
import PhotoThumb from '../components/PhotoThumb'

function loadImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = reject
    img.src = url
  })
}

export default function PlansListPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const plans = useLiveQuery(
    () => (projectId ? db.plans.where('projectId').equals(projectId).toArray() : []),
    [projectId],
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [creating, setCreating] = useState(false)

  async function handleNewPlan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !projectId) return
    setCreating(true)
    try {
      const { width, height } = await loadImageSize(file)
      const photo = await addPhoto(file)
      const plan = await createPlan({
        projectId,
        name: file.name.replace(/\.[^.]+$/, '') || 'Nouveau plan',
        photoId: photo.id,
        imageWidth: width,
        imageHeight: height,
      })
      navigate(`/projects/${projectId}/plans/${plan.id}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <TopBar title="Plans" />
      <div className="app-body">
        <div className="page">
          {creating && <p className="empty-state">Import du plan…</p>}
          {plans && plans.length === 0 && !creating && (
            <div className="empty-state">
              <LayoutGrid size={36} style={{ marginBottom: 10, opacity: 0.6 }} />
              <p>Aucun plan pour l'instant.</p>
              <p>Importez une photo du lieu ou un plan existant pour commencer.</p>
            </div>
          )}
          {plans && plans.length > 0 && (
            <div className="photo-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => navigate(`/projects/${projectId}/plans/${plan.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <PhotoThumb photoId={plan.photoId} />
                  <div style={{ fontSize: 13, marginTop: 6, textAlign: 'center' }}>{plan.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <button className="fab" onClick={() => fileInputRef.current?.click()} aria-label="Nouveau plan" type="button">
        <Plus size={26} />
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleNewPlan} />
    </>
  )
}
