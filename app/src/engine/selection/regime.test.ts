// engine/selection/regime.test.ts — couche d'exclusion `regime` (docs/ENGINE.md §6 ;
// docs/ARCHITECTURE.md §5.2).

import { describe, expect, it } from 'vitest'
import type { AnimalSource, Food, FoodId } from '../domain/index.js'
import { venantDe } from '../domain/index.js'
import { DIET_CHAIN, dietLayer, regimeExigePar } from './regime.js'
import { asExclusionResult, makeCatalog, makeFood, makeRecipe, makeRequest } from './test-fixtures.js'

describe('selection/regime — dietLayer', () => {
  it('est inerte quand aucun régime n’est déclaré (diet = null)', () => {
    const recette = makeRecipe('boeuf', { facettes: [{ facette: 'regime', valeur: 'omnivore' }] })
    const catalog = makeCatalog([recette])
    const req = makeRequest({ diet: null })

    const config = dietLayer.configure(req, catalog)
    const result = asExclusionResult(dietLayer.apply(new Set([recette.id]), config))

    expect(result.kept).toEqual(new Set([recette.id]))
    expect(result.rejected).toEqual([])
  })

  it('conserve une recette dont le régime demandé figure parmi ses facettes', () => {
    const recette = makeRecipe('dahl', { facettes: [{ facette: 'regime', valeur: 'vegetarien' }] })
    const catalog = makeCatalog([recette])
    const req = makeRequest({ diet: 'vegetarien' })

    const config = dietLayer.configure(req, catalog)
    const result = asExclusionResult(dietLayer.apply(new Set([recette.id]), config))

    expect(result.kept).toEqual(new Set([recette.id]))
  })

  it('exclut une recette dont le régime demandé ne figure PAS parmi ses facettes', () => {
    const recette = makeRecipe('boeuf', { facettes: [{ facette: 'regime', valeur: 'omnivore' }] })
    const catalog = makeCatalog([recette])
    const req = makeRequest({ diet: 'vegetarien' })

    const config = dietLayer.configure(req, catalog)
    const result = asExclusionResult(dietLayer.apply(new Set([recette.id]), config))

    expect(result.kept.size).toBe(0)
    expect(result.rejected).toEqual([
      { recipeId: recette.id, layerId: 'regime', reason: expect.stringContaining('vegetarien') },
    ])
  })

  it('exclut une recette sans AUCUNE facette régime quand un régime est demandé (ensemble vide)', () => {
    const recette = makeRecipe('mystere', { facettes: [] })
    const catalog = makeCatalog([recette])
    const req = makeRequest({ diet: 'vegetarien' })

    const config = dietLayer.configure(req, catalog)
    const result = asExclusionResult(dietLayer.apply(new Set([recette.id]), config))

    expect(result.kept.size).toBe(0)
  })

  it('conserve une recette multi-régime dès qu’UNE de ses valeurs correspond', () => {
    const recette = makeRecipe('polyvalente', {
      facettes: [
        { facette: 'regime', valeur: 'vegetarien' },
        { facette: 'regime', valeur: 'sans_gluten' },
      ],
    })
    const catalog = makeCatalog([recette])
    const req = makeRequest({ diet: 'sans_gluten' })

    const config = dietLayer.configure(req, catalog)
    const result = asExclusionResult(dietLayer.apply(new Set([recette.id]), config))

    expect(result.kept).toEqual(new Set([recette.id]))
  })

  it('id/kind/critical conformes au registre (§6.3 ENGINE)', () => {
    expect(dietLayer.id).toBe('regime')
    expect(dietLayer.kind).toBe('exclusion')
    expect(dietLayer.critical).toBe(true)
  })
})

describe('selection/regime — chaîne d’inclusion vegetalien ⊂ vegetarien ⊂ pescetarien ⊂ omnivore', () => {
  /** Une recette portant une seule facette `regime`, passée seule dans la couche. */
  function keptUnder(recipeDiet: string, requestedDiet: string): boolean {
    const recette = makeRecipe('plat', { facettes: [{ facette: 'regime', valeur: recipeDiet }] })
    const catalog = makeCatalog([recette])
    const req = makeRequest({ diet: requestedDiet })
    const config = dietLayer.configure(req, catalog)
    return asExclusionResult(dietLayer.apply(new Set([recette.id]), config)).kept.has(recette.id)
  }

  it('ÉLARGIT vers la gauche : un plat plus restrictif convient à une demande plus permissive', () => {
    expect(keptUnder('vegetalien', 'vegetarien')).toBe(true)
    expect(keptUnder('vegetalien', 'pescetarien')).toBe(true)
    expect(keptUnder('vegetalien', 'omnivore')).toBe(true)
    expect(keptUnder('vegetarien', 'pescetarien')).toBe(true)
    expect(keptUnder('vegetarien', 'omnivore')).toBe(true)
    expect(keptUnder('pescetarien', 'omnivore')).toBe(true)
  })

  // LA propriété de sûreté de ce lot. La chaîne ne doit JAMAIS faire entrer un plat plus
  // permissif que ce qui est demandé — sinon un utilisateur végétarien se verrait proposer de la
  // viande, ce qu'une couche 🔒 critique ne peut pas se permettre.
  it('n’élargit JAMAIS vers la droite : un plat plus permissif reste écarté', () => {
    expect(keptUnder('omnivore', 'pescetarien')).toBe(false)
    expect(keptUnder('omnivore', 'vegetarien')).toBe(false)
    expect(keptUnder('omnivore', 'vegetalien')).toBe(false)
    expect(keptUnder('pescetarien', 'vegetarien')).toBe(false)
    expect(keptUnder('pescetarien', 'vegetalien')).toBe(false)
    expect(keptUnder('vegetarien', 'vegetalien')).toBe(false)
  })

  it('un régime HORS chaîne retombe sur l’égalité stricte, dans les deux sens', () => {
    expect(keptUnder('sans_gluten', 'sans_gluten')).toBe(true)
    // `sans_gluten` ne s'emboîte dans rien : ni il n'ouvre les plats végétaliens…
    expect(keptUnder('vegetalien', 'sans_gluten')).toBe(false)
    // …ni il n'est ouvert par un régime de la chaîne.
    expect(keptUnder('sans_gluten', 'omnivore')).toBe(false)
  })

  it('l’égalité stricte reste vraie pour chaque maillon de la chaîne', () => {
    for (const diet of DIET_CHAIN) expect(keptUnder(diet, diet)).toBe(true)
  })

  it('DIET_CHAIN est ordonnée du plus restrictif au plus permissif', () => {
    expect(DIET_CHAIN).toEqual(['vegetalien', 'vegetarien', 'pescetarien', 'omnivore'])
  })
})

describe('selection/regime — regimeExigePar lit la PROVENANCE, jamais le groupe', () => {
  const catalogue = (...aliments: readonly Food[]): ReadonlyMap<FoodId, Food> =>
    new Map(aliments.map((f) => [f.id, f]))

  const regimeDe = (food: Food, ...autres: readonly Food[]): string =>
    regimeExigePar(food, catalogue(food, ...autres))

  // ⛔ LE DÉFAUT DU 2026-08-10, DANS LES DEUX SENS. La règle précédente lisait `food.groupe` :
  // « mammifère hors groupe viandes » valait végétarien. Ces deux tests fixent l'abandon du groupe
  // en croisant les deux axes — un `corps` HORS « viandes » et une `production` DANS « viandes ».
  // Tant qu'ils passent, aucune réécriture ne peut refaire dépendre le régime du rayon.
  it('un CORPS hors du groupe « viandes » exige omnivore', () => {
    const bouillon = makeFood('bouillon_boeuf', [], {
      groupe: 'condiments',
      origineAnimale: venantDe('mammifere', 'corps'),
    })
    expect(regimeDe(bouillon)).toBe('omnivore')
  })

  it('une PRODUCTION dans le groupe « viandes » s’arrête à végétarien', () => {
    // Aucun aliment réel ne ressemble à ça : c'est précisément l'intérêt du test. Il échoue si
    // quiconque réintroduit `groupe` dans la décision, et il ne peut échouer pour rien d'autre.
    const impossible = makeFood('lait_mal_range', [], {
      groupe: 'viandes',
      origineAnimale: venantDe('mammifere', 'production'),
    })
    expect(regimeDe(impossible)).toBe('vegetarien')
  })

  it.each([
    ['gelatine', 'condiments', 'mammifere'],
    ['saindoux', 'matières grasses', 'mammifere'],
    ['guimauve', 'produits sucrés', 'mammifere'],
    ['bouillon_volaille', 'condiments', 'volaille'],
    ['graisse_canard', 'matières grasses', 'volaille'],
  ] as const)('%s (%s) vient d’un corps animal : omnivore', (id, groupe, origine) => {
    const aliment = makeFood(id, [], { groupe, origineAnimale: venantDe(origine, 'corps') })
    expect(regimeDe(aliment)).toBe('omnivore')
  })

  it.each([
    ['lait_entier', 'lait et produits laitiers', 'mammifere'],
    ['oeuf', 'œufs', 'volaille'],
    ['chocolat_lait', 'produits sucrés', 'mammifere'],
    ['meringue', 'produits sucrés', 'volaille'],
  ] as const)('%s est produit PAR l’animal : végétarien', (id, groupe, origine) => {
    const aliment = makeFood(id, [], {
      groupe,
      origineAnimale: venantDe(origine, 'production'),
    })
    expect(regimeDe(aliment)).toBe('vegetarien')
  })

  it('la provenance se PROPAGE le long de deriveDe, comme l’origine', () => {
    const lait = makeFood('lait_entier', [], {
      groupe: 'lait et produits laitiers',
      origineAnimale: venantDe('mammifere', 'production'),
    })
    // Le beurre ne déclare RIEN : il tient les deux faits de son ascendant.
    const beurre = makeFood('beurre_doux', [], { groupe: 'matières grasses', deriveDe: 'lait_entier' })
    expect(regimeDe(beurre, lait)).toBe('vegetarien')

    const boeuf = makeFood('boeuf_paleron', [], {
      groupe: 'viandes',
      origineAnimale: venantDe('mammifere', 'corps'),
    })
    const fond = makeFood('fond_de_boeuf', [], { groupe: 'condiments', deriveDe: 'boeuf_paleron' })
    expect(regimeDe(fond, boeuf)).toBe('omnivore')
  })

  it('les autres origines sont inchangées — le poisson et le miel ne dépendent pas de la provenance', () => {
    const thon = makeFood('thon_frais', [], {
      groupe: 'poissons',
      origineAnimale: venantDe('poisson', 'corps'),
    })
    const miel = makeFood('miel', [], {
      groupe: 'produits sucrés',
      origineAnimale: venantDe('insecte', 'production'),
    })
    const carotte = makeFood('carotte', [], { groupe: 'légumes' })

    expect(regimeDe(thon)).toBe('pescetarien')
    expect(regimeDe(miel)).toBe('vegetarien')
    expect(regimeDe(carotte)).toBe('vegetalien')
  })

  // ⚠️ Le build REFUSE une origine sans provenance (catalog/build.mjs) — ce cas ne peut donc pas
  // venir du catalogue. Il peut venir d'ailleurs : `regimeExigeParIngredients` tourne sur des
  // recettes composées par l'utilisateur, contre un `user.db` qui n'a aucune clé étrangère vers le
  // catalogue. En l'absence du fait, on n'affirme pas « végétarien » — on rend le plus permissif,
  // donc le plus restrictif à l'usage, comme le fait déjà `regimeExigeParIngredients` sans
  // ingrédient connu.
  // ⚠️ LE CAST EST LA CONSÉQUENCE DU LOT 66, PAS UN CONTOURNEMENT. `origineAnimale` est une paire
  // depuis ce lot : une origine sans provenance ne s'écrit plus, et c'était le but. La polarité
  // reste mesurée parce que `regimeDe` tourne aussi sur des recettes perso, contre un `user.db` qui
  // n'a aucune clé étrangère vers le catalogue — le cas d'entrée décrit juste au-dessus.
  it('une origine animale SANS provenance ne conclut pas à végétarien', () => {
    const sansProvenance = { origine: 'mammifere' } as AnimalSource
    const inconnu = makeFood('extrait_mystere', [], {
      groupe: 'condiments',
      origineAnimale: sansProvenance,
    })
    expect(regimeDe(inconnu)).toBe('omnivore')
  })
})
