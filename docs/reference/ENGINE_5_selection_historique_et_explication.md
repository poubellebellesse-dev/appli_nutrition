# Moteur — L3 Sélection — corrections mesurées, explication, usage d'une couche seule

> Partie de la spécification du moteur. Index et ordre de lecture : [`../ENGINE.md`](../ENGINE.md).
> **La numérotation des sections (§4, §6.6 bis…) est celle du document d'origine et n'a pas bougé** —
> toute référence `ENGINE §x.y` faite ailleurs reste valide.

---

### Historique des corrections mesurées (§6.6 bis → quinquies)

Quatre défauts trouvés en remplissant le catalogue, invisibles sur 10 recettes. On les conserve
parce que le RAISONNEMENT ÉCARTÉ vaut souvent l'énoncé retenu : trois pistes intuitives ont été
mesurées perdantes (pondération par rareté, repli par `Food.groupe`, « principal + secondaires »).
Ces sections sont **datées et historiques** — elles ne font pas foi sur l'état du code.

#### 6.6 bis — Correction du signal « ingrédient » (2026-07-27), CODÉE

Le premier signal comparait UN SEUL ingrédient — le non-optionnel le plus lourd
(`recipeMainIngredient`) — par égalité stricte. **Mesuré faux sur le catalogue réel** : le plus
lourd n'est presque jamais celui qui définit le plat. « Mousse au chocolat » = 300 g d'œufs contre
200 g de chocolat, donc « plat d'œufs ». « Hachis de bœuf » = 800 g de pommes de terre contre 500 g
de bœuf. « Lentilles aux carottes » et « poulet rôti aux carottes » = deux ÉGALITÉS de poids
tranchées arbitrairement en faveur de la carotte. Ce signal pesant 0,5, la similarité jugeait
« œufs au plat aux tomates » et « soupe de poisson au fenouil » identiques à **99 %**.

Remplacé par le chevauchement pondéré de deux **signatures** — les 3 ingrédients non optionnels les
plus lourds avec leur part normalisée (`recipeSignature`, `engine/nutrition/signature.ts`).

**Le modèle a été choisi par mesure, pas par raisonnement.** Six candidats comparés sur deux jeux de
paires (des plats sans rapport à séparer, des plats réellement proches à garder proches), au palier
de 100 puis de 200 recettes — banc `app/src/cli/compare-similarite.ts` :

| Modèle | Écart patho/témoins à 100 rec. | à 200 rec. |
|---|---|---|
| le plus lourd (ancien) | **1 pt** | **1 pt** |
| **3 plus lourds — RETENU** | **18 pts** | **18 pts** |
| 3 plus lourds + seuil 5 % de masse | 18 pts | 18 pts |
| pondération par rareté (3 variantes) | 17 pts | 17 pts |

Doubler le catalogue n'a rien changé : la conclusion n'est pas un artefact de petit échantillon. La
pondération par rareté n'apporte rien de mesurable et ferait dépendre la similarité de la
composition du catalogue entier. Le seuil de masse ne change rien non plus et porte un risque
propre (il écarterait l'ail de « pâtes à l'ail et à l'huile »). Le modèle retenu est le plus simple
à égalité de résultat.

Effet sur le catalogue réel : similarité maximale **98,4 % → 82,9 %**, p99 63,0 % → 52,6 %. Et les
six paires les plus proches sont désormais toutes légitimes — deux soupes de carottes, deux plats de
maquereau, deux plats de bœuf-tomate, deux plats de moules, deux plats d'œufs, deux taboulés.

#### 6.6 ter — Pondération des trois signaux (2026-07-27), MESURÉE et CODÉE

**0,8 ingrédients / 0,15 sensoriel / 0,05 cuisine**, au lieu de 0,5 / 0,3 / 0,2.

La répartition d'origine était une intuition de cette spécification, jamais vérifiée. Une fois le
signal « ingrédients » corrigé (§6.6 bis), elle est devenue le facteur limitant : le sensoriel et la
cuisine suffisaient À EUX SEULS à fabriquer **50 % de similarité entre deux plats n'ayant AUCUN
ingrédient commun**. Cas réels mesurés : « bœuf haché sauce tomate » × « ratatouille » (plat
végétalien) à **61 %**, « coq au vin » × « gigot d'agneau » à **50 %** sans un ingrédient partagé.

Sept jeux de poids comparés (`app/src/cli/compare-ponderation.ts`) :

| Pondération | Plats sans rapport | Quasi-doublons | Plancher* | Paires > 60 % |
|---|---|---|---|---|
| 50/30/20 (avant) | 57 % | 79 % | **50 %** | 81 |
| 70/20/10 | 40 % | 79 % | 30 % | 33 |
| **80/15/05 — RETENU** | **32 %** | **78 %** | **20 %** | **30** |
| 100/00/00 | 16 % | 78 % | 0 % | 25 |

\* score maximum atteignable par deux plats **sans aucun ingrédient commun**.

Les quasi-doublons ne perdent rien sur toute la plage (79 → 78 %) : alléger le sensoriel ne dégrade
pas la détection des vraies redondances, il cesse seulement d'en inventer.

**Pourquoi pas 100/0/0**, malgré le meilleur score brut : à poids nul, cinq salades froides et
croquantes sans ingrédient commun seraient à 0 % de similarité, et la diversification les
proposerait toutes les cinq sans y voir de répétition. Le signal sensoriel n'était pas mauvais, il
était surdimensionné.

**Pourquoi la cuisine tombe à 0,05** : `francaise` couvre près de la moitié du catalogue. À 0,2,
deux plats français pris au hasard touchaient 20 points gratuits — du bruit déguisé en signal. Elle
reste non nulle parce qu'elle discrimine encore sur les familles minoritaires.

Effet mesuré sur les 22 366 paires du catalogue : médiane 22,8 % → **9,5 %**, p99 52,4 % → **38,2 %**,
paires au-dessus de 60 % : 81 → **30**. Dans la bande 55-70 %, où MMR arbitre réellement, toutes les
paires ont désormais **au moins 56 % d'ingrédients communs** — contre 17-30 % avant.

#### 6.6 quater — Règle de RÉCENCE de `variety` / `habit` (2026-07-27), MESURÉE et CODÉE

Ces deux couches demandent « ai-je mangé ça récemment ? », et répondaient « oui » quand l'entrée
d'historique partageait l'ingrédient LE PLUS LOURD du candidat — le même index abandonné en §6.6 bis.
Mesuré : sur 290 paires partageant un « ingrédient principal », **194 (67 %)** ont une composition
très différente. Une mousse au chocolat rendait « récentes » des galettes de sarrasin.

**La question n'est PAS celle de la similarité** — deux plats peuvent se ressembler sans que manger
l'un lasse de l'autre. Le seuil a donc été mesuré séparément, sur des paires jugées pour cette
question-ci (banc `app/src/cli/compare-variety.ts`) :

| Règle | Déclenche à tort | Rate à raison | Paires touchées |
|---|---|---|---|
| ingrédient le plus lourd (avant) | **6 / 6** | 1 / 7 | 326 |
| chevauchement ≥ 0,35 | 3 / 6 | 1 / 7 | 204 |
| chevauchement ≥ 0,45 | **0 / 6** | 1 / 7 | 86 |
| chevauchement ≥ 0,55 | 0 / 6 | 2 / 7 | 43 |
| ≥ 0,45 OU même `Food.groupe` | 4 / 6 | 1 / 7 | 735 |
| **sous-famille ≥ 0,45 — RETENU** | **0 / 6** | 1 / 7 | **102** |
| sous-famille ≥ 0,38 | 3 / 6 | **0 / 7** | 191 |

Le repli par groupe alimentaire a été **testé et écarté** : `viandes` mélange bœuf, poulet, porc et
agneau, donc tout plat carné rendait tout autre plat carné répétitif.

##### Le repli par SOUS-FAMILLE (`Food.sousFamille`)

Même mécanisme que le repli par groupe, **d'un cran plus fin** : `poulet_blanc` et `poulet_cuisse`
se replient sur `poulet`, jamais sur « viandes ». Le champ est **facultatif et non taxonomique** —
il n'existe que là où le catalogue contient plusieurs entrées du même produit de base (25 aliments
sur 193 à ce jour, 12 familles). Les autres restent à `null` et gardent leur propre id pour clé.

La comparaison se fait dans **un second index**, `CatalogIndexes.recipeFamilySignature`, et non dans
`recipeSignature` que lit la similarité (§6.6 ter). Les deux questions ne se posent pas au même
endroit : la **diversification** doit encore distinguer un blanc de poulet rôti d'un tajine de
cuisses ; la **récence** — « ai-je mangé du poulet hier » — se moque du morceau. Normaliser dans
l'index commun changerait la similarité, dont la pondération a été mesurée sans.

À **seuil égal** (0,45), la normalisation ne dégrade rien sur le jeu jugé (0/6 et 1/7 dans les deux
cas) et rattrape **16 paires** que la signature brute manquait, toutes légitimes :

| Paire | Brut | Sous-famille |
|---|---|---|
| Lentilles vertes aux carottes × Soupe de lentilles corail | 38 % | **90 %** |
| Gigot d'agneau × Navarin d'agneau | 14 % | **65 %** |
| Poulet au curry × Poulet teriyaki | 0 % | **64 %** |
| Crêpes × Flan aux œufs | 12 % | **58 %** |

dont **huit paires de poulet** — la classe de défaut qui a motivé le champ.

> ⚠️ **Ce seuil seul ratait** « poulet rôti aux carottes » × « poulet au citron et aux olives »
> (**39 %**), le cas précis qui avait motivé la sous-famille. La cause n'est pas l'absence de repli
> — il s'applique — mais le **poids** : le poulet pèse 43 % de la signature d'un côté contre 71 %
> de l'autre. Corrigé autrement en §6.6 quinquies.

#### 6.6 quinquies — Second déclencheur et filtre de créneau (2026-07-27), MESURÉS et CODÉS

Deux ajouts portent la règle de récence à **0 faux et 0 raté** sur les jeux jugés.

**1. Second déclencheur par famille.** Une même sous-famille **déclarée** pesant ≥ 40 % des **deux**
côtés suffit, même si le chevauchement global reste sous 0,45 (`countsAsSameMeal`,
`VARIETY_RECENCY_FAMILY_PART_THRESHOLD`). C'est ce qui rattrape la paire de poulet ci-dessus.

La restriction aux familles **déclarées** n'est pas cosmétique : les clés d'une
`RecipeFamilySignature` mélangent noms de famille et `foodId` bruts, rien ne les distingue à la
lecture. Sans le filtre (`CatalogIndexes.declaredFamilies`), partager `oeuf` à 40 % rapprocherait
une mousse au chocolat d'une omelette — mesuré, 3 faux sur 6.

**2. Filtre de créneau.** Une entrée d'historique dont le `creneau` ne figure pas dans les
`typesRepas` du candidat est ignorée **pour le rapprochement par composition**. « Clafoutis aux
framboises » `[gouter]` et « Gratin de pâtes au jambon » `[dejeuner, diner]` partagent 40 % et 50 %
de lait mais ne peuvent jamais être candidats à la même demande ; sans ce filtre, le goûter d'hier
pénalisait le dîner d'aujourd'hui.

> ⚠️ **Ce n'est PAS « même créneau que la demande ».** Poulet au déjeuner puis poulet au dîner
> **doit** rester répétitif : la recette candidate porte `[dejeuner, diner]`, l'entrée de déjeuner
> passe donc le filtre. Et la correspondance par `recipeId` exact n'est **jamais** filtrée — avoir
> mangé cette recette-là compte quel que soit le moment.

| Règle | Déclenche à tort | Rate à raison | Paires |
|---|---|---|---|
| famille ≥ 0,45 (avant) | 0 / 6 | 1 / 7 | 102 |
| rang 60/25/15 (principal + secondaires) | 1 / 6 | **3 / 7** | 83 |
| rang + départage par rôle | 0 / 6 | **2 / 7** | 93 |
| famille ≥ 0,45 OU toute famille ≥ 40 % | **3 / 6** | 0 / 7 | 510 |
| + créneau, famille ≥ 0,38 | 1 / 6 | 0 / 7 | 168 |
| **+ créneau + famille déclarée ≥ 40 % — RETENU** | **0 / 6** | **0 / 7** | **174** |

Le modèle **« un ingrédient principal + des secondaires »** (poids fixes 0,60 / 0,25 / 0,15 par
rang) a été **testé et écarté** : il détruit de l'information. Poulet à 54 % et poulet à 43 % sont
proches ; les ramener à « 1ᵉʳ » et « 2ᵉ » les éloigne d'un coup. Le départage par rôle corrige un
vrai bug — « Blanc de poulet rôti, carottes fondantes » a carotte 43 % **et** poulet 43 %,
départagés par ordre alphabétique, donc la machine y voyait « un plat de carottes » — mais ne
compense pas la perte.

Le créneau **ne remplace pas** le second déclencheur : seul, à 0,38, il laisse passer 1 faux. Les
deux ensemble tombent à 0. Une fois le créneau appliqué, les paires laitières qui subsistent sont
légitimes (deux flans au goûter, deux porridges au petit-déjeuner), et les absurdes ont disparu.

> `CourseKind` (entrée/plat/dessert) **n'est pas sur `Recipe`** — il reste réservé au mode repas
> composé de v1.5 (`MealPlanEntry.service`). Le créneau suffit pour ce problème ; annoter les 212
> recettes n'a pas été jugé nécessaire.

> `recipeMainIngredient` n'est désormais lu par **aucune couche**. Il reste calculé à l'init et
> employé seulement par les bancs de comparaison, qui documentent pourquoi il a été abandonné.

### 6.7 Explication — CODÉ (P1c, `engine/selection/explain.ts`)

```ts
interface Explanation {
  readonly criterion: ScoreCriterion
  readonly contribution: number         // part du score final, 0 → 1
  readonly label: string                // phrase prête à afficher
  readonly authority?: string           // rempli uniquement pour la couche `topic`
  readonly evidenceSheetId?: EvidenceSheetId
}
```

`explainSuggestion(recipeId, breakdowns)` reçoit l'**ENSEMBLE** des breakdowns de la passe de score
(`ScoringPassResult.breakdowns`, pas seulement le candidat affiché) — c'est la seule façon de savoir
ce qui discrimine réellement entre les candidats ; une fonction qui ne verrait qu'une recette
isolée ne pourrait structurellement pas faire la différence entre « ce plat est vraiment un bon
match » et « cette couche dit la même chose à tout le monde en ce moment ».

> ⚠️ **Règle centrale, qui ÉTEND la spécification « top 3 par contribution » ci-dessous** : une
> couche dont la contribution est **identique sur l'ensemble des candidats scorés** n'est **jamais
> citée**, quelle que soit sa contribution — même si elle est numériquement la plus forte. Sur un
> profil neuf (aucune préférence enregistrée, aucune envie exprimée, historique vide), les couches
> `preference`, `craving` et `variety` rendent le même score neutre (`NEUTRAL_SCORE`) à tout le
> monde : elles ne discriminent rien, et les citer reviendrait à annoncer « proche de vos goûts » à
> quelqu'un dont l'application ne sait rien — faux, et contraire au principe 6 (§1 ARCHITECTURE,
> « informer, jamais juger »). La comparaison se fait à `CONTRIBUTION_EPSILON` (1e-9) près, pour
> ignorer le bruit d'arrondi flottant sans jamais masquer un écart réel.
>
> Conséquence : moins de trois couches discriminantes → moins de trois phrases, **jamais de
> remplissage** ; aucune couche discriminante → liste **vide**, plutôt qu'une explication
> mensongère.

Gabarits de phrase, un par couche de score **implémentée** (ton neutre et descriptif, §6.2
ARCHITECTURE — l'application décrit, elle ne juge ni ne félicite) :

| Couche | Phrase |
|---|---|
| `nutri` | « apports équilibrés pour ce repas » |
| `preference` | « proche de vos goûts » |
| `craving` | « correspond à l'envie exprimée » |
| `season` | « ingrédients de saison » |
| `variety` | « change de vos derniers repas » |
| `habit` | « dans vos habitudes » |
| `speed` | « rapide à préparer » |

Les 3 plus fortes contributions **parmi les couches discriminantes** sont converties en phrases via
ces gabarits :

> « Proposé car : riche en fer · plat rapide comme demandé · légumes de saison »

Quand une thématique est active, l'explication **cite obligatoirement l'autorité** :

> « Correspond au critère *limiter les sucres rapides* — recommandations ANSES, diabète de type 2 »

`authority` et `evidenceSheetId` restent **réservés à la couche `topic`** (non implémentée, poids
nul par défaut — §6.5) : `explain.ts` ne les renseigne jamais pour une autre couche, ce serait
fabriquer une source qui n'existe pas. `authority` et `evidenceSheetId` sont **non-nullables dès que
`criterion === 'topic'`** — règle de conception **non vérifiée à ce jour** : `assertNoTherapeuticClaim`
(§5.2) n'inspecte que `label`, comme le dit sa note ci-dessus. La vérification est à écrire **en même
temps que la couche `topic`**, seule couche capable de produire ce cas.

### 6.8 Utiliser une couche seule

Chaque couche étant autonome, elle s'expose individuellement dans l'API. C'est ce qui permet de
construire des écrans entiers **sans invoquer le moteur de suggestion**.

```ts
engine.layer('allergenes').apply(catalog.allRecipes, { allergies: ['arachide'] })
// → navigateur « recettes sûres pour moi », sans aucun scoring

engine.layer('pantry').apply(candidats, { pantry: [...] })
// → écran « avec ce que j'ai », taux de couverture et ingrédients manquants

engine.layer('occasion').apply(candidats, { date, occasionsActives })
// → carrousel « idées pour le Nouvel An chinois »
```

Trois bénéfices directs :

| Bénéfice | Détail |
|---|---|
| **Écrans autonomes** | Un navigateur de recettes filtré n'a pas besoin du pipeline complet |
| **Tests isolés** | Chaque couche a ses propres tests de propriété, sans monter le moteur |
| **Cheminement affichable** | L'UI peut montrer l'entonnoir — voir ci-dessous |

Le cheminement visible est un différenciateur : aucun concurrent ne le fait, parce qu'aucun n'a de
moteur explicable.

```
1 240 recettes
  → allergènes   − 89
  → régime       − 31
  → temps        − 22
  → équipement   −  6
  = 1 092 candidats, classés par 6 couches de score
```

---
