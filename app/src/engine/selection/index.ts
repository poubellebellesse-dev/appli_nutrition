// engine/selection/ — L3 Sélection : le contrat (docs/ENGINE.md §6)
//
// Rôle : le pipeline de sélection n'est pas du code figé, c'est un registre ordonné de couches
// partageant un contrat commun (SelectionLayer). Deux natures ne doivent jamais être confondues
// (§6.1 ENGINE) : EXCLUSION retire des candidats (intersection), SCORE ne retire rien et
// repondère (somme pondérée). Zéro logique dans ce chunk : `apply`/`configure` ne sont
// implémentées pour aucune couche (P1/P2) — LAYER_DESCRIPTORS ne porte que des métadonnées.
//
// Dépendances autorisées : domain/ (§2 ENGINE : SEL --> DOM). LayerId/LayerKind sont déclarés
// dans domain/ (pas ici) pour que guards/, qui ne connaît QUE domain/, puisse typer
// PipelineTrace sans dépendre de selection/ — voir le commentaire dans domain/layer-ids.ts.
// Réexportés ci-dessous pour offrir une surface unique `engine/selection`.

import type { Catalog, RecipeId, RejectionEntry, SuggestionRequest } from '../domain/index.js'
import type { LayerId, LayerKind } from '../domain/index.js'

export type { ExclusionLayerId, LayerId, LayerKind, ScoringLayerId } from '../domain/index.js'

/** Ensemble de candidats circulant entre couches d'exclusion (§6.4 ENGINE). */
export type CandidateSet = ReadonlySet<RecipeId>

/** Résultat d'une couche d'exclusion : sous-ensemble conservé + motifs de rejet (§6.2 ENGINE). */
export interface ExclusionLayerResult {
  readonly kept: CandidateSet
  readonly rejected: readonly RejectionEntry[]
}

/** Résultat d'une couche de score : un score 0-1 par candidat, aucune réduction (§6.1 ENGINE). */
export interface ScoringLayerResult {
  readonly scores: ReadonlyMap<RecipeId, number>
}

export type LayerResult = ExclusionLayerResult | ScoringLayerResult

/** Le contrat commun (§6.2 ENGINE, reproduit à l'identique). */
export interface SelectionLayer<Config = unknown> {
  readonly id: LayerId
  readonly kind: LayerKind
  /** true → indésactivable, par aucun réglage. */
  readonly critical: boolean
  /** Scoring uniquement — sans effet pour une couche `kind: 'exclusion'`. */
  readonly defaultWeight: number

  /** Extrait du contexte ce dont la couche a besoin. Pure. */
  readonly configure: (req: SuggestionRequest, catalog: Catalog) => Config

  /** Exclusion → sous-ensemble + motifs. Score → un score 0-1 par candidat. */
  readonly apply: (candidates: CandidateSet, config: Config) => LayerResult
}

/** id · nature · critique · poids effectif (§8 ENGINE — `Engine.layers`). */
export interface LayerDescriptor {
  readonly id: LayerId
  readonly kind: LayerKind
  readonly critical: boolean
  readonly defaultWeight: number
}

// ------------------------------------------------------------------------------------------
// LAYER_DESCRIPTORS — registre de métadonnées (§6.3 ENGINE).
//
// Données uniquement : AUCUNE fonction apply/configure implémentée ici (logique = P1/P2).
//
// ⚠️ Incohérence relevée dans la spec, non résolue unilatéralement : §6.3 et §12 ENGINE
// annoncent en prose un "registre de 12 couches", mais le bloc de code de §6.3 énumère
// 4 couches d'exclusion + 10 couches de score = 14 entrées. Implémenté ici avec les 14 entrées
// listées explicitement — la liste nommée fait foi sur le chiffre en prose.
//
// L'ordre suit §6.3 : pour l'exclusion, l'ordre encode la priorité de MOTIF affiché en cas de
// rejets multiples (§6.3 "Sur l'ordre des couches") ; pour le score, l'ordre est indifférent
// (seuls les poids comptent, §6.3).
// ------------------------------------------------------------------------------------------

export const LAYER_DESCRIPTORS: readonly LayerDescriptor[] = [
  // --- exclusion — dans l'ordre de priorité de motif -------------------------------------
  { id: 'allergenes', kind: 'exclusion', critical: true, defaultWeight: 0 }, // 🔒 indésactivable
  { id: 'regime', kind: 'exclusion', critical: true, defaultWeight: 0 }, // 🔒 indésactivable
  { id: 'temps', kind: 'exclusion', critical: false, defaultWeight: 0 },
  { id: 'equipement', kind: 'exclusion', critical: false, defaultWeight: 0 }, // seulement l'équipement `requis` (§6.5 ENGINE)

  // --- score — l'ordre n'a aucun effet sur le résultat, seuls les poids comptent ---------
  { id: 'nutri', kind: 'scoring', critical: false, defaultWeight: 0.25 },
  { id: 'preference', kind: 'scoring', critical: false, defaultWeight: 0.25 },
  // Poids DYNAMIQUE (§6.5 ENGINE) : `craving` passe n°1 (~0.40 après renormalisation) dès
  // qu'une envie est exprimée (pastilles Léger/Chaud/Salé…), et retombe à ~0 sinon. 0.20 est
  // la valeur de référence documentée en §6.5 ; la logique de bascule est P1/P2.
  { id: 'craving', kind: 'scoring', critical: false, defaultWeight: 0.2 },
  { id: 'variety', kind: 'scoring', critical: false, defaultWeight: 0.15 },
  { id: 'season', kind: 'scoring', critical: false, defaultWeight: 0.1 },
  { id: 'pantry', kind: 'scoring', critical: false, defaultWeight: 0.05 }, // dominant en mode « vider le frigo » (§10.2 ENGINE)
  { id: 'habit', kind: 'scoring', critical: false, defaultWeight: 0 }, // croît avec l'historique (§7.5 ENGINE) — démarrage à froid propre
  // Poids DYNAMIQUE (§6.5 ENGINE) : `occasion` passe n°2 pendant une occasion activée et dans
  // la fenêtre, 0 hors période. 0.05 est la valeur de référence documentée en §6.5 ; la bascule
  // selon la fenêtre de dates est P1/P2.
  { id: 'occasion', kind: 'scoring', critical: false, defaultWeight: 0.05 },
  { id: 'topic', kind: 'scoring', critical: false, defaultWeight: 0 }, // nul tant qu'aucune thématique n'est active (v2)
  { id: 'cost', kind: 'scoring', critical: false, defaultWeight: 0.05 }, // v3
]
