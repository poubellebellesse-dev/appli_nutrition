# Retours du test utilisateur — plan de montée

> **Ce document ne contient pas la spec.** Le cadre fait foi ailleurs : `DESIGN.md` pour les écrans
> et les jetons visuels, `reference/ENGINE_4_selection_score.md` §6.5 pour la couche `craving`,
> `ETAT.md` §4 pour les arbitrages. Ici : ce que le test du 2026-08-21 a montré, dans quel ordre le
> réparer, et à quoi on reconnaît que chaque lot est fini.
> Ouvert le 2026-08-21, en réponse au premier essai complet sur téléphone.

Demande : l'application a été utilisée de bout en bout sur un téléphone, écran par écran. Une
trentaine d'observations en sont sorties. Elles ne parlent pas toutes de la même chose, et les
séparer est le premier travail.

---

## 1. La ligne commune — la donnée est juste, l'écran ment

Les observations se rangent en deux familles, et **une seule des deux est un défaut de moteur**.

**Aucune ne dit que le moteur se trompe.** Aucune ne dit qu'une recette est fausse, qu'un allergène
passe, qu'un régime fuit. Le catalogue, le solveur et les couches d'exclusion n'ont pas été mis en
défaut une seule fois.

Ce qui a été mis en défaut, c'est **ce que l'écran donne à voir de ce que la donnée contient** :

- une pastille « Chaud » qui remonte des salades ;
- treize ustensiles déclarés dont aucun n'a l'air coché ;
- un compteur qui affiche « 1 kg » là où rien ne le justifie ;
- des flèches qui changent de place selon la longueur du texte au-dessus.

⛔ **C'est la signature déjà connue du projet, dans sa forme la plus coûteuse.** `PIEGES.md` la
nomme : « un champ déclaré n'est pas un champ branché », trois occurrences payées. Ici la variante
est plus discrète encore — **le champ est rempli, lu, ET affiché ; c'est le SENS de l'affichage qui
est faux.** Rien ne plante, aucun test ne rougit, et le défaut ne se voit qu'avec un doigt sur un
écran.

⚠️ **Le sceau du lot 65b l'a laissé passer, et il faut le dire.** `tests/scelles/65b-ecran.test.tsx`
est vert. Il vérifie que cliquer un ustensile ÉCRIT dans `user.db`, en relisant par un autre chemin
— exactement la bonne discipline. Il ne vérifie pas, et **ne peut pas vérifier en jsdom**, que la
case cochée se DISTINGUE de la case décochée à l'œil. L'examen était juste ; il ne portait pas sur
la matière que le test utilisateur a trouvée fausse.

---

## 2. Ce qui est mesuré, et ce qui ne l'est pas

### L'axe chaud/froid est branché à l'envers — mesuré, pas déduit

Trois sources indépendantes, dans le dépôt, disent la même convention :

| Source | Ce qu'elle dit |
|---|---|
| `engine/domain/catalog.ts:352-357` | `chaudFroid: number // -1 (froid) … +1 (chaud)` |
| `cli/try-engine.ts:89-90` | `chaud: { axis: 'chaudFroid', value: 1 }` · `froid: { … value: -1 }` |
| `catalog.db`, 330 recettes | le minimum **−1** est *Glace de banane minute* ; les 76 recettes à **+0,9** sont *Blanquette de veau*, *Caldo verde*, *Camembert rôti*… |
| `ui/screens/editeur-recette.tsx:85` | `{ cle: 'chaudFroid', bas: 'Froid', haut: 'Chaud' }` — **un AUTRE écran de la même application, et il est juste** |

**Et un seul écran dit l'inverse.** `ui/screens/aujourdhui.tsx:95` déclare
`{ cle: 'chaudFroid', bas: 'Chaud', haut: 'Froid' }`, et la ligne 728 envoie **−1** pour `bas`.
Cliquer « Chaud » demande donc au moteur `chaudFroid = −1`, c'est-à-dire **froid**.

`scoring/craving.ts:44` note par distance (`diff = axes[axis] − envie[axis]`, score = 1 − distance
normalisée) : demander −1 récompense les recettes proches de −1. Les huit salades du catalogue sont
entre **−0,9 et −0,8**. « Chaud = salade » n'est pas une impression, c'est le calcul.

⚠️ **Les deux autres axes sont justes**, vérifiés au même endroit : `bas: 'Léger'` → −1 quand le
catalogue dit −1 = léger, `bas: 'Salé'` → −1 quand le catalogue dit −1 = salé. **Un seul axe sur
trois est retourné** — ce qui est précisément ce qui rend le défaut invisible à la relecture.

✅ **UN QUATRIÈME TÉMOIN A ÉTÉ CHERCHÉ LE 2026-08-21, ET IL EXISTE — C'EST L'AUTRE ÉCRAN.**
`editeur-recette.tsx:85` déclare le même axe **dans le bon sens** (`bas: 'Froid'`, `haut: 'Chaud'`)
et rend la même table au même composant. Les deux écrans de l'application se contredisent donc l'un
l'autre, et c'est **Aujourd'hui** qui est seul de son avis contre les trois autres sources.
▶ **Aucun troisième endroit ne nomme cet axe** : `grep` sur `app/src` hors moteur, hors CLI et hors
tests ne rend que ces deux tables, plus le chargeur (`catalog-loader.ts:655`) qui ne fait que
recopier la colonne.

⛔ **LA CORRECTION ATTENDUE, ÉCRITE POUR QU'ELLE NE SE DEVINE PAS.** Échanger `bas` et `haut` sur la
**seule ligne 95**, pour qu'elle lise comme `editeur-recette.tsx:85`. **Ne PAS toucher aux lignes
727-733** : c'est la boucle de rendu, elle est **partagée par les trois axes**, et y inverser le
signe retournerait aussi `legerConsistant` et `sucreSale`, qui sont justes. C'est même exactement
ce que la clause « les deux axes justes le restent » est là pour attraper.

⚠️ **CETTE CORRECTION DÉPLACE UN BOUTON À L'ÉCRAN, ET C'EST VOULU.** Le libellé `bas` est rendu à
gauche : après échange, on lira **« Froid » puis « Chaud »**, dans cet ordre. C'est le prix de
l'alignement sur l'autre écran, et c'est la seule chose visible que le lot change côté Aujourd'hui.
Aucune clause ne fige cet ordre — s'il devait être « Chaud » d'abord, il faudrait alors changer la
boucle de rendu pour les trois axes, ce qui est un autre lot.

### Ce que donne le classement, mesuré au banc sur `catalog.db` réel

`npm run engine:try -- --envie chaud --limit 10` et son symétrique, le 2026-08-21 :

| Envie demandée | Moyenne `axe_chaud_froid` des 10 premières | Dont du bon côté |
|---|---|---|
| **chaud** (+1) | **+0,880** | **10 / 10** strictement chaudes |
| **froid** (−1) | **−0,350** | **8 / 10** strictement froides |

⚠️ **L'ASYMÉTRIE EST RÉELLE ET ELLE DOIT ENTRER DANS LE « FINI QUAND ».** Le catalogue porte **245**
recettes strictement chaudes contre **84** strictement froides (et 1 neutre). Sous « froid », deux
plats chauds remontent quand même — *Pâtes à la feta rôtie* (+0,8) et *Boulgour aux légumes grillés*
(+0,2) — parce que `craving` pèse 0,20 parmi onze couches et que la diversification MMR écarte
volontairement les résultats. **Exiger 10/10 des deux côtés serait exiger que le moteur cesse d'être
ce qu'il est.** Un critère qui ne tient pas compte de cette asymétrie serait faux au premier run.

### Le reste des observations n'est PAS mesurable par un test

Trois défauts confirmés par lecture du code :

- `ui/screens/parametres.tsx:1283-1286` — le bouton d'ustensile porte `aria-pressed={possedes.has(…)}`
  et une `className` **constante**. L'état est annoncé au lecteur d'écran et **invisible à l'œil**.
- `ui/visite.tsx:197` — `<div aria-hidden="true" className="absolute inset-0 bg-black/60" />` : le
  voile noir derrière la bulle de tutoriel.
- `ui/visite.tsx` — **aucune occurrence de `scrollIntoView`** : la bulle désigne un bouton qui peut
  être hors écran, et rien ne l'y amène.

⛔ **JSDOM NE CALCULE AUCUNE MISE EN PAGE.** Pas de hauteur, pas de position, pas de couleur
calculée, pas de superposition. Un test qui affirmerait « la case cochée se voit » ne pourrait
affirmer que « sa classe CSS diffère » — et cette affirmation-là, **un tricheur la satisfait en
ajoutant une classe qui ne peint rien**. Le projet a déjà refusé ce genre de clause : le sceau du
lot E avait été franchi par un `import` jamais appelé.

⚠️ **Conséquence, écrite ici pour ne pas être découverte plus tard** : la moitié visuelle de ce lot
**ne sera couverte par AUCUNE clause scellée**. C'est le même prix que le lot 65c a payé sur son
champ de saisie, et que le lot D3 avait payé avant lui. Il est assumé, pas ignoré.

---

## 3. Les lots

### Lot `retour-1` — l'axe retourné, et les écrans qui mentent ✅ **LIVRÉ le 2026-08-21**

⛔ **SEPT RÉPARATIONS SUR HUIT. La huitième n'est pas livrée, et ce n'est pas un oubli** — voir le
bilan en fin de section : elle décrivait autre chose que ce qu'elle disait, et elle est sortie en
lot `retour-1b`. **Livré en `3ce17d7`**, 12 fichiers, 1 064 insertions.

Deux moitiés de nature différente, dans le même lot parce qu'elles se testent sur le même écran et
que les séparer ferait deux passes de vérification manuelle au lieu d'une.

**Moitié A — l'axe chaud/froid, scellée.** Corriger `AXES_ENVIE` pour que « Chaud » demande +1.

**Moitié B — les écrans qui mentent, non scellée.** Huit réparations d'affichage :

1. les cases d'ustensile cochées se distinguent des décochées (`parametres.tsx:1283-1286`) —
   ⚠️ **le critère n'est pas « faire joli » : c'est le traitement actif que `Pastille` applique déjà
   à quelques lignes de là** (`aujourdhui.tsx:766-768` : bordure d'accent doublée, fond `accent-doux`,
   texte `accent-texte`). Le bouton d'ustensile porte le bon `aria-pressed` et **aucune classe
   conditionnelle** ; il ne manque pas une invention, il manque le branchement d'un traitement qui
   existe. Réutiliser celui-là plutôt qu'en inventer un second ;
2. le voile noir derrière la bulle de tutoriel disparaît (`visite.tsx:197`) ;
3. la bulle de tutoriel amène à l'écran le bouton qu'elle désigne (`visite.tsx`, aucun
   `scrollIntoView` aujourd'hui) ;
4. la première page du tutoriel annonce **TUTORIEL** en gras et en grand ;
5. le tutoriel commence par **Semaine**, pas par Aujourd'hui ;
6. les flèches du « Le saviez-vous » restent au même niveau quelle que soit la longueur du texte
   (`savoir.tsx:203-220`) ;
7. « Quitter le mode cuisine » reste atteignable sans faire défiler (`cuisine.tsx:518-525`) ;
8. sur la fiche recette, le bouton de retour passe **au-dessus** de l'image.

⚠️ **Les points 7 et 8 étaient une seule puce jusqu'au 2026-08-21** — relevé par le critique. Ce
sont deux écrans et deux correctifs distincts ; les compter pour un seul aurait laissé croire le lot
plus court qu'il n'est.

⛔ **CE LOT NE CONSTRUIT AUCUN FILTRE DUR.** La décision 71 est tranchée mais **bloquée par la 79**,
et surtout : bâtir un filtre dur sur un axe retourné transformerait « chaud remonte des salades » en
« chaud ne remonte QUE des salades ». **L'ordre n'est pas une préférence, c'est la condition.**

**Fini quand** :

> Sur `catalog.db` réel — jamais sur une fixture qui redirait la même chose — l'écran Aujourd'hui
> étant monté et la pastille **« Chaud »** activée, la liste proposée compte **au moins dix** plats,
> sa moyenne d'`axe_chaud_froid` est **strictement positive**, et **au moins 9 sur 10** sont
> strictement chauds. Avec **« Froid »** activée, la moyenne est **strictement négative** et **au
> moins 6 sur 10** sont strictement froids. La liste **change** quand on demande à renouveler les
> propositions, sans cesser d'être chaude. La fonction de score du moteur, appelée **hors écran**,
> continue de classer une recette chaude au-dessus d'une froide pour une envie chaude. **Et la
> requête que l'écran envoie au moteur porte `envie.chaudFroid = +1` sous « Chaud », `−1` sous
> « Froid »** — pas seulement la liste affichée, le nombre demandé. Et les deux
> autres axes gardent leur sens : « Léger » rend une moyenne d'`axe_leger_consistant` inférieure à
> celle de « Consistant », « Salé » et « Sucré » de même sur `axe_sucre_sale`.

**L'état d'aujourd'hui, mesuré par ces clauses mêmes le 2026-08-21** — c'est la sortie rouge du
brief, pas une projection :

| Pastille cliquée | Moyenne obtenue | Du côté demandé |
|---|---|---|
| **« Chaud »** | **−0,192** | **4 / 12** chauds |
| **« Froid »** | **+0,825** | **0 / 12** froids |
| « Léger » | −0,350 | ✅ correct |
| « Consistant » | +0,683 | ✅ correct |
| « Salé » | −0,558 | ✅ correct |
| « Sucré » | +0,133 | ✅ correct |

⛔ **LES DEUX PASTILLES RENDENT LA LISTE L'UNE DE L'AUTRE.** Après correction, « Chaud » rendra la
ligne « Froid » d'aujourd'hui (+0,825, **12/12 chauds**) et « Froid » rendra la ligne « Chaud »
(−0,192, **8/12 froids**). Les seuils du « Fini quand » sont calés là-dessus, pas sur une intention.

⚠️ **POURQUOI 9/10 D'UN CÔTÉ ET 6/10 DE L'AUTRE — L'ASYMÉTRIE N'EST PAS UN RELÂCHEMENT.** Le
catalogue porte **245** recettes chaudes contre **84** froides. Demander du froid rend
mécaniquement une liste plus mélangée que demander du chaud : 8 froids sur 12, soit 67 %. **Exiger
70 % des deux côtés aurait fait rougir la clause APRÈS la correction** — la symétrie des seuils
aurait été une élégance fausse.

⛔ **CES DEUX SEUILS SONT ARRIMÉS À LA COMPOSITION ACTUELLE DU CATALOGUE (245/84), PAS À UNE
PROPRIÉTÉ DU CODE.** Un lot de contenu qui ajoute trente recettes froides déplace le 6/10 sans que
rien ne soit cassé — et un lot qui en ajoute trente chaudes le déplace dans l'autre sens. **Si cette
clause rougit après un lot de CONTENU, le suspect est le catalogue, pas l'écran** : le relire avec
la clause de convention (84/245/1/330), qui rougira au même moment et le dira.

⚠️ **UNE PREMIÈRE MESURE ANNONÇAIT −0,900 ET 0/12, ET ELLE ÉTAIT FAUSSE.** Le harnais partait de la
position courante et remontait la liste ; l'écran ayant remis la position en tête après le clic, la
butée renvoyait **douze fois le même plat**. Le chiffre était donc l'axe d'UNE recette, présenté
comme une moyenne de douze. Corrigé en remontant d'abord en tête, puis en descendant. **Un nombre
trop net est un signal.**

**Ce qui le rendrait faux** — et ce que les clauses doivent donc refuser. ⚔️ **Le brief a été
attaqué DEUX FOIS le 2026-08-21 et il n'a tenu ni au premier ni au deuxième coup : TROIS
implémentations fausses passaient.** La troisième n'a été trouvée qu'après la correction des deux
premières — c'est-à-dire qu'un brief corrigé n'est pas un brief sûr.

- ⛔ **DEUX LISTES EN DUR, UNE PAR PASTILLE.** Le brief affirmait qu'« une constante ne peut
  satisfaire Chaud et Froid à la fois ». C'était un raisonnement, pas une mesure : **deux**
  constantes le peuvent, une branche par pastille, les autres clauses restant vertes par le vrai
  classement. ▶ **Fermé** par la clause de graine : une table figée ne bouge pas quand le tirage
  est renouvelé.
- ⛔ **CORRIGER LE MOTEUR AU LIEU DE L'ÉCRAN.** Inverser le signe du seul axe `chaudFroid` dans
  `scoring/craving.ts:44` faisait passer **toutes** les clauses d'écran — et cassait silencieusement
  `cli/try-engine.ts:89-90`, qui est déjà juste. Le périmètre « ce lot ne touche pas `engine/` »
  était une phrase dans un document, que rien ne vérifiait. ▶ **Fermé** par une clause qui appelle
  `scoreCraving` **hors écran** : elle est verte aujourd'hui et rougit si quiconque touche à la
  couche. **C'est elle qui enferme la correction dans l'écran.**
- **corriger le catalogue au lieu de l'écran.** Une clause fige les comptes mesurés : **84**
  recettes strictement froides, **245** strictement chaudes, **1** neutre, total **330**.
- ⛔ **RECLASSER LA LISTE APRÈS COUP, SANS TOUCHER AU SIGNE ENVOYÉ.** Trois lignes dans
  `calculerVue`, un tri du résultat sur l'axe réel : **les six clauses d'affichage passent** —
  moyennes, proportions, graine renouvelée, moteur intact — pendant que `context.envie.chaudFroid`
  part toujours à l'envers. La sélection des candidats et la diversification auraient donc tourné
  sur la mauvaise envie, et le tri ne réordonnerait que **les douze plats déjà mal retenus**.
  ▶ **Fermé** par une clause qui n'observe plus ce que l'écran MONTRE mais **ce qu'il DEMANDE** :
  le vrai moteur est enveloppé, chaque requête est lue au passage, et le signe doit valoir `+1`
  sous « Chaud ». Un tri d'après-coup arrive trop tard pour la satisfaire. **Rouge aujourd'hui :
  `expected -1 to be 1`.**
- **retourner les trois axes d'un coup.** Les clauses `legerConsistant` et `sucreSale` sont
  **VERTES aujourd'hui**, et c'est dit : elles existent pour rougir si la correction déborde.

⛔ **Ce que le « Fini quand » NE couvre PAS, et il faut le lire comme un aveu** : les huit
réparations de la moitié B. Aucune n'est observable en jsdom, qui ne calcule ni hauteur, ni
position, ni couleur.

**Le protocole qui les remplace — à exécuter avant `/fin`, et à coller dans le rapport.** Sur le
téléphone de l'auteur, en navigation privée pour partir d'une base vierge, écran tenu à la
verticale :

| # | Ce qu'on fait | Ce qu'on doit voir |
|---|---|---|
| 1 | Paramètres → Matériel, cocher 3 ustensiles, fermer, rouvrir | les 3 cochés se distinguent des autres **sans les lire** — bordure, fond ou coche, au premier coup d'œil |
| 2 | lancer le tutoriel | le fond derrière la bulle n'est plus noirci ; le texte de l'écran reste lisible |
| 3 | avancer le tutoriel jusqu'à un bouton situé en bas | l'écran défile tout seul jusqu'au bouton désigné |
| 4 | première page du tutoriel | **TUTORIEL** en gras, plus gros que le reste |
| 5 | ordre des étapes | Semaine vient avant Aujourd'hui |
| 6 | « Le saviez-vous », faire défiler 5 tips de longueurs différentes | les deux flèches ne bougent pas d'un pixel |
| 7 | mode cuisine, descendre au bas d'une recette longue | « Quitter le mode cuisine » reste atteignable sans remonter |
| 8 | fiche d'une recette avec photo | le bouton de retour est au-dessus de l'image, pas dessous |

⚠️ **Huit cases, huit observations à l'œil. Un lot vert ne dira rien d'elles.** C'est le même prix
que le lot 65c a payé sur son champ de saisie, et que le lot D3 avait payé avant lui.

⚠️ **Deux pièges de HARNAIS ont été payés en écrivant ces clauses, et ils sont notés dans le fichier
de test.** (1) `calculerVue` est asynchrone : sans flush, on lit la liste d'AVANT la pastille — le
premier jet mesurait des listes identiques sous « Léger » et « Consistant » et **allait conclure à
tort que la pastille n'était branchée à rien**. (2) L'encart d'aide ne s'ouvre qu'à la 11ᵉ carte sur
12, et « Suivant » est coupé en butée : la liste se collecte donc en remontant d'abord en tête.

**Ce que le lot ne touche pas** : `engine/` (aucune ligne — la correction est un signe dans un
tableau d'écran, et une clause hors écran le vérifie désormais), `catalog/` et `catalog.db` (aucune
régénération), le schéma `user.db` (aucune migration), la liste de courses, la semaine, le frigo.

**Témoins d'avant, relevés le 2026-08-21 sur l'arbre commité `4f1b83d`** : `npm test` → **2 254
passed / 0 failed, 122 fichiers** · `engine:plan-stress` **20/20** · typecheck propre. Le catalogue
n'étant pas concerné, `node catalog/build.mjs` n'est pas un témoin de ce lot.

---


#### Ce que le lot a réellement livré, mesuré le 2026-08-21

**Moitié A — faite, et l'examen est vert.** `tests/scelles/retour-1.test.tsx` : **9 clauses, 9
vertes**, dont les quatre qui étaient rouges le jour où elles ont été écrites. La correction tient en
un mot échangé (`bas`/`haut` sur `AXES_ENVIE`, `aujourdhui.tsx:95`), plus le commentaire qui dit
pourquoi ne pas la « réparer » ailleurs.

Les mesures d'après correction sont **exactement** celles que le brief annonçait, au centième :

| Pastille | Avant | Après |
|---|---|---|
| **« Chaud »** | −0,192 · 4/12 chauds | **+0,825 · 12/12 chauds** |
| **« Froid »** | +0,825 · 0/12 froids | **−0,192 · 8/12 froids** |

⚠️ **UN BOUTON A CHANGÉ DE CÔTÉ, et c'est la seule chose visible côté Aujourd'hui** : « Froid »
s'affiche désormais à gauche de « Chaud », par alignement sur `editeur-recette.tsx` qui déclarait
déjà le même axe dans le bon sens. **Aucun test ne fige cet ordre.**

**Moitié B — sept réparations sur huit.** Cases d'ustensile visibles (le traitement actif de
`Pastille`, réutilisé, jamais réinventé) · voile noir du tutoriel retiré · la cible du tutoriel est
amenée à l'écran avant d'être mesurée · la bulle annonce **TUTORIEL** en grand · flèches du
« Le saviez-vous » remontées AU-DESSUS du fait, donc stables par la forme et sans hauteur minimale
inventée · « Quitter le mode cuisine » collé en haut · retour de la fiche recette passé au-dessus de
la photo, **avec §4.6 DESIGN corrigé dans le même geste**.

⛔ **LA HUITIÈME N'EST PAS LIVRÉE, ET LA PUCE QUI LA DÉCRIVAIT ÉTAIT FAUSSE.** Elle disait « le
tutoriel commence par Semaine, pas par Aujourd'hui ». **Mesuré : il commence DÉJÀ par Semaine** — le
parcours d'accueil enchaîne barre du bas → Semaine → Courses → Recettes → Savoir, et n'a aucune
étape « Aujourd'hui ». Ce que l'auteur voulait, demandé le même jour, est **un tutoriel qui traverse
les menus en entrant dans chacun** : voir les menus, toucher Aujourd'hui, faire les étapes
d'Aujourd'hui, toucher Semaine, faire les siennes, et ainsi de suite. **C'est un parcours composé,
pas une réparation d'affichage** — sorti en lot `retour-1b`, sur décision de l'auteur.

⚔️ **DEUX EFFETS DE BORD ONT ÉTÉ CHERCHÉS APRÈS COUP, ET LES DEUX EXISTAIENT.** Aucun ne faisait
rougir un test — ils ont été trouvés en relisant ce que le code touché voisinait, pas en lançant la
suite. **Une suite verte ne cherche pas les effets de bord ; elle constate qu'elle n'en voit pas.**

1. ⛔ **DÉFILER VERS LA BARRE D'ONGLETS AURAIT FAIT SAUTER L'ÉCRAN À L'OUVERTURE DU TUTORIEL.** La
   réparation « amener la cible à l'écran » appelait `scrollIntoView` sans condition. Or la
   première étape du parcours d'accueil désigne la barre d'onglets, qui est **`position: fixed`**
   (`navigation.tsx:108`) : le navigateur défile pour la « centrer », elle ne bouge pas d'un pixel,
   et tout le reste de la page saute — à l'instant exact où le tutoriel s'ouvre, c'est-à-dire au
   pire moment. ▶ **Fermé** : on mesure d'abord, on ne défile que si la cible est réellement hors
   du viewport. Effet secondaire heureux — en jsdom toutes les boîtes valent zéro, donc la branche
   n'est jamais prise et `scrollIntoView`, que jsdom n'implémente pas, n'est jamais appelé.

2. ⛔ **LE BANDEAU « TUTORIEL » POUVAIT SE RALLUMER AU MILIEU DU PARCOURS.** Il testait
   `etapeIndex === premierIndexValide(etapes, 0)`, recalculé **à chaque rendu**. `premierIndexValide`
   interroge le DOM : dès que la cible de la première étape disparaît de l'écran, il rend un autre
   index, et le bandeau se rallume sur une étape quelconque. ▶ **Fermé** par une référence figée au
   montage. ⚠️ Le défaut ne se voit sur AUCUN parcours d'aujourd'hui — la barre d'onglets et les
   titres d'écran ne disparaissent pas. Il se serait vu sur le premier parcours qui traverse
   plusieurs écrans, **c'est-à-dire sur `retour-1b`**.

⚠️ **LE PROTOCOLE À L'ŒIL N'A PAS ÉTÉ EXÉCUTÉ.** Les huit cases du tableau plus haut attendent une
passe sur le téléphone, et **un arbre vert ne dit rien d'elles**. C'est le même prix que 65c et D3.

**Témoins d'après, les quatre commandes relancées sur l'arbre livré** : `npm test` → **2 263 passed /
0 failed, 123 fichiers** (44 s) · typecheck propre · `vite build` ✓ (3,12 s) · `engine:plan-stress`
**20/20**. ⚠️ **L'écart 2 254 → 2 263 est de +9 tests et +1 fichier, et il s'attribue en entier au
fichier scellé du lot** — `tests/scelles/retour-1.test.tsx` en porte exactement 9. Aucun test
existant n'a bougé. Le catalogue n'ayant pas été touché, ni `catalog/build.mjs` ni
`catalog/audit-mapping.mjs` ne sont des témoins de ce lot.

---

### Lot `retour-1b` — le tutoriel qui traverse les menus ✅ **LIVRÉ le 2026-08-21**

**Livré en `42491ea`**, 6 fichiers. `npm test` **2 363 passed / 0 failed (124 fichiers)** en 44,4 s ·
typecheck propre · `vite build` ✓ (3,06 s) · `engine:plan-stress` **20/20**. Catalogue non touché.
Les 10 clauses scellées sont vertes.

⛔ **CE QUE CE VERT NE DÉMONTRE PAS, ET IL FAUT LE SAVOIR AVANT DE LE CROIRE.** jsdom commet ses
rendus de façon synchrone : le vert prouve que l'enchaînement est correct, **pas** que l'attente
tient au temps de chargement réel d'un écran sur téléphone. C'est exactement la moitié du « Fini
quand » qu'aucun test ne peut porter, et elle se paie à la main — voir §3, la passe à l'œil.

⚠️ **UN CINQUIÈME FICHIER EST ENTRÉ DANS LE PÉRIMÈTRE, QUE LE BRIEF N'AVAIT PAS PRÉVU** :
`app/src/ui/visite.test.tsx`, test ordinaire et non scellé, affirmait que le saut d'une étape sans
cible est **immédiat** — au point exact que le lot change. Sa fin est inchangée (l'étape est bien
sautée, la visite ne se termine pas) ; la moitié neuve vérifie qu'**aucune bulle n'est posée pendant
l'attente**. Le titre du test reste vrai. ▶ Le brief déclarait ce fichier hors périmètre : c'est un
écart de plan, pas de spec.

**Ce que l'auteur a demandé, dans ses mots (2026-08-21) :** « montrer les différents menus · premier
menu → Aujourd'hui · quand on clique sur le menu Aujourd'hui, on continue le menu mais spécialement
pour le menu Aujourd'hui · puis on enchaîne sur le menu Semaine etc. »

La forme visée, un **seul** parcours au lieu de neuf :

```
la barre du bas        « voici les cinq menus »
  ↓ touchez Aujourd'hui
Aujourd'hui            ses étapes à lui
  ↓ touchez Semaine
Semaine                ses étapes à lui
  ↓ touchez Courses    … puis Recettes, Savoir
```

**Ce qui existe déjà, et qu'il ne faut pas réécrire.** Les neuf parcours sont écrits
(`ui/parcours.ts`), chacun avec ses étapes ; le type `route` fait déjà avancer une étape quand la
navigation aboutit. Il manque **l'enchaînement**, pas le contenu.

**Les trois choses à faire, et la troisième est la seule vraie inconnue :**

1. un parcours composé qui **entrelace** `ETAPES_MENUS` et les parcours d'écran — ⛔ **entrelacer,
   pas concaténer** : une étape de transition, puis le bloc de l'écran où elle mène, puis la
   transition suivante, et ainsi de suite. Mettre les cinq transitions d'abord et les cinq blocs
   ensuite produit 29 étapes, satisfait les clauses 2, 4, 5, 6 et 7 — et **échoue les quatre autres**,
   c'est mesuré plus bas ;
2. une étape « touchez Aujourd'hui », qui **n'existe pas** — son absence est écrite dans
   `parcours.ts` comme une décision (« c'est l'écran de départ le plus courant, le désigner
   n'apprendrait rien »), et cette décision tombe avec ce lot ;
3. ⚠️ **VÉRIFIER QUE L'ENCHAÎNEMENT NE SAUTE PAS TOUT EN SILENCE.** `premierIndexValide`
   (`ui/visite.tsx`) écarte **toute étape dont la cible est absente du DOM à l'instant où elle
   arrive**, et `surSuivant` l'appelle à chaque avancée. Si l'écran Semaine n'est pas encore rendu
   quand l'étape « touchez Semaine » se valide, **toutes les étapes de Semaine sont sautées et le
   tutoriel se termine sans rien dire**. La lecture du code laisse penser que le rendu arrive à
   temps — `useRoute` notifie Visite et l'écran dans le même cycle React, les effets tournent après
   le commit du DOM — **mais c'est un raisonnement, pas une mesure**, et ce dépôt a déjà payé cette
   confusion deux fois dans la même journée. **La première clause du « Fini quand » doit être
   celle-là.**

**Fini quand** — cinq clauses, jouées contre la coquille RÉELLE (`ui/main.tsx` monté comme le font
déjà `main.test.tsx:52` et `main-accessibilite.test.tsx:78`), jamais contre un écran isolé ni contre
la table `PARCOURS` seule. Le compte de référence : **29 étapes**, soit les 5 de `menus`, les 23 des
cinq parcours d'écran (5 + 4 + 4 + 5 + 5) et **une** étape neuve qui demande de toucher Aujourd'hui.

1. ⛔ **L'ENCHAÎNEMENT NE SAUTE RIEN — c'est la clause qui décide du lot.** On traverse l'intro, on
   répond « Oui » à l'invitation, puis on **joue le tutoriel comme un utilisateur** : « Suivant » sur
   les étapes de lecture, et pour les autres le geste que l'étape déclare — y compris le clic sur le
   **vrai lien de la barre d'onglets**, celui de `navigation.tsx`, jamais une destination choisie
   par le test. Les cinq étapes d'ouverture d'écran sont alors **réellement affichées, dans cet
   ordre** :

   | ordre | titre affiché | écran |
   |---|---|---|
   | 1 | « Une idée à la fois » | Aujourd'hui |
   | 2 | « Toute la semaine d'un coup » | Semaine |
   | 3 | « La liste se fait toute seule » | Courses |
   | 4 | « Chercher, pas se faire proposer » | Recettes |
   | 5 | « Pour comprendre, pas pour décider à votre place » | Savoir |

   Et le tutoriel se ferme **après** la cinquième, jamais avant. ⚠️ **Ce sont les étapes
   INCONDITIONNELLES de la règle 1** (`parcours.ts`, verrouillée par `parcours.test.ts`) : elles
   ciblent le titre de l'écran, toujours monté. Une étape conditionnelle légitimement sautée
   (`composer-semaine` quand un plan existe, `sans-rien-acheter` sur un frigo vide) ne fait pas
   échouer la clause — un écran entier sauté, si. ▶ **Ce qui la rendrait fausse** : voir
   « Vos courses » là où « Toute la semaine d'un coup » est attendu, c'est-à-dire l'écran Semaine
   traversé sans qu'une seule de ses étapes s'affiche.

   ⚠️ **MESURÉ LE 2026-08-21, ET ÇA CONTRAINT LE TEST** : en jsdom, cliquer un `<a href="#/semaine">`
   **met bien à jour `location.hash`**, mais **n'émet AUCUN `hashchange`** — vérifié par un fichier
   jetable, `hash = "#/semaine"` et `hashchange = 0`. Or `useRoute()` n'écoute que `hashchange`.
   Le test clique donc le vrai lien **puis réveille jsdom** par un `hashchange` à la main, comme le
   font déjà `visite.test.tsx:54-55` et `main-accessibilite.test.tsx:66-67`. **Ce n'est pas la
   triche que la clause interdit** : la destination vient du `href` du lien touché, pas du test. Si
   la bulle désignait un autre onglet, le test irait ailleurs et échouerait.

2. **Le premier lancement joue le composé, pas « menus ».** Juste après « Oui », la bulle annonce
   **« Étape 1 sur 29 »**. ▶ Faux si elle annonce « sur 5 » : le tutoriel de première ouverture est
   resté celui de la barre d'onglets.

3. **Une étape demande de toucher Aujourd'hui, et elle précède les étapes d'Aujourd'hui.** Sa bulle
   **n'a pas de bouton « Suivant »** (c'est une étape à geste, `attendGeste` dans `visite.tsx`), et
   cliquer le vrai lien `#/aujourdhui` la fait avancer. ▶ Faux si la bulle porte « Suivant » : le
   geste serait décoratif, on avancerait sans toucher l'onglet.

4. **Le composé RÉUTILISE les étapes existantes, il ne les recopie pas.** Chacune des 23 étapes des
   cinq parcours d'écran, et chacune de celles de `menus`, se retrouve dans le composé **par identité
   d'objet** (`toBe`, pas `toEqual`), dans son ordre d'origine. ▶ Faux si un `toEqual` passe là où un
   `toBe` échoue : les textes ont été dupliqués, et ils divergeront au premier lot de contenu.

5. **Les neuf parcours restent lançables un par un.** `PARCOURS` porte toujours les neuf
   identifiants d'origine, chacun avec au moins une étape. ▶ Faux si le composé en a remplacé un.
   ⚠️ **LE COMPOSÉ VIT DANS `PARCOURS`, ET CE N'EST PLUS UN CHOIX** : `main.tsx:448` joue
   `etapesDuParcours(parcoursActif)`, donc un parcours hors table serait injouable par le mécanisme
   actuel. La clause l'exige (`PARCOURS.length > 9`). Reste ouvert, en revanche : que la liste
   « Revoir un tutoriel » de Réglages, dérivée de la même table, l'affiche ou le filtre.

6. ⛔ **AUCUNE BULLE NE POINTE DANS LE VIDE.** Toute bulle affichée pendant le parcours désigne un
   élément **réellement présent dans le DOM** à l'instant où elle s'affiche. ▶ **Née de l'attaque du
   2026-08-21** : le lot a le droit de toucher `visite.tsx`, et le chemin le plus court est de faire
   rendre à `premierIndexValide` son point de départ sans rien vérifier. Les 29 étapes défilent
   alors dans l'ordre du tableau, les cinq ouvertures s'affichent, le compteur dit 29 — et chaque
   bulle d'un écran absent désigne un élément qui n'existe pas. **Six clauses vertes, garde-fou
   supprimé au lieu d'être remplacé.**

7. **Les titres du parcours joué sont deux à deux distincts.** ▶ **Mesuré, pas supposé** :
   « Partir de ce que vous avez » existe DÉJÀ deux fois dans `parcours.ts` (lignes 170 et 289), sur
   deux cibles différentes, et la première appartient à `ETAPES_AUJOURDHUI`, donc au composé. Deux
   bulles au même titre, c'est un défaut pour qui suit le tutoriel autant qu'un piège pour qui le
   pilote.

⚠️ **LES CLAUSES 6 ET 7 SONT VERTES AUJOURD'HUI, ET C'EST VOULU** — même rôle que les axes
`legerConsistant` et `sucreSale` du lot `retour-1`. Ce sont des gardes **anti-débordement** : elles
n'existent pas pour révéler le défaut du jour, elles existent pour rougir si la correction l'obtient
en cassant autre chose.

⛔ **CE QUE LA CLAUSE 3 NE PROUVE PAS, ET IL FAUT LE SAVOIR.** `router.tsx:371` pose
`ROUTE_PAR_DEFAUT = { onglet: 'aujourdhui' }` : **l'écran Aujourd'hui est déjà monté quand le
tutoriel démarre.** La transition « touchez Aujourd'hui » ne traverse donc JAMAIS le risque de course
décrit plus haut — elle ne teste que la FORME du geste. **C'est la clause 1 qui traverse la course,
quatre fois** : Semaine, Courses, Recettes et Savoir, eux, ne sont pas montés.

⛔ **ET CE QU'AUCUNE CLAUSE NE PROUVERA : jsdom committe de façon synchrone.** Un vert ici ne dit
rien de la peinture réelle d'un navigateur, où le montage d'un écran peut arriver plus tard. **La
course se vérifie à l'œil, sur le téléphone**, au même titre que les réparations visuelles de
`retour-1` — protocole §3. Un arbre vert n'est pas une preuve sur ce point précis, et le prétendre
serait exactement l'erreur que ce document reproche ailleurs.

⚠️ **CE QUE LE « FINI QUAND » NE DIT PAS, ET QU'IL FAUDRA TRANCHER EN CODANT** : le libellé exact de
l'étape « touchez Aujourd'hui » ; l'identifiant du parcours composé ; où elle vit dans le code (une
constante à part ou en ligne dans le tableau composé) ; **son type de geste — `clic` ou `route`, les
deux passent les clauses** ; la valeur de `ecran` pour le composé (`null` comme `menus` est
déductible par analogie, ce n'est pas une spécification) ; et **si `visite.tsx` doit attendre qu'une
cible apparaisse au lieu de la sauter**.

⛔ **CE QUE LES CLAUSES N'EXERCENT PAS : UN COMPTE QUI A DÉJÀ SERVI.** `test-socle.js` monte un
compte NEUF — pas de plan de semaine, pas de liste de courses, frigo vide. Or les étapes
conditionnelles de `ETAPES_SEMAINE` et `ETAPES_COURSES` changent de forme dès qu'un plan existe
(`composer-semaine` disparaît, `autre-semaine` apparaît). **Rejouer le composé depuis « Revoir un
tutoriel » sur un compte rempli n'est couvert par rien**, ni ici ni ailleurs. Ce n'est pas une raison
de bloquer le lot — c'est une raison de ne pas prétendre que le vert le couvre.

⚠️ **`ecran: null` POUR LE COMPOSÉ EST UN CHOIX, PAS UNE ÉVIDENCE.** Le prendre par analogie avec
`menus` donnerait **deux** entrées de `PARCOURS` à `ecran === null`, et `parcoursDeLEcran`
(`parcours.ts:498`) est un `find` : il rendrait la première, en silence. ▶ **Sans conséquence
aujourd'hui — cette fonction n'a AUCUN appelant**, vérifié sur tout `app/src` ; `lien-tutoriel.tsx:6`
explique même pourquoi on ne s'en sert pas. ▶ **Elle a depuis été RETIRÉE (2026-08-22, lot
`retour-2`, dette §8)** : le défaut décrit ici ne peut plus se produire, faute de fonction. L'autre option, `ecran: hashDe('aujourdhui')`, a du sens
en soi : `lancerParcours` amènerait sur l'écran de départ avant de démarrer. **Le lot tranche, le
brief ne tranche pas.**

⚠️ **UN POINT DE CODE QUE LE BRIEF NE NOMMAIT PAS ET QU'IL FAUDRA TOUCHER** : `main.tsx:178` fixe
`parcoursActif` à `'menus'` **en dur**, et `repondreInvitation` ne le change jamais avant de lancer
la visite. La clause 2 impose 29 dès la première bulle : cette ligne doit bouger. Ce
dernier point est le seul qui touche au mécanisme — clause 1 dit ce qu'on doit observer, pas comment
l'obtenir, et **desserrer `premierIndexValide` sans le remplacer rouvrirait le tutoriel fantôme**.

⛔ **CE LOT TOUCHE AU COMPOSANT QUI JOUE LES TUTORIELS, pas seulement à leur contenu.** Ce n'est pas
de l'affichage : c'est du comportement, et `premierIndexValide` est un garde-fou volontaire contre
le « tutoriel fantôme » (règle 1 de l'en-tête de `parcours.ts`). Le desserrer sans le remplacer
rouvrirait exactement ce qu'il ferme.

⚠️ **NE PAS CONFONDRE AVEC LA LISTE DE RÉGLAGES.** « Revoir un tutoriel » liste les neuf parcours
séparément, et **cette liste n'est pas ce que l'auteur visait** — vérifié auprès de lui le même jour,
après une première interprétation fausse de ma part. Les neuf parcours individuels restent lançables
un par un ; ce lot ajoute un dixième chemin, il n'en supprime aucun.

#### Ce que le lot NE TOUCHE PAS

`app/src/engine/` en entier · `catalog/` et `catalog.db` — **aucun contenu ne bouge, donc ni
`catalog/build.mjs` ni `catalog/audit-mapping.mjs` ne sont des témoins de ce lot** · les neuf
parcours existants, dont **aucune étape n'est réécrite** (clause 4 : identité d'objet) · les écrans
(`ui/screens/`), sauf si une cible `data-visite` manquait — auquel cas c'est à signaler, pas à
faire en silence · le mécanisme d'invitation de fin d'intro, qui reste un `Panneau` proposé une
seule fois.

⛔ **LA SEULE EXTENSION AUTORISÉE HORS `parcours.ts` EST `visite.tsx`**, et seulement si la clause 1
l'exige. `premierIndexValide` est un garde-fou volontaire : le desserrer sans le remplacer rouvre
le tutoriel fantôme que la règle 1 de `parcours.ts` existe pour fermer.

#### Les témoins d'avant — mesurés le 2026-08-21, arbre du brief

| Commande | Avant le lot |
|---|---|
| `npm test` | **2 265 passed / 8 failed (124 fichiers)** en 43,6 s — **les 8 rouges sont ceux de ce brief, et les 2 verts de plus sont ses clauses 6 et 7** ; le reste, 2 263, est exactement le relevé de `retour-1`, compté et non déduit |
| `npm run typecheck` | propre |
| `npx vite build` | ✓ 3,11 s |
| `npm run engine:plan-stress` | **20/20** |

⚠️ **CE QUE LE ROUGE PROUVE, LIGNE À LIGNE** — un test scellé qui échoue pour une raison de
harnais ne prouverait rien :

| Clause | Sortie |
|---|---|
| 1 — l'enchaînement | 🔴 `expected [] to deeply equal [ 'Une idée à la fois', …(4) ]` |
| 1 — sur le bon écran | 🔴 `expected [] to deeply equal [ Array(5) ]` |
| 1 — la fin | 🔴 `expected -1 to be greater than or equal to 0` |
| 2 — le composé au premier lancement | 🔴 `expected [ 1, 5 ] to deeply equal [ 1, 29 ]` |
| 3 — toucher Aujourd'hui | 🔴 `expected 'Cette semaine' to be 'Une idée à la fois'` |
| 3 — elle dit ce qu'elle demande | 🔴 `expected undefined to be defined` |
| 4 — réutiliser sans recopier | 🔴 `expected undefined to be defined` |
| 5 — les neuf survivent | 🔴 `expected 9 to be greater than 9` |
| 6 — aucune bulle dans le vide | 🟢 **verte, garde anti-débordement** |
| 7 — titres distincts | 🟢 **verte, garde anti-débordement** |

⛔ **HUIT ROUGES QUI DISENT CHACUN LEUR PROPRE DÉFAUT — ET IL A FALLU S'Y REPRENDRE À DEUX FOIS.** Le
premier durcissement faisait dépendre les clauses de terrain de l'EXISTENCE du composé : six d'entre
elles échouaient alors sur le même `expected undefined to be defined`, **un rouge exact et
parfaitement muet**, qui ne prouvait plus qu'elles savaient détecter leur défaut. Le pilote joue
désormais **le parcours que l'application lance réellement**, déduit du total et du titre affichés —
aucun nom de parcours en dur. **Un test rouge n'est utile que si son message désigne la cause.**

⚔️ **LE BRIEF A ÉTÉ ATTAQUÉ DEUX FOIS. LE SECOND ROUND A ÉCRIT SA TRICHE ET L'A LANCÉE.** Le
premier n'avait que raisonné — « raisonné, pas mesuré, faute de temps » —, ce qui ne prouve rien
dans un sens ni dans l'autre. Le second a écrit dans l'arbre un parcours composé obtenu par
**concaténation** des blocs (29 étapes, réutilisant les vrais objets, branché comme tutoriel par
défaut), puis a lancé la suite :

```
Tests  4 failed | 6 passed (10)
× affiche l'étape d'ouverture des CINQ écrans   → expected [] to deeply equal [ 'Une idée à la fois', …(4) ]
× est RÉELLEMENT sur l'écran                    → expected [] to deeply equal [ Array(5) ]
× ne se termine qu'APRÈS la dernière ouverture  → expected -1 to be greater than or equal to 0
× touchez Aujourd'hui                           → expected 'Cette semaine' to be 'Une idée à la fois'
```

⛔ **CE QUE CE 4/10 DÉMONTRE, ET QU'AUCUNE RELECTURE N'AURAIT DÉMONTRÉ** : les clauses 2, 4, 5, 6 et 7
sont satisfaites par la seule PRÉSENCE des bons objets en bon nombre — **elles ne discriminent pas
seules**. C'est la clause 1, qui joue le parcours sur le vrai DOM et relève `location.hash` à chaque
bulle, qui attrape la triche : une concaténation laisse le tutoriel sur Aujourd'hui pendant que la
table déroule les titres de Semaine, dont les cibles ne sont pas dans le DOM ; `premierIndexValide`
les saute toutes et `ouverturesVues` rend `[]`. ▶ **Verdict du round 2 : NON TROUVÉ de triche qui
fasse passer les dix.** L'arbre a été rendu intact — vérifié à la main, `git diff -- app/src` vide,
aucun `.orig` orphelin.

✅ **LE PILOTE A ÉTÉ VÉRIFIÉ VIVANT AVANT D'ÊTRE CRU MORT.** Une sonde temporaire a relevé ce qu'il
traverse réellement aujourd'hui : `["La navigation", "Cette semaine", "Vos courses", "Toutes les
recettes", "Le coin Savoir"]`, hash final `#/savoir`. Il clique donc bien les vrais liens, la
navigation aboutit, et le tutoriel se déroule jusqu'au bout — **il nomme les cinq onglets sans
entrer dans un seul.** C'est exactement le défaut que le lot ferme, et non un harnais cassé.

---

### Lot `retour-2` — le sélecteur s'ouvre aux 451 aliments ✅ **LIVRÉ le 2026-08-22**

**Commit `6aad49c`** — code, tests scellés et garde. Les documents suivent dans le commit d'après,
celui qui porte ce hash. ▶ Bilan et angle mort en fin de section.

**Ce que l'auteur a demandé, dans ses mots (2026-08-21, décision 73) :** « C'est un menu préférence
en tout : si une personne déteste manger des haricots, il faut lui donner la possibilité d'exclure
l'aliment. »

#### Ce qui a été mesuré avant d'écrire quoi que ce soit

⛔ **LE CHIFFRE DE LA DÉCISION 73 EST FAUX, ET IL A ÉTÉ REMESURÉ AVANT D'OUVRIR LE LOT.** Elle
annonce « 129 aliments atteignables sur 451 ». **129 est le nombre d'aliments qui DÉCLARENT
`origine_animale` en propre** — il oublie les **38 dérivés** que `resolveAnimalOrigin` rattache en
remontant `deriveDe` (le beurre par `lait_entier`). Relevé en faisant tourner `groupesAnimaux` sur
`app/public/catalog/catalog.db` : **167 atteignables, 284 hors d'atteinte.**
`CONCEPTION_REGIME_PERSONNALISE.md` lot A écrivait déjà « total 167/451 » ; c'est `ETAT.md` §4 qui
était seul à dire 129, et il a été corrigé dans le même geste.

**Les 7 groupes rendus aujourd'hui**, effectifs mesurés : `laitiers` 50 · `poisson` 43 ·
`viande_mammifere` 39 · `fruits_de_mer` 14 · `volaille` 13 · `oeufs` 7 · `miel` 1. **Total 167.**

**Les 284 hors d'atteinte**, par famille du catalogue : légumes **74** · condiments **52** ·
fruits **50** · céréales et dérivés **45** · fruits à coque et oléagineux **18** · légumineuses
**14** · produits sucrés **12** · matières grasses **9** · boissons alcoolisées **6** · lait et
produits laitiers **4** (ces quatre derniers sont les trois boissons végétales et le lait de coco —
sans origine animale, et c'est juste).

✅ **LA CLAUSE EXHAUSTIVE PAR LA RECHERCHE EST TENABLE, ET ÇA NE SE DÉDUISAIT PAS.**
`chercherParNom` ne rend que 6 résultats classés : rien ne garantissait a priori qu'un aliment tapé
en toutes lettres y figure toujours — un homonyme au nom plus court pouvait le sortir du haut de
liste. **Relevé sur les 451 aliments du `catalog.db` réel : 0 introuvable à la limite 6** (0 aussi à
8 et à 10). La clause peut donc porter sur les 451, pas sur un échantillon.

#### Ce qui existe déjà, et qu'il ne faut surtout pas réécrire

**Tout, sauf le moyen de désigner.** La table `user_excluded_food`, `writeExcludedFoodIds` /
`readExcludedFoodIds`, le dépliage `readExcludedFoodIdsDeplies`, la couche `exclusions` du moteur et
le compteur de plats restants tournent depuis le lot B du régime personnalisé. Le panneau sait déjà
cocher un aliment SEUL — c'est ce que fait son dépliant de groupe. **Il manque une porte vers les 284
autres, pas un moteur.**

⭐ **ET LE MÊME PROBLÈME A DÉJÀ ÉTÉ RÉSOLU AILLEURS DANS CETTE APPLI — décision 58, le 2026-08-05.**
Sur l'écran Frigo, **352 aliments sur 450 étaient injoignables** parce que le seul pont était une
recherche par nom. La réponse retenue alors, et en place depuis sur **trois écrans** (Frigo, Courses,
Éditeur de recette), est une **paire** : un champ `chercherParNom` **et** un parcours des familles du
catalogue pour qui ne sait pas comment l'aliment s'appelle. ⛔ **Ne pas livrer la moitié de cette
paire ici serait rejouer un défaut déjà payé** : « je n'aime pas les abats » ne se tape pas, ça se
reconnaît dans une liste.

#### La forme retenue, et les trois qu'on écarte

**Retenue : la paire de la décision 58, posée à l'INTÉRIEUR du panneau existant** — un champ de
recherche sur les **451**, et les familles du catalogue en **intitulés dépliables non cochables**,
comme le fait déjà le panneau voisin « Mes exceptions » (« un intitulé, pas une case : le groupe
n'est pas cochable, il ouvre »). Les cases restent individuelles et écrivent par le chemin déjà en
place.

⚠️ **LES FAMILLES SE DÉRIVENT, ELLES NE SE RECOPIENT PAS.** `famillesDuCatalogue`
(`ui/parcours-aliments.tsx`) fait déjà exactement ce regroupement, tri `localeCompare('fr')` compris,
et son en-tête dit pourquoi une liste écrite à la main diverge. **La sortir en export et l'appeler**,
jamais en écrire une seconde.

⛔ **ÉCARTÉ : RÉUTILISER `ParcoursAliments` TEL QUEL.** Deux raisons, chacune suffisante.
**(1) Il choisit UN aliment et se ferme** — c'est un sélecteur, pas un jeu de cases ; retirer les
haricots, les navets et les endives demanderait trois allers-retours. **(2) Il s'ouvre dans un
`Panneau`, et le sélecteur d'exclusion EN EST DÉJÀ UN.** Deux `Panneau` montés en même temps, c'est
deux `role="dialog"` avec `aria-modal="true"` dans le document, **deux pièges à `Tab` posés sur
`document` qui se disputent le focus**, et un `getByRole('dialog')` qui en trouve deux — soit les
~20 tests de `parametres.test.tsx` qui passent par `ouvrir()` cassés d'un coup. La clause 7 interdit
ce montage.

⛔ **ÉCARTÉ : DES CASES DE GROUPE SUR LES 14 FAMILLES DU CATALOGUE.**
`user_excluded_group.groupe_id` porte un `CHECK` SQL qui fige **sept** valeurs (`user-schema.ts`,
v15) : en ajouter quatorze force une reconstruction de table, donc **une migration de `user.db`** — et
`groupes-animaux.ts` écrit noir sur blanc qu'un `groupe_id` stocké qui ne se déplie plus **n'exclut
plus rien, en silence**. Pire : les deux découpages **se chevauchent sans coïncider** — « viandes »
(46) n'est ni `viande_mammifere` (39) ni son union avec `volaille` (13) — et deux jeux de cases qui
se recouvrent à moitié dans un même panneau, c'est une confusion durable. **En intitulés non
cochables, le chevauchement devient inoffensif** : deux portes, un seul état par aliment.

⛔ **ÉCARTÉ : UN TROISIÈME PANNEAU.** Il y en a déjà deux, et leur séparation est structurelle
(l'un retire, l'autre réadmet). Un troisième qui retire aussi rendrait la frontière illisible.

⚠️ **UNE RECHERCHE QUI NE COUVRIRAIT QUE LES 284 SERAIT UN PIÈGE.** Taper « saumon » et ne rien
trouver se lit « cet aliment n'existe pas » — le défaut exact que `chercherParNom` a été écrit pour
fermer (décision 58, 33 saisies mesurées). Le champ voit donc **les 451**, et un aliment qui
appartient à un groupe animal s'y coche **avec la sémantique du dépliant**, exception comprise.

⚠️ **UNE EXCLUSION QUI NE SE RETROUVE PAS EST UNE EXCLUSION QU'ON NE PEUT PAS DÉFAIRE.** Un aliment
retiré par la recherche disparaît du champ dès qu'on l'efface : sans une liste des retraits en cours,
la case est **en écriture seule** et il faut se souvenir du mot exact pour revenir dessus. C'est la
moitié du lot, pas un confort.

**Ce que le lot NE touche pas** : `engine/` (aucune couche, aucun score, le registre reste à 16),
`user-schema.ts` (aucune version, aucune migration), `catalog/` (aucun contenu), `ui/panneau.tsx`,
les sept groupes animaux et leur ordre, le panneau « Mes exceptions », et les allergènes — qui ne
passent pas par cet écran (garde-fou 1).

**Fini quand** — sept clauses, jouées dans le panneau RÉEL de l'écran Paramètres, contre
`app/public/catalog/catalog.db` (celui que `catalogueDeTest()` charge), jamais contre une fixture.
⛔ **Les listes d'aliments se DEMANDENT au catalogue, jamais écrites en dur dans le test** : un
effectif codé en dur a déjà cassé quatre tests à un lot de contenu.

1. ⛔ **AUCUN DES 451 N'EST INTROUVABLE EN TAPANT SON NOM — la clause qui décide du lot.** Pour
   **chacun** des 451 aliments, taper son `nom` exact dans le champ du panneau « Aliments que je ne
   veux pas » le fait apparaître dans les résultats. **Aujourd'hui 0 passe : le champ n'existe pas.**
2. ⛔ **AUCUN DES 451 N'EST INJOIGNABLE SANS RIEN TAPER.** Pour chacun, une suite de clics — déplier
   sa famille — l'affiche. C'est la moitié de la décision 58, celle qui a coûté 352 aliments sur 450.
   **Aujourd'hui 167 passent, 284 échouent.**
   ⛔ **ET C'EST UN PARCOURS PAR FAMILLES, PAS UN DÉCOUPAGE.** Trois formes fausses satisfont la
   lettre de la clause, et les trois sont refusées : un dépliant unique « Tous les aliments (451) »,
   **un bouton par aliment**, et — celle qui a réellement traversé une première version du test —
   **quatorze paquets de trente-trois aliments découpés dans l'ordre d'itération de la Map**, dont
   le compte tombait juste sans qu'aucun ne réunisse quoi que ce soit de reconnaissable. Le test
   exige donc **quatre** choses : au moins autant de portes que le catalogue a de familles (**14**),
   **au plus 14 + 7 + 3 = 24** (les familles, les groupes animaux, et une marge), aucun dépliant plus
   gros que la plus grosse famille (**74**), et surtout **un critère commun dans CHAQUE dépliant
   peuplé** — tous ses aliments partagent la même `Food.groupe`, ou le même groupe animal. Rien
   d'autre n'est accepté.
   ⛔ **ET LE PARCOURS COUVRE LES 451, PAS SEULEMENT LES 284.** Un aliment déjà atteignable par son
   groupe animal apparaît **aussi** dans sa famille : « je cherche du bœuf dans les viandes » ne doit
   pas dépendre de ce que le bœuf porte une origine animale. La clause 6 est ce qui rend cette
   troisième porte sans danger — un aliment, un état, quelle que soit la porte.
   ⚠️ **Un nom déjà affiché avant le premier clic ne compte pas comme atteint** — jsdom ne calcule
   aucun rendu, donc 451 lignes montées en permanence et masquées par une classe CSS se liraient
   « affichées » alors que personne ne les atteint.
3. **Cocher un aliment d'aucun groupe animal écrit son `food_id` dans `user_excluded_food`**,
   immédiatement au geste et non à la fermeture, et **rien** dans `user_excluded_group`.
   `readExcludedFoodIdsDeplies` le rend.
4. ⛔ **LE MOTEUR EN TIENT COMPTE — la chaîne complète, pas la case.** Retirer par cette porte un
   aliment porté par au moins une recette fait **baisser** le nombre de plats que `suggestMeals`
   propose. Une case qui bascule sans que le moteur bouge ne prouve rien : c'est déjà la clause qui
   compte pour les groupes.
5. **Un retrait se défait sans retaper.** Le panneau liste les aliments retirés un par un ; décocher
   depuis cette liste efface la ligne de `user_excluded_food` **et** fait remonter le compte de
   plats. ⚠️ Le champ vidé, la liste reste.
   ⚠️ **LA FORME DE CETTE LISTE EST LIBRE, ET C'EST ASSUMÉ** — plate ou dépliable, triée par nom ou
   par ordre de retrait. La seule contrainte est qu'elle soit **visible sans rien taper** : c'est ce
   qui empêche la case d'être en écriture seule. Le test ne discrimine que ça.
6. ⛔ **UN SEUL SENS PAR ALIMENT, ET SUR LES DEUX NOUVELLES PORTES.** Un aliment d'un groupe animal
   atteint par la recherche **ou par sa famille** se coche **exactement** comme dans le dépliant du
   groupe : si le groupe est retiré, le geste écrit une **exception** (`user_group_exception`) et non
   un retrait, et l'état de sa case est le même des deux côtés. Deux vérités pour le même aliment
   feraient dire au panneau une chose et à la base une autre.
   ⛔ **LES DEUX PORTES SONT TESTÉES SÉPARÉMENT, ET CE N'EST PAS DU ZÈLE.** Une première version ne
   jouait cette clause que par le champ de recherche : une implémentation qui figeait `groupeRetire`
   à `false` dans le seul parcours par familles — donc qui écrivait un **retrait** là où il fallait
   une **exception** — passait 9 assertions sur 11 sans être vue. La sémantique du groupe doit tenir
   sur la porte qu'on n'a pas pensé à tester.
7. ⛔ **UN SEUL `role="dialog"` À LA FOIS, ET RIEN À MIGRER.** Quel que soit le geste fait dans ce
   panneau, le document n'en contient jamais deux. Et après le lot, `user_excluded_group.groupe_id`
   accepte toujours ses **sept** valeurs et **elles seules**, version de `user-schema.ts` inchangée.

⚠️ **CE QUE CES SEPT CLAUSES NE DÉMONTRERONT PAS.** Qu'un champ de saisie et une liste de 74 légumes
soient utilisables au pouce sur un téléphone — hauteur de cible, clavier qui recouvre les résultats,
défilement d'une famille longue. jsdom ne mesure ni position ni hauteur. ▶ Cette vérification rejoint
la passe à l'œil de §3, elle ne s'y substitue pas.

#### Ce qui a été livré, et ce que les sept clauses n'ont pas attrapé

**Les sept clauses passent**, jouées contre `app/public/catalog/catalog.db` réel :
`tests/scelles/retour-2.test.tsx`, **12 tests**, mesurés seuls. Les 451 aliments sont atteignables
par le nom **et** par les familles ; les 284 qui ne portent aucune origine animale ne dépendent plus
d'un groupe pour exister. Le compte de portes tombe à **21** (14 familles + 7 groupes animaux), sous
le plafond de 24.

⛔ **UNE CLAUSE PASSAIT PENDANT QU'ELLE ÉTAIT FAUSSE, ET AUCUN TEST SCELLÉ NE POUVAIT LE VOIR.** La
clause 5 dit « un retrait se défait sans retaper ». Elle était vraie dans la configuration que le
test montait — aucun régime déclaré — et fausse dès qu'un régime plus strict rattrapait l'aliment
déjà retiré : la ligne devenait un texte mort « Déjà écarté par votre régime », donc un retrait
**indéfaisable**, écrit en base et impossible à reprendre. ⚠️ **Le défaut n'est pas dans le test,
il est dans le « Fini quand » : aucune des sept clauses ne fait varier le régime.** Les deux
relecteurs l'ont trouvé indépendamment, à la relecture, pas à l'exécution. Corrigé, et **verrouillé
par un test ordinaire** (`app/src/ui/screens/parametres.test.tsx`) vérifié rouge sans le correctif.
▶ La leçon générale — un « Fini quand » qui ne fait varier qu'une dimension — est en `ETAT.md` §8.

⚠️ **La passe à l'œil sur téléphone reste due** (§3 ci-dessus) : elle n'a pas été faite, et rien de
ce lot ne la remplace.

---

### Lot `retour-3` — « je mange dehors », et l'écran qui ne connaît pas la semaine ✅ **LIVRÉ le 2026-08-22**

**Commit : à écrire.** Le code, les tests scellés et les documents partent ensemble ; le hash se pose
dans le commit d'après, comme pour `retour-1b` et `retour-2`. ▶ Bilan et dette en fin de section.

**Ce que l'auteur a demandé (2026-08-21, décision 76) :** ⛔ **ses mots n'ont été retranscrits nulle
part.** Ni ici — ce document n'en portait qu'une ligne de tableau — ni dans `ETAT.md`, qui n'a que le
verdict : « **on ÉTIQUETTE le créneau.** Ni suppression, ni recalcul, ni trou. Le repas reste à sa
place et porte une marque. ⚠️ Distinct de la 75, et volontairement : un repas non mangé
**disparaît**, un repas pris dehors **reste visible**. » Les deux lots précédents ouvraient sur une
citation ; celui-ci n'en a aucune. **Ce qui suit interprète, et le signale chaque fois qu'il le
fait.**

⭐ **UNE PRÉCISION OBTENUE À L'OUVERTURE DU BRIEF, ET ELLE DOUBLE LE LOT (2026-08-22).** Question
posée : quand appuie-t-on sur « je mange dehors » — sur un repas à venir, ou sur le repas du jour ?
Réponse de l'auteur : **les deux.** Le geste vit donc sur **Semaine** *et* sur **Aujourd'hui**.

#### Ce qui a été mesuré avant d'écrire quoi que ce soit

⛔ **LE MÉCANISME QUE LA DÉCISION 76 DÉCRIT EXISTE DÉJÀ, ET IL TOURNE DEPUIS LE 2026-08-05.** C'est
la décision 51, « plat préparé, traiteur, repas au restaurant ». Rien n'a été deviné ici : le chemin
a été suivi ligne à ligne.

| Ce qui existe | Où | Depuis |
|---|---|---|
| l'état en base — `meal_plan_entry.hors_catalogue TEXT` | `user-schema.ts`, migration **v9** | 2026-08-05 |
| `CHECK (recipe_id IS NULL OR hors_catalogue IS NULL)` — **trois** états possibles, jamais quatre | même migration | 2026-08-05 |
| la transformation — `setSlotHorsCatalogue(plan, slot, libelle)` | `engine/planning/reroll-slot.ts:211` | 2026-08-05 |
| le chemin d'écriture depuis l'écran Semaine | `screens/semaine.tsx:390`, `poserHorsCatalogue` | 2026-08-05 |
| la porte visible — onglet « **Un plat préparé** », libellé libre | `ui/choisir-plat.tsx:144-160` | 2026-08-05 |
| l'affichage du créneau marqué + « Repas noté à la main — l'application ne connaît pas ce qu'il apporte. » | `screens/semaine.tsx:824-862` | 2026-08-05 |
| la sortie de la liste de courses | `engine/planning/shopping-list.ts:198` | — |
| l'absence de rappel pour ce créneau | `ui/rappel.ts:97` | — |
| l'extinction de l'alerte de plancher calorique sur cette journée | `createEngine` → `checkCalorieFloor` | — |

⚠️ **LES EXEMPLES AFFICHÉS DANS CETTE PORTE SONT DÉJÀ CEUX DE LA DÉCISION 76**, mot pour mot :
« Lasagnes surgelées », « **Restaurant italien** », « **Chez mes parents** ». Le besoin était vu ; il
manque le mot que l'auteur emploie, et le nombre de gestes qu'il coûte.

⛔ **CE QUI MANQUE VRAIMENT, MESURÉ, ET CE N'EST PAS CE QUE LA LIGNE DE TABLEAU LAISSAIT CROIRE.**

1. **Le mot « dehors » n'existe nulle part dans l'interface.** Quatre occurrences dans tout
   `app/src/ui/` : un attribut de test de portail, un commentaire sur un aliment resté dehors la
   nuit, un booléen de fenêtre dans `visite.tsx`, et un commentaire dans `semaine.tsx:592`. **Zéro
   texte affiché.** Qui cherche « je mange dehors » cherche « Un plat préparé ».
2. **Le geste coûte trois clics et une frappe** : « Choisir » → onglet « Un plat préparé » → taper →
   valider. Un repas au restaurant demande donc de composer une phrase au clavier.
3. **Le geste est indéfaisable.** `setSlotHorsCatalogue` remplace `recipeId` par `null` : le plat
   prévu est perdu. Rien à l'écran ne le rend. Se tromper de créneau coûte le plat.
4. ⛔ **ET SURTOUT — L'ÉCRAN AUJOURD'HUI NE CONNAÎT PAS LE PLAN DE LA SEMAINE.** Vérifié :
   `readPlan`, `readLatestPlan` et `savePlan` ont **zéro occurrence** dans
   `app/src/ui/screens/aujourdhui.tsx`. Cet écran lit l'historique sur 21 jours, le profil, les
   contraintes, le rythme et les réglages d'affichage ; il n'écrit **qu'une seule chose**, une ligne
   d'historique. Il n'y a pas « un bouton à ajouter » : **il n'y a pas de créneau en main.**

#### La contradiction entre la décision 51 et la décision 76, et comment on la lit

⛔ **ELLES NE DISENT PAS LA MÊME CHOSE, ET IL FAUT LE DIRE AVANT DE CODER.** La 76 écrit « le repas
reste à sa place ». La 51, telle qu'elle est implémentée, **efface le plat prévu** : `recipeId: null`,
`portions: 0`, et l'accompagnement du créneau est supprimé.

**Lecture A — le plat prévu SURVIT à côté de la marque.** ⛔ **ÉCARTÉE, et pas par confort.** Elle
exige que `recipe_id` et `hors_catalogue` soient non-nuls **ensemble**, donc de desserrer le `CHECK`
de la v9, donc une reconstruction de table et une migration de `user.db`. Et elle produit exactement
ce que la décision 51 a écrit noir sur blanc qu'il ne fallait pas produire : **deux champs capables
de se contredire**, sans qu'aucun ne soit le marqueur. Un créneau qui porterait « Gratin » *et*
« Restaurant italien » n'aurait plus de vérité.

**Lecture B — c'est le CRÉNEAU qui reste à sa place.** Pas de trou dans la semaine, aucun jour qui
se décale, aucun autre repas reproposé — et le créneau, bien visible, porte une marque au lieu d'un
plat. Sous cette lecture, la 51 et la 76 disent la même chose, et l'état existe déjà.
✅ **RETENUE.** ⚠️ **C'est une interprétation d'une décision d'une ligne, pas une parole de
l'auteur** — c'est le point de ce brief le plus susceptible d'être corrigé, et il est isolé ici pour
qu'il puisse l'être sans toucher au reste.

#### La forme retenue : un seul effet, deux portes

**Les deux écrans appellent la MÊME transformation sur le MÊME plan.** `setSlotHorsCatalogue` puis
`savePlan` puis `reprogrammerLesRappels` — le chemin que `semaine.tsx:390` emploie déjà. Aucune
fonction nouvelle dans `engine/`, aucune version de schéma, aucune migration.

Ce que le lot ajoute, et rien de plus :

1. **Le mot de l'auteur, sur le chemin.** « Je mange dehors » devient un texte visible, et le geste
   ne demande **aucune frappe** : le libellé par défaut est posé, et reste modifiable par la porte
   existante.
2. **Le geste se défait**, et rend le plat **exact** qui était prévu — `setSlotRecipe`
   (`reroll-slot.ts:143`) le repose sans tirage.
3. ⛔ **Aujourd'hui apprend à lire le plan de la semaine.** C'est le vrai travail du lot, et le seul
   endroit où il touche à la structure d'un écran. ⚠️ **Et si aucune semaine ne couvre le jour, il
   n'y a rien à marquer** — le geste ne doit alors ni mentir, ni fabriquer une semaine dans le dos
   de l'utilisateur (l'écran Semaine a mis un lot entier à cesser de le faire : « composer une
   semaine est un geste, jamais un effet de bord du montage »).

⛔ **ÉCARTÉ : UNE TROISIÈME VALEUR DANS `meal_history.origine`.** La table porte
`recipe_id TEXT NOT NULL` **dans sa clé primaire** : un repas sans recette n'y est pas représentable,
et la rendre nullable force une reconstruction de table et une v19. Et son propre en-tête dit
pourquoi ce serait faux quand même : « enregistre *ce plat a été retenu*, jamais *voici ce que tu as
mangé* ». L'historique nourrit `habit` et `variety`, deux couches indexées sur des recettes. **Un
repas pris dehors n'apprend rien au moteur sur les goûts** — et prétendre le contraire, c'est
inventer une donnée.

⛔ **ÉCARTÉ : UN QUATRIÈME BOUTON SUR LA CARTE DU CRÉNEAU.** Elle en porte déjà trois
(« Proposer »/« Changer », « Choisir », « Garder »/« Relâcher »), sur une carte qui doit tenir dans
la largeur d'un téléphone, et ils forment un jeu cohérent — deux gestes de choix, un verrou. **Le
« Fini quand » ne prescrit donc pas l'endroit** : il borne le **coût** (au plus deux clics, aucune
frappe) et laisse la forme au lot. Un bouton en tête de la fenêtre de choix satisfait la borne
aussi bien qu'un quatrième bouton.

⚠️ **CE QUE LE LOT NE TRANCHE PAS, ET QU'IL FAUDRA TRANCHER EN CODANT** : le libellé par défaut
exact (« Repas pris dehors » ? « Dehors » ?) ; l'endroit précis du geste sur chacun des deux écrans ;
si l'onglet « Un plat préparé » est renommé ou conservé tel quel à côté ; si le tutoriel
(`ui/parcours.ts`) gagne une étape. **Aucun de ces quatre points n'est observable par une clause**,
et les inventer en ferait des contraintes que personne n'a demandées.

⛔ **DEUX POINTS QUI SEMBLAIENT OUVERTS NE LE SONT PAS — ils se déduisent, et les laisser flous
coûterait un aller-retour. Écrits le 2026-08-22 après relecture adverse.**

1. **Le chemin court ÉCRIT DIRECTEMENT ; il ne traverse pas la fenêtre existante.** La déduction est
   arithmétique : passer par l'onglet « Un plat préparé » demande un clic pour ouvrir, un pour
   valider, et le champ y attend une frappe — le budget de deux clics est consommé avant même
   d'avoir un libellé, et la clause 1 interdit la frappe. ▶ **L'onglet existant reste la porte
   d'ÉDITION du libellé**, pour qui veut écrire « Chez ma sœur » ; le geste court, lui, pose un
   libellé par défaut sans rien demander. Les deux coexistent, ils ne se remplacent pas.
2. ⛔ **L'ANNULER DOIT SURVIVRE À UN REMONTAGE DE L'ÉCRAN — un état de composant NE SUFFIT PAS.**
   ⚠️ **CE PARAGRAPHE DISAIT L'INVERSE, ET IL AVAIT TORT ; corrigé le 2026-08-22, avant la première
   ligne de code, en RELISANT la clause plutôt qu'en s'en souvenant.** La clause 4 pose le geste,
   puis fait `cleanup()` et remonte l'écran **avant** de chercher l'annuler : tout `useState` de
   l'écran Semaine est effacé entre les deux. La mémoire du plat d'avant doit donc vivre **hors du
   composant** — et hors de la base, puisque la clause 8 interdit la colonne neuve et la migration.
   Il reste la portée du MODULE : elle survit à un remontage, elle meurt au rechargement.
   ▶ **Conséquence assumée, et c'est la réponse du lot : l'annuler est une commodité de SESSION.**
   Après un rechargement de l'application, le bouton d'annulation n'est plus proposé ; l'étiquette
   reste, et « Changer » comme « Choisir » restent les portes de sortie. ⚠️ **Aucune clause ne
   mesure ce cas-là** — il se relit à l'œil, pas en jsdom.
3. **`hors_catalogue` ne sert pas à mémoriser le plat d'avant.** C'est un texte destiné aux yeux de
   l'utilisateur. Où vit alors l'information dont l'annuler a besoin, **c'est au lot de le décider**
   — mais pas là, et pas dans une colonne neuve non plus (clause 8). ⚠️ **Question réelle et
   non tranchée ici** : elle appartient au codage, pas au brief.

⛔ **CETTE DÉCLARATION A ÉTÉ CORRIGÉE EN COURS DE LOT : `engine/` A ÉTÉ TOUCHÉ, D'UNE LIGNE, SUR
DÉCISION DE L'UTILISATEUR LE 2026-08-22.** Elle disait « `setSlotRecipe` est appelé **tel quel** ».
C'était vrai de l'intention et faux du code : `reposerLeCreneau` (`engine/planning/reroll-slot.ts`)
reconstruit l'entrée par `{ ...cible }` et **recopiait `horsCatalogue`**. Reposer un plat sur un
créneau étiqueté rendait donc une entrée portant un plat ET une étiquette — l'état que la migration
v9 interdit. Mesuré, pas supposé :
`APRES setSlotRecipe : recipeId=chou_blanc_pommes_terre_aneth horsCatalogue="Repas pris dehors"`
puis `savePlan : Error: CHECK constraint failed: recipe_id IS NULL OR hors_catalogue IS NULL`.
▶ **Ce défaut PRÉEXISTAIT au lot** : dans l'application livrée, « Changer » et « Choisir » lèvent
cette erreur sur tout créneau déjà marqué « Un plat préparé » (décision 51), sans « je mange
dehors ». La clause 4 n'a pas créé le trou, elle est tombée dedans. Corrigé au moteur plutôt qu'à
l'écran : c'est le moteur qui décrit le créneau, et un créneau ne peut pas être les deux à la fois.
⚠️ Un contournement à l'écran aurait rendu la clause 4 verte en laissant le plantage atteignable par
l'autre chemin — celui que ce lot ne traverse pas. C'est exactement ce qui a été écarté.

**Ce que le lot NE touche pas** : `engine/` — aucune fonction nouvelle, aucune couche, aucun score ;
**une seule ligne modifiée**, `horsCatalogue: null` dans `reposerLeCreneau`, voir le ⛔ ci-dessus ·
`setSlotHorsCatalogue` est appelé **tel quel** · `user-schema.ts` — version
**18** inchangée, aucune migration, aucun `CHECK` modifié · `meal_history` et ses deux origines
`choisi`/`reste` · `catalog/` — aucun contenu, donc **ni `catalog/build.mjs` ni
`catalog/audit-mapping.mjs` ne sont des témoins de ce lot** · le code de la liste de courses, des
rappels et de l'alerte de plancher : **c'est le plan qui change sous eux**, pas eux · le libellé
libre de l'onglet « Un plat préparé », qui reste la porte de qui veut nommer son repas · les deux
autres onglets de la fenêtre de choix.

**Fini quand** — neuf clauses, jouées sur les **écrans réels**, contre `app/public/catalog/catalog.db`
(celui que `catalogueDeTest()` charge) et une `user.db` réelle, jamais contre une fixture.

⛔ **DEUX RÈGLES DE JEU S'APPLIQUENT À TOUTES LES CLAUSES, ET ELLES VIENNENT D'UNE DETTE.** Le
« Fini quand » de `retour-2` ne faisait varier **qu'une seule dimension** et une clause est restée
verte en étant fausse (`ETAT.md` §8). Donc, ici :

- **Les réglages persistants que ces deux écrans lisent sont nommés** : `user_rythme`
  (`repasParJour`, qui décide **quels créneaux existent**), `user_profile`, les contraintes
  (allergies, régime, exclusions), `user_display`, et la fenêtre d'historique de 21 jours.
  ⛔ **Les clauses font varier `repasParJour` — 2 et 3 — et rien d'autre n'est laissé au hasard.**
  Sur un rythme à 2 repas, la journée n'a **pas** de petit-déjeuner : marquer « dehors » ne doit
  jamais créer un créneau qui n'existe pas au plan.
  ⚠️ **Cette ligne disait « 2 et 4 » ; c'était FAUX, et c'est le test qui l'a dit.** `user_rythme`
  porte `CHECK (repas_par_jour BETWEEN 1 AND 3)` (`user-schema.ts:356`) : écrire 4 lève une
  contrainte, et `creneauxDuRythme` retombe silencieusement sur 2 hors de cette plage. **2 et 3 sont
  les deux seules valeurs qui changent vraiment la liste des créneaux** — 3 ajoute le goûter.
- **L'heure est figée par le test.** Aujourd'hui choisit le créneau affiché par `creneauDuMoment`,
  qui lit l'horloge : une suite verte à 14 h et rouge à 23 h serait une suite qui ne mesure rien.

1. ⛔ **LE GESTE EXISTE SUR LES DEUX ÉCRANS, SANS UNE SEULE FRAPPE — la clause qui décide du lot.**
   Depuis Semaine (sur un créneau) **et** depuis Aujourd'hui, une suite d'**au plus deux clics**, et
   **aucun événement de saisie**, pose le repas hors catalogue. Mesuré **en base**, par relecture du
   plan (`readLatestPlan`) et non dans l'état React : le créneau visé porte `horsCatalogue` non vide
   et `recipeId === null`. Et le mot **« dehors »** est affiché sur le chemin, sur chacun des deux
   écrans. **Aujourd'hui : 0 des deux passe** — trois clics et une frappe sur Semaine, rien du tout
   sur Aujourd'hui.
   ⚠️ **Le test ne clique que du texte visible et n'appelle jamais `fireEvent.change`** : c'est ce
   qui rend « sans frappe » falsifiable plutôt que déclaratif.
   ⛔ **ET LE LIBELLÉ ÉCRIT EN BASE EST CELUI QU'ON LIT SUR LA CARTE, AU CARACTÈRE PRÈS. Ajouté le
   2026-08-22 après relecture adverse.** Aucune migration n'étant permise (clause 8), il n'existe
   aucune colonne où ranger « quel plat il y avait avant » pour le rendre à l'annuler — d'où la
   tentation d'encoder l'identifiant DANS le libellé (« `Dehors§poulet_curry` » en base, « Dehors »
   à l'écran) et de le redécouper. ▶ **`hors_catalogue` est un texte libre écrit et relu par
   l'utilisateur, pas un canal de stockage technique** : la clause relit donc l'écran Semaine et
   exige d'y retrouver la valeur exacte de la base. **Mesuré** : la carte affiche aujourd'hui le
   champ brut, la vérification ne produit donc aucun faux échec. ⚠️ Elle se lit « la carte
   contient le libellé » et non « la carte égale le libellé » : le décor autour reste libre.

2. ⛔ **NI TROU, NI RECALCUL — le cœur de la décision 76, et la clause anti-débordement du lot.**
   Après le geste, le plan porte **exactement autant d'entrées principales** qu'avant, aux **mêmes**
   `(date, creneau)`, et **tout autre créneau que celui visé porte le même `recipeId` qu'avant**,
   au même `locked` et au même `isLeftover`. Comparaison de la liste **entière**, pas d'un
   échantillon. ▶ **Ce qui la rendrait fausse** : une implémentation qui recompose la semaine, ou
   qui retire l'entrée au lieu de la marquer.

3. ⛔ **L'ACCOMPAGNEMENT A DISPARU AVEC LE PLAT, ET L'ENTRÉE RESTANTE A LA BONNE FORME.** Sur un
   créneau qui portait un **accompagnement**, celui-ci n'est plus là après le geste, et le créneau
   ne porte plus qu'**une** entrée — qui annonce **zéro portion**, aucun plat, aucun reste, aucun
   verrou, et un libellé non vide.
   ⛔ **LA MOITIÉ « ZÉRO PORTION » A ÉTÉ AJOUTÉE LE 2026-08-22, APRÈS UNE SECONDE RELECTURE
   ADVERSE, ET LE TROU ÉTAIT RÉEL — mesuré, pas supposé.** Aucune des neuf clauses ne relisait
   `portions` sur le chemin ALLER : une écriture fabriquée à la main pouvait retirer
   l'accompagnement, vider le plat, poser le libellé, et **laisser `portions` à 4**. Personne ne
   l'aurait vu — la liste de courses filtre sur « pas de plat », le plancher calorique lit
   l'étiquette, et l'annuler de la clause 4 rétablit la valeur du catalogue, **la même**. Le trou se
   refermait tout seul au retour. ⚠️ `setSlotHorsCatalogue` documente pourtant l'invariant en
   toutes lettres — « ZÉRO PORTION, et ce n'est pas "zéro assiette" ». C'est le comportement que `setSlotHorsCatalogue` documente déjà — « lui adjoindre du riz
   choisi par le moteur reviendrait à compléter nutritionnellement une assiette dont on ne connaît
   pas le contenu ». ▶ **Ce qui la rendrait fausse** : un `savePlan` bricolé qui poserait
   `hors_catalogue` sans rien retirer — l'accompagnement resterait, et le créneau porterait deux
   entrées dont une seule est mesurable.
   ⚠️ **CETTE CLAUSE S'INTITULAIT « L'ÉCRITURE PASSE PAR LE MOTEUR » ET SE DISAIT « L'ANTI-TRICHE
   PRINCIPALE ». Corrigé le 2026-08-22 après relecture adverse : elle promettait plus qu'elle ne
   mesure.** Elle observe un **état final**, pas un appel de fonction — une implémentation qui
   redupliquerait correctement la logique de `reroll-slot.ts` sans appeler `setSlotHorsCatalogue`
   passerait. ⛔ **Et c'est volontaire : vérifier QUELLE fonction a été appelée, c'est tester
   l'implémentation, pas le comportement** — le test se mettrait alors à refuser un refactor
   légitime. Ce que cette clause tue, c'est le raccourci ; la duplication fidèle relève de la
   relecture, pas d'un oracle.

4. ⛔ **LE GESTE SE DÉFAIT, ET IL REND LE PLAT EXACT — PAS UN AUTRE.** Au plus deux clics ramènent le
   créneau à son `recipeId` d'avant, à l'identique, et `horsCatalogue` redevient `null`. Vérifié sur
   **trois créneaux pris sur trois jours différents** : un tirage qui retomberait trois fois de
   suite sur le plat exact n'est pas crédible, et c'est précisément la triche que cette répétition
   ferme. ⚠️ **L'accompagnement, lui, a le droit de différer** — `setSlotRecipe` le recalcule, c'est
   son comportement écrit (« l'accompagnement se recalcule avec le plat, il ne survit pas au
   changement »). La clause exige donc la **cohérence** — `service` vaut `'plat'` si et seulement si
   une seconde entrée suit — et non l'identité de l'accompagnement.
   ⛔ **ELLE NE VÉRIFIAIT QUE DEUX CHAMPS, ET DEUX CHAMPS NE SUFFISENT PAS. Ajouté le 2026-08-22
   après relecture adverse.** Rendre `recipeId` et remettre `horsCatalogue` à `null` à la main, sans
   repasser par le moteur, laisse **`portions` à zéro** — `setSlotHorsCatalogue` l'y avait mis, et
   personne ne l'en sort. **Mesuré** sur le plan de test : le rapiéçage rend **0 portion** là où le
   moteur en rend **4** (le `portionsBase` de la recette). Un plat « restauré » à zéro portion ne
   remplit ni la liste de courses ni les restes : invisible à qui ne regarde que deux champs,
   immédiat au premier usage réel. La clause exige donc aussi les **portions que le catalogue
   annonce pour cette recette**, `isLeftover` à faux, et le verrou inchangé.

5. ⛔ **LA LISTE DE COURSES BAISSE, ET AUCUNE LIGNE NE MONTE.** Liste reconstruite avant et après le
   geste sur un créneau qui portait une recette : **au moins un ingrédient** disparaît ou voit son
   grammage baisser, et **aucun** ingrédient ne voit le sien augmenter ni n'apparaît. ▶ Formulée en
   un seul sens exprès : « rien ne monte » attrape aussi bien un masquage à l'écran (rien ne
   bougerait) qu'un recalcul de la semaine (quelque chose monterait).

6. **Aucun rappel pour ce créneau, et les autres survivent intacts.** Après le geste, les rappels du
   plan ne contiennent rien pour le créneau visé, et l'ensemble des rappels des autres créneaux est
   **identique** à celui d'avant. ▶ Faux si l'écran oublie de reprogrammer : l'appareil sonnerait
   encore pour le plat qu'on vient de remplacer.

7. **Aucune journée ne GAGNE d'avertissement de plancher calorique.** L'ensemble des journées
   averties après le geste est **inclus** dans celui d'avant. ▶ Un seul sens, là encore : une journée
   dont un repas devient immesurable ne peut que perdre son alerte, jamais en acquérir une.

8. ⛔ **RIEN DANS L'HISTORIQUE, RIEN À MIGRER.** Le geste, depuis l'un ou l'autre écran, n'ajoute
   **aucune ligne** à `meal_history`. Et après le lot : `USER_SCHEMA_VERSION` vaut toujours **18**, et
   le `CHECK` de `meal_plan_entry` accepte toujours ses **trois** états et eux seuls — recette seule
   ✅, libellé seul ✅, vide ✅, **les deux ensemble refusés** (vérifié par un `INSERT` direct qui doit
   lever). ▶ Cette clause est le garde-fou contre la lecture A : elle rougit le jour où quelqu'un
   desserre le `CHECK` « pour pouvoir garder le plat à côté ».

9. ⛔ **SANS SEMAINE COMPOSÉE, LE GESTE N'INVENTE RIEN.** Sur un compte neuf, aucun plan en base :
   après toute suite de clics sur le chemin « dehors » d'Aujourd'hui, `readLatestPlan` rend
   **toujours `null`** et l'écran ne lève pas. ▶ Faux si le geste compose une semaine de sept jours
   pour avoir un créneau à marquer — c'est le défaut exact que l'écran Semaine a mis un lot à fermer.
   ⛔ **CETTE CLAUSE EST LA SEULE DES NEUF QUI SOIT VERTE AUJOURD'HUI, ET ELLE L'EST PAR VACUITÉ.**
   Mesuré : elle passe aux deux rythmes, parce qu'aucun chemin « dehors » n'existe sur Aujourd'hui
   — on ne peut pas fabriquer un plan par un geste qui n'est pas là. **Elle ne discrimine qu'à
   partir du moment où la clause 1 est verte** ; d'ici là, elle ne prouve rien, et l'inscrire au
   compte des clauses tenues serait se mentir. ▶ Elle est écrite maintenant parce qu'écrite après,
   elle serait écrite pour passer.

⚠️ **UNE MOITIÉ DE LA CLAUSE 7 EST DÉJÀ TENUE PAR LE MOTEUR, ET ÇA NE LA REND PAS INUTILE.**
`guards/index.ts:212` marque déjà la journée `immesurable` dès qu'une entrée porte un
`horsCatalogue`, donc l'avertissement de plancher ne peut pas naître là. Ce que la clause continue
de tuer, c'est l'implémentation qui **supprimerait** l'entrée au lieu de l'étiqueter, ou qui
poserait un **autre** marqueur : dans les deux cas la journée redevient mesurable et gagne l'alerte.

⚠️ **ÉCART DE SPÉC TROUVÉ EN MESURANT, À TRANCHER AVANT DE CODER — PAS PENDANT.** Marquer un plat
« dehors » laisse en place **les restes qui en dépendent** : sur le plan de test, le plat du
2026-03-12 est resservi les 13 et 14, et ces deux créneaux continueraient de renvoyer à un repas
jamais cuisiné. C'est **conforme** à la décision 76 (« ni recalcul ») et la clause 2 l'exige
même, puisqu'elle interdit de toucher aux autres créneaux. ▶ Aucune des neuf clauses ne le traite,
et c'est délibéré : ce serait étendre le lot. ⇒ **Question ouverte, pas dette silencieuse.**

⚠️ **CE QUE CES NEUF CLAUSES NE DÉMONTRERONT PAS.** Que le geste se **trouve** sur un téléphone. Une
borne à deux clics dit le coût du chemin une fois qu'on le connaît, pas qu'un pouce le rencontre.
jsdom ne mesure ni position, ni hauteur, ni l'ordre de lecture d'une carte. ▶ Cette vérification
rejoint la passe à l'œil de §3, elle ne s'y substitue pas — et pour ce lot elle est plus lourde que
d'habitude, puisque la moitié du travail est de rendre visible quelque chose qui existait déjà.

#### Les témoins d'avant — mesurés le 2026-08-22, arbre du brief (`6aad49c`)

| Commande | Avant le lot |
|---|---|
| `npm test` | **2 376 passed / 0 failed (125 fichiers)** en 43,1 s |
| `npm run typecheck` | propre |
| `npx vite build` | ✓ 2,86 s |
| `npm run engine:plan-stress` | **20/20** |
| `USER_SCHEMA_VERSION` | **18** (dernière migration : v18, `user_equipment.quantite`) |

⚠️ **`catalog/build.mjs` et `catalog/audit-mapping.mjs` ne sont PAS des témoins de ce lot** — aucun
contenu ne bouge. Le relevé du catalogue reste celui du 2026-08-20.

#### Les témoins d'après — mesurés le 2026-08-22, sur l'arbre qu'on commite

| Commande | Après le lot |
|---|---|
| `npm test` | **2 392 passed / 0 failed (126 fichiers)** en 50,1 s |
| `npm run typecheck` | propre |
| `npx vite build` | ✓ 3,01 s |
| `npm run engine:plan-stress` | **20/20** |
| `USER_SCHEMA_VERSION` | **18** — inchangé, aucune migration (clause 8) |

✅ **L'ÉCART 2 376 → 2 392 EST ATTRIBUÉ FICHIER PAR FICHIER, PAS DÉDUIT.** **+13** pour
`tests/scelles/retour-3.test.tsx`, fichier neuf — c'est le 126ᵉ — et **+3** pour
`app/src/engine/planning/plan-week.test.ts`, qui passe de **59** à **62**. 13 + 3 = 16, et les deux
comptes ont été relevés en lançant ces fichiers **séparément**. Aucun autre test n'a bougé.
⚠️ **Le piège de `retour-2` a été revérifié ici** : aucun fichier de test paramétré par une table de
production n'est touché par ce lot — `PARCOURS` n'a pas bougé.

#### Ce que la relecture a changé — quatre points, trois corrigés

Le lot a été relu par un tiers **avant** d'être déclaré fini, sur l'arbre complet. Verdict initial :
**pas prêt à merger**. Ce qui suit dit ce qui a été fait de chacun des quatre points, y compris de
celui qui ne l'a pas été.

⛔ **1. L'écran pouvait revenir en arrière tout seul — CORRIGÉ.** Sur Aujourd'hui, les deux gestes
partaient d'une vue capturée au clic et reposaient l'état sans regarder. Changer de créneau pendant
l'écriture ramenait donc le repas d'avant sous les yeux de l'utilisateur, sans qu'il ait rien
demandé. L'état n'est plus reposé que si la vue n'a pas bougé — même garde que le drapeau `annule`
de `rafraichir`, qui existait déjà dix lignes plus haut. ⚠️ **L'ÉCRITURE EN BASE, ELLE, PART QUAND
MÊME** : `ETAT.md` §8.

⛔ **2. Défaire le geste sur un RESTE rendait un plat neuf — CORRIGÉ, en refusant le geste plutôt
qu'en le truquant.** `reposerLeCreneau` repose toujours avec les portions du catalogue et sans
marque de reste : le retour aurait rendu un plat à portions pleines et fait remonter des
ingrédients d'un plat déjà cuisiné. La mémoire ne retient donc plus que ce qu'elle sait rendre À
L'IDENTIQUE, et le bouton disparaît dans les autres cas. ⚠️ **LE TEST SCELLÉ NE COUVRE PAS CE
CAS** — ses cibles excluent les restes. Dit en toutes lettres dans `ETAT.md` §8, avec ce qu'il
faudrait au moteur pour lever la restriction.

⛔ **3. Un vivier épuisé effaçait l'étiquette sans rien mettre à la place — CORRIGÉ.** La
correction moteur décrite plus haut effaçait `horsCatalogue` à chaque reconstruction, y compris
quand AUCUN plat n'avait pu être tiré. Le créneau sortait alors vide **et** dépouillé de ce que
l'utilisateur avait déclaré — et « Changer » n'est filtré sur aucun créneau marqué. L'étiquette
n'est désormais effacée que **si un plat prend la place**. Un troisième test moteur le garde
(59 → 62 tests, dont ce cas).

⛔ **4. Aucune sortie depuis Aujourd'hui quand rien n'était en mémoire — CORRIGÉ.** Après un
rechargement, sur un créneau déjà vide ou sur un reste, l'écran n'affichait que l'étiquette et le
repas devenait un cul-de-sac. Il renvoie maintenant vers la Semaine — un lien, pas un bouton : il
n'écrit rien, et ne compte donc pas dans les deux clics de la clause 1.

---

### Les lots suivants — non ouverts

Dans l'ordre des dépendances, tels qu'ils sortent des décisions 71 à 80 (`ETAT.md` §4) :

| Lot | Ce qu'il fait | Bloqué par |
|---|---|---|
| `retour-2` | le sélecteur d'exclusion s'ouvre aux 451 aliments (décision 73) | ✅ **LIVRÉ le 2026-08-22** |
| `retour-3` | « je mange dehors » étiquette le créneau (décision 76) | ✅ **LIVRÉ le 2026-08-22** — section ci-dessus |
| `retour-4` | l'action « les restes de… » et le décalage émergent (décision 78) | rien |
| `retour-5` | la catégorie « plat simple » au catalogue (décision 72) | rien — lot de contenu |
| `retour-6` | les filtres d'envie deviennent durs sur Aujourd'hui (décision 71) | **`retour-1`** et **décision 79** |
| `retour-7` | le frigo ne vaut plus que pour un repas (décision 74) | **décision 80** |
| `retour-8` | effacer un repas passé (décision 75) | le sort des restes orphelins |

⚠️ **`retour-6` est bloqué par `retour-1` pour une raison de fond, pas de confort** : voir plus haut.
