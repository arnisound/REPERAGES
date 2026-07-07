/**
 * Découpe d'une longueur de câble/tuyau en tronçons du commerce.
 * Un tronçon ne peut pas être raccordé en plein milieu d'un besoin : chaque
 * tirage (run) est couvert indépendamment par des tronçons entiers.
 */

export interface SectionSize {
  length: number
  label: string
}

export const SECTION_SIZES: SectionSize[] = [
  { length: 5, label: '5 m' },
  { length: 10, label: '10 m' },
  { length: 15, label: '15 m' },
  { length: 20, label: '20 m' },
  { length: 25, label: '25 m' },
  { length: 50, label: '50 m' },
  { length: 100, label: 'Touret 100 m' },
]

export interface CutResult {
  /** Nombre de tronçons par taille (clé = longueur en m). */
  counts: Map<number, number>
  /** Longueur totale fournie par les tronçons. */
  supplied: number
}

/**
 * Couvre `length` mètres avec des tronçons entiers parmi les tailles
 * disponibles, en minimisant d'abord la chute puis le nombre de pièces
 * (programmation dynamique exacte, granularité 10 cm). Au-delà de 5 km le
 * gros du besoin est couvert en tourets de la plus grande taille avant le
 * calcul exact du reste.
 */
export function computeCuts(length: number, sizes: number[]): CutResult | null {
  if (!sizes.length || length <= 0) return null
  const largest = Math.max(...sizes)
  const counts = new Map<number, number>()
  let supplied = 0
  let remaining = length

  // Bulk coverage for very long runs keeps the DP table small.
  while (remaining > 5000) {
    counts.set(largest, (counts.get(largest) ?? 0) + 1)
    remaining -= largest
    supplied += largest
  }

  const unitSizes = sizes.map((s) => Math.round(s * 10))
  const target = Math.ceil(remaining * 10 - 1e-6)
  const maxSum = target + Math.max(...unitSizes)
  // best[sum] = nombre minimal de pièces totalisant exactement `sum` (en dm)
  const best = new Int32Array(maxSum + 1).fill(-1)
  const parent = new Int32Array(maxSum + 1).fill(-1)
  best[0] = 0
  for (let sum = 0; sum <= maxSum; sum++) {
    if (best[sum] < 0) continue
    for (const s of unitSizes) {
      const next = sum + s
      if (next > maxSum) continue
      if (best[next] < 0 || best[sum] + 1 < best[next]) {
        best[next] = best[sum] + 1
        parent[next] = s
      }
    }
  }
  let chosen = -1
  for (let sum = Math.max(target, 0); sum <= maxSum; sum++) {
    if (best[sum] >= 0) {
      chosen = sum
      break
    }
  }
  if (chosen < 0) return null
  supplied += chosen / 10
  for (let sum = chosen; sum > 0; sum -= parent[sum]) {
    const size = parent[sum] / 10
    counts.set(size, (counts.get(size) ?? 0) + 1)
  }
  return { counts, supplied }
}

/** Agrège les découpes de plusieurs tirages en un seul décompte. */
export function aggregateCuts(runLengths: number[], sizes: number[]): CutResult | null {
  if (!sizes.length) return null
  const counts = new Map<number, number>()
  let supplied = 0
  for (const run of runLengths) {
    const cut = computeCuts(run, sizes)
    if (!cut) continue
    for (const [size, n] of cut.counts) counts.set(size, (counts.get(size) ?? 0) + n)
    supplied += cut.supplied
  }
  return { counts, supplied }
}
