// engine/selection/scoring/season.test.ts — couche de score `season` (docs/ENGINE.md §6.5
// précision 3).

import { describe, expect, it } from 'vitest'
import { scoreSeason, seasonLayer } from './season.js'
import { NEUTRAL_SCORE } from './index.js'
import { asScoringResult, makeCatalog, makeIngredient, makeRecipe, makeRequest } from '../test-fixtures.js'
import type { Food, FoodId, Month, RecipeId } from '../../domain/index.js'

/**
 * `selection/test-fixtures.ts` fige `saisonMois`/`touteAnnee` (non pertinents pour les couches
 * d'exclusion P1a) : helper local pour les faire varier, propre à ce fichier de test.
 */
function makeFood(id: string, opts: { readonly touteAnnee: boolean; readonly saisonMois?: readonly Month[] }): Food {
  return {
    id: id as FoodId,
    codeCiqual: `TEST-${id}`,
    nom: id,
    groupe: 'test',
    sousFamille: null,
    nutrimentsPour100g: new Map(),
    allergenes: [],
    saisonMois: opts.saisonMois ?? [],
    touteAnnee: opts.touteAnnee,
    piquant: null,
    origineAnimale: null,
    deriveDe: null,
  }
}

describe('scoring/season — scoreSeason', () => {
  it('plat 100% épicerie (saisonMois vide partout) → score neutre, pas 0', () => {
    const pates = makeFood('pates', { touteAnnee: true })
    const huile = makeFood('huile', { touteAnnee: true })
    const recipe = makeRecipe('pates-huile', {
      ingredients: [makeIngredient('pates', { quantiteG: 200 }), makeIngredient('huile', { quantiteG: 20 })],
    })
    const foods = new Map([
      [pates.id, pates],
      [huile.id, huile],
    ])
    expect(scoreSeason(recipe, foods, 7)).toBe(NEUTRAL_SCORE)
  })

  it('légume de garde (touteAnnee=true + saisonMois non vide) en pleine saison → crédit 1', () => {
    const carotte = makeFood('carotte', { touteAnnee: true, saisonMois: [9, 10, 11, 12, 1, 2, 3, 4] })
    const recipe = makeRecipe('carotte-seule', { ingredients: [makeIngredient('carotte', { quantiteG: 150 })] })
    const foods = new Map([[carotte.id, carotte]])
    expect(scoreSeason(recipe, foods, 1)).toBe(1) // janvier : dans saisonMois
  })

  it('le même légume de garde HORS pleine saison → crédit 0,5 (disponible mais pas à son meilleur)', () => {
    const carotte = makeFood('carotte', { touteAnnee: true, saisonMois: [9, 10, 11, 12, 1, 2, 3, 4] })
    const recipe = makeRecipe('carotte-seule', { ingredients: [makeIngredient('carotte', { quantiteG: 150 })] })
    const foods = new Map([[carotte.id, carotte]])
    expect(scoreSeason(recipe, foods, 7)).toBe(0.5) // juillet : hors saisonMois, mais touteAnnee
  })

  it('légume sans touteAnnee, hors saison → crédit 0', () => {
    const tomate = makeFood('tomate', { touteAnnee: false, saisonMois: [7, 8, 9] })
    const recipe = makeRecipe('tomate-seule', { ingredients: [makeIngredient('tomate', { quantiteG: 150 })] })
    const foods = new Map([[tomate.id, tomate]])
    expect(scoreSeason(recipe, foods, 1)).toBe(0) // janvier : hors saison, jamais dispo
  })

  it('saisonMois vide (donnée manquante) exclu du dénominateur, quel que soit touteAnnee', () => {
    const inconnuStaple = makeFood('inconnu-staple', { touteAnnee: true, saisonMois: [] })
    const inconnuSaisonnier = makeFood('inconnu-saisonnier', { touteAnnee: false, saisonMois: [] })
    const recipe = makeRecipe('inconnus', {
      ingredients: [
        makeIngredient('inconnu-staple', { quantiteG: 100 }),
        makeIngredient('inconnu-saisonnier', { quantiteG: 100 }),
      ],
    })
    const foods = new Map([
      [inconnuStaple.id, inconnuStaple],
      [inconnuSaisonnier.id, inconnuSaisonnier],
    ])
    // les deux sont exclus du dénominateur → neutre, pas de division par zéro cachée
    expect(scoreSeason(recipe, foods, 7)).toBe(NEUTRAL_SCORE)
  })

  it("un aliment à saisonMois vide n'abaisse pas le score d'une recette par ailleurs de saison", () => {
    const tomate = makeFood('tomate', { touteAnnee: false, saisonMois: [7, 8, 9] })
    const inconnu = makeFood('inconnu', { touteAnnee: false, saisonMois: [] })
    const recipe = makeRecipe('tomate-inconnu', {
      ingredients: [makeIngredient('tomate', { quantiteG: 150 }), makeIngredient('inconnu', { quantiteG: 50 })],
    })
    const foods = new Map([
      [tomate.id, tomate],
      [inconnu.id, inconnu],
    ])
    // inconnu exclu du dénominateur → seule la tomate compte → 1/1
    expect(scoreSeason(recipe, foods, 7)).toBe(1)
  })

  it('moyenne pondérée par quantiteG vérifiée à la main sur un mélange des trois cas', () => {
    // juillet (mois = 7)
    const tomate = makeFood('tomate', { touteAnnee: false, saisonMois: [7, 8, 9] }) // en saison → crédit 1
    const carotte = makeFood('carotte', { touteAnnee: true, saisonMois: [9, 10, 11, 12, 1, 2, 3, 4] }) // hors saison, touteAnnee → 0.5
    const asperge = makeFood('asperge', { touteAnnee: false, saisonMois: [4, 5] }) // hors saison, pas touteAnnee → 0
    const sel = makeFood('sel', { touteAnnee: true, saisonMois: [] }) // exclu (saisonMois vide)
    const recipe = makeRecipe('mix', {
      ingredients: [
        makeIngredient('tomate', { quantiteG: 200 }),
        makeIngredient('carotte', { quantiteG: 50 }),
        makeIngredient('asperge', { quantiteG: 50 }),
        makeIngredient('sel', { quantiteG: 5 }),
      ],
    })
    const foods = new Map([
      [tomate.id, tomate],
      [carotte.id, carotte],
      [asperge.id, asperge],
      [sel.id, sel],
    ])
    // sel exclu du numérateur ET du dénominateur (saisonMois vide) ; sel des trois autres pondérée
    // par quantiteG : (1*200 + 0.5*50 + 0*50) / (200 + 50 + 50) = 225 / 300 = 0.75
    expect(scoreSeason(recipe, foods, 7)).toBeCloseTo(0.75, 10)
  })

  it('pondération par quantiteG : un gros ingrédient de saison domine un petit hors-saison-non-dispo', () => {
    // juillet (mois = 7)
    const courgette = makeFood('courgette', { touteAnnee: false, saisonMois: [7, 8, 9] }) // en saison → crédit 1
    const persil = makeFood('persil', { touteAnnee: false, saisonMois: [1, 2] }) // hors saison, pas touteAnnee → crédit 0
    const foods = new Map([
      [courgette.id, courgette],
      [persil.id, persil],
    ])

    const recipeDominante = makeRecipe('courgette-dominante', {
      ingredients: [makeIngredient('courgette', { quantiteG: 400 }), makeIngredient('persil', { quantiteG: 5 })],
    })
    // (1*400 + 0*5) / (400 + 5) = 400/405 = 80/81 ≈ 0,98765
    const scoreDominante = scoreSeason(recipeDominante, foods, 7)
    expect(scoreDominante).toBeCloseTo(80 / 81, 10)

    const recipeInversee = makeRecipe('persil-dominant', {
      ingredients: [makeIngredient('courgette', { quantiteG: 5 }), makeIngredient('persil', { quantiteG: 400 })],
    })
    // (1*5 + 0*400) / (5 + 400) = 5/405 = 1/81 ≈ 0,01235
    const scoreInversee = scoreSeason(recipeInversee, foods, 7)
    expect(scoreInversee).toBeCloseTo(1 / 81, 10)

    // même recette, mêmes ingrédients, quantités inversées → score nettement plus haut quand
    // l'ingrédient de saison domine en poids (preuve de la pondération, pas juste de la moyenne)
    expect(scoreDominante).toBeGreaterThan(scoreInversee + 0.9)
  })

  it('reste dans [0, 1]', () => {
    const legume = makeFood('legume', { touteAnnee: false, saisonMois: [1, 2, 3] })
    const recipe = makeRecipe('r', { ingredients: [makeIngredient('legume', { quantiteG: 100 })] })
    const foods = new Map([[legume.id, legume]])
    const score = scoreSeason(recipe, foods, 8)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })
})

describe('scoring/season — seasonLayer (contrat SelectionLayer, §6.2 ENGINE)', () => {
  it('id/kind/critical/defaultWeight conformes au registre (§6.3 ENGINE)', () => {
    expect(seasonLayer.id).toBe('season')
    expect(seasonLayer.kind).toBe('scoring')
    expect(seasonLayer.critical).toBe(false)
    expect(seasonLayer.defaultWeight).toBe(0.1)
  })

  it('invariant §6.1 : un score par candidat reçu, aucune réduction — y compris sans donnée de saison', () => {
    const pates = makeFood('pates', { touteAnnee: true })
    const recetteA = makeRecipe('a', { ingredients: [makeIngredient('pates', { quantiteG: 200 })] })
    const recetteB = makeRecipe('b', { ingredients: [makeIngredient('pates', { quantiteG: 100 })] })
    const catalog = makeCatalog([recetteA, recetteB], [pates])
    const req = makeRequest({ date: '2026-07-25' })

    const config = seasonLayer.configure(req, catalog)
    const result = asScoringResult(seasonLayer.apply(new Set([recetteA.id, recetteB.id]), config))

    expect(result.scores.size).toBe(2)
  })

  it('plat 100% épicerie (aucun ingrédient à saison renseignée) → NEUTRAL_SCORE', () => {
    const huile = makeFood('huile', { touteAnnee: true })
    const recette = makeRecipe('r', { ingredients: [makeIngredient('huile', { quantiteG: 20 })] })
    const catalog = makeCatalog([recette], [huile])
    const req = makeRequest({ date: '2026-07-25' })

    const config = seasonLayer.configure(req, catalog)
    const result = asScoringResult(seasonLayer.apply(new Set([recette.id]), config))

    expect(result.scores.get(recette.id)).toBe(NEUTRAL_SCORE)
  })

  it('candidat absent du catalogue (id orphelin) → NEUTRAL_SCORE, pas de plantage', () => {
    const catalog = makeCatalog([])
    const req = makeRequest({ date: '2026-07-25' })
    const config = seasonLayer.configure(req, catalog)

    const result = asScoringResult(seasonLayer.apply(new Set(['inconnu' as RecipeId]), config))

    expect(result.scores.get('inconnu' as RecipeId)).toBe(NEUTRAL_SCORE)
  })

  it('parse le mois (juillet) depuis `context.date`, jamais `Date.now()` (§3 ENGINE)', () => {
    const tomate = makeFood('tomate', { touteAnnee: false, saisonMois: [7, 8, 9] })
    const recette = makeRecipe('r', { ingredients: [makeIngredient('tomate', { quantiteG: 150 })] })
    const catalog = makeCatalog([recette], [tomate])
    const req = makeRequest({ date: '2026-07-25' }) // juillet → dans saisonMois

    const config = seasonLayer.configure(req, catalog)
    const result = asScoringResult(seasonLayer.apply(new Set([recette.id]), config))

    expect(result.scores.get(recette.id)).toBe(1)
  })

  it('tous les scores restent dans [0, 1]', () => {
    const legume = makeFood('legume', { touteAnnee: false, saisonMois: [1, 2, 3] })
    const recette = makeRecipe('r', { ingredients: [makeIngredient('legume', { quantiteG: 100 })] })
    const catalog = makeCatalog([recette], [legume])
    const req = makeRequest({ date: '2026-08-01' })

    const config = seasonLayer.configure(req, catalog)
    const result = asScoringResult(seasonLayer.apply(new Set([recette.id]), config))

    for (const score of result.scores.values()) {
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    }
  })

  it('cas discriminant : une recette de saison bat une recette hors saison et non disponible', () => {
    const tomate = makeFood('tomate', { touteAnnee: false, saisonMois: [7, 8, 9] })
    const asperge = makeFood('asperge', { touteAnnee: false, saisonMois: [4, 5] })
    const deSaison = makeRecipe('de-saison', { ingredients: [makeIngredient('tomate', { quantiteG: 200 })] })
    const horsSaison = makeRecipe('hors-saison', { ingredients: [makeIngredient('asperge', { quantiteG: 200 })] })
    const catalog = makeCatalog([deSaison, horsSaison], [tomate, asperge])
    const req = makeRequest({ date: '2026-07-25' })

    const config = seasonLayer.configure(req, catalog)
    const result = asScoringResult(seasonLayer.apply(new Set([deSaison.id, horsSaison.id]), config))

    expect(result.scores.get(deSaison.id)!).toBeGreaterThan(result.scores.get(horsSaison.id)!)
  })
})
