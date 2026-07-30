// vite-plugin-sw.ts — génère le service worker à partir des fichiers RÉELLEMENT émis par le build.
//
// ⚠️ POURQUOI GÉNÉRER PLUTÔT QU'ÉCRIRE `sw.js` À LA MAIN. Vite hache les noms de fichiers
// (`index-CYybvc8y.js`) et les change à chaque modification du contenu. Une liste de pré-cache
// écrite à la main serait périmée au build suivant — et l'échec serait SILENCIEUX : le service
// worker s'installerait sans erreur, mettrait en cache des fichiers inexistants, et l'application
// serait cassée hors ligne sans que rien ne l'ait signalé en ligne.
//
// ⚠️ POURQUOI PAS `vite-plugin-pwa` / WORKBOX. Workbox existe surtout pour les stratégies de cache
// RÉSEAU — revalidation, expiration, réponses partielles. Notre cible est l'inverse exact : §6.6
// ARCHITECTURE exige ZÉRO requête réseau après le chargement initial. Il ne reste donc qu'un
// pré-cache et une invalidation par version, soit la trentaine de lignes ci-dessous, contre une
// dépendance qui en entraîne beaucoup d'autres.
//
// ⚠️ LA VERSION DU CACHE EST UN HACHÉ DU CONTENU, pas une date ni un numéro à incrémenter. Un
// horodatage produirait un cache neuf à chaque build même sans changement (et re-téléchargerait
// 1,5 Mo pour rien) ; un numéro manuel serait oublié un jour, et l'ancien cache resterait servi.

import { createHash } from 'node:crypto'
import type { Plugin } from 'vite'

/** Fichiers à pré-cacher qui ne passent PAS par le graphe de modules (dossier `public/`). */
const ASSETS_STATIQUES: readonly string[] = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/catalog/catalog.db',
  '/fonts/instrument-sans-latin.woff2',
  '/fonts/newsreader-latin.woff2',
  '/icons/icone-192.png',
  '/icons/icone-512.png',
  '/icons/icone-maskable-512.png',
  '/icons/apple-touch-icon.png',
]

function corpsDuServiceWorker(version: string, aPrecacher: readonly string[]): string {
  return `// GÉNÉRÉ PAR vite-plugin-sw.ts — NE PAS MODIFIER À LA MAIN.
// Toute retouche sera écrasée au prochain \`vite build\`. La source est vite-plugin-sw.ts.

const CACHE = 'nutrition-${version}'
const A_PRECACHER = ${JSON.stringify(aPrecacher, null, 2)}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(A_PRECACHER)))
})

self.addEventListener('activate', (event) => {
  // Purge des caches des versions précédentes. Sans elle, le stockage grossit à chaque release —
  // et sur un appareil sous pression, c'est user.db que le navigateur évincera.
  event.waitUntil(
    caches
      .keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const requete = event.request
  if (requete.method !== 'GET') return

  const url = new URL(requete.url)
  // Une requête vers une autre origine n'est pas de notre ressort : §6.6 dit qu'il ne doit pas y en
  // avoir, mais l'intercepter pour la resservir depuis le cache la MASQUERAIT au lieu de la révéler.
  if (url.origin !== self.location.origin) return

  // Navigation : on rend toujours la coquille. C'est ce qui fait qu'un rechargement sur #/semaine
  // fonctionne hors ligne — le routage est côté client.
  if (requete.mode === 'navigate') {
    event.respondWith(caches.match('/index.html').then((r) => r ?? fetch(requete)))
    return
  }

  // CACHE D'ABORD, sans revalidation : les noms de fichiers sont hachés, un contenu modifié a un
  // nom différent. Aller au réseau « au cas où » ne pourrait donc rien apporter, et casserait la
  // promesse de zéro requête.
  event.respondWith(caches.match(requete).then((r) => r ?? fetch(requete)))
})
`
}

export function serviceWorkerPlugin(): Plugin {
  return {
    name: 'nutrition-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const emis = Object.keys(bundle)
        .filter((nom) => nom !== 'index.html')
        .map((nom) => `/${nom}`)

      const aPrecacher = [...ASSETS_STATIQUES, ...emis].sort()

      // Le haché porte sur la LISTE des fichiers, dont les noms contiennent déjà le haché de leur
      // propre contenu : deux builds identiques donnent donc le même cache, et le moindre
      // changement d'un fichier en donne un nouveau.
      const version = createHash('sha256').update(aPrecacher.join('\n')).digest('hex').slice(0, 12)

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: corpsDuServiceWorker(version, aPrecacher),
      })
    },
  }
}
