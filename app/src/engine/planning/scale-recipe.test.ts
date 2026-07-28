// engine/planning/scale-recipe.test.ts — mise à l'échelle des portions (§10.1 ENGINE).

import { describe, expect, it } from 'vitest'
import { MAX_PORTIONS, MIN_PORTIONS, scaleRecipe } from './scale-recipe.js'
import { makeCatalog, makeIngredient, makeRecipe } from '../selection/test-fixtures.js'
import type { Catalog, RecipeId } from '../domain/index.js'

/** `makeRecipe` fixe `portionsBase: 2` — on le surcharge pour les cas qui en dépendent. */
function recette(id: string, portionsBase: number) {
  return {
    ...makeRecipe(id, {
      ingredients: [makeIngredient('boeuf', { quantiteG: 400 }), makeIngredient('sel', { quantiteG: 5 })],
    }),
    portionsBase,
  }
}

const CATALOG = makeCatalog([recette('plat', 4)]) as Catalog

describe('planning/scale-recipe', () => {
  it('règle de trois sur chaque ingrédient', () => {
    const echelle = scaleRecipe(CATALOG, 'plat' as RecipeId, 8)

    expect(echelle.portions).toBe(8)
    expect(echelle.ingredients.map((i) => i.quantiteG)).toEqual([800, 10])
  })

  it('divise aussi bien qu’il multiplie', () => {
    expect(scaleRecipe(CATALOG, 'plat' as RecipeId, 2).ingredients.map((i) => i.quantiteG)).toEqual([200, 2.5])
  })

  it('même nombre de portions → quantités inchangées', () => {
    expect(scaleRecipe(CATALOG, 'plat' as RecipeId, 4).ingredients.map((i) => i.quantiteG)).toEqual([400, 5])
  })

  it('LE SEL SUIT LA RÈGLE DE TROIS — choix assumé, pas un oubli', () => {
    // Une vraie mise à l'échelle culinaire ne double pas le sel. Modéliser ça demanderait une
    // courbe par ingrédient que personne ne peut renseigner honnêtement pour 199 aliments. La règle
    // de trois est PRÉVISIBLE : l'utilisateur voit le facteur et corrige. Une heuristique qui
    // « corrigerait » le sel serait invisible et inexplicable.
    expect(scaleRecipe(CATALOG, 'plat' as RecipeId, 8).ingredients[1]!.quantiteG).toBe(10)
  })

  it('`uniteAffichage` est laissée TELLE QUELLE — on ne réécrit pas du français', () => {
    // « 2 carottes » mis à l'échelle donnerait « 3 carottes » ou « 1,5 pincée » : aucune règle ne
    // sait faire ça correctement. Mieux vaut un libellé visiblement figé qu'un libellé faux.
    const avant = CATALOG.recipes.get('plat' as RecipeId)!.ingredients.map((i) => i.uniteAffichage)
    const apres = scaleRecipe(CATALOG, 'plat' as RecipeId, 8).ingredients.map((i) => i.uniteAffichage)

    expect(apres).toEqual(avant)
  })

  it('ne rend QUE les ingrédients — doubler les portions ne double pas la cuisson', () => {
    const echelle = scaleRecipe(CATALOG, 'plat' as RecipeId, 8)
    expect(Object.keys(echelle).sort()).toEqual(['ingredients', 'portions', 'recipeId'])
  })

  it('arrondit au dixième de gramme, sans traîner de flottants', () => {
    const impair = makeCatalog([{ ...recette('impair', 3), ingredients: [makeIngredient('x', { quantiteG: 100 })] }]) as Catalog
    expect(scaleRecipe(impair, 'impair' as RecipeId, 4).ingredients[0]!.quantiteG).toBe(133.3)
  })

  it('refuse une recette inconnue', () => {
    expect(() => scaleRecipe(CATALOG, 'inexistante' as RecipeId, 4)).toThrow(RangeError)
  })

  it('refuse un nombre de portions hors bornes ou non entier', () => {
    for (const mauvais of [MIN_PORTIONS - 1, MAX_PORTIONS + 1, 2.5, Number.NaN]) {
      expect(() => scaleRecipe(CATALOG, 'plat' as RecipeId, mauvais), String(mauvais)).toThrow(RangeError)
    }
  })

  it('`portionsBase` nul ne produit pas d’Infinity silencieux', () => {
    // Impossible au catalogue, mais un Infinity se propagerait dans toute la liste de courses.
    const casse = makeCatalog([{ ...recette('casse', 0) }]) as Catalog
    for (const ingredient of scaleRecipe(casse, 'casse' as RecipeId, 2).ingredients) {
      expect(Number.isFinite(ingredient.quantiteG)).toBe(true)
    }
  })
})
