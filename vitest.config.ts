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
    // ⚠️ `tsx` AJOUTÉ SUR `tests/` LE 2026-08-13, et c'est le sens INVERSE de la régression ci-dessus.
    // Un test scellé d'écran (`tests/scelles/65a-ecran.test.tsx`) a besoin de JSX ; sans `tsx` ici il
    // n'était pas ramassé — vitest répondait « No test files found » sur son propre chemin. Un test
    // scellé qui ne s'exécute jamais est pire que pas de test : il a l'air de garder quelque chose.
    include: ['app/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx,mjs}', 'catalog/**/*.test.{ts,mjs}'],

    // ⚠️ NE MATCHE PAS `include` (il n'est pas un `*.test.ts`), donc il n'est pas ramassé comme un
    // test — il est chargé AVANT chacun d'eux. Un seul réglage y vit, et son en-tête dit pourquoi.
    setupFiles: ['./tests/setup-jsdom.ts'],

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
    // ⚠️ CE COMMENTAIRE A RENVOYÉ À LA « DÉCISION 59 » JUSQU'AU 2026-08-07 — la dérive d'index de
    // §4 avait atteint le code. La 59 est l'écrasement entre deux onglets, sans rapport.
    //
    // ⛔ CE BLOC A DÉSIGNÉ LA MAUVAISE CAUSE PENDANT DEUX JOURS, ET LA MESURE QUI L'ACCUSAIT ÉTAIT
    // BONNE — C'EST SON INTERPRÉTATION QUI NE L'ÉTAIT PAS. Il disait : « l'écran ne pagine ni ne
    // virtualise, le temps de montage EST le rendu des cartes, 3,60 ms par carte, pente constante à
    // 2,5 % près ». La pente existe bel et bien. Elle ne mesure simplement pas un rendu.
    //
    // DÉCOMPOSÉ le 2026-08-08 sur le même écran monté (305 cartes, 2 104 nœuds DOM) :
    //   Profiler React, 2 commits ....................    83 ms   ← le rendu réel
    //   `getByRole('heading', { name })` .............   480 ms   PAR APPEL
    //   `getByText('Recettes')` ......................    79 ms   par appel
    //   `querySelector('h1')` ........................   0,1 ms   par appel
    //   montage bout en bout .........................  1 294 ms
    //   305 <li> nues de structure équivalente .......    68 ms
    //   `chargerSocle` / `createEngine` / `loadCatalog`  34 / 5 / 19 ms
    //
    // Le rendu d'une carte coûte 83/305 = **0,27 ms**, soit exactement le plancher de jsdom mesuré
    // à part (0,28 ms). Les « 3,60 ms par carte » mesuraient la croissance de `getByRole` AVEC UN
    // FILTRE DE NOM, qui recalcule le nom accessible de chaque élément du document à chaque sonde,
    // et que `findBy*` appelle au moins deux fois. **C'est une propriété du HARNAIS DE TEST. Elle
    // n'existe pas dans un navigateur** — aucun utilisateur n'exécute de requête accessible.
    //
    // ⇒ Conséquence pour la décision **61** d'`ETAT.md` §4 : l'extrapolation « à 500 recettes la
    // question se posera sur un TÉLÉPHONE » s'appuyait sur un nombre qui n'a jamais décrit un
    // téléphone. La mesure sur appareil reste due (piste (c)) ; la présomption qu'elle devait
    // confirmer, non. ⛔ Ne pas refermer la 61 sur CE bloc non plus : jsdom ne fait ni mise en page
    // ni peinture, et ce qui se transpose reste 6,9 nœuds par carte, ~3 450 à 500 recettes.
    //
    // ⛔ ET CE N'EST TOUJOURS PAS LE MOTEUR : les 7 requêtes que `comptes` refait à chaque rendu
    // (`recettes.tsx:183-197`) coûtent 4,1 ms au total. Hypothèse réfutée, pas écartée au jugé.
    testTimeout: 15_000,
  },
})
