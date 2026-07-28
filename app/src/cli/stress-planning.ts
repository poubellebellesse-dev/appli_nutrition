// app/src/cli/stress-planning.ts — banc de STRESS du planning (`npm run engine:plan-stress`).
//
// Met `planWeek` sous contrainte sur le catalogue RÉEL, à travers 20 configurations plutôt qu'une
// seule. Ce n'est pas un doublon des tests unitaires : ceux-ci vérifient la logique du glouton avec
// une suggestion factice, celui-ci exerce le VRAI pipeline sur les VRAIES données.
//
// ⚠️ IL A DÉJÀ TROUVÉ UN BUG que la suite de tests ne pouvait pas voir : `slotRequest` ne fixait pas
// `limit`, donc `suggestMeals` ne rendait que 5 candidats et un créneau restait vide dès que ces 5
// étaient déjà placés. Invisible avec une suggestion factice, flagrant sur 14 jours réels
// (39 créneaux remplis sur 42). Garder ce banc, et le relancer après toute modification du glouton.
//
// Ce qu'on cherche : un plantage, un doublon, un créneau vide inexpliqué, un non-déterminisme, ou
// un régime/allergène qui vide le catalogue sans que rien ne le dise.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from '../data/catalog-loader.js'
import { createEngine } from '../engine/api/index.js'
import { attachDerivedIndexes } from '../engine/nutrition/index.js'
import type { AllergenId, DietCode, MealSlot, UserProfile, WeekPlanRequest } from '../engine/domain/index.js'

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
const HOMME: UserProfile = { ...FEMME, sexe: 'M', tailleCm: 178, poidsKg: 78 }
const SENIOR: UserProfile = { ...FEMME, trancheAge: '65_plus', niveauActivite: 'sedentaire' }

function req(o: Partial<WeekPlanRequest> = {}): WeekPlanRequest {
  return {
    profile: FEMME,
    constraints: { allergies: [], diet: null, excludedFoodIds: [] },
    startDate: '2026-08-03',
    days: 7,
    slots: ['petit_dejeuner', 'dejeuner', 'diner'],
    history: { windowDays: 21, entries: [] },
    activeTopics: [],
    seed: 1,
    ...o,
  }
}

interface Verdict {
  readonly nom: string
  readonly ok: boolean
  readonly detail: string
}

const verdicts: Verdict[] = []

function essai(nom: string, r: WeekPlanRequest): void {
  let plan
  try {
    plan = engine.planWeek(r)
  } catch (error) {
    verdicts.push({ nom, ok: false, detail: `PLANTAGE — ${(error as Error).message.slice(0, 90)}` })
    return
  }

  const remplis = plan.entries.filter((e) => e.recipeId !== null)
  const distincts = new Set(remplis.map((e) => e.recipeId))
  const attendus = r.days * r.slots.length

  const problemes: string[] = []
  if (plan.entries.length !== attendus) problemes.push(`${plan.entries.length} créneaux au lieu de ${attendus}`)
  if (distincts.size !== remplis.length) problemes.push(`DOUBLON (${remplis.length - distincts.size})`)

  // Déterminisme : deux appels identiques doivent rendre le même plan.
  const bis = engine.planWeek(r)
  const memeOrdre = bis.entries.every((e, i) => e.recipeId === plan.entries[i]?.recipeId)
  if (!memeOrdre) problemes.push('NON DÉTERMINISTE')

  const vides = plan.entries.length - remplis.length
  const kcalParJour = new Map<string, number>()
  for (const e of plan.entries) {
    const k = e.recipeId === null ? 0 : (catalog.indexes.recipeNutrients.get(e.recipeId)?.[energyIndex] ?? 0)
    kcalParJour.set(e.slot.date, (kcalParJour.get(e.slot.date) ?? 0) + k)
  }
  const totaux = [...kcalParJour.values()]
  const min = totaux.length === 0 ? 0 : Math.round(Math.min(...totaux))

  verdicts.push({
    nom,
    ok: problemes.length === 0,
    detail:
      problemes.length > 0
        ? problemes.join(' · ')
        : `${remplis.length}/${attendus} remplis${vides > 0 ? `, ${vides} vide(s)` : ''}` +
          ` · ${distincts.size} distinctes · min ${min} kcal · ${plan.warnings.length} avert.`,
  })
}

// --- Fenêtre ------------------------------------------------------------------------------------
essai('2 jours (minimum §7.1)', req({ days: 2 }))
essai('7 jours', req({ days: 7 }))
essai('14 jours (maximum §7.1)', req({ days: 14 }))

// --- Créneaux -----------------------------------------------------------------------------------
essai('1 créneau (dîner seul)', req({ slots: ['diner'], days: 14 }))
essai('2 créneaux', req({ slots: ['dejeuner', 'diner'], days: 14 }))
essai('4 créneaux', req({ slots: ['petit_dejeuner', 'dejeuner', 'gouter', 'diner'], days: 14 }))
essai('petit-déjeuner seul, 14 j (17 recettes dispo)', req({ slots: ['petit_dejeuner'], days: 14 }))

// --- Profils ------------------------------------------------------------------------------------
essai('homme', req({ profile: HOMME }))
essai('senior sédentaire', req({ profile: SENIOR }))

// --- Régimes ------------------------------------------------------------------------------------
for (const diet of ['omnivore', 'pescetarien', 'vegetarien', 'vegetalien'] as DietCode[]) {
  essai(`régime ${diet}, 14 j × 3`, req({ days: 14, constraints: { allergies: [], diet, excludedFoodIds: [] } }))
}

// --- Allergènes ---------------------------------------------------------------------------------
essai('sans gluten', req({ days: 7, constraints: { allergies: ['gluten' as AllergenId], diet: null, excludedFoodIds: [] } }))
essai('sans lait', req({ days: 7, constraints: { allergies: ['lait' as AllergenId], diet: null, excludedFoodIds: [] } }))
essai(
  'sans gluten NI lait NI œuf',
  req({ days: 7, constraints: { allergies: ['gluten', 'lait', 'oeuf'] as AllergenId[], diet: null, excludedFoodIds: [] } })
)

// --- Cumul le plus dur --------------------------------------------------------------------------
essai(
  'végétalien + sans gluten, 14 j × 4',
  req({
    days: 14,
    slots: ['petit_dejeuner', 'dejeuner', 'gouter', 'diner'],
    constraints: { allergies: ['gluten' as AllergenId], diet: 'vegetalien', excludedFoodIds: [] },
  })
)

// --- Historique pré-rempli ----------------------------------------------------------------------
const dejaVu = [...catalog.recipes.keys()].slice(0, 30)
essai(
  'historique de 30 repas récents',
  req({
    history: {
      windowDays: 21,
      entries: dejaVu.map((recipeId, i) => ({
        recipeId,
        date: `2026-07-${String(10 + (i % 20)).padStart(2, '0')}`,
        creneau: 'diner' as MealSlot,
        origine: 'choisi' as const,
      })),
    },
  })
)

// --- Bornes refusées ----------------------------------------------------------------------------
for (const [nom, jours] of [
  ['1 jour → doit REFUSER', 1],
  ['15 jours → doit REFUSER', 15],
] as const) {
  try {
    engine.planWeek(req({ days: jours }))
    verdicts.push({ nom, ok: false, detail: 'accepté alors qu’il devait être refusé' })
  } catch (error) {
    verdicts.push({ nom, ok: error instanceof RangeError, detail: `${(error as Error).constructor.name}` })
  }
}

// --- Rapport ------------------------------------------------------------------------------------
console.log('Configuration                                    verdict  detail')
console.log('-'.repeat(110))
for (const v of verdicts) {
  console.log(`${v.nom.padEnd(48)} ${(v.ok ? 'OK ' : 'KO ').padEnd(8)} ${v.detail}`)
}
const echecs = verdicts.filter((v) => !v.ok)
console.log('-'.repeat(110))
console.log(`${verdicts.length - echecs.length}/${verdicts.length} configurations saines`)
if (echecs.length > 0) process.exitCode = 1
