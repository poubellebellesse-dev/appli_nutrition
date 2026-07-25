// engine/selection/scoring-pass.test.ts — la passe de score (docs/ENGINE.md §6.4, §6.5, §6.7).
//
// Trois volets, comme exclusion-pass.test.ts :
//   1. Mécanique du pipeline (résolution des poids, normalisation, breakdown, cas neutre) prouvée
//      avec des couches SYNTHÉTIQUES — indépendante de la sémantique réelle des 6 couches.
//   2. Classement déterministe (tri + tie-break).
//   3. Câblage du garde-fou `assertScoringLayersNeverExclude` (§6.1 ENGINE) sur une couche factice
//      qui omet un candidat.
//
// Le câblage des 6 vraies couches (SCORING_LAYERS) est balayé plus légèrement ici — la couverture
// détaillée par couche vit dans scoring/scoring-layers.test.ts et les tests dédiés par fichier.

import { describe, expect, it } from 'vitest'
import { EngineSafetyError } from '../domain/index.js'
import type { RecipeId, ScoringLayerId } from '../domain/index.js'
import type { CandidateSet, ScoringLayerResult, SelectionLayer } from './index.js'
import { NEUTRAL_SCORE } from './scoring/index.js'
import { SCORING_LAYERS, rankScoredCandidates, runScoringPass } from './scoring-pass.js'
import { makeCatalog, makeRecipe, makeRequest } from './test-fixtures.js'

/** Couche de score synthétique : rend le score fixe fourni pour chaque candidat reçu. */
function makeFakeScoringLayer(
  id: ScoringLayerId,
  defaultWeight: number,
  scoreFor: (recipeId: RecipeId) => number
): SelectionLayer {
  return {
    id,
    kind: 'scoring',
    critical: false,
    defaultWeight,
    configure: () => ({}),
    apply: (candidates: CandidateSet): ScoringLayerResult => {
      const scores = new Map<RecipeId, number>()
      for (const recipeId of candidates) scores.set(recipeId, scoreFor(recipeId))
      return { scores }
    },
  } as SelectionLayer
}

/** Couche qui échouerait le test si `apply` (ou même `configure`) était appelée — preuve qu'une couche à poids ≤ 0 n'est pas exécutée. */
function makeSpyLayerThatMustNotRun(id: ScoringLayerId, defaultWeight: number): SelectionLayer {
  return {
    id,
    kind: 'scoring',
    critical: false,
    defaultWeight,
    configure: () => {
      throw new Error(`${id} : configure() appelé alors que le poids effectif est ≤ 0`)
    },
    apply: () => {
      throw new Error(`${id} : apply() appelé alors que le poids effectif est ≤ 0`)
    },
  } as SelectionLayer
}

describe('selection/scoring-pass — résolution des poids (§6.3 ENGINE)', () => {
  it('normalise des poids arbitraires à Σ = 1 et produit un score dans [0, 1]', () => {
    const catalog = makeCatalog([makeRecipe('a')])
    const req = makeRequest()
    const layerA = makeFakeScoringLayer('nutri', 0.25, () => 0.8)
    const layerB = makeFakeScoringLayer('preference', 0.25, () => 0.4)
    const layerC = makeFakeScoringLayer('season', 0.1, () => 1)

    const result = runScoringPass(catalog, req, new Set(['a' as RecipeId]), [layerA, layerB, layerC])

    // poids retenus 0.25/0.25/0.10 → Σ = 0.6 → normalisés à ~0.4167/0.4167/0.1667
    expect(result.weights.nutri).toBeCloseTo(0.25 / 0.6, 6)
    expect(result.weights.preference).toBeCloseTo(0.25 / 0.6, 6)
    expect(result.weights.season).toBeCloseTo(0.1 / 0.6, 6)
    const score = result.scores.get('a' as RecipeId)!
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('une couche à poids effectif ≤ 0 (defaultWeight) n’est PAS exécutée — ni configure() ni apply()', () => {
    const catalog = makeCatalog([makeRecipe('a')])
    const req = makeRequest()
    const active = makeFakeScoringLayer('nutri', 1, () => 0.7)
    const spy = makeSpyLayerThatMustNotRun('habit', 0) // habit : defaultWeight 0 par conception (§7.5)

    expect(() =>
      runScoringPass(catalog, req, new Set(['a' as RecipeId]), [active, spy])
    ).not.toThrow()
  })

  it('un poids explicite à 0 via req.weights désactive une couche par ailleurs à poids par défaut positif', () => {
    const catalog = makeCatalog([makeRecipe('a')])
    const spy = makeSpyLayerThatMustNotRun('nutri', 0.25)
    const active = makeFakeScoringLayer('preference', 0.25, () => 0.6)
    const req = { ...makeRequest(), weights: { nutri: 0 } }

    expect(() =>
      runScoringPass(catalog, req, new Set(['a' as RecipeId]), [spy, active])
    ).not.toThrow()
  })

  it('la somme des entrées du breakdown est égale au score final (à l’epsilon près)', () => {
    const catalog = makeCatalog([makeRecipe('a'), makeRecipe('b')])
    const req = makeRequest()
    const layerA = makeFakeScoringLayer('nutri', 0.6, (id) => (id === 'a' ? 0.9 : 0.2))
    const layerB = makeFakeScoringLayer('preference', 0.4, () => 0.5)

    const result = runScoringPass(catalog, req, new Set(['a', 'b'] as RecipeId[]), [layerA, layerB])

    for (const recipeId of ['a', 'b'] as RecipeId[]) {
      const breakdown = result.breakdowns.get(recipeId)!
      const sum = Object.values(breakdown).reduce((acc, v) => acc + (v ?? 0), 0)
      expect(sum).toBeCloseTo(result.scores.get(recipeId)!, 9)
    }
  })

  it('breakdown = CONTRIBUTION pondérée (poids normalisé × score brut), pas le score brut', () => {
    const catalog = makeCatalog([makeRecipe('a')])
    const req = makeRequest()
    // Deux couches à poids égal (0.5/0.5 après normalisation) : la contribution de chacune doit
    // être la moitié de son score brut, jamais le score brut lui-même.
    const layerA = makeFakeScoringLayer('nutri', 1, () => 1)
    const layerB = makeFakeScoringLayer('preference', 1, () => 0)

    const result = runScoringPass(catalog, req, new Set(['a' as RecipeId]), [layerA, layerB])
    const breakdown = result.breakdowns.get('a' as RecipeId)!

    expect(breakdown.nutri).toBeCloseTo(0.5, 9) // 0.5 (poids) × 1 (score brut), PAS 1
    expect(breakdown.preference).toBeCloseTo(0, 9)
    expect(result.scores.get('a' as RecipeId)).toBeCloseTo(0.5, 9)
  })

  it('tous les poids à 0 (ou aucune couche) → NEUTRAL_SCORE pour tous, aucun signal ≠ mauvais', () => {
    const catalog = makeCatalog([makeRecipe('a'), makeRecipe('b')])
    const req = makeRequest()
    const spyA = makeSpyLayerThatMustNotRun('nutri', 0)
    const spyB = makeSpyLayerThatMustNotRun('preference', 0)

    const result = runScoringPass(catalog, req, new Set(['a', 'b'] as RecipeId[]), [spyA, spyB])

    expect(result.scores.get('a' as RecipeId)).toBe(NEUTRAL_SCORE)
    expect(result.scores.get('b' as RecipeId)).toBe(NEUTRAL_SCORE)
  })

  it('aucune couche fournie (tableau vide) → NEUTRAL_SCORE pour tous', () => {
    const catalog = makeCatalog([makeRecipe('a')])
    const req = makeRequest()

    const result = runScoringPass(catalog, req, new Set(['a' as RecipeId]), [])

    expect(result.scores.get('a' as RecipeId)).toBe(NEUTRAL_SCORE)
  })

  it("rejette (TypeError) si une couche de nature 'exclusion' est passée par erreur", () => {
    const catalog = makeCatalog([makeRecipe('a')])
    const req = makeRequest()
    const exclusionLayer: SelectionLayer = {
      id: 'temps',
      kind: 'exclusion',
      critical: false,
      defaultWeight: 0,
      configure: () => ({}),
      apply: () => ({ kept: new Set(), rejected: [] }),
    }

    expect(() =>
      runScoringPass(catalog, req, new Set(['a' as RecipeId]), [exclusionLayer])
    ).toThrow(TypeError)
  })
})

describe('selection/scoring-pass — classement déterministe (§6.5 précision 7 ENGINE)', () => {
  it('trie par score décroissant', () => {
    const scores = new Map<RecipeId, number>([
      ['a' as RecipeId, 0.3],
      ['b' as RecipeId, 0.9],
      ['c' as RecipeId, 0.5],
    ])

    expect(rankScoredCandidates(scores).map((r) => r.recipeId)).toEqual(['b', 'c', 'a'])
  })

  it('à score strictement égal, tie-break stable par id de recette croissant, quel que soit l’ordre d’insertion', () => {
    const insertedZFirst = new Map<RecipeId, number>([
      ['z' as RecipeId, 0.5],
      ['a' as RecipeId, 0.5],
      ['m' as RecipeId, 0.5],
    ])
    const insertedAFirst = new Map<RecipeId, number>([
      ['a' as RecipeId, 0.5],
      ['m' as RecipeId, 0.5],
      ['z' as RecipeId, 0.5],
    ])

    const expected = ['a', 'm', 'z']
    expect(rankScoredCandidates(insertedZFirst).map((r) => r.recipeId)).toEqual(expected)
    expect(rankScoredCandidates(insertedAFirst).map((r) => r.recipeId)).toEqual(expected)
  })

  it('combine tri par score puis tie-break sur les égalités seulement', () => {
    const scores = new Map<RecipeId, number>([
      ['z' as RecipeId, 0.9],
      ['b' as RecipeId, 0.5],
      ['a' as RecipeId, 0.5],
      ['y' as RecipeId, 0.9],
    ])

    expect(rankScoredCandidates(scores).map((r) => r.recipeId)).toEqual(['y', 'z', 'a', 'b'])
  })
})

describe('selection/scoring-pass — garde-fou §6.1 (assertScoringLayersNeverExclude) câblé', () => {
  it('lève EngineSafetyError quand une couche de score FACTICE omet un candidat', () => {
    const catalog = makeCatalog([makeRecipe('a'), makeRecipe('b')])
    const req = makeRequest()
    const brokenLayer: SelectionLayer = {
      id: 'nutri',
      kind: 'scoring',
      critical: false,
      defaultWeight: 1,
      configure: () => ({}),
      apply: (candidates: CandidateSet): ScoringLayerResult => {
        const scores = new Map<RecipeId, number>()
        let skipped = false
        for (const recipeId of candidates) {
          if (!skipped) {
            skipped = true // omet délibérément le premier candidat rencontré
            continue
          }
          scores.set(recipeId, 0.5)
        }
        return { scores }
      },
    }

    expect(() =>
      runScoringPass(catalog, req, new Set(['a', 'b'] as RecipeId[]), [brokenLayer])
    ).toThrow(EngineSafetyError)
  })
})

describe('selection/scoring-pass — câblage des 6 vraies couches (SCORING_LAYERS)', () => {
  it('SCORING_LAYERS contient exactement les 6 couches de score implémentées', () => {
    expect(SCORING_LAYERS.map((layer) => layer.id).sort()).toEqual(
      ['craving', 'habit', 'nutri', 'preference', 'season', 'variety'].sort()
    )
  })

  it('produit un score et un breakdown pour chaque candidat sur un petit catalogue en mémoire', () => {
    const catalog = makeCatalog([makeRecipe('a'), makeRecipe('b')])
    const req = makeRequest()

    const result = runScoringPass(catalog, req, new Set(['a', 'b'] as RecipeId[]))

    expect(result.scores.size).toBe(2)
    expect(result.breakdowns.size).toBe(2)
    for (const recipeId of ['a', 'b'] as RecipeId[]) {
      const score = result.scores.get(recipeId)!
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    }
  })
})
