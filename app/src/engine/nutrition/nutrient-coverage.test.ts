// engine/nutrition/nutrient-coverage.test.ts — couverture nutritionnelle (docs/ENGINE.md §5.1 bis,
// décision 29).

import { describe, expect, it } from 'vitest'
import { computeNutrientCoverage, computeRecipeNutrientCoverage } from './nutrient-coverage.js'
import { aggregateRecipe } from './aggregation.js'
import { makeCatalog, makeFood, makeIngredient, makeNutrient, makeRecipe } from './test-fixtures.js'

const NUTRIENTS = [makeNutrient('energie'), makeNutrient('sodium')]

describe('nutrition/nutrient-coverage — computeNutrientCoverage', () => {
  it('tout renseigné → couverture 1 partout', () => {
    const complet = makeFood('complet', { energie: 100, sodium: 5 })
    const recette = makeRecipe('r', { ingredients: [makeIngredient('complet', { quantiteG: 200 })] })

    const coverage = computeNutrientCoverage(recette, makeCatalog([recette], [complet], NUTRIENTS))

    expect([...coverage]).toEqual([1, 1])
  })

  it('couverture = part de la MASSE renseignée, pas part des aliments', () => {
    // Le point central : un ingrédient lourd sans valeur pèse plus qu'un ingrédient léger sans
    // valeur. Compter les aliments plutôt que les grammes raterait « 64 % du plat est de la blette ».
    const connu = makeFood('connu', { energie: 100, sodium: 5 })
    const trou = makeFood('trou', { energie: 100 }) // pas de sodium
    const recette = makeRecipe('r', {
      ingredients: [makeIngredient('connu', { quantiteG: 100 }), makeIngredient('trou', { quantiteG: 300 })],
    })

    const coverage = computeNutrientCoverage(recette, makeCatalog([recette], [connu, trou], NUTRIENTS))

    expect(coverage[0]).toBeCloseTo(1, 10) // énergie connue partout
    expect(coverage[1]).toBeCloseTo(0.25, 10) // sodium connu sur 100 g / 400 g
  })

  it('MÊME PÉRIMÈTRE que aggregateRecipe : les optionnels comptent des deux côtés', () => {
    // Invariant à ne pas casser : la couverture qualifie l'agrégat. Si l'une inclut les optionnels
    // et pas l'autre, elle décrit un autre plat et ne veut plus rien dire.
    const connu = makeFood('connu', { energie: 100, sodium: 5 })
    const trou = makeFood('trou', { energie: 100 })
    const recette = makeRecipe('r', {
      ingredients: [
        makeIngredient('connu', { quantiteG: 100 }),
        makeIngredient('trou', { quantiteG: 100, optionnel: true }),
      ],
    })
    const catalog = makeCatalog([recette], [connu, trou], NUTRIENTS)

    // L'optionnel contribue bien à l'agrégat (décision P1b-1)…
    expect(aggregateRecipe(recette, catalog)[0]).toBeCloseTo(200, 10)
    // …donc il doit aussi peser au dénominateur de la couverture.
    expect(computeNutrientCoverage(recette, catalog)[1]).toBeCloseTo(0.5, 10)
  })

  it('aliment absent du catalogue : ni au numérateur NI au dénominateur', () => {
    // `aggregateRecipe` l'ignore ; le compter au dénominateur ferait chuter la couverture pour un
    // ingrédient qui ne contribue à rien — une abstention déclenchée par un fantôme.
    const connu = makeFood('connu', { energie: 100, sodium: 5 })
    const recette = makeRecipe('r', {
      ingredients: [makeIngredient('connu', { quantiteG: 100 }), makeIngredient('fantome', { quantiteG: 900 })],
    })

    const coverage = computeNutrientCoverage(recette, makeCatalog([recette], [connu], NUTRIENTS))

    expect([...coverage]).toEqual([1, 1])
  })

  it('valeur nulle EXPLICITE ≠ valeur absente — un 0 renseigné compte comme connu', () => {
    // Distinction qui fonde toute la décision 29 : Ciqual écrit `traces` (→ 0, connu) et `-`
    // (→ absent, inconnu). Les confondre reviendrait à jeter l'information qu'on a.
    const zeroConnu = makeFood('zero', { energie: 100, sodium: 0 })
    const recette = makeRecipe('r', { ingredients: [makeIngredient('zero', { quantiteG: 100 })] })

    expect(computeNutrientCoverage(recette, makeCatalog([recette], [zeroConnu], NUTRIENTS))[1]).toBe(1)
  })

  it('recette sans ingrédient résoluble → couverture nulle, pas de division par zéro', () => {
    const recette = makeRecipe('vide', { ingredients: [] })

    expect([...computeNutrientCoverage(recette, makeCatalog([recette], [], NUTRIENTS))]).toEqual([0, 0])
  })

  it('reste dans [0, 1] quelle que soit la recette', () => {
    const connu = makeFood('connu', { energie: 100, sodium: 5 })
    const trou = makeFood('trou', {})
    const recette = makeRecipe('r', {
      ingredients: [makeIngredient('connu', { quantiteG: 250 }), makeIngredient('trou', { quantiteG: 750 })],
    })

    for (const part of computeNutrientCoverage(recette, makeCatalog([recette], [connu, trou], NUTRIENTS))) {
      expect(part).toBeGreaterThanOrEqual(0)
      expect(part).toBeLessThanOrEqual(1)
    }
  })
})

describe('nutrition/nutrient-coverage — computeRecipeNutrientCoverage (index)', () => {
  it('une entrée par recette, et le RATIO n’est pas divisé par portionsBase', () => {
    // Piège symétrique de recipe-nutrients.ts, qui LUI divise : une couverture est une proportion,
    // la diviser par 4 la rendrait absurde (0,25 pour un plat entièrement renseigné).
    const complet = makeFood('complet', { energie: 100, sodium: 5 })
    const recette = makeRecipe('r', {
      portionsBase: 4,
      ingredients: [makeIngredient('complet', { quantiteG: 400 })],
    })

    const index = computeRecipeNutrientCoverage(makeCatalog([recette], [complet], NUTRIENTS))

    expect(index.size).toBe(1)
    expect([...index.get(recette.id)!]).toEqual([1, 1])
  })
})
