// app/src/cli/diag-plancher.ts — banc du PLANCHER CALORIQUE (`npm run engine:plancher`).
//
// ⚠️ POURQUOI CE BANC EXISTE, ET C'EST UNE LEÇON PAYÉE. La décision 34 d'`ETAT.md` a consigné
// « 1 208 kcal minimum, ZÉRO avertissement » comme un ACQUIS du moteur. C'était une mesure sur UNE
// graine. Elle est devenue fausse sans que rien n'échoue — ni test, ni typecheck, ni `plan-stress`,
// qui affiche 20/20 configurations SAINES pendant que quatre journées sur sept passent sous le
// plancher. Le chiffre a ensuite servi à justifier de masquer une alerte de sécurité (décision 45).
//
// Ce banc balaie VINGT graines sur la même configuration et affiche la dispersion. La question qu'il
// répond n'est pas « combien de kcal » mais « est-ce une PROPRIÉTÉ, ou un tirage heureux ? ».
// ⚠️ Une seule graine ne prouve rien sur ce moteur : le classement est reproductible à graine égale,
// pas déterministe d'une graine à l'autre.
//
// Il détaille aussi la composition des journées (le SERVICE de chaque recette placée, pas seulement
// son nom) — c'est ce qui a montré que `planWeek` remplit des repas principaux avec des entrées et
// des accompagnements, faute de lire `Recipe.service`.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from '../data/catalog-loader-node.js'
import { createEngine } from '../engine/api/index.js'
import { attachDerivedIndexes } from '../engine/nutrition/index.js'
import type { MealSlot, RecipeId, UserProfile, WeekPlanRequest } from '../engine/domain/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '..', '..', 'public', 'catalog', 'catalog.db')
const catalog = attachDerivedIndexes(loadCatalog(dbPath))
const engine = createEngine(loadCatalog(dbPath))
const energyIndex = catalog.nutrients.findIndex((n) => n.code === 'energie')

const FEMME: UserProfile = {
  trancheAge: '30_49',
  sexe: 'F',
  niveauActivite: 'actif',
  tailleCm: 165,
  poidsKg: 62,
  facteurPortion: 1,
}

const CRENEAUX: readonly MealSlot[] = ['petit_dejeuner', 'dejeuner', 'diner']

const req: WeekPlanRequest = {
  profile: FEMME,
  constraints: { allergies: [], diet: null, excludedFoodIds: [], ownedEquipmentIds: null },
  startDate: '2026-08-03',
  days: 7,
  slots: CRENEAUX,
  history: { windowDays: 21, entries: [] },
  activeTopics: [],
  tolerancePiquant: null,
  seed: 1,
}

const kcal = (id: RecipeId | null): number =>
  id === null ? 0 : Math.round(catalog.indexes.recipeNutrients.get(id)?.[energyIndex] ?? 0)
const nom = (id: RecipeId | null): string => (id === null ? '(vide)' : (catalog.recipes.get(id)?.nom ?? id))
const service = (id: RecipeId | null): string =>
  id === null ? '—' : String((catalog.recipes.get(id) as { service?: unknown } | undefined)?.service ?? '?')

const plan = engine.planWeek(req)

const parJour = new Map<string, { creneau: MealSlot; recipeId: RecipeId | null }[]>()
for (const e of plan.entries) {
  const ligne = parJour.get(e.slot.date) ?? []
  ligne.push({ creneau: e.slot.creneau, recipeId: e.recipeId })
  parJour.set(e.slot.date, ligne)
}

console.log('jour         total   plats placés (kcal/portion)')
console.log('-'.repeat(118))
for (const [date, entries] of parJour) {
  const total = entries.reduce((s, e) => s + kcal(e.recipeId), 0)
  console.log(
    `${date}${total < 1200 ? ' ⛔' : '   '} ${String(total).padStart(5)}   ` +
      entries.map((e) => `${nom(e.recipeId)} [${service(e.recipeId)}] (${kcal(e.recipeId)})`).join(' · ')
  )
}

// LA question : le planificateur place-t-il des ACCOMPAGNEMENTS et des ENTRÉES dans les créneaux
// de repas principaux, comme s'il s'agissait de plats ?
const parService = new Map<string, number>()
for (const e of plan.entries) {
  if (e.recipeId === null || !['dejeuner', 'diner'].includes(e.slot.creneau)) continue
  const s = service(e.recipeId)
  parService.set(s, (parService.get(s) ?? 0) + 1)
}
console.log('\nservice des recettes placées en DÉJEUNER et DÎNER (14 créneaux) :')
for (const [s, n] of [...parService].sort((a, b) => b[1] - a[1])) console.log(`  ${s.padEnd(16)} ${n}`)

const parServiceCat = new Map<string, number[]>()
for (const r of catalog.recipes.values()) {
  const s = service(r.id)
  parServiceCat.set(s, [...(parServiceCat.get(s) ?? []), kcal(r.id)])
}
console.log('\ncatalogue par service :  n   médiane kcal/portion')
for (const [s, v] of [...parServiceCat].sort((a, b) => b[1].length - a[1].length)) {
  const t = v.slice().sort((a, b) => a - b)
  console.log(`  ${s.padEnd(16)} ${String(t.length).padStart(3)}   ${t[Math.floor(t.length / 2)]}`)
}
// LA CONTREPARTIE DE L'EXEMPTION. Un accompagnement échappe à `placedRecipeIds` pour que le riz
// puisse revenir ; seul `variety` l'empêche alors de revenir SEPT FOIS. Ce compte est la seule
// façon de voir que la protection restante tient — sans lui, la monotonie passerait tous les tests.
const repetitions = new Map<string, number>()
for (const e of plan.entries) {
  if (e.service !== 'accompagnement' || e.recipeId === null) continue
  repetitions.set(nom(e.recipeId), (repetitions.get(nom(e.recipeId)) ?? 0) + 1)
}
console.log(`\nrépétition des accompagnements sur la semaine (${[...repetitions.values()].reduce((s, n) => s + n, 0)} posés) :`)
for (const [n, c] of [...repetitions].sort((a, b) => b[1] - a[1])) console.log(`  ${String(c).padStart(2)}×  ${n}`)

console.log(`\navertissements rendus par checkCalorieFloor : ${plan.warnings.length}`)

// Le vivier : que POURRAIT-ON placer au mieux ? Si le catalogue offre largement de quoi tenir
// 1 200 kcal, la cause est le CLASSEMENT. Sinon, c'est le CONTENU.
const parCreneau = new Map<MealSlot, number[]>()
for (const r of catalog.recipes.values()) {
  const e = kcal(r.id)
  for (const c of r.typesRepas) parCreneau.set(c, [...(parCreneau.get(c) ?? []), e])
}

console.log('\nvivier par créneau (kcal/portion)   n   médiane   max')
let sommeMedianes = 0
let sommeMax = 0
for (const c of CRENEAUX) {
  const v = (parCreneau.get(c) ?? []).slice().sort((a, b) => a - b)
  const med = v[Math.floor(v.length / 2)] ?? 0
  const max = v[v.length - 1] ?? 0
  sommeMedianes += med
  sommeMax += max
  console.log(`  ${c.padEnd(30)} ${String(v.length).padStart(3)}   ${String(med).padStart(7)}   ${max}`)
}
console.log(`  ${'journée à la MÉDIANE'.padEnd(30)}       ${String(sommeMedianes).padStart(7)}`)
console.log(`  ${'journée au MAXIMUM'.padEnd(30)}       ${String(sommeMax).padStart(7)}`)

// Combien de recettes NON-PLAT se déclarent éligibles à un repas principal ? C'est la surface du
// défaut : le planificateur ne lit pas `service`, il ne lit que `typesRepas`.
console.log('\néligibles à déjeuner/dîner, par service :')
const eligibles = new Map<string, number[]>()
for (const r of catalog.recipes.values()) {
  if (!r.typesRepas.some((c) => c === 'dejeuner' || c === 'diner')) continue
  const s = service(r.id)
  eligibles.set(s, [...(eligibles.get(s) ?? []), kcal(r.id)])
}
let totalEligibles = 0
for (const [s, v] of [...eligibles].sort((a, b) => b[1].length - a[1].length)) {
  const t = v.slice().sort((a, b) => a - b)
  totalEligibles += t.length
  console.log(`  ${s.padEnd(16)} ${String(t.length).padStart(3)}   médiane ${t[Math.floor(t.length / 2)]} kcal`)
}
const nonPlat = totalEligibles - (eligibles.get('plat')?.length ?? 0)
console.log(
  `  → ${nonPlat} recettes sur ${totalEligibles} (${Math.round((100 * nonPlat) / totalEligibles)} %) ` +
    `peuvent remplir un repas principal SANS être un plat`
)

// La question qui tranche : « 1 208 kcal / 0 avertissement » était-il une PROPRIÉTÉ du moteur, ou
// le tirage d'une graine heureuse ? Vingt graines sur la MÊME configuration nominale.
console.log('\ngraine   min kcal   avert.')
const mins: number[] = []
let sansAvert = 0
for (let seed = 1; seed <= 20; seed++) {
  const p = engine.planWeek({ ...req, seed })
  const totaux = new Map<string, number>()
  for (const e of p.entries) totaux.set(e.slot.date, (totaux.get(e.slot.date) ?? 0) + kcal(e.recipeId))
  const min = Math.min(...totaux.values())
  mins.push(min)
  if (p.warnings.length === 0) sansAvert++
  console.log(`  ${String(seed).padStart(4)}   ${String(min).padStart(8)}   ${p.warnings.length}`)
}
mins.sort((a, b) => a - b)
console.log(
  `\n20 graines : min ${mins[0]} · médiane ${mins[10]} · max ${mins[19]} — ` +
    `${sansAvert}/20 sans aucun avertissement`
)
