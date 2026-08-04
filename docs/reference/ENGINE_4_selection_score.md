# Moteur — L3 Sélection — couches de score, décisions de conception, diversification

> Partie de la spécification du moteur. Index et ordre de lecture : [`../ENGINE.md`](../ENGINE.md).
> **La numérotation des sections (§4, §6.6 bis…) est celle du document d'origine et n'a pas bougé** —
> toute référence `ENGINE §x.y` faite ailleurs reste valide.

---

### 6.5 Les couches de score en détail

> **Statut : conception figée cette session (2026-07-24), implémentation P1b-1/P1b-2, pas encore
> codée.** Ce qui suit précise et complète les couches déjà décrites en §6.3 ; `speed` est un
> signal nouveau, `topic`/`cost` restent en réserve à poids nul (v2/v3). Récit complet :
> `docs/archive/RECAP_SESSION.md`.

| Couche | Calcul | Poids |
|---|---|---|
| `nutri` | 1 − distance normalisée entre l'apport de la recette et **la cible** (jamais la consommation, voir précision 1) | 0.25 |
| `preference` | Moyenne des préférences sur ingrédients et facettes, **pondérée par la quantité** et saturée (précision 4) | 0.25 |
| `craving` | 1 − distance euclidienne sur les **axes sensoriels demandés uniquement** ; poids **contextuel** (précision 2) | 0.20 |
| `variety` | Décroissance exponentielle selon l'ancienneté de la dernière occurrence, **adaptative** (précision 5) | 0.15 |
| `season` | Moyenne **pondérée par quantité** des crédits de saison des ingrédients (1 en saison · 0,5 dispo toute l'année hors saison · 0 sinon) — précision 3 | 0.10 |
| `pantry` | Taux de couverture des ingrédients par `user_pantry` | 0.05 † |
| `habit` | Quatre signaux statistiques locaux (§7.5), module aussi `variety` (précision 5) | 0.00 ‡ |
| `occasion` | Appartenance à une occasion active dans la fenêtre de dates | 0.05 § |
| `speed` | 1 − durée normalisée dans la fenêtre de temps demandée — plus court fait un peu mieux | **0.00** ¶ |
| `topic` | Écart aux critères des thématiques actives | **0.00** |
| `cost` | 1 − dépassement du budget par portion (v3) | 0.05 |

† `pantry` passe en **poids dominant** en mode « vider le frigo » (§10.2)
‡ `habit` croît avec le volume d'historique — démarrage à froid propre
§ `occasion` vaut 0 hors de la fenêtre d'une occasion activée
¶ **Tranché et CODÉ (session du 2026-07-25) : `speed` EST une couche du registre à part entière**
(la 11ᵉ et dernière couche de SCORE implémentée — `LAYER_DESCRIPTORS`,
`app/src/engine/selection/index.ts` ; l'ordinal absolu n'est plus cité, il a changé à chaque
ajout de couche d'exclusion — le registre est à 18 entrées depuis `favoris`, P1c lot 4 ;
implémentation `app/src/engine/selection/scoring/speed.ts`), distincte du filtre dur `temps` (§6.3,
exclusion) ; poids nul par défaut, **activée par l'archétype « Rapide »** (§6.3 bis, poids brut
0.30). La précédente affirmation « `speed` n'est pas une 17ᵉ couche du registre » est **fausse** et
retirée par cette mise à jour.

#### Huit précisions de calcul (session du 2026-07-24)

1. **`nutri` compare au profil-cible, jamais à la consommation, et pénalise selon le SENS du
   nutriment (CODÉ, P1b-2).** Il n'y a pas de journal alimentaire (§6.5 ARCHI) : la cible est soit
   l'accumulateur du plan en cours dans `planWeek` (l'état nutritionnel cumulé de §7.1, non câblé
   à ce stade), soit — pour une suggestion isolée hors plan, cas CODÉ — la référence journalière
   (`resolveReferenceIntakes`, §5.1) multipliée par la **part du créneau**, une table FIXE codée
   (`MEAL_SLOT_SHARE`, `engine/selection/scoring/nutri.ts` — décision nouvelle, absente de la
   conception initiale, qui remplace l'idée d'un partage égal entre créneaux) :
   `petit_dejeuner` 0,25 · `dejeuner` 0,35 · `diner` 0,30 · `gouter` 0,10 (Σ = 1). L'écart lui-même
   n'est plus symétrique comme dans une première version : la colonne `nutrient.sens`
   (`NutrientSense` ∈ {`cible`, `plancher`, `plafond`}, union fermée — §4.2 ARCHITECTURE) dit à
   `scoreNutri` quel côté de l'écart pénalise réellement — `cible` pénalise les deux sens (énergie,
   macronutriments), `plancher` ne pénalise que le manque (fibres, fer, calcium, vitamine C — un
   excès n'est jamais pire), `plafond` ne pénalise que le dépassement (sodium — être en dessous
   n'est jamais pire). Un écart symétrique sur un plancher/plafond punirait un plat riche en fer
   pour sa richesse, ce qui est absurde — c'est le défaut que `sens` corrige. `nutri` reste un
   **signal d'équilibre du plan**, jamais un compteur de ce qui a été mangé.

2. **`craving` est CONTEXTUEL, pas seulement pondéré.** Il passe n°1 **uniquement dans le contexte
   « Aujourd'hui »** — une suggestion ponctuelle avec une envie posée (pastilles) — et **reste à
   son socle bas dans `planWeek`** : il n'y a pas de « moment T » sensoriel à anticiper pour un jour
   futur. D'où la symétrie à documenter partout où elle s'applique :
   **Aujourd'hui = piloté par l'envie (`craving`) · Semaine = piloté par l'équilibre (`nutri`).**
   Par ailleurs la distance ne porte que sur les **axes effectivement demandés** dans la requête
   (pas les 3 axes systématiquement) ; la **texture** est **catégorielle** (match / pas-match), pas
   un axe numérique — elle est traitée hors du calcul euclidien, puis recombinée.

3. **`season` combine deux dimensions indépendantes en crédits, pondérés par la quantité.**
   `toute_annee` (disponibilité : rayon, conservation) et `saison_mois` (pleine saison : production
   locale) ne sont PAS exclusifs — un légume de garde porte les deux (carotte : dispo toute l'année
   ET de pleine saison sept.–avril). Chaque ingrédient dont `saison_mois` est renseignée rapporte un
   **crédit** : **1** en pleine saison ce mois-ci, **0,5** hors saison mais `toute_annee`, **0** hors
   saison sans disponibilité. Les ingrédients sans `saison_mois` (sel, huile, pâtes…) sont **exclus
   du calcul**. Le score est la **moyenne des crédits pondérée par la quantité** (même motif que
   `preference`, précision 4) — 5 g de persil ne pèsent pas autant que 400 g de courgettes. Aucun
   ingrédient à saison renseignée → `season` **neutre** (0,5), pas un score nul punitif. Le
   demi-crédit distingue « disponible mais pas à son meilleur » de « hors saison pour de bon ».

4. **`preference` est pondérée par la quantité.** L'**ingrédient principal** d'une recette est
   défini comme **le non-optionnel de plus forte quantité** (`recipe_ingredient.optionnel = false`,
   `quantite_g` maximal ; égalité → tie-break déterministe par `food_id`). Un aliment détesté en
   garniture baisse peu le score, en principal il baisse beaucoup — sans cas particulier codé,
   c'est une conséquence directe de la pondération. L'agrégat est **saturé (clamp)** : un seul
   ingrédient à +2 ne suffit pas à sauver un plat par ailleurs mal noté.

5. **`variety` est ADAPTATIVE, pas une règle fixe.** Un socle léger de décroissance (tel que déjà
   décrit) est **modulé par la couche `habit`** — la tendance apprise familiarité↔nouveauté du
   profil (§7.5) — au point de **s'inverser en bonus de familiarité** pour un profil « habitudes »
   marqué. Un **override explicite par requête** (« Surprends-moi » / « Mes classiques ») prime sur
   la modulation automatique. Dans tous les cas, la récence porte sur **la recette ET son
   ingrédient principal** (précision 4), pas seulement l'identifiant de recette. Rappel §6.5 ARCHI :
   `habit` reste une **affinité apprise**, jamais un constat de consommation.

6. **`speed` est un nouveau signal doux**, voir table ci-dessus et note ¶.

7. **Déterminisme du classement.** Tri par score décroissant, **tie-break stable par id de
   recette** en cas d'égalité stricte. Tout aléa (diversification, sélection parmi égalités) passe
   par le PRNG à graine (date + créneau, §1) — jamais `Math.random`.

8. **Les index dérivés sont calculés à l'init du moteur, pas au build.** `recipeNutrients` et
   `recipeMainIngredient` (§9.1) sont des fonctions **pures de `engine/nutrition/`** exécutées une
   fois à `createEngine(catalog)`, pas par `catalog/build.mjs` — pour ne pas coupler le script de
   build au moteur. Aujourd'hui ces deux index sont des `Map` **vides**, laissées telles quelles
   par `catalog-loader.ts` (voir son en-tête) ; les peupler est un livrable de **P1b-1**. Voir la
   note dans §9.2 qui corrige la description antérieure de cette responsabilité.

#### Poids dynamiques — `craving` et `occasion` prennent la tête quand c'est pertinent

Deux couches ont un **poids contextuel**, pas fixe :
- **`craving` passe n°1 — CODÉ (P1b-2, `runScoringPass`, `engine/selection/scoring-pass.ts`)**
  (poids brut `CRAVING_DYNAMIC_WEIGHT = 0.50`, ≈ 0.40 après renormalisation avec les couches de
  référence actives — la valeur *exacte* dépend des couches réellement actives, seul le fait que
  `craving` devienne le poids le plus élevé est garanti et testé) **dès qu'une envie est
  RÉELLEMENT exprimée dans le contexte « Aujourd'hui »** — l'objet `envie` non nul ET au moins un
  de ses trois axes non nul (pastilles Léger/Chaud/Salé…), pas un objet d'envie vide — et retombe
  à son socle bas sinon — y compris pour tous les créneaux de `planWeek`, qui n'a pas de « moment
  T » (précision 2 ci-dessus). La garantie « contexte Aujourd'hui seulement » est obtenue
  STRUCTURELLEMENT : `planWeek` (non câblé, P1c) ne remplira pas `envie` pour un jour futur, sans
  qu'aucun drapeau explicite de contexte n'existe ni ne soit nécessaire — même principe que
  `MealContext.requiredFoodIds` (§6.5 ter). Sans envie, la distance à l'axe est neutre : un poids
  élevé permanent n'aurait aucun effet.
- **`occasion` doit aussi passer n°2** pendant une occasion **activée et dans la fenêtre**, 0 hors
  période — mais **la couche `occasion` n'est PAS implémentée** (absente de `SCORING_LAYERS`,
  `scoring-pass.ts` ; reste une entrée de réserve dans `LAYER_DESCRIPTORS`, P2) : aucune bascule
  n'est câblée pour elle à ce stade.

Conséquence assumée : quand l'utilisateur formule une envie **dans « Aujourd'hui »**, le moment
prime sur l'équilibre nutritionnel — `nutri` reste un score, jamais un garde-fou (le plancher
calorique est une post-condition séparée, §guards). En `planWeek`, `nutri`/`preference` mènent
tout le temps. Une carte occasion « idée pour… » peut être remontée à l'ouverture (throttlée
~1×/3-4 j, occasions activées seulement, écartable — §8.6 ARCHITECTURE).

**`topic` vaut 0 tant qu'aucune thématique n'est activée.** Le volet santé n'existe pas dans le
calcul par défaut — c'est ce qui rend l'invariant §6.1 d'ARCHITECTURE vérifiable, et non seulement
déclaratif.

#### La couche `equipment` — une nuance qui compte

L'équipement se déclare en deux niveaux dans le catalogue :

| Niveau | Effet | Exemple |
|---|---|---|
| `requis` | **Exclusion** — infaisable sans | Sorbetière pour une glace |
| `accelere` | **Score** — faisable à la main, plus long | Robot pour une pâte |
| `informatif` | **Aucun effet moteur** — ustensile du lexique matériel, jamais chargé en RAM | Fouet, fourchette, spatule |

Sans cette distinction, ne pas posséder de mixeur supprimerait la moitié du catalogue.

### 6.5 ter — Décisions de conception (session 2, 2026-07-24 — partiellement codées)

Tranchées ; une partie est désormais implémentée (détail par point ci-dessous). Récit :
`docs/archive/RECAP_SESSION_2.md`.

- **`variety` — trois réglages séparés.**
  (1) *Vitesse d'oubli* : TAU réglable à trois crans 3 / 7 / 14 jours (défaut 7) — **CODÉ**
  (`ScoreVarietyArgs.tauDays`, type `VarietyTau`, `engine/selection/scoring/variety.ts`). Valeurs
  vérifiées par test : un plat vu il y a 7 jours vaut en nouveauté **0,903** (TAU=3) · **0,632**
  (TAU=7) · **0,393** (TAU=14).
  (2) *Rythme du changement* : bascule explicite (« Surprends-moi » / « Mes classiques »)
  **brusque** (dès le repas suivant) — **déjà assurée par l'override existant** (`VarietyOverride`,
  force `familiarity` à 0 ou 1) ; dérive apprise **graduelle** (~4 repas) reste **repoussée** avec
  la refonte de `habit`, mode par défaut stable.
  (3) *Restes* : chaque entrée d'historique porte une **origine** `choisi` / `reste` — **CODÉ**
  (`MealHistoryEntry.origine`, champ obligatoire) ; `variety` lit tout (un reste mangé lasse),
  `habit` ne compte que les `choisi` (un reste n'est pas une préférence) — asymétrie volontaire.
- **Rejet absolu codé, miroir désormais codé aussi.** La couche `exclusions` lit `excludedFoodIds`
  (exclusion dure, un aliment exclu en ingrédient optionnel n'exclut pas la recette). Son miroir
  **`requiredFoodIds`** (« je veux ça ») est **CODÉ** — couche `requis`
  (`app/src/engine/selection/requis.ts`), sémantique CONJONCTIVE (tous les aliments demandés
  doivent être présents ; un ingrédient optionnel SATISFAIT l'exigence) : filtre **dur en contexte
  « Aujourd'hui » seulement**. Le champ vit dans `MealContext`, pas dans `HardConstraints` : comme
  `WeekPlanRequest` n'a pas de `MealContext`, l'exigence devient **structurellement inexprimable**
  pour un plan de semaine, plutôt que de compter sur la discipline de l'appelant — asymétrie
  volontaire avec `excludedFoodIds` (réglage durable → `HardConstraints`).
- **Roue des goûts (radar).** Lecture visuelle des 3 axes sensoriels dépliés en 6 pôles
  (Salé↔Sucré · Léger↔Consistant · Chaud↔Froid), par plat et — moyennée — par profil ; même affinité
  que `habit` apprend, pas un second calcul. Rayons cuisine/saveur = v2. Partage via carte Canvas
  (§8.7 ARCHITECTURE).
- **Conseils vin & modes recette/repas** — chantier de conception B, en file. Conseil vin =
  métadonnée éditoriale (jamais dans le score, jamais nutritionnelle, masquable). Mode *recette*
  (plat unique) vs *repas* (entrée+plat+dessert avec accords).

### 6.6 Diversification — CODÉ (P1c, `engine/selection/{similarity,diversify}.ts`)

Prendre les 5 meilleurs scores retourne souvent 5 variations du même plat. Correction par
**pertinence marginale maximale (MMR)**, boucle gloutonne :

```
retenues = []
tant que |retenues| < limite :
    meilleure = argmax( score(r) − λ · simMax(r, retenues) )
    retenues += meilleure
```

`simMax(r, retenues)` est le **MAXIMUM** de similarité entre `r` et les recettes déjà retenues —
**jamais une moyenne** : une moyenne diluerait un doublon flagrant dès que suffisamment d'autres
retenues « diluent » la proximité, alors que c'est justement ce doublon-là que la diversification
doit repousser. Sur un ensemble retenu vide (premier tour), `simMax = 0` par convention : le
meilleur score gagne naturellement, sans cas particulier codé — et `λ = 0` fait dégénérer la boucle
en un simple classement par score, non-régression vérifiée par test.

#### La fonction `similarity` — ÉTAT COURANT (mesuré)

> Tout ce qui suit est le résultat de MESURES sur le catalogue réel, pas de la conception initiale.
> Les sous-sections « bis » à « quinquies » plus bas racontent **comment on y est arrivé** et ce qui
> a été écarté en route ; elles ne spécifient rien. En cas de doute, **c'est ce bloc-ci qui décrit
> le code**.

`similarity(a, b) ∈ [0, 1]` (`engine/selection/similarity.ts`) combine trois signaux pondérés en
constantes nommées (Σ = 1) :

| Signal | Constante | Poids | Nature |
|---|---|---|---|
| Composition (chevauchement de signatures) | `SIMILARITY_WEIGHT_INGREDIENTS` | 0.80 | continu ∈ [0, 1] (Jaccard pondéré) |
| Profil sensoriel proche | `SIMILARITY_WEIGHT_SENSORY` | 0.15 | distance euclidienne (3 axes numériques) + `texture` |
| Famille de cuisine identique | `SIMILARITY_WEIGHT_CUISINE` | 0.05 | catégoriel (match / pas-match) |

> Ces trois poids **et** la nature continue du premier signal viennent de §6.6 bis et §6.6 ter, qui
> les ont mesurés. Le tableau ci-dessus est l'état **courant** du code, pas l'état d'origine.

La **texture** reste, comme dans `craving` (§6.5 précision 2), un axe **catégoriel** — match ou
pas-match — jamais une distance numérique : elle est recombinée avec la distance euclidienne des
trois axes numériques, pas fondue dedans.

> ⚠️ **Piège documenté — absence ≠ égalité.** Deux recettes dont la composition est **inconnue** des
> deux côtés (signature vide) ne sont **pas** réputées similaires sur ce signal : la composante vaut
> 0, pas 1. Une composition inconnue ne veut rien dire de comparable ; la traiter comme un match
> gonflerait artificiellement la similarité de recettes dont on ne sait justement rien. Même règle
> pour la facette `cuisine` : deux recettes sans cuisine renseignée ne sont pas « de la même
> famille ».

`DEFAULT_MMR_LAMBDA = 0.4` (`engine/selection/diversify.ts`) — valeur de référence issue d'une
intuition de conception, **pas d'une mesure**, **toujours à calibrer**.

> **Le blocage est levé** (2026-07-27). Cette calibration était hors de portée tant que le catalogue
> de test comptait 10 recettes composées à la main. Il en compte **212**, et le modèle de similarité
> a été corrigé (§6.6 bis) puis repondéré par mesure (§6.6 ter). Distribution mesurée sur
> 22 366 paires : max 94,2 % · p99 38,2 % · médiane 9,5 %, avec 30 paires au-dessus de 60 % contre
> 81 avant correction. La base est saine ; λ reste au défaut faute d'avoir été mesuré, pas faute de
> pouvoir l'être.

---
