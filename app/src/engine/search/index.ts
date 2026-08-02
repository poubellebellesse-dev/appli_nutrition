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
