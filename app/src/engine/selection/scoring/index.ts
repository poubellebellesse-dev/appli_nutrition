// engine/selection/scoring/ — L3 Sélection, couches de SCORE : socle de fonctions pures
// (docs/ENGINE.md §6.5) — lot 3 de la tranche P1b-1, complété par l'enveloppe `SelectionLayer`
// (lot suivant de P1b-1, voir §6.8 ENGINE).
//
// Chaque fichier expose une fonction PURE qui calcule un score 0-1 à partir de ses données en
// paramètres (vecteur nutritionnel, id d'ingrédient principal, etc.) plutôt qu'un `Catalog`
// complet — SEL a le droit de dépendre de NUT (§2 ENGINE), mais ces fonctions restent testables
// sans catalogue ni index dérivé.
//
// Les 7 fonctions (`nutri`, `preference`, `craving`, `season`, `variety`, `habit`, `speed`) sont
// désormais TOUTES enveloppées dans le contrat `SelectionLayer` (`nutriLayer`, `preferenceLayer`,
// `cravingLayer`, `seasonLayer`, `varietyLayer`, `habitLayer`, `speedLayer`), dans le MÊME fichier
// que la fonction pure qu'elles enveloppent — `configure` y fait le pont vers `Catalog`/
// `SuggestionRequest` (pour `nutri` : via `resolveReferenceIntakes`, engine/nutrition/), `apply`
// reste sans accès au catalogue. `speed` a rejoint les autres (session du 2026-07-25) : ce n'est
// plus un signal hors registre (voir speed.ts pour la décision). La passe pondérée qui combine
// les couches de score (`runScoringPass`) n'est pas traitée ici (module scoring-pass.ts).
//
// NEUTRAL_SCORE = 0.5 est la valeur « ni bonus ni malus » : le signal neutre qu'une fonction
// retourne quand elle n'a rien d'exploitable à comparer (aucune cible, aucune préférence connue,
// aucun ingrédient réellement saisonnier…). §6.5 précision 3 l'exige explicitement pour `season`
// (« score neutre, pas un score nul punitif ») ; le même principe est appliqué aux 6 autres
// fonctions à chaque fois qu'un signal n'a rien à dire, plutôt que de renvoyer 0 par défaut.
//
// `clamp01` est le garde-fou commun : CHAQUE fonction de ce module retourne un score dans [0, 1],
// clampé, quelle que soit l'entrée (y compris des préférences ou vecteurs hors plage attendue).
//
// Import circulaire assumé : les 7 fichiers importent `NEUTRAL_SCORE`/`clamp01` depuis CE fichier,
// qui les réexporte à son tour. Sûr en ESM ici : les deux valeurs sont des `const`/fonctions
// déclarées avant les lignes `export { ... } from './x.js'` plus bas, donc déjà initialisées au
// moment où le graphe circulaire se referme, et aucun des 7 fichiers n'y accède au top-level
// (uniquement à l'intérieur de leurs fonctions, appelées plus tard).
//
// Dépendances autorisées : domain/, et — pour les 7 fichiers qui exposent aussi une couche —
// `../index.js` (le contrat `SelectionLayer` local à selection/) — §2/§3 ENGINE. Import circulaire
// avec `../index.js` assumé de la même façon qu'entre les couches d'exclusion et ce fichier
// (voir exclusions.ts) : uniquement des `import type`, erasés à la compilation, donc sans cycle
// réel à l'exécution.

export const NEUTRAL_SCORE = 0.5

/** Ramène `x` dans [0, 1] — utilisé par toutes les fonctions de score de ce module. */
export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

export { scoreNutri, nutriLayer } from './nutri.js'
export type { NutriLayerConfig } from './nutri.js'
export { scorePreference, preferenceLayer } from './preference.js'
export type { PreferenceLayerConfig } from './preference.js'
export { scoreCraving, cravingLayer } from './craving.js'
export type { CravingLayerConfig } from './craving.js'
export { scoreSeason, seasonLayer } from './season.js'
export type { SeasonLayerConfig } from './season.js'
export { scoreVariety, varietyLayer } from './variety.js'
export type { ScoreVarietyArgs, VarietyOverride, VarietyTau, VarietyLayerConfig } from './variety.js'
export { scoreSpeed, speedLayer } from './speed.js'
export type { SpeedLayerConfig } from './speed.js'
export { scoreHabit, habitLayer } from './habit.js'
export type { ScoreHabitArgs, HabitLayerConfig } from './habit.js'
