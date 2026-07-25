// engine/selection/scoring/speed.test.ts — signal de score doux `speed` (docs/ENGINE.md §6.5
// note ¶).

import { describe, expect, it } from 'vitest'
import { scoreSpeed } from './speed.js'
import { NEUTRAL_SCORE } from './index.js'
import { makeRecipe } from '../test-fixtures.js'

describe('scoring/speed — scoreSpeed', () => {
  it('fenêtre null → score neutre (couche inerte)', () => {
    const recipe = makeRecipe('r', { tempsPrepMin: 10, tempsCuissonMin: 10 })
    expect(scoreSpeed(recipe, null)).toBe(NEUTRAL_SCORE)
  })

  it('fenêtre ≤ 0 → score neutre', () => {
    const recipe = makeRecipe('r', { tempsPrepMin: 10, tempsCuissonMin: 10 })
    expect(scoreSpeed(recipe, 0)).toBe(NEUTRAL_SCORE)
    expect(scoreSpeed(recipe, -5)).toBe(NEUTRAL_SCORE)
  })

  it('à fenêtre égale, une recette plus courte score mieux qu’une recette plus longue', () => {
    const courte = makeRecipe('courte', { tempsPrepMin: 5, tempsCuissonMin: 15 }) // 20 min
    const longue = makeRecipe('longue', { tempsPrepMin: 20, tempsCuissonMin: 30 }) // 50 min
    const fenetreMin = 60

    const scoreCourte = scoreSpeed(courte, fenetreMin)
    const scoreLongue = scoreSpeed(longue, fenetreMin)

    expect(scoreCourte).toBeGreaterThan(scoreLongue)
  })

  it('valeur vérifiée à la main : 1 - total/fenêtre', () => {
    const recipe = makeRecipe('r', { tempsPrepMin: 10, tempsCuissonMin: 10 }) // 20 min
    expect(scoreSpeed(recipe, 40)).toBeCloseTo(0.5, 10)
  })

  it('temps total dépassant la fenêtre → clampé à 0, jamais négatif', () => {
    const recipe = makeRecipe('r', { tempsPrepMin: 60, tempsCuissonMin: 60 }) // 120 min
    expect(scoreSpeed(recipe, 30)).toBe(0)
  })

  it('reste toujours dans [0, 1]', () => {
    const recipe = makeRecipe('r', { tempsPrepMin: 0, tempsCuissonMin: 0 })
    const score = scoreSpeed(recipe, 10)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })
})
