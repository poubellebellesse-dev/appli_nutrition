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

/** Largeur de la bande de tolérance de `diversify` (tirage seedé, même correctif « variété »
 * que `DEFAULT_VARIETY_TOLERANCE` de scoring-pass.ts). ⚠️ Valeur ABSOLUE, PAS relative comme
 * l'autre constante — voir le commentaire du bloc de tirage ci-dessous pour le pourquoi (la
 * valeur ajustée ici peut être négative, une bande relative y perdrait tout son sens). 0.05
 * choisi du même ordre de grandeur que `DEFAULT_VARIETY_TOLERANCE` (0.03) mais légèrement plus
 * large : la valeur ajustée cumule deux sources de bruit (score ET similarité), une bande trop
 * étroite laisserait rarement plus d'un candidat éligible au tirage. */
export const DEFAULT_DIVERSIFY_TOLERANCE = 0.05

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
 *
 * `alea`/`tolerance` optionnels — même correctif « variété » que `rankScoredCandidates`
 * (scoring-pass.ts), deux régimes :
 *   - SANS `alea` (ou `tolerance` ≤ 0) : comportement INCHANGÉ, argmax strict, départage par plus
 *     petit id à égalité EXACTE. C'est ce qui protège tous les tests existants ci-dessous.
 *   - AVEC `alea` ET `tolerance` > 0 : à chaque tour, au lieu de retenir l'argmax, on constitue la
 *     RÉSERVE des candidats dont la valeur ajustée est à au plus `tolerance` SOUS la meilleure
 *     valeur ajustée du tour, puis on tire un élément de cette réserve avec `alea()`.
 *
 * ⚠️ BANDE ABSOLUE ICI, PAS RELATIVE — diverge délibérément de `rankScoredCandidates`, qui utilise
 * une bande relative (`meilleur * (1 - tolerance)`) parce que ses scores sortent de `clamp01`
 * (toujours dans [0, 1]). Ici la valeur ajustée vaut `score − λ·similarité` : avec λ = 0.4 elle
 * peut descendre jusqu'à −0.4. Sur une valeur ajustée NÉGATIVE, multiplier par `(1 - tolerance)`
 * AUGMENTE le seuil au lieu de l'abaisser (ex. −0.4 * 0.97 = −0.388, un seuil PLUS HAUT que le
 * meilleur lui-même) — la bande deviendrait vide ou exclurait le meilleur lui-même. D'où le calcul
 * en soustraction (`meilleur - tolerance`), qui reste correct quel que soit le signe. Ne PAS
 * uniformiser les deux fonctions sur ce point sans revoir ce raisonnement.
 *
 * Complexité : deux passes par tour au lieu d'une (a. trouver la meilleure valeur ajustée du tour,
 * b. collecter la réserve dans la bande, c. tirer) quand `alea` est fourni — reste
 * O(limite × |scored|²) au pire, le facteur constant supplémentaire ne change pas l'ordre.
 */
export function diversify(
  scored: readonly RankedCandidate[],
  limit: number,
  lambda: number,
  similarityOf: (a: RecipeId, b: RecipeId) => number,
  alea?: () => number,
  tolerance?: number
): readonly DiversifiedCandidate[] {
  const remaining = [...scored]
  const retained: DiversifiedCandidate[] = []
  const useTirage = alea !== undefined && tolerance !== undefined && tolerance > 0

  while (retained.length < limit && remaining.length > 0) {
    // Valeur ajustée + similarité max de chaque candidat restant contre les retenues actuelles.
    const adjusted: Array<{ readonly index: number; readonly value: number; readonly maxSimilarity: number }> = []
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i]!

      let maxSimilarity = 0 // max sur ensemble vide = 0 — voir en-tête (aucune pénalité au 1er tour)
      for (const kept of retained) {
        const sim = similarityOf(candidate.recipeId, kept.recipeId)
        if (sim > maxSimilarity) maxSimilarity = sim
      }

      adjusted.push({ index: i, value: candidate.score - lambda * maxSimilarity, maxSimilarity })
    }

    let winnerIndex: number
    let winnerMaxSimilarity: number

    if (!useTirage) {
      // Régime déterministe INCHANGÉ : argmax strict, départage par plus petit id à égalité exacte.
      let bestIndex = -1
      let bestAdjustedValue = -Infinity
      let bestMaxSimilarity = 0
      for (const { index, value, maxSimilarity } of adjusted) {
        const isBetter =
          bestIndex === -1 ||
          value > bestAdjustedValue ||
          (value === bestAdjustedValue && remaining[index]!.recipeId < remaining[bestIndex]!.recipeId)
        if (isBetter) {
          bestIndex = index
          bestAdjustedValue = value
          bestMaxSimilarity = maxSimilarity
        }
      }
      winnerIndex = bestIndex
      winnerMaxSimilarity = bestMaxSimilarity
    } else {
      // (a) meilleure valeur ajustée du tour.
      let bestAdjustedValue = -Infinity
      for (const { value } of adjusted) {
        if (value > bestAdjustedValue) bestAdjustedValue = value
      }
      // (b) réserve : bande ABSOLUE sous la meilleure valeur — voir en-tête pour le pourquoi.
      const seuil = bestAdjustedValue - tolerance!
      const reserve = adjusted.filter(({ value }) => value >= seuil)
      // (c) tirage.
      const choisi = Math.min(Math.floor(alea!() * reserve.length), reserve.length - 1)
      const gagnant = reserve[choisi]!
      winnerIndex = gagnant.index
      winnerMaxSimilarity = gagnant.maxSimilarity
    }

    const [winner] = remaining.splice(winnerIndex, 1)
    retained.push({ recipeId: winner!.recipeId, score: winner!.score, maxSimilarityToRetained: winnerMaxSimilarity })
  }

  return retained
}
