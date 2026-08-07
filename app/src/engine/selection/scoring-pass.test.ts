// engine/selection/scoring-pass.test.ts — la passe de score (docs/ENGINE.md §6.4, §6.5, §6.7).
//
// Trois volets, comme exclusion-pass.test.ts :
//   1. Mécanique du pipeline (résolution des poids, normalisation, breakdown, cas neutre) prouvée
//      avec des couches SYNTHÉTIQUES — indépendante de la sémantique réelle des 6 couches.
//   2. Classement déterministe (tri + tie-break).
//   3. Câblage du garde-fou `assertScoringLayersNeverExclude` (§6.1 ENGINE) sur une couche factice
//      qui omet un candidat.
//
// Le câblage des 7 vraies couches (SCORING_LAYERS) est balayé plus légèrement ici — la couverture
// détaillée par couche vit dans scoring/scoring-layers.test.ts et les tests dédiés par fichier.
//
// Un 4e volet couvre la RÉSOLUTION DES POIDS ajoutée cette session : archétypes (§6.3 bis),
// bascule dynamique de `craving` (§6.5) et leur précédence — voir les describe() en bas de fichier.

import { describe, expect, it } from 'vitest'
import { EngineSafetyError } from '../domain/index.js'
import type { ArchetypeId, RecipeId, ScoringLayerId } from '../domain/index.js'
import type { CandidateSet, ScoringLayerResult, SelectionLayer } from './index.js'
import { NEUTRAL_SCORE } from './scoring/index.js'
import { mulberry32 } from './prng.js'
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

describe('selection/scoring-pass — tirage seedé dans la bande de tolérance (correctif variété)', () => {
  function scoresOf(entries: readonly [string, number][]): ReadonlyMap<RecipeId, number> {
    return new Map(entries.map(([id, score]) => [id as RecipeId, score]))
  }

  it('non-régression : sans `alea`, EXACTEMENT le même résultat qu’avant (score puis id)', () => {
    const scores = scoresOf([
      ['z', 0.9],
      ['b', 0.5],
      ['a', 0.5],
      ['y', 0.9],
    ])

    expect(rankScoredCandidates(scores).map((r) => r.recipeId)).toEqual(['y', 'z', 'a', 'b'])
  })

  it('non-régression : `tolerance` à 0 (avec `alea` fourni) rend aussi le classement inchangé', () => {
    const scores = scoresOf([
      ['a', 0.3],
      ['b', 0.9],
      ['c', 0.5],
    ])
    const aleaQuiNeDoitJamaisEtreAppele = () => {
      throw new Error('alea() appelé alors que tolerance <= 0 — le régime déterministe ne doit rien tirer')
    }

    expect(rankScoredCandidates(scores, aleaQuiNeDoitJamaisEtreAppele, 0).map((r) => r.recipeId)).toEqual([
      'b',
      'c',
      'a',
    ])
  })

  it('reproductibilité : même `alea` (même graine) → même résultat à chaque appel', () => {
    const scores = scoresOf([
      ['a', 0.80],
      ['b', 0.79],
      ['c', 0.78],
      ['d', 0.50],
    ])
    // Générateur déterministe simple, indépendant de `mulberry32` — ce fichier teste
    // `rankScoredCandidates`, pas le PRNG (voir prng.test.ts pour mulberry32 lui-même).
    const suite = [0.9, 0.1, 0.5, 0.3]
    const nextFrom = (valeurs: readonly number[]) => {
      let i = 0
      return () => valeurs[i++ % valeurs.length]!
    }

    const premier = rankScoredCandidates(scores, nextFrom(suite), 0.03)
    const second = rankScoredCandidates(scores, nextFrom(suite), 0.03)
    expect(premier).toEqual(second)
  })

  it('qualité préservée : aucun candidat retenu n’a un score inférieur à meilleur × (1 − tolerance)', () => {
    const scores = scoresOf([
      ['a', 1.0],
      ['b', 0.99],
      ['c', 0.5], // hors bande à 3 % : ne doit JAMAIS passer devant a/b
      ['d', 0.4],
    ])
    const tolerance = 0.03
    const meilleur = 1.0

    // Balaie plusieurs tirages possibles (`alea` constant à chaque valeur de [0,1)) : quel que soit
    // le tirage, le premier retenu reste dans la bande des 3 % du meilleur.
    for (const valeurAlea of [0, 0.25, 0.5, 0.75, 0.999]) {
      const ranked = rankScoredCandidates(scores, () => valeurAlea, tolerance)
      expect(ranked[0]!.score).toBeGreaterThanOrEqual(meilleur * (1 - tolerance))
    }
  })

  it('le tirage ne peut PAS faire remonter un candidat hors de la bande devant un meilleur', () => {
    // `alea` renvoie toujours 0.999 (proche de 1, donc le DERNIER élément de chaque réserve) — le
    // cas le plus agressif pour faire sortir un mauvais candidat de sa réserve.
    const scores = scoresOf([
      ['a', 1.0],
      ['b', 0.5], // largement hors bande
    ])
    const ranked = rankScoredCandidates(scores, () => 0.999, 0.03)
    expect(ranked.map((r) => r.recipeId)).toEqual(['a', 'b']) // réserve du 1er tour = {a} seul
  })

  it('même ensemble de candidats en sortie qu’en entrée — le tirage réordonne, ne filtre ni ne duplique', () => {
    const scores = scoresOf([
      ['a', 0.9],
      ['b', 0.895],
      ['c', 0.89],
      ['d', 0.3],
    ])
    const ranked = rankScoredCandidates(scores, () => 0.5, 0.03)
    expect(new Set(ranked.map((r) => r.recipeId))).toEqual(new Set(['a', 'b', 'c', 'd']))
    expect(ranked).toHaveLength(4)
  })

  it("scénario vérifié à la main : le retrait (au lieu de l'échange) garde le vrai maximum en tête à chaque tour, C ne passe jamais devant A/B", () => {
    // A=1.00, B=0.985, E=0.975, C=0.965, D=0.50, tolerance=0.03.
    // Avec l'ANCIEN code (échange) : i=1, pivot = B = 0.985 (A enterré en index 2 par l'échange
    // précédent) → seuil 0.95545 → C=0.965 entre indûment dans la réserve → C se retrouvait
    // devant A, alors que la bande de A commence à 0.97 (C est hors bande).
    // Avec le retrait, `restants[0]` reste TOUJOURS le vrai maximum : la réserve du 1er tour est
    // exactement {A,B,E} (seuil 0.97, C=0.965 exclu), puis {A,B} (C=0.965 toujours exclu, seuil
    // recalculé sur A=1.00), puis {A} seul, C n'entre dans aucune réserve avant D.
    const scores = scoresOf([
      ['a', 1.0],
      ['b', 0.985],
      ['e', 0.975],
      ['c', 0.965],
      ['d', 0.5],
    ])
    const suite = [0.7, 0.9, 0, 0, 0]
    let i = 0
    const alea = () => suite[i++]!

    const ranked = rankScoredCandidates(scores, alea, 0.03)

    expect(ranked.map((r) => r.recipeId)).toEqual(['e', 'b', 'a', 'c', 'd'])
  })

  it('invariant général : pour tout i < j du résultat, score[i] >= score[j] * (1 - tolerance) — sur plusieurs jeux de scores et 20+ graines mulberry32', () => {
    const jeuxDeScores: ReadonlyArray<ReadonlyArray<[string, number]>> = [
      [
        ['a', 1.0],
        ['b', 0.985],
        ['e', 0.975],
        ['c', 0.965],
        ['d', 0.5],
      ],
      [
        ['a', 0.9],
        ['b', 0.895],
        ['c', 0.89],
        ['d', 0.3],
      ],
      [
        ['a', 1.0],
        ['b', 0.99],
        ['c', 0.98],
        ['d', 0.97],
        ['e', 0.96],
        ['f', 0.95],
        ['g', 0.5],
      ],
    ]
    const tolerance = 0.03

    for (const jeu of jeuxDeScores) {
      const scores = scoresOf(jeu)
      for (let graine = 1; graine <= 20; graine++) {
        const ranked = rankScoredCandidates(scores, mulberry32(graine), tolerance)
        for (let i = 0; i < ranked.length; i++) {
          for (let j = i + 1; j < ranked.length; j++) {
            expect(ranked[i]!.score).toBeGreaterThanOrEqual(ranked[j]!.score * (1 - tolerance))
          }
        }
      }
    }
  })

  it('conservation de l’ensemble : mêmes recipeId qu’en entrée, sans perte ni doublon, sur plusieurs graines', () => {
    const scores = scoresOf([
      ['a', 1.0],
      ['b', 0.985],
      ['e', 0.975],
      ['c', 0.965],
      ['d', 0.5],
    ])
    const attendu = new Set(['a', 'b', 'e', 'c', 'd'])

    for (let graine = 1; graine <= 20; graine++) {
      const ranked = rankScoredCandidates(scores, mulberry32(graine), 0.03)
      expect(ranked).toHaveLength(5)
      expect(new Set(ranked.map((r) => r.recipeId))).toEqual(attendu)
    }
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

describe('selection/scoring-pass — câblage des vraies couches (SCORING_LAYERS)', () => {
  it('SCORING_LAYERS contient exactement les 9 couches de score implémentées', () => {
    // `pantry` a rejoint la liste le 2026-07-28 (§10.2 ①, « vider le frigo »), `piquant` le
    // 2026-08-07 (décision 35). Restent déclarées mais non implémentées : `occasion`, `topic`,
    // `cost` (P2).
    expect(SCORING_LAYERS.map((layer) => layer.id).sort()).toEqual(
      ['craving', 'habit', 'nutri', 'pantry', 'piquant', 'preference', 'season', 'speed', 'variety'].sort()
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

// ------------------------------------------------------------------------------------------
// Archétypes (§6.3 bis ENGINE) — résolus par `runScoringPass` sur les 7 VRAIES couches
// (SCORING_LAYERS), pas des couches synthétiques : c'est justement l'interaction entre la
// surcharge d'archétype et les `defaultWeight` réels du registre qu'on veut prouver.
// ------------------------------------------------------------------------------------------

describe('selection/scoring-pass — archétypes (§6.3 bis ENGINE)', () => {
  // Poids de référence (defaultWeight, LAYER_DESCRIPTORS) des couches réellement dans
  // SCORING_LAYERS — `pantry`/`occasion`/`topic`/`cost` n'y figurent jamais (non implémentées),
  // listées ici uniquement pour satisfaire `Record<ScoringLayerId, number>`.
  const REFERENCE_WEIGHTS: Record<ScoringLayerId, number> = {
    nutri: 0.25,
    preference: 0.25,
    craving: 0.2,
    variety: 0.15,
    season: 0.1,
    // `pantry` est un bonus MODÉRÉ en mode normal (§10.2 ①) ; le mode « vider le frigo » passe
    // par `req.weights`, qui prime sur tout — pas de drapeau supplémentaire.
    pantry: 0.05,
    habit: 0,
    occasion: 0,
    speed: 0,
    topic: 0,
    cost: 0,
    // `piquant` a `defaultWeight: 0` : sa couche ne tourne que si une tolerance est DECLAREE,
    // par le poids dynamique `PIQUANT_DYNAMIC_WEIGHT` (decision 35). Aucun archetype ne la releve.
    piquant: 0,
  }

  /** Poids normalisés attendus (Σ = 1 sur les couches à poids > 0 seulement) pour `overrides`. */
  function expectedNormalizedWeights(
    overrides: Partial<Record<ScoringLayerId, number>>
  ): ReadonlyMap<ScoringLayerId, number> {
    const raw = { ...REFERENCE_WEIGHTS, ...overrides }
    const active = (Object.entries(raw) as Array<[ScoringLayerId, number]>).filter(([, w]) => w > 0)
    const total = active.reduce((sum, [, w]) => sum + w, 0)
    return new Map(active.map(([id, w]) => [id, w / total]))
  }

  const ARCHETYPE_CASES: ReadonlyArray<readonly [ArchetypeId, Partial<Record<ScoringLayerId, number>>]> = [
    ['equilibre', {}],
    ['envie', { craving: 0.4 }],
    ['decouverte', { variety: 0.35 }],
    ['de_saison', { season: 0.3 }],
    ['mes_gouts', { preference: 0.4 }],
    ['rapide', { speed: 0.3 }],
  ]

  it.each(ARCHETYPE_CASES)(
    '%s : relève sa couche, les autres gardent leur poids de référence — poids normalisés exacts',
    (archetype, overrides) => {
      const catalog = makeCatalog([makeRecipe('a')])
      const req = { ...makeRequest(), archetype }

      const result = runScoringPass(catalog, req, new Set(['a' as RecipeId]))
      const expected = expectedNormalizedWeights(overrides)

      expect(Object.keys(result.weights).sort()).toEqual([...expected.keys()].sort())
      for (const [id, weight] of expected) {
        expect(result.weights[id]).toBeCloseTo(weight, 9)
      }
    }
  )

  it('absence d’archétype (champ omis) produit exactement les mêmes poids que l’archétype "equilibre" explicite', () => {
    const catalog = makeCatalog([makeRecipe('a')])
    const sansArchetype = runScoringPass(catalog, makeRequest(), new Set(['a' as RecipeId]))
    const equilibreExplicite = runScoringPass(
      catalog,
      { ...makeRequest(), archetype: 'equilibre' as const },
      new Set(['a' as RecipeId])
    )

    expect(sansArchetype.weights).toEqual(equilibreExplicite.weights)
  })

  it('l’archétype "rapide" rend `speed` réellement exécutée — poids nul (couche absente) sans lui', () => {
    const catalog = makeCatalog([makeRecipe('a')])
    const sansArchetype = runScoringPass(catalog, makeRequest(), new Set(['a' as RecipeId]))
    const rapide = runScoringPass(catalog, { ...makeRequest(), archetype: 'rapide' as const }, new Set(['a' as RecipeId]))

    expect(sansArchetype.weights.speed).toBeUndefined() // poids ≤ 0 → couche non exécutée, absente
    expect(rapide.weights.speed).toBeGreaterThan(0)
  })
})

// ------------------------------------------------------------------------------------------
// Poids dynamique de `craving` (§6.5 ENGINE, « Poids dynamiques ») — n'a d'effet qu'en contexte
// « Aujourd'hui » : `req.context.envie` porte l'information, aucun drapeau de contexte séparé.
// ------------------------------------------------------------------------------------------

describe('selection/scoring-pass — bascule dynamique de `craving` (§6.5 ENGINE)', () => {
  it('envie réellement exprimée (≥ 1 axe non null) → craving devient le poids le plus élevé', () => {
    const catalog = makeCatalog([makeRecipe('a')])
    const req = makeRequest({ envie: { sucreSale: 1, legerConsistant: null, chaudFroid: null } })

    const result = runScoringPass(catalog, req, new Set(['a' as RecipeId]))
    const cravingWeight = result.weights.craving!

    for (const [id, weight] of Object.entries(result.weights)) {
      if (id === 'craving') continue
      expect(cravingWeight).toBeGreaterThan(weight!)
    }
  })

  it('sans envie (`envie: null`) → craving reste à son poids de référence, identique à `equilibre`', () => {
    const catalog = makeCatalog([makeRecipe('a')])
    const sansEnvie = runScoringPass(catalog, makeRequest({ envie: null }), new Set(['a' as RecipeId]))
    const equilibre = runScoringPass(
      catalog,
      { ...makeRequest(), archetype: 'equilibre' as const },
      new Set(['a' as RecipeId])
    )

    expect(sansEnvie.weights.craving).toBeCloseTo(equilibre.weights.craving!, 9)
  })

  it('objet d’envie dont les 3 axes sont `null` → NE déclenche PAS la bascule (envie « vide »)', () => {
    const catalog = makeCatalog([makeRecipe('a')])
    const envieVide = runScoringPass(
      catalog,
      makeRequest({ envie: { sucreSale: null, legerConsistant: null, chaudFroid: null } }),
      new Set(['a' as RecipeId])
    )
    const sansEnvie = runScoringPass(catalog, makeRequest({ envie: null }), new Set(['a' as RecipeId]))

    expect(envieVide.weights.craving).toBeCloseTo(sansEnvie.weights.craving!, 9)
  })
})

// ------------------------------------------------------------------------------------------
// Précédence des poids : `defaultWeight` < archétype < bascule dynamique de `craving` <
// `req.weights` explicite (documentée en en-tête de scoring-pass.ts).
// ------------------------------------------------------------------------------------------

describe('selection/scoring-pass — précédence des poids', () => {
  it('req.weights.craving explicite gagne sur la bascule dynamique, même avec une envie exprimée', () => {
    const catalog = makeCatalog([makeRecipe('a')])
    const req = {
      ...makeRequest({ envie: { sucreSale: 1, legerConsistant: null, chaudFroid: null } }),
      weights: { craving: 0.05 },
    }

    const result = runScoringPass(catalog, req, new Set(['a' as RecipeId]))

    // 0.05 explicite doit primer sur CRAVING_DYNAMIC_WEIGHT (0.50 brut) : craving redevient un
    // poids FAIBLE malgré l'envie exprimée, plus bas que nutri (0.25 brut, inchangé).
    expect(result.weights.craving!).toBeLessThan(result.weights.nutri!)
  })

  it('la bascule dynamique de craving gagne sur l’archétype actif (qui relève une autre couche)', () => {
    const catalog = makeCatalog([makeRecipe('a')])
    const req = {
      ...makeRequest({ envie: { sucreSale: 1, legerConsistant: null, chaudFroid: null } }),
      archetype: 'decouverte' as const, // relève `variety` (0.35 brut) — pas `craving`
    }

    const result = runScoringPass(catalog, req, new Set(['a' as RecipeId]))
    const cravingWeight = result.weights.craving!

    // craving (0.50 brut, bascule) doit rester devant variety (0.35 brut, archétype).
    for (const [id, weight] of Object.entries(result.weights)) {
      if (id === 'craving') continue
      expect(cravingWeight).toBeGreaterThan(weight!)
    }
  })
})
