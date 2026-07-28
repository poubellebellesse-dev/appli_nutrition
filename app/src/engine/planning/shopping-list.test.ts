// engine/planning/shopping-list.test.ts — liste de courses (docs/ENGINE.md §7.4).

import { describe, expect, it } from 'vitest'
import { arrondiAchat, buildShoppingList, rayonDe } from './shopping-list.js'
import { makeCatalog, makeFood, makeIngredient, makeRecipe } from '../selection/test-fixtures.js'
import type { Catalog, Food, FoodId, MealPlanEntry, MealSlot, RecipeId, WeekPlan } from '../domain/index.js'

function food(id: string, groupe: string, extra: Partial<Food> = {}): Food {
  return { ...makeFood(id), groupe, ...extra }
}

function entree(date: string, creneau: MealSlot, recipeId: string | null, isLeftover = false): MealPlanEntry {
  return {
    slot: { date, creneau },
    recipeId: recipeId as RecipeId | null,
    portions: 2,
    locked: false,
    isLeftover,
    service: null,
  }
}

function plan(entries: readonly MealPlanEntry[]): WeekPlan {
  return { id: 'p1', startDate: '2026-08-03', days: 7, seed: 1, entries, warnings: [] }
}

const CATALOG = (): Catalog =>
  makeCatalog(
    [
      makeRecipe('gratin', {
        ingredients: [makeIngredient('pomme_de_terre', { quantiteG: 800 }), makeIngredient('creme', { quantiteG: 200 })],
      }),
      makeRecipe('soupe', { ingredients: [makeIngredient('pomme_de_terre', { quantiteG: 400 })] }),
    ],
    [food('pomme_de_terre', 'légumes'), food('creme', 'lait et produits laitiers')]
  )

describe('planning/shopping-list — agrégation', () => {
  it('cumule le même aliment sur plusieurs recettes', () => {
    const liste = buildShoppingList(plan([entree('2026-08-03', 'diner', 'gratin'), entree('2026-08-04', 'dejeuner', 'soupe')]), CATALOG())
    const pdt = liste.items.find((i) => i.foodId === 'pomme_de_terre')

    expect(pdt!.quantiteTotale).toBe(1200) // 800 + 400
  })

  it('UN RESTE NE SE RACHÈTE PAS — l’interaction essentielle avec §7.3', () => {
    // Le premier piège de cette fonction : compter les restes multiplierait la liste par le nombre
    // de repas et annulerait exactement le gain que les restes existent pour produire.
    const avecReste = plan([
      entree('2026-08-03', 'diner', 'gratin'),
      entree('2026-08-04', 'dejeuner', 'gratin', true),
      entree('2026-08-05', 'dejeuner', 'gratin', true),
    ])

    const pdt = buildShoppingList(avecReste, CATALOG()).items.find((i) => i.foodId === 'pomme_de_terre')

    expect(pdt!.quantiteTotale).toBe(800) // le gratin est acheté UNE fois, pas trois
  })

  it('un créneau vide n’ajoute rien', () => {
    expect(buildShoppingList(plan([entree('2026-08-03', 'diner', null)]), CATALOG()).items).toEqual([])
  })

  it('les quantités ne sont PAS divisées par les convives', () => {
    // On cuisine la recette entière — c'est précisément ce qui produit les restes (§7.3). Diviser
    // ferait acheter de quoi cuisiner un demi-plat.
    const pdt = buildShoppingList(plan([entree('2026-08-03', 'diner', 'gratin')]), CATALOG()).items.find(
      (i) => i.foodId === 'pomme_de_terre'
    )
    expect(pdt!.quantiteTotale).toBe(800)
  })

  it('les ingrédients OPTIONNELS sont inclus — sinon ils manqueraient en cuisine', () => {
    const catalog = makeCatalog(
      [makeRecipe('r', { ingredients: [makeIngredient('herbe', { quantiteG: 20, optionnel: true })] })],
      [food('herbe', 'condiments')]
    )
    const liste = buildShoppingList(plan([entree('2026-08-03', 'diner', 'r')]), catalog)

    expect(liste.items.map((i) => i.foodId)).toContain('herbe')
  })
})

describe('planning/shopping-list — rayon', () => {
  const foods = new Map<FoodId, Food>()
  const ajoute = (f: Food) => {
    foods.set(f.id, f)
    return f
  }
  const lait = ajoute(food('lait_entier', 'lait et produits laitiers', { origineAnimale: 'mammifere' }))

  it('regroupe fruits et légumes, boucherie, poissonnerie, crèmerie, épicerie, cave', () => {
    expect(rayonDe(food('carotte', 'légumes'), foods)).toBe('fruits et légumes')
    expect(rayonDe(food('pomme', 'fruits'), foods)).toBe('fruits et légumes')
    expect(rayonDe(food('boeuf', 'viandes'), foods)).toBe('boucherie')
    expect(rayonDe(food('moule', 'fruits de mer'), foods)).toBe('poissonnerie')
    expect(rayonDe(lait, foods)).toBe('crèmerie')
    expect(rayonDe(food('riz', 'céréales et dérivés'), foods)).toBe('épicerie')
    expect(rayonDe(food('vin', 'boissons alcoolisées'), foods)).toBe('cave')
  })

  it('LE CAS QUI JUSTIFIE UNE TABLE : « matières grasses » se scinde en deux rayons', () => {
    // Beurre et huile d'olive partagent un groupe NUTRITIONNEL et pas un rayon de MAGASIN. On
    // départage par l'origine animale, qui remonte la chaîne `deriveDe`.
    const beurre = ajoute(food('beurre', 'matières grasses', { deriveDe: 'lait_entier' as FoodId }))
    const huile = food('huile_olive', 'matières grasses')

    expect(rayonDe(beurre, foods)).toBe('crèmerie')
    expect(rayonDe(huile, foods)).toBe('épicerie')
  })

  it('un groupe inconnu tombe en épicerie plutôt que de disparaître', () => {
    expect(rayonDe(food('mystere', 'groupe inventé'), foods)).toBe('épicerie')
  })
})

describe('planning/shopping-list — arrondi AU POIDS (aucun conditionnement)', () => {
  it('arrondit toujours À LA HAUSSE — mieux vaut un reste qu’un manque', () => {
    expect(arrondiAchat(43)).toBe(50)
    expect(arrondiAchat(101)).toBe(150)
    expect(arrondiAchat(1010)).toBe(1100)
  })

  it('le pas grossit avec la quantité', () => {
    expect(arrondiAchat(12)).toBe(20) // pas de 10 sous 100 g
    expect(arrondiAchat(120)).toBe(150) // pas de 50 sous 1 kg
    expect(arrondiAchat(1200)).toBe(1200) // pas de 100 au-delà
  })

  it('zéro et négatif ne produisent jamais de quantité fantôme', () => {
    expect(arrondiAchat(0)).toBe(0)
    expect(arrondiAchat(-5)).toBe(0)
  })

  it('une valeur déjà ronde n’est pas gonflée', () => {
    expect(arrondiAchat(50)).toBe(50)
    expect(arrondiAchat(800)).toBe(800)
  })
})

describe('planning/shopping-list — arrondi AU CONDITIONNEMENT (§7.4)', () => {
  it('LA RÈGLE : ⌈besoin ÷ paquet⌉ — plaquette de beurre de 250 g', () => {
    // Les deux exemples qui définissent la règle : on ne descend jamais sous le besoin, et on
    // prend le paquet AU-DESSUS dès qu'on le dépasse d'un gramme.
    expect(arrondiAchat(240, 250)).toBe(250) // une plaquette suffit
    expect(arrondiAchat(260, 250)).toBe(500) // il en faut deux
  })

  it('un besoin minuscule coûte quand même un paquet entier', () => {
    // « On n'achète pas 43 g de beurre » — on en achète une plaquette.
    expect(arrondiAchat(43, 250)).toBe(250)
  })

  it('un besoin exactement égal au paquet n’en déclenche pas un second', () => {
    // Le piège classique de `Math.ceil` mal posé : 250 / 250 = 1, pas 2.
    expect(arrondiAchat(250, 250)).toBe(250)
    expect(arrondiAchat(500, 250)).toBe(500)
  })

  it('le conditionnement PRIME sur l’arrondi générique', () => {
    // 700 g au poids donneraient 700 ; en plaquettes de 250 il en faut trois, soit 750.
    expect(arrondiAchat(700)).toBe(700)
    expect(arrondiAchat(700, 250)).toBe(750)
  })

  it('un conditionnement absurde (0 ou négatif) retombe sur l’arrondi au poids', () => {
    expect(arrondiAchat(43, 0)).toBe(50)
    expect(arrondiAchat(43, -250)).toBe(50)
  })

  it('la liste applique le conditionnement de CHAQUE aliment', () => {
    const catalog = makeCatalog(
      [makeRecipe('r', { ingredients: [makeIngredient('beurre', { quantiteG: 260 }), makeIngredient('carotte', { quantiteG: 260 })] })],
      [{ ...food('beurre', 'matières grasses'), conditionnementG: 250 }, food('carotte', 'légumes')]
    )
    const items = buildShoppingList(plan([entree('2026-08-03', 'diner', 'r')]), catalog).items

    expect(items.find((i) => i.foodId === 'beurre')!.quantiteTotale).toBe(500) // 2 plaquettes
    expect(items.find((i) => i.foodId === 'carotte')!.quantiteTotale).toBe(300) // au poids
  })
})

describe('planning/shopping-list — scission par `joursDeCourses` (§7.4)', () => {
  const p = plan([
    entree('2026-08-03', 'diner', 'gratin'),
    entree('2026-08-07', 'dejeuner', 'soupe'), // J+4
  ])

  it('sans option, tout est acheté en une fois', () => {
    expect(buildShoppingList(p, CATALOG()).items.every((i) => i.tranche === 0)).toBe(true)
  })

  it('avec `joursDeCourses: 3`, le J+4 bascule sur la seconde virée', () => {
    const items = buildShoppingList(p, CATALOG(), { joursDeCourses: 3 }).items

    expect(items.filter((i) => i.tranche === 0).length).toBeGreaterThan(0)
    expect(items.filter((i) => i.tranche === 1).length).toBeGreaterThan(0)
  })

  it('le même aliment acheté en deux fois donne DEUX lignes — sinon la scission ne sert à rien', () => {
    const pdt = buildShoppingList(p, CATALOG(), { joursDeCourses: 3 }).items.filter(
      (i) => i.foodId === 'pomme_de_terre'
    )

    expect(pdt).toHaveLength(2)
    expect(pdt.map((i) => i.tranche)).toEqual([0, 1])
  })
})

describe('planning/shopping-list — invariants', () => {
  it('ordre STABLE : par tranche, puis rayon, puis aliment', () => {
    const p = plan([entree('2026-08-03', 'diner', 'gratin'), entree('2026-08-04', 'dejeuner', 'soupe')])
    const une = buildShoppingList(p, CATALOG()).items.map((i) => `${i.tranche}/${i.rayon}/${i.foodId}`)
    const deux = buildShoppingList(p, CATALOG()).items.map((i) => `${i.tranche}/${i.rayon}/${i.foodId}`)

    expect(une).toEqual(deux)
    expect([...une].sort()).toEqual(une)
  })

  it('porte l’id du plan et une date déterministe, jamais `Date.now()`', () => {
    const liste = buildShoppingList(plan([entree('2026-08-03', 'diner', 'gratin')]), CATALOG())

    expect(liste.planId).toBe('p1')
    expect(liste.generatedAt).toBe('2026-08-03')
  })

  it('aucune quantité nulle ou négative dans la liste rendue', () => {
    const liste = buildShoppingList(plan([entree('2026-08-03', 'diner', 'gratin')]), CATALOG())

    for (const item of liste.items) expect(item.quantiteTotale).toBeGreaterThan(0)
  })
})
