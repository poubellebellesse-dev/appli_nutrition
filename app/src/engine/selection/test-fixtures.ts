// engine/selection/test-fixtures.ts — fixtures minimales pour les tests unitaires des couches
// d'exclusion (docs/ENGINE.md §6).
//
// Volontairement à côté du code testé pour rester co-localisé (convention du repo, voir
// data/catalog-loader.test.ts) — construit un `Catalog` en mémoire valable pour le type, sans
// dépendre de data/ (interdit dans engine/, y compris ses fichiers de test — voir
// tests/engine-boundaries.test.ts). N'exporte que des fonctions, ce n'est pas un fichier `.test.ts`
// : aucun test n'y tourne directement.
//
// Dépendances autorisées : domain/ uniquement — §2/§3 ENGINE.

import type {
  AllergenId,
  Catalog,
  CatalogIndexes,
  DietCode,
  Food,
  FoodAllergen,
  FoodId,
  Recipe,
  RecipeFacet,
  RecipeId,
  RecipeIngredient,
  SuggestionRequest,
} from '../domain/index.js'
import { g, min } from '../domain/index.js'
import type { ExclusionLayerResult, LayerResult } from './index.js'

/**
 * `SelectionLayer<Config>.apply` retourne `LayerResult` (union) même pour une couche typée
 * `SelectionLayer<XConfig>` — le contrat (§6.2 ENGINE) ne paramètre pas le TYPE DE RETOUR par
 * `kind`, volontairement, pour rester commun aux deux natures. Narrowing explicite pour les tests
 * unitaires d'une couche d'exclusion connue comme telle.
 */
export function asExclusionResult(result: LayerResult): ExclusionLayerResult {
  if (!('rejected' in result)) throw new Error('asExclusionResult: résultat de couche de score, pas exclusion')
  return result
}

export function makeFood(id: string, allergenes: readonly FoodAllergen[] = []): Food {
  return {
    id: id as FoodId,
    codeCiqual: `TEST-${id}`,
    nom: id,
    groupe: 'test',
    nutrimentsPour100g: new Map(),
    allergenes,
  }
}

export function makeIngredient(
  foodId: string,
  opts: { readonly optionnel?: boolean; readonly quantiteG?: number } = {}
): RecipeIngredient {
  return {
    foodId: foodId as FoodId,
    quantiteG: g(opts.quantiteG ?? 100),
    uniteAffichage: 'g',
    optionnel: opts.optionnel ?? false,
  }
}

export function makeRecipe(
  id: string,
  overrides: {
    readonly ingredients?: readonly RecipeIngredient[]
    readonly facettes?: readonly RecipeFacet[]
    readonly tempsPrepMin?: number
    readonly tempsCuissonMin?: number
    readonly typesRepas?: Recipe['typesRepas']
  } = {}
): Recipe {
  return {
    id: id as RecipeId,
    nom: id,
    description: '',
    tempsPrepMin: min(overrides.tempsPrepMin ?? 10),
    tempsCuissonMin: min(overrides.tempsCuissonMin ?? 10),
    difficulte: 1,
    portionsBase: 2,
    imagePath: null,
    typesRepas: overrides.typesRepas ?? ['diner'],
    saisonMois: [],
    envergure: 'quotidien',
    conservationJours: 1,
    axes: { sucreSale: 0, legerConsistant: 0, chaudFroid: 0, texture: 'test' },
    ingredients: overrides.ingredients ?? [],
    etapes: [],
    facettes: overrides.facettes ?? [],
  }
}

/**
 * Dérive `CatalogIndexes.recipesBySlot`/`recipesByDiet`/`recipesByAllergen` à partir des recettes
 * et aliments passés, à l'identique de la logique de data/catalog-loader.ts `buildIndexes` (les
 * couches ne connaissant que `Catalog`, un fixture qui n'indexe pas correctement les créneaux
 * ferait passer `runExclusionPass` à côté de son point de départ réel, §6.4 ENGINE).
 */
function buildIndexes(recipes: ReadonlyMap<RecipeId, Recipe>, foods: ReadonlyMap<FoodId, Food>): CatalogIndexes {
  const recipesBySlot = new Map<Recipe['typesRepas'][number], Set<RecipeId>>()
  const recipesByDiet = new Map<DietCode, Set<RecipeId>>()
  const recipesByAllergen = new Map<AllergenId, Set<RecipeId>>()

  const addTo = <K>(index: Map<K, Set<RecipeId>>, key: K, recipeId: RecipeId): void => {
    const bucket = index.get(key)
    if (bucket) bucket.add(recipeId)
    else index.set(key, new Set([recipeId]))
  }

  for (const recipe of recipes.values()) {
    for (const slot of recipe.typesRepas) addTo(recipesBySlot, slot, recipe.id)
    for (const facette of recipe.facettes) {
      if (facette.facette === 'regime') addTo(recipesByDiet, facette.valeur, recipe.id)
    }
    for (const ingredient of recipe.ingredients) {
      const food = foods.get(ingredient.foodId)
      if (!food) continue
      for (const allergene of food.allergenes) addTo(recipesByAllergen, allergene.allergenId, recipe.id)
    }
  }

  return { recipesByAllergen, recipesByDiet, recipesBySlot, recipeNutrients: new Map(), recipeMainIngredient: new Map() }
}

export function makeCatalog(recipes: readonly Recipe[], foods: readonly Food[] = []): Catalog {
  const recipeMap = new Map(recipes.map((recipe) => [recipe.id, recipe]))
  const foodMap = new Map(foods.map((food) => [food.id, food]))

  return {
    version: 'test',
    foods: foodMap,
    recipes: recipeMap,
    nutrients: [],
    allergens: new Map(),
    lexicon: new Map(),
    topics: new Map(),
    substitutions: new Map(),
    indexes: buildIndexes(recipeMap, foodMap),
  }
}

/** `SuggestionRequest` minimal — seuls les champs lus par les couches d'exclusion varient en test. */
export function makeRequest(
  overrides: {
    readonly allergies?: readonly string[]
    readonly diet?: DietCode | null
    readonly creneau?: SuggestionRequest['context']['creneau']
    readonly tempsDisponibleMin?: number | null
  } = {}
): SuggestionRequest {
  return {
    profile: {
      trancheAge: 'adulte',
      sexe: 'NP',
      tailleCm: null,
      poidsKg: null,
      niveauActivite: 'modere',
      facteurPortion: 1,
    },
    constraints: {
      allergies: (overrides.allergies ?? []) as readonly AllergenId[],
      diet: overrides.diet ?? null,
      excludedFoodIds: [],
    },
    context: {
      creneau: overrides.creneau ?? 'diner',
      date: '2026-07-23',
      tempsDisponibleMin: overrides.tempsDisponibleMin == null ? null : min(overrides.tempsDisponibleMin),
      envie: null,
      pantryFoodIds: [],
    },
    history: { windowDays: 21, entries: [] },
    activeTopics: [],
    seed: 1,
  }
}
