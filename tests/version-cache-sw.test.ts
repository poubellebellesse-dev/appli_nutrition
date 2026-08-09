// tests/version-cache-sw.test.ts
//
// ⚠️ RÉGRESSION D'UN BUG RÉEL, trouvé le 2026-07-30 en relisant le code. La première version du
// plugin hachait la LISTE DES NOMS de fichiers pour en tirer la version du cache, en supposant que
// Vite y encode déjà le contenu. C'est vrai des bundles JS et CSS ; c'est FAUX de tout ce qui vit
// dans `public/` — `catalog.db`, les polices, les icônes, le manifest ont des noms FIXES.
//
// Conséquence : modifier le catalogue sans toucher au code laissait la version inchangée, donc le
// service worker servait l'ancien `catalog.db` INDÉFINIMENT. Une mise à jour de contenu n'atteignait
// jamais un utilisateur ayant installé l'application — alors que §7.1 ARCHITECTURE décrit les
// données comme un canal de mise à jour à part entière.
//
// Le défaut était invisible en développement (pas de service worker) et pendant tout build où le
// code change aussi. Il n'apparaissait qu'après un `npm run build` de catalogue seul — c'est-à-dire
// exactement le cas d'usage « on ajoute des recettes ».

import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { imagesPubliques, versionDuCache, type EntreePrecache } from '../vite-plugin-sw.js'

const BUNDLE: readonly EntreePrecache[] = [
  { url: '/index.html', empreinte: 'aaaa1111' },
  { url: '/assets/index-ABC123.js', empreinte: 'assets/index-ABC123.js' },
  { url: '/assets/index-DEF456.css', empreinte: 'assets/index-DEF456.css' },
]

const CATALOGUE = (empreinte: string): EntreePrecache => ({ url: '/catalog/catalog.db', empreinte })

describe('service worker — version du cache', () => {
  it('CHANGE quand le catalogue change, à noms de fichiers IDENTIQUES', () => {
    // LE cas du bug : `npm run build` ajoute des recettes, aucun fichier ne change de nom.
    const avant = versionDuCache([...BUNDLE, CATALOGUE('catalogue-v1')])
    const apres = versionDuCache([...BUNDLE, CATALOGUE('catalogue-v2')])
    expect(apres).not.toBe(avant)
  })

  it('change aussi quand une police ou une icône change de contenu', () => {
    // Même piège, mêmes fichiers à noms fixes.
    const base: readonly EntreePrecache[] = [...BUNDLE, CATALOGUE('c1')]
    const avant = versionDuCache([...base, { url: '/fonts/newsreader-latin.woff2', empreinte: 'f1' }])
    const apres = versionDuCache([...base, { url: '/fonts/newsreader-latin.woff2', empreinte: 'f2' }])
    expect(apres).not.toBe(avant)
  })

  it('NE change PAS entre deux builds identiques', () => {
    // Une version qui bouge sans raison ferait re-télécharger 1,5 Mo à chaque déploiement — c'est
    // pour ça qu'on ne se contente pas d'un horodatage.
    const entrees = [...BUNDLE, CATALOGUE('c1')]
    expect(versionDuCache(entrees)).toBe(versionDuCache([...entrees]))
  })

  it('ne dépend pas de l’ORDRE des entrées', () => {
    // L'ordre d'itération du bundle Rollup n'est pas garanti stable entre deux versions de l'outil ;
    // s'y fier ferait changer la version sans qu'aucun contenu n'ait bougé.
    const entrees = [...BUNDLE, CATALOGUE('c1')]
    expect(versionDuCache([...entrees].reverse())).toBe(versionDuCache(entrees))
  })

  it('change quand un bundle change de nom haché', () => {
    // Le cas que l'ancienne version couvrait déjà, et qui doit continuer de marcher.
    const avant = versionDuCache([...BUNDLE, CATALOGUE('c1')])
    const apres = versionDuCache([
      { url: '/index.html', empreinte: 'aaaa1111' },
      { url: '/assets/index-ZZZ999.js', empreinte: 'assets/index-ZZZ999.js' },
      { url: '/assets/index-DEF456.css', empreinte: 'assets/index-DEF456.css' },
      CATALOGUE('c1'),
    ])
    expect(apres).not.toBe(avant)
  })

  it('distingue deux fichiers qui échangeraient leur contenu', () => {
    // L'empreinte est liée à SON url : concaténer les empreintes sans les nommer rendrait ces deux
    // états identiques.
    const a = versionDuCache([{ url: '/a', empreinte: '1' }, { url: '/b', empreinte: '2' }])
    const b = versionDuCache([{ url: '/a', empreinte: '2' }, { url: '/b', empreinte: '1' }])
    expect(a).not.toBe(b)
  })
})

// Les photos de recettes sont découvertes, pas listées : elles sont 88 aujourd'hui et 308 à terme,
// et une liste écrite à la main serait périmée au build suivant — exactement le défaut que
// l'en-tête de `vite-plugin-sw.ts` interdit, avec le même échec silencieux à la clé.
describe('service worker — les photos de recettes', () => {
  function bacTemporaire(fichiers: readonly string[]): string {
    const racine = mkdtempSync(path.join(tmpdir(), 'sw-images-'))
    mkdirSync(path.join(racine, 'catalog', 'images'), { recursive: true })
    for (const nom of fichiers) writeFileSync(path.join(racine, 'catalog', 'images', nom), nom)
    return racine
  }

  it('rend une URL par photo, préfixée comme elle sera servie', () => {
    const racine = bacTemporaire(['ratatouille.avif', 'taboule.avif'])
    try {
      expect(imagesPubliques(racine)).toEqual(['/catalog/images/ratatouille.avif', '/catalog/images/taboule.avif'])
    } finally {
      rmSync(racine, { recursive: true, force: true })
    }
  })

  it('ignore ce qui n’est pas une image', () => {
    // Sous Windows, l'explorateur dépose des `Thumbs.db` dans les dossiers d'images. Pré-cacher un
    // fichier pareil, c'est embarquer un artefact du poste de travail dans l'application.
    const racine = bacTemporaire(['ratatouille.avif', 'Thumbs.db', 'notes.txt', '.gitkeep'])
    try {
      expect(imagesPubliques(racine)).toEqual(['/catalog/images/ratatouille.avif'])
    } finally {
      rmSync(racine, { recursive: true, force: true })
    }
  })

  it('rend un ORDRE STABLE — sinon la version du cache bougerait sans qu’une photo ait changé', () => {
    // Même exigence que « NE change PAS entre deux builds identiques » plus haut : l'ordre de
    // `readdir` n'est pas garanti d'un système de fichiers à l'autre.
    const racine = bacTemporaire(['zeste.avif', 'ail.avif', 'mangue.avif'])
    try {
      expect(imagesPubliques(racine)).toEqual([
        '/catalog/images/ail.avif',
        '/catalog/images/mangue.avif',
        '/catalog/images/zeste.avif',
      ])
    } finally {
      rmSync(racine, { recursive: true, force: true })
    }
  })

  it('rend une liste vide quand aucune photo n’a été importée, sans faire échouer le build', () => {
    // Un clone frais peut ne pas avoir le dossier. Même choix qu'`empreinteDeFichier` : ne pas lever.
    const racine = mkdtempSync(path.join(tmpdir(), 'sw-vide-'))
    try {
      expect(imagesPubliques(racine)).toEqual([])
    } finally {
      rmSync(racine, { recursive: true, force: true })
    }
  })

  it('une photo qui change de contenu change la version du cache', () => {
    // C'est la raison d'être du pré-cache par empreinte : un lot de photos rejoué doit atteindre
    // un utilisateur qui a déjà installé l'application.
    const base: readonly EntreePrecache[] = [...BUNDLE, CATALOGUE('c1')]
    const avant = versionDuCache([...base, { url: '/catalog/images/ratatouille.avif', empreinte: 'p1' }])
    const apres = versionDuCache([...base, { url: '/catalog/images/ratatouille.avif', empreinte: 'p2' }])
    expect(apres).not.toBe(avant)
  })
})
