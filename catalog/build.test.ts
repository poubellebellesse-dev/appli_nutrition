// Preuve du critère de sortie P0 (docs/ETAT.md §6) :
//   "catalog.db généré depuis les recettes sources ; le build échoue sur une recette invalide."
//
// (i)  Le build réel (catalog/sources, catalog/lexicon, catalog/recipes) produit
//      catalog.db et il contient AUTANT de recettes qu'il y a de fichiers source.
// (ii) Sur une fixture temporaire invalide (food inconnu OU mot banni), le build
//      échoue (exit != 0). Les fixtures vivent dans un répertoire temporaire
//      isolé : elles ne touchent jamais aux vraies recettes.
//
// ⚠️ Le compte attendu est DÉRIVÉ de `catalog/recipes/` (`countRecipeSources`), jamais écrit en
// dur : le catalogue passe de 10 à ~100 recettes (chantier contenu), et une constante figée ferait
// échouer ces tests à chaque recette ajoutée sans rien prouver de plus. Ce qui est vérifié reste le
// vrai invariant — le build ne perd ni n'invente de recette.

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

/** Source de vérité du nombre de recettes : les fichiers de `catalog/recipes/`. Voir l'en-tête. */
export function countRecipeSources(): number {
  return readdirSync(path.join(REPO_ROOT, 'catalog', 'recipes')).filter(
    (f) => f.endsWith('.yaml') || f.endsWith('.yml')
  ).length
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

/**
 * Fiche scientifique minimale et VALIDE. Les tests ci-dessous en dérivent des variantes invalides
 * en ne changeant qu'une chose à la fois — c'est ce qui prouve que le rejet vient bien de ce qu'on
 * a cassé, et pas d'un défaut de la fixture.
 */
const FICHE_VALIDE = `---
code: fixture-fiche
titre: "Une question de test ?"
categorie: nutriments
niveau_preuve: forte
date_revue: 2026-07-31
liens:
  - { cible_type: nutrient, cible_id: fer }
positions:
  - id: position-test
    niveau_preuve: forte
    porte_par: "Autorité de test"
    affirmation: "Une affirmation neutre."
    detail: "Le détail de la position."
    sources: [source-test]
sources:
  - id: source-test
    titre_etude: "Étude de test"
    auteurs: "Test T"
    annee: 2020
    revue: "Revue de test 1(1):1-2"
    doi: "10.1000/test"
    url: "https://example.org/test"
    type_etude: meta_analyse
    effectif: null
    consulte_le: 2026-07-31
---

Le résumé vulgarisé de test.
`

function writeEvidenceFixture(dir: string, contenu: string, nom = 'fixture-fiche.md'): void {
  mkdirSync(path.join(dir, 'evidence'), { recursive: true })
  writeFileSync(path.join(dir, 'evidence', nom), contenu, 'utf8')
}

/**
 * Tip minimal et VALIDE (§8.4). Même principe que `FICHE_VALIDE` : les rejets ci-dessous en
 * dérivent en ne cassant qu'un champ à la fois.
 */
const TIP_VALIDE = `code: fixture-tip
categorie: biologie_aliment
texte: "Un fait vérifiable et neutre."
source_url: "https://example.org/tip"
`

function writeTipFixture(dir: string, contenu: string, nom = 'fixture-tip.yaml'): void {
  mkdirSync(path.join(dir, 'tips'), { recursive: true })
  writeFileSync(path.join(dir, 'tips', nom), contenu, 'utf8')
}

describe('catalog/build.mjs — build réel (recettes sources valides)', () => {
  // ⚠️ SORTIE ISOLÉE, ALORS QUE LES SOURCES SONT LES VRAIES. Ce test écrivait dans
  // `app/public/catalog/catalog.db` — le fichier que `app/src/ui/test-socle.ts` OUVRE EN LECTURE
  // pour tous les tests d'écran. Or `build.mjs` supprime la sortie avant de la recréer : vitest
  // exécutant les fichiers en parallèle, un test d'écran qui appelait `catalogueDeTest()` pendant
  // cette fenêtre trouvait un fichier absent ou à moitié écrit et échouait. Flaky rare, d'autant
  // plus probable que le build s'allonge (73 tips, 8 fiches).
  //
  // Rediriger la sortie supprime la course sans rien perdre : les sources restent les vraies, et
  // l'existence du catalogue livré est vérifiée juste après, SANS le réécrire.
  it('génère catalog.db et le peuple avec TOUTES les recettes sources, sans en perdre ni en inventer', () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-build-reel-'))
    const dbPath = path.join(fixtureDir, 'catalog.db')
    try {
      const result = runBuild(['--out', dbPath])
      expect(result.status).toBe(0)

      const db = new DatabaseSync(dbPath, { readOnly: true })
      try {
        const { count } = db.prepare('SELECT COUNT(*) as count FROM recipe').get() as { count: number }
        expect(count).toBe(countRecipeSources())
        expect(count).toBeGreaterThanOrEqual(10) // critère P0 : au moins les 10 recettes d'amorçage
      } finally {
        db.close()
      }
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  it('le catalogue livré existe à son emplacement par défaut', () => {
    // Garantie conservée du test précédent, désormais en LECTURE SEULE : `app/public/catalog/` est
    // ce que sert la PWA et ce que lisent les tests d'écran. Si ce fichier manque, `npm run build`.
    const livre = path.join(REPO_ROOT, 'app', 'public', 'catalog', 'catalog.db')
    const db = new DatabaseSync(livre, { readOnly: true })
    try {
      const { count } = db.prepare('SELECT COUNT(*) as count FROM recipe').get() as { count: number }
      expect(count).toBeGreaterThanOrEqual(10)
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
origine: maison
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

      // Garde-fou : les vraies recettes restent intactes (la fixture vit dans un tmpdir isolé).
      // Ce qui compte ici est qu'AUCUNE n'ait été touchée, pas leur nombre exact — d'où la
      // comparaison au compte source plutôt qu'à une constante (voir l'en-tête de fichier).
      const realRecipesDir = path.join(REPO_ROOT, 'catalog', 'recipes')
      const realRecipeFiles = readdirSync(realRecipesDir).filter((f) => f.endsWith('.yaml'))
      expect(realRecipeFiles).toHaveLength(countRecipeSources())
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
origine: maison
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

  // Le NOM de la facette était vérifié depuis P0, sa VALEUR jamais : `italienen` entrait en base
  // sans un mot, puis ressortait en pastille de filtre (les valeurs sont dérivées du catalogue) et
  // sans drapeau — indiscernable des 7 zones qui n'en ont volontairement pas.
  it('échoue (exit != 0) sur une cuisine hors du vocabulaire fermé', () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-unknown-cuisine-'))
    try {
      writeMinimalFixture(fixtureDir)
      writeFileSync(
        path.join(fixtureDir, 'recipes', 'invalide.yaml'),
        `
id: recette_invalide
nom: "Recette de test"
origine: maison
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
facettes:
  - facette: cuisine
    valeur: italienen
`,
        'utf8'
      )

      const result = runBuild(['--sources', fixtureDir, '--out', path.join(fixtureDir, 'catalog.db')])

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain("cuisine inconnue 'italienen'")
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  // Le bloc `sources` est OPTIONNEL — son absence dit « recette ni importée ni vérifiée », ce qui
  // est le cas des 241. Mais dès qu'il est présent il doit être COMPLET : une source à demi
  // renseignée a l'apparence d'une garantie sans en être une, et une `provenance` sans licence ni
  // auteur rend le crédit inaffichable alors qu'elle emprunte le travail de quelqu'un.
  it('échoue (exit != 0) sur une provenance sans licence ni auteur', () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-source-incomplete-'))
    try {
      writeMinimalFixture(fixtureDir)
      writeFileSync(
        path.join(fixtureDir, 'recipes', 'invalide.yaml'),
        `
id: recette_invalide
nom: "Recette de test"
origine: libre
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
sources:
  - type: provenance
    titre: "Une recette empruntée"
    url: "https://cuisine-libre.org/recette"
    consulte_le: "2026-08-02"
`,
        'utf8'
      )

      const result = runBuild(['--sources', fixtureDir, '--out', path.join(fixtureDir, 'catalog.db')])

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('provenance sans licence')
      expect(result.stderr).toContain('provenance sans auteur')
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  it('échoue (exit != 0) sur une source sans date de consultation vérifiée', () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-source-nodate-'))
    try {
      writeMinimalFixture(fixtureDir)
      writeFileSync(
        path.join(fixtureDir, 'recipes', 'invalide.yaml'),
        `
id: recette_invalide
nom: "Recette de test"
origine: maison
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
sources:
  - type: reference
    titre: "Une référence jamais ouverte"
    url: "https://example.org/reference"
`,
        'utf8'
      )

      const result = runBuild(['--sources', fixtureDir, '--out', path.join(fixtureDir, 'catalog.db')])

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('consulte_le')
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })
})

// `origine` (docs/SOURCES_RECETTES.md) : d'où vient le TEXTE de la recette — obligatoire,
// vocabulaire fermé, et cohérent avec les sources `provenance` de la recette.
describe('catalog/build.mjs — origine des recettes et liste blanche de domaines', () => {
  /** Recette minimale et VALIDE (`origine: maison`, sans sources) — les tests ci-dessous en
   *  dérivent en ne cassant qu'un champ à la fois, comme `FICHE_VALIDE` / `TIP_VALIDE`. */
  function recetteYaml(corps: string): string {
    return `
id: recette_invalide
nom: "Recette de test"
${corps}
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
`
  }

  it('échoue (exit != 0) sur une recette sans origine', () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-origine-absente-'))
    try {
      writeMinimalFixture(fixtureDir)
      writeFileSync(path.join(fixtureDir, 'recipes', 'invalide.yaml'), recetteYaml(''), 'utf8')

      const result = runBuild(['--sources', fixtureDir, '--out', path.join(fixtureDir, 'catalog.db')])

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('origine')
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  it('échoue (exit != 0) sur une origine hors du vocabulaire fermé', () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-origine-inconnue-'))
    try {
      writeMinimalFixture(fixtureDir)
      writeFileSync(path.join(fixtureDir, 'recipes', 'invalide.yaml'), recetteYaml('origine: importee'), 'utf8')

      const result = runBuild(['--sources', fixtureDir, '--out', path.join(fixtureDir, 'catalog.db')])

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain("origine 'importee' inconnue")
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  it('échoue (exit != 0) sur une origine « maison » portant une source « provenance »', () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-maison-provenance-'))
    try {
      writeMinimalFixture(fixtureDir)
      writeFileSync(
        path.join(fixtureDir, 'recipes', 'invalide.yaml'),
        recetteYaml(`origine: maison
sources:
  - type: provenance
    titre: "Une recette empruntée"
    url: "https://cuisine-libre.org/recette"
    consulte_le: "2026-08-02"
    licence: "CC0"
    auteur: "Un auteur"`),
        'utf8'
      )

      const result = runBuild(['--sources', fixtureDir, '--out', path.join(fixtureDir, 'catalog.db')])

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain("origine 'maison' ne peut pas porter de source 'provenance'")
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  it('échoue (exit != 0) sur une origine « libre » sans aucune source « provenance »', () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-libre-sans-provenance-'))
    try {
      writeMinimalFixture(fixtureDir)
      writeFileSync(path.join(fixtureDir, 'recipes', 'invalide.yaml'), recetteYaml('origine: libre'), 'utf8')

      const result = runBuild(['--sources', fixtureDir, '--out', path.join(fixtureDir, 'catalog.db')])

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain("origine 'libre' exige au moins une source 'provenance'")
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  it('échoue (exit != 0) sur une URL de source hors liste blanche', () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-domaine-refuse-'))
    try {
      writeMinimalFixture(fixtureDir)
      writeFileSync(
        path.join(fixtureDir, 'recipes', 'invalide.yaml'),
        recetteYaml(`origine: maison
sources:
  - type: reference
    titre: "Un blog culinaire"
    url: "https://un-blog-de-cuisine.example/recette"
    consulte_le: "2026-08-02"`),
        'utf8'
      )

      const result = runBuild(['--sources', fixtureDir, '--out', path.join(fixtureDir, 'catalog.db')])

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain("domaine 'un-blog-de-cuisine.example' hors liste blanche")
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  it('accepte une URL sur un sous-domaine d’un domaine autorisé', () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-sous-domaine-autorise-'))
    try {
      writeMinimalFixture(fixtureDir)
      writeFileSync(
        path.join(fixtureDir, 'recipes', 'invalide.yaml'),
        recetteYaml(`origine: maison
sources:
  - type: reference
    titre: "Guide officiel"
    url: "https://agriculture.gouv.fr/recette"
    consulte_le: "2026-08-02"`),
        'utf8'
      )

      const result = runBuild(['--sources', fixtureDir, '--out', path.join(fixtureDir, 'catalog.db')])

      expect(result.status).toBe(0)
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  it('échoue (exit != 0) sur une origine « domaine_public » sans aucune source « provenance »', () => {
    // Même condition que le test « libre » ci-dessus, mais l'autre branche du `||` (voir
    // validateCatalog) : un futur refactor pourrait casser l'une sans casser l'autre.
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-domaine-public-sans-provenance-'))
    try {
      writeMinimalFixture(fixtureDir)
      writeFileSync(path.join(fixtureDir, 'recipes', 'invalide.yaml'), recetteYaml('origine: domaine_public'), 'utf8')

      const result = runBuild(['--sources', fixtureDir, '--out', path.join(fixtureDir, 'catalog.db')])

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain("origine 'domaine_public' exige au moins une source 'provenance'")
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  // Garde-fou anti-reprise de contenu de blog (§6 SOURCES_RECETTES.md) : le point le plus sensible
  // de la validation. Chaque cas de rejet vérifie le MESSAGE, pas seulement le code de sortie — une
  // assertion qui ne regarde que `status !== 0` passerait même si la liste blanche rejetait pour la
  // mauvaise raison (ex. `titre` vide au lieu du domaine). Le domaine est ici la SEULE chose fautive :
  // origine, type de source et date de consultation restent valides.
  it.each([
    { url: 'https://evil.com/?x=gouv.fr', hostname: 'evil.com' },
    { url: 'https://notgouv.fr/x', hostname: 'notgouv.fr' },
    { url: 'https://gouv.fr.evil.com/x', hostname: 'gouv.fr.evil.com' },
    { url: 'https://evil.com/gouv.fr', hostname: 'evil.com' },
  ])('refuse $url (domaine hors liste, pas de contournement par la chaîne)', ({ url, hostname }) => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-domaine-contournement-'))
    try {
      writeMinimalFixture(fixtureDir)
      writeFileSync(
        path.join(fixtureDir, 'recipes', 'invalide.yaml'),
        recetteYaml(`origine: maison
sources:
  - type: reference
    titre: "Une source"
    url: "${url}"
    consulte_le: "2026-08-02"`),
        'utf8'
      )

      const result = runBuild(['--sources', fixtureDir, '--out', path.join(fixtureDir, 'catalog.db')])

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain(`domaine '${hostname}' hors liste blanche`)
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  it.each([
    'https://agriculture.gouv.fr/x',
    'https://www.gov.uk/x',
    'https://fr.wikisource.org/x',
  ])('accepte %s', (url) => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-domaine-accepte-'))
    try {
      writeMinimalFixture(fixtureDir)
      writeFileSync(
        path.join(fixtureDir, 'recipes', 'invalide.yaml'),
        recetteYaml(`origine: maison
sources:
  - type: reference
    titre: "Une source"
    url: "${url}"
    consulte_le: "2026-08-02"`),
        'utf8'
      )

      const result = runBuild(['--sources', fixtureDir, '--out', path.join(fixtureDir, 'catalog.db')])

      expect(result.status).toBe(0)
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

// ---------------------------------------------------------------------------------------------
// Fiches scientifiques (§8.2 ARCHITECTURE, §4.7 DESIGN)
//
// ⚠️ CE BLOC PROTÈGE UNE PROPRIÉTÉ DE SÉCURITÉ, pas un format. §4.2 fait de la présence d'une
// source une contrainte STRUCTURELLE sur tout critère de santé ; le même raisonnement vaut pour
// une position affichée. Ces tests vérifient qu'une affirmation non sourcée, mal sourcée ou
// jugeante ne peut PAS atteindre catalog.db — le build échoue avant.
// ---------------------------------------------------------------------------------------------

describe('catalog/build.mjs — fiches scientifiques', () => {
  it('écrit une fiche valide, ses positions, ses sources et leur jonction', () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-evidence-ok-'))
    try {
      writeMinimalFixture(fixtureDir)
      writeEvidenceFixture(fixtureDir, FICHE_VALIDE)
      const dbPath = path.join(fixtureDir, 'catalog.db')

      const result = runBuild(['--sources', fixtureDir, '--out', dbPath])
      expect(result.status).toBe(0)

      const db = new DatabaseSync(dbPath)
      try {
        const fiche = db.prepare('SELECT * FROM evidence_sheet').get() as Record<string, unknown>
        expect(fiche.code).toBe('fixture-fiche')
        expect(fiche.titre).toBe('Une question de test ?')
        expect(fiche.resume_vulgarise).toBe('Le résumé vulgarisé de test.')

        const position = db.prepare('SELECT * FROM evidence_position').get() as Record<string, unknown>
        expect(position.ordre).toBe(0)
        expect(position.porte_par).toBe('Autorité de test')

        // La jonction est ce qui rend une affirmation vérifiable : sans elle, la position et la
        // source coexisteraient en base sans qu'on sache laquelle appuie laquelle.
        const jonction = db
          .prepare('SELECT * FROM evidence_position_source')
          .all() as readonly Record<string, unknown>[]
        expect(jonction).toHaveLength(1)
        expect(jonction[0]?.source_code).toBe('source-test')

        const lien = db.prepare('SELECT * FROM evidence_link').get() as Record<string, unknown>
        expect(lien.cible_type).toBe('nutrient')
        expect(lien.cible_id).toBe('fer')
      } finally {
        db.close()
      }
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  it('ÉCHOUE quand une position ne cite aucune source', () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-evidence-nosrc-'))
    try {
      writeMinimalFixture(fixtureDir)
      writeEvidenceFixture(fixtureDir, FICHE_VALIDE.replace('sources: [source-test]', 'sources: []'))

      const result = runBuild(['--sources', fixtureDir, '--out', path.join(fixtureDir, 'catalog.db')])
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('aucune source')
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  it('ÉCHOUE quand une position cite une source qui n’existe pas', () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-evidence-badsrc-'))
    try {
      writeMinimalFixture(fixtureDir)
      writeEvidenceFixture(fixtureDir, FICHE_VALIDE.replace('sources: [source-test]', 'sources: [fantome]'))

      const result = runBuild(['--sources', fixtureDir, '--out', path.join(fixtureDir, 'catalog.db')])
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('source inconnue')
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  it('ÉCHOUE quand le vocabulaire banni apparaît dans le détail d’une position', () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-evidence-banned-'))
    try {
      writeMinimalFixture(fixtureDir)
      writeEvidenceFixture(
        fixtureDir,
        FICHE_VALIDE.replace('Le détail de la position.', 'Cet aliment est mauvais pour la santé.')
      )

      const result = runBuild(['--sources', fixtureDir, '--out', path.join(fixtureDir, 'catalog.db')])
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('vocabulaire banni')
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  it('ÉCHOUE quand le titre n’est pas une question (§4.7)', () => {
    // Un titre affirmatif annoncerait la conclusion avant de l'exposer — la posture que le produit
    // refuse. La contrainte est tenue par le build, pas par la relecture.
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-evidence-titre-'))
    try {
      writeMinimalFixture(fixtureDir)
      writeEvidenceFixture(
        fixtureDir,
        FICHE_VALIDE.replace('titre: "Une question de test ?"', 'titre: "Le fer est important."')
      )

      const result = runBuild(['--sources', fixtureDir, '--out', path.join(fixtureDir, 'catalog.db')])
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain("n'est pas une question")
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  it('ÉCHOUE quand un lien vise un aliment absent du catalogue', () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-evidence-lien-'))
    try {
      writeMinimalFixture(fixtureDir)
      writeEvidenceFixture(
        fixtureDir,
        FICHE_VALIDE.replace(
          '{ cible_type: nutrient, cible_id: fer }',
          '{ cible_type: food, cible_id: aliment_qui_nexiste_pas }'
        )
      )

      const result = runBuild(['--sources', fixtureDir, '--out', path.join(fixtureDir, 'catalog.db')])
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('absent du catalogue')
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

})

// Ces trois tests tiennent une promesse produit, pas une contrainte technique : « Le saviez-vous ? »
// affiche des affirmations courtes, isolées et très recopiables. Sans source vérifiable, elles sont
// indiscernables d'une rumeur bien tournée. Le build est le seul endroit où la règle tient toute
// seule — une relecture, on l'oublie.
describe('catalog/build.mjs — tips : la source est obligatoire (§4.2, §8.4)', () => {
  it('écrit source_url dans la table tip, relisible depuis la base', () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-tip-'))
    const dbPath = path.join(fixtureDir, 'catalog.db')
    try {
      writeMinimalFixture(fixtureDir)
      writeTipFixture(fixtureDir, TIP_VALIDE)

      const result = runBuild(['--sources', fixtureDir, '--out', dbPath])
      expect(result.status).toBe(0)

      const db = new DatabaseSync(dbPath, { readOnly: true })
      try {
        const row = db.prepare('SELECT code, source_url FROM tip').get() as {
          code: string
          source_url: string
        }
        expect(row.code).toBe('fixture-tip')
        expect(row.source_url).toBe('https://example.org/tip')
      } finally {
        db.close()
      }
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  it('ÉCHOUE quand un tip n’a pas de source', () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-tip-sans-source-'))
    try {
      writeMinimalFixture(fixtureDir)
      writeTipFixture(fixtureDir, TIP_VALIDE.replace(/source_url:.*\n/, ''))

      const result = runBuild(['--sources', fixtureDir, '--out', path.join(fixtureDir, 'catalog.db')])
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('source_url manquante')
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  it('ÉCHOUE quand la source d’un tip n’est pas une URL http(s)', () => {
    // Un DOI nu, un titre d'ouvrage ou un « voir ANSES » ne sont pas cliquables : l'utilisateur ne
    // peut pas vérifier, et la promesse de traçabilité devient décorative.
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-fixture-tip-url-'))
    try {
      writeMinimalFixture(fixtureDir)
      writeTipFixture(fixtureDir, TIP_VALIDE.replace('https://example.org/tip', '10.1000/test'))

      const result = runBuild(['--sources', fixtureDir, '--out', path.join(fixtureDir, 'catalog.db')])
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('URL http(s)')
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })
})
