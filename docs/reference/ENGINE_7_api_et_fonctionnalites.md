# Moteur — L5 API publique · Fonctionnalités

> Partie de la spécification du moteur. Index et ordre de lecture : [`../ENGINE.md`](../ENGINE.md).
> **La numérotation des sections (§4, §6.6 bis…) est celle du document d'origine et n'a pas bougé** —
> toute référence `ENGINE §x.y` faite ailleurs reste valide.

---

## 8. L5 — API publique

Surface volontairement étroite. Tout le reste est interne au module.

```ts
export function createEngine(catalog: Catalog, opts?: CreateEngineOptions): Engine

export interface CreateEngineOptions {
  readonly now?: () => number   // horloge injectée, pour EngineDiagnostics.dureeMs — jamais Date.now()
}

export interface Engine {
  readonly version: string
  readonly catalogVersion: string

  suggestMeals(req: SuggestionRequest): SuggestionResult
  planWeek(req: WeekPlanRequest): WeekPlan
  rerollSlot(plan: WeekPlan, slot: SlotRef, opts?: RerollOptions): WeekPlan
  planLeftovers(plan: WeekPlan): WeekPlan
  buildShoppingList(plan: WeekPlan, opts?: ShoppingOptions): ShoppingList
  analyzeWeek(plan: WeekPlan, profile: UserProfile): NutritionReport
  scaleRecipe(id: RecipeId, portions: number): ScaledRecipe
  suggestSubstitutions(id: RecipeId, missing: readonly FoodId[]): readonly Substitution[]

  /**
   * CODÉ (2026-07-28) — §8.4. ⚠️ Signature RÉVISÉE : prend un `SuggestionRequest`, que la version
   * proposée ci-dessus omettait. Sans lui, une alternative ne repasserait pas les filtres et
   * pourrait proposer un plat contenant un allergène déclaré. Rend un objet à DEUX listes, pas un
   * tableau : `variants` garde le plat, `alternatives` en change (décision 26).
   */
  suggestAlternatives(
    req: SuggestionRequest,
    recipeId: RecipeId,
    dislikedFoodId: FoodId
  ): AlternativeSuggestion

  /** Accès individuel à une couche — §6.8 */
  layer<C>(id: LayerId): SelectionLayer<C>
  readonly layers: readonly LayerDescriptor[]   // id · nature · critique · poids effectif
}
```

> **`createEngine` est désormais RÉEL (CODÉ, P1b-2), dans la limite de ce qui est implémentable à
> ce stade.** À l'appel, il enrichit le catalogue reçu (`attachDerivedIndexes`, §6.5 précision 8 —
> `recipeNutrients`/`recipeMainIngredient` peuplés) et expose `version` (constante
> `ENGINE_VERSION`, voir note ci-dessous), `catalogVersion`, `layers` (`LAYER_DESCRIPTORS`) et
> `layer(id)` — ce dernier distingue deux échecs : un id **déclaré** au registre mais pas encore
> implémenté (P2 : `pantry`/`occasion`/`topic`/`cost`) vs un id **inconnu** (absent de
> `LAYER_DESCRIPTORS`). Accepte désormais un second paramètre optionnel, `CreateEngineOptions.now`
> (CODÉ, P1c) — une **horloge injectée**, pour `EngineDiagnostics.dureeMs` uniquement ; absente,
> `dureeMs` vaut 0. Jamais `Date.now()` en interne (§3 ENGINE), y compris pour cette mesure.
>
> **`suggestMeals` est désormais RÉEL (CODÉ, P1c)** — assemblage bout-en-bout : exclusion →
> `assertNoDeclaredAllergen` → 0 candidat → `NoViableRecipeError` → score → classement +
> diversification (§6.6) → explication (§6.7) → `assertCriticalLayersRan` puis
> `assertNoTherapeuticClaim` (§5.2), voir `runSuggestMeals` (`engine/api/index.ts`). **Il ne reste
> que 7 méthodes non implémentées sur les 8 de l'interface `Engine`** : `planWeek`, `rerollSlot`,
> `planLeftovers`, `buildShoppingList`, `analyzeWeek`, `scaleRecipe`, `suggestSubstitutions` lèvent
> chacune explicitement « non implémenté (P1c) » — leur câblage (`planning/`) reste un lot ultérieur.
>
> **Limite d'API levée (P1c).** Le point précédemment ouvert ci-dessous ne s'applique plus à
> l'usage réel constaté : `createEngine` garde toujours le catalogue enrichi dans sa fermeture sans
> l'exposer directement (`Engine` ne rend que `version`/`catalogVersion`/`layers`/`layer()` en plus
> de `suggestMeals`), mais plus aucun appelant n'a besoin de le recontourner — le banc CLI
> `engine:try` (§11.3) passe désormais entièrement par `engine.suggestMeals(request)` et ne rappelle
> plus `attachDerivedIndexes`, ni `runExclusionPass`/`runScoringPass` à la main. Le coût dupliqué
> précédemment documenté (ancienne version de ce paragraphe) a disparu avec lui.
>
> `ENGINE_VERSION` (constante `'0.1.0'`, `engine/api/index.ts`) est codée en dur, faute de
> mécanisme d'injection depuis `package.json` — peut diverger silencieusement du numéro de version
> réel du dépôt si l'un est mis à jour sans l'autre (dette connue, voir `docs/FICHE_REPRISE.md`).

### 8.1 Requête

```ts
export interface SuggestionRequest {
  readonly profile: UserProfile
  readonly constraints: HardConstraints     // allergies · régime · exclusions
  readonly context: MealContext             // créneau · date · temps · envies · garde-manger
  readonly history: MealHistory             // N derniers jours, pour la variété
  readonly preferences: ReadonlyMap<FoodId, number> // -2…+2, couche `preference` — CODÉ, OBLIGATOIRE, voir note
  readonly activeTopics: readonly TopicId[] // [] par défaut
  readonly weights?: Partial<ScoreWeights>
  readonly archetype?: ArchetypeId          // §6.3 bis — CODÉ ; défaut = 'equilibre' ; sélecteur UI = P3
  readonly favoriteRecipeIds: ReadonlySet<RecipeId> // CODÉ, OBLIGATOIRE — source de données d'`onlyFavorites`, voir note
  readonly onlyFavorites?: boolean          // P1c — CODÉ ; couche d'exclusion `favoris`, restreint les candidats avant scoring
  readonly varietyMode?: 'auto' | 'surprise' | 'classiques' // P1c — CODÉ ; override explicite de `variety` (précision 5, §6.5)
  readonly limit?: number                   // défaut 5
  readonly seed: number                     // reproductibilité
  readonly mmrLambda?: number                // §6.6 — CODÉ ; poids de la pénalité MMR ; défaut DEFAULT_MMR_LAMBDA (0.3, CALIBRÉ — §6.6)
  readonly skipDiversification?: boolean     // §6.6 — CODÉ ; désactive MMR, classement brut tronqué à `limit` ; défaut false
}
```

> **`preferences` (CODÉ, OBLIGATOIRE — §6.5 précision 4).** `ReadonlyMap<FoodId, number>`, échelle
> **−2 (déteste) … +2 (adore)**, lignes `user_preference` de `cible_type = 'food'` (§4.3
> ARCHITECTURE). Ce champ manquait ENTIÈREMENT de la conception initiale : la couche `preference`
> pesait 0,25 sans aucune source de données avant son ajout. Une Map **vide** est le cas légitime
> « aucune préférence connue » : la couche rend alors `NEUTRAL_SCORE` pour tout candidat, plutôt
> que de traiter l'absence comme un cas particulier côté couche.
>
> **`onlyFavorites` et `varietyMode` sont CODÉS (P1c lot 4).** `onlyFavorites` restreint l'ensemble
> de candidats à `user_favorite` **avant** le passage des couches de score — cohérent avec
> « favori = marque-page, n'influence pas le moteur par défaut » (§10.1 : c'est un opt-in
> explicite, pas un poids ajouté en continu). Implémenté comme la 7ᵉ couche d'EXCLUSION `favoris`
> (`selection/favoris.ts`), placée **en dernier** dans `EXCLUSION_LAYERS` : « hors favoris » est le
> motif de rejet le moins informatif du registre, il ne doit en masquer aucun autre.
>
> **`favoriteRecipeIds` est un ajout à la conception initiale**, du même ordre que `preferences`
> ci-dessus : §8.1 ne spécifiait qu'un booléen `onlyFavorites`, sans jamais dire d'où venait la
> liste des favoris. Un flag sans source de données ne filtre rien. Le champ est donc
> **OBLIGATOIRE** (Set vide = aucun favori) pour que l'oubli soit une erreur de compilation plutôt
> qu'un `NoViableRecipeError` incompréhensible à l'exécution. Conséquence assumée :
> `onlyFavorites: true` avec un Set vide ne conserve **rien** et lève — un filtre dur qui vide le
> panier le dit, il ne se désactive pas tout seul (même règle que `requis`, §6.5 ter).
>
> `varietyMode` est converti en `VarietyOverride` par `varietyLayer.configure` : la position
> `'auto'` et l'absence du champ donnent toutes deux `null` (aucun override). `VarietyOverride`
> disait `'classics'` (anglais) jusqu'à ce lot — aligné sur `'classiques'` pour éviter une table de
> traduction, et par cohérence avec les autres unions fermées du domaine (`MealOrigin`,
> `NutrientSense`, `ArchetypeId`), toutes en français.
>
> `archetype`, lui, est **CODÉ** (`domain/request.ts`) — voir §6.3 bis pour la table des surcharges
> et `selection/archetypes.ts` pour la résolution ; seul le SÉLECTEUR UI (onboarding/Paramètres)
> reste P3.

> `MealContext.requiredFoodIds` (couche `requis`, **CODÉ**) vit dans `context`, pas dans
> `constraints` (`HardConstraints`), alors que son miroir `excludedFoodIds` y est : `WeekPlanRequest`
> n'a pas de `MealContext`, donc ce placement rend le filtre dur structurellement hors d'atteinte de
> `planWeek` plutôt que de compter sur la discipline de l'appelant (§6.5 ter).

> `mmrLambda` et `skipDiversification` (CODÉS, P1c) pilotent la diversification MMR (§6.6) depuis la
> requête ; `mmrLambda` est sans effet si `skipDiversification` est vrai (MMR alors totalement
> court-circuitée, classement brut tronqué à `limit`). Ajoutés pour que le banc CLI (`--lambda`,
> `--no-mmr`, §11.3) pilote la diversification sans avoir à rappeler `diversify` lui-même en dehors
> de `suggestMeals`.

### 8.2 Réponse

```ts
export interface SuggestionResult {
  readonly suggestions: readonly ScoredSuggestion[]
  readonly rejected: RejectionSummary       // transparence : combien, et pourquoi
  readonly diagnostics: EngineDiagnostics
}

export interface ScoredSuggestion {
  readonly recipeId: RecipeId
  readonly score: number                    // 0 → 100
  readonly breakdown: ScoreBreakdown        // contribution PONDÉRÉE par couche, voir note ci-dessous
  readonly explanations: readonly Explanation[]
  readonly portions: number
  readonly nutrition: NutrientSummary
}

export interface EngineDiagnostics {
  readonly engineVersion: string
  readonly catalogVersion: string
  readonly weights: ScoreWeights            // effectivement appliqués
  readonly seed: number
  readonly candidatsInitiaux: number
  readonly candidatsApresFiltrage: number
  readonly dureeMs: number
}
```

> `diagnostics` porte tout ce qu'il faut pour **rejouer une suggestion à l'identique**. C'est
> l'auditabilité exigée par le principe 4 : face à une suggestion contestée, on rejoue exactement
> le même calcul. Affiché derrière un écran développeur, jamais dans le parcours normal.

> **`ScoreBreakdown` stocke la CONTRIBUTION PONDÉRÉE de chaque couche (CODÉ, `runScoringPass`,
> `engine/selection/scoring-pass.ts`)** — poids normalisé × score brut de la couche —, **pas** son
> score brut. Avantage direct : la somme des entrées du breakdown est EXACTEMENT le score final,
> donc « part du score final, 0 → 1 » (§6.7) se lit DIRECTEMENT depuis le breakdown, sans recalcul
> ni accès aux poids. Conséquence assumée : le score BRUT d'une couche n'est plus récupérable
> depuis le breakdown seul (contribution / poids le retrouve, mais ce n'est pas ce que la structure
> stocke) — un besoin futur de score brut (debug, tests) doit le lire ailleurs.

> **`EngineDiagnostics.weights` est désormais un `ScoreWeights` COMPLET (CODÉ, P1c).**
> `runScoringPass` ne rend que les couches de score ACTIVES (poids > 0, sparsité assumée et
> documentée dans `scoring-pass.ts`) ; `runSuggestMeals` (`engine/api/index.ts`) complète ce
> résultat partiel à zéro pour les 4 couches de score déclarées mais non implémentées
> (`pantry`/`occasion`/`topic`/`cost`) avant de le placer dans `diagnostics.weights` — la complétion
> est explicitement la responsabilité de l'appelant, pas de la passe de score elle-même.

### 8.3 Contrat d'erreur

| Erreur | Signification | Traitement UI |
|---|---|---|
| `NoViableRecipeError` | Contraintes trop restrictives, 0 candidat | Écran « assouplir un critère », avec le motif dominant issu de `RejectionSummary` |
| `EngineSafetyError` | Post-condition violée — bug | Écran d'erreur. **Jamais de dégradation silencieuse.** |
| `CatalogIntegrityError` | Catalogue corrompu ou version incompatible | Rechargement du catalogue livré |

> **`NoViableRecipeError` porte désormais le `RejectionSummary` COMPLET (CODÉ, P1c,
> `engine/domain/errors.ts`)** — une propriété `rejected: RejectionSummary`, pas seulement un
> message texte. §8.3 disait déjà que le motif dominant vient de `RejectionSummary` ; l'attacher à
> l'erreur elle-même évite à l'appelant (banc CLI, future UI) de rejouer `runExclusionPass` pour
> retrouver l'entonnoir complet derrière le message — `describeNoViableRecipe` (`engine/api/index.ts`)
> l'utilise pour construire un message qui cite le motif dominant en toutes lettres.

---

### 8.4 `suggestAlternatives` — « je n'aime pas cet ingrédient » — CODÉ (2026-07-28)

Décision 26. **Deux notions que la spec initiale confondait**, et qui ne doivent jamais être
refondues :

| | Ce qui change | Mécanisme |
|---|---|---|
| **Variante** | rien — le même plat, autrement | retrait d'un ingrédient `optionnel`, ou substitution d'un ingrédient **secondaire** |
| **Alternative** | la recette entière | autre plat dont l'ingrédient caractéristique est dans le **même `Food.groupe`**, mais **différent** |

> ⚠️ **Pas `argmax(similarity)` pour le plat frère.** La similarité pondère la composition à 0,80
> (§6.6 ter) : la maximiser revient à privilégier les recettes qui **gardent** l'ingrédient rejeté —
> l'inverse du service rendu. Le piège était déjà noté quand le poids valait 0,5 ; il s'est aggravé.

> ⚠️ **Signature révisée.** `(recipeId, dislikedFoodId)` est insuffisant : les alternatives passent
> par `runExclusionPass`, donc par les mêmes sept couches d'exclusion que `suggestMeals`.

#### L'ingrédient CARACTÉRISTIQUE — troisième notion, troisième mesure

`engine/nutrition/characteristic-ingredient.ts`. À ne confondre ni avec `recipeMainIngredient` (le
plus lourd, mesuré faux) ni avec `recipeSignature` (comparer deux plats). Ici la question est
« quel aliment un plat frère doit-il remplacer ».

**Modèle mesuré** (banc jeté après usage, 212 recettes) : le plus lourd d'un **groupe définissant**
— `viandes`, `poissons`, `fruits de mer`, `légumineuses` — avec repli sur le plus lourd sinon.

Sur **29 recettes** les deux modèles divergent, et les 29 fois le groupe définissant a raison :

| Recette | Le plus lourd | Caractéristique |
|---|---|---|
| Hachis de bœuf aux pommes de terre | pomme de terre | **bœuf** |
| Cabillaud aux épinards et au curry | épinard | **cabillaud** |
| Dahl de lentilles corail | tomate | **lentilles corail** |
| Caldo verde | pomme de terre | **poitrine de porc** |

> ⚠️ **`œufs` est volontairement absent des groupes définissants.** Mesuré : l'y inclure fait de
> « Clafoutis aux framboises » un plat d'ŒUF. L'œuf est un ingrédient de structure (crêpes, flans,
> mousses, panures) — **exactement le piège déjà rencontré en §6.6 quinquies**, écarté pour la même
> raison. Le retirer fait tomber les désaccords de 49 à 29, les 20 disparus étant tous des desserts.

Le repli concerne **114 recettes sur 212** (soupes, gratins de légumes, desserts) : pour elles « le
plus lourd » redevient le meilleur candidat — une soupe de carottes *est* un plat de carottes.

#### Limites assumées

- **Classement par ordre d'id**, faute de critère mesuré. Classer par similarité serait activement
  nuisible (voir ci-dessus) ; classer par score demanderait la passe complète pour un service
  secondaire. Ce qui est verrouillé par test, c'est le **déterminisme**, pas la pertinence de l'ordre.
- **La table `substitution` est vide** (décision 27 : elle se conçoit avec les recettes). Le chemin
  de code existe et est testé ; il ne rend rien. Ce n'est pas un bug à corriger en inventant des
  substitutions.


## 10. Fonctionnalités

### 10.1 Demandées — couvertes

| Fonctionnalité | Où | Version |
|---|---|---|
| Suggestion multi-repas | `selection/` | v1 |
| Allergies & régime | couches `allergenes` 🔒 · `regime` 🔒 (avec chaîne d'inclusion `vegetalien ⊂ vegetarien ⊂ pescetarien ⊂ omnivore`, §6.3 ter) | v1 |
| Préférences culinaires | couche `preference` | v1 |
| Envies du moment | couche `craving` + axes sensoriels | v1 |
| Planning 7 jours | `planning/planWeek` | v1 |
| Liste de courses | `planning/shopping` | v1 |
| Ajustement des proportions | `facteurPortion` + `scaleRecipe` | v1 |
| Photos des plats | catalogue, `imagePath` | v1 |
| Tip du jour | rotation déterministe sur la date | v1 |
| **Vider le frigo** | couche `pantry` + mode dédié | v1 |
| **Anticipation des envies** | couche `habit` (§7.5) | v1 |
| **Repas d'occasion** | couche `occasion` (§8.6 ARCHI) | v1 |
| **Équipement disponible** | couche `equipment` | v1 |
| **Lexique de cuisine illustré** | catalogue, `lexicon_entry` | v1 |
| **Macros en option** | affichage, `false` par défaut (§6.5 ARCHI) | v1 |
| **Favoris** | `user_favorite` — marque-page, hors moteur ; flag `onlyFavorites` **CODÉ** (P1c, §8.1) → couche d'exclusion `favoris` | v1 |
| **Mode variété** | `varietyMode` **CODÉ** (P1c, §8.1) — override explicite de la couche `variety` | v1 |
| **Substitution d'ingrédient** | `suggestSubstitutions` + table `substitution` (secondaire, recalcul allergènes) | v1 |
| **Alternatives d'une recette** | `suggestAlternatives` PROPOSÉ (§8, socle en P1b, feature P1c/P2) | v1 |
| **Import / partage de recette** | fichier `.nutri-recipe`, P2P sans serveur (§8.7 ARCHI) | v1 |
| **Commentaires locaux** | `user_recipe_note`, exportables avec le partage | v1 |
| **Mode cuisine** | couche UI (timers par étape) — hors moteur (§5bis ARCHI) | v1 mono-recette · v1.5 multi-recettes |
| Fiches scientifiques | `topics/` + `evidence/` | v2 |
| Thématiques santé | couche `topic`, poids 0 | v2 |
| Coût des repas | couche `cost` | v3 |

### 10.2 Ajouts proposés — fort rapport valeur / coût

**① Mode « vider le frigo »** — l'utilisateur saisit ce qu'il a, le moteur classe par taux de
couverture des ingrédients.

> **Ce n'est pas un filtre.** Avec 4 ingrédients au frigo, aucune recette n'est intégralement
> couverte : un filtre renverrait zéro résultat. C'est une **couche de score sur le taux de
> couverture**, en deux modes :

| Mode | Poids `pantry` | Affichage |
|---|---|---|
| Normal | Bonus modéré (0.05) | « 6 ingrédients sur 8 déjà chez toi » |
| **Vider le frigo** | Dominant, écrase les autres | Trié par couverture + **« il te manque : crème, thym »** |

Afficher ce qui manque vaut mieux que masquer la recette — et se combine avec les substitutions
(« pas de crème ? yaourt grec »).

> ⚠️ Frigo Magic occupe ce terrain avec 4 800 recettes, gratuitement. Chez nous c'est **une couche
> parmi douze**, pas le produit. Ne pas positionner l'application là-dessus.

**② Substitutions d'ingrédients** — « pas de crème ? yaourt grec ». Table de substitution dans le
catalogue, avec impact nutritionnel affiché. *Coût : contenu (~200 paires) + une fonction.*
Transforme « je ne peux pas faire cette recette » en « je la fais quand même ».

**③ Retour post-repas** — un pouce haut / bas après un repas alimente automatiquement
`user_preference`. *Coût : quasi nul.* C'est le meilleur levier de qualité à long terme : le
moteur s'améliore par l'usage, **sans aucune IA** — juste des préférences accumulées.

**④ Temps disponible par créneau** — « 20 min en semaine, 1 h le week-end ». *Coût : un champ de
profil.* Sans ça, le planning propose des mijotés un mardi soir et devient inutilisable.

**⑤ Gestion des restes** — §7.3. *Coût : moyen.* Différenciant fort.

**⑥ Contrainte de course unique** — « je fais les courses le samedi » → le planificateur favorise
les recettes partageant des ingrédients et place le périssable en début de semaine. *Coût : un
critère + un champ `perissabiliteJours` sur les aliments.*

**⑦ Mode invités** — mise à l'échelle ponctuelle d'un repas pour N personnes, sans toucher au
profil. *Coût : quasi nul, `scaleRecipe` existe déjà.*

**⑧ Bilan hebdomadaire qualitatif** — pas un compteur de calories (interdit §6.5), mais une vue
« groupes d'aliments couverts cette semaine », formulée positivement : *« beaucoup de légumes verts,
peu de poisson »*. *Coût : faible, `analyzeWeek` existe dans l'API.*

**⑨ Export du planning** — image ou PDF pour la porte du frigo. *Coût : faible.*

### 10.3 Écartés

| Idée | Raison |
|---|---|
| Score nutritionnel global type note A-E | Réducteur, culpabilisant, et prête à contestation |
| Objectif de poids / suivi de courbe | §6.5 ARCHITECTURE — risque TCA |
| Partage social / communauté | Exige un backend → viole le principe 2 |
| Import de recettes par URL | Scraping, qualité non maîtrisée, droit d'auteur |

---
