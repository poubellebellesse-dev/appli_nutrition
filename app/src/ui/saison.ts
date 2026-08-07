// ui/saison.ts — rendre `Food.saisonMois` en français lisible.
//
// ⚠️ DES PLAGES, PAS UNE ÉNUMÉRATION. « de novembre à mars » se lit d'un coup d'œil ;
// « janvier, février, mars, novembre, décembre » demande de reconstruire mentalement la même
// information, et c'est précisément la liste que produit un légume d'hiver — le cas le plus
// fréquent du catalogue, pas un cas limite.
//
// ⚠️ L'ANNÉE BOUCLE. Une saison qui enjambe décembre arrive dans le tableau comme deux morceaux
// séparés ([1,2,3] et [11,12]) : les recoller est la seule raison d'être de ce fichier. Sans ce
// recollement, l'endive s'affichait « de janvier à mars et de novembre à décembre ».
//
// ⚠️ CE MODULE NE DIT JAMAIS « hors saison ». Il décrit ce que le catalogue déclare ; juger qu'un
// aliment est au mauvais moment appartient au moteur (couche `season`), et le dire à l'écran
// serait un jugement sur un achat déjà fait — principe 6.

import type { Month } from '../engine/domain/index.js'

const NOM_DU_MOIS: Readonly<Record<Month, string>> = {
  1: 'janvier',
  2: 'février',
  3: 'mars',
  4: 'avril',
  5: 'mai',
  6: 'juin',
  7: 'juillet',
  8: 'août',
  9: 'septembre',
  10: 'octobre',
  11: 'novembre',
  12: 'décembre',
}

/** Plage de mois consécutifs, bornes incluses. `debut > fin` est légitime : la plage enjambe l'année. */
interface Plage {
  readonly debut: Month
  readonly fin: Month
}

/**
 * Découpe un ensemble de mois en plages consécutives, en recollant celle qui enjambe décembre.
 *
 * Exporté pour le test : c'est la seule partie qui a des cas limites, et les vérifier à travers la
 * chaîne de caractères finale rendrait les échecs illisibles.
 */
export function plagesDeSaison(mois: readonly Month[]): readonly Plage[] {
  // Dédoublonner AVANT de trier : le catalogue est construit, mais cette fonction sert aussi des
  // données importées (recette partagée), où un mois répété ferait une plage fantôme de longueur 0.
  const tries = [...new Set(mois)].sort((a, b) => a - b)
  if (tries.length === 0) return []
  if (tries.length === 12) return [{ debut: 1, fin: 12 }]

  const plages: Plage[] = []
  let debut = tries[0] as Month
  let precedent = debut
  for (const m of tries.slice(1)) {
    if (m !== precedent + 1) {
      plages.push({ debut, fin: precedent })
      debut = m
    }
    precedent = m
  }
  plages.push({ debut, fin: precedent })

  // Le recollement de fin d'année : si la première plage commence en janvier et la dernière finit en
  // décembre, elles n'en font qu'une, à cheval. Deux plages minimum — sinon [1..12] serait « recollé »
  // avec lui-même, ce que le raccourci ci-dessus a déjà écarté.
  if (plages.length >= 2) {
    const premiere = plages[0] as Plage
    const derniere = plages[plages.length - 1] as Plage
    if (premiere.debut === 1 && derniere.fin === 12) {
      return [{ debut: derniere.debut, fin: premiere.fin }, ...plages.slice(1, -1)]
    }
  }
  return plages
}

/**
 * Élision de la préposition — « d'avril », jamais « de avril ». Trois mois sur douze commencent par
 * une voyelle (avril, août, octobre) : assez pour que l'oubli se voie, trop peu pour tirer une
 * dépendance de linguistique. La liste des voyelles suffit ici parce que les douze noms sont connus
 * et qu'aucun ne commence par un h muet.
 */
function de(nomDuMois: string): string {
  return /^[aeiouâéèêîôû]/.test(nomDuMois) ? `d'${nomDuMois}` : `de ${nomDuMois}`
}

/**
 * `null` = saisonnalité non renseignée, ce qui n'est PAS « aucune saison » : c'est le cas des
 * denrées de fond de placard (pâtes, riz, huile, sel), que le catalogue laisse vides à dessein.
 * L'appelant doit se taire, pas afficher « jamais de saison ».
 */
export function texteSaison(mois: readonly Month[]): string | null {
  const plages = plagesDeSaison(mois)
  if (plages.length === 0) return null
  if (plages.length === 1 && plages[0]?.debut === 1 && plages[0]?.fin === 12) return "toute l'année"

  const morceaux = plages.map(({ debut, fin }) =>
    debut === fin ? `en ${NOM_DU_MOIS[debut]}` : `${de(NOM_DU_MOIS[debut])} à ${NOM_DU_MOIS[fin]}`
  )
  if (morceaux.length === 1) return morceaux[0] as string
  // « et » plutôt qu'une virgule sur le dernier morceau : c'est une phrase lue à voix haute par
  // certains lecteurs d'écran, pas une liste.
  return `${morceaux.slice(0, -1).join(', ')} et ${morceaux[morceaux.length - 1]}`
}
