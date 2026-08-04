# État du projet — récapitulatif et reprise

> État complet du projet. Pour un démarrage rapide, lire d'abord `docs/FICHE_REPRISE.md`.
> Dernière mise à jour : **2026-08-03** — l'interface est livrée (8 écrans spécifiés, **10 codés**,
> **9 couverts par des tests d'écran**, voir §5) ; ce qui reste relève du CONTENU et de la
> DISTRIBUTION.
>
> ⚠️ **§1 et §2 étaient restés au 2026-07-29** et annonçaient encore « un seul écran sur huit »
> alors que §5 et §8 décrivaient déjà les écrans livrés. Ils ont été réalignés le 2026-08-03 sur les
> chiffres mesurés en fin de session 12. **§3 à §8 n'ont pas été touchés.**
>
> Récits datés : `docs/archive/RECAP_SESSION_4.md`, puis `RECAP_SESSION_5` à `RECAP_SESSION_10`.
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

**Suite exécutée le 2026-08-03** : `npm test` → **1 253 passed (77 fichiers)** en 33,9 s ·
`npm run typecheck` propre · `node catalog/build.mjs` → 200 aliments, 241 recettes, 62 gestes,
73 tips, 8 fiches (33 positions).
*(Le relevé de la session 12 annonçait 1 249 / 76 : il avait 4 tests et 1 fichier de retard, deux
pistes écrivant en parallèle ce soir-là.)* **La sortie réelle de `npm test` fait foi, pas cette
ligne.**
*(Relevé du 2026-07-29, conservé pour mémoire : 572 verts / 44 fichiers, `npx vite build` OK,
`npm run engine:plan-stress` → 20/20 configurations saines.)*

**Le catalogue est réel** : **200 aliments** aux valeurs CIQUAL 2025 de l'ANSES (plus aucun `PROV-`),
**241 recettes**, **62 gestes** de lexique, **73 tips** et **8 fiches « Comprendre »** (33 positions)
— les cibles de la décision 4 sont dépassées. ⚠️ **Le contenu Savoir n'est PAS relu** (§8.2 bis). Le contenu a
servi de banc de mesure et a révélé quatre défauts du moteur, tous corrigés **par mesure et non au
jugé** : l'ingrédient caractéristique (§6.6 bis), la pondération de la similarité (§6.6 ter), la
règle de récence (§6.6 quater et quinquies), la couverture nutritionnelle (§5.1 bis).

**L'interface est livrée.** Les huit écrans de `DESIGN.md` §4 le sont depuis le 2026-07-30 ; le code
en porte **dix** (Paramètres et Éditeur de recette, 2026-08-01) et **neuf** sont couverts par des
tests d'écran. Les trois comptes sont justes et volontaires — **détail et cause en §5**.
L'application fait sa boucle complète : s'installer → déclarer ses allergies → voir une suggestion →
planifier sa semaine → sortir sa liste de courses → cuisiner.

**Prochaine étape : CONTENU & DISTRIBUTION** — ce qui reste n'est plus du code d'écran. Trois
chantiers par ordre de dépendance, détaillés dans [FICHE_REPRISE.md](./FICHE_REPRISE.md) :
⛔ **relecture par un tiers du contenu Savoir**, bloquante avant publication · vérification sur un
**vrai téléphone** (`npx vite build && npx vite preview --host` — le service worker et
l'installation ne s'activent qu'en build de production) · **empaquetage Capacitor**, puis Play
(§4 décision 9).
✅ Le préalable réel — **`user.db`** — est levé (2026-07-30) : schéma complet de §4.3 ARCHITECTURE
en v1, migrations versionnées, OPFS (`opfs-sahpool`). L'écran « Aujourd'hui » lit un profil, des
contraintes, des goûts et un historique **persistés** ; `requeteDemo()` a disparu.
⚠️ Le chemin OPFS n'a pas encore été exécuté dans un vrai navigateur (voir **§8**, dette connue — ce document n'a pas de §9).

---

## 2. Où en est-on

```
Concept ─▶ Architecture ─▶ Moteur ─▶ Analyse marché ─▶ Design UI ─▶ Code ── P0 ✅ ── P1a ✅ ── P1b-1 ✅ ── P1b-2 ✅ ── P1c (lots 1-4 ✅) ── CONTENU ✅ ── suggestAlternatives ✅ ── planning ✅ ── restes ✅ ── liste de courses ✅ ── lexique ✅ ── UI ✅ (10 écrans) ── TESTS D'ÉCRAN ✅ ─▶ CONTENU & DISTRIBUTION ▓▓
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

> ⚠️ **Ce tableau s'arrête au 2026-07-29.** Chaque ligne date de la clôture de son lot et n'est pas
> réécrite — c'est voulu. Tout ce qui a été livré ensuite (les dix écrans, les tests d'écran, le
> socle d'accessibilité, les 73 tips, les 8 fiches, la vérification sanitaire des recettes) se lit
> en **§5** et **§8**, pas ici.

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
- **La photo de plat est OBLIGATOIRE** (2026-08-01, décision utilisateur —
  `archive/RECAP_SESSION_8.md` §2). Elle porte l'ambiance, ce qui **valide rétroactivement l'accent
  unique**. Trois conséquences non optionnelles : **(a)** `catalog/build.mjs` doit **échouer** si une
  recette du catalogue n'a pas de photo — une règle non vérifiée au build n'est pas une règle ;
  **(b)** la règle porte sur le **catalogue**, pas sur `user_recipe` ni sur les recettes importées,
  dont §3 « Communauté » exclut déjà la photo ; **(c)** ⚠️ **jamais de texte SUR la photo** — le
  contraste y est **non mesurable**, et une appli qui a documenté trois écarts au dixième ne peut pas
  abandonner la garantie là. Nom, heure et tags sur fond plein **sous** la photo. Spec de prise de
  vue (ratio, angle, lumière, fond) : `archive/RECAP_SESSION_8.md` §2.
- ⚠️ **Aucune échelle typographique n'existe** — 29 tailles arbitraires mesurées le 2026-08-01, et
  `theme.css` ne porte aucun jeton de texte. Échelle à 6 pas proposée et **non appliquée** :
  `archive/RECAP_SESSION_8.md` §5. La cause est une spec incomplète, pas une dérive d'intégration.
- **Mode cuisine découpé en deux** (2026-08-04, ex-décision ouverte n°8) : **v1 = une recette à la
  fois** (écran allumé, étape courante, minuteurs, quantité à la demande) ; **v1.5 = synchronisation
  multi-recettes**. Motif : la v1 ne demande aucune donnée nouvelle du moteur et rend visibles **512
  `timer_s` déjà écrits, buildés et chargés jusque dans `catalog-loader.ts`, mais jamais affichés** ;
  la synchronisation de service est, elle, un problème d'ordonnancement entier. **Le pilotage vocal
  est exclu**, pas différé — il échoue en cuisine réelle (neuf modes d'échec, arXiv 2306.09992) et
  une permission micro fissure le principe 2. Spec : `ARCHITECTURE.md` §5bis.
- ⚠️ **Deux prérequis de la v1 ne sont pas satisfaits, et ce n'est pas du câblage** : **(a)** le lien
  étape → ingrédient — `etapes[].food_ids` **écrit à la main**, pas dérivé, sur **1 118 étapes** (la
  dérivation par rapprochement de texte a été envisagée et écartée : `food` n'a ni synonyme ni
  alias) ; **(b)** `recipe_step.nature` pour distinguer un geste d'un avertissement — **18 recettes**
  comptent aujourd'hui un avertissement ANSES comme une étape à faire. Spec : `ARCHITECTURE.md`
  §5bis. **Ordre des lots et méthode de montée : `CONCEPTION_MODE_CUISINE.md`.**

### Média, stockage & modèle
- **Gestes de cuisine** : boucle WebP 3 s pour les gestes simples ; **3 clips MP4 de 3 s**
  (avant/pendant/après) + clip « quand ça rate » pour les gestes à risque ; galeries d'états
  (cuisson, caramel) en photos.
- **Recettes** : 1 photo hero par recette ; **vidéo 2-3 s seulement sur les recettes du jour**.
- **Cache à deux étages (option B)** : socle léger pré-caché (shell + `catalog.db` + boucles +
  photos d'ustensiles), médias lourds à la demande + bouton « tout télécharger ». **Aucun média
  en blob dans le `.db`.**
  ⚠️ **AMENDÉ par la décision Capacitor (2026-08-01, §4 décision 9).** Ce modèle suppose un service
  worker et un réseau ; en Capacitor les assets sont **dans le binaire**. La contrainte ne disparaît
  pas, elle **change de nature** — et le budget « bundle < 15 Mo » du critère P6 était un budget de
  **premier chargement web**, pas une limite d'APK (plafond AAB 150 Mo). Estimation à vérifier avant
  de produire les photos : 241 × (hero ~120 Ko + vignette ~32 Ko) ≈ **36 Mo**, soit hors budget web
  et confortable en binaire. **À trancher avant la prise de vue** — `archive/RECAP_SESSION_8.md` §2.
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
| ~~8~~ | **Mode cuisine** (multi-recettes, timers par étape) en v1 ou v1.5 ? | **Fermée le 2026-08-04 — la question était mal posée** : elle agrégeait deux features de coûts sans rapport. **Découpée**, pas arbitrée en bloc — mono-recette en **v1**, synchronisation multi-recettes en **v1.5**. Spec complète : `ARCHITECTURE.md` §5bis — §3 |
| ~~9~~ | Cible iOS : PWA seule ou Capacitor + App Store ? | **FERMÉE le 2026-08-01 (décision utilisateur) — Capacitor** remplace TWA/Bubblewrap pour le produit final. Installé (`capacitor.config.ts`, `@capacitor/{core,cli,android,local-notifications}`) ; `npx cap add android` jamais lancé. **Gain réel** : le risque « éviction Safari à 7 jours », classé CRITIQUE en §7 ARCHITECTURE, tombe largement — le stockage d'une WebView applicative vit tant que l'appli est installée. ⚠️ **Capacitor ne lève PAS la contrainte « pas de Mac »** : signer un IPA exige macOS + Xcode + 99 €/an. Sans Mac, cette décision apporte un conteneur **Android**, pas l'iOS — **ne pas retirer la version web du plan**. ⚠️ **Risque n°1 introduit, NON VÉRIFIÉ** : tout le projet parie sur `rem` → l'interface suit la police système à 150 %. Chrome le fait ; **une WebView applicative, ce n'est pas garanti**, et l'échec serait SILENCIEUX. À tester sur appareil avant tout le reste. Conséquences complètes et régressions WebView connues : `archive/RECAP_SESSION_8.md` §3 |
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
| ~~34~~ | **Journées de planning sous le plancher calorique** | **LARGEMENT RÉSOLUE le 2026-07-28**, en trois temps et aucun des trois n'était celui que j'avais annoncé au départ. **(a)** Le diagnostic « catalogue trop léger » était FAUX — la meilleure journée possible atteignait déjà 2 127 kcal. **(b)** La cible nutritionnelle restante (§7.1) a été codée et mesurée INSUFFISANTE (+64 kcal) : l'énergie ne pèse que 2,8 % du score. **(c)** Le vrai correctif était double — `checkCalorieFloor` AVERTIT au lieu d'annuler (§6.5 demandait un écran d'avertissement, j'avais codé un refus), et les 30 recettes végétaliennes de la décision 37 ont enrichi le vivier. **Résultat mesuré** : le cas nominal (7 jours × 3 créneaux) passe de 1 038 kcal minimum avec 3 avertissements à **1 208 kcal minimum, ZÉRO avertissement**. ⛔ **CE CHIFFRE EST PÉRIMÉ — REMESURÉ LE 2026-08-03 : 830 kcal minimum, 4 AVERTISSEMENTS sur 7 jours** (`npm run engine:plan-stress`, ligne « 7 jours » ; 14 jours donne 830 kcal et 6 avertissements). Le banc n'a pas changé depuis la mesure d'origine (`git log -- app/src/cli/stress-planning.ts` s'arrête au commit PWA), donc la comparaison est valide et **c'est une régression, pas un écart de méthode**. `avert.` compte bien `checkCalorieFloor` (`api/index.ts:630`) et l'énergie est **par portion** (`recipe-nutrients.ts:6`). ⚠️ **Cause non identifiée** — les fichiers de sélection ont bougé depuis le 2026-07-28, notamment en `3dbaf48` (dont le correctif « `diversify` ignorait la graine ») ; c'est une piste, pas une conclusion. ⚠️ **Conséquence immédiate sur la décision 45**, qui s'appuie sur ce chiffre pour masquer l'alerte par défaut. ⚠️ **Reste ouvert** : les combinaisons extrêmes. « sans gluten NI lait NI œuf » remplit 16 créneaux sur 21, « végétalien + sans gluten » 36 sur 56. C'est une limite de contenu assumée, pas un défaut moteur — `planWeek` place l'optimum disponible |
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
| ~~45~~ | **L'alerte de plancher calorique et le « mode professionnel »** | **TRANCHÉE le 2026-08-02 (décision utilisateur), amendement à §6.5 ARCHITECTURE.** Demande d'origine : « on a dit deux modes → un par défaut pour tout le monde → 1 pour les professionnels ». **L'alerte est MASQUÉE par défaut** et n'apparaît qu'en mode professionnel. **Un seul interrupteur, pas deux** : `user_display.afficher_macros` — déjà décrit en §6.5 comme « le mode avancé, destiné aux sportifs », déjà `false` par défaut — devient ce mode et gouverne aussi l'alerte. **Aucune migration** : la colonne existe depuis la v1 du schéma d'affichage. Créer un second drapeau aurait installé deux axes de réglage et la dérive « écran par écran » que §6.5 dit précisément d'éviter. ⚠️ **CONSÉQUENCE NON DEMANDÉE, ACTÉE** : `alertes_discretes` (v4) devient sans objet — si l'alerte n'apparaît qu'en mode professionnel, « version courte » n'a plus rien à raccourcir. La case de `parametres.tsx` et la prop `discrete` d'`AlerteEnergie` sont retirées ; **la colonne reste en base**, les migrations de ce projet étant en ajout seul. ⚠️ **RÉSERVE ÉCRITE, MAINTENUE, ET ÉCARTÉE PAR L'UTILISATEUR** : c'est la seule des trois décisions du jour qui RETIRE une protection au lieu d'en déplacer une, et §6.5 est déclarée contraignante pour la publication (« ces règles conditionnent la légalité du produit »). Le texte d'origine exigeait un « écran d'avertissement explicite » sous 1 200 / 1 500 kcal ; il ne peut pas tenir tel quel et est réécrit, pas contourné — même mécanique que l'amendement de la décision 36. ~~⚠️ **Le fait qui relativise le risque** : décision 34 a mesuré le cas nominal (7 jours × 3 créneaux) à **1 208 kcal minimum, ZÉRO avertissement**. L'alerte ne se déclenche plus que sur les combinaisons extrêmes de régimes — « sans gluten NI lait NI œuf » remplit 16 créneaux sur 21. Ce qui est masqué par défaut est donc un cas rare, **pas** le comportement ordinaire ; et la cause de ce cas rare est un trou de CONTENU, qui reste à combler indépendamment~~ ⛔ **CETTE PRÉMISSE EST TOMBÉE LE 2026-08-03, ET ELLE ÉTAIT LA SEULE QUI RENDAIT CETTE DÉCISION TENABLE.** Remesure au banc, cas nominal 7 jours × 3 créneaux : **830 kcal minimum, 4 avertissements sur 7 jours** (détail et méthode en décision 34). Ce qui est masqué par défaut n'est donc **pas** un cas rare — c'est le comportement ordinaire. La décision 45 reste APPLIQUÉE dans le code (`semaine.tsx:352`, `AlerteEnergie` monté seulement si `modeAvance`) mais sa **justification écrite est fausse**, et §6.5 ARCHITECTURE est déclarée contraignante pour la publication. ⚠️ **Trois issues, aucune tranchée, et ce n'est pas à Claude de choisir** : (a) traiter la régression de plancher et revérifier — si le nominal repasse à zéro avertissement, la décision 45 redevient tenable telle quelle ; (b) laisser l'alerte masquée et l'assumer explicitement comme un écart à §6.5, écrit et daté ; (c) rendre l'alerte visible par défaut, ce qui annule la décision 45. ⚠️ **(a) est le seul ordre sain** : décider de la visibilité d'une alerte avant de savoir pourquoi elle se déclenche quatre fois plus qu'avant, c'est arbitrer sur un symptôme. ⚠️ **Ne pas confondre avec le trou de contenu** des combinaisons extrêmes, qui lui reste réel et indépendant ⚠️ **MISE À JOUR DU 2026-08-04 — LA PISTE (a) A ÉTÉ SUIVIE, ET ELLE ABOUTIT.** La régression est corrigée (décision 54) : sur 20 graines, le cas nominal passe de **0/20 à 20/20 semaines sans aucun avertissement**, min 813 → 1 302 kcal. **La prémisse « le déclenchement est rare » redevient donc VRAIE pour le cas nominal** — mais elle reste FAUSSE pour les régimes pauvres en accompagnements : végétalien 14 j rend encore **5 avertissements**, « végétalien + sans gluten » **9**. ⚠️ **LE CHOIX RESTE À L'UTILISATEUR, et il est maintenant INFORMÉ** : masquer par défaut une alerte qui ne se déclenche plus chez la majorité mais se déclenche encore chez les végétaliens revient à la masquer surtout à ceux à qui elle s'adresse. Décision de produit, pas conséquence technique. ✅ **TRANCHÉE LE 2026-08-04 (décision utilisateur) : ON RESTE SUR L'ALERTE MASQUÉE PAR DÉFAUT.** C'est l'issue (b) — la décision 45 est maintenue telle quelle, en connaissance des chiffres ci-dessus : le cas nominal ne déclenche plus rien (20/20 graines propres), les régimes pauvres en accompagnements déclenchent encore. **Ce n'est plus une prémisse fausse, c'est un choix assumé et daté**, ce que §6.5 ARCHITECTURE demandait. ⚠️ **NE PAS ROUVRIR SANS ÉLÉMENT NEUF** : l'élément neuf attendu est le contenu d'accompagnement (chantier en cours côté utilisateur) — s'il fait tomber les 5 et 9 avertissements résiduels à zéro, la question disparaît d'elle-même |
| ~~46~~ | **Facettes de filtre : dépliantes, ou autrement ?** | **TRANCHÉE le 2026-08-02 (décision utilisateur)** — ni le dépliant demandé, ni le statu quo : **les valeurs fréquentes passent dans le flux**. Chaque axe rend ses N valeurs les plus portées en pastilles directement cliquables, suivies d'un « Tout voir (k) › » qui ouvre la fenêtre existante. **Zéro geste pour le cas courant, aucun dépliant, et rien ne pousse vers le bas** — la règle de `panneau.tsx` tient sans exception à documenter. ⚠️ **Le grief d'origine était déjà traité** : le verbatim (« pour les filtres exemple cuisine → ils doivent être dépliables […] et non passer par plus de filtres ») avait pour cause mesurable « la cuisine est à deux gestes », corrigé au lot 11 du 2026-08-02 (Cuisine, Régime, Service à UN tap chacun). Ce qui restait était la forme littérale, pas le besoin. ⚠️ **LE CLASSEMENT DES PASTILLES EST GLOBAL, LES COMPTEURS RESTENT DYNAMIQUES.** Deux choses distinctes : *quelles* valeurs sortent en pastille se dérive du catalogue entier et ne bouge jamais ; *quel chiffre* s'affiche à côté reste celui de l'écran (règle en place, `filtres-recettes.tsx:8-16`). Dériver aussi le classement des résultats courants ferait changer les pastilles de place à chaque filtre posé — un bouton qui se déplace sous le doigt, exactement ce que la contrainte d'âge du produit interdit. Une valeur sélectionnée reste visible même hors du top N, sinon la retirer deviendrait impossible |
| ~~47~~ | **Variantes par substitution : table `substitution` ou recette à part entière ?** | **TRANCHÉE le 2026-08-02 (décision utilisateur) — la table.** Ferme la décision 27, qui disait « avec le contenu, pas avant » : le contenu arrive. **Trois raisons** : (a) la sémantique était DÉJÀ tranchée par la décision 26 — variante = ingrédient principal INVARIANT, substitution d'un ingrédient SECONDAIRE ; faire d'une variante une recette à part entière l'aurait contredite ; (b) le mécanisme est **déjà codé et testé** (`buildVariants`, `alternatives.ts:54-90`), il ne rend rien uniquement parce que `catalog.substitutions` est une Map vide ; (c) 4 champs par couple contre 20 pour une recette, et deux recettes quasi identiques ont un `signatureOverlap` proche de 1 (`signature.ts:155`) — la diversification en supprimerait systématiquement une des deux, donc une variante n'apparaîtrait **jamais** à côté de son original. ⚠️ **UN COUPLE EST GLOBAL** : `catalog.substitutions` est indexée par ALIMENT (`ReadonlyMap<FoodId, Substitution[]>`), pas par recette. Écrire `beurre → huile d'olive` l'appliquerait à toutes les recettes contenant du beurre, pâte brisée comprise. **Règle retenue : on n'écrit que les couples vrais PARTOUT** — si le `contexte` doit dire « sauf », le couple n'a pas sa place. Une portée par recette (`Substitution.recipeIds`) a été envisagée puis écartée : modifier le type du domaine, le schéma, le build et `buildVariants` avant d'avoir écrit le moindre couple. Seul garde-fou déjà en place : `alternatives.ts:78` refuse la substitution sur l'ingrédient CARACTÉRISTIQUE. ⚠️ **`ratio` ET `contexte` ÉTAIENT DÉCLARÉS ET LUS PAR PERSONNE** (`catalog.ts:534-535` contre `alternatives.ts:84`, qui ne prend que `altFoodId`) — le motif exact déjà payé deux fois par ce projet (`note_allergene`, filtre allergènes sur liste vide). **Ils sont câblés en même temps que la table**, pas remplis à vide : `ratio` recalcule la quantité, `contexte` devient la phrase montrée. ⚠️ **LES COUPLES SONT SOURCÉS, comme les recettes** (décision utilisateur) : un ratio faux produit un plat raté, et la vérification du 2026-08-02 a trouvé 8 recettes à risque sur 10 sans aucun critère vérifiable. ⚠️ **RIEN NE SERA VISIBLE À L'ÉCRAN** : `suggestAlternatives` n'est câblée à aucun bouton (`detail-recette.tsx:16-18`, `frigo.tsx:21`). Remplir la table remplit le MOTEUR ; l'exposer est un chantier distinct, non décidé. **⚠️ AMENDÉE LE JOUR MÊME — voir décision 48** |
| ~~48~~ | **La règle « couples universels » de la décision 47 rend une table VIDE** | **MESURÉ puis AMENDÉ le 2026-08-02, quelques heures après la décision 47.** Une passe de recherche sourcée sur les ~200 aliments du catalogue a rendu **ZÉRO couple** passant le double filtre « vrai dans toute préparation » + « source institutionnelle lue ». **Les rejets tiennent SUR CE CATALOGUE, pas en théorie** — vérifié en interrogeant `catalog.db` : `beurre_doux` est dans **60 recettes dont 11 desserts** (tarte aux pommes, tarte au citron, tarte aux abricots, deux crumbles : la pâte brisée n'est pas un cas d'école, elle est au catalogue) ; `sucre_blanc` dans **12 recettes dont 8 desserts** ; `lait_entier` dans **5 dont 4 desserts**, tous des appareils à prise. Seule piste à source institutionnelle solide — le ratio herbes fraîches → séchées, deux extensions universitaires concordantes — **inapplicable** : le catalogue n'a aucune paire du même végétal (thym séché sans thym frais, persil frais sans persil séché), et le ratio est en VOLUME quand la table indexe des grammes. ⚠️ **La cause est STRUCTURELLE, pas un manque d'effort** : `catalog.substitutions` est indexée par ALIMENT SEUL, et à peu près toute substitution culinaire dépend du contexte de préparation (cru/cuit, salé/pâtissier, monté/simple). **Un index par aliment ne peut pas exprimer « sauf ».** **DÉCISION (utilisateur) : on rouvre la portée par recette**, c'est-à-dire l'option que la décision 47 avait explicitement écartée — écartée sous l'hypothèse, désormais fausse, qu'une table universelle serait remplissable. ⚠️ La passe de recherche avait convergé **seule** sur cette même recommandation, sans connaître l'arbitrage. **Forme retenue : `Substitution.recipeIds`, liste d'INCLUSION** (`null` = partout, réservé au cas universel qu'on sait maintenant rare). Une liste d'EXCLUSION a été envisagée et écartée : elle est plus courte à écrire mais elle **échoue ouverte** — la recette 242, une tarte, hériterait en silence d'une substitution fausse. L'inclusion échoue fermée : une recette nouvelle ne reçoit rien tant que personne ne l'a ajoutée. C'est le même arbitrage que l'import de recettes, qui REFUSE sur un `foodId` inconnu plutôt que de laisser passer. ⚠️ **CONSÉQUENCE À ASSUMER : les couples s'écrivent ÉTROITS.** On n'écrit pas `beurre → huile` pour 49 recettes — une liste de 49 ids écrite à la main ne serait vérifiée par personne et pourrirait, exactement ce que ce projet reproche aux listes écrites à la main. Une table de substitution n'a pas à tout couvrir ; elle doit être JUSTE là où elle se déclenche. ⚠️ **Un test de build est exigé** : toute entrée de `recipeIds` doit désigner une recette qui existe ET qui contient réellement `foodId`, sinon c'est une entrée morte — la classe de bug que ce projet rencontre en boucle (`note_allergene`, filtre allergènes sur liste vide, `ratio`/`contexte` jamais lus). **⚠️ SECONDE MESURE, MÊME JOUR : la portée par recette RÉSOUT le périmètre et NE RÉSOUT PAS le contenu.** Une deuxième passe de recherche, menée avec la portée par recette, rend **encore zéro couple** — mais le blocage a changé de nature et c'est cela qu'il faut retenir : « `beurre_doux` → `huile_olive` dans ces plats salés-là, pas dans les 11 desserts » est **devenu exprimable**. Ce qui manque désormais, c'est **la source**. Les agences publient des COMPOSITIONS, pas des équivalences de cuisine : le CNIEL donne « le beurre standard contient 82 % de matière grasse » (lu), l'ANSES Ciqual et l'USDA FoodData Central sont des applications JS non lisibles automatiquement, et tout ce qui chiffre un ratio est un blog ou un calculateur. ⚠️ **Une part du blocage vient d'une consigne trop stricte, pas de la règle du projet** : la passe avait reçu « privilégie institutions publiques et agences » et en a conclu que les ouvrages culinaires étaient exclus. **Ils ne le sont pas** — le chantier de sourçage des recettes cite Escoffier 1903 et Anctil 1915. ⚠️ **Et `ratio: 1.0` n'est pas une affirmation à sourcer** : c'est « même poids », l'hypothèse nulle. Ce qui demande une source, c'est QUE l'échange fonctionne — un jugement culinaire — pas LE NOMBRE. Exiger une citation d'agence pour 1 = 1 bloque la table sur une exigence vide. **⏸️ CHANTIER MIS EN PAUSE (décision utilisateur, 2026-08-02)** : le contenu des recettes est travaillé **en parallèle** dans une autre piste, et écrire ici entrerait en collision. **Rien n'a été codé, rien n'a été écrit au catalogue.** À la reprise, deux pistes non creusées attendent, toutes deux à ratio 1,0 : **`gruyere` ↔ `comte_rape`** (les deux au catalogue, les deux utilisés en gratins) et les **légumineuses en conserve**. **⏸️ TOUJOURS EN PAUSE au 2026-08-03 (décision utilisateur), mais DÉSORMAIS SANS RÉSERVE — troisième mesure, les deux pistes ci-dessus sont épuisées, chacune pour une raison distincte et vérifiée.** **(a) `gruyere` ↔ `comte_rape` — pas de source.** La seule phrase existante (« Remplacer le gruyère par du comté. 100 g environ, dont 75 incorporé à la béchamel », `cuisine-libre.org/endives-roulees-au-jambon`) est un **commentaire de lecteur** signé « paddy » (2010), pas un texte éditorial. ⚠️ **Le build l'aurait ACCEPTÉE** : `verifierDomaine` ne compare que le nom d'hôte, et `cuisine-libre.org` est dans la liste blanche — le rejet a été un jugement humain, pas un garde-fou. Écrit dans `reference/PIEGES.md` ; **non corrigé au schéma** (décision utilisateur du 2026-08-03) : rendre la citation exacte obligatoire fermerait le trou mais imposerait de compléter les 41 recettes déjà sourcées, et aucun filtre d'URL ne peut le fermer autrement — la page est éditoriale, le commentaire est *dessus*. **(b) Légumineuses en conserve — pas de second aliment.** `Substitution` est `FoodId → FoodId`, et le catalogue porte **un seul id par légumineuse**, déjà figé sur une forme : `haricot_rouge` 20524, `haricot_blanc` 20511, `flageolet` 20508, `pois_chiches` 20532 sont « appertisé, égoutté » ; `lentilles_corail` et `lentilles_vertes` pointent tous deux sur 20359 « sèche ». **Décision utilisateur du 2026-08-03 : on garde un id par légumineuse** — la piste est donc close définitivement, écrire le couple supposerait d'abord d'AJOUTER des aliments, ce qui est une extension de catalogue et pas une décision de substitution. La source rapportée par la recherche (Bognár 2002, *Weight yield factors*, hébergé sur `fao.org` donc dans la liste blanche : 2,50 haricots · 2,73 lentilles · 2,45 pois) est solide, mais elle mesure **sec → cuit** quand la piste demandait **sec → conserve égouttée** : la lui faire dire fabriquerait une provenance. ⚠️ **Vérification faite au passage, et NÉGATIVE** : les deux familles étant sur des bases différentes, j'ai contrôlé que les quantités suivent — `chili-haricots-rouges` 400 g « 1 grande conserve égouttée », `flageolets-agneau-romarin` 700 g « 2 conserves égouttées », `dahl-lentilles-corail` 250 g pour 4 avec « les lentilles rincées, couvrir d'eau et laisser mijoter ». Chaque quantité est dans la base de son aliment : **aucun facteur 2,7 caché dans le calcul nutritionnel.** ⚠️ **Ce qui a changé depuis le 2026-08-02** : les deux corrections de la seconde mesure ont bien été appliquées — les ouvrages culinaires ont été admis, `ratio: 1.0` n'a pas été exigé sourcé — et n'ont rien débloqué. Le blocage n'est donc plus le périmètre (résolu par `recipeIds`), plus la consigne (corrigée), ni même vraiment la source (Bognár est recevable) : **les deux couples candidats n'existent pas comme couples dans CE catalogue.** **Rouvrir ce chantier demande d'APPORTER un couple candidat ; une quatrième passe de recherche à l'aveugle est écartée.** |
| ~~49~~ | **Choisir soi-même le plat d'un créneau — et le bouton « Choisir » qui n'en fait rien** | **OUVERTE, ouverte le 2026-08-03** en instruisant `test appli.txt` (voir `RETOUR_ESSAI_TELEPHONE.md` §6.2). Deux demandes distinctes, **un seul geste** : « rajouter en manuel la recette directement » et « faire une recette avec les restes du frigo directement » sont toutes deux « remplir CE créneau », depuis deux sources. ⛔ **Le constat qui prime sur la fonctionnalité** : sur un créneau vide le bouton s'intitule « **Choisir** » (`semaine.tsx:698`) et appelle `onChanger` → `rerollSlot` (`semaine.tsx:268-294`), donc un **tirage automatique**. Le libellé promet un choix et rend un tirage. ⚠️ **Cette moitié-là est à corriger même si la fonction n'est jamais écrite** — un bouton qui ment sur son effet est un défaut autonome, et c'est la classe de défaut que ce projet rencontre en boucle sous une autre forme (`note_allergene`, filtre allergènes sur liste vide, `ratio`/`contexte`) : **l'écart entre ce qui est annoncé et ce qui est branché**. Deux options à trancher : renommer « Choisir » en « Proposer un plat » (une ligne, honnête, ne rend pas la fonction) ou écrire la fenêtre de sélection (réemploie la recherche de `recettes.tsx`, et `frigo.tsx` pour la seconde source). ⚠️ **Contrainte à respecter** : `planLeftovers` et `checkCalorieFloor` tournent sur le plan entier — un plat posé à la main doit repasser par eux, pas contourner le garde-fou ✅ **TRANCHÉE ET CODÉE LE 2026-08-04 (décision utilisateur : la fenêtre complète, deux sources).** **(a) LE MENSONGE EST CORRIGÉ EN DEUX BOUTONS, pas en un renommage.** « Proposer » tire (`rerollSlot`), « Choisir » ouvre la fenêtre (`setSlotRecipe`). Les deux gestes existaient, un seul bouton les portait, et il annonçait le mauvais. **(b) `setSlotRecipe` EST UNE FONCTION À PART, pas une option de `rerollSlot`, et la différence est dans le code** : un tirage ÉCARTE ce qui est déjà au plan, un choix ne le peut pas — refuser à quelqu'un le plat qu'il vient de désigner parce qu'il figure déjà mercredi serait absurde. Verrouillé → plan inchangé ; recette inconnue → `RangeError`. **(c) LA CONTRAINTE ÉCRITE DE CETTE DÉCISION EST TENUE** : `checkCalorieFloor` repasse sur le plan entier, à la même ligne et dans la même fonction que pour un reroll — poser un plat soi-même n'est pas la porte par laquelle §6.5 se contourne. Les rappels sont reprogrammés aussi. **(d) DEUX SOURCES, UN SEUL GESTE** (`ui/choisir-plat.tsx`) : recherche catalogue (`browseRecipes`) et « avec ce que j'ai » (`searchByPantry`). **Les deux appliquent les MÊMES couches d'exclusion que la suggestion** — un allergène déclaré n'apparaît pas plus ici qu'ailleurs. Les contraintes sont RELUES à l'ouverture de la fenêtre, pas héritées de l'écran : c'est le seul endroit du produit où l'utilisateur désigne un plat à la main, donc le seul où un filtre périmé se traduirait par une assiette dangereuse posée de sa propre main. ⚠️ **AUCUN POURCENTAGE DE COUVERTURE AFFICHÉ** dans l'onglet frigo — « il vous manque : crème, thym » est un fait, « couverture 62 % » se lirait comme une note, exactement comme le score du moteur (principe 6). ⚠️ **Une liste vide ne dit jamais « aucun résultat » tout court** : la cause peut être le mot cherché OU les contraintes déclarées, et l'utilisateur ne peut pas les distinguer seul. ⚠️ **Le garde-manger est LU, jamais saisi ici** — dupliquer la saisie ferait deux endroits où déclarer ce qu'on a, donc deux vérités |
| ~~50~~ | **Les restes sont invisibles dans les Courses** | **TRANCHÉE et CODÉE le 2026-08-04**, ouverte le 2026-08-03 (`RETOUR_ESSAI_TELEPHONE.md` §6.2). Les restes s'affichent dans Semaine (`semaine.tsx:624,685`) et **sont absents de l'écran Courses** — `courses.tsx:344` n'a qu'un texte explicatif. ⚠️ **L'enjeu n'est pas cosmétique** : les restes font tomber une semaine de courses de **24 à 15 kg** (§2 ARCHITECTURE, `shopping-list.ts`). **L'effet le plus spectaculaire du moteur est invisible là où il se produit**, et l'utilisateur a posé la question deux fois dans le même fichier (« où sont rangés les restes déjà ? », puis « où sont rangés les restes de la veille ? comment l'utilisateur peut le voir ? »). **Codé** : section « Couverts par un reste (n) » en bas de l'écran, sur le motif de « Déjà chez vous (n) » (décision 41 c) — chaque créneau nommé (« mardi · Déjeuner — Ratatouille »), non cochable, plus un lien vers la Semaine où le créneau porte déjà « Reste du plat de la veille ». ⛔ **LA MOITIÉ « PAR DIFFÉRENCE » DE LA PISTE A ÉTÉ ÉCARTÉE, et il faut que la raison reste écrite pour que personne ne la reprenne** : la section est lue sur `isLeftover`, pas calculée. Un reste porte son propre drapeau (§7.3 ENGINE) là où le garde-manger n'est marqué nulle part — la différence n'était nécessaire que faute de marquage. Et refaire une différence ici ne donnerait rien : **un reste réutilise LA MÊME recette que son plat source**, donc le contrefactuel « et si ce repas était cuisiné à part ? » n'ajouterait AUCUN article, il doublerait des quantités. ⚠️ **AUCUN GAIN CHIFFRÉ N'EST AFFICHÉ, et c'est un choix, pas un oubli** : « n articles évités » vaudrait zéro en permanence, et le seul gain réel — le poids — demanderait d'additionner des grammes, des millilitres et des pièces. Le « 24 → 15 kg » de §2 ARCHITECTURE reste une mesure de document, pas un nombre à afficher à côté d'une liste. Verrouillé par test |
| 51 | **Plats préparés / repas hors catalogue** | **OUVERTE, ouverte le 2026-08-03** (`RETOUR_ESSAI_TELEPHONE.md` §6.2). Demande : « possibilité de rajouter des plats préparés ». Aujourd'hui `meal_plan_entry.recipe_id` désigne une recette du catalogue ou `NULL` (`user-schema.ts:203`) ; les recettes personnelles (`user_recipe`, sources `perso`/`importe`/`variante`) sont un objet distinct et **complet**, ce qu'un plat du commerce n'est pas. ⛔ **CE N'EST PAS QU'UN CHAMP À AJOUTER, et c'est la raison de ne pas le coder au fil de l'eau** : un plat préparé sans valeurs nutritionnelles crève `checkCalorieFloor` (`guards/index.ts:195`) et la couche `nutri` — le moteur compterait un créneau **rempli à zéro kcal**, ce qui est le CONTRAIRE d'une case vide (`checkCalorieFloor` n'évalue que les jours dont le déjeuner ET le dîner sont remplis, précisément pour ne pas confondre incomplet et affamant). Trois issues possibles, aucune choisie : (a) le plat préparé est un créneau **exclu** du calcul nutritionnel, marqué comme tel ; (b) il porte une saisie d'énergie facultative ; (c) il devient une recette personnelle à un seul ingrédient. ⚠️ **(b) est le plus proche d'un journal alimentaire**, que §6.5 ARCHITECTURE interdit — à examiner sous cet angle avant tout autre |
| 52 | **Si l'écran Aujourd'hui devient une grande image, `gestesBalayage` ne peut plus être faux par défaut** | **OUVERTE, ouverte le 2026-08-03** (`RETOUR_ESSAI_TELEPHONE.md` §6.3). La demande « une interface comme tinder » est la **décision A de la session 8**, actée sur le principe et **bloquée par le contenu** (0 photo sur 241). ⚠️ **Ce que l'instruction du lot a révélé, et que personne n'avait relevé** : le balayage gauche/droite **existe déjà** (`aujourdhui.tsx:512-513`) et il est **désactivé par défaut** (`parametres.tsx:299`, réglage `gestesBalayage`). Tant que l'écran est une carte avec des flèches, un défaut à faux se défend. **Dès que l'écran devient une image qu'on balaie, le geste EST l'interface** — le laisser à faux enterrerait la fonction centrale derrière deux gestes dans les réglages, ce qui est exactement le chantier D (`RETOUR_ESSAI_TELEPHONE.md` §2 D) : « une fonction qu'il faut enseigner est une fonction mal placée ». ⚠️ **À trancher EN MÊME TEMPS que la maquette, pas après** — c'est le genre de conséquence qui se perd entre deux lots |
| ~~53~~ | **Le placement automatique ne lisait pas `Recipe.service` — 4ᵉ occurrence du défaut signature** | **TROUVÉE, TRANCHÉE et CODÉE le 2026-08-03**, en cherchant la cause de la régression du plancher (décision 34). `planWeek` filtrait ses candidats sur `typesRepas` — *à quel MOMENT de la journée* — et **jamais sur `service`** — *quel RÔLE dans le repas*. **Mesuré : 61 recettes sur 189 éligibles à un déjeuner ou un dîner ne sont pas des plats** (39 entrées, 20 accompagnements, 2 desserts), médiane ~250 kcal/portion contre **437** pour un plat. Dans la semaine nominale, 2 repas principaux sur 14 étaient une entrée (« Artichauts à la vinaigrette » en déjeuner) ou un accompagnement (« Boulgour aux légumes grillés » en dîner). ⚠️ **DÉCISION UTILISATEUR : la règle ne vaut QUE pour le placement automatique.** Chercher, parcourir, choisir une entrée comme dîner reste permis partout — le produit informe, il ne juge pas (principe 6). Ce qui est interdit, c'est que la MACHINE décide qu'une assiette d'artichauts sera le dîner de samedi. D'où le filtre dans `plan-week.ts` (`peutRemplirSeul`) et **NON dans `HardConstraints`**, qui le rendrait exprimable dans toute suggestion — miroir exact du raisonnement de l'acquis n°2 sur `requiredFoodIds`. ⚠️ **UN SEUIL D'ÉNERGIE A ÉTÉ ENVISAGÉ PUIS ÉCARTÉ** : « assez consistant pour faire un repas » se mesurerait en kcal, et un nombre qui décide qu'un plat est un vrai repas EST un jugement nutritionnel. Le service est un fait éditorial, pas une note. ⚠️ **`service: null` est ACCEPTÉ** — c'est la valeur des recettes qui remplissent un créneau seules ; le refuser viderait le vivier de tout ce qui n'est pas annoté. ⛔ **LA PREMIÈRE VERSION, DURE, A CASSÉ LA DÉCISION 37 et le banc ne l'a pas dit** : végétalien 14 j retombé de **42/42 à 32/42** créneaux remplis, « végétalien + sans gluten » de 16 trous à 33 — `plan-stress` affichant « 20/20 configurations saines » pendant ce temps (voir `reference/PIEGES.md`). **Corrigé en PRÉFÉRENCE et non en exigence** : deux passes, la seconde sans le filtre. Un créneau vide ne nourrit personne. Couverture rétablie (42/42) ; seul « végétalien + sans gluten » perd un créneau (40/56 → 39/56), effet déterministe du réordonnancement. ⚠️ **CE N'EST PAS LE CORRECTIF DU PLANCHER, et il ne faut pas le croire** : sur 20 graines, le cas nominal passe de 0/20 à **1/20** sans avertissement (min 830 → 813, médiane 1 006 → 1 023). Les plats eux-mêmes ont une médiane de 437 kcal — trois d'entre eux tiennent à peine le seuil. La cause de fond reste que le catalogue offre des PLATS quand `checkCalorieFloor` mesure une JOURNÉE (décision 45) |
| ~~54~~ | **Le plancher calorique : le planificateur pose un ACCOMPAGNEMENT en plus du plat** | **TRANCHÉE, CODÉE et MESURÉE le 2026-08-04.** C'est LE correctif du plancher de §6.5, celui que la décision 53 n'était pas. ⛔ **LA CAUSE, ET CE N'EST PAS UN BUG DE CALCUL** : `checkCalorieFloor` compare une JOURNÉE à un plancher journalier, alors que `planWeek` ne posait que des PLATS. Trois plats cuisinés ne sont pas ce qu'une personne mange dans une journée — **la comparaison n'a jamais été homogène**, depuis le premier jour. MESURÉ sur 20 graines × 7 jours (`npm run engine:plancher`) : **min 813 → 1 302 kcal, médiane 1 023 → 1 528, et 0/20 → 20/20 semaines sans aucun avertissement**. 1 528 kcal pour trois repas cuisinés reste réaliste : ce n'est pas un gonflage destiné à passer le contrôle. ⚠️ **LES DEUX PROTECTIONS SONT DISSOCIÉES POUR LA PREMIÈRE FOIS, et c'est le cœur de la règle.** L'accompagnement est EXEMPTÉ de `placedRecipeIds` (l'interdit dur du doublon) — on mange du riz plusieurs fois par semaine — mais il PASSE par l'historique de travail, donc `variety` fait décroître son score. Le riz peut revenir, il ne doit pas lasser. Mesuré sans l'historique : `7× Ratatouille` et `7× Boulgour` sur 14 créneaux ; avec : 12 accompagnements distincts sur 14 posés, 3 fois le même au maximum. ⚠️ **LE TROU ÉDITORIAL RESTE OUVERT** : rien dans le catalogue ne dit si un plat SE SUFFIT — les 144 plats portent `service: 'plat'` et rien d'autre. Le substitut est un seuil de composition partagée (`signatureOverlap` appliqué à `recipeFamilySignature`, 0,30, mesuré sur les 2 880 paires réelles : 40 refusées, aucun plat laissé sans accompagnement possible). Il coupe « Rösti + Pommes de terre sautées » (99 %), « Lentilles à la poitrine de porc + Lentilles vertes » (50 %), « Boulgour + Boulgour » (44 %) ; **il laisse passer « Sardines ET POMMES DE TERRE au four » + « Gratin dauphinois » (29 %)**, et descendre le seuil à 0,28 tuerait aussi « Cuisses de poulet rôties + Gratin dauphinois », qui est un classique. **Seul un champ éditorial sur les 144 plats tranche — pas une constante à déplacer.** ⚠️ **IMPASSE PAYÉE AU PASSAGE** : une mesure « dirigée » (`Σ min / Σ(ajouté)`) a été écrite puis RETIRÉE — les signatures étant normalisées à 1, ce n'est qu'une remise à l'échelle monotone du Jaccard, donc le même classement. Test de non-régression posé dans `signature.test.ts` pour qu'elle ne soit pas réinventée. ⚠️ **`recipeFamilySignature` A UN TROISIÈME LECTEUR**, en plus de la RÉCENCE (acquis n°4) : la question posée ici est « est-ce le MÊME produit de base ? », qui est mot pour mot la définition de `sousFamille`. Le brut ne voit PAS « Dahl de lentilles corail » + « Lentilles vertes aux carottes » (8 % contre 36 % replié). Les deux index gardent leur rôle, aucun n'est fusionné. ⚠️ **CE QUE ÇA NE RÈGLE PAS** : végétalien 14 j garde **5 avertissements** et « végétalien + sans gluten » **9** — ces régimes n'ont pas assez d'accompagnements (18 posés sur 28 attendus, 11 sur 56). Écrire du contenu d'accompagnement devient la suite directe. ✅ **LA DETTE DE `rerollSlot` EST CORRIGÉE LE MÊME JOUR (2026-08-04, demande utilisateur).** « Changer » rejoue le plat ET son accompagnement. Le garder tel quel laissait un VESTIGE : on refusait « Poulet rôti » pour tomber sur « Rösti de pommes de terre » et la purée restait à côté — pire qu'une paire bancale, une garniture qui n'avait même plus de rapport avec le plat. `pickAccompagnement` prend désormais une requête de créneau déjà construite au lieu d'un `WeekPlanRequest`, ce qui la rend appelable des deux endroits. Le créneau est RECONSTRUIT et non patché par indice : le nombre d'entrées peut passer de 2 à 1 (plus aucun plat disponible → créneau vide, JAMAIS un accompagnement orphelin qui afficherait « du riz » comme dîner) |
| ~~55~~ | **Trois lecteurs du plan supposaient encore UNE entrée par créneau** | **TROUVÉS et CORRIGÉS le 2026-08-04**, en cherchant les conséquences du mode repas (décision 54). Aucun ne plantait ; les trois MENTAIENT. C'est la signature de ce genre de changement : il ne casse pas, il désaligne. **(a) LE PLUS GRAVE — un repas GARDÉ perdait son accompagnement.** `indexLockedEntries` (`plan-week.ts`) appliquait « deux verrous sur le même créneau : le premier gagne », règle écrite quand un créneau ne portait qu'un plat. Garder un déjeuner en verrouille désormais DEUX : n'en reposer qu'un faisait disparaître l'accompagnement à chaque « Proposer une autre semaine ». **Le repas gardé changeait donc quand même — ce que §7.2 promet d'empêcher — et la journée perdait ~250 kcal en silence.** Le départage subsiste mais PAR SERVICE, et la liste est rendue dans l'ordre de `COURSE_ORDER`, le même que le `ORDER BY` de `readPlan`. Au passage : un accompagnement verrouillé n'entre PAS dans `placedRecipeIds`, sinon garder un créneau l'interdirait toute la semaine. **(b) La liste de courses titrait le créneau avec l'ACCOMPAGNEMENT.** `platParCreneau` (`courses.tsx`) se construisait par `set` en boucle : la seconde entrée écrasait la première, et le regroupement « Repas » affichait « lundi · Déjeuner — Ratatouille » au lieu du plat. **(c) DEUX notifications pour une seule assiette.** `rappelsDuPlan` (`rappel.ts`) bouclait sur `entries`. Sur une application dont l'argument est qu'elle ne harcèle personne, c'est le défaut à ne pas laisser passer. Un rappel par CRÉNEAU désormais, calé sur le plat le plus LONG — commencer à l'heure du plus court ferait servir en retard — et le texte dit qu'il y a un second plat, le taire ferait sous-estimer le travail. ⚠️ **CE QUI A ÉTÉ VÉRIFIÉ ET NE POSAIT PAS DE PROBLÈME** : `checkCalorieFloor` (somme sur les entrées, correcte), `buildShoppingList` (un `pourSlots` en double se dédoublonne à l'affichage), `aujourdhui.tsx` (ne lit pas le plan), et le `CHECK (portions > 0)` du schéma (la migration v2 l'avait déjà levé pour les créneaux vides). ⚠️ **LA LEÇON, consignée dans `reference/PIEGES.md`** : quand la FORME d'une donnée change, chercher ses lecteurs un par un — `find`, `entries.length`, `Map.set` en boucle et `ORDER BY` sans départage sont les quatre motifs qui se désalignent en silence |
| ~~56~~ | **L'avertissement de plancher disait ce qu'il ne mesure pas** | **TRANCHÉE et CODÉE le 2026-08-04.** L'écran affichait « une journée apporte moins d'énergie que la référence habituelle », puis « 830 kcal pour une référence de 1 200 kcal ». **Deux erreurs dans une phrase de dix mots.** **(a) « UNE JOURNÉE » : non — LES REPAS PRÉVUS.** `checkCalorieFloor` additionne les recettes posées au plan. Ni le pain sur la table, ni un yaourt, ni un fruit, ni un repas pris dehors — **ni le petit-déjeuner quand le plan n'a que deux créneaux, ce qui est le réglage PAR DÉFAUT de l'écran Semaine**. Annoncer à quelqu'un qu'il mange 830 kcal par jour quand on n'en sait rien est exactement l'affirmation qu'une application à garde-fous TCA ne doit pas produire (§6.5) — et c'est à un cheveu du journal alimentaire que le même §6.5 interdit. `PlanWarning` porte donc `repasComptes`, le nombre de CRÉNEAUX additionnés (un déjeuner plat + accompagnement compte pour UN repas), et l'écran écrit « 2 repas prévus, 830 kcal au total ». **(b) « RÉFÉRENCE HABITUELLE » : non — SEUIL DE VIGILANCE.** 1 200 kcal est la limite sous laquelle une alimentation devient risquée ; la référence d'une femme active de 30-49 ans tourne autour de **2 000**. Appeler 1 200 « la référence » suggérait qu'y arriver suffisait. ⚠️ **Le panneau nomme désormais ce qui N'EST PAS compté**, en une phrase sans prescription : ni « mangez plus », ni « ajoutez un plat ». On informe, on ne juge pas (principe 6). ⛔ **AMENDEMENT §6.5 D'`ARCHITECTURE.md` RÉÉCRIT AU PASSAGE, et c'était nécessaire** : il justifiait le masquage de l'alerte par « la décision 34 a mesuré 1 208 kcal minimum, ZÉRO avertissement — le cas est rare ». Ce chiffre était **une mesure sur UNE graine**, et il a été faux pendant deux jours (0/20 graines au 2026-08-03). **Le seul amendement de ce document qui retire une protection reposait donc sur une propriété que le moteur n'avait pas.** Remplacé par les chiffres mesurés et datés du 2026-08-04, y compris ce qu'ils ont d'inconfortable : le cas nominal ne déclenche plus rien (20/20), **mais végétalien 14 j rend encore 5 avertissements et « végétalien + sans gluten » 9 — ce sont les utilisateurs pour qui l'information compte le plus, et ce sont eux qui ne la verront pas** |
| ~~57~~ | **Le garde-manger dérivait en silence — daté, puis confirmé** | **TRANCHÉE et CODÉE le 2026-08-04 (décision utilisateur).** `user_pantry` disait CE QU'ON A sans dire DEPUIS QUAND, et **deux écrans en tiraient des affirmations** : Courses RETIRE de la liste ce qu'on est censé avoir (on rentre sans crème, et on ne s'en aperçoit qu'en cuisinant), « Choisir un plat » propose des recettes réalisables avec. ⛔ **C'est le grief n°1 relevé sur toutes les applications comparables** (`reference/CONCURRENCE_ET_ATTENTES.md`) : « on le remplit une semaine, puis plus jamais — et un inventaire à moitié à jour est PIRE que pas d'inventaire, parce qu'on cesse d'y croire ». **Migration v8** : colonne `declare_le`, en AJOUT, `DEFAULT ''` = date INCONNUE et non « aujourd'hui » — les lignes d'avant peuvent dater de six mois, les blanchir serait l'erreur exacte que la colonne existe pour empêcher. **Seuil 7 jours** (un cycle de courses) : en deçà on ne demande rien, au-delà on demande, et **décocher retire pour de bon** — l'ignorer pour le seul affichage en cours reposerait la même question à l'identique la fois suivante, ce qui contourne la dérive au lieu de la corriger. ⚠️ **CE N'EST PAS UN RAPPEL, ET C'EST LA LIGNE À NE PAS FRANCHIR** : §4.3 pose que le garde-manger est « facultatif et ponctuel, jamais un inventaire à tenir — l'appli ne demande rien ». La question n'est donc posée QU'AU MOMENT OÙ LA DONNÉE VA SERVIR. La déplacer vers l'accueil, une notification ou un badge ferait du produit un gestionnaire de stock. ⚠️ **Tout est coché par défaut** : faire recocher douze cases pour dire qu'on n'a rien perdu serait la corvée que la recherche décrit ; l'effort ne porte que sur ce qui a CHANGÉ. Risque assumé — quelqu'un valide sans lire — accepté parce que ne rien demander est mesurément pire. ⛔ **LES DEUX ÉCRANS SONT CÂBLÉS, MAIS PAS DE LA MÊME FAÇON, et l'asymétrie est le cœur de la décision** (2e moitié codée le 2026-08-04). Dans `choisir-plat.tsx` la question **RETIENT les résultats** : un garde-manger périmé y rend la proposition FAUSSE — la recette est infaisable, et on l'apprend devant le frigo ouvert. Dans `courses.tsx` elle **n'empêche rien** : le garde-manger ne fait jamais qu'ENLEVER des lignes, donc un garde-manger douteux **n'est simplement pas appliqué** — la liste sort ENTIÈRE, `dejaChezVous` reste vide, et un bandeau dit que rien n'a été retiré. On échoue du côté de la ligne en trop, qui se raye, plutôt que du côté de l'article manquant, qui gâche le repas. Retenir une liste de courses derrière douze cases à cocher pendant que quelqu'un est debout dans un magasin coûterait plus que les deux lignes qu'elle contient en trop. ⚠️ **Ne pas « uniformiser » les deux comportements** : ce qui les sépare n'est pas l'écran, c'est le SENS de l'erreur — l'un devient faux, l'autre seulement trop long |
| 58 | **La liste d'aliments est FERMÉE — 200 entrées, et rien pour en déclarer une autre** | **OUVERTE, ouverte le 2026-08-04.** `user_pantry.food_id` référence obligatoirement un aliment du catalogue, et l'autocomplétion de l'écran Frigo cherche dans ces 200. **MESURÉ : `chorizo`, `lardon` et `noix de coco` en sont absents — quelqu'un qui a des lardons n'a AUCUN geste pour le dire.** C'est le reproche fait à SuperCook mot pour mot (`reference/CONCURRENCE_ET_ATTENTES.md` §3), à ceci près qu'ils ont des milliers d'aliments et nous 200 : le mur est le même, beaucoup plus près. ⛔ **CE N'EST PAS UN MANQUE DE CONTENU MAIS UNE IMPASSE DE MODÈLE, et la nuance décide de la correction.** Allonger `foods.yaml` repousse le mur — **chantier en cours côté utilisateur** — mais aucun catalogue fini ne le supprime : il n'existe aucun chemin pour déclarer un aliment que l'éditeur n'a pas prévu. ⚠️ **Le trou est d'autant MOINS visible que le catalogue grossit**, ce qui en fait un défaut qui se découvre tard, chez l'utilisateur. Pistes non tranchées : (a) accepter du texte libre au garde-manger, non rattaché à un `FoodId` — mais `searchByPantry` pondère par la MASSE et ne saurait rien en faire, et un aliment sans allergène connu traverserait le filtre de §5.2 ; (b) le rattacher au plus proche par sous-famille, ce qui **invente une donnée nutritionnelle** ; (c) l'accepter en ne servant QUE la liste de courses, jamais la recherche de recettes. ⚠️ **(a) et (b) touchent un garde-fou de sécurité — à ne pas coder au fil de l'eau** |

---

## 5. Les écrans

> Le journal des lots terminés (P0 → P1c, contenu lots 1-2) a été déplacé dans
> [archive/RECAP_SESSION_5.md](./archive/RECAP_SESSION_5.md) §7 le 2026-07-31 : il décrivait du
> travail achevé que git conserve déjà, et il noyait l'état courant.

> ⚠️ **Le tableau ci-dessous suit la numérotation de `DESIGN.md` §4, qui s'arrête à huit.** Le code
> en porte **dix** : s'y ajoutent **Paramètres** et **Éditeur de recette**, livrés le 2026-08-01 et
> absents de `DESIGN.md` (`archive/RECAP_SESSION_7.md`). **Neuf sont couverts par des tests
> d'écran** — `savoir.tsx` ne l'est pas, le chantier « Comprendre » y étant en cours au moment où
> les tests ont été écrits. Les trois comptes — 8 spécifiés, 10 codés, 9 testés — sont justes ; ne
> pas les uniformiser sans traiter la cause (`DESIGN.md` n'a pas suivi).

**Les huit écrans de `DESIGN.md` §4 sont livrés** (2026-07-30). `npm run dev` pour le développement ;
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
| 4.7 | 💡 **Savoir** | lexique ✅ · table `tip` ✅ (73 tips sourcés, 3 catégories) · « Comprendre » ✅ (8 fiches, 33 positions) | **Livré** (2026-07-31, tips étendus le 2026-08-01) — les 4 sections de §4.7 sont rendues ; contenu NON RELU |
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
├─ vitest.config.ts           ← ⚠️ SÉPARÉ EXPRÈS — voir §8, `root: 'app'` faisait disparaître 44 tests
├─ maquete claude design/…handoff.zip   ← maquettes HTML (mobile + bureau)
├─ Notes/Note designe.txt     ← notes utilisateur (traitées)
└─ .claude/
```

### Scripts npm

| Commande | Ce qu'elle fait |
|---|---|
| `npm test` · `npm run typecheck` | Suite complète (**1 253 tests, 77 fichiers**, exécutée le 2026-08-03) · TypeScript strict |
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
- ⚠️ **Un échec de test intermittent subsiste, non caractérisé** (2026-08-01). Une course a été
  trouvée et corrigée — `catalog/build.test.ts` écrivait `app/public/catalog/catalog.db` pendant que
  les tests d'écran le lisaient via `ui/test-socle.ts` — mais **un échec isolé de plus (1 test sur
  939) a été observé après le correctif**, sur une machine chargée, sans être capturé ni reproduit
  en dix exécutions ultérieures. Hypothèse **non vérifiée** : un `waitFor` de test d'écran qui expire
  sous contention CPU. À capturer avec `--reporter=json` la prochaine fois qu'il se manifeste plutôt
  qu'à relancer jusqu'au vert.
- ⚠️ **Le contenu de l'onglet Savoir n'est relu par personne** (§8.2 bis) : 73 tips et 8 fiches
  « Comprendre », chaque source ouverte et vérifiée à l'écriture, **aucune relecture par un tiers**.
  Bloquant avant publication. Trois réserves de sourçage subsistent sur les fiches : DOI Messerli
  dérivé d'un PII vérifié, auteurs de `critique-zhao-2018` non vérifiés, URL française ANSES.
- ⚠️ **Le build ne vérifie que la FORME d'une source** — présence et format http(s) pour
  `tip.source_url`, présence pour les sources de fiches. Il ne saura jamais si la page dit ce que le
  texte prétend. **Aucun automatisme ne remplace la relecture** ; la garantie tient à la règle
  éditoriale de `catalog/tips/README.md` et `catalog/evidence/README.md`.

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
- ✅ **Les cinq onglets ont leur écran** (Courses, Recettes et Savoir livrés depuis). La barre
  portait les 5 avant qu'ils existent, exprès — une navigation qui grandit de version en version
  change de forme sous les doigts de l'utilisateur.
- ✅ **Les écrans sont testés** (commits `568144b`, `bdcd0d3`) : 9 fichiers `*.test.tsx`. La dette
  « zéro test d'interface », n°1 de la fiche de reprise jusqu'au 2026-07-31, est close.
- ✅ **L'appli est installable** (2026-07-30) — manifest `standalone`, icônes générées par
  `npm run icons:build` (PNG via `zlib`, aucune dépendance d'image), balises iOS, service worker de
  pré-cache écrit par un plugin Vite maison à partir des fichiers RÉELLEMENT émis. Test §6.6
  « zéro requête réseau » en place, détecteur éprouvé sur des extraits synthétiques.
- ⚠️ **Rien de tout ça n'a été vérifié sur un vrai téléphone.** Le service worker ne tourne qu'en
  build de production (`npx vite build && npx vite preview`), jamais en `npm run dev`.
- ~~⚠️ **Pour Play (TWA), il manque l'hébergement** : origine HTTPS + `/.well-known/assetlinks.json`.~~
  **CADUC depuis le 2026-08-01** (§4 décision 9) : la cible est **Capacitor**, les fichiers vivent
  dans l'APK. Ni origine HTTPS ni `assetlinks.json` ne sont requis, et **l'hébergement sort du chemin
  critique**. Une version web reste souhaitable — seul chemin vers iOS sans Mac — mais elle n'est
  plus bloquante pour publier.
- ⚠️ **Trois conséquences de Capacitor NON TRAITÉES** (`archive/RECAP_SESSION_8.md` §3) : le message
  `non_persistant` de `main.tsx` dit encore « Ajoutez l'application à votre écran d'accueil » et
  s'afficherait **dans une appli native** ; le pari « `rem` → l'interface suit la police système à
  150 % » **n'est pas vérifié en WebView**, et son échec serait silencieux ;
  `env(safe-area-inset-bottom)` (barre à 5 onglets) et la barre d'état native sont à revérifier sur
  appareil.
- ✅ **Accessibilité — socle posé** (2026-08-03, lots A et B de `archive/RECAP_SESSION_8.md` §4) :
  `<main tabIndex={-1}>` reçoit le focus à chaque changement de route (défilement remis à zéro au
  passage), lien d'évitement « Aller au contenu » en premier élément focusable, `.sr-only` par
  rognage, et `prefers-reduced-motion` dans `theme.css`. Les quatre règles photo/mouvement que le CSS
  ne porte pas sont consignées en **§3.1 DESIGN**.
  ⚠️ **La garde du premier montage compare la ROUTE, pas un booléen « a déjà monté »** : `<StrictMode>`
  invoque chaque effet deux fois au montage, et un drapeau serait déjà levé au second passage — le
  focus serait volé au chargement, ce que la garde existe pour empêcher. Repose sur la stabilité par
  identité de `lireRouteStable` (`router.tsx`).
  ⚠️ **Le lien d'évitement n'existe pas pendant l'accueil**, qui n'a ni barre de navigation ni `<main>`
  focalisable — à revoir si l'accueil gagne une navigation.
- ⚠️ **`Panneau` NE PIÈGE PAS LE FOCUS** (`ui/panneau.tsx`) — défaut préexistant, mis au jour par la
  relecture du socle ci-dessus. Le composant pose le focus à l'ouverture, le restitue à la fermeture
  et intercepte `Échap`, mais **rien ne borne `Tab`/`Shift+Tab`** : au clavier, on sort d'une fenêtre
  modale par le haut et on tabule dans l'écran qu'elle recouvre, alors que `aria-modal="true"` promet
  l'inverse aux technologies d'assistance. Contournement en place, pas correctif : `.sr-only:focus`
  est passé à `z-index: 60` pour que le lien d'évitement reste **visible** quand on l'atteint ainsi.
  ⚠️ **Reste le lot C** (filet `axe`) : demande Playwright + `@axe-core/playwright`, soit 2
  devDependencies et ~150 Mo de navigateurs — **accord explicite requis** (`CLAUDE.md` §4). Depuis la
  décision Capacitor il ne vaut plus validation, seulement non-régression : il teste Chromium, pas la
  WebView de production. **Couverture honnête : ~1/3 des vrais problèmes** — il n'attrapera jamais un
  `alt` présent mais faux, ni un geste sans équivalent visible. Deux passes manuelles restent dues :
  clavier seul sur tous les écrans, puis **320 px / zoom 200 % / police système 150 %, trois tests
  distincts**.
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
- ✅ **73 tips, les 3 catégories de §8.4 ouvertes** (2026-08-01) : 51 `biologie_aliment`,
  11 `nutrition_humaine`, 11 `nutrition_animale`. Cible §8.2 pour l'ordre de grandeur : une centaine.
  - **`tip.source_url` est `NOT NULL`** — la colonne annoncée en §4.2 ARCHITECTURE n'avait jamais
    été implémentée. Le build refuse désormais un tip sans lien http(s), et le carrousel affiche le
    domaine de la source sur le tip lui-même. Décision utilisateur du 2026-08-01, sur le constat
    qu'un fait court et affirmatif est ce qui se recopie le plus vite sans vérification.
  - **Les 8 tips d'origine ont été sourcés rétroactivement, et 3 corrigés** : le miel perd
    l'anecdote des tombes égyptiennes (invérifiable), l'oignon perd le remède du réfrigérateur (la
    source le donne pour contesté), le piment perd « c'est le gras qui emporte la capsaïcine »
    (l'essai retenu montre que le lait écrémé calme autant que l'entier).
  - **Les tips `nutrition_humaine` sont strictement descriptifs** : « l'EFSA considère que… »,
    jamais « il faut… ». C'est ce qui garde §6.1 intact ; le lint §6.2 attrape le reste.
  - ⛔ **CONTENU NON RELU PAR UN TIERS** (§8.2 bis). Chaque source a été ouverte à l'écriture, mais
    le niveau d'exigence est plus faible que `catalog/evidence/` : articles PMC, textes d'autorité
    et manuels de référence, pas des méta-analyses. Assumé et écrit dans `catalog/tips/README.md`.
- ✅ **« Comprendre » (§4.7) existe** (2026-07-31) : 8 fiches, 33 positions, 33 sources vérifiées une
  à une. Sources éditables en `catalog/evidence/*.md` (Markdown à frontmatter), compilées en cinq
  tables (`evidence_sheet`, `evidence_source`, `evidence_position`, `evidence_position_source`,
  `evidence_link`). Règles d'écriture dans `catalog/evidence/README.md`.
  - ⚠️ **Une fiche expose PLUSIEURS POSITIONS**, chacune avec son niveau de preuve, qui la porte
    (« OMS », « revue Cochrane ») et ses sources cliquables. §4.2 ne prévoyait qu'un niveau par
    fiche : `evidence_position` et sa jonction sont un écart assumé, documenté dans le README.
  - ⚠️ **Pas de fausse symétrie.** Seules les divergences entre méta-analyses ou entre autorités
    sont exposées, jamais une étude isolée contre un consensus ; une position contestée est citée
    AVEC sa critique publiée. Trois fiches (fibres, lactose, cœliaque) écrivent explicitement qu'il
    n'y a pas d'opposant à présenter — en fabriquer un donnerait une fausse image de l'état des
    connaissances.
  - ⚠️ **Le build refuse** une position sans source, une source inexistante, un titre non
    interrogatif, un lien vers un aliment absent, ou le vocabulaire banni §6.2. 6 tests de rejet
    dans `catalog/build.test.ts`, 6 tests de propriété dans `catalog-loader.test.ts`.
  - ⚠️ **Le badge reste typographique et neutre** (§5 DESIGN) : jamais de couleur, jamais d'étoiles.
    Le colorer est la modification la plus tentante et la plus interdite de cet écran.
  - ⛔ **CONTENU NON RELU.** §8.2 bis exige une relecture par un tiers avant publication : ces
    8 fiches portent des affirmations de santé et restent des **brouillons**. Trois réserves
    signalées dans les fichiers : un DOI déduit (critique Messerli), une liste d'auteurs non
    vérifiée (`critique-zhao-2018`, la page éditeur exige un compte), une URL ANSES en anglais.
  - `HealthTopic` reste un type **sans table** : les chapitres de §6.3 (deux niveaux familles →
    chapitres) sont rendus par les fiches elles-mêmes, groupées par `categorie`. Les critères
    applicables aux suggestions (`topic_criterion`, bouton « Appliquer ces critères ») n'existent
    pas — c'est du moteur, pas de l'affichage.
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
- ✅ **Routage par fragment d'URL** (`ui/router.tsx`), sans bibliothèque — décision reprise le
  2026-07-30 à l'arrivée de la fiche recette. Par hash et NON par History API : l'appli vise un
  hébergement statique nu et une PWA servie hors ligne par le service worker (§7 ARCHITECTURE), où
  personne ne réécrit `/semaine` vers `index.html` — un rechargement rendrait un 404.
  `react-router-dom` reste non installé : une seule route paramétrée ne justifie pas une dépendance
  et son écosystème. **À rediscuter** si une deuxième route paramétrée ou une route imbriquée
  apparaît. `routeDepuisHash` est testé (`ui/router.test.ts`).

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
