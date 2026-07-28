// engine/domain/result.ts
//
// Réponse de suggestion (docs/ENGINE.md §8.2) et types transverses au pipeline de sélection
// (§6 ENGINE) — y compris PipelineTrace, nécessaire à guards/ (§5.2 ENGINE) qui ne doit
// dépendre que de domain/ (§2/§3 ENGINE : GUARD --> DOM uniquement, jamais SEL).

import type { EvidenceSheetId, FoodId, RecipeId } from './ids.js'
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
  /**
   * Part de la masse du plat dont la valeur est CONNUE, par nutriment, ∈ [0, 1] (décision 29).
   * Qualifie `perPortion` : CIQUAL laisse des cases vides, comptées comme des zéros à l'agrégation.
   * Une couverture basse veut dire « on ne sait pas », PAS « il n'y en a pas ».
   *
   * Destiné à la future couche d'affichage — permettre un libellé honnête (« valeur incomplète »)
   * plutôt qu'un chiffre présenté comme certain. Le moteur, lui, s'abstient déjà de noter en
   * dessous de `NUTRI_MIN_COVERAGE` : ce champ N'EST PAS ce qui protège le classement, il ne fait
   * que le rendre lisible.
   */
  readonly coverage: NutrientVector
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
  /**
   * Nombre de candidats soumis à la passe de score (§6.4 ENGINE, après exclusion) — le dénominateur
   * attendu pour CHAQUE couche de score exécutée. Ajouté avec `scoringLayerCounts` ci-dessous :
   * sans les deux, `PipelineTrace` ne peut structurellement PAS exprimer la violation que
   * `assertScoringLayersNeverExclude` doit attraper (§6.1/§6.3 ENGINE, « aucune couche de score ne
   * peut réduire l'ensemble des candidats ») — `excludedCandidateCounts` est typé par
   * `ExclusionLayerId` uniquement, une couche de score n'y a structurellement pas sa place.
   */
  readonly scoringCandidateCount: number
  /**
   * Nombre de scores RENDUS, PAR COUCHE DE SCORE exécutée (`ScoringLayerResult.scores.size`, un
   * compte réel, pas une valeur recopiée). Le garde-fou compare chaque entrée à
   * `scoringCandidateCount` : un écart, dans un sens ou l'autre, signale qu'une couche de score a
   * réduit (ou halluciné) l'ensemble des candidats. Une couche non exécutée (poids ≤ 0, ignorée
   * par `runScoringPass`, §6.3 ENGINE) n'apparaît PAS dans cette map — absence attendue, pas une
   * violation.
   */
  readonly scoringLayerCounts: ReadonlyMap<ScoringLayerId, number>
}

// --- Alternatives (§8.4 ENGINE, décision 26) ---------------------------------------------------

/**
 * La MÊME recette, autrement. `replacementFoodId` vaut `null` pour un retrait — le champ dit ce qui
 * remplace, et un retrait ne remplace rien.
 */
export interface RecipeVariant {
  readonly kind: 'retrait_optionnel' | 'substitution'
  readonly recipeId: RecipeId
  /** L'aliment rejeté, celui qui est retiré ou remplacé. */
  readonly foodId: FoodId
  readonly replacementFoodId: FoodId | null
}

/**
 * Une AUTRE recette du même genre. `characteristicFoodId` est ce qui a changé — même `Food.groupe`
 * que la recette d'origine, aliment différent (§8.4 ENGINE).
 */
export interface AlternativeRecipe {
  readonly recipeId: RecipeId
  readonly characteristicFoodId: FoodId
}

/**
 * ⚠️ Les deux listes répondent à deux demandes différentes et ne se substituent pas l'une à
 * l'autre : `variants` garde le plat, `alternatives` en change. Une UI qui les fusionnerait
 * ferait croire qu'on propose la même chose.
 */
export interface AlternativeSuggestion {
  readonly variants: readonly RecipeVariant[]
  readonly alternatives: readonly AlternativeRecipe[]
}
