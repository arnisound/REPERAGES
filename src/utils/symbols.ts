import type { Discipline } from '../types'

export interface SymbolDef {
  type: string
  label: string
  shape: 'circle' | 'square' | 'triangle' | 'diamond'
  glyph: string
}

export const SYMBOL_CATALOG: Record<Discipline, SymbolDef[]> = {
  electricite: [
    { type: 'tgbt', label: 'Armoire / TGBT', shape: 'square', glyph: 'A' },
    { type: 'coffret', label: 'Coffret de distribution', shape: 'square', glyph: 'C' },
    { type: 'prise_mono', label: 'Prise mono (16A)', shape: 'circle', glyph: '~' },
    { type: 'prise_tri', label: 'Prise triphasée (32A)', shape: 'circle', glyph: '3~' },
    { type: 'disjoncteur', label: 'Disjoncteur', shape: 'diamond', glyph: 'D' },
    { type: 'groupe_electrogene', label: 'Groupe électrogène', shape: 'square', glyph: 'G' },
  ],
  plomberie: [
    { type: 'arrivee_eau', label: "Arrivée d'eau", shape: 'circle', glyph: 'E' },
    { type: 'evacuation', label: 'Évacuation / vidange', shape: 'circle', glyph: 'V' },
    { type: 'vanne', label: 'Vanne', shape: 'diamond', glyph: 'X' },
    { type: 'point_eau', label: "Point d'eau technique", shape: 'circle', glyph: 'P' },
  ],
  reseau: [
    { type: 'switch', label: 'Switch réseau', shape: 'square', glyph: 'S' },
    { type: 'baie_brassage', label: 'Baie de brassage', shape: 'square', glyph: 'B' },
    { type: 'borne_wifi', label: 'Borne Wi-Fi', shape: 'circle', glyph: 'W' },
    { type: 'point_fibre', label: 'Point fibre', shape: 'triangle', glyph: 'F' },
    { type: 'prise_rj45', label: 'Prise RJ45', shape: 'circle', glyph: 'N' },
  ],
  audio: [
    { type: 'enceinte', label: 'Enceinte / diffusion', shape: 'triangle', glyph: 'HP' },
    { type: 'console_audio', label: 'Console de mixage', shape: 'square', glyph: 'MX' },
    { type: 'micro', label: 'Position micro', shape: 'circle', glyph: 'M' },
    { type: 'di_box', label: 'Boîte de direct (DI)', shape: 'diamond', glyph: 'DI' },
    { type: 'ampli', label: 'Rack ampli', shape: 'square', glyph: 'AR' },
  ],
  lumiere: [
    { type: 'projecteur', label: 'Projecteur', shape: 'triangle', glyph: 'PR' },
    { type: 'gradateur', label: 'Rack gradateur', shape: 'square', glyph: 'GR' },
    { type: 'poursuite', label: 'Poursuite', shape: 'triangle', glyph: 'PS' },
    { type: 'pupitre_lumiere', label: 'Pupitre lumière', shape: 'square', glyph: 'PU' },
    { type: 'pied_projecteur', label: 'Pied / structure', shape: 'diamond', glyph: 'ST' },
  ],
}
