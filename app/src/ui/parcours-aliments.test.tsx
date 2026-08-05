// @vitest-environment jsdom
//
// ui/parcours-aliments.test.tsx — parcourir tout le catalogue sans rien taper (décision 58).
//
// ⚠️ CES TESTS TOURNENT SUR LE VRAI CATALOGUE, pas sur un fixture, et c'est le point entier. La
// propriété qui manquait n'était pas « le composant sait afficher une liste » — c'était
// « TOUS les aliments sont atteignables ». Mesuré avant ce lot : 352 des 450 étaient injoignables
// sans deviner le mot exact, parce que le seul parcours existant (« Ajout rapide », frigo.tsx)
// écarte les aliments qu'aucune recette n'utilise puis coupe à huit par famille. Un fixture de
// trois aliments aurait rendu ce test vert sans rien prouver.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { Food } from '../engine/domain/index.js'
import { catalogueDeTest } from './test-socle.js'
import { ParcoursAliments } from './parcours-aliments.js'

afterEach(cleanup)

const foods = () => catalogueDeTest().foods

function monter(surChoix: (aliment: Food) => void = () => undefined, deja: readonly string[] = []) {
  render(<ParcoursAliments foods={foods()} deja={deja} onChoisir={surChoix} onFermer={() => undefined} />)
  return screen.getByRole('dialog')
}

/** Les onglets de famille — les seuls boutons du panneau qui portent `aria-pressed`. */
const onglets = () => screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'))

/** Les noms d'aliments actuellement listés. */
const alimentsAffiches = (dialogue: HTMLElement) =>
  within(dialogue)
    .queryAllByRole('listitem')
    .map((li) => li.textContent ?? '')

describe('ParcoursAliments — exhaustivité, la propriété qui manquait', () => {
  it('⛔ LES 450 ALIMENTS SONT ATTEIGNABLES sans taper un seul caractère', () => {
    const dialogue = monter()
    const vus = new Set<string>()
    // On ouvre chaque famille et on ramasse ce qu'elle montre. `onglets()` est relu à chaque tour :
    // React remonte les boutons entre deux rendus, garder les références d'origine les détacherait.
    for (let i = 0; i < onglets().length; i++) {
      fireEvent.click(onglets()[i]!)
      for (const nom of alimentsAffiches(dialogue)) vus.add(nom)
    }

    const attendus = new Set([...foods().values()].map((f) => f.nom))
    // La comparaison porte sur l'ENSEMBLE, pas sur un compte : deux aliments homonymes feraient
    // passer un test de cardinalité tout en laissant un trou.
    expect([...attendus].filter((nom) => !vus.has(nom))).toEqual([])
    expect(vus.size).toBe(attendus.size)
  })

  it('rend joignables les aliments qu’AUCUNE recette n’utilise — ceux que l’Ajout rapide écarte', () => {
    // Les trois cas nommés dans la décision 58 : entrés au catalogue le 2026-08-05, dans zéro
    // recette, donc invisibles partout ailleurs. `saucisse_toulouse` est le plus parlant — on
    // venait de lui donner le synonyme « chipolata » pour pouvoir le TAPER, sans pouvoir le TROUVER.
    const dialogue = monter()
    const vus = new Set<string>()
    for (let i = 0; i < onglets().length; i++) {
      fireEvent.click(onglets()[i]!)
      for (const nom of alimentsAffiches(dialogue)) vus.add(nom)
    }
    for (const id of ['coppa', 'harissa', 'saucisse_toulouse']) {
      const aliment = [...foods().values()].find((f) => (f.id as string) === id)
      expect(aliment, `${id} absent du catalogue`).toBeDefined()
      expect(vus.has(aliment!.nom), `${id} injoignable en parcours`).toBe(true)
    }
  })

  it('chaque aliment n’apparaît que dans UNE famille — la somme des onglets fait le catalogue', () => {
    monter()
    const total = onglets().reduce((n, onglet) => {
      const compte = Number(onglet.textContent?.match(/(\d+)$/)?.[1] ?? '0')
      return n + compte
    }, 0)
    expect(total).toBe(foods().size)
  })
})

describe('ParcoursAliments — parcourir, pas chercher', () => {
  it('trie par NOM à l’intérieur d’une famille, accents compris', () => {
    const dialogue = monter()
    const noms = alimentsAffiches(dialogue)
    expect(noms.length).toBeGreaterThan(1)
    expect([...noms].sort((a, b) => a.localeCompare(b, 'fr'))).toEqual(noms)
  })

  it('change de famille sans rien saisir', () => {
    const dialogue = monter()
    const premiere = alimentsAffiches(dialogue)
    fireEvent.click(onglets()[1]!)
    expect(alimentsAffiches(dialogue)).not.toEqual(premiere)
  })

  it('rend l’ALIMENT entier, pas son identifiant — `courses.tsx` en déduit le rayon', () => {
    const surChoix = vi.fn()
    const dialogue = monter(surChoix)
    const premier = within(dialogue).getAllByRole('listitem')[0]!
    fireEvent.click(within(premier).getByRole('button'))
    expect(surChoix).toHaveBeenCalledTimes(1)
    const recu = surChoix.mock.calls[0]![0] as Food
    expect(recu.nom).toBe(premier.textContent)
    expect(recu.allergenes).toBeDefined()
  })

  it('retire ce que l’appelant a déjà retenu', () => {
    const dialogue = monter()
    const premier = alimentsAffiches(dialogue)[0]!
    const aliment = [...foods().values()].find((f) => f.nom === premier)!
    cleanup()
    const suivant = monter(() => undefined, [aliment.id as string])
    expect(alimentsAffiches(suivant)).not.toContain(premier)
  })
})

describe('ParcoursAliments — la règle de sécurité', () => {
  it('DIT que l’aliment manque, et ne propose JAMAIS d’en prendre un proche', () => {
    // ⚠️ C'est la piste (b) de la décision 58, celle qui traverse le garde-fou §5.2 : quelqu'un qui
    // coche un cousin se voit appliquer LES ALLERGÈNES DU COUSIN, et `user_pantry.food_id` ne garde
    // aucune trace de l'à-peu-près. Le texte doit rester dissuasif, pas informatif.
    const dialogue = monter()
    const note = within(dialogue).getByText(/n'y est pas/i)
    expect(note.textContent).toMatch(/allergènes/i)
    expect(within(dialogue).queryByText(/plus proche|aliment voisin à sa place\?/i)).toBeNull()
  })
})
