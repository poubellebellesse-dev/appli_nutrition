// @vitest-environment jsdom
//
// tests/scelles/65b-ecran.test.tsx — l'examen du lot 65b : ce que l'écran ÉCRIT et ce qu'il REFUSE.
//
// ⛔ SÉPARÉ DE `65b.test.ts` PARCE QUE L'ENVIRONNEMENT SE CHOISIT PAR FICHIER — même découpage que
// `65a.test.ts` / `65a-ecran.test.tsx`, et pour la même raison. Ce n'est pas du confort.
//
// ⛔ IL DOIT ÊTRE ROUGE LE JOUR OÙ ON L'ÉCRIT. L'écran de matériel n'existe pas : à ce jour,
// `writeOwnedEquipmentIds` n'a AUCUN appelant de production, seul son test unitaire l'appelle.
//
// ---------------------------------------------------------------------------------------------
// CE QU'IL GARDE, ET CE QU'IL SE REFUSE À GARDER
//
// ⛔ ON LIT CE QUE LA BASE CONTIENT, JAMAIS CE QUE LE DOM AFFICHE. Une case cochée qui n'écrit rien
// est précisément le défaut que ce projet a déjà payé trois fois (« un champ déclaré n'est pas un
// champ branché »). Le test clique, puis relit `user.db` par un AUTRE chemin. Cocher ne prouve rien.
//
// ⛔ ET ON NE LIT PAS LE SOURCE DU FICHIER. Un `critique` a fait passer la première version des
// tests du lot E en ajoutant une ligne d'`import` jamais appelée. Aucune expression régulière sur
// un fichier ici.
//
// ⚠️ LA FORMULATION EXACTE APPARTIENT AU LOT, PAS AU SCEAU. Ce fichier n'impose aucune phrase. Il
// impose trois choses observables : le terme du référentiel comme libellé (« Four », pas `four`),
// `role="switch"` pour l'interrupteur — c'est le rôle ARIA d'un réglage à deux états, et un test qui
// n'exigerait rien laisserait passer un `div` cliquable —, et le NOMBRE 271 dans l'avertissement.
//
// ⚠️ 271 N'EST PAS UN NOMBRE DÉCORATIF. C'est le compte, mesuré sur `catalog.db` réel, des recettes
// qui disparaîtraient si l'on allumait le filtre sans rien cocher : il en resterait 59 sur 330. Un
// avertissement qui ne le dit pas ne prévient de rien. Le même nombre est scellé dans `65b.test.ts`,
// par un chemin SQL indépendant de l'écran.
//
// ⚠️ LE GARDE-FOU DOIT DISCRIMINER, SINON CE N'EST PAS UN GARDE-FOU. Un écran qui ouvrirait la
// fenêtre à chaque bascule passerait un test qui se contenterait de la voir apparaître. D'où le test
// négatif : avec un ustensile coché, la bascule allume DIRECTEMENT, sans fenêtre.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import {
  baseCourante,
  catalogueDeTest,
  confianceDeTest,
  reinitialiserBase,
  sessionDeTest,
} from '../../app/src/ui/test-socle.js'
import { readOwnedEquipmentIds } from '../../app/src/data/user-store.js'
import type { UserDb } from '../../app/src/data/user-db.js'
import type { EquipmentId } from '../../app/src/engine/domain/index.js'

vi.mock('../../app/src/ui/catalog-source.js', () => ({
  chargerCatalogue: () => Promise.resolve(catalogueDeTest()),
  chargerConfiance: () => Promise.resolve(confianceDeTest()),
}))
vi.mock('../../app/src/ui/user-source.js', () => ({
  ouvrirUserDb: () => Promise.resolve(sessionDeTest()),
  surErreurDePersistance: () => undefined,
  octetsDeLaBase: vi.fn(),
  remplacerLeFichier: vi.fn(),
  verifierSauvegarde: vi.fn(),
}))

/** Recettes qui disparaîtraient si le filtre s'allumait sans qu'un seul ustensile soit coché. */
const ECARTEES_SANS_RIEN = 271

/** Le libellé du four vient du RÉFÉRENTIEL, pas d'une chaîne en dur : c'est « Four ». */
function termeDuFour(): string {
  const four = [...catalogueDeTest().equipment.values()].find((e) => e.code === 'four')
  expect(four, 'le code `four` est absent du référentiel').toBeDefined()
  return four!.terme
}

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
})
afterEach(cleanup)

async function monter(): Promise<void> {
  const { Parametres } = await import('../../app/src/ui/screens/parametres.js')
  const { ProvenanceLancerParcours } = await import('../../app/src/ui/lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Parametres />
    </ProvenanceLancerParcours>,
  )
  await waitFor(() => {
    if (document.querySelector('h1') === null) throw new Error('écran pas encore monté')
  })
}

/**
 * Ouvre le panneau du matériel depuis sa ligne des Paramètres et rend les requêtes SCOPÉES.
 *
 * ⚠️ SCOPE OBLIGATOIRE : la ligne ouvrante reste montée SOUS le panneau, et son résumé peut porter
 * le même texte qu'un champ à l'intérieur — le piège documenté en tête de `parametres.test.tsx`.
 */
function ouvrirLeMateriel(): ReturnType<typeof within> {
  fireEvent.click(screen.getByText(/Matériel/i))
  return within(screen.getByRole('dialog'))
}

/** L'interrupteur, par son RÔLE : un réglage à deux états, pas un bouton quelconque. */
function interrupteur(scope: ReturnType<typeof within>): HTMLElement {
  return scope.getByRole('switch')
}

/** Lu en base, jamais dans le DOM. */
function materielEnBase(db: UserDb = baseCourante()): readonly EquipmentId[] | null {
  return readOwnedEquipmentIds(db)
}

async function filtreEnBase(db: UserDb = baseCourante()): Promise<boolean> {
  const store = (await import('../../app/src/data/user-store.js')) as {
    readonly readFiltreEquipement?: (db: UserDb) => boolean
  }
  expect(
    typeof store.readFiltreEquipement,
    'user-store.ts n’exporte pas readFiltreEquipement — le lot 65b n’est pas fait',
  ).toBe('function')
  return store.readFiltreEquipement!(db)
}

// ==============================================================================================

describe('65b — clause 7 : l’écran écrit vraiment dans la base', () => {
  it('les Paramètres portent une ligne « Matériel » qui ouvre une fenêtre', async () => {
    await monter()
    const panneau = ouvrirLeMateriel()
    // Les 30 ustensiles du référentiel, nommés par leur terme — pas par leur code.
    expect(panneau.getByText(termeDuFour())).toBeDefined()
  })

  it('cocher le four l’écrit dans `user_equipment`, et relire la base le confirme', async () => {
    await monter()
    expect(materielEnBase()).toBeNull()

    const panneau = ouvrirLeMateriel()
    fireEvent.click(panneau.getByText(termeDuFour()))

    await waitFor(() => {
      expect(materielEnBase()).toEqual(['four'])
    })
  })

  it('décocher le retire — la déclaration se défait, elle ne s’empile pas', async () => {
    await monter()
    const panneau = ouvrirLeMateriel()

    fireEvent.click(panneau.getByText(termeDuFour()))
    await waitFor(() => {
      expect(materielEnBase()).toEqual(['four'])
    })

    fireEvent.click(panneau.getByText(termeDuFour()))
    await waitFor(() => {
      // ⚠️ `null` ET NON `[]` : `readOwnedEquipmentIds` ne sait pas dire « déclaré vide », et c'est
      // l'interrupteur qui porte désormais cette distinction. Voir la clause 4 de `65b.test.ts`.
      expect(materielEnBase()).toBeNull()
    })
  })
})

describe('65b — clause 8 : le garde-fou de vide', () => {
  it('l’interrupteur naît ÉTEINT et ne s’allume pas tout seul', async () => {
    await monter()
    const panneau = ouvrirLeMateriel()

    expect(interrupteur(panneau).getAttribute('aria-checked')).toBe('false')
    expect(await filtreEnBase()).toBe(false)
  })

  it('l’allumer sans rien avoir coché PRÉVIENT AVANT, en annonçant les 271 recettes', async () => {
    await monter()
    const panneau = ouvrirLeMateriel()
    fireEvent.click(interrupteur(panneau))

    // Une fenêtre, pas un menu — la règle du dépôt, et le texte porte le NOMBRE.
    await waitFor(() => {
      const fenetres = screen.getAllByRole('dialog')
      const avertissement = fenetres.map((f) => f.textContent ?? '').join(' ')
      expect(avertissement).toContain(String(ECARTEES_SANS_RIEN))
    })
  })

  it('et TANT QUE personne n’a confirmé, le filtre reste éteint en base', async () => {
    await monter()
    const panneau = ouvrirLeMateriel()
    fireEvent.click(interrupteur(panneau))

    await waitFor(() => {
      expect(screen.getAllByRole('dialog').length).toBeGreaterThan(1)
    })
    // ⛔ LE CŒUR DE LA CLAUSE. Un écran qui écrirait d'abord et demanderait ensuite aurait déjà
    // retiré 271 recettes au moment où la question s'affiche.
    expect(await filtreEnBase()).toBe(false)
  })

  it('avec un ustensile coché, la bascule allume DIRECTEMENT — le garde-fou discrimine', async () => {
    // ⛔ SANS CE TEST, UNE FENÊTRE OUVERTE À CHAQUE BASCULE PASSERAIT POUR UN GARDE-FOU.
    await monter()
    const panneau = ouvrirLeMateriel()

    fireEvent.click(panneau.getByText(termeDuFour()))
    await waitFor(() => {
      expect(materielEnBase()).toEqual(['four'])
    })

    fireEvent.click(interrupteur(panneau))
    await waitFor(async () => {
      expect(await filtreEnBase()).toBe(true)
    })
  })
})
