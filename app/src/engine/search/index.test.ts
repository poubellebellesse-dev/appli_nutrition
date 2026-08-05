// engine/search/index.test.ts — `filtrerRecettes` sur les axes hors facette : service (`CourseKind`)
// et envergure (`RecipeEnvergure`). Les axes de facette (cuisine/régime/style/occasion) sont déjà
// couverts sur le catalogue réel par `tests/recherche-catalogue-reel.test.ts` ; ceux-ci n'y ont pas
// d'équivalent avant ce lot.

import { describe, expect, it } from 'vitest'
import { makeCatalog, makeRecipe } from '../selection/test-fixtures.js'
import { chercherParNom, construireIndex, filtrerRecettes, type CritereRecherche } from './index.js'
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

// ─────────────────────────────────────────────────────────────────────────────────────────────
// `chercherParNom` — décision 58. Les fixtures reprennent les NOMS ÉDITORIAUX RÉELS du catalogue :
// c'est leur forme (« Coquille Saint-Jacques, crue », « Œuf de poule, entier, cru ») qui a fait
// échouer la recherche par sous-chaîne, pas un cas inventé pour le test.
// ─────────────────────────────────────────────────────────────────────────────────────────────

const CATALOGUE_REEL = [
  { nom: 'Tomate, crue' },
  { nom: 'Tomate cerise, crue' },
  { nom: 'Concentré de tomate' },
  { nom: 'Sauce soja' },
  { nom: 'Coquille Saint-Jacques, crue' },
  { nom: 'Noix, cerneau' },
  { nom: 'Blanc de poulet, cru' },
  { nom: 'Œuf de poule, entier, cru' },
  { nom: 'Riz blanc, cru' },
  { nom: 'Farine de riz' },
  { nom: 'Maïs doux, en conserve' },
]

const noms = (saisie: string, limite = 6): readonly string[] =>
  chercherParNom(CATALOGUE_REEL, saisie, limite).map((e) => e.nom)

describe('search/chercherParNom — ce que la sous-chaîne seule ne trouvait pas', () => {
  it('une saisie PLUS LONGUE que le nom trouve quand même — le cas qui rendait une liste vide', () => {
    // « noix de saint-jacques » n'est pas une sous-chaîne de « Coquille Saint-Jacques, crue ».
    expect(noms('noix de saint-jacques')[0]).toBe('Coquille Saint-Jacques, crue')
  })

  it('un pluriel trouve le singulier — on tape ce qu’on a rapporté, pas le nom de la fiche', () => {
    expect(noms('tomates')).toContain('Tomate, crue')
  })

  it('l’ordre des mots n’a pas à être celui du nom éditorial', () => {
    expect(noms('poulet blanc')).toContain('Blanc de poulet, cru')
  })

  it('rend vide quand l’aliment est vraiment absent — on ne rapproche pas à tout prix', () => {
    expect(noms('coppa')).toEqual([])
  })
})

describe('search/chercherParNom — le littéral passe devant l’approximatif', () => {
  it('une sous-chaîne exacte est classée avant un appariement par mots', () => {
    const resultat = noms('tomate')
    expect(resultat[0]).toBe('Tomate, crue')
    expect(resultat).not.toContain('Sauce soja')
  })

  it('le rang permissif ne s’invite PAS quand le littéral a rempli la liste', () => {
    // « tomate cerise » est une sous-chaîne d’un seul nom. Une place, une réponse : les entrées qui
    // ne partagent que « tomate » restent dehors.
    expect(noms('tomate cerise', 1)).toEqual(['Tomate cerise, crue'])
  })

  it('… et complète bien dès qu’il reste de la place, sans jamais passer devant', () => {
    const resultat = noms('tomate cerise', 3)
    expect(resultat[0]).toBe('Tomate cerise, crue')
    expect(resultat).toHaveLength(3)
  })

  it('un mot long l’emporte sur un mot court, plus discriminant à saisie égale', () => {
    // « tomate » (6 lettres) pèse plus que « sauce » (5) : la tomate passe devant la sauce soja.
    const resultat = noms('sauce tomate')
    expect(resultat.indexOf('Tomate, crue')).toBeLessThan(resultat.indexOf('Sauce soja'))
  })

  it('respecte la limite demandée', () => {
    expect(noms('tomate', 2)).toHaveLength(2)
  })

  it('un nom qui COMMENCE par la saisie passe devant un nom qui la porte au milieu', () => {
    // Verrouille le départage par POSITION. Sur la seule longueur du nom, « Farine de riz » (13)
    // passait devant « Riz blanc, cru » (14) : taper « riz » rendait de la farine.
    expect(noms('riz')[0]).toBe('Riz blanc, cru')
  })
})

describe('search/chercherParNom — les pièges de la normalisation française', () => {
  it('« oeuf » trouve « Œuf » — la ligature, que NFD ne décompose PAS', () => {
    expect(noms('oeuf')).toContain('Œuf de poule, entier, cru')
  })

  it('un mot court finissant par -s n’est pas amputé : « riz » reste « riz »', () => {
    expect(noms('riz')).toContain('Riz blanc, cru')
  })

  it('le pluriel grossier est SYMÉTRIQUE, donc inoffensif : « mais » trouve « Maïs »', () => {
    expect(noms('mais')).toContain('Maïs doux, en conserve')
  })

  it('un mot vide seul ne rapproche rien — sinon « de » rendrait la moitié du catalogue', () => {
    expect(noms('de')).toEqual([])
  })
})

describe('search/chercherParNom — ordre total', () => {
  it('l’ordre ne dépend pas de celui de la source : deux sources permutées rendent le même ordre', () => {
    const inverse = [...CATALOGUE_REEL].reverse()
    expect(chercherParNom(inverse, 'tomate', 6).map((e) => e.nom)).toEqual(noms('tomate'))
  })
})

// --- Synonymes (décision 58, cause 2) ---------------------------------------------------------
//
// Ce que ces tests verrouillent n'est PAS « le synonyme marche » — c'est qu'il n'a rien coûté aux
// entrées qui n'en ont pas. Le classement de `chercherParNom` a déjà été cassé une fois par un
// départage mal choisi ; élargir l'appariement est exactement le genre de changement qui le
// recasse sans qu'aucun test existant ne rougisse.

const PORC = { nom: 'Porc, poitrine crue', synonymes: ['lardon'] }
const CREVETTE = { nom: 'Crevette, crue', synonymes: ['gambas'] }

describe('search/chercherParNom — synonymes', () => {
  it('trouve par un nom d’usage que le nom éditorial ne contient pas', () => {
    expect(chercherParNom([PORC, CREVETTE], 'lardon', 6).map((e) => e.nom)).toEqual([
      'Porc, poitrine crue',
    ])
  })

  it('… et sans le synonyme, la même saisie ne rend RIEN — c’est bien lui qui travaille', () => {
    expect(chercherParNom([{ nom: PORC.nom }, { nom: CREVETTE.nom }], 'lardon', 6)).toEqual([])
  })

  it('le pluriel vaut pour un synonyme comme pour un nom : « gambas » puis « gamba »', () => {
    expect(chercherParNom([PORC, CREVETTE], 'gamba', 6).map((e) => e.nom)).toEqual(['Crevette, crue'])
  })

  it('NE CRÉE AUCUNE ENTRÉE : une saisie appariée rend l’aliment porteur, jamais le synonyme', () => {
    const trouve = chercherParNom([PORC, CREVETTE], 'lardon', 6)
    expect(trouve).toHaveLength(1)
    expect(trouve[0]).toBe(PORC)
  })

  it('une entrée dont AUCUN synonyme ne s’apparie est classée exactement comme sans eux', () => {
    // La non-régression du classement, verrouillée sur les six saisies déjà couvertes plus haut.
    const avecDuBruit = CATALOGUE_REEL.map((e) => ({ ...e, synonymes: ['xyzzy', 'plugh'] }))
    for (const saisie of ['tomate', 'riz', 'sauce tomate', 'tomate cerise', 'oeuf', 'poulet blanc']) {
      expect(chercherParNom(avecDuBruit, saisie, 6).map((e) => e.nom)).toEqual(noms(saisie))
    }
  })

  it('accepte encore une entrée SANS champ synonymes — les recettes n’en ont pas', () => {
    // `synonymes` est optionnel dans la contrainte générique, et requis sur `Food` : les deux
    // appelants coexistent. Si ce test cesse de compiler, la contrainte a été resserrée à tort.
    expect(chercherParNom([{ nom: 'Tomate, crue' }], 'tomate', 6)).toHaveLength(1)
  })
})
