// app/src/cli/try-planning.ts — banc CLI du planning (§11.3 ENGINE), pendant de `try-engine.ts`.
//
// La question à laquelle il répond n'est PAS « le moteur suggère-t-il bien » — `try-engine` s'en
// charge — mais « ces suggestions font-elles une SEMAINE crédible ». Un plat peut être excellent
// cinq fois de suite et produire une mauvaise semaine.
//
// Usage : node --experimental-sqlite --import tsx app/src/cli/try-planning.ts [jours]

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from '../data/catalog-loader-node.js'
import { createEngine } from '../engine/api/index.js'
import { attachDerivedIndexes } from '../engine/nutrition/index.js'
import { portionsGaspillees } from '../engine/planning/plan-leftovers.js'
import type { MealSlot, RecipeId, WeekPlanRequest } from '../engine/domain/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '..', '..', 'public', 'catalog', 'catalog.db')
const catalog = attachDerivedIndexes(loadCatalog(dbPath))
const engine = createEngine(loadCatalog(dbPath))

const jours = Number(process.argv[2] ?? 7)

// TROIS créneaux : le cas qui faisait ÉCHOUER le planning avant que `checkCalorieFloor` cesse de
// lever (§6.5 — il avertit, il n'annule pas). Le banc doit exercer ce cas, pas le contourner.
const SLOTS: readonly MealSlot[] = ['petit_dejeuner', 'dejeuner', 'diner']

const req: WeekPlanRequest = {
  profile: {
    trancheAge: '30_49',
    sexe: 'F',
    niveauActivite: 'actif',
    tailleCm: 165,
    poidsKg: 62,
    facteurPortion: 1,
  },
  constraints: { allergies: [], diet: null, excludedFoodIds: [], ownedEquipmentIds: null },
  startDate: '2026-08-03',
  days: jours,
  slots: SLOTS,
  history: { windowDays: 21, entries: [] },
  activeTopics: [],
  tolerancePiquant: null,
  seed: 1,
}

const CONVIVES = Number(process.argv[3] ?? 2)
const planSansRestes = engine.planWeek(req)
const plan = engine.planLeftovers(planSansRestes, req.profile, CONVIVES)
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
    `${entry.slot.creneau.padEnd(15)} ${Math.round(kcal).toString().padStart(4)} kcal  ${nom(entry.recipeId)}` +
      (entry.isLeftover ? '   (reste)' : '')
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
// ⚠️ Les restes REPÈTENT volontairement une recette : ce n'est pas un doublon. On ne compte donc
// que les créneaux CUISINÉS pour juger de la variété.
const cuisines = remplis.filter((e) => !e.isLeftover)
const distinctsCuisines = new Set(cuisines.map((e) => e.recipeId))
console.log(
  `${distinctsCuisines.size} recette(s) cuisinee(s) distincte(s) sur ${cuisines.length} — ` +
    `${distinctsCuisines.size === cuisines.length ? 'aucun doublon' : 'DOUBLON'}`
)
console.log(
  `Energie : min ${Math.round(Math.min(...totaux))} · max ${Math.round(Math.max(...totaux))} kcal/jour ` +
    `(plancher §6.5 : 1 200 F / 1 500 H)`
)

if (plan.warnings.length > 0) {
  console.log(`
AVERTISSEMENTS (§6.5 — le plan reste utilisable, l'ecran d'avertissement s'impose) :`)
  for (const w of plan.warnings) {
    console.log(`   ${w.date} : ${w.kcal} kcal, sous le plancher de ${w.seuil}`)
  }
}

const restes = plan.entries.filter((e) => e.isLeftover).length
console.log(
  `Restes : ${restes} creneau(x) sur ${plan.entries.length} pour ${CONVIVES} convive(s) — ` +
    `portions gaspillees ${portionsGaspillees(planSansRestes, catalog, CONVIVES)} -> ${portionsGaspillees(plan, catalog, CONVIVES)}`
)

// --- Liste de courses (§7.4) ---------------------------------------------------------------
const courses = engine.buildShoppingList(plan, { joursDeCourses: 4 })
const sansRestes = engine.buildShoppingList(planSansRestes, { joursDeCourses: 4 })
const totalDe = (l: typeof courses) => l.items.reduce((s, i) => s + i.quantiteTotale, 0)

console.log(`
Liste de courses : ${courses.items.length} lignes`)
let rayonCourant = ''
let trancheCourante = -1
for (const item of courses.items) {
  if (item.tranche !== trancheCourante) {
    trancheCourante = item.tranche
    rayonCourant = ''
    console.log(`
  --- virée ${item.tranche + 1} ---`)
  }
  if (item.rayon !== rayonCourant) {
    rayonCourant = item.rayon
    console.log(`  [${item.rayon}]`)
  }
  console.log(`     ${String(item.quantiteTotale).padStart(5)} ${item.unite}  ${item.foodId}`)
}
console.log(
  `
Effet des restes sur les courses : ${Math.round(totalDe(sansRestes) / 1000)} kg -> ${Math.round(totalDe(courses) / 1000)} kg`
)

const nonRemplis = new Map<MealSlot, number>()
for (const e of plan.entries) {
  if (e.recipeId === null) nonRemplis.set(e.slot.creneau, (nonRemplis.get(e.slot.creneau) ?? 0) + 1)
}
if (nonRemplis.size > 0) {
  console.log('\nCreneaux non remplis (le catalogue manque de candidats) :')
  for (const [creneau, n] of nonRemplis) console.log(`   ${creneau} : ${n}`)
}
