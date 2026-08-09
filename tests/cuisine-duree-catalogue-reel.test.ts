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
import { segmentsDeLaRecette } from '../app/src/engine/cuisine/segments.js'
import { ordonnancerCuissons } from '../app/src/engine/cuisine/ordonnancement.js'
import { loadCatalog } from '../app/src/data/catalog-loader-node.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..')
const BUILD_SCRIPT = path.join(REPO_ROOT, 'catalog', 'build.mjs')

let catalog: Catalog
let avecRepos: readonly Recipe[]

// Un seul build pour tout le fichier : il coûte ~2 s et les deux suites lisent le même catalogue.
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

describe('cuisine/duree — le repos existe VRAIMENT au catalogue et arrive VRAIMENT jusqu’au calcul', () => {
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

// ── L2 ────────────────────────────────────────────────────────────────────────────────────────────
//
// ⚠️ CETTE SUITE-LÀ N'EST PAS UN CONFORT, C'EST LE FILET DU LOT. `ordonnancerCuissons` LÈVE quand les
// segments ne totalisent pas la durée annoncée — une seule recette fautive fait planter l'écran
// cuisine au lieu d'afficher un plat, et le catalogue est la seule source de ces nombres. Les deux
// replis de `segments.ts` existent précisément parce que 10 recettes réelles tombaient dedans ; rien
// d'autre qu'un passage sur les 330 ne prouve qu'il n'y en a pas une onzième.

describe('cuisine/segments — le découpage tient sur les 330 recettes, sans exception', () => {
  it('⛔ AUCUNE RECETTE NE FAIT LEVER `ordonnancerCuissons` — le filet des deux replis', () => {
    const fautives: string[] = []
    for (const recette of catalog.recipes.values()) {
      try {
        ordonnancerCuissons([
          {
            recipeId: recette.id,
            nom: recette.nom,
            dureeMin: dureeEcouleeMin(recette),
            segments: segmentsDeLaRecette(recette),
          },
        ])
      } catch (erreur) {
        fautives.push(`${recette.nom} — ${(erreur as Error).message}`)
      }
    }
    expect(fautives).toEqual([])
  })

  it('un plat SEUL ne recule jamais — il n’a personne à esquiver', () => {
    // L'invariant qui rend le lot inoffensif pour l'usage le plus courant : une seule recette en
    // cuisine, et son heure de départ est celle que L1 a posée, à la minute près.
    for (const recette of catalog.recipes.values()) {
      const r = ordonnancerCuissons([
        {
          recipeId: recette.id,
          nom: recette.nom,
          dureeMin: dureeEcouleeMin(recette),
          segments: segmentsDeLaRecette(recette),
        },
      ])
      expect(r.departs[0]!.retardMin).toBe(0)
      expect(r.departs[0]!.departAvantServiceMin).toBe(dureeEcouleeMin(recette))
    }
  })

  it('le temps passif existe VRAIMENT après découpage — sinon L2 n’entrelace rien du tout', () => {
    // Le pendant, côté segments, du test « au moins une recette porte un repos chiffré » : si le
    // découpage cessait de produire du passif, tout redeviendrait un bloc plein sans un seul rouge.
    const avecPassif = [...catalog.recipes.values()].filter((r) =>
      segmentsDeLaRecette(r).some((s) => s.nature === 'passif'),
    )
    expect(avecPassif.length).toBe(avecRepos.length)
    expect(avecPassif.length).toBeGreaterThan(0)
  })

  it('⛔ DEUX PLATS RÉELS S’ENTRELACENT — le repos de l’un accueille les gestes de l’autre', () => {
    // Aucun `recipeId` en dur : on prend la recette au plus long repos et la plus courte sans repos.
    const longRepos = [...avecRepos].sort(
      (a, b) => dureeReposMin(b) - dureeReposMin(a) || (a.id < b.id ? -1 : 1),
    )[0]!
    const court = [...catalog.recipes.values()]
      .filter((r) => dureeReposMin(r) === 0)
      .sort((a, b) => dureeEcouleeMin(a) - dureeEcouleeMin(b) || (a.id < b.id ? -1 : 1))[0]!

    const entree = [longRepos, court].map((r) => ({
      recipeId: r.id,
      nom: r.nom,
      dureeMin: dureeEcouleeMin(r),
      segments: segmentsDeLaRecette(r),
    }))

    const decoupe = ordonnancerCuissons(entree)
    // Le même appel en traitant le plat à repos comme un bloc plein — l'état d'avant L2.
    const bloc = ordonnancerCuissons(
      entree.map((c) => ({ ...c, segments: [{ ordre: 0, nature: 'actif' as const, dureeMin: c.dureeMin }] })),
    )

    const depart = (o: typeof decoupe, id: string): number =>
      o.departs.find((d) => d.recipeId === id)!.departAvantServiceMin

    expect(depart(decoupe, court.id)).toBeLessThan(depart(bloc, court.id))
    expect(depart(decoupe, longRepos.id)).toBe(dureeEcouleeMin(longRepos))
  })
})
