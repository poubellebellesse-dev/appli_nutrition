// @vitest-environment jsdom
//
// ui/screens/editeur-recette.test.tsx — composer sa propre recette.
//
// ⚠️ CE FICHIER GARDE LA PROMESSE CENTRALE DE LA FONCTIONNALITÉ : aucune valeur nutritionnelle
// n'est saisie, aucun régime n'est demandé. C'est ce qui la rend compatible avec la règle du projet
// (« les valeurs nutritionnelles ne s'écrivent JAMAIS à la main ») — et un champ ajouté par
// inadvertance la romprait sans que rien n'échoue ailleurs.
//
// ⚠️ IL GARDE AUSSI LE DÉFAUT TROUVÉ PAR UNE CAPTURE D'ÉCRAN : un plat dont TOUS les ingrédients
// sont facultatifs passait la validation. Le régime se dérivant des ingrédients indispensables, il
// devenait `omnivore` faute de pouvoir rien affirmer — donc invisible à tout régime déclaré.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readUserRecipes } from '../../data/user-recipe.js'
import { baseCourante, catalogueDeTest, reinitialiserBase, sessionDeTest } from '../test-socle.js'

vi.mock('../catalog-source.js', () => ({
  chargerCatalogue: () => Promise.resolve(catalogueDeTest()),
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

async function monter(baseId: string | null = null) {
  const { EditeurRecette } = await import('./editeur-recette.js')
  render(<EditeurRecette baseId={baseId} />)
  await screen.findByRole('heading', { level: 1 })
}

const champ = (selecteur: string) => document.querySelector(selecteur) as HTMLInputElement
const saisir = (selecteur: string, valeur: string) =>
  fireEvent.change(champ(selecteur), { target: { value: valeur } })
const enregistrer = () => screen.getByText('Enregistrer ma recette').closest('button') as HTMLButtonElement

/** Ajoute le premier aliment proposé pour une recherche donnée. */
async function ajouterIngredient(recherche: string) {
  saisir('input[type="search"]', recherche)
  const proposition = await waitFor(() => {
    const trouve = [...document.querySelectorAll('ul li button')].find((b) => !b.hasAttribute('aria-label'))
    if (trouve === undefined) throw new Error(`aucune proposition pour « ${recherche} »`)
    return trouve
  })
  fireEvent.click(proposition)
}

describe('éditeur — ce qui n’est PAS demandé', () => {
  it('⛔ ne demande AUCUNE valeur nutritionnelle', async () => {
    await monter()
    expect(document.body.textContent).not.toMatch(/calorie|kcal|glucide|protéine|lipide/i)
  })

  it('⛔ ne demande AUCUN régime — il est dérivé des ingrédients', async () => {
    // Le demander laisserait quelqu'un étiqueter « végétarien » un plat au poisson, et cette
    // étiquette pilote un filtre de sécurité.
    await monter()
    expect(document.body.textContent).not.toMatch(/végétarien|végétalien|pescétarien/i)
  })
})

describe('éditeur — validation', () => {
  it('bloque tant qu’il manque le nom ou les ingrédients, et le DIT', async () => {
    await monter()
    expect(enregistrer().disabled).toBe(true)
    expect(screen.getByText('Donnez un nom à votre recette.')).toBeDefined()
    expect(screen.getByText('Ajoutez au moins un ingrédient.')).toBeDefined()
  })

  it('débloque quand tout y est', async () => {
    await monter()
    saisir('input[type="text"]', 'Mon gratin')
    await ajouterIngredient('courgette')
    await waitFor(() => expect(enregistrer().disabled).toBe(false))
  })

  it('⛔ REFUSE un plat dont tous les ingrédients sont facultatifs', async () => {
    // LE DÉFAUT QUE CE TEST GARDE, trouvé sur une capture d'écran. Sans ingrédient indispensable,
    // le régime dérivé devient `omnivore` par défaut de pouvoir affirmer — la recette disparaît
    // alors pour tout régime déclaré, sans un mot.
    await monter()
    saisir('input[type="text"]', 'Mon gratin')
    await ajouterIngredient('courgette')
    await waitFor(() => expect(enregistrer().disabled).toBe(false))

    fireEvent.click(screen.getByText('Facultatif'))
    await waitFor(() => expect(enregistrer().disabled).toBe(true))
    expect(screen.getByText(/Au moins un ingrédient doit être indispensable/)).toBeDefined()
  })
})

describe('éditeur — enregistrement', () => {
  it('écrit la recette en base et la déclare `perso`', async () => {
    await monter()
    saisir('input[type="text"]', 'Mon gratin de courgettes')
    await ajouterIngredient('courgette')
    await waitFor(() => expect(enregistrer().disabled).toBe(false))

    fireEvent.click(enregistrer())
    await screen.findByRole('heading', { name: /C'est enregistré/ })

    const enregistrees = readUserRecipes(baseCourante())
    expect(enregistrees).toHaveLength(1)
    expect(enregistrees[0]?.nom).toBe('Mon gratin de courgettes')
    expect(enregistrees[0]?.source).toBe('perso')
    expect(enregistrees[0]?.baseRecipeId).toBeNull()
  })
})

describe('éditeur — adapter une recette existante', () => {
  /** La première recette du catalogue réel — celle qu'on adaptera. */
  const baseDuCatalogue = () => [...catalogueDeTest().recipes.values()][0]!

  it('reprend le nom, les ingrédients et les étapes de la recette d’origine', async () => {
    const base = baseDuCatalogue()
    await monter(base.id)
    await screen.findByRole('heading', { name: 'Adapter la recette' })
    expect(champ('input[type="text"]').value).toBe(`${base.nom} (ma version)`)
    // Trois champs numériques sont les « repères » (préparation, cuisson, portions) ; le reste
    // correspond aux quantités d'ingrédients repris.
    const quantites = document.querySelectorAll('input[type="number"]').length - 3
    expect(quantites).toBe(base.ingredients.length)
  })

  it('⛔ NE REDEMANDE PAS ce qui s’hérite — axes, conservation, envergure, créneaux', async () => {
    // C'est l'intérêt entier de la variante : on ne demande pas la texture d'un plat qu'on n'a
    // fait que modifier. Une réponse au hasard vaudrait moins que la valeur d'origine.
    await monter(baseDuCatalogue().id)
    await screen.findByRole('heading', { name: 'Adapter la recette' })
    expect(document.body.textContent).not.toContain('Salé ou sucré ?')
    expect(document.body.textContent).not.toContain('Combien de temps se garde-t-il ?')
    expect(document.body.textContent).not.toContain('Quel genre de plat ?')
  })

  it('se déclare `variante` et garde la trace de sa base', async () => {
    const base = baseDuCatalogue()
    await monter(base.id)
    await screen.findByRole('heading', { name: 'Adapter la recette' })
    await waitFor(() => expect(enregistrer().disabled).toBe(false))

    fireEvent.click(enregistrer())
    await screen.findByRole('heading', { name: /C'est enregistré/ })

    const [enregistree] = readUserRecipes(baseCourante())
    expect(enregistree?.source).toBe('variante')
    expect(enregistree?.baseRecipeId).toBe(base.id)
  })

  it('un identifiant de base inconnu ouvre une création vide plutôt que de planter', async () => {
    // Un signet périmé ou une recette retirée du catalogue arrivent facilement.
    await monter('recette-qui-nexiste-pas')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ma recette')
  })
})
