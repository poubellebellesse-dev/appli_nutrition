// ui/router.tsx — routage minimal par fragment d'URL.
//
// ⚠️ PAR HASH, PAS PAR HISTORY API, et ce n'est pas de la paresse. Le routage par chemin
// (`/semaine`) exige que le serveur renvoie `index.html` pour toute URL inconnue — une règle de
// réécriture. L'application vise un hébergement statique nu et, surtout, une PWA installée servie
// hors ligne par le service worker (§7 ARCHITECTURE) : là, il n'y a personne pour réécrire quoi que
// ce soit, et un rechargement sur `/semaine` rendrait un 404. Le fragment ne quitte jamais le
// navigateur, donc le problème n'existe pas.
//
// ⚠️ PAS DE BIBLIOTHÈQUE. Cinq écrans sans paramètre d'URL ni route imbriquée ne justifient pas une
// dépendance ; le jour où il faudra `/recette/:id`, ce fichier aura atteint sa limite et il faudra
// en discuter — pas l'étendre en douce.
//
// ⚠️ LES CINQ ROUTES EXISTENT TOUTES, y compris celles dont l'écran n'est pas codé. Le bloc commun
// des maquettes impose une barre à cinq onglets « présente sur TOUS les écrans », avec les mêmes
// libellés dans le même ordre. Faire apparaître les onglets au fur et à mesure ferait changer la
// navigation de forme sous les doigts de l'utilisateur — exactement ce que la contrainte
// « navigation permanente et visible » interdit. Un onglet qui annonce « pas encore disponible »
// est honnête ; une barre qui grandit à chaque version ne l'est pas.

import { useSyncExternalStore } from 'react'

export type Route = 'aujourdhui' | 'semaine' | 'courses' | 'recettes' | 'savoir'

const HASH_PAR_ROUTE: Readonly<Record<Route, string>> = {
  aujourdhui: '#/',
  semaine: '#/semaine',
  courses: '#/courses',
  recettes: '#/recettes',
  savoir: '#/savoir',
}

const ROUTE_PAR_HASH: ReadonlyMap<string, Route> = new Map([
  ['', 'aujourdhui'],
  ['#', 'aujourdhui'],
  ['#/', 'aujourdhui'],
  ['#/semaine', 'semaine'],
  ['#/courses', 'courses'],
  ['#/recettes', 'recettes'],
  ['#/savoir', 'savoir'],
])

function souscrire(auChangement: () => void): () => void {
  window.addEventListener('hashchange', auChangement)
  return () => window.removeEventListener('hashchange', auChangement)
}

/**
 * Correspondance fragment → route. Un fragment inconnu retombe sur « Aujourd'hui » plutôt que sur
 * un écran blanc — un lien périmé ou un signet vers une route supprimée doit rester utilisable.
 *
 * Exportée et PURE exprès : c'est la seule logique testable du routeur, et la tester à travers
 * `useSyncExternalStore` demanderait un DOM (donc `jsdom`, donc une dépendance de plus).
 */
export function routeDepuisHash(hash: string): Route {
  return ROUTE_PAR_HASH.get(hash) ?? 'aujourdhui'
}

function lireRoute(): Route {
  return routeDepuisHash(window.location.hash)
}

export function useRoute(): Route {
  // Le 3ᵉ argument est le rendu côté serveur : l'application n'en fait pas, mais React l'exige et
  // « aujourd'hui » est le bon défaut.
  return useSyncExternalStore(souscrire, lireRoute, () => 'aujourdhui')
}

export function naviguer(route: Route): void {
  window.location.hash = HASH_PAR_ROUTE[route]
}

export function hashDe(route: Route): string {
  return HASH_PAR_ROUTE[route]
}
