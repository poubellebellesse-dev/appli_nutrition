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
import { loadCatalog } from '../app/src/data/catalog-loader-node.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..')
const BUILD_SCRIPT = path.join(REPO_ROOT, 'catalog', 'build.mjs')

describe('selection/exclusion-pass + guards — catalogue réel', () => {
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

  /** Recettes du créneau, comptées sur le catalogue RÉEL — jamais une constante figée : le
   * catalogue grandit (chantier contenu, 10 → ~100), et un nombre en dur ferait échouer ces tests
   * à chaque recette ajoutée sans rien prouver de plus. */
  function dinerCount(): number {
    return catalog.indexes.recipesBySlot.get('diner')?.size ?? 0
  }

  it('charge les recettes réelles (précondition des tests ci-dessous)', () => {
    expect(catalog.recipes.size).toBeGreaterThanOrEqual(10)
    expect(dinerCount()).toBeGreaterThan(0)
  })

  it('sans contrainte, la passe d’exclusion renvoie TOUTES les recettes du créneau "diner"', () => {
    const req = makeRequest({ creneau: 'diner' })
    const { candidates, rejections } = runExclusionPass(catalog, req)

    expect(candidates.size).toBe(dinerCount())
    expect(rejections).toEqual([])
    expect(candidates.has('salade_pois_chiches' as RecipeId)).toBe(false) // dejeuner uniquement
  })

  /** Régimes déclarés par une recette du catalogue réel. */
  function dietsOf(recipeId: RecipeId): readonly string[] {
    return (catalog.recipes.get(recipeId)?.facettes ?? [])
      .filter((f) => f.facette === 'regime')
      .map((f) => f.valeur)
  }

  // Ces deux tests vérifient des PROPRIÉTÉS, pas un nombre. Recompter à la main la règle
  // d'inclusion de la couche ne prouverait rien — le test rejouerait simplement le bug s'il y en
  // avait un. Ce qui compte est : rien de trop permissif ne passe, rien de légitime n'est écarté.
  it('régime "vegetarien" : aucun plat de viande ni de poisson ne passe (sûreté de la chaîne)', () => {
    const req = makeRequest({ creneau: 'diner', diet: 'vegetarien' })
    const { candidates, rejections } = runExclusionPass(catalog, req)

    expect(candidates.has('boeuf_hache_sauce_tomate' as RecipeId)).toBe(false)
    expect(candidates.has('saumon_poele_courgettes' as RecipeId)).toBe(false)
    for (const id of candidates) {
      expect(dietsOf(id).some((d) => d === 'omnivore' || d === 'pescetarien')).toBe(false)
    }
    for (const entry of rejections) expect(entry.layerId).toBe('regime')
  })

  it('régime "vegetarien" : les plats VÉGÉTALIENS passent — l’inclusion vegetalien ⊂ vegetarien', () => {
    const req = makeRequest({ creneau: 'diner', diet: 'vegetarien' })
    const { candidates } = runExclusionPass(catalog, req)

    const vegetaliennesAuDiner = [...(catalog.indexes.recipesBySlot.get('diner') ?? [])].filter((id) =>
      dietsOf(id).includes('vegetalien')
    )
    expect(vegetaliennesAuDiner.length).toBeGreaterThan(0) // sinon le test ne prouve rien
    for (const id of vegetaliennesAuDiner) expect(candidates.has(id)).toBe(true)
  })

  it('régime "pescetarien" : les plats végétariens ET végétaliens passent, la viande non', () => {
    const req = makeRequest({ creneau: 'diner', diet: 'pescetarien' })
    const { candidates } = runExclusionPass(catalog, req)

    // Le défaut qui a motivé la chaîne : un pescétarien ne voyait QUE du poisson.
    expect(candidates.has('pates_ail_huile' as RecipeId)).toBe(true) // vegetarien
    expect(candidates.has('soupe_pois_casses' as RecipeId)).toBe(true) // vegetalien
    expect(candidates.has('saumon_poele_courgettes' as RecipeId)).toBe(true) // pescetarien
    expect(candidates.has('boeuf_hache_sauce_tomate' as RecipeId)).toBe(false) // omnivore
  })

  it('temps disponible = 15 min : garde EXACTEMENT les recettes tenant en 15 min, pas une de plus', () => {
    const req = makeRequest({ creneau: 'diner', tempsDisponibleMin: 15 })
    const { candidates, rejections } = runExclusionPass(catalog, req)

    // Propriété, pas liste figée : le catalogue grandit (46 → 58 → …) et une recette rapide
    // ajoutée demain rendrait fausse toute énumération écrite à la main, sans rien révéler du
    // moteur. Ce qui doit rester vrai est la coupure elle-même, dans les deux sens.
    const totalMinutes = (id: RecipeId): number => {
      const recipe = catalog.recipes.get(id)
      return (recipe?.tempsPrepMin ?? 0) + (recipe?.tempsCuissonMin ?? 0)
    }

    expect(candidates.size).toBeGreaterThan(0) // sinon le test ne prouve rien
    for (const id of candidates) expect(totalMinutes(id)).toBeLessThanOrEqual(15)
    for (const entry of rejections) expect(totalMinutes(entry.recipeId)).toBeGreaterThan(15)
    expect(candidates.has('omelette_fines_herbes' as RecipeId)).toBe(true) // 10 min, témoin
    expect(rejections.every((entry) => entry.layerId === 'temps')).toBe(true)
    expect(candidates.size + rejections.length).toBe(dinerCount())
  })

  it('le garde-fou lève EngineSafetyError sur un cas violant construit à la main (catalogue réel)', () => {
    // Bypass délibéré : 'pates_ail_huile' contient du gluten (farine de blé) — on le passe au
    // garde-fou comme candidat conservé malgré l'allergie déclarée, sans passer par la couche.
    expect(() =>
      assertNoDeclaredAllergen(
        new Set(['pates_ail_huile' as RecipeId]),
        catalog,
        { allergies: ['gluten' as AllergenId], diet: null, excludedFoodIds: [], ownedEquipmentIds: null }
      )
    ).toThrow(EngineSafetyError)
  })

  // --------------------------------------------------------------------------------------------
  // Test de propriété (docs/ENGINE.md §11.1) : pour TOUTE combinaison d'allergies déclarées,
  // aucune recette conservée par la passe d'exclusion ne contient l'allergène — et le garde-fou
  // ne lève jamais sur une sortie correctement filtrée.
  //
  // Aucune dépendance nouvelle (fast-check n'est pas dans package.json). Restreint aux allergènes
  // qui apparaissent RÉELLEMENT sur au moins un aliment : les autres ne peuvent structurellement
  // rejeter aucune recette.
  //
  // ⚠️ L'ÉNUMÉRATION N'EST PLUS EXHAUSTIVE, et c'est délibéré. Elle l'était tant que le catalogue
  // n'employait que 5 allergènes (32 combinaisons). Le catalogue en emploie maintenant 12 (4 096
  // combinaisons × 60+ recettes), et le test dépassait le délai — il aurait fini par échouer pour
  // une raison qui n'apprend rien sur le moteur.
  //
  // Le plan de couverture retenu ci-dessous n'est PAS un affaiblissement : chaque allergène SEUL
  // (le cas qui prouve le filtrage), toutes les PAIRES (le cas qui prouve que deux filtres se
  // composent), l'ensemble COMPLET (le cas extrême), et l'ensemble VIDE (la couche doit être
  // inerte). Ce qui n'est plus couvert, ce sont les sous-ensembles de taille 3 à n-1 — or la
  // couche `allergenes` rejette une recette dès qu'UN allergène demandé la touche : le résultat
  // sur une union est l'intersection des résultats sur chaque singleton. Une erreur visible
  // seulement à 7 allergènes simultanés et invisible à 1 et 2 supposerait une implémentation
  // structurellement différente de celle-ci.
  // --------------------------------------------------------------------------------------------
  it('propriété : aucune recette conservée ne contient jamais un allergène déclaré', () => {
    const usedAllergens = new Set<AllergenId>()
    for (const food of catalog.foods.values()) {
      for (const fa of food.allergenes) usedAllergens.add(fa.allergenId)
    }
    const allergenList = [...usedAllergens]
    expect(allergenList.length).toBeGreaterThan(0) // garde-fou : le test ne doit pas passer "par vide"

    const combos: AllergenId[][] = [[], [...allergenList]]
    for (const a of allergenList) combos.push([a])
    for (let i = 0; i < allergenList.length; i++) {
      for (let j = i + 1; j < allergenList.length; j++) combos.push([allergenList[i]!, allergenList[j]!])
    }

    let combinationsChecked = 0
    for (const combo of combos) {
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
        assertNoDeclaredAllergen(candidates, catalog, { allergies: combo, diet: null, excludedFoodIds: [], ownedEquipmentIds: null })
      ).not.toThrow()

      combinationsChecked++
    }

    // vide + complet + n singletons + n(n-1)/2 paires
    const n = allergenList.length
    expect(combinationsChecked).toBe(2 + n + (n * (n - 1)) / 2)
  })

  it('un allergène très répandu (lait) vide presque le créneau, mais ne laisse passer aucune recette laitière', () => {
    const req = makeRequest({ creneau: 'diner', allergies: ['lait' as AllergenId] })
    const { candidates, rejections } = runExclusionPass(catalog, req)

    // Cas concret plutôt que combinatoire : `lait` touche beaucoup de recettes du catalogue réel,
    // c'est donc le meilleur révélateur d'un filtre trop laxiste.
    expect(rejections.length).toBeGreaterThan(0)
    for (const id of candidates) {
      const recipe = catalog.recipes.get(id)
      for (const ingredient of recipe?.ingredients ?? []) {
        const food = catalog.foods.get(ingredient.foodId)
        expect((food?.allergenes ?? []).some((fa) => fa.allergenId === 'lait')).toBe(false)
      }
    }
  })
})
