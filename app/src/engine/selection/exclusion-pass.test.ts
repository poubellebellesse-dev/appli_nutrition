// engine/selection/exclusion-pass.test.ts — la passe d'exclusion (docs/ENGINE.md §6.4).
//
// Deux volets :
//   1. Mécanique du pipeline (intersection successive, premier motif retenu, ordre du registre)
//      prouvée avec des couches SYNTHÉTIQUES — indépendante de la sémantique réelle des 4
//      couches, pour isoler le comportement de `runExclusionPass` lui-même.
//   2. Câblage des 4 vraies couches via `EXCLUSION_LAYERS`, sur un petit catalogue en mémoire.
//
// Le test sur les 10 VRAIES recettes (catalog.db, chargé via data/) vit dans
// tests/exclusion-real-catalog.test.ts — pas ici, car ce fichier est sous engine/ et ne peut pas
// importer data/ (tests/engine-boundaries.test.ts l'interdit).

import { describe, expect, it } from 'vitest'
import type { AllergenId, RecipeId, RejectionEntry } from '../domain/index.js'
import type { CandidateSet, ExclusionLayerResult, SelectionLayer } from './index.js'
import { EXCLUSION_LAYERS, runExclusionPass } from './exclusion-pass.js'
import { makeCatalog, makeFood, makeIngredient, makeRecipe, makeRequest } from './test-fixtures.js'

/** Couche d'exclusion synthétique : rejette tout candidat dont l'id figure dans `rejects`. */
function makeFakeExclusionLayer(
  id: 'allergenes' | 'regime' | 'temps' | 'equipement',
  rejects: ReadonlySet<string>,
  reason: string
): SelectionLayer {
  return {
    id,
    kind: 'exclusion',
    critical: false,
    defaultWeight: 0,
    configure: () => ({}),
    apply: (candidates: CandidateSet): ExclusionLayerResult => {
      const kept = new Set<RecipeId>()
      const rejected: RejectionEntry[] = []
      for (const recipeId of candidates) {
        if (rejects.has(recipeId)) {
          rejected.push({ recipeId, layerId: id, reason })
        } else {
          kept.add(recipeId)
        }
      }
      return { kept, rejected }
    },
  } as SelectionLayer
}

describe('selection/exclusion-pass — mécanique du pipeline (§6.4 ENGINE, couches synthétiques)', () => {
  it('intersection successive : une recette rejetée par une couche ne repasse jamais', () => {
    const catalog = makeCatalog([makeRecipe('a'), makeRecipe('b'), makeRecipe('c')]) // toutes en 'diner' par défaut
    const req = makeRequest()

    const layerA = makeFakeExclusionLayer('temps', new Set(['a']), 'motif temps')
    const layerB = makeFakeExclusionLayer('equipement', new Set(['b']), 'motif equipement')

    const { candidates, rejections } = runExclusionPass(catalog, req, [layerA, layerB])

    expect(candidates).toEqual(new Set(['c']))
    expect(rejections).toEqual([
      { recipeId: 'a', layerId: 'temps', reason: 'motif temps' },
      { recipeId: 'b', layerId: 'equipement', reason: 'motif equipement' },
    ])
  })

  it('premier motif rencontré = motif retenu ; une recette déjà écartée ne repasse pas par une couche suivante', () => {
    const catalog = makeCatalog([makeRecipe('a')])
    const req = makeRequest()

    const firstLayer = makeFakeExclusionLayer('allergenes', new Set(['a']), 'motif allergene')
    // N'agit que sur ce qui lui est transmis (intersection successive) : 'a' n'y figure déjà
    // plus, donc cette couche ne peut matériellement pas produire un second motif pour 'a'.
    const secondLayer = makeFakeExclusionLayer('regime', new Set(['a']), 'motif regime')

    const { candidates, rejections } = runExclusionPass(catalog, req, [firstLayer, secondLayer])

    expect(candidates.size).toBe(0)
    expect(rejections).toEqual([{ recipeId: 'a', layerId: 'allergenes', reason: 'motif allergene' }])
  })

  it('sans couche active, retourne exactement le point de départ (recettes du créneau)', () => {
    const catalog = makeCatalog([makeRecipe('a'), makeRecipe('b')])
    const req = makeRequest()

    const { candidates, rejections } = runExclusionPass(catalog, req, [])

    expect(candidates).toEqual(new Set(['a', 'b']))
    expect(rejections).toEqual([])
  })

  it('créneau absent de recipesBySlot → ensemble de départ vide, pas d’exception', () => {
    const catalog = makeCatalog([makeRecipe('a', { typesRepas: ['petit_dejeuner'] })])
    const req = makeRequest({ creneau: 'gouter' })

    const { candidates, rejections } = runExclusionPass(catalog, req)

    expect(candidates.size).toBe(0)
    expect(rejections).toEqual([])
  })

  it('rejette (TypeError) si une couche de nature "scoring" est passée par erreur', () => {
    const catalog = makeCatalog([makeRecipe('a')])
    const req = makeRequest()
    const scoringLayer: SelectionLayer = {
      id: 'nutri',
      kind: 'scoring',
      critical: false,
      defaultWeight: 0.25,
      configure: () => ({}),
      apply: () => ({ scores: new Map() }),
    }

    expect(() => runExclusionPass(catalog, req, [scoringLayer])).toThrow(TypeError)
  })
})

describe('selection/exclusion-pass — câblage des 4 vraies couches (EXCLUSION_LAYERS)', () => {
  it('EXCLUSION_LAYERS contient les 4 couches, dans l’ordre de priorité de motif (§6.3 ENGINE)', () => {
    expect(EXCLUSION_LAYERS.map((layer) => layer.id)).toEqual(['allergenes', 'regime', 'temps', 'equipement'])
  })

  it('applique allergènes puis régime puis temps sur un petit catalogue en mémoire', () => {
    const oeuf = makeFood('oeuf', [{ allergenId: 'oeufs' as AllergenId, certitude: 'contient' }])
    const commonOpts = { tempsPrepMin: 5, tempsCuissonMin: 5 }
    const safe = makeRecipe('sure', {
      ...commonOpts,
      ingredients: [],
      facettes: [{ facette: 'regime', valeur: 'vegetarien' }],
    })
    const allergenique = makeRecipe('allergenique', {
      ...commonOpts,
      ingredients: [makeIngredient('oeuf')],
      facettes: [{ facette: 'regime', valeur: 'vegetarien' }],
    })
    const nonVege = makeRecipe('nonvege', {
      ...commonOpts,
      ingredients: [],
      facettes: [{ facette: 'regime', valeur: 'omnivore' }],
    })
    const catalog = makeCatalog([safe, allergenique, nonVege], [oeuf])
    const req = makeRequest({ allergies: ['oeufs'], diet: 'vegetarien' })

    const { candidates, rejections } = runExclusionPass(catalog, req)

    expect(candidates).toEqual(new Set([safe.id]))
    expect(rejections.map((r) => r.recipeId).sort()).toEqual([allergenique.id, nonVege.id].sort())
    expect(rejections.find((r) => r.recipeId === allergenique.id)?.layerId).toBe('allergenes')
    expect(rejections.find((r) => r.recipeId === nonVege.id)?.layerId).toBe('regime')
  })
})
