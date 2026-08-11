// engine/selection/regime-admission.test.ts — lot D1 : la SECONDE CHANCE de `dietLayer`
// (`HardConstraints.admittedFoodIds`) et ses quatre propriétés de sûreté.
//
// Fichier séparé de `regime.test.ts` : celui-ci couvre la couche telle qu'elle était, celui-là le
// chemin ajouté. Les deux tournent sur les mêmes fixtures montées à la main.
//
// ⚠️ AUCUNE TAILLE DE CATALOGUE ICI. Cinq aliments, une ou deux recettes, et des assertions qui
// portent sur des RELATIONS — « avec l'exception elle passe, sans elle non ». Le pendant sur le
// catalogue RÉEL (P1 : l'ensemble retenu ne bouge pas) vit dans `tests/`, parce qu'il lui faut
// `data/` — import interdit dans `engine/` (tests/engine-boundaries.test.ts).

import { describe, expect, it } from 'vitest'
import type { AllergenId } from '../domain/index.js'
import { DIET_CHAIN, dietLayer } from './regime.js'
import { runExclusionPass } from './index.js'
import {
  asExclusionResult,
  makeCatalog,
  makeFood,
  makeIngredient,
  makeRecipe,
  makeRequest,
} from './test-fixtures.js'

const MIEL = makeFood('miel', [], {
  groupe: 'produits sucrés',
  origineAnimale: 'insecte',
  provenanceAnimale: 'production',
})
const OEUF = makeFood('oeuf', [], {
  groupe: 'œufs',
  origineAnimale: 'volaille',
  provenanceAnimale: 'production',
})
const LAIT = makeFood('lait_entier', [], {
  groupe: 'lait et produits laitiers',
  origineAnimale: 'mammifere',
  provenanceAnimale: 'production',
})
/** Dérivé du lait SANS le déclarer — c'est la cascade `deriveDe` (acquis n° 5). */
const BEURRE = makeFood('beurre_doux', [], { groupe: 'matières grasses', deriveDe: 'lait_entier' })
const TOFU = makeFood('tofu', [], { groupe: 'légumineuses' })

const ALIMENTS = [MIEL, OEUF, LAIT, BEURRE, TOFU]

const regimeFacette = (valeur: string) => [{ facette: 'regime' as const, valeur }]

/** Le cas nominal du lot : végétarienne par son miel, sur du tofu par ailleurs végétalien. */
function tofuLaque() {
  return makeRecipe('tofu_laque', {
    facettes: regimeFacette('vegetarien'),
    ingredients: [makeIngredient('tofu'), makeIngredient('miel')],
  })
}

describe('lot D1 — la seconde chance admet, et seulement ce qui est nommé', () => {
  it('admettre le miel rend un plat végétarien-au-miel visible à un végétalien', () => {
    const recette = tofuLaque()
    const catalog = makeCatalog([recette], ALIMENTS)

    const sansException = dietLayer.configure(makeRequest({ diet: 'vegetalien' }), catalog)
    expect(asExclusionResult(dietLayer.apply(new Set([recette.id]), sansException)).kept.size).toBe(0)

    const avecException = dietLayer.configure(
      makeRequest({ diet: 'vegetalien', admittedFoodIds: ['miel'] }),
      catalog
    )
    expect(asExclusionResult(dietLayer.apply(new Set([recette.id]), avecException)).kept).toEqual(
      new Set([recette.id])
    )
  })

  it('admettre un AUTRE aliment ne la fait pas passer — l’admission ne se généralise pas', () => {
    const recette = tofuLaque()
    const catalog = makeCatalog([recette], ALIMENTS)

    const config = dietLayer.configure(
      makeRequest({ diet: 'vegetalien', admittedFoodIds: ['oeuf'] }),
      catalog
    )
    expect(asExclusionResult(dietLayer.apply(new Set([recette.id]), config)).kept.size).toBe(0)
  })

  it('⛔ L’ADMISSION EST LITTÉRALE : admettre `lait_entier` n’admet PAS le beurre', () => {
    // On retire l'aliment de la LISTE D'INGRÉDIENTS ; on ne neutralise pas son origine dans la
    // carte des aliments, ce qui propagerait par la cascade `deriveDe` et surprendrait.
    const gateau = makeRecipe('gateau', {
      facettes: regimeFacette('vegetarien'),
      ingredients: [makeIngredient('tofu'), makeIngredient('beurre_doux')],
    })
    const catalog = makeCatalog([gateau], ALIMENTS)

    const parLeLait = dietLayer.configure(
      makeRequest({ diet: 'vegetalien', admittedFoodIds: ['lait_entier'] }),
      catalog
    )
    expect(asExclusionResult(dietLayer.apply(new Set([gateau.id]), parLeLait)).kept.size).toBe(0)

    // Nommer le beurre lui-même fonctionne : la preuve que c'est bien la CASCADE qui est refusée,
    // et non la recette qui serait inadmissible pour une autre raison.
    const parLeBeurre = dietLayer.configure(
      makeRequest({ diet: 'vegetalien', admittedFoodIds: ['beurre_doux'] }),
      catalog
    )
    expect(asExclusionResult(dietLayer.apply(new Set([gateau.id]), parLeBeurre)).kept.size).toBe(1)
  })

  it('amputer jusqu’au vide ne fait pas passer la recette — le cas échoue FERMÉ', () => {
    // Sans aucun ingrédient connu, `regimeExigeParIngredients` rend `omnivore` : incompatible avec
    // tout régime de la chaîne. Aucune garde n'est ajoutée pour ça, c'est la règle qui le fait.
    const oeufsBrouilles = makeRecipe('oeufs_brouilles', {
      facettes: regimeFacette('vegetarien'),
      ingredients: [makeIngredient('oeuf')],
    })
    const catalog = makeCatalog([oeufsBrouilles], ALIMENTS)

    const config = dietLayer.configure(
      makeRequest({ diet: 'vegetalien', admittedFoodIds: ['oeuf'] }),
      catalog
    )
    expect(asExclusionResult(dietLayer.apply(new Set([oeufsBrouilles.id]), config)).kept.size).toBe(0)
  })

  it('⛔ HORS DE `DIET_CHAIN`, l’admission ne change RIEN — `sans_gluten` va par l’égalité stricte', () => {
    // La règle ne modélise ni `halal` ni `sans_gluten` et ne doit pas les approcher.
    const brioche = makeRecipe('brioche', {
      facettes: regimeFacette('vegetarien'),
      ingredients: [makeIngredient('tofu'), makeIngredient('miel')],
    })
    const catalog = makeCatalog([brioche], ALIMENTS)

    for (const admittedFoodIds of [[], ['miel']]) {
      const config = dietLayer.configure(makeRequest({ diet: 'sans_gluten', admittedFoodIds }), catalog)
      expect(config.admisesParException.size, JSON.stringify(admittedFoodIds)).toBe(0)
      expect(asExclusionResult(dietLayer.apply(new Set([brioche.id]), config)).kept.size).toBe(0)
    }
  })
})

describe('lot D1 — P1 : aucune admission ⇒ chemin identique', () => {
  it('les deux ensembles de la config sont VIDES, donc la branche ajoutée est inatteignable', () => {
    // ⚠️ Le témoin est STRUCTUREL, pas statistique : si rien ne peut être admis et que la règle
    // n'a rien signalé, `apply` ne peut pas se comporter autrement qu'avant le lot. La vérification
    // sur le catalogue réel, elle, est dans `tests/regime-admission-catalogue-reel.test.ts`.
    const catalog = makeCatalog([tofuLaque()], ALIMENTS)

    for (const diet of DIET_CHAIN) {
      const config = dietLayer.configure(makeRequest({ diet }), catalog)
      expect(config.admisesParException.size, diet).toBe(0)
      expect(config.divergencesP3, diet).toEqual([])
    }
  })

  it('sans régime déclaré, la couche reste inerte même avec des admissions', () => {
    const catalog = makeCatalog([tofuLaque()], ALIMENTS)
    const config = dietLayer.configure(
      makeRequest({ diet: null, admittedFoodIds: ['miel'] }),
      catalog
    )

    expect(config.admisesParException.size).toBe(0)
    expect(config.divergencesP3).toEqual([])
  })
})

describe('lot D1 — P2 : seconde chance uniquement, jamais un refus de plus', () => {
  it('⛔ une recette ACCEPTÉE par l’étiquette n’est jamais repassée à la règle', () => {
    // La recette est étiquetée `vegetalien` alors que ses ingrédients exigeraient `vegetarien` :
    // la règle la REFUSERAIT. Elle reste acceptée — c'est ce qui garantit qu'un défaut de la règle
    // ne peut retirer aucun plat à personne. Le catalogue réel n'a pas ce cas (le test de
    // cohérence l'interdit) ; il est monté à la main exprès.
    const malEtiquetee = makeRecipe('mal_etiquetee', {
      facettes: regimeFacette('vegetalien'),
      ingredients: [makeIngredient('tofu'), makeIngredient('miel')],
    })
    const catalog = makeCatalog([malEtiquetee], ALIMENTS)

    const config = dietLayer.configure(
      makeRequest({ diet: 'vegetalien', admittedFoodIds: ['oeuf'] }),
      catalog
    )
    const result = asExclusionResult(dietLayer.apply(new Set([malEtiquetee.id]), config))

    expect(result.kept).toEqual(new Set([malEtiquetee.id]))
    expect(result.rejected).toEqual([])
    // Et elle n'a pas été examinée du tout : ni admise par exception, ni comptée en divergence.
    expect(config.admisesParException.size).toBe(0)
    expect(config.divergencesP3).toEqual([])
  })
})

describe('lot D1 — P3 : la règle ne sert que là où elle est d’accord avec l’étiquette', () => {
  /** Étiquette `omnivore`, ingrédients qui n'exigent que `vegetarien` : les deux divergent. */
  function divergente() {
    return makeRecipe('divergente', {
      facettes: regimeFacette('omnivore'),
      ingredients: [makeIngredient('tofu'), makeIngredient('miel')],
    })
  }

  it('⭐ LE TEST DU LOT — règle et étiquette divergentes ⇒ la recette reste ÉCARTÉE', () => {
    // Le seul risque réel du lot : le cas où la RÈGLE est plus fausse que l'ÉTIQUETTE. Si on s'en
    // servait ici, un végétalien qui admet le miel recevrait une recette dont l'étiquette écrite à
    // la main dit `omnivore` — sur la foi d'un calcul que l'étiquette contredit.
    const recette = divergente()
    const catalog = makeCatalog([recette], ALIMENTS)

    const config = dietLayer.configure(
      makeRequest({ diet: 'vegetalien', admittedFoodIds: ['miel'] }),
      catalog
    )
    const result = asExclusionResult(dietLayer.apply(new Set([recette.id]), config))

    expect(result.kept.size).toBe(0)
    expect(result.rejected.map((r) => r.recipeId)).toEqual([recette.id])
  })

  it('⚠️ P3 N’EST PAS MUETTE — la divergence est signalée côté développement', () => {
    // Une branche de sûreté silencieuse pourrit sans que rien ne le dise. ⛔ Ce compte ne va JAMAIS
    // à l'écran (principe 6) : il vit dans la config de la couche, que seul le moteur lit.
    const recette = divergente()
    const catalog = makeCatalog([recette], ALIMENTS)

    const config = dietLayer.configure(
      makeRequest({ diet: 'vegetalien', admittedFoodIds: ['miel'] }),
      catalog
    )
    expect(config.divergencesP3).toEqual([recette.id])
  })

  it('⛔ le motif de rejet VISIBLE ne change pas — écartée par P3 ou par l’étiquette, c’est pareil', () => {
    // Aucun diagnostic à l'écran : pour l'utilisateur, les deux rejets sont indiscernables.
    const recette = divergente()
    const ordinaire = makeRecipe('ordinaire', {
      facettes: regimeFacette('omnivore'),
      ingredients: [makeIngredient('tofu')],
    })
    const catalog = makeCatalog([recette, ordinaire], ALIMENTS)

    const config = dietLayer.configure(
      makeRequest({ diet: 'vegetalien', admittedFoodIds: ['miel'] }),
      catalog
    )
    const result = asExclusionResult(dietLayer.apply(new Set([recette.id, ordinaire.id]), config))

    expect(result.rejected).toHaveLength(2)
    expect(new Set(result.rejected.map((r) => r.reason)).size, 'un seul motif, au mot près').toBe(1)
  })
})

describe('lot D1 — P4 : l’admission ne touche QUE la couche `regime`', () => {
  it('⛔ un aliment admis reste écarté s’il est dans `excludedFoodIds`', () => {
    // La garantie vient de la FORME : `admittedFoodIds` n'est passé qu'à `dietLayer`, et la couche
    // `exclusions` ne le lit pas. ⛔ Aucune garde « si exclu alors ignorer l'admission » n'est
    // posée — elle donnerait l'illusion que c'est ELLE qui protège.
    const recette = tofuLaque()
    const catalog = makeCatalog([recette], ALIMENTS)
    const req = makeRequest({
      diet: 'vegetalien',
      admittedFoodIds: ['miel'],
      excludedFoodIds: ['miel'],
    })

    // La couche `regime` l'admet — c'est son rôle, et elle ne connaît pas les exclusions…
    const config = dietLayer.configure(req, catalog)
    expect(asExclusionResult(dietLayer.apply(new Set([recette.id]), config)).kept.size).toBe(1)

    // …mais la passe complète l'écarte.
    expect(
      runExclusionPass(catalog, req, undefined, new Set([recette.id])).candidates.has(recette.id)
    ).toBe(false)
  })

  it('⛔ un aliment admis reste écarté s’il est déclaré ALLERGÈNE', () => {
    // Le cas qui compte le plus : le principe 1 ne se négocie pas par un réglage de régime.
    const mielAllergene = makeFood('miel', [{ allergenId: 'fruits_a_coque' as AllergenId, certitude: 'contient' }], {
      groupe: 'produits sucrés',
      origineAnimale: 'insecte',
      provenanceAnimale: 'production',
    })
    const recette = tofuLaque()
    const catalog = makeCatalog([recette], [mielAllergene, OEUF, LAIT, BEURRE, TOFU])
    const req = makeRequest({
      diet: 'vegetalien',
      admittedFoodIds: ['miel'],
      allergies: ['fruits_a_coque'],
    })

    expect(
      runExclusionPass(catalog, req, undefined, new Set([recette.id])).candidates.has(recette.id)
    ).toBe(false)
  })
})
