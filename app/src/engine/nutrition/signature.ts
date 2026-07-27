// engine/nutrition/signature.ts — index dérivé `recipeSignature` (docs/ENGINE.md §6.6).
//
// POURQUOI CET INDEX EXISTE
// `recipeMainIngredient` retient l'ingrédient NON OPTIONNEL LE PLUS LOURD. Mesuré sur le catalogue
// réel au palier de 100 puis de 200 recettes, ce choix est faux dans les grandes largeurs : le plus
// lourd n'est presque jamais celui qui définit le plat.
//   - « mousse au chocolat » → 300 g d'œufs contre 200 g de chocolat, donc « plat d'œufs » ;
//   - « hachis de bœuf » → 800 g de pommes de terre contre 500 g de bœuf ;
//   - « lentilles aux carottes » et « poulet rôti aux carottes » → 300/300 g et 500/500 g, deux
//     ÉGALITÉS tranchées arbitrairement en faveur de la carotte.
// La similarité pondérant cet ingrédient à 0,5, elle jugeait « œufs au plat aux tomates » et
// « soupe de poisson au fenouil » identiques à 99 %, et deux plats de champignons à 100 %.
//
// LE REMPLACEMENT A ÉTÉ MESURÉ, PAS DEVINÉ. Six modèles comparés sur deux jeux de paires — des
// plats sans rapport à séparer, des plats réellement proches à garder proches (banc
// `app/src/cli/compare-similarite.ts`, `npm run engine:similarity` pour la distribution) :
//
//   modèle                          écart patho/témoins à 100 rec.   à 200 rec.
//   le plus lourd (ancien)                    1 pt                      1 pt
//   3 plus lourds  ← RETENU                  18 pts                    18 pts
//   3 plus lourds + seuil 5 % de masse       18 pts                    18 pts
//   pondération par rareté (3 variantes)     17 pts                    17 pts
//
// Doubler le catalogue n'a rien changé : la conclusion n'est pas un artefact de petit échantillon.
// La pondération par rareté — pourtant séduisante — n'apporte RIEN de mesurable et fait dépendre la
// similarité de la composition du catalogue entier. Le seuil de masse ne change rien non plus au
// score, et porte un risque propre : sur une recette à peu d'ingrédients il écarterait un
// ingrédient léger mais définissant (l'ail de « pâtes à l'ail et à l'huile »). Le modèle retenu est
// donc le plus simple des trois à égalité de résultat.
//
// Fonction PURE, appelée une fois à `createEngine(catalog)` via `attachDerivedIndexes`.
//
// Dépendances autorisées : domain/ uniquement — §2/§3 ENGINE.

import type { Catalog, FoodId, RecipeId, RecipeSignature } from '../domain/index.js'

/**
 * Nombre d'ingrédients retenus dans la signature. TROIS est la valeur mesurée, pas un réglage à
 * ajuster au feeling : c'est ce qui sépare un plat de ses ingrédients de fond (sel, huile, oignon,
 * ail — présents respectivement dans 84, 47, 30 et 29 recettes sur 100) sans amputer les plats
 * simples. Changer ce nombre demande de rejouer le banc.
 */
export const SIGNATURE_SIZE = 3

export type { RecipeSignature } from '../domain/index.js'

/**
 * Les `SIGNATURE_SIZE` ingrédients non optionnels les plus lourds, avec leur part relative.
 *
 * Les parts sont normalisées SUR LES SEULS INGRÉDIENTS RETENUS, pas sur la masse totale de la
 * recette : on compare des PROFILS de composition, pas des quantités absolues. Sans cela, une
 * recette pour 6 paraîtrait différente de la même recette pour 2.
 *
 * Une recette sans aucun ingrédient non optionnel n'a PAS d'entrée — Map partielle assumée, même
 * parti pris que `computeRecipeMainIngredient` : mieux vaut une absence qu'une fausse signature
 * bâtie sur des optionnels.
 *
 * Tie-break déterministe par `foodId` croissant à quantité égale — le cas est fréquent
 * (« lentilles 300 g / carottes 300 g ») et un ordre instable rendrait la similarité non
 * reproductible d'un build à l'autre.
 */
export function computeRecipeSignature(catalog: Catalog): ReadonlyMap<RecipeId, RecipeSignature> {
  const result = new Map<RecipeId, RecipeSignature>()

  for (const recipe of catalog.recipes.values()) {
    const solid = recipe.ingredients
      .filter((ingredient) => !ingredient.optionnel)
      .sort((a, b) => (b.quantiteG - a.quantiteG) || (a.foodId < b.foodId ? -1 : a.foodId > b.foodId ? 1 : 0))
      .slice(0, SIGNATURE_SIZE)

    if (solid.length === 0) continue

    const total = solid.reduce((sum, ingredient) => sum + ingredient.quantiteG, 0)
    if (total <= 0) continue // quantités toutes nulles : signature impossible, absence assumée

    const signature = new Map<FoodId, number>()
    for (const ingredient of solid) {
      // `set` cumulatif : un même aliment peut apparaître deux fois dans une recette (deux lignes
      // d'ingrédient), auquel cas ses parts s'additionnent au lieu de s'écraser.
      signature.set(ingredient.foodId, (signature.get(ingredient.foodId) ?? 0) + ingredient.quantiteG / total)
    }
    result.set(recipe.id, signature)
  }

  return result
}

/**
 * Chevauchement pondéré de deux signatures ∈ [0, 1] — indice de Jaccard pondéré : somme des minima
 * sur somme des maxima.
 *
 * Deux signatures identiques donnent 1, deux signatures disjointes 0, et un ingrédient partagé ne
 * compte qu'à hauteur de la PLUS PETITE de ses deux parts. C'est ce qui distingue « les deux plats
 * contiennent de la carotte » (contribution faible si elle est marginale chez l'un) de « les deux
 * plats sont essentiellement de la carotte ».
 *
 * Une signature VIDE (recette sans ingrédient non optionnel) rend 0, jamais 1 : l'absence n'est pas
 * une égalité — même piège que celui documenté dans similarity.ts.
 */
export function signatureOverlap(a: RecipeSignature, b: RecipeSignature): number {
  if (a.size === 0 || b.size === 0) return 0

  let intersection = 0
  let union = 0
  for (const foodId of new Set([...a.keys(), ...b.keys()])) {
    const partA = a.get(foodId) ?? 0
    const partB = b.get(foodId) ?? 0
    intersection += Math.min(partA, partB)
    union += Math.max(partA, partB)
  }

  return union === 0 ? 0 : intersection / union
}
