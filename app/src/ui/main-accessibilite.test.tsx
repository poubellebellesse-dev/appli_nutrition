// @vitest-environment jsdom
//
// ui/main-accessibilite.test.tsx — le socle d'accessibilité de la coquille : lien d'évitement et
// focus géré au changement de route (`main.tsx`, composant `Coquille`).
//
// ⚠️ MÊME MOTIF QUE `main.test.tsx` : `main.tsx` appelle `createRoot(...).render(...)` À L'IMPORT,
// pas dans un composant exporté. Il faut un `#root` dans le DOM AVANT l'import, et un `import()`
// dynamique après `vi.resetModules()` pour un montage neuf à chaque test.
//
// ⚠️ ON PRÉ-ENREGISTRE LE CONSENTEMENT (`recordConsent`) au lieu de traverser l'accueil : ce fichier
// ne teste ni l'accueil ni l'invitation à la visite (couverts par `main.test.tsx` et
// `screens/accueil.test.tsx`), seulement le socle d'accessibilité qui vit sous `<Navigation>`.
//
// ⚠️ AUCUNE ASSERTION SUR `.sr-only` (visibilité réelle) : cette classe est définie en CSS, que
// jsdom n'applique pas. On vérifie la présence, l'ordre dans le DOM et le comportement au focus —
// jamais l'apparence.
//
// ⚠️ LE ROUTEUR EST UN MODULE SINGLETON (`router.tsx`) : `window.location.hash` est remis à `''`
// avant et après chaque test, même précaution que `visite.test.tsx`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { recordConsent } from '../data/user-store.js'
import { VERSION_CONSENTEMENT } from './texte-consentement.js'
import { hashDe } from './router.js'
import { baseCourante, catalogueDeTest, reinitialiserBase, sessionDeTest } from './test-socle.js'

vi.mock('./catalog-source.js', () => ({
  chargerCatalogue: () => Promise.resolve(catalogueDeTest()),
}))
vi.mock('./user-source.js', () => ({
  ouvrirUserDb: () => Promise.resolve(sessionDeTest()),
  surErreurDePersistance: () => undefined,
}))

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
  document.body.innerHTML = '<div id="root"></div>'
  window.location.hash = ''
})
afterEach(() => {
  cleanup()
  window.location.hash = ''
})

/** Fait « arriver » sur une route : c'est ce que produirait le clic d'un vrai `<a href>` — même
 * idiome que `visite.test.tsx`. */
function naviguerVers(hash: string) {
  window.location.hash = hash
  fireEvent(window, new Event('hashchange'))
}

/**
 * Monte la coquille avec un consentement DÉJÀ enregistré : pas d'accueil à traverser, la barre de
 * navigation apparaît directement. `etapeVisite` reste à `'aucune'` toute la vie du test — cette
 * invitation ne se propose qu'en sortant de l'accueil (voir `main.tsx`, `onTermine`) — donc rien ne
 * vient interférer avec le focus posé sur `<main>`.
 */
async function monterAppConsentie(): Promise<void> {
  recordConsent(baseCourante(), VERSION_CONSENTEMENT, new Date().toISOString())
  await import('./main.js')
  await screen.findByRole('navigation', { name: 'Navigation principale' })
}

/**
 * Les éléments réellement atteignables au clavier par Tab, dans l'ordre du DOM. Exclut le `<main>`
 * lui-même (`tabIndex={-1}` : focusable par programme, jamais par Tab) — sinon la question « premier
 * élément focusable » n'aurait pas de sens : `<main>` est structurellement en tête de tout ce qui
 * suit `<Navigation>`.
 */
function elementsFocusables(): readonly Element[] {
  return Array.from(
    document.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
        'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  )
}

describe('main — socle d’accessibilité de la coquille', () => {
  it('ne prend PAS le focus sur le contenu au premier montage', async () => {
    await monterAppConsentie()
    expect(document.activeElement).not.toBe(screen.getByRole('main'))
  })

  it('un changement de route déplace le focus sur le <main> et remet le défilement à zéro', async () => {
    await monterAppConsentie()
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)

    naviguerVers(hashDe('semaine'))

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('main')))
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('le bouton « Aller au contenu » est le premier élément focusable du document', async () => {
    await monterAppConsentie()

    const focusables = elementsFocusables()
    expect(focusables.length).toBeGreaterThan(0)
    expect(focusables[0]).toBe(screen.getByRole('button', { name: 'Aller au contenu' }))
  })

  it('un clic sur « Aller au contenu » place le focus sur le <main>', async () => {
    await monterAppConsentie()

    fireEvent.click(screen.getByRole('button', { name: 'Aller au contenu' }))

    expect(document.activeElement).toBe(screen.getByRole('main'))
  })
})
