# État du projet — récapitulatif et reprise

> État complet du projet. Pour un démarrage rapide, lire d'abord `docs/FICHE_REPRISE.md`.
> Dernière mise à jour : **2026-07-24** (session 2 — P1b-1 codé : 7 fonctions de score, index
> dérivés, saison en crédits, catalogue porté à 76 aliments, 5ᵉ couche d'exclusion ; conception
> variety/radar/courses. Récit : `docs/RECAP_SESSION_2.md`).

---

## 1. En une phrase

Application de nutrition et de planification de repas, **100 % locale, sans IA, sans compte**,
utilisable sur téléphone et PC par toutes les tranches d'âge. Phase actuelle : **P0, P1a et P1b-1 du moteur terminés (140 tests verts) ; P1b-2 = prochaine étape. Seuls P0 et P1a sont committés — le reste attend un lot de commits.**

---

## 2. Où en est-on

```
Concept ─▶ Architecture ─▶ Moteur ─▶ Analyse marché ─▶ Design UI ─▶ Code ── P0 ✅ ── P1a ✅ ── P1b-1 ✅ ── ▓▓ P1b-2 ▓▓
  ✅          ✅            ✅           ✅              ✅                                                 ⬅ ICI (à coder)
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
| Code — P1b-1 (socle scoring) | `app/src/engine/nutrition/`, `app/src/engine/selection/scoring/` | ✅ Terminé, 140 tests verts (non committé) |
| Code — P1b-2 (passe + archétypes) | `app/src/engine/selection/` (passe de score) | ⬜ Conçu — **prochaine étape** |

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
- **Registre de 15 couches** à contrat commun (`SelectionLayer`), pas un pipeline figé (le code
  fait foi, voir `app/src/engine/domain/layer-ids.ts`). Une 5ᵉ couche d'exclusion `exclusions`
  (rejet perso, `excludedFoodIds`) a été ajoutée en session 2 — corrige aussi les anciennes
  mentions « 12 » puis « 14 ».
  - Exclusion (5) : `allergenes` 🔒 · `regime` 🔒 · `exclusions` · `temps` · `equipement`
  - Score (10) : `nutri` · `preference` · `craving` · `variety` · `season` · `pantry` · `habit` ·
    `occasion` · `topic` (v2, réserve) · `cost` (v3, réserve)
  - `speed` **n'est pas une 16ᵉ couche** : c'est une modulation proposée de la fonction de score
    (voir `docs/ENGINE.md` §6.5), activée par l'archétype « Rapide ».
- **Fonction pure synchrone**, catalogue en RAM. Pas de `Date.now`/`Math.random` (PRNG à graine,
  tie-break stable par id de recette).
- **Sécurité = post-conditions** : le moteur lève plutôt que de retourner un résultat non sûr.
- **Anticipation sans IA** = 4 statistiques locales (couche `habit`), réversibles.
- **Poids dynamiques** : `craving` passe **n°1** dès qu'une envie est exprimée, **uniquement dans
  le contexte « Aujourd'hui »** (suggestion ponctuelle) ; il reste à son socle bas en `planWeek`
  (pas de « moment T » pour les jours futurs — la semaine reste pilotée par `nutri`). Symétrie :
  **Aujourd'hui = envie · Semaine = équilibre.** `occasion` passe **n°2** pendant une occasion
  active (0 hors période). Détail complet : `docs/ENGINE.md` §6.5.
- **Équipement à trois niveaux** : `requis` (exclusion) · `accelere` (score) · `informatif`
  (ustensile, **n'exclut jamais** — jamais chargé par le moteur).
- **Archétypes** (P3, conception en §6 ci-dessous) : remplacent/généralisent l'idée initiale de
  « 4 préréglages nommés » — un vecteur de poids nommé sur les couches de score, jamais sur les
  couches critiques. Détail : `docs/ENGINE.md` §6.3 bis.

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
| 4 | Nb de recettes v1 | 150-200 |
| 5 | Écran d'humeur → envie | Principe validé, pas maquetté |
| 6 | Hébergement PWA | Cloudflare / Netlify / GitHub Pages (statique, indifférent) |
| 7 | Chiffrement | Sans objet (aucune donnée de santé collectée) |
| 8 | **Mode cuisine** (multi-recettes, timers par étape) en v1 ou v1.5 ? | Feature nouvelle, sizeable — après le socle P0 |
| 9 | Cible iOS : PWA seule ou Capacitor + App Store ? | **PWA** par défaut (gratuit, pas de Mac) ; Capacitor si API native |
| 10 | Noms définitifs des **archétypes** (§ENGINE 6.3 bis) | **Proposé, à confirmer** : Équilibre · Envie · Découverte · De saison · Mes goûts · Rapide (~6, pas de « budget » en v1) |
| 11 | Token de push GitHub (pour que l'utilisateur pousse les commits Claude) | À fournir par l'utilisateur — voir `docs/RECAP_SESSION.md` § Reprendre ici |
| 12 | Rattachement de `speed` au pipeline | 16ᵉ couche du registre ou modulation interne — à trancher en P1b-2 |
| 13 | `requiredFoodIds` (miroir du rejet) : filtre dur ou gros bonus ? | **Dur en contexte « Aujourd'hui »** (proposé) |
| 14 | Alcool : ingrédient de cuisine vs boisson | Ingrédient v1 (décidé) ; jamais dans le calcul nutritionnel ; boisson = article de courses |
| 15 | Roue des goûts : rayons cuisine/saveur | v2 (v1 = 6 pôles sensoriels, gratuits) |
| 16 | Table courses non alimentaire (10 rayons) | Conçue ; à coder **quand `buildShoppingList` existera** (P1c+), pas avant |

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

### P1b — Scoring — **conçu cette session, pas encore codé (⬅ ICI)**

Conception détaillée : `docs/ENGINE.md` §6.5 et §6.3 bis, `docs/RECAP_SESSION.md`. Découpage
retenu :

### P1b-1 — Socle scoring ✅ terminé (non committé)

- [x] `food.saison_mois` + `food.toute_annee` au schéma réel (build + loader), dimensions indépendantes
- [x] Index dérivés à l'init du moteur : `recipeNutrients` (par portion), `recipeMainIngredient` (`engine/nutrition/`)
- [x] 7 fonctions de score pures (`engine/selection/scoring/`) + `NEUTRAL_SCORE = 0.5`
- [x] `season` en crédits pondérés par quantité ; catalogue porté à 76 aliments ; 5ᵉ couche d'exclusion `exclusions`
- [x] 140 tests verts, typecheck propre

| Sous-étape | Contenu |
|---|---|
| ✅ **P1b-1** | Prérequis données (`food.saison_mois` + flag « toute l'année/staple », §ARCHI 4.2) + index calculés à l'**init du moteur** (`recipeNutrients`, `recipeMainIngredient`, dans `engine/nutrition/`) + les 7 fonctions de score (`nutri` · `preference` · `craving` · `season` · `variety` + `speed` + `habit` minimal) + tests unitaires |
| **P1b-2** ⬅ prochaine étape | Passe de score pondérée (`runScoringPass`) + les 6 archétypes (proposé, §ENGINE 6.3 bis) + poids dynamiques contextuels (craving/occasion) + tie-break déterministe par id + CLI de scores |
| **P1c** | Diversification (MMR) + explication (top 3) + `suggestMeals` bout-en-bout + flags `onlyFavorites`/`varietyMode` + `suggestAlternatives` |

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
│  ├─ ENGINE.md          ← moteur · 15 couches · API · plan de lancement
│  ├─ DESIGN.md          ← 8 écrans · navigation · badge de preuve
│  ├─ RECAP_SESSION.md   ← récit session 1 (conception P1b)
│  ├─ RECAP_SESSION_2.md ← récit session 2 (P1b-1 codé, saison, contenu, 5ᵉ couche, conception variety/radar)
│  └─ STRATEGIE_DISTRIBUTION.md
├─ app/src/
│  ├─ engine/            ← moteur TS pur (domain, guards, selection, nutrition, planning, api)
│  ├─ data/              ← catalog-loader.ts (pont SQLite → Catalog)
│  └─ cli/               ← banc d'essai CLI (`catalog:list`)
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