// ui/motif-vide.ts — la phrase que porte une case vide (lot `retour-5b`).
//
// ⛔ CE QUE CES PHRASES N'ONT PAS LE DROIT D'ÊTRE. Une case vide est le seul endroit de
// l'application où elle avoue ne pas savoir faire ce qu'on lui demande, et c'est exactement là
// qu'un ton de reproche se glisse. Chacune dit donc un FAIT sur les réglages en cours, jamais un
// jugement sur ce qui est mangé (principe 6) : ni « trop restrictif », ni « pensez à », ni
// « attention ». La formulation reste au constat, et laisse la décision entière.
//
// ⚠️ UNE PHRASE PAR CAUSE, ET UNE SEULE — sinon la case ne dit rien de plus qu'avant. « Aucune
// recette ne convient » posé partout serait littéralement la situation d'avant le lot : un silence
// un peu plus long. Ce qui rend chaque phrase utile, c'est qu'elle nomme le réglage à toucher, et
// deux causes différentes ne se touchent pas au même endroit.
//
// ⚠️ AUCUN CALCUL ICI. Cette table LIT le motif que le moteur a constaté au moment du tirage
// (`engine/planning/motif-vide.ts`) ; elle ne le déduit ni du profil, ni des contraintes, ni de la
// forme de l'écran. Deux cases vides de la même semaine peuvent porter deux causes différentes.

import type { MotifVide } from '../engine/domain/index.js'

/**
 * Ce que l'écran écrit sous une case vide, ou `null` s'il n'y a rien à écrire.
 *
 * ⚠️ `null` EN MOTIF N'EST PAS UN CAS D'ERREUR À SIGNALER À L'UTILISATEUR. La base ne peut pas
 * stocker une case vide sans motif (migration v19) ; un plan tenu en mémoire, lui, le pourrait
 * après un geste qui n'aurait pas branché le champ. L'écran retombe alors sur son silence d'avant
 * le lot plutôt que d'afficher un texte de secours qui ne voudrait rien dire.
 */
export function phraseDuMotif(motif: MotifVide | null): string | null {
  if (motif === null) return null
  return PHRASES[motif] ?? null
}

const PHRASES: Readonly<Record<MotifVide, string>> = {
  // --- Cause 1 : les couches d'exclusion ont tout écarté ---------------------------------------
  // ⚠️ LA COUCHE DOMINANTE EST NOMMÉE PARCE QU'ELLE EST LA SEULE ACTIONNABLE. « Aucune recette ne
  // passe vos critères » est vrai et inutile : il y en a sept, et l'utilisateur ne saura pas
  // laquelle relâcher. Celle qui a écarté le plus de plats est celle qui rendra le plus de choix.
  'aucune_recette:allergenes':
    'Aucune recette sans les allergènes que vous avez déclarés pour ce repas.',
  'aucune_recette:regime': 'Aucune recette de ce repas ne correspond au régime choisi.',
  'aucune_recette:exclusions': 'Les aliments que vous avez écartés retirent toutes les recettes de ce repas.',
  'aucune_recette:requis': 'Aucune recette de ce repas ne contient les aliments demandés.',
  'aucune_recette:temps': 'Aucune recette de ce repas ne tient dans le temps disponible.',
  'aucune_recette:equipement': 'Aucune recette de ce repas ne se fait avec l’équipement déclaré.',
  'aucune_recette:favoris': 'Aucun de vos favoris ne convient à ce repas.',
  // ⚠️ INATTEIGNABLE AUJOURD'HUI : un plan de semaine ne porte pas d'envie. La clé existe parce que
  // le type la fabrique à partir du registre ; la phrase reste au constat si un geste l'y portait.
  'aucune_recette:envie': 'Aucune recette de ce repas ne correspond à l’envie indiquée.',
  aucune_recette: 'Aucune recette disponible pour ce repas.',

  // --- Cause 2 : le vivier était bon, il est déjà servi -----------------------------------------
  // ⚠️ NE PAS ENVOYER ASSOUPLIR UN CRITÈRE ICI : ça ne changerait rien. Les recettes convenaient,
  // elles sont ailleurs dans la semaine — c'est la LONGUEUR de la fenêtre qui coince.
  catalogue_epuise: 'Les recettes qui convenaient sont déjà prévues ailleurs cette semaine.',

  // --- Cause 3 : il ne restait que des bases nues (lot `retour-5`) ------------------------------
  bases_nues: 'Il ne restait que des accompagnements, qui ne font pas un repas à eux seuls.',

  // --- La valeur de la migration, jamais produite par le moteur ---------------------------------
  indetermine: 'Ce planning a été fait avant que l’application ne sache dire pourquoi.',
}
