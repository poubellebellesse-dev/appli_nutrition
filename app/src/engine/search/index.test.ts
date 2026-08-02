// engine/search/index.test.ts — `filtrerRecettes` sur les axes hors facette : service (`CourseKind`)
// et envergure (`RecipeEnvergure`). Les axes de facette (cuisine/régime/style/occasion) sont déjà
// couverts sur le catalogue réel par `tests/recherche-catalogue-reel.test.ts` ; ceux-ci n'y ont pas
// d'équivalent avant ce lot.

import { describe, expect, it } from 'vitest'
import { makeCatalog, makeRecipe } from '../selection/test-fixtures.js'
import { construireIndex, filtrerRecettes, type CritereRecherche } from './index.js'
import type { RecipeId } from '../domain/index.js'

const entree = makeRecipe('entree', { service: 'entree' })
const platA = makeRecipe('plat-a', { service: 'plat', envergure: 'quotidien' })
const platB = makeRecipe('plat-b', { service: 'plat', envergure: 'fete' })
const dessert = makeRecipe('dessert', { service: 'dessert', envergure: 'convivial' })
const nonRenseignee = makeRecipe('non-renseignee') // service: null

const catalogue = makeCatalog([entree, platA, platB, dessert, nonRenseignee])
const index = construireIndex(catalogue)
const TOUS: readonly RecipeId[] = [...catalogue.recipes.keys()]

function filtrer(critere: CritereRecherche): readonly RecipeId[] {
  return filtrerRecettes(catalogue, index, TOUS, critere)
}

describe('search/filtrerRecettes — critère vide (non-régression)', () => {
  it('sans services ni envergures, rien n’est filtré', () => {
    expect(filtrer({})).toEqual(TOUS)
    expect(filtrer({ services: [], envergures: [] })).toEqual(TOUS)
  })
})

describe('search/filtrerRecettes — services', () => {
  it('retient seulement le service demandé', () => {
    expect(filtrer({ services: ['dessert'] })).toEqual([dessert.id])
  })

  it('combine deux services en OU', () => {
    const resultat = filtrer({ services: ['entree', 'dessert'] })
    expect(new Set(resultat)).toEqual(new Set([entree.id, dessert.id]))
  })

  it('une recette au service NON RENSEIGNÉ ne correspond à aucun service demandé', () => {
    // §5.1 bis : l'absence d'information n'est pas une valeur. `non-renseignee` (service: null) ne
    // doit apparaître dans AUCUN filtre par service, même le plus large.
    const resultat = filtrer({ services: ['entree', 'plat', 'accompagnement', 'fromage', 'dessert'] })
    expect(resultat).not.toContain(nonRenseignee.id)
  })
})

describe('search/filtrerRecettes — envergures', () => {
  it('retient seulement l’envergure demandée', () => {
    expect(filtrer({ envergures: ['fete'] })).toEqual([platB.id])
  })

  it('combine deux envergures en OU', () => {
    const resultat = filtrer({ envergures: ['fete', 'convivial'] })
    expect(new Set(resultat)).toEqual(new Set([platB.id, dessert.id]))
  })
})

describe('search/filtrerRecettes — service ET envergure combinés (ET entre axes)', () => {
  it('un plat de fête n’est pas un plat quotidien : les deux critères s’appliquent ensemble', () => {
    const resultat = filtrer({ services: ['plat'], envergures: ['quotidien'] })
    expect(resultat).toEqual([platA.id])
  })

  it('rend vide quand aucune recette ne satisfait les deux à la fois', () => {
    expect(filtrer({ services: ['entree'], envergures: ['fete'] })).toEqual([])
  })
})
