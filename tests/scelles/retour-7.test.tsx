// @vitest-environment jsdom
//
// tests/scelles/retour-7.test.tsx — l'examen du lot `retour-7` : le frigo déclaré ne vaut plus que
// pour le repas en cours (décisions 74 et 80).
//
// ⛔ IL DOIT ÊTRE ROUGE LE JOUR OÙ ON L'ÉCRIT. Aujourd'hui une déclaration vit jusqu'à ce qu'on la
// retire : l'écran Frigo, la fiche recette et Aujourd'hui l'appliquent sans regarder sa date ; les
// courses et « Choisir un plat » la font confirmer au-delà de sept jours.
//
// ---------------------------------------------------------------------------------------------
// CE QU'IL GARDE, ET COMMENT IL SE DÉFEND
//
// ⛔ LE FRIGO SE REMPLIT PAR LE GESTE, JAMAIS PAR `writePantry`. La date enregistrée aujourd'hui est
// une date UTC sans heure : le lot devra conserver autre chose, et la forme (instant, échéance,
// colonne neuve) reste LIBRE. Écrire en base ici scellerait une signature. Seule exception, la
// clause 7 : deux lignes telles que les a laissées une version antérieure, écrites par SQL.
//
// ⛔ AUCUN `vi.resetModules()` ENTRE DEUX MONTAGES D'UN MÊME TEST. L'horloge avance, l'écran est
// remonté, rien d'autre. Une purge posée au chargement du socle (mis en cache) ou au démarrage de
// l'application ne passe pas.
//
// ⛔ LES AUTRES ÉCRANS SONT MONTÉS SANS REPASSER PAR L'ÉCRAN FRIGO APRÈS LA BASCULE (clause 6). Une
// purge logée dans l'écran Frigo seul laisserait courses, fiche et Aujourd'hui lire l'aliment effacé.
//
// ---------------------------------------------------------------------------------------------
// FAUSSES IMPLÉMENTATIONS, ET LES CLAUSES QUI LES TUENT
//
// N°1 — UNE DURÉE FIXE. ▶ 2 (5 h 59 tiennent) contre 3 (10 minutes effacent).
// N°2 — LE NOM DU CRÉNEAU SANS LA DATE. ▶ 4 (déjeuner du jour, déjeuner du lendemain).
// N°3 — LE RYTHME EN DUR À DEUX REPAS. ▶ 1 et 5 (1, 2 et 3 repas).
//        ⚠️ PAS DE CAS À 4 REPAS : `user_rythme` refuse `repas_par_jour` hors de 1 à 3 (CHECK du
//        schéma), le goûter est donc inatteignable dans l'application. Mesuré en écrivant ce fichier.
// N°4 — LA DATE UTC (`aujourdhuiIso`). ▶ 4 bis. ⚠️ Ne discrimine qu'à l'est de Greenwich : 4 bis
//        VÉRIFIE D'ABORD que la machine y est, et rougit sinon au lieu de passer sans rien prouver.
// N°5 — LA PURGE DANS L'ÉCRAN FRIGO SEUL. ▶ 6a, 6b, 6c, 6d.
// N°6 — LA RÉÉCRITURE QUI RESSUSCITE (`writePantry` efface tout et réinsère). ▶ 3 bis.
// N°7 — UNE MENTION DE PORTÉE CONSTANTE. ▶ 1 (six cas, quatre mentions).
// N°8 — « PAS D'INSTANT » LU COMME « TOUJOURS VALABLE ». ▶ 7.
// N°9 — « CHOISIR UN PLAT » QUI SERT LE FRIGO À N'IMPORTE QUELLE CASE DE LA SEMAINE, ou à la seule
//        date du jour, ou au seul nom du repas. ▶ 6b bis (dîner du jour, déjeuner du lendemain).
//        Tranché par l'auteur le 2026-09-10 : le frigo ne sert qu'à la case du repas en cours.
// N°10 — LE JOUR DU MOIS (ou jour et mois) SANS L'ANNÉE. ▶ 4 ter (10 septembre 2026 / 2027).
// N°11 — UNE DATE SANS HEURE LUE COMME « VALABLE TOUTE LA JOURNÉE ». ▶ 7 bis.
// N°12 — LE RYTHME LU PAR L'ÉCRAN FRIGO SEUL, et 2 repas par défaut sur les autres. Courses,
//        « Choisir un plat » et la fiche recette ne lisent pas `user_rythme` aujourd'hui : un
//        paramètre de rythme optionnel, oublié chez eux, passerait toutes les clauses à 2 repas.
//        ▶ le cas « 3 repas » de 6a, 6b, 6c et 6d — déclaré à 9 h, regardé à 10 h 30. À 2 repas les
//        deux heures tombent dans le même déjeuner. Exhibée au second tour d'attaque.
//
// ⚠️ VERTS AUJOURD'HUI, ET C'EST VOULU — des gardes et des témoins, pas des défauts :
// clause 2 (2 cas), 4 bis, 5 (le cas à 1 repas), et les témoins de 6a, 6b bis, 6c, 6d (trois). Un
// témoin rouge veut dire que la clause qu'il épaule ne prouve plus rien.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { FoodId } from '../../app/src/engine/domain/index.js'
import { writeRythme } from '../../app/src/data/user-store.js'
import {
  baseCourante,
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

/** Jeudi 10 septembre 2026. Le lendemain est le 11, « huit jours avant » le 2. */
const JOUR = 10
const LENDEMAIN = 11
const HUIT_JOURS_AVANT = 2

const LONG = 120_000

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
  rythme(2)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function rythme(repasParJour: number): void {
  writeRythme(baseCourante(), { repasParJour, tempsSemaineMin: null, tempsWeekendMin: null })
}

/**
 * Fige l'horloge, heure LOCALE. Seul `Date` est simulé (voir `retour-5d`) ; `setSystemTime` déplace
 * une horloge déjà simulée, un second `useFakeTimers({ now })` ne le ferait pas.
 */
function figer(jour: number, heure: number, minute: number, annee = 2026): void {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(annee, 8, jour, heure, minute, 0))
}

// ------------------------------------------------------------------------------------------
// L'écran Frigo, et le geste qui déclare
// ------------------------------------------------------------------------------------------

interface Aliment {
  readonly recherche: string
  readonly libelle: string
}

const RIZ: Aliment = { recherche: 'riz', libelle: 'Riz blanc, cru' }
const OIGNON: Aliment = { recherche: 'oignon', libelle: 'Oignon, cru' }

/** Un aliment du catalogue désigné par son identifiant, cherché par son nom entier. */
function alimentDuCatalogue(foodId: string): Aliment {
  const food = catalogueDeTest().foods.get(foodId as FoodId)
  if (food === undefined) throw new Error(`« ${foodId} » absent du catalogue`)
  return { recherche: food.nom, libelle: food.nom }
}

async function monterFrigo(): Promise<void> {
  const { Frigo } = await import('../../app/src/ui/screens/frigo.js')
  const { ProvenanceLancerParcours } = await import('../../app/src/ui/lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Frigo />
    </ProvenanceLancerParcours>
  )
  await screen.findByLabelText('Ajouter un aliment')
}

/** Ce que l'écran Frigo montre comme déclaré : le nom porté par chaque bouton « Retirer … ». */
function auFrigo(): readonly string[] {
  return [...document.querySelectorAll('button[aria-label^="Retirer "]')]
    .map((b) => (b.getAttribute('aria-label') ?? '').slice('Retirer '.length))
    .sort()
}

async function ajouter(aliment: Aliment): Promise<void> {
  fireEvent.change(screen.getByLabelText('Ajouter un aliment'), { target: { value: aliment.recherche } })
  // `findAll` : un aliment courant figure aussi dans les raccourcis par famille, et les deux ajoutent.
  fireEvent.click((await screen.findAllByText(aliment.libelle))[0]!)
  await waitFor(() => {
    if (!auFrigo().includes(aliment.libelle)) throw new Error(`« ${aliment.libelle} » pas encore déclaré`)
  })
}

/** Déclare PAR LE GESTE, à l'heure dite, puis démonte l'écran. */
async function declarer(
  jour: number,
  heure: number,
  minute: number,
  aliments: readonly Aliment[],
  annee = 2026
): Promise<void> {
  figer(jour, heure, minute, annee)
  await monterFrigo()
  for (const aliment of aliments) await ajouter(aliment)
  cleanup()
}

/** Remonte l'écran Frigo à l'heure dite et rend les aliments qu'il montre. */
async function frigoA(jour: number, heure: number, minute: number, annee = 2026): Promise<readonly string[]> {
  figer(jour, heure, minute, annee)
  await monterFrigo()
  return auFrigo()
}

const PORTEES = {
  petit_dejeuner: /valable pour ce matin/i,
  dejeuner: /valable pour ce midi/i,
  gouter: /valable pour le goûter/i,
  diner: /valable pour ce soir/i,
} as const

function porteesAffichees(): readonly string[] {
  const texte = document.body.textContent ?? ''
  return Object.entries(PORTEES)
    .filter(([, motif]) => motif.test(texte))
    .map(([creneau]) => creneau)
}

// ------------------------------------------------------------------------------------------
// Clause 1 — la mention de portée
// ------------------------------------------------------------------------------------------

describe('retour-7 · clause 1 — l’écran Frigo dit pour quel repas vaut la déclaration', () => {
  it.each([
    [2, 12, 'dejeuner'],
    [2, 20, 'diner'],
    [3, 8, 'petit_dejeuner'],
    [3, 12, 'dejeuner'],
    [3, 15, 'diner'],
    [1, 12, 'diner'],
  ] as const)('%i repas/jour, à %i h : une seule mention, celle de « %s »', async (repas, heure, attendu) => {
    rythme(repas)
    figer(JOUR, heure, 0)
    await monterFrigo()
    await ajouter(RIZ)

    expect(porteesAffichees()).toEqual([attendu])
  }, LONG)
})

// ------------------------------------------------------------------------------------------
// Clauses 2 à 5 — quand la déclaration s'efface, lu sur l'écran Frigo
// ------------------------------------------------------------------------------------------

describe('retour-7 · clause 2 — la déclaration tient tant que le repas n’est pas fini (garde)', () => {
  it('déclaré à 8 h 00, toujours là à 13 h 59', async () => {
    await declarer(JOUR, 8, 0, [RIZ])
    expect(await frigoA(JOUR, 13, 59)).toEqual([RIZ.libelle])
  }, LONG)

  it('déclaré à 14 h 00, toujours là à 23 h 59', async () => {
    await declarer(JOUR, 14, 0, [RIZ])
    expect(await frigoA(JOUR, 23, 59)).toEqual([RIZ.libelle])
  }, LONG)
})

describe('retour-7 · clause 3 — elle s’efface à la fin du repas, sans geste', () => {
  it('⭐ déclaré à 13 h 55, absent à 14 h 05', async () => {
    await declarer(JOUR, 13, 55, [RIZ])
    expect(await frigoA(JOUR, 14, 5)).toEqual([])
    expect(screen.getByText(/Ajoutez au moins un aliment/)).toBeDefined()
  }, LONG)

  it('déclaré à 23 h 50, absent le lendemain à 0 h 05', async () => {
    await declarer(JOUR, 23, 50, [RIZ])
    expect(await frigoA(LENDEMAIN, 0, 5)).toEqual([])
  }, LONG)

  it('3 bis — un aliment effacé ne revient pas quand on en déclare un autre', async () => {
    await declarer(JOUR, 13, 55, [OIGNON])

    figer(JOUR, 14, 5)
    await monterFrigo()
    await ajouter(RIZ)
    expect(auFrigo()).toEqual([RIZ.libelle])
    cleanup()

    expect(await frigoA(JOUR, 14, 10)).toEqual([RIZ.libelle])
  }, LONG)
})

describe('retour-7 · clause 4 — le jour compte, et c’est le jour local', () => {
  it('déclaré à 12 h, absent le lendemain à 11 h — deux déjeuners, deux jours', async () => {
    await declarer(JOUR, 12, 0, [RIZ])
    expect(await frigoA(LENDEMAIN, 11, 0)).toEqual([])
  }, LONG)

  it('4 bis — déclaré à 0 h 30 (pour le déjeuner), toujours là à 13 h (garde, fuseau)', async () => {
    // TÉMOIN DE FUSEAU. Ce cas ne discrimine la date UTC que si 0 h 30 locale tombe la VEILLE en
    // UTC, c'est-à-dire à l'est de Greenwich. Ailleurs il passerait sans rien prouver : il rougit.
    expect(new Date(2026, 8, JOUR, 0, 30).getUTCDate(), 'machine à l’est de Greenwich').toBe(JOUR - 1)

    await declarer(JOUR, 0, 30, [RIZ])
    expect(await frigoA(JOUR, 13, 0)).toEqual([RIZ.libelle])
  }, LONG)

  it('4 ter — déclaré le 10 septembre 2026 à 12 h, absent le 10 septembre 2027 à 12 h — même jour du mois, même repas', async () => {
    await declarer(JOUR, 12, 0, [RIZ], 2026)
    expect(await frigoA(JOUR, 12, 0, 2027)).toEqual([])
  }, LONG)
})

describe('retour-7 · clause 5 — le rythme compte', () => {
  it('3 repas : déclaré à 9 h, absent à 10 h 30 (le petit-déjeuner est fini)', async () => {
    rythme(3)
    await declarer(JOUR, 9, 0, [RIZ])
    expect(await frigoA(JOUR, 10, 30)).toEqual([])
  }, LONG)

  it('2 repas : déclaré à 9 h, absent à 15 h (le déjeuner est fini)', async () => {
    await declarer(JOUR, 9, 0, [RIZ])
    expect(await frigoA(JOUR, 15, 0)).toEqual([])
  }, LONG)

  it('1 repas : déclaré à 9 h, toujours là à 15 h (le dîner n’est pas fini) (garde)', async () => {
    rythme(1)
    await declarer(JOUR, 9, 0, [RIZ])
    expect(await frigoA(JOUR, 15, 0)).toEqual([RIZ.libelle])
  }, LONG)
})

// ------------------------------------------------------------------------------------------
// Clause 6a — Courses
// ------------------------------------------------------------------------------------------

/** Un vrai plan de semaine, par le moteur, comme `courses.test.tsx`. Rend l'aliment de tête de la liste. */
async function avecUnPlan(): Promise<Aliment> {
  const { chargerSocle, aujourdhuiIso, profilCourant } = await import('../../app/src/ui/socle.js')
  const socle = await chargerSocle()
  const date = aujourdhuiIso()
  const profil = profilCourant(socle.db, date)
  const brut = socle.moteur.planWeek({
    profile: profil,
    tolerancePiquant: null,
    constraints: { allergies: [], diet: null, excludedFoodIds: [], ownedEquipmentIds: null, admittedFoodIds: [] },
    startDate: date,
    days: 7,
    slots: ['dejeuner', 'diner'],
    history: { windowDays: 21, entries: [] },
    activeTopics: [],
    convives: 1,
    seed: 1,
  })
  const plan = socle.moteur.planLeftovers(brut, profil, 1)
  const { savePlan } = await import('../../app/src/data/user-store.js')
  savePlan(socle.db, plan, date)
  const item = socle.moteur.buildShoppingList(plan).items[0]
  if (item === undefined) throw new Error('liste de courses vide : le plan ne prouve rien')
  return alimentDuCatalogue(item.foodId)
}

async function monterCourses(): Promise<void> {
  const { Courses } = await import('../../app/src/ui/screens/courses.js')
  const { ProvenanceLancerParcours } = await import('../../app/src/ui/lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Courses />
    </ProvenanceLancerParcours>
  )
  await waitFor(() => {
    if (lignesAchetables().length === 0) throw new Error('liste pas encore affichée')
  })
}

function lignesAchetables(): readonly string[] {
  return [...document.querySelectorAll('article button[aria-pressed]')].map((b) => b.textContent ?? '')
}

describe('retour-7 · clause 6a — Courses', () => {
  it('témoin : déclaré à 14 h 02, regardé à 14 h 05 — sous « Déjà chez vous (1) », pas cochable', async () => {
    figer(JOUR, 14, 0)
    const aliment = await avecUnPlan()
    await declarer(JOUR, 14, 2, [aliment])

    figer(JOUR, 14, 5)
    await monterCourses()

    expect(await screen.findByText(/^Déjà chez vous \(1\)$/)).toBeDefined()
    expect(lignesAchetables().some((l) => l.includes(aliment.libelle))).toBe(false)
  }, LONG)

  it('⭐ déclaré à 13 h 55, regardé à 14 h 05 — de retour dans la liste, pas de « Déjà chez vous »', async () => {
    figer(JOUR, 13, 50)
    const aliment = await avecUnPlan()
    await declarer(JOUR, 13, 55, [aliment])

    figer(JOUR, 14, 5)
    await monterCourses()

    expect(lignesAchetables().some((l) => l.includes(aliment.libelle))).toBe(true)
    expect(screen.queryByText(/^Déjà chez vous/)).toBeNull()
  }, LONG)

  it('déclaré le 2 septembre, regardé le 10 — dans la liste, et aucune confirmation demandée', async () => {
    figer(JOUR, 12, 0)
    const aliment = await avecUnPlan()
    await declarer(HUIT_JOURS_AVANT, 12, 0, [aliment])

    figer(JOUR, 12, 0)
    await monterCourses()

    expect(lignesAchetables().some((l) => l.includes(aliment.libelle))).toBe(true)
    expect(screen.queryByText(/^Déjà chez vous/)).toBeNull()
    expect(document.body.textContent ?? '').not.toMatch(/Vous les avez toujours/)
    expect(document.body.textContent ?? '').not.toMatch(/date(nt)? trop pour qu/)
  }, LONG)

  it('⭐ 3 repas : déclaré à 9 h, regardé à 10 h 30 — de retour dans la liste (le petit-déjeuner est fini)', async () => {
    rythme(3)
    figer(JOUR, 8, 50)
    const aliment = await avecUnPlan()
    await declarer(JOUR, 9, 0, [aliment])

    figer(JOUR, 10, 30)
    await monterCourses()

    expect(lignesAchetables().some((l) => l.includes(aliment.libelle))).toBe(true)
    expect(screen.queryByText(/^Déjà chez vous/)).toBeNull()
  }, LONG)
})

// ------------------------------------------------------------------------------------------
// Clause 6b — « Choisir un plat » depuis Semaine
// ------------------------------------------------------------------------------------------

async function composerSemaine(): Promise<void> {
  const { Semaine } = await import('../../app/src/ui/screens/semaine.js')
  const { ProvenanceLancerParcours } = await import('../../app/src/ui/lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Semaine />
    </ProvenanceLancerParcours>
  )
  fireEvent.click(await screen.findByText('Composer ma semaine'))
  await screen.findByText('Proposer une autre semaine')
}

/**
 * Ouvre « Choisir » sur la case n° `rang` de la grille (à 2 repas : 0 = déjeuner du jour, 1 = dîner
 * du jour, 2 = déjeuner du lendemain ; à 3 repas : 1 = déjeuner du jour) et VÉRIFIE par le titre de la fenêtre que c'est bien la case
 * visée — l'ordre de la grille n'est pas scellé, le titre l'est.
 */
async function ouvrirOngletFrigo(rang: number, jour: number, repas: 'Déjeuner' | 'Dîner'): Promise<HTMLElement> {
  fireEvent.click(screen.getAllByText('Choisir')[rang]!.closest('button')!)
  const dialogue = await screen.findByRole('dialog')
  expect(dialogue.textContent ?? '').toMatch(new RegExp(`Choisir un plat — \\D*\\b${jour} [^·]*· ${repas}`))
  fireEvent.click(within(dialogue).getByRole('tab', { name: /Avec ce que j.ai/ }))
  await act(async () => {
    await Promise.resolve()
  })
  return dialogue
}

function ongletDitFrigoVide(dialogue: HTMLElement): void {
  const texte = dialogue.textContent ?? ''
  expect(texte).toMatch(/Vous n.avez rien déclaré dans le frigo/)
  expect(texte).not.toMatch(/Vous les avez toujours/)
  expect(texte).not.toMatch(/D.après les \d+ aliment/)
}

describe('retour-7 · clause 6b — « Choisir un plat », onglet « Avec ce que j’ai »', () => {
  // La case ouverte est le DÎNER du jour — le repas en cours à 14 h 05. Ouvrir le déjeuner ne
  // prouverait rien sur l'effacement : la case désignée suffirait à vider l'onglet.
  it('⭐ déclaré à 13 h 55, dîner du jour ouvert à 14 h 05 — « rien déclaré », ni question ni classement', async () => {
    await declarer(JOUR, 13, 55, [RIZ])

    figer(JOUR, 14, 5)
    await composerSemaine()
    const dialogue = await ouvrirOngletFrigo(1, JOUR, 'Dîner')

    await waitFor(() => ongletDitFrigoVide(dialogue))
  }, LONG)

  // Le déjeuner du jour est le repas en cours à 12 h : seule l'ancienneté peut vider l'onglet.
  it('déclaré le 2 septembre, déjeuner du 10 ouvert à 12 h — « rien déclaré », pas « Vous les avez toujours ? »', async () => {
    await declarer(HUIT_JOURS_AVANT, 12, 0, [RIZ])

    figer(JOUR, 12, 0)
    await composerSemaine()
    const dialogue = await ouvrirOngletFrigo(0, JOUR, 'Déjeuner')

    await waitFor(() => ongletDitFrigoVide(dialogue))
  }, LONG)

  // À 10 h 30 sur 3 repas, le déjeuner du jour EST le repas en cours ; sur 2 repas, le riz de 9 h
  // vaudrait encore pour lui. Seul le rythme lu peut vider l'onglet.
  it('⭐ 3 repas : déclaré à 9 h, déjeuner du jour ouvert à 10 h 30 — « rien déclaré » (le petit-déjeuner est fini)', async () => {
    rythme(3)
    await declarer(JOUR, 9, 0, [RIZ])

    figer(JOUR, 10, 30)
    await composerSemaine()
    const dialogue = await ouvrirOngletFrigo(1, JOUR, 'Déjeuner')

    await waitFor(() => ongletDitFrigoVide(dialogue))
  }, LONG)
})

describe('retour-7 · clause 6b bis — le frigo ne sert qu’à la case du repas en cours', () => {
  it('témoin : déclaré à 12 h, déjeuner du jour ouvert à 12 h 05 — classé d’après le frigo', async () => {
    await declarer(JOUR, 12, 0, [RIZ])

    figer(JOUR, 12, 5)
    await composerSemaine()
    const dialogue = await ouvrirOngletFrigo(0, JOUR, 'Déjeuner')

    await waitFor(() => {
      const texte = dialogue.textContent ?? ''
      expect(texte).toMatch(/D.après les 1 aliment déclaré au frigo/)
      expect(texte).not.toMatch(/Vous n.avez rien déclaré dans le frigo/)
    })
  }, LONG)

  it('⭐ déclaré à 12 h, DÎNER du jour ouvert à 12 h 05 — « rien déclaré » (même jour, autre repas)', async () => {
    await declarer(JOUR, 12, 0, [RIZ])

    figer(JOUR, 12, 5)
    await composerSemaine()
    const dialogue = await ouvrirOngletFrigo(1, JOUR, 'Dîner')

    await waitFor(() => ongletDitFrigoVide(dialogue))
  }, LONG)

  it('⭐ déclaré à 12 h, déjeuner du LENDEMAIN ouvert à 12 h 05 — « rien déclaré » (même repas, autre jour)', async () => {
    await declarer(JOUR, 12, 0, [RIZ])

    figer(JOUR, 12, 5)
    await composerSemaine()
    const dialogue = await ouvrirOngletFrigo(2, LENDEMAIN, 'Déjeuner')

    await waitFor(() => ongletDitFrigoVide(dialogue))
  }, LONG)
})

// ------------------------------------------------------------------------------------------
// Clause 6c — la fiche recette
// ------------------------------------------------------------------------------------------

/** Une recette où l'oignon est obligatoire parmi au moins trois aliments obligatoires distincts. */
function recetteAvecOignon(): string {
  for (const [id, recette] of catalogueDeTest().recipes) {
    const obligatoires = new Set(recette.ingredients.filter((i) => !i.optionnel).map((i) => i.foodId as string))
    if (obligatoires.has('oignon') && obligatoires.size >= 3) return id
  }
  throw new Error('aucune recette à oignon obligatoire parmi trois : la clause ne prouve rien')
}

async function monterFiche(recetteId: string): Promise<void> {
  const { DetailRecette } = await import('../../app/src/ui/screens/detail-recette.js')
  render(<DetailRecette recetteId={recetteId} origine="recettes" />)
  await screen.findByRole('heading', { level: 1 })
}

const mentionsAAcheter = (): number => screen.queryAllByText(/à acheter/).length

describe('retour-7 · clause 6c — la fiche recette', () => {
  it('témoin : oignon déclaré à 14 h 02, fiche à 14 h 05 — des lignes « à acheter »', async () => {
    expect(alimentDuCatalogue('oignon').libelle).toBe(OIGNON.libelle)
    const recette = recetteAvecOignon()
    await declarer(JOUR, 14, 2, [OIGNON])

    figer(JOUR, 14, 5)
    await monterFiche(recette)

    await waitFor(() => expect(mentionsAAcheter()).toBeGreaterThan(0))
  }, LONG)

  it('⭐ oignon déclaré à 13 h 55, fiche à 14 h 05 — aucune ligne « à acheter »', async () => {
    const recette = recetteAvecOignon()
    await declarer(JOUR, 13, 55, [OIGNON])

    figer(JOUR, 14, 5)
    await monterFiche(recette)

    expect(mentionsAAcheter()).toBe(0)
  }, LONG)

  it('⭐ 3 repas : oignon déclaré à 9 h, fiche à 10 h 30 — aucune ligne « à acheter » (le petit-déjeuner est fini)', async () => {
    rythme(3)
    const recette = recetteAvecOignon()
    await declarer(JOUR, 9, 0, [OIGNON])

    figer(JOUR, 10, 30)
    await monterFiche(recette)

    expect(mentionsAAcheter()).toBe(0)
  }, LONG)
})

// ------------------------------------------------------------------------------------------
// Clause 6d — Aujourd'hui
// ------------------------------------------------------------------------------------------

/** Huit aliments courants — de quoi peser sur la couche `pantry` (celui de `frigo.test.tsx`). */
const FRIGO_RICHE = [
  'farine_ble',
  'oeuf',
  'sel_fin',
  'huile_olive',
  'oignon',
  'ail',
  'creme_fraiche',
  'sucre_blanc',
].map(alimentDuCatalogue)

async function monterAujourdhui(): Promise<void> {
  const { Aujourdhui } = await import('../../app/src/ui/screens/aujourdhui.js')
  const { ProvenanceLancerParcours } = await import('../../app/src/ui/lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Aujourdhui />
    </ProvenanceLancerParcours>
  )
  await screen.findByText(/sur \d+$/)
}

const platAffiche = (): string => document.querySelector('article h2')!.textContent!
const tailleListe = (): number => Number(screen.getByText(/^\d+ sur \d+$/).textContent!.split(' sur ')[1])
const bouton = (texte: RegExp) => screen.getByText(texte).closest('button') as HTMLButtonElement

/** La liste complète d'Aujourd'hui à l'heure dite, titre vérifié, dans l'ordre du classement. */
async function listeA(heure: number, minute: number, titre: string): Promise<readonly string[]> {
  figer(JOUR, heure, minute)
  await monterAujourdhui()
  expect(document.querySelector('h1')!.textContent).toBe(titre)
  const n = tailleListe()
  const plats: string[] = [platAffiche()]
  for (let i = 1; i < n; i++) {
    fireEvent.click(bouton(/Suivant/))
    plats.push(platAffiche())
  }
  cleanup()
  return plats
}

const listeDuSoir = (): Promise<readonly string[]> => listeA(14, 5, 'Ce soir')

describe('retour-7 · clause 6d — Aujourd’hui', () => {
  it('témoin : deux montages sans frigo donnent la même liste', async () => {
    const premiere = await listeDuSoir()
    const seconde = await listeDuSoir()
    expect(seconde).toEqual(premiere)
  }, LONG)

  it('témoin : un frigo déclaré à 14 h 02 CHANGE la liste de 14 h 05', async () => {
    const sansFrigo = await listeDuSoir()
    await declarer(JOUR, 14, 2, FRIGO_RICHE)
    const avecFrigo = await listeDuSoir()
    expect(avecFrigo).not.toEqual(sansFrigo)
  }, LONG)

  it('⭐ un frigo déclaré à 13 h 55 ne change RIEN à la liste de 14 h 05', async () => {
    const sansFrigo = await listeDuSoir()
    await declarer(JOUR, 13, 55, FRIGO_RICHE)
    const apres = await listeDuSoir()
    expect(apres).toEqual(sansFrigo)
  }, LONG)

  it('témoin : 3 repas, un frigo déclaré à 10 h 05 CHANGE la liste de 10 h 30 (« Ce midi »)', async () => {
    rythme(3)
    const sansFrigo = await listeA(10, 30, 'Ce midi')
    await declarer(JOUR, 10, 5, FRIGO_RICHE)
    const avecFrigo = await listeA(10, 30, 'Ce midi')
    expect(avecFrigo).not.toEqual(sansFrigo)
  }, LONG)

  it('⭐ 3 repas : un frigo déclaré à 9 h ne change RIEN à la liste de 10 h 30 (le petit-déjeuner est fini)', async () => {
    rythme(3)
    const sansFrigo = await listeA(10, 30, 'Ce midi')
    await declarer(JOUR, 9, 0, FRIGO_RICHE)
    const apres = await listeA(10, 30, 'Ce midi')
    expect(apres).toEqual(sansFrigo)
  }, LONG)
})

// ------------------------------------------------------------------------------------------
// Clause 7 — une ligne sans repas connu
// ------------------------------------------------------------------------------------------

describe('retour-7 · clause 7 — une déclaration sans repas connu ne vaut pour aucun', () => {
  it('une ligne `user_pantry (food_id)` d’une version antérieure n’apparaît pas au frigo', async () => {
    const riz = [...catalogueDeTest().foods.values()].find((f) => f.nom === RIZ.libelle)
    if (riz === undefined) throw new Error(`« ${RIZ.libelle} » absent du catalogue`)
    baseCourante().run('INSERT INTO user_pantry (food_id) VALUES (?)', [riz.id])

    expect(await frigoA(JOUR, 12, 0)).toEqual([])
  }, LONG)

  // La forme qu'a écrite TOUTE version depuis la v8 : une date du jour, sans heure. Elle ne dit pas
  // pour quel repas on a déclaré — 9 h pour midi et 15 h pour le soir y portent la même valeur.
  it('7 bis — une ligne datée du jour SANS HEURE (`declare_le` = « 2026-09-10 ») n’apparaît pas au frigo', async () => {
    const riz = [...catalogueDeTest().foods.values()].find((f) => f.nom === RIZ.libelle)
    if (riz === undefined) throw new Error(`« ${RIZ.libelle} » absent du catalogue`)
    baseCourante().run('INSERT INTO user_pantry (food_id, declare_le) VALUES (?, ?)', [riz.id, '2026-09-10'])

    expect(await frigoA(JOUR, 12, 0)).toEqual([])
  }, LONG)
})
