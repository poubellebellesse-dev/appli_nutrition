// engine/domain/plats-par-creneau.ts — combien de plats restent, CRÉNEAU PAR CRÉNEAU.
//
// ⚠️ PAR CRÉNEAU, JAMAIS EN TOTAL, et ce n'est pas une préférence d'affichage. Un total global peut
// être vert pendant qu'un créneau est déjà vide. Le banc a mesuré exactement cette panne :
// « végétalien + sans gluten » portait 28 plats utilisables pour 28 créneaux — marge zéro, une
// exclusion de plus vidait un créneau, et le total ne bougeait presque pas. Le précédent de forme
// est `BrowseResult.totalCatalogue` (engine/api/index.ts) : « un entonnoir dont le premier nombre
// ment ne se remarque nulle part ailleurs ».
//
// ⚠️ L'ARITHMÉTIQUE VIT ICI, PAS DANS LE `.tsx`. Même parti que `groupes-animaux.ts` : un écran qui
// recompte lui-même finit par compter autre chose que le moteur, et c'est l'écran qui a tort sans
// que rien ne le dise.
//
// ⛔ AUCUNE COUCHE D'EXCLUSION N'EST RÉÉCRITE ICI. L'appelant passe la sortie de `browseRecipes`,
// qui a déjà appliqué les MÊMES couches que la suggestion ; on ne fait qu'INTERSECTER avec
// `CatalogIndexes.recipesBySlot`, qui est précisément l'ensemble de départ de `suggestMeals`
// (engine/api/index.ts, étape (a)). Ajouter un axe « créneaux » à `BrowseRequest` coûterait quatre
// passes de couches au lieu d'une, pour le même nombre.
//
// ⛔ NE PAS Y AJOUTER `peutRemplirSeul` — IMPASSE MESURÉE LE 2026-08-10, ET LE COMPTE ACTUEL EST LE
// BON. L'idée paraît juste : `pickForSlot` (engine/planning/plan-week.ts) écarte les `entree`,
// `accompagnement`, `fromage` et `dessert` au déjeuner et au dîner, donc ce module compterait des
// plats que le planificateur refuse. ELLE EST FAUSSE, parce que `pickForSlot` a DEUX passes et que
// la seconde repose la question SANS ce filtre : le refus est une PRÉFÉRENCE, pas une exigence —
// c'est écrit noir sur blanc dans son commentaire, et c'est une régression mesurée le 2026-08-03
// (la version dure faisait retomber le végétalien 14 j de 42/42 créneaux remplis à 32/42).
//
// Un créneau dont toutes les survivantes sont partielles est donc REMPLI, par pis-aller. MESURÉ sur
// 4 recettes (entrée, accompagnement, fromage, dessert) et 7 dîners :
//
//     compte actuel        4 → 'court'  « les jours en trop resteront vides »  → 4 remplis, 3 vides ✓
//     compte filtré        0 → 'vide'   « il ne pourra pas être proposé »      → FAUX, et `suggestMeals`
//                                                                                ne lève même pas
//
// Filtrer ici échangerait un compte exact contre un message alarmiste faux. La règle de `plan-week`
// gouverne QUEL plat est posé, jamais SI le créneau est rempli — et c'est la seconde question que
// pose ce module. Verrouillé par test (`plats-par-creneau.test.ts`, dernier describe).

import type { MealSlot } from './catalog.js'
import type { RecipeId } from './ids.js'

/**
 * Ce qu'un créneau peut encore recevoir, mesuré contre l'horizon du plan.
 *
 * ⚠️ LES DEUX SEUILS NE DISENT PAS LA MÊME CHOSE, et les confondre écrirait « impossible » là où le
 * moteur se contente d'être à court. Vérifié dans le code, pas déduit :
 *
 * - `'vide'` (0 plat) — `suggestMeals` LÈVE `NoViableRecipeError` dès que l'ensemble des candidats
 *   est vide (engine/api/index.ts, étape (d)). L'écran du jour bascule sur « assouplir un critère ».
 *   `planWeek` rattrape la levée dans `pickForSlot` et pose `{ recipeId: null, portions: 0 }`. Ce
 *   créneau-là ne peut réellement pas être rempli : le mot fort est justifié.
 *
 * - `'court'` (1 à `joursDemandes − 1`) — **le plan ne répète PAS, il laisse VIDE.** `pickForSlot`
 *   écarte tout ce qui est déjà dans `placedRecipeIds` — dans ses DEUX passes — puis rend `null`
 *   (engine/planning/plan-week.ts). `placedRecipeIds` est construit une fois pour tout le plan, il
 *   n'est jamais remis à zéro d'un jour à l'autre. Le surplus de créneaux ressort donc VIDE, pas
 *   répétitif. Écrire « votre planning sera répétitif » serait faux ; écrire « impossible » le
 *   serait aussi, et faux dans le sens qui fait peur — la couche `variety` PÉNALISE la répétition,
 *   elle ne l'interdit pas, et un plan plus court passe très bien.
 *
 * - `'suffisant'` — au moins autant de plats que de jours demandés.
 */
export type EtatDuCreneau = 'vide' | 'court' | 'suffisant'

export interface PlatsDuCreneau {
  readonly creneau: MealSlot
  /**
   * Recettes encore proposables sur ce créneau.
   *
   * ⚠️ C'EST UN CARDINAL, PAS UNE NOTE. Rien de ce que rend ce module ne doit être présenté comme
   * un score : « 38 plats » se lit, « 38/100 » jugerait (principe 6).
   *
   * ⚠️ MAJORANT, ET DEUX RAISONS DE L'ÊTRE. (1) Le même plat peut compter dans deux créneaux et ne
   * servira qu'une fois — `placedRecipeIds` est global au plan. (2) `browseRecipes` neutralise les
   * couches contextuelles (temps disponible, envie, piquant) : ce nombre dit ce que les réglages
   * DURABLES laissent passer, pas ce qu'un mardi soir pressé laissera passer.
   *
   * ⛔ ET IL N'Y EN A PAS DE TROISIÈME : le service ne restreint PAS ce compte. Voir l'en-tête du
   * module — `peutRemplirSeul` gouverne quel plat `planWeek` pose en premier choix, pas si le
   * créneau finit rempli.
   */
  readonly plats: number
  readonly etat: EtatDuCreneau
}

/**
 * Combien de plats restent sur chacun des créneaux demandés.
 *
 * @param proposables Sortie de `browseRecipes` — les recettes que les contraintes DURABLES laissent
 *   passer. C'est l'appelant qui décide des contraintes ; ce module n'en connaît aucune.
 * @param recipesBySlot `CatalogIndexes.recipesBySlot`, l'ensemble de départ de `suggestMeals`.
 * @param creneaux Les créneaux à mesurer — ceux que l'utilisateur PLANIFIE réellement
 *   (`creneauxDuRythme` côté UI). Compter le goûter de qui mange deux fois par jour est du bruit.
 * @param joursDemandes L'horizon du plan, en jours. Sépare `'court'` de `'suffisant'`.
 *
 * Coût : un ensemble sur `proposables`, puis un parcours des ensembles de créneaux demandés —
 * O(|proposables| + Σ|recipesBySlot[créneau]|), sans passe de couches supplémentaire.
 */
export function platsParCreneau(
  proposables: Iterable<RecipeId>,
  recipesBySlot: ReadonlyMap<MealSlot, ReadonlySet<RecipeId>>,
  creneaux: readonly MealSlot[],
  joursDemandes: number
): readonly PlatsDuCreneau[] {
  const restantes = new Set(proposables)

  return creneaux.map((creneau) => {
    const duCreneau = recipesBySlot.get(creneau)
    let plats = 0
    if (duCreneau !== undefined) {
      for (const recipeId of duCreneau) if (restantes.has(recipeId)) plats++
    }
    return { creneau, plats, etat: etatDuCreneau(plats, joursDemandes) }
  })
}

/** Le classement d'un créneau. Séparé et exporté pour être testable sans catalogue. */
export function etatDuCreneau(plats: number, joursDemandes: number): EtatDuCreneau {
  if (plats === 0) return 'vide'
  return plats < joursDemandes ? 'court' : 'suffisant'
}
