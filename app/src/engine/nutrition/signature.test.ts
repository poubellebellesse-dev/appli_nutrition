// engine/nutrition/signature.test.ts — computeRecipeSignature / signatureOverlap (docs/ENGINE.md §6.6).

import { describe, expect, it } from 'vitest'
import type { FoodId, RecipeSignature } from '../domain/index.js'
import { SIGNATURE_SIZE, computeRecipeFamilySignature, computeRecipeSignature, signatureOverlap } from './signature.js'
import { VARIETY_RECENCY_OVERLAP_THRESHOLD } from '../selection/scoring/variety.js'
import { makeCatalog, makeFood, makeIngredient, makeRecipe } from './test-fixtures.js'

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
  it('⛔ IL N’EXISTE PAS DE MESURE « DIRIGÉE » ICI — la signature est normalisée à 1', () => {
    // GARDE-FOU CONTRE UNE IMPASSE DÉJÀ PAYÉE (2026-08-04, voir l'en-tête de signature.ts). Une
    // fonction « quelle part de ce que j'ajoute est déjà dans l'assiette » a été écrite pour poser
    // un accompagnement sans répéter le plat, puis retirée : `Σ min / Σ(ajouté)` avec un
    // dénominateur qui vaut TOUJOURS 1 n'est qu'une remise à l'échelle monotone du Jaccard.
    // Ce test le rend impossible à réinventer sans s'en apercevoir.
    const plat = sig({ agneau: 0.75, pomme_de_terre: 0.25 })
    const accompagnement = sig({ pomme_de_terre: 1 })

    const sommeDesMinima = 0.25 // ce que la fonction « dirigée » rendait, dans les DEUX sens
    expect(signatureOverlap(plat, accompagnement)).toBeCloseTo(sommeDesMinima / (2 - sommeDesMinima), 10)
  })


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

describe('nutrition/signature — computeRecipeFamilySignature (§6.6 quater)', () => {
  // Deux morceaux du même animal, deux aliments distincts du catalogue — la situation exacte que
  // la sous-famille existe pour traiter.
  const POULET_BLANC = makeFood('poulet_blanc', {}, { sousFamille: 'poulet' })
  const POULET_CUISSE = makeFood('poulet_cuisse', {}, { sousFamille: 'poulet' })
  const CAROTTE = makeFood('carotte')

  it('replie deux aliments d’une même sous-famille sur une seule clé, en cumulant leurs parts', () => {
    const recette = makeRecipe('mixte', {
      ingredients: [
        makeIngredient('poulet_blanc', { quantiteG: 200 }),
        makeIngredient('poulet_cuisse', { quantiteG: 200 }),
        makeIngredient('carotte', { quantiteG: 100 }),
      ],
    })
    const catalog = makeCatalog([recette], [POULET_BLANC, POULET_CUISSE, CAROTTE])

    const familySignature = computeRecipeFamilySignature(catalog).get(recette.id)!

    // 3 aliments → 2 clés : les deux morceaux fusionnent, et leurs parts s'ADDITIONNENT (0,4+0,4).
    expect(familySignature.size).toBe(2)
    expect(familySignature.get('poulet')).toBeCloseTo(0.8, 10)
    expect(familySignature.get('carotte')).toBeCloseTo(0.2, 10)
  })

  it('un aliment sans sous-famille garde son propre id pour clé', () => {
    const recette = makeRecipe('simple', { ingredients: [makeIngredient('carotte', { quantiteG: 100 })] })
    const catalog = makeCatalog([recette], [CAROTTE])

    expect([...computeRecipeFamilySignature(catalog).get(recette.id)!.keys()]).toEqual(['carotte'])
  })

  it('aliment absent du catalogue → repli sur son id, jamais de plantage ni de clé perdue', () => {
    const recette = makeRecipe('orpheline', { ingredients: [makeIngredient('inconnu', { quantiteG: 100 })] })

    const familySignature = computeRecipeFamilySignature(makeCatalog([recette])).get(recette.id)!

    expect(familySignature.get('inconnu')).toBeCloseTo(1, 10)
  })

  it('la somme des parts reste 1 après repli — invariant partagé avec la signature brute', () => {
    const recette = makeRecipe('mixte', {
      ingredients: [
        makeIngredient('poulet_blanc', { quantiteG: 200 }),
        makeIngredient('poulet_cuisse', { quantiteG: 150 }),
        makeIngredient('carotte', { quantiteG: 90 }),
      ],
    })
    const catalog = makeCatalog([recette], [POULET_BLANC, POULET_CUISSE, CAROTTE])

    const total = [...computeRecipeFamilySignature(catalog).get(recette.id)!.values()].reduce((s, v) => s + v, 0)

    expect(total).toBeCloseTo(1, 10)
  })

  it('CAS QUI MOTIVE LA FONCTION : deux plats de poulet sur des morceaux différents passent de « sans rapport » à « proches »', () => {
    const curry = makeRecipe('poulet_curry', {
      ingredients: [makeIngredient('poulet_blanc', { quantiteG: 400 }), makeIngredient('carotte', { quantiteG: 100 })],
    })
    const teriyaki = makeRecipe('poulet_teriyaki', {
      ingredients: [makeIngredient('poulet_cuisse', { quantiteG: 400 }), makeIngredient('carotte', { quantiteG: 100 })],
    })
    const catalog = makeCatalog([curry, teriyaki], [POULET_BLANC, POULET_CUISSE, CAROTTE])

    const brut = computeRecipeSignature(catalog)
    const famille = computeRecipeFamilySignature(catalog)

    // Signature BRUTE : seule la carotte est commune → sous le seuil de récence.
    expect(signatureOverlap(brut.get(curry.id)!, brut.get(teriyaki.id)!)).toBeLessThan(
      VARIETY_RECENCY_OVERLAP_THRESHOLD,
    )
    // Signature REPLIÉE : le poulet devient commun → les deux plats comptent comme le même repas.
    expect(signatureOverlap(famille.get(curry.id)!, famille.get(teriyaki.id)!)).toBe(1)
  })

  it('ne rapproche PAS deux sous-familles différentes — le repli n’est pas un nivellement', () => {
    // Garde-fou contre la dérive mesurée sur `Food.groupe` : « viandes » rendait tout plat carné
    // équivalent à tout autre. La sous-famille doit rester d'un cran plus fine.
    const agneau = makeFood('agneau_gigot', {}, { sousFamille: 'agneau' })
    const plat = makeRecipe('poulet', { ingredients: [makeIngredient('poulet_blanc', { quantiteG: 400 })] })
    const autre = makeRecipe('agneau', { ingredients: [makeIngredient('agneau_gigot', { quantiteG: 400 })] })
    const catalog = makeCatalog([plat, autre], [POULET_BLANC, agneau])

    const famille = computeRecipeFamilySignature(catalog)

    expect(signatureOverlap(famille.get(plat.id)!, famille.get(autre.id)!)).toBe(0)
  })
})
