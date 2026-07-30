# ⭐ Fiche de reprise — appli_nutrition

> **Mise à jour : 2026-07-30.** Une page, jamais plus. Tout le reste est dans
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

**Vérifié le 2026-07-30** : `npm test` → **708 verts (50 fichiers)** · `npm run typecheck` propre ·
`npx vite build` OK.
**Vérifié le 2026-07-29, inchangé depuis** : `npm run engine:plan-stress` → **20/20 configurations
saines** · `npm run build` → **199 aliments, 241 recettes, 62 gestes** (valeurs CIQUAL 2025 réelles).

**Le moteur est complet.** `suggestMeals`, `suggestAlternatives`, `planWeek`, `rerollSlot`,
`planLeftovers`, `buildShoppingList`, `scaleRecipe`, **les 5 garde-fous**. Registre à **18 couches**
(7 exclusion + 11 score, dont **8 implémentées**), 6 archétypes. Depuis le 2026-07-30 :
`checkPlan`, `browseRecipes` et `engine/search/`. Restent non câblées : `analyzeWeek`
et `suggestSubstitutions` (§9 ETAT).

## ▶ La prochaine étape

**Les écrans** — **6 sur 8** sont livrés (Premier lancement, Aujourd'hui, Semaine, Courses,
Recettes, Détail d'une recette). Restent **Vider le frigo** (4.5) et **Savoir** (4.7), le préalable `user.db` est levé,
l'appli a un routeur à 5 routes et **le système de design des maquettes est posé** (jetons, polices
auto-hébergées, barre à 5 onglets, mode sombre, cibles 48 px). Tableau complet écran par écran : [ETAT.md](./ETAT.md) §6.

> ✅ **`user.db` existe.** Schéma complet de §4.3 ARCHITECTURE (v2), migrations versionnées sur
> `app_meta.schema_version`. Base **en mémoire**, persistée en **fichier OPFS** — aucun VFS OPFS de
> SQLite ne tourne hors Worker, voir les pièges. `requeteDemo()` a disparu : profil, contraintes,
> goûts, historique et **plan de semaine** sont persistés.
>
> ⚠️ **Ce qui reste non vérifié en navigateur** : le premier essai a fait tomber le VFS OPFS
> (corrigé). Depuis la correction, **personne n'a rouvert la page**. Premier geste de la prochaine
> session : `npm run dev`, « J'ai choisi ce plat », recharger, vérifier que le compteur tient.

> ✅ **L'appli est INSTALLABLE** (2026-07-30) — manifest `standalone`, icônes, service worker de
> pré-cache, test « zéro requête réseau ». Cible de distribution tranchée : **Play via TWA d'abord,
> iOS plus tard** (STRATEGIE_DISTRIBUTION §3). Il manque l'hébergement HTTPS + `assetlinks.json`
> pour empaqueter.
>
> ⚠️ **Le service worker ne tourne QU'EN BUILD DE PRODUCTION.** `npm run dev` ne l'active pas —
> exprès : un cache qui sert de vieux fichiers pendant que Vite en pousse d'autres par HMR fait
> déboguer une version qui n'existe plus. Pour tester l'installation :
> `npx vite build && npx vite preview`.

La PWA tourne : `npm run dev`. Écrans **Courses (4.3)** et **Premier lancement (4.8)** sont les plus
prêts : le moteur et les données les attendent, et les maquettes existent pour les huit écrans
(`maquete claude design/`, à lire AVANT de coder un écran — je ne l'avais pas fait pour Semaine).

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

## Dix pièges qui ne se voient pas

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
- ⚠️ **Les maquettes ne respectent pas leur propre exigence de contraste.** Le blanc sur l'accent
  `#bd6a48` — **le bouton principal** — donne 3,95:1, sous le seuil AA. Idem pour le gris des
  libellés d'onglets (3,59:1). Reproduire une maquette « au pixel » peut donc violer le cahier des
  charges qui l'accompagne. Écarts mesurés et documentés en §1 DESIGN.
- ⚠️ **Aucun VFS OPFS de SQLite ne tourne sur le thread principal.** Les deux (`opfs` et
  `opfs-sahpool`) testent `createSyncAccessHandle`, déclaré `[Exposed=DedicatedWorker]` : la méthode
  n'existe pas hors d'un Worker, et **aucune en-tête COOP/COEP n'y change rien**. Erreur affichée :
  « Missing required OPFS APIs ». → base en mémoire + fichier OPFS réécrit (`user-source.ts`).
  Typecheck et `vite build` passaient parfaitement ; seul le navigateur l'a dit.
- ⚠️ **`uniteAffichage` est un texte figé, jamais mis à l'échelle par le moteur** — et c'est voulu
  (`scale-recipe.ts` refuse de « réécrire du français »). Un écran qui l'affiche tel quel montre donc
  des quantités qui ne bougent pas ; un écran qui le remplace par des grammes transforme
  « 4 artichauts » en « 2,4 kg » et « 1 pincée de sel » en « 8 g ». La sortie est de multiplier le
  NOMBRE DE TÊTE du libellé (`ui/quantites.ts`), qui porte déjà la bonne unité.
- ⚠️ **Un garde-fou sans source de données ne garde rien.** Le filtre allergènes est critique et
  incontournable — et il a tourné sur une liste VIDE jusqu'au 2026-07-30, parce qu'aucun écran ne
  demandait ses allergies. Même défaut que la couche `preference` en P1b-2. Le prochain sur la
  liste : `MealContext.requiredFoodIds`, `user_signal` et `user_display`, tous déclarés, aucun
  rempli.
- ⚠️ **`INSERT OR REPLACE` SUPPRIME la ligne avant de réinsérer**, donc déclenche les
  `ON DELETE CASCADE` qui pointent vers elle. `savePlan` effaçait ainsi toute la liste de courses et
  ses articles ajoutés à la main — et il est appelé à chaque « Garder » d'un créneau. → `INSERT …
  ON CONFLICT DO UPDATE` quand des enfants dépendent de la ligne. Verrouillé par test.
- ⚠️ **Un plan relu depuis `user.db` arrive SANS ses avertissements.** `readPlan` rend
  `warnings: []` exprès — un avertissement de plancher calorique dépend du profil, le figer en base
  le ferait mentir. Tout plan restauré DOIT repasser par `moteur.checkPlan`, sinon l'alerte de §6.5
  disparaît au rechargement de la page, en silence.

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
