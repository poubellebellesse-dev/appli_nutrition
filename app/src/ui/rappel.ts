// ui/rappel.ts — quand prévenir qu'il est temps de se mettre à cuisiner.
//
// ⚠️ AUCUNE HORLOGE N'EST LUE ICI. `maintenantMs` est injecté, comme partout dans ce projet (§3
// ENGINE). C'est ce qui rend la règle testable minute par minute — et un rappel qui se déclenche à
// la mauvaise heure est exactement le genre de défaut qu'on ne reproduit pas à la main.
//
// ⚠️ LES RAPPELS VIENNENT DU PLAN DE LA SEMAINE, PAS DES SUGGESTIONS. Prévenir pour un plat
// simplement proposé serait absurde : personne n'a dit qu'il le cuisinerait. Sans semaine composée,
// il n'y a rien à rappeler, et c'est le comportement correct.
//
// ⚠️ CE MODULE NE PROGRAMME RIEN. Il calcule des instants ; les poser sur l'appareil est le travail
// de `ui/notifications.ts`, qui a besoin, lui, d'un conteneur natif. La frontière est volontaire :
// tout ce qui peut se tester sans appareil est ici.

import type { MealSlot, Recipe, RecipeId, WeekPlan } from '../engine/domain/index.js'

/**
 * Marge avant le début effectif de la préparation.
 *
 * On prévient un peu avant l'heure théorique : entre la notification et le premier geste, il y a le
 * temps de la lire, de finir ce qu'on faisait et d'arriver dans la cuisine. Sans marge, un rappel
 * « juste à l'heure » est déjà en retard.
 */
export const MARGE_MIN = 10

/** Un rappel prêt à être posé sur l'appareil. */
export interface Rappel {
  readonly recipeId: RecipeId
  /** ISO yyyy-mm-dd du repas concerné. */
  readonly date: string
  readonly creneau: MealSlot
  /** Instant de déclenchement, en millisecondes epoch (heure LOCALE de l'appareil). */
  readonly quandMs: number
  readonly titre: string
  readonly texte: string
}

/**
 * Avant cette heure, on ne notifie pas. Du tout.
 *
 * ⚠️ CE PLANCHER EST LE VRAI GARDE-FOU, pas le test de négativité. Un gigot de 3 h pour un
 * déjeuner à 7 h donne un début de préparation à 3 h 20 : un nombre parfaitement positif, et une
 * notification en pleine nuit. Le défaut n'est apparu qu'en écrivant le test — le code ne refusait
 * que les valeurs négatives, ce qui ne protège de rien.
 *
 * Sur une application dont l'argument est qu'elle ne harcèle personne, réveiller quelqu'un pour lui
 * parler de son rôti est pire que de ne rien dire. On se tait.
 */
export const HEURE_PLANCHER_MIN = 6 * 60

/**
 * Minutes depuis minuit auxquelles commencer, ou `null` si le rappel n'a pas de sens.
 *
 * `null` dans deux cas : le plat demande plus de temps qu'il n'en reste depuis minuit (prévenir
 * « hier » ne veut rien dire), ou le départ tomberait avant `HEURE_PLANCHER_MIN`.
 */
export function heureDuRappel(heureRepasMin: number, tempsTotalMin: number): number | null {
  const debut = heureRepasMin - tempsTotalMin - MARGE_MIN
  return debut < HEURE_PLANCHER_MIN ? null : debut
}

/** Instant epoch d'une date ISO à une heure donnée, en heure LOCALE de l'appareil. */
function instantLocal(dateIso: string, heureMin: number): number {
  const [annee, mois, jour] = dateIso.split('-').map(Number)
  // ⚠️ `new Date(y, m, d, h, min)` construit en heure LOCALE, contrairement à `new Date('...Z')`.
  // C'est voulu : « dîner à 19 h 30 » veut dire 19 h 30 chez l'utilisateur, pas en UTC. C'est la
  // même asymétrie assumée que dans `ui/creneau.ts` — les DATES sont des jours, les HEURES sont
  // locales.
  return new Date(annee!, mois! - 1, jour!, Math.floor(heureMin / 60), heureMin % 60, 0, 0).getTime()
}

/**
 * Les rappels à poser pour un plan, à partir des heures de repas déclarées.
 *
 * Un créneau sans heure déclarée ne produit AUCUN rappel — personne ne doit avoir à renseigner
 * l'heure de ses quatre repas pour être prévenu de lancer son dîner.
 *
 * Ne rend que les rappels ENCORE À VENIR : reprogrammer le passé ferait sonner l'appareil
 * immédiatement, autant de fois qu'il y a de repas écoulés dans la semaine.
 */
export function rappelsDuPlan(
  plan: WeekPlan,
  recettes: ReadonlyMap<RecipeId, Recipe>,
  heures: ReadonlyMap<MealSlot, number>,
  maintenantMs: number
): readonly Rappel[] {
  const rappels: Rappel[] = []

  for (const entree of plan.entries) {
    if (entree.recipeId === null) continue
    // Un reste ne se cuisine pas : il se réchauffe. Prévenir deux heures avant serait absurde.
    if (entree.isLeftover) continue

    const heureRepas = heures.get(entree.slot.creneau)
    if (heureRepas === undefined) continue

    const recette = recettes.get(entree.recipeId)
    if (recette === undefined) continue

    const debut = heureDuRappel(heureRepas, recette.tempsPrepMin + recette.tempsCuissonMin)
    if (debut === null) continue

    const quandMs = instantLocal(entree.slot.date, debut)
    if (quandMs <= maintenantMs) continue

    rappels.push({
      recipeId: entree.recipeId,
      date: entree.slot.date,
      creneau: entree.slot.creneau,
      quandMs,
      titre: 'C’est le moment de commencer',
      // ⚠️ FACTUEL, SANS INJONCTION (§6.2 ARCHITECTURE). Ni « n'oubliez pas », ni « vous devriez » :
      // on rappelle un fait — ce plat demande ce temps-là — et on n'en fait pas une obligation.
      texte: `${recette.nom} demande ${recette.tempsPrepMin + recette.tempsCuissonMin} min.`,
    })
  }

  // Ordre chronologique : la liste part telle quelle vers l'ordonnanceur, et un ordre stable rend
  // les identifiants de notification reproductibles d'une reprogrammation à l'autre.
  return rappels.sort((a, b) => a.quandMs - b.quandMs)
}
