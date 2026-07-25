// engine/selection/scoring/speed.ts — signal de score doux `speed` (docs/ENGINE.md §6.5 note ¶).
//
// DISTINCT du filtre dur `temps` (../temps.ts, couche d'EXCLUSION qui écarte au-delà du temps
// disponible) : ici un signal doux qui préfère les recettes plus courtes DANS la fenêtre, sans
// jamais exclure personne. `total = tempsPrepMin + tempsCuissonMin`. Fenêtre > 0 : score =
// 1 − total/fenêtre, clampé (un dépassement de la fenêtre tombe à 0, jamais négatif — le filtre dur
// aurait de toute façon déjà exclu ces recettes en amont si `temps` est actif). Fenêtre `null` ou
// ≤ 0 → NEUTRAL_SCORE (rien à comparer, couche inerte).
//
// Rappel (§6.5 note ¶) : `speed` n'est pas une 17ᵉ couche du registre (`LAYER_DESCRIPTORS` compte
// désormais 16 entrées depuis l'ajout de `requis`, non touché ici) — poids par défaut 0, activé
// seulement par l'archétype « Rapide » (P1b-2). Son rattachement précis au pipeline (couche à part entière
// vs. modulation interne d'une couche existante) reste ouvert, non tranché par ce lot.
//
// Dépendances autorisées : domain/, ./index.js — §2/§3 ENGINE.

import type { Recipe } from '../../domain/index.js'
import { NEUTRAL_SCORE, clamp01 } from './index.js'

export function scoreSpeed(recipe: Recipe, fenetreMin: number | null): number {
  if (fenetreMin === null || fenetreMin <= 0) return NEUTRAL_SCORE

  const total = recipe.tempsPrepMin + recipe.tempsCuissonMin
  return clamp01(1 - total / fenetreMin)
}
