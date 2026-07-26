// data/catalog-loader.test.ts
//
// Preuve que loadCatalog() mappe correctement le catalog.db réel (10 recettes, 76 aliments,
// docs/ETAT.md §6) vers les types domaine de engine/domain/catalog.ts : nutriments/allergènes
// bien rattachés à leur aliment, ingrédients/étapes/facettes bien rattachés à leur recette, et
// les index de CatalogIndexes cohérents avec les données chargées.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
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

  // Comptes NON figés côté recettes : le catalogue grandit (chantier contenu, 10 → ~100). Ce que
  // ce test prouve est que le loader ne PERD rien entre catalog.db et le `Catalog` en mémoire, pas
  // qu'il y a exactement N recettes — d'où la comparaison au compte lu en base.
  it('charge les aliments et TOUTES les recettes de catalog.db, sans perte', () => {
    const db = new DatabaseSync(dbPath, { readOnly: true })
    try {
      const foods = db.prepare('SELECT COUNT(*) as count FROM food').get() as { count: number }
      const recipes = db.prepare('SELECT COUNT(*) as count FROM recipe').get() as { count: number }
      expect(catalog.foods.size).toBe(foods.count)
      expect(catalog.recipes.size).toBe(recipes.count)
    } finally {
      db.close()
    }
    expect(catalog.foods.size).toBeGreaterThanOrEqual(76)
    expect(catalog.recipes.size).toBeGreaterThanOrEqual(10)
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

  it('mappe saisonMois et touteAnnee depuis la base — staple toute l’année (huile d’olive)', () => {
    const huile = catalog.foods.get('huile_olive' as FoodId)
    expect(huile).toBeDefined()
    expect(huile?.touteAnnee).toBe(true)
    expect(huile?.saisonMois).toEqual([])
  })

  it('mappe saisonMois et touteAnnee depuis la base — aliment saisonnier (tomate)', () => {
    const tomate = catalog.foods.get('tomate' as FoodId)
    expect(tomate).toBeDefined()
    expect(tomate?.touteAnnee).toBe(false)
    expect(tomate?.saisonMois.length).toBeGreaterThan(0)
    for (const mois of tomate?.saisonMois ?? []) {
      expect(mois).toBeGreaterThanOrEqual(1)
      expect(mois).toBeLessThanOrEqual(12)
    }
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

  // Décision utilisateur du jour : `Nutrient.sens` pilote l'asymétrie de `scoreNutri`
  // (docs/ENGINE.md §6.5) — filet contre une donnée oubliée sur le catalogue réel.
  it('les 9 nutriments portent un sens — sodium plafond, fer plancher', () => {
    expect(catalog.nutrients).toHaveLength(9)
    for (const nutrient of catalog.nutrients) {
      expect(['cible', 'plancher', 'plafond']).toContain(nutrient.sens)
    }

    const sodium = catalog.nutrients.find((n) => n.id === ('sodium' as NutrientId))
    expect(sodium?.sens).toBe('plafond')

    const fer = catalog.nutrients.find((n) => n.id === ('fer' as NutrientId))
    expect(fer?.sens).toBe('plancher')
  })

  it('topics et substitutions sont des Map vides (tables absentes de catalog.db)', () => {
    expect(catalog.topics.size).toBe(0)
    expect(catalog.substitutions.size).toBe(0)
  })
})
