// engine/cuisine/segments.test.ts — le découpage actif/passif d'une recette.
//
// ⚠️ CE QUE CES TESTS GARDENT N'EST PAS LA RÉPARTITION, C'EST LA SOMME. Le partage du temps non
// chiffré sur les étapes sans minuteur est une hypothèse assumée et grossière (voir l'en-tête de
// `segments.ts`) : la faire tomber en rouge à chaque ajustement n'apprendrait rien. Ce qui doit
// tenir, et ce que `ordonnancerCuissons` vérifie à l'exécution, c'est que le total des segments
// reste la durée écoulée — sinon l'heure de départ ment sans que rien ne rougisse.
//
// Fixture montée à la main : un oracle qui partage la donnée de son sujet ne vérifie rien
// (`PIEGES.md`). Le catalogue réel est vérifié à part, dans `tests/cuisine-duree-catalogue-reel.test.ts`.

import { describe, expect, it } from 'vitest'
import { segmentsDeLaRecette } from './segments.js'
import { dureeEcouleeMin } from './duree.js'
import { ordonnancerCuissons } from './ordonnancement.js'
import type { Recipe, RecipeId, RecipeStep, StepNature, TimerType } from '../domain/index.js'

function etape(
  ordre: number,
  timerType: TimerType | null,
  timerS: number | null,
  nature: StepNature = 'geste',
): RecipeStep {
  return { ordre, texte: `étape ${ordre}`, lexiconIds: [], timerS, timerType, nature, foodIds: [] }
}

function recette(prepMin: number, cuissonMin: number, etapes: readonly RecipeStep[]): Recipe {
  return { tempsPrepMin: prepMin, tempsCuissonMin: cuissonMin, etapes } as unknown as Recipe
}

const somme = (segs: readonly { dureeMin: number }[]): number =>
  segs.reduce((s, x) => s + x.dureeMin, 0)

describe('cuisine/segments — le découpage', () => {
  it('un repos chiffré devient PASSIF, tout le reste ACTIF', () => {
    const r = recette(10, 30, [
      etape(1, null, null), // émincer
      etape(2, 'repos', 3600), // 1 h de marinade
      etape(3, 'cuisson', 1800), // 30 min de four
    ])
    const segs = segmentsDeLaRecette(r)

    expect(segs.map((s) => s.nature)).toEqual(['actif', 'passif', 'actif'])
    expect(segs.map((s) => s.ordre)).toEqual([1, 2, 3])
    expect(segs[1]!.dureeMin).toBe(60)
  })

  it('⛔ UNE CUISSON EST ACTIVE — c’est la décision, pas un oubli', () => {
    // Le jour où quelqu'un range le four dans le temps libre, ce test tombe. Il faudra alors une
    // troisième notion de durée (le temps de PRÉSENCE), et ce n'est pas une décision de détail.
    const segs = segmentsDeLaRecette(recette(5, 90, [etape(1, null, null), etape(2, 'cuisson', 5400)]))
    expect(segs.every((s) => s.nature === 'actif')).toBe(true)
  })

  it('un `repos` SANS `timerS` reste actif — on ne libère pas du temps qu’on n’a pas mesuré', () => {
    const segs = segmentsDeLaRecette(recette(20, 0, [etape(1, 'repos', null), etape(2, null, null)]))
    expect(segs.map((s) => s.nature)).toEqual(['actif', 'actif'])
  })

  it('un `avertissement` NE DEVIENT PAS un segment — il se lit, il ne se fait pas', () => {
    const segs = segmentsDeLaRecette(
      recette(10, 0, [etape(1, null, null), etape(2, null, null, 'avertissement')]),
    )
    expect(segs).toHaveLength(1)
    expect(segs[0]!.ordre).toBe(1)
  })

  it('le temps non chiffré se partage à parts ÉGALES entre les étapes sans minuteur', () => {
    // 40 min actives, 30 déjà chiffrées au four : il reste 10 pour deux étapes libres.
    const segs = segmentsDeLaRecette(
      recette(10, 30, [etape(1, null, null), etape(2, 'cuisson', 1800), etape(3, null, null)]),
    )
    expect(segs.map((s) => s.dureeMin)).toEqual([5, 30, 5])
  })
})

describe('cuisine/segments — ⛔ LA SOMME VAUT LA DURÉE ÉCOULÉE, quoi qu’il arrive', () => {
  it('cas courant', () => {
    const r = recette(15, 45, [etape(1, null, null), etape(2, 'repos', 1800), etape(3, 'cuisson', 2700)])
    expect(somme(segmentsDeLaRecette(r))).toBeCloseTo(dureeEcouleeMin(r), 6)
  })

  it('REPLI 1 — les minuteurs de cuisson dépassent le temps actif déclaré (7 recettes au catalogue)', () => {
    // Veau Marengo : 122 min chiffrées pour 110 annoncées. Deux cuissons qui se recouvrent, comptées
    // une fois dans le champ éditorial et deux fois dans les étapes. Sans repli, la somme déborderait
    // `dureeEcouleeMin` et `ordonnancerCuissons` lèverait au montage de l'écran.
    const r = recette(20, 90, [etape(1, 'cuisson', 3600), etape(2, 'cuisson', 3720), etape(3, null, null)])
    const segs = segmentsDeLaRecette(r)
    expect(somme(segs)).toBeCloseTo(110, 6)
    expect(segs.map((s) => s.dureeMin)).toEqual([110 / 3, 110 / 3, 110 / 3])
  })

  it('REPLI 2 — plus une seule étape libre où poser le reste (3 recettes au catalogue)', () => {
    // Poulet sauté aux noix de cajou : 9 min de résidu, zéro étape sans minuteur.
    const r = recette(10, 40, [etape(1, 'cuisson', 1200), etape(2, 'cuisson', 1200)])
    const segs = segmentsDeLaRecette(r)
    expect(somme(segs)).toBeCloseTo(50, 6)
    expect(segs.map((s) => s.dureeMin)).toEqual([25, 25])
  })

  it('cas limite — une recette qui n’est QUE du repos garde son temps actif en tête', () => {
    const r = recette(5, 0, [etape(1, 'repos', 7200)])
    const segs = segmentsDeLaRecette(r)
    expect(segs.map((s) => s.nature)).toEqual(['actif', 'passif'])
    expect(somme(segs)).toBeCloseTo(dureeEcouleeMin(r), 6)
  })

  it('cas limite — aucune étape du tout', () => {
    const r = recette(12, 8, [])
    const segs = segmentsDeLaRecette(r)
    expect(somme(segs)).toBeCloseTo(20, 6)
  })

  it('⛔ ET `ordonnancerCuissons` LES ACCEPTE — la vérification de cohérence ne lève sur aucun repli', () => {
    // Le vrai enjeu des deux replis : sans eux, ces recettes-là font PLANTER l'écran cuisine.
    const cas = [
      recette(20, 90, [etape(1, 'cuisson', 3600), etape(2, 'cuisson', 3720), etape(3, null, null)]),
      recette(10, 40, [etape(1, 'cuisson', 1200), etape(2, 'cuisson', 1200)]),
      recette(5, 0, [etape(1, 'repos', 7200)]),
      recette(15, 45, [etape(1, null, null), etape(2, 'repos', 1830)]),
    ]
    for (const [i, r] of cas.entries()) {
      expect(() =>
        ordonnancerCuissons([
          {
            recipeId: `r${i}` as RecipeId,
            nom: `Plat ${i}`,
            dureeMin: dureeEcouleeMin(r),
            segments: segmentsDeLaRecette(r),
          },
        ]),
      ).not.toThrow()
    }
  })
})
