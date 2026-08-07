# ⭐ Fiche de reprise — appli_nutrition

> **Une page, jamais plus — plafond dur : 100 lignes.** État vérifié + prochaine étape, rien d'autre.
> Avancement détaillé, décisions et dette : [ETAT.md](./ETAT.md) · Index : [README.md](./README.md).
> Font foi : [ENGINE.md](./ENGINE.md) (moteur), [ARCHITECTURE.md](./ARCHITECTURE.md) (le reste).
> *Dégonflée deux fois : 341 → ~95 lignes le 2026-08-03, puis **285 → 193** le 2026-08-07. Rien
> n'est perdu — les blocs sortis sont recopiés verbatim dans
> [archive/FICHE_REPRISE_extraits_2026-08-07.md](./archive/FICHE_REPRISE_extraits_2026-08-07.md),
> qui dit aussi, bloc par bloc, où le fait durable vit désormais.*
> ⛔ **193 LIGNES : LE PLAFOND EST TOUJOURS DÉPASSÉ, ET C'EST DÉLIBÉRÉ.** N'ont été retirés que les
> blocs faisant DOUBLON avec `ETAT.md`, `PIEGES.md` ou un document de chantier. Ce qui reste décrit
> des chantiers EN COURS (photos, lots non commités, 2 tests rouges) : ça n'a pas encore d'autre
> domicile. **Chacun de ces blocs part le jour où son chantier se ferme.**
> ⚠️ **Le glissement est structurel** : chaque lot livré ajoute son récit ici et aucun n'en repart.
> Quand un lot est fini, son fait va dans `ETAT.md` ou son document de chantier — pas sur cette page.

## Le projet

Planificateur de repas **100 % local, sans IA, sans compte**. Moteur TypeScript pur, catalogue
SQLite construit au build, PWA React servie en statique.

## Où on en est

```
MOTEUR ✅ ─ CONTENU ✅ ─ user.db ✅ ─ DESIGN ✅ ─ 9 ÉCRANS ✅ ─ TESTS D'ÉCRAN ✅ ─▶ CONTENU & DISTRIBUTION ▓▓
                                                                                          ⬅ ICI
```

✅ **SUITE RÉEXÉCUTÉE LE 2026-08-07, EN FIN DE JOURNÉE, SUR L'ARBRE DE TRAVAIL.**
`npm test` → **1 645 passed / 2 failed (1 647)**, **1 fichier rouge sur 91**, en 50,8 s ·
`npm run typecheck` propre · `npx vite build` ✓ (2,9 s) · `npm run engine:plan-stress` → **20/20**
avec **1 SIGNAL** (végétalien + sans gluten — le moteur est correct, c'est le catalogue qui manque) ·
`node catalog/build.mjs` → **450 aliments, 297 recettes, 1 368 étapes, 62 gestes, 73 tips, 8 fiches**.

⚠️ **LES 2 ÉCHECS RESTANTS NE VIENNENT PAS DE LA COUCHE `piquant`, ET C'EST VÉRIFIÉ, PAS SUPPOSÉ.**
Une version antérieure de cette page attribuait **9** échecs à la décision 35 ; sept l'étaient
bien — des tables de recensement qui attendaient les anciens comptes (`LAYER_DESCRIPTORS` 18 → 19,
couches de score 11 → 12, `SCORING_LAYERS` 8 → 9, `piquant` partout `null`) — **et sont corrigés.**
Les deux qui restent sont dans `ui/screens/aujourdhui.test.tsx` : *« choisir un autre créneau change
les suggestions »* et *« choisir un plat remet le compteur d'indécision à zéro »*.
**Falsification faite** : la couche `piquant` retirée de `SCORING_LAYERS`, ces deux tests **restent
rouges à l'identique**. Cause réelle : le lot de contenu `e3bc94c` (« cinq classiques français ») a
fait entrer *Pizza maison tomate-mozzarella*, qui domine désormais **deux créneaux à la fois** — et
le test compare UN plat affiché pour prouver que la liste change.
⛔ **NE PAS « CORRIGER » EN CHANGEANT L'ASSERTION SANS DÉCIDER** : le produit n'a jamais promis que
deux créneaux proposent des plats différents. C'est l'assertion qui est trop forte, pas le moteur
qui régresse — mais c'est un arbitrage, pas un ajustement.

⚠️ **Piège de relevé, déjà payé le 2026-08-07** : `npm test 2>&1 | tail -25` rend le code de sortie
du **pipe**, donc 0. Lire le compte `Tests N failed`, jamais `$?`.
⚠️ Ces nombres bougent à chaque commit : **la sortie réelle fait foi, jamais cette ligne.**

**L'application fait sa boucle complète** : s'installer → déclarer ses allergies → voir une
suggestion → planifier sa semaine → sortir sa liste de courses → cuisiner. Plus « partir de ce
qu'on a », un lexique de 62 gestes, et l'onglet Savoir complet.

⚠️ **`git status -sb` donne l'état, jamais cette page.** Un nombre écrit ici est faux dès le commit
suivant.

✅ **Mesuré aussi SUR LE COMMIT `11687d4`** (branche `recette-aliments`, worktree détaché, arbre
propre), pour séparer ce qui est committé de ce qui traîne dans l'arbre : `catalog/build.mjs` →
**451 aliments, 297 recettes, 62 gestes, 73 tips, 8 fiches** · `npm test` → **2 failed / 1 554 passed
(1 556)** · typecheck propre · `vite build` ✓ · `plan-stress` **20/20 + 1 SIGNAL**.
⚠️ **Dans un worktree neuf, `node catalog/build.mjs` passe AVANT tout le reste** : `catalog.db` est
un artefact gitignoré, et son absence rend **203 échecs** qui ne veulent rien dire.

⛔ **RIEN N'EST COMMITÉ AU 2026-08-07, ET TROIS PISTES PARTAGENT LE MÊME ARBRE DE TRAVAIL.**
HEAD est sur **`recette-aliments`**, pas sur `main` ni sur `dev-features`. ⚠️ **Cette branche a été
créée par la piste CONTENU** (recettes & aliments, 4 commits, `4550cad` → `11687d4`) **et les deux
autres pistes travaillent dessus sans l'avoir choisie** — c'est un partage de fait, pas une
convention. Au 2026-08-07, **355 fichiers modifiés dans l'arbre** n'appartiennent PAS à la piste
contenu, dont un champ `piquant` ajouté aux 297 recettes.
L'arbre mélange **trois lots non commités** :
  1. **décision 33** — fiche aliment `#/aliment/<id>`, cotes ANSES affichées, `ui/saison.ts` ;
  2. **décision 35** — piquant : 297 fiches annotées, migration **v12**, couche de score `piquant` ;
  3. **dette §8** — `tests/engine-version-consistency.test.mjs`, `--historique` au banc, piège à
     focus de `Panneau`, plus la piste parallèle (`gestes-etape.tsx`, liens étape → ingrédient).
⚠️ **Le découpage est à faire AVANT tout commit**, et `reference/PIEGES.md` dit comment — pas avec
`git apply --unidiff-zero`, qui a déjà produit un commit qui ne compilait pas.
**Claude committe, l'utilisateur pousse.**

⛔ **VÉRIFIER UN SOUS-ENSEMBLE DE FICHIERS N'EST PAS VÉRIFIER UN COMMIT — c'est comme ça que le rouge
ci-dessus est passé.** `e3bc94c` a été committé après une vérification en worktree isolé **ne
contenant que les deux fichiers du dernier lot**, posés sur `main` : les 15 recettes des deux commits
précédents n'y étaient pas. **Le worktree se détache sur la RÉFÉRENCE**, pas sur une sélection de
fichiers. Bissection et mesures :
[archive/RECAP_SESSION_2026-08-07_recettes-aliments.md](./archive/RECAP_SESSION_2026-08-07_recettes-aliments.md) §5.

⚠️ **Le travail à deux dans un même dépôt a déjà coûté cher trois fois** — un `main` poussé rouge, un
commit qui ne compilait pas, un lot emporté par la session voisine. Méthode, découpage et
contre-exemples : **[reference/PIEGES.md](./reference/PIEGES.md)** et
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

⚠️ **LE MANQUE DE CONTENU EST DANS LES PLATS, JAMAIS DANS LES ACCOMPAGNEMENTS** — mesuré le
2026-08-06, contre le diagnostic que cette page portait. Tripler les accompagnements végétaliens
(11 → 29) n'a pas bougé le compteur d'une unité ; écrire **10 plats** l'a porté de 18 à 28 sur 28.
`pickAccompagnement` sort si la recette posée n'est pas `service: 'plat'`. **Le SIGNAL restant du
banc se lit donc « il manque des PLATS ».** Détail :
[archive/RECAP_SESSION_2026-08-07_recettes-aliments.md](./archive/RECAP_SESSION_2026-08-07_recettes-aliments.md) §2.

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
3. **Empaquetage Capacitor, puis Play.** ⚠️ **La cible n'est plus TWA/Bubblewrap** — décision du
   2026-08-01, `archive/RECAP_SESSION_8.md` §3. `capacitor.config.ts` et `@capacitor/*` sont en
   place ; `npx cap add android` n'a jamais été lancé (pas de SDK sur la machine). **Ni origine
   HTTPS ni `/.well-known/assetlinks.json` ne sont requis** pour cette cible. Une version web reste
   utile — c'est le seul chemin vers un iPhone tant qu'il n'y a pas de Mac (§4 décision 9).

**Contenu qui reste** : **photos**, lexique illustré, 27 tips pour la centaine visée, 8 fiches sur
les 60-100 de §8.2. Rien de tout cela n'est un problème de code.

▶ **LE TRI DES PHOTOS A COMMENCÉ — 2026-08-06 → 08-07.** Outil : `atelier/photos/` (**gitignoré,
hors de `app/`**, `vite.config.ts` pose `root: 'app'`). Reprise du chantier :
**`atelier/photos/REPRISE.md`** · récit : **[archive/…_photos.md](./archive/RECAP_SESSION_2026-08-07_photos.md)**.
Au 2026-08-07 : **10 photos tranchées par l'humain**, **9 propositions** en attente de confirmation
à l'écran, **272 couples (image × recette) jugés** par la passe, **211 recettes encore à voir** et
**68 sans aucune candidate**. ⚠️ **La passe PROPOSE, elle ne tranche pas** — elle n'écrit que dans
`etat/ma-passe.jsonl`, jamais dans `decisions.json`.
⚠️ **`image_path` n'est encore posé nulle part** : l'étape d'import (AVIF/WebP sous 40 Ko, entrées
de `CREDITS.md`) **n'est pas écrite**. Trier n'est pas rattacher.
⛔ **La récolte n'était ciblée que pour 254 dossiers sur 413** — `lire_csv` de `chercher_photos.py`
retombe **en silence** sur le slug de recette quand la colonne de requête est vide, d'où des fleurs
de *crepe jasmine* et une libellule dans `photos/crepes/`. Rendement mesuré : **5/90** de `oui` sur
un dossier ciblé (5,6 %) contre **4/182** sans (2,2 %). ▶ **Récolter d'abord vaut mieux que trier
plus** : le fichier
`recettes-appli.csv` (224 recettes, vérifié) attend dans `G:\Claude\Dessinateur\recettes\`, et
**c'est à l'utilisateur de le lancer** — réseau et clés API.

▶ **LE MODE CUISINE TOURNE** — L0, L1, L1bis et L1ter faits ; **L2 est SUSPENDU** (décision 60).
Spec : `ARCHITECTURE.md` §5bis · état et ordre des lots :
**[CONCEPTION_MODE_CUISINE.md](./CONCEPTION_MODE_CUISINE.md)** · récit :
[archive/…_mode-cuisine.md](./archive/RECAP_SESSION_2026-08-05_mode-cuisine.md) · le détail des lots
tel qu'il figurait ici : [archive/FICHE_REPRISE_extraits_2026-08-07.md](./archive/FICHE_REPRISE_extraits_2026-08-07.md).
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
| **Pourquoi le manque de contenu est dans les PLATS**, la bissection des 2 rouges, les aliments refusés | [archive/RECAP_SESSION_2026-08-07_recettes-aliments.md](./archive/RECAP_SESSION_2026-08-07_recettes-aliments.md) |
| **Pourquoi la recherche d'aliments a été refaite**, et les deux mappings Ciqual faux | [archive/RECAP_SESSION_2026-08-05_recherche-aliments.md](./archive/RECAP_SESSION_2026-08-05_recherche-aliments.md) |
| **Le tri des photos** : où en est la file, le barème, la récolte à relancer | `../atelier/photos/REPRISE.md` (hors dépôt) |
| **Pourquoi la récolte de photos n'était pas ciblée**, et le barème d'acceptation | [archive/RECAP_SESSION_2026-08-07_photos.md](./archive/RECAP_SESSION_2026-08-07_photos.md) |
| **Pourquoi l'alarme ne sonne pas appli fermée**, et pourquoi la recette n'avance pas seule | [archive/RECAP_SESSION_2026-08-05_mode-cuisine.md](./archive/RECAP_SESSION_2026-08-05_mode-cuisine.md) |
