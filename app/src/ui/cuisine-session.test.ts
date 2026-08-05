// ui/cuisine-session.test.ts — le point 7 de §5bis, vérifié sans navigateur.
//
// Ces tests portent sur la SEULE règle du mode cuisine dont l'erreur concernerait la nourriture.
// Aucun DOM, aucun faux timer : le module reçoit `maintenant` en paramètre, on lui donne l'instant
// qu'on veut.

import { describe, expect, it } from 'vitest'
import type { StoredCuisineTimer } from '../data/user-store.js'
import {
  PEREMPTION_CUISINE_MS,
  etatMinuteur,
  formaterDuree,
  libelleMinuteur,
  sessionPerimee,
} from './cuisine-session.js'

const T0 = 1_770_000_000_000 // un instant fixe, sans signification particulière

function enMarche(finMs: number): StoredCuisineTimer {
  return { ordre: 1, finMs, pauseRestantS: null }
}

describe('cuisine-session — ce qu’un minuteur affirme', () => {
  it('en marche : rend le reste RÉEL, calculé depuis l’échéance absolue', () => {
    expect(etatMinuteur(enMarche(T0 + 125_000), T0)).toEqual({ mode: 'marche', restantS: 125 })
  })

  // ⛔ LE TEST QUI COMPTE. Une session rouverte après coup ne doit pas afficher un décompte figé,
  // et surtout pas laisser croire que la sonnerie vient de retentir. Écrire une échéance dans le
  // passé, c'est exactement ce que produit « fermer l'appli et revenir ».
  it('⛔ échéance dépassée : dit « terminé » AVEC son ancienneté, jamais un décompte figé', () => {
    const etat = etatMinuteur(enMarche(T0 - 38 * 60 * 1000), T0)

    expect(etat).toEqual({ mode: 'termine', depuisS: 38 * 60 })
    expect(libelleMinuteur(etat)).toBe('terminé il y a 38:00')
  })

  it('en pause : le reste figé est vrai, parce que c’est l’utilisateur qui a arrêté le temps', () => {
    const enPause: StoredCuisineTimer = { ordre: 2, finMs: null, pauseRestantS: 90 }

    // Deux heures plus tard, une pause dit toujours la même chose — c'est le seul cas où c'est vrai.
    expect(etatMinuteur(enPause, T0)).toEqual({ mode: 'pause', restantS: 90 })
    expect(etatMinuteur(enPause, T0 + 2 * 60 * 60 * 1000)).toEqual({ mode: 'pause', restantS: 90 })
  })

  it('à l’instant exact de l’échéance : terminé, pas « il reste 0 »', () => {
    expect(etatMinuteur(enMarche(T0), T0)).toEqual({ mode: 'termine', depuisS: 0 })
  })

  it('arrondit le reste au SUPÉRIEUR — afficher 0 s alors qu’il en reste est déjà un mensonge', () => {
    expect(etatMinuteur(enMarche(T0 + 400), T0)).toEqual({ mode: 'marche', restantS: 1 })
  })

  it('une ligne sans échéance ni pause ne promet rien (base bricolée hors CHECK)', () => {
    expect(etatMinuteur({ ordre: 1, finMs: null, pauseRestantS: null }, T0)).toEqual({
      mode: 'termine',
      depuisS: 0,
    })
  })
})

describe('cuisine-session — péremption d’une cuisson oubliée', () => {
  it('une cuisson d’il y a deux heures se reprend', () => {
    expect(sessionPerimee(T0 - 2 * 60 * 60 * 1000, T0)).toBe(false)
  })

  it('une cuisson d’avant le seuil ne se propose plus', () => {
    expect(sessionPerimee(T0 - PEREMPTION_CUISINE_MS - 1, T0)).toBe(true)
  })

  it('le seuil lui-même est déjà périmé — la borne est fermée', () => {
    expect(sessionPerimee(T0 - PEREMPTION_CUISINE_MS, T0)).toBe(true)
  })
})

describe('cuisine-session — mise en forme', () => {
  it.each([
    [0, '0:00'],
    [9, '0:09'],
    [60, '1:00'],
    [125, '2:05'],
    [3600, '60:00'],
  ])('formate %i secondes en « %s »', (secondes, attendu) => {
    expect(formaterDuree(secondes)).toBe(attendu)
  })

  it('ne rend jamais de durée négative', () => {
    expect(formaterDuree(-5)).toBe('0:00')
  })
})
