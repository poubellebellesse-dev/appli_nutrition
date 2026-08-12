# Session du 2026-08-11 — le chantier régime clos, et la décision 65 mesurée

> **Instantané daté. Ne jamais réécrire.** Il décrit l'arbre au 2026-08-11, commits `b6d86d2` et
> `95fbbc0`. Les chiffres vieilliront ; c'est normal et ce n'est pas un défaut à corriger ici.
> L'état vivant est dans [ETAT.md](../ETAT.md).
>
> ⚠️ **Piste parallèle le même jour** : la lane médias a mené le chantier clips et licences —
> [RECAP_SESSION_2026-08-11_clips-gestes.md](./RECAP_SESSION_2026-08-11_clips-gestes.md). Les deux
> récits couvrent la même journée sur le même arbre et **ne se recouvrent pas**.

---

## 1. Ce qui a été livré

**Le chantier « régime personnalisable » est clos de bout en bout** — décision 67 barrée. Les lots
D3 (panneau « Mes exceptions ») et D4 (le compteur qui suit les admissions réelles) fermaient la
série A → B → C → C-bis → D1 → D2.

**La décision 65 (réservation de matériel) a été mesurée** au lieu d'être relue, et trois de ses
quatre termes ont bougé. Un plan de montée en est sorti :
[CONCEPTION_RESERVATION_MATERIEL.md](../CONCEPTION_RESERVATION_MATERIEL.md).

Relevé de fin de session, sur l'arbre commité : `npm test` **2 124 passed / 0 failed (109 fichiers)**
· typecheck propre · `vite build` ✓ (3,79 s) · `engine:plan-stress` **20/20**.

---

## 2. ⭐ Ce qu'il faut retenir : trois affirmations écrites par moi, fausses, et comment chacune est tombée

**C'est la seule partie de ce document qui vaut d'être relue dans six mois.** Le reste est de
l'avancement, il est dans `ETAT.md`.

### 2.1 « La colonne d'étape suffit » — démentie par la clé de la table

La décision 65 demandait **une colonne d'étape** sur `recipe_equipment`. La table a pour clé
`(recipe_id, equipment_id)` : **une seule ligne par couple**. Or **13 recettes sur 83 occupent le
four deux fois**, et une trois fois. `colin_four_fenouil` enfourne le fenouil seul, on sort le plat,
on pose le poisson, on remet — **et entre les deux, le four est libre**, ce qui est exactement
l'information qu'une réservation doit porter.

⛔ **Ce défaut ne se serait vu qu'APRÈS avoir rempli les données**, au moment d'écrire le code. Il a
été trouvé par une sonde de lecture, avant d'écrire une ligne. **La leçon n'est pas « la 65 était
fausse », c'est que mesurer avant de coder a coûté vingt minutes et évité un lot de contenu entier.**

### 2.2 « Le chantier fait 1 473 lignes » — un nombre juste, employé pour la mauvaise question

`ETAT.md` et `CLAUDE.md` annoncent **1 473 couples** recette × ustensile, et c'est vrai. Mais la
réservation ne concerne que le niveau `requis` : **357**, dont **83** pour les ustensiles
indivisibles. Les 1 078 `informatif` et 38 `accelere` n'ont **aucun effet moteur**.

⚠️ **Le nombre n'était pas faux, son usage l'était.** Un total exact recopié dans un contexte où il
ne s'applique pas fait paraître un chantier 17 fois plus gros qu'il n'est — et personne ne le
vérifie, puisque le chiffre est juste.

### 2.3 « ~4 % de faux positifs » — mon propre chiffre, faux, corrigé dans la même session

En consolidant la sonde de mesure, le détecteur a remonté **24** cas fragiles et non 22. Relus un à
un : **18 justes, 6 faux — ~6 %, pas 4 %.** J'avais écrit 4 % dans `ETAT.md` dix minutes plus tôt.

Même histoire pour la durée : **89 %** des *occupations* ont un minuteur, quand j'avais écrit 86 %
— qui comptait les *recettes* dont **toutes** les occupations en ont un. **Deux mesures différentes,
une seule doit survivre dans le document.**

⛔ **La règle qui a rattrapé les deux : un chiffre cité dans une décision doit être reproduit par la
commande qu'on cite, pas par la mesure qu'on se souvient d'avoir faite.**

---

## 3. ⛔ Deux taux de décision reposent sur des scripts absents du dépôt

Découvert en voulant rendre la mesure rejouable : **`atelier/` est gitignoré en entier**
(`.gitignore:43`). Poser la sonde là a reproduit le défaut du dossier temporaire avec un plus joli
chemin.

**Et ce n'est pas isolé.** `catalog/lien-etape-ingredient.mjs` — du code versionné — annonce
« Rejouer la mesure : `node atelier/mesure-liens-etapes.mjs` » pour justifier ses **94 %**. Ce
fichier n'est dans aucun clone.

⚠️ **Sur cette machine, tout fonctionne.** Ailleurs, la commande citée n'existe pas. **Non tranché** :
`.gitignore` est de la configuration de dépôt, elle ne se change pas au détour d'un lot de doc. La
parade retenue dans le plan de montée est de faire vivre la **règle** dans `catalog/` (versionnée) et
de n'y laisser que la **sonde** — une sonde se réécrit, une règle non.

---

## 4. Ce que la lane régime a corrigé sans que ce soit demandé

- **L'en-tête de `ETAT.md` §4 annonçait « CINQ » décisions ouvertes** avec la conclusion « plus
  aucune ne bloque le code ». Il y en avait **dix**, et la 65 bloque. Recompté mécaniquement sur les
  numéros non barrés, jamais de mémoire.
- **`docs/README.md` portait trois affirmations fausses sur une seule ligne** à propos du chantier
  régime : « décision 67 ouverte », « rien de codé », « A → B → C recommandé ».
- **Le critère d'arrêt de D3 n'est tenu qu'à moitié** et c'est écrit tel quel plutôt que coché : un
  aliment admis fait bien réapparaître les plats (mesuré sur le catalogue réel), mais **aucun test
  n'assied que « pourquoi ce plat » cesse d'attribuer au régime**. Plausible par l'acquis 3 ;
  plausible n'est pas mesuré.

---

## 5. Ce qui reste ouvert à la fin de la session

- **La 65 n'est pas fermée** — elle a un plan, pas une décision. Le point d'arrêt est la **capacité**
  (`partageable` au catalogue, `quantite` dans les réglages), validé par l'utilisateur dans son
  principe : l'appli demandera **une fois** combien de feux a la plaque.
- **Le sort de `atelier/`** — sortir les sondes vers un dossier suivi, ou assumer des taux non
  rejouables.
- **Le chantier régime laisse le lot E (`presure`)** optionnel et non entrepris. ⛔ **Il ne rouvre
  PAS la 67** : s'il est repris, il ouvre sa propre décision.
