# Extraits sortis de `FICHE_REPRISE.md` le 2026-08-10

> **Instantané daté. Ne jamais réécrire, ne jamais citer comme état.**
> La fiche de reprise est passée de **268 à ~100 lignes**. Les blocs ci-dessous en sont sortis
> **verbatim**. Chacun dit, en fin de section, **où son fait durable vit désormais** — ou qu'il
> n'en portait aucun.
>
> Motif du dégonflage : la page a un plafond dur de 100 lignes et en portait 268. Le mécanisme est
> connu et consigné dans le bloc §1 ci-dessous : **chaque lot livré ajoute son récit ici, aucun n'en
> repart tout seul, et à plusieurs sessions le solde est positif.** Trois chantiers se sont fermés
> le 2026-08-09 et le 2026-08-10 (sauces, mode cuisine, référence) : leurs blocs partent avec eux.

---

## 1. Le méta-bloc sur la croissance de la page

> ⛔ **239 LIGNES AU 2026-08-09 EN FIN DE JOURNÉE : LA PAGE A GROSSI MALGRÉ UN DÉGONFLAGE, ET C'EST
> LE FAIT UTILE.** Le compte annoncé ici était 207 ; **l'écart s'attribue par `git log -- ce
> fichier`, pas par déduction** : 201 lignes à `c912a9d` (la passe de dégonflage), 195 à `86857e3`,
> puis **+41 d'un coup à `f20382b`** (lane « étapes ») et +3 au lot photos. **Deux lanes ont ajouté
> 44 lignes en une journée à une page que personne n'a raccourcie.**
> La passe du jour a bien sorti 25 lignes (relevé périmé, 2 rouges fermés, « l'arbre est propre »,
> le signal du banc éteint) — mais une **autre session** en a ajouté 35 le même jour en refermant le
> tri des photos. **Le glissement n'est pas une négligence, il est structurel** : chaque lot livré
> ajoute son récit ici, aucun n'en repart tout seul, et à plusieurs sessions le solde est positif.
> Quand un lot est fini, son fait va dans `ETAT.md` ou son document de chantier — pas sur cette page.
> **Chacun de ces blocs part le jour où son chantier se ferme.** ✅ **Le bloc photos est parti** : la
> session qui l'avait écrit l'a dégonflé elle-même de 43 lignes à 11 — verbatim en §5 des extraits.

**Où vit le fait durable :** la règle « un lot fini pose son fait dans `ETAT.md`, pas sur la fiche »
est désormais énoncée en tête de `FICHE_REPRISE.md`. Le reste est l'historique d'une mesure.
**Il s'est vérifié une deuxième fois** : 239 → 268 lignes entre le 2026-08-09 et le 2026-08-10,
sans qu'aucune session ne se soit trompée — trois lots ont refermé, trois récits se sont ajoutés.

---

## 2. Les trois relevés du 2026-08-09 après-midi, et l'attribution du « +1 »

⛔ **LES TROIS RELEVÉS QUI SUIVENT SONT DE L'HISTOIRE DU 2026-08-09 APRÈS-MIDI, PAS UN ÉTAT** — ils
restent parce que chacun porte une leçon d'attribution qui se repaierait.
✅ 14h20, **1 940 passed**, 96 fichiers, 52,3 s · ✅ 14h35, **1 941 passed**, lot « nom de portion »
inclus.
⛔ **LE « +1 » A ÉTÉ ATTRIBUÉ À LA MAUVAISE SESSION, ET C'EST L'EXEMPLE À GARDER.** La ligne
ci-dessus disait « le test de plus vient de la session sauces » ; **il vient du mode cuisine**, qui
avait relevé **1 941 à 14h23**, donc AVANT le lot « nom de portion » de 14h35. C'est le test unique
ajouté après relecture sur `reposLongMin` (les ~23 autres du lot étaient déjà dans le 1 940 de
14h20). ⚠️ **Personne n'avait menti et personne n'avait mal compté** : à trois sessions dans un
arbre, chacune voit l'écart depuis SON relevé précédent et l'attribue par défaut à son voisin.
**Un écart ne s'attribue pas par déduction, il s'attribue par `git diff --name-only`.**
⛔ **PUIS 1 823 À 14h44, VERT, SANS LE MOINDRE ROUGE — ET CE N'EST PAS UNE RÉGRESSION.** Les 118
tests manquants sont ceux du lot « sauces », **partis dans un `git stash` posé par une session
voisine** (bloc plus bas), pas perdus. ⚠️ **C'est exactement la signature dont cette page répète
qu'elle est un signal** — un compte qui baisse sans rouge. **Ici la cause est nommée ; si l'écart
réapparaît sans explication, c'est ailleurs qu'il faut chercher.** ▶ **Le relevé du commit « nom de
portion » est celui-là** : **1 823 passed / 0 failed**, 96 fichiers, en 29,2 s · typecheck propre ·
`vite build` ✓ (2,73 s) · `engine:plan-stress` **20/20** · `node catalog/build.mjs` → **2 809 liens,
1 312/1 407 gestes (93,2 %)**.
⚠️ **LE `git stash` N'EXPLIQUE PAS LA DISPARITION DE ②③④.** Vérifié à la reconstruction : le stash
`d3a5c37a` contenait le rendu de `SaucesAAjouter` dans `detail-recette.tsx` et un morceau de
`choisir-plat.tsx` — **rien de ②, ③ ni ④**, dont `git log --all -S` ne trouvait aucune trace nulle
part. Deux histoires distinctes le même après-midi, et les confondre a fait chercher un `stash` à
restaurer pendant qu'il fallait construire. **Le contrôle qui les sépare est `git log --all -S`,
pas la mémoire de la journée.**
⚠️ **Les comptes d'aliments et de recettes datent du 2026-08-08 et n'ont pas bougé** : **451
aliments, 308 recettes** (dont **3 sauces**), 1 425 étapes, 62 gestes, 73 tips, 8 fiches. ⛔ **En
revanche 4 recettes YAML ONT été éditées le 2026-08-09** (texte d'étapes, aucun nombre ajouté) et
`recipe_step_ingredient` est passé à **2 809 liens, 1 312/1 407 gestes (93,2 %)** — « aucun lot du
jour ne touche un fichier de contenu » était vrai des sauces seules.

**Où vit le fait durable :** la règle d'attribution (`git diff --name-only`, jamais la déduction)
est passée dans `CLAUDE.md`, section « Vérifier ». Les comptes de catalogue vivent dans `ETAT.md`
§8 et **nulle part ailleurs**. Les trois relevés eux-mêmes ne sont plus qu'une chronologie.

---

## 3. Le bloc « sauces », chantier fermé le 2026-08-09 au soir

✅ **LE LOT « SAUCES » EST FERMÉ — ①②③④, RECONSTRUIT ET COMMITÉ LE 2026-08-09 AU SOIR.** Le panneau
« Ajouter une sauce » de la fiche est **rendu** (`e2a5596`) ; la préférence durable et les courses
sont là (`user_recipe_sauce`, **v14**, `f6a65d5`) ; le bouton « Sauces (N) » et la section de sauce
des courses aussi (`fea703f`) ; « la cuisiner avec le plat » (`c2917b0`) ; les sauces perso dans
l'éditeur (`30a4964`, `c457694`).
⛔ **CE N'EST PAS LA MÊME LIGNE QUE CELLE DU MATIN, ET LA DIFFÉRENCE EST LA SEULE QUI COMPTE.** La
précédente annonçait les quatre points sur un arbre où `git log --all -S` ne trouvait que deux
commits de **documentation** : la lane avait écrit son récit et pas son code. **La règle qui en
sort, et elle vaut pour toutes les lanes : aucun ✅ ici sans `git log --all -S` sur un identifiant
du code concerné.** Un compte de tests vert ne prouve rien — celui de 1 940 était vrai sur un arbre
qui n'existe plus. Les identifiants et leur commit sont listés un par un en `ETAT.md` §8.
▶ **Détail, écarts assumés et six pièges en `ETAT.md` §8** ; les décisions en §3 — dont une
**corrigée** : la section de sauce des courses est en rangements « Repas » **ET** « Jour », pas en
« Repas » seul. Le récit archivé
([archive/RECAP_SESSION_2026-08-09_sauces.md](./RECAP_SESSION_2026-08-09_sauces.md))
**décrit un travail qui, à sa date, était absent de l'arbre** — il reste en place, un instantané
daté ne se réécrit jamais, mais il ne se lit pas comme un état.

**Où vit le fait durable :** les décisions de sauce sont en `ETAT.md` §3 ; les identifiants et leur
commit en `ETAT.md` §8. **La règle « aucun ✅ sans `git log --all -S` » est reprise en tête de la
fiche** — c'est la seule chose de ce bloc qui devait survivre à la fermeture du chantier.

---

## 4. Le bloc « mode cuisine », chantier fermé le 2026-08-10

✅ **LE MODE CUISINE EST FINI POUR CE QUI ÉTAIT PLANIFIÉ — L0 à L4**, dont **L4 le 2026-08-09** :
plusieurs plats à la fois, heure de service, frise des départs.
⛔ **LE FAIT À RETENIR N'EST PAS LA FRISE, C'EST CE QU'ELLE A RÉVÉLÉ.** `tempsPrepMin +
tempsCuissonMin` **ne compte pas les repos** : faux sur **143 recettes sur 308**, jusqu'à **11 h 40**
d'écart — « à lancer 45 min avant le service » pour une marinade de douze heures. Le code était
cohérent avec lui-même ET avec ses tests ; **on l'a vu en interrogeant `catalog.db`, pas en
relisant.** ⚠️ **Une limite documentée n'est pas une limite chiffrée** : `ordonnancement.ts`
déclarait honnêtement travailler sur une seule durée par recette, et personne n'avait mesuré ce que
ça coûtait.
▶ **CE QUI RESTE : les niveaux 2 et 3** — entrelacement actif/passif, réservation d'équipement.
✅ Le prérequis supposé du 2 est **tombé** (`timerType` porte déjà `cuisson`/`repos`, zéro annotation
à saisir). ✅ **Et celui du 3 est tombé le 2026-08-09** — cette phrase disait « l'équipement n'existe
nulle part au catalogue », ce n'est plus vrai : `catalog/equipment/` porte **30 ustensiles** et
`recipe_equipment` **1 473 couples** sur 330 recettes, avec le niveau sur le couple. **Le niveau 3
n'attend plus de contenu**, il attend d'être codé.
✅ **L2 n'est plus suspendu** :
la décision 60 est fermée le 2026-08-07, le lien étape → ingrédient est **dérivé au build** et
n'a demandé **aucune** des 1 350 annotations prévues (**2 809 liens, 93,2 % des gestes** au
2026-08-09 — ⚠️ **les 2 715 / 93,7 % écrits ici jusque-là étaient périmés de deux lots**, et le
taux a BAISSÉ parce que des liens FAUX ont été retirés : voir `ETAT.md`).
✅ **La quantité est dans la phrase de l'étape, et le chantier de réécriture à la main est vide** —
**1 étape** reste à relire contre 114 au départ. Le reste est hors de portée d'une règle
(« au goût »). ▶ **Le seul arbitrage qui reste est un choix d'écriture, la décision 63.**
⛔ **Ce qui survit et ne doit pas être défait : la table AJOUTE, elle ne FILTRE JAMAIS.**

⛔ **DEUX PHRASES DE CE BLOC ONT EU TORT, ET C'EST LA RAISON DE LE GARDER.**
1. « **143 recettes sur 308** » : mesuré à nouveau le 2026-08-10, il ne reste **1 seule** étape,
   dans **1 seule** recette, qui décrive un repos sans le chiffrer. La lane Référence a comblé le
   reste. Le nombre était vrai à sa date et n'a jamais été remesuré avant d'être recopié.
2. « **Le niveau 3 n'attend plus de contenu, il attend d'être codé** » : **faux**. Écrit deux fois,
   ici et dans mes propres messages, sur la foi des 1 473 couples. Il manque une colonne d'**étape**
   sur `recipe_equipment` et une **`capacite`** sur `equipment`. **Une table qui existe n'est pas
   une table qui suffit.** → `ETAT.md` §4 décision 65, `CONCEPTION_MODE_CUISINE.md` §8 question F.

**Où vit le fait durable :** `CONCEPTION_MODE_CUISINE.md` §4.3 (les trois lots du 2026-08-10) et §8
(les questions ouvertes). Les deux durées — active pour « ai-je le temps », écoulée pour « quand
dois-je m'y mettre » — sont dans `CLAUDE.md`, avec `engine:plan-stress` comme témoin.

---

## 5. Le bloc « photos », dégonflé mais toujours ouvert

🏁 **LE TRI DES PHOTOS EST TERMINÉ, LE BAC EST VIDE** (2026-08-06 → 08-09). **88** recettes ont une
photo validée, **220** n'en ont pas, **22** photos valent pour un plat absent du catalogue.
Détail du chantier : `atelier/photos/REPRISE.md` (gitignoré) · récit, mesures et causes :
**[archive/…_photos-fin-du-tri.md](./RECAP_SESSION_2026-08-09_photos-fin-du-tri.md)**.
⛔ **Les 220 ne sont pas un défaut de tri : 94 d'entre elles ont vu plus de dix photos sans en
garder aucune.** Le goulot est la récolte. ▶ **Relancer une récolte, ne pas rejuger le bac.**
✅ **LES 88 SONT DANS L'APPLICATION** (2026-08-09) : `catalog/import-photos.mjs` (`photos:import`,
idempotent) ré-encode en **AVIF 1024 px** — 19,9 Mo bruts → **3,12 Mo** — pose `image_path` et
régénère l'attribution de `CREDITS.md` ; `vite-plugin-sw.ts` **balaie** le dossier au lieu de lister,
donc un lot de photos n'oblige plus personne à penser au pré-cache. Encodeur, marge restante sur les
15 Mo de P6, obligation CC BY-SA : `ETAT.md` §3 « Média ».
▶ **CE QUI RESTE** : ① la **récolte** des 220 (goulot, hors dépôt) ; ② **afficher** — la donnée
existe, **aucun composant ne lit `Recipe.imagePath`**, et il faudra décider quoi montrer pour les
220 recettes nues ; ③ ⛔ **« le build échoue sans photo » : INTERDIT avant 308/308.**

⛔ **DEUX PHRASES DE CE BLOC ONT EU TORT EN VINGT-QUATRE HEURES.**
1. « **220 n'en ont pas** » et « **avant 308/308** » : le catalogue est passé à **330 recettes**
   (lot de 22 de la lane Référence). C'est **242 sans photo, sur 330**. Le dénominateur d'une
   fraction recopiée vieillit aussi vite que son numérateur.
2. « **aucun composant ne lit `Recipe.imagePath`** » : **faux depuis le même jour**. `aujourdhui.tsx`
   et `detail-recette.tsx` l'affichent tous les deux.

**Où vit le fait durable :** le barème et l'état du bac dans `atelier/photos/REPRISE.md` (hors
dépôt) ; les décisions d'encodage et de licence dans `ETAT.md` §3 « Média ». **Le fait qui compte
et qui reste sur la fiche : le goulot est la RÉCOLTE, pas le tri — relancer sans changer de source
rendra le même résultat.**

---

## 6. Les incidents de sessions parallèles

⛔ **TROIS SESSIONS ÉCRIVAIENT DANS CET ARBRE LE 2026-08-09** — sauces (celle-ci), mode cuisine à
plusieurs plats, tri des photos. HEAD a bougé plusieurs fois sans qu'aucune y touche, et une session
avait des fichiers **indexés** qui ne lui appartenaient pas. **Ne jamais relever un compte, ni
attribuer un rouge, sans dire quelle session a écrit quoi.**

⛔ **CINQUIÈME FOIS, ET LA PLUS BRUTALE — 2026-08-09 : un `git stash` posé par une session a VIDÉ
L'ARBRE ENTIER**, emportant les 12 fichiers d'une piste voisine en pleine rédaction. Symptôme :
`git status` **propre**, code disparu, **rien dans `git log`**. ▶ **`git stash list` AVANT
`git reflog`**, puis `git checkout stash@{0} -- <chemins>` — qui rend sans dépiler et **laisse la
remise à celle qui l'a posée**. ⛔ **Jamais `git stash pop` sur une remise à deux sessions.**
⚠️ **`git stash` n'a pas de forme sûre ici** : `-- <chemins>` limite ce qu'on remise, rien ne limite
ce qu'on rend. **Committer son lot est le seul geste qui ne prend pas l'arbre des autres en otage.**

⚠️ **Le travail à deux dans un même dépôt a déjà coûté cher quatre fois** — un `main` poussé rouge,
un commit qui ne compilait pas, un lot emporté par la session voisine, et un rouge passé parce
qu'un worktree de vérification ne contenait qu'une SÉLECTION DE FICHIERS au lieu de la référence.

⚠️ **Les périodes 2026-07-31 → 08-01 et 2026-08-05 ont chacune porté TROIS pistes parallèles**, dans
des conversations séparées, et aucune ne raconte le travail des autres : il faut lire les récits des
trois. Voir [archive/README.md](./README.md), qui les apparie.

**Où vit le fait durable :** `reference/PIEGES.md` porte la méthode et les contre-exemples. La
fiche ne garde que les trois gestes qui se paient à chaque session : **jamais `git commit -a`,
jamais `git stash`, `git status -sb` avant de committer.**
