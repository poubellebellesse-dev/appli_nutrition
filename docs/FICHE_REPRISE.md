# ⭐ Fiche de reprise — appli_nutrition

> **À lire en premier.** État condensé + prochaines étapes. Pour le détail : `ETAT.md` (état
> complet), `RECAP_SESSION_2.md` (récit de la dernière session), `ENGINE.md` / `ARCHITECTURE.md`
> (spécification, font foi).
> Dernière mise à jour : **2026-07-24** (fin de session 2).

---

## En une ligne

Planificateur de repas **100 % local, sans IA, sans compte**. Moteur en TypeScript pur, catalogue
SQLite construit au build. On code le moteur en ligne de commande **avant toute UI** (P3).

## Où on en est

- **P0** (fondations) ✅ · **P1a** (4 couches d'exclusion) ✅ — **committés**.
- **P1b-1** (scoring, socle) ✅ **codé, PAS committé** :
  - 7 fonctions de score pures dans `engine/selection/scoring/` (`nutri`, `preference`, `craving`,
    `season`, `variety`, `speed`, `habit` minimal) + `NEUTRAL_SCORE = 0.5` partout.
  - Index dérivés calculés **à l'init du moteur** : `recipeNutrients` (par portion),
    `recipeMainIngredient`, via `attachDerivedIndexes` dans `engine/nutrition/`.
  - `food.saison_mois` + `food.toute_annee` ajoutés au schéma réel (build + loader).
- **Lots de session 2** ✅ **codés, PAS committés** :
  - `season` réécrite en **crédits pondérés par quantité** (1 en saison · 0,5 dispo hors saison ·
    0 sinon · staple exclu) ; `toute_annee` et `saison_mois` sont désormais **indépendants**.
  - Catalogue de test porté à **76 aliments** (+ fromages, poissons, fruits de mer, alcools de
    cuisine).
  - **5ᵉ couche d'exclusion `exclusions`** (rejet perso, lit `excludedFoodIds`) → **registre à 15
    couches** (5 exclusion + 10 score).

**État vérifié : `npm test` → 140 verts (22 fichiers) · `npm run typecheck` propre · `npm run build`
→ 76 aliments, 10 recettes. Rien n'est committé au-delà de P1a.**

## ▶ Reprendre ici — dans l'ordre

1. **Figer les commits locaux** (par lot, propres) puis **l'utilisateur pousse** (le shell agent ne
   peut pas s'authentifier — voir « décisions ouvertes »). Découpage suggéré : (a) P1b-1 socle,
   (b) saison crédits + 60 aliments, (c) contenu 76 + season pondérée + 5ᵉ couche, (d) mise à jour
   des docs.
2. **Doc de conception B** — vin + modes recette/repas (le seul chantier de conception non encore
   documenté ; variety et radar le sont, voir artefacts de session).
3. **Ajouter l'origine `choisi` / `reste`** sur `MealHistoryEntry` — prérequis de la refonte
   `variety`, à faire **avant** que l'historique existe.
4. **Réécrire `variety`** avec les paramètres verrouillés (TAU 3 crans · bascule brusque / dérive
   graduelle repoussée · origine des repas). Détail : `ENGINE.md` §6.5 ter.
5. **`requiredFoodIds`** — miroir dur du rejet, en sibling de `exclusions` (dur en contexte
   « Aujourd'hui » seulement).
6. **P1b-2** — passe de score pondérée + archétypes + poids dynamiques (craving/occasion) +
   tie-break + CLI de scores.
7. Plus tard : table courses non alimentaire (10 rayons, **quand `buildShoppingList` existera**,
   pas avant — pas de consommateur aujourd'hui), roue radar (v1 = 6 pôles sensoriels), `suggestAlternatives`.

## Décisions ouvertes (rappel)

- **Noms définitifs des ~6 archétypes** (Équilibre · Envie · Découverte · De saison · Mes goûts ·
  Rapide) — proposition, à confirmer.
- **Rattachement de `speed`** au pipeline : 16ᵉ couche du registre ou modulation interne.
- **Alcool** : ingrédient de cuisine (v1, décidé) ; **jamais** compté dans le calcul nutritionnel
  d'un repas ; boisson = article de courses uniquement.
- **`requiredFoodIds`** : dur vs gros bonus — reco *dur en contexte ponctuel*, à confirmer.
- **Radar** : rayons cuisine/saveur = v2 (v1 = 6 pôles sensoriels, gratuits).
- **Scan produit** (OpenFoodFacts, jamais Yuka) : opt-in **v2+++++**.
- **Token de push GitHub** : à fournir par l'utilisateur pour que l'agent pousse lui-même (sinon
  modèle « Claude committe, l'utilisateur pousse »).

## Artefacts de session 2 (privés, galerie claude.ai)

- Formules de score (valeurs réelles) : `…/artifact/a18ac7b5-738c-4a54-8c91-1c9bb45ea499`
- Rayons courses non alimentaires (~150 articles) : `…/artifact/6d512ae5-3665-4d56-8e66-719f745f7ec5`
- Conception `variety` : `…/artifact/ab696cb9-356f-4f4e-b3af-dadc60d71af5`
- Conception roue radar : `…/artifact/b4b3ed6e-768b-4b78-8c6c-77e5d883a9ca`

## Méthode (rappel `CLAUDE.md`)

Plan ≤3 bullets avant toute tâche 2+ fichiers · TDD sur la logique moteur · échec 2× → stop ·
jamais commit/push/install sans demande explicite · le code s'écrit via agents Sonnet, Claude
planifie et vérifie.
