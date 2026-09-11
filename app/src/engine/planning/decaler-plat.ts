// engine/planning/decaler-plat.ts — « Décaler ce plat ? » sur un repas passé (lot `retour-8`,
// décision 75 révisée le 2026-09-11).
//
// Un plat cuisiné passé laisse des restes plus loin dans la semaine. S'il n'a pas été fait, ses
// restes n'existent pas : « Décaler » met le plat À LA PLACE DE SON PREMIER RESTE À VENIR, et rien
// d'autre ne bouge — sauf les restes de ce plat qui ne peuvent plus être mangés, qui se vident.
//
// ⛔ LA SEMAINE NE GLISSE PAS. L'ancienne règle poussait chaque repas d'un cran : « si l'utilisateur
// voulait manger des pâtes le lundi, on ne va pas décaler toute la semaine ». Le plat prend une
// case qui, de toute façon, n'aurait rien porté de vrai.
//
// ⛔ L'HORLOGE N'ENTRE PAS ICI. « Passé » dépend de l'heure locale et des fenêtres de repas de
// l'écran (`ui/creneau.ts`) : le prédicat est injecté par l'appelant, comme partout ailleurs (§3
// ENGINE). C'est ce qui garde ce module pur et testable heure par heure.
//
// Dépendances autorisées : domain/ uniquement — §2/§3 ENGINE.

import type { Catalog, MealPlanEntry, MealSlot, SlotRef, WeekPlan } from '../domain/index.js'
import { ecartJours } from './plan-leftovers.js'

/** Vrai si le repas de `slot` est passé. Fourni par l'appelant, qui seul connaît l'heure. */
export type EstPasse = (slot: SlotRef) => boolean

const ORDRE_DES_REPAS: readonly MealSlot[] = ['petit_dejeuner', 'dejeuner', 'gouter', 'diner']

const memeCreneau = (a: SlotRef, b: SlotRef): boolean => a.date === b.date && a.creneau === b.creneau

const estAccompagnement = (e: MealPlanEntry): boolean => e.service === 'accompagnement'

const estVide = (e: MealPlanEntry): boolean => e.recipeId === null && e.horsCatalogue === null

const cleDe = (s: SlotRef): string => `${s.date}|${s.creneau}`

/** L'entrée qui porte LE PLAT d'un créneau — jamais son accompagnement. */
function platDe(plan: WeekPlan, slot: SlotRef): MealPlanEntry | undefined {
  return plan.entries.find((e) => memeCreneau(e.slot, slot) && !estAccompagnement(e))
}

function dansLOrdreDuTemps(a: SlotRef, b: SlotRef): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  return ORDRE_DES_REPAS.indexOf(a.creneau) - ORDRE_DES_REPAS.indexOf(b.creneau)
}

/**
 * Les restes du plat de `slot` qui ne sont ni passés ni gardés, dans l'ordre du temps.
 *
 * ⚠️ UN RESTE GARDÉ N'EST PAS UNE PLACE LIBRE. L'utilisateur l'a figé : l'écraser défait une
 * décision qu'il a prise lui-même. Un créneau « dehors » n'est pas un reste, il n'est donc jamais
 * candidat non plus.
 */
export function restesAVenir(plan: WeekPlan, slot: SlotRef, estPasse: EstPasse): readonly SlotRef[] {
  const plat = platDe(plan, slot)
  if (plat === undefined || plat.recipeId === null) return []
  return plan.entries
    .filter(
      (e) =>
        !estAccompagnement(e) &&
        e.isLeftover &&
        !e.locked &&
        e.recipeId === plat.recipeId &&
        !estPasse(e.slot)
    )
    .map((e) => e.slot)
    .sort(dansLOrdreDuTemps)
}

/**
 * Le créneau porte-t-il la question ? Un plat CUISINÉ (ni reste, ni gardé), passé, qui a au moins un
 * reste à venir. Sans reste à venir, il n'y a nulle part où le mettre : la question ne se pose pas.
 */
export function peutDecaler(plan: WeekPlan, slot: SlotRef, estPasse: EstPasse): boolean {
  const plat = platDe(plan, slot)
  return (
    plat !== undefined &&
    plat.recipeId !== null &&
    !plat.isLeftover &&
    !plat.locked &&
    estPasse(slot) &&
    restesAVenir(plan, slot, estPasse).length > 0
  )
}

/**
 * Une case libérée par le geste. Le motif dit ce qui s'est passé ; la phrase vit dans
 * `ui/motif-vide.ts`.
 */
function caseLiberee(e: MealPlanEntry): MealPlanEntry {
  return {
    ...e,
    recipeId: null,
    horsCatalogue: null,
    motifVide: 'decale',
    // Une case vide ne produit rien (migration v19 : case vide ⇒ zéro portion).
    portions: 0,
    isLeftover: false,
    // Mode recette : son accompagnement part avec le plat.
    service: null,
  }
}

/**
 * « Décaler » : le plat de `slot`, portions et accompagnement compris, prend la place de son premier
 * reste à venir. Rend un NOUVEAU plan.
 *
 * Trois effets, et pas un de plus :
 *   1. la case d'arrivée porte le plat tel qu'il était — mêmes portions de cuisson, même
 *      accompagnement ; celui qu'elle avait part avec le reste qu'elle portait ;
 *   2. la case du repas passé devient vide, motif `decale` ;
 *   3. les restes À VENIR non gardés qui ne peuvent plus être mangés là où ils sont se vident, même
 *      motif : plus aucune cuisson du même plat entre 1 jour et sa conservation avant eux (typiquement
 *      le reste du même jour que la nouvelle cuisson), ou une recette qui ne se sert pas à ce repas.
 *
 * ⚠️ LA RÈGLE DU POINT 3 PORTE SUR TOUTES LES CASES, pas seulement sur celles du plat décalé : c'est
 * l'invariant « aucun reste à venir impossible », pas une liste de cases à nettoyer. Sur un plan que
 * `planLeftovers` a composé, seuls les restes du plat décalé peuvent le violer.
 *
 * Créneau qui ne porte pas la question (voir `peutDecaler`) → plan rendu INCHANGÉ, sans erreur. Même
 * posture que `setSlotLeftover` : l'écran ne propose le geste que là où il vaut, un appel ailleurs
 * ne peut venir que d'un état périmé.
 */
export function decalerPlat(catalog: Catalog, plan: WeekPlan, slot: SlotRef, estPasse: EstPasse): WeekPlan {
  if (!peutDecaler(plan, slot, estPasse)) return plan
  const arrivee = restesAVenir(plan, slot, estPasse)[0]!
  const plat = platDe(plan, slot)!
  const accompagnement = plan.entries.find((e) => memeCreneau(e.slot, slot) && estAccompagnement(e))

  const deplace: MealPlanEntry[] = []
  for (const e of plan.entries) {
    if (memeCreneau(e.slot, slot)) {
      if (!estAccompagnement(e)) deplace.push(caseLiberee(e))
      continue
    }
    if (memeCreneau(e.slot, arrivee)) {
      if (estAccompagnement(e)) continue
      deplace.push({ ...plat, slot: e.slot })
      if (accompagnement !== undefined) deplace.push({ ...accompagnement, slot: e.slot })
      continue
    }
    deplace.push(e)
  }

  const impossibles = new Set(
    restesImpossibles(catalog, deplace, estPasse).map((e) => cleDe(e.slot))
  )
  if (impossibles.size === 0) return { ...plan, entries: deplace }

  const entries: MealPlanEntry[] = []
  for (const e of deplace) {
    if (!impossibles.has(cleDe(e.slot))) entries.push(e)
    else if (!estAccompagnement(e)) entries.push(caseLiberee(e))
  }
  return { ...plan, entries }
}

/** Les restes à venir, non gardés, qui ne peuvent pas être mangés là où ils sont. */
function restesImpossibles(
  catalog: Catalog,
  entries: readonly MealPlanEntry[],
  estPasse: EstPasse
): readonly MealPlanEntry[] {
  const plats = entries.filter((e) => !estAccompagnement(e))
  return plats.filter((e) => {
    if (estVide(e) || !e.isLeftover || e.locked || estPasse(e.slot)) return false
    const recette = e.recipeId === null ? undefined : catalog.recipes.get(e.recipeId)
    if (recette === undefined || !recette.typesRepas.includes(e.slot.creneau)) return true
    return !plats.some((cuisson) => {
      if (estVide(cuisson) || cuisson.isLeftover || cuisson.recipeId !== e.recipeId) return false
      const age = ecartJours(cuisson.slot.date, e.slot.date)
      return age >= 1 && age <= recette.conservationJours
    })
  })
}
