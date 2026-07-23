// engine/guards/ — L2 Garde-fous de sécurité (docs/ENGINE.md §5.2)
//
// Rôle : post-conditions exécutées sur la PROPRE SORTIE du moteur, pas des recommandations
// d'UI. Chaque assert* lève `EngineSafetyError` si la condition est violée, sinon ne retourne
// rien. Une `EngineSafetyError` n'est jamais rattrapée silencieusement par l'UI (§4.4 ENGINE) :
// le pipeline refuse de retourner un résultat non sûr plutôt que de dégrader.
//
// `assertNoDeclaredAllergen` est implémenté ici (P1a, §5.2 ARCHITECTURE — « ceinture de
// sécurité »). Les quatre autres restent des signatures seules (implémentation P2/P3), avec
// couverture visée à 100 % (§11 ENGINE).
//
// Dépendances autorisées : domain/ UNIQUEMENT (§2 ENGINE : GUARD --> DOM). Ni selection/ ni
// planning/ ne sont importés ici, alors même que ce sont elles qui appellent guards/ — c'est
// exactement l'inverse qui casserait le graphe de couches (§3 ENGINE).

import type {
  Catalog,
  Explanation,
  HardConstraints,
  PipelineTrace,
  RecipeId,
  UserProfile,
  WeekPlan,
} from '../domain/index.js'
import { EngineSafetyError } from '../domain/index.js'

// --- assertNoDeclaredAllergen (§5.2 ENGINE / ARCHITECTURE) — implémenté P1a --------------------
//
// ⚠️ Écart assumé par rapport à la signature littérale de la doc (docs/ENGINE.md §5.2 :
// `(result: SuggestionResult, c: HardConstraints) => void`) : au P1a, `SuggestionResult` n'existe
// pas encore comme valeur PRODUITE — aucun scoring n'est câblé (portée P1a = les 4 couches
// d'exclusion + la passe d'exclusion, voir engine/selection/exclusion-pass.ts). Ce garde-fou est
// donc branché directement sur la SORTIE DE LA PASSE D'EXCLUSION : l'ensemble des `RecipeId`
// conservés, plus `Catalog` (nécessaire pour re-dériver les allergènes).
//
// Le garde-fou NE RÉUTILISE PAS `AllergenLayerConfig` de engine/selection/allergenes.ts — il
// redérive les allergènes de chaque recette indépendamment, directement depuis `Catalog`. C'est
// le principe même d'une « ceinture de sécurité » (§5.2 ARCHITECTURE) : si elle empruntait le
// même calcul que la couche qu'elle vérifie, un bug de dérivation partagé passerait inaperçu.
//
// Quand `suggestMeals` sera câblé (P2), l'appelant extraira les `RecipeId` des
// `SuggestionResult.suggestions` et appellera ce même garde-fou — la signature n'aura pas à
// changer, seul l'appelant s'adapte.
export type AssertNoDeclaredAllergen = (
  candidates: ReadonlySet<RecipeId>,
  catalog: Catalog,
  constraints: HardConstraints
) => void

export const assertNoDeclaredAllergen: AssertNoDeclaredAllergen = (candidates, catalog, constraints) => {
  const declared = new Set(constraints.allergies)
  if (declared.size === 0) return // rien de déclaré → rien à vérifier

  for (const recipeId of candidates) {
    const recipe = catalog.recipes.get(recipeId)
    if (!recipe) continue

    for (const ingredient of recipe.ingredients) {
      const food = catalog.foods.get(ingredient.foodId)
      if (!food) continue

      for (const foodAllergen of food.allergenes) {
        if (declared.has(foodAllergen.allergenId)) {
          throw new EngineSafetyError(
            `assertNoDeclaredAllergen : la recette '${recipeId}' conservée contient l'allergène déclaré ` +
              `'${foodAllergen.allergenId}' (via l'aliment '${ingredient.foodId}') — §5.2 ARCHITECTURE`
          )
        }
      }
    }
  }
}

// --- Signatures restantes (§5.2 ENGINE) — implémentation P2/P3 ---------------------------------

/** Aucun jour < 1200 kcal (F) / 1500 kcal (H) sans avertissement explicite (§6.5 ARCHITECTURE). */
export type AssertCalorieFloor = (plan: WeekPlan, profile: UserProfile) => void

/** Les couches `critical: true` ont bien été exécutées (§6.3 ENGINE). */
export type AssertCriticalLayersRan = (trace: PipelineTrace) => void

/** Aucune couche `kind: 'scoring'` n'a réduit l'ensemble des candidats (§6.1, §6.3 ENGINE). */
export type AssertScoringLayersNeverExclude = (trace: PipelineTrace) => void

/** Aucune explication ne contient le lexique banni (§6.2 ARCHITECTURE). */
export type AssertNoTherapeuticClaim = (explanations: readonly Explanation[]) => void
