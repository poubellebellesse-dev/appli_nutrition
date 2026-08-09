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
import { readDisplay, readFavorites, readSaucesChoisies, writeDisplay } from '../../data/user-store.js'
import { AXES_PAR_DEFAUT, saveUserRecipe, type StoredUserRecipe } from '../../data/user-recipe.js'
import type { OrigineRecette } from '../router.js'
import { baseCourante, catalogueDeTest, reinitialiserBase, sessionDeTest, confianceDeTest} from '../test-socle.js'
import { preparerTexteEtape } from '../ingredients-recette.js'
import { formesDeLAliment } from '../texte-etape.js'

/**
 * Catalogue servi par le mock de `catalog-source.js`. `undefined` = le catalogue réel de test
 * (le cas courant) ; un seul test (le repli « Non renseignées ») le remplace pour amputer
 * `nutrients` de l'entrée `energie` — voir ce test pour le pourquoi.
 */
let catalogueActif: import('../../engine/domain/index.js').Catalog | undefined

vi.mock('../catalog-source.js', () => ({
  chargerCatalogue: () => Promise.resolve(catalogueActif ?? catalogueDeTest()),
  chargerConfiance: () => Promise.resolve(confianceDeTest()),
}))
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

async function monter(recetteId: string, origine: OrigineRecette = 'recettes') {
  const { DetailRecette } = await import('./detail-recette.js')
  const resultat = render(<DetailRecette recetteId={recetteId} origine={origine} />)
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

  // ⛔ SANS CE PASSAGE DE RELAIS, régler 6 portions puis appuyer sur « Cuisiner pas à pas » rouvrait
  // le plat à 4 : l'état React de cette fiche meurt au démontage, et un hash ne transporte qu'un
  // identifiant. Le mode cuisine les recopie ensuite dans sa session (v11).
  it('⛔ les portions réglées ici VOYAGENT vers le mode cuisine', async () => {
    const recette = recetteDeReference()
    await monter(recette.id)

    const lien = () =>
      [...document.querySelectorAll('a')].find((a) => a.textContent === 'Cuisiner pas à pas')
    expect(lien()?.getAttribute('href')).toContain(`portions=${recette.portionsBase}`)

    const boutonPlus = document.querySelector('button[aria-label="Une portion de plus"]') as HTMLButtonElement
    fireEvent.click(boutonPlus)

    await waitFor(() =>
      expect(lien()?.getAttribute('href')).toContain(`portions=${recette.portionsBase + 1}`)
    )
  })
})

describe('detail-recette — les étapes', () => {
  it('sont toutes rendues, dans l’ordre, numérotées', async () => {
    const recette = recetteDeReference()
    await monter(recette.id)

    // La référence ne porte que des gestes ; le filtre le dit plutôt que d'en dépendre en silence.
    const gestes = recette.etapes.filter((e) => e.nature === 'geste')
    const lignes = [...document.querySelectorAll('ol li')]
    expect(lignes).toHaveLength(gestes.length)

    // ⚠️ ON N'ATTEND PLUS LE TEXTE DU YAML TEL QUEL, et c'est le seul changement de ce test. Depuis
    // `ui/texte-etape.ts`, la quantité est posée DANS la phrase au rendu : « Délayer la moutarde »
    // s'affiche « Délayer 1 cuillère à soupe de moutarde ». Comparer au YAML mesurerait le
    // catalogue, pas l'écran. Ce qu'on vérifie ici reste le même : une ligne par geste, dans
    // l'ordre, numérotée, et TOUS les segments rendus — un segment oublié ferait échouer l'égalité.
    const catalogue = catalogueDeTest()
    const rendu = (etape: (typeof gestes)[number]): string =>
      preparerTexteEtape({
        texte: etape.texte,
        ingredients: recette.ingredients,
        foodIds: etape.foodIds,
        // Facteur 1 : `quantiteAffichee` rend le libellé d'origine, les grammes ne servent pas.
        quantites: new Map(),
        facteur: 1,
        formesAliment: (foodId) => formesDeLAliment(catalogue.foods.get(foodId as never), foodId),
        estQuantiteFigee: (foodId) =>
          catalogue.foods.get(foodId as never)?.quantiteFigee === true,
      })
        .segments.map((s) => s.contenu)
        .join('')

    lignes.forEach((ligne, index) => {
      expect(ligne.querySelector('span[aria-hidden="true"]')?.textContent).toBe(String(index + 1))
      expect(ligne.textContent).toContain(rendu(gestes[index]!))
    })
  })

  // ⚠️ LE COMPTEUR NE DOIT PAS PROMETTRE UNE ACTION DE PLUS. La chakchouka porte six lignes dans
  // `etapes`, dont la dernière est la mention ANSES : elle s'affichait numérotée « 6 », après que
  // le plat est servi. Ce test verrouille le §3 de docs/CONCEPTION_MODE_CUISINE.md — la mention
  // reste visible, mais hors de la liste numérotée.
  it('n’intègre PAS l’avertissement sanitaire à la liste numérotée, tout en l’affichant', async () => {
    const chakchouka = catalogueDeTest().recipes.get('chakchouka' as RecipeId)
    if (chakchouka === undefined) throw new Error('chakchouka absente du catalogue réel')
    const avertissement = chakchouka.etapes.find((e) => e.nature === 'avertissement')
    expect(avertissement).toBeDefined()

    await monter(chakchouka.id)

    const lignes = [...document.querySelectorAll('ol li')]
    expect(lignes).toHaveLength(chakchouka.etapes.length - 1)
    expect(lignes.map((l) => l.textContent)).not.toContainEqual(
      expect.stringContaining(avertissement!.texte)
    )

    // Affiché quand même, et hors de tout <ol> : une mention à lire, pas une chose à faire.
    const bloc = screen.getByText(avertissement!.texte)
    expect(bloc.closest('ol')).toBeNull()
  })

  // ⚠️ CE TEST N'EXISTAIT PAS AVANT L1ter, ET C'EST CE QUI L'A RENDU NÉCESSAIRE. Le dépliant des
  // gestes est parti dans `ui/gestes-etape.tsx` pour être partagé avec le mode cuisine ; rien ici ne
  // couvrait la fiche, donc rien n'aurait signalé une extraction qui la casse. Il vérifie aussi que
  // le geste reste DANS son étape (`li`) : hors d'elle, on perdrait ce qu'on est en train de lire.
  it('déplie un geste du lexique SUR PLACE, dans l’étape qui le cite', async () => {
    await monter('chakchouka' as RecipeId)
    const definition = /en tranches ou en lamelles fines/

    expect(screen.queryByText(definition)).toBeNull()
    const bouton = screen.getByRole('button', { name: 'Émincer' })
    expect(bouton.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(bouton)

    const texte = screen.getByText(definition)
    expect(texte.closest('li')).toBe(bouton.closest('li'))
    expect(bouton.getAttribute('aria-expanded')).toBe('true')
  })
})

// ⚠️ LES TROIS TESTS CI-DESSOUS GARDENT LE PIÈGE MAISON « un champ déclaré n'est pas un champ
// branché », déjà payé trois fois. `recipe_step_ingredient` était REMPLI au build (93,9 % des
// gestes) et LU par le loader depuis `5b63e5f`, mais cette fiche ne l'affichait pas : seul le mode
// cuisine le faisait. Rien n'était rouge — un écran qui n'affiche pas une donnée qu'il possède ne
// casse aucun type et ne fait échouer aucun test.
//
// ⛔ LE TROISIÈME EST LE SEUL QUI PROUVE QUELQUE CHOSE. Les deux premiers passeraient encore si la
// ligne affichait la quantité BRUTE du YAML au lieu de celle mise à l'échelle : c'est exactement la
// forme qu'aurait le défaut, et elle est invisible tant qu'on lit la recette à ses portions de base.
describe('detail-recette — la quantité sous chaque étape', () => {
  it('affiche la quantité de l’ingrédient que l’étape emploie, sous la phrase', async () => {
    const recette = recetteDeReference()
    await monter(recette.id)

    // §1 « Casser la queue des artichauts » — `artichaut` est dérivé du texte, pas déclaré.
    const etape1 = document.querySelectorAll('ol li')[0]!
    expect(etape1.textContent).toContain('4 artichauts')
    // ⚠️ LA QUANTITÉ EST DANS LA PHRASE, PLUS EN BADGE SOUS ELLE, et le nom CIQUAL a disparu avec
    // le badge : la phrase garde le mot de la recette. « la queue DES artichauts » ne pouvait pas
    // devenir « la queue 4 artichauts » — le déterminant reste et s'accorde (`ui/texte-etape.ts`).
    expect(etape1.textContent).toContain('la queue des 4 artichauts')
    expect(etape1.textContent).not.toContain('Artichaut, cru')
  })

  // ⚠️ CETTE LIGNE AJOUTE, ELLE NE FILTRE JAMAIS — la seule objection qui tenait contre la
  // décision 60. Une étape sans ingrédient ne doit pas rendre une ligne vide : elle ne rend rien.
  it('⛔ ne rend RIEN sur une étape qui n’emploie aucun ingrédient', async () => {
    const recette = recetteDeReference()
    await monter(recette.id)

    // §3 « Cuire jusqu'à ce qu'une feuille de la base se détache » — aucun ingrédient nommé.
    const etape3 = document.querySelectorAll('ol li')[2]!
    expect(etape3.textContent).toContain('une feuille de la base se détache')
    expect(etape3.querySelector('span.tabular-nums')).toBeNull()
  })

  it('⛔ suit les portions : doubler les portions double la quantité SOUS L’ÉTAPE, pas seulement dans la liste', async () => {
    const recette = recetteDeReference()
    await monter(recette.id)

    // ⚠️ `.tabular-nums` SANS `span` : la quantité est passée du badge (`<span>`) à la phrase
    // (`<strong>`). Le sélecteur porte sur la classe, qui est le vrai marqueur d'un nombre à
    // l'écran, et non sur la balise — le test survit à la prochaine bascule.
    const quantiteSousEtape1 = () =>
      document.querySelectorAll('ol li')[0]!.querySelector('.tabular-nums')?.textContent
    expect(quantiteSousEtape1()).toBe('4 artichauts')

    const boutonPlus = document.querySelector('button[aria-label="Une portion de plus"]') as HTMLButtonElement
    for (let i = 0; i < recette.portionsBase; i++) fireEvent.click(boutonPlus)

    await waitFor(() => expect(quantiteSousEtape1()).toBe('8 artichauts'))
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

  // Les 241 recettes réelles sont toutes `maison` (voir l'en-tête du fichier) : sans ces deux tests,
  // une faute de frappe dans l'un des deux libellés `domaine_public` / `libre` (detail-recette.tsx
  // #mentionOrigine) ne serait détectée par rien. Même mécanique que le repli « énergie absente » —
  // `catalogueActif` remplace la recette de référence par une copie à l'origine forcée.
  it.each([
    { origine: 'domaine_public' as const, libelle: "Recette adaptée d'un ouvrage du domaine public." },
    { origine: 'libre' as const, libelle: "Recette adaptée d'une source libre." },
  ])('affiche le libellé d’origine « $origine »', async ({ origine, libelle }) => {
    const reference = recetteDeReference()
    catalogueActif = {
      ...catalogueDeTest(),
      recipes: new Map(catalogueDeTest().recipes).set(reference.id, { ...reference, origine }),
    }

    await monter(reference.id)

    expect(screen.getByText(libelle)).toBeTruthy()
  })
})

describe('detail-recette — les sources', () => {
  // Recette du lot pilote : deux références sanitaires ouvertes et vérifiées le 2026-08-02, et une
  // étape de cuisson corrigée en conséquence (docs/SOURCES_RECETTES.md).
  const RECETTE_SOURCEE = 'poulet_roti_citron_thym' as RecipeId

  it('liste les références consultées, en liens cliquables, avec leur date de lecture', async () => {
    const recette = catalogueDeTest().recipes.get(RECETTE_SOURCEE)
    if (recette === undefined) throw new Error('recette sourcée absente du catalogue réel')
    expect(recette.sources.length).toBeGreaterThan(0)

    await monter(RECETTE_SOURCEE)

    const titres = recette.sources.map((s) => s.titre)
    for (const titre of titres) {
      const lien = screen.getByText(titre)
      expect(lien.getAttribute('href')).toMatch(/^https?:\/\//)
    }
    expect(screen.getAllByText(/lu le 2026-08-02/).length).toBe(titres.length)
  })

  it('⛔ n’écrit JAMAIS « d’après » sur une simple référence — ce serait lui prêter une origine', async () => {
    // La distinction provenance/référence n'existe que pour ça. Une recette écrite pour ce projet
    // qui afficherait « D'après le guide du ministère » revendiquerait une origine qu'elle n'a pas,
    // et la source consultée dirait le contraire de ce qu'on lui fait dire.
    await monter(RECETTE_SOURCEE)

    expect(screen.queryByText(/D'après/)).toBeNull()
    expect(screen.getByText(/Consulté pour vérifier cette recette/)).toBeTruthy()
  })

  it('dit qu’une recette sans source n’a pas été testée, plutôt que de se taire', async () => {
    // Le silence laisserait SUPPOSER une provenance sourcée que le catalogue n'a pas.
    await monter(recetteDeReference().id)
    expect(screen.getByText('Recette écrite pour cette application, non encore testée.')).toBeTruthy()
  })

  it('⛔ affiche QUAND MÊME sa mention d’origine sur une recette qui porte des sources « reference » — c’est exactement le défaut corrigé', async () => {
    // Avant correctif : la mention ne s'affichait QUE si `sources.length === 0`, donc les recettes
    // du lot pilote (confrontées à une référence sanitaire, jamais « d'après ») n'affichaient plus
    // aucune origine — on aurait pu croire qu'elles venaient d'ailleurs. `origine` répare ça : la
    // mention s'affiche TOUJOURS, indépendamment des sources.
    const recette = catalogueDeTest().recipes.get(RECETTE_SOURCEE)
    if (recette === undefined) throw new Error('recette sourcée absente du catalogue réel')
    expect(recette.sources.length).toBeGreaterThan(0)

    await monter(RECETTE_SOURCEE)
    expect(screen.getByText('Recette écrite pour cette application, non encore testée.')).toBeTruthy()
  })
})

describe('detail-recette — le retour contextuel', () => {
  it('depuis Aujourd’hui : ramène sur Aujourd’hui, libellé et hash cohérents', async () => {
    await monter(recetteDeReference().id, 'aujourdhui')
    // Regex obligatoire : `queryByText('Aujourd'hui')` rend `null` si le libellé réel est
    // « ← Aujourd'hui » (préfixe), l'assertion passerait pour la mauvaise raison.
    const lien = screen.getByText(/Aujourd.hui/).closest('a') as HTMLAnchorElement
    expect(lien.getAttribute('href')).toBe('#/')
  })

  it('depuis Recettes : ramène sur Recettes', async () => {
    await monter(recetteDeReference().id, 'recettes')
    const lien = screen.getByText(/Toutes les recettes/).closest('a') as HTMLAnchorElement
    expect(lien.getAttribute('href')).toBe('#/recettes')
  })

  it('depuis la Semaine : ramène sur la Semaine', async () => {
    await monter(recetteDeReference().id, 'semaine')
    const lien = screen.getByText(/Cette semaine/).closest('a') as HTMLAnchorElement
    expect(lien.getAttribute('href')).toBe('#/semaine')
  })

  it('depuis le Frigo : ramène sur le Frigo', async () => {
    await monter(recetteDeReference().id, 'frigo')
    const lien = screen.getByText(/Vider le frigo/).closest('a') as HTMLAnchorElement
    expect(lien.getAttribute('href')).toBe('#/frigo')
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

  it('propose « Modifier ma recette » vers l’éditeur, sur son propre id', async () => {
    saveUserRecipe(baseCourante(), recettePerso, '2026-08-01')
    const { rebatirCatalogue } = await import('../socle.js')
    await rebatirCatalogue()

    await monter(recettePerso.id)
    const lien = screen.getByText('Modifier ma recette').closest('a') as HTMLAnchorElement
    expect(lien.getAttribute('href')).toBe(`#/composer/${encodeURIComponent(recettePerso.id)}`)
  })
})

describe('detail-recette — recette importée (§8.7)', () => {
  it('affiche « Recette importée », pas « Votre recette », et garde l’avertissement non vérifié', async () => {
    const recetteImportee: StoredUserRecipe = {
      schemaVersion: 1,
      id: 'perso:test-fiche-importee',
      source: 'importe',
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
      ingredients: [{ foodId: 'artichaut', quantiteG: 200, uniteAffichage: '2 artichauts', optionnel: false }],
      etapes: ['Préparer.'],
      facettesHeritees: [],
      service: null,
      piquant: null,
    }
    saveUserRecipe(baseCourante(), recetteImportee, '2026-08-02')
    const { rebatirCatalogue } = await import('../socle.js')
    await rebatirCatalogue()

    await monter(recetteImportee.id)
    expect(screen.getByText(/Recette importée/)).toBeDefined()
    // Assertion d'absence en regex ancrée — un `getByText` exact aurait laissé passer un fragment.
    expect(screen.queryByText(/^Votre recette\./)).toBeNull()
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

describe('detail-recette — l’ingrédient ouvre la fiche de l’aliment (décision 33)', () => {
  // ⚠️ CE TEST GARDE UN CHAMP BRANCHÉ, PAS UN CHAMP DÉCLARÉ. `ListeIngredients.lienAliment` est
  // OPTIONNELLE : l'omettre ne produit aucune erreur — ni au type, ni au test, ni à l'écran. C'est
  // le défaut signature de ce projet, quatre occurrences déjà payées. Sans cette assertion sur
  // l'ÉCRAN RÉEL, la prop pourrait exister et n'être jamais passée.
  it('pose un lien vers l’aliment sur le nom de chaque ingrédient', async () => {
    const recette = recetteDeReference()
    await monter(recette.id)
    const premier = recette.ingredients[0]
    expect(premier).toBeDefined()
    const lien = document.querySelector(
      `a[href^="#/aliment/${encodeURIComponent(premier?.foodId ?? '')}"]`
    )
    expect(lien).not.toBeNull()
  })

  // Le retour porte le hash COMPLET de la fiche, origine comprise : sans lui, revenir de l'aliment
  // ramènerait à la liste des recettes, et le « ← » de la fiche aurait perdu sa provenance.
  it('emporte l’origine dans le retour, pour que l’aller-retour reste cohérent', async () => {
    const recette = recetteDeReference()
    await monter(recette.id, 'semaine')
    const lien = document.querySelector('a[href^="#/aliment/"]') as HTMLAnchorElement | null
    expect(lien).not.toBeNull()
    const retour = new URLSearchParams((lien?.getAttribute('href') ?? '').split('?')[1]).get('de')
    expect(retour).toBe(`#/recette/${encodeURIComponent(recette.id)}?de=semaine`)
  })
})

/**
 * ⚠️ CES TESTS N'EXISTAIENT PAS, ET LEUR ABSENCE A COÛTÉ UN LOT. Le composant `SaucesAAjouter` a été
 * écrit le 2026-08-08, `lireLesSauces` interrogeait le moteur à chaque ouverture de fiche — et
 * `<SaucesAAjouter` n'apparaissait nulle part dans le JSX. Un mois de code mort que ni le typecheck,
 * ni la suite, ni l'écran n'ont signalé, pendant que `ETAT.md` annonçait le défaut « corrigé, et
 * verrouillé par un `describe` » qui, lui non plus, n'existait pas.
 *
 * ⚠️ ILS VISENT DONC L'ÉCRAN MONTÉ, jamais le composant isolé. Rendre `<SaucesAAjouter>` à la main
 * dans un test aurait été vert du premier jour sans rien prouver : ce qui manquait n'était pas le
 * composant, c'était son appel. C'est la cinquième occurrence du piège « un champ déclaré n'est pas
 * un champ branché » (CLAUDE.md), la première sur un composant entier.
 *
 * Recettes réelles du catalogue, choisies pour ce qu'elles portent :
 *   `poulet_roti_carottes`    — éligible, UNE sauce attachée (`recipe_sauce` → `sauce_poivre`) ;
 *   `artichauts_vinaigrette`  — `porte_deja_une_sauce: true`, donc aucune proposition.
 */
describe('detail-recette — les sauces à ajouter', () => {
  const PLAT_SAUCABLE = 'poulet_roti_carottes'

  it('rend la section sur la fiche montée — pas seulement le composant, son APPEL', async () => {
    await monter(PLAT_SAUCABLE)
    // Une seule sauce attachée au catalogue : la ligne repliée dit ce qu'elle propose, sans avoir
    // à ouvrir la fenêtre. C'est le seul endroit visible sans geste.
    expect(screen.getByText('Ajouter une sauce')).toBeDefined()
    expect(screen.getByText('1 proposée avec ce plat')).toBeDefined()
  })

  it('sépare « Avec ce plat » des autres, et chaque sauce garde son lien de fiche', async () => {
    await monter(PLAT_SAUCABLE)
    fireEvent.click(screen.getByText('Ajouter une sauce').closest('button')!)

    // `Panneau` passe par un portail : `container.querySelector` ne le voit pas, il faut partir de
    // `screen` puis se restreindre au dialogue (piège documenté, CLAUDE.md).
    const dialogue = await screen.findByRole('dialog')
    expect(within(dialogue).getByText('Avec ce plat')).toBeDefined()
    expect(within(dialogue).getByText('Sauce au poivre')).toBeDefined()
    expect(within(dialogue).getByText('Autres sauces')).toBeDefined()
    expect(within(dialogue).getByText('Vinaigrette à la moutarde')).toBeDefined()

    // ⚠️ `?de=` ABSENT, ET C'EST LA VALEUR JUSTE : `hashDeRecette` omet le paramètre quand l'origine
    // est `recettes`, qui est déjà le défaut du routeur. Le « ← » de la fiche de la sauce dira donc
    // « Toutes les recettes », pas « retour au poulet ». Choix de l'existant, laissé tel quel ici —
    // le changer est une décision d'écran, pas un effet de bord de ce lot.
    const lien = within(dialogue).getByText('Sauce au poivre').closest('a') as HTMLAnchorElement
    expect(lien.getAttribute('href')).toBe('#/recette/sauce_poivre')
  })

  it('⛔ ne propose RIEN sur un plat qui vient déjà avec sa sauce', async () => {
    // `artichauts_vinaigrette` porte `porte_deja_une_sauce: true`. La règle est côté moteur
    // (`proposerUneSauce`) ; ce test vérifie que l'écran l'honore au lieu d'afficher une section
    // vide, ce qu'un `total === 0` mal branché produirait.
    await monter(recetteDeReference().id)
    expect(screen.queryByText('Ajouter une sauce')).toBeNull()
  })

  it('dit le nombre de sauces écartées MÊME quand il en reste à afficher', async () => {
    // Exclure la moutarde retire `vinaigrette_moutarde` des trois sauces du catalogue. Les deux
    // autres restent : sans cette ligne, la liste raccourcie se lirait comme un catalogue pauvre —
    // l'utilisateur chercherait un défaut là où l'application a fait exactement son travail.
    const { writeExcludedFoodIds } = await import('../../data/user-store.js')
    writeExcludedFoodIds(baseCourante(), ['moutarde_dijon' as never])

    await monter(PLAT_SAUCABLE)
    fireEvent.click(screen.getByText('Ajouter une sauce').closest('button')!)
    const dialogue = await screen.findByRole('dialog')

    expect(within(dialogue).queryByText('Vinaigrette à la moutarde')).toBeNull()
    expect(within(dialogue).getByText('Sauce au poivre')).toBeDefined()
    expect(
      within(dialogue).getByText(/1 sauce écartée par vos allergies, votre régime ou vos exclusions\./)
    ).toBeDefined()
  })

  it('⛔ n’affiche AUCUN chiffre d’énergie tant que les valeurs sont masquées', async () => {
    // Les calories d'une sauce se comptent sur leur PROPRE ligne, jamais fondues dans le total du
    // plat — et elles suivent le réglage `afficherMacros` comme le reste. Le voir apparaître ici
    // alors que la fiche est repliée voudrait dire que `afficherEnergie` n'est plus branché.
    await monter(PLAT_SAUCABLE)
    expect(readDisplay(baseCourante()).afficherMacros).toBe(false)
    fireEvent.click(screen.getByText('Ajouter une sauce').closest('button')!)
    const dialogue = await screen.findByRole('dialog')
    expect(within(dialogue).queryByText(/kcal \/ portion/)).toBeNull()
  })
})

/**
 * ① « Je la prends toujours avec ce plat » — `user_recipe_sauce` (v14).
 *
 * ⚠️ CHAQUE TEST VÉRIFIE LA BASE, PAS SEULEMENT L'ÉCRAN. Un `aria-pressed` qui bascule sans écrire
 * est exactement le défaut que ce lot répare ailleurs : l'état React survit à la session, pas au
 * remontage. Le dernier test remonte l'écran de zéro pour cette raison.
 */
describe('detail-recette — retenir une sauce pour les courses (v14)', () => {
  const PLAT_SAUCABLE = 'poulet_roti_carottes'

  async function ouvrirLePanneau() {
    await monter(PLAT_SAUCABLE)
    fireEvent.click(screen.getByText('Ajouter une sauce').closest('button')!)
    return await screen.findByRole('dialog')
  }

  /**
   * Le bouton d'UNE sauce, désigné par le nom de la sauce et non par un index : la liste est triée
   * alphabétiquement et un lot de contenu peut y insérer une entrée devant.
   *
   * ⚠️ `aria-pressed` EST LE SEUL DISCRIMINANT indépendant du libellé : la fenêtre contient aussi
   * des liens et un bouton de fermeture, et le libellé du bouton change quand il est enfoncé.
   */
  const boutonDe = (dialogue: HTMLElement, nomSauce: string) => {
    const item = within(dialogue).getByText(nomSauce).closest('li') as HTMLElement
    return within(item).getAllByRole('button').find((b) => b.hasAttribute('aria-pressed'))!
  }

  it('écrit le choix en base, et le relâche', async () => {
    const dialogue = await ouvrirLePanneau()
    const bouton = boutonDe(dialogue, 'Sauce au poivre')
    expect(bouton.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(bouton)
    await waitFor(() =>
      expect(readSaucesChoisies(baseCourante()).get(PLAT_SAUCABLE as RecipeId)).toEqual(['sauce_poivre'])
    )

    fireEvent.click(boutonDe(screen.getByRole('dialog'), 'Sauce au poivre'))
    await waitFor(() =>
      expect(readSaucesChoisies(baseCourante()).get(PLAT_SAUCABLE as RecipeId)).toBeUndefined()
    )
  })

  it('une sauce de « Autres sauces » se retient tout autant qu’une sauce attachée', async () => {
    // ⚠️ LE CATALOGUE PROPOSE, L'UTILISATEUR CHOISIT. Restreindre le bouton aux sauces attachées
    // ferait dériver le choix de l'utilisateur de `Recipe.sauceIds`, donc le ferait changer à la
    // prochaine mise à jour du catalogue. La vinaigrette n'est PAS attachée au poulet rôti.
    const dialogue = await ouvrirLePanneau()
    expect(within(dialogue).getByText('Autres sauces')).toBeDefined()

    fireEvent.click(boutonDe(dialogue, 'Vinaigrette à la moutarde'))
    await waitFor(() =>
      expect(readSaucesChoisies(baseCourante()).get(PLAT_SAUCABLE as RecipeId)).toEqual(['vinaigrette_moutarde'])
    )
  })

  it('la ligne repliée annonce le CHOIX, pas la proposition du catalogue', async () => {
    // Sans ça, le seul endroit visible sans ouvrir la fenêtre dirait « 1 proposée avec ce plat » à
    // quelqu'un qui en a retenu deux — il annoncerait autre chose que son propre choix.
    const dialogue = await ouvrirLePanneau()
    fireEvent.click(boutonDe(dialogue, 'Sauce au poivre'))
    await waitFor(() => expect(screen.queryByText('1 dans vos courses')).not.toBeNull())

    fireEvent.click(boutonDe(screen.getByRole('dialog'), 'Vinaigrette à la moutarde'))
    await waitFor(() => expect(screen.queryByText('2 dans vos courses')).not.toBeNull())
    expect(screen.queryByText('1 proposée avec ce plat')).toBeNull()
  })

  it('persiste : un écran remonté de zéro retrouve le bouton enfoncé', async () => {
    const dialogue = await ouvrirLePanneau()
    fireEvent.click(boutonDe(dialogue, 'Sauce au poivre'))
    await waitFor(() =>
      expect(readSaucesChoisies(baseCourante()).get(PLAT_SAUCABLE as RecipeId)).toEqual(['sauce_poivre'])
    )

    cleanup()
    const rouvert = await ouvrirLePanneau()
    expect(boutonDe(rouvert, 'Sauce au poivre').getAttribute('aria-pressed')).toBe('true')
  })

  it('⛔ retenir une sauce NE REPERD PAS les portions réglées', async () => {
    // Le défaut verrouillé : `basculerSauce` rappelle `charger()` pour relire la base, et la remise
    // à zéro des portions vivait DANS `charger`. Régler 6 portions puis toucher une sauce — ou
    // l'étoile des favoris, qui rappelle le même `charger` — reperdait le réglage sans un mot.
    await monter(PLAT_SAUCABLE)
    const selecteur = screen.getByLabelText('Une portion de plus').closest('div') as HTMLElement
    const lu = () => within(selecteur).getByText(/^\d+$/).textContent
    const base = lu()

    fireEvent.click(screen.getByLabelText('Une portion de plus'))
    fireEvent.click(screen.getByLabelText('Une portion de plus'))
    const regle = lu()
    expect(regle).not.toBe(base)

    fireEvent.click(screen.getByText('Ajouter une sauce').closest('button')!)
    fireEvent.click(boutonDe(await screen.findByRole('dialog'), 'Sauce au poivre'))
    await waitFor(() =>
      expect(readSaucesChoisies(baseCourante()).get(PLAT_SAUCABLE as RecipeId)).toEqual(['sauce_poivre'])
    )

    expect(lu()).toBe(regle)
  })
})

/**
 * ③ « La cuisiner avec le plat » — la MÊME liste `avec` que « cuisiner avec un autre plat ».
 *
 * ⚠️ AUCUN SECOND CHEMIN N'EST CONSTRUIT ICI, et ces tests le vérifient plutôt que de le supposer :
 * `SousVue.cuisine` porte déjà une LISTE de plats (v13) et `hashDeLaCuisine` la transporte. Le point
 * avait été chiffré comme un changement de schéma `user.db` ; il coûte un lien, et la seule façon de
 * le prouver est de comparer ce lien à celui du plat seul.
 */
describe('detail-recette — cuisiner une sauce avec le plat', () => {
  const PLAT_SAUCABLE = 'poulet_roti_carottes'

  async function ouvrirLePanneau() {
    await monter(PLAT_SAUCABLE)
    fireEvent.click(screen.getByText('Ajouter une sauce').closest('button')!)
    return await screen.findByRole('dialog')
  }

  const hrefDuPlatSeul = () =>
    (screen.getByText('Cuisiner pas à pas').closest('a') as HTMLAnchorElement).getAttribute('href')

  /** Le lien de CETTE sauce — la fenêtre en contient un par ligne, jamais un seul. */
  const lienCuisinerDe = (dialogue: HTMLElement, nomSauce: string) => {
    const item = within(dialogue).getByText(nomSauce).closest('li') as HTMLElement
    return within(item).getByText('La cuisiner avec le plat').closest('a') as HTMLAnchorElement
  }

  it('mène au mode cuisine du PLAT, la sauce ajoutée à sa liste `avec`', async () => {
    const dialogue = await ouvrirLePanneau()
    // ⚠️ COMPARÉ AU LIEN DU PLAT SEUL, jamais à un hash écrit à la main : c'est ce qui prouve que
    // les deux ouvrent le même écran sur le même plat, et que la sauce s'y AJOUTE au lieu de le
    // remplacer. Un hash littéral serait vert même si le plat avait changé d'identifiant.
    expect(lienCuisinerDe(dialogue, 'Sauce au poivre').getAttribute('href')).toBe(
      `${hrefDuPlatSeul()}&avec=sauce_poivre`
    )
    // Et pas seulement sur les sauces attachées : la vinaigrette vient de « Autres sauces ».
    expect(lienCuisinerDe(dialogue, 'Vinaigrette à la moutarde').getAttribute('href')).toBe(
      `${hrefDuPlatSeul()}&avec=vinaigrette_moutarde`
    )
  })

  it('les portions réglées voyagent — celles du PLAT, aucune pour la sauce', async () => {
    // ⚠️ `portions: null` CÔTÉ SAUCE, ET C'EST VOULU : « rôti pour 6 » ne dit rien du nombre de
    // parts de la sauce, donc c'est son `portionsBase` qui s'applique (`PlatACuisiner`). Recopier
    // les 6 portions du plat sur la sauce ferait préparer six fois la dose.
    await monter(PLAT_SAUCABLE)
    fireEvent.click(screen.getByLabelText('Une portion de plus'))
    fireEvent.click(screen.getByLabelText('Une portion de plus'))
    fireEvent.click(screen.getByText('Ajouter une sauce').closest('button')!)
    const dialogue = await screen.findByRole('dialog')

    const href = lienCuisinerDe(dialogue, 'Sauce au poivre').getAttribute('href')!
    expect(href).toBe(`${hrefDuPlatSeul()}&avec=sauce_poivre`)
    expect(href).toContain('portions=')
    // Aucun `:portions` accroché à l'identifiant de la sauce — voir `hashDeLaCuisine`.
    expect(href.endsWith('avec=sauce_poivre')).toBe(true)
  })

  it('⛔ SENS 1 — cuisiner la sauce ce soir n’écrit RIEN dans les courses', async () => {
    // Les fusionner ferait ACHETER une sauce à qui voulait seulement la préparer ce soir. Ce lien
    // est un `<a href>` sans `onClick` : il ne peut structurellement rien écrire — le test le
    // constate quand même, parce qu'un jour quelqu'un voudra « en profiter pour la retenir aussi ».
    const dialogue = await ouvrirLePanneau()
    fireEvent.click(lienCuisinerDe(dialogue, 'Sauce au poivre'))
    expect(readSaucesChoisies(baseCourante()).get(PLAT_SAUCABLE as RecipeId)).toBeUndefined()
  })

  it('⛔ SENS 2 — retenir la sauce pour les courses ne change pas ce lien', async () => {
    // L'inverse du précédent : le choix durable ne doit pas non plus se mettre à décider de ce
    // qu'on cuisine ce soir. Le lien est identique avant et après.
    const dialogue = await ouvrirLePanneau()
    const item = within(dialogue).getByText('Sauce au poivre').closest('li') as HTMLElement
    const avant = lienCuisinerDe(dialogue, 'Sauce au poivre').getAttribute('href')

    fireEvent.click(within(item).getAllByRole('button').find((b) => b.hasAttribute('aria-pressed'))!)
    await waitFor(() =>
      expect(readSaucesChoisies(baseCourante()).get(PLAT_SAUCABLE as RecipeId)).toEqual(['sauce_poivre'])
    )

    expect(lienCuisinerDe(screen.getByRole('dialog'), 'Sauce au poivre').getAttribute('href')).toBe(avant)
  })
})
