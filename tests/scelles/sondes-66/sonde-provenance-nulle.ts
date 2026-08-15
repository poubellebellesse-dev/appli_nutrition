// SONDE 66b — LA PROVENANCE PRÉSENTE MAIS NULLE. Doit être REFUSÉE, et le rester.
//
// ⛔ C'EST LE TROU QUE LES SIX TESTS SCELLÉS DU LOT 66 NE VOIENT PAS. Trouvé par une relecture
// indépendante APRÈS le sceau, vérifié sur banc isolé avant d'être écrit ici.
//
// Le lot 66 a rendu la moitié de paire inexprimable en supprimant le champ jumeau et en refusant
// l'origine nue. Il reste une troisième façon de rouvrir exactement le même trou, un cran plus bas :
//
//     readonly provenance: AnimalProvenance | null    // clé REQUISE, valeur NULLABLE
//
// ⚠️ ET AUCUNE DES CINQ AUTRES SONDES NE L'ATTRAPE, parce qu'elles mesurent toutes la PRÉSENCE de
// la clé, jamais sa VALEUR. TypeScript exige une clé requise même quand son type inclut `null` :
//   • `sonde-paire-incomplete.ts` (clé absente)  → toujours refusée sous l'hypothèse nullable ;
//   • `sonde-scalaire-nu.ts` (valeur scalaire)   → toujours refusée aussi ;
//   • `sonde-incoherente.ts` (l'ancien champ)    → toujours refusée aussi.
// **Les six tests scellés du 66 resteraient donc verts** pendant que le littéral ci-dessous
// redeviendrait écrivable partout dans le dépôt. Mesuré, pas supposé :
//
//     interface Source { readonly origine: …; readonly provenance: Prov | null }
//     { origine: 'mammifere' }                    → TS2741 refusé
//     'mammifere'                                 → TS2322 refusé
//     { origine: 'mammifere', provenance: null }  → COMPILE
//
// ⚠️ ELLE ÉCHOUE DÉJÀ AUJOURD'HUI À COMPILER, ET CE N'EST PAS UN DÉFAUT. Elle ne mesure aucun
// progrès : le type livré est déjà juste. Elle interdit une régression. Ce qui la rend utile est le
// jour où elle CESSERAIT d'échouer — c'est-à-dire le jour où quelqu'un assouplirait `provenance`
// pour faire passer un refactor, avec tous les autres voyants au vert.
//
// ⚠️ NE PAS LA RÉÉCRIRE POUR LA FAIRE PASSER. Sa forme EST le critère.

import type { Food } from '../../../app/src/engine/domain/catalog.js'
import type { FoodId, NutrientId } from '../../../app/src/engine/domain/ids.js'

export const laitProvenanceNulle: Food = {
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
  // La paire est COMPLÈTE au sens des clés, et vide au sens du fait. C'est tout le défaut.
  origineAnimale: { origine: 'mammifere', provenance: null },
  deriveDe: null,
}
