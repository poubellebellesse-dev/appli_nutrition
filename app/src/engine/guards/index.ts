// engine/guards/ — L2 Garde-fous de sécurité (docs/ENGINE.md §5.2)
//
// Rôle : post-conditions exécutées sur la PROPRE SORTIE du moteur, pas des recommandations
// d'UI. Chaque assert* lève `EngineSafetyError` si la condition est violée, sinon ne retourne
// rien. Une `EngineSafetyError` n'est jamais rattrapée silencieusement par l'UI (§4.4 ENGINE) :
// le pipeline refuse de retourner un résultat non sûr plutôt que de dégrader.
//
// `assertNoDeclaredAllergen` (P1a, §5.2 ARCHITECTURE — « ceinture de sécurité »),
// `assertScoringLayersNeverExclude` (P1b-3, §6.1/§6.3 ENGINE), `assertNoTherapeuticClaim` (§6.7
// ENGINE — premier consommateur réel : selection/explain.ts) et `assertCriticalLayersRan` (P1c,
// §6.3 ENGINE — premier consommateur réel : engine/api/index.ts `suggestMeals`) sont implémentés
// ici. `assertCalorieFloor` reste une signature seule (implémentation P2/P3, `planWeek` non câblé),
// avec couverture visée à 100 % (§11 ENGINE).
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
import { findBannedTerms } from './banned-terms.js'

// --- assertNoDeclaredAllergen (§5.2 ENGINE / ARCHITECTURE) — implémenté P1a --------------------
//
// ⚠️ Écart assumé par rapport à la signature littérale de la doc (docs/ENGINE.md §5.2 :
// `(result: SuggestionResult, c: HardConstraints) => void`) : au P1a, `SuggestionResult` n'existe
// pas encore comme valeur PRODUITE — aucun scoring n'est câblé (portée P1a = les 5 couches
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

// --- assertCriticalLayersRan (§6.3 ENGINE) — implémenté P1c -----------------------------------
//
// Vérifie qu'AUCUNE couche `critical: true` n'a été absente de l'exécution réelle du pipeline
// (`trace.layersRun`) — l'invariant §6.3 « `critical: true` est indésactivable » resterait une
// intention si rien ne le vérifiait sur la trace RÉELLE plutôt que sur la déclaration du registre.
// Comme les autres garde-fous : ne fait pas confiance à une conclusion déjà tirée par l'appelant,
// compare lui-même `criticalLayerIds` (le sous-ensemble attendu, figé) à `layersRun` (ce qui a
// RÉELLEMENT tourné, construit par `suggestMeals`).
export type AssertCriticalLayersRan = (trace: PipelineTrace) => void

export const assertCriticalLayersRan: AssertCriticalLayersRan = (trace) => {
  for (const criticalId of trace.criticalLayerIds) {
    if (!trace.layersRun.includes(criticalId)) {
      throw new EngineSafetyError(
        `assertCriticalLayersRan : la couche critique '${criticalId}' n'a pas été exécutée — ` +
          `§6.3 ENGINE : « critical: true est indésactivable, par aucun réglage »`
      )
    }
  }
}

// --- assertScoringLayersNeverExclude (§6.1, §6.3 ENGINE) — implémenté P1b-3 --------------------
//
// Vérifie qu'AUCUNE couche `kind: 'scoring'` n'a réduit l'ensemble des candidats : le nombre de
// scores rendus par chaque couche exécutée (`trace.scoringLayerCounts`) doit être EXACTEMENT le
// nombre de candidats soumis à la passe de score (`trace.scoringCandidateCount`) — ni moins (une
// couche qui a omis un candidat), ni plus (une couche qui en a halluciné un).
//
// Comme `assertNoDeclaredAllergen` : ce garde-fou ne fait pas confiance au calcul qu'il vérifie. Il
// ne relit pas un verdict que `runScoringPass` lui aurait annoncé (un booléen « tout va bien ») —
// il recalcule lui-même la comparaison à partir des deux comptes bruts de la trace
// (`ScoringLayerResult.scores.size` réel par couche vs. `candidates.size` réel de la passe),
// jamais à partir d'une conclusion déjà tirée par l'appelant.
export type AssertScoringLayersNeverExclude = (trace: PipelineTrace) => void

export const assertScoringLayersNeverExclude: AssertScoringLayersNeverExclude = (trace) => {
  for (const [layerId, renderedCount] of trace.scoringLayerCounts) {
    if (renderedCount !== trace.scoringCandidateCount) {
      throw new EngineSafetyError(
        `assertScoringLayersNeverExclude : la couche de score '${layerId}' a rendu ${renderedCount} ` +
          `score(s) pour ${trace.scoringCandidateCount} candidat(s) soumis à la passe de score — ` +
          `une couche de score ne doit jamais réduire (ni élargir) l'ensemble des candidats (§6.1/§6.3 ENGINE)`
      )
    }
  }
}

// --- assertNoTherapeuticClaim (§6.2 ARCHITECTURE, §6.7 ENGINE) — implémenté ici -----------------
//
// Premier consommateur réel : `selection/explain.ts` (§6.7 ENGINE), qui produit les `Explanation`
// affichées à l'utilisateur. Vérifie que `label` (seul champ affiché en texte libre — `criterion`
// est un id fermé, `authority`/`evidenceSheetId` sont hors périmètre de ce lot, réservés à la
// couche `topic` non implémentée) ne contient aucun terme du lexique banni.
//
// Lexique dupliqué depuis `catalog/build.mjs` — voir guards/banned-terms.ts pour le détail du
// problème de source unique et sa garantie (tests/banned-terms-consistency.test.mjs).
export type AssertNoTherapeuticClaim = (explanations: readonly Explanation[]) => void

export const assertNoTherapeuticClaim: AssertNoTherapeuticClaim = (explanations) => {
  for (const explanation of explanations) {
    const hits = findBannedTerms(explanation.label)
    if (hits.length > 0) {
      throw new EngineSafetyError(
        `assertNoTherapeuticClaim : le label de l'explication du critère '${explanation.criterion}' contient ` +
          `le(s) terme(s) banni(s) (${hits.join(', ')}) — §6.2 ARCHITECTURE : "${explanation.label}"`
      )
    }
  }
}
