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

import type { CravingAxes, SensoryAxes } from '../../domain/index.js'
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
