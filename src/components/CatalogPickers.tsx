import { useState } from 'react'
import { DISCIPLINES, DISCIPLINE_COLORS, DISCIPLINE_LABELS, type Discipline } from '../types'
import { LINE_CATALOG, OBJECT_CATALOG, type LineDef, type ObjectDef } from '../utils/catalog'
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

export function ObjectPickerModal({
  onPick,
  onClose,
}: {
  onPick: (layer: Discipline, def: ObjectDef) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<Discipline>('implantation')
  return (
    <Modal title="Placer un objet" onClose={onClose}>
      <DisciplineTabs value={tab} onChange={setTab} />
      <div className="list">
        {OBJECT_CATALOG[tab].map((def) => (
          <div key={def.type} className="list-item" onClick={() => onPick(tab, def)}>
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
              {!def.point && (
                <div className="list-item-sub">
                  {def.w} × {def.h} m
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

export function LinePickerModal({
  onPick,
  onClose,
}: {
  onPick: (layer: Discipline, def: LineDef) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<Discipline>('electricite')
  return (
    <Modal title="Tracer une ligne" onClose={onClose}>
      <DisciplineTabs value={tab} onChange={setTab} />
      <div className="list">
        {LINE_CATALOG[tab].map((def) => (
          <div key={def.type} className="list-item" onClick={() => onPick(tab, def)}>
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
              {def.unitLengthM && <div className="list-item-sub">Comptage auto par éléments de {def.unitLengthM} m</div>}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
