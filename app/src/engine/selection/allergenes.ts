// engine/selection/allergenes.ts — couche d'exclusion `allergenes` (docs/ENGINE.md §6 ;
// docs/ARCHITECTURE.md §5.2)
//
// 🔒 critical : indésactivable, jamais pondérée (§5.2 ARCHITECTURE — « ce filtre n'est jamais
// pondéré ni contournable »). Exclut une recette dès que l'un de ses ingrédients porte un
// allergène déclaré par l'utilisateur (`HardConstraints.allergies`).
//
// Dérivation (imposée par la tâche P1a) : les allergènes d'une recette ne sont PAS stockés tels
// quels — ils se DÉRIVENT de `food.allergenes` de chacun de ses ingrédients, par union. Aucune
// table `recipe_allergen` dédiée n'existe (cohérent avec `CatalogIndexes.recipesByAllergen`,
// déjà construit sur ce même principe par data/catalog-loader.ts).
//
// Deux décisions prises ici, non tranchées explicitement par la spec (voir rapport final) :
//   1. Un ingrédient `optionnel: true` compte quand même dans la dérivation. La sécurité prime,
//      et c'est cohérent avec `CatalogIndexes.recipesByAllergen` qui ne distingue pas non plus
//      les ingrédients optionnels.
//   2. `certitude: 'traces'` exclut au même titre que `'contient'`. Une allergie sévère réagit
//      aussi à des traces ; §5.2 ARCHITECTURE est explicite sur le fait que ce filtre n'est
//      jamais pondéré — il n'y a donc pas de place pour une gradation de sévérité ici.
//
// Dépendances autorisées : domain/, ./index.js (contrat local) — §2/§3 ENGINE.

import type { AllergenId, Catalog, Recipe, RecipeId, RejectionEntry } from '../domain/index.js'
import type { CandidateSet, ExclusionLayerResult, SelectionLayer } from './index.js'

/** Union des allergènes des aliments d'une recette, via ses ingrédients (§5.2 ARCHITECTURE). */
function deriveRecipeAllergens(recipe: Recipe, catalog: Catalog): ReadonlySet<AllergenId> {
  const allergens = new Set<AllergenId>()
  for (const ingredient of recipe.ingredients) {
    const food = catalog.foods.get(ingredient.foodId)
    if (!food) continue
    for (const foodAllergen of food.allergenes) allergens.add(foodAllergen.allergenId)
  }
  return allergens
}

/** Premier allergène en commun entre les deux ensembles, ou `undefined` si aucun. */
function firstDeclaredHit(recipeAllergens: ReadonlySet<AllergenId>, declared: ReadonlySet<AllergenId>): AllergenId | undefined {
  for (const allergenId of declared) {
    if (recipeAllergens.has(allergenId)) return allergenId
  }
  return undefined
}

export interface AllergenLayerConfig {
  readonly declared: ReadonlySet<AllergenId>
  /** Pré-calculé pour tout le catalogue au `configure` — `apply` reste sans accès à `Catalog`. */
  readonly recipeAllergens: ReadonlyMap<RecipeId, ReadonlySet<AllergenId>>
  /** Pour un motif de rejet lisible (nom plutôt que code) — vide si l'allergène est inconnu. */
  readonly allergenNames: ReadonlyMap<AllergenId, string>
}

export const allergenLayer: SelectionLayer<AllergenLayerConfig> = {
  id: 'allergenes',
  kind: 'exclusion',
  critical: true,
  defaultWeight: 0,

  configure: (req, catalog) => {
    const recipeAllergens = new Map<RecipeId, ReadonlySet<AllergenId>>()
    for (const recipe of catalog.recipes.values()) {
      recipeAllergens.set(recipe.id, deriveRecipeAllergens(recipe, catalog))
    }
    const allergenNames = new Map<AllergenId, string>()
    for (const allergen of catalog.allergens.values()) allergenNames.set(allergen.id, allergen.nom)

    return { declared: new Set(req.constraints.allergies), recipeAllergens, allergenNames }
  },

  apply: (candidates: CandidateSet, config: AllergenLayerConfig): ExclusionLayerResult => {
    const kept = new Set<RecipeId>()
    const rejected: RejectionEntry[] = []

    for (const recipeId of candidates) {
      const recipeAllergens = config.recipeAllergens.get(recipeId) ?? new Set<AllergenId>()
      const hit = firstDeclaredHit(recipeAllergens, config.declared)
      if (hit === undefined) {
        kept.add(recipeId)
      } else {
        const name = config.allergenNames.get(hit) ?? hit
        rejected.push({ recipeId, layerId: 'allergenes', reason: `contient l'allergène déclaré : ${name}` })
      }
    }

    return { kept, rejected }
  },
}
