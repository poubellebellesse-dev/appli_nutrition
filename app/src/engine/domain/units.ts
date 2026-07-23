// engine/domain/units.ts
//
// Unités typées (docs/ENGINE.md §4.1) : évite la confusion mg / g / µg et les additions de
// grandeurs incompatibles (`recipe.tempsPrep + food.quantite` ne doit pas compiler).

import type { Branded } from './brand.js'

export type Grams = Branded<number, 'g'>
export type Milligrams = Branded<number, 'mg'>
export type Micrograms = Branded<number, 'µg'>
export type Kcal = Branded<number, 'kcal'>
export type Minutes = Branded<number, 'min'>
export type Euros = Branded<number, 'EUR'>

export const g = (n: number): Grams => n as Grams
export const mg = (n: number): Milligrams => n as Milligrams
export const mcg = (n: number): Micrograms => n as Micrograms
export const kcal = (n: number): Kcal => n as Kcal
export const min = (n: number): Minutes => n as Minutes
export const eur = (n: number): Euros => n as Euros
