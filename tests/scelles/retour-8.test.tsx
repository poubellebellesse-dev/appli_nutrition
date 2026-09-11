// @vitest-environment jsdom
//
// tests/scelles/retour-8.test.tsx — l'examen du lot `retour-8` : « Décaler ce plat ? » sur un repas
// passé (décision 75, précisée puis révisée le 2026-09-11). Le « Fini quand » est dans
// `docs/CONCEPTION_RETOURS_TEST.md`, section « Lot `retour-8` » ; ce fichier n'en est que la
// mesure, et il ne prescrit rien de plus que ce qui y est écrit.
//
// ⛔ IL DOIT ÊTRE ROUGE LE JOUR OÙ ON L'ÉCRIT. Ce qui a été MESURÉ le 2026-09-11 sur `3c96e85` :
//   · aucune carte de Semaine ne porte de question, aucun geste ne décale un plat ;
//   · `meal_plan_entry` n'a aucune colonne où poser une réponse ;
//   · une semaine réelle est SURTOUT FAITE DE RESTES : à 2 repas, graine 1, 5 plats cuisinés pour
//     9 restes, dont 5 servis à un autre repas que celui de leur plat ;
//   · un plat cuisiné porte ses portions de cuisson (4 pour la salade de pâtes), son reste en porte
//     une : le plat qui prend la place de son reste arrive avec les siennes.
//
// LA RÈGLE (décision 75, révisée le 2026-09-11) : « Décaler » met le plat à la place de son PREMIER
// RESTE À VENIR non gardé ; rien d'autre ne bouge, sauf les restes de ce plat qui ne peuvent plus
// être mangés, qui se vident. Un plat sans reste à venir ne porte pas la question.
//
// ---------------------------------------------------------------------------------------------
// COMMENT CE FICHIER SE DÉFEND
//
// ⛔ LA RÈGLE EST RECALCULÉE ICI, PAS IMPORTÉE. `decalerSelonLaRegle` reprend la règle écrite dans
// le brief, pas à pas ; le lot en écrira sa propre version, et les deux sont confrontées CASE PAR
// CASE sur dix-huit décalages.
//
// ⛔ PLUSIEURS SEMAINES, PAS UNE. La graine 1 porte l'essentiel des cas, mais les clauses 1 et 4
// rejouent aussi des semaines composées aux graines 2 à 5 (tour d'attaque du 2026-09-11) : une
// table recopiée des réponses d'une seule semaine y donne de mauvaises cartes.
//
// ⛔ LA QUESTION EST CHERCHÉE SUR TOUTES LES CARTES, jamais sur une seule. Une question en trop
// compte autant qu'une question qui manque.
//
// ⛔ LA MESURE DU PLANNING SE FAIT EN BASE (`readLatestPlan`). Un écran qui afficherait le
// déplacement sans l'écrire ne passe pas une relecture de `user.db`. Et l'inverse est vérifié aussi :
// la carte d'arrivée montre le plat SANS remontage.
//
// FAUSSES IMPLÉMENTATIONS, ET LES CLAUSES QUI LES TUENT
//   · question sur tout plat passé .................... clause 1, jeudi à 2 repas (pizza sans reste,
//                                                        salade dont les restes sont passés)
//   · « passé » = jour antérieur seulement ............ clause 1, lundi 14 h 05
//   · « passé » = jour antérieur OU jour même ......... clause 1, lundi 13 h 59 (garde)
//   · fin du petit-déjeuner ignorée pour le reste ..... clause 1, mercredi 9 h 55 / 10 h 05 à 3 repas
//   · jour UTC au lieu du jour local .................. clause 1, mardi 0 h 05
//   · reste gardé ou « dehors » compté ................ clause 1, restes gardés (garde) ; clause 4,
//                                                        trois variantes
//   · question dans un bandeau ou une fenêtre ......... clause 2
//   · « Non » tenu dans l'état React .................. clause 3, remontage
//   · « Non » qui ferme d'autres questions ............ clause 3, deux autres cartes
//   · « Non » qui verrouille, vide ou marque le plat .. clause 3, empreinte en base
//   · question disparue sans réponse .................. clause 3, trois montages
//   · « Non » oublié le lendemain ou le surlendemain .. clause 3, mercredi et jeudi : la règle y
//                                                        reposerait la question, le semis le vérifie
//   · réponses recopiées d'une seule semaine .......... clauses 1 et 4, graines 2 à 5
//   · la semaine glisse (ancienne règle) .............. clause 4 (e), chaque case comparée
//   · le plat va à la case suivante du même repas ..... clause 4, mardi 14 h 05 (le reste est le soir)
//   · le plat prend le premier reste de N'IMPORTE QUEL
//     plat ............................................ clause 4, goulash à 3 repas (le premier reste
//                                                        à venir est celui de la feta)
//   · le plat perd ses portions ou son accompagnement . clause 4 (b)
//   · accompagnement aux portions du plat, ou gardé ... clause 4 (b), (e) — graines 3 et 5, où
//                                                        l'accompagnement n'a pas les portions du plat
//   · reste du même jour laissé, ou tous vidés ........ clause 4 (d), (e)
//   · case vidée muette, ou qui parle de manger ....... clause 4 (f)
//   · base écrite sans que l'écran suive .............. clause 4 (g)
//
// VERTS DÉCLARÉS AUJOURD'HUI — des gardes, pas des défauts :
//   · clause 1 : lundi 13 h 59 à 2 repas, vendredi 23 h 59 à 2 repas (trois plats passés, aucun
//     reste à venir), semaine toute passée, restes à venir tous gardés — aucune carte n'y porte la
//     question, ce qui est vrai de l'écran actuel ;
//   · clause 4, le semis : il vérifie que les dix-huit décalages couvrent les cas difficiles, sans
//     monter d'écran.
//
// ⚠️ RÉGLAGES PERSISTANTS QUE L'ÉCRAN LIT : `user_rythme.repas_par_jour` — les clauses le font
// varier (1, 2, 3) ; `user_meal_time` — fixé, jamais varié ; `meal_plan` / `meal_plan_entry` —
// composés par le moteur à graine fixe (1 à 5 selon le cas), puis des cases gardées ou « dehors »
// dans quatre variantes.
// Le reste (allergies, régime, exclusions, historique, affichage) reste au défaut. `convives` n'est
// pas persistant : tout se joue à UN convive.
//
// ⚠️ AUCUN IDENTIFIANT DE RECETTE ÉCRIT EN DUR. Les repas passés visés sont désignés par leur jour et
// leur repas ; le semis vérifie que la règle y pose bien la question, et le dit s'il manque.
//
// ⚠️ LE GOÛTER N'EST PAS EXERCÉ : `user_rythme` refuse plus de 3 repas (mesuré par `retour-7`).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type {
  Catalog,
  MealPlanEntry,
  MealSlot,
  SlotRef,
  WeekPlan,
} from '../../app/src/engine/domain/index.js'
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

/** Lundi 7 septembre 2026 : le premier jour du planning. Le jeudi est le 10. */
const LUNDI = '2026-09-07'
const INSTANT_SEMIS = '2026-09-07T05:00:00Z'
const CONVIVES = 1

const HEURES: Readonly<Record<MealSlot, number>> = {
  petit_dejeuner: 8 * 60,
  dejeuner: 12 * 60,
  gouter: 16 * 60,
  diner: 19 * 60,
}

/** La fin de chaque repas, heure locale — les fenêtres de `creneau.ts`, recopiées et non importées. */
const HEURE_DE_FIN: Readonly<Record<MealSlot, number>> = {
  petit_dejeuner: 10,
  dejeuner: 14,
  gouter: 17,
  diner: 24,
}
const ORDRE: readonly MealSlot[] = ['petit_dejeuner', 'dejeuner', 'gouter', 'diner']

const QUESTION = /Décaler ce plat\s*\?/
const QUESTION_PARTOUT = /Décaler ce plat\s*\?/g
/** Le bouton qui accepte. La décision nomme la question ; « Oui » ou « Décaler » y répondent. */
const OUI = /^(oui|décaler)\b/i
const NON = /^non\b/i
/** Condition (1) de la décision 75 : la question ne parle jamais de manger. */
const INTERDIT = /mang|pas fait|pas cuisin|manqu|oubli|consomm/i

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
  // ⚠️ `toFake: ['Date']` ET RIEN D'AUTRE. Figer `setTimeout` ferait pendre `findBy*` et `waitFor`.
  vi.useFakeTimers({ toFake: ['Date'] })
  figer(10, 14, 5)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** Heure LOCALE de la machine, septembre 2026. */
function figer(jour: number, heure: number, minute: number): void {
  vi.setSystemTime(new Date(2026, 8, jour, heure, minute, 0))
}

// --- La règle, recalculée -----------------------------------------------------------------------

const deux = (n: number): string => String(n).padStart(2, '0')
const jourLocal = (d: Date): string =>
  `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`
const cleDe = (s: SlotRef): string => `${s.date}|${s.creneau}`
const ecartJours = (depuis: string, jusqua: string): number =>
  Math.round((Date.parse(`${jusqua}T00:00:00Z`) - Date.parse(`${depuis}T00:00:00Z`)) / 86_400_000)

/** Passé = jour local antérieur, ou jour même une fois l'heure de fin du repas atteinte. */
function estPasse(slot: SlotRef, maintenant: Date): boolean {
  const jour = jourLocal(maintenant)
  if (slot.date !== jour) return slot.date < jour
  return maintenant.getHours() >= HEURE_DE_FIN[slot.creneau]
}

const principaleDe = (plan: WeekPlan, s: SlotRef): MealPlanEntry | undefined =>
  plan.entries.find((e) => cleDe(e.slot) === cleDe(s) && e.service !== 'accompagnement')
const accompagnementDe = (plan: WeekPlan, s: SlotRef): MealPlanEntry | undefined =>
  plan.entries.find((e) => cleDe(e.slot) === cleDe(s) && e.service === 'accompagnement')

/** Les cases du planning, dans l'ordre du temps. */
function casesDuPlan(plan: WeekPlan): readonly SlotRef[] {
  return plan.entries
    .filter((e) => e.service !== 'accompagnement')
    .map((e) => e.slot)
    .sort((a, b) =>
      a.date === b.date ? ORDRE.indexOf(a.creneau) - ORDRE.indexOf(b.creneau) : a.date < b.date ? -1 : 1
    )
}

/** Les restes du plat de `p` qui ne sont pas passés et pas gardés, dans l'ordre du temps. */
function restesAVenir(plan: WeekPlan, p: SlotRef, maintenant: Date): readonly SlotRef[] {
  const plat = principaleDe(plan, p)
  if (plat === undefined || plat.recipeId === null) return []
  return casesDuPlan(plan).filter((s) => {
    const e = principaleDe(plan, s)!
    return !estPasse(s, maintenant) && e.isLeftover && !e.locked && e.recipeId === plat.recipeId
  })
}

function porteLaQuestion(plan: WeekPlan, s: SlotRef, maintenant: Date): boolean {
  const e = principaleDe(plan, s)
  return (
    e !== undefined &&
    estPasse(s, maintenant) &&
    e.recipeId !== null &&
    !e.isLeftover &&
    !e.locked &&
    restesAVenir(plan, s, maintenant).length > 0
  )
}

type Assiette =
  | { readonly principale: MealPlanEntry; readonly accompagnement: MealPlanEntry | undefined }
  | 'vide'

function assietteDe(plan: WeekPlan, s: SlotRef): Assiette {
  const p = principaleDe(plan, s)
  if (p === undefined) throw new Error(`retour-8 · case ${cleDe(s)} absente du plan.`)
  return p.recipeId === null && p.horsCatalogue === null
    ? 'vide'
    : { principale: p, accompagnement: accompagnementDe(plan, s) }
}

/**
 * Ce qui compte d'une case, accompagnement compris (recette, portions, verrou). Une case vide est
 * « vide », quel que soit son motif.
 */
function signature(a: Assiette | undefined): string {
  if (a === undefined) return 'absente'
  if (a === 'vide') return 'vide'
  return [
    a.principale.recipeId ?? '',
    a.principale.isLeftover ? 'reste' : 'plat',
    a.principale.locked ? 'garde' : '',
    a.principale.horsCatalogue ?? '',
    a.principale.portions,
    a.accompagnement?.recipeId ?? '',
    a.accompagnement?.portions ?? '',
    a.accompagnement?.locked ? 'garde' : '',
  ].join('|')
}

const assiettesDe = (plan: WeekPlan): Map<string, Assiette> =>
  new Map(casesDuPlan(plan).map((s) => [cleDe(s), assietteDe(plan, s)]))

const etatDe = (assiettes: ReadonlyMap<string, Assiette>): Record<string, string> =>
  Object.fromEntries([...assiettes].map(([cle, a]) => [cle, signature(a)]))

const slotDeCle = (cle: string): SlotRef => {
  const [date, creneau] = cle.split('|')
  return { date: date!, creneau: creneau as MealSlot }
}

/**
 * Les restes À VENIR, non gardés, qui ne peuvent pas être mangés là où ils sont : la recette ne se
 * sert pas à ce repas, ou aucune cuisson du même plat n'a lieu entre 1 jour et sa conservation avant.
 */
function restesImpossibles(
  cat: Catalog,
  assiettes: ReadonlyMap<string, Assiette>,
  maintenant: Date
): readonly string[] {
  return [...assiettes]
    .filter(([cle, a]) => {
      const s = slotDeCle(cle)
      if (a === 'vide' || !a.principale.isLeftover || a.principale.locked || estPasse(s, maintenant)) {
        return false
      }
      const recette = a.principale.recipeId === null ? undefined : cat.recipes.get(a.principale.recipeId)
      if (recette === undefined || !recette.typesRepas.includes(s.creneau)) return true
      return ![...assiettes].some(([autre, b]) => {
        if (b === 'vide' || b.principale.isLeftover) return false
        if (b.principale.recipeId !== a.principale.recipeId) return false
        const age = ecartJours(slotDeCle(autre).date, s.date)
        return age >= 1 && age <= recette.conservationJours
      })
    })
    .map(([cle]) => cle)
}

/** La règle du brief, pas à pas. */
function decalerSelonLaRegle(
  cat: Catalog,
  plan: WeekPlan,
  p: SlotRef,
  maintenant: Date
): {
  readonly apres: ReadonlyMap<string, Assiette>
  readonly videes: readonly SlotRef[]
  readonly cible: SlotRef
} {
  const apres = assiettesDe(plan)
  // (i) le plat, avec ses portions et son accompagnement, prend la place de son premier reste à venir
  const cible = restesAVenir(plan, p, maintenant)[0]!
  apres.set(cleDe(cible), apres.get(cleDe(p))!)
  // (ii) la case du repas passé devient vide
  apres.set(cleDe(p), 'vide')
  // (iii) les restes à venir devenus impossibles laissent leur case vide
  const impossibles = restesImpossibles(cat, apres, maintenant)
  for (const cle of impossibles) apres.set(cle, 'vide')
  return { apres, videes: [p, ...impossibles.map(slotDeCle)], cible }
}

// --- Le semis -----------------------------------------------------------------------------------

/** Des cases gardées, et des cases « dehors », désignées par `date|creneau`. */
interface Variante {
  readonly garder?: readonly string[]
  readonly dehors?: readonly string[]
}
const SANS: Variante = {}

/**
 * Écrit dans `user.db` un planning que l'écran Semaine aurait pu composer le lundi — mêmes appels,
 * graine fixe —, puis applique la variante. Rend le plan tel qu'il a été relu.
 */
function semer(repasParJour: number, variante: Variante, graine = 1): WeekPlan {
  const db = baseCourante()
  const creneaux = creneauxDuRythme(repasParJour)
  writeRythme(db, { repasParJour, tempsSemaineMin: null, tempsWeekendMin: null })
  for (const creneau of creneaux) writeMealTime(db, creneau, HEURES[creneau])

  const cat = catalogueDeTest()
  const moteur = createEngine(cat)
  const etat = readUserState(db, { windowDays: FENETRE_HISTORIQUE_JOURS, today: LUNDI }, cat.foods)
  const brut = moteur.planWeek({
    profile: PROFIL_PAR_DEFAUT,
    constraints: etat.constraints,
    tolerancePiquant: etat.tolerancePiquant,
    startDate: LUNDI,
    days: 7,
    slots: creneaux,
    history: etat.history,
    activeTopics: etat.activeTopics,
    convives: CONVIVES,
    seed: graine,
  })
  let plan = moteur.planLeftovers(brut, PROFIL_PAR_DEFAUT, CONVIVES)
  for (const cle of [...(variante.garder ?? []), ...(variante.dehors ?? [])]) {
    if (principaleDe(plan, slotDeCle(cle)) === undefined) {
      throw new Error(`retour-8 · SEMIS : la case ${cle} n’existe pas — ce n’est pas une clause.`)
    }
  }
  const aGarder = new Set(variante.garder ?? [])
  plan = { ...plan, entries: plan.entries.map((e) => (aGarder.has(cleDe(e.slot)) ? { ...e, locked: true } : e)) }
  for (const cle of variante.dehors ?? []) {
    plan = moteur.setSlotHorsCatalogue(plan, slotDeCle(cle), LIBELLE_DEHORS, PROFIL_PAR_DEFAUT)
  }
  savePlan(db, plan, INSTANT_SEMIS)

  const relu = planEnBase()
  if (JSON.stringify(etatDe(assiettesDe(relu))) !== JSON.stringify(etatDe(assiettesDe(plan)))) {
    throw new Error('retour-8 · SEMIS : le plan relu en base diffère du plan écrit — ce n’est pas une clause.')
  }
  return relu
}

function planEnBase(): WeekPlan {
  const plan = readLatestPlan(baseCourante())
  if (plan === null) throw new Error('retour-8 · SEMIS : aucun plan en base — ce n’est pas une clause.')
  return plan
}

/** Tout ce qui compte d'un plan, motif des cases vides COMPRIS. Sert à « rien n'a changé ». */
function empreinte(plan: WeekPlan): string {
  return JSON.stringify(
    plan.entries
      .map((e) =>
        [
          cleDe(e.slot),
          e.service ?? '',
          e.recipeId ?? '',
          e.portions,
          e.locked,
          e.isLeftover,
          e.horsCatalogue ?? '',
          e.motifVide ?? '',
        ].join('§')
      )
      .sort()
  )
}

const lignesDe = (table: string): number =>
  baseCourante().all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)[0]!.n

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

/** La carte d'un repas : le libellé du repas en est un enfant direct (même lecture que `retour-4`). */
function carteDuCreneau(slot: SlotRef): HTMLElement {
  const journee = screen.getByText(formaterJour(slot.date)).closest('article')
  if (journee === null) throw new Error(`retour-8 · journée ${slot.date} introuvable à l’écran.`)
  const etiquette = within(journee as HTMLElement).getAllByText(LIBELLE_CRENEAU[slot.creneau])[0]
  const carte = etiquette?.parentElement
  if (!carte) throw new Error(`retour-8 · carte ${cleDe(slot)} introuvable à l’écran.`)
  return carte
}

const porteQuestion = (slot: SlotRef): boolean => QUESTION.test(carteDuCreneau(slot).textContent ?? '')

const libelleDe = (el: Element): string =>
  (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim()

function bouton(carte: HTMLElement, motif: RegExp, sujet: string): HTMLButtonElement {
  const tous = [...carte.querySelectorAll('button')]
  const trouves = tous.filter((b) => motif.test(libelleDe(b)))
  expect(
    trouves.length,
    `${sujet} : il faut exactement un bouton ${motif} dans la case. Boutons vus : ` +
      tous.map(libelleDe).join(' / ')
  ).toBe(1)
  return trouves[0]!
}

/** Les textes d'une carte : chaque nœud de texte, et les `aria-label` et `title`. */
function textesDe(carte: HTMLElement): Set<string> {
  const textes = new Set<string>()
  const marcheur = document.createTreeWalker(carte, NodeFilter.SHOW_TEXT)
  for (let n = marcheur.nextNode(); n !== null; n = marcheur.nextNode()) {
    const t = (n.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (t !== '') textes.add(t)
  }
  for (const el of carte.querySelectorAll('[aria-label], [title]')) {
    for (const attr of ['aria-label', 'title']) {
      const t = el.getAttribute(attr)
      if (t) textes.add(t.trim())
    }
  }
  return textes
}

const court = (s: SlotRef): string => `${s.date.slice(8)} ${s.creneau}`

// =================================================================================================
// Clause 1 — la question est sur les bons repas, et seulement là
// =================================================================================================

interface CasQuestion {
  readonly nom: string
  readonly repas: number
  readonly variante: Variante
  readonly quand: readonly [jour: number, heure: number, minute: number]
  /** Une garde : la règle n'y pose AUCUNE question, et le semis le vérifie. */
  readonly garde: boolean
  /** La graine du moteur ; 1 par défaut. */
  readonly graine?: number
}

const RESTES_DE_LA_SALADE = ['2026-09-08|dejeuner', '2026-09-08|diner', '2026-09-09|dejeuner']

const CAS_QUESTION: readonly CasQuestion[] = [
  { nom: '2 repas · lundi 13 h 59 — le déjeuner n’est pas fini (garde)', repas: 2, variante: SANS, quand: [7, 13, 59], garde: true },
  { nom: '2 repas · lundi 14 h 05 — le déjeuner du jour est passé', repas: 2, variante: SANS, quand: [7, 14, 5], garde: false },
  { nom: '2 repas · mardi 0 h 05 — le jour est LOCAL', repas: 2, variante: SANS, quand: [8, 0, 5], garde: false },
  { nom: '2 repas · mardi 14 h 05', repas: 2, variante: SANS, quand: [8, 14, 5], garde: false },
  { nom: '2 repas · jeudi 14 h 05 — un plat sans reste, un plat dont les restes sont passés', repas: 2, variante: SANS, quand: [10, 14, 5], garde: false },
  { nom: '2 repas · vendredi 23 h 59 — trois plats passés, aucun reste à venir (garde)', repas: 2, variante: SANS, quand: [11, 23, 59], garde: true },
  { nom: '3 repas · mardi 14 h 05', repas: 3, variante: SANS, quand: [8, 14, 5], garde: false },
  { nom: '3 repas · mercredi 9 h 55 — le petit-déjeuner du jour n’est pas fini', repas: 3, variante: SANS, quand: [9, 9, 55], garde: false },
  { nom: '3 repas · mercredi 10 h 05 — il est fini', repas: 3, variante: SANS, quand: [9, 10, 5], garde: false },
  { nom: '3 repas · jeudi 14 h 05', repas: 3, variante: SANS, quand: [10, 14, 5], garde: false },
  { nom: '1 repas · mardi 9 h', repas: 1, variante: SANS, quand: [8, 9, 0], garde: false },
  { nom: '1 repas · jeudi 23 h 59', repas: 1, variante: SANS, quand: [10, 23, 59], garde: false },
  { nom: '2 repas · dimanche 20 — semaine toute passée (garde)', repas: 2, variante: SANS, quand: [20, 12, 0], garde: true },
  { nom: '2 repas · lundi 14 h 05 — le premier reste de la salade est gardé', repas: 2, variante: { garder: ['2026-09-08|dejeuner'] }, quand: [7, 14, 5], garde: false },
  { nom: '2 repas · lundi 14 h 05 — tous les restes de la salade sont gardés (garde)', repas: 2, variante: { garder: RESTES_DE_LA_SALADE }, quand: [7, 14, 5], garde: true },
  { nom: '2 repas · lundi 14 h 05 — le premier reste de la salade est « dehors »', repas: 2, variante: { dehors: ['2026-09-08|dejeuner'] }, quand: [7, 14, 5], garde: false },
  // D'autres semaines : mêmes jours, autres plats, autres réponses.
  { nom: 'graine 2 · 1 repas · jeudi 14 h 05', repas: 1, variante: SANS, quand: [10, 14, 5], garde: false, graine: 2 },
  { nom: 'graine 4 · 2 repas · mardi 14 h 05', repas: 2, variante: SANS, quand: [8, 14, 5], garde: false, graine: 4 },
  { nom: 'graine 3 · 2 repas · jeudi 14 h 05', repas: 2, variante: SANS, quand: [10, 14, 5], garde: false, graine: 3 },
  { nom: 'graine 5 · 3 repas · mardi 14 h 05', repas: 3, variante: SANS, quand: [8, 14, 5], garde: false, graine: 5 },
  { nom: 'graine 3 · 3 repas · jeudi 14 h 05', repas: 3, variante: SANS, quand: [10, 14, 5], garde: false, graine: 3 },
]

describe('retour-8 · clause 1 — la question est sur les plats passés qui ont un reste à venir, et seulement là', () => {
  it.each(CAS_QUESTION)('$nom', async (cas) => {
    figer(...cas.quand)
    if (cas.quand[0] === 8 && cas.quand[1] === 0) {
      expect(
        new Date(2026, 8, 8, 0, 5).toISOString().slice(0, 10),
        'retour-8 · MACHINE À L’OUEST DE GREENWICH : 0 h 05 locale n’y tombe pas la veille en UTC, ' +
          'et ce cas ne distinguerait plus le jour local du jour UTC. Il rougit plutôt que de passer sans rien prouver.'
      ).toBe('2026-09-07')
    }
    const plan = semer(cas.repas, cas.variante, cas.graine)
    const maintenant = new Date()
    const attendu = casesDuPlan(plan).filter((s) => porteLaQuestion(plan, s, maintenant)).map(court)
    if (cas.garde !== (attendu.length === 0)) {
      throw new Error(
        `retour-8 · SEMIS, PAS CLAUSE FAUSSE : « ${cas.nom} » devait ${cas.garde ? 'ne porter aucune' : 'porter au moins une'} ` +
          `question selon la règle, elle en porte ${attendu.length}.`
      )
    }
    if (cas.quand[0] === 10 && cas.repas === 2 && cas.graine === undefined) {
      const sansQuestion = casesDuPlan(plan).filter((s) => {
        const e = principaleDe(plan, s)!
        return estPasse(s, maintenant) && e.recipeId !== null && !e.isLeftover && !porteLaQuestion(plan, s, maintenant)
      })
      if (sansQuestion.length < 2) {
        throw new Error('retour-8 · SEMIS, PAS CLAUSE FAUSSE : jeudi à 2 repas devait avoir deux plats passés sans reste à venir.')
      }
    }

    await monterSemaine()
    const vues = casesDuPlan(plan).filter((s) => porteQuestion(s)).map(court)
    expect(vues, `${cas.nom} : cartes qui portent « Décaler ce plat ? »`).toEqual(attendu)
  })
})

// =================================================================================================
// Clause 2 — elle ne parle jamais de manger, elle est dans la case, rien ne s'ouvre seul
// =================================================================================================

describe('retour-8 · clause 2 — la question reste une question de planning', () => {
  it('lundi, 2 repas : ce qui apparaît sur la carte du déjeuner à 14 h 05 ne parle pas de manger, et n’existe qu’une fois, dans la case', async () => {
    const dejeuner: SlotRef = { date: LUNDI, creneau: 'dejeuner' }
    figer(7, 11, 0)
    semer(2, SANS)
    await monterSemaine()
    const avant = textesDe(carteDuCreneau(dejeuner))
    cleanup()

    figer(7, 14, 5)
    await monterSemaine()
    expect(
      document.querySelector('[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open]'),
      'aucune fenêtre ne s’ouvre seule'
    ).toBeNull()
    const carte = carteDuCreneau(dejeuner)
    expect(carte.textContent ?? '').toMatch(QUESTION)
    expect(
      (document.body.textContent ?? '').match(QUESTION_PARTOUT) ?? [],
      'la question n’existe qu’une fois à l’écran : une seule carte la porte à cette heure'
    ).toHaveLength(1)
    const nouveaux = [...textesDe(carte)].filter((t) => !avant.has(t))
    expect(nouveaux.filter((t) => INTERDIT.test(t)), 'ce que la question ajoute à la carte').toEqual([])
  })
})

// =================================================================================================
// Clause 3 — sans réponse elle reste ; « Non » ne change rien et elle ne revient plus
// =================================================================================================

describe('retour-8 · clause 3 — « Non » ne change rien', () => {
  // 3 repas. Mardi 14 h 05, trois cartes portent la question ; mercredi 10 h 05, la règle la
  // poserait encore sur les deux plats de lundi, et jeudi 14 h 05 encore sur le dîner du 7.
  const DINER_DU_7: SlotRef = { date: LUNDI, creneau: 'diner' }
  const DEJEUNER_DU_7: SlotRef = { date: LUNDI, creneau: 'dejeuner' }
  const PETIT_DEJEUNER_DU_8: SlotRef = { date: '2026-09-08', creneau: 'petit_dejeuner' }

  function exigerQuestions(plan: WeekPlan, slots: readonly SlotRef[]): void {
    const maintenant = new Date()
    for (const s of slots) {
      if (!porteLaQuestion(plan, s, maintenant)) {
        throw new Error(
          `retour-8 · SEMIS, PAS CLAUSE FAUSSE : la règle ne pose pas la question sur ${court(s)} à ${maintenant.toString().slice(0, 21)}.`
        )
      }
    }
  }

  it('sans réponse, la question reste d’un montage à l’autre, et le lendemain', async () => {
    figer(8, 14, 5)
    const plan = semer(3, SANS)
    exigerQuestions(plan, [DINER_DU_7])
    await monterSemaine()
    expect(porteQuestion(DINER_DU_7), 'premier montage').toBe(true)
    cleanup()
    await monterSemaine()
    expect(porteQuestion(DINER_DU_7), 'second montage, sans réponse').toBe(true)
    cleanup()
    figer(9, 10, 5)
    exigerQuestions(plan, [DINER_DU_7])
    await monterSemaine()
    expect(porteQuestion(DINER_DU_7), 'le lendemain, sans réponse').toBe(true)
  })

  it('après « Non » : le planning est identique en base, rien n’est enregistré, la question ne revient pas — et les autres restent', async () => {
    figer(8, 14, 5)
    const plan = semer(3, SANS)
    exigerQuestions(plan, [DINER_DU_7, DEJEUNER_DU_7, PETIT_DEJEUNER_DU_8])
    const avant = empreinte(plan)

    await monterSemaine()
    fireEvent.click(bouton(carteDuCreneau(DINER_DU_7), NON, 'dîner du 7'))
    await waitFor(() => expect(porteQuestion(DINER_DU_7)).toBe(false), { timeout: 5000 })

    expect(empreinte(planEnBase()), '« Non » ne change rien au planning').toBe(avant)
    expect(lignesDe('meal_history'), 'rien n’est enregistré sur ce qui a été mangé').toBe(0)
    expect(lignesDe('user_signal'), 'aucun signal de préférence').toBe(0)
    expect(porteQuestion(DEJEUNER_DU_7), 'même jour, autre repas : la question reste').toBe(true)
    expect(porteQuestion(PETIT_DEJEUNER_DU_8), 'autre jour, autre repas : la question reste').toBe(true)

    cleanup()
    await monterSemaine()
    expect(porteQuestion(DINER_DU_7), 'remonté : elle ne revient pas').toBe(false)
    expect(porteQuestion(DEJEUNER_DU_7)).toBe(true)
    expect(porteQuestion(PETIT_DEJEUNER_DU_8)).toBe(true)

    cleanup()
    figer(9, 10, 5)
    exigerQuestions(plan, [DINER_DU_7, DEJEUNER_DU_7])
    await monterSemaine()
    expect(porteQuestion(DINER_DU_7), 'le lendemain : elle ne revient pas').toBe(false)
    expect(porteQuestion(DEJEUNER_DU_7)).toBe(true)
    expect(empreinte(planEnBase())).toBe(avant)

    cleanup()
    figer(10, 14, 5)
    exigerQuestions(plan, [DINER_DU_7])
    await monterSemaine()
    expect(porteQuestion(DINER_DU_7), 'le surlendemain : elle ne revient pas').toBe(false)
    expect(empreinte(planEnBase())).toBe(avant)
  })
})

// =================================================================================================
// Clause 4 — « Décaler » met le plat à la place de son premier reste à venir
// =================================================================================================

interface CasDecalage {
  readonly nom: string
  readonly repas: number
  readonly variante: Variante
  readonly quand: readonly [jour: number, heure: number, minute: number]
  readonly p: SlotRef
  /** La graine du moteur ; 1 par défaut. */
  readonly graine?: number
}

const mardi = [8, 14, 5] as const
const lundi = [7, 14, 5] as const
const CAS_DECALAGE: readonly CasDecalage[] = [
  { nom: '2 repas · lundi 14 h 05 · déjeuner du jour', repas: 2, variante: SANS, quand: lundi, p: { date: LUNDI, creneau: 'dejeuner' } },
  { nom: '2 repas · mardi 14 h 05 · déjeuner du 7', repas: 2, variante: SANS, quand: mardi, p: { date: LUNDI, creneau: 'dejeuner' } },
  { nom: '2 repas · jeudi 14 h 05 · dîner du 9', repas: 2, variante: SANS, quand: [10, 14, 5], p: { date: '2026-09-09', creneau: 'diner' } },
  { nom: '3 repas · lundi 14 h 05 · déjeuner du jour', repas: 3, variante: SANS, quand: lundi, p: { date: LUNDI, creneau: 'dejeuner' } },
  { nom: '3 repas · mardi 14 h 05 · déjeuner du 7', repas: 3, variante: SANS, quand: mardi, p: { date: LUNDI, creneau: 'dejeuner' } },
  { nom: '3 repas · mardi 14 h 05 · dîner du 7', repas: 3, variante: SANS, quand: mardi, p: { date: LUNDI, creneau: 'diner' } },
  { nom: '3 repas · mardi 14 h 05 · petit-déjeuner du 8', repas: 3, variante: SANS, quand: mardi, p: { date: '2026-09-08', creneau: 'petit_dejeuner' } },
  { nom: '3 repas · jeudi 14 h 05 · dîner du 7', repas: 3, variante: SANS, quand: [10, 14, 5], p: { date: LUNDI, creneau: 'diner' } },
  { nom: '1 repas · mardi 9 h · dîner du 7', repas: 1, variante: SANS, quand: [8, 9, 0], p: { date: LUNDI, creneau: 'diner' } },
  { nom: '2 repas · lundi 14 h 05 · premier reste gardé', repas: 2, variante: { garder: ['2026-09-08|dejeuner'] }, quand: lundi, p: { date: LUNDI, creneau: 'dejeuner' } },
  { nom: '2 repas · lundi 14 h 05 · premier reste « dehors »', repas: 2, variante: { dehors: ['2026-09-08|dejeuner'] }, quand: lundi, p: { date: LUNDI, creneau: 'dejeuner' } },
  { nom: '3 repas · mardi 14 h 05 · reste du soir gardé', repas: 3, variante: { garder: ['2026-09-08|diner'] }, quand: mardi, p: { date: LUNDI, creneau: 'dejeuner' } },
  // D'autres semaines.
  { nom: 'graine 3 · 2 repas · mardi 14 h 05 · dîner du 7', repas: 2, variante: SANS, quand: mardi, p: { date: LUNDI, creneau: 'diner' }, graine: 3 },
  { nom: 'graine 3 · 2 repas · jeudi 14 h 05 · déjeuner du 10', repas: 2, variante: SANS, quand: [10, 14, 5], p: { date: '2026-09-10', creneau: 'dejeuner' }, graine: 3 },
  { nom: 'graine 5 · 3 repas · mardi 14 h 05 · déjeuner du 7', repas: 3, variante: SANS, quand: mardi, p: { date: LUNDI, creneau: 'dejeuner' }, graine: 5 },
  { nom: 'graine 2 · 1 repas · jeudi 14 h 05 · dîner du 9', repas: 1, variante: SANS, quand: [10, 14, 5], p: { date: '2026-09-09', creneau: 'diner' }, graine: 2 },
  { nom: 'graine 4 · 2 repas · mardi 14 h 05 · dîner du 7', repas: 2, variante: SANS, quand: mardi, p: { date: LUNDI, creneau: 'diner' }, graine: 4 },
  { nom: 'graine 5 · 2 repas · jeudi 14 h 05 · déjeuner du 10', repas: 2, variante: SANS, quand: [10, 14, 5], p: { date: '2026-09-10', creneau: 'dejeuner' }, graine: 5 },
]

describe('retour-8 · clause 4 — « Décaler », en un geste, met le plat à la place de son premier reste à venir', () => {
  it('semis — les dix-huit décalages couvrent ce que la règle a de difficile (témoin, vert aujourd’hui)', () => {
    const cat = catalogueDeTest()
    const resultats = CAS_DECALAGE.map((cas) => {
      reinitialiserBase()
      figer(...cas.quand)
      const plan = semer(cas.repas, cas.variante, cas.graine)
      const maintenant = new Date()
      expect(porteLaQuestion(plan, cas.p, maintenant), `SEMIS : pas de question sur « ${cas.nom} »`).toBe(true)
      return { cas, plan, maintenant, r: decalerSelonLaRegle(cat, plan, cas.p, maintenant) }
    })
    type R = (typeof resultats)[number]
    const avantLaCible = (x: R): readonly SlotRef[] => {
      const cases = casesDuPlan(x.plan)
      const i = cases.findIndex((s) => cleDe(s) === cleDe(x.r.cible))
      return cases.slice(0, i).filter((s) => !estPasse(s, x.maintenant))
    }
    const recetteDe = (x: R) => principaleDe(x.plan, x.cas.p)!.recipeId
    const reste = (x: R, s: SlotRef) => {
      const e = principaleDe(x.plan, s)!
      return e.isLeftover && e.recipeId === recetteDe(x)
    }

    expect(resultats.filter((x) => x.r.videes.length >= 2).length, 'SEMIS : un reste vidé (même jour)').toBeGreaterThanOrEqual(2)
    expect(
      resultats.filter((x) => x.r.cible.creneau !== x.cas.p.creneau).length,
      'SEMIS : un reste servi à un autre repas que le plat'
    ).toBeGreaterThanOrEqual(2)
    expect(
      resultats.filter((x) => x.r.cible.creneau === x.cas.p.creneau).length,
      'SEMIS : un reste servi au même repas'
    ).toBeGreaterThanOrEqual(2)
    expect(
      resultats.filter((x) => avantLaCible(x).some((s) => reste(x, s) && principaleDe(x.plan, s)!.locked)).length,
      'SEMIS : un reste gardé sauté'
    ).toBeGreaterThanOrEqual(2)
    expect(
      resultats.filter((x) => avantLaCible(x).some((s) => principaleDe(x.plan, s)!.horsCatalogue !== null)).length,
      'SEMIS : une case « dehors » sautée'
    ).toBeGreaterThanOrEqual(1)
    expect(
      resultats.filter((x) =>
        avantLaCible(x).some((s) => {
          const e = principaleDe(x.plan, s)!
          return e.isLeftover && !e.locked && e.recipeId !== recetteDe(x)
        })
      ).length,
      'SEMIS : un reste d’un AUTRE plat avant la cible'
    ).toBeGreaterThanOrEqual(1)
    expect(
      resultats.filter((x) =>
        casesDuPlan(x.plan).some(
          (s) => cleDe(s) !== cleDe(x.r.cible) && !estPasse(s, x.maintenant) && reste(x, s) && x.r.apres.get(cleDe(s)) !== 'vide'
        )
      ).length,
      'SEMIS : un reste du plat qui reste en place'
    ).toBeGreaterThanOrEqual(3)
    expect(
      resultats.filter((x) => ecartJours(x.cas.p.date, x.r.cible.date) >= 3).length,
      'SEMIS : un plat passé depuis trois jours'
    ).toBeGreaterThanOrEqual(1)
    expect(
      resultats.filter((x) => principaleDe(x.plan, x.cas.p)!.portions !== principaleDe(x.plan, x.r.cible)!.portions).length,
      'SEMIS : des portions de cuisson différentes de celles du reste'
    ).toBeGreaterThanOrEqual(3)
    expect(resultats.filter((x) => accompagnementDe(x.plan, x.cas.p) !== undefined).length, 'SEMIS : un accompagnement').toBeGreaterThanOrEqual(1)
    expect(resultats.filter((x) => accompagnementDe(x.plan, x.cas.p) === undefined).length, 'SEMIS : sans accompagnement').toBeGreaterThanOrEqual(1)
    expect(
      resultats.filter((x) => {
        const acc = accompagnementDe(x.plan, x.cas.p)
        return acc !== undefined && acc.portions !== principaleDe(x.plan, x.cas.p)!.portions
      }).length,
      'SEMIS : un accompagnement qui n’a pas les portions du plat'
    ).toBeGreaterThanOrEqual(2)
    expect(new Set(CAS_DECALAGE.map((c) => c.graine ?? 1)).size, 'SEMIS : cinq semaines').toBe(5)
    expect(
      resultats.filter((x) => x.cas.graine !== undefined && x.r.videes.length >= 2).length,
      'SEMIS : un reste vidé hors de la graine 1'
    ).toBeGreaterThanOrEqual(1)
    expect(new Set(CAS_DECALAGE.map((c) => c.p.creneau)), 'SEMIS : les trois repas').toEqual(
      new Set<MealSlot>(['petit_dejeuner', 'dejeuner', 'diner'])
    )
  })

  it.each(CAS_DECALAGE)('$nom', async (cas) => {
    const cat = catalogueDeTest()
    figer(...cas.quand)
    const avant = semer(cas.repas, cas.variante, cas.graine)
    const maintenant = new Date()
    if (!porteLaQuestion(avant, cas.p, maintenant)) {
      throw new Error(`retour-8 · SEMIS, PAS CLAUSE FAUSSE : la règle ne pose pas la question sur « ${cas.nom} ».`)
    }
    const attendu = decalerSelonLaRegle(cat, avant, cas.p, maintenant)
    const nom = cat.recipes.get(principaleDe(avant, cas.p)!.recipeId!)!.nom

    await monterSemaine()
    fireEvent.click(bouton(carteDuCreneau(cas.p), OUI, cas.nom))
    await waitFor(
      () => expect(principaleDe(planEnBase(), cas.p)?.recipeId ?? null, 'la case du repas passé se vide').toBeNull(),
      { timeout: 5000 }
    )
    const apres = planEnBase()
    const assiettes = assiettesDe(apres)

    // (a) la case du repas passé est vide
    expect(signature(assiettes.get(cleDe(cas.p))), '(a) case du repas passé').toBe('vide')
    // (b) le plat — portions et accompagnement compris — est à la place de son premier reste à venir
    expect(signature(assiettes.get(cleDe(attendu.cible))), `(b) le plat en ${court(attendu.cible)}`).toBe(
      signature(assietteDe(avant, cas.p))
    )
    // (c) repas passés (autres que lui), gardés et « dehors » : intacts
    const intouchables = casesDuPlan(avant).filter((s) => {
      const e = principaleDe(avant, s)!
      return cleDe(s) !== cleDe(cas.p) && (estPasse(s, maintenant) || e.locked || e.horsCatalogue !== null)
    })
    expect(
      Object.fromEntries(intouchables.map((s) => [cleDe(s), signature(assiettes.get(cleDe(s)))])),
      '(c) passés, gardés, dehors'
    ).toEqual(Object.fromEntries(intouchables.map((s) => [cleDe(s), signature(assietteDe(avant, s))])))
    // (d) aucun reste à venir qui ne pourrait pas être mangé là où il est
    expect(restesImpossibles(cat, assiettes, maintenant), '(d) restes impossibles').toEqual([])
    // (e) la règle entière, case par case : rien d'autre n'a bougé
    expect(etatDe(assiettes), '(e) le planning selon la règle').toEqual(etatDe(attendu.apres))
    // (f) chaque case vidée n'a plus d'accompagnement, porte un motif, et le dit sans parler de manger
    for (const s of attendu.videes) {
      expect(principaleDe(apres, s)?.motifVide ?? null, `(f) motif de ${court(s)}`).not.toBeNull()
      expect(accompagnementDe(apres, s), `(f) accompagnement de ${court(s)}`).toBeUndefined()
      await waitFor(
        () => {
          expect(porteQuestion(s), `(f) la carte ${court(s)} ne pose plus la question`).toBe(false)
          // La question et son bouton ne comptent pas comme la phrase qui dit pourquoi.
          const phrases = [...textesDe(carteDuCreneau(s))].filter(
            (t) => /décal/i.test(t) && !QUESTION.test(t) && !OUI.test(t)
          )
          expect(phrases.length, `(f) la carte ${court(s)} dit que le plat a été décalé`).toBeGreaterThan(0)
          expect(phrases.filter((t) => INTERDIT.test(t)), `(f) phrase de ${court(s)}`).toEqual([])
        },
        { timeout: 5000 }
      )
    }
    // (g) l'écran montre le plat à sa nouvelle place, sans remontage
    await waitFor(() => within(carteDuCreneau(attendu.cible)).getByText(nom), { timeout: 5000 })
    // (h) rien n'est enregistré sur ce qui a été mangé
    expect(lignesDe('meal_history'), '(h) meal_history').toBe(0)
    expect(lignesDe('user_signal'), '(h) user_signal').toBe(0)
  })
})
