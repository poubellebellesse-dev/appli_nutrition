// engine/selection/scoring/nutri.ts — couche de score `nutri` (docs/ENGINE.md §6.5 tableau,
// précision 1).
//
// 1 − distance normalisée entre l'apport de la recette et LA CIBLE — jamais la consommation
// (précision 1 : pas de journal alimentaire, la cible est l'accumulateur du plan ou la part du
// créneau dans la référence journalière, résolue en amont par engine/nutrition/). Cette fonction
// ne calcule QUE la distance ; résoudre la cible est hors de son périmètre.
//
// Pour chaque nutriment dont `target[i] > 0`, l'écart dépend du SENS de ce nutriment
// (`NutrientSense`, engine/domain/catalog.ts — voir ce type pour le POURQUOI : un écart
// symétrique punit un dépassement de fer exactement comme un manque, ce qui est absurde) :
//  - `cible`    → `|recipe[i] - target[i]| / target[i]`             (les deux côtés pénalisent)
//  - `plancher` → `max(0, target[i] - recipe[i]) / target[i]`       (seul le manque pénalise)
//  - `plafond`  → `max(0, recipe[i] - target[i]) / target[i]`       (seul le dépassement pénalise)
// Écart clampé à 1 (un dépassement de 300% ne pénalise pas plus qu'un dépassement de 100%). Score
// = 1 − moyenne des écarts retenus. Nutriment à cible nulle ou absente : IGNORÉ, jamais compté
// comme un écart parfait (ce qui gonflerait artificiellement le score) ni comme un écart maximal.
// Aucun nutriment exploitable → NEUTRAL_SCORE (rien à comparer, ni bonus ni malus).
//
// `senses` est aligné sur le même index que `recipePerPortion`/`target` (l'ordre de
// `Catalog.nutrients` fixe l'index, §9.1 ENGINE). S'il est plus court que les vecteurs (défensif,
// ne devrait pas arriver), les index manquants sont traités comme `cible` — comportement
// symétrique d'origine, aucune régression silencieuse.
//
// Vecteurs de longueurs différentes (ne devrait pas arriver si tous proviennent du même
// `Catalog.nutrients`, mais défensif) : itère sur la longueur commune.
//
// Dépendances autorisées : domain/, ./index.js — §2/§3 ENGINE.

import type { NutrientSense, NutrientVector } from '../../domain/index.js'
import { NEUTRAL_SCORE, clamp01 } from './index.js'

function deviationFor(sens: NutrientSense, recipeValue: number, targetValue: number): number {
  const raw =
    sens === 'plancher'
      ? Math.max(0, targetValue - recipeValue) / targetValue
      : sens === 'plafond'
        ? Math.max(0, recipeValue - targetValue) / targetValue
        : Math.abs(recipeValue - targetValue) / targetValue

  return Math.min(raw, 1)
}

export function scoreNutri(
  recipePerPortion: NutrientVector,
  target: NutrientVector,
  senses: readonly NutrientSense[]
): number {
  const length = Math.min(recipePerPortion.length, target.length)

  let sumDeviation = 0
  let count = 0

  for (let i = 0; i < length; i++) {
    const targetValue = target[i]!
    if (targetValue <= 0) continue

    const recipeValue = recipePerPortion[i]!
    const sens = senses[i] ?? 'cible'
    sumDeviation += deviationFor(sens, recipeValue, targetValue)
    count++
  }

  if (count === 0) return NEUTRAL_SCORE

  return clamp01(1 - sumDeviation / count)
}
