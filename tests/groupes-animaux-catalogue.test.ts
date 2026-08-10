// tests/groupes-animaux-catalogue.test.ts — `groupesAnimaux` confronté au CATALOGUE RÉEL.
//
// POURQUOI CE FICHIER EXISTE, EN PLUS DU TEST UNITAIRE. `engine/domain/groupes-animaux.test.ts`
// monte ses propres `Food` puis constate qu'ils se rangent comme il l'a prévu : il ne prouve que la
// cohérence de la fonction avec elle-même. Ce défaut a déjà été payé ici — un oracle qui partage la
// donnée de son sujet ne vérifie rien. Le catalogue, lui, est une donnée que la fonction n'a pas
// écrite : 451 aliments annotés à la main, cascades comprises.
//
// ⛔ AUCUN COMPTE N'EST ÉCRIT EN DUR DANS UNE ASSERTION. Quatre tests ont déjà parié sur la taille
// du catalogue et un lot de contenu les a cassés. Les effectifs sont AFFICHÉS (voir le `console.log`
// plus bas, lisible dans la sortie de `npm test`) et vérifiés entre eux par des invariants qui
// survivent à l'ajout d'un aliment.
//
// Ce fichier vit hors de app/src/engine/ parce qu'il charge le vrai catalog.db via data/ — import
// interdit à l'intérieur de engine/ (tests/engine-boundaries.test.ts).

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Catalog, Food, FoodId, GroupeAnimalId } from '../app/src/engine/domain/index.js'
import { groupeAnimalDe, groupesAnimaux, resolveAnimalOrigin } from '../app/src/engine/domain/index.js'
import { loadCatalog } from '../app/src/data/catalog-loader-node.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..')
const BUILD_SCRIPT = path.join(REPO_ROOT, 'catalog', 'build.mjs')

/**
 * L'ORACLE : des aliments nommés à la main, avec le groupe où ils DOIVENT tomber.
 *
 * Écrit en lisant le catalogue, pas en lisant la fonction. Trois catégories, à ne pas mélanger :
 *  - les évidences (`lait_entier`, `boeuf_steak`) — elles attrapent une inversion de branche ;
 *  - les CASCADES (`beurre_doux`, `creme_liquide`) — l'aliment ne déclare rien et hérite ;
 *  - les six qui ont coûté (`gelatine`, `saindoux`, `guimauve`, `graisse_canard`,
 *    `bouillon_boeuf`, `bouillon_volaille`) — hors du groupe « viandes », et pourtant prélevés sur
 *    un corps animal. C'est le défaut du 2026-08-10 ; s'il revient, il revient par là.
 */
const ORACLE: readonly (readonly [FoodId, GroupeAnimalId])[] = (
  [
    ['lait_entier', 'laitiers'],
    ['roquefort', 'laitiers'],
    ['chocolat_lait', 'laitiers'],
    ['beurre_doux', 'laitiers'], // cascade : beurre → lait entier
    ['creme_liquide', 'laitiers'], // cascade
    ['parmesan', 'laitiers'], // cascade
    ['oeuf', 'oeufs'],
    ['blanc_oeuf', 'oeufs'], // ⚠️ PAS une cascade : il porte `derive_de: oeuf` ET sa propre origine
    ['meringue', 'oeufs'],
    ['miel', 'miel'],
    ['boeuf_steak', 'viande_mammifere'],
    ['jambon_blanc', 'viande_mammifere'],
    ['gelatine', 'viande_mammifere'],
    ['saindoux', 'viande_mammifere'],
    ['guimauve', 'viande_mammifere'],
    ['bouillon_boeuf', 'viande_mammifere'],
    ['poulet_blanc', 'volaille'],
    ['foie_gras', 'volaille'],
    ['graisse_canard', 'volaille'],
    ['bouillon_volaille', 'volaille'],
    ['saumon', 'poisson'],
    ['surimi', 'poisson'],
    ['oeufs_lump', 'poisson'], // une « production » qui reste du poisson
    ['nuoc_mam', 'poisson'],
    ['moule', 'fruits_de_mer'],
    ['crevette', 'fruits_de_mer'],
  ] as const
).map(([id, groupe]) => [id as FoodId, groupe] as const)

describe('catalogue réel — les groupes d’aliments d’origine animale', () => {
  let catalog: Catalog
  let foods: ReadonlyMap<FoodId, Food>
  const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-groupes-'))
  const dbPath = path.join(fixtureDir, 'catalog.db')

  beforeAll(() => {
    const result = spawnSync(process.execPath, ['--experimental-sqlite', BUILD_SCRIPT, '--out', dbPath], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    expect(result.status, result.stderr).toBe(0)
    catalog = loadCatalog(dbPath)
    foods = catalog.foods
  })

  afterAll(() => {
    rmSync(fixtureDir, { recursive: true, force: true })
  })

  it('affiche les effectifs — REPÈRE POUR L’HUMAIN, jamais un oracle', () => {
    const groupes = groupesAnimaux(foods)
    const total = groupes.reduce((n, g) => n + g.aliments.length, 0)
    const lignes = groupes.map((g) => `${String(g.aliments.length).padStart(4)}  ${g.libelle}`)
    console.log(
      `\ngroupes d'origine animale — ${total} aliments sur ${foods.size}\n${lignes.join('\n')}\n`
    )
    expect(groupes.length).toBeGreaterThan(0)
  })

  it('⛔ CHAQUE ALIMENT À ORIGINE RÉSOLUE TOMBE DANS EXACTEMENT UN GROUPE', () => {
    const apparitions = new Map<FoodId, GroupeAnimalId[]>()
    for (const groupe of groupesAnimaux(foods)) {
      for (const food of groupe.aliments) {
        apparitions.set(food.id, [...(apparitions.get(food.id) ?? []), groupe.id])
      }
    }
    const doublons = [...apparitions].filter(([, gs]) => gs.length > 1)
    expect(doublons.map(([id, gs]) => `${id} : ${gs.join(', ')}`)).toEqual([])

    const attendus = [...foods.values()].filter((f) => resolveAnimalOrigin(f, foods) !== null)
    const manquants = attendus.filter((f) => !apparitions.has(f.id)).map((f) => f.id)
    expect(manquants).toEqual([])
  })

  it('⛔ AUCUN ALIMENT SANS ORIGINE RÉSOLUE N’APPARAÎT DANS UN GROUPE', () => {
    const intrus: string[] = []
    for (const groupe of groupesAnimaux(foods)) {
      for (const food of groupe.aliments) {
        if (resolveAnimalOrigin(food, foods) === null) intrus.push(`${food.id} → ${groupe.id}`)
      }
    }
    expect(intrus).toEqual([])
  })

  it('la somme des groupes égale le nombre d’aliments à origine résolue', () => {
    const somme = groupesAnimaux(foods).reduce((n, g) => n + g.aliments.length, 0)
    const resolus = [...foods.values()].filter((f) => resolveAnimalOrigin(f, foods) !== null).length
    expect(somme).toBe(resolus)
    // Et le complément : ce qui n'est pas classé n'a pas d'origine.
    expect(foods.size - somme).toBe(foods.size - resolus)
  })

  it('⛔ L’ORACLE ÉCRIT À LA MAIN — chaque aliment nommé tombe où il doit', () => {
    const ecarts: string[] = []
    for (const [id, attendu] of ORACLE) {
      const food = foods.get(id)
      if (food === undefined) {
        // Un aliment de l'oracle retiré du catalogue doit ROUGIR, pas disparaître en silence :
        // c'est le seul moyen de savoir qu'il faut réviser cette liste.
        ecarts.push(`${id} : absent du catalogue`)
        continue
      }
      const obtenu = groupeAnimalDe(food, foods)
      if (obtenu !== attendu) ecarts.push(`${id} (${food.nom}) : attendu ${attendu}, obtenu ${obtenu}`)
    }
    expect(ecarts).toEqual([])
  })

  it('⛔ LA CASCADE EST BIEN TESTÉE — les aliments hérités ne déclarent RIEN eux-mêmes', () => {
    // Sans ce test, l'oracle ci-dessus pourrait passer alors que `beurre_doux` déclarerait sa propre
    // origine : on aurait vérifié une lecture directe en croyant vérifier la remontée de chaîne.
    //
    // ⚠️ LES 38 CASCADES DU CATALOGUE MÈNENT TOUTES À `lait_entier`, donc toutes au groupe
    // `laitiers`. Le catalogue ne contient AUCUNE cascade du côté « corps » : un extrait de viande
    // dérivé d'une viande n'existe pas encore (`bouillon_boeuf` déclare sa propre origine). Cette
    // branche-là n'est couverte que par le test unitaire, sur fixtures — c'est un trou de donnée,
    // pas un trou de test, et il se refermera au premier dérivé carné ajouté.
    for (const id of ['beurre_doux', 'creme_liquide', 'parmesan'] as FoodId[]) {
      const food = foods.get(id)
      expect(food, id).toBeDefined()
      expect(food?.origineAnimale, `${id} devrait hériter son origine, pas la déclarer`).toBeNull()
      expect(food?.deriveDe, `${id} devrait porter un deriveDe`).not.toBeNull()
    }
  })

  it('les sept groupes sont tous représentés dans le catalogue', () => {
    // Ce n'est PAS un pari sur la taille du catalogue : ajouter des aliments ne peut pas vider un
    // groupe. Seul un RETRAIT de contenu ferait rougir ce test, et il doit rougir dans ce cas.
    expect([...groupesAnimaux(foods)].map((g) => g.id).sort()).toEqual(
      ['fruits_de_mer', 'laitiers', 'miel', 'oeufs', 'poisson', 'viande_mammifere', 'volaille'].sort()
    )
  })

  it('chaque groupe est non vide, trié par nom, et porte un libellé unique', () => {
    const groupes = groupesAnimaux(foods)
    const libelles = groupes.map((g) => g.libelle)
    expect(new Set(libelles).size).toBe(libelles.length)
    for (const groupe of groupes) {
      expect(groupe.aliments.length, groupe.id).toBeGreaterThan(0)
      const noms = groupe.aliments.map((f) => f.nom)
      expect(noms, groupe.id).toEqual([...noms].sort((a, b) => a.localeCompare(b, 'fr')))
    }
  })

  it('deux appels rendent le même résultat — la fonction est pure', () => {
    const a = groupesAnimaux(foods).map((g) => `${g.id}:${g.aliments.map((f) => f.id).join(',')}`)
    const b = groupesAnimaux(foods).map((g) => `${g.id}:${g.aliments.map((f) => f.id).join(',')}`)
    expect(a).toEqual(b)
  })
})
