// app/src/cli/try-planning.ts — banc CLI du planning (§11.3 ENGINE), pendant de `try-engine.ts`.
//
// La question à laquelle il répond n'est PAS « le moteur suggère-t-il bien » — `try-engine` s'en
// charge — mais « ces suggestions font-elles une SEMAINE crédible ». Un plat peut être excellent
// cinq fois de suite et produire une mauvaise semaine.
//
// Usage : node --experimental-sqlite --import tsx app/src/cli/try-planning.ts [jours]

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from '../data/catalog-loader.js'
import { createEngine } from '../engine/api/index.js'
import { attachDerivedIndexes } from '../engine/nutrition/index.js'
import type { MealSlot, RecipeId, WeekPlanRequest } from '../engine/domain/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '..', '..', 'public', 'catalog', 'catalog.db')
const catalog = attachDerivedIndexes(loadCatalog(dbPath))
const engine = createEngine(loadCatalog(dbPath))

const jours = Number(process.argv[2] ?? 7)

// ⚠️ QUATRE créneaux, goûter compris — ce n'est pas un détail de confort. MESURÉ le 2026-07-28 :
// sur TROIS repas, le catalogue actuel ne permet PAS d'atteindre le plancher de 1 200 kcal, et
// `assertCalorieFloor` fait échouer le plan (1 061 kcal au plus bas jour mesuré). La recette
// médiane apporte la moitié de la cible de son créneau : petit-déjeuner 334 kcal pour 500 visées,
// déjeuner 401 pour 700, dîner 381 pour 600. Avec le goûter, les 7 jours passent (min 1 258).
const SLOTS: readonly MealSlot[] = ['petit_dejeuner', 'dejeuner', 'gouter', 'diner']

const req: WeekPlanRequest = {
  profile: {
    trancheAge: '30_49',
    sexe: 'F',
    niveauActivite: 'actif',
    tailleCm: 165,
    poidsKg: 62,
    facteurPortion: 1,
  },
  constraints: { allergies: [], diet: null, excludedFoodIds: [] },
  startDate: '2026-08-03',
  days: jours,
  slots: SLOTS,
  history: { windowDays: 21, entries: [] },
  activeTopics: [],
  seed: 1,
}

const plan = engine.planWeek(req)
const nom = (id: RecipeId | null) => (id === null ? '— (vide)' : (catalog.recipes.get(id)?.nom ?? id))
const energyIndex = catalog.nutrients.findIndex((n) => n.code === 'energie')
const kcalOf = (id: RecipeId | null) =>
  id === null ? 0 : (catalog.indexes.recipeNutrients.get(id)?.[energyIndex] ?? 0)

console.log(`Planning ${plan.days} jours x ${SLOTS.length} creneaux — depart ${plan.startDate}\n`)

const parDate = new Map<string, { lignes: string[]; kcal: number }>()
for (const entry of plan.entries) {
  const jour = parDate.get(entry.slot.date) ?? { lignes: [], kcal: 0 }
  const kcal = kcalOf(entry.recipeId)
  jour.lignes.push(
    `${entry.slot.creneau.padEnd(15)} ${Math.round(kcal).toString().padStart(4)} kcal  ${nom(entry.recipeId)}`
  )
  jour.kcal += kcal
  parDate.set(entry.slot.date, jour)
}
for (const [date, jour] of parDate) {
  console.log(`${date}  —  ${Math.round(jour.kcal)} kcal`)
  for (const ligne of jour.lignes) console.log(`   ${ligne}`)
}

// --- Ce qu'on veut vraiment savoir : la semaine tient-elle debout ? -----------------------------
const remplis = plan.entries.filter((e) => e.recipeId !== null)
const vides = plan.entries.length - remplis.length
const distincts = new Set(remplis.map((e) => e.recipeId))
const totaux = [...parDate.values()].map((j) => j.kcal)

console.log(`\n${remplis.length} creneau(x) rempli(s) sur ${plan.entries.length}, ${vides} vide(s)`)
console.log(
  `${distincts.size} recette(s) distincte(s) — ${distincts.size === remplis.length ? 'aucun doublon' : 'DOUBLON'}`
)
console.log(
  `Energie : min ${Math.round(Math.min(...totaux))} · max ${Math.round(Math.max(...totaux))} kcal/jour ` +
    `(plancher §6.5 : 1 200 F / 1 500 H)`
)

const nonRemplis = new Map<MealSlot, number>()
for (const e of plan.entries) {
  if (e.recipeId === null) nonRemplis.set(e.slot.creneau, (nonRemplis.get(e.slot.creneau) ?? 0) + 1)
}
if (nonRemplis.size > 0) {
  console.log('\nCreneaux non remplis (le catalogue manque de candidats) :')
  for (const [creneau, n] of nonRemplis) console.log(`   ${creneau} : ${n}`)
}
