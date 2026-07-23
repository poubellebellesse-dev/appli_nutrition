// data/catalog-loader.ts
//
// Pont data/ → engine/domain (docs/ARCHITECTURE.md §3, §9 ; docs/ENGINE.md §3, §9.2). Seule
// couche autorisée à importer `node:sqlite` : ouvre `catalog.db` et mappe chaque ligne SQL vers
// les types domaine de engine/domain/catalog.ts. Aucune logique de sélection (filtrage, score,
// agrégation nutritionnelle métier) — uniquement du mapping et du regroupement de lignes. Le
// schéma lu est celui produit par catalog/build.mjs (constante SCHEMA_SQL).
//
// Écarts assumés, à corriger quand le pipeline amont évoluera :
//  - `Catalog.version` : aucune table de version dans catalog.db aujourd'hui → valeur figée
//    ci-dessous. À raccorder à une vraie colonne quand build.mjs en écrira une.
//  - `CatalogIndexes.recipeNutrients` / `recipeMainIngredient` : Map vides. Leur calcul
//    (`aggregateRecipe`, §5.1 ENGINE.md) est une fonction ENGINE appelée par le build ; ni
//    build.mjs (chunks 1-2) ni ce loader ne la calculent aujourd'hui, et catalog.db ne stocke
//    pas ces valeurs pré-agrégées. Les calculer ici dupliquerait de la logique moteur dans data/.
//  - `topics` / `substitutions` : Map vides — tables absentes de catalog.db (voir l'en-tête de
//    engine/domain/catalog.ts).
//  - `recipesByAllergen` : un allergène "touche" une recette dès qu'il apparaît sur un de ses
//    ingrédients, y compris optionnel ou en simple trace — c'est un index neutre (pas un filtre
//    d'éviction), la sévérité relève de engine/guards.

import { DatabaseSync } from 'node:sqlite'
import type {
  Allergen,
  AllergenCertitude,
  AllergenId,
  Catalog,
  CatalogIndexes,
  DietCode,
  FacetteKind,
  Food,
  FoodAllergen,
  FoodId,
  LexiconEntry,
  LexiconEntryId,
  MealSlot,
  Month,
  Nutrient,
  NutrientCategory,
  NutrientId,
  Recipe,
  RecipeEnvergure,
  RecipeFacet,
  RecipeId,
  RecipeIngredient,
  RecipeStep,
  TimerType,
} from '../engine/domain/index.js'
import { g, min } from '../engine/domain/index.js'

/** Pas de table de version dans catalog.db aujourd'hui (voir en-tête du fichier). */
const CATALOG_VERSION = '1.0.0'

// --- Lignes SQL brutes (schéma = catalog/build.mjs SCHEMA_SQL) -------------------------------

interface NutrientRow {
  readonly id: string
  readonly code: string
  readonly nom: string
  readonly unite: string
  readonly vnr_adulte: number | null
  readonly categorie: string | null
}

interface AllergenRow {
  readonly id: string
  readonly code: string
  readonly nom: string
}

interface FoodRow {
  readonly id: string
  readonly code_ciqual: string
  readonly nom: string
  readonly groupe: string
}

interface FoodNutrientRow {
  readonly food_id: string
  readonly nutrient_id: string
  readonly valeur_pour_100g: number
}

interface FoodAllergenRow {
  readonly food_id: string
  readonly allergen_id: string
  readonly certitude: string
}

interface RecipeRow {
  readonly id: string
  readonly nom: string
  readonly description: string
  readonly temps_prep_min: number
  readonly temps_cuisson_min: number
  readonly difficulte: number
  readonly portions_base: number
  readonly image_path: string | null
  readonly types_repas: string
  readonly saison_mois: string
  readonly envergure: string
  readonly conservation_jours: number
  readonly axe_sucre_sale: number
  readonly axe_leger_consistant: number
  readonly axe_chaud_froid: number
  readonly axe_texture: string
}

interface RecipeIngredientRow {
  readonly recipe_id: string
  readonly food_id: string
  readonly quantite_g: number
  readonly unite_affichage: string
  readonly optionnel: number
}

interface RecipeStepRow {
  readonly recipe_id: string
  readonly ordre: number
  readonly texte: string
  readonly lexicon_ids: string
  readonly timer_s: number | null
  readonly timer_type: string | null
}

interface RecipeFacetRow {
  readonly recipe_id: string
  readonly facette: string
  readonly valeur: string
}

interface LexiconRow {
  readonly id: string
  readonly code: string
  readonly terme: string
  readonly definition: string
}

// --- Utilitaires de mapping -------------------------------------------------------------------

function queryAll<T>(db: DatabaseSync, sql: string): readonly T[] {
  return db.prepare(sql).all() as unknown as T[]
}

/** Regroupe des lignes par clé étrangère — pas de logique métier, un simple index en mémoire. */
function groupByKey<T>(rows: readonly T[], keyOf: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const key = keyOf(row)
    const bucket = map.get(key)
    if (bucket) bucket.push(row)
    else map.set(key, [row])
  }
  return map
}

function parseJsonArray<T>(json: string): readonly T[] {
  const parsed: unknown = JSON.parse(json)
  return Array.isArray(parsed) ? (parsed as T[]) : []
}

// --- Chargement par table ----------------------------------------------------------------------

function loadNutrients(db: DatabaseSync): Nutrient[] {
  const rows = queryAll<NutrientRow>(db, 'SELECT * FROM nutrient')
  return rows.map((row) => ({
    id: row.id as NutrientId,
    code: row.code,
    nom: row.nom,
    unite: row.unite,
    vnrAdulte: row.vnr_adulte,
    categorie: row.categorie as NutrientCategory | null,
  }))
}

function loadAllergens(db: DatabaseSync): Map<AllergenId, Allergen> {
  const rows = queryAll<AllergenRow>(db, 'SELECT * FROM allergen')
  const map = new Map<AllergenId, Allergen>()
  for (const row of rows) {
    const id = row.id as AllergenId
    map.set(id, { id, code: row.code, nom: row.nom })
  }
  return map
}

function loadFoods(db: DatabaseSync): Map<FoodId, Food> {
  const foodRows = queryAll<FoodRow>(db, 'SELECT * FROM food')
  const nutrientsByFood = groupByKey(queryAll<FoodNutrientRow>(db, 'SELECT * FROM food_nutrient'), (r) => r.food_id)
  const allergensByFood = groupByKey(queryAll<FoodAllergenRow>(db, 'SELECT * FROM food_allergen'), (r) => r.food_id)

  const map = new Map<FoodId, Food>()
  for (const row of foodRows) {
    const id = row.id as FoodId

    const nutrimentsPour100g = new Map<NutrientId, number>()
    for (const n of nutrientsByFood.get(row.id) ?? []) {
      nutrimentsPour100g.set(n.nutrient_id as NutrientId, n.valeur_pour_100g)
    }

    const allergenes: FoodAllergen[] = (allergensByFood.get(row.id) ?? []).map((a) => ({
      allergenId: a.allergen_id as AllergenId,
      certitude: a.certitude as AllergenCertitude,
    }))

    map.set(id, {
      id,
      codeCiqual: row.code_ciqual,
      nom: row.nom,
      groupe: row.groupe,
      nutrimentsPour100g,
      allergenes,
    })
  }
  return map
}

function loadLexicon(db: DatabaseSync): Map<LexiconEntryId, LexiconEntry> {
  const rows = queryAll<LexiconRow>(db, 'SELECT * FROM lexicon_entry')
  const map = new Map<LexiconEntryId, LexiconEntry>()
  for (const row of rows) {
    const id = row.id as LexiconEntryId
    map.set(id, { id, code: row.code, terme: row.terme, definition: row.definition })
  }
  return map
}

function loadRecipes(db: DatabaseSync): Map<RecipeId, Recipe> {
  const recipeRows = queryAll<RecipeRow>(db, 'SELECT * FROM recipe')
  const ingredientsByRecipe = groupByKey(queryAll<RecipeIngredientRow>(db, 'SELECT * FROM recipe_ingredient'), (r) => r.recipe_id)
  const stepsByRecipe = groupByKey(
    queryAll<RecipeStepRow>(db, 'SELECT * FROM recipe_step ORDER BY recipe_id, ordre'),
    (r) => r.recipe_id
  )
  const facetsByRecipe = groupByKey(queryAll<RecipeFacetRow>(db, 'SELECT * FROM recipe_facet'), (r) => r.recipe_id)

  const map = new Map<RecipeId, Recipe>()
  for (const row of recipeRows) {
    const id = row.id as RecipeId

    const ingredients: RecipeIngredient[] = (ingredientsByRecipe.get(row.id) ?? []).map((i) => ({
      foodId: i.food_id as FoodId,
      quantiteG: g(i.quantite_g),
      uniteAffichage: i.unite_affichage,
      optionnel: i.optionnel !== 0,
    }))

    const etapes: RecipeStep[] = (stepsByRecipe.get(row.id) ?? []).map((s) => ({
      ordre: s.ordre,
      texte: s.texte,
      lexiconIds: parseJsonArray<string>(s.lexicon_ids),
      timerS: s.timer_s,
      timerType: s.timer_type as TimerType | null,
    }))

    const facettes: RecipeFacet[] = (facetsByRecipe.get(row.id) ?? []).map((f) => ({
      facette: f.facette as FacetteKind,
      valeur: f.valeur,
    }))

    map.set(id, {
      id,
      nom: row.nom,
      description: row.description,
      tempsPrepMin: min(row.temps_prep_min),
      tempsCuissonMin: min(row.temps_cuisson_min),
      difficulte: row.difficulte as 1 | 2 | 3,
      portionsBase: row.portions_base,
      imagePath: row.image_path,
      typesRepas: parseJsonArray<MealSlot>(row.types_repas),
      saisonMois: parseJsonArray<Month>(row.saison_mois),
      envergure: row.envergure as RecipeEnvergure,
      conservationJours: row.conservation_jours,
      axes: {
        sucreSale: row.axe_sucre_sale,
        legerConsistant: row.axe_leger_consistant,
        chaudFroid: row.axe_chaud_froid,
        texture: row.axe_texture,
      },
      ingredients,
      etapes,
      facettes,
    })
  }
  return map
}

// --- Index (§9.1 ENGINE.md) ---------------------------------------------------------------------

function buildIndexes(recipes: ReadonlyMap<RecipeId, Recipe>, foods: ReadonlyMap<FoodId, Food>): CatalogIndexes {
  const recipesBySlot = new Map<MealSlot, Set<RecipeId>>()
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
    recipeMainIngredient: new Map(),
  }
}

// --- Point d'entrée ------------------------------------------------------------------------------

/** Ouvre `catalog.db` (lecture seule) et retourne le catalogue en mémoire, formes domaine. */
export function loadCatalog(dbPath: string): Catalog {
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    const foods = loadFoods(db)
    const recipes = loadRecipes(db)

    return {
      version: CATALOG_VERSION,
      foods,
      recipes,
      nutrients: loadNutrients(db),
      allergens: loadAllergens(db),
      lexicon: loadLexicon(db),
      topics: new Map(),
      substitutions: new Map(),
      indexes: buildIndexes(recipes, foods),
    }
  } finally {
    db.close()
  }
}
