// engine/nutrition/main-ingredient.test.ts — computeRecipeMainIngredient (docs/ENGINE.md §6.5
// précisions 4 et 8).

import { describe, expect, it } from 'vitest'
import { computeRecipeMainIngredient } from './main-ingredient.js'
import { makeCatalog, makeIngredient, makeRecipe } from './test-fixtures.js'

describe('nutrition/main-ingredient — computeRecipeMainIngredient', () => {
  it('retient le non-optionnel de plus forte quantité', () => {
    const recette = makeRecipe('recette', {
      ingredients: [
        makeIngredient('petit', { quantiteG: 50 }),
        makeIngredient('gros', { quantiteG: 300 }),
        makeIngredient('moyen', { quantiteG: 100 }),
      ],
    })
    const catalog = makeCatalog([recette])

    const index = computeRecipeMainIngredient(catalog)

    expect(index.get(recette.id)).toBe('gros')
  })

  it('ignore les optionnels même s’ils sont plus lourds', () => {
    const recette = makeRecipe('recette', {
      ingredients: [
        makeIngredient('principal', { quantiteG: 100 }),
        makeIngredient('garniture_optionnelle', { quantiteG: 500, optionnel: true }),
      ],
    })
    const catalog = makeCatalog([recette])

    const index = computeRecipeMainIngredient(catalog)

    expect(index.get(recette.id)).toBe('principal')
  })

  it('égalité stricte de quantité → tie-break déterministe par foodId (ordre lexicographique croissant)', () => {
    const recette = makeRecipe('recette', {
      ingredients: [
        makeIngredient('zebre', { quantiteG: 100 }),
        makeIngredient('alpha', { quantiteG: 100 }),
        makeIngredient('milieu', { quantiteG: 100 }),
      ],
    })
    const catalog = makeCatalog([recette])

    const index = computeRecipeMainIngredient(catalog)

    expect(index.get(recette.id)).toBe('alpha')
  })

  it('recette sans aucun ingrédient non-optionnel → absente de la Map (pas de faux principal)', () => {
    const recette = makeRecipe('recette', {
      ingredients: [makeIngredient('option', { quantiteG: 200, optionnel: true })],
    })
    const catalog = makeCatalog([recette])

    const index = computeRecipeMainIngredient(catalog)

    expect(index.has(recette.id)).toBe(false)
  })

  it('recette sans aucun ingrédient → absente de la Map', () => {
    const recette = makeRecipe('recette', { ingredients: [] })
    const catalog = makeCatalog([recette])

    const index = computeRecipeMainIngredient(catalog)

    expect(index.has(recette.id)).toBe(false)
  })
})
