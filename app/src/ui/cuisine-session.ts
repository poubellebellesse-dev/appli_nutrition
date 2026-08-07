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
//
// ⚠️ L'IMPORT DE `alarme.js` NE CASSE PAS LA PURETÉ, et il est délibéré. Son sommet de module est
// inerte — que des déclarations — et rien n'est appelé ici : seule la CONSTANTE `ARRET_AUTO_MS`
// traverse. Elle est importée plutôt que recopiée parce que l'égalité des deux nombres est une
// vraie dépendance et non une coïncidence (voir `sonnerieEncoreJuste`) ; deux exemplaires
// divergeraient le jour où l'un des deux bougerait.

import type { StoredCuisineSession, StoredCuisineTimer } from '../data/user-store.js'
import { ARRET_AUTO_MS } from './alarme.js'

/**
 * Délai au-delà duquel la cuisson n'est plus proposée à la reprise — compté depuis la dernière
 * chose qui s'y passait, pas depuis son ouverture (voir `fraicheurDe`).
 *
 * Douze heures couvrent « j'ai commencé le dîner, j'ai été interrompu, j'y reviens le lendemain
 * matin » sans jamais ressortir une cuisson de la semaine passée.
 */
export const PEREMPTION_CUISINE_MS = 12 * 60 * 60 * 1000

/**
 * L'instant depuis lequel on compte l'oubli : l'ouverture, ou la fin du dernier minuteur si elle est
 * plus tardive.
 *
 * ⛔ MESURER DEPUIS `ouverteLe` SEUL ÉTAIT UN DÉFAUT, ET LE CATALOGUE LE PROUVAIT. `coq-au-vin` fait
 * mariner 43 200 s — exactement `PEREMPTION_CUISINE_MS`. Une marinade lancée à 20 h aboutissait à
 * 8 h, et la session était périmée à 8 h : l'appli larguait la cuisson à la seconde même où elle
 * avait quelque chose à annoncer. Le seuil n'était pas le problème, le point de référence l'était
 * (question D de `CONCEPTION_MODE_CUISINE.md` §8).
 *
 * ⚠️ CONSÉQUENCE DURE, ET C'EST ELLE QU'ON VOULAIT : un minuteur qui n'a pas fini rend sa session
 * IMPÉRISSABLE, quel que soit son âge. Son échéance est dans l'avenir, donc l'écart est négatif.
 *
 * ⚠️ UNE PAUSE NE PROLONGE RIEN. Elle ne porte pas d'échéance (`finMs` est nul), donc elle n'a rien
 * à repousser — sinon une cuisson mise en pause et oubliée resterait proposée pour toujours.
 */
function fraicheurDe(session: StoredCuisineSession): number {
  let reference = session.ouverteLe
  for (const t of session.minuteurs) {
    if (t.finMs !== null && t.finMs > reference) reference = t.finMs
  }
  return reference
}

/** Une session trop vieille n'est pas effacée : elle cesse d'être PROPOSÉE. */
export function sessionPerimee(session: StoredCuisineSession, maintenant: number): boolean {
  return maintenant - fraicheurDe(session) >= PEREMPTION_CUISINE_MS
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

/**
 * Une durée en secondes, telle qu'on la lit sur un minuteur : `7:05`, `0:09` — et `2 h 05`, `12 h 00`
 * au-delà de l'heure.
 *
 * ⛔ LE FORMAT `mm:ss` SEUL A ÉTÉ UN DÉFAUT VISIBLE À L'ÉCRAN. 22 recettes portent un minuteur de
 * plus d'une heure ; sur `coq-au-vin` (43 200 s), le bouton annonçait « Lancer le minuteur (720:00) »
 * et le décompte affichait « 719:59 ». Un test l'entérinait même : il attendait `3600 → '60:00'`.
 *
 * ⚠️ AU-DESSUS DE L'HEURE, L'UNITÉ EST ÉCRITE ET LES SECONDES TOMBENT. Deux raisons, et la première
 * suffit : une chaîne à deux-points **se lit comme des minutes** quand on y jette un œil, ce qui est
 * exactement l'usage de cet écran — `12:00:00` ne diffère de `12:00` que par un suffixe qu'on rate de
 * loin, là où `12 h 00` ne peut pas être mal lu. Et le chiffre des secondes d'une marinade n'est lu
 * par personne : l'afficher ferait clignoter un `2,2 rem` en `tabular-nums` 3 600 fois pour rien.
 */
export function formaterDuree(secondes: number): string {
  const sures = Math.max(0, Math.floor(secondes))
  if (sures >= 3600) {
    const heures = Math.floor(sures / 3600)
    return `${heures} h ${String(Math.floor((sures % 3600) / 60)).padStart(2, '0')}`
  }
  return `${Math.floor(sures / 60)}:${String(sures % 60).padStart(2, '0')}`
}

/**
 * Une sonnerie doit-elle encore retentir pour un minuteur terminé depuis `depuisS` secondes ?
 *
 * ⛔ LA BONNE QUESTION N'EST PAS « L'ÉCRAN VIENT-IL D'ÊTRE MONTÉ », C'EST « EST-CE ENCORE VRAI ».
 * Le garde-fou d'origine semait un `Set` des minuteurs échus AU MONTAGE, ce qui laissait deux trous
 * opposés, tous deux hors de portée de `jsdom` :
 *   - **revenir d'arrière-plan sans démontage** — téléphone en poche quarante minutes, le battement
 *     de seconde reprend, le minuteur devient `termine` sans avoir été semé : **ça sonnait**, et
 *     pour un plat sorti du feu depuis quarante minutes. Le mensonge du point 7, par l'autre porte ;
 *   - **fermer et rouvrir trois secondes après l'échéance** — le semis l'attrapait et **supprimait
 *     la sonnerie sans un mot**, alors qu'elle venait littéralement d'arriver.
 * Aucun seuil ne séparait les deux cas parce qu'il n'y avait pas de seuil du tout.
 *
 * ⚠️ LE SEUIL N'EST PAS INVENTÉ — c'est `ARRET_AUTO_MS`, et le MÊME SYMBOLE exprès. La règle se lit
 * « l'alarme serait-elle ENCORE en train de sonner si quelqu'un avait été là ? » : en deçà oui, donc
 * sonner ne fait que reprendre ce qui aurait eu lieu ; au-delà elle aurait déjà renoncé toute seule,
 * et partir maintenant annoncerait comme frais un événement qui ne l'est plus.
 */
export function sonnerieEncoreJuste(depuisS: number): boolean {
  return depuisS * 1000 < ARRET_AUTO_MS
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
