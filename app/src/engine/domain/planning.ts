// engine/domain/planning.ts
//
// Types de planification (docs/ENGINE.md §7, §8.1 : WeekPlan, SlotRef) et de l'API publique qui
// en dépend (scaleRecipe, buildShoppingList — §8 ENGINE).

import type { FoodId, RecipeId, TopicId } from './ids.js'
import type { MealSlot, RecipeIngredient } from './catalog.js'
import type { UserProfile } from './profile.js'
import type { HardConstraints, MealHistory } from './request.js'
import type { ScoreWeights } from './result.js'

export interface SlotRef {
  /** ISO yyyy-mm-dd. */
  readonly date: string
  readonly creneau: MealSlot
}

/** Fenêtre glissante de 2 à 14 jours, à partir de n'importe quel jour (§7.1, §9 décision 9 ENGINE). */
export interface WeekPlanRequest {
  readonly profile: UserProfile
  readonly constraints: HardConstraints
  readonly startDate: string
  readonly days: number
  readonly slots: readonly MealSlot[]
  readonly history: MealHistory
  readonly activeTopics: readonly TopicId[]
  readonly weights?: Partial<ScoreWeights>
  readonly seed: number
}

export interface MealPlanEntry {
  readonly slot: SlotRef
  /** null = créneau vide. */
  readonly recipeId: RecipeId | null
  readonly portions: number
  /** Un créneau verrouillé est invisible pour toute replanification ultérieure (§7.2 ENGINE). */
  readonly locked: boolean
  /** Placement automatique d'un reste (§7.3 ENGINE). */
  readonly isLeftover: boolean
}

export interface WeekPlan {
  readonly id: string
  readonly startDate: string
  readonly days: number
  readonly seed: number
  readonly entries: readonly MealPlanEntry[]
}

export interface RerollOptions {
  readonly excludeRecipeIds?: readonly RecipeId[]
  readonly seed?: number
}

export interface ShoppingOptions {
  /** Scinde la liste : conservable d'un côté, frais à racheter en milieu de semaine (§7.4 ENGINE). */
  readonly joursDeCourses?: number
}

export interface ShoppingListItem {
  readonly foodId: FoodId
  readonly quantiteTotale: number
  readonly unite: string
  readonly rayon: string
}

export interface ShoppingList {
  readonly planId: string
  /** ISO — horloge injectée, jamais `Date.now()` dans engine/ (§3 ENGINE). */
  readonly generatedAt: string
  readonly items: readonly ShoppingListItem[]
}

export interface ScaledRecipe {
  readonly recipeId: RecipeId
  readonly portions: number
  readonly ingredients: readonly RecipeIngredient[]
}
