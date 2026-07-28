// engine/selection/scoring/pantry.test.ts — couche `pantry`, « vider le frigo » (§10.2 ① ENGINE).

import { describe, expect, it } from 'vitest'
import { ingredientsManquants, pantryLayer, scorePantry } from './pantry.js'
import { NEUTRAL_SCORE } from './index.js'
import { asScoringResult, makeCatalog, makeIngredient, makeRecipe, makeRequest } from '../test-fixtures.js'
import type { Catalog, FoodId, RecipeId } from '../../domain/index.js'

/** Un bœuf bourguignon miniature : le bœuf pèse, le sel non. */
const BOURGUIGNON = makeRecipe('bourguignon', {
  ingredients: [
    makeIngredient('boeuf', { quantiteG: 800 }),
    makeIngredient('carotte', { quantiteG: 150 }),
    makeIngredient('sel', { quantiteG: 5 }),
    makeIngredient('persil', { quantiteG: 10, optionnel: true }),
  ],
})
const CATALOG = makeCatalog([BOURGUIGNON]) as Catalog
const frigo = (...ids: string[]) => new Set(ids as FoodId[])

describe('scoring/pantry — scorePantry', () => {
  it('garde-manger VIDE → score neutre, jamais 0', () => {
    // L'utilisateur qui ne déclare rien ne doit pas voir toutes ses recettes punies. Même règle que
    // `preference` sur un profil neuf : l'absence d'information n'est pas une information.
    expect(scorePantry(BOURGUIGNON.id, CATALOG, frigo())).toBe(NEUTRAL_SCORE)
  })

  it('COUVERTURE PONDÉRÉE PAR LA MASSE, pas comptée en ingrédients', () => {
    // Le cœur de la couche. Sel + carotte = 2 ingrédients sur 3 non optionnels, mais 155 g sur 955.
    // Un comptage par ingrédient donnerait 0,67 et remonterait une recette dont il manque le bœuf.
    const parIngredient = scorePantry(BOURGUIGNON.id, CATALOG, frigo('sel', 'carotte'))
    expect(parIngredient).toBeCloseTo(155 / 955, 6)
    expect(parIngredient).toBeLessThan(0.2)

    // À l'inverse, le seul bœuf couvre l'essentiel.
    expect(scorePantry(BOURGUIGNON.id, CATALOG, frigo('boeuf'))).toBeCloseTo(800 / 955, 6)
  })

  it('tout disponible → 1', () => {
    expect(scorePantry(BOURGUIGNON.id, CATALOG, frigo('boeuf', 'carotte', 'sel'))).toBe(1)
  })

  it('les OPTIONNELS ne comptent pas — ne pas les avoir n’empêche pas de cuisiner', () => {
    // Le persil optionnel est absent du frigo, et pourtant la couverture est totale.
    expect(scorePantry(BOURGUIGNON.id, CATALOG, frigo('boeuf', 'carotte', 'sel'))).toBe(1)
  })

  it('rien de commun → 0, la recette reste ATTEIGNABLE (score, pas filtre)', () => {
    // §10.2 insiste : avec quatre ingrédients au frigo aucune recette n'est couverte, un filtre
    // renverrait zéro résultat. Un score de 0 laisse la recette dans la liste, plus bas.
    expect(scorePantry(BOURGUIGNON.id, CATALOG, frigo('banane'))).toBe(0)
  })

  it('recette inconnue → score neutre, pas de plantage', () => {
    expect(scorePantry('inexistante' as RecipeId, CATALOG, frigo('boeuf'))).toBe(NEUTRAL_SCORE)
  })
})

describe('scoring/pantry — ingredientsManquants', () => {
  it('liste ce qu’il faut acheter — « il te manque : carotte, sel »', () => {
    // Afficher ce qui manque vaut mieux que masquer la recette (§10.2 ①). C'est la contrepartie
    // directe du choix « score et non filtre ».
    expect(ingredientsManquants(BOURGUIGNON.id, CATALOG, frigo('boeuf'))).toEqual(['carotte', 'sel'])
  })

  it('n’exige jamais un ingrédient optionnel', () => {
    expect(ingredientsManquants(BOURGUIGNON.id, CATALOG, frigo('boeuf', 'carotte', 'sel'))).toEqual([])
  })

  it('recette inconnue → liste vide', () => {
    expect(ingredientsManquants('inexistante' as RecipeId, CATALOG, frigo())).toEqual([])
  })
})

describe('scoring/pantry — pantryLayer (contrat SelectionLayer)', () => {
  it('id/kind/critical/defaultWeight conformes au registre — bonus MODÉRÉ (§10.2)', () => {
    expect(pantryLayer.id).toBe('pantry')
    expect(pantryLayer.kind).toBe('scoring')
    expect(pantryLayer.critical).toBe(false)
    expect(pantryLayer.defaultWeight).toBe(0.05)
  })

  it('lit `context.pantryFoodIds` et note chaque candidat', () => {
    const config = pantryLayer.configure(makeRequest({ pantryFoodIds: ['boeuf'] }), CATALOG)
    const result = asScoringResult(pantryLayer.apply(new Set([BOURGUIGNON.id]), config))

    expect(result.scores.get(BOURGUIGNON.id)).toBeCloseTo(800 / 955, 6)
  })

  it('invariant §6.1 : un score par candidat, toujours dans [0, 1]', () => {
    const config = pantryLayer.configure(makeRequest(), CATALOG)
    const result = asScoringResult(pantryLayer.apply(new Set([BOURGUIGNON.id]), config))

    expect(result.scores.size).toBe(1)
    for (const score of result.scores.values()) {
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    }
  })
})
