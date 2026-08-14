// SONDE 66 — L'ORIGINE SEULE, SANS PAIRE DU TOUT. Doit être REFUSÉE après le lot.
//
// ⛔ ELLE FERME LA SECONDE MOITIÉ DU MÊME TROU : élargir le type au lieu de le resserrer.
//
//     readonly origineAnimale: AnimalOrigin | AnimalSource | null   // « pour la compatibilité »
//
// Une union qui garde l'ancienne valeur scalaire à côté de la nouvelle paire ferait passer TOUTES
// les autres sondes — la paire complète est un membre valide de l'union, le champ
// `provenanceAnimale` a bien disparu — et laisserait écrire `origineAnimale: 'mammifere'` tout
// court, sans provenance, partout dans le dépôt. C'est le compromis qu'un codeur pressé de limiter
// la casse sur les 15 fichiers de test peut choisir sans s'en rendre compte.
//
// ⚠️ Cette sonde échoue DÉJÀ aujourd'hui, et ce n'est pas un défaut : elle ne mesure pas un progrès,
// elle interdit une régression. Ce qui la rend utile est le cas où elle CESSERAIT d'échouer.

import type { Food } from '../../../app/src/engine/domain/catalog.js'
import type { FoodId, NutrientId } from '../../../app/src/engine/domain/ids.js'

export const laitScalaire: Food = {
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
  // L'ancienne valeur nue, sans son champ jumeau. Plus rien ne doit l'accepter.
  origineAnimale: 'mammifere',
  deriveDe: null,
}
