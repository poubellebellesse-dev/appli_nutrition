// @vitest-environment jsdom
//
// tests/scelles/lot-C.test.tsx — l'examen du lot C : « la fiche recette ».
// Écrit depuis le « Fini quand » de docs/CONCEPTION_RETOURS_APK.md, AVANT la première ligne de code.
//
// CE QUE CE FICHIER MESURE, ET POURQUOI DE CETTE FAÇON :
//
// ⭐ LA LIGNE DE TEMPS EST COMPARÉE EN ÉGALITÉ, PAS EN PRÉSENCE. `includes('min en tout')` serait
//    vert sur « 10 min de préparation · 40 min de cuisson · 50 min en tout » — l'ordre est
//    précisément ce que le lot corrige. La clause prend le texte ENTIER de la ligne et le compare à
//    une chaîne construite depuis `catalog.db`.
//
// ⭐ LES DURÉES NE SONT ÉCRITES NULLE PART ICI, ET LES CLAUSES 1 À 4 BALAIENT LE CATALOGUE ENTIER.
//    Tout est lu dans `catalog.db` à l'exécution. La première version n'en montait que cinq, tirées
//    par un échantillon déterministe dont le brief PUBLIAIT les identifiants : le premier tour
//    d'attaque a exhibé une table `{ id → « 30 min en tout · 10 min de préparation · 20 min de
//    cuisson » }` de huit entrées qui passait les clauses 1, 2, 3, 4 et 5 sans qu'aucune addition ne
//    soit faite nulle part. Sur les 339 fiches, cette table devient le catalogue recopié à la main :
//    la seule implémentation qui tient est celle qui calcule. Le coût est un balayage de quelques
//    secondes, et c'est le prix de la discrimination.
//
// ⭐ DEUX CLAUSES NE CHERCHENT PLUS UN MOT MAIS UNE DONNÉE, ET C'EST LE SECOND TOUR D'ATTAQUE QUI
//    L'A EXIGÉ. Une clause d'absence qui cherche « difficulté n/3 » ou « <nombre> recettes » ne
//    mesure pas l'absence de la chose : elle mesure l'absence d'un VOCABULAIRE. Le second critique a
//    exhibé « Niveau : 2/3 » sur la fiche et « 336 résultats trouvés » sur l'écran — deux
//    renommages, aucun calcul, 11 clauses sur 11 vertes, et les deux informations toujours à
//    l'écran. Les deux nets ajoutés ne devinent plus aucun mot :
//      · clause 3  — on FORCE `difficulte` à 1 puis à 3 et on exige que le texte rendu soit
//                    IDENTIQUE. Toute forme d'affichage, connue ou non, fait diverger les deux.
//      · clauses 7 et 7b — on cherche LE NOMBRE de cartes, pas le mot posé à côté : on n'annonce
//                    pas un compte sans l'écrire. Sur l'écran ENTIER, pas seulement dans la phrase,
//                    pour qu'un zéro reformulé ne se réfugie pas dans l'élément voisin.
//    ⚠️ CINQ SONDES TIRÉES AVANT D'ÉCRIRE CES FILETS, PUIS RETIRÉES — sans elles, trois d'entre eux
//    auraient été verts ou rouges pour une raison étrangère au lot. Ce qu'elles ont établi sur
//    l'arbre du jour : les 339 fiches rendent deux fois le même texte (13,1 s, zéro divergence) ;
//    la phrase de liste vide ne porte aucun chiffre hors « 0 recette » ; sur la liste pleine le
//    motif ne trouve QUE le « 336 » du compteur ; sur la liste vide, QUE le « 0 » du compteur.
//    ⛔ ET LE PIÈGE DU `\b` S'EST PRÉSENTÉ UNE TROISIÈME FOIS : l'écran donne « Tout retirer0
//    recette », le zéro est précédé d'une lettre, `\b0\b` n'y trouve rien. Le filet était vert avant
//    toute ligne de code. Voir `COMPTE_HORS_PARENTHESES`.
//
// ⭐ « MASQUER, JAMAIS SUPPRIMER » SE MESURE ICI SANS INTERRUPTEUR, ET C'EST VOULU. La clause 1 de
//    `lot-B.test.tsx` scelle `ui/epure.ts` à EXACTEMENT quatre déclarations : un cinquième
//    interrupteur ferait rougir un test scellé. La difficulté n'est donc pas masquée derrière un
//    drapeau — elle n'est plus écrite, et le CHAMP ne bouge pas. La clause 3b relit `difficulte`
//    depuis `catalog.db` chargé par le vrai `loadCatalog` : un codeur qui « ferait propre » en
//    retirant la colonne du modèle ou du chargeur la fait rougir.
//
// ⚠️ AUCUN COMPTE ABSOLU DU CATALOGUE N'EST SCELLÉ. La leçon de `retour-5c` : onze valeurs figées
//    dans six fichiers scellés ont rougi le jour où le catalogue a grossi, sans qu'aucun code soit
//    faux. Ce fichier ne fige donc ni « 339 recettes », ni « 282 à cuisson non nulle », ni « 57
//    froides » : il CHERCHE ses recettes de référence par leurs propriétés, dans un ordre
//    déterministe (tri par identifiant, échantillon aux quarts). Les nombres du brief datent le
//    relevé, ils ne sont pas une clause.
//    ⚠️ Un identifiant fait exception et est nommé en dur : `artichauts_vinaigrette`, pour les
//    clauses 5, 6 et 6b. Une recette nommée est un repère, pas un compte — si elle disparaît du
//    catalogue, la clause lève avec un message qui le dit, et c'est le bon comportement.
//
// ⚠️ LE FACTEUR DE PORTIONS VAUT 1 À L'OUVERTURE (`portionsAffichees = portions ?? portionsBase`,
//    detail-recette.tsx:321) : `quantiteAffichee` rend alors le libellé du catalogue VERBATIM
//    (ui/quantites.ts:184). C'est ce qui permet aux clauses 4 et 5 de comparer à `uniteAffichage`
//    sans réimplémenter la mise à l'échelle — et ce qui explique que « · quantité au goût, non
//    ajustée » ne soit PAS dans les gardes : `fige` vaut `false` au facteur 1, la mention n'est pas
//    affichée, une clause qui l'exigerait serait verte sans rien mesurer.
//
// ⚠️ UNE ÉTAPE DU CATALOGUE CONTIENT LE MOT « difficulté » (`oeufs_coque_mouillettes`, étape 3 :
//    « c'est la seule difficulté »). La clause 3 cherche donc le MOTIF D'AFFICHAGE
//    (« difficulté n/3 »), pas le mot — et exige en plus que la ligne de temps n'en porte aucune
//    trace, ce que son égalité stricte garantit déjà.
//
// ⭐ LE COMPTEUR DE L'ÉCRAN « RECETTES » (clauses 7, 7b, 7c) PASSE, LUI, PAR UN INTERRUPTEUR — ET
//    C'EST L'INTERRUPTEUR QUI EXISTE DÉJÀ. `ui/epure.ts` documente `jaugesEtCompteurs` comme couvrant
//    « la barre de couverture du frigo ET LE NOMBRE BRUT DE RECETTES TROUVÉES » : le lot B a écrit la
//    moitié frigo et laissé l'autre. Aucun interrupteur neuf n'est créé, la clause 1 de `lot-B` reste
//    donc à quatre, et la clause 7c retourne le drapeau pour redemander le compte — « masquer, jamais
//    supprimer » se mesure ici, contrairement à la difficulté.
//
// ⚠️ L'ÉCRAN « RECETTES » PORTE D'AUTRES NOMBRES, ET AUCUN N'EST VISÉ : « Mes favoris (0) »,
//    « Sauces (N) », « Mes recettes (0) » — des LIBELLÉS DE BOUTON, où le compte dit ce qu'on trouvera
//    derrière avant d'y entrer (recettes.tsx:216) — et l'entonnoir « N recettes → … = M disponibles »,
//    qui est une explication du moteur, pas une jauge. Les clauses cherchent donc le motif
//    « <nombre> recette(s) » et le mesurent sur un profil NEUF, où l'entonnoir n'est pas rendu
//    (`totalRejected === 0`) : la clause 7 vérifie cette précondition avant de conclure, pour ne pas
//    rougir sur un texte qui n'est pas le sien.
//
// ⚠️ HORLOGE FIGÉE (`toFake: ['Date']` ET RIEN D'AUTRE — figer `setTimeout` fait pendre `findBy*`).
//    La fiche ne lit pas l'heure pour ce que mesure ce fichier, mais le socle, lui, date ce qu'il
//    écrit. Une suite qui mesure la machine est une suite qui rougira un soir de bascule.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Recipe } from '../../app/src/engine/domain/index.js'
import {
  catalogueDeTest,
  confianceDeTest,
  rallumerEpure,
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

/** Mardi, midi. Voir l'en-tête : on fige l'horloge, on ne la lit pas. */
const INSTANT = '2026-09-15T12:00:00.000Z'

/** La recette de référence des clauses 4, 5 et 6 : 7 ingrédients, 5 étapes, 4 portions de base. */
const REFERENCE = 'artichauts_vinaigrette'

// --- Lecture du catalogue réel --------------------------------------------------------------------

const recettes = (): readonly Recipe[] =>
  [...catalogueDeTest().recipes.values()].sort((a, b) => (a.id as string).localeCompare(b.id))

/**
 * Un échantillon déterministe de `combien` éléments, étalé sur toute la liste.
 *
 * Premier, dernier, et les intermédiaires aux fractions — jamais `slice(0, n)`, qui ne prendrait que
 * le début de l'alphabet et, avec lui, une seule famille de plats.
 */
function echantillon<T>(liste: readonly T[], combien: number): readonly T[] {
  if (liste.length < combien)
    throw new Error(`le catalogue n'offre que ${liste.length} recettes pour un échantillon de ${combien}`)
  const pas = (liste.length - 1) / (combien - 1)
  return Array.from({ length: combien }, (_, i) => liste[Math.round(i * pas)]!)
}

const avecCuisson = (): readonly Recipe[] => recettes().filter((r) => r.tempsCuissonMin > 0)
const sansCuisson = (): readonly Recipe[] => recettes().filter((r) => r.tempsCuissonMin === 0)

function recetteDeReference(): Recipe {
  const recette = catalogueDeTest().recipes.get(REFERENCE as never)
  if (recette === undefined)
    throw new Error(`« ${REFERENCE} » a disparu du catalogue : les clauses 4 à 6 n'ont plus de repère`)
  return recette
}

const nomDeLAliment = (foodId: string): string =>
  catalogueDeTest().foods.get(foodId as never)?.nom ?? foodId

// --- Lecture du rendu -----------------------------------------------------------------------------

const normaliser = (texte: string | null): string => (texte ?? '').replace(/\s+/g, ' ').trim()

/** Le texte que l'écran DONNE À LIRE. `textContent` : il ignore la feuille de style. */
const texteAffiche = (): string => normaliser(document.body.textContent)

/**
 * La ligne de temps, texte entier.
 *
 * ⚠️ `getByText` compare le texte PROPRE d'un élément (ses nœuds texte directs), donc le `<p>` de la
 * ligne et lui seul — un conteneur qui l'enveloppe n'a pas de nœud texte direct et ne matche pas.
 * Aucune étape du catalogue ne contient « min en tout » (une seule dit « en toute fin de cuisson »),
 * donc le motif ne désigne rien d'autre à l'écran.
 */
const ligneDeTemps = (): string => normaliser(screen.getByText(/\d+\s*min en tout/).textContent)

/** « difficulté 2/3 », quelle que soit la ponctuation qu'on lui mettrait autour. */
const DIFFICULTE_AFFICHEE = /difficult[ée]s?\s*:?\s*[123]\s*\/\s*3/i

/**
 * Le `<ul>` des ingrédients de la fiche : le premier qui suit le titre « Ingrédients ».
 *
 * On ne prend pas `document.querySelectorAll('li')` : les étapes sont un `<ol>` de `<li>` et les
 * mélanger ferait échouer le compte pour une raison qui n'est pas celle du lot.
 */
function listeDesIngredientsDeLaFiche(): HTMLElement {
  const titre = screen.getByRole('heading', { level: 2, name: 'Ingrédients' })
  let element: Element | null = titre.nextElementSibling
  while (element !== null && element.tagName !== 'UL') element = element.nextElementSibling
  if (element === null) throw new Error('aucun <ul> après le titre « Ingrédients » de la fiche')
  return element as HTMLElement
}

/**
 * Vérifie, ligne à ligne, que le NOM est écrit avant la QUANTITÉ — et que la quantité est là.
 *
 * Les deux moitiés comptent : « nom d'abord » obtenu en supprimant la quantité n'est pas le lot,
 * c'est une perte d'information. Le libellé attendu est `uniteAffichage` verbatim parce que le
 * facteur vaut 1 (voir l'en-tête).
 */
function nomPuisQuantite(liste: HTMLElement, recette: Recipe, ou: string): void {
  const lignes = [...liste.querySelectorAll('li')]
  expect(
    lignes.length,
    `${ou} : ${lignes.length} ligne(s) d'ingrédient pour ${recette.ingredients.length} au catalogue`
  ).toBe(recette.ingredients.length)

  recette.ingredients.forEach((ingredient, rang) => {
    const texte = normaliser(lignes[rang]!.textContent)
    const nom = nomDeLAliment(ingredient.foodId as string)
    const quantite = ingredient.uniteAffichage
    expect(
      quantite.length,
      `${ou}, ligne ${rang + 1} : le catalogue ne donne aucun libellé de quantité — la clause ne saurait pas où le chercher`
    ).toBeGreaterThan(0)
    const positionNom = texte.indexOf(nom)
    const positionQuantite = texte.indexOf(quantite)

    expect(positionNom, `${ou}, ligne ${rang + 1} : « ${nom} » absent de « ${texte} » — l'ordre du catalogue a changé`)
      .toBeGreaterThanOrEqual(0)
    expect(positionQuantite, `${ou}, ligne ${rang + 1} : « ${quantite} » absent de « ${texte} » — la quantité a été perdue, pas déplacée`)
      .toBeGreaterThanOrEqual(0)
    expect(positionNom, `${ou}, ligne ${rang + 1} : « ${texte} » donne la quantité avant le nom`)
      .toBeLessThan(positionQuantite)
    expect(texte.startsWith(nom), `${ou}, ligne ${rang + 1} : « ${texte} » ne COMMENCE pas par « ${nom} »`)
      .toBe(true)
  })
}

/**
 * « 12 recettes », « 0 recette » — un nombre suivi du mot, quelle que soit la façon de le découper en
 * éléments : `textContent` recolle les frères sans rien insérer entre eux.
 *
 * Ne désigne NI « Mes favoris (0) », NI « Sauces (3) », NI « Mes recettes (0) » — le nombre y est
 * après le mot, entre parenthèses.
 *
 * ⛔ AUCUN `\b` À LA FIN, ET C'EST UN PIÈGE PAYÉ EN ÉCRIVANT CE FICHIER. `textContent` recolle les
 *    frères sans rien insérer : à l'écran d'aujourd'hui le compteur donne « 336 recettesAnanas rôti
 *    à la noix… », le mot est suivi d'une lettre, et `recettes?\b` n'y trouve RIEN. La clause était
 *    verte avant toute ligne de code, pour une raison qui n'a rien à voir avec le lot.
 */
const COMPTEUR_DE_RECETTES = /\d+\s*recettes?/i

/**
 * LE NOMBRE lui-même, quel que soit le mot posé à côté — on n'annonce pas un compte sans l'écrire.
 *
 * ⛔ NI `\b` DEVANT, NI `\b` DERRIÈRE, ET C'EST LE MÊME PIÈGE QUE CI-DESSUS, PAYÉ UNE TROISIÈME
 *    FOIS. `textContent` recolle les frères : sur une liste vide l'écran donne
 *    « …Tout retirer0 recette — essayez… », le zéro est précédé d'une LETTRE, et `\b0\b` n'y trouve
 *    RIEN. Le filet aurait été vert avant toute ligne de code. On borne donc par les CHIFFRES
 *    (`(?<!\d)` / `(?!\d)`), pas par les mots : c'est « 336 » et non « 1336 » ou « 3360 » qu'on
 *    cherche.
 *
 * ⚠️ LA SEULE EXEMPTION EST LA PARENTHÈSE, ET ELLE EST DÉCLARÉE DANS LE BRIEF : « Mes favoris (0) »,
 *    « Mes recettes (0) », « Sauces (3) », « francaise (0) », « Tout voir (26) » sont des LIBELLÉS DE
 *    BOUTON, où le compte dit ce qu'on trouvera derrière avant d'y entrer (recettes.tsx:216). Le lot
 *    les épargne explicitement, donc un nombre immédiatement enfermé dans une parenthèse ne compte
 *    pas. Sondé : sur une liste vide, ce motif ne trouve QUE le « 0 » de « 0 recette » ; sur la liste
 *    pleine, QUE le « 336 » du compteur.
 */
const COMPTE_HORS_PARENTHESES = (n: number): RegExp =>
  new RegExp(`(?<![\\d(])${n}(?!\\d)(?!\\))`)

/**
 * Le nombre de cartes réellement affichées, compté par l'étoile de favori que chacune porte
 * (`aria-label` « Ajouter … aux favoris » / « Retirer … des favoris »).
 *
 * ⚠️ PAS `querySelectorAll('li')` : les filtres et l'entonnoir en posent d'autres. Pas non plus le
 * compteur lui-même, qui est justement ce qu'on mesure.
 */
const cartesAffichees = (): number =>
  screen.queryAllByRole('button', { name: /(aux|des) favoris$/ }).length

// --- Montages -------------------------------------------------------------------------------------

async function monterFiche(recetteId: string): Promise<void> {
  const { DetailRecette } = await import('../../app/src/ui/screens/detail-recette.js')
  render(<DetailRecette recetteId={recetteId} origine="recettes" />)
  await screen.findByRole('heading', { level: 1 })
}

/**
 * L'écran « Recettes » sur un profil NEUF (base réinitialisée en `beforeEach` : aucune allergie,
 * aucun régime, aucun favori), sans filtre ni recherche.
 *
 * ⚠️ `ProvenanceLancerParcours` ET L'ÉCRAN IMPORTÉS DYNAMIQUEMENT, tous les deux : le `beforeEach`
 * appelle `vi.resetModules()`, un import statique figerait un contexte React d'avant et
 * `useLancerParcours()` lèverait malgré le fournisseur monté (voir `ui/parcours.test.tsx`).
 */
async function monterRecettes(): Promise<void> {
  const { Recettes } = await import('../../app/src/ui/screens/recettes.js')
  const { ProvenanceLancerParcours } = await import('../../app/src/ui/lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Recettes />
    </ProvenanceLancerParcours>
  )
  await waitFor(() => {
    if (cartesAffichees() === 0) throw new Error('la liste de recettes est encore vide')
  })
}

/**
 * Monte la fiche de CHAQUE recette de `liste`, l'une après l'autre, et lui applique `verifier`.
 *
 * ⭐ C'EST CE BALAYAGE QUI REND LES CLAUSES 1 À 4 NON TRICHABLES, et il a été écrit pour ça. Une
 *    version antérieure n'en montait que cinq, tirées par un échantillon déterministe — et le brief
 *    publiait leurs identifiants. Une table `{ id → chaîne toute faite }` de huit entrées passait
 *    alors les clauses 1, 2, 3, 4 et 5 sans qu'aucune addition ne soit faite nulle part. Sur le
 *    catalogue ENTIER, la table de correspondance n'est plus un raccourci : c'est le catalogue
 *    recopié à la main, une recette de plus la met en défaut, et la seule implémentation qui tient
 *    est la vraie.
 *
 * ⚠️ PAS DE `vi.resetModules()` DANS LA BOUCLE : il invalide le registre et fait re-évaluer tout
 *    l'écran à chaque tour. Aucune de ces clauses ne touche aux interrupteurs de l'épure, le
 *    `beforeEach` suffit — et c'est ce qui fait tenir le balayage en secondes.
 */
async function pourChaqueFiche(
  liste: readonly Recipe[],
  verifier: (recette: Recipe) => void
): Promise<void> {
  for (const recette of liste) {
    await monterFiche(recette.id as string)
    try {
      verifier(recette)
    } finally {
      cleanup()
    }
  }
}

async function monterCuisine(recetteId: string): Promise<void> {
  const { Cuisine } = await import('../../app/src/ui/screens/cuisine.js')
  render(<Cuisine plats={[{ id: recetteId, portions: null }]} />)
  await screen.findByRole('heading', { level: 1 })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(INSTANT) })
  vi.resetModules()
  reinitialiserBase()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// =================================================================================================
// 1 — la ligne de temps
// =================================================================================================

describe('lot C — la ligne de temps donne le total en premier', () => {
  it(
    'clause 1 — TOUTES les recettes à cuisson non nulle lisent « T min en tout · P min de préparation · C min de cuisson »',
    async () => {
      const chaudes = avecCuisson()
      expect(chaudes.length, 'aucune recette à cuisson non nulle : la clause ne mesurerait rien')
        .toBeGreaterThan(0)

      await pourChaqueFiche(chaudes, (recette) => {
        const total = recette.tempsPrepMin + recette.tempsCuissonMin
        const attendu = `${total} min en tout · ${recette.tempsPrepMin} min de préparation · ${recette.tempsCuissonMin} min de cuisson`
        expect(ligneDeTemps(), `${recette.id} : la ligne de temps ne se lit pas comme attendu`).toBe(attendu)
      })
    },
    120_000
  )

  it(
    'clause 2 — TOUTES les recettes sans cuisson n’affichent QUE « P min en tout »',
    async () => {
      const froides = sansCuisson()
      expect(
        froides.length,
        'aucune recette sans cuisson au catalogue : la clause ne mesurerait rien'
      ).toBeGreaterThan(0)
      expect(
        froides.every((r) => r.tempsPrepMin > 0),
        'une recette sans cuisson a AUSSI une préparation nulle : le « Fini quand » ne dit pas quoi afficher'
      ).toBe(true)

      await pourChaqueFiche(froides, (recette) => {
        expect(ligneDeTemps(), `${recette.id} : « 0 min de cuisson » ou une préparation redite`).toBe(
          `${recette.tempsPrepMin} min en tout`
        )
      })
    },
    120_000
  )
})

// =================================================================================================
// 2 — la difficulté : retirée de l'écran, intacte dans le modèle
// =================================================================================================

describe('lot C — la difficulté ne se lit plus sur la fiche', () => {
  it(
    'clause 3 — AUCUNE fiche ne montre la difficulté, SOUS AUCUN MOT : le texte est le même à difficulté 1 et à difficulté 3',
    async () => {
      for (const recette of recettes()) {
        // ⛔ ON MODIFIE L'OBJET DU CATALOGUE PARTAGÉ, ET ON LE REND. `catalogueDeTest()` met en cache
        //    un seul `Catalog` pour tout le fichier et l'écran lit CET objet-là (voir le `vi.mock`
        //    de `catalog-source`) : c'est ce qui rend la mesure différentielle possible sans
        //    fixture. Le `finally` remet la valeur du catalogue, quoi qu'il arrive.
        const modifiable = recette as unknown as { difficulte: number }
        const vraie = modifiable.difficulte
        try {
          modifiable.difficulte = 1
          await monterFiche(recette.id as string)
          const aUn = texteAffiche()

          const trouve = DIFFICULTE_AFFICHEE.exec(aUn)
          expect(trouve, `${recette.id} : « ${trouve?.[0] ?? ''} » se lit encore sur la fiche`).toBe(null)
          expect(
            /difficult/i.test(ligneDeTemps()),
            `${recette.id} : la ligne de temps parle encore de difficulté`
          ).toBe(false)
          cleanup()

          modifiable.difficulte = 3
          await monterFiche(recette.id as string)
          const aTrois = texteAffiche()
          cleanup()

          // ⭐ LE FILET QUI NE SE CONTOURNE PAS PAR UN SYNONYME, ET C'EST LE SECOND TOUR D'ATTAQUE
          //    QUI L'A EXIGÉ. La clause ci-dessus cherche un MOTIF : « Niveau : 2/3 », « Facile »,
          //    « ★★☆ » la laissent verte alors que la difficulté est toujours à l'écran. Ici on ne
          //    devine aucun mot — on change la donnée et on exige que le rendu ne bouge pas. Toute
          //    forme d'affichage de `difficulte`, connue ou non, fait diverger les deux textes.
          expect(
            aTrois,
            `${recette.id} : le texte de la fiche CHANGE quand la difficulté passe de 1 à 3 — elle est donc encore affichée, sous un mot que la clause n'a pas à deviner`
          ).toBe(aUn)
        } finally {
          modifiable.difficulte = vraie
          cleanup()
        }
      }
    },
    120_000
  )

  // ⭐ LA MOITIÉ QUI SÉPARE « RETIRÉ DE L'AFFICHAGE » DE « SUPPRIMÉ DU MODÈLE ». Verte aujourd'hui,
  //    et déclarée telle : elle ne décrit aucun défaut, elle dit ce qu'un correctif trop large
  //    casserait. Elle passe par `catalogueDeTest()`, donc par le vrai `loadCatalog` sur le vrai
  //    `catalog.db` — retirer la colonne de `catalog-loader.ts` ou le champ de `Recipe` la rougit.
  it('clause 3b — GARDE : les recettes portent toujours un `difficulte` de 1 à 3, les trois valeurs représentées', () => {
    const parValeur = new Map<number, number>()
    for (const recette of recettes())
      parValeur.set(recette.difficulte, (parValeur.get(recette.difficulte) ?? 0) + 1)

    const horsBornes = recettes().filter(
      (r) => !Number.isInteger(r.difficulte) || r.difficulte < 1 || r.difficulte > 3
    )
    expect(
      horsBornes.map((r) => `${String(r.id)}=${String(r.difficulte)}`),
      'le champ `difficulte` a été supprimé, vidé ou sorti de ses bornes'
    ).toEqual([])

    for (const valeur of [1, 2, 3])
      expect(
        parValeur.get(valeur) ?? 0,
        `aucune recette en difficulté ${valeur} : le champ n'est plus renseigné`
      ).toBeGreaterThan(0)

    expect(
      [...parValeur.values()].reduce((a, b) => a + b, 0),
      'toutes les recettes ne portent pas de difficulté'
    ).toBe(catalogueDeTest().recipes.size)
  })
})

// =================================================================================================
// 3 — la liste d'ingrédients : le nom d'abord
// =================================================================================================

describe('lot C — chaque ligne d’ingrédient donne le nom avant la quantité', () => {
  it(
    'clause 4 — sur la fiche, CHAQUE ligne de CHAQUE recette du catalogue commence par le nom',
    async () => {
      await pourChaqueFiche(recettes(), (recette) => {
        nomPuisQuantite(listeDesIngredientsDeLaFiche(), recette, `la fiche de ${String(recette.id)}`)
      })
    },
    120_000
  )

  // Le composant est PARTAGÉ (ui/ingredients-recette.tsx, en-tête) : cette clause est ce qui rend le
  // partage mesuré au lieu d'affirmé. Une copie locale dans la fiche la ferait rougir.
  it(
    'clause 5 — en mode cuisine, derrière « Voir les ingrédients », la même règle',
    async () => {
      // La recette de référence, PLUS six autres étalées sur le catalogue : le mode cuisine coûte un
      // clic et une fenêtre par montage, on ne le balaie pas en entier — mais un branchement sur un
      // identifiant particulier est déjà mort en clause 4, qui, elle, monte tout.
      const aMontrer = [recetteDeReference(), ...echantillon(recettes(), 6)]
      for (const recette of aMontrer) {
        await monterCuisine(recette.id as string)
        fireEvent.click(screen.getByText('Voir les ingrédients'))
        const fenetre = await screen.findByRole('dialog')
        try {
          nomPuisQuantite(fenetre, recette, `le mode cuisine de ${String(recette.id)}`)
        } finally {
          cleanup()
        }
      }
    },
    120_000
  )

  // ⚠️ GARDES, vertes aujourd'hui, et déclarées telles. Elles ne décrivent aucun défaut : elles
  //    disent ce qu'un correctif trop large casserait, maintenant que le nom passe en tête de ligne.
  it('clause 6 — GARDE : le lien porte le NOM SEUL sur la fiche, et il n’y en a aucun au fourneau', async () => {
    const recette = recetteDeReference()
    const premier = recette.ingredients[0]!
    const nom = nomDeLAliment(premier.foodId as string)

    await monterFiche(recette.id as string)
    const liste = listeDesIngredientsDeLaFiche()
    const lien = within(liste).getByRole('link', { name: nom })
    expect(normaliser(lien.textContent), 'le lien a avalé la quantité ou une mention de contexte').toBe(nom)

    cleanup()
    vi.resetModules()
    await monterCuisine(recette.id as string)
    fireEvent.click(screen.getByText('Voir les ingrédients'))
    const fenetre = await screen.findByRole('dialog')
    expect(
      within(fenetre).queryAllByRole('link'),
      'un lien plein écran est apparu sous un doigt couvert de farine'
    ).toHaveLength(0)
  })

  it('clause 6b — GARDE : « (facultatif) », les 5 étapes et « Cuisiner pas à pas » restent sur la fiche', async () => {
    const recette = recetteDeReference()
    await monterFiche(recette.id as string)

    const facultatifs = recette.ingredients.filter((i) => i.optionnel)
    expect(facultatifs.length, 'la recette de référence n’a plus d’ingrédient facultatif').toBeGreaterThan(0)
    expect(
      texteAffiche().includes('(facultatif)'),
      '« (facultatif) » a disparu de la liste'
    ).toBe(true)

    const gestes = recette.etapes.filter((etape) => etape.nature === 'geste')
    expect(
      document.querySelectorAll('ol li').length,
      `${gestes.length} gestes au catalogue, autant d’étapes attendues à l’écran`
    ).toBe(gestes.length)
    expect(texteAffiche().includes('Cuisiner pas à pas'), 'l’entrée du mode cuisine a disparu').toBe(true)
    expect(screen.getAllByRole('button', { name: /portion/i }).length, 'le sélecteur de portions a disparu')
      .toBeGreaterThan(0)
  })
})

// =================================================================================================
// 4 — l'écran « Recettes » : le compte brut se tait, l'explication reste
// =================================================================================================

describe('lot C — le compteur « N recettes » de l’écran Recettes', () => {
  it('clause 7 — liste pleine : aucun compte de recettes ne se lit à l’écran', async () => {
    await monterRecettes()

    const cartes = cartesAffichees()
    expect(cartes, 'aucune carte affichée : la clause ne mesurerait rien').toBeGreaterThan(0)

    // Précondition de lecture, pas une clause du lot : sur un profil neuf aucune exclusion dure
    // n'écarte de recette, donc l'entonnoir (« N recettes → … = M disponibles ») n'est pas rendu et
    // le seul « <nombre> recette(s) » possible est le compteur. Si elle tombe, c'est le profil de
    // test qui a changé, pas l'écran.
    expect(
      texteAffiche().includes('disponibles'),
      'l’entonnoir est rendu sur un profil neuf : la précondition de la clause 7 a changé'
    ).toBe(false)

    const trouve = COMPTEUR_DE_RECETTES.exec(texteAffiche())
    expect(trouve, `« ${trouve?.[0] ?? ''} » se lit encore sur l’écran Recettes (${cartes} cartes)`)
      .toBe(null)

    // ⭐ LE FILET QUI NE SE CONTOURNE PAS PAR UN SYNONYME, ET C'EST LE SECOND TOUR D'ATTAQUE QUI L'A
    //    EXIGÉ. La ligne ci-dessus cherche le mot « recette(s) » : « 336 résultats trouvés » la
    //    laisse verte alors que le compte brut est toujours là. Ici on cherche LE NOMBRE, quel que
    //    soit le mot posé à côté — on ne peut pas annoncer un compte sans l'écrire.
    //    ⚠️ Le nombre est relu à l'exécution, jamais scellé (leçon de `retour-5c`).
    expect(
      COMPTE_HORS_PARENTHESES(cartes).test(texteAffiche()),
      `le nombre ${cartes} se lit encore sur l’écran Recettes : le compte brut a été reformulé, pas tu`
    ).toBe(false)
  })

  it('clause 7b — liste vide : le compte disparaît, la phrase qui explique reste et se tient seule', async () => {
    await monterRecettes()

    // Une recherche qui ne peut rien trouver — pas un filtre, pour ne pas dépendre d'une facette
    // dont le catalogue déciderait du contenu.
    // ⚠️ `getByLabelText`, PAS `getByRole('searchbox')` : le champ porte un `list=`, ce qui lui donne
    //    le rôle `combobox` et non `searchbox`. Le libellé, lui, ne dépend pas de cette subtilité.
    const champ = screen.getByLabelText(/Rechercher un plat ou un ingrédient/i)
    fireEvent.change(champ, { target: { value: 'zzzqwx' } })
    await waitFor(() => {
      if (cartesAffichees() !== 0) throw new Error('la liste n’est pas encore vide')
    })

    const trouve = COMPTEUR_DE_RECETTES.exec(texteAffiche())
    expect(trouve, `« ${trouve?.[0] ?? ''} » se lit encore sur une liste vide`).toBe(null)

    // ⭐ LA MOITIÉ QUI INTERDIT LA SUPPRESSION SÈCHE. Une liste vide sans explication passe pour un
    //    bug — même raisonnement que l'avertissement de troncature du frigo, que `ui/epure.ts`
    //    exclut explicitement de cet interrupteur. Et la phrase doit se tenir SEULE : aujourd'hui
    //    elle est la queue de « 0 recette — essayez… », retirer le compte devant laisserait une
    //    ligne qui commence par un tiret.
    const ligne = screen.getByText(/essayez de retirer un filtre/i)
    const phrase = normaliser(ligne.textContent)
    expect(/^[A-ZÀ-Þ]/.test(phrase), `« ${phrase} » ne commence pas par une majuscule`).toBe(true)
    expect(phrase.endsWith('.'), `« ${phrase} » ne finit pas par un point`).toBe(true)

    // ⭐ AUCUN CHIFFRE DANS CETTE PHRASE, SOUS AUCUN MOT — second tour d'attaque. « 0 recette »
    //    meurt sur le motif ci-dessus, « 0 résultat trouvé » ne mourrait que là : la phrase qui
    //    explique une liste vide n'a aucune raison de porter un nombre, quel qu'il soit.
    expect(/\d/.test(phrase), `« ${phrase} » porte encore un nombre sur une liste vide`).toBe(false)

    // ⭐ ET LE ZÉRO NE SE RÉFUGIE PAS DANS UN ÉLÉMENT VOISIN. La ligne ci-dessus ne garde que la
    //    phrase ; celle-ci balaie l'écran entier, en laissant hors de portée les seuls comptes que
    //    le lot épargne — ceux que leur parenthèse désigne comme des libellés de bouton.
    expect(
      COMPTE_HORS_PARENTHESES(cartesAffichees()).test(texteAffiche()),
      'un compte de zéro se lit encore sur l’écran, hors des libellés de bouton'
    ).toBe(false)
  })

  it('clause 7c — `jaugesEtCompteurs` commande ce compte : éteint il n’y a rien, rallumé il revient exact', async () => {
    await monterRecettes()
    const cartes = cartesAffichees()
    expect(COMPTEUR_DE_RECETTES.test(texteAffiche()), 'le compte est affiché interrupteur éteint').toBe(
      false
    )

    cleanup()
    vi.resetModules()
    reinitialiserBase()
    // Après le `resetModules`, avant le rendu : sinon on allume une copie que l'écran ne lit pas.
    await rallumerEpure('jaugesEtCompteurs')
    await monterRecettes()

    expect(cartesAffichees(), 'les deux montages ne rendent pas la même liste').toBe(cartes)
    const attendu = `${cartes} recette${cartes > 1 ? 's' : ''}`
    expect(
      texteAffiche().includes(attendu),
      `« ${attendu} » ne revient pas quand on rallume l’interrupteur : le compte a été supprimé, pas masqué`
    ).toBe(true)
  })
})
