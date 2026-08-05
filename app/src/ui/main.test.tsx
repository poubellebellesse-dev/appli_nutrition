// @vitest-environment jsdom
//
// ui/main.test.tsx — la coquille, montée pour de vrai : l'invitation à la visite guidée en fin
// d'intro (`ui/visite.tsx` était écrit, testé, mais rien ne le déclenchait).
//
// ⚠️ `main.tsx` APPELLE `createRoot(...).render(...)` À L'IMPORT — PAS DANS UN COMPOSANT EXPORTÉ. Il
// faut donc un `#root` dans le DOM AVANT l'import, et un `import()` dynamique après
// `vi.resetModules()` pour obtenir un montage neuf à chaque test, même précaution que
// `accueil.test.tsx` pour `chargerSocle` (promesse mémorisée).
//
// ⚠️ L'invitation ne se propose QU'EN TERMINANT L'INTRO (voir `main.tsx`, `onTermine` de
// `<Accueil>`) : un utilisateur déjà consenti qui relance l'application ne la revoit pas, même à
// `visite_proposee = 0`. On traverse donc le vrai parcours d'accueil, comme `accueil.test.tsx`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { readDisplay, writeDisplay } from '../data/user-store.js'
import { baseCourante, catalogueDeTest, reinitialiserBase, sessionDeTest, confianceDeTest} from './test-socle.js'

vi.mock('./catalog-source.js', () => ({
  chargerCatalogue: () => Promise.resolve(catalogueDeTest()),
  chargerConfiance: () => Promise.resolve(confianceDeTest()),
}))
vi.mock('./user-source.js', () => ({
  ouvrirUserDb: () => Promise.resolve(sessionDeTest()),
  surErreurDePersistance: () => undefined,
}))

/** Voir `main-accessibilite.test.tsx` : `cleanup()` ne démonte PAS la racine de `main.tsx`, qui est
 * créée à l'import. Sans ça, chaque test en laissait une vivante derrière lui. */
let demonter: (() => void) | null = null

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
  document.body.innerHTML = '<div id="root"></div>'
})
afterEach(() => {
  demonter?.()
  demonter = null
  cleanup()
})

const clic = (texte: string | RegExp) => fireEvent.click(screen.getByText(texte))

/** `disabled` lu sur le DOM, même idiome qu'`accueil.test.tsx`. */
const desactive = (texte: string): boolean =>
  (screen.getByText(texte).closest('button') as HTMLButtonElement).disabled

/** Monte la coquille et traverse l'intro jusqu'à « Aujourd'hui », comme `accueil.test.tsx`. */
async function monterEtTerminerIntro() {
  const { racine } = await import('./main.js')
  demonter = () => act(() => racine.unmount())
  await screen.findByRole('heading', { name: 'Bienvenue' })

  clic('J’ai lu et compris')
  await waitFor(() => expect(desactive('J’ai compris')).toBe(false))
  clic('J’ai compris')

  // ⚠️ jsdom n'émet jamais `beforeinstallprompt` : seul « Plus tard » permet d'avancer.
  await screen.findByRole('heading', { name: 'Installez l’application sur votre écran d’accueil' })
  clic('Plus tard')

  await screen.findByRole('heading', { name: 'Des allergies ?' })
  clic('Continuer')

  await screen.findByRole('heading', { name: 'Votre rythme' })
  clic('C’est parti')
}

describe('main — l’invitation à la visite guidée', () => {
  it('apparaît en fin d’intro quand `visite_proposee` vaut 0', async () => {
    await monterEtTerminerIntro()
    await screen.findByRole('dialog', { name: 'Une visite guidée ?' })
  })

  it('n’apparaît PAS quand `visite_proposee` vaut déjà 1', async () => {
    writeDisplay(baseCourante(), { ...readDisplay(baseCourante()), visiteProposee: true })
    await monterEtTerminerIntro()
    // Le premier écran atteint après l'intro : le titre confirme qu'on a bien fini de charger,
    // avant de vérifier une ABSENCE (voir l'en-tête : requête EXACTE, `queryByRole` renvoie `null`).
    await screen.findByText('Paramètres')
    expect(screen.queryByRole('dialog', { name: 'Une visite guidée ?' })).toBeNull()
  })

  it('« Oui, je découvre » lance la visite et écrit `visite_proposee = 1`', async () => {
    await monterEtTerminerIntro()
    await screen.findByRole('dialog', { name: 'Une visite guidée ?' })
    clic('Oui, je découvre')

    // La visite démarre à sa première étape réelle (voir `ETAPES_VISITE`).
    await screen.findByRole('dialog', { name: 'La navigation' })
    expect(screen.queryByRole('dialog', { name: 'Une visite guidée ?' })).toBeNull()
    await waitFor(() => expect(readDisplay(baseCourante()).visiteProposee).toBe(true))
  })

  it('« Non merci » ne lance PAS la visite mais écrit quand même `visite_proposee = 1`', async () => {
    await monterEtTerminerIntro()
    await screen.findByRole('dialog', { name: 'Une visite guidée ?' })
    clic('Non merci')

    expect(screen.queryByRole('dialog', { name: 'Une visite guidée ?' })).toBeNull()
    expect(screen.queryByRole('dialog', { name: 'La navigation' })).toBeNull()
    await waitFor(() => expect(readDisplay(baseCourante()).visiteProposee).toBe(true))
  })
})
