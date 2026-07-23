// engine/selection/regime.test.ts — couche d'exclusion `regime` (docs/ENGINE.md §6 ;
// docs/ARCHITECTURE.md §5.2).

import { describe, expect, it } from 'vitest'
import { dietLayer } from './regime.js'
import { asExclusionResult, makeCatalog, makeRecipe, makeRequest } from './test-fixtures.js'

describe('selection/regime — dietLayer', () => {
  it('est inerte quand aucun régime n’est déclaré (diet = null)', () => {
    const recette = makeRecipe('boeuf', { facettes: [{ facette: 'regime', valeur: 'omnivore' }] })
    const catalog = makeCatalog([recette])
    const req = makeRequest({ diet: null })

    const config = dietLayer.configure(req, catalog)
    const result = asExclusionResult(dietLayer.apply(new Set([recette.id]), config))

    expect(result.kept).toEqual(new Set([recette.id]))
    expect(result.rejected).toEqual([])
  })

  it('conserve une recette dont le régime demandé figure parmi ses facettes', () => {
    const recette = makeRecipe('dahl', { facettes: [{ facette: 'regime', valeur: 'vegetarien' }] })
    const catalog = makeCatalog([recette])
    const req = makeRequest({ diet: 'vegetarien' })

    const config = dietLayer.configure(req, catalog)
    const result = asExclusionResult(dietLayer.apply(new Set([recette.id]), config))

    expect(result.kept).toEqual(new Set([recette.id]))
  })

  it('exclut une recette dont le régime demandé ne figure PAS parmi ses facettes', () => {
    const recette = makeRecipe('boeuf', { facettes: [{ facette: 'regime', valeur: 'omnivore' }] })
    const catalog = makeCatalog([recette])
    const req = makeRequest({ diet: 'vegetarien' })

    const config = dietLayer.configure(req, catalog)
    const result = asExclusionResult(dietLayer.apply(new Set([recette.id]), config))

    expect(result.kept.size).toBe(0)
    expect(result.rejected).toEqual([
      { recipeId: recette.id, layerId: 'regime', reason: expect.stringContaining('vegetarien') },
    ])
  })

  it('exclut une recette sans AUCUNE facette régime quand un régime est demandé (ensemble vide)', () => {
    const recette = makeRecipe('mystere', { facettes: [] })
    const catalog = makeCatalog([recette])
    const req = makeRequest({ diet: 'vegetarien' })

    const config = dietLayer.configure(req, catalog)
    const result = asExclusionResult(dietLayer.apply(new Set([recette.id]), config))

    expect(result.kept.size).toBe(0)
  })

  it('conserve une recette multi-régime dès qu’UNE de ses valeurs correspond', () => {
    const recette = makeRecipe('polyvalente', {
      facettes: [
        { facette: 'regime', valeur: 'vegetarien' },
        { facette: 'regime', valeur: 'sans_gluten' },
      ],
    })
    const catalog = makeCatalog([recette])
    const req = makeRequest({ diet: 'sans_gluten' })

    const config = dietLayer.configure(req, catalog)
    const result = asExclusionResult(dietLayer.apply(new Set([recette.id]), config))

    expect(result.kept).toEqual(new Set([recette.id]))
  })

  it('id/kind/critical conformes au registre (§6.3 ENGINE)', () => {
    expect(dietLayer.id).toBe('regime')
    expect(dietLayer.kind).toBe('exclusion')
    expect(dietLayer.critical).toBe(true)
  })
})
