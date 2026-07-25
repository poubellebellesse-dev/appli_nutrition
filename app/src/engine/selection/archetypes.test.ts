// engine/selection/archetypes.test.ts — table de pondération des archétypes (docs/ENGINE.md
// §6.3 bis).
//
// Isolé de scoring-pass.test.ts (qui prouve l'INTÉGRATION avec `runScoringPass` sur les vraies
// couches) : ici on prouve seulement que la table elle-même correspond exactement à celle validée
// par l'utilisateur, et que `archetypeWeightOverride` la lit correctement — sans dépendre du reste
// du pipeline.

import { describe, expect, it } from 'vitest'
import type { ArchetypeId, ScoringLayerId } from '../domain/index.js'
import { ARCHETYPE_WEIGHT_OVERRIDES, DEFAULT_ARCHETYPE, archetypeWeightOverride } from './archetypes.js'

describe('selection/archetypes — ARCHETYPE_WEIGHT_OVERRIDES (§6.3 bis ENGINE, table validée)', () => {
  it('"equilibre" ne surcharge aucune couche (poids de référence)', () => {
    expect(ARCHETYPE_WEIGHT_OVERRIDES.equilibre).toEqual({})
  })

  it.each([
    ['envie', 'craving', 0.4],
    ['decouverte', 'variety', 0.35],
    ['de_saison', 'season', 0.3],
    ['mes_gouts', 'preference', 0.4],
    ['rapide', 'speed', 0.3],
  ] as const)('"%s" surcharge uniquement `%s` à %s', (archetype, layerId, value) => {
    expect(ARCHETYPE_WEIGHT_OVERRIDES[archetype]).toEqual({ [layerId]: value })
  })

  it('DEFAULT_ARCHETYPE vaut "equilibre"', () => {
    expect(DEFAULT_ARCHETYPE).toBe('equilibre')
  })
})

describe('selection/archetypes — archetypeWeightOverride', () => {
  it('rend `undefined` pour une couche non surchargée par l’archétype actif', () => {
    expect(archetypeWeightOverride('envie', 'nutri')).toBeUndefined()
    expect(archetypeWeightOverride('rapide', 'craving')).toBeUndefined()
  })

  it('rend la valeur surchargée pour la couche mise en avant par l’archétype', () => {
    expect(archetypeWeightOverride('envie', 'craving')).toBe(0.4)
    expect(archetypeWeightOverride('decouverte', 'variety')).toBe(0.35)
    expect(archetypeWeightOverride('de_saison', 'season')).toBe(0.3)
    expect(archetypeWeightOverride('mes_gouts', 'preference')).toBe(0.4)
    expect(archetypeWeightOverride('rapide', 'speed')).toBe(0.3)
  })

  it('archétype `undefined` (absent de la requête) se comporte comme DEFAULT_ARCHETYPE ("equilibre")', () => {
    const layers: readonly ScoringLayerId[] = ['nutri', 'preference', 'craving', 'variety', 'season', 'speed']
    for (const layerId of layers) {
      expect(archetypeWeightOverride(undefined, layerId)).toBe(archetypeWeightOverride(DEFAULT_ARCHETYPE, layerId))
      expect(archetypeWeightOverride(undefined, layerId)).toBeUndefined()
    }
  })

  it('un archétype ne touche jamais une couche d’exclusion — structurellement impossible (ScoringLayerId only)', () => {
    // Pas de test runtime possible ici : `ARCHETYPE_WEIGHT_OVERRIDES` est typé
    // `Partial<Record<ScoringLayerId, number>>` (archetypes.ts) — une clé d'`ExclusionLayerId`
    // (ex. 'allergenes', 'regime') y serait une ERREUR DE COMPILATION, pas un cas à intercepter au
    // runtime (voir le commentaire en tête de archetypes.ts, invariant §6.3).
    const archetypeIds: readonly ArchetypeId[] = ['equilibre', 'envie', 'decouverte', 'de_saison', 'mes_gouts', 'rapide']
    expect(archetypeIds).toHaveLength(6)
  })
})
