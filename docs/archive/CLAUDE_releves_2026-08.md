# Relevés de tests consignés dans CLAUDE.md — 2026-08-07 → 2026-08-27

> Sorti de `CLAUDE.md` le 2026-09-08 (règle d'unicité : l'état vit dans `ETAT.md`, l'histoire ici).
> Instantané daté — ne jamais réécrire, ne jamais citer comme état.

⛔ **DERNIER RELEVÉ : L'ARBRE EST ROUGE, ET C'EST UNE DÉCISION DE L'AUTEUR, PAS UN DÉFAUT.** Suite
réellement exécutée le **2026-08-27**, arbre COMPLET, après le code de `retour-5` (non commité) :
`npm test` → **2 425 passed / 11 failed (2 436 tests, 128 fichiers)** en 59,7 s · typecheck propre ·
`vite build` ✓ (3,02 s) · `engine:plan-stress` **20/20** · `audit-mapping` **451 / 9**, inchangé.
Le catalogue passe à **339 recettes** (330 + 9 bases nues) et **1 575 étapes**.
✅ **CE QUE `retour-5` AJOUTE A ÉTÉ COMPTÉ SEUL, PAS DÉDUIT** : `tests/scelles/retour-5.test.ts`, lancé
à part, rend **24 tests** — c'est le 128ᵉ fichier — soit 2 411 + 24 = 2 435, plus **1** test ordinaire
posé à côté de l'écran Aujourd'hui = **2 436**. Aucun autre fichier n'a changé de compte : **les 11
rouges sont des tests QUI EXISTAIENT DÉJÀ et qui passaient.**
⛔ **LES 11 ROUGES VIVENT DANS LES SIX FICHIERS SCELLÉS QUE LE BRIEF AVAIT ANNONCÉS** — 5 dans
`65b`, 1 dans `65b-ecran`, 1 dans `65c`, 1 dans `gestes-champ-media`, 1 dans `photo-fiche-detail`,
2 dans `retour-1`. **Dix scellent le nombre ABSOLU de recettes** — 330, mesuré avant les neuf bases ;
le sceau interdit de les corriger dans le lot qui les fait rougir, c'est **`retour-5c`**.
⚠️ **LE ONZIÈME N'EST PAS UN COMPTEUR, ET IL N'EST PAS PARTI AVEC LA CORRECTION QU'IL A
DÉCLENCHÉE** : `retour-1` exige 6 propositions froides sur 10 sous « Froid », l'écran en rend **7 sur
12**, et il les rend encore après.
⛔ **LA PREMIÈRE EXPLICATION ÉCRITE ICI ÉTAIT FAUSSE, ET C'EST LA MESURE QUI L'A DIT.** En collectant
la liste affichée carte par carte, sur les deux catalogues et des deux côtés du filtre : **aucune des
neuf bases nues n'apparaît dans les douze propositions**. À 330 recettes la liste rend **8/12
froides**, à 339 **7/12**, et **les douze plats diffèrent** — leur seule présence au catalogue
réordonne la sélection. Mécanisme **non identifié** ; hypothèse non vérifiée : l'accesseur de
similarité que reçoit `diversify` est construit sur le catalogue entier.
✅ **LE TROISIÈME ENDROIT OÙ LA MACHINE DÉCIDE SEULE EXISTE BEL ET BIEN, ET IL EST FERMÉ** : l'écran
Aujourd'hui écarte désormais les bases nues, comme le planificateur et « Changer ». Ce qui était faux,
c'était de lui attribuer le rouge. ▶ `ETAT.md` §4 décision **82**, lot `retour-5d`.
⚠️ **UN TEST SCELLÉ QUI NE VISAIT PAS LE LOT A ENCORE TROUVÉ LE DÉFAUT** — deuxième occurrence après
`retour-3`. **Ne pas lire un rouge comme « un compteur à rebaser » avant d'avoir regardé ce qu'il
mesure** : ici dix l'étaient, un ne l'était pas, et c'est le seul qui portait une information.
⚠️ **13 ASSERTIONS PRÉVUES AU BRIEF, 11 TESTS ROUGES MESURÉS — CE N'EST PAS UN ÉCART** : le brief
comptait des `expect` repérés à la lecture, vitest compte des `it`, et plusieurs `expect` vivent
dans le même `it`. Deux unités différentes ne se soustraient pas.
📦 **RELEVÉ PRÉCÉDENT, CONFIRMÉ ET NON CORRIGÉ** : 2026-08-26, après le commit de `retour-4`
(`7642492`), **2 411 passed / 0 failed (127 fichiers)** en 50,4 s · typecheck propre · `vite build`
✓ (3,11 s) · `engine:plan-stress` 20/20. Ainsi que `166aa32` (2 392 / 126), `6aad49c`
(2 376 / 125) et `3ce17d7` (2 263 / 123).
✅ **CE QUE `retour-4` AJOUTE A ÉTÉ COMPTÉ SEUL, PAS DÉDUIT** : `tests/scelles/retour-4.test.tsx`,
lancé à part, rend **19 tests** — c'est le 127ᵉ fichier — et **aucun autre fichier n'a bougé** :
19 + 0 = 19, et 2 392 + 19 = 2 411. ⚠️ **Le piège `it.each` a été revérifié** : `PARCOURS` n'a pas
bougé.
⛔ **UNE MOITIÉ DE CLAUSE SCELLÉE A ÉTÉ RETIRÉE, SUR DÉCISION DE L'AUTEUR, SCEAU LEVÉ PUIS REMIS.**
Le test exigeait « aucun reste orphelin **juste après le geste** » ET « aucun après recomposition »
pendant qu'une autre clause interdisait de toucher à un troisième créneau : **aucune implémentation
ne satisfait les deux.** Mesuré, pas discuté — les quatre cibles que le catalogue offre nourrissent
chacune 2 à 4 restes posés par la machine. La première moitié est partie, le retrait est expliqué
dans le fichier de test, et la dette est en `ETAT.md` §8. **Un « Fini quand » peut être
contradictoire avec lui-même ; c'est l'implémentation qui le révèle, et ce n'est pas au code de
trancher.**
📦 **CE QUI SUIT DATE DU LOT `retour-3` (`166aa32`) — gardé pour la MÉTHODE, pas pour le chiffre.**
⚠️ **UN DÉFAUT DÉJÀ EN PRODUCTION A ÉTÉ TROUVÉ PAR UN TEST SCELLÉ QUI NE LE VISAIT PAS.** Poser ou
tirer un plat sur un créneau portant une étiquette `hors_catalogue` recopiait l'étiquette à côté du
plat : le moteur rendait un plan bien formé que le `CHECK` de la migration v9 REFUSAIT à
l'écriture. Ni le type ni aucun test ne disaient non — seule la base. Corrigé dans le moteur au lot
`retour-3`, avec trois tests. **Un champ mutuellement exclusif de son voisin ne se garde pas par le
type : il se garde par un test, ou par la base au pire moment.**
📦 **CE QUI SUIT DATE DU LOT `retour-2` (`6aad49c`) — gardé pour la MÉTHODE, pas pour le
chiffre : le compte de référence est désormais 2 411 / 127.**
✅ **RELANCÉES UNE SECONDE FOIS SUR L'ARBRE FINAL**, après le retrait d'une fonction orpheline et
l'extension de la garde au shell : **mêmes 2 376 / 125**. Une fonction sans appelant ne coûte aucun
test à retirer — c'est ce qui prouve qu'elle n'en avait aucun.
✅ **CE QUE `retour-2` AJOUTE A ÉTÉ COMPTÉ SEUL, PAS DÉDUIT** : `tests/scelles/retour-2.test.tsx`,
lancé à part, rend **12 tests** — c'est le 125ᵉ fichier — et `parametres.test.tsx` passe de 49 à
**50** (le test de non-régression posé après relecture). 12 + 1 = 13, aucun autre test n'a bougé.
⛔ **UN ÉCART DE 90 TESTS A ÉTÉ OUVERT PUIS FERMÉ PAR LA MESURE — ET LE CHIFFRE `2 263` ÉTAIT JUSTE.**
`2 263 + 10 (retour-1b) + 13 (retour-2) = 2 286`, alors que la suite en rend **2 376** : 90 tests
n'étaient attribuables à AUCUN fichier de test modifié, puisque `git diff 3ce17d7 HEAD` n'en montre
que deux (`tests/scelles/retour-1b.test.tsx`, neuf, 10 tests ; `app/src/ui/visite.test.tsx`, modifié
sans un seul `it` ajouté). ✅ **CAUSE ÉTABLIE, PAS SUPPOSÉE** : en remettant le seul
`app/src/ui/parcours.ts` de `3ce17d7` et en relançant `app/src/ui/parcours.test.tsx`, il rend **144
tests** au lieu de **234**. **Exactement 90.**
⛔ **LE PIÈGE, ET IL RESSERVIRA : UN FICHIER DE TEST PARAMÉTRÉ PAR LA DONNÉE DE PRODUCTION CHANGE DE
COMPTE SANS APPARAÎTRE DANS AUCUN DIFF DE TEST.** `parcours.test.tsx` est bâti sur `it.each` nourri
par la table `PARCOURS` — son en-tête le revendique (« chaque nouvel élément de la table doit être
couvert sans toucher ce fichier »). Le lot `retour-1b` y a ajouté UN parcours, `decouverte`, qui
concatène les étapes de tous les autres : +90 tests, dans un fichier que `git diff --name-only` ne
cite pas. ⚠️ **Ce n'est donc PAS le symptôme documenté plus bas** (là, un compte BAISSE sans rouge).
▶ Attribuer un écart par `git diff --name-only` reste juste, mais **ne suffit plus** : il faut aussi
regarder les fichiers de test que la DONNÉE pilote.
⚠️ **Le catalogue n'a PAS été touché** — ni `catalog/build.mjs` ni `catalog/audit-mapping.mjs`
n'étaient des témoins de ce lot, et les chiffres de contenu ci-dessous datent donc toujours du
2026-08-20.
✅ **LES CINQ COMMANDES ONT ÉTÉ RELANCÉES LE 2026-08-20**, catalogue compris — le lot 65c a touché
au détecteur d'occupation. **451 aliments, 330 recettes, 1 548 étapes, 62 gestes, 73 tips, 8 fiches,
30 équipements (1 473 couples)** et **451 mappings / 9 candidats à relire** : inchangés, et cette
fois **mesurés**, pas déduits d'une absence de cause.
⛔ **CE QUI A CHANGÉ AU CATALOGUE, C'EST L'OCCUPATION D'USTENSILE** : `recipe_step_equipment` passe
de 92 à **377 occupations sur 228 recettes** — la plaque de cuisson en apporte **285 sur 166**, elle
qui n'en avait aucune. C'est le lot 65c, et c'est attendu.
✅ **L'ARBRE EST VERT EN ENTIER — les 6 rouges de la lane média sont éteints.** Ils vivaient dans
`tests/scelles/gestes-champ-media.test.ts` (7 tests), écrits AVANT leur code, donc rouges par
construction, exactement comme la méthode l'exige ; le **lot geste 1 les a fermés le 2026-08-16**.
⚠️ **L'ÉCART 2 156 → 2 238 COUVRE TROIS LOTS, PAS UN** (photo 3, 66c, 65b) : le relevé précédent
datait du 08-16 et trois lots ont été livrés depuis. Attribué fichier par fichier, jamais déduit —
**+74 dans 7 fichiers scellés neufs** (13 · 5 · 7 · 7 · 8 · 23 · 11) et **+8 dans 4 fichiers
ordinaires modifiés** ; total 82, et 114 → 121 fichiers pour les mêmes 7.
⚠️ **COMPTER LES TESTS AU `grep` SOUS-ESTIME, ET LE PIÈGE A FAILLI PASSER** : sur
`photo-fiche-detail`, `grep -c "it("` rend **8** là où vitest en exécute **23**. Un écart attribué
au grep se serait déclaré incomplet à tort. **Seule la sortie de vitest compte.**
⚠️ **`node catalog/build.mjs` sort une alerte qui n'est de personne aujourd'hui** : fiche
`calcium-fractures`, source `critique-zhao-2018` **sans auteurs vérifiés**. C'est du contenu Savoir
— elle tombe avec la relecture par un tiers, pas avec un lot de code.
⚠️ **`engine:plan-stress` est le témoin de la durée** : le mode cuisine a ajouté une durée ÉCOULÉE
(actif + repos) sans toucher la durée ACTIVE que lit le solveur. 20/20 à chacun des trois lots le
prouve. S'il bouge après un lot de cuisine, c'est que les deux durées ont été confondues.
⚠️ **UN RUN SUR QUATRE A RENDU 1 754 AU LIEU DE 1 766, VERT DANS LES DEUX CAS.** Constaté le
2026-08-08, arbre identique, aucun échec ni saut déclaré (`skipIf`/`runIf` : zéro occurrence dans le
dépôt). Les trois runs suivants, dont deux en `--reporter=json`, ont tous rendu 1 766. **Cause non
identifiée** ; piste la plus probable : plusieurs fichiers de test lancent `catalog/build.mjs` en
parallèle et un `beforeAll` qui échoue fait disparaître les tests de son fichier du total au lieu de
les compter en rouge. **Un compte qui bouge sans rouge est un signal** — si un écart réapparaît,
c'est là qu'il faut chercher, pas dans le lot du jour. ⚠️ **Ces deux nombres sont ceux du
2026-08-08 : la base est désormais 2 238.** Le symptôme à guetter est un ÉCART entre deux runs sur
le même arbre, pas une valeur particulière. ⚠️ **Aucun écart n'a été revu depuis** — quatre runs
complets le 2026-08-11, puis deux le 2026-08-14 à 40 min d'intervalle, ont tous rendu le même
compte. Ne pas conclure que la cause est morte : elle n'a jamais été identifiée, seulement pas
réapparue.
⚠️ **Un écart de compte s'attribue par `git diff --name-only`, jamais par déduction.** Le
2026-08-09, à trois sessions dans le même arbre, un « +1 » a été attribué à la mauvaise lane :
chacune voyait l'écart depuis SON relevé précédent et l'imputait par défaut à sa voisine. Personne
n'avait menti ni mal compté.
⚠️ **Un relevé se prend sur l'arbre qu'on commite, pas sur celui d'où l'on est parti.** Le
2026-08-07, trois documents annonçaient 1 647 tests pendant que l'arbre en contenait 22 de plus :
ils avaient été mis à jour dans le même lot que le code qu'ils ne comptaient pas encore.
⚠️ **Une cinquième commande, qu'aucun test ne remplacera** : `node catalog/audit-mapping.mjs`, à
lancer À LA MAIN après chaque lot de contenu et **uniquement dans le dépôt principal** —
`documents Ciqual/` est gitignoré, donc absent de tout worktree.
⚠️ **Piège de relevé** : `npm test 2>&1 | tail -25` rend le code de sortie du **pipe**, donc 0. Lire
le compte `Tests N failed`, jamais `$?`.
⚠️ Ce compte bougera : **la sortie réelle fait foi, pas cette ligne.**
📦 **Deux alertes fermées ont été retirées d'ici le 2026-08-14** — le plancher « végétalien + sans
gluten » (28/28, marge portée de 0 à 8 plats) et les 2 échecs d'`aujourdhui.test.tsx` (`70e2493`).
Elles annonçaient un défaut qui n'existe plus. ▶ Le récit est dans
`docs/archive/RECAP_SESSION_2026-08-14_invariant-origine-animale.md` §Ménage.
