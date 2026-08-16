// tests/scelles/gestes-hors-ligne.test.ts — LOT 4 du chantier « gestes illustrés ».
//
// ⚠️ NOM DU FICHIER : `/brief 4` prescrivait `tests/scelles/4.test.ts`. Un fichier nommé `4.test.ts`
// ne dit rien à personne, et sur ce dépôt LE NOM DU FICHIER SCELLÉ EST LE NOM DU LOT — c'est ce qui
// a permis à `/plan` de retrouver le lot 1 sous « gestes-champ-media ». Nommé comme son jumeau.
//
// ÉCRIT DEPUIS LE « Fini quand » SEUL, AVANT TOUTE LIGNE DE CODE DE PRODUCTION.
// ▶ docs/CONCEPTION_GESTES_ILLUSTRES.md §5, lot 4 — les neuf critères, dans l'ordre.
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ TROISIÈME VERSION. LES DEUX PREMIÈRES SONT TOMBÉES, ET IL FAUT SAVOIR PAR QUOI.
//
// PREMIÈRE ATTAQUE — verdict « ils ne discriminent pas », trois triches sur la conservation :
//   · c5 : `empreinte = String(statSync(f).size)` passait, le témoin grossissant à la réécriture.
//   · c6 : deux URL en dur passaient les sept assertions.
//   · c7 : il lisait du TEXTE (`sw.includes(source)` + regex `cache.put(`). Une constante jamais
//     appelée plus un `put` INCONDITIONNEL le passaient au vert EN CACHANT TOUT.
//   · et un trou de CONCEPTION : `activate` purge tout cache ≠ courant ⇒ critère 9.
//
// SECONDE ATTAQUE — verdict « ils ne discriminent pas » encore, deux touches sérieuses :
//   · c1+c2 : rien n'obligeait `generateBundle` À APPELER `mediasDeGestes`. Une liste des 6 URL
//     réelles avec leurs empreintes collées passait. Quatrième occurrence du piège « déclaré ≠
//     branché », que le critère 7 fermait pour le prédicat et laissait ouvert pour le balayage.
//     ⇒ LE BUILD TOURNE MAINTENANT SUR UN `publicDir` TÉMOIN contenant un geste INVENTÉ. Une liste
//     en dur ne peut pas deviner un code qui n'existait pas quand le code a été écrit.
//   · c9 : ranger les clips dans `CACHE` lui-même faisait dégénérer le triplet en doublet, et
//     l'assertion devenait vraie par construction. ⇒ `cacheDesClips !== cacheCourant`, explicite.
//   · c5 : `mtimeMs` remplaçait `size`, même trou d'un cran plus loin. ⇒ le mtime est RESTAURÉ.
//   · c7 : un `cache.put` détaché, hors `waitUntil` et hors chaîne rendue à `respondWith`, peut ne
//     jamais aboutir dans un vrai navigateur. ⇒ les bouchons du cache résolvent sur MACROTÂCHE, et
//     le test distingue une écriture PROTÉGÉE d'une écriture qui traîne après coup.
//   · c3 bis : `includes('brouillons')` remplaçait un calcul de profondeur. ⇒ deux sous-dossiers
//     profonds de noms différents, dont un au nom parfaitement anodin, et une assertion de FORME.
//
// ⚠️ On ne réécrit pas un critère cassé en silence : chaque correction est nommée là où elle vit,
// sinon la même triche revient au lot suivant.
// ─────────────────────────────────────────────────────────────────────────────
//
// ─────────────────────────────────────────────────────────────────────────────
// CE QUI EST MESURÉ, ET QUI REND CES TESTS ROUGES AUJOURD'HUI (relevé du 2026-08-16)
//
//   `catalog/gestes` apparaît ZÉRO fois dans `dist/sw.js`.
//
// Les 18 fichiers du lot 2 sont bien copiés dans `dist/` par Vite, mais AUCUN n'est pré-caché ni ne
// compte dans la version du cache. Hors ligne, les vignettes du lexique sont donc cassées — trou
// introduit par le lot 3, invisible en ligne. Et le service worker ne fait AUCUN `cache.put` : un
// clip regardé en ligne est perdu hors ligne, alors que §7.1 l.982 dit « à la 1ʳᵉ consultation,
// PUIS CONSERVÉ ».
//
// ─────────────────────────────────────────────────────────────────────────────
// POURQUOI UN IMPORT DE NAMESPACE ET DES CASTS, PLUTÔT QUE DES IMPORTS NOMMÉS
//
// Les deux fonctions attendues n'existent pas encore. Un `import { mediasDeGestes }` ferait échouer
// le fichier À LA COLLECTE : un seul rouge illisible pour neuf critères, et surtout `npm run
// typecheck` deviendrait ROUGE — or le typecheck doit rester propre pendant tout le lot, c'est l'une
// des quatre commandes. Le namespace laisse le fichier se charger, chaque critère échoue SÉPARÉMENT
// avec son propre message, et la sortie rouge se lit critère par critère.
// ⚠️ Ce n'est pas une commodité : c'est ce qui rend la sortie rouge exploitable comme spécification.
// ─────────────────────────────────────────────────────────────────────────────

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { build } from 'vite'
import configVite from '../../vite.config.js'
import * as plugin from '../../vite-plugin-sw.js'
import { versionDuCache, type EntreePrecache } from '../../vite-plugin-sw.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..', '..')
const PUBLIC_REEL = path.join(REPO_ROOT, 'app', 'public')
const GESTES_REELS = path.join(PUBLIC_REEL, 'catalog', 'gestes')

/** Le module vu sans ses types, pour interroger des exports qui n'existent pas encore. */
const MODULE = plugin as unknown as Record<string, unknown>

/**
 * Le contrat attendu du balayage, écrit ici parce qu'il n'existe nulle part ailleurs.
 *
 * ⚠️ IL REND DES EMPREINTES, PAS DES URL. C'est ce qui rend le critère 5 testable sans toucher au
 * dépôt : sans empreinte dans le retour, « le contenu d'un clip entre dans la version du cache » ne
 * se vérifierait qu'en modifiant un vrai `.mp4` de `app/public/`, donc en salissant l'arbre.
 */
type MediasDeGestes = (publicDir: string) => {
  readonly posters: readonly EntreePrecache[]
  readonly clips: readonly EntreePrecache[]
}

/** Le prédicat de conservation au runtime. Reçoit un CHEMIN (`url.pathname`). §7.1 l.982. */
type DoitEtreConserve = (url: string) => boolean

function exportAttendu<T>(nom: string): T {
  const valeur = MODULE[nom]
  expect(
    typeof valeur,
    `\`${nom}\` n'est pas exporté par vite-plugin-sw.ts — le lot 4 n'est pas codé`
  ).toBe('function')
  return valeur as T
}

function fichiersRecursifs(dossier: string): string[] {
  const trouves: string[] = []
  for (const entree of readdirSync(dossier)) {
    const complet = path.join(dossier, entree)
    if (statSync(complet).isDirectory()) trouves.push(...fichiersRecursifs(complet))
    else trouves.push(complet)
  }
  return trouves
}

/** URL servie d'un fichier de gestes, relative au dossier `catalog/gestes/` donné. */
function urlDuGeste(fichier: string, racineGestes: string): string {
  return '/catalog/gestes/' + path.relative(racineGestes, fichier).split(path.sep).join('/')
}

// ═════════════════════════════════════════════════════════════════════════════
// LE BAC TÉMOIN — des gestes qui n'existent pas au catalogue
// ═════════════════════════════════════════════════════════════════════════════

/** Les octets du clip qu'on va « ré-encoder ». MÊME LONGUEUR des deux côtés — voir critère 5. */
const CLIP_AVANT = 'AV1-A'
const CLIP_APRES = 'AV1-B'

function bacTemoin(): string {
  const racine = mkdtempSync(path.join(tmpdir(), 'nutri-gestes-'))
  const dossier = path.join(racine, 'catalog', 'gestes')

  // Quatre gestes qui n'existent pas, avec des formes DIFFÉRENTES — un balayage qui supposerait
  // « un poster par geste » ou « toujours une paire poster+clips » passerait sur un bac uniforme.
  mkdirSync(path.join(dossier, 'zzz-temoin-un'), { recursive: true })
  writeFileSync(path.join(dossier, 'zzz-temoin-un', 'zzz-temoin-un-unique.jpg'), 'POSTER-A')
  writeFileSync(path.join(dossier, 'zzz-temoin-un', 'zzz-temoin-un-unique.av1.mp4'), CLIP_AVANT)
  writeFileSync(path.join(dossier, 'zzz-temoin-un', 'zzz-temoin-un-unique.h264.mp4'), 'H264-A')

  mkdirSync(path.join(dossier, 'zzz-temoin-deux'), { recursive: true })
  for (const moment of ['debut', 'fin']) {
    writeFileSync(path.join(dossier, 'zzz-temoin-deux', `zzz-temoin-deux-${moment}.jpg`), `POSTER-${moment}`)
    writeFileSync(path.join(dossier, 'zzz-temoin-deux', `zzz-temoin-deux-${moment}.av1.mp4`), `AV1-${moment}`)
    writeFileSync(path.join(dossier, 'zzz-temoin-deux', `zzz-temoin-deux-${moment}.h264.mp4`), `H264-${moment}`)
  }

  // ⛔ LES DEUX DÉPAREILLÉS. Le cas n'était ni exercé ni tranché : un clip sans poster, un poster
  // sans clip. Les deux listes sont INDÉPENDANTES — aucun appariement n'est supposé.
  mkdirSync(path.join(dossier, 'zzz-temoin-trois'), { recursive: true })
  writeFileSync(path.join(dossier, 'zzz-temoin-trois', 'zzz-temoin-trois-unique.av1.mp4'), 'AV1-ORPHELIN')
  mkdirSync(path.join(dossier, 'zzz-temoin-quatre'), { recursive: true })
  writeFileSync(path.join(dossier, 'zzz-temoin-quatre', 'zzz-temoin-quatre-unique.jpg'), 'POSTER-ORPHELIN')

  // LES INTRUS. ⚠️ Ils sont SIX, et pas deux : avec deux noms, une liste noire
  // `if (nom === 'Thumbs.db' || nom === 'notes.txt')` passait le test tout en laissant entrer
  // n'importe quel autre polluant. Six familles distinctes — nom Windows, nom macOS, fichier de
  // configuration, sauvegarde d'éditeur, texte, et aucune extension du tout.
  const dossierUn = path.join(dossier, 'zzz-temoin-un')
  writeFileSync(path.join(dossierUn, 'Thumbs.db'), 'BINAIRE-WINDOWS')
  writeFileSync(path.join(dossierUn, 'notes.txt'), 'une note laissée là')
  writeFileSync(path.join(dossierUn, '.DS_Store'), 'BINAIRE-MACOS')
  writeFileSync(path.join(dossierUn, 'desktop.ini'), '[.ShellClassInfo]')
  writeFileSync(path.join(dossierUn, 'zzz-temoin-un-unique.jpg.bak'), 'SAUVEGARDE')
  writeFileSync(path.join(dossierUn, 'LISEZMOI'), 'sans extension du tout')

  // ⛔ LES PIÈGES DE PROFONDEUR. Le brief prescrit UN SEUL niveau sous `catalog/gestes/`, un par
  // code de geste. DEUX sous-dossiers de noms DIFFÉRENTS, dont l'un — `archive/` — porte un fichier
  // au nom parfaitement légitime. ⚠️ Un `if (!chemin.includes('brouillons'))` passait la version
  // précédente sans jamais compter un niveau ; il tombe sur `archive/`.
  mkdirSync(path.join(dossierUn, 'brouillons'), { recursive: true })
  writeFileSync(path.join(dossierUn, 'brouillons', 'piege-profondeur.jpg'), 'TROP-PROFOND')
  writeFileSync(path.join(dossierUn, 'brouillons', 'piege-profondeur.av1.mp4'), 'TROP-PROFOND')
  mkdirSync(path.join(dossier, 'zzz-temoin-deux', 'archive'), { recursive: true })
  writeFileSync(path.join(dossier, 'zzz-temoin-deux', 'archive', 'zzz-temoin-deux-debut.jpg'), 'TROP-PROFOND')

  return racine
}

// ═════════════════════════════════════════════════════════════════════════════
// LE HARNAIS — on EXÉCUTE le service worker émis, on ne le lit pas
//
// ⚠️ C'EST LA RÉPONSE À LA DÉMOLITION DU CRITÈRE 7. Un test qui cherche un texte dans `sw.js` ne
// prouve rien : une fonction déclarée et jamais appelée y figure aussi. Ici on gree un faux
// `ServiceWorkerGlobalScope` dans un `node:vm`, on charge le worker RÉELLEMENT ÉMIS, on lui envoie
// de vrais événements, et on regarde ce qui atterrit dans `cache.put`.
//
// ⚠️ `caches.match` REND TOUJOURS « RIEN » DANS CE HARNAIS. C'est délibéré : le cache est vide, donc
// chaque requête part au réseau, donc chaque requête ARRIVE au point de décision. Si la décision
// n'existe pas — un `cache.put` inconditionnel — la photo et le bundle sont cachés eux aussi.
//
// ⚠️ `caches.open` ET `cache.put` RÉSOLVENT SUR MACROTÂCHE, PAS SUR MICROTÂCHE. Ce n'est pas un
// détail d'implémentation : c'est ce qui rend observable la différence entre une écriture PROTÉGÉE
// (attendue dans la chaîne rendue à `respondWith`, ou enregistrée par `event.waitUntil`) et une
// écriture DÉTACHÉE, qu'un vrai navigateur a le droit de tuer dès la réponse rendue. Un cache réel
// est de l'entrée-sortie ; le bouchon se comporte comme tel.
// ═════════════════════════════════════════════════════════════════════════════

const ORIGINE = 'https://nutrition.test'

interface AppelPut {
  readonly cache: string
  readonly url: string
  /** La réponse mise en cache était-elle un `clone()`, ou l'original que la page doit lire ? */
  readonly clone: boolean
}

interface Consultation {
  /** Écritures terminées AVANT que le worker ne lâche la main — les seules qui survivent. */
  readonly protegees: readonly AppelPut[]
  /** Écritures qui ne se sont produites qu'après, en laissant tourner la boucle. */
  readonly tardives: readonly AppelPut[]
}

interface Worker {
  requeter(url: string, options?: { readonly statut?: number }): Promise<Consultation>
  activer(cachesExistants: readonly string[]): Promise<readonly string[]>
}

function chargerWorker(sw: string): Worker {
  const ecouteurs = new Map<string, (e: unknown) => void>()
  const puts: AppelPut[] = []
  const supprimes: string[] = []
  let cachesExistants: readonly string[] = []

  /** Une entrée-sortie : elle rend la main à la boucle d'événements, comme un vrai cache. */
  const entreeSortie = <T>(valeur: T): Promise<T> =>
    new Promise((resoudre) => setTimeout(() => resoudre(valeur), 0))

  const ouvrirCache = (nom: string) => ({
    addAll: () => entreeSortie(undefined),
    add: () => entreeSortie(undefined),
    match: () => entreeSortie(undefined),
    put: (requete: unknown, reponse: unknown) => {
      const url = typeof requete === 'string' ? requete : String((requete as { url: string }).url)
      const clone = (reponse as { estUnClone?: boolean } | null)?.estUnClone === true
      return entreeSortie(undefined).then(() => {
        puts.push({ cache: nom, url, clone })
      })
    },
  })

  const cachesStub = {
    open: (nom: string) => entreeSortie(ouvrirCache(nom)),
    keys: () => entreeSortie([...cachesExistants]),
    delete: (nom: string) =>
      entreeSortie(undefined).then(() => {
        supprimes.push(nom)
        return true
      }),
    // Cache vide : tout part au réseau, donc tout atteint le point de décision.
    match: () => entreeSortie(undefined),
  }

  // ⚠️ LE CORPS D'UNE RÉPONSE NE SE LIT QU'UNE FOIS, et `clone()` rend ici un objet DISTINCT, marqué.
  // Un bouchon dont `clone()` se rendait lui-même laissait passer `cache.put(requete, reponse)` sans
  // clone : vert au test, cassé en navigateur — le cache consommerait le corps que la page attend
  // pour lire la vidéo. Le marqueur rend l'oubli observable.
  const reponse = (statut: number): unknown => {
    const commun = {
      ok: statut >= 200 && statut < 300,
      status: statut,
      type: 'basic',
      headers: { get: () => null },
    }
    const original: Record<string, unknown> = { ...commun, estUnClone: false }
    original['clone'] = () => ({ ...commun, estUnClone: true, clone: () => original })
    return original
  }

  let statutCourant = 200

  const selfStub: Record<string, unknown> = {
    addEventListener: (type: string, fn: (e: unknown) => void) => ecouteurs.set(type, fn),
    skipWaiting: () => undefined,
    location: { origin: ORIGINE, href: `${ORIGINE}/` },
    clients: { claim: () => entreeSortie(undefined) },
    registration: { scope: `${ORIGINE}/` },
    caches: cachesStub,
  }

  const contexte: Record<string, unknown> = {
    self: selfStub,
    caches: cachesStub,
    URL,
    Request: class {},
    Response: class {},
    Promise,
    setTimeout,
    console,
    fetch: () => entreeSortie(reponse(statutCourant)),
  }
  contexte['globalThis'] = contexte
  selfStub['fetch'] = contexte['fetch']

  vm.runInNewContext(sw, vm.createContext(contexte), { filename: 'dist/sw.js' })

  /** Laisse tourner la boucle d'événements — c'est là qu'une écriture détachée se termine. */
  const laisserTourner = async () => {
    for (let i = 0; i < 8; i += 1) await new Promise((r) => setTimeout(r, 0))
  }

  return {
    async requeter(url, options) {
      const ecouteur = ecouteurs.get('fetch')
      expect(ecouteur, 'le worker n’écoute pas `fetch`').toBeTypeOf('function')
      statutCourant = options?.statut ?? 200
      puts.length = 0

      const attentes: Promise<unknown>[] = []
      let reponduAvec: Promise<unknown> | undefined
      ecouteur?.({
        request: { method: 'GET', mode: 'no-cors', url: `${url}`, destination: '' },
        respondWith: (p: unknown) => {
          reponduAvec = Promise.resolve(p)
        },
        waitUntil: (p: unknown) => {
          attentes.push(Promise.resolve(p))
        },
      })

      // Ce que le worker garde EN VIE : la promesse rendue à `respondWith`, plus celles confiées à
      // `waitUntil`. Tout ce qui a fini ici survivrait dans un vrai navigateur.
      await reponduAvec
      await Promise.all(attentes)
      const protegees = [...puts]

      // Puis on laisse tourner. Ce qui apparaît maintenant était DÉTACHÉ.
      await laisserTourner()
      const tardives = puts.slice(protegees.length)

      return { protegees, tardives }
    },

    async activer(existants) {
      const ecouteur = ecouteurs.get('activate')
      expect(ecouteur, 'le worker n’écoute pas `activate`').toBeTypeOf('function')
      cachesExistants = existants
      supprimes.length = 0

      const attentes: Promise<unknown>[] = []
      ecouteur?.({
        waitUntil: (p: unknown) => {
          attentes.push(Promise.resolve(p))
        },
      })
      await Promise.all(attentes)
      await laisserTourner()
      return [...supprimes]
    },
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// VOLET 1 — le balayage, prouvé sur un dossier INVENTÉ (critères 3, 3 bis, 4, 5, 6)
//
// ⚠️ C'EST LE VOLET QUI TUE LA TRICHE PAR LISTE EN DUR. Les gestes n'existent pas au catalogue, et
// aucune liste écrite à l'avance ne peut les deviner.
// ═════════════════════════════════════════════════════════════════════════════

describe('lot gestes-hors-ligne — le balayage ne peut pas être une liste écrite à la main', () => {
  let racine = ''
  beforeAll(() => {
    racine = bacTemoin()
  })
  afterAll(() => {
    rmSync(racine, { recursive: true, force: true })
  })

  it('⛔ CRITÈRE 3 — rend les posters de gestes QUI N’EXISTENT PAS, et jamais leurs clips', () => {
    const mediasDeGestes = exportAttendu<MediasDeGestes>('mediasDeGestes')
    const { posters, clips } = mediasDeGestes(racine)

    // 4 posters pour 4 gestes de formes différentes, dont un geste SANS clip. Un balayage qui
    // supposerait « un poster par geste » ou « toujours une paire » se trompe ici.
    expect(posters.map((e) => e.url).sort(), 'les posters témoins ne sont pas tous vus').toEqual([
      '/catalog/gestes/zzz-temoin-deux/zzz-temoin-deux-debut.jpg',
      '/catalog/gestes/zzz-temoin-deux/zzz-temoin-deux-fin.jpg',
      '/catalog/gestes/zzz-temoin-quatre/zzz-temoin-quatre-unique.jpg',
      '/catalog/gestes/zzz-temoin-un/zzz-temoin-un-unique.jpg',
    ])

    // Et les clips sont vus SÉPARÉMENT — ils comptent pour la version, jamais pour le pré-cache.
    // Dont un clip ORPHELIN, sans poster : les deux listes sont indépendantes.
    expect(clips.map((e) => e.url).sort(), 'les clips témoins ne sont pas tous vus').toEqual([
      '/catalog/gestes/zzz-temoin-deux/zzz-temoin-deux-debut.av1.mp4',
      '/catalog/gestes/zzz-temoin-deux/zzz-temoin-deux-debut.h264.mp4',
      '/catalog/gestes/zzz-temoin-deux/zzz-temoin-deux-fin.av1.mp4',
      '/catalog/gestes/zzz-temoin-deux/zzz-temoin-deux-fin.h264.mp4',
      '/catalog/gestes/zzz-temoin-trois/zzz-temoin-trois-unique.av1.mp4',
      '/catalog/gestes/zzz-temoin-un/zzz-temoin-un-unique.av1.mp4',
      '/catalog/gestes/zzz-temoin-un/zzz-temoin-un-unique.h264.mp4',
    ])

    // ⛔ La moitié qui compte : AUCUN clip du côté poster. Sans elle, un balayage qui rendrait tout
    // dans les deux listes passerait les deux assertions précédentes.
    for (const e of posters) {
      expect(e.url, `« ${e.url} » est un clip rangé du côté des posters`).not.toMatch(/\.mp4$/)
    }
  })

  it('⛔ CRITÈRE 3 bis — exactement UN niveau de sous-dossiers ; et un dossier absent ne casse rien', () => {
    const mediasDeGestes = exportAttendu<MediasDeGestes>('mediasDeGestes')
    const { posters, clips } = mediasDeGestes(racine)

    // ⛔ LA PROFONDEUR, ASSERTÉE PAR LA FORME et non par un nom de dossier. Deux sous-dossiers
    // profonds attendent, `brouillons/` et `archive/`, et le second porte un nom de fichier
    // parfaitement légitime. Un filtre par nom de dossier tombe ici ; seul un vrai calcul de
    // profondeur passe.
    for (const e of [...posters, ...clips]) {
      expect(
        e.url,
        `« ${e.url} » n’est pas à /catalog/gestes/<geste>/<fichier> — profondeur non respectée`
      ).toMatch(/^\/catalog\/gestes\/[^/]+\/[^/]+$/)
    }

    // Même choix qu'`imagesPubliques` : le dossier n'existe pas tant que rien n'est importé, et le
    // build doit aboutir. Un `throw` ici casserait le build de quiconque n'a pas lancé l'import.
    const vide = mkdtempSync(path.join(tmpdir(), 'nutri-vide-'))
    try {
      const rien = mediasDeGestes(vide)
      expect(rien.posters, 'un dossier absent devrait rendre zéro poster').toEqual([])
      expect(rien.clips, 'un dossier absent devrait rendre zéro clip').toEqual([])
    } finally {
      rmSync(vide, { recursive: true, force: true })
    }
  })

  it('⛔ CRITÈRE 4 — seule une LISTE BLANCHE d’extensions passe : six intrus, six familles', () => {
    const mediasDeGestes = exportAttendu<MediasDeGestes>('mediasDeGestes')
    const { posters, clips } = mediasDeGestes(racine)

    // ⛔ L'assertion POSITIVE, celle qui interdit la liste noire : tout ce qui sort porte une
    // extension autorisée. Un `if (nom === 'Thumbs.db' || nom === 'notes.txt') continue` laissait
    // passer les quatre autres et personne ne l'aurait su.
    for (const e of posters) {
      expect(e.url, `« ${e.url} » n’est pas un poster .jpg`).toMatch(/\.jpg$/)
    }
    for (const e of clips) {
      expect(e.url, `« ${e.url} » n’est pas un clip .mp4`).toMatch(/\.mp4$/)
    }

    // Et la même chose vue depuis les intrus, pour que la sortie rouge NOMME le fichier fautif.
    const toutes = [...posters, ...clips].map((e) => e.url)
    for (const intrus of ['Thumbs.db', 'notes.txt', '.DS_Store', 'desktop.ini', '.jpg.bak', 'LISEZMOI']) {
      expect(
        toutes.filter((u) => u.endsWith(intrus)),
        `« ${intrus} » est entré dans les médias balayés`
      ).toEqual([])
    }
  })

  it('⛔ CRITÈRE 5 — un clip ré-encodé à NOM, TAILLE et MTIME identiques change la version', () => {
    // ⚠️ LE PIÈGE EXACT QUE CE CRITÈRE FERME, et il a déjà été payé le 2026-07-30 sur `catalog.db` :
    // « hacher les noms n'invalide pas un cache ». Un `.mp4` a un nom FIXE — si seule la liste des
    // noms entre dans la version, un clip ré-encodé n'atteint jamais un utilisateur installé.
    //
    // ⚠️ TROIS PROXYS SONT NEUTRALISÉS, UN PAR ATTAQUE SUCCESSIVE. Le nom ne bouge pas (v1) ; la
    // TAILLE est identique des deux côtés (v2 — `String(statSync(f).size)` passait, et deux
    // ré-encodages de même poids sont banals en vidéo) ; le MTIME est RESTAURÉ après écriture (v3 —
    // `String(statSync(f).mtimeMs)` passait, et un `touch` aurait alors invalidé le cache pour rien
    // pendant qu'un checkout git uniformisant les dates aurait masqué un vrai changement).
    // ⇒ Il ne reste QUE le contenu. C'est `empreinteDeFichier`, sha-256 des octets, ou rien.
    const mediasDeGestes = exportAttendu<MediasDeGestes>('mediasDeGestes')
    const clip = path.join(racine, 'catalog', 'gestes', 'zzz-temoin-un', 'zzz-temoin-un-unique.av1.mp4')

    expect(
      Buffer.byteLength(CLIP_APRES),
      'le témoin de ré-encodage doit garder la MÊME taille, sinon il ne teste plus le contenu'
    ).toBe(Buffer.byteLength(CLIP_AVANT))

    // ⛔ LE MTIME EST D'ABORD ARRONDI À LA MILLISECONDE ENTIÈRE. Sans cette ligne le piège n'était
    // PAS ARMÉ : `utimesSync` écrit à la milliseconde, le mtime d'origine en portait une fraction
    // (`…991,3513`), et la restauration ci-dessous laissait donc un écart de 0,35 ms. Un
    // `empreinte = String(statSync(f).mtimeMs)` aurait vu une valeur différente et serait passé —
    // pendant que le test échouait sur sa propre pré-condition, donc ne jugeait plus rien, ni dans
    // un sens ni dans l'autre. Un critère qui échoue toujours ne discrimine pas mieux qu'un critère
    // qui passe toujours.
    const rondeur = new Date(Math.floor(statSync(clip).mtimeMs))
    utimesSync(clip, rondeur, rondeur)

    const avant = mediasDeGestes(racine)
    const versionAvant = versionDuCache([...avant.posters, ...avant.clips])
    const datesOrigine = statSync(clip)

    writeFileSync(clip, CLIP_APRES)
    utimesSync(clip, datesOrigine.atime, datesOrigine.mtime)
    try {
      const apres = mediasDeGestes(racine)
      const versionApres = versionDuCache([...apres.posters, ...apres.clips])

      expect(
        apres.clips.map((e) => e.url).sort(),
        'le ré-encodage a changé la LISTE des noms — le test ne prouverait alors rien'
      ).toEqual(avant.clips.map((e) => e.url).sort())
      expect(
        statSync(clip).size,
        'le ré-encodage a changé la TAILLE — un proxy sur la taille passerait'
      ).toBe(datesOrigine.size)
      expect(
        statSync(clip).mtimeMs,
        'le ré-encodage a changé le MTIME — un proxy sur la date passerait'
      ).toBe(datesOrigine.mtimeMs)

      expect(
        versionApres,
        'un clip ré-encodé à nom, taille ET date identiques laisse la version du cache inchangée — ' +
          'l’empreinte ne lit donc pas le contenu'
      ).not.toBe(versionAvant)
    } finally {
      writeFileSync(clip, CLIP_AVANT)
      utimesSync(clip, datesOrigine.atime, datesOrigine.mtime)
    }
  })

  it('⛔ CRITÈRE 6 — le prédicat vaut pour TOUS les clips, y compris ceux de gestes inventés', () => {
    const doitEtreConserve = exportAttendu<DoitEtreConserve>('doitEtreConserve')

    // ⛔ Les 12 clips RÉELS du disque, un par un. La v1 n'en exerçait que deux, et
    // `u === '/catalog/gestes/deglacer/deglacer-fin.av1.mp4' || u === '…h264.mp4'` la passait.
    const clipsReels = fichiersRecursifs(GESTES_REELS).filter((f) => f.endsWith('.mp4'))
    expect(clipsReels.length, 'aucun clip sur le disque — le test passerait à vide').toBeGreaterThan(0)
    for (const c of clipsReels) {
      const url = urlDuGeste(c, GESTES_REELS)
      expect(doitEtreConserve(url), `le clip ${url} devrait être conservé`).toBe(true)
    }

    // ⛔ ET des clips de gestes QUI N'EXISTENT PAS AU CATALOGUE. Une liste en dur ne peut pas les
    // deviner : c'est le même levier que le critère 3, appliqué au prédicat.
    for (const invente of [
      '/catalog/gestes/zzz-temoin-un/zzz-temoin-un-unique.av1.mp4',
      '/catalog/gestes/zzz-temoin-trois/zzz-temoin-trois-unique.av1.mp4',
      '/catalog/gestes/suer/suer-milieu.av1.mp4',
      '/catalog/gestes/blanchir/blanchir-debut.h264.mp4',
    ]) {
      expect(doitEtreConserve(invente), `le clip ${invente} devrait être conservé`).toBe(true)
    }

    // Tout ce qui est DÉJÀ pré-caché n'a rien à faire dans un second cache : le conserver au runtime
    // le stockerait deux fois, et sur un appareil sous pression c'est `user.db` que le navigateur
    // évince en premier.
    const refuses: readonly string[] = [
      ...fichiersRecursifs(GESTES_REELS)
        .filter((f) => f.endsWith('.jpg'))
        .map((f) => urlDuGeste(f, GESTES_REELS)),
      '/catalog/catalog.db',
      '/catalog/images/tarte.avif',
      '/assets/index-CYybvc8y.js',
      '/assets/index-B2kQ9.css',
      '/fonts/instrument-sans-latin.woff2',
      '/index.html',
      '/',
      // ⛔ Un `.mp4` hors du dossier des gestes n'est pas un clip de geste. Sans ces deux lignes, le
      // prédicat peut se réduire à « ça finit par .mp4 » et avaler n'importe quoi.
      '/media/ailleurs/promo.mp4',
      '/catalog/images/tarte.mp4',
      // ⛔ ET LA PROFONDEUR, ICI AUSSI. Sans ces trois lignes, un
      // `url.startsWith('/catalog/gestes/') && url.endsWith('.mp4')` passait toute la batterie :
      // aucun cas exercé n'allait plus bas qu'un niveau. Le balayage refuse déjà ces chemins
      // (critère 3 bis) ; le prédicat runtime doit les refuser AUSSI, sinon un fichier jamais
      // pré-caché ni publié se retrouverait conservé sur l'appareil.
      '/catalog/gestes/deglacer/brouillons/piege.av1.mp4',
      '/catalog/gestes/deglacer/archive/deglacer-fin.h264.mp4',
      '/catalog/gestes/deglacer.mp4',
    ]
    for (const url of refuses) {
      expect(doitEtreConserve(url), `« ${url} » ne devrait PAS être conservé au runtime`).toBe(false)
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// VOLET 2 — le service worker RÉELLEMENT ÉMIS, sur un publicDir TÉMOIN (1, 2, 7, 9, 8)
//
// ⛔ POURQUOI LE BUILD NE TOURNE PLUS SUR `app/public` MAIS SUR UNE COPIE AUGMENTÉE.
// Tant que le build lisait le vrai dossier, `generateBundle` pouvait très bien NE JAMAIS APPELER
// `mediasDeGestes` : une liste des 6 URL réelles, avec leurs empreintes sha-256 collées une fois,
// passait les critères 1 et 2. C'est le piège « déclaré ≠ branché » que ce dépôt dit avoir payé
// trois fois, et le critère 7 ne le fermait que pour le prédicat.
//
// Ici on copie `app/public` (8,3 Mo) dans un dossier temporaire, on y AJOUTE un geste qui n'existe
// pas au catalogue, et on build là-dessus via l'API JS de Vite en réutilisant `vite.config.ts` tel
// quel — seul `publicDir` change. Le poster inventé DOIT se retrouver dans le pré-cache. Aucune
// liste écrite avant ce test ne peut le deviner.
//
// ⚠️ Aucune écriture dans le dépôt, donc aucune course avec les autres fichiers de test qui buildent
// en parallèle. Modifier `app/public/` le temps d'un build aurait été plus court et faux.
// ═════════════════════════════════════════════════════════════════════════════

const GESTE_INVENTE = 'zzz-build-temoin'
const POSTER_INVENTE = `/catalog/gestes/${GESTE_INVENTE}/${GESTE_INVENTE}-unique.jpg`
const CLIP_INVENTE = `/catalog/gestes/${GESTE_INVENTE}/${GESTE_INVENTE}-unique.av1.mp4`

describe('lot gestes-hors-ligne — ce que le service worker émis fait vraiment', () => {
  const sortie = mkdtempSync(path.join(tmpdir(), 'nutri-sw-'))
  const publicTemoin = mkdtempSync(path.join(tmpdir(), 'nutri-public-'))
  const gestesTemoins = path.join(publicTemoin, 'catalog', 'gestes')
  let sw = ''
  let precache: string[] = []

  beforeAll(async () => {
    cpSync(PUBLIC_REEL, publicTemoin, { recursive: true })
    mkdirSync(path.join(gestesTemoins, GESTE_INVENTE), { recursive: true })
    writeFileSync(path.join(gestesTemoins, GESTE_INVENTE, `${GESTE_INVENTE}-unique.jpg`), 'POSTER-INVENTE')
    writeFileSync(path.join(gestesTemoins, GESTE_INVENTE, `${GESTE_INVENTE}-unique.av1.mp4`), 'CLIP-INVENTE')

    await build({
      ...configVite,
      root: path.join(REPO_ROOT, 'app'),
      publicDir: publicTemoin,
      logLevel: 'silent',
      build: { outDir: sortie, emptyOutDir: true },
    })

    sw = readFileSync(path.join(sortie, 'sw.js'), 'utf8')
    const bloc = /const A_PRECACHER = (\[[\s\S]*?\n\])/.exec(sw)
    expect(bloc?.[1], 'A_PRECACHER introuvable dans sw.js — le format du plugin a changé').toBeTypeOf('string')
    precache = JSON.parse(bloc?.[1] ?? '[]') as string[]
  }, 180_000)

  afterAll(() => {
    rmSync(sortie, { recursive: true, force: true })
    rmSync(publicTemoin, { recursive: true, force: true })
  })

  /** Le nom du cache versionné, lu dans le worker émis. */
  const cacheVersionne = (): string => {
    const bloc = /const CACHE = '([^']+)'/.exec(sw)
    expect(bloc?.[1], 'CACHE introuvable dans sw.js — le format du plugin a changé').toBeTypeOf('string')
    return bloc?.[1] ?? ''
  }

  it('produit bien un sw.js à lire — sinon tout ce qui suit passerait à vide', () => {
    expect(sw.length, 'sw.js est vide').toBeGreaterThan(200)
    expect(precache.length, 'le pré-cache est vide').toBeGreaterThan(100)
  })

  it('⛔ CRITÈRE 1 — les posters sont pré-cachés (dont un geste INVENTÉ), aucun clip ne l’est', () => {
    // ⛔ L'ASSERTION QUI TUE LA LISTE EN DUR DANS `generateBundle`. Ce geste n'existe pas au
    // catalogue et n'existait pas quand le code a été écrit : seul un balayage du `publicDir` peut
    // le trouver. Une liste des 6 URL réelles passe tout le reste et tombe ici.
    expect(
      precache,
      `le poster du geste inventé « ${GESTE_INVENTE} » est absent du pré-cache — ` +
        'la liste des posters est écrite à la main, pas balayée'
    ).toContain(POSTER_INVENTE)
    expect(precache, 'le clip du geste inventé est pré-caché — il devait rester à la demande').not.toContain(
      CLIP_INVENTE
    )

    // Compté sur le disque, jamais écrit en dur : le lot 2 peut importer d'autres gestes demain, et
    // un nombre gravé ici rendrait ce test faux sans que personne n'ait rien cassé.
    const surDisque = fichiersRecursifs(gestesTemoins)
    const posters = surDisque.filter((f) => f.endsWith('.jpg'))
    const clips = surDisque.filter((f) => f.endsWith('.mp4'))
    expect(posters.length, 'aucun poster sur le disque — le test passerait à vide').toBeGreaterThan(1)
    expect(clips.length, 'aucun clip sur le disque — le test passerait à vide').toBeGreaterThan(1)

    for (const p of posters) {
      const url = urlDuGeste(p, gestesTemoins)
      expect(precache, `le poster ${url} n’est pas pré-caché`).toContain(url)
    }
    for (const c of clips) {
      const url = urlDuGeste(c, gestesTemoins)
      expect(precache, `le clip ${url} est pré-caché — il devait rester à la demande`).not.toContain(url)
    }
  })

  it('⛔ CRITÈRE 2 — le pré-cache monte du nombre de posters, et PAS d’une entrée de plus', () => {
    // ⚠️ CE CRITÈRE EST CE QUI DISTINGUE « les posters sont dedans » DE « le dossier est dedans ».
    // Les deux satisfont le critère 1 si l'on ne compte pas.
    const posters = fichiersRecursifs(gestesTemoins).filter((f) => f.endsWith('.jpg'))
    const entreesGestes = precache.filter((u) => u.startsWith('/catalog/gestes/'))

    expect(
      entreesGestes.length,
      `le pré-cache porte ${entreesGestes.length} entrées de gestes pour ${posters.length} posters :\n` +
        entreesGestes.join('\n')
    ).toBe(posters.length)
  })

  it('⛔ CRITÈRE 7 — le worker EXÉCUTÉ ne garde QUE le clip, sur réponse saine, et sans détacher', async () => {
    // ⚠️ CE TEST NE LIT PLUS `sw.js`, IL LE FAIT TOURNER. La v1 cherchait le texte source de la
    // fonction et une regex `cache.put(` : une constante jamais appelée plus un `put` inconditionnel
    // la passaient au vert EN CACHANT TOUT. Ici le cache est vide, donc chaque requête atteint le
    // point de décision, et un `put` inconditionnel cache la photo et le bundle — rouge immédiat.
    const worker = chargerWorker(sw)

    const consultation = await worker.requeter(`${ORIGINE}${CLIP_INVENTE}`)
    expect(
      consultation.protegees.map((p) => p.url),
      'un clip consulté n’est pas conservé — §7.1 l.982 dit « puis conservé »'
    ).toEqual([`${ORIGINE}${CLIP_INVENTE}`])

    // ⛔ ET L'ÉCRITURE EST MAINTENUE EN VIE. Un `cache.put` détaché — ni attendu dans la chaîne
    // rendue à `respondWith`, ni confié à `event.waitUntil` — peut être tué par le navigateur dès la
    // réponse rendue. Les bouchons du cache résolvent sur macrotâche : une écriture protégée a fini
    // avant qu'on lâche la main, une écriture détachée n'apparaît qu'après.
    expect(
      consultation.tardives,
      'le cache.put du clip est DÉTACHÉ : ni attendu dans respondWith, ni confié à waitUntil — ' +
        'un vrai navigateur a le droit de le tuer avant qu’il aboutisse'
    ).toEqual([])

    // ⛔ ET C'EST UN CLONE QUI EST MIS EN CACHE, PAS LA RÉPONSE RENDUE À LA PAGE. Le corps d'une
    // réponse ne se lit qu'une fois : mettre l'original en cache le consomme, et la page reçoit une
    // vidéo vide. Rien ne le signalait tant que le faux `clone()` se rendait lui-même.
    expect(
      consultation.protegees[0]?.clone,
      'le clip a été mis en cache SANS `.clone()` — le corps consommé par le cache est celui que la ' +
        'page attend pour lire la vidéo'
    ).toBe(true)

    // ⛔ Tout le reste : AUCUN `cache.put`. C'est ce qui tue le `put` inconditionnel.
    const bundle = precache.find((u) => u.startsWith('/assets/')) ?? '/assets/inconnu.js'
    for (const url of [POSTER_INVENTE, '/catalog/catalog.db', bundle, '/index.html']) {
      const rien = await worker.requeter(`${ORIGINE}${url}`)
      expect(
        [...rien.protegees, ...rien.tardives],
        `« ${url} » a été mis en cache au runtime alors qu’il est déjà pré-caché`
      ).toEqual([])
    }

    // Une autre origine ne nous regarde pas — §6.6 dit qu'il ne doit pas y en avoir, l'intercepter
    // la masquerait au lieu de la révéler.
    const ailleurs = await worker.requeter(`https://ailleurs.test${CLIP_INVENTE}`)
    expect(
      [...ailleurs.protegees, ...ailleurs.tardives],
      'un clip d’une AUTRE origine a été mis en cache'
    ).toEqual([])

    // ⛔ Et une réponse d'erreur ne se conserve pas : la cacher gèlerait un 404 jusqu'à la prochaine
    // montée de version, hors ligne et sans recours.
    const erreur = await worker.requeter(`${ORIGINE}${CLIP_INVENTE}`, { statut: 404 })
    expect(
      [...erreur.protegees, ...erreur.tardives],
      'un 404 a été mis en cache — il resterait servi hors ligne indéfiniment'
    ).toEqual([])
  })

  it('⛔ CRITÈRE 9 — le cache des clips est NON VERSIONNÉ et survit à une montée de version', async () => {
    // ⚠️ TROU DE CONCEPTION, PAS DE MESURE — trouvé en attaquant le brief. `activate` supprime tout
    // cache dont le nom diffère du courant (`vite-plugin-sw.ts:146-155`). Un cache de clips séparé
    // est donc détruit à CHAQUE activation ; un cache versionné, à chaque montée de version.
    const worker = chargerWorker(sw)

    // Le nom du cache de conservation n'est PAS écrit ici : on le découvre en regardant où le worker
    // range le clip. Le codeur reste libre de le nommer, il n'est pas libre de le laisser purger.
    const consultation = await worker.requeter(`${ORIGINE}${CLIP_INVENTE}`)
    expect(consultation.protegees.length, 'aucun clip conservé — voir le critère 7').toBeGreaterThan(0)
    const cacheDesClips = consultation.protegees[0]?.cache ?? ''
    const cacheCourant = cacheVersionne()

    // ⛔ L'ASSERTION QUI EMPÊCHE LE CRITÈRE DE DÉGÉNÉRER. Ranger les clips dans `CACHE` lui-même
    // rendait le triplet ci-dessous vide de sens : `cacheDesClips === cacheCourant`, donc épargné
    // par construction, alors qu'à la montée de version suivante ce même cache devient l'ancien et
    // se fait purger comme n'importe quel périmé. Le cache de conservation doit être NON VERSIONNÉ.
    expect(
      cacheDesClips,
      `les clips sont rangés dans le cache VERSIONNÉ « ${cacheCourant} » — ils seront purgés à la ` +
        'prochaine montée de version, exactement le défaut que ce critère existe pour fermer'
    ).not.toBe(cacheCourant)

    // ⛔ ET LE NOM NE PORTE PAS LA VERSION DU TOUT. `not.toBe` seul laissait passer un
    // `nutrition-clips-<version>` : différent du cache courant sur CE build, donc vert — mais il
    // change à chaque montée de version, et le worker suivant purgerait l'ancien comme un inconnu.
    // Le test ne fait tourner qu'un seul build ; cette assertion est ce qui le rend inutile.
    const version = cacheCourant.replace(/^nutrition-/, '')
    expect(version.length, 'la version du cache est vide — le nom du cache courant a changé de forme').toBeGreaterThan(4)
    expect(
      cacheDesClips,
      `le nom du cache des clips « ${cacheDesClips} » contient la version « ${version} » : il ` +
        'changera au prochain build, et les clips conservés seront purgés comme un cache inconnu'
    ).not.toContain(version)

    const perime = 'nutrition-000000000000'
    const supprimes = await worker.activer([perime, cacheCourant, cacheDesClips])

    expect(supprimes, `le cache périmé « ${perime} » n’a pas été purgé`).toContain(perime)
    expect(
      supprimes,
      `le cache des clips « ${cacheDesClips} » a été détruit à l’activation — la conservation ne conserve rien`
    ).not.toContain(cacheDesClips)
    expect(supprimes, `le cache courant « ${cacheCourant} » a été détruit`).not.toContain(cacheCourant)
  })

  it('CRITÈRE 8 — les photos de recettes restent toutes pré-cachées', () => {
    // Le lot AJOUTE un balayage, il n'en remplace aucun. Réutiliser `imagesPubliques` pour les
    // gestes en cassant les photos serait vert sur les critères 1 à 7.
    const dossier = path.join(publicTemoin, 'catalog', 'images')
    const photos = readdirSync(dossier).filter((n) => /\.(avif|webp|jpe?g|png)$/i.test(n))
    expect(photos.length, 'aucune photo sur le disque — le test passerait à vide').toBeGreaterThan(0)

    for (const nom of photos) {
      expect(precache, `la photo /catalog/images/${nom} a disparu du pré-cache`).toContain(
        `/catalog/images/${nom}`
      )
    }
  })
})
