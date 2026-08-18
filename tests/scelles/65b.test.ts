// tests/scelles/65b.test.ts — l'examen du lot 65b : la plomberie de l'interrupteur.
//
// 65b = « déclarer son matériel n'enlève aucune recette tant que la personne n'a pas allumé le
// filtre ». Décision de l'auteur du 2026-08-18, plan en
// `docs/CONCEPTION_RESERVATION_MATERIEL.md` § « La redéfinition du 2026-08-18 ».
//
// ⛔ IL DOIT ÊTRE ROUGE LE JOUR OÙ ON L'ÉCRIT. Rien de ce qu'il importe n'existe encore :
// `writeFiltreEquipement` et `readFiltreEquipement` sont à écrire, et la v17 avec.
//
// La moitié ÉCRAN de ce lot vit dans `65b-ecran.test.tsx` : l'environnement se choisit par fichier,
// et celui-ci tourne en Node avec `node:sqlite`.
//
// ---------------------------------------------------------------------------------------------
// CE QUE CE FICHIER GARDE, ET POURQUOI IL EST ÉCRIT EN TENAILLE
//
// ⛔ AUCUNE CONSTANTE NE PASSE CES TESTS, et c'est leur seule raison d'être écrits ainsi. La couche
// `equipement` existe déjà, elle est juste, et elle n'est PAS ce qu'on teste ici. Ce qu'on teste est
// ce qui l'ALIMENTE — `readConstraints`, qui branche aujourd'hui `ownedEquipmentIds` sans condition.
// Deux implémentations fausses menacent, et chacune est tuée par la moitié opposée du fichier :
//
//   « rendre toujours null »       passe 1, 2, 5   ÉCHOUE 3, 4, 6
//   « rendre toujours la liste »   passe 3, 4, 6   ÉCHOUE 1, 2, 5
//
// Les mêmes données, le même catalogue, l'interrupteur seul qui change : 330 recettes contre 66.
//
// ⛔ LA DÉCLARATION PARTIELLE EST LE CŒUR DE LA CLAUSE 5, PAS UN DÉTAIL. Déclarer les 30 ustensiles
// laisserait 330 recettes disponibles MÊME filtre allumé — la clause serait alors satisfaite par un
// code qui ignore l'interrupteur. Le seul `four` déclaré, elle ne l'est plus.
//
// ⚠️ DES NOMBRES EXACTS, MESURÉS LE 2026-08-18 SUR `app/public/catalog/catalog.db` RÉEL :
//   330 recettes · 30 ustensiles au référentiel
//   271 recettes portent au moins un ustensile `requis`  → filtre allumé, rien de coché : 59 restent
//   264 recettes portent un `requis` autre que le four   → filtre allumé, seul le four : 66 restent
// Si l'un de ces nombres devient faux parce que le CONTENU a bougé, on le DIT et on s'arrête. On ne
// retouche pas un test scellé pour le faire passer.
//
// ⚠️ IMPORT DYNAMIQUE DU STORE, ET C'EST OBLIGATOIRE. `readFiltreEquipement` n'existe pas encore :
// un `import` statique de ce nom casserait `npm run typecheck` pour tout l'arbre. Les deux fonctions
// neuves sont donc déclarées OPTIONNELLES dans le type de retour — le fichier compile aujourd'hui et
// échoue à l'exécution, avec un message qui dit lequel des deux manque.
//
// ⚠️ LE CATALOGUE EST CELUI DU DÉPÔT, LU EN LECTURE SEULE — même parti que `app/src/ui/test-socle.ts`.
// Ce fichier ne reconstruit rien : le seul danger documenté est deux BUILDS concurrents, pas une
// lecture pendant un build.

import { beforeEach, describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

import { openUserDb } from '../../app/src/data/user-store-node.js'
import { MIGRATIONS, USER_SCHEMA_VERSION, migrate, readSchemaVersion } from '../../app/src/data/user-schema.js'
import { loadCatalog } from '../../app/src/data/catalog-loader-node.js'
import { equipmentLayer } from '../../app/src/engine/selection/equipement.js'
import type { UserDb, SqlValue } from '../../app/src/data/user-db.js'
import type {
  Catalog,
  EquipmentId,
  Food,
  FoodId,
  HardConstraints,
  RecipeId,
} from '../../app/src/engine/domain/index.js'
import type { SuggestionRequest } from '../../app/src/engine/domain/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..', '..')
const CATALOGUE = path.join(REPO_ROOT, 'app', 'public', 'catalog', 'catalog.db')

// --- Les nombres scellés, mesurés sur le catalogue réel le 2026-08-18 -------------------------

const RECETTES_TOTAL = 330
const USTENSILES_TOTAL = 30
/** Recettes portant au moins un ustensile `requis` — écartées si le filtre est allumé à vide. */
const ECARTEES_SANS_RIEN = 271
/** Recettes portant un `requis` autre que le four — écartées si le filtre est allumé, four coché. */
const ECARTEES_AVEC_LE_FOUR = 264

const FOUR = 'four' as EquipmentId

// --- Chargement du store, dont deux fonctions n'existent pas encore ----------------------------

interface Store {
  readonly readConstraints: (db: UserDb, foods: ReadonlyMap<FoodId, Food>) => HardConstraints
  readonly readOwnedEquipmentIds: (db: UserDb) => readonly EquipmentId[] | null
  readonly writeOwnedEquipmentIds: (db: UserDb, ids: readonly EquipmentId[]) => void
  /** ⏳ 65b — absent aujourd'hui, d'où l'optionnel. `true` = le filtre est allumé. */
  readonly readFiltreEquipement?: (db: UserDb) => boolean
  /** ⏳ 65b — absent aujourd'hui. */
  readonly writeFiltreEquipement?: (db: UserDb, actif: boolean) => void
}

async function chargerStore(): Promise<Store> {
  const fichier = path.join(REPO_ROOT, 'app', 'src', 'data', 'user-store.ts')
  expect(existsSync(fichier), 'app/src/data/user-store.ts est absent').toBe(true)
  return (await import(/* @vite-ignore */ pathToFileURL(fichier).href)) as never
}

/** Le store, avec les deux fonctions du lot EXIGÉES présentes — le message dit laquelle manque. */
async function storeComplet(): Promise<
  Store & {
    readonly readFiltreEquipement: (db: UserDb) => boolean
    readonly writeFiltreEquipement: (db: UserDb, actif: boolean) => void
  }
> {
  const store = await chargerStore()
  expect(
    typeof store.readFiltreEquipement,
    'user-store.ts n’exporte pas readFiltreEquipement — le lot 65b n’est pas fait',
  ).toBe('function')
  expect(
    typeof store.writeFiltreEquipement,
    'user-store.ts n’exporte pas writeFiltreEquipement — le lot 65b n’est pas fait',
  ).toBe('function')
  return store as never
}

// --- Harnais ----------------------------------------------------------------------------------

let catalogue: Catalog | undefined
function catalogueReel(): Catalog {
  expect(existsSync(CATALOGUE), `${CATALOGUE} est absent — lancer npm run build`).toBe(true)
  catalogue ??= loadCatalog(CATALOGUE)
  return catalogue
}

let db: UserDb

beforeEach(() => {
  db = openUserDb(':memory:').db
})

/**
 * Ce que la couche `equipement` retient et écarte, à partir des contraintes RÉELLEMENT lues en base.
 *
 * ⚠️ LA CHAÎNE TESTÉE EST `base → readConstraints → couche`, et c'est là que 65b intervient. La
 * `SuggestionRequest` est réduite à ses contraintes parce que `equipmentLayer.configure` ne lit
 * qu’elles ; monter les dix autres champs n’ajouterait aucune garantie et masquerait ce qui compte.
 */
async function passeEquipement(): Promise<{
  readonly gardees: ReadonlySet<RecipeId>
  readonly ecartees: readonly RecipeId[]
}> {
  const store = await chargerStore()
  const catalog = catalogueReel()
  const constraints = store.readConstraints(db, catalog.foods)
  const req = { constraints } as unknown as SuggestionRequest

  const config = equipmentLayer.configure(req, catalog)
  const candidats = new Set<RecipeId>(catalog.recipes.keys())
  const resultat = equipmentLayer.apply(candidats, config) as {
    readonly kept: ReadonlySet<RecipeId>
    readonly rejected: readonly { readonly recipeId: RecipeId }[]
  }
  return { gardees: resultat.kept, ecartees: resultat.rejected.map((r) => r.recipeId) }
}

/** Les recettes que `recipe_equipment` condamne quand on ne possède QUE les codes donnés. */
function ecarteesSelonLeCatalogue(codesPossedes: readonly string[]): ReadonlySet<string> {
  const sqlite = new DatabaseSync(CATALOGUE, { readOnly: true })
  const trous = codesPossedes.map(() => '?').join(', ')
  const lignes = sqlite
    .prepare(
      `SELECT DISTINCT re.recipe_id AS id
         FROM recipe_equipment re
         JOIN equipment e ON e.id = re.equipment_id
        WHERE re.niveau = 'requis'
          ${codesPossedes.length === 0 ? '' : `AND e.code NOT IN (${trous})`}`,
    )
    .all(...codesPossedes) as unknown as readonly { readonly id: string }[]
  sqlite.close()
  return new Set(lignes.map((l) => l.id))
}

// ==============================================================================================

describe('65b — le catalogue sur lequel les nombres scellés sont mesurés', () => {
  it('porte bien 330 recettes et 30 ustensiles', () => {
    const catalog = catalogueReel()
    expect(catalog.recipes.size).toBe(RECETTES_TOTAL)
    expect(catalog.equipment.size).toBe(USTENSILES_TOTAL)
  })

  it('condamne 271 recettes sans rien, 264 avec le seul four — les deux bornes de la tenaille', () => {
    // Mesuré par SQL, indépendamment du moteur : si ces deux nombres bougent, c'est le CONTENU qui
    // a changé, et les clauses 5 et 6 sont à revoir avec l'auteur, pas à réajuster en silence.
    expect(ecarteesSelonLeCatalogue([]).size).toBe(ECARTEES_SANS_RIEN)
    expect(ecarteesSelonLeCatalogue(['four']).size).toBe(ECARTEES_AVEC_LE_FOUR)
  })
})

describe('65b — clauses 1 à 4 : ce que `readConstraints` transmet au moteur', () => {
  it('1. base neuve : l’interrupteur est ÉTEINT et le matériel ne descend pas au moteur', async () => {
    const store = await storeComplet()
    expect(store.readFiltreEquipement(db)).toBe(false)
    expect(store.readConstraints(db, catalogueReel().foods).ownedEquipmentIds).toBeNull()
  })

  it('2. du matériel déclaré, interrupteur ÉTEINT : le moteur ne le voit TOUJOURS pas', async () => {
    const store = await storeComplet()
    store.writeOwnedEquipmentIds(db, [FOUR])

    // La table porte bien la ligne — la déclaration n'est pas perdue, elle n'est pas TRANSMISE.
    expect(store.readOwnedEquipmentIds(db)).toEqual([FOUR])
    expect(store.readConstraints(db, catalogueReel().foods).ownedEquipmentIds).toBeNull()
  })

  it('3. interrupteur ALLUMÉ : le moteur reçoit exactement ce qui est coché', async () => {
    const store = await storeComplet()
    store.writeOwnedEquipmentIds(db, [FOUR])
    store.writeFiltreEquipement(db, true)

    expect(store.readConstraints(db, catalogueReel().foods).ownedEquipmentIds).toEqual([FOUR])
  })

  it('4. interrupteur ALLUMÉ sur une table VIDE : le moteur reçoit [], jamais null', async () => {
    // ⛔ C'est ce que l'interrupteur apporte, et rien d'autre ne le donnait : « je ne possède rien »
    // est une RÉPONSE. `user-store.ts` disait qu'il faudrait un marqueur de déclaration le jour où
    // un écran permettrait de décocher — l'interrupteur EST ce marqueur.
    const store = await storeComplet()
    store.writeFiltreEquipement(db, true)

    expect(store.readConstraints(db, catalogueReel().foods).ownedEquipmentIds).toEqual([])
  })
})

describe('65b — clauses 5 et 6 : la tenaille, mêmes données, l’interrupteur seul qui change', () => {
  it('5. le seul four déclaré, interrupteur ÉTEINT : les 330 recettes restent, zéro écartée', async () => {
    const store = await storeComplet()
    store.writeOwnedEquipmentIds(db, [FOUR])

    const { gardees, ecartees } = await passeEquipement()
    expect(ecartees).toEqual([])
    expect(gardees.size).toBe(RECETTES_TOTAL)
  })

  it('5 bis. rien de déclaré du tout : le même résultat, à l’identifiant près', async () => {
    // La clause dit « strictement identique ». On compare les ENSEMBLES, pas les comptes : deux
    // ensembles de 330 pris dans un catalogue de 330 seraient forcément égaux, mais l'assertion
    // survivra à un catalogue qui grandit.
    const store = await storeComplet()
    const sansRien = await passeEquipement()

    store.writeOwnedEquipmentIds(db, [FOUR])
    const avecLeFour = await passeEquipement()

    expect([...avecLeFour.gardees].sort()).toEqual([...sansRien.gardees].sort())
  })

  it('6. le même four, interrupteur ALLUMÉ : 264 écartées, et EXACTEMENT celles-là', async () => {
    const store = await storeComplet()
    store.writeOwnedEquipmentIds(db, [FOUR])
    store.writeFiltreEquipement(db, true)

    const { gardees, ecartees } = await passeEquipement()

    expect(ecartees.length).toBe(ECARTEES_AVEC_LE_FOUR)
    expect(gardees.size).toBe(RECETTES_TOTAL - ECARTEES_AVEC_LE_FOUR)

    // ⛔ L'ENSEMBLE, PAS LE COMPTE. Un code qui écarterait 264 recettes au hasard passerait la
    // ligne du dessus. On compare identifiant par identifiant à ce que `recipe_equipment` désigne,
    // par un chemin qui ne passe NI par le moteur NI par le loader.
    expect([...ecartees].sort()).toEqual([...ecarteesSelonLeCatalogue(['four'])].sort())
  })

  it('6 bis. interrupteur ALLUMÉ sur une table vide : 271 écartées, il n’en reste que 59', async () => {
    // Le nombre que le garde-fou de l'écran doit annoncer AVANT d'allumer (clause 8).
    const store = await storeComplet()
    store.writeFiltreEquipement(db, true)

    const { gardees, ecartees } = await passeEquipement()
    expect(ecartees.length).toBe(ECARTEES_SANS_RIEN)
    expect(gardees.size).toBe(RECETTES_TOTAL - ECARTEES_SANS_RIEN)
  })
})

describe('65b — la v17, et ce qu’elle ne doit pas abîmer', () => {
  it('porte le numéro 17, sans trou ni doublon dans la liste des migrations', () => {
    expect(USER_SCHEMA_VERSION).toBe(17)
    const versions = MIGRATIONS.map((m) => m.version)
    expect(versions).toEqual([...versions].sort((a, b) => a - b))
    expect(new Set(versions).size).toBe(versions.length)
    expect(Math.max(...versions)).toBe(17)
  })

  it('migre une base v16 REMPLIE sans rien perdre, et son interrupteur naît ÉTEINT', async () => {
    // ⚠️ Un `user.db` ne se re-télécharge pas (§4.1 ARCHITECTURE) : une migration ratée est une
    // perte définitive. Patron repris mot pour mot du test de la v16 dans `user-store.test.ts`.
    const sqlite = new DatabaseSync(':memory:')
    const brute: UserDb = {
      all: <T,>(sql: string, params: readonly SqlValue[] = []) =>
        sqlite.prepare(sql).all(...params) as unknown as readonly T[],
      run: (sql: string, params: readonly SqlValue[] = []) => {
        sqlite.prepare(sql).run(...params)
      },
    }
    for (const migration of MIGRATIONS.filter((m) => m.version <= 16)) {
      readSchemaVersion(brute) // bootstrappe app_meta au premier appel
      for (const sql of migration.statements) brute.run(sql)
      brute.run('UPDATE app_meta SET schema_version = ? WHERE id = 1', [migration.version])
    }
    expect(readSchemaVersion(brute)).toBe(16)

    // Quelqu'un qui aurait déjà du matériel en base — cas impossible aujourd'hui faute d'écran,
    // mais c'est exactement ce que 65b rend possible, et la migration doit le traverser.
    brute.run(`INSERT INTO user_equipment (equipment_id) VALUES ('four')`)

    expect(() => migrate(brute)).not.toThrow()
    expect(readSchemaVersion(brute)).toBe(17)

    const store = await storeComplet()
    expect(store.readOwnedEquipmentIds(brute)).toEqual([FOUR])
    // ⛔ Personne n'hérite d'un filtre qu'il n'a pas demandé : une base migrée se comporte comme
    // avant la migration, à la recette près.
    expect(store.readFiltreEquipement(brute)).toBe(false)
    expect(store.readConstraints(brute, catalogueReel().foods).ownedEquipmentIds).toBeNull()
  })

  it('l’interrupteur est un singleton : deux écritures ne créent pas deux lignes', async () => {
    const store = await storeComplet()
    store.writeFiltreEquipement(db, true)
    store.writeFiltreEquipement(db, true)
    store.writeFiltreEquipement(db, false)
    expect(store.readFiltreEquipement(db)).toBe(false)

    store.writeFiltreEquipement(db, true)
    expect(store.readFiltreEquipement(db)).toBe(true)
  })
})
