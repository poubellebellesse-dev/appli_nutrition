// engine/domain/planning.ts
//
// Types de planification (docs/ENGINE.md §7, §8.1 : WeekPlan, SlotRef) et de l'API publique qui
// en dépend (scaleRecipe, buildShoppingList — §8 ENGINE).

import type { FoodId, RecipeId, TopicId } from './ids.js'
import type { CourseKind, MealSlot, RecipeIngredient } from './catalog.js'
import type { UserProfile } from './profile.js'
import type { HardConstraints, MealHistory, PiquantTolerance } from './request.js'
import type { ScoreWeights } from './result.js'

export interface SlotRef {
  /** ISO yyyy-mm-dd. */
  readonly date: string
  readonly creneau: MealSlot
}

/** Fenêtre glissante de 2 à 14 jours, à partir de n'importe quel jour (§7.1, §9 décision 9 ENGINE). */
export interface WeekPlanRequest {
  readonly profile: UserProfile
  readonly constraints: HardConstraints
  readonly startDate: string
  readonly days: number
  readonly slots: readonly MealSlot[]
  readonly history: MealHistory
  readonly activeTopics: readonly TopicId[]
  /**
   * Tolérance au piquant déclarée (décision 35), transmise TELLE QUELLE aux requêtes de créneau que
   * `planWeek` et `rerollSlot` construisent en interne.
   *
   * ⚠️ REQUIS, pour la même raison que sur `SuggestionRequest` — et ici le risque est plus grand
   * encore : sans ce champ, le réglage aurait fonctionné sur l'écran Aujourd'hui et **pas du tout**
   * sur la semaine, ce qui se serait lu comme un caprice de l'application plutôt que comme un bug.
   */
  readonly tolerancePiquant: PiquantTolerance | null
  readonly weights?: Partial<ScoreWeights>
  /**
   * Nombre de personnes à table, pour le calcul des RESTES (§7.3). Défaut 1.
   *
   * ⚠️ À NE PAS CONFONDRE avec `UserProfile.facteurPortion` (0,7…1,5), qui est un APPÉTIT
   * personnel — « je mange un peu plus / un peu moins » — et s'applique à une portion. `convives`
   * compte des assiettes.
   *
   * Sans ce champ, `planLeftovers` ne peut rien calculer : une recette de 4 portions ne laisse un
   * reste que si l'on sait combien en sont mangées sur le coup.
   */
  readonly convives?: number
  /**
   * Créneaux que l'utilisateur GARDE — « Proposer une autre semaine » ne doit pas les toucher
   * (§7.2 ENGINE, §4.2 DESIGN : « vos repas gardés ne changeront pas »).
   *
   * ⚠️ CE CHAMP EXISTE PARCE QUE LE CONTOURNEMENT CÔTÉ APPELANT EST FAUX. Régénérer un plan puis
   * réécrire les créneaux verrouillés par-dessus casse la garantie dure de `placedRecipeIds` : la
   * nouvelle semaine peut replacer AILLEURS le plat qu'on vient de réimposer, et le même dîner
   * apparaît deux fois sans que rien ne le signale. Seul `planWeek` peut amorcer son propre
   * ensemble de plats déjà placés — d'où le champ ici plutôt qu'une recomposition en aval.
   *
   * Absent ou vide → comportement d'avant, aucun créneau verrouillé.
   *
   * Un verrou dont le créneau tombe HORS de la fenêtre est ignoré (il n'appartient pas à ce plan).
   * Un verrou à `recipeId: null` garde le créneau VIDE — « je ne mange pas ici » se garde aussi.
   * Deux verrous sur le même créneau : le premier gagne (le mode repas, plusieurs `service` par
   * créneau, n'est pas encore produit par `planWeek` — voir son en-tête).
   */
  readonly lockedEntries?: readonly MealPlanEntry[]
  readonly seed: number
}

export interface MealPlanEntry {
  readonly slot: SlotRef
  /** null = créneau vide, OU rempli hors catalogue — voir `horsCatalogue`, qui les départage. */
  readonly recipeId: RecipeId | null
  /**
   * Libellé libre d'un plat que l'application ne sait pas mesurer — plat préparé, traiteur,
   * restaurant (décision 51, issue « (a) créneau exclu », tranchée le 2026-08-05).
   *
   * ⚠️ CE CHAMP EST LE MARQUEUR, il n'en a pas un à côté de lui. Non-`null` signifie « ce créneau
   * est REMPLI et son apport est INCONNU » — l'état que rien ne savait exprimer, et qui n'est ni
   * « vide » (`recipeId` et `horsCatalogue` tous deux `null`) ni « rempli et mesurable ». Ajouter
   * un booléen en plus créerait deux champs capables de se contredire.
   *
   * ⚠️ EXCLUSIF AVEC `recipeId`, et la base le refuse (`meal_plan_entry`, migration 9) : porter les
   * deux poserait « lequel compte ? » à chaque lecture.
   *
   * ⚠️ REQUIS, PAS OPTIONNEL, et c'est délibéré. Un champ optionnel qu'un appelant oublie ne
   * produit AUCUNE erreur — ni au type, ni au test, ni à l'écran ; c'est le défaut que ce projet a
   * déjà payé trois fois (`reference/PIEGES.md`). Le rendre requis force chaque site de
   * construction à écrire `horsCatalogue: null`, donc à voir que le cas existe.
   *
   * ⚠️ AUCUNE ÉNERGIE SAISIE À CÔTÉ. L'issue (b) de la décision 51 a été écartée : un nombre tapé
   * par l'utilisateur se mélangerait aux valeurs CIQUAL sans marque de provenance (principe 3).
   */
  readonly horsCatalogue: string | null
  readonly portions: number
  /** Un créneau verrouillé est invisible pour toute replanification ultérieure (§7.2 ENGINE). */
  readonly locked: boolean
  /** Placement automatique d'un reste (§7.3 ENGINE). */
  readonly isLeftover: boolean
  /**
   * `null` = mode recette (un plat unique, comportement actuel). Non-`null` = mode repas — ce
   * créneau contient plusieurs `MealPlanEntry`, une par service (§2.1 CONCEPTION_B_VIN_REPAS).
   */
  readonly service: CourseKind | null
}

/**
 * Avertissement porté par un plan — §6.5 ARCHITECTURE, « sans écran d'avertissement explicite ».
 *
 * ⚠️ CE N'EST PAS UNE ERREUR. Le plan est rendu quand même : un avertissement PRÉVIENT, il
 * n'interdit pas. C'est la différence avec `EngineSafetyError`, que lèvent les quatre autres
 * garde-fous (allergène déclaré, claim thérapeutique…) et qui, elle, annule la sortie.
 */
export interface PlanWarning {
  readonly kind: 'plancher_calorique'
  /** ISO yyyy-mm-dd du jour concerné. */
  readonly date: string
  /**
   * Énergie des repas PRÉVUS ce jour-là — pas l'apport de la personne.
   *
   * ⚠️ LA DISTINCTION N'EST PAS UN DÉTAIL DE VOCABULAIRE, elle décide de ce que l'écran a le droit
   * d'écrire. Le plan ne contient que des recettes posées : ni le pain sur la table, ni le yaourt,
   * ni le fruit, ni le verre de lait, ni un repas pris dehors. Un plan à deux créneaux — le DÉFAUT
   * de l'écran Semaine — n'a même pas de petit-déjeuner. Présenter ce total comme « la journée »
   * serait faux, et sur une application qui se donne des garde-fous TCA (§6.5 ARCHITECTURE),
   * annoncer à quelqu'un qu'il mange 830 kcal par jour quand on n'en sait rien est exactement le
   * genre d'affirmation à ne pas produire.
   */
  readonly kcal: number
  /**
   * Le plancher de §6.5 — un SEUIL DE VIGILANCE, jamais un apport de référence.
   *
   * ⚠️ 1 200 kcal n'est pas « ce qu'il faudrait manger » : c'est la limite sous laquelle une
   * alimentation devient risquée. La référence journalière d'une femme active de 30-49 ans tourne
   * autour de 2 000. Écrire « pour une référence de 1 200 kcal » — ce que l'écran a fait jusqu'au
   * 2026-08-04 — présentait un plancher de sécurité comme une cible, donc suggérait qu'atteindre
   * 1 200 suffisait.
   */
  readonly seuil: number
  /**
   * Combien de CRÉNEAUX remplis ont été additionnés pour obtenir `kcal`.
   *
   * Existe pour que l'appelant puisse dire « vos 2 repas prévus » au lieu de « votre journée ».
   * Compte des créneaux, pas des entrées : un déjeuner qui porte un plat ET son accompagnement
   * compte pour UN repas (voir `MealPlanEntry.service`).
   */
  readonly repasComptes: number
}

export interface WeekPlan {
  readonly id: string
  readonly startDate: string
  readonly days: number
  readonly seed: number
  readonly entries: readonly MealPlanEntry[]
  /**
   * Vide = rien à signaler. Non vide = le plan est utilisable MAIS l'appelant doit afficher
   * l'écran d'avertissement de §6.5 ARCHITECTURE avant de le présenter comme tel.
   */
  readonly warnings: readonly PlanWarning[]
}

export interface RerollOptions {
  readonly excludeRecipeIds?: readonly RecipeId[]
  readonly seed?: number
}

export interface ShoppingOptions {
  /** Scinde la liste : conservable d'un côté, frais à racheter en milieu de semaine (§7.4 ENGINE). */
  readonly joursDeCourses?: number
  /**
   * Aliments que l'utilisateur DÉCLARE avoir déjà — table `user_pantry`, « vider le frigo » (§4.3
   * ARCHITECTURE, v1). Retirés de la liste.
   *
   * ⚠️ FACULTATIF ET PONCTUEL, jamais un inventaire à tenir. L'appli ne demande rien : si le champ
   * reste vide, la liste est complète. C'est ce qui le distingue de la « gestion du garde-manger »
   * (v3), qui suppose un stock maintenu dans le temps.
   *
   * ⚠️ TOUT OU RIEN : l'aliment sort de la liste, il n'est pas décompté partiellement. `user_pantry`
   * porte une `quantite_approx`, mais « il me reste un peu de farine » ne permet pas de calculer
   * combien en racheter — prétendre le contraire ferait manquer l'ingrédient.
   */
  readonly pantryFoodIds?: readonly FoodId[]
  /** Réaffiche sel, poivre et épices, écartés par défaut (`Food.fondDePlacard`). */
  readonly inclureFondDePlacard?: boolean
  /**
   * Les sauces que l'utilisateur prend TOUJOURS avec un plat : plat → sauces (`user_recipe_sauce`,
   * v14). Leurs ingrédients entrent dans la liste chaque fois que le plat est prévu.
   *
   * ⚠️ CE N'EST PAS `Recipe.sauceIds`. Le catalogue PROPOSE des sauces, l'utilisateur en CHOISIT ;
   * seul le second achète. Lire `sauceIds` ici mettrait la sauce au poivre dans les courses de
   * quiconque prévoit un poulet rôti, sans que personne ne l'ait demandé.
   *
   * ⚠️ ABSENT = AUCUNE SAUCE, et non « toutes celles du catalogue ». Le moteur ne connaît pas
   * `user.db` : ce que l'appelant n'apporte pas n'existe pas ici.
   */
  readonly saucesParRecette?: ReadonlyMap<RecipeId, readonly RecipeId[]>
}

export interface ShoppingListItem {
  readonly foodId: FoodId
  readonly quantiteTotale: number
  readonly unite: string
  /**
   * Rayon de MAGASIN, dérivé de `Food.groupe` mais distinct de lui (§7.4 ENGINE) : « matières
   * grasses » réunit le beurre et l'huile d'olive, qui ne sont pas au même endroit.
   */
  readonly rayon: string
  /**
   * Virée de courses : 0 pour la première, 1 pour la suivante… Résulte de
   * `ShoppingOptions.joursDeCourses` (§7.4 : « ce qui se conserve d'un côté, le frais à racheter en
   * milieu de semaine de l'autre »). Toujours 0 quand l'option est absente.
   */
  readonly tranche: number
  /**
   * Les créneaux qui demandent cet aliment — sa PROVENANCE.
   *
   * ⚠️ SANS CE CHAMP, §2 ARCHITECTURE est inapplicable : il exige une liste « rangeable par rayon /
   * repas / jour », et l'agrégation détruit l'information de repas si on ne la conserve pas ici.
   * Le manque ne se voyait pas — la liste avait l'air complète.
   */
  readonly pourSlots: readonly SlotRef[]
  /**
   * Les sauces retenues qui demandent cet aliment. Vide dans l'écrasante majorité des cas.
   *
   * ⚠️ UNE PROVENANCE DE PLUS, PAS UN REMPLACEMENT DE `pourSlots`. Un même aliment peut venir à la
   * fois d'un plat et d'une sauce — l'échalote du bourguignon et celle de la sauce au poivre
   * s'additionnent dans la même ligne. L'écran doit pouvoir dire d'où sort la quantité, sinon une
   * ligne gonflée par une sauce passe pour une erreur de calcul.
   */
  readonly pourSauces: readonly RecipeId[]
}

export interface ShoppingList {
  readonly planId: string
  /** ISO — horloge injectée, jamais `Date.now()` dans engine/ (§3 ENGINE). */
  readonly generatedAt: string
  readonly items: readonly ShoppingListItem[]
}

export interface ScaledRecipe {
  readonly recipeId: RecipeId
  readonly portions: number
  readonly ingredients: readonly RecipeIngredient[]
}
