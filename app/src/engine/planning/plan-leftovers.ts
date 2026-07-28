// engine/planning/plan-leftovers.ts — placement des restes (docs/ENGINE.md §7.3).
//
// « Une recette de 4 portions cuisinée pour 2 personnes laisse 2 portions. Le planificateur les
// place dans un créneau ultérieur compatible, dans la limite de `recipe.conservationJours`. »
//
// §7.3 en donne la raison, et elle est produit avant d'être technique : moins de cuisine, moins de
// gaspillage, et un planning qui ressemble à la façon dont les gens cuisinent réellement.
//
// ⚠️ UN RESTE REMPLACE UN REPAS, IL N'EN AJOUTE PAS UN. `planWeek` a déjà rempli tous les créneaux ;
// placer un reste consiste donc à REMPLACER un plat prévu par le reste de la veille. C'est le sens
// de §7.3 — on ne cuisine pas tous les repas — et c'est ce qui fait gagner du temps. Un mécanisme
// qui n'aurait comblé que les créneaux vides n'aurait servi qu'aux plannings incomplets.
//
// ⚠️ LE LENDEMAIN AU PLUS TÔT, jamais le même jour. Manger le même plat midi et soir est un
// appauvrissement, pas une commodité — et `variety` ne peut pas l'empêcher, puisque le reste est
// placé APRÈS le scoring. La règle est donc portée ici, en dur.
//
// ⚠️ CRÉNEAU COMPATIBLE = la recette porte ce `MealSlot`. Un reste de dîner ne se sert pas au
// petit-déjeuner sous prétexte qu'il reste des portions.
//
// Un créneau VERROUILLÉ (`locked`) n'est jamais touché : §7.2 en fait le mécanisme qui rend le
// glouton acceptable — l'utilisateur fige ce qu'il veut. Un reste qui écraserait un choix figé
// retirerait la seule garantie qu'il a.
//
// Dépendances autorisées : domain/ uniquement — §2/§3 ENGINE.

import type { Catalog, MealPlanEntry, RecipeId, WeekPlan } from '../domain/index.js'

const MS_PER_DAY = 86_400_000

/** Écart en jours calendaires entre deux dates ISO. Jamais `Date.now()` (§3 ENGINE). */
function ecartJours(depuis: string, jusqua: string): number {
  return Math.round((Date.parse(`${jusqua}T00:00:00Z`) - Date.parse(`${depuis}T00:00:00Z`)) / MS_PER_DAY)
}

/**
 * Place les restes dans le plan et rend un NOUVEAU plan — l'entrée n'est jamais mutée.
 *
 * `convives` = nombre d'assiettes servies à chaque repas. Une recette de `portionsBase` portions
 * laisse `portionsBase − convives` portions, soit `⌊reste / convives⌋` repas supplémentaires.
 *
 * L'ordre de traitement suit les entrées du plan, donc la chronologie : un plat cuisiné lundi place
 * ses restes avant qu'un plat cuisiné mardi ne place les siens. Un créneau déjà transformé en reste
 * n'est plus candidat — on ne remplace pas un reste par un autre reste, ce qui reviendrait à jeter
 * le premier.
 */
export function planLeftovers(plan: WeekPlan, catalog: Catalog, convives = 1): WeekPlan {
  if (convives < 1) {
    throw new RangeError(`planLeftovers : ${convives} convive(s) — il en faut au moins 1.`)
  }

  const entries: MealPlanEntry[] = [...plan.entries]

  for (let source = 0; source < entries.length; source++) {
    const entree = entries[source]!
    if (entree.recipeId === null || entree.isLeftover) continue

    const recette = catalog.recipes.get(entree.recipeId)
    if (recette === undefined) continue

    const portionsRestantes = recette.portionsBase - convives
    // ⚠️ DÉDUIRE LES RESTES DÉJÀ PLACÉS, sinon la fonction n'est pas idempotente : un second appel
    // sur un plan déjà traité replacerait les mêmes portions une deuxième fois. `planWeek` interdit
    // le doublon de recette, donc les restes d'une recette ne peuvent venir que de son unique
    // cuisson — ce simple comptage suffit.
    const dejaPlaces = entries.filter((e) => e.isLeftover && e.recipeId === entree.recipeId).length
    let repasPlacables = Math.floor(portionsRestantes / convives) - dejaPlaces
    if (repasPlacables <= 0) continue

    for (let cible = source + 1; cible < entries.length && repasPlacables > 0; cible++) {
      const candidat = entries[cible]!
      if (candidat.locked || candidat.isLeftover) continue

      // Le lendemain au plus tôt, et dans la limite de conservation.
      const age = ecartJours(entree.slot.date, candidat.slot.date)
      if (age < 1) continue
      if (age > recette.conservationJours) break // les entrées suivent la chronologie : inutile d'aller plus loin

      if (!recette.typesRepas.includes(candidat.slot.creneau)) continue
      if (candidat.recipeId === entree.recipeId) continue // déjà ce plat, un reste n'apporterait rien

      entries[cible] = {
        ...candidat,
        recipeId: entree.recipeId,
        portions: convives,
        isLeftover: true,
      }
      repasPlacables--
    }
  }

  return { ...plan, entries }
}

/**
 * Combien de portions un plan gaspille — cuisinées, ni mangées sur le coup ni replacées en reste.
 *
 * Sert au banc et aux tests : c'est la mesure qui dit si le placement sert à quelque chose. Sans
 * elle, « les restes sont placés » ne veut rien dire — encore faut-il qu'il en reste moins.
 */
export function portionsGaspillees(plan: WeekPlan, catalog: Catalog, convives = 1): number {
  let total = 0
  for (const entree of plan.entries) {
    if (entree.recipeId === null || entree.isLeftover) continue
    const recette = catalog.recipes.get(entree.recipeId)
    if (recette === undefined) continue
    total += Math.max(0, recette.portionsBase - convives)
  }
  // Chaque créneau marqué `reste` consomme `convives` portions produites ailleurs.
  const consommees = plan.entries.filter((e) => e.isLeftover).length * convives
  return Math.max(0, total - consommees)
}
