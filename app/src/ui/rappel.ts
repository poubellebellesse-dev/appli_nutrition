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

import type { MealPlanEntry, MealSlot, Recipe, RecipeId, WeekPlan } from '../engine/domain/index.js'

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

  // ⚠️ UN RAPPEL PAR REPAS, PAS PAR ENTRÉE — corrigé le 2026-08-04. Depuis le mode repas
  // (`plan-week.ts`), un déjeuner porte le plat ET son accompagnement : boucler sur `entries` posait
  // DEUX notifications pour une seule assiette, à deux instants différents. On regroupe donc par
  // créneau, et le rappel se cale sur le plat le plus LONG à préparer : c'est lui qui décide de
  // l'heure à laquelle on se met en cuisine — commencer à celle du plus court ferait servir en
  // retard, ce que le rappel existe précisément pour éviter.
  const parCreneau = new Map<string, MealPlanEntry[]>()
  for (const entree of plan.entries) {
    if (entree.recipeId === null || entree.isLeftover) continue
    const cle = `${entree.slot.date}|${entree.slot.creneau}`
    parCreneau.set(cle, [...(parCreneau.get(cle) ?? []), entree])
  }

  for (const duCreneau of parCreneau.values()) {
    const premier = duCreneau[0]!
    const heureRepas = heures.get(premier.slot.creneau)
    if (heureRepas === undefined) continue

    const aCuisiner = duCreneau
      .map((e) => recettes.get(e.recipeId!))
      .filter((r): r is Recipe => r !== undefined)
      .map((r) => ({ recette: r, minutes: r.tempsPrepMin + r.tempsCuissonMin }))
    if (aCuisiner.length === 0) continue

    const leplusLong = aCuisiner.reduce((a, b) => (b.minutes > a.minutes ? b : a))
    const debut = heureDuRappel(heureRepas, leplusLong.minutes)
    if (debut === null) continue

    const quandMs = instantLocal(premier.slot.date, debut)
    if (quandMs <= maintenantMs) continue

    rappels.push({
      recipeId: leplusLong.recette.id,
      date: premier.slot.date,
      creneau: premier.slot.creneau,
      quandMs,
      titre: 'C’est le moment de commencer',
      // ⚠️ FACTUEL, SANS INJONCTION (§6.2 ARCHITECTURE). Ni « n'oubliez pas », ni « vous devriez » :
      // on rappelle un fait — ce plat demande ce temps-là — et on n'en fait pas une obligation.
      // Quand le repas compte plusieurs plats, on nomme celui qui commande l'heure et on dit qu'il
      // y en a d'autres : taire le second ferait sous-estimer le travail restant.
      texte:
        aCuisiner.length === 1
          ? `${leplusLong.recette.nom} demande ${leplusLong.minutes} min.`
          : `${leplusLong.recette.nom} demande ${leplusLong.minutes} min, et il y a ${aCuisiner.length - 1} autre plat à ce repas.`,
    })
  }

  // Ordre chronologique : la liste part telle quelle vers l'ordonnanceur, et un ordre stable rend
  // les identifiants de notification reproductibles d'une reprogrammation à l'autre.
  return rappels.sort((a, b) => a.quandMs - b.quandMs)
}
