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
  /** Épaisseur réelle du trait en mètres (murs, cloisons) — sinon épaisseur d'écran fixe. */
  thicknessM?: number
  /** Exclu du récap matériel (cotes, annotations). */
  noRecap?: boolean
}

export const HEIGHT_SPECS = ['H 2 m', 'H 3 m', 'H 4 m', 'H 6 m', 'H 8 m', 'H 10 m']

export const TRUSS_SPECS = ['H30V', 'H40V', 'S36R', 'F34', 'Autre série']

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

export const KVA_SPECS = ['20 kVA', '40 kVA', '60 kVA', '100 kVA', '200 kVA']

export const EXTINCTEUR_SPECS = ['Eau pulvérisée', 'CO2', 'Poudre ABC']

export const DMX_PORT_SPECS = ['2 sorties', '4 sorties', '8 sorties']

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
    { type: 'barnum_4x4', label: 'Barnum 4×4 m', w: 4, h: 4, glyph: 'BA' },
    { type: 'barnum_4x8', label: 'Barnum 4×8 m', w: 8, h: 4, glyph: 'BA' },
    { type: 'pagode_5x5', label: 'Pagode 5×5 m', w: 5, h: 5, glyph: 'PG' },
    { type: 'stand_marche', label: 'Stand marché 3×2 m', w: 3, h: 2, glyph: 'ST' },
    { type: 'tribune', label: 'Tribune 10×5 m', w: 10, h: 5, glyph: 'TR' },
    { type: 'mange_debout', label: 'Mange-debout', w: 0.8, h: 0.8, glyph: 'MD' },
    { type: 'billetterie', label: 'Billetterie / guichet 3×2 m', w: 3, h: 2, glyph: 'BI' },
    { type: 'arche_entree', label: "Arche d'entrée", w: 6, h: 0.5, glyph: 'AR' },
    { type: 'vestiaire', label: 'Vestiaire 3×3 m', w: 3, h: 3, glyph: 'VE' },
    { type: 'loge', label: 'Loge artiste 5×5 m', w: 5, h: 5, glyph: 'LO' },
    { type: 'catering', label: 'Catering 6×4 m', w: 6, h: 4, glyph: 'CA' },
    { type: 'remorque_frigo', label: 'Remorque frigorifique', w: 4, h: 2, glyph: 'FR' },
    { type: 'poubelle', label: 'Poubelle / tri', w: 0.6, h: 0.6, glyph: 'PB', point: true },
    { type: 'benne', label: 'Benne à déchets', w: 4, h: 2, glyph: 'BE' },
    { type: 'mat_drapeau', label: 'Mât / drapeau', w: 0.3, h: 0.3, glyph: 'DR', point: true },
    { type: 'objet_custom', label: 'Objet personnalisé', w: 1, h: 1, glyph: '?' },
  ],
  structures: [
    { type: 'praticable', label: 'Praticable 2×1 m', w: 2, h: 1, glyph: 'PR', specs: HEIGHT_SPECS },
    { type: 'tour_levage', label: 'Tour de levage', w: 1.4, h: 1.4, glyph: 'TL', specs: HEIGHT_SPECS },
    { type: 'echafaudage', label: 'Échafaudage module 2,5×1 m', w: 2.5, h: 1, glyph: 'EC', specs: HEIGHT_SPECS },
    { type: 'ground_support', label: 'Ground support 8×6 m', w: 8, h: 6, glyph: 'GS', specs: HEIGHT_SPECS },
    { type: 'scene_mobile', label: 'Scène mobile / remorque', w: 8, h: 6, glyph: 'SM' },
    { type: 'pied_levage', label: 'Pied de levage / wind-up', w: 0.6, h: 0.6, glyph: 'WU', specs: HEIGHT_SPECS },
    { type: 'moteur', label: 'Moteur / palan', w: 0.3, h: 0.3, glyph: 'MO', point: true },
    { type: 'embase', label: 'Embase / base plate', w: 0.8, h: 0.8, glyph: 'BP', point: true },
    { type: 'bloc_beton', label: 'Bloc béton / lest', w: 1.2, h: 0.6, glyph: 'BB' },
    { type: 'escalier', label: "Escalier d'accès scène", w: 1.2, h: 2, glyph: 'ES' },
    { type: 'rampe_pmr', label: 'Rampe PMR', w: 1.5, h: 6, glyph: 'PMR' },
    { type: 'tour_delai', label: 'Tour délai / régie son', w: 3, h: 3, glyph: 'TD', specs: HEIGHT_SPECS },
    { type: 'portique', label: "Portique d'entrée", w: 8, h: 1, glyph: 'PO', specs: HEIGHT_SPECS },
  ],
  electricite: [
    { type: 'armoire_electrique', label: 'Armoire électrique', w: 0.8, h: 0.6, glyph: 'AE', specs: ELEC_SPECS },
    { type: 'coffret', label: 'Coffret de distribution', w: 0.4, h: 0.3, glyph: 'C', point: true, specs: ELEC_SPECS },
    { type: 'groupe_electrogene', label: 'Groupe électrogène 2×1 m', w: 2, h: 1, glyph: 'GE', specs: KVA_SPECS },
    { type: 'transfo', label: 'Transformateur / poste', w: 2, h: 1.5, glyph: 'TF' },
    { type: 'coffret_forain', label: 'Coffret forain', w: 0.4, h: 0.4, glyph: 'CF', point: true, specs: ELEC_SPECS },
    { type: 'onduleur', label: 'Onduleur / UPS', w: 0.6, h: 0.8, glyph: 'UPS', point: true },
    { type: 'candelabre', label: 'Candélabre / mât éclairage', w: 0.4, h: 0.4, glyph: 'CD', point: true },
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
    { type: 'antenne_4g', label: 'Antenne 4G/5G / Starlink', w: 0.6, h: 0.6, glyph: '4G', point: true },
    { type: 'pont_wifi', label: 'Pont Wi-Fi point à point', w: 0.3, h: 0.3, glyph: 'PW', point: true },
    { type: 'intercom', label: 'Poste intercom', w: 0.2, h: 0.2, glyph: 'IC', point: true },
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
    { type: 'mur_images', label: "Mur d'images 6×3 m", w: 6, h: 0.5, glyph: 'MUR' },
    { type: 'prompteur', label: 'Prompteur / retour plateau', w: 0.6, h: 0.4, glyph: 'PT', point: true },
    { type: 'pied_camera', label: 'Pied caméra / trépied', w: 0.8, h: 0.8, glyph: 'TP', point: true },
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
    { type: 'stagebox', label: 'Stagebox / patch scène', w: 0.5, h: 0.4, glyph: 'SB', point: true },
    { type: 'stagebox_dante', label: 'Stagebox Dante / AES67', w: 0.5, h: 0.4, glyph: 'DNT', point: true },
    { type: 'stagebox_aes50', label: 'Stagebox AES50 (Midas/Behringer)', w: 0.5, h: 0.4, glyph: 'A50', point: true },
    { type: 'interface_madi', label: 'Interface MADI', w: 0.5, h: 0.4, glyph: 'MDI', point: true },
    { type: 'splitter_audio', label: 'Splitter micro / patch XLR', w: 0.5, h: 0.4, glyph: 'SPL', point: true },
    { type: 'di_box', label: 'Boîte de direct (DI)', w: 0.2, h: 0.2, glyph: 'DI', point: true },
    { type: 'micro_hf', label: 'Récepteur micro HF', w: 0.4, h: 0.3, glyph: 'HF', point: true },
    { type: 'pied_micro', label: 'Pied de micro', w: 0.3, h: 0.3, glyph: 'PM', point: true },
    { type: 'console_retour', label: 'Console retours 2×1 m', w: 2, h: 1, glyph: 'MON' },
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
    { type: 'node_artnet', label: 'Node ArtNet/sACN → DMX', w: 0.3, h: 0.2, glyph: 'ND', point: true, specs: DMX_PORT_SPECS },
    { type: 'splitter_dmx', label: 'Splitter / booster DMX', w: 0.3, h: 0.2, glyph: 'SPL', point: true, specs: DMX_PORT_SPECS },
    { type: 'pupitre_lumiere', label: 'Pupitre lumière', w: 1.2, h: 0.8, glyph: 'PU' },
    { type: 'poursuite', label: 'Poursuite', w: 1, h: 1, glyph: 'PS', point: true },
    { type: 'blinder', label: 'Blinder', w: 0.5, h: 0.3, glyph: 'BL', point: true },
    { type: 'strobe', label: 'Stroboscope', w: 0.4, h: 0.3, glyph: 'SR', point: true },
    { type: 'laser', label: 'Laser', w: 0.4, h: 0.4, glyph: 'LZ', point: true },
    { type: 'haze', label: 'Machine à brouillard (haze)', w: 0.5, h: 0.4, glyph: 'HZ', point: true },
    { type: 'contre', label: 'Rampe de contres', w: 2, h: 0.3, glyph: 'CTR' },
  ],
  securite: [
    { type: 'pc_securite', label: 'PC sécurité 3×3 m', w: 3, h: 3, glyph: 'PC' },
    { type: 'poste_secours', label: 'Poste de secours 3×3 m', w: 3, h: 3, glyph: '+' },
    { type: 'extincteur', label: 'Extincteur', w: 0.2, h: 0.2, glyph: 'EX', point: true, specs: EXTINCTEUR_SPECS },
    { type: 'issue_secours', label: 'Issue / sortie de secours', w: 0.3, h: 0.3, glyph: 'IS', point: true },
    { type: 'panneau_evac', label: "Panneau d'évacuation", w: 0.3, h: 0.1, glyph: 'EV', point: true },
    { type: 'bloc_secours', label: 'Éclairage de secours (BAES)', w: 0.3, h: 0.2, glyph: 'BS', point: true },
    { type: 'point_controle', label: "Point de contrôle / d'accès", w: 0.3, h: 0.3, glyph: 'CT', point: true },
    { type: 'ria', label: 'RIA / point incendie', w: 0.4, h: 0.4, glyph: 'RIA', point: true },
    { type: 'defibrillateur', label: 'Défibrillateur (DAE)', w: 0.2, h: 0.2, glyph: 'DAE', point: true },
    { type: 'chicane', label: 'Chicane anti-véhicule', w: 2, h: 1, glyph: 'CH' },
    { type: 'bloc_beton_secu', label: 'Bloc béton anti-intrusion', w: 1.2, h: 0.6, glyph: 'BB' },
    { type: 'talkie', label: 'Point talkie / radio', w: 0.2, h: 0.2, glyph: 'TK', point: true },
  ],
}

export const LINE_CATALOG: Record<Discipline, LineDef[]> = {
  implantation: [
    { type: 'mur', label: 'Mur / cloison', thicknessM: 0.25 },
    { type: 'cote', label: 'Cote / mesure', dashed: true, noRecap: true },
    { type: 'passage', label: 'Passage / circulation', dashed: true },
    { type: 'limite', label: 'Limite interne', dashed: true },
  ],
  structures: [
    { type: 'truss', label: 'Pont / truss (élts 2 m)', unitLengthM: 2, specs: TRUSS_SPECS },
    { type: 'echafaudage_ligne', label: 'Échafaudage en ligne (2,5 m)', unitLengthM: 2.5, specs: HEIGHT_SPECS },
    { type: 'garde_corps', label: 'Garde-corps (2 m)', unitLengthM: 2 },
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
    { type: 'cable_dante', label: 'Réseau Dante / AES67 (Cat)', sectionable: true, specs: RJ45_SPECS },
    { type: 'cable_aes50', label: 'Liaison AES50 (Cat 5e)', sectionable: true },
    { type: 'cable_aes', label: 'AES/EBU numérique (110 Ω)', sectionable: true },
    { type: 'cable_madi', label: 'MADI (coax / fibre)', sectionable: true },
  ],
  lumiere: [
    { type: 'cable_dmx', label: 'Câble DMX', sectionable: true },
    { type: 'cable_lumiere', label: 'Câble puissance lumière', sectionable: true },
    { type: 'cable_artnet', label: 'Réseau ArtNet/sACN (Cat)', sectionable: true, specs: RJ45_SPECS },
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

// ---------------------------------------------------------------------------
// Distribution : départs de câble proposés par objet (assistant de câblage)
// ---------------------------------------------------------------------------

/** Départ de câble proposé depuis un objet (armoire, stagebox, node…). */
export interface DistOption {
  /** Libellé court affiché sur le bouton : « 2× TRI 63A », « DMX (4 sorties) ». */
  label: string
  layer: Discipline
  lineType: string
  spec?: string
}

/**
 * Répartition électrique usuelle en événementiel : ce que l'on retire d'une
 * armoire / d'un coffret selon son calibre d'arrivée (distros du commerce).
 */
const ELEC_DISTRIBUTION: Record<string, { spec: string; count: number }[]> = {
  'POWERLOCK 400A': [
    { spec: 'POWERLOCK 250A', count: 2 },
    { spec: 'TRI 125A', count: 3 },
  ],
  'POWERLOCK 250A': [
    { spec: 'TRI 125A', count: 2 },
    { spec: 'TRI 63A', count: 2 },
  ],
  'TRI 125A': [
    { spec: 'TRI 63A', count: 2 },
    { spec: 'TRI 32A', count: 4 },
  ],
  'TRI 63A': [
    { spec: 'TRI 32A', count: 2 },
    { spec: 'MONO 16A', count: 12 },
  ],
  'TRI 32A': [
    { spec: 'TRI 16A', count: 2 },
    { spec: 'MONO 16A', count: 6 },
  ],
  'TRI 16A': [{ spec: 'MONO 16A', count: 3 }],
  'MONO 32A': [{ spec: 'MONO 16A', count: 2 }],
}

/** Sorties usuelles d'un groupe électrogène selon sa puissance (≈ 1,44 A/kVA en 400 V tri). */
const KVA_OUTPUTS: Record<string, { spec: string; count: number }[]> = {
  '20 kVA': [
    { spec: 'TRI 32A', count: 1 },
    { spec: 'MONO 16A', count: 2 },
  ],
  '40 kVA': [
    { spec: 'TRI 63A', count: 1 },
    { spec: 'TRI 32A', count: 1 },
  ],
  '60 kVA': [
    { spec: 'TRI 63A', count: 1 },
    { spec: 'TRI 32A', count: 2 },
  ],
  '100 kVA': [
    { spec: 'TRI 125A', count: 1 },
    { spec: 'TRI 63A', count: 1 },
  ],
  '200 kVA': [
    { spec: 'POWERLOCK 250A', count: 1 },
    { spec: 'TRI 125A', count: 1 },
  ],
}

/**
 * Départs de câble proposés pour un objet placé, selon son type et son calibre.
 * Chaque conversion du métier est rattachée à l'objet qui la réalise :
 * élec (armoires/coffrets/groupes → calibres inférieurs), son (stagebox
 * Dante → XLR, AES50, MADI, splitter AES), lumière (node ArtNet → DMX),
 * réseau et vidéo.
 */
export function objectOutputs(o: SiteObject): DistOption[] {
  const opt = (layer: Discipline, lineType: string, label: string, spec?: string): DistOption => ({
    layer,
    lineType,
    label,
    spec,
  })
  const elec = (x: { spec: string; count: number }) =>
    opt('electricite', 'cable_elec', `${x.count}× ${x.spec}`, x.spec)
  const t = o.symbolType

  switch (o.layer) {
    case 'electricite':
      if (t === 'armoire_electrique' || t === 'coffret' || t === 'coffret_forain') {
        return (o.spec ? ELEC_DISTRIBUTION[o.spec] ?? [] : []).map(elec)
      }
      if (t === 'groupe_electrogene') {
        return ((o.spec ? KVA_OUTPUTS[o.spec] : undefined) ?? [{ spec: 'TRI 63A', count: 1 }]).map(elec)
      }
      if (t === 'transfo') return [elec({ spec: 'POWERLOCK 400A', count: 1 }), elec({ spec: 'TRI 125A', count: 1 })]
      if (t === 'onduleur') return [elec({ spec: 'MONO 16A', count: 2 })]
      return []
    case 'audio':
      switch (t) {
        case 'stagebox_dante':
          return [
            opt('audio', 'cable_dante', 'Dante / AES67 (Cat)'),
            opt('audio', 'cable_xlr', 'Modulation XLR'),
          ]
        case 'stagebox_aes50':
          return [opt('audio', 'cable_aes50', 'AES50 (Cat 5e)'), opt('audio', 'cable_xlr', 'Modulation XLR')]
        case 'interface_madi':
          return [
            opt('audio', 'cable_madi', 'MADI (coax/fibre)'),
            opt('audio', 'cable_dante', 'Dante / AES67 (Cat)'),
            opt('audio', 'cable_xlr', 'Modulation XLR'),
          ]
        case 'splitter_audio':
          return [opt('audio', 'cable_xlr', 'XLR (splits)'), opt('audio', 'cable_aes', 'AES/EBU 110 Ω')]
        case 'stagebox':
          return [opt('audio', 'multipaire', 'Multipaire'), opt('audio', 'cable_xlr', 'Modulation XLR')]
        case 'console_audio':
        case 'console_retour':
          return [
            opt('audio', 'cable_dante', 'Dante / AES67 (Cat)'),
            opt('audio', 'cable_aes50', 'AES50 (Cat 5e)'),
            opt('audio', 'cable_madi', 'MADI (coax/fibre)'),
            opt('audio', 'multipaire', 'Multipaire'),
          ]
        case 'ampli':
          return [opt('audio', 'cable_hp', 'Câble HP')]
        default:
          return []
      }
    case 'lumiere':
      switch (t) {
        case 'node_artnet':
          return [
            opt('lumiere', 'cable_dmx', `DMX (${o.spec ?? 'sorties'})`),
            opt('lumiere', 'cable_artnet', 'ArtNet/sACN (Cat)'),
          ]
        case 'splitter_dmx':
          return [opt('lumiere', 'cable_dmx', `DMX (${o.spec ?? 'sorties'})`)]
        case 'gradateur':
          return [opt('lumiere', 'cable_lumiere', 'Puissance lumière'), opt('lumiere', 'cable_dmx', 'DMX')]
        case 'pupitre_lumiere':
          return [opt('lumiere', 'cable_artnet', 'ArtNet/sACN (Cat)'), opt('lumiere', 'cable_dmx', 'DMX')]
        default:
          return []
      }
    case 'reseau':
      if (t === 'switch' || t === 'routeur' || t === 'baie_brassage') {
        return [opt('reseau', 'cable_rj45', 'RJ45'), opt('reseau', 'fibre', 'Fibre optique')]
      }
      if (t === 'point_fibre' || t === 'convertisseur_fibre') return [opt('reseau', 'fibre', 'Fibre optique')]
      return []
    case 'video':
      if (t === 'melangeur' || t === 'regie_video') {
        return [
          opt('video', 'cable_sdi', 'SDI'),
          opt('video', 'cable_hdmi', 'HDMI'),
          opt('video', 'fibre_video', 'Fibre vidéo'),
        ]
      }
      return []
    default:
      return []
  }
}
