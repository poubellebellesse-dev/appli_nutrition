// @vitest-environment jsdom
//
// ui/screens/frigo.test.tsx — « Vider le frigo » : garde-manger, raccourcis, recherche, classement.
//
// ⚠️ LE TEST QUI COMPTE LE PLUS ICI EST CELUI DE L'ALLERGÈNE. §5.2 ARCHITECTURE qualifie ce filtre
// de « seul garde-fou CRITIQUE et incontournable » du moteur, et cet écran l'appelle par un chemin
// différent des autres (`searchByPantry`, pas `suggestMeals`) — un chemin séparé peut avoir son
// propre oubli. Le test va jusqu'au bout de la chaîne : ce qui est AFFICHÉ à l'écran ne doit
// contenir aucune recette portant l'allergène déclaré, vérifié contre les ingrédients réels du
// catalogue, jamais contre un libellé.
//
// ⚠️ SECOND POINT NON NÉGOCIABLE : le frigo est VIDE au premier lancement. Rien n'est
// pré-sélectionné, rien n'est écrit en base tant que l'utilisateur n'a rien ajouté.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AllergenId, FoodId, RecipeId } from '../../engine/domain/index.js'
import {
  readPantryDeclareLe,
  readPantryEntries,
  readPantryFoodIds,
  writeAllergies,
  writePantry,
} from '../../data/user-store.js'
import { aujourdhuiIso } from '../socle.js'
import { baseCourante, catalogueDeTest, reinitialiserBase, sessionDeTest } from '../test-socle.js'

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

/** Monte l'écran et attend le titre — donc que la phase `chargement` soit passée. */
// ⚠️ `ProvenanceLancerParcours` IMPORTÉ DYNAMIQUEMENT, PAS EN TÊTE DE FICHIER — voir
// `courses.test.tsx` : `vi.resetModules()` en `beforeEach` figerait sinon un `Context` React
// distinct de celui que `Frigo` utilise réellement dans `<LienTutoriel>`.
async function monter() {
  const { Frigo } = await import('./frigo.js')
  const { ProvenanceLancerParcours } = await import('../lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Frigo />
    </ProvenanceLancerParcours>
  )
  await screen.findByRole('heading', { level: 1, name: /avez-vous sous la main/ })
}

/** Les `<li>` de la liste de résultats — pas ceux de « Chez vous » ni des raccourcis. */
function lignesResultats(): readonly Element[] {
  return [...document.querySelectorAll('ul.mt-3.space-y-3 > li')]
}

/** Le `RecipeId` de chaque résultat affiché, tiré du lien réel de la fiche recette.
 * ⚠️ Le lien porte désormais aussi l'origine du retour contextuel (`?de=frigo`, voir
 * `hashDeRecette`/router.tsx) — retirée ici avant décodage, comme le fait `routeDepuisHash`. */
function recipeIdsAffiches(): readonly RecipeId[] {
  return lignesResultats().map((li) => {
    const href = li.querySelector('h3 a')?.getAttribute('href') ?? ''
    return decodeURIComponent(href.replace('#/recette/', '').split('?')[0] ?? '') as RecipeId
  })
}

/** Le pourcentage de couverture de chaque résultat affiché, dans l'ordre du DOM. */
function pourcentsAffiches(): readonly number[] {
  return [...document.querySelectorAll('[role="img"]')].map((el) => {
    const m = /^(\d+) % du poids du plat$/.exec(el.getAttribute('aria-label') ?? '')
    if (m === null) throw new Error('badge de couverture introuvable dans un résultat affiché')
    return Number(m[1])
  })
}

/** Un garde-manger varié : de quoi obtenir des recettes couvertes à des degrés très différents. */
const PANTRY_RICHE = [
  'farine_ble',
  'oeuf',
  'sel_fin',
  'huile_olive',
  'oignon',
  'ail',
  'creme_fraiche',
  'sucre_blanc',
] as const

function seedPantry(foodIds: readonly string[], declareLe = '2026-08-04'): void {
  writePantry(
    baseCourante(),
    foodIds.map((foodId) => ({ foodId: foodId as FoodId, quantiteApprox: null })),
    declareLe
  )
}

describe('frigo — au premier lancement', () => {
  it('⛔ rien n’est pré-sélectionné, rien n’est écrit en base avant une action', async () => {
    // Exigence produit explicite : un « vider le frigo » déjà rempli au premier lancement
    // ferait croire à l'utilisateur qu'on connaît son contenu sans qu'il ait rien dit.
    await monter()

    expect(screen.queryByText(/^Chez vous/)).toBeNull()
    expect(document.querySelectorAll('button[aria-label^="Retirer "]').length).toBe(0)
    expect(screen.getByText(/Ajoutez au moins un aliment/)).toBeDefined()
    expect(readPantryFoodIds(baseCourante())).toEqual([])
  })
})

describe('frigo — le filtre allergène s’applique aussi ici', () => {
  it('⛔ AUCUNE recette affichée ne contient l’allergène déclaré — vérifié contre le catalogue', async () => {
    // §5.2 ARCHITECTURE. Cet écran appelle `searchByPantry`, un chemin différent de
    // `suggestMeals` : si l'exclusion des allergènes n'y était pas branchée, ce test — et lui
    // seul dans ce fichier — le verrait.
    writeAllergies(baseCourante(), [{ allergenId: 'gluten' as AllergenId, severite: null }])
    seedPantry(PANTRY_RICHE)
    await monter()
    await waitFor(() => expect(lignesResultats().length).toBeGreaterThan(0))

    const catalogue = catalogueDeTest()
    const ids = recipeIdsAffiches()
    expect(ids.length).toBeGreaterThan(0)

    for (const id of ids) {
      const recette = catalogue.recipes.get(id)
      expect(recette).toBeDefined()
      const contientGluten = recette!.ingredients.some((ing) => {
        const food = catalogue.foods.get(ing.foodId)
        return food?.allergenes.some((a) => a.allergenId === ('gluten' as AllergenId)) ?? false
      })
      expect(contientGluten).toBe(false)
    }
  })
})

describe('frigo — ajouter un aliment change ce qui est proposé', () => {
  it('zéro aliment : un état l’explique, aucune recette n’est affichée', async () => {
    await monter()
    expect(screen.getByText(/Ajoutez au moins un aliment/)).toBeDefined()
    expect(lignesResultats().length).toBe(0)
  })

  it('un aliment : la première proposition le contient réellement, vérifié contre le catalogue', async () => {
    await monter()
    fireEvent.change(screen.getByLabelText('Ajouter un aliment'), { target: { value: 'riz' } })
    fireEvent.click(await screen.findByText('Riz blanc, cru'))

    await waitFor(() => expect(lignesResultats().length).toBeGreaterThan(0))

    const catalogue = catalogueDeTest()
    const premiere = catalogue.recipes.get(recipeIdsAffiches()[0]!)
    expect(premiere).toBeDefined()
    expect(premiere!.ingredients.some((i) => i.foodId === ('riz_blanc' as FoodId))).toBe(true)
  })
})

describe('frigo — la persistance', () => {
  it('⛔ le garde-manger survit à un remontage de l’écran', async () => {
    // C'est le sens même d'un garde-manger : disparaître au rechargement en ferait un simple
    // filtre de session, pas un état de la cuisine.
    await monter()
    fireEvent.change(screen.getByLabelText('Ajouter un aliment'), { target: { value: 'riz' } })
    fireEvent.click(await screen.findByText('Riz blanc, cru'))
    await waitFor(() => expect(readPantryFoodIds(baseCourante())).toEqual(['riz_blanc']))

    cleanup()
    await monter()

    expect(screen.getByRole('button', { name: 'Retirer Riz blanc, cru' })).toBeDefined()
    expect(readPantryFoodIds(baseCourante())).toEqual(['riz_blanc'])
  })
})

/**
 * ⚠️ BUG TROUVÉ ET CORRIGÉ LE 2026-08-04, et il vidait la migration v8 de son sens dès le deuxième
 * aliment. `writePantry` réécrit la table ENTIÈRE à chaque geste ; l'écran passait `aujourdhuiIso()`
 * pour toutes les lignes. Ajouter du riz ce matin redatait donc d'aujourd'hui une crème déclarée il
 * y a trois semaines : un geste qui ne la concernait pas la certifiait fraîche, et la question de
 * `confirmer-frigo.tsx` ne se posait plus jamais. Rien n'aurait planté — le champ était déclaré,
 * rempli et lu, il contenait simplement autre chose que ce que son nom dit.
 */
describe('frigo — chaque aliment garde SA date de déclaration', () => {
  it('⛔ AJOUTER UN ALIMENT NE REDATE PAS LES AUTRES', async () => {
    seedPantry(['oeuf'], '2026-07-01')
    await monter()

    fireEvent.change(screen.getByLabelText('Ajouter un aliment'), { target: { value: 'riz' } })
    fireEvent.click(await screen.findByText('Riz blanc, cru'))
    await waitFor(() => expect(readPantryFoodIds(baseCourante())).toEqual(['oeuf', 'riz_blanc']))

    const dates = new Map(readPantryEntries(baseCourante()).map((e) => [e.foodId, e.declareLe]))
    expect(dates.get('oeuf' as FoodId)).toBe('2026-07-01')
    expect(dates.get('riz_blanc' as FoodId)).toBe(aujourdhuiIso())
    // Et la conséquence qui compte : le vieil aliment est toujours questionnable.
    expect(readPantryDeclareLe(baseCourante())).toBe('2026-07-01')
  })

  it('retirer un aliment ne redate pas non plus ceux qui restent', async () => {
    seedPantry(['oeuf', 'riz_blanc'], '2026-07-01')
    await monter()

    fireEvent.click(screen.getByRole('button', { name: 'Retirer Riz blanc, cru' }))
    await waitFor(() => expect(readPantryFoodIds(baseCourante())).toEqual(['oeuf']))

    expect(readPantryEntries(baseCourante())[0]?.declareLe).toBe('2026-07-01')
  })
})

describe('frigo — retirer un aliment', () => {
  it('le retire vraiment, et on peut revenir à zéro aliment', async () => {
    seedPantry(['riz_blanc', 'oeuf'])
    await monter()
    await screen.findByText('Chez vous · 2')

    fireEvent.click(screen.getByRole('button', { name: 'Retirer Riz blanc, cru' }))
    await waitFor(() => expect(readPantryFoodIds(baseCourante())).toEqual(['oeuf']))
    expect(screen.queryByRole('button', { name: 'Retirer Riz blanc, cru' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Retirer Œuf de poule, entier, cru' }))
    await waitFor(() => expect(readPantryFoodIds(baseCourante())).toEqual([]))
    expect(screen.queryByText(/^Chez vous/)).toBeNull()
    expect(screen.getByText(/Ajoutez au moins un aliment/)).toBeDefined()
  })
})

describe('frigo — les raccourcis par famille', () => {
  it('cliquer un raccourci ajoute bien l’aliment attendu', async () => {
    await monter()
    fireEvent.click(screen.getByText('légumes'))
    fireEvent.click(screen.getByText('Oignon, cru'))

    await waitFor(() => expect(readPantryFoodIds(baseCourante())).toEqual(['oignon']))
    expect(screen.getByRole('button', { name: 'Retirer Oignon, cru' })).toBeDefined()
  })
})

describe('frigo — la recherche d’aliment', () => {
  it('trouve un aliment du catalogue réel et ne le propose plus une fois ajouté', async () => {
    await monter()
    const champ = screen.getByLabelText('Ajouter un aliment')

    fireEvent.change(champ, { target: { value: 'riz' } })
    await screen.findByText('Riz blanc, cru')
    expect(screen.getByText('Riz complet, cru')).toBeDefined()

    fireEvent.click(screen.getByText('Riz blanc, cru'))
    await waitFor(() => expect(readPantryFoodIds(baseCourante())).toEqual(['riz_blanc']))

    // Retaper la même recherche : l'aliment déjà dans le garde-manger ne doit pas réapparaître
    // en double dans les propositions — seul le jeton du garde-manger doit encore porter son nom.
    fireEvent.change(champ, { target: { value: 'riz' } })
    await screen.findByText('Riz complet, cru')
    expect(screen.getAllByText('Riz blanc, cru').length).toBe(1)
  })
})

describe('frigo — le classement suit la couverture en masse, pas le compte d’ingrédients', () => {
  // §4.5 / l'en-tête de frigo.tsx : la jauge mesure la masse manquante, pas « x sur y ». Un
  // classement qui reviendrait au compte brut romprait ce contrat sans que rien ne le dise à
  // l'écran — seul le pourcentage, affiché, permet de le vérifier de l'extérieur.
  it('les recettes affichées sont triées par pourcentage de couverture décroissant', async () => {
    seedPantry(PANTRY_RICHE)
    await monter()
    await waitFor(() => expect(lignesResultats().length).toBeGreaterThan(1))

    const pourcents = pourcentsAffiches()
    expect(pourcents.length).toBeGreaterThan(1)
    for (let i = 1; i < pourcents.length; i++) {
      expect(pourcents[i]!).toBeLessThanOrEqual(pourcents[i - 1]!)
    }
    // Pas un hasard d'égalités : le premier couvre nettement plus que le dernier affiché.
    expect(pourcents[0]!).toBeGreaterThan(pourcents[pourcents.length - 1]!)
  })
})

describe('frigo — « Sans rien acheter » restreint vraiment, jamais par défaut', () => {
  it('démarre sur « Tout montrer », et le bascule ne garde que les recettes sans manquant', async () => {
    // §4.5 : le classement par couverture reste la vue par défaut — filtrer rendrait souvent la
    // page vide avec seulement quatre ingrédients déclarés. Avec ce garde-manger précis, une
    // seule recette du catalogue est intégralement couverte : un bascule qui ne filtrerait pas
    // vraiment laisserait les 241 recettes affichées.
    seedPantry(['datte', 'noix', 'sel_fin', 'huile_olive'])
    await monter()
    await waitFor(() => expect(lignesResultats().length).toBeGreaterThan(1))

    expect(screen.getByRole('button', { name: 'Tout montrer' }).getAttribute('aria-pressed')).toBe(
      'true'
    )
    expect(
      screen.getByRole('button', { name: 'Sans rien acheter' }).getAttribute('aria-pressed')
    ).toBe('false')

    fireEvent.click(screen.getByRole('button', { name: 'Sans rien acheter' }))

    await waitFor(() => expect(recipeIdsAffiches()).toEqual(['dattes_noix' as RecipeId]))
  })

  it('le nouveau libellé ne laisse plus place à l’ancien', async () => {
    seedPantry(['datte', 'noix', 'sel_fin', 'huile_olive'])
    await monter()
    await waitFor(() => expect(lignesResultats().length).toBeGreaterThan(1))

    expect(screen.queryByText(/^Réalisables maintenant$/)).toBeNull()
  })
})

describe('frigo — un garde-manger sans rapport ne propose plus rien', () => {
  it('condiments seuls → aucune recette partageant un ingrédient non optionnel n’est proposée', async () => {
    // C'est le retour utilisateur qui a déclenché ce filtre : « ajouter seulement des condiments
    // n'affiche aucune recette [utile] ». Sel, poivre et huile d'olive figurent dans la quasi-
    // totalité du catalogue comme OPTIONNELS ou en quantité dérisoire ; ils ne doivent plus, seuls,
    // faire remonter une recette entière.
    seedPantry(['sel_fin', 'poivre_noir'])
    await monter()

    const catalogue = catalogueDeTest()
    for (const id of recipeIdsAffiches()) {
      const recette = catalogue.recipes.get(id)
      expect(recette).toBeDefined()
      const partage = recette!.ingredients.some(
        (i) => !i.optionnel && (i.foodId === 'sel_fin' || i.foodId === 'poivre_noir')
      )
      expect(partage).toBe(true)
    }
    // Message utile plutôt qu'une liste vide muette, si vraiment plus rien ne correspond.
    if (lignesResultats().length === 0) {
      expect(screen.getByText(/aucune recette ne correspond.*Ajoutez un autre aliment/)).toBeDefined()
    }
  })

  it('garde-manger VIDE : aucun filtrage, l’écran reste peuplé une fois un aliment ajouté', async () => {
    await monter()
    fireEvent.change(screen.getByLabelText('Ajouter un aliment'), { target: { value: 'riz' } })
    fireEvent.click(await screen.findByText('Riz blanc, cru'))

    await waitFor(() => expect(lignesResultats().length).toBeGreaterThan(0))
  })
})
