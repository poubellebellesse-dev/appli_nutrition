// engine/selection/scoring/habit.ts — couche de score `habit`, VERSION MINIMALE (docs/ENGINE.md
// §7.5, §6.5 précision 5).
//
// §7.5 décrit QUATRE signaux (affinité jour de semaine, affinité saisonnière, co-occurrence
// d'ingrédients, facettes pondérées par récence). Ce lot n'en livre volontairement qu'UN, assumé
// comme tel : l'AFFINITÉ APPRISE = fréquence normalisée de la recette et de son ingrédient
// principal sur la fenêtre `MealHistory` fournie. Les 3 autres signaux (jour de semaine, saison,
// co-occurrence d'ingrédients / facettes récentes) restent P1b-2/P1c — non implémentés ici.
//
// Retour ∈ [0, 1], destiné à alimenter le `familiarity` de scoreVariety (précision 5 : `habit`
// module `variety`) — le câblage entre les deux est P1b-2, pas ce lot.
//
// ⚠️ Rappel invariant §6.5 ARCHITECTURE, repris de §7.5 ENGINE : `habit` est une AFFINITÉ APPRISE,
// JAMAIS un constat de consommation. Cette fonction ne doit jamais être présentée comme un journal
// alimentaire (« vu 3 fois cette semaine ») — seulement comme un signal d'affinité relative,
// consommé en interne par le scoring, pas affiché tel quel comme un compteur.
//
// Historique vide (aucune entrée valide) → NEUTRAL_SCORE : démarrage à froid propre, aucun biais
// avant d'avoir observé quoi que ce soit (§7.5 point 1 : « sans historique, le poids vaut 0 »,
// transposé ici en signal neutre plutôt qu'en signal nul punitif, cohérent avec le reste du lot).
//
// Dépendances autorisées : domain/, ./index.js — §2/§3 ENGINE.

import type { FoodId, MealHistory, RecipeId } from '../../domain/index.js'
import { NEUTRAL_SCORE, clamp01 } from './index.js'

export interface ScoreHabitArgs {
  readonly recipeId: RecipeId
  readonly mainIngredientId: FoodId | null
  readonly history: MealHistory
  /** ISO yyyy-mm-dd — horloge injectée (§3 ENGINE). */
  readonly today: string
  /** Résout l'ingrédient principal des entrées d'historique — voir variety.ts, même motif. */
  readonly mainIngredientByRecipe?: ReadonlyMap<RecipeId, FoodId>
}

export function scoreHabit(args: ScoreHabitArgs): number {
  const validEntries = args.history.entries.filter((entry) => entry.date <= args.today)
  if (validEntries.length === 0) return NEUTRAL_SCORE

  let matchCount = 0
  for (const historyEntry of validEntries) {
    const matchesRecipe = historyEntry.recipeId === args.recipeId
    const matchesMainIngredient =
      args.mainIngredientId !== null &&
      args.mainIngredientByRecipe?.get(historyEntry.recipeId) === args.mainIngredientId

    if (matchesRecipe || matchesMainIngredient) matchCount++
  }

  return clamp01(matchCount / validEntries.length)
}
