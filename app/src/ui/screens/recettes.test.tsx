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
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { baseCourante, catalogueDeTest, reinitialiserBase, sessionDeTest } from '../test-socle.js'
import type { AllergenId, FacetteKind, RecipeId } from '../../engine/domain/index.js'
import { valeursDeEnvergure, valeursDeFacette, valeursDeService } from '../../engine/search/index.js'
import { writeAllergies, writeDiet } from '../../data/user-store.js'
import {
  AXES_PAR_DEFAUT,
  construireRecette,
  nouvelIdRecette,
  saveUserRecipe,
  type SaisieRecette,
} from '../../data/user-recipe.js'
import { hashDeLEditeur, hashDeRecette } from '../router.js'

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

/** Monte l'écran et attend le titre. Retourne le conteneur RTL — pas `document.body` — pour pouvoir
 *  distinguer l'écran principal du panneau « Filtres », qui passe par un portail vers `document.body`
 *  (voir panneau.tsx). `container.querySelector` ne voit jamais le portail ; `screen.getByText` si. */
async function monter(): Promise<HTMLElement> {
  const { Recettes } = await import('./recettes.js')
  const { container } = render(<Recettes />)
  await screen.findByRole('heading', { name: 'Recettes' })
  return container
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
    // Le temps est là AVANT toute ouverture : aucune fenêtre n'est montée à ce stade.
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Plus de filtres' })).toBeDefined()
  })
})

describe('recettes — chaque axe filtrable ouvre SA propre fenêtre', () => {
  // Retour d'essai explicite : « la cuisine est à deux gestes ». Cuisine, Régime et Service sont
  // maintenant en ACCÈS DIRECT sur l'écran — un bouton, une fenêtre, un geste.
  const AXES_DIRECTS: readonly { readonly titre: string; readonly total: () => number }[] = [
    { titre: 'Cuisine', total: () => valeursDeFacette(catalogueDeTest(), 'cuisine' as FacetteKind).length },
    { titre: 'Régime', total: () => valeursDeFacette(catalogueDeTest(), 'regime' as FacetteKind).length },
    { titre: 'Service', total: () => valeursDeService(catalogueDeTest()).length },
  ]
  it('⛔ garde contre un `it.each([])` qui laisserait la suite verte sans avoir rien exercé', () => {
    expect(AXES_DIRECTS.length).toBe(3)
  })

  it.each(AXES_DIRECTS)(
    '« $titre » ouvre un dialogue à son nom, listant TOUTES ses valeurs',
    async ({ titre, total }) => {
      await monter()
      expect(total()).toBeGreaterThan(0)
      expect(screen.queryByRole('dialog')).toBeNull()

      // ⚠️ `aria-haspopup="dialog"`, PAS `aria-expanded` : ce bouton n'agrandit rien en place.
      const bouton = screen.getByRole('button', { name: new RegExp(`^${titre}`) })
      expect(bouton.getAttribute('aria-haspopup')).toBe('dialog')
      fireEvent.click(bouton)

      const panneau = await screen.findByRole('dialog', { name: titre })
      // ⚠️ PAS `within(panneau).getByText(titre)` : le TITRE de la fenêtre (son `<h2>`) porte le
      // même texte que la légende du fieldset qu'elle contient — deux axes, un seul fieldset dans
      // ce panneau, donc `querySelector` suffit sans ambiguïté.
      const fieldset = panneau.querySelector('fieldset') as HTMLElement
      expect(fieldset.querySelectorAll('button').length).toBe(total())

      fireEvent.click(within(panneau).getByRole('button', { name: /Retour/ }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    }
  )

  it('est un portail : ouvrir une fenêtre n’allonge pas la liste de recettes en dessous', async () => {
    await monter()
    fireEvent.click(screen.getByRole('button', { name: /^Cuisine/ }))
    const panneau = await screen.findByRole('dialog', { name: 'Cuisine' })

    // Un `fixed` posé dans le flux normal se serait retrouvé sous un ancêtre de la page ; le
    // portail le place en enfant DIRECT de `document.body`, hors de la `<ul>` des recettes.
    expect(panneau.parentElement).toBe(document.body)
    expect(panneau.closest('ul')).toBeNull()
  })
})

describe('recettes — « Plus de filtres » = D’AUTRES filtres, jamais les mêmes', () => {
  // ⛔ Le défaut rapporté explicitement : « Plus de filtres » affichait les DEUX MÊMES facettes que
  // l'écran, seulement complètes. Ici il doit contenir Style, Occasion et Envergure — jamais
  // Cuisine, Régime ni Service, déjà en accès direct.
  it('contient Style, Occasion, Envergure — et AUCUN des axes en accès direct', async () => {
    await monter()
    fireEvent.click(screen.getByRole('button', { name: 'Plus de filtres' }))
    const panneau = await screen.findByRole('dialog', { name: 'Plus de filtres' })

    expect(within(panneau).getByText('Style')).toBeDefined()
    expect(within(panneau).getByText('Occasion')).toBeDefined()
    expect(within(panneau).getByText('Envergure')).toBeDefined()

    // Assertions d'ABSENCE en regex ancrée : un `getByText` exact aurait laissé passer un libellé
    // partiel (« Cuisine régionale ») sans rien prouver de l'absence réelle du fieldset « Cuisine ».
    expect(within(panneau).queryByText(/^Cuisine$/)).toBeNull()
    expect(within(panneau).queryByText(/^Régime$/)).toBeNull()
    expect(within(panneau).queryByText(/^Service$/)).toBeNull()
  })

  it('⛔ « Fromage » — 0 recette au catalogue — n’apparaît dans aucune fenêtre', async () => {
    // Dérivé des données, pas d'une liste écrite à la main — la leçon documentée du projet.
    const services = valeursDeService(catalogueDeTest())
    expect(services.length).toBeGreaterThan(0)
    expect(services.some((s) => s.valeur === 'fromage')).toBe(false)

    await monter()
    fireEvent.click(screen.getByRole('button', { name: /^Service/ }))
    const panneau = await screen.findByRole('dialog', { name: 'Service' })
    expect(within(panneau).queryByText(/Fromage/)).toBeNull()
  })
})

describe('recettes — filtrer par cuisine réduit vraiment la liste', () => {
  it('une pastille choisie dans la fenêtre Cuisine restreint le résultat, la retirer le restaure', async () => {
    await monter()
    const avant = idsAffiches().length

    fireEvent.click(screen.getByRole('button', { name: /^Cuisine/ }))
    const panneau = await screen.findByRole('dialog', { name: 'Cuisine' })
    // Un seul fieldset dans ce panneau — voir la note du bloc précédent sur l'ambiguïté du texte.
    const fieldset = panneau.querySelector('fieldset') as HTMLElement
    // Au moins une pastille du catalogue réel n'est pas à zéro (241 recettes) — la première suffit.
    const pastille = fieldset.querySelector('button:not([disabled])') as HTMLButtonElement
    expect(pastille.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(pastille)
    await waitFor(() => expect(pastille.getAttribute('aria-pressed')).toBe('true'))

    fireEvent.click(within(panneau).getByRole('button', { name: /Retour/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    const apres = idsAffiches().length
    expect(apres).toBeGreaterThan(0)
    expect(apres).toBeLessThan(avant)

    // ⚠️ Le bouton annonce désormais son propre compte — sans lui, savoir qu'un filtre est actif
    // demanderait de rouvrir la fenêtre.
    expect(screen.getByRole('button', { name: /^Cuisine · 1$/ })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: /^Cuisine/ }))
    const panneau2 = await screen.findByRole('dialog', { name: 'Cuisine' })
    const fieldset2 = panneau2.querySelector('fieldset') as HTMLElement
    fireEvent.click(fieldset2.querySelector('button[aria-pressed="true"]') as HTMLButtonElement)
    await waitFor(() => expect(idsAffiches().length).toBe(avant))
  })
})

describe('recettes — filtrer par service (entrée/plat/dessert…)', () => {
  it('choisir « Plat » ne laisse à l’écran que des recettes dont le service est PLAT', async () => {
    await monter()
    fireEvent.click(screen.getByRole('button', { name: /^Service/ }))
    const panneau = await screen.findByRole('dialog', { name: 'Service' })
    fireEvent.click(within(panneau).getByRole('button', { name: /^Plat \(\d+\)$/ }))
    fireEvent.click(within(panneau).getByRole('button', { name: /Retour/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    const catalogue = catalogueDeTest()
    const ids = idsAffiches()
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      expect(catalogue.recipes.get(id as RecipeId)?.service).toBe('plat')
    }
  })
})

describe('recettes — filtrer par envergure, derrière « Plus de filtres »', () => {
  it('choisir une envergure ne laisse que les recettes de cette envergure', async () => {
    await monter()
    const envergures = valeursDeEnvergure(catalogueDeTest())
    expect(envergures.length).toBeGreaterThan(0)
    const cible = envergures[0]!

    fireEvent.click(screen.getByRole('button', { name: 'Plus de filtres' }))
    const panneau = await screen.findByRole('dialog', { name: 'Plus de filtres' })
    const fieldset = within(panneau).getByText('Envergure').closest('fieldset') as HTMLElement
    fireEvent.click(within(fieldset).getByRole('button', { name: new RegExp(`\\(${cible.nombre}\\)$`) }))
    fireEvent.click(within(panneau).getByRole('button', { name: /Retour/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    const catalogue = catalogueDeTest()
    const ids = idsAffiches()
    expect(ids.length).toBe(cible.nombre)
    for (const id of ids) {
      expect(catalogue.recipes.get(id as RecipeId)?.envergure).toBe(cible.valeur)
    }
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

describe('recettes — la fenêtre « Mes recettes »', () => {
  const SAISIE_TEST: SaisieRecette = {
    nom: 'Ma composition test unique 7731',
    tempsPrepMin: 10,
    tempsCuissonMin: 0,
    portionsBase: 2,
    difficulte: 1,
    typesRepas: ['diner'],
    envergure: 'quotidien',
    conservationJours: 1,
    axes: AXES_PAR_DEFAUT,
    ingredients: [],
    etapes: ['Mélanger et servir.'],
  }

  it('liste uniquement les recettes perso — une recette du catalogue n’y figure pas', async () => {
    const catalogue = catalogueDeTest()
    const unAliment = [...catalogue.foods.keys()][0]!
    const id = nouvelIdRecette(2, 0.13)
    const saisie: SaisieRecette = {
      ...SAISIE_TEST,
      ingredients: [{ foodId: unAliment, quantiteG: 100, uniteAffichage: '100 g', optionnel: false }],
    }
    saveUserRecipe(baseCourante(), construireRecette(id, saisie, null), '2026-08-01')
    const recetteDuCatalogue = [...catalogue.recipes.values()].find((r) => !r.id.startsWith('perso:'))!

    await monter()
    fireEvent.click(screen.getByRole('button', { name: /Mes recettes/ }))
    const panneau = await screen.findByRole('dialog', { name: 'Mes recettes' })

    expect(within(panneau).getByText(saisie.nom)).toBeDefined()
    expect(within(panneau).getByRole('link', { name: new RegExp(saisie.nom) })).toBeDefined()
    expect(within(panneau).queryByText(new RegExp(recetteDuCatalogue.nom))).toBeNull()
  })

  it('aucune recette perso : le message et le lien vers #/composer, pas une liste vide', async () => {
    await monter()
    fireEvent.click(screen.getByRole('button', { name: /Mes recettes/ }))
    const panneau = await screen.findByRole('dialog', { name: 'Mes recettes' })

    expect(within(panneau).queryByRole('list')).toBeNull()
    expect(within(panneau).getByText(/vous n.avez pas encore composé de recette/i)).toBeDefined()
    const lien = within(panneau).getByRole('link', { name: /Composer/ })
    expect(lien.getAttribute('href')).toBe(hashDeLEditeur(null))
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
