# ⭐ Fiche de reprise — appli_nutrition

> **Mise à jour : 2026-07-29.** Une page, jamais plus. Tout le reste est dans
> [ETAT.md](./ETAT.md) — avancement, décisions, dette. Index : [README.md](./README.md).
> Font foi : [ENGINE.md](./ENGINE.md) (moteur), [ARCHITECTURE.md](./ARCHITECTURE.md) (le reste).

## Le projet

Planificateur de repas **100 % local, sans IA, sans compte**. Moteur TypeScript pur, catalogue
SQLite construit au build, PWA React servie en statique.

## Où on en est

```
P0 ✅ ─ P1a ✅ ─ P1b ✅ ─ P1c ✅ ─ CONTENU ✅ ─ alternatives ✅ ─ planning ✅ ─ courses ✅ ─ lexique ✅ ─ user.db ✅ ─▶ UI ▓▓
                                                                                                          ⬅ ICI
```

**Vérifié le 2026-07-30** : `npm test` → **604 verts (45 fichiers)** · `npm run typecheck` propre ·
`npx vite build` OK.
**Vérifié le 2026-07-29, inchangé depuis** : `npm run engine:plan-stress` → **20/20 configurations
saines** · `npm run build` → **199 aliments, 241 recettes, 62 gestes** (valeurs CIQUAL 2025 réelles).

**Le moteur est complet.** `suggestMeals`, `suggestAlternatives`, `planWeek`, `rerollSlot`,
`planLeftovers`, `buildShoppingList`, `scaleRecipe`, **les 5 garde-fous**. Registre à **18 couches**
(7 exclusion + 11 score, dont **8 implémentées**), 6 archétypes. Restent non câblées : `analyzeWeek`
et `suggestSubstitutions` (§9 ETAT).

## ▶ La prochaine étape

**Les écrans** — 1 sur 8 est livré, et **le préalable `user.db` est levé** (2026-07-30). Tableau
complet écran par écran : [ETAT.md](./ETAT.md) §6.

> ✅ **`user.db` existe.** Schéma complet de §4.3 ARCHITECTURE en v1, migrations versionnées sur
> `app_meta.schema_version`, OPFS via le VFS `opfs-sahpool`. `requeteDemo()` a disparu : l'écran lit
> un profil, des contraintes, des goûts et un historique **persistés**. Écrans Semaine (4.2) et
> Courses (4.3) toujours les plus prêts à coder ; l'onboarding (4.8) n'a plus de blocage.
>
> ⚠️ **Le chemin OPFS n'a pas été exécuté dans un vrai navigateur** — typecheck + `vite build` +
> 32 tests sous Node sur le mapping, mais personne n'a encore ouvert la page. Premier geste de la
> prochaine session : `npm run dev`, cliquer « J'ai choisi ce plat », recharger, vérifier que le
> compteur tient.

La PWA tourne : `npm run dev`. **Une seule tranche est livrée, volontairement** — le but était de
prouver la chaîne complète dans un navigateur (`catalog.db` → SQLite WASM → mapping partagé →
moteur → écran) avant d'investir dans huit écrans construits sur une chaîne non vérifiée.

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
   connaît la chaîne `vegetalien ⊂ vegetarien ⊂ pescetarien ⊂ omnivore`. **L'origine animale est un
   fait, pas un régime** : `Food.origineAnimale` + `deriveDe`, propagés en cascade.

## Cinq pièges qui ne se voient pas

- ⚠️ **`catalog-loader.ts` ne doit importer AUCUN module Node.** L'import est **hoisté** : un
  `import 'node:sqlite'` casse le bundle navigateur même si la fonction qui l'utilise n'est jamais
  appelée. Le message de Rollup ne désigne pas cette cause. → `catalog-loader-node.ts`.
- ⚠️ **`vitest.config.ts` est séparé de `vite.config.ts` exprès.** Vitest lit `vite.config.ts` faute
  de config dédiée : y poser `root: 'app'` a fait passer la suite de **572 tests à 528 sans le
  moindre échec**.
- ⚠️ **La cohérence ne dit rien de la couverture.** Le lexique avait 43 fiches, zéro référence
  cassée, zéro fiche orpheline — et des gestes courants annotés nulle part. Un test qui vérifie une
  liste écrite à la main ne vérifie que lui-même.
- ⚠️ **`MealHistory.windowDays` n'est lu par AUCUNE couche.** `habit` et `variety` consomment
  toutes les entrées qu'on leur passe. La fenêtre de 21 jours de §13 ENGINE n'existe que parce que
  `readHistory` la borne en SQL. Passer un historique complet au moteur le laisserait figer les
  suggestions sur les plats des premiers mois — sans erreur, sans test rouge.
- ⚠️ **Une PRIMARY KEY contenant une colonne NULL ne dédoublonne pas** dans SQLite : deux `NULL`
  n'y sont jamais égaux. `meal_plan_entry` aurait accepté deux plats sur le même créneau en mode
  recette (`service IS NULL`). → index UNIQUE sur `COALESCE(service, '')`, verrouillé par test.

## La leçon de fond

Remplir le catalogue a servi de **banc de mesure** et a révélé cinq défauts invisibles sur
10 recettes. Tous corrigés **par mesure**, jamais au jugé.

> **Trois de mes propres recommandations ont été démenties par le banc.** Et le diagnostic
> « le catalogue est trop léger pour le plancher calorique » était faux : la meilleure journée
> atteignait déjà 2 127 kcal. **Mesurer avant de trancher, et se méfier d'un banc qui ne contredit
> jamais celui qui l'écrit.** Récit : [archive/RECAP_SESSION_4.md](./archive/RECAP_SESSION_4.md) §2.

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
| Avancement détaillé, **écrans un par un**, décisions, **dette connue** | [ETAT.md](./ETAT.md) |
| Comment marche une couche, un algorithme, l'API | [ENGINE.md](./ENGINE.md) |
| Périmètre produit, données, cadre légal | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Écrans, navigation, badge de preuve | [DESIGN.md](./DESIGN.md) |
| Ce qui a été essayé **et écarté**, et pourquoi | [archive/RECAP_SESSION_4.md](./archive/RECAP_SESSION_4.md) |
| Points ouverts non traités (photos, juridique) | [AUDIT_2026-07-27.md](./AUDIT_2026-07-27.md) |
