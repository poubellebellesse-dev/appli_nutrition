// @vitest-environment jsdom
// tests/scelles/lot-D.test.tsx — le bouton retour d'Android remonte, il ne quitte plus.
//
// Écrit depuis le « Fini quand » du lot D (`docs/CONCEPTION_RETOURS_APK.md`), AVANT tout code.
//
// ⚠️ LE NATIF SE SIMULE PAR `Capacitor.isNativePlatform` (le signal de `ui/natif.ts`, lot J), relu
// à chaque appel. `@capacitor/app` est remplacé par un double qui ENREGISTRE les écouteurs : « appuyer
// sur retour », c'est appeler tous les écouteurs `backButton` encore actifs — et la clause 1 exige
// qu'il n'y en ait qu'un.
//
// ⚠️ `catalog.db` RÉEL (`catalogueDeTest()`), jamais une fixture. Aucun effectif écrit en dur.

import { readFileSync, readdirSync } from 'node:fs'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import {
  baseCourante,
  catalogueDeTest,
  confianceDeTest,
  reinitialiserBase,
} from '../../app/src/ui/test-socle.js'

const etat = vi.hoisted(() => ({ natif: false }))

interface Ecouteur {
  readonly nom: string
  readonly rappel: (evenement: { canGoBack: boolean }) => void
  actif: boolean
}
const app = vi.hoisted(() => ({ ecouteurs: [] as Ecouteur[], sorties: 0 }))

vi.mock('@capacitor/core', async (importOriginal) => {
  const reel = await importOriginal<typeof import('@capacitor/core')>()
  return {
    ...reel,
    Capacitor: new Proxy(reel.Capacitor, {
      get: (cible, cle, recepteur) =>
        cle === 'isNativePlatform' ? () => etat.natif : Reflect.get(cible, cle, recepteur),
    }),
  }
})

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (nom: string, rappel: Ecouteur['rappel']) => {
      const ecouteur: Ecouteur = { nom, rappel, actif: true }
      app.ecouteurs.push(ecouteur)
      return Promise.resolve({
        remove: () => {
          ecouteur.actif = false
          return Promise.resolve()
        },
      })
    },
    exitApp: () => {
      app.sorties += 1
      return Promise.resolve()
    },
  },
}))

vi.mock('../../app/src/ui/catalog-source.js', () => ({
  chargerCatalogue: () => Promise.resolve(catalogueDeTest()),
  chargerConfiance: () => Promise.resolve(confianceDeTest()),
}))
vi.mock('../../app/src/ui/user-source.js', () => ({
  ouvrirUserDb: () =>
    Promise.resolve({ db: baseCourante(), stockage: 'opfs', persistant: true, verrou: 'exclusif' }),
  surErreurDePersistance: () => undefined,
}))

const RACINE_SRC = process.cwd().replace(/\\/g, '/').replace(/\/$/, '') + '/app/src/'

let demonter: (() => void) | null = null

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
  etat.natif = true
  app.ecouteurs = []
  app.sorties = 0
  window.location.hash = '#/'
  document.body.innerHTML = '<div id="root"></div>'
})
afterEach(() => {
  demonter?.()
  demonter = null
  cleanup()
})

const clic = (texte: string | RegExp) => fireEvent.click(screen.getByText(texte))
const desactive = (texte: string): boolean =>
  (screen.getByText(texte).closest('button') as HTMLButtonElement).disabled

const actifs = (): Ecouteur[] => app.ecouteurs.filter((e) => e.nom === 'backButton' && e.actif)

/** Un appui sur le bouton retour du téléphone. Exige un et un seul écouteur actif (clause 1). */
async function retour(canGoBack = true): Promise<void> {
  const ecouteurs = actifs()
  expect(ecouteurs.length, 'un et un seul écouteur backButton actif').toBe(1)
  await act(async () => {
    for (const e of ecouteurs) e.rappel({ canGoBack })
    await new Promise((r) => setTimeout(r, 20))
  })
}

const hashDevient = (attendu: string) => waitFor(() => expect(window.location.hash).toBe(attendu))

async function monterSurLAccueil(): Promise<void> {
  const { racine } = await import('../../app/src/ui/main.js')
  demonter = () => act(() => racine.unmount())
  await screen.findByRole('heading', { name: 'Bienvenue' })
}

async function passerLEngagement(): Promise<void> {
  clic('J’ai lu et compris')
  await waitFor(() => expect(desactive('J’ai compris')).toBe(false))
  clic('J’ai compris')
}

/** Traverse l'accueil jusqu'à la coquille ; laisse l'invitation à la visite ouverte. */
async function traverserLAccueil(): Promise<void> {
  await monterSurLAccueil()
  await passerLEngagement()
  if (!etat.natif) {
    await screen.findByRole('heading', { name: 'Installez l’application sur votre écran d’accueil' })
    clic('Plus tard')
  }
  await screen.findByRole('heading', { name: 'Des allergies ?' })
  clic('Continuer')
  await screen.findByRole('heading', { name: 'Votre rythme' })
  clic('C’est parti')
  await screen.findByText('Paramètres')
  await screen.findByRole('dialog', { name: 'Une visite guidée ?' })
}

/** Coquille atteinte, invitation refusée par son bouton — pas par le retour. */
async function monterLaCoquille(): Promise<void> {
  await traverserLAccueil()
  clic('Non merci')
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
}

function lienDOnglet(onglet: string): HTMLElement {
  const barre = screen.getByRole('navigation')
  return within(barre).getByText(
    (_, el) => el?.tagName === 'A' && (el.textContent ?? '').replace(/'/g, '’').includes(onglet)
  )
}

function fichiersSource(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = `${dossier}${entree.name}`
    if (entree.isDirectory()) return fichiersSource(`${chemin}/`)
    return /\.tsx?$/.test(entree.name) && !/\.test\.tsx?$/.test(entree.name) ? [chemin] : []
  })
}

describe('lot D — le bouton retour d’Android', () => {
  it('⛔ clause 1 — en natif, un et un seul écouteur, qui survit aux changements d’onglet', async () => {
    await monterLaCoquille()
    expect(actifs().length, 'après montage').toBe(1)
    for (const onglet of ['Semaine', 'Recettes', 'Aujourd’hui']) {
      fireEvent.click(lienDOnglet(onglet))
      await waitFor(() => expect(document.querySelector('main h1')).not.toBeNull())
    }
    expect(actifs().length, 'après trois changements d’onglet').toBe(1)
  })

  it('⛔ clause 1 — en web, aucun écouteur backButton n’est posé', async () => {
    etat.natif = false
    await monterLaCoquille()
    expect(app.ecouteurs.filter((e) => e.nom === 'backButton')).toEqual([])
  })

  it('⛔ clause 1 — un seul fichier importe @capacitor/app, et lui seul appelle exitApp', () => {
    const fichiers = fichiersSource(RACINE_SRC)
    const importeurs = fichiers.filter((f) => /from\s+['"]@capacitor\/app['"]/.test(readFileSync(f, 'utf8')))
    expect(importeurs.map((f) => f.slice(RACINE_SRC.length))).toHaveLength(1)
    const sorties = fichiers.filter((f) => /\bexitApp\s*\(/.test(readFileSync(f, 'utf8')))
    expect(sorties).toEqual(importeurs)
  })

  it('⛔ clause 2 — l’invitation à la visite se ferme au retour, sans quitter ni naviguer', async () => {
    await traverserLAccueil()
    await retour()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(window.location.hash).toBe('#/')
    expect(app.sorties).toBe(0)
    expect(screen.queryByText(/Étape 1 sur/), 'refusée, pas acceptée').toBeNull()
  })

  it('⛔ clause 2 — Paramètres › « Mon régime » : le retour ferme la fenêtre, pas l’écran', async () => {
    await monterLaCoquille()
    clic('Paramètres')
    await hashDevient('#/parametres')
    fireEvent.click(await screen.findByText('Mon régime'))
    await screen.findByRole('dialog', { name: 'Mon régime' })

    await retour()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(window.location.hash).toBe('#/parametres')
    expect(app.sorties).toBe(0)
  })

  it('⛔ clause 2 — une fenêtre fermée par son propre bouton ne laisse rien derrière elle', async () => {
    await monterLaCoquille()
    clic('Paramètres')
    await hashDevient('#/parametres')
    fireEvent.click(await screen.findByText('Mon régime'))
    const fenetre = await screen.findByRole('dialog', { name: 'Mon régime' })
    fireEvent.click(within(fenetre).getByText(/Retour/))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    await retour(false)
    await hashDevient('#/')
    expect(app.sorties).toBe(0)
  })

  it('⛔ clause 2 — deux fenêtres empilées : seule la plus récente se ferme', async () => {
    await monterLaCoquille()
    const { Panneau } = await import('../../app/src/ui/panneau.js')
    const fermetures: string[] = []

    function Empilement() {
      const [interieure, setInterieure] = useState(false)
      return (
        <Panneau titre="Extérieure" onFermer={() => fermetures.push('extérieure')}>
          <button type="button" onClick={() => setInterieure(true)}>
            Ouvrir l’intérieure
          </button>
          {interieure && (
            <Panneau titre="Intérieure" onFermer={() => fermetures.push('intérieure')}>
              <p>dedans</p>
            </Panneau>
          )}
        </Panneau>
      )
    }

    render(<Empilement />)
    fireEvent.click(await screen.findByText('Ouvrir l’intérieure'))
    await screen.findByRole('dialog', { name: 'Intérieure' })

    await retour()
    expect(fermetures).toEqual(['intérieure'])
    expect(app.sorties).toBe(0)
  })

  it('⛔ clause 3 — un tutoriel en cours se termine au retour', async () => {
    await monterLaCoquille()
    clic('Paramètres')
    fireEvent.click(await screen.findByText('Revoir un tutoriel'))
    const fenetre = await screen.findByRole('dialog', { name: 'Revoir un tutoriel' })
    fireEvent.click(within(within(fenetre).getAllByRole('listitem')[0] as HTMLElement).getByRole('button'))
    await screen.findByText(/Étape 1 sur/)

    await retour()
    await waitFor(() => expect(screen.queryByText(/Étape 1 sur/)).toBeNull())
    expect(app.sorties).toBe(0)
  })

  it('⛔ clause 4 — hors fenêtre, le retour remonte l’historique, puis quitte sur Aujourd’hui', async () => {
    await monterLaCoquille()
    expect(window.location.hash).toBe('#/')
    fireEvent.click(lienDOnglet('Recettes'))
    await hashDevient('#/recettes')
    const fiche = await waitFor(() => {
      const lien = document.querySelector<HTMLAnchorElement>('main a[href^="#/recette/"]')
      expect(lien).not.toBeNull()
      return lien as HTMLAnchorElement
    })
    window.location.hash = fiche.getAttribute('href') as string
    await waitFor(() => expect(window.location.hash.startsWith('#/recette/')).toBe(true))

    await retour()
    await hashDevient('#/recettes')
    await retour()
    await hashDevient('#/')
    expect(app.sorties).toBe(0)
    await retour()
    await waitFor(() => expect(app.sorties).toBe(1))
    expect(window.location.hash).toBe('#/')
  })

  it('⛔ clause 5 — sur Aujourd’hui, le retour quitte même quand l’historique pourrait remonter', async () => {
    await monterLaCoquille()
    fireEvent.click(lienDOnglet('Recettes'))
    await hashDevient('#/recettes')
    fireEvent.click(lienDOnglet('Aujourd’hui'))
    await hashDevient('#/')

    await retour(true)
    await waitFor(() => expect(app.sorties).toBe(1))
    await new Promise((r) => setTimeout(r, 50))
    expect(window.location.hash, 'l’historique n’est pas remonté').toBe('#/')
  })

  // ⚠️ ÉLARGIE APRÈS LE 2e TOUR D'ATTAQUE : sur le seul `#/recettes`, une table de hashs littéraux
  // (`'#/parametres'` → `#/`, le reste → `history.back()`) passait. Les quatre autres onglets et
  // le frigo y passent tous, chacun ouvert directement, sans historique.
  it('⛔ clause 5 — ailleurs sans historique, le retour ramène sur Aujourd’hui sans quitter', async () => {
    await monterLaCoquille()
    for (const hash of ['#/semaine', '#/courses', '#/recettes', '#/savoir', '#/frigo']) {
      window.location.hash = hash
      await hashDevient(hash)
      await retour(false)
      await waitFor(() => expect(window.location.hash, `depuis ${hash}`).toBe('#/'))
      expect(app.sorties, `depuis ${hash}`).toBe(0)
    }
  })

  // ⚠️ AJOUTÉE APRÈS LE 1er TOUR D'ATTAQUE : une comparaison littérale `hash === '#/'` passait toutes
  // les autres clauses. Or une personne déjà installée rouvre l'appli sur un hash VIDE, qui est aussi
  // Aujourd'hui (`routeDepuisHash('')`) — et la triche l'y renvoyait vers `#/` au lieu de quitter.
  it('⛔ clause 5 — rouverte sur un hash vide, Aujourd’hui quitte aussi', async () => {
    await monterLaCoquille()
    window.location.hash = ''
    await waitFor(() => expect(window.location.hash).toBe(''))

    await retour(false)
    await waitFor(() => expect(app.sorties).toBe(1))
    expect(window.location.hash).toBe('')
  })

  it('clause 5 témoin — Paramètres est de l’onglet Aujourd’hui, et ne quitte pas', async () => {
    await monterLaCoquille()
    clic('Paramètres')
    await hashDevient('#/parametres')

    await retour(false)
    await hashDevient('#/')
    expect(app.sorties).toBe(0)
  })

  it('⛔ clause 6 — l’accueil recule d’une étape, et quitte à la première', async () => {
    await monterSurLAccueil()
    await passerLEngagement()
    await screen.findByRole('heading', { name: 'Des allergies ?' })
    // ⚠️ TROIS PAS, PAS DEUX (2e tour d'attaque) : une machine à deux états « allergies → bienvenue,
    // sinon quitter » passait. Depuis « Votre rythme », le retour doit reculer, pas quitter.
    clic('Continuer')
    await screen.findByRole('heading', { name: 'Votre rythme' })

    await retour()
    await screen.findByRole('heading', { name: 'Des allergies ?' })
    expect(app.sorties).toBe(0)

    await retour()
    await screen.findByRole('heading', { name: 'Bienvenue' })
    expect(app.sorties).toBe(0)

    await retour()
    await waitFor(() => expect(app.sorties).toBe(1))
    expect(screen.getByRole('heading', { name: 'Bienvenue' })).toBeTruthy()
  })
})
