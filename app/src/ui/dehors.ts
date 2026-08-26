// ui/dehors.ts — « je mange dehors » : le libellé posé sans frappe, et la mémoire qui permet de
// revenir en arrière (décision 76, lot `retour-3`).
//
// ⛔ POURQUOI UN MODULE PLUTÔT QU'UN `useState`. Défaire le geste demande de savoir quel plat
// occupait le créneau avant — une information que RIEN ne conserve. La décision 51 verrouille
// `hors_catalogue` à trois états et interdit un second champ ; la clause 8 du lot interdit la
// colonne neuve et la migration. Il ne reste donc ni la base, ni le champ de texte — qui est ce que
// l'utilisateur lit, pas un canal de stockage. Et un état de composant ne suffit pas non plus :
// l'écran Semaine se remonte à chaque navigation, et la mémoire disparaîtrait entre le geste et le
// regret. Reste la portée du module.
//
// ⚠️ CE QUE ÇA COÛTE, ET C'EST ASSUMÉ : la mémoire meurt au RECHARGEMENT de l'application. Le
// retour en arrière est une commodité de session, pas une garantie. Après un rechargement,
// l'étiquette reste, le bouton d'annulation disparaît, et « Changer » comme « Choisir » restent les
// portes de sortie. C'est la seule réponse possible sans écrire dans la base.
import type { MealPlanEntry, RecipeId, SlotRef } from '../engine/domain/index.js'

/**
 * Le libellé posé par le geste court, sans rien demander.
 *
 * ⚠️ IL CONTIENT LE MOT « DEHORS » PARCE QUE C'EST CE QUE L'UTILISATEUR A DIT, pas parce qu'un test
 * l'exige. C'est aussi ce qu'il relira sur la carte dans trois jours, quand il aura oublié pourquoi
 * ce créneau est différent. Qui veut être plus précis — « Chez ma sœur », « cantine » — passe par
 * « Choisir » puis l'onglet « Un plat préparé », qui reste la porte d'édition du libellé.
 */
export const LIBELLE_DEHORS = 'Repas pris dehors'

const cle = (slot: SlotRef): string => `${slot.date}|${slot.creneau}`

/** Quel plat occupait le créneau avant qu'on le marque. Vidée au rechargement de la page. */
const platsDAvant = new Map<string, RecipeId>()

/**
 * Retient le plat qu'on est en train de remplacer — et seulement s'il est RESTITUABLE à l'identique.
 *
 * Un créneau vide n'a rien à retenir. ⛔ UN RESTE NON PLUS, ET C'EST VOLONTAIRE : le moteur repose
 * un créneau avec les portions du catalogue et sans marque de reste (voir `reposerLeCreneau`).
 * Rendre un reste par ce chemin le ferait revenir en plat NEUF, à portions pleines, et la liste de
 * courses se mettrait à réclamer les ingrédients d'un plat déjà cuisiné la veille. Tant qu'on ne
 * sait pas rendre le créneau exactement tel qu'il était, on ne propose pas de le rendre : « Changer »
 * et « Choisir » restent les portes de sortie, et elles ne mentent pas sur ce qu'elles font.
 */
export function retenirLePlat(slot: SlotRef, entree: MealPlanEntry | undefined): void {
  if (entree === undefined || entree.recipeId === null || entree.isLeftover) {
    platsDAvant.delete(cle(slot))
    return
  }
  platsDAvant.set(cle(slot), entree.recipeId)
}

/** Le plat à rendre si l'utilisateur se ravise, ou `null` s'il n'y en a plus en mémoire. */
export function platDAvant(slot: SlotRef): RecipeId | null {
  return platsDAvant.get(cle(slot)) ?? null
}

/** Après un retour en arrière, ou après tout autre geste qui repose le créneau. */
export function oublierLePlat(slot: SlotRef): void {
  platsDAvant.delete(cle(slot))
}
