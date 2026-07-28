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
// ⚠️ CE QUI N'EST PAS FAIT DANS CE LOT, et qui est assumé :
//   - la CIBLE NUTRITIONNELLE RESTANTE. §7.1 parle d'« état nutritionnel cumulé réinjecté » et
//     §5.4 ARCHITECTURE de « référence RESTANTE ». Aujourd'hui `nutriLayer` vise la part fixe du
//     créneau dans la journée (`MEAL_SLOT_SHARE`, §6.5 précision 1), sans savoir ce qui a déjà été
//     placé. Le câbler demande un point d'injection de cible dans `SuggestionRequest`, qui n'existe
//     pas — travail séparé, à ne pas bricoler ici en dupliquant le calcul de `nutri`.
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
import type { SuggestionResult } from '../domain/index.js'

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
  history: MealHistory
): SuggestionRequest {
  return {
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

  const entries: MealPlanEntry[] = []
  const placedRecipeIds = new Set<RecipeId>()
  // Copie de travail : on n'ajoute JAMAIS à `req.history`, qui appartient à l'appelant.
  const workingEntries: MealHistoryEntry[] = [...req.history.entries]

  for (let dayOffset = 0; dayOffset < req.days; dayOffset++) {
    const date = addDays(req.startDate, dayOffset)

    for (const creneau of req.slots) {
      // ⚠️ COPIE, pas la référence. `workingEntries` continue de grossir après cet appel : passer
      // le tableau vif ferait voir à la requête du lundi les repas placés le mercredi. Défaut réel,
      // trouvé par test — la sortie du glouton était juste, mais l'objet remis à l'appelant mentait.
      const history: MealHistory = { windowDays: req.history.windowDays, entries: [...workingEntries] }
      const scored = pickForSlot(suggest, slotRequest(req, date, creneau, history), placedRecipeIds)

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
