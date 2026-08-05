// data/catalog-loader-node.ts — ouverture d'un fichier `catalog.db` sous NODE.
//
// ⚠️ SÉPARÉ DE `catalog-loader.ts` EXPRÈS, et ce n'est pas une préférence de style. Ce dernier est
// chargé par le NAVIGATEUR, où `node:sqlite` n'existe pas — et un import Node en tête de fichier
// casse le bundle même si la fonction qui l'utilise n'est jamais appelée, parce que l'import est
// hoisté. Le message d'erreur de Rollup (« DatabaseSync is not exported by
// __vite-browser-external ») ne désigne pas cette cause.
//
// Tout le mapping SQL → domaine reste dans `catalog-loader.ts`, partagé mot pour mot entre Node et
// le navigateur. Ici, uniquement l'ouverture du fichier.

import { DatabaseSync } from 'node:sqlite'
import type { Catalog } from '../engine/domain/index.js'
import { loadCatalogFrom, loadConfianceFrom, type ConfianceParAliment } from './catalog-loader.js'

/** Ouvre `catalog.db` en lecture seule et rend le catalogue en mémoire. RÉSERVÉ À NODE. */
export function loadCatalog(dbPath: string): Catalog {
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    return loadCatalogFrom({ all: <T,>(sql: string) => db.prepare(sql).all() as unknown as T[] })
  } finally {
    db.close()
  }
}

/**
 * Cotes de confiance ANSES des valeurs nutritionnelles (décision 33). RÉSERVÉ À NODE.
 *
 * ⚠️ SÉPARÉE DE `loadCatalog`, et pas par commodité : `Catalog` ne porte pas ces cotes, pour que
 * le moteur ne puisse pas les lire (voir `loadConfianceFrom`). Les rendre par le même appel les y
 * ferait entrer.
 */
export function loadConfiance(dbPath: string): ConfianceParAliment {
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    return loadConfianceFrom({ all: <T,>(sql: string) => db.prepare(sql).all() as unknown as T[] })
  } finally {
    db.close()
  }
}
