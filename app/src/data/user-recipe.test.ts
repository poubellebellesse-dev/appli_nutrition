// data/user-recipe.test.ts
//
// Deux familles d'assertions, dans cet ordre d'importance :
//   1. Le RÉGIME DÉRIVÉ. Personne n'étiquette une recette utilisateur. Une dérivation trop
//      permissive proposerait du poisson à un végétarien — le défaut le plus grave que cette
//      fonctionnalité peut introduire, et il serait silencieux.
//   2. Les allers-retours de persistance, et la tolérance à un contenu illisible : `contenu_json`
//      est du texte libre, aucune migration ne le rattrapera.

import { beforeEach, describe, expect, it } from 'vitest'
import type { Food, FoodId, Recipe, RecipeId } from '../engine/domain/index.js'
import { g, min } from '../engine/domain/index.js'
import { openUserDb, type OpenedUserDb } from './user-store-node.js'
import type { UserDb } from './user-db.js'
import {
  AXES_PAR_DEFAUT,
  construireRecette,
  deleteUserRecipe,
  estRecettePerso,
  nouvelIdRecette,
  problemes,
  readUserRecipes,
  saveUserRecipe,
  variantePartantDe,
  versRecette,
  type SaisieRecette,
  type StoredUserRecipe,
} from './user-recipe.js'

// --- Fixtures ---------------------------------------------------------------------------------

function aliment(id: string, groupe: string, origine: Food['origineAnimale'], deriveDe: string | null = null): Food {
  return {
    id: id as FoodId,
    codeCiqual: `T-${id}`,
    nom: id,
    synonymes: [],
    groupe,
    sousFamille: null,
    sousGroupe: null,
    nutrimentsPour100g: new Map(),
    allergenes: [],
    saisonMois: [],
    touteAnnee: true,
    piquant: null,
    poidsPieceG: null,
    fondDePlacard: false,
    quantiteFigee: false,
    conditionnementG: null,
    origineAnimale: origine,
    deriveDe: deriveDe === null ? null : (deriveDe as FoodId),
  }
}

const ALIMENTS: ReadonlyMap<FoodId, Food> = new Map(
  [
    aliment('tomate', 'legumes', null),
    aliment('riz', 'cereales', null),
    aliment('lait', 'produits_laitiers', 'mammifere'),
    aliment('beurre', 'matieres_grasses', null, 'lait'), // dérivé : l'origine remonte la chaîne
    aliment('miel', 'produits_sucres', 'insecte'),
    aliment('saumon', 'poissons', 'poisson'),
    aliment('boeuf', 'viandes', 'mammifere'),
    aliment('poulet', 'viandes', 'volaille'),
  ].map((f) => [f.id, f])
)

function saisie(foodIds: readonly string[], surcharges: Partial<SaisieRecette> = {}): SaisieRecette {
  return {
    nom: 'Mon plat',
    tempsPrepMin: 10,
    tempsCuissonMin: 15,
    portionsBase: 2,
    difficulte: 1,
    typesRepas: ['diner'],
    envergure: 'quotidien',
    conservationJours: 2,
    axes: AXES_PAR_DEFAUT,
    ingredients: foodIds.map((foodId) => ({
      foodId,
      quantiteG: 100,
      uniteAffichage: '100 g',
      optionnel: false,
    })),
    etapes: ['Tout mélanger.'],
    ...surcharges,
  }
}

const regimeDe = (foodIds: readonly string[]): string | undefined => {
  const stockee = construireRecette('perso:x', saisie(foodIds), null)
  return versRecette(stockee, ALIMENTS).facettes.find((f) => f.facette === 'regime')?.valeur
}

// --- Le régime dérivé -------------------------------------------------------------------------

describe('user-recipe — le régime est DÉRIVÉ des ingrédients', () => {
  it('rend végétalien quand rien n’est d’origine animale', () => {
    expect(regimeDe(['tomate', 'riz'])).toBe('vegetalien')
  })

  it('s’arrête à végétarien sur un produit animal qui n’est pas de la chair', () => {
    expect(regimeDe(['tomate', 'lait'])).toBe('vegetarien')
  })

  it('⛔ ne se laisse PAS tromper par un dérivé rangé dans un rayon végétal', () => {
    // Le défaut historique : le beurre vit en « matières grasses », le miel en « produits sucrés ».
    // Deviner depuis `groupe` déclarait « Radis au beurre » végétalienne, sur 20 recettes.
    expect(regimeDe(['tomate', 'beurre'])).toBe('vegetarien')
    expect(regimeDe(['tomate', 'miel'])).toBe('vegetarien')
  })

  it('rend pescétarien avec du poisson, omnivore avec de la chair de mammifère ou de volaille', () => {
    expect(regimeDe(['riz', 'saumon'])).toBe('pescetarien')
    expect(regimeDe(['riz', 'boeuf'])).toBe('omnivore')
    expect(regimeDe(['riz', 'poulet'])).toBe('omnivore')
  })

  it('retient le plus RESTRICTIF quand plusieurs origines se croisent', () => {
    expect(regimeDe(['saumon', 'boeuf', 'tomate'])).toBe('omnivore')
    expect(regimeDe(['lait', 'saumon'])).toBe('pescetarien')
  })

  it('IGNORE les ingrédients optionnels — ils ne doivent pas restreindre le plat', () => {
    const avecOptionnel = construireRecette(
      'perso:x',
      saisie(['tomate', 'riz'], {
        ingredients: [
          { foodId: 'tomate', quantiteG: 100, uniteAffichage: '100 g', optionnel: false },
          { foodId: 'boeuf', quantiteG: 50, uniteAffichage: '50 g', optionnel: true },
        ],
      }),
      null
    )
    expect(versRecette(avecOptionnel, ALIMENTS).facettes.find((f) => f.facette === 'regime')?.valeur).toBe(
      'vegetalien'
    )
  })

  it('⛔ n’affirme RIEN quand aucun ingrédient n’est connu du catalogue', () => {
    // Le neutre arithmétique de la boucle est `vegetalien` — le proposer ici l'aurait servi à un
    // végétalien sur la foi d'une liste illisible. `omnivore` est le plus permissif comme étiquette,
    // donc le plus restrictif à l'usage : la recette n'apparaît pour aucun régime déclaré.
    expect(regimeDe(['aliment-disparu'])).toBe('omnivore')
  })

  it('porte EXACTEMENT une facette de régime (décision 28)', () => {
    const stockee = construireRecette('perso:x', saisie(['tomate']), null)
    const regimes = versRecette(stockee, ALIMENTS).facettes.filter((f) => f.facette === 'regime')
    expect(regimes).toHaveLength(1)
  })
})

// --- Les variantes ------------------------------------------------------------------------------

function recetteDeBase(): Recipe {
  return {
    id: 'blanquette' as RecipeId,
    nom: 'Blanquette',
    origine: 'maison',
    description: 'du catalogue',
    tempsPrepMin: min(25),
    tempsCuissonMin: min(90),
    difficulte: 3,
    portionsBase: 6,
    imagePath: null,
    typesRepas: ['diner'],
    saisonMois: [1, 2, 3],
    envergure: 'convivial',
    conservationJours: 3,
    axes: { sucreSale: -1, legerConsistant: 1, chaudFroid: 1, texture: 'fondant' },
    ingredients: [
      { foodId: 'boeuf' as FoodId, quantiteG: g(800), uniteAffichage: '800 g', optionnel: false },
      { foodId: 'lait' as FoodId, quantiteG: g(200), uniteAffichage: '20 cl', optionnel: false },
    ],
    etapes: [
      {
        ordre: 1,
        texte: 'Saisir la viande.',
        lexiconIds: ['saisir'],
        timerS: 600,
        timerType: 'cuisson',
        nature: 'geste',
        foodIds: [],
      },
    ],
    facettes: [
      { facette: 'cuisine', valeur: 'francaise' },
      { facette: 'regime', valeur: 'omnivore' },
    ],
    service: null,
    piquant: null,
    sources: [],
    testeLe: null,
    estSauce: false,
    porteDejaUneSauce: null,
    sauceIds: [],
  }
}

describe('user-recipe — la variante hérite de sa base', () => {
  it('reprend tout ce qui NE SE DÉRIVE PAS : axes, conservation, envergure, créneaux', () => {
    // C'est l'intérêt entier de la variante — on ne redemande pas à quelqu'un qui change deux
    // ingrédients si son plat est « fondant » ou se garde trois jours.
    const base = recetteDeBase()
    const depart = variantePartantDe(base)
    expect(depart.axes).toEqual(base.axes)
    expect(depart.conservationJours).toBe(3)
    expect(depart.envergure).toBe('convivial')
    expect(depart.typesRepas).toEqual(['diner'])
    expect(depart.ingredients).toHaveLength(2)
    expect(depart.etapes).toEqual(['Saisir la viande.'])
  })

  it('hérite de la cuisine mais RECALCULE le régime après substitution', () => {
    // ⚠️ LE POINT QUI COMPTE. Remplacer le bœuf par du riz doit rendre le plat végétarien ; garder
    // l'étiquette `omnivore` de la base le cacherait à qui pourrait le manger. À l'inverse, hériter
    // l'étiquette sans recalcul sur une substitution INVERSE serait dangereux.
    const base = recetteDeBase()
    const depart = variantePartantDe(base)
    const sansViande: SaisieRecette = {
      ...depart,
      ingredients: depart.ingredients.map((i) => (i.foodId === 'boeuf' ? { ...i, foodId: 'riz' } : i)),
    }
    const recette = versRecette(construireRecette('perso:v', sansViande, base), ALIMENTS)
    expect(recette.facettes.find((f) => f.facette === 'regime')?.valeur).toBe('vegetarien')
    expect(recette.facettes.find((f) => f.facette === 'cuisine')?.valeur).toBe('francaise')
  })

  it('se déclare `variante` et garde la trace de sa base', () => {
    const base = recetteDeBase()
    const stockee = construireRecette('perso:v', variantePartantDe(base), base)
    expect(stockee.source).toBe('variante')
    expect(stockee.baseRecipeId).toBe('blanquette')
  })

  it('une création de zéro est `perso`, sans base ni facette héritée', () => {
    const stockee = construireRecette('perso:n', saisie(['tomate']), null)
    expect(stockee.source).toBe('perso')
    expect(stockee.baseRecipeId).toBeNull()
    expect(stockee.facettesHeritees).toEqual([])
  })
})

// --- Conversion vers le domaine -------------------------------------------------------------------

describe('user-recipe — conversion vers Recipe', () => {
  it('numérote les étapes à partir de 1 et jette les lignes vides', () => {
    const stockee = construireRecette(
      'perso:x',
      saisie(['tomate'], { etapes: ['Laver.', '   ', 'Couper.', ''] }),
      null
    )
    expect(stockee.etapes).toEqual(['Laver.', 'Couper.'])
    expect(versRecette(stockee, ALIMENTS).etapes.map((e) => e.ordre)).toEqual([1, 2])
  })

  it('n’attache ni lexique ni minuteur — une annotation fausse pointerait vers un autre geste', () => {
    const recette = versRecette(construireRecette('perso:x', saisie(['tomate']), null), ALIMENTS)
    expect(recette.etapes[0]?.lexiconIds).toEqual([])
    expect(recette.etapes[0]?.timerS).toBeNull()
  })

  it('origine reflète `source` : `perso`/`variante` → `utilisateur`, `importe` → `partagee`', () => {
    // Défaut corrigé : `versRecette` écrivait `origine: 'maison'` en dur, ce qui affirmait « écrite
    // pour cette application » même pour une recette reçue d'un tiers via `.nutri-recipe`.
    const perso = construireRecette('perso:x', saisie(['tomate']), null)
    expect(perso.source).toBe('perso')
    expect(versRecette(perso, ALIMENTS).origine).toBe('utilisateur')

    const base = recetteDeBase()
    const variante = construireRecette('perso:v', variantePartantDe(base), base)
    expect(variante.source).toBe('variante')
    expect(versRecette(variante, ALIMENTS).origine).toBe('utilisateur')

    const importee: StoredUserRecipe = { ...perso, source: 'importe' }
    expect(versRecette(importee, ALIMENTS).origine).toBe('partagee')
  })

  it('est de saison TOUTE l’année — jamais une recette qui disparaît sans explication', () => {
    expect(versRecette(construireRecette('perso:x', saisie(['tomate']), null), ALIMENTS).saisonMois).toHaveLength(12)
  })

  it('garde un ingrédient inconnu du catalogue au lieu de le supprimer en douce', () => {
    const stockee = construireRecette('perso:x', saisie(['tomate', 'aliment-disparu']), null)
    expect(versRecette(stockee, ALIMENTS).ingredients).toHaveLength(2)
  })
})

// --- Identifiants et validation ---------------------------------------------------------------

describe('user-recipe — identifiants', () => {
  it('se reconnaissent au préfixe', () => {
    expect(estRecettePerso(nouvelIdRecette(1_700_000_000_000, 0.42))).toBe(true)
    expect(estRecettePerso('blanquette-veau')).toBe(false)
  })

  it('ne collisionnent pas dans la même milliseconde', () => {
    const a = nouvelIdRecette(1_700_000_000_000, 0.1)
    const b = nouvelIdRecette(1_700_000_000_000, 0.9)
    expect(a).not.toBe(b)
  })
})

describe('user-recipe — validation', () => {
  it('laisse passer une saisie complète', () => {
    expect(problemes(saisie(['tomate']))).toEqual([])
  })

  it('refuse ce qui rendrait la recette inutilisable', () => {
    expect(problemes(saisie(['tomate'], { nom: '  ' }))).toHaveLength(1)
    expect(problemes(saisie([]))).not.toEqual([])
    expect(problemes(saisie(['tomate'], { typesRepas: [] }))).not.toEqual([])
    expect(problemes(saisie(['tomate'], { portionsBase: 0 }))).not.toEqual([])
    expect(problemes(saisie(['tomate'], { tempsPrepMin: 0, tempsCuissonMin: 0 }))).not.toEqual([])
  })

  it('⛔ refuse un plat dont TOUS les ingrédients sont facultatifs', () => {
    // Le régime se dérive des ingrédients non optionnels. Tout facultatif ⇒ liste vide ⇒
    // `omnivore` faute de pouvoir affirmer quoi que ce soit ⇒ la recette disparaît pour tout
    // régime déclaré, en silence. Trouvé en pilotant l'écran, où rien ne l'arrêtait.
    const toutFacultatif = saisie(['tomate', 'riz'], {
      ingredients: [
        { foodId: 'tomate', quantiteG: 100, uniteAffichage: '100 g', optionnel: true },
        { foodId: 'riz', quantiteG: 80, uniteAffichage: '80 g', optionnel: true },
      ],
    })
    expect(problemes(toutFacultatif)).not.toEqual([])
    // Un seul indispensable suffit à débloquer.
    expect(
      problemes({
        ...toutFacultatif,
        ingredients: [
          { foodId: 'tomate', quantiteG: 100, uniteAffichage: '100 g', optionnel: false },
          { foodId: 'riz', quantiteG: 80, uniteAffichage: '80 g', optionnel: true },
        ],
      })
    ).toEqual([])
  })

  it('refuse une quantité nulle — elle fausserait tous les nutriments dérivés', () => {
    const zero = saisie(['tomate'], {
      ingredients: [{ foodId: 'tomate', quantiteG: 0, uniteAffichage: '', optionnel: false }],
    })
    expect(problemes(zero)).not.toEqual([])
  })
})

// --- Persistance ---------------------------------------------------------------------------------

describe('user-recipe — persistance', () => {
  let ouverte: OpenedUserDb
  let db: UserDb

  beforeEach(() => {
    ouverte = openUserDb(':memory:')
    db = ouverte.db
  })

  it('fait l’aller-retour sans rien perdre', () => {
    const stockee = construireRecette('perso:a', saisie(['tomate', 'riz']), null)
    saveUserRecipe(db, stockee, '2026-07-31')
    expect(readUserRecipes(db)).toEqual([stockee])
  })

  it('remplace au lieu de dupliquer quand on ré-enregistre le même identifiant', () => {
    const stockee = construireRecette('perso:a', saisie(['tomate']), null)
    saveUserRecipe(db, stockee, '2026-07-31')
    saveUserRecipe(db, { ...stockee, nom: 'Renommée' }, '2026-08-01')
    const relues = readUserRecipes(db)
    expect(relues).toHaveLength(1)
    expect(relues[0]?.nom).toBe('Renommée')
  })

  it('supprime', () => {
    saveUserRecipe(db, construireRecette('perso:a', saisie(['tomate']), null), '2026-07-31')
    deleteUserRecipe(db, 'perso:a')
    expect(readUserRecipes(db)).toEqual([])
  })

  it('IGNORE une entrée illisible au lieu de faire échouer le chargement', () => {
    // ⚠️ `contenu_json` est du texte libre : JSON tronqué par un disque plein, ou écrit par une
    // version future. Une seule entrée abîmée ne doit pas empêcher l'application de démarrer.
    saveUserRecipe(db, construireRecette('perso:bon', saisie(['tomate']), null), '2026-07-31')
    db.run(`INSERT INTO user_recipe (id, source, contenu_json, importe_le) VALUES (?, 'perso', ?, ?)`, [
      'perso:casse',
      '{ ceci n est pas du json',
      '2026-07-31',
    ])
    db.run(`INSERT INTO user_recipe (id, source, contenu_json, importe_le) VALUES (?, 'perso', ?, ?)`, [
      'perso:futur',
      JSON.stringify({ schemaVersion: 99, id: 'perso:futur', nom: 'Venue du futur', ingredients: [] }),
      '2026-07-31',
    ])

    const relues = readUserRecipes(db)
    expect(relues).toHaveLength(1)
    expect(relues[0]?.id).toBe('perso:bon')
  })

  it('n’efface PAS les notes attachées en ré-enregistrant la recette', () => {
    // ⚠️ `INSERT OR REPLACE` supprime la ligne avant de la réinsérer et déclencherait les cascades.
    // Le piège est documenté dans la fiche de reprise ; `ON CONFLICT DO UPDATE` l'évite.
    const stockee = construireRecette('perso:a', saisie(['tomate']), null)
    saveUserRecipe(db, stockee, '2026-07-31')
    db.run(`INSERT INTO user_recipe_note (recipe_id, etape_ordre, texte, cree_le) VALUES (?, NULL, ?, ?)`, [
      'perso:a',
      'Moins de sel la prochaine fois',
      '2026-07-31',
    ])
    saveUserRecipe(db, { ...stockee, nom: 'Renommée' }, '2026-08-01')
    const notes = db.all<{ readonly texte: string }>('SELECT texte FROM user_recipe_note WHERE recipe_id = ?', [
      'perso:a',
    ])
    expect(notes).toHaveLength(1)
  })
})
