// engine/selection/scoring/nutri.ts — couche de score `nutri` (docs/ENGINE.md §6.5 tableau,
// précision 1).
//
// 1 − distance normalisée entre l'apport de la recette et LA CIBLE — jamais la consommation
// (précision 1 : pas de journal alimentaire, la cible est l'accumulateur du plan ou la part du
// créneau dans la référence journalière, résolue en amont par engine/nutrition/). Cette fonction
// ne calcule QUE la distance ; résoudre la cible est hors de son périmètre.
//
// Pour chaque nutriment dont `target[i] > 0` : écart relatif `|recipe[i] - target[i]| / target[i]`,
// clampé à 1 (un dépassement de 300% ne pénalise pas plus qu'un dépassement de 100%). Score =
// 1 − moyenne des écarts retenus. Nutriment à cible nulle ou absente : IGNORÉ, jamais compté comme
// un écart parfait (ce qui gonflerait artificiellement le score) ni comme un écart maximal.
// Aucun nutriment exploitable → NEUTRAL_SCORE (rien à comparer, ni bonus ni malus).
//
// Vecteurs de longueurs différentes (ne devrait pas arriver si les deux proviennent du même
// `Catalog.nutrients`, mais défensif) : itère sur la longueur commune.
//
// Dépendances autorisées : domain/, ./index.js — §2/§3 ENGINE.

import type { NutrientVector } from '../../domain/index.js'
import { NEUTRAL_SCORE, clamp01 } from './index.js'

export function scoreNutri(recipePerPortion: NutrientVector, target: NutrientVector): number {
  const length = Math.min(recipePerPortion.length, target.length)

  let sumDeviation = 0
  let count = 0

  for (let i = 0; i < length; i++) {
    const targetValue = target[i]!
    if (targetValue <= 0) continue

    const recipeValue = recipePerPortion[i]!
    const deviation = Math.min(Math.abs(recipeValue - targetValue) / targetValue, 1)
    sumDeviation += deviation
    count++
  }

  if (count === 0) return NEUTRAL_SCORE

  return clamp01(1 - sumDeviation / count)
}
