// @vitest-environment jsdom
//
// ui/screens/recettes.test.tsx — l'écran « Recettes » : recherche et filtres sur le catalogue
// ENTIER (§4.4 DESIGN), sans aucun score de goût (voir l'en-tête de recettes.tsx).
//
// ⚠️ CE QUI COMPTE LE PLUS ICI EST LE MÊME GARDE-FOU QUE PARTOUT AILLEURS DANS CE PROJET :
// allergènes et régime passent par les couches d'exclusion du MOTEUR (`browseRecipes`), jamais par
// un filtre écrit en JavaScript d'écran (§5.2 ARCHITECTURE : « seul garde-fou CRITIQUE et
// incontournable »). Les tests qui suivent le vérifient contre le CATALOGUE RÉEL — allergènes et
// facette `regime` de chaque recette effectivement rendue — pas contre un libellé affiché à l'écran.
//
// ⚠️ L'ÉCRAN NE PAGINE NI NE VIRTUALISE (`recettes.tsx` ne tronque jamais `trouvees`) : les
// assertions « aucune recette listée ne contient X » portent donc sur le catalogue affiché en
// entier, pas sur un sous-ensemble caché par un scroll infini.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { baseCourante, catalogueDeTest, reinitialiserBase, sessionDeTest } from '../test-socle.js'
import type { AllergenId, FacetteKind, RecipeId } from '../../engine/domain/index.js'
import { valeursDeFacette } from '../../engine/search/index.js'
import { writeAllergies, writeDiet } from '../../data/user-store.js'
import {
  AXES_PAR_DEFAUT,
  construireRecette,
  nouvelIdRecette,
  saveUserRecipe,
  type SaisieRecette,
} from '../../data/user-recipe.js'
import { hashDeRecette } from '../router.js'

vi.mock('../catalog-source.js', () => ({ chargerCatalogue: () => Promise.resolve(catalogueDeTest()) }))
vi.mock('../user-source.js', () => ({
  ouvrirUserDb: () => Promise.resolve(sessionDeTest()),
  surErreurDePersistance: () => undefined,
}))

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
})
afterEach(cleanup)

/** Monte l'écran et attend le titre. */
async function monter() {
  const { Recettes } = await import('./recettes.js')
  render(<Recettes />)
  await screen.findByRole('heading', { name: 'Recettes' })
}

const PREFIXE_HREF_RECETTE = hashDeRecette('')

/** Identifiants des recettes RÉELLEMENT RENDUES, extraits des liens de la liste — pas du compteur en
 *  toutes lettres, qui pourrait mentir indépendamment de ce qui est effectivement affiché. */
function idsAffiches(): readonly string[] {
  return [
    ...document.querySelectorAll<HTMLAnchorElement>(`ul li a[href^="${PREFIXE_HREF_RECETTE}"]`),
  ].map((a) => decodeURIComponent(a.getAttribute('href')!.slice(PREFIXE_HREF_RECETTE.length)))
}

/** La `<li>` d'une recette précise, retrouvée par son lien — jamais par position, qui bouge avec le
 *  tri ou un filtre. Évite aussi l'écueil « ul li button » : on prend LE bouton de CETTE carte, pas
 *  n'importe quel bouton de pastille ou de filtre ailleurs sur l'écran. */
function liDe(id: string): HTMLLIElement {
  const lien = document.querySelector(`a[href="${hashDeRecette(id)}"]`)
  if (lien === null) throw new Error(`aucune carte affichée pour ${id}`)
  return lien.closest('li') as HTMLLIElement
}

describe('recettes — le garde-fou allergène', () => {
  // ⛔ §5.2 ARCHITECTURE : « seul garde-fou CRITIQUE et incontournable » du moteur. `browseRecipes`
  // passe par les MÊMES couches d'exclusion que `suggestMeals` (voir l'en-tête de recettes.tsx) — la
  // garantie vérifiée ici est exactement celle qui justifie que cet écran ne filtre pas lui-même.
  it('n’affiche AUCUNE recette contenant du gluten quand l’allergie est déclarée', async () => {
    writeAllergies(baseCourante(), [{ allergenId: 'gluten' as AllergenId, severite: null }])
    await monter()

    const catalogue = catalogueDeTest()
    const ids = idsAffiches()
    expect(ids.length).toBeGreaterThan(0) // sinon le test ne prouve rien

    for (const id of ids) {
      const recette = catalogue.recipes.get(id as RecipeId)
      expect(recette, `${id} absente du catalogue`).toBeDefined()
      for (const ingredient of recette!.ingredients) {
        const aliment = catalogue.foods.get(ingredient.foodId)
        const porteGluten = aliment?.allergenes.some((a) => a.allergenId === ('gluten' as AllergenId))
        expect(porteGluten, `${recette!.nom} contient du gluten`).not.toBe(true)
      }
    }
  })

  it('même garantie pour le lait, deuxième allergène très présent au catalogue', async () => {
    writeAllergies(baseCourante(), [{ allergenId: 'lait' as AllergenId, severite: null }])
    await monter()

    const catalogue = catalogueDeTest()
    const ids = idsAffiches()
    expect(ids.length).toBeGreaterThan(0)

    for (const id of ids) {
      const recette = catalogue.recipes.get(id as RecipeId)!
      for (const ingredient of recette.ingredients) {
        const aliment = catalogue.foods.get(ingredient.foodId)
        const porteLait = aliment?.allergenes.some((a) => a.allergenId === ('lait' as AllergenId))
        expect(porteLait, `${recette.nom} contient du lait`).not.toBe(true)
      }
    }
  })
})

describe('recettes — le filtre temps', () => {
  // Correction demandée explicitement par l'utilisateur : filtres-recettes.tsx sort désormais le
  // temps du dépliant « Plus de filtres », où il était introuvable pour qui ne pense pas à déplier.
  it('est dans le DOM sans avoir ouvert « Plus de filtres »', async () => {
    await monter()
    expect(screen.getByText('Temps maximum')).toBeDefined()
    expect(screen.getByText('20 min')).toBeDefined()
    const boutonPlus = screen.getByText('Plus de filtres').closest('button') as HTMLButtonElement
    expect(boutonPlus.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('recettes — « Plus de filtres »', () => {
  function pastillesDe(titre: string): HTMLButtonElement[] {
    const fieldset = screen.getByText(titre).closest('fieldset') as HTMLElement
    return [...fieldset.querySelectorAll('button')]
  }

  it('déplie toutes les valeurs d’une facette, puis les replie', async () => {
    await monter()
    const totalCuisines = valeursDeFacette(catalogueDeTest(), 'cuisine' as FacetteKind).length
    expect(totalCuisines).toBeGreaterThan(5) // sinon replier/déplier rend la même liste

    expect(pastillesDe('Cuisine').length).toBeLessThanOrEqual(5)

    const boutonPlus = screen.getByText('Plus de filtres').closest('button') as HTMLButtonElement
    fireEvent.click(boutonPlus)
    await waitFor(() => expect(pastillesDe('Cuisine').length).toBe(totalCuisines))
    expect(boutonPlus.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(screen.getByText('Moins de filtres'))
    await waitFor(() => expect(pastillesDe('Cuisine').length).toBeLessThanOrEqual(5))
    expect(boutonPlus.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('recettes — filtrer par cuisine réduit vraiment la liste', () => {
  it('une pastille choisie restreint le résultat, la retirer le restaure', async () => {
    await monter()
    const avant = idsAffiches().length

    const fieldset = screen.getByText('Cuisine').closest('fieldset') as HTMLElement
    // Les cinq pastilles visibles au départ sont les plus fréquentes (comptes triés) : aucune n'est
    // à zéro, donc aucune n'est désactivée — la première suffit.
    const pastille = fieldset.querySelector('button') as HTMLButtonElement
    expect(pastille.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(pastille)
    await waitFor(() => expect(pastille.getAttribute('aria-pressed')).toBe('true'))
    const apres = idsAffiches().length
    expect(apres).toBeGreaterThan(0)
    expect(apres).toBeLessThan(avant)

    fireEvent.click(pastille)
    await waitFor(() => expect(idsAffiches().length).toBe(avant))
  })
})

describe('recettes — la recherche textuelle', () => {
  it('trouve une recette du catalogue réel par son nom', async () => {
    await monter()
    const cible = [...catalogueDeTest().recipes.values()][0]!
    const champ = document.querySelector('input[type="search"]') as HTMLInputElement
    fireEvent.change(champ, { target: { value: cible.nom } })
    await waitFor(() => expect(idsAffiches()).toContain(cible.id))
  })

  it('dit qu’il n’y a rien plutôt que de laisser la liste rétrécir en silence', async () => {
    // `Entonnoir` ne compte que les exclusions dures (allergènes, régime…) — voir l'en-tête de
    // recettes.tsx : une recherche sans résultat n'y figure pas. C'est la phrase de compte, juste en
    // dessous de la liste, qui porte l'explication (« … essayez de retirer un filtre »).
    await monter()
    const champ = document.querySelector('input[type="search"]') as HTMLInputElement
    fireEvent.change(champ, { target: { value: 'zzzzznexistepasdutoutducatalogue' } })
    await screen.findByText(/0 recette — essayez de retirer un filtre\./)
    expect(idsAffiches().length).toBe(0)
  })
})

describe('recettes — les recettes personnelles', () => {
  // Chaîne `avecRecettesSupplementaires` → index reconstruits (ui/socle.ts) : une recette perso
  // (préfixe `perso:`) doit apparaître dans la liste au même titre qu'une recette du catalogue.
  it('une recette perso apparaît dans la liste', async () => {
    const catalogue = catalogueDeTest()
    const unAliment = [...catalogue.foods.keys()][0]!
    const id = nouvelIdRecette(1, 0.42)
    const saisie: SaisieRecette = {
      nom: 'Ma composition test unique 9284',
      tempsPrepMin: 10,
      tempsCuissonMin: 0,
      portionsBase: 2,
      difficulte: 1,
      typesRepas: ['diner'],
      envergure: 'quotidien',
      conservationJours: 1,
      axes: AXES_PAR_DEFAUT,
      ingredients: [{ foodId: unAliment, quantiteG: 100, uniteAffichage: '100 g', optionnel: false }],
      etapes: ['Mélanger et servir.'],
    }
    saveUserRecipe(baseCourante(), construireRecette(id, saisie, null), '2026-08-01')

    await monter()
    expect(idsAffiches()).toContain(id)
    expect(screen.getByText('Ma composition test unique 9284')).toBeDefined()
  })
})

describe('recettes — le régime déclaré', () => {
  // Chaîne d'inclusion vegetalien ⊂ vegetarien ⊂ pescetarien ⊂ omnivore
  // (engine/selection/regime.ts) : déclarer `vegetarien` ne doit laisser passer AUCUNE recette
  // omnivore ni pescétarienne. Vérifié contre la facette `regime` réelle de chaque recette listée.
  it('« végétarien » exclut toute recette omnivore ou pescétarienne', async () => {
    writeDiet(baseCourante(), 'vegetarien')
    await monter()

    const catalogue = catalogueDeTest()
    const ids = idsAffiches()
    expect(ids.length).toBeGreaterThan(0)

    for (const id of ids) {
      const recette = catalogue.recipes.get(id as RecipeId)!
      const regimes = recette.facettes.filter((f) => f.facette === 'regime').map((f) => f.valeur)
      expect(
        regimes.some((r) => r === 'omnivore' || r === 'pescetarien'),
        `${recette.nom} porte : ${regimes.join(', ')}`
      ).toBe(false)
    }
  })
})

describe('recettes — les favoris', () => {
  // Deux allers-retours en base enchaînés (`setFavorite` puis `rafraichir`) : exactement le genre
  // d'état à deux sauts que test-socle.ts documente comme source de bugs déjà trouvés en pilotant
  // l'écran. On vérifie la chaîne complète : marquer, puis filtrer sur « Mes favoris ».
  it('marquer un favori le fait apparaître seul sous « Mes favoris »', async () => {
    await monter()
    const id = idsAffiches()[0]!

    const etoile = liDe(id).querySelector('button') as HTMLButtonElement
    expect(etoile.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(etoile)
    await waitFor(() => expect(liDe(id).querySelector('button')!.getAttribute('aria-pressed')).toBe('true'))

    const boutonFavoris = screen.getByText(/^Mes favoris \(\d+\)$/).closest('button') as HTMLButtonElement
    expect(boutonFavoris.textContent).toBe('Mes favoris (1)')

    fireEvent.click(boutonFavoris)
    await waitFor(() => expect(idsAffiches()).toEqual([id]))
  })
})
