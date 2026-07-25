// engine/nutrition/energy-needs.ts — besoin énergétique (docs/ENGINE.md §5.1, Mifflin-St Jeor +
// facteur d'activité). Fonction PURE.
//
// BMR = 10·poids(kg) + 6,25·taille(cm) − 5·âge(ans) + s, puis besoin = BMR × PAL (facteur
// d'activité, `ActivityLevel`).
//
// `s` : +5 (sexe 'M'), −161 (sexe 'F'), et −78 pour 'NP' — la MOYENNE des deux ((5 + (−161)) / 2).
// C'est la seule valeur qui ne range pas d'office 'NP' dans une case pour quelqu'un qui a refusé
// de répondre : l'écart M/F est de 166 kcal de BMR, ce n'est pas cosmétique, donc ni +5 ni −161 ne
// sont un choix neutre par défaut.
//
// Âge : MILIEU DE TRANCHE (`AgeBracket`, engine/domain/profile.ts). Erreur bornée introduite :
// 5 kcal de BMR par année d'écart au milieu réel de la tranche, donc au pire ±50 kcal sur une
// tranche de 20 ans (18_29, 50_64) — du bruit pour un SCORE (`nutri`), qui n'est ni un plafond ni
// un objectif (§6.5 précision 1 ENGINE).
//
// `tailleCm`/`poidsKg` à `null` → retourne `null` : on ne devine JAMAIS un gabarit corporel.
// L'onboarding ne rend obligatoires que les allergies (§4.8 DESIGN) et exiger un poids serait un
// mauvais signal au regard des garde-fous TCA (§6.5 ARCHITECTURE).
//
// N'applique NI le plancher calorique (1 200/1 500 kcal — garde-fou qui LÈVE, `assertCalorieFloor`,
// lot planning) NI `facteurPortion` (ajuste une PORTION SERVIE, pas un besoin journalier) : deux
// règles qui migrent facilement par accident vers le premier endroit qui parle de calories.
//
// Dépendances autorisées : domain/ uniquement (§2 ENGINE : NUT --> DOM).

import type { ActivityLevel, AgeBracket } from '../domain/index.js'
import { kcal } from '../domain/index.js'
import type { ComputeEnergyNeeds } from './index.js'

/** Âge représentatif = milieu de tranche (table figée dans profile.ts, P1b-2). */
const AGE_BRACKET_MIDPOINT: Readonly<Record<AgeBracket, number>> = {
  '18_29': 24,
  '30_49': 40,
  '50_64': 57,
  '65_plus': 72,
}

/** Facteur d'activité (PAL) — table figée dans profile.ts. Pas de palier « athlète » (1.9). */
const ACTIVITY_LEVEL_PAL: Readonly<Record<ActivityLevel, number>> = {
  sedentaire: 1.2,
  peu_actif: 1.375,
  actif: 1.55,
  tres_actif: 1.725,
}

/** Terme `s` de Mifflin-St Jeor selon le sexe — voir en-tête pour le choix de -78 ('NP'). */
const SEX_OFFSET: Readonly<Record<'F' | 'M' | 'NP', number>> = {
  M: 5,
  F: -161,
  NP: -78,
}

export const computeEnergyNeeds: ComputeEnergyNeeds = (profile) => {
  if (profile.tailleCm === null || profile.poidsKg === null) return null

  const age = AGE_BRACKET_MIDPOINT[profile.trancheAge]
  const pal = ACTIVITY_LEVEL_PAL[profile.niveauActivite]
  const s = SEX_OFFSET[profile.sexe]

  const bmr = 10 * profile.poidsKg + 6.25 * profile.tailleCm - 5 * age + s
  return kcal(bmr * pal)
}
