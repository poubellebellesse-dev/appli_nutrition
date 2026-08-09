# Récit de session — 2026-08-08 → 08-09 · « le libellé dit en quoi la chair se compte »

> **Instantané daté. Ne jamais réécrire, ne jamais citer comme état courant.**
> L'état vit dans [../ETAT.md](../ETAT.md) ; les règles durables dans
> [../reference/PIEGES.md](../reference/PIEGES.md) §« un nom de portion est un nom, un participe
> passé, et une mesure ».
>
> ⚠️ **Une session parallèle écrivait dans le même dépôt pendant toute la durée de celle-ci**
> (lot « sauces », `app/src/ui/screens/*`, `parcours.ts`, `editeur-recette.tsx`,
> `cuisine-session*`). Rien de ce qui suit ne raconte leur travail — voir
> [RECAP_SESSION_2026-08-09_sauces.md](./RECAP_SESSION_2026-08-09_sauces.md).

---

## 1. Ce qui a été livré

Suite directe du lot « la quantité est DANS la phrase » du 2026-08-08. Il restait un gisement de
**17 étapes** que rien ne chiffrait, toutes du même moule :

```
Poser les filets dans un plat huilé.        ← aucun lien : « filet » n'est pas « églefin »
Napper les pavés de ce mélange.             ← aucun lien : « pavé » n'est pas « saumon »
```

**La règle qui les ouvre vient de l'utilisateur**, en une phrase : *« si la phrase c'est "filets
de …", le nombre se met devant le filet »*. Autrement dit **le libellé de l'ingrédient déclare
l'unité de compte de cette recette-là**. `unite_affichage: "4 filets"` sur l'églefin ne dit pas
seulement comment afficher une quantité : il dit **qu'ici, cette chair se compte en filets**.

Deux modifications symétriques, une de chaque côté de la chaîne :

| Fichier | Rôle | Ce qui est ajouté |
|---|---|---|
| `catalog/lien-etape-ingredient.mjs` | dérivation au build | `portionDuLibelle` / `portionEmployee` — le mot de portion vaut nom d'aliment |
| `app/src/ui/texte-etape.ts` | injection au rendu | le mot de portion est une forme cherchable, essayée **en dernier** |

C'est le **même mouvement que `HYPERONYMES`** (« les fruits » → les fruits *de cette recette*), à
ceci près que la source n'est pas le `groupe` de l'aliment mais **la ligne d'ingrédient**. Le
catalogue portait déjà l'information ; personne ne la lisait.

**Mesures, diffées ligne à ligne et non en totaux :**

```
liens au build ........... 2 795 → 2 809      (+17 / −3)
gestes qui affichent un nombre .. 1 097 → 1 111   (+14, plus 11 phrases réécrites)
gestes chiffrables qui affichent un nombre .. 1 088 / 1 249  (87,1 %)
étapes à réécrire à la main ..... 17 → 1
```

Les **3 liens perdus** sont un gain : un héritage **faux** sur `pain_perdu #2` (œuf + lait + sucre
attrapés par le pronom) remplacé par le lien direct et juste vers `pain_mie`.

**4 recettes YAML touchées, et aucun nombre écrit dans aucune** — la contrainte qui commande tout ce
chantier depuis le début : un nombre dans le catalogue serait figé et cesserait de suivre le
sélecteur de portions.

- `sardines-marinees-citron.yaml`, `soupe-poisson-fenouil.yaml` — réécritures **dictées par
  l'utilisateur** ;
- `pain-perdu.yaml`, `chocolat-chaud-avoine-tartine.yaml` — **accords cassés par le lot lui-même** :
  « chaque tranche … sans **la** laisser » devient « les 8 tranches … sans **la** laisser ». Le
  pronom qui suit une quantité injectée doit s'accorder au pluriel, et c'est le YAML qui le porte.

---

## 2. Ce que la mesure a démenti — la partie qui ne se reconstitue pas

**(a) « Il manque 17 liens » était faux.** Le chantier était présenté comme un manque de donnée :
17 étapes à réécrire à la main. Le relevé dit **14 des 17 portaient déjà leur nombre**, dans le
libellé, depuis toujours. Ce n'était pas une donnée absente, **c'était un mot que le code ne savait
pas lire**. ▶ Avant de chiffrer une corvée de saisie, vérifier que la donnée n'est pas déjà là sous
un autre nom.

**(b) Le défaut le plus cher n'était pas un lien manquant, c'était un nombre FAUX.**
`endives_jambon_gratin #3` — « rouler chacune dans **une tranche** de jambon » — est devenu « dans
**8 tranches** de jambon ». Huit fois la vérité, dans une phrase parfaitement lisible.
⚠️ **Aucun test ne le voyait, et le compte de liens MONTAIT.** Il a été trouvé par le diff du rendu
ligne à ligne. Même origine pour `salade_poulet_parmesan #5`, « dresser le poulet **tranché** » — un
participe passé qui se normalise en `tranche`.

**(c) Le premier garde-fou était juste sur mes exemples et faux sur ceux de l'utilisateur.** Il
refusait toute portion suivie d'un complément (« une tranche **de jambon** »). Passés au moteur, les
16 textes que l'utilisateur avait rédigés donnaient **8 bons, 6 muets, 1 doublé** : « les pavés **de
saumon** » tombait sous la même règle. Les deux phrases ne sont pas la même :

- « une tranche **de jambon** » — le libellé « 8 tranches » est celui du **pain**. Le mot compte un
  **autre** aliment : se taire.
- « les pavés **de saumon** » — le complément nomme **le même** aliment. La phrase se répète, elle
  ne compte rien d'autre : chiffrer.

Le test porte donc sur « le complément nomme-t-il un **autre** ingrédient », pas sur la présence
d'un « de ». ▶ **16/16 après correction.**

**(d) Mettre la portion dans le vocabulaire général a fait rougir deux tests existants.** Première
implémentation : ajouter le mot de portion aux formes de l'aliment, dans `formesEnMots`. « Ajouter
1 filet **d'huile** » a perdu son complément — parce que le libellé d'une huile **est** « 1 filet »,
si bien que `libelleNommeLAliment` répondait vrai. ⚠️ **Le même mot est un nom d'unité pour la chair
et une mesure pour le liquide.** → le mot de portion ne vaut nommage **que s'il est la forme qui a
effectivement été trouvée dans la phrase** (drapeau `estPortion`, porté par l'occurrence).

---

## 3. La leçon

**Un mot de portion est trois mots à la fois** : un **nom** (« poser les filets »), un **participe
passé** (« le poulet tranché »), une **mesure** (« un filet d'huile »). Les trois se normalisent en
la même chaîne. Chacun a demandé son propre garde-fou, et **aucun des trois n'a été trouvé par un
test** : deux par le diff du rendu, un par la relecture humaine de l'utilisateur.

**Corollaire de méthode, qui vaut au-delà de ce lot :** un lot de langue se mesure **ligne à ligne
sur le rendu**, jamais en totaux. Les deux défauts les plus chers ici — le nombre multiplié par 8 et
le participe passé — faisaient **monter** le compte de liens. Un total en hausse les aurait
présentés comme un succès.

---

## 4. Les garanties, et pourquoi elles ont cette forme

| Garde | Ce qu'il refuse | Pourquoi |
|---|---|---|
| déterminant devant | « le poulet **tranché** » | une portion **se compte**, donc porte un déterminant |
| complément qui nomme un **autre** ingrédient | « une tranche **de jambon** » | le mot compte l'autre aliment, pas le sien |
| singulier indéfini | « dans **une** tranche » | « une » compte une unité ; « les » et « chaque » désignent le lot |

⚠️ **Le verdict rendu est `tete`, et non un cinquième verdict.** C'était le choix à faire : les
verdicts existants portent déjà toute la mécanique d'**ambiguïté** (deux chairs en filets dans la
même recette ⇒ les deux se taisent). Un verdict neuf aurait demandé de la réécrire.

⚠️ **Une portion n'avale pas son propre complément.** « poser les pavés de saumon » rend « poser
**4 pavés de saumon** », pas « poser **4 pavés** » : l'extension de l'occurrence s'arrête quand le
complément nomme l'aliment lui-même.

---

## 5. Mes erreurs

- **Une expression régulière détruite par le heredoc.** La classe de diacritiques combinants écrite
  dans un `cat <<EOF` est arrivée littérale dans le fichier ; toute la normalisation rendait `—`.
  `sed` et `node -e` ont échoué à la remplacer pour la même raison. → réécrire le fichier avec
  l'outil d'écriture, et `\p{Diacritic}/gu` plutôt qu'une classe explicite.
- **Deux garde-fous trop larges d'affilée**, corrigés chacun après mesure et non avant : refuser
  tout « de », puis refuser tout complément nommant un ingrédient. Les deux étaient justes sur mes
  exemples.
- **J'ai un instant compté un rouge qui n'était pas le mien.** `parcours.test.tsx` (« composer ») est
  passé au rouge en cours de vérification : c'était la session parallèle qui déplaçait une question
  en amont de l'éditeur. Elle l'a fermé de son côté. ⚠️ **Sur un arbre écrit par deux sessions, un
  rouge s'attribue avant d'être réparé.**

### L'incident du `git stash`

À la rédaction de ce récit, **tout le lot a disparu de l'arbre d'un coup** : code, tests, les quatre
YAML, les trois documents. `git status` **propre**, et **rien dans `git log`**.

La cause n'est pas une erreur de manipulation de ce côté-ci : **une session voisine a remisé avant
de committer**, et `git stash` ne remise pas un lot — **il vide l'arbre entier**. 41 fichiers, dont
les 12 de cette piste.

⚠️ **Le symptôme est trompeur : on cherche d'abord son travail dans les commits, où il n'est pas.**
Le geste qui trouve la cause en une commande est **`git stash list` avant `git reflog`**.

▶ **Récupéré sans dépiler** : `git checkout stash@{0} -- <chemins>` rend fichier par fichier, dans
l'index et dans l'arbre, et **laisse la remise intacte** pour la session qui l'a posée. ⛔ **Un
`git stash pop` aurait été le mauvais geste** — il se dépile en bloc, sur un arbre qui a reçu deux
commits entre-temps. Consigné dans `PIEGES.md`.

⚠️ **Conséquence pour la session voisine, à ne pas lui cacher** : les fichiers récupérés ici sont
maintenant commités. Sa remise contient toujours SA version des mêmes documents — son `stash pop`
rendra des conflits sur `ETAT.md`, `FICHE_REPRISE.md` et `PIEGES.md`. Ce sont des conflits de texte,
pas une perte : les deux versions existent.

---

## 6. Ce qui reste ouvert à la clôture

1. ⚠️ **14 textes rédigés par l'utilisateur ne sont PAS appliqués aux YAML.** Ils nomment le
   poisson là où l'automatique se contente de l'unité : « poser **4 filets de poissons** dessus »
   contre « poser **4 filets** dessus ». **Les deux fonctionnent avec le code tel qu'il est** ; c'est
   un arbitrage de contenu, posé à l'utilisateur et non tranché ici.
2. ⚠️ **Une coquille dans un de ces textes** : `hareng_pommes_terre_tiedes #6` porte « les filets
   **des** hareng » (pour « de hareng »), ce qui rend « poser **les filets des 4 filets de hareng**
   dessus ». Une lettre.
3. **366 doublons d'affichage** — un même ingrédient chiffré dans plusieurs étapes de la même
   recette. Question jamais tranchée : ne chiffrer qu'à la première mention ?
4. **296 gestes n'affichent aucune quantité**, dont **95 n'ont aucun lien du tout**. Le plafond
   n'est pas le code : **368 liens portent un libellé sans nombre** (« au goût », « quelques
   brins »), irrécupérables par construction.
