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

Dernier relevé, **suite réellement exécutée le 2026-08-20, arbre COMPLET, commit `4a9f373`
(livraison du lot 65c)** :
`npm test` → **2 254 passed / 0 failed (122 fichiers)** en 44,3 s · typecheck propre ·
`vite build` ✓ (2,98 s) · `engine:plan-stress` **20/20**.
✅ **LES CINQ COMMANDES ONT ÉTÉ RELANCÉES LE 2026-08-20**, catalogue compris — le lot 65c a touché
au détecteur d'occupation. **451 aliments, 330 recettes, 1 548 étapes, 62 gestes, 73 tips, 8 fiches,
30 équipements (1 473 couples)** et **451 mappings / 9 candidats à relire** : inchangés, et cette
fois **mesurés**, pas déduits d'une absence de cause.
⛔ **CE QUI A CHANGÉ AU CATALOGUE, C'EST L'OCCUPATION D'USTENSILE** : `recipe_step_equipment` passe
de 92 à **377 occupations sur 228 recettes** — la plaque de cuisson en apporte **285 sur 166**, elle
qui n'en avait aucune. C'est le lot 65c, et c'est attendu.
✅ **L'ARBRE EST VERT EN ENTIER — les 6 rouges de la lane média sont éteints.** Ils vivaient dans
`tests/scelles/gestes-champ-media.test.ts` (7 tests), écrits AVANT leur code, donc rouges par
construction, exactement comme la méthode l'exige ; le **lot geste 1 les a fermés le 2026-08-16**.
⚠️ **L'ÉCART 2 156 → 2 238 COUVRE TROIS LOTS, PAS UN** (photo 3, 66c, 65b) : le relevé précédent
datait du 08-16 et trois lots ont été livrés depuis. Attribué fichier par fichier, jamais déduit —
**+74 dans 7 fichiers scellés neufs** (13 · 5 · 7 · 7 · 8 · 23 · 11) et **+8 dans 4 fichiers
ordinaires modifiés** ; total 82, et 114 → 121 fichiers pour les mêmes 7.
⚠️ **COMPTER LES TESTS AU `grep` SOUS-ESTIME, ET LE PIÈGE A FAILLI PASSER** : sur
`photo-fiche-detail`, `grep -c "it("` rend **8** là où vitest en exécute **23**. Un écart attribué
au grep se serait déclaré incomplet à tort. **Seule la sortie de vitest compte.**
⚠️ **`node catalog/build.mjs` sort une alerte qui n'est de personne aujourd'hui** : fiche
`calcium-fractures`, source `critique-zhao-2018` **sans auteurs vérifiés**. C'est du contenu Savoir
— elle tombe avec la relecture par un tiers, pas avec un lot de code.
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
2026-08-08 : la base est désormais 2 238.** Le symptôme à guetter est un ÉCART entre deux runs sur
le même arbre, pas une valeur particulière. ⚠️ **Aucun écart n'a été revu depuis** — quatre runs
complets le 2026-08-11, puis deux le 2026-08-14 à 40 min d'intervalle, ont tous rendu le même
compte. Ne pas conclure que la cause est morte : elle n'a jamais été identifiée, seulement pas
réapparue.
⚠️ **Un écart de compte s'attribue par `git diff --name-only`, jamais par déduction.** Le
2026-08-09, à trois sessions dans le même arbre, un « +1 » a été attribué à la mauvaise lane :
chacune voyait l'écart depuis SON relevé précédent et l'imputait par défaut à sa voisine. Personne
n'avait menti ni mal compté.
⚠️ **Un relevé se prend sur l'arbre qu'on commite, pas sur celui d'où l'on est parti.** Le
2026-08-07, trois documents annonçaient 1 647 tests pendant que l'arbre en contenait 22 de plus :
ils avaient été mis à jour dans le même lot que le code qu'ils ne comptaient pas encore.
⚠️ **Une cinquième commande, qu'aucun test ne remplacera** : `node catalog/audit-mapping.mjs`, à
lancer À LA MAIN après chaque lot de contenu et **uniquement dans le dépôt principal** —
`documents Ciqual/` est gitignoré, donc absent de tout worktree.
⚠️ **Piège de relevé** : `npm test 2>&1 | tail -25` rend le code de sortie du **pipe**, donc 0. Lire
le compte `Tests N failed`, jamais `$?`.
⚠️ Ce compte bougera : **la sortie réelle fait foi, pas cette ligne.**
📦 **Deux alertes fermées ont été retirées d'ici le 2026-08-14** — le plancher « végétalien + sans
gluten » (28/28, marge portée de 0 à 8 plats) et les 2 échecs d'`aujourdhui.test.tsx` (`70e2493`).
Elles annonçaient un défaut qui n'existe plus. ▶ Le récit est dans
`docs/archive/RECAP_SESSION_2026-08-14_invariant-origine-animale.md` §Ménage.

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

## Les six acquis à ne pas défaire

1. **`habit` ne compte que les entrées `choisi`** (un reste n'est pas une préférence), **`variety`
   lit toutes les origines** (un reste lasse quand même). Asymétrie volontaire, verrouillée par test.
2. **`requiredFoodIds` vit dans `MealContext`, pas dans `HardConstraints`** — pour rendre l'exigence
   structurellement inexprimable dans un plan de semaine. La garantie vient de la forme.
3. **Une couche qui ne discrimine pas n'est jamais citée** dans une explication.
4. **Deux espaces de signature, à ne pas fusionner** : `recipeSignature` (brut) sert la SIMILARITÉ,
   `recipeFamilySignature` (replié par sous-famille) sert la RÉCENCE.
5. **Une recette déclare UN SEUL régime**, le plus restrictif qu'elle respecte. **L'origine animale
   est un fait, pas un régime** : `Food.origineAnimale` + `deriveDe`, propagés en cascade.
6. **L'origine animale est une PAIRE indivisible ou rien** (lots 66/66b) : `origineAnimale` vaut
   `{ origine, provenance }` ou `null`, jamais une moitié. La garantie vient de la **forme**, pas
   d'une validation — un seul constructeur, `venantDe`, production comprise. ⛔ Ne pas rendre l'un
   des deux champs optionnel ni nullable, ne pas élargir en `AnimalOrigin | AnimalSource` : chacune
   de ces « compatibilités » rouvre le trou, et `tests/scelles/sondes-66/` existe pour les refuser.
   ⚠️ **Trois cases sur quatre sont verrouillées ; « origine optionnelle » ne l'est pas encore** —
   mesuré, `ETAT.md` §8, lot 66c.

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

## La mécanique — ce qui applique les règles ci-dessus

Tout ce qui précède était de la prose : une consigne qu'un modèle suit quand il y pense.
`.claude/hooks/garde.mjs` la rend exécutable. Trois refus, et rien d'autre.

| Ce qui est refusé | Pourquoi |
|---|---|
| écrire dans `docs/archive/` | ce sont des instantanés datés. On ne les réécrit jamais. |
| écrire dans `tests/scelles/` quand un lot est scellé | les tests ont été écrits **avant** le code, depuis le « Fini quand ». Les corriger pour les faire passer, c'est truquer l'examen. |
| toucher à `app/src/` ou `catalog/` sans lot ouvert | le « Fini quand » s'écrit **avant**. C'est ce qui supprime les allers-retours. |
| conclure sans avoir relancé les **quatre commandes** depuis la dernière modification | « ça devrait passer » n'est pas une mesure. La garde les exige toutes les quatre, pas seulement `npm test`. |

**Le cycle, quatre commandes :**

```
/brief D2     → « Fini quand » + tests scellés + sceau, AVANT la première ligne de code
   … code …
/fin          → rapport court, sans jargon, une seule décision demandée
/libre        → coupe la garde (et dis pourquoi)   /strict → la rallume
```

En cas d'erreur interne, la garde **laisse passer**. Elle ne bloquera jamais un travail
légitime par accident — mais elle ne rattrapera pas tout non plus.

**Les tests scellés vivent dans `tests/scelles/`.** Écrits depuis le « Fini quand », contre
`catalog.db` réel et jamais contre une fixture, et ils doivent **échouer le jour où on les
écrit**. Un test d'acceptation qui passe avant que le code existe ne prouve rien.

⚠️ La garde ne remplace pas `node catalog/audit-mapping.mjs` — cinquième commande, à la main,
dépôt principal uniquement (`documents Ciqual/` est gitignoré, donc absent des worktrees).

## Plusieurs terminaux en parallèle

**Un terminal qui écrit = un worktree.** Deux sessions dans le même arbre, c'est exactement
le défaut du 2026-08-09 : un « +1 » attribué à la mauvaise lane, chacune voyant l'écart
depuis SON relevé. Personne n'avait menti ni mal compté.

```bash
git worktree add ../wt-<lot> -b lot/<lot>     # un par terminal qui code
```

Le terminal **planificateur ne code pas** : il lit, il écrit des documents de conception,
il reste sur l'arbre principal. Les merges se font **un par un**, jamais en parallèle, et
les quatre commandes sont relancées sur l'arbre principal **après chaque merge** — un lot
vert seul n'est pas un lot vert ensemble.

## Un seul terminal, qui délègue

Si tu ne veux tenir qu'une session : garde-la comme **unique écrivain** et sous-traite le
reste. La règle ne change pas — plusieurs agents peuvent lire, chercher, critiquer, mesurer ;
**un seul écrit**. Deux sous-agents qui éditent en parallèle partagent le même arbre et ne se
voient pas : c'est pire que deux terminaux, il n'y a même pas de worktree pour les séparer.

**Délègue systématiquement, c'est du contexte sauvé, pas du temps gagné :**

| Quand | À qui | Pourquoi |
|---|---|---|
| avant de lire un document de plus de 30 Ko | `chercheur` / `Explore` | `ETAT.md` fait 300 Ko, `ARCHITECTURE.md` 83 Ko, `PIEGES.md` 55 Ko. Les ouvrir en entier tue la session. Demande la réponse, pas le fichier. |
| lancer les quatre commandes | `testeur` | tu veux le verdict et les échecs, pas 2 124 lignes de vitest. |
| relire le lot avant `/fin` | `relecteur`, `critique` | un regard qui n'a pas écrit le code. |
| écrire le bilan de fin de lot | `rapporteur` | **un agent qui note sa propre copie se met toujours une bonne note.** |

Le **codeur, c'est toi** — la session principale. Tu ne délègues pas l'écriture du code : tu
perdrais le fil du lot pour ne gagner que du parallélisme dont tu n'as pas besoin.

⚠️ **Un nom d'agent sans fichier ne produit aucune erreur** : la délégation retombe
silencieusement sur la session principale, au prix fort. Vérifier avec `@` — l'autocomplétion
ne propose que les agents réellement découverts.

La garde (`.claude/hooks/garde.mjs`) s'applique **aussi aux sous-agents** : un sous-agent ne
peut pas écrire dans `docs/archive/` ni dans un test scellé.
