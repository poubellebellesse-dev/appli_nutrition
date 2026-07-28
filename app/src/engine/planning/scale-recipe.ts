// engine/planning/scale-recipe.ts — mise à l'échelle des portions (docs/ENGINE.md §10.1,
// « Ajustement des proportions »).
//
// Recalcule les quantités d'une recette pour un nombre de portions différent de `portionsBase`.
//
// ⚠️ RÈGLE DE TROIS, RIEN DE PLUS, et c'est délibéré. Une vraie mise à l'échelle culinaire ne l'est
// pas : le sel ne double pas quand on double un plat, les épices non plus, et un temps de cuisson
// ne suit aucune proportion. Prétendre modéliser ça demanderait, par ingrédient, une courbe que
// personne ne peut renseigner honnêtement pour 199 aliments.
//
// La règle de trois est donc un choix ASSUMÉ, pas une approximation faute de mieux : elle est
// prévisible, l'utilisateur voit le facteur appliqué et corrige de lui-même s'il le veut. Une
// heuristique qui « corrigerait » le sel serait invisible et inexplicable.
//
// ⚠️ NE TOUCHE NI AUX ÉTAPES NI AUX TEMPS. `ScaledRecipe` ne porte que les ingrédients (voir le
// type) : doubler les portions ne double pas le temps de cuisson, et laisser croire le contraire
// serait faux. L'appelant affiche la recette d'origine pour tout le reste.
//
// Dépendances autorisées : domain/ uniquement — §2/§3 ENGINE.

import type { Catalog, RecipeId, ScaledRecipe } from '../domain/index.js'
import { g } from '../domain/index.js'

/** Bornes de bon sens — au-delà, c'est une erreur de saisie, pas une intention. */
export const MIN_PORTIONS = 1
export const MAX_PORTIONS = 50

export function scaleRecipe(catalog: Catalog, recipeId: RecipeId, portions: number): ScaledRecipe {
  const recette = catalog.recipes.get(recipeId)
  if (recette === undefined) {
    throw new RangeError(`scaleRecipe : recette '${recipeId}' absente du catalogue.`)
  }
  if (!Number.isInteger(portions) || portions < MIN_PORTIONS || portions > MAX_PORTIONS) {
    throw new RangeError(
      `scaleRecipe : ${portions} portion(s) — attendu un entier entre ${MIN_PORTIONS} et ${MAX_PORTIONS}.`
    )
  }

  // `portionsBase <= 0` est impossible (le catalogue le garantit) mais diviser par zéro produirait
  // des Infinity silencieux dans toute la liste de courses. Repli défensif sur 1.
  const base = recette.portionsBase > 0 ? recette.portionsBase : 1
  const facteur = portions / base

  return {
    recipeId,
    portions,
    ingredients: recette.ingredients.map((ingredient) => ({
      ...ingredient,
      quantiteG: g(Math.round(ingredient.quantiteG * facteur * 10) / 10),
      // ⚠️ `uniteAffichage` est un texte saisi à la main (« 2 carottes », « 1 pincée ») : le mettre
      // à l'échelle demanderait de réécrire du français, ce qu'aucune règle ne sait faire. On le
      // laisse TEL QUEL et l'appelant affiche la quantité recalculée à côté — mieux vaut un libellé
      // visiblement figé qu'un « 1,5 pincée » qui a l'air juste sans l'être.
    })),
  }
}
