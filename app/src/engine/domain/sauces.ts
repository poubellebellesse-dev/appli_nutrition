// engine/domain/sauces.ts — qui a droit à une sauce, et laquelle.
//
// TypeScript pur, entrées objets → sorties objets. N'importe ni react, ni sqlite, ni features/.
//
// ⚠️ CE MODULE NE CHOISIT RIEN ET NE CLASSE RIEN. Il répond à deux questions factuelles — « ce plat
// vient-il déjà avec sa sauce ? » et « lesquelles lui propose-t-on ? ». Aucune couche de sélection
// ne l'appelle, aucun score n'en dépend : une sauce ne peut pas faire monter ni descendre une
// recette dans un classement. C'est le même parti que `recipe_pairing` du volet vin
// (docs/CONCEPTION_B_VIN_REPAS.md §1.6) : l'information est exposée, jamais pondérée.
//
// ⚠️ POURQUOI CE N'EST PAS UNE COUCHE. Une couche note UN candidat au regard d'une contrainte. Ici
// on décrit une relation entre deux recettes, en dehors de toute passe de sélection. Le registre
// reste à 16 couches.

import type { Catalog, Recipe } from './catalog.js'
import type { RecipeId } from './ids.js'

/** La valeur de `Food.sousGroupe` qui désigne une sauce du commerce. */
export const SOUS_GROUPE_SAUCE = 'sauce'

/**
 * Ce plat vient-il déjà avec une sauce ?
 *
 * ⚠️ L'ORDRE DES DEUX SOURCES N'EST PAS INTERCHANGEABLE. `Recipe.porteDejaUneSauce` est un tri-état
 * éditorial : quand il vaut `true` ou `false`, un humain a tranché et il l'emporte. Ce n'est que sur
 * `null` — « personne n'a regardé » — qu'on dérive depuis les ingrédients. C'est exactement le motif
 * de `food_ids` sur une étape : dérivé par défaut, le YAML gagne quand il est là.
 *
 * ⚠️ LA DÉRIVATION SEULE SERAIT INSUFFISANTE, et c'est mesurable : elle ne voit qu'un ingrédient
 * portant `sousGroupe: 'sauce'`, donc elle attrape le ketchup versé DANS la recette et rate toutes
 * les sauces cuisinées au fil du plat. Une blanquette nage dans la sienne sans qu'aucun de ses
 * ingrédients ne soit une sauce. Ne pas retirer le tri-état au motif que « la dérivation suffit ».
 */
export function porteDejaUneSauce(recipe: Recipe, catalog: Catalog): boolean {
  if (recipe.porteDejaUneSauce !== null) return recipe.porteDejaUneSauce
  return recipe.ingredients.some(
    (ing) => catalog.foods.get(ing.foodId)?.sousGroupe === SOUS_GROUPE_SAUCE
  )
}

/**
 * Faut-il proposer d'ajouter une sauce à ce plat ?
 *
 * Trois refus, dans cet ordre :
 *   1. une sauce ne se voit pas proposer une sauce ;
 *   2. **les desserts sont exclus, et eux seuls** — entrées, plats et accompagnements sont tous
 *      éligibles (décision utilisateur du 2026-08-08 : les entrées le sont, contrairement à une
 *      première lecture qui les écartait avec les desserts) ;
 *   3. un plat qui vient déjà avec sa sauce n'en réclame pas une seconde.
 *
 * ⚠️ `service === null` NE REFUSE PAS. Le champ est encore nullable le temps de l'annotation ; un
 * refus sur `null` ferait disparaître la proposition de toute recette non annotée, sans erreur ni
 * test rouge. On n'écarte que ce qu'on sait être un dessert.
 */
export function proposerUneSauce(recipe: Recipe, catalog: Catalog): boolean {
  if (recipe.estSauce) return false
  if (recipe.service === 'dessert') return false
  return !porteDejaUneSauce(recipe, catalog)
}

/**
 * Les sauces que l'application propose avec ce plat, dédupliquées et résolues en recettes.
 *
 * Vide quand le plat n'y a pas droit (§ `proposerUneSauce`) — un appelant n'a donc pas à refaire le
 * test avant d'appeler, et ne peut pas afficher une liste que la règle interdit.
 *
 * ⚠️ Un id qui ne résout pas est IGNORÉ, pas remonté en erreur : le build garantit déjà que la cible
 * existe et porte `estSauce`. Lever ici ferait tomber un écran entier sur une donnée que la chaîne
 * de production ne peut pas produire.
 */
export function saucesProposees(recipe: Recipe, catalog: Catalog): readonly Recipe[] {
  if (!proposerUneSauce(recipe, catalog)) return []
  const vues = new Set<RecipeId>()
  const sauces: Recipe[] = []
  for (const id of recipe.sauceIds) {
    if (vues.has(id)) continue
    vues.add(id)
    const sauce = catalog.recipes.get(id)
    if (sauce?.estSauce) sauces.push(sauce)
  }
  return sauces
}

/**
 * Toutes les sauces du catalogue, par ordre alphabétique de nom.
 *
 * Sert l'écran quand un plat éligible ne porte aucune sauce attachée : on montre le catalogue
 * complet plutôt que rien. **Ne filtre ni les allergènes ni le régime** — ce tri-là appartient à
 * l'appelant, qui seul connaît le profil ; le faire ici obligerait `engine/domain/` à connaître
 * l'utilisateur.
 */
export function toutesLesSauces(catalog: Catalog): readonly Recipe[] {
  return [...catalog.recipes.values()]
    .filter((r) => r.estSauce)
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}
