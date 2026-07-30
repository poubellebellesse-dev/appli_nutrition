// ui/sqlite-wasm.ts — initialisation UNIQUE du module SQLite WASM, partagée par les deux bases.
//
// ⚠️ POURQUOI CENTRALISER. `sqlite3InitModule()` est une fabrique Emscripten : chaque appel
// construit une instance COMPLÈTE du module, avec son propre tas WASM et son propre registre de
// VFS. Appeler la fabrique une fois pour `catalog.db` et une fois pour `user.db` doublerait la
// mémoire pour rien, et surtout ferait vivre les deux bases dans deux mondes qui s'ignorent — un
// VFS installé dans l'un serait invisible dans l'autre, ce qui ne se voit qu'au premier `ATTACH`
// ou à la première tentative de partage.
//
// On mémorise la PROMESSE, pas le résultat : deux chargements concurrents (le catalogue et le
// profil démarrent en parallèle) déclencheraient sinon deux initialisations.

import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import type { Sqlite3Static } from '@sqlite.org/sqlite-wasm'

let cache: Promise<Sqlite3Static> | undefined

export function initSqlite(): Promise<Sqlite3Static> {
  cache ??= sqlite3InitModule()
  return cache
}
