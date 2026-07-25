// engine/selection/scoring/preference.test.ts — couche de score `preference` (docs/ENGINE.md
// §6.5 précision 4).

import { describe, expect, it } from 'vitest'
import { scorePreference } from './preference.js'
import { NEUTRAL_SCORE } from './index.js'
import { makeIngredient, makeRecipe } from '../test-fixtures.js'
import type { FoodId } from '../../domain/index.js'

describe('scoring/preference — scorePreference', () => {
  it('recette sans ingrédient → score neutre', () => {
    const recipe = makeRecipe('vide', { ingredients: [] })
    expect(scorePreference(recipe, new Map())).toBe(NEUTRAL_SCORE)
  })

  it('aucun ingrédient de la recette n’a de préférence connue → score neutre', () => {
    const recipe = makeRecipe('inconnu', { ingredients: [makeIngredient('tomate', { quantiteG: 100 })] })
    const preferences = new Map<FoodId, number>([['courgette' as FoodId, 2]])
    expect(scorePreference(recipe, preferences)).toBe(NEUTRAL_SCORE)
  })

  it('un aliment détesté en ingrédient PRINCIPAL fait beaucoup plus baisser le score qu’en garniture', () => {
    const principalDeteste = makeRecipe('principal-deteste', {
      ingredients: [
        makeIngredient('ail', { quantiteG: 500 }), // principal, détesté
        makeIngredient('sel', { quantiteG: 5 }), // garniture, sans préférence connue
      ],
    })
    const garnitureDetestee = makeRecipe('garniture-detestee', {
      ingredients: [
        makeIngredient('riz', { quantiteG: 500 }), // principal, sans préférence connue
        makeIngredient('ail', { quantiteG: 5 }), // garniture, détestée
      ],
    })
    const preferences = new Map<FoodId, number>([['ail' as FoodId, -2]])

    const scorePrincipal = scorePreference(principalDeteste, preferences)
    const scoreGarniture = scorePreference(garnitureDetestee, preferences)

    expect(scorePrincipal).toBeLessThan(scoreGarniture)
    expect(scorePrincipal).toBeLessThan(NEUTRAL_SCORE)
    expect(scoreGarniture).toBeCloseTo(NEUTRAL_SCORE, 1) // à peine entamé
  })

  it('un +2 isolé et léger ne sauve pas un plat par ailleurs mal noté et lourd', () => {
    const recipe = makeRecipe('mixte', {
      ingredients: [
        makeIngredient('brocoli', { quantiteG: 400 }), // détesté, lourd
        makeIngredient('persil', { quantiteG: 5 }), // adoré, léger
      ],
    })
    const preferences = new Map<FoodId, number>([
      ['brocoli' as FoodId, -2],
      ['persil' as FoodId, 2],
    ])
    expect(scorePreference(recipe, preferences)).toBeLessThan(NEUTRAL_SCORE)
  })

  it('valeur vérifiée à la main : moyenne pondérée par quantité, remise à l’échelle [0,1]', () => {
    // (2*300 + (-1)*100) / 400 = 500/400 = 1.25 → (1.25+2)/4 = 0.8125
    const recipe = makeRecipe('calcul', {
      ingredients: [makeIngredient('a', { quantiteG: 300 }), makeIngredient('b', { quantiteG: 100 })],
    })
    const preferences = new Map<FoodId, number>([
      ['a' as FoodId, 2],
      ['b' as FoodId, -1],
    ])
    expect(scorePreference(recipe, preferences)).toBeCloseTo(0.8125, 10)
  })

  it('reste dans [0, 1] même à préférence extrême et unique', () => {
    const recipe = makeRecipe('extreme', { ingredients: [makeIngredient('x', { quantiteG: 100 })] })
    const preferences = new Map<FoodId, number>([['x' as FoodId, -2]])
    const score = scorePreference(recipe, preferences)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })
})
