// engine/nutrition/nutrient-coverage.ts — COUVERTURE nutritionnelle d'une recette (docs/ENGINE.md
// §5.1 bis, décision 29).
//
// Répond à une question que `aggregateRecipe` ne pose pas : sur quelle part du plat la valeur
// agrégée repose-t-elle réellement ?
//
// LE PROBLÈME. CIQUAL ne renseigne pas tout : pour certains aliments, une case est vide parce que
// l'ANSES n'a pas mesuré ce nutriment-là. `aggregateRecipe` lit une case vide et compte 0 (`?? 0`),
// ce qui confond « on ne sait pas » et « il n'y en a pas ». Le vecteur agrégé reste juste comme
// SOMME DES VALEURS CONNUES, mais rien n'indique combien il en manque.
//
// POURQUOI ÇA COMPTE POUR LE CLASSEMENT, pas seulement pour l'affichage : `scoreNutri` note l'écart
// à une cible, et le sens de l'erreur dépend du `NutrientSense` (§6.5 précision 1) —
//   - `plancher` (fibres, fer, calcium, vitamine C) : un trou compté 0 fait paraître la recette
//     PAUVRE, elle est donc PÉNALISÉE à tort. Mesuré : « Truite aux amandes », 76 % de la masse
//     sans valeur de vitamine C.
//   - `plafond` (sodium) : un trou compté 0 fait paraître la recette INOFFENSIVE, elle est donc
//     RÉCOMPENSÉE à tort. Mesuré : « Gratin de blettes à la brousse », 64 % de la masse sans valeur
//     de sodium.
// Ce n'est donc pas un biais dans un sens, c'est du BRUIT qui pousse au hasard vers le haut ou vers
// le bas selon le nutriment. 47 recettes sur 212 sont concernées à des degrés divers.
//
// CE QUE CE MODULE FAIT, ET SURTOUT CE QU'IL NE FAIT PAS. Il ne corrige aucune valeur et n'en
// invente aucune — il produit, par nutriment, la PART DE LA MASSE dont la valeur est connue ∈
// [0, 1]. C'est `scoreNutri` qui décide quoi en faire (voir `NUTRI_MIN_COVERAGE`). Estimer les
// valeurs manquantes depuis une autre table (USDA, CoFID) reste possible plus tard et n'entre pas
// en conflit : ce vecteur est justement ce qui permettrait de tracer une valeur estimée sans la
// confondre avec une valeur ANSES.
//
// ⚠️ MÊME PÉRIMÈTRE D'INGRÉDIENTS QUE `aggregateRecipe`, optionnels INCLUS (voir son en-tête, choix
// tranché par l'utilisateur en P1b-1). Les deux vecteurs doivent décrire le même plat, sinon la
// couverture ne dit rien de l'agrégat qu'elle est censée qualifier.
//
// Un `foodId` absent de `catalog.foods` ne compte NI au numérateur NI au dénominateur : il est déjà
// ignoré par `aggregateRecipe`, l'inclure au dénominateur ferait chuter la couverture pour un
// ingrédient qui ne contribue à rien.
//
// Recette de masse nulle (aucun ingrédient résoluble) → couverture 0 partout, donc `scoreNutri`
// n'en note aucun nutriment et retombe sur son score neutre. Cohérent avec le reste du moteur : on
// ne juge pas ce dont on ne sait rien.
//
// Dépendances autorisées : domain/ uniquement — §2/§3 ENGINE.

import type { Catalog, NutrientVector, Recipe, RecipeId } from '../domain/index.js'

/** Part de la masse dont la valeur est connue, un ratio ∈ [0, 1] par nutriment. */
export function computeNutrientCoverage(recipe: Recipe, catalog: Catalog): NutrientVector {
  const known = new Float64Array(catalog.nutrients.length)
  let totalMass = 0

  for (const ingredient of recipe.ingredients) {
    const food = catalog.foods.get(ingredient.foodId)
    if (!food) continue

    totalMass += ingredient.quantiteG

    for (let i = 0; i < catalog.nutrients.length; i++) {
      if (!food.nutrimentsPour100g.has(catalog.nutrients[i]!.id)) continue
      known[i] = (known[i] ?? 0) + ingredient.quantiteG
    }
  }

  const coverage = new Float64Array(catalog.nutrients.length)
  if (totalMass <= 0) return coverage
  for (let i = 0; i < coverage.length; i++) coverage[i] = (known[i] ?? 0) / totalMass
  return coverage
}

/**
 * Index dérivé — même échelle que la recette entière, donc AUCUNE division par `portionsBase` :
 * une couverture est un ratio, pas une quantité. Ne pas l'aligner sur `recipeNutrients`, qui est
 * lui par portion (voir recipe-nutrients.ts).
 */
export function computeRecipeNutrientCoverage(catalog: Catalog): ReadonlyMap<RecipeId, NutrientVector> {
  const result = new Map<RecipeId, NutrientVector>()
  for (const recipe of catalog.recipes.values()) {
    result.set(recipe.id, computeNutrientCoverage(recipe, catalog))
  }
  return result
}
