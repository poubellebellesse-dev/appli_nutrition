// data/catalog-loader.ts
//
// Pont data/ → engine/domain (docs/ARCHITECTURE.md §3, §9 ; docs/ENGINE.md §3, §9.2). Seule
// couche autorisée à importer une base de données : ouvre `catalog.db` et mappe chaque ligne SQL vers
// les types domaine de engine/domain/catalog.ts. Aucune logique de sélection (filtrage, score,
// agrégation nutritionnelle métier) — uniquement du mapping et du regroupement de lignes. Le
// schéma lu est celui produit par catalog/build.mjs (constante SCHEMA_SQL).
//
// Écarts assumés, à corriger quand le pipeline amont évoluera :
//  - `Catalog.version` : aucune table de version dans catalog.db aujourd'hui → valeur figée
//    ci-dessous. À raccorder à une vraie colonne quand build.mjs en écrira une.
//  - `CatalogIndexes.recipeNutrients` / `recipeMainIngredient` : Map vides ici. Leur calcul
//    (`aggregateRecipe`, §6.5 ENGINE.md précision 8) est une fonction PURE de `engine/nutrition/`
//    exécutée à `createEngine(catalog)`, pas au build ni dans ce loader — pour ne pas coupler
//    data/ ni build.mjs au moteur. Peupler ces deux Map est la responsabilité de l'init moteur.
//  - `topics` / `substitutions` : Map vides — tables absentes de catalog.db (voir l'en-tête de
//    engine/domain/catalog.ts).
//  - `recipesByAllergen` : un allergène "touche" une recette dès qu'il apparaît sur un de ses
//    ingrédients, y compris optionnel ou en simple trace — c'est un index neutre (pas un filtre
//    d'éviction), la sévérité relève de engine/guards.
//
// ⚠️ CE FICHIER NE DOIT IMPORTER AUCUN MODULE NODE, et c'est vérifié par le build de la PWA.
// Il est chargé par le NAVIGATEUR (§3 ARCHITECTURE : l'appli cible est une PWA), où `node:sqlite`
// n'existe pas. Un simple `import { DatabaseSync } from 'node:sqlite'` en tête de fichier suffit à
// casser le bundle, même si la fonction qui s'en sert n'est jamais appelée : l'import est hoisté.
// C'est arrivé le 2026-07-28, et le message d'erreur ne désigne pas la cause.
//
// L'ouverture d'un FICHIER vit donc dans `catalog-loader-node.ts` — build, tests, bancs CLI.
// Ici, seulement `loadCatalogFrom(source)`, commun aux deux mondes.

import type {
  AnimalOrigin,
  CourseKind,
  PiquantLevel,
  Allergen,
  AllergenCertitude,
  AllergenId,
  Catalog,
  CatalogIndexes,
  DietCode,
  EvidenceCategorie,
  EvidenceCibleType,
  EvidenceLink,
  EvidencePosition,
  EvidenceSheet,
  EvidenceSheetId,
  EvidenceSource,
  NiveauPreuve,
  TypeEtude,
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
  NutrientSense,
  Recipe,
  RecipeEnvergure,
  RecipeOrigine,
  Tip,
  TipCategorie,
  RecipeFacet,
  RecipeId,
  RecipeIngredient,
  RecipeSource,
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
  readonly sens: string
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
  readonly sous_famille: string | null
  readonly saison_mois: string
  readonly toute_annee: number
  readonly piquant: number | null
  readonly poids_piece_g: number | null
  readonly fond_de_placard: number
  readonly conditionnement_g: number | null
  readonly origine_animale: string | null
  readonly derive_de: string | null
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
  readonly origine: string
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
  readonly service: string | null
  readonly piquant: number | null
  readonly teste_le: string | null
}

interface RecipeSourceRow {
  readonly recipe_id: string
  readonly type: string
  readonly titre: string
  readonly url: string
  readonly consulte_le: string
  readonly licence: string | null
  readonly auteur: string | null
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

interface EvidenceSheetRow {
  readonly id: string
  readonly code: string
  readonly titre: string
  readonly categorie: string
  readonly niveau_preuve: string
  readonly date_revue: string
  readonly resume_vulgarise: string
}

interface EvidenceSourceRow {
  readonly sheet_id: string
  readonly code: string
  readonly titre_etude: string
  readonly auteurs: string | null
  readonly annee: number
  readonly revue: string
  readonly doi: string | null
  readonly url: string
  readonly type_etude: string
  readonly effectif: string | null
  readonly financement: string | null
  readonly consulte_le: string
}

interface EvidencePositionRow {
  readonly sheet_id: string
  readonly ordre: number
  readonly code: string
  readonly niveau_preuve: string
  readonly porte_par: string
  readonly affirmation: string
  readonly detail: string
}

interface EvidencePositionSourceRow {
  readonly sheet_id: string
  readonly position_ordre: number
  readonly source_code: string
}

interface EvidenceLinkRow {
  readonly sheet_id: string
  readonly cible_type: string
  readonly cible_id: string
}

// --- Utilitaires de mapping -------------------------------------------------------------------

/**
 * Le STRICT MINIMUM que ce module demande à une base SQLite : exécuter une requête sans paramètre
 * et rendre les lignes.
 *
 * ⚠️ POURQUOI CETTE INTERFACE EXISTE. `node:sqlite` n'existe pas dans un navigateur, et l'appli
 * cible est une PWA (§3 ARCHITECTURE) : le même mapping doit tourner sous Node — build, tests,
 * bancs CLI — et sous SQLite WASM côté client. Tout le reste de ce fichier est du mapping PUR ;
 * seule cette frontière était couplée à Node.
 *
 * Volontairement réduite à `all(sql)` : ce module ne fait aucune requête paramétrée, n'écrit
 * jamais, et n'a pas besoin de transactions. Une interface plus riche inviterait à s'en servir.
 */
interface TipRow {
  readonly id: string
  readonly code: string
  readonly categorie: string
  readonly texte: string
  readonly source_url: string
}

export interface SqlSource {
  all<T>(sql: string): readonly T[]
}

function queryAll<T>(db: SqlSource, sql: string): readonly T[] {
  return db.all<T>(sql)
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

/**
 * Tips « Le saviez-vous ? » (§8.4 ARCHITECTURE, §4.7 DESIGN).
 *
 * Ordonnés par code : le catalogue est une donnée, pas un flux — l'ordre d'affichage (rotation,
 * aléa du jour) appartient à l'écran, qui seul dispose d'une horloge.
 */
function loadTips(db: SqlSource): Tip[] {
  const sql = 'SELECT id, code, categorie, texte, source_url FROM tip ORDER BY code'
  return queryAll<TipRow>(db, sql).map((row) => ({
    id: row.id,
    code: row.code,
    // Sûr : la colonne porte un CHECK qui n'admet que les trois catégories de §8.4.
    categorie: row.categorie as TipCategorie,
    texte: row.texte,
    sourceUrl: row.source_url,
  }))
}

function loadNutrients(db: SqlSource): Nutrient[] {
  const rows = queryAll<NutrientRow>(db, 'SELECT * FROM nutrient')
  return rows.map((row) => ({
    id: row.id as NutrientId,
    code: row.code,
    nom: row.nom,
    unite: row.unite,
    vnrAdulte: row.vnr_adulte,
    categorie: row.categorie as NutrientCategory | null,
    sens: row.sens as NutrientSense,
  }))
}

function loadAllergens(db: SqlSource): Map<AllergenId, Allergen> {
  const rows = queryAll<AllergenRow>(db, 'SELECT * FROM allergen')
  const map = new Map<AllergenId, Allergen>()
  for (const row of rows) {
    const id = row.id as AllergenId
    map.set(id, { id, code: row.code, nom: row.nom })
  }
  return map
}

function loadFoods(db: SqlSource): Map<FoodId, Food> {
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
      sousFamille: row.sous_famille,
    piquant: (row.piquant as PiquantLevel | null) ?? null,
      poidsPieceG: row.poids_piece_g ?? null,
      fondDePlacard: row.fond_de_placard !== 0,
      conditionnementG: row.conditionnement_g ?? null,
      origineAnimale: (row.origine_animale as AnimalOrigin | null) ?? null,
      deriveDe: (row.derive_de as FoodId | null) ?? null,
      nutrimentsPour100g,
      allergenes,
      saisonMois: parseJsonArray<Month>(row.saison_mois),
      touteAnnee: row.toute_annee !== 0,
    })
  }
  return map
}

function loadLexicon(db: SqlSource): Map<LexiconEntryId, LexiconEntry> {
  const rows = queryAll<LexiconRow>(db, 'SELECT * FROM lexicon_entry')
  const map = new Map<LexiconEntryId, LexiconEntry>()
  for (const row of rows) {
    const id = row.id as LexiconEntryId
    map.set(id, { id, code: row.code, terme: row.terme, definition: row.definition })
  }
  return map
}

/**
 * Fiches scientifiques de « Comprendre » (§8.2 ARCHITECTURE, §4.7 DESIGN).
 *
 * Cinq tables recomposées en un objet par fiche. Les positions sont rendues DANS L'ORDRE de la
 * colonne `ordre` : cet ordre est un choix éditorial (le socle de consensus d'abord, la lecture
 * croisée en dernier), pas une commodité d'affichage — le trier autrement casserait l'argumentation.
 *
 * ⚠️ Une position sans source ne peut pas exister : le build échoue avant d'en écrire une (voir
 * `validateEvidence` dans catalog/build.mjs). Ce loader ne re-vérifie donc pas la contrainte, il
 * s'appuie dessus.
 */
function loadEvidence(db: SqlSource): Map<EvidenceSheetId, EvidenceSheet> {
  const sheetRows = queryAll<EvidenceSheetRow>(db, 'SELECT * FROM evidence_sheet ORDER BY code')
  const sourcesBySheet = groupByKey(
    queryAll<EvidenceSourceRow>(db, 'SELECT * FROM evidence_source'),
    (r) => r.sheet_id
  )
  const positionsBySheet = groupByKey(
    queryAll<EvidencePositionRow>(db, 'SELECT * FROM evidence_position ORDER BY sheet_id, ordre'),
    (r) => r.sheet_id
  )
  const linksBySheet = groupByKey(queryAll<EvidenceLinkRow>(db, 'SELECT * FROM evidence_link'), (r) => r.sheet_id)
  // La jonction porte une clé COMPOSITE (fiche + ordre de position) : on l'aplatit en une seule
  // chaîne pour réutiliser `groupByKey`, qui indexe par string.
  const refsByPosition = groupByKey(
    queryAll<EvidencePositionSourceRow>(db, 'SELECT * FROM evidence_position_source'),
    (r) => `${r.sheet_id}#${r.position_ordre}`
  )

  const map = new Map<EvidenceSheetId, EvidenceSheet>()
  for (const row of sheetRows) {
    const id = row.id as EvidenceSheetId

    const sources: EvidenceSource[] = (sourcesBySheet.get(row.id) ?? []).map((s) => ({
      code: s.code,
      titreEtude: s.titre_etude,
      auteurs: s.auteurs,
      annee: s.annee,
      revue: s.revue,
      doi: s.doi,
      url: s.url,
      // Sûr : la colonne porte un CHECK qui n'admet que les six types du vocabulaire.
      typeEtude: s.type_etude as TypeEtude,
      effectif: s.effectif,
      financement: s.financement,
      consulteLe: s.consulte_le,
    }))

    const positions: EvidencePosition[] = (positionsBySheet.get(row.id) ?? []).map((p) => ({
      code: p.code,
      niveauPreuve: p.niveau_preuve as NiveauPreuve,
      portePar: p.porte_par,
      affirmation: p.affirmation,
      detail: p.detail,
      sources: (refsByPosition.get(`${p.sheet_id}#${p.ordre}`) ?? []).map((r) => r.source_code),
    }))

    const liens: EvidenceLink[] = (linksBySheet.get(row.id) ?? []).map((l) => ({
      cibleType: l.cible_type as EvidenceCibleType,
      cibleId: l.cible_id,
    }))

    map.set(id, {
      id,
      code: row.code,
      titre: row.titre,
      categorie: row.categorie as EvidenceCategorie,
      niveauPreuve: row.niveau_preuve as NiveauPreuve,
      dateRevue: row.date_revue,
      resumeVulgarise: row.resume_vulgarise,
      positions,
      sources,
      liens,
    })
  }
  return map
}

function loadRecipes(db: SqlSource): Map<RecipeId, Recipe> {
  const recipeRows = queryAll<RecipeRow>(db, 'SELECT * FROM recipe')
  const ingredientsByRecipe = groupByKey(queryAll<RecipeIngredientRow>(db, 'SELECT * FROM recipe_ingredient'), (r) => r.recipe_id)
  const stepsByRecipe = groupByKey(
    queryAll<RecipeStepRow>(db, 'SELECT * FROM recipe_step ORDER BY recipe_id, ordre'),
    (r) => r.recipe_id
  )
  const facetsByRecipe = groupByKey(queryAll<RecipeFacetRow>(db, 'SELECT * FROM recipe_facet'), (r) => r.recipe_id)
  const sourcesByRecipe = groupByKey(
    queryAll<RecipeSourceRow>(db, 'SELECT * FROM recipe_source ORDER BY recipe_id, titre'),
    (r) => r.recipe_id
  )

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
      origine: row.origine as RecipeOrigine,
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
      service: (row.service as CourseKind | null) ?? null,
      piquant: (row.piquant as PiquantLevel | null) ?? null,
      sources: (sourcesByRecipe.get(row.id) ?? []).map((s) => ({
        type: s.type as RecipeSource['type'],
        titre: s.titre,
        url: s.url,
        consulteLe: s.consulte_le,
        licence: s.licence,
        auteur: s.auteur,
      })),
      testeLe: row.teste_le,
    })
  }
  return map
}

// --- Index (§9.1 ENGINE.md) ---------------------------------------------------------------------

/**
 * Ajoute des recettes au catalogue et RECONSTRUIT ses index.
 *
 * ⚠️ LA RECONSTRUCTION N'EST PAS UNE PRÉCAUTION, C'EST LA CONDITION DE SÛRETÉ. `attachDerivedIndexes`
 * (appelé par `createEngine`) ne recalcule QUE la famille nutriments/signatures : il recopie
 * `recipesBySlot`, `recipesByDiet` et `recipesByAllergen` tels quels. Se contenter d'ajouter une
 * recette à la map produirait donc deux défauts silencieux :
 *   1. absente de `recipesBySlot`, elle ne serait JAMAIS candidate — `runSuggestMeals` part de cet
 *      index. La recette existerait, sans jamais être proposée, sans message ;
 *   2. absente de `recipesByAllergen`, elle échapperait à l'index sur lequel s'appuie l'exclusion
 *      des allergènes. Une recette contenant un allergène déclaré pourrait passer.
 *
 * Le second est le vrai danger : le garde-fou le plus critique du moteur, contourné par une recette
 * que l'utilisateur a lui-même composée. D'où cette fonction, et le test qui l'accompagne.
 *
 * Rend le catalogue INCHANGÉ si la liste est vide — le cas courant, et il ne coûte rien.
 */
export function avecRecettesSupplementaires(
  source: Catalog,
  supplementaires: readonly Recipe[]
): Catalog {
  if (supplementaires.length === 0) return source
  const recipes = new Map(source.recipes)
  // Une recette utilisateur portant l'identifiant d'une recette du catalogue l'emporterait. Le
  // préfixe `perso:` rend le cas impossible en pratique ; l'ordre est explicite au cas où.
  for (const recette of supplementaires) recipes.set(recette.id, recette)
  return { ...source, recipes, indexes: buildIndexes(recipes, source.foods) }
}

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
    recipeNutrientCoverage: new Map(),
    recipeMainIngredient: new Map(),
    recipeSignature: new Map(),
    recipeFamilySignature: new Map(),
    declaredFamilies: new Set(),
    recipeCharacteristic: new Map(),
  }
}

// --- Point d'entrée ------------------------------------------------------------------------------

/** Ouvre `catalog.db` (lecture seule) et retourne le catalogue en mémoire, formes domaine. */
/**
 * Construit le `Catalog` depuis n'importe quelle source SQL — c'est la fonction que le navigateur
 * appelle, avec une base SQLite WASM. Ne ferme pas la source : elle ne l'a pas ouverte.
 */
export function loadCatalogFrom(db: SqlSource): Catalog {
  const foods = loadFoods(db)
  const recipes = loadRecipes(db)

  return {
    version: CATALOG_VERSION,
    foods,
    recipes,
    nutrients: loadNutrients(db),
    allergens: loadAllergens(db),
    lexicon: loadLexicon(db),
    tips: loadTips(db),
    evidence: loadEvidence(db),
    topics: new Map(),
    substitutions: new Map(),
    indexes: buildIndexes(recipes, foods),
  }
}

