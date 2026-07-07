import { ChevronsDown, ChevronsUp, Copy, Move, Trash2, X } from 'lucide-react'
import {
  bringSiteObjectToFront,
  deleteSiteLine,
  deleteSiteObject,
  duplicateSiteLine,
  duplicateSiteObject,
  sendSiteObjectToBack,
  updateSiteLine,
  updateSiteObject,
} from '../db/actions'
import { DISCIPLINE_COLORS, DISCIPLINE_LABELS, type SiteLine, type SiteObject } from '../types'
import { findLineDef, findObjectDef, objectView } from '../utils/catalog'
import { formatMeters, lineLengthMeters } from '../utils/geo'

function SpecSelect({
  value,
  specs,
  onChange,
}: {
  value?: string
  specs: string[]
  onChange: (spec?: string) => void
}) {
  const options = value && !specs.includes(value) ? [value, ...specs] : specs
  return (
    <div className="map-panel-row">
      <label style={{ fontSize: 13, color: 'var(--text-dim)' }}>Calibre</label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        style={{ flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', minHeight: 38 }}
      >
        <option value="">Sans précision</option>
        {options.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  )
}

export function SiteObjectPanel({
  object,
  moveHint,
  onClose,
}: {
  object: SiteObject
  /** Sentence explaining how to move the object in the current view. */
  moveHint: string
  onClose: () => void
}) {
  const def = findObjectDef(object.layer, object.symbolType)
  const view = objectView(object)
  return (
    <div className="map-panel">
      <div className="map-panel-row">
        <span
          className="badge"
          style={{ background: DISCIPLINE_COLORS[object.layer] + '33', color: DISCIPLINE_COLORS[object.layer] }}
        >
          {DISCIPLINE_LABELS[object.layer]}
        </span>
        <span className="map-panel-title">
          {view.label}
          {object.spec ? ` ${object.spec}` : ''}
        </span>
        <button className="icon-btn" onClick={onClose} type="button" aria-label="Fermer">
          <X size={18} />
        </button>
      </div>
      <div className="map-panel-row" style={{ fontSize: 13, color: 'var(--text-dim)' }}>
        <Move size={15} /> {moveHint}
      </div>
      <div className="map-panel-row">
        <label style={{ fontSize: 13, color: 'var(--text-dim)' }}>Position</label>
        <button className="btn secondary" onClick={() => bringSiteObjectToFront(object.id)} type="button">
          <ChevronsUp size={16} /> Dessus
        </button>
        <button className="btn secondary" onClick={() => sendSiteObjectToBack(object.id)} type="button">
          <ChevronsDown size={16} /> Dessous
        </button>
      </div>
      <div className="map-panel-row">
        <label style={{ fontSize: 13, color: 'var(--text-dim)' }}>Couleur</label>
        <input
          type="color"
          value={view.color}
          onChange={(e) => updateSiteObject(object.id, { color: e.target.value })}
          style={{ width: 46, height: 34, padding: 2, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-elevated)' }}
        />
        <label style={{ fontSize: 13, color: 'var(--text-dim)' }}>Initiales</label>
        <input
          type="text"
          maxLength={4}
          defaultValue={view.glyph}
          onBlur={(e) => updateSiteObject(object.id, { glyph: e.target.value.trim().toUpperCase().slice(0, 4) || undefined })}
          style={{ width: 70 }}
        />
      </div>
      {(def?.specs || object.spec) && (
        <SpecSelect
          value={object.spec}
          specs={def?.specs ?? []}
          onChange={(spec) => updateSiteObject(object.id, { spec })}
        />
      )}
      {!view.isPoint && (
        <>
          <div className="map-panel-row">
            <label style={{ fontSize: 13, color: 'var(--text-dim)' }}>Dimensions (m)</label>
            <input
              type="number"
              step={0.1}
              min={0.1}
              value={object.widthM}
              onChange={(e) => updateSiteObject(object.id, { widthM: parseFloat(e.target.value) || 0.1 })}
              style={{ width: 80 }}
            />
            ×
            <input
              type="number"
              step={0.1}
              min={0.1}
              value={object.heightM}
              onChange={(e) => updateSiteObject(object.id, { heightM: parseFloat(e.target.value) || 0.1 })}
              style={{ width: 80 }}
            />
          </div>
          <div className="map-panel-row">
            <label style={{ fontSize: 13, color: 'var(--text-dim)' }}>Rotation</label>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={object.rotation}
              onChange={(e) => updateSiteObject(object.id, { rotation: parseInt(e.target.value, 10) })}
            />
            <span style={{ fontSize: 13, width: 44, textAlign: 'right' }}>{object.rotation}°</span>
          </div>
        </>
      )}
      <div className="map-panel-row">
        <input
          type="text"
          placeholder="Nom (ex : Bar principal)"
          defaultValue={object.label ?? ''}
          onBlur={(e) => updateSiteObject(object.id, { label: e.target.value || undefined })}
          style={{ flex: 1 }}
        />
        <button className="btn secondary" onClick={() => duplicateSiteObject(object.id)} type="button" aria-label="Dupliquer">
          <Copy size={18} />
        </button>
        <button
          className="btn danger"
          onClick={async () => {
            await deleteSiteObject(object.id)
            onClose()
          }}
          type="button"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  )
}

export function SiteLinePanel({ line, onClose }: { line: SiteLine; onClose: () => void }) {
  const def = findLineDef(line.layer, line.lineType)
  const length = lineLengthMeters(line.points)
  return (
    <div className="map-panel">
      <div className="map-panel-row">
        <span
          className="badge"
          style={{ background: DISCIPLINE_COLORS[line.layer] + '33', color: DISCIPLINE_COLORS[line.layer] }}
        >
          {DISCIPLINE_LABELS[line.layer]}
        </span>
        <span className="map-panel-title">
          {def?.label ?? line.lineType}
          {line.spec ? ` ${line.spec}` : ''}
        </span>
        <button className="icon-btn" onClick={onClose} type="button" aria-label="Fermer">
          <X size={18} />
        </button>
      </div>
      {(def?.specs || line.spec) && (
        <SpecSelect value={line.spec} specs={def?.specs ?? []} onChange={(spec) => updateSiteLine(line.id, { spec })} />
      )}
      <div className="map-panel-row" style={{ fontSize: 14 }}>
        Longueur : <strong>{formatMeters(length)}</strong>
        {def?.unitLengthM && (
          <>
            {' '}
            · <strong>{Math.ceil(length / def.unitLengthM)}</strong> éléments de {def.unitLengthM} m
          </>
        )}
      </div>
      <div className="map-panel-row">
        <input
          type="text"
          placeholder="Nom (ex : Alim scène)"
          defaultValue={line.label ?? ''}
          onBlur={(e) => updateSiteLine(line.id, { label: e.target.value || undefined })}
          style={{ flex: 1 }}
        />
        <button className="btn secondary" onClick={() => duplicateSiteLine(line.id)} type="button" aria-label="Dupliquer">
          <Copy size={18} />
        </button>
        <button
          className="btn danger"
          onClick={async () => {
            await deleteSiteLine(line.id)
            onClose()
          }}
          type="button"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  )
}
