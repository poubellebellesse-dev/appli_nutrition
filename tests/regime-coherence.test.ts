// tests/regime-coherence.test.ts — l'étiquette `regime` de chaque recette correspond-elle à ses
// INGRÉDIENTS ? (docs/ETAT.md décision 28, §6.3 ter ENGINE)
//
// POURQUOI CE TEST EXISTE. Un bug réel, trouvé le 2026-07-28 en cherchant des effets de bord :
// « Tofu laqué à la sauce soja et au sésame » se déclarait `vegetalien` et contenait du MIEL. Rien
// n'échouait — un utilisateur végétalien se voyait simplement proposer un produit animal, ce qui
// est la promesse centrale de l'appli en défaut.
//
// C'est le mode de défaillance SILENCIEUX que la décision 28 reprochait aux étiquettes multiples.
// L'étiquette unique ne l'élimine pas : elle le déplace. Seule une vérification contre les
// ingrédients le rattrape, et elle doit tourner à chaque build, pas une fois.
//
// Le même balayage a trouvé 6 recettes étiquetées `vegetarien` alors qu'elles sont végétaliennes —
// défaut inverse, silencieux lui aussi : la recette disparaît des suggestions de qui pourrait la
// manger, sans que rien ne le signale.
//
// Ce fichier vit hors de app/src/engine/ parce qu'il charge le vrai catalog.db via data/ — import
// interdit à l'intérieur de engine/ (tests/engine-boundaries.test.ts).

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Catalog, DietCode, Food, FoodId, Recipe } from '../app/src/engine/domain/index.js'
import { resolveAnimalOrigin, resolveAnimalProvenance } from '../app/src/engine/domain/index.js'
import { DIET_CHAIN, regimeExigePar, regimeExigeParIngredients } from '../app/src/engine/selection/index.js'
import { loadCatalog } from '../app/src/data/catalog-loader-node.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..')
const BUILD_SCRIPT = path.join(REPO_ROOT, 'catalog', 'build.mjs')

// ⚠️ LA RÈGLE ORIGINE → RÉGIME A ÉTÉ PROMUE EN CODE DE PRODUCTION (, dans
// engine/selection/regime.ts). Elle ne vivait ici que comme oracle de test — ce qui suffisait tant
// que seul le catalogue, étiqueté à la main, existait. Les recettes composées par l'utilisateur
// n'ont personne pour les étiqueter : sans dérivation en production, un plat au poisson serait
// proposé à un végétarien.
//
// Ce fichier garde tout son sens : il confronte les étiquettes ÉCRITES À LA MAIN dans les sources
// du catalogue à la règle. Il ne teste pas la règle contre elle-même.

const rang = (diet: string) => DIET_CHAIN.indexOf(diet as DietCode)

/**
 * Régime minimal imposé par les ingrédients, avec l'aliment qui l'impose.
 *
 * ⚠️ `diet` VIENT DE LA FONCTION DE PRODUCTION, IL N'EST PLUS RECALCULÉ ICI (lot D1). L'oracle
 * réimplémentait la boucle et rendait `vegetalien` quand aucun ingrédient n'était connu, là où
 * `regimeExigeParIngredients` rend `omnivore` — le plus permissif, donc le plus restrictif à
 * l'usage : en cas d'ignorance on n'affirme rien. Zéro recette concernée aujourd'hui (0 recette
 * sans ingrédient connu, 0 ingrédient orphelin), mais la divergence rendait approximative la seule
 * phrase dont P3 dépend : **la garantie de P3 est celle de ce test**. Elle ne l'est littéralement
 * que si les deux codes sont le même.
 *
 * ⚠️ `coupable` NE SERT QU'AU MESSAGE D'ÉCHEC, et c'est pourquoi il est calculé à part : nommer
 * l'aliment fautif est un service de lisibilité, pas une seconde source de vérité. Il ne participe
 * à aucune assertion.
 */
function exigenceRecette(recipe: Recipe, catalog: Catalog): { diet: DietCode; coupable: string } {
  const diet = regimeExigeParIngredients(
    recipe.ingredients.map((ingredient) => ingredient.foodId),
    catalog.foods
  )

  let coupable = '—'
  let rangCoupable = rang('vegetalien')
  for (const ingredient of recipe.ingredients) {
    const food = catalog.foods.get(ingredient.foodId)
    if (food === undefined) continue
    const exigence = regimeExigePar(food, catalog.foods)
    if (rang(exigence) > rangCoupable) {
      rangCoupable = rang(exigence)
      coupable = food.nom
    }
  }
  return { diet, coupable }
}

describe('catalogue réel — cohérence entre l’étiquette `regime` et les ingrédients', () => {
  let catalog: Catalog
  const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-regime-'))
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

  it('⛔ AUCUNE recette n’est étiquetée PLUS PERMISSIVE que ses ingrédients', () => {
    // Le défaut grave : un végétalien à qui l'on propose du miel, un végétarien à qui l'on propose
    // du poisson. C'est le bug réel qui a motivé ce fichier.
    const fautives: string[] = []
    for (const recipe of catalog.recipes.values()) {
      const declare = recipe.facettes.find((f) => f.facette === 'regime')?.valeur
      if (declare === undefined || rang(declare) < 0) continue
      const { diet, coupable } = exigenceRecette(recipe, catalog)
      if (rang(declare) < rang(diet)) {
        fautives.push(`« ${recipe.nom} » déclare ${declare} mais contient ${coupable} (exige ${diet})`)
      }
    }
    expect(fautives).toEqual([])
  })

  it('⚠️ AUCUNE recette n’est étiquetée plus RESTRICTIVE que nécessaire', () => {
    // Défaut inverse et silencieux : la recette disparaît des suggestions de qui pourrait la manger.
    // Six recettes végétaliennes étaient étiquetées `vegetarien` avant la correction du 2026-07-28.
    const fautives: string[] = []
    for (const recipe of catalog.recipes.values()) {
      const declare = recipe.facettes.find((f) => f.facette === 'regime')?.valeur
      if (declare === undefined || rang(declare) < 0) continue
      const { diet } = exigenceRecette(recipe, catalog)
      if (rang(declare) > rang(diet)) fautives.push(`« ${recipe.nom} » déclare ${declare}, pourrait être ${diet}`)
    }
    expect(fautives).toEqual([])
  })

  it('chaque recette porte EXACTEMENT une étiquette de régime', () => {
    // Décision 28 : une recette déclare UN SEUL régime, le plus restrictif qu'elle respecte. Zéro
    // étiquette la rend invisible à tout filtre de régime ; deux rouvrent le mode de défaillance
    // que la hiérarchie `DIET_CHAIN` existe pour éviter.
    for (const recipe of catalog.recipes.values()) {
      const regimes = recipe.facettes.filter((f) => f.facette === 'regime')
      expect(regimes, `« ${recipe.nom} »`).toHaveLength(1)
    }
  })
})

describe('catalogue réel — la chaîne `deriveDe` (origine animale en cascade)', () => {
  let catalog: Catalog
  const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-origine-'))
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

  it('LE CAS QUI MOTIVE LA CASCADE : le beurre vient d’un mammifère sans le déclarer', () => {
    const beurre = catalog.foods.get('beurre_doux' as FoodId)!

    expect(beurre.groupe).toBe('matières grasses') // aucun groupe animal
    expect(beurre.origineAnimale).toBeNull() // il ne déclare rien lui-même
    expect(beurre.deriveDe).toBe('lait_entier')
    expect(resolveAnimalOrigin(beurre, catalog.foods)).toBe('mammifere') // et pourtant
  })

  it('le miel est un produit d’INSECTE, invisible pour qui regarde son groupe', () => {
    // C'est lui qui a fait passer « Tofu laqué » pour végétalien : « produits sucrés ».
    const miel = catalog.foods.get('miel' as FoodId)!

    expect(miel.groupe).toBe('produits sucrés')
    expect(resolveAnimalOrigin(miel, catalog.foods)).toBe('insecte')
  })

  it('une boisson végétale reste VÉGÉTALE malgré son groupe « lait et produits laitiers »', () => {
    // Le défaut inverse : le groupe suggère l'animal là où il n'y en a pas.
    for (const id of ['boisson_soja', 'boisson_amande', 'boisson_avoine'] as FoodId[]) {
      const food = catalog.foods.get(id)!
      expect(food.groupe).toBe('lait et produits laitiers')
      expect(resolveAnimalOrigin(food, catalog.foods)).toBeNull()
    }
  })

  it('tout aliment d’un groupe animal a une origine résolue — aucun oubli', () => {
    const GROUPES_ANIMAUX = new Set(['viandes', 'poissons', 'fruits de mer', 'œufs'])
    const oublies = [...catalog.foods.values()]
      .filter((f) => GROUPES_ANIMAUX.has(f.groupe) && resolveAnimalOrigin(f, catalog.foods) === null)
      .map((f) => f.id)

    expect(oublies).toEqual([])
  })

  it('toute chaîne `deriveDe` pointe vers un aliment EXISTANT et se termine', () => {
    // Une chaîne rompue rendrait `null` en silence, donc « végétal » — exactement le mode de
    // défaillance que ce champ existe pour supprimer.
    for (const food of catalog.foods.values()) {
      if (food.deriveDe === null) continue
      expect(catalog.foods.has(food.deriveDe), `${food.id} → ${food.deriveDe}`).toBe(true)
      // Se termine : la résolution ne boucle pas et rend une origine déclarée.
      expect(resolveAnimalOrigin(food, catalog.foods)).not.toBeNull()
    }
  })

  it('⛔ LES SIX QUI PASSAIENT POUR VÉGÉTARIENS — sur le catalogue réel', () => {
    // Le défaut du 2026-08-10 : `regimeExigePar` lisait `food.groupe`, et « mammifère hors groupe
    // viandes » valait végétarien. Aucune recette du catalogue ne les employait — `sauce-poivre`
    // avait même CONTOURNÉ le défaut en prenant du bouillon de légumes, commentaire à l'appui — donc
    // les deux tests de cohérence ci-dessus ne pouvaient rien voir. Celui-ci porte sur les aliments
    // eux-mêmes, pas sur les recettes, et c'est pour ça qu'il existe.
    for (const id of [
      'bouillon_boeuf',
      'bouillon_volaille',
      'gelatine',
      'saindoux',
      'graisse_canard',
      'guimauve',
    ] as FoodId[]) {
      const food = catalog.foods.get(id)!
      expect(food.groupe, `${id} — le piège est justement qu'il n'est PAS en « viandes »`).not.toBe('viandes')
      expect(resolveAnimalProvenance(food, catalog.foods), id).toBe('corps')
      expect(regimeExigePar(food, catalog.foods), id).toBe('omnivore')
    }
  })

  it('le lait, l’œuf et le miel restent végétariens — la non-régression qui compte', () => {
    for (const id of ['lait_entier', 'oeuf', 'miel', 'chocolat_lait', 'meringue'] as FoodId[]) {
      expect(regimeExigePar(catalog.foods.get(id)!, catalog.foods), id).toBe('vegetarien')
    }
    // Et le beurre, qui ne déclare RIEN : il tient `production` de `lait_entier` par la cascade.
    const beurre = catalog.foods.get('beurre_doux' as FoodId)!
    expect(beurre.origineAnimale).toBeNull()
    expect(resolveAnimalProvenance(beurre, catalog.foods)).toBe('production')
    expect(regimeExigePar(beurre, catalog.foods)).toBe('vegetarien')
  })

  it('provenance et origine arrivent ENSEMBLE ou pas du tout, après SQLite et le chargeur', () => {
    // L'invariant qui rend la couche sûre. Depuis le lot 66 le TYPE l'impose — mais le type ne dit
    // rien de ce que le CHARGEUR fabrique à partir de deux colonnes SQL toujours séparées, et c'est
    // là que ce test garde tout son sens : « un champ déclaré n'est pas un champ branché ».
    // Un chargeur qui ne testerait que `origine_animale` et prendrait la provenance telle quelle
    // produirait ici une moitié de paire, sans que `tsc` n'ait rien à redire.
    const incoherents = [...catalog.foods.values()]
      .filter((f) => f.origineAnimale !== null)
      .filter((f) => f.origineAnimale?.origine == null || f.origineAnimale.provenance == null)
      .map((f) => `${f.id} : ${JSON.stringify(f.origineAnimale)}`)

    expect(incoherents).toEqual([])
  })

  it('tout aliment d’origine mammifère ou volaille a une provenance résolue — aucun oubli', () => {
    // Le pendant exact du test d'origine ci-dessus. Sans provenance, la branche rend `omnivore` :
    // pas de faille de sécurité, mais un aliment qui disparaît des suggestions végétariennes sans
    // que rien ne rougisse — le mode de défaillance silencieux que ce catalogue traque partout.
    const oublies = [...catalog.foods.values()]
      .filter((f) => {
        const origine = resolveAnimalOrigin(f, catalog.foods)
        return (origine === 'mammifere' || origine === 'volaille') &&
          resolveAnimalProvenance(f, catalog.foods) === null
      })
      .map((f) => f.id)

    expect(oublies).toEqual([])
  })

  it('un cycle ne fait pas boucler la résolution — garde défensive', () => {
    // Le build refuse les cycles, mais `resolveAnimalOrigin` est appelable sur d'autres données.
    const a = { ...catalog.foods.get('beurre_doux' as FoodId)!, id: 'a' as FoodId, deriveDe: 'b' as FoodId }
    const b = { ...a, id: 'b' as FoodId, deriveDe: 'a' as FoodId }
    const cyclique = new Map([
      ['a' as FoodId, a],
      ['b' as FoodId, b],
    ])

    expect(resolveAnimalOrigin(a, cyclique)).toBeNull()
  })
})
