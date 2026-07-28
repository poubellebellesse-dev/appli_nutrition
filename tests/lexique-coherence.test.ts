// tests/lexique-coherence.test.ts — le lexique de gestes et les étapes qui le référencent
// (docs/ARCHITECTURE.md §4.2, §8.5).
//
// POURQUOI CE TEST. Le lien entre une étape et une fiche de geste est une chaîne de caractères dans
// un tableau JSON : rien ne le vérifie au type. Deux pourritures silencieuses sont possibles, et
// aucune ne fait échouer le build :
//   - une étape référence un code SANS FICHE → l'utilisateur clique sur un geste et n'a rien ;
//   - une fiche n'est référencée NULLE PART → du contenu écrit, maintenu, jamais montré.
//
// Le catalogue est passé de 4 gestes à 43 le 2026-07-28, et de 155 étapes annotées à 615. À cette
// échelle, une vérification à la main ne tient plus.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Catalog } from '../app/src/engine/domain/index.js'
import { loadCatalog } from '../app/src/data/catalog-loader.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..')
const BUILD_SCRIPT = path.join(REPO_ROOT, 'catalog', 'build.mjs')

describe('catalogue réel — cohérence du lexique de gestes', () => {
  let catalog: Catalog
  const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-lexique-'))
  const dbPath = path.join(fixtureDir, 'catalog.db')

  beforeAll(() => {
    const result = spawnSync(process.execPath, ['--experimental-sqlite', BUILD_SCRIPT, '--out', dbPath], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    catalog = loadCatalog(dbPath)
  })

  afterAll(() => {
    rmSync(fixtureDir, { recursive: true, force: true })
  })

  const codesConnus = () => new Set([...catalog.lexicon.values()].map((e) => e.code))
  const codesReferences = () => {
    const vus = new Set<string>()
    for (const recipe of catalog.recipes.values()) {
      for (const etape of recipe.etapes) for (const code of etape.lexiconIds) vus.add(code)
    }
    return vus
  }

  it('⛔ AUCUNE étape ne référence un geste SANS FICHE', () => {
    // L'utilisateur cliquerait sur un mot souligné et n'obtiendrait rien.
    const connus = codesConnus()
    const cassees: string[] = []
    for (const recipe of catalog.recipes.values()) {
      for (const etape of recipe.etapes) {
        for (const code of etape.lexiconIds) {
          if (!connus.has(code)) cassees.push(`« ${recipe.nom} » étape ${etape.ordre} → '${code}'`)
        }
      }
    }
    expect(cassees).toEqual([])
  })

  it('⚠️ AUCUNE fiche n’est orpheline — du contenu jamais montré est du contenu mort', () => {
    const references = codesReferences()
    const orphelines = [...codesConnus()].filter((code) => !references.has(code))

    expect(orphelines).toEqual([])
  })

  it('chaque fiche porte un terme et une définition non vides', () => {
    for (const entree of catalog.lexicon.values()) {
      expect(entree.terme.trim().length, entree.code).toBeGreaterThan(0)
      expect(entree.definition.trim().length, entree.code).toBeGreaterThan(20)
    }
  })

  it('aucun code de geste en double', () => {
    const codes = [...catalog.lexicon.values()].map((e) => e.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('la couverture reste substantielle — au moins la moitié des étapes annotées', () => {
    // Propriété plutôt que compte figé : le catalogue grossit, et un seuil exact deviendrait faux
    // au premier lot de recettes. Ce qui doit rester vrai, c'est que le lexique SERT.
    const toutes = [...catalog.recipes.values()].flatMap((r) => r.etapes)
    const annotees = toutes.filter((e) => e.lexiconIds.length > 0)

    expect(annotees.length / toutes.length).toBeGreaterThan(0.5)
  })

  it('les gestes les plus courants sont couverts', () => {
    // Garde-fou de contenu : si « émincer » disparaissait du lexique, 137 étapes perdraient leur
    // lien sans qu'aucun test de forme ne s'en aperçoive.
    const connus = codesConnus()
    for (const essentiel of ['emincer', 'revenir', 'mijoter', 'egoutter', 'eplucher', 'deglacer']) {
      expect(connus, essentiel).toContain(essentiel)
    }
  })
})
