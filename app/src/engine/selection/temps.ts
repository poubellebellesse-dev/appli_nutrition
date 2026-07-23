// engine/selection/temps.ts — couche d'exclusion `temps` (docs/ENGINE.md §6 ;
// docs/ARCHITECTURE.md §5.2)
//
// Non critique (§6.3 ENGINE — seules `allergenes` et `regime` sont 🔒). Exclut une recette dont
// `temps_prep + temps_cuisson` dépasse le temps disponible du contexte de repas
// (`MealContext.tempsDisponibleMin`).
//
// Décision (non tranchée explicitement par la spec) : `tempsDisponibleMin === null` (aucun temps
// déclaré pour ce créneau) rend la couche INERTE — rien à comparer, donc rien n'est exclu. Le cas
// limite `temps requis === temps disponible` est CONSERVÉ (comparaison stricte `>`, telle
// qu'écrite en toutes lettres dans docs/ARCHITECTURE.md §5.2 : « temps de préparation > temps
// disponible »).
//
// Dépendances autorisées : domain/, ./index.js (contrat local) — §2/§3 ENGINE.

import type { RecipeId, RejectionEntry } from '../domain/index.js'
import type { ExclusionLayerResult, SelectionLayer } from './index.js'

export interface TimeLayerConfig {
  readonly availableMin: number | null
  readonly recipeTotalMin: ReadonlyMap<RecipeId, number>
}

export const timeLayer: SelectionLayer<TimeLayerConfig> = {
  id: 'temps',
  kind: 'exclusion',
  critical: false,
  defaultWeight: 0,

  configure: (req, catalog) => {
    const recipeTotalMin = new Map<RecipeId, number>()
    for (const recipe of catalog.recipes.values()) {
      recipeTotalMin.set(recipe.id, recipe.tempsPrepMin + recipe.tempsCuissonMin)
    }
    return { availableMin: req.context.tempsDisponibleMin, recipeTotalMin }
  },

  apply: (candidates, config): ExclusionLayerResult => {
    const kept = new Set<RecipeId>()
    const rejected: RejectionEntry[] = []

    if (config.availableMin === null) {
      for (const recipeId of candidates) kept.add(recipeId)
      return { kept, rejected }
    }

    const availableMin = config.availableMin
    for (const recipeId of candidates) {
      const totalMin = config.recipeTotalMin.get(recipeId) ?? 0
      if (totalMin > availableMin) {
        rejected.push({
          recipeId,
          layerId: 'temps',
          reason: `temps requis (${totalMin} min) supérieur au temps disponible (${availableMin} min)`,
        })
      } else {
        kept.add(recipeId)
      }
    }

    return { kept, rejected }
  },
}
