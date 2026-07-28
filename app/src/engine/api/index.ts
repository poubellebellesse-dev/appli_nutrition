// engine/api/ — L5 API publique (docs/ENGINE.md §8)
//
// Rôle : surface volontairement étroite. Tout le reste (selection/, planning/, nutrition/,
// guards/) est interne au module engine/ ; seul ce fichier est destiné à être importé par
// data/ (qui construit le Catalog) et par l'UI (features/, via une future façade hors engine).
//
// `createEngine` est désormais RÉEL (P1b-3) : il enrichit le catalogue (index dérivés, §6.5
// précision 8) et expose `version` / `catalogVersion` / `layers` / `layer(id)`. `suggestMeals`
// est maintenant RÉEL également (P1c, ce lot) — assemblage bout-en-bout exclusion → garde-fou
// allergènes → score → classement + diversification → explication → garde-fous finaux (§6.4, §8
// ENGINE), voir `runSuggestMeals` plus bas. `planWeek`, `rerollSlot`, `planLeftovers`,
// `buildShoppingList`, `analyzeWeek`, `scaleRecipe`, `suggestSubstitutions` lèvent toujours
// explicitement « non implémenté (P1c) » — ce sont des lots ultérieurs (planning/, hors périmètre
// de celui-ci).
//
// Dépendances autorisées : domain/, selection/, planning/, nutrition/, guards/ (§2 ENGINE — L5
// est au sommet de la pile engine/, elle peut connaître tout ce qui est en dessous d'elle).

import type {
  AlternativeSuggestion,
  Catalog,
  EngineDiagnostics,
  ExclusionLayerId,
  FoodId,
  PipelineTrace,
  RecipeId,
  RejectionSummary,
  RerollOptions,
  ScaledRecipe,
  ScoredSuggestion,
  ScoreWeights,
  ScoringLayerId,
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
import { suggestAlternatives as runSuggestAlternatives } from '../selection/alternatives.js'
import { planWeek as runPlanWeek } from '../planning/plan-week.js'
import { planLeftovers as runPlanLeftovers } from '../planning/plan-leftovers.js'
import type { LayerId } from '../domain/index.js'
import { NoViableRecipeError } from '../domain/index.js'
import type { ExclusionPassResult, LayerDescriptor, SelectionLayer } from '../selection/index.js'
import {
  DEFAULT_MMR_LAMBDA,
  EXCLUSION_LAYERS,
  LAYER_DESCRIPTORS,
  SCORING_LAYERS,
  buildSimilarityProfiles,
  diversify,
  explainSuggestion,
  rankScoredCandidates,
  runExclusionPass,
  runScoringPass,
  similarity,
} from '../selection/index.js'
import type { NutritionReport } from '../nutrition/index.js'
import { attachDerivedIndexes } from '../nutrition/index.js'
import {
  checkCalorieFloor, assertCriticalLayersRan, assertNoDeclaredAllergen, assertNoTherapeuticClaim } from '../guards/index.js'

export interface Engine {
  readonly version: string
  readonly catalogVersion: string

  suggestMeals(req: SuggestionRequest): SuggestionResult
  /**
   * « Je n'aime pas cet ingrédient » — §8.4 ENGINE, décision 26.
   *
   * ⚠️ Prend un `SuggestionRequest`, pas seulement `(recipeId, dislikedFoodId)` comme le proposait
   * la spec initiale de §8 : sans lui, les alternatives ne repasseraient pas les filtres et
   * pourraient proposer un plat contenant un allergène déclaré.
   */
  suggestAlternatives(
    req: SuggestionRequest,
    recipeId: RecipeId,
    dislikedFoodId: FoodId
  ): AlternativeSuggestion
  planWeek(req: WeekPlanRequest): WeekPlan
  rerollSlot(plan: WeekPlan, slot: SlotRef, opts?: RerollOptions): WeekPlan
  /**
   * Place les restes dans un plan existant (§7.3) — rend un NOUVEAU plan, n'altère pas l'entrée.
   * `convives` = assiettes servies par repas, défaut 1. Un reste REMPLACE un plat prévu ; il ne
   * s'ajoute pas.
   *
   * ⚠️ Signature ÉTENDUE par rapport à §7.3 (`(plan, catalog)`) : `profile` est nécessaire pour
   * RECALCULER les avertissements de plancher calorique — les totaux du jour changent quand un
   * reste remplace un plat, et conserver les anciens ferait mentir le plan. `convives` l'est pour
   * calculer les restes eux-mêmes : `WeekPlan` ne dit pas combien de personnes mangent.
   */
  planLeftovers(plan: WeekPlan, profile: UserProfile, convives?: number): WeekPlan
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

/** Les 7 méthodes de planification restent hors périmètre de ce lot (§8 ENGINE, planning/ non
 * câblé) — `suggestMeals` bout-en-bout, lui, est RÉEL (voir `runSuggestMeals` plus bas). */
function notImplemented(methodName: string): never {
  throw new Error(`Engine.${methodName} : non implémenté (P1c)`)
}

// ------------------------------------------------------------------------------------------
// suggestMeals — assemblage bout-en-bout (§6.4, §8 ENGINE). Le pipeline n'invente aucun
// algorithme : il enchaîne dans l'ordre les briques déjà codées et testées de selection/ et
// guards/, comme le pseudo-code `runPipeline` de §6.4 le prescrit.
// ------------------------------------------------------------------------------------------

/** Les 11 `ScoringLayerId` du registre complet (`LAYER_DESCRIPTORS`) — sert à compléter à zéro
 * les couches non implémentées (`pantry`/`occasion`/`topic`/`cost`) pour `EngineDiagnostics.weights`
 * (§8.2 ENGINE), qui attend un `ScoreWeights` COMPLET, alors que `runScoringPass` ne rend que les
 * couches ACTIVES (sparsité assumée et documentée dans scoring-pass.ts — la complétion est
 * explicitement la responsabilité de l'appelant, donc d'ici). */
const ALL_SCORING_LAYER_IDS: readonly ScoringLayerId[] = LAYER_DESCRIPTORS.filter(
  (descriptor) => descriptor.kind === 'scoring'
).map((descriptor) => descriptor.id as ScoringLayerId)

/** Sous-ensemble `critical: true` du registre (aujourd'hui `allergenes` et `regime`, les deux
 * couches d'exclusion 🔒) — le sous-ensemble ATTENDU que `assertCriticalLayersRan` compare à la
 * trace RÉELLE d'exécution (§6.3 ENGINE). */
const CRITICAL_LAYER_IDS: readonly LayerId[] = LAYER_DESCRIPTORS.filter((descriptor) => descriptor.critical).map(
  (descriptor) => descriptor.id
)

function completeScoreWeights(active: Partial<ScoreWeights>): ScoreWeights {
  const complete = {} as Record<ScoringLayerId, number>
  for (const id of ALL_SCORING_LAYER_IDS) complete[id] = active[id] ?? 0
  return complete
}

/** Construit `RejectionSummary` (§8.2, §6.8 ENGINE — la matière de l'entonnoir) à partir de la
 * sortie brute de `runExclusionPass` : compte PAR COUCHE, dérivé des VRAIS rejets rendus par la
 * passe, jamais un total recopié d'ailleurs. */
function buildRejectionSummary(totalInitial: number, exclusion: ExclusionPassResult): RejectionSummary {
  const byLayer = new Map<ExclusionLayerId, number>()
  for (const entry of exclusion.rejections) {
    byLayer.set(entry.layerId, (byLayer.get(entry.layerId) ?? 0) + 1)
  }
  return {
    totalInitial,
    totalRejected: exclusion.rejections.length,
    byLayer,
    entries: exclusion.rejections,
  }
}

/** La couche d'exclusion qui a écarté le plus de candidats (§6.3 ENGINE : priorité de motif — à
 * compte égal, la couche la plus tôt dans `EXCLUSION_LAYERS` l'emporte, comparaison stricte `>`).
 * `null` si rien n'a été rejeté (le créneau demandé était déjà vide au départ). */
function dominantRejectionLayer(
  byLayer: ReadonlyMap<ExclusionLayerId, number>
): { readonly layerId: ExclusionLayerId; readonly count: number } | null {
  let dominant: ExclusionLayerId | null = null
  let dominantCount = 0
  for (const layer of EXCLUSION_LAYERS) {
    const layerId = layer.id as ExclusionLayerId
    const count = byLayer.get(layerId) ?? 0
    if (count > dominantCount) {
      dominant = layerId
      dominantCount = count
    }
  }
  return dominant === null ? null : { layerId: dominant, count: dominantCount }
}

/** Message de `NoViableRecipeError` (§8.3 ENGINE) — porte le MOTIF DOMINANT en toutes lettres,
 * jamais un message générique : c'est ce que l'UI transformera en écran « assouplir un critère ». */
function describeNoViableRecipe(rejected: RejectionSummary): string {
  const dominant = dominantRejectionLayer(rejected.byLayer)
  if (dominant === null) {
    return (
      'suggestMeals : 0 candidat après exclusion — le créneau demandé ne contient déjà aucune ' +
      'recette dans le catalogue (aucun rejet enregistré) — §8.3 ENGINE'
    )
  }
  const example = rejected.entries.find((entry) => entry.layerId === dominant.layerId)?.reason
  return (
    `suggestMeals : 0 candidat après exclusion — motif dominant '${dominant.layerId}' ` +
    `(${dominant.count} recette(s) écartée(s) sur ce motif)` +
    (example ? ` — ex. « ${example} »` : '') +
    ' — §8.3 ENGINE : écran « assouplir un critère »'
  )
}

/** Accesseur de similarité attendu par `diversify` (§6.6 ENGINE) — pont `Catalog` →
 * `RecipeSimilarityProfile` construit une fois, réutilisé pour chaque paire comparée. */
function buildSimilarityAccessor(catalog: Catalog): (a: RecipeId, b: RecipeId) => number {
  const profiles = buildSimilarityProfiles(catalog)
  return (a, b) => similarity(profiles.get(a)!, profiles.get(b)!)
}

/**
 * Assemblage bout-en-bout de `suggestMeals` (§6.4, §8 ENGINE), dans l'ordre :
 *   (a) candidats initiaux = `catalog.indexes.recipesBySlot` pour le créneau demandé ;
 *   (b) `runExclusionPass` ;
 *   (c) `assertNoDeclaredAllergen` sur les candidats CONSERVÉS ;
 *   (d) 0 candidat → `NoViableRecipeError` avec le motif dominant ;
 *   (e) `runScoringPass` ;
 *   (f) classement déterministe puis `diversify` (ou classement brut si `skipDiversification`) ;
 *   (g) `explainSuggestion` sur l'ENSEMBLE des candidats scorés, par suggestion retenue ;
 *   (h) `assertNoTherapeuticClaim` sur TOUTES les explications produites, avant de retourner.
 * `assertCriticalLayersRan` (§6.3 ENGINE) est vérifié entre (e) et (f), dès que la trace réelle
 * d'exécution (couches d'exclusion + couches de score actives) est connue.
 *
 * `catalog` reçu ici est déjà le catalogue ENRICHI (`attachDerivedIndexes`, appelé une seule fois
 * par `createEngine`) — cette fonction ne le réenrichit jamais.
 */
function runSuggestMeals(catalog: Catalog, req: SuggestionRequest, now: (() => number) | undefined): SuggestionResult {
  const startedAt = now?.() ?? null

  // (a)
  const initialCandidates = catalog.indexes.recipesBySlot.get(req.context.creneau) ?? new Set<RecipeId>()

  // (b)
  const exclusionResult = runExclusionPass(catalog, req)

  // (c) — ceinture de sécurité (§5.2 ARCHITECTURE), sur les candidats CONSERVÉS, avant toute
  // autre étape : un allergène qui passerait le filtre à cause d'un bug de la couche `allergenes`
  // ne doit jamais atteindre le scoring ni l'utilisateur.
  assertNoDeclaredAllergen(exclusionResult.candidates, catalog, req.constraints)

  const rejected = buildRejectionSummary(initialCandidates.size, exclusionResult)

  // (d)
  if (exclusionResult.candidates.size === 0) {
    throw new NoViableRecipeError(describeNoViableRecipe(rejected), rejected)
  }

  // (e)
  const scoringResult = runScoringPass(catalog, req, exclusionResult.candidates)

  // Trace réelle du pipeline (§6.3 ENGINE) : les 6 couches d'exclusion tournent TOUJOURS
  // (`runExclusionPass` ne filtre aucune couche par défaut, voir son en-tête) ; les couches de
  // score ACTIVES sont exactement les clés de `scoringResult.weights` (une couche à poids ≤ 0
  // n'est jamais exécutée, §6.3 règle 2 de scoring-pass.ts). `scoringLayerCounts` n'est pas
  // fabriqué : `runScoringPass` a déjà vérifié en interne (`assertScoringLayersNeverExclude`) que
  // chaque couche active rend EXACTEMENT `scoringResult.scores.size` scores.
  const scoringLayersRun = Object.keys(scoringResult.weights) as readonly ScoringLayerId[]
  const trace: PipelineTrace = {
    layersRun: [...EXCLUSION_LAYERS.map((layer) => layer.id), ...scoringLayersRun],
    criticalLayerIds: CRITICAL_LAYER_IDS,
    excludedCandidateCounts: rejected.byLayer,
    scoringCandidateCount: exclusionResult.candidates.size,
    scoringLayerCounts: new Map(scoringLayersRun.map((id) => [id, scoringResult.scores.size])),
  }
  assertCriticalLayersRan(trace)

  // (f)
  const ranked = rankScoredCandidates(scoringResult.scores)
  const limit = req.limit ?? 5

  const selected: readonly { readonly recipeId: RecipeId; readonly score: number }[] = req.skipDiversification
    ? ranked.slice(0, limit)
    : diversify(ranked, limit, req.mmrLambda ?? DEFAULT_MMR_LAMBDA, buildSimilarityAccessor(catalog))

  // (g)
  const suggestions: ScoredSuggestion[] = selected.map(({ recipeId, score }) => {
    const recipe = catalog.recipes.get(recipeId)
    if (!recipe) {
      throw new Error(`suggestMeals : recette '${recipeId}' absente du catalogue (incohérence d'index) — §9.1 ENGINE`)
    }
    const perPortion = catalog.indexes.recipeNutrients.get(recipeId) ?? new Float64Array(catalog.nutrients.length)
    // Absent → vecteur de zéros, soit « rien de connu ». C'est le repli SÛR : il pousse l'affichage
    // à taire une valeur plutôt qu'à la présenter comme certaine.
    const coverage = catalog.indexes.recipeNutrientCoverage.get(recipeId) ?? new Float64Array(catalog.nutrients.length)

    return {
      recipeId,
      // 0 → 100, PAS arrondi ici (§8.2 ENGINE) : le score interne est dans [0, 1], le formatage
      // (Math.round, toFixed…) est l'affaire de l'appelant, jamais du moteur.
      score: score * 100,
      breakdown: scoringResult.breakdowns.get(recipeId) ?? {},
      explanations: explainSuggestion(recipeId, scoringResult.breakdowns),
      // `recipe.portionsBase` tel quel — NE PAS appliquer `facteurPortion` ici : c'est l'affaire
      // de `scaleRecipe` (§10.1 ENGINE, non câblé dans ce lot). Mélanger les deux produirait une
      // mise à l'échelle silencieuse, invisible pour qui lit `ScoredSuggestion.portions`.
      portions: recipe.portionsBase,
      nutrition: { perPortion, coverage },
    }
  })

  // (h) — garde-fou final (§6.2 ARCHITECTURE, §6.7 ENGINE), sur TOUTES les explications produites
  // en une seule fois, juste avant de retourner.
  assertNoTherapeuticClaim(suggestions.flatMap((suggestion) => suggestion.explanations))

  const diagnostics: EngineDiagnostics = {
    engineVersion: ENGINE_VERSION,
    catalogVersion: catalog.version,
    weights: completeScoreWeights(scoringResult.weights),
    seed: req.seed,
    candidatsInitiaux: initialCandidates.size,
    candidatsApresFiltrage: exclusionResult.candidates.size,
    // Horloge injectée UNIQUEMENT (§3 ENGINE — jamais `Date.now()`) : absente → 0, voir
    // `CreateEngineOptions.now` sur `createEngine` ci-dessous pour le pourquoi.
    dureeMs: startedAt === null ? 0 : Math.max(0, now!() - startedAt),
  }

  return { suggestions, rejected, diagnostics }
}

export interface CreateEngineOptions {
  /**
   * Horloge injectée, pour `EngineDiagnostics.dureeMs` uniquement — jamais `Date.now()` en
   * interne (§3 ENGINE : « le moteur reçoit la date en paramètre », même exigence pour toute
   * lecture d'horloge). Absente → `dureeMs` vaut toujours 0 : mesurer un temps d'exécution ne
   * doit pas devenir la porte d'entrée d'une dépendance implicite à l'horloge système dans un
   * moteur qui se veut rejouable (mêmes entrées → même sortie, y compris ce champ).
   */
  readonly now?: () => number
}

/**
 * Assemble le moteur (§8 ENGINE) : enrichit le catalogue reçu avec les index dérivés
 * (`attachDerivedIndexes`, §6.5 précision 8 — fonction PURE, exécutée une seule fois ici, jamais
 * par `catalog/build.mjs`) et conserve ce catalogue enrichi en fermeture, consommé par
 * `suggestMeals` (voir `runSuggestMeals` ci-dessus). Les 7 méthodes de planification restantes
 * lèvent explicitement, `layer`/`layers` exposent le registre.
 */
export function createEngine(catalog: Catalog, opts: CreateEngineOptions = {}): Engine {
  const enrichedCatalog = attachDerivedIndexes(catalog)
  const { now } = opts

  return {
    version: ENGINE_VERSION,
    catalogVersion: enrichedCatalog.version,

    suggestMeals: (req) => runSuggestMeals(enrichedCatalog, req, now),
    suggestAlternatives: (req, recipeId, dislikedFoodId) =>
      runSuggestAlternatives(enrichedCatalog, req, recipeId, dislikedFoodId),
    // La suggestion est INJECTÉE dans le planning (§7.1, `P->>S: suggest`) : planning/ ne peut pas
    // importer api/, et une copie du pipeline finirait par perdre les garde-fous. Le plan passe
    // ensuite `assertCalorieFloor`, cinquième et dernier garde-fou (§5.2).
    planWeek: (req) => {
      const plan = runPlanWeek(enrichedCatalog, req, (slotReq) => runSuggestMeals(enrichedCatalog, slotReq, now))
      // ⚠️ Le plancher calorique AVERTIT, il n'annule pas (§6.5 ARCHITECTURE : « sans écran
      // d'avertissement explicite »). Le plan sort toujours ; c'est l'appelant qui doit montrer
      // l'écran. Ne pas transformer ça en `throw` : une première version le faisait et refusait
      // sept jours de planning pour une seule journée légère.
      return { ...plan, warnings: checkCalorieFloor(plan, req.profile, enrichedCatalog) }
    },
    rerollSlot: () => notImplemented('rerollSlot'),
    // ⚠️ `convives` n'est pas dans `WeekPlan` — il vient de la REQUÊTE. `planLeftovers` étant
    // appelable seul sur un plan déjà rendu, l'appelant doit le repasser ; défaut 1.
    //
    // ⚠️ LES AVERTISSEMENTS SONT RECALCULÉS. Placer un reste REMPLACE un plat, donc les totaux
    // caloriques du jour changent : les conserver tels quels laisserait un avertissement obsolète,
    // ou en tairait un nouveau. Ce n'est pas une optimisation, c'est une correction — un plan qui
    // porte les avertissements d'un autre plan ment.
    planLeftovers: (plan, profile, convives) => {
      const avecRestes = runPlanLeftovers(plan, enrichedCatalog, convives)
      return { ...avecRestes, warnings: checkCalorieFloor(avecRestes, profile, enrichedCatalog) }
    },
    buildShoppingList: () => notImplemented('buildShoppingList'),
    analyzeWeek: () => notImplemented('analyzeWeek'),
    scaleRecipe: () => notImplemented('scaleRecipe'),
    suggestSubstitutions: () => notImplemented('suggestSubstitutions'),

    layer: <C>(id: LayerId) => resolveLayer<C>(id),
    layers: LAYER_DESCRIPTORS,
  }
}
