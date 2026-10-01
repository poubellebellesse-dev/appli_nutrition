// @vitest-environment jsdom
//
// tests/scelles/lot-F2.test.tsx — la semaine à la main, et « Vider la semaine ».
//
// Brief : `docs/CONCEPTION_RETOURS_APK.md`, « Lot F2 ». Écrit AVANT le code, depuis le « Fini
// quand » seul, contre le `catalog.db` réel.
//
// ⚠️ AUCUN IDENTIFIANT DE RECETTE EN DUR. Le plat posé à la main est lu dans la fenêtre de choix ;
// la semaine composée se déduit du moteur (lundi 2026-09-07, graine 1). Si le catalogue ne fournit
// plus le cas cherché, le message dit « SEMIS » — ce n'est alors pas la clause qui est fausse.
//
// ⚠️ LES EFFETS SE LISENT EN BASE, JAMAIS DANS LE DOM. Une frise vide affichée sans plan écrit, ou
// une confirmation qui ferme sans vider, passeraient une lecture du DOM ; pas `readLatestPlan`.
//
// ⚠️ CE QU'AUCUNE DE CES CLAUSES NE DÉMONTRE : que le ＋ se voie et se touche au pouce dans une
// frise à 3 repas. jsdom ne rend pas le CSS — à voir sur APK.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { MealPlanEntry, MealSlot, SlotRef, WeekPlan } from '../../app/src/engine/domain/index.js'
import { createEngine } from '../../app/src/engine/api/index.js'
import {
  readLatestPlan,
  readUserState,
  savePlan,
  writeMealTime,
  writeRythme,
} from '../../app/src/data/user-store.js'
import { USER_SCHEMA_VERSION } from '../../app/src/data/user-schema.js'
import { creneauxDuRythme } from '../../app/src/ui/creneau.js'
import { LIBELLE_DEHORS } from '../../app/src/ui/dehors.js'
import {
  FENETRE_HISTORIQUE_JOURS,
  LIBELLE_CRENEAU,
  PROFIL_PAR_DEFAUT,
  formaterJour,
} from '../../app/src/ui/socle.js'
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

const LUNDI = '2026-09-07'
const INSTANT_SEMIS = '2026-09-07T05:00:00Z'
const CONVIVES = 1
const LONG = 30_000

const HEURES: Readonly<Record<MealSlot, number>> = {
  petit_dejeuner: 8 * 60,
  dejeuner: 12 * 60,
  gouter: 16 * 60,
  diner: 19 * 60,
}
const ORDRE: readonly MealSlot[] = ['petit_dejeuner', 'dejeuner', 'gouter', 'diner']
/** Tout ce qui se touche ou se remplit. Une case n'en porte qu'UN (lot F1). */
const CONTROLE = 'button, a, input, select, textarea, [role="button"]'
const PLUS = /[＋+]/
const COMPOSER = 'Composer ma semaine'
const MANUELLE = 'Je la remplis moi-même'

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
  // ⚠️ `toFake: ['Date']` ET RIEN D'AUTRE : figer `setTimeout` ferait pendre `findBy*` et `waitFor`.
  vi.useFakeTimers({ toFake: ['Date'] })
  // Lundi 9 h : aucun repas n'est passé, aucune case ne porte « Décaler ce plat ? ».
  vi.setSystemTime(new Date(2026, 8, 7, 9, 0, 0))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// --- Le plan ------------------------------------------------------------------------------------

const cleDe = (s: SlotRef): string => `${s.date}|${s.creneau}`
const principaleDe = (plan: WeekPlan, s: SlotRef): MealPlanEntry | undefined =>
  plan.entries.find((e) => cleDe(e.slot) === cleDe(s) && e.service !== 'accompagnement')

function casesDuPlan(plan: WeekPlan): readonly SlotRef[] {
  return plan.entries
    .filter((e) => e.service !== 'accompagnement')
    .map((e) => e.slot)
    .sort((a, b) =>
      a.date === b.date ? ORDRE.indexOf(a.creneau) - ORDRE.indexOf(b.creneau) : a.date < b.date ? -1 : 1
    )
}

const estServie = (e: MealPlanEntry): boolean => e.recipeId !== null || e.horsCatalogue !== null

/** Créneaux servis : un créneau compte pour UN repas, plat et accompagnement compris. */
function repasServis(plan: WeekPlan): number {
  return new Set(plan.entries.filter(estServie).map((e) => cleDe(e.slot))).size
}

function exiger<T>(valeur: T | undefined, quoi: string): T {
  if (valeur === undefined) throw new Error(`lot-F2 · SEMIS, PAS CLAUSE FAUSSE : ${quoi}`)
  return valeur
}

/** Le rythme et les heures que l'écran lit, posés avant tout montage. */
function rythme(repasParJour: number): void {
  const db = baseCourante()
  writeRythme(db, { repasParJour, tempsSemaineMin: null, tempsWeekendMin: null })
  for (const creneau of creneauxDuRythme(repasParJour)) writeMealTime(db, creneau, HEURES[creneau])
}

/**
 * Écrit en base la semaine que le moteur compose le lundi, garde les cases `garder`, et pose
 * « dehors » (plat préparé, sans recette ni accompagnement) sur les cases `dehors`.
 */
function semer(
  repasParJour: number,
  garder: (plan: WeekPlan) => readonly SlotRef[] = () => [],
  dehors: (plan: WeekPlan) => readonly SlotRef[] = () => []
): WeekPlan {
  rythme(repasParJour)
  const db = baseCourante()
  const cat = catalogueDeTest()
  const m = createEngine(cat)
  const etat = readUserState(db, { windowDays: FENETRE_HISTORIQUE_JOURS, today: LUNDI }, cat.foods)
  const brut = m.planWeek({
    profile: PROFIL_PAR_DEFAUT,
    constraints: etat.constraints,
    tolerancePiquant: etat.tolerancePiquant,
    startDate: LUNDI,
    days: 7,
    slots: creneauxDuRythme(repasParJour),
    history: etat.history,
    activeTopics: etat.activeTopics,
    convives: CONVIVES,
    seed: 1,
  })
  let plan = m.planLeftovers(brut, PROFIL_PAR_DEFAUT, CONVIVES)
  const aGarder = new Set(garder(plan).map(cleDe))
  plan = { ...plan, entries: plan.entries.map((e) => (aGarder.has(cleDe(e.slot)) ? { ...e, locked: true } : e)) }
  const aSortir = new Set(dehors(plan).map(cleDe))
  plan = {
    ...plan,
    entries: plan.entries
      .filter((e) => !(aSortir.has(cleDe(e.slot)) && e.service === 'accompagnement'))
      .map((e) =>
        aSortir.has(cleDe(e.slot))
          ? { ...e, recipeId: null, portions: 0, horsCatalogue: LIBELLE_DEHORS, motifVide: null, locked: false, isLeftover: false }
          : e
      ),
  }
  savePlan(db, plan, INSTANT_SEMIS)
  return planEnBase()
}

function planEnBase(): WeekPlan {
  const plan = readLatestPlan(baseCourante())
  if (plan === null) throw new Error('lot-F2 · aucun plan en base.')
  return plan
}

/** Tout ce qui compte d'un plan, pour « rien n'a changé ». */
function empreinte(plan: WeekPlan): string {
  return JSON.stringify([
    plan.id,
    plan.days,
    ...plan.entries
      .map((e) =>
        [cleDe(e.slot), e.service ?? '', e.recipeId ?? '', e.portions, e.locked, e.isLeftover, e.horsCatalogue ?? ''].join('§')
      )
      .sort(),
  ])
}

const lignesDe = (table: string): number =>
  baseCourante().all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)[0]!.n

// --- L'écran ------------------------------------------------------------------------------------

async function monter(): Promise<void> {
  const { Semaine } = await import('../../app/src/ui/screens/semaine.js')
  const { ProvenanceLancerParcours } = await import('../../app/src/ui/lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Semaine />
    </ProvenanceLancerParcours>
  )
}

async function monterDepart(): Promise<void> {
  await monter()
  await screen.findByText(COMPOSER, undefined, { timeout: 5000 })
}

async function monterFrise(): Promise<void> {
  await monter()
  await screen.findByText('Proposer une autre semaine', undefined, { timeout: 5000 })
}

/** L'écran de départ : les deux portes, aucune journée. */
function exigerDeuxPortes(quand: string): void {
  expect(screen.getByRole('button', { name: COMPOSER }), `${quand} : « ${COMPOSER} »`).toBeDefined()
  expect(screen.getByRole('button', { name: MANUELLE }), `${quand} : « ${MANUELLE} »`).toBeDefined()
  expect(document.querySelectorAll('article'), `${quand} : aucune journée affichée`).toHaveLength(0)
}

/** La case d'un repas : le libellé du repas en est un enfant direct (lecture de `lot-F1`). */
function caseDe(slot: SlotRef): HTMLElement {
  const journee = screen.getByText(formaterJour(slot.date)).closest('article')
  if (journee === null) throw new Error(`lot-F2 · journée ${slot.date} introuvable à l’écran.`)
  const etiquette = within(journee as HTMLElement).getAllByText(LIBELLE_CRENEAU[slot.creneau])[0]
  const carte = etiquette?.parentElement
  if (!carte) throw new Error(`lot-F2 · case ${cleDe(slot)} introuvable à l’écran.`)
  return carte
}

const controlesDe = (racine: ParentNode): HTMLElement[] => [...racine.querySelectorAll<HTMLElement>(CONTROLE)]
const dialogues = (): HTMLElement[] => screen.queryAllByRole('dialog')
const nomDuDialogue = (d: HTMLElement): string => d.getAttribute('aria-label') ?? ''

/** Règle l'écran de départ à `jours` jours et `repas` repas, puis ouvre la porte manuelle. */
async function semaineManuelle(jours: number, repas: number): Promise<void> {
  const champ = screen.getByLabelText(/Nombre de jours/) as HTMLInputElement
  fireEvent.change(champ, { target: { value: String(jours) } })
  fireEvent.blur(champ)
  fireEvent.change(screen.getByLabelText(/Repas par jour/), { target: { value: String(repas) } })
  fireEvent.click(screen.getByRole('button', { name: MANUELLE }))
  await waitFor(() => expect(readLatestPlan(baseCourante()), 'la porte manuelle écrit un plan').not.toBeNull())
  await waitFor(() => expect(document.querySelectorAll('article')).toHaveLength(jours))
}

/** Touche le ＋ d'une case vide, choisit le premier plat de la fenêtre, rend sa recette. */
async function poserAuPlus(slot: SlotRef): Promise<string> {
  const controles = controlesDe(caseDe(slot))
  expect(controles, `case vide ${cleDe(slot)} : un seul contrôle`).toHaveLength(1)
  fireEvent.click(controles[0]!)
  const d = await screen.findByRole('dialog')
  const lignes = [...d.querySelectorAll<HTMLElement>('li > button')]
  const nomDeLigne = (b: HTMLElement): string => (b.querySelector('.font-titre')?.textContent ?? '').trim()
  const ligne = exiger(
    lignes.find((b) => nomDeLigne(b) !== ''),
    'aucun plat dans la fenêtre de choix'
  )
  const ids = [...catalogueDeTest().recipes.values()].filter((r) => r.nom === nomDeLigne(ligne)).map((r) => r.id)
  expect(ids, `SEMIS : « ${nomDeLigne(ligne)} » doit nommer une seule recette`).toHaveLength(1)
  fireEvent.click(ligne)
  await waitFor(() => expect(principaleDe(planEnBase(), slot)?.recipeId).toBe(ids[0]))
  await waitFor(() => expect(dialogues()).toHaveLength(0))
  return ids[0]!
}

/** Ouvre ⚙, touche « Vider la semaine », rend la confirmation. */
async function demanderVider(): Promise<HTMLElement> {
  fireEvent.click(screen.getByRole('button', { name: 'Réglages de la semaine' }))
  const reglages = await screen.findByRole('dialog')
  fireEvent.click(within(reglages).getByRole('button', { name: /Vider la semaine/ }))
  return waitFor(() => {
    const ouverts = dialogues()
    expect(ouverts, 'une seule fenêtre : la confirmation').toHaveLength(1)
    expect(ouverts[0]!.textContent ?? '').not.toMatch(/Repas par jour/)
    return ouverts[0]!
  })
}

/** Les deux réponses de la confirmation, et rien d'autre que « Retour ». */
function reponses(confirmation: HTMLElement): { readonly annuler: HTMLElement; readonly vider: HTMLElement } {
  const boutons = within(confirmation).getAllByRole('button')
  const annuler = boutons.filter((b) => /annuler/i.test(b.textContent ?? ''))
  const vider = boutons.filter((b) => /vider/i.test(b.textContent ?? ''))
  expect(annuler, 'un bouton « Annuler »').toHaveLength(1)
  expect(vider, 'un bouton qui vide').toHaveLength(1)
  return { annuler: annuler[0]!, vider: vider[0]! }
}

// =================================================================================================
// Clause 1 — deux portes
// =================================================================================================

describe('lot-F2 · clause 1 — l’écran de départ ouvre deux portes', () => {
  it('sans plan : « Composer ma semaine » et « Je la remplis moi-même », et rien en base', async () => {
    rythme(2)
    await monterDepart()
    exigerDeuxPortes('au premier montage')
    expect(readLatestPlan(baseCourante()), 'rien n’est écrit au montage').toBeNull()
  })
})

// =================================================================================================
// Clause 2 — la porte manuelle
// =================================================================================================

describe('lot-F2 · clause 2 — « Je la remplis moi-même » écrit une semaine vide', () => {
  it(
    'un autre jour (mercredi 2026-09-16), 5 jours × 2 repas : 10 créneaux vides, du 16 au 20',
    async () => {
      vi.setSystemTime(new Date(2026, 8, 16, 9, 0, 0))
      rythme(1)
      await monterDepart()
      await semaineManuelle(5, 2)
      const cases = casesDuPlan(planEnBase())
      expect(cases, 'jours × repas créneaux').toHaveLength(10)
      expect([...new Set(cases.map((s) => s.date))].sort(), 'cinq jours consécutifs, à partir d’aujourd’hui').toEqual([
        '2026-09-16',
        '2026-09-17',
        '2026-09-18',
        '2026-09-19',
        '2026-09-20',
      ])
      expect(new Set(cases.map((s) => s.creneau)).size, 'deux repas par jour').toBe(2)
      expect(planEnBase().entries.filter(estServie), 'tous vides').toHaveLength(0)
    },
    LONG
  )

  it(
    '3 jours, 3 repas : 9 créneaux en base, tous vides, et la frise montre 3 journées',
    async () => {
      rythme(2)
      await monterDepart()
      await semaineManuelle(3, 3)
      const plan = planEnBase()
      const cases = casesDuPlan(plan)
      expect(cases, 'jours × repas créneaux').toHaveLength(9)
      expect([...new Set(cases.map((s) => s.date))].sort(), 'trois jours consécutifs, à partir d’aujourd’hui').toEqual([
        '2026-09-07',
        '2026-09-08',
        '2026-09-09',
      ])
      expect(new Set(cases.map((s) => s.creneau))).toEqual(new Set(['petit_dejeuner', 'dejeuner', 'diner']))
      for (const e of plan.entries) {
        expect(e.recipeId, `${cleDe(e.slot)} : aucun plat`).toBeNull()
        expect(e.horsCatalogue, `${cleDe(e.slot)} : aucun plat préparé`).toBeNull()
        expect(e.locked, `${cleDe(e.slot)} : rien de gardé`).toBe(false)
        expect(e.isLeftover, `${cleDe(e.slot)} : aucun reste`).toBe(false)
        expect(e.motifVide, `${cleDe(e.slot)} : vide parce qu'à remplir, pas faute de candidat`).toBe('a_remplir')
      }
    },
    LONG
  )
})

// =================================================================================================
// Clause 3 — le ＋
// =================================================================================================

describe('lot-F2 · clause 3 — le ＋ d’une case vide ouvre « Choisir un plat » directement', () => {
  it(
    'un seul contrôle « ＋ », une seule fenêtre au bon titre, le plat touché sur CETTE case seulement',
    async () => {
      rythme(2)
      await monterDepart()
      await semaineManuelle(3, 3)
      const cases = casesDuPlan(planEnBase())
      const cible = cases[4]!

      for (const s of cases) {
        const controles = controlesDe(caseDe(s))
        expect(controles, `case vide ${cleDe(s)} : un seul contrôle`).toHaveLength(1)
        expect(controles[0]!.textContent ?? '', `case vide ${cleDe(s)} : le ＋`).toMatch(PLUS)
        expect(controles[0]!.getAttribute('aria-haspopup')).toBe('dialog')
      }

      fireEvent.click(controlesDe(caseDe(cible))[0]!)
      const d = await screen.findByRole('dialog')
      expect(dialogues(), 'une seule fenêtre').toHaveLength(1)
      expect(nomDuDialogue(d)).toMatch(/^Choisir un plat — /)
      expect(nomDuDialogue(d)).toContain(formaterJour(cible.date))
      expect(nomDuDialogue(d)).toContain(`· ${LIBELLE_CRENEAU[cible.creneau]}`)
      expect(within(d).getAllByRole('tab').length, 'les onglets de la fenêtre de choix').toBeGreaterThanOrEqual(3)
      fireEvent.click(within(d).getByText(/Retour/))
      await waitFor(() => expect(dialogues()).toHaveLength(0))

      const pose = await poserAuPlus(cible)
      const apres = planEnBase()
      for (const s of cases) {
        if (cleDe(s) === cleDe(cible)) continue
        const e = principaleDe(apres, s)!
        expect(estServie(e), `${cleDe(s)} reste vide`).toBe(false)
      }
      const nom = catalogueDeTest().recipes.get(pose as never)!.nom
      expect(caseDe(cible).textContent ?? '', 'la case montre le plat').toContain(nom)

      const controles = controlesDe(caseDe(cible))
      expect(controles).toHaveLength(1)
      expect(controles[0]!.textContent ?? '', 'plus de ＋ sur une case remplie').not.toMatch(PLUS)
      fireEvent.click(controles[0]!)
      const gestes = await screen.findByRole('dialog')
      expect(nomDuDialogue(gestes), 'une case remplie ouvre ses gestes, pas le choix').not.toMatch(/^Choisir un plat/)
    },
    LONG
  )
})

// =================================================================================================
// Clauses 4 et 5 — « Vider la semaine »
// =================================================================================================

describe('lot-F2 · clause 4 — « Vider la semaine » demande, et « Annuler » ne change rien', () => {
  it(
    '2 repas, une case gardée, un repas dehors : la confirmation dit « N repas », « Annuler » laisse le plan identique',
    async () => {
      const servies = (p: WeekPlan): readonly SlotRef[] =>
        casesDuPlan(p).filter((s) => principaleDe(p, s)?.recipeId != null && !principaleDe(p, s)!.isLeftover)
      const plan = semer(
        2,
        (p) => [exiger(servies(p)[0], 'aucune case servie')],
        (p) => [exiger(servies(p)[1], 'pas de seconde case servie')]
      )
      expect(plan.entries.some((e) => e.locked), 'SEMIS : une case gardée').toBe(true)
      expect(plan.entries.some((e) => e.horsCatalogue !== null), 'SEMIS : un repas dehors').toBe(true)
      const avant = empreinte(plan)
      // N = créneaux servis : plat OU plat préparé, un créneau = un repas, accompagnement compris.
      const n = repasServis(plan)
      expect(n, 'SEMIS : un compte distinct de celui de la clause 4 bis').toBeGreaterThan(1)
      // Les deux comptes naïfs doivent tomber À CÔTÉ, sinon la clause ne les distingue pas.
      const lignesAvecPlat = plan.entries.filter((e) => e.recipeId !== null).length
      const creneauxAvecPlat = new Set(plan.entries.filter((e) => e.recipeId !== null).map((e) => cleDe(e.slot))).size
      expect(lignesAvecPlat, 'SEMIS : compter les lignes (accompagnements) doit donner autre chose').not.toBe(n)
      expect(creneauxAvecPlat, 'SEMIS : ignorer le plat préparé doit donner autre chose').not.toBe(n)
      await monterFrise()

      const confirmation = await demanderVider()
      expect(confirmation.textContent ?? '', 'la confirmation dit combien').toMatch(new RegExp(`\\b${n}\\s+repas`))
      expect(empreinte(planEnBase()), 'demander ne vide pas').toBe(avant)

      fireEvent.click(reponses(confirmation).annuler)
      await waitFor(() => expect(dialogues()).toHaveLength(0))
      expect(empreinte(planEnBase()), '« Annuler » ne change rien').toBe(avant)
      expect(screen.getByText('Proposer une autre semaine')).toBeDefined()
    },
    LONG
  )
})

describe('lot-F2 · clause 4 bis — le compte de la confirmation se lit dans le plan', () => {
  it(
    'semaine manuelle 3 × 2 avec UN plat posé au ＋ : la confirmation dit « 1 repas »',
    async () => {
      rythme(2)
      await monterDepart()
      await semaineManuelle(3, 2)
      await poserAuPlus(casesDuPlan(planEnBase())[2]!)
      expect(repasServis(planEnBase()), 'un seul créneau servi').toBe(1)
      const avant = empreinte(planEnBase())

      const confirmation = await demanderVider()
      expect(confirmation.textContent ?? '').toMatch(/(^|[^0-9])1\s+repas/)
      fireEvent.click(reponses(confirmation).annuler)
      await waitFor(() => expect(dialogues()).toHaveLength(0))
      expect(empreinte(planEnBase()), '« Annuler » ne change rien').toBe(avant)
    },
    LONG
  )
})

describe('lot-F2 · clause 5 — confirmer vide tout, gardés compris', () => {
  it(
    'même plan, aucun créneau servi, aucun gardé, et l’écran revient aux deux portes',
    async () => {
      const plan = semer(2, (p) => [exiger(casesDuPlan(p).find((s) => estServie(principaleDe(p, s)!)), 'aucune case servie')])
      await monterFrise()
      fireEvent.click(reponses(await demanderVider()).vider)
      await waitFor(() => expect(repasServis(planEnBase()), 'aucun créneau servi').toBe(0))
      const apres = planEnBase()
      expect(apres.id, 'même plan : vider réécrit, ne supprime pas').toBe(plan.id)
      expect(apres.days).toBe(plan.days)
      expect(new Set(casesDuPlan(apres).map(cleDe)), 'mêmes créneaux').toEqual(new Set(casesDuPlan(plan).map(cleDe)))
      expect(apres.entries.filter((e) => e.locked), 'aucun gardé').toHaveLength(0)
      for (const s of casesDuPlan(apres)) {
        expect(principaleDe(apres, s)!.motifVide, `${cleDe(s)} : vidée à la main`).toBe('a_remplir')
      }
      await waitFor(() => exigerDeuxPortes('après « Vider »'))
    },
    LONG
  )
})

// =================================================================================================
// Clause 6 — au remontage
// =================================================================================================

describe('lot-F2 · clause 6 — ce qui tient au remontage', () => {
  it(
    'après « Vider » : les deux portes',
    async () => {
      semer(2)
      await monterFrise()
      fireEvent.click(reponses(await demanderVider()).vider)
      await waitFor(() => expect(repasServis(planEnBase())).toBe(0))
      cleanup()
      await monterDepart()
      exigerDeuxPortes('au remontage après « Vider »')
    },
    LONG
  )

  it(
    'une semaine manuelle restée vide : les deux portes ; avec un plat : la frise, avec ce plat',
    async () => {
      rythme(2)
      await monterDepart()
      await semaineManuelle(3, 2)
      cleanup()
      await monterDepart()
      exigerDeuxPortes('au remontage d’une semaine manuelle vide')

      // Une seconde géométrie : la grille se calcule, elle ne se recopie pas.
      await semaineManuelle(4, 1)
      const grille = casesDuPlan(planEnBase())
      expect(grille, '4 jours × 1 repas').toHaveLength(4)
      expect(new Set(grille.map((s) => s.creneau)).size, 'un seul repas par jour').toBe(1)
      const cible = grille[3]!
      const pose = await poserAuPlus(cible)
      cleanup()
      await monterFrise()
      const nom = catalogueDeTest().recipes.get(pose as never)!.nom
      expect(caseDe(cible).textContent ?? '', 'le plat posé à la main survit au remontage').toContain(nom)
    },
    LONG
  )
})

// =================================================================================================
// Clause 7 — rien d'autre ne bouge
// =================================================================================================

describe('lot-F2 · clause 7 — « Vider » ne touche qu’au plan', () => {
  it(
    'ni historique, ni signal, et le schéma reste en version 21',
    async () => {
      semer(2)
      const historique = lignesDe('meal_history')
      const signaux = lignesDe('user_signal')
      await monterFrise()
      fireEvent.click(reponses(await demanderVider()).vider)
      await waitFor(() => expect(repasServis(planEnBase())).toBe(0))
      expect(lignesDe('meal_history'), 'historique intact').toBe(historique)
      expect(lignesDe('user_signal'), 'signaux intacts').toBe(signaux)
      expect(USER_SCHEMA_VERSION).toBe(21)
    },
    LONG
  )
})
