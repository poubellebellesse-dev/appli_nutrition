# ⭐ Fiche de reprise — appli_nutrition

> **Mise à jour : 2026-08-01.** Une page, jamais plus. Tout le reste est dans
> [ETAT.md](./ETAT.md) — avancement, décisions, dette. Index : [README.md](./README.md).
> Font foi : [ENGINE.md](./ENGINE.md) (moteur), [ARCHITECTURE.md](./ARCHITECTURE.md) (le reste).

## Le projet

Planificateur de repas **100 % local, sans IA, sans compte**. Moteur TypeScript pur, catalogue
SQLite construit au build, PWA React servie en statique.

## Où on en est

```
MOTEUR ✅ ─ CONTENU ✅ ─ user.db ✅ ─ DESIGN ✅ ─ 9 ÉCRANS ✅ ─ TESTS D'ÉCRAN ✅ ─▶ CONTENU & DISTRIBUTION ▓▓
                                                                                          ⬅ ICI
```

**Vérifié le 2026-08-01** : `npm test` → **950 verts (69 fichiers)** · `npm run typecheck` propre ·
`npm run build` → **199 aliments, 241 recettes, 62 gestes, 73 tips, 8 fiches (33 positions)** ·
`npx vite build` OK.

**L'application fait sa boucle complète** : s'installer → déclarer ses allergies → voir une
suggestion → planifier sa semaine → sortir sa liste de courses → cuisiner. Plus « partir de ce
qu'on a », un lexique de 62 gestes, et l'onglet Savoir complet.

⚠️ **Dépôt à jour avec `origin/main` au 2026-08-01** (tout est poussé jusqu'à `5942f2f`), mais
**~96 fichiers modifiés ou nouveaux restent non committés** : c'est le chantier `evidence` de la
piste parallèle, encore en cours. Ne pas le commiter sans son auteur.
**Claude committe, l'utilisateur pousse** — le shell agent ne peut pas s'authentifier auprès de
GitHub.

⚠️ **Deux pistes ont travaillé en parallèle sur la période 2026-07-31 → 2026-08-01**, dans deux
conversations séparées. Pour comprendre ce qui s'est passé, il faut lire les DEUX récits :
[archive/RECAP_SESSION_6.md](./archive/RECAP_SESSION_6.md) (contenu de Savoir) et
[archive/RECAP_SESSION_7.md](./archive/RECAP_SESSION_7.md) (tests d'écran, correctifs d'usage).

## ▶ La prochaine étape

**Ce qui reste n'est plus du code d'écran.** Trois chantiers, par ordre de dépendance :

1. **⛔ Relecture par un tiers du contenu Savoir** (§8.2 bis) — bloquante avant publication. Les
   73 tips et les 8 fiches « Comprendre » sont sourcés un par un, **aucun n'est relu**. Le build qui
   passe ne rend pas le contenu publiable.
2. **Vérifier sur un vrai téléphone.** `npx vite build && npx vite preview --host`, puis installer.
   Le service worker et l'installation **ne s'activent qu'en build de production** — `npm run dev`
   ne les monte pas.
3. **Hébergement, puis Play.** Origine HTTPS + `/.well-known/assetlinks.json` : sans ce fichier, la
   barre d'URL ne se masque pas et Bubblewrap ne peut rien empaqueter. Hébergeur et domaine non
   choisis (STRATEGIE_DISTRIBUTION §3).

**Contenu qui reste** : photos (**0 sur 241 recettes**), lexique illustré, 27 tips pour la centaine
visée, 8 fiches sur les 60-100 de §8.2. Rien de tout cela n'est un problème de code.

## ⛔ Quatre choses laissées en plan le 2026-08-01

Trouvées en écrivant les tests d'écran, **non corrigées** faute d'être dans le périmètre demandé.
Récit complet : [archive/RECAP_SESSION_7.md](./archive/RECAP_SESSION_7.md) §2 et §5.

1. **`seed` n'est lu par aucune couche** (`semaine.tsx` → `plan-week.ts:243` → `api/index.ts:435`).
   Le champ est transporté de bout en bout et jamais consommé : **« Proposer une autre semaine » sans
   verrou peut rendre exactement le même plan** — mesuré, 0 créneau différent sur 14. C'est un bouton
   qui ne fait rien, et c'est le plus visible des quatre.
2. **`readLatestPlan` trie les id en texte** (`user-store.ts:434`). L'id est
   `plan-${startDate}-${days}` ; changer le nombre de jours sans changer de date crée une **seconde
   ligne** au lieu de remplacer la première, et `"…-7" > "…-3"` en comparaison textuelle. Un
   rechargement peut rouvrir l'ancien plan.
3. **`energieParPortion` rend `null` pour les 241 recettes** (`detail-recette.tsx:56`). Les index
   dérivés (`recipeNutrients`) ne sont construits que dans la fermeture de `createEngine` et ne sont
   jamais réexposés sur `socle.catalogue`. La fiche affiche donc **toujours** « Non renseignées »
   alors que la donnée CIQUAL existe (288,6 kcal vérifiés sur `artichauts_vinaigrette`).
4. **La visite guidée n'est pas branchée.** `ui/visite.tsx` + test existent et passent, rien ne la
   déclenche. Manquent : la **migration `user.db` 6 → 7**
   (`ALTER TABLE user_display ADD COLUMN visite_proposee INTEGER NOT NULL DEFAULT 0`, **non écrite** —
   §4 de `CLAUDE.md` exige un accord explicite), l'invitation en fin d'intro, le branchement dans
   `main.tsx`. ⚠️ Sa 3ᵉ étape cible les flèches par des **classes Tailwind**
   (`article div.flex.gap-2`) : poser un `data-visite="fleches"` dans `aujourdhui.tsx` **avant** de
   brancher, sinon l'étape disparaîtra un jour en silence.

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

## Contenu : la règle qui tient tout l'onglet Savoir

**Toute source est ouverte et lue AVANT écriture. Une source non vérifiée ⇒ le contenu n'est pas
écrit.** Elle vaut pour `catalog/tips/*.yaml` comme pour `catalog/evidence/*.md`, et c'est elle qui
a fait retirer trois affirmations déjà livrées (miel/tombes égyptiennes, oignon/réfrigérateur,
piment/matière grasse — voir [archive/RECAP_SESSION_6.md](./archive/RECAP_SESSION_6.md) §2).

- ⚠️ **Le build ne vérifie que la FORME** d'une source : présence et format http(s). Il ne saura
  jamais si la page dit ce que le texte prétend. **Aucun automatisme ne remplace la relecture.**
- ⚠️ **Beaucoup de domaines refusent la lecture automatisée** (Britannica, Smithsonian, extensions
  universitaires, EFSA Journal via Wiley : 403/402). Connaître l'URL n'est pas l'avoir lue.
- ⚠️ **Pas de fausse symétrie.** Une étude isolée face à un consensus d'autorité fabrique le doute.
  Divergences admises : méta-analyse vs méta-analyse, autorité vs autorité, position contestée
  **accompagnée de sa critique publiée**. Pas de désaccord ⇒ la fiche l'écrit.
- ⚠️ **Les tips `nutrition_humaine` sont strictement descriptifs** : « l'EFSA considère que… »,
  jamais « il faut… ». C'est ce qui garde §6.1 intact ; le lint §6.2 attrape le reste.
- ⚠️ Le lexique banni de §6.2 est **une correspondance de sous-chaîne** après retrait des accents :
  « traitement », « traité », « retraite » et « soigneusement » déclenchent tous le refus.

## Les pièges qui ne se voient pas

**Chaîne de build**

- ⚠️ **`catalog-loader.ts` et les `user-*.ts` ne doivent importer AUCUN module Node.** L'import est
  **hoisté** : un `import 'node:sqlite'` casse le bundle navigateur même si la fonction n'est jamais
  appelée. Le message de Rollup ne désigne pas la cause. Seul `vite build` l'attrape.
- ⚠️ **`vitest.config.ts` est séparé de `vite.config.ts` exprès.** Y poser `root: 'app'` a fait
  passer la suite de **572 tests à 528 sans le moindre échec**.
- ⚠️ **Hacher les NOMS de fichiers n'invalide pas un cache.** Tout ce qui vit dans `public/`
  (`catalog.db`, polices, icônes) a un nom FIXE. → hacher le CONTENU.
- ⚠️ **Un test qui écrit `app/public/catalog/catalog.db` court contre les tests d'écran**, qui le
  lisent via `ui/test-socle.ts`. `build.mjs` supprime sa sortie avant de la recréer. Tout build
  lancé depuis un test va dans un dossier temporaire (`--out`) — corrigé le 2026-08-01.

**Navigateur**

- ⚠️ **Aucun VFS OPFS de SQLite ne tourne sur le thread principal.** Les deux testent
  `createSyncAccessHandle`, `[Exposed=DedicatedWorker]` — **aucune en-tête COOP/COEP n'y change
  rien**. → base en mémoire + fichier OPFS réécrit (`user-source.ts`).
- ⚠️ **Les drapeaux ne se rendent pas sous Windows** (« FR », « IT » à la place). Normal, pas un bug.

**Moteur et données**

- ⚠️ **Un garde-fou sans source de données ne garde rien.** Le filtre allergènes a tourné sur une
  liste VIDE jusqu'à ce que l'onboarding existe. Vérifier qu'un champ déclaré est bien REMPLI.
- ⚠️ **`MealHistory.windowDays` n'est lu par AUCUNE couche.** La fenêtre de 21 jours n'existe que
  parce que `readHistory` la borne en SQL.
- ⚠️ **Une PRIMARY KEY contenant une colonne NULL ne dédoublonne pas** dans SQLite. → index UNIQUE
  sur `COALESCE(service, '')`.
- ⚠️ **`INSERT OR REPLACE` SUPPRIME la ligne avant de réinsérer**, donc déclenche les
  `ON DELETE CASCADE`. → `INSERT … ON CONFLICT DO UPDATE` dès qu'une ligne a des enfants.
- ⚠️ **Un plan relu depuis `user.db` arrive SANS ses avertissements.** Repasser par `moteur.checkPlan`.
- ⚠️ **`uniteAffichage` est un texte figé, jamais mis à l'échelle par le moteur** — et c'est voulu.
  → `ui/quantites.ts`.

**Interface**

- ⚠️ **Plus aucun menu déroulant hors de l'accueil.** Menus, filtres et réglages ouvrent une fenêtre
  (`ui/panneau.tsx`, portail vers `document.body`, bouton « ← Retour »). Un dépliant pousse vers le
  bas tout ce qui le suit ; sur la contrainte d'âge du produit, c'est le mécanisme qui fait
  abandonner. **Deux exceptions assumées** : les quatre engagements de l'accueil, et le geste
  technique dans une étape de recette — ancré à ce qu'il explique, mains dans la préparation.
- ⚠️ **Le déclencheur d'une fenêtre porte `aria-haspopup="dialog"`, jamais `aria-expanded`** :
  celui-ci décrit un contenu qui se déplie EN PLACE. Les tests lisent la **présence du dialogue**,
  pas un attribut du bouton.
- ⚠️ **`Panneau` passe par un PORTAIL** : `screen.getByText` le voit, `container.querySelector` non.
  Et un même libellé peut exister à la fois dans la fenêtre et dans l'écran dessous → cibler avec
  `within(screen.getByRole('dialog'))`.
- ⚠️ **Ne jamais afficher le score du moteur.** C'est un score de CLASSEMENT, relatif aux autres
  candidats de la même passe. Un nombre sur 100 à côté d'un nom de plat se lit comme une note
  nutritionnelle — le jugement que §6.2 interdit.

**Méthode**

- ⚠️ **Un commentaire n'est pas une garantie.** L'en-tête d'`explain.ts` affirmait qu'une couche
  « n'apparaît jamais dans un breakdown réel » ; c'est devenu faux le jour de son implémentation, et
  l'exception a traversé jusqu'à l'écran. Les tables de ce genre sont désormais **totales** — un cas
  non traité est une erreur de compilation, pas un plantage chez l'utilisateur.
- ⚠️ **Une liste recopiée ne détecte pas ce qui manque à l'original.** Les tests de gabarit
  recopiaient les libellés attendus : ils ne POUVAIENT pas voir l'entrée absente. Dériver les cas de
  la table elle-même — avec une garde contre `it.each([])`, qui ne produit aucun test et laisse la
  suite verte.
- ⚠️ **`queryByText('X')` rend `null` si le libellé réel est `← X`.** Une assertion d'absence passe
  alors POUR LA MAUVAISE RAISON. Regex obligatoire pour tout « l'élément n'est pas là ».
- ⚠️ **Un flake se diagnostique avant de se corriger.** Des échecs intermittents dans des fichiers
  différents à chaque exécution venaient de **quatre agents lançant la suite en parallèle**, pas des
  tests. Trois exécutions à vide ont tranché.
- ⚠️ **La cohérence ne dit rien de la couverture.** Le lexique avait 43 fiches, zéro référence
  cassée — et des gestes courants annotés nulle part. Un test qui vérifie une liste écrite à la main
  ne vérifie que lui-même.
- ⚠️ **Les maquettes contredisent leur propre cahier des charges.** Leur bouton principal est à
  3,95:1, sous le seuil AA, alors que le même bundle exige 7:1. Écarts mesurés en §1 DESIGN.

## Avant de coder

- ⚠️ `git status -sb` — des commits peuvent ne pas être poussés (3 en avance au 2026-08-01).
- ⚠️ **Lire la maquette de l'écran AVANT de le coder** (`maquete claude design/`).
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
| Règles d'écriture du contenu Savoir | [../catalog/tips/README.md](../catalog/tips/README.md) · [../catalog/evidence/README.md](../catalog/evidence/README.md) |
| Stores, hébergement, modèle économique | [STRATEGIE_DISTRIBUTION.md](./STRATEGIE_DISTRIBUTION.md) |
| Ce qui a été essayé **et écarté**, et pourquoi | [archive/](./archive/) |
