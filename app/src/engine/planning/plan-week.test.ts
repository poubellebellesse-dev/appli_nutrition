// engine/planning/plan-week.test.ts — planification glouton (docs/ENGINE.md §7.1).

import { describe, expect, it, vi } from 'vitest'
import { MAX_PLAN_DAYS, MIN_PLAN_DAYS, addDays, planWeek } from './plan-week.js'
import { makeCatalog, makeRecipe } from '../selection/test-fixtures.js'
import { NoViableRecipeError } from '../domain/index.js'
import type { Catalog, MealSlot, RecipeId, SuggestionRequest, SuggestionResult, WeekPlanRequest } from '../domain/index.js'

const RECIPES = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => makeRecipe(id))
const CATALOG = makeCatalog(RECIPES)

function makePlanRequest(overrides: Partial<WeekPlanRequest> = {}): WeekPlanRequest {
  return {
    profile: {
      trancheAge: '30_49',
      sexe: 'F',
      niveauActivite: 'actif',
      tailleCm: 165,
      poidsKg: 62,
      facteurPortion: 1,
    },
    constraints: { allergies: [], diet: null, excludedFoodIds: [] },
    startDate: '2026-08-03',
    days: 3,
    slots: ['diner'] as readonly MealSlot[],
    history: { windowDays: 21, entries: [] },
    activeTopics: [],
    seed: 1,
    ...overrides,
  }
}

/** Suggestion factice : rend les recettes dans l'ordre donné, sans passer par le vrai pipeline. */
function fakeSuggest(order: readonly string[]): (req: SuggestionRequest) => SuggestionResult {
  return () =>
    ({
      suggestions: order.map((id) => ({ recipeId: id as RecipeId })),
      rejected: { totalInitial: 0, totalRejected: 0, byLayer: new Map(), entries: [] },
      diagnostics: {},
    }) as unknown as SuggestionResult
}

describe('planning/plan-week — forme du plan', () => {
  it('produit un créneau par jour × créneau demandé', () => {
    const req = makePlanRequest({ days: 3, slots: ['dejeuner', 'diner'] })
    const plan = planWeek(CATALOG, req, fakeSuggest(['a', 'b', 'c', 'd', 'e', 'f']))

    expect(plan.entries).toHaveLength(6)
    expect(plan.days).toBe(3)
    expect(plan.startDate).toBe('2026-08-03')
  })

  it('les dates avancent d’un jour, y compris par-dessus un changement de mois', () => {
    const plan = planWeek(CATALOG, makePlanRequest({ startDate: '2026-08-30', days: 3 }), fakeSuggest(['a', 'b', 'c']))

    expect(plan.entries.map((e) => e.slot.date)).toEqual(['2026-08-30', '2026-08-31', '2026-09-01'])
  })

  it('refuse une fenêtre hors des bornes de §7.1 — les deux côtés', () => {
    const suggest = fakeSuggest(['a'])
    expect(() => planWeek(CATALOG, makePlanRequest({ days: MIN_PLAN_DAYS - 1 }), suggest)).toThrow(RangeError)
    expect(() => planWeek(CATALOG, makePlanRequest({ days: MAX_PLAN_DAYS + 1 }), suggest)).toThrow(RangeError)
  })

  it('refuse une liste de créneaux vide plutôt que de rendre un plan vide silencieux', () => {
    expect(() => planWeek(CATALOG, makePlanRequest({ slots: [] }), fakeSuggest(['a']))).toThrow(RangeError)
  })
})

describe('planning/plan-week — pas de doublon dans la fenêtre', () => {
  it('ne place jamais deux fois la même recette, même si la suggestion la remet en tête', () => {
    // La suggestion factice rend TOUJOURS le même ordre : sans `placedRecipeIds`, le plan serait
    // « a, a, a ». C'est le scénario exact que le glouton doit empêcher.
    const plan = planWeek(CATALOG, makePlanRequest({ days: 3 }), fakeSuggest(['a', 'b', 'c']))

    expect(plan.entries.map((e) => e.recipeId)).toEqual(['a', 'b', 'c'])
  })

  it('candidats épuisés → créneau VIDE, et le plan continue', () => {
    // Un catalogue qui n'a que 2 recettes ne peut pas remplir 4 créneaux. Faire échouer tout le
    // plan ferait perdre les deux créneaux remplis (§7.2 : l'état `Vide` existe).
    const plan = planWeek(CATALOG, makePlanRequest({ days: 4 }), fakeSuggest(['a', 'b']))

    expect(plan.entries.map((e) => e.recipeId)).toEqual(['a', 'b', null, null])
    expect(plan.entries).toHaveLength(4)
  })

  it('`NoViableRecipeError` est RATTRAPÉE — normale en planification, anormale en suggestion unitaire', () => {
    const suggest = () => {
      throw new NoViableRecipeError('aucun candidat', { totalInitial: 0, totalRejected: 0, byLayer: new Map(), entries: [] })
    }
    const plan = planWeek(CATALOG, makePlanRequest({ days: 2 }), suggest)

    expect(plan.entries.map((e) => e.recipeId)).toEqual([null, null])
  })

  it('toute AUTRE erreur remonte — on n’avale pas les bugs', () => {
    const suggest = () => {
      throw new TypeError('bug du pipeline')
    }
    expect(() => planWeek(CATALOG, makePlanRequest({ days: 2 }), suggest)).toThrow(TypeError)
  })
})

describe('planning/plan-week — l’historique de travail (ce qui fait une SEMAINE)', () => {
  it('chaque créneau voit les plats déjà placés dans son historique', () => {
    // L'invariant central du fichier : sans lui, `variety` verrait le même historique à chaque
    // créneau et le planning rendrait sept fois le même dîner.
    const vu: SuggestionRequest[] = []
    const suggest = vi.fn((req: SuggestionRequest) => {
      vu.push(req)
      return fakeSuggest(['a', 'b', 'c'])(req)
    })

    planWeek(CATALOG, makePlanRequest({ days: 3 }), suggest)

    expect(vu[0]!.history.entries).toHaveLength(0)
    expect(vu[1]!.history.entries.map((e) => e.recipeId)).toEqual(['a'])
    expect(vu[2]!.history.entries.map((e) => e.recipeId)).toEqual(['a', 'b'])
  })

  it('les entrées ajoutées portent `origine: choisi` et la date de LEUR créneau', () => {
    // `origine` n'est pas cosmétique : `habit` ne compte QUE les `choisi` (§6.5 ter), un `reste`
    // serait ignoré et l'affinité apprise ne verrait jamais le planning.
    const vu: SuggestionRequest[] = []
    const suggest = (req: SuggestionRequest) => {
      vu.push(req)
      return fakeSuggest(['a', 'b'])(req)
    }

    planWeek(CATALOG, makePlanRequest({ days: 2 }), suggest)

    expect(vu[1]!.history.entries[0]).toMatchObject({ recipeId: 'a', date: '2026-08-03', origine: 'choisi' })
  })

  it('l’historique de l’APPELANT n’est jamais muté', () => {
    const entries: never[] = []
    const req = makePlanRequest({ days: 3, history: { windowDays: 21, entries } })

    planWeek(CATALOG, req, fakeSuggest(['a', 'b', 'c']))

    expect(entries).toHaveLength(0)
    expect(req.history.entries).toHaveLength(0)
  })

  it('l’historique fourni au départ est CONSERVÉ, pas écrasé', () => {
    const vu: SuggestionRequest[] = []
    const suggest = (r: SuggestionRequest) => {
      vu.push(r)
      return fakeSuggest(['a', 'b'])(r)
    }
    const req = makePlanRequest({
      days: 2,
      history: {
        windowDays: 21,
        entries: [{ recipeId: 'z' as RecipeId, date: '2026-08-01', creneau: 'diner', origine: 'choisi' }],
      },
    })

    planWeek(CATALOG, req, suggest)

    expect(vu[0]!.history.entries.map((e) => e.recipeId)).toEqual(['z'])
    expect(vu[1]!.history.entries.map((e) => e.recipeId)).toEqual(['z', 'a'])
  })
})

describe('planning/plan-week — déterminisme et cas limites', () => {
  it('deux appels identiques rendent un plan identique', () => {
    const req = makePlanRequest({ days: 4 })
    const a = planWeek(CATALOG, req, fakeSuggest(['a', 'b', 'c', 'd']))
    const b = planWeek(CATALOG, req, fakeSuggest(['a', 'b', 'c', 'd']))

    expect(a.entries.map((e) => e.recipeId)).toEqual(b.entries.map((e) => e.recipeId))
    expect(a.id).toBe(b.id)
  })

  it('un créneau vide porte `portions: 0`, jamais un nombre trompeur', () => {
    const plan = planWeek(CATALOG, makePlanRequest({ days: 2 }), fakeSuggest([]))

    for (const entry of plan.entries) {
      expect(entry.recipeId).toBeNull()
      expect(entry.portions).toBe(0)
    }
  })

  it('ce lot ne place aucun reste et n’utilise pas le mode repas', () => {
    // Verrouille ce qui est ASSUMÉ non fait (§7.3, mode repas v1.5), pour que le jour où on
    // l'implémente, le test échoue et force à le mettre à jour sciemment.
    const plan = planWeek(CATALOG, makePlanRequest({ days: 3 }), fakeSuggest(['a', 'b', 'c']))

    expect(plan.entries.every((e) => e.isLeftover === false)).toBe(true)
    expect(plan.entries.every((e) => e.service === null)).toBe(true)
    expect(plan.entries.every((e) => e.locked === false)).toBe(true)
  })
})

describe('planning/plan-week — addDays', () => {
  it('avance sans se laisser piéger par les fins de mois ni les années bissextiles', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29') // 2028 est bissextile
    expect(addDays('2026-08-03', 0)).toBe('2026-08-03')
  })
})

/** Le catalogue de fixtures n'a pas de nutriments : `assertCalorieFloor` doit rester silencieux. */
describe('planning/plan-week — interaction avec assertCalorieFloor', () => {
  it('un catalogue sans nutriment d’énergie ne déclenche AUCUN faux positif', async () => {
    const { assertCalorieFloor } = await import('../guards/index.js')
    const plan = planWeek(CATALOG, makePlanRequest({ days: 2 }), fakeSuggest(['a', 'b']))

    expect(() => assertCalorieFloor(plan, makePlanRequest().profile, CATALOG as Catalog)).not.toThrow()
  })
})
