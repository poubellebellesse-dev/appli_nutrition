// engine/domain/catalog.ts
//
// Formes PROPRES en RAM du catalogue — pas les lignes SQL brutes. Le mapping DB → domaine est
// fait par data/ (hors engine), à partir du schéma réel produit par catalog/build.mjs
// (constante SCHEMA_SQL + référentiels NUTRIENTS/ALLERGENS). Voir docs/ENGINE.md §9.1 et
// docs/ARCHITECTURE.md §4.2.
//
// Écarts assumés par rapport aux documents, documentés au fil du fichier :
//  - `food` a `saison_mois` et `toute_annee` dans le schéma réel depuis P1b-1 (§4.2 ARCHITECTURE,
//    §6.5 ENGINE précision 3), et `sous_famille` depuis §6.6 quater. Toujours pas de `sous_groupe`
//    au sens taxonomique du §4.2 : `sous_famille` ne le remplace PAS — elle ne renseigne que les
//    aliments dont le catalogue contient plusieurs entrées du même produit de base, et sert un
//    besoin précis (la récence). Food suit le réel.
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

/**
 * Sens de l'écart nutritionnel — colonne `nutrient.sens`, CHECK en base sur ces trois valeurs
 * exactement (build.mjs SCHEMA_SQL) : union littérale FERMÉE, à la différence de `Texture` ou
 * `DietCode` qui restent des `string` ouverts faute de contrainte CHECK correspondante.
 *
 * Pourquoi ce champ existe : `scoreNutri` (engine/selection/scoring/nutri.ts) calculait un écart
 * SYMÉTRIQUE (`|recette − cible| / cible`) pour tous les nutriments, ce qui punit un dépassement
 * exactement comme un manque. Absurde pour un plancher (le fer, les fibres — plus n'est jamais
 * pire) ou un plafond (le sodium — moins n'est jamais pire) : le moteur finissait par préférer
 * structurellement les plats nutritionnellement moyens. `sens` dit à `scoreNutri` quel côté de
 * l'écart compte réellement :
 *  - `cible`    : viser la valeur pile — trop et pas assez pénalisent tous les deux (macros).
 *  - `plancher` : ne pas être EN DESSOUS — un excès ne pénalise jamais (fibres, fer, calcium,
 *    vitamine C : plus il y en a, mieux c'est en pratique).
 *  - `plafond`  : ne pas être AU-DESSUS — être en dessous ne pénalise jamais (sodium).
 */
export type NutrientSense = 'cible' | 'plancher' | 'plafond'

export interface Nutrient {
  readonly id: NutrientId
  readonly code: string
  readonly nom: string
  readonly unite: string
  readonly vnrAdulte: number | null
  readonly categorie: NutrientCategory | null
  readonly sens: NutrientSense
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
  /**
   * Sous-famille facultative — regroupe les aliments qui sont le MÊME produit de base
   * (`poulet_blanc` et `poulet_cuisse` → `poulet`). `null` quand l'aliment est seul de son espèce,
   * ce qui est le cas de la très grande majorité.
   *
   * ⚠️ N'est PAS une taxonomie : elle n'existe que là où le catalogue contient plusieurs entrées
   * du même produit, et sert un besoin précis — la récence de `variety`/`habit` (§6.6 quater
   * ENGINE). `groupe` ne peut pas jouer ce rôle : « viandes » mélange bœuf, poulet, porc et agneau,
   * ce qui a été mesuré et écarté.
   */
  readonly sousFamille: string | null
  /** `food_nutrient`, une ligne par nutriment — regroupé en Map propre, pas en lignes SQL. */
  readonly nutrimentsPour100g: ReadonlyMap<NutrientId, number>
  readonly allergenes: readonly FoodAllergen[]
  /**
   * Mois de PLEINE SAISON — production locale (P1b-1, §4.2 ARCHITECTURE). Vide = saisonnalité non
   * renseignée, ce qui exclut l'aliment du calcul de la couche `season` (staple au sens de §6.5
   * ENGINE précision 3 : pâtes, riz, huile, sel…). Indépendant de `touteAnnee`.
   */
  readonly saisonMois: readonly Month[]
  /**
   * DISPONIBILITÉ toute l'année (rayon, conservation longue) — dimension INDÉPENDANTE de
   * `saisonMois` : un légume de garde porte légitimement les deux. Module le crédit d'un
   * ingrédient hors saison dans `scoreSeason`, ne l'exclut pas.
   */
  readonly touteAnnee: boolean
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

/**
 * Service dans un repas composé — mode *repas* du §2.7 CONCEPTION_B_VIN_REPAS (entrée+plat+dessert,
 * v1.5). À NE PAS CONFONDRE avec `MealSlot` ci-dessus : `MealSlot` est le CRÉNEAU de la journée
 * (petit-déjeuner, déjeuner…), `CourseKind` est la PLACE d'un plat À L'INTÉRIEUR d'un même créneau
 * quand celui-ci contient plusieurs recettes. Un créneau en mode recette (un plat unique, comportement
 * actuel) n'a pas de `CourseKind` — voir `MealPlanEntry.service` (planning.ts).
 */
export type CourseKind = 'entree' | 'plat' | 'dessert' | 'accompagnement'

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

/**
 * Signature de composition d'une recette : `foodId` → part de la masse (somme = 1), sur les
 * quelques ingrédients non optionnels les plus lourds. Déclarée ICI et pas dans nutrition/ parce
 * que `CatalogIndexes` en dépend et que domain/ (L1) ne peut rien importer de nutrition/ (L2) —
 * §2 ENGINE. Le calcul, lui, vit dans engine/nutrition/signature.ts.
 */
export type RecipeSignature = ReadonlyMap<FoodId, number>

/**
 * La même signature, mais chaque aliment replié sur sa `Food.sousFamille` quand elle existe
 * (§6.6 quater ENGINE). Les clés ne sont donc PAS des `FoodId` : ce sont des ids d'aliment OU des
 * noms de famille, d'où `string`. Type NOMMÉ ET DISTINCT de `RecipeSignature` exprès : comparer
 * une signature brute à une signature repliée n'a aucun sens (les clés ne désignent pas la même
 * chose). ⚠️ TypeScript ne peut PAS l'imposer — les deux Map restent structurellement compatibles,
 * `signatureOverlap` accepte donc les deux. Le nom porte l'intention, pas le compilateur : à
 * l'appel, les deux côtés doivent venir du même index.
 */
export type RecipeFamilySignature = ReadonlyMap<string, number>

export interface CatalogIndexes {
  readonly recipesByAllergen: ReadonlyMap<AllergenId, ReadonlySet<RecipeId>>
  readonly recipesByDiet: ReadonlyMap<DietCode, ReadonlySet<RecipeId>>
  readonly recipesBySlot: ReadonlyMap<MealSlot, ReadonlySet<RecipeId>>
  /** Calculé à l'init du moteur (`createEngine`), pas au build — `aggregateRecipe` est une fonction pure de engine/nutrition/ (§6.5 ENGINE précision 8). */
  readonly recipeNutrients: ReadonlyMap<RecipeId, NutrientVector>
  /**
   * L'ingrédient non optionnel LE PLUS LOURD. ⚠️ Ce n'est PAS l'ingrédient qui définit le plat —
   * mesuré faux sur le catalogue réel (« mousse au chocolat » → œuf, « hachis de bœuf » → pomme de
   * terre). ⚠️ PLUS AUCUNE COUCHE NE LE LIT depuis §6.6 quater : la similarité est passée à
   * `recipeSignature`, `variety`/`habit` à `recipeFamilySignature`. Conservé le temps de vérifier
   * qu'aucun usage n'apparaît côté UI ; à supprimer sinon — c'est de la dette, pas un index actif.
   */
  readonly recipeMainIngredient: ReadonlyMap<RecipeId, FoodId>
  /**
   * Les 3 ingrédients non optionnels les plus lourds avec leur part normalisée — base de la
   * similarité (§6.6 ENGINE). Modèle CHOISI PAR MESURE, voir engine/nutrition/signature.ts.
   */
  readonly recipeSignature: ReadonlyMap<RecipeId, RecipeSignature>
  /**
   * La même signature, mais les aliments d'une même `Food.sousFamille` fusionnés (§6.6 quater).
   * Base de la RÉCENCE de `variety`/`habit` — « ai-je mangé du poulet hier » se moque du morceau,
   * alors que la diversification doit encore distinguer un blanc rôti d'un tajine de cuisses.
   * Clés : id d'aliment OU nom de famille, d'où `string` et non `FoodId`.
   */
  readonly recipeFamilySignature: ReadonlyMap<RecipeId, RecipeFamilySignature>
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
