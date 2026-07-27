// engine/selection/scoring/variety.ts — couche de score `variety` (docs/ENGINE.md §6.5
// précision 5, §13 fenêtre d'historique de 21 jours glissants).
//
// Récence : ancienneté en jours de la DERNIÈRE occurrence, sur la recette ELLE-MÊME ou sur un plat
// de COMPOSITION PROCHE — la plus récente des deux l'emporte. `signatureByRecipe` résout la
// signature des entrées d'HISTORIQUE (pas de la recette candidate, dont l'appelant fournit déjà
// `signature` directement) : cette fonction reste testable sans dépendre du catalogue complet.
//
// ⚠️ CORRECTION MESURÉE (2026-07-27, décision 31). La règle comparait auparavant l'ingrédient LE
// PLUS LOURD (`recipeMainIngredient`) — le même index que la similarité a dû abandonner. Mesuré sur
// le catalogue réel : 194 paires sur 290 (67 %) partageaient un « ingrédient principal » avec des
// compositions très différentes. Une mousse au chocolat rendait « récentes » des galettes de
// sarrasin, les deux étant majoritairement des œufs par le poids.
//
// Cinq règles comparées (banc app/src/cli/compare-variety.ts) sur des paires jugées pour CETTE
// question — « manger A hier rend-il B répétitif aujourd'hui ? », qui n'est PAS « A et B se
// ressemblent-ils » :
//
//   règle                        déclenche à tort   rate à raison   paires touchées
//   ingrédient le plus lourd          6 / 6             1 / 7            326
//   chevauchement ≥ 0,35              3 / 6             1 / 7            204
//   chevauchement ≥ 0,45  ← RETENU    0 / 6             1 / 7             86
//   chevauchement ≥ 0,55              0 / 6             2 / 7             43
//   ≥ 0,45 OU même groupe alim.       4 / 6             1 / 7            735
//
// Le repli par `Food.groupe` a été TESTÉ ET ÉCARTÉ : « viandes » mélange bœuf, poulet, porc et
// agneau, donc tout plat carné rendait tout autre plat carné répétitif.
//
// ⚠️ LIMITE CONNUE ET NON RÉSOLUE : le seuil rate « poulet rôti aux carottes » × « poulet au citron
// et aux olives » (7 % de chevauchement). Les deux emploient `poulet_blanc` et `poulet_cuisse`,
// DEUX ALIMENTS DISTINCTS du catalogue. C'est une limite de DONNÉES, pas de règle : rien n'exprime
// que ces deux aliments sont le même animal. La corriger demande une notion de sous-famille sur
// `Food`, à décider séparément — aucun réglage de seuil ne la rattrapera.
//
// `recence = exp(-ageJours / TAU)`, TAU réglable à TROIS CRANS — 3, 7 ou 14 jours, défaut 7 jours
// (§6.5 ter ENGINE, « variety — trois réglages séparés ») — via `ScoreVarietyArgs.tauDays`
// (`VarietyTau`, union littérale fermée : le réglage a trois positions, pas un curseur libre).
// Absent → `VARIETY_RECENCY_TAU_DAYS_DEFAULT` (constante nommée ci-dessous). Ne pas confondre avec
// les 21 jours de la fenêtre d'historique de §13 : TAU règle la VITESSE D'OUBLI (décroissance d'un
// plat individuel), la fenêtre de 21 jours borne la PROFONDEUR des entrées considérées — deux
// horloges indépendantes, l'une ne change pas l'autre. Jamais vu (aucune occurrence pertinente dans
// l'historique fourni) → recence = 0. `nouveaute = 1 - recence`.
//
// Modulation par `habit` (précision 5) : `familiarity` ∈ [0, 1] — 0 = pure nouveauté (le score EST
// la nouveauté), 0.5 = neutre (aucune modulation), 1 = BONUS DE FAMILIARITÉ, le signal s'inverse :
// score = (1 − familiarity)·nouveaute + familiarity·(1 − nouveaute). Cette fonction ne calcule pas
// `familiarity` elle-même — voir scoreHabit, destiné à l'alimenter (P1b-2 pour le câblage).
//
// Override (« Surprends-moi » / « Mes classiques ») : prime sur la modulation — 'surprise' force
// familiarity=0, 'classiques' force familiarity=1, quelle que soit la valeur passée. Vient de
// `SuggestionRequest.varietyMode` (§8.1 ENGINE) depuis P1c ; le vocabulaire de `VarietyOverride`
// était 'classics' (anglais) jusque-là — aligné sur le français comme le reste des unions fermées
// du domaine (`MealOrigin`, `NutrientSense`, `ArchetypeId`) pour éviter une table de traduction
// entre `VarietyMode` et cette union.
//
// Dates : écarts calculés en jours calendaires depuis les chaînes ISO `yyyy-mm-dd`, jamais
// `Date.now()` (§3 ENGINE — l'horloge vient de `today`). Une entrée d'historique postérieure à
// `today` est ignorée (donnée incohérente, ne doit pas produire une ancienneté négative).
//
// Origine des entrées (§6.5 ter ENGINE, §2.7 CONCEPTION_B_VIN_REPAS) : `variety` lit TOUTES les
// entrées d'historique, `choisi` comme `reste` — un reste mangé lasse tout autant qu'un plat
// choisi, la lassitude ne se soucie pas de la raison du repas. C'est l'INVERSE de `habit`, qui ne
// compte que les `choisi` (un reste n'est pas une préférence exprimée) — voir en-tête de habit.ts.
// Asymétrie volontaire : ne pas « corriger » l'un en croyant aligner l'autre.
//
// Dépendances autorisées : domain/, ./index.js — §2/§3 ENGINE.

import type { MealHistory, RecipeId, RecipeSignature, VarietyMode } from '../../domain/index.js'
import { signatureOverlap } from '../../nutrition/signature.js'
import type { CandidateSet, ScoringLayerResult, SelectionLayer } from '../index.js'
import { clamp01 } from './index.js'
import { scoreHabit } from './habit.js'

/** Cran de vitesse d'oubli de `variety` (§6.5 ter ENGINE) — trois positions, pas un curseur libre. */
export type VarietyTau = 3 | 7 | 14

/** Cran par défaut quand `tauDays` est absent (§6.5 ter ENGINE). */
const VARIETY_RECENCY_TAU_DAYS_DEFAULT: VarietyTau = 7

const MS_PER_DAY = 86_400_000

function parseIsoDateUtc(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`)
}

function ageInDays(entryDate: string, today: string): number {
  return Math.round((parseIsoDateUtc(today) - parseIsoDateUtc(entryDate)) / MS_PER_DAY)
}

export type VarietyOverride = 'surprise' | 'classiques' | null

/**
 * Seuil de chevauchement de signature au-delà duquel deux plats comptent comme « le même repas »
 * pour la récence. MESURÉ (voir en-tête), pas réglé au jugé : à 0,35 la règle réintroduit des faux
 * rapprochements, à 0,55 elle commence à manquer des doublons évidents.
 */
export const VARIETY_RECENCY_OVERLAP_THRESHOLD = 0.45

export interface ScoreVarietyArgs {
  readonly recipeId: RecipeId
  /** Signature du candidat (§6.6 ENGINE). Map vide = composition inconnue, aucun rapprochement. */
  readonly signature: RecipeSignature
  readonly history: MealHistory
  /** ISO yyyy-mm-dd — horloge injectée (§3 ENGINE). */
  readonly today: string
  readonly familiarity: number
  /** Résout la signature des entrées d'historique — voir en-tête de fichier. */
  readonly signatureByRecipe?: ReadonlyMap<RecipeId, RecipeSignature>
  readonly override?: VarietyOverride
  /** Cran de vitesse d'oubli — 3/7/14 jours. Absent → `VARIETY_RECENCY_TAU_DAYS_DEFAULT` (7). */
  readonly tauDays?: VarietyTau
}

export function scoreVariety(args: ScoreVarietyArgs): number {
  let bestAgeJours: number | null = null

  for (const historyEntry of args.history.entries) {
    if (historyEntry.date > args.today) continue // postérieure à today : ignorée

    const matchesRecipe = historyEntry.recipeId === args.recipeId
    const pastSignature = args.signatureByRecipe?.get(historyEntry.recipeId)
    const matchesComposition =
      pastSignature !== undefined &&
      signatureOverlap(args.signature, pastSignature) >= VARIETY_RECENCY_OVERLAP_THRESHOLD

    if (!matchesRecipe && !matchesComposition) continue

    const age = ageInDays(historyEntry.date, args.today)
    if (bestAgeJours === null || age < bestAgeJours) bestAgeJours = age
  }

  const tauDays = args.tauDays ?? VARIETY_RECENCY_TAU_DAYS_DEFAULT
  const recence = bestAgeJours === null ? 0 : Math.exp(-bestAgeJours / tauDays)
  const nouveaute = 1 - recence

  const familiarity =
    args.override === 'surprise' ? 0 : args.override === 'classiques' ? 1 : args.familiarity

  const score = (1 - familiarity) * nouveaute + familiarity * (1 - nouveaute)
  return clamp01(score)
}

// ------------------------------------------------------------------------------------------
// Couche `variety` (§6.2 ENGINE) — enveloppe `scoreVariety` dans le contrat `SelectionLayer`.
//
// `configure` pré-calcule ce qui dépend du `Catalog` : `mainIngredientByRecipe` est directement
// `catalog.indexes.recipeMainIngredient` (§9.1 ENGINE) — le même index sert à la fois à résoudre
// l'ingrédient principal du CANDIDAT scoré et celui des entrées d'HISTORIQUE (voir en-tête de
// fichier). `history`/`today` viennent de `req.history`/`req.context.date`.
//
// ⚠️ Import de `scoreHabit` depuis `./habit.js` : NE PAS lire comme un couplage entre couches. Ce
// n'est PAS `habitLayer` qui est appelé ici — c'est la fonction PURE `scoreHabit` du même module
// `scoring/`, exactement comme le documente l'en-tête de ce fichier (§6.5 précision 5 : « habit
// module variety »). Une couche ne connaît toujours ni les autres couches ni le pipeline (§6.2
// ENGINE) : `varietyLayer` ne référence jamais `habitLayer`, seulement une fonction de calcul.
//
// `familiarity` est donc calculée PAR CANDIDAT dans `apply`, avant l'appel à `scoreVariety` —
// c'est un calcul dérivé de `candidates`/`config`, pas quelque chose de pré-calculable une fois
// pour toutes au `configure` (il dépend du `recipeId` scoré). `override`, lui, EST pré-calculable :
// il vaut la même chose pour tous les candidats, il est donc résolu une fois au `configure` depuis
// `req.varietyMode` (P1c, §8.1 ENGINE).
//
// ⚠️ La modulation par `habit` continue d'être calculée même sous override, alors que le résultat
// sera écrasé. C'est délibéré : sauter `scoreHabit` ferait diverger le chemin « avec override » du
// chemin normal, et `scoreVariety` est la SEULE à connaître la règle de priorité (voir sa
// signature — elle reçoit `familiarity` ET `override`, et tranche elle-même). Le coût est un
// exponentielle par candidat sur un catalogue en RAM.
// ------------------------------------------------------------------------------------------

export interface VarietyLayerConfig {
  readonly history: MealHistory
  /** ISO yyyy-mm-dd — horloge injectée (§3 ENGINE), reprise de `req.context.date`. */
  readonly today: string
  readonly signatureByRecipe: ReadonlyMap<RecipeId, RecipeSignature>
  /**
   * Résolu depuis `req.varietyMode` (§8.1 ENGINE) : `'auto'` et l'absence donnent tous deux
   * `null` — la position `auto` de `VarietyMode` n'existe pas dans `VarietyOverride`, l'absence
   * d'override EST le mode automatique.
   */
  readonly override: VarietyOverride
}

/** `VarietyMode` (domain/, L1) → `VarietyOverride` (scoring, L3) — voir `VarietyLayerConfig`. */
function resolveOverride(mode: VarietyMode | undefined): VarietyOverride {
  return mode === undefined || mode === 'auto' ? null : mode
}

export const varietyLayer: SelectionLayer<VarietyLayerConfig> = {
  id: 'variety',
  kind: 'scoring',
  critical: false,
  defaultWeight: 0.15,

  configure: (req, catalog) => ({
    history: req.history,
    today: req.context.date,
    signatureByRecipe: catalog.indexes.recipeSignature,
    override: resolveOverride(req.varietyMode),
  }),

  apply: (candidates: CandidateSet, config: VarietyLayerConfig): ScoringLayerResult => {
    const scores = new Map<RecipeId, number>()
    for (const recipeId of candidates) {
      const signature = config.signatureByRecipe.get(recipeId) ?? new Map()
      const familiarity = scoreHabit({
        recipeId,
        signature,
        history: config.history,
        today: config.today,
        signatureByRecipe: config.signatureByRecipe,
      })
      scores.set(
        recipeId,
        scoreVariety({
          recipeId,
          signature,
          history: config.history,
          today: config.today,
          familiarity,
          signatureByRecipe: config.signatureByRecipe,
          override: config.override,
        })
      )
    }
    return { scores }
  },
}
