import type { Discipline } from '../types'

export interface ObjectDef {
  type: string
  label: string
  /** Real-world footprint in meters. */
  w: number
  h: number
  /**
   * Point equipment (extincteur, prise, arrivée d'eau…) : son emprise au sol
   * n'a pas d'importance sur le plan, il est affiché comme un pictogramme à
   * taille d'écran fixe plutôt qu'un rectangle à l'échelle.
   */
  point?: boolean
  glyph: string
}

export interface LineDef {
  type: string
  label: string
  dashed?: boolean
  /** Longueur unitaire d'un élément (barrière 2 m, Heras 3,5 m) pour le comptage automatique. */
  unitLengthM?: number
}

export const OBJECT_CATALOG: Record<Discipline, ObjectDef[]> = {
  implantation: [
    { type: 'tente_3x3', label: 'Tente 3×3 m', w: 3, h: 3, glyph: 'T' },
    { type: 'tente_6x3', label: 'Tente 6×3 m', w: 6, h: 3, glyph: 'T' },
    { type: 'chapiteau', label: 'Chapiteau 10×20 m', w: 20, h: 10, glyph: 'CH' },
    { type: 'scene', label: 'Scène 8×6 m', w: 8, h: 6, glyph: 'SC' },
    { type: 'bar', label: 'Bar 4×2 m', w: 4, h: 2, glyph: 'BAR' },
    { type: 'food_truck', label: 'Food truck 6×2,5 m', w: 6, h: 2.5, glyph: 'FT' },
    { type: 'regie', label: 'Régie 3×3 m', w: 3, h: 3, glyph: 'RG' },
    { type: 'wc', label: 'WC / sanitaire 1,2×1,2 m', w: 1.2, h: 1.2, glyph: 'WC' },
    { type: 'conteneur', label: 'Conteneur 6×2,4 m', w: 6, h: 2.4, glyph: 'CO' },
    { type: 'table', label: 'Table 2×0,8 m', w: 2, h: 0.8, glyph: 'TB' },
  ],
  electricite: [
    { type: 'armoire_electrique', label: 'Armoire électrique', w: 0.8, h: 0.6, glyph: 'AE' },
    { type: 'coffret', label: 'Coffret de distribution', w: 0.4, h: 0.3, glyph: 'C', point: true },
    { type: 'groupe_electrogene', label: 'Groupe électrogène 2×1 m', w: 2, h: 1, glyph: 'GE' },
    { type: 'prise_mono', label: 'Point de raccordement 16A', w: 0.2, h: 0.2, glyph: '~', point: true },
    { type: 'prise_tri', label: 'Raccordement triphasé 32/63A', w: 0.2, h: 0.2, glyph: '3~', point: true },
    { type: 'eclairage_secours', label: 'Mât / éclairage de zone', w: 0.5, h: 0.5, glyph: 'M', point: true },
  ],
  eau: [
    { type: 'arrivee_eau', label: "Arrivée d'eau", w: 0.3, h: 0.3, glyph: 'E', point: true },
    { type: 'evacuation', label: 'Évacuation / vidange', w: 0.3, h: 0.3, glyph: 'V', point: true },
    { type: 'vanne', label: 'Vanne', w: 0.2, h: 0.2, glyph: 'X', point: true },
    { type: 'cuve', label: 'Cuve / réserve 2×2 m', w: 2, h: 2, glyph: 'CU' },
    { type: 'point_eau', label: "Point d'eau technique", w: 0.3, h: 0.3, glyph: 'P', point: true },
  ],
  audio: [
    { type: 'enceinte', label: 'Enceinte / diffusion', w: 0.6, h: 0.5, glyph: 'HP', point: true },
    { type: 'line_array', label: 'Line array / accroche', w: 1.2, h: 1.2, glyph: 'LA' },
    { type: 'console_audio', label: 'Console de mixage 2×1 m', w: 2, h: 1, glyph: 'MX' },
    { type: 'micro', label: 'Position micro', w: 0.2, h: 0.2, glyph: 'M', point: true },
    { type: 'ampli', label: 'Rack ampli', w: 0.6, h: 0.8, glyph: 'AR', point: true },
  ],
  lumiere: [
    { type: 'projecteur', label: 'Projecteur', w: 0.4, h: 0.4, glyph: 'PR', point: true },
    { type: 'pied_projecteur', label: 'Pied / totem lumière', w: 0.8, h: 0.8, glyph: 'ST' },
    { type: 'structure', label: 'Structure / pont 6 m', w: 6, h: 0.5, glyph: 'PT' },
    { type: 'gradateur', label: 'Rack gradateur', w: 0.6, h: 0.8, glyph: 'GR', point: true },
    { type: 'pupitre_lumiere', label: 'Pupitre lumière', w: 1.2, h: 0.8, glyph: 'PU' },
    { type: 'poursuite', label: 'Poursuite', w: 1, h: 1, glyph: 'PS', point: true },
  ],
  securite: [
    { type: 'pc_securite', label: 'PC sécurité 3×3 m', w: 3, h: 3, glyph: 'PC' },
    { type: 'poste_secours', label: 'Poste de secours 3×3 m', w: 3, h: 3, glyph: '+' },
    { type: 'extincteur', label: 'Extincteur', w: 0.2, h: 0.2, glyph: 'EX', point: true },
    { type: 'issue_secours', label: 'Issue / sortie de secours', w: 0.3, h: 0.3, glyph: 'IS', point: true },
    { type: 'point_controle', label: "Point de contrôle / d'accès", w: 0.3, h: 0.3, glyph: 'CT', point: true },
  ],
}

export const LINE_CATALOG: Record<Discipline, LineDef[]> = {
  implantation: [
    { type: 'passage', label: 'Passage / circulation', dashed: true },
    { type: 'limite', label: 'Limite interne', dashed: true },
  ],
  electricite: [
    { type: 'cable_elec', label: 'Câble électrique' },
    { type: 'cable_tri', label: 'Câble triphasé' },
    { type: 'passage_cable', label: 'Passage de câbles protégé', dashed: true },
  ],
  eau: [
    { type: 'tuyau_eau', label: "Tuyau d'alimentation" },
    { type: 'evacuation_ligne', label: "Ligne d'évacuation", dashed: true },
  ],
  audio: [
    { type: 'multipaire', label: 'Multipaire / snake' },
    { type: 'cable_hp', label: 'Câble HP' },
    { type: 'cable_xlr', label: 'Câble micro (XLR)' },
  ],
  lumiere: [
    { type: 'cable_dmx', label: 'Câble DMX' },
    { type: 'cable_lumiere', label: 'Câble puissance lumière' },
  ],
  securite: [
    { type: 'barriere', label: 'Barrières (2 m)', unitLengthM: 2 },
    { type: 'heras', label: 'Clôture Heras (3,5 m)', unitLengthM: 3.5 },
    { type: 'cheminement', label: "Cheminement d'évacuation", dashed: true },
  ],
}

export function findObjectDef(layer: Discipline, type: string): ObjectDef | undefined {
  return OBJECT_CATALOG[layer].find((o) => o.type === type)
}

export function findLineDef(layer: Discipline, type: string): LineDef | undefined {
  return LINE_CATALOG[layer].find((l) => l.type === type)
}
