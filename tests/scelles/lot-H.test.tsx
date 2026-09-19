// @vitest-environment jsdom
//
// tests/scelles/lot-H.test.tsx — l'examen du lot H : « la quantité injectée mange le nom de
// l'aliment ». Écrit depuis le « Fini quand » de docs/CONCEPTION_RETOURS_APK.md, AVANT la première
// ligne de code.
//
// CE QUE CE FICHIER MESURE, ET POURQUOI DE CETTE FAÇON :
//
// ⭐ LE DÉFAUT EXISTE AVANT LE LOT E, ET C'EST POUR ÇA QUE CE FICHIER EXISTE. La clause 8 de
//    `lot-E.test.tsx` mesure déjà « un mot de la recette ne disparaît pas de la phrase » — mais elle
//    a dû s'accorder une exemption pour rester verte : elle laisse passer un mot avalé dès qu'il
//    appartient au VOCABULAIRE de l'aliment. « Colorer les cuisses de poulet » → « Colorer
//    4 cuisses » y passe, puisque `poulet` est un mot de `cuisse_poulet`. Ce fichier retire
//    l'exemption, et rien d'autre : un mot ne s'efface que s'il est écrit dans le LIBELLÉ qui a pris
//    sa place.
//
// ⭐ LE BALAYAGE PASSE PAR LE MODULE PARTAGÉ, PAS PAR LES DEUX ÉCRANS MONTÉS, ET C'EST UN CHOIX DE
//    COÛT ASSUMÉ. `lot-E.test.tsx` monte les 339 recettes deux fois et coûte 147 s à lui seul ; un
//    second balayage monté aurait doublé la suite une fois de plus pour relire la même phrase.
//    `preparerTexteEtape` est l'unique fabrique de la phrase des DEUX écrans — la clause 6 monte
//    deux recettes nommées et relit ce qu'elles affichent vraiment, ce qui rattache le balayage à
//    l'écran sans le refaire 339 fois.
//
// ⭐ DEUX CONFIGURATIONS, PARCE QUE LE LOT E EN A CRÉÉ UNE SECONDE. La fiche injecte tous les
//    ingrédients de l'étape ; le mode cuisine ne lui passe que les PREMIÈRES mentions. La liste
//    reçue décide des conflits de vocabulaire, donc les deux ne perdent pas les mêmes mots : 31 d'un
//    côté, 20 de l'autre au relevé du 2026-09-17. Les clauses 1 et 2 les mesurent séparément.
//
// ⭐ LA RÉPARATION EST TRANCHÉE, ET LES CLAUSES 4 ET 5 L'ENCADRENT DES DEUX CÔTÉS. Décision du
//    2026-09-17 : ON GARDE LE NOM — « colorer 4 cuisses DE POULET dans la cocotte ». L'autre
//    réparation recevable, renoncer à l'injection et laisser la quantité repartir en badge, est
//    écartée : elle rendrait au badge ce que le lot E vient de poser dans la phrase, et ferait
//    changer de canal une trentaine de couples, ce que trois clauses scellées du lot E lisent.
//
// ⛔ « NE PLUS RIEN INJECTER » SATISFAIT LA CLAUSE 1 EN TROIS LIGNES, ET LA CLAUSE 4 EST CE QUI LA
//    FERME. Elle compte les couples (étape, ingrédient) réellement injectés et les rapporte aux
//    couples NOMMABLES — libellé commençant par un nombre et aliment nommé dans le texte — dénombrés
//    depuis le catalogue sans regarder ce que le code fait. C'est la même parade que la clause 1 du
//    lot E : un attendu recalculé, jamais écrit. Ses planchers sont SERRÉS PAR LA DÉCISION : garder
//    le nom ne retire l'injection d'aucun couple, donc le taux du jour doit se retrouver intact.
//
// ⛔ RECOLLER LE NOM EST LA RÉPARATION ; LE RECOLLER QUAND LE LIBELLÉ LE PORTE DÉJÀ EST LA TRICHE, ET
//    LA CLAUSE 5 LA FERME. Ajouter « de <nom> » sans condition rendrait « 2 poivrons DE POIVRON
//    rouge » — la famille du « 1 chou-fleur de chou-fleur » payé le 2026-08-08, documentée dans
//    `ui/texte-etape.ts`. Le critère à écrire n'est pas « le libellé nomme-t-il l'aliment » mais
//    « le libellé couvre-t-il les mots qu'on s'apprête à effacer ».
//
// ⚠️ AUCUN COMPTE ABSOLU DU CATALOGUE N'EST SCELLÉ (leçon de `retour-5c`). Ni « 339 recettes », ni
//    « 2 187 nommables » : les clauses recalculent leur attendu à l'exécution. Les nombres du
//    « Fini quand » datent le relevé, ils ne sont pas une clause. Les SEULS nombres scellés ici sont
//    les deux taux planchers (0,90 et 0,68), et ils sont un plancher contre un dénominateur
//    recalculé, pas une mesure — la forme admise par `retour-5d` (plancher 0,9).
//
// ⚠️ QUATRE RECETTES SONT NOMMÉES EN DUR (clause 3), et c'est un repère, pas un compte. Si l'une
//    disparaît du catalogue ou si sa phrase est réécrite, la clause lève en le disant au lieu de
//    passer en silence — le contraire d'un test qui s'éteint tout seul.
//
// ⚠️ CE QUE CE FICHIER NE SAIT PAS VOIR : un nom recollé une seule fois là où le libellé le portait
//    déjà (« 2 poivrons de poivron rouge » compte `poivron` deux fois au texte + libellé, donc la
//    clause 5 le laisse passer). La lecture à l'œil des étapes touchées reste due.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Recipe, RecipeStep } from '../../app/src/engine/domain/index.js'
import {
  catalogueDeTest,
  confianceDeTest,
  reinitialiserBase,
  sessionDeTest,
} from '../../app/src/ui/test-socle.js'
import { preparerTexteEtape } from '../../app/src/ui/ingredients-recette.js'
import { formesDeLAliment } from '../../app/src/ui/texte-etape.js'

vi.mock('../../app/src/ui/catalog-source.js', () => ({
  chargerCatalogue: () => Promise.resolve(catalogueDeTest()),
  chargerConfiance: () => Promise.resolve(confianceDeTest()),
}))
vi.mock('../../app/src/ui/user-source.js', () => ({
  ouvrirUserDb: () => Promise.resolve(sessionDeTest()),
  surErreurDePersistance: () => undefined,
  octetsDeLaBase: vi.fn(),
  remplacerLeFichier: vi.fn(),
  verifierSauvegarde: vi.fn(),
}))

// --- Lecture du catalogue réel --------------------------------------------------------------------

const recettes = (): readonly Recipe[] =>
  [...catalogueDeTest().recipes.values()].sort((a, b) =>
    (a.id as string).localeCompare(b.id as string)
  )

const gestes = (recette: Recipe): readonly RecipeStep[] =>
  recette.etapes.filter((e) => e.nature === 'geste')

const libellesDe = (recette: Recipe): ReadonlyMap<string, string> => {
  const parFoodId = new Map<string, string>()
  for (const i of recette.ingredients) parFoodId.set(i.foodId as string, i.uniteAffichage)
  return parFoodId
}

/** Le premier rang (parmi les gestes) où chaque ingrédient est employé — la règle du lot E. */
function premieresMentionsDe(recette: Recipe): ReadonlyMap<string, number> {
  const rangs = new Map<string, number>()
  gestes(recette).forEach((etape, rang) => {
    for (const f of etape.foodIds) if (!rangs.has(f as string)) rangs.set(f as string, rang)
  })
  return rangs
}

// --- Le vocabulaire de la mesure ------------------------------------------------------------------

/**
 * Un texte réduit à ses lettres nues : la recette écrit « comté », le catalogue nomme `comte`.
 */
const grainDe = (texte: string): string =>
  texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')

/**
 * Les mots PORTEURS d'un texte : ceux dont la disparition se verrait. Pluriel replié, 5 lettres au
 * moins — en dessous vivent les déterminants que l'injection a le DROIT de remplacer.
 */
const motsPorteurs = (texte: string): readonly string[] =>
  grainDe(texte)
    .split(' ')
    .map((mot) => mot.replace(/[sx]$/, ''))
    .filter((mot) => mot.length >= 5)

/**
 * Le seul déterminant d'au moins 5 lettres que l'accord a le droit d'avaler : « Fendre CHAQUE
 * banane » + « 4 bananes » → « Fendre les 4 bananes ». Règle documentée dans `ui/texte-etape.ts`.
 */
const DETERMINANTS_AVALES = new Set(['chaque'])

/**
 * La fenêtre de la clause 5 : combien de mots après la quantité on regarde pour voir une redite.
 *
 * Trois. « 1 oignon **d'oignon** » est à deux mots, « 50 g fondu **de beurre fondu** » à trois ;
 * « 8 tranches de baguette **en tranches** » est à quatre et reste permis, parce que ce n'est pas
 * une redite mais un second emploi du mot.
 */
const MOTS_DE_PROXIMITE = 3

/**
 * La fenêtre AMONT de la clause 8 : combien de mots avant la quantité on regarde.
 *
 * Un seul. Mesuré sur les 1 545 gestes : à un mot, zéro faute ; à deux, « ajouter l'huile de SÉSAME
 * et 2 cuillères à soupe [de graines de sésame] » rougit, et c'est une énumération légitime — deux
 * aliments voisins qui partagent un mot, pas un nom recollé contre sa propre quantité.
 */
const MOTS_AVANT_LA_QUANTITE = 1

/** Le libellé porte-t-il un nombre en tête ? Même ancrage que `ui/texte-etape.ts`. */
const COMMENCE_PAR_UN_NOMBRE = /^\s*(?:\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?)/

// --- Ce que le module écrit, pour une étape --------------------------------------------------------

interface Injection {
  /** La phrase affichée, segments recollés. */
  readonly phrase: string
  /**
   * Les segments tels que l'écran les rend : `quantite` est ce qui part en `<strong>`, et il porte
   * le `foodId` qu'il quantifie — c'est ce qui permet à la clause 8 de nommer l'aliment attendu.
   */
  readonly segments: readonly {
    readonly type: string
    readonly contenu: string
    readonly foodId?: string
  }[]
  /** Les libellés réellement posés DANS la phrase. */
  readonly libellesPoses: readonly string[]
  readonly poses: number
}

/**
 * La phrase d'une étape telle que les deux écrans la fabriquent.
 *
 * ⚠️ `facteur: 1` ET `quantites` VIDE : c'est l'affichage aux portions de la recette, celui que les
 * deux écrans donnent à l'ouverture. Le repli sur `quantiteG` est celui du composant.
 */
function injecter(recette: Recipe, etape: RecipeStep, foodIds: readonly string[]): Injection {
  const catalogue = catalogueDeTest()
  const rendu = preparerTexteEtape({
    texte: etape.texte,
    ingredients: recette.ingredients,
    foodIds,
    quantites: new Map<string, number>(),
    facteur: 1,
    formesAliment: (foodId) => formesDeLAliment(catalogue.foods.get(foodId as never), foodId),
    estQuantiteFigee: (foodId) => catalogue.foods.get(foodId as never)?.quantiteFigee === true,
  })
  const parFoodId = libellesDe(recette)
  return {
    phrase: rendu.segments.map((s) => s.contenu).join(''),
    segments: rendu.segments,
    libellesPoses: [...rendu.injectes].map((f) => parFoodId.get(f as string) ?? ''),
    poses: rendu.injectes.size,
  }
}

/** Les ingrédients que l'étape passe à l'injection, dans les deux configurations. */
type Configuration = 'fiche' | 'cuisine'

function aInjecter(recette: Recipe, config: Configuration): readonly (readonly string[])[] {
  const premieres = premieresMentionsDe(recette)
  return gestes(recette).map((etape, rang) => {
    const tous = [...etape.foodIds].map((f) => f as string)
    return config === 'fiche' ? tous : tous.filter((f) => premieres.get(f) === rang)
  })
}

/**
 * Les mots de la recette que la phrase a perdus, pour une étape.
 *
 * Un mot n'a le droit de disparaître que s'il est écrit dans l'un des libellés POSÉS dans cette
 * phrase — le libellé est la seule chose qui ait remplacé quoi que ce soit.
 */
function motsPerdus(texte: string, injection: Injection): readonly string[] {
  const rendue = grainDe(injection.phrase)
  const libelles = grainDe(injection.libellesPoses.join(' '))
  const perdus: string[] = []
  for (const mot of motsPorteurs(texte)) {
    if (DETERMINANTS_AVALES.has(mot)) continue
    if (rendue.includes(mot) || libelles.includes(mot)) continue
    perdus.push(mot)
  }
  return perdus
}

/** Les mots porteurs par lesquels le catalogue sait nommer un aliment. */
function motsDeLAliment(foodId: string): ReadonlySet<string> {
  const catalogue = catalogueDeTest()
  const formes = formesDeLAliment(catalogue.foods.get(foodId as never), foodId)
  return new Set(motsPorteurs(formes.join(' ')))
}

/** Le balayage d'une configuration : les fautes, et le nombre de mots réellement relus. */
function balayer(config: Configuration): { fautes: readonly string[]; relus: number } {
  const fautes: string[] = []
  let relus = 0
  for (const recette of recettes()) {
    const listes = aInjecter(recette, config)
    gestes(recette).forEach((etape, rang) => {
      const injection = injecter(recette, etape, listes[rang] ?? [])
      relus += motsPorteurs(etape.texte).filter((m) => !DETERMINANTS_AVALES.has(m)).length
      for (const mot of motsPerdus(etape.texte, injection)) {
        fautes.push(
          `${recette.id as string} · étape ${rang + 1} : le mot « ${mot} » a disparu de la phrase` +
            `\n    recette : ${etape.texte.slice(0, 140)}` +
            `\n    écran   : ${injection.phrase.slice(0, 140)}`
        )
      }
    })
  }
  return { fautes, relus }
}

const vingtPremieres = (fautes: readonly string[]): string => fautes.slice(0, 20).join('\n')

// --- Lecture du rendu, pour la clause 6 ------------------------------------------------------------

const normaliser = (texte: string | null): string => (texte ?? '').replace(/\s+/g, ' ').trim()
const echapper = (texte: string): string => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Le texte d'un élément, nœud à nœud, JOINT PAR UNE ESPACE.
 *
 * ⛔ PAS `textContent`, ET C'EST LE PIÈGE PAYÉ QUATRE FOIS SUR CE PROJET : il recolle les frères sans
 * rien insérer — « T55 » suivi de « 100 g » devient « T55100 g ».
 */
function texteLisible(element: Element): string {
  const marcheur = element.ownerDocument.createTreeWalker(element, 4 /* NodeFilter.SHOW_TEXT */)
  const morceaux: string[] = []
  for (let n = marcheur.nextNode(); n !== null; n = marcheur.nextNode()) {
    morceaux.push(n.nodeValue ?? '')
  }
  return normaliser(morceaux.join(' '))
}

/** Ce qui est écrit DANS la phrase : les `<strong>`, seul marqueur de la quantité injectée. */
const quantitesDeLaPhrase = (element: Element): string =>
  normaliser([...element.querySelectorAll('strong')].map(texteLisible).join(' '))

/** Combien de fois un libellé est écrit, en séparant « 60 g » de « 160 g ». */
const compter = (texte: string, libelle: string): number =>
  (texte.match(new RegExp(`(?<!\\d)${echapper(libelle)}(?!\\d)`, 'g')) ?? []).length

const bouton = (libelle: string): HTMLButtonElement | null =>
  screen.queryByText(libelle)?.closest('button') ?? null

const utilisable = (b: HTMLButtonElement | null): b is HTMLButtonElement =>
  b !== null && !b.disabled

/** La carte d'étape du mode cuisine : sa phrase entière, ses quantités mises en valeur, son tout. */
function carteDEtape(container: HTMLElement): { phrase: string; fortes: string; tout: string } {
  for (const section of container.querySelectorAll('section')) {
    if (!/Étape \d+ sur \d+/.test(section.textContent ?? '')) continue
    const enTete = [...section.querySelectorAll('p')].find((p) =>
      /^Étape \d+ sur \d+$/.test(normaliser(p.textContent))
    )
    if (enTete === undefined) throw new Error('l’en-tête « Étape n sur m » a changé de forme')
    const p = enTete.nextElementSibling
    if (p === null || p.tagName !== 'P') {
      throw new Error('la phrase de l’étape n’est plus un <p> à l’endroit attendu')
    }
    return { phrase: texteLisible(p), fortes: quantitesDeLaPhrase(p), tout: texteLisible(section) }
  }
  throw new Error('aucune carte « Étape n sur m » à l’écran — le mode cuisine n’a pas monté')
}

/** Chaque étape du mode cuisine, de la première à la dernière, après rembobinage. */
function parcourir(container: HTMLElement): readonly { phrase: string; fortes: string; tout: string }[] {
  for (let garde = 0; garde < 200 && utilisable(bouton('← Étape précédente')); garde++) {
    fireEvent.click(bouton('← Étape précédente') as HTMLButtonElement)
  }
  const cartes = []
  for (let garde = 0; garde < 200; garde++) {
    cartes.push(carteDEtape(container))
    const suivant = bouton('Étape suivante →')
    if (!utilisable(suivant)) break
    fireEvent.click(suivant)
  }
  return cartes
}

/**
 * Les recettes montées par la clause 6 : des repères nommés, pas un échantillon.
 *
 * ⚠️ DEUX, LÀ OÙ LA CLAUSE 3 EN NOMME QUATRE, ET C'EST UNE QUESTION DE PRIX. Monter un écran coûte
 * ~0,3 s contre ~0,4 ms par le module : le lot E paie 147 s pour avoir monté les 339 recettes. Deux
 * suffisent à établir que l'écran écrit bien ce que le module fabrique ; les quatre motifs du défaut
 * sont couverts par la clause 3, qui n'a pas besoin du DOM pour ça.
 */
const MONTEES = ['poulet_basquaise', 'quiche_lorraine'] as const

/** Les témoins de la clause 3 : le mot que la phrase perd aujourd'hui, recette par recette. */
const TEMOINS: readonly { readonly recette: string; readonly mot: string }[] = [
  { recette: 'poulet_basquaise', mot: 'poulet' },
  { recette: 'quiche_lorraine', mot: 'brisee' },
  { recette: 'riz_au_lait_soja_vanille', mot: 'vanille' },
  { recette: 'veloute_butternut_curry', mot: 'courge' },
]

function recetteNommee(id: string): Recipe {
  const recette = recettes().find((r) => (r.id as string) === id)
  if (recette === undefined) {
    throw new Error(`la recette repère « ${id} » n’est plus au catalogue — la clause est à réécrire`)
  }
  return recette
}

beforeEach(() => {
  reinitialiserBase()
})

afterEach(() => {
  cleanup()
})

describe('lot H — la quantité injectée ne mange plus le nom de l’aliment', () => {
  // ⛔ LE CŒUR DU LOT. Configuration fiche : l'étape passe TOUS ses ingrédients à l'injection.
  it('1 — sur la fiche, aucun mot de la recette ne disparaît de la phrase', () => {
    const { fautes, relus } = balayer('fiche')
    expect(relus, 'aucun mot porteur relu : le balayage n’a rien vu').toBeGreaterThan(1_000)
    expect(vingtPremieres(fautes), `${fautes.length} mot(s) perdu(s)`).toBe('')
  })

  // ⛔ LA MÊME MESURE AVEC LA LISTE DU LOT E. Retirer les ingrédients déjà dits change le vocabulaire
  // de désambiguïsation, donc les mots perdus ne sont pas les mêmes : c'est une seconde mesure, pas
  // une redite de la clause 1.
  it('2 — au fourneau, aucun mot de la recette ne disparaît de la phrase', () => {
    const { fautes, relus } = balayer('cuisine')
    expect(relus, 'aucun mot porteur relu : le balayage n’a rien vu').toBeGreaterThan(1_000)
    expect(vingtPremieres(fautes), `${fautes.length} mot(s) perdu(s)`).toBe('')
  })

  // ⛔ QUATRE ÉTAPES NOMMÉES, UNE PAR MOTIF DU DÉFAUT : le libellé qui compte une autre unité que
  // l'aliment (`4 cuisses` pour le poulet), la préparation nommée par sa forme (`1 pâte` pour la
  // pâte brisée), l'épice nommée par son support (`1 gousse` pour la vanille), l'aliment nommé par
  // sa variété (`1 butternut` pour la courge). Elles lèvent si la recette ou la phrase change.
  it('3 — les quatre étapes témoins gardent le mot que la recette avait choisi', () => {
    const fautes: string[] = []
    for (const temoin of TEMOINS) {
      const recette = recetteNommee(temoin.recette)
      const listes = aInjecter(recette, 'cuisine')
      const etapes = gestes(recette)
      const concernees = etapes.filter((e) => motsPorteurs(e.texte).includes(temoin.mot))
      if (concernees.length === 0) {
        throw new Error(
          `aucune étape de « ${temoin.recette} » n’écrit « ${temoin.mot} » — le témoin est à réécrire`
        )
      }
      etapes.forEach((etape, rang) => {
        if (!motsPorteurs(etape.texte).includes(temoin.mot)) return
        const injection = injecter(recette, etape, listes[rang] ?? [])
        if (motsPerdus(etape.texte, injection).includes(temoin.mot)) {
          fautes.push(
            `${temoin.recette} · étape ${rang + 1} : « ${temoin.mot} » manque` +
              `\n    écran : ${injection.phrase.slice(0, 140)}`
          )
        }
      })
    }
    expect(vingtPremieres(fautes), `${fautes.length} témoin(s) muet(s)`).toBe('')
  })

  // ⛔ LA CLAUSE QUI REFUSE « NE PLUS RIEN INJECTER ». Le dénominateur est recalculé depuis le
  // catalogue : un couple est NOMMABLE quand le libellé commence par un nombre et que le texte de
  // l'étape écrit l'un des mots de l'aliment. Les deux taux sont des PLANCHERS, pas des mesures —
  // relevé du 2026-09-17 : 90,7 % (fiche) et 68,2 % (cuisine).
  // ⭐ SERRÉS PAR LA DÉCISION DU 2026-09-17 : la réparation retenue (garder le nom) ne retire
  // l'injection d'aucun couple, donc le taux du jour doit se retrouver intact. Marge restante :
  // ~15 couples sur la fiche, ~5 au fourneau. Une réparation qui renoncerait à l'injection les
  // dépasse au premier couple rendu au badge.
  // GARDE DE PÉRIMÈTRE — verte aujourd'hui.
  it('4 — la quantité continue d’être dite dans la phrase', () => {
    const catalogue = catalogueDeTest()
    let nommables = 0
    const poses = { fiche: 0, cuisine: 0 }

    for (const recette of recettes()) {
      const parFoodId = libellesDe(recette)
      const listes = { fiche: aInjecter(recette, 'fiche'), cuisine: aInjecter(recette, 'cuisine') }
      gestes(recette).forEach((etape, rang) => {
        const motsDuTexte = grainDe(etape.texte)
          .split(' ')
          .map((m) => m.replace(/[sx]$/, ''))
        for (const f of etape.foodIds) {
          const foodId = f as string
          if (!COMMENCE_PAR_UN_NOMBRE.test(parFoodId.get(foodId) ?? '')) continue
          const formes = formesDeLAliment(catalogue.foods.get(foodId as never), foodId)
          // ⚠️ 4 LETTRES ICI, 5 DANS `motsPorteurs`, ET CE N'EST PAS UNE ÉTOURDERIE. Là-bas on cherche
          // les mots dont la disparition se verrait ; ici on cherche à reconnaître un aliment sous
          // le nom que la recette lui donne, et `chou`, `thon`, `soja`, `riz` sont des aliments.
          const mots = grainDe(formes.join(' '))
            .split(' ')
            .map((m) => m.replace(/[sx]$/, ''))
            .filter((m) => m.length >= 4)
          if (mots.some((m) => motsDuTexte.includes(m))) nommables += 1
        }
        poses.fiche += injecter(recette, etape, listes.fiche[rang] ?? []).poses
        poses.cuisine += injecter(recette, etape, listes.cuisine[rang] ?? []).poses
      })
    }

    expect(nommables, 'aucun couple nommable : le dénominateur est vide').toBeGreaterThan(500)
    expect(
      poses.fiche / nommables,
      `fiche : ${poses.fiche} couples injectés sur ${nommables} nommables`
    ).toBeGreaterThanOrEqual(0.9)
    expect(
      poses.cuisine / nommables,
      `cuisine : ${poses.cuisine} couples injectés sur ${nommables} nommables`
    ).toBeGreaterThanOrEqual(0.68)
  })

  // ⛔ LA CLAUSE QUI REFUSE DE RECOLLER UN MOT QUE LA QUANTITÉ VIENT D'ÉCRIRE. Aucun des trois mots
  // qui suivent immédiatement un segment de quantité ne répète un mot porteur de ce segment.
  //
  // ⛔ C'EST UNE MESURE DE PROXIMITÉ, ET DEUX ÉCRITURES PRÉCÉDENTES SONT MORTES ICI (2026-09-17).
  // (1) « le mot n'est pas écrit plus de fois que dans le texte PLUS les libellés » : cette addition
  //     finançait la triche qu'elle prétendait interdire — « Émincer l'oignon » + « 1 oignon »
  //     autorisait `oignon` deux fois, donc « Émincer 1 oignon D'OIGNON » passait, sous garde verte.
  // (2) « … que le MAXIMUM des deux » : trop strict, 34 fautes dont la plupart légitimes — « couper
  //     8 tranches de baguette EN TRANCHES » emploie ailleurs un mot que le libellé apporte, sans
  //     l'avoir effacé nulle part. Un budget global ne sait pas distinguer les deux.
  // Le bégaiement, lui, est LOCAL : « 1 chou-fleur de chou-fleur » (2026-08-08) colle sa redite
  // immédiatement derrière la quantité. Trois mots suffisent à l'attraper et laissent passer le
  // réemploi à distance — « à la cuillère … 2 cuillères à soupe » est à onze mots.
  //
  // ⚠️ CETTE CLAUSE N'EST PAS UNE GARDE : ELLE ROUGIT AUJOURD'HUI, et ce qu'elle montre appartient
  // au lot. « Incorporer 50 g FONDU de beurre FONDU », « Ajouter 120 g FROID de beurre FROID » : le
  // libellé porte un qualificatif que le nom recollé répète déjà. C'est la même famille que le mot
  // perdu des clauses 1 à 3, vue de l'autre côté — et c'est ce qui force la couverture à se calculer
  // MOT À MOT et non sur le groupe nominal entier.
  it('5 — la réparation ne bégaie pas', () => {
    const fautes: string[] = []

    for (const recette of recettes()) {
      for (const config of ['fiche', 'cuisine'] as const) {
        const listes = aInjecter(recette, config)
        gestes(recette).forEach((etape, rang) => {
          const injection = injecter(recette, etape, listes[rang] ?? [])
          injection.segments.forEach((segment, i) => {
            if (segment.type !== 'quantite') return
            const poses = new Set(motsPorteurs(segment.contenu))
            const suite = grainDe(
              injection.segments
                .slice(i + 1)
                .map((s) => s.contenu)
                .join(' ')
            )
              .split(' ')
              .filter((mot) => mot !== '')
              .slice(0, MOTS_DE_PROXIMITE)
              .map((mot) => mot.replace(/[sx]$/, ''))
            for (const mot of suite) {
              if (!poses.has(mot)) continue
              fautes.push(
                `${recette.id as string} · étape ${rang + 1} (${config}) : « ${segment.contenu}` +
                  `» est suivi de « ${mot} », qu'il écrit déjà` +
                  `\n    écran : ${injection.phrase.slice(0, 140)}`
              )
            }
          })
        })
      }
    }
    expect(vingtPremieres(fautes), `${fautes.length} bégaiement(s)`).toBe('')
  })

  // ⛔ LE BALAYAGE NE PROUVE RIEN SI L'ÉCRAN FABRIQUE SA PHRASE AILLEURS. Deux recettes nommées sont
  // montées en mode cuisine et relues : le même critère que la clause 1, mais lu dans le DOM, plus
  // l'invariant de la décision 60 — chaque quantité annoncée par l'étape est écrite une fois sur la
  // carte, phrase ou badge. Le second est vert aujourd'hui (lot E) : il est ici comme garde.
  it('6 — à l’écran, la phrase montée ne perd pas de mot et ne perd pas de quantité', async () => {
    const { Cuisine } = await import('../../app/src/ui/screens/cuisine.js')
    const fautes: string[] = []

    for (const id of MONTEES) {
      const recette = recetteNommee(id)
      const parFoodId = libellesDe(recette)
      const premieres = premieresMentionsDe(recette)

      reinitialiserBase()
      const vue = render(<Cuisine plats={[{ id, portions: null }]} />)
      await screen.findByRole('heading', { level: 1 })
      const cartes = parcourir(vue.container)
      vue.unmount()
      cleanup()

      const etapes = gestes(recette)
      if (cartes.length !== etapes.length) {
        throw new Error(`« ${id} » : ${cartes.length} carte(s) montée(s) pour ${etapes.length} geste(s)`)
      }

      etapes.forEach((etape, rang) => {
        const carte = cartes[rang]
        if (carte === undefined) return
        const rendue = grainDe(carte.phrase)
        const posees = grainDe(carte.fortes)
        for (const mot of motsPorteurs(etape.texte)) {
          if (DETERMINANTS_AVALES.has(mot)) continue
          if (rendue.includes(mot) || posees.includes(mot)) continue
          fautes.push(
            `${id} · étape ${rang + 1} : « ${mot} » manque à la phrase montée` +
              `\n    écran : ${carte.phrase.slice(0, 140)}`
          )
        }
        // Décision 60 : ce que l'étape annonce est écrit une fois, dans la phrase ou en badge.
        for (const f of etape.foodIds) {
          const foodId = f as string
          if (premieres.get(foodId) !== rang) continue
          const libelle = parFoodId.get(foodId)
          if (libelle === undefined) continue
          const ecrit = compter(carte.tout, libelle)
          if (ecrit < 1) {
            fautes.push(`${id} · étape ${rang + 1} : « ${libelle} » n’est écrit nulle part sur la carte`)
          }
        }
      })
    }
    expect(vingtPremieres(fautes), `${fautes.length} faute(s) à l’écran`).toBe('')
  })

  // ⛔ CETTE CLAUSE EXISTE PARCE QUE LES CLAUSES 1, 2, 3 ET 6 NE LISENT QUE LA PRÉSENCE D'UN MOT,
  // JAMAIS SA PLACE. Une implémentation qui laisse le mot disparaître de son groupe nominal puis le
  // recolle ailleurs — en bloc à la fin de la phrase, « … dans la cocotte (poulet) » — les passe
  // toutes les quatre. La réparation décidée le 2026-09-17 remet le nom À SA PLACE ou ne l'enlève
  // pas : dans les deux cas elle n'a le droit que d'EFFACER du texte d'origine, jamais d'en déplacer.
  //
  // D'où le critère, qui ne suppose rien de l'algorithme : la suite des mots porteurs qui restent
  // hors des libellés injectés doit être une SOUS-SUITE, dans l'ordre, des mots porteurs de la
  // recette. Effacer préserve l'ordre ; déménager ne le préserve pas.
  //
  // ⚠️ C'EST UNE GARDE : 0 faute sur 1 545 gestes aujourd'hui. Elle ne décrit pas un défaut à
  // réparer, elle interdit une façon de le réparer.
  it('7 — la réparation efface, elle ne déménage pas', () => {
    const fautes: string[] = []

    for (const recette of recettes()) {
      for (const config of ['fiche', 'cuisine'] as const) {
        const listes = aInjecter(recette, config)
        gestes(recette).forEach((etape, rang) => {
          const injection = injecter(recette, etape, listes[rang] ?? [])
          const restes = motsPorteurs(
            injection.segments
              .filter((s) => s.type === 'texte')
              .map((s) => s.contenu)
              .join(' ')
          )
          const origine = motsPorteurs(etape.texte)
          let lu = 0
          for (const mot of restes) {
            while (lu < origine.length && origine[lu] !== mot) lu += 1
            if (lu === origine.length) {
              fautes.push(
                `${recette.id as string} · étape ${rang + 1} (${config}) : « ${mot} » n’est plus à sa` +
                  ` place dans la phrase` +
                  `\n    recette : ${etape.texte.slice(0, 140)}` +
                  `\n    écran   : ${injection.phrase.slice(0, 140)}`
              )
              break
            }
            lu += 1
          }
        })
      }
    }
    expect(vingtPremieres(fautes), `${fautes.length} mot(s) déplacé(s)`).toBe('')
  })

  // ⛔ L'AUTRE MOITIÉ DE LA MÊME FAILLE : poser la quantité À CÔTÉ du nom au lieu de la poser À SA
  // PLACE. « Colorer le poulet 4 cuisses dans la cocotte » ne perd aucun mot (clauses 1, 2, 3, 6),
  // ne déplace aucun mot (clause 7), ne bégaie pas vers l'aval (clause 5, qui ne lit que ce qui SUIT
  // la quantité) — et reste illisible.
  //
  // Le segment `quantite` porte son `foodId` : on sait donc quel aliment il quantifie, et on peut
  // exiger que le mot qui le précède immédiatement ne soit pas un nom de CET aliment-là.
  //
  // ⚠️ L'EXCEPTION N'EST PAS DÉCORATIVE : un mot qui nomme aussi un AUTRE ingrédient de l'étape est
  // laissé passer. « 2 cuillères à soupe de concentré de TOMATE, 3 tomates concassées » écrit bien
  // « tomate » devant une quantité de tomate, mais ce mot appartient au concentré, déjà quantifié —
  // c'est une énumération, pas une redite. Sans cette exception, 1 faute de plus, et elle est fausse.
  //
  // ⚠️ C'EST UNE GARDE : 0 faute sur 1 545 gestes aujourd'hui.
  it('8 — la quantité n’est pas posée à côté du nom qu’elle devait remplacer', () => {
    const fautes: string[] = []

    for (const recette of recettes()) {
      for (const config of ['fiche', 'cuisine'] as const) {
        const listes = aInjecter(recette, config)
        gestes(recette).forEach((etape, rang) => {
          const injection = injecter(recette, etape, listes[rang] ?? [])
          const tous = [...etape.foodIds].map((f) => f as string)
          injection.segments.forEach((segment, i) => {
            if (segment.type !== 'quantite' || segment.foodId === undefined) return
            const sien = motsDeLAliment(segment.foodId)
            const autres = new Set<string>()
            for (const f of tous) {
              if (f === segment.foodId) continue
              for (const mot of motsDeLAliment(f)) autres.add(mot)
            }
            const avant = grainDe(
              injection.segments
                .slice(0, i)
                .filter((s) => s.type === 'texte')
                .map((s) => s.contenu)
                .join(' ')
            )
              .split(' ')
              .filter((mot) => mot !== '')
              .slice(-MOTS_AVANT_LA_QUANTITE)
              .map((mot) => mot.replace(/[sx]$/, ''))
            for (const mot of avant) {
              if (!sien.has(mot) || autres.has(mot)) continue
              fautes.push(
                `${recette.id as string} · étape ${rang + 1} (${config}) : « ${mot} » est écrit juste` +
                  ` devant « ${segment.contenu} », qui le quantifie` +
                  `\n    écran : ${injection.phrase.slice(0, 140)}`
              )
            }
          })
        })
      }
    }
    expect(vingtPremieres(fautes), `${fautes.length} nom(s) redit(s) devant sa quantité`).toBe('')
  })
})
