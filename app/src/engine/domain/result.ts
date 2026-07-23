// engine/domain/result.ts
//
// Réponse de suggestion (docs/ENGINE.md §8.2) et types transverses au pipeline de sélection
// (§6 ENGINE) — y compris PipelineTrace, nécessaire à guards/ (§5.2 ENGINE) qui ne doit
// dépendre que de domain/ (§2/§3 ENGINE : GUARD --> DOM uniquement, jamais SEL).

import type { EvidenceSheetId, RecipeId } from './ids.js'
import type { ExclusionLayerId, LayerId, ScoringLayerId } from './layer-ids.js'
import type { NutrientVector } from './catalog.js'

/** Poids normalisés des couches de score (Σ = 1 avant application, §6.3 ENGINE). */
export type ScoreWeights = Readonly<Record<ScoringLayerId, number>>

/** Contribution par critère de score — sous-ensemble des couches de score effectivement appliquées. */
export type ScoreBreakdown = Readonly<Partial<Record<ScoringLayerId, number>>>

/** Alias : le critère cité dans une explication est toujours l'id d'une couche de score. */
export type ScoreCriterion = ScoringLayerId

export interface Explanation {
  readonly criterion: ScoreCriterion
  /** Part du score final, 0 → 1. */
  readonly contribution: number
  readonly label: string
  /** Rempli uniquement pour la couche `topic` (§6.7 ENGINE). */
  readonly authority?: string
  readonly evidenceSheetId?: EvidenceSheetId
}

export interface NutrientSummary {
  /** Vecteur complet par portion — affichage optionnel, jamais un budget (§6.5 ARCHITECTURE). */
  readonly perPortion: NutrientVector
}

export interface ScoredSuggestion {
  readonly recipeId: RecipeId
  /** 0 → 100. */
  readonly score: number
  readonly breakdown: ScoreBreakdown
  readonly explanations: readonly Explanation[]
  readonly portions: number
  readonly nutrition: NutrientSummary
}

export interface RejectionEntry {
  readonly recipeId: RecipeId
  readonly layerId: ExclusionLayerId
  /** Motif humain, ex. « contient un allergène déclaré ». Premier motif rencontré = motif retenu. */
  readonly reason: string
}

/** Transparence : combien de candidats écartés, et pourquoi (§8.2, §6.8 ENGINE). */
export interface RejectionSummary {
  readonly totalInitial: number
  readonly totalRejected: number
  readonly byLayer: ReadonlyMap<ExclusionLayerId, number>
  readonly entries: readonly RejectionEntry[]
}

export interface EngineDiagnostics {
  readonly engineVersion: string
  readonly catalogVersion: string
  /** Poids effectivement appliqués. */
  readonly weights: ScoreWeights
  readonly seed: number
  readonly candidatsInitiaux: number
  readonly candidatsApresFiltrage: number
  readonly dureeMs: number
}

export interface SuggestionResult {
  readonly suggestions: readonly ScoredSuggestion[]
  readonly rejected: RejectionSummary
  readonly diagnostics: EngineDiagnostics
}

/**
 * Trace d'exécution du pipeline de sélection (§6.4 ENGINE), utilisée par les garde-fous
 * `assertCriticalLayersRan` / `assertScoringLayersNeverExclude` (§5.2 ENGINE). Distincte de
 * `PipelineOutcome` (résultat de calcul interne à selection/, voir selection/index.ts) : ceci
 * n'est qu'un relevé, pour que guards/ n'ait pas besoin de connaître selection/.
 */
export interface PipelineTrace {
  /** Ordre d'exécution effectif. */
  readonly layersRun: readonly LayerId[]
  /** Sous-ensemble attendu, figé, du registre — vérifié tel quel par le garde-fou. */
  readonly criticalLayerIds: readonly LayerId[]
  /** Candidats retirés par couche d'exclusion — une couche de score ne doit jamais y apparaître. */
  readonly excludedCandidateCounts: ReadonlyMap<ExclusionLayerId, number>
}
