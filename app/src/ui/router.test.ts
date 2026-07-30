// ui/router.test.ts — correspondance fragment → route.
//
// Seule partie du routeur testable sans DOM : `useRoute` passe par `useSyncExternalStore` et
// `window.location`, qui demanderaient `jsdom` — une dépendance de plus pour couvrir trois lignes
// de plomberie React. La logique qui peut réellement se tromper est ici.

import { describe, expect, it } from 'vitest'
import { hashDe, hashDeRecette, routeDepuisHash, type Onglet } from './router.js'

const TOUS: readonly Onglet[] = ['aujourdhui', 'semaine', 'courses', 'recettes', 'savoir']

describe('ui/router — onglets', () => {
  it('reconnaît les cinq onglets de la barre de navigation', () => {
    // Les cinq existent DÈS MAINTENANT, même sans écran derrière : le bloc commun des maquettes
    // impose une barre identique partout, et une navigation qui grandit de version en version
    // change de forme sous les doigts de l'utilisateur.
    for (const onglet of TOUS) {
      expect(routeDepuisHash(hashDe(onglet))).toEqual({ onglet, recetteId: null })
    }
  })

  it('traite le fragment absent comme la racine — première visite, ou lien sans #', () => {
    expect(routeDepuisHash('')).toEqual({ onglet: 'aujourdhui', recetteId: null })
    expect(routeDepuisHash('#')).toEqual({ onglet: 'aujourdhui', recetteId: null })
  })

  it('retombe sur Aujourd’hui pour un fragment inconnu, jamais sur un écran blanc', () => {
    expect(routeDepuisHash('#/vider-le-frigo').onglet).toBe('aujourdhui')
    expect(routeDepuisHash('#nawak').onglet).toBe('aujourdhui')
    expect(routeDepuisHash('#/Semaine').onglet).toBe('aujourdhui') // la casse compte
  })

  it('donne un fragment DISTINCT à chaque onglet', () => {
    // Deux onglets partageant un fragment rendraient l'un d'eux inatteignable, sans erreur.
    expect(new Set(TOUS.map(hashDe)).size).toBe(TOUS.length)
  })
})

describe('ui/router — fiche recette', () => {
  it('fait l’aller-retour sur un identifiant simple', () => {
    expect(routeDepuisHash(hashDeRecette('blanquette-veau'))).toEqual({
      onglet: 'recettes',
      recetteId: 'blanquette-veau',
    })
  })

  it('rattache la fiche à l’onglet Recettes — la barre désigne une SECTION, pas un chemin', () => {
    // On arrive aussi sur une fiche depuis la semaine ou les courses ; l'onglet actif ne doit pas
    // dépendre de par où l'on est passé.
    expect(routeDepuisHash('#/recette/tarte-pommes').onglet).toBe('recettes')
  })

  it('encode et décode un identifiant contenant des caractères réservés', () => {
    const id = 'plat/étrange & co'
    const hash = hashDeRecette(id)
    expect(hash).not.toContain(' ')
    expect(routeDepuisHash(hash).recetteId).toBe(id)
  })

  it('ramène à la LISTE plutôt que de planter sur un fragment malformé', () => {
    // Un `%` isolé fait lever `decodeURIComponent`. Un signet tronqué en produit facilement, et une
    // URL illisible ne doit jamais casser l'application.
    expect(routeDepuisHash('#/recette/%E0%A4%A')).toEqual({ onglet: 'recettes', recetteId: null })
    expect(routeDepuisHash('#/recette/')).toEqual({ onglet: 'recettes', recetteId: null })
  })

  it('ne confond pas la liste et une fiche', () => {
    expect(routeDepuisHash('#/recettes').recetteId).toBeNull()
    expect(routeDepuisHash('#/recette/x').recetteId).toBe('x')
  })
})
