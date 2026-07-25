// engine/selection/scoring/nutri.test.ts — couche de score `nutri` (docs/ENGINE.md §6.5
// précision 1).

import { describe, expect, it } from 'vitest'
import { scoreNutri } from './nutri.js'
import { NEUTRAL_SCORE } from './index.js'
import type { NutrientSense } from '../../domain/index.js'

describe('scoring/nutri — scoreNutri', () => {
  it('recette pile sur la cible → score 1', () => {
    const recipe = new Float64Array([50, 20, 5])
    const target = new Float64Array([50, 20, 5])
    const senses: NutrientSense[] = ['cible', 'cible', 'cible']
    expect(scoreNutri(recipe, target, senses)).toBe(1)
  })

  it('ignore les nutriments à cible nulle : ni comptés pour, ni comptés contre', () => {
    const recipe = new Float64Array([50, 999])
    const target = new Float64Array([50, 0])
    const senses: NutrientSense[] = ['cible', 'cible']
    expect(scoreNutri(recipe, target, senses)).toBe(1)
  })

  it('aucun nutriment exploitable (toutes cibles nulles) → score neutre', () => {
    const recipe = new Float64Array([10, 10])
    const target = new Float64Array([0, 0])
    const senses: NutrientSense[] = ['cible', 'cible']
    expect(scoreNutri(recipe, target, senses)).toBe(NEUTRAL_SCORE)
  })

  it('valeur vérifiée à la main : moyenne des écarts relatifs clampés à 1 (cible)', () => {
    // écart 1 : |80-50|/50 = 0.6 — écart 2 : |0-20|/20 = 1 (clampé, écart réel = 3)
    // moyenne = (0.6 + 1) / 2 = 0.8 → score = 1 - 0.8 = 0.2
    const recipe = new Float64Array([80, 0])
    const target = new Float64Array([50, 20])
    const senses: NutrientSense[] = ['cible', 'cible']
    expect(scoreNutri(recipe, target, senses)).toBeCloseTo(0.2, 10)
  })

  it('itère sur la longueur commune quand les vecteurs diffèrent en taille', () => {
    const recipe = new Float64Array([50, 999, 999])
    const target = new Float64Array([50])
    const senses: NutrientSense[] = ['cible']
    expect(scoreNutri(recipe, target, senses)).toBe(1)
  })

  it('reste toujours dans [0, 1], même à écart extrême', () => {
    const recipe = new Float64Array([1000])
    const target = new Float64Array([1])
    const senses: NutrientSense[] = ['cible']
    const score = scoreNutri(recipe, target, senses)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('tableau de sens plus court que les vecteurs : index manquants traités comme `cible` (défensif)', () => {
    // Un seul sens fourni pour 2 nutriments : le second (sans sens) doit se comporter comme
    // `cible`, donc pénaliser un écart des deux côtés — comportement actuel, pas de régression
    // silencieuse.
    const recipe = new Float64Array([50, 0])
    const target = new Float64Array([50, 20])
    const senses: NutrientSense[] = ['cible']
    // écart 1 (cible, explicite) = 0 — écart 2 (cible, défaut) = |0-20|/20 = 1
    // moyenne = 0.5 → score = 0.5
    expect(scoreNutri(recipe, target, senses)).toBeCloseTo(0.5, 10)
  })

  describe('sens `plancher` — le défaut corrigé : un excès ne pénalise jamais', () => {
    it('dépasser largement la cible obtient le MÊME score que l\'atteindre pile', () => {
      // AVANT cette correction, `scoreNutri` était symétrique : une recette à 2x la cible de fer
      // était punie exactement comme une recette qui manquait de moitié — absurde pour un
      // nutriment "plus il y en a, mieux c'est". `plancher` corrige ça : seul le manque compte.
      const target = new Float64Array([14]) // fer, mg
      const senses: NutrientSense[] = ['plancher']

      const pile = scoreNutri(new Float64Array([14]), target, senses)
      const largementAuDessus = scoreNutri(new Float64Array([50]), target, senses)

      expect(pile).toBe(1)
      expect(largementAuDessus).toBe(1)
      expect(largementAuDessus).toBe(pile)
    })

    it('manquer la cible pénalise proportionnellement, et fait moins bien qu\'un excès', () => {
      const target = new Float64Array([14])
      const senses: NutrientSense[] = ['plancher']

      const manque = scoreNutri(new Float64Array([7]), target, senses) // écart = (14-7)/14 = 0.5
      const exces = scoreNutri(new Float64Array([50]), target, senses)

      expect(manque).toBeCloseTo(0.5, 10)
      expect(exces).toBeGreaterThan(manque)
    })
  })

  describe('sens `plafond` — être en dessous ne pénalise jamais', () => {
    it('une recette sous la cible de sodium obtient le même score qu\'à la cible', () => {
      const target = new Float64Array([2000]) // sodium, mg
      const senses: NutrientSense[] = ['plafond']

      const sousLaCible = scoreNutri(new Float64Array([500]), target, senses)
      const pile = scoreNutri(new Float64Array([2000]), target, senses)

      expect(sousLaCible).toBe(1)
      expect(pile).toBe(1)
    })

    it('une recette au-dessus de la cible est pénalisée proportionnellement', () => {
      const target = new Float64Array([2000])
      const senses: NutrientSense[] = ['plafond']

      // écart = (3000-2000)/2000 = 0.5 → score = 0.5
      const auDessus = scoreNutri(new Float64Array([3000]), target, senses)
      expect(auDessus).toBeCloseTo(0.5, 10)
    })
  })

  describe('sens `cible` — non-régression : les deux côtés pénalisent, symétriquement', () => {
    it('un écart au-dessus et un écart équivalent en dessous donnent le même score', () => {
      const target = new Float64Array([50])
      const senses: NutrientSense[] = ['cible']

      const auDessus = scoreNutri(new Float64Array([60]), target, senses) // +20% → écart 0.2
      const enDessous = scoreNutri(new Float64Array([40]), target, senses) // -20% → écart 0.2

      expect(auDessus).toBeCloseTo(enDessous, 10)
      expect(auDessus).toBeCloseTo(0.8, 10)
    })
  })
})
