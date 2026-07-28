// tests/regime-coherence.test.ts — l'étiquette `regime` de chaque recette correspond-elle à ses
// INGRÉDIENTS ? (docs/ETAT.md décision 28, §6.3 ter ENGINE)
//
// POURQUOI CE TEST EXISTE. Un bug réel, trouvé le 2026-07-28 en cherchant des effets de bord :
// « Tofu laqué à la sauce soja et au sésame » se déclarait `vegetalien` et contenait du MIEL. Rien
// n'échouait — un utilisateur végétalien se voyait simplement proposer un produit animal, ce qui
// est la promesse centrale de l'appli en défaut.
//
// C'est le mode de défaillance SILENCIEUX que la décision 28 reprochait aux étiquettes multiples.
// L'étiquette unique ne l'élimine pas : elle le déplace. Seule une vérification contre les
// ingrédients le rattrape, et elle doit tourner à chaque build, pas une fois.
//
// Le même balayage a trouvé 6 recettes étiquetées `vegetarien` alors qu'elles sont végétaliennes —
// défaut inverse, silencieux lui aussi : la recette disparaît des suggestions de qui pourrait la
// manger, sans que rien ne le signale.
//
// Ce fichier vit hors de app/src/engine/ parce qu'il charge le vrai catalog.db via data/ — import
// interdit à l'intérieur de engine/ (tests/engine-boundaries.test.ts).

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Catalog, DietCode, Food, Recipe } from '../app/src/engine/domain/index.js'
import { DIET_CHAIN } from '../app/src/engine/selection/index.js'
import { loadCatalog } from '../app/src/data/catalog-loader.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..')
const BUILD_SCRIPT = path.join(REPO_ROOT, 'catalog', 'build.mjs')

/** Boissons végétales : elles portent le groupe `lait et produits laitiers` sans en être. */
const BOISSONS_VEGETALES = new Set(['boisson_soja', 'boisson_amande', 'boisson_avoine'])

/**
 * Le régime le plus RESTRICTIF qu'un aliment autorise encore.
 *
 * ⚠️ Le beurre et la crème sont classés en « matières grasses », PAS en « lait et produits
 * laitiers » — s'en remettre au seul groupe les ferait passer pour végétaliens. Une première
 * version de cette règle signalait « Radis au beurre » comme végétalienne.
 *
 * ⚠️ Le miel non plus n'est dans aucun groupe animal : c'est un produit sucré. C'est précisément
 * lui qui a fait passer une recette au miel pour végétalienne.
 */
function exigenceDe(food: Food): DietCode {
  if (food.groupe === 'viandes') return 'omnivore'
  if (food.groupe === 'poissons' || food.groupe === 'fruits de mer') return 'pescetarien'
  if (food.groupe === 'œufs') return 'vegetarien'
  if (food.groupe === 'lait et produits laitiers' && !BOISSONS_VEGETALES.has(food.id)) return 'vegetarien'
  if (food.id === 'miel' || food.id.startsWith('beurre') || food.id.startsWith('creme')) return 'vegetarien'
  return 'vegetalien'
}

const rang = (diet: string) => DIET_CHAIN.indexOf(diet as DietCode)

/** Régime minimal imposé par les ingrédients, avec l'aliment qui l'impose (pour le message d'échec). */
function exigenceRecette(recipe: Recipe, catalog: Catalog): { diet: DietCode; coupable: string } {
  let diet: DietCode = 'vegetalien'
  let coupable = '—'
  for (const ingredient of recipe.ingredients) {
    const food = catalog.foods.get(ingredient.foodId)
    if (food === undefined) continue
    const exigence = exigenceDe(food)
    if (rang(exigence) > rang(diet)) {
      diet = exigence
      coupable = food.nom
    }
  }
  return { diet, coupable }
}

describe('catalogue réel — cohérence entre l’étiquette `regime` et les ingrédients', () => {
  let catalog: Catalog
  const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-regime-'))
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

  it('⛔ AUCUNE recette n’est étiquetée PLUS PERMISSIVE que ses ingrédients', () => {
    // Le défaut grave : un végétalien à qui l'on propose du miel, un végétarien à qui l'on propose
    // du poisson. C'est le bug réel qui a motivé ce fichier.
    const fautives: string[] = []
    for (const recipe of catalog.recipes.values()) {
      const declare = recipe.facettes.find((f) => f.facette === 'regime')?.valeur
      if (declare === undefined || rang(declare) < 0) continue
      const { diet, coupable } = exigenceRecette(recipe, catalog)
      if (rang(declare) < rang(diet)) {
        fautives.push(`« ${recipe.nom} » déclare ${declare} mais contient ${coupable} (exige ${diet})`)
      }
    }
    expect(fautives).toEqual([])
  })

  it('⚠️ AUCUNE recette n’est étiquetée plus RESTRICTIVE que nécessaire', () => {
    // Défaut inverse et silencieux : la recette disparaît des suggestions de qui pourrait la manger.
    // Six recettes végétaliennes étaient étiquetées `vegetarien` avant la correction du 2026-07-28.
    const fautives: string[] = []
    for (const recipe of catalog.recipes.values()) {
      const declare = recipe.facettes.find((f) => f.facette === 'regime')?.valeur
      if (declare === undefined || rang(declare) < 0) continue
      const { diet } = exigenceRecette(recipe, catalog)
      if (rang(declare) > rang(diet)) fautives.push(`« ${recipe.nom} » déclare ${declare}, pourrait être ${diet}`)
    }
    expect(fautives).toEqual([])
  })

  it('chaque recette porte EXACTEMENT une étiquette de régime', () => {
    // Décision 28 : une recette déclare UN SEUL régime, le plus restrictif qu'elle respecte. Zéro
    // étiquette la rend invisible à tout filtre de régime ; deux rouvrent le mode de défaillance
    // que la hiérarchie `DIET_CHAIN` existe pour éviter.
    for (const recipe of catalog.recipes.values()) {
      const regimes = recipe.facettes.filter((f) => f.facette === 'regime')
      expect(regimes, `« ${recipe.nom} »`).toHaveLength(1)
    }
  })
})
