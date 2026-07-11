export type Discipline =
  | 'implantation'
  | 'structures'
  | 'electricite'
  | 'eau'
  | 'reseau'
  | 'video'
  | 'audio'
  | 'lumiere'
  | 'securite'

export const DISCIPLINES: Discipline[] = [
  'implantation',
  'structures',
  'electricite',
  'eau',
  'reseau',
  'video',
  'audio',
  'lumiere',
  'securite',
]

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  implantation: 'Implantation',
  structures: 'Structures',
  electricite: 'Électricité',
  eau: 'Eau / Plomberie',
  reseau: 'Réseau',
  video: 'Vidéo',
  audio: 'Audio',
  lumiere: 'Lumière',
  securite: 'Sécurité',
}

export const DISCIPLINE_COLORS: Record<Discipline, string> = {
  implantation: '#e2e8f0',
  structures: '#a3e635',
  electricite: '#f59e0b',
  eau: '#38bdf8',
  reseau: '#818cf8',
  video: '#d946ef',
  audio: '#34d399',
  lumiere: '#fb7185',
  securite: '#ef4444',
}

export type PointCategory =
  | 'acces'
  | 'alimentation_electrique'
  | 'eau'
  | 'reseau'
  | 'contrainte'
  | 'stockage'
  | 'scene'
  | 'securite'
  | 'autre'

export const POINT_CATEGORY_LABELS: Record<PointCategory, string> = {
  acces: 'Accès / livraison',
  alimentation_electrique: 'Alimentation électrique',
  eau: 'Point d\'eau',
  reseau: 'Réseau / Internet',
  contrainte: 'Contrainte technique',
  stockage: 'Stockage',
  scene: 'Scène / zone technique',
  securite: 'Sécurité / issue',
  autre: 'Autre',
}

export const POINT_CATEGORY_COLORS: Record<PointCategory, string> = {
  acces: '#f97316',
  alimentation_electrique: '#f59e0b',
  eau: '#38bdf8',
  reseau: '#a78bfa',
  contrainte: '#ef4444',
  stockage: '#8b5cf6',
  scene: '#ec4899',
  securite: '#dc2626',
  autre: '#64748b',
}

export interface LatLng {
  lat: number
  lng: number
}

export interface Project {
  id: string
  name: string
  client?: string
  eventDate?: string
  venueName?: string
  address?: string
  notes?: string
  /** Site boundary polygon drawn on the map (3+ vertices). */
  zone?: LatLng[]
  createdAt: number
  updatedAt: number
}

export interface GeoPoint {
  id: string
  projectId: string
  lat: number
  lng: number
  label: string
  category: PointCategory
  notes?: string
  photoIds: string[]
  createdAt: number
  updatedAt: number
}

export interface Photo {
  id: string
  blob: Blob
  mimeType: string
  caption?: string
  createdAt: number
}

/** Real-scale object placed on the site map (tent, power cabinet, bar…). */
export interface SiteObject {
  id: string
  projectId: string
  layer: Discipline
  symbolType: string
  center: LatLng
  /** Rotation in degrees, clockwise from north. */
  rotation: number
  /** Real-world footprint in meters. */
  widthM: number
  heightM: number
  label?: string
  notes?: string
  /** Overrides du catalogue, personnalisables par objet. */
  color?: string
  glyph?: string
  /** Snapshot du nom de type pour les modèles personnalisés (indépendant du catalogue). */
  typeLabel?: string
  isPoint?: boolean
  /** Spécification technique (ex : TRI 32A, Cat 6). */
  spec?: string
  /** Ordre d'empilement sur le plan (plus grand = dessus). */
  z?: number
  /** Puissance électrique consommée, en kW (bilan de puissance). */
  powerKw?: number
  /** Suivi de montage. */
  status?: InstallStatus
  createdAt: number
}

export type InstallStatus = 'todo' | 'done' | 'checked'

export const INSTALL_STATUS_LABELS: Record<InstallStatus, string> = {
  todo: 'À installer',
  done: 'Installé',
  checked: 'Vérifié',
}

/** Geo-referenced polyline: cable run, water pipe, barrier row, fence… */
export interface SiteLine {
  id: string
  projectId: string
  layer: Discipline
  lineType: string
  points: LatLng[]
  label?: string
  notes?: string
  /** Spécification technique (ex : TRI 63A, Cat 6a). */
  spec?: string
  /**
   * Extrémités aimantées : ids d'objets (armoire, stagebox…) auxquels le
   * premier / dernier point est ancré — ils suivent l'objet déplacé.
   */
  anchors?: { start?: string; end?: string }
  /** Suivi de montage. */
  status?: InstallStatus
  createdAt: number
}

/** Modèle d'objet personnalisé, global à l'application (banque de symboles). */
export interface CustomModel {
  id: string
  layer: Discipline
  name: string
  glyph: string
  color?: string
  w: number
  h: number
  point: boolean
  createdAt: number
}

export interface Calibration {
  p1: { x: number; y: number }
  p2: { x: number; y: number }
  realDistanceMeters: number
}

/** Superposition d'un plan importé sur le plan du site, géoréférencée. */
export interface PlanOverlay {
  visible: boolean
  center: LatLng
  /** Rotation en degrés, sens horaire depuis le nord. */
  rotation: number
  /** Largeur réelle de l'image sur le terrain, en mètres. */
  widthM: number
  /** 0 à 1. */
  opacity: number
}

export interface Plan {
  id: string
  projectId: string
  name: string
  photoId: string
  imageWidth: number
  imageHeight: number
  calibration: Calibration | null
  overlay?: PlanOverlay
  createdAt: number
  updatedAt: number
}

export interface PlanObject {
  id: string
  planId: string
  layer: Discipline
  symbolType: string
  x: number
  y: number
  rotation: number
  /** Real-world footprint in meters (rendered at scale once the plan is calibrated). */
  widthM?: number
  heightM?: number
  label?: string
  notes?: string
  createdAt: number
}

export interface PlanConnection {
  id: string
  planId: string
  layer: Discipline
  fromObjectId: string | null
  toObjectId: string | null
  points: { x: number; y: number }[]
  cableType?: string
  label?: string
  createdAt: number
}
