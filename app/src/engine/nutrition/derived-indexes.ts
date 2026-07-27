// engine/nutrition/derived-indexes.ts — assemblage des index dérivés dans un nouveau Catalog
// (docs/ENGINE.md §6.5 précision 8, §9.1).
//
// Fonction PURE. C'est elle que `createEngine(catalog)` appellera (P1b-2 — pas ici :
// `engine/api/index.ts` reste un stub tant que le moteur n'est pas assemblé). Retourne un NOUVEAU
// `Catalog` : `indexes.recipeNutrients` et `indexes.recipeMainIngredient` peuplés, tous les autres
// champs et index INCHANGÉS (même référence, pas de recopie) — immutabilité, aucune mutation du
// catalogue reçu en entrée.
//
// Dépendances autorisées : domain/, ./recipe-nutrients.js, ./main-ingredient.js, ./signature.js
// — §2/§3 ENGINE.

import type { Catalog } from '../domain/index.js'
import { computeRecipeNutrients } from './recipe-nutrients.js'
import { computeRecipeMainIngredient } from './main-ingredient.js'
import { computeDeclaredFamilies, computeRecipeFamilySignature, computeRecipeSignature } from './signature.js'
import { computeRecipeNutrientCoverage } from './nutrient-coverage.js'

export function attachDerivedIndexes(catalog: Catalog): Catalog {
  return {
    ...catalog,
    indexes: {
      ...catalog.indexes,
      recipeNutrients: computeRecipeNutrients(catalog),
      recipeNutrientCoverage: computeRecipeNutrientCoverage(catalog),
      recipeMainIngredient: computeRecipeMainIngredient(catalog),
      recipeSignature: computeRecipeSignature(catalog),
      recipeFamilySignature: computeRecipeFamilySignature(catalog),
      declaredFamilies: computeDeclaredFamilies(catalog),
    },
  }
}
