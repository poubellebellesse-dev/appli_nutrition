// engine/selection/prng.test.ts — voir l'en-tête de prng.ts.

import { describe, expect, it } from 'vitest'
import { derive, mulberry32 } from './prng.js'

describe('selection/prng — mulberry32', () => {
  it('même graine → même suite', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const suiteA = Array.from({ length: 20 }, () => a())
    const suiteB = Array.from({ length: 20 }, () => b())
    expect(suiteA).toEqual(suiteB)
  })

  it('graines différentes → suites différentes', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    const suiteA = Array.from({ length: 20 }, () => a())
    const suiteB = Array.from({ length: 20 }, () => b())
    expect(suiteA).not.toEqual(suiteB)
  })

  it('valeurs toujours dans [0, 1)', () => {
    const next = mulberry32(12345)
    for (let i = 0; i < 1000; i++) {
      const v = next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('deux générateurs créés séparément sont indépendants (pas d\'état partagé)', () => {
    const a = mulberry32(7)
    const valeurA1 = a()
    const b = mulberry32(7)
    const valeurB1 = b()
    expect(valeurA1).toBe(valeurB1)
    const valeurA2 = a()
    expect(valeurA2).not.toBe(valeurB1)
  })
})

describe('selection/prng — derive', () => {
  it('stable : mêmes arguments → même résultat', () => {
    expect(derive(1, 'a')).toBe(derive(1, 'a'))
  })

  it('sensible à la graine', () => {
    expect(derive(1, 'a')).not.toBe(derive(2, 'a'))
  })

  it('sensible à la clé', () => {
    expect(derive(1, 'a')).not.toBe(derive(1, 'b'))
  })

  it('rend un entier 32 bits non négatif', () => {
    const h = derive(999, '2026-08-03|dejeuner')
    expect(Number.isInteger(h)).toBe(true)
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThan(2 ** 32)
  })
})
