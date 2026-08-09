// engine/cuisine/duree.ts — les DEUX durées d'une recette, et pourquoi elles ne se confondent pas.
//
// ⛔ IL Y A DEUX DURÉES, ET LES FUSIONNER SERAIT UN DÉFAUT PLUS GRAVE QUE CELUI QUE CE MODULE RÉPARE.
//
//   - LA DURÉE ACTIVE (`tempsPrepMin + tempsCuissonMin`) répond à « ai-je le temps de faire ça ce
//     soir ». C'est elle que lisent `selection/scoring/speed.ts` et `search/index.ts`, chacun dans sa
//     propre fonction privée. Elle NE DOIT PAS bouger : faire compter les 12 h de marinade du coq au
//     vin dans `scoreSpeed` le rendrait « lent » pour le solveur, changerait le classement de tout le
//     catalogue et viderait la catégorie « rapide ». Ce module ne la touche pas, ne l'exporte pas et
//     ne demande à personne de l'appeler.
//   - LA DURÉE ÉCOULÉE (active + repos) répond à « quand dois-je m'y mettre ». C'est la seule qui ait
//     un sens pour la cuisine, et jusqu'ici elle n'existait nulle part.
//
// LE DÉFAUT MESURÉ, sur le catalogue du 2026-08-09 (330 recettes) : `ordonnancerCuissons` recevait la
// durée ACTIVE et annonçait « Coq au vin, à lancer 115 min avant le service ». Il lui faut 12 h de
// marinade en plus, soit 12 h 55. Le module d'ordonnancement n'avait rien de faux — c'est ce qu'on
// lui donnait qui l'était.
//
// ⚠️ AUCUN CHAMP NOUVEAU, ET C'EST DÉLIBÉRÉ. `tempsReposMin` n'existe ni au schéma, ni au YAML, ni au
// code, et n'a pas à exister : la donnée est DÉJÀ au catalogue, dans `recipe_step.timer_type`
// (97 étapes `repos`, 386 460 s, sur 82 recettes). Un champ agrégé de plus serait un dérivé à tenir à
// jour à la main, donc un dérivé qui finirait par mentir.
//
// Dépendances autorisées : ../domain/index.js, pour les types seuls.

import type { Recipe } from '../domain/index.js'

/**
 * Le temps de repos chiffré d'une recette, en minutes.
 *
 * ⚠️ SEULES LES ÉTAPES `timerType === 'repos'` COMPTENT, et le champ `nature` n'entre pas en ligne de
 * compte : un `avertissement` ne porte pas de minuteur (le build le garantit), et un `geste` de
 * cuisson porte `timerType: 'cuisson'`. Filtrer aussi sur `nature` n'ajouterait aucune sécurité et
 * ferait croire qu'il existe un cas où les deux divergent.
 *
 * ⚠️ ARRONDI AU PLUS PROCHE, PAS TRONQUÉ. Un repos de 90 s doit valoir 2 min, pas 1 : ce nombre sert
 * à reculer une heure de départ, et tronquer ferait systématiquement partir trop tard. L'erreur est
 * bornée à 30 s par recette, et elle penche du bon côté.
 */
export function dureeReposMin(recette: Recipe): number {
  let secondes = 0
  for (const etape of recette.etapes) {
    if (etape.timerType === 'repos' && etape.timerS !== null) secondes += etape.timerS
  }
  return Math.round(secondes / 60)
}

/**
 * Le temps ACTIF d'une recette, en minutes — préparation et cuisson, sans les repos.
 *
 * ⚠️ ELLE EST ICI POUR ÊTRE NOMMÉE, PAS POUR ÊTRE APPELÉE PARTOUT. `speed.ts` et `search/index.ts`
 * gardent chacun leur propre fonction privée : les rebrancher sur celle-ci les ferait dépendre d'un
 * module de cuisine et donnerait, un jour, l'idée d'y ajouter les repos « pour uniformiser ». La
 * duplication est ici moins dangereuse que le partage.
 */
export function dureeActiveMin(recette: Recipe): number {
  return recette.tempsPrepMin + recette.tempsCuissonMin
}

/**
 * Le temps qui S'ÉCOULE entre le premier geste et le plat sur la table — c'est cette durée-là qu'il
 * faut reculer depuis l'heure de service.
 *
 * Égale à la durée active quand la recette ne porte aucun repos chiffré, ce qui est le cas de
 * 248 recettes sur 330 : le correctif ne déplace rien pour elles.
 */
export function dureeEcouleeMin(recette: Recipe): number {
  return dureeActiveMin(recette) + dureeReposMin(recette)
}
