import { describe, expect, it } from 'vitest'
import type { MealPlanEntry, MealSlot, Recipe, RecipeId, WeekPlan } from '../engine/domain/index.js'
import { g, min } from '../engine/domain/index.js'
import { HEURE_PLANCHER_MIN, MARGE_MIN, heureDuRappel, rappelsDuPlan } from './rappel.js'

// --- Fixtures ---------------------------------------------------------------------------------

function recette(id: string, prep: number, cuisson: number, nom = id): Recipe {
  return {
    id: id as RecipeId,
    nom,
    origine: 'maison',
    description: '',
    tempsPrepMin: min(prep),
    tempsCuissonMin: min(cuisson),
    difficulte: 1,
    portionsBase: 2,
    imagePath: null,
    typesRepas: ['diner'],
    saisonMois: [],
    envergure: 'quotidien',
    conservationJours: 2,
    axes: { sucreSale: -1, legerConsistant: 0, chaudFroid: 1, texture: 'moelleux' },
    ingredients: [{ foodId: 'x' as never, quantiteG: g(100), uniteAffichage: '100 g', optionnel: false }],
    etapes: [],
    facettes: [],
    service: null,
    piquant: null,
    sources: [],
    testeLe: null,
    estSauce: false,
    porteDejaUneSauce: null,
    sauceIds: [],
    equipements: [],
  }
}

const RECETTES: ReadonlyMap<RecipeId, Recipe> = new Map(
  [recette('rapide', 5, 10, 'Salade'), recette('long', 30, 180, 'Gigot')].map((r) => [r.id, r])
)

function entree(date: string, creneau: MealSlot, recipeId: string | null, isLeftover = false): MealPlanEntry {
  return {
    slot: { date, creneau },
    recipeId: recipeId === null ? null : (recipeId as RecipeId),
    horsCatalogue: null,
    portions: recipeId === null ? 0 : 2,
    locked: false,
    isLeftover,
    service: null,
  }
}

function plan(entries: readonly MealPlanEntry[]): WeekPlan {
  return { id: 'plan-test', startDate: '2026-08-03', days: 7, entries, seed: 1, warnings: [] }
}

/** 3 août 2026, 8 h 00, heure LOCALE — le même repère pour tous les tests. */
const LUNDI_8H = new Date(2026, 7, 3, 8, 0, 0, 0).getTime()

const DINER_19H30 = new Map<MealSlot, number>([['diner', 19 * 60 + 30]])

// --- L'heure de départ --------------------------------------------------------------------------

describe('ui/rappel — heure du rappel', () => {
  it('recule du temps total ET de la marge', () => {
    // Dîner 19 h 30, plat de 45 min, marge 10 → on prévient à 18 h 35.
    expect(heureDuRappel(19 * 60 + 30, 45)).toBe(19 * 60 + 30 - 45 - MARGE_MIN)
  })

  it('prévient AVANT l’heure théorique — sans marge, le rappel est déjà en retard', () => {
    expect(heureDuRappel(600, 30)).toBeLessThan(600 - 30)
  })

  it('⛔ rend null plutôt que de remonter la veille', () => {
    expect(heureDuRappel(60, 60)).toBeNull()
  })

  it('⛔ NE NOTIFIE JAMAIS AVANT LE PLANCHER — le défaut que ce test a révélé', () => {
    // Un gigot de 3 h 30 pour un repas à 7 h donne un départ à 3 h 20. Positif, donc accepté par la
    // première version du code — et une notification en pleine nuit. Refuser les valeurs négatives
    // ne protégeait de rien.
    expect(heureDuRappel(7 * 60, 210)).toBeNull()
    expect(heureDuRappel(8 * 60, 150)).toBeNull() // départ 5 h 20
  })

  it('accepte pile au plancher, refuse une minute avant', () => {
    expect(heureDuRappel(HEURE_PLANCHER_MIN + 60 + MARGE_MIN, 60)).toBe(HEURE_PLANCHER_MIN)
    expect(heureDuRappel(HEURE_PLANCHER_MIN + 60 + MARGE_MIN - 1, 60)).toBeNull()
  })
})

// --- Les rappels d'un plan ------------------------------------------------------------------------

describe('ui/rappel — rappels d’un plan', () => {
  it('produit un rappel par repas planifié dont le créneau a une heure', () => {
    const rappels = rappelsDuPlan(
      plan([entree('2026-08-03', 'diner', 'rapide')]),
      RECETTES,
      DINER_19H30,
      LUNDI_8H
    )
    expect(rappels).toHaveLength(1)
    expect(rappels[0]?.recipeId).toBe('rapide')
    // 19 h 30 − 15 min de plat − 10 min de marge = 19 h 05.
    expect(new Date(rappels[0]!.quandMs).getHours()).toBe(19)
    expect(new Date(rappels[0]!.quandMs).getMinutes()).toBe(5)
  })

  it('IGNORE un créneau sans heure déclarée', () => {
    // Personne ne doit renseigner ses quatre repas pour être prévenu de son dîner.
    const rappels = rappelsDuPlan(
      plan([entree('2026-08-03', 'dejeuner', 'rapide')]),
      RECETTES,
      DINER_19H30,
      LUNDI_8H
    )
    expect(rappels).toEqual([])
  })

  it('IGNORE un créneau vide et une recette inconnue du catalogue', () => {
    const rappels = rappelsDuPlan(
      plan([entree('2026-08-03', 'diner', null), entree('2026-08-04', 'diner', 'disparue')]),
      RECETTES,
      DINER_19H30,
      LUNDI_8H
    )
    expect(rappels).toEqual([])
  })

  it('⛔ IGNORE un RESTE — il se réchauffe, il ne se cuisine pas', () => {
    const rappels = rappelsDuPlan(
      plan([entree('2026-08-03', 'diner', 'rapide', true)]),
      RECETTES,
      DINER_19H30,
      LUNDI_8H
    )
    expect(rappels).toEqual([])
  })

  it('⛔ NE REPROGRAMME PAS LE PASSÉ', () => {
    // Le défaut que ce test garde : reprogrammer une semaine entamée ferait sonner l'appareil
    // immédiatement, une fois par repas déjà écoulé.
    const troisJours = plan([
      entree('2026-08-01', 'diner', 'rapide'),
      entree('2026-08-02', 'diner', 'rapide'),
      entree('2026-08-05', 'diner', 'rapide'),
    ])
    const rappels = rappelsDuPlan(troisJours, RECETTES, DINER_19H30, LUNDI_8H)
    expect(rappels).toHaveLength(1)
    expect(rappels[0]?.date).toBe('2026-08-05')
  })

  it('écarte aussi le repas du jour déjà passé, à la minute près', () => {
    // Lundi 20 h : le rappel de 19 h 05 est derrière nous.
    const lundi20h = new Date(2026, 7, 3, 20, 0, 0, 0).getTime()
    expect(rappelsDuPlan(plan([entree('2026-08-03', 'diner', 'rapide')]), RECETTES, DINER_19H30, lundi20h)).toEqual([])
  })

  it('écarte un plat trop long pour son créneau au lieu de sonner la nuit', () => {
    // Départ calculé : 3 h 20. Sous le plancher, donc aucun rappel.
    const petitDej = new Map<MealSlot, number>([['petit_dejeuner', 7 * 60]])
    const rappels = rappelsDuPlan(
      plan([entree('2026-08-05', 'petit_dejeuner', 'long')]),
      RECETTES,
      petitDej,
      LUNDI_8H
    )
    expect(rappels).toEqual([])
  })

  it('rend les rappels en ordre CHRONOLOGIQUE', () => {
    const rappels = rappelsDuPlan(
      plan([
        entree('2026-08-06', 'diner', 'rapide'),
        entree('2026-08-04', 'diner', 'rapide'),
        entree('2026-08-05', 'diner', 'rapide'),
      ]),
      RECETTES,
      DINER_19H30,
      LUNDI_8H
    )
    expect(rappels.map((r) => r.date)).toEqual(['2026-08-04', '2026-08-05', '2026-08-06'])
  })

  it('énonce un FAIT, sans injonction (§6.2 ARCHITECTURE)', () => {
    const rappels = rappelsDuPlan(
      plan([entree('2026-08-05', 'diner', 'long')]),
      RECETTES,
      DINER_19H30,
      LUNDI_8H
    )
    expect(rappels[0]?.texte).toBe('Gigot demande 210 min.')
    for (const interdit of ['oubliez', 'devriez', 'il faut', 'vite']) {
      expect(rappels[0]?.texte.toLowerCase()).not.toContain(interdit)
      expect(rappels[0]?.titre.toLowerCase()).not.toContain(interdit)
    }
  })

  it('rend une liste vide sans heure déclarée du tout — le cas par défaut', () => {
    expect(rappelsDuPlan(plan([entree('2026-08-05', 'diner', 'rapide')]), RECETTES, new Map(), LUNDI_8H)).toEqual([])
  })
})

// --- Le mode repas : deux plats sur un même créneau ----------------------------------------------

describe('ui/rappel — un créneau qui porte plat ET accompagnement', () => {
  // ⚠️ BUG TROUVÉ ET CORRIGÉ LE 2026-08-04. La boucle portait sur `plan.entries` : depuis que
  // `planWeek` pose un accompagnement en plus du plat, un seul dîner produisait DEUX notifications,
  // à deux instants différents. Sur une application dont l'argument est qu'elle ne harcèle personne,
  // doubler les rappels est exactement le défaut à ne pas laisser passer.

  function assiette(date: string, plat: string, accompagnement: string): readonly MealPlanEntry[] {
    return [
      { ...entree(date, 'diner', plat), service: 'plat' },
      { ...entree(date, 'diner', accompagnement), service: 'accompagnement' },
    ]
  }

  it('⛔ NE POSE QU’UN SEUL RAPPEL, pas un par entrée', () => {
    const rappels = rappelsDuPlan(plan(assiette('2026-08-05', 'long', 'rapide')), RECETTES, DINER_19H30, LUNDI_8H)

    expect(rappels).toHaveLength(1)
  })

  it('se cale sur le plat le plus LONG — commencer à l’heure du plus court ferait servir en retard', () => {
    const rappels = rappelsDuPlan(plan(assiette('2026-08-05', 'rapide', 'long')), RECETTES, DINER_19H30, LUNDI_8H)

    // 210 min pour le Gigot, quel que soit son rôle dans le repas — et non 15 min pour la Salade.
    expect(rappels[0]?.recipeId).toBe('long')
    expect(rappels[0]?.texte).toContain('210 min')
  })

  it('dit qu’il y a un second plat — le taire ferait sous-estimer le travail', () => {
    const rappels = rappelsDuPlan(plan(assiette('2026-08-05', 'long', 'rapide')), RECETTES, DINER_19H30, LUNDI_8H)

    expect(rappels[0]?.texte).toBe('Gigot demande 210 min, et il y a 1 autre plat à ce repas.')
    for (const interdit of ['oubliez', 'devriez', 'il faut', 'vite']) {
      expect(rappels[0]?.texte.toLowerCase()).not.toContain(interdit)
    }
  })

  it('un accompagnement dont la recette est INCONNUE ne fait pas perdre le rappel du plat', () => {
    const rappels = rappelsDuPlan(plan(assiette('2026-08-05', 'long', 'fantome')), RECETTES, DINER_19H30, LUNDI_8H)

    expect(rappels).toHaveLength(1)
    expect(rappels[0]?.texte).toBe('Gigot demande 210 min.')
  })
})
