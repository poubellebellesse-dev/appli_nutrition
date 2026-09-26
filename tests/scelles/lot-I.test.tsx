// @vitest-environment jsdom
//
// tests/scelles/lot-I.test.tsx — l'examen du lot I : « Savoir devient Gestes, l'onglet ne garde que
// le lexique ». Écrit depuis le « Fini quand » de docs/CONCEPTION_RETOURS_APK.md, AVANT la première
// ligne de code.
//
// CE QUE CE FICHIER MESURE, ET POURQUOI DE CETTE FAÇON :
//
// ⭐ L'ABSENCE SE MESURE SUR LES TEXTES DE LA BASE, PAS SUR DES TITRES. Chercher « Le saviez-vous ? »
//    ne prouverait que l'absence de ce titre (piège payé trois fois, `reference/PIEGES.md`). La
//    clause 1 relit donc CHAQUE texte de tip, chaque titre, résumé et affirmation de fiche depuis
//    `catalog.db` réel, et les cherche dans tout `document.body` — portails compris. Un bloc caché
//    par CSS, replié ou renommé y laisse son texte : jsdom ne calcule aucun style.
//
// ⭐ ELLE TOUCHE TOUT AVANT DE CONCLURE. Un bouton « Plus de savoir » qui rouvrirait le carrousel
//    passerait une lecture au montage. La clause clique chaque bouton hors de la liste des gestes et
//    chaque geste dépliable, puis relit. Les boutons des clips (dans un `li`, sans `aria-expanded`)
//    ne sont pas touchés : jsdom n'implémente pas la lecture vidéo.
//
// ⭐ LE DÉPLACEMENT ET LE CODE MORT SONT FERMÉS PAR LA SOURCE (clause 2). Monter les onze autres
//    écrans pour y chercher 73 textes coûterait plus que tout le lot ; au 2026-09-26, seuls
//    `savoir.tsx` et `parcours.ts` portent les mots, types et chaînes des deux blocs dans
//    `app/src/ui`, et la clause exige qu'il n'en reste AUCUN — voir son premier tour d'attaque.
//
// ⭐ RETIRER DE L'ÉCRAN, PAS DE LA BASE (clause 3). La réparation la plus courte des clauses 1 et 2
//    est de vider les tables ou de débrancher le chargeur. Décision de l'auteur : les données restent.
//
// ⚠️ AUCUN COMPTE ABSOLU DU CATALOGUE N'EST SCELLÉ (leçon de `retour-5c`). 73, 8 et 62 datent le
//    brief ; les clauses recalculent leurs attendus depuis la base à l'exécution.
//
// ⚠️ DEUX POIGNÉES D'AUTRES FICHIERS SCELLÉS SONT TENUES VIVANTES PAR CE LOT, ET CE FICHIER NE LES
//    TESTE PAS : « Gestes de cuisine » (`monterSavoir()` de `lot-B`) et « Pour comprendre, pas pour
//    décider à votre place » (`DERNIERE_OUVERTURE` de `retour-1b`). Ce sont ces fichiers-là qui
//    rougiront si elles partent.
//
// ⚠️ CE QUE CE FICHIER NE SAIT PAS VOIR : le ton des textes réécrits du tutoriel, et la redite
//    « Gestes » / « Gestes de cuisine » à l'œil.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { hashDe } from '../../app/src/ui/router.js'
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
  octetsDeLaBase: vi.fn(),
  remplacerLeFichier: vi.fn(),
  verifierSauvegarde: vi.fn(),
}))

const RACINE = path.resolve(__dirname, '..', '..')
const CATALOG_DB = path.join(RACINE, 'app', 'public', 'catalog', 'catalog.db')
const DOSSIER_UI = path.join(RACINE, 'app', 'src', 'ui')

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
})
afterEach(cleanup)

// --- Lecture de la base --------------------------------------------------------------------------

function compter(table: 'tip' | 'evidence_sheet'): number {
  const db = new DatabaseSync(CATALOG_DB, { readOnly: true })
  try {
    return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n
  } finally {
    db.close()
  }
}

/** Tout ce que les tips et les fiches pourraient afficher, lu depuis le catalogue réel. */
function textesInterdits(): { textes: string[]; urls: string[] } {
  const catalogue = catalogueDeTest()
  const textes: string[] = []
  const urls: string[] = []
  for (const tip of catalogue.tips) {
    textes.push(tip.texte)
    urls.push(tip.sourceUrl)
  }
  for (const fiche of catalogue.evidence.values()) {
    textes.push(fiche.titre, fiche.resumeVulgarise)
    for (const p of fiche.positions) textes.push(p.affirmation)
    for (const s of fiche.sources) urls.push(s.url)
  }
  if (textes.length === 0) throw new Error('aucun texte de tip ni de fiche : la clause ne mesure rien')
  return { textes, urls }
}

// --- Montages ------------------------------------------------------------------------------------

async function monterEcran(): Promise<void> {
  const { Savoir } = await import('../../app/src/ui/screens/savoir.js')
  const { ProvenanceLancerParcours } = await import('../../app/src/ui/lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Savoir />
    </ProvenanceLancerParcours>
  )
  await waitFor(() => {
    if (document.querySelector('[data-visite="recherche-gestes"]') === null)
      throw new Error('écran pas encore monté')
  })
}

/** Clique chaque bouton hors de la liste des gestes, et chaque geste dépliable. */
function toutToucher(): void {
  const deja = new Set<Element>()
  for (let tour = 0; tour < 5; tour++) {
    const boutons = [...document.querySelectorAll('button')].filter((b) => !deja.has(b))
    if (boutons.length === 0) return
    for (const b of boutons) {
      deja.add(b)
      const dansUnGeste = b.closest('li') !== null
      if (dansUnGeste && !b.hasAttribute('aria-expanded')) continue
      if (!b.isConnected) continue
      fireEvent.click(b)
    }
  }
}

function verifierAbsence(moment: string): void {
  const { textes, urls } = textesInterdits()
  const corps = document.body.textContent ?? ''
  const presents = textes.filter((t) => corps.includes(t))
  expect(presents, `${moment} : ${presents.length} texte(s) de tip ou de fiche à l'écran`).toEqual([])

  const liens = [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))
  const sources = liens.filter((h) => h !== null && urls.includes(h))
  expect(sources, `${moment} : lien(s) vers une source de tip ou de fiche`).toEqual([])

  const titres = [...document.querySelectorAll('h1, h2, h3, h4')].map((h) => h.textContent?.trim())
  expect(titres, `${moment} : un titre « Le saviez-vous ? » survit`).not.toContain('Le saviez-vous ?')
  expect(titres, `${moment} : un titre « Comprendre » survit`).not.toContain('Comprendre')
  expect(document.querySelector('button[aria-label="Fait suivant"]'), `${moment} : flèche du carrousel`).toBeNull()
  expect(document.querySelector('button[aria-label="Fait précédent"]'), `${moment} : flèche du carrousel`).toBeNull()
  expect(document.querySelector('[data-visite="preuve-forte"]'), `${moment} : filtre de « Comprendre »`).toBeNull()
}

// =================================================================================================

describe('lot I — ni tips ni fiches à l’écran', () => {
  it('clause 1 — aucun texte de tip ni de fiche, au montage puis après avoir tout touché', async () => {
    await monterEcran()
    verifierAbsence('au montage')
    toutToucher()
    verifierAbsence('après avoir touché chaque bouton')
  })

  // ⛔ PREMIER TOUR D'ATTAQUE, 2026-09-26 — LA PREMIÈRE FORME DE CETTE CLAUSE ÉTAIT CONTOURNABLE.
  //    Elle cherchait `.tips` / `.evidence` précédés d'un point. `{false && <LeSaviezVous tips={[]} />}`
  //    passait TOUT : rien à l'écran (clause 1), aucun accès pointé (clause 2), composants gardés
  //    morts — un masquage non déclaré, l'inverse de l'arbitrage 1 du brief. La clause cherche donc
  //    désormais ce que le code mort ne peut pas cacher : le MOT `tips` / `evidence` sous toutes ses
  //    formes (`.tips`, `{ tips }`, `['tips']`, un paramètre `tips`), les types que seuls les blocs
  //    retirés importent, et les chaînes qu'eux seuls rendent. Commentaires compris, exprès : un
  //    en-tête qui annonce encore « 73 tips » ment sur l'écran.
  it('clause 2 — aucun fichier non-test de `app/src/ui` ne garde trace des deux blocs', () => {
    const TRACES: readonly RegExp[] = [
      /\btips\b/,
      /\bevidence\b/,
      /\b(?:Tip|TipCategorie|EvidenceSheet|EvidencePosition|EvidenceSource|EvidenceCategorie|NiveauPreuve|TypeEtude)\b/,
      /Fait suivant/,
      /Fait précédent/,
      /preuve-forte/,
    ]
    const coupables: string[] = []
    const parcourir = (dossier: string): void => {
      for (const nom of readdirSync(dossier)) {
        const chemin = path.join(dossier, nom)
        if (statSync(chemin).isDirectory()) {
          parcourir(chemin)
          continue
        }
        if (!/\.tsx?$/.test(nom) || /\.test\.tsx?$/.test(nom) || nom === 'test-socle.ts') continue
        const source = readFileSync(chemin, 'utf8')
        for (const trace of TRACES) {
          if (trace.test(source)) coupables.push(`${path.relative(RACINE, chemin)} : ${trace}`)
        }
      }
    }
    parcourir(DOSSIER_UI)
    expect(coupables, 'ces fichiers gardent trace des tips ou des fiches').toEqual([])
  })

  it('clause 3 — les données restent : le chargeur rend autant de tips et de fiches que la base', () => {
    const catalogue = catalogueDeTest()
    const tips = compter('tip')
    const fiches = compter('evidence_sheet')
    expect(tips, 'la table `tip` a été vidée').toBeGreaterThan(0)
    expect(fiches, 'la table `evidence_sheet` a été vidée').toBeGreaterThan(0)
    expect(catalogue.tips.length).toBe(tips)
    expect(catalogue.evidence.size).toBe(fiches)
  })
})

describe('lot I — ce qui reste', () => {
  it('clause 4 — chaque geste du lexique réel est à l’écran, et la recherche filtre', async () => {
    await monterEcran()
    const lexique = [...catalogueDeTest().lexicon.values()]
    const n = lexique.length
    expect(n, 'lexique vide : la clause ne mesure rien').toBeGreaterThan(1)

    const textesBoutons = [...document.querySelectorAll('button')].map((b) => b.textContent ?? '')
    const absents = lexique.filter((e) => !textesBoutons.some((t) => t.includes(e.terme)))
    expect(absents.map((e) => e.terme), 'gestes absents de l’écran').toEqual([])
    expect(screen.getByText(`${n} gestes`)).toBeDefined()

    // Le terme le plus long : le plus spécifique, donc celui qui filtre le plus.
    const cherche = [...lexique].sort((a, b) => b.terme.length - a.terme.length)[0]!
    const champ = within(
      document.querySelector('[data-visite="recherche-gestes"]') as HTMLElement
    ).getByRole('searchbox')
    fireEvent.change(champ, { target: { value: cherche.terme } })
    const ligne = await screen.findByText(/^\d+ gestes?$/)
    const reste = Number(ligne.textContent!.split(' ')[0])
    expect(reste).toBeGreaterThanOrEqual(1)
    expect(reste).toBeLessThan(n)
    expect(
      [...document.querySelectorAll('button')].some((b) => (b.textContent ?? '').includes(cherche.terme)),
      `« ${cherche.terme} » a disparu de sa propre recherche`
    ).toBe(true)
  })

  it('clause 5 — « Sources et limites » garde ses quatre paragraphes', async () => {
    await monterEcran()
    const bloc = document.querySelector('[data-visite="sources-limites"]')
    expect(bloc, 'le bloc « Sources et limites » a disparu').not.toBeNull()
    const texte = bloc!.textContent ?? ''
    for (const attendu of [
      'CIQUAL 2025',
      'ne remplace pas un professionnel de santé',
      'Ce qu\'elle ne fait pas',
      'Tout reste sur cet appareil.',
    ]) {
      expect(texte, `« ${attendu} » a quitté « Sources et limites »`).toContain(attendu)
    }
  })
})

describe('lot I — l’onglet s’appelle « Gestes »', () => {
  it('clause 6a — le titre de l’écran est « Gestes »', async () => {
    await monterEcran()
    expect(screen.getByRole('heading', { level: 1 }).textContent?.trim()).toBe('Gestes')
  })

  it('clause 6b — la barre de navigation dit « Gestes », jamais « Savoir »', async () => {
    const { Navigation } = await import('../../app/src/ui/navigation.js')
    render(<Navigation courante="savoir" />)
    const barre = screen.getByRole('navigation', { name: 'Navigation principale' })
    const lien = barre.querySelector(`a[href="${hashDe('savoir')}"]`)
    expect(lien, 'plus aucun lien vers l’onglet').not.toBeNull()
    expect(lien!.textContent?.trim()).toBe('Gestes')
    const libelles = [...barre.querySelectorAll('a')].map((a) => a.textContent?.trim())
    expect(libelles).not.toContain('Savoir')
  })

  it('clause 6c — la fiche aliment ouverte depuis l’onglet dit « ← Gestes »', async () => {
    const { Aliment } = await import('../../app/src/ui/screens/aliment.js')
    render(<Aliment alimentId="carotte" retour={hashDe('savoir')} />)
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByText('← Gestes')).toBeDefined()
    expect(screen.queryByText('← Savoir')).toBeNull()
  })
})

describe('lot I — le tutoriel', () => {
  it('clause 7a — le parcours de l’onglet s’appelle « Gestes » et chaque cible existe à l’écran', async () => {
    const { PARCOURS } = await import('../../app/src/ui/parcours.js')
    const parcours = PARCOURS.find((p) => p.id === 'savoir')
    expect(parcours, 'le parcours `savoir` a disparu').toBeDefined()
    expect(parcours!.titre).toBe('Gestes')

    await monterEcran()
    const orphelines = parcours!.etapes
      .filter((e) => document.querySelector(e.cible) === null)
      .map((e) => `${e.titre} → ${e.cible}`)
    expect(orphelines, 'étapes du tutoriel qui pointent dans le vide').toEqual([])
  })

  // ⛔ SECOND TOUR D'ATTAQUE, 2026-09-26 : aucune clause ne lisait `texte`. Trois étapes à
  //    `texte: 'x'` passaient 7a, 7b et `retour-1b`. Même plancher que `retour-1b` (> 30 caractères),
  //    et le texte que le brief PRESCRIT pour l'étape de la barre d'onglets, mot pour mot.
  it('clause 7c — les étapes de l’onglet disent quelque chose des gestes, et la barre dit « Gestes »', async () => {
    const { PARCOURS } = await import('../../app/src/ui/parcours.js')
    const etapes = PARCOURS.find((p) => p.id === 'savoir')!.etapes
    for (const e of etapes) {
      expect(e.texte.length, `« ${e.titre} » : texte vide ou de remplissage`).toBeGreaterThan(30)
    }
    expect(etapes[0]!.texte, 'l’ouverture ne parle pas des gestes').toMatch(/geste/i)

    const versLOnglet = PARCOURS.flatMap((p) => p.etapes).filter(
      (e) => e.attendu.type === 'route' && e.attendu.hash === hashDe('savoir')
    )
    expect(versLOnglet.length, 'plus aucune étape ne mène à l’onglet').toBeGreaterThan(0)
    for (const e of versLOnglet) {
      expect(e.titre).toBe('Le coin Gestes')
      expect(e.texte).toBe('Touchez « Gestes » pour retrouver ce que veut dire un mot croisé dans une recette.')
    }
  })

  it('clause 7b — aucun tutoriel ne dit plus « Savoir »', async () => {
    const { PARCOURS } = await import('../../app/src/ui/parcours.js')
    const fautifs: string[] = []
    for (const p of PARCOURS) {
      if (/\bSavoir\b/.test(p.titre)) fautifs.push(`parcours ${p.id} : ${p.titre}`)
      for (const e of p.etapes) {
        if (/\bSavoir\b/.test(`${e.titre} ${e.texte}`)) fautifs.push(`${p.id} / ${e.titre}`)
      }
    }
    expect(fautifs).toEqual([])
  })
})
