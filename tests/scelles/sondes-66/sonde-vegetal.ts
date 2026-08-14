// SONDE 66 — un aliment SANS aucune source animale. Doit compiler après le lot.
//
// Écrite dans la forme VISÉE : un seul champ `origineAnimale`, nul ici, et plus de
// `provenanceAnimale`. Elle échoue aujourd'hui parce que `provenanceAnimale` est encore un champ
// obligatoire du type — c'est ce qui fait de ce fichier un test scellé et non une décoration.
//
// ⛔ CETTE SONDE EST CELLE QUI TUE LA FAUSSE IMPLÉMENTATION LA PLUS TENTANTE : rendre les deux
// champs OBLIGATOIRES rendrait bien la paire incohérente inexprimable — et rendrait du même coup
// inexprimables les 284 aliments végétaux, minéraux et dérivés du catalogue. Sans elle, le critère
// de sortie se satisfait en cassant les trois quarts du catalogue.

import type { Food } from '../../../app/src/engine/domain/catalog.js'
import type { FoodId, NutrientId } from '../../../app/src/engine/domain/ids.js'

export const carotte: Food = {
  id: 'carotte' as string as FoodId,
  codeCiqual: '20009',
  nom: 'Carotte',
  synonymes: [],
  groupe: 'légumes',
  sousFamille: null,
  sousGroupe: null,
  nutrimentsPour100g: new Map<NutrientId, number>(),
  allergenes: [],
  saisonMois: [9, 10, 11],
  touteAnnee: false,
  piquant: 0,
  poidsPieceG: 120,
  fondDePlacard: false,
  quantiteFigee: false,
  conditionnementG: null,
  origineAnimale: null,
  deriveDe: null,
}
