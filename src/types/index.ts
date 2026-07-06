export type Discipline = 'electricite' | 'plomberie' | 'reseau' | 'audio' | 'lumiere'

export const DISCIPLINES: Discipline[] = ['electricite', 'plomberie', 'reseau', 'audio', 'lumiere']

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  electricite: 'Électricité',
  plomberie: 'Plomberie',
  reseau: 'Réseau',
  audio: 'Audio',
  lumiere: 'Lumière',
}

export const DISCIPLINE_COLORS: Record<Discipline, string> = {
  electricite: '#f59e0b',
  plomberie: '#38bdf8',
  reseau: '#a78bfa',
  audio: '#34d399',
  lumiere: '#fb7185',
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

export interface Project {
  id: string
  name: string
  client?: string
  eventDate?: string
  venueName?: string
  address?: string
  notes?: string
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
