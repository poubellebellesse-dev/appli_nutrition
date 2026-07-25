// engine/selection/scoring/speed.ts — couche de score `speed` (docs/ENGINE.md §6.5 note ¶,
// §6.3 bis).
//
// DISTINCT du filtre dur `temps` (../temps.ts, couche d'EXCLUSION qui écarte au-delà du temps
// disponible) : ici un signal doux qui préfère les recettes plus courtes DANS la fenêtre, sans
// jamais exclure personne. `total = tempsPrepMin + tempsCuissonMin`. Fenêtre > 0 : score =
// 1 − total/fenêtre, clampé (un dépassement de la fenêtre tombe à 0, jamais négatif — le filtre dur
// aurait de toute façon déjà exclu ces recettes en amont si `temps` est actif). Fenêtre `null` ou
// ≤ 0 → NEUTRAL_SCORE (rien à comparer, couche inerte).
//
// ⚠️ DÉCISION (session du 2026-07-25, tranchée) : `speed` EST une couche du registre à part
// entière — le rattachement laissé ouvert par la note ¶ de §6.5 ENGINE (« pas une 17ᵉ couche du
// registre ») est résolu, cette phrase est désormais FAUSSE et ne doit plus être répétée. Le
// registre passe de 16 à 17 entrées (6 exclusion + 11 score — voir `LAYER_DESCRIPTORS` dans
// selection/index.ts et `ScoringLayerId` dans domain/layer-ids.ts). Poids par défaut 0
// (`defaultWeight: 0`) — comme `habit`, une couche à poids nul par défaut n'est PAS exécutée par
// `runScoringPass` (scoring-pass.ts, règle 2) tant que rien ne la relève ; ici c'est l'archétype
// « Rapide » (selection/archetypes.ts, §6.3 bis) qui la relève, à 0.30 brut.
//
// Dépendances autorisées : domain/, ./index.js, ../index.js (le contrat `SelectionLayer` local à
// selection/) — §2/§3 ENGINE.

import type { Recipe, RecipeId } from '../../domain/index.js'
import type { CandidateSet, ScoringLayerResult, SelectionLayer } from '../index.js'
import { NEUTRAL_SCORE, clamp01 } from './index.js'

export function scoreSpeed(recipe: Recipe, fenetreMin: number | null): number {
  if (fenetreMin === null || fenetreMin <= 0) return NEUTRAL_SCORE

  const total = recipe.tempsPrepMin + recipe.tempsCuissonMin
  return clamp01(1 - total / fenetreMin)
}

// ------------------------------------------------------------------------------------------
// Couche `speed` (§6.2 ENGINE) — enveloppe `scoreSpeed` dans le contrat `SelectionLayer`. Même
// motif que les autres couches de score (nutri.ts, preference.ts, craving.ts, season.ts,
// variety.ts, habit.ts) : `configure` pré-calcule ce dont `apply` a besoin depuis `Catalog`/
// `SuggestionRequest`, `apply` reste sans accès au catalogue.
//
// `configure` lit la fenêtre depuis `req.context.tempsDisponibleMin` — peut être `null` (aucune
// contrainte de temps exprimée pour ce créneau), auquel cas `scoreSpeed` rend `NEUTRAL_SCORE` pour
// tout le monde (rien à comparer), jamais un score pénalisant.
//
// Candidat absent de `catalog.recipes` (id orphelin) → `NEUTRAL_SCORE`, même règle que les autres
// couches de score (§6.1 ENGINE).
// ------------------------------------------------------------------------------------------

export interface SpeedLayerConfig {
  readonly recipes: ReadonlyMap<RecipeId, Recipe>
  readonly fenetreMin: number | null
}

export const speedLayer: SelectionLayer<SpeedLayerConfig> = {
  id: 'speed',
  kind: 'scoring',
  critical: false,
  defaultWeight: 0,

  configure: (req, catalog) => ({
    recipes: catalog.recipes,
    fenetreMin: req.context.tempsDisponibleMin,
  }),

  apply: (candidates: CandidateSet, config: SpeedLayerConfig): ScoringLayerResult => {
    const scores = new Map<RecipeId, number>()
    for (const recipeId of candidates) {
      const recipe = config.recipes.get(recipeId)
      scores.set(recipeId, recipe ? scoreSpeed(recipe, config.fenetreMin) : NEUTRAL_SCORE)
    }
    return { scores }
  },
}
