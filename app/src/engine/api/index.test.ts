// engine/api/index.test.ts — createEngine (docs/ENGINE.md §8).
//
// Cas construits à la main, comme guards/index.test.ts — fixture minimale, pas de dépendance à
// data/ ni au catalogue réel (interdit dans engine/, voir tests/engine-boundaries.test.ts).

import { describe, expect, it, vi } from 'vitest'
import type { Catalog, CatalogIndexes, Food, FoodId, Nutrient, NutrientId, Recipe, RecipeId } from '../domain/index.js'
import { g, min } from '../domain/index.js'
import { LAYER_DESCRIPTORS, nutriLayer } from '../selection/index.js'
import * as nutritionModule from '../nutrition/index.js'
import { createEngine } from './index.js'

function food(id: string, kcalPer100g: number): Food {
  return {
    id: id as FoodId,
    codeCiqual: `TEST-${id}`,
    nom: id,
    groupe: 'test',
    nutrimentsPour100g: new Map([['kcal' as NutrientId, kcalPer100g]]),
    allergenes: [],
    saisonMois: [],
    touteAnnee: true,
  }
}

function recipeWithOneIngredient(id: string, foodId: string): Recipe {
  return {
    id: id as RecipeId,
    nom: id,
    description: '',
    tempsPrepMin: min(10),
    tempsCuissonMin: min(10),
    difficulte: 1,
    portionsBase: 2,
    imagePath: null,
    typesRepas: ['diner'],
    saisonMois: [],
    envergure: 'quotidien',
    conservationJours: 1,
    axes: { sucreSale: 0, legerConsistant: 0, chaudFroid: 0, texture: 'test' },
    ingredients: [{ foodId: foodId as FoodId, quantiteG: g(200), uniteAffichage: 'g', optionnel: false }],
    etapes: [],
    facettes: [],
  }
}

const EMPTY_INDEXES: CatalogIndexes = {
  recipesByAllergen: new Map(),
  recipesByDiet: new Map(),
  recipesBySlot: new Map(),
  recipeNutrients: new Map(),
  recipeMainIngredient: new Map(),
}

function makeCatalog(): Catalog {
  const kcal: Nutrient = { id: 'kcal' as NutrientId, code: 'kcal', nom: 'Énergie', unite: 'kcal', vnrAdulte: null, categorie: null, sens: 'cible' }
  const oeuf = food('oeuf', 100)
  const omelette = recipeWithOneIngredient('omelette', 'oeuf')

  return {
    version: 'catalog-test-1.2.3',
    foods: new Map([[oeuf.id, oeuf]]),
    recipes: new Map([[omelette.id, omelette]]),
    nutrients: [kcal],
    allergens: new Map(),
    lexicon: new Map(),
    topics: new Map(),
    substitutions: new Map(),
    indexes: EMPTY_INDEXES,
  }
}

describe('engine/api — createEngine (§8 ENGINE)', () => {
  it("appelle attachDerivedIndexes(catalog) à l'init — les index dérivés sont peuplés là où le catalogue d'entrée les avait vides", () => {
    // `Engine` n'expose délibérément pas le catalogue enrichi (surface étroite, §8 ENGINE) : rien
    // dans le résultat de `createEngine` ne permet d'observer l'enrichissement autrement. On
    // vérifie donc la COLLABORATION elle-même — la seule preuve possible sans élargir le contrat
    // public — plutôt qu'un effet indirectement observable qui n'existe pas encore (`suggestMeals`
    // etc. restent non implémentés dans ce lot).
    const catalog = makeCatalog()
    expect(catalog.indexes.recipeNutrients.size).toBe(0)
    expect(catalog.indexes.recipeMainIngredient.size).toBe(0)

    const spy = vi.spyOn(nutritionModule, 'attachDerivedIndexes')
    try {
      createEngine(catalog)
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith(catalog)
      // Preuve indépendante que l'appel, s'il a lieu, peuple bien les index (déjà couvert en
      // détail par nutrition/derived-indexes.test.ts) : on rejoue la même fonction PURE ici et on
      // vérifie qu'elle ne rend pas des index vides sur ce catalogue.
      const enriched = spy.mock.results[0]?.value as Catalog
      expect(enriched.indexes.recipeNutrients.size).toBeGreaterThan(0)
      expect(enriched.indexes.recipeMainIngredient.size).toBeGreaterThan(0)
    } finally {
      spy.mockRestore()
    }
  })

  it('expose version (moteur) et catalogVersion (celle du catalogue reçu)', () => {
    const catalog = makeCatalog()
    const engine = createEngine(catalog)

    expect(typeof engine.version).toBe('string')
    expect(engine.version.length).toBeGreaterThan(0)
    expect(engine.catalogVersion).toBe('catalog-test-1.2.3')
  })

  it('layers expose les 16 descripteurs du registre (LAYER_DESCRIPTORS)', () => {
    const engine = createEngine(makeCatalog())
    expect(engine.layers).toBe(LAYER_DESCRIPTORS)
    expect(engine.layers).toHaveLength(16)
  })

  it("layer('nutri') retourne la couche implémentée correspondante", () => {
    const engine = createEngine(makeCatalog())
    expect(engine.layer('nutri')).toBe(nutriLayer)
  })

  it("layer('allergenes') retourne aussi une couche d'exclusion implémentée (pas seulement le score)", () => {
    const engine = createEngine(makeCatalog())
    expect(engine.layer('allergenes').kind).toBe('exclusion')
    expect(engine.layer('allergenes').critical).toBe(true)
  })

  it("layer('pantry') lève une erreur explicite (déclarée au registre, pas encore implémentée)", () => {
    const engine = createEngine(makeCatalog())
    expect(() => engine.layer('pantry')).toThrow(/pantry/)
    expect(() => engine.layer('pantry')).toThrow(/pas encore/)
  })

  it.each(['occasion', 'topic', 'cost'] as const)("layer('%s') lève aussi une erreur explicite", (id) => {
    const engine = createEngine(makeCatalog())
    expect(() => engine.layer(id)).toThrow()
  })

  it("layer(id) sur un id inconnu du registre lève une erreur distincte de « pas encore implémenté »", () => {
    const engine = createEngine(makeCatalog())
    expect(() => engine.layer('inconnu' as never)).toThrow(/inconnu/)
  })

  it('les méthodes d’orchestration non implémentées lèvent explicitement « non implémenté (P1c) »', () => {
    const engine = createEngine(makeCatalog())
    expect(() => engine.suggestMeals({} as never)).toThrow(/non implémenté \(P1c\)/)
    expect(() => engine.planWeek({} as never)).toThrow(/non implémenté \(P1c\)/)
    expect(() => engine.scaleRecipe('omelette' as RecipeId, 4)).toThrow(/non implémenté \(P1c\)/)
  })
})
