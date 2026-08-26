// ui/restes.ts — la mémoire du geste « manger un reste » (décision 78, lot `retour-4`).
//
// ⛔ POURQUOI UN MODULE PLUTÔT QU'UN `useState`, EXACTEMENT COMME `ui/dehors.ts`. Défaire le geste
// demande deux choses qu'un plan ne dit plus une fois le geste posé : quel plat occupait le créneau
// avant, et si le créneau de la CUISSON était déjà gardé. Le second point n'est pas un détail —
// poser un reste verrouille aussi la cuisson (voir `engine/planning/set-slot-leftover.ts`), et
// relâcher ce verrou à l'aveugle retirerait un verrou que l'utilisateur avait peut-être mis
// lui-même. Un état de composant ne suffit pas : l'écran Semaine se remonte à chaque navigation, et
// la mémoire disparaîtrait entre le geste et le regret. Reste la portée du module.
//
// ⚠️ CE QUE ÇA COÛTE, ET C'EST ASSUMÉ, comme pour « je mange dehors » : la mémoire meurt au
// RECHARGEMENT de l'application. Le retour en arrière est une commodité de session, pas une
// garantie. Après un rechargement, le reste reste, le bouton d'annulation disparaît, et « Relâcher »
// puis « Changer » ou « Choisir » restent les portes de sortie. La seule alternative serait une
// colonne de plus dans `meal_plan_entry`, donc une migration, pour défaire un geste qui se refait en
// deux clics.
import type { SlotRef } from '../engine/domain/index.js'
import type { ResteDefait } from '../engine/planning/set-slot-leftover.js'

const cle = (slot: SlotRef): string => `${slot.date}|${slot.creneau}`

/** Ce que chaque créneau transformé en reste doit rendre si l'utilisateur se ravise. */
const gestes = new Map<string, ResteDefait>()

/**
 * Retient les DEUX entrées que le geste va modifier, telles qu'elles sont AVANT lui.
 *
 * ⚠️ Appelée avant l'écriture, sinon il n'y a plus rien à retenir après : le créneau porte déjà le
 * reste, et le créneau de cuisson porte déjà le verrou qu'on cherche justement à savoir rendre.
 */
export function retenirLeGeste(slot: SlotRef, memoire: ResteDefait): void {
  gestes.set(cle(slot), memoire)
}

/** Ce qu'il faut pour défaire le geste posé sur ce créneau, ou `null` s'il n'y en a plus. */
export function gestePrecedent(slot: SlotRef): ResteDefait | null {
  return gestes.get(cle(slot)) ?? null
}

/** Après un retour en arrière, ou après tout autre geste qui repose le créneau. */
export function oublierLeGeste(slot: SlotRef): void {
  gestes.delete(cle(slot))
}

/**
 * Après une RECOMPOSITION de la semaine : plus une seule mémoire ne vaut.
 *
 * ⚠️ Ce n'est pas de la prudence. La mémoire retient le plat qu'un créneau portait avant le
 * geste ; après une recomposition ce plat a été reposé ailleurs dans la semaine, et le rendre le
 * poserait DEUX fois. Le reste, lui, survit — ses deux créneaux sont gardés —, seul le raccourci
 * pour le défaire disparaît.
 */
export function oublierTousLesGestes(): void {
  gestes.clear()
}
