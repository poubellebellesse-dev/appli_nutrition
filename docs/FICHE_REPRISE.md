# ⭐ Fiche de reprise — appli_nutrition

> **Mise à jour : 2026-07-31.** Une page, jamais plus. Tout le reste est dans
> [ETAT.md](./ETAT.md) — avancement, décisions, dette. Index : [README.md](./README.md).
> Font foi : [ENGINE.md](./ENGINE.md) (moteur), [ARCHITECTURE.md](./ARCHITECTURE.md) (le reste).

## Le projet

Planificateur de repas **100 % local, sans IA, sans compte**. Moteur TypeScript pur, catalogue
SQLite construit au build, PWA React servie en statique.

## Où on en est

```
MOTEUR ✅ ─ CONTENU ✅ ─ user.db ✅ ─ DESIGN ✅ ─ 8 ÉCRANS ✅ ─ INSTALLABLE ✅ ─▶ CONTENU & DISTRIBUTION ▓▓
                                                                                        ⬅ ICI
```

**Vérifié le 2026-07-30** : `npm test` → **725 verts (50 fichiers)** · `npm run typecheck` propre ·
`npx vite build` OK · `npm run build` → **199 aliments, 241 recettes, 62 gestes, 8 tips**.
**Vérifié le 2026-07-29, inchangé depuis** : `npm run engine:plan-stress` → 20/20 configurations saines.

**L'application fait sa boucle complète** : s'installer → déclarer ses allergies → voir une
suggestion → planifier sa semaine → sortir sa liste de courses → cuisiner. Plus « partir de ce
qu'on a » et un lexique de 62 gestes.

## ▶ La prochaine étape

**Ce qui reste n'est plus du code d'écran.** Trois chantiers, par ordre de dépendance :

1. **Vérifier sur un vrai téléphone.** `npx vite build && npx vite preview --host`, puis installer.
   Le service worker et l'installation **ne s'activent qu'en build de production** — `npm run dev`
   ne les monte pas.
2. **Hébergement, puis Play.** Origine HTTPS + `/.well-known/assetlinks.json` : sans ce fichier, la
   barre d'URL ne se masque pas et Bubblewrap ne peut rien empaqueter. Hébergeur et domaine non
   choisis (STRATEGIE_DISTRIBUTION §3).
3. **Contenu** — photos (0 sur 241), lexique illustré, tips de nutrition humaine, chapitres
   « Comprendre ». Rien de tout cela n'est un problème de code.

**Et une dette qui grossit** : **zéro test d'interface**. Sur les défauts de la session 5, trois ont
été trouvés en utilisant l'application, un en relisant le code, **aucun par la suite de tests**.

## Les cinq acquis à ne pas défaire

1. **`habit` ne compte que les entrées `choisi`** (un reste n'est pas une préférence), **`variety`
   lit toutes les origines** (un reste lasse quand même). Le filtre de `habit` porte **sur le
   dénominateur**. Asymétrie volontaire, verrouillée par test.
2. **`requiredFoodIds` vit dans `MealContext`, pas dans `HardConstraints`** — pour rendre l'exigence
   *structurellement inexprimable* dans un plan de semaine. La garantie vient de la forme.
3. **Une couche qui ne discrimine pas n'est jamais citée** dans une explication — sinon on annonce
   « proche de vos goûts » à quelqu'un dont l'appli ne sait rien.
4. **Deux espaces de signature, à ne pas fusionner.** `recipeSignature` (brut) sert la SIMILARITÉ ;
   `recipeFamilySignature` (replié par sous-famille) sert la RÉCENCE, qui se moque du morceau.
5. **Une recette déclare UN SEUL régime**, le plus restrictif qu'elle respecte. **L'origine animale
   est un fait, pas un régime** : `Food.origineAnimale` + `deriveDe`, propagés en cascade.

## Les pièges qui ne se voient pas

**Chaîne de build**

- ⚠️ **`catalog-loader.ts` et les `user-*.ts` ne doivent importer AUCUN module Node.** L'import est
  **hoisté** : un `import 'node:sqlite'` casse le bundle navigateur même si la fonction n'est jamais
  appelée. Le message de Rollup ne désigne pas la cause. Seul `vite build` l'attrape.
- ⚠️ **`vitest.config.ts` est séparé de `vite.config.ts` exprès.** Y poser `root: 'app'` a fait
  passer la suite de **572 tests à 528 sans le moindre échec**.
- ⚠️ **Hacher les NOMS de fichiers n'invalide pas un cache.** Tout ce qui vit dans `public/`
  (`catalog.db`, polices, icônes) a un nom FIXE : une mise à jour de contenu n'atteignait **jamais**
  un utilisateur installé. → hacher le CONTENU. Invisible en dev et à tout build où le code change.

**Navigateur**

- ⚠️ **Aucun VFS OPFS de SQLite ne tourne sur le thread principal.** Les deux testent
  `createSyncAccessHandle`, `[Exposed=DedicatedWorker]` — **aucune en-tête COOP/COEP n'y change
  rien**. → base en mémoire + fichier OPFS réécrit (`user-source.ts`).
- ⚠️ **Les drapeaux ne se rendent pas sous Windows** (« FR », « IT » à la place). Normal, pas un bug.

**Moteur et données**

- ⚠️ **Un garde-fou sans source de données ne garde rien.** Le filtre allergènes a tourné sur une
  liste VIDE jusqu'à ce que l'onboarding existe. Même défaut que `preference` en P1b-2. Vérifier
  qu'un champ déclaré est bien REMPLI par un écran.
- ⚠️ **`MealHistory.windowDays` n'est lu par AUCUNE couche.** La fenêtre de 21 jours n'existe que
  parce que `readHistory` la borne en SQL.
- ⚠️ **Une PRIMARY KEY contenant une colonne NULL ne dédoublonne pas** dans SQLite. → index UNIQUE
  sur `COALESCE(service, '')`.
- ⚠️ **`INSERT OR REPLACE` SUPPRIME la ligne avant de réinsérer**, donc déclenche les
  `ON DELETE CASCADE`. `savePlan` effaçait toute la liste de courses à chaque « Garder ». →
  `INSERT … ON CONFLICT DO UPDATE` dès qu'une ligne a des enfants.
- ⚠️ **Un plan relu depuis `user.db` arrive SANS ses avertissements.** `readPlan` rend
  `warnings: []` exprès — ils dépendent du profil. Repasser par `moteur.checkPlan`.
- ⚠️ **`uniteAffichage` est un texte figé, jamais mis à l'échelle par le moteur** — et c'est voulu.
  Un écran qui l'affiche tel quel montre des quantités qui ne bougent pas ; un écran qui le remplace
  par des grammes transforme « 4 artichauts » en « 2,4 kg ». → `ui/quantites.ts`.

**Méthode**

- ⚠️ **La cohérence ne dit rien de la couverture.** Le lexique avait 43 fiches, zéro référence
  cassée — et des gestes courants annotés nulle part. Un test qui vérifie une liste écrite à la main
  ne vérifie que lui-même.
- ⚠️ **Les maquettes contredisent leur propre cahier des charges.** Leur bouton principal est à
  3,95:1, sous le seuil AA, alors que le même bundle exige 7:1. Reproduire « au pixel » peut violer
  la spec jointe. Écarts mesurés en §1 DESIGN.

## Avant de coder

- ⚠️ `git status -sb` — des commits peuvent ne pas être poussés. **Claude committe, l'utilisateur
  pousse** (le shell agent ne peut pas s'authentifier auprès de GitHub).
- ⚠️ **Lire la maquette de l'écran AVANT de le coder** (`maquete claude design/`). J'ai codé Semaine
  sans le faire, alors que `DESIGN.md` §1 et §2 documentaient déjà les jetons et la navigation.
- Les valeurs nutritionnelles **ne s'écrivent JAMAIS à la main** : `foods.yaml` + `ciqual-mapping.yaml`,
  puis `npm run catalog:ciqual -- --write`.
- Méthode (`CLAUDE.md`) : plan ≤3 bullets avant toute tâche 2+ fichiers · TDD sur la logique moteur ·
  échec 2× → stop · jamais commit/push/install sans demande explicite.

## Où chercher le reste

| Question | Document |
|---|---|
| Avancement, **écrans un par un**, décisions, **dette connue** (§8) | [ETAT.md](./ETAT.md) |
| Comment marche une couche, un algorithme, l'API | [ENGINE.md](./ENGINE.md) |
| Périmètre produit, données, cadre légal | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Écrans, jetons visuels, badge de preuve | [DESIGN.md](./DESIGN.md) |
| Stores, hébergement, modèle économique | [STRATEGIE_DISTRIBUTION.md](./STRATEGIE_DISTRIBUTION.md) |
| Ce qui a été essayé **et écarté**, et pourquoi | [archive/](./archive/) |
