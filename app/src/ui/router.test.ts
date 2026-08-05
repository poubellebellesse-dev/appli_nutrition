// ui/router.test.ts — correspondance fragment → route.
//
// Seule partie du routeur testable sans DOM : `useRoute` passe par `useSyncExternalStore` et
// `window.location`, qui demanderaient `jsdom` — une dépendance de plus pour couvrir trois lignes
// de plomberie React. La logique qui peut réellement se tromper est ici.

import { describe, expect, it } from 'vitest'
import {
  hashDe,
  hashDeLaCuisine,
  hashDeRecette,
  hashDesParametres,
  hashDuFrigo,
  routeDepuisHash,
  type Onglet,
} from './router.js'

const TOUS: readonly Onglet[] = ['aujourdhui', 'semaine', 'courses', 'recettes', 'savoir']

describe('ui/router — onglets', () => {
  it('reconnaît les cinq onglets de la barre de navigation', () => {
    // Les cinq existent DÈS MAINTENANT, même sans écran derrière : le bloc commun des maquettes
    // impose une barre identique partout, et une navigation qui grandit de version en version
    // change de forme sous les doigts de l'utilisateur.
    for (const onglet of TOUS) {
      expect(routeDepuisHash(hashDe(onglet))).toEqual({ onglet, sousVue: { type: 'liste' } })
    }
  })

  it('traite le fragment absent comme la racine — première visite, ou lien sans #', () => {
    expect(routeDepuisHash('')).toEqual({ onglet: 'aujourdhui', sousVue: { type: 'liste' } })
    expect(routeDepuisHash('#')).toEqual({ onglet: 'aujourdhui', sousVue: { type: 'liste' } })
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
      sousVue: { type: 'recette', id: 'blanquette-veau', origine: 'recettes' },
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
    expect(routeDepuisHash(hash).sousVue).toEqual({ type: 'recette', id, origine: 'recettes' })
  })

  it('ramène à la LISTE plutôt que de planter sur un fragment malformé', () => {
    // Un `%` isolé fait lever `decodeURIComponent`. Un signet tronqué en produit facilement, et une
    // URL illisible ne doit jamais casser l'application.
    expect(routeDepuisHash('#/recette/%E0%A4%A').sousVue).toEqual({ type: 'liste' })
    expect(routeDepuisHash('#/recette/').sousVue).toEqual({ type: 'liste' })
  })

  it('ne confond pas la liste et une fiche', () => {
    expect(routeDepuisHash('#/recettes').sousVue).toEqual({ type: 'liste' })
    expect(routeDepuisHash('#/recette/x').sousVue).toEqual({ type: 'recette', id: 'x', origine: 'recettes' })
  })
})

describe('ui/router — retour contextuel depuis la fiche recette', () => {
  it('encode l’origine dans le hash — survit à un rechargement (pas un état React)', () => {
    for (const origine of ['aujourdhui', 'recettes', 'semaine', 'frigo'] as const) {
      const hash = hashDeRecette('x', origine)
      expect(routeDepuisHash(hash).sousVue).toEqual({ type: 'recette', id: 'x', origine })
    }
  })

  it('hash SANS origine → repli sûr sur Recettes (lien collé, favori, rechargement d’un ancien hash)', () => {
    expect(routeDepuisHash(hashDeRecette('x')).sousVue).toEqual({
      type: 'recette',
      id: 'x',
      origine: 'recettes',
    })
    expect(routeDepuisHash('#/recette/x?de=un-onglet-qui-nexiste-pas').sousVue).toEqual({
      type: 'recette',
      id: 'x',
      origine: 'recettes',
    })
  })
})

describe('ui/router — vider le frigo', () => {
  it('n’est PAS un sixième onglet — il vit dans la section Recettes', () => {
    // §4.5 le veut accessible depuis Aujourd'hui et Recettes ; §2 fixe cinq onglets stables
    // v1 -> v2. Une barre qui en gagnerait un sixième changerait de forme sous les doigts.
    expect(routeDepuisHash(hashDuFrigo())).toEqual({
      onglet: 'recettes',
      sousVue: { type: 'frigo' },
    })
  })

  it('ne se confond ni avec la liste ni avec une fiche', () => {
    const fragments = [hashDe('recettes'), hashDeRecette('x'), hashDuFrigo()]
    expect(new Set(fragments).size).toBe(3)
    expect(new Set(fragments.map((f) => routeDepuisHash(f).sousVue.type)).size).toBe(3)
  })
})

describe('ui/router — mode cuisine', () => {
  it('porte l’identifiant de la recette qu’on cuisine', () => {
    expect(routeDepuisHash(hashDeLaCuisine('chakchouka'))).toEqual({
      onglet: 'recettes',
      sousVue: { type: 'cuisine', id: 'chakchouka' },
    })
  })

  it('survit à un identifiant qui a besoin d’être encodé', () => {
    const id = 'recette perso/2026'
    expect(routeDepuisHash(hashDeLaCuisine(id))).toEqual({
      onglet: 'recettes',
      sousVue: { type: 'cuisine', id },
    })
  })

  // Même précaution que les deux autres routes paramétrées : un signet tronqué produit facilement
  // un `%` isolé, sur lequel `decodeURIComponent` lève. Un fragment illisible ramène à la liste.
  it('un fragment illisible ramène à la liste, jamais un écran blanc', () => {
    expect(routeDepuisHash('#/cuisine/%')).toEqual({ onglet: 'recettes', sousVue: { type: 'liste' } })
    expect(routeDepuisHash('#/cuisine/')).toEqual({ onglet: 'recettes', sousVue: { type: 'liste' } })
  })

  it('ne se confond pas avec la fiche de la MÊME recette', () => {
    expect(hashDeLaCuisine('x')).not.toBe(hashDeRecette('x'))
    expect(routeDepuisHash(hashDeRecette('x')).sousVue.type).toBe('recette')
  })
})

describe('ui/router — paramètres', () => {
  it('n’est pas un sixième onglet non plus', () => {
    // Même contrainte que le frigo : cinq onglets stables (§2 DESIGN). On y accède par l'engrenage
    // de l'en-tête, pas par la barre.
    expect(routeDepuisHash(hashDesParametres())).toEqual({
      onglet: 'aujourdhui',
      sousVue: { type: 'parametres' },
    })
  })

  it('garde un onglet courant — la barre ne doit pas changer d’aspect sur cet écran', () => {
    // Sans onglet désigné, la barre n'aurait plus d'élément actif sur Paramètres : elle changerait
    // de forme d'un écran à l'autre, ce que « navigation permanente et visible » interdit.
    expect(TOUS).toContain(routeDepuisHash(hashDesParametres()).onglet)
  })

  it('a un fragment distinct de toutes les autres destinations', () => {
    const fragments = [...TOUS.map(hashDe), hashDuFrigo(), hashDeRecette('x'), hashDesParametres()]
    expect(new Set(fragments).size).toBe(fragments.length)
  })
})
