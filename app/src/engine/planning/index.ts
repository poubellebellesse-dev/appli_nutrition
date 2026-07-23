// engine/planning/ — L4 Planification (docs/ENGINE.md §7)
//
// Rôle : semaine à fenêtre glissante (2-14 jours), restes, liste de courses, anticipation sans
// IA (couche `habit`, §7.5 ENGINE — 4 statistiques locales, jamais un modèle appris). Les types
// de requête/réponse principaux (WeekPlanRequest, WeekPlan, ShoppingList…) vivent dans
// domain/ (§8.1 ENGINE) ; ce fichier ne pose que ce qui est propre à l'orchestration de cette
// couche : le profil d'habitude et les signatures des fonctions de §7.
//
// Zéro logique dans ce chunk : signatures seules, implémentation P1/P2.
//
// Dépendances autorisées : domain/, selection/, guards/ (§2 ENGINE : PLAN --> SEL, PLAN --> GUARD,
// PLAN --> DOM).

import type { Catalog, MealSlot, RecipeId, ShoppingList, ShoppingOptions, WeekPlan, WeekPlanRequest } from '../domain/index.js'

/**
 * Quatre statistiques locales, toutes explicables en une phrase — aucun apprentissage, aucun
 * modèle (§7.5 ENGINE). Démarrage à froid propre : sans historique, `habit` pèse 0 (§6.3 ENGINE).
 */
export interface HabitProfile {
  /** Fréquence par créneau × jour de semaine (0 = lundi … 6 = dimanche). */
  readonly weekdayAffinity: ReadonlyMap<string, number>
  /** Fréquence par mois (1-12). */
  readonly seasonalAffinity: ReadonlyMap<number, number>
  /** Ce qui revient dans les plats aimés. */
  readonly ingredientCooccurrence: ReadonlyMap<RecipeId, number>
  /** Cuisines et textures récentes, pondérées par récence. */
  readonly recentFacetWeight: ReadonlyMap<string, number>
}

/**
 * `user_signal` — ce que l'utilisateur a aimé ou voulu, JAMAIS ce qu'il a consommé (§6.5
 * ARCHITECTURE). Aucune quantité, aucune notion de repas manqué.
 */
export interface UserSignal {
  readonly recipeId: RecipeId
  readonly type: 'aime' | 'naime_pas' | 'envie'
  readonly creneau: MealSlot
  /** 0 = lundi … 6 = dimanche. */
  readonly jourSemaine: number
  /** 1-12. */
  readonly mois: number
  /** ISO yyyy-mm-dd. */
  readonly date: string
}

// --- Signatures (§7 ENGINE) — implémentation P1/P2 ---------------------------------------------

/** Glouton jour par jour, état nutritionnel cumulé réinjecté à chaque créneau (§7.1 ENGINE). */
export type PlanWeek = (catalog: Catalog, req: WeekPlanRequest) => WeekPlan

/** Place les portions restantes dans un créneau ultérieur compatible (§7.3 ENGINE). */
export type PlanLeftovers = (plan: WeekPlan, catalog: Catalog) => WeekPlan

/** Agrégation → conversion en unités d'achat → arrondi → regroupement par rayon (§7.4 ENGINE). */
export type BuildShoppingList = (plan: WeekPlan, catalog: Catalog, opts: ShoppingOptions) => ShoppingList

/** Compteurs pondérés sur `user_signal`, recalculés à la volée — jamais appris (§7.5 ENGINE). */
export type ComputeHabitProfile = (signals: readonly UserSignal[], catalog: Catalog) => HabitProfile
