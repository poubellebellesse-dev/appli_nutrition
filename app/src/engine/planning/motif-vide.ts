// engine/planning/motif-vide.ts — pourquoi un créneau est resté vide (lot `retour-5b`).
//
// ⛔ UN SEUL ENDROIT DÉCIDE, ET C'EST TOUT L'INTÉRÊT DU FICHIER. Deux chemins produisent des
// créneaux vides — la planification de semaine et le bouton « Changer » — et ils ne se ressemblent
// pas : l'un boucle sur quatorze créneaux en accumulant ce qu'il a posé, l'autre reprend un seul
// créneau en accumulant des refus. Écrire la classification deux fois, c'est signer que les deux
// écrans finiront par dire deux choses différentes de la même cause. Une clause scellée le refuse.
//
// ⚠️ LA CAUSE EST CONSTATÉE, JAMAIS RECALCULÉE. Ces deux fonctions ne reçoivent que ce que le
// tirage a RÉELLEMENT rencontré : l'erreur levée, ou la liste des suggestions rendues. Elles ne
// voient ni `HardConstraints`, ni le régime, ni le nombre d'aliments exclus — et c'est délibéré.
// Un classifieur branché sur la forme de la demande passe presque tous les tests d'un lot comme
// celui-ci : il en existe un, écrit par un critique le 2026-09-09, qui les passait TOUS sans jamais
// lire un seul rejet. La seule défense est de ne pas lui donner la donnée.
//
// Dépendances autorisées : domain/ uniquement (L4, §2 ENGINE).

import type { ExclusionLayerId, MotifVide, RecipeId, ScoredSuggestion } from '../domain/index.js'
import type { NoViableRecipeError } from '../domain/index.js'

/**
 * La couche d'exclusion qui a écarté le plus de candidats, ou `null` si aucune n'a rien écarté.
 *
 * ⚠️ COMPARAISON STRICTE, DONC À COMPTE ÉGAL LA PREMIÈRE RENCONTRÉE L'EMPORTE — et l'ordre de
 * `byLayer` est celui des rejets, donc celui du registre `EXCLUSION_LAYERS`. Même règle de départage
 * que `describeNoViableRecipe` côté api/ (§6.3 ENGINE, « priorité de motif ») ; les deux doivent
 * nommer la même couche, sans quoi le message de l'erreur et le motif de la case se contrediraient.
 * On la réécrit ici plutôt que de l'importer : L4 ne peut pas dépendre de L5.
 */
function coucheDominante(byLayer: ReadonlyMap<ExclusionLayerId, number>): ExclusionLayerId | null {
  let dominante: ExclusionLayerId | null = null
  let max = 0
  for (const [couche, compte] of byLayer) {
    if (compte > max) {
      dominante = couche
      max = compte
    }
  }
  return dominante
}

/** Cause 1 : les couches d'exclusion n'ont rien laissé passer. Le motif nomme laquelle a le plus pesé. */
export function motifDeLaLevee(error: NoViableRecipeError): MotifVide {
  const couche = coucheDominante(error.rejected.byLayer)
  return couche === null ? 'aucune_recette' : `aucune_recette:${couche}`
}

/**
 * Causes 2 et 3 : `suggest` a bien rendu des candidats, et pourtant rien n'a pu être posé.
 *
 * ⚠️ LES DEUX CAUSES SE DISTINGUENT PAR CE QUI RESTE, pas par la longueur de la liste rendue. Un
 * vivier de trente suggestions toutes déjà servies cette semaine est un catalogue ÉPUISÉ ; un
 * vivier de deux bases nues ne l'est pas — il reste des recettes, elles ne font simplement pas un
 * repas (lot `retour-5`). Les confondre dirait à l'utilisateur d'allonger sa semaine quand il
 * suffisait d'assouplir, ou l'inverse.
 */
export function motifDuVivier(
  suggestions: readonly ScoredSuggestion[],
  dejaPosee: (recipeId: RecipeId) => boolean,
  estPlatSimple: (recipeId: RecipeId) => boolean
): MotifVide {
  const restantes = suggestions.filter((s) => !dejaPosee(s.recipeId))
  if (restantes.length === 0) return 'catalogue_epuise'
  // ⚠️ `every` SUR UNE LISTE NON VIDE, garanti par la ligne au-dessus. Appelée après un tirage qui
  // n'a rien posé, cette fonction ne peut être ici que si tout ce qui restait était un plat simple :
  // la seconde passe de `pickForSlot` n'écarte plus rien d'autre.
  if (restantes.every((s) => estPlatSimple(s.recipeId))) return 'bases_nues'
  // Inatteignable tant que les deux passes ne filtrent que sur ces deux critères. On ne lève pas
  // pour autant : un plan à moitié rendu vaut mieux qu'aucun plan, c'est déjà l'arbitrage de
  // `pickForSlot` sur `NoViableRecipeError`.
  return 'catalogue_epuise'
}
