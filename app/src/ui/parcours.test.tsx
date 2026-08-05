// @vitest-environment jsdom
//
// ui/parcours.test.tsx — l'invariant qui empêche un tutoriel fantôme.
//
// ⚠️ CE QUE `parcours.ts` DIT DANS SON EN-TÊTE : une étape dont la cible n'existe pas est
// silencieusement sautée, et si AUCUNE ne résout, la visite se termine sans rien afficher — sans
// erreur, sans test rouge, sans trace. C'est le mode de défaillance de ce fichier, et il est
// invisible depuis l'écran. Les tests ci-dessous existent pour ça, et RIEN d'autre.
//
// ⚠️ TOUT DÉRIVE DE `PARCOURS`, JAMAIS D'UNE LISTE RECOPIÉE ICI — un neuvième parcours ajouté à la
// table doit être couvert sans toucher ce fichier. Chaque `it.each` porte une garde explicite contre
// le tableau vide (`it.each([])` ne produit AUCUN test et laisse la suite verte sans avoir rien
// vérifié).
//
// ⚠️ « AU MOINS UNE ÉTAPE RÉSOUT » N'EST PAS « TOUTES LES ÉTAPES RÉSOLVENT ». Sur un compte neuf,
// Courses n'a pas de liste, le frigo est vide : une étape conditionnelle sautée est correcte et
// voulue (voir `parcours.ts`). Le seul invariant vérifiable ICI est que le titre de l'écran —
// l'étape INCONDITIONNELLE que chaque parcours doit ouvrir — résout toujours, ce qui se voit par
// l'apparition d'un `role="dialog"`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { JSX } from 'react'
import { PARCOURS, etapesDuParcours } from './parcours.js'
import { findBannedTerms } from '../engine/guards/banned-terms.js'
import { Visite } from './visite.js'
import { hashDe, hashDesParametres, hashDeLEditeur, hashDuFrigo } from './router.js'
import { catalogueDeTest, reinitialiserBase, sessionDeTest, confianceDeTest} from './test-socle.js'

vi.mock('./catalog-source.js', () => ({
  chargerCatalogue: () => Promise.resolve(catalogueDeTest()),
  chargerConfiance: () => Promise.resolve(confianceDeTest()),
}))
vi.mock('./user-source.js', () => ({
  ouvrirUserDb: () => Promise.resolve(sessionDeTest()),
  surErreurDePersistance: () => undefined,
}))

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
})
afterEach(cleanup)

/**
 * L'écran RÉEL de chaque hash de parcours — le même composant que `main.tsx` monte, pas une
 * maquette. Les écrans posent tous un `<LienTutoriel>`, d'où l'obligation de monter sous
 * `ProvenanceLancerParcours` (voir `ui/lancer-parcours.tsx`), même raison que les tests d'écran.
 */
const ECRAN_DE: Readonly<Record<string, () => Promise<() => JSX.Element>>> = {
  [hashDe('aujourdhui')]: async () => (await import('./screens/aujourdhui.js')).Aujourdhui,
  [hashDe('semaine')]: async () => (await import('./screens/semaine.js')).Semaine,
  [hashDe('courses')]: async () => (await import('./screens/courses.js')).Courses,
  [hashDe('recettes')]: async () => (await import('./screens/recettes.js')).Recettes,
  [hashDe('savoir')]: async () => (await import('./screens/savoir.js')).Savoir,
  [hashDuFrigo()]: async () => (await import('./screens/frigo.js')).Frigo,
  [hashDeLEditeur(null)]: async () => {
    const { EditeurRecette } = await import('./screens/editeur-recette.js')
    return () => <EditeurRecette baseId={null} />
  },
  [hashDesParametres()]: async () => (await import('./screens/parametres.js')).Parametres,
}

/**
 * Monte l'écran d'un parcours dans l'état d'un utilisateur NEUF — base réinitialisée en
 * `beforeEach`, aucun plan, garde-manger vide : exactement le cas que l'en-tête de `parcours.ts`
 * demande de vérifier.
 *
 * ⚠️ `ProvenanceLancerParcours` IMPORTÉ DYNAMIQUEMENT ICI, PAS EN TÊTE DE FICHIER — `beforeEach`
 * appelle `vi.resetModules()` : un import statique figerait un `Context` React d'AVANT la
 * réinitialisation, distinct de celui que l'écran (importé dynamiquement via `ECRAN_DE`) utilise
 * réellement dans son `<LienTutoriel>` — `useLancerParcours()` lèverait malgré ce provider monté.
 */
async function monterEcran(ecran: string): Promise<void> {
  const composantDe = ECRAN_DE[ecran]
  if (composantDe === undefined) throw new Error(`Aucun écran de test pour « ${ecran} »`)
  const Composant = await composantDe()
  const { ProvenanceLancerParcours } = await import('./lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Composant />
    </ProvenanceLancerParcours>
  )
  await screen.findByRole('heading', { level: 1 })
}

describe('parcours — invariant central : au moins une étape résout toujours', () => {
  const avecEcran = PARCOURS.filter((p): p is typeof p & { ecran: string } => p.ecran !== null)

  it('la table n’est pas vide, et au moins un parcours appartient à un écran', () => {
    expect(PARCOURS.length).toBeGreaterThan(0)
    expect(avecEcran.length).toBeGreaterThan(0)
  })

  it.each(avecEcran.map((p) => [p.id, p.ecran] as const))(
    'le parcours « %s » affiche au moins une bulle sur un écran neuf (%s)',
    async (id, ecran) => {
      await monterEcran(ecran)
      render(<Visite etapes={etapesDuParcours(id)} onTerminer={() => undefined} />)
      expect(screen.getByRole('dialog')).toBeDefined()
    }
  )
})

describe('parcours — aucune cible générique', () => {
  // `article[data-visite=…]` est légitime, `article` seul ne l'est pas — voir l'en-tête de
  // `parcours.ts` : ces sélecteurs nus existent sur plusieurs écrans, et le premier du document
  // gagnerait.
  const CIBLES_INTERDITES = new Set([
    'article',
    'section',
    'fieldset',
    'div',
    'input[type="search"]',
    '[role="status"]',
    'h1',
  ])

  const toutesLesEtapes = PARCOURS.flatMap((p) => p.etapes.map((e) => [p.id, e.titre, e.cible] as const))

  it('au moins une étape existe dans la table (sinon ce test ne vérifie rien)', () => {
    expect(toutesLesEtapes.length).toBeGreaterThan(0)
  })

  it.each(toutesLesEtapes)('%s / « %s » : la cible « %s » n’est pas générique', (_id, _titre, cible) => {
    expect(CIBLES_INTERDITES.has(cible)).toBe(false)
  })
})

/**
 * ⚠️ CE TEST MANQUAIT, ET LE TROU ÉTAIT RÉEL. §6.2 ARCHITECTURE bannit deux familles de vocabulaire
 * de TOUTE chaîne affichée par l'application. Le build lint le contenu du catalogue,
 * `texte-consentement.test.ts` lint la page de bienvenue — mais les textes de tutoriel n'étaient
 * relus par rien, alors que le parcours « Savoir » décrit précisément le contenu que §6 encadre.
 *
 * ⚠️ LA CORRESPONDANCE EST UNE SOUS-CHAÎNE APRÈS RETRAIT DES ACCENTS : « traitement », « traité »,
 * « retraite » et « soigneusement » déclenchent tous le refus par « traite » ou « soigne ». Ce n'est
 * pas un faux positif à contourner, c'est la garantie qui rend le lexique impossible à ruser.
 */
describe('parcours — le lexique banni de §6.2', () => {
  const textes = PARCOURS.flatMap((p) =>
    p.etapes.flatMap((e) => [
      [p.id, `titre : ${e.titre}`, e.titre] as const,
      [p.id, `texte : ${e.titre}`, e.texte] as const,
    ])
  )

  it('au moins un texte existe dans la table (sinon ce test ne vérifie rien)', () => {
    expect(textes.length).toBeGreaterThan(0)
  })

  it.each(textes)('%s / %s ne contient aucun terme banni', (_id, _quoi, texte) => {
    expect(findBannedTerms(texte)).toEqual([])
  })

  it('les titres de parcours eux-mêmes sont propres', () => {
    for (const p of PARCOURS) expect(findBannedTerms(p.titre)).toEqual([])
  })
})

describe('parcours — identité de la table', () => {
  it('chaque id de PARCOURS est unique', () => {
    const ids = PARCOURS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('chaque écran non nul est unique', () => {
    const ecrans = PARCOURS.map((p) => p.ecran).filter((e): e is string => e !== null)
    expect(new Set(ecrans).size).toBe(ecrans.length)
  })
})

describe('parcours — etapesDuParcours sur un id inconnu', () => {
  it('rend un tableau vide, ne lève jamais', () => {
    expect(() => etapesDuParcours('inexistant')).not.toThrow()
    expect(etapesDuParcours('inexistant')).toEqual([])
  })
})

describe('parcours — cohérence des étapes « clic »', () => {
  // Une étape `clic` dont `attendu.cible` diffère de `etape.cible` est suspecte : c'est la BULLE qui
  // désigne un élément (`etape.cible`), et c'est CE MÊME élément qui doit débloquer l'étape
  // (`attendu.cible`) — les faire diverger désignerait une chose et en attendrait une autre.
  const etapesClic = PARCOURS.flatMap((p) =>
    p.etapes.filter((e) => e.attendu.type === 'clic').map((e) => [p.id, e.titre, e] as const)
  )

  it('au moins une étape « clic » existe dans la table (sinon ce test ne vérifie rien)', () => {
    expect(etapesClic.length).toBeGreaterThan(0)
  })

  it.each(etapesClic)('%s / « %s » : la cible attendue est la cible désignée', (_id, _titre, etape) => {
    if (etape.attendu.type !== 'clic') throw new Error('garde de type — ne devrait jamais arriver ici')
    expect(etape.attendu.cible).toBe(etape.cible)
  })
})
