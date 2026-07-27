# ⭐ Fiche de reprise — appli_nutrition

> **À lire en premier.** Où on en est, quoi faire ensuite, ce qu'il ne faut pas défaire.
> Index de toute la documentation : [README.md](./README.md). État complet : [ETAT.md](./ETAT.md).
> Spécification (fait foi) : [ENGINE.md](./ENGINE.md), [ARCHITECTURE.md](./ARCHITECTURE.md).
> Dernière mise à jour : **2026-07-26** (session 4 — P1c lot 4 : flags favoris/variété.
> Récit de la session précédente : `RECAP_SESSION_3.md`).

---

## En une ligne

Planificateur de repas **100 % local, sans IA, sans compte**. Moteur en TypeScript pur, catalogue
SQLite construit au build. On code le moteur en ligne de commande **avant toute UI** (P3).

## Où on en est

**Le moteur suggère en une ligne.** `engine.suggestMeals(req)` rend des suggestions classées,
diversifiées, expliquées, avec l'entonnoir des rejets et des diagnostics rejouables.

```
P0 ✅ ── P1a ✅ ── P1b-1 ✅ ── P1b-2 ✅ ── P1c ✅ (lots 1-4) ── CONTENU ▓▓ ── planning ⬜ ── UI ⬜
```

| Acquis | Détail |
|---|---|
| **Registre à 18 couches** | 7 exclusion (`allergenes` 🔒 · `regime` 🔒 · `exclusions` · `requis` · `temps` · `equipement` · `favoris`) + 11 score, dont 7 implémentées |
| **Flags de requête** | `onlyFavorites` (+ `favoriteRecipeIds`, obligatoire) · `varietyMode` (`auto`/`surprise`/`classiques`) · `mmrLambda` · `skipDiversification` |
| **Passe de score** | Poids normalisés Σ=1, archétypes, bascule d'envie, tie-break stable par id de recette |
| **6 archétypes** | `equilibre` · `envie` · `decouverte` · `de_saison` · `mes_gouts` · `rapide` |
| **Diversification** | MMR, λ = 0,4 **non calibré** (voir dette) |
| **Explication** | Top 3, avec la règle de non-citation (voir « acquis » n°3) |
| **Garde-fous** | 4 sur 5 codés — reste `assertCalorieFloor`, qui attend le planning |
| **Banc CLI** | `npm run engine:try` — entonnoir, poids appliqués, classement, explications |

**État vérifié : `npm test` → 401 verts (35 fichiers) · `npm run typecheck` propre ·
`npm run build` → **193 aliments, 212 recettes** — valeurs nutritionnelles **CIQUAL 2025 réelles**,
plus aucun `PROV-`. Cible v1 revue (décision 4) : ~200 aliments **atteint**,
200-300 recettes **ATTEINTE**.**

> Règle de contenu à ne pas défaire : une recette déclare **un seul** régime, le plus restrictif
> qu'elle respecte (`vegetalien` pour un plat sans produit animal). La couche `regime` connaît la
> chaîne `vegetalien ⊂ vegetarien ⊂ pescetarien ⊂ omnivore` et se charge du reste — §6.3 ter ENGINE.

> ⚠️ Vérifier `git status -sb` en début de session : des commits peuvent ne pas être poussés.
> Modèle en vigueur — **Claude committe, l'utilisateur pousse** (le shell agent ne peut pas
> s'authentifier auprès de GitHub).

## ▶ Reprendre ici

**1. Le contenu est FAIT pour la v1.** 193 aliments aux valeurs ANSES réelles, 212 recettes, aucun
aliment inemployé. La cible de la décision 4 (200-300 recettes) est atteinte. Continuer reste
possible et utile, mais ce n'est plus un préalable à quoi que ce soit.

> Écrire une recette qui a besoin d'un aliment absent des 193 : ajouter l'entrée dans `foods.yaml`
> (id, nom, groupe, saisonnalité, allergènes — à la main), sa ligne dans `ciqual-mapping.yaml`
> (`node catalog/import-ciqual.mjs --search "<terme>"` pour trouver le code), puis
> `npm run catalog:ciqual -- --write`. Les valeurs nutritionnelles ne s'écrivent JAMAIS à la main.

**2. ⬅ PROCHAINE ÉTAPE — `suggestAlternatives`, spec révisée (décision 26, ETAT §4).** Le blocage
est levé depuis longtemps : le mécanisme « plat frère » a de quoi travailler (16 aliments poissons,
13 viandes, une vingtaine de recettes de chaque). Et il repose sur la notion d'ingrédient
caractéristique, désormais CORRECTE (`recipeSignature`, §6.6 bis) — la construire avant la
correction aurait été du travail à refaire. Rappel de la spec révisée : **variante** = ingrédient principal
invariant (retrait d'un `optionnel`, substitution d'un ingrédient secondaire) · **alternative** =
autre recette, ingrédient principal libre dans le même `Food.groupe`, toujours dans les filtres de
l'utilisateur. La table `substitution` se conçoit **avec** les recettes, pas avant (décision 27).

**3. Le planning attend, toujours.** Il ne changera pas selon que le catalogue contient 10 ou 200
recettes : c'est de l'orchestration par-dessus le moteur, il peut attendre sans rien coûter.

**λ est désormais calibrable** : le catalogue et le modèle de similarité sont sains (distribution
mesurée sous « Dette connue »). **`varietyMode` ne l'est toujours pas**, et le contenu n'y changera
rien : son problème est un historique de repas VIDE au banc, pas un catalogue pauvre — toutes les
recettes ont donc la même récence et l'override les décale identiquement.

## Trois acquis à ne pas défaire

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
   reviendrait à annoncer « proche de vos goûts » à quelqu'un dont l'appli ne sait rien. D'où la
   forme de `explainSuggestion`, qui reçoit l'**ensemble** des candidats scorés et non une recette
   isolée.

## Dette connue

- ✅ ~~`recipeMainIngredient` fausse la similarité~~ — **CORRIGÉ.** `similarity` compare désormais
  des `recipeSignature` (3 ingrédients les plus lourds, parts normalisées, chevauchement pondéré),
  modèle choisi par mesure sur six candidats à 100 puis 200 recettes — voir
  `engine/nutrition/signature.ts`. Effet mesuré : similarité maximale **98,4 % → 82,9 %**, p99
  63,0 % → 52,6 %, et les 6 paires les plus proches sont toutes légitimes (deux soupes de carottes,
  deux plats de maquereau, deux taboulés…) là où l'ancien modèle plaçait « œufs au plat aux
  tomates × soupe de poisson » à 99 %.
- 🟠 **`variety` et `habit` utilisent TOUJOURS `recipeMainIngredient`** — le même index resté
  volontairement en place. Conséquence : manger un plat rend « récent » tout plat partageant son
  ingrédient le plus lourd, même sans rapport. La correction n'est PAS la même que pour la
  similarité (« ai-je mangé ça récemment » n'est pas « ces plats se ressemblent-ils »), donc elle
  demande sa propre mesure avant d'être écrite. Ne pas copier la signature ici sans mesurer.
- **λ (diversification) n'est pas calibré**, mais la base l'est enfin. Distribution mesurée sur
  212 recettes / 22 366 paires, après correction de l'ingrédient (§6.6 bis) ET de la pondération
  (§6.6 ter, 0,8/0,15/0,05) : max 94,2 % · p99 38,2 % · médiane 9,5 % · **30 paires au-dessus de
  60 %** (contre 81 avant). Dans la bande 55-70 %, où MMR arbitre vraiment, toutes les paires ont
  désormais ≥ 56 % d'ingrédients communs. Trois outils de mesure : `npm run engine:similarity`
  (distribution), `compare-similarite.ts` (modèles), `compare-ponderation.ts` (poids),
  `audit-similarite.ts` (inspection paire par paire, avec décomposition).
- **Le banc n'affiche plus la similarité** de chaque recette retenue (perdue en passant par
  `suggestMeals` — `ScoredSuggestion` ne porte pas cette information). À rétablir avant de calibrer λ.
- **L'explication distingue peu** : les cinq suggestions affichent souvent les mêmes trois phrases,
  seul l'ordre change. Honnête, mais peu utile pour choisir entre elles — il faudra sans doute une
  notion de degré ou de comparaison (sujet UI, P5).
- **`ENGINE_VERSION` est codé en dur** dans `api/index.ts` et peut diverger de `package.json`.
- **La table d'historique v1 devra porter la colonne d'origine** — le type `MealHistoryEntry` l'a,
  aucune table ne la modélise encore.
- **Le lexique banni existe en deux copies** (`catalog/build.mjs`,
  `app/src/engine/guards/banned-terms.ts`), synchronisées par
  `tests/banned-terms-consistency.test.mjs`. Si ce test disparaît, la duplication devient dangereuse.
- **Contenu** : ~~valeurs `PROV-`~~ **résolu** (import CIQUAL 2025, 193 aliments). Reste :
  `roquefort` porte l'allergène `lait` mais pas `sulfites` ; les 9 nutriments sont un choix assumé
  (décision 25), pas une dette.
- **Aliments sans énergie CIQUAL** (décision 29, ouverte) : l'import les REFUSE, ce qui a coûté la
  ricotta, les câpres et la ciboulette. État sûr provisoire — un aliment sans kcal fausserait à la
  fois l'affichage et le classement par `nutri`. La vraie réponse est de propager l'incomplétude.
- **Les tests de propriété ne passent plus tous à l'échelle du catalogue.** Celui des allergènes
  énumérait le powerset (32 combinaisons à 5 allergènes, 4 096 à 12) et a dépassé le délai : il
  couvre désormais vide + singletons + paires + complet. Trois autres assertions figées (comptes,
  régimes, temps) ont dû devenir des propriétés. **À surveiller à chaque palier de contenu.**

## Décisions ouvertes

- ~~**9 nutriments ou ~40 ?**~~ — **tranché : 9**, et l'import est fait (décision 25).
- **Aliments sans énergie CIQUAL** — décision 29, la seule ouverte qui bloque du contenu.
- **Radar** : rayons cuisine/saveur = v2 (v1 = 6 pôles sensoriels).
- **Scan produit** (OpenFoodFacts, jamais Yuka) : opt-in **v2+++++**.
- **Token de push GitHub** : à fournir si on veut que l'agent pousse lui-même.

Le reste vit dans `ETAT.md` §3 (décisions figées) et §4 (ouvertes) — la fiche ne fait que pointer.

## Chantier B — vin & modes repas

`CONCEPTION_B_VIN_REPAS.md`, 8 décisions tranchées, rang 0 codé. Restent : facette `service` au
catalogue (+ 2 entrées et 2 desserts au catalogue de test pour l'exercer) · `composeMeal` **après
P1c** · table `recipe_pairing` · affichage des accords en P5.

## Méthode (rappel `CLAUDE.md`)

Plan ≤3 bullets avant toute tâche 2+ fichiers · TDD sur la logique moteur · échec 2× → stop ·
jamais commit/push/install sans demande explicite · le code s'écrit via agents Sonnet, Claude
planifie et **vérifie** (tests, typecheck, build, relecture des diffs, recalcul à la main des
valeurs sensibles).
