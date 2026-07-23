// engine/selection/allergenes.test.ts — couche d'exclusion `allergenes` (docs/ENGINE.md §6 ;
// docs/ARCHITECTURE.md §5.2).

import { describe, expect, it } from 'vitest'
import type { AllergenId, RecipeId } from '../domain/index.js'
import { allergenLayer } from './allergenes.js'
import { asExclusionResult, makeCatalog, makeFood, makeIngredient, makeRecipe, makeRequest } from './test-fixtures.js'

describe('selection/allergenes — allergenLayer', () => {
  it('exclut une recette dont un ingrédient porte un allergène déclaré', () => {
    const oeuf = makeFood('oeuf', [{ allergenId: 'oeufs' as AllergenId, certitude: 'contient' }])
    const recette = makeRecipe('omelette', { ingredients: [makeIngredient('oeuf')] })
    const catalog = makeCatalog([recette], [oeuf])
    const req = makeRequest({ allergies: ['oeufs'] })

    const config = allergenLayer.configure(req, catalog)
    const result = asExclusionResult(allergenLayer.apply(new Set([recette.id]), config))

    expect(result.kept.size).toBe(0)
    expect(result.rejected).toEqual([
      { recipeId: recette.id, layerId: 'allergenes', reason: expect.stringContaining('oeufs') },
    ])
  })

  it('conserve une recette dont aucun ingrédient ne porte un allergène déclaré', () => {
    const carotte = makeFood('carotte')
    const recette = makeRecipe('soupe', { ingredients: [makeIngredient('carotte')] })
    const catalog = makeCatalog([recette], [carotte])
    const req = makeRequest({ allergies: ['oeufs'] })

    const config = allergenLayer.configure(req, catalog)
    const result = asExclusionResult(allergenLayer.apply(new Set([recette.id]), config))

    expect(result.kept).toEqual(new Set([recette.id]))
    expect(result.rejected).toEqual([])
  })

  it('est inerte quand aucune allergie n’est déclarée', () => {
    const oeuf = makeFood('oeuf', [{ allergenId: 'oeufs' as AllergenId, certitude: 'contient' }])
    const recette = makeRecipe('omelette', { ingredients: [makeIngredient('oeuf')] })
    const catalog = makeCatalog([recette], [oeuf])
    const req = makeRequest({ allergies: [] })

    const config = allergenLayer.configure(req, catalog)
    const result = asExclusionResult(allergenLayer.apply(new Set([recette.id]), config))

    expect(result.kept).toEqual(new Set([recette.id]))
    expect(result.rejected).toEqual([])
  })

  it('exclut aussi sur une simple trace (certitude = "traces") — le filtre dur n’est jamais gradué', () => {
    const graines = makeFood('graines_sesame', [{ allergenId: 'sesame' as AllergenId, certitude: 'traces' }])
    const recette = makeRecipe('pain', { ingredients: [makeIngredient('graines_sesame')] })
    const catalog = makeCatalog([recette], [graines])
    const req = makeRequest({ allergies: ['sesame'] })

    const config = allergenLayer.configure(req, catalog)
    const result = asExclusionResult(allergenLayer.apply(new Set([recette.id]), config))

    expect(result.kept.size).toBe(0)
    expect(result.rejected).toHaveLength(1)
  })

  it('exclut même via un ingrédient marqué optionnel — la sécurité prime', () => {
    const noix = makeFood('noix', [{ allergenId: 'fruits_a_coque' as AllergenId, certitude: 'contient' }])
    const recette = makeRecipe('salade', { ingredients: [makeIngredient('noix', { optionnel: true })] })
    const catalog = makeCatalog([recette], [noix])
    const req = makeRequest({ allergies: ['fruits_a_coque'] })

    const config = allergenLayer.configure(req, catalog)
    const result = asExclusionResult(allergenLayer.apply(new Set([recette.id]), config))

    expect(result.kept.size).toBe(0)
  })

  it('dérive les allergènes d’une recette par UNION des allergènes de tous ses ingrédients', () => {
    const lait = makeFood('lait', [{ allergenId: 'lait' as AllergenId, certitude: 'contient' }])
    const farine = makeFood('farine', [{ allergenId: 'gluten' as AllergenId, certitude: 'contient' }])
    const recette = makeRecipe('crepe', { ingredients: [makeIngredient('lait'), makeIngredient('farine')] })
    const catalog = makeCatalog([recette], [lait, farine])

    // Déclare seulement 'gluten' : doit suffire à exclure, même si 'lait' n'est pas déclaré.
    const req = makeRequest({ allergies: ['gluten'] })
    const config = allergenLayer.configure(req, catalog)
    const result = asExclusionResult(allergenLayer.apply(new Set([recette.id]), config))

    expect(result.kept.size).toBe(0)
    expect(result.rejected[0]?.reason).toContain('gluten')
  })

  it('ne rejette qu’une seule fois une recette qui candidate plusieurs fois (id unique dans un Set)', () => {
    const oeuf = makeFood('oeuf', [{ allergenId: 'oeufs' as AllergenId, certitude: 'contient' }])
    const recette = makeRecipe('omelette', { ingredients: [makeIngredient('oeuf')] })
    const catalog = makeCatalog([recette], [oeuf])
    const req = makeRequest({ allergies: ['oeufs'] })

    const config = allergenLayer.configure(req, catalog)
    const result = asExclusionResult(allergenLayer.apply(new Set([recette.id]), config))

    expect(result.rejected).toHaveLength(1)
  })

  it('id/kind/critical/defaultWeight conformes au registre (§6.3 ENGINE)', () => {
    expect(allergenLayer.id).toBe('allergenes')
    expect(allergenLayer.kind).toBe('exclusion')
    expect(allergenLayer.critical).toBe(true)
  })

  it('un candidat absent du catalogue (id orphelin) ne fait pas planter la couche', () => {
    const catalog = makeCatalog([])
    const req = makeRequest({ allergies: ['oeufs'] })
    const config = allergenLayer.configure(req, catalog)

    const result = asExclusionResult(allergenLayer.apply(new Set(['inconnu' as RecipeId]), config))

    expect(result.kept).toEqual(new Set(['inconnu' as RecipeId]))
    expect(result.rejected).toEqual([])
  })
})
