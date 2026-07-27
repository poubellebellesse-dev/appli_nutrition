// engine/selection/similarity.ts — similarité entre deux recettes, pour la diversification MMR
// (docs/ENGINE.md §6.6).
//
// `similarity(a, b) ∈ [0, 1]` combine trois signaux, exactement ceux nommés par §6.6 :
//  - COMPOSITION proche : chevauchement pondéré des `recipeSignature` (§9.1 ENGINE, peuplées à
//    l'init — voir nutrition/signature.ts, PAS recalculées ici). Ce signal comparait autrefois un
//    SEUL ingrédient, le plus lourd, par égalité stricte ; corrigé après mesure, voir l'en-tête de
//    signature.ts pour les six modèles comparés et les chiffres ;
//  - famille de cuisine identique (facette `cuisine` de `recipe.facettes`, vocabulaire ouvert) ;
//  - profil sensoriel proche (`sucreSale`/`legerConsistant`/`chaudFroid`, distance euclidienne
//    normalisée + `texture` CATÉGORIELLE recombinée — même traitement que `scoreCraving`,
//    §6.5 précision 2, voir scoring/craving.ts).
//
// ⚠️ PIÈGE DOCUMENTÉ (demandé explicitement par le lot) : ABSENCE ≠ ÉGALITÉ. Deux recettes qui
// n'ont NI l'une ni l'autre de signature connue (Map vide des deux côtés) ne sont PAS réputées
// similaires sur ce signal — la composante vaut 0, pas 1. Une composition inconnue ne veut rien
// dire de comparable ; la traiter comme un match reviendrait à gonfler artificiellement la
// similarité de recettes dont on ne sait justement rien. Même
// raisonnement appliqué à la cuisine (une recette sans facette `cuisine` n'est pas "de la même
// famille" qu'une autre recette sans facette `cuisine`, par cohérence).
//
// Conséquence de ce piège sur l'identité : `similarity(a, a) = 1` tient pour toute recette dont
// AU MOINS la signature et la cuisine sont connues (le cas normal — une recette a par construction
// au moins un ingrédient non-optionnel dans le catalogue réel, voir nutrition/signature.ts). Cette fonction compare des SIGNAUX, pas des identités de recette
// (aucun `RecipeId` en entrée) : une recette dépourvue des DEUX signaux ne peut, par construction,
// atteindre 1 avec elle-même — assumé, pas un bug (voir rapport de lot).
//
// PONDÉRATION 0.8 / 0.15 / 0.05 (constantes nommées ci-dessous, Σ = 1) — MESURÉE, pas devinée.
//
// La répartition d'origine était 0.5 / 0.3 / 0.2, posée par la spécification §6.6 sur un
// raisonnement plausible mais jamais vérifié. Une fois le signal « ingrédients » corrigé, elle est
// devenue le facteur limitant : le sensoriel et la cuisine suffisaient À EUX SEULS à fabriquer
// 50 % de similarité entre deux plats N'AYANT AUCUN INGRÉDIENT COMMUN. Mesuré sur le catalogue
// réel : « bœuf haché sauce tomate » × « ratatouille » (plat végétalien) à 61 %, « coq au vin » ×
// « gigot d'agneau » à 50 % avec zéro ingrédient partagé.
//
// Sept jeux de poids comparés (banc app/src/cli/compare-ponderation.ts), sur des paires réelles :
//
//   pondération      plats sans rapport   quasi-doublons   PLANCHER*   paires > 60 %
//   50/30/20 (avant)        57 %               79 %          50 %          81
//   70/20/10                40 %               79 %          30 %          33
//   80/15/05  ← RETENU      32 %               78 %          20 %          30
//   100/00/00               16 %               78 %           0 %          25
//   * score maximum atteignable par deux plats sans AUCUN ingrédient commun.
//
// Les quasi-doublons ne perdent rien sur toute la plage (79 → 78 %) : alléger le sensoriel ne
// dégrade pas la détection des vraies redondances, il cesse seulement d'en inventer.
//
// POURQUOI PAS 100/0/0, malgré le meilleur score brut : le sensoriel garde une utilité réelle.
// À poids nul, cinq salades froides et croquantes sans ingrédient commun seraient à 0 % de
// similarité — la diversification les proposerait toutes les cinq sans y voir de répétition. Le
// signal n'était pas mauvais, il était surdimensionné.
//
// POURQUOI LA CUISINE TOMBE À 0.05 : « francaise » couvre près de la moitié du catalogue. À 0.2,
// deux plats français pris au hasard touchaient 20 points gratuits — du bruit déguisé en signal.
// Elle reste non nulle parce qu'elle discrimine encore un peu sur les familles minoritaires
// (japonaise, libanaise, mexicaine…).
//
// Fonction PURE, sans dépendance à `Catalog` : comme les fonctions `scoreX` de scoring/, elle
// prend en paramètres ce dont elle a besoin (`RecipeSimilarityProfile`), pas un `Catalog` entier —
// testable isolément. `buildSimilarityProfiles` ci-dessous est la SEULE fonction de ce fichier à
// toucher `Catalog` : elle fait le pont, comme le `configure()` d'une `SelectionLayer`.
//
// Dépendances autorisées : domain/, ./scoring/index.js (`clamp01`, même import que
// scoring-pass.ts) — §2/§3 ENGINE.

import type { Catalog, RecipeId, RecipeSignature, SensoryAxes } from '../domain/index.js'
import { signatureOverlap } from '../nutrition/signature.js'
import { clamp01 } from './scoring/index.js'

/** Les trois axes sensoriels NUMÉRIQUES — `texture` reste hors de cette liste, traitée à part. */
const NUMERIC_AXES = ['sucreSale', 'legerConsistant', 'chaudFroid'] as const

/** Écart max par axe = 2 (plage [-1, 1]) ; distance euclidienne max sur 3 axes = 2·√3 — même
 * formule que `scoreCraving` (scoring/craving.ts), généralisée ici aux 3 axes systématiquement
 * (une recette a toujours ses 3 axes renseignés, contrairement à `envie` qui peut n'en demander
 * qu'un sous-ensemble). */
const SENSORY_MAX_DISTANCE = 2 * Math.sqrt(NUMERIC_AXES.length)

/** Composition (chevauchement des signatures) : 0.8 — mesuré, voir l'en-tête pour les 7 jeux comparés. */
export const SIMILARITY_WEIGHT_INGREDIENTS = 0.8
/** Profil sensoriel : 0.15 — garde le cas « cinq salades froides différentes », sans plus. */
export const SIMILARITY_WEIGHT_SENSORY = 0.15
/** Famille de cuisine : 0.05 — « francaise » couvre la moitié du catalogue ; au-delà, c'est du bruit. */
export const SIMILARITY_WEIGHT_CUISINE = 0.05

/**
 * Ce dont `similarity` a besoin d'une recette — extrait par `buildSimilarityProfiles` depuis un
 * `Catalog` réel, ou construit à la main en test.
 */
export interface RecipeSimilarityProfile {
  /**
   * `catalog.indexes.recipeSignature.get(recipeId)` — les 3 ingrédients non optionnels les plus
   * lourds avec leur part normalisée. Map VIDE = signature inconnue (recette sans ingrédient non
   * optionnel), traitée comme une absence et jamais comme une égalité.
   *
   * ⚠️ Remplace `mainIngredientId` depuis la correction de §6.6. L'ancien champ comparait UN SEUL
   * ingrédient, le plus lourd, par égalité stricte — ce qui rendait « œufs au plat aux tomates » et
   * « soupe de poisson au fenouil » similaires à 99 %. Le remplacement a été choisi par mesure sur
   * six modèles candidats, voir engine/nutrition/signature.ts pour les chiffres.
   */
  readonly signature: RecipeSignature
  /** Valeurs de la facette `cuisine` (`recipe.facettes`) — vide = aucune cuisine renseignée. */
  readonly cuisines: readonly string[]
  readonly axes: SensoryAxes
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
  const ingredientComponent = signatureOverlap(a.signature, b.signature)
  const cuisineComponent = cuisineSimilarity(a.cuisines, b.cuisines)
  const sensoryComponent = sensorySimilarity(a.axes, b.axes)

  return clamp01(
    SIMILARITY_WEIGHT_INGREDIENTS * ingredientComponent +
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
      signature: catalog.indexes.recipeSignature.get(recipe.id) ?? new Map(),
      cuisines,
      axes: recipe.axes,
    })
  }
  return profiles
}
