// ui/router.test.ts — correspondance fragment → route.
//
// Seule partie du routeur testable sans DOM : `useRoute` passe par `useSyncExternalStore` et
// `window.location`, qui demanderaient `jsdom` — une dépendance de plus pour couvrir trois lignes
// de plomberie React. La logique qui peut réellement se tromper est ici.

import { describe, expect, it } from 'vitest'
import { hashDe, routeDepuisHash } from './router.js'

describe('ui/router — routeDepuisHash', () => {
  it('reconnaît les routes déclarées', () => {
    expect(routeDepuisHash('#/')).toBe('aujourdhui')
    expect(routeDepuisHash('#/semaine')).toBe('semaine')
  })

  it('traite le fragment absent comme la racine — première visite, ou lien sans #', () => {
    expect(routeDepuisHash('')).toBe('aujourdhui')
    expect(routeDepuisHash('#')).toBe('aujourdhui')
  })

  it('retombe sur Aujourd’hui pour un fragment inconnu, jamais sur un écran blanc', () => {
    // Un signet vers une route supprimée, ou une faute de frappe, doit rester utilisable.
    expect(routeDepuisHash('#/courses')).toBe('aujourdhui')
    expect(routeDepuisHash('#nawak')).toBe('aujourdhui')
  })

  it('fait l’aller-retour route → fragment → route', () => {
    for (const route of ['aujourdhui', 'semaine'] as const) {
      expect(routeDepuisHash(hashDe(route))).toBe(route)
    }
  })
})
