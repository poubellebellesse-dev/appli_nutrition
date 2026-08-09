// engine/domain/request.ts
//
// Requête de suggestion (docs/ENGINE.md §8.1).

import type { AllergenId, EquipmentId, FoodId, RecipeId, TopicId } from './ids.js'
import type { ArchetypeId } from './archetype-ids.js'
import type { DietCode, MealSlot,
  NutrientVector,
} from './catalog.js'
import type { Minutes } from './units.js'
import type { UserProfile } from './profile.js'
import type { ScoreWeights } from './result.js'

/** §8.1 : « allergies · régime · exclusions ». Jamais pondérées, jamais contournables (§5.2 ARCHI). */
export interface HardConstraints {
  readonly allergies: readonly AllergenId[]
  readonly diet: DietCode | null
  readonly excludedFoodIds: readonly FoodId[]
  /**
   * Le matériel que l'utilisateur DÉCLARE posséder (table `user_equipment`). Lu par la couche
   * d'exclusion `equipement`, qui écarte une recette dont un équipement `requis` manque à l'appel.
   *
   * ⛔ TRI-ÉTAT, ET C'EST TOUT L'ENJEU. `null` = **jamais déclaré** → la couche est INERTE, rien
   * n'est exclu. `[]` = **déclaré vide**, l'utilisateur affirme ne rien posséder → les recettes à
   * `requis` tombent. Confondre les deux viderait le catalogue de ses 234 recettes à source de
   * chaleur pour tout utilisateur n'ayant jamais ouvert l'écran Paramètres — c'est-à-dire tout le
   * monde au premier lancement. Le précédent exact est `temps.ts` (`availableMin === null` → tout
   * est conservé) ; même parti que `PiquantTolerance` et que `Recipe.porteDejaUneSauce`.
   *
   * ⚠️ ICI ET PAS DANS `MealContext`, à l'inverse de `requiredFoodIds`. L'asymétrie est raisonnée :
   * `requiredFoodIds` est en contexte pour être structurellement inexprimable dans un plan de
   * semaine, parce qu'exiger un aliment précis sur 21 créneaux vide le panier. L'équipement est le
   * cas OPPOSÉ — on veut justement qu'un plan de semaine respecte le four qu'on n'a pas. Un
   * réglage durable, comme `excludedFoodIds` juste au-dessus.
   *
   * ⚠️ REQUIS, ET NON OPTIONNEL. Même raison que `tolerancePiquant` plus bas, et le même prix : le
   * compilateur désigne les sites de construction au lieu de les laisser omettre le champ en
   * silence. `user_equipment` existait déjà en base — créée, jamais lue, jamais écrite : la
   * cinquième occurrence en germe du piège « un champ déclaré n'est pas un champ branché ».
   */
  readonly ownedEquipmentIds: readonly EquipmentId[] | null
}

/** Envies exprimées sur les axes sensoriels (pastilles Léger/Chaud/Salé…, §6.5 ENGINE). */
export interface CravingAxes {
  readonly sucreSale: number | null
  readonly legerConsistant: number | null
  readonly chaudFroid: number | null
}

export interface MealContext {
  readonly creneau: MealSlot
  /** ISO yyyy-mm-dd — horloge injectée, jamais `Date.now()` dans engine/ (§3 ENGINE). */
  readonly date: string
  readonly tempsDisponibleMin: Minutes | null
  readonly envie: CravingAxes | null
  /** Mode « vider le frigo » (§10.2 ENGINE). */
  readonly pantryFoodIds: readonly FoodId[]
  /**
   * Filtre DUR « je veux ça » (§6.5 ter ENGINE) — lu par la couche `requis`, miroir dur
   * d'`excludedFoodIds`. Volontairement ICI et pas dans `HardConstraints`, alors même
   * qu'`excludedFoodIds` (son miroir) y est : la décision §6.5 ter est un filtre dur en contexte
   * *Aujourd'hui* SEULEMENT — exiger un aliment précis vide vite le panier de recettes, ce serait
   * dangereux en réglage permanent. `WeekPlanRequest` (domain/planning.ts) ne contient pas de
   * `MealContext` : placer le champ ici rend l'exigence STRUCTURELLEMENT inexprimable pour un plan
   * de semaine, plutôt que de compter sur la discipline de l'appelant. L'asymétrie avec
   * `excludedFoodIds` (réglage durable → `HardConstraints`) est VOLONTAIRE, pas un oubli.
   */
  readonly requiredFoodIds: readonly FoodId[]
}

/**
 * Origine d'une entrée d'historique (§6.5 ter ENGINE, §2.7 CONCEPTION_B_VIN_REPAS) : `choisi` = le
 * plat proposé a été retenu, `reste` = placement automatique d'un reste (§7.3 ENGINE). Champ
 * OBLIGATOIRE — voir habit.ts / variety.ts pour l'asymétrie de lecture qu'il permet.
 */
export type MealOrigin = 'choisi' | 'reste'

export interface MealHistoryEntry {
  readonly recipeId: RecipeId
  readonly date: string
  readonly creneau: MealSlot
  readonly origine: MealOrigin
}

/** N derniers jours, pour la couche `variety` — fenêtre de 21 jours glissants par défaut (§13 ENGINE). */
export interface MealHistory {
  readonly windowDays: number
  readonly entries: readonly MealHistoryEntry[]
}

/**
 * Override explicite de la couche `variety` (§8.1 ENGINE) — « Surprends-moi » / « Mes classiques ».
 * `auto` (défaut) laisse `variety` moduler par `habit` comme d'habitude ; les deux autres positions
 * forcent la modulation à ses bornes (voir `VarietyOverride`, selection/scoring/variety.ts).
 *
 * Déclaré ICI et pas dans selection/ : `SuggestionRequest` est en domain/ (L1) et ne peut pas
 * importer de selection/ (L3) — §2 ENGINE, SEL --> DOM. `varietyLayer.configure` fait la
 * conversion vers `VarietyOverride`, qui ne connaît pas la position `auto` (absence = `null`).
 */
export type VarietyMode = 'auto' | 'surprise' | 'classiques'

/**
 * Ce que l'utilisateur déclare supporter comme piquant (décision 35).
 *
 * ⚠️ `null` = JAMAIS DÉCLARÉ, et ce n'est PAS `'tout'`. Les deux se comportent pareil pour le
 * moteur — aucune pénalité — mais afficher « J'aime le piquant » à quelqu'un qui n'a rien dit lui
 * prêterait un choix qu'il n'a pas fait. Même règle que `Recipe.piquant`, dont l'absence ne vaut
 * jamais « doux ». C'est aussi ce qui rend la couche `piquant` inerte par défaut : son poids ne se
 * lève que si ce champ est renseigné (voir `PIQUANT_DYNAMIC_WEIGHT`, selection/scoring-pass.ts).
 *
 * ⚠️ ICI ET PAS DANS `UserProfile` : le profil décrit une physiologie (âge, taille, activité), le
 * piquant est un GOÛT. Le précédent est `varietyMode`, juste en dessous — même nature, même place.
 *
 * Trois positions, pas un nombre : « aucun » / « un peu » / « tout ». L'échelle 0→4 reste interne
 * au catalogue ; un chiffre à côté d'un plat se lirait comme une note (principe 6).
 */
export type PiquantTolerance = 'aucun' | 'un_peu' | 'tout'

export interface SuggestionRequest {
  readonly profile: UserProfile
  readonly constraints: HardConstraints
  readonly context: MealContext
  readonly history: MealHistory
  /**
   * Préférences utilisateur par aliment (couche `preference`, §6.5 ENGINE précision 4) — table
   * `user_preference` où `cible_type = 'food'` (docs/ARCHITECTURE.md §4.3). Échelle **−2 (déteste)
   * … +2 (adore)**, 0 = neutre. Champ OBLIGATOIRE : Map VIDE = aucune préférence connue, auquel
   * cas `preferenceLayer` rend `NEUTRAL_SCORE` pour tout candidat (voir
   * engine/selection/scoring/preference.ts) plutôt que de traiter l'absence comme un cas
   * particulier côté couche.
   */
  readonly preferences: ReadonlyMap<FoodId, number>
  /**
   * Recettes marquées en favori (table `user_favorite`, §4.3 ARCHITECTURE). Champ OBLIGATOIRE,
   * Set VIDE = aucun favori — même raison que `preferences` ci-dessus : `onlyFavorites` serait
   * sinon un flag SANS SOURCE DE DONNÉES, exactement le défaut corrigé en P1b-2 sur la couche
   * `preference`. Rendre le champ obligatoire fait porter l'oubli au compilateur plutôt qu'à un
   * `NoViableRecipeError` incompréhensible à l'exécution.
   *
   * Les favoris n'influencent le moteur QUE via `onlyFavorites` (décision figée : « marque-page
   * rapide, n'influence pas le moteur par défaut », §10.1 ENGINE) — aucune couche de score ne les
   * lit.
   */
  readonly favoriteRecipeIds: ReadonlySet<RecipeId>
  /**
   * §8.1 ENGINE — restreint les candidats aux seuls `favoriteRecipeIds`, **avant** la passe de
   * score : c'est une couche d'EXCLUSION (`favoris`, selection/favoris.ts), pas un filtre du
   * classement final. Défaut `false` (couche inerte, tout est conservé). Un Set vide combiné à
   * `true` ne conserve rien et lève `NoViableRecipeError` — comportement voulu, cohérent avec
   * `requis` : un filtre dur qui vide le panier le dit, il ne se désactive pas tout seul.
   */
  readonly onlyFavorites?: boolean
  /**
   * §8.1 ENGINE — override explicite de la couche `variety`. Absent → `'auto'`, aucun override
   * (`variety` reste modulée par `habit`). Voir `VarietyMode` ci-dessus.
   */
  readonly varietyMode?: VarietyMode
  /**
   * Tolérance au piquant déclarée par l'utilisateur (décision 35). `null` = jamais déclarée, la
   * couche `piquant` reste alors inerte — voir `PiquantTolerance`.
   *
   * ⚠️ REQUIS, ET NON OPTIONNEL COMME SES VOISINS. C'est délibéré et ça coûte : le compilateur
   * désigne les sites de construction au lieu de les laisser l'omettre en silence. Un champ
   * optionnel oublié ici produirait exactement le défaut signature du projet — le réglage serait
   * écrit en base, lu par les Paramètres, affiché à l'écran, et **n'atteindrait jamais le moteur**,
   * sans erreur ni au type, ni au test, ni à l'écran. Cinq occurrences déjà payées
   * (`note_allergene`, `Recipe.service`, `ratio`/`contexte`, `dernier_export_le`, `code_confiance`).
   */
  readonly tolerancePiquant: PiquantTolerance | null
  /** [] par défaut — tant qu'aucune thématique n'est active, `topic` reste à poids nul. */
  readonly activeTopics: readonly TopicId[]
  readonly weights?: Partial<ScoreWeights>
  /**
   * Archétype de pondération nommé (§6.3 bis ENGINE) — surcharge certaines couches de score, voir
   * `ARCHETYPE_WEIGHT_OVERRIDES` (engine/selection/archetypes.ts). Absent → `'equilibre'` (poids
   * de référence, aucune surcharge). Ordre de précédence résolu par `runScoringPass`
   * (scoring-pass.ts) : `defaultWeight` < archétype < bascule dynamique de `craving` < `weights`
   * explicite ci-dessus — un poids passé dans `weights` gagne toujours.
   */
  readonly archetype?: ArchetypeId
  /** défaut 5. */
  readonly limit?: number
  /** reproductibilité — PRNG à graine explicite, jamais `Math.random()` (§1 ENGINE). */
  /**
   * §7.1 ENGINE — CIBLE NUTRITIONNELLE IMPOSÉE pour ce créneau, en remplacement de la part fixe que
   * `nutriLayer` calcule sinon (`MEAL_SLOT_SHARE` × référence journalière, §6.5 précision 1).
   *
   * Le POINT D'INJECTION qui manquait au planning. §7.1 décrit un « état nutritionnel cumulé
   * réinjecté à chaque créneau » et §5.4 ARCHITECTURE une référence « RESTANTE » : sans ce champ,
   * `planWeek` ne pouvait pas les exprimer, chaque créneau visant la même part théorique quoi qu'il
   * ait déjà été placé dans la journée.
   *
   * ⚠️ CE QUE ÇA NE FAIT PAS. Ça ne rend pas l'énergie contraignante — `nutri` reste UNE couche de
   * score parmi d'autres, et son écart est moyenné sur les 9 nutriments : l'énergie pèse environ
   * `0,25 / 9 ≈ 2,8 %` de la note finale. Déplacer la cible déplace le classement à la marge, pas
   * l'arbitrage global. Ne pas confondre avec `assertCalorieFloor`, qui lui REFUSE un plan.
   *
   * Absent → comportement d'avant (part fixe du créneau). Aucune régression pour `suggestMeals`.
   */
  readonly nutrientTarget?: NutrientVector
  readonly seed: number
  /**
   * §6.6 ENGINE — poids de la pénalité de redondance en diversification MMR (`diversify`,
   * `engine/selection/diversify.ts`). Absent → `DEFAULT_MMR_LAMBDA` (0.3, calibré). Sans effet si
   * `skipDiversification` est vrai. Ajouté pour que `suggestMeals` (§8 ENGINE) puisse piloter le
   * banc CLI (`--lambda`) sans que l'appelant ait à rappeler `diversify` lui-même.
   */
  readonly mmrLambda?: number
  /**
   * §6.6 ENGINE — désactive la diversification MMR : `suggestMeals` retourne alors le classement
   * brut par score, tronqué à `limit`, plutôt que le résultat de `diversify`. Défaut `false`
   * (diversification active). Ajouté pour le même besoin que `mmrLambda` (banc CLI `--no-mmr`).
   */
  readonly skipDiversification?: boolean
}
