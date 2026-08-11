// tests/regime-admission-catalogue-reel.test.ts — lot D1, P1 sur le CATALOGUE RÉEL.
//
// ⚠️ CE FICHIER EST LE PENDANT DE `engine/selection/regime-admission.test.ts`, PAS SON DOUBLON.
// Là-bas, les propriétés se démontrent sur des fixtures montées à la main ; ici, la seule question
// est : **le lot change-t-il quelque chose pour quelqu'un qui n'a déclaré aucune exception ?** Elle
// ne se pose que sur les 330 recettes réelles, et il faut `data/` pour les charger — import interdit
// dans `engine/` (tests/engine-boundaries.test.ts). D'où ce fichier, à côté de `regime-coherence`.
//
// ⛔ AUCUNE TAILLE DE CATALOGUE N'EST CODÉE EN DUR. Les assertions portent sur des ÉGALITÉS
// D'ENSEMBLES et sur des ensembles vides, jamais sur un compte que le prochain lot de contenu
// ferait bouger.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Catalog, DietCode, RecipeId } from '../app/src/engine/domain/index.js'
import { DIET_CHAIN, dietLayer } from '../app/src/engine/selection/index.js'
import { makeRequest } from '../app/src/engine/selection/test-fixtures.js'
import { loadCatalog } from '../app/src/data/catalog-loader-node.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..')
const BUILD_SCRIPT = path.join(REPO_ROOT, 'catalog', 'build.mjs')

describe('lot D1 — P1 sur le catalogue réel : sans exception, rien ne bouge', () => {
  let catalog: Catalog
  const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-admission-'))
  const dbPath = path.join(fixtureDir, 'catalog.db')

  beforeAll(() => {
    const result = spawnSync(process.execPath, ['--experimental-sqlite', BUILD_SCRIPT, '--out', dbPath], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    catalog = loadCatalog(dbPath)
  })

  afterAll(() => {
    rmSync(fixtureDir, { recursive: true, force: true })
  })

  it('⛔ AUCUNE RECETTE N’EST ADMISSIBLE PAR EXCEPTION QUAND IL N’Y A PAS D’EXCEPTION', () => {
    // C'est P1 exactement : la seconde chance n'a rien à offrir, donc la branche ajoutée dans
    // `apply` est inatteignable, donc le chemin est celui d'avant le lot. Le témoin est structurel
    // — il ne dépend d'aucun compte de recettes.
    for (const diet of DIET_CHAIN) {
      const config = dietLayer.configure(makeRequest({ diet }), catalog)
      expect(config.admisesParException.size, diet).toBe(0)
    }
  })

  it('⭐ P3 NE SE DÉCLENCHE SUR AUCUNE DES RECETTES DU CATALOGUE — et c’est le SUCCÈS attendu', () => {
    // Une divergence entre la règle et une étiquette écrite à la main serait le défaut que
    // `tests/regime-coherence.test.ts` traque depuis le 2026-07-28. P3 en fait une garantie
    // d'EXÉCUTION plutôt qu'une discipline de test — `npx vite build` n'exécute pas vitest.
    //
    // ⚠️ Ce test ne peut voir quelque chose QUE si une admission existe : sans elle, P1 sort avant
    // que la règle ne soit consultée. On en déclare donc une, sur un aliment réel du catalogue.
    for (const diet of DIET_CHAIN) {
      const config = dietLayer.configure(makeRequest({ diet, admittedFoodIds: ['miel'] }), catalog)
      const noms = config.divergencesP3.map((id) => catalog.recipes.get(id)?.nom ?? id)
      expect(noms, `régime ${diet}`).toEqual([])
    }
  })

  it('admettre le miel n’ajoute que des recettes, jamais n’en retire — P2 sur le catalogue entier', () => {
    // La relation, pas le nombre : l'ensemble retenu avec exception CONTIENT celui sans exception,
    // pour chaque régime de la chaîne. Un défaut de la règle ne peut donc retirer aucun plat.
    for (const diet of DIET_CHAIN) {
      const sans = retenues(catalog, diet, [])
      const avec = retenues(catalog, diet, ['miel'])
      const perdues = [...sans].filter((id) => !avec.has(id))

      expect(perdues.map((id) => catalog.recipes.get(id)?.nom ?? id), `régime ${diet}`).toEqual([])
    }
  })

  it('sans exception, l’ensemble retenu est IDENTIQUE à celui que l’étiquette seule décide', () => {
    // L'oracle ne partage pas le code de son sujet : il n'appelle pas `dietLayer`, il lit les
    // facettes du catalogue et applique la chaîne d'inclusion à la main.
    for (const diet of DIET_CHAIN) {
      const parLaCouche = retenues(catalog, diet, [])
      const parLEtiquette = new Set<RecipeId>()
      for (const recipe of catalog.recipes.values()) {
        const etiquettes = recipe.facettes.filter((f) => f.facette === 'regime').map((f) => f.valeur)
        const rang = (d: string) => DIET_CHAIN.indexOf(d as DietCode)
        if (etiquettes.some((e) => e === diet || (rang(e) >= 0 && rang(diet) >= 0 && rang(e) <= rang(diet)))) {
          parLEtiquette.add(recipe.id)
        }
      }

      expect(parLaCouche, `régime ${diet}`).toEqual(parLEtiquette)
    }
  })
})

/** Les recettes du catalogue que la couche `regime` retient, sous ce régime et ces admissions. */
function retenues(
  catalog: Catalog,
  diet: DietCode,
  admittedFoodIds: readonly string[]
): ReadonlySet<RecipeId> {
  const toutes = new Set<RecipeId>(catalog.recipes.keys())
  const config = dietLayer.configure(makeRequest({ diet, admittedFoodIds }), catalog)
  const result = dietLayer.apply(toutes, config)
  if (!('rejected' in result)) throw new Error('dietLayer est une couche d’exclusion')
  return result.kept
}
