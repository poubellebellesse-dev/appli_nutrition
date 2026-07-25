// engine/selection/requis.ts — couche d'exclusion `requis` (docs/ENGINE.md §6.5 ter ;
// docs/ARCHITECTURE.md §5.2)
//
// Miroir dur d'`exclusions.ts` (« je veux ça » plutôt que « je ne veux pas ça »). Non critique
// (§6.3 ENGINE — seules `allergenes` et `regime` sont 🔒) : c'est un filtre PERSONNEL,
// désactivable, à la différence des deux couches de sécurité.
//
// Lit `MealContext.requiredFoodIds`, PAS `HardConstraints` — à la différence d'`excludedFoodIds`.
// Décision §6.5 ter ENGINE, appliquée telle quelle (voir domain/request.ts pour le commentaire
// complet sur le champ) : un filtre dur en contexte *Aujourd'hui* seulement. Exiger un aliment
// précis vide vite le panier de recettes ; ce serait dangereux en réglage permanent
// (`HardConstraints` s'applique aussi à `WeekPlanRequest`, qui n'a pas de `MealContext`).
//
// Sémantique CONJONCTIVE (à l'inverse d'`exclusions`, qui est disjonctive — un seul aliment exclu
// suffit à rejeter) : une recette est conservée seulement si elle contient TOUS les aliments
// demandés. Ensemble vide → couche inerte, tout est conservé.
//
// Décision prise ici, miroir exact de la règle d'`exclusions` (voir son en-tête) : un ingrédient
// `optionnel: true` SATISFAIT l'exigence — à l'inverse d'`exclusions` où seuls les ingrédients
// non-optionnels comptent pour REJETER. La raison est la même dans les deux sens : l'optionnel est
// modulable, ET un optionnel fait partie du plat servi par défaut (décision P1b-1, voir
// engine/nutrition/aggregation.ts) — il compte donc aussi bien pour un rejet potentiel
// (`exclusions`, ingrédients non-optionnels seulement) que pour une satisfaction (`requis`, tous
// les ingrédients, optionnels inclus).
//
// Dépendances autorisées : domain/, ./index.js (contrat local) — §2/§3 ENGINE.

import type { FoodId, Recipe, RecipeId, RejectionEntry } from '../domain/index.js'
import type { CandidateSet, ExclusionLayerResult, SelectionLayer } from './index.js'

/** Ids d'aliments de TOUS les ingrédients d'une recette, optionnels inclus (voir en-tête). */
function deriveAllFoodIds(recipe: Recipe): ReadonlySet<FoodId> {
  const foodIds = new Set<FoodId>()
  for (const ingredient of recipe.ingredients) {
    foodIds.add(ingredient.foodId)
  }
  return foodIds
}

/** Aliments requis qui manquent parmi les ingrédients (optionnels inclus) d'une recette. */
function missingRequirements(recipeFoodIds: ReadonlySet<FoodId>, required: ReadonlySet<FoodId>): FoodId[] {
  const missing: FoodId[] = []
  for (const foodId of required) {
    if (!recipeFoodIds.has(foodId)) missing.push(foodId)
  }
  return missing
}

export interface RequiredFoodLayerConfig {
  readonly required: ReadonlySet<FoodId>
  /** Pré-calculé pour tout le catalogue au `configure` — `apply` reste sans accès à `Catalog`. */
  readonly recipeFoodIds: ReadonlyMap<RecipeId, ReadonlySet<FoodId>>
  /** Pour un motif de rejet lisible (nom plutôt que code) — vide si l'aliment est inconnu. */
  readonly foodNames: ReadonlyMap<FoodId, string>
}

export const requiredFoodLayer: SelectionLayer<RequiredFoodLayerConfig> = {
  id: 'requis',
  kind: 'exclusion',
  critical: false,
  defaultWeight: 0,

  configure: (req, catalog) => {
    const recipeFoodIds = new Map<RecipeId, ReadonlySet<FoodId>>()
    for (const recipe of catalog.recipes.values()) {
      recipeFoodIds.set(recipe.id, deriveAllFoodIds(recipe))
    }
    const foodNames = new Map<FoodId, string>()
    for (const food of catalog.foods.values()) foodNames.set(food.id, food.nom)

    return { required: new Set(req.context.requiredFoodIds), recipeFoodIds, foodNames }
  },

  apply: (candidates: CandidateSet, config: RequiredFoodLayerConfig): ExclusionLayerResult => {
    const kept = new Set<RecipeId>()
    const rejected: RejectionEntry[] = []

    for (const recipeId of candidates) {
      const recipeFoodIds = config.recipeFoodIds.get(recipeId) ?? new Set<FoodId>()
      const missing = missingRequirements(recipeFoodIds, config.required)
      if (missing.length === 0) {
        kept.add(recipeId)
      } else {
        const names = missing.map((foodId) => config.foodNames.get(foodId) ?? foodId).join(', ')
        rejected.push({ recipeId, layerId: 'requis', reason: `ne contient pas : ${names}` })
      }
    }

    return { kept, rejected }
  },
}
