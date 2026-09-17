// @vitest-environment jsdom
//
// tests/scelles/lot-E.test.tsx — l'examen du lot E : « mode cuisine : une quantité dite une fois ».
// Écrit depuis le « Fini quand » de docs/CONCEPTION_RETOURS_APK.md, AVANT la première ligne de code.
//
// CE QUE CE FICHIER MESURE, ET POURQUOI DE CETTE FAÇON :
//
// ⭐ LE COMPTE ATTENDU EST RECALCULÉ RECETTE PAR RECETTE, JAMAIS ÉCRIT. Pour un libellé de quantité
//    donné, l'écran doit l'écrire exactement autant de fois qu'il y a d'ingrédients EMPLOYÉS qui le
//    portent — plus les fois où la recette l'écrit déjà dans sa propre prose. Les deux moitiés
//    comptent : « plus jamais deux fois » obtenu en n'écrivant plus rien du tout n'est pas le lot,
//    c'est une perte d'information. L'égalité stricte refuse les deux dérives d'un seul coup.
//
// ⭐ LE BALAYAGE COUVRE LE CATALOGUE ENTIER, ET C'EST CE QUI LE REND NON TRICHABLE. Une table
//    `{ recette → texte tout fait }` devient, sur 339 recettes et 1 545 étapes, le catalogue recopié
//    à la main ; une recette de plus la met en défaut. C'est la leçon du premier tour d'attaque du
//    lot C, où huit entrées en dur passaient cinq clauses sur un échantillon publié.
//
// ⛔ LE PREMIER TOUR D'ATTAQUE A SORTI UNE IMPLÉMENTATION FAUSSE, ET LES CLAUSES 6 ET 7 SONT CE QUI
//    LA FERME. L'attaque tenait en trois lignes : ne plus jamais injecter dans la phrase, laisser le
//    texte brut du YAML, et tout envoyer en badge sous l'étape, filtré sur le rang. Elle passait les
//    cinq premières clauses — le compte est juste, la place est juste, la fenêtre et la fiche ne
//    bougent pas — et rendait `ui/texte-etape.ts` mort pour l'écran cuisine. La faille : AUCUNE
//    clause ne lisait *où* dans le DOM la quantité est écrite, seulement *combien de fois* et *à
//    quel rang*. ➡️ La clause 6 mesure le CANAL, et elle le mesure sans écrire nulle part quel
//    canal est attendu : elle le lit sur la FICHE RECETTE, que la clause 4 tient inchangée.
//
// ⛔ LE SECOND TOUR D'ATTAQUE EN A SORTI UNE AUTRE, ET C'EST LA CLAUSE 8 QUI LA FERME. Celle-là ne
//    trichait même pas : elle appelait l'injection exactement comme la fiche, puis VIDAIT après coup
//    le segment des quantités déjà dites. Les sept autres clauses restaient vertes — compte, rang,
//    canal, aller-retour, tout collait — parce qu'aucune ne relisait la phrase contre le texte de la
//    recette. Or l'injection ne pose pas la quantité à côté du groupe nominal, elle le REMPLACE :
//    « Faire fondre l'oignon et les poivrons rouges » devenait « Faire fondre et dans ». ➡️ La
//    clause 8 exige qu'un mot porteur de la recette ne disparaisse de la phrase que si le libellé
//    qui l'a remplacé y est écrit. ⚠️ Sa référence est le YAML, JAMAIS la fiche : la fiche injecte
//    partout, donc elle a avalé le mot elle aussi, et la comparaison aurait exigé la phrase trouée.
//
// ⛔ LE PIÈGE DU `\b` S'EST PRÉSENTÉ UNE QUATRIÈME FOIS, SOUS SA FORME « CHIFFRE », ET LA SONDE L'A
//    ATTRAPÉ AVANT LE FILET. `textContent` colle les frères sans espace : l'écran donne
//    « …Farine de blé tendre T55100 g Sucre roux ». Le « 100 g » y est précédé d'un CHIFFRE, donc le
//    garde `(?<!\d)` — celui-là même que PIEGES.md recommande — le refusait. Cinq quantités bien
//    affichées étaient comptées absentes. ➡️ On ne lit donc PAS `textContent` : on parcourt les
//    nœuds texte et on les joint par une espace (`texteLisible`). Le garde sur les chiffres reste,
//    il sert au vrai cas (« 60 g » dans « 160 g »).
//
// ⛔ L'ÉTAPE COURANTE D'UNE CUISSON SURVIT À `reinitialiserBase()` DANS UN MÊME FICHIER. Le socle
//    n'est chargé qu'une fois ; un second montage de la même recette rouvre à la DERNIÈRE étape et
//    ne rend qu'une carte sur cinq. La clause 5 a été rouge pour cette raison-là avant de l'être
//    pour la bonne. ➡️ `parcourirLesEtapes` rembobine avant de lire, toujours.
//
// ⭐ DEUX MESURES INDÉPENDANTES DONNENT LE MÊME NOMBRE, ET C'EST CE QUI ATTESTE LE FILET. Hors écran,
//    par SQL sur `catalog.db` : 784 couples (étape, aliment) redits sur 3 001. À l'écran, par ce
//    balayage : 784 occurrences en surplus, 0 en manque. Les deux chemins n'ont rien en commun.
//
// ⚠️ AUCUN COMPTE ABSOLU DU CATALOGUE N'EST SCELLÉ (leçon de `retour-5c`). Ni « 339 recettes », ni
//    « 784 redites » : les clauses recalculent leur attendu depuis `catalogueDeTest()` à l'exécution.
//    Les nombres ci-dessus datent le relevé, ils ne sont pas une clause.
//    ⚠️ Un identifiant fait exception et est nommé en dur : `chakchouka`, pour la clause 5. Une
//    recette nommée est un repère, pas un compte — si elle disparaît, la clause lève en le disant.
//
// ⚠️ LA COLLISION DE SOUS-CHAÎNE ENTRE LIBELLÉS EST TRAITÉE PAR MASQUAGE, PAS PAR EXCLUSION.
//    Trois recettes sur 339 portent un libellé contenu dans un autre (« 120 g » dans
//    « 120 g froid »). Les compter du plus long au plus court, en effaçant au fur et à mesure ce qui
//    a déjà été compté, les traite sans retirer une seule recette du balayage.
//
// ⚠️ LA PROSE DES RECETTES CONTIENT PARFOIS UN LIBELLÉ. Trois occurrences au catalogue
//    (« quelques gouttes », « généreusement »). Elles sont AJOUTÉES à l'attendu, lues dans
//    `RecipeStep.texte` — le texte brut, celui que le YAML écrit et que rien n'injecte.
//
// ⚠️ CE QU'AUCUNE CLAUSE NE PEUT DIRE, ET IL FAUT LE SAVOIR EN CODANT. Quand DEUX ingrédients d'une
//    même recette portent le MÊME libellé (« 50 g » et « 50 g »), le texte affiché ne dit plus
//    duquel il parle : les clauses 2 et 6 les écartent (`attendu !== 1`), seule la clause 1 les
//    tient encore, et en compte agrégé. La discrimination se fait sur `foodId`, jamais sur le
//    libellé — c'est une exigence du « Fini quand » que le filet ne sait pas vérifier.
//
// ⚠️ CE QUE CE FICHIER NE MESURE PAS, DÉLIBÉRÉMENT : l'effet de bord du vocabulaire. Retirer un
//    ingrédient déjà dit lui retire son vocabulaire de désambiguïsation, ce qui POURRAIT déplacer un
//    autre ingrédient de la phrase vers le badge. Mesuré sur les 1 545 gestes : 0 cas. On ne scelle
//    pas une clause sur un ensemble vide — elle serait verte sans rien mesurer.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Recipe } from '../../app/src/engine/domain/index.js'
import {
  catalogueDeTest,
  confianceDeTest,
  reinitialiserBase,
  sessionDeTest,
} from '../../app/src/ui/test-socle.js'

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

/** La recette de référence de la clause 5 : 5 gestes, 10 ingrédients, 4 portions de base. */
const REFERENCE = 'chakchouka'

// --- Lecture du catalogue réel --------------------------------------------------------------------

const recettes = (): readonly Recipe[] =>
  [...catalogueDeTest().recipes.values()].sort((a, b) => (a.id as string).localeCompare(b.id))

const gestes = (recette: Recipe) => recette.etapes.filter((e) => e.nature === 'geste')

/** Les ingrédients que la recette EMPLOIE dans au moins une de ses étapes. */
function employes(recette: Recipe): ReadonlySet<string> {
  const ids = new Set<string>()
  for (const etape of gestes(recette)) for (const f of etape.foodIds) ids.add(f as string)
  return ids
}

/** Le premier rang (0-indexé, parmi les gestes) où chaque ingrédient employé apparaît. */
function premiereApparition(recette: Recipe): ReadonlyMap<string, number> {
  const rangs = new Map<string, number>()
  gestes(recette).forEach((etape, rang) => {
    for (const f of etape.foodIds) if (!rangs.has(f as string)) rangs.set(f as string, rang)
  })
  return rangs
}

/** Tous les libellés de quantité des ingrédients employés, avec leurs doublons. */
const libellesEmployes = (recette: Recipe): readonly string[] =>
  recette.ingredients
    .filter((i) => employes(recette).has(i.foodId as string))
    .map((i) => i.uniteAffichage)

/** La prose brute des gestes, celle du YAML — aucune quantité n'y a encore été posée. */
const proseBrute = (recette: Recipe): string =>
  normaliser(
    gestes(recette)
      .map((e) => e.texte)
      .join(' ')
  )

// --- Lecture du rendu -----------------------------------------------------------------------------

const normaliser = (texte: string | null): string => (texte ?? '').replace(/\s+/g, ' ').trim()
const echapper = (texte: string): string => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Le texte d'un élément, nœud à nœud, JOINT PAR UNE ESPACE.
 *
 * ⛔ PAS `textContent`, ET C'EST LE PIÈGE PAYÉ QUATRE FOIS SUR CE PROJET. Il recolle les frères sans
 * rien insérer : « T55 » suivi de « 100 g » devient « T55100 g », et tout garde posé sur les
 * chiffres tombe à côté. Joindre par une espace rend au DOM la séparation que l'œil voit à l'écran.
 */
function texteLisible(element: Element): string {
  const marcheur = element.ownerDocument.createTreeWalker(element, 4 /* NodeFilter.SHOW_TEXT */)
  const morceaux: string[] = []
  for (let n = marcheur.nextNode(); n !== null; n = marcheur.nextNode()) {
    morceaux.push(n.nodeValue ?? '')
  }
  return normaliser(morceaux.join(' '))
}

/**
 * Ce qui est écrit DANS LA PHRASE de l'étape, par opposition au badge posé dessous.
 *
 * ⚠️ `<strong>` EST LE MARQUEUR, ET IL EST SÉMANTIQUE, PAS COSMÉTIQUE. C'est le seul endroit de la
 * carte d'étape qui en porte un : la quantité injectée dans la phrase est mise en valeur parce que
 * c'est ce qu'on cherche des yeux les mains dans la farine. Le badge, lui, est une suite de
 * `<span>`. Aucune classe Tailwind n'est scellée ici — une classe se renomme, le sens de `<strong>`
 * non.
 */
const phraseDe = (element: Element): string =>
  normaliser([...element.querySelectorAll('strong')].map(texteLisible).join(' '))

/**
 * Combien de fois chaque libellé est écrit dans `texte`.
 *
 * Du plus long au plus court, en effaçant ce qui vient d'être compté : « 120 g froid » est consommé
 * avant qu'on cherche « 120 g », sinon le second compterait l'intérieur du premier. Le garde
 * `(?<!\d)…(?!\d)` sépare « 60 g » de « 160 g ».
 */
function compterLibelles(texte: string, libelles: readonly string[]): ReadonlyMap<string, number> {
  const comptes = new Map<string, number>()
  let reste = texte
  for (const libelle of [...new Set(libelles)].sort((a, b) => b.length - a.length)) {
    const motif = new RegExp(`(?<!\\d)${echapper(libelle)}(?!\\d)`, 'g')
    comptes.set(libelle, (reste.match(motif) ?? []).length)
    reste = reste.replace(motif, ' ')
  }
  return comptes
}

const compter = (texte: string, libelle: string): number =>
  compterLibelles(texte, [libelle]).get(libelle) ?? 0

/**
 * Un texte réduit à ses lettres NUES, pour y chercher un mot sans buter sur l'apostrophe, la
 * virgule — ni sur l'accent : la recette écrit « comté », le catalogue nomme l'aliment `comte`.
 */
const grainDe = (texte: string): string =>
  texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')

/**
 * Les déterminants d'au moins 5 lettres que l'injection a le droit d'avaler.
 *
 * ⚠️ UN SEUL, ET IL EST DANS `ui/texte-etape.ts` : « Fendre **chaque** banane » + « 4 bananes »
 * → « Fendre **les 4** bananes ». C'est la règle d'accord, elle est documentée là-bas et elle est
 * voulue. Les autres déterminants tombent d'eux-mêmes sous le seuil de 5 lettres.
 */
const DETERMINANTS_AVALES = new Set(['chaque'])

/**
 * Les mots PORTEURS d'un texte : ceux dont la disparition se verrait.
 *
 * Coupés de leur pluriel (« pommes » → « pomme ») parce que l'injection change le nombre — « une
 * pomme » devient « 3 pommes » — et gardés seulement à partir de 5 lettres. En dessous vivent les
 * déterminants que l'injection a le DROIT d'avaler : « l' », « les », « du », « des », « aux » sont
 * remplacés ou accordés par `ui/texte-etape.ts`, c'est documenté dans son en-tête et c'est voulu.
 */
const motsPorteurs = (texte: string): readonly string[] =>
  grainDe(texte)
    .split(' ')
    .map((mot) => mot.replace(/[sx]$/, ''))
    .filter((mot) => mot.length >= 5)

/** Ce que l'écran doit écrire : un ingrédient employé = une fois, plus ce que la prose dit déjà. */
function attendu(recette: Recipe): ReadonlyMap<string, number> {
  const libelles = libellesEmployes(recette)
  const compte = new Map<string, number>()
  for (const l of libelles) compte.set(l, (compte.get(l) ?? 0) + 1)
  for (const [l, n] of compterLibelles(proseBrute(recette), libelles)) {
    compte.set(l, (compte.get(l) ?? 0) + n)
  }
  return compte
}

/** Ce que la fiche recette écrit aujourd'hui : TOUS les couples (étape, ingrédient), redites comprises. */
function couplesAffiches(recette: Recipe): ReadonlyMap<string, number> {
  const parFoodId = new Map<string, string>()
  for (const i of recette.ingredients) parFoodId.set(i.foodId as string, i.uniteAffichage)
  const compte = new Map<string, number>()
  for (const etape of gestes(recette)) {
    for (const f of etape.foodIds) {
      const libelle = parFoodId.get(f as string)
      if (libelle !== undefined) compte.set(libelle, (compte.get(libelle) ?? 0) + 1)
    }
  }
  for (const [l, n] of compterLibelles(proseBrute(recette), [...compte.keys()])) {
    compte.set(l, (compte.get(l) ?? 0) + n)
  }
  return compte
}

// --- Navigation du mode cuisine --------------------------------------------------------------------

/** Une carte d'étape, lue dans ses deux canaux. */
interface Carte {
  /** Tout ce qui est écrit sur la carte — phrase, badges, gestes, minuteur. */
  readonly texte: string
  /** Ce qui est écrit DANS la phrase, `<strong>` seuls. */
  readonly phrase: string
  /**
   * La phrase de l'étape EN ENTIER, badges exclus.
   *
   * ⛔ LIRE LA CARTE ENTIÈRE NE SUFFIT PAS ICI, ET C'EST TOUT L'INTÉRÊT. Le badge réécrit le NOM de
   * l'aliment sous la phrase (`nomAliment(foodId)`) : une phrase à qui on a arraché « les poivrons
   * rouges » se relit encore « poivrons » un centimètre plus bas. Seule la phrase isolée voit le
   * trou.
   */
  readonly entiere: string
}

/** La phrase d'une étape : le `<p>` que rend `TexteEtape`, sans la ligne de badges qui le suit. */
function phraseEntiereDe(element: Element, apres: Element | null): string {
  const p = apres === null ? element.querySelector('p') : apres.nextElementSibling
  if (p === null || p === undefined || p.tagName !== 'P') {
    throw new Error('la phrase de l’étape n’est plus un <p> à l’endroit attendu')
  }
  return texteLisible(p)
}

function carteDEtape(container: HTMLElement): Carte {
  for (const section of container.querySelectorAll('section')) {
    if (/Étape \d+ sur \d+/.test(section.textContent ?? '')) {
      // Le `<p>` « Étape n sur m » est l'en-tête ; la phrase est son frère immédiat.
      const enTete = [...section.querySelectorAll('p')].find((p) =>
        /^Étape \d+ sur \d+$/.test(normaliser(p.textContent))
      )
      if (enTete === undefined) throw new Error('l’en-tête « Étape n sur m » a changé de forme')
      return {
        texte: texteLisible(section),
        phrase: phraseDe(section),
        entiere: phraseEntiereDe(section, enTete),
      }
    }
  }
  throw new Error('aucune carte « Étape n sur m » à l’écran — le mode cuisine n’a pas monté')
}

const bouton = (libelle: string): HTMLButtonElement | null =>
  screen.queryByText(libelle)?.closest('button') ?? null

const utilisable = (b: HTMLButtonElement | null): b is HTMLButtonElement => b !== null && !b.disabled

/**
 * Chaque étape, de la première à la dernière, PUIS relue en revenant en arrière.
 *
 * ⛔ ON REMBOBINE AVANT DE LIRE. Le mode cuisine retient l'étape courante d'une cuisson en base, et
 * cette mémoire survit à `reinitialiserBase()` dans un même fichier — le socle n'est chargé qu'une
 * fois. Sans rembobinage, un second montage de la même recette rouvre à la dernière étape.
 *
 * ⛔ ET ON RELIT EN REVENANT, PARCE QUE « DÉJÀ DIT » SE CALCULE DEPUIS LE RANG, PAS DEPUIS
 * L'HISTORIQUE DES CLICS. Un accumulateur d'état (`useRef`, session) donnerait le même écran à
 * l'aller et perdrait la quantité au retour : on reculerait d'une étape et la première mention
 * aurait disparu. La clause 7 compare les deux lectures.
 */
function parcourirEtRevenir(container: HTMLElement): { aller: Carte[]; retour: Carte[] } {
  for (let garde = 0; garde < 200 && utilisable(bouton('← Étape précédente')); garde++) {
    fireEvent.click(bouton('← Étape précédente') as HTMLButtonElement)
  }
  const aller: Carte[] = []
  for (let garde = 0; garde < 200; garde++) {
    aller.push(carteDEtape(container))
    const suivant = bouton('Étape suivante →')
    if (!utilisable(suivant)) break
    fireEvent.click(suivant)
  }
  const retour: Carte[] = []
  for (let garde = 0; garde < 200; garde++) {
    retour.unshift(carteDEtape(container))
    const precedent = bouton('← Étape précédente')
    if (!utilisable(precedent)) break
    fireEvent.click(precedent)
  }
  return { aller, retour }
}

/**
 * Le `<ol>` des étapes de la fiche : le premier qui suit le titre « Préparation ».
 *
 * On ne prend pas tous les `<li>` de la page — les ingrédients sont un `<ul>` de `<li>` et les
 * mélanger doublerait chaque quantité pour une raison qui n'est pas celle du lot.
 */
function listeDesEtapesDeLaFiche(): HTMLElement {
  const titre = screen.getByRole('heading', { level: 2, name: 'Préparation' })
  let element: Element | null = titre.nextElementSibling
  while (element !== null && element.tagName !== 'OL') element = element.nextElementSibling
  if (element === null) throw new Error('aucun <ol> après le titre « Préparation » de la fiche')
  return element as HTMLElement
}

// --- Le balayage, fait UNE fois pour toutes les clauses --------------------------------------------

interface Releve {
  /** Le mode cuisine, étape par étape, à l'aller puis relu au retour. */
  readonly cuisine: { readonly aller: readonly Carte[]; readonly retour: readonly Carte[] }
  /** Le texte de la fenêtre « Voir les ingrédients ». */
  readonly fenetre: string
  /** La fiche recette : une entrée par geste, dans l'ordre, plus le texte entier de la liste. */
  readonly fiche: readonly Carte[]
  readonly ficheEntiere: string
}

const RELEVE = new Map<string, Releve>()

/**
 * Monte les DEUX écrans de chaque recette et garde ce qu'ils écrivent.
 *
 * ⚠️ PAS DE `vi.resetModules()` DANS LA BOUCLE : il ferait ré-évaluer tout l'écran à chaque tour.
 * ⚠️ `reinitialiserBase()` entre deux montages : ouvrir le mode cuisine ÉCRIT une cuisson.
 * ⚠️ AUCUN INTERRUPTEUR DE L'ÉPURE N'EST TOUCHÉ : on mesure l'écran tel qu'il sort de l'usine.
 */
async function balayer(): Promise<void> {
  const { Cuisine } = await import('../../app/src/ui/screens/cuisine.js')
  const { DetailRecette } = await import('../../app/src/ui/screens/detail-recette.js')

  for (const recette of recettes()) {
    if (employes(recette).size === 0) continue
    const id = recette.id as string

    reinitialiserBase()
    const cuisine = render(<Cuisine plats={[{ id, portions: null }]} />)
    await screen.findByRole('heading', { level: 1 })
    const parcours = parcourirEtRevenir(cuisine.container)
    fireEvent.click(screen.getByRole('button', { name: /Voir les ingrédients/ }))
    const fenetre = texteLisible(screen.getByRole('dialog'))
    cuisine.unmount()
    cleanup()

    reinitialiserBase()
    render(<DetailRecette recetteId={id} origine="recettes" />)
    await screen.findByRole('heading', { level: 1 })
    const liste = listeDesEtapesDeLaFiche()
    const fiche = [...liste.children].map((li) => ({
      texte: texteLisible(li),
      phrase: phraseDe(li),
      // Sur la fiche, la phrase est le premier `<p>` du `<li>` : la ligne de badges vient après.
      entiere: phraseEntiereDe(li, null),
    }))
    const ficheEntiere = texteLisible(liste)
    cleanup()

    RELEVE.set(id, { cuisine: parcours, fenetre, fiche, ficheEntiere })
  }
  reinitialiserBase()
}

function releveDe(recette: Recipe): Releve {
  const releve = RELEVE.get(recette.id as string)
  if (releve === undefined) throw new Error(`« ${recette.id as string} » n’a pas été balayée`)
  return releve
}

/** Les recettes que le lot concerne : celles qui ont au moins un ingrédient employé. */
const balayees = (): readonly Recipe[] => recettes().filter((r) => employes(r).size > 0)

const vingtPremieres = (fautes: readonly string[]): string => fautes.slice(0, 20).join('\n')

beforeAll(async () => {
  reinitialiserBase()
  await balayer()
}, 900_000)

beforeEach(() => {
  reinitialiserBase()
})

afterEach(cleanup)

// --- Les clauses -----------------------------------------------------------------------------------

describe('lot E — une quantité dite une fois', () => {
  // ⛔ LA CLAUSE CENTRALE. Égalité stricte, dans les deux sens : aucune redite, aucune perte.
  it('1 — chaque quantité est écrite exactement une fois par ingrédient employé', () => {
    const fautes: string[] = []
    for (const recette of balayees()) {
      const tout = normaliser(
        releveDe(recette)
          .cuisine.aller.map((c) => c.texte)
          .join(' ')
      )
      const vu = compterLibelles(tout, libellesEmployes(recette))
      for (const [libelle, combien] of attendu(recette)) {
        const compte = vu.get(libelle) ?? 0
        if (compte !== combien) {
          fautes.push(
            `${recette.id as string} · « ${libelle} » : écrit ${compte} fois, attendu ${combien}`
          )
        }
      }
    }
    expect(vingtPremieres(fautes), `${fautes.length} écart(s) de compte`).toBe('')
  })

  // ⛔ LA POSITION, QUE LA CLAUSE 1 NE VOIT PAS. Une implémentation qui garderait la DERNIÈRE
  // mention au lieu de la première passerait la clause 1 sans rien régler : au fourneau, la quantité
  // arrive quand on n'en a plus besoin.
  it('2 — elle est écrite à la PREMIÈRE étape qui emploie l’ingrédient, à aucune autre', () => {
    const fautes: string[] = []
    for (const recette of balayees()) {
      const employesIci = employes(recette)
      const rangs = premiereApparition(recette)
      const aller = releveDe(recette).cuisine.aller
      const attenduIci = attendu(recette)
      const libellesDIci = libellesEmployes(recette)

      for (const ingredient of recette.ingredients) {
        const foodId = ingredient.foodId as string
        const libelle = ingredient.uniteAffichage
        if (!employesIci.has(foodId)) continue
        // Un libellé partagé par deux ingrédients, ou déjà présent dans la prose, ne désigne pas
        // une place unique : la clause 1 le couvre en compte, celle-ci ne peut rien en dire.
        if (attenduIci.get(libelle) !== 1) continue
        const rang = rangs.get(foodId)
        if (rang === undefined) continue

        // ⛔ ON COMPTE AVEC TOUS LES LIBELLÉS DE LA RECETTE, COMME LA CLAUSE 1 — jamais le libellé
        // seul. Deux libellés s'emboîtent : `flocons_avoine` porte « 80 g » et `beurre_doux`
        // « 80 g bien froid », employés à deux étapes différentes. Cherché seul, « 80 g » se
        // trouve à l'intérieur de « 80 g bien froid » et accuse l'étape du beurre d'une redite
        // que la clause 1 exige par ailleurs : les deux clauses devenaient contradictoires, et
        // aucune implémentation ne pouvait les satisfaire ensemble. `compterLibelles` consomme
        // le plus long d'abord, ce pour quoi il a été écrit.
        aller.forEach((carte, i) => {
          const compte = compterLibelles(carte.texte, libellesDIci).get(libelle) ?? 0
          const doitY = i === rang ? 1 : 0
          if (compte !== doitY) {
            fautes.push(
              `${recette.id as string} · « ${libelle} » (${foodId}) : étape ${i + 1} l’écrit ` +
                `${compte} fois, attendu ${doitY} — sa première étape est la ${rang + 1}`
            )
          }
        })
      }
    }
    expect(vingtPremieres(fautes), `${fautes.length} quantité(s) mal placée(s)`).toBe('')
  })

  // ⛔ CE QUI REMPLACE LE GARDE-FOU DE LA DÉCISION 60. Le commentaire qui disait « ne passez jamais
  // ici un ensemble qui ne vient pas de la phrase » devient faux avec ce lot : ce qui empêche
  // désormais l'écran de mentir par omission, c'est cette fenêtre, et elle est sous clause.
  // GARDE DE PÉRIMÈTRE — verte aujourd'hui, elle ne peut rougir que si le lot déborde.
  it('3 — la fenêtre « Voir les ingrédients » garde TOUS les ingrédients, quantité comprise', () => {
    const fautes: string[] = []
    for (const recette of balayees()) {
      const tous = recette.ingredients.map((i) => i.uniteAffichage)
      const attenduIci = new Map<string, number>()
      for (const l of tous) attenduIci.set(l, (attenduIci.get(l) ?? 0) + 1)
      const vu = compterLibelles(releveDe(recette).fenetre, tous)
      for (const [libelle, combien] of attenduIci) {
        const compte = vu.get(libelle) ?? 0
        if (compte !== combien) {
          fautes.push(
            `${recette.id as string} · « ${libelle} » : la fenêtre l’écrit ${compte} fois ` +
              `pour ${combien} ingrédient(s)`
          )
        }
      }
    }
    expect(vingtPremieres(fautes), `${fautes.length} écart(s) dans la fenêtre`).toBe('')
  })

  // ⛔ LA GARDE DE PÉRIMÈTRE, ET LE SOCLE DE LA CLAUSE 6. La fiche recette montre toutes les étapes
  // d'un coup : la répétition y est un repère, pas un bruit. Un codeur qui corrigerait
  // `preparerTexteEtape` pour les deux écrans à la fois fait rougir ici. Catalogue entier — c'est
  // elle qui autorise la clause 6 à lire le canal attendu sur la fiche au lieu de l'écrire.
  // GARDE DE PÉRIMÈTRE — verte aujourd'hui.
  it('4 — la fiche recette, elle, continue de répéter', () => {
    const fautes: string[] = []
    for (const recette of balayees()) {
      const couples = couplesAffiches(recette)
      const vu = compterLibelles(releveDe(recette).ficheEntiere, [...couples.keys()])
      for (const [libelle, combien] of couples) {
        const compte = vu.get(libelle) ?? 0
        if (compte !== combien) {
          fautes.push(
            `${recette.id as string} · « ${libelle} » : la fiche l’écrit ${compte} fois, ` +
              `elle en écrivait ${combien}`
          )
        }
      }
    }
    expect(vingtPremieres(fautes), `${fautes.length} écart(s) sur la fiche`).toBe('')
  })

  // ⛔ LA QUANTITÉ DITE UNE FOIS RESTE LA BONNE. Une implémentation qui retiendrait la chaîne rendue
  // au premier montage passerait les clauses 1 à 3 et afficherait la quantité de 4 portions à
  // quelqu'un qui en a demandé 8.
  it('5 — la quantité dite une fois suit le sélecteur de portions', async () => {
    const recette = catalogueDeTest().recipes.get(REFERENCE as never)
    if (recette === undefined) {
      throw new Error(`« ${REFERENCE} » a disparu du catalogue : la clause 5 n’a plus de repère`)
    }
    const ail = recette.ingredients.find((i) => (i.foodId as string) === 'ail')
    if (ail === undefined) {
      throw new Error(`« ${REFERENCE} » n’a plus d’ail : la clause 5 n’a plus de repère`)
    }
    const aQuatre = ail.uniteAffichage

    const { Cuisine } = await import('../../app/src/ui/screens/cuisine.js')
    const { container, unmount } = render(<Cuisine plats={[{ id: REFERENCE, portions: 8 }]} />)
    await screen.findByRole('heading', { level: 1 })
    const cartes = parcourirEtRevenir(container).aller
    unmount()

    // « 2 gousses » pour 4 portions → « 4 gousses » pour 8. Le nombre est doublé, le libellé garde
    // son unité de cuisine (`ui/quantites.ts`) : on le reconstruit au lieu de l'écrire en dur.
    const aHuit = aQuatre.replace(/^(\d+)/, (n) => String(Number(n) * 2))
    expect(
      aHuit,
      `« ${aQuatre} » ne commence pas par un nombre : la clause 5 ne sait pas le doubler`
    ).not.toBe(aQuatre)

    const texte = normaliser(cartes.map((c) => c.texte).join(' '))
    expect(compter(texte, aHuit), `« ${aHuit} » doit être écrit une seule fois`).toBe(1)
    expect(
      compter(texte, aQuatre),
      `« ${aQuatre} » est la quantité de 4 portions, pas de 8`
    ).toBe(0)
  }, 120_000)

  // ⛔ LE CANAL — C'EST CETTE CLAUSE QUI A MANQUÉ AU PREMIER TOUR D'ATTAQUE. Sans elle, « tout
  // basculer en badge et ne plus jamais injecter dans la phrase » passait les cinq autres clauses et
  // rendait `ui/texte-etape.ts` mort pour l'écran cuisine.
  //
  // ⭐ LE CANAL ATTENDU N'EST PAS ÉCRIT ICI, IL EST LU SUR LA FICHE. La fiche recette prépare son
  // texte avec les MÊMES entrées que le fourneau — c'est écrit dans `detail-recette.tsx` — et la
  // clause 4 la tient inchangée sur tout le catalogue. Le canal de la première mention est donc une
  // donnée mesurée à l'exécution, pas une table que le lot pourrait contredire en silence.
  // GARDE DE PÉRIMÈTRE — verte aujourd'hui.
  it('6 — la première mention reste dans le canal que la fiche lui donne', () => {
    const fautes: string[] = []
    let mesurees = 0
    let enPhrase = 0
    for (const recette of balayees()) {
      const releve = releveDe(recette)
      const employesIci = employes(recette)
      const rangs = premiereApparition(recette)
      const attenduIci = attendu(recette)

      for (const ingredient of recette.ingredients) {
        const foodId = ingredient.foodId as string
        const libelle = ingredient.uniteAffichage
        if (!employesIci.has(foodId)) continue
        if (attenduIci.get(libelle) !== 1) continue
        const rang = rangs.get(foodId)
        if (rang === undefined) continue
        const auFourneau = releve.cuisine.aller[rang]
        const surLaFiche = releve.fiche[rang]
        if (auFourneau === undefined || surLaFiche === undefined) continue

        mesurees += 1
        const phraseFiche = compter(surLaFiche.phrase, libelle) > 0
        const phraseCuisine = compter(auFourneau.phrase, libelle) > 0
        if (phraseFiche) enPhrase += 1
        if (phraseFiche !== phraseCuisine) {
          fautes.push(
            `${recette.id as string} · « ${libelle} » (${foodId}) à l’étape ${rang + 1} : ` +
              `la fiche l’écrit ${phraseFiche ? 'DANS LA PHRASE' : 'EN BADGE'}, ` +
              `le mode cuisine ${phraseCuisine ? 'DANS LA PHRASE' : 'EN BADGE'}`
          )
        }
      }
    }
    // Sans ce plancher, une implémentation qui ne rendrait plus AUCUN libellé identifiable ferait
    // passer la clause sur un ensemble vide. Il n'est pas un compte du catalogue : il exige
    // seulement que la mesure ait porté sur quelque chose.
    // ⛔ SANS CES DEUX PLANCHERS, LA CLAUSE PASSERAIT SUR DU VIDE — et c'est le trou même qu'elle
    // est censée fermer. Une implémentation qui ne rendrait plus aucun libellé identifiable, ou une
    // fiche qui n'en mettrait plus un seul dans sa phrase, ferait comparer deux ensembles vides.
    // ⚠️ CE NE SONT PAS DES COMPTES DU CATALOGUE (leçon de `retour-5c`) : mesuré aujourd'hui,
    // 2 084 premières mentions dont 1 405 dans la phrase et 679 en badge. Les planchers sont posés
    // très en dessous — ils exigent que la mesure ait porté, pas que le catalogue ait cette taille.
    const comparaison = `${mesurees} mesurées, ${enPhrase} dans la phrase, ${mesurees - enPhrase} en badge`
    expect(enPhrase, `la fiche n’écrit presque plus rien dans sa phrase (${comparaison})`)
      .toBeGreaterThan(200)
    expect(mesurees - enPhrase, `la fiche n’écrit presque plus de badge (${comparaison})`)
      .toBeGreaterThan(100)
    expect(vingtPremieres(fautes), `${fautes.length} changement(s) de canal`).toBe('')
  })

  // ⛔ « DÉJÀ DIT » SE CALCULE DEPUIS LE RANG DE L'ÉTAPE, JAMAIS DEPUIS L'HISTORIQUE DES CLICS. Un
  // accumulateur d'état — `useRef`, session, store — donnerait exactement le même écran à l'aller et
  // effacerait la première mention au retour : on recule d'une étape pour revérifier une quantité,
  // et elle a disparu. Le balayage relit chaque recette en revenant sur ses pas.
  // GARDE DE PÉRIMÈTRE — verte aujourd'hui.
  it('7 — revenir en arrière ne change pas ce qui est écrit', () => {
    const fautes: string[] = []
    for (const recette of balayees()) {
      const { aller, retour } = releveDe(recette).cuisine
      if (aller.length !== retour.length) {
        fautes.push(
          `${recette.id as string} : ${aller.length} étape(s) à l’aller, ${retour.length} au retour`
        )
        continue
      }
      aller.forEach((carte, i) => {
        if (carte.texte !== retour[i]?.texte) {
          fautes.push(
            `${recette.id as string} · étape ${i + 1} : le retour n’écrit pas la même chose que ` +
              `l’aller\n    aller  : ${carte.texte.slice(0, 160)}\n    retour : ${(
                retour[i]?.texte ?? ''
              ).slice(0, 160)}`
          )
        }
      })
    }
    expect(vingtPremieres(fautes), `${fautes.length} écart(s) entre l’aller et le retour`).toBe('')
  })

  // ⛔ LA PHRASE NE SE TROUE PAS — C'EST LA CLAUSE DU SECOND TOUR D'ATTAQUE. Retirer une quantité
  // déjà dite en VIDANT le segment après coup passait les sept autres clauses et rendait « Faire
  // fondre l'oignon et les poivrons rouges » comme « Faire fondre et dans ». L'injection ne pose pas
  // la quantité À CÔTÉ du groupe nominal, elle le REMPLACE (`ui/texte-etape.ts` : « l'oignon » →
  // « 1 gros oignon ») : vider le segment emporte donc le NOM de l'aliment avec le nombre.
  //
  // ⭐ LA RÉFÉRENCE EST LE TEXTE BRUT DU YAML, LA SEULE QUE L'ÉCRAN NE FABRIQUE PAS. La fiche ne
  // pouvait pas servir ici — elle injecte partout, donc elle a AUSSI consommé le mot, et la
  // comparaison aurait exigé la phrase trouée. Règle : un mot porteur de la recette ne disparaît de
  // la phrase que si le libellé qui l'a remplacé y est écrit.
  // GARDE DE PÉRIMÈTRE — verte aujourd'hui.
  it('8 — supprimer une quantité ne troue pas la phrase', () => {
    const fautes: string[] = []
    const foods = catalogueDeTest().foods
    /** Tous les noms sous lesquels la recette peut désigner un aliment — même matière qu'au build. */
    const vocabulaireDe = (foodId: string): string => {
      const aliment = foods.get(foodId as never)
      return [foodId.replace(/_/g, ' '), aliment?.nom ?? '', ...(aliment?.synonymes ?? [])].join(' ')
    }

    let mots = 0
    for (const recette of balayees()) {
      const parFoodId = new Map<string, string>()
      for (const i of recette.ingredients) parFoodId.set(i.foodId as string, i.uniteAffichage)
      const aller = releveDe(recette).cuisine.aller

      gestes(recette).forEach((etape, rang) => {
        const carte = aller[rang]
        if (carte === undefined) return
        const rendue = grainDe(carte.entiere)

        // Ce que l'injection a le droit d'avoir avalé : le groupe nominal qu'elle a REMPLACÉ, pour
        // les seuls ingrédients dont le libellé est RÉELLEMENT écrit dans la phrase — un libellé
        // absent n'a rien remplacé du tout. Le groupe n'est pas toujours dans le libellé :
        // « Parsemer de comté » devient « Parsemer de 60 g râpé », le mot avalé est le nom de
        // l'aliment. On exempte donc libellé ET vocabulaire, et rien d'autre.
        const avalables = grainDe(
          [...etape.foodIds]
            .map((f) => f as string)
            .filter((f) => {
              const libelle = parFoodId.get(f)
              return libelle !== undefined && compter(carte.entiere, libelle) > 0
            })
            .map((f) => `${parFoodId.get(f) ?? ''} ${vocabulaireDe(f)}`)
            .join(' ')
        )

        for (const mot of motsPorteurs(etape.texte)) {
          if (DETERMINANTS_AVALES.has(mot)) continue
          mots += 1
          if (rendue.includes(mot) || avalables.includes(mot)) continue
          fautes.push(
            `${recette.id as string} · étape ${rang + 1} : le mot « ${mot} » a disparu de la ` +
              `phrase\n    recette : ${etape.texte.slice(0, 140)}\n    écran   : ${carte.entiere.slice(0, 140)}`
          )
        }
      })
    }
    expect(mots, 'aucun mot porteur relu : la clause 8 n’a rien vu').toBeGreaterThan(1_000)
    expect(vingtPremieres(fautes), `${fautes.length} mot(s) perdu(s)`).toBe('')
  })
})
