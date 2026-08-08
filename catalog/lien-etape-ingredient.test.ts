// catalog/lien-etape-ingredient.test.ts — l'antécédent d'un pronom, et ce qui n'en est pas un.
//
// Ces tests portent sur la DÉRIVATION SEULE, sans base ni build : entrées objets, sorties objets.
// Ils ont été écrits À PARTIR DE DÉFAUTS MESURÉS sur le catalogue réel (relecture manuelle des
// 114 étapes du chantier de réécriture, 2026-08-08), pas imaginés — chaque `describe` cite la
// recette qui l'a révélé.

import { describe, expect, it } from 'vitest'
// @ts-expect-error — module JS sans types, volontairement : il est partagé avec `build.mjs`.
import { liensDeLaRecette, rapprocherEtape } from './lien-etape-ingredient.mjs'

type Aliment = {
  id: string
  nom: string
  groupe?: string
  synonymes?: string[]
  fond_de_placard?: boolean
  quantite_figee?: boolean
}

const A = (id: string, nom: string, extra: Partial<Aliment> = {}): Aliment => ({ id, nom, ...extra })

/** Le fond de placard du catalogue réel : `sel_fin` et `poivre_noir` portent les deux drapeaux. */
const SEL = A('sel_fin', 'Sel', { groupe: 'condiments', fond_de_placard: true, quantite_figee: true })
const THYM = A('thym_seche', 'Thym séché', { groupe: 'condiments', fond_de_placard: true, quantite_figee: true })

function carte(...aliments: Aliment[]): Map<string, Aliment> {
  return new Map(aliments.map((a) => [a.id, a]))
}

function recette(ingredients: Aliment[], textes: string[]) {
  return {
    id: 'essai',
    ingredients: ingredients.map((a) => ({ food_id: a.id })),
    etapes: textes.map((texte, i) => ({ ordre: i + 1, texte })),
  }
}

/** Raccourci de lecture : `ids` de l'étape `ordre`. */
const ids = (liens: Map<number, { ids: string[] }>, ordre: number) => liens.get(ordre)!.ids
const origine = (liens: Map<number, { origine: string }>, ordre: number) => liens.get(ordre)!.origine

describe('un nom qui finit en -er/-ir/-re n’est pas un infinitif', () => {
  // ⛔ LE FAUX POSITIF LE PLUS CHER DU CATALOGUE : « la chair » déclenchait un héritage sur 8 étapes,
  // toutes des cuissons de poisson (« jusqu'à ce que LA CHAIR se détache de l'arête »). Le test
  // `estInfinitif` accepte tout mot de plus de trois lettres finissant en -re : « chair » passait, et
  // l'étape se voyait attribuer les ingrédients de la précédente.
  it('⛔ « la chair » ne fait pas hériter une étape de cuisson', () => {
    const bar = A('bar', 'Bar ou loup, cru', { groupe: 'poissons' })
    const citron = A('citron', 'Citron', { groupe: 'fruits' })
    const liens = liensDeLaRecette(
      recette(
        [bar, citron, SEL],
        [
          'Citronner et saler le bar.',
          'Enfourner jusqu’à ce que la chair se détache de l’arête.',
        ]
      ),
      carte(bar, citron, SEL)
    )
    expect(ids(liens, 2)).toEqual([])
    expect(origine(liens, 2)).toBe('derive')
  })

  it('⛔ « le sucre », « le centre », « l’autre » ne sont pas des pronoms non plus', () => {
    for (const phrase of [
      'Enfourner jusqu’à ce qu’une lame traverse — rôtir concentre le sucre.',
      'Cuire jusqu’à ce que le centre reste moelleux.',
      'Retourner d’un coup, puis cuire l’autre face de la même façon.',
    ]) {
      expect(rapprocherEtape(phrase, []).pronom, phrase).toBe(false)
    }
  })

  it('un vrai pronom reste reconnu — la liste d’exceptions ne désarme pas la règle', () => {
    for (const phrase of ['Les égoutter tête en bas.', 'Le couper en deux.', 'L’étaler sur un plat.']) {
      expect(rapprocherEtape(phrase, []).pronom, phrase).toBe(true)
    }
  })
})

describe('l’antécédent d’un pronom n’est jamais un assaisonnement', () => {
  // ⛔ `artichauts_vinaigrette` : l'étape 2 dit « LES plonger dans une eau salée et citronnée ». La
  // dérivation y attrape `sel_fin` et `citron` PAR LE VERBE, ces deux-là devenaient l'antécédent, et
  // l'étape 4 (« LES égoutter ») se voyait attribuer citron + sel au lieu des artichauts.
  it('⛔ un ingrédient attrapé par un verbe ne devient pas l’antécédent', () => {
    const artichaut = A('artichaut', 'Artichaut, cru', { groupe: 'légumes' })
    const citron = A('citron', 'Citron', { groupe: 'fruits' })
    const liens = liensDeLaRecette(
      recette(
        [artichaut, citron, SEL],
        [
          'Casser la queue des artichauts à la main.',
          'Les plonger dans une grande casserole d’eau bouillante salée et citronnée.',
          'Cuire jusqu’à ce qu’une feuille de la base se détache.',
          'Les égoutter tête en bas.',
        ]
      ),
      carte(artichaut, citron, SEL)
    )
    // L'étape 2 emploie bel et bien le citron et le sel : le lien n'est pas amputé.
    expect(ids(liens, 2).sort()).toEqual(['citron', 'sel_fin'])
    // Mais « Les » de l'étape 4, ce sont les artichauts.
    expect(ids(liens, 4)).toEqual(['artichaut'])
    expect(origine(liens, 4)).toBe('herite')
  })

  // ⛔ `betteraves_roties_chevre` : l'étape 2 nomme le thym et le sel DIRECTEMENT (« avec un peu de
  // sel et de thym »), pas par un verbe. Filtrer les seuls verbes ne suffisait pas — c'est le fond de
  // placard qu'il faut écarter : on n'enveloppe pas « le thym », on enveloppe les betteraves.
  it('⛔ un fond de placard nommé directement ne devient pas l’antécédent non plus', () => {
    const betterave = A('betterave', 'Betterave rouge, crue', { groupe: 'légumes' })
    const liens = liensDeLaRecette(
      recette(
        [betterave, THYM, SEL],
        [
          'Brosser les betteraves sans les peler.',
          'Les envelopper dans du papier cuisson avec un peu de sel et de thym.',
          'Les peler encore chaudes, puis les couper en quartiers.',
        ]
      ),
      carte(betterave, THYM, SEL)
    )
    expect(ids(liens, 2).sort()).toEqual(['sel_fin', 'thym_seche'])
    expect(ids(liens, 3)).toEqual(['betterave'])
  })

  // Le garde-fou dans l'autre sens : sans lui, filtrer l'antécédent ferait traîner le premier
  // ingrédient de la recette sur toutes les étapes suivantes.
  it('un VRAI ingrédient nommé dans une étape à pronom devient bien le nouvel antécédent', () => {
    const asperge = A('asperge_verte', 'Asperge verte, crue', { groupe: 'légumes' })
    const oeuf = A('oeuf', 'Œuf de poule, entier, cru', { groupe: 'œufs' })
    const liens = liensDeLaRecette(
      recette(
        [asperge, oeuf],
        [
          'Casser la base ligneuse de chaque asperge.',
          'Cuire les œufs durs, les écaler et les écraser à la fourchette.',
          'Les répartir sur le plat.',
        ]
      ),
      carte(asperge, oeuf)
    )
    expect(ids(liens, 3)).toEqual(['oeuf'])
  })
})

describe('les invariants d’origine, inchangés', () => {
  // Acquis de la décision 60 : une chaîne d'approximations n'est plus une donnée.
  it('on n’hérite jamais d’un héritage — deux pronoms d’affilée perdent la référence', () => {
    const brocoli = A('brocoli', 'Brocoli, cru', { groupe: 'légumes' })
    const liens = liensDeLaRecette(
      recette([brocoli], ['Détailler le brocoli en bouquets.', 'Les blanchir trois minutes.', 'Les égoutter.']),
      carte(brocoli)
    )
    expect(ids(liens, 2)).toEqual(['brocoli'])
    expect(origine(liens, 2)).toBe('herite')
    expect(ids(liens, 3)).toEqual([])
  })

  it('`food_ids` déclaré à la main l’emporte, et fait antécédent sans condition', () => {
    const artichaut = A('artichaut', 'Artichaut, cru', { groupe: 'légumes' })
    const base = recette([artichaut, SEL], ['Saler l’eau.', 'Les égoutter.'])
    const forcee = { ...base, etapes: [{ ...base.etapes[0], food_ids: ['artichaut'] }, base.etapes[1]] }
    const liens = liensDeLaRecette(forcee, carte(artichaut, SEL))
    expect(origine(liens, 1)).toBe('declare')
    expect(ids(liens, 2)).toEqual(['artichaut'])
  })
})

describe('une racine de verbe n’est pas un préfixe de nom', () => {
  // Mesuré sur le catalogue le 2026-08-08 : la racine « sal » attrapait `saladier`×10,
  // `salade`×4 et `salsifis`×1 ; « poivr » attrapait `poivron`×22 et `poivrons`×13 ;
  // « vinaigr » attrapait `vinaigrette`×17 ; « gratin » attrapait le NOM `gratin`×3.
  const HUILE = A('huile_olive', "Huile d'olive", { groupe: 'matières grasses' })
  const POIVRE = A('poivre_noir', 'Poivre noir', { groupe: 'condiments', fond_de_placard: true })
  const VINAIGRE = A('vinaigre_vin_rouge', 'Vinaigre de vin rouge', { groupe: 'condiments' })
  const EMMENTAL = A('fromage_emmental_rape', 'Emmental râpé', { groupe: 'lait et produits laitiers' })
  const CITRON = A('citron', 'Citron, pulpe, cru', { groupe: 'fruits' })

  it('« la vinaigrette » n’est pas « vinaigrer » — c’est la préparation, pas l’ingrédient', () => {
    const liens = liensDeLaRecette(
      recette([VINAIGRE], ['Verser la vinaigrette et mélanger.']),
      carte(VINAIGRE)
    )
    expect(ids(liens, 1)).toEqual([])
  })

  it('« un plat à gratin » n’est pas « gratiner »', () => {
    const liens = liensDeLaRecette(
      recette([EMMENTAL], ['Étaler la viande au fond d’un plat à gratin.']),
      carte(EMMENTAL)
    )
    expect(ids(liens, 1)).toEqual([])
  })

  it('« un saladier » et « une salade » ne salent rien', () => {
    const liens = liensDeLaRecette(
      recette([SEL], ['Verser la salade dans un saladier.']),
      carte(SEL)
    )
    expect(ids(liens, 1)).toEqual([])
  })

  it('« les poivrons » ne sont pas du poivre', () => {
    const liens = liensDeLaRecette(
      recette([POIVRE], ['Émincer les poivrons en lanières.']),
      carte(POIVRE)
    )
    expect(ids(liens, 1)).toEqual([])
  })

  it('le verbe, lui, continue de désigner son ingrédient — infinitif, participe, gérondif', () => {
    for (const texte of ['Saler l’eau.', 'Poser dans une poêle huilée.', 'Terminer en citronnant.']) {
      const liens = liensDeLaRecette(recette([SEL, HUILE, CITRON], [texte]), carte(SEL, HUILE, CITRON))
      expect(ids(liens, 1).length, texte).toBe(1)
    }
  })
})
