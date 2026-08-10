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
import { baseCourante, catalogueDeTest, reinitialiserBase, sessionDeTest, confianceDeTest} from '../test-socle.js'
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

vi.mock('../catalog-source.js', () => ({
  chargerCatalogue: () => Promise.resolve(catalogueDeTest()),
  chargerConfiance: () => Promise.resolve(confianceDeTest()),
}))
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
// ⚠️ `ProvenanceLancerParcours` IMPORTÉ DYNAMIQUEMENT, PAS EN TÊTE DE FICHIER — voir
// `courses.test.tsx` : `vi.resetModules()` en `beforeEach` figerait sinon un `Context` React
// distinct de celui que `Recettes` utilise réellement dans `<LienTutoriel>`.
async function monter(): Promise<HTMLElement> {
  const { Recettes } = await import('./recettes.js')
  const { ProvenanceLancerParcours } = await import('../lancer-parcours.js')
  const { container } = render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Recettes />
    </ProvenanceLancerParcours>
  )
  // ⛔ NE PAS REMETTRE `findByRole('heading', { name: 'Recettes' })` ICI. MESURÉ le 2026-08-07 sur
  // cet écran monté (2 104 nœuds) : `getByRole` avec un filtre de NOM coûte **480 ms par appel** —
  // il recalcule le nom accessible de chaque élément du document — quand `querySelector('h1')` coûte
  // **0,1 ms**. `findBy*` sonde au moins deux fois, donc ce seul `await` pesait ~960 ms, répété
  // 23 fois dans ce fichier : ~24 s des 29,8 s qu'il mettait.
  //
  // ⚠️ ET C'EST CE CHIFFRE QUI A FAIT CROIRE À UN PROBLÈME DE RENDU. La décision 61 d'`ETAT.md`
  // concluait « le temps de montage EST le rendu des cartes, 3,60 ms par carte ». Le Profiler React
  // dit **83 ms pour 2 commits** sur le même montage, soit 0,27 ms par carte — le plancher de jsdom.
  // Les 3,60 ms mesuraient la croissance de `getByRole` avec la taille du DOM, une propriété du
  // HARNAIS DE TEST qui n'existe pas dans un navigateur.
  //
  // ⚠️ CE HELPER N'ATTEND QU'UNE CHOSE : que la phase `chargement` soit passée. La garantie de cet
  // écran n'est pas portée par cette attente mais par les assertions de chaque test, qui continuent
  // d'interroger la liste RENDUE EN ENTIER (`idsAffiches`). On n'échange donc aucune couverture
  // contre du temps — les requêtes coûteuses restent là où elles vérifient quelque chose.
  await waitFor(() => {
    if (container.querySelector('h1') === null) throw new Error('écran pas encore monté')
  })
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

/** Échappe les métacaractères regex d'une valeur de catalogue avant de la mettre dans un `name`
 *  de requête RTL — les libellés viennent des données, pas d'une liste écrite à la main. */
function regexPourValeur(valeur: string): RegExp {
  return new RegExp(`^${valeur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(`)
}

describe('recettes — axes en pastilles, dans le flux (décision 46)', () => {
  // Décision 46 : un axe à ≤4 valeurs tient entier sur la ligne, sans fenêtre ; un axe plus long
  // garde ses 4 premières en ligne et renvoie le reste derrière « Tout voir ». Dérivé du catalogue
  // réel, jamais d'une liste écrite à la main.
  const cuisines = valeursDeFacette(catalogueDeTest(), 'cuisine' as FacetteKind)
  const regimes = valeursDeFacette(catalogueDeTest(), 'regime' as FacetteKind)
  const services = valeursDeService(catalogueDeTest())

  // ⚠️ LA RÉPARTITION COURT/LONG EST DÉRIVÉE, ELLE NE L'ÉTAIT PAS — corrigé le 2026-08-09.
  // `axesCourts` nommait « Régime » et « Service » EN DUR, dans un bloc dont le commentaire
  // promettait pourtant « dérivé du catalogue réel, jamais d'une liste écrite à la main ». Le lot
  // L4.4 a porté Service de 4 à 5 valeurs : l'axe est devenu long à l'écran, la liste en dur est
  // restée courte, et le test a échoué en désignant l'écran alors que le faux était chez lui.
  const SEUIL_EN_LIGNE = 4
  type Axe = {
    readonly titre: string
    readonly valeurs: readonly { readonly valeur: string; readonly nombre: number }[]
  }
  const axes: readonly Axe[] = [
    { titre: 'Cuisine', valeurs: cuisines },
    { titre: 'Régime', valeurs: regimes },
    { titre: 'Service', valeurs: services },
  ]
  const axesCourts = axes.filter((a) => a.valeurs.length <= SEUIL_EN_LIGNE)
  const axesLongs = axes.filter((a) => a.valeurs.length > SEUIL_EN_LIGNE)

  it('⛔ garde contre un `it.each([])` : le catalogue réel a un axe court et un axe long à comparer', () => {
    expect(axesCourts.length).toBeGreaterThan(0)
    expect(axesLongs.length).toBeGreaterThan(0)
    for (const axe of axesCourts) expect(axe.valeurs.length).toBeGreaterThan(0)
    expect(cuisines.length).toBeGreaterThan(SEUIL_EN_LIGNE)
  })

  it.each(axesCourts)(
    '« $titre » (≤4 valeurs) : tout est déjà à l’écran, aucun « Tout voir », aucun dialogue',
    async ({ titre, valeurs }) => {
      await monter()
      const fieldset = screen.getByText(titre).closest('fieldset') as HTMLElement
      expect(within(fieldset).getAllByRole('button').length).toBe(valeurs.length)
      expect(within(fieldset).queryByRole('button', { name: /^Tout voir/ })).toBeNull()
      expect(screen.queryByRole('dialog', { name: titre })).toBeNull()
    }
  )

  it('« Cuisine » (>4 valeurs) : les 4 premières sont à l’écran, la traîne pas encore — « Tout voir » l’y trouve', async () => {
    await monter()
    const fieldset = screen.getByText('Cuisine').closest('fieldset') as HTMLElement

    for (const v of cuisines.slice(0, 4)) {
      expect(within(fieldset).getByRole('button', { name: regexPourValeur(v.valeur) })).toBeDefined()
    }
    const traine = cuisines[cuisines.length - 1]!
    expect(within(fieldset).queryByRole('button', { name: regexPourValeur(traine.valeur) })).toBeNull()

    // ⚠️ `aria-haspopup="dialog"`, PAS `aria-expanded` : ce bouton ouvre une fenêtre, il ne déplie
    // rien ici.
    const toutVoir = within(fieldset).getByRole('button', {
      name: new RegExp(`^Tout voir \\(${cuisines.length}\\)`),
    })
    expect(toutVoir.getAttribute('aria-haspopup')).toBe('dialog')
    fireEvent.click(toutVoir)

    const panneau = await screen.findByRole('dialog', { name: 'Cuisine' })
    expect(within(panneau).getByRole('button', { name: regexPourValeur(traine.valeur) })).toBeDefined()

    fireEvent.click(within(panneau).getByRole('button', { name: /Retour/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('choisir une valeur de la traîne dans la fenêtre la fait apparaître en ligne ; la retirer d’un tap ne rouvre pas la fenêtre', async () => {
    await monter()
    const fieldset = screen.getByText('Cuisine').closest('fieldset') as HTMLElement
    const traine = cuisines[cuisines.length - 1]!

    fireEvent.click(within(fieldset).getByRole('button', { name: /^Tout voir/ }))
    const panneau = await screen.findByRole('dialog', { name: 'Cuisine' })
    fireEvent.click(within(panneau).getByRole('button', { name: regexPourValeur(traine.valeur) }))
    fireEvent.click(within(panneau).getByRole('button', { name: /Retour/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    const pastilleEnLigne = within(fieldset).getByRole('button', { name: regexPourValeur(traine.valeur) })
    expect(pastilleEnLigne.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(pastilleEnLigne)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(within(fieldset).queryByRole('button', { name: regexPourValeur(traine.valeur) })).toBeNull()
  })

  it('est un portail : ouvrir « Tout voir » n’allonge pas la liste de recettes en dessous', async () => {
    await monter()
    const fieldset = screen.getByText('Cuisine').closest('fieldset') as HTMLElement
    fireEvent.click(within(fieldset).getByRole('button', { name: /^Tout voir/ }))
    const panneau = await screen.findByRole('dialog', { name: 'Cuisine' })

    // Un `fixed` posé dans le flux normal se serait retrouvé sous un ancêtre de la page ; le
    // portail le place en enfant DIRECT de `document.body`, hors de la `<ul>` des recettes.
    expect(panneau.parentElement).toBe(document.body)
    expect(panneau.closest('ul')).toBeNull()
  })

  it('« Fromage » est entré au catalogue : aucune valeur de service ne reste hors d’atteinte', async () => {
    // ⚠️ CE TEST DISAIT L'INVERSE JUSQU'AU 2026-08-09 : « ⛔ Fromage — 0 recette au catalogue —
    // n'apparaît ni en ligne ni dans une fenêtre ». Il verrouillait un VIDE DE CONTENU depuis un
    // fichier d'écran, si bien que le premier lot de recettes à combler le trou l'a fait tomber
    // alors que l'écran était juste. Ce qui se verrouille ici, c'est la DÉRIVATION : autant de
    // pastilles que de valeurs au catalogue, la traîne atteignable derrière « Tout voir ». Le seuil
    // comme le nombre de services peuvent bouger sans rien casser.
    expect(services.find((s) => s.valeur === 'fromage')?.nombre).toBeGreaterThan(0)

    await monter()
    const fieldset = screen.getByText('Service').closest('fieldset') as HTMLElement
    // Une pastille porte `aria-pressed` ; « Tout voir », « Retour » et la fermeture n'en portent
    // pas. C'est le seul discriminant qui ne dépende d'aucun libellé.
    const pastillesDe = (racine: HTMLElement) =>
      within(racine)
        .getAllByRole('button')
        .filter((b) => b.hasAttribute('aria-pressed'))

    const enLigne = pastillesDe(fieldset)
    expect(enLigne.length).toBe(Math.min(services.length, SEUIL_EN_LIGNE))

    const libelles = enLigne.map((b) => b.textContent ?? '')
    if (services.length > SEUIL_EN_LIGNE) {
      fireEvent.click(within(fieldset).getByRole('button', { name: /^Tout voir/ }))
      const panneau = await screen.findByRole('dialog', { name: 'Service' })
      const pastilles = pastillesDe(panneau)
      expect(pastilles.length).toBe(services.length)
      libelles.push(...pastilles.map((b) => b.textContent ?? ''))
    }
    // Le libellé est éditorial (`LIBELLE_SERVICE`), pas le code brut : on ne recopie pas la table
    // ici, on vérifie la seule valeur dont ce lot répond.
    expect(libelles.some((l) => l.startsWith('Fromage'))).toBe(true)
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
})

describe('recettes — filtrer par cuisine réduit vraiment la liste', () => {
  it('une pastille choisie dans la fenêtre Cuisine restreint le résultat, la retirer le restaure', async () => {
    await monter()
    const avant = idsAffiches().length

    const fieldset = screen.getByText('Cuisine').closest('fieldset') as HTMLElement
    fireEvent.click(within(fieldset).getByRole('button', { name: /^Tout voir/ }))
    const panneau = await screen.findByRole('dialog', { name: 'Cuisine' })
    // Un seul fieldset dans ce panneau — voir la note du bloc précédent sur l'ambiguïté du texte.
    const fieldsetPanneau = panneau.querySelector('fieldset') as HTMLElement
    // Au moins une pastille du catalogue réel n'est pas à zéro (241 recettes) — la première suffit.
    const pastille = fieldsetPanneau.querySelector('button:not([disabled])') as HTMLButtonElement
    expect(pastille.getAttribute('aria-pressed')).toBe('false')
    const libelleChoisi = pastille.textContent!

    fireEvent.click(pastille)
    await waitFor(() => expect(pastille.getAttribute('aria-pressed')).toBe('true'))

    fireEvent.click(within(panneau).getByRole('button', { name: /Retour/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    const apres = idsAffiches().length
    expect(apres).toBeGreaterThan(0)
    expect(apres).toBeLessThan(avant)

    // ⚠️ La pastille choisie reste visible EN LIGNE, active — plus besoin de rouvrir la fenêtre
    // pour savoir qu'un filtre est posé.
    const pastilleEnLigne = within(fieldset).getByRole('button', { name: libelleChoisi })
    expect(pastilleEnLigne.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(pastilleEnLigne)
    await waitFor(() => expect(idsAffiches().length).toBe(avant))
  })
})

describe('recettes — filtrer par service (entrée/plat/dessert…)', () => {
  it('choisir « Plat » ne laisse à l’écran que des recettes dont le service est PLAT', async () => {
    await monter()
    const fieldset = screen.getByText('Service').closest('fieldset') as HTMLElement
    fireEvent.click(within(fieldset).getByRole('button', { name: /^Plat \(\d+\)$/ }))

    const catalogue = catalogueDeTest()
    await waitFor(() => expect(idsAffiches().length).toBeGreaterThan(0))
    const ids = idsAffiches()
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

  it('⛔ ANNONCE qu’on peut chercher un ingrédient, pas seulement un plat', async () => {
    // ⚠️ Ce test verrouille une AFFORDANCE, pas une capacité. La recherche indexe le nom des
    // ingrédients depuis toujours (`tests/recherche-catalogue-reel.test.ts`), mais le champ
    // s'intitulait « Rechercher un plat » avec « blanquette, tajine, gratin » en exemple : trois
    // noms de plats. À l'essai du 2026-08-02, un filtre « aliments voulus » a été demandé alors
    // qu'il existait déjà sous cette forme — l'affordance ne taisait pas la capacité, elle la
    // contredisait. Reformuler le libellé sans ce test la recacherait en silence.
    await monter()
    // Par le LIBELLÉ du champ, pas par le mot n'importe où sur l'écran : c'est l'étiquette de la
    // recherche qui doit le dire, et l'association label/champ est vérifiée du même coup.
    const champ = screen.getByLabelText(/chercher.*ingr[ée]dient/i) as HTMLInputElement
    expect(champ.getAttribute('type')).toBe('search')

    // Et la capacité annoncée est bien là : un ingrédient trouve un plat qui ne le nomme pas.
    fireEvent.change(champ, { target: { value: 'poulet' } })
    await waitFor(() => expect(idsAffiches().length).toBeGreaterThan(0))
    const catalogue = catalogueDeTest()
    const sansLeMotDansLeNom = idsAffiches().filter(
      (id) => !(catalogue.recipes.get(id as RecipeId)?.nom ?? '').toLowerCase().includes('poulet')
    )
    expect(sansLeMotDansLeNom.length).toBeGreaterThan(0)
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

/**
 * ⚠️ LE CATALOGUE RÉEL PORTE **8 TARTES, TOUTES AU GLUTEN** (mesuré le 2026-08-10, requête sur
 * `recipe_ingredient` × `food_allergen`). Déclarer l'allergie et chercher « tarte » donne donc
 * 0 résultat et 8 écartées — le cas exact que ce bloc doit expliquer, sans le fabriquer.
 *
 * ⛔ ET LES TESTS QUI PORTENT LE LOT SONT LES TROIS SILENCES : sans recherche, sans contrainte, et
 * sur une recherche qui ne touche aucune écartée, le bloc ne doit RIEN dire. Un écran qui explique
 * en permanence ce qu'il n'affiche pas est un écran qu'on cesse de lire.
 */
describe('recettes — « Pourquoi pas ce plat ? »', () => {
  const chercher = (valeur: string) => {
    const champ = document.querySelector('input[type="search"]') as HTMLInputElement
    fireEvent.change(champ, { target: { value: valeur } })
  }

  it('nomme la recette écartée ET le motif rendu par le moteur', async () => {
    writeAllergies(baseCourante(), [{ allergenId: 'gluten' as AllergenId, severite: null }])
    await monter()
    chercher('tarte')

    await screen.findByText('Tarte au citron')
    // Le motif vient de `RejectionEntry.reason` (`selection/allergenes.ts`), mot pour mot : c'est la
    // couche qui sait pourquoi elle a écarté, pas l'écran.
    expect(screen.getAllByText(/contient l’allergène déclaré|contient l'allergène déclaré/).length).toBeGreaterThan(0)
    // Et elle reste ÉCARTÉE : le bloc explique une absence, il ne réintroduit pas le plat.
    expect(idsAffiches()).not.toContain('tarte_citron')
  })

  it('annonce ce qu’il ne montre pas — 8 écartées, 6 nommées, « et 2 autres »', async () => {
    // ⛔ Une troncature muette se lirait « voilà tout ce qui a été écarté », ce qui serait faux.
    writeAllergies(baseCourante(), [{ allergenId: 'gluten' as AllergenId, severite: null }])
    await monter()
    chercher('tarte')

    await screen.findByText('Tarte au citron')

    // ⚠️ LE NOMBRE VIT DANS SON PROPRE `<span>` (`tabular-nums`, pour que le chiffre ne danse pas
    // d'un rendu à l'autre). `getByText` compare nœud par nœud : il ne rapprochera JAMAIS « et »,
    // « 2 » et « autres. » d'une même regex. On interroge donc le paragraphe entier.
    const compte = screen.getByText(
      (_, element) => element?.tagName === 'P' && /^et\s*2\s*autres\.$/.test(element.textContent ?? '')
    )
    expect(compte).toBeDefined()

    // Et la troncature est bien à 6 : sans ça, « et 2 autres » pourrait rester juste sur un tout
    // autre nombre d'écartées, et le test cesserait de mesurer la coupe.
    const bloc = compte.closest('div') as HTMLElement
    expect(bloc.querySelectorAll('li').length).toBe(6)
  })

  it('⛔ NE DIT RIEN SANS RECHERCHE, même avec 100 recettes écartées', async () => {
    writeAllergies(baseCourante(), [{ allergenId: 'gluten' as AllergenId, severite: null }])
    const conteneur = await monter()
    // L'entonnoir, lui, parle : c'est bien la CONTRAINTE qui écarte, pas l'absence de recherche.
    await waitFor(() => expect(conteneur.textContent).toMatch(/disponibles/))

    expect(screen.queryByText(/Écartée/)).toBeNull()
    expect(screen.queryByText('Tarte au citron')).toBeNull()
  })

  it('⛔ NE DIT RIEN QUAND RIEN N’EST ÉCARTÉ — sans allergie déclarée, les tartes s’affichent', async () => {
    await monter()
    chercher('tarte')

    await waitFor(() => expect(idsAffiches()).toContain('tarte_citron'))
    expect(screen.queryByText(/Écartée/)).toBeNull()
  })

  it('⛔ NE DIT RIEN QUAND LA RECHERCHE NE TOUCHE AUCUNE ÉCARTÉE', async () => {
    writeAllergies(baseCourante(), [{ allergenId: 'gluten' as AllergenId, severite: null }])
    await monter()
    chercher('zzzzznexistepasdutoutducatalogue')

    await screen.findByText(/0 recette — essayez de retirer un filtre\./)
    expect(screen.queryByText(/Écartée/)).toBeNull()
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
      estSauce: false,
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
    estSauce: false,
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

describe('recettes — importer une recette (.nutri-recipe, §8.7)', () => {
  function nutriRecipe(foodId: string, id = 'perso:fichier-externe'): string {
    return JSON.stringify({
      schemaVersion: 1,
      id,
      source: 'perso',
      baseRecipeId: null,
      nom: 'Un plat venu d’ailleurs',
      tempsPrepMin: 10,
      tempsCuissonMin: 20,
      portionsBase: 2,
      difficulte: 1,
      typesRepas: ['diner'],
      envergure: 'quotidien',
      conservationJours: 2,
      axes: AXES_PAR_DEFAUT,
      ingredients: [{ foodId, quantiteG: 200, uniteAffichage: '2 pièces', optionnel: false }],
      etapes: ['Préparer.'],
      facettesHeritees: [],
      service: null,
      piquant: null,
    })
  }

  async function ouvrirMesRecettes(): Promise<HTMLElement> {
    fireEvent.click(screen.getByRole('button', { name: /Mes recettes/ }))
    return screen.findByRole('dialog', { name: 'Mes recettes' })
  }

  function deposer(panneau: HTMLElement, contenu: string): void {
    const champ = within(panneau).getByLabelText(/Importer une recette/) as HTMLInputElement
    const fichier = new File([contenu], 'recette.nutri-recipe', { type: 'application/json' })
    fireEvent.change(champ, { target: { files: [fichier] } })
  }

  it('un fichier valide s’importe, se retrouve listé, sous un id différent de celui du fichier', async () => {
    await monter()
    const catalogue = catalogueDeTest()
    const unAliment = [...catalogue.foods.keys()][0]!
    const panneau = await ouvrirMesRecettes()

    deposer(panneau, nutriRecipe(unAliment))

    await within(panneau).findByText(/a été importée/)
    await within(panneau).findByText('Un plat venu d’ailleurs')

    const lien = within(panneau).getByRole('link', { name: /Un plat venu d’ailleurs/ })
    const idImporte = decodeURIComponent(
      lien.getAttribute('href')!.slice(hashDeRecette('').length)
    )
    expect(idImporte).not.toBe('perso:fichier-externe')
  })

  it('n’écrase pas une recette existante qui porterait le même id que le fichier importé', async () => {
    const catalogue = catalogueDeTest()
    const unAliment = [...catalogue.foods.keys()][0]!
    const existante: SaisieRecette = {
      nom: 'Ma recette déjà là, bien vivante',
      tempsPrepMin: 5,
      tempsCuissonMin: 5,
      portionsBase: 1,
      difficulte: 1,
      typesRepas: ['diner'],
      envergure: 'quotidien',
      conservationJours: 1,
      axes: AXES_PAR_DEFAUT,
      ingredients: [{ foodId: unAliment, quantiteG: 100, uniteAffichage: '100 g', optionnel: false }],
      etapes: ['Servir.'],
      estSauce: false,
    }
    const idExistant = 'perso:fichier-externe'
    saveUserRecipe(baseCourante(), construireRecette(idExistant, existante, null), '2026-08-01')

    await monter()
    const panneau = await ouvrirMesRecettes()
    // Le fichier porte VOLONTAIREMENT l'id de la recette déjà enregistrée.
    deposer(panneau, nutriRecipe(unAliment, idExistant))

    await within(panneau).findByText(/a été importée/)
    expect(within(panneau).getByText('Ma recette déjà là, bien vivante')).toBeDefined()
    expect(within(panneau).getByText('Un plat venu d’ailleurs')).toBeDefined()
  })

  it('un foodId inconnu est refusé, avec son nom dans le message — jamais importé en silence', async () => {
    await monter()
    const panneau = await ouvrirMesRecettes()

    deposer(panneau, nutriRecipe('aliment-totalement-inconnu-9284'))

    const erreur = await within(panneau).findByRole('alert')
    expect(erreur.textContent).toContain('aliment-totalement-inconnu-9284')
    expect(within(panneau).queryByText('Un plat venu d’ailleurs')).toBeNull()
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

describe('recettes — l’axe des sauces', () => {
  // `browseRecipes` retire TOUJOURS les sauces de la liste ordinaire (`recettesHorsSauces`). Sans ce
  // bouton, une sauce ne s'atteint que depuis la fiche d'un plat qui la cite — et celle que personne
  // ne cite, nulle part. Le bouton n'est donc pas un filtre de confort : c'est le seul chemin.
  const boutonSauces = () => screen.getByText(/^Sauces \(\d+\)$/).closest('button') as HTMLButtonElement
  const boutonFavoris = () => screen.getByText(/^Mes favoris \(\d+\)$/).closest('button') as HTMLButtonElement

  it('par défaut aucune sauce n’est listée, et le bouton annonce combien il y en a', async () => {
    await monter()
    expect(idsAffiches()).not.toContain('sauce_poivre')
    // Le compte est DANS le libellé : la liste étant vide par défaut, un bouton sans chiffre ne se
    // distingue pas d'un bouton cassé tant qu'on ne l'a pas pressé.
    expect(boutonSauces().textContent).toBe('Sauces (3)')
    expect(boutonSauces().getAttribute('aria-pressed')).toBe('false')
  })

  it('pressé, il rend les sauces et ELLES SEULES', async () => {
    await monter()
    fireEvent.click(boutonSauces())
    await waitFor(() => expect(idsAffiches()).toContain('sauce_poivre'))
    expect([...idsAffiches()].sort()).toEqual([
      'sauce_poivre',
      'sauce_yaourt_citron_ciboulette',
      'vinaigrette_moutarde',
    ])
  })

  it('« Sauces » et « Mes favoris » s’éteignent l’un l’autre — deux départs ne s’empilent pas', async () => {
    await monter()
    fireEvent.click(boutonSauces())
    await waitFor(() => expect(boutonSauces().getAttribute('aria-pressed')).toBe('true'))

    fireEvent.click(boutonFavoris())
    await waitFor(() => expect(boutonFavoris().getAttribute('aria-pressed')).toBe('true'))
    // ⚠️ C'EST L'ASSERTION DU TEST. Laisser les deux allumés donnerait « mes sauces favorites », un
    // troisième axe que personne n'a demandé et que le moteur, lui, tranche en faveur des favoris :
    // l'écran afficherait alors des plats sous un bouton « Sauces » enfoncé.
    expect(boutonSauces().getAttribute('aria-pressed')).toBe('false')
  })

  it('« Sauces » se retire aussi par sa puce de filtre actif', async () => {
    await monter()
    fireEvent.click(boutonSauces())
    await waitFor(() => expect(idsAffiches()).toContain('sauce_poivre'))

    // La puce doit exister : `aucunFiltreEcran` masque tout le bloc si elle ne compte pas
    // `saucesSeules`, et le seul moyen de revenir aux plats serait de retrouver le bouton.
    const puce = screen.getByText('Sauces').closest('button') as HTMLButtonElement
    fireEvent.click(puce)
    await waitFor(() => expect(idsAffiches()).not.toContain('sauce_poivre'))
    expect(boutonSauces().getAttribute('aria-pressed')).toBe('false')
  })
})
