# État du projet — appli_nutrition

> **Plafond : 200 lignes, tenu par la garde.** Ce fichier dit ce qui est construit, ce qui manque et
> où vit chaque chose. Il ne raconte pas comment on y est arrivé.
> **Cure du 2026-09-08 (problème P-14)** : 2 591 → 164 lignes. L'ancien fichier est **intégral** dans
> [archive/ETAT_2026-09-08_avant-cure.md](./archive/ETAT_2026-09-08_avant-cure.md) — rien n'a été jugé,
> tout a été déplacé. Les décisions (ex-§3, §4) vivent dans [decisions/](./decisions/README.md).
> L'état **vérifié du jour** et la prochaine étape vivent dans [FICHE_REPRISE.md](./FICHE_REPRISE.md) ;
> les quatre commandes qui font foi dans [../CLAUDE.md](../CLAUDE.md). Rien n'est recopié ici.

## 1. En une phrase

Planificateur de repas **100 % local, sans IA, sans compte**, téléphone et PC, toutes tranches d'âge.
Moteur TypeScript pur (solveur déterministe sous contraintes), catalogue SQLite construit au build
depuis des YAML/MD, PWA React statique, `user.db` en SQLite WASM sur OPFS. Capacitor en porte de sortie.
Six principes directeurs, dont le n° 1 : **la sécurité de l'utilisateur** (allergènes = contrainte
dure, aucune donnée sans source) et le n° 6 : informer, jamais juger.

## 2. Ce qui est construit

- **Moteur — complet.** Registre à 18 couches (7 exclusion + 11 score ; `occasion`, `topic`, `cost`
  déclarées non codées). `suggestMeals` avec diversification MMR et explication, `suggestAlternatives`,
  `planWeek`, `rerollSlot`, `planLeftovers`, `buildShoppingList`, `scaleRecipe`, 5 garde-fous.
  Quatre défauts corrigés **par mesure** (ingrédient caractéristique, pondération de similarité,
  récence, couverture nutritionnelle). Référence : [ENGINE.md](./ENGINE.md).
- **Catalogue — réel.** Valeurs CIQUAL 2025 (ANSES), plus aucun `PROV-`. Aliments, recettes, lexique de
  gestes, tips, fiches « Comprendre ». **Les comptes se lisent à la commande (`npm run build`, relevé de
  `CLAUDE.md` §« Vérifier »), jamais dans ce fichier.** ⚠️ Contenu Savoir **non relu par un tiers** — bloquant avant publication.
- **Données — `user.db`.** Schéma complet (§4.3 ARCHITECTURE), migrations versionnées, OPFS
  `opfs-sahpool`, export/import. Règle tenue : toute table que le store lit, il sait l'écrire. Les
  tables sans écran (`user_signal`, `meal_plan`, `shopping_list`, `user_recipe`…) existent déjà.
- **Interface — livrée.** 8 écrans spécifiés dans `DESIGN.md` §4, **12 codés, 12 testés**
  (recompter par `ls app/src/ui/screens/*.tsx`, jamais par cette phrase). Boucle complète :
  s'installer → allergies → suggestion → semaine → courses → cuisiner. PWA installable, service worker,
  socle d'accessibilité, routage par fragment, tutoriel qui traverse les menus.
- **Chantiers livrés** (chacun a son `CONCEPTION_*.md`) : mode cuisine, photos, gestes illustrés
  (clips), invariant origine animale (66/66b/66c), réservation matériel (65a-c), régime personnalisé,
  retours du test téléphone (`retour-1` → `retour-5`, `retour-5` clôturé le 2026-09-09).

```
Concept ✅ ─ Architecture ✅ ─ Moteur ✅ ─ Contenu ✅ ─ user.db ✅ ─ Design ✅ ─ 12 écrans ✅ ─▶ CONTENU & DISTRIBUTION ⬅ ICI
```

## 3. Décisions figées → `decisions/`

Sorties intégralement le 2026-09-08 : [decisions/README.md](./decisions/README.md) (8 fichiers par
thème). Toute référence « `ETAT.md` §3 » antérieure pointe là.

## 4. Décisions encore ouvertes → `decisions/registre.md`

Questions numérotées 1 → 82, barrées quand fermées : [decisions/registre.md](./decisions/registre.md).
**Ouvertes au 2026-09-09 : 2, 5, 6, 11, 52, 58, 65, 68, 70, 80, 82 — onze**, comptées sur les
numéros non barrés. **Deux** bloquent encore quelque chose : 65 (feux possédés), 68 (budget P6).
✅ **La 79 est FERMÉE le 2026-09-09** : `retour-6` n'attend plus qu'une place dans la file.
⏳ **La 82 ne bloque plus rien et n'est PAS fermée — sa fermeture est une décision, pas une
conséquence.** Sa cause est établie et sa piste (d) est livrée par `retour-5d` (2026-09-09) : la
clause « 6 froides sur 10 » de `retour-1` dépendait de **l'heure de la machine** — l'écran déduit
son créneau de `new Date().getHours()`, bascule à **14 h**, d'où **12/12 froides à 12 h** et
**7/12 à 14 h**. Les relevés d'août attribuaient l'écart à la croissance du catalogue **sans
contrôler l'heure** ; ne pas les citer comme cause. Le test épingle désormais sa pastille et mesure
les **deux** repas — 12/12 aux deux depuis `retour-5e`, plancher scellé à 0,9. Les pistes (a), (b)
et (c) sont sans objet. ⛔ **L'écran de production, lui, déduit toujours son créneau de l'horloge**
— c'est voulu, et c'est gardé sous témoin exécuté.

## 5. Les écrans

| § DESIGN | Écran | Moteur | Reste à faire (spec §4 DESIGN) |
|---|---|---|---|
| 4.1 | Aujourd'hui | `suggestMeals` | tags cliquables |
| 4.2 | Semaine | `planWeek` · `rerollSlot` · `planLeftovers` | carrousel « Changer », vue « 3 propositions », écarter, pouce-bas → `user_signal`, sélecteur convives (hors spec, nécessaire à `planLeftovers`) |
| 4.3 | Courses | `buildShoppingList` | autocomplétion sur le catalogue (ajout manuel = texte libre sans `FoodId`), impression/export, « Que cuisiner avec ? » |
| 4.4 | Recettes | `browseRecipes` · `engine/search/` | « Pourquoi pas ce plat ? » ; catégorie « Loufoque » absente du catalogue (contenu, pas code) |
| 4.5 | Vider le frigo | `searchByPantry` · couche `pantry` | substitution suggérée |
| 4.6 | Détail d'une recette | `scaleRecipe` · lexique | matériel, alternatives, notes |
| 4.7 | Savoir | lexique · tips · « Comprendre » | contenu non relu |
| 4.8 | Premier lancement | `user.db` · routeur · consentement | écran 4 « vos goûts » — `user_preference` travaille par aliment, l'écran propose des plats |
| — | Paramètres · Éditeur de recette · Mode cuisine · Fiche aliment | — | sans maquette dans `DESIGN.md` (P-15) |

Dev : `npm run dev`. Service worker et installation : `npx vite build && npx vite preview --host` seulement.

## 6. Structure des fichiers

```
docs/            FICHE_REPRISE.md ⭐ · ETAT.md (ce fichier) · decisions/ · PROBLEMES.md (registre P-nn)
                 ARCHITECTURE.md · ENGINE.md · DESIGN.md (font foi) · CONCEPTION_*.md (chantiers)
                 reference/ (PIEGES.md, licences, courriers) · archive/ (instantanés, jamais réécrits)
app/src/engine/  domain/ → nutrition/ guards/ → selection/ → planning/ → api/ (seule surface publique)
app/src/data/    catalog-loader.ts (navigateur, AUCUN import Node) · catalog-loader-node.ts (CLI, tests)
app/src/ui/      écrans, router.tsx, theme.css, user-store.ts
app/src/cli/     bancs de mesure (try-engine, stress-planning, compare-*, diag-*)
catalog/         sources/ (foods.yaml, ciqual-mapping.yaml) · recipes/ · lexicon/ · tips/ · build.mjs
tests/           intégration · tests/scelles/ (un fichier par lot, écrits AVANT le code)
atelier/         hors dépôt (gitignoré) : tri photos/clips, scripts de mesure
vite.config.ts · vitest.config.ts   SÉPARÉS EXPRÈS (root: 'app' faisait disparaître 44 tests)
```

Scripts : `npm test` · `npm run typecheck` · `npm run build` (catalog.db) · `npm run dev` / `preview` ·
`npm run catalog:ciqual -- --write` (seule écriture de valeurs nutritionnelles) · `engine:try` ·
`engine:plan` · `engine:plan-stress` · `engine:similarity` · `engine:couverture`.

## 7. Méthode

Vit dans `CLAUDE.md` (règles), `.claude/commands/` (cycle `/brief` → sceau → `/fin`) et
[reference/PIEGES.md](./reference/PIEGES.md) (index git partagé, `git stash` interdit, `git commit -F
-- <chemins>`, « aucun ✅ sans `git log --all -S` »). Rien n'est recopié ici.

## 8. Dette connue

Registre des **défauts** : [PROBLEMES.md](./PROBLEMES.md) (P-01 → P-21, audit du 06/09). Ci-dessous,
ce que les lots ont laissé ouvert **et qui n'y est pas encore** — une ligne chacune, le détail et les
mesures dans l'archive. Fermer une ligne = la retirer d'ici et le dire dans le lot qui la ferme.

**Sécurité et données**
- Le chemin OPFS (`installOpfsSAHPoolVfs`, survie au rechargement, `navigator.storage.persist`) n'a jamais tourné dans un vrai navigateur ; le seul essai téléphone passait par `vite preview` (P-17).
- La dernière écriture OPFS est différée d'un tour de boucle : fermer l'onglet dans l'intervalle la perd.
- `regimeExigePar` ne rend `omnivore` que pour `groupe === 'viandes'` : un extrait de viande hors groupe est classé laitier.
- La branche mammifère/volaille seule relit la provenance ; poissons, fruits de mer, miel : aucune vérification, erreur indétectable.
- `origine` est encore **optionnelle** (quatrième voie du 66b, ouverte) ; trois casts `as AnimalSource` dans les tests portent la forme interdite, voulu.
- Les gardes du gel (66c) ne voient que `app/src`, `catalog`, `tests` — pas `atelier/`, les configs, `.claude/`.
- `roquefort` : `lait` seul, tranché et sourcé (decisions/02) ; sulfites des fruits secs non tranchés (P-05).

**Moteur et planification**
- Le temps agrégé `prep + cuisson` ignore les repos — additionné en 8 sites.
- `Food.piquant` rempli, non branché (assumé).
- `recipeMainIngredient` n'est lu par aucune couche (bancs seulement) — à supprimer si les bancs sont figés.
- Lexique banni en deux copies (`build.mjs`, moteur) ; la garantie de non-divergence ne portait que sur les listes ; il sur-bloque par sous-chaîne (« soigneusement », « extraite »).
- L'explication distingue peu : mêmes trois phrases, ordre différent.
- `NUTRI_MIN_COVERAGE = 0,7` est un seuil de jugement, jamais calibré.
- Marge de borne `+ margePlatsSimples` dans `planWeek`/`rerollSlot` : coût de calcul non mesuré (`plan-stress` n'a pas de budget de durée).
- `recetteDepuisStockee` pose `estPlatSimple: false` en dur (choix : catégorie éditoriale).
- Restes orphelins possibles entre le geste « en reste » et la recomposition ; mesuré en mémoire, jamais à l'écran ; deux issues non tranchées (clause 3 de `retour-4`).
- La promesse de portions d'un reste n'est pas rejouée quand le réglage des convives change.
- Défaire « je mange dehors » / « en reste » meurt au rechargement (rien en base ne garde l'occupant précédent) ; un créneau qui portait un reste ne se défait pas (refus délibéré).
- L'écriture en base part même si l'écran a changé de créneau entre le clic et la réponse (l'affichage est gardé, pas l'écriture).
- « Changer » sur Semaine écrit le plan sans reprogrammer les rappels de préparation.
- Retrait posé avant un régime plus strict : les croisements porte × régime ne sont couverts par aucune clause (leçon `retour-2`).

**Interface et appareil**
- **La passe à l'œil sur téléphone n'est pas faite** — due par `retour-1`, `1b`, `2`, `3`, `4` ; une seule passe, protocole `CONCEPTION_RETOURS_TEST.md` §3. Le tutoriel n'a jamais été vu tourner hors jsdom ; son garde-fou de 4 s est posé au jugé.
- Capacitor : `npx cap add android` jamais lancé ; message `non_persistant` inadapté au natif ; pari `rem` → police système non vérifié ; sensibilité à la casse du serveur de production non vérifiée.
- Cache des clips sans limite de taille (l'« éviction LRU » de §7.1 ARCHITECTURE n'existe pas) ; `cache.addAll` atomique à l'installation, rien ne le rattrape ; pas de bouton « tout télécharger pour le mode avion » ; déviation « photos de recettes » non tranchée.
- Aucun test ne garde le contraste (trois échecs AA corrigés par jetons) ; thèmes d'accent curatés non faits ; `cuisine.tsx` hors échelle typographique (exception nommée « dette »).
- Le bouton « Froid » est passé à gauche de « Chaud » sans qu'aucun test ne le sache ; le placement du retour sur la fiche recette n'est verrouillé par aucun test.
- Écran Recettes : un re-rendu de trop après la première peinture ; le chrono de `#/recettes` (décision 61) n'a jamais été pris.
- Une mise à jour n'atteint l'utilisateur qu'après fermeture complète, sans le lui dire.
- Décocher un ustensile filtre allumé ne repasse par aucun garde-fou (choix) ; le sceau du 65b n'interdit pas d'oublier l'interrupteur à la fermeture ; `readOwnedEquipmentIds` rend `null` sur table vide ; champ « Combien en avez-vous ? » sans clause scellée.
- Mode cuisine : la formulation « de 17 à 3 min avant le service » n'est pas scellée ; 94 recettes exigent la plaque sans qu'une étape l'occupe ; 18 `dorer` ne tiennent que par trois cas nommés.
- Drapeaux : 7 cuisines sur 26 sans drapeau (voulu) ; non rendus sous Windows.
- 62 fiches du lexique en texte seul (3 gestes illustrés sur 62 en base, lot geste 2 arrêté par D5) ; catalogue sans densité ni marqueur de liquide ; deux conversions grammes → unité coexistent (`shopping-list.ts`, `ui/quantites.ts`).
- Photos : goulot = la récolte, pas le tri ; les neuf bases de `retour-5` (végétaliennes, chaudes) n'en ont pas.

**Tests et preuve**
- **Arbre VERT au 2026-09-09 à 19 h 32, zéro rouge** : la clause « 6 froides sur 10 » de `retour-1` ne lit plus l'heure (`retour-5d`), les 10 compteurs de recettes sont éteints depuis `retour-5c`. ▶ §4, décision 82.
- **Trois harnais séparés montent l'écran « Aujourd'hui »** : `retour-1` (créneau obligatoire depuis `retour-5d`), `retour-3` (le sien, antérieur), `aujourdhui.test.tsx`. Un montage partagé à créneau obligatoire rendrait l'oubli inexprimable — écarté du lot pour ne pas réécrire le harnais d'un fichier scellé.
- **`retour-5c` photographie `retour-1`** : toute clause ajoutée à l'un de ses six fichiers scellés rougit son empreinte. Rebasée une fois le 2026-09-09 (9 → 11 clauses, 23 → 30 `expect(`), sur décision de l'auteur.
- **Trois valeurs périmées survivent hors du périmètre de `retour-5c`**, qui ne pouvait toucher que ses six fichiers : un **titre de `it`** dans `photo-affichage.test.ts` (« les 201 recettes sans photo »), une chaîne dans `retour-4.test.tsx` (« 223 des 330 recettes ») et de la prose dans `65a.test.ts`. Aucune n'est assertée, donc aucune ne rougit — elles mentent en silence.
- Le test scellé de `retour-5c` a un angle mort mesuré : sa borne de mot rejette un nombre suivi d'un point ou d'une virgule, donc « … sur 330. » en fin de phrase lui échappe. Sans effet au 2026-09-09 (attrapé au balayage manuel), faux négatif réel ensuite.
- `node catalog/audit-mapping.mjs` **ne tourne plus dans le dépôt principal non plus** : `documents Ciqual/2025_11_03` y est absent (gitignoré). La cinquième commande de `CLAUDE.md` n'est mesurable nulle part en l'état.
- Une moitié de clause a été retirée du test scellé de `retour-4` (sceau levé puis remis, décision de l'auteur).
- Preuves par mutation et scripts de mesure **hors dépôt** (`atelier/`) : 65a, 65b, 65b-bis, 65c, 66b, 66c — cinq occurrences, à trancher une fois.
- `it.each` nourri par une table de production change le compte de tests sans diff de test (+90 sur `parcours.test.tsx`).
- Un test d'écran qui lit « la première carte » parie sur le catalogue ; la moitié « cadrage » du lot photos n'a qu'un témoin réel.
- Les assertions du 66b lisent le texte exact de `tsc` ; son 3ᵉ test lit `tsconfig.accepte.json` (scellé du 66) ; un garde-fou d'exécution a été retiré de `user-recipe.test.ts`.
- `getByRole` avec filtre de nom ≈ 480 ms par appel sur un écran chargé ; le test de propriété des allergènes n'énumère plus le powerset (à surveiller à chaque palier).
- `65b-bis` n'a pas de commit à lui (parti dans `d0c4bb3`).
- `vite-plugin-sw.ts` est classé binaire par git (`\0` littéral) ; un commentaire d'`export-recette.ts` est faux depuis les photos.
- `flan_oeufs_caramel` fond cuisson et repos en une étape ; le build ne vérifie que la forme d'une source.

**Avant publication**
- Relecture par un tiers du contenu Savoir (73 tips, 8 fiches) — bloquante.
- Deux trous sanitaires sans autorité lue : céphalopodes, cuisson de l'œuf.
- Revue juridique : « recommandée, non bloquante » en développement, pas pour une mise en ligne.
- `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, CI, linter, `npm audit` : P-10, P-11, P-21.

## 9. Ce qui est écarté

Voir [archive/README.md](./archive/README.md), qui apparie les pistes parallèles, et les blocs sortis
de `FICHE_REPRISE.md` (`archive/FICHE_REPRISE_extraits_*.md`).
