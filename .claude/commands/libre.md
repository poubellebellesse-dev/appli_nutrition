---
description: Lever le verrou — tout, ou seulement le sceau des tests
argument-hint: [sceau]  (sans argument = TOUT est coupé)
allowed-tools: Bash
---

**Choisis le bon cran. Ce n'est pas le même geste.**

**Si tu veux seulement corriger les tests scellés** — et c'est le cas courant, surtout
avant qu'une ligne de code existe :

```
node .claude/hooks/garde.mjs libre sceau
```

Les instruments restent protégés, le blocage de fin tient, le lot reste ouvert. Seul le
verrou des tests saute.

**Si tu as vraiment besoin de tout couper** — toucher à un instrument, par exemple :

```
node .claude/hooks/garde.mjs libre
```

Là il n'y a plus rien. Aucune protection. C'est un état dans lequel on ne reste pas.

---

**Dans les deux cas, avant de faire quoi que ce soit :** dis-moi en une phrase ce que tu vas
changer et pourquoi. Si tu ne peux pas le formuler, tu n'aurais pas dû demander la clé.

**Et quand c'est fini : `/strict`.** Il rallume tout et remet le sceau. Ne l'oublie pas —
tant que tu ne l'as pas tapé, tu travailles à découvert.

Argument reçu : $ARGUMENTS
