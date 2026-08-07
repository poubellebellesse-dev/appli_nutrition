// data/catalog-loader.test.ts
//
// Preuve que loadCatalog() mappe correctement le catalog.db réel (10 recettes, 76 aliments,
// docs/ETAT.md §6) vers les types domaine de engine/domain/catalog.ts : nutriments/allergènes
// bien rattachés à leur aliment, ingrédients/étapes/facettes bien rattachés à leur recette, et
// les index de CatalogIndexes cohérents avec les données chargées.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { COURSE_ORDER } from '../engine/domain/index.js'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import type {
  AllergenId,
  Catalog,
  EvidenceSheetId,
  FoodId,
  NutrientId,
  RecipeId,
} from '../engine/domain/index.js'
import { loadCatalog } from './catalog-loader-node.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..', '..', '..')
const BUILD_SCRIPT = path.join(REPO_ROOT, 'catalog', 'build.mjs')

describe('data/catalog-loader — loadCatalog(catalog.db réel)', () => {
  let catalog: Catalog
  // Build vers un fichier isolé (pas app/public/catalog/catalog.db) : catalog/build.test.ts
  // reconstruit ce même fichier partagé en parallèle (vitest exécute les fichiers de test en
  // parallèle), et deux builds concurrents sur la même sortie se corrompent l'un l'autre.
  const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-catalog-loader-'))
  const dbPath = path.join(fixtureDir, 'catalog.db')

  beforeAll(() => {
    // Pas de --sources : utilise les vraies sources (catalog/sources, catalog/lexicon,
    // catalog/recipes) — seule la sortie est redirigée vers le fichier isolé ci-dessus.
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

  // Comptes NON figés côté recettes : le catalogue grandit (chantier contenu, 10 → ~100). Ce que
  // ce test prouve est que le loader ne PERD rien entre catalog.db et le `Catalog` en mémoire, pas
  // qu'il y a exactement N recettes — d'où la comparaison au compte lu en base.
  it('charge les aliments et TOUTES les recettes de catalog.db, sans perte', () => {
    const db = new DatabaseSync(dbPath, { readOnly: true })
    try {
      const foods = db.prepare('SELECT COUNT(*) as count FROM food').get() as { count: number }
      const recipes = db.prepare('SELECT COUNT(*) as count FROM recipe').get() as { count: number }
      expect(catalog.foods.size).toBe(foods.count)
      expect(catalog.recipes.size).toBe(recipes.count)
    } finally {
      db.close()
    }
    expect(catalog.foods.size).toBeGreaterThanOrEqual(76)
    expect(catalog.recipes.size).toBeGreaterThanOrEqual(10)
  })

  // Valeurs attendues = CIQUAL 2025, aliment 22000 « Oeuf cru » (voir ciqual-mapping.yaml). Elles
  // sont volontairement écrites en dur ICI, à la différence des comptes de recettes : ce test prouve
  // que le loader rattache chaque nutriment au BON aliment, et une valeur exacte est le seul moyen
  // de le montrer. Elles ne changeront qu'avec une nouvelle édition de la table ANSES.
  it('rattache les nutriments et l’allergène au bon aliment (œuf)', () => {
    const oeuf = catalog.foods.get('oeuf' as FoodId)
    expect(oeuf).toBeDefined()
    expect(oeuf?.nom).toBe('Œuf de poule, entier, cru')
    expect(oeuf?.nutrimentsPour100g.size).toBe(9)
    expect(oeuf?.nutrimentsPour100g.get('energie' as NutrientId)).toBe(140)
    expect(oeuf?.nutrimentsPour100g.get('proteines' as NutrientId)).toBeCloseTo(12.8)
    expect(oeuf?.allergenes).toEqual([{ allergenId: 'oeufs', certitude: 'contient' }])
  })

  it('un aliment sans allergène déclaré a un tableau vide (huile d’olive)', () => {
    const huile = catalog.foods.get('huile_olive' as FoodId)
    expect(huile).toBeDefined()
    expect(huile?.allergenes).toEqual([])
  })

  it('mappe saisonMois et touteAnnee depuis la base — staple toute l’année (huile d’olive)', () => {
    const huile = catalog.foods.get('huile_olive' as FoodId)
    expect(huile).toBeDefined()
    expect(huile?.touteAnnee).toBe(true)
    expect(huile?.saisonMois).toEqual([])
  })

  it('mappe saisonMois et touteAnnee depuis la base — aliment saisonnier (tomate)', () => {
    const tomate = catalog.foods.get('tomate' as FoodId)
    expect(tomate).toBeDefined()
    expect(tomate?.touteAnnee).toBe(false)
    expect(tomate?.saisonMois.length).toBeGreaterThan(0)
    for (const mois of tomate?.saisonMois ?? []) {
      expect(mois).toBeGreaterThanOrEqual(1)
      expect(mois).toBeLessThanOrEqual(12)
    }
  })

  it('rattache ingrédients, étapes ordonnées et facettes à la bonne recette (omelette)', () => {
    const omelette = catalog.recipes.get('omelette_fines_herbes' as RecipeId)
    expect(omelette).toBeDefined()
    expect(omelette?.ingredients).toHaveLength(5)
    // 5 étapes depuis le 2026-08-03 : la mention ANSES « œufs crus ou peu cuits » a été ajoutée en
    // étape finale aux 15 recettes à œuf cru ou peu cuit (SOURCES_RECETTES.md §5 quinquies).
    expect(omelette?.etapes.map((e) => e.ordre)).toEqual([1, 2, 3, 4, 5])
    // ⚠️ Cette mention OCCUPE une étape sans en être une. `nature` est ce qui permet aux écrans de
    // ne pas la compter : sans elle, l'omelette annonce cinq gestes pour quatre.
    expect(omelette?.etapes.map((e) => e.nature)).toEqual([
      'geste',
      'geste',
      'geste',
      'geste',
      'avertissement',
    ])
    expect(omelette?.facettes).toContainEqual({ facette: 'regime', valeur: 'vegetarien' })
    expect(omelette?.typesRepas).toEqual(['petit_dejeuner', 'dejeuner', 'diner'])

    const oeufIngredient = omelette?.ingredients.find((i) => i.foodId === ('oeuf' as FoodId))
    expect(oeufIngredient?.optionnel).toBe(false)
    const persilIngredient = omelette?.ingredients.find((i) => i.foodId === ('persil' as FoodId))
    expect(persilIngredient?.optionnel).toBe(true)
  })

  it('CatalogIndexes.recipesBySlot est cohérent avec Recipe.typesRepas', () => {
    const dejeuner = catalog.indexes.recipesBySlot.get('dejeuner')
    expect(dejeuner).toBeDefined()
    expect(dejeuner?.has('omelette_fines_herbes' as RecipeId)).toBe(true)

    for (const [slot, recipeIds] of catalog.indexes.recipesBySlot) {
      for (const recipeId of recipeIds) {
        expect(catalog.recipes.get(recipeId)?.typesRepas).toContain(slot)
      }
    }
  })

  it('CatalogIndexes.recipesByAllergen est cohérent avec les ingrédients (gluten → pâtes à l’ail)', () => {
    const glutenRecipes = catalog.indexes.recipesByAllergen.get('gluten' as AllergenId)
    expect(glutenRecipes).toBeDefined()
    expect(glutenRecipes?.has('pates_ail_huile' as RecipeId)).toBe(true)

    for (const [allergenId, recipeIds] of catalog.indexes.recipesByAllergen) {
      for (const recipeId of recipeIds) {
        const recipe = catalog.recipes.get(recipeId)
        const touches = recipe?.ingredients.some((ing) =>
          catalog.foods.get(ing.foodId)?.allergenes.some((a) => a.allergenId === allergenId)
        )
        expect(touches).toBe(true)
      }
    }
  })

  // Décision utilisateur du jour : `Nutrient.sens` pilote l'asymétrie de `scoreNutri`
  // (docs/ENGINE.md §6.5) — filet contre une donnée oubliée sur le catalogue réel.
  it('les 9 nutriments portent un sens — sodium plafond, fer plancher', () => {
    expect(catalog.nutrients).toHaveLength(9)
    for (const nutrient of catalog.nutrients) {
      expect(['cible', 'plancher', 'plafond']).toContain(nutrient.sens)
    }

    const sodium = catalog.nutrients.find((n) => n.id === ('sodium' as NutrientId))
    expect(sodium?.sens).toBe('plafond')

    const fer = catalog.nutrients.find((n) => n.id === ('fer' as NutrientId))
    expect(fer?.sens).toBe('plancher')
  })

  it('topics et substitutions sont des Map vides (tables absentes de catalog.db)', () => {
    expect(catalog.topics.size).toBe(0)
    expect(catalog.substitutions.size).toBe(0)
  })

  // --- service / piquant (CourseKind, 2026-07-28) ---------------------------------------------

  it('charge `service` sur TOUTES les recettes — aucune ne reste sans rôle', () => {
    expect([...catalog.recipes.values()].filter((r) => r.service === null)).toHaveLength(0)
  })

  it('les cinq valeurs de CourseKind sont les seules employées', () => {
    for (const service of new Set([...catalog.recipes.values()].map((r) => r.service))) {
      expect(COURSE_ORDER).toContain(service)
    }
  })

  it('`service` et `typesRepas` sont des axes INDÉPENDANTS — un accompagnement reste servi au dîner', () => {
    // L'invariant qui a motivé le champ : annoter le rôle ne retire personne d'un créneau. Si un
    // accompagnement perdait `diner`, il deviendrait INVISIBLE — `MealSlot` n'a pas de case pour
    // lui. C'est l'erreur que ce test empêche de refaire.
    const accompagnements = [...catalog.recipes.values()].filter((r) => r.service === 'accompagnement')

    expect(accompagnements.length).toBeGreaterThan(0)
    expect(accompagnements.every((r) => r.typesRepas.length > 0)).toBe(true)
    expect(accompagnements.some((r) => r.typesRepas.includes('diner'))).toBe(true)
  })

  // ⚠️ CE TEST A CHANGÉ DE SENS LE 2026-08-07, ET C'EST CE QU'IL DEMANDAIT. Il disait « `piquant`
  // vaut `null` partout tant que rien n'est annoté » et portait sa propre condition de sortie :
  // « ce test échouera utilement le jour où on annotera le piquant, forçant à le mettre à jour
  // sciemment ». Le jour est venu (décision 35) — les 297 recettes sont annotées. Ce qu'il garde,
  // c'est la règle qui n'a PAS changé : `null` n'est jamais remplacé par `0` faute d'information.
  it('les recettes sont annotées, et l’échelle reste celle du catalogue', () => {
    const recettes = [...catalog.recipes.values()]
    expect(recettes.every((r) => r.piquant === null || (r.piquant >= 0 && r.piquant <= 4))).toBe(true)
    // Au moins une recette porte un niveau > 0, sinon l'annotation serait un remplissage à zéro.
    expect(recettes.some((r) => (r.piquant ?? 0) > 0)).toBe(true)
  })

  // ⚠️ LES ALIMENTS, EUX, NE SONT TOUJOURS PAS ANNOTÉS — `foods.yaml` était en cours d'édition par
  // une autre piste au moment de la décision 35. `null` y reste « non renseigné », JAMAIS « doux ».
  it('`Food.piquant` vaut encore `null` partout — non renseigné, jamais 0 par défaut', () => {
    expect([...catalog.foods.values()].every((f) => f.piquant === null)).toBe(true)
  })

  // --- Fiches scientifiques (§8.2 ARCHITECTURE, §4.7 DESIGN) -----------------------------------
  //
  // ⚠️ CES TESTS SONT DES GARDE-FOUS DE CONTENU, pas des tests de mapping. Une fiche porte des
  // affirmations de santé : ce qui est vérifié ici, c'est qu'aucune ne peut atteindre l'écran sans
  // son auteur, son niveau de preuve et ses sources — les trois conditions posées par §4.7 et §6.1.

  it('charge les fiches, leurs positions et leurs sources', () => {
    expect(catalog.evidence.size).toBeGreaterThan(0)

    const fiche = catalog.evidence.get('sodium-tension-arterielle' as EvidenceSheetId)
    expect(fiche).toBeDefined()
    expect(fiche?.titre).toContain('?')
    expect(fiche?.categorie).toBe('nutriments')
    expect(fiche?.positions.length).toBeGreaterThan(1)
    expect(fiche?.sources.length).toBeGreaterThan(1)
    expect(fiche?.liens).toContainEqual({ cibleType: 'nutrient', cibleId: 'sodium' })
  })

  it('PROPRIÉTÉ — aucune position n’est publiée sans source, sans porteur ni sans niveau de preuve', () => {
    // La propriété de sécurité de cet écran. Une affirmation de santé anonyme ou non sourcée est
    // exactement ce que §6.1 interdit ; le build échoue avant d'en écrire une, et ceci le prouve
    // sur le contenu réel plutôt que sur une fixture.
    const niveaux = ['forte', 'moderee', 'faible', 'preliminaire']
    for (const fiche of catalog.evidence.values()) {
      expect(fiche.positions.length).toBeGreaterThan(0)
      for (const position of fiche.positions) {
        expect(position.sources.length).toBeGreaterThan(0)
        expect(position.portePar.trim()).not.toBe('')
        expect(niveaux).toContain(position.niveauPreuve)
      }
    }
  })

  it('PROPRIÉTÉ — toute source citée par une position existe dans la fiche qui la cite', () => {
    // Un renvoi orphelin afficherait une affirmation dont la référence est introuvable — pire que
    // pas de référence du tout, puisque l'écran promettrait une source vérifiable.
    for (const fiche of catalog.evidence.values()) {
      const connues = new Set(fiche.sources.map((s) => s.code))
      for (const position of fiche.positions) {
        for (const code of position.sources) expect(connues).toContain(code)
      }
    }
  })

  it('préserve l’ORDRE éditorial des positions', () => {
    // L'ordre porte l'argumentation (socle de consensus d'abord, lecture croisée en dernier). Un
    // tri alphabétique ou par niveau de preuve la casserait sans rien signaler.
    const fiche = catalog.evidence.get('sodium-tension-arterielle' as EvidenceSheetId)
    expect(fiche?.positions.map((p) => p.code)).toEqual([
      'consensus-tension',
      'cible-autorites',
      'cochrane-normotendus',
      'pure-seuil',
      'zone-de-debat',
    ])
  })

  it('conserve `financement` et distingue `auteurs: null` d’une chaîne vide', () => {
    // Deux champs de confiance, et deux erreurs de mapping possibles : perdre le financement
    // déclaré (le lecteur ne saurait plus qui a payé), ou transformer un `null` — « non vérifié » —
    // en chaîne vide, qui se lirait comme un oubli.
    const sources = [...catalog.evidence.values()].flatMap((f) => f.sources)

    const finances = sources.filter((s) => s.financement !== null)
    expect(finances.length).toBeGreaterThan(0)
    expect(finances.every((s) => s.financement !== '')).toBe(true)

    const nonVerifies = sources.filter((s) => s.auteurs === null)
    expect(nonVerifies.length).toBeGreaterThan(0)
    expect(sources.every((s) => s.auteurs !== '')).toBe(true)
  })

  it('toute source porte une URL et une date de consultation', () => {
    // Règle 5 de catalog/evidence/README.md : c'est `consulteLe` qui distingue un lien ouvert et
    // vérifié d'une référence recopiée.
    for (const source of [...catalog.evidence.values()].flatMap((f) => f.sources)) {
      expect(source.url).toMatch(/^https?:\/\//)
      expect(source.consulteLe).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  // --- Tips (§8.4) ------------------------------------------------------------------------------

  it('charge les tips de catalog.db sans perte, avec leur source', () => {
    const db = new DatabaseSync(dbPath, { readOnly: true })
    try {
      const { count } = db.prepare('SELECT COUNT(*) as count FROM tip').get() as { count: number }
      expect(catalog.tips).toHaveLength(count)
    } finally {
      db.close()
    }
    expect(catalog.tips.length).toBeGreaterThan(0)
  })

  it('PROPRIÉTÉ : aucun tip sans source cliquable', () => {
    // La contrainte est tenue au build (`source_url NOT NULL` + format), mais elle se perdrait
    // silencieusement à un renommage de colonne : `row.source_url` deviendrait `undefined` et le
    // champ arriverait vide à l'écran sans qu'aucun type ne s'en plaigne.
    for (const tip of catalog.tips) {
      expect(tip.sourceUrl).toMatch(/^https?:\/\/\S+$/)
    }
  })

  it('charge les sources de recette sans perte, avec leur date de consultation', () => {
    // Même mode de défaillance que pour les tips : un renommage de colonne ferait arriver
    // `undefined` jusqu'à l'écran sans qu'aucun type ne s'en plaigne. La recette s'afficherait
    // alors comme non sourcée — silencieusement, et dans le sens qui trompe.
    const db = new DatabaseSync(dbPath, { readOnly: true })
    let attendues = 0
    try {
      attendues = (db.prepare('SELECT COUNT(*) as count FROM recipe_source').get() as { count: number }).count
    } finally {
      db.close()
    }
    const chargees = [...catalog.recipes.values()].flatMap((r) => r.sources)
    expect(chargees).toHaveLength(attendues)
    expect(chargees.length).toBeGreaterThan(0)
    for (const source of chargees) {
      expect(source.url).toMatch(/^https?:\/\/\S+$/)
      expect(source.consulteLe).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(source.titre.trim()).not.toBe('')
    }
  })

  it('PROPRIÉTÉ : aucune recette du catalogue ne revendique une provenance', () => {
    // Les 241 recettes sont écrites POUR ce projet (docs/SOURCES_RECETTES.md §1). Une `provenance`
    // affirmerait qu'elles viennent d'ailleurs — l'écran afficherait « D'après X » sur un texte que
    // X n'a jamais écrit. Ce test tombera le jour d'un import réel : ce sera le signal de vérifier
    // que la recette a bien été reprise d'une source libre, licence et auteur à l'appui.
    for (const recette of catalog.recipes.values()) {
      for (const source of recette.sources) {
        expect(source.type).toBe('reference')
      }
    }
  })

  it('couvre les trois catégories de §8.4', () => {
    // `nutrition_animale` doit rester VISUELLEMENT distinct (§8.4) : tant qu'aucun tip de cette
    // catégorie n'existe, le rendu correspondant n'est jamais exercé. Ce test garde le cas vivant.
    const categories = new Set(catalog.tips.map((t) => t.categorie))
    expect(categories).toEqual(
      new Set(['biologie_aliment', 'nutrition_humaine', 'nutrition_animale'])
    )
  })
})
