# ⭐ Fiche de reprise — appli_nutrition

> **Une page, jamais plus — plafond dur : 100 lignes.** État vérifié + prochaine étape, rien d'autre.
> Avancement détaillé, décisions et dette : [ETAT.md](./ETAT.md) · Index : [README.md](./README.md).
> Font foi : [ENGINE.md](./ENGINE.md) (moteur), [ARCHITECTURE.md](./ARCHITECTURE.md) (le reste).
> *Dégonflée quatre fois : 341 → ~95 lignes le 2026-08-03, puis **285 → 193**, puis **193 → 169** le
> 2026-08-07, puis les blocs des chantiers fermés le 2026-08-09. Rien n'est perdu — les blocs sortis
> sont recopiés verbatim dans [archive/FICHE_REPRISE_extraits_2026-08-07.md](./archive/FICHE_REPRISE_extraits_2026-08-07.md)
> et [archive/FICHE_REPRISE_extraits_2026-08-09.md](./archive/FICHE_REPRISE_extraits_2026-08-09.md),
> qui disent aussi, bloc par bloc, où le fait durable vit désormais.*
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

## Le projet

Planificateur de repas **100 % local, sans IA, sans compte**. Moteur TypeScript pur, catalogue
SQLite construit au build, PWA React servie en statique.

## Où on en est

```
MOTEUR ✅ ─ CONTENU ✅ ─ user.db ✅ ─ DESIGN ✅ ─ 9 ÉCRANS ✅ ─ TESTS D'ÉCRAN ✅ ─▶ CONTENU & DISTRIBUTION ▓▓
                                                                                          ⬅ ICI
```

✅ **SUITE VERTE EN ENTIER — RÉEXÉCUTÉE LE 2026-08-09 À 14h20 SUR L'ARBRE COMPLET**, les quatre lots
des sauces inclus.
`npm test` → **1 940 passed / 0 failed**, **96 fichiers**, en 52,3 s · `npm run typecheck` propre ·
`npx vite build` ✓ (3,42 s) · `npm run engine:plan-stress` → **20/20, PLUS AUCUN SIGNAL**.
✅ **REJOUÉE À 14h35, arbre complet, lot « nom de portion » inclus** : `npm test` → **1 941 passed /
0 failed**, 96 fichiers, en 33,6 s · typecheck propre · `vite build` ✓ (2,94 s) ·
`engine:plan-stress` **20/20**.
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
⚠️ **Les comptes d'aliments et de recettes datent du 2026-08-08 et n'ont pas bougé** : **451
aliments, 308 recettes** (dont **3 sauces**), 1 425 étapes, 62 gestes, 73 tips, 8 fiches. ⛔ **En
revanche 4 recettes YAML ONT été éditées le 2026-08-09** (texte d'étapes, aucun nombre ajouté) et
`recipe_step_ingredient` est passé à **2 809 liens, 1 312/1 407 gestes (93,2 %)** — « aucun lot du
jour ne touche un fichier de contenu » était vrai des sauces seules.

⚠️ **Piège de relevé, déjà payé le 2026-08-07** : `npm test 2>&1 | tail -25` rend le code de sortie
du **pipe**, donc 0. Lire le compte `Tests N failed`, jamais `$?`.
⚠️ Ces nombres bougent à chaque commit : **la sortie réelle fait foi, jamais cette ligne.**

**L'application fait sa boucle complète** : s'installer → déclarer ses allergies → voir une
suggestion → planifier sa semaine → sortir sa liste de courses → cuisiner. Plus « partir de ce
qu'on a », un lexique de 62 gestes, et l'onglet Savoir complet.

⚠️ **`git status -sb` donne l'état, jamais cette page.** Un nombre écrit ici est faux dès le commit
suivant.

⛔ **TROIS SESSIONS ÉCRIVAIENT DANS CET ARBRE LE 2026-08-09** — sauces (celle-ci), mode cuisine à
plusieurs plats, tri des photos. HEAD a bougé plusieurs fois sans qu'aucune y touche, et une session
avait des fichiers **indexés** qui ne lui appartenaient pas. **Ne jamais relever un compte, ni
attribuer un rouge, sans dire quelle session a écrit quoi.**
⚠️ **HEAD est EN AVANCE sur `origin/main` — les commits attendent d'être poussés.** Claude committe,
l'utilisateur pousse.
⚠️ **`git status -sb` avant de committer quoi que ce soit ; ne jamais committer `-a`** — les sessions
parallèles continuent d'écrire dans le même arbre.

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
Méthode, découpage et contre-exemples : **[reference/PIEGES.md](./reference/PIEGES.md)** et
[archive/FICHE_REPRISE_extraits_2026-08-07.md](./archive/FICHE_REPRISE_extraits_2026-08-07.md).
**Claude committe, l'utilisateur pousse** — le shell agent ne peut pas s'authentifier auprès de
GitHub.

⚠️ **Les périodes 2026-07-31 → 08-01 et 2026-08-05 ont chacune porté TROIS pistes parallèles**, dans
des conversations séparées, et aucune ne raconte le travail des autres : il faut lire les récits des
trois. Voir [archive/README.md](./archive/README.md), qui les apparie.

## ▶ La prochaine étape

⚠️ **UNE ACTION RÉCURRENTE, À NE PAS OUBLIER** : `node catalog/audit-mapping.mjs` — balayage
identifiant ⇄ nom Ciqual, **451 mappings** au 2026-08-07. **À relancer À LA MAIN après chaque lot de
contenu**, et c'est la seule façon : `documents Ciqual/` est gitignoré, donc **ça ne peut pas devenir
un test** — et **ça ne tourne que dans l'arbre principal**, jamais dans un worktree.
Premier passage le 2026-08-05 : **deux mappings faux**, `canard_magret` (× 4,9 sur les lipides) et
`jambon_blanc` (un rôti CRU au lieu de jambon cuit), sur 7 recettes. Aucun test ne pouvait les voir —
un identifiant qui contredit sa ligne Ciqual ne fait rougir personne.
Au 2026-08-07 : **9 candidats, tous des écarts de forme**, aucun mauvais aliment.

✅ **LE BANC NE SIGNALE PLUS RIEN** depuis le 2026-08-07 (20/20). **Un catalogue qui suffit tout
juste ne suffit pas** — c'est le fait à retenir, pas le nombre : le manque était dans les PLATS, et
le compte exact disait *marge zéro*, pas *il manque un plat*. Détail :
[archive/RECAP_SESSION_2026-08-07_recettes-aliments.md](./archive/RECAP_SESSION_2026-08-07_recettes-aliments.md) §2.

⛔ **LE LOT « SAUCES » N'EST PAS FERMÉ — UN QUART l'est, et cette ligne a annoncé les quatre.**
Rectifié le 2026-08-09 au soir. **Livré** : l'axe séparé (décision 62) — 3 recettes de sauce et
14 attachements au catalogue, `engine/domain/sauces.ts`, `Engine.suggestSauces` avec son garde-fou
allergènes. **Pas livré** : la préférence durable et les courses (`user_recipe_sauce`, v14), le
bouton « Sauces (N) », « la cuisiner avec le plat », les sauces perso dans l'éditeur. Et le panneau
« Ajouter une sauce » de la fiche recette **est écrit mais jamais rendu** — `lireLesSauces` appelle
le moteur à chaque ouverture et le résultat est jeté.
⚠️ **Ce n'est pas du code perdu par accident : il n'a jamais été commité.** `git log --all -S` sur
chacun de ces identifiants ne trouve que deux commits de **documentation**. La lane a écrit son
récit et pas son code. ⛔ **La règle qui en sort, et elle vaut pour toutes les lanes : aucun ✅ ici
sans `git log --all -S` sur un identifiant du code concerné.** Un compte de tests vert ne prouve
rien — celui de 1 940 était vrai sur un arbre qui n'existe plus.
▶ **Spécification complète, pièges compris, en `ETAT.md` §8** ; les décisions en §3, valides et
inchangées. Le récit archivé
([archive/RECAP_SESSION_2026-08-09_sauces.md](./archive/RECAP_SESSION_2026-08-09_sauces.md))
**décrit un travail absent de l'arbre** — il reste en place, un instantané daté ne se réécrit
jamais, mais il ne se lit pas comme un état.

**Ce qui reste n'est plus du code d'écran.** Trois chantiers, par ordre de dépendance :

1. **⛔ Relecture par un tiers du contenu Savoir** (§8.2 bis) — bloquante avant publication. Les
   73 tips et les 8 fiches « Comprendre » sont sourcés un par un, **aucun n'est relu**. Le build qui
   passe ne rend pas le contenu publiable.
2. **Vérifier sur un vrai téléphone.** `npx vite build && npx vite preview --host`, puis installer.
   Le service worker et l'installation **ne s'activent qu'en build de production** — `npm run dev`
   ne les monte pas. ⚠️ **Essai partiel le 2026-08-05, dans Chrome et NON dans la WebView**, et
   **sur une maquette** (`CONCEPTION_MODE_CUISINE.md` §7) : audio validé, vibration morte, **pari
   `rem` à 150 % NON MESURÉ** — le seul dont l'échec toucherait les neuf écrans. ⚠️ **L'instrument a
   changé** : l'écran réel existe, l'essai se refait sur `#/cuisine/chakchouka` — **en HTTPS**, car
   `http://` fait disparaître `navigator.wakeLock` et l'échec ressemble à un défaut d'appareil.
   ▶ **TROISIÈME RELEVÉ À FAIRE DANS LE MÊME PASSAGE, ET C'EST LA CONDITION DE LA DÉCISION 61** :
   ouvrir **`#/recettes`** et chronométrer l'apparition de la liste. C'est le seul chiffre qui
   manque pour clore la 61, la piste (c) l'exige explicitement, et **personne ne l'a jamais pris**.
   ⚠️ **Ne pas le remplacer par la mesure jsdom du 2026-08-07** (3,60 ms/carte, 1 098 ms à
   305 recettes) : jsdom ne fait **ni mise en page ni peinture**, donc il ne mesure pas ce qui fait
   attendre l'utilisateur. Ce qui se transpose est **6,9 nœuds DOM par carte**, soit ~3 450 nœuds à
   500 recettes — a priori sans gravité, **et c'est justement l'a priori qu'il s'agit de vérifier**.
   **Zéro dépendance à installer** : pas de Playwright, contrairement au lot C d'accessibilité.
3. **Empaquetage Capacitor, puis Play.** ⚠️ **La cible n'est plus TWA/Bubblewrap** — décision du
   2026-08-01, `archive/RECAP_SESSION_8.md` §3. `capacitor.config.ts` et `@capacitor/*` sont en
   place ; `npx cap add android` n'a jamais été lancé (pas de SDK sur la machine). **Ni origine
   HTTPS ni `/.well-known/assetlinks.json` ne sont requis** pour cette cible. Une version web reste
   utile — c'est le seul chemin vers un iPhone tant qu'il n'y a pas de Mac (§4 décision 9).

**Contenu qui reste** : **photos**, lexique illustré, 27 tips pour la centaine visée, 8 fiches sur
les 60-100 de §8.2. Rien de tout cela n'est un problème de code.

🏁 **LE TRI DES PHOTOS EST TERMINÉ, LE BAC EST VIDE** (2026-08-06 → 08-09). **88** recettes ont une
photo validée, **220** n'en ont pas, **22** photos valent pour un plat absent du catalogue.
Détail du chantier : `atelier/photos/REPRISE.md` (gitignoré) · récit, mesures et causes :
**[archive/…_photos-fin-du-tri.md](./archive/RECAP_SESSION_2026-08-09_photos-fin-du-tri.md)**.
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
Spec : `ARCHITECTURE.md` §5bis · état et ordre des lots :
**[CONCEPTION_MODE_CUISINE.md](./CONCEPTION_MODE_CUISINE.md)** · récits :
[…_mode-cuisine.md](./archive/RECAP_SESSION_2026-08-05_mode-cuisine.md) (L1) et
[…_cuisine-multi-plats.md](./archive/RECAP_SESSION_2026-08-09_cuisine-multi-plats.md) (L4) · le
détail des lots tel qu'il figurait ici : [archive/FICHE_REPRISE_extraits_2026-08-07.md](./archive/FICHE_REPRISE_extraits_2026-08-07.md).
⛔ **L'alarme ne sonne PAS quand l'appli est fermée — décision instruite, pas un oubli.** Ne pas la
rouvrir sans lire `CONCEPTION_MODE_CUISINE.md` §5.

✅ **La vérification sanitaire des recettes est terminée** (2026-08-03) — `ARCHITECTURE.md` §5 bis,
quater et quinquies. ⚠️ **Deux trous restent déclarés, non comblés** : les céphalopodes (`calamar`,
`poulpe`), et le critère de cuisson de l'œuf qu'aucune autorité lue ne donne.

## Ce qu'il ne faut pas refaire

Trois impasses déjà payées — sources de recettes déjà écartées licence par licence, substitutions
qui ont rendu zéro couple deux fois, conséquences non traitées de la décision Capacitor — plus les
pièges de build, de navigateur, de moteur et d'interface, et la règle de sourçage du contenu Savoir :
➡️ **[reference/PIEGES.md](./reference/PIEGES.md)**. À ouvrir avant de rouvrir un de ces chantiers.

## Les invariants

Les **cinq acquis à ne pas défaire** vivent dans **[../CLAUDE.md](../CLAUDE.md)**, chargé
automatiquement à chaque session. Plus recopiés ici : un fait, un seul endroit.

## Où chercher le reste

| Question | Document |
|---|---|
| Avancement, **écrans un par un**, décisions, **dette connue** (§8) | [ETAT.md](./ETAT.md) |
| Comment marche une couche, un algorithme, l'API | [ENGINE.md](./ENGINE.md) |
| Périmètre produit, données, cadre légal | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Écrans, jetons visuels, badge de preuve | [DESIGN.md](./DESIGN.md) |
| Règles d'écriture du contenu Savoir | [../catalog/tips/README.md](../catalog/tips/README.md) · [../catalog/evidence/README.md](../catalog/evidence/README.md) |
| Stores, hébergement, modèle économique | [STRATEGIE_DISTRIBUTION.md](./STRATEGIE_DISTRIBUTION.md) |
| **Mode cuisine** : ordre des lots, prérequis, essai sur appareil | [CONCEPTION_MODE_CUISINE.md](./CONCEPTION_MODE_CUISINE.md) |
| **Session du 2026-08-05** : gardes, index, décisions 51 et 33 | [archive/RECAP_SESSION_2026-08-05_gardes_et_decisions.md](./archive/RECAP_SESSION_2026-08-05_gardes_et_decisions.md) |
| Ce qui a été essayé **et écarté**, et pourquoi | [archive/](./archive/) |
| **Pièges, impasses, règle de sourçage du contenu** | [reference/PIEGES.md](./reference/PIEGES.md) |
| Les invariants du moteur, les commandes de vérification | [../CLAUDE.md](../CLAUDE.md) |
| Sections datées sorties de cette fiche le 2026-08-03 | [archive/FICHE_REPRISE_extraits_2026-08-03.md](./archive/FICHE_REPRISE_extraits_2026-08-03.md) |
| **Blocs sortis de cette fiche le 2026-08-07**, et où leur fait vit maintenant | [archive/FICHE_REPRISE_extraits_2026-08-07.md](./archive/FICHE_REPRISE_extraits_2026-08-07.md) |
| **Blocs sortis le 2026-08-09** — dont « l'arbre est propre », qui a eu tort en 48 h | [archive/FICHE_REPRISE_extraits_2026-08-09.md](./archive/FICHE_REPRISE_extraits_2026-08-09.md) |
| **Les sauces** : pourquoi le choix s'attache au plat, les trois garanties, les deux défauts | [archive/RECAP_SESSION_2026-08-09_sauces.md](./archive/RECAP_SESSION_2026-08-09_sauces.md) |
| **Pourquoi le manque de contenu est dans les PLATS**, la bissection des 2 rouges, les aliments refusés | [archive/RECAP_SESSION_2026-08-07_recettes-aliments.md](./archive/RECAP_SESSION_2026-08-07_recettes-aliments.md) |
| **Pourquoi la recherche d'aliments a été refaite**, et les deux mappings Ciqual faux | [archive/RECAP_SESSION_2026-08-05_recherche-aliments.md](./archive/RECAP_SESSION_2026-08-05_recherche-aliments.md) |
| **Le tri des photos** : le barème complet, les décisions en attente, la commande de régénération | `../atelier/photos/REPRISE.md` (hors dépôt) |
| **Pourquoi 220 recettes n'ont rien reçu**, ce que l'import n'aura pas à faire, les 231 plats hors catalogue | [archive/RECAP_SESSION_2026-08-09_photos-fin-du-tri.md](./archive/RECAP_SESSION_2026-08-09_photos-fin-du-tri.md) |
| **Pourquoi « les filets » chiffre maintenant**, le nombre × 8 qu'aucun test ne voyait, les trois sens d'un mot de portion | [archive/RECAP_SESSION_2026-08-09_quantites-portions.md](./archive/RECAP_SESSION_2026-08-09_quantites-portions.md) |
| **Pourquoi la récolte de photos n'était pas ciblée**, et le barème d'acceptation | [archive/RECAP_SESSION_2026-08-07_photos.md](./archive/RECAP_SESSION_2026-08-07_photos.md) |
| **Pourquoi l'alarme ne sonne pas appli fermée**, et pourquoi la recette n'avance pas seule | [archive/RECAP_SESSION_2026-08-05_mode-cuisine.md](./archive/RECAP_SESSION_2026-08-05_mode-cuisine.md) |
| **Pourquoi la durée déclarée d'une recette était fausse sur 143 sur 308**, et pourquoi « inatteignable en pratique » se mesure | [archive/RECAP_SESSION_2026-08-09_cuisine-multi-plats.md](./archive/RECAP_SESSION_2026-08-09_cuisine-multi-plats.md) |
