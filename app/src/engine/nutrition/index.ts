// engine/nutrition/ — L2 Nutrition (docs/ENGINE.md §5.1)
//
// Rôle : besoins énergétiques (Mifflin-St Jeor + activité), apports de référence, agrégation
// nutritionnelle d'une recette, mise à l'échelle des portions, écart apport/cible. Fonctions
// PURES, sans état. `aggregateRecipe` n'est jamais appelée au runtime : les vecteurs sont
// pré-calculés au build et livrés dans `catalog.db` (§5.1 ENGINE) — la fonction reste ici parce
// que c'est elle que le script de build utilisera, et parce qu'elle est testable isolément.
//
// Zéro logique dans ce chunk : seules les signatures et les types de retour sont posés, pour que
// l'implémentation P1 s'écrive contre un contrat déjà figé.
//
// Dépendances autorisées : domain/ uniquement (§2 ENGINE : NUT --> DOM).

import type { Catalog, Kcal, NutrientVector, Recipe, ScaledRecipe, UserProfile } from '../domain/index.js'

/** Écart entre les apports cumulés et la cible restante sur la période (§5.1 ENGINE). */
export interface NutrientGap {
  readonly target: NutrientVector
  readonly consumed: NutrientVector
  /** target - consumed — jamais présenté comme un budget à tenir (§6.5 ARCHITECTURE). */
  readonly remaining: NutrientVector
}

/**
 * Bilan qualitatif d'une période (§10.2 point ⑧ ENGINE) : « beaucoup de légumes verts, peu de
 * poisson », jamais un compteur de calories ni une note globale (principe 6 ARCHITECTURE).
 */
export interface NutritionReport {
  readonly periodDays: number
  readonly averageDailyIntake: NutrientVector
  readonly referenceIntake: NutrientVector
  readonly highlights: readonly string[]
}

// --- Signatures (§5.1 ENGINE) — implémentation P1 ---------------------------------------------

export type ComputeEnergyNeeds = (profile: UserProfile) => Kcal

export type ResolveReferenceIntakes = (profile: UserProfile, catalog: Catalog) => NutrientVector

export type AggregateRecipe = (recipe: Recipe, catalog: Catalog) => NutrientVector

export type ScaleRecipe = (recipe: Recipe, portions: number) => ScaledRecipe

export type ComputeGap = (consumed: NutrientVector, target: NutrientVector) => NutrientGap
