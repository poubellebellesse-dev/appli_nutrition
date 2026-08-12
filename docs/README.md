# Index de la documentation

**Treize documents vivants**, quatre rôles (plus ce fichier, qui n'est que l'index, et [reference/](./reference/), qui porte les parties du moteur et les pièges). Il dit **lequel
lire**, **lequel fait foi**, et **lequel ne doit jamais être réécrit**.

> Les instantanés datés — récits des sessions 1 à 7 et audit du 2026-07-27 — sont dans
> [archive/](./archive/) : ils ne décrivent plus l'état du projet. Ils ne sont ni faux ni
> supprimables, voir [archive/README.md](./archive/README.md).

## Par où commencer

0. **[../CLAUDE.md](../CLAUDE.md)** — chargé automatiquement à chaque session : ce qu'on construit,
   les invariants, les commandes de vérification, la carte de cette doc. Rien à faire, il est déjà là.
1. **[FICHE_REPRISE.md](./FICHE_REPRISE.md)** — ⭐ à lire en premier à chaque reprise. Une page :
   où on en est, quoi faire ensuite, ce qu'il ne faut pas défaire.
2. **[ETAT.md](./ETAT.md)** — l'état complet quand la fiche ne suffit pas : avancement détaillé,
   décisions figées, décisions ouvertes.
3. Puis le document de référence correspondant au sujet (ci-dessous).

## Les quatre rôles

### 📐 Référence — **font foi** en cas de contradiction

| Document | Périmètre |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Périmètre produit, modèle de données, cadre santé et réglementaire, contenu, risques |
| [ENGINE.md](./ENGINE.md) | **Index du moteur.** Découpé le 2026-08-03 en 8 parties dans [reference/](./reference/) — 2 126 lignes → 8 fichiers de 122 à 355 lignes, contenu et numérotation de sections inchangés. Toute référence `ENGINE §x.y` reste valide |
| [reference/PIEGES.md](./reference/PIEGES.md) | Pièges de build, navigateur, moteur et interface · règle de sourçage du contenu Savoir · les impasses déjà payées. Sorti de `FICHE_REPRISE.md` le 2026-08-03 |
| [reference/CONCURRENCE_ET_ATTENTES.md](./reference/CONCURRENCE_ET_ATTENTES.md) | Ce que les utilisateurs demandent — et reprochent — aux applications comparables. Sourcé et daté, avec la qualité de chaque source : plusieurs des formules les plus citées viennent de blogs de concurrents. Relevé le 2026-08-04 |
| [reference/LICENCES_MEDIAS.md](./reference/LICENCES_MEDIAS.md) | Licences des médias embarqués — clauses **citées avec URL et date**, et la liste de ce qui n'a **pas** pu être vérifié. Pexels (les **51 gestes illustrés, 98 segments encodés**) et CapCut, écarté de la production. Relevé le 2026-08-11 · la question ouverte est `ETAT.md` §4 **69** |
| [DESIGN.md](./DESIGN.md) | Écrans, navigation, jetons visuels, badge de preuve |

Ordre d'autorité quand deux documents se contredisent : **le code fait foi**, puis `ENGINE.md` sur
tout ce qui touche le moteur, puis `ARCHITECTURE.md` sur le reste. Une contradiction constatée se
corrige dans le document, elle ne se contourne pas dans le code.

### 🧭 État — se réécrivent à chaque session

| Document | Rôle |
|---|---|
| [FICHE_REPRISE.md](./FICHE_REPRISE.md) | Point de reprise condensé. **Une page, jamais plus — plafond dur : 100 lignes.** Ramenée de 341 à 100 lignes le 2026-08-03. |
| [ETAT.md](./ETAT.md) | État complet, avancement, décisions figées et ouvertes. |

> **Règle d'unicité** : chaque fait vit à UN SEUL endroit. La fiche donne l'état vérifié et la
> prochaine étape ; tout le reste — avancement détaillé, décisions, **dette connue** (`ETAT.md` §8)
> — est dans `ETAT.md`, et la fiche ne fait qu'y renvoyer. Si la fiche dépasse une page, c'est
> qu'elle a repris quelque chose qui appartient à `ETAT.md`.

### 📖 Instantanés datés — **ne jamais réécrire**

Tous rangés dans [archive/](./archive/) — voir [archive/README.md](./archive/README.md) pour le
détail. Deux repères :

| Document | Ce qu'il consigne |
|---|---|
| [archive/RECAP_SESSION_2026-08-11_clips-gestes.md](./archive/RECAP_SESSION_2026-08-11_clips-gestes.md) | **Les clips des 62 gestes** — 55 récoltés, 51 retenus, **98 segments de 3 s encodés et sourcés**. ⭐ À lire pour sa §2 : **un manifeste a menti sur 53 clips sur 55 sans qu'aucune erreur s'affiche**, et **la première correction a propagé le mensonge** parce qu'elle réparait depuis la copie corrompue. §5 : une projection de poids **fausse d'un facteur 3 à 4 sans qu'un seul réglage ait bougé** — c'est la FORME du livrable qui avait changé. §6 : la clause Pexels qui mord n'est pas celle qu'on croyait |
| [archive/RECAP_SESSION_2026-08-11_photos-recadrage.md](./archive/RECAP_SESSION_2026-08-11_photos-recadrage.md) | **Le recadrage carré des photos** — livré dans `atelier/`, **zéro ligne de dépôt touchée**. ⭐ À lire pour sa §2 : **un écran de relecture VIDE lu comme une fin de tri**, alors que le serveur figeait son index au démarrage — le diagnostic est venu d'un processus vivant rendant deux compteurs contradictoires, pas d'une relecture de code. **Et le vivier de repêchage vaut 39 OU 416 images selon la largeur du regex** : un compte par mots-clés n'est pas une mesure. **§3 : les pièges de requête** — un ingrédient qui nomme un plat célèbre ramène ce plat (sarrasin → soba, érable → pancakes). ⛔ **§5 fixe un ordre non interchangeable** : brancher le cadre à l'import AVANT de relancer l'import, sous peine de graver une photo non recadrée en silence |
| [archive/FICHE_REPRISE_extraits_2026-08-11.md](./archive/FICHE_REPRISE_extraits_2026-08-11.md) | Blocs sortis de la fiche le 2026-08-11 (**119 → 99 lignes**), recopiés verbatim. Sixième dégonflage. ⭐ Sa §3 consigne **trois documents portant trois comptes d'écrans différents** — ni « neuf » ni « dix » n'était juste ; `ETAT.md` §5 fait foi avec 8 spécifiés / 12 codés / 11 testés |
| [archive/RECAP_SESSION_2026-08-09_quantites-portions.md](./archive/RECAP_SESSION_2026-08-09_quantites-portions.md) | **Le libellé d'un ingrédient déclare en quoi il se compte** — comment « poser les filets » s'est mis à chiffrer. ⛔ **Le défaut le plus cher était un NOMBRE FAUX, pas un lien manquant, et le compte de liens MONTAIT** — pourquoi un lot de langue se mesure ligne à ligne sur le rendu. **Décision 63 laissée ouverte** |
| [archive/RECAP_SESSION_2026-08-07_aliment-piquant-dette.md](./archive/RECAP_SESSION_2026-08-07_aliment-piquant-dette.md) | **Fiche aliment (décision 33), piquant (décision 35), et l'audit de la dette §8.** ⭐ À lire pour UNE raison : **trois faits « connus » du dépôt étaient faux**, et aucun n'a été trouvé en cherchant un bug — une définition ANSES recopiée trois fois sans source, une décision annoncée ouverte alors qu'elle était livrée, et §8 qui comptait faux à six endroits. Consigne aussi comment lire un PDF quand `WebFetch` échoue. |
| [archive/CHANTIER_synonymes_2026-08-05.md](./archive/CHANTIER_synonymes_2026-08-05.md) | Chantier des synonymes d'aliments (décision 58, cause 2) — **clos**. Archivé le 2026-08-07 : il vivait à la racine comme un travail en cours. Sa fermeture a tué la prémisse de la décision 8, d'où la **décision 60**. |
| [archive/RECAP_SESSION_2026-08-07_recettes-aliments.md](./archive/RECAP_SESSION_2026-08-07_recettes-aliments.md) | **Le contenu — 51 recettes (241 → 297) et 1 aliment (450 → 451).** ⭐ À lire pour sa §3 : *un oracle qui partage la donnée du sujet qu'il vérifie ne vérifie rien* — un test de régime vert qui laissait passer la sauce de poisson comme végétalienne, un banc qui imprimait « 20/20 sain » sur 17 créneaux vides, un test d'écran vert par la taille du catalogue. **§2 démonte le diagnostic d'un chantier entier** : le manque était dans les PLATS, pas dans les accompagnements. **§5 : un commit rouge passé parce que j'ai vérifié une sélection de fichiers au lieu du commit.** |
| [archive/FICHE_REPRISE_extraits_2026-08-07.md](./archive/FICHE_REPRISE_extraits_2026-08-07.md) | Blocs datés sortis de la fiche le 2026-08-07 (**285 → 193 lignes**), recopiés verbatim. Son en-tête donne le critère de tri — **pas l'âge, le doublon** — et dit bloc par bloc où le fait durable vit maintenant. Deuxième dégonflage, après celui du 2026-08-03 |
| [archive/_avant_decoupe_2026-08-03/](./archive/_avant_decoupe_2026-08-03/) | Copies intactes d'`ENGINE.md`, `ETAT.md` et `FICHE_REPRISE.md` **avant** la découpe du 2026-08-03. Déplacé de `docs/` vers `archive/` le 2026-08-07 : la nouvelle organisation est en usage depuis quatre jours, ce dossier n'est plus une référence de travail. |
| [archive/AUDIT_2026-07-27.md](./archive/AUDIT_2026-07-27.md) | Regard **extérieur** sur le dépôt au commit `e2625d3` (112 recettes). Chiffres dépassés ; **deux constats restent VIVANTS** : zéro photo, revue juridique |
| [archive/RECAP_SESSION_6.md](./archive/RECAP_SESSION_6.md) | Le contenu de Savoir. **§2 consigne les trois tips que la vérification a démentis**, et les sujets écartés faute de source lisible |
| [archive/RECAP_SESSION_7.md](./archive/RECAP_SESSION_7.md) | **Même période que la 6, piste parallèle** — tests des 9 écrans, plantage sur garde-manger non vide, menus déroulants remplacés par des fenêtres. **§2 liste trois défauts trouvés et non corrigés**, **§5 ce qui reste branché à moitié** |
| [archive/FICHE_REPRISE_extraits_2026-08-03.md](./archive/FICHE_REPRISE_extraits_2026-08-03.md) | Trois sections datées sorties de la fiche le 2026-08-03 : les quatre défauts du 01/08 corrigés, le premier essai téléphone, la provenance des recettes. Sujets traités au fond dans `RETOUR_ESSAI_TELEPHONE.md` et `SOURCES_RECETTES.md` |
| [archive/RECAP_SESSION_5.md](./archive/RECAP_SESSION_5.md) | 8 écrans, `user.db`, installabilité. **§2 consigne ce que le navigateur et l'usage ont démenti** ; **§7 le journal des lots** |

Ils décrivent un état **vrai à leur date**. Les corriger après coup falsifierait l'historique : une
affirmation devenue fausse se corrige dans les documents de référence, pas dans le récit qui l'a
consignée. C'est aussi pourquoi ils gardent les raisonnements abandonnés en route — savoir pourquoi
une piste a été écartée vaut souvent l'énoncé de celle qui a été retenue.

> ⚠️ **Ces documents contiennent donc, par construction, des affirmations aujourd'hui fausses** —
> comptes de tests, taille du catalogue, décisions depuis tranchées. C'est voulu et ce n'est pas une
> dette : ils sont datés et se lisent comme tels. Ne jamais s'en servir pour établir l'état courant,
> qui est dans `FICHE_REPRISE.md` et `ETAT.md`.

### 🎯 Chantiers — conception d'un sujet précis

| Document | Sujet | État |
|---|---|---|
| [CONCEPTION_B_VIN_REPAS.md](./CONCEPTION_B_VIN_REPAS.md) | Conseils vin (métadonnée éditoriale, loi Évin) et modes recette/repas | 8 décisions tranchées, rang 0 codé, le reste en file |
| [CONCEPTION_MODE_CUISINE.md](./CONCEPTION_MODE_CUISINE.md) | **Plan de montée** du mode cuisine — ordre des lots, et comment monter les deux prérequis. La spec, elle, est dans `ARCHITECTURE.md` §5bis | Décision 8 fermée le 2026-08-04 ; rien de codé ; 2 prérequis non satisfaits |
| [CONCEPTION_RESERVATION_MATERIEL.md](./CONCEPTION_RESERVATION_MATERIEL.md) | **Plan de montée** de la réservation de matériel du mode cuisine — 5 lots, écrit le 2026-08-11 en réponse à la **décision 65**. ⛔ **Son fait fondateur : on n'occupe pas une recette, on occupe des INTERVALLES** — 14 recettes sur 83 occupent le four plus d'une fois, et la colonne que la 65 demandait ne peut pas le porter. Le coût réel est 83 couples, pas 1 473. ⚠️ **Le seul point d'arrêt est la capacité** : `partageable` au catalogue, `quantite` dans les réglages — la plaque a 2 à 5 feux selon la cuisine, ça n'appartient pas au catalogue |
| [CONCEPTION_REGIME_PERSONNALISE.md](./CONCEPTION_REGIME_PERSONNALISE.md) | **Plan de montée** du régime personnalisable — pourquoi les sous-formes de végétarisme ne peuvent PAS entrer dans `DIET_CHAIN`, et les 5 lots. Les deux sens sont codés : « retirer » (v15, RESTREINT) et « admettre » (v16, ASSOUPLIT) | ✅ **Décision 67 FERMÉE le 2026-08-11 — A, B, C, C-bis, D1→D4 livrés** ; E optionnel, non entrepris. ⚠️ **C'est un plan livré, pas un état** : l'état vit dans `ETAT.md`, et lui seul |
| [STRATEGIE_DISTRIBUTION.md](./STRATEGIE_DISTRIBUTION.md) | Positionnement, stores, modèle économique, marketing organique | Cadre posé, points « à confirmer » ouverts jusqu'à la publication |
| [RETOUR_ESSAI_TELEPHONE.md](./RETOUR_ESSAI_TELEPHONE.md) | Backlog des retours utilisateur — l'essai sur un vrai appareil (2026-08-02) en §1 à §5, **et le lot `test appli.txt` de la session 8 en §6**, instruit le 2026-08-03 | 11 lots livrés ; reste bloqué par des DÉCISIONS et du CONTENU, plus par du code |
| [SOURCES_RECETTES.md](./SOURCES_RECETTES.md) | D'où viennent les 241 recettes, quelles sources libres existent, ce que coûte un import | Sources vérifiées le 2026-08-02, aucune encore utilisée ; 4 décisions ouvertes |

> ⚠️ `RETOUR_ESSAI_TELEPHONE.md` est **un backlog, pas un état** — seule exception à la règle
> d'unicité ci-dessus, et elle est temporaire. Ce qui s'y tranche part dans `ETAT.md` §3 ou §4 ; ce
> qui s'y fait en sort. Quand il sera vide, il rejoindra `archive/`.

## Deux conventions à respecter

**Le code fait foi.** Quand un document et le code divergent, c'est le document qu'on corrige — et
on le dit dans le message de commit. Plusieurs notes de `ENGINE.md` conservent la trace de ces
corrections (le compte de couches est passé de 12 à 18 en cinq étapes, chacune consignée).

**Une décision se range à un seul endroit.** Tranchée → `ETAT.md` §3. Encore ouverte → `ETAT.md`
§4. Propre à un chantier → le document de chantier. La fiche de reprise ne fait que *pointer* vers
elles.

**Un journal de travail achevé n'est pas de l'état.** `ETAT.md` a porté jusqu'au 2026-07-31 un
journal de 170 lignes des lots terminés — que git conservait déjà, et qui noyait l'état courant. Il
est passé dans [archive/RECAP_SESSION_5.md](./archive/RECAP_SESSION_5.md) §7. `ETAT.md` décrit ce
qui EST, pas ce qui a été fait.
