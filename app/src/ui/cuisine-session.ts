// ui/cuisine-session.ts — ce qu'une cuisson en cours PEUT AFFIRMER (§5bis point 7 ARCHITECTURE).
//
// ⚠️ CE MODULE EST PUR, et c'est délibéré. Il ne touche ni au DOM, ni à React, ni à SQLite : il
// transforme une échéance et un instant en une phrase vraie. C'est le seul endroit du mode cuisine
// où une erreur porterait sur de la NOURRITURE — « il reste 4 minutes » sur un plat qui cuit depuis
// quarante. Le rendre testable sans navigateur, c'est le rendre vérifiable.
//
// ⚠️ AUCUNE HORLOGE IMPLICITE. Toutes les fonctions reçoivent `maintenant` en paramètre. Un
// `Date.now()` caché rendrait ces règles intestables autrement qu'avec de faux timers, et c'est
// précisément la règle qu'on ne veut PAS vérifier à travers une couche de simulation.

import type { StoredCuisineTimer } from '../data/user-store.js'

/**
 * Au-delà, la cuisson n'est plus proposée à la reprise.
 *
 * ⚠️ SEUIL ARBITRAIRE, POSÉ FAUTE DE MIEUX (question D de `CONCEPTION_MODE_CUISINE.md` §8). Douze
 * heures couvrent « j'ai commencé le dîner, j'ai été interrompu, j'y reviens le lendemain matin »
 * sans jamais ressortir une cuisson de la semaine passée. À revoir au premier retour d'usage.
 */
export const PEREMPTION_CUISINE_MS = 12 * 60 * 60 * 1000

/** Une session trop vieille n'est pas effacée : elle cesse d'être PROPOSÉE. */
export function sessionPerimee(ouverteLe: number, maintenant: number): boolean {
  return maintenant - ouverteLe >= PEREMPTION_CUISINE_MS
}

/**
 * L'état d'un minuteur à un instant donné.
 *
 * ⚠️ `termine` PORTE SON ANCIENNETÉ, il ne se contente pas d'exister. C'est toute la différence
 * entre « ça vient de sonner » — ce qu'un décompte figé laisserait croire — et « terminé il y a
 * 38 minutes », qui est ce que l'utilisateur a besoin de savoir en rouvrant l'application.
 */
export type EtatMinuteur =
  | { readonly mode: 'marche'; readonly restantS: number }
  | { readonly mode: 'pause'; readonly restantS: number }
  | { readonly mode: 'termine'; readonly depuisS: number }

/**
 * ⚠️ UNE PAUSE EST LE SEUL CAS OÙ UN RESTE FIGÉ EST VRAI — parce que c'est l'utilisateur qui a
 * arrêté le temps. Partout ailleurs, seule l'échéance absolue dit la vérité.
 *
 * Le `restantS` en marche est arrondi au SUPÉRIEUR : un décompte qui affiche « 0 s » alors qu'il
 * reste 400 ms a déjà menti une fois.
 */
export function etatMinuteur(timer: StoredCuisineTimer, maintenant: number): EtatMinuteur {
  if (timer.pauseRestantS !== null) return { mode: 'pause', restantS: timer.pauseRestantS }
  // `finMs` est non nul dès que `pauseRestantS` l'est : le CHECK de la v10 l'impose. Le repli n'est
  // là que pour une base bricolée à la main, et il choisit le seul état qui ne promet rien.
  if (timer.finMs === null) return { mode: 'termine', depuisS: 0 }
  if (timer.finMs <= maintenant) {
    return { mode: 'termine', depuisS: Math.floor((maintenant - timer.finMs) / 1000) }
  }
  return { mode: 'marche', restantS: Math.ceil((timer.finMs - maintenant) / 1000) }
}

/** Une durée en secondes, telle qu'on la lit sur un minuteur : `7:05`, `12:00`, `0:09`. */
export function formaterDuree(secondes: number): string {
  const sures = Math.max(0, Math.floor(secondes))
  const minutes = Math.floor(sures / 60)
  return `${minutes}:${String(sures % 60).padStart(2, '0')}`
}

/**
 * La phrase affichée à côté d'une étape. C'est elle que lit quelqu'un qui rouvre l'application.
 *
 * ⚠️ « Terminé il y a N » ET JAMAIS « terminé » TOUT COURT. Sans l'ancienneté, un plat sorti du feu
 * depuis quarante minutes est indiscernable d'un plat qui vient de finir.
 */
export function libelleMinuteur(etat: EtatMinuteur): string {
  if (etat.mode === 'marche') return `il reste ${formaterDuree(etat.restantS)}`
  if (etat.mode === 'pause') return `en pause à ${formaterDuree(etat.restantS)}`
  return `terminé il y a ${formaterDuree(etat.depuisS)}`
}
