// @vitest-environment jsdom
//
// tests/scelles/retour-4.test.tsx — l'examen du lot `retour-4` : l'action « les restes de… », et
// le décalage émergent (décision 78). Le « Fini quand » est dans
// `docs/CONCEPTION_RETOURS_TEST.md`, section « Lot `retour-4` » ; ce fichier n'en est que la
// mesure, et il ne prescrit rien de plus que ce qui y est écrit.
//
// ⛔ IL DOIT ÊTRE ROUGE LE JOUR OÙ ON L'ÉCRIT. Ce qui a été MESURÉ le 2026-08-26 sur `dd09205` :
//   · `isLeftover` a DEUX occurrences dans `screens/semaine.tsx`, toutes deux d'affichage (l. 861 et
//     l. 911) ; ZÉRO dans `screens/aujourdhui.tsx`. Aucun geste ne pose un reste.
//   · `reroll-slot.ts` n'exporte que `rerollSlot`, `setSlotRecipe` et `setSlotHorsCatalogue` :
//     aucune transformation d'un créneau en reste n'existe dans le moteur.
//   · la carte affiche `entry.locked ? 'Gardé' : 'Reste du plat de la veille'` — les deux mentions
//     sont MUTUELLEMENT EXCLUSIVES, donc un reste verrouillé perdrait le mot « reste ».
//   · « la veille » est déjà faux pour 4 des 13 restes que le moteur pose à 3 repas/jour
//     (âges mesurés : 9 restes à 1 jour, 3 à 2 jours, 1 à 3 jours) et 4 des 10 à 2 repas/jour.
//
// ---------------------------------------------------------------------------------------------
// COMMENT CE FICHIER SE DÉFEND
//
// ⛔ IL NE PRESCRIT AUCUN LIBELLÉ, AUCUN EMPLACEMENT, AUCUN COMPOSANT, AUCUN NOM DE FONCTION. Le
// « Fini quand » borne le COÛT du geste et mesure CE QUI ATTERRIT EN BASE. Le fichier CHERCHE un
// chemin d'au plus 2 clics parmi les contrôles VISIBLES, en remontant l'écran à neuf entre chaque
// sonde. Ce qui est imposé, et c'est la seule chose, c'est que le mot « restes » soit AFFICHÉ sur
// le chemin : sans lui le geste existe et personne ne le trouve.
//
// ⛔ LA MESURE SE FAIT EN BASE, JAMAIS DANS L'ÉTAT REACT NI DANS LE DOM — sauf les clauses 8 et 9,
// qui portent explicitement sur ce que la carte AFFICHE, et qui le disent. Un écran qui montrerait
// « restes de… » sans rien écrire passerait n'importe quel `getByText` ; il ne passe pas une
// relecture de `user.db`.
//
// ⛔ LA CLAUSE 4 EST LE PIÈGE PRINCIPAL, ET IL VISE UN DÉFAUT DÉJÀ EN PRODUCTION. `plan-week.ts:244`
// verse le `recipeId` de TOUTE entrée verrouillée non-accompagnement dans `placedRecipeIds`, qui
// interdit le doublon dans la semaine : un reste verrouillé y entre comme s'il était une cuisson, et
// la recomposition suivante n'ordonne plus jamais le plat. MESURÉ, en verrouillant le seul reste :
// « cuissons : AUCUNE / restes : 1 ». La semaine porte alors un reste dont le plat n'est cuisiné
// nulle part, et la liste de courses n'achète rien pour lui. La réponse, elle aussi mesurée, est de
// verrouiller AUSSI le créneau de la cuisson : « cuissons : 2026-03-10 diner locked=true / restes :
// 2026-03-11 dejeuner locked=true », 13 restes au total, aucune inflation. Une implémentation qui
// ne verrouille QUE la cible passe les clauses 1, 2, 3, 5, 6, 7, 8 et 10 — et échoue la 4. C'est
// exactement ce que la clause est là pour attraper.
//
// ⛔ LA CLAUSE 2 TUE L'ÉCRITURE RECOPIÉE DE `setSlotHorsCatalogue`. Ce geste-là VIDE le créneau et
// emporte l'accompagnement ; `planLeftovers` fait l'inverse — il écrase la seule entrée principale
// et LAISSE l'accompagnement (mesuré : 10 des 13 créneaux devenus restes le gardent). La clause
// exige donc que l'entrée écrite soit INDISCERNABLE de celle que le moteur aurait écrite, au verrou
// près : `isLeftover`, `portions`, `horsCatalogue`, `service`, et l'accompagnement toujours là.
//
// ⛔ LA CLAUSE 5 TUE L'OFFRE TROP LARGE. Proposer « tout ce qui a été cuisiné avant » est
// l'implémentation la plus naturelle et elle est fausse : elle propose un plat périmé, un plat que
// la recette ne sert pas à ce créneau, ou un plat dont il ne reste aucune portion. Les
// contre-exemples sont DÉDUITS du plan, un par cause, et doivent être ABSENTS de ce que l'écran
// propose.
//
// ⛔ LA CLAUSE 7 REFUSE LE FAUX ANNULER, et refuse en plus le demi-annuler. « Choisir » → cliquer le
// nom du plat d'origine restaurerait `recipeId` en deux clics : ce n'est pas un annuler, c'est
// demander à l'utilisateur de se souvenir. Le chemin trouvé sur la première cible est donc REJOUÉ à
// l'identique sur l'autre. Et il ne suffit pas de rendre le plat : le verrou posé sur la CUISSON
// doit repartir aussi, sinon le geste laisse derrière lui un créneau figé que personne n'a demandé.
//
// ⚠️ LES RÉGLAGES PERSISTANTS QUE CET ÉCRAN LIT SONT NOMMÉS ICI, ET NON DEVINÉS — c'est la dette
// ouverte par `retour-2` (`ETAT.md` §8). `user_rythme.repasParJour` DÉCIDE QUELS CRÉNEAUX EXISTENT :
// les clauses le font donc varier entre 2 et 3. ⚠️ 2 = déjeuner + dîner ; 3 AJOUTE LE
// PETIT-DÉJEUNER, pas le goûter (`ui/creneau.ts:31`) — le goûter n'entre qu'à 4, et
// `user_rythme` porte `CHECK (repas_par_jour BETWEEN 1 AND 3)`. `user_meal_time` décide des
// rappels, `user_profile` du plancher calorique, la fenêtre d'historique vaut 21 jours.
// ⚠️ `convives` N'EST PAS PERSISTANT — `meal_plan` ne porte que `id` et `date_debut`, et l'écran le
// tient dans un `useState` initialisé à 1. Tout ce fichier se joue donc à UN convive, et c'est une
// limite mesurée, pas un confort.
// ⚠️ L'HORLOGE EST FIGÉE : la date du jour décide de la date de départ du plan.
//
// ⚠️ AUCUN IDENTIFIANT DE RECETTE, AUCUNE DATE DE CUISSON, AUCUN EFFECTIF ÉCRIT EN DUR. Cibles,
// sources et contre-exemples sont DÉDUITS du plan que le moteur compose sur le `catalog.db` réel.
// Si le catalogue change au point de ne plus fournir de cas, le message dit que c'est le SEMIS qui
// manque, pas la clause qui échoue.
// ⚠️ MESURÉ, ET LES CLAUSES SONT ÉCRITES POUR CE CHIFFRE : le catalogue réel ne fournit que DEUX
// créneaux cibles par rythme (plat posé, non verrouillé, non-reste, accompagné, et au moins une
// source éligible), sur deux journées distinctes. La clause 7 rejoue donc sur UN autre créneau, pas
// deux — exiger davantage aurait produit un « semis insuffisant » permanent.
//
// ⚠️ CE QU'AUCUNE DE CES DIX CLAUSES NE DÉMONTRERA : que le geste se TROUVE sur un téléphone, ni
// qu'une liste de plats y soit lisible. Un contrôle atteignable en deux clics par `querySelectorAll`
// peut être hors écran. Cela rejoint la passe à l'œil de `CONCEPTION_RETOURS_TEST.md` §3.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type {
  Catalog,
  MealPlanEntry,
  MealSlot,
  RecipeId,
  SlotRef,
  WeekPlan,
} from '../../app/src/engine/domain/index.js'
import { createEngine } from '../../app/src/engine/api/index.js'
import { USER_SCHEMA_VERSION } from '../../app/src/data/user-schema.js'
import {
  readLatestPlan,
  readUserState,
  savePlan,
  writeMealTime,
  writeRythme,
} from '../../app/src/data/user-store.js'
import { creneauxDuRythme } from '../../app/src/ui/creneau.js'
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
}))

/** Le jour du test. Choisi, pas tiré : tout le fichier en dépend. */
const JOUR0 = '2026-03-10'
/** Midi UTC — assez loin de minuit pour qu'aucun fuseau ne fasse changer de jour. */
const INSTANT = '2026-03-10T12:00:00Z'
/** Un seul convive, seule valeur qui survive à un remontage (`convives` n'est pas persisté). */
const CONVIVES = 1

const HEURES: Readonly<Record<MealSlot, number>> = {
  petit_dejeuner: 8 * 60,
  dejeuner: 12 * 60,
  gouter: 16 * 60,
  diner: 19 * 60,
}

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
  // ⚠️ `toFake: ['Date']` ET RIEN D'AUTRE. Figer `setTimeout` ferait pendre `findBy*`.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(INSTANT))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// --- Le semis ---------------------------------------------------------------------------------

const cleDe = (slot: SlotRef): string => `${slot.date}|${slot.creneau}`

const MS_PAR_JOUR = 86_400_000
const ecartJours = (depuis: string, jusqua: string): number =>
  Math.round((Date.parse(`${jusqua}T00:00:00Z`) - Date.parse(`${depuis}T00:00:00Z`)) / MS_PAR_JOUR)

/**
 * Écrit dans `user.db` un plan que l'écran Semaine aurait pu composer lui-même — mêmes appels, même
 * ordre, graine fixe. Passer par le semis plutôt que par « Composer ma semaine » rend chaque
 * remontage instantané : ce fichier en fait des dizaines.
 */
function semer(repasParJour: number): WeekPlan {
  const db = baseCourante()
  const creneaux = creneauxDuRythme(repasParJour)
  writeRythme(db, { repasParJour, tempsSemaineMin: null, tempsWeekendMin: null })
  for (const creneau of creneaux) writeMealTime(db, creneau, HEURES[creneau])

  const cat = catalogueDeTest()
  const moteur = createEngine(cat)
  const etat = readUserState(db, { windowDays: FENETRE_HISTORIQUE_JOURS, today: JOUR0 }, cat.foods)
  const brut = moteur.planWeek({
    profile: PROFIL_PAR_DEFAUT,
    constraints: etat.constraints,
    tolerancePiquant: etat.tolerancePiquant,
    startDate: JOUR0,
    days: 7,
    slots: creneaux,
    history: etat.history,
    activeTopics: etat.activeTopics,
    convives: CONVIVES,
    seed: 1,
  })
  const plan = moteur.planLeftovers(brut, PROFIL_PAR_DEFAUT, CONVIVES)
  savePlan(db, plan, INSTANT)
  return plan
}

function planEnBase(): WeekPlan {
  const plan = readLatestPlan(baseCourante())
  if (plan === null) {
    throw new Error('retour-4 · le semis n’a écrit aucun plan — ce n’est pas la clause qui échoue.')
  }
  return plan
}

const duCreneau = (plan: WeekPlan, slot: SlotRef): readonly MealPlanEntry[] =>
  plan.entries.filter((e) => cleDe(e.slot) === cleDe(slot))

const principale = (plan: WeekPlan, slot: SlotRef): MealPlanEntry | undefined =>
  duCreneau(plan, slot).find((e) => e.service !== 'accompagnement')

const accompagnement = (plan: WeekPlan, slot: SlotRef): MealPlanEntry | undefined =>
  duCreneau(plan, slot).find((e) => e.service === 'accompagnement')

/** Empreinte complète d'un plan, tous champs qui comptent. Sert aux comparaisons « rien n'a bougé ». */
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
        ].join('§')
      )
      .sort()
  )
}

// --- L'éligibilité, recalculée depuis le plan et le catalogue ----------------------------------
//
// ⚠️ RECALCULÉE ICI, PAS IMPORTÉE. Le lot va écrire sa propre fonction d'éligibilité ; l'importer
// ferait de ce fichier le miroir du code au lieu de son juge. Les quatre règles sont donc reprises
// de `plan-leftovers.ts` (l. 85-91) à la main.
//
// ⚠️ `dejaPlaces` N'EST PAS DÉDUIT, ET C'EST LA LECTURE DU « Fini quand ». Sous la comptabilité de
// `planLeftovers`, MESURÉ, une semaine fraîchement composée n'offre PLUS AUCUNE portion plaçable —
// 0 créneau à 1, 2 et 3 convives. Le lot n'ajoute pas une capacité, il ajoute un CHOIX : décider où
// va un reste que la machine a déjà placé ailleurs.

type Cause = 'memeJour' | 'conservation' | 'creneau' | 'portions' | 'doublon'

/** Les plats réellement CUISINÉS dans le plan — ni restes, ni accompagnements. */
const cuissonsDe = (plan: WeekPlan): readonly MealPlanEntry[] =>
  plan.entries.filter((e) => e.recipeId !== null && !e.isLeftover && e.service !== 'accompagnement')

/** Pourquoi `source` ne peut pas nourrir `cible`. Vide = elle le peut. */
function causesDeRefus(cat: Catalog, cible: MealPlanEntry, source: MealPlanEntry): readonly Cause[] {
  const recette = cat.recipes.get(source.recipeId as RecipeId)
  if (recette === undefined) return ['doublon']
  const causes: Cause[] = []
  const age = ecartJours(source.slot.date, cible.slot.date)
  if (age < 1) causes.push('memeJour')
  else if (age > recette.conservationJours) causes.push('conservation')
  if (!recette.typesRepas.includes(cible.slot.creneau)) causes.push('creneau')
  if (Math.floor((recette.portionsBase - CONVIVES) / CONVIVES) < 1) causes.push('portions')
  if (source.recipeId === cible.recipeId) causes.push('doublon')
  return causes
}

function sourcesEligibles(
  cat: Catalog,
  plan: WeekPlan,
  cible: MealPlanEntry
): readonly MealPlanEntry[] {
  return cuissonsDe(plan).filter(
    (s) => cleDe(s.slot) !== cleDe(cible.slot) && causesDeRefus(cat, cible, s).length === 0
  )
}

/** Les sources refusées par UNE SEULE cause : un contre-exemple par cause, sans ambiguïté. */
function contreExemples(
  cat: Catalog,
  plan: WeekPlan,
  cible: MealPlanEntry
): ReadonlyMap<Cause, MealPlanEntry> {
  const par = new Map<Cause, MealPlanEntry>()
  for (const s of cuissonsDe(plan)) {
    if (cleDe(s.slot) === cleDe(cible.slot)) continue
    const causes = causesDeRefus(cat, cible, s)
    if (causes.length === 1 && !par.has(causes[0]!)) par.set(causes[0]!, s)
  }
  return par
}

interface Cible {
  readonly slot: SlotRef
  readonly recipeId: RecipeId
  readonly portions: number
  readonly sources: readonly MealPlanEntry[]
}

/**
 * Les créneaux sur lesquels le geste a un sens : un PLAT posé (pas un reste — l'annuler de la
 * clause 7 ne peut pas rendre un reste), non verrouillé, ACCOMPAGNÉ (sans quoi la clause 2 ne
 * mesurerait rien), et offrant au moins une source éligible.
 */
function ciblesDe(cat: Catalog, plan: WeekPlan): readonly Cible[] {
  const accompagnes = new Set(
    plan.entries.filter((e) => e.service === 'accompagnement').map((e) => cleDe(e.slot))
  )
  return plan.entries
    .filter(
      (e) =>
        e.service !== 'accompagnement' &&
        !e.isLeftover &&
        !e.locked &&
        e.recipeId !== null &&
        accompagnes.has(cleDe(e.slot))
    )
    .map((e) => ({
      slot: e.slot,
      recipeId: e.recipeId as RecipeId,
      portions: e.portions,
      sources: sourcesEligibles(cat, plan, e),
    }))
    .filter((c) => c.sources.length > 0)
}

function exigerCibles(plan: WeekPlan, combien: number, journeesDistinctes: boolean): readonly Cible[] {
  const toutes = ciblesDe(catalogueDeTest(), plan)
  const retenues = journeesDistinctes
    ? toutes.filter((c, i) => toutes.findIndex((a) => a.slot.date === c.slot.date) === i)
    : toutes
  if (retenues.length < combien) {
    throw new Error(
      `retour-4 · SEMIS INSUFFISANT, PAS CLAUSE FAUSSE : le plan composé sur le catalogue réel ne ` +
        `fournit que ${retenues.length} créneau(x) cible(s)` +
        `${journeesDistinctes ? ' sur des journées distinctes' : ''}, il en faut ${combien}. ` +
        `Un créneau cible porte un plat non-reste, non verrouillé, accompagné, et au moins une ` +
        `source de reste éligible ailleurs dans la semaine.`
    )
  }
  return retenues.slice(0, combien)
}

/** Le créneau où `recette` est CUISINÉE dans ce plan. Il n'y en a qu'un : `planWeek` interdit le doublon. */
function cuissonDe(plan: WeekPlan, recette: RecipeId): MealPlanEntry {
  const e = cuissonsDe(plan).find((x) => x.recipeId === recette)
  if (e === undefined) {
    throw new Error(
      `retour-4 · le plat ${recette} n’est cuisiné nulle part dans le plan — c’est précisément ` +
        `l’incohérence que la clause 4 refuse, mais ici elle survient AVANT le geste : semis cassé.`
    )
  }
  return e
}

// --- Monter l'écran ---------------------------------------------------------------------------

async function monterSemaine(): Promise<void> {
  const { Semaine } = await import('../../app/src/ui/screens/semaine.js')
  const { ProvenanceLancerParcours } = await import('../../app/src/ui/lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Semaine />
    </ProvenanceLancerParcours>
  )
  await screen.findByText('Proposer une autre semaine')
}

/** La carte d'un créneau : le libellé du repas en est un enfant direct. */
function carteDuCreneau(slot: SlotRef): HTMLElement {
  const journee = screen.getByText(formaterJour(slot.date)).closest('article')
  if (journee === null) throw new Error(`retour-4 · journée ${slot.date} introuvable à l’écran.`)
  const etiquette = within(journee).getAllByText(LIBELLE_CRENEAU[slot.creneau])[0]
  const carte = etiquette?.parentElement
  if (!carte) throw new Error(`retour-4 · carte ${cleDe(slot)} introuvable à l’écran.`)
  return carte
}

// --- La recherche de chemin -------------------------------------------------------------------

/** Ce qui se clique. Les liens sont EXCLUS : ils naviguent, ils n'agissent pas. */
const CLIQUABLE = 'button, [role="tab"], [role="menuitem"], [role="menuitemradio"], [role="option"]'

/**
 * Combien de contrôles apparus au premier clic sont sondés au second. Cité en cas d'échec.
 *
 * ⚠️ Cette borne produit un faux NÉGATIF, pas un faux positif : une implémentation correcte dont le
 * bon contrôle arrive au-delà du rang serait déclarée introuvable. Le message d'échec le dit.
 */
const LARGEUR_MAX = 30

/** Le seul mot que le lot impose : sans lui, le geste existe et personne ne le trouve. */
const RESTES = /restes?/i

function etiquetteDe(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60)
}

function controles(racine: ParentNode): HTMLElement[] {
  return [...racine.querySelectorAll<HTMLElement>(CLIQUABLE)].filter(
    (el) => !(el as HTMLButtonElement).disabled && etiquetteDe(el) !== ''
  )
}

/** Le texte d'un élément SANS ses contrôles — un bouton « Garder » n'est pas une mention. */
function texteHorsControles(el: HTMLElement): string {
  const copie = el.cloneNode(true) as HTMLElement
  for (const c of [...copie.querySelectorAll(CLIQUABLE)]) c.remove()
  return (copie.textContent ?? '').replace(/\s+/g, ' ').trim()
}

async function tick(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

interface Sonde {
  /** Remonte l'écran à neuf sur l'état de départ et rend la racine où le geste doit vivre. */
  readonly racine: () => Promise<HTMLElement>
  readonly ecran: string
  /** Vrai quand l'état visé est atteint EN BASE. Jamais dans le DOM. */
  readonly atteint: () => boolean
  /** Mot que le chemin doit afficher, ou `null` si le lot n'en impose aucun. */
  readonly mot: RegExp | null
}

type Resultat =
  | { readonly ok: true; readonly clics: readonly string[] }
  | { readonly ok: false; readonly essayes: readonly string[]; readonly tronque: boolean }

/**
 * Cherche une suite d'AU PLUS DEUX clics sur des contrôles visibles qui amène `atteint()` à vrai.
 * L'écran est remonté à neuf avant chaque sonde : un clic exploratoire ne pollue jamais le suivant.
 */
async function chercherChemin(sonde: Sonde): Promise<Resultat> {
  const essayes: string[] = []
  let tronque = false
  const premiers = controles(await sonde.racine()).map(etiquetteDe)

  for (const e1 of premiers) {
    const racine = await sonde.racine()
    const avant = controles(document.body).map(etiquetteDe)
    const c1 = controles(racine).find((x) => etiquetteDe(x) === e1)
    if (c1 === undefined) continue
    essayes.push(e1)
    fireEvent.click(c1)
    await tick()
    if (sonde.atteint()) return { ok: true, clics: [e1] }

    // Le second clic ne se cherche que parmi ce que le premier a FAIT APPARAÎTRE — une fenêtre
    // passe par un portail vers `document.body`, d'où la recherche sur tout le document.
    const apparus = controles(document.body).filter((x) => !avant.includes(etiquetteDe(x)))
    const mot = sonde.mot
    const candidats =
      mot !== null && !mot.test(e1) ? apparus.filter((x) => mot.test(etiquetteDe(x))) : apparus
    if (candidats.length > LARGEUR_MAX) tronque = true

    for (const e2 of candidats.slice(0, LARGEUR_MAX).map(etiquetteDe)) {
      const r2 = await sonde.racine()
      const a = controles(r2).find((x) => etiquetteDe(x) === e1)
      if (a === undefined) break
      fireEvent.click(a)
      await tick()
      const b = controles(document.body).find((x) => etiquetteDe(x) === e2)
      if (b === undefined) continue
      essayes.push(`${e1} › ${e2}`)
      fireEvent.click(b)
      await tick()
      if (sonde.atteint()) return { ok: true, clics: [e1, e2] }
    }
  }
  return { ok: false, essayes, tronque }
}

/** Rejoue un chemin déjà trouvé, étiquette par étiquette. Rend `false` si une étiquette manque. */
async function rejouer(
  clics: readonly string[],
  racine: () => Promise<HTMLElement>
): Promise<boolean> {
  const depart = await racine()
  for (const [rang, etiquette] of clics.entries()) {
    const ou = rang === 0 ? depart : document.body
    const cible = controles(ou).find((x) => etiquetteDe(x) === etiquette)
    if (cible === undefined) return false
    fireEvent.click(cible)
    await tick()
  }
  return true
}

function exigerChemin(sujet: string, sonde: Sonde, resultat: Resultat): readonly string[] {
  if (resultat.ok) return resultat.clics
  throw new Error(
    `retour-4 · ${sujet} : AUCUN chemin d’au plus 2 clics` +
      `${sonde.mot === null ? '' : ' affichant « restes »'} n’atteint l’état visé depuis ` +
      `${sonde.ecran}. ${resultat.essayes.length} chemin(s) sondé(s)` +
      `${resultat.tronque ? ` (largeur bornée à ${LARGEUR_MAX} au 2ᵉ clic)` : ''} : ` +
      `${resultat.essayes.join(' | ') || '(aucun contrôle visible)'}`
  )
}

// --- Poser le reste, une fois pour toutes les clauses d'effet ----------------------------------

interface Pose {
  readonly avant: WeekPlan
  readonly apres: WeekPlan
  readonly clics: readonly string[]
  /** Le plat que l'écran a effectivement posé en reste sur la cible. */
  readonly source: RecipeId
}

/**
 * Repose le semis, monte l'écran et rend la carte du créneau. Sert de `racine` à chaque sonde.
 */
function racineSur(cible: Cible, pristine: WeekPlan): () => Promise<HTMLElement> {
  return async () => {
    cleanup()
    savePlan(baseCourante(), pristine, INSTANT)
    await monterSemaine()
    return carteDuCreneau(cible.slot)
  }
}

/**
 * Pose un reste sur `cible` depuis l'écran Semaine, par le chemin le moins cher qui existe, et rend
 * le plan AVANT et APRÈS, relus en base.
 *
 * ⚠️ Aucune frappe : `fireEvent.change` n'est appelé nulle part dans ce fichier. Une entrée de reste
 * en base après un chemin qui n'a que des clics EST la preuve que l'application l'a fournie.
 */
async function poserResteDepuisSemaine(sujet: string, cible: Cible, pristine: WeekPlan): Promise<Pose> {
  const sonde: Sonde = {
    ecran: `l’écran Semaine, sur le créneau ${cleDe(cible.slot)}`,
    mot: RESTES,
    racine: racineSur(cible, pristine),
    atteint: () => {
      const e = principale(planEnBase(), cible.slot)
      return e !== undefined && e.isLeftover && e.recipeId !== null
    },
  }
  const clics = exigerChemin(sujet, sonde, await chercherChemin(sonde))
  const apres = planEnBase()
  const pose = principale(apres, cible.slot)
  expect(pose, `${sujet} : plus d’entrée principale sur ${cleDe(cible.slot)}`).toBeDefined()
  return { avant: pristine, apres, clics, source: pose!.recipeId as RecipeId }
}

/** Le plat posé doit être l'un de ceux que les quatre règles autorisent. */
function exigerSourceEligible(sujet: string, cible: Cible, source: RecipeId): void {
  const permis = cible.sources.map((s) => s.recipeId)
  expect(
    permis.includes(source),
    `${sujet} : l’écran a posé ${source} en reste sur ${cleDe(cible.slot)}, alors que les quatre ` +
      `règles de \`plan-leftovers.ts\` n’autorisent que ${permis.join(', ') || '(rien)'}.`
  ).toBe(true)
}

// =============================================================================================
// Clause 1 — le geste existe, au plus deux clics, aucune frappe, le mot « restes » sur le chemin
// =============================================================================================

describe.each([2, 3])('retour-4 · clause 1 — le geste, à %i repas par jour', (repasParJour) => {
  it('⛔ au plus 2 clics, aucune frappe, le mot « restes » affiché, et un reste écrit en base', async () => {
    const pristine = semer(repasParJour)
    const [cible] = exigerCibles(pristine, 1, false)
    const sujet = `clause 1 (${repasParJour} repas/jour)`
    const pose = await poserResteDepuisSemaine(sujet, cible!, pristine)

    expect(pose.clics.length).toBeLessThanOrEqual(2)
    expect(
      pose.clics.some((c) => RESTES.test(c)),
      `${sujet} : le chemin « ${pose.clics.join(' › ')} » n’affiche jamais le mot « restes ».`
    ).toBe(true)

    const entree = principale(pose.apres, cible!.slot)!
    expect(entree.isLeftover, `${sujet} : la cible n’est pas marquée comme un reste`).toBe(true)
    expect(entree.recipeId).not.toBeNull()
    exigerSourceEligible(sujet, cible!, pose.source)
  })
})

// =============================================================================================
// Clause 2 — l'entrée écrite est indiscernable d'un reste posé par le moteur, au verrou près
// =============================================================================================

describe.each([2, 3])('retour-4 · clause 2 — la forme de l’entrée, à %i repas par jour', (repasParJour) => {
  it('⛔ mêmes champs qu’un reste du moteur, accompagnement CONSERVÉ, et seul `locked` diffère', async () => {
    const pristine = semer(repasParJour)
    const [cible] = exigerCibles(pristine, 1, false)
    const sujet = `clause 2 (${repasParJour} repas/jour)`
    const accompagnementAvant = accompagnement(pristine, cible!.slot)
    expect(
      accompagnementAvant,
      `${sujet} : SEMIS — la cible retenue devait être accompagnée, elle ne l’est pas.`
    ).toBeDefined()

    const pose = await poserResteDepuisSemaine(sujet, cible!, pristine)
    const entree = principale(pose.apres, cible!.slot)!

    expect(entree.isLeftover).toBe(true)
    expect(
      entree.portions,
      `${sujet} : un reste se sert pour ${CONVIVES} convive(s), pas pour ${entree.portions}.`
    ).toBe(CONVIVES)
    expect(
      entree.horsCatalogue,
      `${sujet} : un reste porte un plat du catalogue, jamais une étiquette libre.`
    ).toBeNull()
    expect(
      entree.service,
      `${sujet} : le geste a changé le \`service\` du créneau, que \`planLeftovers\` ne touche jamais.`
    ).toBe(principale(pristine, cible!.slot)!.service)
    expect(entree.locked, `${sujet} : la cible posée à la main est gardée`).toBe(true)

    // ⛔ CE QUI TUE L'ÉCRITURE RECOPIÉE DE `setSlotHorsCatalogue` : ce geste-là VIDE le créneau.
    const accompagnementApres = accompagnement(pose.apres, cible!.slot)
    expect(
      accompagnementApres?.recipeId,
      `${sujet} : l’accompagnement de ${cleDe(cible!.slot)} a disparu. \`planLeftovers\` le laisse ` +
        `en place — mesuré sur 10 des 13 créneaux qu’il transforme. Un créneau vidé de son ` +
        `accompagnement n’est pas un créneau que le moteur aurait écrit.`
    ).toBe(accompagnementAvant!.recipeId)
  })
})

// =============================================================================================
// Clause 3 — ni trou, ni recalcul
// =============================================================================================

describe.each([2, 3])('retour-4 · clause 3 — rien d’autre ne bouge, à %i repas par jour', (repasParJour) => {
  it('⛔ même nombre d’entrées, mêmes créneaux, et tout le reste identique champ pour champ', async () => {
    const pristine = semer(repasParJour)
    const [cible] = exigerCibles(pristine, 1, false)
    const sujet = `clause 3 (${repasParJour} repas/jour)`
    const pose = await poserResteDepuisSemaine(sujet, cible!, pristine)
    const cuisson = cuissonDe(pristine, pose.source)

    const clesAvant = pristine.entries.map((e) => `${cleDe(e.slot)}|${e.service ?? ''}`).sort()
    const clesApres = pose.apres.entries.map((e) => `${cleDe(e.slot)}|${e.service ?? ''}`).sort()
    expect(
      clesApres,
      `${sujet} : le geste a ajouté ou retiré des entrées. Poser un reste REMPLACE un repas, il ` +
        `n’en crée pas et n’en supprime pas.`
    ).toEqual(clesAvant)

    const intouchables = new Set([cleDe(cible!.slot), cleDe(cuisson.slot)])
    for (const avant of pristine.entries) {
      if (intouchables.has(cleDe(avant.slot))) continue
      const apres = pose.apres.entries.find(
        (e) => cleDe(e.slot) === cleDe(avant.slot) && (e.service ?? '') === (avant.service ?? '')
      )
      expect(
        [apres?.recipeId, apres?.portions, apres?.locked, apres?.isLeftover, apres?.horsCatalogue],
        `${sujet} : ${cleDe(avant.slot)} a changé alors que le geste ne le visait pas — le geste ` +
          `a recomposé la semaine au lieu de toucher un créneau.`
      ).toEqual([avant.recipeId, avant.portions, avant.locked, avant.isLeftover, avant.horsCatalogue])
    }

    // Sur le créneau de la cuisson, SEUL `locked` a le droit d'avoir changé (clause 4).
    const cuissonApres = pose.apres.entries.find(
      (e) => cleDe(e.slot) === cleDe(cuisson.slot) && (e.service ?? '') === (cuisson.service ?? '')
    )
    expect(
      [cuissonApres?.recipeId, cuissonApres?.portions, cuissonApres?.isLeftover],
      `${sujet} : le geste a modifié le PLAT cuisiné, alors qu’il ne devait que le protéger.`
    ).toEqual([cuisson.recipeId, cuisson.portions, cuisson.isLeftover])
  })
})

// =============================================================================================
// Clause 4 — la cuisson est protégée, et la semaine survit à une recomposition
// =============================================================================================

/** Tout reste du plan a-t-il son plat cuisiné à un créneau ANTÉRIEUR du même plan ? */
function restesOrphelins(plan: WeekPlan): readonly string[] {
  const cuissons = cuissonsDe(plan)
  return plan.entries
    .filter((e) => e.isLeftover && e.recipeId !== null)
    .filter((r) => {
      const source = cuissons.find((c) => c.recipeId === r.recipeId)
      return source === undefined || ecartJours(source.slot.date, r.slot.date) < 1
    })
    .map((r) => `${cleDe(r.slot)} → ${r.recipeId}`)
}

describe.each([2, 3])('retour-4 · clause 4 — la cuisson protégée, à %i repas par jour', (repasParJour) => {
  it('⛔ le créneau de la cuisson est gardé, et aucun reste ne survit sans son plat après recomposition', async () => {
    const pristine = semer(repasParJour)
    const [cible] = exigerCibles(pristine, 1, false)
    const sujet = `clause 4 (${repasParJour} repas/jour)`

    expect(
      restesOrphelins(pristine),
      `${sujet} : SEMIS — le plan composé par le moteur contient déjà un reste sans cuisson.`
    ).toEqual([])

    const pose = await poserResteDepuisSemaine(sujet, cible!, pristine)
    const cuisson = cuissonDe(pristine, pose.source)

    // (a) le verrou sur la CUISSON, celui que personne n'avait écrit
    const cuissonApres = principale(pose.apres, cuisson.slot)
    expect(
      cuissonApres?.locked,
      `${sujet} : ${cleDe(cuisson.slot)} porte le plat dont on vient de manger le reste, et il n’est ` +
        `PAS gardé. \`plan-week.ts:244\` verse le \`recipeId\` de toute entrée verrouillée dans ` +
        `\`placedRecipeIds\` : le reste verrouillé compte alors comme la cuisson, et la ` +
        `recomposition suivante n’ordonne plus jamais le plat. MESURÉ sur le code livré : ` +
        `« cuissons : AUCUNE / restes : 1 ». Verrouiller la cible sans verrouiller la cuisson ` +
        `produit une semaine dont un repas n’a jamais été acheté ni cuisiné.`
    ).toBe(true)

    // ⛔ CE QUI N'EST PAS EXIGÉ ICI, ET POURQUOI — CORRIGÉ LE 2026-08-26, SCEAU LEVÉ PAR L'AUTEUR.
    // Cette clause exigeait `restesOrphelins(pose.apres)` VIDE, c'est-à-dire l'invariant tenu dès
    // l'instant du geste. C'était INTENABLE, et c'est la clause 3 qui l'interdit : elle fige tout
    // créneau hors de {cible, cuisson}. Or le catalogue réel n'offre que DEUX cibles par rythme, et
    // LES QUATRE SONT ELLES-MÊMES LA CUISSON de restes que `planLeftovers` a déjà posés — mesuré :
    //   2 repas · 2026-03-12 diner (poulet curry) nourrit 3 restes · 2026-03-14 diner (quiche) 4
    //   3 repas · 2026-03-13 dejeuner (tajine)    nourrit 3 restes · 2026-03-15 diner (lapin)  2
    // Remplacer le plat de la cible prive donc 2 à 4 restes de leur cuisson, et la clause 3 défend
    // d'y toucher. Aucune implémentation ne satisfait les deux : ce n'était pas un défaut du code,
    // c'était une contradiction entre deux clauses du même examen.
    // ▶ L'invariant reste exigé LÀ OÙ IL A UN SENS — après la recomposition, ci-dessous. Mesuré sur
    //   le moteur, aux deux rythmes : « orphelins juste après le geste : 3 · APRÈS recomposition :
    //   aucun », la cible gardant son reste (`isLeftover=true locked=true`). Le décalage est
    //   TRANSITOIRE PAR CONSTRUCTION, et c'est le prochain tirage qui l'efface.
    // ⚠️ La première assertion de la clause — le verrou sur la CUISSON, juste au-dessus — n'a PAS
    //   bougé : c'est elle qui porte le piège de `plan-week.ts:244`, et elle est vérifiée à
    //   l'instant du geste.

    // (b) et l'invariant tient encore après une recomposition demandée par l'utilisateur
    const relancer = controles(document.body).find(
      (b) => etiquetteDe(b) === 'Proposer une autre semaine'
    )
    expect(relancer, `${sujet} : « Proposer une autre semaine » introuvable`).toBeDefined()
    fireEvent.click(relancer!)
    await tick()
    await screen.findByText('Proposer une autre semaine')
    await tick()

    const recompose = planEnBase()
    expect(
      restesOrphelins(recompose),
      `${sujet} : après « Proposer une autre semaine », la semaine porte un reste dont le plat n’est ` +
        `cuisiné nulle part. C’est le décalage émergent de la décision 78 qui ne tient pas : le ` +
        `verrouillage devait suffire, et il ne suffit que si les DEUX créneaux sont verrouillés.`
    ).toEqual([])

    const gardee = principale(recompose, cible!.slot)
    expect(
      [gardee?.recipeId, gardee?.isLeftover],
      `${sujet} : la recomposition a emporté le reste que l’utilisateur avait posé.`
    ).toEqual([pose.source, true])
  })
})

// =============================================================================================
// Clause 5 — l'offre ne contient que ce qui est mangeable
// =============================================================================================

/** Les noms de plats CUISINÉS lisibles dans une liste d'étiquettes de contrôles. */
function platsNommesDans(etiquettes: readonly string[], plan: WeekPlan): ReadonlySet<RecipeId> {
  const cat = catalogueDeTest()
  const vus = new Set<RecipeId>()
  const texte = etiquettes.join(' § ').toLowerCase()
  for (const c of cuissonsDe(plan)) {
    const nom = cat.recipes.get(c.recipeId as RecipeId)?.nom
    if (nom !== undefined && nom !== '' && texte.includes(nom.toLowerCase())) {
      vus.add(c.recipeId as RecipeId)
    }
  }
  return vus
}

describe.each([2, 3])('retour-4 · clause 5 — l’offre, à %i repas par jour', (repasParJour) => {
  it('⛔ aucun plat périmé, hors créneau, du même jour ou sans portion n’est proposé', async () => {
    const pristine = semer(repasParJour)
    // ⚠️ TOUTES les cibles du rythme, pas la première. MESURÉ le 2026-08-26 : une cible donnée
    // n'offre qu'UNE ou DEUX causes de refus à cause unique — `2026-03-13|dejeuner` donne
    // {creneau, memeJour}, `2026-03-15|diner` donne {conservation}. Le total par rythme
    // ({memeJour 13, creneau 6, conservation 5, portions 1} à 3 repas/jour) est une SOMME sur
    // toutes les cibles : l'exiger sur une seule aurait fait échouer la clause sur une ABSENCE DE
    // CAS, pas sur un défaut. Le balayage prend les causes là où elles sont.
    const cibles = exigerCibles(pristine, 2, false)
    const cat = catalogueDeTest()
    const causesVues = new Set<Cause>()

    for (const cible of cibles) {
      const sujet = `clause 5 (${repasParJour} repas/jour, ${cleDe(cible.slot)})`
      const entreeCible = principale(pristine, cible.slot)!
      const refuses = contreExemples(cat, pristine, entreeCible)
      expect(
        refuses.size,
        `${sujet} : SEMIS — aucune source refusée par une cause UNIQUE, donc aucun contre-exemple ` +
          `sans ambiguïté sur ce créneau.`
      ).toBeGreaterThan(0)
      for (const cause of refuses.keys()) causesVues.add(cause)

      const pose = await poserResteDepuisSemaine(sujet, cible, pristine)
      exigerSourceEligible(sujet, cible, pose.source)

      // Ce que l'écran proposait juste avant le clic qui pose le reste.
      const carteVierge = await racineSur(cible, pristine)()
      const avant = controles(document.body).map(etiquetteDe)
      const rejoue = await rejouer(pose.clics.slice(0, -1), async () => carteVierge)
      expect(rejoue, `${sujet} : le chemin trouvé ne se rejoue pas`).toBe(true)
      const apparus = controles(document.body)
        .map(etiquetteDe)
        .filter((e) => !avant.includes(e))
      // Chemin d'un seul clic : rien n'« apparaît », l'offre est ce que la carte porte déjà.
      const offreLue = apparus.length > 0 ? apparus : controles(carteVierge).map(etiquetteDe)

      const proposes = platsNommesDans(offreLue, pristine)
      for (const [cause, source] of refuses) {
        const nom = cat.recipes.get(source.recipeId as RecipeId)?.nom ?? ''
        expect(
          proposes.has(source.recipeId as RecipeId),
          `${sujet} : « ${nom} » est proposé en reste alors que la seule règle « ${cause} » de ` +
            `\`plan-leftovers.ts\` l’interdit. Proposer tout ce qui a été cuisiné avant n’est pas ` +
            `proposer ce qui se mange.`
        ).toBe(false)
      }

      if (apparus.length > 0) {
        const attendus = new Set(cible.sources.map((s) => s.recipeId as RecipeId))
        for (const id of proposes) {
          expect(
            attendus.has(id),
            `${sujet} : ${id} est proposé sans satisfaire les quatre règles.`
          ).toBe(true)
        }
      }
    }

    // ⚠️ MESURÉ : l'union sur les deux cibles couvre {conservation, memeJour} à 2 repas/jour et
    // {memeJour, creneau, conservation} à 3. « portions » n'a AUCUN contre-exemple à cause unique
    // sur une cible offrante — la clause ne l'exige donc pas, et le DIT plutôt que de le taire.
    expect(
      causesVues.size,
      `clause 5 (${repasParJour} repas/jour) : SEMIS — les cibles du rythme ne couvrent que ` +
        `${[...causesVues].join(', ') || '(rien)'} ; il en faut au moins deux distinctes pour que ` +
        `la clause discrimine autre chose que « même jour ».`
    ).toBeGreaterThanOrEqual(2)
  })
})

// =============================================================================================
// Clause 6 — un créneau sans offre ne propose rien, et n'écrit rien
// =============================================================================================

describe.each([2, 3])('retour-4 · clause 6 — le créneau sans offre, à %i repas par jour', (repasParJour) => {
  it('⛔ le chemin du geste, rejoué là où rien ne se mange, n’écrit pas une ligne', async () => {
    const pristine = semer(repasParJour)
    const [cible] = exigerCibles(pristine, 1, false)
    const sujet = `clause 6 (${repasParJour} repas/jour)`
    const cat = catalogueDeTest()

    const sansOffre = pristine.entries.filter(
      (e) =>
        e.service !== 'accompagnement' &&
        !e.isLeftover &&
        !e.locked &&
        e.recipeId !== null &&
        sourcesEligibles(cat, pristine, e).length === 0
    )
    expect(
      sansOffre.length,
      `${sujet} : SEMIS — aucun créneau à plat posé n’est privé de source. Mesuré le 2026-08-26 : ` +
        `5 des 8 à 3 repas/jour, 2 des 4 à 2 repas/jour, dont toujours ceux du premier jour.`
    ).toBeGreaterThan(0)

    const pose = await poserResteDepuisSemaine(sujet, cible!, pristine)

    const orphelin = sansOffre[0]!
    cleanup()
    savePlan(baseCourante(), pristine, INSTANT)
    await monterSemaine()
    const empreinteAvant = empreinte(planEnBase())
    const rejoue = await rejouer(pose.clics, async () => carteDuCreneau(orphelin.slot))

    // Le chemin peut légitimement ne pas exister ici — c'est même la bonne réponse. Ce qui est
    // interdit, c'est qu'il existe ET qu'il écrive.
    const apres = planEnBase()
    const entree = principale(apres, orphelin.slot)
    expect(
      entree?.isLeftover,
      `${sujet} : ${cleDe(orphelin.slot)} est devenu un reste alors qu’AUCUN plat cuisiné de la ` +
        `semaine ne peut y être servi — ni assez frais, ni au bon créneau, ni avec des portions ` +
        `restantes. Le chemin rejoué était « ${pose.clics.join(' › ')} » (rejeu ${rejoue ? 'réussi' : 'impossible'}).`
    ).toBe(false)
    expect(
      empreinte(apres),
      `${sujet} : rien ne devait être écrit sur un créneau sans offre.`
    ).toBe(empreinteAvant)
  })
})

// =============================================================================================
// Clause 7 — le geste se défait, et rend les DEUX côtés
// =============================================================================================

describe.each([2, 3])('retour-4 · clause 7 — l’annuler, à %i repas par jour', (repasParJour) => {
  it('⛔ le MÊME chemin rend le plat exact ET relâche le verrou de la cuisson, sur une autre journée', async () => {
    const pristine = semer(repasParJour)
    const deux = exigerCibles(pristine, 2, true)
    const premier = deux[0]!
    const sujet = `clause 7 (${repasParJour} repas/jour)`

    // 1. Trouver l'annuler sur la première cible, sans imposer son libellé.
    const sonde: Sonde = {
      ecran: `l’écran Semaine, sur le créneau ${cleDe(premier.slot)} déjà transformé en reste`,
      mot: null,
      racine: async () => {
        cleanup()
        savePlan(baseCourante(), pristine, INSTANT)
        await monterSemaine()
        const pose = await poserResteDepuisSemaine(`${sujet} — pose préalable`, premier, pristine)
        expect(principale(pose.apres, premier.slot)!.isLeftover).toBe(true)
        cleanup()
        await monterSemaine()
        return carteDuCreneau(premier.slot)
      },
      atteint: () => {
        const e = principale(planEnBase(), premier.slot)
        return e !== undefined && e.recipeId === premier.recipeId && !e.isLeftover
      },
    }
    const clics = exigerChemin(`${sujet} — le geste se défait`, sonde, await chercherChemin(sonde))
    expect(clics.length).toBeLessThanOrEqual(2)

    // 2. Le REJOUER à l'identique sur l'autre journée, sur un autre plat. Un chemin qui nommait le
    //    plat d'origine ne survit pas à ce rejeu — c'est tout l'objet de l'étape.
    //    ⚠️ UN SEUL REJEU : mesuré, le catalogue ne fournit que deux cibles par rythme.
    const autre = deux[1]!
    const pose = await poserResteDepuisSemaine(`${sujet} — rejeu`, autre, pristine)
    const cuisson = cuissonDe(pristine, pose.source)
    const verrouAvant = principale(pristine, cuisson.slot)!.locked

    cleanup()
    await monterSemaine()
    const rejoue = await rejouer(clics, async () => carteDuCreneau(autre.slot))
    expect(
      rejoue,
      `${sujet} : le chemin « ${clics.join(' › ')} » n’existe plus sur ${cleDe(autre.slot)} — un ` +
        `annuler dont le libellé change avec le plat n’est pas un annuler, c’est un choix.`
    ).toBe(true)

    const apres = planEnBase()
    const rendu = principale(apres, autre.slot)!
    expect(rendu.recipeId, `${sujet} : ${cleDe(autre.slot)} n’a pas retrouvé son plat`).toBe(
      autre.recipeId
    )
    expect(rendu.isLeftover, `${sujet} : annuler ne laisse pas un reste`).toBe(false)
    expect(
      rendu.portions,
      `${sujet} : le plat est revenu pour ${rendu.portions} portion(s) au lieu de ${autre.portions}.`
    ).toBe(autre.portions)
    expect(rendu.locked, `${sujet} : annuler ne laisse pas la cible verrouillée`).toBe(
      principale(pristine, autre.slot)!.locked
    )

    // ⛔ CE QUI TUE LE DEMI-ANNULER : rendre le plat et oublier le verrou posé sur la CUISSON.
    expect(
      principale(apres, cuisson.slot)!.locked,
      `${sujet} : ${cleDe(cuisson.slot)} est resté gardé après l’annulation. Le geste avait posé ce ` +
        `verrou pour protéger la cuisson du reste ; le reste n’existe plus, et le verrou fige un ` +
        `créneau que l’utilisateur n’a jamais demandé à garder.`
    ).toBe(verrouAvant)

    expect(
      empreinte(apres),
      `${sujet} : après l’annulation, le plan n’est pas revenu à ce qu’il était.`
    ).toBe(empreinte(pristine))
  })
})

// =============================================================================================
// Clause 8 — la carte dit les DEUX : c'est un reste, et il est gardé
// =============================================================================================

describe.each([2, 3])('retour-4 · clause 8 — la carte, à %i repas par jour', (repasParJour) => {
  it('⛔ « reste » et « gardé » sont lisibles ENSEMBLE sur le créneau', async () => {
    const pristine = semer(repasParJour)
    const [cible] = exigerCibles(pristine, 1, false)
    const sujet = `clause 8 (${repasParJour} repas/jour)`
    await poserResteDepuisSemaine(sujet, cible!, pristine)

    cleanup()
    await monterSemaine()
    const texte = texteHorsControles(carteDuCreneau(cible!.slot))

    expect(
      /restes?/i.test(texte),
      `${sujet} : la carte de ${cleDe(cible!.slot)} ne dit pas que c’est un reste. Mesuré sur le ` +
        `code livré : \`semaine.tsx:911\` choisit ENTRE « Gardé » et « Reste du plat de la veille », ` +
        `donc un reste verrouillé perd le mot « reste » exactement quand il compte. Lu : « ${texte} »`
    ).toBe(true)
    expect(
      /gard[ée]/i.test(texte),
      `${sujet} : la carte de ${cleDe(cible!.slot)} ne dit pas que le créneau est gardé, alors que ` +
        `le geste l’a verrouillé et que la recomposition le préservera. Lu : « ${texte} »`
    ).toBe(true)
  })
})

// =============================================================================================
// Clause 9 — « la veille » cesse de mentir
// =============================================================================================
//
// ⚠️ SEULE CLAUSE QUI RÉPARE UN DÉFAUT QUE LE GESTE N'A PAS CRÉÉ. Elle est signalée comme telle
// dans le « Fini quand » et elle se raye sans toucher aux neuf autres.

describe.each([2, 3])('retour-4 · clause 9 — « la veille », à %i repas par jour', (repasParJour) => {
  it('⛔ un reste vieux de 2 jours ou plus n’est pas annoncé comme celui de la veille', async () => {
    const pristine = semer(repasParJour)
    const cuissons = cuissonsDe(pristine)
    const vieux = pristine.entries.filter((e) => {
      if (!e.isLeftover || e.recipeId === null) return false
      const source = cuissons.find((c) => c.recipeId === e.recipeId)
      return source !== undefined && ecartJours(source.slot.date, e.slot.date) >= 2
    })
    expect(
      vieux.length,
      `retour-4 · clause 9 : SEMIS — aucun reste posé à 2 jours ou plus. Mesuré le 2026-08-26 : ` +
        `4 des 13 restes à 3 repas/jour, 4 des 10 à 2 repas/jour ; 223 des 330 recettes du ` +
        `catalogue se conservent plus d’un jour.`
    ).toBeGreaterThan(0)

    await monterSemaine()
    for (const reste of vieux) {
      const texte = texteHorsControles(carteDuCreneau(reste.slot))
      const source = cuissons.find((c) => c.recipeId === reste.recipeId)!
      const age = ecartJours(source.slot.date, reste.slot.date)
      expect(
        /\b(la veille|hier)\b/i.test(texte),
        `retour-4 · clause 9 (${repasParJour} repas/jour) : ${cleDe(reste.slot)} porte le reste d’un ` +
          `plat cuisiné il y a ${age} jours, et la carte dit qu’il vient de la veille. Lu : « ${texte} »`
      ).toBe(false)
    }
  })
})

// =============================================================================================
// Clause 10 — rien n'est écrit hors du plan
// =============================================================================================

describe('retour-4 · clause 10 — rien hors du plan', () => {
  it('⛔ aucune ligne d’historique, aucune migration, et la contrainte de la v9 tient toujours', async () => {
    const pristine = semer(3)
    const [cible] = exigerCibles(pristine, 1, false)
    const db = baseCourante()
    const compteHistorique = (): number =>
      db.all<{ readonly n: number }>('SELECT count(*) AS n FROM meal_history')[0]?.n ?? -1
    expect(compteHistorique()).toBe(0)

    await poserResteDepuisSemaine('clause 10', cible!, pristine)

    expect(
      compteHistorique(),
      'clause 10 : poser un reste n’est pas « ce plat a été retenu » — l’historique ne bouge pas.'
    ).toBe(0)

    expect(USER_SCHEMA_VERSION, 'clause 10 : poser un reste ne demande AUCUNE migration').toBe(18)
    expect(
      db.all<{ readonly schema_version: number }>(
        'SELECT schema_version FROM app_meta WHERE id = 1'
      )[0]?.schema_version
    ).toBe(USER_SCHEMA_VERSION)

    // La contrainte de la v9 : un créneau porte un plat, OU une étiquette. Jamais les deux.
    expect(
      () =>
        db.run(
          `INSERT INTO meal_plan_entry
             (plan_id, date, creneau, service, recipe_id, portions, verrouille, est_reste, hors_catalogue)
           VALUES (?, '2099-01-01', 'diner', NULL, ?, 1, 1, 1, 'Restaurant')`,
          [pristine.id, cible!.recipeId]
        ),
      'clause 10 : la base doit REFUSER un créneau qui porte un plat ET une étiquette, reste compris.'
    ).toThrow()
  })
})
