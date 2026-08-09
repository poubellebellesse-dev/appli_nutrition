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

import type {
  Catalog,
  Food,
  FoodId,
  RecipeId,
  ShoppingList,
  ShoppingListItem,
  ShoppingOptions,
  SlotRef,
  WeekPlan,
} from '../domain/index.js'
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
 * Les six rayons alimentaires, DÉRIVÉS de `RAYON_PAR_GROUPE` plutôt que recopiés à la main : une
 * liste écrite séparément (par ex. dans un formulaire d'ajout manuel) divergerait silencieusement
 * le jour où un groupe change de rayon ici.
 */
export const RAYONS_ALIMENTAIRES: readonly string[] = [
  ...new Set([...Object.values(RAYON_PAR_GROUPE), RAYON_PAR_DEFAUT]),
]

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
 * Quantité à ACHETER pour couvrir `grammes`. Toujours AU-DESSUS, jamais au-dessous : mieux vaut un
 * reste de course qu'un ingrédient manquant au moment de cuisiner.
 *
 * Deux régimes, selon que l'aliment se vende en paquet ou au poids :
 *
 *  - **CONDITIONNÉ** (`conditionnementG` non nul) — on achète `⌈besoin ÷ paquet⌉` paquets. Avec une
 *    plaquette de 250 g : 240 g de besoin donnent UNE plaquette (250 g), 260 g en donnent DEUX
 *    (500 g). C'est la règle de §7.4, « on n'achète pas 43 g de beurre ».
 *
 *  - **AU POIDS** (`null` — fruits, légumes, viande à la coupe) — arrondi générique dont le pas
 *    grossit avec la quantité : on pèse au gramme près une pincée d'épices, pas trois kilos de
 *    pommes de terre.
 *
 * ⚠️ NE PAS « optimiser » le cas conditionné en arrondissant au plus proche. Descendre sous le
 * besoin économise quelques grammes et fait rater la recette : l'asymétrie est voulue.
 */
export function arrondiAchat(grammes: number, conditionnementG: number | null = null): number {
  if (grammes <= 0) return 0
  if (conditionnementG !== null && conditionnementG > 0) {
    return Math.ceil(grammes / conditionnementG) * conditionnementG
  }
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

/**
 * Quantité et unité D'AFFICHAGE. Trois régimes, dans cet ordre de priorité :
 *
 *  1. **à la pièce** (`poidsPieceG`) — « 3 carottes ». Prime, parce que c'est ce qu'on compte
 *     devant le bac. Le grammage disparaît volontairement : il n'aide personne à choisir.
 *  2. **au conditionnement** (`conditionnementG`) — « 500 g » = deux plaquettes.
 *  3. **au poids** — arrondi générique.
 */
function quantiteAffichee(food: Food, grammes: number): { quantiteTotale: number; unite: string } {
  if (food.poidsPieceG !== null && food.poidsPieceG > 0) {
    return { quantiteTotale: Math.ceil(grammes / food.poidsPieceG), unite: 'pièce' }
  }
  return { quantiteTotale: arrondiAchat(grammes, food.conditionnementG), unite: 'g' }
}

export function buildShoppingList(
  plan: WeekPlan,
  catalog: Catalog,
  opts: ShoppingOptions = {},
  generatedAt = plan.startDate
): ShoppingList {
  // Ce que l'utilisateur déclare avoir déjà — tout ou rien, voir `ShoppingOptions.pantryFoodIds`.
  const deja = new Set(opts.pantryFoodIds ?? [])

  // Clé = aliment + tranche : le même aliment acheté en deux fois donne deux lignes, sinon la
  // scission de §7.4 ne servirait à rien.
  const cumul = new Map<
    string,
    { foodId: FoodId; grammes: number; tranche: number; pourSlots: SlotRef[]; pourSauces: RecipeId[] }
  >()

  /**
   * Verse les ingrédients d'une recette dans le cumul. Une seule implémentation pour le plat et pour
   * ses sauces : le garde-manger, le fond de placard et la scission par tranche doivent s'appliquer
   * exactement pareil des deux côtés — une seconde boucle recopiée aurait divergé au premier
   * changement de règle, et personne n'aurait vu passer une sauce à travers le filtre « j'ai déjà ».
   */
  const verser = (recipeId: RecipeId, tranche: number, slot: SlotRef | null): void => {
    const recette = catalog.recipes.get(recipeId)
    if (recette === undefined) return // id inconnu après mise à jour du catalogue : on ignore, jamais d'erreur
    for (const ingredient of recette.ingredients) {
      if (deja.has(ingredient.foodId)) continue
      const food = catalog.foods.get(ingredient.foodId)
      if (food !== undefined && food.fondDePlacard && opts.inclureFondDePlacard !== true) continue

      const cle = `${ingredient.foodId}#${tranche}`
      const existant = cumul.get(cle)
      if (existant === undefined) {
        cumul.set(cle, {
          foodId: ingredient.foodId,
          grammes: ingredient.quantiteG,
          tranche,
          pourSlots: slot === null ? [] : [slot],
          pourSauces: slot === null ? [recipeId] : [],
        })
        continue
      }
      existant.grammes += ingredient.quantiteG
      if (slot === null) {
        // Dédupliqué : la même sauce retenue sur deux plats de la semaine se cite UNE fois par
        // ligne, sinon la provenance affichée dirait « Sauce au poivre, Sauce au poivre ».
        if (!existant.pourSauces.includes(recipeId)) existant.pourSauces.push(recipeId)
      } else {
        existant.pourSlots.push(slot)
      }
    }
  }

  for (const entree of plan.entries) {
    if (entree.recipeId === null || entree.isLeftover) continue // voir l'en-tête : un reste ne se rachète pas
    if (!catalog.recipes.has(entree.recipeId)) continue

    const tranche = trancheDe(entree.slot.date, plan.startDate, opts.joursDeCourses)
    verser(entree.recipeId, tranche, entree.slot)

    // ⚠️ SOUS LE GARDE `isLeftover`, ET C'EST TOUT L'ENJEU. Une sauce suit son plat : si le plat est
    // un reste, il n'est pas recuisiné, donc sa sauce non plus. Verser les sauces au-dessus du garde
    // aurait fait racheter la sauce à chaque repas d'un plat cuisiné une seule fois — exactement le
    // gain que les restes existent pour produire, annulé sur une ligne.
    for (const sauceId of opts.saucesParRecette?.get(entree.recipeId) ?? []) {
      verser(sauceId, tranche, null)
    }
  }

  const items: ShoppingListItem[] = []
  for (const { foodId, grammes, tranche, pourSlots, pourSauces } of cumul.values()) {
    const food = catalog.foods.get(foodId)
    if (food === undefined) continue // intégrité garantie au build ; garde purement défensive
    items.push({
      foodId,
      ...quantiteAffichee(food, grammes),
      rayon: rayonDe(food, catalog.foods),
      tranche,
      pourSlots,
      pourSauces,
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
