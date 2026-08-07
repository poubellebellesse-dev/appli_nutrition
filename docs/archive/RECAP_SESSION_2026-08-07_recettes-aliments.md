# Session du 2026-08-06 → 08-07 — recettes & aliments

> **Instantané daté — ne jamais réécrire.** Vrai à sa date. Les nombres qu'il porte seront faux
> plus tard : l'état courant est dans [../FICHE_REPRISE.md](../FICHE_REPRISE.md) et
> [../ETAT.md](../ETAT.md).
>
> ⚠️ **Piste parallèle** — une SECONDE session travaillait dans le même dépôt pendant toute la
> période, sur le mode cuisine, le champ `piquant` et les cotes de confiance ANSES. Ce récit ne
> raconte pas son travail. Au moment de la clôture, **355 fichiers modifiés dans l'arbre lui
> appartenaient**, aucun n'était à moi.

## 1. Ce qui est livré

| Lot | Commit | Contenu |
|---|---|---|
| Garde d'origine animale | (emporté par `b16b16e`) | `catalog/build.mjs` refuse un aliment dont un allergène strictement animal ne se rattache à aucune origine · 4 tests dans `catalog/build.test.ts` · 10 `origine_animale` posées dans `foods.yaml` |
| 41 recettes végétaliennes ET sans gluten | (emporté par `b16b16e`) | 13 petits-déjeuners, 18 accompagnements, 10 plats. Catalogue 241 → 282 |
| Délai de test à 15 s | `54599c5` | `vitest.config.ts` — contention machine, pas lenteur |
| Décision 61 | `2e8d4fe` | `ETAT.md` §4 — l'écran Recettes rend tout le catalogue dans le DOM |
| Le banc dit ce qu'il taisait | `4550cad` | `stress-planning.ts` — troisième état `SIGNAL` |
| 10 plats de plus | `8cd7227` | 282 → 292 |
| 5 classiques français | `e3bc94c` | 292 → 297. ⛔ **C'est ce commit qui a fait rougir la branche — voir §5** |
| `chou_blanc` | `11687d4` | 450 → 451 aliments |

Quatre commits vivent sur la branche **`recette-aliments`** ; `54599c5` et `2e8d4fe` sont sur `main`.

## 2. Ce que la mesure a démenti

**C'est la partie qui ne se reconstitue pas.** Sept affirmations, dont quatre étaient les miennes.

**(1) « Le lot final attend le commit. »** Faux à la seconde où je l'ai vérifié : tout était déjà
dans `87face3`. Le rappel de reprise décrivait un état périmé — la fiche l'avait dit, puis le monde
avait bougé.

**(2) « Écrire des accompagnements végétaliens fera tomber le 18/28. »** La fiche l'annonçait comme
« la seule chose qui les fera tomber ». Les accompagnements végétaliens sont passés de **11 à 29** :
le compteur **n'a pas bougé d'une unité**. La cause était dans les PLATS — `pickAccompagnement` sort
si la recette posée n'est pas `service: 'plat'`, et `placedRecipeIds` interdit de reposer un plat
dans la fenêtre. **« 18 accompagnements posés » n'était pas une mesure des accompagnements : c'était
le nombre de plats, compté sous un autre nom.** Écrire 10 plats a porté le compte à 28/28.

**(3) « 20/20 configurations saines. »** Le banc l'imprimait pendant que le végétalien tournait à
18 accompagnements sur 28 et que « végétalien + sans gluten » laissait **17 créneaux vides**. Un banc
qui n'a que deux états — passe / casse — appelle « sain » tout ce qui ne casse pas. Corrigé par un
troisième état, `SIGNAL`, qui **sort en code 0** : ce n'est pas un échec, c'est un manque de contenu.

**(4) `tests/regime-coherence.test.ts` était vert, et ne vérifiait rien.** Il comparait l'étiquette
`regime` d'une recette à une règle qui lisait **le même champ manquant** que l'étiquette. Dix aliments
d'origine animale passaient pour végétaliens, dont **`nuoc_mam`** — de la sauce de poisson.

**(5) `semaine.test.tsx` était vert par chance.** Son exemption ne portait que sur
`(date, créneau, service)` ; elle tenait tant que le catalogue avait la bonne taille. Élargie au
créneau entier.

**(6) « `main` est flaky. »** Non : un timeout à 5 000 ms qui changeait de fichier à chaque passage.
Mesuré en isolation : **1 453 ms**, soit 29 % du budget. De la contention, deux suites tournant en
même temps. Le délai est passé à 15 s — on ne corrige pas une contention en accélérant le code.

**(7) La commande `curl` du document de sourçage rendait un fichier VIDE.** `archive.org/download/`
répond **302**, jamais 200 ; sans `-L`, curl écrit **0 octet, sans erreur, en code de sortie 0**. Le
document décrit une méthode qui consiste à grepper ce fichier pour décider si un plat figure chez
Escoffier : **un fichier vide répond « absent » à toutes les questions.**

## 3. La leçon — un oracle qui partage la donnée de son sujet ne vérifie rien

Les points (3), (4) et (5) sont **le même défaut sous trois formes**. À chaque fois, le vérificateur
lisait la donnée qu'il était censé contrôler, ou n'avait pas d'état pour exprimer le doute :

- le test de cohérence de régime lisait le champ dont l'absence était précisément le défaut ;
- le banc n'avait aucun moyen de dire « ça tourne mais il manque du contenu » ;
- le test d'écran s'appuyait sur une propriété du catalogue au lieu de la construire.

**Un test vert n'est une information que si l'on sait ce qui le ferait rougir.** Aucun de ces trois
n'aurait pu rougir sur le défaut qu'il était censé garder. C'est consigné dans
[../reference/PIEGES.md](../reference/PIEGES.md), section « Les bancs mentent par omission ».

Corollaire déjà payé ailleurs et re-payé ici : **`documents Ciqual/` est gitignoré, donc
`catalog/audit-mapping.mjs` ne peut PAS devenir un test.** C'est la seule garde contre la classe de
défaut qui avait fait porter à sept recettes les valeurs du mauvais aliment — et elle ne rougira
jamais toute seule. **À relancer à la main après chaque lot de contenu.**

## 4. Le contenu — ce qui a été refusé, et pourquoi

Cinq aliments demandés, **un seul retenu**. Le refus est la partie utile :

| Candidat | Verdict |
|---|---|
| Deux « nouveaux » aliments | **Doublons déguisés / plats préparés** — écartés par une décision déjà datée |
| `morue_salee` | **4 900 mg de sodium** contre 65 pour le cabillaud — un facteur **75**. Un aliment dont on ne peut pas afficher la valeur sans la contextualiser |
| `gros_sel` | Refusé sur la **divergence identifiant / nom** : le sel gris n'est pas le gros sel. S'il est voulu, il s'appelle `sel_marin_gris` — **non fait, à confirmer** |
| `chou_blanc` | ✅ **Retenu** — trou de famille réel : le catalogue avait vert, rouge, chinois, kale, rave, romanesco, fleur et Bruxelles, pas le blanc |

⚠️ **Les valeurs d'un aliment ne s'écrivent jamais à la main** : `ciqual-mapping.yaml` porte le code,
`npm run catalog:ciqual -- --write` écrit les nutriments, et **les allergènes s'annotent à la main**.
C'est la raison pour laquelle on n'importe pas les 3 484 entrées Ciqual en masse : elles n'ont aucun
allergène, et 3 000 aliments réputés sans allergène **videraient** le garde-fou §5.2 au lieu de le
contourner.

## 5. Mes erreurs

**⛔ La plus chère : j'ai committé `e3bc94c` sans avoir jamais exécuté la suite sur ce commit.**
J'avais vérifié `11687d4` dans un worktree isolé **ne contenant que les deux fichiers d'aliments**,
posés sur `main` — pas la pile de commits. Les 15 recettes des deux commits précédents n'y étaient
pas. Bissecté le 2026-08-07 :

```
main      282 recettes   Tests 17 passed (17)
4550cad   282 recettes   Tests 17 passed (17)
8cd7227   292 recettes   Tests 17 passed (17)
e3bc94c   297 recettes   Tests 2 failed | 15 passed (17)
11687d4   297 recettes   Tests 2 failed | 15 passed (17)
```

C'est **exactement** le piège « ce qu'on commite n'est pas ce qu'on a testé », que ce dépôt a déjà
payé deux fois — et je l'ai repayé en croyant m'en garder. **Vérifier un sous-ensemble de fichiers
n'est pas vérifier un commit.** La parade correcte est le worktree détaché **sur la référence**,
pas sur une sélection de fichiers.

Le détail du défaut est en §6 ci-dessous.

**Autres, moins chères :**

- **Les codes du lexique dérivés du nom de fichier** — j'ai écrit `tailler-des` là où le code interne
  est `tailler_des` (idem `bain_marie`, `monter_blancs`). Pire : **la commande de vérification que
  j'avais donnée aux agents portait le même défaut**, donc leur contrôle ne pouvait pas l'attraper.
  Un oracle faux de la même façon que le sujet — le point §3, encore.
- **`sed -i` sur un glob a réécrit les fins de ligne** de 7 fichiers suivis. Restauré par
  `git checkout --`.
- **Un agent a écrasé `poireaux-vinaigrette.yaml`**, une entrée végétarienne existante. Restauré ;
  remplacé par `fondue-poireaux-huile-olive.yaml`.
- **Deux doublons introduits** — `houmous_pois_chiches_tahin` et `haricots_blancs_tomate_sauge`.
  Supprimés, remplacés par `riz_sauvage_champignons` et `manioc_roti_paprika`.
- **Mes accompagnements étaient trop légers** (médiane 157 kcal contre 253) et ont créé des
  avertissements neufs. Corrigés **par la matière, jamais par l'huile** : la soupe à 248 kcal est
  passée à 361 en montant les haricots de 600 à 800 g et en ajoutant 350 g de pommes de terre.
- **Un terme banni est passé** : `soigne`, à l'intérieur de « soigneusement », dans `pot_au_feu`. Le
  vocabulaire interdit se compare **en sous-chaîne et sans accents** — un mot honnête peut en cacher
  un autre.
- **Quatre commandes lancées dans le désordre** (2026-08-07) : `npm test` avant
  `node catalog/build.mjs` dans un worktree neuf → **203 échecs** qui n'étaient qu'un `catalog.db`
  absent. `catalog.db` est un artefact de build, gitignoré : **dans un worktree neuf, le catalogue se
  bâtit AVANT tout le reste.**

## 6. ⛔ Ce qui reste ROUGE — deux tests d'écran, cause identifiée

`app/src/ui/screens/aujourdhui.test.tsx` : **2 échecs sur 17**, introduits par `e3bc94c`,
reproductibles, sur la branche `recette-aliments` uniquement (`main` est vert).

**Les deux assertions cassées portent sur le CONTENU du catalogue, pas sur un invariant du code.**

| Test | Ligne | Ce qu'il suppose |
|---|---|---|
| « choisir un plat remet le compteur d'indécision à zéro » | `:155` | Que 10 clics sur *Suivant* révèlent assez de plats **distincts** pour rouvrir l'encart |
| « choisir un autre créneau change les suggestions » | `:265` | Que le plat n° 1 du dîner **diffère** du plat n° 2 du déjeuner |

**Mesuré :** l'écran propose **12 suggestions** ; l'encart s'ouvre à `vues.size - 1 >= 10`, donc il
faut **11 recettes distinctes** ; le test en parcourt 10. **La marge était d'une recette**, et elle
tenait au classement. Les cinq classiques l'ont consommée. Pour le second, les deux créneaux
affichent désormais le même plat — *Pizza maison tomate-mozzarella* — ce que **rien n'interdit** :
presque tous les plats portent `types_repas: [dejeuner, diner]`, et le moteur n'a jamais promis que
le meilleur du midi diffère du meilleur du soir.

⚠️ **Ce n'est PAS un défaut produit, et il ne se corrige pas en retirant des recettes.** C'est la
même famille que `semaine.test.tsx` (§2 point 5) : **un test d'écran qui s'appuie sur une propriété
du catalogue au lieu de la construire**. Le correctif est dans le test — piloter jusqu'à l'état
voulu, ou monter sur un catalogue de fixture — **et il n'a pas été fait** : `aujourdhui.tsx` est
dans les fichiers en cours d'édition par la session parallèle, y toucher pendant ce temps était
la garantie d'un conflit.

## 7. Les mesures de clôture

Worktree détaché sur `11687d4`, jonction `node_modules`, **catalogue rebâti en premier** :

```
node catalog/build.mjs   451 aliments, 297 recettes, 62 gestes, 73 tips, 8 fiches (33 positions)
                         recipe_step : 1368 étapes dont 1350 gestes et 18 avertissements
npm test                 2 failed | 1554 passed (1556) — 85 fichiers, 1 rouge   ⛔ voir §6
npm run typecheck        propre
npx vite build           ✓ built in 3.00s
npm run engine:plan-stress
                         20/20 configurations saines
                         ⚠ 1 configuration porte un SIGNAL :
                           végétalien + sans gluten, 14 j × 4 → 56/56 remplis · 56 plats
                           distincts · 27 accomp. (27/28) · min 1302 kcal · 0 avertissement
```

Dans l'arbre principal, seul endroit où `documents Ciqual/` existe :

```
node catalog/audit-mapping.mjs   451 mappings balayés — 9 candidats à relire
```

Les 9 sont **tous des écarts de forme**, aucun n'est un mauvais aliment : `fromage_emmental_rape`
(« fromag » absent d'« Emmental râpé »), `moutarde_dijon`, `jambon_blanc`, `maizena`,
`creme_liquide`, `jambon_cru`, `thon_frais`, `pont_leveque`, `anchois_frais`. `chou_blanc` n'est pas
signalé.

## 8. Ce qui reste ouvert dans cette zone

1. ⛔ **Les 2 tests rouges de `aujourdhui.test.tsx`** — §6. Bloquant pour fusionner la branche.
2. **23 recettes sans facette `cuisine`**, toutes issues du commit `5cc5f19` (2026-07-28). Elles
   contredisent leurs jumelles : `porridge-avoine-banane` → britannique mais
   `porridge-dattes-cannelle` → rien ; `smoothie-banane-myrtille` → internationale mais
   `smoothie-banane-mangue-amande` → rien. Effet : filtrer sur une cuisine rend l'une et cache
   l'autre. **Le moteur est sain** — `similarity.ts:109` traite l'absence comme une absence, jamais
   comme une égalité. Décision **ouverte**, voir `ETAT.md` §4.
3. **`sel_marin_gris`** — non fait, à confirmer (§4).
4. **1 SIGNAL au banc** : « végétalien + sans gluten » à 27 accompagnements sur 28. Même cause, même
   correctif que le reste : **des plats**, pas des accompagnements (§2 point 2).
5. **Un doublon préexistant à 83 %** : `salade_quinoa_feta_menthe` / `taboule_quinoa_menthe`. Aucune
   des deux n'est de moi ; aucune suppression sans arbitrage.
6. **Zéro photo sur 297 recettes**, alors qu'elles sont déclarées OBLIGATOIRES depuis le 2026-08-01.
   Extraire celles d'Escoffier n'est **pas** une piste : l'édition numérisée est un scan BnF dont
   l'OCR écrit « cîlroii » pour « citron ». Il sert à **localiser et décider**, jamais à illustrer.
