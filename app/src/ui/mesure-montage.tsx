// ui/mesure-montage.tsx — le chronomètre de la décision 61, et RIEN D'AUTRE.
//
// POURQUOI CECI EXISTE. La décision 61 d'`ETAT.md` §4 attend depuis le 2026-08-06 une mesure du
// temps d'apparition de la liste de recettes SUR UN VRAI TÉLÉPHONE. Elle n'a jamais été prise, et
// pas par négligence : la prendre demandait un débogage USB depuis un Chrome de bureau, c'est-à-dire
// bien plus de préparation que le chiffre ne vaut. Ce fichier échange ce montage contre un drapeau
// d'URL et un nombre affiché à l'écran.
//
// ⛔ LE DRAPEAU EST DANS `location.search`, PAS DANS LE HASH, ET C'EST UN PIÈGE DÉJÀ ÉVITÉ.
// `#/recettes?perf` NE MARCHE PAS : `routeDepuisHash` (router.tsx) résout les onglets par
// correspondance EXACTE (`ONGLET_PAR_HASH.get(hash)`), donc un hash suffixé retombe silencieusement
// sur « Aujourd'hui ». On aurait chronométré le mauvais écran sans qu'aucun message ne le dise.
// La bonne forme est donc :
//
//     https://<hôte>/?perf#/recettes
//
// ⚠️ CE QU'ON MESURE EST « APRÈS PEINTURE », PAS « APRÈS COMMIT REACT ». Un `useEffect` seul rendrait
// la main avant que le navigateur ait posé un pixel — c'est exactement l'erreur que la 61 vient de
// payer une fois, en prenant un coût de harnais de test pour un coût de rendu. D'où les DEUX
// `requestAnimationFrame` imbriqués : le premier s'exécute avant la peinture de la frame courante,
// le second au début de la suivante, donc après. C'est l'approximation d'après-peinture disponible
// sans `PerformanceObserver`, et elle suffit largement à départager 150 ms de 800 ms.
//
// ⚠️ COÛT QUAND LE DRAPEAU EST ABSENT : une lecture de `location.search` au montage, et le composant
// rend `null`. Aucun `requestAnimationFrame`, aucun état, aucun rendu supplémentaire — l'écran ne
// paie rien pour un outil de diagnostic que personne n'a demandé.

import { useEffect, useState } from 'react'

/** Le drapeau est lu UNE FOIS, au chargement du module : il ne change pas en cours de session. */
const MESURE_DEMANDEE =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('perf')

export function mesureDemandee(): boolean {
  return MESURE_DEMANDEE
}

/**
 * Affiche le temps écoulé entre `depuis` et l'après-peinture du rendu courant.
 *
 * `depuis` est un `performance.now()` capté par l'appelant AU PREMIER RENDU — pas ici : ce composant
 * n'est monté qu'une fois l'écran prêt, il serait donc incapable de voir le début.
 *
 * ⚠️ `nbCartes` EST AFFICHÉ AVEC LE TEMPS, ET CE N'EST PAS DÉCORATIF. La 61 est une question de
 * CROISSANCE : un temps sans le nombre de cartes qui l'a produit ne se compare à rien, et c'est
 * précisément ce qui manquait aux relevés précédents.
 */
export function MesureMontage({
  depuis,
  nbCartes,
}: {
  readonly depuis: number
  readonly nbCartes: number
}) {
  const [ms, setMs] = useState<number | null>(null)

  useEffect(() => {
    if (!MESURE_DEMANDEE) return undefined
    let vivant = true
    // Double rAF : voir l'en-tête. Le premier tourne avant la peinture, le second après.
    const premier = requestAnimationFrame(() => {
      const second = requestAnimationFrame(() => {
        if (vivant) setMs(performance.now() - depuis)
      })
      void second
    })
    return () => {
      vivant = false
      cancelAnimationFrame(premier)
    }
  }, [depuis])

  if (!MESURE_DEMANDEE) return null

  return (
    <p
      // `role="status"` et pas une simple `<p>` : le nombre arrive APRÈS le rendu, un lecteur
      // d'écran ne le verrait jamais autrement. Coût nul quand le drapeau est absent — on ne rend
      // rien du tout dans ce cas.
      role="status"
      data-mesure-montage={ms === null ? 'en-cours' : ms.toFixed(0)}
      className="mt-2 rounded-[--radius-carte] border border-bordure bg-surface px-3 py-2 font-mono text-[0.95rem] text-texte"
    >
      {ms === null ? 'mesure en cours…' : `montage ${ms.toFixed(0)} ms · ${nbCartes} cartes`}
    </p>
  )
}
