// @vitest-environment jsdom
//
// ui/ingredients-recette.test.tsx — la liste d'ingrédients PARTAGÉE par la fiche et le mode cuisine.
//
// ⚠️ CE FICHIER TESTE LE COMPOSANT, PAS UN ÉCRAN, et c'est délibéré. La règle à verrouiller est une
// DIVERGENCE VOULUE entre deux appelants : la fiche pose un lien vers l'aliment, le mode cuisine
// n'en pose aucun. La vérifier dans les deux tests d'écran la dirait deux fois, à deux endroits qui
// peuvent dériver l'un de l'autre — c'est exactement ce que l'extraction de ce composant a servi à
// éviter (voir son en-tête : trois tables jumelles dont une avait déjà divergé).

import { describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { FoodId, Grams, Recipe } from '../engine/domain/index.js'
import { ListeIngredients } from './ingredients-recette.js'

const INGREDIENTS = [
  { foodId: 'carotte' as FoodId, quantiteG: 120 as Grams, uniteAffichage: '1 carotte', optionnel: false },
  { foodId: 'sel_fin' as FoodId, quantiteG: 2 as Grams, uniteAffichage: 'au goût', optionnel: true },
] as unknown as Recipe['ingredients']

const NOMS: Readonly<Record<string, string>> = { carotte: 'Carotte, crue', sel_fin: 'Sel fin' }

function rendre(lienAliment?: (foodId: string) => string) {
  cleanup()
  return render(
    <ListeIngredients
      ingredients={INGREDIENTS}
      quantites={new Map([['carotte', 120]])}
      facteur={1}
      nomAliment={(id) => NOMS[id] ?? id}
      estQuantiteFigee={(id) => id === 'sel_fin'}
      manquants={null}
      {...(lienAliment === undefined ? {} : { lienAliment })}
    />
  )
}

describe('ui/ingredients-recette — le lien vers la fiche aliment', () => {
  it('pose un lien sur le nom quand l’appelant en fournit un', () => {
    rendre((foodId) => `#/aliment/${foodId}`)
    const lien = screen.getByRole('link', { name: 'Carotte, crue' })
    expect(lien.getAttribute('href')).toBe('#/aliment/carotte')
  })

  // ⛔ LE MODE CUISINE NE PASSE PAS LA PROP, ET CE N'EST PAS UN OUBLI. Un lien plein écran sous un
  // doigt couvert de farine ferait quitter les étapes en cours d'une cuisson déjà lancée.
  it('⛔ ne pose AUCUN lien quand l’appelant n’en fournit pas', () => {
    rendre()
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.getByText('Carotte, crue')).toBeTruthy()
  })

  // Le lien porte le NOM seul : « à acheter » et « quantité au goût » qualifient le contexte, pas
  // l'aliment. Les inclure ferait un lien dont le libellé, lu à voix haute, ne désigne plus sa
  // destination.
  it('n’enferme dans le lien ni la quantité ni les mentions de contexte', () => {
    rendre((foodId) => `#/aliment/${foodId}`)
    expect(screen.getByRole('link', { name: 'Carotte, crue' }).textContent).toBe('Carotte, crue')
  })

  // ⚠️ `estQuantiteFigee` ET NON `estFondDePlacard` — la prop a changé de FAIT, pas seulement de nom.
  // `Food.fondDePlacard` (« on ne le rachète pas chaque semaine ») existe toujours et sert la liste
  // de courses ; `Food.quantiteFigee` (« personne ne mesure 8 g de sel ») sert l'affichage. L'eau les
  // sépare : hors courses, mais sa quantité se met bien à l'échelle. Voir `engine/domain/catalog.ts`.
  it('lie aussi les ingrédients facultatifs et ceux à quantité figée', () => {
    rendre((foodId) => `#/aliment/${foodId}`)
    expect(screen.getByRole('link', { name: 'Sel fin' }).getAttribute('href')).toBe('#/aliment/sel_fin')
  })
})
