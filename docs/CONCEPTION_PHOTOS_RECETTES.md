# Photos de recettes — montage et cadrage

> Document de chantier. **L'état chiffré vit dans `ETAT.md`**, pas ici : cette page ne porte que
> le plan et les critères d'acceptation des lots. Le tri lui-même (barème, décisions, outils) vit
> dans `atelier/photos/REPRISE.md`, hors dépôt.

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

## Lot 1 — l'affichage, et le cadre honoré ✅ **LIVRÉ le 2026-08-13**

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

## Lot 2 — poser les 128 cadres manquants

Pas du code : une passe de tri à l'atelier, une photo à la fois, validée par l'utilisateur. Elle ne
devient utile qu'une fois le lot 1 livré, puisque le cadre ne fait rien avant.

**Fini quand** : chaque photo servie porte un cadre posé à la main, ou une raison écrite de ne pas
en porter.

## Ce qui reste ouvert, et qui n'appartient à aucun lot ici

- **201 recettes sans photo, et le bac est épuisé** — le goulot est la source, pas le tri.
- **Décision 68** (`ETAT.md` §4) : à couverture complète le paquet dépasse le critère P6. Elle se
  tranche **avant** de produire les 201 photos manquantes, pas après.
