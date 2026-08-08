// @vitest-environment jsdom
//
// ui/mesure-montage.test.tsx — le chronomètre de la décision 61 (voir l'en-tête de mesure-montage.tsx).
//
// ⚠️ CE QUI COMPTE LE PLUS ICI : le drapeau est lu UNE SEULE FOIS au chargement du module
// (`new URLSearchParams(window.location.search).has('perf')`). Pour observer les deux comportements
// (avec/sans `?perf`) il faut donc changer `window.location.search` PUIS re-charger le module avec
// `vi.resetModules()` + `await import(...)` — le motif exact de `screens/recettes.test.tsx`. Un test
// qui importerait le module une seule fois en tête de fichier ne pourrait jamais couvrir les deux cas.
//
// La garantie à verrouiller n'est PAS « avec le drapeau ça marche » — c'est **l'inertie totale sans
// le drapeau** : aucun `requestAnimationFrame` programmé, donc coût nul pour un écran de production
// qui n'a jamais demandé cet outil de diagnostic.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

/** Change `window.location.search` en jsdom. `history.replaceState` marche sans reconfigurer
 *  `window.location` (qui est protégé/non reconfigurable sur certains environnements jsdom). */
function fixerRecherche(search: string): void {
  const url = new URL(window.location.href)
  url.search = search
  window.history.replaceState(null, '', url.toString())
}

beforeEach(() => {
  vi.resetModules()
})
afterEach(() => {
  cleanup()
  fixerRecherche('')
})

describe('sans le drapeau ?perf', () => {
  it('ne rend rien', async () => {
    fixerRecherche('')
    const { MesureMontage } = await import('./mesure-montage.js')
    const { container } = render(
      <MesureMontage depuis={performance.now()} depuisRendu={performance.now()} nbCartes={12} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('mesureDemandee() est faux', async () => {
    fixerRecherche('')
    const { mesureDemandee } = await import('./mesure-montage.js')
    expect(mesureDemandee()).toBe(false)
  })

  // ⚠️ LES DEUX EFFETS SONT COUVERTS PAR CE TEST, ET C'EST VOULU. Depuis l'ajout de la mesure de
  // re-rendu il y a DEUX chronomètres ; un seul des deux resté inerte suffirait à faire payer
  // l'écran de production. L'espion ne compte pas les rAF « du bon effet », il exige zéro.
  it("ne programme jamais requestAnimationFrame — coût nul de l'outil de diagnostic", async () => {
    fixerRecherche('')
    const espionRaf = vi.spyOn(window, 'requestAnimationFrame')
    const { MesureMontage } = await import('./mesure-montage.js')
    const { rerender } = render(
      <MesureMontage depuis={performance.now()} depuisRendu={performance.now()} nbCartes={12} />
    )
    // Une nouvelle passe de rendu : c'est ce qui réveille le second chronomètre quand le drapeau est là.
    rerender(<MesureMontage depuis={performance.now()} depuisRendu={performance.now()} nbCartes={3} />)
    // Laisse une chance à un éventuel rAF de s'exécuter avant de conclure qu'il n'y en a aucun.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(espionRaf).not.toHaveBeenCalled()
    espionRaf.mockRestore()
  })
})

describe('avec le drapeau ?perf', () => {
  it('mesureDemandee() est vrai', async () => {
    fixerRecherche('?perf')
    const { mesureDemandee } = await import('./mesure-montage.js')
    expect(mesureDemandee()).toBe(true)
  })

  it('affiche le nombre de cartes passé en prop, sur un élément role="status"', async () => {
    fixerRecherche('?perf')
    const { MesureMontage } = await import('./mesure-montage.js')
    render(<MesureMontage depuis={performance.now()} depuisRendu={performance.now()} nbCartes={37} />)
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('37 cartes')
    })
  })

  it("passe par un état « en cours » avant d'afficher la valeur", async () => {
    fixerRecherche('?perf')
    const { MesureMontage } = await import('./mesure-montage.js')
    render(<MesureMontage depuis={performance.now()} depuisRendu={performance.now()} nbCartes={5} />)
    expect(screen.getByRole('status').getAttribute('data-mesure-montage')).toBe('en-cours')
    expect(screen.getByRole('status').textContent).toContain('mesure en cours…')
    await waitFor(() => {
      expect(screen.getByRole('status').getAttribute('data-mesure-montage')).not.toBe('en-cours')
    })
  })

  it('affiche les DEUX nombres — le montage et le rendu', async () => {
    fixerRecherche('?perf')
    const { MesureMontage } = await import('./mesure-montage.js')
    render(<MesureMontage depuis={performance.now()} depuisRendu={performance.now()} nbCartes={9} />)
    await waitFor(() => {
      const texte = screen.getByRole('status').textContent ?? ''
      expect(texte).toMatch(/^montage \d+ ms · rendu \d+ ms · 9 cartes$/)
    })
  })

  // ⛔ LA GARANTIE QUE CE LOT EXISTE POUR POSER. Avant le 2026-08-08 l'encadré gardait le temps de
  // MONTAGE en affichant le NOUVEAU compte de cartes : après un changement de filtre, les deux
  // nombres ne décrivaient plus la même chose, et rien ne le signalait.
  it('reprend la mesure de rendu à chaque nouvelle passe, et garde le montage figé', async () => {
    fixerRecherche('?perf')
    const { MesureMontage } = await import('./mesure-montage.js')
    const montage = performance.now()
    const { rerender } = render(
      <MesureMontage depuis={montage} depuisRendu={performance.now()} nbCartes={305} />
    )
    await waitFor(() => {
      expect(screen.getByRole('status').getAttribute('data-mesure-rendu')).not.toBe('en-cours')
    })
    const montageInitial = screen.getByRole('status').getAttribute('data-mesure-montage')

    // Une passe qui aurait « commencé » 500 ms plus tôt : la nouvelle mesure de rendu doit refléter
    // ce départ-là, donc valoir au moins 500 — sinon c'est l'ancienne valeur qu'on relit.
    rerender(
      <MesureMontage depuis={montage} depuisRendu={performance.now() - 500} nbCartes={42} />
    )
    await waitFor(() => {
      const rendu = Number(screen.getByRole('status').getAttribute('data-mesure-rendu'))
      expect(rendu).toBeGreaterThanOrEqual(500)
    })
    expect(screen.getByRole('status').textContent).toContain('42 cartes')
    // Le montage, lui, ne se reprend JAMAIS : il mesure un événement qui n'a lieu qu'une fois.
    expect(screen.getByRole('status').getAttribute('data-mesure-montage')).toBe(montageInitial)
  })

  // ⚠️ Une passe de rendu qui ne change PAS le nombre de cartes coûte pourtant autant que les autres
  // — deux filtres différents peuvent rendre le même compte. Se réveiller sur `nbCartes` raterait
  // exactement ces cas-là ; c'est `depuisRendu` qui déclenche.
  it('remesure même quand le nombre de cartes ne bouge pas', async () => {
    fixerRecherche('?perf')
    const { MesureMontage } = await import('./mesure-montage.js')
    const montage = performance.now()
    const { rerender } = render(
      <MesureMontage depuis={montage} depuisRendu={performance.now()} nbCartes={12} />
    )
    await waitFor(() => {
      expect(screen.getByRole('status').getAttribute('data-mesure-rendu')).not.toBe('en-cours')
    })
    rerender(<MesureMontage depuis={montage} depuisRendu={performance.now() - 750} nbCartes={12} />)
    await waitFor(() => {
      const rendu = Number(screen.getByRole('status').getAttribute('data-mesure-rendu'))
      expect(rendu).toBeGreaterThanOrEqual(750)
    })
  })
})
