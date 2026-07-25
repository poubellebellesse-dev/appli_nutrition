// engine/nutrition/derived-indexes.test.ts — attachDerivedIndexes (docs/ENGINE.md §6.5
// précision 8).

import { describe, expect, it } from 'vitest'
import { attachDerivedIndexes } from './derived-indexes.js'
import { makeCatalog, makeFood, makeIngredient, makeNutrient, makeRecipe } from './test-fixtures.js'

describe('nutrition/derived-indexes — attachDerivedIndexes', () => {
  it('peuple recipeNutrients et recipeMainIngredient sans muter le catalogue reçu', () => {
    const kcal = makeNutrient('kcal')
    const food = makeFood('food', { kcal: 100 })
    const recette = makeRecipe('recette', {
      ingredients: [makeIngredient('food', { quantiteG: 200 })],
      portionsBase: 2,
    })
    const catalog = makeCatalog([recette], [food], [kcal])

    const attached = attachDerivedIndexes(catalog)

    expect(attached).not.toBe(catalog)
    expect(catalog.indexes.recipeNutrients.size).toBe(0) // catalogue d'entrée non muté
    expect(catalog.indexes.recipeMainIngredient.size).toBe(0)
    expect(Array.from(attached.indexes.recipeNutrients.get(recette.id)!)).toEqual([100])
    expect(attached.indexes.recipeMainIngredient.get(recette.id)).toBe('food')
  })

  it('préserve les autres champs et index inchangés (même référence, pas de recopie)', () => {
    const catalog = makeCatalog([makeRecipe('a')])

    const attached = attachDerivedIndexes(catalog)

    expect(attached.version).toBe(catalog.version)
    expect(attached.foods).toBe(catalog.foods)
    expect(attached.recipes).toBe(catalog.recipes)
    expect(attached.nutrients).toBe(catalog.nutrients)
    expect(attached.allergens).toBe(catalog.allergens)
    expect(attached.lexicon).toBe(catalog.lexicon)
    expect(attached.topics).toBe(catalog.topics)
    expect(attached.substitutions).toBe(catalog.substitutions)
    expect(attached.indexes.recipesBySlot).toBe(catalog.indexes.recipesBySlot)
    expect(attached.indexes.recipesByDiet).toBe(catalog.indexes.recipesByDiet)
    expect(attached.indexes.recipesByAllergen).toBe(catalog.indexes.recipesByAllergen)
  })
})
