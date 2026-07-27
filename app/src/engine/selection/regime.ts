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

import type { DietCode, Recipe, RecipeId, RejectionEntry } from '../domain/index.js'
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
