import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { Download, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import { deleteProject, updateProject } from '../db/actions'
import { exportProject } from '../utils/backup'
import TopBar from '../components/TopBar'

export default function ProjectInfoPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const project = useLiveQuery(() => (projectId ? db.projects.get(projectId) : undefined), [projectId])
  const pointCount = useLiveQuery(
    () => (projectId ? db.points.where('projectId').equals(projectId).count() : 0),
    [projectId],
  )
  const planCount = useLiveQuery(
    () => (projectId ? db.plans.where('projectId').equals(projectId).count() : 0),
    [projectId],
  )
  const [saving, setSaving] = useState(false)

  if (!project || !projectId) return null

  async function handleField(
    field: 'name' | 'client' | 'venueName' | 'address' | 'eventDate' | 'notes',
    value: string,
  ) {
    if (!projectId) return
    setSaving(true)
    await updateProject(projectId, { [field]: value || undefined })
    setSaving(false)
  }

  async function handleDelete() {
    if (!projectId) return
    if (!confirm(`Supprimer définitivement "${project?.name}" et toutes ses données (points, photos, plans) ?`)) return
    await deleteProject(projectId)
    navigate('/')
  }

  async function handleExport() {
    if (!projectId) return
    await exportProject(projectId)
  }

  return (
    <>
      <TopBar title={project.name} onBack={() => navigate('/')} />
      <div className="app-body">
        <div className="page">
          <div className="card" style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{pointCount ?? 0}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Repères GPS</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{planCount ?? 0}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Plans</div>
            </div>
          </div>

          <div className="card">
            <div className="field">
              <label>Nom de l'événement</label>
              <input defaultValue={project.name} onBlur={(e) => handleField('name', e.target.value)} />
            </div>
            <div className="field">
              <label>Client</label>
              <input defaultValue={project.client ?? ''} onBlur={(e) => handleField('client', e.target.value)} />
            </div>
            <div className="field">
              <label>Lieu</label>
              <input defaultValue={project.venueName ?? ''} onBlur={(e) => handleField('venueName', e.target.value)} />
            </div>
            <div className="field">
              <label>Adresse</label>
              <input defaultValue={project.address ?? ''} onBlur={(e) => handleField('address', e.target.value)} />
            </div>
            <div className="field">
              <label>Date de l'événement</label>
              <input
                type="date"
                defaultValue={project.eventDate ?? ''}
                onBlur={(e) => handleField('eventDate', e.target.value)}
              />
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea defaultValue={project.notes ?? ''} onBlur={(e) => handleField('notes', e.target.value)} />
            </div>
            {saving && <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Enregistrement…</div>}
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="btn secondary block" onClick={handleExport} type="button">
              <Download size={18} /> Exporter (sauvegarde .zip)
            </button>
            <button className="btn danger block" onClick={handleDelete} type="button">
              <Trash2 size={18} /> Supprimer l'événement
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
