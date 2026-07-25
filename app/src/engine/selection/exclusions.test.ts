// engine/selection/exclusions.test.ts — couche d'exclusion `exclusions` (docs/ENGINE.md §6 ;
// docs/ARCHITECTURE.md §5.2).

import { describe, expect, it } from 'vitest'
import type { RecipeId } from '../domain/index.js'
import { personalExclusionLayer } from './exclusions.js'
import { runExclusionPass } from './exclusion-pass.js'
import { asExclusionResult, makeCatalog, makeFood, makeIngredient, makeRecipe, makeRequest } from './test-fixtures.js'

describe('selection/exclusions — personalExclusionLayer', () => {
  it('exclut une recette contenant un aliment exclu en ingrédient non-optionnel', () => {
    const brocoli = makeFood('brocoli')
    const recette = makeRecipe('gratin', { ingredients: [makeIngredient('brocoli')] })
    const catalog = makeCatalog([recette], [brocoli])
    const req = makeRequest({ excludedFoodIds: ['brocoli'] })

    const config = personalExclusionLayer.configure(req, catalog)
    const result = asExclusionResult(personalExclusionLayer.apply(new Set([recette.id]), config))

    expect(result.kept.size).toBe(0)
    expect(result.rejected).toEqual([
      { recipeId: recette.id, layerId: 'exclusions', reason: expect.stringContaining('brocoli') },
    ])
  })

  it('conserve une recette où l’aliment exclu n’apparaît qu’en ingrédient optionnel', () => {
    const brocoli = makeFood('brocoli')
    const recette = makeRecipe('gratin', { ingredients: [makeIngredient('brocoli', { optionnel: true })] })
    const catalog = makeCatalog([recette], [brocoli])
    const req = makeRequest({ excludedFoodIds: ['brocoli'] })

    const config = personalExclusionLayer.configure(req, catalog)
    const result = asExclusionResult(personalExclusionLayer.apply(new Set([recette.id]), config))

    expect(result.kept).toEqual(new Set([recette.id]))
    expect(result.rejected).toEqual([])
  })

  it('conserve une recette dont aucun ingrédient ne porte un aliment exclu', () => {
    const carotte = makeFood('carotte')
    const recette = makeRecipe('soupe', { ingredients: [makeIngredient('carotte')] })
    const catalog = makeCatalog([recette], [carotte])
    const req = makeRequest({ excludedFoodIds: ['brocoli'] })

    const config = personalExclusionLayer.configure(req, catalog)
    const result = asExclusionResult(personalExclusionLayer.apply(new Set([recette.id]), config))

    expect(result.kept).toEqual(new Set([recette.id]))
    expect(result.rejected).toEqual([])
  })

  it('est inerte quand aucun aliment n’est exclu (excludedFoodIds vide)', () => {
    const brocoli = makeFood('brocoli')
    const recette = makeRecipe('gratin', { ingredients: [makeIngredient('brocoli')] })
    const catalog = makeCatalog([recette], [brocoli])
    const req = makeRequest({ excludedFoodIds: [] })

    const config = personalExclusionLayer.configure(req, catalog)
    const result = asExclusionResult(personalExclusionLayer.apply(new Set([recette.id]), config))

    expect(result.kept).toEqual(new Set([recette.id]))
    expect(result.rejected).toEqual([])
  })

  it('liste tous les aliments exclus trouvés dans le motif de rejet quand plusieurs matchent', () => {
    const brocoli = makeFood('brocoli')
    const celeri = makeFood('celeri')
    const recette = makeRecipe('soupe_verte', {
      ingredients: [makeIngredient('brocoli'), makeIngredient('celeri')],
    })
    const catalog = makeCatalog([recette], [brocoli, celeri])
    const req = makeRequest({ excludedFoodIds: ['brocoli', 'celeri'] })

    const config = personalExclusionLayer.configure(req, catalog)
    const result = asExclusionResult(personalExclusionLayer.apply(new Set([recette.id]), config))

    expect(result.kept.size).toBe(0)
    expect(result.rejected).toHaveLength(1)
    expect(result.rejected[0]?.reason).toContain('brocoli')
    expect(result.rejected[0]?.reason).toContain('celeri')
  })

  it('id/kind/critical/defaultWeight conformes au registre (§6.3 ENGINE) — non critique, à la différence d’allergenes/regime', () => {
    expect(personalExclusionLayer.id).toBe('exclusions')
    expect(personalExclusionLayer.kind).toBe('exclusion')
    expect(personalExclusionLayer.critical).toBe(false)
    expect(personalExclusionLayer.defaultWeight).toBe(0)
  })

  it('un candidat absent du catalogue (id orphelin) ne fait pas planter la couche', () => {
    const catalog = makeCatalog([])
    const req = makeRequest({ excludedFoodIds: ['brocoli'] })
    const config = personalExclusionLayer.configure(req, catalog)

    const result = asExclusionResult(personalExclusionLayer.apply(new Set(['inconnu' as RecipeId]), config))

    expect(result.kept).toEqual(new Set(['inconnu' as RecipeId]))
    expect(result.rejected).toEqual([])
  })
})

describe('selection/exclusions — interaction avec runExclusionPass', () => {
  it('une recette rejetée par `exclusions` sort bien de l’ensemble candidat de la passe complète', () => {
    const brocoli = makeFood('brocoli')
    const carotte = makeFood('carotte')
    const gratin = makeRecipe('gratin', { ingredients: [makeIngredient('brocoli')] })
    const soupe = makeRecipe('soupe', { ingredients: [makeIngredient('carotte')] })
    const catalog = makeCatalog([gratin, soupe], [brocoli, carotte])
    const req = makeRequest({ excludedFoodIds: ['brocoli'] })

    const { candidates, rejections } = runExclusionPass(catalog, req)

    expect(candidates).toEqual(new Set([soupe.id]))
    expect(rejections).toEqual([
      { recipeId: gratin.id, layerId: 'exclusions', reason: expect.stringContaining('brocoli') },
    ])
  })
})
