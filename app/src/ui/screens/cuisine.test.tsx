// @vitest-environment jsdom
//
// ui/screens/cuisine.test.tsx — le mode cuisine (§5bis ARCHITECTURE, tests listés en §4.2 de
// CONCEPTION_MODE_CUISINE.md).
//
// ⚠️ CES TESTS ENCODENT DES DÉCISIONS, PAS UN RENDU. Deux d'entre eux valent le détour :
//   - « les étapes n'avancent jamais seules » verrouille le point 2 contre une régression BIEN
//     INTENTIONNÉE. La demande d'origine était « que la recette se lance toute seule » ; elle a été
//     refusée après lecture des essais publiés. Quelqu'un la réimplémentera de bonne foi un jour.
//   - « une session reprise dit la vérité » est le seul test du mode qui porte sur une affirmation
//     de l'appli À PROPOS DE NOURRITURE. Sa règle est testée à part et sans DOM dans
//     `cuisine-session.test.ts` ; ici on vérifie qu'elle atteint bien l'écran.
//
// ⚠️ CE QUI N'EST PAS TESTABLE ICI : le déverrouillage audio (`jsdom` n'implémente pas la politique
// d'autoplay — un vert ne prouverait rien) et le Wake Lock réel. Points de vérification MANUELLE sur
// appareil, §7 du document de conception.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { writeCuisineSession } from '../../data/user-store.js'
import { baseCourante, catalogueDeTest, reinitialiserBase, sessionDeTest } from '../test-socle.js'

vi.mock('../catalog-source.js', () => ({
  chargerCatalogue: () => Promise.resolve(catalogueDeTest()),
  // ⚠️ COTES DE CONFIANCE VIDES, ET C'EST JUSTE ICI. Le mode cuisine n'affiche AUCUNE valeur
  // nutritionnelle, donc aucune provenance à coter — une table vide ne masque rien. C'est aussi ce
  // qui garde ce fichier indépendant du lot « confiance » mené par une autre piste : la clé est
  // fournie pour que `chargerSocle()` ne casse pas, sa valeur n'est lue par personne. À rebrancher
  // sur `confianceDeTest()` le jour où cet écran afficherait une valeur.
  chargerConfiance: () => Promise.resolve(new Map()),
}))
vi.mock('../user-source.js', () => ({
  ouvrirUserDb: () => Promise.resolve(sessionDeTest()),
  surErreurDePersistance: () => undefined,
}))

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const CHAKCHOUKA = 'chakchouka'

async function monter(recetteId = CHAKCHOUKA) {
  const { Cuisine } = await import('./cuisine.js')
  const rendu = render(<Cuisine recetteId={recetteId} />)
  await screen.findByRole('heading', { level: 1 })
  return rendu
}

describe('cuisine — le déroulé', () => {
  // ⛔ LE TEST QUI PROTÈGE LA DÉCISION. `advanceTimersByTime` fait passer dix minutes : le battement
  // de seconde tourne, les décomptes bougent, et l'étape ne doit pas avoir changé d'un pouce.
  it('⛔ les étapes n’avancent JAMAIS seules', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await monter()
    expect(screen.getByText(/Étape 1 sur 5/)).toBeTruthy()

    await act(async () => {
      vi.advanceTimersByTime(10 * 60 * 1000)
    })

    expect(screen.getByText(/Étape 1 sur 5/)).toBeTruthy()
    expect(screen.getByText(/Émincer l'oignon/)).toBeTruthy()
  })

  // Dépend de L0 : `chakchouka` porte SIX lignes dans `etapes`, dont la dernière est la mention
  // ANSES. Annoncer « 6 » promettrait un geste après que le plat est servi.
  it('⛔ le compteur ignore l’avertissement sanitaire — 5 étapes, pas 6', async () => {
    await monter()
    expect(screen.getByText(/Étape 1 sur 5/)).toBeTruthy()
  })

  it('l’avertissement s’affiche à la DERNIÈRE étape, et pas avant', async () => {
    await monter()
    const anses = /ne pas consommer d'œufs crus ou peu cuits/

    expect(screen.queryByText(anses)).toBeNull()
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByText('Étape suivante →'))

    expect(screen.getByText(/Étape 5 sur 5/)).toBeTruthy()
    expect(screen.getByText(anses)).toBeTruthy()
  })

  it('avancer et reculer changent l’étape, et « précédente » est inerte sur la première', async () => {
    await monter()
    expect(screen.getByText('← Étape précédente').hasAttribute('disabled')).toBe(true)

    fireEvent.click(screen.getByText('Étape suivante →'))
    expect(screen.getByText(/Étape 2 sur 5/)).toBeTruthy()

    fireEvent.click(screen.getByText('← Étape précédente'))
    expect(screen.getByText(/Étape 1 sur 5/)).toBeTruthy()
  })
})

describe('cuisine — les minuteurs', () => {
  it('n’en propose un que sur une étape qui en porte un', async () => {
    await monter()
    // Étape 1 : émincer, aucun minuteur au catalogue.
    expect(screen.queryByText(/Lancer le minuteur/)).toBeNull()

    fireEvent.click(screen.getByText('Étape suivante →'))
    expect(screen.getByText('Lancer le minuteur (12:00)')).toBeTruthy()
  })

  // ⛔ Un décompte qui disparaît quand on tourne la page est un décompte qu'on oublie — et il porte
  // le numéro de SON étape, sinon on ne sait plus ce qu'il compte.
  it('⛔ un minuteur SURVIT au changement d’étape, étiqueté par son étape', async () => {
    await monter()
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Lancer le minuteur (12:00)'))
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Étape suivante →'))

    expect(screen.getByText(/Étape 4 sur 5/)).toBeTruthy()
    const encours = screen.getByRole('heading', { name: 'Minuteurs en cours' }).parentElement
    expect(encours?.textContent).toContain('Étape 2')
    expect(encours?.textContent).toMatch(/il reste/)
  })

  it('⛔ plusieurs décomptes coexistent — une vraie cuisson en fait tourner deux', async () => {
    await monter()
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Lancer le minuteur (12:00)'))
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Lancer le minuteur (10:00)'))
    fireEvent.click(screen.getByText('Étape suivante →'))

    const encours = screen.getByRole('heading', { name: 'Minuteurs en cours' }).parentElement
    expect(encours?.textContent).toContain('Étape 2')
    expect(encours?.textContent).toContain('Étape 3')
  })

  it('la pause fige le reste, la reprise le relance', async () => {
    await monter()
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Lancer le minuteur (12:00)'))

    fireEvent.click(screen.getByText('Mettre en pause'))
    expect(screen.getByText(/en pause à/)).toBeTruthy()

    fireEvent.click(screen.getByText('Reprendre'))
    expect(screen.getByText(/il reste/)).toBeTruthy()
  })

  it('arrêter un minuteur le fait disparaître', async () => {
    await monter()
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Lancer le minuteur (12:00)'))
    fireEvent.click(screen.getByText('Arrêter'))

    expect(screen.getByText('Lancer le minuteur (12:00)')).toBeTruthy()
  })
})

describe('cuisine — reprendre une cuisson', () => {
  // ⛔ LE TEST LE PLUS IMPORTANT DU LOT. Une échéance dans le passé, c'est exactement ce que produit
  // « fermer l'appli, revenir plus tard ». L'écran doit dire depuis quand c'est fini — jamais
  // afficher un décompte figé, jamais laisser croire que ça vient de sonner.
  it('⛔ une session reprise DIT LA VÉRITÉ sur un minuteur échu', async () => {
    writeCuisineSession(baseCourante(), {
      recetteId: CHAKCHOUKA,
      ordreCourant: 2,
      ouverteLe: Date.now() - 40 * 60 * 1000,
      minuteurs: [{ ordre: 2, finMs: Date.now() - 38 * 60 * 1000, pauseRestantS: null }],
    })

    await monter()

    expect(screen.getByText(/Étape 2 sur 5/)).toBeTruthy()
    expect(screen.getByText(/terminé il y a 38:0\d/)).toBeTruthy()
  })

  it('rouvre à l’étape où l’on s’était arrêté', async () => {
    writeCuisineSession(baseCourante(), {
      recetteId: CHAKCHOUKA,
      ordreCourant: 4,
      ouverteLe: Date.now(),
      minuteurs: [],
    })

    await monter()
    expect(screen.getByText(/Étape 4 sur 5/)).toBeTruthy()
  })

  // ⚠️ L'alarme ne doit PAS retentir pour un minuteur déjà échu à l'ouverture : ce serait le
  // mensonge du point 7 retourné en son contraire sonore.
  it('⛔ ne SONNE PAS pour un minuteur déjà échu au moment où l’on rouvre', async () => {
    writeCuisineSession(baseCourante(), {
      recetteId: CHAKCHOUKA,
      ordreCourant: 2,
      ouverteLe: Date.now() - 60 * 60 * 1000,
      minuteurs: [{ ordre: 2, finMs: Date.now() - 55 * 60 * 1000, pauseRestantS: null }],
    })

    await monter()
    expect(screen.queryByRole('button', { name: 'Arrêter l’alarme' })).toBeNull()
  })

  it('une session d’une AUTRE recette ne se reprend pas ici', async () => {
    writeCuisineSession(baseCourante(), {
      recetteId: 'omelette_fines_herbes',
      ordreCourant: 3,
      ouverteLe: Date.now(),
      minuteurs: [],
    })

    await monter()
    // La cuisson repart à la première étape de CETTE recette, pas à la troisième de l'autre.
    expect(screen.getByText(/Étape 1 sur 5/)).toBeTruthy()
  })
})

describe('cuisine — l’alarme', () => {
  it('⛔ sonne à l’échéance et s’arrête sur un appui n’importe où', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await monter()
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Lancer le minuteur (12:00)'))

    await act(async () => {
      vi.advanceTimersByTime(12 * 60 * 1000 + 2000)
    })

    const arret = screen.getByRole('button', { name: 'Arrêter l’alarme' })
    fireEvent.click(arret)
    expect(screen.queryByRole('button', { name: 'Arrêter l’alarme' })).toBeNull()
  })
})

describe('cuisine — garde-fous', () => {
  // `jsdom` n'a pas `navigator.wakeLock` : c'est exactement le cas d'un navigateur sans l'API, ou
  // d'une page servie en `http://`. L'écran doit fonctionner et le DIRE, jamais promettre à vide.
  it('⛔ l’absence de Wake Lock ne casse rien et n’est pas promise', async () => {
    await monter()
    expect(screen.getByText(/L'écran peut s'éteindre/)).toBeTruthy()
    expect(screen.queryByText(/L'écran reste allumé/)).toBeNull()
    expect(screen.getByText(/Étape 1 sur 5/)).toBeTruthy()
  })

  // Filet du principe 6, comme sur les autres écrans : le score du moteur est un classement RELATIF
  // à la passe, et un nombre sur 100 à côté d'un plat se lit comme une note nutritionnelle.
  it('⛔ n’affiche AUCUN score', async () => {
    const { container } = await monter()
    const texte = container.textContent ?? ''
    expect(texte).not.toMatch(/\/\s*100\b/)
    expect(texte.toLowerCase()).not.toContain('score')
  })

  it('une recette inconnue ne casse pas l’écran', async () => {
    const { Cuisine } = await import('./cuisine.js')
    render(<Cuisine recetteId="recette_qui_n_existe_pas" />)
    expect(await screen.findByText('Cette recette est introuvable.')).toBeTruthy()
  })
})
