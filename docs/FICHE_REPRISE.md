# ⭐ Fiche de reprise — appli_nutrition

> **À lire en premier.** État condensé + prochaines étapes. Pour le détail : `ETAT.md` (état
> complet), `RECAP_SESSION_2.md` (récit de la session 2), `ENGINE.md` / `ARCHITECTURE.md`
> (spécification, font foi), `CONCEPTION_B_VIN_REPAS.md` (chantier vin + modes repas).
> Dernière mise à jour : **2026-07-25** (fin de session 3).

---

## En une ligne

Planificateur de repas **100 % local, sans IA, sans compte**. Moteur en TypeScript pur, catalogue
SQLite construit au build. On code le moteur en ligne de commande **avant toute UI** (P3).

## Où on en est

Tout ce qui suit est **committé** — la session 3 a d'abord vidé la dette de commits laissée par la
session 2, puis livré trois lots.

| Livré | Contenu |
|---|---|
| **P0** ✅ · **P1a** ✅ | Fondations, chaîne de build, 4 couches d'exclusion initiales |
| **P1b-1** ✅ | Schéma saison/staple · index dérivés à l'init du moteur · 7 fonctions de score · `NEUTRAL_SCORE = 0.5` |
| **Contenu** ✅ | Catalogue de test porté à **76 aliments** (fromages, poissons, fruits de mer, alcools de cuisine) |
| **Couche `exclusions`** ✅ | Rejet personnel d'aliments (`excludedFoodIds`) |
| **Rang 0** ✅ *(session 3)* | Origine `choisi`/`reste` sur `MealHistoryEntry` + `CourseKind` + `MealPlanEntry.service` — faits **pendant que `user.db` est vide**, donc gratuits |
| **`variety` TAU** ✅ *(session 3)* | Vitesse d'oubli réglable à trois crans (3 / 7 / 14 j, défaut 7) |
| **Couche `requis`** ✅ *(session 3)* | Miroir dur de `exclusions` — « je veux ça », conjonctif |

**Le registre est passé à 16 couches** (6 exclusion + 10 score). Ordre de motif :
`allergenes` 🔒 → `regime` 🔒 → `exclusions` → `requis` → `temps` → `equipement`.

**État vérifié : `npm test` → 158 verts (23 fichiers) · `npm run typecheck` propre · `npm run build`
→ 76 aliments, 10 recettes.**

> ⚠️ Vérifier `git status -sb` en début de session : les derniers commits peuvent ne pas être
> poussés. Modèle en vigueur — **Claude committe, l'utilisateur pousse** (le shell agent ne peut pas
> s'authentifier auprès de GitHub).

## Deux acquis de session 3 à ne pas défaire

1. **L'asymétrie `habit` / `variety`.** `habit` ne compte que les entrées d'origine `choisi` — un
   reste mangé n'est pas une préférence exprimée. `variety` lit **toutes** les origines — un reste
   mangé lasse quand même. Le filtre de `habit` s'applique **au dénominateur** : ne filtrer que le
   numérateur ferait baisser mécaniquement toutes les affinités dès qu'on mange des restes. Un test
   verrouille ça avec le piège chiffré (0,5 attendu ; 0,333 si le dénominateur est dilué).
2. **`requiredFoodIds` vit dans `MealContext`, pas dans `HardConstraints`.** Son miroir
   `excludedFoodIds` est pourtant dans `HardConstraints` : l'asymétrie est **volontaire**.
   `WeekPlanRequest` n'ayant pas de `MealContext`, l'exigence devient *structurellement
   inexprimable* pour un plan de semaine — c'est ainsi qu'on obtient « dur en contexte Aujourd'hui
   seulement » par la forme, et non par la discipline de l'appelant.

## ▶ Reprendre ici — **P1b-2**

Toute la file de la session 2 est close. Il reste la tranche P1b-2, la plus grosse depuis P1a :
elle transforme 7 fonctions de score isolées en une vraie passe de sélection. Découpage suggéré,
à fichiers disjoints :

| Sous-lot | Contenu |
|---|---|
| **a — la passe** | `runScoringPass` : accumulation pondérée sur les couches `kind: 'scoring'`, poids normalisés (Σ = 1), **tie-break stable par id de recette**, aucune réduction de l'ensemble (invariant à couvrir par test de propriété) |
| **b — archétypes & poids contextuels** | Les ~6 archétypes (vecteurs de poids nommés, §6.3 bis) + `craving` n°1 quand une envie est posée **en contexte Aujourd'hui seulement**, `occasion` n°2 en période active, 0 hors période |
| **c — banc CLI** | `engine:try` (§11.3) : suggestions, détail du score, motifs de rejet — sans navigateur. C'est l'outil qui servira jusqu'à la fin du projet |

Prérequis inclus dans le lot a : **`createEngine` est encore un stub**. Son assemblage
(`attachDerivedIndexes` appelé à l'init) est un livrable de P1b-2, pas un acquis.

Ensuite : **P1c** — diversification (MMR), explication (top 3), `suggestMeals` bout-en-bout, flags
`onlyFavorites` / `varietyMode`, `suggestAlternatives`.

## Chantier B — vin & modes repas (conception livrée, code à venir)

Document : `CONCEPTION_B_VIN_REPAS.md`, **8 décisions tranchées**. Le rang 0 de son ordre
d'implémentation est fait (voir ci-dessus). Restent, dans l'ordre :

1. Facette `service` au catalogue (`entree · plat · dessert · accompagnement`) + annoter les
   recettes de test — il manque **2 entrées et 2 desserts** pour exercer le mode repas en CLI.
2. `composeMeal` / `rerollCourse` + score d'accord entre services — **après P1c**.
3. Table `recipe_pairing` + règle miroir sans alcool au build + lexique d'incitation — volontairement
   après le point 2 : coder une table sans consommateur est ce qu'on a refusé pour les courses non
   alimentaires.
4. Affichage des accords (section repliée, réglage, message sanitaire) — P5.

## Décisions ouvertes (rappel)

- **Noms définitifs des ~6 archétypes** (Équilibre · Envie · Découverte · De saison · Mes goûts ·
  Rapide) — proposition, à confirmer **avant le sous-lot b**.
- **Rattachement de `speed`** : couche à part entière (ce serait la **17ᵉ**) ou modulation interne —
  à trancher en P1b-2.
- **Radar** : rayons cuisine/saveur = v2 (v1 = 6 pôles sensoriels).
- **Scan produit** (OpenFoodFacts, jamais Yuka) : opt-in **v2+++++**.
- **Token de push GitHub** : à fournir si on veut que l'agent pousse lui-même.

Tranchées en session 3, ne plus rediscuter : `requiredFoodIds` (dur, contexte Aujourd'hui) ·
alcool dans l'agrégat (un alcool **employé comme ingrédient** est compté comme les autres ; c'est la
**boisson servie** qui n'est jamais un aliment du repas) · les 8 décisions du chantier B.

## Dette connue

- La table qui matérialisera l'historique en v1 devra porter la colonne d'**origine** — le type
  `MealHistoryEntry` l'a, aucune table ne le modélise encore.
- `roquefort` porte l'allergène `lait` mais pas `sulfites` — à revoir avec la table CIQUAL réelle.
- Valeurs nutritionnelles du catalogue de test toujours en `PROV-` (ordres de grandeur).

## Artefacts de session 2 (privés, galerie claude.ai)

- Formules de score (valeurs réelles) : `…/artifact/a18ac7b5-738c-4a54-8c91-1c9bb45ea499`
- Rayons courses non alimentaires (~150 articles) : `…/artifact/6d512ae5-3665-4d56-8e66-719f745f7ec5`
- Conception `variety` : `…/artifact/ab696cb9-356f-4f4e-b3af-dadc60d71af5`
- Conception roue radar : `…/artifact/b4b3ed6e-768b-4b78-8c6c-77e5d883a9ca`

## Méthode (rappel `CLAUDE.md`)

Plan ≤3 bullets avant toute tâche 2+ fichiers · TDD sur la logique moteur · échec 2× → stop ·
jamais commit/push/install sans demande explicite · le code s'écrit via agents Sonnet, Claude
planifie et vérifie (tests + typecheck + relecture des diffs).
