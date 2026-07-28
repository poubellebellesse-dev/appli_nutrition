// Script de mesure ponctuel — distribution des similarités du catalogue réel (dette λ, §6.6).
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from '../data/catalog-loader-node.js'
import { buildSimilarityProfiles, similarity } from '../engine/selection/index.js'
import { attachDerivedIndexes } from '../engine/nutrition/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const db = path.join(__dirname, '..', '..', 'public', 'catalog', 'catalog.db')
const catalog = attachDerivedIndexes(loadCatalog(db))
const profiles = buildSimilarityProfiles(catalog)
const ids = [...profiles.keys()]

const pairs: { a: string; b: string; s: number }[] = []
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    pairs.push({ a: ids[i]!, b: ids[j]!, s: similarity(profiles.get(ids[i]!)!, profiles.get(ids[j]!)!) })
  }
}
pairs.sort((x, y) => y.s - x.s)
const vals = pairs.map((p) => p.s)
const q = (p: number) => vals[Math.floor((vals.length - 1) * p)]!
console.log(`${ids.length} recettes, ${pairs.length} paires`)
console.log(`max ${(vals[0]! * 100).toFixed(1)} %  ·  p99 ${(q(0.01) * 100).toFixed(1)} %  ·  médiane ${(q(0.5) * 100).toFixed(1)} %  ·  moyenne ${((vals.reduce((a, b) => a + b, 0) / vals.length) * 100).toFixed(1)} %`)
console.log(`paires au-dessus de 60 % : ${vals.filter((v) => v > 0.6).length}`)
console.log('Les 6 paires les plus proches :')
for (const p of pairs.slice(0, 6)) console.log(`  ${(p.s * 100).toFixed(1)} %  ${p.a} × ${p.b}`)
