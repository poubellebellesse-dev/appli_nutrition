---
description: Ouvrir un lot — « Fini quand » AVANT le code
argument-hint: <id-du-lot> (ex : D2)
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

Ouvre le lot **$1**. Tu n'écris pas une ligne de code de production avant la fin de cette procédure.

1. Trouve le lot $1 dans `docs/CONCEPTION_*.md`. Lis `docs/FICHE_REPRISE.md` pour l'état réel, et la section du chantier concerné.

2. Si le lot n'a pas de **`**Fini quand** :`**, écris-le maintenant, dans son document de conception. Modèle : celui du lot A de `CONCEPTION_REGIME_PERSONNALISE.md` — observable et chiffré, **vérifié contre `catalog.db` réel, pas contre une fixture qui redirait la même chose**. Une phrase dont on peut dire ce qui la rendrait fausse.

3. Écris les tests d'acceptation dans `tests/scelles/$1.test.ts`, **depuis le « Fini quand » seul, avant tout code**. Ils doivent échouer aujourd'hui. Lance-les, colle la sortie rouge.

4. Déclare ce que le lot **ne touche pas**, et relève les témoins d'avant : compte `npm test`, `engine:plan-stress`, et `node catalog/build.mjs` si le catalogue est concerné.

5. Arrête-toi et montre-moi. Je valide ou je corrige.

**Tu ne verrouilles RIEN toi-même.** Tant que je n'ai pas validé, le brief et les tests
restent librement modifiables — c'est le moment où les corriger ne coûte rien.

Quand j'aurai relu, c'est MOI qui taperai `/sceller $1`. Pas toi.

---

**Tout ce que j'ai tapé sur la ligne de commande, en entier :** $ARGUMENTS

S'il y a autre chose que l'identifiant là-dedans — une demande, une contrainte, un doute —
c'est une consigne pour ce tour. Traite-la, ne l'ignore pas.

**Écris en sachant que ce brief sera ATTAQUÉ.** Avant de sceller, je lance un critique dont
la seule mission est de trouver une implémentation fausse qui ferait passer tes tests. Si
elle existe, tes tests ne valent rien et on recommence. Écris-les pour survivre à ça.
