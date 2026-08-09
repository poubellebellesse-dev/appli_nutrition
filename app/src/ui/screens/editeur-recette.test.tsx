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
import { readUserRecipes, saveUserRecipe, type StoredUserRecipe } from '../../data/user-recipe.js'
import { baseCourante, catalogueDeTest, reinitialiserBase, sessionDeTest, confianceDeTest} from '../test-socle.js'

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

// ⚠️ `ProvenanceLancerParcours` IMPORTÉ DYNAMIQUEMENT DANS `monter`, PAS EN TÊTE DE FICHIER — voir
// `courses.test.tsx` pour la raison : `vi.resetModules()` en `beforeEach` figerait sinon un
// `Context` React distinct de celui que `EditeurRecette` utilise réellement dans `<LienTutoriel>`.
/**
 * @param nature La réponse à « un plat ou une sauce ? » (④), posée AVANT le formulaire pour une
 *   création de zéro. `'plat'` par défaut : c'est ce que testaient tous les cas écrits avant que la
 *   question existe, et leur faire traverser l'écran plutôt que le contourner garde le chemin réel.
 *   `null` laisse la question à l'écran, pour les tests qui portent sur elle.
 */
async function monter(baseId: string | null = null, nature: 'plat' | 'sauce' | null = 'plat') {
  const { EditeurRecette } = await import('./editeur-recette.js')
  const { ProvenanceLancerParcours } = await import('../lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <EditeurRecette baseId={baseId} />
    </ProvenanceLancerParcours>
  )
  await screen.findByRole('heading', { level: 1 })
  // La question ne se pose qu'à la création de zéro : une variante et une recette rouverte portent
  // déjà leur nature (`variantePartantDe`, `saisieDepuisStockee`).
  if (baseId === null && nature !== null) {
    fireEvent.click(screen.getByText(nature === 'sauce' ? 'Une sauce' : 'Un plat'))
    await screen.findByRole('heading', { level: 1 })
  }
}

const champ = (selecteur: string) => document.querySelector(selecteur) as HTMLInputElement
const saisir = (selecteur: string, valeur: string) =>
  fireEvent.change(champ(selecteur), { target: { value: valeur } })
const enregistrer = () => screen.getByText('Enregistrer ma recette').closest('button') as HTMLButtonElement
const enregistrerLaSauce = () =>
  screen.getByText('Enregistrer ma sauce').closest('button') as HTMLButtonElement

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
    // ⚠️ ET LA QUESTION DE ④ SE POSE, parce qu'il ne reste rien à hériter : une base introuvable ne
    // dit pas si l'on composait un plat ou une sauce, et la deviner « plat » écrirait en base une
    // nature que personne n'a déclarée. C'est bien une création de zéro, elle en suit le chemin.
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe("Qu'est-ce que vous composez ?")
    fireEvent.click(screen.getByText('Un plat'))
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ma recette')
    )
  })
})

describe('éditeur — modifier une recette perso', () => {
  /** Un ingrédient réel du catalogue de test, pour que la recette perso se convertisse sans trou. */
  const foodId = () => [...catalogueDeTest().foods.values()][0]!.id

  const recettePerso = (): StoredUserRecipe => ({
    schemaVersion: 1,
    id: 'perso:existe',
    source: 'perso',
    baseRecipeId: null,
    nom: 'Ma recette perso',
    tempsPrepMin: 10,
    tempsCuissonMin: 20,
    portionsBase: 3,
    difficulte: 2,
    typesRepas: ['dejeuner'],
    envergure: 'convivial',
    conservationJours: 3,
    axes: { sucreSale: 1, legerConsistant: -1, chaudFroid: -1, texture: 'croquant' },
    ingredients: [{ foodId: foodId(), quantiteG: 150, uniteAffichage: '150 g', optionnel: false }],
    etapes: ['Étape unique.'],
    facettesHeritees: [],
    service: 'plat',
    piquant: 2,
    estSauce: false,
  })

  it('rouvre l’éditeur sur « Modifier ma recette », pré-remplie', async () => {
    saveUserRecipe(baseCourante(), recettePerso(), '2026-07-31')
    await monter('perso:existe')
    await screen.findByRole('heading', { name: 'Modifier ma recette' })
    expect(champ('input[type="text"]').value).toBe('Ma recette perso')
  })

  it('changer le nom et enregistrer réécrit SOUS LE MÊME ID — un seul enregistrement en base', async () => {
    saveUserRecipe(baseCourante(), recettePerso(), '2026-07-31')
    await monter('perso:existe')
    await screen.findByRole('heading', { name: 'Modifier ma recette' })

    saisir('input[type="text"]', 'Ma recette perso, renommée')
    await waitFor(() => expect(enregistrer().disabled).toBe(false))
    fireEvent.click(enregistrer())
    await screen.findByRole('heading', { name: /C'est enregistré/ })

    const enregistrees = readUserRecipes(baseCourante())
    expect(enregistrees).toHaveLength(1)
    expect(enregistrees[0]?.id).toBe('perso:existe')
    expect(enregistrees[0]?.nom).toBe('Ma recette perso, renommée')
  })

  it('⛔ modifier SEULEMENT le nom n’altère AUCUN autre champ — la perte silencieuse à traquer', async () => {
    const originale = recettePerso()
    saveUserRecipe(baseCourante(), originale, '2026-07-31')
    await monter('perso:existe')
    await screen.findByRole('heading', { name: 'Modifier ma recette' })

    saisir('input[type="text"]', 'Ma recette perso, renommée')
    await waitFor(() => expect(enregistrer().disabled).toBe(false))
    fireEvent.click(enregistrer())
    await screen.findByRole('heading', { name: /C'est enregistré/ })

    const [relue] = readUserRecipes(baseCourante())
    expect(relue).toEqual({ ...originale, nom: 'Ma recette perso, renommée' })
  })

  it('une variante modifiée reste `variante`, avec son `baseRecipeId`, `service` et `piquant`', async () => {
    const variante: StoredUserRecipe = {
      ...recettePerso(),
      id: 'perso:variante-existe',
      source: 'variante',
      baseRecipeId: 'blanquette',
    }
    saveUserRecipe(baseCourante(), variante, '2026-07-31')
    await monter('perso:variante-existe')
    await screen.findByRole('heading', { name: 'Modifier ma recette' })
    // Champs hérités : toujours masqués en modifiant une variante, comme à sa création.
    expect(document.body.textContent).not.toContain('Salé ou sucré ?')

    saisir('input[type="text"]', 'Blanquette, renommée')
    await waitFor(() => expect(enregistrer().disabled).toBe(false))
    fireEvent.click(enregistrer())
    await screen.findByRole('heading', { name: /C'est enregistré/ })

    const [relue] = readUserRecipes(baseCourante())
    expect(relue?.source).toBe('variante')
    expect(relue?.baseRecipeId).toBe('blanquette')
    expect(relue?.service).toBe('plat')
    expect(relue?.piquant).toBe(2)
  })
})

describe('éditeur — la recherche d’ingrédient répond comme les autres écrans', () => {
  it('« crue courgette » trouve Courgette : l’ordre des mots n’est pas celui du nom éditorial', async () => {
    // Décision 58, cause (1). La sous-chaîne échouait dès que la saisie n'était pas un fragment
    // littéral du nom. Trois écrans interrogent le même catalogue d'aliments ; les trois doivent y
    // répondre pareil, sinon « je l'ai trouvé sur l'autre écran » devient un défaut.
    await monter()
    await ajouterIngredient('crue courgette')

    expect(document.body.textContent).toMatch(/Courgette/)
  })
})

/**
 * ④ « Un plat ou une sauce ? » — la question posée AVANT le formulaire.
 *
 * ⚠️ SANS L'EXCEPTION DE `problemes()`, AUCUNE SAUCE PERSO N'EST ENREGISTRABLE. La règle générale
 * exige au moins un créneau de repas ; la décision 62 fait de `types_repas: []` la forme normale
 * d'une sauce. Les deux se contredisaient, et le bouton restait bloqué sur un message auquel plus
 * aucun champ à l'écran ne permettait de répondre. C'est ce que le test central de ce bloc constate.
 */
describe('éditeur — composer une sauce (④)', () => {
  it('pose la question AVANT le formulaire — aucun champ tant qu’elle n’est pas tranchée', async () => {
    // Posée au milieu, elle ferait disparaître un bloc déjà rempli : la réponse décide de ce que le
    // formulaire DEMANDE, pas seulement de ce qu'il enregistre.
    await monter(null, null)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe("Qu'est-ce que vous composez ?")
    expect(document.querySelector('input[type="text"]')).toBeNull()
    expect(screen.queryByText('Nom du plat')).toBeNull()
    // ⚠️ ET L'ANCRE DU TUTORIEL RESTE LÀ. Cet écran est désormais l'état neuf de #/composer ; sans
    // `data-visite="titre-composer"`, la première étape du parcours ne résout plus et le tutoriel
    // entier devient fantôme (`parcours.ts`, règle 1). C'est ce qui a cassé en écrivant ④.
    expect(document.querySelector('[data-visite="titre-composer"]')).not.toBeNull()
  })

  it('« Une sauce » ouvre un formulaire SANS moment de repas', async () => {
    await monter(null, 'sauce')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ma sauce')
    expect(screen.getByText('Nom de la sauce')).toBeDefined()
    // ⛔ Le bloc entier est retiré, pas laissé vide : une sauce ne se sert à aucune heure.
    expect(document.body.textContent).not.toContain('À quel moment ?')
    // Et ce qui reste vrai d'une sauce reste demandé — la question ne vide pas le formulaire.
    expect(screen.getByText('Combien de temps se garde-t-il ?')).toBeDefined()
  })

  it('« Un plat » laisse le formulaire inchangé — la question n’enlève rien par défaut', async () => {
    await monter(null, 'plat')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ma recette')
    expect(screen.getByText('À quel moment ?')).toBeDefined()
    expect(screen.getByText('Nom du plat')).toBeDefined()
  })

  it('⛔ s’ENREGISTRE sans créneau — sans l’exception de `problemes()`, le bouton reste bloqué', async () => {
    await monter(null, 'sauce')
    saisir('input[type="text"]', 'Ma sauce au poivre à moi')
    await ajouterIngredient('courgette')
    await waitFor(() => expect(enregistrerLaSauce().disabled).toBe(false))
    // Le message de la règle générale ne doit PAS être là : il serait sans réponse possible.
    expect(screen.queryByText('Choisissez au moins un moment de repas.')).toBeNull()

    fireEvent.click(enregistrerLaSauce())
    await screen.findByRole('heading', { name: /C'est enregistré/ })

    const enregistrees = readUserRecipes(baseCourante())
    expect(enregistrees).toHaveLength(1)
    expect(enregistrees[0]?.estSauce).toBe(true)
    // ⚠️ `typesRepas` VIDÉ, pas laissé au « dîner » de `SAISIE_VIDE` : une valeur invisible à
    // l'écran et fausse en base est pire qu'une valeur absente.
    expect(enregistrees[0]?.typesRepas).toEqual([])
  })

  it('entre dans le MÊME ensemble que les sauces du catalogue', async () => {
    // ⚠️ C'EST L'ASSERTION QUI COMPTE. Un `estSauce` écrit en base mais non porté jusqu'à `Recipe`
    // laisserait la sauce perso dans la liste ordinaire des plats — cinquième occurrence du piège
    // « un champ déclaré n'est pas un champ branché ». On vérifie la CONVERSION, pas le stockage.
    const { versRecette } = await import('../../data/user-recipe.js')
    await monter(null, 'sauce')
    saisir('input[type="text"]', 'Ma vinaigrette maison')
    await ajouterIngredient('courgette')
    await waitFor(() => expect(enregistrerLaSauce().disabled).toBe(false))
    fireEvent.click(enregistrerLaSauce())
    await screen.findByRole('heading', { name: /C'est enregistré/ })

    const stockee = readUserRecipes(baseCourante())[0]!
    const recette = versRecette(stockee, catalogueDeTest().foods)
    expect(recette.estSauce).toBe(true)
    // ⚠️ ET `sauceIds` RESTE VIDE : attacher une sauce à sa propre recette se fait depuis la fiche
    // (`user_recipe_sauce`, ①), où le choix est durable et révocable. Deux endroits pour dire la
    // même chose, ce serait deux réponses possibles et aucune règle pour les départager.
    expect(recette.sauceIds).toEqual([])
    expect(recette.porteDejaUneSauce).toBeNull()
  })

  it('la réponse reste AFFICHÉE et MODIFIABLE en haut du formulaire', async () => {
    // ⚠️ Une question posée une fois avant le formulaire et jamais rappelée enferme dans un choix
    // dont on ne se souvient plus — et une recette perso se rouvre des mois plus tard.
    await monter(null, 'plat')
    const pastille = (libelle: string) =>
      screen.getByText(libelle).closest('button') as HTMLButtonElement
    expect(pastille('Un plat').getAttribute('aria-pressed')).toBe('true')
    expect(pastille('Une sauce').getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(pastille('Une sauce'))
    await waitFor(() => expect(pastille('Une sauce').getAttribute('aria-pressed')).toBe('true'))
    expect(document.body.textContent).not.toContain('À quel moment ?')
  })

  it('⛔ basculer vers « une sauce » VIDE les créneaux déjà cochés — rien d’invisible en base', async () => {
    // Le bloc « À quel moment ? » disparaît à la bascule ; un créneau coché avant, laissé en base
    // après, serait une valeur que plus aucun écran ne montre et que personne ne peut retirer.
    await monter(null, 'plat')
    saisir('input[type="text"]', 'Bascule en cours de saisie')
    await ajouterIngredient('courgette')
    fireEvent.click(screen.getByText('Petit-déjeuner'))
    await waitFor(() => expect(enregistrer().disabled).toBe(false))

    fireEvent.click(screen.getByText('Une sauce').closest('button') as HTMLButtonElement)
    await waitFor(() => expect(enregistrerLaSauce().disabled).toBe(false))
    fireEvent.click(enregistrerLaSauce())
    await screen.findByRole('heading', { name: /C'est enregistré/ })

    const [enregistree] = readUserRecipes(baseCourante())
    expect(enregistree?.estSauce).toBe(true)
    expect(enregistree?.typesRepas).toEqual([])
  })

  it('une recette perso enregistrée AVANT la question reste un plat', async () => {
    // ⚠️ `schemaVersion` RESTE À 1 ET `estSauce` EST FACULTATIF — c'est tout le point. Le passer à 2
    // aurait fait refuser toutes les recettes perso déjà en base : une donnée saisie à la main,
    // disparue sans un mot pour un champ ajouté.
    const { versRecette } = await import('../../data/user-recipe.js')
    const ancienne = {
      schemaVersion: 1,
      id: 'perso:avant-la-question',
      source: 'perso',
      baseRecipeId: null,
      nom: 'Recette d’avant',
      tempsPrepMin: 10,
      tempsCuissonMin: 5,
      portionsBase: 2,
      difficulte: 1,
      typesRepas: ['diner'],
      envergure: 'quotidien',
      conservationJours: 2,
      axes: { sucreSale: -1, legerConsistant: 0, chaudFroid: 1, texture: 'moelleux' },
      ingredients: [{ foodId: [...catalogueDeTest().foods.keys()][0]!, quantiteG: 100, uniteAffichage: '100 g', optionnel: false }],
      etapes: ['Mélanger.'],
      facettesHeritees: [],
      service: null,
      piquant: null,
    } as unknown as StoredUserRecipe
    saveUserRecipe(baseCourante(), ancienne, '2026-08-01')

    const relue = readUserRecipes(baseCourante())[0]!
    expect(relue.estSauce).toBeUndefined()
    expect(versRecette(relue, catalogueDeTest().foods).estSauce).toBe(false)
  })
})
