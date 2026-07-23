// engine/domain/request.ts
//
// Requête de suggestion (docs/ENGINE.md §8.1).

import type { AllergenId, FoodId, RecipeId, TopicId } from './ids.js'
import type { DietCode, MealSlot } from './catalog.js'
import type { Minutes } from './units.js'
import type { UserProfile } from './profile.js'
import type { ScoreWeights } from './result.js'

/** §8.1 : « allergies · régime · exclusions ». Jamais pondérées, jamais contournables (§5.2 ARCHI). */
export interface HardConstraints {
  readonly allergies: readonly AllergenId[]
  readonly diet: DietCode | null
  readonly excludedFoodIds: readonly FoodId[]
}

/** Envies exprimées sur les axes sensoriels (pastilles Léger/Chaud/Salé…, §6.5 ENGINE). */
export interface CravingAxes {
  readonly sucreSale: number | null
  readonly legerConsistant: number | null
  readonly chaudFroid: number | null
}

export interface MealContext {
  readonly creneau: MealSlot
  /** ISO yyyy-mm-dd — horloge injectée, jamais `Date.now()` dans engine/ (§3 ENGINE). */
  readonly date: string
  readonly tempsDisponibleMin: Minutes | null
  readonly envie: CravingAxes | null
  /** Mode « vider le frigo » (§10.2 ENGINE). */
  readonly pantryFoodIds: readonly FoodId[]
}

export interface MealHistoryEntry {
  readonly recipeId: RecipeId
  readonly date: string
  readonly creneau: MealSlot
}

/** N derniers jours, pour la couche `variety` — fenêtre de 21 jours glissants par défaut (§13 ENGINE). */
export interface MealHistory {
  readonly windowDays: number
  readonly entries: readonly MealHistoryEntry[]
}

export interface SuggestionRequest {
  readonly profile: UserProfile
  readonly constraints: HardConstraints
  readonly context: MealContext
  readonly history: MealHistory
  /** [] par défaut — tant qu'aucune thématique n'est active, `topic` reste à poids nul. */
  readonly activeTopics: readonly TopicId[]
  readonly weights?: Partial<ScoreWeights>
  /** défaut 5. */
  readonly limit?: number
  /** reproductibilité — PRNG à graine explicite, jamais `Math.random()` (§1 ENGINE). */
  readonly seed: number
}
