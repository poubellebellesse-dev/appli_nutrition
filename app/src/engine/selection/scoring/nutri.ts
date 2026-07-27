// engine/selection/scoring/nutri.ts — couche de score `nutri` (docs/ENGINE.md §6.5 tableau,
// précision 1).
//
// 1 − distance normalisée entre l'apport de la recette et LA CIBLE — jamais la consommation
// (précision 1 : pas de journal alimentaire, la cible est l'accumulateur du plan ou la part du
// créneau dans la référence journalière, résolue en amont par engine/nutrition/). Cette fonction
// ne calcule QUE la distance ; résoudre la cible est hors de son périmètre.
//
// Pour chaque nutriment dont `target[i] > 0`, l'écart dépend du SENS de ce nutriment
// (`NutrientSense`, engine/domain/catalog.ts — voir ce type pour le POURQUOI : un écart
// symétrique punit un dépassement de fer exactement comme un manque, ce qui est absurde) :
//  - `cible`    → `|recipe[i] - target[i]| / target[i]`             (les deux côtés pénalisent)
//  - `plancher` → `max(0, target[i] - recipe[i]) / target[i]`       (seul le manque pénalise)
//  - `plafond`  → `max(0, recipe[i] - target[i]) / target[i]`       (seul le dépassement pénalise)
// Écart clampé à 1 (un dépassement de 300% ne pénalise pas plus qu'un dépassement de 100%). Score
// = 1 − moyenne des écarts retenus. Nutriment à cible nulle ou absente : IGNORÉ, jamais compté
// comme un écart parfait (ce qui gonflerait artificiellement le score) ni comme un écart maximal.
// Aucun nutriment exploitable → NEUTRAL_SCORE (rien à comparer, ni bonus ni malus).
//
// `senses` est aligné sur le même index que `recipePerPortion`/`target` (l'ordre de
// `Catalog.nutrients` fixe l'index, §9.1 ENGINE). S'il est plus court que les vecteurs (défensif,
// ne devrait pas arriver), les index manquants sont traités comme `cible` — comportement
// symétrique d'origine, aucune régression silencieuse.
//
// Vecteurs de longueurs différentes (ne devrait pas arriver si tous proviennent du même
// `Catalog.nutrients`, mais défensif) : itère sur la longueur commune.
//
// Dépendances autorisées : domain/, ./index.js, ../../nutrition/index.js — §2/§3 ENGINE (SEL a le
// droit de dépendre de NUT, voir en-tête de scoring/index.ts).

import type { MealSlot, NutrientSense, NutrientVector, RecipeId } from '../../domain/index.js'
import type { CandidateSet, ScoringLayerResult, SelectionLayer } from '../index.js'
import { NEUTRAL_SCORE, clamp01 } from './index.js'
import { resolveReferenceIntakes } from '../../nutrition/index.js'

function deviationFor(sens: NutrientSense, recipeValue: number, targetValue: number): number {
  const raw =
    sens === 'plancher'
      ? Math.max(0, targetValue - recipeValue) / targetValue
      : sens === 'plafond'
        ? Math.max(0, recipeValue - targetValue) / targetValue
        : Math.abs(recipeValue - targetValue) / targetValue

  return Math.min(raw, 1)
}

/**
 * Couverture minimale (part de la masse dont la valeur est connue) sous laquelle un nutriment
 * n'est PAS noté — décision 29, voir engine/nutrition/nutrient-coverage.ts pour le problème.
 *
 * ⚠️ SEUIL DE JUGEMENT, PAS DE MESURE — à la différence des seuils de `variety`, il n'existe pas de
 * jeu de cas jugés pour « ce nutriment est-il notable ». La valeur retenue sépare nettement les
 * situations observées sur le catalogue réel, qui se répartissent en dessous de 30 % d'inconnu ou
 * au-dessus de 39 %, sans rien entre les deux. Effet à 0,7 : 1 recette cesse d'être notée sur le
 * sodium, 13 sur la vitamine C, aucune sur le calcium ni le fer.
 */
export const NUTRI_MIN_COVERAGE = 0.7

export function scoreNutri(
  recipePerPortion: NutrientVector,
  target: NutrientVector,
  senses: readonly NutrientSense[],
  /**
   * Part connue par nutriment (`catalog.indexes.recipeNutrientCoverage`). ABSENT = couverture non
   * renseignée, donc aucune abstention : comportement d'avant la décision 29, conservé pour les
   * appels unitaires qui ne testent pas cette dimension. Ne pas confondre avec un vecteur de zéros,
   * qui lui signifie « on ne sait rien » et fait tout ignorer.
   */
  coverage?: NutrientVector
): number {
  const length = Math.min(recipePerPortion.length, target.length)

  let sumDeviation = 0
  let count = 0

  for (let i = 0; i < length; i++) {
    const targetValue = target[i]!
    if (targetValue <= 0) continue

    // S'ABSTENIR plutôt que noter un zéro inventé. Un trou de données compté 0 pénalise à tort sur
    // un `plancher` et récompense à tort sur un `plafond` : ne pas le compter du tout est la seule
    // position neutre. `count` se renormalise seul, donc le score reste comparable entre recettes.
    if (coverage !== undefined && (coverage[i] ?? 0) < NUTRI_MIN_COVERAGE) continue

    const recipeValue = recipePerPortion[i]!
    const sens = senses[i] ?? 'cible'
    sumDeviation += deviationFor(sens, recipeValue, targetValue)
    count++
  }

  if (count === 0) return NEUTRAL_SCORE

  return clamp01(1 - sumDeviation / count)
}

// ------------------------------------------------------------------------------------------
// Couche `nutri` (§6.2 ENGINE) — enveloppe `scoreNutri` dans le contrat `SelectionLayer`.
//
// `configure` résout la référence JOURNALIÈRE via `resolveReferenceIntakes(req.profile, catalog)`
// (engine/nutrition/), puis en dérive la cible du CRÉNEAU via une table fixe — part du créneau
// dans la journée, somme = 1 sur les quatre créneaux canoniques (`MealSlot`) : un petit-déjeuner
// et un dîner ne pèsent pas pareil, et cette table évite d'ajouter un champ à `SuggestionRequest`
// (précision 1, §6.5 ENGINE : « la part du créneau courant dans la référence journalière »).
//
// Le vecteur de la recette vient de `catalog.indexes.recipeNutrients` (déjà PAR PORTION, §6.5
// précision 8) ; les `sens` viennent de `catalog.nutrients`, dans le MÊME ORDRE (§9.1 ENGINE fixe
// l'index par la position dans `catalog.nutrients`, aligné avec `NutrientVector`).
//
// Recette absente de l'index — index vide tant qu'`attachDerivedIndexes` n'a pas tourné, ou id
// orphelin du catalogue — → `NEUTRAL_SCORE`, jamais 0 (§6.1 ENGINE, même règle que les autres
// couches de score).
// ------------------------------------------------------------------------------------------

/** Part du créneau dans la référence journalière (§6.5 précision 1 ENGINE) — table fixe. */
const MEAL_SLOT_SHARE: Readonly<Record<MealSlot, number>> = {
  petit_dejeuner: 0.25,
  dejeuner: 0.35,
  diner: 0.3,
  gouter: 0.1,
}

export interface NutriLayerConfig {
  readonly recipeNutrients: ReadonlyMap<RecipeId, NutrientVector>
  /** Part connue par nutriment — `catalog.indexes.recipeNutrientCoverage`, voir `NUTRI_MIN_COVERAGE`. */
  readonly recipeNutrientCoverage: ReadonlyMap<RecipeId, NutrientVector>
  readonly senses: readonly NutrientSense[]
  readonly target: NutrientVector
}

export const nutriLayer: SelectionLayer<NutriLayerConfig> = {
  id: 'nutri',
  kind: 'scoring',
  critical: false,
  defaultWeight: 0.25,

  configure: (req, catalog) => {
    const dailyReference = resolveReferenceIntakes(req.profile, catalog)
    const share = MEAL_SLOT_SHARE[req.context.creneau]

    const target = new Float64Array(dailyReference.length)
    for (let i = 0; i < dailyReference.length; i++) target[i] = dailyReference[i]! * share

    return {
      recipeNutrients: catalog.indexes.recipeNutrients,
      recipeNutrientCoverage: catalog.indexes.recipeNutrientCoverage,
      senses: catalog.nutrients.map((n) => n.sens),
      target,
    }
  },

  apply: (candidates: CandidateSet, config: NutriLayerConfig): ScoringLayerResult => {
    const scores = new Map<RecipeId, number>()
    for (const recipeId of candidates) {
      const recipeVector = config.recipeNutrients.get(recipeId)
      scores.set(
        recipeId,
        recipeVector
          ? scoreNutri(recipeVector, config.target, config.senses, config.recipeNutrientCoverage.get(recipeId))
          : NEUTRAL_SCORE
      )
    }
    return { scores }
  },
}
