// engine/selection/scoring/variety.test.ts — couche de score `variety` (docs/ENGINE.md §6.5
// précision 5, §13 fenêtre d'historique).

import { describe, expect, it } from 'vitest'
import { scoreVariety } from './variety.js'
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

describe('scoring/variety — scoreVariety', () => {
  it('jamais vu, familiarité neutre (0.5) → score neutre (0.5)', () => {
    const score = scoreVariety({
      recipeId: RECIPE,
      mainIngredientId: null,
      history: history([]),
      today: '2026-07-24',
      familiarity: 0.5,
    })
    expect(score).toBeCloseTo(0.5, 10)
  })

  it('jamais vu, familiarité 0 (pure nouveauté) → score maximal', () => {
    const score = scoreVariety({
      recipeId: RECIPE,
      mainIngredientId: null,
      history: history([]),
      today: '2026-07-24',
      familiarity: 0,
    })
    expect(score).toBe(1)
  })

  it('vu aujourd’hui même, familiarité 0 → score minimal (aucune nouveauté)', () => {
    const score = scoreVariety({
      recipeId: RECIPE,
      mainIngredientId: null,
      history: history([entry(RECIPE, '2026-07-24')]),
      today: '2026-07-24',
      familiarity: 0,
    })
    expect(score).toBeCloseTo(0, 10)
  })

  it('familiarity = 1 INVERSE le signal : un plat récent marque mieux qu’un plat jamais vu', () => {
    const scoreRecent = scoreVariety({
      recipeId: RECIPE,
      mainIngredientId: null,
      history: history([entry(RECIPE, '2026-07-24')]), // vu aujourd'hui
      today: '2026-07-24',
      familiarity: 1,
    })
    const scoreJamaisVu = scoreVariety({
      recipeId: AUTRE_RECIPE,
      mainIngredientId: null,
      history: history([entry(RECIPE, '2026-07-24')]), // n'a rien à voir avec AUTRE_RECIPE
      today: '2026-07-24',
      familiarity: 1,
    })
    expect(scoreRecent).toBeGreaterThan(scoreJamaisVu)
    expect(scoreRecent).toBeCloseTo(1, 10)
    expect(scoreJamaisVu).toBeCloseTo(0, 10)
  })

  it('décroissance exponentielle : ancienneté de 7 jours (TAU) → recence = e^-1', () => {
    const score = scoreVariety({
      recipeId: RECIPE,
      mainIngredientId: null,
      history: history([entry(RECIPE, '2026-07-17')]), // 7 jours avant le 24
      today: '2026-07-24',
      familiarity: 0, // score = nouveauté = 1 - recence
    })
    expect(score).toBeCloseTo(1 - Math.exp(-1), 10)
  })

  it('récence portée sur l’ingrédient principal via mainIngredientByRecipe, pas seulement la recette', () => {
    const mainIngredientByRecipe = new Map<RecipeId, FoodId>([[AUTRE_RECIPE, INGREDIENT_PRINCIPAL]])
    // AUTRE_RECIPE (jamais demandée ici) partage son ingrédient principal avec RECIPE.
    const score = scoreVariety({
      recipeId: RECIPE,
      mainIngredientId: INGREDIENT_PRINCIPAL,
      history: history([entry(AUTRE_RECIPE, '2026-07-24')]),
      today: '2026-07-24',
      familiarity: 0,
      mainIngredientByRecipe,
    })
    // même ingrédient principal vu aujourd'hui → recence=1 → nouveauté=0 → score=0 (pas jamais-vu=1)
    expect(score).toBeCloseTo(0, 10)
  })

  it('prend la PLUS RÉCENTE des deux occurrences (recette / ingrédient principal)', () => {
    const mainIngredientByRecipe = new Map<RecipeId, FoodId>([[AUTRE_RECIPE, INGREDIENT_PRINCIPAL]])
    const score = scoreVariety({
      recipeId: RECIPE,
      mainIngredientId: INGREDIENT_PRINCIPAL,
      history: history([
        entry(RECIPE, '2026-06-01'), // ancien
        entry(AUTRE_RECIPE, '2026-07-24'), // même ingrédient principal, très récent
      ]),
      today: '2026-07-24',
      familiarity: 0,
      mainIngredientByRecipe,
    })
    expect(score).toBeCloseTo(0, 10) // domine par l'occurrence la plus récente (aujourd'hui)
  })

  it('entrée d’historique postérieure à today → ignorée', () => {
    const score = scoreVariety({
      recipeId: RECIPE,
      mainIngredientId: null,
      history: history([entry(RECIPE, '2026-08-01')]), // après today
      today: '2026-07-24',
      familiarity: 0,
    })
    expect(score).toBe(1) // traité comme jamais vu
  })

  it('override "surprise" force familiarity=0, prime sur la modulation demandée', () => {
    const score = scoreVariety({
      recipeId: RECIPE,
      mainIngredientId: null,
      history: history([entry(RECIPE, '2026-07-24')]), // vu aujourd'hui
      today: '2026-07-24',
      familiarity: 1, // demanderait normalement un bonus de familiarité
      override: 'surprise',
    })
    expect(score).toBeCloseTo(0, 10) // se comporte comme familiarity=0 : pas de bonus
  })

  it('override "classics" force familiarity=1, prime sur la modulation demandée', () => {
    const score = scoreVariety({
      recipeId: RECIPE,
      mainIngredientId: null,
      history: history([entry(RECIPE, '2026-07-24')]), // vu aujourd'hui
      today: '2026-07-24',
      familiarity: 0, // demanderait normalement de la pure nouveauté
      override: 'classics',
    })
    expect(score).toBeCloseTo(1, 10) // se comporte comme familiarity=1 : bonus de familiarité
  })

  it('reste dans [0, 1]', () => {
    const score = scoreVariety({
      recipeId: RECIPE,
      mainIngredientId: null,
      history: history([entry(RECIPE, '2026-07-23')]),
      today: '2026-07-24',
      familiarity: 0.5,
    })
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  describe('tauDays — cran réglable (§6.5 ter ENGINE)', () => {
    // Valeurs de référence doc/ENGINE.md §6.5 ter : plat vu il y a exactement 7 jours,
    // familiarity: 0 (le score EST la nouveauté).
    it('TAU=3 → nouveauté ≈ 0.90 pour un plat vu il y a 7 jours', () => {
      const score = scoreVariety({
        recipeId: RECIPE,
        mainIngredientId: null,
        history: history([entry(RECIPE, '2026-07-17')]),
        today: '2026-07-24',
        familiarity: 0,
        tauDays: 3,
      })
      expect(score).toBeCloseTo(0.9, 2)
    })

    it('TAU=7 → nouveauté ≈ 0.63 pour un plat vu il y a 7 jours', () => {
      const score = scoreVariety({
        recipeId: RECIPE,
        mainIngredientId: null,
        history: history([entry(RECIPE, '2026-07-17')]),
        today: '2026-07-24',
        familiarity: 0,
        tauDays: 7,
      })
      expect(score).toBeCloseTo(0.63, 2)
    })

    it('TAU=14 → nouveauté ≈ 0.39 pour un plat vu il y a 7 jours', () => {
      const score = scoreVariety({
        recipeId: RECIPE,
        mainIngredientId: null,
        history: history([entry(RECIPE, '2026-07-17')]),
        today: '2026-07-24',
        familiarity: 0,
        tauDays: 14,
      })
      expect(score).toBeCloseTo(0.39, 2)
    })

    it('non-régression : sans tauDays, résultat identique à tauDays: 7', () => {
      const args = {
        recipeId: RECIPE,
        mainIngredientId: null,
        history: history([entry(RECIPE, '2026-07-17')]),
        today: '2026-07-24',
        familiarity: 0,
      }
      const scoreParDefaut = scoreVariety(args)
      const scoreExplicite7 = scoreVariety({ ...args, tauDays: 7 })
      expect(scoreParDefaut).toBeCloseTo(scoreExplicite7, 10)
    })

    it('override "surprise" prime sur la modulation quel que soit le cran', () => {
      for (const tauDays of [3, 7, 14] as const) {
        const score = scoreVariety({
          recipeId: RECIPE,
          mainIngredientId: null,
          history: history([entry(RECIPE, '2026-07-24')]), // vu aujourd'hui
          today: '2026-07-24',
          familiarity: 1, // demanderait normalement un bonus de familiarité
          override: 'surprise',
          tauDays,
        })
        expect(score).toBeCloseTo(0, 10) // se comporte comme familiarity=0, quel que soit tauDays
      }
    })

    it('override "classics" prime sur la modulation quel que soit le cran', () => {
      for (const tauDays of [3, 7, 14] as const) {
        const score = scoreVariety({
          recipeId: RECIPE,
          mainIngredientId: null,
          history: history([entry(RECIPE, '2026-07-24')]), // vu aujourd'hui
          today: '2026-07-24',
          familiarity: 0, // demanderait normalement de la pure nouveauté
          override: 'classics',
          tauDays,
        })
        expect(score).toBeCloseTo(1, 10) // se comporte comme familiarity=1, quel que soit tauDays
      }
    })
  })
})
