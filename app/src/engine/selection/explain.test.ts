// engine/selection/explain.test.ts — explication des suggestions (docs/ENGINE.md §6.7).
//
// TDD : ce fichier est écrit AVANT explain.ts. Le test central du lot est le premier describe()
// ci-dessous : le cas « profil neuf » où `preference`/`craving`/`variety` rendent NEUTRAL_SCORE à
// TOUS les candidats — leur contribution est donc IDENTIQUE d'une recette à l'autre, et ne doit
// JAMAIS être citée, même quand elle est numériquement la plus forte. Voir l'en-tête d'explain.ts
// pour le raisonnement complet.
//
// ⚠️ LA COUCHE D'EXEMPLE DES FIXTURES EST `habit`, PLUS `nutri`, ET LA RAISON MÉRITE D'ÊTRE LUE.
// Ce fichier prenait `nutri` comme couche d'exemple à peu près partout. Cette identité était un
// COUPLAGE : le jour où `nutri` est devenue muette (`EXPLANATION_LABELS`, décision produit — la
// phrase « apports équilibrés pour ce repas » a été retirée de l'affichage), SEPT tests sont tombés
// d'un coup, dont aucun ne parlait d'équilibre nutritionnel. Ils portent sur le tri, le seuil de
// trois et la discrimination : le sens métier de la couche ne les concerne pas, seul son
// comportement numérique compte.
//
// ⚠️ ET LES TESTS DE PHRASE SONT DÉSORMAIS PILOTÉS PAR LA TABLE ELLE-MÊME (dernier describe), au
// lieu de recopier les libellés attendus. Une liste recopiée à la main dérive en silence — c'est
// exactement ce qui a produit le plantage de `pantry` : la table a gagné une couche, le commentaire
// qui la décrivait ne l'a jamais su.

import { describe, expect, it } from 'vitest'
import type { RecipeId, ScoreBreakdown, ScoringLayerId } from '../domain/index.js'
import { assertNoTherapeuticClaim } from '../guards/index.js'
import { EXPLANATION_LABELS, discriminatingScoringLayers, explainSuggestion } from './explain.js'

function breakdownsOf(entries: ReadonlyArray<readonly [string, ScoreBreakdown]>): ReadonlyMap<RecipeId, ScoreBreakdown> {
  return new Map(entries.map(([id, breakdown]) => [id as RecipeId, breakdown]))
}

describe('selection/explain — cas « profil neuf » (LE test du lot, §6.7 ENGINE)', () => {
  it('une couche à contribution IDENTIQUE sur tous les candidats n’est jamais citée, même la plus forte de toutes', () => {
    // preference (0.30) et craving (0.20) sont IDENTIQUES sur les 3 candidats — signal de profil
    // neuf : preference/craving/variety rendent NEUTRAL_SCORE à tout le monde, donc leur
    // contribution pondérée est la même partout. Seule `habit` varie réellement.
    const breakdowns = breakdownsOf([
      ['a', { habit: 0.1, preference: 0.3, craving: 0.2 }],
      ['b', { habit: 0.25, preference: 0.3, craving: 0.2 }],
      ['c', { habit: 0.05, preference: 0.3, craving: 0.2 }],
    ])

    const explanations = explainSuggestion('a' as RecipeId, breakdowns)

    expect(explanations).toHaveLength(1)
    expect(explanations[0]?.criterion).toBe('habit')
    expect(explanations.some((e) => e.criterion === 'preference')).toBe(false)
    expect(explanations.some((e) => e.criterion === 'craving')).toBe(false)
  })

  it('un seul candidat dans l’ensemble → aucune couche ne discrimine, par définition', () => {
    const breakdowns = breakdownsOf([['a', { habit: 0.9, preference: 0.05 }]])

    expect(discriminatingScoringLayers(breakdowns).size).toBe(0)
    expect(explainSuggestion('a' as RecipeId, breakdowns)).toEqual([])
  })

  it('tous les candidats strictement identiques sur toutes les couches → liste vide, jamais une explication mensongère', () => {
    const breakdowns = breakdownsOf([
      ['a', { habit: 0.3, preference: 0.2 }],
      ['b', { habit: 0.3, preference: 0.2 }],
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
      ['a', { habit: 0.3, preference: 0.25, craving: 0.2, season: 0.15, variety: 0.1 }],
      ['b', { habit: 0.05, preference: 0.05, craving: 0.05, season: 0.05, variety: 0.05 }],
    ])

    const explanations = explainSuggestion('a' as RecipeId, breakdowns)

    expect(explanations).toHaveLength(3)
    expect(explanations.map((e) => e.criterion)).toEqual(['habit', 'preference', 'craving'])
  })

  it('n’en retient que 2 quand seules 2 couches discriminent réellement — jamais de 3e inventée', () => {
    const breakdowns = breakdownsOf([
      ['a', { habit: 0.3, preference: 0.05, craving: 0.2 }],
      ['b', { habit: 0.1, preference: 0.25, craving: 0.2 }], // craving identique → non-discriminant
    ])

    const explanations = explainSuggestion('a' as RecipeId, breakdowns)

    expect(explanations).toHaveLength(2)
    expect(explanations.map((e) => e.criterion)).toEqual(['habit', 'preference'])
  })
})

describe('selection/explain — tri et déterminisme', () => {
  it('trie par contribution décroissante', () => {
    const breakdowns = breakdownsOf([
      ['a', { habit: 0.1, preference: 0.3, craving: 0.2 }],
      ['b', { habit: 0.4, preference: 0.05, craving: 0.35 }],
    ])

    const explanations = explainSuggestion('a' as RecipeId, breakdowns)
    expect(explanations.map((e) => e.criterion)).toEqual(['preference', 'craving', 'habit'])
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
      ['a', { habit: 0.42 }],
      ['b', { habit: 0.1 }],
    ])

    const explanations = explainSuggestion('a' as RecipeId, breakdowns)
    expect(explanations[0]?.contribution).toBe(0.42)
  })
})

describe('selection/explain — authority/evidenceSheetId ne sont jamais inventés', () => {
  it('authority et evidenceSheetId restent absents (seule la couche topic, non implémentée, les porte)', () => {
    const breakdowns = breakdownsOf([
      ['a', { habit: 0.3 }],
      ['b', { habit: 0.1 }],
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
    const breakdowns = breakdownsOf([['a', { habit: 0.3 }]])
    expect(explainSuggestion('inconnu' as RecipeId, breakdowns)).toEqual([])
  })

  it('breakdown vide pour le candidat → liste vide', () => {
    const breakdowns = breakdownsOf([
      ['a', {}],
      ['b', { habit: 0.3 }],
    ])
    expect(explainSuggestion('a' as RecipeId, breakdowns)).toEqual([])
  })
})

// ------------------------------------------------------------------------------------------
// Gabarits de phrase — PILOTÉS PAR `EXPLANATION_LABELS`, jamais recopiés.
//
// ⚠️ CE BLOC EST LA NON-RÉGRESSION D'UN PLANTAGE EN PRODUCTION. La table était partielle et
// `labelFor` LEVAIT sur une couche absente. `pantry` a été implémentée après coup sans recevoir sa
// phrase : dès qu'un garde-manger non vide départageait deux plats, l'exception traversait
// `suggestMeals` et l'écran « Aujourd'hui » n'affichait plus que le texte de l'erreur.
//
// La liste des libellés attendus était recopiée ici à la main — elle n'a donc rien vu venir, et ne
// POUVAIT rien voir : une copie ne détecte pas ce qui manque à l'original. Les tests ci-dessous
// dérivent leurs cas de la table elle-même. Ajouter une couche sans lui donner de sort la fait
// apparaître dans l'un des deux `it.each`, quoi qu'il arrive.
// ------------------------------------------------------------------------------------------

describe('selection/explain — gabarits de phrase (ton neutre et descriptif, §6.2 ARCHITECTURE)', () => {
  const COUCHES = Object.keys(EXPLANATION_LABELS) as readonly ScoringLayerId[]
  const CITABLES = COUCHES.filter((id) => EXPLANATION_LABELS[id] !== null)
  const MUETTES = COUCHES.filter((id) => EXPLANATION_LABELS[id] === null)

  /** Une couche seule dans le breakdown : discriminante par construction, donc citée si elle a une
   *  phrase. Isoler la couche est ce qui rend le résultat imputable à elle et à rien d'autre. */
  const seule = (id: ScoringLayerId) =>
    explainSuggestion(
      'a' as RecipeId,
      breakdownsOf([
        ['a', { [id]: 0.3 } as ScoreBreakdown],
        ['b', { [id]: 0.1 } as ScoreBreakdown],
      ])
    )

  it('la table couvre les onze couches de score du registre, et les deux cas sont peuplés', () => {
    // Sans cette garde, `it.each([])` ne lèverait pas : un `it.each` sur une liste vide ne produit
    // AUCUN test et la suite resterait verte en n'ayant rien vérifié du tout.
    expect(COUCHES).toHaveLength(11)
    expect(CITABLES.length).toBeGreaterThan(0)
    expect(MUETTES.length).toBeGreaterThan(0)
  })

  it.each(CITABLES)('la couche %s est citée avec exactement la phrase de la table', (id) => {
    const explications = seule(id)
    expect(explications).toHaveLength(1)
    expect(explications[0]?.label).toBe(EXPLANATION_LABELS[id])
  })

  // Les explications sont le PREMIER consommateur réel du garde-fou `assertNoTherapeuticClaim`
  // (guards/index.ts) — nos propres gabarits doivent tous le passer sans jamais lever.
  it.each(CITABLES)('la phrase de %s passe assertNoTherapeuticClaim sans lever', (id) => {
    expect(() => assertNoTherapeuticClaim(seule(id))).not.toThrow()
  })

  it.each(MUETTES)('⛔ la couche muette %s ne produit NI phrase NI exception', (id) => {
    // LE PLANTAGE QUE CE TEST GARDE : ici, l'ancienne version LEVAIT.
    expect(seule(id)).toEqual([])
  })

  it('⛔ une couche muette ne consomme pas l’un des trois emplacements', () => {
    // La couche muette porte la PLUS FORTE contribution. Si le filtrage avait lieu après le
    // `slice(0, 3)`, elle prendrait la première place puis serait retirée : il ne resterait que
    // deux phrases là où trois avaient quelque chose à dire — un manque indistinguable d'un vrai
    // « rien à signaler ».
    const muette = MUETTES[0]!
    const breakdowns = breakdownsOf([
      ['a', { [muette]: 0.9, habit: 0.3, preference: 0.25, craving: 0.2 } as ScoreBreakdown],
      ['b', { [muette]: 0.1, habit: 0.05, preference: 0.05, craving: 0.05 } as ScoreBreakdown],
    ])

    const explications = explainSuggestion('a' as RecipeId, breakdowns)
    expect(explications).toHaveLength(3)
    expect(explications.map((e) => e.criterion)).toEqual(['habit', 'preference', 'craving'])
  })
})
