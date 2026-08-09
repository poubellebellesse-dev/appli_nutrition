// engine/cuisine/equipement-partage.test.ts — l'ustensile que deux plats se disputent.
//
// ⚠️ CE QUI EST GARDÉ ICI N'EST PAS « le module trouve les doublons » — c'est trivial — MAIS CE
// QU'IL REFUSE DE SIGNALER. Un avertissement qui se déclenche sur deux paires de plats sur trois ne
// se lit plus, et la plaque de cuisson suffirait à l'y amener toute seule (260 recettes sur 330).
// Les trois tests « ne signale PAS » sont donc les vrais tests du lot.

import { describe, expect, it } from 'vitest'
import { CODES_INDIVISIBLES, equipementsDisputes } from './equipement-partage.js'
import type { EquipmentId, EquipmentLevel, RecipeId } from '../domain/index.js'

/** Le référentiel est ici l'identité : au catalogue, `equipment.id` vaut `equipment.code`. */
const codeDe = (id: EquipmentId): string | null => id as string

function plat(recipeId: string, ...materiel: readonly (readonly [string, EquipmentLevel])[]) {
  return {
    recipeId: recipeId as RecipeId,
    equipements: materiel.map(([equipmentId, niveau]) => ({
      equipmentId: equipmentId as EquipmentId,
      niveau,
    })),
  }
}

describe('cuisine/equipement-partage — ce qui est signalé', () => {
  it('deux plats qui exigent le four : le four est nommé, avec les deux recettes', () => {
    const r = equipementsDisputes(
      [plat('gratin', ['four', 'requis']), plat('roti', ['four', 'requis'])],
      codeDe,
    )
    expect(r).toEqual([{ equipmentId: 'four', recipeIds: ['gratin', 'roti'] }])
  })

  it('trois plats sur le même four : les trois sont nommés, triés et sans doublon', () => {
    const r = equipementsDisputes(
      [plat('c', ['four', 'requis']), plat('a', ['four', 'requis']), plat('b', ['four', 'requis'])],
      codeDe,
    )
    expect(r[0]!.recipeIds).toEqual(['a', 'b', 'c'])
  })

  it('reproductible : l’ordre d’entrée ne change rien', () => {
    const plats = [
      plat('z', ['four', 'requis'], ['micro_ondes', 'requis']),
      plat('a', ['four', 'requis'], ['micro_ondes', 'requis']),
    ]
    expect(equipementsDisputes(plats, codeDe)).toEqual(equipementsDisputes([...plats].reverse(), codeDe))
  })
})

describe('cuisine/equipement-partage — ⛔ CE QUI N’EST PAS SIGNALÉ, et c’est le sujet', () => {
  it('⛔ LA PLAQUE DE CUISSON NE DÉCLENCHE RIEN — elle a plusieurs feux', () => {
    // 260 recettes sur 330 la déclarent `requis`. La signaler, c'est avertir sur 63 % des paires de
    // plats, donc n'avertir sur rien. Ce test tombe le jour où quelqu'un l'ajoute à la liste.
    const r = equipementsDisputes(
      [plat('chakchouka', ['plaque_cuisson', 'requis']), plat('riz', ['plaque_cuisson', 'requis'])],
      codeDe,
    )
    expect(r).toEqual([])
    expect(CODES_INDIVISIBLES).not.toContain('plaque_cuisson')
  })

  it('⛔ `accelere` ET `informatif` NE DÉCLENCHENT RIEN — un seul niveau est une contrainte', () => {
    const r = equipementsDisputes(
      [plat('a', ['four', 'accelere']), plat('b', ['four', 'informatif'])],
      codeDe,
    )
    expect(r).toEqual([])
  })

  it('⛔ un four requis par UN SEUL plat ne se dispute avec personne', () => {
    const r = equipementsDisputes(
      [plat('gratin', ['four', 'requis']), plat('salade', ['saladier', 'requis'])],
      codeDe,
    )
    expect(r).toEqual([])
  })

  it('un plat seul ne dispute rien, même avec deux ustensiles indivisibles', () => {
    expect(
      equipementsDisputes([plat('seul', ['four', 'requis'], ['micro_ondes', 'requis'])], codeDe),
    ).toEqual([])
  })

  it('liste vide, et plats sans le moindre matériel déclaré', () => {
    expect(equipementsDisputes([], codeDe)).toEqual([])
    expect(equipementsDisputes([plat('a'), plat('b')], codeDe)).toEqual([])
  })

  it('un `equipmentId` que le référentiel ne connaît pas est ignoré, sans lever', () => {
    // `codeDe` rend `null` : le module n'a pas de quoi juger, il se tait plutôt que de supposer.
    const r = equipementsDisputes(
      [plat('a', ['fantome', 'requis']), plat('b', ['fantome', 'requis'])],
      () => null,
    )
    expect(r).toEqual([])
  })
})
