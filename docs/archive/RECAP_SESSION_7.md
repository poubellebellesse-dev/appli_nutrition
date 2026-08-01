# Récit — session 7 (2026-07-31 → 2026-08-01), piste parallèle

> **Instantané daté. Ne jamais réécrire** (voir [README.md](./README.md)). Les chiffres ci-dessous
> étaient vrais le 2026-08-01 ; l'état courant est dans [../FICHE_REPRISE.md](../FICHE_REPRISE.md)
> et [../ETAT.md](../ETAT.md).

**Sujet de la session : rendre l'application testable à l'écran, puis la corriger là où l'usage l'a
prise en défaut.**

> ⚠️ **Ce récit est le pendant de [RECAP_SESSION_6.md](./RECAP_SESSION_6.md).** Les deux couvrent la
> même période sur deux pistes menées en parallèle, dans deux conversations séparées. Session 6
> raconte le contenu de Savoir et sa traçabilité, et écarte explicitement de son périmètre « l'écran
> d'accueil réécrit, Capacitor, l'éditeur de recette, et surtout la couverture de test des 9 écrans »
> en renvoyant à `git log`. Ce document raconte cette piste-là, arbitrages compris. Aucun des deux ne
> décrit le travail de l'autre.

## 0. État vérifié à la clôture

**Le 2026-08-01** : `npm test` → **950 verts (69 fichiers)** · `npm run typecheck` propre ·
`npm run build` → **199 aliments, 241 recettes, 62 gestes, 73 tips, 8 fiches (33 positions)** ·
`npx vite build` OK.

Suite lancée **trois fois de suite** avec des résultats identiques — voir §3.5, la première mesure
disait autre chose.

## 1. Ce qui a été construit

### La couverture d'écran, dette n°1 de la fiche de reprise

La fiche disait : *« zéro test d'interface. Sur les défauts de la session 5, trois ont été trouvés en
utilisant l'application, un en relisant le code, AUCUN par la suite de tests. »*

**`app/src/ui/test-socle.ts`** monte un écran réel dans un DOM simulé. La décision qui fait tout :
**on ne remplace que les deux modules qui ne peuvent pas tourner hors navigateur** —
`catalog-source.ts` (fetch + sqlite-wasm) et `user-source.ts` (OPFS). Le reste s'exécute pour de
vrai : `socle.ts`, le moteur, un `user.db` SQLite en mémoire, le catalogue du dépôt, la fusion des
recettes personnelles. Aucune branche « mode test » dans le code de production ; la substitution se
fait par `vi.mock` dans chaque fichier de test.

C'est ce qui sépare un test d'écran utile d'un test qui vérifie des maquettes : **les écrans de ce
projet passent leur temps à parler au moteur et à la base**, et c'est là que vivaient les
régressions.

**Neuf écrans couverts, ~90 tests.** Ce qui est gardé en priorité :

| Écran | Ce que le test attrape |
|---|---|
| Accueil | le retour arrière qui décochait le consentement ; le parcours rouvert qui vidait `user_allergy` |
| Aujourd'hui | l'encart d'envie qui se refermait sous le doigt entre deux pastilles |
| Éditeur | un plat dont TOUS les ingrédients sont facultatifs (régime dérivé → `omnivore` → invisible à tout régime déclaré) |
| Paramètres | décocher une allergie change **ce que le moteur propose**, pas seulement l'état d'une case |
| Recettes | aucune recette listée ne porte l'allergène, vérifié **ingrédient par ingrédient** contre le catalogue |
| Frigo | même garantie sur `searchByPantry`, chemin d'exclusion **séparé** de `suggestMeals` |
| Semaine | le verrou survit à une régénération ; `rerollSlot` ne touche qu'un créneau |
| Courses | aucun article ne disparaît en changeant de rangement ; un ajout manuel survit au remontage |
| Fiche | les portions mises à l'échelle sur une quantité **réelle** (4 artichauts → 8) |

**Le garde-fou allergène a de la matière** : 83 des 241 recettes portent du gluten, 117 du lait ;
déclarer *végétarien* doit faire disparaître 82 recettes (41 omnivores + 41 pescétariennes). Ces
tests ne peuvent pas passer par accident.

### Le plantage de « Aujourd'hui »

Signalé par l'utilisateur, qui voyait à la place de ses suggestions :
`explain.ts : aucun gabarit de phrase pour la couche 'pantry'`.

Ce n'était pas un message : **c'était le texte d'une exception qui avait traversé jusqu'à l'écran.**
Dès qu'un garde-manger non vide départageait deux plats, `suggestMeals` levait et l'écran n'affichait
plus rien d'autre.

Chaîne exacte : la couche `pantry` a été ajoutée au registre le **2026-07-28** ; `explain.ts` était
écrit avant, avec une table de phrases **partielle** et un `labelFor` qui **levait** sur une couche
absente — au motif, écrit dans son en-tête, que « `pantry` n'apparaît jamais dans un breakdown
réel ». `aujourdhui.tsx` transmet `pantryFoodIds`.

### Le reste

- **Accueil** : quatre engagements réécrits (plus longs, plus explicatifs), `VERSION_CONSENTEMENT`
  incrémentée, étape « Installez l'application » **désactivée sans être supprimée**, et sortie
  d'introduction qui atterrit explicitement sur Aujourd'hui.
- **Barre du bas** : 3 mm de marge à chaque bord, 5 mm de hauteur en plus,
  en `calc(var(--spacing-tactile) + 0.5cm)`.
- **`ui/panneau.tsx`** : les menus déroulants deviennent des **fenêtres avec bouton retour**
  (Recettes, Frigo, fiche recette, alerte Semaine, Paramètres entier regroupé par thème).
- **`ui/visite.tsx`** : visite guidée en 4 étapes, **écrite et testée mais NON BRANCHÉE** — voir §5.

## 2. Les défauts trouvés, corrigés ou non

**Corrigés** — le plantage `pantry` ; le « 62/100 » de la carte ; le doublon d'article en vue
« Jour » des Courses (un ingrédient au déjeuner ET au dîner du même jour était ajouté deux fois à la
même section, donnant deux nœuds React de même clé).

**Trouvés et NON corrigés**, faute d'être dans le périmètre demandé :

| Où | Quoi |
|---|---|
| `semaine.tsx` → `plan-week.ts:243` | **`seed` n'est lu nulle part.** « Proposer une autre semaine » sans verrou peut rendre *exactement* le même plan — mesuré : 0 créneau différent sur 14 |
| `user-store.ts:434` | `readLatestPlan` trie les id en **texte** (`"…-7" > "…-3"`) : après un changement de nombre de jours, un rechargement peut rouvrir l'ancien plan |
| `detail-recette.tsx:56` | `energieParPortion` rend `null` pour **les 241 recettes** — les index dérivés ne sont construits que dans la fermeture de `createEngine` et ne sont jamais réexposés. La fiche affiche toujours « Non renseignées » alors que la donnée CIQUAL existe (288,6 kcal vérifiés sur `artichauts_vinaigrette`) |

## 3. Ce que la session a appris

### 3.1 Un commentaire n'est pas une garantie ; un type, oui

L'en-tête d'`explain.ts` affirmait que quatre couches « n'apparaissent jamais dans un breakdown
réel ». L'affirmation est **devenue fausse le jour où `pantry` a été implémentée**, et le commentaire
ne l'a jamais su.

Le correctif n'a donc pas été d'ajouter la phrase manquante — ça refermait ce cas et laissait le
suivant. La table est devenue **totale** sur les onze couches (`string | null`, `null` = jamais
citée) : **ajouter une couche sans décider de sa formulation est désormais une erreur de
compilation.** C'est la seule forme de garantie qui tienne ; le commentaire, lui, n'a pas tenu.

### 3.2 Une copie ne détecte pas ce qui manque à l'original

Les tests de gabarit recopiaient la liste des libellés attendus. Ils n'ont donc **rien pu voir** :
une liste écrite à la main ne signale pas une entrée absente de la table qu'elle prétend refléter.
Ils sont désormais **pilotés par la table elle-même** — les couches citables et les couches muettes
en sont dérivées, avec une garde explicite contre l'`it.each([])` (qui ne produit **aucun** test et
laisserait la suite verte en n'ayant rien vérifié).

Le même défaut a été rattrapé à la main plus tard : l'écran Paramètres avait recopié les libellés
courts d'allergènes de `champs-profil.tsx` — copie **identique au caractère près**, donc invisible en
relecture, et destinée à diverger au premier libellé retouché. Ce fichier existe précisément pour que
les deux écrans nomment les mêmes champs pareil.

### 3.3 Un test peut passer pour la mauvaise raison

`queryByText('Revenir en arrière')` rendait `null` parce que le libellé réel est
`← Revenir en arrière`. Le test « aucun retour à la première étape » **serait resté vert même si le
bouton avait été là**. Toute assertion d'absence passe désormais par une expression régulière.

### 3.4 Le couplage invisible d'une couche d'exemple

Retirer le libellé de `nutri` a fait tomber **huit tests** — dont aucun ne parlait d'équilibre
nutritionnel. `nutri` servait de couche d'exemple dans presque toutes les fixtures d'`explain.test.ts`,
et cette identité était devenue une dépendance. Les fixtures sont maintenant découplées : elles
testent le tri, le seuil de trois et la discrimination, pas le sens métier d'une couche.

### 3.5 La contention fabrique de faux flakes

Deux agents ont rapporté des échecs intermittents dans des fichiers **différents à chaque exécution**
(`catalog/build.test.ts`, `detail-recette.test.tsx`, `semaine.test.tsx`). L'hypothèse d'une course
écriture/lecture sur `app/public/catalog/catalog.db` a été **vérifiée puis écartée** : `build.test.ts`
construit dans un dossier temporaire et ne fait que lire le fichier partagé.

La cause était que **quatre agents lançaient chacun la suite complète en parallèle** sur la même
machine. Trois exécutions à vide ont donné des résultats identiques. Un flake se diagnostique avant
de se « corriger ».

### 3.6 Un score interne affiché devient une note

La carte affichait `62/100` — le score de **classement** du moteur, qui n'a de sens que relatif aux
autres candidats de la même passe. Au-delà de l'obscurité : **un nombre sur 100 posé à côté d'un nom
de plat se lit comme une note de qualité nutritionnelle** (Nutri-Score, Yuka), c'est-à-dire
exactement le jugement que §6.2 interdit à cette application. Retiré.

### 3.7 Ce que les tests ne voient toujours pas

Le plantage `pantry` est passé parce que **aucune suite du moteur ne passait un garde-manger non
vide** — toutes écrivaient `pantryFoodIds: []`. Le test qui manquait
(`tests/garde-manger-catalogue-reel.test.ts`) force le poids de `pantry` à 1 : au poids par défaut
(0,05) la couche n'atteint pas toujours les trois plus fortes contributions, et le test passerait ou
non selon le catalogue du jour.

**Vérifié par mutation** : 3 échecs sur 4 avec le défaut réintroduit — le 4ᵉ restant vert à raison
(garde-manger vide → rien à départager), ce qui prouve que le contrôle négatif en est un.

## 4. Ce qui a été refusé

- **Garder `aria-expanded` sur un bouton qui ouvre une fenêtre, pour ne pas réécrire un test.**
  Mauvais sens de la dépendance. L'attribut décrit un contenu qui se déplie *en place* : l'annoncer
  laisserait attendre que le texte suivant se soit allongé, alors que le focus vient de partir
  ailleurs. → `aria-haspopup="dialog"`, tests réécrits pour lire la **présence du dialogue**.
- **Convertir le geste technique des étapes de recette en fenêtre.** On a les mains dans la
  préparation ; ouvrir un plein écran pour trois lignes puis revenir chercher son étape coûterait
  plus que le dépliant. C'est le seul endroit du produit où un dépliant ne fait pas perdre
  l'utilisateur, parce qu'il est **ancré à ce qu'il explique**.
- **Écrire des tests d'écran sur `savoir.tsx`.** Le chantier « Comprendre » de la piste parallèle y
  était en cours (+280 lignes non commitées). Y poser des tests aurait figé un comportement ni
  terminé ni le nôtre.
- **Toucher au chantier `evidence`.** Aucun commit de cette piste ne l'embarque, à une exception
  documentée : trois lignes de fixtures (`evidence: new Map()`) dans `engine/api/index.test.ts`, sans
  lesquelles le fichier ne compilait plus.

## 5. Ce qui reste ouvert

- ⛔ **La visite guidée n'est pas branchée.** `ui/visite.tsx` + son test existent et passent (11
  tests), mais rien ne la déclenche. Il manque : la **migration `user.db` 6 → 7**
  (`ALTER TABLE user_display ADD COLUMN visite_proposee INTEGER NOT NULL DEFAULT 0`, non écrite —
  §4 de `CLAUDE.md` exige un accord explicite), l'invitation en fin d'introduction, et le branchement
  dans `main.tsx`. **Décision produit prise** : proposée **une fois** à la fin de l'intro, la question
  ne revient jamais.
- ⚠️ **La 3ᵉ étape de la visite cible les flèches par `article div.flex.gap-2`** — des classes
  Tailwind. Une marge changée et l'étape disparaît **en silence**, puisque le composant est justement
  conçu pour sauter les cibles absentes. Poser un `data-visite="fleches"` dans `aujourdhui.tsx` avant
  de brancher.
- **Deux valeurs de remplissage encore en place** : `CONTACT = 'contact@example.org'`
  (`parametres.tsx`) et `appId: 'org.example.nutrition'` (`capacitor.config.ts`, **définitif une fois
  publié sur Play**).
- `npx cap add android` jamais lancé (pas de SDK Android sur la machine). JDK 25 possiblement
  incompatible avec l'Android Gradle Plugin — à vérifier au premier build.
