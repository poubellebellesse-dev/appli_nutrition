// engine/domain/profile.ts
//
// Profil utilisateur (docs/ENGINE.md §4.3, `user_profile` §4.3 ARCHITECTURE).
//
// `trancheAge` et `niveauActivite` sont typés `string` : ni ENGINE.md ni ARCHITECTURE.md ne
// fixent le vocabulaire fermé de `tranche_age`/`niveau_activite` (colonnes TEXT en base, aucune
// énumération documentée). Préciser en P1 plutôt que deviner un vocabulaire non spécifié.

export type AgeBracket = string
export type ActivityLevel = string

export interface UserProfile {
  readonly trancheAge: AgeBracket
  readonly sexe: 'F' | 'M' | 'NP'
  readonly tailleCm: number | null
  readonly poidsKg: number | null
  readonly niveauActivite: ActivityLevel
  /** 0.7 … 1.5 — « trop / pas assez » (§10.1 ENGINE). */
  readonly facteurPortion: number
}
