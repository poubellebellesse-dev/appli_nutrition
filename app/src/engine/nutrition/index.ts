// engine/nutrition/ — L2 Nutrition (docs/ENGINE.md §5.1)
//
// Rôle : besoins énergétiques (Mifflin-St Jeor + activité), apports de référence, agrégation
// nutritionnelle d'une recette, mise à l'échelle des portions, écart apport/cible. Fonctions
// PURES, sans état.
//
// Correction (P1b-1, §6.5 précision 8) : les deux affirmations qui vivaient ici auparavant sont
// PÉRIMÉES. `aggregateRecipe` EST appelée au runtime — une fois, à `createEngine(catalog)`, via
// `attachDerivedIndexes` (voir derived-indexes.ts) — jamais par `catalog/build.mjs`, pour ne pas
// coupler le script de build au moteur ; ce n'est donc plus « zéro logique » dans ce chunk.
// `computeRecipeNutrients` et `computeRecipeMainIngredient` peuplent
// `CatalogIndexes.recipeNutrients` / `recipeMainIngredient` (jusqu'ici des `Map` vides posées par
// `data/catalog-loader.ts`) ; `attachDerivedIndexes` assemble le tout dans un nouveau `Catalog`
// immuable — c'est cette fonction que `createEngine` appellera en P1b-2 (non câblé ici).
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

/**
 * `Kcal | null` — jamais un gabarit corporel deviné : `null` quand `tailleCm`/`poidsKg` sont
 * inconnus (voir energy-needs.ts pour le détail des règles, P1b-2).
 */
export type ComputeEnergyNeeds = (profile: UserProfile) => Kcal | null

export type ResolveReferenceIntakes = (profile: UserProfile, catalog: Catalog) => NutrientVector

// --- Besoin énergétique & apports de référence — implémentation P1b-2 (§5.1 ENGINE) -----------

export { computeEnergyNeeds } from './energy-needs.js'
export { resolveReferenceIntakes } from './reference-intakes.js'

export type AggregateRecipe = (recipe: Recipe, catalog: Catalog) => NutrientVector

export type ScaleRecipe = (recipe: Recipe, portions: number) => ScaledRecipe

export type ComputeGap = (consumed: NutrientVector, target: NutrientVector) => NutrientGap

// --- Index dérivés du catalogue — implémentation P1b-1 (§6.5 précision 8) ---------------------
// Réexportés ici pour offrir une surface unique `engine/nutrition`, à l'identique de la
// convention `engine/selection` (voir selection/index.ts).

export { aggregateRecipe } from './aggregation.js'
export { computeRecipeNutrients } from './recipe-nutrients.js'
export { computeRecipeMainIngredient } from './main-ingredient.js'
export { attachDerivedIndexes } from './derived-indexes.js'
