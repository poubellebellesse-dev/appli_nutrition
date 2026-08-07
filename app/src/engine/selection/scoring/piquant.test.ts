import { describe, expect, it } from 'vitest'
import type { PiquantTolerance, RecipeId } from '../../domain/index.js'
import { piquantLayer, scorePiquant } from './piquant.js'
import { NEUTRAL_SCORE } from './index.js'
import { asScoringResult, makeCatalog, makeRecipe, makeRequest } from '../test-fixtures.js'

describe('scorePiquant — ce qui reste neutre', () => {
  // ⚠️ LES TROIS NEUTRALITÉS SONT LE CŒUR DE LA DÉCISION 35. Chacune protège d'une promesse fausse
  // différente ; les confondre reviendrait à croire qu'une seule suffit.
  it('rend neutre quand AUCUNE tolérance n’a été déclarée', () => {
    for (const p of [0, 1, 2, 3, 4, null]) expect(scorePiquant(p, null)).toBe(NEUTRAL_SCORE)
  })

  it('rend neutre quand la RECETTE n’est pas annotée — on ne sait pas, on ne prétend pas', () => {
    for (const t of ['aucun', 'un_peu', 'tout'] as PiquantTolerance[]) {
      expect(scorePiquant(null, t)).toBe(NEUTRAL_SCORE)
    }
  })

  // ⛔ SOUS LE SEUIL = NEUTRE, JAMAIS UN BONUS. Récompenser le plat le moins piquant classerait les
  // recettes sur une échelle de douceur — un jugement, que le principe 6 interdit.
  it('⛔ ne donne AUCUN bonus à ce qui est sous la tolérance', () => {
    expect(scorePiquant(0, 'aucun')).toBe(NEUTRAL_SCORE)
    expect(scorePiquant(0, 'un_peu')).toBe(NEUTRAL_SCORE)
    expect(scorePiquant(1, 'un_peu')).toBe(NEUTRAL_SCORE)
    expect(scorePiquant(4, 'tout')).toBe(NEUTRAL_SCORE)
  })

  it('« tout » ne pénalise rien, à tous les niveaux de l’échelle', () => {
    for (const p of [0, 1, 2, 3, 4]) expect(scorePiquant(p, 'tout')).toBe(NEUTRAL_SCORE)
  })
})

describe('scorePiquant — la pénalité', () => {
  it('fait descendre d’autant que l’écart est grand', () => {
    expect(scorePiquant(1, 'aucun')).toBe(NEUTRAL_SCORE / 2)
    expect(scorePiquant(2, 'aucun')).toBe(0)
    expect(scorePiquant(2, 'un_peu')).toBe(NEUTRAL_SCORE / 2)
    expect(scorePiquant(3, 'un_peu')).toBe(0)
  })

  // ⛔ Une couche de score ne retire jamais un candidat : `assertScoringLayersNeverExclude` le
  // vérifie côté passe, mais un score négatif fausserait la somme pondérée bien avant.
  it('⛔ ne descend jamais sous zéro, même au bout de l’échelle', () => {
    for (const p of [2, 3, 4]) expect(scorePiquant(p, 'aucun')).toBeGreaterThanOrEqual(0)
    expect(scorePiquant(4, 'aucun')).toBe(0)
  })

  it('reste monotone : plus c’est piquant, moins c’est bien classé', () => {
    const scores = [0, 1, 2, 3, 4].map((p) => scorePiquant(p, 'aucun'))
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]!).toBeLessThanOrEqual(scores[i - 1]!)
    }
  })
})

describe('piquantLayer — la couche', () => {
  const DOUX = 'doux' as RecipeId
  const FORT = 'fort' as RecipeId
  const INCONNU = 'inconnu' as RecipeId

  function catalogue() {
    return makeCatalog([
      makeRecipe(DOUX, { piquant: 0 }),
      makeRecipe(FORT, { piquant: 3 }),
      makeRecipe(INCONNU, { piquant: null }),
    ])
  }

  function scoresPour(tolerance: PiquantTolerance | null) {
    const config = piquantLayer.configure(
      { ...makeRequest(), tolerancePiquant: tolerance },
      catalogue()
    )
    return asScoringResult(piquantLayer.apply(new Set([DOUX, FORT, INCONNU]), config)).scores
  }

  it('n’a AUCUN avis tant que rien n’est déclaré', () => {
    const scores = scoresPour(null)
    for (const id of [DOUX, FORT, INCONNU]) expect(scores.get(id)).toBe(NEUTRAL_SCORE)
  })

  it('fait descendre le plat trop fort, laisse les deux autres intacts', () => {
    const scores = scoresPour('aucun')
    expect(scores.get(FORT)).toBe(0)
    expect(scores.get(DOUX)).toBe(NEUTRAL_SCORE)
    // ⚠️ La recette NON ANNOTÉE reste neutre : c'est précisément pourquoi cette couche ne peut pas
    // être une exclusion. Elle ne protège pas de ce que personne n'a regardé, et ne le prétend pas.
    expect(scores.get(INCONNU)).toBe(NEUTRAL_SCORE)
  })

  it('porte le poids par défaut 0 — inerte tant qu’aucune tolérance ne le relève', () => {
    // Le mécanisme du relèvement est dans `runScoringPass` (PIQUANT_DYNAMIC_WEIGHT) ; ici on
    // verrouille que la couche ne s'invite PAS d'elle-même dans le classement de tout le monde.
    expect(piquantLayer.defaultWeight).toBe(0)
    expect(piquantLayer.kind).toBe('scoring')
    expect(piquantLayer.critical).toBe(false)
  })

  it('rend neutre pour un candidat absent du catalogue', () => {
    const config = piquantLayer.configure(
      { ...makeRequest(), tolerancePiquant: 'aucun' },
      catalogue()
    )
    const orphelin = 'jamais-vu' as RecipeId
    const resultat = asScoringResult(piquantLayer.apply(new Set([orphelin]), config))
    expect(resultat.scores.get(orphelin)).toBe(NEUTRAL_SCORE)
  })
})
