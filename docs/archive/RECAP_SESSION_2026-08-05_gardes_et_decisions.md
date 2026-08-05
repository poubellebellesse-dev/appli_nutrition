# Récap — session du 2026-08-04 → 2026-08-05 · gardes, index et décisions

> **Instantané daté. Ne jamais réécrire, ne jamais citer comme état.**
> L'état vit dans [../ETAT.md](../ETAT.md), la reprise dans [../FICHE_REPRISE.md](../FICHE_REPRISE.md).
>
> ⚠️ **Une SECONDE session a travaillé en parallèle dans le même dépôt** sur toute la période
> (chantier recherche/synonymes, contenu aliments et recettes, puis mode cuisine). Ses commits sont
> intercalés dans le journal — `c17af24`, `dd94026`, `adae575`, `34202aa`, `361764d`, `c9d99c4`,
> `d3edadb`, `4433574`, `fd346c6`. **Ce récit ne couvre PAS son travail**, seulement celui de la
> présente session. Lire les deux pour comprendre l'état du dépôt.

## Le fil rouge

Toute la session tient sur une seule question : **qu'est-ce qui, dans ce dépôt, est AFFIRMÉ sans
que rien ne le vérifie ?** Six cas ont été trouvés et fermés, tous de la même famille et tous
invisibles en test.

| Ce qui était affirmé | Ce qui était vrai |
|---|---|
| L'index de `ETAT.md` §4 : 15 décisions « ouvertes » | Leur texte disait « tranchée » |
| Trois écrans annonçaient « chercher un aliment » | Ils comparaient des sous-chaînes |
| La décision 58 citait trois exemples mesurés | Deux étaient devenus faux en un jour |
| `theme.css` annonçait ses rapports de contraste en commentaire | Le mode sombre échouait le seuil que le clair avait été refait pour atteindre |
| `ETAT.md` : « le lexique banni sur-bloque » | Il SOUS-bloquait aussi — cinq fuites |
| `banned-terms.ts` : « la vraie garantie, c'est le test de cohérence » | Ce test ne comparait que les LISTES, pas les implémentations |

Et trois affirmations **de moi**, corrigées avant ou après être entrées quelque part : un « des
mois » qui valait trois jours, un commentaire « un plat préparé se rappelle comme un autre » que
`rappel.ts` contredit, et `repasServis` qui aurait annoncé « 2 repas prévus » sous une semaine qui
en affiche trois.

## Ce qui a été commité

| Commit | Ce que c'était |
|---|---|
| `4ab457f` | `ETAT.md` §4 : 15 lignes barrées, une convention d'index posée |
| `03c0261` | La racine React de `main.tsx` n'était jamais démontée — quatre coquilles vivantes par fichier de test, exit 1 sur 1 315 tests verts |
| `828e459` | La décision 58 accusait le catalogue ; c'est la RECHERCHE qui échouait |
| `a4de62e` | Frigo : une saisie plus longue que le nom rendait une liste vide |
| `7a1520a` | La même sous-chaîne, copiée dans Courses et l'éditeur — dont un cas qui faisait taire une note d'allergène |
| `7040c33` | Trois tables jumelles dédupliquées, dont une qui avait déjà divergé |
| `9197059` | Le mode sombre échouait le contraste ; `ui/contraste.test.ts` recalcule désormais les deux thèmes depuis `theme.css` |
| `22f1a9c` | Le lexique banni laissait passer « guérison » et « prévient le cancer » |
| `0c15a04` | Décision 51 : un plat préparé remplit le créneau et sort du calcul |
| `287dd13` | Réparation : `0c15a04` ne compilait pas (voir plus bas) |

## Les deux décisions tranchées

**Décision 51 — plats préparés.** Issue **(a)** : le créneau est marqué et EXCLU du calcul
nutritionnel. Migration v9, `meal_plan_entry.hors_catalogue` avec
`CHECK (recipe_id IS NULL OR hors_catalogue IS NULL)` — le quatrième état est inexprimable, pas
seulement découragé. Deux affirmations de la version ouverte de la décision étaient fausses et ont
été corrigées en la tranchant : §6.5 n'interdisait pas l'issue (b) (c'est la traçabilité qui
l'écarte), et le risque n'était pas la couche `nutri` mais le **cumul réinjecté** de `plan-week`,
où un plat préparé comptait zéro et faisait surcompenser le planificateur.

**Décision 33 — codes de confiance CIQUAL.** Issue **importer sans pondérer**. Remesurée d'abord :
ses trois chiffres avaient bougé (39 % de C/D hors énergie contre 34 %, énergie à 434 D sur 449
contre 191/192) et elle citait les mauvaises sources — la première source empruntée est **l'USDA**
(451 occurrences), pas les tables UK/DE qu'elle nommait. **Le pipeline est fait et vérifié ; l'écran
ne l'est pas** — voir « ce qui reste ouvert ».

## Les deux erreurs de la session, et ce qu'elles ont appris

**`main` a été poussé rouge.** `0c15a04` ne compilait pas : la migration v9 était déclarée et VIDE.
Cause : cinq fichiers du lot portaient aussi le chantier de la session concurrente, et plutôt que de
publier son travail en vol, l'index a été reconstruit fichier par fichier — la découpe du bloc v9
cherchait la fin du tableau au **premier `]`**, qui est celui de `readonly string[]`, l'annotation
de type. **Les quatre commandes étaient vertes parce qu'elles portent sur l'ARBRE, jamais sur
l'INDEX.** Réparé en avant par `287dd13`, la session concurrente ayant déjà commité par-dessus.
→ Écrit dans [../reference/PIEGES.md](../reference/PIEGES.md), section « Ce qu'on commite n'est pas
ce qu'on a testé ».

**Des tests verts qui ne testaient rien.** Les premiers tests de la décision 51 plaçaient le plat
préparé au DÎNER — or `checkCalorieFloor` n'évalue que les journées dont le déjeuner ET le dîner
sont remplis, si bien que la règle d'AVANT écartait déjà la journée : **ils passaient au vert avec
ET sans la garde**. Le drapeau ne mord que sur un créneau hors déjeuner/dîner. Réécrits sur le
goûter, ils rougissent à 4 sans la garde. → La vérification rouge-avant-vert a été systématique
ensuite, sur chaque garde séparément.

## Ce qui reste ouvert, et pourquoi

**Décision 33 n'est pas finie.** `food_nutrient.code_confiance` est **rempli et jamais lu** :
exactement le défaut que ce projet paie en boucle. La raison est réelle et n'était pas prévisible
depuis la décision : `detail-recette.tsx` n'affiche **que l'énergie**, et l'énergie est à 434 D sur
449 *par construction* (calculée depuis les macros, jamais dosée) — une mention constante sur 97 %
du catalogue serait du bruit, pas de la traçabilité. Aucun écran n'affiche de valeur par ALIMENT.
Trois issues, aucune tranchée : annoter l'énergie quand même, créer un écran de détail par aliment,
ou attendre qu'un écran affiche des valeurs par aliment.

**Trois décisions attendent toujours un arbitrage : 33 (l'affichage), 35, 52.** La 52 est la seule
qui presse — elle doit être tranchée *en même temps* que la maquette de l'écran Aujourd'hui.

## Deux points de méthode qui ont payé

**Ne jamais réimplémenter la fonction qu'on mesure.** Un script de mesure recopiait `normaliser` en
omettant `œ → oe` et a rapporté à tort que « oeuf » ne trouvait rien — un faux défaut majeur, à un
cheveu d'entrer dans une décision. Toutes les mesures suivantes ont importé la vraie fonction.

**Remesurer avant de rouvrir une décision.** Les décisions 33 et 51 portaient toutes deux des
chiffres périmés, mesurés sur 192 aliments quand le catalogue en compte 450. Aucun n'était faux par
négligence : le catalogue avait simplement doublé sous eux.
