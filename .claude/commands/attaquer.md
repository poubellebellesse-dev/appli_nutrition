---
description: Attaquer le brief et les tests d'un lot — AVANT de sceller
argument-hint: <id-du-lot>
allowed-tools: Task, Read, Grep, Glob
---

Lance `@critique` sur le lot **$1**, avec cette mission exacte — ne la reformule pas, ne
l'adoucis pas :

> Lis le document de brief du lot $1 et ses tests dans `tests/scelles/`. Tu n'as pas écrit
> ce lot et tu ne le défends pas. Réponds à trois questions, dans cet ordre.
>
> **1. Le critère de sortie est-il falsifiable ?** Dis-moi précisément ce qui le rendrait
> faux. Si tu n'y arrives pas, ce n'est pas un critère, c'est une intention — dis-le.
>
> **2. Écris une implémentation FAUSSE qui fait passer ces tests.** Trois lignes de
> pseudo-code suffisent. Triche : constantes en dur, cas particuliers, retour du bon type
> sans le bon calcul. Si tu y arrives, les tests ne discriminent pas et tout le lot repose
> sur du vide. **C'est la question qui compte le plus.**
>
> **3. Qu'est-ce que le brief ne dit pas ?** Liste ce que le codeur devra deviner. Chaque
> devinette est un aller-retour que je paierai plus tard.
>
> Ne propose pas de solution. Ne sois pas encourageant. Trouve les trous.

Puis rends-moi son verdict tel quel, sans l'adoucir, et dis-moi ce que tu comptes corriger.

**Ne scelle rien.** C'est moi qui taperai `/sceller $1` — ou pas.
