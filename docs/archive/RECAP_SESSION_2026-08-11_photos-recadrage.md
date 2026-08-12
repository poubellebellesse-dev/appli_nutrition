# Récap — 2026-08-11, lane PHOTOS : le recadrage carré, et un écran vide qui mentait

> **Instantané daté. Ne pas s'en servir pour établir l'état courant** — il est dans
> [../ETAT.md](../ETAT.md) §8 et [../FICHE_REPRISE.md](../FICHE_REPRISE.md).
> **Piste parallèle** : le même 2026-08-11 a porté la session **clips de gestes**
> ([RECAP_SESSION_2026-08-11_clips-gestes.md](./RECAP_SESSION_2026-08-11_clips-gestes.md)) et deux
> lanes de contenu (régime, réservation de matériel). **Aucune ne raconte le travail des autres.**
> Suite directe de [RECAP_SESSION_2026-08-09_photos-fin-du-tri.md](./RECAP_SESSION_2026-08-09_photos-fin-du-tri.md).

## 0. Ce que cette session a changé dans le dépôt : **rien, sauf ces documents**

Tout le travail livré est dans `atelier/photos/`, **gitignoré**. Aucun fichier de `app/`, de
`catalog/` ni de `engine/` n'a été touché. Les quatre commandes n'ont donc pas été rejouées et
**le relevé du 2026-08-10 reste celui qui fait foi** — 1 953 passed / 0 failed, typecheck propre,
`vite build` ✓, `plan-stress` 20/20. ⚠️ **Ce n'est pas une dispense** : le jour où l'import lira le
cadre (§5), il écrira dans `catalog/recipes/*.yaml` et les quatre redeviennent dues.

## 1. Ce qui a été livré

| Livrable | Où | État |
|---|---|---|
| **Recadrage carré** — tracé à la souris/au doigt sur la photo | `atelier/photos/ui/index.html` | ✅ utilisé, 3 cadres posés |
| **Validation serveur du cadre** — `verifierCadre` | `atelier/photos/serveur.mjs` | ✅ 10 cas passés |
| **Relecture de l'index du bac** — `rafraichirBac` | `atelier/photos/serveur.mjs` | ✅ file 0 → 12 après correctif |
| **Nommage libre atteignable** — l'entrée libre passe en tête de liste | `atelier/photos/ui/index.html` | ✅ rejoué sur la vraie logique |
| **Lots 33 à 35** — 37 verdicts motivés, 2 propositions | `atelier/photos/etat/ma-passe.jsonl` | ✅ |
| **Mémoire : les pièges de requête** | `memory/pieges-de-requete-recolte-photos.md` | ✅ |

**Compteurs au 2026-08-11** — journal `ma-passe.jsonl` : **3 104 couples jugés** (2 950 `non`,
131 `oui`, 23 `doute`). Décisions humaines `decisions.json` : **254** (134 `oui` sur **129 recettes
distinctes**, 47 `retirer`, 35 `hors-catalogue`, 31 `mauvais-plat`, 6 `non`, 1 `reserve`).
Application : **116 `image_path` posés sur 330**, 116 fichiers AVIF, 4,4 Mo.

## 2. Ce que la mesure a démenti — la partie qui ne se reconstitue pas

**Cinq affirmations tombées dans la journée, dont trois étaient les miennes.**

### 2.1 « Il n'y a plus de photos à trier » — l'écran était vide, le bac ne l'était pas

L'écran de relecture ne proposait plus rien. La lecture évidente — *le tri est fini* — était fausse.
**Le serveur figeait son index du bac au démarrage** (`recettes`, `images`, `orphelines` construits
une fois, en `const`) et ne relisait ensuite que le journal. Il tournait depuis 16 h 51 la veille ;
tout ce que la passe avait produit depuis lui était invisible.

⛔ **Le diagnostic n'est pas venu du code mais de l'instrument.** Interroger le serveur vivant a
rendu `recettes: 0` **contre** `maPasse: 3088` — deux nombres du même processus, l'un vide et
l'autre plein. C'est ce qui a isolé la panne sur l'index et non sur le journal ; une relecture de
code seule aurait aussi bien accusé le journal. **Un écran vide n'est pas une donnée, c'est un
symptôme à deux causes au moins.**

Correctif : `rafraichirBac()`, gardé par le `mtime` de `reconnaissance.json`, avec `try/catch` qui
**conserve l'index précédent** si le fichier est illisible — un JSON à moitié écrit ne doit pas
vider la file. Vérifié par redémarrage : la file passe de 0 à 12 recettes / 12 images.

### 2.2 Mon propre compte : « 29 propositions non tranchées » valait **12**

Corrigé dans la foulée, avant d'ouvrir une chasse au second défaut qui n'existait pas. **17 des 29
portaient sur des images que l'humain avait déjà refusées** — et `ma-passe.mjs:147` met fin à une
proposition dès qu'une décision humaine existe sur l'image, **quelle qu'elle soit**. Le nombre brut
comptait des propositions déjà mortes.

### 2.3 « La relecture est terminée sur 8778 » — la mesure a dit non

Annoncé par l'utilisateur, contredit par trois relevés concordants : `decisions.json` **non modifié**
depuis la veille 17 h 42, **même PID** de serveur, file toujours à 0. Rien n'avait été relu. Je l'ai
dit tel quel plutôt que d'accepter la prémisse — c'est ce qui a fait trouver le défaut de §2.1.
⚠️ **La leçon n'est pas « l'utilisateur s'est trompé »** : l'écran lui montrait un vide qu'il était
fondé à lire comme une fin de file. **L'instrument mentait aux deux bouts.**

### 2.4 Le fichier de plan partait d'une prémisse périmée

Il annonçait `catalog/import-photos.mjs` **à créer**. Le script **existe et a déjà tourné** (116
AVIF, 4,12 Mo à l'époque du relevé). Le lot « appliquer le cadre » est donc une **modification**, pas
une création — et son coût n'est pas celui qui était budgété.

### 2.5 Le vivier de repêchage : **un compte par mots-clés n'est pas une mesure**

L'objectif du recadrage était d'élargir la banque en repêchant des photos refusées sur le cadrage.
Combien ? La réponse dépend entièrement de la largeur du filtre appliqué aux motifs :

| Filtre sur le motif de refus | Images | Recettes |
|---|---|---|
| strict (`cadrage`, `recadr`, `hors-champ`, `bord gauche/droit…`, `marge`) | **39** | 33 |
| large (+ `décor`, `fond`, `arrière-plan`, `marque`, `logo`, `vertical`…) | **416** | 151 |

*(refus sur recettes non encore servies uniquement)*

⛔ **J'ai annoncé « 173 » en cours de session avec un filtre intermédiaire.** Les trois nombres sont
issus du même journal ; seul le regex change. **Aucun ne mesure le vivier** — un motif dit pourquoi
j'ai refusé, pas si un carré sauverait l'image. ⚠️ **Et le recadrage ne répare qu'un obstacle situé
AU BORD** : il ne change rien à un dressage de restaurant, à une espèce de poisson douteuse ou à un
plat qui n'est pas le nôtre. **Le vivier réel se compte en rouvrant les images, pas au `grep`.**

## 3. Les pièges de requête — pourquoi des dossiers entiers ne servent à rien

Consigné en mémoire (`pieges-de-requete-recolte-photos.md`) parce que c'est une règle de **récolte**,
pas de tri, et qu'elle resservira à chaque relance.

**Un mot-clé d'ingrédient est indexé sur le plat le plus photographié qui le contient — jamais le
nôtre.** Mesuré sur ~15 dossiers jetés en entier entre le 2026-08-09 et le 2026-08-11 :

| Dans la requête | Ce que la banque rend |
|---|---|
| sarrasin / *buckwheat* | nouilles **soba**, ou un tas de graines crues |
| sirop d'érable | **pancakes** arrosés de sirop — **3 dossiers tués** |
| noix de pécan | **cookies**, *pecan pie* |
| cacao | **tablettes**, fèves en sac |
| curcuma + lait de coco | ***golden milk*** |
| sauce cacahuète | **satay** thaï — la recette est un mijoté ouest-africain |
| « rôti » → *roasted* | **café torréfié** ; → *rot* : ruines |
| « chou blanc » → *cabbage white* | le **papillon** piéride |
| « fruits rouges » → *red berries* | **houx** (baies toxiques) |

▶ **Comment récolter** : ancrer sur la **forme du plat** (`red lentil patties`, `pan fried apple
slices`, `groundnut stew`, `roasted parsnip`) et reléguer l'ingrédient caractéristique au second
rang ou le retirer. Sur Commons, se méfier des légendes : le mot cherché peut désigner
l'**accompagnement** (une recherche « manioc » a rendu des criquets rôtis *« prêts à être consommés
avec du manioc »*).

⚠️ **Deux cécités de la passe nommée, revues ce jour** : elle compare des **listes d'ingrédients** et
ne voit ni la **cuisson** ni le **dressage**. Elle a répondu « correspond » sur un *Bon Bon Chicken*
(poulet froid effiloché) et sur trois *satays* pour une recette de ragoût. Les bons ingrédients dans
le mauvais plat.

▶ **Liste de re-récolte accumulée** (dossiers épuisés, zéro candidate retenue) :
`camembert-roti-romarin`, `lentilles-corail-coco-curcuma`, `porridge-quinoa-banane-cacao`,
`salsifis-panais-rotis-lentilles`, `soupe-courgettes-chevre`, `galettes-lentilles-corail-sarrasin`,
`pommes-poelees-pecan-erable`, `poulet-sauce-cacahuete`, `manioc-roti-paprika`,
`polenta-douce-erable-noix`, `creme-mascarpone-cacao`, `sauce-yaourt-citron-ciboulette`.
⚠️ **Et les recettes de SAUCE demandent une photo de saucière ou de casserole, pas un plat dressé** —
aucune requête de plat ne les servira.

## 4. Le recadrage : ce qui a été décidé, et où est le trou

**Format carré imposé** (choix utilisateur, contre « libre » et « 4:3 ») — une vignette de recette
est carrée partout dans le design ; un cadre libre aurait déplacé la décision de cadrage à
l'affichage, donc dans du code d'écran, hors de cette lane.

**Stockage : fractions + dimensions de la source.** `{x, y, w, h}` en fractions de 0 à 1, plus
`source: {l, h}` en pixels. ⛔ **Le carré se vérifie en PIXELS, jamais en fractions** : sur une photo
1280×960, un cadre « carré en fractions » est un rectangle à l'écran. `verifierCadre` recalcule
`w × source.l` contre `h × source.h` et tolère 1 px. Les fractions survivent à un changement de
résolution de la source, ce que des pixels bruts ne feraient pas.

**Ce que le serveur refuse** : cadre non carré, débordant de l'image (il ferait entrer du vide),
de surface nulle, hors bornes, dimensions de source absentes ou non numériques. **10 cas passés.**

⛔ **Le test n'a PAS pu être fait par requête HTTP** : un garde local a refusé la requête sortante
avec charge utile (`net.post`). Il n'a pas été contourné. ▶ **À la place, la fonction a été extraite
du texte réel de `serveur.mjs` puis exercée sur 10 cas** — la vérification suit donc le code si le
code change, ce qu'une copie recopiée à la main n'aurait pas fait.

### ⚠️ Le trou connu, non refermé : **la taille n'est pas validée**

Le serveur valide la **forme**, pas la **taille**. **Un carré de 26 px de côté a été accepté**
(`soupe-chou-vert-celeri/openverse_25`, 0,025 × 1024). Sans conséquence — la décision portée était
`retirer` — mais l'écran avertit sous 800 px et le serveur ne le fait pas. **À trancher quand
l'import lira le cadre** : refuser sous un plancher, ou agrandir et l'assumer.

### Le nommage libre, et pourquoi il était injoignable

Question de l'utilisateur : *pourquoi ne puis-je pas associer une photo à une recette absente du
catalogue ?* La fonction existait. `filtrer()` **ajoutait l'entrée libre APRÈS jusqu'à 40 résultats
de catalogue**, dans une boîte de 210 px, avec le viseur en position 0 : « sal » la plaçait en
32ᵉ position, « riz » en 24ᵉ, « poulet » en 12ᵉ — et Entrée choisissait toujours une recette du
catalogue. **Elle est désormais en tête**, le viseur restant sur la première correspondance de
catalogue quand il y en a une. ⚠️ **Ce n'était pas un manque de fonctionnalité, c'était un
ordre de liste** — et rien, ni au type ni au test, ne pouvait le signaler.

**35 décisions `hors-catalogue`** existent aujourd'hui : ce sont des photos de plats que le catalogue
ne contient pas. ⛔ **Les habiller en recettes laisserait la photothèque décider du contenu** — c'est
le constat du 2026-08-09 §4, toujours valable.

## 5. Ce qui n'est PAS fait, et dans quel ordre le faire

⛔ **L'ORDRE N'EST PAS INTERCHANGEABLE.**

1. **Brancher le cadre à l'import** — `catalog/import-photos.mjs` ne contient aujourd'hui **ni
   `cadre` ni `extract`** (vérifié au `grep`). Un `sharp.extract()` avant le redimensionnement.
2. **Puis seulement, relancer l'import** pour les **13 photos décidées et non importées**.
   ⛔ **Pas avant** : `hareng-pommes-terre-tiedes` est **à la fois** dans les 13 et la seule photo
   portant un cadre validé. L'importer maintenant graverait la version non recadrée, **et rien ne le
   signalerait**. Les 12 autres : `pudding-chia-mangue-coco`, `veloute-potimarron-pois-chiches-coco`,
   `smoothie-vert-kiwi-epinard`, `salade-pasteque-feta-menthe`, `smoothie-mangue-ananas`,
   `tartine-avocat-citron`, `pates-poitrine-creme`, `pommes-terre-four-romarin`,
   `porc-moutarde-champignons`, `porridge-quinoa-avoine-pomme`, `soupe-epinards-pommes-terre`,
   `soupe-pois-casses`.
3. **Le mode repêchage** — remettre en file les refus « de cadrage » avec mon motif affiché.
   Approuvé sur le principe, non construit. ⚠️ Son dimensionnement est en §2.5 : **il n'est pas
   connu**.
4. **La récolte**, seule chose qui servira les 201 recettes sans candidate retenue (§3).

⚠️ **`catalog/import-photos.mjs` écrit dans `catalog/recipes/*.yaml`, qui appartiennent à la lane
Référence** — substitution d'une seule ligne, par script, `git diff --stat` vérifié avant de
commiter. **Jamais à la main.**

▶ **Deux révisions parquées, toujours ouvertes** : `salade-poulet-parmesan/pixabay_09` et la
betterave du lot 23. **La passe n'a aucun chemin de révision** — le garde de `ma-passe.mjs` refuse de
rejuger un couple, et le contourner demande l'accord de l'utilisateur.

## 6. Sur la source : Flickr est déjà le premier fournisseur, sans être une porte d'entrée

Parti d'une URL Flickr proposée par l'utilisateur. **La photo était déjà dans le bac** —
`soupe-chou-vert-celeri/openverse_14.jpg` (ToastyKen, CC BY 2.0), déjà refusée par moi pour cette
recette. Ce qui a conduit à compter les provenances du bac :

```
7 945 lignes de crédit : pexels 4 264 · openverse 2 261 · pixabay 1 135 · commons 283
dont 2 173 URL pointant sur flickr.com — toutes arrivées PAR Openverse
```

⛔ **Ouvrir un accès Flickr direct n'apporterait donc pas de contenu neuf, seulement le contrôle de
la requête.** Vu la §3, le contrôle de la requête est justement ce qui manque — mais c'est un
arbitrage à poser comme tel, pas un gisement inexploré.

⚠️ **Point de contenu à ne pas perdre** : la description d'auteur de cette photo nomme un **bouillon
de poulet Swanson**, invisible à l'image. Sans effet sur le verdict — **mais l'appariement ne devra
jamais être étiqueté végétarien.**

## 7. Mes erreurs

1. **Trois nombres annoncés puis corrigés dans la même session** — 29 propositions (§2.2), 173
   images de vivier (§2.5), et une lecture d'écran vide prise pour une fin de tri (§2.1). Les trois
   partagent une cause : **un total brut lu sans le prédicat qui le qualifie**.
2. **La clé Pixabay voyage dans l'URL.** Elle n'est jamais imprimée, pas même dans un message
   d'erreur qui refléterait la requête — `pixabay()` n'imprime que `e.code`. Règle déjà codée,
   rappelée ici parce qu'elle est invisible à la relecture.
3. **Des notifications de tâche en arrière-plan à code 127** étaient la conséquence de mes propres
   `Stop-Process` sur le serveur de photos, pas des pannes à instruire. Le temps passé à les lire
   est du temps perdu.

## 8. Ce qui a été retiré des documents vivants ce jour

| Retiré de | Ce qui y était écrit | Pourquoi c'est faux |
|---|---|---|
| `FICHE_REPRISE.md` §1 | « La récolte de photos — **116 / 330** » | Vrai pour l'import, **muet sur les 13 décidées non importées** et sur les 201 recettes sans candidate retenue. Un seul nombre pour trois faits |
| `ETAT.md` §8, écran Détail | « il faudra décider quoi montrer pour les **220** recettes SANS photo » | Reste du palier à 88 photos sur 308. **214** |
| `ETAT.md` §8, tableau des quantités | « Photos de recette — **116 / 330** » | Même défaut que ci-dessus ; la requête SQL donnée ne mesure que les importées |
| plan de lane `L3` | « `catalog/import-photos.mjs`, **nouveau fichier** » | Le script existe et a tourné (§2.4) |
| `atelier/photos/REPRISE.md` | tout l'en-tête : « **308** recettes · **87** photos validées · **2 740** couples · **177** décisions » | Relevé du 2026-08-09 laissé en tête d'une page qui s'annonce comme l'état. Le catalogue est à **330**, le journal à **3 104**, les décisions à **254**. ⚠️ La puce « convertisseur PLUS NÉCESSAIRE » y était **déjà démentie sur place** (ligne 203) — elle n'a pas été retirée, conformément à la règle : on corrige, on n'efface pas |
