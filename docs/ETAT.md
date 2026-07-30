# État du projet — récapitulatif et reprise

> État complet du projet. Pour un démarrage rapide, lire d'abord `docs/FICHE_REPRISE.md`.
> Dernière mise à jour : **2026-07-29** — fin de la session 4 : le moteur est complet (planification,
> restes, courses, alternatives, mise à l'échelle) et la **première tranche d'interface tourne dans
> un navigateur**. Récit daté de cette session : `docs/archive/RECAP_SESSION_4.md`.
> Sessions précédentes : `docs/archive/RECAP_SESSION_2.md`, `docs/archive/RECAP_SESSION_3.md`.
> Regard extérieur daté : `docs/archive/AUDIT_2026-07-27.md`.

---

## 1. En une phrase

Application de nutrition et de planification de repas, **100 % locale, sans IA, sans compte**,
utilisable sur téléphone et PC par toutes les tranches d'âge.

**Le moteur est complet.** Toutes les phases de sélection sont codées (P0 · P1a · P1b-1 · P1b-2 ·
P1c lots 1-4), puis le chantier CONTENU, puis la planification : `suggestMeals` bout-en-bout
(§8 ENGINE) avec diversification MMR (§6.6) et explication à règle de non-citation (§6.7),
`suggestAlternatives`, `planWeek`, `rerollSlot`, `planLeftovers`, `buildShoppingList`, `scaleRecipe`,
**les 5 garde-fous**. Registre à **18 couches** (7 exclusion + 11 score, dont **8 implémentées** —
`occasion`, `topic` et `cost` restent déclarées et non codées).

**Vérifié le 2026-07-29** : `npm test` → **572 verts (44 fichiers)** · `npm run typecheck` propre ·
`npx vite build` OK · `npm run engine:plan-stress` → **20/20 configurations saines**.

**Le catalogue est réel** : **199 aliments** aux valeurs CIQUAL 2025 de l'ANSES (plus aucun `PROV-`),
**241 recettes**, **62 gestes** de lexique — les cibles de la décision 4 sont dépassées. Le contenu a
servi de banc de mesure et a révélé quatre défauts du moteur, tous corrigés **par mesure et non au
jugé** : l'ingrédient caractéristique (§6.6 bis), la pondération de la similarité (§6.6 ter), la
règle de récence (§6.6 quater et quinquies), la couverture nutritionnelle (§5.1 bis).

**Prochaine étape : les écrans** (P3, DESIGN §4). La PWA tourne (`npm run dev`) mais **un seul écran
sur huit est livré**, volontairement — voir §6.
✅ Le préalable réel — **`user.db`** — est levé (2026-07-30) : schéma complet de §4.3 ARCHITECTURE
en v1, migrations versionnées, OPFS (`opfs-sahpool`). L'écran « Aujourd'hui » lit un profil, des
contraintes, des goûts et un historique **persistés** ; `requeteDemo()` a disparu.
⚠️ Le chemin OPFS n'a pas encore été exécuté dans un vrai navigateur (voir §9).

---

## 2. Où en est-on

```
Concept ─▶ Architecture ─▶ Moteur ─▶ Analyse marché ─▶ Design UI ─▶ Code ── P0 ✅ ── P1a ✅ ── P1b-1 ✅ ── P1b-2 ✅ ── P1c (lots 1-4 ✅) ── CONTENU ✅ ── suggestAlternatives ✅ ── planning ✅ ── restes ✅ ── liste de courses ✅ ── lexique ✅ ─▶ UI ▓▓ (1 écran / 8)
  ✅          ✅            ✅           ✅              ✅                                                                                                                  ⬅ ICI
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
| **CONTENU — import CIQUAL 2025 + catalogue v1** | `catalog/import-ciqual.mjs`, `catalog/sources/ciqual-mapping.yaml`, `catalog/sources/foods.yaml`, `catalog/recipes/` | ✅ Terminé et committé — **193 aliments** aux valeurs ANSES réelles (193 mappings vérifiés à la main), **212 recettes**. A remplacé 212 valeurs inventées sur 584, dont une erreur à 2 400 % |
| **Moteur — signature de recette** (§6.6 bis) | `app/src/engine/nutrition/signature.ts`, `app/src/engine/selection/similarity.ts` | ✅ Corrigé PAR MESURE — 6 modèles comparés à 100 puis 200 recettes. Similarité max 98,4 % → 82,9 % |
| **Moteur — pondération de similarité** (§6.6 ter) | `app/src/engine/selection/similarity.ts` | ✅ Corrigée PAR MESURE — 7 pondérations comparées, retenue 0,80 / 0,15 / 0,05. Paires > 60 % : 81 → 30 |
| **Moteur — récence de `variety`/`habit`** (§6.6 quater et quinquies, décision 31) | `app/src/engine/selection/scoring/{variety,habit}.ts`, `app/src/engine/domain/catalog.ts`, `catalog/build.mjs` | ✅ Corrigée PAR MESURE — 13 règles comparées sur paires jugées. `Food.sousFamille`, second déclencheur par famille, filtre de créneau. Déclenchements à tort 6/6 → **0/6**, ratés 1/7 → **0/7** |
| **Moteur — couverture nutritionnelle** (§5.1 bis, décision 29) | `app/src/engine/nutrition/nutrient-coverage.ts`, `app/src/engine/selection/scoring/nutri.ts`, `catalog/import-ciqual.mjs` | ✅ Terminé et committé — `nutri` s'abstient au lieu de noter un zéro inventé ; l'import ne refuse plus un aliment sans énergie |
| Contenu — 12 recettes (poissons, viandes, fruits de mer) | `catalog/recipes/` | ✅ Terminé et committé, 10 → 22 recettes |
| Contenu — import CIQUAL 2025 (9 nutriments, 76 aliments) | `catalog/import-ciqual.mjs`, `catalog/sources/ciqual-mapping.yaml`, `catalog/sources/foods.yaml` | ✅ Terminé — valeurs `PROV-` remplacées par les valeurs ANSES |
| **Contenu — état COURANT du catalogue** | `catalog/sources/foods.yaml`, `catalog/recipes/`, `catalog/lexicon/` | ✅ **199 aliments · 241 recettes · 62 gestes** — les deux cibles de la décision 4 (~200 aliments, 200-300 recettes) sont dépassées. Ⓐ Les lignes ci-dessus datent chacune de la clôture de son lot ; **celle-ci fait foi** |
| Code — `suggestAlternatives` (variante vs alternative) | `app/src/engine/selection/alternatives.ts`, `app/src/engine/nutrition/characteristic-ingredient.ts`, `app/src/engine/api/index.ts` | ✅ Terminé et committé — 451 tests verts (37 fichiers). Vérifié sur le catalogue réel : cabillaud → bar/colin/dorade, hachis de bœuf → veau/agneau/porc, dahl → haricots/pois chiches |
| Code — `planWeek` + `checkCalorieFloor` (§7.1) | `app/src/engine/planning/plan-week.ts`, `app/src/engine/guards/index.ts` | ✅ Terminé et committé — banc de stress à 20 configurations (`npm run engine:plan-stress`) |
| Code — `planLeftovers` (§7.3) | `app/src/engine/planning/plan-leftovers.ts` | ✅ Terminé et committé — 6 créneaux sur 21 deviennent des restes, gaspillage 26 → 2 portions pour 2 convives |
| Code — `buildShoppingList` (§7.4) | `app/src/engine/planning/shopping-list.ts` | ✅ Terminé et committé — 77 lignes rangées par rayon sur une semaine ; les restes font tomber les courses de 24 à 15 kg |
| Contenu — 30 recettes végétaliennes + 6 aliments (décision 37) | `catalog/recipes/`, `catalog/sources/foods.yaml` | ✅ Terminé et committé — plus aucun trou de couverture créneau × régime ; végétalien 14 j passe de 29/42 à **42/42** |
| Contenu — cohérence régime ⇄ ingrédients (décisions 38, 39) | `catalog/sources/foods.yaml`, `app/src/engine/domain/catalog.ts`, `tests/regime-coherence.test.ts` | ✅ Terminé et committé — 1 bug grave corrigé (miel dans une recette végétalienne), 6 étiquettes redressées, `Food.origineAnimale`/`deriveDe` en cascade (58 aliments annotés) |
| Contenu — conditionnements, pièces, fonds de placard (décisions 40, 41) | `catalog/sources/foods.yaml`, `app/src/engine/planning/shopping-list.ts` | ✅ Terminé et committé — 107 aliments conditionnés sur 199 ; liste 77 → 68 lignes |
| **Contenu — lexique de gestes** (décision 43) | `catalog/lexicon/`, `catalog/recipes/`, `tests/lexique-coherence.test.ts` | ✅ Terminé et committé **en deux passes** — 4 → **62 fiches**, 155 → **763 étapes** annotées sur 1 097 (70 %). Dernier point de contenu de l'audit du 2026-07-27 |
| Code — `scaleRecipe`, `rerollSlot`, couche `pantry` (décision 44) | `app/src/engine/planning/{scale-recipe,reroll-slot}.ts`, `app/src/engine/selection/scoring/pantry.ts` | ✅ Terminé et committé — 3 des 4 stubs restants ; `pantry` était déclarée au registre depuis le début et jamais implémentée |
| Code — PWA, première tranche | `vite.config.ts`, `vitest.config.ts`, `app/index.html`, `app/src/ui/`, `app/src/data/catalog-loader-node.ts` | ✅ Terminé et committé — React 19 + Vite 7 + Tailwind 4 + SQLite WASM. Écran « Aujourd'hui » branché sur le vrai moteur, `vite build` OK, 572 tests intacts |

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
| ~~4~~ | Nb de recettes et d'aliments v1 | **Revu à la hausse (2026-07-27)** — **200-300 recettes** (au lieu de 150-200) et **~200 aliments**. **Les deux cibles sont DÉPASSÉES** : 199 aliments, 241 recettes (2026-07-29). Conséquence à surveiller : le poids du `.db` et le critère de sortie P6 « bundle < 15 Mo » — 300 recettes sans média restent légères, ce sont les photos qui pèseront |
| 5 | Écran d'humeur → envie | Principe validé, pas maquetté |
| 6 | Hébergement PWA | Cloudflare / Netlify / GitHub Pages (statique, indifférent) |
| 7 | Chiffrement | Sans objet (aucune donnée de santé collectée) |
| 8 | **Mode cuisine** (multi-recettes, timers par étape) en v1 ou v1.5 ? | Feature nouvelle, sizeable — après le socle P0 |
| 9 | Cible iOS : PWA seule ou Capacitor + App Store ? | **PWA** par défaut (gratuit, pas de Mac) ; Capacitor si API native |
| ~~10~~ | Noms définitifs des **archétypes** (§ENGINE 6.3 bis) | **Fermé, tranché et CODÉ** (session du 2026-07-25) — `equilibre` (défaut) · `envie` · `decouverte` · `de_saison` · `mes_gouts` · `rapide` (`ArchetypeId`, `domain/archetype-ids.ts`) ; table des surcharges dans `selection/archetypes.ts` — §3 |
| 11 | Token de push GitHub (pour que l'utilisateur pousse les commits Claude) | À fournir par l'utilisateur — voir `docs/archive/RECAP_SESSION.md` § Reprendre ici |
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
| ~~26~~ | `suggestAlternatives` : l'ingrédient principal peut-il changer ? | **Tranché (2026-07-26)** — DEUX notions distinctes que §8 confondait. **Variante** = ingrédient principal INVARIANT (retrait d'un `optionnel`, substitution d'un ingrédient **secondaire**). **Alternative** = autre recette, ingrédient principal PEUT changer dans le même `Food.groupe` (autre poisson, autre viande, autre légume), **toujours dans les filtres de l'utilisateur**. Deux conséquences non triviales : (a) le mécanisme « plat frère » ne peut PAS être `argmax(similarity)`, qui pondère l'ingrédient principal à 0,5 et favorise donc de le GARDER — il faut « même groupe, ingrédient différent », puis classer sur les axes restants ; (b) la signature `(recipeId, dislikedFoodId)` de §8 est **insuffisante**, respecter les filtres impose de passer un `SuggestionRequest`. **CODÉ le 2026-07-28** (§8.4 ENGINE) — `engine/selection/alternatives.ts`. A exigé une TROISIÈME notion d'ingrédient, mesurée séparément des deux autres : l'ingrédient CARACTÉRISTIQUE = le plus lourd d'un groupe DÉFINISSANT (viandes, poissons, fruits de mer, légumineuses), repli sur le plus lourd sinon. Sur 29 recettes il diverge du plus lourd, et les 29 fois il a raison (« Hachis de bœuf aux pommes de terre » est un plat de bœuf). ⚠️ `œufs` volontairement exclu des groupes définissants — l'y mettre fait de « Clafoutis aux framboises » un plat d'œuf, MÊME piège qu'en §6.6 quinquies |
| ~~28~~ | Régimes emboîtés : étiquettes multiples sur chaque recette, ou hiérarchie dans le moteur ? | **Tranché et CODÉ (2026-07-26) — hiérarchie** (`DIET_CHAIN`, §6.3 ter ENGINE) : `vegetalien ⊂ vegetarien ⊂ pescetarien ⊂ omnivore`. L'égalité stricte de P1a rendait un utilisateur **omnivore** aveugle à 27 des 34 recettes (il ne voyait que les 7 plats étiquetés `omnivore`), et un pescétarien à 16. Les étiquettes multiples ont été écartées pour leur mode de défaillance SILENCIEUX — une étiquette oubliée fait disparaître une recette sans erreur ni trace. Deux garde-fous : la chaîne n'élargit jamais vers le plus permissif, et tout régime hors chaîne (`sans_gluten`, `halal`…) retombe sur l'égalité stricte |
| ~~29~~ | **Aliments sans valeur nutritionnelle CIQUAL** | **Tranchée et CODÉE (2026-07-27)** — piste **(a)** retenue, la seule qui traite la cause. CIQUAL laisse des cases vides (non déterminé) que `aggregateRecipe` compte comme des zéros, ce qui confond « on ne sait pas » et « il n'y en a pas ». Le défaut touchait le CLASSEMENT, pas l'affichage, et dans les DEUX SENS selon le `NutrientSense` : sur un plancher le trou fait paraître la recette pauvre et la PÉNALISE (« Truite aux amandes », 76 % de la masse sans vitamine C) ; sur un plafond il la fait paraître inoffensive et la RÉCOMPENSE (« Gratin de blettes à la brousse », 64 % sans sodium). C'était donc du bruit, pas un biais. **Mécanisme** : `computeNutrientCoverage` produit la part de la masse connue par nutriment (index `recipeNutrientCoverage`), `scoreNutri` s'ABSTIENT sous `NUTRI_MIN_COVERAGE = 0,7` au lieu de noter un zéro inventé, `NutrientSummary.coverage` remonte l'info pour un futur libellé. Effet mesuré : 13 recettes sur 212 perdent un nutriment, aucune ne les perd tous. **L'import ne refuse plus** un aliment sans énergie — le garde-fou façonnait le catalogue sur ce que l'ANSES a documenté plutôt que sur la cuisine (la ricotta avait dû être remplacée). ⚠️ Le seuil de 0,7 est un JUGEMENT, pas une mesure : aucun jeu de cas jugés n'existe pour « ce nutriment est-il notable ». ⚠️ Reste INTERDIT : inventer une valeur ou la recalculer depuis les macros et l'écrire dans le même champ que les chiffres ANSES. Une seconde source (USDA, CoFID) reste possible À CONDITION d'être tracée par valeur — le vecteur de couverture est ce qui le rendra faisable ; chercher d'abord une entrée voisine DANS CIQUAL |
| ~~30~~ | Modèle de similarité : quel « ingrédient principal » ? | **Tranché PAR MESURE et CODÉ (2026-07-27)** — §6.6 bis ENGINE. Six modèles comparés à 100 puis 200 recettes sur deux jeux de paires (`compare-similarite.ts`). Retenu : **les 3 ingrédients non optionnels les plus lourds, chevauchement pondéré** (`recipeSignature`). L'ancien modèle (un seul ingrédient, le plus lourd) avait **1 point** d'écart entre plats-à-séparer et plats-proches, contre 18 pour le retenu. Deux idées ont été TESTÉES ET ÉCARTÉES : la pondération par rareté (17 pts, et rend la similarité dépendante du catalogue entier) et le seuil de masse à 5 % (aucun gain, et écarterait l'ail de « pâtes à l'ail et à l'huile »). Doubler le catalogue n'a pas déplacé les scores d'un dixième — la conclusion n'est pas un artefact d'échantillon |
| ~~31~~ | **Règle de RÉCENCE de `variety`/`habit`** | **Tranchée PAR MESURE et CODÉE (2026-07-27)** — §6.6 quater et quinquies ENGINE. Treize règles comparées sur des paires jugées pour CETTE question, distincte de la similarité (« ai-je mangé ça récemment » n'est pas « ces plats se ressemblent-ils »). **État final : 0 déclenchement à tort sur 6, 0 raté sur 7** (l'ancienne règle : 6/6 et 1/7). Trois éléments, chacun mesuré :
(a) **signature repliée par sous-famille** — `Food.sousFamille` (facultatif, 25 aliments sur 193, 12 familles) replie `poulet_blanc`/`poulet_cuisse` sur `poulet`, dans un SECOND index `recipeFamilySignature` ; la similarité garde `recipeSignature`, la diversification devant encore distinguer les morceaux. Rattrape 16 paires légitimes (lentilles vertes × corail 38 → 90 %, gigot × navarin 14 → 65 %, huit paires de poulet). (b) **second déclencheur** — une même sous-famille DÉCLARÉE pesant ≥ 40 % des deux côtés suffit. La restriction aux familles déclarées est essentielle : les clés d'une signature repliée mélangent familles et `foodId` bruts, et sans filtre partager `oeuf` rapprocherait une mousse au chocolat d'une omelette (3 faux sur 6). (c) **filtre de créneau** — une entrée d'historique dont le `creneau` n'est pas dans les `typesRepas` du candidat est ignorée POUR LE RAPPROCHEMENT PAR COMPOSITION (un clafoutis du goûter ne pénalise plus un gratin du dîner). ⚠️ Ce n'est PAS « même créneau que la demande » : poulet au déjeuner puis poulet au dîner reste répétitif, et la correspondance par `recipeId` exact n'est jamais filtrée.
**Deux pistes TESTÉES ET ÉCARTÉES** : le repli par `Food.groupe` (4/6 faux, 735 paires — « viandes » mélange bœuf, poulet, porc et agneau) et le modèle « ingrédient principal + secondaires à poids fixes » (2 à 3 ratés au lieu d'1 — les poids de rang détruisent l'écart réel entre 54 % et 43 % de protéine) |
| ~~32~~ | Pondération des trois signaux de similarité | **Tranchée PAR MESURE et CODÉE (2026-07-27)** — §6.6 ter ENGINE. **0,8 / 0,15 / 0,05** au lieu de 0,5 / 0,3 / 0,2. L'ancienne répartition, jamais vérifiée, laissait le sensoriel et la cuisine fabriquer **50 % de similarité entre deux plats sans aucun ingrédient commun** (« coq au vin » × « gigot d'agneau »). Sept jeux comparés ; les quasi-doublons ne perdent rien sur toute la plage (79 → 78 %), seuls les faux rapprochements tombent. **Pas 100/0/0** malgré son meilleur score brut : cinq salades froides sans ingrédient commun seraient alors à 0 % et la diversification n'y verrait aucune répétition |
| 27 | Table `substitution` : quand la créer ? | **Avec le contenu, pas avant** — quels couples ont du sens dépend des recettes qui existent. Le type `Substitution` et `Catalog.substitutions` existent déjà ; le loader retourne une Map vide (`catalog-loader.ts`, une ligne à changer) et un test verrouille ce vide. Le moteur n'aura rien à changer quand la table arrivera |
| 33 | **Codes de confiance CIQUAL — les importer ou non ?** | **OUVERTE, mesurée le 2026-07-28.** Le fichier CIQUAL donne, POUR CHAQUE VALEUR, un `code_confiance` (A→D) et un `source_code` bibliographique. `import-ciqual.mjs` **jette les deux**. Mesuré sur nos 1 728 valeurs : hors énergie, **34 % sont cotées C ou D** par l'ANSES elle-même (vitamine C 48 %, fibres 47 %, glucides 46 %). Une valeur C/D est souvent précisément une valeur EMPRUNTÉE à une table étrangère (la table des sources cite Paul & Southgate UK, Souci-Fachmann-Kraut DE) : **CIQUAL est déjà un recoupement**, et ajouter l'USDA reviendrait en partie à réimporter ce qu'elle a déjà emprunté. Piste : colonne sur `food_nutrient`, puis pondérer le vecteur de couverture (§5.1 bis) au lieu du binaire connu/inconnu. ⚠️ **PIÈGE** : l'énergie est à 191 D sur 192 **par construction** — « Energie, Règlement UE N° 1169/2011 » est CALCULÉE depuis les macros, pas mesurée. Pondérer naïvement la sortirait du scoring pour tout le catalogue. Mesurer avant de figer des poids |
| ~~34~~ | **Journées de planning sous le plancher calorique** | **LARGEMENT RÉSOLUE le 2026-07-28**, en trois temps et aucun des trois n'était celui que j'avais annoncé au départ. **(a)** Le diagnostic « catalogue trop léger » était FAUX — la meilleure journée possible atteignait déjà 2 127 kcal. **(b)** La cible nutritionnelle restante (§7.1) a été codée et mesurée INSUFFISANTE (+64 kcal) : l'énergie ne pèse que 2,8 % du score. **(c)** Le vrai correctif était double — `checkCalorieFloor` AVERTIT au lieu d'annuler (§6.5 demandait un écran d'avertissement, j'avais codé un refus), et les 30 recettes végétaliennes de la décision 37 ont enrichi le vivier. **Résultat mesuré** : le cas nominal (7 jours × 3 créneaux) passe de 1 038 kcal minimum avec 3 avertissements à **1 208 kcal minimum, ZÉRO avertissement**. ⚠️ **Reste ouvert** : les combinaisons extrêmes. « sans gluten NI lait NI œuf » remplit 16 créneaux sur 21, « végétalien + sans gluten » 36 sur 56. C'est une limite de contenu assumée, pas un défaut moteur — `planWeek` place l'optimum disponible |
| 35 | **Piquant des recettes — attributs posés, feature à faire** | **ATTRIBUTS POSÉS (2026-07-28), NON CÂBLÉS.** `Recipe.piquant` et `Food.piquant`, échelle 0→4 (0 pas piquant · 1 un peu · 2 moyen · 3 fort · 4 extrême), `null` = non renseigné et JAMAIS « doux ». Aucune couche ne les lit, aucune recette n'est annotée. **Pourquoi éditorial et pas calculé** : le piquant d'un plat ne se dérive pas de ses ingrédients — il dépend de la QUANTITÉ d'épice, de son RAPPORT au reste du plat et du MODE DE CUISSON (des épices sur du riz sec ne diffusent pas comme un mijoté), et aucune source ne tabule ce dernier facteur. **Sources examinées** : l'échelle de **Scoville** ne mesure que la capsaïcine, donc que le piment — ni poivre, ni moutarde, ni wasabi, ni gingembre. Et la pungence n'est pas un axe unique : capsaïcine et pipérine agissent sur TRPV1, l'isothiocyanate d'allyle et l'allicine sur TRPA1, d'où un wasabi qui monte au nez et retombe là où un piment s'installe. Une échelle par famille de molécule a été envisagée puis **écartée** (décision utilisateur) : trop fine pour être annotée honnêtement à la main. **Reste à trancher** : seuil de tolérance dans le profil, et effet moteur (exclusion dure vs score) |
| 36 | **Objectif calorique personnel — amendement à §6.5 ARCHITECTURE** | **TRANCHÉE (2026-07-28, décision utilisateur).** §6.5 interdisait TOUT objectif journalier, sans exception, les applis de nutrition étant un vecteur documenté de TCA. Amendement : un objectif personnel devient possible sous **quatre conditions cumulatives** — opt-in explicite, jamais par défaut, non mis en avant (enfoui dans les réglages avancés), et **aucun compteur de reste**. ⚠️ La quatrième n'est pas négociable : §6.5 identifie précisément « il te reste 340 kcal aujourd'hui » comme LE mécanisme de restriction, pas l'affichage d'un chiffre. Un objectif peut s'afficher À CÔTÉ du total du jour, jamais comme un solde qui se vide. `ARCHITECTURE.md` §6.5 est amendé en conséquence — la règle du projet veut que le document soit mis à jour, pas contourné. **Non implémenté** : c'est un sujet d'UI (P5), aucun code moteur concerné |
| ~~37~~ | **Trous végétaliens du catalogue** | **FERMÉE le 2026-07-28** — 30 recettes végétaliennes écrites : 13 petits-déjeuners, 11 goûters, 6 plats. Couverture par créneau × régime, cible 14 (fenêtre max §7.1) : petit-déjeuner végétalien **1 → 14** (et 17 → 30 pour tous les régimes), goûter **3 → 14** (27 → 38), plats végétaliens **8 → 14**. Plus aucun trou. A nécessité **6 nouveaux aliments** (199 au total) : boissons au soja / à l'amande / à l'avoine, sirop d'érable, dattes, raisins secs — le catalogue n'avait AUCUN lait végétal, ce qui rendait un petit-déjeuner végétalien quasi impossible à écrire. ⚠️ `miel` n'est PAS végétalien, d'où le sirop d'érable. Effet mesuré au banc de stress : végétalien 14 j × 3 passe de 29/42 à **42/42**, sans gluten de 20/21 à 21/21, sans lait de 19/21 à 21/21 |
| 38 | **Cohérence entre l'étiquette `regime` et les ingrédients** | **TROUVÉE ET CORRIGÉE le 2026-07-28**, en cherchant les effets de bord des 30 nouvelles recettes. ⛔ **Bug grave** : « Tofu laqué à la sauce soja et au sésame » se déclarait `vegetalien` et contenait du **MIEL**. Rien n'échouait — un utilisateur végétalien se voyait simplement proposer un produit animal, soit la promesse centrale de l'appli en défaut. Corrigé en remplaçant le miel par du sirop d'érable (la recette reste végétalienne et cohérente). ⚠️ **Six recettes** étaient étiquetées `vegetarien` alors qu'elles sont végétaliennes — défaut inverse et silencieux : elles disparaissaient des suggestions de qui pouvait les manger. Ré-étiquetées. C'est le mode de défaillance SILENCIEUX que la décision 28 reprochait aux étiquettes multiples : l'étiquette unique ne l'élimine pas, elle le déplace. **`tests/regime-coherence.test.ts` le verrouille désormais** à chaque build, dans les deux sens. ⚠️ Piège rencontré en écrivant la règle : le beurre, la crème et le miel ne sont dans AUCUN groupe animal (« matières grasses », « produits sucrés ») — s'en remettre au seul `Food.groupe` faisait passer « Radis au beurre » pour végétalienne |
| ~~39~~ | **Origine animale des aliments, en cascade** | **TRANCHÉE et CODÉE le 2026-07-28** (demande utilisateur, à la suite du bug du miel). `Food.origineAnimale` ∈ {`mammifere`, `volaille`, `poisson`, `fruit_de_mer`, `insecte`} et `Food.deriveDe` — l'origine se PROPAGE le long de la chaîne : `beurre_doux` → `lait_entier` → `mammifere`. **Pourquoi `Food.groupe` ne suffisait pas** : le beurre vit en « matières grasses », le miel en « produits sucrés » — aucun groupe animal. À l'inverse les boissons végétales portent « lait et produits laitiers » sans être animales. Les deux erreurs sont désormais impossibles. 58 aliments annotés sur 199 (15 mammifère, 5 volaille, 16 poisson, 8 fruit de mer, 1 insecte, 13 dérivés). Les fromages d'autres mammifères (feta, brousse, chèvre, roquefort) sont déclarés en SOURCE et non dérivés de `lait_entier`, qui est du lait de vache — les faire dériver de lui affirmerait quelque chose de faux. ⚠️ **FACTUEL, pas un régime** — même leçon que `types_repas`/`service` : `DIET_CHAIN` en déduit ce qu'elle veut, un futur filtre halal ou casher lira le même champ. Ne pas y encoder le régime. ⚠️ `resolveAnimalOrigin` porte une GARDE ANTI-CYCLE, testée : le build refuse les cycles, mais la fonction est appelable sur d'autres données et doit s'arrêter plutôt que figer l'appelant |
| ~~40~~ | **Conditionnements d'achat** | **TRANCHÉE et CODÉE le 2026-07-28** (règle donnée par l'utilisateur). `Food.conditionnementG` — un SEUL nombre par aliment, et on achète `⌈besoin ÷ paquet⌉` paquets : avec une plaquette de 250 g, 240 g de besoin donnent une plaquette, 260 g en donnent deux. Une échelle de tailles disponibles n'apporterait rien — deux plaquettes de 250 g valent une de 500 g au moment de payer. **107 aliments sur 199 conditionnés**, 92 laissés au poids : légumes, fruits, viandes et poissons se vendent à la coupe, leur inventer un paquet produirait des quantités fausses. Effet : « 70 g de beurre » devient une plaquette de 250 g, « 150 g de lait » une brique d'un litre, « 200 g d'œuf » 4 œufs. ⚠️ Reste côté INTERFACE : l'`unite` est `'g'`. Afficher « 4 œufs » ou « 1 plaquette » plutôt qu'un poids est un travail d'affichage — le moteur donne la quantité, pas sa formulation |
| ~~41~~ | **Unités d'affichage et bruit de la liste de courses** | **TRANCHÉE et CODÉE le 2026-07-28.** Trois ajouts issus d'une revue des USAGES de la liste, pas du code. **(a) `Food.poidsPieceG`** — « 3 carottes » plutôt que « 350 g », prime sur le conditionnement. ⚠️ UN SEUL poids moyen, pas petit/moyen/gros : trois tailles demanderaient à l'utilisateur laquelle il trouvera, information qu'il n'a pas au moment de planifier. **(b) `Food.fondDePlacard`** — sel, poivre, épices sèches écartés par défaut (`sel_fin` est « au goût » 163 fois au catalogue) ; 77 → 68 lignes. **(c) `ShoppingOptions.pantryFoodIds`** — « vider le frigo » (v1, table `user_pantry` déjà spécifiée). Ne viole PAS le principe n°2, qui interdit d'exfiltrer et non de demander ; et la règle « l'appli ne demande rien » de §6.2 vise les pathologies. Tout ou rien, jamais un décompte partiel. ⚠️ **Les cuillères ont été ÉCARTÉES de la liste** : on n'achète pas trois cuillères d'huile, on achète une bouteille — le conditionnement répond déjà. Et le catalogue porte DÉJÀ les cuillères sur la recette (`unite_affichage`, saisi à la main), plus juste qu'une conversion (une cuillère d'huile ≠ une cuillère de miel) |
| ~~42~~ | **`pourSlots` — la liste devait être rangeable par repas et par jour** | **CORRIGÉE le 2026-07-28.** §2 ARCHITECTURE exige une liste « rangeable par rayon / repas / jour ». `ShoppingListItem` portait le rayon et la tranche, mais l'agrégation DÉTRUISAIT l'information de repas : ranger par repas était impossible. ⚠️ **Le manque ne se voyait pas** — la liste avait l'air complète. Trouvé en ÉNUMÉRANT les usages à la demande de l'utilisateur, pas en relisant le code. Ajouter la provenance après coup aurait obligé à refaire l'agrégation |
| ~~43~~ | **Lexique de gestes — 4 fiches pour 93 étapes** | **COMPLÉTÉ le 2026-07-28, EN DEUX PASSES.** Dernier point de contenu de l'audit du 2026-07-27. **4 → 62 gestes**, **155 → 763 étapes annotées** sur 1 097 (70 %). ⚠️ **La première passe était incomplète, et cohérente** — aucune référence cassée, aucune fiche orpheline, 43 gestes… et « écosser les fèves », « éponger les calamars », « essorer la laitue », « étaler la pâte » annotées nulle part. Elle partait d'une liste écrite À LA MAIN. **La cohérence ne dit rien de la couverture** : il a fallu échantillonner les étapes non annotées pour voir le trou. Seconde passe : extraction des verbes des 1 097 étapes, puis TRI. « Ajouter », « verser », « mélanger », « servir » sont fréquents mais ne sont pas des gestes — les définir serait condescendant et gonflerait le lexique sans rien apprendre. 19 gestes techniques retenus, `zester` écarté (0 occurrence). Les 334 étapes restantes sont sans geste technique (« Mélanger farine et sucre », « Servir aussitôt ») — c'est normal, pas un trou. ⚠️ **RESTE : « illustré »**. §2 ARCHITECTURE promet un « lexique de gestes de cuisine ILLUSTRÉ » et les 62 fiches sont du texte seul. C'est du ressort des visuels, en cours côté utilisateur |
| ~~44~~ | **Méthodes d'API restées non câblées** | **TROIS SUR QUATRE CODÉES le 2026-07-28.** `scaleRecipe` (§10.1), `rerollSlot` (§7.2) et la couche `pantry` (§10.2 ①, « vider le frigo ») — déclarée au registre depuis le début, jamais implémentée, alors que `MealContext.pantryFoodIds` existait déjà. ⚠️ **`pantry` est une couche de SCORE, jamais un filtre** : avec quatre ingrédients au frigo aucune recette n'est intégralement couverte, un filtre renverrait zéro résultat. Et la couverture est PONDÉRÉE PAR LA MASSE — avoir le sel d'un bœuf bourguignon ne couvre rien, avoir le bœuf couvre l'essentiel. ⚠️ **`scaleRecipe` applique une règle de trois, y compris au sel** — choix assumé : une courbe par ingrédient serait irrenseignable pour 199 aliments, et la règle de trois est PRÉVISIBLE. `uniteAffichage` reste figée : mettre « 2 carottes » à l'échelle demanderait de réécrire du français. ⚠️ **`rerollSlot` et `planLeftovers` ont dû ÉTENDRE leur signature** avec le profil : un `WeekPlan` garde le résultat, pas la demande qui l'a produit. Restent non câblées : `analyzeWeek` (pas de type `NutritionReport` défini) et `suggestSubstitutions` (table vide, décision 27) |

---

## 5. Les huit écrans

> Le journal des lots terminés (P0 → P1c, contenu lots 1-2) a été déplacé dans
> [archive/RECAP_SESSION_5.md](./archive/RECAP_SESSION_5.md) §7 le 2026-07-31 : il décrivait du
> travail achevé que git conserve déjà, et il noyait l'état courant.

**Les huit écrans sont livrés** (2026-07-30). `npm run dev` pour le développement ;
`npx vite build && npx vite preview --host` pour tester le service worker et l'installation,
qui ne s'activent qu'en build de production.


| § DESIGN | Écran | Ce que le moteur fournit | État |
|---|---|---|---|
| 4.1 | 📅 **Aujourd'hui** | `suggestMeals` ✅ | **Livré**, sans photo ni tags cliquables |
| 4.2 | 🗓 **Semaine** | `planWeek` · `rerollSlot` · `planLeftovers` ✅ | **Livré** (2026-07-30) — hors carrousel, vue « 3 propositions », écarter/pouce-bas |
| 4.3 | 🛒 **Courses** | `buildShoppingList` ✅ (`pourSlots` couvre « ranger par repas / jour ») | **Livré** (2026-07-30) — hors autocomplétion, impression/export, « Que cuisiner avec ? » |
| 4.4 | 📖 **Recettes** | `browseRecipes` + `engine/search/` ✅ · entonnoir ✅ | **Livré** (2026-07-30) — hors « Pourquoi pas ce plat ? » |
| 4.5 | 💡 **Vider le frigo** | `searchByPantry` ✅ · couche `pantry` ✅ | **Livré** (2026-07-30) — hors substitution suggérée |
| 4.6 | **Détail d'une recette** | `scaleRecipe` ✅ · lexique 62 gestes ✅ | **Livré** (2026-07-30) — hors photo, matériel, alternatives, notes |
| 4.7 | 💡 **Savoir** | lexique ✅ · table `tip` ✅ (8 tips) · « Comprendre » = v2 | **Livré** (2026-07-30) — « Comprendre » annoncé, pas simulé |
| 4.8 | **Premier lancement** | `user.db` ✅ · routeur ✅ · consentement ✅ | **Livré** (2026-07-30) — hors écran 4 « goûts » |

> ✅ **`user.db` existe depuis le 2026-07-30** — c'était le vrai préalable, et il est levé.
> `requeteDemo()` a disparu de `app/src/ui/main.tsx` : profil, contraintes, préférences, favoris,
> thématiques, garde-manger et historique viennent de la base. Un profil neutre est **semé en base**
> au premier lancement, que l'onboarding (4.8) écrasera — il n'y a plus rien à débloquer côté
> données pour 4.1, 4.2 et 4.4.
>
> **Ce que le store expose** (`app/src/data/user-store.ts`) : profil, allergies, régime, aliments
> exclus, préférences, favoris, thématiques actives, garde-manger, historique — en lecture ET en
> écriture. Règle tenue : *toute table que le store lit, il sait aussi l'écrire*. Les tables sans
> écran (`user_signal`, `meal_plan`, `shopping_list`, `user_recipe`, `consent`, `user_display`,
> `user_price`…) **existent déjà en base** : aucune migration à prévoir pour les brancher.

> ⚠️ **Le plan §12 ENGINE disait « pas d'UI avant P3 »** — cette condition est REMPLIE, elle n'est
> plus un frein : le moteur produit des repas crédibles en ligne de commande (`engine:try`,
> `engine:plan-stress`) depuis les corrections mesurées de la décision 31.

---

## 6. Structure des fichiers

```
appli_nutrition/
├─ docs/                      ← voir docs/README.md pour le rôle de chaque document
│  ├─ FICHE_REPRISE.md        ← ⭐ à lire en premier
│  ├─ ETAT.md                 ← CE FICHIER — état complet, décisions, dette
│  ├─ ARCHITECTURE.md · ENGINE.md · DESIGN.md    ← références, FONT FOI
│  ├─ archive/                ← instantanés datés, ne jamais réécrire
│  ├─ CONCEPTION_B_VIN_REPAS.md · STRATEGIE_DISTRIBUTION.md   ← chantiers
│  └─ archive/RECAP_SESSION{,_2,_3,_4}.md        ← récits datés
├─ app/
│  ├─ index.html              ← point d'entrée PWA
│  ├─ public/catalog/catalog.db  ← base livrée avec l'app (produite par `npm run build`)
│  └─ src/
│     ├─ engine/              ← moteur TS pur, 5 couches, aucun import montant (§2 ENGINE)
│     │  ├─ domain/           ← L1 types + `layer-ids.ts` (registre à 18 couches)
│     │  ├─ nutrition/ guards/    ← L2 agrégation, signatures, couverture · 5 garde-fous
│     │  ├─ selection/        ← L3 exclusion, scoring/, similarité, diversification, alternatives
│     │  ├─ planning/         ← L4 plan-week · reroll-slot · plan-leftovers · shopping-list · scale-recipe
│     │  └─ api/              ← L5 `createEngine` — SEULE surface publique
│     ├─ data/
│     │  ├─ catalog-loader.ts      ← mapping SQL → domaine. ⚠️ AUCUN import Node : chargé par le navigateur
│     │  └─ catalog-loader-node.ts ← `loadCatalog(dbPath)`, `node:sqlite` — CLI et tests seulement
│     ├─ ui/                  ← PWA : main.tsx (écran « Aujourd'hui ») · catalog-source.ts (SQLite WASM)
│     └─ cli/                 ← bancs de mesure : try-engine · stress-planning · compare-* · diag-couverture
├─ catalog/                   ← sources éditables → build.mjs → catalog.db
│  ├─ sources/                ← foods.yaml · ciqual-mapping.yaml
│  ├─ recipes/ lexicon/       ← 241 recettes · 62 gestes
│  └─ import-ciqual.mjs       ← `npm run catalog:ciqual -- --write`
├─ tests/                     ← intégration : frontières engine/, catalogue réel, cohérence régime & lexique
├─ vite.config.ts             ← build PWA (root: 'app', COOP/COEP pour OPFS)
├─ vitest.config.ts           ← ⚠️ SÉPARÉ EXPRÈS — voir §9, `root: 'app'` faisait disparaître 44 tests
├─ maquete claude design/…handoff.zip   ← maquettes HTML (mobile + bureau)
├─ Notes/Note designe.txt     ← notes utilisateur (traitées)
└─ .claude/
```

### Scripts npm

| Commande | Ce qu'elle fait |
|---|---|
| `npm test` · `npm run typecheck` | Suite complète (572 tests, 44 fichiers) · TypeScript strict |
| `npm run build` | Reconstruit `catalog.db` depuis les sources YAML/MD |
| `npm run dev` · `npm run preview` | PWA en développement · aperçu du build |
| `npm run catalog:ciqual -- --write` | **Seule** façon d'écrire des valeurs nutritionnelles |
| `npm run engine:try` · `engine:plan` · `engine:plan-stress` | Bancs : suggestion · plan de semaine · 20 configurations |
| `npm run engine:similarity` · `engine:couverture` | Bancs de mesure (similarité, couverture nutritionnelle) |

---

## 7. Rappels de méthode (CLAUDE.md du dépôt)

- Tâche touchant 2+ fichiers ou comportement public → **plan ≤3 bullets avant d'exécuter**.
- Échec 2× de suite → **stop**, exposer l'état et l'hypothèse, demander.
- Jamais de commit/push/install/suppression **sans demande explicite**.
- Jamais lire/modifier de secrets.
- **Écrire les tests avant de refactorer** la logique métier critique (moteur = business-critical).
---

## 8. Dette connue

Tenue ici et **nulle part ailleurs** : `FICHE_REPRISE.md` ne fait qu'y renvoyer.

### Calibrations non faites (pas des bugs)

- **λ (diversification) n'est pas calibré.** `DEFAULT_MMR_LAMBDA = 0,4` vient d'une intuition de
  conception. **Le blocage est levé** : distribution mesurée sur 22 366 paires (max 94,2 % ·
  p99 38,2 % · médiane 9,5 % · 30 paires > 60 %). Reste à faire, plus à débloquer.
  ⚠️ Mesure faite à **212 recettes** ; le catalogue en compte 241 — à rejouer avant de figer λ.
- **`varietyMode` n'est pas observable au banc**, et le contenu n'y change RIEN — la cause est un
  historique de repas **vide**, pas un catalogue pauvre. Toutes les recettes ont donc la même
  récence et l'override les décale identiquement. Il faut injecter un historique, pas des recettes.
  ⚠️ Ne pas confondre avec le blocage de λ, qui lui a été levé par le contenu.
- **`NUTRI_MIN_COVERAGE = 0,7` est un seuil de JUGEMENT**, pas de mesure — contrairement à tous les
  autres seuils du moteur. Aucun jeu de cas jugés n'existe pour « ce nutriment est-il notable ».

### Code mort ou dupliqué

- **`recipeMainIngredient` n'est lu par AUCUNE couche** depuis §6.6 bis. Calculé à l'init, employé
  seulement par les bancs de comparaison qui documentent son abandon. À supprimer si l'on fige ces bancs.
- **Le lexique banni existe en deux copies** (`catalog/build.mjs`,
  `app/src/engine/guards/banned-terms.ts`), synchronisées par `tests/banned-terms-consistency.test.mjs`.
  Si ce test disparaît, la duplication devient dangereuse.
- **`ENGINE_VERSION` est codé en dur** dans `api/index.ts` et peut diverger de `package.json`.

### Défauts connus, non corrigés

- **Le lexique banni sur-bloque** : la garde cherche des SOUS-CHAÎNES, donc « rincer
  **soigne**usement » est rejeté à cause de `soigne`. Contourné en reformulant, jamais corrigé.
- **L'explication distingue peu** : les cinq suggestions affichent souvent les mêmes trois phrases,
  seul l'ordre change. Honnête, mais peu utile pour choisir (sujet UI, P5).
- **Le banc n'affiche plus la similarité** de chaque recette retenue (`ScoredSuggestion` ne porte pas
  cette information). À rétablir **avant** de calibrer λ.
- **`roquefort` porte l'allergène `lait` mais pas `sulfites`.** Les 9 nutriments sont un choix assumé
  (décision 25), pas une dette.

### Interface — ce qui manque AVANT de coder les écrans

- ✅ **`user.db` existe** (2026-07-30) — profil, allergies, régime, aliments exclus, préférences,
  favoris, thématiques, garde-manger et historique persistés sur OPFS. Ce point n'est plus un
  manque.
- ⚠️ **Le chemin OPFS n'a jamais été exécuté dans un navigateur.** Vérifié : `npm run typecheck`,
  `npx vite build` (seule garde contre l'import Node hoisté), et 32 tests sous Node sur le mapping
  exact que le navigateur utilise. **Non vérifié** : `installOpfsSAHPoolVfs`, la survie au
  rechargement, `navigator.storage.persist()`. À faire avant toute nouvelle tranche UI.
- ⚠️ **Deux onglets se écrasent SILENCIEUSEMENT.** Chacun tient sa copie de `user.db` en mémoire et
  réécrit le fichier entier ; le dernier qui écrit gagne, sans erreur. À traiter par
  `navigator.locks` avant tout usage réel — c'est plus sournois que l'échec d'ouverture qu'aurait
  produit un VFS à descripteurs exclusifs.
- ⚠️ **La dernière modification peut être perdue.** L'écriture sur OPFS est différée d'un tour de
  boucle (indispensable pour ne pas exporter au milieu d'une transaction). Fermer l'onglet dans cet
  intervalle perd le dernier geste. Le délai se compte en millisecondes, mais il n'est pas nul.
- ⚠️ **Aucun export / import** (§7 ARCHITECTURE mesures 3 à 5). `user.db` ne se re-télécharge pas :
  tant que la sauvegarde manuelle n'existe pas, un effacement de stockage est une perte sèche.
- ✅ **Système de design posé** (2026-07-30) — jetons dans `app/src/ui/theme.css`, polices
  Newsreader + Instrument Sans auto-hébergées (162 Ko, sous-ensemble latin, SIL OFL, créditées dans
  `catalog/CREDITS.md`), barre à 5 onglets, mode sombre, cibles 48 px en `rem`.
- ⚠️ **Le contraste des maquettes échouait à trois endroits**, dont le bouton principal (blanc sur
  `#bd6a48` = 3,95:1, sous le seuil AA). Corrigé par des jetons distincts, mesuré, documenté en §1
  DESIGN. **Aucun test ne le garde** : le jour où quelqu'un ajoute une teinte, rien ne l'arrêtera.
- ⚠️ **Thèmes d'accent curatés non faits** (§1 DESIGN, « option retenue ») — un seul jeu de teintes.
- ⚠️ **Trois onglets sur cinq n'ont pas d'écran** (Courses, Recettes, Savoir) : ils affichent un
  état « pas encore construit ». La barre porte les 5 dès maintenant, exprès — une navigation qui
  grandit de version en version change de forme sous les doigts de l'utilisateur.
- ✅ **L'appli est installable** (2026-07-30) — manifest `standalone`, icônes générées par
  `npm run icons:build` (PNG via `zlib`, aucune dépendance d'image), balises iOS, service worker de
  pré-cache écrit par un plugin Vite maison à partir des fichiers RÉELLEMENT émis. Test §6.6
  « zéro requête réseau » en place, détecteur éprouvé sur des extraits synthétiques.
- ⚠️ **Rien de tout ça n'a été vérifié sur un vrai téléphone.** Le service worker ne tourne qu'en
  build de production (`npx vite build && npx vite preview`), jamais en `npm run dev`.
- ⚠️ **Pour Play (TWA), il manque l'hébergement** : origine HTTPS + `/.well-known/assetlinks.json`.
  Sans ce fichier, la barre d'URL ne se masque pas. Hébergeur et domaine non choisis.
- **Écran Courses — reste à faire** (§4.3 DESIGN) : l'autocomplétion sur les aliments du catalogue
  (un ajout manuel est aujourd'hui du texte libre, sans `FoodId`), l'impression et l'export CSV/JSON
  du menu discret, « Que cuisiner avec ? » et « Vider le frigo » pré-rempli (l'écran 4.5 n'existe
  pas), le découpage en deux virées (`joursDeCourses`, §7.4).
- ✅ **Le filtre allergènes a enfin une source.** Jusqu'au 2026-07-30, le garde-fou CRITIQUE et
  incontournable du moteur tournait sur une liste **vide** : aucun écran ne demandait ses allergies.
  Le code était juste, il n'avait pas de données. L'écran 3 du premier lancement les collecte.
- **Écran 4 du premier lancement (« vos goûts ») — NON FAIT**, deux raisons : zéro photo sur 241
  recettes, et surtout `user_preference` travaille par ALIMENT quand l'écran propose des PLATS.
  Traduire « j'aime ce curry » en préférences d'aliments (ingrédient caractéristique seul ? tous ?
  quelle pondération ?) est une décision de conception absente des docs — à trancher par mesure,
  pas au jugé, sous peine de fausser le démarrage à froid que cet écran existe pour résoudre.
- **Écran Détail — reste à faire** : la photo (zéro sur 241), la section « Matériel » (le catalogue
  n'a **aucune table équipement** — c'est aussi pourquoi la couche `equipement` est inerte depuis
  P1a), les alternatives d'ingrédients (`suggestAlternatives` exige une `SuggestionRequest` complète
  pour que les substitutions repassent les filtres d'allergènes), les notes locales
  (`user_recipe_note`, table créée sans accesseur), la roue des goûts, « Ajouter à ma semaine ».
- ⚠️ **Les 62 fiches du lexique sont du TEXTE SEUL.** §8.5 les annonce illustrées et §4.6 prévoit
  une animation par geste ; il n'y a ni image ni clip. Le geste se déplie quand même, en texte.
- ⚠️ **Le catalogue n'a NI densité NI marqueur de liquide** (199 aliments, aucun des deux). Les
  centilitres ne sont donc pas dérivables : `ui/quantites.ts` les CONSERVE depuis le libellé écrit à
  la main plutôt que de les calculer. Suffisant pour la fiche recette ; insuffisant le jour où il
  faudra convertir une quantité que le libellé n'exprime pas déjà dans la bonne unité.
- ⚠️ **Deux conversions grammes → unité d'usage coexistent.** `shopping-list.ts` convertit en pièces
  et en conditionnements (arrondi d'ACHAT, on achète un légume entier) ; `ui/quantites.ts` met le
  libellé à l'échelle (pas d'arrondi d'achat, on cuisine ce qui est écrit). Elles ne font pas la même
  chose et lisent le même champ `Food.poidsPieceG` — mais si un jour la fiche recette doit rendre des
  pièces, il faudra EXTRAIRE la conversion du domaine, pas la recopier.
- ⚠️ **7 cuisines sur 26 n'ont AUCUN drapeau**, et c'est voulu : méditerranéenne (20 recettes),
  asiatique, maghrébine, internationale, scandinave, africaine, tex-mex sont des zones, pas des
  pays. Leur en attribuer un demanderait de choisir un pays à leur place — le Maghreb n'est pas le
  Maroc. Elles affichent le libellé seul.
- ⚠️ **Les drapeaux ne se rendent pas sous Windows** : le système n'embarque pas ces glyphes, le
  navigateur montre « FR », « IT ». Lisible, pas cassé, et iOS/Android les rendent — mais à savoir
  avant de conclure à un bug en testant sur PC.
- **Écran Vider le frigo — reste à faire** : la substitution suggérée (« le cas échéant », §4.5).
  `suggestSubstitutions` n'est pas câblée et la table `substitution` est vide par décision 27 — il
  n'y a rien à suggérer tant que les couples n'existent pas.
- ⚠️ **Les compteurs de pastilles coûtent une requête par facette.** Chaque facette est comptée
  SANS sa propre sélection — sinon choisir `française` afficherait `italienne (0)` alors que la
  retirer ramènerait 19 recettes. Deux requêtes de plus par changement de filtre, sur 241 recettes :
  imperceptible aujourd'hui, à surveiller si le catalogue grossit d'un ordre de grandeur.
- ⚠️ **Les 8 tips sont TOUS `biologie_aliment`** — aucune affirmation de santé. Le tuyau existe
  (table `tip`, chargement YAML, lint de vocabulaire au build, écran) ; le contenu de
  `nutrition_humaine` reste à écrire, et c'est une décision ÉDITORIALE, pas un lot de code : toute
  affirmation sur l'alimentation humaine tombe sous §6.1 et §6.2. Règles dans `catalog/tips/README.md`.
- ⛔ **« Comprendre » (§4.7) n'existe pas et ne doit pas être bricolé.** `HealthTopic` est un type
  sans table. §4.7 exige un badge de niveau de preuve sur chaque affirmation et §5 DESIGN en fait
  « l'élément le plus surveillé » : afficher des affirmations santé sans sources ni niveau de preuve
  serait exactement ce que §6.1 cherche à empêcher. L'écran l'annonce comme à venir.
- ⚠️ **Aucun test d'interface.** Vitest tourne sans DOM ; couvrir un composant React demanderait
  `jsdom`, donc une dépendance à valider. Seule la logique extractible est testée (`routeDepuisHash`).
  Les écrans ne sont couverts que par `typecheck` et `vite build`.
- **Écran Semaine — reste à faire** (§4.2 DESIGN) : le carrousel plein écran de « Changer », la vue
  comparative « 3 propositions », « écarter » comme exclusion éphémère de session, le pouce-bas vers
  `user_signal`, et le bouton « Créer ma liste de courses » (attend l'écran 4.3).
- **Ajout à §4.2 : un sélecteur « Convives »**, que la spec ne prévoit pas. `planLeftovers` ne peut
  rien calculer sans lui — une recette de 4 portions ne laisse un reste que si l'on sait combien en
  sont mangées. Le laisser caché ferait apparaître des restes sans explication à l'écran.
- ✅ **L'API de recherche existe** (2026-07-30) : `engine/search/` (normalisation accent-insensible,
  texte + facettes) et `Engine.browseRecipes`, qui applique les MÊMES couches d'exclusion que la
  suggestion et rend l'entonnoir de §6.8. 16 tests sur le catalogue réel, dont la propriété de
  sécurité vérifiée sur toutes les recettes rendues.
- ⛔ **La catégorie « Loufoque » de §4.4 n'existe pas au catalogue.** Six styles seulement :
  quotidien (139), convivial (65), simple (23), reconfortant (10), rapide (3), gourmand (1). C'est
  du CONTENU à écrire, pas du code — et « rapide » et « gourmand », à 3 et 1 recettes, ne font pas
  des filtres utiles non plus.
- **Écran Recettes — reste à faire** : l'état « Pourquoi pas ce plat ? » (nommer la raison
  d'exclusion d'une recette précise ; `entonnoir.entries` porte déjà la matière) et le bloc d'entrée
  « Vider le frigo » (écran 4.5 inexistant).
- ⛔ **Aucune table de tips** pour le carrousel « Le saviez-vous ? » (§4.7 DESIGN).
- **Pas de routage** : l'app est un composant unique. `react-router-dom` n'est pas installé —
  installation à valider explicitement (CLAUDE.md §4).

### Contenu — constats de l'audit du 2026-07-27, remesurés le 2026-07-29

- **Zéro photo sur 241 recettes.** Le critère de sortie P6 (« bundle < 15 Mo », budget 40 Ko/image)
  suppose 200-300 photos originales, sous le même interdit que les recettes (contenu original, pas
  de scrap). Poste de travail le plus lourd du projet, **chiffré nulle part**. En cours côté
  utilisateur.
- ✅ **Lexique — RÉSOLU** (décision 43) : 4 → **62 gestes**, 763 étapes annotées sur 1 097.
  ⚠️ **Reste « illustré »** : §2 ARCHITECTURE promet un lexique *illustré*, les 62 fiches sont du
  texte seul. Dépend des visuels.
- **`Recipe.piquant` n'est renseigné sur AUCUNE des 241 recettes** — colonne présente, valeurs
  toutes `null`. Attributs posés, annotation et câblage moteur à faire (décision 35).
- **Aucune recette de type `fromage`.** `CourseKind` prévoit le service, le catalogue n'en a pas :
  144 plats, 39 entrées, 37 desserts, 21 accompagnements.
- **Créneaux, remesurés** : dîner 149, déjeuner 124, goûter 37, **petit-déjeuner 30** (7 à l'audit).
  Toujours le créneau le plus mince, mais plus aucun trou de couverture par régime (décision 37).
- **Revue juridique avant publication** : classée « recommandée, non bloquante » (§11 ARCHITECTURE),
  ce qui est raisonnable en développement mais **pas pour une mise en ligne** — la couche allergènes
  est saisie à la main et sert à des gens qui en dépendent. **Ouverte depuis l'audit.**

### Tests

- **Les tests de propriété ne passent plus tous à l'échelle du catalogue.** Celui des allergènes
  énumérait le powerset (4 096 combinaisons à 12 allergènes) et a dépassé le délai : il couvre
  désormais vide + singletons + paires + complet. **À surveiller à chaque palier de contenu.**
- ⚠️ **`vitest.config.ts` doit rester SÉPARÉ de `vite.config.ts`.** Vitest lit `vite.config.ts` en
  l'absence de config dédiée : y poser `root: 'app'` a fait passer la suite de **572 tests à 528
  sans le moindre échec** — les suites de `tests/` et `catalog/` étaient simplement hors racine.
  **Un test qui disparaît ne fait pas rougir la CI, il la rend verte pour de mauvaises raisons.**
- ⚠️ **`catalog-loader.ts` ne doit importer AUCUN module Node.** Il est chargé par le navigateur, et
  un `import 'node:sqlite'` en tête de fichier casse le bundle **même si la fonction qui l'utilise
  n'est jamais appelée** — l'import est hoisté. Le message de Rollup ne désigne pas cette cause.
  L'ouverture de fichier vit dans `catalog-loader-node.ts`.
