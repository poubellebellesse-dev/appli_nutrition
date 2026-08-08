// engine/cuisine/ordonnancement.test.ts — ordonnancement des cuissons pour un service commun.

import { describe, expect, it } from 'vitest'
import { ordonnancerCuissons } from './ordonnancement.js'
import type { RecipeId } from '../domain/index.js'

function cuisson(recipeId: string, nom: string, dureeMin: number) {
  return { recipeId: recipeId as RecipeId, nom, dureeMin }
}

describe('cuisine/ordonnancement', () => {
  it('trie trois plats de durées différentes du plus long au plus court', () => {
    const resultat = ordonnancerCuissons([
      cuisson('gratin', 'Gratin', 35),
      cuisson('roti', 'Rôti', 120),
      cuisson('sauce', 'Sauce', 15),
    ])

    expect(resultat.departs.map((d) => d.recipeId)).toEqual(['roti', 'gratin', 'sauce'])
    expect(resultat.departs.map((d) => d.rang)).toEqual([0, 1, 2])
    expect(resultat.departs.map((d) => d.departAvantServiceMin)).toEqual([120, 35, 15])
  })

  it('LA SAUCE PART EN DERNIER — on ne la lance pas en même temps que le rôti', () => {
    const resultat = ordonnancerCuissons([
      cuisson('roti', 'Rôti', 120),
      cuisson('gratin', 'Gratin', 35),
      cuisson('sauce', 'Sauce', 15),
    ])

    const derniere = resultat.departs[resultat.departs.length - 1]!
    expect(derniere.recipeId).toBe('sauce')
    expect(derniere.departAvantServiceMin).toBe(15)
  })

  it('liste vide → aucun départ, amplitude nulle', () => {
    expect(ordonnancerCuissons([])).toEqual({ departs: [], amplitudeMin: 0 })
  })

  it('une seule cuisson → rang 0, amplitude = sa durée', () => {
    const resultat = ordonnancerCuissons([cuisson('plat', 'Plat', 40)])

    expect(resultat.departs).toEqual([
      { recipeId: 'plat', nom: 'Plat', rang: 0, departAvantServiceMin: 40, dureeMin: 40 },
    ])
    expect(resultat.amplitudeMin).toBe(40)
  })

  it('égalité de durée : départage par recipeId, reproductible quel que soit l’ordre d’entrée', () => {
    const a = ordonnancerCuissons([cuisson('zebre', 'Zèbre', 20), cuisson('abricot', 'Abricot', 20)])
    const b = ordonnancerCuissons([cuisson('abricot', 'Abricot', 20), cuisson('zebre', 'Zèbre', 20)])

    expect(a.departs.map((d) => d.recipeId)).toEqual(['abricot', 'zebre'])
    expect(b.departs.map((d) => d.recipeId)).toEqual(['abricot', 'zebre'])
    expect(a).toEqual(b)
  })

  it('dureeMin à 0 est normal et part en dernier rang, départ à 0', () => {
    const resultat = ordonnancerCuissons([cuisson('cru', 'Salade', 0), cuisson('cuit', 'Ragoût', 60)])

    const dernier = resultat.departs[resultat.departs.length - 1]!
    expect(dernier.recipeId).toBe('cru')
    expect(dernier.departAvantServiceMin).toBe(0)
    expect(dernier.rang).toBe(1)
  })

  it('refuse une dureeMin négative en nommant le recipeId fautif', () => {
    expect(() => ordonnancerCuissons([cuisson('casse', 'Casse', -5)])).toThrow('casse')
  })

  it('refuse une dureeMin NaN', () => {
    expect(() => ordonnancerCuissons([cuisson('nan', 'Nan', Number.NaN)])).toThrow('nan')
  })

  it('refuse une dureeMin infinie', () => {
    expect(() => ordonnancerCuissons([cuisson('infini', 'Infini', Number.POSITIVE_INFINITY)])).toThrow('infini')
  })

  it('refuse un recipeId en double', () => {
    expect(() =>
      ordonnancerCuissons([cuisson('doublon', 'Un', 10), cuisson('doublon', 'Deux', 20)]),
    ).toThrow('doublon')
  })

  it('ne mute jamais le tableau d’entrée', () => {
    const entree = [cuisson('court', 'Court', 5), cuisson('long', 'Long', 50)]
    const copie = [...entree]

    ordonnancerCuissons(entree)

    expect(entree).toEqual(copie)
  })

  it('amplitudeMin correspond au plus long, même avec plusieurs plats', () => {
    const resultat = ordonnancerCuissons([
      cuisson('a', 'A', 10),
      cuisson('b', 'B', 90),
      cuisson('c', 'C', 45),
    ])

    expect(resultat.amplitudeMin).toBe(90)
  })
})
