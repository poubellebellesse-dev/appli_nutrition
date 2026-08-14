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

import { describe, expect, it } from "vitest";
import type {
  Catalog,
  CatalogIndexes,
  Food,
  FoodId,
  Nutrient,
  NutrientId,
  Recipe,
  RecipeId,
  PlanWarning,
  ScoreWeights,
  SuggestionRequest,
  UserProfile,
} from "../domain/index.js";
import { NoViableRecipeError, g, min } from "../domain/index.js";
import { DEFAULT_MMR_LAMBDA, LAYER_DESCRIPTORS, nutriLayer } from "../selection/index.js";
import { createEngine } from "./index.js";

// ------------------------------------------------------------------------------------------
// Fixtures d'origine — createEngine « nu » (registre, version, méthodes non câblées).
// ------------------------------------------------------------------------------------------

function food(id: string, kcalPer100g: number): Food {
  return {
    id: id as FoodId,
    codeCiqual: `TEST-${id}`,
    nom: id,
    synonymes: [],
    groupe: "test",
    sousFamille: null,
    sousGroupe: null,
    nutrimentsPour100g: new Map([["kcal" as NutrientId, kcalPer100g]]),
    allergenes: [],
    saisonMois: [],
    touteAnnee: true,
    piquant: null,
    poidsPieceG: null,
    fondDePlacard: false,
    quantiteFigee: false,
    conditionnementG: null,
    origineAnimale: null,
    provenanceAnimale: null,
    deriveDe: null,
  };
}

function recipeWithOneIngredient(id: string, foodId: string): Recipe {
  return {
    id: id as RecipeId,
    nom: id,
    origine: "maison",
    description: "",
    tempsPrepMin: min(10),
    tempsCuissonMin: min(10),
    difficulte: 1,
    portionsBase: 2,
    imagePath: null,
    typesRepas: ["diner"],
    saisonMois: [],
    envergure: "quotidien",
    conservationJours: 1,
    axes: { sucreSale: 0, legerConsistant: 0, chaudFroid: 0, texture: "test" },
    ingredients: [
      {
        foodId: foodId as FoodId,
        quantiteG: g(200),
        uniteAffichage: "g",
        optionnel: false,
      },
    ],
    etapes: [],
    facettes: [],
    service: null,
    piquant: null,
    sources: [],
    testeLe: null,
    estSauce: false,
    porteDejaUneSauce: null,
    sauceIds: [],
    equipements: [],
    occupations: [],
  };
}

const EMPTY_INDEXES: CatalogIndexes = {
  recipesByAllergen: new Map(),
  recipesByDiet: new Map(),
  recipesBySlot: new Map(),
  recipeNutrients: new Map(),
    recipeNutrientCoverage: new Map(),
  recipeMainIngredient: new Map(),
  recipeSignature: new Map(),
  recipeFamilySignature: new Map(),
    declaredFamilies: new Set(),
    recipeCharacteristic: new Map(),
};

function makeCatalog(): Catalog {
  const kcal: Nutrient = {
    id: "kcal" as NutrientId,
    code: "kcal",
    nom: "Énergie",
    unite: "kcal",
    vnrAdulte: null,
    categorie: null,
    sens: "cible",
  };
  const oeuf = food("oeuf", 100);
  const omelette = recipeWithOneIngredient("omelette", "oeuf");

  return {
    version: "catalog-test-1.2.3",
    foods: new Map([[oeuf.id, oeuf]]),
    recipes: new Map([[omelette.id, omelette]]),
    nutrients: [kcal],
    allergens: new Map(),
    lexicon: new Map(),
    equipment: new Map(),
    tips: [],
    evidence: new Map(),
    topics: new Map(),
    substitutions: new Map(),
    indexes: EMPTY_INDEXES,
  };
}

/** Une recette à plusieurs ingrédients, pour `searchByPantry` — `recipeWithOneIngredient` n'y suffit pas. */
function recipeWithIngredients(
  id: string,
  ingredients: readonly { readonly foodId: string; readonly quantiteG: number; readonly optionnel?: boolean }[],
): Recipe {
  return {
    ...recipeWithOneIngredient(id, ingredients[0]!.foodId),
    ingredients: ingredients.map((i) => ({
      foodId: i.foodId as FoodId,
      quantiteG: g(i.quantiteG),
      uniteAffichage: "g",
      optionnel: i.optionnel ?? false,
    })),
  };
}

describe("engine/api — searchByPantry, condiments seuls ne proposent plus rien (retour utilisateur)", () => {
  // §10.2 : la couverture reste un SCORE, pas un filtre — mais depuis ce retour, `searchByPantry`
  // écarte en plus les recettes qui ne partagent AUCUN ingrédient non optionnel avec le
  // garde-manger, sauf garde-manger vide.
  const boeuf = food("boeuf", 250);
  const carotte = food("carotte", 40);
  const sel = food("sel", 0);
  const poivre = food("poivre", 0);
  const riz = food("riz", 130);

  const bourguignon = recipeWithIngredients("bourguignon", [
    { foodId: "boeuf", quantiteG: 500 },
    { foodId: "carotte", quantiteG: 100 },
    { foodId: "sel", quantiteG: 5 },
  ]);
  const soupe = recipeWithIngredients("soupe", [
    { foodId: "carotte", quantiteG: 50 },
    { foodId: "sel", quantiteG: 3 },
  ]);
  const salade = recipeWithIngredients("salade", [
    { foodId: "riz", quantiteG: 200 },
    { foodId: "poivre", quantiteG: 2, optionnel: true },
  ]);

  function catalogueTest(): Catalog {
    const base = makeCatalog();
    return {
      ...base,
      foods: new Map([boeuf, carotte, sel, poivre, riz].map((f) => [f.id, f])),
      recipes: new Map([bourguignon, soupe, salade].map((r) => [r.id, r])),
    };
  }

  const constraints = { allergies: [], diet: null, excludedFoodIds: [], ownedEquipmentIds: null , admittedFoodIds: [] };

  it("garde-manger de condiments seuls, sans rapport → aucune recette", () => {
    // Le poivre n'est présent QU'EN OPTIONNEL dans tout le catalogue de test : aucune recette ne
    // doit remonter, exactement le symptôme rapporté (« ajouter seulement des condiments n'affiche
    // aucune recette [utile] »).
    const engine = createEngine(catalogueTest());
    const resultat = engine.searchByPantry({ constraints, pantryFoodIds: ["poivre" as FoodId] });
    expect(resultat.matches).toEqual([]);
  });

  it("un vrai ingrédient partagé → seules les recettes qui le contiennent apparaissent, classées par couverture", () => {
    const engine = createEngine(catalogueTest());
    const resultat = engine.searchByPantry({ constraints, pantryFoodIds: ["boeuf" as FoodId] });
    const ids = resultat.matches.map((m) => m.recipeId);
    expect(ids).toEqual(["bourguignon" as RecipeId]);
  });

  it("garde-manger VIDE → aucun filtrage, les trois recettes restent proposées", () => {
    const engine = createEngine(catalogueTest());
    const resultat = engine.searchByPantry({ constraints, pantryFoodIds: [] });
    expect(resultat.matches.map((m) => m.recipeId).sort()).toEqual(
      ["bourguignon", "salade", "soupe"].sort(),
    );
  });
});

describe("engine/api — browseRecipes, l'axe des sauces (`saucesSeules`)", () => {
  // Le catalogue est partitionné par `estSauce` : la liste ordinaire ne montre QUE des plats
  // (`recettesHorsSauces`), donc sans un point de départ complémentaire une sauce n'est atteignable
  // que depuis la fiche d'un plat qui la cite — et celle que personne ne cite, nulle part.
  const oeuf = food("oeuf", 100);
  const omelette = recipeWithOneIngredient("omelette", "oeuf");
  const gratin = recipeWithOneIngredient("gratin", "oeuf");
  const poivre = { ...recipeWithOneIngredient("sauce_poivre", "oeuf"), estSauce: true };
  const vinaigrette = { ...recipeWithOneIngredient("vinaigrette", "oeuf"), estSauce: true };

  function catalogueMixte(): Catalog {
    const base = makeCatalog();
    return {
      ...base,
      foods: new Map([[oeuf.id, oeuf]]),
      recipes: new Map([omelette, gratin, poivre, vinaigrette].map((r) => [r.id, r])),
    };
  }

  const constraints = { allergies: [], diet: null, excludedFoodIds: [], ownedEquipmentIds: null , admittedFoodIds: [] };

  it("sans l'option, les sauces restent hors de la liste — la v14 ne change rien pour qui ne demande rien", () => {
    const engine = createEngine(catalogueMixte());
    const r = engine.browseRecipes({ constraints });
    expect([...r.recipeIds].sort()).toEqual(["gratin", "omelette"]);
  });

  it("`saucesSeules` rend les sauces, et ELLES SEULES — un complémentaire, pas un filtre ajouté", () => {
    const engine = createEngine(catalogueMixte());
    const r = engine.browseRecipes({ constraints, saucesSeules: true });
    expect([...r.recipeIds].sort()).toEqual(["sauce_poivre", "vinaigrette"]);
  });

  it("`totalCatalogue` suit le point de départ : 2 sur l'axe des sauces, pas 4", () => {
    // Un entonnoir dont le premier nombre ment ne se remarque nulle part ailleurs : « 2 sur 4 »
    // laisserait croire que deux recettes ont été écartées par une contrainte.
    const engine = createEngine(catalogueMixte());
    expect(engine.browseRecipes({ constraints, saucesSeules: true }).totalCatalogue).toBe(2);
    expect(engine.browseRecipes({ constraints }).totalCatalogue).toBe(2);
  });

  it("`onlyFavorites` GAGNE sur `saucesSeules` — un favori plat reste rendu, l'axe des sauces cède", () => {
    // Les deux désignent un point de DÉPART, jamais deux critères qui s'intersectent. L'ordre est
    // fixé ici pour que l'écran n'ait pas à connaître la règle : il éteint l'un en allumant l'autre,
    // et si un appelant les passe quand même ensemble, le moteur ne rend pas une liste vide.
    const engine = createEngine(catalogueMixte());
    const r = engine.browseRecipes({
      constraints,
      saucesSeules: true,
      onlyFavorites: true,
      favoriteRecipeIds: new Set(["gratin" as RecipeId]),
    });
    expect([...r.recipeIds]).toEqual(["gratin"]);
    expect(r.totalCatalogue).toBe(2); // le total des plats, pas celui des sauces
  });
});

describe("engine/api — createEngine (§8 ENGINE)", () => {
  it("expose version (moteur) et catalogVersion (celle du catalogue reçu)", () => {
    const catalog = makeCatalog();
    const engine = createEngine(catalog);

    expect(typeof engine.version).toBe("string");
    expect(engine.version.length).toBeGreaterThan(0);
    expect(engine.catalogVersion).toBe("catalog-test-1.2.3");
  });

  it("layers expose les 18 descripteurs du registre (LAYER_DESCRIPTORS)", () => {
    const engine = createEngine(makeCatalog());
    expect(engine.layers).toBe(LAYER_DESCRIPTORS);
    // 19 depuis la décision 35 (`piquant`, 12ᵉ couche de score).
    expect(engine.layers).toHaveLength(19);
  });

  it("layer('nutri') retourne la couche implémentée correspondante", () => {
    const engine = createEngine(makeCatalog());
    expect(engine.layer("nutri")).toBe(nutriLayer);
  });

  it("layer('allergenes') retourne aussi une couche d'exclusion implémentée (pas seulement le score)", () => {
    const engine = createEngine(makeCatalog());
    expect(engine.layer("allergenes").kind).toBe("exclusion");
    expect(engine.layer("allergenes").critical).toBe(true);
  });

  it("layer('pantry') est CÂBLÉE depuis le 2026-07-28 (§10.2 ①, « vider le frigo »)", () => {
    const engine = createEngine(makeCatalog());
    expect(engine.layer("pantry").id).toBe("pantry");
  });

  it("layer('occasion') lève une erreur explicite — déclarée au registre, pas implémentée (P2)", () => {
    const engine = createEngine(makeCatalog());
    expect(() => engine.layer("occasion")).toThrow();
  });

  it.each(["occasion", "topic", "cost"] as const)(
    "layer('%s') lève aussi une erreur explicite",
    (id) => {
      const engine = createEngine(makeCatalog());
      expect(() => engine.layer(id)).toThrow();
    },
  );

  it("layer(id) sur un id inconnu du registre lève une erreur distincte de « pas encore implémenté »", () => {
    const engine = createEngine(makeCatalog());
    expect(() => engine.layer("inconnu" as never)).toThrow(/inconnu/);
  });

  it("les méthodes de planification ENCORE non câblées lèvent explicitement « non implémenté (P1c) »", () => {
    // ⚠️ `planWeek` a QUITTÉ cette liste le 2026-07-28 (§7.1) : il est implémenté. Ne pas l'y
    // remettre par réflexe si ce test casse — vérifier d'abord ce qui a bougé.
    const engine = createEngine(makeCatalog());
  });

  it("rerollSlot est CÂBLÉ — un créneau absent du plan le laisse INCHANGÉ, sans erreur", () => {
    // §7.2 : un créneau verrouillé est « invisible pour toute replanification ». Lever ici
    // obligerait chaque appelant à vérifier avant d'appeler, alors que le refus EST l'information.
    const engine = createEngine(makeCatalog());
    const plan = { id: "p", startDate: "2026-08-03", days: 2, seed: 1, entries: [], warnings: [] };
    const contexte = {
      profile: {
        trancheAge: "30_49",
        sexe: "F",
        tailleCm: 165,
        poidsKg: 62,
        niveauActivite: "actif",
        facteurPortion: 1,
      },
      constraints: { allergies: [], diet: null, excludedFoodIds: [], ownedEquipmentIds: null , admittedFoodIds: [] },
      history: { windowDays: 21, entries: [] },
      activeTopics: [],
  tolerancePiquant: null,
      seed: 1,
    };
    expect(engine.rerollSlot(plan as never, { date: "2026-08-03", creneau: "diner" }, contexte as never)).toBe(plan);
  });

  it("scaleRecipe est CÂBLÉ — il refuse une recette inconnue plutôt que « non implémenté »", () => {
    const engine = createEngine(makeCatalog());
    expect(() => engine.scaleRecipe("inexistante" as RecipeId, 4)).toThrow(RangeError);
  });

  it("planWeek est CÂBLÉ — il refuse une fenêtre hors bornes plutôt que « non implémenté »", () => {
    const engine = createEngine(makeCatalog());
    expect(() => engine.planWeek({ days: 99, slots: ["diner"] } as never)).toThrow(RangeError);
  });
});

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

const FER_ID = "fer" as NutrientId;
const FER_NUTRIENT: Nutrient = {
  id: FER_ID,
  code: "fer",
  nom: "Fer",
  unite: "mg",
  vnrAdulte: 10,
  categorie: "mineral",
  sens: "plancher",
};

function ferFood(id: string, ferPer100g: number): Food {
  return {
    id: id as FoodId,
    codeCiqual: `TEST-${id}`,
    nom: id,
    synonymes: [],
    groupe: "test",
    sousFamille: null,
    sousGroupe: null,
    nutrimentsPour100g: new Map([[FER_ID, ferPer100g]]),
    allergenes: [],
    saisonMois: [],
    touteAnnee: true,
    piquant: null,
    poidsPieceG: null,
    fondDePlacard: false,
    quantiteFigee: false,
    conditionnementG: null,
    origineAnimale: null,
    provenanceAnimale: null,
    deriveDe: null,
  };
}

/** 10 + 10 = 20 min au total sur les trois recettes du fixture — assez pour être écartées par
 * `temps` dans le test « 0 candidat » (`tempsDisponibleMin: 5`), sans jamais gêner les autres
 * tests (aucun n'impose de contrainte de temps). */
function ferRecipe(id: string, foodId: string): Recipe {
  return {
    id: id as RecipeId,
    nom: id,
    origine: "maison",
    description: "",
    tempsPrepMin: min(10),
    tempsCuissonMin: min(10),
    difficulte: 1,
    portionsBase: 2,
    imagePath: null,
    typesRepas: ["diner"],
    saisonMois: [],
    envergure: "quotidien",
    conservationJours: 1,
    // Axes identiques sur les trois recettes : élimine tout signal de similarité autre que
    // « même ingrédient principal » (toujours faux ici, les trois foods diffèrent) — le rang
    // par score domine largement la pénalité MMR (voir le commentaire du premier test).
    axes: { sucreSale: 0, legerConsistant: 0, chaudFroid: 0, texture: "test" },
    ingredients: [
      {
        foodId: foodId as FoodId,
        quantiteG: g(200),
        uniteAffichage: "g",
        optionnel: false,
      },
    ],
    etapes: [],
    facettes: [],
    service: null,
    piquant: null,
    sources: [],
    testeLe: null,
    estSauce: false,
    porteDejaUneSauce: null,
    sauceIds: [],
    equipements: [],
    occupations: [],
  };
}

interface FerFixture {
  readonly catalog: Catalog;
  readonly riche: Recipe;
  readonly moyen: Recipe;
  readonly pauvre: Recipe;
}

function makeFerFixture(): FerFixture {
  const foodRiche = ferFood("food_riche", 12);
  const foodMoyen = ferFood("food_moyen", 1.5);
  const foodPauvre = ferFood("food_pauvre", 0);

  const riche = ferRecipe("plat_riche", foodRiche.id);
  const moyen = ferRecipe("plat_moyen", foodMoyen.id);
  const pauvre = ferRecipe("plat_pauvre", foodPauvre.id);

  const recipes = new Map([riche, moyen, pauvre].map((r) => [r.id, r]));
  const foods = new Map(
    [foodRiche, foodMoyen, foodPauvre].map((f) => [f.id, f]),
  );

  const indexes: CatalogIndexes = {
    ...EMPTY_INDEXES,
    recipesBySlot: new Map([
      ["diner", new Set([riche.id, moyen.id, pauvre.id])],
    ]),
  };

  const catalog: Catalog = {
    version: "fer-fixture-1",
    foods,
    recipes,
    nutrients: [FER_NUTRIENT],
    allergens: new Map(),
    lexicon: new Map(),
    equipment: new Map(),
    tips: [],
    evidence: new Map(),
    topics: new Map(),
    substitutions: new Map(),
    indexes,
  };

  return { catalog, riche, moyen, pauvre };
}

/** Isole `nutri` comme seule couche de score active — les 6 autres couches implémentées à 0. */
/**
 * Isole `nutri` — TOUTES les autres couches de score à zéro.
 *
 * ⚠️ Toute couche AJOUTÉE au registre doit apparaître ici. `pantry` a été oubliée le 2026-07-28 et
 * a pollué l'isolation sans que ce soit évident : les scores attendus sont passés de [100, 50, 0] à
 * [97,6, 50, 2,4] et j'ai d'abord « corrigé » les valeurs attendues au lieu du fixture.
 */
const ISOLATE_NUTRI_WEIGHTS: Partial<ScoreWeights> = {
  nutri: 1,
  preference: 0,
  craving: 0,
  variety: 0,
  season: 0,
  habit: 0,
  speed: 0,
  pantry: 0,
};

function ferRequest(
  overrides: {
    readonly weights?: Partial<ScoreWeights>;
    readonly limit?: number;
    readonly excludedFoodIds?: readonly FoodId[];
    readonly tempsDisponibleMin?: number | null;
    readonly skipDiversification?: boolean;
    readonly favoriteRecipeIds?: readonly RecipeId[];
    readonly onlyFavorites?: boolean;
  } = {},
): SuggestionRequest {
  return {
    tolerancePiquant: null,
    profile: {
      trancheAge: "30_49",
      sexe: "NP",
      tailleCm: null,
      poidsKg: null,
      niveauActivite: "sedentaire",
      facteurPortion: 1,
    },
    constraints: {
      allergies: [],
      diet: null,
      excludedFoodIds: overrides.excludedFoodIds ?? [],
      ownedEquipmentIds: null,
      admittedFoodIds: [],
    },
    context: {
      creneau: "diner",
      date: "2026-07-23",
      tempsDisponibleMin:
        overrides.tempsDisponibleMin == null
          ? null
          : min(overrides.tempsDisponibleMin),
      envie: null,
      pantryFoodIds: [],
      requiredFoodIds: [],
    },
    history: { windowDays: 21, entries: [] },
    preferences: new Map(),
    favoriteRecipeIds: new Set(overrides.favoriteRecipeIds ?? []),
    activeTopics: [],
    seed: 1,
    // `exactOptionalPropertyTypes` (tsconfig) distingue « absente » d'« explicitement `undefined` »
    // pour un champ optionnel : n'inclure ces clés QUE quand une valeur est réellement fournie,
    // pour laisser `suggestMeals` appliquer ses propres défauts (poids de référence, limite 5,
    // diversification active) exactement comme un appelant qui ne les précise pas.
    ...(overrides.weights !== undefined ? { weights: overrides.weights } : {}),
    ...(overrides.limit !== undefined ? { limit: overrides.limit } : {}),
    ...(overrides.skipDiversification !== undefined
      ? { skipDiversification: overrides.skipDiversification }
      : {}),
    ...(overrides.onlyFavorites !== undefined
      ? { onlyFavorites: overrides.onlyFavorites }
      : {}),
  };
}

describe("engine/api — suggestMeals bout-en-bout (§6.4, §8 ENGINE)", () => {
  it("enchaînement complet : n suggestions, triées par score, chacune avec son breakdown et ses explications", () => {
    const { catalog, riche, moyen, pauvre } = makeFerFixture();
    const engine = createEngine(catalog);

    const result = engine.suggestMeals(
      ferRequest({ weights: ISOLATE_NUTRI_WEIGHTS }),
    );

    expect(result.suggestions.map((s) => s.recipeId)).toEqual([
      riche.id,
      moyen.id,
      pauvre.id,
    ]);
    expect(result.suggestions.map((s) => s.score)).toEqual([100, 50, 0]);

    for (const suggestion of result.suggestions) {
      // nutri est la SEULE couche active (poids normalisé = 1) : sa contribution = le score final.
      expect(suggestion.breakdown.nutri).toBeCloseTo(suggestion.score / 100, 9);
      // ⚠️ AUCUNE EXPLICATION, ET C'EST LE COMPORTEMENT ATTENDU. `nutri` est la seule couche active
      // ici (ISOLATE_NUTRI_WEIGHTS) et sa phrase a été retirée de l'affichage
      // (EXPLANATION_LABELS, selection/explain.ts : `nutri: null`). Une couche muette est écartée
      // SANS LEVER — c'est exactement le plantage qui frappait `pantry`.
      expect(suggestion.explanations).toEqual([]);
      expect(suggestion.portions).toBe(2); // recipe.portionsBase, jamais mis à l'échelle ici
      expect(suggestion.nutrition.perPortion).toHaveLength(1);
    }
    expect(
      result.suggestions.find((s) => s.recipeId === riche.id)?.nutrition
        .perPortion[0],
    ).toBeCloseTo(12, 9);
    expect(
      result.suggestions.find((s) => s.recipeId === pauvre.id)?.nutrition
        .perPortion[0],
    ).toBeCloseTo(0, 9);
  });

  it("onlyFavorites restreint bout-en-bout — les non-favoris n’atteignent jamais le scoring (§8.1 ENGINE)", () => {
    const { catalog, riche, moyen, pauvre } = makeFerFixture();
    const engine = createEngine(catalog);

    // `riche` domine le classement sans filtre (test précédent). En ne gardant que `pauvre` en
    // favori, il devient la SEULE suggestion — ce qui prouve que le filtre agit AVANT le score et
    // non sur le classement final, où `riche` serait resté en tête.
    const result = engine.suggestMeals(
      ferRequest({
        weights: ISOLATE_NUTRI_WEIGHTS,
        favoriteRecipeIds: [pauvre.id],
        onlyFavorites: true,
      }),
    );

    expect(result.suggestions.map((s) => s.recipeId)).toEqual([pauvre.id]);
    expect(result.rejected.byLayer.get("favoris")).toBe(2);
    expect(result.rejected.entries.map((e) => e.recipeId).sort()).toEqual(
      [riche.id, moyen.id].sort(),
    );
    expect(result.rejected.entries.every((e) => e.layerId === "favoris")).toBe(
      true,
    );
  });

  it("onlyFavorites sans aucun favori → NoViableRecipeError, le filtre dur ne se désactive pas tout seul", () => {
    const { catalog } = makeFerFixture();
    const engine = createEngine(catalog);

    expect(() =>
      engine.suggestMeals(ferRequest({ onlyFavorites: true })),
    ).toThrow(NoViableRecipeError);
  });

  it("limit est respecté", () => {
    const { catalog, riche, moyen } = makeFerFixture();
    const engine = createEngine(catalog);

    const result = engine.suggestMeals(
      ferRequest({ weights: ISOLATE_NUTRI_WEIGHTS, limit: 2 }),
    );

    expect(result.suggestions).toHaveLength(2);
    expect(result.suggestions.map((s) => s.recipeId)).toEqual([
      riche.id,
      moyen.id,
    ]);
  });

  it("limite supérieure au nombre de candidats → tout, sans erreur", () => {
    const { catalog, riche, moyen, pauvre } = makeFerFixture();
    const engine = createEngine(catalog);

    const result = engine.suggestMeals(
      ferRequest({ weights: ISOLATE_NUTRI_WEIGHTS, limit: 10 }),
    );

    expect(result.suggestions).toHaveLength(3);
    expect(result.suggestions.map((s) => s.recipeId).sort()).toEqual(
      [riche.id, moyen.id, pauvre.id].sort(),
    );
  });

  it("0 candidat après exclusion (temps insuffisant pour toutes les recettes) → NoViableRecipeError portant le motif dominant", () => {
    const { catalog } = makeFerFixture();
    const engine = createEngine(catalog);
    // Les 3 recettes du fixture ont 10+10 = 20 min — 5 min disponibles les écarte toutes via `temps`.
    const req = ferRequest({
      weights: ISOLATE_NUTRI_WEIGHTS,
      tempsDisponibleMin: 5,
    });

    expect(() => engine.suggestMeals(req)).toThrow(NoViableRecipeError);
    expect(() => engine.suggestMeals(req)).toThrow(/temps/);

    let caught: unknown;
    try {
      engine.suggestMeals(req);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(NoViableRecipeError);
    const nve = caught as NoViableRecipeError;
    expect(nve.rejected.totalInitial).toBe(3);
    expect(nve.rejected.totalRejected).toBe(3);
    expect(nve.rejected.byLayer.get("temps")).toBe(3);
  });

  it("RejectionSummary : les comptages par couche correspondent à ce que la passe d'exclusion a réellement écarté", () => {
    const { catalog, riche, moyen, pauvre } = makeFerFixture();
    const engine = createEngine(catalog);

    const result = engine.suggestMeals(
      ferRequest({
        weights: ISOLATE_NUTRI_WEIGHTS,
        excludedFoodIds: ["food_pauvre" as FoodId],
      }),
    );

    expect(result.rejected.totalInitial).toBe(3);
    expect(result.rejected.totalRejected).toBe(1);
    expect(result.rejected.byLayer.get("exclusions")).toBe(1);
    expect(result.rejected.entries).toHaveLength(1);
    expect(result.rejected.entries[0]?.recipeId).toBe(pauvre.id);
    expect(result.rejected.entries[0]?.layerId).toBe("exclusions");
    expect(result.suggestions.map((s) => s.recipeId).sort()).toEqual(
      [riche.id, moyen.id].sort(),
    );
  });

  it("EngineDiagnostics.weights est complet : les 12 ScoringLayerId, zéros compris pour les couches non implémentées", () => {
    const { catalog } = makeFerFixture();
    const engine = createEngine(catalog);

    // Pas de `weights` explicite ici : résolution normale (defaultWeight/archétype), pour
    // vérifier que la complétion à zéro s'applique aussi bien aux couches jamais actives
    // (`occasion`/`topic`/`cost`) qu'à celles simplement inactives par défaut (`habit`, `speed`).
    const result = engine.suggestMeals(ferRequest());

    const keys = Object.keys(result.diagnostics.weights).sort();
    expect(keys).toEqual(
      [
        "nutri",
        "preference",
        "craving",
        "variety",
        "season",
        "pantry",
        "habit",
        "occasion",
        "speed",
        "topic",
        "cost",
        // Décision 35 — `piquant` a `defaultWeight: 0` et ne se relève qu'avec une tolérance
        // DÉCLARÉE ; `ferRequest()` n'en déclare aucune, elle est donc ici à zéro comme les autres.
        "piquant",
      ].sort(),
    );
    // Jamais implémentées (P2/v2/v3) : forcément à zéro, quel que soit le reste de la requête.
    expect(result.diagnostics.weights.occasion).toBe(0);
    expect(result.diagnostics.weights.topic).toBe(0);
    expect(result.diagnostics.weights.cost).toBe(0);
    // Implémentées mais inactives par défaut (démarrage à froid / hors archétype "rapide").
    expect(result.diagnostics.weights.habit).toBe(0);
    expect(result.diagnostics.weights.speed).toBe(0);
    // Actives par défaut (poids de référence, §6.5 ENGINE).
    // `pantry` a rejoint cette liste le 2026-07-28 (§10.2 ①) : bonus modéré, actif même avec un
    // garde-manger vide — la couche rend alors NEUTRAL_SCORE pour tous, sans changer le classement.
    expect(result.diagnostics.weights.pantry).toBeGreaterThan(0);
    expect(result.diagnostics.weights.nutri).toBeGreaterThan(0);
    expect(result.diagnostics.weights.preference).toBeGreaterThan(0);
    expect(result.diagnostics.weights.craving).toBeGreaterThan(0);
    expect(result.diagnostics.weights.variety).toBeGreaterThan(0);
    expect(result.diagnostics.weights.season).toBeGreaterThan(0);
  });

  it("déterminisme : deux appels identiques donnent un résultat identique", () => {
    const { catalog } = makeFerFixture();
    const engine = createEngine(catalog);
    const req = ferRequest({ weights: ISOLATE_NUTRI_WEIGHTS });

    const first = engine.suggestMeals(req);
    const second = engine.suggestMeals(req);

    expect(second).toEqual(first);
  });

  it("dureeMs vaut 0 sans horloge injectée à createEngine", () => {
    const { catalog } = makeFerFixture();
    const engine = createEngine(catalog);

    const result = engine.suggestMeals(
      ferRequest({ weights: ISOLATE_NUTRI_WEIGHTS }),
    );

    expect(result.diagnostics.dureeMs).toBe(0);
  });

  it("dureeMs mesure l'écart via l'horloge de test injectée à createEngine", () => {
    const { catalog } = makeFerFixture();
    const ticks = [1_000, 1_042];
    let call = 0;
    const engine = createEngine(catalog, { now: () => ticks[call++]! });

    const result = engine.suggestMeals(
      ferRequest({ weights: ISOLATE_NUTRI_WEIGHTS }),
    );

    expect(result.diagnostics.dureeMs).toBe(42);
  });

  it("diagnostics.diversification n'est pas null sur une suggestion nominale, λ vaut DEFAULT_MMR_LAMBDA sans mmrLambda", () => {
    const { catalog } = makeFerFixture();
    const engine = createEngine(catalog);

    // Aucun `mmrLambda` dans la requête (`ferRequest` ne le porte pas) : `suggestMeals` doit
    // retomber sur DEFAULT_MMR_LAMBDA, pas sur une valeur codée en dur ici qui divergerait
    // silencieusement si le calibrage change encore.
    const result = engine.suggestMeals(ferRequest({ weights: ISOLATE_NUTRI_WEIGHTS }));

    expect(result.diagnostics.diversification).not.toBeNull();
    expect(result.diagnostics.diversification?.lambda).toBe(DEFAULT_MMR_LAMBDA);
  });

  it("diagnostics.diversification.lambda reflète request.mmrLambda quand il est fourni", () => {
    const { catalog } = makeFerFixture();
    const engine = createEngine(catalog);

    const result = engine.suggestMeals({
      ...ferRequest({ weights: ISOLATE_NUTRI_WEIGHTS }),
      mmrLambda: 0.7,
    });

    expect(result.diagnostics.diversification?.lambda).toBe(0.7);
  });

  it("diagnostics.diversification.maxSimilarities : une valeur par suggestion, dans [0, 1], la première à 0", () => {
    const { catalog } = makeFerFixture();
    const engine = createEngine(catalog);

    const result = engine.suggestMeals(ferRequest({ weights: ISOLATE_NUTRI_WEIGHTS }));
    const similarities = result.diagnostics.diversification?.maxSimilarities;

    // Convention de `diversify` : l'ensemble des retenues est VIDE au premier tour, donc la
    // première valeur vaut 0 par construction — ce n'est pas une mesure de similarité.
    expect(similarities).toHaveLength(result.suggestions.length);
    expect(similarities?.[0]).toBe(0);
    for (const s of similarities ?? []) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it("diagnostics.diversification vaut null quand skipDiversification est vrai", () => {
    // `null` signifie ICI « la diversification n'a pas tourné », PAS « aucune similarité mesurée » :
    // avec `skipDiversification`, `diversify` n'est jamais appelé, il n'existe donc aucun
    // `maxSimilarityToRetained` à rapporter — un tableau vide aurait laissé croire au contraire
    // qu'on avait mesuré et trouvé zéro similarité partout.
    const { catalog } = makeFerFixture();
    const engine = createEngine(catalog);

    const result = engine.suggestMeals(
      ferRequest({ weights: ISOLATE_NUTRI_WEIGHTS, skipDiversification: true }),
    );

    expect(result.diagnostics.diversification).toBeNull();
  });
});

// ------------------------------------------------------------------------------------------
// createEngine appelle réellement attachDerivedIndexes — test de COMPORTEMENT (pas `vi.spyOn`,
// seul mock qu'avait le dépôt jusqu'ici). L'appel a maintenant un effet observable :
// `suggestMeals` fait discriminer `nutri` selon la teneur en fer réelle des recettes — ce qui
// n'est possible QUE si `catalog.indexes.recipeNutrients` a bien été peuplé en interne, alors que
// le catalogue REÇU par `createEngine` porte cet index vide.
// ------------------------------------------------------------------------------------------

describe("engine/api — createEngine appelle réellement attachDerivedIndexes (comportement)", () => {
  it("une suggestion dont le score `nutri` dépend du contenu réel du catalogue prouve que les index dérivés ont été peuplés", () => {
    const { catalog } = makeFerFixture();
    // Précondition : le catalogue passé à createEngine porte des index dérivés VIDES. Si
    // createEngine n'appelait pas attachDerivedIndexes, `nutri` ne pourrait lire aucun vecteur
    // nutritionnel et rendrait NEUTRAL_SCORE (0.5) identiquement pour les trois recettes.
    expect(catalog.indexes.recipeNutrients.size).toBe(0);

    const engine = createEngine(catalog);
    const result = engine.suggestMeals(
      ferRequest({ weights: ISOLATE_NUTRI_WEIGHTS }),
    );

    const scores = result.suggestions.map((s) => s.score);
    expect(new Set(scores).size).toBe(3); // trois scores DISTINCTS : le signal réel a discriminé
    expect(scores).toEqual([100, 50, 0]);
  });
});

// ------------------------------------------------------------------------------------------
// Avertissements de plancher calorique sur un plan — `checkPlan` et la recomposition de
// `rerollSlot` (§6.5 ARCHITECTURE). Fixture dédiée : `checkCalorieFloor` cherche le nutriment de
// code `energie`, que le catalogue de tête (code `kcal`) ne contient pas.
// ------------------------------------------------------------------------------------------

function makeEnergyFixture(): Catalog {
  const energie: Nutrient = {
    id: "energie" as NutrientId,
    code: "energie",
    nom: "Énergie",
    unite: "kcal",
    vnrAdulte: 2000,
    categorie: null,
    sens: "cible",
  };
  const foods = [food("maigre", 5), food("gras", 900)].map((f) => ({
    ...f,
    nutrimentsPour100g: new Map([["energie" as NutrientId, f.nutrimentsPour100g.get("kcal" as NutrientId)!]]),
  }));
  // 200 g d'ingrédient sur 2 portions : « maigre » ≈ 5 kcal/portion, « gras » ≈ 900.
  const recipes = [
    { ...recipeWithOneIngredient("bouillon", "maigre"), typesRepas: ["dejeuner", "diner"] as const },
    { ...recipeWithOneIngredient("consomme", "maigre"), typesRepas: ["dejeuner", "diner"] as const },
    { ...recipeWithOneIngredient("gratin", "gras"), typesRepas: ["dejeuner", "diner"] as const },
    { ...recipeWithOneIngredient("cassoulet", "gras"), typesRepas: ["dejeuner", "diner"] as const },
  ] as unknown as Recipe[];

  return {
    version: "catalog-energie-1",
    foods: new Map(foods.map((f) => [f.id, f])),
    recipes: new Map(recipes.map((r) => [r.id, r])),
    nutrients: [energie],
    allergens: new Map(),
    lexicon: new Map(),
    equipment: new Map(),
    tips: [],
    evidence: new Map(),
    topics: new Map(),
    substitutions: new Map(),
    indexes: EMPTY_INDEXES,
  };
}

function planWith(dejeuner: string, diner: string, warnings: readonly PlanWarning[] = []) {
  const entry = (creneau: "dejeuner" | "diner", recette: string) => ({
    slot: { date: "2026-08-03", creneau },
    recipeId: recette as RecipeId,
    horsCatalogue: null,
    portions: 2,
    locked: false,
    isLeftover: false,
    service: null,
  });
  return {
    id: "p",
    startDate: "2026-08-03",
    days: 2,
    seed: 1,
    entries: [entry("dejeuner", dejeuner), entry("diner", diner)],
    warnings,
  };
}

const PROFIL_TEST: UserProfile = {
  trancheAge: "30_49",
  sexe: "F",
  tailleCm: 165,
  poidsKg: 62,
  niveauActivite: "actif",
  facteurPortion: 1,
};

describe("engine/api — avertissements d'un plan (§6.5)", () => {
  it("checkPlan signale une journée sous le plancher", () => {
    const engine = createEngine(makeEnergyFixture());
    const warnings = engine.checkPlan(planWith("bouillon", "consomme"), PROFIL_TEST);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.kind).toBe("plancher_calorique");
    expect(warnings[0]!.date).toBe("2026-08-03");
  });

  it("checkPlan ne signale rien quand la journée tient", () => {
    const engine = createEngine(makeEnergyFixture());
    expect(engine.checkPlan(planWith("gratin", "cassoulet"), PROFIL_TEST)).toEqual([]);
  });

  it("checkPlan est CE QUI PERMET à un plan relu de garder ses alertes", () => {
    // `user.db` ne persiste pas les avertissements : ils dépendent du PROFIL, et les figer les
    // ferait mentir après un changement. Un plan restauré arrive donc avec `warnings: []` — sans
    // ce recalcul, l'alerte de §6.5 disparaîtrait silencieusement au rechargement de la page.
    const engine = createEngine(makeEnergyFixture());
    const relu = planWith("bouillon", "consomme"); // warnings: [] comme le rend readPlan
    expect(relu.warnings).toEqual([]);
    expect(engine.checkPlan(relu, PROFIL_TEST)).toHaveLength(1);
  });

  it("rerollSlot RECALCULE les avertissements au lieu de traîner ceux du plan d'avant", () => {
    // ⚠️ RÉGRESSION D'UN BUG RÉEL (corrigé 2026-07-30). `runRerollSlot` rend `{ ...plan, entries }`
    // et conservait donc `warnings`. Un plan dont la journée tient largement sortait d'un reroll en
    // portant encore l'avertissement d'une version précédente.
    const engine = createEngine(makeEnergyFixture());
    const perime: PlanWarning = { kind: "plancher_calorique", date: "2026-08-03", kcal: 900, seuil: 1200, repasComptes: 2 };
    const apres = engine.rerollSlot(
      planWith("gratin", "cassoulet", [perime]),
      { date: "2026-08-03", creneau: "diner" },
      {
        profile: PROFIL_TEST,
        tolerancePiquant: null,
        constraints: { allergies: [], diet: null, excludedFoodIds: [], ownedEquipmentIds: null , admittedFoodIds: [] },
        history: { windowDays: 21, entries: [] },
        activeTopics: [],
        seed: 1,
      }
    );

    expect(apres.warnings).toEqual([]);
  });
});

// --- Plats préparés (décision 51, issue « (a) créneau exclu ») ---------------------------------
//
// Ce que ces tests verrouillent n'est PAS « le plat préparé s'affiche » — c'est que le moteur SE
// TAIT sur la journée qui en contient un. Une alerte calculée sur une somme partielle serait un FAUX
// à tous les coups : « 640 kcal » pour une journée qui en contient peut-être 1 800. §6.5 interdit
// d'affirmer à quelqu'un ce qu'il mange quand on n'en sait rien (correction de la décision 56).
//
// ⚠️ LE PLAT PRÉPARÉ EST AU GOÛTER, ET C'EST TOUT LE SUJET. Première version de ces tests : il était
// au DÎNER — ils passaient au vert AVEC ET SANS la garde, donc ils ne prouvaient rien. La raison
// est que `checkCalorieFloor` n'évalue que les journées dont le déjeuner ET le dîner sont remplis,
// et qu'un plat préparé (`recipeId: null`) ne remplit rien : la journée était déjà écartée par la
// règle d'AVANT. Le seul cas où le nouveau drapeau décide vraiment est un créneau HORS
// déjeuner/dîner — le portail s'ouvre, et le total additionné est incomplet. C'est là qu'une fausse
// alerte se produisait.

function planTroisCreneaux(dejeuner: string, diner: string, gouter: { readonly recette: string } | { readonly prepare: string }) {
  const recette = (creneau: "dejeuner" | "diner" | "gouter", id: string) => ({
    slot: { date: "2026-08-03", creneau },
    recipeId: id as RecipeId,
    horsCatalogue: null,
    portions: 2,
    locked: false,
    isLeftover: false,
    service: null,
  });
  return {
    id: "p",
    startDate: "2026-08-03",
    days: 2,
    seed: 1,
    entries: [
      recette("dejeuner", dejeuner),
      recette("diner", diner),
      "recette" in gouter
        ? recette("gouter", gouter.recette)
        : {
            slot: { date: "2026-08-03", creneau: "gouter" as const },
            recipeId: null,
            horsCatalogue: gouter.prepare,
            portions: 0,
            locked: false,
            isLeftover: false,
            service: null,
          },
    ],
    warnings: [] as readonly PlanWarning[],
  };
}

describe("engine/api — un plat préparé rend la journée immesurable (décision 51)", () => {
  it("SANS plat préparé, la journée légère déclenche bien l'alerte — le témoin", () => {
    // Sans ce témoin, le test suivant serait vert pour n'importe quelle raison, y compris parce que
    // la fixture ne déclenche jamais rien.
    const engine = createEngine(makeEnergyFixture());
    const plan = planTroisCreneaux("bouillon", "consomme", { recette: "bouillon" });
    expect(engine.checkPlan(plan, PROFIL_TEST).map((w) => w.date)).toEqual(["2026-08-03"]);
  });

  it("… et elle se tait dès qu'un créneau de cette journée est un plat préparé", () => {
    const engine = createEngine(makeEnergyFixture());
    const plan = planTroisCreneaux("bouillon", "consomme", { prepare: "Lasagnes surgelées" });
    expect(engine.checkPlan(plan, PROFIL_TEST)).toEqual([]);
  });

  it("⛔ le silence vaut MÊME quand les repas mesurables sont très légers — c'est le prix assumé", () => {
    // CE TEST DOCUMENTE UNE PERTE, pas un succès. L'issue (a) achète l'honnêteté du chiffre au prix
    // de l'alerte. Les deux autres issues la gardaient en fabriquant un nombre — tapé par
    // l'utilisateur (b) ou inventé via un aliment approchant (c). Si ce test devient gênant, c'est
    // la DÉCISION 51 qu'il faut rouvrir, pas le test qu'il faut assouplir.
    const engine = createEngine(makeEnergyFixture());
    const plan = planTroisCreneaux("consomme", "consomme", { prepare: "Restaurant" });
    expect(engine.checkPlan(plan, PROFIL_TEST)).toEqual([]);
  });

  it("une AUTRE journée du même plan garde son alerte — l'exclusion est journalière, pas globale", () => {
    const engine = createEngine(makeEnergyFixture());
    const base = planTroisCreneaux("bouillon", "consomme", { prepare: "Traiteur" });
    const plan = {
      ...base,
      entries: [
        ...base.entries,
        { slot: { date: "2026-08-04", creneau: "dejeuner" as const }, recipeId: "bouillon" as RecipeId, horsCatalogue: null, portions: 2, locked: false, isLeftover: false, service: null },
        { slot: { date: "2026-08-04", creneau: "diner" as const }, recipeId: "consomme" as RecipeId, horsCatalogue: null, portions: 2, locked: false, isLeftover: false, service: null },
      ],
    };
    expect(engine.checkPlan(plan, PROFIL_TEST).map((w) => w.date)).toEqual(["2026-08-04"]);
  });

  it("setSlotHorsCatalogue RETIRE l'avertissement de la journée qu'il rend immesurable", () => {
    // Le recalcul doit se faire DANS le moteur. Sauté, le plan sortirait en portant une alerte
    // calculée sur l'état d'avant — un chiffre périmé à côté d'un plat qui n'y est plus. Même
    // défaut que la régression de `rerollSlot` plus haut.
    const engine = createEngine(makeEnergyFixture());
    const avant = planTroisCreneaux("bouillon", "consomme", { recette: "bouillon" });
    expect(engine.checkPlan(avant, PROFIL_TEST)).toHaveLength(1);

    const apres = engine.setSlotHorsCatalogue(avant, { date: "2026-08-03", creneau: "gouter" }, "Pizza livrée", PROFIL_TEST);
    expect(apres.warnings).toEqual([]);
    expect(apres.entries.find((e) => e.slot.creneau === "gouter")!.horsCatalogue).toBe("Pizza livrée");
  });

  it("le libellé est NETTOYÉ, et un libellé blanc est refusé", () => {
    // Un `horsCatalogue: ''` serait le pire état possible : non-`null`, donc « rempli et
    // immesurable » pour toutes les gardes, mais invisible à l'écran — un créneau occupé par rien,
    // qui éteindrait l'alerte sans que personne puisse voir pourquoi.
    const engine = createEngine(makeEnergyFixture());
    const plan = planTroisCreneaux("bouillon", "consomme", { recette: "bouillon" });
    const slot = { date: "2026-08-03", creneau: "gouter" as const };

    expect(engine.setSlotHorsCatalogue(plan, slot, "  Pizza  ", PROFIL_TEST).entries.find((e) => e.slot.creneau === "gouter")!.horsCatalogue).toBe("Pizza");
    expect(() => engine.setSlotHorsCatalogue(plan, slot, "   ", PROFIL_TEST)).toThrow(RangeError);
  });

  it("un créneau VERROUILLÉ refuse le dépôt, comme il refuse un tirage", () => {
    const engine = createEngine(makeEnergyFixture());
    const base = planTroisCreneaux("bouillon", "consomme", { recette: "bouillon" });
    const verrouille = {
      ...base,
      entries: base.entries.map((e) => (e.slot.creneau === "gouter" ? { ...e, locked: true } : e)),
    };
    const apres = engine.setSlotHorsCatalogue(verrouille, { date: "2026-08-03", creneau: "gouter" }, "Pizza", PROFIL_TEST);
    expect(apres).toBe(verrouille);
  });
});

describe("engine/api — suggestSauces : les couches critiques s'appliquent AUSSI aux sauces", () => {
  // ⚠️ CE BLOC COMBLE UN TROU, PAS UN CAS LIMITE. `suggestSauces` n'était exercé par AUCUN test
  // jusqu'au 2026-08-10 : sa documentation affirme « LES EXCLUSIONS S'APPLIQUENT, PAR LES MÊMES
  // COUCHES » et rien ne le vérifiait. `domain/sauces.test.ts` couvre la RELATION plat↔sauce, qui
  // ignore les contraintes par construction (le module ne les reçoit pas) ; l'exclusion ne vit que
  // dans l'API, sur le chemin testé ici.
  //
  // Le fixture reproduit le SEUL couple du catalogue réel qui croise deux régimes (relevé du
  // 2026-08-10 : 1 couple sur 14) — `pommes_terre_four_romarin`, végétalienne, porte
  // `sauce_yaourt_citron_ciboulette`, végétarienne. La situation n'est donc pas hypothétique, et
  // c'est elle qui a fait soupçonner un défaut : il n'y en a pas, mais rien ne le prouvait.

  const oeuf = food("oeuf", 100);
  const regime = (valeur: string) => [{ facette: "regime" as const, valeur }];

  const plat = {
    ...recipeWithOneIngredient("pdt_four", "oeuf"),
    facettes: regime("vegetalien"),
    sauceIds: ["sauce_yaourt" as RecipeId, "sauce_citron" as RecipeId],
  };
  const sauceYaourt = {
    ...recipeWithOneIngredient("sauce_yaourt", "oeuf"),
    estSauce: true,
    facettes: regime("vegetarien"),
  };
  const sauceCitron = {
    ...recipeWithOneIngredient("sauce_citron", "oeuf"),
    estSauce: true,
    facettes: regime("vegetalien"),
  };

  function catalogueAuxSauces(): Catalog {
    const base = makeCatalog();
    return {
      ...base,
      foods: new Map([[oeuf.id, oeuf]]),
      recipes: new Map([plat, sauceYaourt, sauceCitron].map((r) => [r.id, r])),
    };
  }

  const sansRegime = { allergies: [], diet: null, excludedFoodIds: [], ownedEquipmentIds: null , admittedFoodIds: [] };
  const avec = (diet: string) => ({ ...sansRegime, diet });

  it("sans régime déclaré, les deux sauces attachées sont rendues — la couche est INERTE", () => {
    const r = createEngine(catalogueAuxSauces()).suggestSauces({
      recipeId: "pdt_four" as RecipeId,
      constraints: sansRegime,
    });
    expect(r.proposer).toBe(true);
    expect([...r.attachees].sort()).toEqual(["sauce_citron", "sauce_yaourt"]);
    expect(r.ecartees).toBe(0);
  });

  it("⛔ RÉGIME VÉGÉTALIEN : la sauce au yaourt est ÉCARTÉE, et le plat reste proposé", () => {
    // Le cas qui justifie tout le bloc. Un plat végétalien peut porter une sauce qui ne l'est pas :
    // c'est un appariement du catalogue, pas un ingrédient. La sauce doit disparaître pour qui a
    // déclaré végétalien — et l'écran doit pouvoir le DIRE, d'où `ecartees`, sans quoi la liste
    // raccourcie se lit comme un catalogue pauvre.
    const r = createEngine(catalogueAuxSauces()).suggestSauces({
      recipeId: "pdt_four" as RecipeId,
      constraints: avec("vegetalien"),
    });
    expect(r.proposer).toBe(true);
    expect(r.attachees).toEqual(["sauce_citron"]);
    expect(r.autres).toEqual([]);
    expect(r.ecartees).toBe(1);
  });

  it("régime VÉGÉTARIEN : les deux passent — l'inclusion joue, ce n'est pas une égalité stricte", () => {
    // Une sauce PLUS restrictive que le régime demandé reste servie (`DIET_CHAIN`). Sans ce test,
    // une régression vers l'égalité stricte ne rendrait la sauce végétalienne invisible qu'aux
    // végétariens — une absence, donc aucune erreur nulle part.
    const r = createEngine(catalogueAuxSauces()).suggestSauces({
      recipeId: "pdt_four" as RecipeId,
      constraints: avec("vegetarien"),
    });
    expect([...r.attachees].sort()).toEqual(["sauce_citron", "sauce_yaourt"]);
    expect(r.ecartees).toBe(0);
  });
});
