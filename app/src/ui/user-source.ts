// ui/user-source.ts — ouverture de `user.db` DANS LE NAVIGATEUR, sur OPFS (docs/ARCHITECTURE.md
// §4.1, §7).
//
// Symétrique de `catalog-source.ts`, avec l'asymétrie qui compte : le catalogue est monté EN
// MÉMOIRE parce qu'il se re-télécharge, `user.db` est écrit sur OPFS parce qu'il ne se
// re-télécharge PAS. C'est le seul fichier de l'application dont la perte est définitive.
//
// ⚠️ VFS `opfs-sahpool`, PAS le VFS `opfs` classique. Ce dernier exige `SharedArrayBuffer`, donc
// les en-têtes COOP/COEP. `vite.config.ts` ne les pose que sur `server` — `npm run preview` et
// n'importe quel hébergement statique nu ne les ont pas, et le VFS refuserait de démarrer là où
// l'application est réellement servie. `opfs-sahpool` utilise directement les descripteurs d'accès
// synchrone d'OPFS : aucune en-tête requise, aucun worker à orchestrer.
//
// ⚠️ UN SEUL ONGLET À LA FOIS. Le pool prend des `SyncAccessHandle` EXCLUSIFS sur ses fichiers : un
// second onglet de l'application échouera à l'ouverture, avec une erreur du VFS. C'est le prix de
// l'accès synchrone, et c'est acceptable pour une PWA installée — mais l'appelant doit présenter
// l'échec comme « l'appli est déjà ouverte ailleurs », jamais comme une base corrompue.
//
// ⚠️ AUCUNE LOGIQUE DE MAPPING ICI. Ce fichier fournit un `UserDb` ; tout le mapping SQL ↔ domaine
// est celui de `data/user-store.ts`, partagé mot pour mot avec les tests sous Node.

import { migrate } from '../data/user-schema.js'
import type { SqlValue, UserDb } from '../data/user-db.js'
import { initSqlite } from './sqlite-wasm.js'

/** Nom du fichier dans le pool OPFS. Le VFS gère son propre répertoire (voir `initialCapacity`). */
const USER_DB_PATH = '/user.db'

export interface UserDbSession {
  readonly db: UserDb
  /**
   * Résultat de `navigator.storage.persist()` — mesure 1 de §7 ARCHITECTURE.
   *
   * `false` n'est PAS une erreur : la base fonctionne, mais le navigateur s'autorise à l'effacer
   * sous pression de stockage (et Safari après 7 jours d'inactivité si la PWA n'est pas installée).
   * §7 mesure 6 impose alors un bandeau d'alerte permanent — d'où la remontée de l'information
   * jusqu'à l'appelant plutôt qu'un simple appel silencieux.
   */
  readonly persistant: boolean
}

let cache: Promise<UserDbSession> | undefined

/**
 * Ouvre (ou crée) `user.db` sur OPFS et le migre. Mémorisée : la base est un singleton par onglet,
 * et deux ouvertures concurrentes se disputeraient les descripteurs exclusifs du pool.
 */
export function ouvrirUserDb(): Promise<UserDbSession> {
  cache ??= ouvrirVraiment()
  return cache
}

async function ouvrirVraiment(): Promise<UserDbSession> {
  const sqlite3 = await initSqlite()

  // Demandé AVANT d'écrire quoi que ce soit : réclamer la persistance une fois des données saisies
  // laisse une fenêtre où elles sont effaçables. Best-effort — l'API n'existe pas partout, et un
  // refus n'empêche pas l'application de fonctionner.
  const persistant = await demanderPersistance()

  const pool = await sqlite3.installOpfsSAHPoolVfs({})
  const sqliteDb = new pool.OpfsSAHPoolDb(USER_DB_PATH)

  // Sans ce pragma (OFF par défaut), les ON DELETE CASCADE du schéma ne s'appliquent pas.
  sqliteDb.exec('PRAGMA foreign_keys = ON')

  const db: UserDb = {
    all: <T,>(sql: string, params: readonly SqlValue[] = []) =>
      sqliteDb.exec({
        sql,
        // `bind` omis quand il n'y a rien à lier : le binder refuse un tableau vide sur une requête
        // sans paramètre.
        ...(params.length > 0 ? { bind: [...params] } : {}),
        rowMode: 'object',
        returnValue: 'resultRows',
      }) as unknown as readonly T[],
    run: (sql: string, params: readonly SqlValue[] = []) => {
      sqliteDb.exec({ sql, ...(params.length > 0 ? { bind: [...params] } : {}) })
    },
  }

  migrate(db)
  return { db, persistant }
}

/** `navigator.storage.persist()`, sans supposer qu'il existe (API absente de plusieurs moteurs). */
async function demanderPersistance(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false
  try {
    // `persisted()` d'abord : une PWA déjà installée est souvent persistante sans nouvelle demande,
    // et re-demander déclencherait une invite inutile sur certains navigateurs.
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
