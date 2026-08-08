// engine/guards/index.test.ts — garde-fou allergènes (docs/ENGINE.md §5.2 ; docs/ARCHITECTURE.md
// §5.2) : la « ceinture de sécurité » derrière la couche `allergenes` (engine/selection/allergenes.ts).
//
// Cas construits à la main (tâche P1a) — pas de dépendance à data/ ni au catalogue réel : un
// fixture minimal suffit à prouver que le garde-fou lève sur une violation.

import { describe, expect, it } from "vitest";
import type {
  AllergenId,
  Catalog,
  CatalogIndexes,
  Explanation,
  Food,
  FoodId,
  HardConstraints,
  PipelineTrace,
  Recipe,
  RecipeId,
  ScoringLayerId,
} from "../domain/index.js";
import { EngineSafetyError, g, min } from "../domain/index.js";
import {
  assertCriticalLayersRan,
  assertNoDeclaredAllergen,
  assertNoTherapeuticClaim,
  assertScoringLayersNeverExclude,
} from "./index.js";
import { BANNED_TERMS, findBannedTerms } from "./banned-terms.js";

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

function food(id: string, allergenId: string | null): Food {
  return {
    id: id as FoodId,
    codeCiqual: `TEST-${id}`,
    nom: id,
    synonymes: [],
    groupe: "test",
    sousFamille: null,
    sousGroupe: null,
    nutrimentsPour100g: new Map(),
    allergenes: allergenId
      ? [{ allergenId: allergenId as AllergenId, certitude: "contient" }]
      : [],
    saisonMois: [],
    touteAnnee: false,
    piquant: null,
    poidsPieceG: null,
    fondDePlacard: false,
    quantiteFigee: false,
    conditionnementG: null,
    origineAnimale: null,
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
        quantiteG: g(100),
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
  };
}

function constraints(allergies: readonly string[]): HardConstraints {
  return {
    allergies: allergies as readonly AllergenId[],
    diet: null,
    excludedFoodIds: [],
  };
}

describe("guards/assertNoDeclaredAllergen — ceinture de sécurité (§5.2 ARCHITECTURE)", () => {
  it("lève EngineSafetyError sur un cas violant construit à la main (recette conservée par erreur)", () => {
    const oeuf = food("oeuf", "oeufs");
    const omelette = recipeWithOneIngredient("omelette", "oeuf");
    const catalog: Catalog = {
      version: "test",
      foods: new Map([[oeuf.id, oeuf]]),
      recipes: new Map([[omelette.id, omelette]]),
      nutrients: [],
      allergens: new Map(),
      lexicon: new Map(),
      tips: [],
      evidence: new Map(),
      topics: new Map(),
      substitutions: new Map(),
      indexes: EMPTY_INDEXES,
    };

    // Bypass délibéré de la couche `allergenes` : la recette est passée telle quelle au
    // garde-fou comme si elle avait été (à tort) conservée par le pipeline.
    const candidatesMalgréTout = new Set([omelette.id]);

    expect(() =>
      assertNoDeclaredAllergen(
        candidatesMalgréTout,
        catalog,
        constraints(["oeufs"]),
      ),
    ).toThrow(EngineSafetyError);
  });

  it("ne lève rien quand les candidats conservés ne contiennent aucun allergène déclaré", () => {
    const carotte = food("carotte", null);
    const soupe = recipeWithOneIngredient("soupe", "carotte");
    const catalog: Catalog = {
      version: "test",
      foods: new Map([[carotte.id, carotte]]),
      recipes: new Map([[soupe.id, soupe]]),
      nutrients: [],
      allergens: new Map(),
      lexicon: new Map(),
      tips: [],
      evidence: new Map(),
      topics: new Map(),
      substitutions: new Map(),
      indexes: EMPTY_INDEXES,
    };

    expect(() =>
      assertNoDeclaredAllergen(
        new Set([soupe.id]),
        catalog,
        constraints(["oeufs"]),
      ),
    ).not.toThrow();
  });

  it("ne lève rien quand la recette à risque a bien été exclue en amont (pas dans candidates)", () => {
    const oeuf = food("oeuf", "oeufs");
    const omelette = recipeWithOneIngredient("omelette", "oeuf");
    const catalog: Catalog = {
      version: "test",
      foods: new Map([[oeuf.id, oeuf]]),
      recipes: new Map([[omelette.id, omelette]]),
      nutrients: [],
      allergens: new Map(),
      lexicon: new Map(),
      tips: [],
      evidence: new Map(),
      topics: new Map(),
      substitutions: new Map(),
      indexes: EMPTY_INDEXES,
    };

    expect(() =>
      assertNoDeclaredAllergen(new Set(), catalog, constraints(["oeufs"])),
    ).not.toThrow();
  });

  it("no-op immédiat quand aucune allergie n’est déclarée, même avec une recette à risque", () => {
    const oeuf = food("oeuf", "oeufs");
    const omelette = recipeWithOneIngredient("omelette", "oeuf");
    const catalog: Catalog = {
      version: "test",
      foods: new Map([[oeuf.id, oeuf]]),
      recipes: new Map([[omelette.id, omelette]]),
      nutrients: [],
      allergens: new Map(),
      lexicon: new Map(),
      tips: [],
      evidence: new Map(),
      topics: new Map(),
      substitutions: new Map(),
      indexes: EMPTY_INDEXES,
    };

    expect(() =>
      assertNoDeclaredAllergen(
        new Set([omelette.id]),
        catalog,
        constraints([]),
      ),
    ).not.toThrow();
  });

  it("ignore un recipeId orphelin (absent du catalogue) sans planter", () => {
    const catalog: Catalog = {
      version: "test",
      foods: new Map(),
      recipes: new Map(),
      nutrients: [],
      allergens: new Map(),
      lexicon: new Map(),
      tips: [],
      evidence: new Map(),
      topics: new Map(),
      substitutions: new Map(),
      indexes: EMPTY_INDEXES,
    };

    expect(() =>
      assertNoDeclaredAllergen(
        new Set(["inconnu" as RecipeId]),
        catalog,
        constraints(["oeufs"]),
      ),
    ).not.toThrow();
  });
});

// --- assertScoringLayersNeverExclude (§6.1/§6.3 ENGINE) ------------------------------------------
//
// Cas construits à la main, comme le garde-fou allergènes ci-dessus : `PipelineTrace` fournit deux
// comptes bruts (`scoringCandidateCount`, `scoringLayerCounts`) — le garde-fou ne fait que les
// comparer, il ne recalcule rien depuis un catalogue. Prouve que la vérification est réelle
// (elle lève sur un écart construit à la main), pas seulement déclarée par le type.

function traceWith(
  scoringCandidateCount: number,
  scoringLayerCounts: ReadonlyMap<ScoringLayerId, number>,
): PipelineTrace {
  return {
    layersRun: [],
    criticalLayerIds: [],
    excludedCandidateCounts: new Map(),
    scoringCandidateCount,
    scoringLayerCounts,
  };
}

describe("guards/assertScoringLayersNeverExclude — invariant §6.1 (aucune couche de score ne réduit les candidats)", () => {
  it("ne lève rien quand chaque couche exécutée a rendu exactement un score par candidat", () => {
    const trace = traceWith(
      3,
      new Map<ScoringLayerId, number>([
        ["nutri", 3],
        ["preference", 3],
      ]),
    );
    expect(() => assertScoringLayersNeverExclude(trace)).not.toThrow();
  });

  it("lève EngineSafetyError quand une couche FACTICE a omis un candidat (moins de scores que de candidats)", () => {
    const trace = traceWith(
      3,
      new Map<ScoringLayerId, number>([
        ["nutri", 3],
        ["preference", 2],
      ]),
    );
    expect(() => assertScoringLayersNeverExclude(trace)).toThrow(
      EngineSafetyError,
    );
  });

  it("le message nomme la couche fautive", () => {
    const trace = traceWith(
      3,
      new Map<ScoringLayerId, number>([["preference", 2]]),
    );
    expect(() => assertScoringLayersNeverExclude(trace)).toThrow(/preference/);
  });

  it("lève EngineSafetyError quand une couche a rendu PLUS de scores que de candidats (halluciné)", () => {
    const trace = traceWith(
      2,
      new Map<ScoringLayerId, number>([["craving", 3]]),
    );
    expect(() => assertScoringLayersNeverExclude(trace)).toThrow(
      EngineSafetyError,
    );
  });

  it("ne lève rien quand aucune couche n'a tourné (tous les poids à 0, scoringLayerCounts vide)", () => {
    const trace = traceWith(5, new Map());
    expect(() => assertScoringLayersNeverExclude(trace)).not.toThrow();
  });
});

// --- assertCriticalLayersRan (§6.3 ENGINE) -------------------------------------------------------
//
// Cas construits à la main, comme `assertScoringLayersNeverExclude` ci-dessus : `PipelineTrace`
// porte les deux comptes bruts que le garde-fou compare lui-même (`criticalLayerIds` — le
// sous-ensemble ATTENDU, `layersRun` — ce qui a RÉELLEMENT tourné), sans jamais faire confiance à
// une conclusion déjà tirée par l'appelant.

function traceWithLayersRun(
  layersRun: readonly string[],
  criticalLayerIds: readonly string[],
): PipelineTrace {
  return {
    layersRun: layersRun as PipelineTrace["layersRun"],
    criticalLayerIds: criticalLayerIds as PipelineTrace["criticalLayerIds"],
    excludedCandidateCounts: new Map(),
    scoringCandidateCount: 0,
    scoringLayerCounts: new Map(),
  };
}

describe("guards/assertCriticalLayersRan — invariant §6.3 (les couches critical ont bien tourné)", () => {
  it("ne lève rien quand toutes les couches critiques attendues figurent dans layersRun", () => {
    const trace = traceWithLayersRun(
      ["allergenes", "regime", "temps"],
      ["allergenes", "regime"],
    );
    expect(() => assertCriticalLayersRan(trace)).not.toThrow();
  });

  it("lève EngineSafetyError quand une trace AMPUTÉE omet une couche critique", () => {
    const trace = traceWithLayersRun(
      ["regime", "temps"],
      ["allergenes", "regime"],
    );
    expect(() => assertCriticalLayersRan(trace)).toThrow(EngineSafetyError);
  });

  it("le message nomme la couche critique manquante", () => {
    const trace = traceWithLayersRun(["temps"], ["allergenes", "regime"]);
    expect(() => assertCriticalLayersRan(trace)).toThrow(/allergenes/);
  });

  it("ne lève rien quand aucune couche n'est déclarée critique (criticalLayerIds vide)", () => {
    const trace = traceWithLayersRun([], []);
    expect(() => assertCriticalLayersRan(trace)).not.toThrow();
  });
});

// --- assertNoTherapeuticClaim (§6.2 ARCHITECTURE) ------------------------------------------------
//
// Cas construits à la main, comme les deux garde-fous ci-dessus — indépendants d'explain.ts (voir
// selection/explain.test.ts pour la non-régression sur les VRAIS gabarits produits par le moteur).
// Le lexique et sa normalisation sont dupliqués depuis catalog/build.mjs (voir guards/banned-terms.ts
// pour le pourquoi) ; tests/banned-terms-consistency.test.mjs, à la racine, garantit que les deux
// copies ne divergent jamais.

function explanationWithLabel(label: string): Explanation {
  return { criterion: "nutri", contribution: 0.3, label };
}

describe("guards/assertNoTherapeuticClaim — lexique banni (§6.2 ARCHITECTURE)", () => {
  it("lève EngineSafetyError sur un terme banni de la famille thérapeutique", () => {
    expect(() =>
      assertNoTherapeuticClaim([
        explanationWithLabel("Ce plat soigne les maux de ventre"),
      ]),
    ).toThrow(EngineSafetyError);
  });

  it("lève EngineSafetyError sur un terme banni de la famille jugement", () => {
    expect(() =>
      assertNoTherapeuticClaim([
        explanationWithLabel("Un aliment sain à privilégier"),
      ]),
    ).toThrow(EngineSafetyError);
  });

  it("détecte un terme banni indépendamment des accents et de la casse", () => {
    expect(() =>
      assertNoTherapeuticClaim([explanationWithLabel("Ce plat GUERIT tout")]),
    ).toThrow(EngineSafetyError);
  });

  it("ne lève rien quand aucune explication ne contient de terme banni", () => {
    expect(() =>
      assertNoTherapeuticClaim([
        explanationWithLabel("apports équilibrés pour ce repas"),
      ]),
    ).not.toThrow();
  });

  it("ne lève rien sur une liste vide", () => {
    expect(() => assertNoTherapeuticClaim([])).not.toThrow();
  });

  it("le message nomme le critère fautif", () => {
    expect(() =>
      assertNoTherapeuticClaim([explanationWithLabel("à éviter en excès")]),
    ).toThrow(/nutri/);
  });
});

// --- Les formes que le lexique laissait passer (mesuré le 2026-08-05) ---------------------------
//
// ⛔ CE QUI L'A MOTIVÉ. `docs/ETAT.md` documentait ce lexique comme « sur-bloquant » : la garde
// cherche des SOUS-CHAÎNES, donc « rincer SOIGNEusement » est rejeté. C'était la moitié rassurante
// du défaut. Le même choix SOUS-bloquait : `guérit`/`guérir` ne sont pas des sous-chaînes de
// « guérison », « guérissent » ni « guéri », et `thérapie` n'en est pas une de « thérapeutique ».
// La garde couvrait l'infinitif et la 3ᵉ personne, pas le nom ni le participe — soit les formes
// qu'on écrit le plus naturellement en français.
//
// La correction ne change PAS l'appariement (rester en sous-chaîne est le sens sûr de l'erreur) :
// elle raccourcit chaque entrée jusqu'au radical qui couvre sa famille. `guéri` attrape guérit,
// guérir, guérison, guérissent et guéri d'un seul tenant ; `thérap` attrape thérapie, thérapeute
// et thérapeutique.
describe("guards/assertNoTherapeuticClaim — les formes fléchies, pas seulement l'infinitif", () => {
  const FUITES: readonly string[] = [
    "La guérison passe par l'assiette",
    "Ces plantes guérissent l'insomnie",
    "Il en est guéri depuis",
    "Une approche thérapeutique de l'assiette",
    // `prévient la maladie` était une entrée-PHRASE : elle n'attrapait que ses propres mots
    // littéraux, donc ni le pluriel ni — surtout — la forme qu'on écrit vraiment.
    "Prévient les maladies cardiaques",
    "Prévient le cancer du côlon",
  ];

  for (const label of FUITES) {
    it(`lève sur « ${label} »`, () => {
      expect(() =>
        assertNoTherapeuticClaim([explanationWithLabel(label)]),
      ).toThrow(EngineSafetyError);
    });
  }

  it("ne s'est pas élargi au point d'attraper de la langue ordinaire", () => {
    // Le raccourcissement des entrées ne doit pas créer de NOUVEAU faux positif. « soigneusement »
    // en reste un — connu, documenté, et laissé tel quel : le corriger demanderait un appariement
    // par mot exact plus des listes de conjugaison complètes, soit un échec sûr échangé contre un
    // échec dangereux.
    for (const label of [
      "une cuisson douce et régulière",
      "des légumes de saison, crus ou cuits",
      "à préparer la veille si le temps manque",
    ]) {
      expect(() =>
        assertNoTherapeuticClaim([explanationWithLabel(label)]),
      ).not.toThrow();
    }
  });
});

describe("guards/banned-terms — la forme du lexique lui-même", () => {
  it("aucune entrée n'est sous-chaîne d'une autre — une entrée couverte ne peut jamais être signalée seule", () => {
    // Ce n'est pas de l'esthétique. `soigner` et `traiter` ÉTAIENT dans la liste alors que `soigne`
    // et `traite` y étaient aussi : ils ne pouvaient jamais apparaître sans eux, et le message
    // d'erreur listait « traite, traiter » pour un seul motif. Une entrée qui ne peut pas
    // discriminer est du bruit dans un message de sécurité — et donne à la liste une apparence de
    // couverture qu'elle n'a pas.
    const normalisees = BANNED_TERMS.map((t) =>
      t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),
    );
    const couvertes = normalisees.filter((terme, i) =>
      normalisees.some((autre, j) => i !== j && terme.includes(autre)),
    );
    expect(couvertes, `entrées déjà couvertes par une plus courte : ${couvertes.join(", ")}`).toEqual([]);
  });

  it("findBannedTerms rend LE terme du lexique, pas le texte apparié", () => {
    // Le message d'erreur cite l'entrée fautive pour que l'auteur sache quoi chercher dans la liste.
    expect(findBannedTerms("La guérison est en marche")).toEqual(["guéri"]);
  });
});
