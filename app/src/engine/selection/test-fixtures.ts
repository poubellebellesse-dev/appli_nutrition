// engine/selection/test-fixtures.ts — fixtures minimales pour les tests unitaires des couches
// d'exclusion (docs/ENGINE.md §6).
//
// Volontairement à côté du code testé pour rester co-localisé (convention du repo, voir
// data/catalog-loader.test.ts) — construit un `Catalog` en mémoire valable pour le type, sans
// dépendre de data/ (interdit dans engine/, y compris ses fichiers de test — voir
// tests/engine-boundaries.test.ts). N'exporte que des fonctions, ce n'est pas un fichier `.test.ts`
// : aucun test n'y tourne directement.
//
// Dépendances autorisées : domain/ et nutrition/ — §2/§3 ENGINE, les mêmes que le code de
// selection/ qu'elles servent. `nutrition/signature.js` est importé pour construire les index de
// signature avec les VRAIES fonctions du moteur plutôt qu'une copie approximative (voir
// `buildIndexes`).

import type {
  AllergenId,
  AnimalSource,
  Catalog,
  CatalogIndexes,
  CourseKind,
  DietCode,
  Equipment,
  EquipmentId,
  EquipmentLevel,
  Food,
  FoodAllergen,
  FoodId,
  Recipe,
  RecipeEnvergure,
  RecipeEquipment,
  RecipeFacet,
  RecipeId,
  RecipeIngredient,
  SuggestionRequest,
  VarietyMode,
} from '../domain/index.js'
import { g, min } from '../domain/index.js'
import type { ExclusionLayerResult, LayerResult, ScoringLayerResult } from './index.js'
import { computeDeclaredFamilies, computeRecipeFamilySignature, computeRecipeSignature } from '../nutrition/signature.js'
import { computeRecipeCharacteristic } from '../nutrition/characteristic-ingredient.js'

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

/** Même narrowing qu'`asExclusionResult`, côté couche de score (`kind: 'scoring'`). */
export function asScoringResult(result: LayerResult): ScoringLayerResult {
  if (!('scores' in result)) throw new Error('asScoringResult: résultat de couche d’exclusion, pas de score')
  return result
}

export function makeFood(
  id: string,
  allergenes: readonly FoodAllergen[] = [],
  opts: {
    readonly sousFamille?: string
    readonly synonymes?: readonly string[]
    readonly groupe?: string
    readonly origineAnimale?: AnimalSource | null
    readonly deriveDe?: string | null
  } = {}
): Food {
  return {
    id: id as FoodId,
    codeCiqual: `TEST-${id}`,
    nom: id,
    synonymes: opts.synonymes ?? [],
    groupe: opts.groupe ?? 'test',
    sousFamille: opts.sousFamille ?? null,
    sousGroupe: null,
    nutrimentsPour100g: new Map(),
    allergenes,
    saisonMois: [],
    touteAnnee: false,
    piquant: null,
    poidsPieceG: null,
    fondDePlacard: false,
    quantiteFigee: false,
    conditionnementG: null,
    origineAnimale: opts.origineAnimale ?? null,
    deriveDe: (opts.deriveDe ?? null) as FoodId | null,
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
    readonly axes?: Recipe['axes']
    readonly service?: CourseKind | null
    readonly envergure?: RecipeEnvergure
    /** Decision 35 — `null` = non renseigne, JAMAIS « doux ». */
    readonly piquant?: Recipe['piquant']
    readonly equipements?: readonly RecipeEquipment[]
    /**
     * Defaut `'maison'` = recette du CATALOGUE, etiquetee a la main. `'utilisateur'`/`'partagee'`
     * designent une recette composee dans l'appli, dont la facette `regime` est RECALCULEE a chaque
     * lecture (`data/user-recipe.ts`) — distinction lue par la seconde chance de `regime.ts`.
     */
    readonly origine?: Recipe['origine']
  } = {}
): Recipe {
  return {
    id: id as RecipeId,
    nom: id,
    origine: overrides.origine ?? 'maison',
    description: '',
    tempsPrepMin: min(overrides.tempsPrepMin ?? 10),
    tempsCuissonMin: min(overrides.tempsCuissonMin ?? 10),
    difficulte: 1,
    portionsBase: 2,
    imagePath: null,
    typesRepas: overrides.typesRepas ?? ['diner'],
    saisonMois: [],
    envergure: overrides.envergure ?? 'quotidien',
    conservationJours: 1,
    axes: overrides.axes ?? { sucreSale: 0, legerConsistant: 0, chaudFroid: 0, texture: 'test' },
    ingredients: overrides.ingredients ?? [],
    etapes: [],
    facettes: overrides.facettes ?? [],
    service: overrides.service ?? null,
    piquant: overrides.piquant ?? null,
    sources: [],
    testeLe: null,
    estSauce: false,
    porteDejaUneSauce: null,
    sauceIds: [],
    equipements: overrides.equipements ?? [],
    // Pas dans les `overrides` : la sélection ne lit jamais les occupations — c'est le mode cuisine
    // qui les exploite. Les ouvrir ici donnerait un levier à des tests qui n'en ont pas l'usage.
    occupations: [],
  }
}

/** Un couple recette × équipement monté à la main — le niveau est ici, jamais sur `makeEquipment`. */
export function requiert(code: string, niveau: EquipmentLevel): RecipeEquipment {
  return { equipmentId: code as EquipmentId, niveau }
}

export function makeEquipment(code: string): Equipment {
  return { id: code as EquipmentId, code, terme: code, definition: `définition de ${code}`, partageable: 'toujours' }
}

/**
 * Dérive `CatalogIndexes.recipesBySlot`/`recipesByDiet`/`recipesByAllergen` à partir des recettes
 * et aliments passés, à l'identique de la logique de data/catalog-loader.ts `buildIndexes` (les
 * couches ne connaissant que `Catalog`, un fixture qui n'indexe pas correctement les créneaux
 * ferait passer `runExclusionPass` à côté de son point de départ réel, §6.4 ENGINE).
 */
function buildIndexes(
  recipes: ReadonlyMap<RecipeId, Recipe>,
  foods: ReadonlyMap<FoodId, Food>,
  catalogForSignatures: Catalog,
): CatalogIndexes {
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

  return {
    recipesByAllergen,
    recipesByDiet,
    recipesBySlot,
    recipeNutrients: new Map(),
    recipeNutrientCoverage: new Map(),
    recipeMainIngredient: new Map(),
    // Calculés par les VRAIES fonctions du moteur, pas re-simulés ici : les couches `variety` et
    // `habit` lisent `recipeFamilySignature` (§6.6 quater), et un index vide les rendrait aveugles
    // à la composition — les tests passeraient sans jamais exercer le rapprochement.
    recipeSignature: computeRecipeSignature(catalogForSignatures),
    recipeFamilySignature: computeRecipeFamilySignature(catalogForSignatures),
    declaredFamilies: computeDeclaredFamilies(catalogForSignatures),
    recipeCharacteristic: computeRecipeCharacteristic(catalogForSignatures),
  }
}

export function makeCatalog(
  recipes: readonly Recipe[],
  foods: readonly Food[] = [],
  equipment: readonly Equipment[] = [],
): Catalog {
  const recipeMap = new Map(recipes.map((recipe) => [recipe.id, recipe]))
  const foodMap = new Map(foods.map((food) => [food.id, food]))

  // `computeRecipeSignature` prend un `Catalog` : on construit d'abord une coquille aux index vides,
  // uniquement pour la lui passer. Aucune récursion — ces fonctions ne lisent que `recipes`/`foods`.
  const base: Catalog = {
    version: 'test',
    foods: foodMap,
    recipes: recipeMap,
    nutrients: [],
    allergens: new Map(),
    lexicon: new Map(),
    equipment: new Map(equipment.map((item) => [item.id, item])),
    tips: [],
    evidence: new Map(),
    topics: new Map(),
    substitutions: new Map(),
    indexes: EMPTY_INDEXES,
  }

  return { ...base, indexes: buildIndexes(recipeMap, foodMap, base) }
}

const EMPTY_INDEXES: CatalogIndexes = {
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
}

/** `SuggestionRequest` minimal — seuls les champs lus par les couches d'exclusion/de score en test varient. */
export function makeRequest(
  overrides: {
    readonly allergies?: readonly string[]
    readonly diet?: DietCode | null
    readonly excludedFoodIds?: readonly string[]
    /** Absent → `null` (jamais déclaré). `[]` = déclaré vide, ce n'est PAS la même chose. */
    readonly ownedEquipmentIds?: readonly string[] | null
    /** Exceptions de régime (lot D1). Absent → `[]` : aucune, donc aucune seconde chance. */
    readonly admittedFoodIds?: readonly string[]
    readonly requiredFoodIds?: readonly string[]
    readonly pantryFoodIds?: readonly string[]
    readonly creneau?: SuggestionRequest['context']['creneau']
    readonly tempsDisponibleMin?: number | null
    readonly preferences?: ReadonlyMap<FoodId, number>
    readonly favoriteRecipeIds?: readonly string[]
    readonly onlyFavorites?: boolean
    readonly varietyMode?: VarietyMode
    readonly date?: string
    readonly envie?: SuggestionRequest['context']['envie']
    readonly history?: SuggestionRequest['history']
  } = {}
): SuggestionRequest {
  return {
    profile: {
      // Valeurs plausibles depuis le vocabulaire fermé (engine/domain/profile.ts, P1b-2) —
      // sans effet sur les couches d'exclusion/de score testées ici hormis `nutri`, qui reste en
      // mode VNR à plat par défaut (`tailleCm`/`poidsKg` à `null`).
      trancheAge: '30_49',
      sexe: 'NP',
      tailleCm: null,
      poidsKg: null,
      niveauActivite: 'sedentaire',
      facteurPortion: 1,
    },
    constraints: {
      allergies: (overrides.allergies ?? []) as readonly AllergenId[],
      diet: overrides.diet ?? null,
      excludedFoodIds: (overrides.excludedFoodIds ?? []) as readonly FoodId[],
      // `null` par défaut = jamais déclaré → couche `equipement` inerte. Un `[]` par défaut aurait
      // rendu toutes les fixtures muettes sur le sujet tout en excluant les recettes à `requis`.
      ownedEquipmentIds:
        overrides.ownedEquipmentIds === undefined
          ? null
          : (overrides.ownedEquipmentIds as readonly EquipmentId[] | null),
      // Vide par défaut = aucune exception de régime → la seconde chance de `dietLayer` n'existe
      // pas (P1, lot D1). C'est ce défaut-là qui rend toutes les fixtures existantes inchangées.
      admittedFoodIds: (overrides.admittedFoodIds ?? []) as readonly FoodId[],
    },
    context: {
      creneau: overrides.creneau ?? 'diner',
      date: overrides.date ?? '2026-07-23',
      tempsDisponibleMin: overrides.tempsDisponibleMin == null ? null : min(overrides.tempsDisponibleMin),
      envie: overrides.envie ?? null,
      pantryFoodIds: (overrides.pantryFoodIds ?? []) as readonly FoodId[],
      requiredFoodIds: (overrides.requiredFoodIds ?? []) as readonly FoodId[],
    },
    history: overrides.history ?? { windowDays: 21, entries: [] },
    preferences: overrides.preferences ?? new Map(),
    favoriteRecipeIds: new Set((overrides.favoriteRecipeIds ?? []) as readonly RecipeId[]),
    // `exactOptionalPropertyTypes` (tsconfig) distingue « clé absente » d'« explicitement
    // `undefined` » : n'inclure ces deux clés QUE quand l'appelant fournit vraiment une valeur.
    ...(overrides.onlyFavorites === undefined ? {} : { onlyFavorites: overrides.onlyFavorites }),
    ...(overrides.varietyMode === undefined ? {} : { varietyMode: overrides.varietyMode }),
    activeTopics: [],
  tolerancePiquant: null,
    seed: 1,
  }
}
