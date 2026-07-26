# Récap de session 3 — de P1b-1 non committé à un moteur qui suggère en une ligne

> Récit narratif de la troisième session. Les décisions sont **répercutées** dans les docs de
> référence (`ENGINE.md`, `ARCHITECTURE.md`, `ETAT.md`, `CONCEPTION_B_VIN_REPAS.md`) — **ce sont eux
> qui font foi**. Ce fichier raconte comment on y est arrivé. Point de reprise condensé :
> `FICHE_REPRISE.md`.

**Statut** : session close. **Dates** : 2026-07-25 → 2026-07-26. **19 commits.**

---

## 1. Point de départ

La session 2 s'était arrêtée sur un gros paquet de travail **codé mais pas committé** : P1b-1, la
saison en crédits, le catalogue à 76 aliments, la 5ᵉ couche d'exclusion. Rien au-delà de P1a
n'était dans l'historique. Premier travail de la session : figer ça proprement.

Méthode reconduite, inchangée depuis la session 2 : **le code s'écrit via des agents Sonnet en
effort high ; Claude planifie, découpe en lots à fichiers disjoints, et vérifie** (tests, typecheck,
build, relecture des diffs, recalcul à la main des valeurs sensibles).

---

## 2. Vider la dette de commits

Quatre lots thématiques plutôt que chronologiques : l'arbre de travail était un état final plat, et
reconstituer la chronologie (« 60 aliments » puis « 76 ») aurait demandé de découper `foods.yaml` et
`season.ts` en hunks — fragile pour un bénéfice nul.

Un détail qui a coûté un amendement : les apostrophes doublées d'un here-string PowerShell se sont
retrouvées littéralement dans un message de commit (`aujourd''hui`). Depuis, tous les messages
passent par un fichier plutôt que par la ligne de commande.

---

## 3. Chantier B — conseils vin et modes recette/repas

Seul chantier de conception non documenté à l'entrée de session. Document produit :
`CONCEPTION_B_VIN_REPAS.md`, **8 décisions tranchées**.

Deux choses en sont sorties qui dépassent le sujet du vin :

- **Le conseil vin ne touche jamais le moteur** — table `recipe_pairing` non chargée en RAM, donc
  illisible par les couches *par construction*, comme l'équipement `informatif`. Et tout accord
  alcoolisé impose son miroir sans alcool, vérifié au build : même mécanique que
  `evidence_sheet_id NOT NULL`, rendre l'oubli structurellement impossible plutôt que compter sur la
  relecture. La position retenue est volontairement en retrait de ce que la loi Évin autorise
  (familles génériques, aucune marque, message sanitaire injecté par l'UI, affichage masqué par
  défaut).
- **Une incohérence trouvée en écrivant** : `ETAT.md` affirmait « alcool jamais compté dans le
  calcul nutritionnel » alors que `aggregateRecipe` somme tous les ingrédients, vin de cuisine
  compris. Tranché (option A) : la règle vise la **boisson servie**, pas l'ingrédient. On a corrigé
  la doc, pas le code.

Le mode repas (entrée + plat + dessert) est conçu mais non codé : `composeMeal` en L4, **le registre
n'y gagne aucune couche** — composer n'est pas noter un candidat.

---

## 4. Rang 0 — la seule chose qui avait une fenêtre de tir

La conception B a révélé un point urgent : `MealPlanEntry` avait besoin d'une colonne `service`, et
`MealHistoryEntry` de son origine `choisi`/`reste` (décidée en session 2, jamais codée). Les deux
relèvent de la **même migration `user.db`** — gratuite tant qu'aucun planning ni historique n'existe,
versionnée sur données réelles ensuite.

C'est le seul lot de la session dont le coût augmentait avec l'attente. Fait en premier.

Il a livré au passage l'**asymétrie `habit`/`variety`** : `habit` ne compte que les entrées
`choisi` (un reste n'est pas une préférence exprimée), `variety` lit tout (un reste mangé lasse). Le
piège était au dénominateur — ne filtrer que le numérateur aurait fait baisser mécaniquement toutes
les affinités dès qu'on mange des restes. Un test le verrouille avec la valeur attendue (0,5) et la
valeur qu'aurait produite l'erreur (0,333).

---

## 5. `variety` et `requis`

**TAU réglable** à trois crans (3/7/14 jours, défaut 7) — le chantier annoncé comme « réécriture de
`variety` » s'est révélé bien plus petit que son intitulé : sur les trois réglages de §6.5 ter, un
était déjà livré (l'origine) et un autre explicitement repoussé (la dérive graduelle, avec la refonte
de `habit`). Restait la vitesse d'oubli.

**Couche `requis`** — miroir dur de `exclusions`. La décision de forme est plus intéressante que la
couche : `requiredFoodIds` vit dans `MealContext`, **pas** dans `HardConstraints` où se trouve
pourtant son miroir `excludedFoodIds`. Comme `WeekPlanRequest` n'a pas de `MealContext`, l'exigence
devient *structurellement inexprimable* pour un plan de semaine — c'est ainsi qu'on obtient « dur en
contexte Aujourd'hui seulement » par la forme plutôt que par la discipline de l'appelant. Même
esprit que `critical: true`.

Registre : 15 → 16 couches.

---

## 6. P1b-2 — la passe de score, en quatre lots

C'est la tranche la plus longue de la session, et celle qui a produit le plus de découvertes.

| Lot | Livré | Ce qu'il a révélé |
|---|---|---|
| **1** | 5 fonctions de score enveloppées en `SelectionLayer` | `SuggestionRequest` ne portait **aucune préférence utilisateur** — une couche à poids 0,25 sans source de données, depuis P0 |
| **2a** | `nutrient.sens` (`cible`/`plancher`/`plafond`) | `scoreNutri` était **symétrique** : un plat riche en fer était pénalisé *pour sa richesse*. Le moteur préférait structurellement la médiocrité nutritionnelle |
| **2b** | Mifflin-St Jeor, apports de référence, couche `nutri` | Il fallait figer les vocabulaires d'âge et d'activité, et décider quoi faire du sexe « non précisé » (moyenne des deux constantes) et du gabarit corporel absent (ne rien deviner, retourner `null`) |
| **3** | `runScoringPass`, tie-break, `createEngine` réel | `PipelineTrace` ne typait ses compteurs que par `ExclusionLayerId` : le garde-fou censé attraper une couche de score qui exclut était **structurellement incapable d'observer la violation** |
| **4a** | `speed` en couche, 6 archétypes, bascule d'envie | — |
| **4b** | Banc CLI `engine:try` | voir §7 |

Trois de ces quatre découvertes ont été trouvées **en lisant le code avant de l'étendre**, pas par un
test qui échoue. Aucune n'aurait fait rougir la suite de tests : le scoring symétrique était
parfaitement testé, il testait juste la mauvaise chose.

Deux valeurs ont été recalculées à la main plutôt que crues sur parole : les quatre cas de
Mifflin-St Jeor (2478,06 · 1620,3 · 1924,31 · 3122,25 kcal) et les six tables de poids normalisés
des archétypes. Une constante de sexe inversée serait passée sans bruit si l'agent avait réimplémenté
la formule pour se vérifier lui-même.

Le registre est passé à **17 couches** en tranchant le rattachement de `speed` : couche à part
entière, poids nul par défaut, relevée par l'archétype « Rapide ».

---

## 7. Le banc d'essai, et ce qu'il a montré

`engine:try` est le livrable de §11.3 et l'outil du point de non-retour de §12. Il montre
l'entonnoir d'exclusion, les poids appliqués, le classement et les contributions par couche.

**Son constat le plus important n'est pas rassurant.** Sur un profil neuf, `preference`, `craving` et
`variety` rendent NEUTRAL_SCORE à *tous* les candidats — leurs contributions sont identiques d'une
recette à l'autre. Le classement est en réalité décidé par **`nutri` et `season` seules**, deux
couches en portant cinq en apparence. Aucune couche n'est en faute : chacune applique sa convention
« rien à comparer → neutre ». Mais c'est l'état exact d'un utilisateur au premier lancement.

Cette observation est devenue une **contrainte de conception** au lot suivant.

---

## 8. P1c — diversification, explication, `suggestMeals`

**Diversification (MMR)** — pénalité fondée sur le **maximum** de similarité avec les recettes déjà
retenues, pas la moyenne (une moyenne diluerait un doublon flagrant). Piège évité et testé : deux
recettes dont l'ingrédient principal est inconnu ne sont pas réputées similaires — sans ça, toutes
les recettes non identifiables formeraient un faux groupe de doublons. λ = 0,4 par défaut, **non
calibré**.

Mesure faite en fin de session, sur les 45 paires du catalogue réel : la similarité maximale est de
**48,7 %** (`boeuf_hache_sauce_tomate` × `saumon_poele_courgettes`), et MMR fait réellement bouger
le classement — `bœuf haché sauce tomate` passe du **rang 5 au rang 8**, tout le reste remontant
d'un cran. Deux chiffres faux avaient circulé avant ce recalcul (33 % puis 91,3 %), tous deux issus
de rapports d'agent repris sans vérification. La leçon vaut d'être consignée : **un chiffre produit
par un agent se recalcule, même quand il vient corriger un autre chiffre d'agent.**

**Explication** — c'est ici que le constat du banc devient une règle : *une couche dont la
contribution est identique sur tous les candidats n'est jamais citée*, quelle que soit sa
contribution. Sinon l'appli annonce « proche de vos goûts » à quelqu'un dont elle ne sait rien —
faux, et le principe 6 tient mal avec un motif inventé. Conséquence de forme : la fonction reçoit
l'ensemble des candidats scorés, pas une recette isolée.

Le garde-fou du lexique banni a été implémenté au passage, avec son problème de source unique traité
plutôt que contourné : la liste est dupliquée côté moteur (qui ne peut pas importer `build.mjs` sans
violer la règle de dépendance), **mais un test échoue si les deux copies divergent**.

**`suggestMeals`** a soldé deux dettes en même temps : le banc ne re-dérive plus les index et passe
par l'API, et le seul mock du dépôt (`vi.spyOn`) a disparu au profit d'un test de comportement,
l'effet de `attachDerivedIndexes` étant devenu observable.

---

## 9. Les docs, deux fois

Deux passages de cohérence, chacun déclenché par le même raisonnement : **ne pas coder la tranche
suivante contre une spec qui ment**. Ils ont corrigé, entre autres, le compte de couches (12 → 14 →
15 → 16 → 17, chaque correction prolongeant la note d'historique au lieu de la réécrire), la ligne
alcool, l'état d'avancement, et une contradiction de fond entre `ARCHITECTURE.md` §5.4 (regroupement
par ingrédient principal) et `ENGINE.md` §6.6 (MMR pondéré) — deux algorithmes différents dans deux
documents censés faire foi.

Les récits de session n'ont jamais été réécrits : ils décrivent un état vrai à leur date.

---

## 10. État de fin de session

`npm test` → **366 verts (33 fichiers)** · `npm run typecheck` propre · `npm run build` → 76
aliments, 10 recettes.

Le moteur **suggère en une ligne** : `engine.suggestMeals(req)` rend des suggestions classées,
diversifiées, expliquées, avec l'entonnoir des rejets et des diagnostics rejouables. Quatre
garde-fous sur cinq sont codés ; le cinquième (`assertCalorieFloor`) attend le planning.

Reste à faire pour clore P1c : les flags `onlyFavorites` / `varietyMode` et `suggestAlternatives`.

**Ce que le banc ne peut pas encore dire.** Le moteur classe 10 recettes de test dont les valeurs
nutritionnelles sont des ordres de grandeur inventés (`PROV-`), sur 9 nutriments là où la spec en
prévoit une quarantaine. Tout jugement sur la crédibilité des suggestions — et tout calibrage de λ,
des poids ou des archétypes — reste suspendu à l'arrivée d'un vrai catalogue. C'est le chemin
critique du projet, et ce n'est pas un chantier de code.
