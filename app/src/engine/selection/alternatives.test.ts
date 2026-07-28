// engine/selection/alternatives.test.ts — `suggestAlternatives` (docs/ENGINE.md §8.4, décision 26).

import { describe, expect, it } from 'vitest'
import { MAX_ALTERNATIVES, suggestAlternatives } from './alternatives.js'
import { makeCatalog, makeFood, makeIngredient, makeRecipe, makeRequest } from './test-fixtures.js'
import type { Catalog, FoodId, Recipe, RecipeId } from '../domain/index.js'

// Un plat de poisson, deux frères, et un plat sans rapport. `groupe` est ce qui compte ici.
const CABILLAUD = makeFoodInGroup('cabillaud', 'poissons')
const BAR = makeFoodInGroup('bar', 'poissons')
const DORADE = makeFoodInGroup('dorade', 'poissons')
const BOEUF = makeFoodInGroup('boeuf', 'viandes')
const EPINARD = makeFoodInGroup('epinard', 'légumes')
const CREME = makeFoodInGroup('creme', 'lait et produits laitiers')

function makeFoodInGroup(id: string, groupe: string) {
  return { ...makeFood(id), groupe }
}

/** Le poisson pèse moins que l'épinard : c'est tout l'intérêt du repli par groupe définissant. */
const CABILLAUD_EPINARDS = makeRecipe('cabillaud_epinards', {
  ingredients: [makeIngredient('epinard', { quantiteG: 300 }), makeIngredient('cabillaud', { quantiteG: 200 })],
})
const BAR_GRILLE = makeRecipe('bar_grille', { ingredients: [makeIngredient('bar', { quantiteG: 250 })] })
const DORADE_FOUR = makeRecipe('dorade_four', { ingredients: [makeIngredient('dorade', { quantiteG: 250 })] })
const BOEUF_CAROTTES = makeRecipe('boeuf_carottes', { ingredients: [makeIngredient('boeuf', { quantiteG: 250 })] })

const FOODS = [CABILLAUD, BAR, DORADE, BOEUF, EPINARD, CREME]
const RECIPES = [CABILLAUD_EPINARDS, BAR_GRILLE, DORADE_FOUR, BOEUF_CAROTTES]

function ids(catalog: Catalog, recipeId: RecipeId, foodId: string): readonly string[] {
  return suggestAlternatives(catalog, makeRequest(), recipeId, foodId as FoodId).alternatives.map((a) => a.recipeId)
}

describe('selection/alternatives — ALTERNATIVES (autre recette du même genre)', () => {
  const catalog = makeCatalog(RECIPES, FOODS)

  it('propose les plats du MÊME groupe avec un aliment caractéristique DIFFÉRENT', () => {
    expect([...ids(catalog, CABILLAUD_EPINARDS.id, 'cabillaud')].sort()).toEqual(['bar_grille', 'dorade_four'])
  })

  it('n’a PAS suivi le plus lourd : l’épinard pèse plus que le cabillaud, et pourtant on propose du poisson', () => {
    // Cœur de la décision 26. Un modèle fondé sur `recipeMainIngredient` aurait vu un plat
    // d'ÉPINARDS et proposé d'autres légumes — un service inutile pour qui n'aime pas le cabillaud.
    const propositions = ids(catalog, CABILLAUD_EPINARDS.id, 'cabillaud')
    expect(propositions).not.toContain('boeuf_carottes')
    expect(propositions.length).toBeGreaterThan(0)
  })

  it('n’inclut jamais la recette d’origine', () => {
    expect(ids(catalog, CABILLAUD_EPINARDS.id, 'cabillaud')).not.toContain(CABILLAUD_EPINARDS.id)
  })

  it('exclut toute recette contenant l’aliment rejeté, même en OPTIONNEL', () => {
    // Le piège : un plat frère qui contient quand même l'ingrédient rejeté en garniture.
    const barAuCabillaud = makeRecipe('bar_au_cabillaud', {
      ingredients: [
        makeIngredient('bar', { quantiteG: 250 }),
        makeIngredient('cabillaud', { quantiteG: 50, optionnel: true }),
      ],
    })
    const avecPiege = makeCatalog([...RECIPES, barAuCabillaud], FOODS)

    expect(ids(avecPiege, CABILLAUD_EPINARDS.id, 'cabillaud')).not.toContain('bar_au_cabillaud')
  })

  it('ne propose pas un plat dont l’aliment caractéristique est le MÊME', () => {
    const autreCabillaud = makeRecipe('autre_cabillaud', { ingredients: [makeIngredient('cabillaud', { quantiteG: 250 })] })
    const avecJumeau = makeCatalog([...RECIPES, autreCabillaud], FOODS)

    // Il est de toute façon exclu par le filtre « contient l'aliment rejeté » ; ce test verrouille
    // la SECONDE garde, celle qui vaut aussi quand l'aliment rejeté est secondaire.
    expect(ids(avecJumeau, CABILLAUD_EPINARDS.id, 'epinard')).not.toContain('autre_cabillaud')
  })

  it('respecte les filtres de l’utilisateur — un allergène déclaré n’est jamais proposé', () => {
    // LA garantie qui justifie de prendre un `SuggestionRequest` plutôt que `(recipeId, foodId)`.
    const poisson = { ...makeFoodInGroup('saumon', 'poissons'), allergenes: [{ allergenId: 'poisson' as never, certitude: 'contient' as const }] }
    const platSaumon = makeRecipe('plat_saumon', { ingredients: [makeIngredient('saumon', { quantiteG: 250 })] })
    const catalogAllergene = makeCatalog([...RECIPES, platSaumon], [...FOODS, poisson])

    const req = makeRequest({ allergies: ['poisson'] })
    const resultat = suggestAlternatives(catalogAllergene, req, CABILLAUD_EPINARDS.id, 'cabillaud' as FoodId)

    expect(resultat.alternatives.map((a) => a.recipeId)).not.toContain('plat_saumon')
  })

  it(`ne rend jamais plus de ${MAX_ALTERNATIVES} alternatives`, () => {
    const beaucoup: Recipe[] = Array.from({ length: 12 }, (_, i) =>
      makeRecipe(`poisson_${i}`, { ingredients: [makeIngredient(`p${i}`, { quantiteG: 250 })] })
    )
    const foods = beaucoup.map((_, i) => makeFoodInGroup(`p${i}`, 'poissons'))
    const gros = makeCatalog([CABILLAUD_EPINARDS, ...beaucoup], [...FOODS, ...foods])

    expect(ids(gros, CABILLAUD_EPINARDS.id, 'cabillaud').length).toBe(MAX_ALTERNATIVES)
  })

  it('classement DÉTERMINISTE — deux appels identiques rendent le même ordre', () => {
    // Faute de critère mesuré, l'ordre est celui des ids. Ce qui n'est pas négociable, c'est sa
    // stabilité : une liste qui change à chaque appel serait inutilisable.
    expect(ids(catalog, CABILLAUD_EPINARDS.id, 'cabillaud')).toEqual(ids(catalog, CABILLAUD_EPINARDS.id, 'cabillaud'))
  })

  it('recette inconnue → aucune alternative, pas de plantage', () => {
    expect(ids(catalog, 'inexistante' as RecipeId, 'cabillaud')).toEqual([])
  })
})

describe('selection/alternatives — VARIANTES (même recette, autrement)', () => {
  it('ingrédient OPTIONNEL → variante de retrait', () => {
    const avecCreme = makeRecipe('cabillaud_creme', {
      ingredients: [
        makeIngredient('cabillaud', { quantiteG: 200 }),
        makeIngredient('creme', { quantiteG: 50, optionnel: true }),
      ],
    })
    const catalog = makeCatalog([avecCreme], FOODS)

    const { variants } = suggestAlternatives(catalog, makeRequest(), avecCreme.id, 'creme' as FoodId)

    expect(variants).toHaveLength(1)
    expect(variants[0]!.kind).toBe('retrait_optionnel')
    expect(variants[0]!.replacementFoodId).toBeNull() // un retrait ne remplace rien
  })

  it('ingrédient NON optionnel → aucun retrait proposé', () => {
    // Retirer un ingrédient structurel produirait une recette dont les étapes mentent.
    const catalog = makeCatalog(RECIPES, FOODS)
    const { variants } = suggestAlternatives(catalog, makeRequest(), CABILLAUD_EPINARDS.id, 'epinard' as FoodId)

    expect(variants).toEqual([])
  })

  it('aliment absent de la recette → aucune variante', () => {
    const catalog = makeCatalog(RECIPES, FOODS)
    const { variants } = suggestAlternatives(catalog, makeRequest(), CABILLAUD_EPINARDS.id, 'boeuf' as FoodId)

    expect(variants).toEqual([])
  })

  it('la table `substitution` est VIDE aujourd’hui — le chemin existe et ne rend rien', () => {
    // Décision 27 : la table se conçoit AVEC les recettes. Ce test documente l'état, il ne le
    // déplore pas — et il échouera utilement le jour où la table sera peuplée sans revue.
    const catalog = makeCatalog(RECIPES, FOODS)
    expect(catalog.substitutions.size).toBe(0)

    const { variants } = suggestAlternatives(catalog, makeRequest(), CABILLAUD_EPINARDS.id, 'epinard' as FoodId)
    expect(variants.filter((v) => v.kind === 'substitution')).toEqual([])
  })
})

describe('selection/alternatives — les deux listes sont indépendantes', () => {
  it('un optionnel rejeté donne une VARIANTE sans supprimer les ALTERNATIVES', () => {
    // Invariant de forme : `variants` garde le plat, `alternatives` en change. Les deux répondent
    // à la même demande sous deux angles, jamais l'une à la place de l'autre.
    const avecCreme = makeRecipe('cabillaud_creme', {
      ingredients: [
        makeIngredient('cabillaud', { quantiteG: 200 }),
        makeIngredient('creme', { quantiteG: 50, optionnel: true }),
      ],
    })
    const catalog = makeCatalog([avecCreme, BAR_GRILLE, DORADE_FOUR], FOODS)

    const resultat = suggestAlternatives(catalog, makeRequest(), avecCreme.id, 'creme' as FoodId)

    expect(resultat.variants.length).toBeGreaterThan(0)
    expect(resultat.alternatives.length).toBeGreaterThan(0)
  })
})
