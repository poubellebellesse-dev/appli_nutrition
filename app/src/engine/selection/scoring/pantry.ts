// engine/selection/scoring/pantry.ts — couche de score `pantry`, « vider le frigo »
// (docs/ENGINE.md §10.2 ①, §6.3 registre).
//
// L'utilisateur déclare ce qu'il a (`MealContext.pantryFoodIds`, table `user_pantry`), le moteur
// classe par TAUX DE COUVERTURE des ingrédients.
//
// ⚠️ CE N'EST PAS UN FILTRE, et §10.2 insiste dessus. Avec quatre ingrédients au frigo, AUCUNE
// recette n'est intégralement couverte : un filtre renverrait zéro résultat et l'utilisateur
// conclurait que la fonction ne marche pas. C'est une couche de SCORE — les recettes les mieux
// couvertes remontent, les autres restent atteignables.
//
// ⚠️ COUVERTURE PONDÉRÉE PAR LA MASSE, pas comptée en nombre d'ingrédients. Avoir le sel et le
// poivre d'un bœuf bourguignon ne couvre rien ; avoir le bœuf couvre l'essentiel. Compter
// « 2 ingrédients sur 8 » traiterait les deux cas à l'identique et remonterait des recettes dont il
// manque tout ce qui coûte.
//
// ⚠️ LES OPTIONNELS SONT EXCLUS du calcul. Ne pas avoir une garniture facultative n'empêche pas de
// cuisiner le plat : la compter comme manquante pénaliserait des recettes réalisables.
//
// Frigo Magic occupe ce terrain avec 4 800 recettes, gratuitement (§10.2). Chez nous c'est UNE
// couche parmi douze, pas le produit — ne pas positionner l'application là-dessus.
//
// Dépendances autorisées : domain/, ./index.js — §2/§3 ENGINE.

import type { Catalog, FoodId, RecipeId } from '../../domain/index.js'
import type { CandidateSet, ScoringLayerResult, SelectionLayer } from '../index.js'
import { NEUTRAL_SCORE, clamp01 } from './index.js'

/**
 * Part de la masse non optionnelle déjà disponible ∈ [0, 1].
 *
 * Garde-manger vide → `NEUTRAL_SCORE` et non 0 : l'utilisateur qui ne déclare rien ne doit pas voir
 * toutes ses recettes punies. C'est la même règle que `preference` sur un profil neuf (§6.5
 * précision 4) — l'absence d'information n'est pas une information.
 */
export function scorePantry(
  recipeId: RecipeId,
  catalog: Catalog,
  pantry: ReadonlySet<FoodId>
): number {
  if (pantry.size === 0) return NEUTRAL_SCORE

  const recette = catalog.recipes.get(recipeId)
  if (recette === undefined) return NEUTRAL_SCORE

  const solides = recette.ingredients.filter((i) => !i.optionnel)
  const masse = solides.reduce((somme, i) => somme + i.quantiteG, 0)
  if (masse <= 0) return NEUTRAL_SCORE

  const disponible = solides.reduce((somme, i) => (pantry.has(i.foodId) ? somme + i.quantiteG : somme), 0)
  return clamp01(disponible / masse)
}

/**
 * Ce qu'il MANQUE pour réaliser la recette — « il te manque : crème, thym » (§10.2 ①).
 *
 * ⚠️ Afficher ce qui manque vaut mieux que masquer la recette. C'est la contrepartie directe du
 * choix « score et non filtre » : une recette couverte à 80 % reste proposable À CONDITION que
 * l'utilisateur voie les deux ingrédients à acheter.
 */
export function ingredientsManquants(
  recipeId: RecipeId,
  catalog: Catalog,
  pantry: ReadonlySet<FoodId>
): readonly FoodId[] {
  const recette = catalog.recipes.get(recipeId)
  if (recette === undefined) return []
  return recette.ingredients
    .filter((i) => !i.optionnel && !pantry.has(i.foodId))
    .map((i) => i.foodId)
}

/**
 * Recette et garde-manger partagent-ils au moins un ingrédient NON optionnel qui ne soit pas un
 * fond de placard ?
 *
 * ⚠️ CRITÈRE DE COMPTE, PAS DE MASSE — contrairement à `scorePantry`. Une recette qui ne partage
 * qu'un ingrédient léger aurait une couverture non nulle mais quasi invisible en flottant : elle
 * resterait affichée sans qu'on puisse s'en apercevoir. Le compte est aussi ce que l'écran montre
 * (« x ingrédients sur y »), donc le critère qui filtre est celui qui s'explique.
 *
 * ⚠️ LES FONDS DE PLACARD NE COMPTENT PAS, et c'est ce qui fait tenir le filtre. `sel_fin` est un
 * ingrédient non optionnel d'une grande part du catalogue : le compter ferait « correspondre » 175
 * recettes sur 241 à un garde-manger réduit au sel et au poivre — mesuré. Or partager du sel avec
 * quelqu'un n'est pas partager un ingrédient : c'est précisément ce que `Food.fondDePlacard`
 * signifie, « tout le monde en a déjà » (§4 décision 41, qui l'écarte aussi de la liste de courses).
 * Un garde-manger qui n'en contient que rend donc zéro résultat — et l'écran invite à ajouter un
 * vrai aliment, ce qui est la réponse juste.
 */
export function partageIngredientNonOptionnel(
  recipeId: RecipeId,
  catalog: Catalog,
  pantry: ReadonlySet<FoodId>
): boolean {
  const recette = catalog.recipes.get(recipeId)
  if (recette === undefined) return false
  return recette.ingredients.some(
    (i) => !i.optionnel && pantry.has(i.foodId) && catalog.foods.get(i.foodId)?.fondDePlacard !== true
  )
}

// ------------------------------------------------------------------------------------------
// Couche `pantry` (§6.2 ENGINE) — `defaultWeight: 0.05`, un bonus MODÉRÉ en mode normal.
//
// §10.2 décrit deux modes : normal (bonus modéré) et « vider le frigo » (dominant, écrase les
// autres). Le second se fait par `SuggestionRequest.weights`, qui prime sur tout (§6.3 bis) — pas
// besoin d'un drapeau supplémentaire, le mécanisme de pondération existe déjà et lui donner un
// second chemin ferait diverger les deux.
// ------------------------------------------------------------------------------------------

export interface PantryLayerConfig {
  readonly catalog: Catalog
  readonly pantry: ReadonlySet<FoodId>
}

export const pantryLayer: SelectionLayer<PantryLayerConfig> = {
  id: 'pantry',
  kind: 'scoring',
  critical: false,
  defaultWeight: 0.05,

  configure: (req, catalog) => ({ catalog, pantry: new Set(req.context.pantryFoodIds) }),

  apply: (candidates: CandidateSet, config: PantryLayerConfig): ScoringLayerResult => {
    const scores = new Map<RecipeId, number>()
    for (const recipeId of candidates) {
      scores.set(recipeId, scorePantry(recipeId, config.catalog, config.pantry))
    }
    return { scores }
  },
}
