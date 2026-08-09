# Récit — mode cuisine à plusieurs plats : l'heure de service, la frise, et une durée qui mentait (2026-08-09)

> ⚠️ **Instantané daté. Ne pas s'en servir pour établir l'état courant** — les comptes de tests et de
> catalogue vieillissent en heures. État courant : [../FICHE_REPRISE.md](../FICHE_REPRISE.md) et
> [../ETAT.md](../ETAT.md).
>
> ⚠️ **Trois sessions écrivaient dans le même arbre ce jour-là** — celle-ci (mode cuisine), les
> sauces, le tri des photos. Ce récit ne raconte que la sienne. Les deux autres :
> [RECAP_SESSION_2026-08-09_sauces.md](./RECAP_SESSION_2026-08-09_sauces.md) et
> [RECAP_SESSION_2026-08-09_photos-fin-du-tri.md](./RECAP_SESSION_2026-08-09_photos-fin-du-tri.md).

## 1. Ce que le lot a livré

Le mode cuisine tenait **un** plat. Il en tient plusieurs, et il dit quand les lancer.

- **L'entrée à plusieurs plats** — depuis la fiche recette, « Cuisiner avec un autre plat » ouvre le
  sélecteur ; le lien de cuisson porte la liste. Deux refus explicites : un plat déjà dans la liste,
  et un plat **sans étape `geste`** (rien à dérouler, donc rien à synchroniser).
- **L'heure de service** — une seule ligne en base (`user_cuisine_service`, v13), parce que la
  fonctionnalité est précisément de faire arriver ensemble des plats de durées différentes.
- **La frise des départs** — sous la barre d'onglets, elle dit quand lancer chacun.
- **La durée qui l'alimente, corrigée** — voir §2, c'est le fait du lot.

Le moteur (`engine/cuisine/ordonnancement.ts`) et la base portaient déjà le niveau 1 depuis deux
lots. **Il ne manquait que l'écran** : cinquième occurrence de « un champ déclaré n'est pas un champ
branché », la quatrième ayant été relevée le matin même par la session des sauces.

## 2. La partie qui ne se reconstitue pas : la durée était fausse sur 143 recettes sur 308

La frise se calculait sur `tempsPrepMin + tempsCuissonMin`. **Ces deux champs ne comptent pas les
temps de repos.** Conséquence directe à l'écran : `hareng_pommes_terre_tiedes` annonçait « à lancer
45 min avant le service » pour un plat qui porte une **marinade de douze heures**. `coq_au_vin`
annonçait 115 min pour 838 réelles.

⛔ **CE DÉFAUT N'A PAS ÉTÉ TROUVÉ EN RELISANT LE CODE, MAIS EN INTERROGEANT `catalog.db`.** Le code
était cohérent avec lui-même et avec ses tests ; c'est sa donnée d'entrée qui mentait. Aucune
relecture de `ordonnancement.ts` ne pouvait le voir — le module ne regarde aucune étape, par
conception, et son en-tête déclarait honnêtement cette limite comme un choix. Ce qui manquait n'était
pas une garantie, c'était **une mesure sur le catalogue réel**.

**La mesure, avant de corriger quoi que ce soit :**

| | |
|---|---|
| recettes dont la durée était sous-estimée | **143 / 308** |
| médiane de la correction | **+12 min** (87 des 143 sous le quart d'heure : du bruit éditorial) |
| corrections de plus d'une heure | **20** |
| écart maximal | **11 h 40** (`hareng_pommes_terre_tiedes`) |
| recettes dont un minuteur de CUISSON dépasse `tempsCuissonMin` | **7**, de 17 min au pire |

Ce dernier chiffre a décidé la formule. Les minuteurs **recouvrent** la cuisson déclarée — ils ne
s'y ajoutent pas — mais la préparation, elle, est du temps de mains pendant lequel aucun minuteur ne
tourne. D'où `tempsPrepMin + max(tempsCuissonMin, somme des minuteurs)` et non une somme des trois,
qui aurait compté la cuisson deux fois sur les 308.

⚠️ **Approximation assumée et écrite dans le code** : les minuteurs sont sommés comme s'ils
s'enchaînaient. Elle penche **du bon côté** — on annonce un départ trop tôt, jamais trop tard. Sur
cet écran, c'est le seul sens d'erreur acceptable.

### Le seuil des « repos longs » vient de la distribution, pas du jugé

Un repos de douze heures n'est pas un moment de la cuisson, c'est une avance à prendre. Restait à
dire **à partir de quand**. La question a été posée au catalogue plutôt qu'à l'intuition — les
81 étapes de repos :

```
2 min ×2 · 5 ×7 · 10 ×18 · 15 ×6 · 20 ×5 · 30 ×17 · 45 ×1 · 60 ×7 · 90 ×3 · 120 ×5
   ‖ trou complet entre 2 h et 3 h ‖
180 ×2 · 240 ×2 · 360 ×1 · 480 ×1 · 720 ×2
```

**73 des 81 tiennent en deux heures, puis plus rien jusqu'à trois.** Le creux est à 120 min ; le
seuil y est posé. Il se trouve qu'il coïncide avec ce que l'utilisateur avait décrit de mémoire
(« pour les repos court 1h-2h »), ce qui est un accord et non une preuve — la mesure aurait pu le
démentir, et c'est pour cela qu'elle a été faite.

## 3. ⛔ La relecture a trouvé le bon trou et s'est trompée sur sa portée

La première version de `reposLongMin` ne nommait que les repos **individuellement** longs. La
relecture a vu le trou : une recette à plusieurs repos moyens verrait son départ reculer de
plusieurs heures — `dureeTotaleMin`, elle, les somme toutes — **sans aucune phrase pour l'expliquer**.
Exactement l'heure inexplicable que cette ligne existe pour éviter.

Elle a conclu : *« non atteint par le catalogue actuel — la distribution a un trou entre 2 h et 3 h,
donc pas bloquant aujourd'hui »*, et recommandé de traiter le cas dans un lot séparé. **Le
raisonnement était juste et la conclusion fausse**, parce qu'il lisait la distribution des ÉTAPES
quand le cas porte sur le CUMUL PAR RECETTE. Vérification faite avant de suivre l'avis, **quatre
recettes y étaient déjà** :

| recette | cumul des repos | plus long repos seul |
|---|---|---|
| `sardines_marinees_citron` | 180 min | ≤ 120 |
| `pain_maison` | 160 min (plusieurs levées) | ≤ 120 |
| `poivrons_grilles_marines` | 135 min | ≤ 120 |
| `gaspacho` | 130 min | ≤ 120 |

Toutes muettes sur un départ décalé de deux à trois heures. La règle compare donc **le cumul** au
seuil, ce qui la simplifie au passage, et fait passer de 8 à 12 les recettes qui s'expliquent.

⭐ **La leçon est sur la méthode, pas sur la fonction** : *« inatteignable en pratique » est une
affirmation mesurable, et une relecture qui la produit sans l'avoir mesurée reste une hypothèse.*
Elle a coûté deux minutes à vérifier et aurait laissé quatre recettes fausses en production.

## 4. Deux tests qui REDISAIENT le calcul au lieu de l'APPELER

Ils recopiaient `r.tempsPrepMin + r.tempsCuissonMin` dans leur propre corps pour se comparer à
l'écran. L'un attendait « 1 h 55 » pour un coq au vin qui repose douze heures.

⚠️ **Un test qui redit la formule vieillit à côté du code sans jamais protester.** Celui-là n'a
protesté que par accident : la frise affiche le nombre **en toutes lettres**, donc l'écart est devenu
un `toContain` rouge. S'il avait comparé deux calculs, il serait resté vert en vérifiant que le code
faux égale le code faux. Les deux appellent `dureeTotaleMin` maintenant.

## 5. Deux pièges d'horloge, payés en relecture, tous deux silencieux

- **`instantDeService` rend la PROCHAINE occurrence de l'heure tapée.** La résoudre sur la date du
  jour plaçait « 00:15 » demandé à 23 h 30 **vingt-trois heures dans le passé**. Le réveillon est le
  cas normal de cette fonctionnalité, pas son cas limite.
- ⛔ **Le passage au lendemain se fait par `setDate(+1)`, JAMAIS par `+ 86_400_000`.** Les deux nuits
  de changement d'heure durent 23 h et 25 h. Le 24 octobre à 23 h 50, demander « 01:30 » rendait
  **00 h 30** — une heure AVANT ce qui venait d'être tapé, sans un mot, et toute la frise en héritait.
  Le même piège se represente dans `mentionDeJour` : elle compare des **jours de calendrier**, pas des
  tranches de 24 h. Un départ à 23 h pour un service à 1 h du matin ne fait que deux heures d'écart
  et se dit quand même « la veille ».
- **La comparaison à l'heure courante se fait à la minute.** À la seconde près, désigner « 19:40 » à
  19 h 40 min 30 s renvoyait au lendemain un plat qu'on voulait servir tout de suite.

**Limite connue, non corrigée à dessein et écrite sur la fonction** : la nuit du passage à l'heure
d'été, « 02:30 » n'existe pas et `Date` la normalise en 03 h 30. Aucune autre réponse n'est juste —
il n'y a pas d'instant pour une heure qui n'a pas eu lieu — mais le silence, lui, méritait d'être
consigné.

## 6. Le travail à trois sessions dans un arbre : ce qui a été payé

⛔ **UN SOUS-AGENT A LANCÉ `git stash` PUIS `git stash pop` SUR L'ARBRE PARTAGÉ** pour vérifier qu'un
test échouait bien sur l'ancien code. Il a rendu la main proprement — `git stash list` vide, les
23 diffs présents — mais pendant la fenêtre, **les 22 fichiers non commités d'une autre session
n'existaient plus**. Un `pop` en conflit, ou une écriture de la session voisine pendant la fenêtre,
et son lot partait. Toutes les consignes de sous-agent portent depuis une interdiction explicite de
`stash` / `checkout` / `restore` / `reset` / `clean`.

⚠️ **Trois rouges ont été attribués pendant ce lot, aucun n'était le sien** — et deux ont failli
l'être :
1. `texte-etape.ts` (`TypeError` sur 59 tests) : l'agent de test a conclu « flottement ». C'était la
   session voisine qui éditait le fichier **pendant** la mesure (+59 puis +73 lignes entre deux runs).
2. `SaisieRecette` privé de ses appelants de test au typecheck, propre dix minutes plus tôt.
3. L'invariant de la visite guidée « composer », cassé par un écran « Qu'est-ce que vous écrivez ? »
   inséré devant le `<h1 data-visite="titre-composer">`.

**La règle qui a fonctionné à chaque fois** : avant d'attribuer un rouge, vérifier si le fichier
fautif figure dans `git diff --name-only` du lot, et si le module en cause **importe** quoi que ce
soit du lot. `editeur-recette.tsx` n'importait rien d'ici — trente secondes, et l'attribution est
close.

## 7. Ce que le lot n'a PAS fait

- **L'entrelacement actif/passif** (niveau 2 de `ordonnancement.ts`) et la **réservation
  d'équipement** (niveau 3) restent hors périmètre. ✅ Mais le prérequis supposé est tombé :
  `recipe_step.timerType` porte déjà la distinction `cuisson` / `repos`, donc **aucune annotation des
  251 étapes n'est nécessaire** — même surprise que la décision 60, où 1 350 saisies annoncées se
  sont révélées dérivables.
- **Un `timerS` porté par une étape `avertissement`** gonflerait la durée pour un minuteur jamais
  affiché. Rien dans `catalog/build.mjs` ne l'interdit ; aucune recette n'est dans ce cas ; l'effet
  penche du côté sûr. Signalé par la relecture, **non traité**, consigné ici.
