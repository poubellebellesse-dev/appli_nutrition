// engine/selection/envie.test.ts — couche d'exclusion `envie` (décision 71, lot `retour-6`).
//
// Le comportement sur le vrai catalogue est scellé dans `tests/scelles/retour-6.test.tsx`. Ici,
// seulement ce que le catalogue réel ne montre pas : l'inertie, le signe strict, l'ordre du motif.

import { describe, expect, it } from 'vitest'
import type { CravingAxes } from '../domain/index.js'
import { envieLayer } from './envie.js'
import { asExclusionResult, makeCatalog, makeRecipe, makeRequest } from './test-fixtures.js'

const axes = (legerConsistant: number, chaudFroid: number, sucreSale: number) => ({
  legerConsistant,
  chaudFroid,
  sucreSale,
  texture: 'test',
})

describe('selection/envie — envieLayer', () => {
  const chaud = makeRecipe('chaud', { axes: axes(1, 1, -1) })
  const froid = makeRecipe('froid', { axes: axes(1, -1, -1) })
  const neutre = makeRecipe('neutre', { axes: axes(1, 0, -1) })
  const catalog = makeCatalog([chaud, froid, neutre])
  const tous = new Set([chaud.id, froid.id, neutre.id])

  function appliquer(envie: CravingAxes | null) {
    const req = makeRequest({ envie })
    return asExclusionResult(envieLayer.apply(tous, envieLayer.configure(req, catalog)))
  }

  it('est inerte sans envie, et sur une envie dont aucun axe ne désigne un côté', () => {
    const envies: readonly (CravingAxes | null)[] = [
      null,
      { sucreSale: null, legerConsistant: null, chaudFroid: null },
      { sucreSale: 0, legerConsistant: null, chaudFroid: 0 },
    ]
    for (const envie of envies) {
      const result = appliquer(envie)
      expect(result.kept).toEqual(tous)
      expect(result.rejected).toEqual([])
    }
  })

  it('lit le côté au signe STRICT : une recette à 0 n’est ni chaude ni froide', () => {
    const versChaud = appliquer({ sucreSale: null, legerConsistant: null, chaudFroid: 1 })
    expect(versChaud.kept).toEqual(new Set([chaud.id]))

    const versFroid = appliquer({ sucreSale: null, legerConsistant: null, chaudFroid: -1 })
    expect(versFroid.kept).toEqual(new Set([froid.id]))
    expect(versFroid.rejected.map((r) => r.recipeId).sort()).toEqual([chaud.id, neutre.id].sort())
  })

  it('le motif nomme le premier axe non tenu dans l’ordre de la décision 79, sous la couche `envie`', () => {
    // `chaud` rate « léger » ET « froid » : c'est « léger », premier de l'ordre, qui est nommé.
    const result = appliquer({ sucreSale: -1, legerConsistant: -1, chaudFroid: -1 })
    expect(result.kept.size).toBe(0)
    expect(result.rejected.find((r) => r.recipeId === chaud.id)).toEqual({
      recipeId: chaud.id,
      layerId: 'envie',
      reason: 'pas léger',
    })
  })
})
