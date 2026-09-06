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

---

## Quand ça s'arrête — DEUX TOURS D'ATTAQUE, JAMAIS TROIS

**Décision de l'auteur, 2026-08-27.** Sans plafond, chaque correction appelle une réattaque
qui appelle une correction. Le brief ne converge plus, il tourne.

**Une seule chose rouvre un brief : une implémentation fausse qui fait passer tous les
tests** — la question 2 ci-dessus, et rien d'autre. Si le critique en exhibe une, on corrige,
et on a le droit de réattaquer. **Une fois.**

**Ce qui ne rouvre RIEN**, et c'est exactement là que la boucle se fabrique :

- « tu pourrais aussi tester X » → c'est du périmètre en plus. Ça va en dette, `ETAT.md` §8.
- « cette clause est verte aujourd'hui » → c'est une garde, elle est déclarée comme telle
  dans l'en-tête du test. Une garde n'est pas un défaut.
- « et si le catalogue changeait » → un test scellé mesure l'arbre du jour, pas tous ses
  futurs. Un compte qui bougera est signalé, il n'est pas retiré.
- une correction qui demande une **décision de conception neuve** → elle devient un **lot
  séparé**, elle ne gonfle pas celui-ci. C'est ce qui a donné `retour-5b`.

**Au deuxième tour, on scelle.** Ce qui reste sera trouvé en codant — c'est ce qui est arrivé
au `retour-4`, dont la moitié de clause contradictoire n'a été vue ni par le brief ni par le
critique, mais par l'implémentation. Ce n'est pas un échec du brief : c'est la limite de ce
qu'un brief peut voir, et elle se paie moins cher qu'un troisième tour.

⚠️ **Le compteur compte les tours d'ATTAQUE, pas les clauses ajoutées.** Une correction qui
n'ajoute aucun mécanisme n'ajoute aucune surface d'attaque : fermer un chemin d'appel oublié
ou un branchement sur la mauvaise donnée ne fait pas grossir la spec d'un pouce.
