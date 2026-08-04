// engine/planning/plan-week.test.ts — planification glouton (docs/ENGINE.md §7.1).

import { describe, expect, it, vi } from 'vitest'
import { MAX_PLAN_DAYS, MIN_PLAN_DAYS, addDays, planWeek } from './plan-week.js'
import { rerollSlot } from './reroll-slot.js'
import { makeCatalog, makeFood, makeRecipe } from '../selection/test-fixtures.js'
import { NoViableRecipeError } from '../domain/index.js'
import type { Catalog, FoodId, MealPlanEntry, MealSlot, RecipeId, RecipeIngredient, SuggestionRequest, SuggestionResult, WeekPlan, WeekPlanRequest } from '../domain/index.js'

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

describe('planning/plan-week — un repas principal placé AUTOMATIQUEMENT est un plat', () => {
  // ⚠️ CE QUE CES TESTS GARDENT, et pourquoi ils existent. Mesuré le 2026-08-03 sur le catalogue
  // réel : 61 recettes sur 189 éligibles à un déjeuner ou un dîner ne sont PAS des plats (39
  // entrées, 20 accompagnements, 2 desserts), et le planificateur en plaçait — « Artichauts à la
  // vinaigrette » comme déjeuner, « Boulgour aux légumes grillés » comme dîner. `planWeek` filtrait
  // sur `typesRepas` (à quel MOMENT) et jamais sur `service` (quel RÔLE).
  //
  // ⚠️ LA RÈGLE NE VAUT QUE POUR LE PLACEMENT AUTOMATIQUE. Choisir soi-même une entrée comme dîner
  // reste permis partout ailleurs — décision utilisateur du 2026-08-03.

  const MIXTE = makeCatalog([
    makeRecipe('plat1', { service: 'plat' }),
    makeRecipe('plat2', { service: 'plat' }),
    makeRecipe('ent', { service: 'entree' }),
    makeRecipe('acc', { service: 'accompagnement' }),
    makeRecipe('sansService', { service: null }),
  ])

  it('préfère le plat à l’entrée pour un dîner, même si l’entrée est mieux classée', () => {
    const plan = planWeek(MIXTE, makePlanRequest({ days: 2 }), fakeSuggest(['ent', 'plat1', 'plat2']))

    expect(plan.entries[0]?.recipeId).toBe('plat1')
    expect(plan.entries[1]?.recipeId).toBe('plat2')
  })

  it('⛔ REPLI — pose l’accompagnement plutôt que de laisser le créneau VIDE', () => {
    // La règle en version dure a fait retomber le végétalien 14 j de 42/42 créneaux remplis à
    // 32/42 : beaucoup des recettes végétaliennes de la décision 37 sont des accompagnements. Un
    // créneau vide ne nourrit personne — la préférence ne doit jamais devenir une exigence.
    const plan = planWeek(MIXTE, makePlanRequest({ days: 2 }), fakeSuggest(['acc', 'ent']))

    expect(plan.entries.map((e) => e.recipeId)).toEqual(['acc', 'ent'])
  })

  it('accepte `service: null` — sinon tout le catalogue non annoté disparaîtrait', () => {
    const plan = planWeek(MIXTE, makePlanRequest({ days: 2 }), fakeSuggest(['sansService', 'plat1']))

    expect(plan.entries[0]?.recipeId).toBe('sansService')
  })

  it('ne s’applique PAS au petit-déjeuner : un dessert y est légitime', () => {
    const catalogue = makeCatalog([makeRecipe('dess', { service: 'dessert' }), makeRecipe('plat1', { service: 'plat' })])
    const plan = planWeek(
      catalogue,
      makePlanRequest({ days: 2, slots: ['petit_dejeuner'] }),
      fakeSuggest(['dess', 'plat1'])
    )

    expect(plan.entries[0]?.recipeId).toBe('dess')
  })
})

describe('planning/plan-week — l’ACCOMPAGNEMENT posé en plus du plat (mode repas, 2026-08-04)', () => {
  // ⚠️ CE QUE CE BLOC GARDE, ET POURQUOI IL EST LE CORRECTIF DU PLANCHER. `checkCalorieFloor` (§6.5)
  // compare une JOURNÉE à un plancher journalier alors que le plan ne posait que des PLATS : trois
  // plats cuisinés ne sont pas ce qu'une personne mange dans une journée, la comparaison n'a jamais
  // été homogène. MESURÉ sur 20 graines × 7 jours du catalogue réel (`npm run engine:plancher`) :
  //   SANS : min 813  · médiane 1023 — 38 jours sous 1 200 sur 140
  //   AVEC : min 1371 · médiane 1532 —  0 jour  sous 1 200 sur 140

  const AVEC_ACC = makeCatalog([
    makeRecipe('plat1', { service: 'plat' }),
    makeRecipe('plat2', { service: 'plat' }),
    makeRecipe('acc', { service: 'accompagnement' }),
    makeRecipe('ent', { service: 'entree' }),
    makeRecipe('sansService', { service: null }),
  ])

  it('pose DEUX entrées sur le créneau — le plat, puis son accompagnement', () => {
    const plan = planWeek(AVEC_ACC, makePlanRequest({ days: 2 }), fakeSuggest(['plat1', 'acc', 'plat2']))
    const jour1 = plan.entries.filter((e) => e.slot.date === '2026-08-03')

    expect(jour1.map((e) => e.recipeId)).toEqual(['plat1', 'acc'])
    expect(jour1.map((e) => e.service)).toEqual(['plat', 'accompagnement'])
  })

  it('⛔ LE RIZ PEUT REVENIR — l’accompagnement échappe à l’interdit de doublon', () => {
    // `placedRecipeIds` interdit le doublon exact dans la fenêtre : c'est juste pour un plat, FAUX
    // pour un accompagnement. On mange du riz plusieurs fois par semaine. Sans cette exemption, la
    // fonctionnalité s'auto-détruirait dès la deuxième journée — un seul accompagnement au monde.
    const plan = planWeek(AVEC_ACC, makePlanRequest({ days: 2 }), fakeSuggest(['plat1', 'acc', 'plat2']))
    const accs = plan.entries.filter((e) => e.service === 'accompagnement')

    expect(accs).toHaveLength(2)
    expect(accs.every((e) => e.recipeId === 'acc')).toBe(true)
  })

  it('⛔ … MAIS IL PASSE PAR L’HISTORIQUE DE TRAVAIL, sinon il lasse', () => {
    // L'autre moitié de l'asymétrie. Le riz peut revenir, il ne doit pas revenir SEPT FOIS : c'est
    // `variety` qui l'en empêche, et `variety` ne voit que ce qui est dans l'historique. MESURÉ sans
    // cette ligne, sur le catalogue réel : `7× Ratatouille` et `7× Boulgour` sur 14 créneaux.
    const vu: SuggestionRequest[] = []
    const espion = (req: SuggestionRequest): SuggestionResult => {
      vu.push(req)
      return fakeSuggest(['plat1', 'acc', 'plat2'])(req)
    }
    planWeek(AVEC_ACC, makePlanRequest({ days: 2 }), espion)

    // La requête du DEUXIÈME jour doit voir l'accompagnement du premier.
    const dernier = vu[vu.length - 1]!
    expect(dernier.history.entries.some((e) => e.recipeId === 'acc')).toBe(true)
  })

  it('un plat posé SEUL garde `service: null` — le champ dit le mode, pas la recette', () => {
    // Sans accompagnement disponible, on reste en mode recette. Écrire `'plat'` ferait croire à
    // tout lecteur qu'une seconde entrée existe sur ce créneau.
    const sansAcc = makeCatalog([makeRecipe('plat1', { service: 'plat' }), makeRecipe('plat2', { service: 'plat' })])
    const plan = planWeek(sansAcc, makePlanRequest({ days: 2 }), fakeSuggest(['plat1', 'plat2']))

    expect(plan.entries).toHaveLength(2)
    expect(plan.entries.every((e) => e.service === null)).toBe(true)
  })

  it('n’accompagne QUE derrière un `service: "plat"` explicite', () => {
    // Une recette à `service: null` remplit son créneau seule : lui adjoindre du riz serait une
    // invention. Et une entrée posée par la seconde passe de `pickForSlot` est déjà un pis-aller —
    // l'empiler avec un second pis-aller aggraverait le cas.
    const plan = planWeek(AVEC_ACC, makePlanRequest({ days: 2 }), fakeSuggest(['sansService', 'ent', 'acc']))

    expect(plan.entries.some((e) => e.service === 'accompagnement')).toBe(false)
  })

  it('ne touche NI le petit-déjeuner NI le goûter — ils restent en mode recette', () => {
    const plan = planWeek(
      AVEC_ACC,
      makePlanRequest({ days: 2, slots: ['petit_dejeuner', 'gouter'] }),
      fakeSuggest(['plat1', 'acc', 'plat2'])
    )

    expect(plan.entries.every((e) => e.service === null)).toBe(true)
  })

  it('⛔ REFUSE l’accompagnement qui RÉPÈTE le plat — pas de boulgour sur du boulgour', () => {
    // Rien dans le catalogue ne dit si un plat se suffit : les 144 plats portent `service: 'plat'`
    // et rien d'autre. Le substitut mesurable est le chevauchement de composition
    // (`signatureOverlap`, seuil 0,30 — mesuré sur les 2 880 paires réelles). Ici `accProche` est
    // fait du MÊME aliment dominant que `platBoulgour` : il doit être écarté au profit du suivant.
    const boulgour = makeFood('boulgour')
    const poulet = makeFood('poulet')
    const carotte = makeFood('carotte')
    const ing = (foodId: string, quantiteG: number): RecipeIngredient =>
      ({ foodId: foodId as FoodId, quantiteG, uniteAffichage: 'g', optionnel: false }) as RecipeIngredient

    const catalogue = makeCatalog(
      [
        makeRecipe('platBoulgour', { service: 'plat', ingredients: [ing('boulgour', 200), ing('poulet', 20)] }),
        makeRecipe('accProche', { service: 'accompagnement', ingredients: [ing('boulgour', 180)] }),
        makeRecipe('accLoin', { service: 'accompagnement', ingredients: [ing('carotte', 180)] }),
      ],
      [boulgour, poulet, carotte]
    )
    const plan = planWeek(
      catalogue,
      makePlanRequest({ days: 2 }),
      fakeSuggest(['platBoulgour', 'accProche', 'accLoin'])
    )
    const acc = plan.entries.find((e) => e.service === 'accompagnement')

    expect(acc?.recipeId).toBe('accLoin')
  })
})

describe('planning/plan-week — un créneau GARDÉ garde son assiette ENTIÈRE', () => {
  // ⚠️ BUG TROUVÉ ET CORRIGÉ LE 2026-08-04, invisible de tous les tests existants. La règle des
  // verrous était « deux verrous sur le même créneau : le premier gagne », écrite quand un créneau
  // ne portait qu'un plat. Depuis le mode repas, garder un déjeuner verrouille DEUX entrées : n'en
  // reposer qu'une faisait DISPARAÎTRE l'accompagnement à chaque « Proposer une autre semaine ».
  // Le repas gardé changeait donc quand même — ce que §7.2 promet d'empêcher — et la journée
  // perdait son complément d'énergie en silence.

  const MENU = makeCatalog([
    makeRecipe('plat1', { service: 'plat' }),
    makeRecipe('plat2', { service: 'plat' }),
    makeRecipe('acc', { service: 'accompagnement' }),
  ])

  it('repose le plat ET son accompagnement, pas seulement le premier', () => {
    const verrous: MealPlanEntry[] = [
      { slot: { date: '2026-08-03', creneau: 'diner' }, recipeId: 'plat1' as RecipeId, portions: 2, locked: true, isLeftover: false, service: 'plat' },
      { slot: { date: '2026-08-03', creneau: 'diner' }, recipeId: 'acc' as RecipeId, portions: 2, locked: true, isLeftover: false, service: 'accompagnement' },
    ]
    const plan = planWeek(
      MENU,
      makePlanRequest({ days: 2, lockedEntries: verrous }),
      fakeSuggest(['plat2', 'acc'])
    )
    const gardes = plan.entries.filter((e) => e.slot.date === '2026-08-03')

    expect(gardes.map((e) => e.recipeId)).toEqual(['plat1', 'acc'])
    expect(gardes.every((e) => e.locked)).toBe(true)
  })

  it('un accompagnement VERROUILLÉ n’est pas interdit ailleurs dans la semaine', () => {
    // `placedRecipeIds` est amorcé avec les verrous ; y mettre l'accompagnement l'interdirait pour
    // toute la semaine au seul motif qu'un créneau a été gardé, alors qu'il est exempté partout
    // ailleurs. C'est la même exemption, appliquée à l'amorçage.
    const verrous: MealPlanEntry[] = [
      { slot: { date: '2026-08-03', creneau: 'diner' }, recipeId: 'plat1' as RecipeId, portions: 2, locked: true, isLeftover: false, service: 'plat' },
      { slot: { date: '2026-08-03', creneau: 'diner' }, recipeId: 'acc' as RecipeId, portions: 2, locked: true, isLeftover: false, service: 'accompagnement' },
    ]
    const plan = planWeek(
      MENU,
      makePlanRequest({ days: 2, lockedEntries: verrous }),
      fakeSuggest(['plat2', 'acc'])
    )

    expect(plan.entries.filter((e) => e.slot.date === '2026-08-04' && e.recipeId === 'acc')).toHaveLength(1)
  })

  it('deux verrous de MÊME service sur un créneau : le premier gagne toujours', () => {
    const verrous: MealPlanEntry[] = [
      { slot: { date: '2026-08-03', creneau: 'diner' }, recipeId: 'plat1' as RecipeId, portions: 2, locked: true, isLeftover: false, service: 'plat' },
      { slot: { date: '2026-08-03', creneau: 'diner' }, recipeId: 'plat2' as RecipeId, portions: 2, locked: true, isLeftover: false, service: 'plat' },
    ]
    const plan = planWeek(MENU, makePlanRequest({ days: 2, lockedEntries: verrous }), fakeSuggest(['plat2']))

    expect(plan.entries.filter((e) => e.slot.date === '2026-08-03').map((e) => e.recipeId)).toEqual(['plat1'])
  })
})

describe('planning/reroll-slot — l’accompagnement suit le plat qu’on remplace', () => {
  // ⚠️ CE QUE CES TESTS GARDENT — dette identifiée le 2026-08-04 et corrigée le même jour. Le reroll
  // ne touchait que l'entrée du plat : l'accompagnement de l'ANCIEN plat restait attaché au NOUVEAU.
  // On refusait « Poulet rôti » pour tomber sur « Rösti de pommes de terre », et la purée de pommes
  // de terre était toujours là. Pire qu'une paire bancale : un vestige.

  const MENU = makeCatalog([
    makeRecipe('plat1', { service: 'plat' }),
    makeRecipe('plat2', { service: 'plat' }),
    makeRecipe('plat3', { service: 'plat' }),
    makeRecipe('acc', { service: 'accompagnement' }),
  ])
  const CONTEXTE = {
    profile: makePlanRequest().profile,
    constraints: makePlanRequest().constraints,
    history: { windowDays: 21, entries: [] },
    activeTopics: [],
    seed: 1,
  } as const

  function planDeDeuxJours(): WeekPlan {
    return planWeek(MENU, makePlanRequest({ days: 2 }), fakeSuggest(['plat1', 'acc', 'plat2', 'plat3']))
  }

  it('remplace le plat ET son accompagnement, sans laisser de vestige', () => {
    const plan = planDeDeuxJours()
    const slot = { date: '2026-08-03', creneau: 'diner' as MealSlot }
    expect(plan.entries.filter((e) => e.slot.date === slot.date)).toHaveLength(2)

    const apres = rerollSlot(MENU, plan, slot, CONTEXTE, fakeSuggest(['plat1', 'plat2', 'acc', 'plat3']))
    const duCreneau = apres.entries.filter((e) => e.slot.date === slot.date)

    expect(duCreneau.map((e) => e.service)).toEqual(['plat', 'accompagnement'])
    expect(duCreneau[0]?.recipeId).not.toBe('plat1') // le plat refusé ne revient pas
    expect(duCreneau[1]?.recipeId).toBe('acc')
  })

  it('⛔ NE LAISSE PAS L’ACCOMPAGNEMENT SEUL quand plus aucun plat n’est disponible', () => {
    // Le créneau redevient VIDE pour de bon. Un accompagnement orphelin serait pire que rien : il
    // afficherait « du riz » comme dîner sans que personne l'ait choisi.
    const plan = planDeDeuxJours()
    const slot = { date: '2026-08-03', creneau: 'diner' as MealSlot }

    const apres = rerollSlot(MENU, plan, slot, CONTEXTE, fakeSuggest([]))
    const duCreneau = apres.entries.filter((e) => e.slot.date === slot.date)

    expect(duCreneau).toHaveLength(1)
    expect(duCreneau[0]?.recipeId).toBeNull()
    expect(duCreneau[0]?.service).toBeNull()
  })

  it('ne touche AUCUN autre créneau — la promesse de §7.1 tient malgré la reconstruction', () => {
    // La correction reconstruit le créneau au lieu de patcher un indice : c'est ce qui permet de
    // passer de 2 entrées à 1. Il fallait garder la garantie que le reste du plan ne bouge pas.
    const plan = planDeDeuxJours()
    const avant = plan.entries.filter((e) => e.slot.date === '2026-08-04').map((e) => e.recipeId)

    const apres = rerollSlot(
      MENU,
      plan,
      { date: '2026-08-03', creneau: 'diner' },
      CONTEXTE,
      fakeSuggest(['plat2', 'acc'])
    )

    expect(apres.entries.filter((e) => e.slot.date === '2026-08-04').map((e) => e.recipeId)).toEqual(avant)
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
    const { checkCalorieFloor } = await import('../guards/index.js')
    const plan = planWeek(CATALOG, makePlanRequest({ days: 2 }), fakeSuggest(['a', 'b']))

    expect(checkCalorieFloor(plan, makePlanRequest().profile, CATALOG as Catalog)).toEqual([])
  })

  it('le plan sort TOUJOURS — un jour sous le plancher AVERTIT, il n’annule pas', async () => {
    // Régression de fond : la première version levait `EngineSafetyError` et faisait perdre les
    // sept jours pour une seule journée légère. §6.5 demande un écran d'avertissement, pas un refus.
    const { checkCalorieFloor } = await import('../guards/index.js')
    const maigre = {
      ...CATALOG,
      nutrients: [{ id: 'energie', code: 'energie', nom: 'Énergie', unite: 'kcal', vnrAdulte: 2000, categorie: 'macronutriment', sens: 'cible' }],
      indexes: { ...CATALOG.indexes, recipeNutrients: new Map(RECIPES.map((r) => [r.id, new Float64Array([50])])) },
    } as unknown as Catalog

    const plan = planWeek(maigre, makePlanRequest({ days: 2, slots: ['dejeuner', 'diner'] }), fakeSuggest(['a', 'b', 'c', 'd']))
    const warnings = checkCalorieFloor(plan, makePlanRequest().profile, maigre)

    expect(plan.entries.filter((e) => e.recipeId !== null)).toHaveLength(4) // le plan existe
    expect(warnings.length).toBeGreaterThan(0) // et il est signalé
    expect(warnings[0]).toMatchObject({ kind: 'plancher_calorique', seuil: 1200 })
  })

  it('⛔ DIT COMBIEN DE REPAS IL A COMPTÉS — il ne mesure PAS une journée', async () => {
    const { checkCalorieFloor } = await import('../guards/index.js')
    // ⚠️ AJOUTÉ LE 2026-08-04. `checkCalorieFloor` additionne les recettes POSÉES AU PLAN, pas
    // l'apport de la personne : ni le pain, ni un yaourt, ni un repas pris dehors — ni le
    // petit-déjeuner quand le plan n'a que deux créneaux, ce qui est le DÉFAUT de l'écran Semaine.
    // Sans ce champ, l'écran ne peut écrire que « votre journée », et sur une application à
    // garde-fous TCA (§6.5) annoncer à quelqu'un qu'il mange 830 kcal par jour quand on n'en sait
    // rien est exactement l'affirmation à ne pas produire.
    const maigre = {
      ...CATALOG,
      nutrients: [{ id: 'energie', code: 'energie', nom: 'Énergie', unite: 'kcal', vnrAdulte: 2000, categorie: 'macronutriment', sens: 'cible' }],
      indexes: { ...CATALOG.indexes, recipeNutrients: new Map(RECIPES.map((r) => [r.id, new Float64Array([50])])) },
    } as unknown as Catalog

    const deuxRepas = planWeek(maigre, makePlanRequest({ days: 2, slots: ['dejeuner', 'diner'] }), fakeSuggest(['a', 'b', 'c', 'd']))
    expect(checkCalorieFloor(deuxRepas, makePlanRequest().profile, maigre)[0]?.repasComptes).toBe(2)

    const troisRepas = planWeek(
      maigre,
      makePlanRequest({ days: 2, slots: ['petit_dejeuner', 'dejeuner', 'diner'] }),
      fakeSuggest(['a', 'b', 'c', 'd', 'e', 'f'])
    )
    expect(checkCalorieFloor(troisRepas, makePlanRequest().profile, maigre)[0]?.repasComptes).toBe(3)
  })
})

describe('planning/plan-week — cible nutritionnelle RESTANTE (§7.1, cumul réinjecté)', () => {
  /** Catalogue minimal avec un vrai nutriment, pour que la cible ne soit pas un vecteur vide. */
  function catalogAvecEnergie() {
    const base = makeCatalog(RECIPES)
    return {
      ...base,
      nutrients: [{ id: 'energie', code: 'energie', nom: 'Énergie', unite: 'kcal', vnrAdulte: 2000, categorie: 'macronutriment', sens: 'cible' }],
      indexes: {
        ...base.indexes,
        recipeNutrients: new Map(RECIPES.map((r) => [r.id, new Float64Array([500])])),
      },
    } as unknown as Catalog
  }

  it('chaque créneau reçoit une cible, jamais `undefined`', () => {
    const vu: SuggestionRequest[] = []
    const suggest = (r: SuggestionRequest) => {
      vu.push(r)
      return fakeSuggest(['a', 'b', 'c'])(r)
    }

    planWeek(catalogAvecEnergie(), makePlanRequest({ days: 3 }), suggest)

    expect(vu.every((r) => r.nutrientTarget !== undefined)).toBe(true)
  })

  it('un plat déjà placé FAIT MONTER la cible du créneau suivant du même jour', () => {
    // Le cœur du « cumul réinjecté » : après un repas léger, il reste plus à couvrir, donc le
    // créneau suivant vise plus haut. Sans ce mécanisme les deux cibles seraient identiques.
    const vu: SuggestionRequest[] = []
    const suggest = (r: SuggestionRequest) => {
      vu.push(r)
      return fakeSuggest(['a', 'b', 'c', 'd'])(r)
    }

    planWeek(catalogAvecEnergie(), makePlanRequest({ days: 1 + 1, slots: ['dejeuner', 'diner'] }), suggest)

    // Exprimé en RELATION, pas en valeur absolue : la référence journalière est calculée depuis le
    // profil (≈ 1 999,89 kcal ici) et n'a pas à être connue du test — la figer le rendrait fragile
    // au moindre ajustement de `resolveReferenceIntakes`.
    //   créneau 1 : référence / 2                 → référence = 2 × cible1
    //   créneau 2 : (référence − 500) / 1         → 2 × cible1 − 500
    const cible1 = vu[0]!.nutrientTarget![0]!
    expect(vu[1]!.nutrientTarget![0]).toBeCloseTo(2 * cible1 - 500, 6)
    expect(vu[1]!.nutrientTarget![0]!).toBeGreaterThan(cible1)
  })

  it('le cumul est REMIS À ZÉRO chaque jour — la référence est journalière', () => {
    const vu: SuggestionRequest[] = []
    const suggest = (r: SuggestionRequest) => {
      vu.push(r)
      return fakeSuggest(['a', 'b', 'c', 'd'])(r)
    }

    planWeek(catalogAvecEnergie(), makePlanRequest({ days: 2, slots: ['dejeuner', 'diner'] }), suggest)

    // Le 1er créneau du jour 2 doit revoir la cible pleine, pas le reliquat du jour 1.
    expect(vu[2]!.nutrientTarget![0]).toBeCloseTo(vu[0]!.nutrientTarget![0]!, 6)
  })

  it('cible plancher à ZÉRO quand la journée est déjà couverte, jamais négative', () => {
    // Un négatif ferait DISPARAÎTRE le nutriment du score (`scoreNutri` ignore les cibles ≤ 0) au
    // lieu de dire « on a assez » — l'inverse de l'intention.
    const gros = { ...catalogAvecEnergie() } as Catalog
    const index = new Map(RECIPES.map((r) => [r.id, new Float64Array([5000])]))
    const catalog = { ...gros, indexes: { ...gros.indexes, recipeNutrients: index } } as Catalog

    const vu: SuggestionRequest[] = []
    const suggest = (r: SuggestionRequest) => {
      vu.push(r)
      return fakeSuggest(['a', 'b'])(r)
    }

    planWeek(catalog, makePlanRequest({ days: 2, slots: ['dejeuner', 'diner'] }), suggest)

    expect(vu[1]!.nutrientTarget![0]).toBe(0)
  })
})

describe('planning/plan-week — la FENÊTRE DE CANDIDATS demandée à `suggest`', () => {
  // ⚠️ RÉGRESSION D'UN BUG RÉEL, trouvé au banc de stress le 2026-07-28. `slotRequest` ne fixait ni
  // `limit` ni `skipDiversification` : `suggestMeals` rendait donc 5 suggestions diversifiées, et
  // quand ces 5 étaient déjà placées le créneau restait VIDE alors que des dizaines de candidats
  // attendaient. Mesuré sur le catalogue réel : 11 petits-déjeuners placés sur 14 demandés, pour
  // 17 recettes disponibles ; 39 créneaux sur 42 en 14 jours × 3.
  it('demande AU MOINS autant de candidats qu’il peut y en avoir de déjà placés', () => {
    const vu: SuggestionRequest[] = []
    const suggest = (r: SuggestionRequest) => {
      vu.push(r)
      return fakeSuggest(['a', 'b', 'c'])(r)
    }

    planWeek(CATALOG, makePlanRequest({ days: 7, slots: ['dejeuner', 'diner'] }), suggest)

    // 7 × 2 = 14 créneaux : une limite de 5 laisserait des créneaux vides sans raison.
    for (const requete of vu) {
      expect(requete.limit).toBeGreaterThan(14)
    }
  })

  it('désactive la diversification — le glouton fait sa propre variété', () => {
    // MMR réordonnerait un ensemble dont `planWeek` ne prend qu'un élément, sans rien apporter :
    // la variété du plan vient de l'historique de travail et de `placedRecipeIds`.
    const vu: SuggestionRequest[] = []
    const suggest = (r: SuggestionRequest) => {
      vu.push(r)
      return fakeSuggest(['a'])(r)
    }

    planWeek(CATALOG, makePlanRequest({ days: 2 }), suggest)

    expect(vu.every((r) => r.skipDiversification === true)).toBe(true)
  })
})

describe('planning/plan-week — créneaux VERROUILLÉS (§7.2, « vos repas gardés ne changeront pas »)', () => {
  const verrou = (date: string, creneau: MealSlot, recette: string | null): MealPlanEntry => ({
    slot: { date, creneau },
    recipeId: recette as RecipeId | null,
    portions: 4,
    locked: true,
    isLeftover: false,
    service: null,
  })

  it('garde la recette verrouillée, même quand `suggest` en propose une autre', () => {
    const plan = planWeek(
      CATALOG,
      makePlanRequest({ days: 3, lockedEntries: [verrou('2026-08-04', 'diner', 'f')] }),
      fakeSuggest(['a', 'b', 'c'])
    )

    const mardi = plan.entries.find((e) => e.slot.date === '2026-08-04')
    expect(mardi?.recipeId).toBe('f')
    expect(mardi?.locked).toBe(true)
  })

  it('NE REPLACE JAMAIS le plat verrouillé ailleurs dans la fenêtre', () => {
    // C'est la garantie dure de `placedRecipeIds`. Sans amorçage, le glouton proposerait « a » dès
    // le lundi et on aurait le même plat deux fois — le défaut exact que le contournement côté UI
    // aurait introduit.
    const plan = planWeek(
      CATALOG,
      makePlanRequest({ days: 3, lockedEntries: [verrou('2026-08-05', 'diner', 'a')] }),
      fakeSuggest(['a', 'b', 'c', 'd'])
    )

    const recettes = plan.entries.map((e) => e.recipeId)
    // Les trois assertions ensemble : « a » est bien AU CRÉNEAU VERROUILLÉ, il n'y est qu'une fois,
    // et rien d'autre n'est dupliqué. Sans la première, le test passerait sur un plan qui ignore
    // purement et simplement le verrou.
    expect(plan.entries.find((e) => e.slot.date === '2026-08-05')?.recipeId).toBe('a')
    expect(recettes.filter((r) => r === 'a')).toHaveLength(1)
    expect(new Set(recettes).size).toBe(recettes.length)
  })

  it('préserve les métadonnées du verrou — portions, reste, service', () => {
    const reste: MealPlanEntry = { ...verrou('2026-08-04', 'diner', 'f'), portions: 2, isLeftover: true }
    const plan = planWeek(
      CATALOG,
      makePlanRequest({ days: 3, lockedEntries: [reste] }),
      fakeSuggest(['a', 'b', 'c'])
    )

    const mardi = plan.entries.find((e) => e.slot.date === '2026-08-04')
    expect(mardi?.portions).toBe(2)
    expect(mardi?.isLeftover).toBe(true)
  })

  it('honore un verrou VIDE — « je ne mange pas ici » se garde aussi', () => {
    const plan = planWeek(
      CATALOG,
      makePlanRequest({ days: 3, lockedEntries: [verrou('2026-08-04', 'diner', null)] }),
      fakeSuggest(['a', 'b', 'c'])
    )

    const mardi = plan.entries.find((e) => e.slot.date === '2026-08-04')
    expect(mardi?.recipeId).toBeNull()
    expect(mardi?.locked).toBe(true)
  })

  it('ignore un verrou hors de la fenêtre plutôt que de le forcer dedans', () => {
    const plan = planWeek(
      CATALOG,
      makePlanRequest({
        days: 3,
        slots: ['diner'],
        // hors fenêtre par la date, puis par le créneau
        lockedEntries: [verrou('2026-09-01', 'diner', 'f'), verrou('2026-08-04', 'dejeuner', 'e')],
      }),
      fakeSuggest(['a', 'b', 'c'])
    )

    expect(plan.entries).toHaveLength(3)
    expect(plan.entries.map((e) => e.recipeId)).toEqual(['a', 'b', 'c'])
  })

  it('n’interroge PAS `suggest` pour un créneau verrouillé', () => {
    const vu: SuggestionRequest[] = []
    const suggest = (r: SuggestionRequest) => {
      vu.push(r)
      return fakeSuggest(['a', 'b', 'c'])(r)
    }

    planWeek(CATALOG, makePlanRequest({ days: 3, lockedEntries: [verrou('2026-08-04', 'diner', 'f')] }), suggest)

    expect(vu).toHaveLength(2)
    expect(vu.map((r) => r.context.date)).toEqual(['2026-08-03', '2026-08-05'])
  })

  it('n’entre dans l’historique de travail QU’À SA DATE — lundi ne voit pas le mercredi', () => {
    // Même invariant que la copie de `workingEntries` : semer tous les verrous en amont ferait voir
    // au lundi un repas du mercredi. `variety` ignore les entrées futures, mais pas `habit`.
    const vu: SuggestionRequest[] = []
    const suggest = (r: SuggestionRequest) => {
      vu.push(r)
      return fakeSuggest(['a', 'b', 'c'])(r)
    }

    planWeek(CATALOG, makePlanRequest({ days: 3, lockedEntries: [verrou('2026-08-04', 'diner', 'f')] }), suggest)

    const [lundi, mercredi] = vu
    expect(lundi!.history.entries.map((e) => e.recipeId)).not.toContain('f')
    expect(mercredi!.history.entries.map((e) => e.recipeId)).toContain('f')
  })

  it('sans le champ, le plan est IDENTIQUE à celui d’avant — aucune régression', () => {
    const sans = planWeek(CATALOG, makePlanRequest({ days: 3 }), fakeSuggest(['a', 'b', 'c', 'd']))
    const vide = planWeek(CATALOG, makePlanRequest({ days: 3, lockedEntries: [] }), fakeSuggest(['a', 'b', 'c', 'd']))

    expect(vide).toEqual(sans)
    expect(sans.entries.every((e) => e.locked === false)).toBe(true)
  })
})
