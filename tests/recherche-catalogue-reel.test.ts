// tests/recherche-catalogue-reel.test.ts
//
// Recherche et parcours du catalogue (§4.4 DESIGN, §6.8 ENGINE) sur le VRAI catalogue — 241
// recettes, 199 aliments. Un fixture de trois recettes ne dirait rien d'utile ici : ce qu'on veut
// savoir, c'est si « creme » trouve « Crème », si les facettes existent vraiment, et si l'entonnoir
// compte juste sur des volumes réels.
//
// ⚠️ LA PROPRIÉTÉ CENTRALE EST UNE PROPRIÉTÉ DE SÉCURITÉ : aucune recherche, quel que soit le texte
// ou les filtres, ne doit rendre une recette contenant un allergène déclaré. C'est la raison pour
// laquelle `browseRecipes` passe par les couches d'exclusion du moteur au lieu de filtrer en UI.

import { beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from '../app/src/data/catalog-loader-node.js'
import { createEngine, type Engine } from '../app/src/engine/api/index.js'
import { normaliser, valeursDeFacette } from '../app/src/engine/search/index.js'
import type { AllergenId, Catalog, FacetteKind, RecipeId } from '../app/src/engine/domain/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..')

let catalogue: Catalog
let moteur: Engine

const SANS_CONTRAINTE = { allergies: [], diet: null, excludedFoodIds: [] } as const

beforeAll(() => {
  const dossier = mkdtempSync(path.join(tmpdir(), 'nutri-recherche-'))
  const dbPath = path.join(dossier, 'catalog.db')
  const build = spawnSync(
    process.execPath,
    ['--experimental-sqlite', path.join(REPO_ROOT, 'catalog', 'build.mjs'), '--out', dbPath],
    { cwd: REPO_ROOT, encoding: 'utf8' }
  )
  expect(build.status, build.stderr).toBe(0)
  catalogue = loadCatalog(dbPath)
  moteur = createEngine(catalogue)
}, 120_000)

describe('search — normalisation française', () => {
  it('ignore la casse ET les accents', () => {
    // Sur un clavier de téléphone, personne ne tape les accents dans un champ de recherche.
    expect(normaliser('Crème Brûlée')).toBe('creme brulee')
    expect(normaliser('POÊLÉE')).toBe('poelee')
  })

  it('déplie les ligatures — « boeuf » doit trouver « bœuf »', () => {
    expect(normaliser('Bœuf')).toBe('boeuf')
    expect(normaliser('Œuf')).toBe('oeuf')
  })
})

describe('browseRecipes — recherche sur le catalogue réel', () => {
  it('sans critère, rend TOUT le catalogue', () => {
    const resultat = moteur.browseRecipes({ constraints: SANS_CONTRAINTE })
    expect(resultat.recipeIds.length).toBe(catalogue.recipes.size)
    expect(resultat.totalCatalogue).toBe(catalogue.recipes.size)
    expect(resultat.entonnoir.totalRejected).toBe(0)
  })

  it('trouve un plat malgré les accents manquants', () => {
    const avec = moteur.browseRecipes({ constraints: SANS_CONTRAINTE, texte: 'crème' })
    const sans = moteur.browseRecipes({ constraints: SANS_CONTRAINTE, texte: 'creme' })
    expect(sans.recipeIds.length).toBeGreaterThan(0)
    expect(sans.recipeIds).toEqual(avec.recipeIds)
  })

  it('cherche aussi dans les INGRÉDIENTS, pas seulement dans le nom', () => {
    // §4.4 : autocomplétion sur « plats, ingrédients, cuisines ». Chercher « poulet » doit trouver
    // un plat qui en contient sans le nommer.
    const resultat = moteur.browseRecipes({ constraints: SANS_CONTRAINTE, texte: 'poulet' })
    expect(resultat.recipeIds.length).toBeGreaterThan(0)
    const parLeNomSeul = resultat.recipeIds.filter((id) =>
      normaliser(catalogue.recipes.get(id)?.nom ?? '').includes('poulet')
    )
    expect(parLeNomSeul.length).toBeLessThan(resultat.recipeIds.length)
  })

  it('exige TOUS les mots — deux mots affinent, ils n’élargissent pas', () => {
    const unMot = moteur.browseRecipes({ constraints: SANS_CONTRAINTE, texte: 'poulet' })
    const deuxMots = moteur.browseRecipes({ constraints: SANS_CONTRAINTE, texte: 'poulet citron' })
    expect(deuxMots.recipeIds.length).toBeLessThanOrEqual(unMot.recipeIds.length)
  })

  it('rend une liste vide, sans lever, quand rien ne correspond', () => {
    // Contrairement à `suggestMeals` qui lève `NoViableRecipeError` : ici l'absence de résultat est
    // une information normale, pas une impasse.
    const resultat = moteur.browseRecipes({ constraints: SANS_CONTRAINTE, texte: 'zzzzznexistepas' })
    expect(resultat.recipeIds).toEqual([])
  })
})

describe('browseRecipes — filtres de facettes', () => {
  it('filtre par cuisine, valeurs réellement présentes au catalogue', () => {
    const cuisines = valeursDeFacette(catalogue, 'cuisine' as FacetteKind)
    expect(cuisines.length).toBeGreaterThan(5)
    const premiere = cuisines[0]!
    const resultat = moteur.browseRecipes({
      constraints: SANS_CONTRAINTE,
      facettes: new Map([['cuisine' as FacetteKind, [premiere.valeur]]]),
    })
    expect(resultat.recipeIds.length).toBe(premiere.nombre)
  })

  it('combine deux valeurs d’une même facette en OU', () => {
    const cuisines = valeursDeFacette(catalogue, 'cuisine' as FacetteKind)
    const [a, b] = [cuisines[0]!, cuisines[1]!]
    const resultat = moteur.browseRecipes({
      constraints: SANS_CONTRAINTE,
      facettes: new Map([['cuisine' as FacetteKind, [a.valeur, b.valeur]]]),
    })
    expect(resultat.recipeIds.length).toBe(a.nombre + b.nombre)
  })

  it('combine deux facettes différentes en ET', () => {
    const facettes = new Map<FacetteKind, readonly string[]>([
      ['cuisine' as FacetteKind, ['francaise']],
      ['style' as FacetteKind, ['quotidien']],
    ])
    const combine = moteur.browseRecipes({ constraints: SANS_CONTRAINTE, facettes })
    const cuisineSeule = moteur.browseRecipes({
      constraints: SANS_CONTRAINTE,
      facettes: new Map([['cuisine' as FacetteKind, ['francaise']]]),
    })
    expect(combine.recipeIds.length).toBeLessThanOrEqual(cuisineSeule.recipeIds.length)
    expect(combine.recipeIds.length).toBeGreaterThan(0)
  })

  it('ordonne les valeurs de facette par fréquence — les filtres utiles d’abord', () => {
    const styles = valeursDeFacette(catalogue, 'style' as FacetteKind)
    for (let i = 1; i < styles.length; i++) {
      expect(styles[i - 1]!.nombre).toBeGreaterThanOrEqual(styles[i]!.nombre)
    }
  })
})

describe('browseRecipes — l’entonnoir et la garantie de sécurité', () => {
  const AVEC_GLUTEN = { allergies: ['gluten' as AllergenId], diet: null, excludedFoodIds: [] } as const

  it('NE REND JAMAIS une recette contenant un allergène déclaré', () => {
    // ⚠️ LA propriété qui justifie que `browseRecipes` passe par les couches du moteur plutôt que
    // par un filtre écrit dans l'écran. Vérifiée sur toutes les recettes rendues, pas par sondage.
    const resultat = moteur.browseRecipes({ constraints: AVEC_GLUTEN })
    for (const id of resultat.recipeIds) {
      const recette = catalogue.recipes.get(id)!
      for (const ingredient of recette.ingredients) {
        const aliment = catalogue.foods.get(ingredient.foodId)
        const porte = aliment?.allergenes.some((a) => a.allergenId === ('gluten' as AllergenId))
        expect(porte, `${recette.nom} contient du gluten`).not.toBe(true)
      }
    }
  })

  it('tient la garantie MÊME avec une recherche textuelle qui viserait un plat exclu', () => {
    // Le contournement naïf : chercher explicitement le plat écarté. Il ne doit pas revenir.
    const sansContrainte = moteur.browseRecipes({ constraints: SANS_CONTRAINTE })
    const avecGluten = new Set(moteur.browseRecipes({ constraints: AVEC_GLUTEN }).recipeIds)
    const exclue = sansContrainte.recipeIds.find((id) => !avecGluten.has(id))
    expect(exclue, 'le catalogue devrait contenir au moins une recette avec gluten').toBeDefined()

    const nom = catalogue.recipes.get(exclue as RecipeId)!.nom
    const cible = moteur.browseRecipes({ constraints: AVEC_GLUTEN, texte: nom })
    expect(cible.recipeIds).not.toContain(exclue)
  })

  it('compte l’entonnoir : total, écartées, et par couche (§6.8)', () => {
    const resultat = moteur.browseRecipes({ constraints: AVEC_GLUTEN })
    expect(resultat.entonnoir.totalInitial).toBe(catalogue.recipes.size)
    expect(resultat.entonnoir.totalRejected).toBeGreaterThan(0)
    expect(resultat.recipeIds.length).toBe(
      resultat.entonnoir.totalInitial - resultat.entonnoir.totalRejected
    )
    expect(resultat.entonnoir.byLayer.get('allergenes')).toBeGreaterThan(0)
  })

  it("ne compte PAS la recherche textuelle dans l'entonnoir", () => {
    // L'entonnoir montre ce que les CONTRAINTES retirent, pas ce que la recherche précise :
    // présenter comme « écartées » les recettes que l'utilisateur vient d'exclure lui-même en
    // tapant deux mots rendrait le chiffre incompréhensible.
    const resultat = moteur.browseRecipes({ constraints: SANS_CONTRAINTE, texte: 'poulet' })
    expect(resultat.entonnoir.totalRejected).toBe(0)
    expect(resultat.recipeIds.length).toBeLessThan(catalogue.recipes.size)
  })

  it('restreint aux favoris quand on le demande, et rend vide sans favori', () => {
    const unId = [...catalogue.recipes.keys()][0]!
    const avec = moteur.browseRecipes({
      constraints: SANS_CONTRAINTE,
      favoriteRecipeIds: new Set([unId]),
      onlyFavorites: true,
    })
    expect(avec.recipeIds).toEqual([unId])

    // Vide plutôt qu'une erreur : à la différence de `suggestMeals`, l'écran doit pouvoir dire
    // « vous n'avez pas encore de favori » au lieu d'afficher une impasse.
    const sans = moteur.browseRecipes({ constraints: SANS_CONTRAINTE, onlyFavorites: true })
    expect(sans.recipeIds).toEqual([])
  })
})
