import Dexie, { type EntityTable } from 'dexie'
import type {
  CustomModel,
  GeoPoint,
  Photo,
  Plan,
  PlanConnection,
  PlanObject,
  Project,
  SiteLine,
  SiteObject,
} from '../types'

/** v1 layer names that were renamed/merged into the v2 discipline set. */
const LAYER_MIGRATION: Record<string, string> = {
  plomberie: 'eau',
  reseau: 'electricite',
}

export class ReperagesDB extends Dexie {
  projects!: EntityTable<Project, 'id'>
  points!: EntityTable<GeoPoint, 'id'>
  photos!: EntityTable<Photo, 'id'>
  plans!: EntityTable<Plan, 'id'>
  planObjects!: EntityTable<PlanObject, 'id'>
  planConnections!: EntityTable<PlanConnection, 'id'>
  siteObjects!: EntityTable<SiteObject, 'id'>
  siteLines!: EntityTable<SiteLine, 'id'>
  customModels!: EntityTable<CustomModel, 'id'>

  constructor() {
    super('reperages-db')
    this.version(1).stores({
      projects: 'id, name, updatedAt',
      points: 'id, projectId, category, updatedAt',
      photos: 'id, createdAt',
      plans: 'id, projectId, updatedAt',
      planObjects: 'id, planId, layer',
      planConnections: 'id, planId, layer',
    })
    this.version(2)
      .stores({
        projects: 'id, name, updatedAt',
        points: 'id, projectId, category, updatedAt',
        photos: 'id, createdAt',
        plans: 'id, projectId, updatedAt',
        planObjects: 'id, planId, layer',
        planConnections: 'id, planId, layer',
        siteObjects: 'id, projectId, layer',
        siteLines: 'id, projectId, layer',
      })
      .upgrade(async (tx) => {
        await tx
          .table('planObjects')
          .toCollection()
          .modify((obj) => {
            if (LAYER_MIGRATION[obj.layer]) obj.layer = LAYER_MIGRATION[obj.layer]
          })
        await tx
          .table('planConnections')
          .toCollection()
          .modify((conn) => {
            if (LAYER_MIGRATION[conn.layer]) conn.layer = LAYER_MIGRATION[conn.layer]
          })
      })
    this.version(3).stores({
      projects: 'id, name, updatedAt',
      points: 'id, projectId, category, updatedAt',
      photos: 'id, createdAt',
      plans: 'id, projectId, updatedAt',
      planObjects: 'id, planId, layer',
      planConnections: 'id, planId, layer',
      siteObjects: 'id, projectId, layer',
      siteLines: 'id, projectId, layer',
      customModels: 'id, layer, name',
    })
  }
}

export const db = new ReperagesDB()
