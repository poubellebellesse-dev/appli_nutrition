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

### Lot `retour-1b` — le tutoriel qui traverse les menus 🔒 **NON OUVERT**

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

1. un parcours composé qui entrelace `ETAPES_MENUS` et les parcours d'écran ;
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

⛔ **CE LOT TOUCHE AU COMPOSANT QUI JOUE LES TUTORIELS, pas seulement à leur contenu.** Ce n'est pas
de l'affichage : c'est du comportement, et `premierIndexValide` est un garde-fou volontaire contre
le « tutoriel fantôme » (règle 1 de l'en-tête de `parcours.ts`). Le desserrer sans le remplacer
rouvrirait exactement ce qu'il ferme.

⚠️ **NE PAS CONFONDRE AVEC LA LISTE DE RÉGLAGES.** « Revoir un tutoriel » liste les neuf parcours
séparément, et **cette liste n'est pas ce que l'auteur visait** — vérifié auprès de lui le même jour,
après une première interprétation fausse de ma part. Les neuf parcours individuels restent lançables
un par un ; ce lot ajoute un dixième chemin, il n'en supprime aucun.

---

### Les lots suivants — non ouverts

Dans l'ordre des dépendances, tels qu'ils sortent des décisions 71 à 80 (`ETAT.md` §4) :

| Lot | Ce qu'il fait | Bloqué par |
|---|---|---|
| `retour-1b` | **le tutoriel traverse les menus au lieu d'être neuf tutoriels séparés** (décision 81) | rien |
| `retour-2` | le sélecteur d'exclusion s'ouvre aux 451 aliments (décision 73) | rien |
| `retour-3` | « je mange dehors » étiquette le créneau (décision 76) | rien |
| `retour-4` | l'action « les restes de… » et le décalage émergent (décision 78) | rien |
| `retour-5` | la catégorie « plat simple » au catalogue (décision 72) | rien — lot de contenu |
| `retour-6` | les filtres d'envie deviennent durs sur Aujourd'hui (décision 71) | **`retour-1`** et **décision 79** |
| `retour-7` | le frigo ne vaut plus que pour un repas (décision 74) | **décision 80** |
| `retour-8` | effacer un repas passé (décision 75) | le sort des restes orphelins |

⚠️ **`retour-6` est bloqué par `retour-1` pour une raison de fond, pas de confort** : voir plus haut.
