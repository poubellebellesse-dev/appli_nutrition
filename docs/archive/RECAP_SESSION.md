# Récap de session — mise sous git, P0/P1a bouclés, conception P1b

> Récit narratif d'une session de travail. Les décisions qu'elle contient sont **répercutées** dans
> [ETAT.md](../ETAT.md) (avancement), [ARCHITECTURE.md](../ARCHITECTURE.md) (schéma, archétypes),
> [ENGINE.md](../ENGINE.md) (scoring, §6.3 bis et §6.5) et [DESIGN.md](../DESIGN.md) (toggles
> Aujourd'hui) — ce sont **ces documents qui font foi** en cas d'écart ; celui-ci raconte comment on
> y est arrivé et sert de point de reprise.

**Statut** : session close, décisions intégrées aux docs de référence.
**Date** : 2026-07-24

---

## 1. Où en était le projet en entrant dans la session

Spécification complète (`ARCHITECTURE.md`, `ENGINE.md`, `DESIGN.md`), maquettes validées en
première passe, mais **rien n'était encore sous contrôle de version** et le code du moteur n'avait
pas commencé. La session a couvert trois chantiers dans l'ordre : (1) trancher les derniers points
de design/distribution en attente, (2) mettre le dépôt sous git et écrire les deux premières tranches
de moteur (P0, P1a), (3) concevoir la tranche suivante — le scoring (P1b) — sans encore l'écrire.

---

## 2. Comparatif marché — dix concurrents, un verdict

Revue des applications occupant déjà le terrain nutrition/planification, pour vérifier que la
proposition (§Positionnement, ARCHITECTURE.md) tient face à des produits réels, pas seulement face
à une idée de concurrence.

| App | Ce qu'elle fait bien | Ce qu'elle ne fait pas |
|---|---|---|
| **Paprika** | Gestionnaire de recettes local, payant une fois, pas de compte forcé | Pas de moteur de suggestion, pas de bibliothèque santé |
| **Jow** | Planification + courses fluides, UX très travaillée, gratuit | Modèle payé par les supermarchés partenaires → structurellement incapable de recommander « achète moins » |
| **Eat This Much** | Vrai moteur algorithmique sous contraintes (macros, budget, temps) | Anglo-centré, UX datée, pas de dimension éditoriale/santé sourcée |
| **Frigo Magic** | Anti-gaspi, gros catalogue, gratuit | C'est tout le produit — one-trick, pas un planificateur généraliste |
| **Yuka** | Scan produit, note de confiance, très grand public | Juge et note (Nutri-Score-like) — à l'opposé du principe 6 (« informer, jamais juger ») de ce projet |
| **MyFitnessPal** | Base d'aliments énorme, tracking précis | Compteur de calories/journal alimentaire — exactement le vecteur TCA que §6.5 ARCHITECTURE écarte |
| **Mealime** | Planification hebdo simple, bonne épuration UI | Catalogue limité, pas de moteur explicable, pas de volet santé sourcé |
| **Noom** | Coaching comportemental, accompagnement psychologique | Payant/abonnement, orienté perte de poids — hors périmètre assumé (§6.3/§6.5 ARCHITECTURE) |
| **Samsung Food** | Écosystème large (recettes, planning, appareils connectés) | Lié à l'écosystème Samsung, compte + cloud requis — à l'opposé du principe 2 |
| **Marmiton** | Immense bibliothèque communautaire FR, gratuit | Site publicitaire, pas de moteur de sélection ni de garde-fous santé |

**Verdict retenu** : aucun concurrent ne combine *local souverain* (Paprika) + *moteur sous
contraintes explicable* (Eat This Much) + *bibliothèque scientifique sourcée* (personne) + *100 %
gratuit sans dépendre d'un tiers payeur* (impossible pour Jow, Samsung Food, Noom). C'est le
« carré vide » déjà identifié en ARCHITECTURE.md §Positionnement. Mais consigne assumée pour la
suite du projet : **c'est une niche à valeurs, pas une niche de fonctionnalités** — le code
(moteur, filtres, scoring) est un chantier fini et cerné ; **le contenu (150-200 recettes, 60-100
fiches, 8-10 chapitres santé, lexique de gestes) est le vrai combat**, celui qui prend le plus de
temps et qui décide si le produit est réellement utilisable. Rien de nouveau par rapport à §8
ARCHITECTURE (« le contenu représente plus de travail que le code »), mais le comparatif confirme
que c'est aussi l'angle qui différencie vraiment, pas seulement une contrainte de production.

---

## 3. Décisions de design tranchées cette session

Récapitulatif des points restés ouverts à l'issue de la session précédente, tous refermés ici et
déjà répercutés dans les docs de référence — cette section ne fait que les relier :

- **Courses — ajout manuel en pied de liste** (vues Repas/Jour) : un article ajouté à la main n'a
  pas d'origine repas/jour, il est classé en fin de liste avec un marqueur typographique discret
  (jamais une 2ᵉ couleur). → `DESIGN.md` §4.3.
- **Gestes de cuisine à risque — 3 clips MP4 de 3 s** (avant/pendant/après) + clip « quand ça
  rate » + galeries d'états, réservés à la douzaine de gestes qui échouent couramment ; le reste du
  lexique garde la boucle WebP muette ~80 Ko. → `ARCHITECTURE.md` §8.5.
- **Cache à deux étages (option B)** : socle pré-caché léger (shell + `catalog.db` + boucles +
  photos d'ustensiles) découplé des médias lourds à la demande. → `ARCHITECTURE.md` §7.1.
- **Communauté P2P sans serveur** : partage par fichier `.nutri-recipe` autonome (Web Share API) +
  carte-image Canvas pour les réseaux, jamais de feed hébergé. → `ARCHITECTURE.md` §8.7.
- **i18n structurée dès le schéma, contenu v1 = français seul** : moteur agnostique, un
  `catalog.<lang>.db` par langue, 2ᵉ langue et localisation santé = chantier v2+. →
  `ARCHITECTURE.md` §8.8.
- **Thèmes d'accent curatés**, pas de nuanceur libre — le badge de preuve reste neutre quel que
  soit le thème. → `DESIGN.md` §1.
- **Modèle 100 % gratuit, sans pub, aucun don** — seulement un lien « À propos » discret. →
  `STRATEGIE_DISTRIBUTION.md` §6.
- **Publication en store = proposition, pas une décision figée** — PWA hébergée reste la base
  suffisante ; Play (25 $ une fois) d'abord si on active la distribution store, iOS optionnel plus
  tard. → `STRATEGIE_DISTRIBUTION.md` §3.

---

## 4. Mise sous git

Dépôt initialisé et poussé : **`github.com/poubellebellesse-dev/appli_nutrition`**. Modèle de
travail retenu, à reconduire : **Claude committe localement, l'utilisateur pousse** — le shell de
l'agent ne dispose d'aucun moyen de s'authentifier auprès de GitHub (pas de token configuré, voir
§7 « Reprendre ici »).

Six commits à l'issue de cette session :

| Commit | Contenu |
|---|---|
| `67d7fa0` | Spécification initiale — docs, maquettes, notes |
| `bde26ed` | P0 chunk 1 — chaîne de build du catalogue |
| `2c886ef` | P0 chunk 2 — structure et contrats du moteur |
| `e74a55e` | P0 chunk 3 — pont `data/` + mini-CLI de lecture |
| `70af681` | docs — stratégie de distribution (réconciliée avec ETAT) |
| `75597b3` | P1a — couches d'exclusion + garde-fou allergènes |

---

## 5. P0 terminé — le socle prouvé bout-en-bout

Trois commits (§4). Livré :

- **Chaîne de build** `catalog/build.mjs`, sur `node:sqlite` — transforme les sources YAML/Markdown
  du catalogue en `catalog.db`, et **échoue** sur un contenu invalide (référence cassée, lexique
  banni).
- **Catalogue de test** : 30 aliments, 10 recettes, 4 gestes de cuisine — assez pour exercer toute
  la chaîne sans attendre le contenu final.
- **Structure `engine/`** : types du domaine (L1) et contrats `SelectionLayer`/`Engine` (L3), avec
  le registre de couches déjà déclaré (métadonnées seulement, aucune logique).
- **Pont `app/src/data/catalog-loader.ts`** + CLI `catalog:list` — première preuve que
  `.yaml`/`.md` → `catalog.db` → `Catalog` en mémoire fonctionne de bout en bout, sans navigateur.

**Critère de sortie P0 atteint** : `catalog.db` généré depuis les 10 recettes de test, build en
échec contrôlé sur une recette invalide.

---

## 6. P1a terminé — les quatre couches d'exclusion

Un commit (§4). Livré :

- Les **4 couches d'exclusion** du registre : `allergenes` 🔒, `regime` 🔒, `temps`, `equipement`
  (cette dernière **inerte** faute de données `equipment` dans le catalogue de test — pas un bug,
  un manque de contenu attendu à ce stade).
- **`runExclusionPass`** (`docs/ENGINE.md` §6.4) : enchaîne les 4 couches par intersection
  successive, conserve le premier motif de rejet rencontré pour le rapport à l'utilisateur.
- **Garde-fou `assertNoDeclaredAllergen`** (`docs/ENGINE.md` §5.2) : post-condition qui fait lever
  le moteur plutôt que de laisser passer un allergène déclaré — la sécurité comme propriété
  structurelle, pas comme vigilance de code.
- **60 tests verts**, couvrant chaque couche isolément et la passe complète.

Au passage, le code a relevé et corrigé de lui-même une coquille de la spec : le registre énumère
**14** couches (4 exclusion + 10 score), pas 12 comme la prose des docs le répétait depuis le
début. Répercuté dans `ETAT.md` et `ENGINE.md` cette session (§6.3 ENGINE, § « Où en est-on » ETAT).

---

## 7. Conception P1b — le scoring

Le cœur de la session : concevoir la tranche suivante (scoring) **sans encore l'écrire**, pour que
l'implémentation à venir n'ait pas à improviser sur des questions de fond. Huit décisions, détaillées
dans `docs/ENGINE.md` §6.5 :

1. **`nutri` compare à une cible, jamais à la consommation** — accumulateur du plan en `planWeek`,
   ou part du créneau dans la référence journalière pour une suggestion isolée.
2. **`craving` est contextuel** : n°1 seulement dans « Aujourd'hui » (envie posée), socle bas en
   `planWeek`. Symétrie retenue : **Aujourd'hui = envie · Semaine = équilibre.** Distance calculée
   sur les axes demandés seulement ; texture catégorielle, hors euclidien.
3. **`season` ignore les staples** : proportion calculée sur les seuls ingrédients réellement
   saisonniers (pâtes, riz, huile, sel… marqués « toute l'année », exclus du calcul). Neutre, pas
   pénalisé, quand aucun ingrédient n'est saisonnier.
4. **`preference` pondérée par la quantité** : ingrédient principal = non-optionnel de plus forte
   quantité (tie-break par id). Agrégat saturé — un +2 isolé ne sauve pas un plat.
5. **`variety` adaptative** : socle léger modulé par la couche `habit`, jusqu'à s'inverser en bonus
   de familiarité pour un profil « habitudes » ; override explicite par requête (« Surprends-moi »
   / « Mes classiques »). Récence sur la recette **et** son ingrédient principal.
6. **`speed` — nouveau signal doux** : recette plus courte dans la fenêtre = un peu mieux. Poids nul
   par défaut, activé par l'archétype « Rapide ». Distinct du filtre dur `temps`. Point non tranché :
   couche à part entière du registre ou modulation interne — laissé ouvert à l'implémentation P1b-2.
7. **Déterminisme** : tri par score, tie-break stable par id de recette, tout aléa via PRNG à graine.
8. **Index calculés à l'init du moteur**, pas au build : `recipeNutrients` et
   `recipeMainIngredient` deviennent des fonctions pures de `engine/nutrition/`, exécutées à
   `createEngine(catalog)` — pour ne pas coupler `build.mjs` au moteur. Aujourd'hui laissés vides
   par le loader ; à peupler en P1b-1.

### Archétypes — généralisation des préréglages

Les « 4 préréglages nommés » de la spec initiale (équilibre/plaisir/rapidité/budget) sont
généralisés en **archétypes** : un vecteur de poids nommé sur les couches de score, jamais sur les
couches critiques. Jeu proposé (~6, **noms à confirmer**) : Équilibre (défaut), Envie, Découverte,
De saison, Mes goûts, Rapide. Pas d'archétype « budget » en v1 (`cost` reste v3). Choisi à
l'onboarding, modifiable dans les Paramètres — les deux écrans sont **P3**, pas encore maquettés.
Détail : `docs/ENGINE.md` §6.3 bis.

### Favoris et variété — deux flags moteur proposés

« Favoris d'abord » et « Découverte/Classiques » (toggles UI, P3) pilotent deux flags moteur
proposés pour **P1c** : `onlyFavorites` (restreint les candidats aux favoris puis score dedans —
reste un opt-in explicite, cohérent avec « favori = marque-page, n'influence pas le moteur par
défaut ») et `varietyMode` (override explicite de la précision 5 ci-dessus). Détail :
`docs/ENGINE.md` §8.1, `docs/DESIGN.md` §4.1.

### Alternatives d'une recette — le socle en P1b, la feature en P1c/P2

« Pâtes sans ail / autre sauce » : `suggestAlternatives(recipeId, dislikedFoodId)` combinera trois
mécanismes — (1) retirer l'ingrédient marqué `optionnel`, (2) piocher dans la table
`substitution` déjà au schéma, (3) proposer un plat frère via le regroupement de la diversification
(§6.6 ENGINE). Le socle (respect de `optionnel`, table `substitution` chargée) se prépare en P1b ;
la fonction elle-même reste P1c/P2. Détail : `docs/ENGINE.md` §8.

### Découpage retenu pour la suite

| Sous-étape | Contenu |
|---|---|
| **P1b-1** | Prérequis données (`food.saison_mois` + flag staple, §4.2 ARCHITECTURE) + index à l'init du moteur + les 7 fonctions de score (`nutri`, `preference`, `craving`, `season`, `variety`, `speed`, `habit` minimal) + tests unitaires |
| **P1b-2** | Passe de score pondérée + les 6 archétypes + poids dynamiques contextuels + tie-break + CLI de scores |
| **P1c** | Diversification + explication + `suggestMeals` bout-en-bout + flags favoris/variété + `suggestAlternatives` |

---

## 8. ▶ Reprendre ici

**Prochaine étape à déléguer : P1b-1.** Rappel du plan (§7 ci-dessus) :

1. Prérequis données : `food.saison_mois` existe déjà au schéma réel ; ajouter le flag
   « toute l'année / staple » (proposé en `ARCHITECTURE.md` §4.2 — pas encore dans le vrai schéma
   `build.mjs`/`foods.yaml`/loader, à faire dans ce lot).
2. Index calculés à l'init du moteur (`engine/nutrition/`, fonctions pures) : `recipeNutrients`
   (agrégation ingrédient × food_nutrient) et `recipeMainIngredient` (plus forte quantité
   non-optionnelle, tie-break par id).
3. Les 7 fonctions de score : `nutri`, `preference`, `craving`, `season`, `variety`, `speed`,
   `habit` (version minimale — les 4 signaux complets de §7.5 ENGINE peuvent attendre P1b-2/P1c).
4. Tests unitaires sur chacune, en s'appuyant sur le catalogue de test existant (30 aliments/10
   recettes) complété si besoin d'un cas saisonnier/staple.

Rappel de méthode (`CLAUDE.md`) : TDD sur cette tranche puisque c'est de la logique métier
critique — écrire les tests avant d'écrire les fonctions, pas après.

### Questions ouvertes à trancher avant ou pendant P1b-2

- **Noms définitifs des ~6 archétypes** — la liste (Équilibre, Envie, Découverte, De saison, Mes
  goûts, Rapide) est une proposition de session, pas validée mot pour mot.
- **Token de push GitHub** — le modèle « Claude committe, l'utilisateur pousse » (§4) tient tant
  que personne n'a configuré d'authentification pour le shell agent. Si on veut que Claude pousse
  directement, il faut fournir un token (PAT à portée réduite, `repo` scope minimal) — décision et
  action côté utilisateur, hors périmètre de ce que l'agent peut faire seul.
- **Rattachement précis de `speed`** au pipeline (couche à part entière du registre à 14, ou
  modulation interne d'une couche existante) — laissé ouvert en §6.5 ENGINE, à trancher à
  l'implémentation P1b-2.
