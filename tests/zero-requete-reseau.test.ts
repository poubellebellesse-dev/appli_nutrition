// tests/zero-requete-reseau.test.ts
//
// §6.6 ARCHITECTURE : « Zéro requête réseau après le chargement initial — vérifiable par test
// automatisé ». C'est ce test-là. Critère de sortie de P7.
//
// ⚠️ CE QU'IL PROUVE, ET CE QU'IL NE PROUVE PAS. Il scanne le BUNDLE PRODUIT ; ce n'est donc pas une
// preuve d'exécution — seul un navigateur instrumenté la donnerait, et Vitest tourne sans DOM. C'est
// en revanche exactement ce qui aurait arrêté le lien Google Fonts des maquettes, c'est-à-dire la
// façon RÉELLE dont cette promesse se casse : quelqu'un colle une balise `<link>` ou un `import`
// depuis un CDN, tout marche parfaitement sur sa machine connectée, et l'application est muette
// hors ligne.
//
// ⚠️ DEUX NIVEAUX, PARCE QU'UNE URL N'EST PAS UNE REQUÊTE. Une première version refusait TOUTE URL
// absolue et échouait sur ~40 liens de documentation figurant dans les messages d'erreur de React
// et de sqlite-wasm (« react.dev/link/… »). Les tolérer un par un aurait transformé le test en
// liste d'exceptions à rallonge, donc en test qui ne teste plus rien. D'où :
//
//   1. Sur LES FICHIERS QU'ON ÉCRIT (index.html, CSS, manifest, sw.js) : aucune URL absolue, point.
//      C'est là que le lien Google Fonts serait apparu.
//   2. Sur TOUT le reste, dépendances comprises : aucune URL en POSITION DE REQUÊTE — précédée de
//      `href=`, `src=`, `url(`, `fetch(`, `import(`, `new URL(`, `new Worker(`, `importScripts(`.
//      Une URL citée dans un message d'erreur ne déclenche rien ; une URL derrière `fetch(` si.
//
// Le niveau 2 ne verrait pas une URL construite dynamiquement (`fetch(base + chemin)`). C'est une
// limite assumée : le risque réel est le copier-coller d'un CDN, pas l'exfiltration déguisée.
//
// Le test construit lui-même le bundle dans un dossier temporaire : vérifier un `dist/` traînant
// dans le dépôt reviendrait à valider une version qui n'est plus celle des sources.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..')

/** Fichiers qui partent réellement au navigateur. Le `.wasm` est binaire, inutile de le scanner. */
const EXTENSIONS_SCANNEES = new Set(['.html', '.js', '.mjs', '.css', '.webmanifest', '.json'])

/**
 * Espaces de noms XML, seule URL absolue légitime dans nos propres fichiers : `xmlns` identifie une
 * grammaire, il n'est jamais déréférencé.
 */
const NAMESPACES = /^https?:\/\/www\.w3\.org\//

const URL_ABSOLUE = /https?:\/\/[^\s"'`)\\<>]+/g

/**
 * Constructions qui déclenchent VRAIMENT une requête. Cherchées juste avant l'URL — on remonte de
 * quelques caractères pour couvrir le guillemet ouvrant et d'éventuels espaces.
 */
const POSITION_DE_REQUETE = /(href\s*=|src\s*=|url\(|fetch\(|import\(|importScripts\(|new URL\(|new Worker\(|@import)\s*["'`]?\s*$/

interface Trouvaille {
  readonly fichier: string
  readonly url: string
  readonly contexte: string
}

function fichiersDu(dossier: string): string[] {
  const trouves: string[] = []
  for (const entree of readdirSync(dossier)) {
    const complet = path.join(dossier, entree)
    if (statSync(complet).isDirectory()) trouves.push(...fichiersDu(complet))
    else if (EXTENSIONS_SCANNEES.has(path.extname(complet))) trouves.push(complet)
  }
  return trouves
}

/** Chaque URL absolue du fichier, avec les 40 caractères qui la précèdent. */
function urlsAvecContexte(contenu: string): { url: string; avant: string }[] {
  const trouvees: { url: string; avant: string }[] = []
  for (const occurrence of contenu.matchAll(URL_ABSOLUE)) {
    const debut = occurrence.index ?? 0
    trouvees.push({ url: occurrence[0], avant: contenu.slice(Math.max(0, debut - 40), debut) })
  }
  return trouvees
}

describe('§6.6 — aucune requête réseau après chargement', () => {
  const sortie = mkdtempSync(path.join(tmpdir(), 'nutri-bundle-'))
  let fichiers: string[] = []
  const dansNosFichiers: Trouvaille[] = []
  const enPositionDeRequete: Trouvaille[] = []

  beforeAll(() => {
    const build = spawnSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['vite', 'build', '--outDir', sortie, '--emptyOutDir'],
      { cwd: REPO_ROOT, encoding: 'utf8', shell: process.platform === 'win32' }
    )
    expect(build.status, `le build a échoué :\n${build.stderr}`).toBe(0)

    fichiers = fichiersDu(sortie)
    for (const fichier of fichiers) {
      const relatif = path.relative(sortie, fichier).split(path.sep).join('/')
      // « Nos » fichiers : tout ce qui n'est pas un morceau de dépendance émis dans assets/.
      // index.html, la CSS compilée, le manifest et sw.js en font partie ; `assets/index-*.js`
      // contient notre code MAIS aussi React, dont les messages d'erreur citent react.dev.
      const estANous = !relatif.startsWith('assets/') || relatif.endsWith('.css')

      for (const { url, avant } of urlsAvecContexte(readFileSync(fichier, 'utf8'))) {
        if (NAMESPACES.test(url)) continue
        const trouvaille: Trouvaille = { fichier: relatif, url, contexte: avant.slice(-24) }
        if (estANous) dansNosFichiers.push(trouvaille)
        if (POSITION_DE_REQUETE.test(avant)) enPositionDeRequete.push(trouvaille)
      }
    }
  }, 180_000)

  afterAll(() => {
    rmSync(sortie, { recursive: true, force: true })
  })

  it('produit bien un bundle à scanner — sinon le test passerait à vide', () => {
    // Une erreur de chemin rendrait la liste vide, et un test qui ne scanne rien est toujours vert.
    expect(fichiers.length).toBeGreaterThan(3)
    expect(fichiers.some((f) => f.endsWith('index.html'))).toBe(true)
    expect(fichiers.some((f) => f.endsWith('sw.js'))).toBe(true)
  })

  it("nos fichiers ne citent AUCUNE origine externe — le cas du lien Google Fonts", () => {
    const message = dansNosFichiers.map((t) => `  ${t.fichier} → ${t.url}`).join('\n')
    expect(dansNosFichiers, `URL externes dans nos fichiers :\n${message}`).toEqual([])
  })

  it('aucune URL du bundle n’est en position de requête, dépendances comprises', () => {
    const message = enPositionDeRequete
      .map((t) => `  ${t.fichier} → …${t.contexte}${t.url}`)
      .join('\n')
    expect(enPositionDeRequete, `requêtes réseau trouvées :\n${message}`).toEqual([])
  })

  it('embarque les polices et le catalogue, au lieu d’aller les chercher', () => {
    const sw = readFileSync(path.join(sortie, 'sw.js'), 'utf8')
    for (const attendu of [
      '/fonts/newsreader-latin.woff2',
      '/fonts/instrument-sans-latin.woff2',
      '/catalog/catalog.db',
    ]) {
      expect(sw, `${attendu} devrait être pré-caché`).toContain(attendu)
    }
  })

  it('pré-cache les fichiers RÉELLEMENT émis, noms hachés compris', () => {
    // Le piège que le plugin évite : une liste écrite à la main serait périmée au build suivant, et
    // l'échec serait silencieux — le service worker s'installerait sans erreur sur des fichiers
    // inexistants, et l'application serait cassée hors ligne sans l'avoir jamais été en ligne.
    const sw = readFileSync(path.join(sortie, 'sw.js'), 'utf8')
    const emis = fichiersDu(path.join(sortie, 'assets')).map((f) => path.basename(f))
    for (const nom of emis.filter((n) => n.endsWith('.js') || n.endsWith('.css'))) {
      expect(sw, `${nom} absent du pré-cache`).toContain(nom)
    }
  })
})


// ------------------------------------------------------------------------------------------
// Le détecteur lui-même, éprouvé sur des extraits SYNTHÉTIQUES — jamais en cassant le dépôt.
//
// ⚠️ POURQUOI CE SECOND VOLET. Un scan qui ne trouve rien est vert, qu'il fonctionne ou non. Le
// premier volet ne prouve donc QUE l'absence de trouvaille ; celui-ci prouve qu'une trouvaille
// serait vue. C'est la leçon déjà payée sur le lexique : « un test qui vérifie une liste écrite à
// la main ne vérifie que lui-même ».
// ------------------------------------------------------------------------------------------

/** Rejoue la détection du premier volet sur une chaîne, sans toucher au système de fichiers. */
function detecterRequetes(contenu: string): string[] {
  return urlsAvecContexte(contenu)
    .filter(({ url, avant }) => !NAMESPACES.test(url) && POSITION_DE_REQUETE.test(avant))
    .map(({ url }) => url)
}

describe('§6.6 — le détecteur repère bien ce qu’il doit repérer', () => {
  it('voit le lien Google Fonts des maquettes, dans toutes ses formes', () => {
    // Les trois façons dont il serait réellement réintroduit.
    expect(
      detecterRequetes('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader" />')
    ).toHaveLength(1)
    expect(detecterRequetes("@import url('https://fonts.googleapis.com/css2?family=X');")).toHaveLength(1)
    expect(detecterRequetes('src: url(https://fonts.gstatic.com/s/newsreader/v26/abc.woff2)')).toHaveLength(1)
  })

  it('voit un script de CDN et un chargement dynamique', () => {
    expect(detecterRequetes('<script src="https://cdn.example.net/analytics.js"></script>')).toHaveLength(1)
    expect(detecterRequetes('await fetch("https://api.example.net/v1/track")')).toHaveLength(1)
    expect(detecterRequetes('const w = new Worker("https://cdn.example.net/w.js")')).toHaveLength(1)
    expect(detecterRequetes('importScripts("https://cdn.example.net/lib.js")')).toHaveLength(1)
  })

  it('LAISSE PASSER une URL de documentation — sinon le test deviendrait ingérable', () => {
    // ~40 liens de ce genre vivent dans les messages d'erreur de React et de sqlite-wasm. Les
    // signaler obligerait à tenir une liste d'exceptions, et une liste d'exceptions finit par tout
    // excepter.
    expect(detecterRequetes('throw Error("voir https://react.dev/link/invalid-hook-call")')).toEqual([])
    expect(detecterRequetes('// voir https://developer.chrome.com/blog/sync-methods/')).toEqual([])
  })

  it('laisse passer les espaces de noms XML, qui ne sont jamais déréférencés', () => {
    expect(detecterRequetes('<svg xmlns="http://www.w3.org/2000/svg">')).toEqual([])
  })

  it('ne se laisse pas berner par une URL relative', () => {
    // Le cas NORMAL de l'application : tout est servi depuis la même origine.
    expect(detecterRequetes('<link rel="manifest" href="/manifest.webmanifest" />')).toEqual([])
    expect(detecterRequetes("fetch('/catalog/catalog.db')")).toEqual([])
  })
})
