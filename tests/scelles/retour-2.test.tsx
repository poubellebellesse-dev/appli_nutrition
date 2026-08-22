// @vitest-environment jsdom
//
// tests/scelles/retour-2.test.tsx — l'examen du lot `retour-2` : le sélecteur « Aliments que je ne
// veux pas » s'ouvre aux 451 aliments du catalogue, et plus seulement aux 167 qui portent une
// origine animale.
//
// ⛔ IL DOIT ÊTRE ROUGE LE JOUR OÙ ON L'ÉCRIT. Aujourd'hui le panneau ne connaît que
// `groupesAnimaux(catalogue.foods)` : sept groupes, 167 aliments dépliables, aucun champ de saisie.
// Les 284 autres — dont les 74 légumes et les 52 condiments — n'ont aucune porte.
//
// ---------------------------------------------------------------------------------------------
// COMMENT CE FICHIER SE DÉFEND
//
// ⛔ AUCUN NOM D'ALIMENT, AUCUN EFFECTIF ÉCRIT EN DUR. Tout se DEMANDE à `catalogueDeTest()`, qui
// charge le `catalog.db` RÉEL (`ui/test-socle.ts:33`). Les clauses 1 et 2 balaient les 451, pas un
// échantillon choisi par l'auteur du test : une implémentation qui n'ouvrirait que « les légumes
// et les fruits » les ferait échouer sur les condiments, et le message dirait lesquels.
//
// ⛔ LA CLAUSE 2 NE CONNAÎT PAS LA FORME DES FAMILLES. Elle ne cherche ni un libellé, ni un nombre
// de sections : elle CRAWLE le panneau — tout élément portant `aria-expanded` est un dépliant, on
// les ouvre un par un et on relève ce qui s'affiche. `aria-expanded` n'est pas un choix arbitraire
// du test : c'est déjà la marque des dépliants internes de cet écran (`parametres.tsx:1539`,
// « Voir les N aliments », et « Voir les allergènes réglementaires » juste à côté), et ⛔ la règle
// de l'appli l'interdit à tout ce qui OUVRE UNE FENÊTRE — celles-là portent `aria-haspopup="dialog"`.
// Un dépliant qui ne serait pas annoncé aux lecteurs d'écran resterait donc invisible pour ce test,
// et c'est voulu : un aliment qu'aucune technologie d'assistance ne peut atteindre n'est pas atteint.
//
// ⛔ LE CRAWLER REPLIE TOUT AVANT CHAQUE OUVERTURE. Sinon une implémentation à un seul dépliant
// ouvert à la fois (celle d'aujourd'hui : `const [deplie, setDeplie] = useState(null)`) fermerait
// silencieusement la section précédente et le relevé serait partiel — un faux rouge.
//
// ⛔ ET IL RETRANCHE CE QUI EST DÉJÀ LÀ AVANT LE PREMIER CLIC. Trois attaques ont été portées
// contre une version antérieure de ce fichier ; les trois passaient, et les trois sont fermées ici.
//   1. **jsdom ne calcule aucun rendu.** Un accordéon qui monterait ses 451 lignes en permanence et
//      les masquerait par une CLASSE CSS (`display:none`) au lieu d'un `{ouvert && …}` était relevé
//      comme « affiché » — alors qu'aucun lecteur d'écran, aucun doigt, ne l'atteint. Un nom n'est
//      donc « atteint » que s'il apparaît APRÈS un clic et qu'il était ABSENT tout replié.
//   2. **Un unique dépliant « Tous les aliments (451) » passait la clause 2.** C'est la lettre du
//      « Fini quand », pas son esprit : une liste plate de 451 lignes n'est pas un parcours. La
//      seconde clause 2 exige donc au moins autant de portes que le catalogue a de familles, et
//      qu'AUCUNE ne soit plus grosse que la plus grosse famille.
//   3. **Un `getByText` unique faisait un FAUX ROUGE en clause 6.** Le même aliment aura plusieurs
//      cases — recherche, famille, liste des retraits. `uneCase()` tolère la multiplicité et ne
//      lève que sur la DIVERGENCE d'état : c'est le défaut cherché, pas le nombre d'occurrences.
//
// ⛔ DEUXIÈME ATTAQUE, DEUX TROUS DE PLUS — 9 assertions sur 11 passaient. Une seule triche les
// ouvrait toutes les deux : découper le catalogue en paquets de taille égale et passer
// `groupeRetire: false` en dur.
//   4. **La clause 2 ne regardait que des NOMBRES.** « Assez de portes, aucune trop grosse » : un
//      découpage en quatorze paquets de trente-trois aliments pris dans l'ordre d'itération de la
//      Map satisfaisait les deux bornes sans réunir quoi que ce soit de reconnaissable. → Chaque
//      dépliant peuplé doit avoir un CRITÈRE COMMUN au catalogue (`critereCommun`), et il y a
//      désormais une borne HAUTE au nombre de dépliants, sinon un bouton par aliment passait aussi.
//   5. **La clause 6 ne se jouait que par le CHAMP DE RECHERCHE.** Une implémentation qui figeait
//      `groupeRetire: false` dans le parcours par familles — donc qui écrivait un RETRAIT là où il
//      fallait une EXCEPTION — n'était vue par aucune assertion. → Un second test rejoue la clause 6
//      par la porte « famille », et exige que l'aliment soit atteint par DEUX dépliants, pas un.
//
// ⛔ LA CLAUSE 1 NE SE CONTENTE PAS DE « LE NOM EST QUELQUE PART DANS LE PANNEAU ». Un panneau qui
// afficherait les 451 noms en permanence la passerait, et passerait aussi la 2. Le test exige donc
// EN PLUS que le champ FILTRE : après avoir tapé le nom d'un aliment, le nom d'un autre aliment,
// choisi pour n'avoir aucun mot en commun avec lui, ne doit pas être affiché.
//
// ⛔ ON NE VÉRIFIE JAMAIS QU'UNE CASE BASCULE — C'EST LA CHAÎNE ENTIÈRE OU RIEN. Les clauses 4 et 5
// passent par `suggestMeals` à travers un socle reconstruit depuis la base courante, exactement
// comme `parametres.test.tsx`. Une case qui s'allume sans que le moteur bouge ne prouve rien : ce
// défaut a déjà eu lieu sur les allergies, et c'est la raison d'être de cet écran.
//
// ⛔ LA CLAUSE 6 EXISTE PARCE QUE LE MÊME ALIMENT AURA DEUX PORTES. Un œuf atteint par la recherche
// et le même œuf atteint dans le dépliant de « Œufs » doivent écrire dans la MÊME table et afficher
// le MÊME état. Une seconde porte qui écrirait un `user_excluded_food` là où le dépliant écrit un
// `user_group_exception` ferait dire au panneau une chose et à la base une autre.
//
// ⚠️ CE QUE CE FICHIER NE PROUVERA PAS. Qu'un champ de saisie et une liste de 74 légumes soient
// utilisables au pouce sur un téléphone. jsdom ne mesure ni position, ni hauteur, ni ce que le
// clavier virtuel recouvre. ▶ Passe à l'œil, `CONCEPTION_RETOURS_TEST.md` §3.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Food, FoodId, RecipeId } from '../../app/src/engine/domain/index.js'
import { groupeAnimalDe } from '../../app/src/engine/domain/index.js'
import {
  baseCourante,
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

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
})
afterEach(cleanup)

const PANNEAU = 'Aliments que je ne veux pas'

/** Monte l'écran Paramètres réel. ⚠️ `ProvenanceLancerParcours` en import DYNAMIQUE — un import
 *  statique figerait un `Context` React distinct de celui que l'écran utilise (`courses.test.tsx`). */
async function monter(): Promise<void> {
  const { Parametres } = await import('../../app/src/ui/screens/parametres.js')
  const { ProvenanceLancerParcours } = await import('../../app/src/ui/lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Parametres />
    </ProvenanceLancerParcours>
  )
  await waitFor(() => {
    if (document.querySelector('h1') === null) throw new Error('écran pas encore monté')
  })
}

/** Ouvre le panneau et rend les requêtes SCOPÉES à lui : la ligne ouvrante reste montée en dessous
 *  et son résumé peut porter exactement le même texte qu'un champ à l'intérieur. */
function ouvrir(): ReturnType<typeof within> {
  fireEvent.click(screen.getByText(PANNEAU))
  return within(screen.getByRole('dialog'))
}

/**
 * Le champ de recherche du panneau. ⛔ CHERCHÉ PAR RÔLE, JAMAIS PAR CLASSE NI PAR `data-testid` :
 * `searchbox` d'abord (`<input type="search">`, la forme déjà retenue sur Frigo et Courses), sinon
 * un `textbox`. Un champ qui n'aurait aucun de ces deux rôles ne serait pas annonçable.
 */
function champ(panneau: ReturnType<typeof within>): HTMLElement {
  const champs = [...panneau.queryAllByRole('searchbox'), ...panneau.queryAllByRole('textbox')]
  if (champs.length === 0) throw new Error('aucun champ de recherche dans le panneau')
  if (champs.length > 1) throw new Error(`${champs.length} champs de saisie : lequel cherche ?`)
  return champs[0] as HTMLElement
}

function taper(champDeSaisie: HTMLElement, valeur: string): void {
  fireEvent.change(champDeSaisie, { target: { value: valeur } })
}

/** Tous les textes affichés dans le panneau, feuille par feuille. `Case` rend son libellé dans un
 *  `<span>` propre — un nom d'aliment y est donc le texte EXACT d'un élément, jamais un fragment. */
function textesAffiches(): ReadonlySet<string> {
  const vus = new Set<string>()
  for (const el of screen.getByRole('dialog').querySelectorAll('span, p, li, button, option')) {
    const texte = el.textContent?.trim()
    if (texte !== undefined && texte !== '') vus.add(texte)
  }
  return vus
}

/** Les dépliants internes du panneau, dans l'ordre du DOM. */
function dépliants(): HTMLElement[] {
  return [...screen.getByRole('dialog').querySelectorAll<HTMLElement>('[aria-expanded]')]
}

/** Referme tous les dépliants ouverts. Appelé AVANT chaque ouverture : sans ça, une implémentation
 *  à un seul dépliant ouvert à la fois fermerait la section précédente et le relevé serait partiel. */
function replierTout(): void {
  for (const b of dépliants()) if (b.getAttribute('aria-expanded') === 'true') fireEvent.click(b)
}

/**
 * Ouvre CHAQUE dépliant, un par un, et rend pour chacun les NOMS D'ALIMENTS QU'IL RÉVÈLE.
 *
 * ⛔ « RÉVÈLE » = affiché une fois ouvert ET ABSENT TANT QUE TOUT EST REPLIÉ. C'est la seule
 * définition qui résiste, et elle vient d'une attaque contre une version antérieure de ce fichier :
 * jsdom ne calcule aucun rendu, donc un accordéon qui monterait ses 451 lignes en permanence et se
 * contenterait de les masquer en CSS (`display:none` par une classe, plutôt que `{ouvert && …}`)
 * serait relevé comme « affiché » alors qu'aucun lecteur d'écran ne l'atteindrait jamais. En
 * retranchant ce qui est là AVANT tout clic, un tel panneau ne révèle plus rien du tout.
 */
function releveDesDepliants(): readonly (readonly string[])[] {
  replierTout()
  const socle = textesAffiches()
  const parDepliant: string[][] = []
  for (let i = 0; i < 200; i++) {
    replierTout()
    if (i >= dépliants().length) break
    const cible = dépliants()[i]
    if (cible === undefined) break
    fireEvent.click(cible)
    const apres = textesAffiches()
    parDepliant.push(NOMS_DALIMENTS.filter((nom) => apres.has(nom) && !socle.has(nom)))
  }
  replierTout()
  return parDepliant
}

/** Ouvre les dépliants un par un jusqu'à ce que `nom` s'affiche, et LAISSE celui-là ouvert. */
function deplierJusqua(nom: string): boolean {
  replierTout()
  if (textesAffiches().has(nom)) return true
  for (let i = 0; i < 200; i++) {
    replierTout()
    if (i >= dépliants().length) break
    const cible = dépliants()[i]
    if (cible === undefined) break
    fireEvent.click(cible)
    if (textesAffiches().has(nom)) return true
  }
  return false
}

/**
 * Les cases à cocher d'un aliment affichées dans le panneau — il peut y en avoir PLUSIEURS : le même
 * aliment sera atteignable par la recherche, par sa famille et, s'il est retiré, par la liste des
 * retraits en cours.
 *
 * ⛔ ET C'EST LÀ QUE LA CLAUSE 6 SE JOUE : si deux d'entre elles n'affichent pas le même
 * `aria-pressed`, le panneau dit deux choses contradictoires sur le même aliment, et ce test lève
 * plutôt que d'en croire une au hasard. ⚠️ Un `getByText` unique aurait fait un FAUX ROUGE ici : la
 * multiplicité n'est pas un défaut, la divergence en est un.
 */
function cases(nom: string): HTMLElement[] {
  const trouvees = new Set<HTMLElement>()
  for (const el of within(screen.getByRole('dialog')).queryAllByText(nom)) {
    const bouton = el.closest('button')
    if (bouton !== null && bouton.hasAttribute('aria-pressed')) trouvees.add(bouton)
  }
  return [...trouvees]
}

/** L'unique état cochable d'un aliment, quel que soit le nombre d'endroits où il s'affiche. */
function uneCase(nom: string): HTMLElement {
  const trouvees = cases(nom)
  const premiere = trouvees[0]
  if (premiere === undefined) throw new Error(`aucune case cochable pour « ${nom} »`)
  const etats = new Set(trouvees.map((b) => b.getAttribute('aria-pressed')))
  if (etats.size > 1) {
    throw new Error(`« ${nom} » affiché dans deux états à la fois : ${[...etats].join(' / ')}`)
  }
  return premiere
}

/** Les recettes que le moteur propose, à travers un socle reconstruit depuis la base courante. */
async function suggestions(): Promise<readonly RecipeId[]> {
  const { chargerSocle } = await import('../../app/src/ui/socle.js')
  const socle = await chargerSocle()
  const { readUserState } = await import('../../app/src/data/user-store.js')
  const etat = readUserState(socle.db, { windowDays: 21, today: '2026-08-01' }, socle.catalogue.foods)
  return socle.moteur
    .suggestMeals({
      profile: {
        trancheAge: '30_49',
        sexe: 'NP',
        tailleCm: null,
        poidsKg: null,
        niveauActivite: 'actif',
        facteurPortion: 1,
      },
      constraints: etat.constraints,
      tolerancePiquant: null,
      context: {
        date: '2026-08-01',
        creneau: 'diner',
        envie: null,
        tempsDisponibleMin: null,
        requiredFoodIds: [],
        pantryFoodIds: [],
      },
      history: etat.history,
      preferences: etat.preferences,
      favoriteRecipeIds: etat.favoriteRecipeIds,
      activeTopics: etat.activeTopics,
      seed: 1,
      limit: 400,
    })
    .suggestions.map((s) => s.recipeId)
}

// --- Ce que le catalogue RÉEL dit, demandé et jamais supposé -------------------------------------

const catalogue = catalogueDeTest()
const ALIMENTS: readonly Food[] = [...catalogue.foods.values()]
const NOMS_DALIMENTS: readonly string[] = [...new Set(ALIMENTS.map((f) => f.nom))]

/**
 * Les familles du catalogue, regroupées par `Food.groupe` — le MÊME critère que la fonction privée
 * `famillesDuCatalogue` (`ui/parcours-aliments.tsx`) que le lot doit exporter et appeler.
 *
 * ⛔ RECALCULÉES ICI, ET NULLE PART AILLEURS. Dans le code de production, une seconde liste de
 * familles serait une divergence en puissance ; dans un test d'acceptation, dériver l'attendu du
 * catalogue est la seule façon de ne pas parier sur son contenu.
 */
const FAMILLES: ReadonlyMap<string, readonly Food[]> = (() => {
  const par = new Map<string, Food[]>()
  for (const f of ALIMENTS) {
    const liste = par.get(f.groupe)
    if (liste === undefined) par.set(f.groupe, [f])
    else liste.push(f)
  }
  return par
})()
/** Les aliments qu'aucun des sept groupes animaux ne rattrape — ceux qui n'ont aucune porte. */
const SANS_GROUPE_ANIMAL: readonly Food[] = ALIMENTS.filter(
  (f) => groupeAnimalDe(f, catalogue.foods) === null
)

/** Les groupes animaux réellement peuplés — les sept dépliants que le panneau rend AUJOURD'HUI, et
 *  qui doivent survivre au lot : le lot ajoute une porte, il n'en retire aucune. */
const GROUPES_ANIMAUX: ReadonlyMap<string, readonly Food[]> = (() => {
  const par = new Map<string, Food[]>()
  for (const f of ALIMENTS) {
    const g = groupeAnimalDe(f, catalogue.foods)
    if (g === null) continue
    const liste = par.get(g)
    if (liste === undefined) par.set(g, [f])
    else liste.push(f)
  }
  return par
})()

const PAR_NOM: ReadonlyMap<string, readonly Food[]> = (() => {
  const par = new Map<string, Food[]>()
  for (const f of ALIMENTS) {
    const liste = par.get(f.nom)
    if (liste === undefined) par.set(f.nom, [f])
    else liste.push(f)
  }
  return par
})()

/**
 * Ce que TOUS les aliments d'un dépliant ont en commun DANS LE CATALOGUE, ou `null` s'ils n'ont
 * rien en commun.
 *
 * ⛔ CETTE FONCTION EXISTE À CAUSE D'UNE ATTAQUE QUI A RÉUSSI. Une version antérieure de la
 * clause 2 ne vérifiait que deux inégalités — assez de portes, aucune trop grosse. Un composant
 * qui découpait le catalogue en **quatorze paquets de taille égale**, sans le moindre rapport avec
 * `Food.groupe`, les satisfaisait toutes les deux : quatorze dépliants de trente-trois aliments
 * pris dans l'ordre d'itération de la Map. Le compte était juste et le parcours ne voulait rien
 * dire. « Je reconnais les endives dans une liste » (décision 58) ne survit pas à ça.
 *
 * Deux critères sont acceptés, parce que le panneau en portera deux : la **famille** (`Food.groupe`,
 * ce que le lot ajoute) et le **groupe animal** (ce qui existe déjà et ne bouge pas).
 */
function critereCommun(noms: readonly string[]): string | null {
  if (noms.length === 0) return null
  const alimentsDe = (nom: string): readonly Food[] => PAR_NOM.get(nom) ?? []

  const famille = [...FAMILLES.keys()].find((cle) =>
    noms.every((nom) => alimentsDe(nom).some((f) => f.groupe === cle))
  )
  if (famille !== undefined) return `famille « ${famille} »`

  const groupe = [...GROUPES_ANIMAUX.keys()].find((cle) =>
    noms.every((nom) => alimentsDe(nom).some((f) => groupeAnimalDe(f, catalogue.foods) === cle))
  )
  if (groupe !== undefined) return `groupe animal « ${groupe} »`

  return null
}

/** L'aliment sans groupe animal porté par le PLUS de recettes : celui dont le retrait doit se voir
 *  le plus sûrement dans ce que le moteur propose. Choisi par mesure, pas par intuition. */
const LE_PLUS_PORTE: Food = (() => {
  const usages = new Map<FoodId, number>()
  for (const recette of catalogue.recipes.values()) {
    for (const ingredient of recette.ingredients) {
      usages.set(ingredient.foodId, (usages.get(ingredient.foodId) ?? 0) + 1)
    }
  }
  const tete = [...SANS_GROUPE_ANIMAL].sort(
    (a, b) => (usages.get(b.id) ?? 0) - (usages.get(a.id) ?? 0) || a.id.localeCompare(b.id)
  )[0]
  if (tete === undefined) throw new Error('aucun aliment hors des sept groupes animaux')
  return tete
})()

describe('retour-2 — clause 1 : aucun des aliments n’est introuvable en tapant son nom', () => {
  it('⛔ CHACUN DES ALIMENTS DU CATALOGUE APPARAÎT QUAND ON TAPE SON NOM EXACT', async () => {
    await monter()
    const panneau = ouvrir()
    const saisie = champ(panneau)

    const introuvables: string[] = []
    for (const aliment of ALIMENTS) {
      taper(saisie, aliment.nom)
      if (!textesAffiches().has(aliment.nom)) introuvables.push(aliment.nom)
    }

    expect({ introuvables: introuvables.length, exemples: introuvables.slice(0, 12) }).toEqual({
      introuvables: 0,
      exemples: [],
    })
  })

  it('⛔ ET LE CHAMP FILTRE VRAIMENT — sinon afficher les 451 en permanence passerait la clause', async () => {
    // Deux aliments qui ne partagent aucun mot : taper l'un ne doit pas laisser l'autre affiché.
    const mots = (f: Food): ReadonlySet<string> =>
      new Set(f.nom.toLowerCase().split(/[^a-zàâäéèêëîïôöùûüç]+/).filter((m) => m.length > 2))
    const premier = ALIMENTS[0]
    if (premier === undefined) throw new Error('catalogue vide')
    const motsDuPremier = mots(premier)
    const etranger = ALIMENTS.find(
      (f) => f.id !== premier.id && [...mots(f)].every((m) => !motsDuPremier.has(m))
    )
    if (etranger === undefined) throw new Error('catalogue trop homogène pour ce test')

    await monter()
    const panneau = ouvrir()
    taper(champ(panneau), premier.nom)

    const affiches = textesAffiches()
    expect(affiches.has(premier.nom)).toBe(true)
    expect(affiches.has(etranger.nom)).toBe(false)
  })
})

describe('retour-2 — clause 2 : aucun aliment n’est injoignable sans rien taper', () => {
  it('⛔ TOUT LE CATALOGUE S’ATTEINT EN DÉPLIANT — la moitié de la décision 58', async () => {
    await monter()
    ouvrir()

    const atteints = new Set(releveDesDepliants().flat())
    const injoignables = ALIMENTS.filter((f) => !atteints.has(f.nom)).map((f) => f.nom)

    expect({ injoignables: injoignables.length, exemples: injoignables.slice(0, 12) }).toEqual({
      injoignables: 0,
      exemples: [],
    })
  })

  it('⛔ ET C’EST UN PARCOURS PAR FAMILLES — ni un mégamenu, ni des paquets arbitraires', async () => {
    // Trois formes fausses satisfont la clause précédente, et les trois sont refusées ici :
    //   · UN SEUL dépliant « Tous les aliments (451) » — « une suite de clics » réduite à un clic,
    //     et 451 lignes d'affilée, exactement le geste que la décision 58 a refusé.
    //   · UN BOUTON PAR ALIMENT — 451 dépliants d'un aliment chacun : chaque borne de taille est
    //     respectée et il n'y a plus de parcours du tout.
    //   · QUATORZE PAQUETS DE TAILLE ÉGALE découpés dans l'ordre d'itération de la Map — le compte
    //     tombe juste, et aucun dépliant ne réunit quoi que ce soit de reconnaissable.
    // ⛔ LES QUATRE BORNES SE DEMANDENT AU CATALOGUE, aucune n'est écrite dans ce fichier.
    await monter()
    ouvrir()

    const parDepliant = releveDesDepliants()
    const peuples = parDepliant.filter((noms) => noms.length > 0)
    const plusGrosDepliant = Math.max(0, ...parDepliant.map((noms) => noms.length))
    const plusGrosseFamille = Math.max(...[...FAMILLES.values()].map((f) => f.length))
    const arbitraires = peuples
      .filter((noms) => critereCommun(noms) === null)
      .map((noms) => `${noms.length} aliments sans rien de commun (${noms.slice(0, 4).join(' · ')}…)`)

    // ⚠️ LES NOMBRES PASSENT PAR LE MESSAGE, PAS PAR L'OBJET COMPARÉ : `toEqual` sur des booléens
    // dirait « expected false to be true » sans dire de combien on est loin.
    const constat =
      `${peuples.length} dépliant(s) peuplés, pour ${FAMILLES.size} familles + ` +
      `${GROUPES_ANIMAUX.size} groupes animaux au catalogue ; le plus gros en révèle ` +
      `${plusGrosDepliant} là où la plus grosse famille en compte ${plusGrosseFamille}`

    expect(
      {
        depliantsArbitraires: arbitraires,
        assezDePortes: peuples.length >= FAMILLES.size,
        // ⚠️ « + 3 » DE MARGE, ET C'EST DÉLIBÉRÉ : la forme retenue donne exactement
        // 14 familles + 7 groupes animaux = 21 dépliants, et une borne posée pile à 21 partirait
        // au rouge au premier dépliant de confort. La marge ne rend pas la borne inutile — elle
        // refuse toujours les 451 boutons. En revanche elle REFUSE AUSSI un second niveau de
        // sous-familles : si c'est ça qu'on veut, c'est le brief qui change, pas ce nombre.
        pasUnBoutonParAliment: peuples.length <= FAMILLES.size + GROUPES_ANIMAUX.size + 3,
        pasDeMegamenu: plusGrosDepliant <= plusGrosseFamille,
      },
      constat
    ).toEqual({
      depliantsArbitraires: [],
      assezDePortes: true,
      pasUnBoutonParAliment: true,
      pasDeMegamenu: true,
    })
  })
})

describe('retour-2 — clause 3 : cocher écrit un aliment, immédiatement, et rien d’autre', () => {
  it('⛔ `user_excluded_food` REÇOIT L’ALIMENT, `user_excluded_group` RESTE VIDE', async () => {
    await monter()
    const panneau = ouvrir()
    taper(champ(panneau), LE_PLUS_PORTE.nom)
    fireEvent.click(uneCase(LE_PLUS_PORTE.nom))

    const { readExcludedFoodIds, readExcludedGroupIds, readExcludedFoodIdsDeplies } = await import(
      '../../app/src/data/user-store.js'
    )
    // ⛔ AVANT TOUT « ← Retour » : le geste est le contrat, pas la fermeture du panneau.
    await waitFor(() => expect(readExcludedFoodIds(baseCourante())).toEqual([LE_PLUS_PORTE.id]))
    expect(readExcludedGroupIds(baseCourante())).toEqual([])
    expect(screen.queryByText(/Enregistrer/)).toBeNull()
    expect([...readExcludedFoodIdsDeplies(baseCourante(), catalogue.foods)]).toContain(
      LE_PLUS_PORTE.id
    )
  })
})

describe('retour-2 — clause 4 : le moteur en tient compte', () => {
  it('⛔ RETIRER PAR CETTE PORTE FAIT BAISSER LE NOMBRE DE PLATS PROPOSÉS', async () => {
    const avant = await suggestions()

    await monter()
    const panneau = ouvrir()
    taper(champ(panneau), LE_PLUS_PORTE.nom)
    fireEvent.click(uneCase(LE_PLUS_PORTE.nom))

    const { readExcludedFoodIds } = await import('../../app/src/data/user-store.js')
    await waitFor(() => expect(readExcludedFoodIds(baseCourante())).toEqual([LE_PLUS_PORTE.id]))

    const apres = await suggestions()
    expect(apres.length).toBeLessThan(avant.length)
  })
})

describe('retour-2 — clause 5 : un retrait se défait sans retaper', () => {
  it('⛔ LE PANNEAU LISTE LES RETRAITS EN COURS, ET DÉCOCHER DEPUIS LA LISTE REND LES PLATS', async () => {
    const avant = await suggestions()

    await monter()
    const panneau = ouvrir()
    const saisie = champ(panneau)
    taper(saisie, LE_PLUS_PORTE.nom)
    fireEvent.click(uneCase(LE_PLUS_PORTE.nom))

    const { readExcludedFoodIds } = await import('../../app/src/data/user-store.js')
    await waitFor(() => expect(readExcludedFoodIds(baseCourante())).toEqual([LE_PLUS_PORTE.id]))

    // ⛔ LE CHAMP VIDÉ, LA LISTE RESTE. Sans elle, la case est en ÉCRITURE SEULE : il faudrait se
    // souvenir du mot exact pour revenir dessus.
    taper(saisie, '')
    await waitFor(() => expect(textesAffiches().has(LE_PLUS_PORTE.nom)).toBe(true))

    fireEvent.click(uneCase(LE_PLUS_PORTE.nom))
    await waitFor(() => expect(readExcludedFoodIds(baseCourante())).toEqual([]))

    const apres = await suggestions()
    expect(apres.length).toBe(avant.length)
  })
})

describe('retour-2 — clause 6 : un seul sens par aliment', () => {
  /** Un aliment d'un groupe animal, choisi dans le groupe le plus petit pour que le dépliant reste
   *  court — mais demandé au catalogue, jamais nommé ici. */
  function unAlimentDeGroupe(): Food {
    const groupes = new Map<string, Food[]>()
    for (const f of ALIMENTS) {
      const g = groupeAnimalDe(f, catalogue.foods)
      if (g === null) continue
      const liste = groupes.get(g)
      if (liste === undefined) groupes.set(g, [f])
      else liste.push(f)
    }
    const plusPetit = [...groupes.entries()]
      .filter(([, m]) => m.length >= 2)
      .sort((a, b) => a[1].length - b[1].length || a[0].localeCompare(b[0]))[0]
    if (plusPetit === undefined) throw new Error('aucun groupe animal de deux aliments ou plus')
    const membre = [...plusPetit[1]].sort((a, b) => a.id.localeCompare(b.id))[0]
    if (membre === undefined) throw new Error('groupe animal vide')
    return membre
  }

  it('⛔ SI SON GROUPE EST RETIRÉ, LA SECONDE PORTE ÉCRIT UNE EXCEPTION — PAS UN RETRAIT', async () => {
    const aliment = unAlimentDeGroupe()
    const groupeId = groupeAnimalDe(aliment, catalogue.foods)!

    const { writeExcludedGroupIds, readExcludedFoodIds, readGroupExceptionFoodIds } = await import(
      '../../app/src/data/user-store.js'
    )
    writeExcludedGroupIds(baseCourante(), [groupeId])

    await monter()
    const panneau = ouvrir()
    taper(champ(panneau), aliment.nom)

    // Son groupe est retiré : la case le montre COCHÉ, comme dans le dépliant du groupe.
    const case_ = uneCase(aliment.nom)
    expect(case_.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(case_)
    await waitFor(() => expect(readGroupExceptionFoodIds(baseCourante())).toEqual([aliment.id]))
    // ⚠️ LES DEUX TABLES RESTENT DISJOINTES : une ré-admission n'est pas une exclusion à l'envers.
    expect(readExcludedFoodIds(baseCourante())).toEqual([])
  })

  it('⛔ ET LA PORTE « FAMILLE » DIT LA MÊME CHOSE QUE LA PORTE « GROUPE ANIMAL »', async () => {
    // ⛔ CE TEST EXISTE PARCE QUE LE PRÉCÉDENT NE SUFFISAIT PAS. Il ne jouait la clause 6 que par le
    // CHAMP DE RECHERCHE. Une implémentation qui passait `groupeRetire: false` en dur dans le
    // parcours par familles — donc qui écrivait un RETRAIT là où il fallait une EXCEPTION — passait
    // tout le reste du fichier sans être vue. La sémantique du groupe doit tenir sur les DEUX
    // nouvelles portes, pas sur celle qu'on a pensé à tester.
    const aliment = unAlimentDeGroupe()
    const groupeId = groupeAnimalDe(aliment, catalogue.foods)!

    const { writeExcludedGroupIds, readExcludedFoodIds, readGroupExceptionFoodIds } = await import(
      '../../app/src/data/user-store.js'
    )
    writeExcludedGroupIds(baseCourante(), [groupeId])

    await monter()
    ouvrir()

    // Son groupe animal l'affiche déjà ; sa FAMILLE doit l'afficher aussi. Deux portes, pas une —
    // et c'est ce que le panneau d'aujourd'hui n'a pas.
    const parDepliant = releveDesDepliants()
    const portes = parDepliant.flatMap((noms, i) => (noms.includes(aliment.nom) ? [i] : []))
    expect(
      portes.length,
      `« ${aliment.nom} » n'est atteint que par ${portes.length} dépliant(s)`
    ).toBeGreaterThanOrEqual(2)

    // Par CHACUNE, son groupe étant retiré, il se montre COCHÉ.
    for (const i of portes) {
      replierTout()
      const cible = dépliants()[i]
      if (cible === undefined) throw new Error(`le dépliant ${i} a disparu entre deux relevés`)
      fireEvent.click(cible)
      expect(uneCase(aliment.nom).getAttribute('aria-pressed'), `par le dépliant ${i}`).toBe('true')
    }

    // Et le clic, PAR LA DERNIÈRE PORTE OUVERTE, écrit une exception — jamais un retrait.
    fireEvent.click(uneCase(aliment.nom))
    await waitFor(() => expect(readGroupExceptionFoodIds(baseCourante())).toEqual([aliment.id]))
    expect(readExcludedFoodIds(baseCourante())).toEqual([])
  })

  it('⛔ ET L’ÉTAT EST LE MÊME DES DEUX CÔTÉS — le dépliant du groupe le montre décoché', async () => {
    const aliment = unAlimentDeGroupe()
    const groupeId = groupeAnimalDe(aliment, catalogue.foods)!

    const { writeExcludedGroupIds, writeGroupExceptionFoodIds } = await import(
      '../../app/src/data/user-store.js'
    )
    writeExcludedGroupIds(baseCourante(), [groupeId])
    writeGroupExceptionFoodIds(baseCourante(), [aliment.id])

    await monter()
    const panneau = ouvrir()

    // Par la recherche. ⛔ `uneCase` JETTE si les deux portes affichent des états différents :
    // c'est exactement le défaut que cette clause cherche, et il ne doit pas passer pour un
    // « introuvable ».
    taper(champ(panneau), aliment.nom)
    expect(uneCase(aliment.nom).getAttribute('aria-pressed')).toBe('false')

    // Par le dépliant du groupe : le même aliment, le même état.
    taper(champ(panneau), '')
    expect(deplierJusqua(aliment.nom), `« ${aliment.nom} » injoignable en dépliant`).toBe(true)
    const parLaFamille = cases(aliment.nom)
    expect(parLaFamille.length).toBeGreaterThan(0)
    expect([...new Set(parLaFamille.map((b) => b.getAttribute('aria-pressed')))]).toEqual(['false'])
  })
})

describe('retour-2 — clause 7 : un seul dialogue, et rien à migrer', () => {
  it('⛔ JAMAIS DEUX `role="dialog"` — ni à l’ouverture, ni en tapant, ni en dépliant', async () => {
    await monter()
    expect(screen.queryAllByRole('dialog').length).toBe(0)

    const panneau = ouvrir()
    expect(screen.getAllByRole('dialog').length).toBe(1)

    taper(champ(panneau), LE_PLUS_PORTE.nom)
    expect(screen.getAllByRole('dialog').length).toBe(1)

    fireEvent.click(uneCase(LE_PLUS_PORTE.nom))
    expect(screen.getAllByRole('dialog').length).toBe(1)

    taper(champ(panneau), '')
    releveDesDepliants() // ouvre CHAQUE dépliant, un par un
    expect(screen.getAllByRole('dialog').length).toBe(1)
  })

  it('⛔ `user_excluded_group` ACCEPTE TOUJOURS SEPT VALEURS, ET LE SCHÉMA N’A PAS CHANGÉ DE VERSION', async () => {
    const { USER_SCHEMA_VERSION } = await import('../../app/src/data/user-schema.js')
    expect(USER_SCHEMA_VERSION).toBe(18)

    const ligne = baseCourante().all<{ readonly sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'user_excluded_group'"
    )[0]
    if (ligne === undefined) throw new Error('table `user_excluded_group` absente')
    expect(ligne.sql.match(/'[a-z_]+'/g)?.length).toBe(7)

    expect(() =>
      baseCourante().run("INSERT INTO user_excluded_group (groupe_id) VALUES ('legumes')")
    ).toThrow()
  })
})
