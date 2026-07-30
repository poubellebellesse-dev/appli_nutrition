// ui/router.tsx — routage minimal par fragment d'URL.
//
// ⚠️ PAR HASH, PAS PAR HISTORY API, et ce n'est pas de la paresse. Le routage par chemin
// (`/semaine`) exige que le serveur renvoie `index.html` pour toute URL inconnue — une règle de
// réécriture. L'application vise un hébergement statique nu et, surtout, une PWA installée servie
// hors ligne par le service worker (§7 ARCHITECTURE) : là, il n'y a personne pour réécrire quoi que
// ce soit, et un rechargement sur `/semaine` rendrait un 404. Le fragment ne quitte jamais le
// navigateur, donc le problème n'existe pas.
//
// ⚠️ TOUJOURS PAS DE BIBLIOTHÈQUE — décision reprise le 2026-07-30, à l'arrivée de la fiche recette.
// L'en-tête annonçait « le jour où il faudra /recette/:id, ce fichier aura atteint sa limite et il
// faudra en discuter ». Le jour est venu : UNE route a besoin d'un paramètre. L'ajouter coûte les
// quelques lignes ci-dessous ; `react-router-dom` coûterait une dépendance et son écosystème pour
// un seul cas. À rediscuter si une deuxième route paramétrée, ou une route imbriquée, apparaît.
//
// ⚠️ LES CINQ ONGLETS EXISTENT TOUS, y compris ceux dont l'écran n'est pas codé. Le bloc commun des
// maquettes impose une barre à cinq onglets « présente sur TOUS les écrans », avec les mêmes
// libellés dans le même ordre. Une barre qui grandit de version en version changerait de forme sous
// les doigts de l'utilisateur — exactement ce que la contrainte « navigation permanente et visible »
// interdit.

import { useSyncExternalStore } from 'react'

export type Onglet = 'aujourdhui' | 'semaine' | 'courses' | 'recettes' | 'savoir'

/**
 * Où l'on est.
 *
 * `recetteId` non nul = fiche recette. Elle appartient à l'onglet `recettes` MÊME quand on y arrive
 * depuis la semaine ou les courses : la barre doit désigner une section stable, pas le chemin
 * parcouru pour arriver là.
 */
export interface Route {
  readonly onglet: Onglet
  readonly recetteId: string | null
}

const HASH_PAR_ONGLET: Readonly<Record<Onglet, string>> = {
  aujourdhui: '#/',
  semaine: '#/semaine',
  courses: '#/courses',
  recettes: '#/recettes',
  savoir: '#/savoir',
}

const ONGLET_PAR_HASH: ReadonlyMap<string, Onglet> = new Map([
  ['', 'aujourdhui'],
  ['#', 'aujourdhui'],
  ['#/', 'aujourdhui'],
  ['#/semaine', 'semaine'],
  ['#/courses', 'courses'],
  ['#/recettes', 'recettes'],
  ['#/savoir', 'savoir'],
])

const PREFIXE_RECETTE = '#/recette/'

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
  if (hash.startsWith(PREFIXE_RECETTE)) {
    // `decodeURIComponent` peut lever sur un `%` isolé, qu'un signet tronqué produit facilement.
    // Une URL malformée doit ramener à la liste, jamais faire planter l'application.
    try {
      const id = decodeURIComponent(hash.slice(PREFIXE_RECETTE.length))
      if (id !== '') return { onglet: 'recettes', recetteId: id }
    } catch {
      /* fragment illisible → liste des recettes */
    }
    return { onglet: 'recettes', recetteId: null }
  }
  return { onglet: ONGLET_PAR_HASH.get(hash) ?? 'aujourdhui', recetteId: null }
}

function lireRoute(): Route {
  return routeDepuisHash(window.location.hash)
}

/**
 * ⚠️ La valeur rendue doit être STABLE entre deux lectures inchangées : `useSyncExternalStore`
 * compare par identité et boucle à l'infini si on lui rend un objet neuf à chaque appel. On mémorise
 * donc le dernier résultat tant que le fragment n'a pas bougé.
 */
let dernierHash: string | undefined
let derniereRoute: Route = { onglet: 'aujourdhui', recetteId: null }

function lireRouteStable(): Route {
  const hash = window.location.hash
  if (hash !== dernierHash) {
    dernierHash = hash
    derniereRoute = lireRoute()
  }
  return derniereRoute
}

const ROUTE_PAR_DEFAUT: Route = { onglet: 'aujourdhui', recetteId: null }

export function useRoute(): Route {
  // Le 3ᵉ argument est le rendu côté serveur : l'application n'en fait pas, mais React l'exige.
  return useSyncExternalStore(souscrire, lireRouteStable, () => ROUTE_PAR_DEFAUT)
}

export function hashDe(onglet: Onglet): string {
  return HASH_PAR_ONGLET[onglet]
}

export function hashDeRecette(id: string): string {
  return `${PREFIXE_RECETTE}${encodeURIComponent(id)}`
}

export function naviguer(onglet: Onglet): void {
  window.location.hash = hashDe(onglet)
}
