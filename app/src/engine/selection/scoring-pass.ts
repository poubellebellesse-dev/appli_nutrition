// engine/selection/scoring-pass.ts — la passe de score (docs/ENGINE.md §6.4, §6.5, §6.7).
//
// Fonction quasi-pure : applique les couches de SCORE du registre en ACCUMULATION PONDÉRÉE — une
// couche de score ne réduit jamais l'ensemble des candidats (§6.1 ENGINE, contrôlé ci-dessous par
// `assertScoringLayersNeverExclude`, elle-même dans guards/ — SEL a le droit de dépendre de GUARD,
// §2/§3 ENGINE : SEL --> GUARD). `layers` reste paramétrable (comme `runExclusionPass`) pour isoler
// un sous-ensemble de couches en test.
//
// Résolution des poids (§6.3 ENGINE), dans cet ordre :
//  1. poids effectif d'une couche = `req.weights?.[id] ?? layer.defaultWeight` ;
//  2. une couche de poids EFFECTIF ≤ 0 est IGNORÉE — ni `configure()` ni `apply()` ne sont
//     appelés. C'est le cas par défaut de `habit` (`defaultWeight: 0`, §7.5 : démarrage à froid
//     propre, le poids croît avec l'historique) ; ne pas l'exécuter est aussi une économie, pas
//     seulement une sémantique — évite de dériver un `HabitLayerConfig` pour rien ;
//  3. les poids retenus (couches à poids > 0) sont NORMALISÉS à Σ = 1 avant application ;
//  4. si AUCUNE couche ne subsiste (tous les poids à 0, ou `layers` vide) : chaque candidat reçoit
//     `NEUTRAL_SCORE`. Aucun signal exploitable ne doit jamais se lire comme « mauvais » — même
//     convention que chaque couche applique déjà individuellement quand ELLE n'a rien à comparer
//     (scoring/index.ts, `NEUTRAL_SCORE`) ; ici c'est le pipeline entier qui n'a rien à comparer.
//
// ⚠️ DÉCISION DE FORMAT DU BREAKDOWN (assumée, documentée ici car sa conséquence est irréversible
// pour qui consomme `ScoreBreakdown`) : chaque entrée stocke la CONTRIBUTION PONDÉRÉE de la couche
// (poids normalisé × score brut de la couche), PAS son score brut. Avantage direct : la somme des
// entrées du breakdown est EXACTEMENT le score final — l'explication de §6.7 (« part du score
// final, 0 → 1 ») se lit donc DIRECTEMENT depuis le breakdown, sans recalcul ni accès aux poids.
// Conséquence assumée : le score BRUT d'une couche n'est PLUS récupérable depuis le breakdown seul
// (contribution / poids le retrouve, mais ce n'est pas ce que la structure stocke) — un besoin
// futur de score brut (debug, tests) doit le lire ailleurs, pas dans `ScoreBreakdown`.
//
// Dépendances autorisées : domain/, ./index.js, ./scoring/index.js, les modules de couches locaux,
// ../guards/index.js — §2/§3 ENGINE.

import type {
  Catalog,
  PipelineTrace,
  RecipeId,
  ScoreBreakdown,
  ScoreWeights,
  ScoringLayerId,
  SuggestionRequest,
} from '../domain/index.js'
import type { CandidateSet, ScoringLayerResult, SelectionLayer } from './index.js'
import { NEUTRAL_SCORE, clamp01 } from './scoring/index.js'
import { nutriLayer } from './scoring/nutri.js'
import { preferenceLayer } from './scoring/preference.js'
import { cravingLayer } from './scoring/craving.js'
import { seasonLayer } from './scoring/season.js'
import { varietyLayer } from './scoring/variety.js'
import { habitLayer } from './scoring/habit.js'
import { assertScoringLayersNeverExclude } from '../guards/index.js'

/**
 * Registre des couches de score IMPLÉMENTÉES (6 des 10 du registre complet, `LAYER_DESCRIPTORS`) —
 * `pantry`, `occasion`, `topic`, `cost` restent P2 (voir selection/index.ts). Cast `as
 * SelectionLayer` nécessaire pour les stocker ensemble : même motif qu'`EXCLUSION_LAYERS`
 * (exclusion-pass.ts), voir son commentaire pour le pourquoi (contravariance de `Config` sous
 * `strict`, aucune perte de sûreté réelle).
 */
export const SCORING_LAYERS: readonly SelectionLayer[] = [
  nutriLayer as SelectionLayer,
  preferenceLayer as SelectionLayer,
  cravingLayer as SelectionLayer,
  varietyLayer as SelectionLayer,
  seasonLayer as SelectionLayer,
  habitLayer as SelectionLayer,
]

export interface ScoringPassResult {
  /** Score final [0, 1] par candidat. */
  readonly scores: ReadonlyMap<RecipeId, number>
  /** Contribution pondérée par couche, par candidat — voir la décision documentée en en-tête. */
  readonly breakdowns: ReadonlyMap<RecipeId, ScoreBreakdown>
  /**
   * Poids NORMALISÉS effectivement appliqués — une entrée PAR COUCHE ACTIVE uniquement (même
   * convention de sparsité que `ScoreBreakdown`, domain/result.ts : « sous-ensemble des couches
   * effectivement appliquées »), pas un `ScoreWeights` complet sur les 10 id du registre. Cette
   * passe ne connaît que les couches qu'on lui a passées (`layers`, 6 par défaut) — compléter à
   * zéro les 4 couches non implémentées (`pantry`/`occasion`/`topic`/`cost`) pour assembler
   * `EngineDiagnostics.weights` (§8.2 ENGINE) est la responsabilité de l'appelant, pas la sienne.
   */
  readonly weights: Partial<ScoreWeights>
}

/**
 * Exécute la passe de score (§6.4 ENGINE) sur `candidates` (le résultat de `runExclusionPass`,
 * typiquement). `layers` par défaut = `SCORING_LAYERS` (les 6 couches implémentées) ; paramétrable
 * pour isoler un sous-ensemble de couches en test.
 */
export function runScoringPass(
  catalog: Catalog,
  req: SuggestionRequest,
  candidates: CandidateSet,
  layers: readonly SelectionLayer[] = SCORING_LAYERS
): ScoringPassResult {
  // 1. Résoudre le poids effectif de chaque couche (§6.3, règle 1), écarter les poids ≤ 0 (règle 2).
  const activeLayers: Array<{ readonly layer: SelectionLayer; readonly weight: number }> = []
  for (const layer of layers) {
    if (layer.kind !== 'scoring') {
      throw new TypeError(`runScoringPass : la couche '${layer.id}' n'est pas de nature 'scoring'`)
    }
    const effectiveWeight = req.weights?.[layer.id as ScoringLayerId] ?? layer.defaultWeight
    if (effectiveWeight > 0) activeLayers.push({ layer, weight: effectiveWeight })
  }

  // 2. Aucune couche ne subsiste (règle 4) → NEUTRAL_SCORE pour tous, breakdown vide, poids nuls.
  //    Trace vide passée au garde-fou quand même, par cohérence (no-op garanti sur map vide) —
  //    voir assertScoringLayersNeverExclude.
  if (activeLayers.length === 0) {
    assertScoringLayersNeverExclude(emptyTrace(candidates.size))

    const scores = new Map<RecipeId, number>()
    const breakdowns = new Map<RecipeId, ScoreBreakdown>()
    for (const recipeId of candidates) {
      scores.set(recipeId, NEUTRAL_SCORE)
      breakdowns.set(recipeId, {})
    }
    return { scores, breakdowns, weights: {} }
  }

  // 3. Normaliser les poids retenus à Σ = 1 (règle 3).
  const totalWeight = activeLayers.reduce((sum, { weight }) => sum + weight, 0)
  const normalizedWeights = new Map<ScoringLayerId, number>(
    activeLayers.map(({ layer, weight }) => [layer.id as ScoringLayerId, weight / totalWeight])
  )

  // 4. Exécuter chaque couche active ; le compte RÉEL de scores rendus (`.size`, pas une valeur
  //    recopiée) alimente la trace du garde-fou.
  const layerResults: Array<{ readonly id: ScoringLayerId; readonly scores: ReadonlyMap<RecipeId, number> }> = []
  const scoringLayerCounts = new Map<ScoringLayerId, number>()
  const layersRun: ScoringLayerId[] = []

  for (const { layer } of activeLayers) {
    const config = layer.configure(req, catalog)
    const result = layer.apply(candidates, config) as ScoringLayerResult
    const id = layer.id as ScoringLayerId
    layerResults.push({ id, scores: result.scores })
    scoringLayerCounts.set(id, result.scores.size)
    layersRun.push(id)
  }

  // 5. Garde-fou AVANT tout calcul de breakdown — fail fast (§6.1 ENGINE), avant de bâtir quoi que
  //    ce soit sur une base déjà invalide.
  const trace: PipelineTrace = {
    layersRun,
    criticalLayerIds: [],
    excludedCandidateCounts: new Map(),
    scoringCandidateCount: candidates.size,
    scoringLayerCounts,
  }
  assertScoringLayersNeverExclude(trace)

  // 6. Accumulation pondérée — breakdown = CONTRIBUTION (poids normalisé × score brut), voir
  //    la décision documentée en en-tête de fichier.
  const scores = new Map<RecipeId, number>()
  const breakdowns = new Map<RecipeId, ScoreBreakdown>()

  for (const recipeId of candidates) {
    let finalScore = 0
    const breakdown: Partial<Record<ScoringLayerId, number>> = {}

    for (const { id, scores: layerScores } of layerResults) {
      // Défensif : le garde-fou ci-dessus a déjà validé `.size`, cette valeur de repli ne devrait
      // jamais être exploitée (elle protège seulement contre une couche qui aurait la bonne
      // taille mais des clés erronées — hors invariant testé, mais jamais un plantage).
      const rawScore = layerScores.get(recipeId) ?? NEUTRAL_SCORE
      const weight = normalizedWeights.get(id)!
      const contribution = weight * rawScore
      breakdown[id] = contribution
      finalScore += contribution
    }

    scores.set(recipeId, clamp01(finalScore))
    breakdowns.set(recipeId, breakdown)
  }

  // Type localement mutable — `ScoreWeights` (donc `Partial<ScoreWeights>`) est `Readonly`,
  // inutilisable comme accumulateur ; upcast implicite au `return` (même motif que `breakdown`
  // ci-dessus pour `ScoreBreakdown`, également `Readonly`).
  const weights: Partial<Record<ScoringLayerId, number>> = {}
  for (const [id, weight] of normalizedWeights) weights[id] = weight

  return { scores, breakdowns, weights }
}

function emptyTrace(scoringCandidateCount: number): PipelineTrace {
  return {
    layersRun: [],
    criticalLayerIds: [],
    excludedCandidateCounts: new Map(),
    scoringCandidateCount,
    scoringLayerCounts: new Map(),
  }
}

// ------------------------------------------------------------------------------------------
// Classement déterministe (§6.5 précision 7 ENGINE) : tri par score DÉCROISSANT, tie-break par id
// de recette CROISSANT à score strictement égal. Le tie-break rend le comparateur un ORDRE TOTAL
// (jamais deux entrées distinctes à égalité de comparateur) : le résultat est donc déterministe
// par construction, indépendamment de l'ordre d'insertion des candidats dans la Map d'entrée et de
// la stabilité de `Array.prototype.sort` — aucun `Math.random`, aucune dépendance à un ordre
// d'itération.
// ------------------------------------------------------------------------------------------

export interface RankedCandidate {
  readonly recipeId: RecipeId
  readonly score: number
}

export function rankScoredCandidates(scores: ReadonlyMap<RecipeId, number>): readonly RankedCandidate[] {
  return Array.from(scores, ([recipeId, score]) => ({ recipeId, score })).sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score
    return a.recipeId < b.recipeId ? -1 : a.recipeId > b.recipeId ? 1 : 0
  })
}
