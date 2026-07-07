import { DISCIPLINE_COLORS, type Discipline, type SiteObject } from '../types'

export interface ObjectDef {
  type: string
  label: string
  /** Real-world footprint in meters. */
  w: number
  h: number
  /**
   * Point equipment (extincteur, prise, robinet…) : son emprise au sol n'a
   * pas d'importance sur le plan, il est affiché comme un pictogramme à
   * taille d'écran fixe plutôt qu'un rectangle à l'échelle.
   */
  point?: boolean
  glyph: string
  /** Spécifications proposées au placement (ex : calibres électriques). */
  specs?: string[]
  /** Retiré du sélecteur mais toujours résolu pour les objets déjà placés. */
  legacy?: boolean
}

export interface LineDef {
  type: string
  label: string
  dashed?: boolean
  /** Longueur unitaire d'un élément (barrière 2 m, Heras 3,5 m) pour le comptage automatique. */
  unitLengthM?: number
  /** Câble/tuyau vendu par tronçons : éligible à la découpe du récap matériel. */
  sectionable?: boolean
  /** Spécifications proposées au tracé (ex : calibres électriques). */
  specs?: string[]
  /** Retiré du sélecteur mais toujours résolu pour les lignes déjà tracées. */
  legacy?: boolean
}

export const ELEC_SPECS = [
  'MONO 16A',
  'MONO 32A',
  'TRI 16A',
  'TRI 32A',
  'TRI 63A',
  'TRI 125A',
  'POWERLOCK 250A',
  'POWERLOCK 400A',
]

export const RJ45_SPECS = ['Cat 5e', 'Cat 6', 'Cat 6a', 'Cat 7']

export const OBJECT_CATALOG: Record<Discipline, ObjectDef[]> = {
  implantation: [
    { type: 'tente_3x3', label: 'Tente 3×3 m', w: 3, h: 3, glyph: 'T' },
    { type: 'tente_6x3', label: 'Tente 6×3 m', w: 6, h: 3, glyph: 'T' },
    { type: 'chapiteau', label: 'Chapiteau 10×20 m', w: 20, h: 10, glyph: 'CH' },
    { type: 'scene', label: 'Scène 8×6 m', w: 8, h: 6, glyph: 'SC' },
    { type: 'scene_custom', label: 'Scène personnalisée', w: 6, h: 4, glyph: 'SC' },
    { type: 'podium', label: 'Podium 2×1 m', w: 2, h: 1, glyph: 'PO' },
    { type: 'dancefloor', label: 'Plancher / piste 6×6 m', w: 6, h: 6, glyph: 'PL' },
    { type: 'bar', label: 'Bar 4×2 m', w: 4, h: 2, glyph: 'BAR' },
    { type: 'comptoir', label: 'Comptoir 2×0,8 m', w: 2, h: 0.8, glyph: 'CP' },
    { type: 'food_truck', label: 'Food truck 6×2,5 m', w: 6, h: 2.5, glyph: 'FT' },
    { type: 'regie', label: 'Régie 3×3 m', w: 3, h: 3, glyph: 'RG' },
    { type: 'wc', label: 'WC / sanitaire 1,2×1,2 m', w: 1.2, h: 1.2, glyph: 'WC' },
    { type: 'conteneur', label: 'Conteneur 6×2,4 m', w: 6, h: 2.4, glyph: 'CO' },
    { type: 'table', label: 'Table 2×0,8 m', w: 2, h: 0.8, glyph: 'TB' },
    { type: 'banc', label: 'Banc 1,8 m', w: 1.8, h: 0.4, glyph: 'BC' },
    { type: 'parasol', label: 'Parasol 3×3 m', w: 3, h: 3, glyph: 'PS' },
    { type: 'chaise', label: 'Chaise', w: 0.5, h: 0.5, glyph: 'CH', point: true },
    { type: 'panneau', label: 'Panneau / signalétique', w: 0.8, h: 0.1, glyph: 'PA', point: true },
    { type: 'deco', label: 'Décoration', w: 0.5, h: 0.5, glyph: 'DE', point: true },
    { type: 'objet_custom', label: 'Objet personnalisé', w: 1, h: 1, glyph: '?' },
  ],
  electricite: [
    { type: 'armoire_electrique', label: 'Armoire électrique', w: 0.8, h: 0.6, glyph: 'AE', specs: ELEC_SPECS },
    { type: 'coffret', label: 'Coffret de distribution', w: 0.4, h: 0.3, glyph: 'C', point: true, specs: ELEC_SPECS },
    { type: 'groupe_electrogene', label: 'Groupe électrogène 2×1 m', w: 2, h: 1, glyph: 'GE' },
    { type: 'prise_mono', label: 'Point de raccordement', w: 0.2, h: 0.2, glyph: '~', point: true, specs: ELEC_SPECS },
    { type: 'prise_tri', label: 'Raccordement triphasé 32/63A', w: 0.2, h: 0.2, glyph: '3~', point: true, legacy: true },
    { type: 'enrouleur', label: 'Enrouleur / multiprise', w: 0.3, h: 0.3, glyph: 'EN', point: true },
    { type: 'projecteur_chantier', label: 'Projecteur de zone / chantier', w: 0.4, h: 0.4, glyph: 'PZ', point: true },
    { type: 'eclairage_secours', label: 'Mât / éclairage de zone', w: 0.5, h: 0.5, glyph: 'M', point: true },
  ],
  reseau: [
    { type: 'baie_brassage', label: 'Baie de brassage', w: 0.6, h: 0.8, glyph: 'BB' },
    { type: 'switch', label: 'Switch réseau', w: 0.4, h: 0.3, glyph: 'SW', point: true },
    { type: 'routeur', label: 'Routeur / box 4G-5G', w: 0.3, h: 0.3, glyph: 'RT', point: true },
    { type: 'borne_wifi', label: 'Borne Wi-Fi', w: 0.2, h: 0.2, glyph: 'WIFI', point: true },
    { type: 'prise_rj45', label: 'Prise RJ45', w: 0.1, h: 0.1, glyph: 'RJ', point: true },
    { type: 'point_fibre', label: 'Arrivée fibre', w: 0.2, h: 0.2, glyph: 'FO', point: true },
    { type: 'convertisseur_fibre', label: 'Convertisseur fibre / média', w: 0.2, h: 0.2, glyph: 'CV', point: true },
    { type: 'serveur', label: 'Serveur / NAS', w: 0.6, h: 0.8, glyph: 'SRV' },
  ],
  video: [
    { type: 'ecran_led', label: 'Écran LED 4×3 m', w: 4, h: 0.5, glyph: 'LED' },
    { type: 'ecran_projection', label: 'Écran de projection 3×2 m', w: 3, h: 0.3, glyph: 'EP' },
    { type: 'videoprojecteur', label: 'Vidéoprojecteur', w: 0.5, h: 0.4, glyph: 'VP', point: true },
    { type: 'ecran_moniteur', label: 'Écran / moniteur', w: 1.2, h: 0.1, glyph: 'TV' },
    { type: 'camera', label: 'Caméra', w: 0.3, h: 0.3, glyph: 'CAM', point: true },
    { type: 'camera_plateau', label: 'Caméra plateau + pied', w: 0.8, h: 0.8, glyph: 'CAM' },
    { type: 'regie_video', label: 'Régie vidéo 2×1 m', w: 2, h: 1, glyph: 'RV' },
    { type: 'melangeur', label: 'Mélangeur / grille', w: 0.5, h: 0.4, glyph: 'MG', point: true },
    { type: 'enregistreur', label: 'Enregistreur / streaming', w: 0.4, h: 0.4, glyph: 'REC', point: true },
  ],
  eau: [
    { type: 'arrivee_eau', label: "Arrivée d'eau", w: 0.3, h: 0.3, glyph: 'E', point: true },
    { type: 'robinet', label: 'Robinet', w: 0.2, h: 0.2, glyph: 'R', point: true },
    { type: 'evacuation', label: 'Évacuation / vidange', w: 0.3, h: 0.3, glyph: 'V', point: true },
    { type: 'vanne', label: 'Vanne', w: 0.2, h: 0.2, glyph: 'X', point: true },
    { type: 'douche', label: 'Douche / rampe 1×1 m', w: 1, h: 1, glyph: 'DO' },
    { type: 'cuve', label: 'Cuve / réserve 2×2 m', w: 2, h: 2, glyph: 'CU' },
    { type: 'pompe', label: 'Pompe', w: 0.4, h: 0.4, glyph: 'PP', point: true },
    { type: 'point_eau', label: "Point d'eau technique", w: 0.3, h: 0.3, glyph: 'P', point: true },
  ],
  audio: [
    { type: 'enceinte', label: 'Enceinte / diffusion', w: 0.6, h: 0.5, glyph: 'HP', point: true },
    { type: 'caisson_basse', label: 'Caisson de basse (sub)', w: 0.7, h: 0.8, glyph: 'SUB' },
    { type: 'line_array', label: 'Line array / accroche', w: 1.2, h: 1.2, glyph: 'LA' },
    { type: 'retour_scene', label: 'Retour de scène (wedge)', w: 0.6, h: 0.5, glyph: 'RT', point: true },
    { type: 'console_audio', label: 'Console de mixage 2×1 m', w: 2, h: 1, glyph: 'MX' },
    { type: 'platine_dj', label: 'Régie DJ 2×1 m', w: 2, h: 1, glyph: 'DJ' },
    { type: 'micro', label: 'Position micro', w: 0.2, h: 0.2, glyph: 'M', point: true },
    { type: 'ampli', label: 'Rack ampli', w: 0.6, h: 0.8, glyph: 'AR', point: true },
  ],
  lumiere: [
    { type: 'projecteur', label: 'Projecteur', w: 0.4, h: 0.4, glyph: 'PR', point: true },
    { type: 'par_led', label: 'PAR LED', w: 0.3, h: 0.3, glyph: 'PAR', point: true },
    { type: 'lyre', label: 'Lyre / moving head', w: 0.4, h: 0.4, glyph: 'LY', point: true },
    { type: 'barre_led', label: 'Barre LED 1 m', w: 1, h: 0.2, glyph: 'BL' },
    { type: 'machine_fumee', label: 'Machine à fumée', w: 0.4, h: 0.3, glyph: 'FU', point: true },
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
    { type: 'panneau_evac', label: "Panneau d'évacuation", w: 0.3, h: 0.1, glyph: 'EV', point: true },
    { type: 'bloc_secours', label: 'Éclairage de secours (BAES)', w: 0.3, h: 0.2, glyph: 'BS', point: true },
    { type: 'point_controle', label: "Point de contrôle / d'accès", w: 0.3, h: 0.3, glyph: 'CT', point: true },
  ],
}

export const LINE_CATALOG: Record<Discipline, LineDef[]> = {
  implantation: [
    { type: 'passage', label: 'Passage / circulation', dashed: true },
    { type: 'limite', label: 'Limite interne', dashed: true },
  ],
  electricite: [
    { type: 'cable_elec', label: 'Câble électrique', sectionable: true, specs: ELEC_SPECS },
    // Remplacé par « Câble électrique » + calibre (TRI 32A, POWERLOCK…)
    { type: 'cable_tri', label: 'Câble triphasé', sectionable: true, legacy: true },
    { type: 'passage_cable', label: 'Passage de câbles protégé', dashed: true },
  ],
  eau: [
    { type: 'tuyau_eau', label: "Tuyau d'alimentation", sectionable: true },
    { type: 'evacuation_ligne', label: "Ligne d'évacuation", dashed: true, sectionable: true },
  ],
  reseau: [
    { type: 'cable_rj45', label: 'Câble RJ45', sectionable: true, specs: RJ45_SPECS },
    { type: 'fibre', label: 'Fibre optique', sectionable: true },
    { type: 'vlan', label: 'Liaison VLAN / logique', dashed: true },
  ],
  video: [
    { type: 'cable_sdi', label: 'Câble SDI', sectionable: true },
    { type: 'cable_hdmi', label: 'Câble HDMI', sectionable: true },
    { type: 'fibre_video', label: 'Fibre vidéo', sectionable: true },
  ],
  audio: [
    { type: 'multipaire', label: 'Multipaire / snake', sectionable: true },
    { type: 'cable_hp', label: 'Câble HP', sectionable: true },
    { type: 'cable_xlr', label: 'Câble micro (XLR)', sectionable: true },
  ],
  lumiere: [
    { type: 'cable_dmx', label: 'Câble DMX', sectionable: true },
    { type: 'cable_lumiere', label: 'Câble puissance lumière', sectionable: true },
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

export interface ObjectView {
  label: string
  glyph: string
  color: string
  isPoint: boolean
}

/** Choix complet issu du sélecteur d'objets (catalogue, spec ou modèle perso). */
export interface PlacePayload {
  layer: Discipline
  symbolType: string
  typeLabel: string
  glyph: string
  color?: string
  w: number
  h: number
  point: boolean
  spec?: string
  /** true si issu d'un modèle personnalisé : l'apparence est figée sur l'objet. */
  custom?: boolean
}

/**
 * Apparence effective d'un objet placé : personnalisations stockées sur
 * l'objet (couleur, initiales, nom de type — notamment pour les modèles
 * personnalisés), puis catalogue, puis valeurs du calque.
 */
export function objectView(o: SiteObject): ObjectView {
  const def = findObjectDef(o.layer, o.symbolType)
  return {
    label: o.typeLabel ?? def?.label ?? o.symbolType,
    glyph: o.glyph ?? def?.glyph ?? '?',
    color: o.color ?? DISCIPLINE_COLORS[o.layer],
    isPoint: o.isPoint ?? def?.point ?? false,
  }
}
