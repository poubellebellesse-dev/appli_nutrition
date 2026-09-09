---
description: Fermer le lot — état mis à jour, puis rapport court sans jargon
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Task
---

Le lot est terminé. Trois étapes, dans cet ordre. Ne saute pas la deuxième.

## 1. Mesurer

Relance les **quatre** commandes qui font foi et garde la sortie **réelle** sous la main.
Plus `node catalog/audit-mapping.mjs` à la main si le contenu a bougé — dépôt principal
uniquement.

⚠️ **Le relevé se prend sur l'arbre qu'on commite**, pas sur celui d'où l'on est parti.
Trois documents ont déjà annoncé 1 647 tests pendant que l'arbre en portait 22 de plus.
⚠️ Lis le compte `Tests N failed`, jamais `$?` : `| tail` rend le code du pipe, donc 0.

## 2. Écrire l'état — l'étape que tout le monde saute

Un lot livré dont la case n'a pas bougé n'a pas été livré.

- **Le `### Lot X` de son document `docs/CONCEPTION_*.md`** — statut ✅ LIVRÉ, la date, le
  hash de commit. Et si la seconde moitié d'un « Fini quand » n'est démontrée par aucun test,
  **écris-le** : c'est exactement ce qui est arrivé au lot D3.
- **`docs/ETAT.md`** — décision tranchée en §3, décision restée ouverte en §4, dette en §8.
- **`docs/FICHE_REPRISE.md`** — uniquement la prochaine étape.

⚠️ **Règle d'unicité : chaque fait vit à un seul endroit.** Un fait d'état va dans `ETAT.md`,
pas dans la fiche de reprise. Ne recopie pas, renvoie.

Rien dans `docs/archive/` — ce sont des instantanés datés, on ne les réécrit jamais (la garde
te refusera l'écriture de toute façon).

## 3. Me parler

Ce rapport, et **rien d'autre**. Pas d'introduction, pas de conclusion, pas de « n'hésite pas ».

```
RÉSUMÉ — ≤5 lignes : ce qui a changé et pourquoi, vu du dehors (conséquences, pas faits)
FAIT — résultat concret : sortie des commandes qui font foi, comptes exacts
RESTE — ce qui n'est pas fini, dette créée ou révélée (→ aussi dans l'état)
BLOQUÉ — ce qui coince et pourquoi, ou « non »
TOI — UNE question fermée, ou « rien »
SUITE — prochaine étape proposée
```

Puis un bloc replié :

```
<details><summary>détail technique</summary>
fichiers, sorties de commandes, témoins, écarts de compte, écart de spec ou de plan
</details>
```

**Règles dures. Une violation = tu recommences.**

1. Aucun nom de fichier, de fonction, de classe, de table hors de FAIT et du bloc replié.
2. RÉSUMÉ dit des **conséquences**, pas des faits.
   ✗ « la couche de persistance a été refactorée »
   ✓ « les données survivent maintenant à un redémarrage »
3. Zéro adjectif de succès : robuste, propre, optimisé, solide, performant.
4. **UNE** question dans TOI. Deux questions = tu ne m'as pas trié le travail, tu me l'as rendu.
5. Aucun chiffre que tu n'as pas recalculé. Sinon : « non mesuré ».
6. Si le lot a révélé un écart entre ce que le brief annonçait et ce que le diff fait, ça va
   dans RESTE ou BLOQUÉ — c'est la seule chose que le codeur ne pouvait pas voir.
7. La dette et les « on pourrait aussi refactorer » ne remontent pas ici — elles vont dans
   `ETAT.md` §8. C'est du périmètre en plus déguisé en zèle.

Si tu veux un regard neuf sur le bilan, délègue-le à `@rapporteur` : il n'a pas fait le
travail, donc il n'a rien à défendre.

Enfin, dans cet ordre — la case de l'index se ferme **avant** que la garde n'oublie quel
lot était ouvert :

```
node .claude/lots.mjs etat courant fait
node .claude/hooks/garde.mjs fin
```

`courant`, c'est le lot que la garde a ouvert : l'identifiant ne se retape pas, donc il ne
se trompe pas. La première ligne ne touche qu'un **cache** — si elle échoue, le lot est fini
quand même, et `/plan` réconciliera. Si elle répond que le lot est inconnu, **n'invente pas
la ligne** : dis-le-moi.

## 4. Le tableau

Réécris le bloc `## Nutrition` de `F:\Claude\tableau\README.md` — cinq lignes (Où, Suite,
Bloqué, Leçon, Dernier), jamais six, les autres blocs intacts, la date du titre mise à jour.
Puis, **dans ce dépôt-là uniquement** :

    cd /d F:\Claude\tableau && git add README.md && git commit -m "Nutrition <date>" && git push

C'est le seul dépôt où tu commites : quinze lignes de texte, rien d'autre.
