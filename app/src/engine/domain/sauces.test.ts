// engine/domain/sauces.test.ts — qui a droit à une sauce, et laquelle (§ sauces.ts).

import { describe, expect, it } from 'vitest'
import {
  porteDejaUneSauce,
  proposerUneSauce,
  saucesProposees,
  toutesLesSauces,
  SOUS_GROUPE_SAUCE,
} from './sauces.js'
import { makeCatalog, makeFood, makeIngredient, makeRecipe } from '../selection/test-fixtures.js'
import type { Catalog, CourseKind, Food, Recipe, RecipeId } from '../domain/index.js'

/** `makeFood` ne permet pas de surcharger `sousGroupe` — on le pose après coup. */
function aliment(id: string, opts: { readonly sousGroupe?: string } = {}): Food {
  return { ...makeFood(id), sousGroupe: opts.sousGroupe ?? null }
}

/** `makeRecipe` ne permet pas de surcharger `estSauce`/`porteDejaUneSauce`/`sauceIds` — idem. */
function recette(
  id: string,
  opts: {
    readonly ingredients?: readonly ReturnType<typeof makeIngredient>[]
    readonly service?: CourseKind | null
    readonly estSauce?: boolean
    readonly porteDejaUneSauce?: boolean | null
    readonly sauceIds?: readonly string[]
  } = {}
): Recipe {
  const base = makeRecipe(id, {
    ...(opts.ingredients === undefined ? {} : { ingredients: opts.ingredients }),
    ...(opts.service === undefined ? {} : { service: opts.service }),
  })
  return {
    ...base,
    estSauce: opts.estSauce ?? false,
    porteDejaUneSauce: opts.porteDejaUneSauce ?? null,
    sauceIds: (opts.sauceIds ?? []).map((sauceId) => sauceId as RecipeId),
  }
}

describe('domain/sauces — porteDejaUneSauce', () => {
  it('`porteDejaUneSauce: true` l’emporte même si aucun ingrédient n’est une sauce (blanquette)', () => {
    const catalog = makeCatalog(
      [recette('blanquette', { porteDejaUneSauce: true, ingredients: [makeIngredient('veau')] })],
      [aliment('veau')]
    ) as Catalog

    expect(porteDejaUneSauce(catalog.recipes.get('blanquette' as RecipeId)!, catalog)).toBe(true)
  })

  it('`porteDejaUneSauce: false` l’emporte même si un ingrédient porte `sousGroupe: sauce`', () => {
    // L'éditorial gagne sur la dérivation DANS LES DEUX SENS — remplacer le tri-état par un `??`
    // ferait passer ce test au rouge.
    const catalog = makeCatalog(
      [recette('salade', { porteDejaUneSauce: false, ingredients: [makeIngredient('ketchup')] })],
      [aliment('ketchup', { sousGroupe: SOUS_GROUPE_SAUCE })]
    ) as Catalog

    expect(porteDejaUneSauce(catalog.recipes.get('salade' as RecipeId)!, catalog)).toBe(false)
  })

  it('`null` avec un ingrédient `sousGroupe: sauce` → dérive à `true`', () => {
    const catalog = makeCatalog(
      [recette('frites', { porteDejaUneSauce: null, ingredients: [makeIngredient('mayonnaise')] })],
      [aliment('mayonnaise', { sousGroupe: SOUS_GROUPE_SAUCE })]
    ) as Catalog

    expect(porteDejaUneSauce(catalog.recipes.get('frites' as RecipeId)!, catalog)).toBe(true)
  })

  it('`null` sans aucun ingrédient sauce → dérive à `false`', () => {
    const catalog = makeCatalog(
      [recette('riz', { porteDejaUneSauce: null, ingredients: [makeIngredient('riz_blanc')] })],
      [aliment('riz_blanc')]
    ) as Catalog

    expect(porteDejaUneSauce(catalog.recipes.get('riz' as RecipeId)!, catalog)).toBe(false)
  })

  it('`null` avec un ingrédient absent du catalogue → `false`, sans lever', () => {
    const catalog = makeCatalog(
      [recette('mystere', { porteDejaUneSauce: null, ingredients: [makeIngredient('fantome')] })],
      []
    ) as Catalog

    expect(() => porteDejaUneSauce(catalog.recipes.get('mystere' as RecipeId)!, catalog)).not.toThrow()
    expect(porteDejaUneSauce(catalog.recipes.get('mystere' as RecipeId)!, catalog)).toBe(false)
  })
})

describe('domain/sauces — proposerUneSauce', () => {
  it('une sauce ne se voit pas proposer une sauce', () => {
    const catalog = makeCatalog([recette('vinaigrette', { estSauce: true })]) as Catalog
    expect(proposerUneSauce(catalog.recipes.get('vinaigrette' as RecipeId)!, catalog)).toBe(false)
  })

  it('un dessert est exclu', () => {
    const catalog = makeCatalog([recette('tarte', { service: 'dessert' })]) as Catalog
    expect(proposerUneSauce(catalog.recipes.get('tarte' as RecipeId)!, catalog)).toBe(false)
  })

  it('une entrée est éligible — décision utilisateur du 2026-08-08, ne pas « corriger »', () => {
    // Seuls les desserts sont exclus. Une première lecture aurait écarté les entrées avec eux :
    // c'est faux, tranché explicitement par l'utilisateur. Voir le commentaire de proposerUneSauce.
    const catalog = makeCatalog([recette('salade_composee', { service: 'entree' })]) as Catalog
    expect(proposerUneSauce(catalog.recipes.get('salade_composee' as RecipeId)!, catalog)).toBe(true)
  })

  it('un plat et un accompagnement sont éligibles', () => {
    const catalog = makeCatalog([
      recette('roti', { service: 'plat' }),
      recette('legumes', { service: 'accompagnement' }),
    ]) as Catalog

    expect(proposerUneSauce(catalog.recipes.get('roti' as RecipeId)!, catalog)).toBe(true)
    expect(proposerUneSauce(catalog.recipes.get('legumes' as RecipeId)!, catalog)).toBe(true)
  })

  it('`service: null` est éligible — refuser sur null ferait disparaître la proposition partout', () => {
    const catalog = makeCatalog([recette('non_annoncee', { service: null })]) as Catalog
    expect(proposerUneSauce(catalog.recipes.get('non_annoncee' as RecipeId)!, catalog)).toBe(true)
  })

  it('un plat qui porte déjà sa sauce n’en réclame pas une seconde', () => {
    const catalog = makeCatalog([recette('bourguignon', { service: 'plat', porteDejaUneSauce: true })]) as Catalog
    expect(proposerUneSauce(catalog.recipes.get('bourguignon' as RecipeId)!, catalog)).toBe(false)
  })
})

describe('domain/sauces — saucesProposees', () => {
  it('rend les sauces attachées, dans l’ordre de `sauceIds`', () => {
    const catalog = makeCatalog([
      recette('plat', { service: 'plat', sauceIds: ['bearnaise', 'moutarde'] }),
      recette('bearnaise', { estSauce: true }),
      recette('moutarde', { estSauce: true }),
    ]) as Catalog

    const sauces = saucesProposees(catalog.recipes.get('plat' as RecipeId)!, catalog)

    expect(sauces.map((s) => s.id)).toEqual(['bearnaise', 'moutarde'])
  })

  it('déduplique un id répété dans `sauceIds`', () => {
    const catalog = makeCatalog([
      recette('plat', { service: 'plat', sauceIds: ['bearnaise', 'bearnaise'] }),
      recette('bearnaise', { estSauce: true }),
    ]) as Catalog

    const sauces = saucesProposees(catalog.recipes.get('plat' as RecipeId)!, catalog)

    expect(sauces.map((s) => s.id)).toEqual(['bearnaise'])
  })

  it('ignore un id absent du catalogue, sans lever', () => {
    const catalog = makeCatalog([recette('plat', { service: 'plat', sauceIds: ['fantome'] })]) as Catalog

    expect(() => saucesProposees(catalog.recipes.get('plat' as RecipeId)!, catalog)).not.toThrow()
    expect(saucesProposees(catalog.recipes.get('plat' as RecipeId)!, catalog)).toEqual([])
  })

  it('ignore un id qui résout vers une recette dont `estSauce` est faux', () => {
    const catalog = makeCatalog([
      recette('plat', { service: 'plat', sauceIds: ['accompagnement'] }),
      recette('accompagnement', { estSauce: false }),
    ]) as Catalog

    expect(saucesProposees(catalog.recipes.get('plat' as RecipeId)!, catalog)).toEqual([])
  })

  it('rend `[]` quand `proposerUneSauce` est faux, même si `sauceIds` est non vide', () => {
    const catalog = makeCatalog([
      recette('tarte', { service: 'dessert', sauceIds: ['caramel'] }),
      recette('caramel', { estSauce: true }),
    ]) as Catalog

    expect(saucesProposees(catalog.recipes.get('tarte' as RecipeId)!, catalog)).toEqual([])
  })
})

describe('domain/sauces — toutesLesSauces', () => {
  it('ne rend que les recettes `estSauce`', () => {
    const catalog = makeCatalog([
      recette('roti', { estSauce: false }),
      recette('bearnaise', { estSauce: true }),
    ]) as Catalog

    expect(toutesLesSauces(catalog).map((s) => s.id)).toEqual(['bearnaise'])
  })

  it('trie par ordre alphabétique français, accents inclus', () => {
    // ASCII placerait « Échalote » (É = 0xC9) après tout le reste ; localeCompare('fr') le classe
    // avant « Estragon », comme un francophone l'attend.
    const catalog = makeCatalog([
      { ...recette('estragon', { estSauce: true }), nom: 'Estragon' },
      { ...recette('echalote', { estSauce: true }), nom: 'Échalote' },
    ]) as Catalog

    expect(toutesLesSauces(catalog).map((s) => s.nom)).toEqual(['Échalote', 'Estragon'])
  })
})
