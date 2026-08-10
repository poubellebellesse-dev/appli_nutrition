# Régime personnalisable — plan de montée

> **Ce document ne contient pas la spec.** Le cadre fait foi ailleurs : `ARCHITECTURE.md` §5.2 pour
> les couches d'exclusion, `reference/ENGINE_*.md` §6 pour la couche `regime`. Ici : dans quel ordre
> coder, ce qui est déjà construit, et à quoi on reconnaît que chaque lot est fini.
> Ouvert le 2026-08-10, en même temps que la **décision 67** (`ETAT.md` §4).

Demande de l'utilisateur, verbatim : un écran de réglages listant ce que le régime déclaré écarte,
avec **ajout ou retrait par groupe et par aliment**, plus des **sous-formes de végétarisme**.

---

## 1. Pourquoi ce n'est pas un confort — c'est la seule forme possible

`DIET_CHAIN` est un ordre **total** :

```
vegetalien ⊂ vegetarien ⊂ pescetarien ⊂ omnivore
```

et son propre commentaire pose la condition d'entrée : on n'y ajoute un régime que si l'on peut
affirmer que quiconque le déclare mange **réellement tout** ce qui le précède.

**Lacto-végétarien et ovo-végétarien échouent à ce test** : ni l'un ne contient l'autre. Les faire
entrer dans la chaîne la casserait — elle cesserait d'être un ordre. Un jeu de dérogations par
aliment les exprime sans y toucher.

⇒ Soit on renonce aux sous-formes, soit on fait ce qui suit. Il n'y a pas de troisième voie.

## 2. Ce qui est déjà là, et ce qui manque

| Brique | État | Preuve |
|---|---|---|
| `HardConstraints.excludedFoodIds` | ✅ déclaré | `engine/domain/request.ts:18` |
| Persistance du rejet personnel | ✅ table + magasin | `user-schema.ts` (`user_excluded_food`), `user-store.ts:244` |
| Couche `exclusions` | ✅ **branchée**, rejet dur, non critique | `engine/selection/exclusions.ts` |
| Ingrédients `optionnel: true` ignorés par le rejet | ✅ décidé et codé | même fichier, en-tête |
| Explication « vos exclusions » à l'écran | ✅ | `screens/recettes.tsx:81`, `detail-recette.tsx:947` |
| Les deux axes qui donnent les groupes | ✅ livrés le 2026-08-10 | `origine_animale` × `provenance_animale`, décision 64 |
| **Un écran qui ÉCRIVE `excludedFoodIds`** | ❌ **aucun** | aucun `.tsx` ne le mentionne en écriture |
| Direction « admettre » (assouplir le régime) | ❌ n'existe pas | — |

⚠️ **Le sens « retirer » est de la plomberie complète moins un écran.** Le vérifier a changé le
découpage : ce qui ressemblait à un chantier de moteur est d'abord un chantier d'interface.

### Les 7 groupes, mesurés sur le catalogue du 2026-08-10

167 aliments à origine animale, cascade `deriveDe` comprise, sur 451 :

| Groupe | Aliments | Axes |
|---|---|---|
| Lait et produits laitiers | 50 | `mammifere` + `production` |
| Œufs | 7 | `volaille` + `production` |
| Miel | 1 | `insecte` — provenance non lue |
| Viande de mammifère | 39 | `mammifere` + `corps` |
| Volaille | 13 | `volaille` + `corps` |
| Poisson | 43 | `poisson` — provenance non lue |
| Fruits de mer | 14 | `fruit_de_mer` — provenance non lue |

⚠️ **La provenance n'est lue que pour `mammifere` et `volaille`** — c'est la seule branche où elle
discrimine, exactement comme dans `regimeExigePar`. Des œufs de lompe restent du *poisson* pour qui
choisit ce qu'il mange. ⚠️ **L'ordre ci-dessus est celui du code, pas celui des effectifs** : ce que
l'animal produit d'abord, l'animal ensuite. Trier par compte ferait bouger l'écran du lot B à chaque
lot de contenu, sur des positions que l'utilisateur aura mémorisées. Verrouillé par test.

⚠️ **C'est ce chiffre qui rend l'écran faisable.** 167 cases à cocher sur un téléphone est
inutilisable ; **7 groupes est un écran** — et ce sont les mots que les gens emploient déjà pour
décrire ce qu'ils mangent. Les groupes ne sont pas inventés pour l'occasion : ils tombent des deux
axes livrés par la décision 64.

---

## 3. Les lots

### Lot A — les 7 groupes, fonction pure ✅ **LIVRÉ le 2026-08-10 (`9d4f691`)**

`engine/domain/groupes-animaux.ts` — `groupeAnimalDe` et `groupesAnimaux`, +29 tests. Les 7 comptes
tombent sur le relevé, total 167/451. ⚠️ **Deux dettes écrites par le lot, aucune garde ne les
signalera** : (a) `insecte → miel` nomme le seul membre actuel — une farine de grillon en `corps`
rendrait le libellé faux et obligerait à scinder le groupe ; (b) **aucune cascade `deriveDe` du côté
carné n'existe dans le catalogue** — les 38 dérivés mènent tous à `lait_entier`, `bouillon_boeuf` et
consorts déclarent leur propre origine. La branche carnée de la remontée n'est donc couverte que par
des fixtures. Trou de donnée, pas trou de test ; il se fermera au premier dérivé carné ajouté.

*Énoncé d'origine, conservé :*

Une fonction dans `engine/` : catalogue → les 7 groupes et les aliments de chacun, cascade comprise.
TypeScript pur, entrées objets → sorties objets, testable sans écran ni base.

**Pourquoi un lot à part** : la correspondance « `mammifere` + `production` → *lait et produits
laitiers* » ne doit être écrite qu'à **un seul endroit**. Posée dans un composant React, elle sera
recopiée au deuxième écran qui en a besoin, et les deux copies divergeront.

**Fini quand** : la fonction rend les 7 groupes avec les comptes ci-dessus sur le catalogue réel, et
un test le vérifie contre `catalog.db` — pas contre une fixture qui redirait la même chose.

### Lot B — l'écran de retrait, sur la plomberie existante ⭐

Les 7 groupes, leur compte, dépliables jusqu'à l'aliment. Cocher écrit `excludedFoodIds` par le
magasin existant.

**Aucun changement de moteur, aucun changement de domaine, aucune migration.** Et c'est le lot qui
livre l'essentiel :

- **Les sous-formes restrictives existent immédiatement** : « végétarien » + retirer le groupe
  *œufs* = lacto-végétarien ; retirer *laitiers* = ovo-végétarien. Sans une ligne de moteur.
- **La question de la présure disparaît sans qu'on ait à la trancher** : le végétarien qui refuse le
  roquefort le retire lui-même. L'appli informe, elle ne décide pas — principe 6.
- L'explication est déjà branchée : un plat écarté dira « vos exclusions », pas un mystère.

**Fini quand** : un plat contenant un aliment coché disparaît des propositions ET l'écran
« pourquoi pas ce plat » l'attribue aux exclusions, pas au régime.

### Lot C — le garde-fou de vide, et les présélections nommées ✅ **LIVRÉ le 2026-08-10 (`eacb065`)**

1. **Le compteur.** Un compte **par créneau** pendant que l'utilisateur coche — jamais un total
   global — et un avertissement **avant** que le planning ne se vide.
   ⚠️ **Ce n'est pas une précaution théorique** : le banc a mesuré « végétalien + sans gluten » à
   **marge zéro** — 28 plats utilisables pour 28 créneaux, une seule contrainte de plus vidait un
   créneau. Un utilisateur qui coche librement recrée exactement cette situation. Un total global
   serait resté vert pendant ce temps : c'est pourquoi le compte est **par créneau**.
   ⚠️ **Deux seuils, et le mot « infaisable » est plus fort que le fait.** À **0 plat**,
   `suggestMeals` lève et le créneau ne peut réellement pas être rempli. **En dessous d'une
   semaine**, `planWeek` ne répète pas — `pickForSlot` écarte tout plat déjà placé dans ses deux
   passes et rend `null` : les jours en trop ressortent **vides**, pas répétitifs. « Répétitif »
   serait faux, « impossible » aussi.
2. **Les présélections** — « lacto-végétarien », « ovo-végétarien », « sans fruits de mer » — qui ne
   sont rien d'autre que des jeux de cases pré-remplis. Nommer, pas coder.
   ⚠️ **Corrigé le 2026-08-10 (lot C) : pas de bouton « ovo-lacto-végétarien ».** Une présélection
   n'est offerte que sous le régime qui la rend sensée, et sous `vegetarien` l'ovo-lacto est l'état
   **par défaut** — le bouton ne cocherait rien. Une présélection **ajoute** des cases, elle n'en
   décoche jamais : même polarité que le reste du chantier, l'erreur qui retire un aliment de trop
   se voit et se répare, celle qui en réadmet un en silence ne se voit pas.

#### Lot C-bis — la correction demandée n'était pas un défaut ⛔ **NON APPLIQUÉE, ET C'EST LA CONCLUSION**

Le lot C-bis devait fermer un défaut supposé : `platsParCreneau` compte des recettes que
`pickForSlot` refuse — les `entree`, `accompagnement`, `fromage` et `dessert` au déjeuner et au
dîner, écartées par `peutRemplirSeul`. La conclusion annoncée était un **retournement d'état** : un
créneau où il ne reste que des entrées se lirait « il en reste 5 » (`'court'`) pendant que
`planWeek` laisserait **tous** ces dîners vides.

⛔ **Le code dit l'inverse, et il fait foi.** `pickForSlot` a **deux passes** : la première exige un
plat, **la seconde repose la question sans cette exigence**. Le filtre est une *préférence*, pas une
exigence — c'est écrit dans son commentaire, et la version dure a été annulée le 2026-08-03 après
avoir fait retomber le végétalien 14 j de 42/42 créneaux remplis à 32/42.

**MESURÉ le 2026-08-10** — 4 recettes partielles (entrée, accompagnement, fromage, dessert), 7 dîners :

| | compte | état | message | ce que fait le moteur |
|---|---|---|---|---|
| tel quel | 4 | `'court'` | « les jours en trop resteront vides » | **4 remplis, 3 vides** ✅ |
| avec le filtre | 0 | `'vide'` | « il ne pourra pas être proposé » | ❌ faux — et `suggestMeals` ne lève pas |

Appliquer le filtre aurait échangé un compte **exact** contre un message alarmiste **faux**. Le lot
livre donc l'inverse de ce qu'il demandait : le compte ne bouge pas, et un **test de non-régression**
verrouille la chose pour que l'idée ne revienne pas (`engine/domain/plats-par-creneau.test.ts`,
dernier cas, avec `planWeek` pour oracle). L'impasse est consignée dans `docs/reference/PIEGES.md`.

📌 **Reste ouvert, et non tranché seul** : un créneau rempli **uniquement par pis-aller** — des
entrées et des accompagnements posés faute de plat — est une information réelle que l'écran ne dit
pas. Ce serait un **quatrième état** de `EtatDuCreneau` avec son propre libellé, donc un choix de
produit ; il n'est pas fait ici.

### Lot D — la direction « admettre » *(le lot à soigner)*

Le végétalien qui fait une exception pour le miel. Nouveau champ de contraintes, nouvelle table,
second panneau de réglages.

⛔ **CE QUI ÉTAIT ÉCRIT ICI ÉTAIT FAUX, ET LE CORRIGER CHANGE LA RECOMMANDATION.** Cette section
disait : « ce lot rendrait `regimeExigeParIngredients` porteuse en production, alors qu'elle n'est
aujourd'hui qu'un contrôle ». **Elle l'est déjà.** `app/src/data/user-recipe.ts:150` l'appelle pour
**chaque recette composée par l'utilisateur**, et l'en-tête du fichier le déclare — « règle promue en
production pour ce fichier précisément » ; l'en-tête de la fonction le redit. Une recette utilisateur
n'a personne pour l'étiqueter : sans dérivation, un plat au poisson serait proposé à un végétarien.

⚠️ **CE QUI RESTE VRAI EST PLUS ÉTROIT, et c'est le vrai objet du lot.** La règle tourne aujourd'hui
sur une liste d'ingrédients **entière**. D la ferait tourner sur une liste **amputée** des aliments
admis. C'est un chemin de code que rien n'exécute, et que `tests/regime-coherence.test.ts` ne peut
pas couvrir : il n'existe aucune étiquette « végétalien sauf miel » à confronter.

▶ **Recommandation révisée le 2026-08-10 : rien ne bloque D techniquement.** L'argument d'attente
n'est plus la sûreté, c'est la **demande** — « je ne veux pas d'œufs » est courant, « je suis
végétalien mais je mange du miel » l'est beaucoup moins, et depuis le lot B l'appli couvre déjà la
quasi-totalité des sous-formes réelles par le sens restrictif. Se lancer parce que le besoin est
là, pas parce que le lot est au plan.

#### Les quatre propriétés de sûreté

`dietLayer` compare l'étiquette de la recette au régime demandé. D ajoute une **seconde chance** :
une recette refusée par l'étiquette est reprise si, une fois les aliments admis retirés de ses
ingrédients, la règle rend un régime compatible.

**P1 — Aucune admission ⇒ chemin identique, à l'octet.** `admittedFoodIds` vide ⇒ `dietLayer`
n'appelle pas la règle. Zéro utilisateur existant ne change de comportement — c'est ce qui rend le
lot rejouable et tout défaut attribuable.

**P2 — Seconde chance uniquement, jamais un refus de plus.** Le recalcul ne peut qu'ADMETTRE ce que
l'étiquette écartait ; une recette acceptée par l'étiquette n'est jamais repassée à la règle. Un
défaut de la règle ne peut donc retirer aucun plat à personne.

**P3 — La règle ne sert que là où elle est D'ACCORD avec l'étiquette.** ⭐ *Le cœur du lot.* Avant
d'admettre, on vérifie que `regimeExigeParIngredients(TOUS les ingrédients)` **égale** l'étiquette
écrite à la main. Si les deux divergent sur cette recette, la règle n'est pas utilisée et la recette
reste écartée. **La garantie à l'exécution devient exactement celle que le test de cohérence
apporte** : la règle est porteuse là où elle est prouvée, et échoue *fermée* ailleurs. C'est ce qui
désamorce le seul risque réel du lot.

**P4 — L'admission ne touche QUE la couche `regime`.** Jamais lue par la couche allergènes ni par
`exclusions` : un `miel` admis reste écarté s'il est déclaré allergène, ou s'il a été coché au lot B.
**La garantie vient de la forme** — `admittedFoodIds` n'est passé qu'à `dietLayer` — pas d'une
vérification qu'on pourrait oublier. C'est le garde-fou 1 rendu structurel.

⚠️ **Sur TOUS les ingrédients, sans filtrer les `optionnel`.** `user-recipe.ts` les filtre, la
cohérence non — et c'est la cohérence qui fait foi ici, sinon P3 échouerait à tort sur toute recette
portant un ingrédient animal optionnel. Deux questions différentes : « quel régime cette recette
exige-t-elle » ≠ « cet utilisateur peut-il la manger ».

⚠️ **L'admission est LITTÉRALE, sans cascade `deriveDe`** : admettre `lait_entier` n'admet pas le
beurre. On retire l'aliment de la liste d'ingrédients, on ne neutralise pas son origine dans la
carte des aliments — ce qui propagerait par la cascade et surprendrait.

⚠️ **Uniquement quand le régime demandé est dans `DIET_CHAIN`.** `halal` et `sans_gluten` passent par
l'égalité stricte (`isDietCompatible`, cas 1) ; la règle ne les modélise pas et ne doit pas les
approcher.

#### Les sous-lots

**D1 — le moteur, sans écran ni base.** `admittedFoodIds` dans `HardConstraints` + P1 à P4 dans
`dietLayer`. ⚠️ **Contrairement à `requiredFoodIds` (acquis n° 2), sa place EST dans
`HardConstraints`** : une exception est un réglage durable qui doit valoir partout — suggestion,
plan, navigation. L'acquis 2 tenait `requiredFoodIds` dehors pour le rendre inexprimable dans un plan
de semaine ; ici c'est l'inverse qu'on veut, et ce contraste s'écrit dans le code sous peine de se
lire comme une entorse. **Fini quand** : P1 à P4 ont chacune leur test, dont P3 avec une recette dont
l'étiquette et la règle divergent volontairement — et elle reste écartée.

**D2 — la persistance.** Table `user_admitted_food`, migration 16, symétrique de
`user_excluded_food`, lue par `readConstraints` (qui prend déjà `foods` depuis le lot B — pas de
nouvelle rupture de signature). **Fini quand** : un aliment admis survit au rechargement, et un
aliment à la fois admis et exclu reste **exclu**, par test explicite.

**D3 — le panneau « Mes exceptions ».** ⛔ **Un SECOND panneau, séparé de « Aliments que je ne veux
pas »** — décision utilisateur du 2026-08-10. Le garde-fou 1 vise exactement ce montage : le même
écran qui laisse réadmettre le miel ne doit jamais laisser réadmettre l'arachide, et deux écrans
rendent la confusion structurellement plus dure. Il ne liste que les aliments que le régime déclaré
écarte — donc rien pour un omnivore, et le panneau ne s'affiche pas. Réutilise `groupesAnimaux`
(lot A). **Fini quand** : cocher *Miel* en végétalien fait réapparaître un plat au miel, et
« pourquoi ce plat » ne l'attribue plus au régime.

**D4 — le compteur et le document.** Le compteur du lot C lit `browseRecipes`, donc il suit
automatiquement — ⚠️ **mais ce n'est pas branché tant qu'un test ne le montre pas** (« un champ
déclaré n'est pas un champ branché », trois occurrences payées).

📌 **Ouvert, à poser à D3 quand l'écran existera** : faut-il signaler qu'une admission rend le régime
déclaré trompeur — « végétalien » affiché alors que la personne mange du miel ? Choix de produit,
pas correction.

### Lot E — le fait « présure » *(contenu, indépendant, optionnel)*

Déclarer `presure: animale | microbienne` sur les fromages, pour que « fromages à présure animale »
devienne **une** case au lieu d'un aliment à la fois.

**Aucune dépendance** : B fonctionne sans lui — l'utilisateur retire les fromages un par un, il lui
faut seulement savoir lesquels. ⚠️ **À vérifier avant de coder** : l'affirmation « Roquefort AOP et
Ossau-Iraty AOP imposent une présure animale à leur cahier des charges » est **plausible et non
vérifiée**. Le cas certain est le parmesan du pesto.

---

## 4. Ordre

```
A  →  B  →  C  ✅ livrés le 2026-08-10       D1 → D2 → D3 → D4        E : indépendant, optionnel
```

⚠️ **`D` n'est plus « après, et seulement si le besoin se confirme »** — la raison technique qui le
mettait en quarantaine était fausse (voir sa section). Il reste conditionné à la **demande**, pas au
risque. `E` ne bloque rien : sans lui, l'utilisateur retire les fromages un par un.

## 5. Les trois garde-fous, quel que soit le lot

1. ⛔ **Les allergènes ne passent JAMAIS par cet écran.** Un régime est une préférence, une allergie
   est un fait médical. Le même écran qui laisse réadmettre le miel ne doit jamais laisser
   réadmettre l'arachide. Deux écrans, deux vocabulaires.
2. ⛔ **La couche `regime` reste 🔒 critique et indésactivable.** Ce qui devient configurable, c'est
   **ce qu'elle lit** — la définition personnelle du régime — jamais le filtre. La distinction a
   l'air théorique ; c'est elle qui décide si le chantier respecte l'architecture ou la casse.
3. ⛔ **Un écran qui peut vider le planning doit prévenir avant, pas après.** Voir lot C.
