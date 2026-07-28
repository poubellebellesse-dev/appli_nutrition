# ⭐ Fiche de reprise — appli_nutrition

> **À lire en premier.** Où on en est, quoi faire ensuite, ce qu'il ne faut pas défaire.
> Index de toute la documentation : [README.md](./README.md). État complet : [ETAT.md](./ETAT.md).
> Spécification (fait foi) : [ENGINE.md](./ENGINE.md), [ARCHITECTURE.md](./ARCHITECTURE.md).
> Dernière mise à jour : **2026-07-28** (session 4 — chantier CONTENU terminé, puis quatre
> corrections mesurées du moteur. Récit de la session précédente : `RECAP_SESSION_3.md`).

---

## En une ligne

Planificateur de repas **100 % local, sans IA, sans compte**. Moteur en TypeScript pur, catalogue
SQLite construit au build. On code le moteur en ligne de commande **avant toute UI** (P3).

## Où on en est

**Le moteur suggère en une ligne, sur un catalogue réel.** `engine.suggestMeals(req)` rend des
suggestions classées, diversifiées, expliquées, avec l'entonnoir des rejets et des diagnostics
rejouables.

```
P0 ✅ ── P1a ✅ ── P1b-1 ✅ ── P1b-2 ✅ ── P1c ✅ ── CONTENU ✅ ── suggestAlternatives ⬜ ── planning ⬜ ── UI ⬜
```

| Acquis | Détail |
|---|---|
| **Catalogue réel** | **193 aliments** aux valeurs CIQUAL 2025 de l'ANSES · **212 recettes** — cible de la décision 4 atteinte |
| **Registre à 18 couches** | 7 exclusion (`allergenes` 🔒 · `regime` 🔒 · `exclusions` · `requis` · `temps` · `equipement` · `favoris`) + 11 score, dont 7 implémentées |
| **Flags de requête** | `onlyFavorites` (+ `favoriteRecipeIds`, obligatoire) · `varietyMode` (`auto`/`surprise`/`classiques`) · `mmrLambda` · `skipDiversification` |
| **Passe de score** | Poids normalisés Σ=1, archétypes, bascule d'envie, tie-break stable par id de recette |
| **6 archétypes** | `equilibre` · `envie` · `decouverte` · `de_saison` · `mes_gouts` · `rapide` |
| **Diversification** | MMR, λ = 0,4 **non calibré** (voir dette) |
| **Garde-fous** | 4 sur 5 codés — reste `assertCalorieFloor`, qui attend le planning |
| **Bancs de mesure** | `engine:try` · `engine:similarity` · `compare-similarite` · `compare-ponderation` · `audit-similarite` · `compare-variety` |

**État vérifié : `npm test` → 437 verts (36 fichiers) · `npm run typecheck` propre ·
`npm run build` → 193 aliments, 212 recettes.**

> ⚠️ Vérifier `git status -sb` en début de session : des commits peuvent ne pas être poussés.
> Modèle en vigueur — **Claude committe, l'utilisateur pousse** (le shell agent ne peut pas
> s'authentifier auprès de GitHub).

## Ce que le contenu a appris — la leçon de la session

Remplir le catalogue n'a pas seulement produit du contenu : **il a servi de banc de mesure et a
révélé quatre défauts du moteur invisibles sur 10 recettes.** Tous corrigés par mesure, jamais au
jugé, et à chaque fois une intuition raisonnable s'est révélée fausse au banc.

| Défaut | Correction | Preuve |
|---|---|---|
| Valeurs nutritionnelles **inventées** | Import CIQUAL 2025 réel, 193 mappings vérifiés à la main | 212 des 584 valeurs étaient fausses à plus de 25 %, la pire à **2 400 %** |
| « Ingrédient principal » = le plus lourd | **Signature** : 3 ingrédients, parts normalisées (§6.6 bis) | Similarité max 98,4 % → **82,9 %** |
| Pondération de similarité jamais vérifiée | **0,8 / 0,15 / 0,05** au lieu de 0,5 / 0,3 / 0,2 (§6.6 ter) | Paires > 60 % : 81 → **30** |
| Récence sur le mauvais index | Signature repliée par sous-famille + 2ᵉ déclencheur + filtre de créneau (§6.6 quater, quinquies) | Faux 6/6 → **0/6**, ratés 1/7 → **0/7** |
| Trous CIQUAL comptés comme des zéros | **Couverture** : `nutri` s'abstient (§5.1 bis) | 13 recettes sur 212 cessaient d'être notées sur du vide |

> **Méthode à conserver.** Trois de mes propres recommandations ont été *démenties par la mesure* :
> la pondération par rareté, le modèle « principal + secondaires », et un seuil que je croyais
> valide alors que mon jeu de cas jugés était simplement aveugle aux produits laitiers. Un banc qui
> ne contredit jamais celui qui l'écrit ne sert à rien.

## ▶ Reprendre ici

**1. ⬅ PROCHAINE ÉTAPE — `suggestAlternatives`** (décision 26, ETAT §4). Le blocage est levé : le
mécanisme « plat frère » a de quoi travailler (16 aliments poissons, 13 viandes, une vingtaine de
recettes de chaque) et il repose sur la notion d'ingrédient caractéristique, désormais **correcte**.
Spec révisée : **variante** = ingrédient principal invariant (retrait d'un `optionnel`,
substitution d'un ingrédient secondaire) · **alternative** = autre recette, ingrédient principal
libre dans le même `Food.groupe`, toujours dans les filtres de l'utilisateur. La table
`substitution` se conçoit **avec** les recettes, pas avant (décision 27).

**2. Chantier proposé, non validé — les codes de confiance CIQUAL.** L'import télécharge un fichier
qui donne, **pour chaque valeur**, un `code_confiance` (A→D) et un `source_code` bibliographique —
et l'importeur **jette les deux**. Mesuré sur nos valeurs : hors énergie, **34 % sont cotées C ou D**
par l'ANSES elle-même (vitamine C 48 %, fibres 47 %, glucides 46 %). ⚠️ Piège : l'énergie est à
191 D sur 192 **par construction** (« Energie, Règlement UE N° 1169/2011 » est *calculée* depuis les
macros) — pondérer naïvement la sortirait du scoring pour tout le catalogue.

**3. Le planning attend, toujours.** Orchestration par-dessus le moteur, il peut attendre sans rien
coûter.

**4. Écrire une recette qui a besoin d'un aliment absent des 193** : ajouter l'entrée dans
`foods.yaml` (id, nom, groupe, saisonnalité, allergènes — à la main), sa ligne dans
`ciqual-mapping.yaml` (`node catalog/import-ciqual.mjs --search "<terme>"` pour trouver le code),
puis `npm run catalog:ciqual -- --write`. **Les valeurs nutritionnelles ne s'écrivent JAMAIS à la
main.**

## Cinq acquis à ne pas défaire

1. **L'asymétrie `habit` / `variety`.** `habit` ne compte que les entrées d'origine `choisi` — un
   reste mangé n'est pas une préférence exprimée. `variety` lit **toutes** les origines — un reste
   mangé lasse quand même. Le filtre de `habit` s'applique **au dénominateur** ; ne filtrer que le
   numérateur ferait baisser mécaniquement toutes les affinités dès qu'on mange des restes. Un test
   le verrouille sur la valeur attendue (0,5) et sur celle qu'aurait produite l'erreur (0,333).
2. **`requiredFoodIds` vit dans `MealContext`, pas dans `HardConstraints`** — alors que son miroir
   `excludedFoodIds` y est. L'asymétrie est **volontaire** : `WeekPlanRequest` n'ayant pas de
   `MealContext`, l'exigence devient *structurellement inexprimable* pour un plan de semaine. La
   garantie vient de la forme, pas de la discipline de l'appelant.
3. **Une couche qui ne discrimine pas n'est jamais citée dans une explication.** Sur un profil neuf,
   `preference`, `craving` et `variety` rendent le même score à tous les candidats : les citer
   reviendrait à annoncer « proche de vos goûts » à quelqu'un dont l'appli ne sait rien.
4. **Deux espaces de signature, volontairement distincts.** `recipeSignature` (brut) sert la
   SIMILARITÉ, qui doit encore distinguer un blanc de poulet rôti d'un tajine de cuisses ;
   `recipeFamilySignature` (replié par sous-famille) sert la RÉCENCE, qui se moque du morceau. Les
   fusionner casserait l'une ou l'autre, et la pondération de la similarité a été mesurée sur le
   brut.
5. **Une recette déclare UN SEUL régime**, le plus restrictif qu'elle respecte (`vegetalien` pour un
   plat sans produit animal). La couche `regime` connaît la chaîne
   `vegetalien ⊂ vegetarien ⊂ pescetarien ⊂ omnivore` (§6.3 ter ENGINE). Les étiquettes multiples
   ont été écartées pour leur mode de défaillance **silencieux**.

## Dette connue

- **λ (diversification) n'est pas calibré** — mais **le blocage est levé** : le catalogue compte
  212 recettes et la distribution a été mesurée sur 22 366 paires (max 94,2 % · p99 38,2 % ·
  médiane 9,5 % · 30 paires > 60 %). Reste à faire, plus à débloquer.
- **`varietyMode` n'est pas observable au banc**, et le contenu n'y change RIEN : la cause est un
  historique de repas **vide**, pas un catalogue pauvre. Toutes les recettes ont donc la même
  récence et l'override les décale identiquement. Il faut injecter un historique, pas des recettes.
- **`recipeMainIngredient` n'est lu par AUCUNE couche** — il reste calculé à l'init et n'est employé
  que par les bancs de comparaison. À supprimer si l'on fige ces bancs.
- **Le banc n'affiche plus la similarité** de chaque recette retenue (`ScoredSuggestion` ne porte
  pas cette information). À rétablir avant de calibrer λ.
- **`NUTRI_MIN_COVERAGE = 0,7` est un seuil de JUGEMENT**, pas de mesure — contrairement à tous les
  autres seuils du moteur. Aucun jeu de cas jugés n'existe pour « ce nutriment est-il notable ».
- **L'explication distingue peu** : les cinq suggestions affichent souvent les mêmes trois phrases,
  seul l'ordre change. Honnête, mais peu utile pour choisir (sujet UI, P5).
- **Le lexique banni sur-bloque** : la garde cherche des sous-chaînes, donc « rincer
  **soigne**usement » est rejeté à cause de `soigne`. Contourné en reformulant, jamais corrigé.
- **`ENGINE_VERSION` est codé en dur** dans `api/index.ts` et peut diverger de `package.json`.
- **La table d'historique v1 devra porter la colonne d'origine** — le type `MealHistoryEntry` l'a,
  aucune table ne la modélise encore.
- **Le lexique banni existe en deux copies** (`catalog/build.mjs`,
  `app/src/engine/guards/banned-terms.ts`), synchronisées par
  `tests/banned-terms-consistency.test.mjs`. Si ce test disparaît, la duplication devient dangereuse.
- **Contenu** : `roquefort` porte l'allergène `lait` mais pas `sulfites`. Les 9 nutriments sont un
  choix assumé (décision 25), pas une dette.
- **Les tests de propriété ne passent plus tous à l'échelle du catalogue.** Celui des allergènes
  énumérait le powerset (4 096 combinaisons à 12 allergènes) et a dépassé le délai : il couvre
  désormais vide + singletons + paires + complet. **À surveiller à chaque palier de contenu.**

## Décisions ouvertes

- **Codes de confiance CIQUAL** — chantier proposé ci-dessus, **non validé**.
- **Radar** : rayons cuisine/saveur = v2 (v1 = 6 pôles sensoriels).
- **Scan produit** (OpenFoodFacts, jamais Yuka) : opt-in **v2+++++**.
- **Token de push GitHub** : à fournir si on veut que l'agent pousse lui-même.

Le reste vit dans `ETAT.md` §3 (décisions figées) et §4 (ouvertes) — la fiche ne fait que pointer.

## Chantier B — vin & modes repas

`CONCEPTION_B_VIN_REPAS.md`, 8 décisions tranchées, rang 0 codé. Restent : facette `service` au
catalogue · `composeMeal` **après P1c** · table `recipe_pairing` · affichage des accords en P5.

> `CourseKind` (entrée/plat/dessert) existe dans le domaine mais **n'est pas sur `Recipe`** — il
> reste réservé à ce chantier. Le `creneau` a suffi pour la récence ; annoter les 212 recettes n'a
> pas été jugé nécessaire.

## Méthode (rappel `CLAUDE.md`)

Plan ≤3 bullets avant toute tâche 2+ fichiers · TDD sur la logique moteur · échec 2× → stop ·
jamais commit/push/install sans demande explicite · le code s'écrit via agents Sonnet, Claude
planifie et **vérifie** (tests, typecheck, build, relecture des diffs, recalcul à la main des
valeurs sensibles).
