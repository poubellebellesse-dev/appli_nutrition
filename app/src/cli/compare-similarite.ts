// app/src/cli/compare-similarite.ts — banc de COMPARAISON de modèles de similarité.
//
// Expérience, pas code de production : rien de ce fichier n'est appelé par le moteur. Il sert à
// choisir entre plusieurs formules avant d'en câbler une (défaut relevé au palier de 100 recettes —
// `recipeMainIngredient` retient l'ingrédient le plus LOURD, pas le plus caractéristique).
//
// Chaque modèle est jugé sur DEUX ensembles de paires, pas sur une moyenne :
//  - PATHOLOGIQUES : des plats sans rapport que le modèle actuel croit presque identiques.
//    Un bon modèle les sépare.
//  - TÉMOINS : des plats réellement proches (deux ragoûts de veau, deux omelettes, deux plats de
//    pâtes). Un modèle qui les sépare AUSSI est inutile — il ne discrimine plus rien.
// Un modèle n'est bon que s'il creuse l'écart entre les deux ensembles.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from '../data/catalog-loader.js'
import { attachDerivedIndexes } from '../engine/nutrition/index.js'
import type { Catalog, Recipe, RecipeId, FoodId } from '../engine/domain/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const catalog = attachDerivedIndexes(
  loadCatalog(path.join(__dirname, '..', '..', 'public', 'catalog', 'catalog.db'))
)

const recipes = [...catalog.recipes.values()]
const N = recipes.length

// --- Données dérivées communes ----------------------------------------------------------------

/** Nombre de recettes où l'aliment apparaît en ingrédient NON optionnel. */
const docFreq = new Map<FoodId, number>()
for (const r of recipes) {
  for (const id of new Set(r.ingredients.filter((i) => !i.optionnel).map((i) => i.foodId))) {
    docFreq.set(id, (docFreq.get(id) ?? 0) + 1)
  }
}

interface Comp {
  readonly foodId: FoodId
  readonly part: number // proportion de la masse non optionnelle
}

function components(r: Recipe): Comp[] {
  const solid = r.ingredients.filter((i) => !i.optionnel)
  const total = solid.reduce((s, i) => s + i.quantiteG, 0) || 1
  return solid.map((i) => ({ foodId: i.foodId, part: i.quantiteG / total })).sort((a, b) => b.part - a.part)
}

const comps = new Map<RecipeId, Comp[]>(recipes.map((r) => [r.id, components(r)]))

function sensory(r: Recipe): [number, number, number] {
  return [r.axes.sucreSale, r.axes.legerConsistant, r.axes.chaudFroid]
}
function cuisines(r: Recipe): string[] {
  return r.facettes.filter((f) => f.facette === 'cuisine').map((f) => f.valeur)
}

/** Même formule que scoreCraving / similarity actuel : moyenne des proximités par axe. */
function sensorySim(a: Recipe, b: Recipe): number {
  const [x, y] = [sensory(a), sensory(b)]
  return x.reduce((s, v, i) => s + (1 - Math.abs(v - y[i]!) / 2), 0) / 3
}
function cuisineSim(a: Recipe, b: Recipe): number {
  const [x, y] = [cuisines(a), cuisines(b)]
  if (x.length === 0 || y.length === 0) return 0.5
  return x.some((c) => y.includes(c)) ? 1 : 0
}

// --- Poids d'un ingrédient selon le modèle -----------------------------------------------------

/** Rareté NORMALISÉE, bornée dans [0, 1) : 1 - fréquence relative. Stable quand N grandit, à
 * composition constante — contrairement à log(N/n) qui croît sans borne pour un ingrédient rare. */
function rarity(id: FoodId): number {
  return 1 - (docFreq.get(id) ?? 1) / N
}

/** Rareté PLAFONNÉE : au-delà du plafond, tous les ingrédients rares se valent. Empêche qu'un
 * ingrédient unique au catalogue écrase tout le reste de la signature. */
function rarityCapped(id: FoodId, cap: number): number {
  return Math.min(rarity(id), cap) / cap
}

// --- Les modèles ------------------------------------------------------------------------------

type Model = { name: string; note: string; sim: (a: Recipe, b: Recipe) => number }

/** Chevauchement d'ensembles pondéré (Jaccard pondéré) sur des composantes {foodId → poids}. */
function weightedOverlap(x: Map<FoodId, number>, y: Map<FoodId, number>): number {
  let inter = 0
  let union = 0
  for (const id of new Set([...x.keys(), ...y.keys()])) {
    const a = x.get(id) ?? 0
    const b = y.get(id) ?? 0
    inter += Math.min(a, b)
    union += Math.max(a, b)
  }
  return union === 0 ? 0 : inter / union
}

function signature(
  r: Recipe,
  opts: { topN: number; minPart: number; weight: (c: Comp) => number }
): Map<FoodId, number> {
  const kept = (comps.get(r.id) ?? []).filter((c) => c.part >= opts.minPart).slice(0, opts.topN)
  const out = new Map<FoodId, number>()
  for (const c of kept) out.set(c.foodId, opts.weight(c))
  const sum = [...out.values()].reduce((s, v) => s + v, 0) || 1
  for (const [k, v] of out) out.set(k, v / sum) // normalisée : compare des PROFILS, pas des masses
  return out
}

function blend(ingr: number, a: Recipe, b: Recipe): number {
  return 0.5 * ingr + 0.3 * sensorySim(a, b) + 0.2 * cuisineSim(a, b)
}

const MODELS: Model[] = [
  {
    name: 'M0 actuel',
    note: 'ingrédient le plus lourd, comparé à l’identique',
    sim: (a, b) => {
      const ma = catalog.indexes.recipeMainIngredient.get(a.id) ?? null
      const mb = catalog.indexes.recipeMainIngredient.get(b.id) ?? null
      const ingr = ma === null || mb === null ? 0 : ma === mb ? 1 : 0
      return blend(ingr, a, b)
    },
  },
  {
    name: 'M1 top3 poids',
    note: '3 plus lourds, chevauchement pondéré par la quantité',
    sim: (a, b) =>
      blend(
        weightedOverlap(
          signature(a, { topN: 3, minPart: 0, weight: (c) => c.part }),
          signature(b, { topN: 3, minPart: 0, weight: (c) => c.part })
        ),
        a,
        b
      ),
  },
  {
    name: 'M2 top3 + seuil 5%',
    note: 'idem M1, mais on ignore tout ingrédient sous 5 % de la masse',
    sim: (a, b) =>
      blend(
        weightedOverlap(
          signature(a, { topN: 3, minPart: 0.05, weight: (c) => c.part }),
          signature(b, { topN: 3, minPart: 0.05, weight: (c) => c.part })
        ),
        a,
        b
      ),
  },
  {
    name: 'M3 rareté',
    note: 'tous les ingrédients, pondérés quantité × rareté normalisée',
    sim: (a, b) =>
      blend(
        weightedOverlap(
          signature(a, { topN: 99, minPart: 0, weight: (c) => c.part * rarity(c.foodId) }),
          signature(b, { topN: 99, minPart: 0, weight: (c) => c.part * rarity(c.foodId) })
        ),
        a,
        b
      ),
  },
  {
    name: 'M4 rareté + seuil 5%',
    note: 'M3 + on ignore tout ingrédient sous 5 % de la masse',
    sim: (a, b) =>
      blend(
        weightedOverlap(
          signature(a, { topN: 99, minPart: 0.05, weight: (c) => c.part * rarity(c.foodId) }),
          signature(b, { topN: 99, minPart: 0.05, weight: (c) => c.part * rarity(c.foodId) })
        ),
        a,
        b
      ),
  },
  {
    name: 'M5 rareté plafonnée',
    note: 'M4 avec rareté plafonnée à 0,95 — borne l’effet d’un ingrédient unique',
    sim: (a, b) =>
      blend(
        weightedOverlap(
          signature(a, { topN: 99, minPart: 0.05, weight: (c) => c.part * rarityCapped(c.foodId, 0.95) }),
          signature(b, { topN: 99, minPart: 0.05, weight: (c) => c.part * rarityCapped(c.foodId, 0.95) })
        ),
        a,
        b
      ),
  },
]

// --- Jeux de paires ---------------------------------------------------------------------------

const PATHOLOGIQUES: [string, string][] = [
  ['lentilles_vertes_carottes', 'poulet_roti_carottes'],
  ['hachis_boeuf_pommes_terre', 'hareng_pommes_terre_tiedes'],
  ['mousse_chocolat', 'oeufs_brouilles_persil'],
  ['blancs_neige_compote_citron', 'omelette_fines_herbes'],
  ['crumble_pommes_noisettes', 'gratin_courgettes_riz'],
]

const TEMOINS: [string, string][] = [
  ['blanquette_veau', 'veau_marengo'],
  ['omelette_fines_herbes', 'omelette_champignons_comte'],
  ['pates_ail_huile', 'pates_pesto_basilic'],
  ['soupe_carottes_ail', 'soupe_poireaux_pommes_terre'],
  ['moules_vin_blanc', 'moules_curry_creme'],
]

function get(id: string): Recipe | undefined {
  return catalog.recipes.get(id as RecipeId)
}
function pairScore(m: Model, [x, y]: [string, string]): number | null {
  const a = get(x)
  const b = get(y)
  return a && b ? m.sim(a, b) : null
}
const pct = (v: number | null) => (v === null ? '  n/a' : `${(v * 100).toFixed(0)}%`.padStart(5))

// --- Sortie -----------------------------------------------------------------------------------

console.log(`Catalogue : ${N} recettes, ${docFreq.size} aliments employés en non-optionnel\n`)

const header = ['Paire'.padEnd(46), ...MODELS.map((m) => m.name.padEnd(12))].join(' ')
console.log('PAIRES PATHOLOGIQUES — doivent être BASSES')
console.log(header)
for (const p of PATHOLOGIQUES) {
  console.log([`${p[0]} × ${p[1]}`.slice(0, 45).padEnd(46), ...MODELS.map((m) => pct(pairScore(m, p)).padEnd(12))].join(' '))
}

console.log('\nPAIRES TÉMOINS — doivent rester HAUTES')
console.log(header)
for (const p of TEMOINS) {
  console.log([`${p[0]} × ${p[1]}`.slice(0, 45).padEnd(46), ...MODELS.map((m) => pct(pairScore(m, p)).padEnd(12))].join(' '))
}

console.log('\nSYNTHÈSE — moyennes et pouvoir de séparation')
console.log(['Modèle'.padEnd(24), 'patho'.padEnd(8), 'témoins'.padEnd(9), 'écart'.padEnd(8), 'max global', 'médiane'].join(' '))
for (const m of MODELS) {
  const pa = PATHOLOGIQUES.map((p) => pairScore(m, p)).filter((v): v is number => v !== null)
  const te = TEMOINS.map((p) => pairScore(m, p)).filter((v): v is number => v !== null)
  const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / (xs.length || 1)

  const all: number[] = []
  for (let i = 0; i < recipes.length; i++) {
    for (let j = i + 1; j < recipes.length; j++) all.push(m.sim(recipes[i]!, recipes[j]!))
  }
  all.sort((x, y) => y - x)

  console.log(
    [
      m.name.padEnd(24),
      `${(avg(pa) * 100).toFixed(0)}%`.padEnd(8),
      `${(avg(te) * 100).toFixed(0)}%`.padEnd(9),
      `${((avg(te) - avg(pa)) * 100).toFixed(0)} pts`.padEnd(8),
      `${(all[0]! * 100).toFixed(0)}%`.padEnd(10),
      `${(all[Math.floor(all.length / 2)]! * 100).toFixed(0)}%`,
    ].join(' ')
  )
}

console.log('\nNotes :')
for (const m of MODELS) console.log(`  ${m.name.padEnd(24)} ${m.note}`)
