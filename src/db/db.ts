import Dexie, { type EntityTable } from 'dexie'
import type { GeoPoint, Photo, Plan, PlanConnection, PlanObject, Project } from '../types'

export class ReperagesDB extends Dexie {
  projects!: EntityTable<Project, 'id'>
  points!: EntityTable<GeoPoint, 'id'>
  photos!: EntityTable<Photo, 'id'>
  plans!: EntityTable<Plan, 'id'>
  planObjects!: EntityTable<PlanObject, 'id'>
  planConnections!: EntityTable<PlanConnection, 'id'>

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
  }
}

export const db = new ReperagesDB()
