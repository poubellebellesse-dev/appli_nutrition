// engine/api/ — L5 API publique (docs/ENGINE.md §8)
//
// Rôle : surface volontairement étroite. Tout le reste (selection/, planning/, nutrition/,
// guards/) est interne au module engine/ ; seul ce fichier est destiné à être importé par
// data/ (qui construit le Catalog) et par l'UI (features/, via une future façade hors engine).
//
// `createEngine` est désormais RÉEL (P1b-3), dans la limite de ce qui est implémentable à ce
// stade : il enrichit le catalogue (index dérivés, §6.5 précision 8) et expose `version` /
// `catalogVersion` / `layers` / `layer(id)`. `suggestMeals`, `planWeek`, `rerollSlot`,
// `planLeftovers`, `buildShoppingList`, `analyzeWeek`, `scaleRecipe`, `suggestSubstitutions`
// lèvent explicitement « non implémenté (P1c) » — `suggestMeals` bout-en-bout (assemblage
// exclusion → score → diversification → explication) est le lot suivant, pas celui-ci.
//
// Dépendances autorisées : domain/, selection/, planning/, nutrition/, guards/ (§2 ENGINE — L5
// est au sommet de la pile engine/, elle peut connaître tout ce qui est en dessous d'elle).

import type {
  Catalog,
  FoodId,
  RecipeId,
  RerollOptions,
  ScaledRecipe,
  ShoppingList,
  ShoppingOptions,
  SlotRef,
  Substitution,
  SuggestionRequest,
  SuggestionResult,
  UserProfile,
  WeekPlan,
  WeekPlanRequest,
} from '../domain/index.js'
import type { LayerId } from '../domain/index.js'
import type { LayerDescriptor, SelectionLayer } from '../selection/index.js'
import { EXCLUSION_LAYERS, LAYER_DESCRIPTORS, SCORING_LAYERS } from '../selection/index.js'
import type { NutritionReport } from '../nutrition/index.js'
import { attachDerivedIndexes } from '../nutrition/index.js'

export interface Engine {
  readonly version: string
  readonly catalogVersion: string

  suggestMeals(req: SuggestionRequest): SuggestionResult
  planWeek(req: WeekPlanRequest): WeekPlan
  rerollSlot(plan: WeekPlan, slot: SlotRef, opts?: RerollOptions): WeekPlan
  planLeftovers(plan: WeekPlan): WeekPlan
  buildShoppingList(plan: WeekPlan, opts?: ShoppingOptions): ShoppingList
  analyzeWeek(plan: WeekPlan, profile: UserProfile): NutritionReport
  scaleRecipe(id: RecipeId, portions: number): ScaledRecipe
  suggestSubstitutions(id: RecipeId, missing: readonly FoodId[]): readonly Substitution[]

  /** Accès individuel à une couche — permet des écrans autonomes sans pipeline complet (§6.8 ENGINE). */
  layer<C>(id: LayerId): SelectionLayer<C>
  /** id · nature · critique · poids effectif. */
  readonly layers: readonly LayerDescriptor[]
}

/**
 * Version du MOTEUR (pas du catalogue, voir `catalogVersion` — celle-là vient de `Catalog.version`,
 * fournie par `data/`). Aucune lecture de fichier possible ici (§3 ENGINE : engine/ n'a aucune
 * dépendance externe, zéro I/O) — figée en constante, alignée sur `package.json` à la racine du
 * dépôt ; à faire évoluer à la main tant qu'aucun mécanisme de build ne l'injecte automatiquement.
 */
const ENGINE_VERSION = '0.1.0'

/** Les 13 couches IMPLÉMENTÉES du registre (6 exclusion + 7 score) — voir `LAYER_DESCRIPTORS` pour
 * les 17 déclarées (4 de plus, encore P2 : `pantry`, `occasion`, `topic`, `cost`). */
const IMPLEMENTED_LAYERS: readonly SelectionLayer[] = [...EXCLUSION_LAYERS, ...SCORING_LAYERS]

/**
 * Résout une couche par id (§6.8 ENGINE). Distingue explicitement deux échecs plutôt que de tout
 * confondre dans un seul message générique : un id DÉCLARÉ au registre mais pas encore câblé
 * (`pantry`/`occasion`/`topic`/`cost`, P2) n'est pas la même erreur qu'un id absent de
 * `LAYER_DESCRIPTORS` (faute de frappe, id d'une future version…).
 */
function resolveLayer<C>(id: LayerId): SelectionLayer<C> {
  const found = IMPLEMENTED_LAYERS.find((layer) => layer.id === id)
  if (found) return found as SelectionLayer<C>

  if (LAYER_DESCRIPTORS.some((descriptor) => descriptor.id === id)) {
    throw new Error(
      `engine.layer('${id}') : couche déclarée au registre (LAYER_DESCRIPTORS) mais pas encore ` +
        `implémentée (P2) — voir docs/ENGINE.md §6.3`
    )
  }
  throw new Error(`engine.layer('${id}') : id de couche inconnu (absent de LAYER_DESCRIPTORS)`)
}

/** Les 8 méthodes d'orchestration restent hors périmètre de ce lot (§8 ENGINE) — `suggestMeals`
 * bout-en-bout est le lot suivant, pas celui-ci. */
function notImplemented(methodName: string): never {
  throw new Error(`Engine.${methodName} : non implémenté (P1c)`)
}

/**
 * Assemble le moteur (§8 ENGINE) : enrichit le catalogue reçu avec les index dérivés
 * (`attachDerivedIndexes`, §6.5 précision 8 — fonction PURE, exécutée une seule fois ici, jamais
 * par `catalog/build.mjs`) et conserve ce catalogue enrichi en fermeture pour les méthodes futures
 * (P1c — `suggestMeals` etc. le consommeront). Rien d'autre n'est câblé dans ce lot : les 8
 * méthodes d'orchestration lèvent explicitement, `layer`/`layers` exposent le registre.
 */
export function createEngine(catalog: Catalog): Engine {
  const enrichedCatalog = attachDerivedIndexes(catalog)

  return {
    version: ENGINE_VERSION,
    catalogVersion: enrichedCatalog.version,

    suggestMeals: () => notImplemented('suggestMeals'),
    planWeek: () => notImplemented('planWeek'),
    rerollSlot: () => notImplemented('rerollSlot'),
    planLeftovers: () => notImplemented('planLeftovers'),
    buildShoppingList: () => notImplemented('buildShoppingList'),
    analyzeWeek: () => notImplemented('analyzeWeek'),
    scaleRecipe: () => notImplemented('scaleRecipe'),
    suggestSubstitutions: () => notImplemented('suggestSubstitutions'),

    layer: <C>(id: LayerId) => resolveLayer<C>(id),
    layers: LAYER_DESCRIPTORS,
  }
}
