// ui/socle.ts — ce dont TOUT écran a besoin : le catalogue, le moteur, `user.db`, le profil.
//
// Extrait de `main.tsx` quand un deuxième écran est arrivé. Le moteur et la base sont des
// singletons coûteux ; les rouvrir par écran referait les index dérivés à chaque navigation, et
// surtout deux ouvertures concurrentes de `user.db` se disputeraient les descripteurs exclusifs du
// VFS OPFS (voir `user-source.ts`).

import type { Catalog, MealSlot, UserProfile } from '../engine/domain/index.js'
import { createEngine, type Engine } from '../engine/api/index.js'
import type { UserDb } from '../data/user-db.js'
import { readProfile, writeProfile } from '../data/user-store.js'
import { chargerCatalogue } from './catalog-source.js'
import { ouvrirUserDb } from './user-source.js'

/**
 * Profil semé au tout premier lancement, quand `user.db` est vide.
 *
 * ⚠️ PROVISOIRE — l'écran d'onboarding (§4.8 DESIGN) l'écrasera. Il est ÉCRIT EN BASE et relu comme
 * n'importe quel profil : le chemin de lecture est le même dès la première seconde. Aucune valeur
 * n'est devinée — pas de gabarit corporel, pas d'allergie supposée, pas de régime.
 */
export const PROFIL_PAR_DEFAUT: UserProfile = {
  trancheAge: '30_49',
  sexe: 'NP',
  tailleCm: null,
  poidsKg: null,
  niveauActivite: 'actif',
  facteurPortion: 1,
}

/** §13 ENGINE — fenêtre glissante de 21 jours, appliquée à la LECTURE (`readHistory`). */
export const FENETRE_HISTORIQUE_JOURS = 21

/** Libellés d'affichage des créneaux. Nulle part ailleurs : deux listes divergeraient. */
export const LIBELLE_CRENEAU: Readonly<Record<MealSlot, string>> = {
  petit_dejeuner: 'Petit-déjeuner',
  dejeuner: 'Déjeuner',
  gouter: 'Goûter',
  diner: 'Dîner',
}

export interface Socle {
  readonly catalogue: Catalog
  readonly moteur: Engine
  readonly db: UserDb
  /** §7 mesure 6 — `false` impose un bandeau permanent, la base est effaçable par le navigateur. */
  readonly persistant: boolean
}

let cache: Promise<Socle> | undefined

/**
 * Charge tout, une fois. On mémorise la PROMESSE : deux écrans montés en même temps
 * déclencheraient sinon deux initialisations concurrentes.
 */
export function chargerSocle(): Promise<Socle> {
  cache ??= chargerVraiment()
  return cache
}

async function chargerVraiment(): Promise<Socle> {
  const [catalogue, session] = await Promise.all([chargerCatalogue(), ouvrirUserDb()])
  // `createEngine` calcule tous les index dérivés (§6.5 précision 8) — une seule fois, ici.
  return { catalogue, moteur: createEngine(catalogue), db: session.db, persistant: session.persistant }
}

/** Aujourd'hui en ISO. L'horloge est fournie par l'UI et INJECTÉE — jamais lue dans engine/ (§3). */
export function aujourdhuiIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Le profil de l'appareil, semé au premier lancement s'il n'existe pas encore.
 *
 * Sème EN BASE plutôt que de rendre une valeur en mémoire : un profil qui n'existe qu'à l'écran se
 * comporte différemment d'un profil relu, et la différence n'apparaîtrait qu'au rechargement.
 */
export function profilCourant(db: UserDb, date: string): UserProfile {
  const existant = readProfile(db)
  if (existant !== null) return existant
  writeProfile(db, PROFIL_PAR_DEFAUT, date)
  return PROFIL_PAR_DEFAUT
}

/** Clé de créneau — `SlotRef` est un objet, incomparable directement. */
export function cleCreneau(date: string, creneau: MealSlot): string {
  return `${date}|${creneau}`
}
