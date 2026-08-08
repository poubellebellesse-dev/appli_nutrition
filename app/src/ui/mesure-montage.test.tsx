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
    const { container } = render(<MesureMontage depuis={performance.now()} nbCartes={12} />)
    expect(container.innerHTML).toBe('')
  })

  it('mesureDemandee() est faux', async () => {
    fixerRecherche('')
    const { mesureDemandee } = await import('./mesure-montage.js')
    expect(mesureDemandee()).toBe(false)
  })

  it("ne programme jamais requestAnimationFrame — coût nul de l'outil de diagnostic", async () => {
    fixerRecherche('')
    const espionRaf = vi.spyOn(window, 'requestAnimationFrame')
    const { MesureMontage } = await import('./mesure-montage.js')
    render(<MesureMontage depuis={performance.now()} nbCartes={12} />)
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
    render(<MesureMontage depuis={performance.now()} nbCartes={37} />)
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('37 cartes')
    })
  })

  it("passe par un état « en cours » avant d'afficher la valeur", async () => {
    fixerRecherche('?perf')
    const { MesureMontage } = await import('./mesure-montage.js')
    render(<MesureMontage depuis={performance.now()} nbCartes={5} />)
    expect(screen.getByRole('status').getAttribute('data-mesure-montage')).toBe('en-cours')
    expect(screen.getByRole('status').textContent).toContain('mesure en cours…')
    await waitFor(() => {
      expect(screen.getByRole('status').getAttribute('data-mesure-montage')).not.toBe('en-cours')
    })
  })
})
