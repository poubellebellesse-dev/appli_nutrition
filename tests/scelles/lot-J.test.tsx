// @vitest-environment jsdom
// tests/scelles/lot-J.test.tsx — corrections rapides de la passe APK du 2026-09-30.
//
// Écrit depuis le « Fini quand » du lot J (`docs/CONCEPTION_RETOURS_APK.md`), AVANT tout code.
//
// ⚠️ LE NATIF SE SIMULE PAR `Capacitor.isNativePlatform`, ET PAR RIEN D'AUTRE. C'est le seul signal
// natif du code (`ui/notifications.ts`). L'état est hissé (`vi.hoisted`) et relu À CHAQUE APPEL :
// une implémentation qui figerait la réponse au chargement du module se ferait prendre par les
// clauses qui montent natif PUIS web dans le même fichier — `vi.resetModules()` entre les deux ne
// suffit pas à la sauver si elle lit l'état avant que le test ne le pose.
//
// ⚠️ `catalog.db` RÉEL (`catalogueDeTest()`), jamais une fixture. Aucun effectif écrit en dur.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import {
  baseCourante,
  catalogueDeTest,
  confianceDeTest,
  reinitialiserBase,
} from '../../app/src/ui/test-socle.js'

const etat = vi.hoisted(() => ({
  natif: false,
  stockage: 'opfs' as 'opfs' | 'memoire',
  persistant: true,
}))

vi.mock('@capacitor/core', async (importOriginal) => {
  const reel = await importOriginal<typeof import('@capacitor/core')>()
  return {
    ...reel,
    Capacitor: new Proxy(reel.Capacitor, {
      get: (cible, cle, recepteur) =>
        cle === 'isNativePlatform' ? () => etat.natif : Reflect.get(cible, cle, recepteur),
    }),
  }
})

vi.mock('../../app/src/ui/catalog-source.js', () => ({
  chargerCatalogue: () => Promise.resolve(catalogueDeTest()),
  chargerConfiance: () => Promise.resolve(confianceDeTest()),
}))
vi.mock('../../app/src/ui/user-source.js', () => ({
  ouvrirUserDb: () =>
    Promise.resolve({
      db: baseCourante(),
      stockage: etat.stockage,
      persistant: etat.persistant,
      verrou: 'exclusif',
    }),
  surErreurDePersistance: () => undefined,
}))

const RACINE_SRC = process.cwd().replace(/\\/g, '/').replace(/\/$/, '') + '/app/src/'

/** Découpe comme le navigateur sur `class` et le scanner de Tailwind sur le source (lot A). */
const jetons = (texte: string): readonly string[] =>
  texte.split(/[\s"'`{}]+/).filter((jeton) => jeton !== '')

const RESERVE_HAUT = /^pt-\[max\(env\(safe-area-inset-top\),(\d*\.?\d+)(rem|px)\)\]$/
/** Tout jeton qui pose un `padding-top` : `pt-`, `py-`, `p-`, variantes comprises — sauf la réserve. */
const PADDING_HAUT_CONCURRENT = /^(?:[a-z-]+:)*(?:pt|py|p)-(?!\[max\(env\(safe-area-inset-top\))/

function replieEnPx(jeton: string): number | null {
  const m = RESERVE_HAUT.exec(jeton)
  if (m === null) return null
  return m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1])
}

const classesDe = (el: Element): readonly string[] => jetons(el.getAttribute('class') ?? '')

let demonter: (() => void) | null = null

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
  etat.natif = false
  etat.stockage = 'opfs'
  etat.persistant = true
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

async function monterSurLAccueil(): Promise<void> {
  const { racine } = await import('../../app/src/ui/main.js')
  demonter = () => act(() => racine.unmount())
  await screen.findByRole('heading', { name: 'Bienvenue' })
}

async function passerLEngagement(): Promise<void> {
  clic('J’ai lu et compris')
  await waitFor(() => expect(desactive('J’ai compris')).toBe(false))
  clic('J’ai compris')
}

/** Traverse l'accueil jusqu'à la coquille, sans toucher à aucun choix. */
async function monterEtTerminerIntro(): Promise<void> {
  await monterSurLAccueil()
  await passerLEngagement()
  if (!etat.natif) {
    await screen.findByRole('heading', { name: 'Installez l’application sur votre écran d’accueil' })
    clic('Plus tard')
  }
  await screen.findByRole('heading', { name: 'Des allergies ?' })
  clic('Continuer')
  await screen.findByRole('heading', { name: 'Votre rythme' })
  clic('C’est parti')
  await screen.findByText('Paramètres')
}

/** Le bandeau opaque de la barre d'état : `fixed`, `top-0`, `inset-x-0`, `bg-fond`, aria-hidden. */
function bandeaux(): Element[] {
  return [...document.querySelectorAll('[aria-hidden="true"]')].filter((el) => {
    const c = classesDe(el)
    return c.includes('fixed') && c.includes('top-0') && c.includes('inset-x-0') && c.includes('bg-fond')
  })
}

function verifierLeBandeau(): void {
  const trouves = bandeaux()
  expect(trouves.length, 'un et un seul bandeau opaque de barre d’état').toBe(1)
  const bandeau = trouves[0] as Element
  const c = classesDe(bandeau)

  expect(c, 'hauteur nulle hors encoche : pt-[max(env(safe-area-inset-top),0px)]').toContain(
    'pt-[max(env(safe-area-inset-top),0px)]'
  )
  const z = c.map((j) => /^z-(\d+)$/.exec(j)).find((m) => m !== null)
  expect(z, 'un jeton z-N entier').toBeDefined()
  const niveau = Number((z as RegExpExecArray)[1])
  expect(niveau, 'au-dessus de la barre d’onglets (z-10)').toBeGreaterThan(10)
  expect(niveau, 'sous les fenêtres et le tutoriel (z-50)').toBeLessThan(50)
  expect(bandeau.textContent, 'le bandeau ne contient rien').toBe('')
  expect(bandeau.children.length, 'le bandeau n’est l’ancêtre d’aucun contenu').toBe(0)
}

describe('lot J — corrections rapides de la passe du 2026-09-30', () => {
  // ⛔ CLAUSE 1. L'en-tête des fenêtres, là où l'heure s'imprimait sur « ← Retour ».
  it('⛔ clause 1 — l’en-tête de Panneau réserve la barre d’état', async () => {
    await monterEtTerminerIntro()
    clic('Paramètres')
    fireEvent.click(await screen.findByText('Mes allergies'))
    const fenetre = await screen.findByRole('dialog', { name: 'Mes allergies' })
    const retour = within(fenetre).getByRole('button', { name: /Retour/ })
    const entete = retour.parentElement as Element
    const c = classesDe(entete)

    const reserves = c.filter((j) => j.includes('safe-area-inset-top'))
    expect(reserves.length, 'un jeton de réserve sur l’en-tête').toBe(1)
    expect(reserves[0]).toMatch(RESERVE_HAUT)
    expect(replieEnPx(reserves[0] as string), 'repli ≥ 0,5rem, la marge actuelle').toBeGreaterThanOrEqual(8)
    expect(
      c.filter((j) => PADDING_HAUT_CONCURRENT.test(j)),
      'aucun autre padding-top concurrent (py-2 gardé = deux padding-top)'
    ).toEqual([])

    // Témoins : l'en-tête reste collant et opaque.
    expect(c).toContain('sticky')
    expect(c).toContain('top-0')
    expect(c).toContain('bg-surface')
  })

  // ⛔ CLAUSE 2. Le bandeau opaque, sur les DEUX branches de la coquille.
  it('⛔ clause 2a — bandeau opaque sur l’accueil, avant consentement', async () => {
    await monterSurLAccueil()
    verifierLeBandeau()
  })

  it('⛔ clause 2b — bandeau opaque dans la coquille, après consentement', async () => {
    await monterEtTerminerIntro()
    verifierLeBandeau()
  })

  // ⛔ CLAUSE 3. Pas d'étape d'installation en natif ; témoin web dans le même fichier.
  it('⛔ clause 3 — en natif, l’accueil saute l’installation, et le retour aussi', async () => {
    etat.natif = true
    await monterSurLAccueil()
    await passerLEngagement()
    await screen.findByRole('heading', { name: 'Des allergies ?' })
    expect(screen.queryByText('Installez l’application sur votre écran d’accueil')).toBeNull()

    clic('← Revenir en arrière')
    await screen.findByRole('heading', { name: 'Bienvenue' })
    expect(screen.queryByText('Installez l’application sur votre écran d’accueil')).toBeNull()
  })

  it('clause 3 témoin — sans natif, l’étape d’installation est toujours entre les deux', async () => {
    etat.natif = false
    await monterSurLAccueil()
    await passerLEngagement()
    await screen.findByRole('heading', { name: 'Installez l’application sur votre écran d’accueil' })
    clic('Plus tard')
    await screen.findByRole('heading', { name: 'Des allergies ?' })
    clic('← Revenir en arrière')
    await screen.findByRole('heading', { name: 'Installez l’application sur votre écran d’accueil' })
  })

  // ⛔ CLAUSE 4. Le conseil « ajoutez à l'écran d'accueil » n'a pas de sens dans l'APK.
  const NON_PERSISTANT = /ne garantit pas de les conserver/
  const MEMOIRE = /ne permet pas d'enregistrer vos données/

  it('⛔ clause 4 — en natif, pas de bandeau non_persistant', async () => {
    etat.natif = true
    etat.persistant = false
    await monterEtTerminerIntro()
    // Laisse au socle le temps de poser son alerte : le témoin web ci-dessous la voit à ce stade.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    expect(screen.queryByText(NON_PERSISTANT)).toBeNull()
  })

  it('clause 4 témoin — sans natif, le bandeau non_persistant est là', async () => {
    etat.natif = false
    etat.persistant = false
    await monterEtTerminerIntro()
    await screen.findByText(NON_PERSISTANT)
  })

  it('clause 4 témoin — en natif, l’alerte memoire reste affichée', async () => {
    etat.natif = true
    etat.stockage = 'memoire'
    await monterEtTerminerIntro()
    await screen.findByText(MEMOIRE)
  })

  // ⛔ CLAUSE 5. Trois repas par jour par défaut, ÉCRITS en base.
  it('⛔ clause 5 — un nouveau profil enregistre 3 repas par jour', async () => {
    const { RYTHME_PAR_DEFAUT } = await import('../../app/src/ui/profil-enregistre.js')
    expect(RYTHME_PAR_DEFAUT.repasParJour).toBe(3)

    await monterEtTerminerIntro()
    const { readRythme } = await import('../../app/src/data/user-store.js')
    expect(readRythme(baseCourante())?.repasParJour).toBe(3)
  })

  it('clause 5 témoin — un profil déjà enregistré à 2 reste à 2', async () => {
    const { readRythme, writeRythme } = await import('../../app/src/data/user-store.js')
    const { RYTHME_PAR_DEFAUT } = await import('../../app/src/ui/profil-enregistre.js')
    const db = baseCourante()
    writeRythme(db, { ...RYTHME_PAR_DEFAUT, repasParJour: 2 })
    expect(readRythme(db)?.repasParJour).toBe(2)
  })

  // ⛔ CLAUSE 6. « Voir l'aliment » au singulier.
  it('⛔ clause 6 — un groupe d’un aliment dit « Voir l’aliment »', async () => {
    await monterEtTerminerIntro()
    clic('Paramètres')
    fireEvent.click(await screen.findByText('Aliments que je ne veux pas'))
    const fenetre = await screen.findByRole('dialog', { name: 'Aliments que je ne veux pas' })

    // Les effectifs se lisent sur les libellés des groupes — l'écran les demande au catalogue réel.
    // ⚠️ AMENDÉ SOUS SCEAU LEVÉ (2026-09-30, choix A de l'auteur) : les titres de section « Ou
    // parcourez les familles (14) » et « Vos retraits (N) » ont la forme d'un libellé de groupe et
    // étaient comptés comme tels — 14 familles valaient un faux groupe de 14.
    const effectifs = within(fenetre)
      .getAllByText(/^.+ \(\d+\)$/)
      .filter((el) => !/^(Ou parcourez les familles|Vos retraits) \(/.test(el.textContent ?? ''))
      .map((el) => Number(/\((\d+)\)$/.exec(el.textContent ?? '')?.[1]))
    expect(effectifs.length, 'aucun groupe lu : la clause ne mesurerait rien').toBeGreaterThan(0)
    const singuliers = effectifs.filter((n) => n === 1).length
    expect(singuliers, 'aucun groupe d’un seul aliment dans le catalogue réel').toBeGreaterThan(0)

    expect(within(fenetre).queryAllByText('Voir l’aliment').length + within(fenetre).queryAllByText("Voir l'aliment").length).toBe(
      singuliers
    )
    for (const n of new Set(effectifs.filter((e) => e > 1))) {
      expect(
        within(fenetre).getAllByText(`Voir les ${n} aliments`).length,
        `témoin : les groupes de ${n} gardent le pluriel`
      ).toBe(effectifs.filter((e) => e === n).length)
    }
    expect(document.body.textContent ?? '').not.toMatch(/Voir les 1\b/)
  })

  // ⛔ CLAUSE 7. « Comment ça marche ? » a disparu ; les tutoriels restent dans Paramètres.
  it('⛔ clause 7a — aucun fichier du code ne garde le lien', () => {
    const fichiers = readdirSync(RACINE_SRC, { recursive: true, encoding: 'utf8' })
      .filter((chemin) => /\.(ts|tsx|css)$/.test(chemin) && !/\.test\.tsx?$/.test(chemin))
      .map((chemin) => chemin.replace(/\\/g, '/'))
    expect(fichiers, 'balayage hors sujet').toContain('ui/main.tsx')

    const fautifs = fichiers.filter((chemin) => {
      const texte = readFileSync(RACINE_SRC + chemin, 'utf8')
      return texte.includes('Comment ça marche') || /from\s+['"][^'"]*lien-tutoriel/.test(texte)
    })
    expect(fautifs).toEqual([])
  })

  // Ajouté après le 1er tour d'attaque : un fichier gardé mort, non importé, passait le balayage.
  it('⛔ clause 7a bis — le fichier ui/lien-tutoriel.tsx n\'existe plus', () => {
    expect(existsSync(RACINE_SRC + 'ui/lien-tutoriel.tsx')).toBe(false)
  })

  // Ajouté après le 2e tour d'attaque : un bouton réécrit en place (texte concaténé, sans importer
  // lien-tutoriel) dans Frigo ou l'éditeur, que 7b ne visite pas, passait 7a. Seul Paramètres lance
  // un tutoriel ; `lancer-parcours.tsx` le définit.
  it('⛔ clause 7a ter — seul Paramètres lance un tutoriel', () => {
    const fichiers = readdirSync(RACINE_SRC, { recursive: true, encoding: 'utf8' })
      .filter((chemin) => /\.(ts|tsx)$/.test(chemin) && !/\.test\.tsx?$/.test(chemin))
      .map((chemin) => chemin.replace(/\\/g, '/'))
    expect(fichiers, 'balayage hors sujet').toContain('ui/main.tsx')

    const lanceurs = fichiers.filter((chemin) =>
      /useLancerParcours/.test(readFileSync(RACINE_SRC + chemin, 'utf8'))
    )
    expect(lanceurs.sort()).toEqual(['ui/lancer-parcours.tsx', 'ui/screens/parametres.tsx'])
  })

  // Ajouté après le 1er tour d'attaque : un appel recopié, ou un second signal bricolé
  // (`window.Capacitor`, `getPlatform`), passait les clauses 3 et 4. Un seul signal natif,
  // lu dans un seul module : `ui/natif.ts`.
  it('⛔ clauses 3-4 bis — le signal natif ne vit que dans ui/natif.ts', () => {
    const fichiers = readdirSync(RACINE_SRC, { recursive: true, encoding: 'utf8' })
      .filter((chemin) => /\.(ts|tsx)$/.test(chemin) && !/\.test\.tsx?$/.test(chemin))
      .map((chemin) => chemin.replace(/\\/g, '/'))
    expect(fichiers, 'balayage hors sujet').toContain('ui/main.tsx')

    const porteurs = fichiers.filter((chemin) =>
      /isNativePlatform|getPlatform|window\.Capacitor/.test(readFileSync(RACINE_SRC + chemin, 'utf8'))
    )
    expect(porteurs).toEqual(['ui/natif.ts'])
  })

  it('⛔ clause 7b — aucun des cinq onglets n’affiche « Comment ça marche ? »', async () => {
    await monterEtTerminerIntro()
    const barre = screen.getByRole('navigation')
    for (const onglet of ['Aujourd’hui', 'Semaine', 'Courses', 'Recettes', 'Gestes']) {
      const lien = within(barre).getByText((_, el) => el?.tagName === 'A' && (el.textContent ?? '').replace(/'/g, '’').includes(onglet))
      fireEvent.click(lien)
      await waitFor(() => expect(document.querySelector('main h1')).not.toBeNull())
      expect(screen.queryByText(/Comment ça marche/), `onglet ${onglet}`).toBeNull()
    }
  })

  it('clause 7 témoin — Paramètres › « Revoir un tutoriel » liste tous les parcours et en lance un', async () => {
    const { PARCOURS } = await import('../../app/src/ui/parcours.js')
    await monterEtTerminerIntro()
    clic('Paramètres')
    fireEvent.click(await screen.findByText('Revoir un tutoriel'))
    const fenetre = await screen.findByRole('dialog', { name: 'Revoir un tutoriel' })
    const lignes = within(fenetre).getAllByRole('listitem')
    expect(lignes.length).toBe(PARCOURS.length)

    fireEvent.click(within(lignes[0] as HTMLElement).getByRole('button'))
    await screen.findByText(/Étape 1 sur/)
  })
})
