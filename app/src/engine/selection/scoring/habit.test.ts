// engine/selection/scoring/habit.test.ts — couche de score `habit`, VERSION MINIMALE
// (docs/ENGINE.md §7.5, §6.5 précision 5).

import { describe, expect, it } from 'vitest'
import { scoreHabit } from './habit.js'
import { scoreVariety } from './variety.js'
import { NEUTRAL_SCORE } from './index.js'
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
      mainIngredientId: null,
      history: history([]),
      today: '2026-07-24',
    })
    expect(score).toBe(NEUTRAL_SCORE)
  })

  it('répétition croissante de la recette → familiarité croissante', () => {
    const scoreUnePasseOnDix = scoreHabit({
      recipeId: RECIPE,
      mainIngredientId: null,
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
      mainIngredientId: null,
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
      mainIngredientId: null,
      history: history([entry(RECIPE, '2026-07-01'), entry(AUTRE_RECIPE, '2026-07-05')]),
      today: '2026-07-24',
    })
    expect(score).toBeCloseTo(0.5, 10)
  })

  it('compte aussi les occurrences de l’ingrédient principal, via mainIngredientByRecipe', () => {
    const mainIngredientByRecipe = new Map<RecipeId, FoodId>([[AUTRE_RECIPE, INGREDIENT_PRINCIPAL]])
    const score = scoreHabit({
      recipeId: RECIPE,
      mainIngredientId: INGREDIENT_PRINCIPAL,
      history: history([entry(AUTRE_RECIPE, '2026-07-01'), entry(AUTRE_RECIPE, '2026-07-05')]),
      today: '2026-07-24',
      mainIngredientByRecipe,
    })
    expect(score).toBe(1) // les 2 entrées partagent l'ingrédient principal demandé
  })

  it('entrée d’historique postérieure à today → ignorée (ni au numérateur ni au dénominateur)', () => {
    const score = scoreHabit({
      recipeId: RECIPE,
      mainIngredientId: null,
      history: history([entry(RECIPE, '2026-07-01'), entry(AUTRE_RECIPE, '2026-08-01')]),
      today: '2026-07-24',
    })
    expect(score).toBe(1) // seule l'entrée valide (RECIPE) est prise en compte
  })

  it('reste dans [0, 1]', () => {
    const score = scoreHabit({
      recipeId: RECIPE,
      mainIngredientId: null,
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
        mainIngredientId: null,
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
        mainIngredientId: null,
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
        mainIngredientId: null,
        history: historyChoisi,
        today: '2026-07-24',
      })
      const habitReste = scoreHabit({
        recipeId: RECIPE,
        mainIngredientId: null,
        history: historyReste,
        today: '2026-07-24',
      })
      expect(habitChoisi).not.toBe(habitReste) // le `reste` est ignoré par habit → NEUTRAL_SCORE

      const varietyChoisi = scoreVariety({
        recipeId: RECIPE,
        mainIngredientId: null,
        history: historyChoisi,
        today: '2026-07-24',
        familiarity: 0.5,
      })
      const varietyReste = scoreVariety({
        recipeId: RECIPE,
        mainIngredientId: null,
        history: historyReste,
        today: '2026-07-24',
        familiarity: 0.5,
      })
      expect(varietyChoisi).toBe(varietyReste) // variety lit tout, quelle que soit l'origine
    })
  })
})
