// engine/domain/catalog.ts
//
// Formes PROPRES en RAM du catalogue — pas les lignes SQL brutes. Le mapping DB → domaine est
// fait par data/ (hors engine), à partir du schéma réel produit par catalog/build.mjs
// (constante SCHEMA_SQL + référentiels NUTRIENTS/ALLERGENS). Voir docs/ENGINE.md §9.1 et
// docs/ARCHITECTURE.md §4.2.
//
// Écarts assumés par rapport aux documents, documentés au fil du fichier :
//  - `food` n'a ni `sous_groupe` ni `saison_mois` dans le schéma réel (contrairement à l'esquisse
//    de §4.2 ARCHITECTURE) : ces colonnes n'existent pas dans build.mjs. Food suit le réel.
//  - Plusieurs champs texte (axe_texture, recipe_facet.valeur, régime) n'ont AUCUNE contrainte
//    CHECK en base : vocabulaire ouvert, typé `string` plutôt qu'en union littérale fermée.
//  - `topics`/`substitutions` sur Catalog n'ont pas encore de table dans catalog.db (v1.5/v2,
//    voir ARCHITECTURE §11 "Ouvertes" et §10.1 ENGINE) ; inclus quand même car §9.1 ENGINE les
//    spécifie explicitement sur Catalog — data/ retournera des Map vides tant que ces tables
//    n'existent pas au build.

import type { FoodId, RecipeId, NutrientId, AllergenId, LexiconEntryId, TopicId } from './ids.js'
import type { Grams, Minutes } from './units.js'

// --- Nutriments & allergènes (référentiels build.mjs NUTRIENTS / ALLERGENS) ------------------

/** Vecteur nutritionnel indexé par position dans `Catalog.nutrients` (§5.1, §9.1 ENGINE). */
export type NutrientVector = Float64Array

/** Valeurs observées dans build.mjs NUTRIENTS ; colonne `categorie` TEXT nullable en base. */
export type NutrientCategory = 'macronutriment' | 'mineral' | 'vitamine'

export interface Nutrient {
  readonly id: NutrientId
  readonly code: string
  readonly nom: string
  readonly unite: string
  readonly vnrAdulte: number | null
  readonly categorie: NutrientCategory | null
}

export type AllergenCertitude = 'contient' | 'traces'

export interface Allergen {
  readonly id: AllergenId
  readonly code: string
  readonly nom: string
}

export interface FoodAllergen {
  readonly allergenId: AllergenId
  readonly certitude: AllergenCertitude
}

// --- Aliments (table `food` + `food_nutrient` + `food_allergen`) -----------------------------

export interface Food {
  readonly id: FoodId
  readonly codeCiqual: string
  readonly nom: string
  readonly groupe: string
  /** `food_nutrient`, une ligne par nutriment — regroupé en Map propre, pas en lignes SQL. */
  readonly nutrimentsPour100g: ReadonlyMap<NutrientId, number>
  readonly allergenes: readonly FoodAllergen[]
}

// --- Recettes (table `recipe` + tables liées) -------------------------------------------------

export type RecipeEnvergure = 'quotidien' | 'convivial' | 'fete'

/**
 * `axe_texture` est un TEXT libre en base (aucun CHECK) : vocabulaire ouvert, pas une enum
 * fermée. Alias plutôt qu'union littérale pour ne pas mentir sur la contrainte réelle.
 */
export type Texture = string

export interface SensoryAxes {
  readonly sucreSale: number // -1 (salé) … +1 (sucré)
  readonly legerConsistant: number // -1 (léger) … +1 (consistant)
  readonly chaudFroid: number // -1 (froid) … +1 (chaud)
  readonly texture: Texture
}

export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

/**
 * `recipe.types_repas` est un TEXT JSON libre en base (aucun CHECK). Les 4 valeurs ci-dessous
 * sont celles observées dans les 10 recettes de test du catalogue. Fermé en union littérale
 * malgré tout car MealSlot sert de clé de Map (`CatalogIndexes.recipesBySlot`) — à élargir si
 * le catalogue réel introduit d'autres créneaux.
 */
export type MealSlot = 'petit_dejeuner' | 'dejeuner' | 'gouter' | 'diner'

export interface RecipeIngredient {
  readonly foodId: FoodId
  readonly quantiteG: Grams
  readonly uniteAffichage: string
  readonly optionnel: boolean
}

export type TimerType = 'cuisson' | 'repos'

export interface RecipeStep {
  readonly ordre: number
  readonly texte: string
  /** Codes vers `LexiconEntry.code` (§8.5 ARCHITECTURE). */
  readonly lexiconIds: readonly string[]
  readonly timerS: number | null
  readonly timerType: TimerType | null
}

export type FacetteKind = 'cuisine' | 'regime' | 'occasion' | 'style'

/** `recipe_facet.valeur` est TEXT libre en base — vocabulaire ouvert (ex. 'vegetarien', 'francaise'). */
export interface RecipeFacet {
  readonly facette: FacetteKind
  readonly valeur: string
}

/** `recipe_facet.valeur` quand `facette === 'regime'`. Ouvert, pas de CHECK en base. */
export type DietCode = string

export interface Recipe {
  readonly id: RecipeId
  readonly nom: string
  readonly description: string
  readonly tempsPrepMin: Minutes
  readonly tempsCuissonMin: Minutes
  readonly difficulte: 1 | 2 | 3
  readonly portionsBase: number
  readonly imagePath: string | null
  readonly typesRepas: readonly MealSlot[]
  readonly saisonMois: readonly Month[]
  readonly envergure: RecipeEnvergure
  /** Pour la gestion des restes (§7.3 ENGINE). */
  readonly conservationJours: number
  readonly axes: SensoryAxes
  readonly ingredients: readonly RecipeIngredient[]
  readonly etapes: readonly RecipeStep[]
  readonly facettes: readonly RecipeFacet[]
}

// --- Lexique de cuisine (table `lexicon_entry`) -----------------------------------------------

export interface LexiconEntry {
  readonly id: LexiconEntryId
  readonly code: string
  readonly terme: string
  readonly definition: string
}

// --- Types en attente de table catalogue (v1.5 / v2, voir commentaire d'en-tête) --------------

export interface HealthTopic {
  readonly id: TopicId
  readonly code: string
  readonly titre: string
  readonly resumeVulgarise: string
  readonly autoriteReference: string
  readonly dateRevue: string
  /** Renvoie vers un régime déclaré quand une éviction stricte s'impose (§5.2 ARCHITECTURE). */
  readonly dieteSuggeree: DietCode | null
}

export interface Substitution {
  readonly foodId: FoodId
  readonly altFoodId: FoodId
  readonly ratio: number
  readonly contexte: string
}

// --- Le catalogue en mémoire (§9.1 ENGINE) ------------------------------------------------------

export interface CatalogIndexes {
  readonly recipesByAllergen: ReadonlyMap<AllergenId, ReadonlySet<RecipeId>>
  readonly recipesByDiet: ReadonlyMap<DietCode, ReadonlySet<RecipeId>>
  readonly recipesBySlot: ReadonlyMap<MealSlot, ReadonlySet<RecipeId>>
  /** Pré-agrégé au build — `aggregateRecipe` n'est jamais appelée au runtime (§5.1 ENGINE). */
  readonly recipeNutrients: ReadonlyMap<RecipeId, NutrientVector>
  /** Pour la diversification (§6.6 ENGINE). */
  readonly recipeMainIngredient: ReadonlyMap<RecipeId, FoodId>
}

export interface Catalog {
  readonly version: string
  readonly foods: ReadonlyMap<FoodId, Food>
  readonly recipes: ReadonlyMap<RecipeId, Recipe>
  /** Ordre = index dans NutrientVector (§9.1 ENGINE). */
  readonly nutrients: readonly Nutrient[]
  readonly allergens: ReadonlyMap<AllergenId, Allergen>
  readonly lexicon: ReadonlyMap<LexiconEntryId, LexiconEntry>
  readonly topics: ReadonlyMap<TopicId, HealthTopic>
  readonly substitutions: ReadonlyMap<FoodId, readonly Substitution[]>
  readonly indexes: CatalogIndexes
}
