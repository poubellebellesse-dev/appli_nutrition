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
  PiquantTolerance,
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
  /**
   * Date ISO à laquelle CET aliment a été déclaré. Absent = prendre le `declareLe` global de
   * `writePantry`.
   *
   * ⚠️ ELLE EXISTE PAR LIGNE, ET C'EST TOUT L'INTÉRÊT. `writePantry` réécrit le garde-manger entier
   * à chaque geste : sans date par ligne, ajouter du riz aujourd'hui redatait d'aujourd'hui la crème
   * déclarée il y a trois semaines — un geste qui ne la concernait pas la certifiait fraîche, et la
   * question de `confirmer-frigo.tsx` ne se posait plus jamais. `declare_le` doit dire QUAND
   * L'UTILISATEUR A RÉPONDU DE CET ALIMENT, pas quand la ligne a été écrite.
   */
  readonly declareLe?: string
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
  /**
   * Tolérance au piquant déclarée (décision 35). `null` = jamais déclarée.
   *
   * ⚠️ PORTÉE ICI PLUTÔT QUE LUE ÉCRAN PAR ÉCRAN, et c'est le point de la ligne. Trois écrans
   * construisent une requête pour le moteur ; un réglage lu séparément par chacun est un réglage
   * qu'un quatrième écran oubliera, sans qu'aucune erreur ne le dise. Un seul point de lecture,
   * un seul point d'oubli possible — et le champ requis sur `SuggestionRequest` ferme celui-là.
   */
  readonly tolerancePiquant: PiquantTolerance | null
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

/**
 * Le garde-manger AVEC la date de chaque ligne — `declareLe` absent quand elle est inconnue
 * (lignes d'avant la migration v8, `declare_le = ''`).
 *
 * ⚠️ À PRÉFÉRER À `readPantryFoodIds` DÈS QU'ON VA RÉÉCRIRE. `writePantry` remplace la table
 * entière : relire sans les dates puis réécrire les efface toutes, et redate d'aujourd'hui des
 * aliments que personne n'a reconfirmés.
 */
export function readPantryEntries(db: UserDb): readonly StoredPantryEntry[] {
  return db
    .all<{ readonly food_id: string; readonly quantite_approx: string | null; readonly declare_le: string }>(
      'SELECT food_id, quantite_approx, declare_le FROM user_pantry ORDER BY food_id'
    )
    .map((row) => ({
      foodId: row.food_id as FoodId,
      quantiteApprox: row.quantite_approx,
      ...(row.declare_le === '' ? {} : { declareLe: row.declare_le }),
    }))
}

/**
 * Date ISO de la dernière déclaration du garde-manger, ou `null`.
 *
 * ⚠️ `null` A DEUX CAUSES ET UNE SEULE LECTURE. Garde-manger vide (rien à dater) ou lignes d'avant
 * la migration v8 (`declare_le = ''`, date inconnue) : dans les deux cas l'appelant ne sait PAS
 * quand ça a été déclaré, et doit traiter la donnée comme non datée — jamais comme fraîche.
 * L'absence d'information n'est pas une information.
 *
 * ⚠️ LA PLUS ANCIENNE DES LIGNES, pas la plus récente. `writePantry` réécrit tout d'un coup, donc
 * elles partagent normalement la même date ; prendre le MIN garantit qu'une ligne rescapée d'une
 * base v7 ne se fasse pas blanchir par une ligne saisie ce matin.
 */
export function readPantryDeclareLe(db: UserDb): string | null {
  const lignes = db.all<{ readonly plus_ancienne: string | null }>(
    'SELECT MIN(declare_le) AS plus_ancienne FROM user_pantry'
  )
  const valeur = lignes[0]?.plus_ancienne ?? null
  return valeur === null || valeur === '' ? null : valeur
}

/**
 * Remplace le garde-manger entier — il s'efface à volonté, c'est un état ponctuel (§4.3).
 *
 * `declareLe` est la date ISO du jour, INJECTÉE : ce module ne lit jamais l'horloge (même règle que
 * le moteur, §3 ENGINE). Elle sert à dire depuis quand la déclaration tient — voir
 * `readPantryDeclareLe` et `ui/confirmer-frigo.tsx`.
 */
export function writePantry(
  db: UserDb,
  entries: readonly StoredPantryEntry[],
  declareLe: string
): void {
  withTransaction(db, () => {
    db.run('DELETE FROM user_pantry')
    for (const entry of entries) {
      db.run('INSERT INTO user_pantry (food_id, quantite_approx, declare_le) VALUES (?, ?, ?)', [
        entry.foodId,
        entry.quantiteApprox,
        entry.declareLe ?? declareLe,
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

/**
 * Ordre de SERVICE à l'intérieur d'un créneau — l'ordre français figé par `COURSE_ORDER` (domaine).
 *
 * ⚠️ INDISPENSABLE DEPUIS LE MODE REPAS (2026-08-04) : un créneau porte désormais jusqu'à deux
 * lignes (`plat` + `accompagnement`, voir `planning/plan-week.ts`). Sans ce second critère, SQL ne
 * garantit RIEN sur leur ordre relatif — en pratique le rowid, donc l'ordre d'insertion, mais rien
 * dans la norme ne l'exige et rien ne préviendrait le jour où il change. Un écran qui prend « la
 * première entrée du créneau » pour le plat afficherait alors l'accompagnement.
 *
 * `NULL` (mode recette, une seule ligne) passe en tête : c'est le cas où la question ne se pose pas.
 */
const ORDRE_SERVICE = `CASE service
    WHEN 'entree' THEN 1 WHEN 'plat' THEN 2 WHEN 'accompagnement' THEN 3
    WHEN 'fromage' THEN 4 WHEN 'dessert' THEN 5 ELSE 0 END`

/**
 * Écrit un plan et TOUS ses créneaux, en remplaçant intégralement la version précédente.
 *
 * `misAJourLe` est un horodatage ISO complet (pas seulement une date) INJECTÉ par l'appelant —
 * jamais lu ici via `Date.now()`. C'est lui, et lui seul, que `readLatestPlan` utilise pour
 * départager deux plans de MÊME `date_debut` (v7, voir `user-schema.ts`) : deux replanifications
 * le même jour doivent rester ordonnables.
 */
export function savePlan(db: UserDb, plan: WeekPlan, misAJourLe: string): void {
  withTransaction(db, () => {
    // ⚠️ UPSERT, PAS `INSERT OR REPLACE`, et la différence est destructrice. REPLACE SUPPRIME la
    // ligne existante avant de réinsérer — ce qui déclenche les `ON DELETE CASCADE` qui pointent
    // vers elle, donc emporte `shopping_list`, ses lignes ET les articles ajoutés à la main. Or
    // `savePlan` est appelé à chaque verrouillage de créneau : garder un plan aurait effacé la
    // liste de courses en silence. Trouvé par le test des articles « extra ».
    db.run(
      `INSERT INTO meal_plan (id, date_debut, jours, seed, mis_a_jour_le) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         date_debut = excluded.date_debut, jours = excluded.jours, seed = excluded.seed,
         mis_a_jour_le = excluded.mis_a_jour_le`,
      [plan.id, plan.startDate, plan.days, plan.seed, misAJourLe]
    )
    // Redondant avec le CASCADE que déclenche le REPLACE ci-dessus, mais seulement SI
    // `PRAGMA foreign_keys` est ON — ce que ce fichier ne peut pas garantir, l'ouverture
    // appartenant aux adaptateurs. Sans ce DELETE, un plan raccourci garderait ses vieux créneaux.
    db.run('DELETE FROM meal_plan_entry WHERE plan_id = ?', [plan.id])
    for (const entry of plan.entries) {
      db.run(
        `INSERT INTO meal_plan_entry
           (plan_id, date, creneau, service, recipe_id, portions, verrouille, est_reste,
            hors_catalogue)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          plan.id,
          entry.slot.date,
          entry.slot.creneau,
          entry.service,
          entry.recipeId,
          entry.portions,
          entry.locked ? 1 : 0,
          entry.isLeftover ? 1 : 0,
          entry.horsCatalogue,
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
      readonly hors_catalogue: string | null
    }>(
      `SELECT date, creneau, service, recipe_id, portions, verrouille, est_reste, hors_catalogue
       FROM meal_plan_entry WHERE plan_id = ?
       ORDER BY date, ${ORDRE_CRENEAU}, ${ORDRE_SERVICE}`,
      [planId]
    )
    .map(
      (e): MealPlanEntry => ({
        slot: { date: e.date, creneau: e.creneau as MealSlot },
        recipeId: (e.recipe_id as RecipeId | null) ?? null,
        horsCatalogue: e.hors_catalogue ?? null,
        portions: e.portions,
        locked: e.verrouille === 1,
        isLeftover: e.est_reste === 1,
        service: (e.service as CourseKind | null) ?? null,
      })
    )

  return { id: row.id, startDate: row.date_debut, days: row.jours, seed: row.seed, entries, warnings: [] }
}

/**
 * Le plan le plus récemment ÉCRIT, ou `null`. Même réserve sur `warnings` que `readPlan`.
 *
 * ⚠️ TRIE D'ABORD SUR `mis_a_jour_le`, PAS SUR `date_debut` (v7). `meal_plan.id` vaut
 * `plan-${startDate}-${days}` : replanifier la même date avec un nombre de jours différent crée
 * une SECONDE ligne de même `date_debut`, et l'id, comparé comme du texte, n'a aucun rapport avec
 * l'ordre d'écriture (« …-7 » > « …-3 »). `date_debut DESC` puis `id DESC` restent des
 * départages de repli, pour les lignes d'avant la migration dont `mis_a_jour_le` vaut `''`.
 */
export function readLatestPlan(db: UserDb): WeekPlan | null {
  const row = db.all<{ readonly id: string }>(
    'SELECT id FROM meal_plan ORDER BY mis_a_jour_le DESC, date_debut DESC, id DESC LIMIT 1'
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
  article: {
    readonly libelle: string
    readonly rayon?: string | null
    readonly quantite?: string | null
    readonly noteAllergene?: string | null
  }
): void {
  db.run(
    'INSERT INTO shopping_extra_item (list_id, libelle, rayon, quantite, note_allergene) VALUES (?, ?, ?, ?, ?)',
    [listId, article.libelle, article.rayon ?? null, article.quantite ?? null, article.noteAllergene ?? null]
  )
}

export function setExtraCoche(db: UserDb, id: number, coche: boolean): void {
  db.run('UPDATE shopping_extra_item SET coche = ? WHERE id = ?', [coche ? 1 : 0, id])
}

export function removeExtraItem(db: UserDb, id: number): void {
  db.run('DELETE FROM shopping_extra_item WHERE id = ?', [id])
}

// --- Rythme et consentement ---------------------------------------------------------------------

/**
 * Le rythme déclaré au premier lancement (§4.8 DESIGN, écran 5).
 *
 * ⚠️ CE N'EST PAS UN RÉGLAGE D'AFFICHAGE. Ces deux valeurs changent les SUGGESTIONS : le nombre de
 * repas fixe les créneaux planifiés, et le temps disponible alimente la couche `temps`, qui n'avait
 * jusqu'ici aucune source de données — le champ existait, personne ne le remplissait.
 *
 * `null` sur un temps = pas de limite. Zéro serait faux et empêcherait de distinguer « je n'ai pas
 * répondu » de « je suis très pressé ».
 */
export interface StoredRythme {
  readonly repasParJour: number
  readonly tempsSemaineMin: number | null
  readonly tempsWeekendMin: number | null
}

export function readRythme(db: UserDb): StoredRythme | null {
  const row = db.all<{
    readonly repas_par_jour: number
    readonly temps_semaine_min: number | null
    readonly temps_weekend_min: number | null
  }>('SELECT repas_par_jour, temps_semaine_min, temps_weekend_min FROM user_rythme WHERE id = 1')[0]
  if (!row) return null
  return {
    repasParJour: row.repas_par_jour,
    tempsSemaineMin: row.temps_semaine_min,
    tempsWeekendMin: row.temps_weekend_min,
  }
}

export function writeRythme(db: UserDb, rythme: StoredRythme): void {
  db.run(
    `INSERT OR REPLACE INTO user_rythme (id, repas_par_jour, temps_semaine_min, temps_weekend_min)
     VALUES (1, ?, ?, ?)`,
    [rythme.repasParJour, rythme.tempsSemaineMin, rythme.tempsWeekendMin]
  )
}

export interface StoredConsent {
  readonly versionTexte: string
  readonly accepteLe: string
}

/**
 * Consentements enregistrés, du plus récent au plus ancien.
 *
 * ⚠️ UNE LIGNE PAR VERSION, jamais un écrasement (§6.4 ARCHITECTURE) : accepter la v2 ne doit pas
 * effacer la trace de l'acceptation de la v1. C'est la seule façon de savoir ce que l'utilisateur a
 * réellement lu, et quand.
 */
export function readConsents(db: UserDb): readonly StoredConsent[] {
  return db
    .all<{ readonly version_texte: string; readonly accepte_le: string }>(
      'SELECT version_texte, accepte_le FROM consent ORDER BY accepte_le DESC, version_texte DESC'
    )
    .map((r) => ({ versionTexte: r.version_texte, accepteLe: r.accepte_le }))
}

export function aConsenti(db: UserDb, versionTexte: string): boolean {
  return (
    db.all<{ readonly n: number }>('SELECT COUNT(*) AS n FROM consent WHERE version_texte = ?', [
      versionTexte,
    ])[0]?.n === 1
  )
}

export function recordConsent(db: UserDb, versionTexte: string, accepteLe: string): void {
  db.run('INSERT OR REPLACE INTO consent (version_texte, accepte_le) VALUES (?, ?)', [
    versionTexte,
    accepteLe,
  ])
}

// --- Affichage ------------------------------------------------------------------------------------

/**
 * Réglages d'affichage (§4.3, `user_display`).
 *
 * ⚠️ `afficherMacros` est à `false` PAR DÉFAUT, et le défaut vit dans le schéma, pas ici. §6.5
 * ARCHITECTURE autorise « Cette portion : 520 kcal » mais proscrit le compteur de reste quotidien,
 * l'objectif présenté comme cible et le code couleur rouge/vert. C'est le MÉCANISME de restriction
 * qui est interdit, pas le chiffre — mais il reste opt-in, réservé au « mode avancé ».
 */
export interface StoredDisplay {
  readonly afficherMacros: boolean
  /** Balayage gauche/droite en plus des flèches (§3 DESIGN). Faux = flèches seules. */
  readonly gestesBalayage: boolean
  /** Alerte de semaine réduite à son marqueur. Ne la fait JAMAIS taire — voir la migration v4. */
  readonly alertesDiscretes: boolean
  /** Bandeau « le navigateur ne garantit pas de conserver » écarté. Lui SEUL est masquable (v5). */
  readonly bandeauStockageMasque: boolean
  /** Rappels de préparation. FAUX par défaut : une notification non demandée est une intrusion. */
  readonly rappelsActifs: boolean
  /** La visite guidée a-t-elle déjà été PROPOSÉE (acceptée ou refusée) ? On ne la propose qu'une fois. */
  readonly visiteProposee: boolean
}

export function readDisplay(db: UserDb): StoredDisplay {
  const row = db.all<{
    readonly afficher_macros: number
    readonly gestes_balayage: number
    readonly alertes_discretes: number
    readonly bandeau_stockage_masque: number
    readonly rappels_actifs: number
    readonly visite_proposee: number
  }>(
    `SELECT afficher_macros, gestes_balayage, alertes_discretes, bandeau_stockage_masque,
            rappels_actifs, visite_proposee
     FROM user_display WHERE id = 1`
  )[0]
  // Absent = jamais réglé = le défaut du schéma. Rendre `null` obligerait chaque appelant à traiter
  // le cas, et un oubli afficherait les macros à quelqu'un qui ne les a jamais demandées.
  return {
    afficherMacros: row?.afficher_macros === 1,
    gestesBalayage: row?.gestes_balayage === 1,
    alertesDiscretes: row?.alertes_discretes === 1,
    bandeauStockageMasque: row?.bandeau_stockage_masque === 1,
    rappelsActifs: row?.rappels_actifs === 1,
    visiteProposee: row?.visite_proposee === 1,
  }
}

/**
 * ⚠️ TOUTES LES COLONNES SONT ÉCRITES, y compris celles que l'appelant ne change pas. `INSERT OR
 * REPLACE` SUPPRIME la ligne avant de la réinsérer : une colonne omise ne « garde » pas sa valeur,
 * elle repart au DEFAULT du schéma. Régler le balayage aurait silencieusement rétabli les macros.
 */
export function writeDisplay(db: UserDb, display: StoredDisplay): void {
  db.run(
    `INSERT OR REPLACE INTO user_display
       (id, afficher_macros, gestes_balayage, alertes_discretes, bandeau_stockage_masque,
        rappels_actifs, visite_proposee)
     VALUES (1, ?, ?, ?, ?, ?, ?)`,
    [
      display.afficherMacros ? 1 : 0,
      display.gestesBalayage ? 1 : 0,
      display.alertesDiscretes ? 1 : 0,
      display.bandeauStockageMasque ? 1 : 0,
      display.rappelsActifs ? 1 : 0,
      display.visiteProposee ? 1 : 0,
    ]
  )
}

// --- Sauvegarde (app_meta) --------------------------------------------------------------------

/**
 * Date ISO du dernier export de sauvegarde, `null` si l'utilisateur n'en a jamais fait.
 *
 * ⚠️ `app_meta.dernier_export_le` ÉTAIT DÉCLARÉ AU SCHÉMA DEPUIS LA v1 ET ÉCRIT PAR PERSONNE.
 * La mesure 4 de §7 ARCHITECTURE — « invite à sauvegarder si `dernier_export_le` > 14 jours » —
 * reposait donc sur une colonne vide : le rappel ne pouvait pas se déclencher, et rien ne le disait.
 * C'est la classe de défaut que ce projet paie en boucle (`note_allergene`, `Recipe.service`,
 * `ratio`/`contexte`) ; elle est fermée ici en branchant l'écriture ET son lecteur dans le même lot.
 *
 * ⚠️ `null` n'est PAS « il y a longtemps ». Une base neuve n'a jamais été exportée parce qu'elle ne
 * contient rien à perdre ; réclamer une sauvegarde au premier lancement serait du bruit. C'est
 * `doitRappeler` (`ui/sauvegarde.ts`) qui tranche, pas cette lecture.
 */
export function readDernierExport(db: UserDb): string | null {
  const row = db.all<{ readonly dernier_export_le: string | null }>(
    'SELECT dernier_export_le FROM app_meta WHERE id = 1'
  )[0]
  return row?.dernier_export_le ?? null
}

/**
 * Note qu'une sauvegarde vient d'être produite.
 *
 * ⚠️ APPELÉE APRÈS COUP, jamais avant : le partage peut être annulé par l'utilisateur au niveau du
 * système, et dater un export qui n'a pas eu lieu ferait taire le rappel pendant 14 jours sur la foi
 * d'un fichier qui n'existe pas.
 */
export function writeDernierExport(db: UserDb, dateIso: string): void {
  db.run('UPDATE app_meta SET dernier_export_le = ? WHERE id = 1', [dateIso])
}

/**
 * Date de création du profil, `null` s'il n'y en a pas encore.
 *
 * ⚠️ SÉPARÉE DE `readProfile`, exprès. `UserProfile` est un type de `engine/domain` : y ajouter une
 * date de création ferait entrer une notion de stockage dans le domaine, que le moteur devrait alors
 * ignorer à la main. `user_profile.cree_le` est une donnée de BASE, elle se lit à part.
 *
 * ⚠️ C'est bien une date de CRÉATION et pas de dernière modification : `writeProfile` n'est appelée
 * qu'une fois, par `profilOuDefaut` (`ui/socle.ts`), et seulement quand aucun profil n'existe.
 */
export function readProfilCreeLe(db: UserDb): string | null {
  const row = db.all<{ readonly cree_le: string | null }>('SELECT cree_le FROM user_profile WHERE id = 1')[0]
  return row?.cree_le ?? null
}

/**
 * Tolérance au piquant déclarée (décision 35). `null` = jamais déclarée.
 *
 * ⚠️ SÉPARÉE DE `readProfile`, pour la même raison que `readProfilCreeLe` juste au-dessus :
 * `UserProfile` est un type de `engine/domain` et décrit une PHYSIOLOGIE. La tolérance est un goût ;
 * elle voyage sur `SuggestionRequest.tolerancePiquant`, à côté de `varietyMode`, pas dans le profil.
 *
 * ⚠️ UNE VALEUR INCONNUE EST TRAITÉE COMME `null`, jamais propagée telle quelle. Le `CHECK` de la
 * migration v12 ferme déjà le vocabulaire, mais une base restaurée depuis un `.nutri-backup` plus
 * ancien ou bricolée à la main peut porter autre chose : rendre une chaîne inconnue au moteur y
 * lèverait le seuil à `?? 4` sans que rien ne le dise.
 */
export function readTolerancePiquant(db: UserDb): PiquantTolerance | null {
  const row = db.all<{ readonly tolerance_piquant: string | null }>(
    'SELECT tolerance_piquant FROM user_profile WHERE id = 1'
  )[0]
  const brut = row?.tolerance_piquant ?? null
  return brut === 'aucun' || brut === 'un_peu' || brut === 'tout' ? brut : null
}

/** `null` efface la déclaration — « je préfère ne pas dire » doit rester atteignable. */
export function writeTolerancePiquant(db: UserDb, tolerance: PiquantTolerance | null): void {
  db.run('UPDATE user_profile SET tolerance_piquant = ? WHERE id = 1', [tolerance])
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
    tolerancePiquant: readTolerancePiquant(db),
  }
}

// --- Heures de repas (v6) -------------------------------------------------------------------------

/**
 * À quelle heure l'utilisateur mange, par créneau. Minutes depuis minuit.
 *
 * ⚠️ FACULTATIF, CRÉNEAU PAR CRÉNEAU. Un créneau absent de la table n'a pas d'heure déclarée — et
 * n'aura donc aucun rappel. C'est volontaire : personne ne doit avoir à déclarer l'heure de ses
 * quatre repas pour être prévenu de lancer son dîner.
 */
export type HeuresDeRepas = ReadonlyMap<MealSlot, number>

export function readMealTimes(db: UserDb): HeuresDeRepas {
  const heures = new Map<MealSlot, number>()
  for (const row of db.all<{ readonly creneau: string; readonly heure_min: number }>(
    'SELECT creneau, heure_min FROM user_meal_time'
  )) {
    heures.set(row.creneau as MealSlot, row.heure_min)
  }
  return heures
}

/**
 * Fixe ou efface l'heure d'un créneau. `null` efface — « je ne veux plus de rappel pour ce repas »
 * doit être exprimable, pas seulement « je change l'heure ».
 */
export function writeMealTime(db: UserDb, creneau: MealSlot, heureMin: number | null): void {
  if (heureMin === null) {
    db.run('DELETE FROM user_meal_time WHERE creneau = ?', [creneau])
    return
  }
  db.run('INSERT OR REPLACE INTO user_meal_time (creneau, heure_min) VALUES (?, ?)', [creneau, heureMin])
}

// --- Cuisson en cours (v10, mode cuisine §5bis) -------------------------------------------------

/**
 * Un minuteur en cours, tel qu'il survit à la fermeture de l'application.
 *
 * ⚠️ EXACTEMENT L'UN DES DEUX CHAMPS EST NON NUL, et la base le garantit (CHECK de la v10) :
 * `finMs` = en marche, avec son **échéance absolue** ; `pauseRestantS` = en pause, avec son reste
 * figé. Une pause est le seul cas où figer un reste est vrai, parce que c'est l'utilisateur qui a
 * arrêté le temps.
 */
export interface StoredCuisineTimer {
  readonly ordre: number
  readonly finMs: number | null
  readonly pauseRestantS: number | null
}

export interface StoredCuisineSession {
  readonly recetteId: string
  /** `ordre` de l'étape affichée — pas son rang, la valeur du champ. */
  readonly ordreCourant: number
  /** ms epoch. Sert à périmer une session oubliée ; voir `ui/cuisine-session.ts`. */
  readonly ouverteLe: number
  /**
   * Portions choisies pour CETTE cuisson (v11), ou `null` = aucun choix exprimé.
   *
   * ⚠️ `null` N'EST PAS UNE VALEUR PAR DÉFAUT DÉGUISÉE. C'est l'état d'une session ouverte avant la
   * v11, ou reprise par un lien qui ne portait rien. L'écran retombe alors sur le `portionsBase` de
   * la recette — que ce fichier ne connaît pas et n'a pas à connaître.
   */
  readonly portions: number | null
  readonly minuteurs: readonly StoredCuisineTimer[]
}

export function readCuisineSession(db: UserDb): StoredCuisineSession | null {
  const row = db.all<{
    readonly recette_id: string
    readonly ordre_courant: number
    readonly ouverte_le: number
    readonly portions: number | null
  }>('SELECT recette_id, ordre_courant, ouverte_le, portions FROM user_cuisine_session WHERE id = 1')[0]
  if (!row) return null

  const minuteurs = db
    .all<{
      readonly ordre: number
      readonly fin_ms: number | null
      readonly pause_restant_s: number | null
    }>('SELECT ordre, fin_ms, pause_restant_s FROM user_cuisine_timer WHERE session_id = 1 ORDER BY ordre')
    .map((t) => ({ ordre: t.ordre, finMs: t.fin_ms, pauseRestantS: t.pause_restant_s }))

  return {
    recetteId: row.recette_id,
    ordreCourant: row.ordre_courant,
    ouverteLe: row.ouverte_le,
    portions: row.portions,
    minuteurs,
  }
}

/**
 * Écrit la session et SES minuteurs, en remplaçant les précédents.
 *
 * ⚠️ `INSERT … ON CONFLICT DO UPDATE`, JAMAIS `INSERT OR REPLACE` — piège déjà payé
 * (`reference/PIEGES.md`) : `REPLACE` supprime la ligne avant de la réinsérer, ce qui déclencherait
 * le `ON DELETE CASCADE` et effacerait les minuteurs qu'on est en train d'enregistrer.
 *
 * Le `DELETE` des minuteurs est explicite plutôt que confié au CASCADE : ce fichier ne peut pas
 * garantir que `PRAGMA foreign_keys` est ON, l'ouverture appartenant aux adaptateurs. Même
 * précaution que `savePlan`.
 */
export function writeCuisineSession(db: UserDb, session: StoredCuisineSession): void {
  withTransaction(db, () => {
    db.run(
      `INSERT INTO user_cuisine_session (id, recette_id, ordre_courant, ouverte_le, portions)
       VALUES (1, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         recette_id = excluded.recette_id,
         ordre_courant = excluded.ordre_courant,
         ouverte_le = excluded.ouverte_le,
         portions = excluded.portions`,
      [session.recetteId, session.ordreCourant, session.ouverteLe, session.portions]
    )
    db.run('DELETE FROM user_cuisine_timer WHERE session_id = 1')
    for (const t of session.minuteurs) {
      db.run(
        'INSERT INTO user_cuisine_timer (session_id, ordre, fin_ms, pause_restant_s) VALUES (1, ?, ?, ?)',
        [t.ordre, t.finMs, t.pauseRestantS]
      )
    }
  })
}

/** Ferme la cuisson. Les minuteurs suivent, par CASCADE et par `DELETE` explicite. */
export function clearCuisineSession(db: UserDb): void {
  withTransaction(db, () => {
    db.run('DELETE FROM user_cuisine_timer WHERE session_id = 1')
    db.run('DELETE FROM user_cuisine_session WHERE id = 1')
  })
}
