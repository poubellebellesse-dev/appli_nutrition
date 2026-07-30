# Récit — session 4 (2026-07-27 → 2026-07-29)

> **Instantané daté. Ne jamais réécrire, ne jamais s'en servir pour établir l'état courant** —
> celui-ci est dans [../FICHE_REPRISE.md](../FICHE_REPRISE.md) et [../ETAT.md](../ETAT.md).
> Périmètre : commits `ab70ccf` → `5288f55`, 26 commits.
> Ce document garde ce que l'état courant efface : **les raisonnements abandonnés en route.**

De 200 recettes sans moteur de planification à une PWA qui affiche de vraies suggestions dans un
navigateur. Trois arcs : finir le contenu et corriger ce qu'il révèle, coder les quatre fonctions de
planification, brancher une première tranche d'interface.

---

## 1. Le fil

| # | Étape | Résultat mesuré |
|---|---|---|
| 1 | Contenu 200 → 212 recettes | Le modèle de similarité corrigé tient sur du contenu neuf |
| 2 | `suggestAlternatives` | Variante ≠ alternative ; a exigé une 3ᵉ notion d'ingrédient |
| 3 | `planWeek` + plancher calorique | Banc de stress à 20 configurations, 1 bug de fenêtre trouvé |
| 4 | 30 recettes végétaliennes | Végétalien 14 j : 29/42 → **42/42** créneaux remplis |
| 5 | Cohérence régime ⇄ ingrédients | 1 bug grave (miel dans une recette végétalienne) |
| 6 | Origine animale en cascade | 58 aliments annotés, propagation `beurre → lait → mammifère` |
| 7 | `planLeftovers` | Gaspillage 26 → **2 portions** pour 2 convives |
| 8 | `buildShoppingList` | Courses **24 → 15 kg** une fois les restes déduits |
| 9 | Conditionnements, pièces, fonds de placard | 77 → 68 lignes de liste |
| 10 | Lexique de gestes | 4 → **62 fiches**, 155 → **763 étapes** annotées |
| 11 | `scaleRecipe`, `rerollSlot`, couche `pantry` | 3 des 4 stubs restants |
| 12 | PWA, première tranche | Chaîne complète prouvée dans un navigateur |

---

## 2. Ce que la mesure a démenti

**C'est la partie qui ne se reconstitue pas.** Chacun de ces points était une conviction raisonnable,
écrite ou annoncée, et fausse.

### « Le catalogue est trop léger pour atteindre le plancher calorique »

**Faux.** Diagnostic posé en voyant des journées à 1 038 kcal. Vérification : la **meilleure journée
possible atteignait déjà 2 127 kcal**. Le vivier n'était pas le problème.

Le vrai correctif était double, et aucune des deux moitiés n'était celle annoncée :

- `assertCalorieFloor` **annulait le plan entier**. §6.5 ENGINE demandait un écran d'avertissement.
  J'avais codé un refus là où le document décrivait une alerte → `checkCalorieFloor`, qui prévient.
- La cible nutritionnelle restante (§7.1), codée pour corriger le tir, a été mesurée
  **insuffisante : +64 kcal**. L'énergie ne pèse que 2,8 % du score total. Une correction élégante
  et sans effet — gardée uniquement parce que mesurée.

Résultat final : cas nominal 7 j × 3 créneaux, de 1 038 kcal et 3 avertissements à **1 208 kcal,
zéro avertissement**.

### « `argmax(similarity)` donnera le plat frère »

**Faux, et à l'envers.** La similarité pondère l'ingrédient caractéristique à **0,80** : maximiser
la similarité d'une recette dont on rejette l'ingrédient principal revient à chercher les recettes
qui le **gardent**. Il fallait « même groupe, ingrédient **différent** », puis classer sur les axes
restants.

### « L'ingrédient principal, c'est le plus lourd »

**Insuffisant.** A exigé une **troisième** notion, mesurée séparément : l'ingrédient
*caractéristique* = le plus lourd d'un groupe **définissant** (viandes, poissons, fruits de mer,
légumineuses), repli sur le plus lourd sinon. Sur 29 recettes il diverge du plus lourd — et les
29 fois il a raison (« Hachis de bœuf aux pommes de terre » est un plat de bœuf, pas de pomme de
terre).

⚠️ `œufs` **volontairement exclu** des groupes définissants : l'y mettre fait de « Clafoutis aux
framboises » un plat d'œuf.

### « Le lexique est complet »

**Faux, et le test le confirmait.** La première passe rendait 43 fiches : aucune référence cassée,
aucune fiche orpheline, tous les tests verts. Et « écosser les fèves », « éponger les calamars »,
« essorer la laitue », « étaler la pâte » n'étaient annotées nulle part.

**La cohérence ne dit rien de la couverture.** La liste des gestes avait été écrite *à la main* ; le
test vérifiait la cohérence de cette liste avec elle-même. Il a fallu **échantillonner les étapes
non annotées** pour voir le trou, puis extraire les verbes des 1 097 étapes et trier.

19 gestes techniques ajoutés en seconde passe. « Ajouter », « verser », « mélanger », « servir »
sont fréquents mais **ne sont pas des gestes** — les définir serait condescendant. `zester` écarté :
zéro occurrence.

### Trois recommandations démenties par le banc, à la session précédente

Rappelées ici car elles fondent la méthode : la pondération par rareté, le modèle « ingrédient
principal + secondaires à poids fixes », et un seuil de récence jugé bon alors que le jeu de cas
était **aveugle aux produits laitiers**.

> **Mesurer avant de trancher — et se méfier d'un banc qui ne contredit jamais celui qui l'écrit.**

---

## 3. Les bugs, et ce qui les a révélés

Aucun n'a été trouvé en relisant le code.

| Bug | Trouvé par | Gravité |
|---|---|---|
| **Miel dans une recette `vegetalien`** (« Tofu laqué ») | Chasse aux effets de bord des 30 nouvelles recettes | ⛔ La promesse centrale de l'appli en défaut, en silence |
| **`planWeek` ne voyait que 5 candidats par créneau** | Banc de stress à 20 configurations | Invisible : le plan avait l'air normal |
| **6 recettes `vegetarien` en réalité végétaliennes** | Même chasse | Silencieux, sens inverse : elles disparaissaient de qui pouvait les manger |
| **`pourSlots` manquant** — liste non rangeable par repas | **Énumération des usages** demandée par l'utilisateur | La liste avait l'air complète |
| **Trous CIQUAL comptés comme des zéros** | Mesure de couverture par nutriment | Bruit dans les deux sens selon `NutrientSense` |

Le cas `pourSlots` mérite d'être retenu : §2 ARCHITECTURE exige une liste « rangeable par rayon /
repas / jour ». L'agrégation **détruisait** l'information de repas. Rien ne le signalait — c'est
en listant à quoi la liste sert, pas en relisant son code, que le manque est apparu.

Le cas du miel aussi : la décision 28 reprochait aux étiquettes multiples leur mode de défaillance
**silencieux**. L'étiquette unique ne l'élimine pas, **elle le déplace**.
`tests/regime-coherence.test.ts` le verrouille désormais dans les deux sens.

⚠️ Piège rencontré en écrivant cette règle : le beurre, la crème et le miel ne sont dans **aucun**
groupe animal (« matières grasses », « produits sucrés »). Un premier audit s'en remettant au seul
`Food.groupe` a produit **20 faux positifs** et laissait passer « Radis au beurre » comme
végétalienne. D'où `Food.origineAnimale` + `Food.deriveDe`, propagés en cascade.

---

## 4. Les pièges d'outillage

Consignés parce qu'ils ont coûté du temps deux fois.

- **`import 'node:sqlite'` est hoisté.** `catalog-loader.ts` cassait le bundle navigateur alors que
  la fonction qui l'utilise n'est **jamais appelée** côté client. Le message de Rollup ne désigne
  pas cette cause. D'où `catalog-loader-node.ts`, et 14 importateurs redirigés.
- **`root: 'app'` dans `vite.config.ts` a fait passer la suite de 572 tests à 528 — sans un seul
  échec.** Vitest lit `vite.config.ts` faute de config dédiée ; `tests/` et `catalog/` étaient hors
  racine. **Un test qui disparaît rend la CI verte pour de mauvaises raisons.** D'où
  `vitest.config.ts`, séparé.
- **`as unknown as SuggestionRequest` dans un banc** a masqué 3 champs manquants. Le banc rendait
  zéro alternative, sans erreur. Reconstruit sans cast.
- **Une fixture incomplète prise pour un mauvais attendu.** `ISOLATE_NUTRI_WEIGHTS` n'avait pas
  `pantry` ; l'ajout de la couche a déplacé un score de 100 à 97,6 et j'ai **d'abord corrigé la
  valeur attendue** avant de trouver la vraie cause. Corrigé à la source, avec avertissement.
- **Backticks dans un commentaire SQL** à l'intérieur du gabarit `SCHEMA_SQL` → `SyntaxError`.
  Erreur commise **deux fois dans la même session**, la seconde après l'avoir documentée.
- **Les gros heredocs échouent dans ce shell** (« unexpected EOF ») : écrire le fichier puis le lire.

---

## 5. Deux corrections de modélisation venues de l'utilisateur

**Créneau de repas ≠ type de plat.** J'avais conflé `petit_dejeuner/déjeuner/goûter/dîner` avec
`entrée/plat/accompagnement/fromage/dessert` et j'en avais conclu — à tort — qu'annoter les recettes
ferait disparaître les accompagnements. Les deux listes sont **orthogonales** : un accompagnement
peut être servi seul, comme un goûter est un repas à part entière. Les 241 recettes portent
désormais les deux.

**L'objectif calorique personnel.** §6.5 ARCHITECTURE l'interdisait *sans exception*. Objection
maintenue puis levée par l'utilisateur : acceptable si **opt-in, jamais par défaut, non mis en
avant, et sans compteur de reste**. La quatrième condition n'est pas négociable — §6.5 identifie
« il te reste 340 kcal » comme *le* mécanisme de restriction, pas l'affichage d'un chiffre.
**`ARCHITECTURE.md` §6.5 a été amendé** : la règle du projet veut que le document soit mis à jour,
pas contourné.

---

## 6. Où ça s'arrête

**572 tests verts (44 fichiers)**, typecheck propre, `vite build` OK, 20/20 configurations saines au
banc de stress. Catalogue : **199 aliments, 241 recettes, 62 gestes**.

Restait ouvert à la fin de la session — voir `ETAT.md` §9 pour l'état à jour :

- **Zéro photo** sur 241 recettes, et le lexique promis « illustré » est du texte seul.
- **`user.db` n'existe pas** : l'écran livré tourne sur un profil de démonstration codé en dur.
- **Aucune API de recherche** pour l'écran Recettes ; pas de table de tips pour l'écran Savoir.
- `analyzeWeek` et `suggestSubstitutions` restent non câblées.
- λ (MMR) non calibré — **débloqué** par le contenu, pas fait.
- Revue juridique avant publication, ouverte depuis l'audit du 2026-07-27.
