// @vitest-environment jsdom
//
// ui/screens/accueil.test.tsx — le premier lancement, monté pour de vrai.
//
// ⚠️ CE FICHIER GARDE UN DÉFAUT QUE J'AI INTRODUIT ET QUE SEUL LE PILOTAGE A RÉVÉLÉ. En ajoutant
// « Revenir en arrière », la case de consentement vivait encore dans l'état local d'`Engagement` —
// que React démonte en quittant l'étape. Revenir la décochait et redésactivait le bouton : on
// restait bloqué à l'étape 1, sans rien à l'écran pour l'expliquer. Aucun test unitaire ne pouvait
// le voir ; il a fallu cliquer.
//
// ⚠️ ET UNE PERTE DE DONNÉES. Incrémenter `VERSION_CONSENTEMENT` rouvre le parcours pour qui utilise
// déjà l'application (§6.4). L'écran partait d'un état vide et réécrivait les trois réglages à la
// fin : « Continuer, Continuer, C'est parti » sans rien toucher VIDAIT `user_allergy`. Le chemin est
// couvert unitairement par `profil-enregistre.test.ts` ; ici on vérifie qu'il l'est À L'ÉCRAN.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AllergenId } from '../../engine/domain/index.js'
import { readAllergies, readDiet, writeAllergies, writeDiet } from '../../data/user-store.js'
import { baseCourante, catalogueDeTest, reinitialiserBase, sessionDeTest } from '../test-socle.js'

vi.mock('../catalog-source.js', () => ({
  chargerCatalogue: () => Promise.resolve(catalogueDeTest()),
}))
vi.mock('../user-source.js', () => ({
  ouvrirUserDb: () => Promise.resolve(sessionDeTest()),
  surErreurDePersistance: () => undefined,
}))

beforeEach(() => {
  // ⚠️ `resetModules` EST INDISPENSABLE : `socle.ts` mémorise la promesse de chargement. Sans lui,
  // le deuxième test réutiliserait la base du premier, et l'ordre d'exécution déciderait du résultat.
  vi.resetModules()
  reinitialiserBase()
})
afterEach(cleanup)

/** Monte l'accueil et attend qu'il ait fini de lire la base. */
async function monterAccueil(onTermine: () => void = () => undefined) {
  const { Accueil } = await import('./accueil.js')
  render(<Accueil onTermine={onTermine} />)
  await screen.findByRole('heading', { name: 'Bienvenue' })
}

const clic = (nom: string | RegExp) => fireEvent.click(screen.getByText(nom))

/**
 * ⚠️ EXPRESSION RÉGULIÈRE, PAS LA CHAÎNE EXACTE. Le libellé réel est « ← Revenir en arrière » : une
 * correspondance exacte ne le trouve pas. Le piège n'est pas l'échec — c'est que
 * `queryByText('Revenir en arrière')` rendait `null` pour la MÊME raison, et que le test « aucun
 * retour à la première étape » passait donc même si le bouton avait été là.
 */
const RETOUR = /Revenir en arrière/

/**
 * `disabled` lu sur le DOM, sans `@testing-library/jest-dom`.
 *
 * Une quatrième dépendance pour du sucre syntaxique ne se justifie pas : `.disabled` est déjà un
 * booléen, et l'assertion se lit tout aussi bien.
 */
const desactive = (texte: string): boolean =>
  (screen.getByText(texte).closest('button') as HTMLButtonElement).disabled

const presse = (texte: string): string | null =>
  screen.getByText(texte).closest('button')!.getAttribute('aria-pressed')

/** Traverse l'étape 1 : cocher, puis valider. Atterrit sur l'étape d'installation. */
async function passerLEngagement() {
  clic('J’ai lu et compris')
  await waitFor(() => expect(desactive('J’ai compris')).toBe(false))
  clic('J’ai compris')
  await screen.findByRole('heading', { name: 'Installez l’application sur votre écran d’accueil' })
}

/** Traverse l'engagement puis l'installation (« Plus tard », jsdom n'émet jamais `beforeinstallprompt`). */
async function allerAuxAllergies() {
  await passerLEngagement()
  clic('Plus tard')
  await screen.findByRole('heading', { name: 'Des allergies ?' })
}

describe('accueil — les quatre engagements', () => {
  it('affiche les quatre résumés, repliés', async () => {
    await monterAccueil()
    for (const resume of [
      'Vos données ne quittent pas cet appareil.',
      'Une aide pour cuisiner, pas un avis médical.',
      'Gratuite et indépendante.',
      'Faite par une seule personne.',
    ]) {
      expect(screen.getByText(resume)).toBeDefined()
    }
    for (const bouton of screen.getAllByText('Lire')) {
      expect(bouton.closest('button')!.getAttribute('aria-expanded')).toBe('false')
    }
  })

  it('rend le détail lisible AVANT d’accepter — sinon ce n’est pas un consentement', async () => {
    await monterAccueil()
    fireEvent.click(screen.getByText('Une aide pour cuisiner, pas un avis médical.'))
    expect(screen.getByText(/ne pose aucun diagnostic/)).toBeDefined()
    // Et le bouton de validation est toujours désactivé : on peut lire sans avoir rien accepté.
    expect(desactive('J’ai compris')).toBe(true)
  })

  it('n’avance pas tant que la case n’est pas cochée', async () => {
    await monterAccueil()
    expect(desactive('J’ai compris')).toBe(true)
    clic('J’ai lu et compris')
    await waitFor(() => expect(desactive('J’ai compris')).toBe(false))
  })
})

describe('accueil — revenir en arrière', () => {
  it('⛔ NE DÉCOCHE PAS le consentement en revenant à l’étape 1', async () => {
    // LE DÉFAUT QUE CE TEST GARDE. `compris` était un état local d'`Engagement` ; revenir le
    // remettait à faux, le bouton se redésactivait, et le parcours était bloqué.
    await monterAccueil()
    await allerAuxAllergies()

    clic(RETOUR)
    // Le retour traverse l'installation avant l'engagement — c'est le pas ajouté.
    await screen.findByRole('heading', { name: 'Installez l’application sur votre écran d’accueil' })
    clic(RETOUR)
    await screen.findByRole('heading', { name: 'Bienvenue' })

    expect(presse('J’ai lu et compris')).toBe('true')
    expect(desactive('J’ai compris')).toBe(false)
  })

  it('conserve les allergies cochées quand on revient depuis le rythme', async () => {
    await monterAccueil()
    await allerAuxAllergies()
    clic('Gluten')
    clic('Continuer')

    await screen.findByRole('heading', { name: 'Votre rythme' })
    clic(RETOUR)

    await screen.findByRole('heading', { name: 'Des allergies ?' })
    expect(presse('Gluten')).toBe('true')
  })

  it('n’offre AUCUN retour à la première étape — il n’y a rien derrière', async () => {
    await monterAccueil()
    expect(screen.queryByText(RETOUR)).toBeNull()
  })
})

describe('accueil — l’étape d’installation est activée', () => {
  it('l’engagement mène à « Installez l’application », et « Plus tard » aux allergies', async () => {
    // Réactivée le 2026-08-02, à la demande de l'utilisateur, par `ETAPE_INSTALLATION` dans
    // accueil.tsx.
    //
    // ⚠️ Le jour où l'étape est de nouveau désactivée, c'est ce test qui doit tomber — et c'est
    // voulu. Un parcours d'introduction qui change de longueur sans que rien ne le signale est
    // exactement le genre de modification qu'on découvre en production.
    await monterAccueil()
    await passerLEngagement()

    expect(screen.getByText(/Installez l’application/)).toBeDefined()
    clic('Plus tard')
    await screen.findByRole('heading', { name: 'Des allergies ?' })
  })
})

describe('accueil — ce qui part réellement en base', () => {
  it('écrit allergies et régime à la toute fin, jamais avant', async () => {
    let termine = false
    await monterAccueil(() => {
      termine = true
    })
    await allerAuxAllergies()
    clic('Gluten')
    clic('Végétarien')
    // ⚠️ RIEN N'EST ÉCRIT À MI-PARCOURS : un parcours abandonné ne doit pas laisser une application
    // à moitié configurée — c'est-à-dire, sur ce filtre, une application qui protège à moitié.
    expect(readAllergies(baseCourante())).toEqual([])

    clic('Continuer')
    await screen.findByRole('heading', { name: 'Votre rythme' })
    clic('C’est parti')

    await waitFor(() => expect(termine).toBe(true))
    expect(readAllergies(baseCourante()).map((a) => a.allergenId)).toEqual(['gluten'])
    expect(readDiet(baseCourante())).toBe('vegetarien')
  })

  it('⛔ N’EFFACE PAS les allergies déjà déclarées quand le parcours se rouvre', async () => {
    // Le scénario exact : une nouvelle version du texte de consentement rouvre l'accueil pour
    // quelqu'un qui utilise l'application depuis des mois. Il traverse sans rien toucher.
    writeAllergies(baseCourante(), [{ allergenId: 'arachides' as AllergenId, severite: null }])
    writeDiet(baseCourante(), 'pescetarien')

    let termine = false
    await monterAccueil(() => {
      termine = true
    })
    await allerAuxAllergies()
    // Pré-coché : c'est ce qui prouve que l'écran est parti de l'existant.
    expect(presse('Arachides')).toBe('true')

    clic('Continuer')
    await screen.findByRole('heading', { name: 'Votre rythme' })
    clic('C’est parti')

    await waitFor(() => expect(termine).toBe(true))
    expect(readAllergies(baseCourante()).map((a) => a.allergenId)).toEqual(['arachides'])
    expect(readDiet(baseCourante())).toBe('pescetarien')
  })
})
