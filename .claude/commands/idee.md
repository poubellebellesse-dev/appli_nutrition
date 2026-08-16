---
description: Cadrer une nouvelle feature — aucun code, on sort un plan et des lots
argument-hint: <nom court de la feature>
allowed-tools: Read, Write, Edit, Glob, Grep, Task, Bash
---

On cadre **$1**. **Tu n'écris aucun code pendant toute cette commande** — que des documents.

**1. Trois regards, en parallèle. Délègue, ne lis pas tout toi-même.**

- `chercheur` : qu'est-ce qui existe DÉJÀ dans le dépôt qui touche à $1 ? Quelles décisions figées de `docs/ETAT.md` §3 et quels acquis de CLAUDE.md le contraignent ? Quinze lignes, pas un dump.
- `critique` : **ta mission est de démolir $1.** Pourquoi c'est une mauvaise idée, ce qu'on n'a pas vu, ce que ça casse ailleurs. Vérifie en priorité que ça n'entre pas en conflit avec les **six principes non négociables** — surtout « informer, jamais juger » et « déterminisme ». Sois désagréable, c'est le moment.
- `chercheur` (2e appel) : faisabilité — lis `docs/reference/PIEGES.md` et dis lesquels de ces pièges déjà payés cette feature va rencontrer. Ce qui touche à `engine/` ne peut importer ni react, ni sqlite, ni `features/`.

**2. Écris `docs/CONCEPTION_$1.md`, sur le modèle de `CONCEPTION_REGIME_PERSONNALISE.md`. Sections obligatoires, dans cet ordre :**

1. **Le problème** — une phrase. Le manque réel, pas la solution.
2. **Ce qui est dans le périmètre.**
3. **⛔ CE QUI EST HORS PÉRIMÈTRE.** Explicite, nominatif. *Cette section s'écrit AVANT le découpage en lots* — c'est elle qui empêche la feature de gonfler pendant qu'on la découpe.
4. **Décisions à prendre** — ce que TU ne peux pas trancher. Numérotées, avec les options et leur coût. Elles iront dans `ETAT.md` §4.
5. **Les lots** — chacun avec son **`**Fini quand** :`**, observable et chiffré, **vérifié contre `catalog.db` réel, jamais contre une fixture qui redirait la même chose**. Un lot qu'on ne sait pas terminer n'est pas un lot.
6. **L'ordre**, et ce qui bloque quoi. Dis aussi quels témoins doivent rester stables : compte de tests, `engine:plan-stress` 20/20, sorties de `catalog/build.mjs`.

**3. Arrête-toi. Montre-moi.** Je tranche les décisions ouvertes, ou je te renvoie cadrer. Trois tours maximum : au quatrième, le problème n'est pas le plan, c'est que je ne sais pas ce que je veux.

**4. Une fois validé — l'étape que tout le monde saute :**

Inscris les décisions ouvertes dans `docs/ETAT.md` §4 et la prochaine étape dans `docs/FICHE_REPRISE.md`. Une conception qui ne rejoint pas l'état du projet n'a pas eu lieu : elle mourra dans cette conversation.

**Puis, une ligne par lot du §5** — l'index machine que lit `.\chemin.bat` :

```
node .claude/lots.mjs ajouter <id> --chantier "<le sujet de la conception>" \
     --titre "<le titre du document>" [--bloque-par <id>] [--optionnel] \
     --source docs/CONCEPTION_$1.md
```

Le titre se **recopie** du §5 que tu viens d'écrire. Tu n'en rédiges pas un autre pour
l'occasion : deux titres pour un lot, et on ne sait plus lequel est le lot. Le script refuse
d'ajouter un lot sans titre — si un lot n'en a pas, c'est qu'il manque au document, pas à
l'index. Le chantier se recopie du sujet de la conception, en minuscules et sans préfixe :
`CONCEPTION_GESTES_ILLUSTRES.md` → `gestes illustrés`.

`.claude/lots.json` est un **cache dérivé** de ces documents : si ces lignes échouent, rien
n'est perdu, `/plan` régénère tout depuis les conceptions.

Ensuite seulement : `/brief <premier-lot>`.

---

**Tout ce que j'ai tapé sur la ligne de commande, en entier :** $ARGUMENTS

S'il y a autre chose que l'identifiant là-dedans — une demande, une contrainte, un doute —
c'est une consigne pour ce tour. Traite-la, ne l'ignore pas.
