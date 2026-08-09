# Session du 2026-08-09 — les sauces, lots 2 à 4

> **Instantané daté — ne jamais réécrire.** Vrai à sa date. Les nombres qu'il porte seront faux
> plus tard : l'état courant est dans [../FICHE_REPRISE.md](../FICHE_REPRISE.md) et
> [../ETAT.md](../ETAT.md).
>
> ⚠️ **Deux autres sessions écrivaient dans le même dépôt pendant toute la période** — l'une sur le
> mode cuisine à plusieurs plats (`cuisine-session*`, `ordonnancement.ts`, `texte-etape*`,
> `lien-etape-ingredient*`, `choisir-plat.tsx`), l'autre sur le tri des photos (`FICHE_REPRISE.md`,
> `archive/README.md`). **Ce récit ne raconte pas leur travail**, et les deux rouges vus dans la
> journée leur appartenaient. HEAD a bougé quatre fois sous cette session sans qu'elle y touche.

## 1. Ce qui est livré

Le lot « sauces » de la dette §8 comptait quatre points. **Les trois derniers sont fermés ici** ;
① avait été livré par `d85fc42` (l'axe séparé, `est_sauce`, `types_repas: []`, `suggestSauces`).

| Lot | Contenu |
|---|---|
| ② choix mémorisé + courses | `user_recipe_sauce (recipe_id, sauce_recipe_id)` en **v14** · `readSaucesChoisies` / `setSauceChoisie` · `ShoppingOptions.saucesParRecette` · `ShoppingListItem.pourSauces` · bouton « Sauces (N) » dans l'écran Recettes (`BrowseRequest.saucesSeules`) · section par sauce dans les courses, **rangement « Repas » uniquement** |
| ③ cuisiner la sauce avec le plat | Bouton « La cuisiner avec le plat » sur chaque ligne de sauce, qui remplit la **même liste `avec`** que « cuisiner avec un autre plat » |
| ④ sauces perso | `SaisieRecette` et `StoredUserRecipe` gagnent `estSauce` et `porteDejaUneSauce` · l'éditeur demande « un plat ou une sauce ? » **avant** le formulaire · case « Vient-il déjà avec sa sauce ? » sur un plat |

Relevé de clôture, arbre complet, 14h20 : `npm test` → **1 940 passed / 0 failed (96 fichiers)** en
52,3 s · `typecheck` propre · `vite build` ✓ (3,42 s) · `engine:plan-stress` **20/20**.

## 2. Ce que la mesure a démenti

**C'est la partie qui ne se reconstitue pas.** Trois affirmations, toutes écrites par moi dans
`ETAT.md` avant d'être vérifiées.

**(1) « ③ demande un changement de schéma `user.db`. »** Faux. Il a coûté **un bouton**. Entre
l'écriture de la dette et son paiement, la session parallèle avait livré la v13 : `SousVue.cuisine`
porte une LISTE, `hashDeLaCuisine(id, portions, avec[])` la transporte, `ordonnancerCuissons` fait
partir la plus longue en premier — une sauce de 5 min finit d'elle-même à la fin, sans une ligne de
code de tri. Il ne restait rien à construire, seulement à appeler.

**(2) « ④ demande d'attacher une sauce à une recette perso. »** **La moitié de ④ était déjà livrée
par ①**, et personne ne l'avait vu : `suggestSauces` rend toutes les sauces dans `autres`, et une
recette perso est une recette comme une autre dans le panneau « Ajouter une sauce ». Il ne restait
que l'autre moitié — *écrire* une sauce perso.

⚠️ **Deux fois dans le même lot, une dette chiffrée a coûté moins que son énoncé.** La leçon n'est
pas « j'ai mal chiffré » mais **remesurer une dette avant de la payer** : entre les deux, le monde
a bougé, et c'est structurel quand plusieurs sessions écrivent dans le même dépôt.

**(3) « Le fixture `estSauce: true` fait de cette recette une sauce. »** Faux, et silencieux.
`makeRecipe` (`engine/selection/test-fixtures.ts`) fige `estSauce: false` et **ignore** un
`estSauce: true` passé en options — le champ se pose par étalement, pas par surcharge. Le typecheck
l'a dit (TS2353) ; à l'exécution rien n'aurait bronché, `shopping-list.ts` résolvant des
identifiants sans jamais lire le drapeau. Corrigé en étalant localement, pas en touchant au fixture
partagé.

## 3. Les décisions prises

**Le choix d'une sauce s'attache au PLAT, pas au créneau du plan** (option B contre option A).
« Je prends toujours cette sauce avec ce plat » est une **préférence durable**, elle vaut pour tous
les créneaux où le plat apparaît et survit au plan. L'option A — `meal_plan_sauce` clé sur
`(plan, date, créneau, service)` — a été **explicitement écartée** : elle rendait le choix mortel
avec le plan, et faisait payer une table de jointure pour un besoin que personne n'a exprimé.
⛔ **Ne pas la rouvrir sans un besoin qui exige de saucer LE MÊME plat différemment selon le jour.**

**Les sauces n'ont de catégorie propre QUE dans le rangement « Repas » des courses.** En « Rayon »
et en « Jour », un ingrédient de sauce est un article comme un autre — un yaourt de sauce se prend
à la crèmerie avec les autres yaourts. Motif : les six rayons comptent des **traversées de magasin**,
pas des familles d'aliments ; un rayon « sauces » ferait revenir sur ses pas. En vue « repas » la
question n'est plus « où est-ce dans le magasin » mais « à quoi ça sert », et là la sauce est bien
une catégorie.

**Le type d'une recette perso se demande AVANT le formulaire** (option B contre un champ dans le
formulaire). La réponse ne renseigne pas un champ : elle décide **quelles questions sont posées**.
Une sauce ne se voit demander ni créneau ni envergure — les deux n'ont pas de réponse pour elle.

**`schemaVersion` reste à 1, les deux nouveaux champs sont optionnels sur la forme stockée.**
`analyserAvecMotif` REFUSE net toute autre version avec un message à l'écran : passer à 2 rendait
illisible chaque recette perso déjà enregistrée **et** faisait rejeter par une version antérieure
tout `.nutri-recipe` exporté par celle-ci (§8.7 — les recettes se partagent par fichier). Un champ
additif absent se lit `undefined`, donc « un plat, rien de dit sur sa sauce » : exactement ce que
voulaient dire les entrées écrites avant le lot.

## 4. Les garanties, et où elles vivent

**La décision 62 est appliquée à UN SEUL endroit : `versRecette`**, qui force `typesRepas: []` et
`service: null` sur une sauce. La forme stockée, elle, garde la saisie **telle quelle**.

Deux raisons, dans cet ordre. **(1)** C'est `versRecette` qui construit le domaine : une entrée
écrite avant le lot, ou un `.nutri-recipe` bricolé à la main, ne peut donc pas faire entrer une
sauce dans un dîner. Deux points d'application finiraient par diverger. **(2)** Garder la saisie
brute a un intérêt concret : qui bascule sa sauce en plat retrouve les créneaux qu'il avait cochés,
au lieu d'un formulaire vidé sans raison visible.

`problemes()` cesse d'exiger un créneau **pour une sauce seulement**. Sans cette exception, la règle
et la décision 62 se contrediraient — l'une réclame un créneau, l'autre interdit d'en avoir un — et
aucune sauce perso ne serait enregistrable, avec un message réclamant la réponse à une question que
l'écran ne pose plus.

⚠️ **`porteDejaUneSauce` a TROIS états derrière une case, et la traduction n'est pas symétrique.**
Cochée → `true`. Décochée ou absente → **`null`, pas `false`**. `null` veut dire « personne n'a
tranché » et laisse la dérivation par les ingrédients attraper une recette perso au ketchup, comme
avant le lot ; `false` affirmerait « je certifie qu'il n'y a pas de sauce », ce que ne pas cocher
une case ne dit pas.

⚠️ **`sauceIds` reste vide sur une recette perso.** Le catalogue **propose** (`Recipe.sauceIds`),
l'utilisateur **choisit** (`user_recipe_sauce`). Sur une recette perso la distinction s'effondrerait
si on les mêlait — et c'est la même confusion que la décision B écarte du côté du plan.

⚠️ **Les deux boutons d'une ligne de sauce sont deux décisions et doivent le rester.** « Je la
prends toujours avec ce plat » est durable (`user_recipe_sauce`, achète toutes les semaines) ;
« La cuisiner avec le plat » meurt au démontage de la fiche. Les fusionner ferait acheter une sauce
à qui voulait seulement la préparer ce soir. **Verrouillé dans les deux sens par test.**

## 5. Les deux défauts trouvés, et ce qui ne les avait pas vus

**(a) `SaucesAAjouter` écrit au lot 1, jamais rendu — QUATRIÈME occurrence du défaut « un champ
déclaré n'est pas un champ branché ».** Le composant, l'interface `VueSauces`, le champ `Vue.sauces`
et son chargement (`lireLesSauces`, appelé à CHAQUE ouverture de fiche) étaient tous en place et
corrects ; **aucun `<SaucesAAjouter>` n'apparaissait dans le JSX**, ni dans `d85fc42` ni dans HEAD.
La section n'a donc jamais existé à l'écran, et `ETAT.md` l'a décrite comme livrée pendant un jour.

⛔ **Rien ne pouvait le signaler** : le typecheck est content d'un champ rempli et non lu, et
`detail-recette.test.tsx` ne contenait **pas une seule occurrence du mot « sauce »**. La leçon n'est
pas « mieux relire » — c'est qu'**un test qui n'assure que la PRÉSENCE de la section est le seul
garde-fou de cette classe de défaut**, et qu'il doit être écrit en même temps que le composant.

**(b) Une question déplacée en amont casse les ancres du parcours guidé.** Poser « un plat ou une
sauce ? » avant le formulaire a fait passer au rouge l'invariant central de `parcours.test.tsx` :
le parcours « composer » ouvre sur `#/composer`, donc désormais sur la question, et ses quatre
étapes visent des `data-visite` du FORMULAIRE, qui n'existe pas encore. **C'est le test qui l'a
attrapé, pas la relecture.** Corrigé en portant `data-visite="titre-composer"` sur le titre de la
question aussi. Écrit dans [../reference/PIEGES.md](../reference/PIEGES.md).

⚠️ **L'autre coût d'une question en amont est d'enfermer.** Traité en gardant le type **affiché et
modifiable** en haut du formulaire — y compris sur une recette rouverte des mois plus tard, où il
n'apparaîtrait sinon nulle part.

## 6. Un test qui aurait été vert pour toujours

Le premier test négatif de ③ cherchait dans le catalogue réel une recette **sans étape `geste`**,
et sortait par la porte de derrière s'il n'en trouvait aucune. Vérifié en SQL : **0 sur 308**. Il
serait resté vert quoi qu'il arrive au code qu'il prétendait garder. Remplacé par le clone
synthétique déjà en usage dans le même fichier (`plat_sans_geste_test`).

⚠️ **Un test qui commence par « si le catalogue contient… » doit prouver que le catalogue le
contient**, sinon il ne teste rien et le dit à personne.

## 7. Ce qui n'a PAS été fait, et pourquoi

- **La dette `regimeExigePar`** — ne rend `omnivore` que si `food.groupe === 'viandes'`, si bien que
  `bouillon_boeuf` se lit végétarien. Vue en écrivant `sauce-poivre.yaml`, **non traitée** : c'est un
  défaut de sécurité alimentaire qui mérite son propre lot, pas un à-côté d'un lot d'écran.
- **Le flottement 1 754 / 1 766** de la suite (un run sur quatre, vert dans les deux cas) reste non
  identifié. **Le socle a bougé** : la référence verte est **1 940** au 2026-08-09 14h20. Ce qui
  reste à surveiller est l'ÉCART, pas les nombres.
- **Les chiffres de catalogue n'ont pas été rejoués** : aucun des trois lots ne touche un fichier de
  contenu. Ils datent du 2026-08-08 — 451 aliments, 308 recettes, dont 3 sauces.
