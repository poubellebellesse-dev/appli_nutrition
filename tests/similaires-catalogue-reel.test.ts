// tests/similaires-catalogue-reel.test.ts — `engine.similarRecipes` sur le catalogue RÉEL.
//
// Pourquoi le catalogue réel plutôt qu'un fixture : une mesure de similarité ne prouve rien sur
// trois recettes fabriquées pour la circonstance. Ce qu'on veut savoir, c'est si « des plats qui
// ressemblent à celui-ci » ressemble vraiment à quelque chose sur 241 recettes — et surtout si le
// bandeau reste SÛR quand on déclare une allergie.
//
// Vit hors de app/src/engine/ parce qu'il importe data/catalog-loader — interdit dans engine/
// (tests/engine-boundaries.test.ts). Build vers un fichier isolé : catalog/build.test.ts
// reconstruit le catalog.db partagé en parallèle, deux builds concurrents se corrompent.

import { beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AllergenId, Catalog, RecipeId, SuggestionRequest } from '../app/src/engine/domain/index.js'
import { createEngine, type Engine } from '../app/src/engine/api/index.js'
import { makeRequest } from '../app/src/engine/selection/test-fixtures.js'
import { loadCatalog } from '../app/src/data/catalog-loader-node.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..')
const BUILD_SCRIPT = path.join(REPO_ROOT, 'catalog', 'build.mjs')

describe('engine/api — similarRecipes sur le catalogue réel', () => {
  let catalog: Catalog
  let moteur: Engine
  let requete: SuggestionRequest
  let premiere: RecipeId

  beforeAll(() => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-similaires-'))
    const dbPath = path.join(fixtureDir, 'catalog.db')
    const result = spawnSync(process.execPath, ['--experimental-sqlite', BUILD_SCRIPT, '--out', dbPath], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    catalog = loadCatalog(dbPath)
    moteur = createEngine(catalog)
    requete = makeRequest({})
    premiere = [...catalog.recipes.keys()][0]!
  })

  it('rend le nombre demandé, sans jamais inclure le plat de départ', () => {
    const proches = moteur.similarRecipes(requete, premiere, 4)
    expect(proches).toHaveLength(4)
    expect(proches).not.toContain(premiere)
    expect(new Set(proches).size).toBe(proches.length)
  })

  it('respecte la limite, y compris aux bornes', () => {
    expect(moteur.similarRecipes(requete, premiere, 0)).toEqual([])
    expect(moteur.similarRecipes(requete, premiere, -3)).toEqual([])
    expect(moteur.similarRecipes(requete, premiere, 1)).toHaveLength(1)
  })

  it('rend une liste vide pour un identifiant inconnu au lieu de lever', () => {
    // Un identifiant périmé arrive facilement d'un signet ou d'une mise à jour du catalogue —
    // c'est un cas NORMAL dans ce projet (voir l'en-tête de user-schema.ts), jamais une erreur.
    expect(moteur.similarRecipes(requete, 'plat-qui-nexiste-pas' as RecipeId, 3)).toEqual([])
  })

  it('est DÉTERMINISTE — deux appels identiques rendent le même ordre', () => {
    // Sans départage explicite, l'ordre suivrait l'itération d'un Set et le bandeau se réordonnerait
    // entre deux affichages pourtant identiques.
    expect(moteur.similarRecipes(requete, premiere, 5)).toEqual(moteur.similarRecipes(requete, premiere, 5))
  })

  it('classe par proximité DÉCROISSANTE — le 1er est au moins aussi proche que le dernier', () => {
    // La propriété qui distingue ce bandeau des autres suggestions : `suggestMeals` passe par
    // `diversify`, dont le rôle est de rendre ses résultats DIFFÉRENTS. Ici c'est l'inverse.
    const proches = moteur.similarRecipes(requete, premiere, 8)
    const premierLot = new Set(moteur.similarRecipes(requete, premiere, 3))
    // Les 3 premiers d'une demande de 8 sont exactement les 3 d'une demande de 3.
    expect(proches.slice(0, 3).every((id) => premierLot.has(id))).toBe(true)
  })

  it('N’EXPOSE JAMAIS un allergène déclaré — propriété, sur chaque allergène du catalogue', () => {
    // ⚠️ LE TEST QUI COMPTE. Un rayon « et aussi… » est exactement le genre d'endroit où un
    // garde-fou s'oublie. §5.2 ARCHITECTURE : le filtre allergènes n'est jamais contournable.
    for (const allergene of catalog.allergens.keys()) {
      const avecAllergie: SuggestionRequest = {
        ...requete,
        constraints: { ...requete.constraints, allergies: [allergene as AllergenId] },
      }
      for (const id of moteur.similarRecipes(avecAllergie, premiere, 10)) {
        const recette = catalog.recipes.get(id)!
        for (const ingredient of recette.ingredients) {
          const aliment = catalog.foods.get(ingredient.foodId)
          expect(
            aliment?.allergenes.some((a) => a.allergenId === allergene) ?? false,
            `${recette.nom} contient ${allergene}, déclaré en allergie`
          ).toBe(false)
        }
      }
    }
  })

  it('respecte aussi le régime déclaré', () => {
    const vegetalien: SuggestionRequest = {
      ...requete,
      constraints: { ...requete.constraints, diet: 'vegetalien' },
    }
    const proches = moteur.similarRecipes(vegetalien, premiere, 10)
    for (const id of proches) {
      const facettes = catalog.recipes.get(id)!.facettes
      const regime = facettes.find((f) => f.facette === 'regime')?.valeur
      expect(regime, `${id} n'est pas végétalien`).toBe('vegetalien')
    }
  })
})
