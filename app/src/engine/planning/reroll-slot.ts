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
import { pickAccompagnement, type SuggestForSlot } from './plan-week.js'

export interface RerollContext {
  readonly profile: UserProfile
  readonly constraints: SuggestionRequest['constraints']
  readonly history: MealHistory
  /**
   * Tolérance au piquant déclarée (décision 35). REQUISE, comme sur `WeekPlanRequest` : « Changer »
   * doit écarter ce que la tolérance écarte, sinon le réglage ne tiendrait qu'au premier tirage et
   * se perdrait au premier reroll — sans erreur nulle part.
   */
  readonly tolerancePiquant: SuggestionRequest['tolerancePiquant']
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
    // Même transmission que `planWeek` : « Changer » ne doit pas reproposer ce que la tolérance
    // déclarée écarte, sinon le réglage ne tiendrait qu'au premier tirage.
    tolerancePiquant: contexte.tolerancePiquant,
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

  return reposerLeCreneau(catalog, plan, slot, cible, choisi, suggest, requete)
}

/**
 * Pose un plat CHOISI par l'utilisateur sur un créneau. Rend un nouveau plan.
 *
 * ⚠️ POURQUOI CETTE FONCTION EXISTE À CÔTÉ DE `rerollSlot`, et non comme une option de celui-ci.
 * Décision 49 : « Choisir » et « Changer » sont deux gestes différents, et l'un d'eux TIRAIT AU SORT
 * en s'appelant « Choisir ». La différence n'est pas cosmétique — un tirage écarte ce qui est déjà
 * au plan (`exclus`), un CHOIX ne le peut pas : refuser à quelqu'un le plat qu'il vient de désigner
 * parce qu'il figure déjà mercredi serait absurde. Rien n'est exclu ici, la recette demandée est
 * posée.
 *
 * ⚠️ CE QUI N'EST PAS CONTOURNÉ POUR AUTANT, et c'était la contrainte écrite de la décision 49 :
 *   - l'accompagnement est recalculé par `pickAccompagnement`, comme partout ailleurs ;
 *   - `checkCalorieFloor` repasse sur le plan entier — c'est `createEngine` qui le fait, au même
 *     endroit que pour un reroll (§6.5 ne se contourne pas parce que le geste est manuel) ;
 *   - un créneau VERROUILLÉ refuse le dépôt, comme il refuse un reroll.
 * En revanche les couches d'exclusion ne sont PAS rejouées ici : c'est l'écran qui ne propose que
 * des recettes passées par `browseRecipes`/`searchByPantry`, lesquels appliquent déjà allergies et
 * régime. Le moteur ne peut pas deviner qu'un `RecipeId` reçu est légitime — d'où cette phrase,
 * pour que personne n'appelle cette fonction depuis un chemin qui n'a pas filtré.
 */
export function setSlotRecipe(
  catalog: Catalog,
  plan: WeekPlan,
  slot: SlotRef,
  recipeId: RecipeId,
  contexte: RerollContext,
  suggest: SuggestForSlot
): WeekPlan {
  if (!catalog.recipes.has(recipeId)) {
    throw new RangeError(`setSlotRecipe : recette inconnue « ${recipeId} ».`)
  }

  const index = plan.entries.findIndex(
    (e) => e.slot.date === slot.date && e.slot.creneau === slot.creneau && e.service !== 'accompagnement'
  )
  if (index < 0) return plan

  const cible = plan.entries[index]!
  if (cible.locked) return plan

  const requete: SuggestionRequest = {
    // Même transmission que `planWeek` : « Changer » ne doit pas reproposer ce que la tolérance
    // déclarée écarte, sinon le réglage ne tiendrait qu'au premier tirage.
    tolerancePiquant: contexte.tolerancePiquant,
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
    // Sert UNIQUEMENT à l'accompagnement : `pickAccompagnement` remplace cette borne par la taille
    // du catalogue. Le plat, lui, ne vient pas d'un classement.
    limit: 1,
    skipDiversification: true,
    seed: contexte.seed,
  }

  return reposerLeCreneau(catalog, plan, slot, cible, recipeId, suggest, requete)
}

/**
 * Pose un plat HORS CATALOGUE sur un créneau — plat préparé, traiteur, repas au restaurant.
 * Décision 51, issue « (a) créneau exclu du calcul », tranchée le 2026-08-05. Rend un nouveau plan.
 *
 * ⚠️ NI CATALOGUE, NI `suggest`, NI ACCOMPAGNEMENT — et les trois absences sont le sujet, pas une
 * simplification. Il n'y a rien à chercher : l'utilisateur a déjà son plat. Lui adjoindre du riz
 * choisi par le moteur reviendrait à compléter nutritionnellement une assiette dont on ne connaît
 * pas le contenu ; c'est la même raison qui interdit à `pickAccompagnement` de s'invoquer derrière
 * une recette à `service: null`. Un accompagnement déjà posé sur ce créneau est donc SUPPRIMÉ.
 *
 * ⚠️ CE QUI N'EST PAS CONTOURNÉ. Un créneau VERROUILLÉ refuse le dépôt, comme pour un tirage ou un
 * choix. Et `checkCalorieFloor` repasse sur le plan entier via `createEngine` — il en ressort
 * simplement SILENCIEUX sur cette journée-là, ce qui est l'arbitrage lui-même et non un
 * contournement : voir le commentaire de la garde pour ce que ça coûte.
 *
 * ⚠️ LE LIBELLÉ EST NETTOYÉ ET REFUSÉ S'IL EST VIDE. Un `horsCatalogue: ''` serait le pire des
 * états : non-`null`, donc « rempli et immesurable » pour toutes les gardes, mais illisible à
 * l'écran — un créneau occupé par rien, qui éteindrait l'alerte de plancher sans que personne ne
 * puisse voir pourquoi.
 */
export function setSlotHorsCatalogue(plan: WeekPlan, slot: SlotRef, libelle: string): WeekPlan {
  const propre = libelle.trim()
  if (propre === '') {
    throw new RangeError('setSlotHorsCatalogue : le libellé du plat ne peut pas être vide.')
  }

  const index = plan.entries.findIndex(
    (e) => e.slot.date === slot.date && e.slot.creneau === slot.creneau && e.service !== 'accompagnement'
  )
  if (index < 0) return plan

  const cible = plan.entries[index]!
  if (cible.locked) return plan

  const entries: MealPlanEntry[] = []
  for (const entree of plan.entries) {
    const memeCreneau = entree.slot.date === slot.date && entree.slot.creneau === slot.creneau
    if (memeCreneau && entree.service === 'accompagnement') continue
    if (!memeCreneau) {
      entries.push(entree)
      continue
    }
    entries.push({
      ...cible,
      recipeId: null,
      horsCatalogue: propre,
      // ⚠️ ZÉRO PORTION, ET CE N'EST PAS « ZÉRO ASSIETTE ». `portions` compte ce que la RECETTE
      // produit, pour la liste de courses et les restes — un plat qu'on n'a pas cuisiné n'en produit
      // aucune. La quantité mangée, elle, n'est demandée nulle part et ne doit pas l'être (§6.5).
      portions: 0,
      isLeftover: false,
      // Mode recette : une seule entrée sur ce créneau, puisqu'il n'y a plus d'accompagnement.
      service: null,
    })
  }

  return { ...plan, entries }
}

/**
 * Reconstruit un créneau autour d'un plat — le tronc commun du tirage et du choix manuel.
 *
 * ⚠️ L'ACCOMPAGNEMENT SE RECALCULE AVEC LE PLAT, il ne survit pas au changement. Le garder tel quel
 * laissait passer des paires bancales — on refusait « Poulet rôti » pour tomber sur « Rösti de
 * pommes de terre », et la purée de pommes de terre restait à côté. Pire : elle n'était même plus
 * le meilleur choix pour le nouveau plat, juste un vestige de l'ancien.
 *
 * `null` en plat → pas d'accompagnement, le créneau redevient vide pour de bon.
 */
function reposerLeCreneau(
  catalog: Catalog,
  plan: WeekPlan,
  slot: SlotRef,
  cible: MealPlanEntry,
  choisi: RecipeId | null,
  suggest: SuggestForSlot,
  requete: SuggestionRequest
): WeekPlan {
  const complement = choisi === null ? null : pickAccompagnement(catalog, suggest, requete, choisi)

  const platPose: MealPlanEntry = {
    ...cible,
    recipeId: choisi,
    // ⛔ L'ÉTIQUETTE DE L'ANCIEN CRÉNEAU NE SURVIT PAS AU NOUVEAU PLAT, et `...cible` la recopiait.
    // Poser un plat sur un créneau qui portait « Pizza livrée » rendait une entrée avec un plat ET
    // une étiquette — l'état que la migration v9 interdit (`recipe_id IS NULL OR hors_catalogue IS
    // NULL`). Le plan était donc bien formé aux yeux du moteur et REFUSÉ par la base : « Changer »
    // et « Choisir » levaient une erreur d'écriture sur tout créneau déjà marqué « Un plat
    // préparé ». Mesuré le 2026-08-22 au lot `retour-3`, corrigé ici plutôt qu'à l'écran : c'est le
    // moteur qui décrit le créneau, et un créneau ne peut pas être les deux à la fois.
    // ⚠️ SAUF QUAND AUCUN PLAT N'A PU ÊTRE POSÉ. Sur un vivier épuisé, `choisi` vaut `null` et le
    // créneau redevient vide : effacer l'étiquette LÀ ferait disparaître sans un mot ce que
    // l'utilisateur avait DÉCLARÉ, pour ne rien mettre à la place — et « Changer » n'est filtré sur
    // aucun créneau marqué. La règle de la base tient dans les deux cas : plus aucun plat en face.
    horsCatalogue: choisi === null ? cible.horsCatalogue : null,
    portions: choisi === null ? 0 : (catalog.recipes.get(choisi)?.portionsBase ?? 0),
    // Ni un reroll ni un choix ne produisent un RESTE : le plat de la veille n'a pas été cuisiné en
    // double parce qu'on a changé celui-ci.
    isLeftover: false,
    // Le champ dit le MODE : `'plat'` seulement s'il y a bien une seconde entrée derrière.
    service: complement === null ? null : 'plat',
  }

  // On reconstruit le créneau plutôt que de patcher en place : le nombre d'entrées peut passer de
  // 1 à 2 ou de 2 à 1, et un `entries[i] = …` ne sait pas exprimer ça sans décaler tout le reste.
  const entries: MealPlanEntry[] = []
  for (const entree of plan.entries) {
    const memeCreneau = entree.slot.date === slot.date && entree.slot.creneau === slot.creneau
    if (memeCreneau && entree.service === 'accompagnement') continue // remplacé plus bas, ou supprimé
    if (!memeCreneau) {
      entries.push(entree)
      continue
    }
    entries.push(platPose)
    if (complement !== null) {
      entries.push({
        slot: { date: slot.date, creneau: slot.creneau },
        recipeId: complement,
        horsCatalogue: null,
        portions: catalog.recipes.get(complement)?.portionsBase ?? 0,
        locked: false,
        isLeftover: false,
        service: 'accompagnement',
      })
    }
  }

  return { ...plan, entries }
}
