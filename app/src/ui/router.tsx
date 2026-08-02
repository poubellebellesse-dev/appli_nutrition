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
 * Ce qu'on regarde À L'INTÉRIEUR d'un onglet.
 *
 * ⚠️ UNION DISCRIMINÉE, et c'est un changement volontaire. La version précédente portait un
 * `recetteId: string | null` ; ajouter « vider le frigo » aurait demandé un second champ ad hoc, et
 * un troisième aurait suivi. Trois états mutuellement exclusifs représentés par deux booléens
 * indépendants, c'est un état impossible à écrire (`{ recetteId: 'x', frigo: true }`) que rien
 * n'empêche. L'union le rend inexprimable.
 */
export type SousVue =
  | { readonly type: 'liste' }
  | { readonly type: 'recette'; readonly id: string; readonly origine: OrigineRecette }
  | { readonly type: 'frigo' }
  | { readonly type: 'parametres' }
  /** Éditeur de recette. `baseId` non nul = on adapte une recette existante. */
  | { readonly type: 'editeur'; readonly baseId: string | null }

/**
 * D'où l'on arrive sur une fiche recette — porte le retour contextuel (« ← Aujourd'hui »,
 * « ← Cette semaine »…). Voir `hashDeRecette` : encodée dans le HASH, pas dans un état React, pour
 * survivre à un rechargement (le service worker sert `index.html` sur toute navigation, §7
 * ARCHITECTURE — un état React serait perdu).
 */
export type OrigineRecette = 'aujourdhui' | 'recettes' | 'semaine' | 'frigo'

const ORIGINE_PAR_DEFAUT: OrigineRecette = 'recettes'

/**
 * Où l'on est.
 *
 * La fiche recette et « vider le frigo » appartiennent à l'onglet `recettes` MÊME quand on y arrive
 * depuis la semaine, les courses ou Aujourd'hui : la barre doit désigner une section stable, pas le
 * chemin parcouru pour y arriver.
 */
export interface Route {
  readonly onglet: Onglet
  readonly sousVue: SousVue
}

const LISTE: SousVue = { type: 'liste' }

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

/**
 * L'éditeur de recette. Deux formes : `#/composer` (partir de zéro) et `#/composer/<id>` (adapter).
 *
 * ⚠️ SECONDE ROUTE PARAMÉTRÉE DU PROJET. L'en-tête de ce fichier annonçait qu'une deuxième route à
 * paramètre — ou une route imbriquée — rouvrirait la question d'une bibliothèque de routage. Elle
 * est là. La réponse reste NON pour l'instant : le motif est identique à celui de la fiche recette,
 * il coûte les six lignes ci-dessous, et `react-router-dom` apporterait son écosystème pour deux
 * cas. À rouvrir vraiment au troisième, ou dès qu'une route en imbriquera une autre.
 */
const PREFIXE_EDITEUR = '#/composer'

/**
 * « Vider le frigo » N'EST PAS UN ONGLET. §4.5 DESIGN et la maquette le disent accessible « depuis
 * Aujourd'hui et Recettes » ; la barre reste à cinq onglets stables v1 → v2 (§2 DESIGN). Une barre
 * qui gagnerait un sixième onglet changerait de forme sous les doigts de l'utilisateur.
 */
const HASH_FRIGO = '#/frigo'

/**
 * « Paramètres » N'EST PAS UN ONGLET NON PLUS, et pour la même raison que le frigo : la barre reste
 * à cinq onglets stables (§2 DESIGN). On y accède par l'engrenage de l'en-tête, présent partout.
 *
 * ⚠️ RATTACHÉ À `aujourdhui`, faute de mieux, et c'est un choix par défaut assumé. Les réglages
 * n'appartiennent à aucune des cinq sections ; il faut pourtant qu'un onglet soit désigné, sinon la
 * barre n'aurait plus d'onglet courant et changerait d'aspect sur cet écran — exactement ce que
 * « navigation permanente et visible » interdit. L'onglet d'accueil est le repli le moins surprenant.
 */
const HASH_PARAMETRES = '#/parametres'

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
  if (hash === HASH_FRIGO) return { onglet: 'recettes', sousVue: { type: 'frigo' } }
  if (hash === HASH_PARAMETRES) return { onglet: 'aujourdhui', sousVue: { type: 'parametres' } }

  if (hash === PREFIXE_EDITEUR || hash.startsWith(`${PREFIXE_EDITEUR}/`)) {
    const brut = hash.slice(PREFIXE_EDITEUR.length + 1)
    // Même précaution que pour la fiche : `decodeURIComponent` lève sur un `%` isolé, qu'un signet
    // tronqué produit facilement. Un identifiant illisible ouvre une création vide, jamais un plantage.
    let baseId: string | null = null
    try {
      baseId = brut === '' ? null : decodeURIComponent(brut)
    } catch {
      baseId = null
    }
    return { onglet: 'recettes', sousVue: { type: 'editeur', baseId } }
  }

  if (hash.startsWith(PREFIXE_RECETTE)) {
    // `decodeURIComponent` peut lever sur un `%` isolé, qu'un signet tronqué produit facilement.
    // Une URL malformée doit ramener à la liste, jamais faire planter l'application.
    try {
      // L'origine voyage APRÈS l'id, en `?de=<origine>` — voir `hashDeRecette`. Un id peut légitimement
      // contenir un `?` encodé (`%3F`), d'où le split sur le fragment BRUT, avant décodage de l'id.
      const [idBrut, requete] = hash.slice(PREFIXE_RECETTE.length).split('?')
      const id = decodeURIComponent(idBrut ?? '')
      if (id !== '') return { onglet: 'recettes', sousVue: { type: 'recette', id, origine: origineDepuisRequete(requete) } }
    } catch {
      /* fragment illisible → liste des recettes */
    }
    return { onglet: 'recettes', sousVue: LISTE }
  }
  return { onglet: ONGLET_PAR_HASH.get(hash) ?? 'aujourdhui', sousVue: LISTE }
}

const ORIGINES_CONNUES: ReadonlySet<string> = new Set(['aujourdhui', 'recettes', 'semaine', 'frigo'])

/** Origine inconnue ou absente → repli sur `ORIGINE_PAR_DEFAUT` (lien collé, favori, rechargement
 * d'un hash antérieur à cette fonctionnalité) — comportement actuel, jamais un plantage. */
function origineDepuisRequete(requete: string | undefined): OrigineRecette {
  const de = new URLSearchParams(requete ?? '').get('de')
  return de !== null && ORIGINES_CONNUES.has(de) ? (de as OrigineRecette) : ORIGINE_PAR_DEFAUT
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
let derniereRoute: Route = { onglet: 'aujourdhui', sousVue: LISTE }

function lireRouteStable(): Route {
  const hash = window.location.hash
  if (hash !== dernierHash) {
    dernierHash = hash
    derniereRoute = lireRoute()
  }
  return derniereRoute
}

const ROUTE_PAR_DEFAUT: Route = { onglet: 'aujourdhui', sousVue: LISTE }

export function useRoute(): Route {
  // Le 3ᵉ argument est le rendu côté serveur : l'application n'en fait pas, mais React l'exige.
  return useSyncExternalStore(souscrire, lireRouteStable, () => ROUTE_PAR_DEFAUT)
}

export function hashDe(onglet: Onglet): string {
  return HASH_PAR_ONGLET[onglet]
}

/** `origine` omise ou `'recettes'` (le repli par défaut) → hash inchangé, sans suffixe. */
export function hashDeRecette(id: string, origine?: OrigineRecette): string {
  const base = `${PREFIXE_RECETTE}${encodeURIComponent(id)}`
  return origine === undefined || origine === ORIGINE_PAR_DEFAUT ? base : `${base}?de=${origine}`
}

export function hashDuFrigo(): string {
  return HASH_FRIGO
}

export function hashDesParametres(): string {
  return HASH_PARAMETRES
}

/** `null` = créer de zéro ; un identifiant = adapter cette recette. */
export function hashDeLEditeur(baseId: string | null): string {
  return baseId === null ? PREFIXE_EDITEUR : `${PREFIXE_EDITEUR}/${encodeURIComponent(baseId)}`
}

export function naviguer(onglet: Onglet): void {
  window.location.hash = hashDe(onglet)
}
