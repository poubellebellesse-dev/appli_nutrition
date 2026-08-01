// tests/garde-manger-catalogue-reel.test.ts — `suggestMeals` avec un GARDE-MANGER NON VIDE.
//
// ⚠️ CE FICHIER EXISTE PARCE QUE CE CHEMIN N'ÉTAIT COUVERT PAR RIEN, ET QU'IL PLANTAIT.
//
// La couche `pantry` a été ajoutée au registre le 2026-07-28 (voir la note d'ISOLATE_NUTRI_WEIGHTS
// dans engine/api/index.test.ts, qui l'avait elle aussi oubliée). `explain.ts` était écrit avant :
// sa table de phrases restait partielle et `labelFor` LEVAIT sur une couche sans gabarit, au motif
// — écrit noir sur blanc dans son en-tête — que « pantry n'apparaît jamais dans un breakdown réel ».
// L'affirmation est devenue fausse le jour de l'implémentation, et le commentaire ne l'a pas su.
//
// Conséquence en production : dès qu'un garde-manger non vide départageait deux plats, l'exception
// traversait `suggestMeals` et l'écran « Aujourd'hui » (ui/screens/aujourdhui.tsx, qui transmet
// `pantryFoodIds`) n'affichait plus rien d'autre que le texte de l'erreur. Signalé par
// l'utilisateur, pas par la suite.
//
// Pourquoi AUCUN test ne l'a vu : les suites du moteur passent toutes `pantryFoodIds: []`. Seuls
// `scoring/pantry.test.ts` (la couche isolée, qui n'explique rien) et `shopping-list.test.ts` (un
// autre chemin entièrement) utilisaient un garde-manger réel. Le bout-en-bout n'existait pas.
//
// Pourquoi le catalogue RÉEL : c'est la seule façon d'obtenir des candidats dont la couverture par
// le garde-manger diffère réellement — condition pour que `pantry` DISCRIMINE, et donc soit citée.
// Sur trois recettes fabriquées, on choisit sans le vouloir si le défaut se reproduit ou non.
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
import type { Catalog, FoodId, ScoreWeights } from '../app/src/engine/domain/index.js'
import { createEngine, type Engine } from '../app/src/engine/api/index.js'
import { makeRequest } from '../app/src/engine/selection/test-fixtures.js'
import { EXPLANATION_LABELS } from '../app/src/engine/selection/explain.js'
import { loadCatalog } from '../app/src/data/catalog-loader-node.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..')
const BUILD_SCRIPT = path.join(REPO_ROOT, 'catalog', 'build.mjs')

/**
 * `pantry` seule au pouvoir.
 *
 * ⚠️ CE N'EST PAS UN CONFORT DE LECTURE, C'EST CE QUI REND LE TEST FIABLE. Le poids par défaut de
 * `pantry` est 0,05 (selection/index.ts) : sa contribution est si faible qu'elle n'atteint pas
 * toujours les trois plus fortes, et l'ancienne version ne levait QUE si elle y figurait
 * (`slice(0, 3)` AVANT la mise en phrase). Un test qui laisserait les poids par défaut passerait ou
 * échouerait selon le catalogue du jour — c'est-à-dire ne prouverait rien.
 */
const ISOLE_PANTRY: Partial<ScoreWeights> = {
  nutri: 0,
  preference: 0,
  craving: 0,
  variety: 0,
  season: 0,
  habit: 0,
  speed: 0,
  pantry: 1,
}

describe('engine/api — suggestMeals avec un garde-manger non vide', () => {
  let catalog: Catalog
  let moteur: Engine
  /** Des aliments présents dans BEAUCOUP de recettes, mais pas toutes : c'est ce contraste qui fait
   *  que la couche discrimine. Un garde-manger couvrant tout, ou rien, ne départagerait personne. */
  let gardeManger: readonly FoodId[]

  beforeAll(() => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-garde-manger-'))
    const dbPath = path.join(fixtureDir, 'catalog.db')
    const result = spawnSync(process.execPath, ['--experimental-sqlite', BUILD_SCRIPT, '--out', dbPath], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    catalog = loadCatalog(dbPath)
    moteur = createEngine(catalog)

    const occurrences = new Map<FoodId, number>()
    for (const recette of catalog.recipes.values()) {
      for (const ingredient of recette.ingredients) {
        occurrences.set(ingredient.foodId, (occurrences.get(ingredient.foodId) ?? 0) + 1)
      }
    }
    gardeManger = [...occurrences.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([foodId]) => foodId)
    expect(gardeManger.length).toBe(12)
  })

  const requete = (pantryFoodIds: readonly string[]) => ({
    ...makeRequest({ pantryFoodIds }),
    weights: ISOLE_PANTRY,
  })

  it('⛔ NE LÈVE PAS — le plantage que ce fichier garde', () => {
    // Avant correction : « explain.ts : aucun gabarit de phrase pour la couche 'pantry' ».
    // L'exception remontait jusqu'à l'écran, qui n'affichait plus que son texte.
    expect(() => moteur.suggestMeals(requete(gardeManger))).not.toThrow()
  })

  it('propose quand même des plats, et la couche `pantry` est bien active', () => {
    // Ne pas lever ne suffit pas : si la couche n'était pas dans le breakdown, le test précédent
    // serait vert sans jamais avoir emprunté le chemin qui plantait.
    const resultat = moteur.suggestMeals(requete(gardeManger))

    expect(resultat.suggestions.length).toBeGreaterThan(0)
    for (const suggestion of resultat.suggestions) {
      expect(suggestion.breakdown.pantry).toBeTypeOf('number')
    }
  })

  it('cite « utilise ce que vous avez déjà » quand le garde-manger départage vraiment', () => {
    const resultat = moteur.suggestMeals(requete(gardeManger))
    const phrases = resultat.suggestions.flatMap((s) => s.explanations.map((e) => e.label))

    expect(phrases).toContain(EXPLANATION_LABELS.pantry)
  })

  it('garde-manger VIDE : la couche ne départage personne, donc ne dit rien', () => {
    // Contrôle négatif. Sans lui, « la phrase apparaît » pourrait venir d'une couche citée à tort,
    // indépendamment de ce que l'utilisateur a réellement déclaré chez lui — exactement le genre
    // d'explication inventée que l'en-tête d'explain.ts interdit.
    const resultat = moteur.suggestMeals(requete([]))
    const phrases = resultat.suggestions.flatMap((s) => s.explanations.map((e) => e.label))

    expect(phrases).not.toContain(EXPLANATION_LABELS.pantry)
  })
})
