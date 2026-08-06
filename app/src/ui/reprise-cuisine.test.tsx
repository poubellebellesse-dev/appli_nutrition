// @vitest-environment jsdom
//
// ui/reprise-cuisine.test.tsx — le bandeau qui remplace la notification d'arrière-plan.
//
// La règle est pure (`resumeDeSession`) et testée comme telle : c'est elle qui décide si le bandeau
// existe, et elle n'a besoin d'aucun DOM pour être vraie.

import { describe, expect, it } from 'vitest'
import type { StoredCuisineSession } from '../data/user-store.js'
import { PEREMPTION_CUISINE_MS } from './cuisine-session.js'
import { anciennete, resumeDeSession } from './reprise-cuisine.js'

const T0 = 1_770_000_000_000

function session(partiel: Partial<StoredCuisineSession> = {}): StoredCuisineSession {
  return {
    recetteId: 'chakchouka',
    ordreCourant: 2,
    ouverteLe: T0,
    portions: null,
    minuteurs: [],
    ...partiel,
  }
}

describe('reprise-cuisine — quand le bandeau existe', () => {
  it('pas de cuisson, pas de bandeau', () => {
    expect(resumeDeSession(null, T0)).toBeNull()
  })

  it('une cuisson d’il y a vingt minutes se reprend', () => {
    const resume = resumeDeSession(session(), T0 + 20 * 60 * 1000)
    expect(resume?.recetteId).toBe('chakchouka')
    expect(resume?.depuis).toBe('il y a 20 min')
  })

  // ⛔ Une cuisson oubliée hier ne doit pas ressortir : proposer de « reprendre » un plat vieux de
  // quatorze heures serait au mieux absurde, au pire une invitation à manger quelque chose qui a
  // passé la nuit dehors.
  it('⛔ une session périmée ne réapparaît pas', () => {
    expect(resumeDeSession(session(), T0 + PEREMPTION_CUISINE_MS)).toBeNull()
  })

  it('compte les minuteurs arrivés à terme, sans dire depuis quand', () => {
    const resume = resumeDeSession(
      session({
        minuteurs: [
          { ordre: 2, finMs: T0 + 60_000, pauseRestantS: null },
          { ordre: 3, finMs: T0 + 60_000, pauseRestantS: null },
          { ordre: 5, finMs: T0 + 10 * 60_000, pauseRestantS: null },
        ],
      }),
      T0 + 5 * 60_000
    )

    expect(resume?.minuteursEchus).toBe(2)
  })

  it('un minuteur en pause n’est jamais compté comme échu', () => {
    const resume = resumeDeSession(
      session({ minuteurs: [{ ordre: 2, finMs: null, pauseRestantS: 30 }] }),
      T0 + 6 * 60 * 60 * 1000
    )
    expect(resume?.minuteursEchus).toBe(0)
  })
})

describe('reprise-cuisine — l’ancienneté', () => {
  it('reste muette sous deux minutes — « il y a 0 min » n’apprend rien', () => {
    expect(anciennete(T0, T0 + 30_000)).toBeNull()
  })

  it.each([
    [12 * 60_000, 'il y a 12 min'],
    [59 * 60_000, 'il y a 59 min'],
    [60 * 60_000, 'il y a 1 h'],
    [3 * 60 * 60_000 + 40 * 60_000, 'il y a 3 h'],
  ])('après %i ms, annonce « %s »', (ecoule, attendu) => {
    expect(anciennete(T0, T0 + ecoule)).toBe(attendu)
  })
})
