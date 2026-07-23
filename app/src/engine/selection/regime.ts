// engine/selection/regime.ts — couche d'exclusion `regime` (docs/ENGINE.md §6 ;
// docs/ARCHITECTURE.md §5.2)
//
// 🔒 critical : indésactivable, jamais pondérée. Exclut une recette incompatible avec le régime
// déclaré par l'utilisateur (`HardConstraints.diet`), via la facette `regime` de la recette
// (`recipe_facet(facette = 'regime', valeur)` — docs/ARCHITECTURE.md §4.2).
//
// Règle de compatibilité retenue (imposée par la tâche P1a — modèle simple, documentée ici tel
// que demandé) : une recette expose sa/ses valeur(s) `regime` (0..n facettes `regime`, en
// pratique une seule dans le catalogue actuel). Elle est INCOMPATIBLE si le régime demandé ne
// figure PAS parmi ces valeurs — y compris quand la recette n'a AUCUNE facette `regime` du tout
// (ensemble vide : le régime demandé n'y "figure" jamais). Aucune hiérarchie n'est déduite (ex. :
// demander 'vegetarien' n'inclut PAS automatiquement les recettes 'vegan' si elles existaient un
// jour) — égalité stricte de chaîne, rien de plus.
//
// Si `constraints.diet` est `null` (aucun régime déclaré), la couche est INERTE : §5.2
// ARCHITECTURE ne filtre que sur une contrainte DÉCLARÉE, jamais déduite.
//
// Dépendances autorisées : domain/, ./index.js (contrat local) — §2/§3 ENGINE.

import type { DietCode, Recipe, RecipeId, RejectionEntry } from '../domain/index.js'
import type { ExclusionLayerResult, SelectionLayer } from './index.js'

function recipeDiets(recipe: Recipe): readonly DietCode[] {
  return recipe.facettes.filter((facette) => facette.facette === 'regime').map((facette) => facette.valeur)
}

export interface DietLayerConfig {
  readonly requestedDiet: DietCode | null
  readonly recipeDiets: ReadonlyMap<RecipeId, readonly DietCode[]>
}

export const dietLayer: SelectionLayer<DietLayerConfig> = {
  id: 'regime',
  kind: 'exclusion',
  critical: true,
  defaultWeight: 0,

  configure: (req, catalog) => {
    const recipeDietsMap = new Map<RecipeId, readonly DietCode[]>()
    for (const recipe of catalog.recipes.values()) recipeDietsMap.set(recipe.id, recipeDiets(recipe))

    return { requestedDiet: req.constraints.diet, recipeDiets: recipeDietsMap }
  },

  apply: (candidates, config): ExclusionLayerResult => {
    const kept = new Set<RecipeId>()
    const rejected: RejectionEntry[] = []

    if (config.requestedDiet === null) {
      for (const recipeId of candidates) kept.add(recipeId)
      return { kept, rejected }
    }

    const requestedDiet = config.requestedDiet
    for (const recipeId of candidates) {
      const diets = config.recipeDiets.get(recipeId) ?? []
      if (diets.includes(requestedDiet)) {
        kept.add(recipeId)
      } else {
        rejected.push({ recipeId, layerId: 'regime', reason: `incompatible avec le régime déclaré : ${requestedDiet}` })
      }
    }

    return { kept, rejected }
  },
}
