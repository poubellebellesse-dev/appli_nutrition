#!/usr/bin/env node
// ============================================================================
// catalog/build.mjs
//
// Compile les sources éditables (catalog/sources, catalog/lexicon,
// catalog/recipes — YAML en clair) en un unique fichier SQLite `catalog.db`
// consommé par le runtime (docs/ARCHITECTURE.md §9, docs/ENGINE.md §9).
//
// "Tout ce qui peut être calculé au build l'est." (docs/ENGINE.md §9.2)
//
// Le build échoue (exit != 0) si :
//   - une recette référence un `food_id` inconnu
//   - une étape référence un `lexicon_ids` code absent du lexique
//   - un mot du lexique banni (docs/ARCHITECTURE.md §6.2) apparaît dans un
//     champ texte de contenu (nom / description / étape / lexique)
//
// Node ESM pur, sans TypeScript (le build n'est pas du code applicatif).
// Utilise le module intégré `node:sqlite` (Node >= 22.5, stable en Node 24).
// ============================================================================

import { readFile, readdir, mkdir } from 'node:fs/promises'
import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { DatabaseSync } from 'node:sqlite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ----------------------------------------------------------------------------
// 1. Arguments CLI (permet aux tests de pointer vers une fixture isolée sans
//    toucher aux vraies sources ni au vrai catalog.db — voir catalog/build.test.ts)
// ----------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { sources: null, out: null }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--sources') args.sources = argv[++i]
    else if (argv[i] === '--out') args.out = argv[++i]
  }
  return args
}

const cliArgs = parseArgs(process.argv.slice(2))
const SOURCES_DIR = cliArgs.sources
  ? path.resolve(cliArgs.sources)
  : __dirname
const OUT_PATH = cliArgs.out
  ? path.resolve(cliArgs.out)
  : path.join(__dirname, '..', 'app', 'public', 'catalog', 'catalog.db')

// ----------------------------------------------------------------------------
// 2. Référentiels fixes (docs/ARCHITECTURE.md §4.2)
//    Ni les nutriments ni les 14 allergènes UE ne varient d'une recette à
//    l'autre : ce sont des référentiels, pas du contenu éditorial — ils
//    vivent ici plutôt que dans un fichier YAML séparé.
// ----------------------------------------------------------------------------

// Clé = champ utilisé dans sources/foods.yaml (`nutriments.<clé>`).
// vnr_adulte = valeur nutritionnelle de référence adulte, indicative
// (proche des NRV UE — règlement 1169/2011 annexe XIII), utilisée pour
// contextualiser un apport, jamais comme cible à atteindre (§6.5 ARCHITECTURE).
const NUTRIENTS = [
  { key: 'energie_kcal', id: 'energie', code: 'energie', nom: 'Énergie', unite: 'kcal', vnr_adulte: 2000, categorie: 'macronutriment' },
  { key: 'proteines_g', id: 'proteines', code: 'proteines', nom: 'Protéines', unite: 'g', vnr_adulte: 50, categorie: 'macronutriment' },
  { key: 'lipides_g', id: 'lipides', code: 'lipides', nom: 'Lipides', unite: 'g', vnr_adulte: 70, categorie: 'macronutriment' },
  { key: 'glucides_g', id: 'glucides', code: 'glucides', nom: 'Glucides', unite: 'g', vnr_adulte: 260, categorie: 'macronutriment' },
  { key: 'fibres_g', id: 'fibres', code: 'fibres', nom: 'Fibres alimentaires', unite: 'g', vnr_adulte: 25, categorie: 'macronutriment' },
  { key: 'fer_mg', id: 'fer', code: 'fer', nom: 'Fer', unite: 'mg', vnr_adulte: 14, categorie: 'mineral' },
  { key: 'calcium_mg', id: 'calcium', code: 'calcium', nom: 'Calcium', unite: 'mg', vnr_adulte: 800, categorie: 'mineral' },
  { key: 'sodium_mg', id: 'sodium', code: 'sodium', nom: 'Sodium', unite: 'mg', vnr_adulte: 2000, categorie: 'mineral' },
  { key: 'vitamine_c_mg', id: 'vitamine_c', code: 'vitamine_c', nom: 'Vitamine C', unite: 'mg', vnr_adulte: 80, categorie: 'vitamine' },
]

// Les 14 allergènes réglementaires UE (règlement 1169/2011 annexe II).
const ALLERGENS = [
  { id: 'gluten', code: 'gluten', nom: 'Céréales contenant du gluten' },
  { id: 'crustaces', code: 'crustaces', nom: 'Crustacés' },
  { id: 'oeufs', code: 'oeufs', nom: 'Œufs' },
  { id: 'poissons', code: 'poissons', nom: 'Poissons' },
  { id: 'arachides', code: 'arachides', nom: 'Arachides' },
  { id: 'soja', code: 'soja', nom: 'Soja' },
  { id: 'lait', code: 'lait', nom: 'Lait' },
  { id: 'fruits_a_coque', code: 'fruits_a_coque', nom: 'Fruits à coque' },
  { id: 'celeri', code: 'celeri', nom: 'Céleri' },
  { id: 'moutarde', code: 'moutarde', nom: 'Moutarde' },
  { id: 'sesame', code: 'sesame', nom: 'Graines de sésame' },
  { id: 'sulfites', code: 'sulfites', nom: 'Anhydride sulfureux et sulfites' },
  { id: 'lupin', code: 'lupin', nom: 'Lupin' },
  { id: 'mollusques', code: 'mollusques', nom: 'Mollusques' },
]

// Lexique banni (docs/ARCHITECTURE.md §6.2) — deux familles, un seul test.
const BANNED_TERMS = [
  // Famille thérapeutique (§6.1)
  'soigne', 'soigner', 'guérit', 'guérir', 'traite', 'traiter',
  'prévient la maladie', 'remède', 'thérapie',
  // Famille jugement (principe 6)
  'malsain', 'mauvais pour', 'à éviter', 'trop gras', 'cheat meal',
  'se rattraper', 'plaisir coupable', 'aliment sain',
]

// ----------------------------------------------------------------------------
// 3. Utilitaires
// ----------------------------------------------------------------------------

class BuildError extends Error {}

/** Normalise pour la comparaison : minuscules, accents retirés. */
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
}

// Marques diacritiques combinantes Unicode (U+0300–U+036F) — retirées après
// normalisation NFD pour comparer le texte indépendamment des accents.
const COMBINING_DIACRITICS = /[̀-ͯ]/g

const NORMALIZED_BANNED = BANNED_TERMS.map((term) => ({ term, normalized: normalize(term) }))

/**
 * Cherche les termes bannis dans un champ texte de contenu.
 * Retourne la liste des termes trouvés (vide si rien).
 */
function findBannedTerms(text) {
  if (typeof text !== 'string' || text.length === 0) return []
  const normalized = normalize(text)
  return NORMALIZED_BANNED.filter(({ normalized: n }) => normalized.includes(n)).map((m) => m.term)
}

async function readYamlFile(filePath) {
  const raw = await readFile(filePath, 'utf8')
  return parseYaml(raw)
}

async function readYamlDir(dirPath) {
  if (!existsSync(dirPath)) return []
  const entries = await readdir(dirPath, { withFileTypes: true })
  const files = entries
    .filter((e) => e.isFile() && (e.name.endsWith('.yaml') || e.name.endsWith('.yml')))
    .map((e) => path.join(dirPath, e.name))
    .sort()
  return Promise.all(files.map(readYamlFile))
}

// ----------------------------------------------------------------------------
// 4. Chargement des sources
// ----------------------------------------------------------------------------

async function loadFoods() {
  const filePath = path.join(SOURCES_DIR, 'sources', 'foods.yaml')
  const data = await readYamlFile(filePath)
  return Array.isArray(data?.foods) ? data.foods : []
}

async function loadLexicon() {
  return readYamlDir(path.join(SOURCES_DIR, 'lexicon'))
}

async function loadRecipes() {
  return readYamlDir(path.join(SOURCES_DIR, 'recipes'))
}

// ----------------------------------------------------------------------------
// 5. Validation — collecte toutes les erreurs avant d'échouer (meilleur
//    diagnostic qu'un exit sur la première erreur trouvée).
// ----------------------------------------------------------------------------

function validateCatalog({ foods, lexicon, recipes }) {
  const errors = []
  const nutrientKeys = new Set(NUTRIENTS.map((n) => n.key))
  const allergenCodes = new Set(ALLERGENS.map((a) => a.code))

  // --- Aliments ---
  const foodIds = new Set()
  for (const food of foods) {
    if (!food?.id) {
      errors.push(`Aliment sans id : ${JSON.stringify(food)}`)
      continue
    }
    if (foodIds.has(food.id)) errors.push(`Aliment en double : id '${food.id}'`)
    foodIds.add(food.id)

    for (const key of Object.keys(food.nutriments ?? {})) {
      if (!nutrientKeys.has(key)) {
        errors.push(`Aliment '${food.id}' : nutriment inconnu '${key}'`)
      }
    }
    for (const allergene of food.allergenes ?? []) {
      if (!allergenCodes.has(allergene.code)) {
        errors.push(`Aliment '${food.id}' : allergène inconnu '${allergene.code}'`)
      }
      if (!['contient', 'traces'].includes(allergene.certitude)) {
        errors.push(`Aliment '${food.id}' : certitude d'allergène invalide '${allergene.certitude}'`)
      }
    }
  }

  // --- Lexique ---
  const lexiconCodes = new Set()
  for (const entry of lexicon) {
    if (!entry?.code) {
      errors.push(`Entrée de lexique sans code : ${JSON.stringify(entry)}`)
      continue
    }
    if (lexiconCodes.has(entry.code)) errors.push(`Entrée de lexique en double : code '${entry.code}'`)
    lexiconCodes.add(entry.code)

    for (const field of [entry.terme, entry.definition]) {
      const hits = findBannedTerms(field)
      if (hits.length > 0) {
        errors.push(`Lexique '${entry.code}' : vocabulaire banni détecté (${hits.join(', ')})`)
      }
    }
  }

  // --- Recettes ---
  const recipeIds = new Set()
  for (const recipe of recipes) {
    if (!recipe?.id) {
      errors.push(`Recette sans id : ${JSON.stringify(recipe)}`)
      continue
    }
    if (recipeIds.has(recipe.id)) errors.push(`Recette en double : id '${recipe.id}'`)
    recipeIds.add(recipe.id)

    for (const field of [recipe.nom, recipe.description]) {
      const hits = findBannedTerms(field)
      if (hits.length > 0) {
        errors.push(`Recette '${recipe.id}' : vocabulaire banni détecté (${hits.join(', ')})`)
      }
    }

    for (const ingredient of recipe.ingredients ?? []) {
      if (!foodIds.has(ingredient.food_id)) {
        errors.push(`Recette '${recipe.id}' : aliment inconnu '${ingredient.food_id}'`)
      }
    }

    for (const etape of recipe.etapes ?? []) {
      const hits = findBannedTerms(etape.texte)
      if (hits.length > 0) {
        errors.push(`Recette '${recipe.id}', étape ${etape.ordre} : vocabulaire banni détecté (${hits.join(', ')})`)
      }
      for (const code of etape.lexicon_ids ?? []) {
        if (!lexiconCodes.has(code)) {
          errors.push(`Recette '${recipe.id}', étape ${etape.ordre} : geste de lexique inconnu '${code}'`)
        }
      }
    }

    for (const facette of recipe.facettes ?? []) {
      if (!['cuisine', 'regime', 'occasion', 'style'].includes(facette.facette)) {
        errors.push(`Recette '${recipe.id}' : facette inconnue '${facette.facette}'`)
      }
    }
  }

  return errors
}

// ----------------------------------------------------------------------------
// 6. Construction de la base SQLite
// ----------------------------------------------------------------------------

const SCHEMA_SQL = `
CREATE TABLE nutrient (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  nom TEXT NOT NULL,
  unite TEXT NOT NULL,
  vnr_adulte REAL,
  categorie TEXT
);

CREATE TABLE food (
  id TEXT PRIMARY KEY,
  code_ciqual TEXT NOT NULL,
  nom TEXT NOT NULL,
  groupe TEXT NOT NULL
);

CREATE TABLE food_nutrient (
  food_id TEXT NOT NULL REFERENCES food(id),
  nutrient_id TEXT NOT NULL REFERENCES nutrient(id),
  valeur_pour_100g REAL NOT NULL,
  PRIMARY KEY (food_id, nutrient_id)
);

CREATE TABLE allergen (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  nom TEXT NOT NULL
);

CREATE TABLE food_allergen (
  food_id TEXT NOT NULL REFERENCES food(id),
  allergen_id TEXT NOT NULL REFERENCES allergen(id),
  certitude TEXT NOT NULL CHECK (certitude IN ('contient', 'traces')),
  PRIMARY KEY (food_id, allergen_id)
);

CREATE TABLE recipe (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  description TEXT NOT NULL,
  temps_prep_min INTEGER NOT NULL,
  temps_cuisson_min INTEGER NOT NULL,
  difficulte INTEGER NOT NULL CHECK (difficulte IN (1, 2, 3)),
  portions_base INTEGER NOT NULL,
  image_path TEXT,
  types_repas TEXT NOT NULL,
  saison_mois TEXT NOT NULL,
  envergure TEXT NOT NULL CHECK (envergure IN ('quotidien', 'convivial', 'fete')),
  conservation_jours INTEGER NOT NULL,
  axe_sucre_sale REAL NOT NULL,
  axe_leger_consistant REAL NOT NULL,
  axe_chaud_froid REAL NOT NULL,
  axe_texture TEXT NOT NULL
);

CREATE TABLE recipe_ingredient (
  recipe_id TEXT NOT NULL REFERENCES recipe(id),
  food_id TEXT NOT NULL REFERENCES food(id),
  quantite_g REAL NOT NULL,
  unite_affichage TEXT NOT NULL,
  optionnel INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE recipe_step (
  recipe_id TEXT NOT NULL REFERENCES recipe(id),
  ordre INTEGER NOT NULL,
  texte TEXT NOT NULL,
  lexicon_ids TEXT NOT NULL,
  timer_s INTEGER,
  timer_type TEXT CHECK (timer_type IN ('cuisson', 'repos') OR timer_type IS NULL),
  PRIMARY KEY (recipe_id, ordre)
);

CREATE TABLE recipe_facet (
  recipe_id TEXT NOT NULL REFERENCES recipe(id),
  facette TEXT NOT NULL CHECK (facette IN ('cuisine', 'regime', 'occasion', 'style')),
  valeur TEXT NOT NULL
);

CREATE TABLE lexicon_entry (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  terme TEXT NOT NULL,
  definition TEXT NOT NULL
);
`

function buildDatabase({ foods, lexicon, recipes }, outPath) {
  if (existsSync(outPath)) rmSync(outPath, { force: true })

  const db = new DatabaseSync(outPath)
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec(SCHEMA_SQL)

  db.exec('BEGIN TRANSACTION;')
  try {
    const insertNutrient = db.prepare(
      'INSERT INTO nutrient (id, code, nom, unite, vnr_adulte, categorie) VALUES (?, ?, ?, ?, ?, ?)'
    )
    for (const n of NUTRIENTS) insertNutrient.run(n.id, n.code, n.nom, n.unite, n.vnr_adulte, n.categorie)

    const insertAllergen = db.prepare('INSERT INTO allergen (id, code, nom) VALUES (?, ?, ?)')
    for (const a of ALLERGENS) insertAllergen.run(a.id, a.code, a.nom)

    const insertFood = db.prepare('INSERT INTO food (id, code_ciqual, nom, groupe) VALUES (?, ?, ?, ?)')
    const insertFoodNutrient = db.prepare(
      'INSERT INTO food_nutrient (food_id, nutrient_id, valeur_pour_100g) VALUES (?, ?, ?)'
    )
    const insertFoodAllergen = db.prepare(
      'INSERT INTO food_allergen (food_id, allergen_id, certitude) VALUES (?, ?, ?)'
    )
    const nutrientByKey = new Map(NUTRIENTS.map((n) => [n.key, n.id]))
    for (const food of foods) {
      insertFood.run(food.id, food.code_ciqual, food.nom, food.groupe)
      for (const [key, valeur] of Object.entries(food.nutriments ?? {})) {
        insertFoodNutrient.run(food.id, nutrientByKey.get(key), valeur)
      }
      for (const allergene of food.allergenes ?? []) {
        insertFoodAllergen.run(food.id, allergene.code, allergene.certitude)
      }
    }

    const insertLexicon = db.prepare(
      'INSERT INTO lexicon_entry (id, code, terme, definition) VALUES (?, ?, ?, ?)'
    )
    for (const entry of lexicon) {
      insertLexicon.run(entry.code, entry.code, entry.terme, entry.definition)
    }

    const insertRecipe = db.prepare(`
      INSERT INTO recipe (
        id, nom, description, temps_prep_min, temps_cuisson_min, difficulte,
        portions_base, image_path, types_repas, saison_mois, envergure,
        conservation_jours, axe_sucre_sale, axe_leger_consistant, axe_chaud_froid, axe_texture
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertIngredient = db.prepare(`
      INSERT INTO recipe_ingredient (recipe_id, food_id, quantite_g, unite_affichage, optionnel)
      VALUES (?, ?, ?, ?, ?)
    `)
    const insertStep = db.prepare(`
      INSERT INTO recipe_step (recipe_id, ordre, texte, lexicon_ids, timer_s, timer_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    const insertFacet = db.prepare('INSERT INTO recipe_facet (recipe_id, facette, valeur) VALUES (?, ?, ?)')

    for (const recipe of recipes) {
      insertRecipe.run(
        recipe.id,
        recipe.nom,
        recipe.description,
        recipe.temps_prep_min,
        recipe.temps_cuisson_min,
        recipe.difficulte,
        recipe.portions_base,
        recipe.image_path ?? null,
        JSON.stringify(recipe.types_repas ?? []),
        JSON.stringify(recipe.saison_mois ?? []),
        recipe.envergure,
        recipe.conservation_jours,
        recipe.axes?.sucre_sale ?? 0,
        recipe.axes?.leger_consistant ?? 0,
        recipe.axes?.chaud_froid ?? 0,
        recipe.axes?.texture ?? ''
      )
      for (const ing of recipe.ingredients ?? []) {
        insertIngredient.run(recipe.id, ing.food_id, ing.quantite_g, ing.unite_affichage, ing.optionnel ? 1 : 0)
      }
      for (const etape of recipe.etapes ?? []) {
        insertStep.run(
          recipe.id,
          etape.ordre,
          etape.texte,
          JSON.stringify(etape.lexicon_ids ?? []),
          etape.timer_s ?? null,
          etape.timer_type ?? null
        )
      }
      for (const facette of recipe.facettes ?? []) {
        insertFacet.run(recipe.id, facette.facette, facette.valeur)
      }
    }

    db.exec('COMMIT;')
  } catch (err) {
    db.exec('ROLLBACK;')
    db.close()
    throw err
  }

  db.close()
}

// ----------------------------------------------------------------------------
// 7. Orchestration
// ----------------------------------------------------------------------------

async function main() {
  const [foods, lexicon, recipes] = await Promise.all([loadFoods(), loadLexicon(), loadRecipes()])

  const errors = validateCatalog({ foods, lexicon, recipes })
  if (errors.length > 0) {
    console.error(`Build du catalogue échoué — ${errors.length} erreur(s) :\n`)
    for (const err of errors) console.error(`  - ${err}`)
    throw new BuildError(`${errors.length} erreur(s) de validation`)
  }

  await mkdir(path.dirname(OUT_PATH), { recursive: true })
  buildDatabase({ foods, lexicon, recipes }, OUT_PATH)

  console.log(
    `catalog.db généré : ${foods.length} aliments, ${recipes.length} recettes, ${lexicon.length} gestes de lexique.`
  )
  console.log(`→ ${OUT_PATH}`)
}

main().catch((err) => {
  console.error(err instanceof BuildError ? err.message : err)
  process.exitCode = 1
})
