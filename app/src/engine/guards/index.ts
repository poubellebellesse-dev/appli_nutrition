// engine/guards/ — L2 Garde-fous de sécurité (docs/ENGINE.md §5.2)
//
// Rôle : post-conditions exécutées sur la PROPRE SORTIE du moteur, pas des recommandations
// d'UI. Chaque assert* lève `EngineSafetyError` si la condition est violée, sinon ne retourne
// rien. Une `EngineSafetyError` n'est jamais rattrapée silencieusement par l'UI (§4.4 ENGINE) :
// le pipeline refuse de retourner un résultat non sûr plutôt que de dégrader.
//
// Zéro logique dans ce chunk : seules les signatures sont posées (implémentation P1), avec
// couverture visée à 100 % (§11 ENGINE).
//
// Dépendances autorisées : domain/ UNIQUEMENT (§2 ENGINE : GUARD --> DOM). Ni selection/ ni
// planning/ ne sont importés ici, alors même que ce sont elles qui appellent guards/ — c'est
// exactement l'inverse qui casserait le graphe de couches (§3 ENGINE).

import type {
  Explanation,
  HardConstraints,
  PipelineTrace,
  SuggestionResult,
  UserProfile,
  WeekPlan,
} from '../domain/index.js'

// --- Signatures (§5.2 ENGINE) — implémentation P1 ----------------------------------------------

/** Aucune suggestion ne contient un allergène déclaré (§5.2 ARCHITECTURE). */
export type AssertNoDeclaredAllergen = (result: SuggestionResult, constraints: HardConstraints) => void

/** Aucun jour < 1200 kcal (F) / 1500 kcal (H) sans avertissement explicite (§6.5 ARCHITECTURE). */
export type AssertCalorieFloor = (plan: WeekPlan, profile: UserProfile) => void

/** Les couches `critical: true` ont bien été exécutées (§6.3 ENGINE). */
export type AssertCriticalLayersRan = (trace: PipelineTrace) => void

/** Aucune couche `kind: 'scoring'` n'a réduit l'ensemble des candidats (§6.1, §6.3 ENGINE). */
export type AssertScoringLayersNeverExclude = (trace: PipelineTrace) => void

/** Aucune explication ne contient le lexique banni (§6.2 ARCHITECTURE). */
export type AssertNoTherapeuticClaim = (explanations: readonly Explanation[]) => void
