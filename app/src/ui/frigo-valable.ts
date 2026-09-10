// ui/frigo-valable.ts — ce que l'utilisateur a déclaré au frigo et qui vaut ENCORE (décisions 74 et 80).
//
// ⚠️ UNE DÉCLARATION VAUT POUR UN SEUL REPAS : celui que l'horloge désignait quand on l'a faite
// (`creneauDuMoment`, heure LOCALE, rythme déclaré), le même jour local. Elle s'efface sans geste à
// la fin de ce repas. Il n'y a plus de confirmation « vous les avez toujours ? » : une déclaration
// dont le repas est fini ne vaut plus rien, et on ne demande pas de la reconfirmer.
//
// ⚠️ UNE SEULE RÈGLE, LUE PAR TOUS LES ÉCRANS. Frigo, Courses, « Choisir un plat », la fiche recette
// et Aujourd'hui passent par ici. Une purge logée dans l'écran Frigo seul laissait les quatre autres
// lire un aliment effacé — et un rythme lu par l'écran Frigo seul (2 repas par défaut ailleurs)
// laissait le riz de 9 h valoir pour midi chez qui prend trois repas.
//
// ⚠️ CE QUI EST STOCKÉ, C'EST L'INSTANT COMPLET (`declare_le`, ISO avec heure). Une date sans heure —
// la forme qu'ont écrite toutes les versions depuis la v8 — ne dit pas pour quel repas on a déclaré :
// elle ne vaut pour aucun, comme une ligne sans date. L'absence d'information n'est pas une information.
//
// Ce module ne lit PAS l'horloge : `maintenant` est injecté par l'écran, comme dans `creneau.ts`.

import type { FoodId, MealSlot } from '../engine/domain/index.js'
import type { UserDb } from '../data/user-db.js'
import { readPantryEntries, readRythme, type StoredPantryEntry } from '../data/user-store.js'
import { REPAS_PAR_DEFAUT, creneauDuMoment, creneauxDuRythme } from './creneau.js'

/** Le repas désigné par un instant : un jour LOCAL (`AAAA-MM-JJ`) et un créneau du rythme. */
export interface Repas {
  readonly jour: string
  readonly creneau: MealSlot
}

/** « Valable pour ce midi » — la portée de la déclaration, dite sur l'écran Frigo. */
export const PORTEE_CRENEAU: Readonly<Record<MealSlot, string>> = {
  petit_dejeuner: 'ce matin',
  dejeuner: 'ce midi',
  gouter: 'le goûter',
  diner: 'ce soir',
}

/** Les créneaux du rythme DÉCLARÉ — le défaut seulement quand rien n'a été déclaré. */
export function creneauxDeclares(db: UserDb): readonly MealSlot[] {
  return creneauxDuRythme(readRythme(db)?.repasParJour ?? REPAS_PAR_DEFAUT)
}

/** Le jour LOCAL d'un instant. Pas `toISOString`, qui rend le jour UTC : à 0 h 30 à Paris, la veille. */
function jourLocal(instant: Date): string {
  const mois = String(instant.getMonth() + 1).padStart(2, '0')
  const jour = String(instant.getDate()).padStart(2, '0')
  return `${instant.getFullYear()}-${mois}-${jour}`
}

export function repasDeLInstant(instant: Date, creneaux: readonly MealSlot[]): Repas {
  return { jour: jourLocal(instant), creneau: creneauDuMoment(instant.getHours(), creneaux) }
}

/**
 * Vrai si `declareLe` désigne le même repas que `maintenant`.
 *
 * ⚠️ UN INSTANT COMPLET EST EXIGÉ. `new Date('2026-09-10')` se lit minuit UTC, soit 2 h à Paris : une
 * date seule deviendrait « déclarée pour le petit-déjeuner, ou le déjeuner » selon le fuseau.
 */
export function declarationValable(
  declareLe: string | undefined,
  maintenant: Date,
  creneaux: readonly MealSlot[]
): boolean {
  if (declareLe === undefined || !/^\d{4}-\d{2}-\d{2}T/.test(declareLe)) return false
  const instant = new Date(declareLe)
  if (Number.isNaN(instant.getTime())) return false
  const declare = repasDeLInstant(instant, creneaux)
  const courant = repasDeLInstant(maintenant, creneaux)
  return declare.jour === courant.jour && declare.creneau === courant.creneau
}

/** Les lignes du frigo qui valent encore à `maintenant`, instants compris. */
export function entreesValables(db: UserDb, maintenant: Date): readonly StoredPantryEntry[] {
  const creneaux = creneauxDeclares(db)
  return readPantryEntries(db).filter((e) => declarationValable(e.declareLe, maintenant, creneaux))
}

/** Les aliments du frigo qui valent encore à `maintenant`. */
export function alimentsValables(db: UserDb, maintenant: Date): readonly FoodId[] {
  return entreesValables(db, maintenant).map((e) => e.foodId)
}

/** Le repas en cours à `maintenant` — le seul pour lequel le frigo vaut. */
export function repasEnCours(db: UserDb, maintenant: Date): Repas {
  return repasDeLInstant(maintenant, creneauxDeclares(db))
}
