// ui/ecrire-plan.ts — enregistrer un plan, et faire suivre les rappels de l'appareil.
//
// ⛔ POURQUOI CE MODULE EXISTE. Cette fonction vivait dans `screens/semaine.tsx`, seul écran qui
// écrivait le plan. L'écran Aujourd'hui en écrit un à son tour depuis le lot `retour-3` (« je mange
// dehors »), et une SECONDE copie aurait donné deux écrans qui divergent à la première retouche —
// exactement ce qui est arrivé à `PALIERS_TEMPS`, recopié dans Aujourd'hui alors que le profil
// l'exportait déjà. Un plan enregistré sans reprogrammation laisse l'appareil sonner pour un plat
// qui n'y est plus : ce n'est pas un détail d'écran, c'est la conséquence de l'écriture.
import type { WeekPlan } from '../engine/domain/index.js'
import { readDisplay, readMealTimes, savePlan } from '../data/user-store.js'
import { maintenantIso, type Socle } from './socle.js'
import { rappelsDuPlan } from './rappel.js'
import { reprogrammer, toutAnnuler } from './notifications.js'

/**
 * Reprogramme les rappels de l'appareil sur le plan qu'on vient d'enregistrer.
 *
 * ⚠️ APPELÉ À CHAQUE ÉCRITURE DE PLAN, et sans être attendu. Les rappels sont un CONFORT : si la
 * plateforme refuse, si la permission a été révoquée, ou s'il n'y a pas de conteneur natif, l'écran
 * s'affiche exactement pareil. Attendre la programmation ferait dépendre l'affichage d'un service
 * optionnel.
 *
 * ⚠️ IL FAUT REPROGRAMMER À CHAQUE FOIS. « Proposer une autre semaine » réécrit tout le plan ;
 * laisser les anciens rappels ferait sonner l'appareil pour des plats qui n'y sont plus.
 */
export function reprogrammerLesRappels(socle: Socle, plan: WeekPlan): void {
  if (!readDisplay(socle.db).rappelsActifs) {
    void toutAnnuler()
    return
  }
  const rappels = rappelsDuPlan(plan, socle.catalogue.recipes, readMealTimes(socle.db), Date.now())
  void reprogrammer(rappels)
}

/** Le chemin d'écriture complet d'un plan : la base, puis l'appareil. Jamais l'un sans l'autre. */
export function enregistrerLePlan(socle: Socle, plan: WeekPlan): void {
  savePlan(socle.db, plan, maintenantIso())
  reprogrammerLesRappels(socle, plan)
}
