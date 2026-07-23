// engine/selection/temps.test.ts — couche d'exclusion `temps` (docs/ENGINE.md §6 ;
// docs/ARCHITECTURE.md §5.2).

import { describe, expect, it } from 'vitest'
import { timeLayer } from './temps.js'
import { asExclusionResult, makeCatalog, makeRecipe, makeRequest } from './test-fixtures.js'

describe('selection/temps — timeLayer', () => {
  it('est inerte quand aucun temps disponible n’est déclaré (null)', () => {
    const recette = makeRecipe('mijote', { tempsPrepMin: 30, tempsCuissonMin: 120 })
    const catalog = makeCatalog([recette])
    const req = makeRequest({ tempsDisponibleMin: null })

    const config = timeLayer.configure(req, catalog)
    const result = asExclusionResult(timeLayer.apply(new Set([recette.id]), config))

    expect(result.kept).toEqual(new Set([recette.id]))
    expect(result.rejected).toEqual([])
  })

  it('exclut une recette dont temps_prep + temps_cuisson dépasse le temps disponible', () => {
    const recette = makeRecipe('mijote', { tempsPrepMin: 15, tempsCuissonMin: 30 }) // 45 min
    const catalog = makeCatalog([recette])
    const req = makeRequest({ tempsDisponibleMin: 30 })

    const config = timeLayer.configure(req, catalog)
    const result = asExclusionResult(timeLayer.apply(new Set([recette.id]), config))

    expect(result.kept.size).toBe(0)
    expect(result.rejected).toEqual([
      { recipeId: recette.id, layerId: 'temps', reason: expect.stringContaining('45') },
    ])
  })

  it('conserve une recette dont le temps total est strictement inférieur au temps disponible', () => {
    const recette = makeRecipe('rapide', { tempsPrepMin: 5, tempsCuissonMin: 5 }) // 10 min
    const catalog = makeCatalog([recette])
    const req = makeRequest({ tempsDisponibleMin: 30 })

    const config = timeLayer.configure(req, catalog)
    const result = asExclusionResult(timeLayer.apply(new Set([recette.id]), config))

    expect(result.kept).toEqual(new Set([recette.id]))
  })

  it('conserve une recette au cas limite : temps total == temps disponible (comparaison stricte >)', () => {
    const recette = makeRecipe('pile', { tempsPrepMin: 10, tempsCuissonMin: 20 }) // 30 min
    const catalog = makeCatalog([recette])
    const req = makeRequest({ tempsDisponibleMin: 30 })

    const config = timeLayer.configure(req, catalog)
    const result = asExclusionResult(timeLayer.apply(new Set([recette.id]), config))

    expect(result.kept).toEqual(new Set([recette.id]))
  })

  it('id/kind/critical conformes au registre (§6.3 ENGINE) — non critique', () => {
    expect(timeLayer.id).toBe('temps')
    expect(timeLayer.kind).toBe('exclusion')
    expect(timeLayer.critical).toBe(false)
  })
})
