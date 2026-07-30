// data/user-db.ts — le contrat d'accès à `user.db` (docs/ARCHITECTURE.md §4.1, §4.3).
//
// ⚠️ SÉPARÉ DE `SqlSource` (data/catalog-loader.ts) VOLONTAIREMENT, ce n'est pas une duplication.
// `catalog.db` est en LECTURE SEULE et interrogé par des requêtes littérales : `all(sql)` lui
// suffit. `user.db` est en lecture/écriture et manipule des valeurs SAISIES par l'utilisateur —
// les concaténer dans du SQL serait une injection. D'où `params`, lié par le pilote, sur les deux
// méthodes, et un `run` qui n'existe pas côté catalogue.
//
// ⚠️ CE FICHIER NE DOIT IMPORTER AUCUN MODULE NODE. Même piège que `catalog-loader.ts` : l'import
// est hoisté, un `import 'node:sqlite'` casse le bundle navigateur même si la fonction qui
// l'utilise n'est jamais appelée, et le message de Rollup ne désigne pas la cause. L'ouverture
// d'une base vit dans `user-store-node.ts` (Node) et `ui/user-source.ts` (navigateur, OPFS).

/**
 * Valeurs liables. Volontairement plus étroit que ce que SQLite accepte (pas de `bigint`, pas de
 * `Uint8Array`) : `user.db` ne stocke ni blob ni entier 64 bits, et un type large inviterait à en
 * passer un. Les booléens sont convertis en `0` / `1` au site de mapping, jamais ici.
 */
export type SqlValue = string | number | null

/** Une base `user.db` ouverte. Implémenté par `user-store-node.ts` et `ui/user-source.ts`. */
export interface UserDb {
  /** Lit des lignes. Les clés des objets rendus sont les NOMS DE COLONNES (`rowMode: 'object'`). */
  all<T>(sql: string, params?: readonly SqlValue[]): readonly T[]
  /** Exécute une instruction UNIQUE (pas de multi-statement : le pilote Node ne l'accepte pas). */
  run(sql: string, params?: readonly SqlValue[]): void
}

/**
 * Exécute `fn` dans une transaction, annulée si `fn` lève.
 *
 * ⚠️ NON RÉENTRANT : SQLite refuse un `BEGIN` imbriqué. Appeler `withTransaction` depuis une
 * fonction déjà transactionnelle lève « cannot start a transaction within a transaction ». Les
 * écritures composées de `user-store.ts` s'enveloppent elles-mêmes — ne pas les réenvelopper.
 */
export function withTransaction<T>(db: UserDb, fn: () => T): T {
  db.run('BEGIN')
  try {
    const resultat = fn()
    db.run('COMMIT')
    return resultat
  } catch (erreur) {
    db.run('ROLLBACK')
    throw erreur
  }
}
