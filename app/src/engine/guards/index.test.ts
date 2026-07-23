// engine/guards/index.test.ts — garde-fou allergènes (docs/ENGINE.md §5.2 ; docs/ARCHITECTURE.md
// §5.2) : la « ceinture de sécurité » derrière la couche `allergenes` (engine/selection/allergenes.ts).
//
// Cas construits à la main (tâche P1a) — pas de dépendance à data/ ni au catalogue réel : un
// fixture minimal suffit à prouver que le garde-fou lève sur une violation.

import { describe, expect, it } from 'vitest'
import type { AllergenId, Catalog, CatalogIndexes, Food, FoodId, HardConstraints, Recipe, RecipeId } from '../domain/index.js'
import { EngineSafetyError, g, min } from '../domain/index.js'
import { assertNoDeclaredAllergen } from './index.js'

const EMPTY_INDEXES: CatalogIndexes = {
  recipesByAllergen: new Map(),
  recipesByDiet: new Map(),
  recipesBySlot: new Map(),
  recipeNutrients: new Map(),
  recipeMainIngredient: new Map(),
}

function food(id: string, allergenId: string | null): Food {
  return {
    id: id as FoodId,
    codeCiqual: `TEST-${id}`,
    nom: id,
    groupe: 'test',
    nutrimentsPour100g: new Map(),
    allergenes: allergenId ? [{ allergenId: allergenId as AllergenId, certitude: 'contient' }] : [],
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
    ingredients: [{ foodId: foodId as FoodId, quantiteG: g(100), uniteAffichage: 'g', optionnel: false }],
    etapes: [],
    facettes: [],
  }
}

function constraints(allergies: readonly string[]): HardConstraints {
  return { allergies: allergies as readonly AllergenId[], diet: null, excludedFoodIds: [] }
}

describe('guards/assertNoDeclaredAllergen — ceinture de sécurité (§5.2 ARCHITECTURE)', () => {
  it('lève EngineSafetyError sur un cas violant construit à la main (recette conservée par erreur)', () => {
    const oeuf = food('oeuf', 'oeufs')
    const omelette = recipeWithOneIngredient('omelette', 'oeuf')
    const catalog: Catalog = {
      version: 'test',
      foods: new Map([[oeuf.id, oeuf]]),
      recipes: new Map([[omelette.id, omelette]]),
      nutrients: [],
      allergens: new Map(),
      lexicon: new Map(),
      topics: new Map(),
      substitutions: new Map(),
      indexes: EMPTY_INDEXES,
    }

    // Bypass délibéré de la couche `allergenes` : la recette est passée telle quelle au
    // garde-fou comme si elle avait été (à tort) conservée par le pipeline.
    const candidatesMalgréTout = new Set([omelette.id])

    expect(() => assertNoDeclaredAllergen(candidatesMalgréTout, catalog, constraints(['oeufs']))).toThrow(
      EngineSafetyError
    )
  })

  it('ne lève rien quand les candidats conservés ne contiennent aucun allergène déclaré', () => {
    const carotte = food('carotte', null)
    const soupe = recipeWithOneIngredient('soupe', 'carotte')
    const catalog: Catalog = {
      version: 'test',
      foods: new Map([[carotte.id, carotte]]),
      recipes: new Map([[soupe.id, soupe]]),
      nutrients: [],
      allergens: new Map(),
      lexicon: new Map(),
      topics: new Map(),
      substitutions: new Map(),
      indexes: EMPTY_INDEXES,
    }

    expect(() => assertNoDeclaredAllergen(new Set([soupe.id]), catalog, constraints(['oeufs']))).not.toThrow()
  })

  it('ne lève rien quand la recette à risque a bien été exclue en amont (pas dans candidates)', () => {
    const oeuf = food('oeuf', 'oeufs')
    const omelette = recipeWithOneIngredient('omelette', 'oeuf')
    const catalog: Catalog = {
      version: 'test',
      foods: new Map([[oeuf.id, oeuf]]),
      recipes: new Map([[omelette.id, omelette]]),
      nutrients: [],
      allergens: new Map(),
      lexicon: new Map(),
      topics: new Map(),
      substitutions: new Map(),
      indexes: EMPTY_INDEXES,
    }

    expect(() => assertNoDeclaredAllergen(new Set(), catalog, constraints(['oeufs']))).not.toThrow()
  })

  it('no-op immédiat quand aucune allergie n’est déclarée, même avec une recette à risque', () => {
    const oeuf = food('oeuf', 'oeufs')
    const omelette = recipeWithOneIngredient('omelette', 'oeuf')
    const catalog: Catalog = {
      version: 'test',
      foods: new Map([[oeuf.id, oeuf]]),
      recipes: new Map([[omelette.id, omelette]]),
      nutrients: [],
      allergens: new Map(),
      lexicon: new Map(),
      topics: new Map(),
      substitutions: new Map(),
      indexes: EMPTY_INDEXES,
    }

    expect(() => assertNoDeclaredAllergen(new Set([omelette.id]), catalog, constraints([]))).not.toThrow()
  })

  it('ignore un recipeId orphelin (absent du catalogue) sans planter', () => {
    const catalog: Catalog = {
      version: 'test',
      foods: new Map(),
      recipes: new Map(),
      nutrients: [],
      allergens: new Map(),
      lexicon: new Map(),
      topics: new Map(),
      substitutions: new Map(),
      indexes: EMPTY_INDEXES,
    }

    expect(() =>
      assertNoDeclaredAllergen(new Set(['inconnu' as RecipeId]), catalog, constraints(['oeufs']))
    ).not.toThrow()
  })
})
