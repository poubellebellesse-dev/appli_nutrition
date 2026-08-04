// engine/planning/reroll-slot.ts — reproposer un créneau (docs/ENGINE.md §7.2).
//
// « Suggéré → Suggéré : rerollSlot() — exclut le précédent ». C'est le pendant du verrouillage :
// §7.2 fait des deux le mécanisme qui rend le glouton acceptable — l'utilisateur fige ce qu'il
// aime et relance ce qu'il n'aime pas. Sans reroll, refuser un plat obligerait à replanifier toute
// la semaine, ce qui rebattrait aussi les repas qu'il voulait garder.
//
// ⚠️ UN SEUL CRÉNEAU CHANGE. Tout le reste du plan est laissé intact, y compris les créneaux
// suggérés non verrouillés : c'est la promesse de §7.1 (« chaque changement est local et
// explicable »). Replanifier à partir du créneau touché serait plus « optimal » et beaucoup plus
// déroutant.
//
// ⚠️ LE PLAT REFUSÉ EST EXCLU, et les autres plats du plan aussi — sinon le reroll proposerait le
// dîner de jeudi, qu'on a déjà. `RerollOptions.excludeRecipeIds` permet d'en écarter davantage :
// c'est ce qui rend le refus RÉPÉTÉ possible, l'appelant accumulant les refus successifs.
//
// Dépendances autorisées : domain/ uniquement — la suggestion est INJECTÉE, même motif que
// `planWeek` (§2 : L4 ne peut pas importer api/, et une copie du pipeline dériverait).

import type {
  Catalog,
  MealHistory,
  MealPlanEntry,
  RecipeId,
  RerollOptions,
  SlotRef,
  SuggestionRequest,
  UserProfile,
  WeekPlan,
} from '../domain/index.js'
import { NoViableRecipeError } from '../domain/index.js'
import type { SuggestForSlot } from './plan-week.js'

export interface RerollContext {
  readonly profile: UserProfile
  readonly constraints: SuggestionRequest['constraints']
  readonly history: MealHistory
  readonly activeTopics: readonly SuggestionRequest['activeTopics'][number][]
  readonly seed: number
}

/**
 * Remplace la recette d'UN créneau. Rend un nouveau plan ; l'entrée n'est jamais mutée.
 *
 * Le créneau introuvable ou VERROUILLÉ rend le plan inchangé, sans erreur : §7.2 dit qu'un créneau
 * verrouillé est « invisible pour toute replanification ultérieure ». Lever ici obligerait chaque
 * appelant à vérifier avant d'appeler, alors que le refus est déjà l'information utile.
 *
 * Aucun candidat → le créneau devient VIDE plutôt que de garder l'ancien plat. L'utilisateur a
 * refusé ce plat : le lui remettre en silence serait le pire des deux mondes.
 */
export function rerollSlot(
  catalog: Catalog,
  plan: WeekPlan,
  slot: SlotRef,
  contexte: RerollContext,
  suggest: SuggestForSlot,
  opts: RerollOptions = {}
): WeekPlan {
  // ⚠️ LE PLAT, PAS LA PREMIÈRE ENTRÉE DU CRÉNEAU. Depuis le mode repas (2026-08-04), un déjeuner
  // porte jusqu'à deux entrées : le plat et son accompagnement. « Changer » veut dire changer LE
  // PLAT — reproposer le riz à la place du poulet serait absurde. On vise donc l'entrée dont le
  // service n'est pas `accompagnement`, et non l'indice trouvé le premier.
  //
  // ⚠️ L'ACCOMPAGNEMENT N'EST PAS RECALCULÉ, et c'est une dette assumée (voir `ETAT.md`) : après un
  // refus, le nouveau plat peut répéter l'accompagnement resté en place. Le recalculer ici
  // demanderait de rejouer `pickAccompagnement`, qui vit dans `plan-week.ts` avec le catalogue et
  // la cible nutritionnelle du jour — hors de portée d'un reroll de créneau isolé.
  const index = plan.entries.findIndex(
    (e) => e.slot.date === slot.date && e.slot.creneau === slot.creneau && e.service !== 'accompagnement'
  )
  if (index < 0) return plan

  const cible = plan.entries[index]!
  if (cible.locked) return plan

  // Tout ce qui est déjà au plan, plus le plat refusé, plus les refus accumulés par l'appelant.
  const exclus = new Set<RecipeId>(opts.excludeRecipeIds ?? [])
  for (const entree of plan.entries) if (entree.recipeId !== null) exclus.add(entree.recipeId)

  const requete: SuggestionRequest = {
    profile: contexte.profile,
    constraints: contexte.constraints,
    context: {
      date: slot.date,
      creneau: slot.creneau,
      envie: null,
      tempsDisponibleMin: null,
      requiredFoodIds: [],
      pantryFoodIds: [],
    },
    history: contexte.history,
    preferences: new Map(),
    favoriteRecipeIds: new Set(),
    activeTopics: contexte.activeTopics,
    // Même raison que dans `planWeek` : sans une fenêtre assez large, tous les candidats rendus
    // peuvent être déjà exclus et le créneau se viderait sans nécessité.
    limit: exclus.size + 1,
    skipDiversification: true,
    seed: opts.seed ?? contexte.seed,
  }

  let choisi: RecipeId | null = null
  try {
    for (const suggestion of suggest(requete).suggestions) {
      if (!exclus.has(suggestion.recipeId)) {
        choisi = suggestion.recipeId
        break
      }
    }
  } catch (error) {
    if (!(error instanceof NoViableRecipeError)) throw error
  }

  const entries: MealPlanEntry[] = [...plan.entries]
  entries[index] = {
    ...cible,
    recipeId: choisi,
    portions: choisi === null ? 0 : (catalog.recipes.get(choisi)?.portionsBase ?? 0),
    // Un reroll produit une SUGGESTION, jamais un reste : le plat de la veille n'a pas été cuisiné
    // en double parce qu'on a refusé celui-ci.
    isLeftover: false,
  }

  return { ...plan, entries }
}
