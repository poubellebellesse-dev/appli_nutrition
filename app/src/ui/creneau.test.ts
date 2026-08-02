// ui/creneau.test.ts — quel repas l'écran « Aujourd'hui » doit-il montrer, et à quelle heure ?
//
// Le défaut corrigé : `aujourdhui.tsx` portait `const CRENEAU: MealSlot = 'diner'` EN DUR. À 11 h 45
// l'écran titrait « Ce soir » et proposait des dîners. Et `rythme.repasParJour`, collecté au premier
// lancement, n'était lu par AUCUN écran — un réglage sans consommateur, exactement le défaut que la
// fiche de reprise décrit à propos de `preference` et du filtre allergènes.

import { describe, expect, it } from 'vitest'
import type { MealSlot } from '../engine/domain/index.js'
import { TITRE_CRENEAU, creneauDuMoment, creneauxDuRythme } from './creneau.js'

const UN: readonly MealSlot[] = ['diner']
const DEUX: readonly MealSlot[] = ['dejeuner', 'diner']
const TROIS: readonly MealSlot[] = ['petit_dejeuner', 'dejeuner', 'diner']
const QUATRE: readonly MealSlot[] = ['petit_dejeuner', 'dejeuner', 'gouter', 'diner']

describe('ui/creneau — créneaux d’un rythme', () => {
  it('dérive les créneaux du nombre de repas déclaré au premier lancement', () => {
    expect(creneauxDuRythme(1)).toEqual(UN)
    expect(creneauxDuRythme(2)).toEqual(DEUX)
    expect(creneauxDuRythme(3)).toEqual(TROIS)
    expect(creneauxDuRythme(4)).toEqual(QUATRE)
  })

  it('retombe sur deux repas pour un nombre hors bornes, jamais sur une liste vide', () => {
    // Une liste vide ferait un écran sans repas du tout. `user_rythme` borne déjà 1..3 en base ;
    // ceci couvre un rythme absent ou une base plus ancienne.
    expect(creneauxDuRythme(0)).toEqual(DEUX)
    expect(creneauxDuRythme(9)).toEqual(DEUX)
  })
})

describe('ui/creneau — le repas du moment', () => {
  it('montre le DÉJEUNER en fin de matinée — le cas qui a révélé le défaut', () => {
    // 11 h 45, rythme à deux repas : « Ce soir » était faux.
    expect(creneauDuMoment(11, DEUX)).toBe('dejeuner')
    expect(creneauDuMoment(12, DEUX)).toBe('dejeuner')
    expect(creneauDuMoment(13, DEUX)).toBe('dejeuner')
  })

  it('bascule sur le dîner une fois le déjeuner passé', () => {
    expect(creneauDuMoment(14, DEUX)).toBe('diner')
    expect(creneauDuMoment(19, DEUX)).toBe('diner')
  })

  it('montre le petit-déjeuner au réveil, mais SEULEMENT s’il est au programme', () => {
    expect(creneauDuMoment(7, TROIS)).toBe('petit_dejeuner')
    // À deux repas, personne n'a prévu de petit-déjeuner : proposer le repas suivant, pas un
    // créneau que le rythme exclut.
    expect(creneauDuMoment(7, DEUX)).toBe('dejeuner')
  })

  it('ne propose que le dîner quand le rythme est à un seul repas, quelle que soit l’heure', () => {
    for (const heure of [0, 7, 12, 15, 23]) expect(creneauDuMoment(heure, UN)).toBe('diner')
  })

  it('reste sur le dîner tard le soir plutôt que de sauter à demain', () => {
    // Choix assumé : à 23 h on regarde encore le repas du jour. Basculer sur le petit-déjeuner du
    // lendemain ferait changer la date sous les pieds de l'utilisateur sans qu'il ait rien demandé.
    expect(creneauDuMoment(23, TROIS)).toBe('diner')
    expect(creneauDuMoment(2, TROIS)).toBe('petit_dejeuner')
  })

  it('rend toujours un créneau APPARTENANT au rythme', () => {
    for (const creneaux of [UN, DEUX, TROIS, QUATRE]) {
      for (let heure = 0; heure < 24; heure++) {
        expect(creneaux).toContain(creneauDuMoment(heure, creneaux))
      }
    }
  })

  it('à quatre repas, insère le goûter entre déjeuner et dîner sans manger la fenêtre du déjeuner', () => {
    // FIN_DE_CRENEAU : dejeuner=14, gouter=17, diner=24. 12 h doit encore donner le déjeuner ;
    // 15 h et 16 h doivent donner le goûter, pas le déjeuner (fenêtre close) ni le dîner (trop tôt).
    expect(creneauDuMoment(7, QUATRE)).toBe('petit_dejeuner')
    expect(creneauDuMoment(9, QUATRE)).toBe('petit_dejeuner')
    expect(creneauDuMoment(10, QUATRE)).toBe('dejeuner')
    expect(creneauDuMoment(12, QUATRE)).toBe('dejeuner')
    expect(creneauDuMoment(13, QUATRE)).toBe('dejeuner')
    expect(creneauDuMoment(14, QUATRE)).toBe('gouter')
    expect(creneauDuMoment(15, QUATRE)).toBe('gouter')
    expect(creneauDuMoment(16, QUATRE)).toBe('gouter')
    expect(creneauDuMoment(17, QUATRE)).toBe('diner')
    expect(creneauDuMoment(20, QUATRE)).toBe('diner')
    expect(creneauDuMoment(23, QUATRE)).toBe('diner')
  })
})

describe('ui/creneau — titres', () => {
  it('donne un titre conversationnel à chaque créneau, pas un libellé de base', () => {
    expect(TITRE_CRENEAU.petit_dejeuner).toBe('Ce matin')
    expect(TITRE_CRENEAU.dejeuner).toBe('Ce midi')
    expect(TITRE_CRENEAU.diner).toBe('Ce soir')
  })

  it('couvre les quatre créneaux — un titre manquant afficherait « undefined »', () => {
    for (const creneau of ['petit_dejeuner', 'dejeuner', 'gouter', 'diner'] as const) {
      expect(TITRE_CRENEAU[creneau]).toBeTruthy()
    }
  })
})
