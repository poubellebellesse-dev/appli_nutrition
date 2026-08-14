// SONDE 66 — un aliment animal COMPLET. Doit compiler après le lot.
//
// Écrite dans la forme visée : `origineAnimale` porte la paire entière, indissociable.
//
// ⛔ ELLE TUE LA DEUXIÈME FAUSSE IMPLÉMENTATION : supprimer purement et simplement l'origine
// animale du type. La paire incohérente deviendrait inexprimable — parce que plus rien ne serait
// exprimable. Les 167 aliments à source animale du catalogue doivent continuer de se dire.
//
// ⚠️ `production` et non `corps` : c'est le lait, pas la vache. Les deux valeurs doivent rester
// écrivables, sans quoi la moitié du vocabulaire disparaît sans que rien ne rougisse.

import type { Food } from '../../../app/src/engine/domain/catalog.js'
import type { FoodId, NutrientId } from '../../../app/src/engine/domain/ids.js'

export const laitEntier: Food = {
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
  origineAnimale: { origine: 'mammifere', provenance: 'production' },
  deriveDe: null,
}

// Le corps de l'animal, et non sa production — l'autre moitié du vocabulaire.
export const filetCabillaud: Food = {
  ...laitEntier,
  id: 'cabillaud' as string as FoodId,
  codeCiqual: '26014',
  nom: 'Cabillaud',
  groupe: 'poissons',
  conditionnementG: null,
  origineAnimale: { origine: 'poisson', provenance: 'corps' },
}
