# Extraits datés sortis de la fiche de reprise le 2026-08-07

> **Instantané daté — ne jamais réécrire.** Ces blocs viennent de `FICHE_REPRISE.md`, où ils
> décrivaient des faits **vrais à leur date**. Ils en sortent parce que la fiche avait regrimpé à
> **241 lignes pour un plafond dur de 100** — le même glissement qu'au 2026-08-03, et pour la même
> raison : chaque lot livré y ajoutait son récit et aucun n'en repartait.
>
> Rien n'est perdu et rien n'est corrigé : les blocs sont recopiés **tels quels**, avec les nombres
> qu'ils portaient. Plusieurs sont donc faux aujourd'hui — 241 recettes, 282 recettes, 450 aliments.
> C'est voulu. ⚠️ **Ne jamais s'en servir pour établir l'état courant**, qui est dans
> [../FICHE_REPRISE.md](../FICHE_REPRISE.md) et [../ETAT.md](../ETAT.md).
>
> Précédent identique : [FICHE_REPRISE_extraits_2026-08-03.md](./FICHE_REPRISE_extraits_2026-08-03.md).

## Pourquoi ces blocs-là, et pas d'autres

Le critère de tri n'est pas l'âge, c'est **le doublon**. Chacun de ces blocs raconte un lot
*terminé* dont le fait durable vit déjà ailleurs :

| Bloc sorti | Où le fait vit maintenant |
|---|---|
| Plancher calorique, décisions 45, 58, 59, 41 | `ETAT.md` §3 et §4 — une décision se range à un seul endroit |
| Le mode cuisine, lot par lot | `CONCEPTION_MODE_CUISINE.md` (plan de montée) et `ARCHITECTURE.md` §5bis (spec) |
| Le chantier d'accompagnements et son diagnostic faux | [RECAP_SESSION_2026-08-07_recettes-aliments.md](./RECAP_SESSION_2026-08-07_recettes-aliments.md) §2 |
| Les vérifications sur commit, le découpage par hunks, les deux sessions | `reference/PIEGES.md` — c'est un piège de méthode, pas un état |
| La vérification sanitaire des recettes | `ARCHITECTURE.md` §5 bis, quater et quinquies |

Ce qui **reste** dans la fiche : l'état vérifié du jour, l'action récurrente qu'aucun test ne peut
porter, les chantiers non commencés, et la table « où chercher le reste ». Rien d'autre.

---

## Le dépôt au 2026-08-06

✅ **TOUT EST COMMITÉ AU 2026-08-06 — `main` est en avance de 3 commits, RIEN N'EST EN VOL.**
`b16b16e` mode cuisine + 41 accompagnements (piste parallèle) · `1a79159` sauvegarde (décision 59) ·
`04e2b92` unités d'achat (décision 41). **Reste à POUSSER** — Claude committe, l'utilisateur pousse.

⛔ **DEUX PISTES ONT ÉCRIT EN MÊME TEMPS, ET LE DÉCOUPAGE A FAILLI COÛTER CHER.** Elles se croisaient
sur quatre fichiers (`main.tsx`, `user-store.ts`, `ETAT.md`, `ARCHITECTURE.md`). Découper l'index par
hunks avec **`git apply --unidiff-zero` a produit un commit qui NE COMPILAIT PAS** : sans contexte,
git pose les hunks aux numéros de ligne littéraux, et retirer un hunk décale tous les suivants —
`user-store.ts` est ressorti syntaxiquement invalide. **C'est la vérification sur le commit qui l'a
attrapé, pas la relecture.** Méthode saine, à réemployer : ne pas sélectionner les hunks à garder,
mais **retirer les siens du fichier complet** (`git apply --reverse` avec contexte 3), indexer, puis
restaurer l'arbre. ⚠️ **Et deux hunks distants de moins de 3 lignes sont INSÉPARABLES** — les
décisions 59 et 60 d'`ETAT.md` sont dans ce cas, d'où le fichier parti en entier avec `04e2b92`.

⛔ **TROIS EXÉCUTIONS DE `npm test` ONT ROUGI PENDANT CETTE SESSION, POUR DEUX CAUSES DISTINCTES.**
Deux ont attrapé le lot (b) **à mi-écriture** (geste de lexique introuvable, collision de nom de
recette). La troisième était un **timeout à 5 000 ms** qui changeait de fichier à chaque passage,
avec une durée totale passée de 38 s à 64 s : de la **contention machine**, deux suites tournant en
même temps. **Aucune n'était une régression** — isolation verte, puis suite complète verte
(1 556 passed). ⚠️ **Ne pas conclure « flaky » sans faire cette vérification** : les deux premières
n'étaient PAS du flaky, elles lisaient un dépôt incohérent.

✅ **Vérifié SUR LE COMMIT le 2026-08-06, les TROIS, dans un worktree isolé** (jonction
`node_modules`, catalogue rebâti à chaque fois) : `b16b16e` → **1 512 passed (84 fichiers)** ·
`1a79159` → **1 546 passed** · `04e2b92` → **1 556 passed (85 fichiers)**, typecheck propre,
`vite build` ✓, `engine:plan-stress` **20/20**, `catalog/build.mjs` → **450 aliments, 282 recettes**.
**Aucun commit intermédiaire n'est rouge** — c'est ce contrôle-là qui a rattrapé le découpage raté.

✅ **Vérifié SUR LE COMMIT, pas sur l'arbre de travail** — `2c10db4` sorti dans un worktree isolé,
catalogue rebâti, puis `vitest` / `tsc` / `vite build` : **1 492 passed (84 fichiers)**, typecheck
propre, build ✓. C'est la parade au piège « ce qu'on commite n'est pas ce qu'on a testé »
([reference/PIEGES.md](../reference/PIEGES.md)), qui avait poussé `main` rouge la veille. ⚠️ **Un
test a échoué au premier passage puis est passé au second** — `main.test.tsx`, dialogue « Une visite
guidée ? », sous la charge du build : **bascule de minutage à surveiller**, pas une régression.

⛔ **DEUX SESSIONS DANS UN MÊME DÉPÔT : ce qui a coûté cher.** Cinq fichiers étaient édités des deux
côtés (`user-schema.ts`, `user-store.ts`, `user-store.test.ts`, `ARCHITECTURE.md`, `ETAT.md`).
Reconstruire l'index à la main pour ne commiter que ses propres modifications a **poussé `main`
rouge** — les quatre commandes vérifiaient l'arbre, pas l'index. Avant de refaire ça, lire
[reference/PIEGES.md](../reference/PIEGES.md) § « Ce qu'on commite n'est pas ce qu'on a testé ».
**Claude committe, l'utilisateur pousse** — le shell agent ne peut pas s'authentifier auprès de
GitHub.

⚠️ **Trois pistes ont travaillé en parallèle sur la période 2026-07-31 → 2026-08-01**, dans trois
conversations séparées. Pour comprendre ce qui s'est passé, il faut lire les TROIS récits :
[RECAP_SESSION_6.md](./RECAP_SESSION_6.md) (contenu de Savoir),
[RECAP_SESSION_7.md](./RECAP_SESSION_7.md) (tests d'écran, correctifs d'usage) et
[RECAP_SESSION_8.md](./RECAP_SESSION_8.md) (revue design & accessibilité, décisions
photo obligatoire et Capacitor). ⚠️ **Le 2026-08-05 a porté trois pistes de la même façon** —
gardes & décisions, recherche d'aliments, mode cuisine : voir [ce dossier](./).

## Les décisions livrées, du 2026-08-04 au 2026-08-06

✅ **La régression de plancher calorique du 2026-08-03 est CORRIGÉE le 2026-08-04** (décisions 53
et 54 d'`ETAT.md` §4). Cause : `planWeek` posait des PLATS là où `checkCalorieFloor` mesure une
JOURNÉE — la comparaison n'a jamais été homogène. Le planificateur pose désormais un accompagnement
en plus du plat aux repas principaux. Mesuré sur 20 graines × 7 jours (`npm run engine:plancher`) :
**min 813 → 1 302 kcal, médiane 1 023 → 1 528, et 0/20 → 20/20 semaines sans aucun avertissement**.

✅ **La décision 45 est tranchée le 2026-08-04 : on reste sur l'alerte MASQUÉE par défaut.** Ce n'est
plus une prémisse fausse mais un choix assumé et daté, ce que §6.5 ARCHITECTURE demandait. Ne pas
rouvrir sans élément neuf.

✅ **La décision 58 est FERMÉE EN ENTIER le 2026-08-05** — « on ne trouve pas son aliment ». Ses
quatre causes : recherche par sous-chaîne (corrigée), noms d'usage absents (champ `synonymes`),
**352 aliments sur 450 injoignables** (fenêtre « Parcourir tous les aliments », les trois écrans),
et le classement qui rend un faux ami (neutralisé par le parcours, **non corrigé**). La cause (3) —
un aliment que le catalogue n'a pas — est close en **« non corrigée, ASSUMÉE, documentée »** :
l'appli le dit, et dissuade de prendre un voisin (ce serait ses allergènes qu'on appliquerait).
⛔ **Ne pas rouvrir sans lire la ligne 58 d'`ETAT.md` §4** : elle porte quatre ⛔, dont « pourquoi ne
pas importer tout le Ciqual » (mesuré : **5 des 6 manquants sont absents du Ciqual aussi**).

✅ **LA SAUVEGARDE EXISTE — décision 59, 2026-08-06.** §7 ARCHITECTURE annonçait « le point faible
identifié de la PWA, à traiter en v1 » et posait sept mesures : **3, 4 et 5 n'étaient pas codées.**
Une appli sans compte ni serveur n'avait **aucun** chemin de récupération. Livré : fichier
`.nutri-backup` (les octets SQLite, **pas** du JSON — une liste de 24 tables écrite à la main serait
fausse au premier ajout, et muette), restauration **validée dans une base jetable avant de remplacer
quoi que ce soit**, rappel passé 14 jours **dans Paramètres seulement**. Au passage, deux colonnes
déclarées et jamais écrites sont branchées (`app_meta.dernier_export_le`, `user_profile.cree_le`), et
**le verrou multi-onglets est posé** (`navigator.locks`) : deux onglets s'écrasaient en silence.
⚠️ **La relecture a trouvé deux pertes SILENCIEUSES dans mon propre code**, corrigées le même jour —
un drapeau de gel jamais levé après échec d'écriture, et la restauration qui ne vérifiait pas le
verrou. **Les deux étaient des chemins d'écriture non gardés** : voir décision 59.
⚠️ **Mesures 2 (installation avant saisie) et 7 (quota) restent NON faites.**

✅ **LA LISTE DE COURSES PARLE ENFIN COMME UN RAYON — décision 41, 2026-08-06.** « 3 pièce » →
« 3 pièces », « 1000 g » → « 1 kg », et « 500 g » de beurre dit désormais « (2 × 250 g) ».
⚠️ **Le diagnostic de départ était FAUX et c'est la leçon du lot** : `poidsPieceG` était déjà converti
par le moteur depuis le premier jour ; seul `conditionnementG` manquait à l'affichage. **Vérifier ce
que le code fait avant d'annoncer ce qui manque.** Le format vivait en trois copies — dont l'export
texte de « Partager » — et vit maintenant dans `Vue.quantiteDe`, une seule fois. ⚠️ **« 2 × 250 g » et
non « 2 plaquettes »** : le catalogue porte un nombre, aucun nom d'emballage — nommer les 226
conditionnements serait un lot de contenu, pas d'affichage.

## Le chantier d'accompagnements, et son diagnostic démenti (2026-08-06)

> Le récit complet, avec les mesures et les cinq autres affirmations que la mesure a démenties, est
> dans [RECAP_SESSION_2026-08-07_recettes-aliments.md](./RECAP_SESSION_2026-08-07_recettes-aliments.md).

✅ **LE CHANTIER D'ACCOMPAGNEMENTS EST FAIT — ET SON DIAGNOSTIC ÉTAIT FAUX (2026-08-06).** Cette
fiche annonçait : « ces régimes n'ont pas assez d'accompagnements (18 posés sur 28 attendus) —
écrire des accompagnements végétaliens et sans gluten fait tomber ces deux chiffres, et c'est la
seule chose qui les fera tomber ». **Mesuré faux.** Les accompagnements végétaliens sont passés de
**11 à 29** et le compteur n'a pas bougé d'une unité : **18 posés sur 28, avant comme après**.

⛔ **LA CAUSE EST DANS LES PLATS.** `pickAccompagnement` sort si la recette posée n'est pas
`service: 'plat'`, et `placedRecipeIds` interdit de reposer un plat dans la fenêtre — sans quoi le
planning rendrait sept fois le même dîner. Le végétalien n'avait que **18 plats de repas principal
pour 28 créneaux** : les 10 autres tombaient sur une entrée via la seconde passe de `pickForSlot`,
et n'obtenaient donc **aucun** accompagnement. **« 18 accompagnements posés » n'était pas une mesure
des accompagnements — c'était le nombre de plats, compté sous un autre nom.** Écrire **10 plats** a
porté le compte à **28/28** et les 5 avertissements à **0**.

Lot livré : **41 recettes végétaliennes ET sans gluten** — 13 petits-déjeuners (il y en avait **1**
sur 14 attendus), 18 accompagnements, 10 plats. Catalogue **241 → 282**. « sans gluten NI lait NI
œuf » passe de 16/21 créneaux à **21/21**.

⚠️ **CE QUI RESTE** : « végétalien + sans gluten » garde **3 créneaux vides sur 56** et 21
accompagnements sur 28 — même cause, même correctif : **des plats**. ✅ **`engine:plan-stress` le
dit désormais tout seul** (état `SIGNAL`) au lieu de l'enfouir derrière « 20/20 configurations
saines », ce qu'il a fait pendant toute la durée du défaut.

## Le mode cuisine, lot par lot (état au 2026-08-07)

> Statut vivant : [../CONCEPTION_MODE_CUISINE.md](../CONCEPTION_MODE_CUISINE.md) · spec :
> `ARCHITECTURE.md` §5bis · récit : [RECAP_SESSION_2026-08-05_mode-cuisine.md](./RECAP_SESSION_2026-08-05_mode-cuisine.md).

▶ **LE MODE CUISINE TOURNE** (décision 8 fermée le 2026-08-04). ✅ **L0 et L1
faits** — `recipe_step.nature`, puis l'écran `#/cuisine/<id>` : écran allumé, une étape à la fois qui
**n'avance jamais seule**, minuteurs parallèles, alarme au premier plan, reprise (schéma **v10**).
Les 512 minuteurs sont enfin visibles. ✅ **L1bis fait le 2026-08-06** — les **ingrédients et leurs
quantités** s'ouvrent en fenêtre depuis n'importe quelle étape, et les portions réglées sur la fiche
suivent la cuisson (schéma **v11**). L'écran tenait la recette entière en mémoire et n'en montrait
aucun ingrédient. ✅ **L1ter fait le 2026-08-07** — les **gestes du lexique** se déplient sur place
dans l'étape courante (`ui/gestes-etape.tsx`, partagé avec la fiche). Même motif : la donnée était
déjà là. ▶ **Ces deux lots épuisent ce que le mode cuisine gagnait sans donnée nouvelle.**
⛔ **L2 N'EST PLUS LA SUITE — il est SUSPENDU, décision 60 d'`ETAT.md` §4.** Sa justification reposait
sur « `food` n'a ni synonyme ni alias », **faux depuis le 2026-08-05** (décision 58, piste
parallèle), et sur un rapprochement mesuré contre **450 aliments** au lieu des **7 de la recette**.
Le besoin qu'il servait est couvert par L1bis, sans une seule des 1 101 annotations. ▶ **Ce qui
décide de la suite : se servir du panneau en cuisinant.** S'il suffit, L2 meurt ; sinon, **mesurer
d'abord** le pré-remplissage automatique (certain / ambigu / rien trouvé) avant de construire quoi
que ce soit.
✅ **Pas d'entrée de visite guidée pour la cuisine — tranché le 2026-08-07**, ce n'est plus une dette :
la lancer depuis Réglages naviguerait vers un `#/cuisine/<id>` en dur, et ouvrir cet écran **écrit
la session de cuisson** (une seule ligne) — le tutoriel effacerait la cuisson en cours.
⛔ **L'alarme ne sonne PAS quand l'appli est fermée — c'est une décision instruite, pas un oubli** :
les quatre voies Android coûtent toutes plus qu'elles ne rapportent. Ne pas la rouvrir sans lire
`CONCEPTION_MODE_CUISINE.md` §5.

## La vérification sanitaire des recettes (2026-08-03)

✅ **La vérification sanitaire des recettes est terminée** (2026-08-03) : viandes et volailles
(§5 bis), poissons, œufs et coquillages (§5 quater), puis crus et œufs peu cuits (§5 quinquies —
**18 recettes** portent la mention des populations sensibles, sourcée ANSES et ministère de
l'Agriculture). ⚠️ **Deux trous restent déclarés, non comblés** : les céphalopodes (`calamar`,
`poulpe`), et le critère de cuisson de l'œuf qu'aucune autorité lue ne donne.
