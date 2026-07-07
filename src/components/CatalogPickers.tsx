import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import { addCustomModel, deleteCustomModel } from '../db/actions'
import { DISCIPLINES, DISCIPLINE_COLORS, DISCIPLINE_LABELS, type CustomModel, type Discipline } from '../types'
import { LINE_CATALOG, OBJECT_CATALOG, type LineDef, type ObjectDef, type PlacePayload } from '../utils/catalog'
import Modal from './Modal'

function DisciplineTabs({ value, onChange }: { value: Discipline; onChange: (d: Discipline) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
      {DISCIPLINES.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          className={value === d ? 'btn' : 'btn secondary'}
          style={{ flexShrink: 0, minHeight: 38, padding: '8px 14px' }}
        >
          {DISCIPLINE_LABELS[d]}
        </button>
      ))}
    </div>
  )
}

function SpecStep({
  title,
  specs,
  onPick,
  onBack,
}: {
  title: string
  specs: string[]
  onPick: (spec?: string) => void
  onBack: () => void
}) {
  return (
    <>
      <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>{title} — choisissez le calibre :</p>
      <div className="list">
        {specs.map((s) => (
          <div key={s} className="list-item" onClick={() => onPick(s)}>
            <span className="list-item-body list-item-title" style={{ fontWeight: 500 }}>
              {s}
            </span>
          </div>
        ))}
        <div className="list-item" onClick={() => onPick(undefined)}>
          <span className="list-item-body" style={{ color: 'var(--text-dim)' }}>
            Sans précision
          </span>
        </div>
      </div>
      <button className="btn secondary block" style={{ marginTop: 12 }} onClick={onBack} type="button">
        Retour
      </button>
    </>
  )
}

function NewModelForm({
  layer,
  onCreated,
  onCancel,
}: {
  layer: Discipline
  onCreated: (m: CustomModel) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [glyph, setGlyph] = useState('')
  const [color, setColor] = useState(DISCIPLINE_COLORS[layer])
  const [w, setW] = useState('1')
  const [h, setH] = useState('1')
  const [point, setPoint] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const model = await addCustomModel({
      layer,
      name: name.trim(),
      glyph: (glyph.trim() || name.trim().slice(0, 3)).toUpperCase().slice(0, 4),
      color,
      w: Math.max(0.1, parseFloat(w.replace(',', '.')) || 1),
      h: Math.max(0.1, parseFloat(h.replace(',', '.')) || 1),
      point,
    })
    onCreated(model)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label>Nom du matériel *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Enceinte L-Acoustics X15…" />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Initiales (max 4)</label>
          <input value={glyph} onChange={(e) => setGlyph(e.target.value)} maxLength={4} placeholder="X15" />
        </div>
        <div className="field">
          <label>Couleur</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 60, padding: 4 }} />
        </div>
      </div>
      {!point && (
        <div className="field">
          <label>Dimensions réelles (m)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} style={{ flex: 1 }} />
            ×
            <input inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} style={{ flex: 1 }} />
          </div>
        </div>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontSize: 14 }}>
        <input type="checkbox" checked={point} onChange={(e) => setPoint(e.target.checked)} style={{ width: 20, height: 20 }} />
        Pictogramme (petit équipement, sans emprise au sol)
      </label>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="btn secondary" style={{ flex: 1 }} onClick={onCancel}>
          Annuler
        </button>
        <button type="submit" className="btn" style={{ flex: 1 }}>
          Enregistrer le modèle
        </button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 10 }}>
        Le modèle rejoint votre banque de matériel, disponible sur tous les événements.
      </p>
    </form>
  )
}

export function ObjectPickerModal({
  onPick,
  onClose,
}: {
  onPick: (payload: PlacePayload) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<Discipline>('implantation')
  const [specDef, setSpecDef] = useState<ObjectDef | null>(null)
  const [creating, setCreating] = useState(false)
  const customModels =
    useLiveQuery(() => db.customModels.where('layer').equals(tab).sortBy('name'), [tab]) ?? []

  function pickDef(def: ObjectDef, spec?: string) {
    onPick({
      layer: tab,
      symbolType: def.type,
      typeLabel: def.label,
      glyph: def.glyph,
      w: def.w,
      h: def.h,
      point: def.point ?? false,
      spec,
    })
  }

  function pickModel(m: CustomModel) {
    onPick({
      layer: m.layer,
      symbolType: `custom:${m.id}`,
      typeLabel: m.name,
      glyph: m.glyph,
      color: m.color,
      w: m.w,
      h: m.h,
      point: m.point,
      custom: true,
    })
  }

  return (
    <Modal title="Placer un objet" onClose={onClose}>
      {creating ? (
        <NewModelForm layer={tab} onCreated={pickModel} onCancel={() => setCreating(false)} />
      ) : specDef ? (
        <SpecStep title={specDef.label} specs={specDef.specs!} onPick={(s) => pickDef(specDef, s)} onBack={() => setSpecDef(null)} />
      ) : (
        <>
          <DisciplineTabs value={tab} onChange={setTab} />
          <div className="list">
            {customModels.map((m) => (
              <div key={m.id} className="list-item" onClick={() => pickModel(m)}>
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: m.point ? '50%' : 6,
                    background: m.color ?? DISCIPLINE_COLORS[tab],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    color: '#0b1220',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {m.glyph}
                </span>
                <div className="list-item-body">
                  <div className="list-item-title" style={{ fontWeight: 500 }}>
                    {m.name}
                  </div>
                  <div className="list-item-sub">Modèle perso{!m.point && ` · ${m.w} × ${m.h} m`}</div>
                </div>
                <button
                  className="icon-btn"
                  style={{ width: 32, height: 32 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`Supprimer le modèle "${m.name}" de la banque ?`)) deleteCustomModel(m.id)
                  }}
                  aria-label="Supprimer le modèle"
                  type="button"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {OBJECT_CATALOG[tab].filter((d) => !d.legacy).map((def) => (
              <div
                key={def.type}
                className="list-item"
                onClick={() => (def.specs ? setSpecDef(def) : pickDef(def))}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: def.point ? '50%' : 6,
                    background: DISCIPLINE_COLORS[tab],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    color: '#0b1220',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {def.glyph}
                </span>
                <div className="list-item-body">
                  <div className="list-item-title" style={{ fontWeight: 500 }}>
                    {def.label}
                  </div>
                  <div className="list-item-sub">
                    {[!def.point && `${def.w} × ${def.h} m`, def.specs && 'calibre au choix'].filter(Boolean).join(' · ') ||
                      ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="btn secondary block" style={{ marginTop: 12 }} onClick={() => setCreating(true)} type="button">
            <Plus size={18} /> Nouveau modèle dans ma banque ({DISCIPLINE_LABELS[tab]})
          </button>
        </>
      )}
    </Modal>
  )
}

export function LinePickerModal({
  onPick,
  onClose,
}: {
  onPick: (layer: Discipline, def: LineDef, spec?: string) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<Discipline>('electricite')
  const [specDef, setSpecDef] = useState<LineDef | null>(null)
  return (
    <Modal title="Tracer une ligne" onClose={onClose}>
      {specDef ? (
        <SpecStep
          title={specDef.label}
          specs={specDef.specs!}
          onPick={(s) => onPick(tab, specDef, s)}
          onBack={() => setSpecDef(null)}
        />
      ) : (
        <>
          <DisciplineTabs value={tab} onChange={setTab} />
          <div className="list">
            {LINE_CATALOG[tab].filter((d) => !d.legacy).map((def) => (
              <div key={def.type} className="list-item" onClick={() => (def.specs ? setSpecDef(def) : onPick(tab, def))}>
                <span
                  style={{
                    width: 30,
                    height: 6,
                    borderRadius: 3,
                    flexShrink: 0,
                    background: def.dashed
                      ? `repeating-linear-gradient(90deg, ${DISCIPLINE_COLORS[tab]} 0 6px, transparent 6px 10px)`
                      : DISCIPLINE_COLORS[tab],
                  }}
                />
                <div className="list-item-body">
                  <div className="list-item-title" style={{ fontWeight: 500 }}>
                    {def.label}
                  </div>
                  {(def.unitLengthM || def.specs) && (
                    <div className="list-item-sub">
                      {[def.unitLengthM && `éléments de ${def.unitLengthM} m`, def.specs && 'calibre au choix']
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}
