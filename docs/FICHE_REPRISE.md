# ⭐ Fiche de reprise — appli_nutrition

> **Mise à jour : 2026-07-28.** Une page, jamais plus. Tout le reste est dans
> [ETAT.md](./ETAT.md) — avancement, décisions, dette. Index : [README.md](./README.md).
> Font foi : [ENGINE.md](./ENGINE.md) (moteur), [ARCHITECTURE.md](./ARCHITECTURE.md) (le reste).

## Le projet

Planificateur de repas **100 % local, sans IA, sans compte**. Moteur TypeScript pur, catalogue
SQLite construit au build. **On code le moteur en ligne de commande avant toute UI.**

## Où on en est

```
P0 ✅ ── P1a ✅ ── P1b ✅ ── P1c ✅ ── CONTENU ✅ ── suggestAlternatives ✅ ── planning ✅ ── restes ✅ ── courses ✅ ── UI ⬜
                                                                                          ⬅ ICI
```

**Vérifié le 2026-07-28** : `npm test` → **528 verts (41 fichiers)** · `npm run engine:plan-stress` → **20/20 configurations saines** · `npm run typecheck` propre ·
`npm run build` → **199 aliments, 241 recettes** (valeurs CIQUAL 2025 réelles).

`engine.suggestMeals(req)` rend des suggestions classées, diversifiées, expliquées, avec l'entonnoir
des rejets et des diagnostics rejouables. Registre à **18 couches** (7 exclusion + 11 score, dont
7 implémentées), 6 archétypes, **les 5 garde-fous**.

## ▶ La prochaine étape

**L'UI** (P3). Le moteur est complet pour la v1 : suggestion, alternatives, planning, restes, liste
de courses, et les 5 garde-fous.

> Et les points de l'audit toujours ouverts : **zéro photo sur 241 recettes**, lexique à 4 gestes,
> revue juridique avant publication.

## Les cinq acquis à ne pas défaire

1. **`habit` ne compte que les entrées `choisi`** (un reste n'est pas une préférence), **`variety`
   lit toutes les origines** (un reste lasse quand même). Le filtre de `habit` porte **sur le
   dénominateur**. Asymétrie volontaire, verrouillée par test.
2. **`requiredFoodIds` vit dans `MealContext`, pas dans `HardConstraints`** — pour rendre l'exigence
   *structurellement inexprimable* dans un plan de semaine. La garantie vient de la forme.
3. **Une couche qui ne discrimine pas n'est jamais citée** dans une explication — sinon on annonce
   « proche de vos goûts » à quelqu'un dont l'appli ne sait rien.
4. **Deux espaces de signature, à ne pas fusionner.** `recipeSignature` (brut) sert la SIMILARITÉ,
   qui doit distinguer un blanc de poulet d'un tajine de cuisses ; `recipeFamilySignature` (replié
   par sous-famille) sert la RÉCENCE, qui se moque du morceau.
5. **Une recette déclare UN SEUL régime**, le plus restrictif qu'elle respecte. La couche `regime`
   connaît la chaîne `vegetalien ⊂ vegetarien ⊂ pescetarien ⊂ omnivore`.

## La leçon de la session — à ne pas perdre

Remplir le catalogue a servi de **banc de mesure** et a révélé cinq défauts invisibles sur
10 recettes : valeurs nutritionnelles inventées (la pire fausse à **2 400 %**), ingrédient
caractéristique, pondération de similarité, règle de récence, trous CIQUAL comptés comme des zéros.
Tous corrigés **par mesure**, jamais au jugé.

> **Trois de mes propres recommandations ont été démenties par le banc** : la pondération par
> rareté, le modèle « principal + secondaires », et un seuil que je croyais bon alors que mon jeu de
> cas jugés était aveugle aux produits laitiers. **Mesurer avant de trancher, et se méfier d'un banc
> qui ne contredit jamais celui qui l'écrit.**

## Avant de coder

- ⚠️ `git status -sb` — des commits peuvent ne pas être poussés. **Claude committe, l'utilisateur
  pousse** (le shell agent ne peut pas s'authentifier auprès de GitHub).
- Les valeurs nutritionnelles **ne s'écrivent JAMAIS à la main** : `foods.yaml` + `ciqual-mapping.yaml`,
  puis `npm run catalog:ciqual -- --write`.
- Méthode (`CLAUDE.md`) : plan ≤3 bullets avant toute tâche 2+ fichiers · TDD sur la logique moteur ·
  échec 2× → stop · jamais commit/push/install sans demande explicite.

## Où chercher le reste

| Question | Document |
|---|---|
| Avancement détaillé, décisions figées et ouvertes, **dette connue** | [ETAT.md](./ETAT.md) |
| Comment marche une couche, un algorithme, l'API | [ENGINE.md](./ENGINE.md) |
| Périmètre produit, données, cadre légal | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Écrans, navigation, badge de preuve | [DESIGN.md](./DESIGN.md) |
| Points ouverts non traités (photos, lexique, juridique) | [AUDIT_2026-07-27.md](./AUDIT_2026-07-27.md) |
