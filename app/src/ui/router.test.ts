// ui/router.test.ts — correspondance fragment → route.
//
// Seule partie du routeur testable sans DOM : `useRoute` passe par `useSyncExternalStore` et
// `window.location`, qui demanderaient `jsdom` — une dépendance de plus pour couvrir trois lignes
// de plomberie React. La logique qui peut réellement se tromper est ici.

import { describe, expect, it } from 'vitest'
import { hashDe, routeDepuisHash, type Route } from './router.js'

const TOUTES: readonly Route[] = ['aujourdhui', 'semaine', 'courses', 'recettes', 'savoir']

describe('ui/router — routeDepuisHash', () => {
  it('reconnaît les cinq routes de la barre de navigation', () => {
    // Les cinq onglets existent DÈS MAINTENANT, même sans écran derrière : le bloc commun des
    // maquettes impose une barre identique sur tous les écrans, et une navigation qui grandit de
    // version en version change de forme sous les doigts de l'utilisateur.
    expect(routeDepuisHash('#/')).toBe('aujourdhui')
    expect(routeDepuisHash('#/semaine')).toBe('semaine')
    expect(routeDepuisHash('#/courses')).toBe('courses')
    expect(routeDepuisHash('#/recettes')).toBe('recettes')
    expect(routeDepuisHash('#/savoir')).toBe('savoir')
  })

  it('traite le fragment absent comme la racine — première visite, ou lien sans #', () => {
    expect(routeDepuisHash('')).toBe('aujourdhui')
    expect(routeDepuisHash('#')).toBe('aujourdhui')
  })

  it('retombe sur Aujourd’hui pour un fragment inconnu, jamais sur un écran blanc', () => {
    // Un signet vers une route supprimée, ou une faute de frappe, doit rester utilisable.
    expect(routeDepuisHash('#/vider-le-frigo')).toBe('aujourdhui')
    expect(routeDepuisHash('#nawak')).toBe('aujourdhui')
    expect(routeDepuisHash('#/Semaine')).toBe('aujourdhui') // la casse compte
  })

  it('fait l’aller-retour route → fragment → route, pour les cinq', () => {
    for (const route of TOUTES) {
      expect(routeDepuisHash(hashDe(route))).toBe(route)
    }
  })

  it('donne un fragment DISTINCT à chaque route', () => {
    // Deux routes partageant un fragment rendraient l'une d'elles inatteignable, sans erreur.
    const fragments = TOUTES.map(hashDe)
    expect(new Set(fragments).size).toBe(TOUTES.length)
  })
})
