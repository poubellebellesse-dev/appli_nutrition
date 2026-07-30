// data/user-store-node.ts — ouverture d'un fichier `user.db` sous NODE.
//
// ⚠️ SÉPARÉ DE `user-store.ts` / `user-db.ts` / `user-schema.ts` EXPRÈS, exactement comme
// `catalog-loader-node.ts` l'est de `catalog-loader.ts`, et pour la même raison : ces trois
// fichiers sont chargés par le NAVIGATEUR, où `node:sqlite` n'existe pas. Un import Node en tête de
// l'un d'eux casse le bundle même si la fonction qui l'utilise n'est jamais appelée — l'import est
// hoisté, et le message de Rollup ne désigne pas la cause (c'est arrivé le 2026-07-28).
//
// Ce fichier n'est utilisé que par les TESTS et d'éventuels outils CLI. Le chemin de production est
// `ui/user-source.ts` (SQLite WASM sur OPFS).

import { DatabaseSync } from 'node:sqlite'
import type { SqlValue, UserDb } from './user-db.js'
import { migrate } from './user-schema.js'

export interface OpenedUserDb {
  readonly db: UserDb
  close(): void
}

/**
 * Ouvre (ou crée) `user.db` et le migre jusqu'à `USER_SCHEMA_VERSION`. RÉSERVÉ À NODE.
 *
 * `':memory:'` donne une base jetable — c'est ce qu'utilisent les tests.
 *
 * La migration est faite ICI, à l'ouverture, et pas laissée à l'appelant : une base ouverte mais
 * non migrée n'a aucun usage légitime, et rendre l'étape optionnelle garantit qu'un appelant
 * l'oubliera un jour sur un `no such table` incompréhensible.
 */
export function openUserDb(dbPath: string): OpenedUserDb {
  const sqlite = new DatabaseSync(dbPath)
  // Sans ce pragma (OFF par défaut dans SQLite), les `ON DELETE CASCADE` de meal_plan_entry et de
  // shopping_list_item ne s'appliquent pas : supprimer un plan laisserait ses créneaux orphelins.
  sqlite.exec('PRAGMA foreign_keys = ON')

  const db: UserDb = {
    all: <T,>(sql: string, params: readonly SqlValue[] = []) =>
      sqlite.prepare(sql).all(...params) as unknown as readonly T[],
    run: (sql: string, params: readonly SqlValue[] = []) => {
      sqlite.prepare(sql).run(...params)
    },
  }

  migrate(db)
  return { db, close: () => sqlite.close() }
}
