// engine/cuisine/ordonnancement.ts — quand lancer chaque plat pour arriver ensemble au service.
//
// On remonte depuis l'heure de service : le plat le plus long démarre en premier, le plus court en
// dernier. C'est la même logique qu'un cuisinier applique de tête pour un repas à plusieurs plats —
// ici formalisée pour être vérifiable et pour départager les égalités sans ambiguïté.
//
// ⚠️ NIVEAU DE FIDÉLITÉ VOLONTAIREMENT LIMITÉ, à ne pas dépasser sans en rediscuter :
//   1. Le calcul porte sur la DURÉE ÉCOULÉE PAR RECETTE, fournie par l'appelant, jamais étape par
//      étape. Le module ne regarde aucune étape individuelle.
//   2. Le module NE CONNAÎT PAS le matériel (casseroles, four, thermomix). Deux plats qui réclament
//      le même four au même instant ne sont pas détectés. ⚠️ La donnée EXISTE désormais
//      (`Recipe.equipements`, 1 473 couples dont 357 `requis`) mais elle est déclarée PAR RECETTE,
//      pas par étape : rien n'y dit *quand* le four est occupé, donc rien ne permet de réserver un
//      créneau. Ne pas conclure de sa présence qu'il ne reste qu'à la lire.
//   3. Le module NE DISTINGUE PAS temps actif et temps passif : il n'entrelace rien. Une marinade de
//      deux heures compte comme deux heures pleines, comme une cuisson surveillée.
//
// ⛔ `dureeMin` EST LA DURÉE ÉCOULÉE, PLUS LA DURÉE ACTIVE — ce module recevait la mauvaise jusqu'au
// 2026-08-09. Il n'avait rien de faux : c'est ce qu'on lui donnait qui l'était. `tempsPrepMin +
// tempsCuissonMin` ne compte AUCUN repos, si bien qu'un coq au vin de 12 h de marinade était annoncé
// « à lancer 115 min avant le service ». La distinction et son calcul vivent dans `./duree.ts` ; s'y
// reporter avant de toucher à ce contrat, elle a un versant qu'il ne faut surtout pas fusionner.
//
// ⚠️ AUCUNE HORLOGE. Tout est en minutes relatives avant le service (`departAvantServiceMin`),
// jamais en horodatages — même discipline que `ui/cuisine-session.ts`. C'est l'écran qui convertit
// avec l'heure de service choisie par l'utilisateur.
//
// Dépendances autorisées : ../domain/index.js, uniquement pour le type `RecipeId`.

import type { RecipeId } from '../domain/index.js'

export interface CuissonAOrdonnancer {
  readonly recipeId: RecipeId
  readonly nom: string
  /**
   * La durée ÉCOULÉE, `dureeEcouleeMin(recette)` — active + repos chiffrés. Entier >= 0.
   *
   * ⛔ PAS `tempsPrepMin + tempsCuissonMin`. Cette somme-là répond à « ai-je le temps ce soir »,
   * pas à « quand dois-je m'y mettre », et la donner ici fait partir en retard de tout le repos.
   */
  readonly dureeMin: number
}

export interface DepartCuisson {
  readonly recipeId: RecipeId
  readonly nom: string
  /** 0 = la première à lancer. */
  readonly rang: number
  /** Minutes AVANT le service. Toujours >= 0. Vaut `dureeMin`. */
  readonly departAvantServiceMin: number
  readonly dureeMin: number
}

export interface Ordonnancement {
  /** Trié par `rang` croissant, donc de la plus longue à la plus courte. */
  readonly departs: readonly DepartCuisson[]
  /** Minutes entre le premier départ et le service. 0 si aucune cuisson. */
  readonly amplitudeMin: number
}

/**
 * Ordonnance des cuissons pour un service commun.
 *
 * Tri par `dureeMin` décroissant ; à égalité, par `recipeId` croissant (comparaison de chaînes,
 * pas `localeCompare`, pour un résultat reproductible indépendamment de la locale — principe de
 * déterminisme du projet).
 */
export function ordonnancerCuissons(cuissons: readonly CuissonAOrdonnancer[]): Ordonnancement {
  const vus = new Set<RecipeId>()
  for (const cuisson of cuissons) {
    if (vus.has(cuisson.recipeId)) {
      throw new Error(`ordonnancerCuissons : recipeId en double « ${cuisson.recipeId} »`)
    }
    vus.add(cuisson.recipeId)

    if (!Number.isFinite(cuisson.dureeMin) || cuisson.dureeMin < 0) {
      throw new Error(
        `ordonnancerCuissons : dureeMin invalide (${cuisson.dureeMin}) pour recipeId « ${cuisson.recipeId} »`,
      )
    }
  }

  const tries = [...cuissons].sort((a, b) => {
    if (a.dureeMin !== b.dureeMin) return b.dureeMin - a.dureeMin
    if (a.recipeId < b.recipeId) return -1
    if (a.recipeId > b.recipeId) return 1
    return 0
  })

  const departs = tries.map((cuisson, rang) => ({
    recipeId: cuisson.recipeId,
    nom: cuisson.nom,
    rang,
    departAvantServiceMin: cuisson.dureeMin,
    dureeMin: cuisson.dureeMin,
  }))

  const amplitudeMin = departs.length > 0 ? departs[0]!.dureeMin : 0

  return { departs, amplitudeMin }
}
