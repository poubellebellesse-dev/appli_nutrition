// engine/selection/scoring/habit.test.ts — couche de score `habit`, VERSION MINIMALE
// (docs/ENGINE.md §7.5, §6.5 précision 5).

import { describe, expect, it } from 'vitest'
import { scoreHabit } from './habit.js'
import { NEUTRAL_SCORE } from './index.js'
import type { MealHistory, MealHistoryEntry, RecipeId, FoodId } from '../../domain/index.js'

const RECIPE = 'tartiflette' as RecipeId
const AUTRE_RECIPE = 'salade' as RecipeId
const INGREDIENT_PRINCIPAL = 'reblochon' as FoodId

function entry(recipeId: RecipeId, date: string): MealHistoryEntry {
  return { recipeId, date, creneau: 'diner' }
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
})
