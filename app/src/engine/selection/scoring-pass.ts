// engine/selection/scoring-pass.ts — la passe de score (docs/ENGINE.md §6.4, §6.5, §6.7).
//
// Fonction quasi-pure : applique les couches de SCORE du registre en ACCUMULATION PONDÉRÉE — une
// couche de score ne réduit jamais l'ensemble des candidats (§6.1 ENGINE, contrôlé ci-dessous par
// `assertScoringLayersNeverExclude`, elle-même dans guards/ — SEL a le droit de dépendre de GUARD,
// §2/§3 ENGINE : SEL --> GUARD). `layers` reste paramétrable (comme `runExclusionPass`) pour isoler
// un sous-ensemble de couches en test.
//
// Résolution des poids (§6.3, §6.3 bis, §6.5 ENGINE), dans cet ordre :
//  1. poids effectif d'une couche = le premier défini parmi, du PLUS FORT au plus faible :
//       (a) `req.weights?.[id]`               — échappatoire explicite de test/débogage, gagne
//                                                 toujours ;
//       (b) la bascule dynamique de `craving`  — `CRAVING_DYNAMIC_WEIGHT`, UNIQUEMENT pour la
//                                                 couche `craving`, UNIQUEMENT si une envie est
//                                                 RÉELLEMENT exprimée (`isCravingReallyExpressed`
//                                                 ci-dessous, §6.5 « Poids dynamiques ») ;
//       (c) la surcharge de l'archétype actif  — `archetypeWeightOverride`, ./archetypes.js,
//                                                 §6.3 bis ;
//       (d) `layer.defaultWeight`              — poids de référence, si rien de ce qui précède ne
//                                                 s'applique.
//     Précédence résumée : `defaultWeight` < archétype < bascule `craving` < `weights` explicite.
//  2. une couche de poids EFFECTIF ≤ 0 est IGNORÉE — ni `configure()` ni `apply()` ne sont
//     appelés. C'est le cas par défaut de `habit` (`defaultWeight: 0`, §7.5 : démarrage à froid
//     propre, le poids croît avec l'historique) ET de `speed` (`defaultWeight: 0`, relevée
//     uniquement par l'archétype « Rapide », §6.3 bis) ; ne pas exécuter une couche inactive est
//     aussi une économie, pas seulement une sémantique — évite de dériver une config pour rien ;
//  3. les poids retenus (couches à poids > 0) sont NORMALISÉS à Σ = 1 avant application ;
//  4. si AUCUNE couche ne subsiste (tous les poids à 0, ou `layers` vide) : chaque candidat reçoit
//     `NEUTRAL_SCORE`. Aucun signal exploitable ne doit jamais se lire comme « mauvais » — même
//     convention que chaque couche applique déjà individuellement quand ELLE n'a rien à comparer
//     (scoring/index.ts, `NEUTRAL_SCORE`) ; ici c'est le pipeline entier qui n'a rien à comparer.
//
// ⚠️ `occasion` a aussi un poids dynamique documenté (§6.5 ENGINE : n°2 pendant une occasion
// active, dans la fenêtre de dates) mais la couche `occasion` N'EST PAS IMPLÉMENTÉE (P2, absente
// de `SCORING_LAYERS`) — aucune bascule pour elle ici, ce n'est pas un oubli, juste hors périmètre
// de ce lot.
//
// ⚠️ POINT STRUCTUREL (§6.5 précision 2, « Aujourd'hui = piloté par l'envie · Semaine = pilotée par
// `nutri` ») : la bascule de `craving` ne peut jouer QUE parce que `req.context.envie` porte
// l'information — aucun drapeau de contexte « Aujourd'hui vs Semaine » n'existe ni n'est
// nécessaire, la garantie vient de la FORME de la requête, pas d'un indicateur explicite. Même
// parti que `MealContext.requiredFoodIds` (domain/request.ts, voir son en-tête) : `planWeek`
// (non câblé, P1c) construira ses requêtes SANS `envie` renseignée pour un jour futur — la bascule
// est donc structurellement inatteignable pour `planWeek`, sans qu'aucun code ici n'ait besoin de
// le savoir. N'ajoutez pas de drapeau de contexte pour « garantir » ça, ce serait redondant.
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
  CravingAxes,
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
import { speedLayer } from './scoring/speed.js'
import { pantryLayer } from './scoring/pantry.js'
import { piquantLayer } from './scoring/piquant.js'
import { archetypeWeightOverride } from './archetypes.js'
import { assertScoringLayersNeverExclude } from '../guards/index.js'

/**
 * Registre des couches de score IMPLÉMENTÉES (7 des 11 du registre complet, `LAYER_DESCRIPTORS`) —
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
  speedLayer as SelectionLayer,
  pantryLayer as SelectionLayer,
  piquantLayer as SelectionLayer,
]

/**
 * Poids brut de `craving` quand la bascule dynamique s'applique (§6.5 ENGINE, « Poids
 * dynamiques »). Avec les couches implémentées à leurs poids de référence, 0.50 brut donne
 * ≈ 0.40 APRÈS normalisation — la valeur citée en §6.5 — mais l'exacte valeur normalisée dépend
 * des couches réellement actives (archétype, `req.weights`…). Ce qui est GARANTI et testé, c'est
 * que `craving` devient le poids le plus élevé, pas qu'il vaut exactement 0.40.
 */
export const CRAVING_DYNAMIC_WEIGHT = 0.5

/**
 * Poids brut de `piquant` quand une tolérance a été DÉCLARÉE (décision 35).
 *
 * ⚠️ MÊME MÉCANISME QUE `craving`, ET POUR UNE RAISON PLUS FORTE ENCORE. `piquant` porte
 * `defaultWeight: 0`, donc la règle 2 ci-dessous ne l'exécute même pas tant que ce poids ne se lève
 * pas. Un poids fixe non nul l'aurait fait tourner pour TOUT LE MONDE : les poids étant normalisés
 * à Σ = 1 (règle 3), ajouter une couche permanente aurait dilué toutes les autres et **déplacé le
 * classement de gens qui n'ont jamais parlé de piquant**. Ici, ne rien déclarer ne coûte rien.
 *
 * 0.25 brut — le rang de `nutri` et `preference`, et c'est voulu : ce que quelqu'un supporte de
 * manger pèse autant que ce qu'il aime. Reste sous `CRAVING_DYNAMIC_WEIGHT` : une envie exprimée
 * pour ce repas-ci est plus spécifique qu'un réglage de fond.
 */
export const PIQUANT_DYNAMIC_WEIGHT = 0.25

/**
 * §6.5 ENGINE, « Poids dynamiques » : une envie est RÉELLEMENT exprimée quand `envie` n'est pas
 * `null` ET qu'au moins un de ses trois axes ne l'est pas — un objet d'envie vide (les 3 axes à
 * `null`) ne déclenche PAS la bascule. Cohérent avec `scoreCraving` (scoring/craving.ts), qui rend
 * déjà `NEUTRAL_SCORE` dans ce même cas (rien à comparer) : un poids élevé sur un signal neutre
 * n'aurait aucun effet utile, la bascule ne se déclenche donc que quand elle a un signal à amplifier.
 */
function isCravingReallyExpressed(envie: CravingAxes | null): boolean {
  if (envie === null) return false
  return envie.sucreSale !== null || envie.legerConsistant !== null || envie.chaudFroid !== null
}

export interface ScoringPassResult {
  /** Score final [0, 1] par candidat. */
  readonly scores: ReadonlyMap<RecipeId, number>
  /** Contribution pondérée par couche, par candidat — voir la décision documentée en en-tête. */
  readonly breakdowns: ReadonlyMap<RecipeId, ScoreBreakdown>
  /**
   * Poids NORMALISÉS effectivement appliqués — une entrée PAR COUCHE ACTIVE uniquement (même
   * convention de sparsité que `ScoreBreakdown`, domain/result.ts : « sous-ensemble des couches
   * effectivement appliquées »), pas un `ScoreWeights` complet sur les 11 id du registre. Cette
   * passe ne connaît que les couches qu'on lui a passées (`layers`, 7 par défaut) — compléter à
   * zéro les 4 couches non implémentées (`pantry`/`occasion`/`topic`/`cost`) pour assembler
   * `EngineDiagnostics.weights` (§8.2 ENGINE) est la responsabilité de l'appelant, pas la sienne.
   */
  readonly weights: Partial<ScoreWeights>
}

/**
 * Exécute la passe de score (§6.4 ENGINE) sur `candidates` (le résultat de `runExclusionPass`,
 * typiquement). `layers` par défaut = `SCORING_LAYERS` (les 7 couches implémentées) ; paramétrable
 * pour isoler un sous-ensemble de couches en test.
 */
export function runScoringPass(
  catalog: Catalog,
  req: SuggestionRequest,
  candidates: CandidateSet,
  layers: readonly SelectionLayer[] = SCORING_LAYERS
): ScoringPassResult {
  // 1. Résoudre le poids effectif de chaque couche (§6.3/§6.3 bis/§6.5, règle 1 — voir la chaîne de
  //    précédence documentée en en-tête de fichier), écarter les poids ≤ 0 (règle 2).
  const activeLayers: Array<{ readonly layer: SelectionLayer; readonly weight: number }> = []
  for (const layer of layers) {
    if (layer.kind !== 'scoring') {
      throw new TypeError(`runScoringPass : la couche '${layer.id}' n'est pas de nature 'scoring'`)
    }
    const id = layer.id as ScoringLayerId
    const cravingDynamicWeight =
      id === 'craving' && isCravingReallyExpressed(req.context.envie) ? CRAVING_DYNAMIC_WEIGHT : undefined
    // ⚠️ `!== null` et non « truthy » : les trois positions sont des chaînes non vides, mais un
    // futur `'aucun'` mal typé passerait un test de véracité. La question est « a-t-il répondu ? ».
    const piquantDynamicWeight =
      id === 'piquant' && req.tolerancePiquant !== null ? PIQUANT_DYNAMIC_WEIGHT : undefined
    const effectiveWeight =
      req.weights?.[id] ??
      cravingDynamicWeight ??
      piquantDynamicWeight ??
      archetypeWeightOverride(req.archetype, id) ??
      layer.defaultWeight
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
// Classement (§6.5 précision 7 ENGINE) : tri par score DÉCROISSANT, tie-break par id de recette
// CROISSANT à score strictement égal. Le tie-break rend le comparateur un ORDRE TOTAL (jamais deux
// entrées distinctes à égalité de comparateur) — base commune aux deux régimes ci-dessous.
//
// ⚠️ CORRECTIF « bande de tolérance » (variété inter-semaine, le tirage seedé n'affectait RIEN avant
// ce lot — `seed` n'était que recopié dans `EngineDiagnostics`). Deux régimes, un seul et même
// comparateur en base :
//   - SANS `alea` (ou `tolerance` ≤ 0) : comportement INCHANGÉ, exactement celui d'avant — tri par
//     score puis id, TOUJOURS identique pour un même `scores` en entrée. C'est le régime que
//     `runSuggestMeals` utilisait seul jusqu'ici et que ~950 tests supposent.
//   - AVEC `alea` ET `tolerance` > 0 : le tri déterministe sert de base, puis on parcourt la liste de
//     gauche à droite ; à chaque position, la RÉSERVE = le préfixe contigu des candidats restants à
//     au plus `tolerance` du meilleur restant (`score >= meilleur * (1 - tolerance)`), et on tire un
//     élément de cette réserve avec `alea()` pour l'échanger en position courante. Le résultat n'est
//     alors PLUS toujours identique — mais il reste REPRODUCTIBLE À GRAINE ÉGALE (même `alea`, même
//     séquence de tirages, même sortie). C'est une garantie différente de « toujours identique », pas
//     une absence de garantie : à graine égale, le classement ne varie jamais ; à graine différente,
//     il varie SEULEMENT parmi des candidats de qualité équivalente (jamais hors de la bande).
// ------------------------------------------------------------------------------------------

export interface RankedCandidate {
  readonly recipeId: RecipeId
  readonly score: number
}

/**
 * Largeur de la bande de tolérance (§6.5 précision 7, correctif variété) — un candidat à moins de
 * 3 % du meilleur score restant est considéré équivalent et entre dans le tirage seedé. Valeur de
 * référence choisie pour rester sous le bruit habituel entre deux recettes proches sans jamais faire
 * entrer un candidat nettement moins bon dans la réserve.
 */
export const DEFAULT_VARIETY_TOLERANCE = 0.03

export function rankScoredCandidates(
  scores: ReadonlyMap<RecipeId, number>,
  alea?: () => number,
  tolerance?: number
): readonly RankedCandidate[] {
  const ranked = Array.from(scores, ([recipeId, score]) => ({ recipeId, score })).sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score
    return a.recipeId < b.recipeId ? -1 : a.recipeId > b.recipeId ? 1 : 0
  })

  if (alea === undefined || tolerance === undefined || tolerance <= 0) return ranked

  // Tirage dans la bande de tolérance — voir l'en-tête ci-dessus pour le régime de garantie.
  //
  // RETRAIT (splice), jamais échange : un échange renverrait l'élément de tête — de score
  // SUPÉRIEUR — plus loin dans `restants`, détruisant l'ordre décroissant du reste ; au tour
  // suivant, `restants[0]` ne serait alors plus garanti être le maximum des restants, et la bande
  // se calculerait sur un pivot trop bas (laissant entrer un candidat hors bande — bug vérifié à
  // la main, voir scoring-pass.test.ts). Un retrait préserve l'ordre du reste : `restants[0]` est
  // TOUJOURS le vrai maximum des restants, à chaque itération.
  //
  // Complexité O(n²) au pire (`splice` décale) — n = nombre de candidats scorés (quelques
  // centaines), conforme au budget du moteur en millisecondes à cette échelle (§5.6 ARCHITECTURE).
  const restants = [...ranked]
  const result: RankedCandidate[] = []
  while (restants.length > 0) {
    // `restants` est trié décroissant et les scores sortent de `clamp01` (dans [0, 1]) : un pivot
    // nul implique que TOUS les restants valent 0 (égalité réelle) — le tirage uniforme sur toute
    // la réserve est alors correct sans traitement particulier, aucun garde-fou nécessaire ici.
    const seuil = restants[0]!.score * (1 - tolerance)
    let fin = 1
    while (fin < restants.length && restants[fin]!.score >= seuil) fin++
    const choisi = Math.min(Math.floor(alea() * fin), fin - 1)
    result.push(restants.splice(choisi, 1)[0]!)
  }
  return result
}
