// app/src/cli/audit-similarite.ts — inspection HUMAINE de la similarité, avec décomposition.
//
// Ne mesure pas « un score », montre DE QUOI il est fait. Trois vues, dans cet ordre :
//   1. le haut du classement (ce que la diversification écarte en premier) ;
//   2. la BANDE 55-70 % — là où MMR agit réellement, et où une erreur est invisible dans une
//      moyenne. Le haut du classement peut être irréprochable et le milieu absurde ;
//   3. la recherche active de FAUX NÉGATIFS : des plats qui partagent leur aliment dominant et
//      que le modèle sépare quand même. C'est le cas qu'un top-N flatteur ne montre jamais.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from '../data/catalog-loader-node.js'
import { attachDerivedIndexes } from '../engine/nutrition/index.js'
import {
  SIMILARITY_WEIGHT_CUISINE,
  SIMILARITY_WEIGHT_INGREDIENTS,
  SIMILARITY_WEIGHT_SENSORY,
  buildSimilarityProfiles,
  similarity,
} from '../engine/selection/index.js'
import { signatureOverlap } from '../engine/nutrition/signature.js'
import type { RecipeId } from '../engine/domain/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const catalog = attachDerivedIndexes(
  loadCatalog(path.join(__dirname, '..', '..', 'public', 'catalog', 'catalog.db'))
)
const profiles = buildSimilarityProfiles(catalog)
const ids = [...profiles.keys()]

const nom = (id: RecipeId) => catalog.recipes.get(id)?.nom ?? id
const cuisineOf = (id: RecipeId) =>
  (catalog.recipes.get(id)?.facettes ?? []).filter((f) => f.facette === 'cuisine').map((f) => f.valeur).join('/') || '—'
const dominant = (id: RecipeId) => {
  const sig = catalog.indexes.recipeSignature.get(id)
  if (!sig) return '—'
  return [...sig.entries()].sort((a, b) => b[1] - a[1])[0]![0]
}

interface Pair { a: RecipeId; b: RecipeId; total: number; ingr: number; cuis: number; sens: number }

const pairs: Pair[] = []
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    const a = ids[i]!, b = ids[j]!
    const pa = profiles.get(a)!, pb = profiles.get(b)!
    const ingr = signatureOverlap(pa.signature, pb.signature)
    const cuis = pa.cuisines.length === 0 || pb.cuisines.length === 0 ? 0 : pa.cuisines.some((c) => pb.cuisines.includes(c)) ? 1 : 0
    const total = similarity(pa, pb)
    // Sensoriel DÉDUIT du total, avec les poids RÉELS importés du moteur — jamais recopiés en dur
    // ici : ce script a déjà affiché des décompositions fausses après un changement de pondération.
    const sens = (total - SIMILARITY_WEIGHT_INGREDIENTS * ingr - SIMILARITY_WEIGHT_CUISINE * cuis) / SIMILARITY_WEIGHT_SENSORY
    pairs.push({ a, b, total, ingr, cuis, sens })
  }
}
pairs.sort((x, y) => y.total - x.total)

function show(p: Pair): void {
  console.log(`  ${(p.total * 100).toFixed(0).padStart(3)}%  ${nom(p.a)}`)
  console.log(`        ${nom(p.b)}`)
  console.log(
    `        ingrédients ${(p.ingr * 100).toFixed(0).padStart(3)}%  ·  cuisine ${p.cuis ? 'même' : 'diff'} (${cuisineOf(p.a)} / ${cuisineOf(p.b)})  ·  sensoriel ${(p.sens * 100).toFixed(0)}%`
  )
}

console.log(`${ids.length} recettes, ${pairs.length} paires\n`)

console.log('=== 1. LES 10 PLUS PROCHES — ce que la diversification écarte en premier')
for (const p of pairs.slice(0, 10)) show(p)

console.log('\n=== 2. BANDE 55-70 % — là où MMR agit vraiment (échantillon régulier)')
const band = pairs.filter((p) => p.total >= 0.55 && p.total <= 0.7)
const step = Math.max(1, Math.floor(band.length / 10))
console.log(`  ${band.length} paires dans la bande ; une sur ${step} affichée`)
for (let i = 0; i < band.length && i / step < 10; i += step) show(band[i]!)

console.log('\n=== 3. FAUX NÉGATIFS POSSIBLES — même aliment dominant, mais score BAS')
const suspects = pairs
  .filter((p) => dominant(p.a) === dominant(p.b) && dominant(p.a) !== '—' && p.total < 0.45)
  .slice(-8)
if (suspects.length === 0) console.log('  aucun')
for (const p of suspects) {
  console.log(`  ${(p.total * 100).toFixed(0).padStart(3)}%  [${dominant(p.a)}]  ${nom(p.a)}  ×  ${nom(p.b)}`)
  console.log(`        ingrédients ${(p.ingr * 100).toFixed(0)}%  ·  cuisine ${p.cuis ? 'même' : 'diff'}  ·  sensoriel ${(p.sens * 100).toFixed(0)}%`)
}

console.log('\n=== 4. PLANCHER STRUCTUREL — deux plats SANS ingrédient commun, score le plus haut')
const disjoint = pairs.filter((p) => p.ingr === 0)
console.log(`  ${disjoint.length} paires n'ont AUCUN ingrédient de signature en commun`)
for (const p of disjoint.slice(0, 5)) show(p)
