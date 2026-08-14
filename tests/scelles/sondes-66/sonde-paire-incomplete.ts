// SONDE 66 — LA PAIRE NEUVE, MAIS AMPUTÉE. Doit être REFUSÉE après le lot.
//
// ⛔ CETTE SONDE FERME LE TROU LE PLUS PROFOND DES TROIS RELECTURES, trouvé à la troisième.
// Les trois premières sondes ne couvraient que deux situations : l'ANCIENNE forme incohérente
// (deux champs plats, l'un nul) et les formes NEUVES entièrement valides. Personne ne testait la
// forme neuve INCOMPLÈTE. Conséquence : une implémentation qui aurait écrit
//
//     interface AnimalSource { origine: AnimalOrigin; provenance?: AnimalProvenance }
//                                                               ^ optionnelle
//
// passait les cinq tests. `provenanceAnimale` avait bien disparu du dépôt, les sondes valides
// compilaient, la sonde incohérente était refusée — pour propriété EXCÉDENTAIRE, pas pour
// l'invariant — et le catalogue réel, qui n'a aucune donnée fausse, ne montrait rien.
// **On pouvait toujours écrire une origine sans provenance. C'est exactement ce que le lot existe
// pour rendre impossible.**
//
// Le message de `tsc` doit nommer `provenance`. Le test le vérifie.

import type { Food } from '../../../app/src/engine/domain/catalog.js'
import type { FoodId, NutrientId } from '../../../app/src/engine/domain/ids.js'

export const laitAmpute: Food = {
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
  // La moitié de la paire. C'est le défaut du lot, réécrit dans la forme d'après.
  origineAnimale: { origine: 'mammifere' },
  deriveDe: null,
}
