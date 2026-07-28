// engine/planning/plan-week.ts — planification glouton (docs/ENGINE.md §7.1).
//
// Jour par jour, créneau par créneau : on demande une suggestion, on retient la première, on passe
// au créneau suivant. Pas d'optimisation globale — §7.1 : optimiser 21 créneaux sous contraintes
// multiples est NP-difficile, mais surtout INCOMPRÉHENSIBLE pour l'utilisateur. Modifier une
// préférence rebattrait toutes les cartes, y compris les repas qu'il aimait. Le glouton produit un
// résultat stable où chaque changement est local et explicable.
//
// ⚠️ CE QUI FAIT UNE SEMAINE ET NON N SUGGESTIONS INDÉPENDANTES : l'HISTORIQUE DE TRAVAIL. Après
// chaque choix, la recette retenue est ajoutée à l'historique passé au créneau suivant, avec
// `origine: 'choisi'` et la date du créneau. Les couches `variety` et `habit` la voient donc comme
// un repas réellement pris — c'est ce qui empêche le lundi et le mardi d'être le même plat.
//
// Sans ce mécanisme, `planWeek` ne serait qu'une boucle appelant `suggestMeals` : chaque créneau
// verrait le même historique initial, donc les mêmes scores, donc la même tête de classement. Le
// planning rendrait sept fois le même dîner sans que rien ne signale l'anomalie.
//
// Deux protections se cumulent, et ce n'est pas une redondance :
//   - l'historique de travail fait BAISSER le score d'un plat récent (signal continu, il décroît
//     avec les jours — c'est `variety`, §6.5 précision 5) ;
//   - `placedRecipeIds` INTERDIT le doublon exact dans la même fenêtre (garantie dure).
// Le premier seul laisserait passer un doublon quand tous les autres candidats sont mauvais ; le
// second seul ne dirait rien de la lassitude à J+3. Retirer l'un des deux dégrade le résultat.
//
// ⚠️ LA CIBLE NUTRITIONNELLE RESTANTE (2026-07-28) — le « cumul réinjecté » de §7.1. À chaque
// créneau, la cible n'est plus la part théorique du créneau mais CE QUI RESTE de la journée, réparti
// sur les créneaux qui restent : `(référence journalière − déjà placé aujourd'hui) / créneaux
// restants`. Un déjeuner léger relève donc mécaniquement la cible du dîner.
//
// ⚠️ CE QUE ÇA NE FAIT PAS, et il faut le savoir avant d'en attendre trop. `nutri` reste UNE couche
// de score parmi d'autres, et son écart est moyenné sur les 9 nutriments : MESURÉ, l'énergie pèse
// environ `0,25 / 9 ≈ 2,8 %` de la note finale. Réinjecter le cumul déplace le classement à la
// marge — ça ne rend pas l'énergie contraignante. Le seul mécanisme qui REFUSE une journée
// insuffisante reste `assertCalorieFloor`. Ne pas confondre les deux.
//
// ⚠️ CE QUI N'EST TOUJOURS PAS FAIT :
//   - les RESTES (`planLeftovers`, §7.3) — `isLeftover` reste `false` partout.
//   - le MODE REPAS (`service`, v1.5) — `service` reste `null`, un plat par créneau.
//
// ⚠️ LA SUGGESTION EST INJECTÉE, pas reconstruite. `planWeek` reçoit `suggest` en paramètre plutôt
// que de recomposer `runExclusionPass` + `runScoringPass` + `diversify` lui-même. Deux raisons :
//   - la couche L4 ne peut pas importer `api/` (L5), où vit l'assemblage de `suggestMeals` (§2) ;
//   - surtout, dupliquer le pipeline le ferait DÉRIVER. `suggestMeals` exécute au passage
//     `assertNoDeclaredAllergen` et `assertCriticalLayersRan` (§8) ; une copie qui les oublierait
//     produirait un planning moins sûr que la suggestion unitaire, sans que rien ne le signale.
// C'est exactement le `P->>S: suggest(...)` du diagramme de séquence de §7.1.
//
// Dépendances autorisées : domain/ uniquement — §2/§3 ENGINE.

import type {
  Catalog,
  MealHistory,
  MealHistoryEntry,
  MealPlanEntry,
  MealSlot,
  RecipeId,
  SuggestionRequest,
  WeekPlan,
  WeekPlanRequest,
} from '../domain/index.js'
import { NoViableRecipeError } from '../domain/index.js'
import type { NutrientVector, SuggestionResult } from '../domain/index.js'
import { resolveReferenceIntakes } from '../nutrition/index.js'

/** Ce que `planWeek` demande au moteur de sélection — voir l'en-tête sur l'injection. */
export type SuggestForSlot = (req: SuggestionRequest) => SuggestionResult

/** Bornes de la fenêtre glissante (§7.1) — 2 jours couvre le week-end, 14 la planification anticipée. */
export const MIN_PLAN_DAYS = 2
export const MAX_PLAN_DAYS = 14

const MS_PER_DAY = 86_400_000

/** ISO yyyy-mm-dd + n jours. Jamais `Date.now()` : la date de départ vient de la requête (§3 ENGINE). */
export function addDays(isoDate: string, days: number): string {
  const base = Date.parse(`${isoDate}T00:00:00Z`)
  return new Date(base + days * MS_PER_DAY).toISOString().slice(0, 10)
}

/**
 * Construit la requête d'un créneau. `history` n'est PAS `req.history` mais l'historique DE TRAVAIL,
 * enrichi des plats déjà placés (voir en-tête). `excludedFoodIds` reste celui de l'utilisateur : on
 * n'exclut pas des ALIMENTS pour éviter un doublon, on exclut la RECETTE (voir `placedRecipeIds`).
 */
function slotRequest(
  req: WeekPlanRequest,
  date: string,
  creneau: MealSlot,
  history: MealHistory,
  nutrientTarget: NutrientVector
): SuggestionRequest {
  return {
    nutrientTarget,
    profile: req.profile,
    constraints: req.constraints,
    context: {
      date,
      creneau,
      envie: null,
      tempsDisponibleMin: null,
      requiredFoodIds: [],
      pantryFoodIds: [],
    },
    history,
    preferences: new Map(),
    favoriteRecipeIds: new Set(),
    activeTopics: req.activeTopics,
    ...(req.weights === undefined ? {} : { weights: req.weights }),
    seed: req.seed,
  }
}

export function planWeek(catalog: Catalog, req: WeekPlanRequest, suggest: SuggestForSlot): WeekPlan {
  if (req.days < MIN_PLAN_DAYS || req.days > MAX_PLAN_DAYS) {
    throw new RangeError(
      `planWeek : fenêtre de ${req.days} jour(s) hors bornes — §7.1 impose ${MIN_PLAN_DAYS} à ${MAX_PLAN_DAYS}.`
    )
  }
  if (req.slots.length === 0) {
    throw new RangeError('planWeek : aucun créneau demandé — `slots` ne peut pas être vide.')
  }

  const dailyReference = resolveReferenceIntakes(req.profile, catalog)
  const entries: MealPlanEntry[] = []
  const placedRecipeIds = new Set<RecipeId>()
  // Copie de travail : on n'ajoute JAMAIS à `req.history`, qui appartient à l'appelant.
  const workingEntries: MealHistoryEntry[] = [...req.history.entries]

  for (let dayOffset = 0; dayOffset < req.days; dayOffset++) {
    const date = addDays(req.startDate, dayOffset)

    // Cumul du JOUR : remis à zéro à chaque date, jamais cumulé sur la semaine — la référence est
    // journalière (§7.1 : « la cible est calculée sur la durée réelle de la fenêtre » pour la
    // fenêtre, mais l'apport se juge jour par jour, comme `assertCalorieFloor`).
    const placedToday = new Float64Array(dailyReference.length)

    for (const [slotIndex, creneau] of req.slots.entries()) {
      // ⚠️ COPIE, pas la référence. `workingEntries` continue de grossir après cet appel : passer
      // le tableau vif ferait voir à la requête du lundi les repas placés le mercredi. Défaut réel,
      // trouvé par test — la sortie du glouton était juste, mais l'objet remis à l'appelant mentait.
      const history: MealHistory = { windowDays: req.history.windowDays, entries: [...workingEntries] }
      const cible = remainingTarget(dailyReference, placedToday, req.slots.length - slotIndex)
      const scored = pickForSlot(
        suggest,
        slotRequest(req, date, creneau, history, cible),
        placedRecipeIds
      )

      entries.push({
        slot: { date, creneau },
        recipeId: scored,
        portions: scored === null ? 0 : (catalog.recipes.get(scored)?.portionsBase ?? 0),
        locked: false,
        isLeftover: false,
        service: null,
      })

      if (scored === null) continue
      placedRecipeIds.add(scored)
      workingEntries.push({ recipeId: scored, date, creneau, origine: 'choisi' })

      const apport = catalog.indexes.recipeNutrients.get(scored)
      if (apport !== undefined) {
        for (let i = 0; i < placedToday.length; i++) placedToday[i] = (placedToday[i] ?? 0) + (apport[i] ?? 0)
      }
    }
  }

  return { id: `plan-${req.startDate}-${req.days}`, startDate: req.startDate, days: req.days, seed: req.seed, entries }
}

/**
 * Le meilleur candidat non encore placé, ou `null` si le créneau ne peut pas être rempli.
 *
 * ⚠️ UN CRÉNEAU VIDE N'EST PAS UNE ERREUR. `MealPlanEntry.recipeId` est explicitement nullable
 * (§7.2 : l'état `Vide` existe), et un catalogue qui n'a que 7 petits-déjeuners ne peut pas en
 * fournir 14 sans répétition. Faire échouer tout le plan pour un créneau impossible serait pire
 * que de le laisser vide : l'utilisateur perdrait les treize autres.
 *
 * `NoViableRecipeError` (aucun candidat après exclusion) est donc RATTRAPÉE ici, et seulement ici.
 * Ne pas la laisser remonter : elle est normale en planification, anormale en suggestion unitaire.
 */
function pickForSlot(
  suggest: SuggestForSlot,
  req: SuggestionRequest,
  placedRecipeIds: ReadonlySet<RecipeId>
): RecipeId | null {
  let result: SuggestionResult
  try {
    result = suggest(req)
  } catch (error) {
    if (error instanceof NoViableRecipeError) return null
    throw error
  }

  for (const suggestion of result.suggestions) {
    if (!placedRecipeIds.has(suggestion.recipeId)) return suggestion.recipeId
  }
  return null
}

/**
 * Ce qu'il RESTE à couvrir aujourd'hui, réparti sur les créneaux restants — le « cumul réinjecté ».
 *
 * ⚠️ PLANCHER À ZÉRO, pas de valeur négative. Un créneau qui a déjà dépassé la référence du jour
 * doit viser 0, pas un nombre négatif : `scoreNutri` ignore les cibles ≤ 0 (§6.5 précision 1), donc
 * un négatif ferait silencieusement DISPARAÎTRE le nutriment du score au lieu de dire « on a assez ».
 *
 * `slotsRemaining` inclut le créneau courant : au premier créneau d'une journée à 4, on vise le
 * quart de la journée, pas le tiers de ce qui reste après lui.
 */
function remainingTarget(
  dailyReference: NutrientVector,
  placedToday: NutrientVector,
  slotsRemaining: number
): NutrientVector {
  const diviseur = Math.max(1, slotsRemaining)
  const target = new Float64Array(dailyReference.length)
  for (let i = 0; i < target.length; i++) {
    target[i] = Math.max(0, (dailyReference[i] ?? 0) - (placedToday[i] ?? 0)) / diviseur
  }
  return target
}
