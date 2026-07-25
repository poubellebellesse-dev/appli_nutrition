// engine/selection/diversify.test.ts — diversification par pertinence marginale maximale (MMR),
// docs/ENGINE.md §6.6.
//
// `similarityOf` est une fonction SYNTHÉTIQUE ici (pas `similarity.ts`) — même esprit que les
// couches factices de scoring-pass.test.ts : ces tests prouvent la MÉCANIQUE du réducteur MMR,
// indépendamment de la sémantique réelle de `similarity`.

import { describe, expect, it } from 'vitest'
import type { RecipeId } from '../domain/index.js'
import type { RankedCandidate } from './scoring-pass.js'
import { rankScoredCandidates } from './scoring-pass.js'
import { DEFAULT_MMR_LAMBDA, diversify } from './diversify.js'

function ranked(entries: ReadonlyArray<readonly [string, number]>): readonly RankedCandidate[] {
  return rankScoredCandidates(new Map(entries.map(([id, score]) => [id as RecipeId, score])))
}

/** Similarité symétrique construite à partir d'une table id×id — 0 si la paire n'y figure pas. */
function makeSimilarityOf(pairs: ReadonlyArray<readonly [string, string, number]>): (a: RecipeId, b: RecipeId) => number {
  const table = new Map<string, number>()
  for (const [a, b, sim] of pairs) {
    table.set(`${a}|${b}`, sim)
    table.set(`${b}|${a}`, sim)
  }
  return (a, b) => (a === b ? 1 : table.get(`${a}|${b}`) ?? 0)
}

describe('selection/diversify — diversify (§6.6 ENGINE)', () => {
  it('λ = 0 redonne EXACTEMENT le classement par score (non-régression)', () => {
    const scored = ranked([
      ['a', 0.9],
      ['b', 0.7],
      ['c', 0.5],
      ['d', 0.3],
    ])
    // Similarité non triviale — si elle influençait quoi que ce soit à λ=0, le test le révélerait.
    const similarityOf = makeSimilarityOf([
      ['a', 'b', 1],
      ['a', 'c', 1],
      ['b', 'c', 1],
    ])

    const result = diversify(scored, 4, 0, similarityOf)

    expect(result.map((r) => r.recipeId)).toEqual(scored.map((r) => r.recipeId))
  })

  it('λ = 0, à score égal : même tie-break que rankScoredCandidates (plus petit id gagne)', () => {
    const scored = ranked([
      ['z', 0.5],
      ['a', 0.5],
      ['m', 0.5],
    ])
    const similarityOf = makeSimilarityOf([])

    const result = diversify(scored, 3, 0, similarityOf)

    expect(result.map((r) => r.recipeId)).toEqual(['a', 'm', 'z'])
  })

  it('λ élevé : une 2e recette très similaire à la 1ère est dépassée par une moins bien notée mais différente', () => {
    // a = meilleur score, b = presque aussi bon mais IDENTIQUE (similarité 1) à a, c = moins bon
    // mais complètement différent (similarité 0 avec a). λ élevé doit préférer c à b en 2e position.
    const scored = ranked([
      ['a', 1.0],
      ['b', 0.95],
      ['c', 0.5],
    ])
    const similarityOf = makeSimilarityOf([
      ['a', 'b', 1],
      ['a', 'c', 0],
      ['b', 'c', 0],
    ])

    const result = diversify(scored, 2, 0.9, similarityOf)

    expect(result.map((r) => r.recipeId)).toEqual(['a', 'c'])
  })

  it('le premier retenu est toujours le mieux classé, jamais pénalisé (ensemble retenu vide)', () => {
    const scored = ranked([
      ['a', 0.6],
      ['b', 0.9],
    ])
    // b est mieux noté que a — même avec λ élevé, b doit sortir en premier, sans pénalité.
    const similarityOf = makeSimilarityOf([])

    const result = diversify(scored, 2, 1, similarityOf)

    expect(result[0]!.recipeId).toBe('b')
    expect(result[0]!.maxSimilarityToRetained).toBe(0)
  })

  it('déterminisme strict à valeur ajustée égale : plus petit id de recette gagne', () => {
    // a: score=0.8, similarité à 'retenu'=0.25 → ajusté = 0.8 - 0.4*0.25 = 0.7
    // z: score=0.9, similarité à 'retenu'=0.5  → ajusté = 0.9 - 0.4*0.5  = 0.7  (égalité exacte)
    const scored = ranked([
      ['retenu', 1.0],
      ['z', 0.9],
      ['a', 0.8],
    ])
    const similarityOf = makeSimilarityOf([
      ['retenu', 'z', 0.5],
      ['retenu', 'a', 0.25],
    ])

    const result = diversify(scored, 2, 0.4, similarityOf)

    expect(result.map((r) => r.recipeId)).toEqual(['retenu', 'a'])
  })

  it('limite supérieure au nombre de candidats → retourne tout, sans erreur', () => {
    const scored = ranked([
      ['a', 0.9],
      ['b', 0.5],
    ])
    const similarityOf = makeSimilarityOf([])

    const result = diversify(scored, 10, DEFAULT_MMR_LAMBDA, similarityOf)

    expect(result.map((r) => r.recipeId).sort()).toEqual(['a', 'b'])
    expect(result).toHaveLength(2)
  })

  it('DEFAULT_MMR_LAMBDA vaut 0.4 (§6.6 ENGINE, à calibrer sur le catalogue réel)', () => {
    expect(DEFAULT_MMR_LAMBDA).toBe(0.4)
  })

  it('expose la similarité maximale avec les précédentes retenues, pas une moyenne', () => {
    // Deux retenues avant 'candidat' : similarités 0.2 et 0.9 — le champ exposé doit être le MAX
    // (0.9), pas la moyenne (0.55) : c'est la décision de fond documentée dans diversify.ts.
    const scored = ranked([
      ['r1', 1.0],
      ['r2', 0.99],
      ['candidat', 0.5],
    ])
    const similarityOf = makeSimilarityOf([
      ['r1', 'r2', 0], // pour que r2 soit bien retenu en 2e malgré λ
      ['r1', 'candidat', 0.2],
      ['r2', 'candidat', 0.9],
    ])

    const result = diversify(scored, 3, 0.1, similarityOf)
    const candidat = result.find((r) => r.recipeId === 'candidat')!

    expect(candidat.maxSimilarityToRetained).toBeCloseTo(0.9, 10)
  })
})
