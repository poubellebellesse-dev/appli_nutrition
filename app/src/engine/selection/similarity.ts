// engine/selection/similarity.ts — similarité entre deux recettes, pour la diversification MMR
// (docs/ENGINE.md §6.6).
//
// `similarity(a, b) ∈ [0, 1]` combine trois signaux, exactement ceux nommés par §6.6 :
//  - ingrédient principal identique (`catalog.indexes.recipeMainIngredient`, §9.1 ENGINE, déjà
//    peuplé à l'init — voir nutrition/main-ingredient.ts, PAS recalculé ici) ;
//  - famille de cuisine identique (facette `cuisine` de `recipe.facettes`, vocabulaire ouvert) ;
//  - profil sensoriel proche (`sucreSale`/`legerConsistant`/`chaudFroid`, distance euclidienne
//    normalisée + `texture` CATÉGORIELLE recombinée — même traitement que `scoreCraving`,
//    §6.5 précision 2, voir scoring/craving.ts).
//
// ⚠️ PIÈGE DOCUMENTÉ (demandé explicitement par le lot) : ABSENCE ≠ ÉGALITÉ. Deux recettes qui
// n'ont NI l'une ni l'autre d'ingrédient principal connu (`mainIngredientId: null` des deux côtés)
// ne sont PAS réputées similaires sur ce signal — la composante vaut 0, pas 1. Un ingrédient
// principal inconnu ne veut rien dire de comparable ; le traiter comme un match reviendrait à
// gonfler artificiellement la similarité de recettes dont on ne sait justement rien. Même
// raisonnement appliqué à la cuisine (une recette sans facette `cuisine` n'est pas "de la même
// famille" qu'une autre recette sans facette `cuisine`, par cohérence).
//
// Conséquence de ce piège sur l'identité : `similarity(a, a) = 1` tient pour toute recette dont
// AU MOINS l'ingrédient principal et la cuisine sont connus (le cas normal — une recette a par
// construction au moins un ingrédient non-optionnel dans le catalogue réel, voir
// nutrition/main-ingredient.ts). Cette fonction compare des SIGNAUX, pas des identités de recette
// (aucun `RecipeId` en entrée) : une recette dépourvue des DEUX signaux ne peut, par construction,
// atteindre 1 avec elle-même — assumé, pas un bug (voir rapport de lot).
//
// Pondération (constantes nommées ci-dessous, Σ = 1) : l'ingrédient principal pèse le plus
// (0.5) — c'est le signal qui produit littéralement les « 5 variations du même plat » que §6.6
// veut éviter (même protéine/base réemployée). Le profil sensoriel (0.3) capture une redondance
// plus subtile (deux plats différents mais « également légers et froids ») : réel mais plus faible
// que la répétition d'ingrédient. La cuisine (0.2) est le signal le plus grossier : deux recettes
// de la même famille culinaire peuvent être très différentes (curry vs. dal, tous deux « indien »)
// — elle affine sans jamais dominer.
//
// Fonction PURE, sans dépendance à `Catalog` : comme les fonctions `scoreX` de scoring/, elle
// prend en paramètres ce dont elle a besoin (`RecipeSimilarityProfile`), pas un `Catalog` entier —
// testable isolément. `buildSimilarityProfiles` ci-dessous est la SEULE fonction de ce fichier à
// toucher `Catalog` : elle fait le pont, comme le `configure()` d'une `SelectionLayer`.
//
// Dépendances autorisées : domain/, ./scoring/index.js (`clamp01`, même import que
// scoring-pass.ts) — §2/§3 ENGINE.

import type { Catalog, FoodId, RecipeId, SensoryAxes } from '../domain/index.js'
import { clamp01 } from './scoring/index.js'

/** Les trois axes sensoriels NUMÉRIQUES — `texture` reste hors de cette liste, traitée à part. */
const NUMERIC_AXES = ['sucreSale', 'legerConsistant', 'chaudFroid'] as const

/** Écart max par axe = 2 (plage [-1, 1]) ; distance euclidienne max sur 3 axes = 2·√3 — même
 * formule que `scoreCraving` (scoring/craving.ts), généralisée ici aux 3 axes systématiquement
 * (une recette a toujours ses 3 axes renseignés, contrairement à `envie` qui peut n'en demander
 * qu'un sous-ensemble). */
const SENSORY_MAX_DISTANCE = 2 * Math.sqrt(NUMERIC_AXES.length)

/** Ingrédient principal : 0.5 — le signal qui pèse le plus (voir en-tête de fichier). */
export const SIMILARITY_WEIGHT_MAIN_INGREDIENT = 0.5
/** Profil sensoriel : 0.3 — redondance plus subtile que l'ingrédient, mais réelle. */
export const SIMILARITY_WEIGHT_SENSORY = 0.3
/** Famille de cuisine : 0.2 — signal le plus grossier des trois, affine sans dominer. */
export const SIMILARITY_WEIGHT_CUISINE = 0.2

/**
 * Ce dont `similarity` a besoin d'une recette — extrait par `buildSimilarityProfiles` depuis un
 * `Catalog` réel, ou construit à la main en test.
 */
export interface RecipeSimilarityProfile {
  /** `catalog.indexes.recipeMainIngredient.get(recipeId) ?? null` — `null` = inconnu, voir le piège documenté en en-tête. */
  readonly mainIngredientId: FoodId | null
  /** Valeurs de la facette `cuisine` (`recipe.facettes`) — vide = aucune cuisine renseignée. */
  readonly cuisines: readonly string[]
  readonly axes: SensoryAxes
}

function mainIngredientSimilarity(a: FoodId | null, b: FoodId | null): number {
  if (a === null || b === null) return 0 // absence ≠ égalité — voir en-tête de fichier
  return a === b ? 1 : 0
}

function cuisineSimilarity(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0 // même piège absence ≠ égalité, par cohérence
  return a.some((cuisine) => b.includes(cuisine)) ? 1 : 0
}

/** Distance euclidienne sur les 3 axes numériques + `texture` catégorielle recombinée par
 * moyenne — même traitement que `scoreCraving` (§6.5 précision 2, scoring/craving.ts). */
function sensorySimilarity(a: SensoryAxes, b: SensoryAxes): number {
  let sumSquares = 0
  for (const axis of NUMERIC_AXES) {
    const diff = a[axis] - b[axis]
    sumSquares += diff * diff
  }
  const distance = Math.sqrt(sumSquares)
  const euclideanSimilarity = clamp01(1 - distance / SENSORY_MAX_DISTANCE)

  const textureComponent = a.texture === b.texture ? 1 : 0 // catégoriel : match ou pas, jamais une distance

  return clamp01((euclideanSimilarity + textureComponent) / 2)
}

/** Similarité entre deux recettes ∈ [0, 1] (§6.6 ENGINE) — voir en-tête de fichier pour la
 * pondération et le piège absence ≠ égalité. */
export function similarity(a: RecipeSimilarityProfile, b: RecipeSimilarityProfile): number {
  const mainIngredientComponent = mainIngredientSimilarity(a.mainIngredientId, b.mainIngredientId)
  const cuisineComponent = cuisineSimilarity(a.cuisines, b.cuisines)
  const sensoryComponent = sensorySimilarity(a.axes, b.axes)

  return clamp01(
    SIMILARITY_WEIGHT_MAIN_INGREDIENT * mainIngredientComponent +
      SIMILARITY_WEIGHT_CUISINE * cuisineComponent +
      SIMILARITY_WEIGHT_SENSORY * sensoryComponent
  )
}

/**
 * Pont `Catalog` → `RecipeSimilarityProfile`, pour TOUTES les recettes du catalogue — la SEULE
 * fonction de ce fichier à dépendre de `Catalog` (voir en-tête). Réutilisé par le banc CLI
 * (try-engine.ts) et par tout futur appelant de `diversify` (diversify.ts) qui a besoin de
 * construire l'accesseur `similarityOf` attendu par `diversify`.
 */
export function buildSimilarityProfiles(catalog: Catalog): ReadonlyMap<RecipeId, RecipeSimilarityProfile> {
  const profiles = new Map<RecipeId, RecipeSimilarityProfile>()
  for (const recipe of catalog.recipes.values()) {
    const cuisines = recipe.facettes.filter((facette) => facette.facette === 'cuisine').map((facette) => facette.valeur)
    profiles.set(recipe.id, {
      mainIngredientId: catalog.indexes.recipeMainIngredient.get(recipe.id) ?? null,
      cuisines,
      axes: recipe.axes,
    })
  }
  return profiles
}
