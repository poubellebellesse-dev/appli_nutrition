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

**État vérifié : `npm test` → 387 verts (34 fichiers) · `npm run typecheck` propre ·
`npm run build` → **193 aliments, 73 recettes** — valeurs nutritionnelles **CIQUAL 2025 réelles**,
plus aucun `PROV-`. Cible v1 revue (décision 4) : ~200 aliments **atteint**, 200-300 recettes **en
cours**.**

> Règle de contenu à ne pas défaire : une recette déclare **un seul** régime, le plus restrictif
> qu'elle respecte (`vegetalien` pour un plat sans produit animal). La couche `regime` connaît la
> chaîne `vegetalien ⊂ vegetarien ⊂ pescetarien ⊂ omnivore` et se charge du reste — §6.3 ter ENGINE.

> ⚠️ Vérifier `git status -sb` en début de session : des commits peuvent ne pas être poussés.
> Modèle en vigueur — **Claude committe, l'utilisateur pousse** (le shell agent ne peut pas
> s'authentifier auprès de GitHub).

## ▶ Reprendre ici

**1. Le contenu — continuer à remplir le catalogue.** L'import CIQUAL est **FAIT** (76 aliments aux
valeurs ANSES 2025 réelles, `npm run catalog:ciqual`). Reste **les recettes, de 22 à ~100**. Ce n'est
pas du code : ingrédients quantifiés, étapes, allergènes, facettes, axes sensoriels, temps,
équipement, envergure, créneaux. Et la contrainte figée (**contenu original obligatoire, pas de
scrap**) veut dire qu'elles s'écrivent, elles ne se collectent pas. C'est le gros morceau du projet.

> Écrire une recette qui a besoin d'un aliment absent des 76 : ajouter l'entrée dans `foods.yaml`
> (id, nom, groupe, saisonnalité, allergènes — à la main), sa ligne dans `ciqual-mapping.yaml`
> (`node catalog/import-ciqual.mjs --search "<terme>"` pour trouver le code), puis
> `npm run catalog:ciqual -- --write`. Les valeurs nutritionnelles ne s'écrivent JAMAIS à la main.

**2. Puis `suggestAlternatives`, avec la spec révisée (décision 26, ETAT §4).** Reporté
délibérément : sur 10 recettes, le mécanisme « plat frère » n'a **aucun candidat** — 1 seule recette
de poisson (saumon poêlé), 1 seule de viande (bœuf haché). Le coder maintenant reviendrait à écrire
à l'aveugle, comme calibrer λ. Rappel de la spec révisée : **variante** = ingrédient principal
invariant (retrait d'un `optionnel`, substitution d'un ingrédient secondaire) · **alternative** =
autre recette, ingrédient principal libre dans le même `Food.groupe`, toujours dans les filtres de
l'utilisateur. La table `substitution` se conçoit **avec** les recettes, pas avant (décision 27).

**3. Le planning attend, toujours.** Il ne changera pas selon que le catalogue contient 10 ou 200
recettes : c'est de l'orchestration par-dessus le moteur, il peut attendre sans rien coûter.

**Deux dettes de mesure, identiques dans leur forme** : λ (§6.6) et `varietyMode` ne sont pas
jugeables sur le catalogue actuel — λ parce que 10 recettes n'ont pas la distribution d'un vrai
catalogue, `varietyMode` parce que l'historique du banc est vide (les 10 recettes ont donc la même
récence, l'override les décale toutes pareil sans changer l'ordre). Le contenu débloque les deux.

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
