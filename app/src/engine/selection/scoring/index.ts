// engine/selection/scoring/ — L3 Sélection, couches de SCORE : socle de fonctions pures
// (docs/ENGINE.md §6.5) — lot 3 de la tranche P1b-1.
//
// Portée volontairement limitée : les 7 fonctions ci-dessous sont des fonctions PURES qui
// calculent un score 0-1, PAS des objets `SelectionLayer` (voir ../index.ts pour le contrat).
// L'enveloppe dans ce contrat, les poids par défaut (`LAYER_DESCRIPTORS`), les archétypes
// (« Rapide », « Équilibre »…) et la passe pondérée qui les combine sont P1b-2 — non traités ici.
// Chaque fonction reçoit ses données en paramètres (vecteur nutritionnel, id d'ingrédient
// principal, etc.) plutôt qu'un `Catalog` complet : SEL a le droit de dépendre de NUT (§2 ENGINE),
// mais ces fonctions restent testables sans catalogue ni index dérivé.
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
// Dépendances autorisées : domain/ uniquement — §2/§3 ENGINE.

export const NEUTRAL_SCORE = 0.5

/** Ramène `x` dans [0, 1] — utilisé par toutes les fonctions de score de ce module. */
export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

export { scoreNutri } from './nutri.js'
export { scorePreference } from './preference.js'
export { scoreCraving } from './craving.js'
export { scoreSeason } from './season.js'
export { scoreVariety } from './variety.js'
export type { ScoreVarietyArgs, VarietyOverride, VarietyTau } from './variety.js'
export { scoreSpeed } from './speed.js'
export { scoreHabit } from './habit.js'
export type { ScoreHabitArgs } from './habit.js'
