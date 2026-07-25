// engine/nutrition/aggregation.ts — agrégation nutritionnelle d'une recette (docs/ENGINE.md §5.1,
// §6.5 précision 8).
//
// Fonction PURE : pour chaque nutriment de `catalog.nutrients` (l'ordre y fixe l'index du
// NutrientVector renvoyé, §9.1 ENGINE), somme la contribution de chaque ingrédient de la recette
// TELLE QU'ÉCRITE — `recipe.portionsBase` portions, pas une seule portion. La mise à l'échelle par
// portion est la responsabilité de `computeRecipeNutrients` (voir recipe-nutrients.ts), pas de
// cette fonction.
//
// Décision tranchée par l'utilisateur (session P1b-1, lot 2) : les ingrédients `optionnel: true`
// SONT INCLUS dans l'agrégat — ils font partie du plat servi par défaut. Conséquence à retenir
// pour P1c : quand `suggestAlternatives` retirera un optionnel, la variante nutritionnelle devra
// être RECALCULÉE en rappelant `aggregateRecipe` sur une recette modifiée, jamais lue dans
// `catalog.indexes.recipeNutrients` qui reste l'agrégat de la recette complète (avec optionnels).
//
// Cas limites : un `foodId` d'ingrédient absent de `catalog.foods` est ignoré silencieusement
// (l'intégrité référentielle est garantie par catalog/build.mjs — cette garde est purement
// défensive) ; un nutriment absent de `food.nutrimentsPour100g` compte comme 0, jamais NaN.
//
// Dépendances autorisées : domain/, ./index.js (types locaux, import type seulement — voir
// exclusion-pass.ts pour le même motif dans engine/selection/) — §2/§3 ENGINE.

import type { AggregateRecipe } from './index.js'

export const aggregateRecipe: AggregateRecipe = (recipe, catalog) => {
  const vector = new Float64Array(catalog.nutrients.length)

  for (const ingredient of recipe.ingredients) {
    const food = catalog.foods.get(ingredient.foodId)
    if (!food) continue

    for (let i = 0; i < catalog.nutrients.length; i++) {
      const nutrientId = catalog.nutrients[i]!.id
      const per100g = food.nutrimentsPour100g.get(nutrientId) ?? 0
      // Lecture explicite avant écriture : sous `noUncheckedIndexedAccess`, `vector[i]` est typé
      // `number | undefined` en lecture (même sur un Float64Array), donc `vector[i] += x` ne
      // compile pas tel quel.
      vector[i] = (vector[i] ?? 0) + (per100g * ingredient.quantiteG) / 100
    }
  }

  return vector
}
