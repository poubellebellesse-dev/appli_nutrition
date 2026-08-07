// engine/selection/scoring/piquant.ts — couche de score `piquant` (décision 35).
//
// ⚠️ ELLE PÉNALISE, ELLE N'EXCLUT JAMAIS — décision utilisateur du 2026-08-07, et ce n'est pas une
// nuance de réglage. `Recipe.piquant` est `null` sur toute recette que personne n'a annotée : une
// EXCLUSION dure sur ce champ promettrait une protection qu'elle ne rend pas (le plat non annoté
// passerait quand même) ou viderait le catalogue (si `null` excluait). Un score, lui, ne ment pas :
// il fait descendre ce qui est trop fort, sans jamais prétendre avoir tout vu.
//
// ⚠️ TROIS SOURCES DE NEUTRALITÉ, TOUTES VOULUES :
//   - tolérance `null` (jamais déclarée) → la couche n'est même pas exécutée, son poids reste à 0
//     (voir `PIQUANT_DYNAMIC_WEIGHT`, ../scoring-pass.ts). Personne ne voit son classement bouger
//     pour un réglage qu'il n'a pas touché.
//   - `Recipe.piquant` à `null` (non annotée) → `NEUTRAL_SCORE`. On ne sait pas, on ne prétend pas.
//   - piquant SOUS ou À la tolérance → `NEUTRAL_SCORE`. La couche n'a pas d'avis sur ce qui convient ;
//     elle n'en a que sur ce qui dépasse. **Ne pas transformer ce cas en bonus** : récompenser le
//     plat le moins piquant reviendrait à classer les plats sur une échelle de douceur, donc à
//     juger (principe 6), et à déclasser toute une cuisine par un réglage de confort.
//
// ⚠️ `0` ET `null` NE SONT PAS LA MÊME CHOSE dans le catalogue — `0` dit « pas piquant », `null` dit
// « personne n'a regardé ». Ils donnent ici le même score, et c'est ce qui borne le coût d'une
// annotation ratée : se tromper sur un `0` met un mauvais mot sur une fiche, jamais un mauvais plat
// dans une assiette.
//
// Dépendances autorisées : domain/, ./index.js, ../index.js — §2/§3 ENGINE.

import type { PiquantTolerance, Recipe, RecipeId } from '../../domain/index.js'
import type { CandidateSet, ScoringLayerResult, SelectionLayer } from '../index.js'
import { NEUTRAL_SCORE, clamp01 } from './index.js'

/**
 * Niveau maximal accepté sans pénalité, par position déclarée.
 *
 * `'tout'` vaut 4, le haut de l'échelle : la couche devient alors sans effet, ce qui est le sens de
 * la position. On la garde active plutôt que de la traiter comme `null` — l'utilisateur a répondu,
 * et l'échelle peut gagner un niveau au-dessus de 4 un jour sans que ce fichier mente.
 */
const SEUIL_PAR_TOLERANCE: Readonly<Record<PiquantTolerance, number>> = {
  aucun: 0,
  un_peu: 1,
  tout: 4,
}

/**
 * Score d'un plat pour une tolérance donnée.
 *
 * Au-dessus du seuil, la pénalité est PROPORTIONNELLE à l'écart : un cran de trop se rattrape (un
 * plat par ailleurs excellent peut encore sortir), deux crans tombent à zéro. C'est ce qui distingue
 * « je ne te le propose pas volontiers » de « je te l'interdis » — et c'est tout l'objet de la
 * décision.
 */
export function scorePiquant(piquantRecette: number | null, tolerance: PiquantTolerance | null): number {
  if (tolerance === null || piquantRecette === null) return NEUTRAL_SCORE

  const ecart = piquantRecette - (SEUIL_PAR_TOLERANCE[tolerance] ?? 4)
  if (ecart <= 0) return NEUTRAL_SCORE

  // Un cran au-dessus → moitié du neutre ; deux crans ou plus → 0. Jamais négatif : une couche de
  // score ne retire pas de candidat, elle le classe (garde-fou `assertScoringLayersNeverExclude`).
  return clamp01(NEUTRAL_SCORE * (1 - ecart / 2))
}

export interface PiquantLayerConfig {
  readonly recipes: ReadonlyMap<RecipeId, Recipe>
  readonly tolerance: PiquantTolerance | null
}

export const piquantLayer: SelectionLayer<PiquantLayerConfig> = {
  id: 'piquant',
  kind: 'scoring',
  critical: false,
  // ⚠️ 0 PAR DÉFAUT, ET RELEVÉ DYNAMIQUEMENT — même mécanisme que `craving`. Un poids fixe non nul
  // ferait tourner la couche pour TOUT LE MONDE : la normalisation à Σ = 1 diluerait alors les
  // autres couches, et le classement de quelqu'un qui n'a jamais parlé de piquant changerait.
  defaultWeight: 0,

  configure: (req, catalog) => ({
    recipes: catalog.recipes,
    tolerance: req.tolerancePiquant,
  }),

  apply: (candidates: CandidateSet, config: PiquantLayerConfig): ScoringLayerResult => {
    const scores = new Map<RecipeId, number>()
    for (const recipeId of candidates) {
      const recette = config.recipes.get(recipeId)
      // Candidat orphelin du catalogue → neutre, comme toutes les couches de score (§6.1 ENGINE).
      scores.set(recipeId, recette ? scorePiquant(recette.piquant, config.tolerance) : NEUTRAL_SCORE)
    }
    return { scores }
  },
}
