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

**Suite exécutée le 2026-08-07, arbre COMPLET — lot mode cuisine et facettes `cuisine` inclus** :
`npm test` → **1 669 passed / 0 failed (91 fichiers)** en 50,2 s · `npm run typecheck` propre ·
`npx vite build` ✓ · `npm run engine:plan-stress` → **20/20, PLUS AUCUN SIGNAL** (le dernier,
« végétalien + sans gluten », est éteint par le lot de 8 plats — voir §8). Les comptes du
catalogue sont **en tête de §8 et nulle part ailleurs**. **La sortie réelle fait foi, pas cette
ligne.**
*(Relevés antérieurs, conservés pour mémoire : 1 253 / 77 le 2026-08-03 avec 200 aliments ;
572 / 44 le 2026-07-29. Le catalogue a plus que doublé entre les deux — attention aux mesures
prises sur l'ancien, voir décisions 33 et 48.)*

**Le catalogue est réel** : des aliments aux valeurs CIQUAL 2025 de l'ANSES (plus aucun `PROV-`), des
recettes, un lexique de gestes, des tips et des fiches « Comprendre » — **les comptes sont en tête de
§8 et nulle part ailleurs**, et les cibles de la décision 4 sont dépassées. ⚠️ **Le contenu Savoir
n'est PAS relu** (§8.2 bis). Le contenu a
servi de banc de mesure et a révélé quatre défauts du moteur, tous corrigés **par mesure et non au
jugé** : l'ingrédient caractéristique (§6.6 bis), la pondération de la similarité (§6.6 ter), la
règle de récence (§6.6 quater et quinquies), la couverture nutritionnelle (§5.1 bis).

**L'interface est livrée.** Les huit écrans de `DESIGN.md` §4 le sont depuis le 2026-07-30 ; le code
en porte **douze** (Paramètres et Éditeur de recette le 2026-08-01, mode cuisine le 2026-08-06,
fiche aliment le 2026-08-07) et **onze** sont couverts par des tests d'écran. Les trois comptes sont
justes et volontaires — **détail et cause en §5**.
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
Concept ─▶ Architecture ─▶ Moteur ─▶ Analyse marché ─▶ Design UI ─▶ Code ── P0 ✅ ── P1a ✅ ── P1b-1 ✅ ── P1b-2 ✅ ── P1c (lots 1-4 ✅) ── CONTENU ✅ ── suggestAlternatives ✅ ── planning ✅ ── restes ✅ ── liste de courses ✅ ── lexique ✅ ── UI ✅ (12 écrans) ── TESTS D'ÉCRAN ✅ ─▶ CONTENU & DISTRIBUTION ▓▓
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
| **Contenu — état COURANT du catalogue** | `catalog/sources/foods.yaml`, `catalog/recipes/`, `catalog/lexicon/`, `catalog/equipment/` | ✅ **451 aliments · 330 recettes · 1 548 étapes · 62 gestes · 73 tips · 8 fiches · 30 équipements** (relevé du 2026-08-09 — 450/241 le 2026-08-05, 199 aliments le 2026-07-29). Les deux cibles de la décision 4 (~200 aliments, 200-300 recettes) sont dépassées. Ⓐ Les lignes ci-dessus datent chacune de la clôture de son lot ; **celle-ci fait foi** |
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
> réécrite — c'est voulu. Tout ce qui a été livré ensuite (les douze écrans, les tests d'écran, le
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
- ⛔ **Roquefort et bleu d'Auvergne ne portent PAS `sulfites`, et la question est close (2026-08-09).**
  Vérifié source ouverte AVANT de toucher la donnée, et la source dit **le contraire de la rumeur**,
  pas « rien trouvé » : les deux entrées portent des **noms protégés**, et leur cahier des charges
  AOP énumère *positivement et limitativement* ce qui peut entrer dans le lait et en fabrication —
  présure, sel, cultures d'innocuité démontrée (Roquefort, INAO) ; présure, *Penicillium roqueforti*,
  cultures (Bleu d'Auvergne, BO du ministère de l'Agriculture). Une liste positive fermée qui ne cite
  pas les sulfites les exclut : le seuil de déclaration de **10 mg/kg en SO₂** (règlement UE
  1169/2011 annexe II) n'a rien à mesurer. Ils gardent `lait` seul.
  **Ce qui n'a PAS été vérifié, et n'avait pas à l'être** : le cas général du règlement CE 1333/2008
  annexe II catégorie 01.7 « fromages ». L'AOP est plus restrictive que le régime général. Le jour où
  le catalogue accueillera un bleu **générique, non AOP**, la question se reposera pour celui-là et
  il faudra ouvrir 1333/2008 — pas avant.
  ⚠️ **Pourquoi c'est écrit ici et pas ailleurs** : ajouter un allergène non fondé retire
  silencieusement des recettes à quelqu'un qui pouvait les manger. C'est le **principe 1** qui
  tranche, pas la prudence. La croyance vient probablement d'une confusion avec l'histamine et la
  tyramine, réellement élevées dans les fromages affinés et qui ne sont pas des allergènes
  réglementaires.

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
  (ustensile, **n'exclut jamais**).
  ✅ **LIVRÉ le 2026-08-09, du YAML jusqu'à l'écran** — la ligne disait « jamais chargé par le
  moteur », ce n'est plus vrai. `catalog/equipment/` (**30 entrées**), tables `equipment` et
  `recipe_equipment`, **1 473 couples** sur 330 recettes (357 requis · 38 accélère · 1 078
  informatifs), aucun orphelin au référentiel. Côté app : `Catalog.equipment`, `Recipe.equipements`,
  `user_equipment` enfin lu ET écrit, section « Matériel » sur la fiche recette.
- ⛔ **Le niveau vit sur le COUPLE recette × équipement, jamais sur l'ustensile.** Un mixeur est
  `requis` pour un velouté lisse et `informatif` pour une soupe rustique : c'est une propriété de la
  recette, pas de l'appareil. Un référentiel qui porterait le niveau forcerait la valeur la plus
  dure partout.
- ⛔ **`HardConstraints.ownedEquipmentIds` est un TRI-ÉTAT, et c'est structurel.** `null` = jamais
  déclaré → **couche inerte** ; `[]` = déclaré vide → exclut les `requis`. Confondre les deux
  supprimerait d'un coup les **107 recettes qui passent par un four** pour tout utilisateur n'ayant
  rien renseigné. Même parti que `temps.ts` (`availableMin === null`), `PiquantTolerance` et
  `porteDejaUneSauce`. **`engine:plan-stress` est le garde-fou** : il vire au rouge si le tri-état
  se replie en liste vide.
- ⛔ **`requis` est réservé à l'INFAISABLE SANS.** Un mixeur pour un velouté est `accelere` (moulin
  à légumes, presse-purée, tamis font le travail) ; tout ce qui se remplace par un ustensile de base
  est `informatif`. `ENGINE_4` §141 avertit : sans cette discipline, ne pas posséder de mixeur
  supprimerait la moitié du catalogue.
- **Archétypes — CODÉS (P1b-2), noms validés** : remplacent/généralisent l'idée initiale de
  « 4 préréglages nommés » — un vecteur de poids nommé sur les couches de score, jamais sur les
  couches critiques (`equilibre` défaut, `envie`, `decouverte`, `de_saison`, `mes_gouts`,
  `rapide`). Le sélecteur UI (onboarding/Paramètres) reste **P3**. Détail : `docs/ENGINE.md`
  §6.3 bis.
- **65a — l'occupation d'un four se dérive du texte des étapes, et un partage se déclare au
  catalogue. TRANCHÉ et CODÉ le 2026-08-13** (cinq lots A→E ; détail :
  `docs/CONCEPTION_RESERVATION_MATERIEL.md`). Trois choses sont figées. **(a) Une occupation est un
  intervalle, pas une étape** : `recipe_step_equipment` porte `(ordre_debut, ordre_fin)`, ce qui
  seul exprime qu'un four est LIBRE entre deux cuissons de la même recette — 13 recettes le
  demandent. **92 occupations sur 85 recettes, 4 déclarées et 88 dérivées** ; la colonne `origine`
  rend la dérivation visible au lieu de la fondre dans le déclaré, comme pour
  `recipe_step_ingredient`. **(b) La règle de détection est versionnée** (`catalog/`), pas enfouie
  dans une sonde de `atelier/` : c'était le reproche exact que la 65 faisait à l'inférence par les
  gestes. Une déclaration `occupe:` dans le YAML l'emporte toujours sur la dérivation. **(c) Le
  partage est une donnée à TROIS valeurs** — `jamais` / `selon_quantite` / `toujours` — et la
  troisième est celle qui fait tenir l'ensemble : elle nomme « je ne sais pas combien tu en as »
  sans y répondre. ⛔ **Une capacité inconnue rend `null`, et `null` n'est pas 1.** Le moteur se
  tait. C'est ce qui permet de livrer sans avoir tranché 65b. ⚠️ **Le gain n'est pas le volume de
  fausses alertes évitées** : sur les paires de recettes à occupation de four, **2 831 sur 3 321 se
  chevauchent encore (85,2 %)**. Le gain est que l'écran dit **une plage** au lieu d'une liste de
  noms — un fait daté, pas un jugement (principe 6).

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
- ⛔ **CE PRÉREQUIS EST ROUVERT LE 2026-08-06 — décision 60 de §4.** Il disait : le lien
  étape → ingrédient, `etapes[].food_ids` **écrit à la main**, pas dérivé, sur les **1 101 gestes**
  *(la dérivation par rapprochement de texte a été envisagée et écartée : `food` n'a ni synonyme ni
  alias)*. **La parenthèse est fausse depuis le 2026-08-05** : `food.synonymes` existe, ajouté par la
  décision 58 le lendemain de cette décision-ci, par une piste parallèle. La justification a expiré
  sans que personne ne relise ce qu'elle portait. Spec : `ARCHITECTURE.md` §5bis. **Ordre des lots :
  `CONCEPTION_MODE_CUISINE.md`.**
- ✅ **Le second prérequis est levé — lot L0, 2026-08-05.** `recipe_step.nature` distingue le geste
  de l'avertissement sur les **18 recettes** qui comptaient une mention ANSES ou ministère de
  l'Agriculture comme une étape à faire. Deux règles rouges au build (nature inconnue ; avertissement
  ailleurs qu'en dernier) et la fiche recette qui sort la mention de la liste numérotée. Mesuré :
  **1 119 étapes, 1 101 gestes, 18 avertissements**.
- ✅ **L'écran du mode cuisine est codé — lot L1, 2026-08-05.** Écran allumé (`ecran-allume.ts`),
  une étape à la fois qui **n'avance jamais seule**, minuteurs parallèles qui survivent au changement
  d'étape, alarme au premier plan qui **sonne jusqu'à l'appui ou 5 min**, et reprise d'une cuisson
  (schéma **v10**) avec son bandeau sur Aujourd'hui. ⚠️ **Trois écarts assumés au plan**, tous
  documentés dans `CONCEPTION_MODE_CUISINE.md` : la migration est une **v10 et non une v9** (prise
  le même jour par la décision 51) ; les deux colonnes de `user_cuisine_timer` sont **mutuellement
  exclusives par CHECK** au lieu d'un simple discriminant nullable ; `parcours.ts` **n'a pas reçu
  d'entrée de visite guidée** — ✅ **tranché le 2026-08-07 : il n'en aura pas**, et ce n'est plus une
  dette. `lancerParcours` navigue vers `parcours.ecran` quand on choisit un tutoriel depuis Réglages ;
  pour le mode cuisine ce serait un `#/cuisine/<id>` en dur, et **ouvrir cet écran écrit
  `user_cuisine_session`**, qui ne tient qu'une ligne — revoir un tutoriel effacerait la cuisson en
  cours. `ecran: null` ne sauve rien : toutes les étapes seraient sautées, c'est le tutoriel fantôme
  que la règle 1 de `parcours.ts` interdit. **Ligne qui en découle : un parcours par écran atteignable
  depuis la barre d'onglets** — la fiche recette n'en a pas non plus, pour le même motif. Raisonnement
  complet au-dessus de la table `PARCOURS`, verrouillé par un test.
- ✅ **Les ingrédients sont dans le mode cuisine — 2026-08-06, schéma v11.** L'écran tenait la
  recette complète en mémoire et n'en affichait **aucun** ingrédient : « c'était combien d'ail ? »
  obligeait à quitter la cuisson pour rouvrir la fiche. Une fenêtre `Panneau` donne désormais la
  liste entière, quantités mises à l'échelle des portions, depuis n'importe quelle étape. ⚠️ **La
  liste et le sélecteur de portions sont EXTRAITS de `detail-recette.tsx`** (`ui/ingredients-recette.tsx`),
  pas recopiés — la règle de `ui/quantites.ts` est trop subtile pour vivre en deux exemplaires.
  **Migration v11** : colonne `portions` sur `user_cuisine_session`, **nullable = aucun choix
  exprimé**, jamais un défaut déguisé ; les portions réglées sur la fiche voyagent par
  `#/cuisine/<id>?portions=<n>` et sont ensuite tenues par la session. ⚠️ **La sonnerie ferme la
  fenêtre** : `Panneau` est un portail posé après l'écran, il recouvrirait la surface d'arrêt de
  l'alarme. ⛔ **Ce lot DÉSAMORCE le prérequis A** — voir la décision 60 de §4 : le lien
  étape → ingrédient n'est plus ce qui bloque l'usage, il devient un raffinement.
- ✅ **Le lien étape → ingrédient existe — lot L2, 2026-08-07, ET IL N'A DEMANDÉ AUCUNE ANNOTATION.**
  Le plan prévoyait 1 350 saisies à la main ; il y en a eu zéro. `catalog/lien-etape-ingredient.mjs`
  dérive le lien du texte au build : **93,2 % des gestes** trouvent au moins un ingrédient, 1,9 %
  sont ambigus. ⚠️ **93,2 et non 93,7 : le taux a BAISSÉ le 2026-08-08, et c'est une correction** —
  41 liens hérités à tort ont été retirés (voir la puce « l'antécédent d'un pronom » plus bas). Un
  taux de couverture qui monte n'est pas en soi une bonne nouvelle quand ce qu'il compte est faux. Cinq mécanismes, dont trois hors plan — mot de tête sur les DEUX premiers mots (le
  nom CIQUAL met le règne devant : « Veau, escalope »), hyperonyme résolu par le `groupe` de
  l'aliment (« les fruits » → pomme, orange, banane de CETTE recette), et héritage sur pronom
  (« les blanchir »), le déterminant étant distingué de l'article par l'infinitif qui suit.
  ⚠️ **Une ambiguïté fait TAIRE l'ingrédient** au lieu de le deviner, et **on n'hérite jamais d'un
  héritage** : une chaîne d'approximations n'est plus une donnée. ⛔ **L'INTERDIT QUI VA AVEC :
  cette table AJOUTE, elle ne FILTRE JAMAIS.** L'écran met la quantité sous l'étape et laisse la
  liste complète à un tap — c'est ce qui rend 93,7 % suffisants. Filtrer ferait afficher une liste
  vide sur une étape sur seize et cacherait 5 % des ingrédients : l'écran qui ment par omission.
  ▶ **La décision 60 est FERMÉE**, et L3 est abandonné, remplacé par cette ligne de quantités.
  Remesurer : `node catalog/mesure-liens-etapes.mjs`. ⚠️ **La sonde vit dans `catalog/` et non dans
  `atelier/`, qui est gitignoré** — une mesure qu'on ne committe pas ne prouve rien à personne
  d'autre, et cette décision-là s'est jouée sur ses chiffres.
- ✅ **La quantité est DANS la phrase de l'étape, plus seulement en badge dessous — 2026-08-08.**
  « Émincer l'oignon » devient « Émincer **1 gros oignon** », et le nombre suit le sélecteur de
  portions. **Aucune recette YAML n'a été touchée**, et c'est la contrainte qui commande tout le
  reste : un nombre écrit dans le catalogue serait figé et cesserait de s'échelonner. L'injection se
  fait donc au rendu (`app/src/ui/texte-etape.ts`, module pur, 47 tests), servi aux deux écrans.
  **Au 2026-08-09 : 1 866 liens posés, soit 1 111 gestes sur 1 407 (79,0 %)** — et, en écartant ce
  qui n'est pas chiffrable (fond de placard, « au goût »), **1 088 gestes sur 1 249 (87,1 %)**.
  ⚠️ **Le relevé précédent — 1 828 liens, 1 086 gestes sur 1 397 — a été pris sur un catalogue plus
  petit : ce n'est PAS un écart mesuré, ne pas le soustraire.** Le seul delta juste de ce lot est
  diffé ligne à ligne plus bas.
  ⛔ **CE MODULE NE DÉCIDE JAMAIS QUEL INGRÉDIENT UNE ÉTAPE UTILISE** — c'est le verdict du build
  (`RecipeStep.foodIds`, décision 60). Il cherche seulement *où* le nom est écrit, parce que
  `rapprocherEtape` travaille sur des mots normalisés et perd les positions de caractères. **Un
  échec de localisation est un no-op silencieux** : le badge reste, et l'invariant « la table AJOUTE,
  elle ne FILTRE JAMAIS » tient — l'union phrase + badges égale toujours `foodIds`.
  ⚠️ **La règle est grammaticale, pas cosmétique, et elle a deux branches.** Le déterminant est
  soit **remplacé** (« l'oignon » → « 1 gros oignon »), soit **accordé au nombre de la quantité**
  quand il appartient à un nom et ne peut pas disparaître : « le reste **du** beurre » → « le reste
  **des** 50 g de beurre », « **chaque** banane » → « **les** 4 bananes », « la moitié **de l'**
  oignon » → « la moitié **d'**1 gros oignon ». ⛔ **Le `de` NU régi par un verbe fait une troisième
  branche, et l'avoir prise pour la première a produit 85 phrases fausses** — voir `PIEGES.md`.
  ⚠️ **Ce qui reste hors de portée d'une règle** : 943 liens non injectés, dont **368 libellés sans
  nombre** (« au goût ») — irrécupérables par construction. ✅ **Le gisement des étapes où l'aliment
  n'est pas nommé est TOMBÉ de 17 à 1** le 2026-08-09 par la règle du nom de portion, puce suivante.
  ▶ **Remesurer : `npx tsx atelier/mesure-quantites-dans-etapes.mjs`** (couverture et ventilation
  des ratés) et **`atelier/phrases-suspectes.mjs`** (relit les 1 828 phrases produites, signale
  répétitions et prépositions mangées — c'est lui qui a trouvé les deux défauts).
  ⚠️ **Ces deux sondes sont dans `atelier/`, donc gitignorées, à l'inverse de celle de L2 — et
  c'est délibéré : elles décrivent le CATALOGUE, pas le code.** Leur chiffre bouge à chaque lot de
  contenu sans qu'aucune régression ait eu lieu ; le figer dans un test ferait rougir la suite au
  premier ajout de recette.
- ✅ **LE LIBELLÉ D'UN INGRÉDIENT DÉCLARE EN QUOI IL SE COMPTE — 2026-08-09, règle donnée par
  l'utilisateur.** « Poser **les filets** dans un plat » ne nommait aucun aliment : ni la dérivation
  ni l'injection ne voyaient d'églefin. Or `unite_affichage: "4 filets"` **le dit déjà** — dans
  CETTE recette, cette chair se compte en filets. Le mot de portion vaut donc nom d'aliment, aux
  deux bouts : `portionDuLibelle`/`portionEmployee` dans `catalog/lien-etape-ingredient.mjs`, forme
  cherchable **essayée en dernier** dans `ui/texte-etape.ts`. **C'est le mouvement d'`HYPERONYMES`,
  avec la ligne d'ingrédient pour source au lieu du `groupe`** — le catalogue portait l'information,
  personne ne la lisait. **Bilan diffé ligne à ligne** : liens **2 795 → 2 809 (+17 / −3)**, gestes
  chiffrés **1 097 → 1 111**, plus **11 phrases réécrites** ; le gisement à réécrire à la main passe
  de **17 à 1**. Les 3 liens perdus sont un gain — un héritage FAUX sur `pain_perdu #2` remplacé par
  le lien direct vers `pain_mie`.
  ⛔ **TROIS GARDES, ET AUCUN DES TROIS N'A ÉTÉ TROUVÉ PAR UN TEST** — deux par le diff du rendu, un
  par la relecture de l'utilisateur. Un même mot est un **nom** (« poser les filets »), un
  **participe passé** (« le poulet tranché ») et une **mesure** (« un filet d'huile ») : déterminant
  devant · complément qui nomme un **AUTRE** ingrédient · refus du singulier indéfini « une ». Détail
  et contre-exemples : `PIEGES.md`.
  ⚠️ **Le défaut le plus cher de ce lot n'était pas un lien manquant mais un NOMBRE FAUX** — « rouler
  chacune dans **une tranche** de jambon » rendu « dans **8 tranches** », et **le compte de liens
  MONTAIT**. Un lot de langue se mesure ligne à ligne sur le RENDU ; un total en hausse aurait
  présenté ce défaut comme un succès.
  ⚠️ **Le verdict rendu est `tete`, pas un cinquième verdict** — pour que la mécanique d'ambiguïté
  existante joue seule (deux chairs en filets dans la même recette ⇒ les deux se taisent).
  ⚠️ **Une portion ne vaut nommage que si c'est ELLE qui a été trouvée dans la phrase**, sinon
  « ajouter 1 filet **d'huile** » perd son complément : le libellé d'une huile *est* « 1 filet ».
  ⚠️ **Ce lot a cassé deux accords dans le catalogue, et c'est le YAML qui les porte** :
  « chaque tranche … sans **la** laisser » devient « les 8 tranches … sans **la** laisser »
  (`pain-perdu.yaml`, `chocolat-chaud-avoine-tartine.yaml`). **Aucun nombre n'a été écrit dans aucun
  YAML** — c'est la contrainte qui commande tout ce chantier.
  ▶ Tests : `catalog/lien-etape-ingredient.test.ts` (21) et `app/src/ui/texte-etape.test.ts` (47).
  Récit : [archive/…_quantites-portions.md](./archive/RECAP_SESSION_2026-08-09_quantites-portions.md).
- ✅ **L'antécédent d'un pronom n'est ni un verbe ni un fond de placard — 2026-08-08.** Deux défauts
  de `liensDeLaRecette`, trouvés par la RELECTURE HUMAINE des étapes à réécrire, pas par une sonde :
  aucune mesure ne les voyait, parce que tous deux produisent un lien **plausible**.
  **(a) LE FAUX INFINITIF.** `estInfinitif` n'est qu'un test de terminaison — tout mot de plus de
  trois lettres en `-er/-ir/-re`. Donc « **la chair** » se lisait « pronom + verbe », et à lui seul
  il déclenchait **8 héritages faux**, tous des cuissons de poisson (« jusqu'à ce que la chair se
  détache de l'arête »). Même piège pour « le beurre », « le sucre », « le centre », « l'autre face ».
  → `NOMS_EN_APPARENCE_INFINITIFS`, **liste relevée sur les 143 mots que le catalogue place
  réellement derrière un pronom**, pas devinée ; la compléter se fait de la même façon.
  **(b) L'ANTÉCÉDENT VOLÉ.** Ce qu'une étape EMPLOIE et ce que son pronom DÉSIGNERA ne sont pas la
  même chose. « LES plonger dans une eau salée et citronnée » emploie le sel et le citron ; « les »
  de l'étape suivante, ce sont toujours les artichauts. Les liens servaient d'antécédent, donc la
  référence dérivait vers l'assaisonnement et l'erreur se propageait. → l'antécédent écarte les
  ingrédients attrapés **par un verbe** et les **fonds de placard** ; si rien ne reste, la référence
  précédente tient. ⚠️ **L'étape garde tous ses liens** : seul l'antécédent est filtré.
  **Bilan, diffé ligne à ligne et non en totaux** : 47 liens partent, 2 arrivent, hérités 43 → 36.
  **L'injection de quantités ne perd rien** (1 828 liens avant comme après) — ce qui a été retiré
  n'était injecté nulle part, ce qui est la signature d'un lien faux. 8 pertes restantes sont
  justes : « Enfourner », « Servir aussitôt », « Retourner d'un coup » n'emploient aucun ingrédient.
  **4 étapes ont reçu un `food_ids` à la main** (`salade_crabe_avocat` 2, `langoustines…` 4,
  `omelette…` 4, `huitres…` 4) : le faux pronom y tombait juste par accident, et la soupape de la
  décision 60 est faite exactement pour ça. ⚠️ **Un `food_ids` n'est pas un nombre** — il n'introduit
  aucune quantité dans le YAML, donc rien qui puisse se figer.
  ⛔ **LE FOND DE PLACARD EST HORS DU CHANTIER DE RÉÉCRITURE, et c'est structurel** : sa quantité est
  FIGÉE. Tout ce travail existe pour qu'un nombre suive le sélecteur de portions — une pincée reste
  une pincée à 2 comme à 8 couverts. Ils restent des LIENS, donc des badges : écartés de la corvée,
  pas du catalogue. 31 des 114 étapes à réécrire n'existaient que pour eux.
  ▶ Tests : `catalog/lien-etape-ingredient.test.ts` (8, écrits en rouge d'abord). Rejouer le diff :
  `git show HEAD:catalog/lien-etape-ingredient.mjs > atelier/lien-avant.mjs && node atelier/diff-liens.mjs`.
- ✅ **Les gestes du lexique sont dans le mode cuisine — lot L1ter, 2026-08-07.** Même mesure que
  L1bis, un cran plus loin : l'écran tenait déjà le catalogue et les `lexiconIds` de chaque étape, les
  62 fiches du lexique existaient, et « c'est quoi émincer ? » imposait le même aller-retour vers la
  fiche que « c'était combien d'ail ? ». **Aucune donnée nouvelle, aucun schéma** — le dépliant est
  **extrait** vers `ui/gestes-etape.tsx` et servi aux deux écrans. ⚠️ **Il se déplie SUR PLACE et non
  en fenêtre, à l'inverse de L1bis et pour la raison inverse** : une liste se consulte à côté de
  l'étape, une définition se lit dedans — une fenêtre recouvrirait ce qu'on cherche à comprendre.
  Deux tests miroirs (`aria-haspopup` d'un côté, `aria-expanded` de l'autre) tiennent l'asymétrie
  contre une « harmonisation » future. ⚠️ **Le `key={etape.ordre}` a été vérifié en le retirant** :
  sans lui la définition se rouvrait toute seule au retour sur l'étape. ⚠️ **La fiche recette n'était
  couverte par aucun test sur ce dépliant** — l'extraction aurait pu la casser en silence ; c'est
  réparé. ▶ **Ce lot épuise ce que le mode cuisine gagnait sans donnée nouvelle** : L2, L3 et L4
  demandent tous du contenu ou un lot entier.
- ✅ **Deux défauts du mode cuisine corrigés — 2026-08-07. Aucun des deux n'était visible d'un test,
  et tous deux venaient du CATALOGUE, pas d'un cas limite imaginé.**
  **(1) Le format des durées n'avait pas de plafond.** `formaterDuree` rendait du `mm:ss` sans borne
  alors que **22 recettes portent un minuteur de plus d'une heure** — `coq-au-vin` en porte un de
  **43 200 s**. L'écran annonçait donc « Lancer le minuteur (**720:00**) » et décomptait
  « **719:59** » en 2,2 rem. Au-delà de l'heure, l'unité est désormais **écrite** (« 12 h 00 ») et les
  secondes tombent : une chaîne à deux-points **se lit comme des minutes** quand on y jette un œil, ce
  qui est tout l'usage de cet écran — `12:00:00` n'aurait réglé qu'à moitié, il ne diffère de `12:00`
  que par un suffixe qu'on rate de loin. ⚠️ **Un test entérinait le défaut** (`[3600, '60:00']`) :
  changer cette assertion-là était la correction, pas le contournement — elle encodait un format
  jamais confronté à ses données.
  **(2) La péremption se compte depuis la fin du dernier minuteur, plus depuis `ouverteLe`.** Le seuil
  de 12 h **égalait exactement** le plus long minuteur du catalogue : une marinade lancée à 20 h
  aboutissait à 8 h, et sa session périmait à 8 h — **à la seconde où elle avait quelque chose à
  annoncer**. Le bandeau « un minuteur est arrivé à terme » était inatteignable pour `coq_au_vin` et
  `hareng_pommes_terre_tiedes`. ▶ **Question D de `CONCEPTION_MODE_CUISINE.md` §8 FERMÉE**, et le
  nombre n'a pas bougé : **le point de référence était en cause, pas le seuil.** ⚠️ **Conséquence
  assumée : un minuteur en marche rend sa session impérissable** ; une pause, qui ne porte aucune
  échéance, ne prolonge rien.
- ✅ **Le garde-fou anti-sonnerie visait à côté — corrigé le 2026-08-07.** Il semait un `Set` des
  minuteurs échus **au montage**, donc il répondait à « l'écran vient-il d'être monté » quand la
  question est « **est-ce encore vrai** ». Deux trous opposés, **tous deux hors de portée de
  `jsdom`** : au **retour d'arrière-plan sans démontage**, le battement de seconde reprenait et la
  sonnerie partait pour un plat sorti du feu depuis quarante minutes — le mensonge même que ce
  garde-fou existait pour empêcher ; et à la **réouverture trois secondes après l'échéance**, le
  semis supprimait la sonnerie **en silence** alors qu'elle venait d'arriver. La règle est désormais
  `sonnerieEncoreJuste(depuisS)`, appliquée à **chaque battement**. ⚠️ **Son seuil n'est pas inventé :
  c'est `ARRET_AUTO_MS`, importé et non recopié** — « l'alarme serait-elle encore en train de sonner
  si quelqu'un avait été là ? ». Le `Set` reste, mais il n'empêche plus que la répétition.
  ⚠️ **Limite assumée** : l'acquittement n'est pas persisté, donc revenir sur l'écran dans les cinq
  minutes suivant une échéance refait sonner — une colonne de schéma pour ça serait disproportionné.
  ⚠️ **Falsification faite, pas déduite** : l'ancien code remis en place rend **4 tests rouges**, et
  son propre test de reprise restait **vert** — c'est ce qui montre que la suite ne pouvait pas voir
  le trou. Sans le seuil et sans le semis, c'est ce test-là qui tombe : la garantie est bien portée
  par la règle, pas par le montage.
- ✅ **« Étape 0 » ne s'affiche plus (2026-08-07).** Un minuteur dont l'étape n'existe plus — recette
  modifiée en cours de cuisson par l'éditeur, ou renumérotée par une mise à jour de catalogue — donnait
  `findIndex → -1`, rendu « Étape 0 — il reste 4:12 ». La ligne **perd son numéro et garde son
  décompte** : le faire disparaître serait pire, c'est un décompte qu'on oublie.
- ✅ **Trois finitions du mode cuisine — 2026-08-07.**
  **(1) Le bandeau de reprise a un battement.** Il lisait `Date.now()` AU RENDU et n'y revenait
  jamais : posé sur « Aujourd'hui » pendant que sa cuisson finit, on ne voyait **jamais** apparaître
  « un minuteur est arrivé à terme ». C'est précisément le reproche que la décision de ne pas sonner
  en arrière-plan s'était engagée à ne pas mériter. ⚠️ **L'intervalle ne tourne que s'il y a une
  cuisson** — sinon tout le monde paierait un timer permanent sur l'écran d'accueil.
  **(2) `scaleRecipe` n'est plus rappelé deux fois par seconde.** `quantitePour` était invoqué à
  chaque rendu, deux fois, sur le seul écran conçu pour rester allumé toute une cuisson : **7 200
  passes moteur et 7 200 `Map` neuves par heure** pour une valeur qui ne bouge qu'au changement de
  portions — plus autant de rendus forcés chez les enfants, l'identité de la `Map` changeant à chaque
  seconde. `useMemo`, donc **au-dessus des retours anticipés**, d'où le calcul de `portions` hissé.
  **(3) « Terminer la cuisson » ne jette plus un minuteur en cours sans le dire.** Le cas est banal :
  la dernière étape est souvent un repos, on lance son minuteur, et le bouton qui clôt le déroulé est
  juste à côté — `clearCuisineSession` emportait la ligne et ses enfants. ⚠️ **On ne demande rien
  quand il n'y a rien à perdre** : une confirmation systématique est une confirmation qu'on cesse de
  lire, et elle aurait alors coûté la seule chose qu'elle protège. La fenêtre **dit ce qu'on perd**
  (le nombre de décomptes), pas « êtes-vous sûr », et `aria-haspopup` est **conditionnel** — annoncer
  toujours une fenêtre mentirait une fois sur deux. Elle se ferme à la sonnerie, comme celle des
  ingrédients et pour le même motif de portail.
  ⚠️ **PIÈGE DE TEST PAYÉ ICI** : un intervalle posé par un effet dont la dépendance arrive **d'une
  promesse** (donc hors `act`) n'existe pas encore quand `advanceTimersByTime` est appelé dans le même
  bloc `act` — l'effet passif n'est rejoué qu'à la fermeture du bloc. Il faut un `await act(async
  () => {})` de vidange AVANT d'avancer l'horloge. `cuisine.test.tsx` n'a jamais eu ce piège : son
  intervalle a des dépendances vides, donc il est posé pendant le montage, que `render` enveloppe.
- ✅ **Le mode cuisine tient PLUSIEURS PLATS, et il dit quand les lancer — 2026-08-09, niveau 1 de
  `engine/cuisine/ordonnancement.ts`.** Entrée à plusieurs plats depuis la fiche recette, heure de
  service (une seule ligne en base, `user_cuisine_service` v13 : la fonctionnalité est de faire
  arriver ENSEMBLE des plats de durées différentes), frise des départs sous la barre d'onglets.
  Le moteur et la base portaient le niveau 1 depuis deux lots — **il ne manquait que l'écran, et
  c'est la cinquième occurrence de « un champ déclaré n'est pas un champ branché »**.
  ⛔ **LE FAIT DU LOT EST AILLEURS : LA DURÉE QUI ALIMENTAIT LA FRISE ÉTAIT FAUSSE SUR 143 RECETTES
  SUR 308.** `tempsPrepMin + tempsCuissonMin` ne compte pas les repos ; la frise annonçait « à lancer
  45 min avant le service » pour `hareng_pommes_terre_tiedes` et sa marinade de **douze heures**
  (`coq_au_vin` : 115 min annoncées, 838 réelles). Médiane de la correction **+12 min** — 87 des 143
  sous le quart d'heure, du bruit éditorial — mais **20 au-delà de l'heure** et un écart maximal de
  **11 h 40**. ⚠️ **Ce défaut n'a pas été trouvé en relisant le code mais en interrogeant
  `catalog.db`** : le code était cohérent avec lui-même et avec ses tests, c'est sa donnée d'entrée
  qui mentait, et `ordonnancement.ts` déclarait honnêtement la limite dans son en-tête.
  `dureeTotaleMin` rend désormais `tempsPrepMin + max(tempsCuissonMin, somme des minuteurs)` — pas
  une somme des trois : les minuteurs RECOUVRENT la cuisson déclarée (7 recettes seulement la
  dépassent, de 17 min au pire), la préparation est du temps de mains qui s'ajoute.
  **Approximation assumée** : les minuteurs sont sommés comme s'ils s'enchaînaient — elle penche du
  bon côté, on annonce un départ trop tôt et jamais trop tard.
  ⚠️ **Le seuil des « repos longs » (120 min) vient de la distribution du catalogue, pas du jugé** :
  73 des 81 étapes de repos tiennent en deux heures, **puis plus rien jusqu'à trois**, puis une queue
  de huit (3 h, 4 h, 6 h, 8 h, 12 h). Le creux est là. ⛔ **Et le seuil porte sur le CUMUL par
  recette, pas sur chaque repos** : la relecture a trouvé le trou puis l'a jugé « inatteignable par
  le catalogue actuel » — **quatre recettes y étaient déjà** (`sardines_marinees_citron` 180 min,
  `pain_maison` 160 en plusieurs levées, `poivrons_grilles_marines` 135, `gaspacho` 130), toutes
  muettes sur un départ décalé de deux à trois heures. *« Inatteignable en pratique » est une
  affirmation mesurable.* ⚠️ **Deux tests REDISAIENT la formule au lieu de l'appeler** et attendaient
  « 1 h 55 » pour le coq au vin ; ils n'ont protesté que parce que la frise affiche le nombre en
  toutes lettres. Récit complet, pièges d'horloge compris :
  [archive/RECAP_SESSION_2026-08-09_cuisine-multi-plats.md](./archive/RECAP_SESSION_2026-08-09_cuisine-multi-plats.md).
- **Le minuteur sonne au premier plan, pas en arrière-plan** (2026-08-04) — et **la reprise remplace
  la notification** : l'étape atteinte et les minuteurs survivent à la fermeture (schéma **v10**), un
  bandeau les ramène. ⚠️ **Échéance absolue (`fin_ms`), jamais un temps restant** : un restant se
  fige quand l'appli est fermée, et l'écran affirmerait quelque chose de faux sur de la nourriture.
  Motif du non-arrière-plan : les quatre voies Android ont été vérifiées et coûtent toutes plus
  qu'elles ne rapportent — `SCHEDULE_EXACT_ALARM` est un aller-retour dans les réglages système et
  non une fenêtre, `USE_EXACT_ALARM` est **bloquée à la publication Play** hors agenda/réveil, aucun
  `foregroundServiceType` ne convient à un minuteur. **Aucune permission Android nouvelle.** Le pari
  `USE_EXACT_ALARM` reste rejouable. Détail et comparatif des applis existantes :
  `CONCEPTION_MODE_CUISINE.md` §5-6.
- **Cuisine partagée multi-appareils : v2** (2026-08-04). ⚠️ **Le principe 2 ne l'interdit PAS** —
  le partage `.nutri-recipe` fait déjà sortir des données à l'initiative de l'utilisateur ; la ligne
  est « pas de serveur, pas de collecte, rien sans geste explicite », pas « aucune donnée ne sort ».
  C'est le coût qui tranche : plugin Bluetooth natif, permissions à l'exécution, état distribué. Un
  téléphone posé au milieu absorbe l'essentiel du besoin (§8 E de `CONCEPTION_MODE_CUISINE.md`).
- **Signal d'alarme : l'INVERSION de l'écran** (2026-08-05, **essayé sur appareil**) — retenue
  contre quatre autres (cadre, bandes latérales, plein écran, balayage) au seul critère qui compte :
  être vue **du coin de l'œil**, téléphone posé de côté. Elle donne l'écart de luminance maximal
  **sans masquer le contenu**. **L'alarme sonne jusqu'à l'arrêt** — appui n'importe où sur l'écran,
  garde-fou automatique à 5 min. ⚠️ **La vibration n'est PAS acquise** : `navigator.vibrate` n'a rien
  produit à l'essai ; l'alarme ne doit pas en dépendre. ⚠️ **Le pari `rem` à 150 % reste NON
  MESURÉ** — le premier essai visait le mauvais réglage (Android au lieu de Chrome). Compte rendu
  complet : `CONCEPTION_MODE_CUISINE.md` §7.

> ✅ **LES LIGNES QUI SUIVENT SONT DES DÉCISIONS, ET DEPUIS LE 2026-08-09 AU SOIR ELLES SONT AUSSI
> L'ÉTAT.** Le présent qu'elles emploient (« `pourSauces` est disjoint », « v14 ») décrivait ce qui
> **devait** être ; ①②③④ sont livrés et vérifiés commit par commit, voir §8. ⚠️ **Ne pas relire cet
> avertissement comme une garantie permanente** : ce qui est réellement livré se lit en §8, jamais
> ici. Confondre les deux est exactement ce qui a fait déclarer ce lot fermé pendant deux jours
> alors que son code n'existait dans aucun commit.
>
> ⚠️ **DEUX DÉCISIONS PORTENT LE NUMÉRO 62, et il faut le savoir avant de suivre une référence.**
> La 62 du tableau §4 (barrée, fermée le 2026-08-07) est « 23 recettes n'ont aucune facette
> `cuisine` » ; celle citée ici et en §8 est l'axe séparé des sauces, du 2026-08-08, **qui n'a jamais
> eu de rangée dans le tableau**. Le renvoi de §8 sur la similarité (« troisième point de mesure
> après la décision 62 ») désigne la PREMIÈRE. Non renuméroté : les deux numéros sont cités dans des
> commits déjà écrits, et renuméroter casserait ces renvois-là au lieu de les réparer.

- **Les sauces sont des recettes sur un AXE SÉPARÉ, pas une sixième valeur de `CourseKind`**
  (décision 62, 2026-08-08). Une sauce porte `est_sauce: true`, `types_repas: []` et **aucun
  `service`** — le build refuse les trois combinaisons contraires. ⚠️ **`CourseKind` a été écarté
  parce qu'une sauce n'a pas de rang dans l'ordre du service français** : la mettre dans
  `COURSE_ORDER` la placerait quelque part entre l'entrée et le dessert, l'en omettre la ferait
  disparaître en silence des écrans qui parcourent cet ordre. ⚠️ **`types_repas: []` est la garantie
  structurelle** (même esprit que `requiredFoodIds` dans `MealContext`) : sans créneau, une sauce
  n'entre jamais dans `recipesBySlot`, donc `suggestMeals` ne peut pas la proposer comme repas.
  **Elle ne suffisait pas** : `browseRecipes` et `searchByPantry` ne partent PAS d'un créneau mais de
  `catalog.recipes.keys()`, si bien qu'une vinaigrette était posable comme dîner depuis
  `ui/choisir-plat.tsx`. D'où `recettesHorsSauces` dans `engine/api/index.ts`, et le même retrait
  dans les trois fonctions de comptage de `engine/search/index.ts` — sinon la pastille de filtre
  annonce 236 pour 233 résultats. **Ce n'est pas de l'affichage, c'est le contrat.**
- **Une sauce se propose à TOUS les services SAUF le dessert** (2026-08-08, décision utilisateur).
  ⚠️ **Les entrées sont éligibles** — une première lecture les écartait avec les desserts, l'issue
  a été corrigée explicitement. Un plat qui vient déjà avec sa sauce n'en reçoit pas de seconde :
  `Recipe.porteDejaUneSauce` est un **tri-état** (`null` = personne n'a tranché → on dérive depuis
  les ingrédients marqués `sous_groupe: sauce`), même motif que `food_ids` sur une étape. ⚠️ **La
  dérivation seule ne suffirait pas** : elle voit le ketchup versé dans la recette, pas la sauce
  cuisinée au fil du plat — une blanquette nage dans la sienne sans qu'aucun ingrédient n'en soit
  une. Ne pas retirer le tri-état au motif que « la dérivation suffit ».
- **Les calories d'une sauce se comptent et s'affichent, sur leur PROPRE ligne** (2026-08-08).
  L'issue demandée était « ne pas prendre en compte les calories des sauces » ; retenue sous cette
  forme parce que **cacher le chiffre** contredirait le principe 3 et rouvrirait le précédent que la
  décision 3 de `CONCEPTION_B_VIN_REPAS.md` a fermé (« certains ingrédients ne comptent pas »).
  ⛔ **Rien n'en descend dans `engine/planning` ni dans `checkCalorieFloor`** : le plancher
  calorique continue de ne compter que les plats.
- **Le choix d'une sauce s'attache au PLAT, pas au créneau du plan** (2026-08-09, décision
  utilisateur, option B contre option A). `user_recipe_sauce (recipe_id, sauce_recipe_id)`, v14 :
  « je prends toujours cette sauce avec ce plat » est une **préférence durable**, elle vaut pour
  toutes les fois où le plat revient et **survit à la régénération du plan**. ⛔ **L'option A —
  `meal_plan_sauce` clé sur (plan, date, créneau, service) — a été explicitement écartée** : elle
  aurait fait redemander le même choix chaque semaine, et un replan aurait effacé le geste. Ne pas
  la rouvrir sans un besoin qui exige de saucer LE MÊME plat différemment selon le jour. ⚠️ **Ne
  jamais confondre `Recipe.sauceIds` et `user_recipe_sauce`** : le catalogue **propose**,
  l'utilisateur **choisit**. Acheter sur la proposition mettrait au panier les ingrédients de toutes
  les sauces suggérées de la semaine.
- **Les sauces ont une catégorie propre dans les rangements « Repas » ET « Jour » des courses, pas
  en « Rayon »** (2026-08-09, décision utilisateur : « ajouter sauces dans courses dans la catégorie
  repas, sinon traité comme les autres » — **étendue à « Jour » le 2026-08-09 au soir, décision
  utilisateur, sur mesure**). En « Rayon », un ingrédient de sauce est un article comme un autre :
  un yaourt de sauce se prend à la crèmerie avec les autres yaourts. **Motif du rayon** : les six
  rayons comptent le nombre de fois qu'on traverse un magasin, pas des familles d'aliments ; en
  sortir les sauces ferait revenir sur ses pas. En « Repas » la question n'est plus « où est-ce dans
  le magasin » mais « à quoi ça sert », et là la sauce est bien une catégorie.
  ⚠️ **« TRAITÉ COMME LES AUTRES » N'EST PAS ATTEIGNABLE EN « JOUR », ET C'EST CE QUI A ÉTENDU LA
  DÉCISION.** Mesuré, pas supposé : `grouper()` (`courses.tsx`) itère `pourSlots`, et un article de
  sauce porte `pourSlots: []` — une sauce n'est pas planifiée, elle suit son plat. Sans section, ces
  articles sont **achetés, comptés dans le total, et affichés dans AUCUNE section** : ils
  disparaissent en silence. Il n'existe pas de bucket « les autres » où les faire retomber en
  « Jour ». Le rayon, lui, range par `aisle` et n'a pas ce trou.
  ⚠️ **`pourSlots` et `pourSauces` sont DISJOINTS sur `ShoppingListItem`** : un citron réclamé par le
  plat ET par sa sauce est rangé une fois sous chacun, jamais deux fois sous le même titre.
  ⚠️ **La boucle des sauces est SOUS le garde `isLeftover`** — un reste ne se rachète pas (§7.3), sa
  sauce non plus. ⚠️ **Elle passe en SECONDE PASSE**, après celle des repas : `Map` conserve l'ordre
  d'insertion, donc les sections de sauce se rangent en pied de liste, là où l'on va chercher ce qui
  n'appartient à aucun repas (même parti que `ArticlesAjoutes` — « les ranger sous un repas
  inventerait une provenance »).

### Média, stockage & modèle
- **Gestes de cuisine** : boucle WebP 3 s pour les gestes simples ; **3 clips MP4 de 3 s**
  (avant/pendant/après) + clip « quand ça rate » pour les gestes à risque ; galeries d'états
  (cuisson, caramel) en photos.
  ✅ **AMENDÉ LE 2026-08-10, DÉCISION UTILISATEUR — UNE PHOTO FIXE *ET* UN CLIP, PAS L'UN OU
  L'AUTRE.** La photo retenue devient l'**image d'appel** (poster affiché avant lecture, et seule
  image si le clip n'est pas chargé) ; le clip se déclenche au clic. La ligne ci-dessus ne parlait
  que de clips, et une passe de tri avait entre-temps produit 62 photos fixes : le désaccord est
  tranché en gardant les deux, chacun dans son rôle. ⚠️ **CE QUI MOTIVE LE COUPLAGE N'EST PAS
  L'ESTHÉTIQUE, C'EST LE BUDGET** : le poster est léger et pré-caché, le clip est un média lourd à
  la demande au sens du « cache à deux étages » ci-dessous. Un geste sans clip chargé reste donc
  illustré, hors ligne, sans requête.
  ⚠️ **CE QU'UNE IMAGE FIXE NE PEUT PAS DIRE, ET C'EST MESURÉ, PAS SUPPOSÉ.** Plusieurs gestes du
  lexique se définissent l'un CONTRE l'autre par une évolution dans le temps — `suer` est
  « rendre son eau **sans colorer** », c'est-à-dire `revenir` moins la coloration. Sur les
  24 candidates photo de `suer`, **aucune** n'était utilisable ; sur 4 clips regardés en quatre
  images étalées sur leur durée, la coloration se lit d'un coup d'œil et deux candidats se
  départagent. Même famille de couples : `revenir`/`sauter`/`poeler`, `mijoter`/`braiser`.
  ⚠️ **RIEN N'EST ENCORE PESÉ CÔTÉ CLIP.** Récolté le 2026-08-10 : **496 candidats sur 62/62 gestes,
  29 Mo de vignettes d'aperçu, ZÉRO vidéo téléchargée** (`atelier/gestes/moissonner-video.mjs`, qui
  ne tire que les images `video_pictures` publiées par l'API).
  ✅ **L'ESTIMATION DE POIDS EST REMPLACÉE PAR UNE MESURE (2026-08-10).** `ffmpeg` 9.0 est installé
  (winget `Gyan.FFmpeg`, sur ordre explicite de l'utilisateur ; libsvtav1 / libvpx-vp9 / libx264 /
  libwebp\_anim présents). Deux clips Pexels réellement encodés, 3 s, 480 px de large, 24 i/s, muets :
  | clip | AV1 (svt, crf 40) | H.264 (crf 28) | VP9 (crf 40) | WebP animé 12 i/s |
  |---|---|---|---|---|
  | `monter_blancs` pexels\_01 — **peu de mouvement** | **44,5 Ko** | 48,0 Ko | 45,3 Ko | 275,5 Ko |
  | `sauter` pexels\_05 — **fort mouvement** (riz projeté) | **100,2 Ko** | 119,0 Ko | — | — |
  Poster JPEG 720 px extrait du clip : **32–33 Ko** dans les deux cas. **L'estimation « ~400 Ko en
  H.264 » était fausse d'un facteur 4 à 8** — un clip court, muet et en 480 p pèse beaucoup moins
  que ce qui avait été avancé en discussion.
  ⛔ **LA PROJECTION QUI TENAIT ICI — « 62 gestes = 2,8 à 6,2 Mo d'AV1 + 2,0 Mo de posters » — EST
  REMPLACÉE PAR LE LOT RÉEL, ENCODÉ LE 2026-08-11. Elle était basse d'un facteur 3 à 4.**
  `atelier/gestes/encoder-clips.mjs`, 98 segments sur 51 gestes, sortie vérifiée à la sonde
  (480×480, 24 i/s, 72 images = 3,000 s, un seul flux, aucun son) :
  | | poids | l'unité |
  |---|---|---|
  | AV1 (svt, crf 40) | **8,17 Mo** | 85,4 Ko |
  | H.264 (x264, crf 28) | **10,81 Mo** | 113,0 Ko |
  | posters JPEG 720² | **3,45 Mo** | 36,0 Ko |
  | **AV1 + posters** | **11,62 Mo** | |
  | **les deux formats + posters** | **22,43 Mo** | |
  ⚠️ **TROIS FACTEURS SE MULTIPLIENT, ET AUCUN N'EST UNE DÉRIVE DE RÉGLAGE** — le CRF n'a pas bougé.
  (a) la vignette est **carrée**, décidée après le relevé de 2026-08-10 : ×2,0 sur le clip calme,
  ×1,5 à 1,7 sur le clip agité ; (b) **98 segments, pas 62 clips** — la découpe début/milieu/fin
  multiplie, 21 gestes seulement ont pris `unique` ; (c) **deux formats**, et ce choix-là n'est
  toujours pas tranché : le repli H.264 coûte **+32 %** par rapport à l'AV1 et livrer les deux
  **double** la facture.
  ⚠️ **Le mouvement fixe toujours le poids, mais l'écart s'est resserré de 2,3× à 1,7×** en carré
  (`monter_blancs` 88,9 Ko contre `sauter` 153,0 en AV1). Le rapport ne se recopie pas d'un format
  de cadre à l'autre.
  ▶ **Levier non tiré, chiffré** : un poster par GESTE au lieu d'un par segment ramène 3,45 Mo à
  ~1,8 Mo. Il n'est pas appliqué — 51 posters pour 98 segments suppose que la première image des
  trois segments d'un même geste soit interchangeable, ce qui n'a pas été vérifié.
  ⛔ **CE LOT REND L'ARBITRAGE DE LA DÉCISION 68 NON REPORTABLE.** À couverture photo complète
  `dist/` est projeté à ~16 Mo pour un critère P6 de 15 Mo ; l'option la plus légère ici (AV1 seul
  + posters, 11,62 Mo) porte le total à ~27,6 Mo. **Aucun réglage de CRF ne referme cet écart** —
  il se joue sur le format livré, sur le nombre de segments, ou sur le critère P6 lui-même.
  ⚠️ **AV1 ne peut pas être le seul format livré** : Safari ne le décode que sur matériel récent.
  Le format de repli est H.264, soit +20 % environ. Le choix « un seul format universel » contre
  « deux sources dans la balise `<video>` » n'est pas tranché.
  ⚠️ **WebP animé est écarté par la mesure** : 275 Ko pour le clip le PLUS LÉGER, soit 6× l'AV1,
  pour 12 i/s au lieu de 24. Il n'a d'intérêt que là où une balise vidéo est impossible.
  ⚠️ Vérifié à l'œil sur une image extraite de l'encodage AV1 du clip à fort mouvement : le geste
  reste lisible à ce réglage. **Un CRF ne se choisit pas sur un tableau de poids seul.**
  ⚠️ **Le lexique n'a toujours AUCUN champ pour porter un média** — ni dans le YAML source, ni dans
  `catalog/build.mjs`, ni dans `LexiconEntry`, ni à l'écran. Photo et clip sont tous deux sans point
  d'accroche : c'est un lot de code à part entière, pas la fin du tri.
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
  ✅ **L'ESTIMATION DE 36 Mo EST CADUQUE — REMPLACÉE PAR UNE MESURE le 2026-08-09.** Une hero AVIF
  pèse **33 Ko de médiane**, pas 120. Il n'y a **pas de vignette** — la même image sert partout,
  redimensionnée par le navigateur.
  ⛔ **RE-MESURÉ SUR `dist/` LE 2026-08-10, À 116 PHOTOS, ET LE BUDGET NE TIENT PLUS À TERME.**
  Décomposition en octets réels : `dist/` = **8,07 Mo**, dont **4,32 Mo de photos** et **3,75 Mo de
  reste**. À 37,2 Ko la photo, couvrir les **330 recettes** donne **12,3 Mo de photos ⇒ ~16,0 Mo de
  bundle** — **au-dessus des 15 Mo du critère P6**, et non 0,6 Mo en dessous comme l'annonçait la
  ligne précédente. ⚠️ **Ce n'est pas une dérive du lot, c'est l'ancienne extrapolation qui était
  fausse** : elle additionnait un `dist/` de 6,61 Mo qui contenait déjà ses 88 photos avec une
  projection de photos, donc les comptait deux fois — et retombait sous le seuil par compensation
  d'erreurs. ⚠️ **L'écart se creusera avec la couverture, pas avec les décisions d'à-côté** : à
  129/330 il reste 201 photos à produire, soit **~7,5 Mo de plus**. Une deuxième police ou un clip de
  geste ne sont plus la variable qui décide. **Le budget devient une décision à trancher — parquée
  en §4** ; d'ici là, la mesure se reprend à chaque lot de photos et **elle se prend sur `dist/`,
  jamais sur le bac.**
  ⚠️ **AU 2026-08-13, `dist/` N'A PAS ÉTÉ REMESURÉ APRÈS LE PASSAGE À 129 PHOTOS.** Le seul chiffre
  relevé ce jour-là est le dossier source `app/public/catalog/images/` : **4,12 → 4,9 Mo**. Ce n'est
  PAS `dist/` et ça ne s'y substitue pas — **la règle « la mesure se prend sur `dist/` » vaut aussi
  pour ce lot-ci.** Le prochain qui touche aux photos remesure `dist/` avant de citer 8,07 Mo.
- ✅ **ENCODEUR : `sharp` (devDependency), AVIF 1024 px, `quality: 45`, `effort: 6`** — décidé avec
  l'utilisateur le 2026-08-09, **sur mesure et non au jugé**. Les sources brutes font 25,9 Mo pour
  116 photos (médiane 185 Ko, max 1 713 Ko, **2 seulement sous 40 Ko**) : le ré-encodage n'est pas une
  optimisation, c'est ce qui rend le lot expédiable. ⚠️ **LE CHOIX AVIF/WebP NE SE COMPARE PAS À
  `quality` ÉGALE** — les échelles nominales des deux formats ne veulent pas dire la même chose. La
  comparaison a été refaite **à PSNR égal** contre la source redimensionnée, sur 22 photos : AVIF y
  rend **25 à 33 % de moins** que WebP. C'est ce qui a tranché, pas le nombre écrit dans l'appel.
  ⚠️ **CETTE DÉCISION VA CONTRE L'EN-TÊTE DE `catalog/build-icons.mjs`**, qui interdit `sharp` pour
  ne pas faire entrer de chaîne de compilation native. Tenue quand même : l'objection visait un
  script qui dessine deux cercles, `sharp` 0.35.3 livre des **binaires précompilés win32-x64**, et
  **la garantie de fond reste intacte — les artefacts sont commités, `npm run build` et `vite build`
  n'appellent JAMAIS `sharp`.** C'est un outil d'atelier à un coup, pas une dépendance de build ;
  `npm audit --omit=dev` rend 0 vulnérabilité. **Si un jour un build appelle `sharp`, cette phrase
  est le signal que quelque chose a dérivé.**
- ⛔ **98 DES 129 PHOTOS SONT SOUS CC BY OU CC BY-SA : L'ATTRIBUTION EST UNE OBLIGATION LÉGALE, PAS
  UNE POLITESSE.** Le bloc généré de `catalog/CREDITS.md` (entre les marqueurs `DÉBUT PHOTOS` /
  `FIN PHOTOS`, réécrit par `catalog/import-photos.mjs`) est le seul endroit où elle vit aujourd'hui.
  ⚠️ **Elle doit suivre l'image PARTOUT où l'image est rediffusée** — donc si le `.nutri-recipe` de
  §3 « Communauté » se met à embarquer la photo, il doit embarquer l'attribution avec, et la
  carte-image Canvas pour les réseaux aussi. **Non fait, parce que rien n'embarque encore de photo.**
  **Décompte relevé sur `CREDITS.md` le 2026-08-13, aux 129** : 67 CC BY · 31 CC BY-SA · 5 CC0 ·
  **16 Pexels** · **10 Pixabay Content License**. ⚠️ **Ces 26 dernières tombent sous la clause
  « Standalone use » — la MÊME ambiguïté que la décision 69**, qui n'avait été posée que pour les
  clips de gestes. **Elle concerne donc aussi des photos déjà embarquées.**
- ✅ **LE RECADRAGE CARRÉ EST HONORÉ QUAND IL EST POSÉ, ET JAMAIS APPLIQUÉ D'OFFICE** — tranché avec
  l'utilisateur le 2026-08-13, livré en `f3d4fa1`. Un recadrage centré automatique sur les 128 photos
  sans cadre couperait l'assiette **sans qu'un œil l'ait vu**, et le passage au carré s'est mesuré à
  **×1,5 à ×2,0** sur les clips de gestes — donc il pousserait aussi le poids contre un critère P6
  déjà dépassé (décision 68). **Une photo sans cadre garde le ratio de sa source.** ⚠️ **Conséquence
  assumée : l'application affiche des photos de formes différentes** ; c'est `object-cover` qui
  ajuste au cadre de l'écran, pas le fichier.
- ✅ **UNE RECETTE SANS PHOTO N'EST PAS UN TROU : c'est un aplat de couleur + son initiale**
  (`ui/vignette.ts`), tranché en même temps. Le repli couvre les **201** recettes sans photo et ne
  disparaîtra pas avec la couverture — il cesse seulement d'être le cas unique. ⚠️ **Jugé sur une
  carte, PAS en pleine page** : la fiche détail n'a pas encore été essayée avec.
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

> **Convention de cette table — `~~n~~` = FERMÉE.** Le numéro est barré dès qu'un arbitrage est
> rendu ; la ligne reste, avec son raisonnement, parce que savoir *pourquoi* une question ne se
> repose pas vaut autant que la réponse. Un numéro NON barré est une question à trancher, et
> seulement cela.
>
> ⚠️ **L'index avait dérivé — corrigé le 2026-08-04.** Quinze lignes annonçaient « Tranché » dans
> leur texte sans que le numéro le dise (1, 7, 14, 15, 17→24, 27, 36, 38). La table se lit d'abord
> à la colonne de gauche : tant qu'elle mentait, §4 paraissait porter trois fois plus d'arbitrages
> en attente qu'il n'y en a. **Barrer est un geste d'index, pas de contenu** — aucune décision n'a
> été rouverte ni refermée à cette occasion.
>
> ⚠️ **La 63 est ENTRÉE dans cette liste le 2026-08-09** : elle ne bloque aucun code — les deux
> issues tournent déjà — c'est un choix d'écriture du catalogue, et il appartient à l'utilisateur.
>
> **Réellement ouvertes au 2026-08-11 : 2, 5, 6, 11, 52, 58, 65, 66, 68, 69 — DIX.** Compté sur les
> numéros non barrés de cette table, pas de mémoire.
>
> ⚠️ **AU 2026-08-13, LA 65 EST TOUJOURS DANS CETTE LISTE — mais elle ne bloque plus le code.** Sa
> partie codable (65a) est livrée ; ce qui reste ouvert est la seule question de la quantité
> possédée. **Le compte de DIX ne bouge pas**, une décision réduite n'est pas une décision fermée.
>
> ⚠️ **LA 67 EST SORTIE DE CETTE LISTE le 2026-08-11** : le chantier régime personnalisable est livré
> de A à D4 (`98b452c`). Sa ligne est barrée ; ce préambule est repris DANS LE MÊME LOT, ce qui est
> précisément ce qui avait manqué les fois d'avant.
>
> ⛔ **CE QUI ÉTAIT ÉCRIT ICI ÉTAIT PÉRIMÉ DE DEUX JOURS, ET LA CONCLUSION ÉTAIT FAUSSE, PAS SEULEMENT
> LE COMPTE.** La ligne annonçait « 2, 5, 6, 11, 52 — CINQ » puis « ⇒ Plus AUCUNE décision ouverte ne
> bloque le code ». **La 65 bloquait le code** (levé le 2026-08-13, voir §3 entrée 65a) : la
> réservation de matériel du mode cuisine attendait deux
> colonnes dans `catalog/`, pas du code. La phrase
> était vraie le 2026-08-08 ; cinq décisions se sont ouvertes depuis, et une (la 67) s'est refermée.
>
> ⚠️ **LE DÉCOUPAGE « attend un élément extérieur / demande un arbitrage » RESTE À REFAIRE SUR LES
> NEUF** — il n'est ci-dessous conservé que pour les cinq d'origine (2 et 5 attendent une maquette,
> 6 un hébergeur, 11 un jeton, 52 un arbitrage lui-même bloqué par la maquette). **Ne pas le
> recopier tel quel sur les nouvelles** : c'est la méthode qui vaut, pas le nombre, et une ligne de
> synthèse non reprise en même temps que la table qu'elle résume redevient fausse au lot suivant.
> C'est exactement ce qui s'est produit ici. La **61 est sortie de cette liste**
> le 2026-08-08 : mesurée sur appareil, fermée par la table de seuil écrite avant la mesure. La **3 est sortie de cette liste** le 2026-08-07 : l'utilisateur a confirmé « Savoir »,
> le libellé n'a jamais eu besoin d'autre chose que d'être confirmé. La **35 est sortie de cette liste** le 2026-08-07 : tranchée, codée, mesurée. La **62 y
> est entrée ET ressortie le même jour** — ouverte le matin, fermée le soir par l'issue (a).
>
> ⚠️ **LA 60 EST SORTIE le 2026-08-07 EN FIN DE JOURNÉE, et cette ligne l'a annoncée ouverte alors
> que sa propre rangée était déjà barrée.** Troisième dérive d'index de cette table en quatre jours,
> et cette fois dans le sens qui coûte le plus cher : **elle réclamait un arbitrage sur un chantier
> livré.** ⛔ **Ce préambule se relit contre la colonne de gauche, jamais l'inverse.**
>
> ⚠️ **16 ET 33 SONT SORTIES DE CETTE LISTE le 2026-08-07, et pour deux raisons opposées.** La 33 a
> été FAITE ce jour-là (l'affichage manquant, issue (ii) de la dette §8). La **16 était déjà faite
> depuis le 2026-07-28 et personne ne l'avait écrit ici** : sa ligne annonçait un chantier ouvert
> au-dessus d'un `courses.tsx` qui rendait déjà la fonctionnalité. Une ligne d'index peut
> sur-déclarer du travail restant autant qu'elle peut en cacher — **compter les décisions ouvertes
> dans cette table sans confronter le code donne un chiffre faux dans les deux sens.**
>
> ⚠️ **58 EST SORTIE DE CETTE LISTE le 2026-08-05, en fin de journée.** Ses quatre causes sont
> closes : (1) et (2) corrigées, (4) neutralisée par le parcours, (3) fermée en « non corrigée,
> ASSUMÉE, documentée » après arbitrage de l'utilisateur. **Lire sa ligne avant de la rouvrir** —
> elle porte quatre ⛔, dont « pourquoi ne pas importer tout le Ciqual » (mesuré et tranché) et
> « la piste (c) était déjà livrée ».

| # | Question | Reco |
|---|---|---|
| ~~1~~ | Restes en v1 ou v2 ? | **Tranché — v1**, structurant et coûteux à greffer après. **CODÉ** : `planLeftovers` (§7.3 ENGINE) ; l'affichage côté Courses est la décision 50 |
| 2 | Choix final du badge de preuve | Variantes maquettées, à trancher à l'intégration |
| ~~3~~ | Libellé onglet « Savoir » | ✅ **FERMÉE le 2026-08-07 — c'est « Savoir », et ça le reste.** Le libellé n'était provisoire que parce que personne ne l'avait confirmé ; « Apprendre » et « Comprendre » sont écartés. ⚠️ **Rien à coder : le code dit déjà « Savoir » partout** — cette ligne ne demandait qu'un arbitrage, pas un chantier |
| ~~4~~ | Nb de recettes et d'aliments v1 | **Revu à la hausse (2026-07-27)** — **200-300 recettes** (au lieu de 150-200) et **~200 aliments**. **Les deux cibles sont DÉPASSÉES** : 199 aliments, 241 recettes (2026-07-29). Conséquence à surveiller : le poids du `.db` et le critère de sortie P6 « bundle < 15 Mo » — 300 recettes sans média restent légères, ce sont les photos qui pèseront |
| 5 | Écran d'humeur → envie | Principe validé, pas maquetté |
| 6 | Hébergement PWA | Cloudflare / Netlify / GitHub Pages (statique, indifférent) |
| ~~7~~ | Chiffrement | **Sans objet** — aucune donnée de santé collectée. La question ne se rouvre que si le produit se met à en collecter, ce que le principe n°2 interdit |
| ~~8~~ | **Mode cuisine** (multi-recettes, timers par étape) en v1 ou v1.5 ? | **Fermée le 2026-08-04 — la question était mal posée** : elle agrégeait deux features de coûts sans rapport. **Découpée**, pas arbitrée en bloc — mono-recette en **v1**, synchronisation multi-recettes en **v1.5**. Spec complète : `ARCHITECTURE.md` §5bis — §3 |
| ~~9~~ | Cible iOS : PWA seule ou Capacitor + App Store ? | **FERMÉE le 2026-08-01 (décision utilisateur) — Capacitor** remplace TWA/Bubblewrap pour le produit final. Installé (`capacitor.config.ts`, `@capacitor/{core,cli,android,local-notifications}`) ; `npx cap add android` jamais lancé. **Gain réel** : le risque « éviction Safari à 7 jours », classé CRITIQUE en §7 ARCHITECTURE, tombe largement — le stockage d'une WebView applicative vit tant que l'appli est installée. ⚠️ **Capacitor ne lève PAS la contrainte « pas de Mac »** : signer un IPA exige macOS + Xcode + 99 €/an. Sans Mac, cette décision apporte un conteneur **Android**, pas l'iOS — **ne pas retirer la version web du plan**. ⚠️ **Risque n°1 introduit, NON VÉRIFIÉ** : tout le projet parie sur `rem` → l'interface suit la police système à 150 %. Chrome le fait ; **une WebView applicative, ce n'est pas garanti**, et l'échec serait SILENCIEUX. À tester sur appareil avant tout le reste. Conséquences complètes et régressions WebView connues : `archive/RECAP_SESSION_8.md` §3 |
| ~~10~~ | Noms définitifs des **archétypes** (§ENGINE 6.3 bis) | **Fermé, tranché et CODÉ** (session du 2026-07-25) — `equilibre` (défaut) · `envie` · `decouverte` · `de_saison` · `mes_gouts` · `rapide` (`ArchetypeId`, `domain/archetype-ids.ts`) ; table des surcharges dans `selection/archetypes.ts` — §3 |
| 11 | Token de push GitHub (pour que l'utilisateur pousse les commits Claude) | À fournir par l'utilisateur — voir `docs/archive/RECAP_SESSION.md` § Reprendre ici |
| ~~12~~ | Rattachement de `speed` au pipeline | **Fermé, tranché et CODÉ** — `speed` EST une couche du registre à part entière (11ᵉ couche de score, poids nul par défaut, relevée par l'archétype « Rapide ») ; le registre est désormais à 17 (6 exclusion + 11 score) — §3 |
| ~~13~~ | `requiredFoodIds` (miroir du rejet) : filtre dur ou gros bonus ? | **Fermé, tranché et CODÉ** — dur en contexte « Aujourd'hui » seulement, couche `requis` (`MealContext.requiredFoodIds`, hors de `HardConstraints`) — §3 |
| ~~14~~ | Alcool : ingrédient de cuisine vs boisson | **Tranché — ingrédient en v1** ; une boisson alcoolisée n'est jamais un aliment du repas, mais un alcool employé **comme ingrédient** est agrégé dans le calcul nutritionnel comme les autres (option A, `docs/CONCEPTION_B_VIN_REPAS.md` §1.7) ; boisson servie = article de courses |
| ~~15~~ | Roue des goûts : rayons cuisine/saveur | **Tranché — reporté en v2** ; la v1 s'en tient aux 6 pôles sensoriels, gratuits |
| ~~16~~ | Table courses non alimentaire (10 rayons) | **CODÉE — et cette ligne annonçait un chantier ouvert alors que le travail était fait.** Corrigé le 2026-08-07 en lisant le code, pas la table : `shopping_extra_item` existe en base, `addExtraItem` l'écrit, et `ui/screens/courses.tsx` en rend le formulaire — avec complétion sur le catalogue, déduction du rayon par `rayonDe()` (modifiable) et champ quantité. La livraison est décrite dans `RETOUR_ESSAI_TELEPHONE.md` §6, qui n'a jamais reflué jusqu'ici. ⚠️ **Ne pas rouvrir ce chantier : il n'en reste rien.** La leçon est celle de §0 — *le code fait foi* — et elle vaut dans ce sens-là aussi : une ligne d'index peut sur-déclarer du travail restant autant qu'elle peut en cacher |
| ~~17~~ | Accords vin masqués par défaut ou visibles et masquables ? | **Tranché** — masqués par défaut, `user_display.afficher_accords = false` (`docs/CONCEPTION_B_VIN_REPAS.md` §1.2, §4) |
| ~~18~~ | Miroir sans alcool obligatoire au build (`recipe_pairing`) ? | **Tranché** — oui, contrainte structurelle miroir de `evidence_sheet_id NOT NULL` (`docs/CONCEPTION_B_VIN_REPAS.md` §1.3, §4) |
| ~~19~~ | Facette `service` : facette ouverte ou colonne dédiée ? | **Tranché** — facette `recipe_facet` (`docs/CONCEPTION_B_VIN_REPAS.md` §2.3, §4) |
| ~~20~~ | Mode repas (entrée+plat+dessert) en v1 ou v1.5 ? | **Tranché** — v1.5, le quotidien reste le mode recette (`docs/CONCEPTION_B_VIN_REPAS.md` §4). ⚠️ **PARTIELLEMENT DÉPASSÉ PAR LA DÉCISION 54 (2026-08-04), et il faut que ce soit écrit ici** : le planificateur pose désormais **deux entrées par créneau — plat + accompagnement** — en v1, parce que c'était le seul correctif homogène au plancher calorique de §6.5. **Ce qui reste en v1.5, c'est l'entrée et le dessert**, et le mode repas *choisi par l'utilisateur*. Ce qui est arrivé en v1 est un mode repas **subi**, décidé par le moteur pour tenir un garde-fou, pas une fonctionnalité offerte |
| ~~21~~ | Accord vin porté par service ou par le repas entier ? | **Tranché** — porté par le plat seul, un conseil par repas (`docs/CONCEPTION_B_VIN_REPAS.md` §4) |
| ~~22~~ | Sens de l'écart nutritionnel (`nutrient.sens`) | **Tranché et CODÉ** (P1b-2) — union fermée `cible`/`plancher`/`plafond` (§4.2 ARCHITECTURE, §6.5 ENGINE précision 1) ; corrige l'écart symétrique de `scoreNutri` qui pénalisait un dépassement (fer, fibres) comme un manque |
| ~~23~~ | Vocabulaire de `trancheAge`/`niveauActivite` (`UserProfile`) | **Tranché et CODÉ** (P1b-2) — unions fermées `AgeBracket` (`18_29`·`30_49`·`50_64`·`65_plus`, âges représentatifs 24/40/57/72) et `ActivityLevel` (`sedentaire` 1,2 · `peu_actif` 1,375 · `actif` 1,55 · `tres_actif` 1,725) ; pas de palier athlète, aucune tranche mineure — la VNR du catalogue est ADULTE |
| ~~24~~ | Part du créneau dans la référence journalière (couche `nutri`) | **Tranché et CODÉ** (P1b-2) — table fixe `MEAL_SLOT_SHARE` : `petit_dejeuner` 0,25 · `dejeuner` 0,35 · `diner` 0,30 · `gouter` 0,10 (Σ=1) ; décision nouvelle, absente de la conception initiale (`docs/ENGINE.md` §6.5 précision 1) |
| ~~25~~ | Granularité nutritionnelle de l'import CIQUAL : 9 nutriments ou ~40 ? | **Tranché et FAIT (2026-07-26) — ~9**, et ce sont ceux que `build.mjs` portait déjà : énergie · protéines · lipides · glucides · fibres · **fer · calcium · vitamine C** · sodium. ⚠️ Ce n'est PAS la liste d'étiquetage (ni sucres ni acides gras saturés) : `fer` est porteur, c'est l'exemple de `sens: plancher` en §6.5 ENGINE et dans les fixtures de test. Aucun changement de schéma n'a été nécessaire. `food_nutrient` étant une table à lignes, passer à ~40 plus tard ne demandera pas de migration douloureuse |
| ~~26~~ | `suggestAlternatives` : l'ingrédient principal peut-il changer ? | **Tranché (2026-07-26)** — DEUX notions distinctes que §8 confondait. **Variante** = ingrédient principal INVARIANT (retrait d'un `optionnel`, substitution d'un ingrédient **secondaire**). **Alternative** = autre recette, ingrédient principal PEUT changer dans le même `Food.groupe` (autre poisson, autre viande, autre légume), **toujours dans les filtres de l'utilisateur**. Deux conséquences non triviales : (a) le mécanisme « plat frère » ne peut PAS être `argmax(similarity)`, qui pondère l'ingrédient principal à 0,5 et favorise donc de le GARDER — il faut « même groupe, ingrédient différent », puis classer sur les axes restants ; (b) la signature `(recipeId, dislikedFoodId)` de §8 est **insuffisante**, respecter les filtres impose de passer un `SuggestionRequest`. **CODÉ le 2026-07-28** (§8.4 ENGINE) — `engine/selection/alternatives.ts`. A exigé une TROISIÈME notion d'ingrédient, mesurée séparément des deux autres : l'ingrédient CARACTÉRISTIQUE = le plus lourd d'un groupe DÉFINISSANT (viandes, poissons, fruits de mer, légumineuses), repli sur le plus lourd sinon. Sur 29 recettes il diverge du plus lourd, et les 29 fois il a raison (« Hachis de bœuf aux pommes de terre » est un plat de bœuf). ⚠️ `œufs` volontairement exclu des groupes définissants — l'y mettre fait de « Clafoutis aux framboises » un plat d'œuf, MÊME piège qu'en §6.6 quinquies |
| ~~28~~ | Régimes emboîtés : étiquettes multiples sur chaque recette, ou hiérarchie dans le moteur ? | **Tranché et CODÉ (2026-07-26) — hiérarchie** (`DIET_CHAIN`, §6.3 ter ENGINE) : `vegetalien ⊂ vegetarien ⊂ pescetarien ⊂ omnivore`. L'égalité stricte de P1a rendait un utilisateur **omnivore** aveugle à 27 des 34 recettes (il ne voyait que les 7 plats étiquetés `omnivore`), et un pescétarien à 16. Les étiquettes multiples ont été écartées pour leur mode de défaillance SILENCIEUX — une étiquette oubliée fait disparaître une recette sans erreur ni trace. Deux garde-fous : la chaîne n'élargit jamais vers le plus permissif, et tout régime hors chaîne (`sans_gluten`, `halal`…) retombe sur l'égalité stricte |
| ~~29~~ | **Aliments sans valeur nutritionnelle CIQUAL** | **Tranchée et CODÉE (2026-07-27)** — piste **(a)** retenue, la seule qui traite la cause. CIQUAL laisse des cases vides (non déterminé) que `aggregateRecipe` compte comme des zéros, ce qui confond « on ne sait pas » et « il n'y en a pas ». Le défaut touchait le CLASSEMENT, pas l'affichage, et dans les DEUX SENS selon le `NutrientSense` : sur un plancher le trou fait paraître la recette pauvre et la PÉNALISE (« Truite aux amandes », 76 % de la masse sans vitamine C) ; sur un plafond il la fait paraître inoffensive et la RÉCOMPENSE (« Gratin de blettes à la brousse », 64 % sans sodium). C'était donc du bruit, pas un biais. **Mécanisme** : `computeNutrientCoverage` produit la part de la masse connue par nutriment (index `recipeNutrientCoverage`), `scoreNutri` s'ABSTIENT sous `NUTRI_MIN_COVERAGE = 0,7` au lieu de noter un zéro inventé, `NutrientSummary.coverage` remonte l'info pour un futur libellé. Effet mesuré : 13 recettes sur 212 perdent un nutriment, aucune ne les perd tous. **L'import ne refuse plus** un aliment sans énergie — le garde-fou façonnait le catalogue sur ce que l'ANSES a documenté plutôt que sur la cuisine (la ricotta avait dû être remplacée). ⚠️ Le seuil de 0,7 est un JUGEMENT, pas une mesure : aucun jeu de cas jugés n'existe pour « ce nutriment est-il notable ». ⚠️ Reste INTERDIT : inventer une valeur ou la recalculer depuis les macros et l'écrire dans le même champ que les chiffres ANSES. Une seconde source (USDA, CoFID) reste possible À CONDITION d'être tracée par valeur — le vecteur de couverture est ce qui le rendra faisable ; chercher d'abord une entrée voisine DANS CIQUAL |
| ~~30~~ | Modèle de similarité : quel « ingrédient principal » ? | **Tranché PAR MESURE et CODÉ (2026-07-27)** — §6.6 bis ENGINE. Six modèles comparés à 100 puis 200 recettes sur deux jeux de paires (`compare-similarite.ts`). Retenu : **les 3 ingrédients non optionnels les plus lourds, chevauchement pondéré** (`recipeSignature`). L'ancien modèle (un seul ingrédient, le plus lourd) avait **1 point** d'écart entre plats-à-séparer et plats-proches, contre 18 pour le retenu. Deux idées ont été TESTÉES ET ÉCARTÉES : la pondération par rareté (17 pts, et rend la similarité dépendante du catalogue entier) et le seuil de masse à 5 % (aucun gain, et écarterait l'ail de « pâtes à l'ail et à l'huile »). Doubler le catalogue n'a pas déplacé les scores d'un dixième — la conclusion n'est pas un artefact d'échantillon |
| ~~31~~ | **Règle de RÉCENCE de `variety`/`habit`** | **Tranchée PAR MESURE et CODÉE (2026-07-27)** — §6.6 quater et quinquies ENGINE. Treize règles comparées sur des paires jugées pour CETTE question, distincte de la similarité (« ai-je mangé ça récemment » n'est pas « ces plats se ressemblent-ils »). **État final : 0 déclenchement à tort sur 6, 0 raté sur 7** (l'ancienne règle : 6/6 et 1/7). Trois éléments, chacun mesuré :
(a) **signature repliée par sous-famille** — `Food.sousFamille` (facultatif, 25 aliments sur 193, 12 familles) replie `poulet_blanc`/`poulet_cuisse` sur `poulet`, dans un SECOND index `recipeFamilySignature` ; la similarité garde `recipeSignature`, la diversification devant encore distinguer les morceaux. Rattrape 16 paires légitimes (lentilles vertes × corail 38 → 90 %, gigot × navarin 14 → 65 %, huit paires de poulet). (b) **second déclencheur** — une même sous-famille DÉCLARÉE pesant ≥ 40 % des deux côtés suffit. La restriction aux familles déclarées est essentielle : les clés d'une signature repliée mélangent familles et `foodId` bruts, et sans filtre partager `oeuf` rapprocherait une mousse au chocolat d'une omelette (3 faux sur 6). (c) **filtre de créneau** — une entrée d'historique dont le `creneau` n'est pas dans les `typesRepas` du candidat est ignorée POUR LE RAPPROCHEMENT PAR COMPOSITION (un clafoutis du goûter ne pénalise plus un gratin du dîner). ⚠️ Ce n'est PAS « même créneau que la demande » : poulet au déjeuner puis poulet au dîner reste répétitif, et la correspondance par `recipeId` exact n'est jamais filtrée.
**Deux pistes TESTÉES ET ÉCARTÉES** : le repli par `Food.groupe` (4/6 faux, 735 paires — « viandes » mélange bœuf, poulet, porc et agneau) et le modèle « ingrédient principal + secondaires à poids fixes » (2 à 3 ratés au lieu d'1 — les poids de rang détruisent l'écart réel entre 54 % et 43 % de protéine) |
| ~~32~~ | Pondération des trois signaux de similarité | **Tranchée PAR MESURE et CODÉE (2026-07-27)** — §6.6 ter ENGINE. **0,8 / 0,15 / 0,05** au lieu de 0,5 / 0,3 / 0,2. L'ancienne répartition, jamais vérifiée, laissait le sensoriel et la cuisine fabriquer **50 % de similarité entre deux plats sans aucun ingrédient commun** (« coq au vin » × « gigot d'agneau »). Sept jeux comparés ; les quasi-doublons ne perdent rien sur toute la plage (79 → 78 %), seuls les faux rapprochements tombent. **Pas 100/0/0** malgré son meilleur score brut : cinq salades froides sans ingrédient commun seraient alors à 0 % et la diversification n'y verrait aucune répétition |
| ~~27~~ | Table `substitution` : quand la créer ? | **FERMÉE PAR LA DÉCISION 47 le 2026-08-02** (« le contenu arrive »), puis amendée par la 48 — la suite de ce chantier se lit là-bas, pas ici. Texte d'origine : **Avec le contenu, pas avant** — quels couples ont du sens dépend des recettes qui existent. Le type `Substitution` et `Catalog.substitutions` existent déjà ; le loader retourne une Map vide (`catalog-loader.ts`, une ligne à changer) et un test verrouille ce vide. Le moteur n'aura rien à changer quand la table arrivera |
| ~~33~~ | **Codes de confiance CIQUAL — les importer ou non ?** | **FERMÉE le 2026-08-07 : importées, non pondérées, AFFICHÉES.** L'affichage manquait depuis deux jours ; c'est l'issue (ii) de la dette §8 qui a été retenue — un écran de détail par ALIMENT (`ui/screens/aliment.tsx`, route `#/aliment/<id>`, atteint depuis chaque ingrédient de la fiche recette), parce que c'est le seul niveau où la cote discrimine. Les teneurs y sont derrière `afficher_macros` (§6.5, un seul interrupteur) ; la cote s'affiche **telle que l'ANSES la publie — une lettre** —, avec sa définition citée en dessous, et rien ne la transforme en couleur, en tri ni en note. ⛔ **ET LA PRÉMISSE DE CETTE DÉCISION ÉTAIT FAUSSE, corrigée le 2026-08-07 en ouvrant la source.** Le texte ci-dessous affirme qu'« une cote C ou D ne veut PAS dire douteuse, elle veut souvent dire calculée plutôt que dosée ». **Cette phrase n'était sourcée nulle part.** La documentation de l'export réellement importé (ANSES, *Table Ciqual 2025 — Documentation*, 19/11/2025, tableau 6 — `documents Ciqual/2025_11_03`, donc la bonne version) dit mot pour mot : « code de confiance, qui indique la **fiabilité** de la teneur moyenne (de A=très fiable à D=moins fiable) ». **Le code annonce une fiabilité, pas une provenance.** Ce qui reste vrai est l'observation du 2026-08-05 — les valeurs C/D viennent surtout de l'USDA (451) et d'un calcul Ciqual (368) — mais elle décrit d'où viennent ces valeurs, pas ce que le code signifie. ⚠️ **L'ANSES ne définit QUE les deux bornes** : B et C n'ont aucune définition publiée, et leur en écrire une serait inventer une source. ⚠️ **Conséquence sur l'affichage, prise le 2026-08-07** : l'énergie n'est plus exemptée de sa cote — elle l'était au motif qu'une cote constante est du bruit, motif qui tombe quand la cote annonce une fiabilité ; l'écran explique la constance (calcul selon le règlement UE n° 1169/2011) au lieu de la masquer. ⚠️ **CE QUE ÇA NE REFERME PAS, ET QUI APPARTIENT À L'UTILISATEUR** : l'arbitrage « importer SANS pondérer » a été rendu en partie sur cette prémisse fausse. La décision N'EST PAS rouverte d'office ici — mais **quiconque la relit doit savoir qu'un de ses appuis a cédé**. Historique ci-dessous, conservé tel quel : **TRANCHÉE le 2026-08-05 (issue « importer SANS pondérer »).** ⚠️ **Remesurée d'abord : les trois chiffres de la version ouverte avaient bougé**, mesurés qu'ils étaient sur 192 aliments quand le catalogue en compte 450. Relevé du 2026-08-05 sur les 449 aliments appariés : **39 %** des valeurs hors énergie cotées C ou D (la décision disait 34 %) — fibres 50 %, glucides 49 %, vitamine C 49 %, protéines et lipides 35 % — et l'**ÉNERGIE à 434 D sur 449** (elle disait 191 sur 192), **par construction** : « Energie, Règlement UE N° 1169/2011 » est CALCULÉE depuis les macros, jamais dosée. ⚠️ **Et elle citait les mauvaises sources.** Elle nommait Paul & Southgate (UK) et Souci-Fachmann-Kraut (DE) ; la mesure donne **USDA en tête (451 occurrences)**, puis **368 « valeur ajustée/calculée/imputée Ciqual »** et 66 calculs depuis les aliments contributeurs. Deux conséquences que la décision n'avait pas : ajouter l'USDA au projet **réimporterait bien ce que l'ANSES lui a déjà pris** — mesuré, plus supposé ; et une cote C ou D ne veut PAS dire « douteuse », elle veut souvent dire « calculée plutôt que dosée ». **DÉCISION (utilisateur) : importer les cotes, NE PAS pondérer le score.** La piste « pondérer le vecteur de couverture (§5.1 bis) » est donc close : elle déclasserait 39 % des valeurs pour une raison de DOCUMENTATION, invisible à l'utilisateur et incontestable par lui, et exigerait d'exclure l'énergie à la main sous peine de la sortir du scoring pour tout le catalogue. **Ce qui est codé** : `import-ciqual.mjs` capture les cotes (il les jetait dans sa propre boucle) et les écrit dans `catalog/sources/ciqual-confiance.yaml` — **fichier GÉNÉRÉ à part, pas `foods.yaml`**, pour deux raisons distinctes : `foods.yaml` est le fichier le plus disputé du dépôt, et une COTE n'est pas une VALEUR ; `build.mjs` remplit `food_nutrient.code_confiance` (3 907 cotes : A 1507 · B 564 · C 738 · D 1098) ; `loadConfianceFrom` rend la table **À CÔTÉ du `Catalog`, jamais dedans**, et le `Socle` la porte côté UI — le moteur ne PEUT pas la lire, la pondération est inexprimable plutôt qu'interdite par convention. ⛔ **CE QUI MANQUAIT — l'affichage, donc le consommateur — est livré le 2026-08-07** (voir en tête de cette ligne). §8 porte la trace de la dette et de sa levée |
| ~~34~~ | **Journées de planning sous le plancher calorique** | **LARGEMENT RÉSOLUE le 2026-07-28**, en trois temps et aucun des trois n'était celui que j'avais annoncé au départ. **(a)** Le diagnostic « catalogue trop léger » était FAUX — la meilleure journée possible atteignait déjà 2 127 kcal. **(b)** La cible nutritionnelle restante (§7.1) a été codée et mesurée INSUFFISANTE (+64 kcal) : l'énergie ne pèse que 2,8 % du score. **(c)** Le vrai correctif était double — `checkCalorieFloor` AVERTIT au lieu d'annuler (§6.5 demandait un écran d'avertissement, j'avais codé un refus), et les 30 recettes végétaliennes de la décision 37 ont enrichi le vivier. **Résultat mesuré** : le cas nominal (7 jours × 3 créneaux) passe de 1 038 kcal minimum avec 3 avertissements à **1 208 kcal minimum, ZÉRO avertissement**. ⛔ **CE CHIFFRE EST PÉRIMÉ — REMESURÉ LE 2026-08-03 : 830 kcal minimum, 4 AVERTISSEMENTS sur 7 jours** (`npm run engine:plan-stress`, ligne « 7 jours » ; 14 jours donne 830 kcal et 6 avertissements). Le banc n'a pas changé depuis la mesure d'origine (`git log -- app/src/cli/stress-planning.ts` s'arrête au commit PWA), donc la comparaison est valide et **c'est une régression, pas un écart de méthode**. `avert.` compte bien `checkCalorieFloor` (`api/index.ts:630`) et l'énergie est **par portion** (`recipe-nutrients.ts:6`). ⚠️ **Cause non identifiée** — les fichiers de sélection ont bougé depuis le 2026-07-28, notamment en `3dbaf48` (dont le correctif « `diversify` ignorait la graine ») ; c'est une piste, pas une conclusion. ⚠️ **Conséquence immédiate sur la décision 45**, qui s'appuie sur ce chiffre pour masquer l'alerte par défaut. ⚠️ **Reste ouvert** : les combinaisons extrêmes. « sans gluten NI lait NI œuf » remplit 16 créneaux sur 21, « végétalien + sans gluten » 36 sur 56. C'est une limite de contenu assumée, pas un défaut moteur — `planWeek` place l'optimum disponible |
| ~~35~~ | **Piquant des recettes — attributs posés, feature à faire** | **TRANCHÉE, CODÉE et MESURÉE le 2026-08-07.** Les deux points laissés ouverts par cette ligne — « seuil de tolérance dans le profil, et effet moteur (exclusion dure vs score) » — sont arbitrés par l'utilisateur : **SCORE, JAMAIS EXCLUSION**, et **trois positions en toutes lettres**. ⚠️ **LA MESURE A CHANGÉ LA QUESTION AVANT L'ARBITRAGE, et c'est elle qu'il faut retenir** : sur 297 fiches, **2 seulement** portaient un ingrédient brûlant (piment de Cayenne, en pincée et FACULTATIF dans les deux cas) ; `harissa` et `raifort` sont au catalogue et employées par **zéro** recette ; 28 portent un « moyen » (curry, gingembre frais, chorizo, moutarde) et 79 du simple assaisonnement (poivre, paprika, curcuma). **Aucune recette du catalogue ne dépasse le niveau 1** — les niveaux 2, 3 et 4 sont inutilisés, et c'est ce qui rend l'exclusion dure indéfendable. ⛔ **POURQUOI PAS D'EXCLUSION, ET CE N'EST PAS UN RÉGLAGE DE FINESSE** : `Recipe.piquant` vaut `null` sur toute recette que personne n'a annotée. Une exclusion dure sur ce champ aurait deux issues, toutes deux fausses — exclure `null` VIDE le catalogue, laisser passer `null` promet une protection qu'elle ne rend pas. Un score, lui, ne ment pas : il fait descendre ce qui est trop fort sans prétendre avoir tout vu. **CE QUI EST CODÉ** : (1) **297 fiches annotées** — 286 à `0`, 11 à `1` — par une règle éditoriale écrite et contestable (curry en poudre, gingembre FRAIS, cayenne, harissa, raifort, chorizo → 1 ; poivre, paprika, curcuma, gingembre en poudre et moutarde → 0, ils assaisonnent sans piquer) ; (2) `PiquantTolerance = 'aucun' | 'un_peu' | 'tout'` sur `SuggestionRequest` **à côté de `varietyMode` et PAS dans `UserProfile`**, qui décrit une physiologie quand le piquant est un goût ; (3) **migration v12**, `user_profile.tolerance_piquant`, nullable ; (4) couche de score `piquant`, **12ᵉ du registre**, `defaultWeight: 0` relevée dynamiquement à `PIQUANT_DYNAMIC_WEIGHT = 0.25` **seulement si une tolérance est DÉCLARÉE** — même mécanisme que `craving` ; (5) réglage « Le piquant » dans Paramètres, plus `--piquant` au banc. ⚠️ **LE POIDS DYNAMIQUE N'EST PAS UNE COQUETTERIE** : les poids sont normalisés à Σ = 1, donc une couche permanente aurait dilué toutes les autres et **déplacé le classement de gens qui n'ont jamais parlé de piquant**. Ne rien déclarer ne coûte rien, et c'est vérifié au banc. ⚠️ **`null` NE VAUT PAS `'tout'`** — même règle que `Recipe.piquant`, dont l'absence ne vaut jamais « doux ». Les deux se comportent pareil pour le moteur, mais afficher « J'aime le piquant » à qui n'a rien dit lui prêterait un choix. D'où « Je préfère ne pas répondre », qui doit rester atteignable. ⚠️ **`tolerancePiquant` EST REQUIS sur `SuggestionRequest`, `WeekPlanRequest` ET `RerollContext`**, contrairement à `varietyMode` qui est optionnel. Délibéré : un champ optionnel oublié aurait produit un réglage écrit en base, lu par les Paramètres, affiché à l'écran, et **n'atteignant jamais le moteur** — la 6ᵉ occurrence du défaut signature. Le compilateur a nommé **18 sites**. ⛔ **LA COUCHE N'EST JAMAIS CITÉE dans une explication** (`EXPLANATION_LABELS.piquant = null`) : elle ne fait que PÉNALISER, donc elle ne peut jamais être la raison qu'un plat ait été retenu — acquis n°3. **MESURÉ au banc** : sans déclaration la couche n'apparaît pas du tout ; avec « je n'en mange pas », les currys passent des rangs 25/32/33 à **absents du top 40**. ⚠️ **`Food.piquant` N'EST TOUJOURS PAS ANNOTÉ** — `foods.yaml` était en cours d'édition par une autre piste ce jour-là. Verrouillé par test : `null` partout, et jamais `0` par défaut | 
| ~~36~~ | **Objectif calorique personnel — amendement à §6.5 ARCHITECTURE** | **TRANCHÉE (2026-07-28, décision utilisateur).** §6.5 interdisait TOUT objectif journalier, sans exception, les applis de nutrition étant un vecteur documenté de TCA. Amendement : un objectif personnel devient possible sous **quatre conditions cumulatives** — opt-in explicite, jamais par défaut, non mis en avant (enfoui dans les réglages avancés), et **aucun compteur de reste**. ⚠️ La quatrième n'est pas négociable : §6.5 identifie précisément « il te reste 340 kcal aujourd'hui » comme LE mécanisme de restriction, pas l'affichage d'un chiffre. Un objectif peut s'afficher À CÔTÉ du total du jour, jamais comme un solde qui se vide. `ARCHITECTURE.md` §6.5 est amendé en conséquence — la règle du projet veut que le document soit mis à jour, pas contourné. **Non implémenté** : c'est un sujet d'UI (P5), aucun code moteur concerné |
| ~~37~~ | **Trous végétaliens du catalogue** | **FERMÉE le 2026-07-28** — 30 recettes végétaliennes écrites : 13 petits-déjeuners, 11 goûters, 6 plats. Couverture par créneau × régime, cible 14 (fenêtre max §7.1) : petit-déjeuner végétalien **1 → 14** (et 17 → 30 pour tous les régimes), goûter **3 → 14** (27 → 38), plats végétaliens **8 → 14**. Plus aucun trou. A nécessité **6 nouveaux aliments** (199 au total) : boissons au soja / à l'amande / à l'avoine, sirop d'érable, dattes, raisins secs — le catalogue n'avait AUCUN lait végétal, ce qui rendait un petit-déjeuner végétalien quasi impossible à écrire. ⚠️ `miel` n'est PAS végétalien, d'où le sirop d'érable. Effet mesuré au banc de stress : végétalien 14 j × 3 passe de 29/42 à **42/42**, sans gluten de 20/21 à 21/21, sans lait de 19/21 à 21/21 |
| ~~38~~ | **Cohérence entre l'étiquette `regime` et les ingrédients** | **TROUVÉE ET CORRIGÉE le 2026-07-28**, en cherchant les effets de bord des 30 nouvelles recettes. ⛔ **Bug grave** : « Tofu laqué à la sauce soja et au sésame » se déclarait `vegetalien` et contenait du **MIEL**. Rien n'échouait — un utilisateur végétalien se voyait simplement proposer un produit animal, soit la promesse centrale de l'appli en défaut. Corrigé en remplaçant le miel par du sirop d'érable (la recette reste végétalienne et cohérente). ⚠️ **Six recettes** étaient étiquetées `vegetarien` alors qu'elles sont végétaliennes — défaut inverse et silencieux : elles disparaissaient des suggestions de qui pouvait les manger. Ré-étiquetées. C'est le mode de défaillance SILENCIEUX que la décision 28 reprochait aux étiquettes multiples : l'étiquette unique ne l'élimine pas, elle le déplace. **`tests/regime-coherence.test.ts` le verrouille désormais** à chaque build, dans les deux sens. ⚠️ Piège rencontré en écrivant la règle : le beurre, la crème et le miel ne sont dans AUCUN groupe animal (« matières grasses », « produits sucrés ») — s'en remettre au seul `Food.groupe` faisait passer « Radis au beurre » pour végétalienne |
| ~~39~~ | **Origine animale des aliments, en cascade** | **TRANCHÉE et CODÉE le 2026-07-28** (demande utilisateur, à la suite du bug du miel). `Food.origineAnimale` ∈ {`mammifere`, `volaille`, `poisson`, `fruit_de_mer`, `insecte`} et `Food.deriveDe` — l'origine se PROPAGE le long de la chaîne : `beurre_doux` → `lait_entier` → `mammifere`. **Pourquoi `Food.groupe` ne suffisait pas** : le beurre vit en « matières grasses », le miel en « produits sucrés » — aucun groupe animal. À l'inverse les boissons végétales portent « lait et produits laitiers » sans être animales. Les deux erreurs sont désormais impossibles. 58 aliments annotés sur 199 (15 mammifère, 5 volaille, 16 poisson, 8 fruit de mer, 1 insecte, 13 dérivés). Les fromages d'autres mammifères (feta, brousse, chèvre, roquefort) sont déclarés en SOURCE et non dérivés de `lait_entier`, qui est du lait de vache — les faire dériver de lui affirmerait quelque chose de faux. ⚠️ **FACTUEL, pas un régime** — même leçon que `types_repas`/`service` : `DIET_CHAIN` en déduit ce qu'elle veut, un futur filtre halal ou casher lira le même champ. Ne pas y encoder le régime. ⚠️ `resolveAnimalOrigin` porte une GARDE ANTI-CYCLE, testée : le build refuse les cycles, mais la fonction est appelable sur d'autres données et doit s'arrêter plutôt que figer l'appelant |
| ~~40~~ | **Conditionnements d'achat** | **TRANCHÉE et CODÉE le 2026-07-28** (règle donnée par l'utilisateur). `Food.conditionnementG` — un SEUL nombre par aliment, et on achète `⌈besoin ÷ paquet⌉` paquets : avec une plaquette de 250 g, 240 g de besoin donnent une plaquette, 260 g en donnent deux. Une échelle de tailles disponibles n'apporterait rien — deux plaquettes de 250 g valent une de 500 g au moment de payer. **107 aliments sur 199 conditionnés**, 92 laissés au poids : légumes, fruits, viandes et poissons se vendent à la coupe, leur inventer un paquet produirait des quantités fausses. Effet : « 70 g de beurre » devient une plaquette de 250 g, « 150 g de lait » une brique d'un litre, « 200 g d'œuf » 4 œufs. ~~⚠️ Reste côté INTERFACE : l'`unite` est `'g'`. Afficher « 4 œufs » ou « 1 plaquette » plutôt qu'un poids est un travail d'affichage — le moteur donne la quantité, pas sa formulation~~ ✅ **CETTE RÉSERVE EST LEVÉE LE 2026-08-06 — voir la décision 41.** La répartition qu'elle énonce est exactement celle qui a été tenue : le moteur donne la quantité, `ui/quantites.ts` la formule |
| ~~41~~ | **Unités d'affichage et bruit de la liste de courses** | **TRANCHÉE et CODÉE le 2026-07-28.** Trois ajouts issus d'une revue des USAGES de la liste, pas du code. **(a) `Food.poidsPieceG`** — « 3 carottes » plutôt que « 350 g », prime sur le conditionnement. ⚠️ UN SEUL poids moyen, pas petit/moyen/gros : trois tailles demanderaient à l'utilisateur laquelle il trouvera, information qu'il n'a pas au moment de planifier. **(b) `Food.fondDePlacard`** — sel, poivre, épices sèches écartés par défaut (`sel_fin` est « au goût » 163 fois au catalogue) ; 77 → 68 lignes. **(c) `ShoppingOptions.pantryFoodIds`** — « vider le frigo » (v1, table `user_pantry` déjà spécifiée). Ne viole PAS le principe n°2, qui interdit d'exfiltrer et non de demander ; et la règle « l'appli ne demande rien » de §6.2 vise les pathologies. Tout ou rien, jamais un décompte partiel. ⚠️ **Les cuillères ont été ÉCARTÉES de la liste** : on n'achète pas trois cuillères d'huile, on achète une bouteille — le conditionnement répond déjà. Et le catalogue porte DÉJÀ les cuillères sur la recette (`unite_affichage`, saisi à la main), plus juste qu'une conversion (une cuillère d'huile ≠ une cuillère de miel). ✅ **LA MOITIÉ « AFFICHAGE » EST LIVRÉE LE 2026-08-06, et elle était plus petite ET plus grande que prévu.** ⚠️ **PLUS PETITE** : la conversion en pièces n'a jamais manqué — `quantiteAffichee` (`shopping-list.ts`) la faisait depuis le premier jour et rendait `unite: 'pièce'`. Le diagnostic « les champs ne servent qu'au calcul » était FAUX pour `poidsPieceG` ; il ne valait que pour `conditionnementG`. **Vérifier ce que le code fait AVANT d'annoncer ce qui manque.** ⚠️ **PLUS GRANDE** : l'écran concaténait `${quantiteTotale} ${unite}` à **trois endroits** — ligne cochable, « Déjà chez vous », et **l'export texte de « Partager »**. Trois copies de la même règle, donc trois occasions de diverger ; le format vit désormais dans `Vue.quantiteDe`, une fois. **Trois défauts mesurés sur le catalogue du jour, tous trois corrigés** : « **3 pièce** » sans accord (**88** aliments sur 450 rendus en pièces) ; « **1000 g** » au lieu de « 1 kg » — `formaterMasse` existait dans `ui/quantites.ts` et **n'était appelée de nulle part** ; et « 500 g » de beurre qui ne disait pas que c'étaient DEUX plaquettes (**226** aliments conditionnés, dont **52** dépassent le kilo dès deux paquets). ⚠️ **« 2 × 250 g » ET NON « 2 plaquettes » (décision utilisateur)** : `conditionnementG` est un NOMBRE, le catalogue n'a aucun nom d'emballage. « 2 paquets » pour 1,5 kg d'huile d'olive serait faux, et nommer l'emballage par aliment serait un lot de contenu sur 226 entrées plus un champ de schéma. La multiplication est vraie pour une plaquette, une brique et une bouteille à la fois. ⚠️ **Affiché seulement à partir de DEUX** — « 1 × 250 g » répète la ligne sans rien apprendre. ⚠️ **« 3 carottes » N'A PAS ÉTÉ RETENU** au sens littéral : le nom de l'aliment occupe déjà sa propre colonne, « Carotte, crue — 3 pièces » dit la même chose sans le répéter |
| ~~42~~ | **`pourSlots` — la liste devait être rangeable par repas et par jour** | **CORRIGÉE le 2026-07-28.** §2 ARCHITECTURE exige une liste « rangeable par rayon / repas / jour ». `ShoppingListItem` portait le rayon et la tranche, mais l'agrégation DÉTRUISAIT l'information de repas : ranger par repas était impossible. ⚠️ **Le manque ne se voyait pas** — la liste avait l'air complète. Trouvé en ÉNUMÉRANT les usages à la demande de l'utilisateur, pas en relisant le code. Ajouter la provenance après coup aurait obligé à refaire l'agrégation |
| ~~43~~ | **Lexique de gestes — 4 fiches pour 93 étapes** | **COMPLÉTÉ le 2026-07-28, EN DEUX PASSES.** Dernier point de contenu de l'audit du 2026-07-27. **4 → 62 gestes**, **155 → 763 étapes annotées** sur 1 097 (70 %). ⚠️ **La première passe était incomplète, et cohérente** — aucune référence cassée, aucune fiche orpheline, 43 gestes… et « écosser les fèves », « éponger les calamars », « essorer la laitue », « étaler la pâte » annotées nulle part. Elle partait d'une liste écrite À LA MAIN. **La cohérence ne dit rien de la couverture** : il a fallu échantillonner les étapes non annotées pour voir le trou. Seconde passe : extraction des verbes des 1 097 étapes, puis TRI. « Ajouter », « verser », « mélanger », « servir » sont fréquents mais ne sont pas des gestes — les définir serait condescendant et gonflerait le lexique sans rien apprendre. 19 gestes techniques retenus, `zester` écarté (0 occurrence). Les 334 étapes restantes sont sans geste technique (« Mélanger farine et sucre », « Servir aussitôt ») — c'est normal, pas un trou. ⚠️ **RESTE : « illustré »**. §2 ARCHITECTURE promet un « lexique de gestes de cuisine ILLUSTRÉ » et les 62 fiches sont du texte seul. C'est du ressort des visuels, en cours côté utilisateur |
| ~~44~~ | **Méthodes d'API restées non câblées** | **TROIS SUR QUATRE CODÉES le 2026-07-28.** `scaleRecipe` (§10.1), `rerollSlot` (§7.2) et la couche `pantry` (§10.2 ①, « vider le frigo ») — déclarée au registre depuis le début, jamais implémentée, alors que `MealContext.pantryFoodIds` existait déjà. ⚠️ **`pantry` est une couche de SCORE, jamais un filtre** : avec quatre ingrédients au frigo aucune recette n'est intégralement couverte, un filtre renverrait zéro résultat. Et la couverture est PONDÉRÉE PAR LA MASSE — avoir le sel d'un bœuf bourguignon ne couvre rien, avoir le bœuf couvre l'essentiel. ⚠️ **`scaleRecipe` applique une règle de trois, y compris au sel** — choix assumé : une courbe par ingrédient serait irrenseignable pour 199 aliments, et la règle de trois est PRÉVISIBLE. `uniteAffichage` reste figée : mettre « 2 carottes » à l'échelle demanderait de réécrire du français. ⚠️ **`rerollSlot` et `planLeftovers` ont dû ÉTENDRE leur signature** avec le profil : un `WeekPlan` garde le résultat, pas la demande qui l'a produit. Restent non câblées : `analyzeWeek` (pas de type `NutritionReport` défini) et `suggestSubstitutions` (table vide, décision 27) |
| ~~45~~ | **L'alerte de plancher calorique et le « mode professionnel »** | **TRANCHÉE le 2026-08-02 (décision utilisateur), amendement à §6.5 ARCHITECTURE.** Demande d'origine : « on a dit deux modes → un par défaut pour tout le monde → 1 pour les professionnels ». **L'alerte est MASQUÉE par défaut** et n'apparaît qu'en mode professionnel. **Un seul interrupteur, pas deux** : `user_display.afficher_macros` — déjà décrit en §6.5 comme « le mode avancé, destiné aux sportifs », déjà `false` par défaut — devient ce mode et gouverne aussi l'alerte. **Aucune migration** : la colonne existe depuis la v1 du schéma d'affichage. Créer un second drapeau aurait installé deux axes de réglage et la dérive « écran par écran » que §6.5 dit précisément d'éviter. ⚠️ **CONSÉQUENCE NON DEMANDÉE, ACTÉE** : `alertes_discretes` (v4) devient sans objet — si l'alerte n'apparaît qu'en mode professionnel, « version courte » n'a plus rien à raccourcir. La case de `parametres.tsx` et la prop `discrete` d'`AlerteEnergie` sont retirées ; **la colonne reste en base**, les migrations de ce projet étant en ajout seul. ⚠️ **RÉSERVE ÉCRITE, MAINTENUE, ET ÉCARTÉE PAR L'UTILISATEUR** : c'est la seule des trois décisions du jour qui RETIRE une protection au lieu d'en déplacer une, et §6.5 est déclarée contraignante pour la publication (« ces règles conditionnent la légalité du produit »). Le texte d'origine exigeait un « écran d'avertissement explicite » sous 1 200 / 1 500 kcal ; il ne peut pas tenir tel quel et est réécrit, pas contourné — même mécanique que l'amendement de la décision 36. ~~⚠️ **Le fait qui relativise le risque** : décision 34 a mesuré le cas nominal (7 jours × 3 créneaux) à **1 208 kcal minimum, ZÉRO avertissement**. L'alerte ne se déclenche plus que sur les combinaisons extrêmes de régimes — « sans gluten NI lait NI œuf » remplit 16 créneaux sur 21. Ce qui est masqué par défaut est donc un cas rare, **pas** le comportement ordinaire ; et la cause de ce cas rare est un trou de CONTENU, qui reste à combler indépendamment~~ ⛔ **CETTE PRÉMISSE EST TOMBÉE LE 2026-08-03, ET ELLE ÉTAIT LA SEULE QUI RENDAIT CETTE DÉCISION TENABLE.** Remesure au banc, cas nominal 7 jours × 3 créneaux : **830 kcal minimum, 4 avertissements sur 7 jours** (détail et méthode en décision 34). Ce qui est masqué par défaut n'est donc **pas** un cas rare — c'est le comportement ordinaire. La décision 45 reste APPLIQUÉE dans le code (`semaine.tsx:352`, `AlerteEnergie` monté seulement si `modeAvance`) mais sa **justification écrite est fausse**, et §6.5 ARCHITECTURE est déclarée contraignante pour la publication. ⚠️ **Trois issues, aucune tranchée, et ce n'est pas à Claude de choisir** : (a) traiter la régression de plancher et revérifier — si le nominal repasse à zéro avertissement, la décision 45 redevient tenable telle quelle ; (b) laisser l'alerte masquée et l'assumer explicitement comme un écart à §6.5, écrit et daté ; (c) rendre l'alerte visible par défaut, ce qui annule la décision 45. ⚠️ **(a) est le seul ordre sain** : décider de la visibilité d'une alerte avant de savoir pourquoi elle se déclenche quatre fois plus qu'avant, c'est arbitrer sur un symptôme. ⚠️ **Ne pas confondre avec le trou de contenu** des combinaisons extrêmes, qui lui reste réel et indépendant ⚠️ **MISE À JOUR DU 2026-08-04 — LA PISTE (a) A ÉTÉ SUIVIE, ET ELLE ABOUTIT.** La régression est corrigée (décision 54) : sur 20 graines, le cas nominal passe de **0/20 à 20/20 semaines sans aucun avertissement**, min 813 → 1 302 kcal. **La prémisse « le déclenchement est rare » redevient donc VRAIE pour le cas nominal** — mais elle reste FAUSSE pour les régimes pauvres en accompagnements : végétalien 14 j rend encore **5 avertissements**, « végétalien + sans gluten » **9**. ⚠️ **LE CHOIX RESTE À L'UTILISATEUR, et il est maintenant INFORMÉ** : masquer par défaut une alerte qui ne se déclenche plus chez la majorité mais se déclenche encore chez les végétaliens revient à la masquer surtout à ceux à qui elle s'adresse. Décision de produit, pas conséquence technique. ✅ **TRANCHÉE LE 2026-08-04 (décision utilisateur) : ON RESTE SUR L'ALERTE MASQUÉE PAR DÉFAUT.** C'est l'issue (b) — la décision 45 est maintenue telle quelle, en connaissance des chiffres ci-dessus : le cas nominal ne déclenche plus rien (20/20 graines propres), les régimes pauvres en accompagnements déclenchent encore. **Ce n'est plus une prémisse fausse, c'est un choix assumé et daté**, ce que §6.5 ARCHITECTURE demandait. ⚠️ **NE PAS ROUVRIR SANS ÉLÉMENT NEUF** : l'élément neuf attendu est le contenu d'accompagnement (chantier en cours côté utilisateur) — s'il fait tomber les 5 et 9 avertissements résiduels à zéro, la question disparaît d'elle-même |
| ~~46~~ | **Facettes de filtre : dépliantes, ou autrement ?** | **TRANCHÉE le 2026-08-02 (décision utilisateur)** — ni le dépliant demandé, ni le statu quo : **les valeurs fréquentes passent dans le flux**. Chaque axe rend ses N valeurs les plus portées en pastilles directement cliquables, suivies d'un « Tout voir (k) › » qui ouvre la fenêtre existante. **Zéro geste pour le cas courant, aucun dépliant, et rien ne pousse vers le bas** — la règle de `panneau.tsx` tient sans exception à documenter. ⚠️ **Le grief d'origine était déjà traité** : le verbatim (« pour les filtres exemple cuisine → ils doivent être dépliables […] et non passer par plus de filtres ») avait pour cause mesurable « la cuisine est à deux gestes », corrigé au lot 11 du 2026-08-02 (Cuisine, Régime, Service à UN tap chacun). Ce qui restait était la forme littérale, pas le besoin. ⚠️ **LE CLASSEMENT DES PASTILLES EST GLOBAL, LES COMPTEURS RESTENT DYNAMIQUES.** Deux choses distinctes : *quelles* valeurs sortent en pastille se dérive du catalogue entier et ne bouge jamais ; *quel chiffre* s'affiche à côté reste celui de l'écran (règle en place, `filtres-recettes.tsx:8-16`). Dériver aussi le classement des résultats courants ferait changer les pastilles de place à chaque filtre posé — un bouton qui se déplace sous le doigt, exactement ce que la contrainte d'âge du produit interdit. Une valeur sélectionnée reste visible même hors du top N, sinon la retirer deviendrait impossible |
| ~~47~~ | **Variantes par substitution : table `substitution` ou recette à part entière ?** | **TRANCHÉE le 2026-08-02 (décision utilisateur) — la table.** Ferme la décision 27, qui disait « avec le contenu, pas avant » : le contenu arrive. **Trois raisons** : (a) la sémantique était DÉJÀ tranchée par la décision 26 — variante = ingrédient principal INVARIANT, substitution d'un ingrédient SECONDAIRE ; faire d'une variante une recette à part entière l'aurait contredite ; (b) le mécanisme est **déjà codé et testé** (`buildVariants`, `alternatives.ts:54-90`), il ne rend rien uniquement parce que `catalog.substitutions` est une Map vide ; (c) 4 champs par couple contre 20 pour une recette, et deux recettes quasi identiques ont un `signatureOverlap` proche de 1 (`signature.ts:155`) — la diversification en supprimerait systématiquement une des deux, donc une variante n'apparaîtrait **jamais** à côté de son original. ⚠️ **UN COUPLE EST GLOBAL** : `catalog.substitutions` est indexée par ALIMENT (`ReadonlyMap<FoodId, Substitution[]>`), pas par recette. Écrire `beurre → huile d'olive` l'appliquerait à toutes les recettes contenant du beurre, pâte brisée comprise. **Règle retenue : on n'écrit que les couples vrais PARTOUT** — si le `contexte` doit dire « sauf », le couple n'a pas sa place. Une portée par recette (`Substitution.recipeIds`) a été envisagée puis écartée : modifier le type du domaine, le schéma, le build et `buildVariants` avant d'avoir écrit le moindre couple. Seul garde-fou déjà en place : `alternatives.ts:78` refuse la substitution sur l'ingrédient CARACTÉRISTIQUE. ⚠️ **`ratio` ET `contexte` ÉTAIENT DÉCLARÉS ET LUS PAR PERSONNE** (`catalog.ts:534-535` contre `alternatives.ts:84`, qui ne prend que `altFoodId`) — le motif exact déjà payé deux fois par ce projet (`note_allergene`, filtre allergènes sur liste vide). **Ils sont câblés en même temps que la table**, pas remplis à vide : `ratio` recalcule la quantité, `contexte` devient la phrase montrée. ⚠️ **LES COUPLES SONT SOURCÉS, comme les recettes** (décision utilisateur) : un ratio faux produit un plat raté, et la vérification du 2026-08-02 a trouvé 8 recettes à risque sur 10 sans aucun critère vérifiable. ⚠️ **RIEN NE SERA VISIBLE À L'ÉCRAN** : `suggestAlternatives` n'est câblée à aucun bouton (`detail-recette.tsx:16-18`, `frigo.tsx:21`). Remplir la table remplit le MOTEUR ; l'exposer est un chantier distinct, non décidé. **⚠️ AMENDÉE LE JOUR MÊME — voir décision 48** |
| ~~48~~ | **La règle « couples universels » de la décision 47 rend une table VIDE** | **MESURÉ puis AMENDÉ le 2026-08-02, quelques heures après la décision 47.** Une passe de recherche sourcée sur les ~200 aliments du catalogue a rendu **ZÉRO couple** passant le double filtre « vrai dans toute préparation » + « source institutionnelle lue ». **Les rejets tiennent SUR CE CATALOGUE, pas en théorie** — vérifié en interrogeant `catalog.db` : `beurre_doux` est dans **60 recettes dont 11 desserts** (tarte aux pommes, tarte au citron, tarte aux abricots, deux crumbles : la pâte brisée n'est pas un cas d'école, elle est au catalogue) ; `sucre_blanc` dans **12 recettes dont 8 desserts** ; `lait_entier` dans **5 dont 4 desserts**, tous des appareils à prise. Seule piste à source institutionnelle solide — le ratio herbes fraîches → séchées, deux extensions universitaires concordantes — **inapplicable** : le catalogue n'a aucune paire du même végétal (thym séché sans thym frais, persil frais sans persil séché), et le ratio est en VOLUME quand la table indexe des grammes. ⚠️ **La cause est STRUCTURELLE, pas un manque d'effort** : `catalog.substitutions` est indexée par ALIMENT SEUL, et à peu près toute substitution culinaire dépend du contexte de préparation (cru/cuit, salé/pâtissier, monté/simple). **Un index par aliment ne peut pas exprimer « sauf ».** **DÉCISION (utilisateur) : on rouvre la portée par recette**, c'est-à-dire l'option que la décision 47 avait explicitement écartée — écartée sous l'hypothèse, désormais fausse, qu'une table universelle serait remplissable. ⚠️ La passe de recherche avait convergé **seule** sur cette même recommandation, sans connaître l'arbitrage. **Forme retenue : `Substitution.recipeIds`, liste d'INCLUSION** (`null` = partout, réservé au cas universel qu'on sait maintenant rare). Une liste d'EXCLUSION a été envisagée et écartée : elle est plus courte à écrire mais elle **échoue ouverte** — la recette 242, une tarte, hériterait en silence d'une substitution fausse. L'inclusion échoue fermée : une recette nouvelle ne reçoit rien tant que personne ne l'a ajoutée. C'est le même arbitrage que l'import de recettes, qui REFUSE sur un `foodId` inconnu plutôt que de laisser passer. ⚠️ **CONSÉQUENCE À ASSUMER : les couples s'écrivent ÉTROITS.** On n'écrit pas `beurre → huile` pour 49 recettes — une liste de 49 ids écrite à la main ne serait vérifiée par personne et pourrirait, exactement ce que ce projet reproche aux listes écrites à la main. Une table de substitution n'a pas à tout couvrir ; elle doit être JUSTE là où elle se déclenche. ⚠️ **Un test de build est exigé** : toute entrée de `recipeIds` doit désigner une recette qui existe ET qui contient réellement `foodId`, sinon c'est une entrée morte — la classe de bug que ce projet rencontre en boucle (`note_allergene`, filtre allergènes sur liste vide, `ratio`/`contexte` jamais lus). **⚠️ SECONDE MESURE, MÊME JOUR : la portée par recette RÉSOUT le périmètre et NE RÉSOUT PAS le contenu.** Une deuxième passe de recherche, menée avec la portée par recette, rend **encore zéro couple** — mais le blocage a changé de nature et c'est cela qu'il faut retenir : « `beurre_doux` → `huile_olive` dans ces plats salés-là, pas dans les 11 desserts » est **devenu exprimable**. Ce qui manque désormais, c'est **la source**. Les agences publient des COMPOSITIONS, pas des équivalences de cuisine : le CNIEL donne « le beurre standard contient 82 % de matière grasse » (lu), l'ANSES Ciqual et l'USDA FoodData Central sont des applications JS non lisibles automatiquement, et tout ce qui chiffre un ratio est un blog ou un calculateur. ⚠️ **Une part du blocage vient d'une consigne trop stricte, pas de la règle du projet** : la passe avait reçu « privilégie institutions publiques et agences » et en a conclu que les ouvrages culinaires étaient exclus. **Ils ne le sont pas** — le chantier de sourçage des recettes cite Escoffier 1903 et Anctil 1915. ⚠️ **Et `ratio: 1.0` n'est pas une affirmation à sourcer** : c'est « même poids », l'hypothèse nulle. Ce qui demande une source, c'est QUE l'échange fonctionne — un jugement culinaire — pas LE NOMBRE. Exiger une citation d'agence pour 1 = 1 bloque la table sur une exigence vide. **⏸️ CHANTIER MIS EN PAUSE (décision utilisateur, 2026-08-02)** : le contenu des recettes est travaillé **en parallèle** dans une autre piste, et écrire ici entrerait en collision. **Rien n'a été codé, rien n'a été écrit au catalogue.** À la reprise, deux pistes non creusées attendent, toutes deux à ratio 1,0 : **`gruyere` ↔ `comte_rape`** (les deux au catalogue, les deux utilisés en gratins) et les **légumineuses en conserve**. **⏸️ TOUJOURS EN PAUSE au 2026-08-03 (décision utilisateur), mais DÉSORMAIS SANS RÉSERVE — troisième mesure, les deux pistes ci-dessus sont épuisées, chacune pour une raison distincte et vérifiée.** **(a) `gruyere` ↔ `comte_rape` — pas de source.** La seule phrase existante (« Remplacer le gruyère par du comté. 100 g environ, dont 75 incorporé à la béchamel », `cuisine-libre.org/endives-roulees-au-jambon`) est un **commentaire de lecteur** signé « paddy » (2010), pas un texte éditorial. ⚠️ **Le build l'aurait ACCEPTÉE** : `verifierDomaine` ne compare que le nom d'hôte, et `cuisine-libre.org` est dans la liste blanche — le rejet a été un jugement humain, pas un garde-fou. Écrit dans `reference/PIEGES.md` ; **non corrigé au schéma** (décision utilisateur du 2026-08-03) : rendre la citation exacte obligatoire fermerait le trou mais imposerait de compléter les 41 recettes déjà sourcées, et aucun filtre d'URL ne peut le fermer autrement — la page est éditoriale, le commentaire est *dessus*. **(b) Légumineuses en conserve — pas de second aliment.** `Substitution` est `FoodId → FoodId`, et le catalogue porte **un seul id par légumineuse**, déjà figé sur une forme : `haricot_rouge` 20524, `haricot_blanc` 20511, `flageolet` 20508, `pois_chiches` 20532 sont « appertisé, égoutté » ; `lentilles_corail` et `lentilles_vertes` pointent tous deux sur 20359 « sèche ». **Décision utilisateur du 2026-08-03 : on garde un id par légumineuse** — la piste est donc close définitivement, écrire le couple supposerait d'abord d'AJOUTER des aliments, ce qui est une extension de catalogue et pas une décision de substitution. La source rapportée par la recherche (Bognár 2002, *Weight yield factors*, hébergé sur `fao.org` donc dans la liste blanche : 2,50 haricots · 2,73 lentilles · 2,45 pois) est solide, mais elle mesure **sec → cuit** quand la piste demandait **sec → conserve égouttée** : la lui faire dire fabriquerait une provenance. ⚠️ **Vérification faite au passage, et NÉGATIVE** : les deux familles étant sur des bases différentes, j'ai contrôlé que les quantités suivent — `chili-haricots-rouges` 400 g « 1 grande conserve égouttée », `flageolets-agneau-romarin` 700 g « 2 conserves égouttées », `dahl-lentilles-corail` 250 g pour 4 avec « les lentilles rincées, couvrir d'eau et laisser mijoter ». Chaque quantité est dans la base de son aliment : **aucun facteur 2,7 caché dans le calcul nutritionnel.** ⚠️ **Ce qui a changé depuis le 2026-08-02** : les deux corrections de la seconde mesure ont bien été appliquées — les ouvrages culinaires ont été admis, `ratio: 1.0` n'a pas été exigé sourcé — et n'ont rien débloqué. Le blocage n'est donc plus le périmètre (résolu par `recipeIds`), plus la consigne (corrigée), ni même vraiment la source (Bognár est recevable) : **les deux couples candidats n'existent pas comme couples dans CE catalogue.** **Rouvrir ce chantier demande d'APPORTER un couple candidat ; une quatrième passe de recherche à l'aveugle est écartée.** |
| ~~49~~ | **Choisir soi-même le plat d'un créneau — et le bouton « Choisir » qui n'en fait rien** | **OUVERTE, ouverte le 2026-08-03** en instruisant `test appli.txt` (voir `RETOUR_ESSAI_TELEPHONE.md` §6.2). Deux demandes distinctes, **un seul geste** : « rajouter en manuel la recette directement » et « faire une recette avec les restes du frigo directement » sont toutes deux « remplir CE créneau », depuis deux sources. ⛔ **Le constat qui prime sur la fonctionnalité** : sur un créneau vide le bouton s'intitule « **Choisir** » (`semaine.tsx:698`) et appelle `onChanger` → `rerollSlot` (`semaine.tsx:268-294`), donc un **tirage automatique**. Le libellé promet un choix et rend un tirage. ⚠️ **Cette moitié-là est à corriger même si la fonction n'est jamais écrite** — un bouton qui ment sur son effet est un défaut autonome, et c'est la classe de défaut que ce projet rencontre en boucle sous une autre forme (`note_allergene`, filtre allergènes sur liste vide, `ratio`/`contexte`) : **l'écart entre ce qui est annoncé et ce qui est branché**. Deux options à trancher : renommer « Choisir » en « Proposer un plat » (une ligne, honnête, ne rend pas la fonction) ou écrire la fenêtre de sélection (réemploie la recherche de `recettes.tsx`, et `frigo.tsx` pour la seconde source). ⚠️ **Contrainte à respecter** : `planLeftovers` et `checkCalorieFloor` tournent sur le plan entier — un plat posé à la main doit repasser par eux, pas contourner le garde-fou ✅ **TRANCHÉE ET CODÉE LE 2026-08-04 (décision utilisateur : la fenêtre complète, deux sources).** **(a) LE MENSONGE EST CORRIGÉ EN DEUX BOUTONS, pas en un renommage.** « Proposer » tire (`rerollSlot`), « Choisir » ouvre la fenêtre (`setSlotRecipe`). Les deux gestes existaient, un seul bouton les portait, et il annonçait le mauvais. **(b) `setSlotRecipe` EST UNE FONCTION À PART, pas une option de `rerollSlot`, et la différence est dans le code** : un tirage ÉCARTE ce qui est déjà au plan, un choix ne le peut pas — refuser à quelqu'un le plat qu'il vient de désigner parce qu'il figure déjà mercredi serait absurde. Verrouillé → plan inchangé ; recette inconnue → `RangeError`. **(c) LA CONTRAINTE ÉCRITE DE CETTE DÉCISION EST TENUE** : `checkCalorieFloor` repasse sur le plan entier, à la même ligne et dans la même fonction que pour un reroll — poser un plat soi-même n'est pas la porte par laquelle §6.5 se contourne. Les rappels sont reprogrammés aussi. **(d) DEUX SOURCES, UN SEUL GESTE** (`ui/choisir-plat.tsx`) : recherche catalogue (`browseRecipes`) et « avec ce que j'ai » (`searchByPantry`). **Les deux appliquent les MÊMES couches d'exclusion que la suggestion** — un allergène déclaré n'apparaît pas plus ici qu'ailleurs. Les contraintes sont RELUES à l'ouverture de la fenêtre, pas héritées de l'écran : c'est le seul endroit du produit où l'utilisateur désigne un plat à la main, donc le seul où un filtre périmé se traduirait par une assiette dangereuse posée de sa propre main. ⚠️ **AUCUN POURCENTAGE DE COUVERTURE AFFICHÉ** dans l'onglet frigo — « il vous manque : crème, thym » est un fait, « couverture 62 % » se lirait comme une note, exactement comme le score du moteur (principe 6). ⚠️ **Une liste vide ne dit jamais « aucun résultat » tout court** : la cause peut être le mot cherché OU les contraintes déclarées, et l'utilisateur ne peut pas les distinguer seul. ⚠️ **Le garde-manger est LU, jamais saisi ici** — dupliquer la saisie ferait deux endroits où déclarer ce qu'on a, donc deux vérités |
| ~~50~~ | **Les restes sont invisibles dans les Courses** | **TRANCHÉE et CODÉE le 2026-08-04**, ouverte le 2026-08-03 (`RETOUR_ESSAI_TELEPHONE.md` §6.2). Les restes s'affichent dans Semaine (`semaine.tsx:624,685`) et **sont absents de l'écran Courses** — `courses.tsx:344` n'a qu'un texte explicatif. ⚠️ **L'enjeu n'est pas cosmétique** : les restes font tomber une semaine de courses de **24 à 15 kg** (§2 ARCHITECTURE, `shopping-list.ts`). **L'effet le plus spectaculaire du moteur est invisible là où il se produit**, et l'utilisateur a posé la question deux fois dans le même fichier (« où sont rangés les restes déjà ? », puis « où sont rangés les restes de la veille ? comment l'utilisateur peut le voir ? »). **Codé** : section « Couverts par un reste (n) » en bas de l'écran, sur le motif de « Déjà chez vous (n) » (décision 41 c) — chaque créneau nommé (« mardi · Déjeuner — Ratatouille »), non cochable, plus un lien vers la Semaine où le créneau porte déjà « Reste du plat de la veille ». ⛔ **LA MOITIÉ « PAR DIFFÉRENCE » DE LA PISTE A ÉTÉ ÉCARTÉE, et il faut que la raison reste écrite pour que personne ne la reprenne** : la section est lue sur `isLeftover`, pas calculée. Un reste porte son propre drapeau (§7.3 ENGINE) là où le garde-manger n'est marqué nulle part — la différence n'était nécessaire que faute de marquage. Et refaire une différence ici ne donnerait rien : **un reste réutilise LA MÊME recette que son plat source**, donc le contrefactuel « et si ce repas était cuisiné à part ? » n'ajouterait AUCUN article, il doublerait des quantités. ⚠️ **AUCUN GAIN CHIFFRÉ N'EST AFFICHÉ, et c'est un choix, pas un oubli** : « n articles évités » vaudrait zéro en permanence, et le seul gain réel — le poids — demanderait d'additionner des grammes, des millilitres et des pièces. Le « 24 → 15 kg » de §2 ARCHITECTURE reste une mesure de document, pas un nombre à afficher à côté d'une liste. Verrouillé par test |
| ~~51~~ | **Plats préparés / repas hors catalogue** | **TRANCHÉE et CODÉE le 2026-08-05.** Demande d'origine : « possibilité de rajouter des plats préparés » (`RETOUR_ESSAI_TELEPHONE.md` §6.2). **DÉCISION (utilisateur) : issue (a) — le créneau est marqué et EXCLU du calcul nutritionnel.** Les deux autres achetaient l'alerte de plancher en fabriquant un chiffre : (b) une saisie d'énergie facultative, un nombre sans provenance mêlé aux valeurs CIQUAL dans les mêmes totaux (principe 3) ; (c) une recette perso à un ingrédient, qui suppose un `foodId` qu'un plat du commerce n'a pas — donc inventer un aliment (interdit, décision 29) ou le rattacher à un aliment approchant, pire encore puisque le résultat aurait l'apparence du sourcé. ⚠️ **Deux affirmations de la version ouverte de cette décision étaient fausses, corrigées en la tranchant.** (1) « (b) est un journal alimentaire, que §6.5 interdit » : §6.5 interdit précisément un champ « quantité MANGÉE », une saisie attendue et exhaustive, une notion de repas manqué et le compteur de reste quotidien — un plan est ce qu'on PRÉVOIT, et « cette portion : 520 kcal » y est explicitement autorisé. (b) a donc été écartée sur la TRAÇABILITÉ, pas sur §6.5. (2) « un plat préparé crève `checkCalorieFloor` ET la couche `nutri` » : `nutriLayer` est une couche de SCORE sur les candidats du catalogue, elle ne voit jamais une entrée de plan. Le vrai risque était ailleurs et plus discret — `plan-week.ts` réinjecte l'apport des créneaux verrouillés dans le cumul du jour, et `addNutrients` ne fait RIEN sur une recette inconnue : le créneau comptait ZÉRO, donc le planificateur croyait la journée vide et **surcompensait sur les créneaux suivants**. Il ne cassait pas, il visait faux. **Ce qui a été codé** : `meal_plan_entry.hors_catalogue` (migration v9) avec `CHECK (recipe_id IS NULL OR hors_catalogue IS NULL)` — le libellé EST le marqueur, pas de booléen à côté qui pourrait le contredire, et le quatrième état est inexprimable ; `MealPlanEntry.horsCatalogue` REQUIS et non optionnel, pour que le compilateur désigne les 25 sites de construction au lieu de les laisser l'omettre en silence ; `setSlotHorsCatalogue` (aucun contexte, aucun accompagnement, libellé nettoyé et refusé s'il est blanc) ; `checkCalorieFloor` saute la JOURNÉE ENTIÈRE dès qu'un de ses créneaux est hors catalogue ; `plan-week` cesse d'y réinjecter le cumul et retombe sur la part fixe du créneau ; troisième onglet « Un plat préparé » dans `choisir-plat.tsx`, et la carte de créneau qui affiche le libellé au lieu de « Aucun plat ». ⛔ **CE QUE ÇA COÛTE, ET C'EST ASSUMÉ** : sur une journée contenant un plat préparé, l'alerte de plancher calorique **ne se déclenche plus du tout**, y compris si les repas mesurables sont très légers. Verrouillé par un test qui le dit explicitement — si ce test devient gênant, c'est cette décision qu'il faut rouvrir, pas le test qu'il faut assouplir. ⚠️ **Le drapeau ne mord que sur un créneau HORS déjeuner/dîner**, et la première version des tests ne le savait pas : elle plaçait le plat préparé au dîner, où la règle d'avant (« n'évaluer que les journées dont le déjeuner ET le dîner sont remplis ») écartait déjà la journée — **les tests passaient au vert avec ET sans la garde**. Réécrits sur le goûter, ils rougissent bien à 4 sans elle |
| 52 | **Si l'écran Aujourd'hui devient une grande image, `gestesBalayage` ne peut plus être faux par défaut** | **OUVERTE, ouverte le 2026-08-03** (`RETOUR_ESSAI_TELEPHONE.md` §6.3). La demande « une interface comme tinder » est la **décision A de la session 8**, actée sur le principe et **bloquée par le contenu** (0 photo sur 241). ⚠️ **Ce que l'instruction du lot a révélé, et que personne n'avait relevé** : le balayage gauche/droite **existe déjà** (`aujourdhui.tsx:512-513`) et il est **désactivé par défaut** (`parametres.tsx:299`, réglage `gestesBalayage`). Tant que l'écran est une carte avec des flèches, un défaut à faux se défend. **Dès que l'écran devient une image qu'on balaie, le geste EST l'interface** — le laisser à faux enterrerait la fonction centrale derrière deux gestes dans les réglages, ce qui est exactement le chantier D (`RETOUR_ESSAI_TELEPHONE.md` §2 D) : « une fonction qu'il faut enseigner est une fonction mal placée ». ⚠️ **À trancher EN MÊME TEMPS que la maquette, pas après** — c'est le genre de conséquence qui se perd entre deux lots |
| ~~53~~ | **Le placement automatique ne lisait pas `Recipe.service` — 4ᵉ occurrence du défaut signature** | **TROUVÉE, TRANCHÉE et CODÉE le 2026-08-03**, en cherchant la cause de la régression du plancher (décision 34). `planWeek` filtrait ses candidats sur `typesRepas` — *à quel MOMENT de la journée* — et **jamais sur `service`** — *quel RÔLE dans le repas*. **Mesuré : 61 recettes sur 189 éligibles à un déjeuner ou un dîner ne sont pas des plats** (39 entrées, 20 accompagnements, 2 desserts), médiane ~250 kcal/portion contre **437** pour un plat. Dans la semaine nominale, 2 repas principaux sur 14 étaient une entrée (« Artichauts à la vinaigrette » en déjeuner) ou un accompagnement (« Boulgour aux légumes grillés » en dîner). ⚠️ **DÉCISION UTILISATEUR : la règle ne vaut QUE pour le placement automatique.** Chercher, parcourir, choisir une entrée comme dîner reste permis partout — le produit informe, il ne juge pas (principe 6). Ce qui est interdit, c'est que la MACHINE décide qu'une assiette d'artichauts sera le dîner de samedi. D'où le filtre dans `plan-week.ts` (`peutRemplirSeul`) et **NON dans `HardConstraints`**, qui le rendrait exprimable dans toute suggestion — miroir exact du raisonnement de l'acquis n°2 sur `requiredFoodIds`. ⚠️ **UN SEUIL D'ÉNERGIE A ÉTÉ ENVISAGÉ PUIS ÉCARTÉ** : « assez consistant pour faire un repas » se mesurerait en kcal, et un nombre qui décide qu'un plat est un vrai repas EST un jugement nutritionnel. Le service est un fait éditorial, pas une note. ⚠️ **`service: null` est ACCEPTÉ** — c'est la valeur des recettes qui remplissent un créneau seules ; le refuser viderait le vivier de tout ce qui n'est pas annoté. ⛔ **LA PREMIÈRE VERSION, DURE, A CASSÉ LA DÉCISION 37 et le banc ne l'a pas dit** : végétalien 14 j retombé de **42/42 à 32/42** créneaux remplis, « végétalien + sans gluten » de 16 trous à 33 — `plan-stress` affichant « 20/20 configurations saines » pendant ce temps (voir `reference/PIEGES.md`). **Corrigé en PRÉFÉRENCE et non en exigence** : deux passes, la seconde sans le filtre. Un créneau vide ne nourrit personne. Couverture rétablie (42/42) ; seul « végétalien + sans gluten » perd un créneau (40/56 → 39/56), effet déterministe du réordonnancement. ⚠️ **CE N'EST PAS LE CORRECTIF DU PLANCHER, et il ne faut pas le croire** : sur 20 graines, le cas nominal passe de 0/20 à **1/20** sans avertissement (min 830 → 813, médiane 1 006 → 1 023). Les plats eux-mêmes ont une médiane de 437 kcal — trois d'entre eux tiennent à peine le seuil. La cause de fond reste que le catalogue offre des PLATS quand `checkCalorieFloor` mesure une JOURNÉE (décision 45) |
| ~~54~~ | **Le plancher calorique : le planificateur pose un ACCOMPAGNEMENT en plus du plat** | **TRANCHÉE, CODÉE et MESURÉE le 2026-08-04.** C'est LE correctif du plancher de §6.5, celui que la décision 53 n'était pas. ⛔ **LA CAUSE, ET CE N'EST PAS UN BUG DE CALCUL** : `checkCalorieFloor` compare une JOURNÉE à un plancher journalier, alors que `planWeek` ne posait que des PLATS. Trois plats cuisinés ne sont pas ce qu'une personne mange dans une journée — **la comparaison n'a jamais été homogène**, depuis le premier jour. MESURÉ sur 20 graines × 7 jours (`npm run engine:plancher`) : **min 813 → 1 302 kcal, médiane 1 023 → 1 528, et 0/20 → 20/20 semaines sans aucun avertissement**. 1 528 kcal pour trois repas cuisinés reste réaliste : ce n'est pas un gonflage destiné à passer le contrôle. ⚠️ **LES DEUX PROTECTIONS SONT DISSOCIÉES POUR LA PREMIÈRE FOIS, et c'est le cœur de la règle.** L'accompagnement est EXEMPTÉ de `placedRecipeIds` (l'interdit dur du doublon) — on mange du riz plusieurs fois par semaine — mais il PASSE par l'historique de travail, donc `variety` fait décroître son score. Le riz peut revenir, il ne doit pas lasser. Mesuré sans l'historique : `7× Ratatouille` et `7× Boulgour` sur 14 créneaux ; avec : 12 accompagnements distincts sur 14 posés, 3 fois le même au maximum. ⚠️ **LE TROU ÉDITORIAL RESTE OUVERT** : rien dans le catalogue ne dit si un plat SE SUFFIT — les 144 plats portent `service: 'plat'` et rien d'autre. Le substitut est un seuil de composition partagée (`signatureOverlap` appliqué à `recipeFamilySignature`, 0,30, mesuré sur les 2 880 paires réelles : 40 refusées, aucun plat laissé sans accompagnement possible). Il coupe « Rösti + Pommes de terre sautées » (99 %), « Lentilles à la poitrine de porc + Lentilles vertes » (50 %), « Boulgour + Boulgour » (44 %) ; **il laisse passer « Sardines ET POMMES DE TERRE au four » + « Gratin dauphinois » (29 %)**, et descendre le seuil à 0,28 tuerait aussi « Cuisses de poulet rôties + Gratin dauphinois », qui est un classique. **Seul un champ éditorial sur les 144 plats tranche — pas une constante à déplacer.** ⚠️ **IMPASSE PAYÉE AU PASSAGE** : une mesure « dirigée » (`Σ min / Σ(ajouté)`) a été écrite puis RETIRÉE — les signatures étant normalisées à 1, ce n'est qu'une remise à l'échelle monotone du Jaccard, donc le même classement. Test de non-régression posé dans `signature.test.ts` pour qu'elle ne soit pas réinventée. ⚠️ **`recipeFamilySignature` A UN TROISIÈME LECTEUR**, en plus de la RÉCENCE (acquis n°4) : la question posée ici est « est-ce le MÊME produit de base ? », qui est mot pour mot la définition de `sousFamille`. Le brut ne voit PAS « Dahl de lentilles corail » + « Lentilles vertes aux carottes » (8 % contre 36 % replié). Les deux index gardent leur rôle, aucun n'est fusionné. ⚠️ **CE QUE ÇA NE RÈGLE PAS** : végétalien 14 j garde **5 avertissements** et « végétalien + sans gluten » **9** — ces régimes n'ont pas assez d'accompagnements (18 posés sur 28 attendus, 11 sur 56). Écrire du contenu d'accompagnement devient la suite directe. ✅ **LA DETTE DE `rerollSlot` EST CORRIGÉE LE MÊME JOUR (2026-08-04, demande utilisateur).** « Changer » rejoue le plat ET son accompagnement. Le garder tel quel laissait un VESTIGE : on refusait « Poulet rôti » pour tomber sur « Rösti de pommes de terre » et la purée restait à côté — pire qu'une paire bancale, une garniture qui n'avait même plus de rapport avec le plat. `pickAccompagnement` prend désormais une requête de créneau déjà construite au lieu d'un `WeekPlanRequest`, ce qui la rend appelable des deux endroits. Le créneau est RECONSTRUIT et non patché par indice : le nombre d'entrées peut passer de 2 à 1 (plus aucun plat disponible → créneau vide, JAMAIS un accompagnement orphelin qui afficherait « du riz » comme dîner) |
| ~~55~~ | **Trois lecteurs du plan supposaient encore UNE entrée par créneau** | **TROUVÉS et CORRIGÉS le 2026-08-04**, en cherchant les conséquences du mode repas (décision 54). Aucun ne plantait ; les trois MENTAIENT. C'est la signature de ce genre de changement : il ne casse pas, il désaligne. **(a) LE PLUS GRAVE — un repas GARDÉ perdait son accompagnement.** `indexLockedEntries` (`plan-week.ts`) appliquait « deux verrous sur le même créneau : le premier gagne », règle écrite quand un créneau ne portait qu'un plat. Garder un déjeuner en verrouille désormais DEUX : n'en reposer qu'un faisait disparaître l'accompagnement à chaque « Proposer une autre semaine ». **Le repas gardé changeait donc quand même — ce que §7.2 promet d'empêcher — et la journée perdait ~250 kcal en silence.** Le départage subsiste mais PAR SERVICE, et la liste est rendue dans l'ordre de `COURSE_ORDER`, le même que le `ORDER BY` de `readPlan`. Au passage : un accompagnement verrouillé n'entre PAS dans `placedRecipeIds`, sinon garder un créneau l'interdirait toute la semaine. **(b) La liste de courses titrait le créneau avec l'ACCOMPAGNEMENT.** `platParCreneau` (`courses.tsx`) se construisait par `set` en boucle : la seconde entrée écrasait la première, et le regroupement « Repas » affichait « lundi · Déjeuner — Ratatouille » au lieu du plat. **(c) DEUX notifications pour une seule assiette.** `rappelsDuPlan` (`rappel.ts`) bouclait sur `entries`. Sur une application dont l'argument est qu'elle ne harcèle personne, c'est le défaut à ne pas laisser passer. Un rappel par CRÉNEAU désormais, calé sur le plat le plus LONG — commencer à l'heure du plus court ferait servir en retard — et le texte dit qu'il y a un second plat, le taire ferait sous-estimer le travail. ⚠️ **CE QUI A ÉTÉ VÉRIFIÉ ET NE POSAIT PAS DE PROBLÈME** : `checkCalorieFloor` (somme sur les entrées, correcte), `buildShoppingList` (un `pourSlots` en double se dédoublonne à l'affichage), `aujourdhui.tsx` (ne lit pas le plan), et le `CHECK (portions > 0)` du schéma (la migration v2 l'avait déjà levé pour les créneaux vides). ⚠️ **LA LEÇON, consignée dans `reference/PIEGES.md`** : quand la FORME d'une donnée change, chercher ses lecteurs un par un — `find`, `entries.length`, `Map.set` en boucle et `ORDER BY` sans départage sont les quatre motifs qui se désalignent en silence |
| ~~56~~ | **L'avertissement de plancher disait ce qu'il ne mesure pas** | **TRANCHÉE et CODÉE le 2026-08-04.** L'écran affichait « une journée apporte moins d'énergie que la référence habituelle », puis « 830 kcal pour une référence de 1 200 kcal ». **Deux erreurs dans une phrase de dix mots.** **(a) « UNE JOURNÉE » : non — LES REPAS PRÉVUS.** `checkCalorieFloor` additionne les recettes posées au plan. Ni le pain sur la table, ni un yaourt, ni un fruit, ni un repas pris dehors — **ni le petit-déjeuner quand le plan n'a que deux créneaux, ce qui est le réglage PAR DÉFAUT de l'écran Semaine**. Annoncer à quelqu'un qu'il mange 830 kcal par jour quand on n'en sait rien est exactement l'affirmation qu'une application à garde-fous TCA ne doit pas produire (§6.5) — et c'est à un cheveu du journal alimentaire que le même §6.5 interdit. `PlanWarning` porte donc `repasComptes`, le nombre de CRÉNEAUX additionnés (un déjeuner plat + accompagnement compte pour UN repas), et l'écran écrit « 2 repas prévus, 830 kcal au total ». **(b) « RÉFÉRENCE HABITUELLE » : non — SEUIL DE VIGILANCE.** 1 200 kcal est la limite sous laquelle une alimentation devient risquée ; la référence d'une femme active de 30-49 ans tourne autour de **2 000**. Appeler 1 200 « la référence » suggérait qu'y arriver suffisait. ⚠️ **Le panneau nomme désormais ce qui N'EST PAS compté**, en une phrase sans prescription : ni « mangez plus », ni « ajoutez un plat ». On informe, on ne juge pas (principe 6). ⛔ **AMENDEMENT §6.5 D'`ARCHITECTURE.md` RÉÉCRIT AU PASSAGE, et c'était nécessaire** : il justifiait le masquage de l'alerte par « la décision 34 a mesuré 1 208 kcal minimum, ZÉRO avertissement — le cas est rare ». Ce chiffre était **une mesure sur UNE graine**, et il a été faux pendant deux jours (0/20 graines au 2026-08-03). **Le seul amendement de ce document qui retire une protection reposait donc sur une propriété que le moteur n'avait pas.** Remplacé par les chiffres mesurés et datés du 2026-08-04, y compris ce qu'ils ont d'inconfortable : le cas nominal ne déclenche plus rien (20/20), **mais végétalien 14 j rend encore 5 avertissements et « végétalien + sans gluten » 9 — ce sont les utilisateurs pour qui l'information compte le plus, et ce sont eux qui ne la verront pas** |
| ~~57~~ | **Le garde-manger dérivait en silence — daté, puis confirmé** | **TRANCHÉE et CODÉE le 2026-08-04 (décision utilisateur).** `user_pantry` disait CE QU'ON A sans dire DEPUIS QUAND, et **deux écrans en tiraient des affirmations** : Courses RETIRE de la liste ce qu'on est censé avoir (on rentre sans crème, et on ne s'en aperçoit qu'en cuisinant), « Choisir un plat » propose des recettes réalisables avec. ⛔ **C'est le grief n°1 relevé sur toutes les applications comparables** (`reference/CONCURRENCE_ET_ATTENTES.md`) : « on le remplit une semaine, puis plus jamais — et un inventaire à moitié à jour est PIRE que pas d'inventaire, parce qu'on cesse d'y croire ». **Migration v8** : colonne `declare_le`, en AJOUT, `DEFAULT ''` = date INCONNUE et non « aujourd'hui » — les lignes d'avant peuvent dater de six mois, les blanchir serait l'erreur exacte que la colonne existe pour empêcher. **Seuil 7 jours** (un cycle de courses) : en deçà on ne demande rien, au-delà on demande, et **décocher retire pour de bon** — l'ignorer pour le seul affichage en cours reposerait la même question à l'identique la fois suivante, ce qui contourne la dérive au lieu de la corriger. ⚠️ **CE N'EST PAS UN RAPPEL, ET C'EST LA LIGNE À NE PAS FRANCHIR** : §4.3 pose que le garde-manger est « facultatif et ponctuel, jamais un inventaire à tenir — l'appli ne demande rien ». La question n'est donc posée QU'AU MOMENT OÙ LA DONNÉE VA SERVIR. La déplacer vers l'accueil, une notification ou un badge ferait du produit un gestionnaire de stock. ⚠️ **Tout est coché par défaut** : faire recocher douze cases pour dire qu'on n'a rien perdu serait la corvée que la recherche décrit ; l'effort ne porte que sur ce qui a CHANGÉ. Risque assumé — quelqu'un valide sans lire — accepté parce que ne rien demander est mesurément pire. ⛔ **LES DEUX ÉCRANS SONT CÂBLÉS, MAIS PAS DE LA MÊME FAÇON, et l'asymétrie est le cœur de la décision** (2e moitié codée le 2026-08-04). Dans `choisir-plat.tsx` la question **RETIENT les résultats** : un garde-manger périmé y rend la proposition FAUSSE — la recette est infaisable, et on l'apprend devant le frigo ouvert. Dans `courses.tsx` elle **n'empêche rien** : le garde-manger ne fait jamais qu'ENLEVER des lignes, donc un garde-manger douteux **n'est simplement pas appliqué** — la liste sort ENTIÈRE, `dejaChezVous` reste vide, et un bandeau dit que rien n'a été retiré. On échoue du côté de la ligne en trop, qui se raye, plutôt que du côté de l'article manquant, qui gâche le repas. Retenir une liste de courses derrière douze cases à cocher pendant que quelqu'un est debout dans un magasin coûterait plus que les deux lignes qu'elle contient en trop. ⚠️ **Ne pas « uniformiser » les deux comportements** : ce qui les sépare n'est pas l'écran, c'est le SENS de l'erreur — l'un devient faux, l'autre seulement trop long. ⛔ **BUG TROUVÉ ET CORRIGÉ LE 2026-08-04, il vidait la migration v8 de son sens dès le DEUXIÈME aliment** : `writePantry` réécrit la table entière à chaque geste et l'écran Frigo passait la date du jour pour TOUTES les lignes — ajouter du riz ce matin redatait d'aujourd'hui une crème déclarée trois semaines plus tôt. Un geste qui ne la concernait pas la certifiait fraîche, et la question ne se reposait plus jamais. **C'est la signature du projet, dans sa variante la plus discrète** : le champ était déclaré, rempli ET lu — il contenait simplement autre chose que ce que son nom dit (« quand la ligne a été écrite », au lieu de « quand l'utilisateur a répondu de cet aliment »). Rien n'aurait planté. **Corrigé par `StoredPantryEntry.declareLe` par ligne** + `readPantryEntries`, et **la péremption se juge désormais ALIMENT PAR ALIMENT** (`alimentsAConfirmer`) : le frais reste appliqué, seul le vieux est questionné et reste sur la liste de courses. Verrouillé par test des deux côtés (`frigo.test.tsx`, `user-store.test.ts`, `courses.test.tsx`) |
| ~~59~~ | **Aucun chemin de récupération — §7 mesures 3, 4, 5 jamais codées** | **TRANCHÉE et CODÉE le 2026-08-06.** §7 ARCHITECTURE s'ouvre sur « C'est le point faible identifié de la PWA. Il doit être traité en v1, pas après », puis pose sept mesures. **1 et 6 étaient en place, 3, 4 et 5 ne l'étaient pas** : une application sans compte ni serveur n'avait **aucun** chemin de récupération — l'appareil perdu emportait tout, prix direct du principe 2. ⛔ **`app_meta.dernier_export_le` ÉTAIT DÉCLARÉ AU SCHÉMA DEPUIS LA v1 ET ÉCRIT PAR PERSONNE**, donc la mesure 4 (« invite à sauvegarder si > 14 jours ») reposait sur une colonne vide : le rappel ne pouvait pas se déclencher, et rien ne le disait. Énième occurrence du défaut maison — **fermée en branchant l'écriture ET son lecteur dans le même lot**, jamais l'une sans l'autre. **DÉCISION STRUCTURANTE : le fichier porte les OCTETS SQLITE, pas du JSON.** Une sérialisation table par table serait lisible à l'œil — vrai avantage, abandonné : `user-schema.ts` porte 24 tables et en gagne une par fonctionnalité, une liste écrite à la main serait juste le jour de son écriture puis fausse au premier ajout, et son échec serait MUET (la sauvegarde marcherait, elle oublierait une table). `sqlite3_js_db_export` ne peut pas oublier une table. ⚠️ **CE QUE ÇA COÛTE, ASSUMÉ** : le `.nutri-backup` n'est pas inspectable par qui le produit. Le jour où « exporter pour LIRE » devient un besoin distinct de « sauvegarder pour restaurer », il faudra un SECOND format — surtout pas remplacer celui-ci. ⚠️ **L'ORDRE DES TROIS TEMPS EST LA GARANTIE** : on lit le fichier, on l'ouvre dans une base JETABLE pour prouver qu'il s'ouvre et le migrer, et seulement alors on écrase. Migrer après le remplacement laisserait une migration échouer sur une base ayant DÉJÀ écrasé celle de l'utilisateur — une perte définitive causée par la fonction de restauration elle-même. ⚠️ **`readSchemaVersion` n'est PAS employée pour juger un fichier candidat** : elle bootstrappe `app_meta` quand la table manque, ce qui ferait passer n'importe quelle base SQLite étrangère pour une sauvegarde vide à la version 0, donc restaurable. On interroge `sqlite_master` d'abord. ⚠️ **Une sauvegarde d'une version PLUS RÉCENTE est refusée, pas tentée** — les migrations ne vont que vers l'avant. ⛔ **DEUX DÉFAUTS GRAVES TROUVÉS EN RELECTURE, corrigés le même jour, et tous deux étaient des pertes SILENCIEUSES** : (a) `gele` — le drapeau qui empêche une écriture différée d'atterrir par-dessus une restauration — n'était **jamais levé si l'écriture finale échouait** (quota), condamnant le reste de la session à ne plus rien enregistrer, sans bandeau et sans erreur ; on dégèle désormais, le fichier d'origine étant intact (`createWritable` ne publie qu'au `close()`). (b) `remplacerLeFichier` **ne vérifiait pas le verrou d'onglet** — voir §8. ⚠️ **Rappel des 14 jours : dans Paramètres SEULEMENT** (décision utilisateur) — pas de bandeau d'accueil, pas de notification, pas de badge. Prix assumé : qui n'ouvre jamais les réglages ne verra jamais l'invite. Et « jamais exporté » n'est pas « il y a longtemps » : l'ancienneté se compte depuis `user_profile.cree_le` à défaut d'export, sinon on réclamerait une sauvegarde devant une base vide. ⚠️ **Borne de taille ajoutée après scan de sécurité** : restaurer alloue le fichier deux fois (tas WASM + réexport), un fichier de plusieurs Go faisait tomber l'onglet avant tout refus. **Reste non traité, documenté** : un fichier au format SQLite valide mais aux pages internes corrompues peut lever un *trap* WebAssembly, qu'un `try/catch` JavaScript n'intercepte pas — l'onglet est à recharger. Mesures **2** (installation avant saisie) et **7** (quota via `storage.estimate()`) restent NON faites |
| 58 | **La liste d'aliments est FERMÉE — et rien pour en déclarer une autre** | **OUVERTE, ouverte le 2026-08-04 — MAIS RÉDUITE À SA SEULE CAUSE (3) DEPUIS LE 2026-08-05.** ✅ **Cause (1) CLOSE** (commits `a4de62e`, `7a1520a`) : `chercherParNom` remplace la sous-chaîne, mesure 7 saisies muettes sur 33 → 3. ✅ **Cause (2) CLOSE le 2026-08-05** : champ `synonymes` sur l'aliment (`foods.yaml` → table `food_synonym` → `catalog-loader` → `chercherParNom`), les 3 saisies restantes rendent leur aliment. Le build REFUSE une entrée morte (un synonyme que le nom trouve déjà — le cas `steak`), un terme revendiqué par deux aliments, et un terme vide ; le refus « `foodId` inexistant » est INEXPRIMABLE par construction, le synonyme vivant SUR l'aliment. **Portée tenue à 3 termes mesurés, pas une passe sur 450** — une liste écrite à la main et jamais relue pourrirait. ⛔ **Ce qui reste ouvert est la cause (3)** : un aliment vraiment absent du catalogue n'a toujours aucun chemin de déclaration, et c'est là qu'est l'impasse de modèle. Ne pas rouvrir (1) ni (2) en croyant traiter (3) : un synonyme ne crée jamais d'aliment, par construction. ⚠️ **SES EXEMPLES ONT PÉRIMÉ, COMME CEUX D'AVANT EUX** — ~~`coppa`~~ **est au catalogue** depuis les lots de contenu du 2026-08-04/05 (450 aliments), et `harissa` aussi. Termes réellement absents au 2026-08-05, vérifiés : `kimchi`, `wasabi`, `nduja`, `skyr`, `bresaola`, `guanciale`. **Troisième fois que les exemples de cette décision pourrissent en un jour ; ne pas les citer sans les remesurer.** ⚠️ **CAUSE (4), NOUVELLE, MESURÉE LE 2026-08-05 SUR 450 ALIMENTS — LA RECHERCHE NE SE TAIT PLUS, ELLE CLASSE MAL.** Sur 33 saisies du langage courant (liste désormais versionnée dans `tests/recherche-catalogue-reel.test.ts`, cf. plus bas), **zéro est muette** — mais **cinq rendent un FAUX AMI en premier** alors que le bon aliment est au catalogue : `sauce tomate` → « Maquereau sauce tomate » (le bon, `Concentré de tomate`, est 4ᵉ) · `fromage rape` → « Fromage blanc nature » (`Emmental râpé` 5ᵉ) · `jambon blanc` → « Jambon sec » (`Jambon à cuire` 2ᵉ) · `pate a tarte` → « Pâte d'amande » (`Pâte brisée` 3ᵉ) · `thon en boite` → « Thon albacore, cru » (`Thon, conserve au naturel` 2ᵉ). ✅ **Les cinq bons aliments restent dans les 6 affichés** — l'aliment est donc TROUVABLE, ce n'est pas une régression de disponibilité. ⚠️ **ATTRIBUTION CORRIGÉE LE 2026-08-05, LE MÊME JOUR** — ~~la cause mécanique est le tri par longueur de mot, pour les cinq~~. **FAUX, et vérifié nom par nom : ce défaut n'explique QU'UN cas sur cinq.** Le tri secondaire additionne la LONGUEUR des mots appariés en affirmant « un mot long est plus discriminant qu'un mot court » ; c'est faux sur `fromage rape`, où « fromage » (7) bat « râpé » (4) alors que « fromage » est le mot le MOINS discriminant d'un rayon laitier. Ce qui discrimine est la RARETÉ, pas la longueur — **mais cette correction ne redresserait que `fromage rape`**. ⛔ **LES TROIS AUTRES NE SONT PAS UN DÉFAUT DE CLASSEMENT, C'EST LA CAUSE (2) QUI N'EST PAS FINIE.** Vérifié : **aucun nom du catalogue ne contient « tarte », « boîte » ni « jambon blanc »**. Donc tous les candidats apparient le MÊME mot unique (`jambon`, `pate`, `thon`) — rang, poids et position identiques — et le départage tombe sur la longueur du nom, faute de quoi que ce soit d'autre à comparer. Aucune pondération n'y change rien : il n'y a rien à pondérer. Il manque un NOM D'USAGE : `jambon blanc` → `jambon_blanc` (dont le nom éditorial est « Jambon à cuire » — l'id et le nom ont divergé), `thon en boîte` → « Thon, conserve au naturel ». ⚠️ **`pâte à tarte` N'EST PAS UN SYNONYME ET LE BUILD LE REFUSERAIT** : le terme désignerait à la fois `Pâte brisée`, `Pâte feuilletée` et `Pâte filo` — or le build REFUSE un terme revendiqué par deux aliments. C'est un GÉNÉRIQUE, pas un alias, et le catalogue n'a aucune notion de générique. Cinquième cas, `sauce tomate` : « Maquereau sauce tomate » contient littéralement la saisie, donc le rang sous-chaîne fait exactement son travail — le vrai manque est le produit « sauce tomate », soit la cause (3). ⛔ **CONCLUSION DE L'ARBITRAGE : NE PAS TOUCHER AU CLASSEMENT.** 1 cas sur 5, contre 2 réparables par un synonyme (mécanisme déjà en place, testé, sans garde-fou traversé) ; et repondérer rebat TOUTES les saisies d'un classement déjà cassé une fois. Si on y revient un jour : pondération par rareté, en lot SÉPARÉ, avec remesure avant/après des 33 saisies désormais versionnées. ⚠️ **`maquereau_tomate` est entré au catalogue le 2026-08-05** : c'est l'agrandissement du catalogue qui a créé ce faux ami, pas la recherche. Le mécanisme se reproduira à chaque lot de contenu. ✅ **CAUSE (4) NEUTRALISÉE AUTREMENT LE 2026-08-05 — PAR LE PARCOURS, PAS PAR LE CLASSEMENT.** Mesure préalable : **352 aliments sur 450 étaient INJOIGNABLES** sans deviner le mot exact. `chercherParNom` n'en rend que 6, et l'« Ajout rapide » de `frigo.tsx` — seul parcours existant — cumule deux filtres qui le rendaient inopérant : `famillesDeRaccourcis` **écarte tout aliment qu'aucune recette n'utilise** (250 à lui seul, `if usage === 0 continue`) puis coupe à **8 par famille**, soit **98 atteignables**. ⚠️ **ET LE TRI ÉTAIT À L'ENVERS DU BESOIN** : les 250 écartés sont les plus RÉCENTS, donc les moins connus, donc précisément ceux qu'on cherche sans savoir les nommer — `coppa`, `harissa` et `saucisse_toulouse` en faisaient partie. Ironie utile : `saucisse_toulouse` venait de recevoir le synonyme « chipolata » pour être TAPÉ, sans pouvoir être TROUVÉ. **Correctif : `ui/parcours-aliments.tsx`**, fenêtre `Panneau` partagée par les trois écrans (frigo, courses, éditeur), familles dérivées du catalogue, **tous** les aliments, alphabétique par famille. `AjoutRapide` RESTE — « les 8 les plus utilisés » et « tout voir » sont deux gestes, pas une version dégradée l'un de l'autre. ⚠️ **LA NOTE DE FIN DE FENÊTRE EST UN GARDE-FOU, PAS UN ORNEMENT** : elle dit que l'aliment manque et **dissuade explicitement d'en prendre un voisin**, parce que c'est la piste (b) — cocher un cousin applique LES ALLERGÈNES DU COUSIN, et `user_pantry.food_id` ne garde aucune trace de l'à-peu-près. Verrouillé par `app/src/ui/parcours-aliments.test.tsx`, sur le VRAI catalogue : les 450 sont atteignables sans taper un caractère. ⚠️ **Test vérifié PAR RÉGRESSION VOLONTAIRE** — en réintroduisant `.slice(0, 8)` il passe au rouge (344 aliments manquants, `coppa` injoignable, 106 au lieu de 450) ; il ne peut donc pas être vert pour de mauvaises raisons. ✅ **CAUSE (3) FERMÉE le 2026-08-05 en « NON CORRIGÉE, ASSUMÉE, DOCUMENTÉE »** — pas résolue, close. ⚠️ **LA PISTE (c) ÉTAIT DÉJÀ LIVRÉE, ce qui ne s'était vu de personne** : `shopping_extra_item` (`libelle TEXT NOT NULL`, aucun `food_id`) accepte n'importe quel texte depuis toujours, et l'écran Courses l'annonce — « Lessive, pain, croquettes… ». Qui a de la nduja peut déjà l'écrire sur sa liste. ⛔ **ET L'ÉTENDRE AU GARDE-MANGER SERAIT INERTE** : `user_pantry` est indexé par `food_id`, et ses deux seuls consommateurs rejetteraient un texte libre — `searchByPantry` pondère par la MASSE (sans grammes, rien à faire), et `shopping-list.ts` apparie par IDENTIFIANT (`const deja = new Set(opts.pantryFoodIds)`). Le faire par correspondance textuelle est explicitement refusé par l'en-tête de `courses.tsx`. Il ne reste donc que (a) et (b), qui traversent tous deux §5.2. **Ce qu'on offre honnêtement est en place** : 450 aliments parcourables sans taper un mot, la note qui dit que l'aliment manque et pourquoi ne pas prendre un voisin, et la liste de courses en texte libre. Le reste — proposer des recettes à partir d'un aliment inconnu — est hors de portée PAR CONSTRUCTION : sans allergènes ni masse, le moteur ne peut rien en faire sans mentir. ⚠️ **ET GROSSIR LE CATALOGUE NE LA ROUVRE PAS, MESURÉ** : sur les 6 termes vérifiés absents, **5 sont absents du Ciqual lui-même** (`kimchi`, `wasabi`, `nduja`, `skyr`, `guanciale` ; seul `bresaola` y figure). Le plafond n'est pas notre catalogue, c'est la table source. ⛔ **« POURQUOI NE PAS IMPORTER TOUT LE CIQUAL ? » — QUESTION POSÉE ET TRANCHÉE LE 2026-08-05, NE PAS LA REPOSER SANS LIRE CECI.** La table fait **3 484 aliments** contre nos 450. Trois raisons de ne pas tout prendre, par ordre de force : **(1) LES ALLERGÈNES, ET C'EST UNE RAISON DE SÉCURITÉ, PAS DE QUALITÉ.** Le Ciqual donne la COMPOSITION, jamais les allergènes — nos 450 les portent parce qu'ils ont été annotés À LA MAIN. Importer 3 034 aliments de plus mettrait au catalogue 3 000+ entrées que le filtre §5.2 tiendrait pour SANS ALLERGÈNE, donc sûres. Le garde-fou ne serait pas contourné, il serait vidé. Idem pour `origine_animale`/`derive_de` (filtre végétarien), `saison_mois`, `poids_piece_g`, `fond_de_placard`, `conditionnement_g` — aucun n'est dans le Ciqual. **(2) LE CIQUAL N'EST PAS UN CATALOGUE DE COURSES** : 407 « entrées et plats composés » (sandwichs, pizzas, croque-monsieur), 325 boissons, 39 aliments infantiles, 30 glaces. Et dans les groupes d'ingrédients, les entrées se multiplient par ÉTAT DE PRÉPARATION — 7 lignes de canard, 30+ de jambon pour ce qu'un client appelle « du canard » et « du jambon ». Le groupe « viandes » du parcours passerait de 46 à ~791 entrées, dont la plupart ne s'achètent pas. **(3) LA RECHERCHE EMPIRERAIT** : un corpus plus dense fabrique plus de faux amis, c'est mesuré — `sauce tomate` → « Maquereau sauce tomate » est né de l'agrandissement du catalogue, pas d'un défaut de la recherche. ✅ **CE QUI RESTE VRAI DANS L'IDÉE** : élargir par LOTS CIBLÉS d'ingrédients bruts reste utile, et la classe de défaut trouvée par l'audit (`jambon_blanc`, `canard_magret`) DISPARAÎTRAIT si l'identifiant dérivait du nom Ciqual au lieu d'être écrit à part — l'id et la ligne ne pourraient plus se contredire. Mais c'est un changement de convention d'identifiants, pas un import de masse. ✅ **`thon en boîte` RÉGLÉ le 2026-08-05 par un synonyme**, pas par le classement : aucun nom ne contient « boîte » (le catalogue dit « conserve »), donc `thon_conserve` et `thon_frais` n'appariaient que « thon » et se départageaient sur la longueur du nom. Un nom d'usage suffisait. Reste donc 3 faux amis sur 33, dont 2 seulement relèvent du classement. ⛔ **DÉFAUT DE CONTENU DÉCOUVERT EN VOULANT POSER LE SYNONYME `jambon blanc` — NON CORRIGÉ, IL DEMANDE UN LOT DE CONTENU.** `jambon_blanc` porte le code Ciqual **28700 = « Jambon de porc à cuire ou jambon à rôtir/cuire au four »**, c'est-à-dire un **rôti CRU**. Son nom éditorial « Jambon à cuire » transcrit fidèlement le Ciqual ; **c'est l'IDENTIFIANT qui ment**. Le jambon blanc est **28900 « Jambon cuit, supérieur »** ou **28925 « Jambon cuit, de Paris, découenné dégraissé »**, et **aucun des deux n'est au catalogue**. ⚠️ **CINQ RECETTES UTILISENT `jambon_blanc` EN VOULANT DU JAMBON CUIT** : `endives-jambon-gratin`, `galettes-sarrasin-jambon`, `gratin-pates-jambon`, `riz-cantonais`, `salade-melon-jambon`. Elles portent donc les valeurs d'un rôti cru. ⛔ **NE PAS « CORRIGER » EN POSANT LE SYNONYME** : il désignerait le mauvais produit et fabriquerait exactement le faux ami qu'on cherche à supprimer. ✅ **CORRIGÉ le 2026-08-05, ET BIEN PLUS SIMPLEMENT QUE PRÉVU.** ~~Le correctif est d'ajouter un aliment `jambon_cuit`, de rebrancher les cinq recettes et d'arbitrer `salade-melon-jambon`~~ — **proposition surdimensionnée**. La lecture des cinq recettes a tranché toute seule : les cinq disent « jambon » sans qualificatif, en tranches ou en dés, y compris le melon. Aucune ne veut de rôti cru, **aucune ne demandait d'arbitrage**. Il suffisait donc de repointer le mapping — `jambon_blanc: 28700 → 28900` — exactement comme `canard_magret` : **zéro recette modifiée**, l'identifiant disait « blanc » depuis le début, c'est le mapping qui mentait. Nom éditorial « Jambon cuit », synonyme « jambon blanc ». **28925 (« de Paris ») écarté** : le Ciqual n'y donne AUCUN sodium, or c'est la valeur qui compte le plus sur une charcuterie. Écarts mesurés : 163 → 113 kcal, **lipides 9 → 2,83 g (÷ 3,2)** ; le sodium, lui, bouge à peine (870 → 788) — l'hypothèse « c'est le sel qui diffère » était fausse. ⚠️ **BALAYAGE SYSTÉMATIQUE DES 450 MAPPINGS, 2026-08-05** (`catalog/audit-mapping.mjs`) : `jambon_blanc` avait été trouvé par ACCIDENT, d'où l'audit. **10 candidats, 2 vrais défauts.** Second défaut, **CORRIGÉ** : `canard_magret` pointait sur **36201 « Canard, viande crue »** — du canard MAIGRE — au lieu de **36206 « Canard, magret cru »**. **127 → 337 kcal (+ 165 %), lipides 5,95 → 29,4 g (× 4,9)**, sur deux recettes dont `magret-canard-miel`. Repointé, `--write` relancé (diff contenu au seul magret), verrouillé par un test dans `catalog/build.test.ts`. `moutarde_dijon` : le Ciqual n'a AUCUNE entrée Dijon, 11013 « Moutarde » est le seul choix — rien à corriger. Les 7 restants sont des faux positifs. ⛔ **L'AUDIT NE PEUT PAS DEVENIR UN TEST** : `documents Ciqual/` est gitignoré, il n'est rejouable que par qui a l'export XML en local. **À relancer à la main après chaque lot de contenu.** ⚠️ **SOUS-PRODUIT QUI CORRIGE UNE AFFIRMATION DE CETTE FICHE** : j'avais écrit qu'aucun signal ne permettrait jamais de remplir la liste de synonymes, faute de télémétrie. **Inexact.** Les identifiants du mapping sont un vocabulaire COURANT écrit par un humain, et ils divergent des noms Ciqual là où les utilisateurs divergent. L'audit a ainsi rendu quatre échecs **mesurés** : « maïzena » et « magret » ne rendaient RIEN, « crème liquide » rendait de la crème de marron, « thon frais » rendait une **fraise** (« frais » → « frai », et « Fraise » commence par « frai »). Trois réglés par un synonyme ; **« magret » réglé par la DONNÉE** — corriger le mapping a réparé la recherche par ricochet, et un synonyme « magret » serait désormais refusé comme entrée morte. **Leçon : vérifier la donnée AVANT de poser un synonyme, sinon on recouvre l'erreur au lieu de la corriger.** **Historique du diagnostic ci-dessous, conservé parce qu'il explique le prix de chaque cause.** `user_pantry.food_id` référence obligatoirement un aliment du catalogue, et l'autocomplétion de l'écran Frigo y cherche. ~~**MESURÉ : `chorizo`, `lardon` et `noix de coco` en sont absents — quelqu'un qui a des lardons n'a AUCUN geste pour le dire.**~~ ⛔ **CETTE MESURE EST FAUSSE DEPUIS LE JOUR MÊME — REMESURÉE LE 2026-08-04 SUR 383 ALIMENTS** (le catalogue est passé de 200 à 383 dans la journée). `chorizo` **est au catalogue** ; la noix de coco y est **trois fois** (`lait_coco`, `noix_coco_rapee`, `huile_coco`). Et `lardon` — le seul exemple qui tienne encore — **ne manque PAS au catalogue** : `porc_poitrine` (« Porc, poitrine crue ») y est, écarté sous le nom « lardons » faute d'entrée Ciqual propre (`ciqual-mapping.yaml`). **Ce qui échoue n'est donc pas la liste, c'est la RECHERCHE.** ⚠️ **LE DIAGNOSTIC CHANGE, ET AVEC LUI LE PRIX DE LA CORRECTION.** Mesure reproductible (filtre de `frigo.tsx:398`, sous-chaîne sur le nom éditorial, `normaliser` d'`engine/search`) sur 33 saisies du langage courant : **7 ne rendent aucun résultat, et 4 d'entre elles désignent un aliment QUI EST AU CATALOGUE** — `lardon` → « Porc, poitrine crue », `gambas` → « Crevette, crue », `chipolata` → « Saucisse de Toulouse, crue », `noix de saint-jacques` → « Coquille Saint-Jacques, crue ». Les 14 aliments de contrôle passent tous. **Trois causes distinctes, trois correctifs de coûts sans rapport, à ne pas confondre** : **(1) la recherche compare des SOUS-CHAÎNES**, donc une saisie plus longue que le nom échoue (« noix de saint-jacques » ne trouve pas « Coquille Saint-Jacques ») et un pluriel aussi (« tomates » ne trouve pas « Tomate ») — correctif dans UN fichier, aucun schéma, **et il ne touche aucun garde-fou** ; **(2) les noms commerciaux n'existent nulle part** (lardon, gambas, chipolata) — demande un champ de synonymes, donc schéma + build + contenu, mais **PAS la §5.2** : l'aliment porte déjà ses allergènes, on ne fait que le nommer autrement ; **(3) l'aliment est vraiment absent** (`coppa`, `sauce tomate`) — et c'est là, et là seulement, qu'on est dans l'impasse de modèle décrite ci-dessous. ⚠️ **(1) et (2) étaient invisibles tant que le trou était attribué au catalogue.** Grossir `foods.yaml` ne les corrige NI l'un NI l'autre. C'est le reproche fait à SuperCook mot pour mot (`reference/CONCURRENCE_ET_ATTENTES.md` §3), à ceci près qu'ils ont des milliers d'aliments et nous 383 : le mur est le même, beaucoup plus près. ⛔ **CE N'EST PAS UN MANQUE DE CONTENU MAIS UNE IMPASSE DE MODÈLE, et la nuance décide de la correction.** Allonger `foods.yaml` repousse le mur — **chantier en cours côté utilisateur** — mais aucun catalogue fini ne le supprime : il n'existe aucun chemin pour déclarer un aliment que l'éditeur n'a pas prévu. ⚠️ **Le trou est d'autant MOINS visible que le catalogue grossit**, ce qui en fait un défaut qui se découvre tard, chez l'utilisateur. Pistes non tranchées : (a) accepter du texte libre au garde-manger, non rattaché à un `FoodId` — mais `searchByPantry` pondère par la MASSE et ne saurait rien en faire, et un aliment sans allergène connu traverserait le filtre de §5.2 ; (b) le rattacher au plus proche par sous-famille, ce qui **invente une donnée nutritionnelle** ; (c) l'accepter en ne servant QUE la liste de courses, jamais la recherche de recettes. ⚠️ **(a) et (b) touchent un garde-fou de sécurité — à ne pas coder au fil de l'eau** |
| ~~60~~ | **`food_ids` « écrit à la main » repose sur une prémisse périmée** | ✅ **FERMÉE le 2026-08-07 — le lien est DÉRIVÉ au build, aucune annotation n'a été saisie.** 93,7 % des 1 350 gestes couverts (`catalog/lien-etape-ingredient.mjs`, remesurable). Les deux questions posées ci-dessous ont été tranchées par la mesure et non par l'usage : (1) le panneau suffisait, mais la quantité SOUS l'étape fait mieux pour zéro travail de contenu ; (2) le pré-remplissage a été mesuré avant tout instrument, comme exigé — et il a rendu l'instrument inutile. ⛔ **CE QUI SURVIT ET NE DOIT PAS ÊTRE DÉFAIT : la table AJOUTE, elle ne FILTRE JAMAIS.** Filtrer afficherait une liste vide sur une étape sur seize et cacherait 5 % des ingrédients. Historique de la réouverture ci-dessous, conservé parce qu'il explique ce qui a été cru. — **ROUVERTE le 2026-08-06.** La décision 8 (2026-08-04) a posé le lien étape → ingrédient comme **écrit à la main, pas dérivé**, en le justifiant ainsi : *« la dérivation par rapprochement de texte a été envisagée et écartée : `food` n'a ni synonyme ni alias »*. ⛔ **CETTE PRÉMISSE EST FAUSSE DEPUIS LE 2026-08-05** : `food.synonymes` a été ajouté par la décision 58, LE LENDEMAIN, dans une piste parallèle — et personne n'est revenu relire ce qu'elle portait. C'est le prix des trois pistes simultanées, déjà signalé dans la fiche de reprise. ⚠️ **SECOND DÉFAUT, INDÉPENDANT DU PREMIER** : le tableau de §2.1 (`CONCEPTION_MODE_CUISINE.md`) mesure le rapprochement **contre les 450 aliments du catalogue**, alors que le problème réel est **fermé** — choisir un sous-ensemble parmi les **7,1 ingrédients de LA recette**. Remise dans ce cadre, sa propre démonstration s'effondre sur 3 cas sur 4 : « les poivrons » n'a qu'un candidat en `poivron_*` ; « l'huile » n'est ambigu que si la recette porte deux huiles, ce qui **se détecte** ; « les tomates en dés » marchait déjà. Seul « saler » résiste, et il demande une table verbe → aliment d'une douzaine d'entrées (saler → sel, poivrer → poivre, beurrer → beurre…). ⚠️ **CE QUI RESTE VRAI ET N'EST PAS BALAYÉ** : un rapprochement à moitié juste produit un écran qui **ment par omission** — on appuie sur « poivrons », rien ne s'affiche, et rien ne distingue un trou de données d'une absence de quantité. Cela impose de **ne jamais poser un lien dont la machine n'est pas certaine**, ce qui n'est PAS la même chose que faire confirmer les 1 101 à la main. ✅ **CE QUI A ÉTÉ FAIT À LA PLACE LE 2026-08-06, ET QUI DÉSAMORCE L'URGENCE** : l'écran de cuisine affiche désormais **tous** les ingrédients avec leurs quantités mises à l'échelle (fenêtre `Panneau`, schéma **v11** pour les portions). Le besoin réel — « c'était combien d'ail ? » — est couvert **sans une seule annotation**, avec une donnée qui était déjà chargée dans l'écran. Le lien ne servirait plus qu'à n'afficher QUE les ingrédients de l'étape courante : un raffinement de confort, plus un prérequis. ▶ **À TRANCHER, DANS CET ORDRE** : (1) le panneau suffit-il à l'usage réel ? — **à répondre après s'en être servi en cuisinant, pas avant** ; (2) si non, mesurer d'abord le pré-remplissage automatique sur les 1 101 gestes, en trois piles (certain / ambigu / rien trouvé), **avant** de choisir un instrument d'annotation. ⛔ **Ne pas rouvrir §2.4 (les trois passes) ni construire d'atelier sans cette mesure** : elle décide de l'ergonomie autant que du volume, et les deux estimations de coût faites sans elle (≈ 2-3 h contre ≈ 6-9 h) n'étaient que des intuitions. |
| ~~61~~ | **L'écran Recettes rend TOUT le catalogue dans le DOM — le coût de montage croît avec lui** | ✅ **FERMÉE le 2026-08-08 — issue (c), ON NE VIRTUALISE PAS. Mesurée sur appareil, tranchée par la table de seuil écrite AVANT la mesure.** Trois points, trois bundles servis sur trois ports (`npm run mesure:61`), relevés dans le même passage sur le téléphone de l'utilisateur : **305 recettes → montage 73 ms · 500 → 136 ms · 1 000 → 210 ms**. ⚠️ **LE CHIFFRE QUI DÉCIDE N'EST PAS LE TEMPS, C'EST LE COÛT MARGINAL** : 0,323 ms par recette entre 305 et 500, **0,148 ms entre 500 et 1 000**. Il est DIVISÉ PAR DEUX quand le catalogue double — la croissance est **sous-linéaire**, pas seulement « pas sur-linéaire ». Tripler le catalogue multiplie le montage par 2,9. **Les deux moitiés du seuil sont donc satisfaites** : `73 ms < 200 ms` sur le point à 305 → (c) ; pente non sur-linéaire → la clause « (a) quel que soit le point à 305 » n'est pas déclenchée. ⚠️ **CE QUE LA FERMETURE PRÉSERVE, ET C'ÉTAIT LE VRAI ENJEU** : virtualiser aurait imposé de réécrire les assertions du garde-fou allergène contre `browseRecipes` — la vérification aurait cessé de porter sur ce que l'ÉCRAN affiche. **Elle reste sur la liste rendue en entier, sans compromis.** ⚠️ **À 1 000 recettes, 210 ms tomberait dans la bande « fermée mais à rouvrir au prochain palier de contenu »** — ce n'est PAS le seuil applicable (il porte sur le point à 305), mais c'est l'ordre de grandeur à connaître : il faudrait **tripler** le catalogue pour revenir dans la zone de discussion. ⛔ **NE PAS ROUVRIR CETTE DÉCISION SUR UNE IMPRESSION.** Elle a déjà été rouverte une fois sur un chiffre de harnais de test pris pour un coût de rendu ; elle se rouvre sur un relevé d'appareil, avec les trois points, ou pas du tout. ⚠️ **LES TEMPS DE `rendu` FILTRÉS SONT TROP BRUITÉS POUR PORTER QUOI QUE CE SOIT et n'ont RIEN décidé** : à 500 recettes, 67 cartes coûtent 44 ms (0,66 ms/carte) et 412 cartes en coûtent 28 (0,07 ms/carte), un facteur 10. La table nommait le montage ; c'est le montage qui a tranché. ✅ **EFFET DE BORD DU RELEVÉ, consigné en §8 et hors 61** : à 305 cartes, `rendu 116 ms` dépassait `montage 73 ms`, ce qui est géométriquement impossible pour une même passe. L'ordre est correct à 500 (106 < 136) et à 1 000 (163 < 210), donc l'outil est sain et le constat isolé. ⛔ **NE PAS EN FAIRE UN LOT — RELU LE 2026-08-10, CE CONSTAT NE TIENT PAS DEBOUT TOUT SEUL.** Il repose sur les temps de `rendu`, que cette même ligne déclare deux phrases plus haut **trop bruités pour porter quoi que ce soit** (facteur 10 entre deux points du même relevé). On ne peut pas écarter un nombre pour décider et le reprendre pour accuser. **Ce qu'on sait : un chiffre bizarre sur un instrument qu'on a nous-mêmes déclaré inexploitable. Ce qu'on ne sait pas : s'il y a un re-rendu.** Le seul geste qui trancherait est un relevé Profiler **sur appareil**, dans le même passage que le chrono de `#/recettes` — pas une relecture de code, et surtout pas une mesure jsdom, qui a déjà fait conclure faux une fois ici même. Historique de la question, conservé — ⛔ **CE QUI ÉTAIT ÉCRIT ICI, ET QUI ÉTAIT FAUX** : « la prémisse est confirmée, à trois points au lieu d'un : montage à 305 / 220 / 126 cartes = 1 098 / 812 / 455 ms, soit 3,60 ms par carte… le temps de montage EST le rendu des cartes, il n'y a aucun coût fixe ailleurs ». **La pente existe. Elle ne mesure pas un rendu.** Décomposé sur le même écran monté (305 cartes, 2 104 nœuds) : **Profiler React → 83 ms pour 2 commits** ; `getByRole('heading', { name })` → **480 ms PAR APPEL** ; `getByText` → 79 ms ; `querySelector('h1')` → **0,1 ms** ; montage bout en bout 1 294 ms ; 305 `<li>` nues de structure équivalente 68 ms ; `chargerSocle`/`createEngine`/`loadCatalog` → 34/5/19 ms. **Une carte coûte 83/305 = 0,27 ms à rendre**, exactement le plancher de jsdom mesuré à part (0,28). Les 3,60 ms mesuraient la croissance de `getByRole` AVEC FILTRE DE NOM — il recalcule le nom accessible de chaque élément du document, et `findBy*` sonde au moins deux fois. ⛔ **C'EST UNE PROPRIÉTÉ DU HARNAIS DE TEST : elle n'existe pas dans un navigateur**, personne n'exécute de requête accessible en naviguant. ⚠️ **DONC L'EXTRAPOLATION « à 500 recettes la question se posera sur un téléphone » S'APPUYAIT SUR UN NOMBRE QUI N'A JAMAIS DÉCRIT UN TÉLÉPHONE.** La mesure sur appareil reste due ; la présomption de gêne qu'elle devait confirmer, non. ✅ **ET LE SEUL COÛT RÉELLEMENT MESURÉ — LA SUITE — EST RÉPARÉ** : le helper de montage de `recettes.test.tsx` appelait `findByRole('heading')` 23 fois ; remplacé par une attente à `querySelector('h1')`, le fichier passe de **32,1 s à 12,4 s** en isolé et la suite entière de **46,3 s à ~30 s**. Même correctif sur `courses.test.tsx` et `parametres.test.tsx`. ⚠️ **AUCUNE COUVERTURE ÉCHANGÉE CONTRE DU TEMPS** : cette attente ne vérifiait rien (elle attendait la fin de la phase `chargement`) ; les assertions qui portent le garde-fou allergène continuent d'interroger la liste RENDUE EN ENTIER. ⛔ **ET UNE HYPOTHÈSE CONCURRENTE EST RÉFUTÉE, PAS ÉCARTÉE AU JUGÉ** : les 7 requêtes moteur que `comptes` refait à chaque rendu (`recettes.tsx:183-197`) coûtent **4,1 ms au total — 0,4 % du montage**. Elles ne sont pour rien dans le problème, et ça clôt du même coup la ligne de dette §8 « les compteurs de pastilles coûtent une requête par facette ». ⚠️ **CE QUE LA MESURE NE DIT PAS, ET C'EST LE CŒUR** : ces millisecondes sont du **jsdom**, qui ne fait **ni mise en page ni peinture** — exactement ce qu'un téléphone paie. Elles ne se transposent ni en pire ni en mieux. Ce qui se transpose : la linéarité, et **6,9 nœuds DOM par carte** (2 104 pour 305). ⛔ **ET CE CHIFFRE-LÀ DÉSAMORCE L'INQUIÉTUDE QUE CETTE LIGNE PORTAIT** : « à 500 recettes la question se pose sur un téléphone » donne **~3 450 nœuds**, ce qui n'est pas un DOM lourd — les navigateurs mobiles en tiennent plusieurs dizaines de milliers. **L'ordre de grandeur redouté n'est pas au rendez-vous**, et c'est une raison de ne PAS virtualiser, pas une raison de se rassurer. ⚠️ **PIÈGE DANS L'ISSUE (a), à ne pas scinder** : réécrire les assertions de garde-fou contre `browseRecipes` **avant** de virtualiser retirerait une garantie sans rien gagner. Le test actuel vérifie que l'ÉCRAN n'affiche pas ce que le moteur a exclu — il attrape un bug d'écran ; interroger le moteur ne l'attraperait plus. Les deux moitiés de (a) vont ensemble ou pas du tout. ✅ **LE QUATRIÈME ARBITRAGE EST FERMÉ le 2026-08-08, ET SANS TOUCHER AU CATALOGUE DE TEST.** Il disait : « la suite paie ce montage 25 fois dans le seul `recettes.test.tsx` — 28 s sur 46 s ; le régler en réduisant le catalogue de test casserait la propriété *vérifié contre le catalogue RÉEL* sur laquelle le garde-fou allergène repose ». **Le chiffre était juste, l'alternative posée était fausse** : il n'a jamais fallu choisir entre la vitesse et le catalogue réel, parce que le coût n'était pas dans le catalogue. 23 `findByRole('heading', { name })` à ~960 ms l'unité, remplacés par une attente à 0,1 ms — le catalogue de test n'a pas bougé d'une recette, le garde-fou asserte toujours sur la liste entière. ▶ **CE QUI RESTE À FAIRE, ET C'EST OUTILLÉ DEPUIS LE 2026-08-08** : la piste **(c)** est retenue — ne rien virtualiser — mais **(c) EXIGE UNE MESURE SUR APPAREIL**. ✅ **Le protocole est écrit et le SEUIL EST FIXÉ À L'AVANCE** (`RETOUR_ESSAI_TELEPHONE.md` §0) : < 200 ms → (c), fermée · 200-500 ms → (c) mais à rouvrir au prochain palier de contenu · > 500 ms → (a). ⚠️ **Le seuil est posé AVANT la mesure exprès** : c'est ce qui empêche de lire après coup n'importe quel chiffre dans le sens qu'on préfère — et cette décision-ci vient précisément de payer une interprétation d'après-coup. ⚠️ **TROIS POINTS, PAS UN** (305 / 500 / 1 000) : la 61 porte sur la CROISSANCE, un point unique n'a pas de pente. Une pente franchement sur-linéaire vaut (a) quel que soit le point à 305. Outillage : **`npm run mesure:61`** construit les trois bundles et les sert sur **trois ports** ; `ui/mesure-montage.tsx` affiche `montage N ms · rendu R ms · M cartes` derrière `?perf` **dans `location.search`** — ⛔ pas dans le hash, `#/recettes?perf` retombe sur « Aujourd'hui » par correspondance exacte. **Zéro dépendance** — pas de Playwright, contrairement au lot C d'accessibilité. ⛔ **TROIS PORTS, ET CE N'EST PAS DU CONFORT — LE PROTOCOLE PRÉCÉDENT AURAIT PRODUIT UN FAUX RÉSULTAT.** Il disait de gonfler puis de reconstruire le bundle entre chaque relevé ; le service worker ne faisant jamais `skipWaiting()` et n'étant enregistré avec aucun rappel de mise à jour (voir §8, « une mise à jour n'atteint l'utilisateur qu'après fermeture complète »), **recharger l'onglet ne remplace pas le worker en attente** : les trois relevés auraient lu le même `catalog.db` de 305 recettes depuis le même cache, donc une **pente plate**, qui se serait lue « aucune croissance, donc (c) ». Trois ports = trois origines = trois enregistrements étanches. ⚠️ **`M cartes` est la vérification, pas une décoration** : si le nombre affiché ne correspond pas au port, le relevé ne compte pas. ✅ **DEUX TEMPS DEPUIS LE 2026-08-08, et le second est le plus propre des deux** : `montage` inclut le chargement du catalogue et ne se reprend jamais ; **`rendu` est repris à CHAQUE passe**, donc à chaque changement de filtre — or filtrer reconstruit la liste entière **sans recharger le catalogue**, ce qui isole exactement la variable de cette décision, le coût du DOM. ⛔ **CE N'EST PAS UN CONFORT, ÇA CORRIGE UN AFFICHAGE TROMPEUR** : l'encadré gardait jusque-là le temps de MONTAGE en affichant le NOUVEAU compte de cartes après un filtrage — deux nombres qui ne décrivaient plus la même chose, et rien ne le signalait. ⚠️ **`rendu` NE REMPLACE PAS `montage` DANS LA TABLE DE SEUIL** : le seuil porte sur le temps d'apparition de la liste, qui est ce que l'utilisateur attend. Un second éclairage, pas une porte de sortie plus commode. ⚠️ **`adb` n'est PAS requis pour ce relevé-ci** — le rendu ne demande aucun contexte sécurisé ; il ne l'est que pour les relevés 2 et 3 (`wakeLock`, OPFS), et le protocole faisait jusqu'ici dépendre les trois d'un outil dont deux seulement ont besoin. ⛔ **NE PAS FERMER CETTE DÉCISION SUR LA MESURE jsdom CI-DESSUS** : ce serait exactement l'erreur que sa dernière ligne interdit, sous une autre forme. Historique, conservé : **OUVERTE, ouverte le 2026-08-06**, trouvée en cherchant pourquoi `main` était rouge par intermittence. ⚠️ **CE N'ÉTAIT PAS UN TEST LENT, C'ÉTAIT DE LA CONTENTION, et la distinction décide de tout.** Le budget de Vitest est du temps d'**horloge**, pas du temps CPU : 85 fichiers tournent en parallèle, et un test qui demande 1,4 s de calcul peut mettre plus de 5 s à les obtenir quand tous les cœurs sont pris. Le rouge se **déplaçait d'un fichier à l'autre** — 0, 1 ou 2 échecs sur le MÊME commit, jamais reproductible seul. Délai porté à 15 s (`vitest.config.ts`, commit `54599c5`). ⛔ **CE DÉLAI N'EST PAS LE CORRECTIF DE LA CAUSE, et le lire ainsi referme la décision pour rien.** ⛔ **LA CAUSE : `recettes.tsx` NE PAGINE NI NE VIRTUALISE** — il ne tronque jamais `trouvees`. Monter l'écran rend donc autant de cartes que le catalogue compte de recettes. **Mesuré : 1 453 ms en exécution isolée pour un test qui vérifie la présence d'un libellé**, sur un catalogue passé de **241 à 282 recettes le 2026-08-06** (+17 % d'un coup). Le coût est **linéaire en taille de catalogue**, et le catalogue est un chantier explicitement en cours (§8.2, photos, lexique, fiches). ⚠️ **CE N'EST PAS UN OUBLI, ET C'EST CE QUI REND LA DÉCISION DIFFICILE.** L'en-tête de `recettes.test.tsx` s'appuie DESSUS : « les assertions "aucune recette listée ne contient X" portent sur le catalogue affiché EN ENTIER, pas sur un sous-ensemble caché par un scroll infini ». C'est ce qui rend le garde-fou allergènes de §5.2 vérifiable sur la **liste réelle** et non sur un échantillon. **Virtualiser ne casserait pas seulement l'affichage — ça casserait la vérification du garde-fou.** ⚠️ **ET LE VRAI ENJEU N'EST PAS jsdom** : à 500 recettes la question se pose sur un **téléphone**, où le budget n'est pas 15 s mais ce qu'un utilisateur accepte d'attendre avant de croire que l'appli a planté. Pistes non tranchées : **(a)** virtualiser ET réécrire les assertions de garde-fou pour interroger le MOTEUR (`browseRecipes`) au lieu du DOM — la vérification y gagnerait, elle porterait sur ce qui décide plutôt que sur ce qui s'affiche ; **(b)** paginer — déplace le problème sans le supprimer et ajoute un geste à un écran qui n'en demandait pas ; **(c)** ne rien faire tant qu'aucune mesure SUR APPAREIL ne montre de gêne — recevable, mais alors la **mesurer**, sur le vrai écran, ce que l'essai partiel du 2026-08-05 (Chrome, maquette) n'a pas fait. ⛔ **NE PAS REFERMER EN REMONTANT ENCORE `testTimeout`** : il a déjà servi une fois, il ne dira plus rien la prochaine |
| ~~63~~ | **Une étape doit-elle nommer le poisson, ou l'unité suffit-elle ?** | ✅ **TRANCHÉE le 2026-08-10 — ON NOMME LA CHAIR. Les 14 textes rédigés à la main font foi ; le générateur ne les réécrit pas.** Le code rend « poser **4 filets** dessus » ; l'utilisateur avait rédigé « poser **4 filets de poissons** dessus », et c'est cette forme qui est retenue. **Motif** : l'unité seule devient ambiguë dès qu'une étape compte deux ingrédients à la pièce. ⚠️ **Ce que la décision engage** : 14 étapes de YAML sur 10 recettes de poisson gardent leur texte manuel, et **tout lot qui régénère les libellés doit les préserver** — c'est la seule façon dont cette décision peut se perdre en silence. ✅ **La coquille est corrigée le 2026-08-09 (`6f1c2d7`) — et elle n'était PAS où cette ligne le disait.** Le texte annonçait `hareng_pommes_terre_tiedes #6` ; **l'étape 6 du hareng est propre**, vérifiée. La faute réelle était `sardines-marinees-citron.yaml` étape 3, « ranger les filets **des** sardines » pour « **de** sardine ». L'étape 2 de la même recette garde « lever les filets **de sardines** » au pluriel, qui n'est pas fautif — ne pas « uniformiser » les deux. ⛔ **Ne pas confondre avec les 366 doublons d'affichage** — un même ingrédient chiffré dans plusieurs étapes d'une même recette est une autre question, **toujours ouverte et jamais posée** |
| ~~62~~ | **23 recettes n'ont aucune facette `cuisine`, et elles contredisent leurs jumelles** | ✅ **FERMÉE le 2026-08-07 — issue (a), les 23 sont renseignées, aucune valeur retirée à personne.** Répartition : **4 `francaise`** (compote × 2 sur `compote_pomme_poire`, `peches_sirop_erable` sur `peches_roties_miel`, `semoule_amande_figues` sur `riz_au_lait`) · **2 `suisse`** (les deux mueslis, sur `muesli_flocons_fruits`) · **2 `britannique`** (les deux porridges d'avoine, sur `porridge_avoine_banane`) · **1 `espagnole`** · **14 `internationale`**, dont 4 par jumelle (`porridge_quinoa_*`, les smoothies, `tartine_avocat_oeuf`) et **10 en repli assumé**. ⚠️ **`tartine_tomate_huile` → `espagnole` n'est PAS une déduction de ma part** : sa propre description dit « à la manière catalane », l'origine était écrite dans la fiche depuis le début et personne ne l'avait lue. ⚠️ **DEUX APPELS DE JUGEMENT, à contredire sans façon** : `bol_avoine_raisins_noisettes` → `suisse` (c'est un muesli servi sec, mais son nom ne dit pas « muesli ») et `semoule_amande_figues` → `francaise` (semoule au lait, jumelle indirecte). ⛔ **Ce qui a été REFUSÉ, et c'est le piège que la ligne annonçait** : donner `maghrebine` à `orange_cannelle_pistaches` et `dattes_noix`, ou `mediterraneenne` à `figues_noisettes`. Ce sont des origines plausibles que **rien dans le dépôt n'établit** — les poser aurait été inventer une source, exactement la faute payée le même jour sur les cotes de confiance. Elles sont en repli. ✅ **EFFET DE BORD MESURÉ, PAS SUPPOSÉ** : `internationale` passe de 14 à 28 recettes et `cuisine` pèse 0,05 dans la similarité (décision 32), donc 14 plats du petit-déjeuner pouvaient se rapprocher de 5 points. `npm run engine:similarity` → **58 paires > 60 % sur 46 360 (0,125 %)** contre 0,129 % avant, max inchangé à 94,2 %, aucune des 6 paires les plus proches n'appartenant aux 23. Détail en §8, « Calibrations non faites ». Historique de la question, conservé : **OUVERTE le 2026-08-07.** Les 23 venaient **toutes du même commit**, `5cc5f19` (2026-07-28, « 30 recettes végétaliennes ») : son auteur a donné une cuisine aux 6 plats à origine nationale évidente (libanaise, indienne, maghrebine, mexicaine, chinoise, italienne) et rien aux autres. ⚠️ **Le problème n'est pas l'absence, c'est l'incohérence avec le reste du catalogue sur des plats quasi identiques** : `porridge-avoine-banane` → `britannique` mais `porridge-dattes-cannelle` → rien ; `smoothie-banane-myrtille` → `internationale` mais `smoothie-banane-mangue-amande` → rien ; `muesli-flocons-fruits` → `suisse` mais `muesli-amande-myrtilles` → rien ; `tartine-avocat-oeuf` → `internationale` mais `tartine-avocat-citron` → rien. **Effet mesuré : filtrer sur une cuisine rend l'une et cache l'autre** — un trou arbitraire et invisible dans `filtres-recettes.tsx`. ✅ **LE MOTEUR EST SAIN, RIEN À CORRIGER CÔTÉ CODE** : `similarity.ts:109` traite l'absence comme une absence et **jamais comme une égalité** (« même piège absence ≠ égalité, par cohérence »), donc ces 23 ne sont jamais faussement similaires. ⚠️ **Deux commentaires du code tranchent le SENS de l'absence, et ils vont dans le même sens** : `drapeaux.ts:12` raisonne explicitement sur `internationale` comme l'une des 7 « zones ou ensembles » et lui refuse un drapeau — c'est donc une **valeur voulue**, pas un remplissage ; et `similarity.ts:103` qualifie le vide de « aucune cuisine **renseignée** », le vocabulaire d'un champ non rempli. **⇒ les 23 sont non renseignées, pas catégorisées.** Deux issues : **(a)** leur donner la valeur que porte déjà leur jumelle, `internationale` seulement là où aucune origine n'est honnête — 23 fichiers, aucune valeur retirée à personne ; **(b)** décider au contraire que la facette signifie strictement « ce plat vient de là », et alors **retirer** `internationale` aux ~14 qui la portent — plus honnête pour le filtre, mais ça supprime de la donnée committée par d'autres. ⛔ **NE PAS TRANCHER EN TAMPONNANT `internationale` PARTOUT** : parmi les 23 il y a des origines réelles (compote → `francaise`, muesli → `suisse`), et les écraser d'un `internationale` de commodité coûterait l'information que (a) est censée restaurer |
| ~~64~~ | **Un dérivé de viande hors du groupe « viandes » est servi à un végétarien** | ✅ **FERMÉE le 2026-08-10 — CORRIGÉE PAR UN FAIT DÉCLARÉ, `provenance_animale`.** `Food` porte désormais `corps` (prélevé sur l'animal : chair, graisse, os, extrait) ou `production` (fabriqué par l'animal vivant : lait, œuf, miel), propagé par la même cascade `deriveDe` que l'origine ; `regimeExigePar` lit ce fait et **ne consulte plus `Food.groupe` du tout**. ⛔ **LES FAUTIFS ÉTAIENT 6, PAS 5 — et c'est l'argument qui a décidé de la forme du correctif.** `guimauve` (gélatine, rangée en « produits sucrés ») manquait à la liste ci-dessous, écrite pourtant en cherchant exactement ces cas. **L'issue pressentie — « 5 aliments à renseigner, pas 451 » — aurait donc livré le défaut avec un fautif encore vivant.** Une liste d'exceptions ne se sait jamais complète : le champ est **obligatoire sur les 129 aliments à origine animale** et le build **refuse de démarrer** s'il en manque un. Ce qui n'est pas devinable ne doit pas être devinable. ⚠️ **CE QUI EST RÉELLEMENT VÉRIFIÉ : 71 valeurs sur 129.** Seule la branche mammifère/volaille consulte la provenance ; pour les 43 poissons, 14 fruits de mer et le miel, aucun code ni test ne la relit — les deux valeurs y sont légitimes (chair *vs* œufs de lompe), donc **une erreur y est structurellement indétectable**. Le garde reste uniforme par choix ; « 129 aliments classés » surévalue la preuve. ⚠️ **L'INVARIANT « origine ⟺ provenance » N'EST TENU QU'AU BUILD, PAS PAR LE TYPE** : `{ origineAnimale: 'mammifere', provenanceAnimale: null }` est un `Food` bien typé, et il en existe déjà un dans `shopping-list.test.ts`. Sans effet aujourd'hui (ce test ne pose aucune question de régime) → **décision 66**. Ancien état, conservé : `regime.ts:72` rendait `food.groupe === 'viandes' ? 'omnivore' : 'vegetarien'` : un aliment d'origine mammifère ou volaille rangé ailleurs qu'en « viandes » est classé **végétarien**. ✅ **L'ampleur est mesurée, pas estimée** : **63 aliments** sont mammifère/volaille hors « viandes », dont **58 légitimes** (45 laitiers, 4 œufs, le miel via `insecte`). Les **5 fautifs** sont `bouillon_boeuf`, `bouillon_volaille`, `graisse_canard`, `saindoux`, `gelatine`. ✅ **AUCUNE RECETTE DU CATALOGUE NE LES EMPLOIE** — vérifié par jointure sur `recipe_ingredient`, 0 sur les 5. **Le contenu livré n'expose donc pas le défaut.** ⚠️ **Le seul chemin d'exposition est celui pour lequel `regimeExigeParIngredients` est passé en production** : une recette composée **par l'utilisateur**. Un plat au fond de veau serait proposé à un végétarien. ⚠️ **LA MESURE TRANCHE AUSSI LA FORME DU CORRECTIF** : ces 5 déclarent `origine_animale` **en direct, sans `deriveDe`** — il n'y a aucun ancêtre à remonter, donc **aucune règle de code ne peut le deviner**. C'est la donnée qui manque. ⛔ **NE PAS ÉLARGIR LE TEST À UNE LISTE DE GROUPES DANS LE CODE** : c'est exactement la forme de règle qui a déjà échoué ici — la version d'avant devinait depuis `Food.groupe` et déclarait « Radis au beurre » végétalienne sur 20 recettes. ▶ **Issue pressentie** : un champ explicite sur `Food` (chair / produit), **5 aliments à renseigner, pas 451** |
| 65 | **La table équipement ne débloque PAS la réservation — et on l'a cru** | ⏳ **ENCORE OUVERTE, MAIS RÉDUITE À UN SEUL POINT, le 2026-08-13 : la quantité possédée (les feux de plaque, « 65b »).** Tout le reste est **tranché et CODÉ** — voir §3, entrée 65a. Ce qui subsiste ici est le point (4) ci-dessous, et lui seul : `plaque_cuisson` vaut `selon_quantite`, le moteur **se tait** tant qu'il ne sait pas combien de feux la personne possède, et ⛔ **ce silence est un état stable, pas un provisoire** — il ne coûte aucune fausse alerte, donc rien ne le forcera à se refermer. Les points (1), (2) et (3) sont résolus : la table d'occupations existe, la dérivation tourne, `CODES_INDIVISIBLES` a disparu. ⚠️ **La sonde `atelier/mesure-occupation-four.mjs` reste hors dépôt** — la règle de détection, elle, est désormais versionnée dans `catalog/`, ce qui était le vrai risque. **Texte d'origine, conservé :** ⏳ **OUVERTE le 2026-08-10.** Le mode cuisine affiche le matériel partagé (`22d1c74`, « l'écran le dit, il ne le range pas ») et **refuse de réserver**. ⛔ **Bloquée par deux données absentes, pas par le code** : une colonne d'**étape** sur `recipe_equipment` (sans quoi aucun créneau n'est déductible) et une **`capacite`** sur `equipment` (sans quoi la plaque déclencherait **63 % des paires**). Les deux vivent dans `catalog/`. ⚠️ **LE FAIT À RETENIR EST L'ERREUR, PAS LE MANQUE** : livrer les 30 ustensiles et les 1 473 couples a fait conclure « le niveau 3 n'attend plus de contenu, il attend d'être codé ». C'était faux, et ça a été écrit dans deux documents. **Une table qui existe n'est pas une table qui suffit.** ⛔ Une inférence par les `lexicon_ids` (`enfourner` → four) a été envisagée puis **écartée** : elle repose sur une correspondance mot → ustensile écrite dans le code, qu'un lot de contenu casse en silence, **et la capacité manquerait toujours**. Détail : `CONCEPTION_MODE_CUISINE.md` §8 question F. ⚠️ **MESURÉ LE 2026-08-11, ET TROIS DES QUATRE TERMES DE CETTE LIGNE BOUGENT.** Les chiffres du refus, eux, sont REVÉRIFIÉS EXACTS sur le catalogue du jour : 34 290 paires en conflit sur 54 285 = **63 %**, `plaque_cuisson` requis sur **260 recettes (79 %)**, `four` sur **82 (25 %)**, 74 recettes exigent les deux. Le refus de réserver reste fondé. Ce qui change : ⛔ **(1) LA COLONNE D'ÉTAPE DEMANDÉE NE PEUT PAS PORTER LE CAS RÉEL.** `recipe_equipment` a pour clé `(recipe_id, equipment_id)` — **une seule ligne par couple** — or **13 recettes sur 83 occupent le four DEUX fois** et une **trois fois** (16 % + 1 %) : `colin_four_fenouil` enfourne le fenouil seul 15 min, on sort le plat, on pose le poisson, on remet 15 min — **et entre les deux le four est LIBRE**, ce qui est précisément l'information qu'une réservation doit avoir. Une colonne ne l'exprime pas ; il faut une **table d'occupations**. Ça se serait vu à l'écriture du code, **après** avoir rempli les données. ⛔ **(2) LE COÛT EST SURESTIMÉ D'UN FACTEUR 4, ET C'EST LE NOMBRE « 1 473 » QUI TROMPE.** La réservation ne concerne que le niveau `requis` : **357 couples**, pas 1 473 (`informatif` 1 078 et `accelere` 38 n'ont aucun effet moteur). Pour les seuls ustensiles indivisibles (`four`, `micro_ondes`) : **83**. ✅ **(3) LA DÉRIVATION A ÉTÉ MESURÉE, ET ELLE TIENT** : **98 occupations trouvées sur les 83 recettes, AUCUNE recette muette**, **89 % avec leur durée** (le minuteur `cuisson` de l'étape est déjà là — aucune donnée nouvelle à saisir pour ça). **24 cas fragiles relus À LA MAIN — 18 justes, 6 faux, ~6 %** des 98 occupations, en trois familles reconnaissables : 4 × un geste posé sur une étape dont l'ACTION n'est pas la cuisson (`rotir` sur « Servir les sardines avec les tomates rôties »), 1 × une phrase d'explication, 1 × un préchauffage qui chauffe déjà l'eau du bain-marie. ⚠️ **Les 74 occupations portées par `enfourner` N'ONT PAS été relues** — tenues pour justes par construction, le geste étant une annotation humaine dont c'est le sens exact ; si ce postulat tombe, le taux tombe avec. Deux familles de faux positifs ont été éliminées en cours de mesure : « à la sortie du four » et les explications écrites après un tiret cadratin. ⚠️ **Rejouer la mesure : `node atelier/mesure-occupation-four.mjs`** (`--detail` pour les 98 occupations). ⛔ **MAIS `atelier/` EST GITIGNORÉ EN ENTIER (`.gitignore:43`), DONC CETTE SONDE NE VIT PAS DANS LE DÉPÔT** — et ce n'est pas un cas isolé : `catalog/lien-etape-ingredient.mjs` annonce « Rejouer la mesure : `node atelier/mesure-liens-etapes.mjs` » pour ses **94 %**, et ce fichier-là n'est pas versionné non plus. **Deux chiffres de décision reposent aujourd'hui sur des scripts absents de tout clone.** À trancher : sortir les sondes de mesure de `atelier/` vers un dossier suivi, ou assumer que ces taux ne sont pas rejouables ailleurs que sur la machine qui les a produits. ⛔ **Ce compteur ne se recopie pas, il se refait** : les 18/6 sont un jugement à l'œil sur des cas réels, pas une sortie de programme. ⛔ **L'ARGUMENT QUI ÉCARTAIT LA DÉRIVATION CI-DESSUS EST CELUI QUI EST DÉJÀ TOMBÉ UNE FOIS** : la décision 8 écartait la dérivation étape ↔ ingrédient au motif d'une correspondance fragile, la 60 l'a démentie, et `recipe_step_ingredient` est aujourd'hui **dérivé et non saisi**, à 94 %, avec une colonne `origine` qui rend le faible VISIBLE au lieu de le fondre dans le juste. Même remède ici. ⛔ **(4) `capacite` N'EST PAS AU BON ENDROIT, ET C'EST LA VRAIE QUESTION OUVERTE.** Elle recouvre deux faits de nature opposée : **intrinsèque** — un four a UN thermostat, vrai chez tout le monde, donc catalogue ; **propre à la cuisine de la personne** — une plaque a 2 à 5 feux. Or `user_equipment` ne stocke que `equipment_id`, **jamais une quantité**. Écrire « la plaque a 3 feux » dans `catalog/` referait le défaut que le lot B du régime a évité — figer au catalogue un fait qui appartient à l'utilisateur — et cette fois ça se verrait chez la moitié des gens. ⚠️ **La dérivation donne le QUAND, jamais le COMBIEN** : elle ne règle pas les feux de plaque, et ne prétend pas le faire. 📌 **À trancher avant tout code** : la quantité possédée va-t-elle dans `user_equipment` ? |
| 66 | **L'invariant « origine animale ⟺ provenance animale » se garantit-il par la FORME ?** | ⏳ **OUVERTE le 2026-08-10, sans effet mesurable aujourd'hui.** Le build refuse une origine sans provenance ; **le type, lui, accepte la paire incohérente** et un `Food` de test la porte déjà (`shopping-list.test.ts`, rayon — aucune question de régime n'y est posée, donc aucun faux résultat). ⚠️ **DURCIR LES FABRIQUES NE SUFFIT PAS, C'EST MESURÉ** : ce fichier n'utilise pas `makeFood` mais un helper local qui prend un `Partial<Food>` — un spread produira toujours la paire, quel que soit le nombre de fabriques qui lèvent. ▶ **Issue pressentie** : remplacer les deux champs plats par une paire nullable unique (`sourceAnimale: { origine, provenance } \| null`), ce qui rend l'incohérence **inexprimable** — c'est l'argument de l'acquis 2, « la garantie vient de la forme ». **Coût : ~10 fichiers**, dont le type du domaine et `catalog-loader`. ⛔ **Délibérément EXCLUE du lot qui a fermé la 64** : ce lot faisait déjà 15 fichiers, et c'est sa relisibilité qui a permis à une relecture indépendante d'y trouver un test qui ne testait rien |
| ~~67~~ | **Le régime doit-il être une échelle unique, ou une définition personnalisable ?** | ✅ **FERMÉE le 2026-08-11 — PERSONNALISABLE, et le chantier est LIVRÉ EN ENTIER : A, B, C, C-bis, D1, D2, D3, D4.** E reste optionnel et n'a jamais été entrepris. Demande : un écran de réglages listant ce que le régime déclaré écarte, avec ajout/retrait **par groupe et par aliment**, plus des **sous-formes de végétarisme**. Plan de montée : `docs/CONCEPTION_REGIME_PERSONNALISE.md`. ⚠️ **CE N'EST PAS UN CONFORT, C'EST LA SEULE FORME POSSIBLE** : `DIET_CHAIN` est un ordre TOTAL et exige que qui déclare un régime mange *réellement* tout ce qui le précède — **lacto-végétarien et ovo-végétarien sont incomparables** et ne peuvent donc pas y entrer sans casser la chaîne. ✅ **L'écran est faisable parce que la 64 a livré les deux axes** : 167 aliments à origine animale en **7 groupes** (50 laitiers, 43 poissons, 39 viandes de mammifère, 14 fruits de mer, 13 volailles, 7 œufs, 1 miel). 167 cases à cocher est inutilisable ; 7 groupes est un écran. ✅ **LOT A (`9d4f691`)** — `engine/domain/groupes-animaux.ts`, fonction pure, les 7 comptes tombent sur le relevé. ✅ **LOT B (`5ef356d`)** — panneau « Aliments que je ne veux pas », migration v15. ⛔ **C'EST LE GROUPE QUI EST STOCKÉ, PAS SES ALIMENTS, et c'est toute la décision de schéma** : enregistrer les 7 œufs au moment du geste aurait servi le huitième, ajouté le mois suivant, à quelqu'un qui avait justement coché « Œufs » — sans erreur, sans test rouge, sans rien à l'écran. Le dépliage se fait à la LECTURE, contre le catalogue du jour. **Les sous-formes restrictives existent donc sans une ligne de moteur**, et la question de la présure disparaît sans qu'on ait à la trancher : le végétarien qui refuse le roquefort le retire lui-même. ✅ **LOT C (`eacb065`)** — compteur **par créneau**, jamais un total : le banc a mesuré « végétalien + sans gluten » à marge zéro, 28 plats pour 28 créneaux, et un total global reste vert pendant qu'un créneau est déjà vide. Présélections **additives** — elles ne décochent jamais. ⛔ **LOT C-bis (`8dcaa8f`) : LA CORRECTION DEMANDÉE N'EN ÉTAIT PAS UNE.** Le compteur semblait sur-compter en ignorant `peutRemplirSeul` — 33 % d'écart mesuré. **Faux** : `pickForSlot` a DEUX passes et la seconde repose la question sans ce filtre ; le refus est une **préférence**, pas une exigence. Mesuré sur 4 recettes partielles et 7 dîners : compte actuel 4 → `'court'` → 4 remplis, 3 vides ✓ ; compte filtré 0 → `'vide'` → **faux**, et `suggestMeals` ne lève même pas. **Filtrer aurait échangé un compte exact contre un message alarmiste faux.** Verrouillé par un test qui prend `planWeek` pour oracle. ✅ **LOT D1 (`5d6a1a8`)** — la seconde chance dans `dietLayer`. ⛔ **LA RAISON QUI METTAIT D EN QUARANTAINE ÉTAIT FAUSSE** : le plan disait que D rendrait `regimeExigeParIngredients` « porteuse en production alors qu'elle n'est qu'un contrôle » — **elle l'est déjà**, `data/user-recipe.ts:150` l'appelle pour chaque recette composée par l'utilisateur. Ce qui restait vrai est plus étroit : la règle tournait sur une liste **entière**, D la fait tourner sur une liste **amputée**. **L'argument d'attente n'était donc plus la sûreté mais la DEMANDE.** Quatre propriétés : **P1** aucune admission ⇒ chemin identique à l'octet ; **P2** seconde chance seulement, jamais un refus de plus ; **P3** ⭐ la règle ne sert **que là où elle est d'accord avec l'étiquette écrite à la main** — ce qu'elle attrape est le cas où la RÈGLE est plus fausse que l'ÉTIQUETTE (recette au miel étiquetée `vegetarien`, règle défectueuse rendant `vegetalien`, un végétalien qui admet les ŒUFS reçoit du miel : c'est le bug du 2026-07-28 qui a fait naître `tests/regime-coherence.test.ts`), et elle vaut parce que **`npx vite build` n'exécute pas vitest** — les quatre commandes sont une discipline, pas un verrou ; **P4** l'admission ne touche que la couche `regime`. ⚠️ **Mesuré** : 0 recette sans ingrédient connu, 0 ingrédient orphelin ⇒ P3 ne se déclenche sur aucune des 330, et **c'est le succès, pas du code mort**. ✅ **LOT D2 (`43a1a0c`)** — table `user_admitted_food`, migration v16, plus les deux dettes de D1. ⛔ **DEUX TABLES DONT LE NOM SE RESSEMBLE ET QUI VONT EN SENS INVERSE** : `user_group_exception` (v15) RESTREINT (« j'ai coché *Œufs*, sauf la caille », couche `exclusions`) ; `user_admitted_food` (v16) ASSOUPLIT (« végétalien, sauf le miel », couche `regime`). Seule la seconde peut faire manger un produit animal à un végétalien. ⛔ **P4 EST UN FIL-PIÈGE, PAS UNE GARANTIE DE FORME — et l'avoir écrit « structurel » était une erreur.** `SelectionLayer.configure` reçoit la requête ENTIÈRE (`engine/selection/index.ts:64`) : rien n'empêche mécaniquement `allergenes.ts` de lire `admittedFoodIds`. Ce qui existe est une assertion de texte source dans `tests/engine-boundaries.test.ts`, avec son propre test d'échec. La rendre structurelle exigerait de scinder `HardConstraints` en vues par couche ou de changer la signature de `configure` — refonte du contrat de couche, non entreprise. ⚠️ **Préséance exclusion > admission : NON arbitrée dans le magasin, VÉRIFIÉE sur la passe.** Les deux listes partent au moteur même quand elles nomment le même aliment ; un `filter(pas exclu)` à la lecture aurait été plus court et aurait **masqué toute régression future de P4**. ✅ **LOT D3 + D4 (`98b452c`)** — panneau « Mes exceptions », **séparé** de « Aliments que je ne veux pas » (décision utilisateur, garde-fou (a) rendu structurel). ⛔ **UNE CASE QUI N'AGIT PAS N'EST PAS PROPOSÉE COMME SI ELLE AGISSAIT** : `groupesAdmissibles` croise les **trois** sources — régime, allergènes déclarés, exclusions — et affiche le blocage AVEC sa raison au lieu d'offrir une case inerte. Le libellé (« végétalien, sauf 1 ») ne compte que les admissions **effectives**, verrouillé par `parametres.test.tsx:641`. ⚠️ **D4 A ÉTÉ REPLIÉ DANS D3 par la session qui l'a livré, et c'était le bon appel** : le compteur ne pouvait pas rester sur son `[]` en dur une fois les cases cochables. ⛔ **ET IL ENVOIE TOUTES LES ADMISSIONS, PAS SEULEMENT LES EFFECTIVES** (`parametres.tsx:389-412`, `admittedFoodIds: [...vueCourante.admissions]`) — c'est ce que `readConstraints` envoie en production, donc le compte annonce ce que les suggestions FERONT, pas une version plus propre. Les deux sens sont verrouillés : `:694` (le compteur suit les exceptions) et `:641` (le libellé ne compte pas une admission inerte). ✅ **RÉPONSE À LA QUESTION PARQUÉE** — oui, une admission qualifie le régime affiché, et par le **libellé**, pas par un avertissement : « végétalien, sauf 1 » informe sans juger (principe 6). ⚠️ **Et pour un omnivore, il n'y a rien à qualifier** : `LIBELLE_REGIME` ne connaît que pescétarien/végétarien/végétalien — « je mange de tout » vaut `null`, donc aucun libellé à corriger. Ce n'était pas prévu par le brief, c'est la lecture du code qui l'a rendu. ⛔ **Trois garde-fous non négociables** : (a) **les allergènes ne passent JAMAIS par ces écrans** ; (b) la couche `regime` reste **critique et indésactivable**, ce qui devient configurable est **ce qu'elle lit** ; (c) un écran qui peut vider le planning prévient **avant**. ▶ **Lot E (`presure`) optionnel, ne bloque rien** ; « Roquefort et Ossau-Iraty AOP imposent une présure animale » reste **non vérifié**. Le cas certain est le parmesan du pesto. ⚠️ **CETTE LIGNE EST FERMÉE, PAS LE LOT E.** Si la présure est un jour reprise, elle ouvre sa PROPRE décision — ne pas rouvrir la 67, dont la question (« échelle unique ou personnalisable ? ») est tranchée et codée. |
| 68 | **À 330 recettes photographiées, le bundle dépasse les 15 Mo du critère P6** | ⏳ **OUVERTE le 2026-08-10, sur une MESURE de `dist/` et non sur une projection.** Décomposition en octets réels à 116 photos : `dist/` = **8,07 Mo**, dont **4,32 Mo de photos** (37,2 Ko l'unité) et **3,75 Mo de reste**. Couvrir les 330 recettes ajoute **~8 Mo** ⇒ **~16,0 Mo**, soit **au-dessus du seuil**. ⛔ **LA LIGNE QU'ELLE REMPLACE DISAIT L'INVERSE — « il reste 0,6 Mo de marge » — ET ELLE ÉTAIT FAUSSE PAR DOUBLE COMPTE** : elle additionnait un `dist/` de 6,61 Mo qui contenait déjà ses 88 photos avec une projection de photos. Deux erreurs de sens contraire se compensaient et rendaient un nombre rassurant. ⚠️ **Rien ne presse et rien ne bloque** : à 116/330 le bundle tient largement, et le dépassement n'arrive qu'à couverture complète — donc pas avant que la récolte, aujourd'hui le goulot, n'ait fourni 214 photos de plus. ⚠️ **Mais la décision se prend AVANT de produire les 214**, pas après : ré-encoder deux fois le même lot est le genre de travail qu'on ne refait pas de bon cœur. Pistes, non tranchées : **(a)** baisser `quality` (45 aujourd'hui) ou la largeur (1 024 px) — mesurable en une passe `--dry`, mais le réglage a été fixé à PSNR égal et le rabaisser se paie en netteté sur l'écran Détail, où la photo est censée être dominante ; **(b)** relever le seuil P6 — il a été écrit pour un **premier chargement web**, quand le plafond d'un AAB est de 150 Mo ; il n'a jamais eu de justification mesurée sur appareil ; **(c)** ne pas pré-cacher toutes les photos dans le service worker — mais cela contredit le **principe 5, hors-ligne intégral**, et c'est le seul principe en jeu ici. ⛔ **NE PAS TRANCHER SUR CETTE LIGNE** : elle dit ce qui a été mesuré, pas ce qu'il faut faire. La mesure se reprend à chaque lot de photos, **sur `dist/`, jamais sur le bac** — le bac pèse 25,9 Mo pour ce que `dist/` rend en 4,32. ⚠️ **LOT DU 2026-08-13 (`f3d4fa1`) : 116 → 129 PHOTOS, ET `dist/` N'A PAS ÉTÉ REMESURÉ.** Seul le dossier source l'a été : **4,12 → 4,9 Mo**. **Les 8,07 Mo ci-dessus sont donc périmés d'environ 13 photos** et ne doivent pas être recités tels quels — c'est exactement la règle « sur `dist/`, jamais sur le bac » qui n'a pas été tenue par le lot qui l'a écrite. Le reste à produire passe de 214 à **201**. |
| 69 | **Embarquer 98 segments découpés dans le paquet : « usage » ou « Standalone » au sens de Pexels ?** | ⏳ **OUVERTE le 2026-08-11, sur RELEVÉ DE TEXTE et non sur une intuition.** Texte complet, sources et dates : `reference/LICENCES_MEDIAS.md`. Deux clauses coexistent et ne disent pas la même chose. La page `/license/` interdit de « redistribute or sell the photos and videos **on other stock photo or wallpaper platforms** » — inapplicable ici. Les conditions générales (**datées du 15 novembre 2024**) sont plus larges : « You cannot sell or distribute the Content (either in digital or physical form) **on a Standalone basis** », « Standalone » valant « no creative effort has been applied (…) and it remains in substantially the same form ». ⛔ **LE POINT DUR EST NOMMÉMENT CONTRE NOUS** : « solely using a filter, changing colors, **resizing or cropping** the Content **remains Standalone use** ». Découper à 3 s, recadrer au carré et réduire à 480 px **n'est donc PAS, à soi seul, l'effort créatif** qui fait sortir du régime — c'est exactement ce que fait la passe de relecture. La sortie du régime passe par la combinaison avec « text, illustrations, background features », ce qu'un lexique geste + définition + grille réalise plausiblement ; **mais aucun texte officiel ne traite le cas d'un clip embarqué dans le paquet d'une application**, et les 98 fichiers y restent individuellement extractibles. ⚠️ **NE PAS TRANCHER SUR CETTE LIGNE.** La seule chose qui trancherait est une réponse écrite de Pexels ; en attendant, une **règle de conception** limite l'exposition sans rien coûter : **aucun clip n'est jamais offert comme fichier séparé** — pas de bouton « télécharger le média », pas d'export de pack, ce qui maintient l'usage du côté « composant d'un ensemble ». ⚠️ **Deuxième volet, lui aussi non tranché et plus immédiat : le droit à l'image.** Pexels ne garantit RIEN — « We do not warrant that any consents or licenses have been obtained » — et interdit d'« imply endorsement of your product by people or brands ». Dans une application de nutrition, un visage identifiable à côté d'un propos de santé se lit comme une caution. ▶ **Conséquence appliquée dès la passe de tri, pas plus tard** : à qualité égale de démonstration, **préférer les mains au visage**, le recadrage carré servant précisément à cela. ⛔ **CE QUI N'A PAS PU ÊTRE VÉRIFIÉ EST LISTÉ DANS LE DOCUMENT, PAS OUBLIÉ** : `help.pexels.com` répond **403**, `web.archive.org` est refusé par l'outil, donc l'historique de la clause « Standalone » est indatable. ✅ **Volet CapCut TRANCHÉ, et il ne rouvre pas cette ligne** : outil d'exploration accepté, **exclu de la production des fichiers livrés** — d'abord pour la reproductibilité (98 exports manuels ne se refabriquent pas, le format a changé deux fois en un jour), ensuite parce qu'un seul élément CapCut dans un export rendrait fausse, en silence, l'affirmation de licence unique du manifeste. ⛔ **ÉLARGIE LE 2026-08-13 : ELLE NE CONCERNE PLUS SEULEMENT LES CLIPS.** Le décompte des licences des 129 photos livrées (relevé sur `CREDITS.md`) donne **16 Pexels + 10 Pixabay Content License = 26 photos DÉJÀ EMBARQUÉES** sous la même clause « Standalone use ». La question posée pour des segments vidéo à venir porte donc sur du contenu déjà dans le paquet. ⚠️ **L'argument de défense n'est pas le même pour une photo** : elle illustre une recette et ne se consomme pas seule, là où un clip de 3 s isolé ressemble davantage à la redistribution du média lui-même. **À faire trancher dans la même réponse** — un courriel a été envoyé à Pexels le 2026-08-13. ⛔ **PEXELS A RÉPONDU LE 2026-08-14, ET LA RÉPONSE NE FERME PAS LA LIGNE — ELLE DÉPLACE LE POINT DUR.** Verbatim : « **we wouldn't recommend bundling the original Pexels video files directly into the application package** », et la raison est nommée : « the files themselves are also being distributed with the app and **could be extracted separately** ». ⚠️ **CE N'EST NI UN REFUS NI UNE AUTORISATION** — « we wouldn't recommend » est une recommandation, pas une règle, et n'engage rien. ✅ **ILS CONCÈDENT EXPLICITEMENT L'ARGUMENT DE L'ŒUVRE COMBINÉE** : « Adding a video to a glossary entry alongside a written definition **can form part of a broader creative work** » — c'est-à-dire exactement le lexique geste + définition. **Leur seule objection porte donc sur l'EXTRACTIBILITÉ DU FICHIER, pas sur l'usage.** ⚠️ **Ils confirment aussi que gratuit ou payant ne change rien** : « Whether the app is free or paid doesn't change this consideration. » ▶ **RELANCE ENVOYÉE, sur le seul fait que la première demande n'avait pas rendu explicite** : ce qui est embarqué n'est **jamais le fichier d'origine** mais un segment de 3 s recadré et ré-encodé en AV1 + H.264 — une vidéo source de 25 s ne s'en récupère pas. ⚠️ **Cet argument porte sur l'EXTRACTIBILITÉ, pas sur l'effort créatif** : la clause « resizing or cropping remains Standalone use » ci-dessus le tuerait s'il prétendait le contraire. Ne pas confondre les deux axes en relisant cette ligne. ⛔ **MESURE FAITE LE 2026-08-14, ET ELLE AGGRANDIT L'ENJEU : LES 51 GESTES ILLUSTRÉS VIENNENT TOUS DE PEXELS, LES 99 SEGMENTS AUSSI, SANS EXCEPTION** (compté sur `atelier/gestes/etat/clips-decisions.json`, préfixe de `cle`). Il n'y a **aucune** autre banque dans la lane vidéo : une réponse défavorable ne coûte pas une partie du chantier, elle le coûte **en entier**. ⚠️ **Écart relevé au passage, non expliqué : le fichier de décisions porte 99 segments, la documentation en annonce 98 encodés.** Un segment décidé n'a pas été produit — sans conséquence ici, mais c'est le genre d'écart qui ne doit pas rester silencieux. ▶ **PHOTOS — les 103 autres sont HORS DE CETTE QUESTION, vérifié le 2026-08-14 sur `CREDITS.md`** : 84 via Openverse/Flickr et 19 via Wikimedia Commons, toutes sous Creative Commons, qui **autorise explicitement la redistribution** et ne porte aucune clause « standalone ». Le risque se limite aux **16 Pexels + 10 Pixabay**. ▶ **PIXABAY EST UNE DÉMARCHE SÉPARÉE** : même groupe (Canva, 2019) mais équipes distinctes, la réponse de l'un n'engage pas l'autre. Contact vérifié le 2026-08-14 : `info@pixabay.com`, en clair dans leurs conditions, et `pixabay.com/service/contact/`. ⚠️ **DETTE OUVERTE PAR CETTE VÉRIFICATION, ET QUI N'A RIEN À VOIR AVEC LA 69** : **31 photos sont en CC BY-SA**. Les recadrer et les ré-encoder crée une œuvre dérivée, qui doit alors être proposée **sous la même licence** — ce qui ne contamine PAS le code de l'application, seulement la photo modifiée. **Rien ne le dit aujourd'hui dans `CREDITS.md`.** ✅ **Polices hors sujet, vérifié** : SIL OFL, auto-hébergées, intégration explicitement autorisée. |

---

## 5. Les écrans

> Le journal des lots terminés (P0 → P1c, contenu lots 1-2) a été déplacé dans
> [archive/RECAP_SESSION_5.md](./archive/RECAP_SESSION_5.md) §7 le 2026-07-31 : il décrivait du
> travail achevé que git conserve déjà, et il noyait l'état courant.

> ⚠️ **Le tableau ci-dessous suit la numérotation de `DESIGN.md` §4, qui s'arrête à huit.** Le code
> en porte **douze** : s'y ajoutent **Paramètres** et **Éditeur de recette** (2026-08-01,
> `archive/RECAP_SESSION_7.md`), le **mode cuisine** (§5bis ARCHITECTURE) et la **fiche aliment**
> (2026-08-07, décision 33). **Onze sont couverts par des tests d'écran** — `savoir.tsx` ne l'est
> pas, le chantier « Comprendre » y étant en cours au moment où les tests ont été écrits. Les trois
> comptes — 8 spécifiés, 12 codés, 11 testés — sont justes ; ne pas les uniformiser sans traiter la
> cause (`DESIGN.md` n'a pas suivi).
> ⚠️ **Ce compte disait « dix codés, neuf testés » jusqu'au 2026-08-07, et il était faux depuis le
> 2026-08-06** : le mode cuisine avait été livré sans que la ligne bouge. Le recompter demande de
> lister `app/src/ui/screens/*.tsx`, pas de faire confiance à la phrase précédente.

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
| `npm test` · `npm run typecheck` | Suite complète (**1 492 tests, 84 fichiers**, exécutée le 2026-08-05) · TypeScript strict |
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
- ⛔ **QUAND PLUSIEURS LANES TRAVAILLENT DANS LE MÊME DÉPÔT, `git add` PUIS `git commit` N'EST PAS
  SÛR — l'index est PARTAGÉ.** Payé le 2026-08-09 : un `git add catalog/recipes` suivi, avant mon
  propre `git commit`, du commit d'une autre lane ; mes **308 fichiers stagés sont partis dans SON
  commit** (`ccd0bf4`, « service worker », 310 fichiers). **Nommer ses chemins au moment de commiter
  ne protège de rien** — ce qui compte, c'est ce que contient l'index à l'instant où *quelqu'un*
  commite. La lane service-worker a réparé seule (`reset HEAD~1` puis recommit propre en `26f6bca`,
  2 fichiers) et les 308 recettes vivent sous leur propre message en `c962c8f` : **rien à corriger
  dans l'historique, la trace est juste.**
  **Le geste : `git commit -F <message> -- <chemins>`**, qui stage et commite en une seule opération.
  C'est le seul des deux qui soit atomique vis-à-vis des autres lanes. ⚠️ Un fichier NON SUIVI doit
  encore passer par `git add` avant — la fenêtre existe alors, il faut la garder aussi courte que
  possible et enchaîner immédiatement.
  ⛔ **Et `git stash` reste interdit** : un stash a vidé l'arbre entier le 2026-08-09.
---

## 8. Dette connue

Tenue ici et **nulle part ailleurs** : `FICHE_REPRISE.md` ne fait qu'y renvoyer.

> ⛔ **LES CHIFFRES DU CATALOGUE VIVENT ICI ET NULLE PART AILLEURS DANS §8.** Audit du 2026-08-07 :
> **six entrées** annonçaient « 241 recettes » ou « 212 recettes », une septième « 9 fichiers de
> test », une huitième « aucun test d'interface » — toutes fausses, certaines depuis dix jours. Le
> même nombre recopié à six endroits ne se met à jour nulle part : **c'est la duplication qui est la
> dette, pas les chiffres.** Les entrées ci-dessous renvoient désormais ici.
>
> **Relevé du 2026-08-09** — `node -e` sur `app/public/catalog/catalog.db`, après la lane RÉFÉRENCE
> (équipement, repos, piquant, 22 recettes). ⚠️ Le relevé précédent portait « après le lot sauces
> (décision 62) » : le lot sauces n'a livré que son axe, voir §8 :
>
> | Quantité | Valeur | Comment la remesurer |
> |---|---|---|
> | Recettes | **330**, dont **3 sauces** | `SELECT COUNT(*) FROM recipe` · `… WHERE est_sauce=1` |
> | Aliments | **451** | `SELECT COUNT(*) FROM food` |
> | Étapes de recette | **1 548** | `SELECT COUNT(*) FROM recipe_step` |
> | Photos de recette | **129 / 330** importées **et affichées depuis le 2026-08-13** (`f3d4fa1`, branche `lot/photo-affichage`) · **0 en attente** — les 13 qui dormaient sont entrées · **201** recettes n'ont aucune photo jugée bonne, et le bac est épuisé | `SELECT COUNT(*) FROM recipe WHERE image_path IS NOT NULL AND image_path <> ''` · pour les deux autres, compter les `decision === 'oui'` de `atelier/photos/etat/decisions.json` (hors dépôt) |
> | `piquant` renseigné | **330 / 330** (recettes) · **21 / 451** (aliments, et c'est voulu — §8) | `SELECT COUNT(*) FROM recipe WHERE piquant IS NOT NULL` · `… FROM food …` |
> | Sauces : aliments · attachements · `porte_deja_une_sauce` posé | **10** · **14** · **20** | `food WHERE sous_groupe='sauce'` · `recipe_sauce` · `recipe WHERE porte_deja_une_sauce IS NOT NULL` |
> | Équipement : référentiel · couples | **30** · **1 473** (357 requis · 38 accélère · 1 078 informatifs) | `equipment` · `recipe_equipment` `GROUP BY niveau` |
> | Occupations de four/micro-ondes | **92** sur **85** recettes (4 déclarées · 88 dérivées) | `recipe_step_equipment` · `… GROUP BY origine`. ⛔ **Ne pas confondre avec les 83 recettes qui EXIGENT** four ou micro-ondes (`recipe_equipment.niveau='requis'`) : deux tables, deux ensembles qui ne coïncident pas, et cette confusion a déjà scellé un mauvais chiffre |
> | Créneaux | dîner **205** · déjeuner **185** · petit-déjeuner **55** · goûter **49** | agréger `recipe.types_repas` (JSON). ⚠️ **Pas au `grep`** : `dejeuner` est une sous-chaîne de `petit_dejeuner` |
> | Envergure, **hors sauces** | quotidien **249** · convivial **68** · fête **10** | `SELECT envergure, COUNT(*) FROM recipe WHERE est_sauce=0 GROUP BY 1` |
> | Cuisines distinctes | **26** sur les 26 du vocabulaire fermé | `SELECT COUNT(DISTINCT valeur) FROM recipe_facet WHERE facette='cuisine'` |
> | Lexique · tips · fiches | **62** · **73** · **8** | `lexicon_entry`, `tip`, `evidence_sheet` |
> | Fichiers de test d'écran | **20** | `ls app/src/ui/**/*.test.tsx` (globstar requis) |
>
> ⚠️ **CE TABLEAU AURA VIEILLI QUAND VOUS LE LIREZ, ET C'EST NORMAL** : le catalogue est passé de
> **282 à 292 recettes pendant la rédaction de ce paragraphe** (lot de contenu d'une session
> parallèle). **Remesurer coûte dix secondes ; le recopier coûte une décision fausse.**
> ⚠️ **Un audit automatique ne dispense pas de vérifier** : celui du 2026-08-07 a rendu
> « déjeuner = 199 » là où la mesure directe donne **159**. Les verdicts d'un agent sont une piste,
> pas un relevé.

### Ce que le lot 65a laisse derrière lui (2026-08-13)

- ⚠️ **L'ÉCRAN A DEUX FORMULATIONS ET UNE SEULE EST SCELLÉE.** Le mode cuisine dit « le four est
  pris de 19h43 à 19h57 » quand l'heure de service est connue, et « de 17 à 3 min avant le service »
  quand elle ne l'est pas. **Les tests scellés posent tous une heure de service**, donc la seconde
  branche n'est couverte que par un test d'écran ordinaire — réécrivable le jour où il rougira.
  ▶ La fermer demande un test scellé sur base sans `heure_service_ms`. **Le code est écrit et vert ;
  ce qui manque est la garantie, pas la fonction.**
- ⚠️ **LE PALIER DE 98 OCCUPATIONS N'A JAMAIS ÉTÉ RELEVÉ À LA MAIN.** Le document de conception
  prévenait qu'un sceau posé sur les cinq lots ferait disparaître le contrôle intermédiaire entre
  A et B, et que **rien ne le rappellerait**. Rien ne l'a rappelé. Conséquence concrète : on sait
  que le résultat final est juste (85 recettes, aucune muette, 5 faux positifs absents), on ne sait
  **pas** si la dérivation brute trouve toujours 98 étapes avant correction. Un changement de la
  règle de détection qui compenserait une perte par un gain passerait inaperçu.
- ⚠️ **`atelier/mesure-occupation-four.mjs` reste hors dépôt** (`atelier/` est gitignoré en entier).
  Le chiffre de 63 % de fausses alertes, celui de 85,2 % de paires encore en conflit, et le 18/6 des
  cas relus à la main **ne sont rejouables que sur la machine qui les a produits**. La règle de
  détection, elle, est désormais versionnée — c'était le risque principal, et il est levé.
  ▶ Même dette que `catalog/lien-etape-ingredient.mjs` et ses 94 % : à trancher ensemble, pas
  séparément.
- ⚠️ **`equipement-partage.ts` ne porte plus que des commentaires.** Le fichier est gardé
  intentionnellement — un test scellé exige son existence, et son contenu explique pourquoi la
  fonction retirée ne suffisait pas. **Ce n'est pas un oubli de ménage** ; le supprimer casse le
  sceau.

### Défauts de contenu repérés et non corrigés

- ⚠️ **`flan_oeufs_caramel` fond une cuisson et un repos de plusieurs heures dans UNE seule étape.**
  ⛔ **CETTE ENTRÉE DISAIT AUTRE CHOSE, ET C'ÉTAIT FAUX — mesuré et réécrit le 2026-08-13.** Elle
  annonçait « c'est le bain-marie qui est compté comme temps de four » et « la recette occupe un
  équipement qu'elle a libéré depuis longtemps ». **Non** : l'étape 5 porte `timer_s: 3000`, soit
  50 minutes — c'est la cuisson au bain-marie elle-même, pas le refroidissement. `timer_type:
  cuisson` est donc **juste**, et l'occupation de four que 65a en dérive est **juste** aussi. La
  lane qui l'a signalé n'avait pas ouvert le YAML ; elle a lu le texte de l'étape et déduit le
  reste. ▶ **Le vrai défaut** : le texte dit « cuire au bain-marie à 160 °C, **puis refroidir
  plusieurs heures** avant de démouler », et aucun minuteur ne porte ces heures-là. La durée
  ÉCOULÉE de la recette les ignore. Correction : couper l'étape en deux, la seconde en
  `timer_type: repos`. ✅ **Les jumelles ont été cherchées, et il n'y en a pas.** Sur les
  **6 étapes** du catalogue dont le texte annonce un repos long (« plusieurs heures », « une
  nuit », « N h »), **5 portent déjà `timer_type: repos`**. `flan_oeufs_caramel` est le seul cas.
  L'entrée précédente supposait « un geste d'écriture, donc probablement d'autres du même moule » —
  la mesure dit l'inverse. ⚠️ **Rejouer** : parcourir `catalog/recipes/*.yaml`, croiser le texte
  des étapes avec `timer_type`. **Un défaut supposé systémique se compte avant de se traiter.**

### Calibrations non faites (pas des bugs)

- ✅ **λ EST CALIBRÉ — 2026-08-07. `DEFAULT_MMR_LAMBDA` passe de 0,4 à 0,3.** C'était le dernier
  nombre du moteur posé au jugé : tout le reste (signature, pondération de similarité, récence,
  couverture nutritionnelle) avait été corrigé par mesure, celui-là venait d'une intuition de
  conception. Banc : `npm run engine:calibrate-lambda`, 288 configurations (4 créneaux × 3
  archétypes × 3 régimes × 8 graines) × 11 valeurs de λ, listes de 5, sur 305 recettes.
  ⛔ **LE GENOU NE POINTE PAS λ, IL LE BORNE — ET C'EST UNE RELECTURE ADVERSE QUI L'A ÉTABLI, LE
  JOUR MÊME.** Le critère (distance au point idéal, normalisée min-max) se recale sur les bornes
  réellement balayées : 0,2 en balayant jusqu'à 0,6 · 0,3 jusqu'à 1,0 et 2,0 · **0,5 jusqu'à 5,0**.
  La première rédaction annonçait « 0,3, stable » sur la foi d'un balayage arrêté à 2,0, et
  justifiait cette borne par « à 2,0 la pénalité peut annuler un score parfait » — vrai, mais vrai
  aussi dès 1,0 : **l'argument aurait légitimé n'importe quelle borne.** Le banc balaie désormais
  jusqu'à 5,0 et affiche les quatre fenêtres, pour que la dépendance soit dans la SORTIE.
  **Ce que la mesure établit : λ ∈ [0,2 ; 0,5].**
  **Le repère qui tranche est le seul que la méthode ne fabrique pas** : le plus petit λ qui vide
  TOUTES les listes servies de leurs doublons (> 60 %) vaut **0,2**, aux quatre créneaux —
  petit-déjeuner (43 recettes) compris, ce pour quoi les quatre créneaux étaient au plan.
  **0,3 est ce seuil plus un pas de marge**, le catalogue sur lequel il est mesuré étant appelé à
  grossir.
  ⛔ **UN CRITÈRE A ÉTÉ ÉCRIT, PUIS RÉFUTÉ, ET C'EST LE PLUS INSTRUCTIF DU LOT.** La première
  version du banc retenait « le dernier λ dont le pas d'échange reste rentable », rentable voulant
  dire plus d'un point de redondance gagné par point de score payé. Ce seuil compare deux échelles
  non commensurables — la redondance bouge de ~29 points sur le balayage, le score de ~2 — donc le
  rapport dépasse 1 PARTOUT et le critère désignait mécaniquement la plus grande valeur balayée. Il
  aurait dit λ = 10 si on avait balayé jusqu'à 10. **Un critère qui ne peut rendre qu'une seule
  réponse n'est pas une mesure** ; il reste affiché à titre indicatif, il ne tranche plus rien.
  ⚠️ **LA MESURE N'EXCLUT PAS 0,4** — elle ne le désigne jamais, ce qui n'est pas la même chose, et
  0,4 tombe dans [0,2 ; 0,5]. Il coûtait 0,19 point de score de plus pour 1,7 point de redondance de
  moins. **Ce qui change n'est pas la qualité des suggestions — c'est qu'une constante non mesurée
  est devenue mesurée.**
  ⚠️ **Trois nuances de la relecture adverse, à ne pas perdre.** **(a)** L'écart 0,3/0,4 **n'est pas
  du bruit de tirage** : test apparié à graines égales, t = 5,4 sur la redondance, t = 6,0 sur le
  score — l'objection « 8 graines ne suffisent pas » est réfutée, pas écartée. **(b)** L'impact en
  score est petit, **la surface ne l'est pas** : **89,9 % des 288 configurations rendent une LISTE
  différente** entre 0,3 et 0,4. Dire « l'écart est petit » sans cela laisserait croire que presque
  rien ne bouge. **(c)** Le banc mesure à **historique vide**, donc il **sous-estime la redondance
  d'environ 1 à 2 points** pour quelqu'un aux habitudes concentrées ; l'ordre entre les λ ne
  s'inverse pas pour autant.
  ✅ **REMESURÉ le 2026-08-07 sur les 282 recettes** (`npm run engine:similarity`) — la mesure
  précédente datait de **212** et cette ligne demandait de la rejouer avant de figer λ, c'est fait :
  **39 621 paires · max 94,2 % · p99 36,5 % · médiane 9,0 % · moyenne 10,2 % · 51 paires > 60 %.**
  ⚠️ **Le résultat utile n'est pas le chiffre, c'est sa STABILITÉ** : les paires > 60 % passent de
  30/22 366 à 51/39 621, soit **0,134 % → 0,129 %**. Grossir le catalogue de 33 % n'a pas déplacé la
  distribution — le socle de mesure de λ ne bougera donc pas à chaque lot de contenu, et il n'y a
  plus lieu de reporter la calibration en attendant « plus de recettes ».
  ✅ **Troisième point de mesure, 2026-08-07 après la décision 62** (305 recettes) : **46 360 paires ·
  max 94,2 % · p99 36,3 % · médiane 9,5 % · moyenne 10,4 % · 58 paires > 60 %**, soit **0,125 %**.
  ⚠️ **Cette mesure-là répondait à une question précise** : remplir la facette `cuisine` fait passer
  `internationale` de 14 à 28 recettes, et `cuisine` pèse 0,05 dans la similarité (décision 32) —
  donc 14 plats du petit-déjeuner pouvaient se rapprocher les uns des autres jusqu'à 5 points. **Ils
  ne l'ont pas fait** : le taux baisse encore, le maximum ne bouge pas, et aucune des 6 paires les
  plus proches ne sort des 23. **Mesuré, pas déduit du poids.**
  ⛔ **CE QUI BLOQUE ENCORE, ET C'EST AUTRE CHOSE** : choisir λ demande de VOIR la similarité des
  recettes retenues, que le banc n'affiche plus (voir « Défauts connus »). C'est le seul préalable
  restant, et il coûte un champ de diagnostic sur un type public — **à arbitrer, pas à faire en
  passant**.
- ✅ **`varietyMode` EST OBSERVABLE AU BANC depuis le 2026-08-07** — `npm run engine:try --
  --historique <r1,r2,…>`. La cause diagnostiquée ici était la bonne : un historique **vide**, pas
  un catalogue pauvre. **Mesuré, avec `--variete auto`** : sans historique, `variété` vaut **7,5 à
  plat sur tout le classement** ; avec trois repas récents, elle vaut **15,0** sur les recettes non
  consommées et **le classement change entièrement**. Contre-épreuve : en injectant exactement les
  trois recettes de tête, **les trois disparaissent du top 5**.
  ⚠️ L'en-tête du banc affiche désormais « Historique : (vide — variety et habit sont INERTES) ». Le
  silence sur ce point avait fait conclure pendant des semaines que le CATALOGUE était en cause.
  ⚠️ `origine: 'choisi'` pour les entrées injectées — seule valeur qui exerce `habit` ET `variety`
  (acquis n°1). Un banc qui n'exercerait que `variety` demandera un second drapeau, pas un autre défaut.
- **`NUTRI_MIN_COVERAGE = 0,7` est un seuil de JUGEMENT**, pas de mesure — contrairement à tous les
  autres seuils du moteur. Aucun jeu de cas jugés n'existe pour « ce nutriment est-il notable ».

### Code mort ou dupliqué

- ✅ **`food_nutrient.code_confiance` est LU depuis le 2026-08-07** — l'entrée qui vivait ici disait
  « REMPLI ET JAMAIS LU », cinquième occurrence du défaut signature du projet (`note_allergene`,
  `Recipe.service`, `ratio`/`contexte`, `dernier_export_le`). Elle est close par l'**issue (ii)**,
  la seule des trois qui rendait la cote utile : `ui/screens/aliment.tsx`, route `#/aliment/<id>`.
  Les deux autres restent écartées pour la raison qui les avait fait écrire — (i) annoter l'énergie
  produirait une mention constante sur 97 % du catalogue, (iii) attendre revenait à ne jamais rien
  afficher, puisque **aucun écran ne montrait de valeur par ALIMENT** et qu'aucun n'était prévu.
  ⚠️ **Ce qui reste à savoir avant d'y toucher** est dans l'en-tête de `ui/screens/aliment.tsx` :
  les teneurs passent par `afficher_macros` (§6.5, un seul interrupteur), la cote s'affiche **en
  lettre nue avec la définition ANSES citée verbatim**, et **aucune cote ne devient jamais une note,
  une couleur ni un tri**.
  ⛔ **Le sens de la cote a été corrigé le 2026-08-07** — voir la décision 33 : elle annonce une
  FIABILITÉ (« de A=très fiable à D=moins fiable »), pas une provenance, et **B et C n'ont aucune
  définition publiée**. Une première version de cet écran leur avait inventé des libellés.

- **`recipeMainIngredient` n'est lu par AUCUNE couche** depuis §6.6 bis. Calculé à l'init, employé
  seulement par les bancs de comparaison qui documentent son abandon. À supprimer si l'on fige ces bancs.
  ⚠️ **Lecteurs RÉELS, vérifiés le 2026-08-07** (`grep -rn recipeMainIngredient`) — exactement deux,
  et ce sont bien des bancs : `app/src/cli/compare-similarite.ts` (l. 121-122) et
  `app/src/cli/compare-variety.ts` (l. 29). Partout ailleurs c'est de la construction d'index
  (`nutrition/derived-indexes.ts`, `main-ingredient.ts`), une `Map` vide de fixture, ou un
  commentaire qui met en garde contre lui.
  ⛔ **NON SUPPRIMÉ, ET C'EST DÉLIBÉRÉ** : effacer du code est irréversible sans git et « figer ces
  bancs » est une décision de produit, pas de ménage. La suppression toucherait l'index, son calcul,
  ses fixtures et les deux bancs — **à demander explicitement.**
- **Le lexique banni existe en deux copies** (`catalog/build.mjs`,
  `app/src/engine/guards/banned-terms.ts`), synchronisées par `tests/banned-terms-consistency.test.mjs`.
  Si ce test disparaît, la duplication devient dangereuse.
- ✅ **`ENGINE_VERSION` reste codé en dur, mais NE PEUT PLUS diverger** (2026-08-07).
  `tests/engine-version-consistency.test.mjs` compare la constante d'`api/index.ts` à
  `package.json`. La constante ne peut pas disparaître : §3 ENGINE interdit toute I/O à `engine/`,
  donc y lire `package.json` est structurellement exclu — même motif que les deux copies du lexique
  banni, donc même remède, un test plutôt qu'une fusion impossible.
  ⚠️ **Vérifié par régression volontaire** : la constante passée à `0.1.1` fait rougir le test
  (`expected '0.1.1' to be '0.1.0'`), puis restaurée. Un test de cohérence jamais vu rouge ne prouve
  rien. ⚠️ Les deux valent `0.1.0` aujourd'hui : **elles n'avaient pas divergé**, la dette était le
  risque, pas un écart constaté.

### Défauts connus, non corrigés

- ⚠️ **LE TEMPS AGRÉGÉ IGNORE LES REPOS — mesuré le 2026-08-09, non corrigé.**
  `tempsPrepMin + tempsCuissonMin` est additionné en **8 sites** (`search/index.ts:259`,
  `scoring/speed.ts:30`, `selection/temps.ts:33`, `ui/rappel.ts:110`, `ui/screens/cuisine.tsx:113`,
  `recettes.tsx:371`, `detail-recette.tsx:331`) et **aucun ne lit les timers `repos`**. Une marinade
  de 12 h reste donc invisible du filtre « Temps maximum » et de la couche `temps` : l'application
  annonce 20 min pour une recette qu'on ne peut pas servir avant le lendemain. ⛔ **Ce n'est pas un
  trou de contenu** — les **97 étapes** `timer_type: repos` sont **toutes chiffrées** (zéro
  `timer_s: null` au 2026-08-09, les 8 trous relevés ont été comblés) ; c'est le calcul
  agrégé qui ne les regarde pas. Chantier `app/src/`, hors du périmètre du lot de contenu qui l'a
  trouvé.
- ⚠️ **`Food.piquant` EST REMPLI SANS ÊTRE BRANCHÉ — assumé, écrit ici pour ne pas être compté deux
  fois.** 21 aliments annotés le 2026-08-09 (dont 5 « faux amis » à `0`), et **personne ne les lit** :
  ni le moteur, ni l'UI. `catalog.ts:433` interdit d'ailleurs explicitement d'en dériver
  `Recipe.piquant` (« ce serait faux » — un plat n'est pas la somme du piquant de ses ingrédients).
  La valeur sert la fiche aliment et l'export. ⛔ **C'est le piège « un champ déclaré n'est pas un
  champ branché » de `PIEGES.md`, ici EN CONNAISSANCE DE CAUSE** — ne pas le recompter comme une
  occurrence de plus, et ne pas « réparer » l'absence de lecteur en dérivant le piquant des recettes.
- ⚠️ **UN COMMENTAIRE D'`export-recette.ts` EST DEVENU FAUX LE 2026-08-09.**
  `app/src/data/export-recette.ts` porte « `imagePath` toujours `null`, il n'y a rien à embarquer ».
  Il était vrai jusqu'à l'arrivée des photos ; il ne l'est plus. **Le code, lui, est correct** —
  il n'embarque toujours rien, et c'est le comportement voulu tant que la question de l'attribution
  qui voyage avec l'image n'est pas tranchée (§3 « Média »). **C'est le commentaire qui ment, pas la
  fonction.** Non corrigé ici : le fichier appartient à une autre piste, et le signaler vaut mieux
  que le retoucher au milieu d'un lot de photos.

- ⚠️ **`vite-plugin-sw.ts` EST CLASSÉ BINAIRE PAR GIT — un octet NUL littéral vit dans son code.**
  Trouvé le 2026-08-09 : `versionDuCache` sépare l'URL de l'empreinte par `\0` et non par un espace
  (`` `${e.url}\0${e.empreinte}` ``). Conséquence : `git diff` affiche `Bin 7706 -> 9900 bytes` et
  `git blame` ne rend plus rien de lisible **sur le fichier qui génère le service worker**. **Ni
  introduit ni aggravé par le lot photos** — vérifié : absent de `eec24f8` (commit d'origine du SW),
  présent dans `da8e3b8` (« sept défauts trouvés en relisant l'application »). ⛔ **NON CORRIGÉ
  DÉLIBÉRÉMENT** : c'est une fonction pure sous test de régression, et remplacer le séparateur change
  l'entrée du haché ⇒ **nouvelle version de cache ⇒ un re-téléchargement complet imposé à tout
  utilisateur ayant installé l'application**. Le geste est d'une ligne, son coût ne l'est pas : à
  grouper avec un lot qui fait de toute façon tourner la version du cache.

- ⚠️ **`regimeExigePar` CLASSE UN EXTRAIT DE VIANDE COMME UN PRODUIT LAITIER.** Trouvé le 2026-08-08
  en écrivant `sauce-poivre.yaml`. **Le fait brut** : `app/src/engine/selection/regime.ts` ne rend
  `omnivore` que lorsque `food.groupe === 'viandes'` ; tout ce qui porte `origine_animale:
  mammifere` **hors de ce groupe** est traité comme un dérivé de type laitier, donc compatible
  végétarien. Vrai pour le beurre et la crème, **faux pour `bouillon_boeuf`**, qui vit dans le
  groupe `condiments`. Une recette qui en contiendrait pourrait donc se déclarer végétarienne sans
  qu'aucun test ne rougisse. ✅ **LATENT, PAS VIVANT — et c'est vérifié, pas supposé** : aucune
  recette du catalogue n'emploie `bouillon_boeuf` ni `bouillon_volaille`. ⛔ **NON CORRIGÉ
  DÉLIBÉRÉMENT.** `regime` est une couche 🔒 `critical` ; la toucher au milieu d'un lot de contenu
  sur les sauces mélangerait deux risques sans rapport. Le contournement retenu — la sauce au poivre
  est passée au bouillon de LÉGUMES, avec un commentaire dans le YAML qui pointe ici — n'est pas la
  correction. ⚠️ **Deux issues possibles, non tranchées** : faire lire `origineAnimale` à
  `regimeExigePar` indépendamment du `groupe`, ou déplacer les bouillons de viande hors de
  `condiments`. La première est plus juste, la seconde plus petite ; les deux demandent de rejouer
  `engine:plan-stress` et le banc d'exclusion.

- ✅ **LE LOT « SAUCES » EST LIVRÉ — ①②③④, ET CHAQUE POINT EST PROUVÉ PAR UN `git log --all -S`.**
  Reconstruit et commité le 2026-08-09 au soir, après que cette même entrée eut annoncé le contraire
  pendant deux jours (voir « ce qui s'était passé » plus bas — la leçon est conservée, elle a coûté
  un lot entier).

  **Preuve, la seule qui vaille ici** — un identifiant de code par point, trouvé dans *ce* commit :
  ```
  ① user_recipe_sauce · readSaucesChoisies · saucesParRecette · pourSauces  → f6a65d5
  ② saucesSeules      · recettesSauces     · nomSauce                       → fea703f
  ③ hrefCuisiner                                                            → c2917b0
  ④ estSauce (SaisieRecette) · QuestionNature                               → 30a4964, c457694
  Phase 1 : <SaucesAAjouter rendu dans le JSX                               → e2a5596
  USER_SCHEMA_VERSION = 14 (migration comprise)                             → f6a65d5
  ```
  **Relevé pris sur l'arbre commité** (2026-08-09, `c457694`) : `npm test` **1 901 passed / 0 failed
  (97 fichiers)** · `npm run typecheck` propre · `npx vite build` ✓ (2,84 s) ·
  `npm run engine:plan-stress` **20/20**.

  ⚠️ **Trois écarts de ce lot par rapport à ce que cette entrée spécifiait, tous assumés et
  arbitrés** — les laisser tacites reproduirait exactement la dérive du 7 août :
  1. **La section « sauce » des courses est en « Repas » ET en « Jour »**, alors que §3 disait
     « Repas uniquement ». Motif mesuré et décision utilisateur du 2026-08-09 au soir : §3 est
     corrigée, pas contournée.
  2. **③ n'a coûté AUCUN changement de schéma** — la v13 portait déjà tout (`SousVue.cuisine` avec
     sa liste, `hashDeLaCuisine(id, portions, avec[])`, `ordonnancerCuissons`). Cette entrée l'avait
     chiffré comme une migration `user.db`. **Remesurer une dette avant de la payer.**
  3. **④ a livré, en plus de la question, une bande « Un plat / Une sauce » modifiable en tête de
     formulaire** — la seconde moitié du sixième piège ci-dessous, qui aurait été oubliée sans lui.

  **CE QUI S'ÉTAIT PASSÉ, à ne pas effacer.** L'entrée disait « FERMÉ EN ENTIER — ①, ②, ③ ET ④ »,
  avec quatre ✅ et un relevé vert de 1 940 tests, alors que le code de ②, ③ et ④ n'existait dans
  **aucun commit du dépôt**. Mesuré à la rectification :
  ```
  USER_SCHEMA_VERSION = 13                                    (l'entrée annonçait v14)
  user_recipe_sauce · readSaucesChoisies · setSauceChoisie
  saucesParRecette  · pourSauces         · saucesSeules       → 0 occurrence dans app/src
  git log --all -S "<chacun d'eux>"      → f20382b, ca426ae   → deux commits de DOC, zéro de code
  editeur-recette.tsx                    → le mot « sauce » n'y apparaît pas une fois
  ```
  ⚠️ **CE N'EST PAS UN `reset` MALHEUREUX.** Un travail emporté par le `git add` d'une lane voisine
  atterrit quand même dans *un* commit, et `-S` l'y trouverait. Ici il n'y a rien à trouver : la lane
  sauces a commité sa documentation et son récit, son code n'est jamais arrivé. Le commit `f20382b`
  appartient à la lane quantités/portions et a emporté les lignes de doc au passage — voir §7,
  « l'index est partagé ». ⛔ **La règle qui en sort : ne jamais écrire un ✅ ici sans
  `git log --all -S` sur un identifiant du code concerné.** Un compte de tests vert ne prouve rien —
  celui de 1 940 était vrai sur un arbre qui n'a jamais été poussé.

  **LES FONDATIONS** (lot ①, `d85fc42`) : le catalogue — 3 recettes de sauce, 14 attachements
  plat→sauce, 10 aliments `sous_groupe: sauce` — `engine/domain/sauces.ts`, `Engine.suggestSauces`
  avec ses exclusions et son garde-fou allergènes, et les champs de domaine `Recipe.estSauce` /
  `porteDejaUneSauce` / `sauceIds`. Elles n'avaient jamais bougé ; tout ce qui suit est **au-dessus**
  d'elles.

  **CE QUI A ÉTÉ CONSTRUIT PAR-DESSUS**, dans l'ordre des commits :
  - **① la préférence durable** (`f6a65d5`) — table `user_recipe_sauce (recipe_id, sauce_recipe_id)`,
    schéma **v14** + migration, `readSaucesChoisies`/`setSauceChoisie`, option
    `ShoppingOptions.saucesParRecette` et champ `ShoppingListItem.pourSauces` : une sauce retenue
    entre dans les courses chaque fois que son plat est prévu.
  - **② la visibilité** (`fea703f`) — bouton « Sauces (N) » dans l'écran Recettes
    (`BrowseRequest.saucesSeules`, **exclusif** avec « Mes favoris », qui gagne) et section par sauce
    dans les courses **en rangements « Repas » ET « Jour »** (voir §3, et l'écart n° 1 ci-dessus).
    ⚠️ La boucle des sauces va **sous** le garde `isLeftover` : un reste ne se rachète pas, sa sauce
    non plus. ⚠️ Le titre d'une section de sauce est le **nom de la sauce, seul** — pas d'article à
    accorder, et les titres de repas contiennent tous un « · » quand ceux des sauces jamais.
  - **③ cuisiner la sauce avec le plat** (`c2917b0`) — un lien par ligne de sauce, qui remplit la
    **même liste `avec`** que « cuisiner avec un autre plat ». Aucun second chemin : la v13 portait
    déjà tout. ⚠️ Le lien **n'apparaît que si le plat a au moins une étape `geste`** (`cuisinable`) —
    sinon il ouvrirait un mode cuisine sans rien à y faire. Aucune recette du catalogue n'est à la
    fois saucable et sans geste (0 ligne en SQL sur `catalog.db`) : **ce garde n'est pas couvert par
    une donnée réelle**, il l'est par un test monté à la main.
  - **④ les sauces perso** (`30a4964`, `c457694`) — l'éditeur demande **avant le formulaire** « un
    plat ou une sauce ? », et `problemes()` cesse d'exiger un créneau **pour une sauce seulement** ;
    sans cette exception, la règle et la décision 62 se contredisent et aucune sauce perso n'est
    enregistrable. La réponse **reste affichée et modifiable** en tête de formulaire, et basculer
    vers « une sauce » **vide `typesRepas`**. `StoredUserRecipe.estSauce` est **facultatif**,
    `schemaVersion` **reste à 1** (piège 3 ci-dessous). ⚠️ « Attacher une sauce à une recette perso »
    n'a rien demandé : ① l'avait déjà livré, `suggestSauces` rendant toutes les sauces dans `autres`
    et une recette perso étant une recette comme une autre.

  **LES SIX PIÈGES, MAINTENANT PAYÉS OU VÉRIFIÉS** — conservés parce qu'ils se repaieraient à
  l'identique, et parce que le sixième est tombé pendant la reconstruction, exactement comme annoncé :
  1. ⛔ **Les deux boutons d'une ligne de sauce sont DEUX décisions et doivent le rester** : celui du
     haut est durable (`user_recipe_sauce`, on l'achète toutes les semaines), celui du bas meurt au
     démontage de la fiche. **Les fusionner ferait ACHETER une sauce à qui voulait seulement la
     préparer ce soir.** ✅ Verrouillé **dans les deux sens** par `detail-recette.test.tsx` :
     « SENS 1 — cuisiner la sauce ce soir n'écrit RIEN dans les courses » et « SENS 2 — retenir la
     sauce pour les courses ne change pas ce lien ».
  2. ⛔ **Ne jamais confondre `Recipe.sauceIds` et `user_recipe_sauce`** : le catalogue **propose**,
     l'utilisateur **choisit**. `sauceIds` **RESTE VIDE** sur une recette perso — les mêler ferait
     s'effondrer la distinction précisément là où elle porte.
  3. ⚠️ **`schemaVersion` de la recette perso RESTE À 1** — respecté : `StoredUserRecipe.estSauce`
     est **facultatif**. `analyserAvecMotif` REFUSE net toute autre version avec un message à
     l'écran : passer à 2 rendrait illisible chaque recette perso déjà enregistrée **et** ferait
     rejeter par une version antérieure tout `.nutri-recipe` exporté par celle-ci (§8.7). Absent se
     lit `undefined`, donc « un plat, rien de dit sur sa sauce » — verrouillé par le test « une
     recette perso enregistrée AVANT la question reste un plat ». ⛔ **Ne pas confondre avec
     `USER_SCHEMA_VERSION`**, passé à **14** : ce sont deux versions différentes, l'une du fichier
     échangé, l'autre de la base locale.
  4. ⚠️ **La garantie de la décision 62 s'applique à UN SEUL endroit, `versRecette`**, qui force
     `typesRepas: []` et `service: null` sur une sauce ; la forme stockée garde la saisie telle
     quelle. Deux points d'application finiraient par diverger, et c'est `versRecette` qui construit
     le domaine — une entrée bricolée à la main ne peut donc pas faire entrer une sauce dans un dîner.
  5. ⚠️ **`porteDejaUneSauce` a trois états derrière une case, et la traduction n'est pas
     symétrique** : cochée → `true`, décochée → **`null`, jamais `false`**. `null` veut dire
     « personne n'a tranché » et laisse la dérivation par les ingrédients attraper une recette perso
     au ketchup ; `false` affirmerait « je certifie qu'il n'y a pas de sauce », ce que ne pas cocher
     une case ne dit pas. ✅ **`estSauce` est ouvert** (④) ; **`porteDejaUneSauce` reste figé à
     `null` dans `versRecette`, et c'est volontaire** — aucune case ne le demande à l'écran, et
     `null` est justement ce que veut dire « personne n'a tranché ». La case reste à construire le
     jour où l'on voudra le `true`. **Ne pas la câbler sur `false`.**
  6. ⛔ **Une question posée AVANT le formulaire casse le parcours guidé — ET C'EST ARRIVÉ.**
     Annoncé ici, tombé au rouge le 2026-08-09 en écrivant ④, attrapé par `parcours.test.tsx` et
     **par rien d'autre** : « Composer » ouvre sur `#/composer`, donc sur la question, et la
     première bulle n'avait plus rien à désigner. Remède appliqué : `data-visite="titre-composer"`
     porté **aussi** par le titre de la question ; les étapes suivantes se sautent tant que la
     nature n'est pas tranchée, comportement prévu par `parcours.ts`. **Toute question déplacée en
     amont d'un écran se vérifie contre les ancres de son parcours.** La seconde moitié du piège —
     le type doit rester **affiché et modifiable** en haut du formulaire, y compris sur une recette
     rouverte des mois plus tard — a été livrée par `c457694`.

- ✅ **`SaucesAAjouter` EST RENDU** (`e2a5596`, 2026-08-09) — quatrième occurrence fermée du défaut
  « un champ déclaré n'est pas un champ branché ». Le composant, `VueSauces`, `LienSauce` et le
  chargement `lireLesSauces` existaient tous ; **`<SaucesAAjouter` n'apparaissait nulle part dans le
  JSX**. Le moteur était interrogé à chaque ouverture de fiche et sa réponse jetée. La section
  « Ajouter une sauce » n'avait jamais existé à l'écran.
  ⛔ **CE QUE CETTE ENTRÉE A COÛTÉ, à garder.** Elle a d'abord annoncé « Corrigé, et verrouillé par
  `describe('detail-recette — le panneau « Ajouter une sauce » (v14)')` » — **ce `describe`
  n'existait pas**, et `detail-recette.test.tsx` ne contenait pas une occurrence du mot « sauce ».
  Un correctif annoncé avec le nom de son propre test de non-régression, ni l'un ni l'autre dans
  l'arbre : c'est la forme la plus coûteuse de la dérive de ce document, parce qu'elle éteint le
  soupçon. ⚠️ **Rien d'automatique ne pouvait le signaler** : le typecheck est content d'un champ
  rempli et jamais lu. **La leçon n'est pas « mieux relire »** — c'est qu'un lot d'interface sans un
  seul test d'écran ne prouve rien de ce qu'il annonce, et qu'un ✅ se confronte au code avant d'être
  écrit. ⚠️ **Ce `describe`-là n'a jamais été créé, et ne le sera pas** : le nommer aujourd'hui
  donnerait raison après coup à une entrée fausse. La couverture réelle vit sous trois autres noms,
  vérifiables dans l'arbre — `'detail-recette — les sauces à ajouter'`, `'… — retenir une sauce pour
  les courses (v14)'` et `'… — cuisiner une sauce avec le plat'`, ce dernier portant les deux sens
  du piège 1 ci-dessus.

- ⚠️ **L'ÉCRAN RECETTES SE RE-REND UNE FOIS DE TROP APRÈS SA PREMIÈRE PEINTURE.** Trouvé le
  2026-08-08 **par accident**, en relevant la mesure d'appareil de la décision 61 — aucun test ne le
  voit, et aucune impression à l'usage ne le signalait. **Le fait brut** : à 305 recettes, l'encadré
  affichait `montage 73 ms · rendu 116 ms`. C'est **géométriquement impossible pour une même passe**
  — la fenêtre de `rendu` est incluse dans celle de `montage`, les deux se terminent à la même
  peinture, donc `rendu ≤ montage` toujours. Le 116 vient donc d'une passe **postérieure**, qui
  reconstruit les 305 cartes et **coûte plus cher que le chargement complet de l'écran**
  (catalogue compris). ✅ **L'OUTIL N'EST PAS EN CAUSE, et c'est vérifié plutôt que supposé** :
  l'ordre est correct à 500 (`106 < 136`) et à 1 000 (`163 < 210`). Le constat est isolé au premier
  chargement. ⚠️ **CAUSE NON IDENTIFIÉE — ne pas partir de l'hypothèse la plus flatteuse.** Trois
  candidats non départagés : un `setState` d'après-montage dans `screens/recettes.tsx`, une
  ré-exécution des `useMemo` de `resultat`/`comptes` sur une dépendance recréée à chaque passe, ou
  un effet du socle qui se règle après la première peinture. ⛔ **CE N'EST PAS UN PROBLÈME DE
  PERFORMANCE À L'ÉCHELLE DE LA 61** — 116 ms invisibles à l'usage — **et ce n'est pas une raison de
  le laisser** : c'est une passe de rendu complète que personne n'a demandée, sur l'écran le plus
  lourd de l'application. Elle coûtera proportionnellement plus cher à chaque lot de contenu.
- ⚠️ **UNE MISE À JOUR N'ATTEINT L'UTILISATEUR QU'APRÈS FERMETURE COMPLÈTE DE L'APPLICATION, ET RIEN
  NE LE LUI DIT.** Trouvé le 2026-08-08 en outillant la mesure de la décision 61, pas en cherchant
  ce défaut. Deux faits qui se composent : le `sw.js` généré par `vite-plugin-sw.ts` n'appelle
  **jamais** `skipWaiting()` — choix délibéré et bien argumenté dans `ui/sw-register.ts` (basculer
  seul remplacerait les fichiers sous les pieds de quelqu'un en train de composer sa semaine) — et
  `ui/main.tsx:425` appelle `enregistrerServiceWorker()` **sans rappel**, donc le `surMiseAJour`
  prévu pour proposer le rechargement est `undefined`. ⛔ **Le raisonnement de `sw-register.ts` était
  « on SIGNALE, et c'est l'appelant qui propose de recharger » — et l'appelant ne propose rien.**
  C'est encore le défaut maison : **un champ déclaré n'est pas un champ branché**, ici un rappel
  déclaré, typé, documenté, et jamais passé. ⚠️ **Recharger la page NE SUFFIT PAS** : le service
  worker en attente ne prend la main que lorsque plus aucun client de l'ancien ne vit. Conséquence
  pour l'utilisateur : un catalogue corrigé peut rester invisible plusieurs sessions, alors que §7.1
  ARCHITECTURE décrit les données comme un canal de mise à jour à part entière. ⚠️ **NON CORRIGÉ
  EXPRÈS** : le correctif n'est pas « ajouter `skipWaiting()` » — ce serait défaire le choix motivé
  ci-dessus. C'est brancher le rappel sur un bandeau « une nouvelle version est prête · Recharger »,
  et lui faire envoyer un message au worker en attente. C'est un arbitrage d'interface, pas une
  ligne. ✅ **Ce que ça a déjà coûté, et qui est réparé** : le protocole de mesure de la 61 disait de
  reconstruire le bundle entre chaque relevé — les trois auraient servi le même `catalog.db`,
  produisant une **pente plate** lisible comme « aucune croissance, donc ne pas virtualiser ». Trois
  ports, donc trois origines, suppriment le problème au lieu de l'éviter (`RETOUR_ESSAI_TELEPHONE.md`
  §0, `catalog/preparer-mesure-61.mjs`).
- **Le lexique banni sur-bloque** : la garde cherche des SOUS-CHAÎNES, donc « rincer
  **soigne**usement » est rejeté à cause de `soigne`, et « une huile ex**traite** à froid » à cause
  de `traite`. Contourné en reformulant, jamais corrigé — le corriger demanderait un appariement par
  mot exact plus des listes de conjugaison complètes, soit un échec sûr échangé contre un dangereux.
  ⚠️ **Cette ligne n'a dit que la moitié du défaut jusqu'au 2026-08-05.** Le même choix de
  sous-chaîne SOUS-bloquait, et personne ne l'avait mesuré : `guérit`/`guérir` n'attrapaient ni
  « guérison », ni « guérissent », ni « guéri » ; `thérapie` n'attrapait pas « thérapeutique » ; et
  l'entrée-phrase `prévient la maladie` n'attrapait que ses propres mots littéraux — donc ni le
  pluriel, ni « prévient le cancer ». Cinq fuites, dans la famille même que la garde existe pour
  arrêter. **Corrigé** : chaque entrée est ramenée au radical le plus court qui couvre sa famille
  (`guéri`, `thérap`, `prévient`), et `soigner`/`traiter` — morts, sur-chaînes de `soigne`/`traite` —
  sont retirés. La propriété « aucune entrée n'est sous-chaîne d'une autre » est verrouillée par
  `guards/index.test.ts`.
- ⚠️ **La garantie de non-divergence des deux copies du lexique ne portait que sur les LISTES**
  jusqu'au 2026-08-05, alors que l'en-tête de `guards/banned-terms.ts` la présentait comme *la*
  garantie. `normalize()` et `findBannedTerms()` sont dupliquées elles aussi : une divergence de
  normalisation laissait `tests/banned-terms-consistency.test.mjs` parfaitement vert. Le test compare
  désormais les deux **implémentations** sur un corpus (vérifié en cassant une copie : les deux tests
  de liste restent verts, seul le nouveau rougit).
- **L'explication distingue peu** : les cinq suggestions affichent souvent les mêmes trois phrases,
  seul l'ordre change. Honnête, mais peu utile pour choisir (sujet UI, P5).
- ✅ **Le banc réaffiche la similarité — 2026-08-07, et l'arbitrage annoncé n'a pas eu lieu parce
  qu'il n'était pas nécessaire.** Cette entrée posait un choix entre deux types publics et le
  renvoyait à l'utilisateur : `ScoredSuggestion` (« contrat documenté §8.2 ») ou `EngineDiagnostics`
  (« qui est plat, alors que l'information est par suggestion »). **Les deux prémisses étaient
  fausses.** `EngineDiagnostics` n'a pas à rester plat — il porte désormais
  `diversification: { lambda, maxSimilarities } | null` — et surtout le choix n'était pas ouvert :
  poser une similarité sur `ScoredSuggestion`, c'est-à-dire sur **ce que l'interface rend**, finit
  en nombre affiché à côté d'un plat, soit exactement le piège « ne jamais afficher le score du
  moteur » (principe 6). Une seule des deux issues était admissible.
  ⚠️ **Et rien n'a été calculé pour ça** : `diversify` produisait `maxSimilarityToRetained` depuis
  toujours, `suggestMeals` le jetait en retypant son résultat en `{ recipeId, score }`. Le coût réel
  était **une ligne de retypage**, pas un arbitrage d'API. ⚠️ **`try-engine.ts` réaffiche la
  proximité** — « — » au premier rang et jamais « 0 % » : le zéro y est une convention, pas une
  mesure.
- ⚠️ **`roquefort` porte l'allergène `lait` mais pas `sulfites`** — vérifié encore exact le
  2026-08-07 (`catalog/sources/foods.yaml`, un seul allergène déclaré).
  ⛔ **MAIS CETTE LIGNE N'EST PAS SOURCÉE, et après la leçon du même jour sur les cotes de confiance
  il faut le dire** : rien dans le dépôt n'établit que le roquefort CONTIENT des sulfites à un
  niveau déclarable au titre du règlement UE n° 1169/2011. Tant qu'une source ne le montre pas,
  **on ne sait pas si c'est un manque ou une entrée fantôme** — et ajouter un allergène non fondé
  sur un aliment traverserait le garde-fou §5.2 dans le mauvais sens (il retirerait des recettes à
  quelqu'un pour rien). ➡️ **Ouvrir la source AVANT de toucher à la donnée**, dans les deux sens.
  Les 9 nutriments, eux, sont un choix assumé (décision 25) et pas une dette.
- ✅ **L'échec de test intermittent EST CARACTÉRISÉ — voir la décision 61 §4**, et cette entrée ne
  le disait pas. Elle est restée « non caractérisé (2026-08-01) » **cinq jours après que la cause
  ait été trouvée** : ce n'était pas un test lent mais de la **contention CPU** (le budget de Vitest
  est du temps d'horloge, 85 fichiers en parallèle), délai porté à 15 s dans `vitest.config.ts`,
  commit `54599c5`. ⚠️ **L'hypothèse écrite ici était juste** — « un `waitFor` de test d'écran qui
  expire sous contention CPU » — elle attendait seulement d'être confrontée à une mesure.
  ⛔ **Ne pas lire ce ✅ comme « réglé »** : la décision 61 est OUVERTE et dit pourquoi — le délai
  traite le symptôme, la cause est que `recettes.tsx` monte tout le catalogue dans le DOM, et ce
  coût croît avec lui. **Il a déjà servi une fois, il ne dira plus rien la prochaine.**
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
- ✅ **Deux onglets ne s'écrasent plus** (2026-08-06, décision 59). ~~Chacun tient sa copie de
  `user.db` en mémoire et réécrit le fichier entier ; le dernier qui écrit gagne, sans erreur.~~
  `ui/user-source.ts` prend un verrou `navigator.locks` (`user.db:ecriture`) pour la durée de
  l'onglet ; celui qui ne l'obtient pas **cesse d'écrire et le dit** — quatrième alerte
  `autre_onglet` dans `main.tsx`, non écartable, au même titre que `stockage: 'memoire'`.
  ⚠️ **`ifAvailable: true`, on ne fait PAS la queue** : un `request` bloquant prendrait le verrou à la
  fermeture de l'autre onglet puis écrirait une base en mémoire vieille de plusieurs heures par-dessus
  son travail. L'attente transformerait une collision visible en écrasement différé.
  ⚠️ **`'indisponible'` (pas de `navigator.locks`) retombe volontairement sur l'ancien comportement** :
  refuser d'écrire faute de savoir verrouiller casserait l'application là où elle marchait.
  ⛔ **Le verrou se contournait par un chemin non gardé, TROUVÉ EN RELECTURE et corrigé le même
  jour** : `remplacerLeFichier` (restauration) écrit le fichier sans passer par `planifierEcriture`.
  Un onglet `'partage'` pouvait donc restaurer — puis l'onglet détenteur, qui n'en savait rien,
  écrasait le résultat à sa modification suivante. **Un seul chemin d'écriture non gardé suffit à
  rouvrir la perte que le verrou ferme.**
- ⚠️ **La dernière modification peut être perdue.** L'écriture sur OPFS est différée d'un tour de
  boucle (indispensable pour ne pas exporter au milieu d'une transaction). Fermer l'onglet dans cet
  intervalle perd le dernier geste. Le délai se compte en millisecondes, mais il n'est pas nul.
- ✅ **L'export / import existe** (2026-08-06, décision 59) — §7 ARCHITECTURE mesures 3, 4 et 5.
  ~~`user.db` ne se re-télécharge pas : tant que la sauvegarde manuelle n'existe pas, un effacement de
  stockage est une perte sèche.~~ Fichier `.nutri-backup` depuis Paramètres → « Sauvegarder mes
  données », restauration validée avant remplacement, rappel passé 14 jours.
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
- ✅ **Les écrans sont testés** (commits `568144b`, `bdcd0d3`) — le compte de fichiers `*.test.tsx`
  est **en tête de §8 et nulle part ailleurs**, contre 9 à l'ouverture de cette ligne. La dette
  « zéro test d'interface », n°1 de la fiche de reprise jusqu'au 2026-07-31, est close.
  ⚠️ **Cette ligne et la suivante ont porté « 18 » quand la table disait « 21 » et que la mesure
  donnait 19** — trois valeurs pour un seul fait, exactement la duplication que l'en-tête de §8
  décrit comme *la* dette.
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
- ✅ **`Panneau` PIÈGE LE FOCUS depuis le 2026-08-07** (`ui/panneau.tsx`). `aria-modal="true"` promet
  aux technologies d'assistance que le reste de la page est inerte ; rien ne bornait `Tab` /
  `Shift+Tab`, et **l'attribut mentait** — on sortait de la fenêtre par le haut pour tabuler dans
  l'écran qu'elle recouvre. `Tab` boucle désormais du dernier élément au premier, `Shift+Tab` du
  premier (ou du conteneur, qui reçoit le focus à l'ouverture) au dernier. Couvert par
  `ui/panneau.test.tsx`, **vérifié par régression volontaire** : sans le piège, 3 tests sur 6 rougissent.
  ⚠️ Le contournement `.sr-only:focus` en `z-index: 60` RESTE utile et n'est pas retiré.
  ⛔ **CE QUE LES TESTS NE PROUVENT PAS, ET IL FAUT LE SAVOIR** : jsdom n'implémente pas le
  déplacement natif du focus par `Tab` — `fireEvent.keyDown` notifie l'écouteur sans rien déplacer.
  Les tests ne tiennent que parce qu'ils vérifient un déplacement que NOTRE code exécute. Une
  assertion « aucune combinaison de `Tab` ne sort » a été écrite puis **retirée : elle était verte
  avec ET sans le piège.** Le confinement réel reste à vérifier au clavier sur un vrai navigateur —
  c'est dans les deux passes manuelles déjà dues ci-dessous.
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
- **Écran 4 du premier lancement (« vos goûts ») — NON FAIT**, deux raisons : les photos ne couvrent que 129 recettes sur 330 (relevé en tête de §8), et surtout `user_preference` travaille par ALIMENT quand l'écran propose des PLATS.
  Traduire « j'aime ce curry » en préférences d'aliments (ingrédient caractéristique seul ? tous ?
  quelle pondération ?) est une décision de conception absente des docs — à trancher par mesure,
  pas au jugé, sous peine de fausser le démarrage à froid que cet écran existe pour résoudre.
- **Écran Détail — reste à faire** : ⛔ **LA PHOTO — et c'est désormais le SEUL écran qui n'en montre
  aucune.** L'écran Aujourd'hui les affiche depuis le 2026-08-13 (`f3d4fa1`) ; `detail-recette.tsx`
  déclare la photo hors de son périmètre dans son propre en-tête et n'a pas bougé. C'est la décision
  §4.1 DESIGN (« photo dominante ») appliquée à moitié, **sur l'écran qu'on lit en cuisinant**.
  ⚠️ **La phrase « AUCUN composant ne lit `Recipe.imagePath` » a été vraie du 2026-08-09 au
  2026-08-13 et ne l'est plus** — elle a induit en erreur une lecture du 2026-08-13, en compagnie de
  quatre en-têtes de code qui affirmaient la même chose. Le repli des 201 recettes sans photo est
  tranché et livré : l'aplat de couleur + initiale (`ui/vignette.ts`), qui n'est plus le cas unique
  mais le cas par défaut. ⚠️ **Il reste à décider si ce repli tient en PLEINE PAGE sur la fiche
  détail** — il a été jugé sur une carte, pas sur un écran entier. ✅ **La section « Matériel » est LIVRÉE le 2026-08-09** — cette
  phrase disait « reste aussi la section Matériel (le catalogue n'a aucune table équipement — c'est
  aussi pourquoi la couche `equipement` est inerte depuis P1a) » : les deux moitiés sont périmées,
  voir §3 Moteur. Restent les alternatives d'ingrédients (`suggestAlternatives` exige une `SuggestionRequest` complète
  pour que les substitutions repassent les filtres d'allergènes), les notes locales
  (`user_recipe_note`, table créée sans accesseur), la roue des goûts, « Ajouter à ma semaine ».
- ⚠️ **Les 62 fiches du lexique sont du TEXTE SEUL.** §8.5 les annonce illustrées et §4.6 prévoit
  une animation par geste ; il n'y a ni image ni clip. Le geste se déplie quand même, en texte.
- ⚠️ **Le catalogue n'a NI densité NI marqueur de liquide** (450 aliments au 2026-08-05, aucun des deux). Les
  centilitres ne sont donc pas dérivables : `ui/quantites.ts` les CONSERVE depuis le libellé écrit à
  la main plutôt que de les calculer. Suffisant pour la fiche recette ; insuffisant le jour où il
  faudra convertir une quantité que le libellé n'exprime pas déjà dans la bonne unité.
- ⚠️ **Deux conversions grammes → unité d'usage coexistent.** `shopping-list.ts` convertit en pièces
  et en conditionnements (arrondi d'ACHAT, on achète un légume entier) ; `ui/quantites.ts` met le
  libellé à l'échelle (pas d'arrondi d'achat, on cuisine ce qui est écrit). Elles ne font pas la même
  chose et lisent le même champ `Food.poidsPieceG` — mais si un jour la fiche recette doit rendre des
  pièces, il faudra EXTRAIRE la conversion du domaine, pas la recopier.
  ⚠️ **CE POINT N'A PAS BOUGÉ AVEC LA DÉCISION 41 (2026-08-06), ET IL FAUT LE DIRE** :
  `formaterQuantiteAchat` NOMME ce que `quantiteAffichee` a déjà décidé, elle ne reconvertit rien.
  La troisième conversion redoutée ici n'a pas été créée — mais la réserve reste entière pour la
  fiche recette, qui est l'appelant dont il est question.
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
- ✅ **Les compteurs de pastilles coûtent une requête par facette — MESURÉ le 2026-08-07, et ce
  n'est pas une dette.** Chaque facette est comptée SANS sa propre sélection — sinon choisir
  `française` afficherait `italienne (0)` alors que la retirer ramènerait 19 recettes. Cela fait
  **7 requêtes moteur par rendu** (`recettes.tsx:183-197`). Cette ligne disait « à surveiller si le
  catalogue grossit d'un ordre de grandeur » ; la surveillance a eu lieu : **les 7 requêtes coûtent
  4,1 ms au total, soit 0,59 ms chacune et 0,4 % du montage de l'écran.** Un catalogue × 10 les
  mettrait à ~41 ms. ⛔ **Elles avaient été soupçonnées d'être la vraie cause de la décision 61 —
  elles ne le sont pas**, et c'est une réfutation par mesure, pas un classement sans suite. La cause
  reste le rendu des cartes, à 3,60 ms l'unité.
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
- ✅ ~~**Aucun test d'interface.**~~ **PÉRIMÉE, close le 2026-08-07 en la relisant.** Elle disait
  « Vitest tourne sans DOM ; couvrir un composant React demanderait `jsdom`, donc une dépendance à
  valider » — `jsdom` est en place depuis le 2026-07-31 et les fichiers `*.test.tsx` (compte en tête
  de §8) montent de vrais écrans (`@vitest-environment jsdom`). Elle contredisait la ligne « Les écrans sont testés »
  du même document, cinq sections plus haut, **depuis une semaine**.
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

- **Photos : 129 sur 330** au 2026-08-13 — le compte fait foi en tête de §8, cette ligne ne le
  recopie plus. Le poste n'est plus « chiffré nulle part » : voir §3 « Média » pour l'encodeur et le
  poids mesuré. **Il manque 201 photos**, et le goulot est la **récolte**, pas le tri : le bac est
  de nouveau épuisé — plus une seule candidate non jugée sur les recettes servables — et beaucoup
  des 201 ont déjà vu passer plus de dix candidates sans qu'aucune ne soit gardée. ⚠️ **19 recettes
  n'ont AUCUNE candidate** : aucun tri ne les servira, seule une récolte le peut. ⛔ **« Le build
  échoue si une recette n'a pas de photo » reste INTERDIT tant qu'on n'est pas à 330/330** —
  l'activer maintenant casserait le build de tout le monde pour un travail de contenu qui n'est pas
  fini.
  ✅ **LES 13 PHOTOS DÉCIDÉES ET JAMAIS IMPORTÉES SONT ENTRÉES** (2026-08-13, `f3d4fa1`) — l'écart
  116 → 129 n'a jamais été du tri à faire, seulement un import à relancer, et il aura tenu **deux
  jours de plus que sa cause**. ⚠️ **Le nombre de fichiers sur le disque n'est PAS le nombre de
  photos décidées** : rien ne signalait l'écart, ni test, ni build, ni écran. C'est ce qui l'a laissé
  dormir.
  ✅ **RECADRAGE CARRÉ — LU À L'IMPORT DEPUIS LE 2026-08-13** (`rectangleDuCadre` puis
  `sharp.extract()` avant redimensionnement, sur les dimensions REDRESSÉES par l'EXIF ; 5 tests
  unitaires). L'écran de relecture (`atelier/photos/ui/index.html`) trace le carré, le serveur le
  refuse s'il n'est pas carré **en pixels** (`verifierCadre`, `atelier/photos/serveur.mjs`) et le
  range en fractions `{x,y,w,h}` + `source:{l,h}` dans `decisions.json`.
  ⛔ **MAIS LE GISEMENT EST VIDE : 3 cadres posés en tout, dont UN SEUL sur un `oui`** — la chaîne
  complète cadre → fichier carré n'a donc qu'**un témoin réel** (`hareng-pommes-terre-tiedes`,
  894×894 depuis une source 1280×960). **Poser les 128 cadres manquants est une passe de tri, pas du
  code** — voir `docs/CONCEPTION_PHOTOS_RECETTES.md` lot 2.
  ⛔ **LE CARRÉ N'EST PAS APPLIQUÉ PAR DÉFAUT, ET NE DOIT PAS L'ÊTRE** — voir §3 « Média ».
  ⚠️ **Le serveur valide la FORME du cadre, pas sa TAILLE** : un carré de 26 px de côté a été accepté
  (sur une décision `retirer`, donc sans conséquence). L'écran affiche un avertissement sous 800 px,
  le serveur non. **Toujours à décider maintenant que l'import lit le cadre** — refuser, ou agrandir
  et l'assumer. Aujourd'hui l'import ne regarde pas la taille : un cadre de 26 px passerait.
- ✅ **Lexique — RÉSOLU** (décision 43) : 4 → **62 gestes**, 763 étapes annotées sur 1 097.
  ⚠️ **Reste « illustré »** : §2 ARCHITECTURE promet un lexique *illustré*, les 62 fiches sont du
  texte seul. Dépend des visuels.
- ✅ **`Recipe.piquant` est renseigné sur les 297 recettes** (2026-08-07, décision 35) — 286 à `0`,
  11 à `1`, et **rien au-dessus** : le catalogue n'a aucun plat qui dépasse « un peu ».
  ⚠️ **CE QUI RESTE, ET QUI EST DU CONTENU, PAS DU CODE** : l'annotation est une première passe
  éditoriale dérivée des listes d'ingrédients avec seuils de quantité, **pas la lecture d'un
  cuisinier**. Elle est conservatrice par construction (elle ne prétend jamais qu'un plat est plus
  fort que ses ingrédients ne l'autorisent), et son coût d'erreur est borné : `0` et `null` sont
  tous deux neutres pour le moteur, donc se tromper sur un `0` met un mauvais mot sur une fiche,
  jamais un mauvais plat dans une assiette. **Une relecture par quelqu'un qui cuisine reste due**,
  surtout si des cuisines qui piquent entrent au catalogue.
  ✅ **`Food.piquant` EST ANNOTÉ depuis le 2026-08-09** — cette ligne disait « 450 aliments, tous
  `null` », c'est périmé. **21 aliments sur 451** portent une valeur ; les 430 autres restent `null`,
  et c'est le bon état, pas un travail inachevé. **Trois états, et l'absence n'est pas le troisième
  déguisé** : champ absent = `null` = *non renseigné* → inerte ; `piquant: 0` porte une information
  **éditoriale** (« vérifié non piquant ») et n'est posé que sur les **5 faux amis** — `paprika`,
  `curcuma`, et les trois poivrons ; `1..4` est le piquant de l'aliment **tel qu'il se consomme**.
  ⛔ **Les alliums crus — oignon, échalote, ail — restent NON RENSEIGNÉS délibérément** : leur mordant
  est détruit par la cuisson et ce champ ne distingue pas cru de cuit. Ne pas « compléter » cet
  oubli, il n'en est pas un. ⛔ **Trois distinctions ont été REFUSÉES faute de source** : poivre blanc
  vs noir (même pipérine, même dose), gingembre frais vs séché (le gingérol devient shogaol, plus
  pungent au poids — le séché n'est pas « plus doux »), chorizo doux vs fort (le catalogue n'a qu'une
  entrée, résolue vers le bas). Le champ est **rempli sans être lu** : voir « Défauts connus ».
- ✅ **`service: fromage` A DU CONTENU depuis le 2026-08-09** — la ligne disait « aucune recette de
  type `fromage`, `CourseKind` prévoit le service, le catalogue n'en a pas ». **6 recettes**
  désormais, et l'axe « Service » de l'écran Recettes est passé de 4 à 5 valeurs, donc au-dessus du
  seuil de la décision 46 : il montre 4 pastilles et renvoie la traîne derrière « Tout voir ».
  ⚠️ **Deux tests verrouillaient ce VIDE depuis des fichiers d'écran** (« 0 recette au catalogue —
  n'apparaît ni en ligne ni dans une fenêtre ») ; combler le trou devait donc les faire tomber. Ils
  vérifient maintenant la **dérivation**, pas l'absence.
- **Répartition des services au 2026-08-09** : 191 plats, 49 desserts, 41 entrées, 40
  accompagnements, **6 fromages**, 3 sans service (les sauces).
- ✅ **Créneaux — petit-déjeuner remonté à 55** le 2026-08-09 (30 à l'audit, 43 le 2026-08-08).
  Il reste le créneau le plus mince, sans trou de couverture par régime (décision 37).
- ✅ **Styles au 2026-08-09** : quotidien 171 · convivial 71 · simple 37 · reconfortant 17 ·
  **rapide 14** · **gourmand 14** · **loufoque 6**. Les trois derniers étaient à 8, 8 et **0**.
  ⛔ **`style` N'A AUCUN RÉFÉRENTIEL** — seule la facette `cuisine` est confrontée à un ensemble fermé
  (`CUISINES`, `build.mjs:378`). Écrire la valeur suffit à la faire exister. Ne pas aller créer la
  table manquante en croyant réparer un oubli : le plan du lot l'annonçait, il avait tort.
  ⚠️ **Une recette ne porte QU'UN style** : 171+71+37+17+14+14+6 = 330, exactement le compte de
  recettes. C'est pourquoi 22 recettes ont suffi à combler cinq cibles.
- **Revue juridique avant publication** : classée « recommandée, non bloquante » (§11 ARCHITECTURE),
  ce qui est raisonnable en développement mais **pas pour une mise en ligne** — la couche allergènes
  est saisie à la main et sert à des gens qui en dépendent. **Ouverte depuis l'audit.**

### Tests

- **Les tests de propriété ne passent plus tous à l'échelle du catalogue.** Celui des allergènes
  énumérait le powerset (4 096 combinaisons à 12 allergènes) et a dépassé le délai : il couvre
  désormais vide + singletons + paires + complet. **À surveiller à chaque palier de contenu.**
- ⛔ **`getByRole` AVEC FILTRE DE NOM COÛTE ~480 ms PAR APPEL sur un écran chargé — mesuré le
  2026-08-08, et c'est le piège de test le plus cher trouvé dans ce dépôt.** Il recalcule le nom
  accessible de chaque élément du document ; `findBy*` le rappelle à chaque sonde, au moins deux
  fois. Sur `recettes.test.tsx` (2 104 nœuds), le seul `await` d'attente de montage pesait ~960 ms,
  répété 23 fois : **la suite entière passe de 46,3 s à ~30 s** rien qu'en l'échangeant contre
  `querySelector('h1')` (0,1 ms). Même correctif sur `courses.test.tsx` et `parametres.test.tsx`.
  ⚠️ **LA RÈGLE N'EST PAS « NE PLUS UTILISER `getByRole` »** — c'est la requête juste quand on
  VÉRIFIE quelque chose d'accessible, et toutes ces assertions-là sont intactes. La règle est :
  **ne pas payer une requête accessible pour ATTENDRE un montage**, qui ne vérifie rien.
  ⚠️ **Et c'est ce coût-là qui a été pris pendant deux jours pour un coût de RENDU** — voir la
  décision 61 §4 : le Profiler React dit 83 ms là où le montage bout en bout en dit 1 294.
  ▶ **Trois fichiers restent chers et ce n'est PAS pour cette raison** : `semaine.test.tsx` (18,7 s)
  compose de vraies semaines (`planWeek` par test), `courses.test.tsx` (25,3 s) et
  `aujourdhui.test.tsx` (8,6 s). Leur coût n'a **pas** été décomposé — ne pas leur appliquer la
  conclusion ci-dessus sans mesurer.
- ⚠️ **`vitest.config.ts` doit rester SÉPARÉ de `vite.config.ts`.** Vitest lit `vite.config.ts` en
  l'absence de config dédiée : y poser `root: 'app'` a fait passer la suite de **572 tests à 528
  sans le moindre échec** — les suites de `tests/` et `catalog/` étaient simplement hors racine.
  **Un test qui disparaît ne fait pas rougir la CI, il la rend verte pour de mauvaises raisons.**
- ⚠️ **`catalog-loader.ts` ne doit importer AUCUN module Node.** Il est chargé par le navigateur, et
  un `import 'node:sqlite'` en tête de fichier casse le bundle **même si la fonction qui l'utilise
  n'est jamais appelée** — l'import est hoisté. Le message de Rollup ne désigne pas cette cause.
  L'ouverture de fichier vit dans `catalog-loader-node.ts`.
- ⛔ **UN TEST D'ÉCRAN QUI LIT « LA PREMIÈRE CARTE » PARIE SUR LE CONTENU DU CATALOGUE, PAS SUR LE
  COMPORTEMENT** — trouvé le 2026-08-13 dans `aujourdhui.test.tsx`. Le test de l'aplat de couleur
  lisait la première carte suggérée **sans vérifier qu'elle n'avait pas de photo** : il passait
  parce que ce plat-là n'en avait pas ce jour-là, et serait passé au rouge le jour où un plat
  photographié se classe premier — **sans qu'aucune ligne de code ait changé**. ⚠️ **La cause de
  fond : `catalogueDeTest()` charge le VRAI `app/public/catalog/catalog.db`, pas une fixture.**
  C'est voulu (les tests scellés l'exigent), mais ça veut dire qu'un test d'écran hérite du
  classement du moteur. **Le remède est de PILOTER jusqu'au cas voulu, jamais de lire l'élément 0** :
  parcourir les suggestions jusqu'à en trouver une sans photo, et échouer explicitement s'il n'y en
  a aucune. ⚠️ **Même famille que les quatre tests qui pariaient sur la taille du catalogue**
  (`70e2493`) — mais ceux-là avaient au moins la décence de rougir.
- ⛔ **DETTE DU LOT PHOTOS (2026-08-13, `f3d4fa1`) — la moitié « cadrage » n'a qu'UN témoin réel.**
  `rectangleDuCadre` est couvert par 5 tests unitaires, mais la chaîne complète cadre → fichier
  carré ne s'exerce que sur `hareng-pommes-terre-tiedes`, **seul cadre posé sur 129 photos servies**.
  Ce n'est pas un défaut de code, c'est un gisement vide : la preuve arrivera avec le lot 2 de
  `docs/CONCEPTION_PHOTOS_RECETTES.md`. **Même famille que la moitié non mesurée du lot D3** — écrit
  ici pour qu'on n'ait pas à le redécouvrir.
