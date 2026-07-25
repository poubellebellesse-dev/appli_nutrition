// engine/nutrition/reference-intakes.ts — apports de référence par profil (docs/ENGINE.md §5.1,
// VNR ANSES/EFSA). Fonction PURE.
//
// Retourne un `NutrientVector` aligné sur l'ordre de `catalog.nutrients` (§9.1 ENGINE) — même
// convention d'index que `aggregateRecipe`/`computeRecipeNutrients`.
//
// DEUX MODES :
//
// 1. VNR À PLAT (défaut) : chaque nutriment prend directement son `vnrAdulte` ; `vnrAdulte ===
//    null` → 0, ce qui le fait IGNORER par `scoreNutri` (cible nulle = nutriment sauté, jamais
//    compté comme un écart parfait ou maximal — voir selection/scoring/nutri.ts). C'est le mode
//    retenu dès que `computeEnergyNeeds` retourne `null` (taille/poids inconnus, energy-needs.ts).
//
// 2. RÉ-ÉCHELONNÉ : quand l'énergie personnalisée est disponible, `ratio = besoin /
//    vnrAdulte(énergie)` est appliqué AUX SEULS nutriments de `categorie === 'macronutriment'`.
//    Règle non évidente à retenir : les `mineral` et `vitamine` GARDENT leur VNR à plat — ce sont
//    des besoins ABSOLUS (le fer, le calcium, la vitamine C…), pas des proportions caloriques.
//    Quelqu'un qui mange davantage n'a pas besoin de plus de fer ; seuls les macronutriments
//    (protéines, lipides, glucides, fibres, et l'énergie elle-même) suivent le besoin énergétique
//    personnalisé.
//
// Le nutriment `energie` est identifié par `Nutrient.code === 'energie'` (catalog/build.mjs
// NUTRIENTS) — `code`, à la différence de `id` (`NutrientId` brandé), est un `string` nu,
// directement comparable. Absent du catalogue OU `vnrAdulte` nul → ratio non calculable → repli
// sur le mode à plat. Jamais de division par zéro.
//
// Dépendances autorisées : domain/, ./energy-needs.js — §2/§3 ENGINE.

import type { Catalog } from '../domain/index.js'
import type { ResolveReferenceIntakes } from './index.js'
import { computeEnergyNeeds } from './energy-needs.js'

function flatVector(catalog: Catalog): Float64Array {
  const vector = new Float64Array(catalog.nutrients.length)
  for (let i = 0; i < catalog.nutrients.length; i++) {
    vector[i] = catalog.nutrients[i]!.vnrAdulte ?? 0
  }
  return vector
}

export const resolveReferenceIntakes: ResolveReferenceIntakes = (profile, catalog) => {
  const flat = flatVector(catalog)

  const besoin = computeEnergyNeeds(profile)
  if (besoin === null) return flat

  const vnrEnergie = catalog.nutrients.find((n) => n.code === 'energie')?.vnrAdulte ?? null
  if (vnrEnergie === null || vnrEnergie === 0) return flat

  const ratio = besoin / vnrEnergie
  const rescaled = new Float64Array(flat)
  for (let i = 0; i < catalog.nutrients.length; i++) {
    if (catalog.nutrients[i]!.categorie === 'macronutriment') {
      rescaled[i] = flat[i]! * ratio
    }
  }
  return rescaled
}
