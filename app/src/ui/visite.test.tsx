// @vitest-environment jsdom
//
// ui/visite.test.tsx — les tutoriels guidés, montés sur un DOM factice.
//
// ⚠️ CE COMPOSANT NE PARLE NI AU MOTEUR NI À LA BASE : pas de `test-socle.ts`, pas de `vi.mock`. On
// monte juste `document.body.innerHTML` avec les cibles réelles puis `render(<Visite ... />)`.
//
// ⚠️ RÉGEX POUR TOUTE ASSERTION SUR « Suivant » : le libellé réel est « Suivant › » (icône dans un
// `<span>` séparé), et `getByText('Suivant')` ne le trouve pas — piège déjà payé sur ce projet
// (`accueil.test.tsx`, avec « ← Revenir en arrière »).
//
// ⚠️ `Visite` est rendu dans un PORTAIL (`createPortal` vers `document.body`, même idiome que
// `Panneau`) : `screen.getByText` le voit, `container.querySelector` NON — voir `panneau.test.tsx`
// pour le même piège. On cible donc `within(screen.getByRole('dialog'))` quand il faut scoper.
//
// ⚠️ LE ROUTEUR EST UN MODULE SINGLETON (`router.tsx`, `dernierHash`/`derniereRoute` mémorisés) : on
// remet `window.location.hash` à `''` avant CHAQUE test pour ne pas hériter de l'état laissé par le
// précédent.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { hashDe } from './router.js'
import { Visite, type EtapeVisite } from './visite.js'
import { PARCOURS, etapesDuParcours } from './parcours.js'

const ETAPES_MENUS = etapesDuParcours('menus')

/** Les cinq onglets réels de `navigation.tsx`, avec les vrais `href` produits par `hashDe`. */
const MARKUP_MENUS = `
  <nav aria-label="Navigation principale">
    <a href="${hashDe('aujourdhui')}">Aujourd'hui</a>
    <a href="${hashDe('semaine')}">Semaine</a>
    <a href="${hashDe('courses')}">Courses</a>
    <a href="${hashDe('recettes')}">Recettes</a>
    <a href="${hashDe('savoir')}">Savoir</a>
  </nav>
`

beforeEach(() => {
  document.body.innerHTML = MARKUP_MENUS
  window.location.hash = ''
})
afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  window.location.hash = ''
})

/** Même idiome que `aujourdhui.test.tsx` : le texte visible n'est pas toujours sur le `<button>`. */
const bouton = (texte: string | RegExp) => screen.getByText(texte).closest('button') as HTMLButtonElement

/** Fait « arriver » sur une route : c'est ce que produirait le clic d'un vrai `<a href>`. */
function naviguerVers(hash: string) {
  window.location.hash = hash
  fireEvent(window, new Event('hashchange'))
}

describe('visite — étape « lecture »', () => {
  it('avance avec « Suivant »', () => {
    render(<Visite etapes={ETAPES_MENUS} onTerminer={() => undefined} />)
    expect(screen.getByText(`Étape 1 sur ${ETAPES_MENUS.length}`)).toBeDefined()
    fireEvent.click(bouton(/^Suivant/))
    expect(screen.getByText(`Étape 2 sur ${ETAPES_MENUS.length}`)).toBeDefined()
  })

  it('« Passer » appelle onTerminer immédiatement', () => {
    const onTerminer = vi.fn()
    render(<Visite etapes={ETAPES_MENUS} onTerminer={onTerminer} />)
    fireEvent.click(bouton(/^Passer/))
    expect(onTerminer).toHaveBeenCalledTimes(1)
  })

  it('Échap ferme la visite comme « Passer »', () => {
    const onTerminer = vi.fn()
    render(<Visite etapes={ETAPES_MENUS} onTerminer={onTerminer} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onTerminer).toHaveBeenCalledTimes(1)
  })
})

describe('visite — étape « clic »', () => {
  const ETAPES_CLIC: readonly EtapeVisite[] = [
    {
      cible: '[data-test="bouton-cible"]',
      titre: 'Touchez ce bouton',
      texte: 'Un bouton quelconque de l’application.',
      attendu: { type: 'clic', cible: '[data-test="bouton-cible"]' },
    },
  ]

  beforeEach(() => {
    document.body.innerHTML += '<button type="button" data-test="bouton-cible">Cible</button>'
  })

  it('⛔ n’a PAS de bouton « Suivant »', () => {
    render(<Visite etapes={ETAPES_CLIC} onTerminer={() => undefined} />)
    expect(screen.queryByText(/^Suivant/)).toBeNull()
  })

  it('avance quand la cible réelle est cliquée', () => {
    const onTerminer = vi.fn()
    render(<Visite etapes={ETAPES_CLIC} onTerminer={onTerminer} />)
    fireEvent.click(screen.getByText('Cible'))
    // Une seule étape : cliquer la cible avance puis termine (plus aucune étape valide ensuite).
    expect(onTerminer).toHaveBeenCalledTimes(1)
  })

  it('« Passer » sort quand même, sans avoir cliqué la cible', () => {
    const onTerminer = vi.fn()
    render(<Visite etapes={ETAPES_CLIC} onTerminer={onTerminer} />)
    fireEvent.click(bouton(/^Passer/))
    expect(onTerminer).toHaveBeenCalledTimes(1)
  })
})

describe('visite — étape « route » (parcours « Découvrir les menus »)', () => {
  it('⛔ n’a PAS de bouton « Suivant »', () => {
    render(<Visite etapes={ETAPES_MENUS} onTerminer={() => undefined} />)
    fireEvent.click(bouton(/^Suivant/)) // étape 1 (lecture) → étape 2 (route)
    expect(screen.queryByText(/^Suivant/)).toBeNull()
  })

  it('n’avance PAS avant que la route change', () => {
    render(<Visite etapes={ETAPES_MENUS} onTerminer={() => undefined} />)
    fireEvent.click(bouton(/^Suivant/)) // étape 2 : « Semaine »
    expect(screen.getByText(`Étape 2 sur ${ETAPES_MENUS.length}`)).toBeDefined()
    naviguerVers(hashDe('courses')) // une AUTRE route que celle attendue
    expect(screen.getByText(`Étape 2 sur ${ETAPES_MENUS.length}`)).toBeDefined()
  })

  it('avance quand la route attendue est atteinte', () => {
    render(<Visite etapes={ETAPES_MENUS} onTerminer={() => undefined} />)
    fireEvent.click(bouton(/^Suivant/)) // étape 2 : « Semaine »
    naviguerVers(hashDe('semaine'))
    expect(screen.getByText(`Étape 3 sur ${ETAPES_MENUS.length}`)).toBeDefined()
  })

  it('« Passer » sort à n’importe quelle étape, y compris une étape « route »', () => {
    const onTerminer = vi.fn()
    render(<Visite etapes={ETAPES_MENUS} onTerminer={onTerminer} />)
    fireEvent.click(bouton(/^Suivant/))
    fireEvent.click(bouton(/^Passer/))
    expect(onTerminer).toHaveBeenCalledTimes(1)
  })

  it('parcourt les cinq onglets jusqu’au bout et termine', () => {
    const onTerminer = vi.fn()
    render(<Visite etapes={ETAPES_MENUS} onTerminer={onTerminer} />)
    fireEvent.click(bouton(/^Suivant/)) // étape 1 → étape 2
    naviguerVers(hashDe('semaine'))
    naviguerVers(hashDe('courses'))
    naviguerVers(hashDe('recettes'))
    naviguerVers(hashDe('savoir'))
    expect(onTerminer).toHaveBeenCalledTimes(1)
  })
})

describe('visite — accessibilité', () => {
  it('la bulle est un dialogue nommé et reçoit le focus', () => {
    render(<Visite etapes={ETAPES_MENUS} onTerminer={() => undefined} />)
    const dialogue = screen.getByRole('dialog')
    expect(dialogue.getAttribute('aria-label')).toBe(ETAPES_MENUS[0]?.titre)
    expect(document.activeElement).toBe(dialogue)
  })

  it('l’étape courante est annoncée (`role="status"`)', () => {
    render(<Visite etapes={ETAPES_MENUS} onTerminer={() => undefined} />)
    const scope = within(screen.getByRole('dialog'))
    expect(scope.getByRole('status').textContent).toContain(`Étape 1 sur ${ETAPES_MENUS.length}`)
  })

  it('« Passer » n’est pas plus petit que « Suivant » sur une étape « lecture »', () => {
    render(<Visite etapes={ETAPES_MENUS} onTerminer={() => undefined} />)
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
    // L'étape 3 (« Courses ») n'existe plus : elle doit être sautée, pas provoquer d'erreur.
    document.querySelector(`a[href="${hashDe('courses')}"]`)?.remove()
    const onTerminer = vi.fn()
    expect(() => render(<Visite etapes={ETAPES_MENUS} onTerminer={onTerminer} />)).not.toThrow()

    fireEvent.click(bouton(/^Suivant/)) // étape 1 → étape 2 (Semaine, présente)
    expect(screen.getByText(`Étape 2 sur ${ETAPES_MENUS.length}`)).toBeDefined()

    naviguerVers(hashDe('semaine')) // étape 2 → étape 3 absente → saute à l'étape 4 (Recettes)
    expect(screen.getByText(`Étape 4 sur ${ETAPES_MENUS.length}`)).toBeDefined()
    expect(onTerminer).not.toHaveBeenCalled()
  })

  it('⛔ toutes les cibles absentes : onTerminer() est appelé et rien n’est rendu', () => {
    document.body.innerHTML = ''
    const onTerminer = vi.fn()
    render(<Visite etapes={ETAPES_MENUS} onTerminer={onTerminer} />)
    expect(onTerminer).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('un identifiant de parcours inconnu termine tout de suite, sans planter', () => {
    const onTerminer = vi.fn()
    expect(() =>
      render(<Visite etapes={etapesDuParcours('inexistant')} onTerminer={onTerminer} />)
    ).not.toThrow()
    expect(onTerminer).toHaveBeenCalledTimes(1)
  })
})

describe('visite — la table des parcours', () => {
  // ⚠️ GARDE CONTRE `it.each([])` : une table vide ne produit AUCUN test, et la suite resterait
  // verte sans avoir rien vérifié.
  it('la table n’est pas vide, et le parcours « menus » existe', () => {
    expect(PARCOURS.length).toBeGreaterThan(0)
    expect(ETAPES_MENUS.length).toBeGreaterThan(0)
  })

  it.each(ETAPES_MENUS.map((etape) => [etape.titre, etape.cible] as const))(
    '« %s » (%s) correspond à un élément du markup de référence',
    (_titre, cible) => {
      expect(document.querySelector(cible)).not.toBeNull()
    }
  )
})
