// engine/planning/shopping-list.ts — liste de courses (docs/ENGINE.md §7.4, §5.7 ARCHITECTURE).
//
// Quatre étapes annoncées par §7.4 : agrégation des ingrédients → conversion en unités d'achat →
// arrondi aux conditionnements courants → regroupement par rayon.
//
// ⚠️ UN RESTE NE SE RACHÈTE PAS. C'est l'interaction essentielle avec §7.3, et la première source
// d'erreur possible ici : un plat cuisiné une fois puis mangé trois fois s'achète UNE fois. Les
// entrées `isLeftover` sont donc ignorées à l'agrégation. Les compter multiplierait la liste par le
// nombre de repas, ce qui annulerait exactement le gain que les restes existent pour produire.
//
// ⚠️ LES QUANTITÉS NE SONT PAS MISES À L'ÉCHELLE DES CONVIVES. Une recette s'achète telle qu'elle
// est écrite, pour ses `portionsBase` portions — c'est précisément parce qu'on cuisine tout que des
// restes apparaissent (§7.3). Diviser par le nombre de convives ferait acheter de quoi cuisiner un
// demi-plat, et supprimerait les restes que le planning vient de placer.
//
// ⚠️ LES OPTIONNELS SONT INCLUS, cohérent avec `aggregateRecipe` (décision P1b-1 : un ingrédient
// `optionnel` fait partie du plat servi par défaut). Une liste qui les omettrait ferait manquer
// l'ingrédient au moment de cuisiner.
//
// Dépendances autorisées : domain/ uniquement — §2/§3 ENGINE.

import type { Catalog, Food, FoodId, ShoppingList, ShoppingListItem, WeekPlan } from '../domain/index.js'
import { resolveAnimalOrigin } from '../domain/index.js'

/**
 * `Food.groupe` → rayon de magasin.
 *
 * ⚠️ CE SONT DEUX CHOSES DIFFÉRENTES, comme `types_repas` et `service`. `groupe` est une
 * classification NUTRITIONNELLE (celle de Ciqual) ; un rayon est une organisation de MAGASIN. Elles
 * se ressemblent assez pour qu'on soit tenté de les confondre, et divergent là où ça compte :
 * « matières grasses » réunit le beurre et l'huile d'olive, qui ne sont pas au même endroit.
 *
 * Six rayons plutôt que quatorze groupes : c'est le nombre de fois qu'on traverse un magasin, pas
 * le nombre de familles d'aliments.
 */
const RAYON_PAR_GROUPE: Readonly<Record<string, string>> = {
  légumes: 'fruits et légumes',
  fruits: 'fruits et légumes',
  viandes: 'boucherie',
  poissons: 'poissonnerie',
  'fruits de mer': 'poissonnerie',
  'lait et produits laitiers': 'crèmerie',
  œufs: 'crèmerie',
  'céréales et dérivés': 'épicerie',
  légumineuses: 'épicerie',
  condiments: 'épicerie',
  'produits sucrés': 'épicerie',
  'fruits à coque et oléagineux': 'épicerie',
  'boissons alcoolisées': 'cave',
}

const RAYON_PAR_DEFAUT = 'épicerie'

/**
 * Le rayon d'un aliment.
 *
 * « matières grasses » n'a pas d'entrée dans la table exprès : le groupe ne suffit pas à trancher.
 * Le beurre se range à la crèmerie, l'huile d'olive à l'épicerie. On départage par l'ORIGINE
 * ANIMALE, qui remonte la chaîne `deriveDe` (beurre → lait entier → mammifère) — le champ posé pour
 * la cohérence des régimes sert ici une tout autre question, ce qui est le signe qu'il est au bon
 * niveau d'abstraction.
 */
export function rayonDe(food: Food, foods: ReadonlyMap<FoodId, Food>): string {
  const parGroupe = RAYON_PAR_GROUPE[food.groupe]
  if (parGroupe !== undefined) return parGroupe
  if (food.groupe === 'matières grasses') {
    return resolveAnimalOrigin(food, foods) === null ? 'épicerie' : 'crèmerie'
  }
  return RAYON_PAR_DEFAUT
}

/**
 * Arrondi À LA HAUSSE, jamais à la baisse : mieux vaut un reste de course qu'un ingrédient
 * manquant au moment de cuisiner. Le pas grossit avec la quantité — on pèse au gramme près pour
 * une pincée d'épices, pas pour trois kilos de pommes de terre.
 *
 * ⚠️ CE N'EST PAS L'ARRONDI AUX CONDITIONNEMENTS que demande §7.4 (« on n'achète pas 43 g de
 * beurre » — on en achète une plaquette de 250 g). Le vrai conditionnement est propre à CHAQUE
 * aliment : plaquette de 250 g, boîte de 6 œufs, brique d'un litre. Il demande un champ sur `Food`
 * qui n'existe pas, et l'inventer ici aliment par aliment serait le cacher dans du code au lieu de
 * le poser dans les données. Décision ouverte — voir ETAT §4.
 */
export function arrondiAchat(grammes: number): number {
  if (grammes <= 0) return 0
  const pas = grammes < 100 ? 10 : grammes < 1000 ? 50 : 100
  return Math.ceil(grammes / pas) * pas
}

/**
 * Tranche d'achat d'une date : 0 pour la première virée, 1 pour la suivante, etc.
 * `joursDeCourses` absent ou ≤ 0 → tout en une seule fois.
 */
function trancheDe(dateEntree: string, dateDepart: string, joursDeCourses: number | undefined): number {
  if (joursDeCourses === undefined || joursDeCourses <= 0) return 0
  const jours = Math.round(
    (Date.parse(`${dateEntree}T00:00:00Z`) - Date.parse(`${dateDepart}T00:00:00Z`)) / 86_400_000
  )
  return Math.max(0, Math.floor(jours / joursDeCourses))
}

export function buildShoppingList(
  plan: WeekPlan,
  catalog: Catalog,
  opts: { readonly joursDeCourses?: number } = {},
  generatedAt = plan.startDate
): ShoppingList {
  // Clé = aliment + tranche : le même aliment acheté en deux fois donne deux lignes, sinon la
  // scission de §7.4 ne servirait à rien.
  const cumul = new Map<string, { foodId: FoodId; grammes: number; tranche: number }>()

  for (const entree of plan.entries) {
    if (entree.recipeId === null || entree.isLeftover) continue // voir l'en-tête : un reste ne se rachète pas
    const recette = catalog.recipes.get(entree.recipeId)
    if (recette === undefined) continue

    const tranche = trancheDe(entree.slot.date, plan.startDate, opts.joursDeCourses)
    for (const ingredient of recette.ingredients) {
      const cle = `${ingredient.foodId}#${tranche}`
      const existant = cumul.get(cle)
      if (existant === undefined) cumul.set(cle, { foodId: ingredient.foodId, grammes: ingredient.quantiteG, tranche })
      else existant.grammes += ingredient.quantiteG
    }
  }

  const items: ShoppingListItem[] = []
  for (const { foodId, grammes, tranche } of cumul.values()) {
    const food = catalog.foods.get(foodId)
    if (food === undefined) continue // intégrité garantie au build ; garde purement défensive
    items.push({
      foodId,
      quantiteTotale: arrondiAchat(grammes),
      unite: 'g',
      rayon: rayonDe(food, catalog.foods),
      tranche,
    })
  }

  // Ordre STABLE et utile en magasin : par tranche d'achat, puis par rayon, puis par aliment. Un
  // ordre instable rendrait deux listes identiques visuellement différentes.
  items.sort(
    (a, b) =>
      a.tranche - b.tranche ||
      (a.rayon < b.rayon ? -1 : a.rayon > b.rayon ? 1 : 0) ||
      (a.foodId < b.foodId ? -1 : a.foodId > b.foodId ? 1 : 0)
  )

  return { planId: plan.id, generatedAt, items }
}
