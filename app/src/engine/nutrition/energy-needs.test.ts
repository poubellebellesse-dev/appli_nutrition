// engine/nutrition/energy-needs.test.ts — computeEnergyNeeds (docs/ENGINE.md §5.1, Mifflin-St
// Jeor + facteur d'activité).

import { describe, expect, it } from 'vitest'
import { computeEnergyNeeds } from './energy-needs.js'
import type { UserProfile } from '../domain/index.js'

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    trancheAge: '30_49',
    sexe: 'NP',
    tailleCm: 170,
    poidsKg: 70,
    niveauActivite: 'sedentaire',
    facteurPortion: 1,
    ...overrides,
  }
}

describe('nutrition/energy-needs — computeEnergyNeeds', () => {
  it('homme, 30_49 (âge 40), actif : valeur calculée à la main', () => {
    // BMR = 10*70 + 6.25*175 - 5*40 + 5 = 700 + 1093.75 - 200 + 5 = 1598.75
    // besoin = 1598.75 * 1.55 = 2478.0625
    const profile = makeProfile({
      sexe: 'M',
      tailleCm: 175,
      poidsKg: 70,
      trancheAge: '30_49',
      niveauActivite: 'actif',
    })
    expect(computeEnergyNeeds(profile)).toBeCloseTo(2478.0625, 10)
  })

  it('femme, 18_29 (âge 24), sedentaire : valeur calculée à la main', () => {
    // BMR = 10*60 + 6.25*165 - 5*24 - 161 = 600 + 1031.25 - 120 - 161 = 1350.25
    // besoin = 1350.25 * 1.2 = 1620.3
    const profile = makeProfile({
      sexe: 'F',
      tailleCm: 165,
      poidsKg: 60,
      trancheAge: '18_29',
      niveauActivite: 'sedentaire',
    })
    expect(computeEnergyNeeds(profile)).toBeCloseTo(1620.3, 10)
  })

  it("sexe 'NP', 50_64 (âge 57), peu_actif : vérifie la constante -78 (moyenne de +5 et -161)", () => {
    // BMR = 10*70 + 6.25*170 - 5*57 - 78 = 700 + 1062.5 - 285 - 78 = 1399.5
    // besoin = 1399.5 * 1.375 = 1924.3125
    const profile = makeProfile({
      sexe: 'NP',
      tailleCm: 170,
      poidsKg: 70,
      trancheAge: '50_64',
      niveauActivite: 'peu_actif',
    })
    expect(computeEnergyNeeds(profile)).toBeCloseTo(1924.3125, 10)
  })

  it('homme, 18_29 (âge 24), tres_actif : valeur calculée à la main', () => {
    // BMR = 10*80 + 6.25*180 - 5*24 + 5 = 800 + 1125 - 120 + 5 = 1810
    // besoin = 1810 * 1.725 = 3122.25
    const profile = makeProfile({
      sexe: 'M',
      tailleCm: 180,
      poidsKg: 80,
      trancheAge: '18_29',
      niveauActivite: 'tres_actif',
    })
    expect(computeEnergyNeeds(profile)).toBeCloseTo(3122.25, 10)
  })

  it("l'écart M/F à gabarit identique est de 166 kcal de BMR (+5 - (-161)), pas cosmétique", () => {
    const homme = makeProfile({ sexe: 'M', niveauActivite: 'sedentaire' })
    const femme = makeProfile({ sexe: 'F', niveauActivite: 'sedentaire' })
    // même PAL (1.2) des deux côtés : écart de besoin = écart de BMR * PAL = 166 * 1.2 = 199.2
    expect(computeEnergyNeeds(homme)! - computeEnergyNeeds(femme)!).toBeCloseTo(166 * 1.2, 10)
  })

  it('tailleCm null → null : on ne devine jamais un gabarit corporel', () => {
    const profile = makeProfile({ tailleCm: null })
    expect(computeEnergyNeeds(profile)).toBeNull()
  })

  it('poidsKg null → null', () => {
    const profile = makeProfile({ poidsKg: null })
    expect(computeEnergyNeeds(profile)).toBeNull()
  })
})
