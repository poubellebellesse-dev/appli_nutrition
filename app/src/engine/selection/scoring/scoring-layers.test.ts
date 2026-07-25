// engine/selection/scoring/scoring-layers.test.ts — filet générique contre une divergence
// silencieuse entre `LAYER_DESCRIPTORS` (registre, docs/ENGINE.md §6.3) et l'implémentation des
// 6 couches de score livrées à ce stade (`nutri`, `preference`, `craving`, `season`, `variety`,
// `habit`).
//
// Complète les tests dédiés de chaque fichier (nutri.test.ts, preference.test.ts, …) plutôt que
// de les dupliquer : ici on ne vérifie QUE ce qui doit rester identique entre les 6 couches et le
// registre — nature, criticité, poids par défaut — et l'invariant §6.1 (aucune réduction de
// l'ensemble des candidats) balayé sur les 6 en une seule fois.

import { describe, expect, it } from 'vitest'
import { LAYER_DESCRIPTORS } from '../index.js'
import type { SelectionLayer } from '../index.js'
import type { RecipeId, ScoringLayerId } from '../../domain/index.js'
import { asScoringResult, makeCatalog, makeRecipe, makeRequest } from '../test-fixtures.js'
import { nutriLayer } from './nutri.js'
import { preferenceLayer } from './preference.js'
import { cravingLayer } from './craving.js'
import { seasonLayer } from './season.js'
import { varietyLayer } from './variety.js'
import { habitLayer } from './habit.js'

// `as SelectionLayer` : même motif que `EXCLUSION_LAYERS` (exclusion-pass.ts) — sous `strict`,
// `SelectionLayer<X>` n'est pas structurellement assignable à `SelectionLayer<unknown>` dans un
// tableau hétérogène (paramètre `config` contravariant). Ce test ne regarde jamais à l'intérieur
// de `Config`, il le fait seulement transiter de `configure` vers `apply` de la même couche.
const IMPLEMENTED_LAYERS: readonly SelectionLayer[] = [
  nutriLayer as SelectionLayer,
  preferenceLayer as SelectionLayer,
  cravingLayer as SelectionLayer,
  seasonLayer as SelectionLayer,
  varietyLayer as SelectionLayer,
  habitLayer as SelectionLayer,
]

function descriptorFor(id: ScoringLayerId) {
  const descriptor = LAYER_DESCRIPTORS.find((d) => d.id === id)
  if (!descriptor) throw new Error(`descriptorFor: '${id}' absent de LAYER_DESCRIPTORS`)
  return descriptor
}

describe('scoring/ — les 6 couches livrées restent alignées avec LAYER_DESCRIPTORS (§6.3 ENGINE)', () => {
  it.each(IMPLEMENTED_LAYERS)('$id : kind, critical et defaultWeight identiques au registre', (layer) => {
    const descriptor = descriptorFor(layer.id as ScoringLayerId)
    expect(layer.kind).toBe('scoring')
    expect(layer.kind).toBe(descriptor.kind)
    expect(layer.critical).toBe(false)
    expect(layer.critical).toBe(descriptor.critical)
    expect(layer.defaultWeight).toBe(descriptor.defaultWeight)
  })

  it('LAYER_DESCRIPTORS reste à 16 entrées (6 exclusion + 10 score) — ce lot n’en ajoute aucune', () => {
    expect(LAYER_DESCRIPTORS).toHaveLength(16)
  })
})

describe('scoring/ — invariant §6.1 balayé sur les 6 couches : jamais de réduction de l’ensemble', () => {
  it.each(IMPLEMENTED_LAYERS)('$id : autant de scores que de candidats reçus, y compris un candidat inconnu du catalogue', (layer) => {
    const connue = makeRecipe('connue')
    const catalog = makeCatalog([connue])
    const req = makeRequest()
    const candidates = new Set([connue.id, 'inconnue' as RecipeId])

    const config = layer.configure(req, catalog)
    const result = asScoringResult(layer.apply(candidates, config))

    expect(result.scores.size).toBe(candidates.size)
    for (const recipeId of candidates) {
      expect(result.scores.has(recipeId)).toBe(true)
    }
  })

  it.each(IMPLEMENTED_LAYERS)('$id : tous les scores retournés sont dans [0, 1]', (layer) => {
    const connue = makeRecipe('connue')
    const catalog = makeCatalog([connue])
    const req = makeRequest()

    const config = layer.configure(req, catalog)
    const result = asScoringResult(layer.apply(new Set([connue.id]), config))

    for (const score of result.scores.values()) {
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    }
  })

  it.each(IMPLEMENTED_LAYERS)('$id : ensemble de candidats vide → aucun score, mais pas d’erreur', (layer) => {
    const catalog = makeCatalog([])
    const req = makeRequest()

    const config = layer.configure(req, catalog)
    const result = asScoringResult(layer.apply(new Set(), config))

    expect(result.scores.size).toBe(0)
  })
})
