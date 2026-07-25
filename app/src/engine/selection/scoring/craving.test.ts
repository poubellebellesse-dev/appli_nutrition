// engine/selection/scoring/craving.test.ts — couche de score `craving` (docs/ENGINE.md §6.5
// précision 2).

import { describe, expect, it } from 'vitest'
import { scoreCraving, cravingLayer } from './craving.js'
import { NEUTRAL_SCORE } from './index.js'
import { asScoringResult, makeCatalog, makeRecipe, makeRequest } from '../test-fixtures.js'
import type { CravingAxes, RecipeId, SensoryAxes } from '../../domain/index.js'

describe('scoring/craving — scoreCraving', () => {
  it('rien demandé (envie null, pas de texture) → score neutre', () => {
    const axes: SensoryAxes = { sucreSale: 1, legerConsistant: -1, chaudFroid: 1, texture: 'croquant' }
    expect(scoreCraving(axes, null)).toBe(NEUTRAL_SCORE)
  })

  it('un seul axe demandé n’entraîne pas le calcul sur les 3', () => {
    const axes: SensoryAxes = { sucreSale: 1, legerConsistant: -1, chaudFroid: -1, texture: 'test' }
    const envie: CravingAxes = { sucreSale: 1, legerConsistant: null, chaudFroid: null }
    // sucreSale match parfait ; les 2 autres axes sont très éloignés mais NON demandés → ignorés.
    expect(scoreCraving(axes, envie)).toBe(1)
  })

  it('distance euclidienne sur les axes demandés, normalisée par 2·√k — valeur vérifiée à la main', () => {
    const axes: SensoryAxes = { sucreSale: 1, legerConsistant: 1, chaudFroid: 0, texture: 'test' }
    const envie: CravingAxes = { sucreSale: -1, legerConsistant: -1, chaudFroid: null }
    // k=2 ; diff=(2,2) ; distance=√8=2√2 ; normalisée=2√2/(2√2)=1 → score=1-1=0 (opposition maximale)
    expect(scoreCraving(axes, envie)).toBeCloseTo(0, 10)
  })

  it('texture non-match pénalise sans annuler le score', () => {
    const axes: SensoryAxes = { sucreSale: 1, legerConsistant: 0, chaudFroid: 0, texture: 'croquant' }
    const envie: CravingAxes = { sucreSale: 1, legerConsistant: null, chaudFroid: null }
    // composante euclidienne = 1 (match parfait) ; texture ne matche pas (0) → moyenne = 0.5
    const score = scoreCraving(axes, envie, 'fondant')
    expect(score).toBeCloseTo(0.5, 10)
    expect(score).toBeGreaterThan(0) // pénalisé, pas annulé
  })

  it('texture seule demandée (aucun axe numérique) : composante euclidienne neutre moyennée au match', () => {
    const axes: SensoryAxes = { sucreSale: 1, legerConsistant: 1, chaudFroid: 1, texture: 'croquant' }
    const envie: CravingAxes = { sucreSale: null, legerConsistant: null, chaudFroid: null }
    // composante euclidienne neutre (0.5, rien à comparer) ; texture match (1) → moyenne = 0.75
    expect(scoreCraving(axes, envie, 'croquant')).toBeCloseTo(0.75, 10)
  })

  it('reste dans [0, 1]', () => {
    const axes: SensoryAxes = { sucreSale: -1, legerConsistant: -1, chaudFroid: -1, texture: 'x' }
    const envie: CravingAxes = { sucreSale: 1, legerConsistant: 1, chaudFroid: 1 }
    const score = scoreCraving(axes, envie, 'y')
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })
})

describe('scoring/craving — cravingLayer (contrat SelectionLayer, §6.2 ENGINE)', () => {
  it('id/kind/critical/defaultWeight conformes au registre (§6.3 ENGINE)', () => {
    expect(cravingLayer.id).toBe('craving')
    expect(cravingLayer.kind).toBe('scoring')
    expect(cravingLayer.critical).toBe(false)
    expect(cravingLayer.defaultWeight).toBe(0.2)
  })

  it('invariant §6.1 : un score par candidat reçu, aucune réduction', () => {
    const axesA: SensoryAxes = { sucreSale: 1, legerConsistant: 0, chaudFroid: 0, texture: 'test' }
    const axesB: SensoryAxes = { sucreSale: -1, legerConsistant: 0, chaudFroid: 0, texture: 'test' }
    const recetteA = makeRecipe('a', { axes: axesA })
    const recetteB = makeRecipe('b', { axes: axesB })
    const catalog = makeCatalog([recetteA, recetteB])
    const req = makeRequest()

    const config = cravingLayer.configure(req, catalog)
    const result = asScoringResult(cravingLayer.apply(new Set([recetteA.id, recetteB.id]), config))

    expect(result.scores.size).toBe(2)
  })

  it('aucune envie exprimée (context.envie null) → NEUTRAL_SCORE pour tout candidat', () => {
    const recette = makeRecipe('r', { axes: { sucreSale: 1, legerConsistant: -1, chaudFroid: 1, texture: 'croquant' } })
    const catalog = makeCatalog([recette])
    const req = makeRequest({ envie: null })

    const config = cravingLayer.configure(req, catalog)
    const result = asScoringResult(cravingLayer.apply(new Set([recette.id]), config))

    expect(result.scores.get(recette.id)).toBe(NEUTRAL_SCORE)
  })

  it('candidat absent du catalogue (id orphelin) → NEUTRAL_SCORE, pas de plantage', () => {
    const catalog = makeCatalog([])
    const envie: CravingAxes = { sucreSale: 1, legerConsistant: null, chaudFroid: null }
    const req = makeRequest({ envie })
    const config = cravingLayer.configure(req, catalog)

    const result = asScoringResult(cravingLayer.apply(new Set(['inconnu' as RecipeId]), config))

    expect(result.scores.get('inconnu' as RecipeId)).toBe(NEUTRAL_SCORE)
  })

  it('tous les scores restent dans [0, 1]', () => {
    const recette = makeRecipe('r', { axes: { sucreSale: -1, legerConsistant: -1, chaudFroid: -1, texture: 'x' } })
    const catalog = makeCatalog([recette])
    const envie: CravingAxes = { sucreSale: 1, legerConsistant: 1, chaudFroid: 1 }
    const req = makeRequest({ envie })

    const config = cravingLayer.configure(req, catalog)
    const result = asScoringResult(cravingLayer.apply(new Set([recette.id]), config))

    for (const score of result.scores.values()) {
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    }
  })

  it('cas discriminant : une recette dont les axes matchent l’envie bat celle qui s’y oppose', () => {
    const matchParfait = makeRecipe('match', { axes: { sucreSale: 1, legerConsistant: 0, chaudFroid: 0, texture: 'test' } })
    const oppose = makeRecipe('oppose', { axes: { sucreSale: -1, legerConsistant: 0, chaudFroid: 0, texture: 'test' } })
    const catalog = makeCatalog([matchParfait, oppose])
    const envie: CravingAxes = { sucreSale: 1, legerConsistant: null, chaudFroid: null }
    const req = makeRequest({ envie })

    const config = cravingLayer.configure(req, catalog)
    const result = asScoringResult(cravingLayer.apply(new Set([matchParfait.id, oppose.id]), config))

    expect(result.scores.get(matchParfait.id)!).toBeGreaterThan(result.scores.get(oppose.id)!)
  })
})
