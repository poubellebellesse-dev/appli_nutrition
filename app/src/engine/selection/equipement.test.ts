// engine/selection/equipement.test.ts — couche d'exclusion `equipement` (docs/ENGINE.md §6.5).
//
// Le catalogue actuel n'a AUCUNE donnée d'équipement (voir equipement.ts) : ces tests prouvent
// que la couche reste STRUCTURELLEMENT inerte — jamais d'exclusion, quels que soient candidats,
// requête ou catalogue — et qu'elle est conforme au contrat sans planter.

import { describe, expect, it } from 'vitest'
import { equipmentLayer } from './equipement.js'
import { asExclusionResult, makeCatalog, makeRecipe, makeRequest } from './test-fixtures.js'

describe('selection/equipement — equipmentLayer (inerte, catalogue sans données équipement)', () => {
  it('ne rejette jamais aucun candidat', () => {
    const recette = makeRecipe('four_a_pain')
    const catalog = makeCatalog([recette])
    const req = makeRequest()

    const config = equipmentLayer.configure(req, catalog)
    const result = asExclusionResult(equipmentLayer.apply(new Set([recette.id]), config))

    expect(result.kept).toEqual(new Set([recette.id]))
    expect(result.rejected).toEqual([])
  })

  it('conserve un ensemble de candidats vide sans planter', () => {
    const catalog = makeCatalog([])
    const req = makeRequest()

    const config = equipmentLayer.configure(req, catalog)
    const result = asExclusionResult(equipmentLayer.apply(new Set(), config))

    expect(result.kept).toEqual(new Set())
    expect(result.rejected).toEqual([])
  })

  it('id/kind/critical conformes au registre (§6.3 ENGINE) — non critique', () => {
    expect(equipmentLayer.id).toBe('equipement')
    expect(equipmentLayer.kind).toBe('exclusion')
    expect(equipmentLayer.critical).toBe(false)
  })
})
