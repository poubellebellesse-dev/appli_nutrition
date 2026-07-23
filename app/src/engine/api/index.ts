// engine/api/ — L5 API publique (docs/ENGINE.md §8)
//
// Rôle : surface volontairement étroite. Tout le reste (selection/, planning/, nutrition/,
// guards/) est interne au module engine/ ; seul ce fichier est destiné à être importé par
// data/ (qui construit le Catalog) et par l'UI (features/, via une future façade hors engine).
//
// `createEngine` est un stub dans ce chunk : il ne fait que satisfaire la signature pour que
// les types compilent (ZÉRO logique — la construction réelle du moteur, l'assemblage du
// pipeline et du registre de couches, sont P1/P2).
//
// Dépendances autorisées : domain/, selection/, planning/, nutrition/, guards/ (§2 ENGINE — L5
// est au sommet de la pile engine/, elle peut connaître tout ce qui est en dessous d'elle).

import type {
  Catalog,
  FoodId,
  RecipeId,
  RerollOptions,
  ScaledRecipe,
  ShoppingList,
  ShoppingOptions,
  SlotRef,
  Substitution,
  SuggestionRequest,
  SuggestionResult,
  UserProfile,
  WeekPlan,
  WeekPlanRequest,
} from '../domain/index.js'
import type { LayerId } from '../domain/index.js'
import type { LayerDescriptor, SelectionLayer } from '../selection/index.js'
import type { NutritionReport } from '../nutrition/index.js'

export interface Engine {
  readonly version: string
  readonly catalogVersion: string

  suggestMeals(req: SuggestionRequest): SuggestionResult
  planWeek(req: WeekPlanRequest): WeekPlan
  rerollSlot(plan: WeekPlan, slot: SlotRef, opts?: RerollOptions): WeekPlan
  planLeftovers(plan: WeekPlan): WeekPlan
  buildShoppingList(plan: WeekPlan, opts?: ShoppingOptions): ShoppingList
  analyzeWeek(plan: WeekPlan, profile: UserProfile): NutritionReport
  scaleRecipe(id: RecipeId, portions: number): ScaledRecipe
  suggestSubstitutions(id: RecipeId, missing: readonly FoodId[]): readonly Substitution[]

  /** Accès individuel à une couche — permet des écrans autonomes sans pipeline complet (§6.8 ENGINE). */
  layer<C>(id: LayerId): SelectionLayer<C>
  /** id · nature · critique · poids effectif. */
  readonly layers: readonly LayerDescriptor[]
}

/**
 * Stub — satisfait la signature pour que les types compilent (§8 ENGINE). Assemblage réel du
 * moteur = P1/P2.
 */
export function createEngine(catalog: Catalog): Engine {
  throw new Error('not implemented (P1)')
}
