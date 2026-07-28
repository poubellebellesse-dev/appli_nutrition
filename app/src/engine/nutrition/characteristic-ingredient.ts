// engine/nutrition/characteristic-ingredient.ts — l'ingrédient CARACTÉRISTIQUE d'une recette
// (docs/ENGINE.md §8.4, décision 26).
//
// ⚠️ À NE CONFONDRE NI AVEC `recipeMainIngredient` NI AVEC `recipeSignature`. Trois notions, trois
// questions différentes, mesurées séparément :
//   - `recipeMainIngredient` = le plus lourd. MESURÉ FAUX comme « ce qui définit le plat » (§6.6
//     bis) et lu par aucune couche. Ne pas le réemployer.
//   - `recipeSignature` = les 3 plus lourds avec leurs parts. Répond à « ces deux plats se
//     ressemblent-ils » (§6.6 bis).
//   - CE MODULE répond à « quel aliment un plat frère doit-il REMPLACER » — autre poisson, autre
//     viande, autre légumineuse. C'est la question de `suggestAlternatives`, et elle n'a pas la
//     même réponse que les deux autres.
//
// MODÈLE RETENU (mesuré sur les 212 recettes, banc app/src/cli/diag-caracteristique.ts) : le plus
// lourd des ingrédients non optionnels appartenant à un GROUPE DÉFINISSANT, avec repli sur le plus
// lourd tous groupes confondus quand la recette n'en contient aucun.
//
// Pourquoi le repli par groupe et pas le simple « plus lourd » : sur 29 recettes les deux
// divergent, et les 29 fois le groupe définissant a raison. « Hachis de bœuf aux pommes de terre »
// est un plat de BŒUF (le plus lourd est la pomme de terre), « Cabillaud aux épinards » un plat de
// CABILLAUD (le plus lourd est l'épinard), « Dahl de lentilles corail » un plat de LENTILLES (le
// plus lourd est la tomate). Un « autre légume » ne remplace aucun de ces plats.
//
// ⚠️ `œufs` est VOLONTAIREMENT ABSENT des groupes définissants, et ce n'est pas un oubli : mesuré,
// l'y inclure fait de « Clafoutis aux framboises » un plat d'ŒUF et de « Crème de mascarpone au
// cacao » aussi. L'œuf est un ingrédient de structure présent dans les pâtes à crêpes, les flans,
// les mousses et les panures — exactement le même piège que pour la récence (§6.6 quinquies), où le
// même groupe avait dû être écarté pour la même raison. Le retirer fait tomber les désaccords de 49
// à 29, et les 20 disparus étaient tous des desserts que le repli rendait absurdes.
//
// Le repli (recette sans aucun aliment définissant) concerne 114 recettes sur 212 — soupes,
// gratins de légumes, desserts. Pour elles, « le plus lourd » redevient le meilleur candidat
// disponible : une soupe de carottes EST un plat de carottes.
//
// Dépendances autorisées : domain/ uniquement — §2/§3 ENGINE.

import type { Catalog, FoodId, Recipe, RecipeId } from '../domain/index.js'

/**
 * Groupes alimentaires qui DÉFINISSENT un plat — ceux dont on dit « un autre poisson », « une autre
 * viande ». Valeurs de `Food.groupe` telles qu'écrites au catalogue (`catalog/sources/foods.yaml`).
 *
 * ⚠️ Liste FERMÉE et volontairement courte. Y ajouter `œufs`, `légumes` ou `céréales` a été mesuré
 * nuisible : ce sont des accompagnements ou des ingrédients de structure, pas ce qu'on remplace.
 */
export const GROUPES_DEFINISSANTS: ReadonlySet<string> = new Set([
  'viandes',
  'poissons',
  'fruits de mer',
  'légumineuses',
])

/**
 * L'aliment qu'un « plat frère » devrait remplacer. `undefined` seulement si la recette n'a aucun
 * ingrédient non optionnel résoluble — jamais parce qu'elle manque d'aliment définissant, le repli
 * s'en charge.
 *
 * Tie-break déterministe par `foodId` croissant à quantité égale, même règle que
 * `computeRecipeSignature` : le cas est fréquent et un ordre instable rendrait les alternatives
 * non reproductibles d'un build à l'autre.
 */
export function computeCharacteristicIngredient(recipe: Recipe, catalog: Catalog): FoodId | undefined {
  const solides = recipe.ingredients.filter((ingredient) => !ingredient.optionnel)
  if (solides.length === 0) return undefined

  const parPoids = [...solides].sort(
    (a, b) => b.quantiteG - a.quantiteG || (a.foodId < b.foodId ? -1 : a.foodId > b.foodId ? 1 : 0)
  )

  const definissant = parPoids.find((ingredient) => {
    const groupe = catalog.foods.get(ingredient.foodId)?.groupe
    return groupe !== undefined && GROUPES_DEFINISSANTS.has(groupe)
  })

  return (definissant ?? parPoids[0])?.foodId
}

export function computeRecipeCharacteristic(catalog: Catalog): ReadonlyMap<RecipeId, FoodId> {
  const result = new Map<RecipeId, FoodId>()
  for (const recipe of catalog.recipes.values()) {
    const foodId = computeCharacteristicIngredient(recipe, catalog)
    if (foodId !== undefined) result.set(recipe.id, foodId)
  }
  return result
}
