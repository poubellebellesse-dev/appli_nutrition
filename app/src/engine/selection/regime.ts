// engine/selection/regime.ts — couche d'exclusion `regime` (docs/ENGINE.md §6 ;
// docs/ARCHITECTURE.md §5.2)
//
// 🔒 critical : indésactivable, jamais pondérée. Exclut une recette incompatible avec le régime
// déclaré par l'utilisateur (`HardConstraints.diet`), via la facette `regime` de la recette
// (`recipe_facet(facette = 'regime', valeur)` — docs/ARCHITECTURE.md §4.2).
//
// Règle de compatibilité : une recette expose sa/ses valeur(s) `regime` (0..n facettes `regime`).
// Elle est compatible si le régime demandé figure parmi ces valeurs, OU si l'une d'elles est plus
// restrictive que le régime demandé au sens de `DIET_CHAIN` ci-dessous. Une recette SANS aucune
// facette `regime` est incompatible avec tout régime déclaré (ensemble vide : rien n'y figure).
//
// ⚠️ RÈGLE D'INCLUSION AJOUTÉE (session du 2026-07-26), remplace l'égalité stricte de P1a.
// L'égalité stricte rendait un utilisateur PESCÉTARIEN aveugle à tout plat végétarien : sur le
// catalogue réel, il ne voyait que du poisson, jamais des pâtes au pesto ni un taboulé. Le défaut
// ne se voyait pas à 10 recettes ; il devient absurde à 34, et invisible à 100 — une recette
// simplement absente des propositions ne produit aucune erreur.
//
// L'alternative écartée était d'étiqueter chaque recette avec TOUS les régimes qu'elle respecte
// (le taboulé porterait 4 facettes). Rejetée parce que son mode de défaillance est SILENCIEUX :
// une étiquette oubliée sur une recette parmi cent la fait disparaître pour une partie des
// utilisateurs, sans message ni trace. La chaîne ci-dessous s'écrit une fois et ne s'oublie pas.
//
// Si `constraints.diet` est `null` (aucun régime déclaré), la couche est INERTE : §5.2
// ARCHITECTURE ne filtre que sur une contrainte DÉCLARÉE, jamais déduite.
//
// Dépendances autorisées : domain/, ./index.js (contrat local) — §2/§3 ENGINE.

import type { DietCode, Food, FoodId, Recipe, RecipeId, RejectionEntry } from '../domain/index.js'
import { resolveAnimalOrigin, resolveAnimalProvenance } from '../domain/index.js'
import type { ExclusionLayerResult, SelectionLayer } from './index.js'

/**
 * Chaîne d'inclusion des régimes, du PLUS RESTRICTIF au PLUS PERMISSIF : chaque régime peut manger
 * tout ce que mangent ceux qui le précèdent.
 *
 *   vegetalien ⊂ vegetarien ⊂ pescetarien ⊂ omnivore
 *
 * Cette chaîne n'ÉLARGIT jamais vers la droite : demander `vegetarien` ne fait jamais entrer une
 * recette `omnivore`. C'est ce qui la rend sûre pour une couche 🔒 critique — un plat de viande
 * reste structurellement inatteignable pour qui a déclaré végétarien.
 *
 * ⚠️ N'EST PAS une hiérarchie universelle des régimes. `sans_gluten`, `halal`, `casher`,
 * `sans_lactose` ne s'emboîtent dans rien : ils sont ABSENTS de cette liste et retombent alors sur
 * l'égalité stricte (voir `isDietCompatible`). Ajouter un régime ici est une décision produit, pas
 * une correction de détail : il faut pouvoir affirmer que quiconque le déclare mange RÉELLEMENT
 * tout ce qui le précède dans la chaîne.
 *
 * `DietCode` est un `string` (vocabulaire ouvert, aucune contrainte CHECK en base — voir
 * domain/catalog.ts) : cette liste est donc du VOCABULAIRE CONNU, pas une union fermée. Un régime
 * inconnu n'est pas une erreur, il est simplement traité en égalité stricte.
 */
export const DIET_CHAIN: readonly DietCode[] = ['vegetalien', 'vegetarien', 'pescetarien', 'omnivore']

/** Position dans la chaîne. `-1` pour un régime hors chaîne (`halal`, `sans_gluten`…). */
function rangDansChaine(diet: DietCode): number {
  return DIET_CHAIN.indexOf(diet)
}

/**
 * Le régime le plus RESTRICTIF qu'un aliment autorise encore, déduit de son ORIGINE ANIMALE.
 *
 * ⚠️ NE PAS DEVINER DEPUIS `Food.groupe`. Une première version de cette règle le faisait et se
 * trompait : le beurre vit en « matières grasses » et le miel en « produits sucrés » — aucun groupe
 * animal. Elle déclarait « Radis au beurre » végétalienne, sur 20 recettes.
 * `resolveAnimalOrigin` remonte la chaîne `deriveDe` (beurre → lait entier → mammifère), donc un
 * dérivé ne peut plus passer à travers, quel que soit son rayon.
 *
 * ⛔ ET L'AVERTISSEMENT CI-DESSUS A ÉTÉ ENFREINT DANS CETTE FONCTION MÊME, jusqu'au 2026-08-10 :
 * la branche `mammifere`/`volaille` tranchait sur `food.groupe === 'viandes'`. Voir le détail au
 * corps de la fonction. Deux passages du groupe, deux défauts sur une couche 🔒 critique — la
 * seconde fois en ayant l'avertissement sous les yeux. Si une réécriture future y ramène `groupe`,
 * ce sera la troisième.
 *
 * La correspondance fait → régime est faite ICI et pas dans le domaine : `AnimalOrigin` et
 * `AnimalProvenance` sont des FAITS, `DietCode` une règle. Un futur filtre halal ou casher lira les
 * mêmes faits pour en tirer autre chose.
 */
export function regimeExigePar(food: Food, foods: ReadonlyMap<FoodId, Food>): DietCode {
  switch (resolveAnimalOrigin(food, foods)) {
    case 'mammifere':
    case 'volaille':
      // Ce qui est PRODUIT par l'animal vivant (lait, œuf) s'arrête à végétarien ; ce qui est
      // prélevé sur son CORPS impose omnivore. C'est la distinction végétarienne, et elle est lue
      // sur un fait déclaré, jamais déduite.
      //
      // ⛔ CETTE LIGNE A LU `food.groupe` JUSQU'AU 2026-08-10, ET C'ÉTAIT LA MÊME FAUTE QUE CELLE
      // QUE L'EN-TÊTE CI-DESSUS INTERDIT — écrite onze lignes sous l'avertissement qui la nomme.
      // « Mammifère hors groupe viandes » valait végétarien : vrai pour le beurre, faux pour
      // `bouillon_boeuf` et `bouillon_volaille` (condiments), `gelatine` (condiments), `saindoux`
      // et `graisse_canard` (matières grasses), `guimauve` (produits sucrés, à base de gélatine).
      // Six aliments servis à un végétarien. Le groupe est un rayon de magasin ; il ne répondra
      // jamais à une question diététique.
      //
      // ⚠️ EN L'ABSENCE DE PROVENANCE, ON REND `omnivore`, PAS `vegetarien` — le plus permissif,
      // donc le plus restrictif à l'usage, comme `regimeExigeParIngredients` sans ingrédient connu.
      // Le build refuse une origine sans provenance, mais cette fonction tourne aussi sur des
      // recettes composées par l'utilisateur, contre un `user.db` sans clé étrangère vers le
      // catalogue. En cas d'ignorance, on n'affirme rien.
      return resolveAnimalProvenance(food, foods) === 'production' ? 'vegetarien' : 'omnivore'
    case 'poisson':
    case 'fruit_de_mer':
      return 'pescetarien'
    case 'insecte':
      return 'vegetarien' // le miel
    case null:
      return 'vegetalien'
  }
}

/**
 * Le régime qu'une liste d'ingrédients impose — le plus restrictif exigé par l'un d'eux.
 *
 * ⚠️ CETTE RÈGLE VIVAIT UNIQUEMENT DANS UN TEST (`tests/regime-coherence.test.ts`), comme oracle
 * comparé aux étiquettes écrites à la main dans les fichiers sources du catalogue. Elle devient du
 * code de production parce qu'une recette composée PAR L'UTILISATEUR n'a personne pour l'étiqueter :
 * sans dérivation, un plat qu'il compose avec du poisson serait proposé à un végétarien. Le test
 * garde tout son sens — il confronte désormais les étiquettes rédigées à la main à CETTE fonction.
 *
 * Un `foodId` inconnu du catalogue est IGNORÉ, jamais une erreur : un catalogue mis à jour peut
 * avoir retiré un aliment auquel une recette utilisateur fait encore référence (même raison que
 * l'absence de clé étrangère entre `user.db` et `catalog.db`, voir `user-schema.ts`).
 *
 * ⚠️ SANS INGRÉDIENT CONNU, rend `omnivore` — le plus PERMISSIF, donc le plus restrictif à l'usage :
 * la recette n'apparaîtra pour aucun régime déclaré. Rendre `vegetalien` (le neutre arithmétique de
 * la boucle) l'aurait au contraire proposée à tout le monde, y compris à un végétalien, sur la foi
 * d'une liste qu'on n'a pas su lire. En cas d'ignorance, on n'affirme rien.
 */
export function regimeExigeParIngredients(
  foodIds: readonly FoodId[],
  foods: ReadonlyMap<FoodId, Food>
): DietCode {
  let exige: DietCode = 'vegetalien'
  let connu = false
  for (const foodId of foodIds) {
    const food = foods.get(foodId)
    if (food === undefined) continue
    connu = true
    const candidat = regimeExigePar(food, foods)
    if (rangDansChaine(candidat) > rangDansChaine(exige)) exige = candidat
  }
  return connu ? exige : 'omnivore'
}

/**
 * Une recette étiquetée `recipeDiet` convient-elle à qui demande `requested` ?
 *
 * Deux cas, dans cet ordre :
 *  1. Égalité stricte — vaut pour TOUT régime, y compris hors chaîne (`sans_gluten`, `halal`…).
 *  2. Inclusion — les deux régimes sont dans `DIET_CHAIN` et la recette est au moins aussi
 *     restrictive que la demande (rang inférieur ou égal).
 */
function isDietCompatible(recipeDiet: DietCode, requested: DietCode): boolean {
  if (recipeDiet === requested) return true

  const requestedRank = DIET_CHAIN.indexOf(requested)
  const recipeRank = DIET_CHAIN.indexOf(recipeDiet)
  if (requestedRank < 0 || recipeRank < 0) return false // au moins un régime hors chaîne

  return recipeRank <= requestedRank
}

function recipeDiets(recipe: Recipe): readonly DietCode[] {
  return recipe.facettes.filter((facette) => facette.facette === 'regime').map((facette) => facette.valeur)
}

export interface DietLayerConfig {
  readonly requestedDiet: DietCode | null
  readonly recipeDiets: ReadonlyMap<RecipeId, readonly DietCode[]>
}

export const dietLayer: SelectionLayer<DietLayerConfig> = {
  id: 'regime',
  kind: 'exclusion',
  critical: true,
  defaultWeight: 0,

  configure: (req, catalog) => {
    const recipeDietsMap = new Map<RecipeId, readonly DietCode[]>()
    for (const recipe of catalog.recipes.values()) recipeDietsMap.set(recipe.id, recipeDiets(recipe))

    return { requestedDiet: req.constraints.diet, recipeDiets: recipeDietsMap }
  },

  apply: (candidates, config): ExclusionLayerResult => {
    const kept = new Set<RecipeId>()
    const rejected: RejectionEntry[] = []

    if (config.requestedDiet === null) {
      for (const recipeId of candidates) kept.add(recipeId)
      return { kept, rejected }
    }

    const requestedDiet = config.requestedDiet
    for (const recipeId of candidates) {
      const diets = config.recipeDiets.get(recipeId) ?? []
      if (diets.some((diet) => isDietCompatible(diet, requestedDiet))) {
        kept.add(recipeId)
      } else {
        rejected.push({ recipeId, layerId: 'regime', reason: `incompatible avec le régime déclaré : ${requestedDiet}` })
      }
    }

    return { kept, rejected }
  },
}
