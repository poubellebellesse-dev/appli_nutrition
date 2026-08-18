// SONDE 66c — LA CLÉ EST LÀ, LA VALEUR EST `undefined`. Doit être REFUSÉE.
//
// ⛔ CE N'EST PAS UN DOUBLON DE `sonde-origine-nulle.ts`, ET LA DIFFÉRENCE EST TOUT LE SUJET.
// Celle-là exerce `null`. Celle-ci exerce `undefined`, qui est un AUTRE type. Avec
//
//     readonly origine: AnimalOrigin | undefined      // clé REQUISE, valeur indéfinie
//
// `sonde-origine-nulle.ts` reste refusée (`null` n'est toujours pas assignable) et
// `sonde-origine-absente.ts` reste refusée aussi (la clé demeure obligatoire) : les deux gardes
// de l'origine tiennent, et le trou est quand même rouvert un cran à côté.
//
// ⚠️ MESURÉ : avec ce type, les NEUF tests scellés du 66 et du 66b restent VERTS.
// L'axe « présence / valeur nulle » que le 66b croyait exhaustif en oubliait un troisième.
//
// Le message de `tsc` doit nommer `undefined` et `AnimalOrigin`. Le test le vérifie.

import type { Food } from '../../../app/src/engine/domain/catalog.js'
import type { FoodId, NutrientId } from '../../../app/src/engine/domain/ids.js'

export const laitOrigineIndefinie: Food = {
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
  // La clé est écrite, et ne porte rien. C'est la même incohérence, orthographiée autrement.
  origineAnimale: { origine: undefined, provenance: 'production' },
  deriveDe: null,
}
