// ui/router.test.ts — correspondance fragment → route.
//
// Seule partie du routeur testable sans DOM : `useRoute` passe par `useSyncExternalStore` et
// `window.location`, qui demanderaient `jsdom` — une dépendance de plus pour couvrir trois lignes
// de plomberie React. La logique qui peut réellement se tromper est ici.

import { describe, expect, it } from 'vitest'
import {
  hashDe,
  hashDeLAliment,
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
      sousVue: { type: 'cuisine', id: 'chakchouka', portions: null },
    })
  })

  it('survit à un identifiant qui a besoin d’être encodé', () => {
    const id = 'recette perso/2026'
    expect(routeDepuisHash(hashDeLaCuisine(id))).toEqual({
      onglet: 'recettes',
      sousVue: { type: 'cuisine', id, portions: null },
    })
  })

  // --- Les portions au lancement (v11) ---------------------------------------------------------
  //
  // ⚠️ `null` N'EST PAS « 4 ». Il veut dire « aucun choix exprimé », et c'est l'écran de cuisine —
  // seul à connaître `portionsBase` — qui décide alors. Ces tests verrouillent la distinction : un
  // repli silencieux vers un nombre écrirait dans la session persistée un choix que personne n'a
  // fait.
  it('porte les portions réglées sur la fiche', () => {
    expect(routeDepuisHash(hashDeLaCuisine('chakchouka', 6))).toEqual({
      onglet: 'recettes',
      sousVue: { type: 'cuisine', id: 'chakchouka', portions: 6 },
    })
  })

  it('un hash NU ne demande aucune portion — c’est le lien de reprise', () => {
    expect(hashDeLaCuisine('chakchouka')).not.toContain('portions')
    expect(routeDepuisHash('#/cuisine/chakchouka').sousVue).toEqual({
      type: 'cuisine',
      id: 'chakchouka',
      portions: null,
    })
  })

  // ⛔ `portions=0` ferait disparaître la recette de sa propre mise à l'échelle, et une valeur
  // fractionnaire passerait ensuite dans `scaleRecipe` sans que rien ne l'arrête. Tout ce qui n'est
  // pas un entier ≥ 1 retombe sur « aucun choix exprimé », jamais sur un plantage.
  it('⛔ refuse zéro, le négatif, le fractionnaire et le non-numérique', () => {
    for (const brut of ['0', '-2', '2.5', 'beaucoup', '']) {
      const route = routeDepuisHash(`#/cuisine/chakchouka?portions=${brut}`)
      expect(route.sousVue).toEqual({ type: 'cuisine', id: 'chakchouka', portions: null })
    }
  })

  // Un identifiant peut légitimement contenir un `?` encodé : le découpage se fait sur le fragment
  // BRUT, avant décodage — même précaution que `?de=` sur la fiche recette.
  it('un identifiant contenant un « ? » encodé survit au découpage de la requête', () => {
    const id = 'quoi? du riz'
    expect(routeDepuisHash(hashDeLaCuisine(id, 3)).sousVue).toEqual({
      type: 'cuisine',
      id,
      portions: 3,
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

describe('ui/router — fiche aliment', () => {
  it('porte l’identifiant de l’aliment', () => {
    expect(routeDepuisHash(hashDeLAliment('carotte'))).toEqual({
      onglet: 'recettes',
      sousVue: { type: 'aliment', id: 'carotte', retour: '' },
    })
  })

  it('survit à un identifiant qui a besoin d’être encodé', () => {
    const hash = hashDeLAliment('crème/fraîche 30 %')
    expect(hash).not.toContain(' ')
    expect(routeDepuisHash(hash).sousVue).toEqual({
      type: 'aliment',
      id: 'crème/fraîche 30 %',
      retour: '',
    })
  })

  it('rattache la fiche à l’onglet Recettes, même arrivée depuis les Courses', () => {
    // Même règle que la fiche recette et le frigo : la barre désigne une SECTION stable, pas le
    // chemin parcouru. Une barre qui change d'onglet actif selon la provenance bouge sous les doigts.
    expect(routeDepuisHash(hashDeLAliment('carotte', hashDe('courses'))).onglet).toBe('recettes')
  })

  it('ramène à la liste sur un fragment malformé, jamais un écran blanc', () => {
    expect(routeDepuisHash('#/aliment/%E0%A4%A').sousVue.type).toBe('liste')
    expect(routeDepuisHash('#/aliment/').sousVue.type).toBe('liste')
  })

  it('un identifiant contenant un « ? » encodé survit au découpage de la requête', () => {
    const hash = hashDeLAliment('a?b', hashDe('courses'))
    expect(routeDepuisHash(hash).sousVue).toEqual({
      type: 'aliment',
      id: 'a?b',
      retour: '#/courses',
    })
  })
})

describe('ui/router — retour depuis une fiche aliment', () => {
  // Le retour est un HASH et non un mot-clé : on arrive sur un aliment depuis une recette PRÉCISE,
  // ce qu'une énumération façon `OrigineRecette` ne sait pas exprimer.
  it('porte le hash complet d’une recette, identifiant compris', () => {
    const retour = hashDeRecette('poulet-basquaise', 'semaine')
    expect(routeDepuisHash(hashDeLAliment('poulet_blanc', retour)).sousVue).toEqual({
      type: 'aliment',
      id: 'poulet_blanc',
      retour,
    })
  })

  it('hash SANS retour → chaîne vide, jamais une provenance inventée', () => {
    expect(routeDepuisHash('#/aliment/carotte').sousVue).toEqual({
      type: 'aliment',
      id: 'carotte',
      retour: '',
    })
  })

  // ⛔ Ce hash finit dans un `href`. Sans le filtre `#/`, une valeur venue de l'URL produirait un
  // lien SORTANT depuis une page interne.
  it('⛔ jette tout retour qui n’est pas un fragment interne', () => {
    for (const de of [
      'https://exemple.invalide',
      '//exemple.invalide',
      'javascript:alert(1)',
      '/courses',
      '#courses',
      '',
    ]) {
      const route = routeDepuisHash(`#/aliment/carotte?de=${encodeURIComponent(de)}`)
      expect(route.sousVue).toEqual({ type: 'aliment', id: 'carotte', retour: '' })
    }
  })

  it('ne se confond ni avec la fiche recette ni avec le mode cuisine du même identifiant', () => {
    const types = ['x'].flatMap((id) => [
      routeDepuisHash(hashDeLAliment(id)).sousVue.type,
      routeDepuisHash(hashDeRecette(id)).sousVue.type,
      routeDepuisHash(hashDeLaCuisine(id)).sousVue.type,
    ])
    expect(new Set(types).size).toBe(3)
  })
})
