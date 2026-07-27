// engine/nutrition/signature.test.ts — computeRecipeSignature / signatureOverlap (docs/ENGINE.md §6.6).

import { describe, expect, it } from 'vitest'
import type { FoodId, RecipeSignature } from '../domain/index.js'
import { SIGNATURE_SIZE, computeRecipeSignature, signatureOverlap } from './signature.js'
import { makeCatalog, makeIngredient, makeRecipe } from './test-fixtures.js'

function sig(entries: Record<string, number>): RecipeSignature {
  return new Map(Object.entries(entries).map(([id, part]) => [id as FoodId, part]))
}

describe('nutrition/signature — computeRecipeSignature', () => {
  it('retient les 3 non-optionnels les plus lourds, en parts sommant à 1', () => {
    const recette = makeRecipe('recette', {
      ingredients: [
        makeIngredient('gros', { quantiteG: 300 }),
        makeIngredient('moyen', { quantiteG: 100 }),
        makeIngredient('petit', { quantiteG: 100 }),
        makeIngredient('minuscule', { quantiteG: 5 }),
      ],
    })

    const signature = computeRecipeSignature(makeCatalog([recette])).get(recette.id)!

    expect(signature.size).toBe(SIGNATURE_SIZE)
    expect(signature.has('minuscule' as FoodId)).toBe(false) // 4ᵉ par le poids, hors signature
    expect([...signature.values()].reduce((s, v) => s + v, 0)).toBeCloseTo(1, 10)
    expect(signature.get('gros' as FoodId)).toBeCloseTo(0.6, 10) // 300 / 500
  })

  it('normalise sur les SEULS ingrédients retenus — la taille de la recette ne change rien', () => {
    const petite = makeRecipe('petite', {
      ingredients: [makeIngredient('a', { quantiteG: 100 }), makeIngredient('b', { quantiteG: 50 })],
    })
    const grande = makeRecipe('grande', {
      ingredients: [makeIngredient('a', { quantiteG: 400 }), makeIngredient('b', { quantiteG: 200 })],
    })

    const index = computeRecipeSignature(makeCatalog([petite, grande]))

    // Même profil de composition, quantités quadruplées : signatures IDENTIQUES.
    expect(index.get(petite.id)).toEqual(index.get(grande.id))
    expect(signatureOverlap(index.get(petite.id)!, index.get(grande.id)!)).toBeCloseTo(1, 10)
  })

  it('ignore les optionnels même s’ils sont les plus lourds', () => {
    const recette = makeRecipe('recette', {
      ingredients: [
        makeIngredient('principal', { quantiteG: 100 }),
        makeIngredient('garniture', { quantiteG: 900, optionnel: true }),
      ],
    })

    const signature = computeRecipeSignature(makeCatalog([recette])).get(recette.id)!

    expect([...signature.keys()]).toEqual(['principal'])
  })

  it('départage les ÉGALITÉS de quantité par foodId croissant, de façon déterministe', () => {
    // Cas fréquent et à l'origine du défaut corrigé : « lentilles 300 g / carottes 300 g ».
    const recette = makeRecipe('recette', {
      ingredients: [
        makeIngredient('zeste', { quantiteG: 200 }),
        makeIngredient('ail', { quantiteG: 200 }),
        makeIngredient('mais', { quantiteG: 200 }),
        makeIngredient('betterave', { quantiteG: 200 }),
      ],
    })

    const first = computeRecipeSignature(makeCatalog([recette])).get(recette.id)!
    const second = computeRecipeSignature(makeCatalog([recette])).get(recette.id)!

    expect([...first.keys()]).toEqual(['ail', 'betterave', 'mais'])
    expect([...first.keys()]).toEqual([...second.keys()]) // reproductible d'un build à l'autre
  })

  it('une recette sans aucun ingrédient non-optionnel est ABSENTE de la Map (pas de fausse signature)', () => {
    const recette = makeRecipe('tout_optionnel', {
      ingredients: [makeIngredient('a', { quantiteG: 100, optionnel: true })],
    })

    expect(computeRecipeSignature(makeCatalog([recette])).has(recette.id)).toBe(false)
  })

  it('additionne les parts quand un même aliment apparaît sur deux lignes d’ingrédient', () => {
    const recette = makeRecipe('recette', {
      ingredients: [
        makeIngredient('tomate', { quantiteG: 200 }),
        makeIngredient('tomate', { quantiteG: 100 }),
        makeIngredient('oignon', { quantiteG: 100 }),
      ],
    })

    const signature = computeRecipeSignature(makeCatalog([recette])).get(recette.id)!

    expect(signature.get('tomate' as FoodId)).toBeCloseTo(0.75, 10) // 300 / 400, pas 200/400 écrasé
  })
})

describe('nutrition/signature — signatureOverlap', () => {
  it('deux signatures identiques donnent 1, deux disjointes donnent 0', () => {
    expect(signatureOverlap(sig({ a: 0.5, b: 0.5 }), sig({ a: 0.5, b: 0.5 }))).toBeCloseTo(1, 10)
    expect(signatureOverlap(sig({ a: 1 }), sig({ b: 1 }))).toBe(0)
  })

  it('ABSENCE ≠ ÉGALITÉ : deux signatures vides donnent 0, jamais 1', () => {
    expect(signatureOverlap(sig({}), sig({}))).toBe(0)
    expect(signatureOverlap(sig({ a: 1 }), sig({}))).toBe(0)
  })

  it('un ingrédient partagé ne compte qu’à hauteur de la PLUS PETITE de ses deux parts', () => {
    // `a` est dominant chez l'un, marginal chez l'autre : le chevauchement doit rester faible.
    const dominant = sig({ a: 0.9, b: 0.1 })
    const marginal = sig({ a: 0.1, c: 0.9 })

    expect(signatureOverlap(dominant, marginal)).toBeLessThan(0.15)
  })

  // ---------------------------------------------------------------------------------------
  // RÉGRESSION — le défaut qui a motivé tout ce module (§6.6, mesuré sur le catalogue réel).
  // ---------------------------------------------------------------------------------------
  it('deux plats qui ne partagent qu’un ingrédient SECONDAIRE restent éloignés', () => {
    // Reproduit « lentilles aux carottes » × « poulet rôti aux carottes » : mêmes carottes et
    // oignons, protéines différentes. L'ancien index les jugeait identiques (98,4 %) parce que la
    // carotte, à égalité de poids avec la protéine, était élue « ingrédient principal » des deux.
    const lentilles = makeRecipe('lentilles_carottes', {
      ingredients: [
        makeIngredient('lentilles', { quantiteG: 300 }),
        makeIngredient('carotte', { quantiteG: 300 }),
        makeIngredient('oignon', { quantiteG: 100 }),
      ],
    })
    const poulet = makeRecipe('poulet_carottes', {
      ingredients: [
        makeIngredient('poulet', { quantiteG: 500 }),
        makeIngredient('carotte', { quantiteG: 500 }),
        makeIngredient('oignon', { quantiteG: 150 }),
      ],
    })

    const index = computeRecipeSignature(makeCatalog([lentilles, poulet]))
    const overlap = signatureOverlap(index.get(lentilles.id)!, index.get(poulet.id)!)

    // Les deux protéines sont disjointes : le chevauchement ne peut pas dépasser la part des
    // seuls légumes communs. Loin du « quasi-identique » de l'ancien modèle.
    expect(overlap).toBeLessThan(0.62)
  })

  it('deux plats bâtis sur la MÊME protéine restent proches', () => {
    // Contre-épreuve indispensable : un modèle qui éloigne tout ne discrimine plus rien.
    const roti = makeRecipe('poulet_roti', {
      ingredients: [makeIngredient('poulet', { quantiteG: 500 }), makeIngredient('carotte', { quantiteG: 300 })],
    })
    const curry = makeRecipe('poulet_curry', {
      ingredients: [makeIngredient('poulet', { quantiteG: 500 }), makeIngredient('carotte', { quantiteG: 250 })],
    })

    const index = computeRecipeSignature(makeCatalog([roti, curry]))

    expect(signatureOverlap(index.get(roti.id)!, index.get(curry.id)!)).toBeGreaterThan(0.9)
  })
})
