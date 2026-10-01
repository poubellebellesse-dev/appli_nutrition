// @vitest-environment jsdom
//
// tests/scelles/lot-F1.test.tsx — la semaine en frise, les gestes dans une fenêtre.
//
// Brief : `docs/CONCEPTION_RETOURS_APK.md`, « Lot F1 ». Écrit AVANT le code, depuis le « Fini
// quand » seul, contre le `catalog.db` réel.
//
// ⚠️ AUCUN IDENTIFIANT DE RECETTE EN DUR. Les cases visées se DÉDUISENT du plan que le moteur
// compose (lundi 2026-09-07, graine 1). Si le catalogue ne fournit plus le cas cherché, le message
// dit « SEMIS » — ce n'est alors pas la clause qui est fausse.
//
// ⚠️ LES EFFETS SE LISENT EN BASE, JAMAIS DANS LE DOM. Une fenêtre dont les boutons ferment sans
// écrire passerait une lecture du DOM ; elle ne passe pas `readLatestPlan`.
//
// ⚠️ CE QU'AUCUNE DE CES CLAUSES NE DÉMONTRE : que la frise tienne sur la largeur d'un téléphone,
// que le nom sur deux lignes reste lisible, que la vignette se touche au pouce. jsdom ne rend pas le
// CSS — à voir sur APK.

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
import { creneauxDuRythme } from '../../app/src/ui/creneau.js'
import { LIBELLE_DEHORS } from '../../app/src/ui/dehors.js'
import { hashDeRecette } from '../../app/src/ui/router.js'
import { initialeDeRecette } from '../../app/src/ui/vignette.js'
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
/** La fin de chaque repas, heure locale — recopiée de `creneau.ts`, pas importée (même choix que `retour-8`). */
const HEURE_DE_FIN: Readonly<Record<MealSlot, number>> = {
  petit_dejeuner: 10,
  dejeuner: 14,
  gouter: 17,
  diner: 24,
}
const ORDRE: readonly MealSlot[] = ['petit_dejeuner', 'dejeuner', 'gouter', 'diner']
const QUESTION = /Décaler ce plat\s*\?/
/** Tout ce qui se touche ou se remplit. La case n'en porte qu'UN. */
const CONTROLE = 'button, a, input, select, textarea, [role="button"]'
const MARQUES = ['📌', '↺', '🚶'] as const

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
  // ⚠️ `toFake: ['Date']` ET RIEN D'AUTRE : figer `setTimeout` ferait pendre `findBy*` et `waitFor`.
  vi.useFakeTimers({ toFake: ['Date'] })
  // Lundi 9 h : aucun repas n'est passé, aucune case ne porte « Décaler ce plat ? ».
  figer(7, 9, 0)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function figer(jour: number, heure: number, minute: number): void {
  vi.setSystemTime(new Date(2026, 8, jour, heure, minute, 0))
}

// --- Le plan ------------------------------------------------------------------------------------

const cleDe = (s: SlotRef): string => `${s.date}|${s.creneau}`
const principaleDe = (plan: WeekPlan, s: SlotRef): MealPlanEntry | undefined =>
  plan.entries.find((e) => cleDe(e.slot) === cleDe(s) && e.service !== 'accompagnement')
const accompagnementDe = (plan: WeekPlan, s: SlotRef): MealPlanEntry | undefined =>
  plan.entries.find((e) => cleDe(e.slot) === cleDe(s) && e.service === 'accompagnement')

function casesDuPlan(plan: WeekPlan): readonly SlotRef[] {
  return plan.entries
    .filter((e) => e.service !== 'accompagnement')
    .map((e) => e.slot)
    .sort((a, b) =>
      a.date === b.date ? ORDRE.indexOf(a.creneau) - ORDRE.indexOf(b.creneau) : a.date < b.date ? -1 : 1
    )
}

/** Une case « proposée » : un plat du catalogue, ni reste, ni gardé, ni dehors. */
function estProposee(plan: WeekPlan, s: SlotRef): boolean {
  const e = principaleDe(plan, s)
  return e !== undefined && e.recipeId !== null && !e.isLeftover && !e.locked && e.horsCatalogue === null
}

const nomDe = (id: string): string => catalogueDeTest().recipes.get(id as never)!.nom

const moteur = () => createEngine(catalogueDeTest())

interface Retouche {
  readonly garder?: readonly SlotRef[]
  readonly dehors?: readonly SlotRef[]
}

/**
 * Écrit en base le planning que l'écran aurait composé le lundi — mêmes appels, graine fixe — puis
 * applique `retouche` au plan obtenu. Rend le plan relu.
 */
function semer(repasParJour: number, retouche: (plan: WeekPlan) => Retouche = () => ({})): WeekPlan {
  const db = baseCourante()
  const creneaux = creneauxDuRythme(repasParJour)
  writeRythme(db, { repasParJour, tempsSemaineMin: null, tempsWeekendMin: null })
  for (const creneau of creneaux) writeMealTime(db, creneau, HEURES[creneau])

  const cat = catalogueDeTest()
  const m = createEngine(cat)
  const etat = readUserState(db, { windowDays: FENETRE_HISTORIQUE_JOURS, today: LUNDI }, cat.foods)
  const brut = m.planWeek({
    profile: PROFIL_PAR_DEFAUT,
    constraints: etat.constraints,
    tolerancePiquant: etat.tolerancePiquant,
    startDate: LUNDI,
    days: 7,
    slots: creneaux,
    history: etat.history,
    activeTopics: etat.activeTopics,
    convives: CONVIVES,
    seed: 1,
  })
  let plan = m.planLeftovers(brut, PROFIL_PAR_DEFAUT, CONVIVES)
  const r = retouche(plan)
  const aGarder = new Set((r.garder ?? []).map(cleDe))
  plan = { ...plan, entries: plan.entries.map((e) => (aGarder.has(cleDe(e.slot)) ? { ...e, locked: true } : e)) }
  for (const s of r.dehors ?? []) plan = m.setSlotHorsCatalogue(plan, s, LIBELLE_DEHORS, PROFIL_PAR_DEFAUT)
  savePlan(db, plan, INSTANT_SEMIS)
  return planEnBase()
}

function planEnBase(): WeekPlan {
  const plan = readLatestPlan(baseCourante())
  if (plan === null) throw new Error('lot-F1 · SEMIS : aucun plan en base — ce n’est pas une clause.')
  return plan
}

function exiger<T>(valeur: T | undefined, quoi: string): T {
  if (valeur === undefined) throw new Error(`lot-F1 · SEMIS, PAS CLAUSE FAUSSE : ${quoi}`)
  return valeur
}

/** Tout ce qui compte d'un plan, pour « rien n'a changé ». */
function empreinte(plan: WeekPlan): string {
  return JSON.stringify(
    plan.entries
      .map((e) =>
        [cleDe(e.slot), e.service ?? '', e.recipeId ?? '', e.portions, e.locked, e.isLeftover, e.horsCatalogue ?? ''].join('§')
      )
      .sort()
  )
}

// --- L'écran ------------------------------------------------------------------------------------

async function monterSemaine(): Promise<void> {
  const { Semaine } = await import('../../app/src/ui/screens/semaine.js')
  const { ProvenanceLancerParcours } = await import('../../app/src/ui/lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Semaine />
    </ProvenanceLancerParcours>
  )
  await screen.findByText('Proposer une autre semaine', undefined, { timeout: 5000 })
}

/** La case d'un repas : le libellé du repas en est un enfant direct (lecture de `retour-3`/`retour-8`). */
function caseDe(slot: SlotRef): HTMLElement {
  const journee = screen.getByText(formaterJour(slot.date)).closest('article')
  if (journee === null) throw new Error(`lot-F1 · journée ${slot.date} introuvable à l’écran.`)
  const etiquette = within(journee as HTMLElement).getAllByText(LIBELLE_CRENEAU[slot.creneau])[0]
  const carte = etiquette?.parentElement
  if (!carte) throw new Error(`lot-F1 · case ${cleDe(slot)} introuvable à l’écran.`)
  return carte
}

const controlesDe = (racine: ParentNode): HTMLElement[] => [...racine.querySelectorAll<HTMLElement>(CONTROLE)]

const dialogues = (): HTMLElement[] => screen.queryAllByRole('dialog')

/** Toucher la vignette : le seul contrôle de la case. Rend la fenêtre ouverte. */
async function ouvrir(slot: SlotRef): Promise<HTMLElement> {
  const controles = controlesDe(caseDe(slot))
  expect(controles, `case ${cleDe(slot)} : un seul contrôle attendu`).toHaveLength(1)
  fireEvent.click(controles[0]!)
  const dialogue = await screen.findByRole('dialog')
  expect(dialogues(), 'une seule fenêtre ouverte').toHaveLength(1)
  return dialogue
}

const nomDuDialogue = (d: HTMLElement): string => d.getAttribute('aria-label') ?? ''

function exigerNomJourRepas(d: HTMLElement, slot: SlotRef): void {
  const nom = nomDuDialogue(d)
  expect(nom, `fenêtre de ${cleDe(slot)}`).toContain(formaterJour(slot.date))
  expect(nom, `fenêtre de ${cleDe(slot)}`).toContain(`· ${LIBELLE_CRENEAU[slot.creneau]}`)
}

const echapper = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

async function plusAucuneFenetre(geste: string): Promise<void> {
  await waitFor(() => expect(dialogues(), `après « ${geste} », la fenêtre se referme`).toHaveLength(0))
}

// =================================================================================================
// Clause 1 — la frise
// =================================================================================================

describe('lot-F1 · clause 1 — la frise : une ligne par jour, un seul contrôle par case', () => {
  it(
    '3 repas, 7 jours : 7 articles dans l’ordre, les repas du matin au soir, un bouton par case et rien d’autre',
    async () => {
      const plan = semer(3)
      await monterSemaine()

      const dates = [...new Set(casesDuPlan(plan).map((s) => s.date))]
      expect(dates, 'SEMIS : sept journées attendues').toHaveLength(7)
      const articles = [...document.querySelectorAll('article')]
      expect(articles).toHaveLength(7)
      articles.forEach((a, i) => expect(a.textContent ?? '').toContain(formaterJour(dates[i]!)))

      for (const date of dates) {
        const cases = casesDuPlan(plan).filter((s) => s.date === date)
        expect(cases.map((s) => s.creneau)).toEqual(['petit_dejeuner', 'dejeuner', 'diner'])
        const elements = cases.map(caseDe)
        for (let i = 1; i < elements.length; i++) {
          expect(
            elements[i - 1]!.compareDocumentPosition(elements[i]!) & Node.DOCUMENT_POSITION_FOLLOWING,
            `${date} : ${LIBELLE_CRENEAU[cases[i - 1]!.creneau]} avant ${LIBELLE_CRENEAU[cases[i]!.creneau]}`
          ).toBeTruthy()
        }
        for (const [i, s] of cases.entries()) {
          const carte = elements[i]!
          const controles = controlesDe(carte)
          expect(
            controles.map((c) => c.tagName.toLowerCase() + ':' + (c.textContent ?? '').trim()),
            `case ${cleDe(s)} : exactement un contrôle`
          ).toHaveLength(1)
          expect(controles[0]!.tagName).toBe('BUTTON')
          expect(controles[0]!.getAttribute('aria-haspopup')).toBe('dialog')
          const e = principaleDe(plan, s)!
          if (e.recipeId !== null) expect(carte.textContent ?? '').toContain(nomDe(e.recipeId))
        }
        const article = elements[0]!.closest('article')!
        expect(
          controlesDe(article),
          `${date} : l’article ne porte que les vignettes de ses ${cases.length} cases`
        ).toHaveLength(cases.length)
      }
    },
    LONG
  )
})

// =================================================================================================
// Clause 2 — la vignette
// =================================================================================================

describe('lot-F1 · clause 2 — la vignette : la photo quand elle existe, l’initiale sinon', () => {
  it(
    'chaque case d’un plat du catalogue montre sa photo, ou aucun img et son initiale',
    async () => {
      const plan = semer(3)
      await monterSemaine()
      let avecPhoto = 0
      let sansPhoto = 0
      for (const s of casesDuPlan(plan)) {
        const e = principaleDe(plan, s)!
        if (e.recipeId === null) continue
        const recette = catalogueDeTest().recipes.get(e.recipeId)!
        const carte = caseDe(s)
        const images = [...carte.querySelectorAll('img')]
        if (recette.imagePath !== null) {
          avecPhoto++
          expect(images, `case ${cleDe(s)} (${recette.nom}) : une photo`).toHaveLength(1)
          expect(images[0]!.getAttribute('src') ?? '').toMatch(new RegExp(`${echapper(recette.imagePath)}$`))
        } else {
          sansPhoto++
          expect(images, `case ${cleDe(s)} (${recette.nom}) : aucune photo, le plat n’en a pas`).toHaveLength(0)
          const initiale = initialeDeRecette(recette.nom)
          const vue = [...carte.querySelectorAll<HTMLElement>('*')].some((n) => (n.textContent ?? '').trim() === initiale)
          expect(vue, `case ${cleDe(s)} (${recette.nom}) : l’initiale « ${initiale} »`).toBe(true)
        }
      }
      if (avecPhoto === 0 || sansPhoto === 0) {
        throw new Error(`lot-F1 · SEMIS, PAS CLAUSE FAUSSE : ${avecPhoto} case(s) avec photo, ${sansPhoto} sans — il en faut de chaque.`)
      }
    },
    LONG
  )
})

// =================================================================================================
// Clause 3 — les marques
// =================================================================================================

describe('lot-F1 · clause 3 — les marques disent l’état, en signe ET en mot', () => {
  it(
    'gardé 📌, reste ↺, dehors 🚶 ; une case proposée n’en porte aucune',
    async () => {
      let garde: SlotRef | undefined
      let dehors: SlotRef | undefined
      const plan = semer(3, (p) => {
        const proposees = casesDuPlan(p).filter((s) => estProposee(p, s))
        garde = proposees[0]
        dehors = proposees[1]
        return { garder: garde ? [garde] : [], dehors: dehors ? [dehors] : [] }
      })
      const g = exiger(garde, 'aucune case proposée à garder')
      const d = exiger(dehors, 'aucune seconde case proposée pour « dehors »')
      const reste = exiger(
        casesDuPlan(plan).find((s) => {
          const e = principaleDe(plan, s)!
          return e.isLeftover && !e.locked
        }),
        'aucun reste non gardé dans la semaine'
      )
      const simple = exiger(
        casesDuPlan(plan).find((s) => estProposee(plan, s)),
        'aucune case proposée restante'
      )
      await monterSemaine()

      const texte = (s: SlotRef): string => caseDe(s).textContent ?? ''
      expect(texte(g)).toContain('📌')
      expect(texte(g)).toContain('Gardé')
      expect(texte(reste)).toContain('↺')
      expect(texte(reste)).toContain('Reste')
      expect(texte(d)).toContain('🚶')
      expect(texte(d)).toContain(LIBELLE_DEHORS)
      for (const m of MARQUES) expect(texte(simple), `case proposée ${cleDe(simple)} : pas de ${m}`).not.toContain(m)
    },
    LONG
  )
})

// =================================================================================================
// Clause 4 — la fenêtre
// =================================================================================================

describe('lot-F1 · clause 4 — toucher la vignette ouvre UNE fenêtre qui porte les gestes de CETTE case', () => {
  it(
    'une case avec restes servables et une sans : même tronc, « Manger un reste » seulement là où il sert',
    async () => {
      const plan = semer(3)
      const m = moteur()
      const proposees = casesDuPlan(plan).filter((s) => estProposee(plan, s))
      const servable = exiger(
        proposees.find((s) => m.sourcesDeReste(plan, s, CONVIVES).length > 0),
        'aucune case proposée où un reste est servable'
      )
      const nonServable = exiger(
        proposees.find((s) => m.sourcesDeReste(plan, s, CONVIVES).length === 0),
        'aucune case proposée sans reste servable'
      )

      for (const [s, reste] of [
        [servable, true],
        [nonServable, false],
      ] as const) {
        cleanup()
        await monterSemaine()
        expect(dialogues(), 'aucune fenêtre avant le toucher').toHaveLength(0)
        const d = await ouvrir(s)
        exigerNomJourRepas(d, s)
        const e = principaleDe(plan, s)!
        const lien = within(d).getByRole('link', { name: /Voir la recette/ })
        expect(lien.getAttribute('href')).toBe(hashDeRecette(e.recipeId!, 'semaine'))
        expect(within(d).getByRole('button', { name: /^Changer$/ })).toBeDefined()
        expect(within(d).getByRole('button', { name: /Choisir moi-même/ })).toBeDefined()
        expect(within(d).getByRole('button', { name: /^Garder$/ })).toBeDefined()
        expect(within(d).getByRole('button', { name: /Je mange dehors/ })).toBeDefined()
        expect(
          within(d).queryByRole('button', { name: /Manger un reste/ }) !== null,
          `case ${cleDe(s)} : « Manger un reste » ${reste ? 'attendu' : 'absent'}`
        ).toBe(reste)
        expect(within(d).queryByRole('button', { name: /Remettre le plat prévu|Finalement je mange ici/ })).toBeNull()
        const accompagnement = accompagnementDe(plan, s)
        if (accompagnement?.recipeId != null) {
          expect(d.textContent ?? '', `case ${cleDe(s)} : l’accompagnement se lit dans la fenêtre`).toContain(
            nomDe(accompagnement.recipeId)
          )
        }
      }
    },
    LONG
  )
})

// =================================================================================================
// Clause 5 — chaque geste agit, en base, et referme
// =================================================================================================

describe('lot-F1 · clause 5 — chaque geste de la fenêtre écrit en base, puis la fenêtre se referme', () => {
  it(
    '(a) « Changer » : la case reçoit LE plat que le moteur tire, toutes les autres cases restent identiques',
    async () => {
      const plan = semer(3)
      const s = exiger(casesDuPlan(plan).find((x) => estProposee(plan, x)), 'aucune case proposée')
      const cle = (e: MealPlanEntry): string => `${cleDe(e.slot)}|${e.service ?? ''}`
      const avant = new Map(plan.entries.map((e) => [cle(e), e.recipeId]))
      const ancien = principaleDe(plan, s)!.recipeId!
      // Le tirage attendu, recalculé comme l'écran le fait (`changer`, `semaine.tsx`) : même état
      // utilisateur, même graine, le plat refusé exclu. « Un autre plat » ne suffit pas — un
      // « Changer » qui poserait le voisin du catalogue sans passer par le moteur ignorerait régime,
      // allergies et récence, et passerait une simple inégalité.
      const cat = catalogueDeTest()
      const etat = readUserState(baseCourante(), { windowDays: FENETRE_HISTORIQUE_JOURS, today: LUNDI }, cat.foods)
      const attendu = principaleDe(
        moteur().rerollSlot(
          plan,
          s,
          {
            profile: PROFIL_PAR_DEFAUT,
            constraints: etat.constraints,
            tolerancePiquant: etat.tolerancePiquant,
            history: etat.history,
            activeTopics: etat.activeTopics,
            seed: plan.seed,
          },
          { excludeRecipeIds: [ancien] }
        ),
        s
      )!.recipeId
      expect(attendu, 'SEMIS : le moteur doit tirer un autre plat').not.toBe(ancien)
      await monterSemaine()
      fireEvent.click(within(await ouvrir(s)).getByRole('button', { name: /^Changer$/ }))
      await waitFor(() => expect(principaleDe(planEnBase(), s)!.recipeId).toBe(attendu))
      await plusAucuneFenetre('Changer')
      const apres = new Map(planEnBase().entries.map((e) => [cle(e), e.recipeId]))
      for (const [k, id] of avant) {
        if (k.startsWith(`${cleDe(s)}|`)) continue
        expect(apres.get(k), `« Changer » sur ${cleDe(s)} a touché ${k}`).toBe(id)
      }
    },
    LONG
  )

  it(
    '(b) « Garder » : la case est gardée ; rouverte, « Relâcher » est pressé et « Changer » désactivé',
    async () => {
      const plan = semer(3)
      const s = exiger(casesDuPlan(plan).find((x) => estProposee(plan, x)), 'aucune case proposée')
      await monterSemaine()
      fireEvent.click(within(await ouvrir(s)).getByRole('button', { name: /^Garder$/ }))
      await waitFor(() => expect(principaleDe(planEnBase(), s)!.locked).toBe(true))
      await plusAucuneFenetre('Garder')
      const d = await ouvrir(s)
      const relacher = within(d).getByRole('button', { name: /Relâcher/ })
      expect(relacher.getAttribute('aria-pressed')).toBe('true')
      expect((within(d).getByRole('button', { name: /^Changer$/ }) as HTMLButtonElement).disabled).toBe(true)
    },
    LONG
  )

  it(
    '(c) « Je mange dehors » puis « Finalement je mange ici » : la même recette revient',
    async () => {
      const plan = semer(3)
      const s = exiger(casesDuPlan(plan).find((x) => estProposee(plan, x)), 'aucune case proposée')
      const ancien = principaleDe(plan, s)!.recipeId
      await monterSemaine()
      fireEvent.click(within(await ouvrir(s)).getByRole('button', { name: /Je mange dehors/ }))
      await waitFor(() => expect(principaleDe(planEnBase(), s)!.horsCatalogue).toBe(LIBELLE_DEHORS))
      await plusAucuneFenetre('Je mange dehors')
      fireEvent.click(within(await ouvrir(s)).getByRole('button', { name: /Finalement je mange ici/ }))
      await waitFor(() => {
        const e = principaleDe(planEnBase(), s)!
        expect(e.horsCatalogue).toBeNull()
        expect(e.recipeId).toBe(ancien)
      })
      await plusAucuneFenetre('Finalement je mange ici')
    },
    LONG
  )

  it(
    '(d) « Manger un reste » : une seule fenêtre, la case devient un reste, « Remettre le plat prévu » la rend',
    async () => {
      const plan = semer(3)
      const m = moteur()
      const s = exiger(
        casesDuPlan(plan).find((x) => estProposee(plan, x) && m.sourcesDeReste(plan, x, CONVIVES).length > 0),
        'aucune case proposée où un reste est servable'
      )
      const ancien = principaleDe(plan, s)!.recipeId
      const source = m.sourcesDeReste(plan, s, CONVIVES)[0]!
      await monterSemaine()
      fireEvent.click(within(await ouvrir(s)).getByRole('button', { name: /Manger un reste/ }))
      await waitFor(() => {
        const ouverts = dialogues()
        expect(ouverts, 'une seule fenêtre : celle des restes a remplacé celle des gestes').toHaveLength(1)
        expect(nomDuDialogue(ouverts[0]!)).toMatch(/^Manger un reste — /)
      })
      const d = dialogues()[0]!
      exigerNomJourRepas(d, s)
      fireEvent.click(within(d).getAllByRole('button', { name: new RegExp(echapper(nomDe(source.recipeId))) })[0]!)
      await waitFor(() => {
        const e = principaleDe(planEnBase(), s)!
        expect(e.isLeftover).toBe(true)
        expect(e.recipeId).toBe(source.recipeId)
      })
      await plusAucuneFenetre('Manger un reste')
      fireEvent.click(within(await ouvrir(s)).getByRole('button', { name: /Remettre le plat prévu/ }))
      await waitFor(() => {
        const e = principaleDe(planEnBase(), s)!
        expect(e.isLeftover).toBe(false)
        expect(e.recipeId).toBe(ancien)
      })
      await plusAucuneFenetre('Remettre le plat prévu')
    },
    LONG
  )

  it(
    '(e) « Choisir moi-même » : la fenêtre de choix est la SEULE ouverte, et le plat touché s’écrit sur la case',
    async () => {
      const plan = semer(3)
      const s = exiger(casesDuPlan(plan).find((x) => estProposee(plan, x)), 'aucune case proposée')
      const ancien = principaleDe(plan, s)!.recipeId!
      await monterSemaine()
      fireEvent.click(within(await ouvrir(s)).getByRole('button', { name: /Choisir moi-même/ }))
      await waitFor(() => {
        const ouverts = dialogues()
        expect(ouverts, 'une seule fenêtre : celle du choix a remplacé celle des gestes').toHaveLength(1)
        expect(nomDuDialogue(ouverts[0]!)).toMatch(/^Choisir un plat — /)
      })
      const d = dialogues()[0]!
      exigerNomJourRepas(d, s)
      // Une fenêtre au bon titre mais vide passerait tout ce qui précède : on y touche un plat, et
      // c'est CE plat que la base doit porter. La liste est celle de `choisir-plat.tsx`, non touché.
      const lignes = [...d.querySelectorAll<HTMLElement>('li > button')]
      const nomDeLigne = (b: HTMLElement): string => (b.querySelector('.font-titre')?.textContent ?? '').trim()
      const ligne = exiger(
        lignes.find((b) => nomDeLigne(b) !== '' && nomDeLigne(b) !== nomDe(ancien)),
        'aucun autre plat dans la fenêtre de choix'
      )
      const ids = [...catalogueDeTest().recipes.values()].filter((r) => r.nom === nomDeLigne(ligne)).map((r) => r.id)
      expect(ids, `SEMIS : « ${nomDeLigne(ligne)} » doit nommer une seule recette`).toHaveLength(1)
      fireEvent.click(ligne)
      await waitFor(() => expect(principaleDe(planEnBase(), s)!.recipeId).toBe(ids[0]))
      await plusAucuneFenetre('Choisir moi-même')
    },
    LONG
  )
})

// =================================================================================================
// Clause 6 — l'en-tête réduit
// =================================================================================================

describe('lot-F1 · clause 6 — l’en-tête : un titre, un bouton, et les réglages derrière ⚙', () => {
  it(
    'hors fenêtre, aucun champ ni légende ; ⚙ les ouvre, et y changer « Repas par jour » recompose',
    async () => {
      semer(3)
      await monterSemaine()
      expect(dialogues()).toHaveLength(0)
      expect(screen.getByRole('heading', { level: 1, name: 'Ma semaine' })).toBeDefined()
      expect(screen.getByRole('button', { name: 'Proposer une autre semaine' })).toBeDefined()
      expect(screen.queryAllByRole('spinbutton'), 'aucun champ « Jours » dans le flux').toHaveLength(0)
      expect(screen.queryAllByRole('combobox'), 'aucune liste dans le flux').toHaveLength(0)
      for (const mot of ['Proposé', 'Vide']) {
        expect(screen.queryByText(mot), `la légende (« ${mot} ») n’est plus dans le flux`).toBeNull()
      }

      const reglages = screen.getByRole('button', { name: /Réglages/ })
      expect(reglages.getAttribute('aria-haspopup')).toBe('dialog')
      fireEvent.click(reglages)
      const d = await screen.findByRole('dialog')
      expect(within(d).getByRole('spinbutton', { name: /Nombre de jours/ })).toBeDefined()
      const repas = within(d).getByRole('combobox', { name: /Repas par jour/ })
      expect(within(d).getByRole('combobox', { name: /Convives/ })).toBeDefined()
      for (const mot of ['Proposé', 'Gardé', 'Reste', 'Vide']) expect(within(d).getByText(mot)).toBeDefined()

      fireEvent.change(repas, { target: { value: '2' } })
      await waitFor(() => {
        const creneaux = new Set(planEnBase().entries.map((e) => e.slot.creneau))
        expect([...creneaux].sort()).toEqual(['dejeuner', 'diner'])
      })
    },
    LONG
  )
})

// =================================================================================================
// Clause 7 — « Décaler ce plat ? » sans bouton dans la case
// =================================================================================================

const deux = (n: number): string => String(n).padStart(2, '0')
const jourLocal = (d: Date): string => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`

function estPasse(slot: SlotRef, maintenant: Date): boolean {
  const jour = jourLocal(maintenant)
  if (slot.date !== jour) return slot.date < jour
  return maintenant.getHours() >= HEURE_DE_FIN[slot.creneau]
}

/** La règle de `retour-8`, recalculée : plat passé, non gardé, qui a un reste à venir non gardé. */
function porteLaQuestion(plan: WeekPlan, s: SlotRef, maintenant: Date): boolean {
  const e = principaleDe(plan, s)
  if (e === undefined || e.recipeId === null || e.isLeftover || e.locked || !estPasse(s, maintenant)) return false
  return casesDuPlan(plan).some((x) => {
    const r = principaleDe(plan, x)!
    return !estPasse(x, maintenant) && r.isLeftover && !r.locked && r.recipeId === e.recipeId
  })
}

describe('lot-F1 · clause 7 — « Décaler ce plat ? » : la question dans la case, les réponses dans la fenêtre', () => {
  it(
    '2 repas, mardi 14 h 05 : un seul contrôle dans la case ; « Non » ne change rien et la question s’en va',
    async () => {
      figer(8, 14, 5)
      const plan = semer(2)
      const s = exiger(
        casesDuPlan(plan).find((x) => porteLaQuestion(plan, x, new Date())),
        'aucune case ne porte la question mardi à 14 h 05'
      )
      await monterSemaine()
      expect(caseDe(s).textContent ?? '').toMatch(QUESTION)
      expect(controlesDe(caseDe(s)), `case ${cleDe(s)} : la question n’ajoute aucun bouton`).toHaveLength(1)

      const avant = empreinte(planEnBase())
      const d = await ouvrir(s)
      expect(within(d).getByRole('button', { name: /^Décaler$/ })).toBeDefined()
      fireEvent.click(within(d).getByRole('button', { name: /^Non$/ }))
      await waitFor(() => expect(caseDe(s).textContent ?? '').not.toMatch(QUESTION))
      expect(empreinte(planEnBase()), '« Non » ne change rien au planning').toBe(avant)
    },
    LONG
  )
})
