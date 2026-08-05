// engine/search/index.ts — recherche et filtrage du catalogue (docs/DESIGN.md §4.4).
//
// ⚠️ CE N'EST PAS UNE COUCHE DE SÉLECTION, et la distinction compte. Les couches de `selection/`
// répondent à « que proposer à cette personne, pour ce repas » — elles jugent. Ici on répond à
// « où est la recette que je cherche », ce qui ne juge rien : aucun score, aucune pondération,
// aucune notion de profil. Mélanger les deux ferait qu'une recherche par nom se mettrait à
// classer selon les goûts, ce qui est déroutant quand on cherche un plat précis.
//
// ⚠️ CE MODULE N'EXCLUT RIEN NON PLUS. Les allergies, le régime et les exclusions restent le
// travail des couches d'exclusion, appelées AVANT par `Engine.browseRecipes`. Refaire ce filtrage
// ici serait la copie du pipeline que l'en-tête de `plan-week.ts` interdit — et sur les allergènes,
// une copie qui dérive affiche un plat dangereux.
//
// Dépendances autorisées : domain/ uniquement — §2/§3 ENGINE.

import type { Catalog, CourseKind, FacetteKind, Recipe, RecipeEnvergure, RecipeId } from '../domain/index.js'
import { COURSE_ORDER } from '../domain/index.js'

/** Marques diacritiques combinantes (U+0300–U+036F), retirées après normalisation NFD. */
const DIACRITIQUES = /[̀-ͯ]/g

/**
 * Minuscules + accents retirés.
 *
 * ⚠️ INDISPENSABLE EN FRANÇAIS, et pas un raffinement. Sans elle, chercher « creme » ne trouve pas
 * « Crème brûlée », « boeuf » ne trouve pas « Bœuf bourguignon » — et l'utilisateur conclut que la
 * recette n'existe pas. Sur un clavier de téléphone, taper les accents est un effort que personne
 * ne fait dans un champ de recherche.
 *
 * Même normalisation que `guards/banned-terms.ts` ; les deux sont volontairement indépendantes,
 * l'une sert la sécurité éditoriale, l'autre le confort de recherche.
 */
export function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITIQUES, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
}

/**
 * Mots vides français. Retirés d'une saisie comme d'un nom : ils n'apportent aucune information et
 * feraient s'apparier « sauce DE tomate » avec n'importe quel nom contenant « de ».
 */
const MOTS_VIDES = new Set(['a', 'au', 'aux', 'd', 'de', 'des', 'du', 'en', 'et', 'l', 'la', 'le', 'les', 'un', 'une'])

/**
 * Pluriel français retiré, sur la forme la plus grossière qui soit : `-s` ou `-x` final au-delà de
 * quatre lettres.
 *
 * ⚠️ ELLE S'APPLIQUE AUX DEUX CÔTÉS, ET C'EST CE QUI LA REND SÛRE. Prise isolément elle est fausse
 * (« anana », « noi »), mais saisie et nom subissent la même déformation : deux mots qui étaient
 * égaux le restent, et deux mots qui diffèrent ne se rejoignent pas. On ne cherche pas à produire du
 * français, seulement une clé de comparaison stable.
 *
 * Le seuil de quatre lettres protège les mots courts qui finissent vraiment par -s ou -x : `riz`,
 * `jus`, `mais`. `noix` passe à `noi` — sans conséquence, `Noix` devient `noi` aussi.
 */
function singulier(mot: string): string {
  return mot.length >= 4 && (mot.endsWith('s') || mot.endsWith('x')) ? mot.slice(0, -1) : mot
}

/** Un texte découpé en mots comparables : normalisés, sans mots vides, au singulier grossier. */
function motsDe(texte: string): readonly string[] {
  return normaliser(texte)
    .split(/[^a-z0-9]+/)
    .filter((mot) => mot.length > 0 && !MOTS_VIDES.has(mot))
    .map(singulier)
}

/**
 * Où le mot apparaît dans le nom, en caractères. `Infinity` s'il n'y figure pas littéralement — le
 * cas d'un pluriel replié (« tomate » apparié à « Tomates » du côté singularisé seulement).
 *
 * ⚠️ C'EST CE QUI TIENT LE CLASSEMENT UTILE, et je l'ai découvert en le cassant : départager sur la
 * seule LONGUEUR du nom mettait « Farine de riz » devant « Riz blanc, cru ». Un nom qui COMMENCE par
 * ce qu'on a tapé désigne l'aliment ; un nom qui le porte au milieu désigne un dérivé.
 */
function positionDe(nomNormalise: string, mot: string): number {
  const i = nomNormalise.indexOf(mot)
  return i === -1 ? Number.POSITIVE_INFINITY : i
}

/** Rangs d'appariement, du plus littéral au plus permissif. Sert de clé de tri primaire. */
const RANG_SOUS_CHAINE = 0
const RANG_TOUS_LES_MOTS = 1
const RANG_UN_MOT = 2

/**
 * Cherche des entrées par leur nom, du plus littéral au plus permissif.
 *
 * ⚠️ POURQUOI PAS UNE SIMPLE SOUS-CHAÎNE, qui était le comportement d'origine : elle échoue dès que
 * la SAISIE EST PLUS LONGUE QUE LE NOM. Mesuré le 2026-08-04 sur 33 saisies du langage courant
 * (décision 58) — « noix de saint-jacques » ne trouvait pas « Coquille Saint-Jacques », « boite de
 * tomates » ne trouvait pas « Tomate », et le champ rendait une liste VIDE. Sur un écran où l'on
 * déclare ce qu'on a dans son frigo, une liste vide se lit « cet aliment n'existe pas » — alors
 * qu'il est au catalogue.
 *
 * Trois rangs, essayés dans l'ordre, et le plus permissif n'est consulté QUE s'il reste de la place :
 * une saisie qui trouve son compte littéralement ne voit jamais d'approximation.
 *
 * ⚠️ CE N'EST PAS UN SCORE DE PERTINENCE ET IL NE S'AFFICHE JAMAIS. Le tri secondaire additionne la
 * longueur des mots appariés — un mot long est plus discriminant qu'un mot court, ce qui met
 * « Tomate, crue » devant « Sauce soja » pour la saisie « sauce tomate ». C'est une heuristique de
 * classement, pas une mesure ; elle reste interne, comme le score du moteur.
 *
 * ⚠️ L'ORDRE EST TOTAL. Le nom départage les ex æquo, sinon deux saisies identiques pourraient rendre
 * deux ordres différents selon l'ordre d'itération de la source.
 *
 * ⚠️ CE MODULE N'EXCLUT TOUJOURS RIEN (voir l'en-tête). Les allergènes et le régime sont filtrés par
 * l'appelant, AVANT. Ce qui entre ici est déjà autorisé ; on ne fait que le retrouver.
 *
 * ⚠️ LIMITE ASSUMÉE, MESURÉE, NON CORRIGÉE : sur un nom seul, aucune règle textuelle ne sait que
 * « Œufs de lump » n'est pas ce qu'on cherche en tapant « oeuf ». Les deux commencent par le mot, le
 * lump a le nom le plus court, il sort premier. Le vrai œuf reste dans les six et remonte en tête dès
 * « oeuf de poule ». Départager demanderait `Food.groupe` ou une sous-famille — donc de la DONNÉE,
 * pas une meilleure heuristique. Ne pas bricoler une exception ici.
 *
 * @param entrees source à parcourir — tout ce qui porte un `nom`, aliment comme recette
 * @param saisie  texte tapé par l'utilisateur, brut
 * @param limite  nombre maximum de résultats rendus
 */
export function chercherParNom<T extends { readonly nom: string }>(
  entrees: Iterable<T>,
  saisie: string,
  limite: number
): readonly T[] {
  const litteral = normaliser(saisie.trim())
  const mots = motsDe(saisie)
  if (litteral.length === 0 || mots.length === 0 || limite <= 0) return []

  const classees: {
    readonly entree: T
    readonly rang: number
    readonly poids: number
    readonly position: number
  }[] = []

  for (const entree of entrees) {
    const nomNormalise = normaliser(entree.nom)
    const motsDuNom = motsDe(entree.nom)
    // Un mot de la saisie est apparié si un mot du nom COMMENCE par lui : « tomat » trouve
    // « tomate », ce qu'exige une autocomplétion où l'on tape au fur et à mesure.
    const apparies = mots.filter((mot) => motsDuNom.some((m) => m.startsWith(mot)))
    if (apparies.length === 0) continue

    const rang = nomNormalise.includes(litteral)
      ? RANG_SOUS_CHAINE
      : apparies.length === mots.length
        ? RANG_TOUS_LES_MOTS
        : RANG_UN_MOT
    classees.push({
      entree,
      rang,
      poids: apparies.reduce((somme, mot) => somme + mot.length, 0),
      position: Math.min(...apparies.map((mot) => positionDe(nomNormalise, mot))),
    })
  }

  classees.sort(
    (a, b) =>
      a.rang - b.rang ||
      b.poids - a.poids ||
      a.position - b.position ||
      a.entree.nom.length - b.entree.nom.length ||
      a.entree.nom.localeCompare(b.entree.nom)
  )

  // Le rang le plus permissif ne complète que si les deux premiers n'ont pas rempli la liste.
  const surs = classees.filter((c) => c.rang !== RANG_UN_MOT)
  const retenues = surs.length >= limite ? surs : classees
  return retenues.slice(0, limite).map((c) => c.entree)
}

/** Filtres de facettes : OU à l'intérieur d'une facette, ET entre facettes. */
export type FiltresFacettes = ReadonlyMap<FacetteKind, readonly string[]>

export interface CritereRecherche {
  /** Texte libre. Vide ou absent = aucun filtrage textuel. */
  readonly texte?: string
  readonly facettes?: FiltresFacettes
  /** Durée totale maximale (préparation + cuisson), en minutes. */
  readonly tempsMaxMin?: number | null
  /**
   * Rôle dans le repas (`CourseKind`) — axe SÉPARÉ des facettes : `recette.service` n'est pas une
   * `RecipeFacet`. Absent ou vide = aucun filtrage, même sémantique que `facettes` (OU dedans, non
   * pertinent entre les deux vu qu'il n'y a qu'un axe ici).
   */
  readonly services?: readonly CourseKind[]
  /** Registre du plat (quotidien/convivial/fête) — même axe séparé, même sémantique OU/vide. */
  readonly envergures?: readonly RecipeEnvergure[]
}

/**
 * Texte indexé d'une recette : son nom, sa description, le NOM de ses ingrédients et ses facettes.
 *
 * §4.4 demande une autocomplétion sur « plats, ingrédients, cuisines » — d'où les trois sources.
 * Chercher « poulet » doit trouver un plat dont le nom ne le mentionne pas mais qui en contient.
 */
function texteIndexe(recette: Recipe, catalog: Catalog): string {
  const morceaux: string[] = [recette.nom, recette.description]
  for (const ingredient of recette.ingredients) {
    const aliment = catalog.foods.get(ingredient.foodId)
    if (aliment !== undefined) morceaux.push(aliment.nom)
  }
  for (const facette of recette.facettes) morceaux.push(facette.valeur)
  return normaliser(morceaux.join(' '))
}

/**
 * Index de recherche, construit une fois pour toutes.
 *
 * ⚠️ À CONSTRUIRE À L'INITIALISATION DU MOTEUR, jamais par frappe. Normaliser 241 recettes et leurs
 * ingrédients à chaque caractère tapé serait recalculer le même travail des dizaines de fois par
 * seconde, sur le fil principal, pendant que l'utilisateur écrit.
 */
export type IndexRecherche = ReadonlyMap<RecipeId, string>

export function construireIndex(catalog: Catalog): IndexRecherche {
  const index = new Map<RecipeId, string>()
  for (const [id, recette] of catalog.recipes) index.set(id, texteIndexe(recette, catalog))
  return index
}

/** Durée totale d'une recette — la seule qui ait un sens pour « ai-je le temps ». */
function dureeTotale(recette: Recipe): number {
  return recette.tempsPrepMin + recette.tempsCuissonMin
}

function correspondAuTexte(index: IndexRecherche, id: RecipeId, motsNormalises: readonly string[]): boolean {
  if (motsNormalises.length === 0) return true
  const texte = index.get(id)
  if (texte === undefined) return false
  // TOUS les mots doivent apparaître : taper « poulet citron » cherche les deux, pas l'un ou
  // l'autre. Un OU rendrait 115 résultats sur deux mots et n'affinerait jamais rien.
  return motsNormalises.every((mot) => texte.includes(mot))
}

function correspondAuxFacettes(recette: Recipe, facettes: FiltresFacettes): boolean {
  for (const [facette, valeurs] of facettes) {
    if (valeurs.length === 0) continue
    const valeursDeLaRecette = recette.facettes.filter((f) => f.facette === facette).map((f) => f.valeur)
    if (!valeurs.some((v) => valeursDeLaRecette.includes(v))) return false
  }
  return true
}

/** `recette.service` peut être `null` (non renseigné) : il ne correspond alors à AUCUN filtre actif,
 *  même raisonnement que partout ailleurs (§5.1 bis) — l'absence d'information n'est pas une valeur. */
function correspondAuService(recette: Recipe, services: readonly CourseKind[]): boolean {
  if (services.length === 0) return true
  return recette.service !== null && services.includes(recette.service)
}

function correspondAEnvergure(recette: Recipe, envergures: readonly RecipeEnvergure[]): boolean {
  if (envergures.length === 0) return true
  return envergures.includes(recette.envergure)
}

/**
 * Filtre `candidats` selon le critère. L'ordre d'entrée est CONSERVÉ — c'est à l'appelant de
 * décider du classement, ce module ne juge pas.
 */
export function filtrerRecettes(
  catalog: Catalog,
  index: IndexRecherche,
  candidats: Iterable<RecipeId>,
  critere: CritereRecherche
): readonly RecipeId[] {
  const mots = normaliser(critere.texte ?? '')
    .split(/\s+/)
    .filter((mot) => mot.length > 0)
  const facettes = critere.facettes ?? new Map()
  const tempsMax = critere.tempsMaxMin ?? null
  const services = critere.services ?? []
  const envergures = critere.envergures ?? []

  const retenues: RecipeId[] = []
  for (const id of candidats) {
    const recette = catalog.recipes.get(id)
    if (recette === undefined) continue
    if (!correspondAuTexte(index, id, mots)) continue
    if (!correspondAuxFacettes(recette, facettes)) continue
    if (!correspondAuService(recette, services)) continue
    if (!correspondAEnvergure(recette, envergures)) continue
    if (tempsMax !== null && dureeTotale(recette) > tempsMax) continue
    retenues.push(id)
  }
  return retenues
}

/**
 * Valeurs réellement présentes pour une facette, avec leur nombre de recettes.
 *
 * ⚠️ DÉRIVÉ DU CATALOGUE, jamais écrit à la main. §4.8 l'exige déjà pour les régimes, et la raison
 * vaut pour tous les filtres : une pastille codée en dur survit à la disparition de son contenu et
 * rend zéro résultat sans que rien n'explique pourquoi. Ordonné par fréquence décroissante — les
 * filtres utiles d'abord.
 */
export function valeursDeFacette(
  catalog: Catalog,
  facette: FacetteKind
): readonly { readonly valeur: string; readonly nombre: number }[] {
  const compte = new Map<string, number>()
  for (const recette of catalog.recipes.values()) {
    for (const f of recette.facettes) {
      if (f.facette === facette) compte.set(f.valeur, (compte.get(f.valeur) ?? 0) + 1)
    }
  }
  return [...compte.entries()]
    .map(([valeur, nombre]) => ({ valeur, nombre }))
    .sort((a, b) => b.nombre - a.nombre || a.valeur.localeCompare(b.valeur))
}

/** Ordre de fête décroissant — le même que celui du type `RecipeEnvergure`, littéral pour ne pas
 *  dépendre d'un tri de chaînes qui n'a aucun sens sémantique ici. */
const ORDRE_ENVERGURE: readonly RecipeEnvergure[] = ['quotidien', 'convivial', 'fete']

/**
 * Valeurs de `service` (`CourseKind`) et `envergure` (`RecipeEnvergure`) réellement présentes au
 * catalogue, avec leur compte — même garantie que `valeursDeFacette` : ni l'une ni l'autre n'écrit
 * de liste à la main, donc `fromage` (0 recette au catalogue réel) n'apparaît dans aucune des deux.
 *
 * ⚠️ ORDONNÉ PAR L'ORDRE DE SERVICE / DE FÊTE (`COURSE_ORDER`, `ORDRE_ENVERGURE`), PAS PAR
 * FRÉQUENCE : contrairement à une facette ouverte (cuisine, style…), ces deux axes sont des enums
 * fermées dont l'ordre naturel — entrée avant plat avant dessert, quotidien avant fête — est plus
 * lisible qu'un tri par popularité qui les mélangerait.
 */
export function valeursDeService(
  catalog: Catalog
): readonly { readonly valeur: CourseKind; readonly nombre: number }[] {
  const compte = new Map<CourseKind, number>()
  for (const recette of catalog.recipes.values()) {
    if (recette.service === null) continue
    compte.set(recette.service, (compte.get(recette.service) ?? 0) + 1)
  }
  return COURSE_ORDER.filter((service) => (compte.get(service) ?? 0) > 0).map((valeur) => ({
    valeur,
    nombre: compte.get(valeur)!,
  }))
}

export function valeursDeEnvergure(
  catalog: Catalog
): readonly { readonly valeur: RecipeEnvergure; readonly nombre: number }[] {
  const compte = new Map<RecipeEnvergure, number>()
  for (const recette of catalog.recipes.values()) {
    compte.set(recette.envergure, (compte.get(recette.envergure) ?? 0) + 1)
  }
  return ORDRE_ENVERGURE.filter((envergure) => (compte.get(envergure) ?? 0) > 0).map((valeur) => ({
    valeur,
    nombre: compte.get(valeur)!,
  }))
}
