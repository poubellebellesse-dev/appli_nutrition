// engine/selection/ — L3 Sélection : le contrat (docs/ENGINE.md §6)
//
// Rôle : le pipeline de sélection n'est pas du code figé, c'est un registre ordonné de couches
// partageant un contrat commun (SelectionLayer). Deux natures ne doivent jamais être confondues
// (§6.1 ENGINE) : EXCLUSION retire des candidats (intersection), SCORE ne retire rien et
// repondère (somme pondérée). LAYER_DESCRIPTORS (ci-dessous) ne porte que des métadonnées pour
// les 17 couches du registre complet — 4 des 11 couches de score restent NON implémentées
// (`pantry`, `occasion`, `topic`, `cost` — P2).
//
// P1a (implémenté ici) : les 6 couches d'EXCLUSION (allergenes, regime, exclusions, requis,
// temps, equipement) et la passe d'exclusion qui les enchaîne (§6.4 ENGINE) — voir allergenes.ts,
// regime.ts, exclusions.ts, requis.ts, temps.ts, equipement.ts, exclusion-pass.ts, réexportés plus
// bas pour offrir une surface unique `engine/selection`.
//
// P1b-1/P1b-2/P1b-3 (implémenté ici) : 7 des 11 couches de SCORE (nutri, preference, craving,
// season, variety, habit, speed), voir scoring/{nutri,preference,craving,season,variety,habit,
// speed}.ts, et la passe de score qui les enchaîne (§6.4 ENGINE), `runScoringPass` — voir
// scoring-pass.ts, réexportées plus bas. `speed` a rejoint le registre comme couche à part entière
// le 2026-07-25 (poids par défaut nul, relevée par l'archétype « Rapide » — voir archetypes.ts,
// réexporté plus bas également).
//
// Diversification (§6.6 ENGINE, session du 2026-07-25) : POST-traitement après le classement, ni
// une couche d'exclusion ni une couche de score (n'entre donc pas dans SCORING_LAYERS ni
// LAYER_DESCRIPTORS) — voir similarity.ts (`similarity`, `buildSimilarityProfiles`) et
// diversify.ts (`diversify`, MMR), réexportés plus bas.
//
// Dépendances autorisées : domain/ (§2 ENGINE : SEL --> DOM). LayerId/LayerKind/ArchetypeId sont
// déclarés dans domain/ (pas ici) pour que guards/, qui ne connaît QUE domain/, puisse typer
// PipelineTrace sans dépendre de selection/ — voir le commentaire dans domain/layer-ids.ts (même
// raison pour ArchetypeId, voir domain/archetype-ids.ts : `SuggestionRequest.archetype` en a
// besoin). Réexportés ci-dessous pour offrir une surface unique `engine/selection`.

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
// Registre étendu à 15 entrées (5 exclusion + 10 score) par l'ajout de `exclusions` (rejet
// personnel d'aliments, `HardConstraints.excludedFoodIds` — voir exclusions.ts).
//
// Registre étendu à 16 entrées (6 exclusion + 10 score) par l'ajout de `requis` (miroir dur
// d'`exclusions`, `MealContext.requiredFoodIds` — voir requis.ts).
//
// Registre étendu à 17 entrées (6 exclusion + 11 score) par l'ajout de `speed` (session du
// 2026-07-25, tranchée) : la note ¶ de §6.5 ENGINE disait `speed` « n'est pas une 17ᵉ couche du
// registre » et laissait son rattachement ouvert — c'est désormais résolu, `speed` EST une couche
// du registre à part entière (voir scoring/speed.ts).
//
// Registre étendu à 18 entrées (7 exclusion + 11 score) par l'ajout de `favoris`
// (`SuggestionRequest.onlyFavorites`, §8.1 ENGINE — voir favoris.ts). Couche inerte tant que le
// flag n'est pas explicitement levé : les favoris restent un marque-page, pas un signal de score.
//
// L'ordre suit §6.3 : pour l'exclusion, l'ordre encode la priorité de MOTIF affiché en cas de
// rejets multiples (§6.3 "Sur l'ordre des couches") ; pour le score, l'ordre est indifférent
// (seuls les poids comptent, §6.3).
// ------------------------------------------------------------------------------------------

export const LAYER_DESCRIPTORS: readonly LayerDescriptor[] = [
  // --- exclusion — dans l'ordre de priorité de motif -------------------------------------
  { id: 'allergenes', kind: 'exclusion', critical: true, defaultWeight: 0 }, // 🔒 indésactivable
  { id: 'regime', kind: 'exclusion', critical: true, defaultWeight: 0 }, // 🔒 indésactivable
  { id: 'exclusions', kind: 'exclusion', critical: false, defaultWeight: 0 }, // rejet personnel d'aliments
  { id: 'requis', kind: 'exclusion', critical: false, defaultWeight: 0 }, // miroir dur, contexte Aujourd'hui seulement (§6.5 ter)
  { id: 'temps', kind: 'exclusion', critical: false, defaultWeight: 0 },
  { id: 'equipement', kind: 'exclusion', critical: false, defaultWeight: 0 }, // seulement l'équipement `requis` (§6.5 ENGINE)
  { id: 'favoris', kind: 'exclusion', critical: false, defaultWeight: 0 }, // inerte hors `onlyFavorites` (§8.1 ENGINE) — motif le moins informatif, donc en dernier

  // --- score — l'ordre n'a aucun effet sur le résultat, seuls les poids comptent ---------
  { id: 'nutri', kind: 'scoring', critical: false, defaultWeight: 0.25 },
  { id: 'preference', kind: 'scoring', critical: false, defaultWeight: 0.25 },
  // Poids DYNAMIQUE (§6.5 ENGINE, CODÉ — scoring-pass.ts) : `craving` passe n°1 (~0.40 après
  // renormalisation, CRAVING_DYNAMIC_WEIGHT = 0.50 brut) dès qu'une envie est RÉELLEMENT exprimée
  // (pastilles Léger/Chaud/Salé… — au moins un axe non `null`), et retombe à son poids de
  // référence sinon. 0.20 ci-dessous reste le poids de référence (defaultWeight), la bascule et
  // l'archétype le surchargent tous deux (voir la chaîne de précédence, scoring-pass.ts).
  { id: 'craving', kind: 'scoring', critical: false, defaultWeight: 0.2 },
  { id: 'variety', kind: 'scoring', critical: false, defaultWeight: 0.15 },
  { id: 'season', kind: 'scoring', critical: false, defaultWeight: 0.1 },
  { id: 'pantry', kind: 'scoring', critical: false, defaultWeight: 0.05 }, // dominant en mode « vider le frigo » (§10.2 ENGINE)
  { id: 'habit', kind: 'scoring', critical: false, defaultWeight: 0 }, // croît avec l'historique (§7.5 ENGINE) — démarrage à froid propre
  // Poids DYNAMIQUE (§6.5 ENGINE) : `occasion` passe n°2 pendant une occasion activée et dans
  // la fenêtre, 0 hors période. 0.05 est la valeur de référence documentée en §6.5 ; la bascule
  // selon la fenêtre de dates est P1/P2 — `occasion` elle-même N'EST PAS IMPLÉMENTÉE (absente de
  // SCORING_LAYERS, scoring-pass.ts), ce descriptor reste une métadonnée de réserve.
  { id: 'occasion', kind: 'scoring', critical: false, defaultWeight: 0.05 },
  // Poids par défaut nul (couche de réserve, comme `habit`) — relevée uniquement par l'archétype
  // « Rapide » (§6.3 bis, selection/archetypes.ts) à 0.30 brut. Voir scoring/speed.ts.
  { id: 'speed', kind: 'scoring', critical: false, defaultWeight: 0 },
  { id: 'topic', kind: 'scoring', critical: false, defaultWeight: 0 }, // nul tant qu'aucune thématique n'est active (v2)
  { id: 'cost', kind: 'scoring', critical: false, defaultWeight: 0.05 }, // v3
  // Poids 0 par défaut, relevé à PIQUANT_DYNAMIC_WEIGHT dès qu'une tolérance est DÉCLARÉE
  // (décision 35) — sans quoi la couche tournerait pour tout le monde et diluerait les autres.
  { id: 'piquant', kind: 'scoring', critical: false, defaultWeight: 0 },
]

// ------------------------------------------------------------------------------------------
// Couches d'exclusion & passe d'exclusion — implémentation P1a (§6.4 ENGINE).
// Réexportées ici pour une surface unique `engine/selection` (couches de score : voir plus bas).
// ------------------------------------------------------------------------------------------

export { allergenLayer } from './allergenes.js'
export type { AllergenLayerConfig } from './allergenes.js'
export { DIET_CHAIN, dietLayer, regimeExigePar, regimeExigeParIngredients } from './regime.js'
export type { DietLayerConfig } from './regime.js'
export { personalExclusionLayer } from './exclusions.js'
export type { FoodExclusionLayerConfig } from './exclusions.js'
export { requiredFoodLayer } from './requis.js'
export type { RequiredFoodLayerConfig } from './requis.js'
export { timeLayer } from './temps.js'
export type { TimeLayerConfig } from './temps.js'
export { equipmentLayer } from './equipement.js'
export type { EquipmentLayerConfig } from './equipement.js'
export { favoriteLayer } from './favoris.js'
export type { FavoriteLayerConfig } from './favoris.js'
export { EXCLUSION_LAYERS, runExclusionPass } from './exclusion-pass.js'
export type { ExclusionPassResult } from './exclusion-pass.js'

// ------------------------------------------------------------------------------------------
// Couches de score — implémentation partielle (8 des 11 couches du registre : `nutri`,
// `preference`, `craving`, `season`, `variety`, `habit`, `speed`, `pantry`). `occasion`, `topic` et
// `cost` restent NON implémentées (P2) — voir LAYER_DESCRIPTORS ci-dessus.
// ⚠️ `pantry` a été AJOUTÉE depuis (scoring/pantry.ts) : ce commentaire la disait absente jusqu'au
// 2026-07-30, et ETAT.md disait l'inverse. Corrigé du côté qui mentait. Réexportées
// ici pour la même surface unique `engine/selection` que les couches d'exclusion.
// ------------------------------------------------------------------------------------------

export { nutriLayer } from './scoring/nutri.js'
export type { NutriLayerConfig } from './scoring/nutri.js'
export { preferenceLayer } from './scoring/preference.js'
export type { PreferenceLayerConfig } from './scoring/preference.js'
export { cravingLayer } from './scoring/craving.js'
export type { CravingLayerConfig } from './scoring/craving.js'
export { seasonLayer } from './scoring/season.js'
export type { SeasonLayerConfig } from './scoring/season.js'
export { varietyLayer } from './scoring/variety.js'
export type { VarietyLayerConfig } from './scoring/variety.js'
export { habitLayer } from './scoring/habit.js'
export type { HabitLayerConfig } from './scoring/habit.js'
export { scoreSpeed, speedLayer } from './scoring/speed.js'
export { scorePiquant, piquantLayer } from './scoring/piquant.js'
export type { SpeedLayerConfig } from './scoring/speed.js'
export {
  SCORING_LAYERS,
  CRAVING_DYNAMIC_WEIGHT,
  DEFAULT_VARIETY_TOLERANCE,
  rankScoredCandidates,
  runScoringPass,
} from './scoring-pass.js'
export type { RankedCandidate, ScoringPassResult } from './scoring-pass.js'
export { mulberry32, derive } from './prng.js'

// ------------------------------------------------------------------------------------------
// Archétypes de pondération nommés (§6.3 bis ENGINE) — voir archetypes.ts pour la table et la
// logique de résolution. `ArchetypeId` est réexporté depuis domain/ (voir archetypes.ts pour le
// pourquoi de son emplacement) — même surface unique `engine/selection`.
// ------------------------------------------------------------------------------------------

export type { ArchetypeId } from './archetypes.js'
export { ARCHETYPE_WEIGHT_OVERRIDES, DEFAULT_ARCHETYPE, archetypeWeightOverride } from './archetypes.js'

// ------------------------------------------------------------------------------------------
// Similarité entre recettes & diversification par pertinence marginale maximale (§6.6 ENGINE) —
// post-traitement APRÈS le classement de `rankScoredCandidates`, ni exclusion ni score : voir
// similarity.ts / diversify.ts pour le détail. Réexportées ici pour la même surface unique.
// ------------------------------------------------------------------------------------------

export { SIMILARITY_WEIGHT_INGREDIENTS, SIMILARITY_WEIGHT_SENSORY, SIMILARITY_WEIGHT_CUISINE, similarity, buildSimilarityProfiles } from './similarity.js'
export type { RecipeSimilarityProfile } from './similarity.js'
export { DEFAULT_DIVERSIFY_TOLERANCE, DEFAULT_MMR_LAMBDA, diversify } from './diversify.js'
export type { DiversifiedCandidate } from './diversify.js'

// ------------------------------------------------------------------------------------------
// Explication (§6.7 ENGINE) — convertit le breakdown d'une recette en phrases prêtes à afficher,
// restreintes aux couches qui discriminent réellement sur l'ensemble des candidats scorés (voir
// explain.ts pour la décision de fond). Réexportées ici pour la même surface unique.
// ------------------------------------------------------------------------------------------

export { CONTRIBUTION_EPSILON, MAX_EXPLANATIONS, discriminatingScoringLayers, explainSuggestion } from './explain.js'
