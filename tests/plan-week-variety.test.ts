// tests/plan-week-variety.test.ts — le correctif « bande de tolérance » de `rankScoredCandidates`
// (engine/selection/scoring-pass.ts) mesuré à travers `planWeek`, sur le catalogue RÉEL.
//
// Pourquoi le catalogue réel plutôt qu'un fixture à quelques recettes : le défaut corrigé ici
// (`seed` recopié dans `EngineDiagnostics` sans influencer rien) ne se voyait qu'à l'échelle — la
// mesure d'origine, citée dans le rapport de correctif, était « 0 créneau différent sur 14 » avec le
// catalogue du dépôt. Un fixture à 6 recettes ne peut ni reproduire ni infirmer ça.
//
// Vit hors de app/src/engine/ parce qu'il importe data/catalog-loader-node — interdit dans engine/
// (tests/engine-boundaries.test.ts). Build vers un fichier isolé, même motif que les autres tests de
// ce dossier : catalog/build.test.ts reconstruit le catalog.db partagé en parallèle.

import { beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Catalog, MealSlot, WeekPlanRequest } from '../app/src/engine/domain/index.js'
import { createEngine, type Engine } from '../app/src/engine/api/index.js'
import { makeRequest } from '../app/src/engine/selection/test-fixtures.js'
import { loadCatalog } from '../app/src/data/catalog-loader-node.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..')
const BUILD_SCRIPT = path.join(REPO_ROOT, 'catalog', 'build.mjs')

function makePlanRequest(profile: WeekPlanRequest['profile'], seed: number): WeekPlanRequest {
  return {
    profile,
    constraints: { allergies: [], diet: null, excludedFoodIds: [], ownedEquipmentIds: null , admittedFoodIds: [] },
    startDate: '2026-08-03',
    days: 7,
    slots: ['petit_dejeuner', 'dejeuner', 'diner'] as readonly MealSlot[],
    history: { windowDays: 21, entries: [] },
    activeTopics: [],
  tolerancePiquant: null,
    seed,
  }
}

describe('engine/planning — planWeek : variété inter-semaine sur le catalogue réel', () => {
  let moteur: Engine
  let profile: WeekPlanRequest['profile']

  beforeAll(() => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-plan-week-variety-'))
    const dbPath = path.join(fixtureDir, 'catalog.db')
    const result = spawnSync(process.execPath, ['--experimental-sqlite', BUILD_SCRIPT, '--out', dbPath], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    const catalog: Catalog = loadCatalog(dbPath)
    moteur = createEngine(catalog)
    profile = makeRequest({}).profile
  })

  it('reproductibilité : même graine → plans strictement identiques, créneau par créneau', () => {
    const a = moteur.planWeek(makePlanRequest(profile, 42))
    const b = moteur.planWeek(makePlanRequest(profile, 42))

    expect(a.entries.map((e) => e.recipeId)).toEqual(b.entries.map((e) => e.recipeId))
  })

  it('variété : deux graines différentes changent AU MOINS 1 créneau sur 21 — le chiffre mesuré est affiché', () => {
    const a = moteur.planWeek(makePlanRequest(profile, 1))
    const b = moteur.planWeek(makePlanRequest(profile, 2))

    let creneauxDifferents = 0
    for (let i = 0; i < a.entries.length; i++) {
      if (a.entries[i]!.recipeId !== b.entries[i]!.recipeId) creneauxDifferents++
    }
    console.log(`plan-week-variety : ${creneauxDifferents} créneau(x) différent(s) sur ${a.entries.length} (seed 1 vs seed 2)`)

    expect(creneauxDifferents).toBeGreaterThanOrEqual(1)
  })
})
