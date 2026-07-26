// engine/selection/favoris.ts — couche d'exclusion `favoris` (docs/ENGINE.md §8.1)
//
// Restreint les candidats aux recettes marquées en favori (`user_favorite`, §4.3 ARCHITECTURE)
// quand `SuggestionRequest.onlyFavorites` est vrai. Non critique (§6.3 ENGINE — seules
// `allergenes` et `regime` sont 🔒) : c'est un filtre de confort, désactivable, à la différence
// des deux couches de sécurité.
//
// INERTE PAR DÉFAUT (`onlyFavorites` absent ou faux) : la couche conserve tout et ne produit aucun
// motif de rejet. C'est le seul comportement compatible avec la décision figée « les favoris sont
// un marque-page rapide, ils n'influencent pas le moteur par défaut » (§10.1 ENGINE) — la couche
// existe en permanence dans le registre, elle ne fait quelque chose que sur demande explicite.
//
// Pourquoi une COUCHE et pas un pré-filtre du set initial dans `runExclusionPass` : voir l'en-tête
// de domain/layer-ids.ts. En résumé — le motif de rejet tombe gratuitement dans
// `RejectionSummary`, donc l'entonnoir du banc d'essai reste lisible.
//
// PLACÉE EN DERNIER dans `EXCLUSION_LAYERS` (voir exclusion-pass.ts) : l'ordre n'affecte pas le
// résultat (intersection d'ensembles) mais fixe la priorité de MOTIF, et « hors favoris » est le
// motif le moins informatif du registre. Une recette à la fois allergène et non favorite doit se
// voir reprocher l'allergène.
//
// Ne lit PAS le catalogue : les favoris sont des `RecipeId` et le filtre est une intersection
// d'ensembles — d'où un `configure` à un seul paramètre, contrairement aux autres couches
// d'exclusion qui doivent dériver les aliments de chaque recette.
//
// Dépendances autorisées : domain/, ./index.js (contrat local) — §2/§3 ENGINE.

import type { RecipeId, RejectionEntry } from '../domain/index.js'
import type { CandidateSet, ExclusionLayerResult, SelectionLayer } from './index.js'

export interface FavoriteLayerConfig {
  /** `req.onlyFavorites === true` — l'absence vaut `false`, la couche reste inerte. */
  readonly onlyFavorites: boolean
  readonly favorites: ReadonlySet<RecipeId>
}

export const favoriteLayer: SelectionLayer<FavoriteLayerConfig> = {
  id: 'favoris',
  kind: 'exclusion',
  critical: false,
  defaultWeight: 0,

  configure: (req) => ({
    onlyFavorites: req.onlyFavorites === true,
    favorites: req.favoriteRecipeIds,
  }),

  apply: (candidates: CandidateSet, config: FavoriteLayerConfig): ExclusionLayerResult => {
    if (!config.onlyFavorites) return { kept: candidates, rejected: [] }

    const kept = new Set<RecipeId>()
    const rejected: RejectionEntry[] = []

    for (const recipeId of candidates) {
      if (config.favorites.has(recipeId)) {
        kept.add(recipeId)
      } else {
        rejected.push({ recipeId, layerId: 'favoris', reason: 'hors favoris' })
      }
    }

    return { kept, rejected }
  },
}
