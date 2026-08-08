// catalog/preparer-mesure-61.mjs — prépare et sert les TROIS points de la décision 61 (`ETAT.md` §4).
//
// `npm run mesure:61` construit trois bundles de production (305 / 500 / 1 000 recettes) puis les
// sert simultanément sur trois ports. Il n'y a alors plus rien à lancer : trois URL à ouvrir sur le
// téléphone, trois nombres à relever, dans le même passage.
//
// ⛔ POURQUOI TROIS PORTS ET NON TROIS RECONSTRUCTIONS SUCCESSIVES — C'EST LA RAISON D'ÊTRE DE CE
// FICHIER, ET LE PIÈGE QU'IL SUPPRIME.
// Le service worker ne fait JAMAIS `skipWaiting()` (`vite-plugin-sw.ts`, choix délibéré expliqué
// dans `ui/sw-register.ts`), et `main.tsx` l'enregistre SANS rappel de mise à jour. Un service
// worker fraîchement installé reste donc en `waiting` tant qu'un client de l'ancien est vivant — et
// **recharger l'onglet ne suffit pas à le remplacer**. Reconstruire le bundle avec un catalogue
// gonflé puis recharger la page du téléphone aurait donc resservi l'ANCIEN `catalog.db` depuis
// l'ANCIEN cache : trois relevés à 305 cartes, une pente parfaitement plate, et la lecture naturelle
// « aucune croissance, donc piste (c) » — un faux positif sur la décision qui existe précisément
// pour ne pas se relire après coup.
//
// Trois ports = trois ORIGINES = trois enregistrements de service worker étanches. Le problème
// n'est pas contourné par une consigne qu'on peut oublier, il est structurellement absent.
//
// ⚠️ LA VÉRIFICATION RESTE DUE, ET ELLE EST GRATUITE : l'encadré affiche `montage N ms · M cartes`.
// **Si M ne vaut pas le nombre annoncé par l'URL, le relevé ne compte pas.** C'est la seule preuve
// que le catalogue servi est bien celui qu'on croit mesurer.
//
// ⚠️ LE CATALOGUE GONFLÉ EST MENSONGER SUR TOUT SAUF LE NOMBRE DE CARTES (clones à 100 % de
// similarité — voir `gonfler-pour-mesure.mjs`). Ne prendre AUCUNE autre mesure sur les ports 4174
// et 4175.
//
// ⛔ LES BUNDLES VONT DANS `dist-mesure/`, SURTOUT PAS DANS `dist/`. `vite.config.ts` pose
// `emptyOutDir: true` sur `../dist` : un `npx vite build` — l'une des quatre commandes qui font foi —
// effacerait les trois bundles SOUS les serveurs en cours, qui continueraient d'écouter en rendant
// des 404. `dist-mesure/` est gitignoré comme `dist/`.
//
// Usage :
//   npm run mesure:61              construit les trois bundles, puis sert
//   npm run mesure:61 -- --servir  sert seulement (bundles déjà construits)
//   npm run mesure:61 -- --batir   construit seulement

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.join(__dirname, '..')
const DB = path.join(RACINE, 'app', 'public', 'catalog', 'catalog.db')
const SAUVEGARDE = `${DB}.vrai`

/** Les trois points. `outDir` est relatif à `app/` — c'est la racine Vite (`vite.config.ts`). */
const POINTS = [
  { recettes: null, dossier: 'm305', port: 4173, libelle: 'le VRAI catalogue' },
  { recettes: 500, dossier: 'm500', port: 4174, libelle: 'gonflé' },
  { recettes: 1000, dossier: 'm1000', port: 4175, libelle: 'gonflé' },
]

function lancer(commande, etape) {
  const r = spawnSync(commande, { cwd: RACINE, shell: true, stdio: 'inherit' })
  if (r.status !== 0) throw new Error(`${etape} a échoué (code ${r.status}) : ${commande}`)
}

function compterRecettes() {
  const db = new DatabaseSync(DB)
  const n = db.prepare('SELECT COUNT(*) n FROM recipe').get().n
  db.close()
  return n
}

function batir() {
  // ⚠️ GARDE-FOU : une sauvegarde présente au départ signifie qu'un passage précédent s'est
  // interrompu et que `catalog.db` est DÉJÀ gonflé. Bâtir par-dessus produirait un « point à 305 »
  // qui n'en est pas un, sans que rien ne le dise.
  if (existsSync(SAUVEGARDE)) {
    throw new Error(
      `${path.basename(SAUVEGARDE)} existe déjà : le catalogue est probablement gonflé.\n` +
        `Restaurez-le d'abord : npm run catalog:gonfler -- --restaurer`
    )
  }
  if (!existsSync(DB)) throw new Error(`${DB} est absent — lancez \`npm run build\` d'abord.`)

  const reel = compterRecettes()
  console.log(`\nCatalogue réel : ${reel} recettes. Construction des trois bundles…\n`)

  try {
    for (const point of POINTS) {
      if (point.recettes !== null) {
        lancer(`node catalog/gonfler-pour-mesure.mjs ${point.recettes}`, 'Le gonflage')
      }
      const n = compterRecettes()
      // Le dossier est vidé par `emptyOutDir: true` (vite.config.ts) ; on le retire quand même
      // d'abord, pour qu'un bundle avorté ne laisse pas d'assets d'un point précédent.
      rmSync(path.join(RACINE, 'dist-mesure', point.dossier), { recursive: true, force: true })
      console.log(`\n▶ bundle ${point.dossier} — ${n} recettes (${point.libelle})`)
      lancer(`npx vite build --outDir ../dist-mesure/${point.dossier}`, `Le build ${point.dossier}`)
      point.reel = n
    }
  } finally {
    // ⛔ LA RESTAURATION EST DANS UN `finally` : un build qui échoue au milieu laisserait sinon un
    // faux catalogue de 1 000 recettes en place, et le prochain `npm test` mesurerait dessus.
    if (existsSync(SAUVEGARDE)) {
      lancer('node catalog/gonfler-pour-mesure.mjs --restaurer', 'La restauration')
    }
  }
  console.log(`\nTrois bundles construits. Catalogue restauré à ${compterRecettes()} recettes.`)
}

function servir() {
  const manquants = POINTS.filter((p) => !existsSync(path.join(RACINE, 'dist-mesure', p.dossier)))
  if (manquants.length > 0) {
    throw new Error(
      `Bundles manquants : ${manquants.map((p) => p.dossier).join(', ')}. Lancez \`npm run mesure:61\` sans --servir.`
    )
  }

  const enfants = POINTS.map((p) =>
    spawn(
      // `--strictPort` : sans lui, un port occupé fait glisser Vite sur le suivant SANS le dire, et
      // l'on relèverait 500 recettes en croyant en relever 305.
      `npx vite preview --outDir ../dist-mesure/${p.dossier} --port ${p.port} --strictPort --host`,
      { cwd: RACINE, shell: true, stdio: ['ignore', 'ignore', 'inherit'] }
    )
  )

  console.log(`
────────────────────────────────────────────────────────────────────
  RELEVÉ 1 DE LA DÉCISION 61 — trois URL, rien d'autre à lancer.

  Sur le téléphone, même réseau (ou \`adb reverse tcp:PORT tcp:PORT\`
  pour chaque port si vous préférez localhost) :

    http://<ip-du-pc>:4173/?perf#/recettes     ← 305 recettes (VRAI)
    http://<ip-du-pc>:4174/?perf#/recettes     ← 500 recettes
    http://<ip-du-pc>:4175/?perf#/recettes     ← 1 000 recettes

  ⛔ Le \`?perf\` va AVANT le \`#\`. \`#/recettes?perf\` retombe
     silencieusement sur « Aujourd'hui » (résolution par égalité exacte).

  ⚠️ L'encadré dit « montage N ms · M cartes ». SI M NE CORRESPOND PAS
     AU PORT, LE RELEVÉ NE COMPTE PAS.

  ⚠️ \`adb\` n'est PAS nécessaire ici : le rendu ne demande pas de
     contexte sécurisé. Il l'est pour les relevés 2 et 3 (wakeLock, OPFS).

  Le seuil est écrit d'avance — docs/RETOUR_ESSAI_TELEPHONE.md §0.
  Ctrl-C pour tout arrêter.
────────────────────────────────────────────────────────────────────
`)

  const arreter = () => {
    for (const e of enfants) e.kill()
    process.exit(0)
  }
  process.on('SIGINT', arreter)
  process.on('SIGTERM', arreter)
}

const args = process.argv.slice(2)
try {
  if (!args.includes('--servir')) batir()
  if (!args.includes('--batir')) servir()
} catch (e) {
  console.error(`\n${e.message}\n`)
  process.exitCode = 1
}
