// engine/nutrition/aggregation.test.ts — aggregateRecipe (docs/ENGINE.md §5.1, §6.5 précision 8).

import { describe, expect, it } from 'vitest'
import { aggregateRecipe } from './aggregation.js'
import { makeCatalog, makeFood, makeIngredient, makeNutrient, makeRecipe } from './test-fixtures.js'

describe('nutrition/aggregation — aggregateRecipe', () => {
  it('agrège plusieurs ingrédients dans l’ordre de catalog.nutrients (valeurs vérifiées à la main)', () => {
    const kcal = makeNutrient('kcal')
    const proteines = makeNutrient('proteines')
    const foodA = makeFood('a', { kcal: 200, proteines: 10 }) // pour 100g
    const foodB = makeFood('b', { kcal: 50, proteines: 2 }) // pour 100g
    const recette = makeRecipe('recette', {
      ingredients: [makeIngredient('a', { quantiteG: 150 }), makeIngredient('b', { quantiteG: 200 })],
    })
    const catalog = makeCatalog([recette], [foodA, foodB], [kcal, proteines])

    const vector = aggregateRecipe(recette, catalog)

    // a: 200*1.5=300 kcal, 10*1.5=15 proteines ; b: 50*2=100 kcal, 2*2=4 proteines
    // total : 400 kcal, 19 proteines
    expect(Array.from(vector)).toEqual([400, 19])
  })

  it('inclut un ingrédient optionnel dans l’agrégat (décision tranchée : plat servi par défaut)', () => {
    const kcal = makeNutrient('kcal')
    const base = makeFood('base', { kcal: 100 })
    const extra = makeFood('extra', { kcal: 50 })
    const recette = makeRecipe('recette', {
      ingredients: [
        makeIngredient('base', { quantiteG: 100 }),
        makeIngredient('extra', { quantiteG: 100, optionnel: true }),
      ],
    })
    const catalog = makeCatalog([recette], [base, extra], [kcal])

    const vector = aggregateRecipe(recette, catalog)

    expect(Array.from(vector)).toEqual([150])
  })

  it('un nutriment absent sur un aliment compte comme 0, jamais NaN', () => {
    const kcal = makeNutrient('kcal')
    const proteines = makeNutrient('proteines')
    const foodSansProteines = makeFood('sans_proteines', { kcal: 100 }) // pas d'entrée 'proteines'
    const recette = makeRecipe('recette', { ingredients: [makeIngredient('sans_proteines', { quantiteG: 100 })] })
    const catalog = makeCatalog([recette], [foodSansProteines], [kcal, proteines])

    const vector = aggregateRecipe(recette, catalog)

    expect(Array.from(vector)).toEqual([100, 0])
    expect(Array.from(vector).some((value) => Number.isNaN(value))).toBe(false)
  })

  it('un foodId absent du catalogue est ignoré (garde défensive, intégrité garantie au build)', () => {
    const kcal = makeNutrient('kcal')
    const recette = makeRecipe('recette', { ingredients: [makeIngredient('inconnu', { quantiteG: 100 })] })
    const catalog = makeCatalog([recette], [], [kcal])

    const vector = aggregateRecipe(recette, catalog)

    expect(Array.from(vector)).toEqual([0])
  })

  it('recette sans ingrédient → vecteur nul de la longueur de catalog.nutrients', () => {
    const kcal = makeNutrient('kcal')
    const recette = makeRecipe('recette', { ingredients: [] })
    const catalog = makeCatalog([recette], [], [kcal])

    const vector = aggregateRecipe(recette, catalog)

    expect(Array.from(vector)).toEqual([0])
  })
})
