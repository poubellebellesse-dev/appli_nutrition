// @vitest-environment jsdom
//
// tests/scelles/retour-1b.test.tsx — l'examen du lot `retour-1b` : UN tutoriel qui traverse les
// menus en entrant dans chacun, au lieu de neuf tutoriels séparés.
//
// ⛔ IL DOIT ÊTRE ROUGE LE JOUR OÙ ON L'ÉCRIT. Aujourd'hui l'invitation de fin d'intro lance
// `'menus'` (`main.tsx:178`), un parcours de CINQ étapes qui nomme les onglets sans jamais entrer
// dedans. Aucun parcours composé n'existe, et aucune étape ne demande de toucher « Aujourd'hui » —
// son absence est même écrite dans `ui/parcours.ts` comme une décision, que ce lot renverse.
//
// ---------------------------------------------------------------------------------------------
// COMMENT CE FICHIER SE DÉFEND
//
// ⛔ ON JOUE LE TUTORIEL, ON NE LIT PAS LA TABLE. Quatre des cinq clauses montent la coquille RÉELLE
// (`ui/main.tsx`, importée comme le font déjà `main.test.tsx:52` et `main-accessibilite.test.tsx:78`),
// traversent l'intro, répondent « Oui » et avancent bulle après bulle. Un parcours composé qui ne
// serait qu'une entrée de plus dans `PARCOURS` ne ferait passer aucune d'elles.
//
// ⛔ ON CLIQUE LES VRAIS LIENS DE LA BARRE D'ONGLETS. Le test ne choisit jamais sa destination : il
// prend le `href` du lien que la bulle désigne. ⚠️ MESURÉ LE 2026-08-21 : en jsdom, cliquer un
// `<a href="#/semaine">` met bien à jour `location.hash` mais **n'émet AUCUN `hashchange`**, que
// `useRoute()` est pourtant seul à écouter. Le pilote réveille donc jsdom à la main, exactement comme
// `visite.test.tsx:54-55` et `main-accessibilite.test.tsx:66-67`. Ce n'est pas la triche interdite :
// si la bulle désignait un autre onglet, le test irait ailleurs et échouerait.
//
// ⛔ LE PILOTE NE CONNAÎT PAS LE SCÉNARIO. Il ne sait pas dans quel ordre les écrans viennent : il
// lit la bulle affichée, retrouve l'étape par son titre DANS LE COMPOSÉ, et exécute le geste qu'elle
// déclare. Un enchaînement dans un autre ordre serait joué sans broncher — et échouerait sur ce
// qu'il relève, qui est la seule chose affirmée.
//
// ⛔ IL RELÈVE TROIS CHOSES PAR BULLE, PAS UNE : ce qu'elle DIT, ce qu'elle DÉSIGNE, et OÙ L'ON EST.
// Les titres seuls ne suffisaient pas. `visite.tsx` peut légitimement être touché par ce lot, et
// desserrer `premierIndexValide` pour qu'il n'écarte plus rien ferait défiler les 29 étapes avec des
// bulles pointant dans le VIDE — cinq ouvertures affichées, compteur à 29, six clauses vertes, et un
// garde-fou supprimé au lieu d'être remplacé. La clause 6 ferme ça.
//
// ⚠️ CE QUE LA CLAUSE 3 NE PROUVE PAS, ET IL FAUT LE SAVOIR. `router.tsx:371` pose
// `ROUTE_PAR_DEFAUT = { onglet: 'aujourdhui' }` : l'écran Aujourd'hui est DÉJÀ monté quand le
// tutoriel démarre. La transition « touchez Aujourd'hui » ne traverse donc JAMAIS le risque de course
// que le brief décrit — elle ne teste que la FORME du geste. C'est la clause 1 qui traverse la
// course, quatre fois : Semaine, Courses, Recettes et Savoir, eux, ne sont pas montés.
//
// ⛔ IDENTITÉ D'OBJET, PAS ÉGALITÉ (clause 4). `toBe` et non `toEqual` : recopier les textes dans un
// parcours composé passerait un `toEqual` et divergerait au premier lot de contenu.
//
// ⚠️ IMPORTS DYNAMIQUES APRÈS `vi.resetModules()`, ET C'EST INDISPENSABLE À LA CLAUSE 4. Un
// `import` statique de `parcours.js` rendrait des objets d'une AUTRE instance de module que celle
// que la coquille utilise, et tous les `toBe` échoueraient pour une raison qui n'a rien à voir avec
// le lot.
//
// ⚠️ UNE ÉTAPE CONDITIONNELLE SAUTÉE N'EST PAS UN ÉCHEC. Sur un compte neuf, Courses n'a pas de
// liste et aucune semaine n'est composée : `ui/parcours.ts` écrit que ces sauts-là sont voulus. Ce
// fichier n'affirme que sur les étapes d'OUVERTURE d'écran, inconditionnelles par la règle 1 de
// `parcours.ts` et déjà verrouillées par `parcours.test.tsx`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { EtapeVisite } from '../../app/src/ui/visite.js'
import {
  catalogueDeTest,
  confianceDeTest,
  reinitialiserBase,
  sessionDeTest,
} from '../../app/src/ui/test-socle.js'

vi.mock('../../app/src/ui/catalog-source.js', () => ({
  chargerCatalogue: () => Promise.resolve(catalogueDeTest()),
  chargerConfiance: () => Promise.resolve(confianceDeTest()),
}))
vi.mock('../../app/src/ui/user-source.js', () => ({
  ouvrirUserDb: () => Promise.resolve(sessionDeTest()),
  surErreurDePersistance: () => undefined,
}))

/** `cleanup()` ne démonte pas la racine créée à l'import de `main.tsx` — voir `main.test.tsx:31`. */
let demonter: (() => void) | null = null

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
  document.body.innerHTML = '<div id="root"></div>'
  window.location.hash = ''
})
afterEach(() => {
  demonter?.()
  demonter = null
  cleanup()
  window.location.hash = ''
})

// --- Le harnais ---------------------------------------------------------------------------------

/** Les cinq étapes d'ouverture d'écran, dans l'ordre que le « Fini quand » exige. */
const OUVERTURES = [
  'Une idée à la fois',
  'Toute la semaine d’un coup',
  'La liste se fait toute seule',
  'Chercher, pas se faire proposer',
  'Pour comprendre, pas pour décider à votre place',
] as const

/** Les deux bornes, nommées — un index calculé rendrait `string | undefined`. */
const [PREMIERE_OUVERTURE, , , , DERNIERE_OUVERTURE] = OUVERTURES

const clic = (texte: string | RegExp) => fireEvent.click(screen.getByText(texte))

const desactive = (texte: string): boolean =>
  (screen.getByText(texte).closest('button') as HTMLButtonElement).disabled

/** Laisse React vider ses effets et ses promesses. */
async function respirer(fois = 3): Promise<void> {
  for (let i = 0; i < fois; i++) {
    await act(async () => {
      await Promise.resolve()
    })
  }
}

/**
 * La bulle de la visite : le seul `role="dialog"` qui porte un compteur « Étape N sur M ».
 * `null` quand la visite est finie ou pas encore lancée.
 */
function bulle(): HTMLElement | null {
  for (const dialogue of screen.queryAllByRole('dialog')) {
    if (/Étape\s+\d+\s+sur\s+\d+/.test(dialogue.textContent ?? '')) return dialogue
  }
  return null
}

/** Le compteur affiché, tel quel : `[index affiché, total affiché]`. */
function compteur(): readonly [number, number] {
  const d = bulle()
  if (d === null) throw new Error('aucune bulle de visite affichée')
  const m = /Étape\s+(\d+)\s+sur\s+(\d+)/.exec(d.textContent ?? '')
  if (m === null) throw new Error('compteur illisible')
  return [Number(m[1]), Number(m[2])]
}

const titreAffiche = (): string | null => bulle()?.getAttribute('aria-label') ?? null

/** Monte la coquille, traverse l'intro, accepte l'invitation. Copié de `main.test.tsx`. */
async function monterEtLancerLeTutoriel(): Promise<void> {
  const { racine } = await import('../../app/src/ui/main.js')
  demonter = () => act(() => racine.unmount())
  await screen.findByRole('heading', { name: 'Bienvenue' })

  clic('J’ai lu et compris')
  await waitFor(() => expect(desactive('J’ai compris')).toBe(false))
  clic('J’ai compris')

  // jsdom n'émet jamais `beforeinstallprompt` : seul « Plus tard » permet d'avancer.
  await screen.findByRole('heading', { name: 'Installez l’application sur votre écran d’accueil' })
  clic('Plus tard')

  await screen.findByRole('heading', { name: 'Des allergies ?' })
  clic('Continuer')

  await screen.findByRole('heading', { name: 'Votre rythme' })
  clic('C’est parti')

  await screen.findByRole('dialog', { name: 'Une visite guidée ?' })
  clic('Oui, je découvre')
  await respirer()
}

/**
 * Le geste que l'étape déclare, exécuté sur le VRAI DOM de l'application. Rend `false` si la cible
 * n'est pas là — le pilote s'arrête alors, plutôt que de tourner en rond.
 */
async function faireLeGeste(etape: EtapeVisite): Promise<boolean> {
  const selecteur =
    etape.attendu.type === 'clic'
      ? etape.attendu.cible
      : etape.attendu.type === 'route'
        ? `a[href="${etape.attendu.hash}"]`
        : null
  if (selecteur === null) return false
  const cible = document.querySelector(selecteur)
  if (cible === null) return false

  await act(async () => {
    fireEvent.click(cible)
  })
  // ⚠️ LE RÉVEIL DE jsdom, ET RIEN D'AUTRE : le clic ci-dessus a DÉJÀ posé `location.hash` depuis le
  // `href` du lien. Voir l'en-tête — la destination ne vient jamais du test.
  if (etape.attendu.type === 'route') {
    await act(async () => {
      fireEvent(window, new Event('hashchange'))
    })
  }
  await respirer()
  return true
}

/** Ce que le pilote relève à chaque bulle : ce qu'elle DIT, ce qu'elle DÉSIGNE, et OÙ l'on est. */
interface Observation {
  readonly titre: string
  readonly cible: string
  readonly ciblePresente: boolean
  readonly hash: string
}

/**
 * L'étape du COMPOSÉ que la bulle affiche, retrouvée par son titre.
 *
 * ⛔ DANS LE COMPOSÉ SEUL, JAMAIS DANS LA TABLE ENTIÈRE — et c'est une correction, pas une
 * précaution. Deux étapes du dépôt portent DÉJÀ le même titre exact, « Partir de ce que vous avez »
 * (`parcours.ts:170`, cible `a[href="#/frigo"]`, et `parcours.ts:289`, cible
 * `[data-visite="titre-frigo"]`), avec des cibles DIFFÉRENTES. Chercher dans toute la table rendrait
 * la mauvaise, et le test échouerait pour une raison de harnais, sans rapport avec le lot.
 */
function etapeDeLaBulle(titre: string, etapes: readonly EtapeVisite[]): EtapeVisite {
  const trouvees = etapes.filter((e) => e.titre === titre)
  if (trouvees.length === 0) throw new Error(`bulle affichée pour une étape absente du composé : « ${titre} »`)
  if (trouvees.length > 1) throw new Error(`titre ambigu dans le composé : « ${titre} »`)
  return trouvees[0] as EtapeVisite
}

/**
 * Joue le tutoriel comme un utilisateur et relève, bulle après bulle, ce qu'elle dit, ce qu'elle
 * désigne et où l'on est. Borné : un enchaînement qui boucle échoue par la borne, jamais par un
 * test qui pend.
 */
async function jouerLeTutoriel(etapes: readonly EtapeVisite[]): Promise<readonly Observation[]> {
  const vues: Observation[] = []
  for (let garde = 0; garde < 120; garde++) {
    const d = bulle()
    if (d === null) break
    const titre = d.getAttribute('aria-label') ?? ''
    const etape = etapeDeLaBulle(titre, etapes)
    if (vues[vues.length - 1]?.titre !== titre) {
      vues.push({
        titre,
        cible: etape.cible,
        ciblePresente: document.querySelector(etape.cible) !== null,
        hash: window.location.hash,
      })
    }

    const suivant = within(d).queryByRole('button', { name: /Suivant/ })
    if (suivant !== null) {
      await act(async () => {
        fireEvent.click(suivant)
      })
      await respirer()
      continue
    }

    if (!(await faireLeGeste(etape))) break
  }
  return vues
}

/**
 * Le parcours composé, trouvé par ce qu'il FAIT et non par son nom : le seul qui porte à la fois
 * l'étape d'ouverture d'Aujourd'hui et celle de Savoir. Le lot reste libre de l'identifiant.
 */
async function trouverCompose(): Promise<
  { readonly id: string; readonly etapes: readonly EtapeVisite[] } | undefined
> {
  const { PARCOURS, etapesDuParcours } = await import('../../app/src/ui/parcours.js')
  const ouvreAujourdhui = etapesDuParcours('aujourdhui')[0]
  const ouvreSavoir = etapesDuParcours('savoir')[0]
  const compose = PARCOURS.find(
    (p) =>
      p.id !== 'aujourdhui' &&
      p.id !== 'savoir' &&
      ouvreAujourdhui !== undefined &&
      ouvreSavoir !== undefined &&
      p.etapes.includes(ouvreAujourdhui) &&
      p.etapes.includes(ouvreSavoir)
  )
  return compose
}

/** Le composé, ou un échec de test lisible plutôt qu'un `undefined` qui explose trois lignes plus bas. */
async function etapesDuCompose(): Promise<readonly EtapeVisite[]> {
  const compose = await trouverCompose()
  expect(compose).toBeDefined()
  return (compose as { readonly etapes: readonly EtapeVisite[] }).etapes
}

/**
 * Le parcours que l'application JOUE en ce moment, déduit de ce que la bulle affiche : son total et
 * le titre de son étape courante. À appeler juste après le lancement.
 *
 * ⛔ AUCUN NOM DE PARCOURS EN DUR, ET C'EST TOUT LE POINT. Le pilote ne doit pas savoir d'avance
 * quel tutoriel il joue — sinon il ne mesure plus rien. Il déduit, et si la déduction est ambiguë
 * il le dit au lieu de choisir.
 *
 * ⚠️ C'EST AUSSI CE QUI GARDE LE ROUGE DIAGNOSTIQUE. Faire dépendre les clauses de terrain de
 * l'EXISTENCE du composé les ferait toutes échouer aujourd'hui sur le même « expected undefined to
 * be defined » : un rouge exact et parfaitement muet, qui ne prouve pas qu'elles savent détecter
 * leur défaut. En jouant ce qui existe, la clause 1 montre ce qu'elle voit VRAIMENT.
 */
async function etapesJouees(): Promise<readonly EtapeVisite[]> {
  const { PARCOURS } = await import('../../app/src/ui/parcours.js')
  const [, total] = compteur()
  const titre = titreAffiche()
  const candidats = PARCOURS.filter(
    (p) => p.etapes.length === total && p.etapes.some((e) => e.titre === titre)
  )
  if (candidats.length !== 1) {
    throw new Error(`parcours joué non identifiable : total = ${total}, bulle = « ${titre} »`)
  }
  return (candidats[0] as { readonly etapes: readonly EtapeVisite[] }).etapes
}

// --- 1. L'enchaînement ne saute rien -------------------------------------------------------------

describe('retour-1b — l’enchaînement ne saute aucun écran', () => {
  it('affiche l’étape d’ouverture des CINQ écrans, dans l’ordre, en jouant le tutoriel', async () => {
    await monterEtLancerLeTutoriel()
    const vues = await jouerLeTutoriel(await etapesJouees())
    const ouverturesVues = vues.map((v) => v.titre).filter((t) => (OUVERTURES as readonly string[]).includes(t))

    // ▶ Ce qui rend la clause fausse : voir « Vos courses » là où « Toute la semaine d'un coup »
    //   est attendu, c'est-à-dire un écran traversé sans qu'une seule de ses étapes s'affiche.
    expect(ouverturesVues).toEqual([...OUVERTURES])
  })

  it('est RÉELLEMENT sur l’écran dont il montre l’ouverture', async () => {
    const { hashDe } = await import('../../app/src/ui/router.js')
    const ATTENDU = new Map<string, string>([
      [OUVERTURES[0], hashDe('aujourdhui')],
      [OUVERTURES[1], hashDe('semaine')],
      [OUVERTURES[2], hashDe('courses')],
      [OUVERTURES[3], hashDe('recettes')],
      [OUVERTURES[4], hashDe('savoir')],
    ])

    await monterEtLancerLeTutoriel()
    const vues = await jouerLeTutoriel(await etapesJouees())

    // ⛔ MONTRER L'OUVERTURE D'UN ÉCRAN SANS Y ÊTRE, C'EST LE MÊME DÉFAUT VU D'AILLEURS : les titres
    //    défileraient dans l'ordre du tableau pendant que l'application reste où elle était.
    const dessus = vues.filter((v) => ATTENDU.has(v.titre)).map((v) => [v.titre, v.hash] as const)
    expect(dessus).toEqual([...ATTENDU].map(([t, h]) => [t, h] as const))
  })

  it('ne se termine qu’APRÈS la dernière ouverture d’écran', async () => {
    await monterEtLancerLeTutoriel()
    const vus = (await jouerLeTutoriel(await etapesJouees())).map((v) => v.titre)
    const derniereOuverture = vus.lastIndexOf(DERNIERE_OUVERTURE)

    expect(derniereOuverture).toBeGreaterThanOrEqual(0)
    // Rien d'autre qu'une étape de Savoir ne peut suivre : le tutoriel s'arrête là.
    expect(vus.slice(0, derniereOuverture)).toContain(PREMIERE_OUVERTURE)
    expect(bulle()).toBeNull()
  })
})

// --- 2. Le premier lancement joue le composé -----------------------------------------------------

describe('retour-1b — le premier lancement joue le tutoriel qui traverse', () => {
  it('annonce « Étape 1 sur 29 » dès la première bulle', async () => {
    await monterEtLancerLeTutoriel()
    await screen.findByRole('dialog', { name: 'La navigation' })

    // ▶ Faux s'il annonce « sur 5 » : le tutoriel de première ouverture est resté celui de la barre
    //   d'onglets. 29 = 5 (menus) + 23 (les cinq écrans) + 1 (toucher Aujourd'hui).
    expect(compteur()).toEqual([1, 29])
  })
})

// --- 3. Une étape demande de toucher Aujourd'hui -------------------------------------------------

describe('retour-1b — l’étape « touchez Aujourd’hui »', () => {
  it('suit la navigation, attend le geste, et ouvre les étapes d’Aujourd’hui', async () => {
    const { hashDe } = await import('../../app/src/ui/router.js')
    await monterEtLancerLeTutoriel()
    await screen.findByRole('dialog', { name: 'La navigation' })

    const premiere = bulle()
    expect(premiere).not.toBeNull()
    fireEvent.click(within(premiere as HTMLElement).getByRole('button', { name: /Suivant/ }))
    await respirer()

    // Une étape à geste n'a PAS de « Suivant » (`attendGeste`, `ui/visite.tsx`) : sans ça, on
    // avancerait sans jamais toucher l'onglet, et le geste serait décoratif.
    const aGeste = bulle()
    expect(aGeste).not.toBeNull()
    expect(within(aGeste as HTMLElement).queryByRole('button', { name: /Suivant/ })).toBeNull()

    const lien = document.querySelector(`a[href="${hashDe('aujourdhui')}"]`)
    expect(lien).not.toBeNull()
    await act(async () => {
      fireEvent.click(lien as Element)
    })
    await act(async () => {
      fireEvent(window, new Event('hashchange'))
    })
    await respirer()

    expect(titreAffiche()).toBe(PREMIERE_OUVERTURE)
  })

  it('dit ce qu’elle demande, en toutes lettres', async () => {
    const { hashDe } = await import('../../app/src/ui/router.js')
    const etapes = await etapesDuCompose()
    const neuve = etapes.find(
      (e) => e.attendu.type === 'route' && e.attendu.hash === hashDe('aujourdhui')
    )

    // ▶ Faux si l'étape existe avec un texte de remplissage : `texte: 'x'` satisfait le comportement
    //   et n'apprend rien à personne. Le lexique et le ton, eux, sont déjà tenus par
    //   `ui/parcours.test.tsx`, qui balaie toute la table.
    expect(neuve).toBeDefined()
    const { titre, texte } = neuve as EtapeVisite
    expect(texte.length).toBeGreaterThan(30)
    expect(`${titre} ${texte}`).toMatch(/Aujourd['’]hui/)
  })
})

// --- 4. Le composé réutilise, il ne recopie pas --------------------------------------------------

describe('retour-1b — le composé réutilise les étapes existantes', () => {
  it('porte les mêmes OBJETS que les cinq parcours d’écran et que « menus »', async () => {
    const etapes = await etapesDuCompose()
    const { etapesDuParcours } = await import('../../app/src/ui/parcours.js')

    for (const id of ['menus', 'aujourdhui', 'semaine', 'courses', 'recettes', 'savoir'] as const) {
      const source = etapesDuParcours(id)
      expect(source.length).toBeGreaterThan(0)
      // ⛔ `toBe`, jamais `toEqual` : un texte recopié passerait l'égalité et divergerait au premier
      //    lot de contenu.
      const positions = source.map((e) => etapes.indexOf(e))
      expect(positions.every((p) => p >= 0)).toBe(true)
      // …et dans leur ordre d'origine.
      expect([...positions].sort((a, b) => a - b)).toEqual(positions)
      for (const [i, e] of source.entries()) expect(etapes[positions[i] as number]).toBe(e)
    }

    expect(etapes.length).toBe(29)
  })
})

// --- 5. Les neuf parcours restent lançables ------------------------------------------------------

describe('retour-1b — les neuf tutoriels d’écran survivent', () => {
  it('garde les neuf identifiants d’origine, chacun avec au moins une étape', async () => {
    const { PARCOURS, etapesDuParcours } = await import('../../app/src/ui/parcours.js')
    const NEUF = [
      'menus',
      'aujourdhui',
      'semaine',
      'courses',
      'recettes',
      'savoir',
      'frigo',
      'composer',
      'reglages',
    ] as const

    for (const id of NEUF) {
      expect(PARCOURS.some((p) => p.id === id)).toBe(true)
      expect(etapesDuParcours(id).length).toBeGreaterThan(0)
    }
    // Le composé s'ajoute, il ne remplace pas.
    expect(PARCOURS.length).toBeGreaterThan(NEUF.length)
  })
})

// --- 6. Aucune bulle ne pointe dans le vide ------------------------------------------------------

/**
 * ⛔ LA CLAUSE QUE L'ATTAQUE A RENDUE NÉCESSAIRE. Le lot a le droit de toucher `visite.tsx` — c'est
 * même peut-être ce qu'il faut. Mais la façon la plus courte d'y arriver est de faire rendre à
 * `premierIndexValide` son point de départ sans rien vérifier : les 29 étapes défilent alors dans
 * l'ordre du tableau, les cinq ouvertures s'affichent, le compteur dit 29 — et chaque bulle d'un
 * écran absent désigne un élément qui n'existe pas. Six clauses vertes, garde-fou supprimé.
 *
 * ⚠️ CETTE CLAUSE ET LA SUIVANTE SONT VERTES AUJOURD'HUI, ET C'EST VOULU — même raison que les axes
 * `legerConsistant` et `sucreSale` de `retour-1`. Ce sont des gardes ANTI-DÉBORDEMENT : elles
 * n'existent pas pour révéler le défaut du jour, elles existent pour rougir si la correction
 * l'obtient en cassant autre chose.
 */
describe('retour-1b — aucune bulle ne pointe dans le vide', () => {
  it('chaque bulle affichée désigne un élément réellement présent dans le DOM', async () => {
    await monterEtLancerLeTutoriel()
    const vues = await jouerLeTutoriel(await etapesJouees())

    expect(vues.length).toBeGreaterThan(0)
    expect(vues.filter((v) => !v.ciblePresente).map((v) => `${v.titre} → ${v.cible}`)).toEqual([])
  })
})

// --- 7. Les titres du composé sont distincts -----------------------------------------------------

/**
 * ⚠️ MESURÉ, PAS SUPPOSÉ : « Partir de ce que vous avez » existe DEUX FOIS dans `parcours.ts` (lignes
 * 170 et 289), sur deux cibles différentes. Les deux sont `{ type: 'lecture' }`, donc inoffensives
 * aujourd'hui — mais la première appartient à `ETAPES_AUJOURDHUI`, qui entre dans le composé. Deux
 * bulles au même titre, c'est un défaut pour qui suit le tutoriel autant qu'un piège pour qui le
 * pilote.
 */
describe('retour-1b — les titres du composé sont distincts', () => {
  it('aucun titre n’apparaît deux fois dans le parcours composé', async () => {
    await monterEtLancerLeTutoriel()
    const titres = (await etapesJouees()).map((e) => e.titre)
    const vus = new Set<string>()
    const doubles = titres.filter((t) => (vus.has(t) ? true : (vus.add(t), false)))
    expect(doubles).toEqual([])
  })
})
