// engine/selection/equipement.ts — couche d'exclusion `equipement` (docs/ENGINE.md §6.5)
//
// Non critique. Doit exclure une recette qui requiert un équipement `niveau = 'requis'` absent
// chez l'utilisateur (§6.5 ENGINE : seul `requis` exclut ; `accelere` est un critère de score,
// hors périmètre exclusion ; `informatif` n'a aucun effet moteur).
//
// ⚠️ Codée DÉFENSIVEMENT (tâche P1a) : le catalogue actuel n'a AUCUNE table équipement — ni
// `recipe_equipment`/`equipment` côté catalog.db, ni `user_equipment` côté profil, ni même de
// champ correspondant sur `Catalog` (voir engine/domain/catalog.ts). Tant que cette donnée
// n'existe pas, la couche reste STRUCTURELLEMENT INERTE : `apply` ne rejette jamais rien, quels
// que soient les candidats. Elle est néanmoins câblée dans le registre (§6.3 ENGINE) et conforme
// au contrat `SelectionLayer`, prête à recevoir la vraie logique le jour où le catalogue expose
// l'équipement, sans changer sa place dans le pipeline.
//
// Dépendances autorisées : domain/, ./index.js (contrat local) — §2/§3 ENGINE.

import type { RecipeId } from '../domain/index.js'
import type { ExclusionLayerResult, SelectionLayer } from './index.js'

/** Vide tant qu'aucune donnée d'équipement n'existe dans `Catalog` (voir en-tête du fichier). */
export type EquipmentLayerConfig = Record<string, never>

export const equipmentLayer: SelectionLayer<EquipmentLayerConfig> = {
  id: 'equipement',
  kind: 'exclusion',
  critical: false,
  defaultWeight: 0,

  configure: () => ({}),

  apply: (candidates): ExclusionLayerResult => {
    // Inerte : aucune donnée d'équipement disponible → tout candidat est conservé, jamais rejeté.
    return { kept: new Set<RecipeId>(candidates), rejected: [] }
  },
}
