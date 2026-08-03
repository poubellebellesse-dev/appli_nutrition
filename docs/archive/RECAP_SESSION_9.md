# Récit de session 9 — 2026-08-02 : la provenance des recettes

> **Instantané daté. Ne jamais réécrire.** Chiffres et décisions vrais à cette date.
> État courant : [../FICHE_REPRISE.md](../FICHE_REPRISE.md) et [../ETAT.md](../ETAT.md).
> Chantier ouvert par cette session : [../SOURCES_RECETTES.md](../SOURCES_RECETTES.md).

⚠️ **Piste parallèle.** Une autre conversation a travaillé sur le même dépôt pendant cette session
(visite guidée, écran Paramètres, `savoir.tsx`, `ETAT.md`, `ARCHITECTURE.md`). Les fichiers touchés
ici sont disjoints des siens **sauf `detail-recette.tsx` et `user-recipe.ts`**, où les deux pistes
ont écrit. Tout est vert au moment où ce récit est écrit, mais un commit doit regarder ce qu'il prend.

---

## 1. D'où c'est parti

Une demande de rapport sur le catalogue. En le mesurant, une question de l'utilisateur revient trois
fois — « **d'où viennent les recettes ?** » — et la réponse honnête a fini par arriver : **les 241
recettes ont été écrites par un modèle de langage**, au fil des sessions de développement. Aucune
source, aucun test, et **rien dans le dépôt ne le disait**.

Le contraste était le vrai sujet. Les valeurs nutritionnelles viennent de CIQUAL et sont traçables à
la valeur près ; les 73 tips ont une `source_url` `NOT NULL` ouverte avant écriture ; les 8 fiches
« Comprendre » citent des DOI vérifiés un à un. **Les recettes étaient le seul contenu sans rien** —
sur un produit dont l'argument central est la traçabilité, et `CREDITS.md` n'en disait pas un mot.

La crainte exprimée par l'utilisateur — « ça va rebuter les gens » — visait à côté, et ça méritait
d'être dit : une recette copiée d'un blog n'est pas plus testée, une recette CC BY-SA d'un
contributeur anonyme non plus. **Ce qui rebute, ce n'est pas l'origine, c'est de ne pas savoir.**

---

## 2. Ce qui a été livré

### 2.1 Facette `cuisine` : 6 recettes annotées, vocabulaire fermé

29 recettes n'avaient aucune facette `cuisine`. Six étaient des plats à ancrage évident (curry
indien, spaghetti italiens, riz sauté chinois, boulgour libanais, galettes maghrébines, quinoa
mexicain) — annotées. **Les 23 autres sont des porridges, tartines et smoothies : laissés sans
cuisine, volontairement.**

⚠️ **Un correctif proposé a été retiré avant d'être écrit.** J'avais proposé de « corriger le filtre
pour qu'il ne masque plus les recettes sans cuisine ». Lecture faite de `engine/search/index.ts:97` :
`correspondAuxFacettes` n'exclut que si une cuisine est **activement sélectionnée**. Le correctif
aurait fait apparaître 23 porridges en filtrant sur « italienne ». **Il n'y avait pas de défaut.**

**Vocabulaire `cuisine` fermé au build** (26 valeurs) : seul le NOM de la facette était vérifié,
jamais sa valeur. `italienen` serait entré en base, aurait produit une pastille de filtre parasite
(les valeurs sont dérivées du catalogue) **et** se serait affiché sans drapeau — indiscernable des
7 zones qui n'en ont volontairement pas. Double échec silencieux.

### 2.2 Le schéma de provenance

Table **`recipe_source`** (une recette → N sources) et colonne **`recipe.teste_le`**. Bloc `sources:`
optionnel dans le YAML — absent = ni importée ni vérifiée — mais **complet dès qu'il est présent**.

**Deux types, et les confondre serait un mensonge :**

| Type | Affirme | Requiert | Rendu |
|---|---|---|---|
| `provenance` | la recette **vient de là** | `licence`, `auteur` | « D'après X — auteur · licence » |
| `reference` | ouverte pour **vérifier** | — | « Consulté pour vérifier cette recette » |

Un test d'écran **interdit** d'écrire « d'après » sur une référence. Une propriété de chargement
vérifie qu'**aucune recette du catalogue ne porte de `provenance`** — elle tombera au premier import
réel, ce qui est le signal voulu.

Affichage : « **Recette maison, non encore testée.** » en tête quand il n'y a rien ; bloc **Sources**
en bas de fiche sinon. En bas parce que l'écran se lit debout, mains occupées, et que deux liens
avant le titre repousseraient les ingrédients hors de l'écran.

⚠️ **Les recettes utilisateur n'héritent JAMAIS des sources de leur base.** Une variante hérite du
service et du piquant ; une fois les quantités modifiées, la référence ne décrit plus la recette.

### 2.3 Lot sanitaire — 10 recettes, 8 défauts trouvés

Volailles, viandes hachées, porcs. Deux sources ouvertes et lues :

- **Guide de bonnes pratiques d'hygiène — Consommateurs** (ministère de l'Agriculture, validé au JO) :
  « Cuire toutes les viandes à cœur à plus de 63 °C » ; hachée « non rosé à cœur, T° > 63 °C ».
- **Cooking your food** (Food Standards Agency / GOV.UK, 18 décembre 2017) : 70 °C pendant 2 minutes,
  équivalences 60 °C/45 min · 65 °C/10 min · 75 °C/30 s · 80 °C/6 s ; « juices should run clear ».

**8 recettes sur 10 ne donnaient aucun critère de cuisson vérifiable.** Les cuisses de poulet, le
filet mignon, le porc au caramel, le hachis, les poivrons farcis, le bœuf haché et l'escalope de
dinde ne disaient **rien** ; les boulettes disaient même « sans chercher à les cuire à cœur ».

⚠️ **Aucun temps ni aucune température n'a été modifié.** Les sources donnent un seuil, pas une durée
pour un plat donné. Ce qui manquait était le **critère** : « laisser mijoter » sans dire à quoi on
reconnaît que c'est cuit laisse l'utilisateur seul juge là où l'erreur rend malade.

⚠️ **Les deux seuils diffèrent (63 °C vs 70 °C/2 min) sans se contredire** : l'un est réglementaire
français, l'autre une réduction à 6 log dont la table descend elle-même à 65 °C/10 min. Les recettes
retiennent le **signe visuel**, commun aux deux et vérifiable sans thermomètre.

### 2.4 Lot classiques — 4 recettes confrontées au domaine public

**Escoffier, *Le Guide culinaire* (1903)**, domaine public et — c'est ce qui compte — **transcrit
page à page sur Wikisource**. Gallica et les PDF institutionnels sont des images ; Wikisource est du
texte. Second témoin : **Jeanne Anctil, *350 recettes de cuisine* (1915)**.

| Recette | Verdict |
|---|---|
| **Blanquette de veau** | ⛔ La **liaison aux jaunes d'œufs** manquait. Escoffier : « 5 jaunes d'œufs, jus de citron, muscade râpée, 1 décilitre de crème » ; Anctil : « 1 ou 2 jaunes d'œufs ». **Corrigée.** |
| **Navarin d'agneau** | ⚠️ **Ail et sucre** manquants (Escoffier p. 740 : « une gousse d'ail écrasée », 5 g de sucre qui caramélise). **Corrigés.** |
| **Veau Marengo** | ⚠️ **Ail** manquant (Anctil). **Corrigé.** |
| **Carottes Vichy** | ✅ **Conforme.** Technique identique aux « Carottes glacées » d'Escoffier. |

**Les quantités étaient déjà justes** — c'est le constat le plus utile. Roux de la blanquette :
Escoffier 100 g, nous 50 g de beurre + 50 g de farine = **100 g exactement**. Cuisson : « 1 h 30 »
contre 95 min. Farine du navarin : 24 g/kg contre **25 g/kg**. **L'erreur n'était jamais dans les
chiffres, toujours dans un geste manquant.**

⚠️ **Deux sources, jamais une.** La blanquette d'Anctil (québécoise) contient du bacon et des
cornichons qu'Escoffier ignore. **Diverger d'UNE source n'est pas être faux** — seul ce qui est
constant entre sources indépendantes justifie une correction. Le Marengo n'ayant qu'une source lue,
ses **croûtons frits** — pourtant sa garniture caractéristique — n'ont **pas** été ajoutés.

### 2.5 Un aliment ajouté : `jaune_oeuf` (200 aliments)

La blanquette exigeait des jaunes ; le catalogue n'avait que l'œuf entier. **L'approximer aurait été
faux** : 307 kcal et 26,7 g de lipides pour le jaune, contre 140 kcal et 9,8 g pour l'entier. Code
CIQUAL **22002** trouvé dans les données ANSES locales, valeurs importées par le script, **jamais
saisies**. Pas de `conditionnement_g` : un jaune ne s'achète pas, il se sépare.

⚠️ **Effet de bord voulu et vérifié : la blanquette porte désormais l'allergène `oeufs`.** Elle
disparaît des suggestions d'un utilisateur allergique — conséquence correcte, impossible tant que
l'ingrédient manquait.

---

## 3. Ce que la chasse aux sources a appris

### 3.1 Le domaine public culinaire couvre bien moins que son prestige

Sur cinq classiques tentés au second passage, **un seul a pu être vérifié**.

| | |
|---|---|
| Veau Marengo | ✅ trouvé (Anctil) |
| Sole meunière | ❌ Escoffier renvoie 4 fois à une « formule initiale » jamais atteinte |
| Riz pilaf | ❌ 31 occurrences de « Pilaw », **toutes en renvoi** |
| Soupe à l'oignon gratinée | ❌ **zéro occurrence** |
| Ratatouille | ❌ **zéro occurrence** |

**Les zéros sont un résultat, pas un échec de recherche** : vérifiés sur le texte intégral. La
ratatouille et la soupe à l'oignon gratinée **ne sont pas dans le *Guide culinaire* de 1903**.
S'y ajoute que les classiques ÉTRANGERS (tortilla, houmous, taboulé, teriyaki, rösti, salade grecque)
n'ont aucun équivalent francophone en domaine public transcrit. **Le vivier réel est de l'ordre de
10 à 20 recettes, pas 100.**

### 3.2 Télécharger une fois vaut mieux que chercher dix fois

Page par page : 2 à 4 requêtes par recette, dont la moitié tombent sur un renvoi interne. Le texte
intégral (`archive.org/download/bnf-bpt6k65768837/`, 1,9 Mo) rend toute recherche ultérieure gratuite.

⚠️ **Mais son OCR est dégradé** — « citron » y devient « cîlroii », le titre courant « LE GUIDE
CULINAIRE » devient « LE LKhE LLLI.XAIHE ». Il sert à **localiser et décider**, jamais à **citer** :
les citations viennent de la transcription Wikisource. **Ne pas inverser les deux.**

### 3.3 Les domaines qui bloquent, encore

`fsis.usda.gov`, Santé Canada et `ask.fsis.usda.gov` renvoient 403 ou une coquille vide — le même
mur que celui documenté dans `catalog/tips/README.md`. Les PDF de l'ANSES et du ministère ne sont pas
lisibles par requête HTTP simple : **`pdftotext` est présent sur la machine** et les a ouverts, ce
qui est ce qui a permis de citer le guide du ministère. À réessayer avant de renoncer à une source.

### 3.4 Sourcer, vérifier, tester : trois choses différentes

- **Sourcer** = attacher une référence. Rétroactif sur une recette écrite ailleurs = **fabriquer une
  provenance**. Interdit.
- **Vérifier** = confronter à une source et **corriger si ça diverge**. C'est ce qui a été fait,
  14 fois.
- **Tester** = cuisiner et juger. **`teste_le` est à 0 sur 241.** Ni une source ni un test unitaire
  ne remplacent une casserole.

---

## 4. L'état à la fin de la session

```
npm test        → 1080 verts (75 fichiers)
npm run typecheck → propre
node catalog/build.mjs → 200 aliments · 241 recettes · 62 gestes · 73 tips · 8 fiches (33 positions)
recipe_source   → 14 recettes sourcées sur 241 · teste_le renseigné : 0
```

**Fichiers touchés** — `catalog/build.mjs`, `build.test.ts`, `sources/foods.yaml`,
`sources/ciqual-mapping.yaml`, 20 recettes, `CREDITS.md` ; `engine/domain/catalog.ts`,
`data/catalog-loader.ts` (+ test), `data/user-recipe.ts`, 5 fixtures de test,
`ui/screens/detail-recette.tsx` (+ test) ; `docs/SOURCES_RECETTES.md` (nouveau), `docs/README.md`.

**Rien n'a été committé.**

---

## 5. Ce qui reste, et le piège du prochain lot

1. **Étendre le lot sanitaire** aux **poissons, œufs et coquillages** — non examinés, et ils portent
   leurs propres risques (Listeria, Salmonella). C'est la suite la plus utile.
2. **Écrire à cuisine-libre.org** — 603 recettes CC0/domaine public en français. ⚠️ Leur page
   « licences » **ne mentionne pas le CC BY-NC-SA** qui circule pourtant dans leurs flux : lire la
   licence recette par recette, jamais se fier au décompte global.
3. **Cuisiner et renseigner `teste_le`.** Le seul point qu'aucun outil ne remplace.
4. **Alternatives par substitution** — demandé par l'utilisateur, **non commencé**. ⚠️ Une décision
   de conception attend AVANT toute écriture : une variante « blanquette au poulet » est-elle une
   **recette à part entière** ou un **couple de la table `substitution`** ? Cette table est vide par
   décision 27 et `suggestSubstitutions` n'est pas câblée — les deux chemins sont ouverts, ils ne
   coûtent pas la même chose et ne donnent pas le même produit.

⚠️ **Le piège, pour qui reprendra** : afficher des sources sur 14 recettes pendant que 227 portent
« non encore testée » est une **transparence, pas une garantie**. Ne pas en conclure que le catalogue
est vérifié, et ne pas céder à la tentation de coller une source « qui dit à peu près » sur les
autres pour faire disparaître la mention.
