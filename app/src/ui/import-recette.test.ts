// ui/import-recette.test.ts — le lecteur du format `.nutri-recipe`, contrepartie d'`export-recette.ts`.
//
// ⚠️ CE QUI COMPTE LE PLUS ICI, DANS CET ORDRE : (1) un `foodId` inconnu est REFUSÉ, jamais accepté
// avec zéro allergène agrégé en silence ; (2) l'id importé n'est JAMAIS celui du fichier, et une
// recette existante portant cet id n'est pas écrasable par construction (l'id n'est même pas lu) ;
// (3) chaque motif de refus a un message distinct et lisible.

import { describe, expect, it } from 'vitest'
import { catalogueDeTest } from './test-socle.js'
import { serialiserRecette } from './export-recette.js'
import { importerRecette } from './import-recette.js'
import type { StoredUserRecipe } from '../data/user-recipe.js'

function recetteDeTest(foodId: string): StoredUserRecipe {
  return {
    schemaVersion: 1,
    id: 'perso:originale-abc',
    source: 'perso',
    baseRecipeId: null,
    nom: 'Ma tarte aux poireaux',
    tempsPrepMin: 15,
    tempsCuissonMin: 30,
    portionsBase: 4,
    difficulte: 2,
    typesRepas: ['diner'],
    envergure: 'quotidien',
    conservationJours: 2,
    axes: { sucreSale: -1, legerConsistant: 0, chaudFroid: 1, texture: 'moelleux' },
    ingredients: [{ foodId, quantiteG: 300, uniteAffichage: '2 poireaux', optionnel: false }],
    etapes: ['Couper les poireaux.', 'Cuire au four.'],
    facettesHeritees: [],
    service: null,
    piquant: null,
  }
}

describe('importerRecette — l’aller-retour avec exporterRecette', () => {
  it('un fichier exporté se réimporte, sous un NOUVEL id, avec source « importe »', () => {
    const catalogue = catalogueDeTest()
    const unAliment = [...catalogue.foods.keys()][0]!
    const originale = recetteDeTest(unAliment)
    const fichier = serialiserRecette(originale)

    const resultat = importerRecette(fichier, catalogue, 'perso:nouvel-id-xyz')

    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.recette.nom).toBe(originale.nom)
    expect(resultat.recette.ingredients).toEqual(originale.ingredients)
    expect(resultat.recette.source).toBe('importe')
    // ⛔ Le test le plus important après l'allergène : l'id du fichier n'est JAMAIS repris, quel que
    // soit l'id fourni par l'appelant — sinon `saveUserRecipe` écraserait une recette existante.
    expect(resultat.recette.id).toBe('perso:nouvel-id-xyz')
    expect(resultat.recette.id).not.toBe(originale.id)
  })
})

describe('importerRecette — refus pour ingrédient inconnu', () => {
  it('refuse quand un foodId n’existe pas au catalogue local, et le nomme dans le message', () => {
    const catalogue = catalogueDeTest()
    const fichier = serialiserRecette(recetteDeTest('aliment-totalement-inconnu-9284'))

    const resultat = importerRecette(fichier, catalogue, 'perso:nouvel-id')

    expect(resultat.ok).toBe(false)
    if (resultat.ok) return
    expect(resultat.raison).toContain('aliment-totalement-inconnu-9284')
  })
})

describe('importerRecette — entrée non fiable', () => {
  const catalogue = catalogueDeTest()

  it('JSON illisible → refus distinct', () => {
    const resultat = importerRecette('{ ceci n’est pas du JSON', catalogue, 'perso:x')
    expect(resultat.ok).toBe(false)
    if (resultat.ok) return
    expect(resultat.raison).toMatch(/lisible/)
  })

  it('schemaVersion absente → refus distinct', () => {
    const resultat = importerRecette(JSON.stringify({ id: 'x', nom: 'x', ingredients: [] }), catalogue, 'perso:x')
    expect(resultat.ok).toBe(false)
    if (resultat.ok) return
    expect(resultat.raison).toMatch(/version/)
  })

  it('schemaVersion inconnue → refus distinct', () => {
    const unAliment = [...catalogue.foods.keys()][0]!
    const fichier = { ...recetteDeTest(unAliment), schemaVersion: 99 }
    const resultat = importerRecette(JSON.stringify(fichier), catalogue, 'perso:x')
    expect(resultat.ok).toBe(false)
    if (resultat.ok) return
    expect(resultat.raison).toMatch(/version/)
  })

  it('aucun ingrédient → refus distinct', () => {
    const fichier = { ...recetteDeTest('peu-importe'), ingredients: [] }
    const resultat = importerRecette(JSON.stringify(fichier), catalogue, 'perso:x')
    expect(resultat.ok).toBe(false)
    if (resultat.ok) return
    expect(resultat.raison).toMatch(/ingrédient/)
  })

  it('quantité négative → refus, sans planter', () => {
    const unAliment = [...catalogue.foods.keys()][0]!
    const fichier = recetteDeTest(unAliment)
    const mal = {
      ...fichier,
      ingredients: [{ ...fichier.ingredients[0]!, quantiteG: -5 }],
    }
    const resultat = importerRecette(JSON.stringify(mal), catalogue, 'perso:x')
    expect(resultat.ok).toBe(false)
  })
})
