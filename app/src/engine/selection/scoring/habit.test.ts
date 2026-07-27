// engine/selection/scoring/habit.test.ts — couche de score `habit`, VERSION MINIMALE
// (docs/ENGINE.md §7.5, §6.5 précision 5).

import { describe, expect, it } from 'vitest'
import { scoreHabit, habitLayer } from './habit.js'
import { scoreVariety } from './variety.js'
import { NEUTRAL_SCORE } from './index.js'
import { asScoringResult, makeCatalog, makeRecipe, makeRequest } from '../test-fixtures.js'
import type { MealHistory, MealHistoryEntry, RecipeId, FoodId } from '../../domain/index.js'

const RECIPE = 'tartiflette' as RecipeId
const AUTRE_RECIPE = 'salade' as RecipeId
const INGREDIENT_PRINCIPAL = 'reblochon' as FoodId

function entry(recipeId: RecipeId, date: string, origine: MealHistoryEntry['origine'] = 'choisi'): MealHistoryEntry {
  return { recipeId, date, creneau: 'diner', origine }
}

function history(entries: readonly MealHistoryEntry[]): MealHistory {
  return { windowDays: 21, entries }
}

describe('scoring/habit — scoreHabit (version minimale : fréquence normalisée)', () => {
  it('historique vide → score neutre (démarrage à froid propre)', () => {
    const score = scoreHabit({
      recipeId: RECIPE,
      signature: new Map(),
      history: history([]),
      today: '2026-07-24',
    })
    expect(score).toBe(NEUTRAL_SCORE)
  })

  it('répétition croissante de la recette → familiarité croissante', () => {
    const scoreUnePasseOnDix = scoreHabit({
      recipeId: RECIPE,
      signature: new Map(),
      history: history([
        entry(RECIPE, '2026-07-01'),
        entry(AUTRE_RECIPE, '2026-07-05'),
        entry(AUTRE_RECIPE, '2026-07-10'),
        entry(AUTRE_RECIPE, '2026-07-15'),
      ]),
      today: '2026-07-24',
    })
    const scoreTroisPassesOnQuatre = scoreHabit({
      recipeId: RECIPE,
      signature: new Map(),
      history: history([
        entry(RECIPE, '2026-07-01'),
        entry(RECIPE, '2026-07-05'),
        entry(RECIPE, '2026-07-10'),
        entry(AUTRE_RECIPE, '2026-07-15'),
      ]),
      today: '2026-07-24',
    })
    expect(scoreTroisPassesOnQuatre).toBeGreaterThan(scoreUnePasseOnDix)
  })

  it('valeur vérifiée à la main : fréquence = occurrences / total d’entrées valides', () => {
    const score = scoreHabit({
      recipeId: RECIPE,
      signature: new Map(),
      history: history([entry(RECIPE, '2026-07-01'), entry(AUTRE_RECIPE, '2026-07-05')]),
      today: '2026-07-24',
    })
    expect(score).toBeCloseTo(0.5, 10)
  })

  it('compte aussi les occurrences de COMPOSITION PROCHE, via signatureByRecipe', () => {
    const signatureByRecipe = new Map([[AUTRE_RECIPE, new Map([[INGREDIENT_PRINCIPAL, 1]])]])
    const score = scoreHabit({
      recipeId: RECIPE,
      signature: new Map([[INGREDIENT_PRINCIPAL, 1]]),
      history: history([entry(AUTRE_RECIPE, '2026-07-01'), entry(AUTRE_RECIPE, '2026-07-05')]),
      today: '2026-07-24',
      signatureByRecipe,
    })
    expect(score).toBe(1) // les 2 entrées ont la même composition que le candidat
  })

  it('entrée d’historique postérieure à today → ignorée (ni au numérateur ni au dénominateur)', () => {
    const score = scoreHabit({
      recipeId: RECIPE,
      signature: new Map(),
      history: history([entry(RECIPE, '2026-07-01'), entry(AUTRE_RECIPE, '2026-08-01')]),
      today: '2026-07-24',
    })
    expect(score).toBe(1) // seule l'entrée valide (RECIPE) est prise en compte
  })

  it('reste dans [0, 1]', () => {
    const score = scoreHabit({
      recipeId: RECIPE,
      signature: new Map(),
      history: history([entry(RECIPE, '2026-07-01')]),
      today: '2026-07-24',
    })
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  describe('origine — un reste mangé n’est pas une préférence exprimée (§6.5 ter ENGINE)', () => {
    it('attention au dénominateur : un `reste` est exclu du calcul, pas seulement du numérateur', () => {
      const score = scoreHabit({
        recipeId: RECIPE,
        signature: new Map(),
        history: history([
          entry(RECIPE, '2026-07-01', 'choisi'),
          entry(RECIPE, '2026-07-05', 'reste'), // ne doit compter ni au numérateur ni au dénominateur
          entry(AUTRE_RECIPE, '2026-07-10', 'choisi'),
        ]),
        today: '2026-07-24',
      })
      // Dénominateur correct = 2 entrées `choisi` (pas 3) → 1/2 = 0.5. Une implémentation qui
      // diluerait le dénominateur avec le `reste` donnerait 1/3 ≈ 0.333 à la place.
      expect(score).toBeCloseTo(0.5, 10)
    })

    it('uniquement des restes → aucune entrée `choisi` ne subsiste → score neutre (même démarrage à froid que l’historique vide)', () => {
      const score = scoreHabit({
        recipeId: RECIPE,
        signature: new Map(),
        history: history([entry(RECIPE, '2026-07-01', 'reste'), entry(AUTRE_RECIPE, '2026-07-05', 'reste')]),
        today: '2026-07-24',
      })
      expect(score).toBe(NEUTRAL_SCORE)
    })

    it('invariant du lot : même historique, `reste` au lieu de `choisi` → habit diffère, variety ne change pas', () => {
      const historyChoisi = history([entry(RECIPE, '2026-07-17', 'choisi')]) // 7 jours avant today
      const historyReste = history([entry(RECIPE, '2026-07-17', 'reste')])

      const habitChoisi = scoreHabit({
        recipeId: RECIPE,
        signature: new Map(),
        history: historyChoisi,
        today: '2026-07-24',
      })
      const habitReste = scoreHabit({
        recipeId: RECIPE,
        signature: new Map(),
        history: historyReste,
        today: '2026-07-24',
      })
      expect(habitChoisi).not.toBe(habitReste) // le `reste` est ignoré par habit → NEUTRAL_SCORE

      const varietyChoisi = scoreVariety({
        recipeId: RECIPE,
        signature: new Map(),
        history: historyChoisi,
        today: '2026-07-24',
        familiarity: 0.5,
      })
      const varietyReste = scoreVariety({
        recipeId: RECIPE,
        signature: new Map(),
        history: historyReste,
        today: '2026-07-24',
        familiarity: 0.5,
      })
      expect(varietyChoisi).toBe(varietyReste) // variety lit tout, quelle que soit l'origine
    })
  })
})

describe('scoring/habit — habitLayer (contrat SelectionLayer, §6.2 ENGINE)', () => {
  it('id/kind/critical/defaultWeight conformes au registre (§6.3 ENGINE) — poids nul (démarrage à froid, §7.5)', () => {
    expect(habitLayer.id).toBe('habit')
    expect(habitLayer.kind).toBe('scoring')
    expect(habitLayer.critical).toBe(false)
    expect(habitLayer.defaultWeight).toBe(0)
  })

  it('invariant §6.1 : un score par candidat reçu, aucune réduction — y compris sans historique', () => {
    const soupe = makeRecipe('soupe')
    const gratin = makeRecipe('gratin')
    const catalog = makeCatalog([soupe, gratin])
    const req = makeRequest({ date: '2026-07-24' })

    const config = habitLayer.configure(req, catalog)
    const result = asScoringResult(habitLayer.apply(new Set([soupe.id, gratin.id]), config))

    expect(result.scores.size).toBe(2)
  })

  it('historique vide → NEUTRAL_SCORE pour tout candidat (démarrage à froid propre)', () => {
    const recette = makeRecipe('r')
    const catalog = makeCatalog([recette])
    const req = makeRequest({ date: '2026-07-24' })

    const config = habitLayer.configure(req, catalog)
    const result = asScoringResult(habitLayer.apply(new Set([recette.id]), config))

    expect(result.scores.get(recette.id)).toBe(NEUTRAL_SCORE)
  })

  it('candidat absent du catalogue (id orphelin) → NEUTRAL_SCORE quand l’historique est vide, pas de plantage', () => {
    const catalog = makeCatalog([])
    const req = makeRequest({ date: '2026-07-24' })
    const config = habitLayer.configure(req, catalog)

    const result = asScoringResult(habitLayer.apply(new Set(['inconnu' as RecipeId]), config))

    expect(result.scores.get('inconnu' as RecipeId)).toBe(NEUTRAL_SCORE)
  })

  it('tous les scores restent dans [0, 1]', () => {
    const recette = makeRecipe('r')
    const catalog = makeCatalog([recette])
    const req = makeRequest({
      date: '2026-07-24',
      history: { windowDays: 21, entries: [{ recipeId: recette.id, date: '2026-07-01', creneau: 'diner', origine: 'choisi' }] },
    })

    const config = habitLayer.configure(req, catalog)
    const result = asScoringResult(habitLayer.apply(new Set([recette.id]), config))

    for (const score of result.scores.values()) {
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    }
  })

  it('cas discriminant : une recette souvent choisie bat une recette jamais choisie', () => {
    const habituee = makeRecipe('habituee')
    const jamaisChoisie = makeRecipe('jamais-choisie')
    const catalog = makeCatalog([habituee, jamaisChoisie])
    const entries: MealHistoryEntry[] = [
      { recipeId: habituee.id, date: '2026-07-01', creneau: 'diner', origine: 'choisi' },
      { recipeId: habituee.id, date: '2026-07-05', creneau: 'diner', origine: 'choisi' },
      { recipeId: habituee.id, date: '2026-07-10', creneau: 'diner', origine: 'choisi' },
      { recipeId: 'autre' as RecipeId, date: '2026-07-15', creneau: 'diner', origine: 'choisi' },
    ]
    const req = makeRequest({ date: '2026-07-24', history: { windowDays: 21, entries } })

    const config = habitLayer.configure(req, catalog)
    const result = asScoringResult(habitLayer.apply(new Set([habituee.id, jamaisChoisie.id]), config))

    expect(result.scores.get(habituee.id)!).toBeGreaterThan(result.scores.get(jamaisChoisie.id)!)
    expect(result.scores.get(habituee.id)).toBeCloseTo(0.75, 10)
    expect(result.scores.get(jamaisChoisie.id)).toBe(0)
  })

  it('un `reste` n’est pas compté — même comportement que scoreHabit (asymétrie §6.5 ter ENGINE)', () => {
    const recette = makeRecipe('r')
    const catalog = makeCatalog([recette])
    const req = makeRequest({
      date: '2026-07-24',
      history: { windowDays: 21, entries: [{ recipeId: recette.id, date: '2026-07-01', creneau: 'diner', origine: 'reste' }] },
    })

    const config = habitLayer.configure(req, catalog)
    const result = asScoringResult(habitLayer.apply(new Set([recette.id]), config))

    expect(result.scores.get(recette.id)).toBe(NEUTRAL_SCORE) // aucune entrée `choisi` ne subsiste
  })
})
