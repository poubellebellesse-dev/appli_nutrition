// ui/socle.ts — ce dont TOUT écran a besoin : le catalogue, le moteur, `user.db`, le profil.
//
// Extrait de `main.tsx` quand un deuxième écran est arrivé. Le moteur et la base sont des
// singletons coûteux : les rouvrir par écran referait tous les index dérivés à chaque navigation,
// et surtout deux instances de `user.db` en mémoire divergeraient, la dernière écrite sur OPFS
// écrasant l'autre (voir `user-source.ts`).

import type { Catalog, MealSlot, UserProfile } from '../engine/domain/index.js'
import { createEngine, type Engine } from '../engine/api/index.js'
import type { UserDb } from '../data/user-db.js'
import { readProfile, writeProfile } from '../data/user-store.js'
import { avecRecettesSupplementaires } from '../data/catalog-loader.js'
import { readUserRecipes, versRecette } from '../data/user-recipe.js'
import { chargerCatalogue } from './catalog-source.js'
import { ouvrirUserDb, type Stockage } from './user-source.js'

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
  /** Catalogue livré + recettes de l'utilisateur. C'est CELUI-CI que le moteur consomme. */
  readonly catalogue: Catalog
  /**
   * Le catalogue livré, SANS les recettes de l'utilisateur.
   *
   * Conservé pour pouvoir refusionner après une écriture sans relire `catalog.db` — et pour que
   * « les recettes du catalogue » et « les miennes » restent distinguables partout où ça compte.
   */
  readonly catalogueSource: Catalog
  readonly moteur: Engine
  readonly db: UserDb
  /** `'memoire'` = OPFS indisponible : tout est perdu au rechargement. À dire clairement. */
  readonly stockage: Stockage
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
  const [catalogueSource, session] = await Promise.all([chargerCatalogue(), ouvrirUserDb()])
  return assembler(catalogueSource, session.db, session.stockage, session.persistant)
}

/**
 * Fusionne les recettes de l'utilisateur dans le catalogue, puis construit le moteur dessus.
 *
 * ⚠️ LA FUSION SE FAIT ICI, AU NIVEAU DU CATALOGUE, et c'est la décision qui rend la fonctionnalité
 * tenable. Le moteur ne connaît qu'un `Catalog` : une recette qui y figure entre d'elle-même dans
 * les suggestions, la semaine, les courses, le frigo et la recherche. L'alternative — traiter les
 * recettes personnelles écran par écran — aurait demandé un cas particulier par fonctionnalité, et
 * on en aurait oublié un. Le premier oublié aurait été un garde-fou.
 */
function assembler(
  catalogueSource: Catalog,
  db: UserDb,
  stockage: Stockage,
  persistant: boolean
): Socle {
  const perso = readUserRecipes(db).map((stockee) => versRecette(stockee, catalogueSource.foods))
  const brut = avecRecettesSupplementaires(catalogueSource, perso)
  const moteur = createEngine(brut)
  // `moteur.catalogue` est le catalogue ENRICHI que `createEngine` a construit (§6.5 précision 8),
  // pas `brut` : l'exposer via le moteur garantit par construction que `catalogue` porte les index
  // dérivés — plus une histoire de convention qu'il faudrait se souvenir de respecter à chaque appel.
  return { catalogue: moteur.catalogue, catalogueSource, moteur, db, stockage, persistant }
}

/**
 * Reconstruit catalogue et moteur après une écriture dans `user_recipe`.
 *
 * ⚠️ NE ROUVRE PAS `user.db`, et ce n'est pas un détail : deux instances de la base en mémoire
 * divergeraient, la dernière écrite sur OPFS écrasant l'autre (voir l'en-tête de ce fichier et
 * `user-source.ts`). On repart du catalogue SOURCE conservé et de la session déjà ouverte.
 *
 * Reconstruire tout le moteur pour une recette est volontaire : les index dérivés et les profils de
 * similarité se calculent en bloc, et l'ajout d'une recette est un geste rare. Un cache incrémental
 * serait une source de divergence pour un gain invisible.
 */
export async function rebatirCatalogue(): Promise<Socle> {
  const actuel = await chargerSocle()
  const suivant = assembler(actuel.catalogueSource, actuel.db, actuel.stockage, actuel.persistant)
  cache = Promise.resolve(suivant)
  return suivant
}

/** Aujourd'hui en ISO. L'horloge est fournie par l'UI et INJECTÉE — jamais lue dans engine/ (§3). */
export function aujourdhuiIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Horodatage ISO complet (secondes et millisecondes comprises), pour les colonnes qui doivent
 * départager deux écritures survenues LE MÊME JOUR — `meal_plan.mis_a_jour_le` (v7). Même horloge
 * injectée qu'`aujourdhuiIso`, jamais lue dans `engine/` ni `data/`.
 */
export function maintenantIso(): string {
  return new Date().toISOString()
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

/**
 * « lun. 3 août ». Le fuseau est forcé en UTC : les dates du plan sont des JOURS, pas des instants —
 * sans ça, un plan écrit à 23 h recule d'un jour à l'affichage selon le fuseau du téléphone.
 *
 * ⚠️ ELLE VIT ICI, avec `cleCreneau` et `LIBELLE_CRENEAU`, parce que c'est la MÊME famille : comment
 * un créneau du plan se nomme à l'écran. Elle a été écrite deux fois — `courses.tsx` et
 * `semaine.tsx` — à l'identique. Deux copies identiques ne cassent rien le jour où on les écrit ;
 * elles cassent le jour où l'une des deux change, et la même journée se lit alors différemment selon
 * l'écran. Les deux composent d'ailleurs le même libellé, `formaterJour(...) · LIBELLE_CRENEAU[...]`.
 */
export function formaterJour(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}
