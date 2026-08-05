// @vitest-environment jsdom
//
// ui/alarme.test.ts — ce qui est vérifiable de l'alarme SANS navigateur.
//
// ⚠️ CE QUI N'EST PAS TESTÉ ICI, ET NE PEUT PAS L'ÊTRE. `jsdom` n'implémente ni `AudioContext` ni la
// politique d'autoplay : un test vert sur « le son sort » ne prouverait rien du tout. Le
// déverrouillage audio est un point de vérification MANUELLE sur appareil
// (`CONCEPTION_MODE_CUISINE.md` §4.2 et §7) — il a été validé le 2026-08-05.
//
// Ce qui reste testable est la MÉCANIQUE : on s'arrête, on s'arrête seul, et l'absence d'audio ne
// casse rien.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ARRET_AUTO_MS, creerAlarme } from './alarme.js'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('alarme — s’arrêter', () => {
  it('sonne jusqu’à ce qu’on l’arrête', () => {
    const alarme = creerAlarme()
    alarme.sonner(() => undefined)

    vi.advanceTimersByTime(60_000)
    expect(alarme.enCours()).toBe(true)

    alarme.arreter()
    expect(alarme.enCours()).toBe(false)
  })

  it('rend la main sur l’appui, avec la raison « utilisateur »', () => {
    const alarme = creerAlarme()
    const raisons: string[] = []
    alarme.sonner((r) => raisons.push(r))

    alarme.arreter()
    expect(raisons).toEqual(['utilisateur'])
  })

  // ⛔ Une sonnerie qu'on ne peut pas faire taire est une nuisance — le téléphone peut très bien
  // être seul dans la cuisine pendant que son propriétaire est sorti.
  it('⛔ s’arrête SEULE au bout du délai, même sans personne pour appuyer', () => {
    const alarme = creerAlarme()
    const raisons: string[] = []
    alarme.sonner((r) => raisons.push(r))

    vi.advanceTimersByTime(ARRET_AUTO_MS - 1)
    expect(alarme.enCours()).toBe(true)

    vi.advanceTimersByTime(1)
    expect(alarme.enCours()).toBe(false)
    expect(raisons).toEqual(['delai'])
  })

  it('ne prévient qu’une fois — l’arrêt automatique ne double pas un arrêt manuel', () => {
    const alarme = creerAlarme()
    const raisons: string[] = []
    alarme.sonner((r) => raisons.push(r))

    alarme.arreter()
    vi.advanceTimersByTime(ARRET_AUTO_MS * 2)
    expect(raisons).toEqual(['utilisateur'])
  })

  it('arrêter une alarme qui ne sonne pas ne fait rien', () => {
    const alarme = creerAlarme()
    expect(() => alarme.arreter()).not.toThrow()
    expect(alarme.enCours()).toBe(false)
  })

  it('un second « sonner » pendant la sonnerie ne relance pas le compte à rebours', () => {
    const alarme = creerAlarme()
    const raisons: string[] = []
    alarme.sonner((r) => raisons.push(r))

    vi.advanceTimersByTime(ARRET_AUTO_MS / 2)
    alarme.sonner(() => raisons.push('second'))
    vi.advanceTimersByTime(ARRET_AUTO_MS / 2)

    expect(raisons).toEqual(['delai'])
  })
})

describe('alarme — dégradation', () => {
  // `preparer()` et `sonner()` tournent ici sans AudioContext ni `navigator.vibrate`. C'est
  // exactement l'environnement d'un navigateur qui refuse le son : la mécanique doit tenir seule,
  // sinon un refus audio emporterait aussi le signal visuel.
  it('sans audio ni vibration, rien ne lève et la mécanique tourne', () => {
    const alarme = creerAlarme()
    expect(() => alarme.preparer()).not.toThrow()
    expect(() => alarme.sonner(() => undefined)).not.toThrow()
    expect(alarme.enCours()).toBe(true)

    vi.advanceTimersByTime(ARRET_AUTO_MS)
    expect(alarme.enCours()).toBe(false)
  })

  it('preparer() est idempotente', () => {
    const alarme = creerAlarme()
    alarme.preparer()
    expect(() => alarme.preparer()).not.toThrow()
  })
})
