// ui/creneau.ts — quels repas l'utilisateur a prévus, et lequel regarder maintenant.
//
// ⚠️ CE MODULE EXISTE PARCE QUE `aujourdhui.tsx` PORTAIT `const CRENEAU = 'diner'` EN DUR. À 11 h 45,
// l'écran titrait « Ce soir » et proposait des dîners. Le nombre de repas par jour était pourtant
// demandé au premier lancement et écrit en base (`user_rythme`, migration v3) — mais AUCUN écran ne
// le relisait. C'est le défaut récurrent du projet, déjà rencontré sur `preference` puis sur le
// filtre allergènes : un champ déclaré, rempli, et lu par personne.
//
// ⚠️ L'HEURE EST LOCALE ICI, alors que les DATES du projet sont en UTC (voir `estWeekend`). Ce n'est
// pas une incohérence : une date de plan est un JOUR, que le fuseau ne doit pas décaler ; « quel
// repas est-ce, là, maintenant » est au contraire une question purement locale. Lire l'heure en UTC
// afficherait le dîner à midi pour qui vit hors du méridien de Greenwich.
//
// Ce fichier ne lit PAS l'horloge : elle est injectée par l'appelant, comme partout ailleurs (§3
// ENGINE). C'est ce qui rend la règle testable heure par heure.

import type { MealSlot } from '../engine/domain/index.js'

/**
 * « Nombre de repas/jour réglable (1-4) » (§4.2 DESIGN).
 *
 * ⚠️ SOURCE UNIQUE — ce mapping vivait dans `semaine.tsx`, dont l'en-tête disait déjà « ici et nulle
 * part ailleurs : quels créneaux se cachent derrière deux repas est une décision produit ». Il est
 * remonté ici quand « Aujourd'hui » en a eu besoin à son tour ; deux copies auraient donné une
 * semaine et un écran du jour qui ne parlent pas des mêmes repas.
 *
 * ⚠️ ORDRE CHRONOLOGIQUE, PAS ORDRE DE SAISIE — `creneauDuMoment` prend le PREMIER créneau dont la
 * fenêtre (`FIN_DE_CRENEAU`) n'est pas close. Le goûter (17 h) doit donc venir APRÈS le déjeuner
 * (14 h), sans quoi il mangerait la fenêtre du déjeuner.
 */
const CRENEAUX_PAR_NOMBRE: Readonly<Record<number, readonly MealSlot[]>> = {
  1: ['diner'],
  2: ['dejeuner', 'diner'],
  3: ['petit_dejeuner', 'dejeuner', 'diner'],
  4: ['petit_dejeuner', 'dejeuner', 'gouter', 'diner'],
}

export const REPAS_PAR_DEFAUT = 2

/**
 * Heure à laquelle un créneau cesse d'être « le repas du moment ».
 *
 * Bornes larges et volontairement peu nombreuses : il s'agit de choisir quoi AFFICHER, pas de dire à
 * quelle heure manger. Une fenêtre trop serrée ferait clignoter l'écran d'un repas à l'autre autour
 * de midi, et l'application ne prescrit aucun horaire (§6.2 ARCHITECTURE).
 */
const FIN_DE_CRENEAU: Readonly<Record<MealSlot, number>> = {
  petit_dejeuner: 10,
  dejeuner: 14,
  gouter: 17,
  diner: 24,
}

/** Titres d'écran. Conversationnels, à la différence de `LIBELLE_CRENEAU` qui nomme la donnée. */
export const TITRE_CRENEAU: Readonly<Record<MealSlot, string>> = {
  petit_dejeuner: 'Ce matin',
  dejeuner: 'Ce midi',
  gouter: 'Pour le goûter',
  diner: 'Ce soir',
}

/**
 * Les créneaux d'un rythme déclaré. Un nombre hors bornes retombe sur le défaut plutôt que sur une
 * liste vide, qui donnerait un écran sans aucun repas à proposer.
 */
export function creneauxDuRythme(repasParJour: number): readonly MealSlot[] {
  return CRENEAUX_PAR_NOMBRE[repasParJour] ?? CRENEAUX_PAR_NOMBRE[REPAS_PAR_DEFAUT]!
}

/**
 * Le repas à montrer à `heure`, parmi ceux que l'utilisateur a prévus.
 *
 * Le premier créneau dont la fenêtre n'est pas encore close. Aucun ne convient (il est tard) → le
 * DERNIER repas du jour : à 23 h on regarde encore le dîner. Basculer sur le petit-déjeuner du
 * lendemain changerait la date affichée sans que personne l'ait demandé.
 */
export function creneauDuMoment(heure: number, creneaux: readonly MealSlot[]): MealSlot {
  const prochain = creneaux.find((creneau) => heure < FIN_DE_CRENEAU[creneau])
  return prochain ?? creneaux[creneaux.length - 1]!
}
