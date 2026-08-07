// ui/cuisine-session.test.ts — le point 7 de §5bis, vérifié sans navigateur.
//
// Ces tests portent sur la SEULE règle du mode cuisine dont l'erreur concernerait la nourriture.
// Aucun DOM, aucun faux timer : le module reçoit `maintenant` en paramètre, on lui donne l'instant
// qu'on veut.

import { describe, expect, it } from 'vitest'
import type { StoredCuisineSession, StoredCuisineTimer } from '../data/user-store.js'
import { ARRET_AUTO_MS } from './alarme.js'
import {
  PEREMPTION_CUISINE_MS,
  etatMinuteur,
  formaterDuree,
  libelleMinuteur,
  sessionPerimee,
  sonnerieEncoreJuste,
} from './cuisine-session.js'

const T0 = 1_770_000_000_000 // un instant fixe, sans signification particulière

function enMarche(finMs: number): StoredCuisineTimer {
  return { ordre: 1, finMs, pauseRestantS: null }
}

function session(ouverteLe: number, minuteurs: readonly StoredCuisineTimer[] = []): StoredCuisineSession {
  return { recetteId: 'coq_au_vin', ordreCourant: 1, ouverteLe, portions: null, minuteurs }
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
    expect(sessionPerimee(session(T0 - 2 * 60 * 60 * 1000), T0)).toBe(false)
  })

  it('une cuisson sans minuteur, d’avant le seuil, ne se propose plus', () => {
    expect(sessionPerimee(session(T0 - PEREMPTION_CUISINE_MS - 1), T0)).toBe(true)
  })

  it('le seuil lui-même est déjà périmé — la borne est fermée', () => {
    expect(sessionPerimee(session(T0 - PEREMPTION_CUISINE_MS), T0)).toBe(true)
  })

  // ⛔ LE CAS QUI A FAIT CHANGER LE POINT DE RÉFÉRENCE, ET IL EST DANS LE CATALOGUE, PAS EN THÉORIE.
  // `coq-au-vin` fait mariner 43 200 s — exactement le seuil. Mesurée depuis `ouverteLe`, la session
  // mourait À LA SECONDE OÙ LA MARINADE ABOUTISSAIT : l'appli larguait la cuisson précisément sur ce
  // qu'on attendait d'elle, et le bandeau « un minuteur est arrivé à terme » était structurellement
  // inatteignable pour cette recette.
  it('⛔ un minuteur qui n’a pas fini ne laisse JAMAIS périmer sa session', () => {
    const veille = session(T0, [{ ordre: 1, finMs: T0 + PEREMPTION_CUISINE_MS, pauseRestantS: null }])

    // ⚠️ C'EST CET INSTANT-LÀ QUI SÉPARE LES DEUX RÈGLES, et le choisir une seconde plus tôt aurait
    // rendu ce test vert avec l'ancienne — le genre de test qui ne prouve rien. Douze heures pile
    // après l'ouverture : l'ancienne règle déclarait la session périmée AU MOMENT PRÉCIS où la
    // marinade aboutissait.
    expect(sessionPerimee(veille, T0 + PEREMPTION_CUISINE_MS)).toBe(false)
    // Une heure plus tard, marinade finie depuis 1 h : encore largement proposée.
    expect(sessionPerimee(veille, T0 + PEREMPTION_CUISINE_MS + 60 * 60 * 1000)).toBe(false)
  })

  it('le compte part de la FIN du dernier minuteur, pas de l’ouverture', () => {
    const veille = session(T0, [{ ordre: 1, finMs: T0 + 12 * 60 * 60 * 1000, pauseRestantS: null }])

    // 23 h après l'ouverture — mais 11 h après la fin de la marinade : encore proposée.
    expect(sessionPerimee(veille, T0 + 23 * 60 * 60 * 1000)).toBe(false)
    // 25 h après l'ouverture, soit 13 h après la fin : cette fois la cuisson est oubliée.
    expect(sessionPerimee(veille, T0 + 25 * 60 * 60 * 1000)).toBe(true)
  })

  // ⚠️ Sans cette règle, une cuisson mise en pause et oubliée resterait proposée pour toujours. Une
  // pause ne porte aucune échéance — elle n'a donc rien à repousser.
  it('une pause ne prolonge RIEN — elle n’a pas d’échéance à repousser', () => {
    const oubliee = session(T0 - PEREMPTION_CUISINE_MS, [
      { ordre: 1, finMs: null, pauseRestantS: 300 },
    ])

    expect(sessionPerimee(oubliee, T0)).toBe(true)
  })
})

describe('cuisine-session — une sonnerie qui aurait encore lieu', () => {
  it('un minuteur qui vient d’aboutir sonne', () => {
    expect(sonnerieEncoreJuste(0)).toBe(true)
    expect(sonnerieEncoreJuste(30)).toBe(true)
  })

  // ⛔ LE CAS QUI A MOTIVÉ LA RÈGLE. Téléphone en poche quarante minutes, l'écran jamais démonté :
  // au retour, le battement de seconde reprend et le minuteur devient `termine` sans être passé par
  // aucun montage. Sans seuil, ça sonnait — pour un plat sorti du feu depuis quarante minutes.
  it('⛔ un minuteur échu depuis quarante minutes ne sonne PLUS', () => {
    expect(sonnerieEncoreJuste(40 * 60)).toBe(false)
  })

  // ⚠️ LA BORNE N'EST PAS UN NOMBRE CHOISI, c'est l'arrêt automatique de l'alarme — au symbole près,
  // pas à la valeur près. La règle se lit « l'alarme serait-elle encore en train de sonner ? ».
  it('la borne est exactement `ARRET_AUTO_MS`', () => {
    expect(sonnerieEncoreJuste(ARRET_AUTO_MS / 1000 - 1)).toBe(true)
    expect(sonnerieEncoreJuste(ARRET_AUTO_MS / 1000)).toBe(false)
  })
})

describe('cuisine-session — mise en forme', () => {
  it.each([
    [0, '0:00'],
    [9, '0:09'],
    [60, '1:00'],
    [125, '2:05'],
    [3599, '59:59'],
  ])('sous l’heure, formate %i secondes en « %s »', (secondes, attendu) => {
    expect(formaterDuree(secondes)).toBe(attendu)
  })

  // ⛔ CE TEST MANQUAIT, ET SON ABSENCE A ENTÉRINÉ UN FORMAT JAMAIS CONFRONTÉ À SES DONNÉES. Une
  // version antérieure attendait `[3600, '60:00']` et passait — alors que 22 recettes du catalogue
  // portent un minuteur de plus d'une heure. Sur `coq-au-vin` (43 200 s), le bouton annonçait
  // « Lancer le minuteur (720:00) » et le décompte affichait « 719:59 » en 2,2 rem.
  //
  // ⚠️ L'UNITÉ EST ÉCRITE, PAS DÉDUITE. Une chaîne à deux-points se lit toujours comme des minutes
  // quand on y jette un œil — c'est tout le cas d'usage de cet écran. « 12:00:00 » n'aurait réglé
  // qu'à moitié : il ne diffère de « 12:00 » que par un suffixe qu'on rate de loin.
  it.each([
    [3600, '1 h 00'],
    [3660, '1 h 01'],
    [7500, '2 h 05'],
    [21600, '6 h 00'],
    [43200, '12 h 00'], // `coq-au-vin` : « faire mariner … la veille de préférence »
  ])('à partir de l’heure, formate %i secondes en « %s »', (secondes, attendu) => {
    expect(formaterDuree(secondes)).toBe(attendu)
  })

  it('les trois phrases d’un minuteur suivent le même format', () => {
    expect(libelleMinuteur({ mode: 'marche', restantS: 43_200 })).toBe('il reste 12 h 00')
    expect(libelleMinuteur({ mode: 'pause', restantS: 4_500 })).toBe('en pause à 1 h 15')
    expect(libelleMinuteur({ mode: 'termine', depuisS: 11_400 })).toBe('terminé il y a 3 h 10')
  })

  it('ne rend jamais de durée négative', () => {
    expect(formaterDuree(-5)).toBe('0:00')
  })
})
