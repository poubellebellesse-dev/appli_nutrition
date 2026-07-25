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

/** Écrit une fixture foods.yaml isolée avec un seul aliment personnalisé (P1b-1 : saisonnalité). */
function writeFoodsFixture(dir: string, foodYamlBody: string): void {
  mkdirSync(path.join(dir, 'sources'), { recursive: true })
  mkdirSync(path.join(dir, 'lexicon'), { recursive: true })
  mkdirSync(path.join(dir, 'recipes'), { recursive: true })
  writeFileSync(path.join(dir, 'sources', 'foods.yaml'), `foods:\n${foodYamlBody}`, 'utf8')
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

  // Décision utilisateur du jour : `nutrient.sens` pilote l'asymétrie de `scoreNutri`
  // (docs/ENGINE.md §6.5) — round-trip écrite → relue depuis la base, sur les 9 nutriments réels.
  // Build isolé (fixture temporaire dédiée) plutôt que de dépendre du build du test précédent :
  // chaque test de ce fichier reste indépendant de l'ordre d'exécution des autres.
  it('écrit sens dans nutrient, relisible depuis la base — sodium plafond, fer plancher', () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-sens-'))
    const dbPath = path.join(fixtureDir, 'catalog.db')
    try {
      const result = runBuild(['--out', dbPath])
      expect(result.status).toBe(0)

      const db = new DatabaseSync(dbPath, { readOnly: true })
      try {
        const rows = db.prepare('SELECT id, sens FROM nutrient').all() as { id: string; sens: string }[]
        expect(rows).toHaveLength(9)
        for (const row of rows) {
          expect(['cible', 'plancher', 'plafond']).toContain(row.sens)
        }

        const sensById = new Map(rows.map((r) => [r.id, r.sens]))
        expect(sensById.get('sodium')).toBe('plafond')
        expect(sensById.get('fer')).toBe('plancher')
      } finally {
        db.close()
      }
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
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

// P1b-1 : saisonnalité (`saison_mois`) et flag staple (`toute_annee`) sur `food`
// (docs/ARCHITECTURE.md §4.2, docs/ENGINE.md §6.5 précision 3).
describe('catalog/build.mjs — saisonnalité des aliments (P1b-1)', () => {
  it('écrit saison_mois et toute_annee dans food, relisibles depuis la base', () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-season-ok-'))
    try {
      writeFoodsFixture(
        fixtureDir,
        `
  - id: fixture_seasonal
    code_ciqual: "PROV-FIXTURE"
    nom: "Aliment saisonnier de test"
    groupe: "test"
    nutriments:
      energie_kcal: 100
    allergenes: []
    saison_mois: [6, 7, 8]
    toute_annee: false
  - id: fixture_staple
    code_ciqual: "PROV-FIXTURE-2"
    nom: "Aliment toute l'année de test"
    groupe: "test"
    nutriments:
      energie_kcal: 100
    allergenes: []
    toute_annee: true
  - id: fixture_unset
    code_ciqual: "PROV-FIXTURE-3"
    nom: "Aliment sans saisonnalité renseignée"
    groupe: "test"
    nutriments:
      energie_kcal: 100
    allergenes: []
`
      )

      const dbPath = path.join(fixtureDir, 'catalog.db')
      const result = runBuild(['--sources', fixtureDir, '--out', dbPath])
      expect(result.status).toBe(0)

      const db = new DatabaseSync(dbPath, { readOnly: true })
      try {
        const seasonal = db
          .prepare('SELECT saison_mois, toute_annee FROM food WHERE id = ?')
          .get('fixture_seasonal') as { saison_mois: string; toute_annee: number }
        expect(JSON.parse(seasonal.saison_mois)).toEqual([6, 7, 8])
        expect(seasonal.toute_annee).toBe(0)

        const staple = db
          .prepare('SELECT saison_mois, toute_annee FROM food WHERE id = ?')
          .get('fixture_staple') as { saison_mois: string; toute_annee: number }
        expect(JSON.parse(staple.saison_mois)).toEqual([])
        expect(staple.toute_annee).toBe(1)

        // Ni saison_mois ni toute_annee renseignés → défaut neutre ([] / false), pas une erreur.
        const unset = db
          .prepare('SELECT saison_mois, toute_annee FROM food WHERE id = ?')
          .get('fixture_unset') as { saison_mois: string; toute_annee: number }
        expect(JSON.parse(unset.saison_mois)).toEqual([])
        expect(unset.toute_annee).toBe(0)
      } finally {
        db.close()
      }
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  it.each([
    ['0 (hors plage)', '[0]'],
    ['13 (hors plage)', '[13]'],
    ['6.5 (non entier)', '[6.5]'],
  ])('échoue (exit != 0) sur un mois invalide : %s', (_label, monthsLiteral) => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-season-invalid-'))
    try {
      writeFoodsFixture(
        fixtureDir,
        `
  - id: fixture_bad_month
    code_ciqual: "PROV-FIXTURE"
    nom: "Aliment de test"
    groupe: "test"
    nutriments:
      energie_kcal: 100
    allergenes: []
    saison_mois: ${monthsLiteral}
`
      )

      const result = runBuild(['--sources', fixtureDir, '--out', path.join(fixtureDir, 'catalog.db')])

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('fixture_bad_month')
      expect(result.stderr).toContain('saison_mois')
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  // `toute_annee` (disponibilité) et `saison_mois` (pleine saison) sont deux dimensions
  // INDÉPENDANTES : un légume de garde porte légitimement les deux. Le build doit l'accepter.
  it('accepte le double marquage toute_annee + saison_mois (légume de garde)', () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-season-both-'))
    try {
      writeFoodsFixture(
        fixtureDir,
        `
  - id: fixture_garde
    code_ciqual: "PROV-FIXTURE"
    nom: "Légume de garde de test"
    groupe: "test"
    nutriments:
      energie_kcal: 100
    allergenes: []
    saison_mois: [9, 10, 11, 12, 1, 2, 3, 4]
    toute_annee: true
`
      )

      const dbPath = path.join(fixtureDir, 'catalog.db')
      const result = runBuild(['--sources', fixtureDir, '--out', dbPath])
      expect(result.status).toBe(0)

      const db = new DatabaseSync(dbPath, { readOnly: true })
      try {
        const garde = db
          .prepare('SELECT saison_mois, toute_annee FROM food WHERE id = ?')
          .get('fixture_garde') as { saison_mois: string; toute_annee: number }
        expect(JSON.parse(garde.saison_mois)).toEqual([9, 10, 11, 12, 1, 2, 3, 4])
        expect(garde.toute_annee).toBe(1)
      } finally {
        db.close()
      }
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })
})
