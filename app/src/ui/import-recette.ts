// ui/import-recette.ts — lecteur du format `.nutri-recipe` (§8.7 ARCHITECTURE : « Partage P2P »).
//
// Contrepartie de `export-recette.ts` : un fichier qu'`exporterRecette` a produit doit se relire
// ici, sinon l'export n'est qu'une sauvegarde que personne d'autre ne peut ouvrir (voir son en-tête).
//
// ⚠️ PÉRIMÈTRE : le fichier `.nutri-recipe` UNIQUEMENT. §8.7 décrit aussi un import depuis une URL
// par analyse du JSON-LD schema.org — hors périmètre, rien n'en est ébauché ici.
//
// ⚠️ LES TROIS DANGERS DE CE MODULE, DANS L'ORDRE DE GRAVITÉ :
//
//  1. UN `foodId` INCONNU CASSE LA GARANTIE ALLERGÈNE. `versRecette` (data/user-recipe.ts) ignore
//     silencieusement un ingrédient dont l'id n'est pas au catalogue local — il reste dans la
//     recette mais n'apporte AUCUN allergène. Une recette important un aliment inconnu paraîtrait
//     alors sûre à `runExclusionPass`, un faux négatif exactement sur la promesse centrale du
//     produit. On REFUSE l'import si un seul `foodId` est inconnu, jamais une correspondance par nom.
//
//  2. L'ID DU FICHIER N'EST JAMAIS REPRIS. `saveUserRecipe` fait un `INSERT … ON CONFLICT(id) DO
//     UPDATE` : reprendre l'id du fichier écraserait en silence une recette déjà enregistrée sous
//     cet id. `nouvelId` est donc fourni par l'appelant (même contrat que `nouvelIdRecette`, l'horloge
//     et l'aléa s'injectent) et REMPLACE systématiquement l'id lu dans le fichier.
//
//  3. LE FICHIER EST UNE ENTRÉE NON FIABLE. `analyserAvecMotif` (data/user-recipe.ts) porte déjà la
//     validation du JSON, de `schemaVersion` et des champs obligatoires pour la relecture depuis
//     SQLite — on la réutilise plutôt que d'en écrire une seconde qui divergerait. Ce module y ajoute
//     seulement ce qui est spécifique à un fichier externe : la forme de chaque ingrédient et
//     l'existence de son `foodId` au catalogue.

import type { Catalog, FoodId } from '../engine/domain/index.js'
import { analyserAvecMotif, type StoredUserRecipe } from '../data/user-recipe.js'

export type ResultatImport =
  | { readonly ok: true; readonly recette: StoredUserRecipe }
  | { readonly ok: false; readonly raison: string }

/**
 * Lit le contenu d'un fichier `.nutri-recipe` et rend soit une recette prête à enregistrer sous
 * `nouvelId`, avec `source: 'importe'`, soit la raison exploitable à l'écran du refus.
 */
export function importerRecette(contenu: string, catalogue: Catalog, nouvelId: string): ResultatImport {
  const lu = analyserAvecMotif(contenu)
  if (!lu.ok) return lu

  const { recette } = lu

  for (const ingredient of recette.ingredients) {
    if (
      typeof ingredient !== 'object' ||
      ingredient === null ||
      typeof ingredient.foodId !== 'string' ||
      typeof ingredient.quantiteG !== 'number' ||
      !(ingredient.quantiteG > 0) ||
      typeof ingredient.uniteAffichage !== 'string' ||
      typeof ingredient.optionnel !== 'boolean'
    ) {
      return { ok: false, raison: 'Cette recette contient un ingrédient mal formé.' }
    }
  }

  const inconnu = recette.ingredients.find((i) => !catalogue.foods.has(i.foodId as FoodId))
  if (inconnu !== undefined) {
    return {
      ok: false,
      raison: `Cette recette utilise un ingrédient que votre catalogue ne connaît pas : ${inconnu.foodId}.`,
    }
  }

  return { ok: true, recette: { ...recette, id: nouvelId, source: 'importe' } }
}
