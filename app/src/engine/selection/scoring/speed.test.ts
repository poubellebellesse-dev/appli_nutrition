// engine/selection/scoring/speed.test.ts — couche de score `speed` (docs/ENGINE.md §6.5 note ¶,
// §6.3 bis).

import { describe, expect, it } from 'vitest'
import type { RecipeId } from '../../domain/index.js'
import { scoreSpeed, speedLayer } from './speed.js'
import { NEUTRAL_SCORE } from './index.js'
import { asScoringResult, makeCatalog, makeRecipe, makeRequest } from '../test-fixtures.js'

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

describe('scoring/speed — speedLayer (§6.2 ENGINE, enveloppe SelectionLayer)', () => {
  it('rend un score par candidat', () => {
    const courte = makeRecipe('courte', { tempsPrepMin: 5, tempsCuissonMin: 15 })
    const longue = makeRecipe('longue', { tempsPrepMin: 20, tempsCuissonMin: 30 })
    const catalog = makeCatalog([courte, longue])
    const req = makeRequest({ tempsDisponibleMin: 60 })

    const config = speedLayer.configure(req, catalog)
    const result = asScoringResult(speedLayer.apply(new Set([courte.id, longue.id]), config))

    expect(result.scores.size).toBe(2)
    expect(result.scores.has(courte.id)).toBe(true)
    expect(result.scores.has(longue.id)).toBe(true)
  })

  it('tempsDisponibleMin null (context) → NEUTRAL_SCORE pour tous', () => {
    const recipe = makeRecipe('r', { tempsPrepMin: 10, tempsCuissonMin: 10 })
    const catalog = makeCatalog([recipe])
    const req = makeRequest({ tempsDisponibleMin: null })

    const config = speedLayer.configure(req, catalog)
    const result = asScoringResult(speedLayer.apply(new Set([recipe.id]), config))

    expect(result.scores.get(recipe.id)).toBe(NEUTRAL_SCORE)
  })

  it('une recette plus courte est mieux notée qu’une recette plus longue, dans la même fenêtre', () => {
    const courte = makeRecipe('courte', { tempsPrepMin: 5, tempsCuissonMin: 15 }) // 20 min
    const longue = makeRecipe('longue', { tempsPrepMin: 20, tempsCuissonMin: 30 }) // 50 min
    const catalog = makeCatalog([courte, longue])
    const req = makeRequest({ tempsDisponibleMin: 60 })

    const config = speedLayer.configure(req, catalog)
    const result = asScoringResult(speedLayer.apply(new Set([courte.id, longue.id]), config))

    expect(result.scores.get(courte.id)!).toBeGreaterThan(result.scores.get(longue.id)!)
  })

  it('candidat absent du catalogue (id orphelin) → NEUTRAL_SCORE (§6.1 ENGINE)', () => {
    const catalog = makeCatalog([])
    const req = makeRequest({ tempsDisponibleMin: 30 })

    const config = speedLayer.configure(req, catalog)
    const result = asScoringResult(speedLayer.apply(new Set(['inconnue' as RecipeId]), config))

    expect(result.scores.get('inconnue' as RecipeId)).toBe(NEUTRAL_SCORE)
  })
})
