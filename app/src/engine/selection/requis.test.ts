// engine/selection/requis.test.ts — couche d'exclusion `requis` (docs/ENGINE.md §6.5 ter ;
// docs/ARCHITECTURE.md §5.2).

import { describe, expect, it } from 'vitest'
import type { RecipeId } from '../domain/index.js'
import { requiredFoodLayer } from './requis.js'
import { runExclusionPass } from './exclusion-pass.js'
import { asExclusionResult, makeCatalog, makeFood, makeIngredient, makeRecipe, makeRequest } from './test-fixtures.js'

describe('selection/requis — requiredFoodLayer', () => {
  it('rejette une recette qui ne contient qu’un des aliments demandés (conjonction)', () => {
    const tomate = makeFood('tomate')
    const basilic = makeFood('basilic')
    const recette = makeRecipe('sauce', { ingredients: [makeIngredient('tomate')] })
    const catalog = makeCatalog([recette], [tomate, basilic])
    const req = makeRequest({ requiredFoodIds: ['tomate', 'basilic'] })

    const config = requiredFoodLayer.configure(req, catalog)
    const result = asExclusionResult(requiredFoodLayer.apply(new Set([recette.id]), config))

    expect(result.kept.size).toBe(0)
    expect(result.rejected).toEqual([
      { recipeId: recette.id, layerId: 'requis', reason: expect.stringContaining('basilic') },
    ])
  })

  it('conserve une recette où l’aliment demandé n’apparaît qu’en ingrédient optionnel', () => {
    const tomate = makeFood('tomate')
    const recette = makeRecipe('sauce', { ingredients: [makeIngredient('tomate', { optionnel: true })] })
    const catalog = makeCatalog([recette], [tomate])
    const req = makeRequest({ requiredFoodIds: ['tomate'] })

    const config = requiredFoodLayer.configure(req, catalog)
    const result = asExclusionResult(requiredFoodLayer.apply(new Set([recette.id]), config))

    expect(result.kept).toEqual(new Set([recette.id]))
    expect(result.rejected).toEqual([])
  })

  it('est inerte quand aucun aliment n’est requis (requiredFoodIds vide) — tout est conservé', () => {
    const recette = makeRecipe('sauce', { ingredients: [] })
    const catalog = makeCatalog([recette])
    const req = makeRequest({ requiredFoodIds: [] })

    const config = requiredFoodLayer.configure(req, catalog)
    const result = asExclusionResult(requiredFoodLayer.apply(new Set([recette.id]), config))

    expect(result.kept).toEqual(new Set([recette.id]))
    expect(result.rejected).toEqual([])
  })

  it('le motif de rejet nomme les aliments MANQUANTS, pas ceux déjà présents', () => {
    const tomate = makeFood('tomate')
    const basilic = makeFood('basilic')
    const recette = makeRecipe('sauce', { ingredients: [makeIngredient('tomate')] })
    const catalog = makeCatalog([recette], [tomate, basilic])
    const req = makeRequest({ requiredFoodIds: ['tomate', 'basilic'] })

    const config = requiredFoodLayer.configure(req, catalog)
    const result = asExclusionResult(requiredFoodLayer.apply(new Set([recette.id]), config))

    expect(result.rejected[0]?.reason).toContain('basilic')
    expect(result.rejected[0]?.reason).not.toContain('tomate')
  })

  it('aucune recette ne satisfait l’exigence → ensemble conservé vide, chaque rejet porte un motif exploitable', () => {
    const tomate = makeFood('tomate')
    const soupe = makeRecipe('soupe', { ingredients: [] })
    const salade = makeRecipe('salade', { ingredients: [] })
    const catalog = makeCatalog([soupe, salade], [tomate])
    const req = makeRequest({ requiredFoodIds: ['tomate'] })

    const config = requiredFoodLayer.configure(req, catalog)
    const result = asExclusionResult(requiredFoodLayer.apply(new Set([soupe.id, salade.id]), config))

    expect(result.kept.size).toBe(0)
    expect(result.rejected).toHaveLength(2)
    for (const entry of result.rejected) {
      expect(entry.reason).toContain('tomate')
    }
  })

  it('id/kind/critical/defaultWeight conformes au registre (§6.3 ENGINE) — non critique, miroir d’exclusions', () => {
    expect(requiredFoodLayer.id).toBe('requis')
    expect(requiredFoodLayer.kind).toBe('exclusion')
    expect(requiredFoodLayer.critical).toBe(false)
    expect(requiredFoodLayer.defaultWeight).toBe(0)
  })

  it('un candidat absent du catalogue (id orphelin) est rejeté dès qu’un aliment est requis (aucun ingrédient connu)', () => {
    const catalog = makeCatalog([])
    const req = makeRequest({ requiredFoodIds: ['tomate'] })
    const config = requiredFoodLayer.configure(req, catalog)

    const result = asExclusionResult(requiredFoodLayer.apply(new Set(['inconnu' as RecipeId]), config))

    expect(result.kept.size).toBe(0)
    expect(result.rejected).toEqual([
      { recipeId: 'inconnu' as RecipeId, layerId: 'requis', reason: expect.stringContaining('tomate') },
    ])
  })
})

describe('selection/requis — interaction avec runExclusionPass', () => {
  it('une recette rejetée par `requis` sort bien de l’ensemble candidat de la passe complète', () => {
    const tomate = makeFood('tomate')
    const carotte = makeFood('carotte')
    const soupeTomate = makeRecipe('soupe_tomate', { ingredients: [makeIngredient('tomate')] })
    const soupeCarotte = makeRecipe('soupe_carotte', { ingredients: [makeIngredient('carotte')] })
    const catalog = makeCatalog([soupeTomate, soupeCarotte], [tomate, carotte])
    const req = makeRequest({ requiredFoodIds: ['tomate'] })

    const { candidates, rejections } = runExclusionPass(catalog, req)

    expect(candidates).toEqual(new Set([soupeTomate.id]))
    expect(rejections).toEqual([
      { recipeId: soupeCarotte.id, layerId: 'requis', reason: expect.stringContaining('tomate') },
    ])
  })
})
