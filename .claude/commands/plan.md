---
description: Réconcilier l'index des lots avec les documents — les écarts d'abord, l'écriture ensuite
argument-hint: (rien) ou <chantier> pour ne relire qu'un fil
allowed-tools: Read, Write, Glob, Grep, Bash, Task
---

Tu régénères `.claude/lots.json` depuis mes documents.

**Ce fichier est un CACHE DÉRIVÉ. Il n'est jamais une source.** La vérité vit dans les
documents listés ci-dessous, et nulle part ailleurs. Si l'index et un document se
contredisent, **c'est l'index qui a tort** — et cette contradiction est précisément ce que
tu dois me montrer avant de la faire disparaître en réécrivant le fichier.

Tu n'écris **rien** dans mes documents pendant cette commande. Pas une case, pas une date,
pas un titre. Tu écris `.claude/lots.json`, et c'est tout.

> ⚠️ **Ce dépôt n'a pas de tableau de suivi, et il n'en aura pas.** La règle d'unicité de
> `CLAUDE.md` — *chaque fait vit à un seul endroit* — l'interdit : l'état d'un lot vivrait
> alors dans `ETAT.md` **et** dans un suivi, et les deux divergeraient. Les lots vivent donc
> dans leur document de conception, et cette commande va les y chercher.

---

## 1. Les sources, dans cet ordre d'autorité

| Rang | Fichier | Ce qu'on y prend |
|---|---|---|
| 1 | `docs/CONCEPTION_*.md`, section **« Les lots »** | la liste des lots d'un chantier, leur `id`, leur titre, leur ordre et ce qui bloque quoi |
| 2 | `docs/FICHE_REPRISE.md`, section **« ▶ La prochaine étape »** | **la priorisation** — c'est cette liste numérotée qui donne l'ordre des chantiers entre eux |
| 3 | `docs/ETAT.md` §8 (*Dette connue*) | l'état des lots clos : les blocs « Ce que le lot N laisse derrière lui » et leur date |
| 4 | `docs/ETAT.md` §3 et §4 | rien directement — sert à **repérer** un lot dont aucune conception ne parle |

Le chantier d'un lot, c'est **le sujet de son document de conception**, en minuscules et sans
préfixe : `CONCEPTION_GESTES_ILLUSTRES.md` → `gestes illustrés`. Un lot qui ne vient d'aucune
conception prend le chantier que porte la ligne de `FICHE_REPRISE.md` qui le cite.

⚠️ **`ETAT.md` fait 340 Ko, `PIEGES.md` 55 Ko. Délègue leur lecture** — `chercheur` ou
`Explore`, un par fichier, en parallèle — et demande-leur *les lignes brutes*, pas un résumé.
Un résumé d'agent a déjà transformé « déjeuner = 159 » en « déjeuner = 199 » sur ce projet :
**recoupe toi-même toute ligne sur laquelle tu vas conclure un écart.**

## 2. Ce que tu extrais, et rien de plus

| champ | d'où il vient |
|---|---|
| `id` | **recopié au caractère près** du document. Tu ne normalises pas : `66b` reste `66b`, `Lot 1` reste `Lot 1`. |
| `chantier` | le sujet du document de conception d'où il sort |
| `titre` | **une ligne, celle du document** — le texte du titre de section, ou celui après le tiret. |
| `etat` | `a_faire` · `en_cours` · `fait` · `bloque` · `abandonne` |
| `le` | la date écrite dans le document, en `AAAA-MM-JJ`. Absente du document → absente de l'index. |
| `commit` | **seulement si le document écrit le hash.** Voir l'encadré ci-dessous. |
| `bloque_par` | l'**id d'un autre lot** qui bloque celui-ci. Jamais autre chose. |
| `optionnel` | `true` seulement si le document le dit. |

**Rien d'autre n'entre dans le fichier.** Pas de note, pas de commentaire, pas de lien, pas
de mesure. Ce qui mérite plus qu'une ligne mérite d'être dans le document, pas dans le cache.

> **Le hash ne se devine pas.** `git log --grep` rend plusieurs candidats pour presque chaque
> id. Attribuer au jugé fabriquerait une traçabilité fausse, qui est pire que pas de
> traçabilité du tout. **Un lot fait sans hash reste sans hash** : c'est une information,
> elle dit que la livraison n'est rattachée à rien.

> **Aucun titre ne s'invente.** Si un lot n'a pas de libellé exploitable dans le document,
> **tu ne l'inscris pas** et tu me le demandes. Un titre plausible produit par un modèle est
> pire qu'une ligne absente : il a l'air d'une information.

> **`bloque_par` ne porte pas une décision.** Ici les décisions ouvertes sont numérotées
> (`ETAT.md` §4 : 2, 5, 6, 11, 52, 58, 65, 68, 70). Une ligne qui dit « bloqué par la 68 »
> ne remplit pas `bloque_par` — tu le signales et tu laisses le champ vide.

## 3. Les écarts — TU ME LES MONTRES AVANT D'ÉCRIRE

Cinq familles. Pour chacune, la ligne exacte du document et le fichier, pas une paraphrase.

1. **Lot livré dont le document n'a pas bougé.** Croise avec ce que la machine a constaté,
   qui ne raconte pas d'histoire :
   - `.claude/etat-garde.json` → `historique` — un id qui y figure et qu'aucune conception
     ne donne pour fait ; et un lot **encore ouvert** (`lot_id`) alors que le document le
     dit fini : le travail est déclaré terminé d'un côté et pas de l'autre.
   - `ls tests/scelles/` — un fichier de tests scellés à un nom de lot dont aucun document
     ne parle. Sur ce dépôt, le nom du fichier scellé **est** le nom du lot.
   - `git status --porcelain` — un lot marqué fait dont les fichiers ne sont **pas commités**.
     ⚠️ Rappel de `FICHE_REPRISE.md` : **HEAD est en avance sur `origin/main`**, ce n'est pas
     un écart.
2. **Lot présent dans une conception et absent de `FICHE_REPRISE.md`.** Il existe alors sans
   priorité : cite les deux endroits et demande-moi où il se range.
3. **Lot sans titre exploitable.** Tu le listes, tu ne l'inscris pas, tu me demandes.
4. **Dépendance vers un lot qui n'existe pas.**
5. **Deux documents qui donnent deux états au même lot.** `ETAT.md` §8 et une conception se
   contredisent : c'est `ETAT.md` qui fait foi sur l'état, et l'écart se signale quand même.

Ajoute ce qui casserait une lecture machine : deux lots au même id, un id avec un espace ou
un symbole, un préfixe qui veut dire deux choses selon le fichier.

**Tu ne corriges aucun document.** Tu me montres, je tranche.

## 4. Puis tu écris

`.claude/lots.json`, en entier, avec `Write`. Forme exacte :

```json
{
  "avertissement": "CACHE DÉRIVÉ, jamais une source. …",
  "genere_le": "AAAA-MM-JJTHH:MM:SS",
  "sources": ["docs/CONCEPTION_GESTES_ILLUSTRES.md", "docs/FICHE_REPRISE.md", "…"],
  "lots": [ { "id": "66c", "chantier": "origine animale", "titre": "origine rendue optionnelle", "etat": "a_faire" } ]
}
```

- L'**ordre du tableau** est celui de la priorisation : les chantiers dans l'ordre de
  `FICHE_REPRISE.md` §« La prochaine étape », et les lots dans l'ordre de leur conception.
  C'est cet ordre que `.\chemin.bat` dessine comme la route à suivre — le réordonner change
  ce que je vois comme prochaine étape.
- `genere_le` **n'est posé que par cette commande.** `/sceller` et `/fin` bougent une case
  sans y toucher : un `genere_le` vieux face à des états récents n'est pas une incohérence,
  c'est la mesure de la dérive que tu viens réconcilier.
- `sources` liste **tous** les fichiers effectivement lus, chemins relatifs au dépôt.

Reprends l'`avertissement` mot pour mot depuis `.claude/lots.mjs` (constante `AVERTISSEMENT`) :
deux formulations divergentes du même avertissement, et il ne veut plus rien dire.

> ⚠️ **La première exécution de cette commande écrasera une amorce posée à la main le
> 2026-08-16**, qui n'a jamais été relue par personne et dont le découpage en chantiers était
> une proposition. C'est le comportement voulu d'un cache. Mais **compare avant d'écrire** :
> si l'amorce porte un lot que les documents ne portent pas, c'est un écart de la famille 1,
> pas une ligne à jeter en silence.

## 5. Ce que tu me réponds

Les écarts d'abord, l'inventaire ensuite, et court :

```
ÉCARTS   : n, listés — chacun avec sa ligne et son fichier
ÉCRIT    : n lots · n chantiers · n non inscrits (sans titre)
TA DÉCISION : une seule question fermée, ou « rien »
```

---

**Tout ce que j'ai tapé sur la ligne de commande, en entier :** $ARGUMENTS

S'il y a un nom de chantier là-dedans, ne relis que ce fil — et **garde les lots des autres
chantiers tels quels dans le fichier**, ne les efface pas parce que tu ne les as pas relus.
