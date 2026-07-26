# ⭐ Fiche de reprise — appli_nutrition

> **À lire en premier.** Où on en est, quoi faire ensuite, ce qu'il ne faut pas défaire.
> Index de toute la documentation : [README.md](./README.md). État complet : [ETAT.md](./ETAT.md).
> Spécification (fait foi) : [ENGINE.md](./ENGINE.md), [ARCHITECTURE.md](./ARCHITECTURE.md).
> Dernière mise à jour : **2026-07-26** (fin de session 3 — récit : `RECAP_SESSION_3.md`).

---

## En une ligne

Planificateur de repas **100 % local, sans IA, sans compte**. Moteur en TypeScript pur, catalogue
SQLite construit au build. On code le moteur en ligne de commande **avant toute UI** (P3).

## Où on en est

**Le moteur suggère en une ligne.** `engine.suggestMeals(req)` rend des suggestions classées,
diversifiées, expliquées, avec l'entonnoir des rejets et des diagnostics rejouables.

```
P0 ✅ ── P1a ✅ ── P1b-1 ✅ ── P1b-2 ✅ ── P1c ▓▓ (lots 1-3 faits, 2 morceaux restants) ── planning ⬜ ── UI ⬜
```

| Acquis | Détail |
|---|---|
| **Registre à 17 couches** | 6 exclusion (`allergenes` 🔒 · `regime` 🔒 · `exclusions` · `requis` · `temps` · `equipement`) + 11 score, dont 7 implémentées |
| **Passe de score** | Poids normalisés Σ=1, archétypes, bascule d'envie, tie-break stable par id de recette |
| **6 archétypes** | `equilibre` · `envie` · `decouverte` · `de_saison` · `mes_gouts` · `rapide` |
| **Diversification** | MMR, λ = 0,4 **non calibré** (voir dette) |
| **Explication** | Top 3, avec la règle de non-citation (voir « acquis » n°3) |
| **Garde-fous** | 4 sur 5 codés — reste `assertCalorieFloor`, qui attend le planning |
| **Banc CLI** | `npm run engine:try` — entonnoir, poids appliqués, classement, explications |

**État vérifié : `npm test` → 366 verts (33 fichiers) · `npm run typecheck` propre ·
`npm run build` → 76 aliments, 10 recettes.**

> ⚠️ Vérifier `git status -sb` en début de session : des commits peuvent ne pas être poussés.
> Modèle en vigueur — **Claude committe, l'utilisateur pousse** (le shell agent ne peut pas
> s'authentifier auprès de GitHub).

## ▶ Reprendre ici

**1. Finir P1c** — deux morceaux, les plus petits de la tranche :
- flags `onlyFavorites` (restreindre aux favoris **avant** le scoring) et `varietyMode`
  (« Surprends-moi » / « Mes classiques », override explicite de `variety`) ;
- `suggestAlternatives(recipeId, dislikedFoodId)` — trois mécanismes dans l'ordre : retirer
  l'ingrédient `optionnel`, piocher dans la table `substitution`, proposer un plat frère via le
  regroupement de la diversification.

**2. Puis le contenu, pas le planning.** Recommandation de fin de session 3 : s'arrêter là côté
moteur. Tout ce qui suivrait — calibrer λ, ajuster les poids, juger si les suggestions sont
crédibles — se réglerait aujourd'hui sur des données inventées. Le planning (semaine, restes,
courses) est de l'orchestration par-dessus le moteur : il ne changera pas selon que le catalogue
contient 10 ou 200 recettes, il peut attendre sans rien coûter.

Le chantier contenu, concrètement : **import CIQUAL** (parser ANSES → `food`/`food_nutrient`,
délégable à un agent) puis **les recettes** (choix produit, pas technique). Une décision à prendre
avant de commencer : **9 nutriments ou ~40 ?** Ça change la taille de l'import, le poids du `.db`
et la finesse de `nutri`.

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

- **λ (diversification) n'est pas calibré** — mesuré sur les 45 paires du catalogue réel : similarité
  maximale **48,7 %** (`boeuf_hache_sauce_tomate` × `saumon_poele_courgettes`), et MMR déplace
  `bœuf haché sauce tomate` du rang 5 au rang 8. L'effet existe donc, mais 10 recettes composées à
  la main n'ont pas la distribution d'un catalogue de production : calibrer λ demande d'attendre le
  vrai catalogue.
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
- **Contenu** : valeurs nutritionnelles en `PROV-`, 9 nutriments sur ~40 prévus, 10 recettes.
  `roquefort` porte l'allergène `lait` mais pas `sulfites`.

## Décisions ouvertes

- **9 nutriments ou ~40 ?** — à trancher avant l'import CIQUAL.
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
