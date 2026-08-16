---
description: J'ai relu le brief — on fige et on ouvre le droit de coder
argument-hint: <id-du-lot>
allowed-tools: Bash
---

J'ai relu le brief du lot **$1** et ses tests. Je les valide.

Lance exactement :

```
node .claude/hooks/garde.mjs lot "$1" && node .claude/hooks/garde.mjs sceau
node .claude/lots.mjs etat "$1" en_cours
```

La seconde ligne ne fait que bouger une case de l'index `.claude/lots.json`, qui est un
**cache** — si elle échoue, le lot est ouvert quand même, ne recommence pas. Si elle répond
que le lot est inconnu, **n'invente pas la ligne** : dis-le-moi, c'est que mes documents de
conception ne le portent pas encore. `/plan` réconciliera.

Deux choses changent à cet instant, et une seule est un gain :

- le code de production s'ouvre à l'écriture ;
- `tests/scelles/` se ferme définitivement.

À partir de maintenant, si un test scellé te paraît faux : **tu le dis et tu t'arrêtes.**
Tu ne le corriges pas, tu ne le contournes pas, tu n'écris pas un second test qui le double.
C'est ma décision, pas la tienne.

Puis résume-moi en trois lignes ce que tu vas coder en premier — et attaque.
