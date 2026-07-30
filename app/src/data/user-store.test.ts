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
} from '../engine/domain/index.js'
import { openUserDb, type OpenedUserDb } from './user-store-node.js'
import type { UserDb } from './user-db.js'
import { MIGRATIONS, USER_SCHEMA_VERSION, migrate, readSchemaVersion } from './user-schema.js'
import {
  readActiveTopics,
  readAllergies,
  readConstraints,
  readDiet,
  readExcludedFoodIds,
  readFavorites,
  readHistory,
  readPantryFoodIds,
  readPreferences,
  readProfile,
  readLatestPlan,
  readPlan,
  readUserState,
  savePlan,
  recordMeal,
  setFavorite,
  writeActiveTopics,
  writeAllergies,
  writeDiet,
  writeExcludedFoodIds,
  writePantry,
  writePreference,
  writeProfile,
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
    writePantry(db, [{ foodId: 'farine_ble' as FoodId, quantiteApprox: 'un fond de paquet' }])
    expect(readPantryFoodIds(db)).toEqual(['farine_ble'])
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
    writePantry(db, [{ foodId: 'farine_ble' as FoodId, quantiteApprox: null }])

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
        portions: 4,
        locked: true,
        isLeftover: false,
        service: null,
      },
      {
        slot: { date: '2026-08-04', creneau: 'diner' },
        recipeId: 'r2' as RecipeId,
        portions: 2,
        locked: false,
        isLeftover: true,
        service: null,
      },
      {
        slot: { date: '2026-08-05', creneau: 'diner' },
        recipeId: null,
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
    savePlan(db, plan)
    expect(readPlan(db, plan.id)).toEqual(plan)
  })

  it('REMPLACE le plan précédent au lieu d’accumuler ses créneaux', () => {
    // Un plan raccourci de 3 à 2 jours garderait sinon le créneau du 3ᵉ jour, invisible à l'écran
    // mais bien présent dans la liste de courses.
    savePlan(db, plan)
    savePlan(db, { ...plan, days: 2, entries: plan.entries.slice(0, 2) })
    expect(readPlan(db, plan.id)?.entries).toHaveLength(2)
  })

  it('rend les créneaux dans l’ordre des repas, pas dans l’ordre alphabétique', () => {
    // 'dejeuner' < 'petit_dejeuner' en alphabétique : trier sur la colonne mettrait le déjeuner
    // avant le petit-déjeuner.
    const creneaux: readonly MealSlot[] = ['diner', 'petit_dejeuner', 'gouter', 'dejeuner']
    savePlan(db, {
      ...plan,
      days: 2,
      entries: creneaux.map((creneau) => ({
        slot: { date: '2026-08-03', creneau },
        recipeId: `r-${creneau}` as RecipeId,
        portions: 1,
        locked: false,
        isLeftover: false,
        service: null,
      })),
    })
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
    savePlan(db, { ...plan, warnings: [{ kind: 'plancher_calorique', date: '2026-08-03', kcal: 900, seuil: 1200 }] })
    expect(readPlan(db, plan.id)?.warnings).toEqual([])
  })

  it('rend le plan le plus récent par date de début', () => {
    savePlan(db, plan)
    savePlan(db, { ...plan, id: 'plan-2026-09-01-3', startDate: '2026-09-01' })
    expect(readLatestPlan(db)?.startDate).toBe('2026-09-01')
  })

  it('refuse un plan d’avant la migration v2 plutôt que d’afficher zéro jour', () => {
    db.run(`INSERT INTO meal_plan (id, date_debut, jours, seed) VALUES ('vieux', '2026-08-03', 0, 0)`)
    expect(readPlan(db, 'vieux')).toBeNull()
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
