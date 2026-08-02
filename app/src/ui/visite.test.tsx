// @vitest-environment jsdom
//
// ui/visite.test.tsx — la visite guidée, montée sur un DOM factice.
//
// ⚠️ CE COMPOSANT NE PARLE NI AU MOTEUR NI À LA BASE : pas de `test-socle.ts`, pas de `vi.mock`. On
// monte juste `document.body.innerHTML` avec les quatre cibles réelles (voir `visite.tsx`) puis
// `render(<Visite onTerminer={...} />)`.
//
// ⚠️ RÉGEX POUR TOUTE ASSERTION SUR « Suivant » : le libellé réel est « Suivant › » (icône dans un
// `<span>` séparé), et `getByText('Suivant')` ne le trouve pas — piège déjà payé sur ce projet
// (`accueil.test.tsx`, avec « ← Revenir en arrière »).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ETAPES_VISITE, Visite } from './visite.js'

/** Les quatre cibles réelles, à l'identique de ce que `visite.tsx` cible dans l'application. */
const MARKUP_COMPLET = `
  <nav aria-label="Navigation principale"></nav>
  <article data-visite="carte-plat"><div data-visite="fleches"></div></article>
  <a href="#/parametres">Paramètres</a>
`

beforeEach(() => {
  document.body.innerHTML = MARKUP_COMPLET
})
afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

/** Même idiome que `aujourdhui.test.tsx` : le texte visible n'est pas toujours sur le `<button>`. */
const bouton = (texte: string | RegExp) => screen.getByText(texte).closest('button') as HTMLButtonElement

describe('visite — la progression', () => {
  it("affiche l'indicateur d'étape en toutes lettres, pas seulement en pastilles", () => {
    render(<Visite onTerminer={() => undefined} />)
    expect(screen.getByText('Étape 1 sur 4')).toBeDefined()
  })

  it('« Suivant » avance et « Étape 2 sur 4 » suit', () => {
    render(<Visite onTerminer={() => undefined} />)
    fireEvent.click(bouton(/^Suivant/))
    expect(screen.getByText('Étape 2 sur 4')).toBeDefined()
  })

  it('« Passer » appelle onTerminer immédiatement, dès la première étape', () => {
    const onTerminer = vi.fn()
    render(<Visite onTerminer={onTerminer} />)
    fireEvent.click(bouton(/^Passer/))
    expect(onTerminer).toHaveBeenCalledTimes(1)
  })

  it('« Passer » appelle onTerminer immédiatement, même après avoir avancé', () => {
    const onTerminer = vi.fn()
    render(<Visite onTerminer={onTerminer} />)
    fireEvent.click(bouton(/^Suivant/))
    fireEvent.click(bouton(/^Suivant/))
    fireEvent.click(bouton(/^Passer/))
    expect(onTerminer).toHaveBeenCalledTimes(1)
  })

  it('la dernière étape appelle onTerminer', () => {
    const onTerminer = vi.fn()
    render(<Visite onTerminer={onTerminer} />)
    // Une étape par clic : ÉTAPES_VISITE.length clics amènent du 1er au dernier PUIS terminent.
    for (let i = 0; i < ETAPES_VISITE.length; i++) fireEvent.click(bouton(/^Suivant/))
    expect(onTerminer).toHaveBeenCalledTimes(1)
  })

  it('Échap ferme la visite comme « Passer »', () => {
    const onTerminer = vi.fn()
    render(<Visite onTerminer={onTerminer} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onTerminer).toHaveBeenCalledTimes(1)
  })
})

describe('visite — accessibilité', () => {
  it('la bulle est un dialogue modal nommé, et reçoit le focus', () => {
    render(<Visite onTerminer={() => undefined} />)
    const dialogue = screen.getByRole('dialog')
    expect(dialogue.getAttribute('aria-modal')).toBe('true')
    expect(dialogue.getAttribute('aria-label')).toBe(ETAPES_VISITE[0]?.titre)
    expect(document.activeElement).toBe(dialogue)
  })

  it('« Passer » n\'est pas plus petit que « Suivant » — sortir doit être aussi facile qu\'avancer', () => {
    render(<Visite onTerminer={() => undefined} />)
    const passer = bouton(/^Passer/)
    const suivant = bouton(/^Suivant/)
    expect(passer.className).toContain('flex-1')
    expect(suivant.className).toContain('flex-1')
    expect(passer.className).toContain('min-h-tactile')
    expect(suivant.className).toContain('min-h-tactile')
  })
})

describe('visite — cible introuvable', () => {
  it('⛔ une cible absente du DOM saute l’étape au lieu de planter', () => {
    // L'étape 3 (les flèches) n'existe plus : elle doit être sautée, pas provoquer d'erreur.
    document.querySelector('[data-visite="fleches"]')?.remove()
    const onTerminer = vi.fn()
    expect(() => render(<Visite onTerminer={onTerminer} />)).not.toThrow()

    fireEvent.click(bouton(/^Suivant/)) // étape 1 → étape 2 (présente)
    expect(screen.getByText('Étape 2 sur 4')).toBeDefined()

    fireEvent.click(bouton(/^Suivant/)) // étape 2 → étape 3 absente → saute à l'étape 4
    expect(screen.getByText('Étape 4 sur 4')).toBeDefined()
    expect(onTerminer).not.toHaveBeenCalled()
  })

  it('⛔ toutes les cibles absentes : onTerminer() est appelé et rien n’est rendu', () => {
    document.body.innerHTML = ''
    const onTerminer = vi.fn()
    render(<Visite onTerminer={onTerminer} />)
    expect(onTerminer).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('saute aussi une cible manquante dès la première étape, sans planter', () => {
    document.querySelector('nav[aria-label="Navigation principale"]')?.remove()
    const onTerminer = vi.fn()
    render(<Visite onTerminer={onTerminer} />)
    // L'étape 1 (barre de navigation) manque : on démarre directement à « Étape 2 sur 4 ».
    expect(screen.getByText('Étape 2 sur 4')).toBeDefined()
    expect(onTerminer).not.toHaveBeenCalled()
  })
})

describe('visite — chaque cible existe vraiment dans le markup de référence', () => {
  // ⚠️ DÉRIVÉ DE `ETAPES_VISITE`, PAS RECOPIÉ À LA MAIN. Une liste recopiée ne détecte pas ce qui
  // manque à l'original : si une étape est ajoutée à `visite.tsx` sans sa cible dans
  // `MARKUP_COMPLET`, elle serait absente des deux listes et le test resterait vert pour de mauvaises
  // raisons. `it.each` sur la table elle-même garantit qu'une étape non couverte échoue.
  //
  // ⚠️ GARDE CONTRE `it.each([])` : une table vide ne produit AUCUN test, et la suite resterait
  // verte sans avoir rien vérifié — c'est le piège que ce test existe pour fermer.
  it('la table des étapes n’est pas vide', () => {
    expect(ETAPES_VISITE.length).toBeGreaterThan(0)
  })

  it.each(ETAPES_VISITE.map((etape) => [etape.titre, etape.cible] as const))(
    '« %s » (%s) correspond à un élément du markup de référence',
    (_titre, cible) => {
      expect(document.querySelector(cible)).not.toBeNull()
    }
  )
})
