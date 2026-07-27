// engine/selection/similarity.test.ts — similarité entre deux recettes, pour la diversification
// (docs/ENGINE.md §6.6).

import { describe, expect, it } from 'vitest'
import type { FoodId, RecipeSignature, SensoryAxes } from '../domain/index.js'
import type { RecipeSimilarityProfile } from './similarity.js'
import {
  SIMILARITY_WEIGHT_CUISINE,
  SIMILARITY_WEIGHT_MAIN_INGREDIENT,
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

  it('ingrédient principal identique pèse le plus : son poids nommé dépasse individuellement chacun des deux autres', () => {
    // Propriété au niveau des constantes de pondération, pas d'un cas d'exécution particulier —
    // seule garantie que §6.6 exige explicitement (« l'ingrédient principal doit peser le plus »).
    expect(SIMILARITY_WEIGHT_MAIN_INGREDIENT).toBeGreaterThan(SIMILARITY_WEIGHT_SENSORY)
    expect(SIMILARITY_WEIGHT_MAIN_INGREDIENT).toBeGreaterThan(SIMILARITY_WEIGHT_CUISINE)
  })
})
