// engine/selection/alternatives.ts — « je n'aime pas cet ingrédient » (docs/ENGINE.md §8.4,
// décision 26).
//
// DEUX NOTIONS DISTINCTES que la spec initiale de §8 confondait, et qu'il ne faut jamais refondre :
//
//   VARIANTE     — la MÊME recette, ingrédient caractéristique INVARIANT. Retrait d'un ingrédient
//                  `optionnel`, ou substitution d'un ingrédient SECONDAIRE via la table
//                  `substitution`. On mange le même plat, autrement.
//   ALTERNATIVE  — une AUTRE recette, ingrédient caractéristique LIBRE dans le même `Food.groupe`
//                  (autre poisson, autre viande, autre légumineuse), toujours dans les filtres de
//                  l'utilisateur. On mange autre chose du même genre.
//
// ⚠️ POURQUOI PAS `argmax(similarity)` POUR LE PLAT FRÈRE. La similarité pondère la composition à
// 0,80 (§6.6 ter) : maximiser la similarité revient à privilégier les recettes qui GARDENT
// l'ingrédient rejeté — exactement l'inverse du service rendu. Le mécanisme est donc « même groupe,
// aliment caractéristique DIFFÉRENT », puis classement sur ce qui reste. Ce piège était déjà noté
// dans la décision 26 quand le poids valait 0,5 ; il s'est aggravé depuis, pas atténué.
//
// ⚠️ POURQUOI UN `SuggestionRequest` ET PAS `(recipeId, dislikedFoodId)`. La signature de §8 est
// INSUFFISANTE : proposer une alternative sans repasser les filtres reviendrait à suggérer un plat
// contenant un allergène déclaré. Les alternatives passent donc par `runExclusionPass`, c'est-à-dire
// par les MÊMES sept couches d'exclusion que `suggestMeals`, garde-fous compris.
//
// ⚠️ LA TABLE `substitution` EST VIDE aujourd'hui (décision 27 : elle se conçoit AVEC les recettes).
// Le chemin de code existe et est testé ; il ne produit simplement rien tant que
// `catalog.substitutions` reste une Map vide. Ce n'est pas un bug à « corriger » en inventant des
// substitutions.
//
// Dépendances autorisées : domain/, ../nutrition/, ./index.js — §2/§3 ENGINE.

import type {
  AlternativeRecipe,
  AlternativeSuggestion,
  Catalog,
  FoodId,
  RecipeId,
  RecipeVariant,
  SuggestionRequest,
} from '../domain/index.js'
import { runExclusionPass } from './exclusion-pass.js'

/** Nombre maximal d'alternatives rendues — au-delà, l'utilisateur ne choisit plus, il subit. */
export const MAX_ALTERNATIVES = 5

/**
 * VARIANTES — la même recette, autrement. Deux mécanismes, dans cet ordre de préférence : retirer
 * coûte moins que remplacer.
 *
 * Le retrait n'est proposé que si l'ingrédient est déclaré `optionnel` : retirer un ingrédient
 * structurel produirait une recette dont les étapes mentent (« faire revenir l'oignon » sans
 * oignon). La substitution, elle, est refusée sur l'ingrédient CARACTÉRISTIQUE — remplacer le
 * cabillaud d'un « cabillaud aux épinards » n'est plus une variante, c'est une autre recette.
 */
function buildVariants(
  catalog: Catalog,
  recipeId: RecipeId,
  dislikedFoodId: FoodId,
  characteristicFoodId: FoodId | undefined
): readonly RecipeVariant[] {
  const recipe = catalog.recipes.get(recipeId)
  if (recipe === undefined) return []

  const ingredient = recipe.ingredients.find((i) => i.foodId === dislikedFoodId)
  if (ingredient === undefined) return [] // l'aliment n'est pas dans la recette : rien à retirer

  const variants: RecipeVariant[] = []

  if (ingredient.optionnel) {
    variants.push({
      kind: 'retrait_optionnel',
      recipeId,
      foodId: dislikedFoodId,
      replacementFoodId: null,
    })
  }

  // `catalog.substitutions` est indexé PAR aliment remplacé — un accès direct, pas un balayage.
  if (dislikedFoodId !== characteristicFoodId) {
    for (const substitution of catalog.substitutions.get(dislikedFoodId) ?? []) {
      variants.push({
        kind: 'substitution',
        recipeId,
        foodId: dislikedFoodId,
        replacementFoodId: substitution.altFoodId,
      })
    }
  }

  return variants
}

/**
 * ALTERNATIVES — un autre plat du même genre.
 *
 * Quatre conditions, toutes nécessaires :
 *  1. la recette passe les filtres de l'utilisateur (`runExclusionPass`, garde-fous compris) ;
 *  2. elle ne contient PAS l'aliment rejeté, même en optionnel — le proposer serait absurde ;
 *  3. son ingrédient caractéristique est dans le MÊME `Food.groupe` que celui de la recette
 *     d'origine (autre poisson, autre viande…) ;
 *  4. cet ingrédient est DIFFÉRENT — sinon on propose le même plat sous un autre nom.
 *
 * Classement : par ordre d'id, faute d'un critère mesuré. C'est un choix ASSUMÉ et provisoire —
 * classer par similarité serait activement nuisible (voir l'en-tête), et classer par score
 * demanderait de faire tourner la passe de score complète pour un service secondaire. À remplacer
 * par un critère mesuré si le besoin se confirme à l'usage.
 */
function buildAlternatives(
  catalog: Catalog,
  req: SuggestionRequest,
  sourceRecipeId: RecipeId,
  dislikedFoodId: FoodId,
  characteristicFoodId: FoodId | undefined
): readonly AlternativeRecipe[] {
  if (characteristicFoodId === undefined) return []

  const groupeSource = catalog.foods.get(characteristicFoodId)?.groupe
  if (groupeSource === undefined) return []

  const { candidates } = runExclusionPass(catalog, req)
  const alternatives: AlternativeRecipe[] = []

  for (const candidateId of candidates) {
    if (candidateId === sourceRecipeId) continue

    const candidate = catalog.recipes.get(candidateId)
    if (candidate === undefined) continue
    if (candidate.ingredients.some((i) => i.foodId === dislikedFoodId)) continue

    const candidateFoodId = catalog.indexes.recipeCharacteristic.get(candidateId)
    if (candidateFoodId === undefined || candidateFoodId === characteristicFoodId) continue
    if (catalog.foods.get(candidateFoodId)?.groupe !== groupeSource) continue

    alternatives.push({ recipeId: candidateId, characteristicFoodId: candidateFoodId })
  }

  alternatives.sort((a, b) => (a.recipeId < b.recipeId ? -1 : a.recipeId > b.recipeId ? 1 : 0))
  return alternatives.slice(0, MAX_ALTERNATIVES)
}

export function suggestAlternatives(
  catalog: Catalog,
  req: SuggestionRequest,
  recipeId: RecipeId,
  dislikedFoodId: FoodId
): AlternativeSuggestion {
  const characteristicFoodId = catalog.indexes.recipeCharacteristic.get(recipeId)

  return {
    variants: buildVariants(catalog, recipeId, dislikedFoodId, characteristicFoodId),
    alternatives: buildAlternatives(catalog, req, recipeId, dislikedFoodId, characteristicFoodId),
  }
}
