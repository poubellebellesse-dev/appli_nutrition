// engine/selection/scoring/variety.test.ts — couche de score `variety` (docs/ENGINE.md §6.5
// précision 5, §13 fenêtre d'historique).

import { describe, expect, it } from 'vitest'
import { VARIETY_RECENCY_OVERLAP_THRESHOLD, scoreVariety, varietyLayer } from './variety.js'
import { asScoringResult, makeCatalog, makeFood, makeIngredient, makeRecipe, makeRequest } from '../test-fixtures.js'
import type { Food, MealHistory, MealHistoryEntry, Recipe, RecipeId, FoodId } from '../../domain/index.js'

const RECIPE = 'tartiflette' as RecipeId
const AUTRE_RECIPE = 'salade' as RecipeId
const INGREDIENT_PRINCIPAL = 'reblochon' as FoodId

function entry(recipeId: RecipeId, date: string, origine: MealHistoryEntry['origine'] = 'choisi'): MealHistoryEntry {
  return { recipeId, date, creneau: 'diner', origine }
}

function history(entries: readonly MealHistoryEntry[]): MealHistory {
  return { windowDays: 21, entries }
}

describe('scoring/variety — scoreVariety', () => {
  it('jamais vu, familiarité neutre (0.5) → score neutre (0.5)', () => {
    const score = scoreVariety({
      recipeId: RECIPE,
      signature: new Map(),
      history: history([]),
      today: '2026-07-24',
      familiarity: 0.5,
    })
    expect(score).toBeCloseTo(0.5, 10)
  })

  it('jamais vu, familiarité 0 (pure nouveauté) → score maximal', () => {
    const score = scoreVariety({
      recipeId: RECIPE,
      signature: new Map(),
      history: history([]),
      today: '2026-07-24',
      familiarity: 0,
    })
    expect(score).toBe(1)
  })

  it('vu aujourd’hui même, familiarité 0 → score minimal (aucune nouveauté)', () => {
    const score = scoreVariety({
      recipeId: RECIPE,
      signature: new Map(),
      history: history([entry(RECIPE, '2026-07-24')]),
      today: '2026-07-24',
      familiarity: 0,
    })
    expect(score).toBeCloseTo(0, 10)
  })

  it('familiarity = 1 INVERSE le signal : un plat récent marque mieux qu’un plat jamais vu', () => {
    const scoreRecent = scoreVariety({
      recipeId: RECIPE,
      signature: new Map(),
      history: history([entry(RECIPE, '2026-07-24')]), // vu aujourd'hui
      today: '2026-07-24',
      familiarity: 1,
    })
    const scoreJamaisVu = scoreVariety({
      recipeId: AUTRE_RECIPE,
      signature: new Map(),
      history: history([entry(RECIPE, '2026-07-24')]), // n'a rien à voir avec AUTRE_RECIPE
      today: '2026-07-24',
      familiarity: 1,
    })
    expect(scoreRecent).toBeGreaterThan(scoreJamaisVu)
    expect(scoreRecent).toBeCloseTo(1, 10)
    expect(scoreJamaisVu).toBeCloseTo(0, 10)
  })

  it('décroissance exponentielle : ancienneté de 7 jours (TAU) → recence = e^-1', () => {
    const score = scoreVariety({
      recipeId: RECIPE,
      signature: new Map(),
      history: history([entry(RECIPE, '2026-07-17')]), // 7 jours avant le 24
      today: '2026-07-24',
      familiarity: 0, // score = nouveauté = 1 - recence
    })
    expect(score).toBeCloseTo(1 - Math.exp(-1), 10)
  })

  it('récence portée sur la COMPOSITION via signatureByRecipe, pas seulement la recette', () => {
    const signatureByRecipe = new Map([[AUTRE_RECIPE, new Map([[INGREDIENT_PRINCIPAL, 1]])]])
    // AUTRE_RECIPE (jamais demandée ici) a la même composition que RECIPE.
    const score = scoreVariety({
      recipeId: RECIPE,
      signature: new Map([[INGREDIENT_PRINCIPAL, 1]]),
      history: history([entry(AUTRE_RECIPE, '2026-07-24')]),
      today: '2026-07-24',
      familiarity: 0,
      signatureByRecipe,
    })
    // même ingrédient principal vu aujourd'hui → recence=1 → nouveauté=0 → score=0 (pas jamais-vu=1)
    expect(score).toBeCloseTo(0, 10)
  })

  it('prend la PLUS RÉCENTE des deux occurrences (recette / composition proche)', () => {
    const signatureByRecipe = new Map([[AUTRE_RECIPE, new Map([[INGREDIENT_PRINCIPAL, 1]])]])
    const score = scoreVariety({
      recipeId: RECIPE,
      signature: new Map([[INGREDIENT_PRINCIPAL, 1]]),
      history: history([
        entry(RECIPE, '2026-06-01'), // ancien
        entry(AUTRE_RECIPE, '2026-07-24'), // même composition, très récent
      ]),
      today: '2026-07-24',
      familiarity: 0,
      signatureByRecipe,
    })
    expect(score).toBeCloseTo(0, 10) // domine par l'occurrence la plus récente (aujourd'hui)
  })

  // -------------------------------------------------------------------------------------
  // RÉGRESSION — décision 31. La règle comparait l'ingrédient LE PLUS LOURD, ce qui rendait
  // « récentes » des recettes sans rapport : 194 paires sur 290 du catalogue réel (67 %).
  // -------------------------------------------------------------------------------------
  it('deux plats qui ne partagent qu’un ingrédient MARGINAL ne se rendent pas « récents »', () => {
    // Reproduit « mousse au chocolat » × « galettes de sarrasin » : l'œuf pèse le plus dans les
    // deux, mais chacune est par ailleurs un plat entièrement différent. Chevauchement ≈ 23 %,
    // sous le seuil mesuré de 45 %.
    const mousse = 'mousse' as RecipeId
    const galettes = 'galettes' as RecipeId
    const signatureByRecipe = new Map([
      [galettes, new Map([['oeuf' as FoodId, 0.25], ['sarrasin' as FoodId, 0.5], ['jambon' as FoodId, 0.25]])],
    ])

    const score = scoreVariety({
      recipeId: mousse,
      signature: new Map([['oeuf' as FoodId, 0.6], ['chocolat' as FoodId, 0.4]]),
      history: history([entry(galettes, '2026-07-24')]), // mangées aujourd'hui
      today: '2026-07-24',
      familiarity: 0,
      signatureByRecipe,
    })

    // Aucun rapprochement : la mousse reste « jamais vue », score de pure nouveauté.
    expect(score).toBe(1)
  })

  it('deux plats de composition VRAIMENT proche se rendent bien « récents »', () => {
    // Contre-épreuve : un seuil qui ne déclenche jamais ne vaut pas mieux qu'un seuil qui
    // déclenche toujours.
    const a = 'boeuf_a' as RecipeId
    const b = 'boeuf_b' as RecipeId
    const signatureByRecipe = new Map([
      [b, new Map([['boeuf' as FoodId, 0.5], ['tomate' as FoodId, 0.5]])],
    ])

    const score = scoreVariety({
      recipeId: a,
      signature: new Map([['boeuf' as FoodId, 0.55], ['tomate' as FoodId, 0.45]]),
      history: history([entry(b, '2026-07-24')]),
      today: '2026-07-24',
      familiarity: 0,
      signatureByRecipe,
    })

    expect(score).toBeCloseTo(0, 10) // vu aujourd'hui via la composition → aucune nouveauté
  })

  it('le seuil de récence est plus EXIGEANT que celui d’un simple ingrédient partagé', () => {
    // Verrouille la valeur mesurée sans la figer au centième : ce qui compte est qu'elle exige
    // une part substantielle de composition commune, pas un simple contact.
    expect(VARIETY_RECENCY_OVERLAP_THRESHOLD).toBeGreaterThan(0.35)
    expect(VARIETY_RECENCY_OVERLAP_THRESHOLD).toBeLessThan(0.55)
  })

  it('entrée d’historique postérieure à today → ignorée', () => {
    const score = scoreVariety({
      recipeId: RECIPE,
      signature: new Map(),
      history: history([entry(RECIPE, '2026-08-01')]), // après today
      today: '2026-07-24',
      familiarity: 0,
    })
    expect(score).toBe(1) // traité comme jamais vu
  })

  it('override "surprise" force familiarity=0, prime sur la modulation demandée', () => {
    const score = scoreVariety({
      recipeId: RECIPE,
      signature: new Map(),
      history: history([entry(RECIPE, '2026-07-24')]), // vu aujourd'hui
      today: '2026-07-24',
      familiarity: 1, // demanderait normalement un bonus de familiarité
      override: 'surprise',
    })
    expect(score).toBeCloseTo(0, 10) // se comporte comme familiarity=0 : pas de bonus
  })

  it('override "classiques" force familiarity=1, prime sur la modulation demandée', () => {
    const score = scoreVariety({
      recipeId: RECIPE,
      signature: new Map(),
      history: history([entry(RECIPE, '2026-07-24')]), // vu aujourd'hui
      today: '2026-07-24',
      familiarity: 0, // demanderait normalement de la pure nouveauté
      override: 'classiques',
    })
    expect(score).toBeCloseTo(1, 10) // se comporte comme familiarity=1 : bonus de familiarité
  })

  it('reste dans [0, 1]', () => {
    const score = scoreVariety({
      recipeId: RECIPE,
      signature: new Map(),
      history: history([entry(RECIPE, '2026-07-23')]),
      today: '2026-07-24',
      familiarity: 0.5,
    })
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  describe('tauDays — cran réglable (§6.5 ter ENGINE)', () => {
    // Valeurs de référence doc/ENGINE.md §6.5 ter : plat vu il y a exactement 7 jours,
    // familiarity: 0 (le score EST la nouveauté).
    it('TAU=3 → nouveauté ≈ 0.90 pour un plat vu il y a 7 jours', () => {
      const score = scoreVariety({
        recipeId: RECIPE,
        signature: new Map(),
        history: history([entry(RECIPE, '2026-07-17')]),
        today: '2026-07-24',
        familiarity: 0,
        tauDays: 3,
      })
      expect(score).toBeCloseTo(0.9, 2)
    })

    it('TAU=7 → nouveauté ≈ 0.63 pour un plat vu il y a 7 jours', () => {
      const score = scoreVariety({
        recipeId: RECIPE,
        signature: new Map(),
        history: history([entry(RECIPE, '2026-07-17')]),
        today: '2026-07-24',
        familiarity: 0,
        tauDays: 7,
      })
      expect(score).toBeCloseTo(0.63, 2)
    })

    it('TAU=14 → nouveauté ≈ 0.39 pour un plat vu il y a 7 jours', () => {
      const score = scoreVariety({
        recipeId: RECIPE,
        signature: new Map(),
        history: history([entry(RECIPE, '2026-07-17')]),
        today: '2026-07-24',
        familiarity: 0,
        tauDays: 14,
      })
      expect(score).toBeCloseTo(0.39, 2)
    })

    it('non-régression : sans tauDays, résultat identique à tauDays: 7', () => {
      const args = {
        recipeId: RECIPE,
        signature: new Map(),
        history: history([entry(RECIPE, '2026-07-17')]),
        today: '2026-07-24',
        familiarity: 0,
      }
      const scoreParDefaut = scoreVariety(args)
      const scoreExplicite7 = scoreVariety({ ...args, tauDays: 7 })
      expect(scoreParDefaut).toBeCloseTo(scoreExplicite7, 10)
    })

    it('override "surprise" prime sur la modulation quel que soit le cran', () => {
      for (const tauDays of [3, 7, 14] as const) {
        const score = scoreVariety({
          recipeId: RECIPE,
          signature: new Map(),
          history: history([entry(RECIPE, '2026-07-24')]), // vu aujourd'hui
          today: '2026-07-24',
          familiarity: 1, // demanderait normalement un bonus de familiarité
          override: 'surprise',
          tauDays,
        })
        expect(score).toBeCloseTo(0, 10) // se comporte comme familiarity=0, quel que soit tauDays
      }
    })

    it('override "classiques" prime sur la modulation quel que soit le cran', () => {
      for (const tauDays of [3, 7, 14] as const) {
        const score = scoreVariety({
          recipeId: RECIPE,
          signature: new Map(),
          history: history([entry(RECIPE, '2026-07-24')]), // vu aujourd'hui
          today: '2026-07-24',
          familiarity: 0, // demanderait normalement de la pure nouveauté
          override: 'classiques',
          tauDays,
        })
        expect(score).toBeCloseTo(1, 10) // se comporte comme familiarity=1, quel que soit tauDays
      }
    })
  })
})

describe('scoring/variety — varietyLayer (contrat SelectionLayer, §6.2 ENGINE)', () => {
  it('id/kind/critical/defaultWeight conformes au registre (§6.3 ENGINE)', () => {
    expect(varietyLayer.id).toBe('variety')
    expect(varietyLayer.kind).toBe('scoring')
    expect(varietyLayer.critical).toBe(false)
    expect(varietyLayer.defaultWeight).toBe(0.15)
  })

  it('invariant §6.1 : un score par candidat reçu, aucune réduction — y compris sans historique', () => {
    const soupe = makeRecipe('soupe')
    const gratin = makeRecipe('gratin')
    const catalog = makeCatalog([soupe, gratin])
    const req = makeRequest({ date: '2026-07-24' })

    const config = varietyLayer.configure(req, catalog)
    const result = asScoringResult(varietyLayer.apply(new Set([soupe.id, gratin.id]), config))

    expect(result.scores.size).toBe(2)
  })

  it('historique vide → jamais vu, familiarité neutre (habit à froid) → score neutre (0.5)', () => {
    const recette = makeRecipe('r')
    const catalog = makeCatalog([recette])
    const req = makeRequest({ date: '2026-07-24', history: { windowDays: 21, entries: [] } })

    const config = varietyLayer.configure(req, catalog)
    const result = asScoringResult(varietyLayer.apply(new Set([recette.id]), config))

    expect(result.scores.get(recette.id)).toBeCloseTo(0.5, 10)
  })

  it('candidat absent du catalogue (id orphelin) → score valide, pas de plantage', () => {
    const catalog = makeCatalog([])
    const req = makeRequest({ date: '2026-07-24' })
    const config = varietyLayer.configure(req, catalog)

    const result = asScoringResult(varietyLayer.apply(new Set(['inconnu' as RecipeId]), config))

    expect(result.scores.get('inconnu' as RecipeId)).toBeCloseTo(0.5, 10)
  })

  it('tous les scores restent dans [0, 1]', () => {
    const recette = makeRecipe('vu-recemment')
    const catalog = makeCatalog([recette])
    const req = makeRequest({
      date: '2026-07-24',
      history: { windowDays: 21, entries: [{ recipeId: recette.id, date: '2026-07-24', creneau: 'diner', origine: 'choisi' }] },
    })

    const config = varietyLayer.configure(req, catalog)
    const result = asScoringResult(varietyLayer.apply(new Set([recette.id]), config))

    for (const score of result.scores.values()) {
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    }
  })

  it('cas discriminant : une recette jamais vue bat une recette vue aujourd’hui, familiarité apprise restant faible', () => {
    const vueAujourdhui = makeRecipe('vue-aujourdhui')
    const jamaisVue = makeRecipe('jamais-vue')
    const catalog = makeCatalog([vueAujourdhui, jamaisVue])
    // 4 entrées `choisi` au total, une seule concernant vueAujourdhui → familiarité apprise basse
    // (0.25, via scoreHabit) pour elle, nulle pour jamaisVue : la comparaison reste dominée par la
    // nouveauté, pas par un bonus de familiarité saturé.
    const entries: MealHistoryEntry[] = [
      { recipeId: vueAujourdhui.id, date: '2026-07-24', creneau: 'diner', origine: 'choisi' },
      { recipeId: 'r1' as RecipeId, date: '2026-07-20', creneau: 'diner', origine: 'choisi' },
      { recipeId: 'r2' as RecipeId, date: '2026-07-15', creneau: 'diner', origine: 'choisi' },
      { recipeId: 'r3' as RecipeId, date: '2026-07-10', creneau: 'diner', origine: 'choisi' },
    ]
    const req = makeRequest({ date: '2026-07-24', history: { windowDays: 21, entries } })

    const config = varietyLayer.configure(req, catalog)
    const result = asScoringResult(varietyLayer.apply(new Set([vueAujourdhui.id, jamaisVue.id]), config))

    expect(result.scores.get(jamaisVue.id)!).toBeGreaterThan(result.scores.get(vueAujourdhui.id)!)
    expect(result.scores.get(jamaisVue.id)).toBeCloseTo(1, 10)
    expect(result.scores.get(vueAujourdhui.id)).toBeCloseTo(0.25, 10)
  })

  it('familiarity vient de `scoreHabit` (fonction pure, pas `habitLayer`) — un historique riche en `choisi` inverse le classement', () => {
    const vueAujourdhui = makeRecipe('vue-aujourdhui')
    const jamaisVue = makeRecipe('jamais-vue')
    const catalog = makeCatalog([vueAujourdhui, jamaisVue])
    // Beaucoup d'entrées `choisi` de vueAujourdhui → familiarité apprise élevée → le bonus de
    // familiarité s'active pour elle (§6.5 précision 5 : familiarity → 1 inverse le signal).
    const entries: MealHistoryEntry[] = [
      { recipeId: vueAujourdhui.id, date: '2026-07-24', creneau: 'diner', origine: 'choisi' },
      { recipeId: vueAujourdhui.id, date: '2026-07-23', creneau: 'diner', origine: 'choisi' },
      { recipeId: vueAujourdhui.id, date: '2026-07-22', creneau: 'diner', origine: 'choisi' },
      { recipeId: vueAujourdhui.id, date: '2026-07-21', creneau: 'diner', origine: 'choisi' },
    ]
    const req = makeRequest({ date: '2026-07-24', history: { windowDays: 21, entries } })

    const config = varietyLayer.configure(req, catalog)
    const result = asScoringResult(varietyLayer.apply(new Set([vueAujourdhui.id, jamaisVue.id]), config))

    // familiarité(vueAujourdhui) = 4/4 = 1 (toutes les entrées la concernent) → bonus de
    // familiarité plein : score = 1 - nouveauté = 1 - 0 = 1, au sommet.
    expect(result.scores.get(vueAujourdhui.id)).toBeCloseTo(1, 10)
  })
})

describe('scoring/variety — varietyMode (§8.1 ENGINE, câblage P1c)', () => {
  /** Historique où `vueAujourdhui` est à la fois TRÈS récente et TRÈS familière : sans override,
   * `habit` la remonte au sommet (voir le test précédent). C'est le cas qui distingue vraiment les
   * trois positions — un historique vide les rendrait toutes identiques. */
  const entries: readonly MealHistoryEntry[] = [
    { recipeId: 'vue-aujourdhui' as RecipeId, date: '2026-07-24', creneau: 'diner', origine: 'choisi' },
    { recipeId: 'vue-aujourdhui' as RecipeId, date: '2026-07-23', creneau: 'diner', origine: 'choisi' },
    { recipeId: 'vue-aujourdhui' as RecipeId, date: '2026-07-22', creneau: 'diner', origine: 'choisi' },
    { recipeId: 'vue-aujourdhui' as RecipeId, date: '2026-07-21', creneau: 'diner', origine: 'choisi' },
  ]

  function scoreVueAujourdhui(varietyMode?: 'auto' | 'surprise' | 'classiques'): number {
    const vueAujourdhui = makeRecipe('vue-aujourdhui')
    const catalog = makeCatalog([vueAujourdhui])
    const req = makeRequest({
      date: '2026-07-24',
      history: { windowDays: 21, entries },
      ...(varietyMode === undefined ? {} : { varietyMode }),
    })

    const config = varietyLayer.configure(req, catalog)
    const result = asScoringResult(varietyLayer.apply(new Set([vueAujourdhui.id]), config))
    return result.scores.get(vueAujourdhui.id)!
  }

  it('absent → aucun override, la modulation par `habit` s’applique (score 1, bonus de familiarité)', () => {
    expect(scoreVueAujourdhui()).toBeCloseTo(1, 10)
  })

  it("'auto' est EXACTEMENT équivalent à l'absence — la position auto n'existe pas dans VarietyOverride", () => {
    expect(scoreVueAujourdhui('auto')).toBeCloseTo(scoreVueAujourdhui(), 10)
  })

  it("'surprise' force familiarity=0 et prime sur `habit` : la recette vue aujourd’hui tombe à 0", () => {
    // Sans override elle vaut 1 (bonus de familiarité) — l'override inverse complètement le verdict.
    expect(scoreVueAujourdhui('surprise')).toBeCloseTo(0, 10)
  })

  it("'classiques' force familiarity=1 : une recette JAMAIS vue tombe à 0, sans historique pour l’expliquer", () => {
    const jamaisVue = makeRecipe('jamais-vue')
    const catalog = makeCatalog([jamaisVue])
    const req = makeRequest({ date: '2026-07-24', history: { windowDays: 21, entries }, varietyMode: 'classiques' })

    const config = varietyLayer.configure(req, catalog)
    const result = asScoringResult(varietyLayer.apply(new Set([jamaisVue.id]), config))

    // recence=0 → nouveaute=1 ; familiarity forcée à 1 → score = 1 - nouveaute = 0.
    expect(result.scores.get(jamaisVue.id)).toBeCloseTo(0, 10)
  })

  it('l’override est résolu une fois au `configure`, pas par candidat', () => {
    const catalog = makeCatalog([makeRecipe('a')])
    expect(varietyLayer.configure(makeRequest({ varietyMode: 'surprise' }), catalog).override).toBe('surprise')
    expect(varietyLayer.configure(makeRequest({ varietyMode: 'auto' }), catalog).override).toBeNull()
    expect(varietyLayer.configure(makeRequest(), catalog).override).toBeNull()
  })
})

describe('scoring/variety — récence par SOUS-FAMILLE (§6.6 quater, décision 31)', () => {
  // Deux morceaux du même animal = deux aliments distincts du catalogue. C'est le cas réel qui a
  // motivé `Food.sousFamille` : sans repli, rien n'exprime que c'est le même produit de base.
  const POULET_BLANC = makeFood('poulet_blanc', [], { sousFamille: 'poulet' })
  const POULET_CUISSE = makeFood('poulet_cuisse', [], { sousFamille: 'poulet' })
  const AGNEAU = makeFood('agneau_gigot', [], { sousFamille: 'agneau' })
  const CAROTTE = makeFood('carotte')

  function platDe(id: string, foodId: string) {
    return makeRecipe(id, {
      ingredients: [makeIngredient(foodId, { quantiteG: 400 }), makeIngredient('carotte', { quantiteG: 100 })],
    })
  }

  /**
   * Score de `candidat` sachant que `mange` a été mangé la veille. Plus bas = jugé plus répétitif.
   *
   * ⚠️ `varietyMode: 'surprise'` n'est PAS décoratif : il force `familiarity` à 0, donc
   * `score = nouveaute`, ce qui isole la RÉCENCE — la seule chose testée ici. Sans lui, `habit`
   * reconnaîtrait la même composition, `familiarity` monterait à 1 et `scoreVariety` basculerait en
   * bonus de familiarité : le score REMONTERAIT au lieu de descendre, pour la même raison. Les deux
   * comportements sont corrects mais opposés, et mesurer les deux à la fois ne prouve rien.
   */
  function scoreApres(candidat: Recipe, mange: Recipe, foods: readonly Food[]): number {
    const catalog = makeCatalog([candidat, mange], foods)
    const req = makeRequest({
      date: '2026-07-24',
      history: { windowDays: 21, entries: [entry(mange.id, '2026-07-23')] },
      varietyMode: 'surprise',
    })
    const config = varietyLayer.configure(req, catalog)
    return asScoringResult(varietyLayer.apply(new Set([candidat.id]), config)).scores.get(candidat.id)!
  }

  it('la couche lit `recipeFamilySignature`, pas `recipeSignature` — c’est CE câblage qui est testé', () => {
    const catalog = makeCatalog([platDe('a', 'poulet_blanc')], [POULET_BLANC, CAROTTE])
    const config = varietyLayer.configure(makeRequest(), catalog)

    expect(config.signatureByRecipe).toBe(catalog.indexes.recipeFamilySignature)
    expect(config.signatureByRecipe).not.toBe(catalog.indexes.recipeSignature)
  })

  it('CAS CORRIGÉ : du poulet mangé hier rend répétitif un plat au poulet d’un AUTRE morceau', () => {
    const teriyaki = platDe('poulet_teriyaki', 'poulet_cuisse')
    const curry = platDe('poulet_curry', 'poulet_blanc')

    const score = scoreApres(teriyaki, curry, [POULET_BLANC, POULET_CUISSE, CAROTTE])

    // Les deux signatures brutes n'ont que la carotte en commun (20 %) — sous le seuil. Repliées sur
    // `poulet`, elles sont identiques : la récence se déclenche et écrase le score de nouveauté.
    // Valeur attendue : 1 − exp(−1/7), la décroissance d'un plat vu il y a exactement un jour.
    expect(score).toBeCloseTo(1 - Math.exp(-1 / 7), 10)
    expect(score).toBeLessThan(0.2)
  })

  it('CONTRE-ÉPREUVE : un plat d’agneau n’est PAS rendu répétitif par du poulet', () => {
    // Le garde-fou de la mesure : replier sur `Food.groupe` (« viandes ») rendait tout plat carné
    // équivalent à tout autre. La sous-famille doit rester d'un cran plus fine.
    const agneau = platDe('gigot', 'agneau_gigot')
    const curry = platDe('poulet_curry', 'poulet_blanc')

    const score = scoreApres(agneau, curry, [POULET_BLANC, AGNEAU, CAROTTE])

    // Aucun rapprochement : la recette n'a jamais été vue → recence=0 → nouveaute=1.
    expect(score).toBe(1)
  })

  it('sans sous-famille déclarée, deux aliments distincts restent distincts — le repli n’invente rien', () => {
    const sansFamille = [makeFood('poulet_blanc'), makeFood('poulet_cuisse'), CAROTTE]
    const teriyaki = platDe('poulet_teriyaki', 'poulet_cuisse')
    const curry = platDe('poulet_curry', 'poulet_blanc')

    expect(scoreApres(teriyaki, curry, sansFamille)).toBe(1)
  })
})
