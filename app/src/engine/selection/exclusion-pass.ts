// engine/selection/exclusion-pass.ts — la passe d'exclusion (docs/ENGINE.md §6.4)
//
// Fonction PURE : applique les couches d'exclusion du registre en INTERSECTION SUCCESSIVE, dans
// l'ordre. L'ordre est indifférent pour le RÉSULTAT (une intersection d'ensembles commute), mais
// fixe la PRIORITÉ DE MOTIF quand une recette est rejetée par plusieurs couches — premier motif
// rencontré = motif retenu (§6.3, §6.4 ENGINE). Point de départ : les recettes du créneau demandé
// (`catalog.indexes.recipesBySlot`), comme le pseudo-code de §6.4.
//
// Portée P1a : seules les 4 couches d'exclusion sont câblées ici (`EXCLUSION_LAYERS`). Aucun
// scoring, aucune agrégation en `SuggestionResult` — voir engine/api/index.ts (stub, P1b/P2).
// `layers` reste paramétrable (au lieu de coder `EXCLUSION_LAYERS` en dur dans le corps de la
// fonction) pour permettre des tests unitaires ciblés sur un sous-ensemble de couches.
//
// Dépendances autorisées : domain/, ./index.js et les modules de couches locaux — §2/§3 ENGINE.

import type { Catalog, RecipeId, RejectionEntry, SuggestionRequest } from '../domain/index.js'
import type { CandidateSet, ExclusionLayerResult, SelectionLayer } from './index.js'
import { allergenLayer } from './allergenes.js'
import { dietLayer } from './regime.js'
import { timeLayer } from './temps.js'
import { equipmentLayer } from './equipement.js'

/**
 * Registre des couches d'exclusion, dans l'ordre de priorité de motif (§6.3 ENGINE) : allergènes
 * puis régime (toutes deux 🔒 `critical`), puis temps, puis équipement.
 *
 * Chaque couche est déclarée ci-dessus avec son `Config` propre (`SelectionLayer<XConfig>`), ce
 * qui garde `configure`/`apply` entièrement typés pour qui l'utilise seule (§6.8 ENGINE). Le
 * cast `as SelectionLayer` ici est nécessaire pour les stocker ensemble dans un tableau
 * hétérogène : sous `strict`, TypeScript vérifie le paramètre `config` d'`apply` en position
 * contravariante, donc `SelectionLayer<X>` n'est structurellement PAS assignable à
 * `SelectionLayer<unknown>` sans ce cast — la pile d'exécution ci-dessous ne regarde jamais à
 * l'intérieur de `Config`, elle le fait seulement transiter de `configure` vers `apply` de la
 * même couche, donc aucune perte de sûreté réelle.
 */
export const EXCLUSION_LAYERS: readonly SelectionLayer[] = [
  allergenLayer as SelectionLayer,
  dietLayer as SelectionLayer,
  timeLayer as SelectionLayer,
  equipmentLayer as SelectionLayer,
]

export interface ExclusionPassResult {
  readonly candidates: CandidateSet
  readonly rejections: readonly RejectionEntry[]
}

/**
 * Exécute la passe d'exclusion (§6.4 ENGINE) : intersection successive des couches actives,
 * premier motif de rejet conservé par recette. `layers` par défaut = `EXCLUSION_LAYERS` (le
 * registre complet, dans l'ordre de priorité de motif) ; paramétrable pour isoler un
 * sous-ensemble de couches en test.
 */
export function runExclusionPass(
  catalog: Catalog,
  req: SuggestionRequest,
  layers: readonly SelectionLayer[] = EXCLUSION_LAYERS
): ExclusionPassResult {
  const initial = catalog.indexes.recipesBySlot.get(req.context.creneau) ?? new Set<RecipeId>()

  let candidates: CandidateSet = initial
  const rejectedRecipeIds = new Set<RecipeId>()
  const rejections: RejectionEntry[] = []

  for (const layer of layers) {
    if (layer.kind !== 'exclusion') {
      throw new TypeError(`runExclusionPass : la couche '${layer.id}' n'est pas de nature 'exclusion'`)
    }

    const config = layer.configure(req, catalog)
    // Sûr par construction : `layer.kind === 'exclusion'` garantit que `apply` retourne un
    // `ExclusionLayerResult` (§6.2 ENGINE — le contrat associe la nature à la forme du résultat).
    const result = layer.apply(candidates, config) as ExclusionLayerResult

    for (const entry of result.rejected) {
      // Premier motif rencontré = motif retenu (§6.4 ENGINE). En intersection successive, une
      // recette déjà rejetée ne peut normalement plus apparaître dans `result.rejected` d'une
      // couche suivante (elle n'est plus dans `candidates`) — ce garde ne fait qu'ajouter une
      // protection si une couche mal écrite rejetait malgré tout un id hors `candidates`.
      if (!rejectedRecipeIds.has(entry.recipeId)) {
        rejectedRecipeIds.add(entry.recipeId)
        rejections.push(entry)
      }
    }

    candidates = result.kept
  }

  return { candidates, rejections }
}
