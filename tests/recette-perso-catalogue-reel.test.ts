// tests/recette-perso-catalogue-reel.test.ts — une recette composée par l'utilisateur, fusionnée
// dans le catalogue RÉEL et passée au moteur.
//
// ⚠️ CE FICHIER GARDE UN TROU DE SÛRETÉ QUI A RÉELLEMENT EXISTÉ pendant l'écriture de la
// fonctionnalité. `attachDerivedIndexes` — appelé par `createEngine` — ne recalcule QUE la famille
// nutriments/signatures : il recopie `recipesBySlot`, `recipesByDiet` et `recipesByAllergen` tels
// que le loader les a construits. Ajouter une recette à `catalog.recipes` sans reconstruire ces
// index produisait deux défauts, tous deux SILENCIEUX :
//   1. absente de `recipesBySlot`, la recette n'était jamais candidate — `runSuggestMeals` part de
//      cet index ;
//   2. absente de `recipesByAllergen`, elle échappait à l'index sur lequel repose l'exclusion des
//      allergènes.
// Le second est le vrai danger : le garde-fou le plus critique du moteur (§5.2 ARCHITECTURE),
// contourné par une recette que l'utilisateur a lui-même saisie.

import { beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AllergenId, Catalog, FoodId, MealSlot, RecipeId } from '../app/src/engine/domain/index.js'
import { createEngine } from '../app/src/engine/api/index.js'
import { makeRequest } from '../app/src/engine/selection/test-fixtures.js'
import { loadCatalog } from '../app/src/data/catalog-loader-node.js'
// `avecRecettesSupplementaires` vit dans le loader NAVIGATEUR : c'est une fonction pure, sans aucun
// import Node — la variante `-node` n'expose que l'ouverture du fichier.
import { avecRecettesSupplementaires } from '../app/src/data/catalog-loader.js'
import {
  AXES_PAR_DEFAUT,
  construireRecette,
  versRecette,
  type SaisieRecette,
} from '../app/src/data/user-recipe.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..')
const BUILD_SCRIPT = path.join(REPO_ROOT, 'catalog', 'build.mjs')

const CRENEAU: MealSlot = 'diner'

describe('recette utilisateur — fusionnée dans le catalogue réel', () => {
  let source: Catalog
  /** Un aliment réel porteur d'un allergène, choisi dans le catalogue plutôt qu'inventé. */
  let alimentAllergene: { readonly foodId: FoodId; readonly allergene: AllergenId }
  let alimentNeutre: FoodId

  beforeAll(() => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-perso-'))
    const dbPath = path.join(fixtureDir, 'catalog.db')
    const result = spawnSync(process.execPath, ['--experimental-sqlite', BUILD_SCRIPT, '--out', dbPath], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    source = loadCatalog(dbPath)

    for (const food of source.foods.values()) {
      if (alimentAllergene === undefined && food.allergenes.length > 0) {
        alimentAllergene = { foodId: food.id, allergene: food.allergenes[0]!.allergenId }
      }
      if (alimentNeutre === undefined && food.allergenes.length === 0) alimentNeutre = food.id
    }
    expect(alimentAllergene).toBeDefined()
    expect(alimentNeutre).toBeDefined()
  })

  const saisieAvec = (foodIds: readonly FoodId[], nom: string): SaisieRecette => ({
    nom,
    tempsPrepMin: 10,
    tempsCuissonMin: 5,
    portionsBase: 2,
    difficulte: 1,
    typesRepas: [CRENEAU],
    envergure: 'quotidien',
    conservationJours: 2,
    axes: AXES_PAR_DEFAUT,
    ingredients: foodIds.map((foodId) => ({
      foodId,
      quantiteG: 150,
      uniteAffichage: '150 g',
      optionnel: false,
    })),
    etapes: ['Tout mélanger.'],
    estSauce: false,
  })

  const catalogueAvec = (foodIds: readonly FoodId[], id: string, nom: string): Catalog => {
    const stockee = construireRecette(id, saisieAvec(foodIds, nom), null)
    return avecRecettesSupplementaires(source, [versRecette(stockee, source.foods)])
  }

  it('entre RÉELLEMENT dans les suggestions — l’index par créneau est reconstruit', () => {
    // Défaut n°1 : sans reconstruction, la recette existe dans `catalog.recipes` et n'est jamais
    // proposée. Rien n'échoue, rien ne s'affiche.
    const catalogue = catalogueAvec([alimentNeutre], 'perso:visible', 'Mon plat à moi')
    expect(catalogue.indexes.recipesBySlot.get(CRENEAU)?.has('perso:visible' as RecipeId)).toBe(true)

    const moteur = createEngine(catalogue)
    const requete = { ...makeRequest({ creneau: CRENEAU }), limit: 400 }
    const proposes = moteur.suggestMeals(requete).suggestions.map((s) => s.recipeId)
    expect(proposes).toContain('perso:visible')
  })

  it('⛔ N’EST JAMAIS PROPOSÉE quand elle contient un allergène déclaré', () => {
    // Défaut n°2, le grave. Le filtre allergènes n'est « jamais pondéré ni contournable » (§5.2) —
    // y compris pour une recette que l'utilisateur a composée lui-même.
    const catalogue = catalogueAvec(
      [alimentAllergene.foodId, alimentNeutre],
      'perso:risque',
      'Mon plat qui pique'
    )
    expect(catalogue.indexes.recipesByAllergen.get(alimentAllergene.allergene)?.has('perso:risque' as RecipeId)).toBe(
      true
    )

    const moteur = createEngine(catalogue)
    const requete = {
      ...makeRequest({ creneau: CRENEAU, allergies: [alimentAllergene.allergene] }),
      limit: 400,
    }
    const proposes = moteur.suggestMeals(requete).suggestions.map((s) => s.recipeId)
    expect(proposes).not.toContain('perso:risque')
  })

  it('reste proposée à qui n’a PAS déclaré cet allergène — l’exclusion n’est pas un bannissement', () => {
    const catalogue = catalogueAvec([alimentAllergene.foodId], 'perso:risque', 'Mon plat qui pique')
    const moteur = createEngine(catalogue)
    const proposes = moteur
      .suggestMeals({ ...makeRequest({ creneau: CRENEAU }), limit: 400 })
      .suggestions.map((s) => s.recipeId)
    expect(proposes).toContain('perso:risque')
  })

  it('respecte le régime DÉRIVÉ de ses ingrédients, pas un régime déclaré', () => {
    // Une recette composée avec de la viande ne doit pas apparaître pour un végétarien, alors même
    // que personne ne l'a étiquetée.
    const viande = [...source.foods.values()].find((f) => f.groupe === 'viandes')
    expect(viande).toBeDefined()
    const catalogue = catalogueAvec([viande!.id], 'perso:viande', 'Mon plat de viande')

    expect(catalogue.indexes.recipesByDiet.get('omnivore')?.has('perso:viande' as RecipeId)).toBe(true)

    const moteur = createEngine(catalogue)
    const proposes = moteur
      .suggestMeals({ ...makeRequest({ creneau: CRENEAU, diet: 'vegetarien' }), limit: 400 })
      .suggestions.map((s) => s.recipeId)
    expect(proposes).not.toContain('perso:viande')
  })

  it('reçoit des valeurs nutritionnelles CALCULÉES, jamais saisies', () => {
    // La règle qui rend la fonctionnalité acceptable : rien n'est écrit à la main, tout vient de
    // CIQUAL par les ingrédients — exactement comme pour une recette du catalogue.
    const catalogue = catalogueAvec([alimentNeutre], 'perso:nutri', 'Mon plat')
    const moteur = createEngine(catalogue)
    // `createEngine` enrichit une COPIE ; on relit par le même chemin que le moteur.
    const rapport = moteur.suggestMeals({ ...makeRequest({ creneau: CRENEAU }), limit: 400 })
    expect(rapport.suggestions.some((s) => s.recipeId === 'perso:nutri')).toBe(true)
  })

  it('laisse le catalogue source INTACT — la fusion ne mute rien', () => {
    const avant = source.recipes.size
    catalogueAvec([alimentNeutre], 'perso:x', 'Mon plat')
    expect(source.recipes.size).toBe(avant)
    expect(source.recipes.has('perso:x' as RecipeId)).toBe(false)
  })
})
