// engine/api/index.test.ts — createEngine + suggestMeals (docs/ENGINE.md §8, §6.4).
//
// Deux groupes de fixtures :
//   1. Les helpers `food`/`recipeWithOneIngredient`/`makeCatalog` d'origine — pour les cas
//      "createEngine expose bien le registre / les méthodes non câblées" qui n'exercent pas
//      `suggestMeals`.
//   2. Un fixture DÉDIÉ « fer » (`makeFerFixture`) pour `suggestMeals` bout-en-bout : trois
//      recettes qui ne diffèrent QUE par leur teneur en fer, un seul nutriment au catalogue —
//      choisi pour que le score `nutri` soit calculable À LA MAIN (voir le détail sous chaque
//      test), sans dépendre de la mécanique interne de `scoreNutri` pour vérifier son propre
//      résultat.

import { describe, expect, it } from 'vitest'
import type {
  Catalog,
  CatalogIndexes,
  Food,
  FoodId,
  Nutrient,
  NutrientId,
  Recipe,
  RecipeId,
  ScoreWeights,
  SuggestionRequest,
} from '../domain/index.js'
import { NoViableRecipeError, g, min } from '../domain/index.js'
import { LAYER_DESCRIPTORS, nutriLayer } from '../selection/index.js'
import { createEngine } from './index.js'

// ------------------------------------------------------------------------------------------
// Fixtures d'origine — createEngine « nu » (registre, version, méthodes non câblées).
// ------------------------------------------------------------------------------------------

function food(id: string, kcalPer100g: number): Food {
  return {
    id: id as FoodId,
    codeCiqual: `TEST-${id}`,
    nom: id,
    groupe: 'test',
    nutrimentsPour100g: new Map([['kcal' as NutrientId, kcalPer100g]]),
    allergenes: [],
    saisonMois: [],
    touteAnnee: true,
  }
}

function recipeWithOneIngredient(id: string, foodId: string): Recipe {
  return {
    id: id as RecipeId,
    nom: id,
    description: '',
    tempsPrepMin: min(10),
    tempsCuissonMin: min(10),
    difficulte: 1,
    portionsBase: 2,
    imagePath: null,
    typesRepas: ['diner'],
    saisonMois: [],
    envergure: 'quotidien',
    conservationJours: 1,
    axes: { sucreSale: 0, legerConsistant: 0, chaudFroid: 0, texture: 'test' },
    ingredients: [{ foodId: foodId as FoodId, quantiteG: g(200), uniteAffichage: 'g', optionnel: false }],
    etapes: [],
    facettes: [],
  }
}

const EMPTY_INDEXES: CatalogIndexes = {
  recipesByAllergen: new Map(),
  recipesByDiet: new Map(),
  recipesBySlot: new Map(),
  recipeNutrients: new Map(),
  recipeMainIngredient: new Map(),
}

function makeCatalog(): Catalog {
  const kcal: Nutrient = { id: 'kcal' as NutrientId, code: 'kcal', nom: 'Énergie', unite: 'kcal', vnrAdulte: null, categorie: null, sens: 'cible' }
  const oeuf = food('oeuf', 100)
  const omelette = recipeWithOneIngredient('omelette', 'oeuf')

  return {
    version: 'catalog-test-1.2.3',
    foods: new Map([[oeuf.id, oeuf]]),
    recipes: new Map([[omelette.id, omelette]]),
    nutrients: [kcal],
    allergens: new Map(),
    lexicon: new Map(),
    topics: new Map(),
    substitutions: new Map(),
    indexes: EMPTY_INDEXES,
  }
}

describe('engine/api — createEngine (§8 ENGINE)', () => {
  it('expose version (moteur) et catalogVersion (celle du catalogue reçu)', () => {
    const catalog = makeCatalog()
    const engine = createEngine(catalog)

    expect(typeof engine.version).toBe('string')
    expect(engine.version.length).toBeGreaterThan(0)
    expect(engine.catalogVersion).toBe('catalog-test-1.2.3')
  })

  it('layers expose les 17 descripteurs du registre (LAYER_DESCRIPTORS)', () => {
    const engine = createEngine(makeCatalog())
    expect(engine.layers).toBe(LAYER_DESCRIPTORS)
    expect(engine.layers).toHaveLength(17)
  })

  it("layer('nutri') retourne la couche implémentée correspondante", () => {
    const engine = createEngine(makeCatalog())
    expect(engine.layer('nutri')).toBe(nutriLayer)
  })

  it("layer('allergenes') retourne aussi une couche d'exclusion implémentée (pas seulement le score)", () => {
    const engine = createEngine(makeCatalog())
    expect(engine.layer('allergenes').kind).toBe('exclusion')
    expect(engine.layer('allergenes').critical).toBe(true)
  })

  it("layer('pantry') lève une erreur explicite (déclarée au registre, pas encore implémentée)", () => {
    const engine = createEngine(makeCatalog())
    expect(() => engine.layer('pantry')).toThrow(/pantry/)
    expect(() => engine.layer('pantry')).toThrow(/pas encore/)
  })

  it.each(['occasion', 'topic', 'cost'] as const)("layer('%s') lève aussi une erreur explicite", (id) => {
    const engine = createEngine(makeCatalog())
    expect(() => engine.layer(id)).toThrow()
  })

  it("layer(id) sur un id inconnu du registre lève une erreur distincte de « pas encore implémenté »", () => {
    const engine = createEngine(makeCatalog())
    expect(() => engine.layer('inconnu' as never)).toThrow(/inconnu/)
  })

  it('les méthodes de planification restantes (planning/, non câblé) lèvent explicitement « non implémenté (P1c) »', () => {
    const engine = createEngine(makeCatalog())
    expect(() => engine.planWeek({} as never)).toThrow(/non implémenté \(P1c\)/)
    expect(() => engine.scaleRecipe('omelette' as RecipeId, 4)).toThrow(/non implémenté \(P1c\)/)
    expect(() => engine.rerollSlot({} as never, {} as never)).toThrow(/non implémenté \(P1c\)/)
  })
})

// ------------------------------------------------------------------------------------------
// Fixture « fer » — dédiée à suggestMeals bout-en-bout. Un seul nutriment au catalogue (fer,
// `sens: 'plancher'`, `vnrAdulte: 10`), trois recettes qui ne diffèrent QUE par leur teneur en
// fer par portion. Avec `MEAL_SLOT_SHARE.diner = 0.3` (scoring/nutri.ts) et un profil sans
// taille/poids (mode VNR à plat, energy-needs.ts retourne `null`), la cible est EXACTEMENT
// `10 × 0.3 = 3` mg. Chaque recette a un seul ingrédient de 200 g pour 2 portions
// (`portionsBase: 2`) : le facteur (200 / 100) / 2 = 1 fait que le fer « par portion » est
// numériquement identique au fer « pour 100 g » de l'aliment — chiffres ronds, choisis pour ça.
//
//   riche  : 12 mg/100g → 12 mg/portion → au-dessus de la cible (3)  → déviation 0    → score 1.0
//   moyen  : 1.5 mg/100g → 1.5 mg/portion → en dessous de la cible   → déviation 0.5  → score 0.5
//   pauvre : 0 mg/100g  → 0 mg/portion → en dessous, écart maximal   → déviation 1    → score 0.0
//
// (`deviationFor('plancher', v, cible) = max(0, cible - v) / cible`, clampé à 1 — voir
// selection/scoring/nutri.ts.)
// ------------------------------------------------------------------------------------------

const FER_ID = 'fer' as NutrientId
const FER_NUTRIENT: Nutrient = {
  id: FER_ID,
  code: 'fer',
  nom: 'Fer',
  unite: 'mg',
  vnrAdulte: 10,
  categorie: 'mineral',
  sens: 'plancher',
}

function ferFood(id: string, ferPer100g: number): Food {
  return {
    id: id as FoodId,
    codeCiqual: `TEST-${id}`,
    nom: id,
    groupe: 'test',
    nutrimentsPour100g: new Map([[FER_ID, ferPer100g]]),
    allergenes: [],
    saisonMois: [],
    touteAnnee: true,
  }
}

/** 10 + 10 = 20 min au total sur les trois recettes du fixture — assez pour être écartées par
 * `temps` dans le test « 0 candidat » (`tempsDisponibleMin: 5`), sans jamais gêner les autres
 * tests (aucun n'impose de contrainte de temps). */
function ferRecipe(id: string, foodId: string): Recipe {
  return {
    id: id as RecipeId,
    nom: id,
    description: '',
    tempsPrepMin: min(10),
    tempsCuissonMin: min(10),
    difficulte: 1,
    portionsBase: 2,
    imagePath: null,
    typesRepas: ['diner'],
    saisonMois: [],
    envergure: 'quotidien',
    conservationJours: 1,
    // Axes identiques sur les trois recettes : élimine tout signal de similarité autre que
    // « même ingrédient principal » (toujours faux ici, les trois foods diffèrent) — le rang
    // par score domine largement la pénalité MMR (voir le commentaire du premier test).
    axes: { sucreSale: 0, legerConsistant: 0, chaudFroid: 0, texture: 'test' },
    ingredients: [{ foodId: foodId as FoodId, quantiteG: g(200), uniteAffichage: 'g', optionnel: false }],
    etapes: [],
    facettes: [],
  }
}

interface FerFixture {
  readonly catalog: Catalog
  readonly riche: Recipe
  readonly moyen: Recipe
  readonly pauvre: Recipe
}

function makeFerFixture(): FerFixture {
  const foodRiche = ferFood('food_riche', 12)
  const foodMoyen = ferFood('food_moyen', 1.5)
  const foodPauvre = ferFood('food_pauvre', 0)

  const riche = ferRecipe('plat_riche', foodRiche.id)
  const moyen = ferRecipe('plat_moyen', foodMoyen.id)
  const pauvre = ferRecipe('plat_pauvre', foodPauvre.id)

  const recipes = new Map([riche, moyen, pauvre].map((r) => [r.id, r]))
  const foods = new Map([foodRiche, foodMoyen, foodPauvre].map((f) => [f.id, f]))

  const indexes: CatalogIndexes = {
    ...EMPTY_INDEXES,
    recipesBySlot: new Map([['diner', new Set([riche.id, moyen.id, pauvre.id])]]),
  }

  const catalog: Catalog = {
    version: 'fer-fixture-1',
    foods,
    recipes,
    nutrients: [FER_NUTRIENT],
    allergens: new Map(),
    lexicon: new Map(),
    topics: new Map(),
    substitutions: new Map(),
    indexes,
  }

  return { catalog, riche, moyen, pauvre }
}

/** Isole `nutri` comme seule couche de score active — les 6 autres couches implémentées à 0. */
const ISOLATE_NUTRI_WEIGHTS: Partial<ScoreWeights> = {
  nutri: 1,
  preference: 0,
  craving: 0,
  variety: 0,
  season: 0,
  habit: 0,
  speed: 0,
}

function ferRequest(
  overrides: {
    readonly weights?: Partial<ScoreWeights>
    readonly limit?: number
    readonly excludedFoodIds?: readonly FoodId[]
    readonly tempsDisponibleMin?: number | null
    readonly skipDiversification?: boolean
  } = {}
): SuggestionRequest {
  return {
    profile: { trancheAge: '30_49', sexe: 'NP', tailleCm: null, poidsKg: null, niveauActivite: 'sedentaire', facteurPortion: 1 },
    constraints: { allergies: [], diet: null, excludedFoodIds: overrides.excludedFoodIds ?? [] },
    context: {
      creneau: 'diner',
      date: '2026-07-23',
      tempsDisponibleMin: overrides.tempsDisponibleMin == null ? null : min(overrides.tempsDisponibleMin),
      envie: null,
      pantryFoodIds: [],
      requiredFoodIds: [],
    },
    history: { windowDays: 21, entries: [] },
    preferences: new Map(),
    activeTopics: [],
    seed: 1,
    // `exactOptionalPropertyTypes` (tsconfig) distingue « absente » d'« explicitement `undefined` »
    // pour un champ optionnel : n'inclure ces clés QUE quand une valeur est réellement fournie,
    // pour laisser `suggestMeals` appliquer ses propres défauts (poids de référence, limite 5,
    // diversification active) exactement comme un appelant qui ne les précise pas.
    ...(overrides.weights !== undefined ? { weights: overrides.weights } : {}),
    ...(overrides.limit !== undefined ? { limit: overrides.limit } : {}),
    ...(overrides.skipDiversification !== undefined ? { skipDiversification: overrides.skipDiversification } : {}),
  }
}

describe('engine/api — suggestMeals bout-en-bout (§6.4, §8 ENGINE)', () => {
  it('enchaînement complet : n suggestions, triées par score, chacune avec son breakdown et ses explications', () => {
    const { catalog, riche, moyen, pauvre } = makeFerFixture()
    const engine = createEngine(catalog)

    const result = engine.suggestMeals(ferRequest({ weights: ISOLATE_NUTRI_WEIGHTS }))

    expect(result.suggestions.map((s) => s.recipeId)).toEqual([riche.id, moyen.id, pauvre.id])
    expect(result.suggestions.map((s) => s.score)).toEqual([100, 50, 0])

    for (const suggestion of result.suggestions) {
      // nutri est la SEULE couche active (poids normalisé = 1) : sa contribution = le score final.
      expect(suggestion.breakdown.nutri).toBeCloseTo(suggestion.score / 100, 9)
      expect(suggestion.explanations.length).toBeGreaterThan(0)
      expect(suggestion.explanations[0]?.criterion).toBe('nutri')
      expect(suggestion.portions).toBe(2) // recipe.portionsBase, jamais mis à l'échelle ici
      expect(suggestion.nutrition.perPortion).toHaveLength(1)
    }
    expect(result.suggestions.find((s) => s.recipeId === riche.id)?.nutrition.perPortion[0]).toBeCloseTo(12, 9)
    expect(result.suggestions.find((s) => s.recipeId === pauvre.id)?.nutrition.perPortion[0]).toBeCloseTo(0, 9)
  })

  it('limit est respecté', () => {
    const { catalog, riche, moyen } = makeFerFixture()
    const engine = createEngine(catalog)

    const result = engine.suggestMeals(ferRequest({ weights: ISOLATE_NUTRI_WEIGHTS, limit: 2 }))

    expect(result.suggestions).toHaveLength(2)
    expect(result.suggestions.map((s) => s.recipeId)).toEqual([riche.id, moyen.id])
  })

  it('limite supérieure au nombre de candidats → tout, sans erreur', () => {
    const { catalog, riche, moyen, pauvre } = makeFerFixture()
    const engine = createEngine(catalog)

    const result = engine.suggestMeals(ferRequest({ weights: ISOLATE_NUTRI_WEIGHTS, limit: 10 }))

    expect(result.suggestions).toHaveLength(3)
    expect(result.suggestions.map((s) => s.recipeId).sort()).toEqual([riche.id, moyen.id, pauvre.id].sort())
  })

  it('0 candidat après exclusion (temps insuffisant pour toutes les recettes) → NoViableRecipeError portant le motif dominant', () => {
    const { catalog } = makeFerFixture()
    const engine = createEngine(catalog)
    // Les 3 recettes du fixture ont 10+10 = 20 min — 5 min disponibles les écarte toutes via `temps`.
    const req = ferRequest({ weights: ISOLATE_NUTRI_WEIGHTS, tempsDisponibleMin: 5 })

    expect(() => engine.suggestMeals(req)).toThrow(NoViableRecipeError)
    expect(() => engine.suggestMeals(req)).toThrow(/temps/)

    let caught: unknown
    try {
      engine.suggestMeals(req)
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(NoViableRecipeError)
    const nve = caught as NoViableRecipeError
    expect(nve.rejected.totalInitial).toBe(3)
    expect(nve.rejected.totalRejected).toBe(3)
    expect(nve.rejected.byLayer.get('temps')).toBe(3)
  })

  it("RejectionSummary : les comptages par couche correspondent à ce que la passe d'exclusion a réellement écarté", () => {
    const { catalog, riche, moyen, pauvre } = makeFerFixture()
    const engine = createEngine(catalog)

    const result = engine.suggestMeals(
      ferRequest({ weights: ISOLATE_NUTRI_WEIGHTS, excludedFoodIds: ['food_pauvre' as FoodId] })
    )

    expect(result.rejected.totalInitial).toBe(3)
    expect(result.rejected.totalRejected).toBe(1)
    expect(result.rejected.byLayer.get('exclusions')).toBe(1)
    expect(result.rejected.entries).toHaveLength(1)
    expect(result.rejected.entries[0]?.recipeId).toBe(pauvre.id)
    expect(result.rejected.entries[0]?.layerId).toBe('exclusions')
    expect(result.suggestions.map((s) => s.recipeId).sort()).toEqual([riche.id, moyen.id].sort())
  })

  it('EngineDiagnostics.weights est complet : les 11 ScoringLayerId, zéros compris pour les couches non implémentées', () => {
    const { catalog } = makeFerFixture()
    const engine = createEngine(catalog)

    // Pas de `weights` explicite ici : résolution normale (defaultWeight/archétype), pour
    // vérifier que la complétion à zéro s'applique aussi bien aux couches jamais actives
    // (`pantry`/`occasion`/`topic`/`cost`) qu'à celles simplement inactives par défaut (`habit`,
    // `speed`).
    const result = engine.suggestMeals(ferRequest())

    const keys = Object.keys(result.diagnostics.weights).sort()
    expect(keys).toEqual(
      ['nutri', 'preference', 'craving', 'variety', 'season', 'pantry', 'habit', 'occasion', 'speed', 'topic', 'cost'].sort()
    )
    // Jamais implémentées (P2/v2/v3) : forcément à zéro, quel que soit le reste de la requête.
    expect(result.diagnostics.weights.pantry).toBe(0)
    expect(result.diagnostics.weights.occasion).toBe(0)
    expect(result.diagnostics.weights.topic).toBe(0)
    expect(result.diagnostics.weights.cost).toBe(0)
    // Implémentées mais inactives par défaut (démarrage à froid / hors archétype "rapide").
    expect(result.diagnostics.weights.habit).toBe(0)
    expect(result.diagnostics.weights.speed).toBe(0)
    // Actives par défaut (poids de référence, §6.5 ENGINE).
    expect(result.diagnostics.weights.nutri).toBeGreaterThan(0)
    expect(result.diagnostics.weights.preference).toBeGreaterThan(0)
    expect(result.diagnostics.weights.craving).toBeGreaterThan(0)
    expect(result.diagnostics.weights.variety).toBeGreaterThan(0)
    expect(result.diagnostics.weights.season).toBeGreaterThan(0)
  })

  it('déterminisme : deux appels identiques donnent un résultat identique', () => {
    const { catalog } = makeFerFixture()
    const engine = createEngine(catalog)
    const req = ferRequest({ weights: ISOLATE_NUTRI_WEIGHTS })

    const first = engine.suggestMeals(req)
    const second = engine.suggestMeals(req)

    expect(second).toEqual(first)
  })

  it('dureeMs vaut 0 sans horloge injectée à createEngine', () => {
    const { catalog } = makeFerFixture()
    const engine = createEngine(catalog)

    const result = engine.suggestMeals(ferRequest({ weights: ISOLATE_NUTRI_WEIGHTS }))

    expect(result.diagnostics.dureeMs).toBe(0)
  })

  it("dureeMs mesure l'écart via l'horloge de test injectée à createEngine", () => {
    const { catalog } = makeFerFixture()
    const ticks = [1_000, 1_042]
    let call = 0
    const engine = createEngine(catalog, { now: () => ticks[call++]! })

    const result = engine.suggestMeals(ferRequest({ weights: ISOLATE_NUTRI_WEIGHTS }))

    expect(result.diagnostics.dureeMs).toBe(42)
  })
})

// ------------------------------------------------------------------------------------------
// createEngine appelle réellement attachDerivedIndexes — test de COMPORTEMENT (pas `vi.spyOn`,
// seul mock qu'avait le dépôt jusqu'ici). L'appel a maintenant un effet observable :
// `suggestMeals` fait discriminer `nutri` selon la teneur en fer réelle des recettes — ce qui
// n'est possible QUE si `catalog.indexes.recipeNutrients` a bien été peuplé en interne, alors que
// le catalogue REÇU par `createEngine` porte cet index vide.
// ------------------------------------------------------------------------------------------

describe('engine/api — createEngine appelle réellement attachDerivedIndexes (comportement)', () => {
  it('une suggestion dont le score `nutri` dépend du contenu réel du catalogue prouve que les index dérivés ont été peuplés', () => {
    const { catalog } = makeFerFixture()
    // Précondition : le catalogue passé à createEngine porte des index dérivés VIDES. Si
    // createEngine n'appelait pas attachDerivedIndexes, `nutri` ne pourrait lire aucun vecteur
    // nutritionnel et rendrait NEUTRAL_SCORE (0.5) identiquement pour les trois recettes.
    expect(catalog.indexes.recipeNutrients.size).toBe(0)

    const engine = createEngine(catalog)
    const result = engine.suggestMeals(ferRequest({ weights: ISOLATE_NUTRI_WEIGHTS }))

    const scores = result.suggestions.map((s) => s.score)
    expect(new Set(scores).size).toBe(3) // trois scores DISTINCTS : le signal réel a discriminé
    expect(scores).toEqual([100, 50, 0])
  })
})
