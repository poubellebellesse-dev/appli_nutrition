// engine/nutrition/test-fixtures.ts — fixtures minimales pour les tests unitaires de
// engine/nutrition/ (docs/ENGINE.md §5.1, §6.5 précision 8).
//
// Distinctes de engine/selection/test-fixtures.ts : les couches de sélection n'ont jamais besoin
// de nutriments réels sur les aliments (leur `makeFood` laisse `nutrimentsPour100g` vide et
// `Catalog.nutrients` à `[]`), alors que ce module en a l'usage central — l'ordre de
// `catalog.nutrients` fixe l'index du `NutrientVector` retourné (§9.1 ENGINE). Co-localisé par
// convention du repo (voir selection/test-fixtures.ts) ; n'exporte que des fonctions, ce n'est
// pas un fichier `.test.ts`.
//
// Dépendances autorisées : domain/ uniquement — §2/§3 ENGINE.

import type {
  Catalog,
  CatalogIndexes,
  Food,
  FoodId,
  Nutrient,
  NutrientId,
  Recipe,
  RecipeIngredient,
} from "../domain/index.js";
import { g, min } from "../domain/index.js";

/** `sens` par défaut à `'cible'` : neutre pour ces tests d'agrégation, qui ne testent pas `scoreNutri`. */
export function makeNutrient(
  id: string,
  sens: Nutrient["sens"] = "cible",
): Nutrient {
  return {
    id: id as NutrientId,
    code: id,
    nom: id,
    unite: "g",
    vnrAdulte: null,
    categorie: null,
    sens,
  };
}

/**
 * `nutrimentsPour100g` passé en objet clé/valeur pour la lisibilité des tests. `saisonMois`/
 * `touteAnnee` sont hors du périmètre de ce lot (P1b-1, saisonnalité) : valeurs neutres par
 * défaut (`touteAnnee: true`, aucune fenêtre de saison), sans intérêt pour l'agrégation
 * nutritionnelle testée ici.
 */
export function makeFood(
  id: string,
  nutrimentsPour100g: Readonly<Record<string, number>> = {},
  opts: { readonly sousFamille?: string } = {},
): Food {
  const nutrientMap = new Map<NutrientId, number>(
    Object.entries(nutrimentsPour100g).map(([nutrientId, value]) => [
      nutrientId as NutrientId,
      value,
    ]),
  );
  return {
    id: id as FoodId,
    codeCiqual: `TEST-${id}`,
    nom: id,
    groupe: "test",
    sousFamille: opts.sousFamille ?? null,
    nutrimentsPour100g: nutrientMap,
    allergenes: [],
    saisonMois: [],
    touteAnnee: true,
    piquant: null,
    conditionnementG: null,
    origineAnimale: null,
    deriveDe: null,
  };
}

export function makeIngredient(
  foodId: string,
  opts: { readonly optionnel?: boolean; readonly quantiteG?: number } = {},
): RecipeIngredient {
  return {
    foodId: foodId as FoodId,
    quantiteG: g(opts.quantiteG ?? 100),
    uniteAffichage: "g",
    optionnel: opts.optionnel ?? false,
  };
}

export function makeRecipe(
  id: string,
  overrides: {
    readonly ingredients?: readonly RecipeIngredient[];
    readonly portionsBase?: number;
  } = {},
): Recipe {
  return {
    id: id as Recipe["id"],
    nom: id,
    description: "",
    tempsPrepMin: min(10),
    tempsCuissonMin: min(10),
    difficulte: 1,
    portionsBase: overrides.portionsBase ?? 2,
    imagePath: null,
    typesRepas: ["diner"],
    saisonMois: [],
    envergure: "quotidien",
    conservationJours: 1,
    axes: { sucreSale: 0, legerConsistant: 0, chaudFroid: 0, texture: "test" },
    ingredients: overrides.ingredients ?? [],
    etapes: [],
    facettes: [],
    service: null,
    piquant: null,
  };
}

function makeEmptyIndexes(): CatalogIndexes {
  return {
    recipesByAllergen: new Map(),
    recipesByDiet: new Map(),
    recipesBySlot: new Map(),
    recipeNutrients: new Map(),
    recipeNutrientCoverage: new Map(),
    recipeMainIngredient: new Map(),
    recipeSignature: new Map(),
    recipeFamilySignature: new Map(),
    declaredFamilies: new Set(),
    recipeCharacteristic: new Map(),
  };
}

export function makeCatalog(
  recipes: readonly Recipe[],
  foods: readonly Food[] = [],
  nutrients: readonly Nutrient[] = [],
): Catalog {
  return {
    version: "test",
    foods: new Map(foods.map((food) => [food.id, food])),
    recipes: new Map(recipes.map((recipe) => [recipe.id, recipe])),
    nutrients,
    allergens: new Map(),
    lexicon: new Map(),
    topics: new Map(),
    substitutions: new Map(),
    indexes: makeEmptyIndexes(),
  };
}
