// engine/api/ — L5 API publique (docs/ENGINE.md §8)
//
// Rôle : surface volontairement étroite. Tout le reste (selection/, planning/, nutrition/,
// guards/) est interne au module engine/ ; seul ce fichier est destiné à être importé par
// data/ (qui construit le Catalog) et par l'UI (features/, via une future façade hors engine).
//
// `createEngine` enrichit le catalogue (index dérivés, §6.5 précision 8) et expose `version` /
// `catalogVersion` / `layers` / `layer(id)`. `suggestMeals` est un assemblage bout-en-bout
// exclusion → garde-fou allergènes → score → classement + diversification → explication →
// garde-fous finaux (§6.4, §8 ENGINE), voir `runSuggestMeals` plus bas.
//
// Sont RÉELS : `suggestMeals`, `suggestAlternatives`, `planWeek`, `rerollSlot`, `planLeftovers`,
// `buildShoppingList`, `scaleRecipe`. Restent NON CÂBLÉS et lèvent explicitement — `analyzeWeek`
// (aucun type `NutritionReport` n'est défini) et `suggestSubstitutions` (la table `substitution`
// est vide par décision 27 : quels couples ont du sens dépend des recettes qui existent).
//
// Dépendances autorisées : domain/, selection/, planning/, nutrition/, guards/ (§2 ENGINE — L5
// est au sommet de la pile engine/, elle peut connaître tout ce qui est en dessous d'elle).

import type {
  AlternativeSuggestion,
  Catalog,
  CourseKind,
  EngineDiagnostics,
  ExclusionLayerId,
  FoodId,
  HardConstraints,
  PipelineTrace,
  PlanWarning,
  RecipeEnvergure,
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
import { construireIndex, filtrerRecettes, type FiltresFacettes } from '../search/index.js'
import {
  ingredientsManquants,
  partageIngredientNonOptionnel,
  scorePantry,
} from '../selection/scoring/pantry.js'
import { suggestAlternatives as runSuggestAlternatives } from '../selection/alternatives.js'
import { planWeek as runPlanWeek } from '../planning/plan-week.js'
import { planLeftovers as runPlanLeftovers } from '../planning/plan-leftovers.js'
import { buildShoppingList as runBuildShoppingList } from '../planning/shopping-list.js'
import { scaleRecipe as runScaleRecipe } from '../planning/scale-recipe.js'
import {
  rerollSlot as runRerollSlot,
  setSlotRecipe as runSetSlotRecipe,
  setSlotHorsCatalogue as runSetSlotHorsCatalogue,
} from '../planning/reroll-slot.js'
import type { RerollContext } from '../planning/reroll-slot.js'
import type { LayerId } from '../domain/index.js'
import { NoViableRecipeError } from '../domain/index.js'
import type { ExclusionPassResult, LayerDescriptor, SelectionLayer } from '../selection/index.js'
import {
  DEFAULT_DIVERSIFY_TOLERANCE,
  DEFAULT_MMR_LAMBDA,
  DEFAULT_VARIETY_TOLERANCE,
  EXCLUSION_LAYERS,
  LAYER_DESCRIPTORS,
  SCORING_LAYERS,
  buildSimilarityProfiles,
  diversify,
  explainSuggestion,
  mulberry32,
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
  /**
   * Le catalogue ENRICHI (index dérivés attachés par `attachDerivedIndexes`), celui que le moteur
   * consomme réellement pour ses propres calculs. L'exposer évite qu'un appelant retravaille sur un
   * catalogue brut aux index vides (`recipeNutrients` notamment) sans même s'en rendre compte.
   */
  readonly catalogue: Catalog

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
  /**
   * « Des plats qui ressemblent à celui-ci » — le bandeau de bas d'écran de §4.1 DESIGN.
   *
   * ⚠️ À NE PAS CONFONDRE AVEC `suggestAlternatives`, qui répond à « je n'aime pas CET ingrédient »
   * et exige donc un `dislikedFoodId`. Ici on ne reproche rien au plat : on en veut d'autres du
   * même genre.
   *
   * ⚠️ À NE PAS CONFONDRE NON PLUS avec les autres résultats de `suggestMeals`. Ceux-là sont passés
   * par `diversify` (MMR), dont le travail est justement de les rendre DIFFÉRENTS les uns des
   * autres : les afficher sous « plats similaires » afficherait l'exact contraire de la promesse.
   * On classe donc ici par similarité DÉCROISSANTE, avec la même mesure (`recipeSignature`, §6.6).
   *
   * ⚠️ PREND UN `SuggestionRequest` ENTIER, et c'est la même raison que pour `suggestAlternatives` :
   * sans la passe d'exclusion, ce bandeau proposerait tranquillement un plat contenant un allergène
   * déclaré. Un rayon « et aussi… » n'est pas une zone où les garde-fous s'arrêtent.
   *
   * Le créneau du contexte n'entre PAS en compte : on cherche des plats proches, pas des plats du
   * soir. `limit` borne le résultat ; l'identifiant demandé n'y figure jamais.
   */
  similarRecipes(req: SuggestionRequest, recipeId: RecipeId, limit: number): readonly RecipeId[]
  planWeek(req: WeekPlanRequest): WeekPlan
  /**
   * Repropose UN créneau, en excluant le plat refusé et tout ce qui est déjà au plan (§7.2).
   * ⚠️ `contexte` est nécessaire parce qu'un `WeekPlan` ne porte NI le profil NI les contraintes :
   * il garde le résultat, pas la demande qui l'a produit.
   */
  rerollSlot(plan: WeekPlan, slot: SlotRef, contexte: RerollContext, opts?: RerollOptions): WeekPlan
  /**
   * Pose sur un créneau une recette CHOISIE par l'utilisateur (décision 49, §7.2).
   *
   * ⚠️ À NE PAS CONFONDRE AVEC `rerollSlot`, et la confusion a existé dans le produit : le bouton
   * « Choisir » d'un créneau vide appelait le TIRAGE. Un reroll écarte ce qui est déjà au plan ; un
   * choix ne le peut pas — refuser à quelqu'un le plat qu'il vient de désigner parce qu'il figure
   * déjà mercredi serait absurde.
   *
   * ⚠️ L'APPELANT DOIT AVOIR FILTRÉ. Cette fonction pose le `recipeId` reçu sans rejouer les couches
   * d'exclusion : c'est l'écran qui ne présente que des recettes issues de `browseRecipes` ou de
   * `searchByPantry`, lesquels appliquent allergies et régime. Le plancher calorique, lui, est bien
   * recalculé ici — un geste manuel n'est pas une porte de sortie de §6.5.
   *
   * Créneau introuvable ou VERROUILLÉ : le plan rendu est l'objet d'entrée, inchangé. Recette
   * inconnue du catalogue : `RangeError`.
   */
  setSlotRecipe(plan: WeekPlan, slot: SlotRef, recipeId: RecipeId, contexte: RerollContext): WeekPlan
  /**
   * Pose un plat HORS CATALOGUE — plat préparé, traiteur, restaurant (décision 51, issue « (a) »).
   *
   * ⚠️ CE CRÉNEAU SORT DU CALCUL NUTRITIONNEL, il n'y entre pas à zéro. `checkCalorieFloor` devient
   * SILENCIEUX sur toute la journée qui en contient un, et `planWeek` cesse d'y réinjecter le cumul.
   * C'est l'arbitrage, pas un effet de bord : l'application préfère se taire plutôt que de fonder
   * une alerte de sécurité sur un chiffre que rien ne source (principe 3). Voir le commentaire de
   * `checkCalorieFloor` pour ce que ce silence coûte.
   *
   * ⚠️ AUCUN CONTEXTE, contrairement à `setSlotRecipe` : il n'y a ni suggestion à demander, ni
   * accompagnement à choisir, ni allergène à filtrer sur un plat dont on ne connaît pas la
   * composition. L'application ne peut RIEN affirmer sur ce plat — c'est précisément pour ça qu'il
   * est hors catalogue.
   *
   * Créneau introuvable ou VERROUILLÉ : le plan rendu est l'objet d'entrée, inchangé. Libellé vide
   * ou blanc : `RangeError`.
   */
  setSlotHorsCatalogue(plan: WeekPlan, slot: SlotRef, libelle: string, profile: UserProfile): WeekPlan
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
  /**
   * Recalcule les avertissements d'un plan — §6.5, cinquième garde-fou.
   *
   * ⚠️ INDISPENSABLE À TOUT PLAN RELU DEPUIS `user.db`. Les avertissements ne sont PAS persistés :
   * ils se déduisent du plan ET du profil, et les figer en base les ferait mentir dès que le
   * profil change. Sans cet accès, l'appelant n'aurait aucun moyen de les retrouver — `guards/` est
   * interne à engine/ et `checkCalorieFloor` exige le catalogue ENRICHI, que seul `createEngine`
   * possède. Un plan restauré afficherait donc zéro avertissement, silencieusement.
   */
  checkPlan(plan: WeekPlan, profile: UserProfile): readonly PlanWarning[]
  /**
   * Parcourt le CATALOGUE ENTIER — recherche, filtres, favoris (§4.4 DESIGN).
   *
   * ⚠️ À NE PAS CONFONDRE AVEC `suggestMeals`. Celui-ci répond à « que me proposer ce soir » : il
   * part d'un créneau, score, diversifie et classe selon le profil. `browseRecipes` répond à « où
   * est la recette que je cherche » : aucun score, aucun classement par goût — quand on cherche un
   * plat précis, le voir passer derrière trois autres « mieux notés » est déroutant.
   *
   * ⚠️ LES EXCLUSIONS S'APPLIQUENT QUAND MÊME, et c'est le point. Allergies, régime et rejets
   * personnels passent par les MÊMES couches que la suggestion — une recherche ne doit jamais
   * afficher un plat contenant un allergène déclaré. `entonnoir` rend visible ce qui a été écarté
   * et par quelle couche (§6.8 ENGINE, l'« entonnoir des écartées »).
   */
  browseRecipes(req: BrowseRequest): BrowseResult
  /**
   * « Vider le frigo » — classe le catalogue par TAUX DE COUVERTURE de ce qu'on a chez soi
   * (§4.5 DESIGN, §10.2 ① ENGINE).
   *
   * ⚠️ CLASSE, NE FILTRE PAS. Avec quatre ingrédients au frigo, aucune recette n'est intégralement
   * couverte : un filtre rendrait zéro résultat et l'utilisateur conclurait que la fonction est
   * cassée. Les mieux couvertes remontent, les autres restent atteignables — et `manquants` dit
   * exactement ce qu'il faudrait acheter. `seulementRealisables` n'existe que pour le réglage
   * explicite de §4.5, jamais par défaut.
   *
   * ⚠️ LA COUVERTURE EST PONDÉRÉE PAR LA MASSE, pas comptée en nombre d'ingrédients. Avoir le sel
   * et le poivre d'un bœuf bourguignon ne couvre rien ; avoir le bœuf couvre l'essentiel. Voir
   * `scorePantry`.
   */
  searchByPantry(req: PantryRequest): PantryResult
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
 * Les plats les plus proches de `recipeId`, parmi ceux qui SURVIVENT à la passe d'exclusion.
 *
 * L'ordre des opérations n'est pas négociable : on exclut d'abord, on classe ensuite. Classer puis
 * filtrer donnerait le même résultat ici, mais poserait le mauvais précédent — et le garde-fou
 * `assertNoDeclaredAllergen` doit voir l'ensemble conservé, comme dans `runSuggestMeals`.
 *
 * Départage par identifiant à similarité égale : sans lui l'ordre dépendrait de l'itération d'un
 * `Set`, et le bandeau changerait d'ordre entre deux affichages identiques.
 */
function runSimilarRecipes(
  catalog: Catalog,
  req: SuggestionRequest,
  recipeId: RecipeId,
  limit: number,
  similaire: (a: RecipeId, b: RecipeId) => number
): readonly RecipeId[] {
  if (limit <= 0 || !catalog.recipes.has(recipeId)) return []

  const exclusionResult = runExclusionPass(catalog, req)
  assertNoDeclaredAllergen(exclusionResult.candidates, catalog, req.constraints)

  return [...exclusionResult.candidates]
    .filter((id) => id !== recipeId)
    .map((id) => ({ id, proximite: similaire(recipeId, id) }))
    .sort((a, b) => b.proximite - a.proximite || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, limit)
    .map((entree) => entree.id)
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

  // (f) — tirage seedé dans la bande de tolérance (§6.5 précision 7, correctif variété
  // inter-semaine) : `req.seed` était jusqu'ici recopié dans `EngineDiagnostics` sans influencer
  // rien de la sélection. `mulberry32` est créé ICI, à chaque appel — jamais partagé entre deux
  // suggestions, sinon deux créneaux consécutifs consommeraient le même flux et biaiseraient l'un
  // l'autre (voir plan-week.ts pour la dérivation par créneau côté planification).
  // ⚠️ UN SEUL générateur `alea`, partagé entre le classement et la diversification : en créer un
  // second à partir de `req.seed` reproduirait la même suite de tirages aux deux étapes,
  // corrélant classement et diversification au lieu de les décorréler.
  const alea = mulberry32(req.seed)
  const ranked = rankScoredCandidates(scoringResult.scores, alea, DEFAULT_VARIETY_TOLERANCE)
  const limit = req.limit ?? 5

  // ⚠️ CE TYPE A LONGTEMPS ÉTÉ `{ recipeId, score }`, ET CE RÉTRÉCISSEMENT JETAIT LA SEULE MESURE
  // QUI MANQUAIT POUR CALIBRER λ. `diversify` renvoie des `DiversifiedCandidate` qui PORTENT DÉJÀ
  // `maxSimilarityToRetained` ; la ligne d'affectation en faisait des `{ recipeId, score }` et
  // l'information mourait ici, à un pas de la sortie. On garde le champ optionnel — la branche
  // `skipDiversification` ne peut structurellement pas le produire, il n'y a pas de retenues contre
  // quoi mesurer une proximité.
  const lambda = req.mmrLambda ?? DEFAULT_MMR_LAMBDA
  const selected: readonly {
    readonly recipeId: RecipeId
    readonly score: number
    readonly maxSimilarityToRetained?: number
  }[] = req.skipDiversification
    ? ranked.slice(0, limit)
    : diversify(ranked, limit, lambda, buildSimilarityAccessor(catalog), alea, DEFAULT_DIVERSIFY_TOLERANCE)

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
    // `null` quand la diversification n'a pas tourné — à ne pas confondre avec « aucune
    // similarité ». Voir `DiversificationDiagnostics` pour pourquoi ceci ne vit PAS sur
    // `ScoredSuggestion`.
    diversification: req.skipDiversification
      ? null
      : { lambda, maxSimilarities: selected.map((c) => c.maxSimilarityToRetained ?? 0) },
  }

  return { suggestions, rejected, diagnostics }
}

export interface BrowseRequest {
  /** Allergies, régime, exclusions durables. Les mêmes couches que `suggestMeals`. */
  readonly constraints: HardConstraints
  /** Texte libre — nom, description, ingrédients, cuisine. Insensible à la casse ET aux accents. */
  readonly texte?: string
  readonly facettes?: FiltresFacettes
  readonly tempsMaxMin?: number | null
  /** Rôle dans le repas et registre du plat — mêmes axes que `CritereRecherche`, hors facettes. */
  readonly services?: readonly CourseKind[]
  readonly envergures?: readonly RecipeEnvergure[]
  /** Section « Mes favoris » de §4.4 : restreint aux seuls favoris quand `onlyFavorites` est vrai. */
  readonly favoriteRecipeIds?: ReadonlySet<RecipeId>
  readonly onlyFavorites?: boolean
}

export interface BrowseResult {
  /** Recettes retenues, dans l'ordre du catalogue — aucun classement par goût (voir `browseRecipes`). */
  readonly recipeIds: readonly RecipeId[]
  /**
   * Ce que les couches d'exclusion ont écarté, et par laquelle (§6.8 ENGINE).
   *
   * ⚠️ Ne compte QUE les exclusions dures. Les recettes écartées par la recherche textuelle ou par
   * une pastille de filtre n'y figurent pas : l'utilisateur vient de les demander, les présenter
   * comme « écartées » serait absurde. L'entonnoir montre ce que ses CONTRAINTES lui retirent, pas
   * ce que sa recherche a précisé.
   */
  readonly entonnoir: RejectionSummary
  /** Recettes du catalogue avant toute exclusion — le premier nombre de l'entonnoir. */
  readonly totalCatalogue: number
}

export interface PantryRequest {
  /** Les mêmes couches d'exclusion que partout : un allergène déclaré exclut, même ici. */
  readonly constraints: HardConstraints
  readonly pantryFoodIds: readonly FoodId[]
  /** §4.5 : réglage « Seulement ce que je peux faire maintenant ». Défaut `false`. */
  readonly seulementRealisables?: boolean
  /**
   * Filtres de facettes, LES MÊMES qu'`browseRecipes` — §4.5 veut « les mêmes filtres que
   * Recettes ». Les faire diverger entre les deux écrans obligerait l'utilisateur à réapprendre le
   * filtrage selon l'endroit d'où il vient.
   */
  readonly facettes?: FiltresFacettes
  readonly tempsMaxMin?: number | null
  /** Mêmes axes que `BrowseRequest` — « les mêmes filtres que Recettes » (§4.5). */
  readonly services?: readonly CourseKind[]
  readonly envergures?: readonly RecipeEnvergure[]
}

export interface PantryMatch {
  readonly recipeId: RecipeId
  /** Part de la MASSE non optionnelle déjà disponible, entre 0 et 1. */
  readonly couverture: number
  /**
   * Ce qu'il manque pour réaliser la recette — « il vous manque : crème, thym ».
   *
   * ⚠️ Les ingrédients OPTIONNELS n'y figurent pas : ne pas avoir une garniture facultative
   * n'empêche pas de cuisiner le plat.
   */
  readonly manquants: readonly FoodId[]
}

export interface PantryResult {
  /** Trié par couverture décroissante. Jamais tronqué — l'appelant décide de ce qu'il montre. */
  readonly matches: readonly PantryMatch[]
  readonly entonnoir: RejectionSummary
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
/**
 * Profil neutre servant de porteur à `browseRecipes`.
 *
 * ⚠️ IL N'INFLUENCE RIEN. Aucune couche d'EXCLUSION ne lit le profil — seules les couches de score
 * le font, et `browseRecipes` n'en exécute aucune. Il est là parce que `SuggestionRequest` exige le
 * champ, pas parce qu'une valeur a du sens ici. Ne pas le confondre avec le profil semé au premier
 * lancement (`ui/socle.ts`), qui, lui, sert vraiment.
 */
const PROFIL_NEUTRE: UserProfile = {
  trancheAge: '30_49',
  sexe: 'NP',
  tailleCm: null,
  poidsKg: null,
  niveauActivite: 'actif',
  facteurPortion: 1,
}

/**
 * Requête PORTEUSE DE CONTRAINTES pour les écrans de parcours (`browseRecipes`, `searchByPantry`).
 *
 * ⚠️ Tout y est neutre sauf les contraintes : pas d'historique, pas de préférences, pas
 * d'archétype. `context.creneau` n'est LU PAR AUCUNE couche d'exclusion — seul `runExclusionPass`
 * s'en servait pour son point de départ, que ces deux appels fournissent eux-mêmes. Parcourir n'est
 * pas juger.
 */
function requeteDeParcours(constraints: HardConstraints): SuggestionRequest {
  return {
    profile: PROFIL_NEUTRE,
    constraints,
    // ⚠️ `null` ET NON LA TOLÉRANCE DE L'UTILISATEUR, comme tout le reste de cette requête.
    // « Parcourir n'est pas juger » : chercher et lire une recette piquante doit rester possible
    // même pour qui a déclaré ne pas en supporter — c'est exactement la règle tranchée par la
    // décision 53, où la contrainte ne vaut QUE pour le placement automatique. La couche `piquant`
    // reste donc à poids nul ici, et ne réordonne pas les résultats de navigation.
    tolerancePiquant: null,
    context: {
      date: '1970-01-01',
      creneau: 'diner',
      envie: null,
      tempsDisponibleMin: null,
      requiredFoodIds: [],
      pantryFoodIds: [],
    },
    history: { windowDays: 0, entries: [] },
    preferences: new Map(),
    favoriteRecipeIds: new Set(),
    activeTopics: [],
    seed: 0,
  }
}

export function createEngine(catalog: Catalog, opts: CreateEngineOptions = {}): Engine {
  const enrichedCatalog = attachDerivedIndexes(catalog)
  // Index de recherche construit UNE FOIS, comme les index dérivés : normaliser 241 recettes et
  // leurs ingrédients à chaque frappe serait refaire le même travail des dizaines de fois par
  // seconde, sur le fil principal, pendant que l'utilisateur écrit.
  const indexRecherche = construireIndex(enrichedCatalog)
  // Même raison que l'index de recherche : construire les profils de similarité des 241 recettes à
  // chaque affichage referait le même calcul en boucle, sur le fil principal.
  const similaire = buildSimilarityAccessor(enrichedCatalog)
  const { now } = opts

  return {
    version: ENGINE_VERSION,
    catalogVersion: enrichedCatalog.version,
    catalogue: enrichedCatalog,

    suggestMeals: (req) => runSuggestMeals(enrichedCatalog, req, now),
    suggestAlternatives: (req, recipeId, dislikedFoodId) =>
      runSuggestAlternatives(enrichedCatalog, req, recipeId, dislikedFoodId),
    similarRecipes: (req, recipeId, limit) =>
      runSimilarRecipes(enrichedCatalog, req, recipeId, limit, similaire),
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
    // ⚠️ Signature ÉTENDUE : `rerollSlot` a besoin du PROFIL et des CONTRAINTES pour reconstruire
    // une requête de suggestion, et `WeekPlan` ne les porte pas — il ne garde que le résultat.
    // Même motif que `planLeftovers`, qui a dû recevoir `profile` pour recalculer ses
    // avertissements. Un plan n'est pas une requête.
    //
    // ⚠️ LES AVERTISSEMENTS SONT RECALCULÉS ICI AUSSI (corrigé 2026-07-30). `runRerollSlot` rend
    // `{ ...plan, entries }` : il conservait donc les avertissements du plan D'AVANT. Changer le
    // dîner de mardi change les totaux caloriques de mardi — le plan sortait avec un avertissement
    // obsolète, ou sans le nouveau. Exactement le défaut que `planLeftovers` documente ci-dessous,
    // resté ouvert ici parce que `rerollSlot` n'avait pas encore d'appelant.
    rerollSlot: (plan, slot, contexte, opts) => {
      const apres = runRerollSlot(
        enrichedCatalog,
        plan,
        slot,
        contexte,
        (r) => runSuggestMeals(enrichedCatalog, r, now),
        opts
      )
      // Créneau absent ou verrouillé : `runRerollSlot` rend le plan D'ENTRÉE, à l'identité près.
      // Rien n'a bougé, donc aucun avertissement n'a pu changer — et §7.2 promet un plan
      // « inchangé », ce qu'un objet reconstruit ne serait plus tout à fait.
      if (apres === plan) return plan
      return { ...apres, warnings: checkCalorieFloor(apres, contexte.profile, enrichedCatalog) }
    },
    setSlotRecipe: (plan, slot, recipeId, contexte) => {
      const apres = runSetSlotRecipe(enrichedCatalog, plan, slot, recipeId, contexte, (r) =>
        runSuggestMeals(enrichedCatalog, r, now)
      )
      // ⚠️ LE PLANCHER REPASSE, MÊME SUR UN GESTE MANUEL. C'était la contrainte écrite de la
      // décision 49 : poser un plat soi-même ne doit pas être le chemin par lequel §6.5 se
      // contourne. Même ligne, même fonction, même endroit que pour un reroll.
      if (apres === plan) return plan
      return { ...apres, warnings: checkCalorieFloor(apres, contexte.profile, enrichedCatalog) }
    },
    setSlotHorsCatalogue: (plan, slot, libelle, profile) => {
      const apres = runSetSlotHorsCatalogue(plan, slot, libelle)
      // Le plancher repasse ici AUSSI, exactement comme pour un reroll ou un choix manuel — et
      // c'est ce passage qui RETIRE l'avertissement de la journée devenue immesurable. Sauter
      // l'appel laisserait en place une alerte calculée sur l'état d'avant : un chiffre périmé
      // affiché à côté d'un plat qui n'y est plus.
      if (apres === plan) return plan
      return { ...apres, warnings: checkCalorieFloor(apres, profile, enrichedCatalog) }
    },
    checkPlan: (plan, profile) => checkCalorieFloor(plan, profile, enrichedCatalog),
    browseRecipes: (req) => {
      // Point de départ : TOUT le catalogue, ou les seuls favoris (§4.4, section « Mes favoris »).
      // Un `onlyFavorites` sans favori rend une liste vide — c'est correct et lisible à l'écran,
      // à la différence de `suggestMeals` qui lève : ici l'utilisateur voit qu'il n'en a aucun.
      const favoris = req.favoriteRecipeIds ?? new Set<RecipeId>()
      const depart: ReadonlySet<RecipeId> =
        req.onlyFavorites === true ? favoris : new Set(enrichedCatalog.recipes.keys())

      // ⚠️ LES MÊMES COUCHES QUE LA SUGGESTION, avec un ensemble initial fourni plutôt que déduit
      // d'un créneau. La requête ci-dessous n'est qu'un porteur de contraintes : `context.creneau`
      // n'est LU PAR AUCUNE couche d'exclusion (seul `runExclusionPass` s'en servait pour son point
      // de départ, que l'on remplace). Le reste est neutre — aucun historique, aucune préférence,
      // aucun archétype : parcourir n'est pas juger.
      const exclusion = runExclusionPass(
        enrichedCatalog,
        { ...requeteDeParcours(req.constraints), favoriteRecipeIds: favoris },
        EXCLUSION_LAYERS,
        depart
      )
      const recipeIds = filtrerRecettes(enrichedCatalog, indexRecherche, exclusion.candidates, {
        ...(req.texte === undefined ? {} : { texte: req.texte }),
        ...(req.facettes === undefined ? {} : { facettes: req.facettes }),
        ...(req.tempsMaxMin === undefined ? {} : { tempsMaxMin: req.tempsMaxMin }),
        ...(req.services === undefined ? {} : { services: req.services }),
        ...(req.envergures === undefined ? {} : { envergures: req.envergures }),
      })

      return {
        recipeIds,
        entonnoir: buildRejectionSummary(depart.size, exclusion),
        totalCatalogue: enrichedCatalog.recipes.size,
      }
    },
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
    // `generatedAt` vient de l'horloge INJECTÉE si elle existe, jamais de `Date.now()` (§3) ;
    // sinon la date de départ du plan, qui est déterministe.
    buildShoppingList: (plan, opts) =>
      runBuildShoppingList(
        plan,
        enrichedCatalog,
        opts ?? {},
        now === undefined ? plan.startDate : new Date(now()).toISOString().slice(0, 10)
      ),
    searchByPantry: (req) => {
      const garde = new Set(req.pantryFoodIds)
      const depart: ReadonlySet<RecipeId> = new Set(enrichedCatalog.recipes.keys())
      const exclusion = runExclusionPass(
        enrichedCatalog,
        requeteDeParcours(req.constraints),
        EXCLUSION_LAYERS,
        depart
      )

      // Les filtres de facettes s'appliquent APRÈS l'exclusion et AVANT le classement : ils
      // réduisent l'ensemble regardé, ils ne réordonnent rien.
      const retenues = filtrerRecettes(enrichedCatalog, indexRecherche, exclusion.candidates, {
        ...(req.facettes === undefined ? {} : { facettes: req.facettes }),
        ...(req.tempsMaxMin === undefined ? {} : { tempsMaxMin: req.tempsMaxMin }),
        ...(req.services === undefined ? {} : { services: req.services }),
        ...(req.envergures === undefined ? {} : { envergures: req.envergures }),
      })

      const matches: PantryMatch[] = []
      for (const recipeId of retenues) {
        // ⚠️ Garde-manger VIDE → aucun filtrage : voir l'avertissement en tête de fichier, on ne
        // casse pas le parcours de découverte avant toute saisie. Non vide → on écarte les recettes
        // sans le moindre ingrédient non optionnel en commun (compte, pas masse — voir `pantry.ts`).
        if (garde.size > 0 && !partageIngredientNonOptionnel(recipeId, enrichedCatalog, garde)) continue
        const manquants = ingredientsManquants(recipeId, enrichedCatalog, garde)
        if (req.seulementRealisables === true && manquants.length > 0) continue
        matches.push({ recipeId, couverture: scorePantry(recipeId, enrichedCatalog, garde), manquants })
      }
      // Tri STABLE par couverture décroissante : à couverture égale, l'ordre du catalogue est
      // conservé. Aucun score de goût n'intervient — on répond à « que puis-je faire avec ça »,
      // pas à « qu'est-ce qui me plairait ».
      matches.sort((a, b) => b.couverture - a.couverture)

      return { matches, entonnoir: buildRejectionSummary(depart.size, exclusion) }
    },
    analyzeWeek: () => notImplemented('analyzeWeek'),
    scaleRecipe: (id, portions) => runScaleRecipe(enrichedCatalog, id, portions),
    suggestSubstitutions: () => notImplemented('suggestSubstitutions'),

    layer: <C>(id: LayerId) => resolveLayer<C>(id),
    layers: LAYER_DESCRIPTORS,
  }
}
