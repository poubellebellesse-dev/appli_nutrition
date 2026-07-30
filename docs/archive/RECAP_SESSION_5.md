# Récit — session 5 (2026-07-30)

> **Instantané daté. Ne pas réécrire.** Ce document décrit le projet tel qu'il était à la fin de
> cette session ; certaines affirmations sont peut-être déjà fausses. L'état courant est dans
> [FICHE_REPRISE.md](../FICHE_REPRISE.md) et [ETAT.md](../ETAT.md).

**19 commits.** Le projet est passé d'**un écran de démonstration** à une **application installable
de huit écrans**, avec des données qui survivent au rechargement.

| | Début de session | Fin |
|---|---|---|
| Écrans | 1 sur 8, sur données codées en dur | **8 sur 8**, sur données persistées |
| `user.db` | n'existe pas | schéma v3, 23 tables, migrations versionnées |
| Tests | 572 | **725** |
| Installable | non | manifest, icônes, service worker |
| Catalogue | 199 aliments · 241 recettes · 62 gestes | **+ 8 tips** |

---

## 1. Ce qui a été construit

**`user.db`** — la vraie fondation. Schéma complet de §4.3 dès la v1 (23 tables, y compris celles
sans consommateur : une migration est gratuite tant que la base est vide), migrations versionnées
sur `app_meta.schema_version`, trois versions livrées dans la session.

**Le système de design des maquettes** — jetons, polices auto-hébergées, barre à cinq onglets, mode
sombre, cibles tactiles de 48 px exprimées en `rem`.

**L'installabilité** — manifest, icônes générées par script, service worker de pré-cache, et le test
« zéro requête réseau » exigé par §6.6.

**Les huit écrans** — Premier lancement, Aujourd'hui, Semaine, Courses, Recettes, Détail d'une
recette, Vider le frigo, Savoir.

**Cinq ajouts au moteur** : `lockedEntries` (planWeek), `checkPlan`, `browseRecipes`,
`searchByPantry`, et le module `engine/search/`.

---

## 2. Ce que la session a appris

### Un garde-fou sans source de données ne garde rien

Le filtre allergènes est **critique et incontournable** — et il a tourné sur une **liste vide**
jusqu'à ce que l'écran de premier lancement existe : aucun écran ne demandait ses allergies à
l'utilisateur. Le code était juste, il n'avait pas de données.

C'est le même défaut que la couche `preference` en P1b-2, sur un sujet où les conséquences ne sont
pas du même ordre. Trois autres champs étaient dans ce cas : `tempsDisponibleMin` (codé `null`),
`MealHistory.windowDays` (lu par aucune couche), `user_display` (table sans accesseur).

### Trois trous dans §4.3 ARCHITECTURE, invisibles à la lecture

Ils ne sont apparus qu'en essayant de reconstruire une `SuggestionRequest` depuis la base :
`meal_history` (l'origine `choisi`/`reste` était décrite en prose sans table pour l'écrire),
`user_excluded_food`, et `meal_plan_entry.est_reste`.

### Le navigateur a dit ce que 600 tests ne disaient pas

**`installOpfsSAHPoolVfs` ne fonctionne pas sur le thread principal.** Les deux VFS OPFS de
sqlite-wasm testent `createSyncAccessHandle`, déclaré `[Exposed=DedicatedWorker]` — la méthode
n'existe pas hors d'un Worker, et **aucune en-tête COOP/COEP n'y change rien**. Typecheck et
`vite build` passaient parfaitement.

Correction : SQLite reste en mémoire, `user.db` devient un **fichier** OPFS lu au démarrage et
réécrit après chaque modification. La base reste synchrone — pas une ligne du store, des écrans ou
des 42 tests n'a changé.

### Les maquettes contredisaient leur propre cahier des charges

Le bloc commun exige « viser 7:1 sur le texte courant ». Mesuré sur le fond crème :

| | ratio | verdict |
|---|---|---|
| `#8a8077` — libellés d'onglets | 3,59:1 | échoue même AA |
| `#bd6a48` — accent en texte | 3,66:1 | échoue même AA |
| blanc sur `#bd6a48` — **le bouton principal** | 3,95:1 | échoue même AA |

Reproduire « au pixel près » aurait violé le cahier des charges joint au même bundle. Écarts
mesurés, bornés, documentés en §1 DESIGN.

### Le retour d'usage a trouvé ce que la relecture ne trouvait pas

Trois défauts signalés en utilisant l'application, aucun détecté par les tests :

1. **Le sélecteur de portions ne changeait rien** — l'écran lisait `uniteAffichage`, le libellé figé,
   au lieu de `quantiteG`. Le moteur avait raison **et le disait** : `scale-recipe.ts` contient un
   test nommé « `uniteAffichage` est laissée TELLE QUELLE ». Je ne l'avais pas suivi.
2. **Tout partait en grammes** — « 4 artichauts » devenait « 2,4 kg », « 1 pincée de sel » devenait
   « 8 g ». La sortie : multiplier le **nombre de tête** du libellé, qui porte déjà la bonne unité.
3. **« 18 ¾ g de beurre », « 0,13 citron »** — une mesure ne se fractionne pas, ce qui se compte
   s'arrondit au quart.

### Une relecture ciblée a trouvé le défaut le plus grave

`vite-plugin-sw.ts` hachait la **liste des noms** de fichiers pour la version du cache. Vrai des
bundles, **faux de tout ce qui vit dans `public/`** — `catalog.db`, polices, icônes ont des noms
fixes. Une mise à jour de contenu n'atteignait donc **jamais** un utilisateur installé.

Invisible en développement (pas de service worker) et à tout build où le code change aussi. Il ne se
serait manifesté qu'au premier ajout de recettes sans changement de code.

---

## 3. Ce qui a été refusé, et pourquoi

**Réécrire du français dans le moteur.** `scale-recipe.ts` refuse de mettre `uniteAffichage` à
l'échelle. Il a raison : sa sortie est de la **donnée**. La règle vit donc dans `ui/` — une erreur
d'accord est cosmétique, une quantité fausse ne l'est pas.

**Bricoler « Comprendre ».** §4.7 exige un badge de niveau de preuve sur chaque affirmation, §5
DESIGN en fait « l'élément le plus surveillé ». Afficher des affirmations santé sans leurs sources
serait exactement ce que §6.1 cherche à empêcher.

**Écrire des tips de nutrition humaine.** Les 8 livrés sont tous `biologie_aliment` — des faits,
aucune portée santé. Fixer la voix du produit et son exposition juridique est une décision
éditoriale, pas un lot de code.

**Inventer des tranches de citron.** Le catalogue ne dit nulle part combien de tranches fait un
citron. Le quart est ce qu'on peut garantir juste.

**Une seconde conversion grammes → unité d'usage.** `shopping-list.ts` la fait déjà, avec un arrondi
d'ACHAT. Le jour où la fiche recette doit rendre des pièces, il faudra l'EXTRAIRE, pas la recopier.

---

## 4. Décisions prises dans la session

| Sujet | Décision |
|---|---|
| Schéma `user.db` | Tout §4.3 dès la v1, tables sans consommateur comprises |
| Stockage navigateur | Base en mémoire + fichier OPFS. Aucun VFS OPFS ne tourne hors Worker |
| Polices | Auto-hébergées (162 Ko, sous-ensemble latin, SIL OFL) |
| Distribution | **Play via TWA d'abord**, iOS plus tard — le store n'est plus optionnel sur Android |
| Service worker | Fait main, pas `vite-plugin-pwa` : Workbox sert des stratégies réseau qu'on ne veut pas |
| Routage | Fait main, par hash, union discriminée `{ onglet, sousVue }` |
| Contraste | Écarts mesurés aux maquettes, au profit de l'accessibilité |
| Tips | Tuyau complet, contenu limité aux faits sans portée santé |

---

## 5. Ce qui reste, et ce n'est plus du code

- **Photos** : 0 sur 241 recettes
- **Lexique illustré** : §8.5 le promet, 62 fiches en texte seul
- **Tips `nutrition_humaine`** : décision éditoriale
- **« Comprendre »** : chapitres, fiches de preuve, revue juridique
- **Hébergement + TWA** : origine HTTPS, `assetlinks.json`, compte Play (25 $)
- **Export / import** : §7 mesures 3-5 — `user.db` ne se re-télécharge pas
- **Tests d'interface** : toujours zéro

---

## 6. La leçon de fond

**Le typecheck et 725 tests ne disent rien du comportement réel.** Sur les défauts de cette session,
**trois** ont été trouvés en utilisant l'application et **un** en relisant le code ; aucun par la
suite de tests, qui était pourtant verte à chaque commit.

Ce n'est pas un argument contre les tests — ils ont attrapé le `CHECK (portions > 0)` erroné, la
cascade destructrice d'`INSERT OR REPLACE`, et l'absence de `windowDays`. C'est un argument sur ce
qu'ils **ne peuvent pas** couvrir tant qu'aucun ne monte un écran.

---

## 7. Journal des lots — repris d'`ETAT.md` §6

> Déplacé ici le 2026-07-31 : ce journal décrit des lots **terminés et committés**, que git conserve
> déjà. Il encombrait l'état courant sans le renseigner. Conservé tel quel, comme tout instantané
> daté de l'archive.

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

### P1b — Scoring — **conception §6.5/§6.3 bis ENGINE ; P1b-1, P1b-2 et P1c codés et committés ✅**

Conception détaillée : `docs/ENGINE.md` §6.5 et §6.3 bis, `docs/archive/RECAP_SESSION.md`. Découpage
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
  ingrédient principal 0,5 · profil sensoriel 0,3 · famille de cuisine 0,2 — **⚠️ valeurs de
  l'époque, depuis remplacées PAR MESURE par composition 0,80 · sensoriel 0,15 · cuisine 0,05,
  décisions 30 et 32** ; texture catégorielle,
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
> L'historique du banc est vide, donc TOUTES les recettes ont la même récence et la même familiarité —
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
| ✅ **Contenu, lots 2-4** | Montée à 241 recettes / 199 aliments, chaîne des régimes, import CIQUAL réel, 30 recettes végétaliennes, lexique à 62 gestes |
| ✅ **Corrections mesurées** | Signature de recette (§6.6 bis) · pondération de similarité (§6.6 ter) · récence (§6.6 quater/quinquies) · couverture nutritionnelle (§5.1 bis) — décisions 29 à 32 |
| ✅ **Planification** | `suggestAlternatives` · `planWeek` + `checkCalorieFloor` (5ᵉ garde-fou) · `rerollSlot` · `planLeftovers` · `buildShoppingList` · `scaleRecipe` · couche `pantry` |
| ✅ **P3 lot 1 — PWA** | Chaîne complète prouvée dans un navigateur : `catalog.db` → SQLite WASM → mapping partagé → moteur → écran « Aujourd'hui » |
| **P3 lots 2+ — les écrans** ⬅ prochaine étape | Voir le tableau ci-dessous |

