// engine/domain/plats-par-creneau.test.ts
//
// ⚠️ AUCUNE TAILLE DE CATALOGUE N'EST CODÉE EN DUR ICI. Les fixtures sont montées à la main et les
// assertions portent sur des RELATIONS (« ce créneau tombe à zéro pendant que l'autre garde tout »),
// jamais sur un nombre livré par le contenu. Un test qui parie sur « 330 recettes » casse au premier
// lot de contenu et n'a rien vérifié entre-temps.
//
// ⚠️ LE CROISEMENT AVEC LE MOTEUR EST L'ORACLE, PAS UNE REDITE. Le libellé « aucun plat » repose sur
// un fait du moteur — `suggestMeals` LÈVE à zéro candidat — et un test qui se contenterait de
// recompter ce que `platsParCreneau` vient de compter ne vérifierait rien : il partagerait la donnée
// de son sujet. On confronte donc le compte au comportement RÉEL de `suggestMeals` et de `planWeek`.

import { describe, expect, it } from 'vitest'
import { platsParCreneau, etatDuCreneau } from './plats-par-creneau.js'
import { NoViableRecipeError } from './errors.js'
import type { MealSlot } from './catalog.js'
import type { RecipeId } from './ids.js'
import {
  makeCatalog,
  makeFood,
  makeIngredient,
  makeRecipe,
  makeRequest,
} from '../selection/test-fixtures.js'
import { createEngine } from '../api/index.js'

const ids = (...noms: readonly string[]): readonly RecipeId[] => noms as readonly RecipeId[]

function index(
  paires: readonly (readonly [MealSlot, readonly string[]])[]
): ReadonlyMap<MealSlot, ReadonlySet<RecipeId>> {
  return new Map(paires.map(([creneau, noms]) => [creneau, new Set(ids(...noms))]))
}

describe('platsParCreneau', () => {
  it('ne compte que l’intersection : proposable ET servi à ce créneau', () => {
    const comptes = platsParCreneau(
      ids('a', 'b', 'c'),
      index([
        ['dejeuner', ['a', 'b', 'z']],
        ['diner', ['c']],
      ]),
      ['dejeuner', 'diner'],
      7
    )

    expect(comptes.map((c) => c.plats)).toEqual([2, 1])
  })

  it('rend les créneaux DEMANDÉS, dans l’ordre demandé, et eux seuls', () => {
    const comptes = platsParCreneau(
      ids('a'),
      index([
        ['petit_dejeuner', ['a']],
        ['gouter', ['a']],
        ['diner', ['a']],
      ]),
      ['diner', 'petit_dejeuner'],
      7
    )

    expect(comptes.map((c) => c.creneau)).toEqual(['diner', 'petit_dejeuner'])
  })

  it('un créneau absent de l’index vaut zéro, pas une absence de ligne', () => {
    const comptes = platsParCreneau(
      ids('a'),
      index([['diner', ['a']]]),
      ['gouter'],
      7
    )

    expect(comptes).toEqual([{ creneau: 'gouter', plats: 0, etat: 'vide' }])
  })

  it('⛔ UN CRÉNEAU PEUT ÊTRE VIDE PENDANT QUE LES AUTRES SONT PLEINS — c’est pourquoi le compte est PAR CRÉNEAU', () => {
    // Le total, lui, ne bouge presque pas : c'est exactement la panne mesurée au banc sur
    // « végétalien + sans gluten ». Un compteur global l'aurait laissée passer.
    const proposables = ids('p1', 'p2', 'p3', 'p4')
    const comptes = platsParCreneau(
      proposables,
      index([
        ['dejeuner', ['p1', 'p2', 'p3', 'p4']],
        ['diner', ['disparu']],
      ]),
      ['dejeuner', 'diner'],
      7
    )

    const total = new Set(proposables).size
    expect(total).toBeGreaterThan(0)
    expect(comptes.find((c) => c.creneau === 'dejeuner')?.etat).not.toBe('vide')
    expect(comptes.find((c) => c.creneau === 'diner')?.etat).toBe('vide')
  })
})

describe('etatDuCreneau — les deux seuils, et ils ne se confondent pas', () => {
  it('zéro plat est le seul cas « vide »', () => {
    expect(etatDuCreneau(0, 7)).toBe('vide')
    expect(etatDuCreneau(1, 7)).not.toBe('vide')
  })

  it('en dessous de l’horizon demandé : « court », jamais « vide »', () => {
    for (let plats = 1; plats < 7; plats++) expect(etatDuCreneau(plats, 7)).toBe('court')
  })

  it('à partir de l’horizon demandé : « suffisant »', () => {
    expect(etatDuCreneau(7, 7)).toBe('suffisant')
    expect(etatDuCreneau(8, 7)).toBe('suffisant')
  })

  it('le seuil SUIT l’horizon, il n’est pas figé à sept', () => {
    expect(etatDuCreneau(3, 2)).toBe('suffisant')
    expect(etatDuCreneau(3, 14)).toBe('court')
  })
})

// --- L'oracle : le compte confronté au moteur ---------------------------------------------------

const OEUF = makeFood('oeuf')
const RIZ = makeFood('riz', [])

function catalogueDeuxCreneaux() {
  return makeCatalog(
    [
      makeRecipe('omelette', {
        typesRepas: ['diner'],
        ingredients: [makeIngredient('oeuf')],
      }),
      makeRecipe('riz_pilaf', {
        typesRepas: ['dejeuner'],
        ingredients: [makeIngredient('riz')],
      }),
    ],
    [OEUF, RIZ]
  )
}

describe('le compte dit vrai sur ce que le moteur fera', () => {
  it('⛔ « ZÉRO PLAT » EST VÉRIFIÉ CONTRE `suggestMeals`, QUI LÈVE — le mot fort est justifié', () => {
    const catalogue = catalogueDeuxCreneaux()
    const moteur = createEngine(catalogue)
    const contraintes = makeRequest({ excludedFoodIds: ['oeuf'] }).constraints

    const comptes = platsParCreneau(
      moteur.browseRecipes({ constraints: contraintes }).recipeIds,
      catalogue.indexes.recipesBySlot,
      ['dejeuner', 'diner'],
      7
    )

    expect(comptes.find((c) => c.creneau === 'diner')?.etat).toBe('vide')
    expect(comptes.find((c) => c.creneau === 'dejeuner')?.etat).not.toBe('vide')

    // Et c'est bien ce que fait le moteur : le créneau à zéro lève, l'autre répond.
    expect(() =>
      moteur.suggestMeals(
        makeRequest({ creneau: 'diner', excludedFoodIds: ['oeuf'] })
      )
    ).toThrow(NoViableRecipeError)
    expect(
      moteur.suggestMeals(makeRequest({ creneau: 'dejeuner', excludedFoodIds: ['oeuf'] }))
        .suggestions.length
    ).toBeGreaterThan(0)
  })

  it('⛔ SOUS L’HORIZON, LE PLAN LAISSE DES CASES VIDES — IL NE RÉPÈTE PAS. « répétitif » serait faux', () => {
    // Un seul plat proposable au dîner, trois jours de plan : si `planWeek` répétait, les trois
    // cases seraient remplies. Elles ne le sont pas — `pickForSlot` écarte tout plat déjà placé
    // dans ses DEUX passes, `placedRecipeIds` n'étant jamais remis à zéro d'un jour à l'autre.
    const catalogue = catalogueDeuxCreneaux()
    const moteur = createEngine(catalogue)

    const comptes = platsParCreneau(
      moteur.browseRecipes({ constraints: makeRequest().constraints }).recipeIds,
      catalogue.indexes.recipesBySlot,
      ['diner'],
      3
    )
    expect(comptes[0]?.plats).toBe(1)
    expect(comptes[0]?.etat).toBe('court')

    const base = makeRequest()
    const plan = moteur.planWeek({
      profile: base.profile,
      constraints: base.constraints,
      startDate: '2026-07-23',
      days: 3,
      slots: ['diner'],
      history: base.history,
      activeTopics: [],
      tolerancePiquant: null,
      convives: 1,
      seed: 1,
    })

    const remplis = plan.entries.filter((e) => e.recipeId !== null)
    const vides = plan.entries.filter((e) => e.recipeId === null)
    expect(remplis.length).toBe(1)
    expect(vides.length).toBe(2)
    // La preuve que ce n'est pas une répétition : aucun plat n'apparaît deux fois.
    expect(new Set(remplis.map((e) => e.recipeId)).size).toBe(remplis.length)
  })

  it('⛔ LE SERVICE NE RESTREINT PAS CE COMPTE — un dîner d’entrées et d’accompagnements est REMPLI', () => {
    // ⛔ CE TEST EXISTE POUR EMPÊCHER UNE « CORRECTION ». L'idée d'appliquer ici `peutRemplirSeul`
    // (engine/planning/plan-week.ts) revient forcément : ce filtre écarte bien les `entree`,
    // `accompagnement`, `fromage` et `dessert` au déjeuner et au dîner. Mais il ne gouverne que la
    // PREMIÈRE passe de `pickForSlot` — la seconde repose la question sans lui. Filtrer ici ferait
    // lire « aucun plat ne reste, ce repas ne pourra pas être proposé » sur un créneau que le plan
    // remplit. L'oracle est le planificateur lui-même, pas un recomptage.
    const partielles = [
      makeRecipe('entree_artichauts', {
        typesRepas: ['diner'],
        service: 'entree',
        ingredients: [makeIngredient('riz')],
      }),
      makeRecipe('puree_carottes', {
        typesRepas: ['diner'],
        service: 'accompagnement',
        ingredients: [makeIngredient('riz')],
      }),
      makeRecipe('plateau_fromages', {
        typesRepas: ['diner'],
        service: 'fromage',
        ingredients: [makeIngredient('riz')],
      }),
      makeRecipe('tarte_pommes', {
        typesRepas: ['diner'],
        service: 'dessert',
        ingredients: [makeIngredient('riz')],
      }),
    ]
    const catalogue = makeCatalog(partielles, [RIZ])
    const moteur = createEngine(catalogue)
    const base = makeRequest()

    const jours = partielles.length + 3
    const comptes = platsParCreneau(
      moteur.browseRecipes({ constraints: base.constraints }).recipeIds,
      catalogue.indexes.recipesBySlot,
      ['diner'],
      jours
    )

    // Le compte les garde toutes, et l'état reste le mot mesuré : « court », pas « vide ».
    expect(comptes[0]?.plats).toBe(partielles.length)
    expect(comptes[0]?.etat).toBe('court')

    const plan = moteur.planWeek({
      profile: base.profile,
      constraints: base.constraints,
      startDate: '2026-07-23',
      days: jours,
      slots: ['diner'],
      history: base.history,
      activeTopics: [],
      tolerancePiquant: null,
      convives: 1,
      seed: 1,
    })

    // Autant de dîners remplis que de recettes comptées — la SECONDE passe les pose toutes.
    const remplis = plan.entries.filter((e) => e.recipeId !== null)
    expect(remplis.length).toBe(comptes[0]?.plats)
    expect(plan.entries.length - remplis.length).toBe(jours - partielles.length)

    // Et l'écran du jour ne lève pas non plus : « ne pourra pas être proposé » serait faux.
    expect(moteur.suggestMeals(makeRequest({ creneau: 'diner' })).suggestions.length).toBeGreaterThan(
      0
    )
  })
})
