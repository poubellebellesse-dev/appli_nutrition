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

/**
 * λ de référence (§6.6 ENGINE) — **CALIBRÉ le 2026-08-07**, `npm run engine:calibrate-lambda`,
 * sur 288 configurations × 305 recettes (4 créneaux × 3 archétypes × 3 régimes × 8 graines).
 *
 * ⚠️ CETTE VALEUR A VALU 0,4 SANS AUCUNE MESURE JUSQU'À CETTE DATE — une intuition de conception,
 * dernier nombre du moteur posé au jugé. Ne pas la redéplacer sans rejouer le banc.
 *
 * Deux courbes opposées : monter λ fait TOUJOURS baisser la redondance et TOUJOURS baisser la
 * pertinence. Il n'y a pas d'optimum, seulement un échange.
 *
 * ⛔ LE GENOU NE POINTE PAS UNE VALEUR — IL LA BORNE, et une relecture adverse l'a montré le jour
 * même de la calibration. Le critère (distance au point idéal, normalisée min-max) se recale sur les
 * bornes RÉELLEMENT balayées, donc sa réponse suit la fenêtre : 0,2 en balayant jusqu'à 0,6 · 0,3
 * jusqu'à 1,0 et 2,0 · **0,5 jusqu'à 5,0**. La première rédaction de ce commentaire annonçait « 0,3,
 * stable » sur la foi d'un balayage arrêté à 2,0 — la borne fabriquait une part de la réponse.
 * **Ce que la mesure établit : λ ∈ [0,2 ; 0,5].**
 *
 * D'où vient le 0,3, alors : du **seul repère que la méthode ne fabrique pas** — le plus petit λ qui
 * vide TOUTES les listes servies de leurs doublons (similarité interne > 60 %) vaut **0,2**, aux
 * quatre créneaux, petit-déjeuner (43 recettes) comme dîner (197). On prend un pas de marge au-dessus
 * parce que ce seuil est mesuré sur CE catalogue, et qu'il grossit.
 *
 * ⚠️ LA MESURE N'EXCLUT PAS 0,4 — elle ne le désigne jamais, ce qui n'est pas la même chose, et
 * 0,4 tombe d'ailleurs dans l'intervalle [0,2 ; 0,5]. Il coûte 0,19 point de score de plus pour
 * 1,7 point de redondance de moins. **Ce qui change n'est pas la qualité des suggestions.**
 * ⚠️ MAIS L'IMPACT EN SURFACE EST TOUT SAUF PETIT, et l'écrire évite de croire le contraire :
 * comparées graine à graine, **89,9 % des 288 configurations rendent une LISTE différente entre 0,3
 * et 0,4**. Petit en score agrégé, massif en composition.
 * ⚠️ L'écart 0,3/0,4 N'EST PAS du bruit de tirage : test apparié à graines égales, t = 5,4 sur la
 * redondance et t = 6,0 sur le score.
 * ⚠️ LE BANC MESURE À HISTORIQUE VIDE, ce qui SOUS-ESTIME la redondance d'environ 1 à 2 points pour
 * quelqu'un dont les habitudes sont concentrées (mesuré). L'ordre entre les λ, lui, ne s'inverse pas.
 */
export const DEFAULT_MMR_LAMBDA = 0.3

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
