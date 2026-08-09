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
      { recipeId: 'plat', nom: 'Plat', rang: 0, departAvantServiceMin: 40, dureeMin: 40, retardMin: 0 },
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

// ── L2 ────────────────────────────────────────────────────────────────────────────────────────────
//
// ⚠️ LE PREMIER TEST DE CE BLOC EST LE PLUS IMPORTANT DU LOT. Tout le reste peut se discuter ; ce
// qui ne se discute pas, c'est qu'une recette sans temps passif produise exactement ce qu'elle
// produisait avant. `segments` est un ajout strict, et un ajout strict se prouve.

function seg(nature: 'actif' | 'passif', dureeMin: number, ordre = 0) {
  return { ordre, nature, dureeMin }
}

describe('cuisine/ordonnancement — L2, l’entrelacement actif/passif', () => {
  it('⛔ SANS SEGMENTS, LE RÉSULTAT EST CELUI D’AVANT L2 — au champ `retardMin` près', () => {
    const avec = ordonnancerCuissons([
      cuisson('roti', 'Rôti', 120),
      cuisson('gratin', 'Gratin', 35),
      cuisson('sauce', 'Sauce', 15),
    ])
    expect(avec.departs.map((d) => [d.recipeId, d.departAvantServiceMin, d.rang])).toEqual([
      ['roti', 120, 0],
      ['gratin', 35, 1],
      ['sauce', 15, 2],
    ])
    expect(avec.departs.every((d) => d.retardMin === 0)).toBe(true)
  })

  it('⛔ UN PLAT TOUT ACTIF NE BOUGE PAS NON PLUS quand il est seul à travailler', () => {
    // Segments fournis, mais aucun voisin : rien à esquiver, donc `retardMin` vaut 0 EXACTEMENT.
    const r = ordonnancerCuissons([
      { ...cuisson('seul', 'Seul', 50), segments: [seg('actif', 20, 1), seg('passif', 10, 2), seg('actif', 20, 3)] },
    ])
    expect(r.departs[0]!.retardMin).toBe(0)
    expect(r.departs[0]!.departAvantServiceMin).toBe(50)
  })

  it('LE CŒUR DU LOT — les 12 h de marinade sont TRANSPARENTES, le mijotage ne l’est pas', () => {
    // Coq au vin : 15 min de gestes, 12 h de marinade, 100 min de mijotage → 835 min écoulées.
    // Une salade de 20 min doit esquiver le mijotage (100 min actives avant le service) mais peut
    // se faire pendant la marinade : elle part 120 min avant, pas 20.
    const salade = { ...cuisson('salade', 'Salade', 20), segments: [seg('actif', 20, 1)] }
    const decoupe = ordonnancerCuissons([
      {
        ...cuisson('coq', 'Coq au vin', 835),
        segments: [seg('actif', 15, 1), seg('passif', 720, 2), seg('actif', 100, 3)],
      },
      salade,
    ])

    expect(decoupe.departs.find((d) => d.recipeId === 'salade')!.departAvantServiceMin).toBe(120)
    expect(decoupe.departs.find((d) => d.recipeId === 'coq')!.retardMin).toBe(0)
    expect(decoupe.amplitudeMin).toBe(835)

    // ⛔ LA COMPARAISON QUI DIT CE QUE VAUT LE LOT : le même coq au vin traité comme un bloc plein
    // — ce qu'il était jusqu'ici — repousse la salade de 12 heures pour rien.
    const bloc = ordonnancerCuissons([
      { ...cuisson('coq', 'Coq au vin', 835), segments: [seg('actif', 835, 1)] },
      salade,
    ])
    expect(bloc.departs.find((d) => d.recipeId === 'salade')!.departAvantServiceMin).toBe(855)
  })

  it('DEUX PLATS TOUT ACTIFS SE POUSSENT — le second recule d’exactement ce qui le gênait', () => {
    const r = ordonnancerCuissons([
      { ...cuisson('long', 'Long', 60), segments: [seg('actif', 60, 1)] },
      { ...cuisson('court', 'Court', 20), segments: [seg('actif', 20, 1)] },
    ])

    // Le long occupe [0, 60] avant le service. Le court, qui voulait [0, 20], est reculé à [60, 80].
    const court = r.departs.find((d) => d.recipeId === 'court')!
    expect(court.retardMin).toBe(60)
    expect(court.departAvantServiceMin).toBe(80)
  })

  it('⛔ ET LE RANG SUIT LE DÉPART, PAS LA DURÉE — le plat court part alors EN PREMIER', () => {
    // Conséquence directe du test précédent, et le piège de l'écran : trier par durée remettrait le
    // long en tête alors que c'est le court qu'il faut lancer d'abord.
    const r = ordonnancerCuissons([
      { ...cuisson('long', 'Long', 60), segments: [seg('actif', 60, 1)] },
      { ...cuisson('court', 'Court', 20), segments: [seg('actif', 20, 1)] },
    ])
    expect(r.departs.map((d) => d.recipeId)).toEqual(['court', 'long'])
    expect(r.departs.map((d) => d.rang)).toEqual([0, 1])
    expect(r.amplitudeMin).toBe(80)
  })

  it('⛔ AUCUN PLAT NE PART TROP TARD — le seul engagement que ce module puisse tenir', () => {
    // ⚠️ CE TEST NE DIT RIEN DE LA FIN, et il ne faut pas lui faire dire qu'aucun plat n'est prêt en
    // avance : ici, C est un plat d'un seul geste poussé de 70 min, donc terminé 70 min avant le
    // service. Trois plats tout actifs et une seule paire de mains — deux d'entre eux attendront,
    // quoi qu'on ordonnance. Le module s'engage sur le DÉPART, pas sur la température.
    const r = ordonnancerCuissons([
      { ...cuisson('a', 'A', 40), segments: [seg('actif', 40, 1)] },
      { ...cuisson('b', 'B', 30), segments: [seg('actif', 30, 1)] },
      { ...cuisson('c', 'C', 25), segments: [seg('actif', 25, 1)] },
    ])
    for (const d of r.departs) {
      expect(d.departAvantServiceMin - d.dureeMin).toBe(d.retardMin)
      expect(d.retardMin).toBeGreaterThanOrEqual(0)
      expect(d.departAvantServiceMin).toBeGreaterThanOrEqual(d.dureeMin)
    }
    // A garde le créneau collé au service ; B et C reculent, dans cet ordre.
    expect(r.departs.map((d) => [d.recipeId, d.departAvantServiceMin])).toEqual([
      ['c', 95],
      ['b', 70],
      ['a', 40],
    ])
  })

  it('reproductible : l’ordre d’ENTRÉE ne change rien au résultat', () => {
    const plats = [
      { ...cuisson('coq', 'Coq', 835), segments: [seg('actif', 15, 1), seg('passif', 720, 2), seg('actif', 100, 3)] },
      { ...cuisson('gratin', 'Gratin', 50), segments: [seg('actif', 20, 1), seg('passif', 10, 2), seg('actif', 20, 3)] },
      { ...cuisson('salade', 'Salade', 20), segments: [seg('actif', 20, 1)] },
    ]
    expect(ordonnancerCuissons(plats)).toEqual(ordonnancerCuissons([...plats].reverse()))
  })

  it('refuse des segments qui ne totalisent pas `dureeMin`, en nommant le recipeId', () => {
    expect(() =>
      ordonnancerCuissons([{ ...cuisson('menteur', 'Menteur', 60), segments: [seg('actif', 10, 1)] }]),
    ).toThrow('menteur')
  })

  it('refuse un segment de durée négative ou non finie', () => {
    expect(() =>
      ordonnancerCuissons([{ ...cuisson('neg', 'Neg', 10), segments: [seg('actif', -10, 1), seg('actif', 20, 2)] }]),
    ).toThrow('neg')
    expect(() =>
      ordonnancerCuissons([{ ...cuisson('nan', 'Nan', 10), segments: [seg('actif', Number.NaN, 1)] }]),
    ).toThrow('nan')
  })

  it('un tableau de segments VIDE est traité comme une absence de segments', () => {
    const r = ordonnancerCuissons([{ ...cuisson('vide', 'Vide', 30), segments: [] }])
    expect(r.departs[0]!.departAvantServiceMin).toBe(30)
    expect(r.departs[0]!.retardMin).toBe(0)
  })

  it('des durées fractionnaires ne produisent PAS de retard fantôme', () => {
    // Le piège du flottant : 40/3 + 40/3 + 40/3 ne fait pas exactement 40. Sans le seuil de bruit,
    // un plat que rien n'a déplacé sortirait avec `retardMin: 1`.
    const tiers = 40 / 3
    const r = ordonnancerCuissons([
      { ...cuisson('tiers', 'Tiers', 40), segments: [seg('actif', tiers, 1), seg('actif', tiers, 2), seg('actif', tiers, 3)] },
    ])
    expect(r.departs[0]!.retardMin).toBe(0)
    expect(r.departs[0]!.departAvantServiceMin).toBe(40)
  })
})
