// app/src/cli/compare-variety.ts — banc de comparaison des règles de RÉCENCE (`variety`/`habit`).
//
// Expérience, pas code de production. `variety` et `habit` demandent « ai-je mangé ça
// récemment ? ». La règle actuelle répond « oui » si l'entrée d'historique partage l'ingrédient
// LE PLUS LOURD du candidat — le même index que la similarité a dû abandonner (§6.6 bis).
//
// ⚠️ La question N'EST PAS celle de la similarité. Deux plats peuvent être compositionnellement
// proches sans que manger l'un lasse de l'autre, et inversement. On ne recopie donc pas le seuil
// de §6.6 ter : on mesure celui-ci séparément, sur des jeux de paires jugés pour CETTE question.
//
// Jeux de paires — « manger A hier rend-il B répétitif aujourd'hui ? »
//   DOIT DÉCLENCHER — même aliment structurant, deux préparations.
//   NE DOIT PAS     — plats sans rapport que la règle actuelle rapproche parce que leur
//                     ingrédient le plus lourd coïncide (œuf, riz, pois chiche…).

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from '../data/catalog-loader.js'
import { attachDerivedIndexes } from '../engine/nutrition/index.js'
import { signatureOverlap } from '../engine/nutrition/signature.js'
import type { RecipeId } from '../engine/domain/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const catalog = attachDerivedIndexes(
  loadCatalog(path.join(__dirname, '..', '..', 'public', 'catalog', 'catalog.db'))
)
const ids = [...catalog.recipes.keys()]
const sigOf = (id: RecipeId) => catalog.indexes.recipeSignature.get(id) ?? new Map()
const mainOf = (id: RecipeId) => catalog.indexes.recipeMainIngredient.get(id)
const nom = (id: string) => catalog.recipes.get(id as RecipeId)?.nom ?? id

/** Règle ACTUELLE : même ingrédient le plus lourd. */
const ruleCurrent = (a: RecipeId, b: RecipeId) => mainOf(a) !== undefined && mainOf(a) === mainOf(b)
/** Règle CANDIDATE : chevauchement de signature au-delà d'un seuil. */
const ruleOverlap = (tau: number) => (a: RecipeId, b: RecipeId) => signatureOverlap(sigOf(a), sigOf(b)) >= tau

/** Aliment dominant de la signature (part la plus forte). */
const dominantOf = (id: RecipeId) => {
  const sig = sigOf(id)
  if (sig.size === 0) return undefined
  return [...sig.entries()].sort((x, y) => y[1] - x[1])[0]![0]
}
const groupeOf = (id: RecipeId) => {
  const d = dominantOf(id)
  return d === undefined ? undefined : catalog.foods.get(d)?.groupe
}
/** Sous-famille de l'aliment dominant (`poulet_blanc` et `poulet_cuisse` → `poulet`). */
const sousFamilleOf = (id: RecipeId) => {
  const d = dominantOf(id)
  return d === undefined ? undefined : (catalog.foods.get(d)?.sousFamille ?? undefined)
}
/** Variante : chevauchement OU même SOUS-FAMILLE dominante — bien plus étroit que le groupe. */
const ruleOverlapOrFamily = (tau: number) => (a: RecipeId, b: RecipeId) => {
  if (signatureOverlap(sigOf(a), sigOf(b)) >= tau) return true
  const fa = sousFamilleOf(a)
  return fa !== undefined && fa === sousFamilleOf(b)
}

/** Groupes où « j'en ai déjà mangé » a un sens fort — le reste est trop hétérogène. */
const GROUPES_STRUCTURANTS = new Set(['viandes', 'poissons', 'fruits de mer', 'légumineuses', 'œufs'])
/** Variante : chevauchement OU même GROUPE alimentaire dominant, si ce groupe est structurant. */
const ruleOverlapOrGroup = (tau: number) => (a: RecipeId, b: RecipeId) => {
  if (signatureOverlap(sigOf(a), sigOf(b)) >= tau) return true
  const ga = groupeOf(a)
  return ga !== undefined && ga === groupeOf(b) && GROUPES_STRUCTURANTS.has(ga)
}

/**
 * Signature NORMALISÉE PAR FAMILLE : chaque aliment est remplacé par sa sous-famille quand elle
 * existe, et les parts des aliments d'une même famille s'additionnent. `poulet_blanc` et
 * `poulet_cuisse` deviennent tous deux `poulet`, donc deux plats de poulet se chevauchent enfin.
 * Plus robuste que « même sous-famille DOMINANTE » : ne dépend pas d'un départage de poids.
 */
const famSig = (id: RecipeId) => {
  const out = new Map<string, number>()
  for (const [foodId, part] of sigOf(id)) {
    const key = catalog.foods.get(foodId)?.sousFamille ?? foodId
    out.set(key, (out.get(key) ?? 0) + part)
  }
  return out
}
const famOverlap = (a: RecipeId, b: RecipeId) => {
  const [x, y] = [famSig(a), famSig(b)]
  if (x.size === 0 || y.size === 0) return 0
  let inter = 0, union = 0
  for (const k of new Set([...x.keys(), ...y.keys()])) {
    inter += Math.min(x.get(k) ?? 0, y.get(k) ?? 0)
    union += Math.max(x.get(k) ?? 0, y.get(k) ?? 0)
  }
  return union === 0 ? 0 : inter / union
}
const ruleFam = (tau: number) => (a: RecipeId, b: RecipeId) => famOverlap(a, b) >= tau

const RULES: { name: string; fires: (a: RecipeId, b: RecipeId) => boolean }[] = [
  { name: 'actuelle (même plus lourd)', fires: ruleCurrent },
  { name: 'chevauchement ≥ 0,25', fires: ruleOverlap(0.25) },
  { name: 'chevauchement ≥ 0,35', fires: ruleOverlap(0.35) },
  { name: 'chevauchement ≥ 0,45', fires: ruleOverlap(0.45) },
  { name: 'chevauchement ≥ 0,55', fires: ruleOverlap(0.55) },
  { name: '≥ 0,45 OU même groupe', fires: ruleOverlapOrGroup(0.45) },
  { name: '≥ 0,45 OU sous-famille', fires: ruleOverlapOrFamily(0.45) },
  { name: '≥ 0,55 OU sous-famille', fires: ruleOverlapOrFamily(0.55) },
  { name: 'famille-normalisé ≥ 0,36', fires: ruleFam(0.36) },
  { name: 'famille-normalisé ≥ 0,38', fires: ruleFam(0.38) },
  { name: 'famille-normalisé ≥ 0,40', fires: ruleFam(0.4) },
  { name: 'famille-normalisé ≥ 0,42', fires: ruleFam(0.42) },
  { name: 'famille-normalisé ≥ 0,45', fires: ruleFam(0.45) },
]

const DOIT: [string, string][] = [
  ['boeuf_hache_sauce_tomate', 'boulettes_boeuf_tomate'],
  ['poulet_roti_carottes', 'poulet_citron_olives'],
  ['moules_vin_blanc', 'moules_curry_creme'],
  ['soupe_carottes_ail', 'soupe_carotte_gingembre'],
  ['maquereau_four_citron', 'maquereau_moutarde_poele'],
  ['pommes_terre_boulangere', 'gratin_dauphinois'],
  ['oeufs_brouilles_persil', 'omelette_fines_herbes'],
]

const NE_DOIT_PAS: [string, string][] = [
  ['mousse_chocolat', 'galettes_sarrasin_jambon'], // les deux « à l'œuf » par le poids
  ['blancs_neige_compote_citron', 'galettes_sarrasin_jambon'],
  ['couscous_legumes', 'houmous_pois_chiches'], // les deux « au pois chiche »
  ['lentilles_vertes_carottes', 'poulet_roti_carottes'], // égalité de poids sur la carotte
  ['hachis_boeuf_pommes_terre', 'hareng_pommes_terre_tiedes'], // les deux « à la pomme de terre »
  ['mousse_chocolat', 'oeufs_brouilles_persil'],
]

const present = ([a, b]: [string, string]) =>
  catalog.recipes.has(a as RecipeId) && catalog.recipes.has(b as RecipeId)

console.log(`${ids.length} recettes\n`)
console.log(['Règle'.padEnd(28), 'déclenche à tort'.padEnd(18), 'rate à raison'.padEnd(16), 'paires touchées'].join(''))

for (const rule of RULES) {
  const faux = NE_DOIT_PAS.filter(present).filter(([a, b]) => rule.fires(a as RecipeId, b as RecipeId)).length
  const rates = DOIT.filter(present).filter(([a, b]) => !rule.fires(a as RecipeId, b as RecipeId)).length

  let total = 0
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) if (rule.fires(ids[i]!, ids[j]!)) total++
  }

  console.log(
    [
      rule.name.padEnd(28),
      `${faux} / ${NE_DOIT_PAS.filter(present).length}`.padEnd(18),
      `${rates} / ${DOIT.filter(present).length}`.padEnd(16),
      String(total),
    ].join('')
  )
}

console.log('\nDÉTAIL — chevauchement réel de chaque paire jugée')
console.log('  DOIT déclencher :')
for (const p of DOIT.filter(present)) {
  console.log(`    ${(signatureOverlap(sigOf(p[0] as RecipeId), sigOf(p[1] as RecipeId)) * 100).toFixed(0).padStart(3)}%  ${nom(p[0])} × ${nom(p[1])}`)
}
console.log('  NE DOIT PAS déclencher :')
for (const p of NE_DOIT_PAS.filter(present)) {
  console.log(`    ${(signatureOverlap(sigOf(p[0] as RecipeId), sigOf(p[1] as RecipeId)) * 100).toFixed(0).padStart(3)}%  ${nom(p[0])} × ${nom(p[1])}`)
}
