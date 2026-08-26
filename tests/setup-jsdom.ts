// tests/setup-jsdom.ts — chargé par `setupFiles` de `vitest.config.ts`, avant CHAQUE fichier de test.
//
// ⚠️ CE FICHIER N'EXISTE QUE POUR UN RÉGLAGE, ET CE RÉGLAGE A UNE CAUSE MESURÉE (2026-08-26).
// `testTimeout: 15_000` borne le TEST. Il ne borne pas `waitFor`, qui tient son propre budget —
// `asyncUtilTimeout`, **1 000 ms** par défaut chez Testing Library. Les deux ne se parlent pas :
// un `waitFor` abandonne donc à 1 s dans un test à qui il reste encore 14 s.
//
// Et c'est du temps d'HORLOGE, exactement comme pour `testTimeout` (voir le long bloc de
// `vitest.config.ts`, même cause) : avec 126 fichiers lancés sur autant de workers que de cœurs, un
// écran qui demande 200 ms de calcul peut mettre plus d'une seconde à les obtenir.
//
// MESURÉ le 2026-08-26, quatre exécutions sur le MÊME arbre, sans une ligne de différence :
//   `npm test` → 46,3 s · 50,1 s · 71,6 s d'horloge.
//   Le run lent a sorti UN rouge — `app/src/ui/screens/semaine.test.tsx`, « Expected 3, Received 7 ».
//   Les trois autres : vert. Total inchangé à 2 392 dans les quatre cas.
// ⚠️ Ce n'est donc PAS le symptôme documenté ailleurs (« un compte qui BAISSE sans rouge ») : ici
// le compte ne bouge pas, c'est le verdict qui bouge.
//
// ⛔ UN ROUGE INTERMITTENT NE SE RATTRAPE PAS EN AFFAIBLISSANT L'ASSERTION — c'est pourtant ce qui
// avait été fait dans `semaine.test.tsx`, où une lecture de `readLatestPlan` avait été troquée
// contre un comptage d'`<article>`. Le contournement est devenu la panne.
//
// 172 appels à `waitFor` dans 15 fichiers, pas un seul avec un `timeout` explicite. Donc un réglage
// global, et non 172 arguments à poser un par un puis à oublier sur le 173ᵉ.

// ⚠️ L'ENVIRONNEMENT EST CHOISI FICHIER PAR FICHIER ici (`// @vitest-environment jsdom`, 31
// fichiers) ; les ~95 autres tournent en `node`, où il n'y a ni DOM ni `waitFor` à régler. L'import
// est donc DYNAMIQUE et sous garde : sans elle, chacun de ces 95 fichiers paierait le chargement de
// `@testing-library/dom` pour rien.
if (typeof document !== 'undefined') {
  const { configure } = await import('@testing-library/dom')
  configure({ asyncUtilTimeout: 5_000 })
}
