// ui/lancer-parcours.tsx — contexte React minuscule qui expose `lancerParcours(id)` aux écrans.
//
// ⚠️ C'EST UN MOTIF NOUVEAU DANS CETTE BASE, ET IL N'EST PAS À GÉNÉRALISER. `main.tsx` ne
// connaissait qu'UN SEUL écran capable de lancer une visite (`Parametres`, via un prop
// `onLancerVisite`) ; avec sept écrans qui doivent chacun lancer LE LEUR, faire descendre le même
// callback à travers `Ecran` (`main.tsx`) alourdirait la signature de sept composants d'un prop
// qu'ils ne feraient que retransmettre à un enfant. Un contexte minuscule, réservé À CE SEUL besoin,
// est le moindre mal des deux — aucun autre état de l'application ne doit passer par ce mécanisme.
//
// Posé par `main.tsx` (le seul à connaître `etapeVisite` et la navigation qui peut le précéder, voir
// son en-tête), consommé par les écrans via `useLancerParcours()`.

import { createContext, useContext } from 'react'

const ContexteLancerParcours = createContext<((id: string) => void) | null>(null)

export const ProvenanceLancerParcours = ContexteLancerParcours.Provider

/** `lancerParcours(id)`. Lève hors du provider : un écran qui l'utilise sans être monté sous
 *  `<Coquille>` (`main.tsx`) est un défaut de câblage, pas un cas à tolérer silencieusement. */
export function useLancerParcours(): (id: string) => void {
  const lancer = useContext(ContexteLancerParcours)
  if (lancer === null) {
    throw new Error('useLancerParcours() doit être utilisé sous ProvenanceLancerParcours (main.tsx)')
  }
  return lancer
}
