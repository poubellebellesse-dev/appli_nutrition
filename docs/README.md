# Index de la documentation

**Sept documents vivants**, quatre rôles (plus ce fichier, qui n'est que l'index). Il dit **lequel
lire**, **lequel fait foi**, et **lequel ne doit jamais être réécrit**.

> Les instantanés datés — récits des sessions 1 à 5 et audit du 2026-07-27 — sont dans
> [archive/](./archive/) : ils ne décrivent plus l'état du projet. Ils ne sont ni faux ni
> supprimables, voir [archive/README.md](./archive/README.md).

## Par où commencer

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
| [ENGINE.md](./ENGINE.md) | Le moteur seul : couches, contrats, algorithmes, API, plan de lancement, stratégie de test |
| [DESIGN.md](./DESIGN.md) | Écrans, navigation, jetons visuels, badge de preuve |

Ordre d'autorité quand deux documents se contredisent : **le code fait foi**, puis `ENGINE.md` sur
tout ce qui touche le moteur, puis `ARCHITECTURE.md` sur le reste. Une contradiction constatée se
corrige dans le document, elle ne se contourne pas dans le code.

### 🧭 État — se réécrivent à chaque session

| Document | Rôle |
|---|---|
| [FICHE_REPRISE.md](./FICHE_REPRISE.md) | Point de reprise condensé. Une page, jamais plus. |
| [ETAT.md](./ETAT.md) | État complet, avancement, décisions figées et ouvertes. |

> **Règle d'unicité** : chaque fait vit à UN SEUL endroit. La fiche donne l'état vérifié et la
> prochaine étape ; tout le reste — avancement détaillé, décisions, **dette connue** (`ETAT.md` §9)
> — est dans `ETAT.md`, et la fiche ne fait qu'y renvoyer. Si la fiche dépasse une page, c'est
> qu'elle a repris quelque chose qui appartient à `ETAT.md`.

### 📖 Instantanés datés — **ne jamais réécrire**

Tous rangés dans [archive/](./archive/) — voir [archive/README.md](./archive/README.md) pour le
détail. Deux repères :

| Document | Ce qu'il consigne |
|---|---|
| [archive/AUDIT_2026-07-27.md](./archive/AUDIT_2026-07-27.md) | Regard **extérieur** sur le dépôt au commit `e2625d3` (112 recettes). Chiffres dépassés ; **deux constats restent VIVANTS** : zéro photo, revue juridique |
| [archive/RECAP_SESSION_5.md](./archive/RECAP_SESSION_5.md) | La session la plus récente — 8 écrans, `user.db`, installabilité. **§2 consigne ce que le navigateur et l'usage ont démenti** |

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
| [STRATEGIE_DISTRIBUTION.md](./STRATEGIE_DISTRIBUTION.md) | Positionnement, stores, modèle économique, marketing organique | Cadre posé, points « à confirmer » ouverts jusqu'à la publication |

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
