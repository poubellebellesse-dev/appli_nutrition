// ui/notifications.ts — poser les rappels sur l'appareil.
//
// ⚠️ TOUT CE FICHIER EST INERTE DANS UN NAVIGATEUR, et c'est le comportement correct, pas une
// limitation qu'on contourne. Il n'existe AUCUNE API web de notification programmée : *Notification
// Triggers* a été abandonnée par Google, et le push exigerait un serveur — donc un compte, donc la
// fin du « 100 % local » (§2 STRATEGIE_DISTRIBUTION). Hors conteneur natif, `disponible` est faux et
// rien n'est programmé. L'application ne promet donc jamais un rappel qu'elle ne peut pas tenir.
//
// ⚠️ LE CALCUL DES INSTANTS N'EST PAS ICI. Il vit dans `ui/rappel.ts`, pur et testé minute par
// minute. Ce fichier ne fait que parler à la plateforme — c'est la seule partie qu'on ne peut pas
// vérifier sans appareil, et elle est donc réduite au strict minimum.

import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { Rappel } from './rappel.js'

export interface EtatNotifications {
  /** Un conteneur natif est présent. Faux dans tout navigateur, y compris une PWA installée. */
  readonly disponible: boolean
  /** L'utilisateur a accordé la permission système. */
  readonly autorise: boolean
}

/** Le conteneur natif est-il là ? Toute la suite en dépend. */
function enNatif(): boolean {
  return Capacitor.isNativePlatform()
}

export async function etatNotifications(): Promise<EtatNotifications> {
  if (!enNatif()) return { disponible: false, autorise: false }
  try {
    const { display } = await LocalNotifications.checkPermissions()
    return { disponible: true, autorise: display === 'granted' }
  } catch {
    // Une plateforme native sans le plugin (build incomplet) ne doit pas casser l'écran Paramètres.
    return { disponible: false, autorise: false }
  }
}

/**
 * Demande la permission système. Rend ce qui a réellement été accordé — jamais ce qu'on espérait.
 *
 * ⚠️ APPELÉ SUR UN GESTE DE L'UTILISATEUR, jamais au démarrage. Une invite de permission qui
 * surgit avant qu'on ait rien demandé se solde par un refus, et un refus ne se redemande pas.
 */
export async function demanderAutorisation(): Promise<boolean> {
  if (!enNatif()) return false
  try {
    const { display } = await LocalNotifications.requestPermissions()
    return display === 'granted'
  } catch {
    return false
  }
}

/**
 * Remplace TOUS les rappels par ceux passés en argument.
 *
 * ⚠️ ON ANNULE AVANT DE REPROGRAMMER, sans chercher le delta. Le plan de la semaine change en bloc
 * — « Proposer une autre semaine » réécrit tout — et un ordonnanceur qui accumulerait les anciens
 * rappels ferait sonner l'appareil pour des plats qui ne sont plus au programme. La comparaison
 * fine coûterait un état supplémentaire à tenir synchronisé, pour un gain nul.
 *
 * Les identifiants sont l'index dans la liste, qui est triée chronologiquement (`rappelsDuPlan`) :
 * ils sont donc reproductibles d'une reprogrammation à l'autre.
 */
export async function reprogrammer(rappels: readonly Rappel[]): Promise<void> {
  if (!enNatif()) return
  try {
    await toutAnnuler()
    if (rappels.length === 0) return
    await LocalNotifications.schedule({
      notifications: rappels.map((rappel, index) => ({
        // `id` doit être un entier non nul côté Android.
        id: index + 1,
        title: rappel.titre,
        body: rappel.texte,
        schedule: { at: new Date(rappel.quandMs), allowWhileIdle: true },
      })),
    })
  } catch {
    // Programmer un rappel est un CONFORT. Si la plateforme refuse — permission révoquée entre
    // temps, quota atteint — l'application continue de fonctionner exactement pareil.
  }
}

export async function toutAnnuler(): Promise<void> {
  if (!enNatif()) return
  try {
    const { notifications } = await LocalNotifications.getPending()
    if (notifications.length > 0) await LocalNotifications.cancel({ notifications })
  } catch {
    /* voir `reprogrammer` */
  }
}
