// tests/exclusion-real-catalog.test.ts — la passe d'exclusion (docs/ENGINE.md §6.4) sur le
// catalogue RÉEL (10 recettes, 30 aliments, docs/ETAT.md §6), plus le test de propriété allergènes
// et le garde-fou (§5.2 ARCHITECTURE), tâche P1a.
//
// Ce fichier vit hors de app/src/engine/ (et non dans engine/selection/) précisément parce qu'il
// importe data/catalog-loader.ts pour charger le vrai catalog.db — un import interdit à
// l'intérieur de engine/ (tests/engine-boundaries.test.ts). Les tests unitaires par couche, eux,
// vivent à côté du code testé sous app/src/engine/selection/*.test.ts avec des fixtures en
// mémoire.
//
// Build vers un fichier isolé (comme app/src/data/catalog-loader.test.ts) : catalog/build.test.ts
// reconstruit le même catalog.db partagé en parallèle (vitest exécute les fichiers en parallèle),
// et deux builds concurrents sur la même sortie se corrompent l'un l'autre.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AllergenId, Catalog, RecipeId } from '../app/src/engine/domain/index.js'
import { EngineSafetyError } from '../app/src/engine/domain/index.js'
import { assertNoDeclaredAllergen } from '../app/src/engine/guards/index.js'
import { runExclusionPass } from '../app/src/engine/selection/index.js'
import { makeRequest } from '../app/src/engine/selection/test-fixtures.js'
import { loadCatalog } from '../app/src/data/catalog-loader.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..')
const BUILD_SCRIPT = path.join(REPO_ROOT, 'catalog', 'build.mjs')

describe('selection/exclusion-pass + guards — catalogue réel (10 recettes)', () => {
  let catalog: Catalog
  const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-exclusion-pass-'))
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

  it('charge bien 10 recettes réelles (précondition des tests ci-dessous)', () => {
    expect(catalog.recipes.size).toBe(10)
  })

  it('sans contrainte, la passe d’exclusion renvoie les 9 recettes du créneau "diner"', () => {
    const req = makeRequest({ creneau: 'diner' })
    const { candidates, rejections } = runExclusionPass(catalog, req)

    expect(candidates.size).toBe(9)
    expect(rejections).toEqual([])
    expect(candidates.has('salade_pois_chiches' as RecipeId)).toBe(false) // dejeuner uniquement
  })

  it('régime "vegetarien" écarte le bœuf (omnivore) et le saumon (pescetarien) — motif "regime"', () => {
    const req = makeRequest({ creneau: 'diner', diet: 'vegetarien' })
    const { candidates, rejections } = runExclusionPass(catalog, req)

    expect(candidates.has('boeuf_hache_sauce_tomate' as RecipeId)).toBe(false)
    expect(candidates.has('saumon_poele_courgettes' as RecipeId)).toBe(false)
    expect(candidates.size).toBe(7)
    for (const entry of rejections) expect(entry.layerId).toBe('regime')
  })

  it('temps disponible = 15 min ne garde que l’omelette (10 min) sur le créneau "diner"', () => {
    const req = makeRequest({ creneau: 'diner', tempsDisponibleMin: 15 })
    const { candidates, rejections } = runExclusionPass(catalog, req)

    expect(candidates).toEqual(new Set(['omelette_fines_herbes']))
    expect(rejections.every((entry) => entry.layerId === 'temps')).toBe(true)
    expect(rejections).toHaveLength(8)
  })

  it('le garde-fou lève EngineSafetyError sur un cas violant construit à la main (catalogue réel)', () => {
    // Bypass délibéré : 'pates_ail_huile' contient du gluten (farine de blé) — on le passe au
    // garde-fou comme candidat conservé malgré l'allergie déclarée, sans passer par la couche.
    expect(() =>
      assertNoDeclaredAllergen(
        new Set(['pates_ail_huile' as RecipeId]),
        catalog,
        { allergies: ['gluten' as AllergenId], diet: null, excludedFoodIds: [] }
      )
    ).toThrow(EngineSafetyError)
  })

  // --------------------------------------------------------------------------------------------
  // Test de propriété (docs/ENGINE.md §11.1) : pour TOUTE combinaison d'allergies déclarées,
  // aucune recette conservée par la passe d'exclusion ne contient l'allergène — et le garde-fou
  // ne lève jamais sur une sortie correctement filtrée.
  //
  // Aucune dépendance nouvelle (fast-check n'est pas dans package.json) : la propriété est prouvée
  // par ÉNUMÉRATION EXHAUSTIVE plutôt que par échantillonnage aléatoire — plus fort qu'un test
  // basé sur des cas générés, puisque TOUTES les combinaisons sont couvertes, pas un sous-ensemble.
  // Restreint aux allergènes qui apparaissent RÉELLEMENT sur au moins un aliment du catalogue
  // (5 sur les 14 réglementaires ici) : les 9 autres ne peuvent structurellement rejeter aucune
  // recette, les inclure n'ajouterait que des dimensions du powerset toujours no-op.
  // --------------------------------------------------------------------------------------------
  it('propriété : aucune recette conservée ne contient jamais un allergène déclaré, pour toute combinaison', () => {
    const usedAllergens = new Set<AllergenId>()
    for (const food of catalog.foods.values()) {
      for (const fa of food.allergenes) usedAllergens.add(fa.allergenId)
    }
    const allergenList = [...usedAllergens]
    expect(allergenList.length).toBeGreaterThan(0) // garde-fou : le test ne doit pas passer "par vide"

    let combinationsChecked = 0
    for (let mask = 0; mask < 2 ** allergenList.length; mask++) {
      const combo = allergenList.filter((_, i) => (mask & (1 << i)) !== 0)
      const req = makeRequest({ creneau: 'diner', allergies: combo })
      const { candidates } = runExclusionPass(catalog, req)

      for (const recipeId of candidates) {
        const recipe = catalog.recipes.get(recipeId)
        expect(recipe).toBeDefined()
        for (const ingredient of recipe?.ingredients ?? []) {
          const food = catalog.foods.get(ingredient.foodId)
          for (const fa of food?.allergenes ?? []) {
            expect(combo).not.toContain(fa.allergenId)
          }
        }
      }

      // Le garde-fou, appelé sur cette même sortie, ne doit jamais lever.
      expect(() =>
        assertNoDeclaredAllergen(candidates, catalog, { allergies: combo, diet: null, excludedFoodIds: [] })
      ).not.toThrow()

      combinationsChecked++
    }

    expect(combinationsChecked).toBe(2 ** allergenList.length)
  })
})
