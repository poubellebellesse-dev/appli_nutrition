# Fiches scientifiques — « Comprendre » (§8.2 ARCHITECTURE, §4.7 DESIGN)

Un fichier Markdown par fiche. **Frontmatter = métadonnées, corps = résumé vulgarisé** (§9
ARCHITECTURE).

## Ce dossier est compilé et affiché

`catalog/build.mjs` lit ces fichiers, les valide, et les écrit dans cinq tables de `catalog.db`
(`evidence_sheet`, `evidence_source`, `evidence_position`, `evidence_position_source`,
`evidence_link`). L'écran Savoir les rend dans « Comprendre ». **Ajouter un `.md` ici suffit.**

Le build **échoue** si une position ne cite aucune source, si elle cite une source inexistante, si
un titre n'est pas une question, si un lien vise un aliment absent du catalogue, ou si le
vocabulaire banni §6.2 apparaît. Ces refus sont des garde-fous de sécurité, pas des exigences de
forme : voir `validateEvidence` dans `catalog/build.mjs`.

> ⚠️ **Une fiche non relue reste un brouillon**, quoi qu'en dise son `date_revue`. §8.2 bis exige
> une **relecture par un tiers avant publication** — le fait que le tuyau fonctionne ne rend pas le
> contenu publiable.

## Le principe : des positions, pas une vérité

Une fiche pose une **question** et expose les **positions qui divergent réellement**. C'est ce qui
distingue l'application d'un site de conseils : l'utilisateur voit qui dit quoi, sur quelles
données, et où le désaccord se situe exactement.

**⚠️ CE N'EST PAS « UNE ÉTUDE CONTRE UNE AUTRE ».** §8.2 règle 1 est catégorique : « il existe une
étude pour affirmer à peu près tout et son contraire ». Mettre une étude isolée face à un consensus
d'autorité fabrique une **fausse symétrie** — le procédé exact qui a fait douter du tabac. Les
seules divergences admises ici :

| ✅ Admis | ❌ Refusé |
|---|---|
| Deux méta-analyses ou revues systématiques qui concluent différemment | Une étude isolée opposée à une revue |
| Deux autorités (OMS, ANSES, EFSA, HAS) dont les seuils diffèrent | Un avis d'expert, un blog, un livre |
| Une revue contestée **accompagnée de la critique méthodologique publiée** | Une position sortie de son contexte |
| Aucune divergence → la fiche l'écrit et n'invente pas d'opposant | Un « certains pensent que… » sans référence |

Quand une position est méthodologiquement contestée, **la critique est citée dans la même position**,
pas ailleurs. Une divergence présentée sans sa réfutation est une désinformation polie.

## Les quatre niveaux de preuve (§5 DESIGN)

`forte` · `moderee` · `faible` · `preliminaire`

⚠️ **Le badge informe, il ne juge pas.** Jamais de rouge/vert, jamais de note ni d'étoiles — §5
DESIGN en fait « l'élément le plus surveillé » du produit. Le niveau qualifie **la solidité de la
preuve**, pas la qualité d'un aliment.

Le `niveau_preuve` de la fiche = celui de son **socle de consensus**. Chaque position porte le sien,
qui peut être plus bas.

## Format

```yaml
---
code: sodium-tension-arterielle     # identifiant stable, kebab-case, = nom du fichier
titre: "Faut-il manger moins de sel ?"   # un TITRE-QUESTION (§4.7), jamais une affirmation
categorie: nutriments               # famille de niveau 1 (§6.3) — voir vocabulaires
niveau_preuve: forte                # socle de consensus
date_revue: 2026-07-31              # §8.2 règle 4 — au-delà de 3 ans, la fiche est à réviser
liens:                              # ce que la fiche éclaire (evidence_link §4.2)
  - { cible_type: nutrient, cible_id: sodium }

positions:                          # les « affirmations courtes » de §4.7, dans l'ordre d'affichage
  - id: consensus-tension
    niveau_preuve: forte
    porte_par: "OMS, EFSA, ANSES"   # QUI soutient cette position — jamais « les scientifiques »
    affirmation: "Une phrase. Courte. C'est elle qui porte le badge."
    detail: |
      Le dépliant : deux ou trois phrases, chiffres à l'appui.
    sources: [oms-sodium, efsa-2019] # renvoie aux `id` du bloc `sources`

sources:
  - id: efsa-2019
    titre_etude: "Dietary reference values for sodium"
    auteurs: "EFSA Panel on Nutrition, Novel Foods and Food Allergens (NDA)"
    annee: 2019
    revue: "EFSA Journal 17(9):5778"
    doi: "10.2903/j.efsa.2019.5778"
    url: "https://doi.org/10.2903/j.efsa.2019.5778"
    type_etude: rapport_autorite
    effectif: null                  # renseigné SEULEMENT si vérifié — voir plus bas
    consulte_le: 2026-07-31         # date à laquelle le lien a été ouvert et vérifié
---

Le corps du fichier est le résumé vulgarisé (`evidence_sheet.resume_vulgarise`) : deux ou trois
phrases lisibles sans bagage, affichées avant les positions.
```

## Règles éditoriales (§8.2)

1. **Méta-analyses, revues systématiques et textes d'autorité.** Une étude primaire n'entre que si
   elle est l'objet même de la divergence (cas de PURE), et alors avec sa critique publiée.
2. **Niveau de preuve visible** sur la fiche et sur chaque position. C'est ce qui sépare
   l'application d'un blog bien-être.
3. **Résumés rédigés à la main.** Les abstracts et PDF sont couverts par le droit d'auteur. DOI et
   lien : oui. Copie, même partielle : non.
4. **`date_revue` affichée**, et fiche signalée à réviser au-delà de 3 ans.

### Deux règles ajoutées pour que l'utilisateur soit rassuré sur les sources

5. **Tout `doi` / `url` est ouvert et vérifié avant écriture**, et `consulte_le` en porte la date.
   Un DOI écrit de mémoire est un DOI inventé : sur un produit dont la promesse est la traçabilité,
   c'est la faute qui coûte le plus cher. Une source non vérifiée ⇒ **la fiche n'est pas écrite**.
6. **`effectif` seulement si vérifié à la source.** « 95 767 participants, 18 pays » rassure ;
   un effectif approximatif détruit la confiance qu'il cherchait à créer. Dans le doute : `null`.
7. **`financement` renseigné dès qu'un conflit d'intérêts est déclaré dans l'article** — champ
   optionnel, omis sinon. Une méta-analyse financée par le secteur qu'elle évalue reste citable ;
   le lecteur doit simplement le savoir. Reproduire la déclaration publiée, sans la commenter.

## Ce qu'une fiche ne fait pas (§6.1, §6.2)

L'application est une **bibliothèque consultable, jamais un prescripteur**. Une fiche décrit ce que
les instances recommandent — elle n'adresse pas d'injonction au lecteur.

| ❌ | ✅ |
|---|---|
| « Réduisez votre consommation de sel. » | « L'OMS recommande de rester sous 2 g de sodium par jour. » |
| « Le sel est mauvais pour le cœur. » | « Au-dessus de 5 g/j, PURE observe une association avec les événements cardiovasculaires. » |

Le lexique banni de §6.2 (`catalog/build.mjs`, `BANNED_TERMS`) s'applique intégralement : `titre`,
`affirmation`, `detail` et corps sont affichés tels quels. Attention aux formulations qui contiennent
« à éviter », « traiter », « mauvais pour » — le lint bloquera le build le jour où il lira ce dossier.

## Vocabulaires fermés

| Champ | Valeurs |
|---|---|
| `niveau_preuve` | `forte` · `moderee` · `faible` · `preliminaire` (§5 DESIGN) |
| `categorie` | `nutriments` · `vitamines_mineraux` · `aliments` · `situations` (les 4 familles de niveau 1, §6.3) |
| `cible_type` | `food` · `nutrient` · `health_topic` (§4.2) |
| `type_etude` | `meta_analyse` · `revue_systematique` · `essai_randomise` · `cohorte` · `rapport_autorite` · `commentaire_critique` |

`commentaire_critique` existe pour une seule raison : la règle « une divergence contestée est citée
avec sa critique » serait inapplicable sans lui. C'est le seul type qui n'apporte pas de données
propres — il conteste celles d'une autre source.

⚠️ `cible_id` doit **exister au catalogue**. Les nutriments disponibles aujourd'hui sont les neuf de
`catalog.db` : `calcium`, `energie`, `fer`, `fibres`, `glucides`, `lipides`, `proteines`, `sodium`,
`vitamine_c`. Aucun `health_topic` n'existe encore — un lien vers l'un d'eux ne se validera pas.

## Écarts au schéma §4.2 ARCHITECTURE — tranchés

Le format dépasse les tables déclarées en §4.2. Quatre écarts, tous arbitrés en faveur du format :

1. **`evidence_sheet.niveau_preuve` était unique** en §4.2, alors qu'une fiche multi-positions en a
   un par position. → table **`evidence_position`**, dont chaque ligne porte le sien. Celui de la
   fiche reste, et désigne le **socle de consensus** : les deux ne sont pas redondants.
2. **`evidence_source(sheet_id, …)` rattachait une source à la FICHE**, pas à une position.
   → table de jonction **`evidence_position_source`**. C'est elle qui rend vérifiable qu'aucune
   affirmation n'est publiée sans référence ; sans elle, position et source coexisteraient en base
   sans qu'on sache laquelle appuie laquelle.
3. **`consulte_le` et `effectif`** → colonnes de `evidence_source`.
4. **`financement`** → colonne de `evidence_source`, ajoutée après coup (voir règle 7).

`evidence_link.cible_id` reste **polymorphe** (`food` | `nutrient` | `health_topic`) : aucune clé
étrangère n'est possible, l'existence réelle de la cible est donc vérifiée au build. `health_topic`
est refusé tant qu'aucune table de chapitres n'existe.
