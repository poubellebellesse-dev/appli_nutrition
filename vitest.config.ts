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
    include: ['app/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,mjs}', 'catalog/**/*.test.{ts,mjs}'],

    // ⚠️ CE DÉLAI CORRIGE DE LA CONTENTION, PAS UNE LENTEUR — ne pas le lire comme l'aveu d'un test
    // lent. Le budget de Vitest est du temps d'HORLOGE, pas du temps CPU : avec 85 fichiers lancés
    // en parallèle sur autant de workers que de cœurs, un test qui demande 1,4 s de calcul peut
    // mettre plus de 5 s à les obtenir. Le défaut de 5 s tombait donc par intermittence, sur un
    // fichier DIFFÉRENT à chaque exécution — le même commit rendait 0, 1 ou 2 rouges.
    //
    // MESURÉ le 2026-08-06 sur le coupable le plus fréquent, `screens/recettes.test.tsx` :
    // **1 453 ms en exécution isolée**, soit 29 % du budget d'origine. Aucun test du dépôt
    // n'approche 15 s seul ; ce plafond attrape encore une vraie boucle infinie.
    //
    // ⛔ LA CAUSE DE FOND N'EST PAS ICI, et desserrer le délai ne la traite pas. L'écran Recettes
    // NE PAGINE NI NE VIRTUALISE (en-tête de `recettes.tsx`) : il rend TOUT le catalogue dans le
    // DOM, donc le coût de montage croît linéairement avec lui — 241 → 282 recettes le 2026-08-06,
    // soit +17 % d'un coup. À 500 recettes la question se posera sur un TÉLÉPHONE, pas dans jsdom.
    // Décision ouverte 59 d'`ETAT.md` §4. Ne pas la refermer en remontant encore ce nombre.
    testTimeout: 15_000,
  },
})
