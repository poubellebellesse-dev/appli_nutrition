// engine/nutrition/reference-intakes.test.ts — resolveReferenceIntakes (docs/ENGINE.md §5.1).

import { describe, expect, it } from 'vitest'
import { resolveReferenceIntakes } from './reference-intakes.js'
import { makeCatalog } from './test-fixtures.js'
import type { Nutrient, NutrientId, UserProfile } from '../domain/index.js'

/**
 * `nutrition/test-fixtures.ts` fige `vnrAdulte: null`/`categorie: null` (non pertinents pour
 * l'agrégation testée par les autres fichiers de ce dossier) : helper local pour les faire
 * varier, même motif que `season.test.ts` côté selection/.
 */
function makeNutrient(
  id: string,
  opts: { readonly vnrAdulte?: number | null; readonly categorie?: Nutrient['categorie'] } = {}
): Nutrient {
  return {
    id: id as NutrientId,
    code: id,
    nom: id,
    unite: 'g',
    vnrAdulte: opts.vnrAdulte ?? null,
    categorie: opts.categorie ?? null,
    sens: 'cible',
  }
}

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    trancheAge: '30_49',
    sexe: 'NP',
    tailleCm: null,
    poidsKg: null,
    niveauActivite: 'sedentaire',
    facteurPortion: 1,
    ...overrides,
  }
}

describe('nutrition/reference-intakes — resolveReferenceIntakes', () => {
  it('mode à plat (défaut, taille/poids inconnus) : chaque nutriment prend son vnrAdulte', () => {
    const proteines = makeNutrient('proteines', { vnrAdulte: 50, categorie: 'macronutriment' })
    const fer = makeNutrient('fer', { vnrAdulte: 14, categorie: 'mineral' })
    const catalog = makeCatalog([], [], [proteines, fer])
    const profile = makeProfile({ tailleCm: null, poidsKg: null })

    const vector = resolveReferenceIntakes(profile, catalog)

    expect(Array.from(vector)).toEqual([50, 14])
  })

  it('vnrAdulte null → 0, jamais NaN (ignoré ensuite par scoreNutri)', () => {
    const proteines = makeNutrient('proteines', { vnrAdulte: 50, categorie: 'macronutriment' })
    const inconnu = makeNutrient('inconnu', { vnrAdulte: null, categorie: 'vitamine' })
    const catalog = makeCatalog([], [], [proteines, inconnu])
    const profile = makeProfile()

    const vector = resolveReferenceIntakes(profile, catalog)

    expect(Array.from(vector)).toEqual([50, 0])
  })

  it('mode ré-échelonné : un MACRONUTRIMENT bouge avec le ratio, un MINÉRAL ne bouge PAS', () => {
    // profil identique à energy-needs.test.ts (homme, 30_49, actif) : besoin = 2478.0625
    const energie = makeNutrient('energie', { vnrAdulte: 2000, categorie: 'macronutriment' })
    const proteines = makeNutrient('proteines', { vnrAdulte: 50, categorie: 'macronutriment' })
    const fer = makeNutrient('fer', { vnrAdulte: 14, categorie: 'mineral' })
    const catalog = makeCatalog([], [], [energie, proteines, fer])
    const profile = makeProfile({ sexe: 'M', tailleCm: 175, poidsKg: 70, niveauActivite: 'actif' })

    const vector = resolveReferenceIntakes(profile, catalog)
    const ratio = 2478.0625 / 2000

    // énergie elle-même est un macronutriment : son propre ratio la ramène exactement au besoin.
    expect(vector[0]).toBeCloseTo(2478.0625, 8)
    // protéines (macronutriment) suit le même ratio que l'énergie personnalisée.
    expect(vector[1]).toBeCloseTo(50 * ratio, 8)
    // le fer (minéral) est un besoin ABSOLU : il garde sa VNR à plat, INCHANGÉE par le ré-échelonnage.
    expect(vector[2]).toBe(14)
  })

  it("énergie absente du catalogue → repli sur le mode à plat, même énergie personnalisée disponible", () => {
    const proteines = makeNutrient('proteines', { vnrAdulte: 50, categorie: 'macronutriment' })
    const fer = makeNutrient('fer', { vnrAdulte: 14, categorie: 'mineral' })
    const catalog = makeCatalog([], [], [proteines, fer]) // pas de nutriment 'energie'
    const profile = makeProfile({ sexe: 'M', tailleCm: 175, poidsKg: 70, niveauActivite: 'actif' })

    const vector = resolveReferenceIntakes(profile, catalog)

    expect(Array.from(vector)).toEqual([50, 14])
  })

  it('énergie présente mais VNR nulle → repli sur le mode à plat, jamais de division par zéro', () => {
    const energie = makeNutrient('energie', { vnrAdulte: null, categorie: 'macronutriment' })
    const proteines = makeNutrient('proteines', { vnrAdulte: 50, categorie: 'macronutriment' })
    const catalog = makeCatalog([], [], [energie, proteines])
    const profile = makeProfile({ sexe: 'M', tailleCm: 175, poidsKg: 70, niveauActivite: 'actif' })

    const vector = resolveReferenceIntakes(profile, catalog)

    expect(Array.from(vector)).toEqual([0, 50])
  })
})
