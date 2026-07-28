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
import { loadCatalog } from '../data/catalog-loader-node.js'
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

/**
 * ---------------------------------------------------------------------------------------------
 * MODÈLES « PRINCIPAL + SECONDAIRES » (proposition utilisateur, 2026-07-27)
 *
 * Constat qui les motive, mesuré : « Blanc de poulet rôti, carottes fondantes » a carotte 43 % ET
 * poulet_blanc 43 % — ÉGALITÉ PARFAITE, départagée par ordre alphabétique. Pour la machine, ce
 * plat est donc « un plat de carottes ». Aucune règle fondée sur l'aliment DOMINANT ne peut
 * marcher tant que le départage est arbitraire.
 *
 * Deux idées distinctes, mesurées séparément puis combinées :
 *
 *  A. RANG PLUTÔT QUE POIDS — un aliment PRINCIPAL et des SECONDAIRES, à poids fixes
 *     (0,60 / 0,25 / 0,15) au lieu des parts réelles. Rend la comparaison insensible au fait
 *     qu'un plat soit « chargé » en protéine et l'autre non (43 % vs 71 %).
 *
 *  B. DÉPARTAGE PAR RÔLE — à poids égal, l'aliment d'un GROUPE STRUCTURANT (viande, poisson,
 *     légumineuse, œuf) passe devant l'accompagnement. « Poulet aux carottes », jamais
 *     « carottes au poulet ».
 *
 *  C. FAMILLE COMMUNE PESANTE — pas de dominant du tout : deux plats comptent comme le même repas
 *     si une MÊME sous-famille pèse au moins τ des deux côtés. Robuste par construction aux
 *     égalités, puisqu'il n'y a rien à départager.
 * ---------------------------------------------------------------------------------------------
 */

/** Poids fixes par rang — le principal vaut plus du double du premier secondaire. */
const RANG_POIDS = [0.6, 0.25, 0.15]

/** `true` si l'aliment appartient à un groupe qui STRUCTURE un repas (protéine, légumineuse). */
const estStructurant = (foodId: string) => {
  const groupe = catalog.foods.get(foodId as never)?.groupe
  return groupe !== undefined && GROUPES_STRUCTURANTS.has(groupe)
}

/**
 * Signature à poids de RANG, repliée par famille. `parRole` active le départage B : à part égale,
 * le structurant passe devant. Sans lui, le tri retombe sur l'ordre alphabétique des ids.
 */
const rangSig = (id: RecipeId, parRole: boolean) => {
  const entrees = [...sigOf(id).entries()].sort((x, y) => {
    if (parRole) {
      const [sx, sy] = [estStructurant(x[0]), estStructurant(y[0])]
      if (sx !== sy) return sx ? -1 : 1
    }
    return y[1] - x[1] || (x[0] < y[0] ? -1 : 1)
  })
  const out = new Map<string, number>()
  entrees.forEach(([foodId], rang) => {
    const key = catalog.foods.get(foodId)?.sousFamille ?? foodId
    out.set(key, (out.get(key) ?? 0) + (RANG_POIDS[rang] ?? 0))
  })
  return out
}

const overlapDe = (x: ReadonlyMap<string, number>, y: ReadonlyMap<string, number>) => {
  if (x.size === 0 || y.size === 0) return 0
  let inter = 0, union = 0
  for (const k of new Set([...x.keys(), ...y.keys()])) {
    inter += Math.min(x.get(k) ?? 0, y.get(k) ?? 0)
    union += Math.max(x.get(k) ?? 0, y.get(k) ?? 0)
  }
  return union === 0 ? 0 : inter / union
}

const ruleRang = (tau: number, parRole: boolean) => (a: RecipeId, b: RecipeId) =>
  overlapDe(rangSig(a, parRole), rangSig(b, parRole)) >= tau

/** Modèle C : une même sous-famille pèse ≥ τ des DEUX côtés, sans notion de dominant. */
const ruleFamillePesante = (tauPart: number) => (a: RecipeId, b: RecipeId) => {
  const [x, y] = [famSig(a), famSig(b)]
  for (const [key, part] of x) {
    if (part >= tauPart && (y.get(key) ?? 0) >= tauPart) return true
  }
  return false
}

/** Noms de sous-familles RÉELLEMENT déclarées au catalogue (`poulet`, `agneau`, `riz`…). */
const FAMILLES_DECLAREES = new Set(
  [...catalog.foods.values()].map((f) => f.sousFamille).filter((f): f is string => f !== null)
)

/**
 * Variante de C restreinte aux SOUS-FAMILLES DÉCLARÉES. Partager `poulet` à 40 % des deux côtés
 * dit « deux préparations du même animal ». Partager `oeuf` à 40 % ne dit rien de tel : l'œuf est
 * un ingrédient de structure présent partout (mousse, omelette, flan, panure). La version non
 * restreinte confondait les deux, d'où ses 3 faux déclenchements.
 */
const ruleFamilleDeclareePesante = (tauPart: number) => (a: RecipeId, b: RecipeId) => {
  const [x, y] = [famSig(a), famSig(b)]
  for (const [key, part] of x) {
    if (!FAMILLES_DECLAREES.has(key)) continue
    if (part >= tauPart && (y.get(key) ?? 0) >= tauPart) return true
  }
  return false
}

/**
 * Familles déclarées dont les aliments relèvent d'un GROUPE STRUCTURANT (viande, poisson, fruit de
 * mer, légumineuse) — celles qui DÉFINISSENT un plat. Exclut `lait`, `riz`, `chou`, `poivron` :
 * mesuré, `lait ≥ 40 % des deux côtés` rapproche « Clafoutis aux framboises » et « Gratin de pâtes
 * au jambon ». Le lait est un ingrédient de structure présent partout, pas un produit définissant.
 */
const GROUPES_DEFINISSANTS = new Set(['viandes', 'poissons', 'fruits de mer', 'légumineuses'])
const FAMILLES_STRUCTURANTES = new Set(
  [...catalog.foods.values()]
    .filter((f) => f.sousFamille !== null && GROUPES_DEFINISSANTS.has(f.groupe))
    .map((f) => f.sousFamille as string)
)

const ruleFamilleStructurantePesante = (tauPart: number) => (a: RecipeId, b: RecipeId) => {
  const [x, y] = [famSig(a), famSig(b)]
  for (const [key, part] of x) {
    if (!FAMILLES_STRUCTURANTES.has(key)) continue
    if (part >= tauPart && (y.get(key) ?? 0) >= tauPart) return true
  }
  return false
}

/** Combinaison : le chevauchement famille OU la famille commune pesante. */
const ruleFamOuPesante = (tau: number, tauPart: number) => (a: RecipeId, b: RecipeId) =>
  famOverlap(a, b) >= tau || ruleFamillePesante(tauPart)(a, b)

/**
 * MODIFICATEUR DE CRÉNEAU. Deux recettes qui ne partagent aucun `typesRepas` ne peuvent jamais être
 * candidates à la même demande (l'exclusion `creneau` passe avant le scoring, §6.4) : les rapprocher
 * n'a aucun effet utile, et peut en avoir un NUISIBLE — un clafoutis mangé au goûter pénalise
 * aujourd'hui un gratin de pâtes proposé au dîner, parce que `scoreVariety` lit toutes les entrées
 * d'historique sans regarder leur créneau.
 *
 * ⚠️ Ce n'est PAS « même créneau exactement ». Poulet au déjeuner puis poulet au dîner DOIT compter
 * comme répétitif : les deux recettes portent [dejeuner, diner], elles se croisent donc.
 */
const partagentCreneau = (a: RecipeId, b: RecipeId) => {
  const sa = catalog.recipes.get(a)?.typesRepas ?? []
  const sb = catalog.recipes.get(b)?.typesRepas ?? []
  return sa.some((s) => sb.includes(s))
}
const avecCreneau =
  (fires: (a: RecipeId, b: RecipeId) => boolean) => (a: RecipeId, b: RecipeId) =>
    partagentCreneau(a, b) && fires(a, b)

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
  { name: 'rang 60/25/15 ≥ 0,45', fires: ruleRang(0.45, false) },
  { name: 'rang + rôle ≥ 0,45', fires: ruleRang(0.45, true) },
  { name: 'rang + rôle ≥ 0,55', fires: ruleRang(0.55, true) },
  { name: 'rang + rôle ≥ 0,60', fires: ruleRang(0.6, true) },
  { name: 'famille commune ≥ 40 % des 2', fires: ruleFamillePesante(0.4) },
  { name: 'famille commune ≥ 50 % des 2', fires: ruleFamillePesante(0.5) },
  { name: 'fam ≥ 0,45 OU commune ≥ 40 %', fires: ruleFamOuPesante(0.45, 0.4) },
  { name: 'fam ≥ 0,45 OU commune ≥ 50 %', fires: ruleFamOuPesante(0.45, 0.5) },
  { name: 'famille DÉCLARÉE ≥ 35 % des 2', fires: ruleFamilleDeclareePesante(0.35) },
  { name: 'famille DÉCLARÉE ≥ 40 % des 2', fires: ruleFamilleDeclareePesante(0.4) },
  { name: 'fam ≥ 0,45 OU déclarée ≥ 35 %', fires: (a, b) => famOverlap(a, b) >= 0.45 || ruleFamilleDeclareePesante(0.35)(a, b) },
  { name: 'fam ≥ 0,45 OU déclarée ≥ 40 %', fires: (a, b) => famOverlap(a, b) >= 0.45 || ruleFamilleDeclareePesante(0.4)(a, b) },
  { name: 'fam ≥ 0,45 OU déclarée ≥ 50 %', fires: (a, b) => famOverlap(a, b) >= 0.45 || ruleFamilleDeclareePesante(0.5)(a, b) },
  { name: 'fam ≥ 0,45 OU structurante ≥ 30 %', fires: (a, b) => famOverlap(a, b) >= 0.45 || ruleFamilleStructurantePesante(0.3)(a, b) },
  { name: 'fam ≥ 0,45 OU structurante ≥ 40 %', fires: (a, b) => famOverlap(a, b) >= 0.45 || ruleFamilleStructurantePesante(0.4)(a, b) },
  { name: 'fam ≥ 0,45 OU structurante ≥ 50 %', fires: (a, b) => famOverlap(a, b) >= 0.45 || ruleFamilleStructurantePesante(0.5)(a, b) },
  { name: '+créneau : fam ≥ 0,36', fires: avecCreneau(ruleFam(0.36)) },
  { name: '+créneau : fam ≥ 0,38', fires: avecCreneau(ruleFam(0.38)) },
  { name: '+créneau : fam ≥ 0,40', fires: avecCreneau(ruleFam(0.4)) },
  { name: '+créneau : fam ≥ 0,45', fires: avecCreneau(ruleFam(0.45)) },
  { name: '+créneau : ≥ 0,45 OU protéine ≥ 40 %', fires: avecCreneau((a, b) => famOverlap(a, b) >= 0.45 || ruleFamilleStructurantePesante(0.4)(a, b)) },
  { name: '+créneau : ≥ 0,45 OU toute fam ≥ 40 %', fires: avecCreneau((a, b) => famOverlap(a, b) >= 0.45 || ruleFamilleDeclareePesante(0.4)(a, b)) },
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
