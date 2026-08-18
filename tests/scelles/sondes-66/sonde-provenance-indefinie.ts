// SONDE 66c — LA MÊME, SUR LE CHAMP JUMEAU. Doit être REFUSÉE.
//
// ⛔ ELLE EXISTE PARCE QUE LA LEÇON A DÉJÀ ÉTÉ PAYÉE TROIS FOIS : fermer un trou sur un champ ne
// dit RIEN de son jumeau. Le document déclarait la provenance close sur les deux axes ; la mesure
// dit non — il y en avait un troisième, et il est ouvert des DEUX côtés :
//
//     readonly provenance: AnimalProvenance | undefined
//
// ⚠️ MESURÉ : avec ce type, les NEUF tests scellés du 66 et du 66b restent VERTS.
// `sonde-provenance-nulle.ts` reste refusée (`null` ≠ `undefined`) et `sonde-paire-incomplete.ts`
// aussi (la clé reste obligatoire). Les deux gardes de la provenance tiennent, et le trou passe
// entre elles.
//
// Le message de `tsc` doit nommer `undefined` et `AnimalProvenance`. Le test le vérifie.

import type { Food } from '../../../app/src/engine/domain/catalog.js'
import type { FoodId, NutrientId } from '../../../app/src/engine/domain/ids.js'

export const boeufProvenanceIndefinie: Food = {
  id: 'boeuf_bourguignon_viande' as string as FoodId,
  codeCiqual: '6180',
  nom: 'Bœuf, morceau à braiser',
  synonymes: [],
  groupe: 'viandes, œufs, poissons',
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
  conditionnementG: 500,
  // `mammifere` sans `corps` ni `production` ne dit pas si c'est du bœuf ou du lait.
  origineAnimale: { origine: 'mammifere', provenance: undefined },
  deriveDe: null,
}
