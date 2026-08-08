// data/user-store.test.ts
//
// Preuve que `user.db` conserve ce qu'on lui confie et le rend sous les types de `engine/domain`.
// Tourne sur une base `:memory:` via `user-store-node.ts` — le mapping testé est celui, mot pour
// mot, que le navigateur exécutera via `ui/user-source.ts`.
//
// Trois familles d'assertions, dans cet ordre d'importance :
//   1. Les MIGRATIONS — un fichier `user.db` ne se re-télécharge pas (§4.1 ARCHITECTURE), une
//      migration qui abîme la base est une perte définitive.
//   2. Les GARANTIES STRUCTURELLES du schéma (profil unique, créneau unique en mode recette,
//      bornes des scores) : ce sont des CHECK et des index, pas de la discipline d'appelant.
//   3. Les ALLERS-RETOURS de chaque table lue par le store.

import { beforeEach, describe, expect, it } from 'vitest'
import type {
  AllergenId,
  FoodId,
  MealHistoryEntry,
  RecipeId,
  TopicId,
  UserProfile,
  WeekPlan,
  MealSlot,
  ShoppingList,
} from '../engine/domain/index.js'
import { DatabaseSync } from 'node:sqlite'
import { openUserDb, type OpenedUserDb } from './user-store-node.js'
import type { UserDb } from './user-db.js'
import { MIGRATIONS, USER_SCHEMA_VERSION, migrate, readSchemaVersion } from './user-schema.js'
import {
  aConsenti,
  clearCuisineSession,
  readCuisineSession,
  writeCuisineSession,
  readActiveTopics,
  readAllergies,
  readConstraints,
  readDiet,
  readDisplay,
  readExcludedFoodIds,
  readFavorites,
  readHistory,
  readPantryDeclareLe,
  readPantryEntries,
  readPantryFoodIds,
  readPreferences,
  readProfile,
  addExtraItem,
  readExtraItems,
  readConsents,
  readLatestPlan,
  readPlan,
  readRythme,
  readShoppingList,
  readUserState,
  removeExtraItem,
  recordConsent,
  savePlan,
  saveShoppingList,
  setCoche,
  setExtraCoche,
  recordMeal,
  setFavorite,
  writeActiveTopics,
  writeAllergies,
  writeDiet,
  writeDisplay,
  writeExcludedFoodIds,
  writePantry,
  writePreference,
  writeProfile,
  writeRythme,
} from './user-store.js'

const PROFIL: UserProfile = {
  trancheAge: '30_49',
  sexe: 'NP',
  tailleCm: 175,
  poidsKg: 70,
  niveauActivite: 'actif',
  facteurPortion: 1,
}

const AUJOURDHUI = '2026-07-30'

let ouverte: OpenedUserDb
let db: UserDb

beforeEach(() => {
  ouverte = openUserDb(':memory:')
  db = ouverte.db
})

describe('user-schema — migrations', () => {
  it('amène une base neuve à USER_SCHEMA_VERSION', () => {
    // openUserDb a déjà migré.
    expect(readSchemaVersion(db)).toBe(USER_SCHEMA_VERSION)
  })

  it('est idempotente — rejouer migrate() ne casse rien et ne recrée rien', () => {
    expect(() => migrate(db)).not.toThrow()
    expect(() => migrate(db)).not.toThrow()
    expect(readSchemaVersion(db)).toBe(USER_SCHEMA_VERSION)
  })

  it('déclare autant de migrations que de versions, sans trou ni doublon', () => {
    // Une version manquante ferait rejouer la mauvaise migration sur une base réelle.
    const versions = MIGRATIONS.map((m) => m.version)
    expect(versions).toEqual([...versions].sort((a, b) => a - b))
    expect(new Set(versions).size).toBe(versions.length)
    expect(Math.max(...versions)).toBe(USER_SCHEMA_VERSION)
  })

  it('crée toutes les tables de §4.3 ARCHITECTURE, y compris celles sans consommateur', () => {
    // Décision : le schéma complet dès la v1, tant que la base est vide (RECAP_SESSION_3 §4).
    const tables = new Set(
      db
        .all<{ readonly name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
        .map((r) => r.name)
    )
    for (const attendue of [
      'app_meta',
      'consent',
      'meal_history',
      'meal_plan',
      'meal_plan_entry',
      'shopping_extra_item',
      'shopping_list',
      'shopping_list_item',
      'user_active_topic',
      'user_allergy',
      'user_diet',
      'user_display',
      'user_display_occasion',
      'user_equipment',
      'user_excluded_food',
      'user_favorite',
      'user_pantry',
      'user_preference',
      'user_price',
      'user_profile',
      'user_recipe',
      'user_recipe_note',
      'user_signal',
    ]) {
      expect(tables.has(attendue), `table manquante : ${attendue}`).toBe(true)
    }
  })

  it("n'expose AUCUNE colonne de quantité mangée — §6.5, signal de préférence ≠ journal", () => {
    // Le jour où une de ces tables porte une quantité, l'appli est devenue un tracker.
    for (const table of ['user_signal', 'meal_history']) {
      const colonnes = db
        .all<{ readonly name: string }>(`PRAGMA table_info(${table})`)
        .map((c) => c.name)
      expect(colonnes.some((c) => /quantite|portion|calor|kcal/i.test(c))).toBe(false)
    }
  })

  it('v6 → v7 : préserve les données existantes et ajoute les colonnes avec leur défaut', () => {
    // Base bloquée à v6, avec des données réelles — exactement ce qu'une machine de production
    // rapporterait avant la mise à jour.
    const sqlite = new DatabaseSync(':memory:')
    const brute: UserDb = {
      all: <T,>(sql: string, params: readonly (string | number | null)[] = []) =>
        sqlite.prepare(sql).all(...params) as unknown as readonly T[],
      run: (sql: string, params: readonly (string | number | null)[] = []) => {
        sqlite.prepare(sql).run(...params)
      },
    }
    for (const migration of MIGRATIONS.filter((m) => m.version <= 6)) {
      readSchemaVersion(brute) // bootstrappe app_meta au premier appel
      for (const sql of migration.statements) brute.run(sql)
      brute.run('UPDATE app_meta SET schema_version = ? WHERE id = 1', [migration.version])
    }
    expect(readSchemaVersion(brute)).toBe(6)

    brute.run(`INSERT INTO meal_plan (id, date_debut, jours, seed) VALUES ('p', '2026-08-03', 3, 1)`)
    brute.run(`INSERT INTO user_display (id, afficher_macros) VALUES (1, 1)`)

    expect(() => migrate(brute)).not.toThrow()
    expect(readSchemaVersion(brute)).toBe(USER_SCHEMA_VERSION)

    const plan = brute.all<{ readonly date_debut: string; readonly mis_a_jour_le: string }>(
      "SELECT date_debut, mis_a_jour_le FROM meal_plan WHERE id = 'p'"
    )[0]
    expect(plan?.date_debut).toBe('2026-08-03')
    expect(plan?.mis_a_jour_le).toBe('')

    const display = brute.all<{ readonly afficher_macros: number; readonly visite_proposee: number }>(
      'SELECT afficher_macros, visite_proposee FROM user_display WHERE id = 1'
    )[0]
    expect(display?.afficher_macros).toBe(1)
    expect(display?.visite_proposee).toBe(0)
  })
})

describe('user-store — garanties structurelles du schéma', () => {
  it('refuse un second profil : le profil est unique PAR CONSTRUCTION', () => {
    writeProfile(db, PROFIL, AUJOURDHUI)
    expect(() =>
      db.run(
        `INSERT INTO user_profile (id, tranche_age, sexe, niveau_activite, facteur_portion, cree_le)
         VALUES (2, '18_29', 'F', 'actif', 1, ?)`,
        [AUJOURDHUI]
      )
    ).toThrow()
  })

  it('refuse deux plats sur le même créneau en mode recette (service NULL)', () => {
    // ⚠️ Le piège que l'index COALESCE corrige : une PRIMARY KEY contenant `service` aurait laissé
    // passer ce doublon, deux NULL n'étant jamais égaux pour SQLite.
    db.run(`INSERT INTO meal_plan (id, date_debut) VALUES ('p1', ?)`, [AUJOURDHUI])
    const inserer = () =>
      db.run(
        `INSERT INTO meal_plan_entry (plan_id, date, creneau, service, recipe_id, portions)
         VALUES ('p1', ?, 'diner', NULL, 'r1', 1)`,
        [AUJOURDHUI]
      )
    inserer()
    expect(inserer).toThrow()
  })

  it('accepte en revanche plusieurs services sur le même créneau (mode repas)', () => {
    db.run(`INSERT INTO meal_plan (id, date_debut) VALUES ('p1', ?)`, [AUJOURDHUI])
    for (const service of ['entree', 'plat', 'dessert']) {
      db.run(
        `INSERT INTO meal_plan_entry (plan_id, date, creneau, service, recipe_id, portions)
         VALUES ('p1', ?, 'diner', ?, 'r1', 1)`,
        [AUJOURDHUI, service]
      )
    }
    const lignes = db.all<{ readonly n: number }>('SELECT COUNT(*) AS n FROM meal_plan_entry')
    expect(lignes[0]?.n).toBe(3)
  })

  it('borne les préférences à −2 … +2', () => {
    expect(() => writePreference(db, 'poulet' as FoodId, 3)).toThrow()
    expect(() => writePreference(db, 'poulet' as FoodId, -3)).toThrow()
    expect(() => writePreference(db, 'poulet' as FoodId, 2)).not.toThrow()
  })

  it('borne le facteur de portion à 0,7 … 1,5', () => {
    expect(() => writeProfile(db, { ...PROFIL, facteurPortion: 2 }, AUJOURDHUI)).toThrow()
  })
})

describe('user-store — profil', () => {
  it('rend null tant que rien n’a été saisi', () => {
    expect(readProfile(db)).toBeNull()
  })

  it('fait l’aller-retour sans rien perdre, taille et poids compris', () => {
    writeProfile(db, PROFIL, AUJOURDHUI)
    expect(readProfile(db)).toEqual(PROFIL)
  })

  it('conserve les null de taille et de poids — facultatifs, pas des zéros', () => {
    const sansGabarit: UserProfile = { ...PROFIL, tailleCm: null, poidsKg: null }
    writeProfile(db, sansGabarit, AUJOURDHUI)
    expect(readProfile(db)).toEqual(sansGabarit)
  })

  it('remplace le profil au lieu d’en accumuler', () => {
    writeProfile(db, PROFIL, AUJOURDHUI)
    writeProfile(db, { ...PROFIL, sexe: 'F', niveauActivite: 'sedentaire' }, AUJOURDHUI)
    expect(readProfile(db)?.sexe).toBe('F')
    expect(readProfile(db)?.niveauActivite).toBe('sedentaire')
  })
})

describe('user-store — contraintes dures', () => {
  it('rend des contraintes vides sur une base neuve, jamais null', () => {
    // Un `HardConstraints` absent obligerait chaque appelant à gérer le cas ; vide est le neutre.
    expect(readConstraints(db)).toEqual({ allergies: [], diet: null, excludedFoodIds: [] })
  })

  it('fait l’aller-retour sur les allergènes, sévérité comprise', () => {
    writeAllergies(db, [
      { allergenId: 'gluten' as AllergenId, severite: 'allergie' },
      { allergenId: 'lait' as AllergenId, severite: null },
    ])
    expect(readAllergies(db)).toEqual([
      { allergenId: 'gluten', severite: 'allergie' },
      { allergenId: 'lait', severite: null },
    ])
    expect(readConstraints(db).allergies).toEqual(['gluten', 'lait'])
  })

  it('REMPLACE la liste d’allergènes au lieu de l’enrichir', () => {
    // Une allergie retirée de l'écran doit disparaître de la base, sinon on filtre pour rien —
    // et pire, l'utilisateur croit l'avoir retirée.
    writeAllergies(db, [{ allergenId: 'gluten' as AllergenId, severite: null }])
    writeAllergies(db, [{ allergenId: 'lait' as AllergenId, severite: null }])
    expect(readConstraints(db).allergies).toEqual(['lait'])
  })

  it('fait l’aller-retour sur le régime et sait l’effacer', () => {
    writeDiet(db, 'vegetarien')
    expect(readDiet(db)).toBe('vegetarien')
    writeDiet(db, 'vegetalien')
    expect(readDiet(db)).toBe('vegetalien')
    writeDiet(db, null)
    expect(readDiet(db)).toBeNull()
  })

  it('fait l’aller-retour sur les aliments exclus', () => {
    writeExcludedFoodIds(db, ['coriandre' as FoodId, 'olive_noire' as FoodId])
    expect(readExcludedFoodIds(db)).toEqual(['coriandre', 'olive_noire'])
    writeExcludedFoodIds(db, [])
    expect(readExcludedFoodIds(db)).toEqual([])
  })
})

describe('user-store — goûts et favoris', () => {
  it('rend une Map vide, pas une absence — la couche `preference` attend une Map', () => {
    expect(readPreferences(db).size).toBe(0)
  })

  it('fait l’aller-retour et écrase le score précédent du même aliment', () => {
    writePreference(db, 'poulet' as FoodId, 2)
    writePreference(db, 'coriandre' as FoodId, -2)
    writePreference(db, 'poulet' as FoodId, -1)
    const prefs = readPreferences(db)
    expect(prefs.get('poulet' as FoodId)).toBe(-1)
    expect(prefs.get('coriandre' as FoodId)).toBe(-2)
    expect(prefs.size).toBe(2)
  })

  it('ne lit QUE les préférences d’aliments, pas celles de recettes', () => {
    // `SuggestionRequest.preferences` est une ReadonlyMap<FoodId, number> : y glisser un RecipeId
    // ferait chercher un aliment inexistant, sans erreur, et la couche noterait au neutre.
    writePreference(db, 'poulet' as FoodId, 2)
    db.run(`INSERT INTO user_preference (cible_type, cible_id, score) VALUES ('recipe', 'r1', 2)`)
    expect([...readPreferences(db).keys()]).toEqual(['poulet'])
  })

  it('ajoute et retire un favori', () => {
    setFavorite(db, 'r1' as RecipeId, true, AUJOURDHUI)
    setFavorite(db, 'r2' as RecipeId, true, AUJOURDHUI)
    expect(readFavorites(db)).toEqual(new Set(['r1', 'r2']))
    setFavorite(db, 'r1' as RecipeId, false, AUJOURDHUI)
    expect(readFavorites(db)).toEqual(new Set(['r2']))
  })

  it('fait l’aller-retour sur les thématiques actives et le garde-manger', () => {
    writeActiveTopics(db, ['diabete' as TopicId], AUJOURDHUI)
    expect(readActiveTopics(db)).toEqual(['diabete'])
    writePantry(db, [{ foodId: 'farine_ble' as FoodId, quantiteApprox: 'un fond de paquet' }], '2026-08-04')
    expect(readPantryFoodIds(db)).toEqual(['farine_ble'])
  })

  // ⚠️ SANS DATE PAR LIGNE, LA MIGRATION v8 NE SERT À RIEN DÈS LE DEUXIÈME ALIMENT. `writePantry`
  // remplace la table entière à chaque geste : dater tout le monde du jour faisait qu'ajouter un
  // aliment ce matin certifiait fraîche une déclaration de trois semaines.
  it('⛔ HONORE LA DATE DE CHAQUE LIGNE, et ne retombe sur la date globale que si elle manque', () => {
    writePantry(
      db,
      [
        { foodId: 'creme_fraiche' as FoodId, quantiteApprox: null, declareLe: '2026-07-01' },
        { foodId: 'riz_blanc' as FoodId, quantiteApprox: null },
      ],
      '2026-08-04'
    )

    const lues = new Map(readPantryEntries(db).map((e) => [e.foodId, e.declareLe]))
    expect(lues.get('creme_fraiche' as FoodId)).toBe('2026-07-01')
    expect(lues.get('riz_blanc' as FoodId)).toBe('2026-08-04')
    // La plus ancienne fait foi — c'est elle qui décide s'il faut reposer la question.
    expect(readPantryDeclareLe(db)).toBe('2026-07-01')
  })

  it('une ligne sans date lisible ressort SANS `declareLe`, jamais avec une date inventée', () => {
    // Lignes d'avant la migration v8 : `declare_le = ''`. L'absence d'information n'est pas une
    // information — la remonter comme chaîne vide ferait un `Date.parse` silencieusement faux.
    db.run("INSERT INTO user_pantry (food_id, quantite_approx, declare_le) VALUES ('oeuf', NULL, '')")
    expect(readPantryEntries(db)).toEqual([{ foodId: 'oeuf', quantiteApprox: null }])
    expect(readPantryDeclareLe(db)).toBeNull()
  })
})

describe('user-store — historique', () => {
  const entree = (date: string, origine: 'choisi' | 'reste'): MealHistoryEntry => ({
    recipeId: `r-${date}-${origine}` as RecipeId,
    date,
    creneau: 'diner',
    origine,
  })

  it('rend un historique vide mais bien formé sur une base neuve', () => {
    expect(readHistory(db, { windowDays: 21, today: AUJOURDHUI })).toEqual({
      windowDays: 21,
      entries: [],
    })
  })

  it('CONSERVE l’origine choisi/reste — l’asymétrie habit/variety en dépend', () => {
    // Acquis verrouillé : `habit` ne compte que `choisi`, `variety` lit tout. Perdre l'origine à
    // l'écriture ferait passer un reste pour une préférence exprimée, en silence.
    recordMeal(db, entree('2026-07-29', 'choisi'))
    recordMeal(db, entree('2026-07-28', 'reste'))
    const origines = readHistory(db, { windowDays: 21, today: AUJOURDHUI }).entries.map(
      (e) => e.origine
    )
    expect(new Set(origines)).toEqual(new Set(['choisi', 'reste']))
  })

  it('APPLIQUE windowDays — aucune couche du moteur ne le fait', () => {
    // `MealHistory.windowDays` est déclaré dans le domaine mais lu par aucune couche : les
    // fonctions de score consomment toutes les entrées qu'on leur donne. La fenêtre de 21 jours
    // glissants (§13 ENGINE) n'existe donc que si la LECTURE la borne — ici.
    recordMeal(db, entree('2026-07-29', 'choisi')) // hier — dedans
    recordMeal(db, entree('2026-07-10', 'choisi')) // 20 jours — dedans
    recordMeal(db, entree('2026-07-01', 'choisi')) // 29 jours — dehors
    const dates = readHistory(db, { windowDays: 21, today: AUJOURDHUI }).entries.map((e) => e.date)
    expect(dates).toContain('2026-07-29')
    expect(dates).toContain('2026-07-10')
    expect(dates).not.toContain('2026-07-01')
  })

  it('écarte les entrées postérieures à today', () => {
    recordMeal(db, entree('2026-08-05', 'choisi'))
    expect(readHistory(db, { windowDays: 21, today: AUJOURDHUI }).entries).toEqual([])
  })

  it('ne duplique pas la même recette sur le même créneau, mais admet plusieurs services', () => {
    const plat: MealHistoryEntry = {
      recipeId: 'r1' as RecipeId,
      date: '2026-07-29',
      creneau: 'diner',
      origine: 'choisi',
    }
    recordMeal(db, plat)
    recordMeal(db, { ...plat, origine: 'reste' }) // même clé → remplace
    recordMeal(db, { ...plat, recipeId: 'r2' as RecipeId }) // autre plat, même créneau → s'ajoute
    const entries = readHistory(db, { windowDays: 21, today: AUJOURDHUI }).entries
    expect(entries).toHaveLength(2)
    expect(entries.find((e) => e.recipeId === ('r1' as RecipeId))?.origine).toBe('reste')
  })

  it('rend les entrées de la plus récente à la plus ancienne', () => {
    recordMeal(db, entree('2026-07-20', 'choisi'))
    recordMeal(db, entree('2026-07-29', 'choisi'))
    recordMeal(db, entree('2026-07-25', 'choisi'))
    const dates = readHistory(db, { windowDays: 21, today: AUJOURDHUI }).entries.map((e) => e.date)
    expect(dates).toEqual(['2026-07-29', '2026-07-25', '2026-07-20'])
  })
})

describe('user-store — readUserState', () => {
  it('compose tout ce qu’il faut pour bâtir une SuggestionRequest', () => {
    writeProfile(db, PROFIL, AUJOURDHUI)
    writeAllergies(db, [{ allergenId: 'gluten' as AllergenId, severite: null }])
    writeDiet(db, 'vegetarien')
    writeExcludedFoodIds(db, ['coriandre' as FoodId])
    writePreference(db, 'poulet' as FoodId, 2)
    setFavorite(db, 'r1' as RecipeId, true, AUJOURDHUI)
    recordMeal(db, {
      recipeId: 'r9' as RecipeId,
      date: '2026-07-29',
      creneau: 'diner',
      origine: 'choisi',
    })
    writeActiveTopics(db, ['diabete' as TopicId], AUJOURDHUI)
    writePantry(db, [{ foodId: 'farine_ble' as FoodId, quantiteApprox: null }], '2026-08-04')

    const etat = readUserState(db, { windowDays: 21, today: AUJOURDHUI })

    expect(etat.profile).toEqual(PROFIL)
    expect(etat.constraints).toEqual({
      allergies: ['gluten'],
      diet: 'vegetarien',
      excludedFoodIds: ['coriandre'],
    })
    expect(etat.preferences.get('poulet' as FoodId)).toBe(2)
    expect(etat.favoriteRecipeIds.has('r1' as RecipeId)).toBe(true)
    expect(etat.history.entries).toHaveLength(1)
    expect(etat.activeTopics).toEqual(['diabete'])
    expect(etat.pantryFoodIds).toEqual(['farine_ble'])
  })

  it('rend un état exploitable sur une base VIDE — profil null, tout le reste neutre', () => {
    // C'est le cas du tout premier lancement : rien ne doit lever, l'UI décide quoi faire du
    // profil manquant (onboarding, ou semis d'un profil par défaut).
    const etat = readUserState(db, { windowDays: 21, today: AUJOURDHUI })
    expect(etat.profile).toBeNull()
    expect(etat.constraints.allergies).toEqual([])
    expect(etat.preferences.size).toBe(0)
    expect(etat.favoriteRecipeIds.size).toBe(0)
    expect(etat.history.entries).toEqual([])
  })
})

describe('user-store — planning', () => {
  const plan: WeekPlan = {
    id: 'plan-2026-08-03-3',
    startDate: '2026-08-03',
    days: 3,
    seed: 7,
    entries: [
      {
        slot: { date: '2026-08-03', creneau: 'diner' },
        recipeId: 'r1' as RecipeId,
        horsCatalogue: null,
        portions: 4,
        locked: true,
        isLeftover: false,
        service: null,
      },
      {
        slot: { date: '2026-08-04', creneau: 'diner' },
        recipeId: 'r2' as RecipeId,
        horsCatalogue: null,
        portions: 2,
        locked: false,
        isLeftover: true,
        service: null,
      },
      {
        slot: { date: '2026-08-05', creneau: 'diner' },
        recipeId: null,
        horsCatalogue: null,
        portions: 0,
        locked: false,
        isLeftover: false,
        service: null,
      },
    ],
    warnings: [],
  }

  it('rend null pour un plan inconnu, et null tant qu’aucun plan n’existe', () => {
    expect(readPlan(db, 'inexistant')).toBeNull()
    expect(readLatestPlan(db)).toBeNull()
  })

  it('fait l’aller-retour complet — verrous, restes et créneaux vides compris', () => {
    savePlan(db, plan, AUJOURDHUI)
    expect(readPlan(db, plan.id)).toEqual(plan)
  })

  it('REMPLACE le plan précédent au lieu d’accumuler ses créneaux', () => {
    // Un plan raccourci de 3 à 2 jours garderait sinon le créneau du 3ᵉ jour, invisible à l'écran
    // mais bien présent dans la liste de courses.
    savePlan(db, plan, AUJOURDHUI)
    savePlan(db, { ...plan, days: 2, entries: plan.entries.slice(0, 2) }, AUJOURDHUI)
    expect(readPlan(db, plan.id)?.entries).toHaveLength(2)
  })

  it('rend les créneaux dans l’ordre des repas, pas dans l’ordre alphabétique', () => {
    // 'dejeuner' < 'petit_dejeuner' en alphabétique : trier sur la colonne mettrait le déjeuner
    // avant le petit-déjeuner.
    const creneaux: readonly MealSlot[] = ['diner', 'petit_dejeuner', 'gouter', 'dejeuner']
    savePlan(
      db,
      {
        ...plan,
        days: 2,
        entries: creneaux.map((creneau) => ({
          slot: { date: '2026-08-03', creneau },
          recipeId: `r-${creneau}` as RecipeId,
          horsCatalogue: null,
          portions: 1,
          locked: false,
          isLeftover: false,
          service: null,
        })),
      },
      AUJOURDHUI
    )
    expect(readPlan(db, plan.id)?.entries.map((e) => e.slot.creneau)).toEqual([
      'petit_dejeuner',
      'dejeuner',
      'gouter',
      'diner',
    ])
  })

  it('rend TOUJOURS des warnings vides — ils se recalculent, ils ne se stockent pas', () => {
    // Un avertissement de plancher calorique figé en base continuerait de s'afficher après un
    // changement de profil. L'appelant doit rappeler engine.checkPlan().
    savePlan(
      db,
      { ...plan, warnings: [{ kind: 'plancher_calorique', date: '2026-08-03', kcal: 900, seuil: 1200, repasComptes: 2 }] },
      AUJOURDHUI
    )
    expect(readPlan(db, plan.id)?.warnings).toEqual([])
  })

  it('rend le plan le plus RÉCEMMENT ÉCRIT — pas seulement celui de plus grande date de début', () => {
    // ⚠️ ANCIEN COMPORTEMENT (avant v7) : tri sur `date_debut DESC, id DESC` uniquement. Ce plan a un
    // id textuellement PLUS PETIT et une `date_debut` ANTÉRIEURE, mais c'est le dernier ÉCRIT — c'est
    // lui que `readLatestPlan` doit rendre.
    savePlan(db, { ...plan, id: 'plan-2026-09-01-3', startDate: '2026-09-01' }, '2026-08-01T08:00:00.000Z')
    savePlan(db, plan, '2026-08-01T09:00:00.000Z')
    expect(readLatestPlan(db)?.id).toBe(plan.id)
  })

  it('le scénario exact du bug : même date_debut, 7 jours puis 3 — rend le plan à 3 jours', () => {
    // `meal_plan.id` vaut `plan-${startDate}-${days}` (engine/planning/plan-week.ts). Replanifier la
    // même date avec un nombre de jours différent crée une SECONDE ligne, de même `date_debut`, dont
    // l'id est textuellement PLUS GRAND (« …-7 » > « …-3 ») — un tri sur l'id seul rouvrirait donc le
    // plan à 7 jours après un rechargement, alors qu'il a été remplacé.
    const plan7 = { ...plan, id: 'plan-2026-08-03-7', days: 7 }
    const plan3 = { ...plan, id: 'plan-2026-08-03-3', days: 3 }
    savePlan(db, plan7, '2026-08-03T10:00:00.000Z')
    savePlan(db, plan3, '2026-08-03T10:05:00.000Z')
    expect(readLatestPlan(db)?.id).toBe(plan3.id)
    expect(readLatestPlan(db)?.days).toBe(3)
  })

  it('refuse un plan d’avant la migration v2 plutôt que d’afficher zéro jour', () => {
    db.run(`INSERT INTO meal_plan (id, date_debut, jours, seed) VALUES ('vieux', '2026-08-03', 0, 0)`)
    expect(readPlan(db, 'vieux')).toBeNull()
  })

  // --- Plats préparés (décision 51, migration v9) ---------------------------------------------

  it('un plat préparé fait l’aller-retour — sans quoi le créneau redeviendrait vide au rechargement', () => {
    // ⚠️ LE VRAI RISQUE EST ICI, pas dans le moteur. Un champ ajouté au type et oublié dans l'INSERT
    // ou dans le SELECT ne casse RIEN : le plan s'affiche, le créneau se vide au rechargement, et
    // rien ne le signale. C'est la classe de défaut que ce projet a déjà payée trois fois.
    const avecPrepare: WeekPlan = {
      ...plan,
      entries: [
        ...plan.entries,
        {
          slot: { date: '2026-08-05', creneau: 'gouter' },
          recipeId: null,
          horsCatalogue: 'Lasagnes surgelées',
          portions: 0,
          locked: false,
          isLeftover: false,
          service: null,
        },
      ],
    }
    savePlan(db, avecPrepare, '2026-08-03T10:00:00.000Z')

    const relu = readPlan(db, avecPrepare.id)
    const prepare = relu?.entries.find((e) => e.slot.creneau === 'gouter')
    expect(prepare?.horsCatalogue).toBe('Lasagnes surgelées')
    expect(prepare?.recipeId).toBeNull()
  })

  it('une entrée ordinaire relit `horsCatalogue: null`, jamais `undefined`', () => {
    // `undefined` passerait les tests du moteur (`!== null` reste vrai) tout en faisant croire à
    // chaque garde que la journée est immesurable. Un plan entier cesserait d'être vérifié.
    savePlan(db, plan, '2026-08-03T10:00:00.000Z')
    const relu = readPlan(db, plan.id)
    expect(relu?.entries.every((e) => e.horsCatalogue === null)).toBe(true)
  })

  it('la BASE refuse une recette ET un libellé sur la même ligne — la garantie vient de la forme', () => {
    // Le quatrième état est inexprimable, pas seulement découragé : sans ce `CHECK`, la question
    // « lequel des deux compte ? » se poserait à chaque lecture, et chaque lecteur y répondrait seul.
    expect(() =>
      db.run(
        `INSERT INTO meal_plan_entry (plan_id, date, creneau, recipe_id, portions, hors_catalogue)
         VALUES ('plan-2026-08-03-3', '2026-08-03', 'diner', 'r1', 2, 'Pizza')`
      )
    ).toThrow()
  })
})

describe('user-schema — ce que la migration v2 corrige', () => {
  it('accepte un créneau VIDE à 0 portion — le CHECK de la v1 le refusait', () => {
    // `planWeek` rend `portions: 0` quand il ne peut pas remplir un créneau. C'est le cas normal,
    // pas une anomalie : `CHECK (portions > 0)` refusait d'enregistrer un plan valide.
    db.run(`INSERT INTO meal_plan (id, date_debut, jours, seed) VALUES ('p', '2026-08-03', 3, 1)`)
    expect(() =>
      db.run(
        `INSERT INTO meal_plan_entry (plan_id, date, creneau, recipe_id, portions)
         VALUES ('p', '2026-08-03', 'diner', NULL, 0)`
      )
    ).not.toThrow()
  })

  it('refuse en revanche les deux incohérences que le nouvel invariant vise', () => {
    db.run(`INSERT INTO meal_plan (id, date_debut, jours, seed) VALUES ('p', '2026-08-03', 3, 1)`)
    // une recette sans portions
    expect(() =>
      db.run(
        `INSERT INTO meal_plan_entry (plan_id, date, creneau, recipe_id, portions)
         VALUES ('p', '2026-08-03', 'diner', 'r1', 0)`
      )
    ).toThrow()
    // un créneau vide avec des portions
    expect(() =>
      db.run(
        `INSERT INTO meal_plan_entry (plan_id, date, creneau, recipe_id, portions)
         VALUES ('p', '2026-08-04', 'diner', NULL, 4)`
      )
    ).toThrow()
  })

  it('CONSERVE l’index unique de créneau après la reconstruction de table', () => {
    // Le piège classique d'un rebuild SQLite : `DROP TABLE` emporte les index. Sans recréation,
    // le doublon de créneau redeviendrait possible — sans erreur, et sans que rien ne le dise.
    db.run(`INSERT INTO meal_plan (id, date_debut, jours, seed) VALUES ('p', '2026-08-03', 3, 1)`)
    const inserer = () =>
      db.run(
        `INSERT INTO meal_plan_entry (plan_id, date, creneau, service, recipe_id, portions)
         VALUES ('p', '2026-08-03', 'diner', NULL, 'r1', 4)`
      )
    inserer()
    expect(inserer).toThrow()
  })
})

describe('user-store — liste de courses', () => {
  const PLAN_ID = 'plan-2026-08-03-3'

  const liste = (...aliments: readonly string[]): ShoppingList => ({
    planId: PLAN_ID,
    generatedAt: '2026-08-03',
    items: aliments.map((foodId) => ({
      foodId: foodId as FoodId,
      quantiteTotale: 250,
      unite: 'g',
      rayon: 'épicerie',
      tranche: 0,
      pourSlots: [{ date: '2026-08-03', creneau: 'diner' as MealSlot }],
    })),
  })

  beforeEach(() => {
    // La liste référence un plan : sans lui, la clé étrangère refuse l'insertion.
    savePlan(
      db,
      {
        id: PLAN_ID,
        startDate: '2026-08-03',
        days: 3,
        seed: 1,
        entries: [],
        warnings: [],
      },
      AUJOURDHUI
    )
  })

  it('rend null tant qu’aucune liste n’a été enregistrée', () => {
    expect(readShoppingList(db)).toBeNull()
  })

  it('enregistre puis relit, avec aucune case cochée au départ', () => {
    saveShoppingList(db, liste('farine_ble', 'oeuf'))
    const relue = readShoppingList(db)
    expect(relue?.planId).toBe(PLAN_ID)
    expect(relue?.coches.size).toBe(0)
    expect(relue?.extras).toEqual([])
  })

  it('CONSERVE les cases cochées quand la liste est régénérée', () => {
    // Le comportement qui compte : ajouter un dîner à la semaine ne doit pas effacer les vingt
    // lignes déjà cochées au supermarché.
    saveShoppingList(db, liste('farine_ble', 'oeuf'))
    const id = readShoppingList(db)!.id
    setCoche(db, id, 'farine_ble' as FoodId, true)

    saveShoppingList(db, liste('farine_ble', 'oeuf', 'lait_entier'))
    const relue = readShoppingList(db)
    expect(relue?.coches.has('farine_ble' as FoodId)).toBe(true)
    expect(relue?.coches.has('oeuf' as FoodId)).toBe(false)
  })

  it('PERD le cochage d’un aliment qui sort du plan — il n’est plus à acheter', () => {
    saveShoppingList(db, liste('farine_ble', 'oeuf'))
    const id = readShoppingList(db)!.id
    setCoche(db, id, 'oeuf' as FoodId, true)

    saveShoppingList(db, liste('farine_ble'))
    expect(readShoppingList(db)?.coches.has('oeuf' as FoodId)).toBe(false)
  })

  it('sait décocher', () => {
    saveShoppingList(db, liste('farine_ble'))
    const id = readShoppingList(db)!.id
    setCoche(db, id, 'farine_ble' as FoodId, true)
    setCoche(db, id, 'farine_ble' as FoodId, false)
    expect(readShoppingList(db)?.coches.size).toBe(0)
  })

  it('NE SUPPRIME PAS les articles ajoutés à la main lors d’une régénération', () => {
    // Ils ne viennent pas du plan : les régénérer n'aurait pas de sens, et les perdre à chaque
    // replanification serait une trahison.
    saveShoppingList(db, liste('farine_ble'))
    const id = readShoppingList(db)!.id
    addExtraItem(db, id, { libelle: 'Lessive', rayon: 'lessive & linge' })

    saveShoppingList(db, liste('farine_ble', 'oeuf'))
    const extras = readShoppingList(db)!.extras
    expect(extras).toHaveLength(1)
    expect(extras[0]?.libelle).toBe('Lessive')
  })

  it('fait l’aller-retour sur un article non alimentaire, coché puis supprimé', () => {
    saveShoppingList(db, liste('farine_ble'))
    const id = readShoppingList(db)!.id
    addExtraItem(db, id, { libelle: 'Croquettes chat', rayon: 'animaux', quantite: '2 kg' })

    const article = readExtraItems(db, id)[0]!
    expect(article.rayon).toBe('animaux')
    expect(article.quantite).toBe('2 kg')
    expect(article.coche).toBe(false)

    setExtraCoche(db, article.id, true)
    expect(readExtraItems(db, id)[0]?.coche).toBe(true)

    removeExtraItem(db, article.id)
    expect(readExtraItems(db, id)).toEqual([])
  })

  it('SURVIT à un réenregistrement du plan — verrouiller un créneau ne vide pas les courses', () => {
    // ⚠️ RÉGRESSION D'UN BUG RÉEL. `savePlan` faisait un `INSERT OR REPLACE`, qui SUPPRIME la ligne
    // avant de réinsérer et déclenche donc les ON DELETE CASCADE : la liste de courses et ses
    // articles disparaissaient. Or l'écran Semaine appelle `savePlan` à chaque « Garder ».
    saveShoppingList(db, liste('farine_ble'))
    const id = readShoppingList(db)!.id
    setCoche(db, id, 'farine_ble' as FoodId, true)
    addExtraItem(db, id, { libelle: 'Éponges' })

    savePlan(db, { id: PLAN_ID, startDate: '2026-08-03', days: 3, seed: 42, entries: [], warnings: [] }, AUJOURDHUI)

    const relue = readShoppingList(db)
    expect(relue, 'la liste ne doit pas disparaître').not.toBeNull()
    expect(relue?.coches.has('farine_ble' as FoodId)).toBe(true)
    expect(relue?.extras).toHaveLength(1)
  })

  it('écrit et relit la note d’allergène d’un article ajouté par complétion', () => {
    saveShoppingList(db, liste('farine_ble'))
    const id = readShoppingList(db)!.id
    addExtraItem(db, id, {
      libelle: 'Farine de blé',
      rayon: 'épicerie',
      noteAllergene: 'Contient un allergène que vous avez déclaré : Gluten',
    })

    expect(readExtraItems(db, id)[0]?.noteAllergene).toBe(
      'Contient un allergène que vous avez déclaré : Gluten'
    )
  })

  it('n’expose AUCUN allergène structuré sur les articles non alimentaires', () => {
    // §4.3 : le système des 14 allergènes UE reste réservé à ce qu'on MANGE. Ici, seulement une
    // note en texte libre, informative, jamais filtrante.
    const colonnes = db
      .all<{ readonly name: string }>('PRAGMA table_info(shopping_extra_item)')
      .map((c) => c.name)
    expect(colonnes).toContain('note_allergene')
    expect(colonnes.some((c) => c === 'allergen_id' || c === 'food_id')).toBe(false)
  })
})

describe('user-store — rythme et consentement', () => {
  it('rend null tant que le premier lancement n’a pas eu lieu', () => {
    expect(readRythme(db)).toBeNull()
    expect(readConsents(db)).toEqual([])
    expect(aConsenti(db, 'v1')).toBe(false)
  })

  it('fait l’aller-retour sur le rythme, sans limite de temps déclarée', () => {
    // `null` = pas de limite, et c'est le NEUTRE. Zéro serait faux — aucune recette ne se cuisine
    // en zéro minute — et empêcherait de distinguer « je n'ai pas répondu » de « je suis pressé ».
    writeRythme(db, { repasParJour: 2, tempsSemaineMin: 30, tempsWeekendMin: null })
    expect(readRythme(db)).toEqual({ repasParJour: 2, tempsSemaineMin: 30, tempsWeekendMin: null })
  })

  it('remplace le rythme au lieu d’en accumuler', () => {
    writeRythme(db, { repasParJour: 1, tempsSemaineMin: null, tempsWeekendMin: null })
    writeRythme(db, { repasParJour: 3, tempsSemaineMin: 20, tempsWeekendMin: 90 })
    expect(readRythme(db)?.repasParJour).toBe(3)
  })

  it('borne le nombre de repas à 1…3 — la base refuse, pas le code appelant', () => {
    expect(() => writeRythme(db, { repasParJour: 0, tempsSemaineMin: null, tempsWeekendMin: null })).toThrow()
    expect(() => writeRythme(db, { repasParJour: 4, tempsSemaineMin: null, tempsWeekendMin: null })).toThrow()
  })

  it('refuse un temps nul — « zéro minute » n’est pas « pas de limite »', () => {
    expect(() => writeRythme(db, { repasParJour: 2, tempsSemaineMin: 0, tempsWeekendMin: null })).toThrow()
  })

  it('garde UNE LIGNE PAR VERSION de consentement, sans écraser la précédente', () => {
    // §6.4 : accepter la v2 ne doit pas effacer la trace de l'acceptation de la v1. C'est la seule
    // façon de savoir ce que l'utilisateur a réellement lu, et quand.
    recordConsent(db, 'accueil-v1', '2026-07-30')
    recordConsent(db, 'accueil-v2', '2026-09-01')
    expect(readConsents(db)).toHaveLength(2)
    expect(aConsenti(db, 'accueil-v1')).toBe(true)
    expect(aConsenti(db, 'accueil-v2')).toBe(true)
    expect(aConsenti(db, 'accueil-v3')).toBe(false)
  })

  it('rend les consentements du plus récent au plus ancien', () => {
    recordConsent(db, 'accueil-v1', '2026-07-30')
    recordConsent(db, 'accueil-v2', '2026-09-01')
    expect(readConsents(db)[0]?.versionTexte).toBe('accueil-v2')
  })
})

describe('user-store — réglages d’affichage (v4)', () => {
  it('part des défauts du schéma sur une base neuve — rien d’activé sans geste explicite', () => {
    // Les trois défauts portent chacun une décision : macros opt-in (§6.5 ARCHITECTURE), balayage
    // opt-in (§3 DESIGN), alerte NON discrète. Ils vivent dans le schéma, pas dans le code de
    // lecture — une base où la ligne existe sans valeur ne peut pas les activer par accident.
    expect(readDisplay(db)).toEqual({
      afficherMacros: false,
      gestesBalayage: false,
      alertesDiscretes: false,
      bandeauStockageMasque: false,
      rappelsActifs: false,
      visiteProposee: false,
    })
  })

  it('fait l’aller-retour sur tous les réglages', () => {
    const tout = {
      afficherMacros: true,
      gestesBalayage: true,
      alertesDiscretes: true,
      bandeauStockageMasque: true,
      rappelsActifs: true,
      visiteProposee: true,
    }
    writeDisplay(db, tout)
    expect(readDisplay(db)).toEqual(tout)
  })

  it('garde le bandeau de stockage écarté — c’est tout l’intérêt de la croix', () => {
    // ⚠️ Ce réglage ne vaut QUE pour l'alerte `non_persistant` (voir `ECARTABLE` dans main.tsx) :
    // « cet appareil n'enregistre rien » et « une écriture a échoué » ne se referment pas.
    writeDisplay(db, { ...readDisplay(db), bandeauStockageMasque: true })
    expect(readDisplay(db).bandeauStockageMasque).toBe(true)
  })

  it('n’efface PAS les autres réglages en en changeant un seul', () => {
    // ⚠️ LE DÉFAUT QUE CE TEST EXISTE POUR ATTRAPER. `INSERT OR REPLACE` supprime la ligne avant de
    // la réinsérer : si `writeDisplay` omettait une colonne, elle repartirait au DEFAULT du schéma.
    // Activer le balayage aurait alors éteint les macros, sans erreur et sans trace.
    writeDisplay(db, {
      afficherMacros: true,
      gestesBalayage: false,
      alertesDiscretes: false,
      bandeauStockageMasque: true,
      rappelsActifs: false,
      visiteProposee: false,
    })
    writeDisplay(db, { ...readDisplay(db), gestesBalayage: true })
    expect(readDisplay(db).afficherMacros).toBe(true)
    expect(readDisplay(db).gestesBalayage).toBe(true)
    expect(readDisplay(db).bandeauStockageMasque).toBe(true)
  })

  it('« visite_proposee » démarre à faux et reste posé une fois écrit', () => {
    // Même sémantique que `rappelsActifs` : « on l'a déjà proposée » ne doit jamais revenir à faux
    // toute seule, sinon la visite guidée réapparaîtrait à chaque lancement.
    expect(readDisplay(db).visiteProposee).toBe(false)
    writeDisplay(db, { ...readDisplay(db), visiteProposee: true })
    expect(readDisplay(db).visiteProposee).toBe(true)
  })
})

describe('user-store — la cuisson en cours (v10, portions en v11)', () => {
  const SESSION = {
    recetteId: 'chakchouka',
    ordreCourant: 3,
    ouverteLe: 1_770_000_000_000,
    portions: 6,
    minuteurs: [
      { ordre: 2, finMs: 1_770_000_600_000, pauseRestantS: null },
      { ordre: 3, finMs: null, pauseRestantS: 120 },
    ],
  }

  it('aucune cuisson au départ', () => {
    expect(readCuisineSession(db)).toBeNull()
  })

  it('fait l’aller-retour complet, minuteurs compris et triés', () => {
    writeCuisineSession(db, SESSION)
    expect(readCuisineSession(db)).toEqual(SESSION)
  })

  // ⚠️ LE PIÈGE DÉJÀ PAYÉ (reference/PIEGES.md). `INSERT OR REPLACE` sur la session supprimerait la
  // ligne avant de la réinsérer, déclenchant le CASCADE sur `user_cuisine_timer` — les minuteurs
  // qu'on est en train d'écrire disparaîtraient dans le même appel, sans la moindre erreur.
  it('⛔ réécrire la session ne perd PAS ses minuteurs', () => {
    writeCuisineSession(db, SESSION)
    writeCuisineSession(db, { ...SESSION, ordreCourant: 4 })

    const relue = readCuisineSession(db)
    expect(relue?.ordreCourant).toBe(4)
    expect(relue?.minuteurs).toHaveLength(2)
  })

  it('remplace les minuteurs au lieu de les empiler — arrêter un minuteur doit le FAIRE disparaître', () => {
    writeCuisineSession(db, SESSION)
    writeCuisineSession(db, { ...SESSION, minuteurs: [SESSION.minuteurs[0]!] })

    expect(readCuisineSession(db)?.minuteurs.map((t) => t.ordre)).toEqual([2])
  })

  it('fermer la cuisson emporte ses minuteurs', () => {
    writeCuisineSession(db, SESSION)
    clearCuisineSession(db)

    expect(readCuisineSession(db)).toBeNull()
    const restants = db.all<{ readonly n: number }>('SELECT COUNT(*) AS n FROM user_cuisine_timer')
    expect(restants[0]?.n).toBe(0)
  })

  // La garantie vient de la FORME (acquis n°2) : en marche il n'existe qu'une échéance, en pause il
  // n'existe qu'un reste. Un minuteur portant les deux serait une contradiction lisible dans les
  // deux sens — la base doit le refuser, pas le code de lecture.
  it('⛔ refuse un minuteur qui serait en marche ET en pause', () => {
    writeCuisineSession(db, SESSION)
    expect(() =>
      db.run('INSERT INTO user_cuisine_timer (session_id, ordre, fin_ms, pause_restant_s) VALUES (1, 9, 1, 1)')
    ).toThrow()
  })

  it('⛔ refuse un minuteur qui ne serait NI en marche NI en pause', () => {
    writeCuisineSession(db, SESSION)
    expect(() =>
      db.run(
        'INSERT INTO user_cuisine_timer (session_id, ordre, fin_ms, pause_restant_s) VALUES (1, 9, NULL, NULL)'
      )
    ).toThrow()
  })

  // ⚠️ CE TEST AFFIRMAIT L'INVERSE JUSQU'À LA v13, et c'était juste : « une seule cuisson à la fois
  // — la v1 est mono-recette », garantie par `CHECK (id = 1)`. La v13 lève cette contrainte, comme
  // la v10 l'annonçait déjà en toutes lettres. On ne SUPPRIME pas la ligne pour autant : elle est
  // retournée, pour que la relecture voie que la bascule est VOULUE et non un `CHECK` perdu en
  // route. La garantie qui la remplace — pas deux fois la même recette — est vérifiée dans le bloc
  // « ce que la migration v13 rend possible, et ce qu'elle protège ».
  it('depuis la v13, une deuxième cuisson sur une AUTRE recette est acceptée', () => {
    writeCuisineSession(db, SESSION)
    expect(() =>
      db.run('INSERT INTO user_cuisine_session (id, recette_id, ordre_courant, ouverte_le) VALUES (2, ?, 1, 0)', [
        'omelette_fines_herbes',
      ])
    ).not.toThrow()
  })

  // --- v11 — les portions suivent la cuisson ----------------------------------------------------

  it('les portions font l’aller-retour', () => {
    writeCuisineSession(db, SESSION)
    expect(readCuisineSession(db)?.portions).toBe(6)
  })

  // ⚠️ `null` = AUCUN CHOIX EXPRIMÉ, jamais « les portions de base ». C'est l'état d'une cuisson
  // ouverte AVANT la v11, et c'est l'écran — seul à connaître `portionsBase` — qui tranche alors.
  // Combler ici écrirait dans la base un choix que personne n'a fait.
  it('⛔ `null` reste `null` — le store n’invente aucun nombre de portions', () => {
    writeCuisineSession(db, { ...SESSION, portions: null })
    expect(readCuisineSession(db)?.portions).toBeNull()
  })

  // La garantie vient de la FORME, pas du code appelant : `portions = 0` ferait disparaître la
  // recette de sa propre mise à l'échelle. Le routeur filtre déjà, la base ne s'en remet pas à lui.
  it('⛔ la base refuse zéro portion', () => {
    expect(() =>
      db.run(
        'INSERT INTO user_cuisine_session (id, recette_id, ordre_courant, ouverte_le, portions) VALUES (1, ?, 1, 0, 0)',
        ['chakchouka']
      )
    ).toThrow()
  })

  // ⚠️ MÊME PIÈGE QUE LES MINUTEURS, sur une autre colonne : réécrire la session doit mettre les
  // portions à jour SANS emporter les minuteurs au passage (`ON CONFLICT DO UPDATE`, jamais
  // `INSERT OR REPLACE`).
  it('changer les portions ne perd pas les minuteurs', () => {
    writeCuisineSession(db, SESSION)
    writeCuisineSession(db, { ...SESSION, portions: 2 })

    const relue = readCuisineSession(db)
    expect(relue?.portions).toBe(2)
    expect(relue?.minuteurs).toHaveLength(2)
  })
})

describe('user-store — modifier ses allergies après le premier lancement', () => {
  // ⚠️ CHEMIN CRITIQUE. §5.2 ARCHITECTURE classe le filtre allergènes comme « le seul garde-fou
  // CRITIQUE et incontournable » du moteur. Jusqu'à l'écran Paramètres, `writeAllergies` n'était
  // appelé QUE par l'onboarding : une faute de frappe était définitive et une allergie découverte
  // plus tard n'était pas déclarable, alors que l'écran promet « Vous pourrez modifier plus tard ».
  // Ces tests tiennent la promesse côté données ; l'écran ne fait que les appeler.

  it('remplace la liste au lieu d’y ajouter — décocher doit RETIRER du filtre', () => {
    writeAllergies(db, [
      { allergenId: 'gluten' as AllergenId, severite: null },
      { allergenId: 'lait' as AllergenId, severite: null },
    ])
    writeAllergies(db, [{ allergenId: 'lait' as AllergenId, severite: null }])

    expect(readAllergies(db).map((a) => a.allergenId)).toEqual(['lait'])
    // C'est `constraints` que le moteur lit — vérifier `user_allergy` seule ne prouverait rien.
    expect(readConstraints(db).allergies).toEqual(['lait'])
  })

  it('sait revenir à AUCUNE allergie — « je m’étais trompé » doit être exprimable', () => {
    writeAllergies(db, [{ allergenId: 'arachides' as AllergenId, severite: null }])
    writeAllergies(db, [])
    expect(readConstraints(db).allergies).toEqual([])
  })

  it('propage un ajout tardif jusqu’à readUserState, la source des suggestions', () => {
    // L'onboarding passé, une allergie qui apparaît doit atteindre le moteur sans réinstallation.
    expect(readUserState(db, { windowDays: 21, today: AUJOURDHUI }).constraints.allergies).toEqual([])
    writeAllergies(db, [{ allergenId: 'crustaces' as AllergenId, severite: null }])
    expect(readUserState(db, { windowDays: 21, today: AUJOURDHUI }).constraints.allergies).toEqual([
      'crustaces',
    ])
  })

  it('laisse changer de régime et l’effacer, sans toucher aux allergies', () => {
    writeAllergies(db, [{ allergenId: 'gluten' as AllergenId, severite: null }])
    writeDiet(db, 'vegetarien')
    writeDiet(db, 'vegetalien')
    expect(readDiet(db)).toBe('vegetalien')
    writeDiet(db, null)
    expect(readDiet(db)).toBeNull()
    expect(readConstraints(db).allergies).toEqual(['gluten'])
  })
})

describe('user-schema — ce que la migration v13 rend possible, et ce qu’elle protège', () => {
  it('v12 → v13 : les minuteurs d’une cuisson en cours survivent à la migration', () => {
    // Base bloquée à v12, `PRAGMA foreign_keys = ON` — c'est le régime de production
    // (`user-store-node.ts`), et c'est LUI qui fait courir le risque : `DROP TABLE
    // user_cuisine_session` sans détacher l'enfant d'abord exécuterait un DELETE implicite qui
    // déclenche le CASCADE sur `user_cuisine_timer`. Sans ce pragma, ce test passerait quoi qu'il
    // arrive et ne prouverait rien.
    const sqlite = new DatabaseSync(':memory:')
    sqlite.exec('PRAGMA foreign_keys = ON')
    const brute: UserDb = {
      all: <T,>(sql: string, params: readonly (string | number | null)[] = []) =>
        sqlite.prepare(sql).all(...params) as unknown as readonly T[],
      run: (sql: string, params: readonly (string | number | null)[] = []) => {
        sqlite.prepare(sql).run(...params)
      },
    }
    for (const migration of MIGRATIONS.filter((m) => m.version <= 12)) {
      readSchemaVersion(brute) // bootstrappe app_meta au premier appel
      for (const sql of migration.statements) brute.run(sql)
      brute.run('UPDATE app_meta SET schema_version = ? WHERE id = 1', [migration.version])
    }
    expect(readSchemaVersion(brute)).toBe(12)

    brute.run(
      'INSERT INTO user_cuisine_session (id, recette_id, ordre_courant, ouverte_le, portions) VALUES (1, ?, 3, ?, 6)',
      ['chakchouka', 1_770_000_000_000]
    )
    // Un minuteur en marche (échéance posée, aucun reste), un en pause (reste posé, aucune échéance).
    brute.run(
      'INSERT INTO user_cuisine_timer (session_id, ordre, fin_ms, pause_restant_s) VALUES (1, 2, ?, NULL)',
      [1_770_000_600_000]
    )
    brute.run(
      'INSERT INTO user_cuisine_timer (session_id, ordre, fin_ms, pause_restant_s) VALUES (1, 3, NULL, 120)'
    )

    expect(() => migrate(brute)).not.toThrow()
    expect(readSchemaVersion(brute)).toBe(USER_SCHEMA_VERSION)

    const session = brute.all<{
      readonly recette_id: string
      readonly ordre_courant: number
      readonly ouverte_le: number
      readonly portions: number
    }>('SELECT recette_id, ordre_courant, ouverte_le, portions FROM user_cuisine_session WHERE id = 1')[0]
    expect(session?.recette_id).toBe('chakchouka')
    expect(session?.ordre_courant).toBe(3)
    expect(session?.ouverte_le).toBe(1_770_000_000_000)
    expect(session?.portions).toBe(6)

    const minuteurs = brute
      .all<{
        readonly ordre: number
        readonly fin_ms: number | null
        readonly pause_restant_s: number | null
      }>('SELECT ordre, fin_ms, pause_restant_s FROM user_cuisine_timer ORDER BY ordre')
    expect(minuteurs).toEqual([
      { ordre: 2, fin_ms: 1_770_000_600_000, pause_restant_s: null },
      { ordre: 3, fin_ms: null, pause_restant_s: 120 },
    ])
  })

  it('le CHECK (id = 1) a sauté : deux cuissons coexistent', () => {
    db.run(
      'INSERT INTO user_cuisine_session (id, recette_id, ordre_courant, ouverte_le) VALUES (1, ?, 1, 0)',
      ['chakchouka']
    )
    db.run(
      'INSERT INTO user_cuisine_session (id, recette_id, ordre_courant, ouverte_le) VALUES (2, ?, 1, 0)',
      ['omelette_fines_herbes']
    )
    const lignes = db.all<{ readonly n: number }>('SELECT COUNT(*) AS n FROM user_cuisine_session')
    expect(lignes[0]?.n).toBe(2)
  })

  it('la même recette deux fois est refusée par la forme', () => {
    db.run(
      'INSERT INTO user_cuisine_session (id, recette_id, ordre_courant, ouverte_le) VALUES (1, ?, 1, 0)',
      ['chakchouka']
    )
    expect(() =>
      db.run(
        'INSERT INTO user_cuisine_session (id, recette_id, ordre_courant, ouverte_le) VALUES (2, ?, 1, 0)',
        ['chakchouka']
      )
    ).toThrow()
  })

  it('un minuteur sans session_id est refusé — le DEFAULT 1 a été retiré', () => {
    db.run(
      'INSERT INTO user_cuisine_session (id, recette_id, ordre_courant, ouverte_le) VALUES (1, ?, 1, 0)',
      ['chakchouka']
    )
    expect(() =>
      db.run('INSERT INTO user_cuisine_timer (ordre, fin_ms, pause_restant_s) VALUES (1, 1, NULL)')
    ).toThrow()
  })

  it('la cascade fonctionne toujours après la reconstruction des tables, et seulement sur ses minuteurs', () => {
    db.run(
      'INSERT INTO user_cuisine_session (id, recette_id, ordre_courant, ouverte_le) VALUES (1, ?, 1, 0)',
      ['chakchouka']
    )
    db.run(
      'INSERT INTO user_cuisine_session (id, recette_id, ordre_courant, ouverte_le) VALUES (2, ?, 1, 0)',
      ['omelette_fines_herbes']
    )
    db.run('INSERT INTO user_cuisine_timer (session_id, ordre, fin_ms, pause_restant_s) VALUES (1, 1, NULL, 60)')
    db.run('INSERT INTO user_cuisine_timer (session_id, ordre, fin_ms, pause_restant_s) VALUES (2, 1, NULL, 60)')

    db.run('DELETE FROM user_cuisine_session WHERE id = 1')

    const restants = db.all<{ readonly session_id: number }>('SELECT session_id FROM user_cuisine_timer')
    expect(restants).toEqual([{ session_id: 2 }])
  })

  it('l’heure de service est unique par construction, et acceptée nulle', () => {
    db.run('INSERT INTO user_cuisine_service (id, heure_service_ms) VALUES (1, NULL)')
    expect(() => db.run('INSERT INTO user_cuisine_service (id, heure_service_ms) VALUES (2, 1000)')).toThrow()

    db.run('UPDATE user_cuisine_service SET heure_service_ms = ? WHERE id = 1', [72_000_000])
    const ligne = db.all<{ readonly heure_service_ms: number | null }>(
      'SELECT heure_service_ms FROM user_cuisine_service WHERE id = 1'
    )[0]
    expect(ligne?.heure_service_ms).toBe(72_000_000)
  })
})
