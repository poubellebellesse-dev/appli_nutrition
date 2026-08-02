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
import { normaliser, valeursDeEnvergure, valeursDeFacette, valeursDeService } from '../app/src/engine/search/index.js'
import type { AllergenId, Catalog, CourseKind, FacetteKind, FoodId, RecipeId } from '../app/src/engine/domain/index.js'

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

describe('browseRecipes — filtres de service et d’envergure, hors facette', () => {
  it('filtre par service, valeurs réellement présentes au catalogue', () => {
    const services = valeursDeService(catalogue)
    // ⚠️ Garde contre `it.each([])` : si `services` était vide, la boucle ci-dessous ne
    // vérifierait rien et laisserait la suite verte sans avoir prouvé quoi que ce soit.
    expect(services.length).toBeGreaterThan(0)

    for (const { valeur, nombre } of services) {
      const resultat = moteur.browseRecipes({
        constraints: SANS_CONTRAINTE,
        services: [valeur],
      })
      expect(resultat.recipeIds.length).toBe(nombre)
      for (const id of resultat.recipeIds) {
        expect(catalogue.recipes.get(id)?.service).toBe(valeur)
      }
    }
  })

  it('« plat » rend ~144 recettes et AUCUNE dont le service diffère', () => {
    const resultat = moteur.browseRecipes({ constraints: SANS_CONTRAINTE, services: ['plat' as CourseKind] })
    expect(resultat.recipeIds.length).toBeGreaterThan(100)
    for (const id of resultat.recipeIds) {
      expect(catalogue.recipes.get(id)?.service).toBe('plat')
    }
  })

  it('⛔ « fromage » — 0 recette au catalogue — n’est PAS une valeur proposée', () => {
    // Leçon documentée du projet : une liste recopiée ne détecte pas ce qui manque à l'original.
    // `valeursDeService` est dérivée du catalogue ; `fromage` ne doit donc apparaître nulle part.
    const services = valeursDeService(catalogue)
    expect(services.some((s) => s.valeur === 'fromage')).toBe(false)
  })

  it('combine deux services en OU', () => {
    const services = valeursDeService(catalogue)
    const [a, b] = [services[0]!, services[1]!]
    const resultat = moteur.browseRecipes({ constraints: SANS_CONTRAINTE, services: [a.valeur, b.valeur] })
    expect(resultat.recipeIds.length).toBe(a.nombre + b.nombre)
  })

  it('filtre par envergure, valeurs réellement présentes au catalogue', () => {
    const envergures = valeursDeEnvergure(catalogue)
    expect(envergures.length).toBeGreaterThan(0)
    const premiere = envergures[0]!
    const resultat = moteur.browseRecipes({
      constraints: SANS_CONTRAINTE,
      envergures: [premiere.valeur],
    })
    expect(resultat.recipeIds.length).toBe(premiere.nombre)
  })

  it('combine service ET envergure en ET — plus restrictif que chacun seul', () => {
    const services = valeursDeService(catalogue)
    const envergures = valeursDeEnvergure(catalogue)
    const service = services[0]!
    const envergure = envergures[0]!
    const combine = moteur.browseRecipes({
      constraints: SANS_CONTRAINTE,
      services: [service.valeur],
      envergures: [envergure.valeur],
    })
    expect(combine.recipeIds.length).toBeLessThanOrEqual(service.nombre)
    expect(combine.recipeIds.length).toBeLessThanOrEqual(envergure.nombre)
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

describe('searchByPantry — « vider le frigo » sur le catalogue réel', () => {
  /** Quelques aliments très courants, présents à coup sûr dans plusieurs recettes. */
  function gardeManger(n: number): readonly FoodId[] {
    const compte = new Map<FoodId, number>()
    for (const recette of catalogue.recipes.values()) {
      for (const i of recette.ingredients) compte.set(i.foodId, (compte.get(i.foodId) ?? 0) + 1)
    }
    return [...compte.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([id]) => id)
  }

  it('ÉCARTE ce qui n’a aucun rapport, sans pour autant vider la page', () => {
    // ⚠️ Ce test disait l'inverse jusqu'au 2026-08-02 : « CLASSE sans filtrer », par crainte qu'un
    // filtre rende zéro résultat et fasse croire à une panne. Un essai sur téléphone a tranché
    // autrement — afficher des plats qui ne partagent RIEN avec le garde-manger est du bruit, et
    // c'est ce que l'utilisateur a vu en premier. La crainte d'origine ne se réalise pas : deux
    // ingrédients courants suffisent à garder des dizaines de plats.
    const resultat = moteur.searchByPantry({
      constraints: SANS_CONTRAINTE,
      pantryFoodIds: gardeManger(2),
    })
    expect(resultat.matches.length).toBeGreaterThan(20)
    expect(resultat.matches.length).toBeLessThan(catalogue.recipes.size)
    // Chaque résultat justifie sa présence : partager un ingrédient non optionnel implique une
    // masse commune, donc une couverture strictement positive. Aucun zéro ne doit passer.
    for (const match of resultat.matches) expect(match.couverture).toBeGreaterThan(0)
  })

  it('un garde-manger vide ne filtre RIEN — l’écran reste explorable avant toute saisie', () => {
    const resultat = moteur.searchByPantry({ constraints: SANS_CONTRAINTE, pantryFoodIds: [] })
    expect(resultat.matches.length).toBe(catalogue.recipes.size)
  })

  it('un garde-manger réduit aux fonds de placard ne « correspond » à rien', () => {
    // Sel, poivre et épices sèches sont des ingrédients non optionnels d'une grande part du
    // catalogue : les compter ferait correspondre 175 recettes sur 241 à un garde-manger vide de
    // tout vrai aliment — mesuré. Partager du sel n'est pas partager un ingrédient.
    const placard = [...catalogue.foods.values()].filter((f) => f.fondDePlacard).map((f) => f.id)
    expect(placard.length).toBeGreaterThan(0)
    const resultat = moteur.searchByPantry({
      constraints: SANS_CONTRAINTE,
      pantryFoodIds: placard,
    })
    expect(resultat.matches).toHaveLength(0)
  })

  it('trie par couverture décroissante', () => {
    const resultat = moteur.searchByPantry({
      constraints: SANS_CONTRAINTE,
      pantryFoodIds: gardeManger(6),
    })
    for (let i = 1; i < resultat.matches.length; i++) {
      expect(resultat.matches[i - 1]!.couverture).toBeGreaterThanOrEqual(
        resultat.matches[i]!.couverture
      )
    }
    expect(resultat.matches[0]!.couverture).toBeGreaterThan(0)
  })

  it('dit ce qu’il MANQUE, et les manquants sont bien absents du garde-manger', () => {
    const garde = gardeManger(6)
    const resultat = moteur.searchByPantry({ constraints: SANS_CONTRAINTE, pantryFoodIds: garde })
    const dedans = new Set(garde)
    for (const match of resultat.matches.slice(0, 40)) {
      for (const manquant of match.manquants) {
        expect(dedans.has(manquant), 'un manquant ne peut pas être au garde-manger').toBe(false)
      }
    }
  })

  it('n’annonce jamais un ingrédient OPTIONNEL comme manquant', () => {
    // Ne pas avoir une garniture facultative n'empêche pas de cuisiner le plat.
    const resultat = moteur.searchByPantry({ constraints: SANS_CONTRAINTE, pantryFoodIds: gardeManger(4) })
    for (const match of resultat.matches.slice(0, 40)) {
      const recette = catalogue.recipes.get(match.recipeId)!
      const optionnels = new Set(recette.ingredients.filter((i) => i.optionnel).map((i) => i.foodId))
      for (const manquant of match.manquants) expect(optionnels.has(manquant)).toBe(false)
    }
  })

  it('« Réalisables maintenant » ne garde QUE les recettes sans manquant', () => {
    const resultat = moteur.searchByPantry({
      constraints: SANS_CONTRAINTE,
      pantryFoodIds: gardeManger(30),
      seulementRealisables: true,
    })
    for (const match of resultat.matches) expect(match.manquants).toEqual([])
  })

  it('APPLIQUE les allergies — le frigo ne contourne pas le garde-fou', () => {
    // Même propriété que pour la recherche : un écran qui refiltrerait lui-même finirait par
    // proposer un plat contenant un allergène déclaré.
    const resultat = moteur.searchByPantry({
      constraints: { allergies: ['gluten' as AllergenId], diet: null, excludedFoodIds: [] },
      pantryFoodIds: gardeManger(6),
    })
    for (const match of resultat.matches) {
      const recette = catalogue.recipes.get(match.recipeId)!
      for (const ingredient of recette.ingredients) {
        const porte = catalogue.foods
          .get(ingredient.foodId)
          ?.allergenes.some((a) => a.allergenId === ('gluten' as AllergenId))
        expect(porte, `${recette.nom} contient du gluten`).not.toBe(true)
      }
    }
    expect(resultat.entonnoir.byLayer.get('allergenes')).toBeGreaterThan(0)
  })

  it('accepte LES MÊMES filtres de facette que la recherche — §4.5 « les mêmes que Recettes »', () => {
    const garde = gardeManger(6)
    const sansFiltre = moteur.searchByPantry({ constraints: SANS_CONTRAINTE, pantryFoodIds: garde })
    const filtre = moteur.searchByPantry({
      constraints: SANS_CONTRAINTE,
      pantryFoodIds: garde,
      facettes: new Map([['cuisine' as FacetteKind, ['italienne']]]),
    })

    expect(filtre.matches.length).toBeLessThan(sansFiltre.matches.length)
    expect(filtre.matches.length).toBeGreaterThan(0)
    for (const match of filtre.matches) {
      const cuisines = catalogue.recipes
        .get(match.recipeId)!
        .facettes.filter((f) => f.facette === 'cuisine')
        .map((f) => f.valeur)
      expect(cuisines).toContain('italienne')
    }
  })

  it('garde le classement par couverture APRÈS filtrage — filtrer ne réordonne pas', () => {
    const filtre = moteur.searchByPantry({
      constraints: SANS_CONTRAINTE,
      pantryFoodIds: gardeManger(6),
      facettes: new Map([['cuisine' as FacetteKind, ['francaise']]]),
    })
    for (let i = 1; i < filtre.matches.length; i++) {
      expect(filtre.matches[i - 1]!.couverture).toBeGreaterThanOrEqual(filtre.matches[i]!.couverture)
    }
  })

  it('rend une couverture nulle et tout en manquant sur un garde-manger vide', () => {
    const resultat = moteur.searchByPantry({ constraints: SANS_CONTRAINTE, pantryFoodIds: [] })
    expect(resultat.matches.length).toBe(catalogue.recipes.size)
    // `scorePantry` rend NEUTRAL_SCORE quand rien n'est déclaré (l'absence d'information n'est pas
    // une information) — l'écran, lui, n'appelle pas tant que le garde-manger est vide.
    expect(resultat.matches.every((m) => m.manquants.length > 0)).toBe(true)
  })
})
