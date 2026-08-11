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

import type { Catalog, DietCode, Food, FoodId, Recipe, RecipeId, RejectionEntry } from '../domain/index.js'
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
  /**
   * Les recettes que l'étiquette écarte et que la SECONDE CHANCE rattrape (lot D1).
   *
   * ⚠️ VIDE DÈS QU'IL N'Y A AUCUNE ADMISSION — c'est P1, et c'est ce qui rend le lot gratuit pour
   * tous les utilisateurs existants : `apply` ne consulte cet ensemble que dans la branche de
   * rejet, et il n'y a rien à consulter.
   */
  readonly admisesParException: ReadonlySet<RecipeId>
  /**
   * TÉMOIN DE P3 — les recettes où la règle DIVERGE de l'étiquette écrite à la main, donc où la
   * seconde chance a refusé de s'appliquer.
   *
   * ⛔ CÔTÉ DÉVELOPPEMENT UNIQUEMENT, JAMAIS À L'ÉCRAN (principe 6). Il est ici parce qu'une
   * branche de sûreté muette pourrit sans que rien ne le dise — c'est le seul reproche sérieux
   * qu'on puisse faire à P3. Mesuré : vide sur les 330 recettes du catalogue, et **c'est le
   * succès attendu, pas du code mort**.
   */
  readonly divergencesP3: readonly RecipeId[]
}

/**
 * La SECONDE CHANCE : les recettes que l'étiquette écarte mais que la règle admet, une fois les
 * aliments admis retirés de leurs ingrédients (lot D1, P1 à P4 de
 * `docs/CONCEPTION_REGIME_PERSONNALISE.md`).
 *
 * **P1 — aucune admission ⇒ chemin identique.** Les trois sorties anticipées ci-dessous rendent
 * deux ensembles vides sans jamais appeler la règle. Zéro utilisateur existant ne change de
 * comportement, et c'est ce qui rend tout défaut du lot attribuable.
 *
 * **P2 — seconde chance uniquement, jamais un refus de plus.** Une recette que l'étiquette ACCEPTE
 * n'est même pas examinée (`continue` sur la compatibilité). Le recalcul ne peut donc qu'ajouter :
 * un défaut de la règle ne peut retirer aucun plat à personne.
 *
 * **P3 — la règle ne sert que là où elle est D'ACCORD avec l'étiquette.** ⭐ Avant d'admettre, on
 * vérifie que la règle appliquée à TOUS les ingrédients rend exactement l'étiquette écrite à la
 * main. ⛔ Ce qu'elle attrape est le seul risque réel du lot : le cas où la RÈGLE est plus fausse
 * que l'ÉTIQUETTE. Une recette au miel étiquetée `vegetarien` (correct), une règle défectueuse qui
 * rend `vegetalien` pour elle : un végétalien qui admet les œufs — et rien d'autre — verrait le
 * recalcul amputé des œufs rendre toujours `vegetalien`, la recette passerait, **et il recevrait du
 * miel**. C'est littéralement le bug du 2026-07-28 (« Tofu laqué » déclaré `vegetalien`, contenant
 * du miel) qui a fait naître `tests/regime-coherence.test.ts`.
 *
 * ⚠️ ET CE TEST N'EST PAS UNE BARRIÈRE DE BUILD : `npx vite build` n'exécute pas vitest. Les quatre
 * commandes sont une discipline, pas un verrou. P3 convertit la convention en garantie
 * d'EXÉCUTION, pour le prix d'une comparaison.
 *
 * ⛔ NE PAS RÉÉCRIRE CETTE JUSTIFICATION EN « le `catalog.db` embarqué peut ne pas être celui qui a
 * passé le test ». C'est faux, et c'est trop plausible pour ne pas revenir : `catalog.db` n'est pas
 * suivi par git, il est construit depuis les sources YAML dans le même build, et le test reconstruit
 * ces mêmes sources par `build.mjs`. Aucun artefact périmé, et aucune mise à jour du catalogue
 * indépendante de l'app.
 *
 * ⛔ P3 NE VAUT QUE POUR LES ÉTIQUETTES ÉCRITES À LA MAIN, ET LE LOT D1 L'AVAIT ÉCRIT SANS LE FAIRE.
 * Il affirmait ici « ce module ne voit que les recettes du catalogue » : c'est FAUX. `socle.ts`
 * fusionne les recettes de l'utilisateur DANS le catalogue avant de construire le moteur, et c'est
 * la décision qui rend la fonctionnalité tenable (voir `assembler`). Elles arrivent donc ici comme
 * les autres, avec une facette `regime` — mais `versRecette` (`data/user-recipe.ts`) la RECALCULE à
 * chaque lecture sur les ingrédients NON OPTIONNELS. Leur « étiquette » EST la sortie de la règle.
 *
 * Les recouper serait comparer la règle à elle-même avec deux entrées différentes : toute recette
 * personnelle portant un ingrédient animal OPTIONNEL plus restrictif que ses non-optionnels aurait
 * divergé — poisson en option sur un plat végétarien — et se serait vu refuser la seconde chance
 * sans raison. Le défaut tombe du côté FERMÉ (une recette de moins, jamais une de trop), et il était
 * INATTEIGNABLE tant que `admittedFoodIds` restait vide partout ; la table de la v16 le rend
 * atteignable, d'où sa correction ici et pas plus tard.
 *
 * ⚠️ SUR TOUS LES INGRÉDIENTS POUR LE CATALOGUE, SUR LES NON-OPTIONNELS POUR L'UTILISATEUR — dans
 * les deux cas, EXACTEMENT le jeu dont l'étiquette a été tirée. C'est ce qui rend l'amputation
 * comparable à l'étiquette qu'elle corrige.
 *
 * ⛔ NE PAS « SIMPLIFIER » EN COMPARANT PARTOUT SUR LES NON-OPTIONNELS. Au catalogue, l'étiquette est
 * écrite à la main CONTRE TOUS les ingrédients (`tests/regime-coherence.test.ts` en fait foi) : P3
 * cesserait de voir la divergence, et laisserait passer une recette dont l'ingrédient animal le plus
 * restrictif est optionnel. Deux questions différentes, deux jeux d'ingrédients — « quel régime
 * cette recette exige-t-elle » ≠ « cet utilisateur peut-il la manger ».
 *
 * ⚠️ UNE ÉTIQUETTE NON UNIQUE VAUT DIVERGENCE. `recipeDiets` rend 0..n valeurs et l'en-tête du
 * module prévoit le cas vide (« incompatible avec tout régime déclaré ») ; « égaler l'étiquette »
 * n'a de sens qu'à une. Mesuré : les 330 recettes en portent exactement une, et un test du
 * catalogue l'exige. Le cas tombe donc du bon côté — écartée — sans dépendre de cette mesure.
 *
 * ⚠️ AMPUTER JUSQU'AU VIDE NE FAIT PAS PASSER LA RECETTE. Une liste sans aucun ingrédient connu
 * fait rendre `omnivore` à `regimeExigeParIngredients`, incompatible avec tout régime déclaré de la
 * chaîne : le cas échoue FERMÉ, par la règle elle-même, sans garde ajoutée ici.
 */
function secondeChance(
  admittedFoodIds: readonly FoodId[],
  requestedDiet: DietCode | null,
  catalog: Catalog,
  recipeDietsMap: ReadonlyMap<RecipeId, readonly DietCode[]>
): { admises: ReadonlySet<RecipeId>; divergences: readonly RecipeId[] } {
  const admises = new Set<RecipeId>()
  const divergences: RecipeId[] = []

  // P1 — aucune admission, ou aucun régime déclaré : la règle n'est jamais appelée.
  if (admittedFoodIds.length === 0 || requestedDiet === null) return { admises, divergences }
  // ⚠️ Uniquement dans la chaîne. `halal` et `sans_gluten` passent par l'égalité stricte
  // (`isDietCompatible`, cas 1) ; la règle ne les modélise pas et ne doit pas les approcher.
  if (rangDansChaine(requestedDiet) < 0) return { admises, divergences }

  const admis = new Set<FoodId>(admittedFoodIds)

  for (const recipe of catalog.recipes.values()) {
    const etiquettes = recipeDietsMap.get(recipe.id) ?? []
    // P2 — acceptée par l'étiquette : jamais repassée à la règle.
    if (etiquettes.some((diet) => isDietCompatible(diet, requestedDiet))) continue
    if (etiquettes.length !== 1) continue

    const etiquette = etiquettes[0] as DietCode

    // L'étiquette d'une recette PERSONNELLE est déjà la sortie de la règle sur les non-optionnels
    // (`versRecette`) ; celle d'une recette du catalogue est écrite à la main contre TOUS les
    // ingrédients. On travaille sur le jeu dont l'étiquette a été tirée, et sur lui seul.
    const ecriteALaMain = recipe.origine !== 'utilisateur' && recipe.origine !== 'partagee'
    const ingredientsDeLEtiquette = recipe.ingredients
      .filter((ingredient) => ecriteALaMain || !ingredient.optionnel)
      .map((ingredient) => ingredient.foodId)

    // P3 — la règle doit être D'ACCORD avec l'étiquette, sinon on ne s'en sert pas. Sans objet là où
    // l'étiquette EST la règle : il n'y a pas de main humaine à recouper.
    if (
      ecriteALaMain &&
      regimeExigeParIngredients(ingredientsDeLEtiquette, catalog.foods) !== etiquette
    ) {
      divergences.push(recipe.id)
      continue
    }

    const ampute = ingredientsDeLEtiquette.filter((foodId) => !admis.has(foodId))
    if (isDietCompatible(regimeExigeParIngredients(ampute, catalog.foods), requestedDiet)) {
      admises.add(recipe.id)
    }
  }

  return { admises, divergences }
}

export const dietLayer: SelectionLayer<DietLayerConfig> = {
  id: 'regime',
  kind: 'exclusion',
  critical: true,
  defaultWeight: 0,

  configure: (req, catalog) => {
    const recipeDietsMap = new Map<RecipeId, readonly DietCode[]>()
    for (const recipe of catalog.recipes.values()) recipeDietsMap.set(recipe.id, recipeDiets(recipe))

    // ⭐ TOUT LE CALCUL DE LA SECONDE CHANCE VIT ICI, `apply` reste une lecture de table. C'est
    // aussi ce qui rend P1 gratuit : sans admission, `secondeChance` sort avant d'avoir rien lu.
    const { admises, divergences } = secondeChance(
      req.constraints.admittedFoodIds,
      req.constraints.diet,
      catalog,
      recipeDietsMap
    )

    return {
      requestedDiet: req.constraints.diet,
      recipeDiets: recipeDietsMap,
      admisesParException: admises,
      divergencesP3: divergences,
    }
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
      } else if (config.admisesParException.has(recipeId)) {
        // La seconde chance (lot D1). ⚠️ Elle ne peut qu'AJOUTER : la branche est atteinte
        // UNIQUEMENT après un refus de l'étiquette, ce qui est P2 rendu structurel.
        kept.add(recipeId)
      } else {
        rejected.push({ recipeId, layerId: 'regime', reason: `incompatible avec le régime déclaré : ${requestedDiet}` })
      }
    }

    return { kept, rejected }
  },
}
