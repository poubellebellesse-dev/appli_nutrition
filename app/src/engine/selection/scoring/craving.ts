// engine/selection/scoring/craving.ts — couche de score `craving` (docs/ENGINE.md §6.5
// précision 2).
//
// Distance sur les SEULS axes sensoriels effectivement demandés dans `envie` (champs non `null` de
// `CravingAxes` — jamais les 3 systématiquement, précision 2). Axes dans [−1, +1] : distance
// euclidienne sur les k axes demandés, normalisée par 2·√k (l'écart max par axe est 2, donc la
// distance euclidienne max sur k axes est 2·√k) ; score = 1 − distance normalisée.
//
// La texture (`SensoryAxes.texture`) est CATÉGORIELLE, pas un axe numérique — hors du calcul
// euclidien, recombinée ensuite (précision 2). `textureVoulue` est un paramètre séparé de
// `envie` : `CravingAxes` (domain/request.ts) ne porte que les 3 axes numériques, la texture
// voulue vient d'ailleurs dans la requête. Si une texture est demandée : score = moyenne entre la
// composante euclidienne et (1 si match exact, 0 sinon) — un mismatch pénalise sans annuler le
// reste du signal.
//
// Cas limite non explicité par la spec, tranché ici : `envie` non-null mais dont les 3 axes sont
// `null` ET texture demandée → aucun axe numérique à comparer, la composante euclidienne vaut
// NEUTRAL_SCORE (rien à dire) plutôt que d'être omise — cohérent avec « la texture est recombinée
// avec la composante euclidienne », qui suppose que cette composante existe toujours.
//
// Rien demandé du tout (envie null/vide ET pas de texture) → NEUTRAL_SCORE.
//
// Dépendances autorisées : domain/, ./index.js — §2/§3 ENGINE.

import type { CravingAxes, RecipeId, SensoryAxes } from '../../domain/index.js'
import type { CandidateSet, ScoringLayerResult, SelectionLayer } from '../index.js'
import { NEUTRAL_SCORE, clamp01 } from './index.js'

type NumericCravingAxis = 'sucreSale' | 'legerConsistant' | 'chaudFroid'

const NUMERIC_AXES: readonly NumericCravingAxis[] = ['sucreSale', 'legerConsistant', 'chaudFroid']

export function scoreCraving(axes: SensoryAxes, envie: CravingAxes | null, textureVoulue?: string | null): number {
  const requestedAxes = envie === null ? [] : NUMERIC_AXES.filter((axis) => envie[axis] !== null)
  const textureRequested = textureVoulue !== null && textureVoulue !== undefined

  if (requestedAxes.length === 0 && !textureRequested) return NEUTRAL_SCORE

  let euclideanComponent = NEUTRAL_SCORE
  if (requestedAxes.length > 0) {
    const k = requestedAxes.length
    let sumSquares = 0
    for (const axis of requestedAxes) {
      const diff = axes[axis] - envie![axis]!
      sumSquares += diff * diff
    }
    const distance = Math.sqrt(sumSquares)
    const normalizedDistance = distance / (2 * Math.sqrt(k))
    euclideanComponent = clamp01(1 - normalizedDistance)
  }

  if (!textureRequested) return euclideanComponent

  const textureComponent = axes.texture === textureVoulue ? 1 : 0
  return clamp01((euclideanComponent + textureComponent) / 2)
}

// ------------------------------------------------------------------------------------------
// Couche `craving` (§6.2 ENGINE) — enveloppe `scoreCraving` dans le contrat `SelectionLayer`.
//
// `configure` pré-calcule les axes sensoriels de chaque recette (`recipe.axes`) en Map dérivée
// du `Catalog`, et lit `envie` depuis `req.context.envie` (peut être `null` — aucune envie
// exprimée, voir `scoreCraving` : la distance n'a alors rien à mesurer → `NEUTRAL_SCORE`).
//
// ⚠️ `textureVoulue` (3e paramètre de `scoreCraving`) n'a PAS de source dans `MealContext`
// aujourd'hui : le champ n'existe pas encore côté domaine (voir domain/request.ts). Cette couche
// appelle donc `scoreCraving` SANS 3e argument — équivalent à « aucune texture demandée » — signalé
// tel quel plutôt qu'improvisé (voir rapport de lot). Le câblage viendra avec le champ, pas avant.
//
// Candidat absent de `catalog.recipes` (id orphelin) → `NEUTRAL_SCORE`, même règle que les autres
// couches de score (§6.1 ENGINE).
// ------------------------------------------------------------------------------------------

export interface CravingLayerConfig {
  readonly axesByRecipe: ReadonlyMap<RecipeId, SensoryAxes>
  readonly envie: CravingAxes | null
}

export const cravingLayer: SelectionLayer<CravingLayerConfig> = {
  id: 'craving',
  kind: 'scoring',
  critical: false,
  defaultWeight: 0.2,

  configure: (req, catalog) => {
    const axesByRecipe = new Map<RecipeId, SensoryAxes>()
    for (const recipe of catalog.recipes.values()) axesByRecipe.set(recipe.id, recipe.axes)
    return { axesByRecipe, envie: req.context.envie }
  },

  apply: (candidates: CandidateSet, config: CravingLayerConfig): ScoringLayerResult => {
    const scores = new Map<RecipeId, number>()
    for (const recipeId of candidates) {
      const axes = config.axesByRecipe.get(recipeId)
      scores.set(recipeId, axes ? scoreCraving(axes, config.envie) : NEUTRAL_SCORE)
    }
    return { scores }
  },
}
