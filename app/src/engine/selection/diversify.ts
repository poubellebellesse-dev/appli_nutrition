// engine/selection/diversify.ts — diversification par pertinence marginale maximale (MMR),
// docs/ENGINE.md §6.6.
//
// Prendre les N meilleurs scores retourne souvent N variations du même plat. Correction retenue
// par la spec, glouton :
//
//   retenues = []
//   tant que |retenues| < limite :
//       meilleure = argmax( score(r) − λ · similarité(r, retenues) )
//       retenues += meilleure
//
// ⚠️ `max`, PAS la moyenne — décision de fond de ce fichier. Ce qui compte pour juger qu'un
// candidat est redondant, c'est sa proximité avec le PLUS PROCHE des plats déjà retenus, pas une
// proximité moyenne avec l'ensemble. Une moyenne DILUERAIT un doublon flagrant : un candidat
// identique à une seule recette déjà retenue parmi 4 doit être aussi pénalisé qu'identique à
// TOUTES — c'est justement ce doublon-là que la diversification doit repousser, peu importe le
// nombre d'autres retenues sans rapport. La moyenne laisserait passer des quasi-doublons dès que
// suffisamment d'autres retenues « diluent » la proximité — contraire à l'intention de §6.6.
//
// Le premier élément retenu n'est jamais pénalisé — la boucle générale suffit à le garantir SANS
// cas particulier codé : `max` sur un ensemble de retenues VIDE vaut 0 par convention (aucune
// retenue à comparer), donc `score(r) − λ·0 = score(r)` au premier tour : le meilleur score gagne
// naturellement, comme documenté par la spec (« aucune pénalité à appliquer sur un ensemble vide »).
//
// Départage strictement déterministe — cohérent avec `rankScoredCandidates` (scoring-pass.ts) :
// à valeur AJUSTÉE égale (score − λ·similarité, pas le score brut), le plus petit id de recette
// gagne. Aucun `Math.random`. Avec λ = 0, la valeur ajustée dégénère exactement en `score` pour
// tout candidat (le terme de pénalité est toujours nul) : la boucle redevient donc un simple
// classement par score avec le même tie-break — non-régression exacte vers `rankScoredCandidates`,
// vérifiée par test.
//
// Complexité : O(limite × |scored|²) dans le pire cas (à chaque tour, on réévalue chaque candidat
// restant contre chaque retenue) — largement suffisant pour `limite` ~5-20 et un catalogue de
// quelques centaines à quelques milliers de recettes (§5.6 ARCHITECTURE : le budget de complexité
// de ce moteur se mesure en millisecondes à cette échelle, pas en catalogue à optimiser).
//
// Fonction PURE, découplée de `Catalog` et de `similarity.ts` : `similarityOf` est un accesseur
// injecté (`RecipeId × RecipeId → number`), exactement comme les couches de score prennent leurs
// données en paramètres plutôt qu'un `Catalog` entier. `similarity.ts` (`buildSimilarityProfiles`
// + `similarity`) est le fournisseur RÉEL de cet accesseur en production (voir cli/try-engine.ts) ;
// les tests de ce fichier utilisent des accesseurs synthétiques, comme scoring-pass.test.ts le
// fait pour les couches de score.
//
// Dépendances autorisées : domain/, ./scoring-pass.js (réutilise `RankedCandidate`, pas de type
// dupliqué) — §2/§3 ENGINE.

import type { RecipeId } from '../domain/index.js'
import type { RankedCandidate } from './scoring-pass.js'

/** λ de référence (§6.6 ENGINE, « λ ≈ 0.4 par défaut ») — À CALIBRER sur le catalogue réel : la
 * spec le dit elle-même, cette valeur n'est pas issue d'une mesure sur le catalogue de production,
 * seulement d'une intuition de conception. Voir le rapport de lot pour l'observation faite sur le
 * catalogue de test (10 recettes) — insuffisant pour trancher la calibration définitivement. */
export const DEFAULT_MMR_LAMBDA = 0.4

export interface DiversifiedCandidate {
  readonly recipeId: RecipeId
  readonly score: number
  /** Similarité MAXIMALE avec les recettes déjà retenues au moment de la sélection — 0 pour le
   * premier élément (ensemble retenu vide). Voir l'en-tête de fichier pour le choix `max` vs moyenne. */
  readonly maxSimilarityToRetained: number
}

/**
 * Diversifie `scored` (déjà classé, typiquement `rankScoredCandidates`) par pertinence marginale
 * maximale (§6.6 ENGINE). Moins de candidats que `limit` → retourne tout, sans erreur.
 */
export function diversify(
  scored: readonly RankedCandidate[],
  limit: number,
  lambda: number,
  similarityOf: (a: RecipeId, b: RecipeId) => number
): readonly DiversifiedCandidate[] {
  const remaining = [...scored]
  const retained: DiversifiedCandidate[] = []

  while (retained.length < limit && remaining.length > 0) {
    let bestIndex = -1
    let bestAdjustedValue = -Infinity
    let bestMaxSimilarity = 0

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i]!

      let maxSimilarity = 0 // max sur ensemble vide = 0 — voir en-tête (aucune pénalité au 1er tour)
      for (const kept of retained) {
        const sim = similarityOf(candidate.recipeId, kept.recipeId)
        if (sim > maxSimilarity) maxSimilarity = sim
      }

      const adjustedValue = candidate.score - lambda * maxSimilarity

      const isBetter =
        bestIndex === -1 ||
        adjustedValue > bestAdjustedValue ||
        (adjustedValue === bestAdjustedValue && candidate.recipeId < remaining[bestIndex]!.recipeId)

      if (isBetter) {
        bestIndex = i
        bestAdjustedValue = adjustedValue
        bestMaxSimilarity = maxSimilarity
      }
    }

    const [winner] = remaining.splice(bestIndex, 1)
    retained.push({ recipeId: winner!.recipeId, score: winner!.score, maxSimilarityToRetained: bestMaxSimilarity })
  }

  return retained
}
