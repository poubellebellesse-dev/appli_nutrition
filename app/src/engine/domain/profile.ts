// engine/domain/profile.ts
//
// Profil utilisateur (docs/ENGINE.md §4.3, `user_profile` §4.3 ARCHITECTURE).
//
// `trancheAge` et `niveauActivite` étaient typés `string` : ni ENGINE.md ni ARCHITECTURE.md ne
// fixaient de vocabulaire fermé pour `tranche_age`/`niveau_activite` (colonnes TEXT en base,
// aucune énumération documentée) — vocabulaire volontairement OUVERT faute de spec. Décision
// utilisateur (session P1b-2) : le vocabulaire est désormais FIGÉ en unions littérales fermées,
// avec les valeurs et coefficients ci-dessous (consommés par `computeEnergyNeeds`, voir
// engine/nutrition/energy-needs.ts).
//
// | `AgeBracket` | âge représentatif (milieu de tranche) |
// |---|---|
// | `18_29`   | 24 |
// | `30_49`   | 40 |
// | `50_64`   | 57 |
// | `65_plus` | 72 |
//
// | `ActivityLevel` | facteur (PAL) |
// |---|---|
// | `sedentaire`  | 1.2 |
// | `peu_actif`   | 1.375 |
// | `actif`       | 1.55 |
// | `tres_actif`  | 1.725 |
//
// Pas de palier « athlète » (PAL 1.9) : cadrage performance dont le produit se tient à l'écart.
// Aucune tranche mineure : la VNR du catalogue est une VNR ADULTE — un profil hors de ces quatre
// tranches n'existe pas dans le type, il n'y a donc rien à deviner côté mineur.

export type AgeBracket = '18_29' | '30_49' | '50_64' | '65_plus'
export type ActivityLevel = 'sedentaire' | 'peu_actif' | 'actif' | 'tres_actif'

export interface UserProfile {
  readonly trancheAge: AgeBracket
  readonly sexe: 'F' | 'M' | 'NP'
  readonly tailleCm: number | null
  readonly poidsKg: number | null
  readonly niveauActivite: ActivityLevel
  /** 0.7 … 1.5 — « trop / pas assez » (§10.1 ENGINE). */
  readonly facteurPortion: number
}
