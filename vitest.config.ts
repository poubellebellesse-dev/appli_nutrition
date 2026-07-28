// vitest.config.ts — configuration des TESTS, séparée de `vite.config.ts`.
//
// ⚠️ CE FICHIER EXISTE À CAUSE D'UNE RÉGRESSION RÉELLE (2026-07-28). Vitest lit `vite.config.ts`
// quand aucune config dédiée n'existe. En y posant `root: 'app'` pour la PWA, la découverte des
// tests s'est silencieusement restreinte à `app/` : 572 tests sur 44 fichiers sont devenus 528 sur
// 38, sans le moindre échec — les suites de `tests/` et `catalog/` avaient simplement disparu.
//
// Un test qui n'existe plus ne fait pas échouer la CI, il la rend verte pour de mauvaises raisons.
// D'où la séparation : la PWA a besoin d'une racine `app/`, les tests de la racine du dépôt.

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Racine = dépôt. `tests/` (frontières, catalogue réel) et `catalog/` (build) vivent hors de app/.
    root: '.',
    include: ['app/**/*.test.ts', 'tests/**/*.test.{ts,mjs}', 'catalog/**/*.test.{ts,mjs}'],
  },
})
