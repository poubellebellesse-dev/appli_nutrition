// engine/selection/scoring/nutri.test.ts — couche de score `nutri` (docs/ENGINE.md §6.5
// précision 1).

import { describe, expect, it } from 'vitest'
import { scoreNutri } from './nutri.js'
import { NEUTRAL_SCORE } from './index.js'

describe('scoring/nutri — scoreNutri', () => {
  it('recette pile sur la cible → score 1', () => {
    const recipe = new Float64Array([50, 20, 5])
    const target = new Float64Array([50, 20, 5])
    expect(scoreNutri(recipe, target)).toBe(1)
  })

  it('ignore les nutriments à cible nulle : ni comptés pour, ni comptés contre', () => {
    const recipe = new Float64Array([50, 999])
    const target = new Float64Array([50, 0])
    expect(scoreNutri(recipe, target)).toBe(1)
  })

  it('aucun nutriment exploitable (toutes cibles nulles) → score neutre', () => {
    const recipe = new Float64Array([10, 10])
    const target = new Float64Array([0, 0])
    expect(scoreNutri(recipe, target)).toBe(NEUTRAL_SCORE)
  })

  it('valeur vérifiée à la main : moyenne des écarts relatifs clampés à 1', () => {
    // écart 1 : |80-50|/50 = 0.6 — écart 2 : |0-20|/20 = 1 (clampé, écart réel = 3)
    // moyenne = (0.6 + 1) / 2 = 0.8 → score = 1 - 0.8 = 0.2
    const recipe = new Float64Array([80, 0])
    const target = new Float64Array([50, 20])
    expect(scoreNutri(recipe, target)).toBeCloseTo(0.2, 10)
  })

  it('itère sur la longueur commune quand les vecteurs diffèrent en taille', () => {
    const recipe = new Float64Array([50, 999, 999])
    const target = new Float64Array([50])
    expect(scoreNutri(recipe, target)).toBe(1)
  })

  it('reste toujours dans [0, 1], même à écart extrême', () => {
    const recipe = new Float64Array([1000])
    const target = new Float64Array([1])
    const score = scoreNutri(recipe, target)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })
})
