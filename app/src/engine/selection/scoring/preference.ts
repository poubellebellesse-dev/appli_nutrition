// engine/selection/scoring/preference.ts — couche de score `preference` (docs/ENGINE.md §6.5
// précision 4).
//
// Moyenne des préférences sur les ingrédients de la recette, PONDÉRÉE PAR `quantiteG` (optionnels
// inclus — cohérent avec `aggregateRecipe` du lot 2, qui les inclut aussi dans l'agrégat
// nutritionnel servi). Échelle des préférences : −2…+2, 0 = neutre, ABSENT = neutre (précision 4 /
// §6.5 tableau).
//
// Décision clé (déduite de « sans cas particulier codé, c'est une conséquence directe de la
// pondération ») : une préférence absente vaut 0 mais son ingrédient reste dans le DÉNOMINATEUR
// (`somme(quantités)` porte sur TOUS les ingrédients, pas seulement ceux à préférence connue).
// Sans cela, un ingrédient détesté minoritaire en poids pèserait identiquement qu'il soit principal
// ou garniture — exactement l'inverse de ce que la précision 4 demande. Avec cette pondération,
// c'est le POIDS RELATIF de l'ingrédient détesté dans la recette qui détermine l'impact : lourd
// (principal) → fort impact ; léger (garniture) → impact dilué par le reste de la recette.
//
// Agrégat saturé (clamp) : un seul ingrédient à +2 ne suffit pas à sauver un plat par ailleurs mal
// noté, conséquence directe de la moyenne pondérée (pas un cas particulier codé).
//
// Recette sans ingrédient → NEUTRAL_SCORE (dénominateur nul, rien à moyenner). Recette dont AUCUN
// ingrédient n'a de préférence connue → NEUTRAL_SCORE aussi, mais comme conséquence naturelle de la
// formule (moyenne pondérée de zéros = 0 = milieu de l'échelle −2…+2), pas un cas spécial codé.
//
// Dépendances autorisées : domain/, ./index.js — §2/§3 ENGINE.

import type { FoodId, Recipe } from '../../domain/index.js'
import { NEUTRAL_SCORE, clamp01 } from './index.js'

export function scorePreference(recipe: Recipe, preferences: ReadonlyMap<FoodId, number>): number {
  let weightedSum = 0
  let totalWeight = 0

  for (const ingredient of recipe.ingredients) {
    const pref = preferences.get(ingredient.foodId) ?? 0
    weightedSum += pref * ingredient.quantiteG
    totalWeight += ingredient.quantiteG
  }

  if (totalWeight === 0) return NEUTRAL_SCORE

  const avgPref = weightedSum / totalWeight // dans −2…+2 en théorie ; clampé plus bas malgré tout
  return clamp01((avgPref + 2) / 4)
}
