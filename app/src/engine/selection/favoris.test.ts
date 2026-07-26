// engine/selection/favoris.test.ts — couche d'exclusion `favoris` (docs/ENGINE.md §8.1).

import { describe, expect, it } from 'vitest'
import { favoriteLayer } from './favoris.js'
import { EXCLUSION_LAYERS, runExclusionPass } from './exclusion-pass.js'
import { asExclusionResult, makeCatalog, makeFood, makeIngredient, makeRecipe, makeRequest } from './test-fixtures.js'

describe('selection/favoris — favoriteLayer', () => {
  it('est inerte quand `onlyFavorites` est absent — tout est conservé, y compris hors favoris', () => {
    const riz = makeFood('riz')
    const a = makeRecipe('a', { ingredients: [makeIngredient('riz')] })
    const b = makeRecipe('b', { ingredients: [makeIngredient('riz')] })
    const catalog = makeCatalog([a, b], [riz])
    const req = makeRequest({ favoriteRecipeIds: ['a'] })

    const config = favoriteLayer.configure(req, catalog)
    const result = asExclusionResult(favoriteLayer.apply(new Set([a.id, b.id]), config))

    expect(result.kept).toEqual(new Set([a.id, b.id]))
    expect(result.rejected).toEqual([])
  })

  it('est inerte quand `onlyFavorites` est explicitement faux, même avec une liste de favoris', () => {
    const riz = makeFood('riz')
    const a = makeRecipe('a', { ingredients: [makeIngredient('riz')] })
    const b = makeRecipe('b', { ingredients: [makeIngredient('riz')] })
    const catalog = makeCatalog([a, b], [riz])
    const req = makeRequest({ favoriteRecipeIds: ['a'], onlyFavorites: false })

    const config = favoriteLayer.configure(req, catalog)
    const result = asExclusionResult(favoriteLayer.apply(new Set([a.id, b.id]), config))

    expect(result.kept).toEqual(new Set([a.id, b.id]))
    expect(result.rejected).toEqual([])
  })

  it('sous `onlyFavorites`, ne conserve que les favoris et motive le rejet des autres', () => {
    const riz = makeFood('riz')
    const a = makeRecipe('a', { ingredients: [makeIngredient('riz')] })
    const b = makeRecipe('b', { ingredients: [makeIngredient('riz')] })
    const catalog = makeCatalog([a, b], [riz])
    const req = makeRequest({ favoriteRecipeIds: ['a'], onlyFavorites: true })

    const config = favoriteLayer.configure(req, catalog)
    const result = asExclusionResult(favoriteLayer.apply(new Set([a.id, b.id]), config))

    expect(result.kept).toEqual(new Set([a.id]))
    expect(result.rejected).toEqual([{ recipeId: b.id, layerId: 'favoris', reason: 'hors favoris' }])
  })

  it('sous `onlyFavorites` avec un ensemble de favoris VIDE, ne conserve rien — le filtre dur ne se désactive pas tout seul', () => {
    const riz = makeFood('riz')
    const a = makeRecipe('a', { ingredients: [makeIngredient('riz')] })
    const catalog = makeCatalog([a], [riz])
    const req = makeRequest({ onlyFavorites: true })

    const config = favoriteLayer.configure(req, catalog)
    const result = asExclusionResult(favoriteLayer.apply(new Set([a.id]), config))

    expect(result.kept.size).toBe(0)
    expect(result.rejected).toEqual([{ recipeId: a.id, layerId: 'favoris', reason: 'hors favoris' }])
  })

  it('ignore un favori absent des candidats — un favori hors créneau n’est pas ressuscité', () => {
    const riz = makeFood('riz')
    const a = makeRecipe('a', { ingredients: [makeIngredient('riz')] })
    const b = makeRecipe('b', { ingredients: [makeIngredient('riz')] })
    const catalog = makeCatalog([a, b], [riz])
    const req = makeRequest({ favoriteRecipeIds: ['a', 'b'], onlyFavorites: true })

    // `b` est favori mais n'a pas survécu aux couches précédentes : il ne doit pas réapparaître.
    const config = favoriteLayer.configure(req, catalog)
    const result = asExclusionResult(favoriteLayer.apply(new Set([a.id]), config))

    expect(result.kept).toEqual(new Set([a.id]))
  })
})

describe('selection/favoris — place dans la passe d’exclusion (§6.4 ENGINE)', () => {
  it('est la DERNIÈRE couche : une recette à la fois hors favoris et exclue par un aliment porte le motif d’`exclusions`', () => {
    const riz = makeFood('riz')
    const brocoli = makeFood('brocoli')
    const rejetee = makeRecipe('rejetee', { ingredients: [makeIngredient('brocoli')] })
    const gardee = makeRecipe('gardee', { ingredients: [makeIngredient('riz')] })
    const catalog = makeCatalog([rejetee, gardee], [riz, brocoli])
    const req = makeRequest({
      excludedFoodIds: ['brocoli'],
      favoriteRecipeIds: ['gardee'],
      onlyFavorites: true,
    })

    const { candidates, rejections } = runExclusionPass(catalog, req)

    expect(candidates).toEqual(new Set([gardee.id]))
    expect(rejections).toEqual([
      { recipeId: rejetee.id, layerId: 'exclusions', reason: expect.stringContaining('brocoli') },
    ])
  })

  it('`favoris` figure bien en dernier dans EXCLUSION_LAYERS', () => {
    expect(EXCLUSION_LAYERS[EXCLUSION_LAYERS.length - 1]?.id).toBe('favoris')
  })
})
