import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, MapPin, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { createProject } from '../db/actions'
import { importProjectFromZip } from '../utils/backup'
import Modal from '../components/Modal'

export default function ProjectsPage() {
  const navigate = useNavigate()
  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray(), [])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [venueName, setVenueName] = useState('')
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImporting(true)
    try {
      const newId = await importProjectFromZip(file)
      navigate(`/projects/${newId}/map`)
    } catch (err) {
      alert("Impossible d'importer ce fichier : " + (err as Error).message)
    } finally {
      setImporting(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const project = await createProject({
      name: name.trim(),
      client: client.trim() || undefined,
      eventDate: eventDate || undefined,
      venueName: venueName.trim() || undefined,
    })
    setShowCreate(false)
    setName('')
    setClient('')
    setEventDate('')
    setVenueName('')
    navigate(`/projects/${project.id}/map`)
  }

  return (
    <div className="app-shell">
      <div className="app-main">
        <div className="app-topbar">
          <h1>Repérages</h1>
          <button className="icon-btn" onClick={() => fileInputRef.current?.click()} aria-label="Importer une sauvegarde" type="button">
            <Upload size={20} />
          </button>
          <input ref={fileInputRef} type="file" accept=".zip" hidden onChange={handleImportFile} />
        </div>
        <div className="app-body">
          <div className="page">
            {importing && <p className="empty-state">Import en cours…</p>}
            {!projects && <p className="empty-state">Chargement…</p>}
            {projects && projects.length === 0 && (
              <div className="empty-state">
                <MapPin size={36} style={{ marginBottom: 10, opacity: 0.6 }} />
                <p>Aucun événement pour l'instant.</p>
                <p>Créez votre premier repérage technique.</p>
              </div>
            )}
            {projects && projects.length > 0 && (
              <div className="list">
                {projects.map((p) => (
                  <div key={p.id} className="list-item" onClick={() => navigate(`/projects/${p.id}/map`)}>
                    <div className="list-item-body">
                      <div className="list-item-title">{p.name}</div>
                      <div className="list-item-sub">
                        {[p.venueName, p.eventDate].filter(Boolean).join(' · ') || 'Aucune info'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <button className="fab" style={{ bottom: 20 }} onClick={() => setShowCreate(true)} aria-label="Nouvel événement">
        <Plus size={26} />
      </button>

      {showCreate && (
        <Modal title="Nouvel événement" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            <div className="field">
              <label>Nom de l'événement *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Festival Les Nuits d'Été" />
            </div>
            <div className="field">
              <label>Client</label>
              <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Nom du client" />
            </div>
            <div className="field">
              <label>Lieu</label>
              <input value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="Nom du site" />
            </div>
            <div className="field">
              <label>Date de l'événement</label>
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </div>
            <button type="submit" className="btn block">
              Créer
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
