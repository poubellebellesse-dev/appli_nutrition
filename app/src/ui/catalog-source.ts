// ui/catalog-source.ts — chargement du catalogue DANS LE NAVIGATEUR (docs/ARCHITECTURE.md §3).
//
// Le fichier `catalog.db` est livré avec l'application (§4.1 : « livré avec l'app, lecture seule »).
// Ici on le télécharge une fois, on le désérialise en mémoire dans SQLite WASM, et on le donne au
// mapping commun `loadCatalogFrom`.
//
// ⚠️ EN MÉMOIRE, PAS SUR OPFS. OPFS sert à `user.db`, qui doit SURVIVRE aux mises à jour (§4.1) ;
// `catalog.db` est remplacé intégralement à chaque release et n'a donc rien à persister. L'y écrire
// obligerait à gérer une invalidation de cache, pour un fichier que le navigateur sait déjà mettre
// en cache par HTTP.
//
// ⚠️ AUCUNE LOGIQUE DE MAPPING ICI. Tout ce fichier fait, c'est fournir un `SqlSource` — le
// mapping SQL → domaine est celui de `data/catalog-loader.ts`, partagé mot pour mot avec le build
// et les tests. Dupliquer une seule ligne de mapping pour le navigateur créerait deux vérités.

import type { Catalog } from '../engine/domain/index.js'
import { loadCatalogFrom, type SqlSource } from '../data/catalog-loader.js'
import { initSqlite } from './sqlite-wasm.js'

/** Où le `.db` est servi. `app/public/` est copié tel quel à la racine du site par Vite. */
const CATALOG_URL = '/catalog/catalog.db'

let cache: Promise<Catalog> | undefined

/**
 * Charge le catalogue. Le résultat est mémorisé : `createEngine` calcule ses index dérivés à
 * l'init (§6.5 précision 8), et recharger à chaque navigation refarait tout ce travail.
 *
 * ⚠️ On mémorise la PROMESSE, pas le résultat : deux composants montés en même temps déclencheraient
 * sinon deux téléchargements concurrents.
 */
export function chargerCatalogue(): Promise<Catalog> {
  cache ??= chargerVraiment()
  return cache
}

async function chargerVraiment(): Promise<Catalog> {
  const [sqlite3, reponse] = await Promise.all([initSqlite(), fetch(CATALOG_URL)])

  if (!reponse.ok) {
    throw new Error(`catalog.db introuvable (${reponse.status}) — le build a-t-il tourné ?`)
  }
  const octets = new Uint8Array(await reponse.arrayBuffer())

  // Désérialisation : on écrit le fichier téléchargé dans une base en mémoire.
  const db = new sqlite3.oo1.DB()
  const p = sqlite3.wasm.allocFromTypedArray(octets)
  const rc = sqlite3.capi.sqlite3_deserialize(
    db.pointer!,
    'main',
    p,
    octets.length,
    octets.length,
    sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE
  )
  db.checkRc(rc)

  const source: SqlSource = {
    all<T>(sql: string): readonly T[] {
      // `rowMode: 'object'` rend des objets aux clés = noms de colonnes, exactement ce que
      // `node:sqlite` produit — c'est ce qui permet au mapping d'être identique des deux côtés.
      return db.exec({ sql, rowMode: 'object', returnValue: 'resultRows' }) as unknown as T[]
    },
  }

  try {
    return loadCatalogFrom(source)
  } finally {
    db.close()
  }
}
