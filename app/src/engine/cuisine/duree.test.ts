// engine/cuisine/duree.test.ts — les deux durées d'une recette.
//
// ⚠️ CE FICHIER GARDE UNE SÉPARATION, PAS UN CALCUL. Le calcul tient en une addition ; ce qui coûte
// cher, c'est le jour où quelqu'un « uniformisera » les deux durées. Les tests sont donc écrits pour
// tomber en rouge sur la FUSION, pas seulement sur une erreur d'arithmétique.
//
// Fixture montée à la main, jamais dérivée du YAML : un oracle qui partage la donnée de son sujet ne
// vérifie rien (`PIEGES.md`). Le catalogue réel est vérifié à part, dans
// `tests/cuisine-duree-catalogue-reel.test.ts`.

import { describe, expect, it } from 'vitest'
import { dureeActiveMin, dureeEcouleeMin, dureeReposMin } from './duree.js'
import type { Recipe, RecipeStep, TimerType } from '../domain/index.js'

function etape(ordre: number, timerType: TimerType | null, timerS: number | null): RecipeStep {
  return { ordre, texte: `étape ${ordre}`, lexiconIds: [], timerS, timerType, nature: 'geste', foodIds: [] }
}

function recette(
  prepMin: number,
  cuissonMin: number,
  etapes: readonly RecipeStep[]
): Recipe {
  // Seuls ces cinq champs sont lus ; le reste est un remplissage typé, volontairement inerte.
  return {
    tempsPrepMin: prepMin,
    tempsCuissonMin: cuissonMin,
    etapes,
  } as unknown as Recipe
}

describe('cuisine/duree — le repos chiffré', () => {
  it('somme les étapes `repos` et IGNORE les étapes `cuisson`', () => {
    const r = recette(15, 100, [
      etape(1, null, null),
      etape(2, 'cuisson', 5400), // 90 min : déjà dans `tempsCuissonMin`, ne doit PAS être recomptée
      etape(3, 'repos', 43200), // 12 h de marinade
    ])
    expect(dureeReposMin(r)).toBe(720)
    expect(dureeActiveMin(r)).toBe(115)
    expect(dureeEcouleeMin(r)).toBe(835)
  })

  it('additionne PLUSIEURS repos — une pâte qui lève deux fois lève bien deux fois', () => {
    const r = recette(20, 40, [etape(1, 'repos', 3600), etape(2, 'repos', 1800)])
    expect(dureeReposMin(r)).toBe(90)
    expect(dureeEcouleeMin(r)).toBe(150)
  })

  it('⛔ un `timerType: repos` SANS `timerS` ne compte pas — et ne casse rien', () => {
    // La donnée est propre aujourd'hui (0 occurrence au catalogue), mais rien au type ne l'impose :
    // `timerS` est `number | null` indépendamment de `timerType`. Un `NaN` remonterait jusqu'à
    // `ordonnancerCuissons`, qui rejette les durées non finies — l'écran planterait au lieu
    // d'afficher un plat sans repos.
    const r = recette(10, 10, [etape(1, 'repos', null)])
    expect(dureeReposMin(r)).toBe(0)
    expect(dureeEcouleeMin(r)).toBe(20)
  })

  it('arrondit AU PLUS PROCHE, jamais vers le bas — sinon on part systématiquement trop tard', () => {
    expect(dureeReposMin(recette(0, 0, [etape(1, 'repos', 90)]))).toBe(2)
    expect(dureeReposMin(recette(0, 0, [etape(1, 'repos', 20)]))).toBe(0)
  })

  it('aucune étape, ou aucun repos → la durée écoulée EST la durée active', () => {
    // Le cas des 248 recettes sur 330 qui ne portent aucun repos : ce lot ne doit rien déplacer
    // pour elles.
    expect(dureeEcouleeMin(recette(10, 25, []))).toBe(35)
    expect(dureeEcouleeMin(recette(10, 25, [etape(1, 'cuisson', 1500)]))).toBe(35)
  })
})

describe('cuisine/duree — ⛔ les deux durées NE SE CONFONDENT PAS', () => {
  it('la durée ACTIVE ignore le repos — c’est elle que lit « ai-je le temps ce soir »', () => {
    // Ce test tombe le jour où quelqu'un ajoute les repos à `dureeActiveMin` « pour uniformiser ».
    // Le coq au vin doit rester un plat de 115 min pour le solveur, sinon il sort de « rapide » et
    // le classement de tout le catalogue bouge.
    const coqAuVin = recette(15, 100, [etape(1, 'repos', 43200)])
    expect(dureeActiveMin(coqAuVin)).toBe(115)
    expect(dureeEcouleeMin(coqAuVin)).toBe(835)
    expect(dureeEcouleeMin(coqAuVin)).toBeGreaterThan(dureeActiveMin(coqAuVin))
  })

  it('la durée ÉCOULÉE n’est jamais inférieure à l’active — un repos ne raccourcit rien', () => {
    const r = recette(30, 45, [etape(1, 'repos', 600), etape(2, 'cuisson', 2700)])
    expect(dureeEcouleeMin(r)).toBeGreaterThanOrEqual(dureeActiveMin(r))
  })
})
