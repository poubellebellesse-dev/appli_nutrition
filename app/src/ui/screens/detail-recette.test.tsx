// @vitest-environment jsdom
//
// ui/screens/detail-recette.test.tsx — la fiche recette, consultée mains occupées en cuisinant.
//
// ⚠️ CE FICHIER VERROUILLE UN DÉFAUT DÉJÀ CORRIGÉ : `basculerMacros` appelait `writeDisplay(db, {
// afficherMacros })` avec un objet PARTIEL. `writeDisplay` fait un `INSERT OR REPLACE` — la ligne
// entière est remplacée, et les quatre autres réglages d'affichage repartaient au DEFAULT du
// schéma. Corrigé en `{ ...readDisplay(db), afficherMacros: suivant }` (voir detail-recette.tsx).
// Le premier test ci-dessous re-régresserait immédiatement si quelqu'un revenait à l'écriture
// partielle.
//
// ⚠️ DÉFAUT NON CORRIGÉ, TROUVÉ EN ÉCRIVANT CE FICHIER (voir le rapport de session) : `vue.catalogue`
// (passé à `energieParPortion` et à `Etape`) est `socle.catalogue` — le catalogue BRUT que rend
// `ui/socle.ts#assembler()`. Les index dérivés (`indexes.recipeNutrients`, calculés par
// `attachDerivedIndexes`) ne sont construits QUE dans la fermeture de `createEngine`, jamais
// réexposés sur ce catalogue-là (voir `data/catalog-loader.ts` lignes 9-15 : « Map vides ici »).
// Résultat vérifié sur les 241 recettes réelles : `energieParPortion` rend TOUJOURS `null`, alors
// que la donnée CIQUAL existe bel et bien (confirmé en calculant `attachDerivedIndexes` à la main :
// 288,6 kcal pour la première recette du catalogue, contre `null` vu par cet écran). Le test qui
// suit verrouille uniquement le comportement d'AFFICHAGE du cas `null` — qui est correct, aucune
// valeur inventée — pas la donnée elle-même.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { RecipeId } from '../../engine/domain/index.js'
import { readDisplay, readFavorites, writeDisplay } from '../../data/user-store.js'
import { AXES_PAR_DEFAUT, saveUserRecipe, type StoredUserRecipe } from '../../data/user-recipe.js'
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

async function monter(recetteId: string) {
  const { DetailRecette } = await import('./detail-recette.js')
  render(<DetailRecette recetteId={recetteId} />)
  await screen.findByRole('heading', { level: 1 })
}

/**
 * Recette de référence : cuisine française (drapeau connu), un ingrédient compté à la pièce
 * (« 4 artichauts », pour la mise à l'échelle), un fond de placard (« sel fin, au goût »), sept
 * ingrédients et cinq étapes — assez de matière pour les tests qui suivent.
 */
function recetteDeReference() {
  const recette = catalogueDeTest().recipes.get('artichauts_vinaigrette' as RecipeId)
  if (recette === undefined) throw new Error('recette de référence absente du catalogue réel')
  return recette
}

describe('detail-recette — la bascule des macros', () => {
  it('⛔ ne remet PAS les autres réglages d’affichage au défaut', async () => {
    // LE DÉFAUT VERROUILLÉ (voir l'en-tête). Un autre réglage est allumé AVANT d'ouvrir la fiche ;
    // s'il retombe à faux après avoir juste basculé les macros, c'est que `writeDisplay` a de
    // nouveau reçu un objet partiel.
    writeDisplay(baseCourante(), { ...readDisplay(baseCourante()), gestesBalayage: true })

    await monter(recetteDeReference().id)
    fireEvent.click(screen.getByText('Valeurs nutritionnelles').closest('button')!)

    await waitFor(() => expect(readDisplay(baseCourante()).afficherMacros).toBe(true))
    expect(readDisplay(baseCourante()).gestesBalayage).toBe(true)
  })

  it('persiste en base : un écran remonté de zéro retrouve l’état, pas seulement React', async () => {
    await monter(recetteDeReference().id)
    fireEvent.click(screen.getByText('Valeurs nutritionnelles').closest('button')!)
    await waitFor(() => expect(readDisplay(baseCourante()).afficherMacros).toBe(true))

    // Démonte tout — aucun état React ne survit à ça — puis remonte un DetailRecette flambant neuf
    // sur la même recette.
    cleanup()
    await monter(recetteDeReference().id)

    const bouton = screen.getByText('Valeurs nutritionnelles').closest('button') as HTMLButtonElement
    expect(bouton.getAttribute('aria-expanded')).toBe('true')
  })

  it('⛔ n’invente AUCUNE valeur : dit que ce n’est pas renseigné plutôt qu’un 0 kcal muet', async () => {
    // Sur le catalogue réel, `energieParPortion` rend `null` pour cette recette (voir l'en-tête du
    // fichier — c'est vrai des 241, à cause d'un défaut de câblage non corrigé ici). Ce test ne
    // porte pas sur CE défaut : il verrouille que le cas `null`, quelle qu'en soit la cause,
    // s'affiche honnêtement plutôt que comme un zéro ou un tiret.
    await monter(recetteDeReference().id)
    fireEvent.click(screen.getByText('Valeurs nutritionnelles').closest('button')!)

    await screen.findByText('Non renseignées pour cette recette.')
    expect(document.body.textContent).not.toMatch(/\d+\s*kcal/)
  })
})

describe('detail-recette — le sélecteur de portions', () => {
  it('double les portions double la quantité NUMÉRIQUE réelle d’un ingrédient à la pièce', async () => {
    const recette = recetteDeReference()
    await monter(recette.id)

    const ligneArtichaut = () =>
      [...document.querySelectorAll('ul li')].find((li) => li.textContent?.includes('Artichaut, cru'))
    // Au chargement, portions == portionsBase (facteur 1) : le libellé d'origine est rendu tel quel.
    expect(ligneArtichaut()?.querySelector('span.tabular-nums')?.textContent).toBe('4 artichauts')

    const boutonPlus = document.querySelector('button[aria-label="Une portion de plus"]') as HTMLButtonElement
    // portionsBase (4) clics : de 4 à 8 portions, soit exactement le double.
    for (let i = 0; i < recette.portionsBase; i++) fireEvent.click(boutonPlus)

    await waitFor(() =>
      expect(ligneArtichaut()?.querySelector('span.tabular-nums')?.textContent).toBe('8 artichauts')
    )
  })

  it('un ingrédient fond de placard ne suit pas l’échelle, et le dit — mais seulement une fois changé', async () => {
    // Voir ui/quantites.ts : le sel ne double pas (personne ne mesure 8 g de sel), et l'écran doit
    // le dire pour ne pas passer pour un bug — mais SEULEMENT quand les portions ont bougé, sinon
    // « au goût » porterait une mention qui ne veut rien dire au chargement.
    const recette = recetteDeReference()
    await monter(recette.id)

    const ligneSel = () => [...document.querySelectorAll('ul li')].find((li) => li.textContent?.includes('Sel fin'))
    expect(ligneSel()?.textContent).toContain('au goût')
    expect(ligneSel()?.textContent ?? '').not.toMatch(/non ajustée/)

    const boutonPlus = document.querySelector('button[aria-label="Une portion de plus"]') as HTMLButtonElement
    fireEvent.click(boutonPlus)

    await waitFor(() => expect(ligneSel()?.textContent).toMatch(/non ajustée/))
    expect(ligneSel()?.textContent).toContain('au goût')
  })
})

describe('detail-recette — les étapes', () => {
  it('sont toutes rendues, dans l’ordre, numérotées', async () => {
    const recette = recetteDeReference()
    await monter(recette.id)

    const lignes = [...document.querySelectorAll('ol li')]
    expect(lignes).toHaveLength(recette.etapes.length)
    lignes.forEach((ligne, index) => {
      expect(ligne.querySelector('span[aria-hidden="true"]')?.textContent).toBe(String(index + 1))
      expect(ligne.textContent).toContain(recette.etapes[index]!.texte)
    })
  })
})

describe('detail-recette — les origines', () => {
  it('affiche la cuisine d’origine d’une recette du catalogue, drapeau ET libellé ensemble', async () => {
    // §« Origines » l'exige : un drapeau seul est illisible sur Windows (pas de glyphe) et muet
    // pour un lecteur d'écran — le libellé texte doit toujours accompagner le drapeau, jamais l'un
    // sans l'autre.
    await monter(recetteDeReference().id)

    const badge = screen.getByText('francaise')
    expect(badge.querySelector('span[aria-hidden="true"]')?.textContent).toBe('🇫🇷')
  })
})

describe('detail-recette — recette introuvable', () => {
  it('un recetteId inconnu explique l’absence plutôt que de planter', async () => {
    // Signet périmé, recette retirée du catalogue : ça arrive facilement, ça ne doit pas être un
    // écran blanc.
    await monter('recette-qui-nexiste-pas')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Recette introuvable')
    expect(screen.getByText(/Voir toutes les recettes/)).toBeDefined()
  })
})

describe('detail-recette — recette personnelle', () => {
  const recettePerso: StoredUserRecipe = {
    schemaVersion: 1,
    id: 'perso:test-fiche',
    source: 'perso',
    baseRecipeId: null,
    nom: 'Ma tarte improvisée aux artichauts',
    tempsPrepMin: 15,
    tempsCuissonMin: 30,
    portionsBase: 4,
    difficulte: 2,
    typesRepas: ['diner'],
    envergure: 'quotidien',
    conservationJours: 2,
    axes: AXES_PAR_DEFAUT,
    ingredients: [{ foodId: 'artichaut', quantiteG: 400, uniteAffichage: '4 artichauts', optionnel: false }],
    etapes: ['Éplucher les artichauts.', 'Cuire vingt minutes à la vapeur.'],
    facettesHeritees: [],
    service: null,
    piquant: null,
  }

  it('s’affiche avec son avertissement « non vérifié », et ne propose PAS d’adapter une adaptation', async () => {
    // Témoin positif d'abord : le lien existe bien sur une recette DU CATALOGUE — sans ça, le
    // vérifier absent plus bas ne prouverait rien (l'élément pourrait n'exister nulle part).
    await monter(recetteDeReference().id)
    expect(screen.getByText('Adapter cette recette à ma façon')).toBeDefined()
    cleanup()

    saveUserRecipe(baseCourante(), recettePerso, '2026-08-01')
    // Comme le fait réellement l'éditeur après un enregistrement (editeur-recette.tsx) : sans
    // reconstruire le catalogue, le `chargerSocle()` mémorisé rendrait toujours l'ancien catalogue,
    // sans la recette qu'on vient d'écrire.
    const { rebatirCatalogue } = await import('../socle.js')
    await rebatirCatalogue()

    await monter(recettePerso.id)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(recettePerso.nom)
    // §4.3 ARCHITECTURE : contenu autonome, hors garanties du catalogue source — toujours affiché
    // non vérifié.
    expect(screen.getByText(/Les apports sont calculés depuis vos ingrédients/)).toBeDefined()
    // Adapter une adaptation empilerait des héritages : l'éditeur cherche sa base dans le catalogue
    // SOURCE, une recette perso n'en a pas à offrir.
    expect(screen.queryByText(/Adapter cette recette/)).toBeNull()
  })
})

describe('detail-recette — le favori', () => {
  it('bascule le favori et l’écrit en base — la chaîne complète, pas juste l’étoile à l’écran', async () => {
    const recette = recetteDeReference()
    await monter(recette.id)

    const bouton = document.querySelector('button[aria-label="Ajouter aux favoris"]') as HTMLButtonElement
    expect(bouton).not.toBeNull()
    fireEvent.click(bouton)

    await waitFor(() => expect(readFavorites(baseCourante()).has(recette.id)).toBe(true))
    expect(document.querySelector('button[aria-label="Retirer des favoris"]')).not.toBeNull()
  })
})
