// engine/domain/brand.ts
//
// Aide générique pour les types "brandés" (nominal typing sur des primitifs).
// Utilisée à la fois par units.ts (Grams, Kcal…) et ids.ts (FoodId, RecipeId…).
// Un seul symbole de marque : c'est le paramètre `B` (littéral de chaîne) qui distingue
// chaque type entre eux, pas le symbole lui-même. Voir docs/ENGINE.md §4.1.

declare const brand: unique symbol

export type Branded<T, B extends string> = T & { readonly [brand]: B }
