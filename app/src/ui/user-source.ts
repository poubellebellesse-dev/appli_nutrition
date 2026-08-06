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
//   - ~~deux onglets ont chacun leur copie en mémoire et le dernier qui écrit gagne, SANS erreur.~~
//     ✅ TRAITÉ (§7, verrou d'onglet, plus bas) : le second onglet N'ÉCRIT PLUS et le dit.
//
// ⚠️ AUCUNE LOGIQUE DE MAPPING ICI. Ce fichier fournit un `UserDb` ; tout le mapping SQL ↔ domaine
// est celui de `data/user-store.ts`, partagé mot pour mot avec les tests sous Node.

import type { Database, Sqlite3Static } from '@sqlite.org/sqlite-wasm'
import { migrate } from '../data/user-schema.js'
import type { SqlValue, UserDb } from '../data/user-db.js'
import { initSqlite } from './sqlite-wasm.js'

/** Nom du fichier à la racine d'OPFS. */
const USER_DB_FILE = 'user.db'

/**
 * Nom du verrou d'écriture, partagé par tous les onglets de la même origine.
 *
 * Il porte le nom du fichier qu'il protège : ce qu'on sérialise, c'est l'accès en écriture à
 * `user.db`, pas « l'application ».
 */
const VERROU_ECRITURE = 'user.db:ecriture'

/** Où sont réellement rangées les données de l'utilisateur. */
export type Stockage = 'opfs' | 'memoire'

/**
 * Qui, de tous les onglets ouverts, a le droit d'écrire le fichier.
 *
 * - `exclusif` — cet onglet détient le verrou. Cas normal, un seul onglet ouvert.
 * - `partage` — un AUTRE onglet le détient. Celui-ci n'écrira pas : ses modifications vivent en
 *   mémoire et meurent avec lui.
 * - `indisponible` — `navigator.locks` n'existe pas (contexte non sécurisé, moteur ancien, jsdom).
 *   On retombe sur l'ancien comportement : on écrit. C'est un repli assumé — refuser d'écrire faute
 *   de savoir verrouiller casserait l'application là où elle marchait, pour un risque hypothétique.
 */
export type EtatVerrou = 'exclusif' | 'partage' | 'indisponible'

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
  /**
   * Voir `EtatVerrou`. `'partage'` doit être DIT à l'utilisateur : cet onglet fonctionne, il
   * n'enregistre simplement plus rien, et c'est indétectable sans le lui écrire.
   */
  readonly verrou: EtatVerrou
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
 * Ce que cet onglet a le droit de faire au fichier. `'partage'` ⇒ il n'y touche plus.
 *
 * Module-level et non porté par la session : `planifierEcriture` est appelée depuis la fermeture de
 * `ouvrirVraiment`, qui n'a pas la session sous la main.
 */
let verrouCourant: EtatVerrou = 'indisponible'

/**
 * Gèle DÉFINITIVEMENT les écritures de cette page.
 *
 * ⚠️ POSÉ AVANT DE REMPLACER LE FICHIER PAR UNE SAUVEGARDE, et c'est indispensable. Une écriture
 * différée déjà programmée s'exécuterait APRÈS la restauration et réécrirait le fichier avec la base
 * en MÉMOIRE — c'est-à-dire les anciennes données. La restauration aurait paru marcher, puis se
 * serait annulée toute seule une milliseconde plus tard, sans erreur. Le gel n'est jamais levé : la
 * page se recharge derrière.
 */
let gele = false

/** Un seul endroit décide si le fichier peut être touché — sinon la règle se dédouble. */
function peutEcrire(): boolean {
  return !gele && verrouCourant !== 'partage'
}

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
  if (ecritureEnAttente || !peutEcrire()) return
  ecritureEnAttente = true
  setTimeout(() => {
    ecritureEnAttente = false
    // Revérifié DANS le minuteur, pas seulement à la programmation : le gel peut tomber entre les
    // deux, et c'est même le cas nominal — une restauration suit toujours une écriture récente.
    if (!peutEcrire()) return
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

  // Pris AVANT la première écriture, pour la même raison.
  verrouCourant = await prendreVerrou()

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
  vivant = { sqlite3, db, fichier }
  return { db: userDb, stockage: fichier === null ? 'memoire' : 'opfs', persistant, verrou: verrouCourant }
}

// --- Sauvegarde : octets bruts et restauration ---------------------------------------------------

/**
 * Les poignées vivantes de la base ouverte, retenues pour la sauvegarde.
 *
 * ⚠️ `UserDb` n'expose que `all` et `run` — volontairement, c'est le contrat partagé avec Node. Or
 * exporter les octets exige le pointeur SQLite, et restaurer exige la poignée de fichier OPFS.
 * Élargir `UserDb` ferait entrer OPFS dans un type que `user-store-node.ts` doit aussi satisfaire :
 * la sauvegarde est une affaire de NAVIGATEUR, elle reste dans le module navigateur.
 */
let vivant: { sqlite3: Sqlite3Static; db: Database; fichier: FileSystemFileHandle | null } | undefined

/** Levée quand une opération de sauvegarde est demandée avant que la base soit ouverte. */
class BaseNonOuverte extends Error {
  constructor() {
    super("La base n'est pas encore ouverte.")
    this.name = 'BaseNonOuverte'
  }
}

/**
 * Les octets du fichier `user.db`, tels qu'ils seraient écrits sur OPFS.
 *
 * ⚠️ PRIS SUR LA BASE EN MÉMOIRE, PAS SUR LE FICHIER, et c'est le bon choix : l'écriture OPFS est
 * différée d'un tour de boucle, donc le fichier peut être en retard d'une modification. La mémoire
 * est la référence — une sauvegarde qui oublie le dernier geste serait pire qu'inutile, elle serait
 * fausse sans le dire.
 */
export function octetsDeLaBase(): Uint8Array<ArrayBuffer> {
  if (vivant === undefined) throw new BaseNonOuverte()
  return vivant.sqlite3.capi.sqlite3_js_db_export(vivant.db.pointer!)
}

/**
 * Remplace le fichier `user.db` par les octets fournis. **L'appelant recharge la page ensuite.**
 *
 * ⚠️ NE VALIDE RIEN — la validation est faite en amont par `verifierSauvegarde`, et les deux sont
 * séparées exprès : on ne veut pas d'un chemin où « écrire » puisse s'appeler sans avoir prouvé que
 * ce qu'on écrit s'ouvre. Cette fonction suppose des octets DÉJÀ éprouvés et déjà migrés.
 *
 * ⚠️ NE MET PAS À JOUR LA BASE EN MÉMOIRE. Elle gèle les écritures et laisse la page se recharger :
 * remplacer 24 tables sous un arbre React vivant, dont les écrans tiennent des copies en état local,
 * produirait un affichage à moitié à jour, ce qui sur des allergènes est un défaut de sécurité.
 */
export async function remplacerLeFichier(octets: Uint8Array<ArrayBuffer>): Promise<void> {
  if (vivant === undefined) throw new BaseNonOuverte()
  if (vivant.fichier === null) {
    throw new Error("Cet appareil n'enregistre rien : il n'y a pas de fichier à remplacer.")
  }
  // ⚠️ LE VERROU VAUT ICI AUSSI, ET C'EST LE CHEMIN QU'ON OUBLIE. `planifierEcriture` le respecte,
  // mais une restauration écrit le fichier par une autre porte : sans ce contrôle, un onglet en
  // `'partage'` pourrait restaurer une sauvegarde… que l'onglet détenteur, qui n'en sait rien,
  // écraserait à sa modification suivante avec SA base en mémoire. La restauration aurait paru
  // marcher, puis se serait défaite toute seule. C'est exactement la perte que le verrou existe pour
  // empêcher — un seul chemin d'écriture non gardé suffit à la rouvrir.
  if (verrouCourant === 'partage') {
    throw new Error(
      "L'application est ouverte dans un autre onglet, et c'est lui qui enregistre. " +
        'Fermez-le, rechargez cette page, puis recommencez.'
    )
  }
  gele = true
  // La file en cours peut porter une écriture programmée avant le gel : on la laisse finir, sinon
  // elle atterrirait par-dessus la restauration.
  await fileDEcriture.catch(() => undefined)
  try {
    await ecrireFichier(vivant.fichier, octets)
  } catch (erreur) {
    // ⚠️ ON DÉGÈLE, et c'est le choix le moins pire. Le fichier d'origine est intact —
    // `createWritable` ne publie qu'au `close()`, un échec en cours de route ne l'entame pas — donc
    // la base en mémoire correspond toujours à ce qui est sur le disque. Rester gelé condamnerait
    // le reste de la session à ne plus RIEN enregistrer, sans bandeau et sans erreur : une perte
    // certaine et muette, pour se prémunir d'une divergence qui n'a pas eu lieu.
    gele = false
    throw erreur
  }
}

/**
 * Ouvre des octets candidats dans une base JETABLE et rend leur version de schéma.
 *
 * ⚠️ C'EST LA SEULE PREUVE QUI VAILLE : un fichier peut avoir la bonne extension, la bonne taille et
 * l'en-tête « SQLite format 3 » sans être une base de CETTE application. On ne vérifie donc pas une
 * signature, on OUVRE, et on lit `app_meta`. Ce qui ne s'ouvre pas ne remplacera rien.
 *
 * ⚠️ LA MIGRATION EST JOUÉE ICI, SUR LA COPIE JETABLE, et les octets rendus sont ceux d'APRÈS. Migrer
 * après le remplacement laisserait la possibilité qu'une migration échoue sur une base qui a DÉJÀ
 * écrasé celle de l'utilisateur — c'est-à-dire une perte définitive causée par la fonction de
 * restauration elle-même.
 */
export function verifierSauvegarde(octets: Uint8Array): { version: number; migres: Uint8Array<ArrayBuffer> } {
  if (vivant === undefined) throw new BaseNonOuverte()
  const { sqlite3 } = vivant
  const jetable = new sqlite3.oo1.DB()
  try {
    deserialiser(sqlite3, jetable, octets)
    jetable.exec('PRAGMA foreign_keys = ON')
    const brute: UserDb = {
      all: <T,>(sql: string, params: readonly SqlValue[] = []) =>
        jetable.exec({
          sql,
          ...(params.length > 0 ? { bind: [...params] } : {}),
          rowMode: 'object',
          returnValue: 'resultRows',
        }) as unknown as readonly T[],
      run: (sql: string, params: readonly SqlValue[] = []) => {
        jetable.exec({ sql, ...(params.length > 0 ? { bind: [...params] } : {}) })
      },
    }
    // Lue AVANT toute migration : c'est la version du fichier de l'utilisateur qu'on veut juger,
    // pas celle qu'il aurait après coup.
    const version = lireVersionDeSauvegarde(brute)
    migrate(brute)
    return { version, migres: sqlite3.capi.sqlite3_js_db_export(jetable.pointer!) }
  } finally {
    jetable.close()
  }
}

/**
 * Version de schéma d'une base candidate, sans jamais la CRÉER.
 *
 * ⚠️ `readSchemaVersion` bootstrappe `app_meta` quand la table manque — comportement voulu à
 * l'ouverture d'une base neuve, catastrophique ici : il ferait passer n'importe quelle base SQLite
 * étrangère pour une sauvegarde vide à la version 0, donc restaurable. On interroge donc
 * `sqlite_master` d'abord.
 */
function lireVersionDeSauvegarde(db: UserDb): number {
  const table = db.all<{ readonly name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_meta'"
  )
  if (table.length === 0) throw new Error("Ce fichier n'est pas une sauvegarde de cette application.")
  const ligne = db.all<{ readonly schema_version: number }>('SELECT schema_version FROM app_meta WHERE id = 1')[0]
  if (ligne === undefined) throw new Error("Ce fichier n'est pas une sauvegarde de cette application.")
  return ligne.schema_version
}

// --- Verrou d'onglet ----------------------------------------------------------------------------

/**
 * Réclame le droit d'écrire, pour toute la durée de vie de l'onglet.
 *
 * ⚠️ `ifAvailable: true` — ON NE FAIT PAS LA QUEUE. Un `request` bloquant resterait en attente
 * jusqu'à la fermeture de l'autre onglet, puis prendrait le verrou et se mettrait à écrire une base
 * en mémoire vieille de plusieurs heures, par-dessus le travail de l'onglet qui vient de partir.
 * L'attente transformerait une collision visible en écrasement différé.
 *
 * ⚠️ LE VERROU EST TENU PAR UNE PROMESSE QUI NE SE RÉSOUT JAMAIS. C'est le contrat de l'API : le
 * verrou vit tant que la fonction de rappel n'a pas fini. Il est rendu par le navigateur à la
 * fermeture de l'onglet — il n'y a rien à libérer à la main, et surtout rien à libérer sur
 * `beforeunload`, qui ne se déclenche pas de façon fiable sur mobile.
 */
async function prendreVerrou(): Promise<EtatVerrou> {
  if (typeof navigator === 'undefined' || navigator.locks?.request === undefined) return 'indisponible'
  try {
    return await new Promise<EtatVerrou>((resolve, reject) => {
      navigator.locks
        .request(VERROU_ECRITURE, { ifAvailable: true }, async (verrou) => {
          if (verrou === null) {
            resolve('partage')
            return
          }
          resolve('exclusif')
          await new Promise<never>(() => undefined)
        })
        .catch(reject)
    })
  } catch {
    // Une origine sans `locks` utilisable ne doit pas empêcher l'application de s'ouvrir.
    return 'indisponible'
  }
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
