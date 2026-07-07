import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'
import type { CustomModel, GeoPoint, Photo, Plan, PlanConnection, PlanObject, Project, SiteLine, SiteObject } from '../types'

interface BackupManifest {
  version: 1 | 2 | 3
  project: Project
  points: GeoPoint[]
  plans: Plan[]
  planObjects: PlanObject[]
  planConnections: PlanConnection[]
  /** Absent from v1 backups. */
  siteObjects?: SiteObject[]
  siteLines?: SiteLine[]
  /** Banque de modèles personnalisés (v3+), fusionnée à l'import. */
  customModels?: CustomModel[]
  photoIds: string[]
}

function extFromMime(mime: string) {
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  return 'jpg'
}

export async function exportProject(projectId: string) {
  const project = await db.projects.get(projectId)
  if (!project) throw new Error('Projet introuvable')
  const points = await db.points.where('projectId').equals(projectId).toArray()
  const plans = await db.plans.where('projectId').equals(projectId).toArray()
  const planObjects = (
    await Promise.all(plans.map((pl) => db.planObjects.where('planId').equals(pl.id).toArray()))
  ).flat()
  const planConnections = (
    await Promise.all(plans.map((pl) => db.planConnections.where('planId').equals(pl.id).toArray()))
  ).flat()
  const siteObjects = await db.siteObjects.where('projectId').equals(projectId).toArray()
  const siteLines = await db.siteLines.where('projectId').equals(projectId).toArray()
  const customModels = await db.customModels.toArray()

  const photoIds = new Set<string>()
  points.forEach((p) => p.photoIds.forEach((id) => photoIds.add(id)))
  plans.forEach((p) => photoIds.add(p.photoId))

  const zip = new JSZip()
  const photosFolder = zip.folder('photos')!
  const photoMeta: Record<string, string> = {}
  for (const id of photoIds) {
    const photo = await db.photos.get(id)
    if (!photo) continue
    const ext = extFromMime(photo.mimeType)
    photoMeta[id] = `${id}.${ext}`
    photosFolder.file(`${id}.${ext}`, photo.blob)
  }

  const manifest: BackupManifest = {
    version: 3,
    project,
    points,
    plans,
    planObjects,
    planConnections,
    siteObjects,
    siteLines,
    customModels,
    photoIds: [...photoIds],
  }
  zip.file('manifest.json', JSON.stringify({ ...manifest, photoFiles: photoMeta }, null, 2))

  const blob = await zip.generateAsync({ type: 'blob' })
  const filename = `reperage-${project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${Date.now()}.zip`
  saveAs(blob, filename)
}

export async function importProjectFromZip(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(file)
  const manifestFile = zip.file('manifest.json')
  if (!manifestFile) throw new Error('Fichier de sauvegarde invalide')
  const manifest: BackupManifest & { photoFiles: Record<string, string> } = JSON.parse(
    await manifestFile.async('string'),
  )

  const idMap = new Map<string, string>()
  const remap = (id: string) => {
    if (!idMap.has(id)) idMap.set(id, uuid())
    return idMap.get(id)!
  }

  const now = Date.now()
  const newProjectId = remap(manifest.project.id)

  // Import photos first, building old->new photo id map via remap too
  const photoIdRemap = new Map<string, string>()
  for (const oldPhotoId of manifest.photoIds) {
    const path = manifest.photoFiles[oldPhotoId]
    const zipEntry = path ? zip.file(`photos/${path}`) : null
    if (!zipEntry) continue
    const blob = await zipEntry.async('blob')
    const newPhotoId = uuid()
    photoIdRemap.set(oldPhotoId, newPhotoId)
    await db.photos.add({
      id: newPhotoId,
      blob,
      mimeType: blob.type || 'image/jpeg',
      createdAt: now,
    } as Photo)
  }

  const project: Project = {
    ...manifest.project,
    id: newProjectId,
    name: `${manifest.project.name} (importé)`,
    createdAt: now,
    updatedAt: now,
  }
  await db.projects.add(project)

  for (const point of manifest.points) {
    await db.points.add({
      ...point,
      id: remap(point.id),
      projectId: newProjectId,
      photoIds: point.photoIds.map((pid) => photoIdRemap.get(pid)).filter(Boolean) as string[],
    })
  }

  for (const plan of manifest.plans) {
    const newPhotoId = photoIdRemap.get(plan.photoId)
    if (!newPhotoId) continue
    await db.plans.add({
      ...plan,
      id: remap(plan.id),
      projectId: newProjectId,
      photoId: newPhotoId,
    })
  }

  for (const obj of manifest.planObjects) {
    await db.planObjects.add({
      ...obj,
      id: remap(obj.id),
      planId: remap(obj.planId),
    })
  }

  for (const conn of manifest.planConnections) {
    await db.planConnections.add({
      ...conn,
      id: remap(conn.id),
      planId: remap(conn.planId),
      fromObjectId: conn.fromObjectId ? remap(conn.fromObjectId) : null,
      toObjectId: conn.toObjectId ? remap(conn.toObjectId) : null,
    })
  }

  for (const obj of manifest.siteObjects ?? []) {
    await db.siteObjects.add({
      ...obj,
      id: remap(obj.id),
      projectId: newProjectId,
    })
  }

  for (const line of manifest.siteLines ?? []) {
    await db.siteLines.add({
      ...line,
      id: remap(line.id),
      projectId: newProjectId,
    })
  }

  // Merge the symbol bank without touching existing models — placed objects
  // reference models by id (symbolType `custom:{id}`), so ids are preserved.
  for (const model of manifest.customModels ?? []) {
    const existing = await db.customModels.get(model.id)
    if (!existing) await db.customModels.add(model)
  }

  return newProjectId
}
