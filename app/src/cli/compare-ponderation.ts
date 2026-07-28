// app/src/cli/compare-ponderation.ts — banc de comparaison des PONDÉRATIONS de la similarité.
//
// Expérience, pas code de production. Le signal « ingrédients » a été corrigé et mesuré
// (§6.6 bis) ; ce banc s'attaque au facteur limitant suivant, la répartition 50/30/20 entre
// ingrédients, profil sensoriel et famille de cuisine — une intuition de la spécification
// d'origine, jamais validée.
//
// Trois jeux de paires, tous issus de l'inspection du catalogue RÉEL :
//   PATHOLOGIQUES — des plats sans rapport que la pondération actuelle rapproche. À faire BAISSER.
//   TÉMOINS       — des quasi-doublons évidents. À garder HAUTS.
//   FAUX NÉGATIFS — des plats bâtis sur le même aliment que l'actuelle sépare (chaud vs froid).
//                   À faire REMONTER. Ce jeu est le seul qui empêche de conclure « moins de
//                   sensoriel = toujours mieux » : il pénalise les pondérations trop brutales.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from '../data/catalog-loader-node.js'
import { attachDerivedIndexes } from '../engine/nutrition/index.js'
import { signatureOverlap } from '../engine/nutrition/signature.js'
import { buildSimilarityProfiles } from '../engine/selection/index.js'
import type { RecipeId, SensoryAxes } from '../engine/domain/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const catalog = attachDerivedIndexes(
  loadCatalog(path.join(__dirname, '..', '..', 'public', 'catalog', 'catalog.db'))
)
const profiles = buildSimilarityProfiles(catalog)
const ids = [...profiles.keys()]

const NUMERIC_AXES = ['sucreSale', 'legerConsistant', 'chaudFroid'] as const
const MAX_DIST = 2 * Math.sqrt(NUMERIC_AXES.length)

function sensorySim(a: SensoryAxes, b: SensoryAxes): number {
  let sq = 0
  for (const axis of NUMERIC_AXES) sq += (a[axis] - b[axis]) ** 2
  const euclid = Math.max(0, Math.min(1, 1 - Math.sqrt(sq) / MAX_DIST))
  return Math.max(0, Math.min(1, (euclid + (a.texture === b.texture ? 1 : 0)) / 2))
}

interface Weights { readonly name: string; readonly ingr: number; readonly sens: number; readonly cuis: number }

const WEIGHTS: Weights[] = [
  { name: 'P0 50/30/20 actuel', ingr: 0.5, sens: 0.3, cuis: 0.2 },
  { name: 'P1 60/25/15', ingr: 0.6, sens: 0.25, cuis: 0.15 },
  { name: 'P2 70/20/10', ingr: 0.7, sens: 0.2, cuis: 0.1 },
  { name: 'P3 80/15/05', ingr: 0.8, sens: 0.15, cuis: 0.05 },
  { name: 'P4 70/30/00', ingr: 0.7, sens: 0.3, cuis: 0 },
  { name: 'P5 85/15/00', ingr: 0.85, sens: 0.15, cuis: 0 },
  { name: 'P6 100/00/00', ingr: 1, sens: 0, cuis: 0 },
]

function sim(w: Weights, a: RecipeId, b: RecipeId): number {
  const pa = profiles.get(a)!
  const pb = profiles.get(b)!
  const ingr = signatureOverlap(pa.signature, pb.signature)
  const cuis = pa.cuisines.length === 0 || pb.cuisines.length === 0 ? 0 : pa.cuisines.some((c) => pb.cuisines.includes(c)) ? 1 : 0
  return Math.max(0, Math.min(1, w.ingr * ingr + w.sens * sensorySim(pa.axes, pb.axes) + w.cuis * cuis))
}

// --- Jeux de paires ---------------------------------------------------------------------------

const PATHO: [string, string][] = [
  ['boeuf_hache_sauce_tomate', 'ratatouille'], // bœuf × plat végétalien
  ['boeuf_hache_sauce_tomate', 'lotte_americaine'], // bœuf × poisson
  ['coq_au_vin', 'gigot_agneau_thym'], // zéro ingrédient commun, 50 % quand même
  ['clafoutis_framboises', 'tarte_abricots'], // zéro ingrédient commun
  ['endives_jambon_gratin', 'poireaux_gratines_bechamel'],
  ['cabillaud_vapeur_poireaux', 'poireaux_gratines_bechamel'],
]

const TEMOINS: [string, string][] = [
  ['soupe_carotte_gingembre', 'soupe_carottes_ail'],
  ['maquereau_four_citron', 'maquereau_moutarde_poele'],
  ['boeuf_hache_sauce_tomate', 'boulettes_boeuf_tomate'],
  ['moules_curry_creme', 'moules_vin_blanc'],
  ['oeufs_brouilles_persil', 'omelette_fines_herbes'],
  ['taboule_boulgour', 'taboule_quinoa_menthe'],
]

const FAUX_NEGATIFS: [string, string][] = [
  ['crevettes_ail_persil', 'salade_riz_crevettes_avocat'], // deux plats de crevettes, chaud vs froid
  ['riz_pilaf_amandes', 'salade_riz_thon_mais'], // deux plats de riz, chaud vs froid
  ['couscous_legumes', 'houmous_pois_chiches'], // deux plats de pois chiches
  ['soupe_poisson_fenouil', 'bar_grille_fenouil'], // deux poissons au fenouil
]

const avg = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((s, v) => s + v, 0) / xs.length)
const score = (w: Weights, set: [string, string][]) =>
  avg(set.filter(([a, b]) => profiles.has(a as RecipeId) && profiles.has(b as RecipeId)).map(([a, b]) => sim(w, a as RecipeId, b as RecipeId)))

// --- Sortie -----------------------------------------------------------------------------------

for (const [label, set] of [['PATHOLOGIQUES (à faire BAISSER)', PATHO], ['TÉMOINS (à garder HAUTS)', TEMOINS], ['FAUX NÉGATIFS (à faire REMONTER)', FAUX_NEGATIFS]] as const) {
  console.log(`\n${label}`)
  console.log(['Paire'.padEnd(44), ...WEIGHTS.map((w) => w.name.slice(0, 11).padEnd(12))].join(''))
  for (const [a, b] of set) {
    if (!profiles.has(a as RecipeId) || !profiles.has(b as RecipeId)) { console.log(`  ${a} × ${b} — ABSENTE`); continue }
    console.log([`${a} × ${b}`.slice(0, 43).padEnd(44), ...WEIGHTS.map((w) => `${(sim(w, a as RecipeId, b as RecipeId) * 100).toFixed(0)}%`.padStart(4).padEnd(12))].join(''))
  }
}

console.log('\nSYNTHÈSE')
console.log(['Pondération'.padEnd(22), 'patho'.padEnd(8), 'témoins'.padEnd(9), 'faux nég.'.padEnd(11), 'écart utile'.padEnd(13), 'plancher*', ' max global'].join(''))
for (const w of WEIGHTS) {
  const pa = score(w, PATHO)
  const te = score(w, TEMOINS)
  const fn = score(w, FAUX_NEGATIFS)
  // Écart UTILE : ce qui sépare les vrais doublons de tout le reste (patho + faux négatifs mal
  // classés comptent également comme du bruit à distinguer des témoins).
  const utile = te - (pa + fn) / 2

  let max = 0
  let planch = 0 // plus haut score atteint par une paire SANS aucun ingrédient commun
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const s = sim(w, ids[i]!, ids[j]!)
      if (s > max) max = s
      const ov = signatureOverlap(profiles.get(ids[i]!)!.signature, profiles.get(ids[j]!)!.signature)
      if (ov === 0 && s > planch) planch = s
    }
  }

  console.log(
    [
      w.name.padEnd(22),
      `${(pa * 100).toFixed(0)}%`.padEnd(8),
      `${(te * 100).toFixed(0)}%`.padEnd(9),
      `${(fn * 100).toFixed(0)}%`.padEnd(11),
      `${(utile * 100).toFixed(0)} pts`.padEnd(13),
      `${(planch * 100).toFixed(0)}%`.padEnd(10),
      `${(max * 100).toFixed(0)}%`,
    ].join('')
  )
}
console.log('\n* plancher = score le plus haut atteint par deux plats N’AYANT AUCUN ingrédient commun.')
console.log('  Plus il est bas, moins la similarité peut se fabriquer sans ingrédients partagés.')

console.log('\nIMPACT PRATIQUE — combien de paires dépassent 60 % (seuil où MMR pénalise vraiment)')
for (const w of WEIGHTS) {
  let n = 0
  let top = { s: 0, a: '', b: '' }
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const s = sim(w, ids[i]!, ids[j]!)
      if (s > 0.6) n++
      if (s > top.s) top = { s, a: ids[i]!, b: ids[j]! }
    }
  }
  const nom = (id: string) => catalog.recipes.get(id as RecipeId)?.nom ?? id
  console.log(`  ${w.name.padEnd(22)} ${String(n).padStart(5)} paires  ·  la plus haute : ${(top.s * 100).toFixed(0)}%  ${nom(top.a)} × ${nom(top.b)}`)
}
