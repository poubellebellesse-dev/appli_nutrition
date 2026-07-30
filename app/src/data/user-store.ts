// data/user-store.ts — pont `user.db` ↔ engine/domain (docs/ARCHITECTURE.md §4.3).
//
// Pendant exact de `catalog-loader.ts` pour la base UTILISATEUR : uniquement du mapping SQL ↔
// domaine, aucune logique de sélection, aucun calcul métier. La différence tient à un seul point —
// ici on écrit aussi, donc toute valeur variable passe par un paramètre lié, jamais par
// concaténation.
//
// ⚠️ CE FICHIER NE DOIT IMPORTER AUCUN MODULE NODE (voir l'en-tête de `user-db.ts`). C'est lui que
// le navigateur charge ; `user-store-node.ts` n'existe que pour les tests.
//
// PÉRIMÈTRE DES ACCESSEURS. `user-schema.ts` crée les ~23 tables de §4.3, mais ce fichier n'expose
// que celles dont on a besoin pour reconstruire une `SuggestionRequest`. La règle est simple et
// tenable : **toute table que le store LIT, il sait aussi l'ÉCRIRE** — une table en lecture seule
// perpétuelle est un champ qu'aucun écran ne peut remplir. Les autres (`user_signal`,
// `meal_plan`, `shopping_list`, `user_recipe`, `consent`, `user_display`…) attendent l'écran qui
// les consommera ; leurs tables existent déjà, il n'y aura pas de migration à faire pour elles.

import type {
  AllergenId,
  DietCode,
  FoodId,
  HardConstraints,
  MealHistory,
  MealHistoryEntry,
  MealOrigin,
  MealSlot,
  RecipeId,
  TopicId,
  UserProfile,
} from '../engine/domain/index.js'
import { withTransaction, type UserDb } from './user-db.js'

// --- Types de bordure -------------------------------------------------------------------------

/**
 * `severite` est du texte libre et RESTE NON LU par le moteur : `engine/selection/allergenes.ts`
 * exclut dès qu'un allergène est déclaré, traces comprises, sans gradation (§5.2 ARCHITECTURE :
 * « ce filtre n'est jamais pondéré ni contournable »). On la conserve parce que §4.3 la prévoit et
 * qu'un écran voudra l'afficher — pas parce qu'elle change une décision.
 */
export interface StoredAllergy {
  readonly allergenId: AllergenId
  readonly severite: string | null
}

export interface StoredPantryEntry {
  readonly foodId: FoodId
  /** Indicatif : le garde-manger est du tout-ou-rien côté courses (§7.4 ENGINE), jamais décompté. */
  readonly quantiteApprox: string | null
}

/** Fenêtre de lecture de l'historique. `today` est INJECTÉ — jamais `Date.now()` ici. */
export interface HistoryWindow {
  readonly windowDays: number
  /** ISO yyyy-mm-dd. */
  readonly today: string
}

/** Tout ce que `user.db` apporte à une `SuggestionRequest`. Le reste (créneau, date, graine) est UI. */
export interface StoredUserState {
  /** `null` = aucun profil saisi : premier lancement. */
  readonly profile: UserProfile | null
  readonly constraints: HardConstraints
  readonly preferences: ReadonlyMap<FoodId, number>
  readonly favoriteRecipeIds: ReadonlySet<RecipeId>
  readonly history: MealHistory
  readonly activeTopics: readonly TopicId[]
  readonly pantryFoodIds: readonly FoodId[]
}

// --- Profil -----------------------------------------------------------------------------------

interface ProfileRow {
  readonly tranche_age: string
  readonly sexe: string
  readonly taille_cm: number | null
  readonly poids_kg: number | null
  readonly niveau_activite: string
  readonly facteur_portion: number
}

/**
 * Le profil unique de l'appareil, ou `null` si rien n'a été saisi.
 *
 * Les `as` sur `tranche_age`, `sexe` et `niveau_activite` sont sûrs : ces trois colonnes portent un
 * CHECK qui n'admet QUE les valeurs des unions de `engine/domain/profile.ts`. Le vocabulaire est
 * gardé par la base, pas par une convention de lecture.
 */
export function readProfile(db: UserDb): UserProfile | null {
  const row = db.all<ProfileRow>(
    `SELECT tranche_age, sexe, taille_cm, poids_kg, niveau_activite, facteur_portion
     FROM user_profile WHERE id = 1`
  )[0]
  if (!row) return null
  return {
    trancheAge: row.tranche_age as UserProfile['trancheAge'],
    sexe: row.sexe as UserProfile['sexe'],
    tailleCm: row.taille_cm,
    poidsKg: row.poids_kg,
    niveauActivite: row.niveau_activite as UserProfile['niveauActivite'],
    facteurPortion: row.facteur_portion,
  }
}

/** Écrit LE profil (id = 1). Un second profil est refusé par la base, pas par ce code. */
export function writeProfile(db: UserDb, profile: UserProfile, creeLe: string): void {
  db.run(
    `INSERT OR REPLACE INTO user_profile
       (id, tranche_age, sexe, taille_cm, poids_kg, niveau_activite, facteur_portion, cree_le)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
    [
      profile.trancheAge,
      profile.sexe,
      profile.tailleCm,
      profile.poidsKg,
      profile.niveauActivite,
      profile.facteurPortion,
      creeLe,
    ]
  )
}

// --- Contraintes dures ------------------------------------------------------------------------

export function readAllergies(db: UserDb): readonly StoredAllergy[] {
  return db
    .all<{ readonly allergen_id: string; readonly severite: string | null }>(
      'SELECT allergen_id, severite FROM user_allergy ORDER BY allergen_id'
    )
    .map((row) => ({ allergenId: row.allergen_id as AllergenId, severite: row.severite }))
}

/**
 * REMPLACE la liste entière. Un `INSERT` incrémental laisserait en base une allergie décochée à
 * l'écran — l'utilisateur croirait l'avoir retirée alors que le filtre continue de l'appliquer.
 */
export function writeAllergies(db: UserDb, allergies: readonly StoredAllergy[]): void {
  withTransaction(db, () => {
    db.run('DELETE FROM user_allergy')
    for (const allergie of allergies) {
      db.run('INSERT INTO user_allergy (allergen_id, severite) VALUES (?, ?)', [
        allergie.allergenId,
        allergie.severite,
      ])
    }
  })
}

export function readDiet(db: UserDb): DietCode | null {
  return db.all<{ readonly code: string }>('SELECT code FROM user_diet WHERE id = 1')[0]?.code ?? null
}

/** `null` efface le régime — « je n'en suis plus » doit être exprimable, pas seulement « j'en change ». */
export function writeDiet(db: UserDb, diet: DietCode | null): void {
  if (diet === null) {
    db.run('DELETE FROM user_diet WHERE id = 1')
    return
  }
  db.run('INSERT OR REPLACE INTO user_diet (id, code) VALUES (1, ?)', [diet])
}

export function readExcludedFoodIds(db: UserDb): readonly FoodId[] {
  return db
    .all<{ readonly food_id: string }>('SELECT food_id FROM user_excluded_food ORDER BY food_id')
    .map((row) => row.food_id as FoodId)
}

/** Remplace la liste entière, même raison que `writeAllergies`. */
export function writeExcludedFoodIds(db: UserDb, foodIds: readonly FoodId[]): void {
  withTransaction(db, () => {
    db.run('DELETE FROM user_excluded_food')
    for (const foodId of foodIds) {
      db.run('INSERT INTO user_excluded_food (food_id) VALUES (?)', [foodId])
    }
  })
}

/** Les trois contraintes dures en une lecture. Vides = aucune contrainte, jamais `null`. */
export function readConstraints(db: UserDb): HardConstraints {
  return {
    allergies: readAllergies(db).map((a) => a.allergenId),
    diet: readDiet(db),
    excludedFoodIds: readExcludedFoodIds(db),
  }
}

// --- Goûts et favoris -------------------------------------------------------------------------

/**
 * Préférences par ALIMENT uniquement (`cible_type = 'food'`), échelle −2 … +2.
 *
 * ⚠️ Le filtre sur `cible_type` est essentiel : `SuggestionRequest.preferences` est typée
 * `ReadonlyMap<FoodId, number>`, et un `RecipeId` qui s'y glisserait ne lèverait rien — la couche
 * `preference` chercherait un aliment inexistant et noterait au neutre, en silence.
 */
export function readPreferences(db: UserDb): ReadonlyMap<FoodId, number> {
  const prefs = new Map<FoodId, number>()
  for (const row of db.all<{ readonly cible_id: string; readonly score: number }>(
    "SELECT cible_id, score FROM user_preference WHERE cible_type = 'food' ORDER BY cible_id"
  )) {
    prefs.set(row.cible_id as FoodId, row.score)
  }
  return prefs
}

/** `score` hors de −2 … +2 est refusé par la base (CHECK), pas ignoré. */
export function writePreference(db: UserDb, foodId: FoodId, score: number): void {
  db.run(
    `INSERT OR REPLACE INTO user_preference (cible_type, cible_id, score) VALUES ('food', ?, ?)`,
    [foodId, score]
  )
}

export function readFavorites(db: UserDb): ReadonlySet<RecipeId> {
  return new Set(
    db
      .all<{ readonly recipe_id: string }>('SELECT recipe_id FROM user_favorite ORDER BY recipe_id')
      .map((row) => row.recipe_id as RecipeId)
  )
}

export function setFavorite(db: UserDb, recipeId: RecipeId, favori: boolean, ajouteLe: string): void {
  if (!favori) {
    db.run('DELETE FROM user_favorite WHERE recipe_id = ?', [recipeId])
    return
  }
  db.run('INSERT OR REPLACE INTO user_favorite (recipe_id, ajoute_le) VALUES (?, ?)', [
    recipeId,
    ajouteLe,
  ])
}

// --- Thématiques et garde-manger ---------------------------------------------------------------

export function readActiveTopics(db: UserDb): readonly TopicId[] {
  return db
    .all<{ readonly topic_id: string }>('SELECT topic_id FROM user_active_topic ORDER BY topic_id')
    .map((row) => row.topic_id as TopicId)
}

/** Remplace la liste entière : une thématique est un réglage d'affichage RÉVOCABLE (§4.3, §5.3). */
export function writeActiveTopics(db: UserDb, topicIds: readonly TopicId[], activeLe: string): void {
  withTransaction(db, () => {
    db.run('DELETE FROM user_active_topic')
    for (const topicId of topicIds) {
      db.run('INSERT INTO user_active_topic (topic_id, active_le) VALUES (?, ?)', [topicId, activeLe])
    }
  })
}

export function readPantryFoodIds(db: UserDb): readonly FoodId[] {
  return db
    .all<{ readonly food_id: string }>('SELECT food_id FROM user_pantry ORDER BY food_id')
    .map((row) => row.food_id as FoodId)
}

/** Remplace le garde-manger entier — il s'efface à volonté, c'est un état ponctuel (§4.3). */
export function writePantry(db: UserDb, entries: readonly StoredPantryEntry[]): void {
  withTransaction(db, () => {
    db.run('DELETE FROM user_pantry')
    for (const entry of entries) {
      db.run('INSERT INTO user_pantry (food_id, quantite_approx) VALUES (?, ?)', [
        entry.foodId,
        entry.quantiteApprox,
      ])
    }
  })
}

// --- Historique -------------------------------------------------------------------------------

/** `dateIso` moins `jours` jours, en UTC pour ne pas dépendre du fuseau du navigateur. */
function soustraireJours(dateIso: string, jours: number): string {
  const date = new Date(`${dateIso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - jours)
  return date.toISOString().slice(0, 10)
}

/**
 * Historique borné à la fenêtre glissante, de la plus récente à la plus ancienne.
 *
 * ⚠️ C'EST ICI QUE `windowDays` EXISTE. Le champ est déclaré dans `MealHistory` mais AUCUNE couche
 * du moteur ne le lit : `habit` et `variety` consomment toutes les entrées qu'on leur passe. La
 * fenêtre de 21 jours glissants de §13 ENGINE n'est donc une réalité que si la lecture la borne —
 * sinon l'historique grossit indéfiniment et `habit` finit par figer les suggestions sur les plats
 * des premiers mois.
 *
 * Les entrées postérieures à `today` sont écartées : `variety` les ignore déjà de son côté, mais
 * `habit`, lui, les compterait.
 */
export function readHistory(db: UserDb, window: HistoryWindow): MealHistory {
  const debut = soustraireJours(window.today, window.windowDays)
  const entries = db
    .all<{
      readonly recipe_id: string
      readonly date: string
      readonly creneau: string
      readonly origine: string
    }>(
      `SELECT recipe_id, date, creneau, origine FROM meal_history
       WHERE date > ? AND date <= ?
       ORDER BY date DESC, creneau, recipe_id`,
      [debut, window.today]
    )
    .map((row) => ({
      recipeId: row.recipe_id as RecipeId,
      date: row.date,
      creneau: row.creneau as MealSlot,
      origine: row.origine as MealOrigin,
    }))
  return { windowDays: window.windowDays, entries }
}

/**
 * Enregistre qu'un plat a été RETENU sur un créneau.
 *
 * ⚠️ CE N'EST PAS UN JOURNAL ALIMENTAIRE (§6.5 ARCHITECTURE). Aucune quantité, aucune notion de
 * repas manqué, aucune relance : l'appel est toujours déclenché par un geste explicite de
 * l'utilisateur, et ne rien enregistrer n'a aucune conséquence.
 *
 * `origine` est portée telle quelle jusqu'au moteur : `choisi` alimente `habit` ET `variety`,
 * `reste` n'alimente que `variety`. Écrire un reste en `choisi` en ferait une préférence exprimée.
 */
export function recordMeal(db: UserDb, entry: MealHistoryEntry): void {
  db.run(
    `INSERT OR REPLACE INTO meal_history (date, creneau, recipe_id, origine) VALUES (?, ?, ?, ?)`,
    [entry.date, entry.creneau, entry.recipeId, entry.origine]
  )
}

// --- Lecture composée -------------------------------------------------------------------------

/**
 * Tout l'état utilisateur en une fois, prêt à être assemblé en `SuggestionRequest` par l'appelant.
 *
 * L'assemblage lui-même reste à l'UI : le créneau, la date, la graine et la limite ne sont pas des
 * données persistées, et les composer ici ferait entrer une notion d'écran dans `data/`.
 */
export function readUserState(db: UserDb, window: HistoryWindow): StoredUserState {
  return {
    profile: readProfile(db),
    constraints: readConstraints(db),
    preferences: readPreferences(db),
    favoriteRecipeIds: readFavorites(db),
    history: readHistory(db, window),
    activeTopics: readActiveTopics(db),
    pantryFoodIds: readPantryFoodIds(db),
  }
}
