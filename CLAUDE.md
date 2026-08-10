# appli_nutrition — CLAUDE.md

> Point d'entrée du projet. Les règles de méthode générales (plan ≤3 bullets, stop après 2 échecs,
> jamais de commit/push sans ordre, secrets) sont dans `G:\Claude\CLAUDE.md`, chargé
> automatiquement — **ne pas les redupliquer ici**.

## Ce qu'on construit

Application de nutrition et de planification de repas, **100 % locale, sans IA, sans compte**,
utilisable sur téléphone et PC par toutes les tranches d'âge.

PWA React 19 + Vite + TypeScript · SQLite WASM sur OPFS · Tailwind + shadcn/ui · Vitest ·
Capacitor comme porte de sortie. Catalogue éditable en YAML/Markdown, compilé en `catalog.db`.

## Ce qui n'est pas négociable

Six principes, par ordre de priorité — le plus haut gagne en cas de conflit :

1. **Sécurité de l'utilisateur** — l'appli filtre et informe ; elle ne diagnostique pas.
2. **Souveraineté des données** — rien ne quitte l'appareil. Pas de compte, pas de serveur, pas de télémétrie.
3. **Traçabilité** — toute affirmation santé est rattachée à une source citée ; toute suggestion s'explique en une phrase.
4. **Déterminisme** — aucune IA générative. Le moteur est un solveur sous contraintes, auditable ligne par ligne.
5. **Hors-ligne intégral** — la connexion ne sert qu'à mettre à jour l'app et son catalogue.
6. **Informer, jamais juger** — aucun score global, aucun code couleur, aucun aliment « sain » ou « mauvais ».

**Contrainte d'architecture, verrouillée :**

```
app/src/engine/  ← TypeScript pur. N'importe JAMAIS react, sqlite, ni features/.
                    Entrées objets → sorties objets. Couverture visée ≥ 90 %.
```

Si une tâche demande d'importer quoi que ce soit d'autre dans `engine/`, c'est la tâche qui est
fausse — signale-le avant de coder.

## Vérifier — les quatre commandes qui font foi

```bash
npm test                      # vitest run
npm run typecheck             # tsc --noEmit
npx vite build                # SEUL à attraper les imports Node hoistés
npm run engine:plan-stress    # attendu : 20/20 configurations saines
```

Dernier relevé, **suite réellement exécutée le 2026-08-10, arbre COMPLET — lanes SAUCES (①②③④,
reconstruit) et MODE CUISINE (durée écoulée, entrelacement, matériel partagé) incluses** :
`npm test` → **1 953 passed / 0 failed (101 fichiers)** · typecheck propre · `vite build` ✓ (2,80 s) ·
`engine:plan-stress` **20/20** · `node catalog/build.mjs` → **451 aliments, 330 recettes,
1 548 étapes, 62 gestes, 73 tips, 8 fiches, 30 équipements (1 473 couples)** ·
`catalog/audit-mapping.mjs` → 451 mappings, 9 candidats à relire (inchangé).
⚠️ **`engine:plan-stress` est le témoin de la durée** : le mode cuisine a ajouté une durée ÉCOULÉE
(actif + repos) sans toucher la durée ACTIVE que lit le solveur. 20/20 à chacun des trois lots le
prouve. S'il bouge après un lot de cuisine, c'est que les deux durées ont été confondues.
⚠️ **UN RUN SUR QUATRE A RENDU 1 754 AU LIEU DE 1 766, VERT DANS LES DEUX CAS.** Constaté le
2026-08-08, arbre identique, aucun échec ni saut déclaré (`skipIf`/`runIf` : zéro occurrence dans le
dépôt). Les trois runs suivants, dont deux en `--reporter=json`, ont tous rendu 1 766. **Cause non
identifiée** ; piste la plus probable : plusieurs fichiers de test lancent `catalog/build.mjs` en
parallèle et un `beforeAll` qui échoue fait disparaître les tests de son fichier du total au lieu de
les compter en rouge. **Un compte qui bouge sans rouge est un signal** — si un écart réapparaît,
c'est là qu'il faut chercher, pas dans le lot du jour. ⚠️ **Ces deux nombres sont ceux du
2026-08-08 : la base est désormais 1 953.** Le symptôme à guetter est un ÉCART entre deux runs sur
le même arbre, pas une valeur particulière.
⚠️ **Un écart de compte s'attribue par `git diff --name-only`, jamais par déduction.** Le
2026-08-09, à trois sessions dans le même arbre, un « +1 » a été attribué à la mauvaise lane :
chacune voyait l'écart depuis SON relevé précédent et l'imputait par défaut à sa voisine. Personne
n'avait menti ni mal compté.
⚠️ **Un relevé se prend sur l'arbre qu'on commite, pas sur celui d'où l'on est parti.** Le
2026-08-07, trois documents annonçaient 1 647 tests pendant que l'arbre en contenait 22 de plus :
ils avaient été mis à jour dans le même lot que le code qu'ils ne comptaient pas encore.
✅ **LE DERNIER SIGNAL DU BANC EST ÉTEINT** (lot « 8 plats végétaliens sans gluten ») — « végétalien
+ sans gluten » passe de **27/28 à 28/28 accompagnements**, plancher 1 302 → 1 530 kcal. La cause
mesurée n'était pas « il manque 1 plat » mais **marge zéro** : le catalogue portait exactement
28 plats végétaliens ET sans gluten utilisables au déjeuner ou au dîner pour exactement 28 créneaux,
si bien qu'une seule exclusion par une autre contrainte suffisait à vider un créneau. Ils sont **36**.
⚠️ **Une cinquième commande, qu'aucun test ne remplacera** : `node catalog/audit-mapping.mjs`, à
lancer À LA MAIN après chaque lot de contenu et **uniquement dans le dépôt principal** —
`documents Ciqual/` est gitignoré, donc absent de tout worktree.
✅ **LES 2 ÉCHECS D'`aujourdhui.test.tsx` SONT FERMÉS** (`70e2493`) — quatre tests pariaient sur la
taille du catalogue, un lot de contenu les a cassés. **La suite est verte en entier.** Ne pas
recopier d'ancienne mention « 2 failed » : elle a survécu deux jours de plus que le défaut.
⚠️ **Piège de relevé** : `npm test 2>&1 | tail -25` rend le code de sortie du **pipe**, donc 0. Lire
le compte `Tests N failed`, jamais `$?`.
⚠️ Ce compte bougera : **la sortie réelle fait foi, pas cette ligne.**

**Une tâche n'est finie que quand ces quatre-là sont verts et que la sortie est collée dans la
réponse.** Pas « ça devrait passer ». La sortie, ou ce n'est pas fini.

Autres commandes utiles : `npm run build` (catalogue), `npm run dev`, `npm run engine:try`,
`engine:plan`, `engine:couverture`, `engine:similarity`, `catalog:list` — et
`engine:calibrate-lambda`, **le banc qui a fixé λ** (0,4 → 0,3 le 2026-08-07). ⚠️ Ne pas redéplacer
`DEFAULT_MMR_LAMBDA` sans le rejouer : c'était le dernier nombre du moteur posé au jugé, il ne doit
pas y retourner.

## Où est quoi

`docs/README.md` est l'index complet. En raccourci :

| Besoin | Fichier |
|---|---|
| Reprendre à froid | `docs/FICHE_REPRISE.md` |
| État détaillé, décisions figées/ouvertes, dette | `docs/ETAT.md` |
| Le moteur : couches, contrats, algorithmes, API | `docs/ENGINE.md` (index) → `docs/reference/ENGINE_*.md` (8 parties) |
| **Pièges de build/navigateur/moteur, règle de sourçage, impasses déjà payées** | `docs/reference/PIEGES.md` |
| Périmètre, données, cadre santé et réglementaire | `docs/ARCHITECTURE.md` |
| Écrans, navigation, jetons visuels | `docs/DESIGN.md` |
| Instantanés datés — **ne jamais réécrire, ne jamais citer comme état** | `docs/archive/` |

**Ordre d'autorité en cas de contradiction : le code fait foi, puis `ENGINE.md` sur le moteur,
puis `ARCHITECTURE.md` sur le reste.** Une contradiction se corrige dans le document, jamais
contournée dans le code.

**Règle d'unicité : chaque fait vit à un seul endroit.** Un fait d'état va dans `ETAT.md`, pas
dans la fiche de reprise. Une décision tranchée va dans `ETAT.md` §3, ouverte dans §4.

## Les cinq acquis à ne pas défaire

1. **`habit` ne compte que les entrées `choisi`** (un reste n'est pas une préférence), **`variety`
   lit toutes les origines** (un reste lasse quand même). Asymétrie volontaire, verrouillée par test.
2. **`requiredFoodIds` vit dans `MealContext`, pas dans `HardConstraints`** — pour rendre l'exigence
   structurellement inexprimable dans un plan de semaine. La garantie vient de la forme.
3. **Une couche qui ne discrimine pas n'est jamais citée** dans une explication.
4. **Deux espaces de signature, à ne pas fusionner** : `recipeSignature` (brut) sert la SIMILARITÉ,
   `recipeFamilySignature` (replié par sous-famille) sert la RÉCENCE.
5. **Une recette déclare UN SEUL régime**, le plus restrictif qu'elle respecte. **L'origine animale
   est un fait, pas un régime** : `Food.origineAnimale` + `deriveDe`, propagés en cascade.

## Les pièges qui ont déjà coûté

Liste complète dans **`docs/reference/PIEGES.md`**. Les plus chers :

- **`catalog-loader.ts` et les `user-*.ts` n'importent AUCUN module Node.** L'import est hoisté :
  un `import 'node:sqlite'` casse le bundle même si la fonction n'est jamais appelée. Seul
  `vite build` l'attrape, et le message de Rollup ne désigne pas la cause.
- **`vitest.config.ts` est séparé de `vite.config.ts` exprès.** Y poser `root: 'app'` a fait passer
  la suite de **572 tests à 528 sans le moindre échec**. Un compte de tests qui baisse sans rouge
  est un signal, pas un hasard.
- **Un champ déclaré n'est pas un champ branché — trois occurrences déjà payées.** Avant de conclure
  qu'il ne manque que de l'affichage, vérifier que le champ est **rempli** ET **lu**. Un appelant qui
  omet une option optionnelle ne produit aucune erreur : ni au type, ni au test, ni à l'écran.
- **Ne jamais afficher le score du moteur.** C'est un score de classement relatif à la passe. Un
  nombre sur 100 à côté d'un plat se lit comme une note nutritionnelle — le jugement interdit par le
  principe 6.
- **Plus aucun menu déroulant hors de l'accueil.** Menus, filtres et réglages ouvrent une fenêtre
  (`ui/panneau.tsx`, portail vers `document.body`). Le déclencheur porte `aria-haspopup="dialog"`,
  jamais `aria-expanded`. Les tests lisent la présence du dialogue, pas un attribut du bouton.
- **`Panneau` passe par un portail** : `screen.getByText` le voit, `container.querySelector` non.
  Cibler avec `within(screen.getByRole('dialog'))`.
- **Aucun VFS OPFS de SQLite ne tourne sur le thread principal.** Aucune en-tête COOP/COEP n'y change
  rien. → base en mémoire + fichier OPFS réécrit (`user-source.ts`).
- **`INSERT OR REPLACE` supprime la ligne avant de réinsérer** et déclenche les `ON DELETE CASCADE`.
  → `INSERT … ON CONFLICT DO UPDATE` dès qu'une ligne a des enfants.
- **Le classement est « reproductible à graine égale », pas « déterministe ».** Ne pas réécrire
  l'en-tête dans l'autre sens.

## Délégation

**La table de routage et les règles de délégation vivent dans `~/.claude/CLAUDE.md` §6 — ne pas
les redupliquer ici.** Les définitions d'agents sont dans `G:\Claude\.claude\agents\`,
chargées par remontée d'arborescence.

Spécifique à ce projet : `testeur` lit la section « Vérifier » ci-dessus et lance ces commandes
**telles quelles** — les quatre, `npx vite build` compris. Il n'improvise pas d'équivalent.

## Avant de dire que c'est fini

- Les quatre commandes sont vertes **et leur sortie est collée**.
- Rien hors du périmètre de la tâche n'a changé.
- Si un document et le code divergent : corriger le document, et le dire dans le message de commit.
- Si tu as dû rediscuter une décision de `ETAT.md` §3 : t'arrêter et demander, pas trancher seul.
