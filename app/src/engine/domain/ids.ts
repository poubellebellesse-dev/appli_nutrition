// engine/domain/ids.ts
//
// Identifiants typés (docs/ENGINE.md §4.2) : contre l'inversion d'arguments entre deux
// identifiants qui sont tous deux des `string` en JS.
//
// EvidenceSheetId est inclus ici (pas dans la liste explicite du chunk) parce que
// `Explanation.evidenceSheetId` (§6.7 ENGINE) le requiert.

import type { Branded } from './brand.js'

export type FoodId = Branded<string, 'FoodId'>
export type RecipeId = Branded<string, 'RecipeId'>
export type NutrientId = Branded<string, 'NutrientId'>
export type AllergenId = Branded<string, 'AllergenId'>
export type LexiconEntryId = Branded<string, 'LexiconEntryId'>
export type TopicId = Branded<string, 'TopicId'>
export type EvidenceSheetId = Branded<string, 'EvidenceSheetId'>
