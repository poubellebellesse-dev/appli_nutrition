# État du projet — récapitulatif et reprise

> État complet du projet. Pour un démarrage rapide, lire d'abord `docs/FICHE_REPRISE.md`.
> Dernière mise à jour : **2026-07-26** (session 4 — P1c lot 4 : flags `onlyFavorites` /
> `varietyMode` codés, 7ᵉ couche d'exclusion `favoris`, registre à 18 couches ;
> `suggestAlternatives` REPORTÉ après le chantier contenu, voir §6). Sessions précédentes :
> `docs/RECAP_SESSION_2.md`, `docs/RECAP_SESSION_3.md`.

---

## 1. En une phrase

Application de nutrition et de planification de repas, **100 % locale, sans IA, sans compte**,
utilisable sur téléphone et PC par toutes les tranches d'âge. Phase actuelle : **P0, P1a, P1b-1,
P1b-2 et les lots 1-4 de P1c terminés** — diversification MMR (§6.6 ENGINE), explication avec règle
de non-citation (§6.7 ENGINE), `suggestMeals` bout-en-bout (§8 ENGINE), 3ᵉ et 4ᵉ garde-fous codés
(`assertNoTherapeuticClaim`, `assertCriticalLayersRan` — 4 garde-fous codés sur 5), puis les flags
`onlyFavorites` / `varietyMode` avec la 7ᵉ couche d'exclusion `favoris` (380 tests verts,
34 fichiers, typecheck propre). **`suggestAlternatives` est REPORTÉ après le chantier contenu** :
sur 10 recettes le mécanisme « plat frère » n'a aucun candidat (1 seule recette de poisson, 1 seule
de viande) — voir §6. **Prochaine étape : remplir le catalogue** (aliments, allergènes, recettes).

---

## 2. Où en est-on

```
Concept ─▶ Architecture ─▶ Moteur ─▶ Analyse marché ─▶ Design UI ─▶ Code ── P0 ✅ ── P1a ✅ ── P1b-1 ✅ ── P1b-2 ✅ ── P1c (lots 1-4 ✅) ─▶ CONTENU ▓▓
  ✅          ✅            ✅           ✅              ✅                                                                                     ⬅ ICI (catalogue réel)
```

| Livrable | Fichier | État |
|---|---|---|
| Architecture, données, cadre légal | `docs/ARCHITECTURE.md` | ✅ Complet |
| Moteur (couches, API, algorithmes) | `docs/ENGINE.md` | ✅ Complet |
| Design & parcours (8 écrans) | `docs/DESIGN.md` | ✅ Première passe validée |
| Maquettes HTML | `maquete claude design/…zip` | ✅ 8 écrans, mobile + bureau |
| Notes utilisateur | `Notes/Note designe.txt` | ✅ Traité et intégré |
| Code — P0 (fondations) | `catalog/build.mjs`, `app/src/engine/{domain,api}`, `app/src/data/catalog-loader.ts` | ✅ Terminé (3 commits) |
| Code — P1a (exclusion) | `app/src/engine/selection/{allergenes,regime,temps,equipement,exclusion-pass}.ts` | ✅ Terminé (1 commit), 60 tests verts |
| Code — P1b-1 (socle scoring) | `app/src/engine/nutrition/`, `app/src/engine/selection/scoring/` | ✅ Terminé et committé, 140 tests verts |
| Code — rang 0 + `variety` TAU + `requis` | `app/src/engine/domain/{planning,request}.ts`, `app/src/engine/selection/scoring/variety.ts`, `app/src/engine/selection/requis.ts` | ✅ Terminé et committé, 158 tests verts (23 fichiers), typecheck propre |
| Code — P1b-2 (passe de score + archétypes) | `app/src/engine/selection/scoring-pass.ts`, `archetypes.ts`, `app/src/engine/domain/archetype-ids.ts`, `app/src/engine/guards/index.ts`, `app/src/engine/api/index.ts`, `app/src/cli/try-engine.ts`, `app/src/engine/nutrition/energy-needs.ts`, `reference-intakes.ts` | ✅ Terminé et committé, 303 tests verts (29 fichiers), typecheck propre |
| Code — P1c lots 1-3 (diversification, explication, `suggestMeals` bout-en-bout) | `app/src/engine/selection/{similarity,diversify,explain}.ts`, `app/src/engine/guards/{banned-terms,index}.ts`, `app/src/engine/api/index.ts` | ✅ Terminé et committé (3 commits), 366 tests verts (33 fichiers), typecheck propre |
| Code — P1c lot 4 (flags `onlyFavorites`/`varietyMode`) | `app/src/engine/domain/{request,layer-ids}.ts`, `app/src/engine/selection/{favoris,exclusion-pass,index}.ts`, `app/src/engine/selection/scoring/variety.ts`, `app/src/cli/try-engine.ts` | ✅ Terminé et committé, 380 tests verts (34 fichiers), typecheck propre |
| Contenu — 12 recettes (poissons, viandes, fruits de mer) | `catalog/recipes/` | ✅ Terminé et committé, 10 → 22 recettes |
| Contenu — import CIQUAL 2025 (9 nutriments, 76 aliments) | `catalog/import-ciqual.mjs`, `catalog/sources/ciqual-mapping.yaml`, `catalog/sources/foods.yaml` | ✅ Terminé — valeurs `PROV-` remplacées par les valeurs ANSES |
| Contenu — montée à ~100 recettes | `catalog/recipes/` | ⬜ **Prochaine étape** |
| Code — `suggestAlternatives` (spec révisée : variante vs alternative) | `app/src/engine/selection/alternatives.ts` (à créer), `app/src/engine/api/index.ts` | ⬜ Reporté APRÈS le contenu — inobservable sur 10 recettes |

---

## 3. Décisions figées (ne pas rediscuter sans raison)

### Produit & architecture
- **PWA React + Vite + TypeScript**, SQLite WASM sur OPFS. Capacitor en porte de sortie.
- **Aucune donnée ne quitte l'appareil.** Pas de compte, pas de serveur, pas de télémétrie.
- **Aucune IA.** Le moteur est un solveur déterministe sous contraintes.
- **6 principes directeurs**, dont le n°6 « informer, jamais juger ».
- **Dépôt** : `github.com/poubellebellesse-dev/appli_nutrition`. Modèle : **Claude committe,
  l'utilisateur pousse** (le shell agent ne peut pas s'authentifier auprès de GitHub).

### Santé — le choix structurant
- **Pas de collecte de problèmes de santé.** Bibliothèque de thématiques **consultables** :
  l'utilisateur navigue, l'appli ne demande rien → hors champ dispositif médical.
- Les évictions strictes passent par le **régime déclaré**, jamais par une thématique.
- Poids / nutrition sportive = **chapitres d'information**, pas objectifs moteur.
- Mode avancé (macros) = **descriptif seul**, opt-in, jamais de compteur de reste.

### Moteur
- **Registre de 18 couches** à contrat commun (`SelectionLayer`), pas un pipeline figé (le code
  fait foi, voir `app/src/engine/domain/layer-ids.ts`). Une 5ᵉ couche d'exclusion `exclusions`
  (rejet perso, `excludedFoodIds`) a été ajoutée en session 2, une 6ᵉ couche `requis` (miroir
  dur, `MealContext.requiredFoodIds`) en session 3, puis `speed` a rejoint le registre comme 11ᵉ
  couche de SCORE, puis une 7ᵉ couche d'exclusion `favoris` (`onlyFavorites`) en session 4 —
  corrige aussi les anciennes mentions « 12 » puis « 14 » puis « 15 » puis « 16 » puis « 17 ».
  - Exclusion (7) : `allergenes` 🔒 · `regime` 🔒 · `exclusions` · `requis` · `temps` ·
    `equipement` · `favoris` (inerte hors `onlyFavorites`, motif le moins informatif → en dernier)
  - Score (11) : `nutri` · `preference` · `craving` · `variety` · `season` · `pantry` · `habit` ·
    `occasion` · `speed` · `topic` (v2, réserve) · `cost` (v3, réserve)
  - `speed` **EST désormais une couche du registre à part entière** (tranché et CODÉ) — poids par
    défaut nul, relevée par l'archétype « Rapide » (`app/src/engine/selection/scoring/speed.ts`).
    Voir `docs/ENGINE.md` §6.5.
- **Fonction pure synchrone**, catalogue en RAM. Pas de `Date.now`/`Math.random` (PRNG à graine,
  tie-break stable par id de recette).
- **Sécurité = post-conditions** : le moteur lève plutôt que de retourner un résultat non sûr.
  **Quatre garde-fous CODÉS** sur cinq (`assertNoDeclaredAllergen`,
  `assertScoringLayersNeverExclude`, `assertNoTherapeuticClaim`, `assertCriticalLayersRan`) — ne
  reste que `assertCalorieFloor`, en attente de `planWeek` — détail : `docs/ENGINE.md` §5.2.
- **Anticipation sans IA** = 4 statistiques locales (couche `habit`), réversibles.
- **Poids dynamiques** : `craving` passe **n°1 — CODÉ** dès qu'une envie est RÉELLEMENT exprimée,
  **uniquement dans le contexte « Aujourd'hui »** (suggestion ponctuelle) ; il reste à son socle
  bas en `planWeek` (pas de « moment T » pour les jours futurs — la semaine reste pilotée par
  `nutri`). Symétrie : **Aujourd'hui = envie · Semaine = équilibre.** `occasion` **devrait** passer
  n°2 pendant une occasion active (0 hors période) mais la couche `occasion` **n'est pas
  implémentée**. Détail complet : `docs/ENGINE.md` §6.5.
- **Équipement à trois niveaux** : `requis` (exclusion) · `accelere` (score) · `informatif`
  (ustensile, **n'exclut jamais** — jamais chargé par le moteur).
- **Archétypes — CODÉS (P1b-2), noms validés** : remplacent/généralisent l'idée initiale de
  « 4 préréglages nommés » — un vecteur de poids nommé sur les couches de score, jamais sur les
  couches critiques (`equilibre` défaut, `envie`, `decouverte`, `de_saison`, `mes_gouts`,
  `rapide`). Le sélecteur UI (onboarding/Paramètres) reste **P3**. Détail : `docs/ENGINE.md`
  §6.3 bis.

### Design
- **5 onglets** stables v1→v2 : Aujourd'hui · Semaine · Courses · Recettes · Savoir.
- **Geste = accélérateur**, toujours doublé d'un contrôle visible.
- **Planning à fenêtre glissante 2-14 jours.**
- **Badge de preuve** neutre (jamais rouge/vert), différenciateur n°1.
- Palette : sable/terracotta, Newsreader + Instrument Sans.
- **Thèmes d'accent curatés** (pré-validés contraste clair/sombre), pas de nuanceur libre ; le
  badge de preuve reste neutre quel que soit le thème.

### Média, stockage & modèle
- **Gestes de cuisine** : boucle WebP 3 s pour les gestes simples ; **3 clips MP4 de 3 s**
  (avant/pendant/après) + clip « quand ça rate » pour les gestes à risque ; galeries d'états
  (cuisson, caramel) en photos.
- **Recettes** : 1 photo hero par recette ; **vidéo 2-3 s seulement sur les recettes du jour**.
- **Cache à deux étages (option B)** : socle léger pré-caché (shell + `catalog.db` + boucles +
  photos d'ustensiles), médias lourds à la demande + bouton « tout télécharger ». **Aucun média
  en blob dans le `.db`.**
- **Modèle : 100 % gratuit, sans pub.** Un simple lien « à propos » vers site perso / réseaux.

### Communauté sans serveur & contenu
- **Aucun serveur, jamais** : pas de feed social ni de commentaires agrégés hébergés (principe 2).
- **Partage P2P par fichier** `.nutri-recipe` autonome (recette + photo embarquée + notes de
  l'auteur, opt-in) via le partage natif ; carte-image (Canvas) pour les réseaux.
- **Commentaires locaux** par recette et par étape (`user_recipe_note`), exportables avec le
  partage ; à l'import, marqués « non vérifié », n'écrasent rien.
- **Import** : une recette à la fois, faits + lien source, jamais la prose/photo, jamais de scrap
  massif ni d'API payante.
- **Recettes user/importées** toujours **« non vérifié »**, hors garanties allergènes/nutrition.
- **Favoris** (`user_favorite`) : marque-page rapide, n'influence pas le moteur par défaut.
- **Catégorie `loufoque`** (recettes virales) : facette de style ; contenu **original** obligatoire.
- **Alternatives** : substitution d'ingrédients **secondaires** (table `substitution`) avec
  **recalcul des allergènes** ; édition d'étape = variante perso « non vérifié ».

### Multi-langue (structure maintenant, contenu plus tard)
- Moteur **agnostique** (identifiants). UI via i18n ; **un `catalog.<lang>.db` par langue** ;
  unités abstraites (métrique/impérial).
- **Livrer v1 en français.** 2ᵉ langue = chantier défini. **Contenu santé = workstream juridique
  par marché** (v2+).

### Positionnement (analyse marché)
- Le carré vide : **le local de Paprika + le moteur d'Eat This Much + une bibliothèque
  scientifique**, le tout **100 % gratuit**. Avantage structurel : Jow ne peut pas faire « achète moins »
  (payé par les supermarchés).
- Ne PAS se positionner sur l'anti-gaspi (Frigo Magic l'occupe) : c'est une couche, pas le produit.

---

## 4. Décisions encore ouvertes

| # | Question | Reco |
|---|---|---|
| 1 | Restes en v1 ou v2 ? | **v1** — structurant, coûteux à greffer après |
| 2 | Choix final du badge de preuve | Variantes maquettées, à trancher à l'intégration |
| 3 | Libellé onglet « Savoir » | Provisoire (« Apprendre » ? « Comprendre » ?) |
| ~~4~~ | Nb de recettes et d'aliments v1 | **Revu à la hausse (2026-07-27)** — **200-300 recettes** (au lieu de 150-200) et **~200 aliments**. Les aliments sont FAITS (193). Conséquence à surveiller : le poids du `.db` et le critère de sortie P6 « bundle < 15 Mo » — 300 recettes sans média restent légères, ce sont les photos qui pèseront |
| 5 | Écran d'humeur → envie | Principe validé, pas maquetté |
| 6 | Hébergement PWA | Cloudflare / Netlify / GitHub Pages (statique, indifférent) |
| 7 | Chiffrement | Sans objet (aucune donnée de santé collectée) |
| 8 | **Mode cuisine** (multi-recettes, timers par étape) en v1 ou v1.5 ? | Feature nouvelle, sizeable — après le socle P0 |
| 9 | Cible iOS : PWA seule ou Capacitor + App Store ? | **PWA** par défaut (gratuit, pas de Mac) ; Capacitor si API native |
| ~~10~~ | Noms définitifs des **archétypes** (§ENGINE 6.3 bis) | **Fermé, tranché et CODÉ** (session du 2026-07-25) — `equilibre` (défaut) · `envie` · `decouverte` · `de_saison` · `mes_gouts` · `rapide` (`ArchetypeId`, `domain/archetype-ids.ts`) ; table des surcharges dans `selection/archetypes.ts` — §3 |
| 11 | Token de push GitHub (pour que l'utilisateur pousse les commits Claude) | À fournir par l'utilisateur — voir `docs/RECAP_SESSION.md` § Reprendre ici |
| ~~12~~ | Rattachement de `speed` au pipeline | **Fermé, tranché et CODÉ** — `speed` EST une couche du registre à part entière (11ᵉ couche de score, poids nul par défaut, relevée par l'archétype « Rapide ») ; le registre est désormais à 17 (6 exclusion + 11 score) — §3 |
| ~~13~~ | `requiredFoodIds` (miroir du rejet) : filtre dur ou gros bonus ? | **Fermé, tranché et CODÉ** — dur en contexte « Aujourd'hui » seulement, couche `requis` (`MealContext.requiredFoodIds`, hors de `HardConstraints`) — §3 |
| 14 | Alcool : ingrédient de cuisine vs boisson | Ingrédient v1 (décidé) ; une boisson alcoolisée n'est jamais un aliment du repas, mais un alcool employé **comme ingrédient** est agrégé dans le calcul nutritionnel comme les autres (option A, `docs/CONCEPTION_B_VIN_REPAS.md` §1.7) ; boisson servie = article de courses |
| 15 | Roue des goûts : rayons cuisine/saveur | v2 (v1 = 6 pôles sensoriels, gratuits) |
| 16 | Table courses non alimentaire (10 rayons) | Conçue ; à coder **quand `buildShoppingList` existera** (P1c+), pas avant |
| 17 | Accords vin masqués par défaut ou visibles et masquables ? | **Tranché** — masqués par défaut, `user_display.afficher_accords = false` (`docs/CONCEPTION_B_VIN_REPAS.md` §1.2, §4) |
| 18 | Miroir sans alcool obligatoire au build (`recipe_pairing`) ? | **Tranché** — oui, contrainte structurelle miroir de `evidence_sheet_id NOT NULL` (`docs/CONCEPTION_B_VIN_REPAS.md` §1.3, §4) |
| 19 | Facette `service` : facette ouverte ou colonne dédiée ? | **Tranché** — facette `recipe_facet` (`docs/CONCEPTION_B_VIN_REPAS.md` §2.3, §4) |
| 20 | Mode repas (entrée+plat+dessert) en v1 ou v1.5 ? | **Tranché** — v1.5, le quotidien reste le mode recette (`docs/CONCEPTION_B_VIN_REPAS.md` §4) |
| 21 | Accord vin porté par service ou par le repas entier ? | **Tranché** — porté par le plat seul, un conseil par repas (`docs/CONCEPTION_B_VIN_REPAS.md` §4) |
| 22 | Sens de l'écart nutritionnel (`nutrient.sens`) | **Tranché et CODÉ** (P1b-2) — union fermée `cible`/`plancher`/`plafond` (§4.2 ARCHITECTURE, §6.5 ENGINE précision 1) ; corrige l'écart symétrique de `scoreNutri` qui pénalisait un dépassement (fer, fibres) comme un manque |
| 23 | Vocabulaire de `trancheAge`/`niveauActivite` (`UserProfile`) | **Tranché et CODÉ** (P1b-2) — unions fermées `AgeBracket` (`18_29`·`30_49`·`50_64`·`65_plus`, âges représentatifs 24/40/57/72) et `ActivityLevel` (`sedentaire` 1,2 · `peu_actif` 1,375 · `actif` 1,55 · `tres_actif` 1,725) ; pas de palier athlète, aucune tranche mineure — la VNR du catalogue est ADULTE |
| 24 | Part du créneau dans la référence journalière (couche `nutri`) | **Tranché et CODÉ** (P1b-2) — table fixe `MEAL_SLOT_SHARE` : `petit_dejeuner` 0,25 · `dejeuner` 0,35 · `diner` 0,30 · `gouter` 0,10 (Σ=1) ; décision nouvelle, absente de la conception initiale (`docs/ENGINE.md` §6.5 précision 1) |
| ~~25~~ | Granularité nutritionnelle de l'import CIQUAL : 9 nutriments ou ~40 ? | **Tranché et FAIT (2026-07-26) — ~9**, et ce sont ceux que `build.mjs` portait déjà : énergie · protéines · lipides · glucides · fibres · **fer · calcium · vitamine C** · sodium. ⚠️ Ce n'est PAS la liste d'étiquetage (ni sucres ni acides gras saturés) : `fer` est porteur, c'est l'exemple de `sens: plancher` en §6.5 ENGINE et dans les fixtures de test. Aucun changement de schéma n'a été nécessaire. `food_nutrient` étant une table à lignes, passer à ~40 plus tard ne demandera pas de migration douloureuse |
| ~~26~~ | `suggestAlternatives` : l'ingrédient principal peut-il changer ? | **Tranché (2026-07-26)** — DEUX notions distinctes que §8 confondait. **Variante** = ingrédient principal INVARIANT (retrait d'un `optionnel`, substitution d'un ingrédient **secondaire**). **Alternative** = autre recette, ingrédient principal PEUT changer dans le même `Food.groupe` (autre poisson, autre viande, autre légume), **toujours dans les filtres de l'utilisateur**. Deux conséquences non triviales : (a) le mécanisme « plat frère » ne peut PAS être `argmax(similarity)`, qui pondère l'ingrédient principal à 0,5 et favorise donc de le GARDER — il faut « même groupe, ingrédient différent », puis classer sur les axes restants ; (b) la signature `(recipeId, dislikedFoodId)` de §8 est **insuffisante**, respecter les filtres impose de passer un `SuggestionRequest`. Codable seulement après le chantier contenu |
| ~~28~~ | Régimes emboîtés : étiquettes multiples sur chaque recette, ou hiérarchie dans le moteur ? | **Tranché et CODÉ (2026-07-26) — hiérarchie** (`DIET_CHAIN`, §6.3 ter ENGINE) : `vegetalien ⊂ vegetarien ⊂ pescetarien ⊂ omnivore`. L'égalité stricte de P1a rendait un utilisateur **omnivore** aveugle à 27 des 34 recettes (il ne voyait que les 7 plats étiquetés `omnivore`), et un pescétarien à 16. Les étiquettes multiples ont été écartées pour leur mode de défaillance SILENCIEUX — une étiquette oubliée fait disparaître une recette sans erreur ni trace. Deux garde-fous : la chaîne n'élargit jamais vers le plus permissif, et tout régime hors chaîne (`sans_gluten`, `halal`…) retombe sur l'égalité stricte |
| 29 | **Aliments sans valeur nutritionnelle CIQUAL** — que faire ? | **OUVERTE, à trancher avant la couche d'affichage.** CIQUAL ne renseigne AUCUNE énergie pour une poignée d'aliments réels (ricotta 19585, câpres 11040, ciboulette séchée 11095). État actuel = **refus à l'import** (`import-ciqual.mjs`), choisi comme état SÛR provisoire : il échoue bruyamment au lieu de mentir. Mais il appauvrit le catalogue pour une raison de données. ⚠️ Le problème n'est pas que l'affichage : la couche `nutri` NOTE la recette sur ces chiffres, donc un 0 silencieux dégrade aussi le CLASSEMENT. Trois pistes (utilisateur, 2026-07-27) : **(a)** marquer l'aliment « nutrition incomplète », propager le drapeau à la recette via `aggregateRecipe`, faire rendre `NEUTRAL_SCORE` à `nutri` pour ces recettes, et afficher un libellé — la seule qui traite la cause ; **(b)** estimer les valeurs depuis une autre source ou par recalcul macro (4/4/9 kcal/g), ce qui mélangerait des chiffres ANSES et des chiffres maison dans le même champ sans distinction — incompatible avec le badge de preuve SAUF si l'estimation est elle-même tracée, ce qui ramène à (a) ; **(c)** libellé seul (« source non ANSES », « pas de calcul pour cette recette ») sans toucher au moteur — insuffisant, le classement resterait faux. Reco : **(a)**, en réutilisant le mécanisme pour (b) si on veut estimer un jour |
| 27 | Table `substitution` : quand la créer ? | **Avec le contenu, pas avant** — quels couples ont du sens dépend des recettes qui existent. Le type `Substitution` et `Catalog.substitutions` existent déjà ; le loader retourne une Map vide (`catalog-loader.ts`, une ligne à changer) et un test verrouille ce vide. Le moteur n'aura rien à changer quand la table arrivera |

---

## 5. Écrans restant à maquetter

Réglages détaillés · sauvegarde/export/import · bandeau « persistance refusée » · écran
humeur→envie · mode sombre décliné sur chaque écran · **écran de partage** (fichier + carte-image) ·
**mode cuisine** (multi-recettes, timers) · **alternatives** d'une recette (substitutions, variantes).

---

## 6. Avancement du code & prochaine étape

### P0 — Fondations ✅ terminé (3 commits)

- [x] Chaîne de build : `catalog/build.mjs` (`node:sqlite`), échoue sur contenu/lexique invalide
- [x] Catalogue de test : 30 aliments, 10 recettes, 4 gestes de cuisine
- [x] Structure `engine/` : types + contrats `SelectionLayer`/`Engine`, registre de couches
- [x] Pont `app/src/data/catalog-loader.ts` + CLI `catalog:list`
- [x] Chaîne bout-en-bout prouvée : `.yaml`/`.md` → `catalog.db` → `Catalog` en mémoire

**Critère de sortie P0 atteint** : `catalog.db` généré depuis 10 recettes ; le build échoue sur une
recette invalide.

### P1a — Couches d'exclusion ✅ terminé (1 commit)

- [x] 4 couches d'**exclusion** : `allergenes` 🔒 · `regime` 🔒 · `temps` · `equipement` (inerte
  faute de données `equipment` dans le catalogue de test)
- [x] `runExclusionPass` (§6.4 ENGINE) — enchaînement des 4 couches, motif de rejet conservé
- [x] Garde-fou `assertNoDeclaredAllergen` (§5.2 ENGINE)
- [x] 60 tests verts

### P1b — Scoring — **conception §6.5/§6.3 bis ENGINE ; P1b-1 et P1b-2 codés et committés, P1c = prochaine étape (⬅ ICI)**

Conception détaillée : `docs/ENGINE.md` §6.5 et §6.3 bis, `docs/RECAP_SESSION.md`. Découpage
retenu :

### P1b-1 — Socle scoring ✅ terminé et committé

- [x] `food.saison_mois` + `food.toute_annee` au schéma réel (build + loader), dimensions indépendantes
- [x] Index dérivés à l'init du moteur : `recipeNutrients` (par portion), `recipeMainIngredient` (`engine/nutrition/`)
- [x] 7 fonctions de score pures (`engine/selection/scoring/`) + `NEUTRAL_SCORE = 0.5`
- [x] `season` en crédits pondérés par quantité ; catalogue porté à 76 aliments ; 5ᵉ couche d'exclusion `exclusions`
- [x] 140 tests verts, typecheck propre

### Lots livrés depuis P1b-1 ✅ terminés et committés (4 commits)

- [x] Rang 0 — migration `user.db` (faite tant que la base était vide, §5/§2.7 CONCEPTION_B_VIN_REPAS) : `MealHistoryEntry.origine` (`choisi`/`reste`, obligatoire) + `MealPlanEntry.service` (`CourseKind`)
- [x] `variety` — TAU réglable à trois crans (`VarietyTau` 3 | 7 | 14, défaut 7)
- [x] 6ᵉ couche d'exclusion `requis` (miroir dur d'`exclusions`, `MealContext.requiredFoodIds`)
- [x] 158 tests verts (23 fichiers), typecheck propre ; build 76 aliments / 10 recettes

### P1b-2 — Passe de score & archétypes ✅ terminé et committé

- [x] `SuggestionRequest.preferences` (`ReadonlyMap<FoodId, number>`, OBLIGATOIRE, −2…+2) — la
  couche `preference` avait un poids sans aucune source de données avant cet ajout
- [x] `nutrient.sens` (`NutrientSense` ∈ `cible`/`plancher`/`plafond`) — `scoreNutri` n'est plus
  symétrique : corrige la pénalisation d'un plat riche en fer pour sa richesse
- [x] `AgeBracket`/`ActivityLevel` fermés (`UserProfile`) ; `computeEnergyNeeds` (Mifflin-St Jeor ×
  PAL, retourne `Kcal | null`) ; `resolveReferenceIntakes` à deux modes (VNR à plat / ré-échelonné
  aux seuls macronutriments)
- [x] Part du créneau dans la référence journalière — table fixe `MEAL_SLOT_SHARE` (décision
  nouvelle, couche `nutri`)
- [x] `runScoringPass` : résolution du poids effectif (`weights` explicite > bascule `craving` >
  archétype > `defaultWeight`), couches à poids ≤ 0 non exécutées, normalisation Σ=1, breakdown =
  contributions PONDÉRÉES, tie-break stable par id de recette
- [x] Second garde-fou CODÉ `assertScoringLayersNeverExclude` + extension de `PipelineTrace`
  (`scoringCandidateCount`, `scoringLayerCounts`) — sans elle le garde-fou ne pouvait pas observer
  la violation qu'il devait attraper
- [x] `createEngine` réel (`attachDerivedIndexes` à l'init, `version`/`catalogVersion`/`layers`/
  `layer(id)`) ; les 8 méthodes d'orchestration lèvent « non implémenté (P1c) »
- [x] 6 archétypes CODÉS, noms validés (`selection/archetypes.ts`, `domain/archetype-ids.ts`)
- [x] `speed` rejoint le registre comme 11ᵉ couche de score (17 couches au total)
- [x] Bascule dynamique de `craving` (poids brut 0.50, ≈0.40 normalisé, envie RÉELLEMENT exprimée)
- [x] Banc CLI `engine:try` (`app/src/cli/try-engine.ts`)
- [x] 303 tests verts (29 fichiers), typecheck propre

### P1c lots 1-3 — Diversification, explication, `suggestMeals` bout-en-bout ✅ terminés et committés (3 commits)

- [x] Diversification MMR (§6.6 ENGINE) — `engine/selection/similarity.ts` (similarité pondérée :
  ingrédient principal 0,5 · profil sensoriel 0,3 · famille de cuisine 0,2 ; texture catégorielle,
  comme `craving` ; piège absence ≠ égalité codé et documenté) + `diversify.ts` (boucle gloutonne
  `argmax(score − λ·simMax)`, MAX et non moyenne, `DEFAULT_MMR_LAMBDA = 0.4` — à calibrer)
- [x] Explication (§6.7 ENGINE) — `engine/selection/explain.ts` : règle de non-citation des couches
  dont la contribution ne discrimine aucun candidat (ÉTEND la spec « top 3 par contribution »)
- [x] 3ᵉ garde-fou CODÉ `assertNoTherapeuticClaim` — lexique banni dupliqué dans
  `engine/guards/banned-terms.ts`, synchronisation garantie par
  `tests/banned-terms-consistency.test.mjs` ; `BANNED_TERMS` exporté de `catalog/build.mjs`
  derrière une garde `isMainModule()`
- [x] `suggestMeals` bout-en-bout (§8 ENGINE) — `engine/api/index.ts`, `runSuggestMeals` :
  exclusion → `assertNoDeclaredAllergen` → score → classement → diversification → explication →
  `assertNoTherapeuticClaim`
- [x] 4ᵉ garde-fou CODÉ `assertCriticalLayersRan`
- [x] `NoViableRecipeError` porte désormais la `RejectionSummary` complète (§8.3 ENGINE)
- [x] `EngineDiagnostics.weights` complet (`ScoreWeights` entier, zéros pour les couches non
  implémentées)
- [x] `createEngine(catalog, opts?)` accepte une horloge injectée optionnelle
  (`CreateEngineOptions.now?: () => number`) pour `dureeMs`
- [x] `SuggestionRequest` gagne `mmrLambda?` et `skipDiversification?`
- [x] Banc CLI `engine:try` passe désormais par `suggestMeals` — la « limite d'API » documentée
  §8 ENGINE est levée
- [x] 366 tests verts (33 fichiers), typecheck propre

### Contenu lot 1 — 12 recettes + import CIQUAL ✅ terminé

- [x] 12 recettes écrites sur les aliments EXISTANTS (aucune dépendance CIQUAL) : le goulot n'était
  pas les aliments — 76 aliments couvraient déjà 6 poissons et 3 viandes — mais les recettes, à
  1 poisson et 1 viande. Après : **6 poissons, 4 viandes, 2 fruits de mer**, 10 → 22 recettes. Le
  mécanisme « plat frère » de la décision 26 a enfin des candidats
- [x] `catalog/import-ciqual.mjs` — lecteur XML **sans aucune dépendance ajoutée** (l'export ANSES
  est un dump relationnel très régulier ; le `.xls` distribué en parallèle est un binaire BIFF que
  Node ne sait pas lire, d'où le choix du XML)
- [x] `catalog/sources/ciqual-mapping.yaml` — appariement `food_id` → `alim_code` **écrit et relu à
  la main**, 76 lignes. Jamais automatique : une recherche « saumon » remonte « Rillettes de
  saumon », « Huile de saumon » et « Saumon fumé » avant « Saumon, élevage, cru », et une valeur
  nutritionnelle fausse ne se voit pas — elle se propage dans tout le moteur
- [x] Les 76 aliments portent désormais leur vrai `code_ciqual` et les valeurs ANSES 2025.
  **Mesuré : 212 des 584 valeurs inventées (36 %) étaient fausses de plus de 25 %** — jusqu'à
  2400 % sur le fer du beurre, 817 % sur le calcium de la coquille Saint-Jacques
- [x] Réécriture CHIRURGICALE de `foods.yaml` (ligne à ligne), pas un `parse`+`stringify` : le
  fichier porte ~45 lignes de commentaires justifiant les choix éditoriaux de saisonnalité, qu'un
  aller-retour YAML aurait silencieusement détruites
- [x] Source ANSES (69 Mo) **non versionnée** — `.gitignore`, procédure de récupération dans
  l'en-tête de l'importeur. `npm run catalog:ciqual -- --check | --write`
- [x] 380 tests verts (34 fichiers), typecheck propre, build 76 aliments / 22 recettes

### Contenu lot 2 — 47 aliments, 12 recettes, chaîne des régimes ✅ terminé

- [x] **47 aliments ajoutés** (76 → 123), dont **16 herbes, épices et condiments** : le catalogue
  n'en avait que DEUX, sel et poivre. Écrire des dizaines de recettes de plus sur cette seule base
  les aurait rendues indiscernables — l'assaisonnement est ce qui distingue un plat. Valeurs
  CIQUAL, aucune inventée
- [x] **12 recettes** (22 → 34) exploitant les nouveaux ingrédients : pesto, chili au cumin,
  porridge à la cannelle, gigot au thym, velouté de potiron, taboulé, colin au fenouil, poulet au
  curry, salade de flageolets, merlu pané, tofu laqué, soupe de pois cassés. Premières recettes de
  **petit-déjeuner** et de **fête** du catalogue
- [x] **Chaîne d'inclusion des régimes** (décision 28, §6.3 ter ENGINE) — `DIET_CHAIN` dans
  `selection/regime.ts`. Mesuré avant/après sur le catalogue réel : `omnivore` 7 → 34 recettes
  visibles, `pescetarien` 11 → 27, `vegetarien` 11 → 16
- [x] Les deux tests d'intégration du régime vérifient désormais des **propriétés** (rien de trop
  permissif ne passe · les plats végétaliens passent bien) plutôt qu'un nombre : recompter la règle
  de la couche dans le test rejouerait simplement le bug s'il y en avait un
- [x] 387 tests verts (34 fichiers), typecheck propre, build 123 aliments / 34 recettes

### P1c lot 4 — Flags `onlyFavorites` / `varietyMode` ✅ terminé et committé

- [x] 7ᵉ couche d'EXCLUSION `favoris` (`engine/selection/favoris.ts`) — registre à **18** entrées
  (7 exclusion + 11 score). Le flag §8.1 aurait pu rester un pré-filtre du set initial ; en faire
  une couche fait tomber le motif « hors favoris » dans `RejectionSummary`, donc dans l'entonnoir
  du banc. Placée **en dernier** : c'est le motif le moins informatif, il ne doit en masquer aucun
- [x] `SuggestionRequest.favoriteRecipeIds` (`ReadonlySet<RecipeId>`, **OBLIGATOIRE**) — ajout à la
  conception : §8.1 ne spécifiait qu'un booléen, sans jamais dire d'où venait la liste. Même défaut
  que `preferences` avant P1b-2 (un flag sans source de données). Set vide + `onlyFavorites: true`
  → `NoViableRecipeError`, comportement voulu (miroir de `requis`)
- [x] `SuggestionRequest.varietyMode` (`'auto' | 'surprise' | 'classiques'`) câblé jusqu'à
  `scoreVariety`, qui portait déjà le paramètre `override` inutilisé depuis P1b-1
- [x] `VarietyOverride` : `'classics'` → `'classiques'` — aligné sur les autres unions fermées du
  domaine (`MealOrigin`, `NutrientSense`, `ArchetypeId`), toutes en français ; évite une table de
  traduction entre `VarietyMode` et `VarietyOverride`
- [x] Banc CLI : `--favoris`, `--only-favoris`, `--variete`, tous trois rejoués par la commande
  « Rejouer » et visibles dans l'en-tête
- [x] 380 tests verts (34 fichiers), typecheck propre

> ⚠️ **Mesuré sur le catalogue de test : `--variete` déplace les SCORES sans changer l'ORDRE.**
> L'historique du banc est vide, donc les 10 recettes ont la même récence et la même familiarité —
> l'override les décale toutes du même montant (`auto` 57,6 · `surprise` 65,5 · `classiques` 49,7
> en tête de classement). L'effet sur le classement demande un historique réel, exactement comme la
> calibration de λ. `onlyFavorites`, lui, agit bien (entonnoir : 9 candidats → 2).

| Sous-étape | Contenu |
|---|---|
| ✅ **P1b-1** | Prérequis données (`food.saison_mois` + flag « toute l'année/staple », §ARCHI 4.2) + index calculés à l'**init du moteur** (`recipeNutrients`, `recipeMainIngredient`, dans `engine/nutrition/`) + les 7 fonctions de score (`nutri` · `preference` · `craving` · `season` · `variety` + `speed` + `habit` minimal) + tests unitaires |
| ✅ **P1b-2** | Passe de score pondérée (`runScoringPass`) + les 6 archétypes CODÉS (§ENGINE 6.3 bis) + poids dynamique CODÉ de `craving` (`occasion` reste non câblée, couche absente) + tie-break déterministe par id + banc CLI `engine:try` |
| ✅ **P1c lots 1-3** | Diversification MMR (§ENGINE 6.6) + explication avec règle de non-citation (§ENGINE 6.7) + `suggestMeals` bout-en-bout (§ENGINE 8) + 3ᵉ et 4ᵉ garde-fous CODÉS |
| ✅ **P1c lot 4** | Flags `onlyFavorites` (7ᵉ couche d'exclusion `favoris`) + `varietyMode` (override de `variety`) + `--favoris`/`--only-favoris`/`--variete` au banc CLI |
| ✅ **Contenu, lot 1** | 12 recettes (6 poissons, 4 viandes, 2 fruits de mer au lieu de 1/1/0) + import CIQUAL 2025 des 76 aliments |
| **Contenu, lot 2** ⬅ prochaine étape | Montée à ~100 recettes, puis `suggestAlternatives` (décision 26) sur un catalogue où le « plat frère » a enfin des candidats |

> ⚠️ Rappel du plan (§12 ENGINE) : **ne pas écrire d'UI avant la phase P3.** Le moteur doit produire
> des repas crédibles en ligne de commande d'abord. Une UI branchée trop tôt rend douloureux le fait
> de remettre en cause le moteur.

---

## 7. Structure des fichiers

```
appli_nutrition/
├─ docs/
│  ├─ ETAT.md            ← CE FICHIER — reprise de session
│  ├─ ARCHITECTURE.md    ← périmètre · données · cadre légal
│  ├─ FICHE_REPRISE.md   ← ⭐ à lire en premier — état condensé + prochaines étapes
│  ├─ ENGINE.md          ← moteur · 18 couches · API · plan de lancement
│  ├─ DESIGN.md          ← 8 écrans · navigation · badge de preuve
│  ├─ RECAP_SESSION.md   ← récit session 1 (conception P1b)
│  ├─ RECAP_SESSION_2.md ← récit session 2 (P1b-1 codé, saison, contenu, 5ᵉ couche, conception variety/radar)
│  ├─ CONCEPTION_B_VIN_REPAS.md ← conception validée : accords vin, modes recette/repas (chantier B)
│  └─ STRATEGIE_DISTRIBUTION.md
├─ app/src/
│  ├─ engine/            ← moteur TS pur (domain, guards, selection, nutrition, planning, api)
│  │  ├─ domain/archetype-ids.ts     ← `ArchetypeId` (§ENGINE 6.3 bis)
│  │  ├─ nutrition/energy-needs.ts   ← `computeEnergyNeeds` (Mifflin-St Jeor × PAL, `Kcal | null`)
│  │  ├─ nutrition/reference-intakes.ts ← `resolveReferenceIntakes` (VNR à plat / ré-échelonné)
│  │  └─ selection/{scoring-pass,archetypes}.ts ← passe de score, archétypes (P1b-2)
│  ├─ data/              ← catalog-loader.ts (pont SQLite → Catalog)
│  └─ cli/               ← `catalog:list` + banc d'essai du moteur `engine:try` (`try-engine.ts`, §ENGINE 11.3)
├─ catalog/               ← sources éditables (YAML/MD) + build.mjs → catalog.db
├─ tests/                 ← tests d'intégration (frontières engine/, catalogue réel)
├─ maquete claude design/
│  └─ …handoff.zip       ← maquettes HTML (mobile + bureau)
├─ Notes/
│  └─ Note designe.txt   ← notes utilisateur (traitées)
└─ .claude/
```

---

## 8. Rappels de méthode (CLAUDE.md du dépôt)

- Tâche touchant 2+ fichiers ou comportement public → **plan ≤3 bullets avant d'exécuter**.
- Échec 2× de suite → **stop**, exposer l'état et l'hypothèse, demander.
- Jamais de commit/push/install/suppression **sans demande explicite**.
- Jamais lire/modifier de secrets.
- **Écrire les tests avant de refactorer** la logique métier critique (moteur = business-critical).