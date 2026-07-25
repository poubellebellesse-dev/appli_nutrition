// engine/selection/scoring/variety.ts — couche de score `variety` (docs/ENGINE.md §6.5
// précision 5, §13 fenêtre d'historique de 21 jours glissants).
//
// Récence : ancienneté en jours de la DERNIÈRE occurrence, sur la recette ET son ingrédient
// principal (précision 5 renvoyant à la précision 4) — la plus récente des deux occurrences
// l'emporte. `mainIngredientByRecipe` résout l'ingrédient principal des entrées d'HISTORIQUE (pas
// de la recette candidate, dont l'appelant fournit déjà `mainIngredientId` directement) : cette
// fonction reste testable sans dépendre du catalogue complet, conformément au cadrage du lot.
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
// familiarity=0, 'classics' force familiarity=1, quelle que soit la valeur passée.
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

import type { FoodId, MealHistory, RecipeId } from '../../domain/index.js'
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

export type VarietyOverride = 'surprise' | 'classics' | null

export interface ScoreVarietyArgs {
  readonly recipeId: RecipeId
  readonly mainIngredientId: FoodId | null
  readonly history: MealHistory
  /** ISO yyyy-mm-dd — horloge injectée (§3 ENGINE). */
  readonly today: string
  readonly familiarity: number
  /** Résout l'ingrédient principal des entrées d'historique — voir en-tête de fichier. */
  readonly mainIngredientByRecipe?: ReadonlyMap<RecipeId, FoodId>
  readonly override?: VarietyOverride
  /** Cran de vitesse d'oubli — 3/7/14 jours. Absent → `VARIETY_RECENCY_TAU_DAYS_DEFAULT` (7). */
  readonly tauDays?: VarietyTau
}

export function scoreVariety(args: ScoreVarietyArgs): number {
  let bestAgeJours: number | null = null

  for (const historyEntry of args.history.entries) {
    if (historyEntry.date > args.today) continue // postérieure à today : ignorée

    const matchesRecipe = historyEntry.recipeId === args.recipeId
    const matchesMainIngredient =
      args.mainIngredientId !== null &&
      args.mainIngredientByRecipe?.get(historyEntry.recipeId) === args.mainIngredientId

    if (!matchesRecipe && !matchesMainIngredient) continue

    const age = ageInDays(historyEntry.date, args.today)
    if (bestAgeJours === null || age < bestAgeJours) bestAgeJours = age
  }

  const tauDays = args.tauDays ?? VARIETY_RECENCY_TAU_DAYS_DEFAULT
  const recence = bestAgeJours === null ? 0 : Math.exp(-bestAgeJours / tauDays)
  const nouveaute = 1 - recence

  const familiarity =
    args.override === 'surprise' ? 0 : args.override === 'classics' ? 1 : args.familiarity

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
// pour toutes au `configure` (il dépend du `recipeId` scoré). `override` reste non renseigné :
// `varietyMode` n'existe pas encore dans `SuggestionRequest` (P1c, §8.1 ENGINE).
// ------------------------------------------------------------------------------------------

export interface VarietyLayerConfig {
  readonly history: MealHistory
  /** ISO yyyy-mm-dd — horloge injectée (§3 ENGINE), reprise de `req.context.date`. */
  readonly today: string
  readonly mainIngredientByRecipe: ReadonlyMap<RecipeId, FoodId>
}

export const varietyLayer: SelectionLayer<VarietyLayerConfig> = {
  id: 'variety',
  kind: 'scoring',
  critical: false,
  defaultWeight: 0.15,

  configure: (req, catalog) => ({
    history: req.history,
    today: req.context.date,
    mainIngredientByRecipe: catalog.indexes.recipeMainIngredient,
  }),

  apply: (candidates: CandidateSet, config: VarietyLayerConfig): ScoringLayerResult => {
    const scores = new Map<RecipeId, number>()
    for (const recipeId of candidates) {
      const mainIngredientId = config.mainIngredientByRecipe.get(recipeId) ?? null
      const familiarity = scoreHabit({
        recipeId,
        mainIngredientId,
        history: config.history,
        today: config.today,
        mainIngredientByRecipe: config.mainIngredientByRecipe,
      })
      scores.set(
        recipeId,
        scoreVariety({
          recipeId,
          mainIngredientId,
          history: config.history,
          today: config.today,
          familiarity,
          mainIngredientByRecipe: config.mainIngredientByRecipe,
        })
      )
    }
    return { scores }
  },
}
