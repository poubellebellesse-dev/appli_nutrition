// engine/selection/explain.test.ts — explication des suggestions (docs/ENGINE.md §6.7).
//
// TDD : ce fichier est écrit AVANT explain.ts. Le test central du lot est le premier describe()
// ci-dessous : le cas « profil neuf » où `preference`/`craving`/`variety` rendent NEUTRAL_SCORE à
// TOUS les candidats — leur contribution est donc IDENTIQUE d'une recette à l'autre, et ne doit
// JAMAIS être citée, même quand elle est numériquement la plus forte. Voir l'en-tête d'explain.ts
// pour le raisonnement complet.

import { describe, expect, it } from 'vitest'
import type { RecipeId, ScoreBreakdown, ScoringLayerId } from '../domain/index.js'
import { assertNoTherapeuticClaim } from '../guards/index.js'
import { discriminatingScoringLayers, explainSuggestion } from './explain.js'

function breakdownsOf(entries: ReadonlyArray<readonly [string, ScoreBreakdown]>): ReadonlyMap<RecipeId, ScoreBreakdown> {
  return new Map(entries.map(([id, breakdown]) => [id as RecipeId, breakdown]))
}

describe('selection/explain — cas « profil neuf » (LE test du lot, §6.7 ENGINE)', () => {
  it('une couche à contribution IDENTIQUE sur tous les candidats n’est jamais citée, même la plus forte de toutes', () => {
    // preference (0.30) et craving (0.20) sont IDENTIQUES sur les 3 candidats — signal de profil
    // neuf : preference/craving/variety rendent NEUTRAL_SCORE à tout le monde, donc leur
    // contribution pondérée est la même partout. Seul nutri varie réellement.
    const breakdowns = breakdownsOf([
      ['a', { nutri: 0.1, preference: 0.3, craving: 0.2 }],
      ['b', { nutri: 0.25, preference: 0.3, craving: 0.2 }],
      ['c', { nutri: 0.05, preference: 0.3, craving: 0.2 }],
    ])

    const explanations = explainSuggestion('a' as RecipeId, breakdowns)

    expect(explanations).toHaveLength(1)
    expect(explanations[0]?.criterion).toBe('nutri')
    expect(explanations.some((e) => e.criterion === 'preference')).toBe(false)
    expect(explanations.some((e) => e.criterion === 'craving')).toBe(false)
  })

  it('un seul candidat dans l’ensemble → aucune couche ne discrimine, par définition', () => {
    const breakdowns = breakdownsOf([['a', { nutri: 0.9, preference: 0.05 }]])

    expect(discriminatingScoringLayers(breakdowns).size).toBe(0)
    expect(explainSuggestion('a' as RecipeId, breakdowns)).toEqual([])
  })

  it('tous les candidats strictement identiques sur toutes les couches → liste vide, jamais une explication mensongère', () => {
    const breakdowns = breakdownsOf([
      ['a', { nutri: 0.3, preference: 0.2 }],
      ['b', { nutri: 0.3, preference: 0.2 }],
    ])

    expect(explainSuggestion('a' as RecipeId, breakdowns)).toEqual([])
    expect(explainSuggestion('b' as RecipeId, breakdowns)).toEqual([])
  })
})

describe('selection/explain — comparaison à epsilon près (flottants)', () => {
  it('un écart flottant infime (< epsilon) n’est pas traité comme une discrimination réelle', () => {
    const breakdowns = breakdownsOf([
      ['a', { preference: 0.2 + 1e-12 }],
      ['b', { preference: 0.2 }],
    ])

    expect(discriminatingScoringLayers(breakdowns).has('preference')).toBe(false)
    expect(explainSuggestion('a' as RecipeId, breakdowns)).toEqual([])
  })

  it('un écart réel, même petit mais supérieur à epsilon, est bien détecté comme discriminant', () => {
    const breakdowns = breakdownsOf([
      ['a', { preference: 0.2 + 1e-6 }],
      ['b', { preference: 0.2 }],
    ])

    expect(discriminatingScoringLayers(breakdowns).has('preference')).toBe(true)
    expect(explainSuggestion('a' as RecipeId, breakdowns).some((e) => e.criterion === 'preference')).toBe(true)
  })
})

describe('selection/explain — au plus trois, jamais de remplissage', () => {
  it('retient exactement les 3 plus fortes contributions quand au moins 3 couches discriminent', () => {
    const breakdowns = breakdownsOf([
      ['a', { nutri: 0.3, preference: 0.25, craving: 0.2, season: 0.15, variety: 0.1 }],
      ['b', { nutri: 0.05, preference: 0.05, craving: 0.05, season: 0.05, variety: 0.05 }],
    ])

    const explanations = explainSuggestion('a' as RecipeId, breakdowns)

    expect(explanations).toHaveLength(3)
    expect(explanations.map((e) => e.criterion)).toEqual(['nutri', 'preference', 'craving'])
  })

  it('n’en retient que 2 quand seules 2 couches discriminent réellement — jamais de 3e inventée', () => {
    const breakdowns = breakdownsOf([
      ['a', { nutri: 0.3, preference: 0.05, craving: 0.2 }],
      ['b', { nutri: 0.1, preference: 0.25, craving: 0.2 }], // craving identique → non-discriminant
    ])

    const explanations = explainSuggestion('a' as RecipeId, breakdowns)

    expect(explanations).toHaveLength(2)
    expect(explanations.map((e) => e.criterion)).toEqual(['nutri', 'preference'])
  })
})

describe('selection/explain — tri et déterminisme', () => {
  it('trie par contribution décroissante', () => {
    const breakdowns = breakdownsOf([
      ['a', { nutri: 0.1, preference: 0.3, craving: 0.2 }],
      ['b', { nutri: 0.4, preference: 0.05, craving: 0.35 }],
    ])

    const explanations = explainSuggestion('a' as RecipeId, breakdowns)
    expect(explanations.map((e) => e.criterion)).toEqual(['preference', 'craving', 'nutri'])
  })

  it('départage déterministe par id de couche croissant à contribution strictement égale', () => {
    const breakdowns = breakdownsOf([
      ['a', { season: 0.2, craving: 0.2 }],
      ['b', { season: 0.05, craving: 0.05 }],
    ])

    const explanations = explainSuggestion('a' as RecipeId, breakdowns)
    expect(explanations.map((e) => e.criterion)).toEqual(['craving', 'season']) // 'craving' < 'season'
  })
})

describe('selection/explain — contribution = valeur du breakdown, sans recalcul', () => {
  it('la contribution de l’explication est exactement celle du breakdown (0 → 1)', () => {
    const breakdowns = breakdownsOf([
      ['a', { nutri: 0.42 }],
      ['b', { nutri: 0.1 }],
    ])

    const explanations = explainSuggestion('a' as RecipeId, breakdowns)
    expect(explanations[0]?.contribution).toBe(0.42)
  })
})

describe('selection/explain — authority/evidenceSheetId ne sont jamais inventés', () => {
  it('authority et evidenceSheetId restent absents (seule la couche topic, non implémentée, les porte)', () => {
    const breakdowns = breakdownsOf([
      ['a', { nutri: 0.3 }],
      ['b', { nutri: 0.1 }],
    ])

    const explanations = explainSuggestion('a' as RecipeId, breakdowns)
    expect(explanations[0]?.authority).toBeUndefined()
    expect(explanations[0]?.evidenceSheetId).toBeUndefined()
    expect('authority' in explanations[0]!).toBe(false)
    expect('evidenceSheetId' in explanations[0]!).toBe(false)
  })
})

describe('selection/explain — défensif', () => {
  it('recipeId absent de l’ensemble de breakdowns → liste vide plutôt qu’une exception', () => {
    const breakdowns = breakdownsOf([['a', { nutri: 0.3 }]])
    expect(explainSuggestion('inconnu' as RecipeId, breakdowns)).toEqual([])
  })

  it('breakdown vide pour le candidat → liste vide', () => {
    const breakdowns = breakdownsOf([
      ['a', {}],
      ['b', { nutri: 0.3 }],
    ])
    expect(explainSuggestion('a' as RecipeId, breakdowns)).toEqual([])
  })
})

// ------------------------------------------------------------------------------------------
// Gabarits de phrase — un par couche de score IMPLÉMENTÉE (§6.7 ENGINE). Chaque test isole sa
// couche (seule clé du breakdown) pour garantir qu'elle est bien discriminante et donc citée.
// ------------------------------------------------------------------------------------------

describe('selection/explain — gabarits de phrase par couche (ton neutre et descriptif, §6.2 ARCHITECTURE)', () => {
  const LABELS: ReadonlyArray<readonly [ScoringLayerId, string]> = [
    ['nutri', 'apports équilibrés pour ce repas'],
    ['preference', 'proche de vos goûts'],
    ['craving', "correspond à l'envie exprimée"],
    ['season', 'ingrédients de saison'],
    ['variety', 'change de vos derniers repas'],
    ['habit', 'dans vos habitudes'],
    ['speed', 'rapide à préparer'],
  ]

  it.each(LABELS)('gabarit de la couche %s : "%s"', (id, expectedLabel) => {
    const breakdowns = breakdownsOf([
      ['a', { [id]: 0.3 } as ScoreBreakdown],
      ['b', { [id]: 0.1 } as ScoreBreakdown],
    ])

    const explanations = explainSuggestion('a' as RecipeId, breakdowns)
    expect(explanations).toHaveLength(1)
    expect(explanations[0]?.label).toBe(expectedLabel)
  })

  // Non-régression (§6.2 ARCHITECTURE) : les explications sont le PREMIER consommateur réel du
  // garde-fou assertNoTherapeuticClaim (guards/index.ts) — nos propres gabarits doivent tous le
  // passer sans jamais lever.
  it.each(LABELS)('la phrase de %s passe assertNoTherapeuticClaim sans lever (non-régression)', (id) => {
    const breakdowns = breakdownsOf([
      ['a', { [id]: 0.3 } as ScoreBreakdown],
      ['b', { [id]: 0.1 } as ScoreBreakdown],
    ])
    const explanations = explainSuggestion('a' as RecipeId, breakdowns)

    expect(() => assertNoTherapeuticClaim(explanations)).not.toThrow()
  })
})
