// tests/scelles/retour-5.test.ts — l'examen du lot `retour-5` : « le riz nature entre au
// catalogue, et il ne fait pas un dîner ».
//
// Plan et « Fini quand » : `docs/CONCEPTION_RETOURS_TEST.md` § « Lot `retour-5` ». Les neuf
// clauses ci-dessous en sont la transcription, dans l'ordre, une par `it`.
//
// ⛔ IL DOIT ÊTRE ROUGE LE JOUR OÙ ON L'ÉCRIT — et il ne l'est pas partout, ce qui est dit ici
// plutôt que caché. Aujourd'hui : la colonne `est_plat_simple` n'existe pas, aucune des neuf bases
// nues n'existe (les 40 accompagnements du catalogue sont TOUS assaisonnés, le plus nu portant
// 4 ingrédients), et `catalog/build.mjs` ignore purement et simplement une clé qu'il ne connaît
// pas. **Les clauses 1 à 5 échouent, la moitié 6b avec elles, et la clause 11 aussi.** Les clauses
// 6a, 7, 8, 9 et 10 passent déjà : ce sont des gardes de non-régression, elles disent ce que le lot
// n'a PAS le droit de casser, et elles sont annoncées comme telles au lieu d'être présentées comme
// des preuves.
//
// ---------------------------------------------------------------------------------------------
// ⛔ CE QU'UN CRITIQUE ATTAQUERAIT EN PREMIER, ET CE QUI A ÉTÉ FAIT CONTRE.
//
//   • « Neuf coquilles vides passeraient la clause 2. » — Elles ne passent pas : chacune des neuf
//     doit porter SON aliment de base parmi ses ingrédients (`riz_blanc` pour `riz_blanc_nature`,
//     et ainsi de suite). Un lot de neuf fichiers copiés-collés meurt là.
//
//   • « Une clause "aucun créneau porté par un plat simple seul" posée sur le cas NOMINAL passerait
//     aujourd'hui, sans une ligne de code. » — Exact, et c'est pourquoi elle n'y est pas. MESURÉ le
//     2026-08-26 sur le catalogue réel : sur 20 graines × 7 jours × 4 configurations, le pis-aller
//     de `pickForSlot` ne se déclenche JAMAIS (0 créneau principal porté par autre chose qu'un
//     `plat`), et les 420 créneaux sont remplis dans les quatre. La clause 6 est donc posée sur la
//     SEULE configuration mesurée où le pis-aller tombe pour de bon : 22 aliments exclus, qui ne
//     laissent survivre AUCUN accompagnement et remplissent 10 créneaux sur 14.
//
//   • « La liste des 22 exclus a été choisie pour arranger le test. » — Elle a été choisie pour
//     l'inverse : elle épargne délibérément `sel_fin`, `riz_blanc`, `pomme_de_terre` et les autres
//     bases. Exclure simplement les 20 aliments les plus fréquents des plats tuait AUSSI les neuf
//     plats simples — et la clause 6 devenait vide.
//
//   • « Sceller le plan à la recette. » — Non, et c'est la leçon du `retour-4`, payée : ajouter
//     neuf recettes déplace la fenêtre du MMR. L'identité des dix créneaux remplis, ou celle des
//     quatre trous, rendrait la clause fausse POUR UNE IMPLÉMENTATION JUSTE. On scelle un COMPTE
//     et une INTERDICTION, ce qui borne les plats simples sans figer le plan.
//
//   • « La clause 6a est verte aujourd'hui, elle ne prouve donc rien. » — Elle est verte, c'est
//     écrit, et ce n'est pas le code d'aujourd'hui qu'elle juge : c'est celui de demain. Une
//     implémentation SANS interdiction remplit 14/14 sur cette configuration — le pis-aller
//     attrape les neuf bases — et `toBe(10)` tombe. C'est la seule clause du fichier qui tue cette
//     implémentation-là.
//
//   • « `toBe(10)` est trop serré, une implémentation juste pourrait rendre 9 ou 11. » — Non, et
//     c'est structurel : sous les 22 exclusions, `suggestMeals` rend 10 recettes au déjeuner et 3
//     au dîner. Sept déjeuners tirent dans dix, trois dîners sur trois : 7 + 3 = 10, et les quatre
//     trous sont les quatre derniers dîners. Écarter les plats simples AVANT le classement ne
//     touche ni l'un ni l'autre de ces viviers. ⛔ Mais les écarter APRÈS le classement, oui : les
//     neuf recettes mangent alors le budget borné de la demande (`limit`), moins de sept déjeuners
//     restent visibles, et le compte DESCEND sous 10. `toBe` et non `toBeGreaterThanOrEqual`, pour
//     que ce piège-là tombe.
//
//   • « Le build peut refuser pour une autre raison que celle qu'on croit. » — Chaque forme fausse
//     de la clause 4 est dérivée d'un TÉMOIN VALIDE, construit et bâti dans le même test, dont on
//     vérifie qu'il sort en 0. Un rejet ne peut donc pas venir de la fixture elle-même.
//
//   • « L'interdiction va rouvrir les trous du 2026-08-03 : le végétalien 14 j retombé de 42/42
//     à 32/42. » — Ce chiffre-là mesurait l'interdiction appliquée à TOUS les accompagnements.
//     Ici elle ne vise que neuf recettes QUI N'EXISTENT PAS ENCORE : elle ne peut retirer aucun
//     créneau rempli aujourd'hui. La clause 9 le garde par la mesure — 420/420 dans les quatre
//     configurations, et 20/20 au banc.
//
//   • « La clause 6b passerait à vide : zéro plat simple posé, donc zéro contre-exemple. » — Elle
//     ne peut pas : elle EXIGE d'abord au moins une pose, et c'est pour cela qu'elle est rouge
//     aujourd'hui. Une implémentation qui déclarerait les neuf recettes sans jamais les rendre
//     atteignables tombe sur cette moitié-là.
//
//   • « Il suffit de corriger `plan-week.ts`. » — Non, et c'est la clause 10. « Changer » passe par
//     `rerollSlot`, qui reconstruit sa propre requête et ne filtre AUCUN service. La clause épuise
//     le vivier pour de vrai : sous les 22 exclusions, sur 2 jours de déjeuners, elle refuse le plat
//     proposé encore et encore. MESURÉ aujourd'hui : **9 rerolls rendent un plat, le 10ᵉ rend un
//     créneau VIDE** — il n'y a plus rien. Après le lot, ce 10ᵉ tirage a neuf bases nues sous la
//     main : une implémentation qui n'aurait corrigé que le planificateur pose le riz nature SEUL,
//     et la clause tombe. ⚠️ Seul le PLAT refusé s'accumule dans les refus, jamais l'accompagnement
//     — sans quoi les neuf bases se videraient d'elles-mêmes et le piège s'auto-désamorcerait.
//
//   • « L'interdiction peut se brancher sur les identifiants : ils finissent tous par `_nature` ou
//     `_vapeur`. » — Une regex passerait toutes les autres clauses. La clause 11 la tue : elle
//     recopie le catalogue en RETIRANT l'étiquette aux neuf (le champ à `false`, les identifiants
//     intacts), rebâtit un moteur, et exige que le compte DÉPASSE 10. Une implémentation branchée
//     sur les identifiants rendrait toujours 10 ; seule celle qui lit le champ remonte.
//
// ---------------------------------------------------------------------------------------------
// ⚠️ COLONNE ET CHAMP PAS ENCORE ÉCRITS = LECTURE SQL DÉFENSIVE ET ACCÈS TYPÉ PAR CAST. Un
// `SELECT est_plat_simple` sur une table qui ne l'a pas lève une erreur SQLite qui masquerait la
// vraie clause, et un accès statique à `recipe.estPlatSimple` casserait `npm run typecheck` pour
// tout l'arbre avant même que le lot commence.
//
// ⚠️ BUILD VERS UN FICHIER ISOLÉ, SOURCES RÉELLES. `catalog/build.test.ts` reconstruit un
// `catalog.db` en parallèle, et deux builds concurrents vers la même sortie se corrompent. Les
// sources, elles, sont les vraies : ce fichier ne juge JAMAIS sur une fixture qui redirait ce
// qu'on veut lire.

import { beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { COURSE_ORDER } from '../../app/src/engine/domain/index.js'
import type {
  AllergenId,
  Catalog,
  CourseKind,
  DietCode,
  FoodId,
  MealSlot,
  Recipe,
  RecipeId,
  UserProfile,
  WeekPlan,
  WeekPlanRequest,
} from '../../app/src/engine/domain/index.js'
import { createEngine, type Engine } from '../../app/src/engine/api/index.js'
import { loadCatalog } from '../../app/src/data/catalog-loader-node.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..', '..')
const BUILD_SCRIPT = path.join(REPO_ROOT, 'catalog', 'build.mjs')
const TSX_CLI = path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const STRESS_SCRIPT = path.join(REPO_ROOT, 'app', 'src', 'cli', 'stress-planning.ts')

/**
 * Les neuf bases nues du lot, et l'aliment auquel chacune doit tenir. La seconde colonne est ce
 * qui rend la clause 2 non contournable : neuf recettes vides portant les bons identifiants ne
 * suffisent pas.
 */
const NEUF_BASES: ReadonlyArray<readonly [string, string]> = [
  ['riz_blanc_nature', 'riz_blanc'],
  ['riz_complet_nature', 'riz_complet'],
  ['pates_nature', 'pates_spaghetti'],
  ['semoule_nature', 'semoule_ble'],
  ['boulgour_nature', 'boulgour'],
  ['quinoa_nature', 'quinoa'],
  ['polenta_nature', 'polenta'],
  ['pommes_de_terre_vapeur', 'pomme_de_terre'],
  ['lentilles_vertes_nature', 'lentilles_vertes'],
]
const IDS_DES_NEUF: ReadonlySet<string> = new Set(NEUF_BASES.map(([id]) => id))

/** Le catalogue passe de 330 à 339 recettes. Le témoin d'avant est daté du 2026-08-26. */
const RECETTES_AVANT = 330
const RECETTES_APRES = RECETTES_AVANT + NEUF_BASES.length

/**
 * La configuration d'exclusion de la clause 6 — la SEULE mesurée où le pis-aller de `pickForSlot`
 * se déclenche. 22 aliments très fréquents dans les plats, choisis pour ne toucher NI `sel_fin`,
 * NI `riz_blanc`, NI `pomme_de_terre`, NI aucune des neuf bases : sans cette précaution les plats
 * simples mourraient avec les plats et la clause ne prouverait rien.
 *
 * Mesuré le 2026-08-26 sur le catalogue réel : 0 accompagnement survit, 10 créneaux sur 14 sont
 * remplis, dont 7 par un fromage, une entrée ou un dessert.
 */
const VINGT_DEUX_EXCLUS = [
  'oignon', 'ail', 'citron', 'beurre_doux', 'tomate', 'oeuf', 'creme_fraiche', 'carotte',
  'echalote', 'poivron_rouge', 'thym_seche', 'farine_ble', 'vin_blanc_cuisine', 'huile_olive',
  'persil', 'poivre_noir', 'courgette', 'champignon_paris', 'lait_demi_ecreme', 'laurier',
  'concentre_tomate', 'gingembre_poudre',
] as unknown as readonly FoodId[]

/** Le profil du banc `stress-planning.ts`, pour que les nombres scellés soient ceux qui ont été mesurés. */
const FEMME: UserProfile = {
  trancheAge: '30_49',
  sexe: 'F',
  niveauActivite: 'actif',
  tailleCm: 165,
  poidsKg: 62,
  facteurPortion: 1,
}

const TROIS_CRENEAUX = ['petit_dejeuner', 'dejeuner', 'diner'] as readonly MealSlot[]
const DEUX_CRENEAUX = ['dejeuner', 'diner'] as readonly MealSlot[]

function demande(options: {
  seed: number
  diet?: DietCode | null
  allergies?: readonly AllergenId[]
  exclus?: readonly FoodId[]
  slots?: readonly MealSlot[]
  /** §7.1 impose 2 à 14 jours. La clause 10 prend la fenêtre la plus courte permise. */
  days?: number
}): WeekPlanRequest {
  return {
    profile: FEMME,
    constraints: {
      allergies: options.allergies ?? [],
      diet: options.diet ?? null,
      excludedFoodIds: options.exclus ?? [],
      ownedEquipmentIds: null,
      admittedFoodIds: [],
    },
    startDate: '2026-08-03',
    days: options.days ?? 7,
    slots: options.slots ?? TROIS_CRENEAUX,
    history: { windowDays: 21, entries: [] },
    activeTopics: [],
    tolerancePiquant: null,
    seed: options.seed,
  }
}

/** Les quatre configurations mesurées le 2026-08-26 — 420/420 créneaux remplis dans chacune. */
const QUATRE_CONFIGS: ReadonlyArray<{ nom: string; diet: DietCode | null; allergies: readonly AllergenId[] }> = [
  { nom: 'nominal', diet: null, allergies: [] },
  { nom: 'végétalien', diet: 'vegetalien' as DietCode, allergies: [] },
  { nom: 'végétalien + sans gluten', diet: 'vegetalien' as DietCode, allergies: ['gluten' as AllergenId] },
  { nom: 'sans gluten', diet: null, allergies: ['gluten' as AllergenId] },
]

interface CreneauMesure {
  readonly cle: string
  readonly creneau: string
  readonly recettes: readonly string[]
  readonly roles: readonly (CourseKind | null)[]
}

/** Regroupe les entrées d'un plan par créneau. Une entrée vide ne compte pas comme un créneau rempli. */
function parCreneau(entries: WeekPlanEntriesLike): CreneauMesure[] {
  const ordre: string[] = []
  const recettes = new Map<string, string[]>()
  const roles = new Map<string, (CourseKind | null)[]>()
  for (const e of entries) {
    if (e.recipeId === null) continue
    const cle = `${e.slot.date}|${e.slot.creneau}`
    if (!recettes.has(cle)) {
      ordre.push(cle)
      recettes.set(cle, [])
      roles.set(cle, [])
    }
    recettes.get(cle)!.push(e.recipeId as unknown as string)
    roles.get(cle)!.push(e.service)
  }
  return ordre.map((cle) => ({
    cle,
    creneau: cle.split('|')[1]!,
    recettes: recettes.get(cle)!,
    roles: roles.get(cle)!,
  }))
}

type WeekPlanEntriesLike = ReadonlyArray<{
  readonly slot: { readonly date: string; readonly creneau: string }
  readonly recipeId: RecipeId | null
  readonly service: CourseKind | null
}>

/** `true` si la recette porte l'étiquette du lot. Lecture par cast : le champ n'existe pas encore. */
function estPlatSimple(catalog: Catalog, recipeId: string): boolean {
  const recette = catalog.recipes.get(recipeId as unknown as RecipeId)
  return (recette as { estPlatSimple?: boolean } | undefined)?.estPlatSimple === true
}

function construire(args: readonly string[]) {
  return spawnSync(process.execPath, ['--experimental-sqlite', BUILD_SCRIPT, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
}

// --- Fixtures de la clause 4 -----------------------------------------------------------------
//
// Quatre aliments, parce que la troisième forme fausse est « 4 ingrédients » : il en faut quatre
// distincts pour que le rejet porte sur le NOMBRE et pas sur un doublon.

const QUATRE_ALIMENTS_YAML = `
foods:
${[1, 2, 3, 4]
  .map(
    (n) => `  - id: fixture_food_${n}
    code_ciqual: "PROV-FIXTURE-${n}"
    nom: "Aliment de test ${n}"
    groupe: "test"
    nutriments:
      energie_kcal: 100
    allergenes: []`
  )
  .join('\n')}
`

function ecrireSourcesFixture(dir: string): void {
  mkdirSync(path.join(dir, 'sources'), { recursive: true })
  mkdirSync(path.join(dir, 'lexicon'), { recursive: true })
  mkdirSync(path.join(dir, 'recipes'), { recursive: true })
  writeFileSync(path.join(dir, 'sources', 'foods.yaml'), QUATRE_ALIMENTS_YAML, 'utf8')
}

/**
 * Une recette de fixture déclarée `est_plat_simple: true`. Le TÉMOIN est la variante valide ; les
 * trois formes fausses n'en changent qu'UNE chose à la fois — c'est ce qui prouve que le rejet
 * vient de ce qu'on a cassé, et pas de la fixture.
 */
function recetteFixture(options: { service: string | null; typesRepas: readonly string[]; ingredients: number }): string {
  const serviceYaml = options.service === null ? '' : `service: ${options.service}\n`
  const ingredientsYaml = Array.from({ length: options.ingredients }, (_, i) => `  - food_id: fixture_food_${i + 1}
    quantite_g: 100
    unite_affichage: "100 g"
    optionnel: false`).join('\n')
  return `
id: recette_fixture
nom: "Recette de test"
origine: maison
description: "Une recette de fixture."
temps_prep_min: 5
temps_cuisson_min: 5
difficulte: 1
portions_base: 1
image_path: null
types_repas: [${options.typesRepas.join(', ')}]
${serviceYaml}est_plat_simple: true
saison_mois: []
envergure: quotidien
conservation_jours: 1
axes:
  sucre_sale: 0
  leger_consistant: 0
  chaud_froid: 0
  texture: ferme
ingredients:
${ingredientsYaml}
etapes:
  - ordre: 1
    texte: "Préparer l'aliment."
    lexicon_ids: []
    timer_s: null
    timer_type: null
facettes: []
`
}

function batirFixture(nom: string, yaml: string) {
  const dir = mkdtempSync(path.join(tmpdir(), `nutri-r5-${nom}-`))
  ecrireSourcesFixture(dir)
  writeFileSync(path.join(dir, 'recipes', 'recette_fixture.yaml'), yaml, 'utf8')
  return construire(['--sources', dir, '--out', path.join(dir, 'catalog.db')])
}

// ---------------------------------------------------------------------------------------------

describe('lot retour-5 — la catégorie « plat simple »', () => {
  let db: DatabaseSync
  let catalog: Catalog
  let moteur: Engine
  /** Les 20 plans nominaux, calculés une fois : les clauses 5, 7 et 9 les relisent. */
  let plansNominaux: CreneauMesure[][]
  let entreesNominales: WeekPlanEntriesLike[]
  /** Le plan de la configuration d'exclusion, graine 1. */
  let planExclusion: CreneauMesure[]
  /** Le même, non regroupé : la clause 10 a besoin des entrées pour appeler « Changer ». */
  let planExclusionBrut: WeekPlan
  /** Créneaux remplis par configuration, sur 20 graines × 21 créneaux. */
  let remplisParConfig: Map<string, number>

  beforeAll(() => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-retour-5-'))
    const dbPath = path.join(fixtureDir, 'catalog.db')
    const build = construire(['--out', dbPath])
    expect(build.status, `build du catalogue réel : ${build.stderr}`).toBe(0)

    db = new DatabaseSync(dbPath)
    catalog = loadCatalog(dbPath)
    moteur = createEngine(catalog)

    entreesNominales = []
    plansNominaux = []
    for (let seed = 1; seed <= 20; seed++) {
      const plan = moteur.planWeek(demande({ seed }))
      entreesNominales.push(plan.entries as unknown as WeekPlanEntriesLike)
      plansNominaux.push(parCreneau(plan.entries as unknown as WeekPlanEntriesLike))
    }

    remplisParConfig = new Map()
    for (const config of QUATRE_CONFIGS) {
      let remplis = 0
      for (let seed = 1; seed <= 20; seed++) {
        const plan =
          config.nom === 'nominal'
            ? { entries: entreesNominales[seed - 1]! }
            : moteur.planWeek(demande({ seed, diet: config.diet, allergies: config.allergies }))
        remplis += parCreneau(plan.entries as unknown as WeekPlanEntriesLike).length
      }
      remplisParConfig.set(config.nom, remplis)
    }

    planExclusionBrut = moteur.planWeek(demande({ seed: 1, exclus: VINGT_DEUX_EXCLUS, slots: DEUX_CRENEAUX }))
    planExclusion = parCreneau(planExclusionBrut.entries as unknown as WeekPlanEntriesLike)
  }, 300_000)

  // --- Clause 1 --------------------------------------------------------------------------------
  it('clause 1 — `recipe.est_plat_simple` existe, NOT NULL, défaut 0, et la valeur est fermée à 0/1', () => {
    const colonnes = db.prepare('PRAGMA table_info(recipe)').all() as Array<{
      name: string
      notnull: number
      dflt_value: string | null
    }>
    const colonne = colonnes.find((c) => c.name === 'est_plat_simple')
    expect(colonne, 'la colonne est_plat_simple est absente de la table recipe').toBeDefined()
    expect(colonne!.notnull).toBe(1)
    expect(String(colonne!.dflt_value)).toBe('0')

    const schema = (
      db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'recipe'").get() as {
        sql: string
      }
    ).sql
    // Comparaison sans espaces : `IN (0,1)` et `IN (0, 1)` sont le même verrou.
    expect(schema.replace(/\s+/g, '').toLowerCase()).toContain('check(est_plat_simplein(0,1))')
  })

  // --- Clause 2 --------------------------------------------------------------------------------
  it.each(NEUF_BASES)(
    'clause 2 — « %s » est un plat simple nu, servi en accompagnement au déjeuner ET au dîner, et tenant à « %s »',
    (recipeId, foodId) => {
      const colonnes = (db.prepare('PRAGMA table_info(recipe)').all() as Array<{ name: string }>).map((c) => c.name)
      expect(colonnes, 'la colonne est_plat_simple est absente — clause 1 d\'abord').toContain('est_plat_simple')

      const ligne = db
        .prepare('SELECT est_plat_simple, service, types_repas FROM recipe WHERE id = ?')
        .get(recipeId) as { est_plat_simple: number; service: string | null; types_repas: string } | undefined
      expect(ligne, `la recette '${recipeId}' n'existe pas au catalogue`).toBeDefined()

      expect(ligne!.est_plat_simple).toBe(1)
      expect(ligne!.service).toBe('accompagnement')

      const typesRepas = JSON.parse(ligne!.types_repas) as string[]
      expect(typesRepas).toContain('dejeuner')
      expect(typesRepas).toContain('diner')

      const nbIngredients = (
        db.prepare('SELECT COUNT(*) AS n FROM recipe_ingredient WHERE recipe_id = ?').get(recipeId) as { n: number }
      ).n
      expect(nbIngredients).toBeGreaterThanOrEqual(1)
      expect(nbIngredients).toBeLessThanOrEqual(3)

      const nbEtapes = (
        db.prepare('SELECT COUNT(*) AS n FROM recipe_step WHERE recipe_id = ?').get(recipeId) as { n: number }
      ).n
      expect(nbEtapes).toBeGreaterThanOrEqual(1)
      expect(nbEtapes).toBeLessThanOrEqual(3)

      // ⛔ LA MOITIÉ QUI TUE LES NEUF COQUILLES VIDES : la base doit être DANS la recette.
      const alimentsDeLaRecette = (
        db.prepare('SELECT food_id FROM recipe_ingredient WHERE recipe_id = ?').all(recipeId) as Array<{
          food_id: string
        }>
      ).map((r) => r.food_id)
      expect(alimentsDeLaRecette).toContain(foodId)
    }
  )

  // --- Clause 3 --------------------------------------------------------------------------------
  it('clause 3 — le catalogue compte 339 recettes, et exactement 9 portent l\'étiquette', () => {
    const total = (db.prepare('SELECT COUNT(*) AS n FROM recipe').get() as { n: number }).n
    expect(total).toBe(RECETTES_APRES)

    const colonnes = (db.prepare('PRAGMA table_info(recipe)').all() as Array<{ name: string }>).map((c) => c.name)
    expect(colonnes, 'la colonne est_plat_simple est absente — clause 1 d\'abord').toContain('est_plat_simple')

    const etiquetees = (
      db.prepare('SELECT id FROM recipe WHERE est_plat_simple = 1 ORDER BY id').all() as Array<{ id: string }>
    ).map((r) => r.id)
    expect([...etiquetees].sort()).toEqual([...IDS_DES_NEUF].sort())
  })

  // --- Clause 4 --------------------------------------------------------------------------------
  describe('clause 4 — le build refuse les trois formes fausses, et le témoin valide passe', () => {
    it('témoin — un plat simple bien formé est ACCEPTÉ (sans quoi les trois rejets ne prouveraient rien)', () => {
      const r = batirFixture('temoin', recetteFixture({ service: 'accompagnement', typesRepas: ['dejeuner', 'diner'], ingredients: 2 }))
      expect(r.status, `témoin refusé : ${r.stdout}\n${r.stderr}`).toBe(0)
    }, 60_000)

    it('forme fausse 1 — `service: plat` : le build sort ≠ 0 et NOMME la recette', () => {
      const r = batirFixture('service', recetteFixture({ service: 'plat', typesRepas: ['dejeuner', 'diner'], ingredients: 2 }))
      expect(r.status).not.toBe(0)
      expect(`${r.stdout}${r.stderr}`).toContain('recette_fixture')
    }, 60_000)

    it('forme fausse 2 — `types_repas: []` : le build sort ≠ 0 et NOMME la recette', () => {
      const r = batirFixture('types', recetteFixture({ service: 'accompagnement', typesRepas: [], ingredients: 2 }))
      expect(r.status).not.toBe(0)
      expect(`${r.stdout}${r.stderr}`).toContain('recette_fixture')
    }, 60_000)

    it('forme fausse 3 — 4 ingrédients : le build sort ≠ 0 et NOMME la recette', () => {
      const r = batirFixture('ingredients', recetteFixture({ service: 'accompagnement', typesRepas: ['dejeuner', 'diner'], ingredients: 4 }))
      expect(r.status).not.toBe(0)
      expect(`${r.stdout}${r.stderr}`).toContain('recette_fixture')
    }, 60_000)
  })

  // --- Clause 5 --------------------------------------------------------------------------------
  it('clause 5 — sur 20 graines nominales, un plat simple est réellement posé en accompagnement à côté d\'un plat', () => {
    let poses = 0
    const vus = new Set<string>()
    for (const plan of plansNominaux) {
      for (const creneau of plan) {
        const aUnPlat = creneau.roles.some((r) => r === 'plat')
        if (!aUnPlat) continue
        for (let i = 0; i < creneau.recettes.length; i++) {
          if (creneau.roles[i] !== 'accompagnement') continue
          if (!IDS_DES_NEUF.has(creneau.recettes[i]!)) continue
          poses++
          vus.add(creneau.recettes[i]!)
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log(`retour-5 clause 5 : ${poses} pose(s) de plat simple en accompagnement, ${vus.size} base(s) distincte(s)`)
    expect(poses).toBeGreaterThanOrEqual(1)
  })

  // --- Clause 6a — garde de non-régression, VERTE aujourd'hui -----------------------------------
  //
  // Elle ne juge pas le code d'aujourd'hui, elle juge celui de demain : SANS interdiction, le
  // pis-aller attrape les neuf bases et remplit 14/14 — `toBe(10)` tombe. Et une interdiction posée
  // APRÈS le classement fait descendre le compte SOUS 10 — `toBe` tombe aussi. Voir l'en-tête.
  it('clause 6a — configuration d\'exclusion : exactement 10/14 créneaux remplis, et aucun porté par un plat simple', () => {
    const principaux = planExclusion.filter((c) => c.creneau === 'dejeuner' || c.creneau === 'diner')
    const portesParPlatSimple = principaux.filter(
      (c) => !c.roles.includes('plat') && c.recettes.some((id) => estPlatSimple(catalog, id))
    )

    // eslint-disable-next-line no-console
    console.log(
      `retour-5 clause 6a : ${principaux.length}/14 créneaux principaux remplis, ` +
        `${portesParPlatSimple.length} porté(s) par un plat simple sans plat à côté`
    )

    expect(principaux.length).toBe(10)
    expect(portesParPlatSimple).toEqual([])
  })

  // --- Clause 6b -------------------------------------------------------------------------------
  //
  // Elle refuse de passer à vide : elle exige au moins une pose AVANT de juger les poses. C'est ce
  // qui la rend rouge aujourd'hui, et ce qui tue une implémentation qui déclarerait les neuf
  // recettes sans jamais les rendre atteignables.
  it('clause 6b — toute pose d\'un plat simple est un accompagnement à côté d\'un plat, et il y en a au moins une', () => {
    let poses = 0
    const fautives: string[] = []
    for (const plan of [...plansNominaux, planExclusion]) {
      for (const creneau of plan) {
        for (let i = 0; i < creneau.recettes.length; i++) {
          const id = creneau.recettes[i]!
          if (!estPlatSimple(catalog, id)) continue
          poses++
          if (creneau.roles[i] !== 'accompagnement' || !creneau.roles.includes('plat')) {
            fautives.push(`${creneau.cle} · ${id} · ${creneau.roles[i] ?? 'null'}`)
          }
        }
      }
    }

    // eslint-disable-next-line no-console
    console.log(`retour-5 clause 6b : ${poses} pose(s) de plat simple, ${fautives.length} hors accompagnement`)

    expect(poses).toBeGreaterThanOrEqual(1)
    expect(fautives).toEqual([])
  })

  // --- Clause 7 — garde de non-régression, VERTE aujourd'hui ------------------------------------
  it('clause 7 — 280 accompagnements posés sur 20 graines nominales, dont au moins 20 distincts qui ne sont pas des plats simples', () => {
    let accompagnements = 0
    const distinctsHorsPlatSimple = new Set<string>()
    for (const entrees of entreesNominales) {
      for (const e of entrees) {
        if (e.recipeId === null || e.service !== 'accompagnement') continue
        accompagnements++
        const id = e.recipeId as unknown as string
        if (!estPlatSimple(catalog, id)) distinctsHorsPlatSimple.add(id)
      }
    }
    // 280 = 20 graines × 14 repas principaux : chaque créneau principal en reçoit exactement un.
    // Le nombre ne peut donc que BAISSER — c'est ce que cette clause guette.
    expect(accompagnements).toBe(280)
    expect(distinctsHorsPlatSimple.size).toBeGreaterThanOrEqual(20)
  })

  // --- Clause 8 — garde de FORME, VERTE aujourd'hui ---------------------------------------------
  it('clause 8 — l\'ordre de service compte toujours 5 rangs, et « plat_simple » n\'en est pas un', () => {
    expect(COURSE_ORDER).toEqual(['entree', 'plat', 'accompagnement', 'fromage', 'dessert'])
    expect(COURSE_ORDER).toHaveLength(5)
    expect(COURSE_ORDER as readonly string[]).not.toContain('plat_simple')
  })

  // --- Clause 9 — garde de non-régression, VERTE aujourd'hui ------------------------------------
  it('clause 9a — les quatre configurations remplissent toujours 420/420 créneaux sur 20 graines', () => {
    for (const config of QUATRE_CONFIGS) {
      expect(remplisParConfig.get(config.nom), `configuration « ${config.nom} »`).toBe(420)
    }
  })

  it('clause 9b — `engine:plan-stress` rend 20/20 configurations saines', () => {
    const r = spawnSync(process.execPath, [TSX_CLI, STRESS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' })
    expect(r.status, `${r.stdout}\n${r.stderr}`).toBe(0)
    expect(r.stdout).toContain('20/20 configurations saines')
  }, 180_000)

  // --- Clause 10 — garde de non-régression, VERTE aujourd'hui ------------------------------------
  //
  // ⛔ ELLE TUE L'IMPLÉMENTATION QUI NE CORRIGE QUE `plan-week.ts`. « Changer » passe par un autre
  // chemin, qui reconstruit sa propre requête et ne filtre AUCUN service.
  //
  // Elle ÉPUISE le vivier au lieu de l'espérer épuisé : 22 exclusions, 2 jours de déjeuners, et on
  // refuse le plat proposé encore et encore. MESURÉ le 2026-08-26 sur le catalogue réel : les 9
  // premiers rerolls rendent un plat, le 10ᵉ rend un créneau VIDE. Après le lot, ce 10ᵉ tirage aura
  // neuf bases nues sous la main — une implémentation qui n'aurait corrigé que le planificateur en
  // posera une SEULE sur le créneau, et la clause tombera.
  //
  // ⚠️ SEUL LE PLAT REFUSÉ S'ACCUMULE DANS LES REFUS, jamais l'accompagnement. C'est le geste réel
  // (« Changer » vise le plat), et c'est aussi ce qui garde le piège armé : accumuler les
  // accompagnements viderait les neuf bases toutes seules.
  it('clause 10 — « Changer » ne pose jamais un plat simple seul, même vivier épuisé', () => {
    const contexte = {
      profile: FEMME,
      constraints: {
        allergies: [] as readonly AllergenId[],
        diet: null,
        excludedFoodIds: VINGT_DEUX_EXCLUS,
        ownedEquipmentIds: null,
        admittedFoodIds: [] as readonly FoodId[],
      },
      history: { windowDays: 21, entries: [] },
      tolerancePiquant: null,
      activeTopics: [],
      seed: 1,
    }

    let courant = moteur.planWeek(
      demande({ seed: 1, exclus: VINGT_DEUX_EXCLUS, slots: ['dejeuner'] as readonly MealSlot[], days: 2 })
    )
    const premier = courant.entries.find((e) => e.recipeId !== null && e.service !== 'accompagnement')
    expect(premier, 'la fenêtre de 2 jours doit poser au moins un déjeuner').toBeDefined()
    const cible = premier!.slot
    const cle = `${cible.date}|${cible.creneau}`

    const refuses: RecipeId[] = []
    const fautifs: string[] = []
    let tiragesRendus = 0
    let vide = false

    for (let i = 0; i < 20; i++) {
      const apres = moteur.rerollSlot(courant, cible, contexte, { excludeRecipeIds: [...refuses] })
      const pose = parCreneau(apres.entries as unknown as WeekPlanEntriesLike).find((c) => c.cle === cle)
      if (pose === undefined) {
        vide = true
        break
      }
      tiragesRendus++

      for (let j = 0; j < pose.recettes.length; j++) {
        const id = pose.recettes[j]!
        if (!estPlatSimple(catalog, id)) continue
        if (pose.roles[j] !== 'accompagnement' || !pose.roles.includes('plat')) {
          fautifs.push(`tirage ${i + 1} · ${id} · ${pose.roles[j] ?? 'null'}`)
        }
      }

      const platRefuse = pose.recettes.find((_, j) => pose.roles[j] !== 'accompagnement')
      if (platRefuse === undefined) break
      refuses.push(platRefuse as unknown as RecipeId)
      courant = apres
    }

    // eslint-disable-next-line no-console
    console.log(
      `retour-5 clause 10 : ${tiragesRendus} tirage(s) rendu(s) avant l'épuisement, vivier épuisé : ${vide}, ` +
        `${fautifs.length} plat(s) simple(s) posé(s) seul(s)`
    )

    expect(tiragesRendus).toBeGreaterThanOrEqual(9)
    expect(vide, 'le vivier doit finir par s\'épuiser, sinon la clause ne prouve rien').toBe(true)
    expect(fautifs).toEqual([])
  }, 120_000)

  // --- Clause 11 -------------------------------------------------------------------------------
  //
  // ⛔ L'INTERDICTION SUIT LE CHAMP, PAS LES IDENTIFIANTS. Les neuf finissent toutes par `_nature`
  // ou `_vapeur` : une regex passerait toutes les autres clauses de ce fichier. Ici le catalogue est
  // recopié avec l'étiquette RETIRÉE aux neuf — identifiants intacts, champ à `false` — et le compte
  // doit alors DÉPASSER 10, puisque plus rien ne les écarte du pis-aller.
  //
  // Rouge aujourd'hui pour la bonne raison : les neuf recettes n'existent pas, donc `retires` vaut 0
  // et le compte reste à 10.
  it('clause 11 — l\'interdiction lit le champ : étiquette retirée, les neuf redeviennent éligibles', () => {
    const sansEtiquette = new Map(catalog.recipes)
    let retires = 0
    for (const [id] of NEUF_BASES) {
      const cle = id as unknown as RecipeId
      const recette = sansEtiquette.get(cle)
      if (recette === undefined) continue
      retires++
      sansEtiquette.set(cle, { ...recette, estPlatSimple: false } as unknown as Recipe)
    }

    const moteurSansEtiquette = createEngine({ ...catalog, recipes: sansEtiquette } as Catalog)
    const plan = parCreneau(
      moteurSansEtiquette.planWeek(demande({ seed: 1, exclus: VINGT_DEUX_EXCLUS, slots: DEUX_CRENEAUX }))
        .entries as unknown as WeekPlanEntriesLike
    )
    const principaux = plan.filter((c) => c.creneau === 'dejeuner' || c.creneau === 'diner')

    // eslint-disable-next-line no-console
    console.log(
      `retour-5 clause 11 : étiquette retirée à ${retires}/9 recettes, ` +
        `${principaux.length}/14 créneaux principaux remplis (attendu : > 10)`
    )

    expect(retires).toBe(NEUF_BASES.length)
    expect(principaux.length).toBeGreaterThan(10)
  }, 120_000)
})
