// Preuve du critère de sortie P0 (docs/ETAT.md §6) :
//   "catalog.db généré depuis 10 recettes ; le build échoue sur une recette invalide."
//
// (i)  Le build réel (catalog/sources, catalog/lexicon, catalog/recipes) produit
//      catalog.db et il contient bien 10 recettes.
// (ii) Sur une fixture temporaire invalide (food inconnu OU mot banni), le build
//      échoue (exit != 0). Les fixtures vivent dans un répertoire temporaire
//      isolé : elles ne touchent jamais aux 10 vraies recettes.

import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..')
const BUILD_SCRIPT = path.join(REPO_ROOT, 'catalog', 'build.mjs')

function runBuild(args: readonly string[]) {
  return spawnSync(process.execPath, ['--experimental-sqlite', BUILD_SCRIPT, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
}

/** Aliment minimal, valide, suffisant pour une recette de fixture. */
const MINIMAL_FOODS_YAML = `
foods:
  - id: fixture_food
    code_ciqual: "PROV-FIXTURE"
    nom: "Aliment de test"
    groupe: "test"
    nutriments:
      energie_kcal: 100
    allergenes: []
`

function writeMinimalFixture(dir: string): void {
  mkdirSync(path.join(dir, 'sources'), { recursive: true })
  mkdirSync(path.join(dir, 'lexicon'), { recursive: true })
  mkdirSync(path.join(dir, 'recipes'), { recursive: true })
  writeFileSync(path.join(dir, 'sources', 'foods.yaml'), MINIMAL_FOODS_YAML, 'utf8')
}

describe('catalog/build.mjs — build réel (10 recettes valides)', () => {
  it('génère catalog.db et le peuple avec les 10 recettes du catalogue', () => {
    const result = runBuild([])

    expect(result.status).toBe(0)

    const dbPath = path.join(REPO_ROOT, 'app', 'public', 'catalog', 'catalog.db')
    const db = new DatabaseSync(dbPath, { readOnly: true })
    try {
      const { count } = db.prepare('SELECT COUNT(*) as count FROM recipe').get() as { count: number }
      expect(count).toBe(10)
    } finally {
      db.close()
    }
  })
})

describe('catalog/build.mjs — fixtures invalides isolées', () => {
  it('échoue (exit != 0) quand une recette référence un aliment inconnu', () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-unknown-food-'))
    try {
      writeMinimalFixture(fixtureDir)
      writeFileSync(
        path.join(fixtureDir, 'recipes', 'invalide.yaml'),
        `
id: recette_invalide
nom: "Recette de test"
description: "Une recette de test pour la validation du build."
temps_prep_min: 5
temps_cuisson_min: 5
difficulte: 1
portions_base: 1
image_path: null
types_repas: [dejeuner]
saison_mois: []
envergure: quotidien
conservation_jours: 1
axes:
  sucre_sale: 0
  leger_consistant: 0
  chaud_froid: 0
  texture: ferme
ingredients:
  - food_id: aliment_qui_nexiste_pas
    quantite_g: 100
    unite_affichage: "100 g"
    optionnel: false
etapes:
  - ordre: 1
    texte: "Préparer l'aliment."
    lexicon_ids: []
    timer_s: null
    timer_type: null
facettes: []
`,
        'utf8'
      )

      const result = runBuild(['--sources', fixtureDir, '--out', path.join(fixtureDir, 'catalog.db')])

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('aliment inconnu')

      // Garde-fou : les 10 vraies recettes restent intactes (fixture isolée).
      const realRecipesDir = path.join(REPO_ROOT, 'catalog', 'recipes')
      const realRecipeFiles = readdirSync(realRecipesDir).filter((f) => f.endsWith('.yaml'))
      expect(realRecipeFiles).toHaveLength(10)
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  it('échoue (exit != 0) quand le lexique banni apparaît dans un champ de contenu', () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-banned-word-'))
    try {
      writeMinimalFixture(fixtureDir)
      writeFileSync(
        path.join(fixtureDir, 'recipes', 'invalide.yaml'),
        `
id: recette_invalide
nom: "Recette de test"
description: "Un aliment sain à ne pas confondre avec un aliment malsain."
temps_prep_min: 5
temps_cuisson_min: 5
difficulte: 1
portions_base: 1
image_path: null
types_repas: [dejeuner]
saison_mois: []
envergure: quotidien
conservation_jours: 1
axes:
  sucre_sale: 0
  leger_consistant: 0
  chaud_froid: 0
  texture: ferme
ingredients:
  - food_id: fixture_food
    quantite_g: 100
    unite_affichage: "100 g"
    optionnel: false
etapes:
  - ordre: 1
    texte: "Préparer l'aliment."
    lexicon_ids: []
    timer_s: null
    timer_type: null
facettes: []
`,
        'utf8'
      )

      const result = runBuild(['--sources', fixtureDir, '--out', path.join(fixtureDir, 'catalog.db')])

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('vocabulaire banni')
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })
})
