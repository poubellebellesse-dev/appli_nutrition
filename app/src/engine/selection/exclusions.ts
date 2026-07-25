// engine/selection/exclusions.ts — couche d'exclusion `exclusions` (docs/ENGINE.md §6 ;
// docs/ARCHITECTURE.md §5.2)
//
// Non critique (§6.3 ENGINE — seules `allergenes` et `regime` sont 🔒) : c'est un rejet
// PERSONNEL, désactivable, à la différence des deux couches de sécurité. Exclut une recette dès
// que l'un de ses ingrédients NON-optionnels porte un aliment listé dans
// `HardConstraints.excludedFoodIds` — champ déclaré depuis P0 mais qu'aucune couche ne lisait
// avant celle-ci.
//
// Décision d'architecture (déjà validée par ailleurs, appliquée ici) : exclusion DURE (retire la
// recette du candidat set), pas un score pénalisé — cohérent avec §5.2 ARCHITECTURE (« jamais
// pondérées, jamais contournables »). Elle reste néanmoins `critical: false` : contrairement à un
// allergène ou un régime, un rejet personnel est un choix d'utilisateur, désactivable par
// construction du registre (§6.3 ENGINE), même si son EFFET quand actif n'est jamais une simple
// pondération.
//
// Décision prise ici, non tranchée explicitement par la spec (voir rapport final) : un ingrédient
// `optionnel: true` NE COMPTE PAS dans la dérivation — à l'INVERSE d'`allergenes` où la sécurité
// prime sur tout. Un aliment exclu qui n'apparaît qu'en ingrédient optionnel ne condamne pas la
// recette : elle reste servable sans lui, via les alternatives d'ingrédients optionnels (P1c).
// Seuls les ingrédients non-optionnels sont regardés pour décider du rejet.
//
// Dépendances autorisées : domain/, ./index.js (contrat local) — §2/§3 ENGINE.

import type { FoodId, Recipe, RecipeId, RejectionEntry } from '../domain/index.js'
import type { CandidateSet, ExclusionLayerResult, SelectionLayer } from './index.js'

/** Ids d'aliments des ingrédients NON-optionnels d'une recette (voir en-tête du fichier). */
function deriveNonOptionalFoodIds(recipe: Recipe): ReadonlySet<FoodId> {
  const foodIds = new Set<FoodId>()
  for (const ingredient of recipe.ingredients) {
    if (ingredient.optionnel) continue
    foodIds.add(ingredient.foodId)
  }
  return foodIds
}

/** Tous les aliments exclus retrouvés parmi les ingrédients non-optionnels d'une recette. */
function matchedExclusions(recipeFoodIds: ReadonlySet<FoodId>, excluded: ReadonlySet<FoodId>): FoodId[] {
  const hits: FoodId[] = []
  for (const foodId of excluded) {
    if (recipeFoodIds.has(foodId)) hits.push(foodId)
  }
  return hits
}

export interface FoodExclusionLayerConfig {
  readonly excluded: ReadonlySet<FoodId>
  /** Pré-calculé pour tout le catalogue au `configure` — `apply` reste sans accès à `Catalog`. */
  readonly recipeFoodIds: ReadonlyMap<RecipeId, ReadonlySet<FoodId>>
  /** Pour un motif de rejet lisible (nom plutôt que code) — vide si l'aliment est inconnu. */
  readonly foodNames: ReadonlyMap<FoodId, string>
}

export const personalExclusionLayer: SelectionLayer<FoodExclusionLayerConfig> = {
  id: 'exclusions',
  kind: 'exclusion',
  critical: false,
  defaultWeight: 0,

  configure: (req, catalog) => {
    const recipeFoodIds = new Map<RecipeId, ReadonlySet<FoodId>>()
    for (const recipe of catalog.recipes.values()) {
      recipeFoodIds.set(recipe.id, deriveNonOptionalFoodIds(recipe))
    }
    const foodNames = new Map<FoodId, string>()
    for (const food of catalog.foods.values()) foodNames.set(food.id, food.nom)

    return { excluded: new Set(req.constraints.excludedFoodIds), recipeFoodIds, foodNames }
  },

  apply: (candidates: CandidateSet, config: FoodExclusionLayerConfig): ExclusionLayerResult => {
    const kept = new Set<RecipeId>()
    const rejected: RejectionEntry[] = []

    for (const recipeId of candidates) {
      const recipeFoodIds = config.recipeFoodIds.get(recipeId) ?? new Set<FoodId>()
      const hits = matchedExclusions(recipeFoodIds, config.excluded)
      if (hits.length === 0) {
        kept.add(recipeId)
      } else {
        const names = hits.map((foodId) => config.foodNames.get(foodId) ?? foodId).join(', ')
        rejected.push({ recipeId, layerId: 'exclusions', reason: `contient un aliment exclu par l'utilisateur : ${names}` })
      }
    }

    return { kept, rejected }
  },
}
