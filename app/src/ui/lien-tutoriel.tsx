// ui/lien-tutoriel.tsx — l'entrée discrète « Comment ça marche ? », partagée par les sept écrans qui
// ont un parcours (`ui/parcours.ts`).
//
// ⚠️ UN SEUL COMPOSANT, jamais huit conditions écrites en dur dans chaque écran : c'est exactement le
// genre de duplication qui diverge au premier écran oublié. L'identifiant du parcours est passé
// EXPLICITEMENT par l'écran plutôt que déduit de la route courante (`parcoursDeLEcran`) : chaque
// écran sait déjà quel est SON parcours, le lui faire redéduire de sa propre route ajouterait un
// aller-retour pour rien.

// ⚠️ `ParcoursId` ET NON `string` : une faute de frappe dans l'écran appelant rendrait un bouton
// parfaitement normal qui ne ferait RIEN au toucher, et aucun test d'écran ne le verrait. L'union
// littérale en fait une erreur de compilation — voir sa déclaration dans `parcours.ts`.
import { useLancerParcours } from './lancer-parcours.js'
import type { ParcoursId } from './parcours.js'

export function LienTutoriel({ parcoursId }: { readonly parcoursId: ParcoursId }) {
  const lancerParcours = useLancerParcours()
  return (
    <button
      type="button"
      onClick={() => lancerParcours(parcoursId)}
      className="mt-1 flex min-h-tactile items-center text-courant font-medium text-accent-texte underline"
    >
      Comment ça marche ?
    </button>
  )
}
