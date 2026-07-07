import { v4 as uuid } from 'uuid'
import { db } from './db'
import { offsetLatLng } from '../utils/geo'
import type {
  Calibration,
  CustomModel,
  Discipline,
  GeoPoint,
  LatLng,
  Photo,
  Plan,
  PlanConnection,
  PlanObject,
  PointCategory,
  Project,
  SiteLine,
  SiteObject,
} from '../types'

// ---- Projects ----

export async function createProject(data: {
  name: string
  client?: string
  eventDate?: string
  venueName?: string
  address?: string
  notes?: string
}): Promise<Project> {
  const now = Date.now()
  const project: Project = { id: uuid(), createdAt: now, updatedAt: now, ...data }
  await db.projects.add(project)
  return project
}

export async function updateProject(id: string, patch: Partial<Project>) {
  await db.projects.update(id, { ...patch, updatedAt: Date.now() })
}

export async function deleteProject(id: string) {
  const points = await db.points.where('projectId').equals(id).toArray()
  const plans = await db.plans.where('projectId').equals(id).toArray()
  const photoIds = new Set<string>()
  points.forEach((p) => p.photoIds.forEach((pid) => photoIds.add(pid)))
  for (const plan of plans) {
    photoIds.add(plan.photoId)
    await db.planObjects.where('planId').equals(plan.id).delete()
    await db.planConnections.where('planId').equals(plan.id).delete()
  }
  await db.transaction('rw', [db.projects, db.points, db.plans, db.photos, db.siteObjects, db.siteLines], async () => {
    await db.points.where('projectId').equals(id).delete()
    await db.plans.where('projectId').equals(id).delete()
    await db.siteObjects.where('projectId').equals(id).delete()
    await db.siteLines.where('projectId').equals(id).delete()
    if (photoIds.size) await db.photos.bulkDelete([...photoIds])
    await db.projects.delete(id)
  })
}

export async function setProjectZone(id: string, zone: LatLng[] | undefined) {
  await db.projects.update(id, { zone, updatedAt: Date.now() })
}

// ---- Site objects (objets à l'échelle sur la carte) ----

export async function addSiteObject(data: {
  projectId: string
  layer: Discipline
  symbolType: string
  center: LatLng
  widthM: number
  heightM: number
  label?: string
  color?: string
  glyph?: string
  typeLabel?: string
  isPoint?: boolean
  spec?: string
}): Promise<SiteObject> {
  const obj: SiteObject = { id: uuid(), rotation: 0, createdAt: Date.now(), ...data }
  await db.siteObjects.add(obj)
  return obj
}

export async function updateSiteObject(id: string, patch: Partial<SiteObject>) {
  await db.siteObjects.update(id, patch)
}

export async function deleteSiteObject(id: string) {
  await db.siteObjects.delete(id)
}

/** Clone an object next to the original (2 m south-east). */
export async function duplicateSiteObject(id: string): Promise<SiteObject | undefined> {
  const obj = await db.siteObjects.get(id)
  if (!obj) return undefined
  const copy: SiteObject = {
    ...obj,
    id: uuid(),
    center: offsetLatLng(obj.center, 2, -2),
    createdAt: Date.now(),
  }
  await db.siteObjects.add(copy)
  return copy
}

// ---- Site lines (câbles, barrières, tuyaux…) ----

export async function addSiteLine(data: {
  projectId: string
  layer: Discipline
  lineType: string
  points: LatLng[]
  label?: string
  spec?: string
}): Promise<SiteLine> {
  const line: SiteLine = { id: uuid(), createdAt: Date.now(), ...data }
  await db.siteLines.add(line)
  return line
}

export async function updateSiteLine(id: string, patch: Partial<SiteLine>) {
  await db.siteLines.update(id, patch)
}

export async function deleteSiteLine(id: string) {
  await db.siteLines.delete(id)
}

// ---- Custom models (banque de symboles, globale à l'application) ----

export async function addCustomModel(data: {
  layer: Discipline
  name: string
  glyph: string
  color?: string
  w: number
  h: number
  point: boolean
}): Promise<CustomModel> {
  const model: CustomModel = { id: uuid(), createdAt: Date.now(), ...data }
  await db.customModels.add(model)
  return model
}

export async function deleteCustomModel(id: string) {
  await db.customModels.delete(id)
}

/** Clone a line next to the original (2 m south-east). */
export async function duplicateSiteLine(id: string): Promise<SiteLine | undefined> {
  const line = await db.siteLines.get(id)
  if (!line) return undefined
  const copy: SiteLine = {
    ...line,
    id: uuid(),
    points: line.points.map((p) => offsetLatLng(p, 2, -2)),
    createdAt: Date.now(),
  }
  await db.siteLines.add(copy)
  return copy
}

// ---- Photos ----

export async function addPhoto(blob: Blob, caption?: string): Promise<Photo> {
  const photo: Photo = { id: uuid(), blob, mimeType: blob.type || 'image/jpeg', caption, createdAt: Date.now() }
  await db.photos.add(photo)
  return photo
}

export async function deletePhoto(id: string) {
  await db.photos.delete(id)
}

// ---- Points (repères GPS) ----

export async function createPoint(data: {
  projectId: string
  lat: number
  lng: number
  label: string
  category: PointCategory
  notes?: string
}): Promise<GeoPoint> {
  const now = Date.now()
  const point: GeoPoint = { id: uuid(), photoIds: [], createdAt: now, updatedAt: now, ...data }
  await db.points.add(point)
  return point
}

export async function updatePoint(id: string, patch: Partial<GeoPoint>) {
  await db.points.update(id, { ...patch, updatedAt: Date.now() })
}

export async function deletePoint(id: string) {
  const point = await db.points.get(id)
  if (point) await db.photos.bulkDelete(point.photoIds)
  await db.points.delete(id)
}

export async function addPhotoToPoint(pointId: string, blob: Blob) {
  const photo = await addPhoto(blob)
  const point = await db.points.get(pointId)
  if (point) await updatePoint(pointId, { photoIds: [...point.photoIds, photo.id] })
  return photo
}

export async function removePhotoFromPoint(pointId: string, photoId: string) {
  const point = await db.points.get(pointId)
  if (point) await updatePoint(pointId, { photoIds: point.photoIds.filter((id) => id !== photoId) })
  await deletePhoto(photoId)
}

// ---- Plans ----

export async function createPlan(data: {
  projectId: string
  name: string
  photoId: string
  imageWidth: number
  imageHeight: number
}): Promise<Plan> {
  const now = Date.now()
  const plan: Plan = { id: uuid(), calibration: null, createdAt: now, updatedAt: now, ...data }
  await db.plans.add(plan)
  return plan
}

export async function updatePlan(id: string, patch: Partial<Plan>) {
  await db.plans.update(id, { ...patch, updatedAt: Date.now() })
}

export async function setPlanCalibration(id: string, calibration: Calibration) {
  await updatePlan(id, { calibration })
}

export async function deletePlan(id: string) {
  const plan = await db.plans.get(id)
  await db.transaction('rw', db.plans, db.planObjects, db.planConnections, db.photos, async () => {
    await db.planObjects.where('planId').equals(id).delete()
    await db.planConnections.where('planId').equals(id).delete()
    if (plan) await db.photos.delete(plan.photoId)
    await db.plans.delete(id)
  })
}

// ---- Plan objects ----

export async function addPlanObject(data: {
  planId: string
  layer: Discipline
  symbolType: string
  x: number
  y: number
  widthM?: number
  heightM?: number
  label?: string
}): Promise<PlanObject> {
  const obj: PlanObject = { id: uuid(), rotation: 0, createdAt: Date.now(), ...data }
  await db.planObjects.add(obj)
  return obj
}

export async function updatePlanObject(id: string, patch: Partial<PlanObject>) {
  await db.planObjects.update(id, patch)
}

export async function deletePlanObject(id: string) {
  await db.transaction('rw', db.planObjects, db.planConnections, async () => {
    await db.planObjects.delete(id)
    const conns = await db.planConnections
      .filter((c) => c.fromObjectId === id || c.toObjectId === id)
      .toArray()
    await db.planConnections.bulkDelete(conns.map((c) => c.id))
  })
}

// ---- Plan connections (cables/lines) ----

export async function addPlanConnection(data: {
  planId: string
  layer: Discipline
  fromObjectId: string | null
  toObjectId: string | null
  points: { x: number; y: number }[]
  cableType?: string
  label?: string
}): Promise<PlanConnection> {
  const conn: PlanConnection = { id: uuid(), createdAt: Date.now(), ...data }
  await db.planConnections.add(conn)
  return conn
}

export async function updatePlanConnection(id: string, patch: Partial<PlanConnection>) {
  await db.planConnections.update(id, patch)
}

export async function deletePlanConnection(id: string) {
  await db.planConnections.delete(id)
}
