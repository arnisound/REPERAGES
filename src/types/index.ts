export type Discipline = 'implantation' | 'electricite' | 'eau' | 'audio' | 'lumiere' | 'securite'

export const DISCIPLINES: Discipline[] = ['implantation', 'electricite', 'eau', 'audio', 'lumiere', 'securite']

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  implantation: 'Implantation',
  electricite: 'Électricité',
  eau: 'Eau / Plomberie',
  audio: 'Audio',
  lumiere: 'Lumière',
  securite: 'Sécurité',
}

export const DISCIPLINE_COLORS: Record<Discipline, string> = {
  implantation: '#e2e8f0',
  electricite: '#f59e0b',
  eau: '#38bdf8',
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
  createdAt: number
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
  createdAt: number
}

export interface Calibration {
  p1: { x: number; y: number }
  p2: { x: number; y: number }
  realDistanceMeters: number
}

export interface Plan {
  id: string
  projectId: string
  name: string
  photoId: string
  imageWidth: number
  imageHeight: number
  calibration: Calibration | null
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
