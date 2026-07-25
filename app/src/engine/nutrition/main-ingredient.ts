// engine/nutrition/main-ingredient.ts — index dérivé `recipeMainIngredient` (docs/ENGINE.md §6.5
// précisions 4 et 8, §9.1).
//
// Fonction PURE, appelée une fois à `createEngine(catalog)` via `attachDerivedIndexes` (§6.5
// précision 8). Sert de base à la couche de score `preference` (§6.5 précision 4, pondération par
// quantité) et à `variety` (précision 5, récence sur la recette ET son ingrédient principal) —
// ces couches sont implémentées en P2, pas ici.
//
// Définition (§6.5 précision 4) : l'ingrédient principal est le non-optionnel de plus forte
// `quantiteG` ; égalité stricte → tie-break déterministe par `foodId`, ordre lexicographique
// croissant (comparaison de chaîne standard, cohérente avec le brandage `FoodId` qui reste un
// `string` en runtime).
//
// Une recette SANS AUCUN ingrédient non-optionnel n'a PAS d'entrée dans la Map retournée — Map
// partielle assumée, plus honnête qu'un faux principal choisi parmi des ingrédients optionnels.
//
// Dépendances autorisées : domain/ uniquement — §2/§3 ENGINE.

import type { Catalog, FoodId, RecipeId } from '../domain/index.js'

export function computeRecipeMainIngredient(catalog: Catalog): ReadonlyMap<RecipeId, FoodId> {
  const result = new Map<RecipeId, FoodId>()

  for (const recipe of catalog.recipes.values()) {
    let best: { readonly foodId: FoodId; readonly quantiteG: number } | undefined

    for (const ingredient of recipe.ingredients) {
      if (ingredient.optionnel) continue

      const isHeavier = best === undefined || ingredient.quantiteG > best.quantiteG
      const isTieBrokenLower = best !== undefined && ingredient.quantiteG === best.quantiteG && ingredient.foodId < best.foodId

      if (isHeavier || isTieBrokenLower) {
        best = { foodId: ingredient.foodId, quantiteG: ingredient.quantiteG }
      }
    }

    if (best !== undefined) result.set(recipe.id, best.foodId)
  }

  return result
}
