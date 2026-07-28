// engine/planning/plan-leftovers.test.ts — placement des restes (docs/ENGINE.md §7.3).

import { describe, expect, it } from 'vitest'
import { planLeftovers, portionsGaspillees } from './plan-leftovers.js'
import { makeCatalog, makeRecipe } from '../selection/test-fixtures.js'
import type { Catalog, MealPlanEntry, MealSlot, RecipeId, WeekPlan } from '../domain/index.js'

/** `makeRecipe` ne règle ni `portionsBase` ni `conservationJours` — on les surcharge ici. */
function recette(id: string, opts: { portions: number; conservation: number; slots?: readonly MealSlot[] }) {
  return {
    ...makeRecipe(id, { typesRepas: opts.slots ?? (['dejeuner', 'diner'] as readonly MealSlot[]) }),
    portionsBase: opts.portions,
    conservationJours: opts.conservation,
  }
}

function entree(date: string, creneau: MealSlot, recipeId: string | null, extra: Partial<MealPlanEntry> = {}): MealPlanEntry {
  return {
    slot: { date, creneau },
    recipeId: recipeId as RecipeId | null,
    portions: 0,
    locked: false,
    isLeftover: false,
    service: null,
    ...extra,
  }
}

function plan(entries: readonly MealPlanEntry[]): WeekPlan {
  return { id: 'p', startDate: entries[0]?.slot.date ?? '2026-08-03', days: 3, seed: 1, entries, warnings: [] }
}

describe('planning/plan-leftovers — placement', () => {
  it('un plat de 4 portions pour 2 convives nourrit UN repas de plus', () => {
    const gratin = recette('gratin', { portions: 4, conservation: 3 })
    const catalog = makeCatalog([gratin, recette('soupe', { portions: 2, conservation: 2 })]) as Catalog
    const p = plan([entree('2026-08-03', 'diner', 'gratin'), entree('2026-08-04', 'dejeuner', 'soupe')])

    const resultat = planLeftovers(p, catalog, 2)

    expect(resultat.entries[1]!.recipeId).toBe('gratin')
    expect(resultat.entries[1]!.isLeftover).toBe(true)
    expect(resultat.entries[1]!.portions).toBe(2) // ce qui est servi, pas ce qui a été produit
  })

  it('UN RESTE REMPLACE un plat prévu, il n’ajoute pas de créneau', () => {
    // C'est le sens de §7.3 : on ne cuisine pas tous les repas. Un mécanisme qui ne comblerait que
    // les créneaux vides ne servirait qu'aux plannings incomplets.
    const catalog = makeCatalog([
      recette('gratin', { portions: 4, conservation: 3 }),
      recette('soupe', { portions: 2, conservation: 2 }),
    ]) as Catalog
    const p = plan([entree('2026-08-03', 'diner', 'gratin'), entree('2026-08-04', 'dejeuner', 'soupe')])

    const resultat = planLeftovers(p, catalog, 2)

    expect(resultat.entries).toHaveLength(2) // même nombre de créneaux
    expect(resultat.entries[1]!.recipeId).not.toBe('soupe') // la soupe a cédé la place
  })

  it('4 portions pour 1 convive nourrissent TROIS repas de plus', () => {
    const catalog = makeCatalog([recette('gratin', { portions: 4, conservation: 5 }), recette('x', { portions: 1, conservation: 1 })]) as Catalog
    const p = plan([
      entree('2026-08-03', 'diner', 'gratin'),
      entree('2026-08-04', 'dejeuner', 'x'),
      entree('2026-08-04', 'diner', 'x'),
      entree('2026-08-05', 'dejeuner', 'x'),
      entree('2026-08-05', 'diner', 'x'),
    ])

    const restes = planLeftovers(p, catalog, 1).entries.filter((e) => e.isLeftover)

    expect(restes).toHaveLength(3)
  })

  it('un plat de 2 portions pour 2 convives ne laisse RIEN', () => {
    const catalog = makeCatalog([recette('duo', { portions: 2, conservation: 3 }), recette('x', { portions: 2, conservation: 3 })]) as Catalog
    const p = plan([entree('2026-08-03', 'diner', 'duo'), entree('2026-08-04', 'dejeuner', 'x')])

    expect(planLeftovers(p, catalog, 2).entries.filter((e) => e.isLeftover)).toEqual([])
  })
})

describe('planning/plan-leftovers — les limites, et pourquoi elles existent', () => {
  const catalog = () =>
    makeCatalog([
      recette('gratin', { portions: 6, conservation: 2 }),
      recette('x', { portions: 1, conservation: 1 }),
      recette('pdj', { portions: 1, conservation: 1, slots: ['petit_dejeuner'] }),
    ]) as Catalog

  it('JAMAIS le même jour — midi et soir le même plat est un appauvrissement', () => {
    // `variety` ne peut pas l'empêcher : le reste est placé APRÈS le scoring. La règle vit ici.
    const p = plan([entree('2026-08-03', 'dejeuner', 'gratin'), entree('2026-08-03', 'diner', 'x')])

    expect(planLeftovers(p, catalog(), 2).entries[1]!.isLeftover).toBe(false)
  })

  it('jamais au-delà de `conservationJours`', () => {
    const p = plan([
      entree('2026-08-03', 'diner', 'gratin'), // conservation 2 jours
      entree('2026-08-06', 'dejeuner', 'x'), // J+3
    ])

    expect(planLeftovers(p, catalog(), 2).entries[1]!.isLeftover).toBe(false)
  })

  it('jamais dans un créneau que la recette ne porte pas', () => {
    // Un reste de dîner ne se sert pas au petit-déjeuner sous prétexte qu'il reste des portions.
    const p = plan([entree('2026-08-03', 'diner', 'gratin'), entree('2026-08-04', 'petit_dejeuner', 'pdj')])

    expect(planLeftovers(p, catalog(), 2).entries[1]!.isLeftover).toBe(false)
  })

  it('jamais un créneau VERROUILLÉ — c’est la seule garantie de l’utilisateur (§7.2)', () => {
    const p = plan([
      entree('2026-08-03', 'diner', 'gratin'),
      entree('2026-08-04', 'dejeuner', 'x', { locked: true }),
    ])

    expect(planLeftovers(p, catalog(), 2).entries[1]!.recipeId).toBe('x')
  })

  it('jamais un créneau DÉJÀ transformé en reste — ce serait jeter le premier', () => {
    const c = makeCatalog([
      recette('a', { portions: 6, conservation: 5 }),
      recette('b', { portions: 6, conservation: 5 }),
      recette('x', { portions: 1, conservation: 1 }),
    ]) as Catalog
    const p = plan([
      entree('2026-08-03', 'dejeuner', 'a'),
      entree('2026-08-03', 'diner', 'b'),
      entree('2026-08-04', 'dejeuner', 'x'),
    ])

    const resultat = planLeftovers(p, c, 2)

    // `a` prend le créneau du 04 ; `b` ne doit pas le lui reprendre.
    expect(resultat.entries[2]!.recipeId).toBe('a')
  })

  it('jamais remplacer un plat par LUI-MÊME — un reste n’apporterait rien', () => {
    const c = makeCatalog([recette('gratin', { portions: 6, conservation: 5 })]) as Catalog
    const p = plan([entree('2026-08-03', 'diner', 'gratin'), entree('2026-08-04', 'dejeuner', 'gratin')])

    expect(planLeftovers(p, c, 2).entries[1]!.isLeftover).toBe(false)
  })

  it('refuse zéro convive plutôt que de diviser par zéro', () => {
    expect(() => planLeftovers(plan([]), catalog(), 0)).toThrow(RangeError)
  })
})

describe('planning/plan-leftovers — invariants', () => {
  const catalog = () =>
    makeCatalog([recette('gratin', { portions: 4, conservation: 3 }), recette('x', { portions: 2, conservation: 3 })]) as Catalog

  it('le plan d’entrée n’est JAMAIS muté', () => {
    const entrees = [entree('2026-08-03', 'diner', 'gratin'), entree('2026-08-04', 'dejeuner', 'x')]
    const p = plan(entrees)

    planLeftovers(p, catalog(), 2)

    expect(p.entries[1]!.isLeftover).toBe(false)
    expect(entrees[1]!.recipeId).toBe('x')
  })

  it('le nombre de créneaux, les dates et l’ordre sont conservés', () => {
    const p = plan([
      entree('2026-08-03', 'diner', 'gratin'),
      entree('2026-08-04', 'dejeuner', 'x'),
      entree('2026-08-04', 'diner', 'x'),
    ])

    const resultat = planLeftovers(p, catalog(), 2)

    expect(resultat.entries.map((e) => `${e.slot.date}/${e.slot.creneau}`)).toEqual(
      p.entries.map((e) => `${e.slot.date}/${e.slot.creneau}`)
    )
  })

  it('placer des restes fait BAISSER le gaspillage — sinon le mécanisme ne sert à rien', () => {
    const p = plan([
      entree('2026-08-03', 'diner', 'gratin'), // 4 portions, 2 mangées → 2 restantes
      entree('2026-08-04', 'dejeuner', 'x'),
    ])
    const c = catalog()

    const avant = portionsGaspillees(p, c, 2)
    const apres = portionsGaspillees(planLeftovers(p, c, 2), c, 2)

    expect(avant).toBeGreaterThan(0)
    expect(apres).toBeLessThan(avant)
  })

  it('idempotent : replacer des restes sur un plan déjà traité ne change rien', () => {
    const p = plan([
      entree('2026-08-03', 'diner', 'gratin'),
      entree('2026-08-04', 'dejeuner', 'x'),
      entree('2026-08-05', 'dejeuner', 'x'),
    ])
    const c = catalog()

    const une = planLeftovers(p, c, 2)
    const deux = planLeftovers(une, c, 2)

    expect(deux.entries.map((e) => [e.recipeId, e.isLeftover])).toEqual(une.entries.map((e) => [e.recipeId, e.isLeftover]))
  })
})
