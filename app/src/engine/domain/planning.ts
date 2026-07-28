// engine/domain/planning.ts
//
// Types de planification (docs/ENGINE.md §7, §8.1 : WeekPlan, SlotRef) et de l'API publique qui
// en dépend (scaleRecipe, buildShoppingList — §8 ENGINE).

import type { FoodId, RecipeId, TopicId } from './ids.js'
import type { CourseKind, MealSlot, RecipeIngredient } from './catalog.js'
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
  /**
   * Nombre de personnes à table, pour le calcul des RESTES (§7.3). Défaut 1.
   *
   * ⚠️ À NE PAS CONFONDRE avec `UserProfile.facteurPortion` (0,7…1,5), qui est un APPÉTIT
   * personnel — « je mange un peu plus / un peu moins » — et s'applique à une portion. `convives`
   * compte des assiettes.
   *
   * Sans ce champ, `planLeftovers` ne peut rien calculer : une recette de 4 portions ne laisse un
   * reste que si l'on sait combien en sont mangées sur le coup.
   */
  readonly convives?: number
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
  /**
   * `null` = mode recette (un plat unique, comportement actuel). Non-`null` = mode repas — ce
   * créneau contient plusieurs `MealPlanEntry`, une par service (§2.1 CONCEPTION_B_VIN_REPAS).
   */
  readonly service: CourseKind | null
}

/**
 * Avertissement porté par un plan — §6.5 ARCHITECTURE, « sans écran d'avertissement explicite ».
 *
 * ⚠️ CE N'EST PAS UNE ERREUR. Le plan est rendu quand même : un avertissement PRÉVIENT, il
 * n'interdit pas. C'est la différence avec `EngineSafetyError`, que lèvent les quatre autres
 * garde-fous (allergène déclaré, claim thérapeutique…) et qui, elle, annule la sortie.
 */
export interface PlanWarning {
  readonly kind: 'plancher_calorique'
  /** ISO yyyy-mm-dd du jour concerné. */
  readonly date: string
  readonly kcal: number
  readonly seuil: number
}

export interface WeekPlan {
  readonly id: string
  readonly startDate: string
  readonly days: number
  readonly seed: number
  readonly entries: readonly MealPlanEntry[]
  /**
   * Vide = rien à signaler. Non vide = le plan est utilisable MAIS l'appelant doit afficher
   * l'écran d'avertissement de §6.5 ARCHITECTURE avant de le présenter comme tel.
   */
  readonly warnings: readonly PlanWarning[]
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
  /**
   * Rayon de MAGASIN, dérivé de `Food.groupe` mais distinct de lui (§7.4 ENGINE) : « matières
   * grasses » réunit le beurre et l'huile d'olive, qui ne sont pas au même endroit.
   */
  readonly rayon: string
  /**
   * Virée de courses : 0 pour la première, 1 pour la suivante… Résulte de
   * `ShoppingOptions.joursDeCourses` (§7.4 : « ce qui se conserve d'un côté, le frais à racheter en
   * milieu de semaine de l'autre »). Toujours 0 quand l'option est absente.
   */
  readonly tranche: number
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
