// engine/selection/equipement.ts — couche d'exclusion `equipement` (docs/ENGINE.md §6.5)
//
// Non critique (§6.3 ENGINE — seules `allergenes` et `regime` sont 🔒). Exclut une recette dont un
// équipement de niveau `requis` ne figure pas dans le matériel déclaré par l'utilisateur.
//
// ⛔ UN SEUL DES TROIS NIVEAUX EXCLUT. `requis` = infaisable sans. `accelere` (faisable à la main,
// plus lentement) et `informatif` sont IGNORÉS ICI, et ce n'est pas un raccourci : §6.5 avertit que
// sans cette distinction, « ne pas posséder de mixeur supprimerait la moitié du catalogue ». La
// couche ne lit donc que `requis` — les 36 `accelere` du catalogue relèvent d'un critère de score
// qui n'existe pas encore, les 1 031 `informatif` n'ont aucun effet moteur et ne servent que la
// fiche recette.
//
// ⛔ INERTE QUAND `ownedEquipmentIds === null` — jamais déclaré n'est pas « ne possède rien ». Sans
// cette distinction, tout utilisateur n'ayant pas ouvert l'écran Paramètres perdrait les 234
// recettes à source de chaleur, c'est-à-dire tout le monde au premier lancement. Voir
// `HardConstraints.ownedEquipmentIds`, où le tri-état est argumenté, et `temps.ts`, qui applique le
// même parti à `availableMin`.
//
// (Cette couche a été INERTE de P1a jusqu'ici, faute de table équipement au catalogue. Elle ne
// l'est plus : `catalog/equipment/*.yaml` et `recipe_equipment` existent, et `Catalog.equipment`
// les expose.)
//
// Dépendances autorisées : domain/, ./index.js (contrat local) — §2/§3 ENGINE.

import type { EquipmentId, RecipeId, RejectionEntry } from '../domain/index.js'
import type { ExclusionLayerResult, SelectionLayer } from './index.js'

export interface EquipmentLayerConfig {
  /** `null` = jamais déclaré → couche inerte. `[]` déclaré vide → les `requis` tombent. */
  readonly ownedIds: ReadonlySet<EquipmentId> | null
  /** Seulement les recettes portant au moins un `requis` — les autres ne peuvent pas être exclues. */
  readonly requiredByRecipe: ReadonlyMap<RecipeId, readonly EquipmentId[]>
  /** Pour nommer l'ustensile manquant dans le motif plutôt que d'afficher un identifiant. */
  readonly termeById: ReadonlyMap<EquipmentId, string>
}

export const equipmentLayer: SelectionLayer<EquipmentLayerConfig> = {
  id: 'equipement',
  kind: 'exclusion',
  critical: false,
  defaultWeight: 0,

  configure: (req, catalog) => {
    const requiredByRecipe = new Map<RecipeId, readonly EquipmentId[]>()
    for (const recipe of catalog.recipes.values()) {
      const requis = recipe.equipements
        .filter((equipement) => equipement.niveau === 'requis')
        .map((equipement) => equipement.equipmentId)
      if (requis.length > 0) requiredByRecipe.set(recipe.id, requis)
    }

    const termeById = new Map<EquipmentId, string>()
    for (const equipement of catalog.equipment.values()) termeById.set(equipement.id, equipement.terme)

    const owned = req.constraints.ownedEquipmentIds
    return { ownedIds: owned === null ? null : new Set(owned), requiredByRecipe, termeById }
  },

  apply: (candidates, config): ExclusionLayerResult => {
    const kept = new Set<RecipeId>()
    const rejected: RejectionEntry[] = []

    // Jamais déclaré : rien à comparer, donc rien n'est exclu. Voir l'en-tête du fichier.
    if (config.ownedIds === null) {
      for (const recipeId of candidates) kept.add(recipeId)
      return { kept, rejected }
    }

    const ownedIds = config.ownedIds
    for (const recipeId of candidates) {
      const requis = config.requiredByRecipe.get(recipeId)
      const manquants = requis === undefined ? [] : requis.filter((id) => !ownedIds.has(id))

      if (manquants.length === 0) {
        kept.add(recipeId)
        continue
      }

      const noms = manquants.map((id) => config.termeById.get(id) ?? id).join(', ')
      rejected.push({
        recipeId,
        layerId: 'equipement',
        reason: `matériel requis non déclaré : ${noms}`,
      })
    }

    return { kept, rejected }
  },
}
