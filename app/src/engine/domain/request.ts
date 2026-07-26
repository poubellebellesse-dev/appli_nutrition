// engine/domain/request.ts
//
// Requête de suggestion (docs/ENGINE.md §8.1).

import type { AllergenId, FoodId, RecipeId, TopicId } from './ids.js'
import type { ArchetypeId } from './archetype-ids.js'
import type { DietCode, MealSlot } from './catalog.js'
import type { Minutes } from './units.js'
import type { UserProfile } from './profile.js'
import type { ScoreWeights } from './result.js'

/** §8.1 : « allergies · régime · exclusions ». Jamais pondérées, jamais contournables (§5.2 ARCHI). */
export interface HardConstraints {
  readonly allergies: readonly AllergenId[]
  readonly diet: DietCode | null
  readonly excludedFoodIds: readonly FoodId[]
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
  readonly seed: number
  /**
   * §6.6 ENGINE — poids de la pénalité de redondance en diversification MMR (`diversify`,
   * `engine/selection/diversify.ts`). Absent → `DEFAULT_MMR_LAMBDA` (0.4). Sans effet si
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
