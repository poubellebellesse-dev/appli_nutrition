// engine/selection/envie.ts — couche d'exclusion `envie` (décision 71, lot `retour-6`)
//
// Les pastilles d'envie d'Aujourd'hui (Léger/Consistant, Froid/Chaud, Salé/Sucré) RETIRENT les plats
// tombés du mauvais côté d'un axe demandé. Elles ne font plus seulement classer : cliquer « Froid »
// et recevoir douze cartes dont la moitié est chaude, c'est ne pas avoir été écouté.
//
// ⛔ CE N'EST PAS `craving` DEVENUE EXCLUSIVE. `craving` reste une couche de SCORE, et elle continue
// de classer à l'intérieur de ce qui reste (le plus froid d'abord parmi les froids).
// `assertScoringLayersNeverExclude` (guards/) est un garde-fou de sécurité : il ne se contourne pas
// en faisant exclure une couche de score. Le filtre est une couche à part, sous son propre nom.
//
// ⚠️ LE CÔTÉ SE LIT AU SIGNE STRICT : `> 0` pour Chaud/Consistant/Sucré, `< 0` pour
// Froid/Léger/Salé. Une recette à `0` sur un axe demandé n'est d'aucun côté, elle est retirée dans
// les deux sens. Une valeur d'envie à `0` (possible dans `CravingAxes`, jamais émise par l'écran) ne
// désigne aucun côté : l'axe ne filtre pas.
//
// INERTE PAR DÉFAUT (`envie` null, ou aucun axe signé) : la couche conserve tout et ne produit aucun
// motif. Un plan de semaine ne porte pas de `MealContext` — la couche n'y existe que pour la forme.
//
// ⚠️ ELLE NE RELÂCHE RIEN. Quand la pile ne laisse aucun plat, lâcher un axe (décision 79) est un
// geste d'ÉCRAN, annoncé à l'utilisateur ; le moteur, lui, rend exactement ce qu'on lui a demandé,
// ou lève `NoViableRecipeError`.
//
// PLACÉE APRÈS `favoris`, en dernier : l'ordre fixe la priorité de MOTIF, et une recette à la fois
// allergène et « pas froide » doit se voir reprocher l'allergène.
//
// Dépendances autorisées : domain/, ./index.js (contrat local) — §2/§3 ENGINE.

import type { Catalog, CravingAxes, RecipeId, RejectionEntry, SensoryAxes } from '../domain/index.js'
import type { CandidateSet, ExclusionLayerResult, SelectionLayer } from './index.js'

type AxeEnvie = 'legerConsistant' | 'chaudFroid' | 'sucreSale'

/** Dans l'ordre de relâchement de la décision 79 — c'est aussi l'ordre dans lequel un motif nomme l'axe. */
const AXES: readonly AxeEnvie[] = ['legerConsistant', 'chaudFroid', 'sucreSale']

const POLE: Readonly<Record<AxeEnvie, { readonly bas: string; readonly haut: string }>> = {
  legerConsistant: { bas: 'léger', haut: 'consistant' },
  chaudFroid: { bas: 'froid', haut: 'chaud' },
  sucreSale: { bas: 'salé', haut: 'sucré' },
}

export interface EnvieLayerConfig {
  /** Les seuls axes qui désignent un côté — vide = couche inerte. */
  readonly axes: readonly { readonly axe: AxeEnvie; readonly signe: -1 | 1 }[]
  readonly recipes: Catalog['recipes']
}

function axesSignes(envie: CravingAxes | null): EnvieLayerConfig['axes'] {
  if (envie === null) return []
  const signes: { axe: AxeEnvie; signe: -1 | 1 }[] = []
  for (const axe of AXES) {
    const valeur = envie[axe]
    if (valeur === null || valeur === 0) continue
    signes.push({ axe, signe: valeur > 0 ? 1 : -1 })
  }
  return signes
}

/** Le premier axe demandé que la recette ne tient pas, ou `null` si elle les tient tous. */
function axeNonTenu(axesRecette: SensoryAxes, demandes: EnvieLayerConfig['axes']): string | null {
  for (const { axe, signe } of demandes) {
    const tenu = signe > 0 ? axesRecette[axe] > 0 : axesRecette[axe] < 0
    if (!tenu) return signe > 0 ? POLE[axe].haut : POLE[axe].bas
  }
  return null
}

export const envieLayer: SelectionLayer<EnvieLayerConfig> = {
  id: 'envie',
  kind: 'exclusion',
  critical: false,
  defaultWeight: 0,

  configure: (req, catalog) => ({
    axes: axesSignes(req.context.envie),
    recipes: catalog.recipes,
  }),

  apply: (candidates: CandidateSet, config: EnvieLayerConfig): ExclusionLayerResult => {
    if (config.axes.length === 0) return { kept: candidates, rejected: [] }

    const kept = new Set<RecipeId>()
    const rejected: RejectionEntry[] = []

    for (const recipeId of candidates) {
      const recette = config.recipes.get(recipeId)
      // Une recette absente du catalogue n'a aucun axe : elle ne tient aucun côté demandé.
      const manque = recette === undefined ? POLE[config.axes[0]!.axe].bas : axeNonTenu(recette.axes, config.axes)
      if (manque === null) {
        kept.add(recipeId)
      } else {
        rejected.push({ recipeId, layerId: 'envie', reason: `pas ${manque}` })
      }
    }

    return { kept, rejected }
  },
}
