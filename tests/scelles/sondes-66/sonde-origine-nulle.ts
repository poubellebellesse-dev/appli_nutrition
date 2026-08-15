// SONDE 66b — L'ORIGINE PRÉSENTE MAIS NULLE. Doit être REFUSÉE, et le rester.
//
// ⛔ LA MOITIÉ SYMÉTRIQUE DE `sonde-provenance-nulle.ts`, ET ELLE A MANQUÉ D'ÊTRE OUBLIÉE. Le brief
// du 66b ne portait d'abord que la provenance ; une relecture indépendante a demandé « reste-t-il
// une quatrième façon de rouvrir le trou ? » et l'a trouvée en une ligne :
//
//     readonly origine: AnimalOrigin | null    // l'AUTRE champ, jamais exercé
//
// ⚠️ VÉRIFIÉ PAR MUTATION AVANT D'ÊTRE ÉCRIT, PAS DÉDUIT. Avec ce type posé dans `catalog.ts`, les
// **huit** tests d'alors — les six scellés du 66 et les deux du 66b — sont restés VERTS, pendant
// que `{ origine: null, provenance: 'corps' }` redevenait écrivable partout. Aucune des six sondes
// ne l'exerçait : elles mesuraient la clé `provenance` (présence, puis valeur) et la forme entière,
// jamais la VALEUR de `origine`.
//
// ⛔ LA LEÇON, PLUS CHÈRE QUE LA SONDE ELLE-MÊME : fermer un trou sur un champ ne dit RIEN de son
// jumeau. Le lot 66 a fermé la présence, le 66b a fermé la valeur d'un côté — et il a fallu qu'on
// demande explicitement « et l'autre côté ? » pour que la question se pose. Toute paire de champs
// se teste des DEUX côtés, ou elle n'est testée qu'à moitié.
//
// ⚠️ Elle échoue déjà aujourd'hui à compiler, et c'est normal : le type livré est juste. Elle
// n'achète aucun progrès, elle interdit une régression. Ne pas la réécrire pour la faire passer.

import type { Food } from '../../../app/src/engine/domain/catalog.js'
import type { FoodId, NutrientId } from '../../../app/src/engine/domain/ids.js'

export const laitOrigineNulle: Food = {
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
  // « On lui prend son corps, mais on ne sait pas de quel animal. » Les deux clés sont là ; le fait
  // ne l'est qu'à moitié. C'est exactement le défaut du 66, sur l'autre champ.
  origineAnimale: { origine: null, provenance: 'corps' },
  deriveDe: null,
}
