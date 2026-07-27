// engine/selection/regime.test.ts — couche d'exclusion `regime` (docs/ENGINE.md §6 ;
// docs/ARCHITECTURE.md §5.2).

import { describe, expect, it } from 'vitest'
import { DIET_CHAIN, dietLayer } from './regime.js'
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

describe('selection/regime — chaîne d’inclusion vegetalien ⊂ vegetarien ⊂ pescetarien ⊂ omnivore', () => {
  /** Une recette portant une seule facette `regime`, passée seule dans la couche. */
  function keptUnder(recipeDiet: string, requestedDiet: string): boolean {
    const recette = makeRecipe('plat', { facettes: [{ facette: 'regime', valeur: recipeDiet }] })
    const catalog = makeCatalog([recette])
    const req = makeRequest({ diet: requestedDiet })
    const config = dietLayer.configure(req, catalog)
    return asExclusionResult(dietLayer.apply(new Set([recette.id]), config)).kept.has(recette.id)
  }

  it('ÉLARGIT vers la gauche : un plat plus restrictif convient à une demande plus permissive', () => {
    expect(keptUnder('vegetalien', 'vegetarien')).toBe(true)
    expect(keptUnder('vegetalien', 'pescetarien')).toBe(true)
    expect(keptUnder('vegetalien', 'omnivore')).toBe(true)
    expect(keptUnder('vegetarien', 'pescetarien')).toBe(true)
    expect(keptUnder('vegetarien', 'omnivore')).toBe(true)
    expect(keptUnder('pescetarien', 'omnivore')).toBe(true)
  })

  // LA propriété de sûreté de ce lot. La chaîne ne doit JAMAIS faire entrer un plat plus
  // permissif que ce qui est demandé — sinon un utilisateur végétarien se verrait proposer de la
  // viande, ce qu'une couche 🔒 critique ne peut pas se permettre.
  it('n’élargit JAMAIS vers la droite : un plat plus permissif reste écarté', () => {
    expect(keptUnder('omnivore', 'pescetarien')).toBe(false)
    expect(keptUnder('omnivore', 'vegetarien')).toBe(false)
    expect(keptUnder('omnivore', 'vegetalien')).toBe(false)
    expect(keptUnder('pescetarien', 'vegetarien')).toBe(false)
    expect(keptUnder('pescetarien', 'vegetalien')).toBe(false)
    expect(keptUnder('vegetarien', 'vegetalien')).toBe(false)
  })

  it('un régime HORS chaîne retombe sur l’égalité stricte, dans les deux sens', () => {
    expect(keptUnder('sans_gluten', 'sans_gluten')).toBe(true)
    // `sans_gluten` ne s'emboîte dans rien : ni il n'ouvre les plats végétaliens…
    expect(keptUnder('vegetalien', 'sans_gluten')).toBe(false)
    // …ni il n'est ouvert par un régime de la chaîne.
    expect(keptUnder('sans_gluten', 'omnivore')).toBe(false)
  })

  it('l’égalité stricte reste vraie pour chaque maillon de la chaîne', () => {
    for (const diet of DIET_CHAIN) expect(keptUnder(diet, diet)).toBe(true)
  })

  it('DIET_CHAIN est ordonnée du plus restrictif au plus permissif', () => {
    expect(DIET_CHAIN).toEqual(['vegetalien', 'vegetarien', 'pescetarien', 'omnivore'])
  })
})
