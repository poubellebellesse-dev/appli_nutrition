# Sources de recettes — ce qui existe, ce que ça coûte, ce qui est écarté

> **Chantier ouvert.** Recense les sources de recettes réutilisables sans léser personne, avec leur
> licence et leur coût réel d'intégration. Aucune n'est encore utilisée : les 241 recettes du
> catalogue sont toutes écrites pour ce projet.
>
> Sources vérifiées le **2026-08-02** — licences et volumes lus sur les pages elles-mêmes, pas de
> mémoire. Les licences changent : revérifier avant tout import.

---

## 1. D'où viennent les 241 recettes actuelles

**Elles ont été écrites pour ce projet, par un modèle de langage, au fil des sessions de
développement.** Aucune n'a de source externe, et il ne faut pas lui en inventer une.

C'est le seul contenu du dépôt dans ce cas — et le contraste avec le reste est le vrai sujet :

| Contenu | Origine | Vérifiable |
|---|---|---|
| Valeurs nutritionnelles (199 aliments) | CIQUAL 2025 / ANSES, import scripté, mappings vérifiés un à un | ✅ à la valeur près |
| Tips (73) | Sources externes ouvertes et lues **avant** écriture, `source_url` `NOT NULL` | ✅ |
| Fiches « Comprendre » (8) | Méta-analyses et textes d'autorité, DOI vérifiés un à un | ✅ |
| **Recettes (241)** | **Écrites pour ce projet** — quantités, temps, températures | ❌ **aucune source, aucun test** |

⚠️ **Ne jamais sourcer une recette après coup.** Retrouver une référence qui « dit à peu près la même
chose » et l'attacher à un texte qui n'en vient pas fabrique une provenance. C'est exactement ce que
`catalog/tips/README.md` interdit — « écrire d'abord et chercher la source ensuite produit
inévitablement des sources qui disent à peu près ». La règle vaut ici, en plus fort : une source
inventée sur un produit dont l'argument EST la traçabilité coûte plus cher que l'absence de source.

⚠️ **Le risque n'est pas juridique, il est factuel.** Le catalogue est composé de classiques du
répertoire (blanquette, gratin dauphinois, coq au vin, carottes Vichy, chakchouka) dont la structure
est un fait culturel commun, et de compositions triviales (« Dattes aux noix », « Tartine avocat
citron ») que personne ne peut revendiquer. Ce qui n'est adossé à rien, ce sont les **chiffres** :
1 200 g de veau, 95 minutes de frémissement, 8 g de sel pour 6 portions. Plausibles, jamais mesurés.
Priorité de vérification : **temps et températures des viandes, volailles et poissons** — le seul
endroit où l'erreur a des conséquences sanitaires.

---

## 2. Le cadre juridique, en deux phrases

**Une recette n'est pas protégeable par le droit d'auteur**, ni en France ni aux États-Unis : une
liste d'ingrédients et une suite d'opérations sont des faits et des procédés. Ce qui EST protégé,
c'est la **rédaction originale**, les **photos** et les anecdotes qui les accompagnent.

Conséquence : reprendre le noyau factuel d'une recette de blog en réécrivant le texte serait légal.
Le projet s'y refuse quand même — §8.7 ARCHITECTURE interdit déjà le scrap massif, et prendre le
travail de quelqu'un parce que la loi ne l'en empêche pas n'est pas la même chose que le respecter.
**C'est un choix, pas une obligation.** L'écrire évite de le redécouvrir comme une contrainte.

---

## 3. Les sources disponibles

### 3.1 cuisine-libre.org — 🇫🇷 la piste principale

Environ **3 800 recettes en français**, chacune affichant sa licence.

| Licence | Recettes | Contrainte |
|---|---|---|
| CC BY-SA 3.0 | 3 000 | Attribution **+ partage à l'identique** |
| **CC0** | **342** | **aucune** |
| **Domaine public** | **261** | **aucune** |
| CC BY 3.0 | 154 | Attribution |
| GNU GPL | 44 | Attribution + dérivés libres |
| LPRAB | 3 | Minimales |

**603 recettes CC0 ou domaine public** — sans aucune contrainte, réutilisation commerciale incluse.
C'est la cible propre.

✅ **Le CC BY-SA est ACCEPTÉ — décision utilisateur du 2026-08-02.** Le gisement passe de 603 à
~3 800 recettes. Ce que cela coûte : l'attribution de l'auteur sur chaque recette importée, et le
partage à l'identique de ce qui en dérive.

⚠️ **Deux points que l'ancienne rédaction de ce paragraphe disait faux, et qu'il faut lire dans le
bon sens :**

1. **Le schéma SAIT créditer un auteur** depuis le 2026-08-02. `recipe_source` a les colonnes
   `licence` et `auteur`, obligatoires sur le type `provenance`, et l'écran rend déjà
   « D'après *titre* — auteur · licence ». La phrase « ce que le schéma ne sait pas faire » datait
   d'avant §5, écrit le même jour.
2. **Le partage à l'identique s'attache aux ADAPTATIONS, pas au fichier qui les transporte.** Chaque
   recette importée puis normalisée est une adaptation de CETTE recette et reste CC BY-SA ; les 241
   recettes maison, qui n'en dérivent pas, ne le deviennent pas parce qu'elles voisinent dans le même
   `catalog.db`. C'est le sens de la licence par recette portée par `recipe_source`.
   ⚠️ **Lecture non confirmée par un juriste.** Elle tient tant que chaque recette porte sa licence
   ligne par ligne et qu'aucune recette maison n'est construite À PARTIR d'une importée. Le jour où
   l'une dérive de l'autre, elle hérite du share-alike.

⚠️ **Du CC BY-NC-SA circule dans les flux et N'APPARAÎT PAS au décompte de la page « licences ».**
Constaté le 2026-08-02 sur le flux principal. `NC` = usage non commercial : gratuit ou non,
distribuer via un store dans un conteneur Capacitor est une zone d'interprétation que personne n'a
envie de plaider. **Lire la licence recette par recette**, jamais se fier au décompte global.

**Récupération.** Pas d'API ni de dump — le site l'écrit lui-même et invite à décrire son besoin.
Mais les **flux RSS contiennent le texte complet** (ingrédients avec quantités, étapes numérotées,
images) **et la licence de chaque recette**. Ils sont explicitement proposés à la syndication : les
lire n'est pas du scrap. Limite : **11 recettes par flux** (les dernières publiées), et **aucun
filtre par licence** — d'où l'intérêt d'écrire aux mainteneurs pour cibler les 603 CC0/DP.

- Licences : <https://www.cuisine-libre.org/licences>
- Export et flux : <https://www.cuisine-libre.org/exporter>
- Contact : <https://www.cuisine-libre.org/contact>

⚠️ **Un scraper tiers existe sur GitHub. Ne pas l'utiliser** — §8.7 interdit le scrap massif, et un
projet qui partage nos valeurs mérite un message, pas un robot.

### 3.2 USDA MyPlate Kitchen — ⛔ ÉCARTÉ le 2026-08-02, la piste n'existe plus

**1 072 recettes**, œuvre du gouvernement fédéral américain, donc **domaine public sans réserve**
(17 U.S.C. §105) : aucune attribution requise, usage commercial inclus. Le statut juridique n'a
jamais été le problème.

⛔ **Le site officiel a disparu.** `myplate.gov` a été retiré le **7 janvier 2026** et remplacé par
`RealFood.gov`, **qui ne propose pas de bibliothèque de recettes équivalente**. Il n'y a plus de
source institutionnelle pour ces 1 072 recettes.

⚠️ **`myplate.food` n'est PAS un miroir officiel** — c'est un site tiers privé, qui **se déclare
lui-même non affilié et non approuvé par l'USDA**. La rédaction précédente de ce paragraphe le
présentait comme une préservation de la bibliothèque : c'était faux. Le contenu fédéral d'origine
reste domaine public, mais rien ne garantit ni sa fidélité, ni sa pérennité, et une reformulation par
l'hébergeur ferait naître un droit d'auteur nouveau sur le texte reformulé.

⚠️ Restait de toute façon l'obstacle du registre : anglais, **cups et onces**, profil alimentaire
américain, sur un catalogue bâti sur CIQUAL.

⚠️ Anglais, **cups et onces**, profil alimentaire américain. Le coût de conversion s'ajoute au coût
de normalisation de §4, sur un contenu qui cadre mal avec un catalogue bâti sur CIQUAL.

- <https://myplate.food/recipes> · <https://www.myplate.gov/myplate-kitchen>

### 3.3 Wikisource — ouvrages du domaine public, TRANSCRITS

**La source la plus exploitable trouvée à ce jour**, et pour une raison technique : les textes y sont
**transcrits page à page**, pas scannés. Gallica, les PDF de l'ANSES et ceux du ministère sont des
images — illisibles sans OCR local. Wikisource est du texte.

| Ouvrage | Auteur, année | Statut |
|---|---|---|
| **Le Guide culinaire** | Escoffier, 1903 | Domaine public — **utilisé**, voir §5 ter |
| 350 recettes de cuisine | Jeanne Anctil, 1915 | Domaine public — **utilisé** (second témoin) |
| La grande cuisine illustrée | Salles & Montagné, 1900 | 1 221 recettes, non exploré |
| Le Livre de Pâtisserie | Jules Gouffé | Non exploré |

⚠️ **Le domaine public n'oblige à rien, mais citer reste utile** : la référence dit au lecteur à quoi
la recette a été confrontée. C'est du type `reference`, jamais `provenance` — nos recettes n'en
viennent pas, elles y ont été comparées.

### 3.4 Wikibooks — CC BY-SA, et il y a DEUX Wikibooks

⚠️ **La première rédaction de ce paragraphe n'avait regardé que le Wikibooks anglais.** Le
francophone existe et il est bien plus pertinent — c'était un trou, pas un choix.

| | Wikibooks 🇫🇷 | Wikibooks 🇬🇧 |
|---|---|---|
| Adresse | <https://fr.wikibooks.org/wiki/Livre_de_cuisine> | <https://en.wikibooks.org/wiki/Cookbook> |
| Licence | CC BY-SA 4.0 (lue en pied de page) | CC BY-SA 3.0 |
| Registre | **Cuisine domestique et régionale française** | Anglophone, très inégal |
| Volume | **Non chiffré** — la catégorie ne l'affiche pas | Plusieurs milliers |
| Récupération | Pages wiki, export PDF ; pas de dump dédié — passer par les dumps XML Wikimedia | Dumps XML officiels + dataset Hugging Face `gossminn/wikibooks-cookbook` (2024-07-31) |

⚠️ **Qualité de wiki communautaire : les quantités ne sont pas systématiquement chiffrées.** Sur un
schéma qui exige une masse en grammes par ingrédient (§4), c'est le coût principal, avant la licence.

- <https://en.wikibooks.org/wiki/Help:Database_download>
- <https://huggingface.co/datasets/gossminn/wikibooks-cookbook>

### 3.5 Le secteur public — la piste qui semblait évidente, et qui ne l'est pas

**Balayage du 2026-08-02, licences lues page par page.** L'hypothèse de départ était que les contenus
des administrations relèvent par défaut de la **Licence Ouverte / Etalab 2.0**, donc réutilisables
commercialement. **Elle est fausse** : le régime d'ouverture porte sur les *données* administratives,
pas sur le contenu éditorial, sur lequel les organismes conservent leur droit d'auteur.

| Organisme | Volume | Ce que dit la licence | |
|---|---|---|---|
| **mangerbouger.fr** (Santé publique France, *La Fabrique à menus*) | **~2 000 recettes** | Tous droits réservés, **usage non commercial** imposé, mention « Droits réservés » obligatoire | ⛔ |
| agriculture.gouv.fr (almanachs mensuels) | — | Reproduction commerciale sur autorisation préalable, convention possiblement payante | ⛔ |
| MAPAQ / gouvernement du Québec | — | Autorisation préalable obligatoire, souvent limitée au non commercial | ⛔ |
| data.gouv.fr | — | **Aucun jeu de données de recettes.** Des miroirs d'Open Food Facts (base de *produits*) et des applis tierces | ⛔ |
| open.canada.ca | — | Open Government Licence, réutilisation commerciale OK — mais ce sont des **données d'enquête nutritionnelle**, pas des fiches cuisinables | ⛔ |
| NHS *Healthier Families* 🇬🇧 | — | **Copyright DHSC, usage personnel** — et surtout **PAS** l'Open Government Licence | ⛔ |
| Heart Foundation 🇦🇺 | — | CC BY-**NC-ND** — le *ND* interdit les dérivés, or normaliser en grammes EST un dérivé | ⛔ |
| FAO / OMS | — | **Aucune base de recettes n'existe** | ⛔ |
| ADEME (*Recettes et astuces anti-gaspi*) | — | **Licence introuvable** sur la page comme sur le PDF. Statut inconnu ⇒ pas utilisable en l'état | ❔ |

⚠️ **Le piège à retenir : « secteur public » ≠ « domaine public », partout sauf aux États-Unis.** Le
Crown copyright britannique et canadien ne concède rien par défaut, et les *Cooperative Extension*
universitaires américaines ne sont **pas** des œuvres fédérales — chacune a sa propre politique.

⚠️ **Non explorés faute de budget de recherche** : Belgique (SPF Santé publique, AFSCA), Suisse
(SSN/SGE, OSAV), INRAE, ANSES, Agence Bio, projets alimentaires territoriaux, CHU, Extenso.

**Ce que la gratuité de l'application change — et ne change pas.** Le modèle est 100 % gratuit, sans
publicité, sans suivi, **et sans aucun don** (`STRATEGIE_DISTRIBUTION.md` §6) : aucun flux d'argent
entrant, ce qui est une position non commerciale plus nette que la moyenne. Mais :

- sur le **share-alike**, cela rend le coût négligeable → §3.1, accepté ;
- sur le **NC**, cela ne suffit pas à trancher la zone grise, et surtout **le NC interdirait pour
  toujours** toute version payante ou publicitaire, alors que `STRATEGIE_DISTRIBUTION.md` §1 laisse
  « argent = bonus » ouvert. Une porte fermée définitivement, pour du contenu dont on n'a pas besoin ;
- sur le **tous droits réservés**, cela ne change **rien** : aucun droit de redistribution n'est
  concédé, à aucun prix. Autoriser la consultation non commerciale n'est pas autoriser la
  réintégration dans un produit dérivé.

⚠️ **Mais la gratuité rend une DEMANDE crédible.** Une application gratuite, sans publicité, sans
suivi, sans don et alignée sur les objectifs du PNNS est un demandeur plausible auprès de Santé
publique France pour les ~2 000 recettes de mangerbouger. C'est le même geste qu'écrire à
cuisine-libre.org (§7). Demander coûte un courrier ; présumer coûte un procès.

---

## 4. Le coût réel n'est pas juridique, il est de normalisation

**Une recette importée n'est pas utilisable telle quelle.** Le moteur exige que chaque ingrédient
soit un `food_id` parmi les 199 aliments, avec une **masse en grammes** — c'est ce qui fait marcher
le calcul nutritionnel, les allergènes, la liste de courses et `scaleRecipe`.

Ce que donne une source :

```
1 dorade de 1,3 kg
4 tomates
```

Ce qu'exige `catalog/recipes/*.yaml` :

```yaml
- food_id: dorade            # doit exister au catalogue — sinon : le créer, le mapper à CIQUAL,
  quantite_g: 1300           #   importer ses 9 nutriments, l'annoter (groupe, origine animale…)
  unite_affichage: "1 dorade de 1,3 kg"
- food_id: tomate
  quantite_g: 400            # ⚠️ « 4 tomates » n'est pas une donnée. Quelqu'un doit trancher.
```

S'y ajoutent l'annotation des étapes avec les gestes du lexique (`lexicon_ids`), la cohérence
régime ⇄ ingrédients (verrouillée par `tests/regime-coherence.test.ts`), les facettes, la saison et
le créneau.

**Compte 15 à 30 minutes par recette importée** — l'ordre de grandeur du temps d'en écrire une.

| Volume importé | Coût | Verdict |
|---|---|---|
| Les 603 CC0/DP | **150 à 300 h** | Irréaliste. Ne pas s'y engager. |
| 30 à 50 recettes | **10 à 25 h** | Faisable, et suffisant (§6) |

⚠️ **Le volume n'est pas le besoin.** Le catalogue actuel a été construit POUR couvrir les 199
aliments et tous les créneaux × régimes (végétalien 42/42 au banc de stress, plus aucun aliment
dormant). Un lot externe ne se pose pas sur cette grille : il la troue. Importer sert la
**provenance** et la diversité, jamais la couverture.

---

## 5. Le schéma — FAIT le 2026-08-02

Table **`recipe_source`** (une recette → N sources) et colonne **`recipe.teste_le`**. Le bloc
`sources:` d'un YAML est **optionnel** — son absence dit « ni importée ni vérifiée », le cas de 231
recettes sur 241 — mais **complet dès qu'il est présent**.

**Deux types, et les confondre serait un mensonge :**

| Type | Ce qu'il affirme | Champs requis | Rendu à l'écran |
|---|---|---|---|
| `provenance` | La recette **vient de là** (import d'une source libre) | + `licence`, `auteur` | « D'après X — auteur · licence » |
| `reference` | Ouverte pour **vérifier** la recette | — | « Consulté pour vérifier cette recette » |

Une `reference` ne revendique aucune origine : c'est une bibliographie. Écrire « d'après » dessus
prêterait à la recette une provenance qu'elle n'a pas — d'où un test d'écran qui l'interdit, et une
propriété de chargement qui vérifie qu'**aucune recette du catalogue ne porte de `provenance`**.
Elle tombera au premier import réel, ce qui est le signal voulu.

Le build refuse : un type hors vocabulaire, un titre vide, une URL non http(s), une URL en double
sur la même recette, une `consulte_le` absente ou hors format ISO, une `provenance` sans licence ou
sans auteur, un `teste_le` mal formé. Trois tests de rejet, deux propriétés de chargement, trois
tests d'écran.

⚠️ **`teste_le` est à 0 sur 241.** Personne n'a encore cuisiné une seule recette du catalogue pour
en juger le résultat. La colonne existe pour que ce fait cesse d'être invisible, pas pour prétendre
le contraire.

Affichage (`ui/screens/detail-recette.tsx`) : la mention **« Recette maison, non encore testée. »**
en tête quand il n'y a ni source ni test, et le bloc **Sources** en bas de fiche sinon — en bas
parce que l'écran se lit debout, mains occupées, et que deux liens avant le titre repousseraient les
ingrédients hors de l'écran.

## 5 bis. Le lot pilote — 10 recettes vérifiées le 2026-08-02

Les cuissons à risque sanitaire : 4 volailles, 4 viandes hachées, 2 porcs. Deux références
institutionnelles, ouvertes et lues :

- **Guide de bonnes pratiques d'hygiène — Consommateurs**, ministère de l'Agriculture (validé au JO) :
  « Cuire toutes les viandes à cœur à plus de 63 °C » ; viande hachée « non rosé à cœur, T° > 63 °C » ;
  pour les enfants de moins de 15 ans, steaks hachés « à une température supérieure à +63 °C (cela
  correspond visuellement à une viande non rosée à cœur) ».
- **Cooking your food**, Food Standards Agency / GOV.UK (18 décembre 2017) : 70 °C pendant 2 minutes,
  équivalences 60 °C/45 min · 65 °C/10 min · 75 °C/30 s · 80 °C/6 s ; volaille, porc et viande hachée
  à cuire à cœur ; signes visuels « the juices should run clear », « no pink, fleshy meat ».

⚠️ **Les deux seuils diffèrent (63 °C vs 70 °C/2 min) et ce n'est pas une contradiction** : 63 °C est
le seuil réglementaire français, 70 °C/2 min l'équivalent d'une réduction à 6 log recommandé par la
FSA — dont la propre table d'équivalences descend à 65 °C/10 min. Les recettes retiennent le **signe
visuel**, commun aux deux sources et vérifiable sans thermomètre.

**Ce que la vérification a trouvé — 8 recettes sur 10 étaient muettes sur la cuisson à cœur :**

| Recette | Avant | Après |
|---|---|---|
| Cuisses de poulet rôties | rien | jus clair, chair non rosée, piquée à l'os |
| Blanc de poulet rôti | « cuit à cœur », sans critère | entaillé au point le plus épais, jus clair |
| Poulet basquaise | « la chair se détache de l'os » | + jus clair près de l'os |
| Escalope de dinde | rien | la cuisson se termine au mijotage, pas aux 2 min par face |
| Bœuf haché sauce tomate | rien | mijoter jusqu'à ce que plus rien ne soit rosé |
| Boulettes de bœuf | « sans chercher à les cuire à cœur » | + contrôle final, boulette ouverte non rosée |
| Hachis de bœuf | rien | + le gratinage ne réchauffe que la surface |
| Poivrons farcis | rien | + la farce est protégée par le poivron et chauffe moins |
| Filet mignon de porc | rien | aucune tranche rosée |
| Porc au caramel | rien | ouvrir un cube pour vérifier |

⚠️ **Aucun temps ni aucune température n'a été modifié** — les sources donnent un seuil à atteindre,
pas une durée pour un plat donné. Ce qui a été corrigé, c'est **l'absence de critère vérifiable** :
une recette qui dit « laisser mijoter » sans dire à quoi on reconnaît que c'est cuit laisse
l'utilisateur seul juge sur le seul point où l'erreur rend malade.

⚠️ **Vérifier n'est pas tester.** Ces 10 recettes ont été confrontées à une référence sanitaire ;
aucune n'a été cuisinée. `teste_le` reste `null` pour les 241.

---

## 5 ter. Lot classiques — 3 recettes confrontées au domaine public (2026-08-02)

**Source principale : Escoffier, *Le Guide culinaire* (1903)** — domaine public (Escoffier mort en
1935), **transcrit page à page sur Wikisource**, donc lisible sans OCR. C'est ce qui le rend
utilisable là où Gallica et les PDF institutionnels échouent.

Second témoin sur la blanquette : **Jeanne Anctil, *350 recettes de cuisine* (1915)**, Wikisource.

⚠️ **Deux sources, pas une.** Une seule ne dit rien : la blanquette d'Anctil (québécoise) contient du
bacon et des cornichons qu'Escoffier ignore. Diverger d'UNE source n'est pas être faux — seul ce qui
est **constant entre sources indépendantes** vaut correction.

| Recette | Verdict | Détail |
|---|---|---|
| **Blanquette de veau** | ⛔ **divergence réelle, corrigée** | La liaison aux **jaunes d'œufs** manquait. Escoffier : « 5 jaunes d'œufs, jus de citron, muscade râpée, 1 décilitre de crème » ; Anctil : « 1 ou 2 jaunes d'œufs ». **Les deux sources l'ont, nous ne l'avions pas** — sans jaunes, ce n'est pas une blanquette, c'est un veau à la crème. |
| **Navarin d'agneau** | ⚠️ deux manques, corrigés | Escoffier p. 740 : « une gousse d'ail écrasée » et 5 g de sucre qui caramélise à la coloration. Absents des deux côtés chez nous. |
| **Carottes Vichy** | ✅ **conforme, rien à corriger** | Escoffier p. 1024 renvoie aux « Carottes glacées » : eau, beurre, sucre, sel, réduction jusqu'au sirop, enrobage, persil haché. Technique identique à la nôtre. |

**Ce que la comparaison des proportions a montré** — et c'est le plus intéressant : les quantités
étaient déjà justes. Roux de la blanquette : Escoffier 100 g, nous 50 g de beurre + 50 g de farine =
**100 g exactement**. Cuisson : Escoffier « 1 h 30 », nous 95 min. Farine du navarin : Escoffier
60 g pour 2,5 kg (24 g/kg), nous 30 g pour 1,2 kg (**25 g/kg**). L'erreur n'était pas dans les
chiffres, elle était dans un **geste manquant**.

⚠️ **Un aliment a dû être ajouté : `jaune_oeuf` (CIQUAL 22002), 200 aliments désormais.** L'œuf
entier ne pouvait pas en tenir lieu — 307 kcal et 26,7 g de lipides pour le jaune contre 140 kcal et
9,8 g pour l'entier. L'approximer aurait produit exactement le genre de valeur fausse que §5.1 bis
cherche à éliminer. Valeurs importées de CIQUAL, jamais saisies. Pas de `conditionnement_g` : un
jaune ne s'achète pas, il se sépare.

⚠️ **Effet de bord voulu et vérifié : la blanquette porte désormais l'allergène `oeufs`.** Elle
disparaît des suggestions d'un utilisateur allergique aux œufs — c'est la conséquence correcte, et
elle n'aurait pas eu lieu si l'ingrédient était resté absent.

⚠️ **Les carottes du navarin (400 g) restent absentes d'Escoffier**, qui ne met que pommes de terre
et petits oignons. Non corrigé, et volontairement : notre titre annonce « aux légumes primeurs », qui
est la variante printanière. Une divergence assumée par le titre n'est pas une erreur.

### Second passage (même jour) — et ce qu'il a appris

| Recette | Résultat |
|---|---|
| **Veau Marengo** | ⚠️ **Ail manquant, corrigé.** Anctil 1915, page dédiée : huile d'olive, oignon, farine, vin blanc, bouillon, tomates, muscade, **« 1 gousse d'ail écrasée »**, bouquet garni, champignons. Notre version avait tout sauf l'ail. |
| Sole meunière | ❌ **Non vérifiée.** Escoffier renvoie quatre fois à une « formule initiale » (*Cuisson des Poissons à la Meunière*) jamais atteinte en 4 tentatives. |
| Riz pilaf | ❌ 31 occurrences de « Pilaw » chez Escoffier, **toutes en renvoi**, jamais la formule. |
| Soupe à l'oignon gratinée | ❌ **ZÉRO occurrence** dans le texte intégral d'Escoffier. |
| Ratatouille | ❌ **ZÉRO occurrence.** |

⚠️ **Les zéros sont une information, pas un échec de recherche.** Vérifiés sur le texte intégral
téléchargé localement (1,9 Mo). **Ratatouille et soupe à l'oignon gratinée ne sont pas dans le
*Guide culinaire* de 1903** — ce sont des plats popularisés plus tard. Le domaine public culinaire
couvre beaucoup moins que son prestige ne le laisse croire.

⚠️ **Le Marengo n'a qu'UNE source lue**, contre deux pour la blanquette. L'ail a été ajouté parce que
la source l'écrit explicitement et que le geste est cohérent avec le navarin déjà corrigé. **Les
croûtons frits, garniture caractéristique du Marengo chez Anctil, n'ont PAS été ajoutés** : une
seule source, et c'est une garniture de service qui changerait le profil nutritionnel du plat.
Divergence connue et assumée.

### Méthode : télécharger une fois, chercher en local

Chercher page par page sur Wikisource coûte 2 à 4 requêtes par recette, dont la moitié tombent sur
un renvoi interne. **Télécharger le texte intégral une fois** (`archive.org/download/bnf-bpt6k65768837/`,
1,9 Mo) rend les recherches suivantes gratuites et permet de répondre à « ce plat y est-il ? » en une
seconde.

⚠️ **Mais l'OCR d'archive.org est dégradé** — scan BnF, « citron » y devient « cîlroii », le titre
courant « LE GUIDE CULINAIRE » devient « LE LKhE LLLI.XAIHE ». Il sert à **localiser et décider**,
jamais à **citer** : les citations viennent de la transcription Wikisource, qui est propre. Ne pas
inverser les deux.

⚠️ **Ce que le domaine public ne couvrira jamais.** Escoffier n'a ni coq au vin ni gratin dauphinois,
et aucune source ancienne ne décrira « Tartine avocat citron » ou « Smoothie fraise-banane-avoine ».
Les classiques ÉTRANGERS (tortilla, houmous, taboulé, teriyaki, rösti, salade grecque) n'ont pas
d'équivalent francophone en domaine public transcrit. **Cette méthode plafonne bien plus bas
qu'espéré** : sur 5 classiques tentés au second passage, **1 seul a pu être vérifié**.

## 5 quater. Lot poissons, œufs et coquillages (2026-08-02)

**Quatre sources ouvertes et lues**, toutes sur des domaines de la liste blanche du build :

| Source | URL |
|---|---|
| ANSES, avis produits de la pêche (saisine 2012-SA-0202) | `anses.fr/system/files/NUT2012sa0202.pdf` |
| ANSES, fiche *Salmonella* spp. (saisine 2016-SA-0080) | `anses.fr/system/files/BIORISK2016SA0080Fi.pdf` |
| ANSES, fiche *Histamine* (saisine 2016-SA-0270) | `anses.fr/fr/system/files/BIORISK2016SA0270Fi.pdf` |
| Ministère de l'Agriculture, *Les biotoxines marines* | `agriculture.gouv.fr/les-biotoxines-marines` |

### Ce que la vérification a trouvé

**1. Trois recettes contredisaient l'ANSES — corrigé.** `mousse-chocolat`, `mousse-fromage-blanc-fruits-rouges`
et `creme-mascarpone-cacao` portaient `conservation_jours: 2`. L'ANSES écrit : « Les préparations à base
d'œufs sans cuisson (mayonnaise, crèmes, mousse au chocolat, pâtisseries, etc.) devraient être
consommées sans délai après leur préparation ou maintenues au froid pour être consommées **dans les
24 heures**. » → passées à `1`.
⚠️ **Ce n'était pas un avertissement manquant, c'était une donnée fausse** — et `conservation_jours`
alimente le moteur de restes, donc l'erreur se propageait jusque dans la planification de la semaine.
C'est le seul défaut du lot qui avait une conséquence au-delà du texte.

**2. Neuf recettes n'avaient aucun critère de cuisson — corrigé** d'après la FSA (« *fish flesh should
turn opaque (no longer transparent) and separates easily with a fork* » ; « *prawns, scallops, crab,
and lobster flesh should become firm and opaque* ») : maquereau, truite, bar, dorade, merlu, lotte,
sole, crabe, langoustines. **Aucun temps ni aucune température modifié**, comme au lot pilote.
⚠️ La **lotte** porte « ferme et opaque », critère des crustacés de la même page : sa chair dense ne
s'effeuille pas, lui appliquer « se détache à la fourchette » décrirait un phénomène qui n'a pas lieu.
Adaptation assumée, même source.

### Ce qui a été délibérément NON écrit — et pourquoi c'est un résultat

- **Rien sur l'histamine** (thon, maquereau, sardine). ANSES : « L'histamine est une molécule
  **thermostable** […] Le seul moyen de prévention consiste à […] respect de la chaîne du froid. »
  Une consigne de cuisson ici laisserait croire à une protection inexistante.
- **Rien de rassurant sur la cuisson des coquillages.** Ministère : « les biotoxines marines sont
  thermostables […] la cuisson des coquillages contaminés ne diminue pas leur toxicité. » Seule
  l'origine protège — zone de production autorisée et contrôlée.
- **Rien sur les calamars.** ⚠️ **Aucune des quatre sources ne couvre les céphalopodes.** Le catalogue
  a `calamar` et `poulpe` ; leur critère de cuisson reste non sourcé. Trou déclaré, pas comblé.
- **Aucun critère sourcé pour l'œuf.** ⚠️ **Aucune autorité lue ne donne de critère de cuisson pour
  un œuf** — le seul chiffre trouvé chez l'ANSES (70 °C) vise explicitement les viandes de porc et de
  volaille. Ne pas l'extrapoler. Trois recettes (`omelette-fines-herbes`, `flan-oeufs-caramel`,
  `pain-perdu`) restent sans critère : leur rédaction est améliorable, mais rien ne peut y être
  attaché comme source sanitaire.

### Ce qui reste en attente d'un arbitrage

- **Trois préparations crues.** `sardines-marinees-citron` et `hareng-pommes-terre-tiedes` :
  l'ANSES range explicitement les « marinades, carpaccio » parmi les « poissons crus ou insuffisamment
  cuits » exposés aux *Anisakidae*, et recommande « congélation pendant 7 jours dans un congélateur
  domestique ». ⚠️ **La source ne nomme ni le citron ni le vinaigre** : elle classe toute marinade
  comme du cru, elle ne teste pas l'acidité. `huitres-nature-citron` : bivalve cru, norovirus,
  hépatite A, *Vibrio*. Proposé : une étape de sécurité, pas un retrait du catalogue.
- **Onze recettes à œuf cru ou peu cuit.** Le jaune coulant est un choix culinaire, pas un défaut.
  Proposé : **un tip sourcé ANSES** nommant les quatre populations concernées (« personnes âgées,
  personnes immunodéprimées, jeunes enfants, femmes enceintes »), plutôt que onze phrases recopiées.

### ⚠️ La leçon de méthode, à ne pas repayer

**Deux inventaires automatiques successifs ont tous deux conclu « inventaire complet ».** Le premier
avait lu 40 recettes sur 68 ; le second travaillait sur une liste de `food_id` amputée de **sept
entrées** (`calamar`, `crabe`, `langoustine`, `poulpe`, `anchois_huile`, `raie`, `sole`). Le périmètre
réel, obtenu en repartant du champ `groupe` de `foods.yaml`, est de **26 `food_id` et 75 recettes**.
Sans cette reprise, le crabe, le poulpe, la sole, la raie et les langoustines n'auraient jamais été
examinés — et trois des neuf corrections n'auraient pas eu lieu.
**Toujours dériver le périmètre de la donnée, jamais d'une liste recopiée par un intermédiaire.**
C'est la même dette que celle des tests de gabarit (`FICHE_REPRISE.md`, Méthode).

---

## 6. Ce qui est écarté, et pourquoi

| Écarté | Motif |
|---|---|
| Scrap de blogs et de sites de recettes | §8.7 ARCHITECTURE (droit d'auteur, droit *sui generis* des bases UE, CGU), et refus assumé de prendre le travail d'autrui parce que la loi ne l'interdit pas |
| API payantes (Spoonacular, Edamam…) | Redistribution interdite et backend requis — incompatible avec « aucune donnée ne quitte l'appareil ». Déjà interdites en §8.7 |
| Importer les 603 CC0 en bloc | 150 à 300 h de normalisation (§4). Le volume n'est pas le besoin |
| Sourcer les 241 recettes existantes après coup | Fabriquerait une provenance (§1) |
| Datasets de recherche (Recipe1M+, RecipeNLG, Food.com) | ⛔ **VÉRIFIÉ le 2026-08-02 — scraping avéré, écrit dans leurs propres publications.** Recipe1M+ : « from over two dozen popular cooking websites » ; RecipeNLG : extension du précédent, « cookbooks, blogs, and recipe websites » ; Food.com : « 270K recipes scraped from Food.com ». Cette ligne disait « NON VÉRIFIÉ » : c'est tranché, définitivement |
| Recettes d'organismes publics sous droits réservés ou NC | ⛔ Voir §3.5 — mangerbouger (~2 000 recettes), agriculture.gouv.fr, MAPAQ, NHS, Heart Foundation. La gratuité de l'application n'y change rien : aucun droit de redistribution n'est concédé |
| USDA MyPlate | ⛔ Voir §3.2 — le site officiel a fermé le 2026-01-07 et le « miroir » n'est pas institutionnel |

---

## 7. Ce qu'il reste à faire

1. ~~**Ajouter la provenance au schéma**~~ — **FAIT le 2026-08-02** (§5).
2. ~~**Vérifier les cuissons à risque**~~ — **FAIT.** Viandes et volailles : 10 recettes (§5 bis).
   Poissons, œufs et coquillages : **75 recettes examinées, 12 corrigées** (§5 quater).
   ⚠️ **Trois choses en restent dehors, et c'est documenté en §5 quater** : les céphalopodes
   (`calamar`, `poulpe`) qu'aucune source lue ne couvre ; le critère de cuisson de l'œuf, qu'aucune
   autorité ne donne ; et deux arbitrages en attente — les trois préparations crues et le tip
   « œufs peu cuits ».
2 bis. **Étendre le lot classiques** (§5 ter) — **4 recettes vérifiées** (blanquette, navarin,
   carottes Vichy, veau Marengo). ⚠️ Le second passage a montré que le vivier est bien plus étroit
   qu'espéré : **1 succès sur 5 tentatives**. Avant d'ouvrir un nouveau lot, faire un inventaire
   sur le texte local (grep, gratuit) plutôt que de tenter recette par recette.
2 ter. **Alternatives par substitution** (décision utilisateur du 2026-08-02, NON COMMENCÉE) — à
   partir des classiques vérifiés, décliner des variantes à un ou deux ingrédients près (condiment,
   aromate, garniture). ⚠️ La table `substitution` est vide par décision 27, et `suggestSubstitutions`
   n'est pas câblée : à trancher d'abord — variantes écrites comme des recettes à part entière, ou
   couples de substitution portés par le moteur ? Ce n'est pas la même conception.
2 quater. ~~**Donner une origine à toute recette**~~ — **décision utilisateur du 2026-08-02, en
   cours.** Champ `origine` **obligatoire**, vocabulaire fermé de trois valeurs : `maison` (le texte
   a été écrit pour cette application — les 241 actuelles), `domaine_public`, `libre`. Le build
   refuse une recette sans, refuse une `origine: maison` portant une `provenance`, et refuse une
   `origine: libre` sans `provenance`.
   ⚠️ **Ce champ ne demande AUCUNE recherche de source** — c'est ce qui permet de couvrir 241/241
   sans rien fabriquer. Il ne remplace pas les sources, il dit ce qu'elles ne disent pas.
   ⚠️ **Défaut corrigé au passage** : l'écran n'affichait la mention d'origine que si la recette
   n'avait AUCUNE source. Vérifier une recette effaçait donc la seule phrase qui disait d'où venait
   son texte — sur les 14 recettes sourcées, un lecteur pouvait croire que la blanquette *venait*
   d'Escoffier, alors qu'elle y a seulement été confrontée. L'origine s'affiche désormais toujours.
   ⚠️ **Garde-fou ajouté au build** : l'`url` d'une source doit appartenir à une liste blanche de
   domaines institutionnels ou libres. L'interdiction du scrap de blogs (§6) n'était qu'une phrase
   dans ce document ; elle est maintenant mécanique.
3. **Écrire à cuisine-libre.org** pour cibler les recettes réutilisables, et leur signaler l'écart du
   NC (§3.1). ⚠️ **Le périmètre a changé le 2026-08-02** : le CC BY-SA étant accepté, la demande ne
   porte plus sur les seules 603 CC0/DP mais sur les ~3 800 recettes du site.
3 bis. **Écrire à Santé publique France** pour les ~2 000 recettes de mangerbouger (§3.5). Sans
   réponse favorable, elles restent inutilisables — ne pas les intégrer « en attendant ».
4. **Calibrer l'import** à 30-50 recettes, choisies pour ce que le catalogue n'a pas.
   ⚠️ **Le volume n'a jamais été le facteur limitant.** À 15-30 min de normalisation par recette
   (§4), même les 603 CC0 représentaient déjà douze fois la cible. Élargir le gisement sert à
   **mieux choisir**, jamais à couvrir davantage.
5. **Cuisiner réellement des recettes** et renseigner `teste_le`. C'est le seul point que ni une
   source ni un test ne peuvent remplacer — et le seul qui réponde vraiment à « ces quantités
   sont-elles justes ».

⚠️ **Le lot pilote a vérifié 10 recettes sur 241.** Afficher des sources sur ces dix pendant que les
231 autres portent « non encore testée » est une transparence, pas une garantie. Ne pas en conclure
que le catalogue est vérifié.
