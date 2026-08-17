# Photos de recettes — montage et cadrage

> Document de chantier. **L'état chiffré vit dans `ETAT.md`**, pas ici : cette page ne porte que
> le plan et les critères d'acceptation des lots. Le tri lui-même (barème, décisions, outils) vit
> dans `atelier/photos/REPRISE.md`, hors dépôt.
> ⛔ **LES LOTS DE CE CHANTIER S'APPELLENT « lot photo N » DEPUIS LE 2026-08-17, ET C'EST STRUCTUREL :**
> ils s'appelaient « Lot 1/2/3 », exactement comme ceux des gestes illustrés, et `.claude/lots.json`
> résout un identifiant en prenant **le premier trouvé**, sans le dire — `/fin` a fermé le mauvais
> lot une fois pour cette raison. ⚠️ **`tests/scelles/photo-affichage.test.ts` et
> `photo-fiche-detail.test.tsx` citent encore « lot 1 » et « lot 3 » dans leurs commentaires** : ils
> sont scellés, et on ne rouvre pas un test scellé pour une question de nom.

## Pourquoi ce document existe

La chaîne de la photo est branchée depuis longtemps — `catalog/recipes/*.yaml` → colonne
`image_path` (`build.mjs`) → `catalog-loader.ts` → `Recipe.imagePath` — et
`catalog/import-photos.mjs` la remplit. **Il n'a jamais manqué que le dernier maillon : personne
ne LIT `imagePath` dans `app/src/ui/`.** 116 photos sont livrées dans le paquet, comptent dans son
poids, et aucune n'a jamais été affichée.

⚠️ **Ce n'est pas le piège habituel « un champ déclaré n'est pas un champ branché », c'est son
exact opposé** : le champ est rempli ET chargé ET typé. C'est le rendu qui manque. Trois
commentaires de code affirmaient l'inverse (`vignette.ts:3`, `aujourdhui.tsx:16`,
`detail-recette.tsx:14`, `export-recette.ts:5` — « `imagePath` vaut `null` sur les 241 recettes »),
et ils ont induit en erreur une lecture du 2026-08-13. Ils datent tous d'avant le premier import.

## Ce que la mesure dit, au 2026-08-13

| | |
|---|---|
| Recettes au catalogue | 330 |
| Photos tranchées `oui` et importables (`--dry`) | **129** |
| Photos réellement sur le disque | **116** |
| Écart | **13, décidées et jamais importées** — il suffit de relancer l'import |
| Photos portant un cadre carré posé à l'atelier | **1** sur 129 |

⚠️ **L'outil de cadrage existe (`atelier/photos/serveur.mjs:66`) mais n'a servi qu'une fois.**
Brancher le cadre à l'import ne rend donc pas les photos carrées : ça rend le cadrage *effectif*
le jour où il est posé. La seule photo cadrée est `hareng-pommes-terre-tiedes`, et elle fait
partie des 13 jamais importées — donc aujourd'hui le cadre ne s'applique à **rien du tout**.

⚠️ **Le carré n'est pas décidé pour toutes les photos, et il ne doit pas l'être par défaut.** Un
recadrage centré automatique sur les 128 sans cadre couperait l'assiette sans qu'un œil l'ait vu,
et alourdirait le paquet contre un critère P6 déjà dépassé (décision 68, `ETAT.md` §4). Le passage
au carré s'est mesuré à **×1,5 à ×2,0** sur les clips de gestes. Écarté explicitement.

## Lot photo 1 — l'affichage, et le cadre honoré ✅ **LIVRÉ le 2026-08-13**

**Commité en `f3d4fa1`**, branche `lot/photo-affichage` (worktree `../wt-photo-affichage`).
⚠️ **PAS ENCORE FUSIONNÉ dans `main`** — le lot est vert seul, ce qui ne prouve pas qu'il est vert
ensemble. Les quatre commandes se relancent sur l'arbre principal APRÈS le merge, pas avant.
Vérifiable : `git log --all -S rectangleDuCadre --oneline`.

**Le « Fini quand » est démontré en entier** par `tests/scelles/photo-affichage.test.ts`, 7/7 vert :
129 `image_path` non nuls, chacun sur un fichier présent, aucune image orpheline, la photo cadrée
carrée, une photo non cadrée restée à son ratio, l'écran qui rend un `<img>`, l'aplat qui subsiste.

⛔ **MAIS LA MOITIÉ « CADRAGE » N'EST DÉMONTRÉE QUE SUR UNE PHOTO, ET C'EST TOUT CE QU'ELLE PEUT
PROUVER AUJOURD'HUI** — le gisement de cadres en contient exactement un. Le code est exercé par
5 tests unitaires (`rectangleDuCadre` : fractions→pixels, indépendance à la résolution, débordement
borné, cas nuls, entrée abîmée), mais **la chaîne complète cadre→fichier carré n'a qu'un seul
témoin réel**. Même famille que la moitié non mesurée du lot D3 : on l'écrit au lieu de la laisser
se deviner.

⚠️ **Deux découvertes de mesure, aucune n'était au plan** :
- **13 photos étaient tranchées et importables depuis un moment, jamais importées.** Le passage de
  116 à 129 ne vient pas du lot, il vient d'avoir relancé l'import. Le lot n'a fait que le rendre
  visible.
- **« Photo à venir » s'affichait sans condition** sous le titre de la carte, et devenait faux
  au-dessus d'une vraie photo. Le seul test qui lisait cette mention passait parce que le premier
  plat suggéré n'avait pas de photo ce jour-là — un test qui pariait sur le contenu, pas sur le
  comportement. Réécrit pour piloter jusqu'au plat voulu, et doublé d'un test qui parcourt la liste
  entière et exige que chaque carte affiche ce que la base annonce, ni les deux ni rien.

**Poids** : les photos livrées passent de 4,12 à **4,9 Mo** (129 fichiers). À reporter au dossier de
la décision 68, qui se mesure sur `dist/` et non sur ce dossier.

### Ce que le lot contenait

Deux moitiés qui se livrent ensemble parce qu'elles se relancent avec la même commande d'import.

1. **L'écran lit `imagePath`.** Là où `ui/vignette.ts` tient la place par un aplat de couleur —
   `aujourdhui.tsx:538` (carte plein écran, « photo dominante » §4.1 DESIGN) et `:772` (les
   vignettes « plats proches ») — une recette pourvue rend sa photo. L'aplat reste le repli des
   201 recettes sans photo : il ne disparaît pas, il cesse d'être le seul cas.
2. **L'import honore le cadre.** `catalog/import-photos.mjs` applique `sharp.extract()` avant le
   redimensionnement quand la décision porte un `cadre`, et ne change rien quand elle n'en porte
   pas.

**Fini quand** : `catalog.db` porte **129** `image_path` non nuls, chacun désignant un fichier
réellement présent dans `app/public/catalog/images/`, sans aucun `.avif` orphelin ; l'écran
Aujourd'hui rend une balise `<img>` sur une recette pourvue et conserve l'aplat `aria-hidden` sur
une recette qui ne l'est pas ; et `hareng-pommes-terre-tiedes` — seule des 129 à porter un cadre —
sort **carré**, quand une photo non cadrée garde le ratio de sa source.

**Ce que le lot ne touche pas** : le moteur, le catalogue de recettes (aucun YAML édité à la main —
`image_path` reste écrit par le seul script d'import), les 201 recettes sans photo, la galerie
(`Recipe.imagePath` est UNE chaîne, une galerie exige une table `recipe_image` — hors lot), et
`detail-recette.tsx`, dont l'en-tête déclare la photo hors de son périmètre. Ce dernier point est
le candidat évident du lot suivant.

## Lot photo 2 — poser les 128 cadres manquants

Pas du code : une passe de tri à l'atelier, une photo à la fois, validée par l'utilisateur. Elle ne
devient utile qu'une fois le lot photo 1 livré, puisque le cadre ne fait rien avant.

**Fini quand** : chaque photo servie porte un cadre posé à la main, ou une raison écrite de ne pas
en porter.

## Lot photo 3 — la photo sur la fiche détail — ✅ LIVRÉ le 2026-08-17 · commit `77ca4dc` sur `main`

⚠️ **Ce hash a été écrit APRÈS le commit, pas avant.** Cette ligne a d'abord dit « sans hash : le lot
est vert dans l'arbre de travail, il n'est pas commité » — c'était une information, pas un oubli.
▶ Motif : §8 d'`ETAT.md`, « Un lot vert SEUL n'est pas un lot livré ».

**Relevé sur l'arbre livré** : `npm test` **2 204 passed / 117 fichiers** (2 181 → **+23**, tous
dans `photo-fiche-detail.test.tsx`, **+1 fichier**) · `typecheck` propre · `vite build` ✓ 2,92 s ·
`engine:plan-stress` **20/20**. Catalogue non relancé : le lot n'a touché aucun YAML, le compte
reste à **129 sur 330**.

**Ouvert le 2026-08-17.** Le lot photo 1 nommait lui-même `detail-recette.tsx` « le candidat évident du
lot suivant ». C'est le dernier écran qui montre un plat sans jamais montrer sa photo — et c'est
celui qu'on lit debout, mains occupées, §4.6 DESIGN.

⚠️ **RIEN À INVENTER : LE MOTIF EXISTE ET IL EST LIVRÉ.** `aujourdhui.tsx` pose déjà les deux cas —
photo `h-[40vh] min-h-[12rem] w-full object-cover`, `alt=""` + `aria-hidden`, `decoding="async"` et
**pas** de `loading="lazy"` puisqu'elle est la première chose visible ; aplat de `ui/vignette.ts`
sinon, à la même hauteur. Ce lot APPLIQUE ce motif, il n'en conçoit pas un second. Un deuxième
traitement de la même image sur deux écrans serait la vraie faute.

⚠️ **UNE DÉCISION QUI TRAÎNAIT SE FERME ICI**, et elle est écrite pour être contestée : `ETAT.md` §8
laissait ouvert « le repli tient-il en PLEINE PAGE sur la fiche détail ? — il a été jugé sur une
carte, pas sur un écran entier ». **Réponse retenue : oui, à l'identique.** La carte plein écran
d'« Aujourd'hui » a déjà exactement cette taille, l'aplat y est jugé depuis le 2026-08-13, et les
**201** recettes sans photo ne peuvent pas rester sur un écran vide. ⛔ Ce qui est refusé, en
revanche : une mention « Photo à venir » sur la fiche détail — elle existe sur la carte du jour, où
elle informe l'auteur du catalogue ; répétée sur l'écran qu'on lit en cuisinant, elle ne fait que
signaler un manque à quelqu'un qui cuisine.

**Fini quand** : sur le `catalog.db` réel — **129** recettes pourvues, **201** sans, **330** en tout
— la fiche détail montée pour **cinq** recettes pourvues — les trois prises aux extrémités et au
milieu de l'ordre des identifiants, **plus les deux dont le chemin ne se déduit pas de leur
identifiant** — rend une balise `<img>` dont le `src` est **exactement** l'`image_path` de cette
recette-là, dont l'`alt` est **la chaîne vide** et qui porte `aria-hidden="true"` ; cette image
précède le `<h1>` du nom dans l'ordre du document, ne porte **pas** `loading="lazy"`, et porte
`decoding="async"` ; la même fiche montée pour **deux** recettes sans photo ne rend **aucune**
balise `<img>` et affiche à la place l'aplat, **de la couleur exacte que rend `couleurDeRecette`
pour cet identifiant**, `aria-hidden` lui aussi et **placé avant le `<h1>`, exactement là où la
photo serait** ; et aucune de ces sept fiches n'affiche « Photo à venir ».

**Ce qui rendrait ce « Fini quand » faux** : un `<img>` posé sur une recette sans photo ; un `src`
en dur qui ne suit pas la recette montée ; **un `src` FABRIQUÉ depuis l'identifiant au lieu d'être
lu** ; un `alt` qui répète le nom du plat, déjà dans le `<h1>` ; une image chargée paresseusement en
tête d'écran ; un aplat remplacé par un rectangle gris qui ne vient plus de `vignette.ts` ; la photo
posée sous les ingrédients ; **l'aplat posé ailleurs que là où la photo aurait été**.

⛔ **DEUX TROUS FERMÉS SUR ATTAQUE, LE 2026-08-17, ET ILS VALAIENT LE DÉTOUR.**

1. **`/catalog/images/${id.replace(/_/g, '-')}.avif` tombait juste sur 127 des 129 recettes
   pourvues**, et les trois témoins tirés par rang la suivaient tous les trois. Une implémentation
   qui n'ouvrait jamais `imagePath` passait donc l'examen entier — et cassait au premier import qui
   déplace l'ordre alphabétique. Les deux contre-exemples sont désormais des témoins nommés :
   `curry_legumes_pois_chiches` → `curry-legumes-lait-coco.avif` et `veloute_topinambour` →
   `soupe-potiron-topinambour.avif`. ⛔ **Ce sont les deux seuls qui existent** : les tirer par rang
   reviendrait à espérer tomber dessus.
2. **Rien n'exigeait que l'aplat soit en tête.** L'ordre du document n'était vérifié que sur les
   recettes POURVUES. Photo en tête et aplat tout en bas, après les étapes, passait — pour **201
   recettes sur 330**, c'est-à-dire la majorité de l'usage.

⚠️ **CE QUI N'EST DÉMONTRÉ PAR AUCUN TEST, ET QUI EST ÉCRIT ICI PLUTÔT QUE LAISSÉ À DEVINER** : la
TAILLE. « À l'identique de la carte du jour » veut dire `h-[40vh] min-h-[12rem] w-full object-cover`
pour les deux cas, mais aucune assertion ne porte sur une classe CSS — jsdom ne calcule aucune mise
en page, et sceller une chaîne de classes interdirait de la retoucher. Ce qui est scellé, c'est la
PLACE des deux blocs ; leur hauteur se vérifie à l'œil, sur appareil. Même famille que la moitié non
mesurée du lot D3.

**Ce que le codeur n'a PAS à deviner**, relevé pendant l'attaque : les recettes perso passent par le
même chemin sans une ligne de plus (`data/user-recipe.ts` pose déjà `imagePath: null`) ; les états
de chargement et « recette introuvable » ne changent pas et ne sont pas dans l'examen ; les sauces
attachées et les autres recettes citées sur la fiche restent du **texte pur** — pas de mini-vignette
photo, ce serait un second motif à décider, donc un autre lot.

**Ce que le lot ne touche pas** : le moteur, le catalogue (aucun YAML, aucun import relancé, aucune
photo ajoutée — le compte reste à 129), `aujourdhui.tsx` et son motif, `ui/vignette.ts`, la galerie
(`imagePath` est UNE chaîne — il faudrait une table `recipe_image`), le voile de mode sombre de §3.1
DESIGN (**un coefficient qui se mesure sur écran réel, pas sur le papier** — il reste ouvert pour
les deux écrans à la fois, pas seulement pour celui-ci), les recettes perso (`imagePath` y vaut
`null` en dur, elles prennent l'aplat par le même chemin), et le lot photo 2 des cadres.

**Tests scellés** : `tests/scelles/photo-fiche-detail.test.tsx`, montés contre le vrai `catalog.db`
via `app/src/ui/test-socle.ts` — jamais une fixture, et jamais une expression régulière sur le
source. Le lot photo 1 s'était permis deux assertions de source (`toMatch(/<img\b/)`) faute de monter
l'écran ; un `critique` a déjà fait passer ce genre de test, sur ce dépôt, en ajoutant une ligne
morte (voir l'en-tête de `65a-ecran.test.tsx`). On lit le rendu.

⛔ **CE QUE L'ATTAQUE D'APRÈS-CODE A TROUVÉ, ET QUI N'EST PAS UN DÉTAIL.** Le `critique` lancé sur
le lot **fini** a relevé un écart entre le brief et le code : le lien de retour était rendu **au-
dessus** de la photo, alors que §4.6 DESIGN — cité par le brief lui-même — écrit « Photo, retour,
favori · nom », photo en premier. **Corrigé le 2026-08-17, sur décision explicite** : le retour
passe sous la photo. ⚠️ **Aucun des 23 tests scellés ne voyait cet écart et aucun ne le verra** :
ils exigent « la photo précède le `<h1>` », ce qui était vrai dans les deux dispositions. Ce
placement tient par un commentaire, pas par une assertion.

⚠️ **CE QUE CES 23 TESTS NE PEUVENT PAS PROUVER, ET IL FAUT LE SAVOIR AVANT DE S'Y FIER.** Le même
`critique` a écrit l'implémentation fausse qu'on lui demandait, et elle passe : **une table
constante indexée sur les 7 identifiants témoins**. Le blindage anti-formule de la suite protège
contre `identifiant → chemin déduit` ; rien ne protège contre une table qui mémorise ces sept
chemins-là. **C'est structurel** : un examen d'écran monte un échantillon, et un échantillon fixe ne
distingue jamais « lit le champ » de « connaît ces sept-là ». Les **124 autres** recettes pourvues
ne sont ni testées ni testables par cette suite. **Le code livré ne triche pas** — il lit
`recette.imagePath`, vérifié à la relecture — mais c'est la relecture qui le garantit, pas la suite.
⛔ **La fermer demanderait de monter les 129 fiches, donc de modifier un test scellé : ça ne se fait
pas ici.** Si un lot ultérieur veut cette garantie, il l'écrit dans SA propre suite.

## Ce qui reste ouvert, et qui n'appartient à aucun lot ici

- **201 recettes sans photo, et le bac est épuisé** — le goulot est la source, pas le tri.
- **Décision 68** (`ETAT.md` §4) : à couverture complète le paquet dépasse le critère P6. Elle se
  tranche **avant** de produire les 201 photos manquantes, pas après.
