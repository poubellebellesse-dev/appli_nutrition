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
// que celles qu'un écran consomme réellement. La règle est simple et tenable : **toute table que le
// store LIT, il sait aussi l'ÉCRIRE** — une table en lecture seule perpétuelle est un champ
// qu'aucun écran ne peut remplir. Couvertes à ce jour : profil, contraintes, goûts, favoris,
// thématiques, garde-manger, historique, planning, courses. Les autres (`user_signal`,
// `user_recipe`, `user_recipe_note`, `consent`, `user_display`, `user_price`) attendent leur écran ;
// leurs tables existent déjà, il n'y aura pas de migration à faire pour les brancher.

import type {
  AllergenId,
  CourseKind,
  DietCode,
  FoodId,
  HardConstraints,
  MealHistory,
  MealHistoryEntry,
  MealOrigin,
  MealPlanEntry,
  MealSlot,
  RecipeId,
  TopicId,
  ShoppingList,
  UserProfile,
  WeekPlan,
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

// --- Planning ---------------------------------------------------------------------------------

/**
 * Ordre chronologique DANS la journée. `creneau` est du texte : trier dessus rendrait « dejeuner »
 * avant « petit_dejeuner ». L'ordre alphabétique n'a aucun sens ici, et l'écran Semaine affiche les
 * créneaux de haut en bas dans l'ordre des repas.
 */
const ORDRE_CRENEAU = `CASE creneau
    WHEN 'petit_dejeuner' THEN 0 WHEN 'dejeuner' THEN 1 WHEN 'gouter' THEN 2 ELSE 3 END`

/** Écrit un plan et TOUS ses créneaux, en remplaçant intégralement la version précédente. */
export function savePlan(db: UserDb, plan: WeekPlan): void {
  withTransaction(db, () => {
    // ⚠️ UPSERT, PAS `INSERT OR REPLACE`, et la différence est destructrice. REPLACE SUPPRIME la
    // ligne existante avant de réinsérer — ce qui déclenche les `ON DELETE CASCADE` qui pointent
    // vers elle, donc emporte `shopping_list`, ses lignes ET les articles ajoutés à la main. Or
    // `savePlan` est appelé à chaque verrouillage de créneau : garder un plan aurait effacé la
    // liste de courses en silence. Trouvé par le test des articles « extra ».
    db.run(
      `INSERT INTO meal_plan (id, date_debut, jours, seed) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         date_debut = excluded.date_debut, jours = excluded.jours, seed = excluded.seed`,
      [plan.id, plan.startDate, plan.days, plan.seed]
    )
    // Redondant avec le CASCADE que déclenche le REPLACE ci-dessus, mais seulement SI
    // `PRAGMA foreign_keys` est ON — ce que ce fichier ne peut pas garantir, l'ouverture
    // appartenant aux adaptateurs. Sans ce DELETE, un plan raccourci garderait ses vieux créneaux.
    db.run('DELETE FROM meal_plan_entry WHERE plan_id = ?', [plan.id])
    for (const entry of plan.entries) {
      db.run(
        `INSERT INTO meal_plan_entry
           (plan_id, date, creneau, service, recipe_id, portions, verrouille, est_reste)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          plan.id,
          entry.slot.date,
          entry.slot.creneau,
          entry.service,
          entry.recipeId,
          entry.portions,
          entry.locked ? 1 : 0,
          entry.isLeftover ? 1 : 0,
        ]
      )
    }
  })
}

/**
 * Relit un plan. `null` si l'identifiant est inconnu, ou si la ligne date d'avant la migration v2
 * (`jours = 0`) — un plan sans durée n'est pas affichable, mieux vaut le dire que d'afficher zéro
 * jour.
 *
 * ⚠️ `warnings` REVIENT TOUJOURS VIDE, et ce n'est pas un oubli. Un avertissement de plancher
 * calorique (§6.5) se DÉDUIT du plan et du profil ; le stocker le figerait, et il continuerait de
 * s'afficher — ou pire, de ne pas s'afficher — après un changement de profil. L'appelant DOIT
 * rappeler `engine.checkPlan(plan, profile)` après lecture. C'est la seule façon pour un plan relu
 * depuis le disque de ne pas perdre silencieusement une alerte de sécurité.
 */
export function readPlan(db: UserDb, planId: string): WeekPlan | null {
  const row = db.all<{
    readonly id: string
    readonly date_debut: string
    readonly jours: number
    readonly seed: number
  }>('SELECT id, date_debut, jours, seed FROM meal_plan WHERE id = ?', [planId])[0]
  if (!row || row.jours <= 0) return null

  const entries = db
    .all<{
      readonly date: string
      readonly creneau: string
      readonly service: string | null
      readonly recipe_id: string | null
      readonly portions: number
      readonly verrouille: number
      readonly est_reste: number
    }>(
      `SELECT date, creneau, service, recipe_id, portions, verrouille, est_reste
       FROM meal_plan_entry WHERE plan_id = ?
       ORDER BY date, ${ORDRE_CRENEAU}`,
      [planId]
    )
    .map(
      (e): MealPlanEntry => ({
        slot: { date: e.date, creneau: e.creneau as MealSlot },
        recipeId: (e.recipe_id as RecipeId | null) ?? null,
        portions: e.portions,
        locked: e.verrouille === 1,
        isLeftover: e.est_reste === 1,
        service: (e.service as CourseKind | null) ?? null,
      })
    )

  return { id: row.id, startDate: row.date_debut, days: row.jours, seed: row.seed, entries, warnings: [] }
}

/** Le plan le plus récent par date de début, ou `null`. Même réserve sur `warnings` que `readPlan`. */
export function readLatestPlan(db: UserDb): WeekPlan | null {
  const row = db.all<{ readonly id: string }>(
    'SELECT id FROM meal_plan ORDER BY date_debut DESC, id DESC LIMIT 1'
  )[0]
  return row ? readPlan(db, row.id) : null
}

// --- Courses ----------------------------------------------------------------------------------

/**
 * Un article NON ALIMENTAIRE de la liste (§4.3) — lessive, croquettes, dentifrice.
 *
 * ⚠️ TABLE SÉPARÉE DE TOUT CE QUI TOUCHE `food`, et ce n'est pas de la propreté de schéma : ces
 * articles n'ont aucun nutriment, aucun allergène structuré, et ne sont JAMAIS éligibles comme
 * ingrédient de recette. `noteAllergene` est du texte libre INFORMATIF (« contient : arachide ») —
 * le système des 14 allergènes UE reste réservé à ce qu'on mange.
 */
export interface StoredExtraItem {
  readonly id: number
  readonly libelle: string
  readonly rayon: string | null
  readonly quantite: string | null
  readonly coche: boolean
  readonly noteAllergene: string | null
}

/**
 * Ce que `user.db` garde d'une liste de courses.
 *
 * ⚠️ LES LIGNES ELLES-MÊMES NE SONT PAS LA SOURCE DE VÉRITÉ. Quantités, unités, rayons, provenance
 * par créneau : tout se redérive du plan par `buildShoppingList`, et le redériver garantit que la
 * liste correspond au plan RÉEL. Le seul état irrécupérable est **ce que l'utilisateur a coché** —
 * aucun calcul ne peut le retrouver. C'est lui que cette structure existe pour porter, avec les
 * articles ajoutés à la main.
 */
export interface StoredShoppingList {
  readonly id: string
  readonly planId: string
  readonly generatedAt: string
  readonly coches: ReadonlySet<FoodId>
  readonly extras: readonly StoredExtraItem[]
}

/** Une liste par plan. Déterministe : pas d'identifiant tiré au hasard (§1 ENGINE). */
function idDeListe(planId: string): string {
  return `courses-${planId}`
}

/**
 * Enregistre la liste, en CONSERVANT les cases déjà cochées dont l'aliment survit.
 *
 * ⚠️ C'est le comportement attendu d'une régénération : ajouter un dîner à la semaine ne doit pas
 * effacer les vingt lignes déjà cochées au supermarché. Un aliment qui disparaît du plan perd son
 * cochage, ce qui est correct — il n'est plus à acheter.
 */
export function saveShoppingList(db: UserDb, list: ShoppingList): void {
  const id = idDeListe(list.planId)
  withTransaction(db, () => {
    const dejaCoches = new Set(
      db
        .all<{ readonly food_id: string }>(
          'SELECT food_id FROM shopping_list_item WHERE list_id = ? AND coche = 1',
          [id]
        )
        .map((r) => r.food_id)
    )

    // Upsert pour la même raison que `savePlan` : un REPLACE emporterait les articles ajoutés à la
    // main par la cascade, à chaque régénération.
    db.run(
      `INSERT INTO shopping_list (id, plan_id, genere_le) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET plan_id = excluded.plan_id, genere_le = excluded.genere_le`,
      [id, list.planId, list.generatedAt]
    )
    // Les articles « extra » ne sont PAS effacés : ils ne viennent pas du plan, les régénérer
    // n'aurait pas de sens, et les perdre à chaque replanification serait une trahison.
    db.run('DELETE FROM shopping_list_item WHERE list_id = ?', [id])
    for (const item of list.items) {
      db.run(
        `INSERT INTO shopping_list_item (list_id, food_id, quantite_totale, unite, coche)
         VALUES (?, ?, ?, ?, ?)`,
        [id, item.foodId, item.quantiteTotale, item.unite, dejaCoches.has(item.foodId) ? 1 : 0]
      )
    }
  })
}

/** La liste la plus récente, ou `null`. */
export function readShoppingList(db: UserDb): StoredShoppingList | null {
  const row = db.all<{ readonly id: string; readonly plan_id: string; readonly genere_le: string }>(
    'SELECT id, plan_id, genere_le FROM shopping_list ORDER BY genere_le DESC, id DESC LIMIT 1'
  )[0]
  if (!row) return null

  const coches = new Set(
    db
      .all<{ readonly food_id: string }>(
        'SELECT food_id FROM shopping_list_item WHERE list_id = ? AND coche = 1',
        [row.id]
      )
      .map((r) => r.food_id as FoodId)
  )

  return { id: row.id, planId: row.plan_id, generatedAt: row.genere_le, coches, extras: readExtraItems(db, row.id) }
}

export function setCoche(db: UserDb, listId: string, foodId: FoodId, coche: boolean): void {
  db.run('UPDATE shopping_list_item SET coche = ? WHERE list_id = ? AND food_id = ?', [
    coche ? 1 : 0,
    listId,
    foodId,
  ])
}

export function readExtraItems(db: UserDb, listId: string): readonly StoredExtraItem[] {
  return db
    .all<{
      readonly id: number
      readonly libelle: string
      readonly rayon: string | null
      readonly quantite: string | null
      readonly coche: number
      readonly note_allergene: string | null
    }>(
      `SELECT id, libelle, rayon, quantite, coche, note_allergene
       FROM shopping_extra_item WHERE list_id = ? ORDER BY id`,
      [listId]
    )
    .map((r) => ({
      id: r.id,
      libelle: r.libelle,
      rayon: r.rayon,
      quantite: r.quantite,
      coche: r.coche === 1,
      noteAllergene: r.note_allergene,
    }))
}

export function addExtraItem(
  db: UserDb,
  listId: string,
  article: { readonly libelle: string; readonly rayon?: string | null; readonly quantite?: string | null }
): void {
  db.run('INSERT INTO shopping_extra_item (list_id, libelle, rayon, quantite) VALUES (?, ?, ?, ?)', [
    listId,
    article.libelle,
    article.rayon ?? null,
    article.quantite ?? null,
  ])
}

export function setExtraCoche(db: UserDb, id: number, coche: boolean): void {
  db.run('UPDATE shopping_extra_item SET coche = ? WHERE id = ?', [coche ? 1 : 0, id])
}

export function removeExtraItem(db: UserDb, id: number): void {
  db.run('DELETE FROM shopping_extra_item WHERE id = ?', [id])
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
