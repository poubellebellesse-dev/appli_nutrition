// engine/nutrition/recipe-nutrients.ts — index dérivé `recipeNutrients` (docs/ENGINE.md §6.5
// précision 8, §9.1).
//
// Fonction PURE, appelée une fois à `createEngine(catalog)` via `attachDerivedIndexes` (§6.5
// précision 8) — jamais par catalog/build.mjs, pour ne pas coupler le script de build au moteur.
//
// Le vecteur stocké est PAR PORTION = aggregateRecipe(recipe, catalog) / recipe.portionsBase.
// Raison : c'est l'échelle que consomme le scoring (`nutri` compare une recette à la part d'un
// créneau dans la référence journalière, §6.5 précision 1) — stocker le total de la recette
// exposerait tout consommateur de l'index à une erreur d'échelle silencieuse (oublier de diviser
// par le nombre de portions avant de comparer à une cible par personne).
//
// `portionsBase <= 0` est traité comme 1 : purement défensif, ce cas ne doit pas se produire (le
// catalogue garantit `portionsBase >= 1`) — on préfère ignorer la division plutôt que de propager
// une division par zéro ou un vecteur au signe inversé.
//
// Dépendances autorisées : domain/, ./aggregation.js — §2/§3 ENGINE.

import type { Catalog, NutrientVector, RecipeId } from '../domain/index.js'
import { aggregateRecipe } from './aggregation.js'

export function computeRecipeNutrients(catalog: Catalog): ReadonlyMap<RecipeId, NutrientVector> {
  const result = new Map<RecipeId, NutrientVector>()

  for (const recipe of catalog.recipes.values()) {
    const total = aggregateRecipe(recipe, catalog)
    const portions = recipe.portionsBase > 0 ? recipe.portionsBase : 1

    const perPortion = new Float64Array(total.length)
    for (let i = 0; i < total.length; i++) perPortion[i] = total[i]! / portions

    result.set(recipe.id, perPortion)
  }

  return result
}
