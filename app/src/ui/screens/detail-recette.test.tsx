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
// ⚠️ DÉFAUT CORRIGÉ : `socle.ts#assembler()` retournait le catalogue BRUT (`avecRecettesSupplementaires`),
// jamais celui enrichi par `attachDerivedIndexes` — cet enrichissement ne vivait que dans la
// fermeture de `createEngine` (`engine/api/index.ts`). `vue.catalogue` (passé à `energieParPortion`
// et à `Etape`) lisait donc un `indexes.recipeNutrients` toujours vide. Corrigé en exposant le
// catalogue enrichi SUR `Engine` (`moteur.catalogue`) et en le lisant depuis `socle.ts` plutôt que de
// reconstruire le catalogue brut à côté. Le premier test ci-dessous verrouille la valeur RÉELLE
// (288,6 kcal pour `artichauts_vinaigrette`, donnée CIQUAL) ; le second garde le repli honnête
// `null` → « Non renseignées » couvert, pour le cas où le catalogue ne suivrait pas l'énergie du
// tout (`catalogue.nutrients` sans l'entrée `energie` — pas un cas qui se produit sur les 241
// recettes réelles, mais le garde-fou du code doit rester exercé).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { RecipeId } from '../../engine/domain/index.js'
import { readDisplay, readFavorites, writeDisplay } from '../../data/user-store.js'
import { AXES_PAR_DEFAUT, saveUserRecipe, type StoredUserRecipe } from '../../data/user-recipe.js'
import { baseCourante, catalogueDeTest, reinitialiserBase, sessionDeTest } from '../test-socle.js'

/**
 * Catalogue servi par le mock de `catalog-source.js`. `undefined` = le catalogue réel de test
 * (le cas courant) ; un seul test (le repli « Non renseignées ») le remplace pour amputer
 * `nutrients` de l'entrée `energie` — voir ce test pour le pourquoi.
 */
let catalogueActif: import('../../engine/domain/index.js').Catalog | undefined

vi.mock('../catalog-source.js', () => ({ chargerCatalogue: () => Promise.resolve(catalogueActif ?? catalogueDeTest()) }))
vi.mock('../user-source.js', () => ({
  ouvrirUserDb: () => Promise.resolve(sessionDeTest()),
  surErreurDePersistance: () => undefined,
}))

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
  catalogueActif = undefined
})
afterEach(cleanup)

async function monter(recetteId: string) {
  const { DetailRecette } = await import('./detail-recette.js')
  const resultat = render(<DetailRecette recetteId={recetteId} />)
  await screen.findByRole('heading', { level: 1 })
  return resultat
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
  // ⚠️ Depuis la conversion en fenêtre superposée (voir l'en-tête de detail-recette.tsx et de
  // ui/panneau.tsx), la ligne « Valeurs nutritionnelles » n'est plus le bouton qui bascule le
  // réglage : elle OUVRE une fenêtre (`Panneau`), et c'est un bouton À L'INTÉRIEUR de cette fenêtre
  // (« Afficher ces valeurs » / « Masquer ces valeurs ») qui appelle `onBasculer`. Les trois tests
  // ci-dessous ouvrent donc la fenêtre avant d'agir, et ciblent son contenu via
  // `within(screen.getByRole('dialog'))` — un même libellé (« Valeurs nutritionnelles ») existe à
  // la fois dans la ligne d'ouverture ET dans le titre de la fenêtre une fois ouverte.

  it('⛔ ne remet PAS les autres réglages d’affichage au défaut', async () => {
    // LE DÉFAUT VERROUILLÉ (voir l'en-tête). Un autre réglage est allumé AVANT d'ouvrir la fiche ;
    // s'il retombe à faux après avoir juste basculé les macros, c'est que `writeDisplay` a de
    // nouveau reçu un objet partiel.
    writeDisplay(baseCourante(), { ...readDisplay(baseCourante()), gestesBalayage: true })

    await monter(recetteDeReference().id)
    fireEvent.click(screen.getByText('Valeurs nutritionnelles').closest('button')!)
    const dialogue = screen.getByRole('dialog')
    fireEvent.click(within(dialogue).getByText(/Afficher ces valeurs/))

    await waitFor(() => expect(readDisplay(baseCourante()).afficherMacros).toBe(true))
    expect(readDisplay(baseCourante()).gestesBalayage).toBe(true)
  })

  it('persiste en base : un écran remonté de zéro retrouve l’état, pas seulement React', async () => {
    await monter(recetteDeReference().id)
    fireEvent.click(screen.getByText('Valeurs nutritionnelles').closest('button')!)
    fireEvent.click(within(screen.getByRole('dialog')).getByText(/Afficher ces valeurs/))
    await waitFor(() => expect(readDisplay(baseCourante()).afficherMacros).toBe(true))

    // Démonte tout — aucun état React ne survit à ça, et la fenêtre elle-même repart fermée —
    // puis remonte un DetailRecette flambant neuf sur la même recette.
    cleanup()
    await monter(recetteDeReference().id)

    // La ligne d'ouverture affiche la valeur COURANTE (voir ui/panneau.tsx#LigneOuvrante) : si le
    // réglage relu en base est bien à `true`, elle ne dit plus « Non affichées » mais reflète la
    // donnée réelle — ici 289 kcal par portion pour `artichauts_vinaigrette` — directement sur la
    // ligne, sans même rouvrir la fenêtre.
    expect(screen.queryByText('Non affichées')).toBeNull()
    await screen.findByText('289 kcal par portion')
  })

  it('affiche l’énergie RÉELLE de la recette, calculée depuis CIQUAL', async () => {
    // Verrouille le correctif (voir l'en-tête) : 288,6 kcal pour `artichauts_vinaigrette`, vérifiés
    // à la main via `attachDerivedIndexes`. Un retour au catalogue brut (`socle.catalogue` non
    // enrichi) ferait retomber cette assertion à `null`.
    await monter(recetteDeReference().id)
    fireEvent.click(screen.getByText('Valeurs nutritionnelles').closest('button')!)
    const dialogue = screen.getByRole('dialog')
    fireEvent.click(within(dialogue).getByText(/Afficher ces valeurs/))

    // Le texte est fractionné en trois nœuds (« Cette portion : », `<span>289</span>`, « kcal »,
    // voir detail-recette.tsx) : `getByText` sur la chaîne exacte ne matcherait aucun nœud unique.
    await waitFor(() => expect(dialogue.textContent).toContain('Cette portion : 289 kcal'))
    expect(within(dialogue).queryByText('Non renseignées pour cette recette.')).toBeNull()
  })

  it('⛔ n’invente AUCUNE valeur : dit que ce n’est pas renseigné plutôt qu’un 0 kcal muet', async () => {
    // Le repli `null` ne se produit plus pour aucune des 241 recettes réelles (voir le test
    // précédent) : `energieParPortion` ne rend `null` que si `catalogue.nutrients` ne suit PAS
    // l'énergie du tout (`findIndex(...) < 0`, voir detail-recette.tsx). On force ce cas ici via
    // `catalogueActif` (voir l'en-tête du fichier) — un catalogue identique au catalogue réel mais
    // amputé de l'entrée `energie` — remis à `undefined` par `beforeEach` pour les autres tests.
    catalogueActif = {
      ...catalogueDeTest(),
      nutrients: catalogueDeTest().nutrients.filter((n) => n.code !== 'energie'),
    }

    await monter(recetteDeReference().id)
    fireEvent.click(screen.getByText('Valeurs nutritionnelles').closest('button')!)
    const dialogue = screen.getByRole('dialog')
    fireEvent.click(within(dialogue).getByText(/Afficher ces valeurs/))

    await within(dialogue).findByText('Non renseignées pour cette recette.')
    expect(document.body.textContent).not.toMatch(/\d+\s*kcal/)
  })

  it('la fenêtre est un vrai portail : l’ouvrir n’allonge pas la fiche en dessous', async () => {
    // ⚠️ C'EST LA RAISON D'ÊTRE DE `Panneau` (voir son en-tête) : un dépliant inline aurait fait
    // grandir `container` — l'arbre DOM de la fiche elle-même — pour y loger son contenu. Un
    // portail vers `document.body` ne touche pas à cet arbre : la fenêtre est un ENFANT DIRECT de
    // `document.body`, pas de la fiche.
    const { container } = await monter(recetteDeReference().id)
    const nombreNoeudsAvant = container.querySelectorAll('*').length

    fireEvent.click(screen.getByText('Valeurs nutritionnelles').closest('button')!)
    const dialogue = screen.getByRole('dialog')

    expect(dialogue.getAttribute('aria-modal')).toBe('true')
    expect(dialogue.parentElement).toBe(document.body)
    expect(container.contains(dialogue)).toBe(false)
    expect(container.querySelectorAll('*').length).toBe(nombreNoeudsAvant)
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
