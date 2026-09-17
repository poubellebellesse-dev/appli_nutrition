// @vitest-environment jsdom
//
// tests/scelles/lot-A.test.tsx — l'examen du lot A : le bandeau du téléphone. Le « Fini quand » est
// dans `docs/CONCEPTION_RETOURS_APK.md`, section « Lot A » ; ce fichier n'en est que la mesure, et
// il ne prescrit rien de plus que ce qui y est écrit.
//
// ⛔ IL DOIT ÊTRE ROUGE LE JOUR OÙ ON L'ÉCRIT. Ce qui a été MESURÉ le 2026-09-12 sur `6d26fef` :
//   · `safe-area-inset-top` n'apparaît AUCUNE FOIS dans `app/src` (0 occurrence, tous fichiers) ;
//   · `app/index.html:7` déclare pourtant `viewport-fit=cover` — le contenu occupe l'écran entier ;
//   · le BAS est compensé (`ui/navigation.tsx:109`, `ui/panneau.tsx`) par le jeton
//     `pb-[max(env(safe-area-inset-bottom),0.75rem)]` : la forme existe déjà et tourne en production.
//   · les deux conteneurs visés portent aujourd'hui `pt-8` (accueil, `ui/main.tsx:316`) et `pt-6`
//     (coquille, `ui/main.tsx:358`) — soit 2rem et 1,5rem.
//
// LA RÈGLE : les deux conteneurs de premier niveau réservent en haut la hauteur du bandeau système,
// **cumulée avec leur marge d'aujourd'hui**, sur TOUTES les largeurs d'écran, et cette réserve ne se
// recopie pas ailleurs.
//
// ---------------------------------------------------------------------------------------------
// COMMENT CE FICHIER SE DÉFEND
//
// ⛔ ON RAISONNE EN JETONS DE CLASSE, JAMAIS EN SOUS-CHAÎNES. Un attribut `class` se découpe sur les
// blancs, et le scanner de Tailwind extrait ses candidats de la même façon. Une expression régulière
// non ancrée accepte `lg:pt-[max(env(safe-area-inset-top),2rem)]` — cinq clauses vertes et ZÉRO pixel
// changé en dessous de 1024 px, c'est-à-dire sur tout téléphone, c'est-à-dire sur l'appareil qui a
// motivé le lot. Elle accepte aussi `pt-[max(env(safe-area-inset-top), 2rem)]`, que le navigateur lit
// comme deux jetons cassés et que Tailwind ne compile jamais. Ici chaque jeton est comparé ENTIER,
// de `^` à `$` : le préfixe de variante et l'espace intérieur sont exclus par construction.
// (La réserve du bas, en production, est elle aussi un jeton unique sans espace — parité de forme.)
//
// ⛔ LE REPLI EST COMPARÉ À LA MARGE D'AUJOURD'HUI, pas à zéro. « Un nombre positif » laisse passer
// `max(env(...),0.01px)`, qui supprime la respiration actuelle sur tout appareil sans encoche :
// l'écran devient PLUS collé qu'avant le lot — exactement le défaut que le « Fini quand » nomme.
// Les clauses 1 et 2 exigent donc, chacune pour SON conteneur, un repli au moins égal à la marge
// que ce conteneur porte aujourd'hui.
//
// ⛔ LA MARGE EST CUMULÉE, PAS JUXTAPOSÉE. Garder `pt-8` À CÔTÉ de la réserve laisse deux règles
// `padding-top` sur le même élément : c'est l'ordre de la feuille compilée qui tranche, et il n'est
// pas garanti. Les clauses 1 et 2 refusent tout autre jeton `pt-` sur le conteneur porteur.
//
// ⛔ LA NON-DISPERSION EST MESURÉE SUR LE CODE SOURCE, pas sur le DOM. Un écran qui recopierait la
// réserve pour son propre compte ne se verrait sur aucun rendu, et se paierait le jour où la valeur
// doit changer.
//
// FAUSSES IMPLÉMENTATIONS, ET LES CLAUSES QUI LES TUENT
//   · seule la coquille consentie traitée ............ clause 1 (l'accueil, premier écran vu)
//   · seul l'accueil traité .......................... clause 2
//   · `pt-[env(safe-area-inset-top)]` sans `max(` ..... clauses 1, 2 et 3
//   · `lg:pt-[max(env(...),2rem)]` (aucun téléphone) .. clauses 1, 2 et 3 — jeton comparé entier
//   · `pt-[max(env(...), 2rem)]` (espace, jamais compilé) . idem
//   · `max(env(...),0.01px)`, marge de respiration perdue . clauses 1 et 2 (repli < marge du jour)
//   · `pt-8` gardé À CÔTÉ de la réserve .............. clauses 1 et 2 (aucun autre jeton `pt-`)
//   · réserve recopiée dans chaque écran ............. clause 4
//
// ⚠️ CE QUE CE FICHIER NE PROUVE PAS, ET QUE SEUL LE TÉLÉPHONE DIRA : que la classe produise des
// pixels. jsdom ne charge pas la feuille compilée par Tailwind ; on ne lit ici que des chaînes de
// classes. Le risque est tenu bas — et seulement bas — par la parité de forme avec la réserve du
// bas, déjà en production. C'est écrit dans le « Fini quand » et ce n'est pas un oubli.

import { readFileSync, readdirSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
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

/**
 * La forme exigée, mesurée sur un JETON DE CLASSE ENTIER — d'où `^` et `$`.
 *
 * ⛔ Ni préfixe de variante (`lg:`, `md:`, `dark:`…) ni espace intérieur ne peuvent y entrer : le
 * premier rendrait la réserve inactive sur téléphone, le second casse le jeton en deux et Tailwind
 * ne compile alors rien du tout.
 *
 * ⛔ Les unités sont bornées à `rem` et `px` pour que le repli soit COMPARABLE à la marge du jour.
 * Un repli qu'on ne sait pas convertir est un repli qu'on ne sait pas juger.
 */
const RESERVE_HAUT = /^pt-\[max\(env\(safe-area-inset-top\),(\d*\.?\d+)(rem|px)\)\]$/

/** Tout autre jeton qui poserait un `padding-top` concurrent sur le même élément. */
const AUTRE_PADDING_HAUT = /^(?:[a-z-]+:)*pt-(?!\[max\(env\(safe-area-inset-top\))/

/** La réserve du BAS, déjà en production — elle sert de patron de forme, jamais de cible. */
const RESERVE_BAS = /pb-\[max\(env\(safe-area-inset-bottom\),0\.75rem\)\]/

/** `pt-8` sur le conteneur d'accueil (`ui/main.tsx:316`), mesuré le 2026-09-12. */
const MARGE_ACCUEIL_PX = 2 * 16
/** `pt-6` sur le conteneur de la coquille (`ui/main.tsx:358`), mesuré le 2026-09-12. */
const MARGE_COQUILLE_PX = 1.5 * 16

// ⚠️ `import.meta.url` n'est pas une URL `file:` sous l'environnement jsdom : `fileURLToPath` y
// plante. La racine de vitest est celle du dépôt (`vitest.config.ts` ne pose PAS `root: 'app'` —
// voir CLAUDE.md, « les pièges qui ont déjà coûté »), donc `cwd()` fait foi.
const RACINE_SRC = process.cwd().replace(/\\/g, '/').replace(/\/$/, '') + '/app/src/'

/**
 * Découpe comme le fait le navigateur sur `class`, et le scanner de Tailwind sur le source : sur les
 * blancs, et sur ce qui délimite une chaîne dans le JSX.
 *
 * ⚠️ Surtout PAS sur les parenthèses : `max(` et `env(` appartiennent au jeton.
 */
const jetons = (texte: string): readonly string[] =>
  texte.split(/[\s"'`{}]+/).filter((jeton) => jeton !== '')

/** Le repli d'un jeton de réserve, en pixels. `null` si le jeton n'est pas une réserve. */
function repliEnPixels(jeton: string): number | null {
  const trouve = jeton.match(RESERVE_HAUT)
  if (trouve === null) return null
  return Number.parseFloat(trouve[1]!) * (trouve[2] === 'rem' ? 16 : 1)
}

/**
 * Les fichiers de `app/src` qui comptent : le code, jamais les tests qui en parlent.
 *
 * ⛔ Refuse de rendre une liste qui ne contient pas `ui/main.tsx`. Un balayage qui lirait le mauvais
 * dossier rendrait 0 fichier, donc 0 occurrence — et une clause de comptage applaudirait le vide.
 */
function fichiersDuCode(): readonly string[] {
  const fichiers = readdirSync(RACINE_SRC, { recursive: true, encoding: 'utf8' })
    .filter((chemin) => /\.(ts|tsx|css)$/.test(chemin) && !/\.test\.tsx?$/.test(chemin))
    .map((chemin) => chemin.replace(/\\/g, '/'))

  if (!fichiers.includes('ui/main.tsx')) {
    throw new Error(`balayage vide ou hors sujet : ${RACINE_SRC} ne contient pas ui/main.tsx`)
  }
  return fichiers
}

/** Chaque fichier de `app/src` qui mentionne l'inset du haut, avec son contenu. */
function fichiersQuiMentionnentLInsetHaut(): readonly { chemin: string; texte: string }[] {
  return fichiersDuCode()
    .map((chemin) => ({ chemin, texte: readFileSync(RACINE_SRC + chemin, 'utf8') }))
    .filter(({ texte }) => texte.includes('safe-area-inset-top'))
}

/** Remonte la chaîne des ancêtres jusqu'à celui qui porte un jeton de réserve. */
function ancetrePorteurDeLaReserve(depart: Element | null): Element | null {
  for (let noeud = depart; noeud !== null; noeud = noeud.parentElement) {
    const classes = jetons(noeud.getAttribute('class') ?? '')
    if (classes.some((jeton) => RESERVE_HAUT.test(jeton))) return noeud
  }
  return null
}

/**
 * Les deux vérifications que les conteneurs partagent : le repli couvre au moins la marge que le
 * conteneur portait avant le lot, et aucun autre `padding-top` ne vient se disputer la place.
 */
function verifierLeConteneur(element: Element, margeMinimalePx: number, nom: string): void {
  const classes = jetons(element.getAttribute('class') ?? '')
  const reserves = classes.filter((jeton) => RESERVE_HAUT.test(jeton))

  expect(reserves.length, `${nom} : ${reserves.length} jeton(s) de réserve, il en faut un`).toBe(1)

  const repli = repliEnPixels(reserves[0]!)!
  expect(
    repli,
    `${nom} : repli de ${repli} px dans « ${reserves[0]} », la marge d’aujourd’hui vaut ${margeMinimalePx} px — le lot la remplacerait au lieu de la cumuler`
  ).toBeGreaterThanOrEqual(margeMinimalePx)

  const concurrents = classes.filter((jeton) => AUTRE_PADDING_HAUT.test(jeton))
  expect(
    concurrents,
    `${nom} : padding-top concurrent — c’est l’ordre de la feuille compilée qui trancherait`
  ).toEqual([])
}

/** Voir `main.test.tsx` : la racine est créée à l'import, `cleanup()` ne la connaît pas. */
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

const desactive = (texte: string): boolean =>
  (screen.getByText(texte).closest('button') as HTMLButtonElement).disabled

/** Monte la coquille et s'arrête sur le PREMIER écran, l'accueil — avant tout consentement. */
async function monterSurLAccueil(): Promise<void> {
  const { racine } = await import('../../app/src/ui/main.js')
  demonter = () => act(() => racine.unmount())
  await screen.findByRole('heading', { name: 'Bienvenue' })
}

/** Monte la coquille et traverse l'intro jusqu'à « Aujourd'hui », comme `main.test.tsx`. */
async function monterEtTerminerIntro(): Promise<void> {
  await monterSurLAccueil()

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

describe('lot A — le bandeau du téléphone', () => {
  // ⛔ CLAUSE 1. Le tout premier écran de la toute première ouverture. C'est là que « Bienvenue » a
  // été vu collé en haut, et c'est la branche de `main.tsx` qu'un lot pressé oublie : elle n'a ni
  // barre de navigation ni lien Paramètres, donc rien ne la ramène sous les yeux du développeur.
  it('⛔ clause 1 — l’accueil réserve le bandeau en cumulant sa marge', async () => {
    await monterSurLAccueil()

    const porteur = ancetrePorteurDeLaReserve(screen.getByRole('heading', { name: 'Bienvenue' }))
    expect(
      porteur,
      'aucun ancêtre de « Bienvenue » ne porte un jeton pt-[max(env(safe-area-inset-top),…)]'
    ).not.toBeNull()

    verifierLeConteneur(porteur!, MARGE_ACCUEIL_PX, 'conteneur d’accueil')
  })

  // ⛔ CLAUSE 2. L'autre branche de `return` : la coquille après consentement, celle qu'on voit tous
  // les jours. On vise le PARENT de `<main>`, c'est-à-dire le conteneur de contenu lui-même, et pas
  // un ancêtre lointain qui réserverait pour tout le document.
  it('⛔ clause 2 — la coquille consentie réserve le bandeau en cumulant sa marge', async () => {
    await monterEtTerminerIntro()
    await screen.findByText('Paramètres')

    const contenu = document.querySelector('main')
    expect(contenu, '<main> introuvable : la coquille n’a pas fini de monter').not.toBeNull()

    const conteneur = contenu!.parentElement
    expect(conteneur, '<main> n’a pas de conteneur parent').not.toBeNull()

    verifierLeConteneur(conteneur!, MARGE_COQUILLE_PX, 'conteneur de la coquille')
  })

  // ⛔ CLAUSE 3. La forme, relue jeton par jeton dans le SOURCE. C'est la clause qui tue les fausses
  // implémentations que le DOM ne distingue pas : le préfixe de variante, qui rend la réserve
  // inactive sur téléphone, et l'espace après la virgule, que Tailwind ne compile jamais.
  it('⛔ clause 3 — chaque mention est un jeton de classe entier, sans variante ni espace', () => {
    const mentions = fichiersQuiMentionnentLInsetHaut()
    expect(mentions.length, 'aucune réserve du haut dans app/src').toBeGreaterThan(0)

    for (const { chemin, texte } of mentions) {
      const brutes = texte.split('safe-area-inset-top').length - 1
      const porteurs = jetons(texte).filter((jeton) => jeton.includes('safe-area-inset-top'))

      for (const jeton of porteurs) {
        expect(
          jeton,
          `${chemin} : « ${jeton} » n’est pas un jeton pt-[max(env(safe-area-inset-top),<n>rem|px)] entier`
        ).toMatch(RESERVE_HAUT)
      }

      expect(
        porteurs.length,
        `${chemin} : ${brutes} mention(s) de l’inset, ${porteurs.length} jeton(s) porteur(s) — une mention coupée par un espace ne se compile pas`
      ).toBe(brutes)
    }
  })

  // ⛔ CLAUSE 4. La réserve vit à un seul endroit. Deux occurrences au plus — les deux conteneurs —
  // et JAMAIS dans un écran : un écran qui se compense lui-même est un endroit de plus à corriger
  // le jour où la valeur bouge, et il ne se voit sur aucun rendu.
  it('⛔ clause 4 — la réserve ne se disperse pas dans les écrans', () => {
    const mentions = fichiersQuiMentionnentLInsetHaut()
    const total = mentions.reduce(
      (n, { texte }) => n + texte.split('safe-area-inset-top').length - 1,
      0
    )

    expect(total, 'aucune réserve du haut dans app/src').toBeGreaterThan(0)
    expect(
      total,
      `réserve recopiée ${total} fois : ${mentions.map((m) => m.chemin).join(', ')}`
    ).toBeLessThanOrEqual(2)

    expect(
      mentions.map((m) => m.chemin).filter((chemin) => chemin.startsWith('ui/screens/')),
      'un écran ne compense pas le bandeau pour son propre compte'
    ).toEqual([])
  })

  // ⛔ CLAUSE 5. Le garde-fou : ce lot ne défait pas la réserve du BAS, qui tourne en production et
  // dont il ne fait que copier la forme. Une refonte de la coquille qui l'emporterait au passage
  // rendrait la barre de navigation inatteignable au pouce sur les téléphones à geste.
  it('⛔ clause 5 — la réserve du bas est intacte (garde)', () => {
    const navigation = readFileSync(RACINE_SRC + 'ui/navigation.tsx', 'utf8')
    expect(navigation, 'la réserve du bas de la barre de navigation a disparu').toMatch(RESERVE_BAS)
  })
})
