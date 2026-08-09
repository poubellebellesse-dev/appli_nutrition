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
/**
 * Un plat à cuisiner, tel que le hash le transporte.
 *
 * `portions` à `null` = aucun choix exprimé pour CE plat — voir `portionsDepuisRequete`. Le plat
 * ajouté en cours de route n'en porte souvent pas : on l'a désigné dans une liste, pas réglé sur une
 * fiche. C'est alors le `portionsBase` de la recette qui s'applique, et surtout pas celui du plat
 * principal : « rôti pour 6 » ne dit rien du nombre de parts de la sauce.
 */
export interface PlatACuisiner {
  readonly id: string
  readonly portions: number | null
}

export type SousVue =
  | { readonly type: 'liste' }
  | { readonly type: 'recette'; readonly id: string; readonly origine: OrigineRecette }
  | { readonly type: 'frigo' }
  | { readonly type: 'parametres' }
  /** Éditeur de recette. `baseId` non nul = on adapte une recette existante. */
  | { readonly type: 'editeur'; readonly baseId: string | null }
  /**
   * Mode cuisine, plein écran (§5bis ARCHITECTURE). `plats` en porte UN OU PLUSIEURS — voir
   * `PlatACuisiner` et `platsDepuisRequete`.
   *
   * ⚠️ JAMAIS VIDE. Un hash dont on ne tire aucun plat lisible retombe sur la liste des recettes,
   * pas sur une cuisine à zéro plat. Le type ne sait pas le dire, mais aucune branche de
   * `lireRoute` ne construit ce cas — c'est l'invariant que `cuisine.tsx` a le droit de supposer
   * pour lire `plats[0]` sans garde.
   */
  | { readonly type: 'cuisine'; readonly plats: readonly PlatACuisiner[] }
  /**
   * Détail d'un ALIMENT (décision 33). `retour` : le hash d'où l'on vient, `''` quand on ne le sait
   * pas (lien collé, signet). Voir `retourDepuisRequete` — c'est un HASH, pas un mot-clé, et
   * `hashDeLAliment` dit pourquoi.
   */
  | { readonly type: 'aliment'; readonly id: string; readonly retour: string }

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
 * Le mode cuisine — TROISIÈME route paramétrée du projet.
 *
 * ⚠️ LA QUESTION DE LA BIBLIOTHÈQUE A ÉTÉ ROUVERTE ICI, comme l'en-tête et `PREFIXE_EDITEUR`
 * l'exigeaient (« à rouvrir vraiment au troisième »). Réponse : TOUJOURS NON, et voici pourquoi
 * plutôt que de laisser le lecteur suivant refaire le calcul.
 *
 *   - Le motif est le MÊME que les deux autres : un préfixe, un identifiant encodé, aucun
 *     imbriquement. C'est le troisième cas d'un patron déjà écrit, pas un troisième patron.
 *   - `react-router-dom` est conçu autour de l'History API ; ce projet route par HASH, et pour une
 *     raison qui ne changera pas (PWA servie hors ligne, aucun serveur pour réécrire les URL).
 *   - Le coût réel ci-dessous est de six lignes.
 *
 * ⚠️ CE QUI REROUVRIRAIT VRAIMENT LA QUESTION, et qui n'est pas le nombre de routes : une route qui
 * en imbrique une autre, ou un besoin de transition/garde de navigation. Là, le fait maison
 * commencerait à réimplémenter une bibliothèque.
 */
const PREFIXE_CUISINE = '#/cuisine/'

/**
 * Le détail d'un aliment — QUATRIÈME route paramétrée (décision 33).
 *
 * ⚠️ LA QUESTION DE LA BIBLIOTHÈQUE NE SE ROUVRE PAS ICI, et il faut le dire plutôt que de laisser
 * croire à un oubli. `PREFIXE_CUISINE` a posé le critère, et ce n'est PAS le nombre de routes : ce
 * qui rouvrirait vraiment, c'est « une route qui en imbrique une autre, ou un besoin de
 * transition/garde de navigation ». Ni l'un ni l'autre ici — c'est le quatrième cas du même patron
 * (un préfixe, un identifiant encodé, aucun imbriquement), pour six lignes.
 *
 * ⚠️ SON RETOUR EST UN HASH, PAS UN MOT-CLÉ, et c'est la seule vraie différence avec les trois
 * autres. `OrigineRecette` énumère quatre écrans parce qu'on n'arrive sur une fiche que depuis un
 * écran ; on arrive sur un aliment depuis une recette **précise**, et un mot-clé ne sait pas dire
 * laquelle. Élargir `OrigineRecette` avec un `recette:<id>` reviendrait à transporter un hash dans
 * un mot-clé, en moins lisible.
 */
const PREFIXE_ALIMENT = '#/aliment/'

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

  if (hash.startsWith(PREFIXE_CUISINE)) {
    // Même précaution que les deux autres routes paramétrées : `decodeURIComponent` lève sur un `%`
    // isolé. Un fragment illisible ramène à la liste, jamais un écran blanc.
    try {
      // Les portions voyagent APRÈS l'id, en `?portions=<n>` — même motif que `?de=` sur la fiche,
      // et même précaution : un id peut légitimement contenir un `?` encodé (`%3F`), d'où le split
      // sur le fragment BRUT, avant décodage de l'id.
      const [idBrut, requete] = hash.slice(PREFIXE_CUISINE.length).split('?')
      const id = decodeURIComponent(idBrut ?? '')
      if (id !== '') {
        const plats = platsDepuisRequete({ id, portions: portionsDepuisRequete(requete) }, requete)
        return { onglet: 'recettes', sousVue: { type: 'cuisine', plats } }
      }
    } catch {
      /* fragment illisible → liste des recettes */
    }
    return { onglet: 'recettes', sousVue: LISTE }
  }

  if (hash.startsWith(PREFIXE_ALIMENT)) {
    // Mêmes précautions que les trois autres routes paramétrées : `decodeURIComponent` lève sur un
    // `%` isolé, et le split se fait sur le fragment BRUT parce qu'un id peut contenir un `?` encodé.
    try {
      const [idBrut, requete] = hash.slice(PREFIXE_ALIMENT.length).split('?')
      const id = decodeURIComponent(idBrut ?? '')
      if (id !== '') {
        return { onglet: 'recettes', sousVue: { type: 'aliment', id, retour: retourDepuisRequete(requete) } }
      }
    } catch {
      /* fragment illisible → liste des recettes */
    }
    return { onglet: 'recettes', sousVue: LISTE }
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

/**
 * Portions demandées au lancement de la cuisson, ou `null`.
 *
 * ⚠️ `null` NE VEUT PAS DIRE « 4 ». Il veut dire « aucun choix exprimé » — hash de reprise, lien
 * collé, signet antérieur à cette fonctionnalité. C'est alors le mode cuisine qui retombe sur le
 * `portionsBase` de la recette. Substituer un nombre ICI inventerait un choix que personne n'a fait,
 * et l'écrirait dans la session persistée comme s'il avait été voulu.
 *
 * Tout ce qui n'est pas un entier ≥ 1 est rejeté : `portions=0` supprimerait la recette, et une
 * valeur fractionnaire passerait ensuite dans `scaleRecipe` sans que rien ne l'arrête.
 */
function portionsDepuisRequete(requete: string | undefined): number | null {
  // Une seule règle de validité pour les portions, partagée avec `&avec=` : deux copies de ce test
  // dériveraient, et le hash accepterait d'un côté ce qu'il refuse de l'autre.
  return entierPositif(new URLSearchParams(requete ?? '').get('portions') ?? '')
}

/**
 * Les plats d'une même cuisson : le principal (dans le chemin) suivi de ceux que `&avec=` ajoute.
 *
 * Format : `&avec=<id>:<portions>,<id>,…` — les identifiants sont encodés un par un, les portions
 * facultatives et séparées par `:`.
 *
 * ⚠️ LA VALEUR N'EST PAS LUE PAR `URLSearchParams`, et ce n'est pas une négligence. Celui-ci décode
 * une fois : un identifiant contenant une virgule y arriverait en `%2C`, en ressortirait en `,` et
 * se scinderait en deux plats fantômes. On découpe donc le fragment BRUT — même précaution que le
 * split sur `?` juste au-dessus, pour la même raison.
 *
 * ⚠️ LES DOUBLONS SONT ÉCARTÉS, et c'est une protection, pas un confort. `ordonnancerCuissons` LÈVE
 * sur un `recipeId` en double, et `user_cuisine_session.recette_id` est `UNIQUE` : un lien recollé
 * deux fois, ou un plat ajouté qui se trouve être le plat principal, ferait planter l'écran au lieu
 * d'ouvrir la cuisine. Le premier gagne, parce que c'est lui qui porte les portions réglées à la main.
 */
function platsDepuisRequete(principal: PlatACuisiner, requete: string | undefined): readonly PlatACuisiner[] {
  const plats: PlatACuisiner[] = [principal]
  const vus = new Set<string>([principal.id])
  for (const morceau of valeurBrute(requete, 'avec').split(',')) {
    if (morceau === '') continue
    const sep = morceau.indexOf(':')
    const idBrut = sep === -1 ? morceau : morceau.slice(0, sep)
    const id = decodeURIComponent(idBrut)
    if (id === '' || vus.has(id)) continue
    vus.add(id)
    plats.push({ id, portions: sep === -1 ? null : entierPositif(morceau.slice(sep + 1)) })
  }
  return plats
}

/** La valeur d'un paramètre SANS décodage, pour les cas où le décodage effacerait un séparateur. */
function valeurBrute(requete: string | undefined, cle: string): string {
  const prefixe = `${cle}=`
  for (const paire of (requete ?? '').split('&')) {
    if (paire.startsWith(prefixe)) return paire.slice(prefixe.length)
  }
  return ''
}

/** Même règle que `portionsDepuisRequete` : tout ce qui n'est pas un entier ≥ 1 devient `null`. */
function entierPositif(brut: string): number | null {
  if (brut === '') return null
  const n = Number(brut)
  return Number.isInteger(n) && n >= 1 ? n : null
}

/**
 * Le hash de retour porté par `?de=` sur une fiche aliment. `''` = on ne sait pas d'où l'on vient.
 *
 * ⚠️ VALIDÉ, PAS SEULEMENT DÉCODÉ. Tout ce qui ne commence pas par `#/` est jeté, pour deux raisons
 * distinctes : une valeur tronquée ou inventée poserait un lien « ← » qui ne mène nulle part, et
 * surtout ce hash finit dans un `href`. Sans ce filtre, `?de=https://…` produirait un lien SORTANT
 * depuis une valeur venue de l'URL — le retour d'une page interne doit rester interne, par
 * construction et pas par confiance dans l'appelant.
 *
 * `URLSearchParams` décode déjà : le hash arrive tel qu'il a été écrit par `hashDeLAliment`.
 */
function retourDepuisRequete(requete: string | undefined): string {
  const brut = new URLSearchParams(requete ?? '').get('de')
  return brut !== null && brut.startsWith('#/') ? brut : ''
}

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

/**
 * `portions` omise → hash nu, sans suffixe.
 *
 * C'est le lien de REPRISE : il laisse la session décider, parce qu'une cuisson déjà commencée porte
 * déjà son nombre de portions et qu'un lien ne doit pas l'écraser. Seule la fiche recette, au premier
 * lancement, a une valeur à transmettre.
 *
 * `avec` : les plats à cuisiner EN MÊME TEMPS, dans l'ordre où on les a désignés. Cet ordre-là n'est
 * pas celui où on cuisinera — c'est `ordonnancerCuissons` qui le décide, et il part du plat le plus
 * long. Le hash transporte un ensemble, pas un programme.
 */
export function hashDeLaCuisine(id: string, portions?: number, avec: readonly PlatACuisiner[] = []): string {
  const base = `${PREFIXE_CUISINE}${encodeURIComponent(id)}`
  const parametres: string[] = []
  if (portions !== undefined) parametres.push(`portions=${portions}`)
  if (avec.length > 0) {
    const morceaux = avec.map((p) =>
      p.portions === null ? encodeURIComponent(p.id) : `${encodeURIComponent(p.id)}:${p.portions}`,
    )
    parametres.push(`avec=${morceaux.join(',')}`)
  }
  return parametres.length === 0 ? base : `${base}?${parametres.join('&')}`
}

/**
 * `retour` omis ou vide → hash nu : la fiche retombera sur un lien d'accueil plutôt que d'annoncer
 * une provenance qu'elle ignore. Passer le hash COMPLET d'où l'on vient, `hashDeRecette(id)` inclus.
 */
export function hashDeLAliment(id: string, retour?: string): string {
  const base = `${PREFIXE_ALIMENT}${encodeURIComponent(id)}`
  return retour === undefined || retour === '' ? base : `${base}?de=${encodeURIComponent(retour)}`
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
