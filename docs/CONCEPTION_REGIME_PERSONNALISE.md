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

### Lot C — le garde-fou de vide, et les présélections nommées

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

### Lot D — la direction « admettre » *(le seul lot à risque)*

Le végétalien qui fait une exception pour le miel. Nouveau champ de contraintes, nouvelle table,
lecture par la couche `regime`.

⛔ **POURQUOI CE LOT EST À PART ET VIENT EN DERNIER.** La couche `regime` lit aujourd'hui
l'**étiquette écrite à la main** de chaque recette. Admettre le miel oblige à **recalculer**
l'exigence de chaque recette depuis ses ingrédients en ignorant les aliments admis. Cette règle
existe — `regimeExigeParIngredients` — et `tests/regime-coherence.test.ts` vérifie qu'elle est
d'accord avec les 330 étiquettes. Elle l'est.

Mais ce lot la rendrait **porteuse en production** pour ces utilisateurs, alors qu'elle n'est
aujourd'hui qu'un contrôle. Le jour où une étiquette et la règle divergeraient, ce sont eux qui le
paieraient — **sur la couche de sécurité**. Faisable, verrouillable par test, mais pas dans la
foulée d'un écran.

▶ **Recommandation : livrer A + B + C, s'en servir, et décider de D après.** La direction
« admettre » sert nettement moins de cas que la direction « retirer ».

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
A  →  B  →  C            D et E : après, et seulement si le besoin se confirme
```

## 5. Les trois garde-fous, quel que soit le lot

1. ⛔ **Les allergènes ne passent JAMAIS par cet écran.** Un régime est une préférence, une allergie
   est un fait médical. Le même écran qui laisse réadmettre le miel ne doit jamais laisser
   réadmettre l'arachide. Deux écrans, deux vocabulaires.
2. ⛔ **La couche `regime` reste 🔒 critique et indésactivable.** Ce qui devient configurable, c'est
   **ce qu'elle lit** — la définition personnelle du régime — jamais le filtre. La distinction a
   l'air théorique ; c'est elle qui décide si le chantier respecte l'architecture ou la casse.
3. ⛔ **Un écran qui peut vider le planning doit prévenir avant, pas après.** Voir lot C.
