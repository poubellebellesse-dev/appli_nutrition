// ui/user-source.ts — ouverture de `user.db` DANS LE NAVIGATEUR, persisté sur OPFS
// (docs/ARCHITECTURE.md §4.1, §7).
//
// ⚠️ CORRIGÉ LE 2026-07-30, APRÈS ÉCHEC EN NAVIGATEUR — « Missing required OPFS APIs. »
//
// La première version utilisait un VFS OPFS de SQLite (`installOpfsSAHPoolVfs`) depuis le thread
// principal. C'est IMPOSSIBLE, et pas seulement pour ce VFS-là : les deux VFS OPFS de sqlite-wasm
// testent `FileSystemFileHandle.prototype.createSyncAccessHandle`, qui est déclaré
// `[Exposed=DedicatedWorker]` — la méthode n'existe tout simplement PAS hors d'un Worker dédié. Le
// VFS `opfs` classique le dit d'ailleurs explicitement dans un message voisin (« cannot run in the
// main thread because it requires Atomics.wait() »). Aucune en-tête COOP/COEP n'y change rien : le
// problème n'est pas la sécurité du contexte, c'est le contexte lui-même.
//
// Deux issues existaient :
//   a) déplacer SQLite dans un Worker dédié — mais tout accès devient asynchrone, et `UserDb`,
//      `user-store.ts`, ses 42 tests et les deux écrans sont bâtis sur des lectures SYNCHRONES ;
//   b) garder SQLite EN MÉMOIRE sur le thread principal, et traiter `user.db` comme un FICHIER
//      qu'on lit au démarrage et qu'on réécrit après chaque modification.
//
// (b) est retenu. `navigator.storage.getDirectory()` et `FileSystemFileHandle.createWritable()`
// sont, eux, disponibles hors Worker : la persistance est asynchrone, mais la BASE reste
// synchrone — aucune ligne du store, des écrans ou des tests ne change. C'est exactement la
// technique déjà employée pour `catalog.db` (`catalog-source.ts`), à ceci près qu'on réécrit.
//
// ⚠️ CE QUE ÇA COÛTE, ET IL FAUT LE SAVOIR :
//   - la base ENTIÈRE est réécrite à chaque modification. Sans conséquence sur un `user.db`
//     personnel (quelques dizaines de Ko) ; à revoir si l'historique devait atteindre des dizaines
//     de milliers de lignes ;
//   - l'écriture est différée d'un tour de boucle. Une fermeture d'onglet dans cet intervalle perd
//     la dernière modification. Le délai se compte en millisecondes, mais il n'est pas nul ;
//   - deux onglets ont chacun leur copie en mémoire et le dernier qui écrit gagne, SANS erreur.
//     C'est moins brutal que l'échec d'ouverture du VFS, mais c'est plus sournois — à traiter par
//     un verrou (`navigator.locks`) le jour où l'application sera réellement utilisée.
//
// ⚠️ AUCUNE LOGIQUE DE MAPPING ICI. Ce fichier fournit un `UserDb` ; tout le mapping SQL ↔ domaine
// est celui de `data/user-store.ts`, partagé mot pour mot avec les tests sous Node.

import type { Database, Sqlite3Static } from '@sqlite.org/sqlite-wasm'
import { migrate } from '../data/user-schema.js'
import type { SqlValue, UserDb } from '../data/user-db.js'
import { initSqlite } from './sqlite-wasm.js'

/** Nom du fichier à la racine d'OPFS. */
const USER_DB_FILE = 'user.db'

/** Où sont réellement rangées les données de l'utilisateur. */
export type Stockage = 'opfs' | 'memoire'

export interface UserDbSession {
  readonly db: UserDb
  /**
   * `'memoire'` = OPFS indisponible (contexte non sécurisé, navigation privée sur certains
   * moteurs…). L'application FONCTIONNE, mais tout est perdu au rechargement. L'appelant doit le
   * dire clairement — un repli silencieux vers un stockage volatile serait le pire des deux mondes.
   */
  readonly stockage: Stockage
  /**
   * Résultat de `navigator.storage.persist()` — mesure 1 de §7 ARCHITECTURE.
   *
   * `false` n'est pas une erreur : la base existe, mais le navigateur s'autorise à l'effacer sous
   * pression de stockage (et Safari après 7 jours d'inactivité si la PWA n'est pas installée).
   * §7 mesure 6 impose alors un bandeau permanent.
   */
  readonly persistant: boolean
}

let cache: Promise<UserDbSession> | undefined

/** Ouvre (ou crée) `user.db` et le migre. Mémorisée : la base est un singleton par onglet. */
export function ouvrirUserDb(): Promise<UserDbSession> {
  cache ??= ouvrirVraiment()
  return cache
}

// --- Écriture différée --------------------------------------------------------------------------

let ecritureEnAttente = false
/** Les écritures se suivent au lieu de se chevaucher : deux `createWritable` concurrents sur le
 *  même fichier se marcheraient dessus. */
let fileDEcriture: Promise<void> = Promise.resolve()
let signalerErreur: ((erreur: Error) => void) | undefined

/**
 * Prévenu quand une écriture sur OPFS échoue (quota dépassé, permission retirée).
 *
 * ⚠️ SANS CE CANAL, L'ÉCHEC SERAIT MUET : l'écriture est asynchrone et détachée du geste de
 * l'utilisateur, donc personne ne peut l'attraper. L'application continuerait de fonctionner
 * parfaitement — en mémoire — et l'utilisateur ne découvrirait la perte qu'au rechargement.
 */
export function surErreurDePersistance(rappel: (erreur: Error) => void): void {
  signalerErreur = rappel
}

/**
 * Programme une réécriture du fichier.
 *
 * ⚠️ DIFFÉRÉE D'UN TOUR DE BOUCLE, ET C'EST NÉCESSAIRE. Les écritures composées du store
 * (`withTransaction`) enchaînent BEGIN … COMMIT de façon SYNCHRONE : exporter au milieu écrirait un
 * état non validé. JavaScript étant mono-thread, un `setTimeout(0)` ne peut s'exécuter qu'une fois
 * la transaction terminée. Les appels rapprochés sont par ailleurs fusionnés en une seule écriture.
 */
function planifierEcriture(sqlite3: Sqlite3Static, db: Database, fichier: FileSystemFileHandle): void {
  if (ecritureEnAttente) return
  ecritureEnAttente = true
  setTimeout(() => {
    ecritureEnAttente = false
    const octets = sqlite3.capi.sqlite3_js_db_export(db.pointer!)
    fileDEcriture = fileDEcriture
      .then(() => ecrireFichier(fichier, octets))
      .catch((erreur: unknown) => {
        signalerErreur?.(erreur instanceof Error ? erreur : new Error(String(erreur)))
      })
  }, 0)
}

// `Uint8Array<ArrayBuffer>` et non `Uint8Array` tout court : depuis TS 5.7 le type est générique sur
// son tampon, et le défaut (`ArrayBufferLike`) inclut `SharedArrayBuffer`, que `write` refuse.
// C'est exactement ce que rend `sqlite3_js_db_export`.
async function ecrireFichier(fichier: FileSystemFileHandle, octets: Uint8Array<ArrayBuffer>): Promise<void> {
  // `createWritable` tronque par défaut : le fichier reflète exactement l'export, sans reliquat
  // d'une version plus longue.
  const flux = await fichier.createWritable()
  await flux.write(octets)
  await flux.close()
}

// --- Ouverture ----------------------------------------------------------------------------------

async function ouvrirVraiment(): Promise<UserDbSession> {
  const sqlite3 = await initSqlite()

  // Demandée AVANT toute écriture : réclamer la persistance une fois les données saisies laisse une
  // fenêtre où elles sont effaçables. Best-effort, l'API n'existe pas partout.
  const persistant = await demanderPersistance()

  const fichier = await ouvrirFichierOpfs()
  const db = new sqlite3.oo1.DB()

  if (fichier !== null) {
    const octets = new Uint8Array(await (await fichier.getFile()).arrayBuffer())
    if (octets.length > 0) deserialiser(sqlite3, db, octets)
  }

  // Sans ce pragma (OFF par défaut), les ON DELETE CASCADE du schéma ne s'appliquent pas.
  db.exec('PRAGMA foreign_keys = ON')

  const userDb: UserDb = {
    all: <T,>(sql: string, params: readonly SqlValue[] = []) =>
      db.exec({
        sql,
        // `bind` omis quand il n'y a rien à lier : le binder refuse un tableau vide sur une requête
        // sans paramètre.
        ...(params.length > 0 ? { bind: [...params] } : {}),
        rowMode: 'object',
        returnValue: 'resultRows',
      }) as unknown as readonly T[],
    run: (sql: string, params: readonly SqlValue[] = []) => {
      db.exec({ sql, ...(params.length > 0 ? { bind: [...params] } : {}) })
      if (fichier !== null) planifierEcriture(sqlite3, db, fichier)
    },
  }

  migrate(userDb)
  return { db: userDb, stockage: fichier === null ? 'memoire' : 'opfs', persistant }
}

/** Le fichier `user.db` sur OPFS, ou `null` si OPFS est indisponible sur cette plateforme. */
async function ouvrirFichierOpfs(): Promise<FileSystemFileHandle | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return null
  try {
    const racine = await navigator.storage.getDirectory()
    return await racine.getFileHandle(USER_DB_FILE, { create: true })
  } catch {
    return null
  }
}

/** Charge un fichier existant dans la base en mémoire — même mécanique que `catalog-source.ts`. */
function deserialiser(sqlite3: Sqlite3Static, db: Database, octets: Uint8Array): void {
  const p = sqlite3.wasm.allocFromTypedArray(octets)
  const rc = sqlite3.capi.sqlite3_deserialize(
    db.pointer!,
    'main',
    p,
    octets.length,
    octets.length,
    // RESIZEABLE est INDISPENSABLE ici, à la différence du catalogue : cette base-ci grossit.
    sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE
  )
  db.checkRc(rc)
}

/** `navigator.storage.persist()`, sans supposer qu'il existe. */
async function demanderPersistance(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false
  try {
    // `persisted()` d'abord : une PWA installée est souvent déjà persistante, et re-demander
    // déclencherait une invite inutile sur certains navigateurs.
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
