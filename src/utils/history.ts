/**
 * Historique annuler/rétablir du plan.
 *
 * Les mutations des tables siteObjects/siteLines sont capturées via les hooks
 * Dexie, quel que soit l'endroit du code qui les déclenche. Les opérations
 * rapprochées dans le temps forment un seul lot (déplacement de groupe,
 * duplication multiple), et les mises à jour successives d'un même
 * enregistrement sont fusionnées (glissement d'un curseur de rotation).
 */
import type { Table } from 'dexie'
import type { ReperagesDB } from '../db/db'

interface TrackedOp {
  undo: () => Promise<unknown>
  redo: () => Promise<unknown>
  /** Signature de fusion pour les updates successifs du même enregistrement. */
  sig?: string
}

interface Batch {
  ops: TrackedOp[]
  at: number
}

const BATCH_MS = 500
const COALESCE_MS = 1500
const MAX_HISTORY = 100

let recording = true
let applying = false
const undoStack: Batch[] = []
const redoStack: Batch[] = []
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

function push(op: TrackedOp) {
  if (!recording || applying) return
  const now = Date.now()
  const last = undoStack[undoStack.length - 1]
  if (last && op.sig && now - last.at < COALESCE_MS) {
    // Curseur qui glisse : on remplace le "redo" en gardant l'état d'origine.
    const prev = last.ops[last.ops.length - 1]
    if (prev?.sig === op.sig) {
      prev.redo = op.redo
      last.at = now
      redoStack.length = 0
      notify()
      return
    }
  }
  if (last && now - last.at < BATCH_MS) {
    last.ops.push(op)
    last.at = now
  } else {
    undoStack.push({ ops: [op], at: now })
    if (undoStack.length > MAX_HISTORY) undoStack.shift()
  }
  redoStack.length = 0
  notify()
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function track(table: Table<any, string>) {
  table.hook('creating', function (primKey: string, obj: any) {
    const pk = primKey ?? obj.id
    const snapshot = structuredClone(obj)
    push({
      sig: undefined,
      undo: () => table.delete(pk),
      redo: () => table.add(snapshot),
    })
  })
  table.hook('updating', function (mods: any, primKey: string, obj: any) {
    const before: Record<string, unknown> = {}
    for (const key of Object.keys(mods)) before[key] = structuredClone(obj[key])
    const after = structuredClone(mods)
    push({
      sig: `u:${table.name}:${primKey}:${Object.keys(mods).sort().join(',')}`,
      undo: () => table.update(primKey, before),
      redo: () => table.update(primKey, after),
    })
  })
  table.hook('deleting', function (primKey: string, obj: any) {
    const snapshot = structuredClone(obj)
    push({
      sig: undefined,
      undo: () => table.add(snapshot),
      redo: () => table.delete(primKey),
    })
  })
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function installHistory(db: ReperagesDB) {
  track(db.siteObjects)
  track(db.siteLines)
}

/** Exécute `fn` sans enregistrer dans l'historique (imports, purges en cascade). */
export async function withoutHistory<T>(fn: () => Promise<T>): Promise<T> {
  recording = false
  try {
    return await fn()
  } finally {
    recording = true
  }
}

export function canUndo() {
  return undoStack.length > 0
}

export function canRedo() {
  return redoStack.length > 0
}

export async function undo() {
  const batch = undoStack.pop()
  if (!batch) return
  applying = true
  try {
    for (const op of [...batch.ops].reverse()) await op.undo()
  } finally {
    applying = false
  }
  redoStack.push(batch)
  notify()
}

export async function redo() {
  const batch = redoStack.pop()
  if (!batch) return
  applying = true
  try {
    for (const op of batch.ops) await op.redo()
  } finally {
    applying = false
  }
  undoStack.push(batch)
  notify()
}

export function clearHistory() {
  undoStack.length = 0
  redoStack.length = 0
  notify()
}

export function subscribeHistory(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
