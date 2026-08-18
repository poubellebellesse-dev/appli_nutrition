// SONDE 66c — LA PAIRE AMPUTÉE DE L'AUTRE CÔTÉ. Doit être REFUSÉE.
//
// ⛔ LA QUATRIÈME CASE, ET PERSONNE NE LA VOYAIT. `sonde-paire-incomplete.ts` écrit
// `{ origine }` sans `provenance` — jamais l'inverse. La paire n'était donc testée que d'un
// côté sur l'axe PRÉSENCE depuis le lot 66. Avec
//
//     interface AnimalSource { origine?: AnimalOrigin; provenance: AnimalProvenance }
//                                     ^ optionnelle
//
// les NEUF tests scellés du 66 et du 66b restent VERTS, et le littéral ci-dessous compile :
// une source animale sans aucune origine. Mesuré, pas déduit — le relevé est en §8 du document.
//
// Le message de `tsc` doit nommer `origine`. Le test le vérifie.

import type { Food } from '../../../app/src/engine/domain/catalog.js'
import type { FoodId, NutrientId } from '../../../app/src/engine/domain/ids.js'

export const laitSansOrigine: Food = {
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
  // L'autre moitié de la paire. `provenance` sans `origine` ne dit pas de quel animal.
  origineAnimale: { provenance: 'production' },
  deriveDe: null,
}
