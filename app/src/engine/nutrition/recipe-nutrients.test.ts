// engine/nutrition/recipe-nutrients.test.ts — computeRecipeNutrients, index PAR PORTION
// (docs/ENGINE.md §6.5 précisions 1 et 8).

import { describe, expect, it } from 'vitest'
import { computeRecipeNutrients } from './recipe-nutrients.js'
import { makeCatalog, makeFood, makeIngredient, makeNutrient, makeRecipe } from './test-fixtures.js'

describe('nutrition/recipe-nutrients — computeRecipeNutrients', () => {
  it('divise l’agrégat total par portionsBase — le vecteur stocké est PAR PORTION', () => {
    const kcal = makeNutrient('kcal')
    const food = makeFood('food', { kcal: 100 })
    const recette = makeRecipe('recette', {
      ingredients: [makeIngredient('food', { quantiteG: 400 })], // 400 kcal au total
      portionsBase: 4,
    })
    const catalog = makeCatalog([recette], [food], [kcal])

    const index = computeRecipeNutrients(catalog)

    expect(Array.from(index.get(recette.id)!)).toEqual([100])
  })

  it('portionsBase <= 0 est traité comme 1 (défensif, ne doit pas arriver)', () => {
    const kcal = makeNutrient('kcal')
    const food = makeFood('food', { kcal: 100 })
    const recette = makeRecipe('recette', {
      ingredients: [makeIngredient('food', { quantiteG: 100 })],
      portionsBase: 0,
    })
    const catalog = makeCatalog([recette], [food], [kcal])

    const index = computeRecipeNutrients(catalog)

    expect(Array.from(index.get(recette.id)!)).toEqual([100])
  })

  it('une entrée par recette du catalogue', () => {
    const kcal = makeNutrient('kcal')
    const recetteA = makeRecipe('a')
    const recetteB = makeRecipe('b')
    const catalog = makeCatalog([recetteA, recetteB], [], [kcal])

    const index = computeRecipeNutrients(catalog)

    expect(new Set(index.keys())).toEqual(new Set([recetteA.id, recetteB.id]))
  })
})
