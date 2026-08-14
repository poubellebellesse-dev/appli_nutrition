// SONDE 66 — L'ANCIEN CHAMP JUMEAU. Doit CESSER de compiler après le lot.
//
// Elle porte la MOITIÉ « le champ a disparu » du lot : `provenanceAnimale` ne doit plus exister
// dans `Food`, et il faut que `tsc` le DISE. L'autre moitié — « une origine ne s'écrit plus sans sa
// provenance » — est portée par `sonde-paire-incomplete.ts` et `sonde-scalaire-nu.ts`.
//
// ⛔ CORRIGÉE APRÈS LE SCEAU, SUR DÉCISION EXPLICITE, ET VOICI POURQUOI. Elle déclarait d'abord les
// DEUX défauts sur le même objet : `origineAnimale: 'mammifere'` en plus de `provenanceAnimale`.
// Le premier masquait le second. **TypeScript signale l'erreur de TYPE sur une propriété connue et
// SUPPRIME l'erreur de propriété excédentaire du même littéral** — il ne rapportait donc que
// `Type 'string' is not assignable to type 'AnimalSource'`, sans jamais nommer le champ disparu.
// L'assertion « la sortie contient `provenanceAnimale` » était alors satisfaisable par la SEULE
// implémentation où `origineAnimale` garde son ancien type, c'est-à-dire celle que le lot existe
// pour interdire — et que `sonde-scalaire-nu.ts` refuse. Les deux tests s'excluaient.
//
// Mesuré sur banc isolé, hors du projet :
//     type CHANGÉ    + propriété en trop → TS2322: Type 'string' is not assignable to type 'Paire'
//     type INCHANGÉ  + propriété en trop → TS2561: ... 'champB' does not exist in type 'Cible'
//
// D'où la forme actuelle : `origineAnimale` reste VALIDE (`null`), et `provenanceAnimale` est le
// seul défaut. Rien ne masque plus rien, et `tsc` nomme le champ.
//
// ⚠️ NE PAS LUI REDONNER UNE `origineAnimale` FAUSSE. Ce serait remasquer le champ mesuré ici, et
// le test redeviendrait insatisfaisable sans que personne ne comprenne pourquoi.

import type { Food } from '../../../app/src/engine/domain/catalog.js'
import type { FoodId, NutrientId } from '../../../app/src/engine/domain/ids.js'

export const laitAuChampDisparu: Food = {
  id: 'lait_entier' as string as FoodId,
  codeCiqual: '19024',
  nom: 'Lait entier',
  synonymes: [],
  groupe: 'lait et produits laitiers',
  sousFamille: null,
  sousGroupe: null,
  nutrimentsPour100g: new Map<NutrientId, number>(),
  allergenes: [],
  saisonMois: [],
  touteAnnee: true,
  piquant: 0,
  poidsPieceG: null,
  fondDePlacard: false,
  quantiteFigee: false,
  conditionnementG: 1000,
  // Valide, et il FAUT qu'elle le reste : c'est ce qui laisse `tsc` arriver jusqu'à la ligne suivante.
  origineAnimale: null,
  // Le seul défaut de ce fichier. Le champ n'existe plus dans `Food` depuis le lot 66.
  provenanceAnimale: null,
  deriveDe: null,
}
