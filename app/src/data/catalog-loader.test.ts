// data/catalog-loader.test.ts
//
// Preuve que loadCatalog() mappe correctement le catalog.db réel (10 recettes, 30 aliments,
// docs/ETAT.md §6) vers les types domaine de engine/domain/catalog.ts : nutriments/allergènes
// bien rattachés à leur aliment, ingrédients/étapes/facettes bien rattachés à leur recette, et
// les index de CatalogIndexes cohérents avec les données chargées.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AllergenId, Catalog, FoodId, NutrientId, RecipeId } from '../engine/domain/index.js'
import { loadCatalog } from './catalog-loader.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..', '..', '..')
const BUILD_SCRIPT = path.join(REPO_ROOT, 'catalog', 'build.mjs')

describe('data/catalog-loader — loadCatalog(catalog.db réel)', () => {
  let catalog: Catalog
  // Build vers un fichier isolé (pas app/public/catalog/catalog.db) : catalog/build.test.ts
  // reconstruit ce même fichier partagé en parallèle (vitest exécute les fichiers de test en
  // parallèle), et deux builds concurrents sur la même sortie se corrompent l'un l'autre.
  const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-catalog-loader-'))
  const dbPath = path.join(fixtureDir, 'catalog.db')

  beforeAll(() => {
    // Pas de --sources : utilise les vraies sources (catalog/sources, catalog/lexicon,
    // catalog/recipes) — seule la sortie est redirigée vers le fichier isolé ci-dessus.
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

  it('charge 30 aliments et 10 recettes', () => {
    expect(catalog.foods.size).toBe(30)
    expect(catalog.recipes.size).toBe(10)
  })

  it('rattache les nutriments et l’allergène au bon aliment (œuf)', () => {
    const oeuf = catalog.foods.get('oeuf' as FoodId)
    expect(oeuf).toBeDefined()
    expect(oeuf?.nom).toBe('Œuf de poule, entier, cru')
    expect(oeuf?.nutrimentsPour100g.size).toBe(9)
    expect(oeuf?.nutrimentsPour100g.get('energie' as NutrientId)).toBe(143)
    expect(oeuf?.nutrimentsPour100g.get('proteines' as NutrientId)).toBeCloseTo(12.6)
    expect(oeuf?.allergenes).toEqual([{ allergenId: 'oeufs', certitude: 'contient' }])
  })

  it('un aliment sans allergène déclaré a un tableau vide (huile d’olive)', () => {
    const huile = catalog.foods.get('huile_olive' as FoodId)
    expect(huile).toBeDefined()
    expect(huile?.allergenes).toEqual([])
  })

  it('rattache ingrédients, étapes ordonnées et facettes à la bonne recette (omelette)', () => {
    const omelette = catalog.recipes.get('omelette_fines_herbes' as RecipeId)
    expect(omelette).toBeDefined()
    expect(omelette?.ingredients).toHaveLength(5)
    expect(omelette?.etapes.map((e) => e.ordre)).toEqual([1, 2, 3, 4])
    expect(omelette?.facettes).toContainEqual({ facette: 'regime', valeur: 'vegetarien' })
    expect(omelette?.typesRepas).toEqual(['petit_dejeuner', 'dejeuner', 'diner'])

    const oeufIngredient = omelette?.ingredients.find((i) => i.foodId === ('oeuf' as FoodId))
    expect(oeufIngredient?.optionnel).toBe(false)
    const persilIngredient = omelette?.ingredients.find((i) => i.foodId === ('persil' as FoodId))
    expect(persilIngredient?.optionnel).toBe(true)
  })

  it('CatalogIndexes.recipesBySlot est cohérent avec Recipe.typesRepas', () => {
    const dejeuner = catalog.indexes.recipesBySlot.get('dejeuner')
    expect(dejeuner).toBeDefined()
    expect(dejeuner?.has('omelette_fines_herbes' as RecipeId)).toBe(true)

    for (const [slot, recipeIds] of catalog.indexes.recipesBySlot) {
      for (const recipeId of recipeIds) {
        expect(catalog.recipes.get(recipeId)?.typesRepas).toContain(slot)
      }
    }
  })

  it('CatalogIndexes.recipesByAllergen est cohérent avec les ingrédients (gluten → pâtes à l’ail)', () => {
    const glutenRecipes = catalog.indexes.recipesByAllergen.get('gluten' as AllergenId)
    expect(glutenRecipes).toBeDefined()
    expect(glutenRecipes?.has('pates_ail_huile' as RecipeId)).toBe(true)

    for (const [allergenId, recipeIds] of catalog.indexes.recipesByAllergen) {
      for (const recipeId of recipeIds) {
        const recipe = catalog.recipes.get(recipeId)
        const touches = recipe?.ingredients.some((ing) =>
          catalog.foods.get(ing.foodId)?.allergenes.some((a) => a.allergenId === allergenId)
        )
        expect(touches).toBe(true)
      }
    }
  })

  it('topics et substitutions sont des Map vides (tables absentes de catalog.db)', () => {
    expect(catalog.topics.size).toBe(0)
    expect(catalog.substitutions.size).toBe(0)
  })
})
