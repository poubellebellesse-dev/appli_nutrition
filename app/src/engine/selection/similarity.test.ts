// engine/selection/similarity.test.ts — similarité entre deux recettes, pour la diversification
// (docs/ENGINE.md §6.6).

import { describe, expect, it } from 'vitest'
import type { FoodId, RecipeSignature, SensoryAxes } from '../domain/index.js'
import type { RecipeSimilarityProfile } from './similarity.js'
import {
  SIMILARITY_WEIGHT_CUISINE,
  SIMILARITY_WEIGHT_INGREDIENTS,
  SIMILARITY_WEIGHT_SENSORY,
  similarity,
} from './similarity.js'

const AXES: SensoryAxes = { sucreSale: 0.5, legerConsistant: -0.2, chaudFroid: 1, texture: 'croquant' }

/** Signature à un seul ingrédient — la forme la plus simple pour isoler un signal en test. */
function sig(...foodIds: readonly string[]): RecipeSignature {
  const part = foodIds.length === 0 ? 0 : 1 / foodIds.length
  return new Map(foodIds.map((id) => [id as FoodId, part]))
}

function makeProfile(overrides: Partial<RecipeSimilarityProfile> = {}): RecipeSimilarityProfile {
  return {
    signature: sig('poulet'),
    cuisines: ['francaise'],
    axes: AXES,
    ...overrides,
  }
}

describe('selection/similarity — similarity (§6.6 ENGINE)', () => {
  it('identité : une recette est à similarité 1 avec elle-même', () => {
    const profile = makeProfile()
    expect(similarity(profile, profile)).toBe(1)
  })

  it('résultat toujours dans [0, 1], y compris sur des profils maximalement opposés', () => {
    const a = makeProfile({
      signature: sig('poulet'),
      cuisines: ['francaise'],
      axes: { sucreSale: -1, legerConsistant: -1, chaudFroid: -1, texture: 'croquant' },
    })
    const b = makeProfile({
      signature: sig('tofu'),
      cuisines: ['japonaise'],
      axes: { sucreSale: 1, legerConsistant: 1, chaudFroid: 1, texture: 'fondant' },
    })

    const score = similarity(a, b)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('même composition → plus similaire qu’une composition différente (toutes choses égales par ailleurs)', () => {
    const reference = makeProfile({ signature: sig('poulet') })
    const memeComposition = makeProfile({ signature: sig('poulet') })
    const compositionDifferente = makeProfile({ signature: sig('tofu') })

    expect(similarity(reference, memeComposition)).toBeGreaterThan(similarity(reference, compositionDifferente))
  })

  it("deux recettes SANS signature connue ne sont pas réputées similaires pour autant (absence ≠ égalité)", () => {
    // Piège documenté : deux signatures VIDES ne doivent JAMAIS compter comme un match.
    const sansSignatureA = makeProfile({ signature: sig(), cuisines: [], axes: { ...AXES, texture: 'a' } })
    const sansSignatureB = makeProfile({
      signature: sig(),
      cuisines: ['japonaise'],
      axes: { sucreSale: -1, legerConsistant: -1, chaudFroid: -1, texture: 'z' },
    })
    // Mêmes profils, mais signature CONNUE et identique cette fois — seule variable changée.
    const avecSignatureA = makeProfile({ signature: sig('poulet'), cuisines: [], axes: { ...AXES, texture: 'a' } })
    const avecSignatureB = makeProfile({
      signature: sig('poulet'),
      cuisines: ['japonaise'],
      axes: { sucreSale: -1, legerConsistant: -1, chaudFroid: -1, texture: 'z' },
    })

    expect(similarity(sansSignatureA, sansSignatureB)).toBeLessThan(similarity(avecSignatureA, avecSignatureB))
  })

  it('même absence trap sur la cuisine : deux recettes sans famille de cuisine connue ne sont pas réputées similaires pour autant', () => {
    const sansCuisineA = makeProfile({ cuisines: [], signature: sig() })
    const sansCuisineB = makeProfile({ cuisines: [], signature: sig(), axes: { ...AXES, texture: 'autre' } })
    const memeCuisineA = makeProfile({ cuisines: ['francaise'], signature: sig() })
    const memeCuisineB = makeProfile({
      cuisines: ['francaise'],
      signature: sig(),
      axes: { ...AXES, texture: 'autre' },
    })

    expect(similarity(sansCuisineA, sansCuisineB)).toBeLessThan(similarity(memeCuisineA, memeCuisineB))
  })

  it('texture traitée en CATÉGORIEL (match/pas-match), jamais comme une distance numérique', () => {
    const base = makeProfile({ axes: { sucreSale: 0, legerConsistant: 0, chaudFroid: 0, texture: 'croquant' } })
    // Texture différente mais "proche alphabétiquement" ne doit avoir aucun statut particulier : seul
    // le match exact compte, comme dans scoreCraving (§6.5 précision 2).
    const textureDifferente = makeProfile({ axes: { sucreSale: 0, legerConsistant: 0, chaudFroid: 0, texture: 'fondant' } })
    const textureIdentique = makeProfile({ axes: { sucreSale: 0, legerConsistant: 0, chaudFroid: 0, texture: 'croquant' } })

    expect(similarity(base, textureIdentique)).toBeGreaterThan(similarity(base, textureDifferente))
  })

  it('la composition domine : son poids dépasse la SOMME des deux autres', () => {
    // Renforcé après la mesure des pondérations (§6.6 ter) : « dépasse chacun des deux autres » ne
    // suffisait pas — l'ancienne répartition 50/30/20 le vérifiait déjà tout en laissant sensoriel
    // et cuisine fabriquer 50 % de similarité ENTRE DEUX PLATS SANS AUCUN INGRÉDIENT COMMUN.
    // La propriété qui compte est que les signaux accessoires ne puissent pas, à eux seuls,
    // atteindre la moitié du score.
    expect(SIMILARITY_WEIGHT_INGREDIENTS).toBeGreaterThan(SIMILARITY_WEIGHT_SENSORY + SIMILARITY_WEIGHT_CUISINE)
  })

  it('PLANCHER : deux plats sans aucun ingrédient commun ne peuvent pas atteindre 50 %', () => {
    // Le défaut mesuré sur le catalogue réel avant correction : « coq au vin » × « gigot d'agneau »
    // à 50 % avec zéro ingrédient partagé, uniquement via cuisine identique + sensoriel proche.
    // Ici le pire cas possible — mêmes axes, même cuisine, signatures disjointes.
    const a = makeProfile({ signature: sig('boeuf') })
    const b = makeProfile({ signature: sig('agneau') })

    expect(similarity(a, b)).toBeLessThan(0.5)
  })

  it('les trois poids somment à 1 — un score reste dans [0, 1] sans dépendre du clamp', () => {
    expect(SIMILARITY_WEIGHT_INGREDIENTS + SIMILARITY_WEIGHT_SENSORY + SIMILARITY_WEIGHT_CUISINE).toBeCloseTo(1, 10)
  })
})
