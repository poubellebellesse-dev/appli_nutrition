// @vitest-environment jsdom
//
// ui/screens/parametres.test.tsx — l'écran qui referme le défaut de sécurité du lot 1.
//
// ⚠️ CE QUI EST EN JEU ICI N'EST PAS DU CONFORT. `writeAllergies` n'était appelé QUE par
// l'onboarding : passé le premier lancement, les allergies étaient IMMUABLES — une case cochée par
// erreur l'était pour toujours, une allergie découverte plus tard n'était pas déclarable. §5.2
// ARCHITECTURE qualifie ce filtre de « seul garde-fou CRITIQUE et incontournable » du moteur.
//
// Le test qui compte va jusqu'au bout de la chaîne : décocher à l'écran doit CHANGER CE QUE LE
// MOTEUR PROPOSE. Vérifier que la case bascule ne prouverait rien.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AllergenId, RecipeId } from '../../engine/domain/index.js'
import { readAllergies, readDisplay, readMealTimes, writeAllergies } from '../../data/user-store.js'
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

async function monter() {
  const { Parametres } = await import('./parametres.js')
  render(<Parametres />)
  await screen.findByRole('heading', { name: 'Paramètres' })
}

const presse = (texte: string): string | null =>
  screen.getByText(texte).closest('button')!.getAttribute('aria-pressed')

/** Les recettes que le moteur propose, à travers un socle reconstruit depuis la base courante. */
async function suggestions(): Promise<readonly RecipeId[]> {
  const { chargerSocle } = await import('../socle.js')
  const socle = await chargerSocle()
  const { readUserState } = await import('../../data/user-store.js')
  const etat = readUserState(socle.db, { windowDays: 21, today: '2026-08-01' })
  return socle.moteur
    .suggestMeals({
      profile: { trancheAge: '30_49', sexe: 'NP', tailleCm: null, poidsKg: null, niveauActivite: 'actif', facteurPortion: 1 },
      constraints: etat.constraints,
      context: {
        date: '2026-08-01',
        creneau: 'diner',
        envie: null,
        tempsDisponibleMin: null,
        requiredFoodIds: [],
        pantryFoodIds: [],
      },
      history: etat.history,
      preferences: etat.preferences,
      favoriteRecipeIds: etat.favoriteRecipeIds,
      activeTopics: etat.activeTopics,
      seed: 1,
      limit: 400,
    })
    .suggestions.map((s) => s.recipeId)
}

describe('parametres — les allergies sont modifiables, et ça compte', () => {
  it('affiche cochées celles qui sont déjà déclarées', async () => {
    writeAllergies(baseCourante(), [{ allergenId: 'gluten' as AllergenId, severite: null }])
    await monter()
    expect(presse('Gluten')).toBe('true')
    expect(presse('Lait')).toBe('false')
  })

  it('écrit IMMÉDIATEMENT, sans bouton « Enregistrer »', async () => {
    // Un formulaire qu'on peut quitter à moitié rempli laisse croire qu'une allergie est déclarée
    // alors que rien n'est parti en base — sur ce filtre, c'est une protection imaginaire.
    await monter()
    expect(screen.queryByText(/Enregistrer/)).toBeNull()

    fireEvent.click(screen.getByText('Gluten'))
    await waitFor(() =>
      expect(readAllergies(baseCourante()).map((a) => a.allergenId)).toEqual(['gluten'])
    )
  })

  it('⛔ DÉCOCHER RETIRE RÉELLEMENT DU FILTRE — la chaîne complète', async () => {
    writeAllergies(baseCourante(), [{ allergenId: 'gluten' as AllergenId, severite: null }])
    const avec = await suggestions()

    await monter()
    fireEvent.click(screen.getByText('Gluten'))
    await waitFor(() => expect(readAllergies(baseCourante())).toEqual([]))

    const sans = await suggestions()
    // Retirer une allergie ne peut qu'ÉLARGIR ce que le moteur propose.
    expect(sans.length).toBeGreaterThan(avec.length)
  })

  it('sait revenir à AUCUNE allergie — « je m’étais trompé » doit être exprimable', async () => {
    writeAllergies(baseCourante(), [{ allergenId: 'arachides' as AllergenId, severite: null }])
    await monter()
    fireEvent.click(screen.getByText('Arachides'))
    await waitFor(() => expect(readAllergies(baseCourante())).toEqual([]))
  })

  it('donne accès aux 14 allergènes réglementaires — aucun caché', async () => {
    await monter()
    fireEvent.click(screen.getByText(/Voir les \d+ allergènes réglementaires/))
    expect(screen.getByText('Sésame')).toBeDefined()
  })
})

describe('parametres — les réglages d’affichage', () => {
  it('⛔ n’efface PAS les autres en changeant un seul', async () => {
    // `writeDisplay` remplace la ligne entière : un champ omis repartirait au défaut du schéma.
    // Le défaut a existé — `detail-recette` écrivait `{ afficherMacros }` seul.
    await monter()
    fireEvent.click(screen.getByText('Afficher les valeurs nutritionnelles détaillées'))
    await waitFor(() => expect(readDisplay(baseCourante()).afficherMacros).toBe(true))

    fireEvent.click(screen.getByText("Changer de plat en balayant l'écran"))
    await waitFor(() => expect(readDisplay(baseCourante()).gestesBalayage).toBe(true))
    expect(readDisplay(baseCourante()).afficherMacros).toBe(true)
  })

  it('part de rien d’activé — chaque réglage est un opt-in', async () => {
    await monter()
    expect(presse("Changer de plat en balayant l'écran")).toBe('false')
    expect(presse('Afficher les valeurs nutritionnelles détaillées')).toBe('false')
  })
})

describe('parametres — les rappels', () => {
  it('DIT que les notifications demandent l’application installée', async () => {
    // Hors conteneur natif, aucune notification programmée n'existe. Plutôt qu'un interrupteur qui
    // ne ferait rien, on explique — une promesse non tenue coûte plus cher qu'une absence.
    await monter()
    await screen.findByText(/demandent l'application installée/)
  })

  it('n’active PAS les rappels quand la permission ne peut pas être accordée', async () => {
    await monter()
    fireEvent.click(screen.getByText('Me prévenir quand il est temps de commencer'))
    await waitFor(() => expect(readDisplay(baseCourante()).rappelsActifs).toBe(false))
  })

  it('enregistre quand même l’heure des repas — elle décrit l’utilisateur, pas la plateforme', async () => {
    await monter()
    const heures = document.querySelectorAll('input[type="time"]')
    expect(heures.length).toBeGreaterThan(0)
    fireEvent.change(heures[heures.length - 1]!, { target: { value: '19:30' } })
    await waitFor(() => expect([...readMealTimes(baseCourante()).values()]).toContain(19 * 60 + 30))
  })
})

describe('parametres — à propos', () => {
  it('énonce les engagements du produit et donne un contact', async () => {
    await monter()
    expect(screen.getByText(/sans publicité, sans compte et sans mesure/)).toBeDefined()
    expect(screen.getByText(/développeur indépendant/)).toBeDefined()
    expect(document.querySelector('a[href^="mailto:"]')).not.toBeNull()
  })
})
