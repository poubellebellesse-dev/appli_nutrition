// data/user-recipe.ts — les recettes composées par l'utilisateur : forme stockée, et conversion
// vers le type `Recipe` que le moteur consomme.
//
// ⚠️ CE FICHIER NE DOIT IMPORTER AUCUN MODULE NODE (voir l'en-tête de `user-db.ts`). L'import est
// hoisté : un `import 'node:sqlite'` casserait le bundle navigateur même sans être appelé.
//
// ⚠️ AUCUNE VALEUR NUTRITIONNELLE N'EST SAISIE NI STOCKÉE. C'est la règle du projet — « les valeurs
// nutritionnelles ne s'écrivent JAMAIS à la main » — et c'est ce qui rend cette fonctionnalité
// possible sans trahir CIQUAL : une recette utilisateur est une LISTE D'ALIMENTS DU CATALOGUE avec
// leurs quantités. Les nutriments s'en déduisent exactement comme pour une recette du catalogue,
// par `attachDerivedIndexes`. Il n'y a rien à inventer, donc rien à fausser.
//
// ⚠️ LE RÉGIME EST DÉRIVÉ, JAMAIS DEMANDÉ. Personne n'étiquette une recette utilisateur ; sans
// dérivation, un plat composé avec du poisson serait proposé à un végétarien. Voir
// `regimeExigeParIngredients` — règle promue en production pour ce fichier précisément.
//
// CE QUI EST DEMANDÉ À L'UTILISATEUR, ET POURQUOI. Les axes sensoriels (sucré/salé,
// léger/consistant, chaud/froid), la conservation, l'envergure et les créneaux ne se déduisent pas
// des ingrédients. `SensoryAxes` n'est pas nullable — on ne peut donc pas dire « inconnu » sans
// propager un changement de type dans tout le moteur. Trois options, une seule tient :
//   - poser des valeurs neutres → le plat serait mal noté par la couche `craving`, en silence ;
//   - rendre les axes nullables → ripple sur le scoring, le loader et le build, pour un cas ;
//   - DEMANDER → ce sont exactement les questions de l'encart « Dites-moi ce que vous cherchez »,
//     et quelqu'un qui saisit sa propre recette sait si elle se mange chaude ou froide.
// Une VARIANTE, elle, ne demande rien de tout ça : elle hérite de sa recette de base.

import type {
  DietCode,
  Food,
  FoodId,
  Grams,
  MealSlot,
  Month,
  Recipe,
  RecipeEnvergure,
  RecipeFacet,
  RecipeId,
  SensoryAxes,
  Texture,
  CourseKind,
  PiquantLevel,
} from '../engine/domain/index.js'
import { g } from '../engine/domain/index.js'
import { min } from '../engine/domain/index.js'
import { regimeExigeParIngredients } from '../engine/selection/index.js'
import { withTransaction, type UserDb } from './user-db.js'

/** Un ingrédient tel que l'écran le collecte. */
export interface IngredientSaisi {
  readonly foodId: string
  readonly quantiteG: number
  /** Texte figé montré en cuisine (« 2 cuillères à soupe »). Jamais mis à l'échelle par le moteur. */
  readonly uniteAffichage: string
  readonly optionnel: boolean
}

/**
 * Ce qui est réellement écrit dans `user_recipe.contenu_json`.
 *
 * ⚠️ VERSIONNÉ. Le contenu est du JSON libre côté SQLite : aucune migration ne le rattrapera si sa
 * forme change. `schemaVersion` permet de reconnaître une entrée d'une version antérieure et de la
 * refuser proprement plutôt que d'en lire des champs absents — ce qui produirait une recette au
 * régime `undefined`, donc invisible ou pire, proposée à tort.
 */
export interface StoredUserRecipe {
  readonly schemaVersion: 1
  readonly id: string
  readonly source: 'perso' | 'variante'
  /** Recette du catalogue dont celle-ci dérive. `null` pour une création de zéro. */
  readonly baseRecipeId: string | null
  readonly nom: string
  readonly tempsPrepMin: number
  readonly tempsCuissonMin: number
  readonly portionsBase: number
  readonly difficulte: 1 | 2 | 3
  readonly typesRepas: readonly MealSlot[]
  readonly envergure: RecipeEnvergure
  readonly conservationJours: number
  readonly axes: SensoryAxes
  readonly ingredients: readonly IngredientSaisi[]
  readonly etapes: readonly string[]
  /** Facettes héritées de la recette de base (cuisine, style) — le régime, lui, est TOUJOURS dérivé. */
  readonly facettesHeritees: readonly RecipeFacet[]
  /** Hérités d'une recette de base ; `null` sur une création — ni l'un ni l'autre ne se dérive. */
  readonly service: CourseKind | null
  readonly piquant: PiquantLevel | null
}

export const VERSION_CONTENU_RECETTE = 1

/**
 * Toute l'année, pour toute recette utilisateur.
 *
 * ⚠️ CHOIX ASSUMÉ, et l'alternative est pire. On pourrait intersecter les saisons des ingrédients —
 * mais l'intersection est VIDE dès que deux ingrédients ne se chevauchent pas, et une recette sans
 * aucun mois de saison ne serait jamais proposée. Une recette que son auteur a saisie lui-même et
 * qui n'apparaît jamais, sans message, est le pire résultat possible. La saisonnalité continue
 * d'agir au niveau des INGRÉDIENTS, où elle est fiable.
 */
const TOUTE_ANNEE: readonly Month[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

/** Préfixe des identifiants de recette utilisateur — les distingue à l'œil comme au code. */
const PREFIXE = 'perso:'

export function estRecettePerso(id: string): boolean {
  return id.startsWith(PREFIXE)
}

/**
 * Identifiant d'une nouvelle recette utilisateur.
 *
 * ⚠️ L'HORLOGE EST INJECTÉE, jamais lue ici — même règle que partout ailleurs (§3 ENGINE), et
 * c'est ce qui rend la fonction testable. Le suffixe aléatoire évite la collision de deux recettes
 * créées dans la même milliseconde ; l'identifiant n'a aucune valeur sémantique.
 */
export function nouvelIdRecette(horodatage: number, alea: number): string {
  return `${PREFIXE}${horodatage.toString(36)}-${Math.floor(alea * 1e6).toString(36)}`
}

// --- Conversion vers le domaine -------------------------------------------------------------------

/**
 * Transforme une recette stockée en `Recipe`, prête à entrer dans le catalogue.
 *
 * ⚠️ `foods` SERT À DÉRIVER LE RÉGIME, et c'est la seule raison de le passer. Un `foodId` disparu du
 * catalogue est ignoré silencieusement (cas NORMAL, voir `user-schema.ts`) — mais l'ingrédient reste
 * dans la recette : le retirer changerait la recette de l'utilisateur sans le lui dire.
 */
export function versRecette(stockee: StoredUserRecipe, foods: ReadonlyMap<FoodId, Food>): Recipe {
  const ingredients = stockee.ingredients.map((i) => ({
    foodId: i.foodId as FoodId,
    quantiteG: g(i.quantiteG) as Grams,
    uniteAffichage: i.uniteAffichage,
    optionnel: i.optionnel,
  }))

  const regime = regimeExigeParIngredients(
    ingredients.filter((i) => !i.optionnel).map((i) => i.foodId),
    foods
  )

  return {
    id: stockee.id as RecipeId,
    nom: stockee.nom,
    description: '',
    tempsPrepMin: min(stockee.tempsPrepMin),
    tempsCuissonMin: min(stockee.tempsCuissonMin),
    difficulte: stockee.difficulte,
    portionsBase: stockee.portionsBase,
    // Aucune photo : ce champ n'est renseigné nulle part, y compris au catalogue.
    imagePath: null,
    typesRepas: stockee.typesRepas,
    saisonMois: TOUTE_ANNEE,
    envergure: stockee.envergure,
    conservationJours: stockee.conservationJours,
    axes: stockee.axes,
    ingredients,
    etapes: stockee.etapes.map((texte, index) => ({
      ordre: index + 1,
      texte,
      // Pas d'annotation de lexique ni de minuteur : les rattacher demanderait d'analyser un texte
      // libre, et une annotation fausse renverrait vers un geste qui n'est pas celui décrit.
      lexiconIds: [],
      timerS: null,
      timerType: null,
    })),
    // ⚠️ EXACTEMENT UNE facette `regime`, comme toute recette du catalogue (décision 28) : zéro la
    // rendrait invisible à tout filtre de régime, deux rouvriraient le mode de défaillance que
    // `DIET_CHAIN` existe pour éviter. Les facettes héritées sont filtrées de leur régime éventuel,
    // qui viendrait de la recette de BASE et ne vaut plus après substitution d'un ingrédient.
    facettes: [
      ...stockee.facettesHeritees.filter((f) => f.facette !== 'regime'),
      { facette: 'regime', valeur: regime satisfies DietCode },
    ],
    // ⚠️ `service` et `piquant` : hérités pour une variante, `null` pour une création. Ni l'un ni
    // l'autre ne se DÉRIVE — la documentation de `Recipe.piquant` est explicite, il est éditorial
    // et « ne surtout pas le recalculer depuis `Food.piquant` : ce serait faux ». Aucune couche ne
    // les lit aujourd'hui ; `null` dit « non renseigné », ce qui est la vérité.
    service: stockee.service ?? null,
    piquant: stockee.piquant ?? null,
  }
}

// --- Persistance ----------------------------------------------------------------------------------

/**
 * Relit toutes les recettes utilisateur.
 *
 * ⚠️ UNE ENTRÉE ILLISIBLE EST IGNORÉE, PAS PROPAGÉE. `contenu_json` est du texte libre : un JSON
 * corrompu, tronqué par un disque plein, ou écrit par une version future ne doit pas empêcher
 * l'application de démarrer. Elle disparaît des propositions — visible et rattrapable — plutôt que
 * de faire échouer le chargement du catalogue entier.
 */
export function readUserRecipes(db: UserDb): readonly StoredUserRecipe[] {
  const lignes = db.all<{ readonly contenu_json: string }>(
    'SELECT contenu_json FROM user_recipe ORDER BY importe_le DESC, id'
  )
  const recettes: StoredUserRecipe[] = []
  for (const ligne of lignes) {
    const lue = analyser(ligne.contenu_json)
    if (lue !== null) recettes.push(lue)
  }
  return recettes
}

/** `null` si le contenu est illisible ou d'une version inconnue — jamais une exception. */
function analyser(json: string): StoredUserRecipe | null {
  try {
    const brut: unknown = JSON.parse(json)
    if (typeof brut !== 'object' || brut === null) return null
    const candidate = brut as Partial<StoredUserRecipe>
    if (candidate.schemaVersion !== VERSION_CONTENU_RECETTE) return null
    if (typeof candidate.id !== 'string' || typeof candidate.nom !== 'string') return null
    if (!Array.isArray(candidate.ingredients)) return null
    return candidate as StoredUserRecipe
  } catch {
    return null
  }
}

export function saveUserRecipe(db: UserDb, recette: StoredUserRecipe, importeLe: string): void {
  withTransaction(db, () => {
    // `INSERT … ON CONFLICT DO UPDATE` et NON `INSERT OR REPLACE` : `user_recipe_note` référence
    // `recipe_id`, et REPLACE supprime la ligne avant de la réinsérer — les notes suivraient.
    db.run(
      `INSERT INTO user_recipe (id, source, contenu_json, importe_le) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET source = excluded.source, contenu_json = excluded.contenu_json`,
      [recette.id, recette.source, JSON.stringify(recette), importeLe]
    )
  })
}

export function deleteUserRecipe(db: UserDb, id: string): void {
  db.run('DELETE FROM user_recipe WHERE id = ?', [id])
}

// --- Fabrication -----------------------------------------------------------------------------------

/** Ce que l'écran collecte, hors ce qui s'hérite ou se dérive. */
export interface SaisieRecette {
  readonly nom: string
  readonly tempsPrepMin: number
  readonly tempsCuissonMin: number
  readonly portionsBase: number
  readonly difficulte: 1 | 2 | 3
  readonly typesRepas: readonly MealSlot[]
  readonly envergure: RecipeEnvergure
  readonly conservationJours: number
  readonly axes: SensoryAxes
  readonly ingredients: readonly IngredientSaisi[]
  readonly etapes: readonly string[]
}

export const AXES_PAR_DEFAUT: SensoryAxes = {
  sucreSale: -1,
  legerConsistant: 0,
  chaudFroid: 1,
  texture: 'moelleux' satisfies Texture,
}

/**
 * Une variante : tout ce qui ne se dérive pas vient de la recette de base.
 *
 * C'est l'intérêt entier de la variante — l'utilisateur change deux ingrédients, il n'a pas à
 * répondre à des questions sur la texture ou la conservation d'un plat qu'il n'a fait que modifier.
 */
export function variantePartantDe(base: Recipe): SaisieRecette {
  return {
    nom: `${base.nom} (ma version)`,
    tempsPrepMin: base.tempsPrepMin,
    tempsCuissonMin: base.tempsCuissonMin,
    portionsBase: base.portionsBase,
    difficulte: base.difficulte,
    typesRepas: base.typesRepas,
    envergure: base.envergure,
    conservationJours: base.conservationJours,
    axes: base.axes,
    ingredients: base.ingredients.map((i) => ({
      foodId: i.foodId,
      quantiteG: i.quantiteG,
      uniteAffichage: i.uniteAffichage,
      optionnel: i.optionnel,
    })),
    etapes: base.etapes.map((e) => e.texte),
  }
}

/** Assemble la forme stockée. `base` non nul ⇒ variante, et ses facettes non-régime sont héritées. */
export function construireRecette(
  id: string,
  saisie: SaisieRecette,
  base: Recipe | null
): StoredUserRecipe {
  return {
    schemaVersion: VERSION_CONTENU_RECETTE,
    id,
    source: base === null ? 'perso' : 'variante',
    baseRecipeId: base?.id ?? null,
    nom: saisie.nom.trim(),
    tempsPrepMin: saisie.tempsPrepMin,
    tempsCuissonMin: saisie.tempsCuissonMin,
    portionsBase: saisie.portionsBase,
    difficulte: saisie.difficulte,
    typesRepas: saisie.typesRepas,
    envergure: saisie.envergure,
    conservationJours: saisie.conservationJours,
    axes: saisie.axes,
    ingredients: saisie.ingredients,
    etapes: saisie.etapes.map((e) => e.trim()).filter((e) => e !== ''),
    facettesHeritees: base?.facettes.filter((f) => f.facette !== 'regime') ?? [],
    service: base?.service ?? null,
    piquant: base?.piquant ?? null,
  }
}

/**
 * Ce qui empêche d'enregistrer. Liste de phrases, vide si tout va bien.
 *
 * On valide ICI et pas dans l'écran : ces règles doivent tenir quelle que soit la manière dont la
 * recette arrive (saisie, variante, et un jour un import).
 */
export function problemes(saisie: SaisieRecette): readonly string[] {
  const messages: string[] = []
  if (saisie.nom.trim() === '') messages.push('Donnez un nom à votre recette.')
  if (saisie.ingredients.length === 0) messages.push('Ajoutez au moins un ingrédient.')
  if (saisie.ingredients.some((i) => i.quantiteG <= 0)) {
    messages.push('Chaque ingrédient a besoin d’une quantité supérieure à zéro.')
  }
  // ⚠️ AU MOINS UN INGRÉDIENT INDISPENSABLE, et ce n'est pas du zèle. Le régime se dérive des
  // ingrédients NON optionnels — un plat où tout est facultatif n'en a aucun, et
  // `regimeExigeParIngredients` rend alors `omnivore` faute de pouvoir affirmer quoi que ce soit :
  // la recette disparaît pour tout régime déclaré, sans un mot. Le cas s'est produit en pilotant
  // l'écran, et rien ne l'a arrêté.
  if (saisie.ingredients.length > 0 && saisie.ingredients.every((i) => i.optionnel)) {
    messages.push('Au moins un ingrédient doit être indispensable — sinon le plat n’a pas de base.')
  }
  if (saisie.portionsBase <= 0) messages.push('Indiquez pour combien de portions.')
  if (saisie.typesRepas.length === 0) messages.push('Choisissez au moins un moment de repas.')
  // Un plat qui n'est ni préparé ni cuit ne se distingue pas d'une saisie abandonnée.
  if (saisie.tempsPrepMin + saisie.tempsCuissonMin <= 0) {
    messages.push('Indiquez un temps de préparation ou de cuisson.')
  }
  return messages
}
