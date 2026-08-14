// engine/planning/shopping-list.test.ts — liste de courses (docs/ENGINE.md §7.4).

import { describe, expect, it } from 'vitest'
import { arrondiAchat, buildShoppingList, rayonDe } from './shopping-list.js'
import { makeCatalog, makeFood, makeIngredient, makeRecipe } from '../selection/test-fixtures.js'
import type { Catalog, Food, FoodId, MealPlanEntry, MealSlot, RecipeId, WeekPlan } from '../domain/index.js'
import { venantDe } from '../domain/index.js'

function food(id: string, groupe: string, extra: Partial<Food> = {}): Food {
  return { ...makeFood(id), groupe, ...extra }
}

function entree(date: string, creneau: MealSlot, recipeId: string | null, isLeftover = false): MealPlanEntry {
  return {
    slot: { date, creneau },
    recipeId: recipeId as RecipeId | null,
    horsCatalogue: null,
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

/**
 * Les sauces retenues par l'utilisateur (`ShoppingOptions.saucesParRecette`, v14).
 *
 * ⚠️ FIXTURES MONTÉES À LA MAIN, jamais dérivées du catalogue réel : un oracle qui partage la donnée
 * de son sujet ne vérifie rien (PIEGES.md). Le catalogue ci-dessous porte un plat, une sauce, et un
 * aliment COMMUN aux deux — c'est ce dernier qui rend visible le cumul et la double provenance.
 */
describe('planning/shopping-list — les sauces retenues', () => {
  const AVEC_SAUCE = (): Catalog =>
    makeCatalog(
      [
        makeRecipe('roti', {
          ingredients: [makeIngredient('boeuf', { quantiteG: 900 }), makeIngredient('echalote', { quantiteG: 30 })],
        }),
        // Pas de `estSauce: true` : `makeRecipe` ne l'expose pas, et `buildShoppingList` ne le lit
        // pas — il verse ce que `saucesParRecette` lui désigne, sans redemander au catalogue si
        // c'en est une. Le filtre « c'est bien une sauce » est en amont, sur l'écran qui l'a fait
        // retenir. Le nom de la recette suffit donc à la lisibilité de ces cas.
        makeRecipe('sauce_poivre', {
          ingredients: [makeIngredient('creme', { quantiteG: 100 }), makeIngredient('echalote', { quantiteG: 20 })],
        }),
      ],
      [food('boeuf', 'viandes'), food('creme', 'lait et produits laitiers'), food('echalote', 'légumes')]
    )

  const RETENUE = new Map<RecipeId, readonly RecipeId[]>([
    ['roti' as RecipeId, ['sauce_poivre' as RecipeId]],
  ])

  it('⛔ n’achète AUCUNE sauce sans l’option — le moteur ne connaît pas `user.db`', () => {
    // `saucesParRecette` absent veut dire « aucune sauce retenue », pas « toutes celles du
    // catalogue ». C'est aussi ce qui garantit que la v14 ne change rien pour qui n'a rien choisi.
    const liste = buildShoppingList(plan([entree('2026-08-03', 'diner', 'roti')]), AVEC_SAUCE())
    expect(liste.items.map((i) => i.foodId)).not.toContain('creme')
  })

  it('verse les ingrédients de la sauce retenue, et les CUMULE avec ceux du plat', () => {
    const liste = buildShoppingList(plan([entree('2026-08-03', 'diner', 'roti')]), AVEC_SAUCE(), {
      saucesParRecette: RETENUE,
    })
    expect(liste.items.find((i) => i.foodId === 'creme')!.quantiteTotale).toBe(100)
    // 30 g pour le rôti + 20 g pour la sauce : une seule ligne, pas deux.
    expect(liste.items.find((i) => i.foodId === 'echalote')!.quantiteTotale).toBe(50)
    expect(liste.items.filter((i) => i.foodId === 'echalote')).toHaveLength(1)
  })

  it('dit la PROVENANCE : `pourSauces` à côté de `pourSlots`, pas à sa place', () => {
    const liste = buildShoppingList(plan([entree('2026-08-03', 'diner', 'roti')]), AVEC_SAUCE(), {
      saucesParRecette: RETENUE,
    })
    const echalote = liste.items.find((i) => i.foodId === 'echalote')!
    // L'échalote vient des DEUX : sans les deux champs, une ligne gonflée par une sauce passe pour
    // une erreur de calcul.
    expect(echalote.pourSlots).toHaveLength(1)
    expect(echalote.pourSauces).toEqual(['sauce_poivre'])

    const boeuf = liste.items.find((i) => i.foodId === 'boeuf')!
    expect(boeuf.pourSauces).toEqual([])
  })

  it('⛔ LA SAUCE D’UN RESTE NE SE RACHÈTE PAS — la boucle est SOUS le garde `isLeftover`', () => {
    // Le piège exact de ce lot : verser les sauces au-dessus du garde aurait fait racheter la sauce
    // à chaque repas d'un plat cuisiné une seule fois, annulant le gain des restes sur une ligne.
    const avecReste = plan([
      entree('2026-08-03', 'diner', 'roti'),
      entree('2026-08-04', 'dejeuner', 'roti', true),
      entree('2026-08-05', 'dejeuner', 'roti', true),
    ])
    const liste = buildShoppingList(avecReste, AVEC_SAUCE(), { saucesParRecette: RETENUE })

    expect(liste.items.find((i) => i.foodId === 'creme')!.quantiteTotale).toBe(100)
    expect(liste.items.find((i) => i.foodId === 'echalote')!.quantiteTotale).toBe(50)
  })

  it('la même sauce sur deux plats se cite UNE fois par ligne, mais s’achète deux fois', () => {
    const catalog = makeCatalog(
      [
        makeRecipe('roti', { ingredients: [makeIngredient('echalote', { quantiteG: 30 })] }),
        makeRecipe('poisson', { ingredients: [makeIngredient('echalote', { quantiteG: 10 })] }),
        makeRecipe('sauce_poivre', { ingredients: [makeIngredient('echalote', { quantiteG: 20 })] }),
      ],
      [food('echalote', 'légumes')]
    )
    const surLesDeux = new Map<RecipeId, readonly RecipeId[]>([
      ['roti' as RecipeId, ['sauce_poivre' as RecipeId]],
      ['poisson' as RecipeId, ['sauce_poivre' as RecipeId]],
    ])
    const liste = buildShoppingList(
      plan([entree('2026-08-03', 'diner', 'roti'), entree('2026-08-04', 'diner', 'poisson')]),
      catalog,
      { saucesParRecette: surLesDeux }
    )
    const echalote = liste.items.find((i) => i.foodId === 'echalote')!
    // Deux sauces à préparer, donc 30 + 10 + 20 + 20 = 80 g d'échalote à acheter…
    expect(echalote.quantiteTotale).toBe(80)
    // …mais une seule mention de provenance : « Sauce au poivre, Sauce au poivre » ne dit rien.
    expect(echalote.pourSauces).toEqual(['sauce_poivre'])
  })

  it('un id de sauce inconnu du catalogue s’ignore en silence, jamais une erreur', () => {
    // Une mise à jour du catalogue peut retirer une recette que `user.db` cite encore. `user.db`
    // n'a aucune clé étrangère vers le catalogue — c'est le cas NORMAL, pas une anomalie.
    const disparue = new Map<RecipeId, readonly RecipeId[]>([['roti' as RecipeId, ['sauce_fantome' as RecipeId]]])
    const liste = buildShoppingList(plan([entree('2026-08-03', 'diner', 'roti')]), AVEC_SAUCE(), {
      saucesParRecette: disparue,
    })
    expect(liste.items.find((i) => i.foodId === 'echalote')!.quantiteTotale).toBe(30)
  })

  it('le garde-manger s’applique AUSSI aux ingrédients d’une sauce', () => {
    // Une seule implémentation du versement pour le plat et pour ses sauces : sans ça, la crème
    // déclarée au frigo serait retirée du plat et rachetée pour la sauce.
    const liste = buildShoppingList(plan([entree('2026-08-03', 'diner', 'roti')]), AVEC_SAUCE(), {
      saucesParRecette: RETENUE,
      pantryFoodIds: ['creme' as FoodId],
    })
    expect(liste.items.map((i) => i.foodId)).not.toContain('creme')
  })
})

describe('planning/shopping-list — rayon', () => {
  const foods = new Map<FoodId, Food>()
  const ajoute = (f: Food) => {
    foods.set(f.id, f)
    return f
  }
  const lait = ajoute(
    food('lait_entier', 'lait et produits laitiers', {
      origineAnimale: venantDe('mammifere', 'production'),
    })
  )

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

describe('planning/shopping-list — affichage À LA PIÈCE', () => {
  const catalogPiece = () =>
    makeCatalog(
      [makeRecipe('r', { ingredients: [makeIngredient('carotte', { quantiteG: 350 }), makeIngredient('farine', { quantiteG: 350 })] })],
      [{ ...food('carotte', 'légumes'), poidsPieceG: 120 }, food('farine', 'céréales et dérivés')]
    )

  it('compte des PIÈCES et cache le grammage — « 3 carottes », pas « 350 g »', () => {
    const carotte = buildShoppingList(plan([entree('2026-08-03', 'diner', 'r')]), catalogPiece()).items.find(
      (i) => i.foodId === 'carotte'
    )!

    expect(carotte.quantiteTotale).toBe(3) // ⌈350 / 120⌉
    expect(carotte.unite).toBe('pièce')
  })

  it('arrondit À LA HAUSSE : 100 g de carotte réclame quand même une pièce entière', () => {
    const catalog = makeCatalog(
      [makeRecipe('r', { ingredients: [makeIngredient('carotte', { quantiteG: 100 })] })],
      [{ ...food('carotte', 'légumes'), poidsPieceG: 120 }]
    )
    expect(buildShoppingList(plan([entree('2026-08-03', 'diner', 'r')]), catalog).items[0]!.quantiteTotale).toBe(1)
  })

  it('la pièce PRIME sur le conditionnement', () => {
    // Un œuf porte les deux : 60 g de pièce et 60 g de « paquet ». On compte des œufs.
    const catalog = makeCatalog(
      [makeRecipe('r', { ingredients: [makeIngredient('oeuf', { quantiteG: 180 })] })],
      [{ ...food('oeuf', 'œufs'), poidsPieceG: 60, conditionnementG: 60 }]
    )
    const item = buildShoppingList(plan([entree('2026-08-03', 'diner', 'r')]), catalog).items[0]!

    expect(item.quantiteTotale).toBe(3)
    expect(item.unite).toBe('pièce')
  })

  it('un aliment sans poids de pièce reste en grammes', () => {
    const farine = buildShoppingList(plan([entree('2026-08-03', 'diner', 'r')]), catalogPiece()).items.find(
      (i) => i.foodId === 'farine'
    )!
    expect(farine.unite).toBe('g')
  })
})

describe('planning/shopping-list — fond de placard', () => {
  const catalog = () =>
    makeCatalog(
      [makeRecipe('r', { ingredients: [makeIngredient('sel', { quantiteG: 5 }), makeIngredient('carotte', { quantiteG: 200 })] })],
      [{ ...food('sel', 'condiments'), fondDePlacard: true }, food('carotte', 'légumes')]
    )
  const p = plan([entree('2026-08-03', 'diner', 'r')])

  it('sel, poivre et épices sont ÉCARTÉS par défaut', () => {
    // `sel_fin` apparaît 163 fois « au goût » au catalogue : le lister noierait les vraies lignes.
    expect(buildShoppingList(p, catalog()).items.map((i) => i.foodId)).toEqual(['carotte'])
  })

  it('`inclureFondDePlacard` les réaffiche', () => {
    const ids = buildShoppingList(p, catalog(), { inclureFondDePlacard: true }).items.map((i) => i.foodId)
    expect(ids).toContain('sel')
  })

  it('les écarter ne fait pas disparaître le reste de la recette', () => {
    expect(buildShoppingList(p, catalog()).items).toHaveLength(1)
  })
})

describe('planning/shopping-list — ce que l’utilisateur a déjà (`pantryFoodIds`)', () => {
  const p = plan([entree('2026-08-03', 'diner', 'gratin')])

  it('un aliment déclaré présent sort de la liste', () => {
    const ids = buildShoppingList(p, CATALOG(), { pantryFoodIds: ['pomme_de_terre' as FoodId] }).items.map((i) => i.foodId)

    expect(ids).not.toContain('pomme_de_terre')
    expect(ids).toContain('creme') // le reste est intact
  })

  it('sans l’option, la liste est COMPLÈTE — l’appli ne demande rien', () => {
    // Le champ est facultatif et ponctuel : ne rien remplir doit donner une liste utilisable.
    expect(buildShoppingList(p, CATALOG()).items.map((i) => i.foodId)).toContain('pomme_de_terre')
  })

  it('c’est TOUT OU RIEN — pas de décompte partiel', () => {
    // « Il me reste un peu de farine » ne permet pas de calculer combien en racheter ; prétendre le
    // contraire ferait manquer l'ingrédient.
    const items = buildShoppingList(p, CATALOG(), { pantryFoodIds: ['pomme_de_terre' as FoodId] }).items
    expect(items.every((i) => i.foodId !== 'pomme_de_terre')).toBe(true)
  })
})

describe('planning/shopping-list — provenance (§2 : rangeable par repas / jour)', () => {
  it('chaque ligne porte les créneaux qui la demandent', () => {
    const p = plan([entree('2026-08-03', 'diner', 'gratin'), entree('2026-08-04', 'dejeuner', 'soupe')])
    const pdt = buildShoppingList(p, CATALOG()).items.find((i) => i.foodId === 'pomme_de_terre')!

    // La pomme de terre sert aux DEUX repas — sans ce champ, l'information est perdue à
    // l'agrégation et « ranger par repas » devient impossible.
    expect(pdt.pourSlots).toHaveLength(2)
    expect(pdt.pourSlots.map((s) => `${s.date}/${s.creneau}`)).toEqual(['2026-08-03/diner', '2026-08-04/dejeuner'])
  })

  it('un ingrédient d’une seule recette ne porte qu’un créneau', () => {
    const p = plan([entree('2026-08-03', 'diner', 'gratin')])
    const creme = buildShoppingList(p, CATALOG()).items.find((i) => i.foodId === 'creme')!

    expect(creme.pourSlots).toEqual([{ date: '2026-08-03', creneau: 'diner' }])
  })

  it('permet de reconstituer la liste d’un SEUL jour', () => {
    // L'usage concret que §2 ARCHITECTURE demande : « rangeable par rayon / repas / jour ».
    const p = plan([entree('2026-08-03', 'diner', 'gratin'), entree('2026-08-04', 'dejeuner', 'soupe')])
    const items = buildShoppingList(p, CATALOG()).items

    const pourLe4 = items.filter((i) => i.pourSlots.some((s) => s.date === '2026-08-04'))

    expect(pourLe4.map((i) => i.foodId)).toEqual(['pomme_de_terre'])
  })
})
