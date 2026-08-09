// tests/cuisine-duree-catalogue-reel.test.ts — la durée écoulée, sur le catalogue RÉEL.
//
// ⚠️ CE FICHIER EXISTE POUR UNE RAISON PRÉCISE : `dureeEcouleeMin` lit `Recipe.etapes[].timerType`,
// et un champ DÉCLARÉ n'est pas un champ BRANCHÉ — le piège le plus cher du dépôt, quatre occurrences
// déjà payées. Une fixture montée à la main prouverait l'addition et RIEN de la chaîne : si le
// loader cessait de remplir `timerType`, ou si le build cessait de l'écrire, `dureeEcouleeMin`
// rendrait sagement la durée active pour toutes les recettes et aucun test pur ne bougerait.
//
// Vit hors de `app/src/engine/` parce qu'il importe `data/catalog-loader` — interdit dans `engine/`
// (`tests/engine-boundaries.test.ts`). Build vers un fichier isolé : `catalog/build.test.ts`
// reconstruit le `catalog.db` partagé en parallèle, et deux builds concurrents se corrompent.

import { beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Catalog, Recipe } from '../app/src/engine/domain/index.js'
import { dureeActiveMin, dureeEcouleeMin, dureeReposMin } from '../app/src/engine/cuisine/duree.js'
import { loadCatalog } from '../app/src/data/catalog-loader-node.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..')
const BUILD_SCRIPT = path.join(REPO_ROOT, 'catalog', 'build.mjs')

describe('cuisine/duree — le repos existe VRAIMENT au catalogue et arrive VRAIMENT jusqu’au calcul', () => {
  let catalog: Catalog
  let avecRepos: readonly Recipe[]

  beforeAll(() => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-duree-'))
    const dbPath = path.join(fixtureDir, 'catalog.db')
    const result = spawnSync(process.execPath, ['--experimental-sqlite', BUILD_SCRIPT, '--out', dbPath], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    catalog = loadCatalog(dbPath)
    avecRepos = [...catalog.recipes.values()].filter((r) => dureeReposMin(r) > 0)
  })

  it('⛔ AU MOINS UNE RECETTE PORTE UN REPOS CHIFFRÉ — sinon la chaîne est coupée quelque part', () => {
    // Le test qui attrape une régression de build ou de loader. Zéro ici ne voudrait pas dire
    // « le catalogue a changé d'avis », mais « plus personne ne transporte `timer_type` ».
    expect(avecRepos.length).toBeGreaterThan(0)
  })

  it('un repos long DÉPLACE réellement la durée, d’au moins une heure sur plusieurs recettes', () => {
    // ⚠️ Aucun `recipeId` en dur, et aucun nombre exact : le catalogue est éditorial, il bouge à
    // chaque lot de contenu. Ce qui doit rester vrai est la FORME du défaut réparé — il existe des
    // recettes dont l'heure de départ recule de plus d'une heure.
    const grosRepos = avecRepos.filter((r) => dureeEcouleeMin(r) - dureeActiveMin(r) >= 60)
    expect(grosRepos.length).toBeGreaterThanOrEqual(5)
  })

  it('⛔ AUCUNE recette ne voit sa durée écoulée passer SOUS sa durée active', () => {
    for (const recette of catalog.recipes.values()) {
      expect(dureeEcouleeMin(recette)).toBeGreaterThanOrEqual(dureeActiveMin(recette))
    }
  })

  it('toutes les durées écoulées restent finies et positives — `ordonnancerCuissons` les REJETTE sinon', () => {
    // Le module lève sur une durée non finie ou négative. Une seule recette fautive ferait planter
    // l'écran cuisine au lieu d'afficher un plat, et le catalogue est la seule source de ces nombres.
    for (const recette of catalog.recipes.values()) {
      const ecoulee = dureeEcouleeMin(recette)
      expect(Number.isFinite(ecoulee)).toBe(true)
      expect(ecoulee).toBeGreaterThanOrEqual(0)
    }
  })

  it('les recettes SANS repos ne bougent pas d’une minute — le correctif ne déplace qu’elles', () => {
    const sansRepos = [...catalog.recipes.values()].filter((r) => dureeReposMin(r) === 0)
    expect(sansRepos.length).toBeGreaterThan(0)
    for (const recette of sansRepos) {
      expect(dureeEcouleeMin(recette)).toBe(dureeActiveMin(recette))
    }
  })
})
