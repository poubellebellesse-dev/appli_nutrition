# appli_nutrition — CLAUDE.md

> Point d'entrée du projet. Les règles de méthode générales (plan ≤3 bullets, stop après 2 échecs,
> jamais de commit/push sans ordre, secrets) sont dans `F:\Claude\CLAUDE.md`, chargé
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

⛔ **Dernier relevé (2026-09-30 à 19 h 41, arbre complet, livraison du `lot-J`, NON commité) : 2 706 passed / 1 failed (2 707 tests, 142 fichiers)** en 598,79 s · le rouge est encore `retour-8` clause 4 « semis » (timeout 15 s sous charge), vert seul à 19 h 51 (43/43, 53,69 s) · typecheck propre (19 h 52) · `vite build` ✓ 6,09 s (19 h 52) · `engine:plan-stress` 20/20 (19 h 53) · **écart +17 tests et +1 fichier = `tests/scelles/lot-J.test.tsx`** (17 tests), attribué par `git status` · `USER_SCHEMA_VERSION` inchangé.
⛔ **Relevé précédent (2026-09-26 à 15 h 28, arbre complet, livraison du `lot-I`, commité en `6c60e5a`) : 2 689 passed / 1 failed (2 690 tests, 141 fichiers)** en 570,67 s, + 1 erreur `Timeout calling "onTaskUpdate"` · le rouge est
`retour-8` clause 4 « semis » à 15,2 s pour un plafond de 15 s, **déjà rouge à 13 h 33 avant tout code
du lot**, vert seul (43/43, 10,8 s à 15 h 39) ; une suite de 15 h 05 était à 2 690 / 0 failed · typecheck
propre (15 h 38) · `vite build` ✓ 7,10 s (15 h 38) · `engine:plan-stress` 20/20 (15 h 39) ·
**l'écart avec le relevé précédent (2 693 sur 140, 2026-09-19, `c22f03c`) est −3 tests et +1
fichier** : +11 `tests/scelles/lot-I.test.tsx`, −14 `parcours.test.tsx` (deux étapes de tutoriel
retirées, présentes dans deux parcours), attribué par `vitest list` contre HEAD · ⚠️ **les suites du
2026-09-26 durent 560-645 s contre 161 s le 2026-09-19, dès avant le lot : machine chargée, cause non
établie** · relevé du 2026-09-19 : 2 693 / 0 en 160,93 s · ⚠️ **LA DURÉE DE LA SUITE N'EST PAS ATTRIBUABLE À SON CONTENU À ±20 s PRÈS, ET C'EST
MESURÉ** : le même arbre, augmenté de trois sondes temporaires (143 fichiers, 2 698 tests), a rendu
**140,19 s** trois heures plus tôt, soit **plus de tests en moins de temps**. Ne pas lire une
variation de cet ordre comme un coût de lot. Ce qui reste vrai et attribué : `lot-E.test.tsx` prend
**137,5 s** à lui seul (mesuré au même run), parce que son balayage monte les **deux** écrans de
chacune des 339 recettes ; `lot-H.test.tsx` mesure par le module et ne monte que **2** recettes,
pour **1,3 s** · catalogue non touché depuis le relevé
du 2026-09-09 (339 recettes, **dîner 250** dont 44 froides — non remesuré). `USER_SCHEMA_VERSION` = **21** (le réglage « Afficher les explications », `ALTER TABLE … ADD COLUMN`, forme de la v4). ⚠️ **SQLite valide le `CHECK` d'un `ADD COLUMN` contre les lignes EXISTANTES** — la forme
de la v9 ne se recopie pas pour une équivalence.
⛔ **L'HEURE FAIT PARTIE DU RELEVÉ SUR CE PROJET.** **Arbre entièrement vert.**
⭐ **LE LOT B A OUVERT 42 ROUGES DANS TROIS FICHIERS SCELLÉS, ET ILS SONT FERMÉS** (2026-09-14, sceau
levé puis remis). `retour-1` (8), `retour-5d` (8) et `retour-6` (26) ouvraient l'encart d'envie en
attendant « Rien n'est obligatoire… », que le lot B éteint : ils mouraient dans leur `ouvrirEncart()`
avant de mesurer quoi que ce soit. Repère devenu « Combien de temps devant vous ? » — structurel,
sous aucun interrupteur. ⚠️ **Une phrase que l'on retire peut être la POIGNÉE dont un autre test se
sert pour ouvrir l'écran.** Avant de masquer un texte, chercher qui le lit comme repère.
⚠️ **`retour-5c` photographie `retour-1` : son empreinte a été rebasée** (`8806528362af02e5` →
`31c347329503e523`), le compte de lignes restant à **324** — c'est lui, pas le sha, qui atteste que
l'édition s'est arrêtée à deux lignes.
⭐ **`retour-1` « au moins 6 plats sur 10 » EST VERTE, ET DEUX CAUSES DISTINCTES ONT ÉTÉ PAYÉES
POUR ÇA.** (1) **Le rayon était vide** : le dîner ne portait que **8 recettes froides sur 214
(3,7 %)** contre 44 sur 194 au déjeuner, et le moteur en remontait 7 sur 8 ; `retour-5e` y a fait
entrer les 36 froides que `types_repas` en barrait → **250 recettes, 44 froides (17,6 %)**.
(2) **Le test lisait l'horloge de la machine** — `retour-5d` le lui a retiré : il épingle sa pastille
de créneau par `aria-pressed`, fige l'horloge et vérifie le titre affiché. Il mesure désormais les
**deux** repas : **12/12 froides à midi comme le soir**, plancher scellé à **0,9**.
⚠️ **CE QUI RESTE VRAI, ET QU'IL NE FAUT PAS LIRE COMME UN DÉFAUT** : l'**écran de production** déduit
toujours son créneau de `new Date().getHours()` (bascule à **14 h**, `FIN_DE_CRENEAU.dejeuner`). C'est
le comportement voulu d'un écran ouvert sans qu'on ait rien choisi, et une clause de `retour-5d` le
garde **sous témoin exécuté**. Décision **82 FERMÉE le 2026-09-09**.
⚠️ **Les relevés d'août et du matin du 2026-09-09 attribuaient la bascule à la croissance du
catalogue** (330 → 339) : ils comparaient deux heures sans le savoir. Ne pas les citer comme cause.
✅ Les **10** rouges de compteur qui scellaient le nombre absolu de recettes sont éteints par
`retour-5c` (11 valeurs dans 6 fichiers scellés, 2026-09-09). La sortie réelle fait foi.
- **Un compte qui bouge sans rouge est un signal.** Attribuer par `git diff --name-only` **et** par
  les fichiers de test pilotés par la donnée (`parcours.test.tsx` est en `it.each` sur `PARCOURS`).
  Seule la sortie de vitest compte, jamais un `grep "it("`.
- `npm test 2>&1 | tail -25` rend le code de sortie du **pipe**. Lire `Tests N failed`, jamais `$?`.
- Cinquième commande, à la main : `node catalog/audit-mapping.mjs`. ⛔ **Elle ne tourne plus nulle
  part au 2026-09-09** — `documents Ciqual/2025_11_03` est gitignoré et absent **aussi du dépôt
  principal**. Le dire, ne pas l'annoncer verte.
- Historique des relevés et des pièges d'août : `docs/archive/CLAUDE_releves_2026-08.md`.

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
| État (≤200 lignes), écrans, dette des lots | `docs/ETAT.md` |
| Décisions figées (par thème) et questions numérotées | `docs/decisions/` (`README.md`, `registre.md`) |
| Registre des défauts P-nn | `docs/PROBLEMES.md` |
| Le moteur : couches, contrats, algorithmes, API | `docs/ENGINE.md` (index) → `docs/reference/ENGINE_*.md` (8 parties) |
| **Pièges de build/navigateur/moteur, règle de sourçage, impasses déjà payées** | `docs/reference/PIEGES.md` |
| Périmètre, données, cadre santé et réglementaire | `docs/ARCHITECTURE.md` |
| Écrans, navigation, jetons visuels | `docs/DESIGN.md` |
| Instantanés datés — **ne jamais réécrire, ne jamais citer comme état** | `docs/archive/` |

**Ordre d'autorité en cas de contradiction : le code fait foi, puis `ENGINE.md` sur le moteur,
puis `ARCHITECTURE.md` sur le reste.** Une contradiction se corrige dans le document, jamais
contournée dans le code.

**Règle d'unicité : chaque fait vit à un seul endroit.** Un fait d'état va dans `ETAT.md`, pas
dans la fiche de reprise. Une décision tranchée va dans `docs/decisions/<thème>.md`, ouverte dans `docs/decisions/registre.md`.

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

## Avant de dire que c'est fini

- Les quatre commandes sont vertes **et leur sortie est collée**.
- Rien hors du périmètre de la tâche n'a changé.
- Si un document et le code divergent : corriger le document, et le dire dans le message de commit.
- Si tu as dû rediscuter une décision de `docs/decisions/` : t'arrêter et demander, pas trancher seul.

## Garde, cycle, délégation, terminaux

@../REGLES-COMMUNES.md

Spécifique à ce projet — ce que la garde (`.claude/hooks/garde.mjs`) refuse :

| Ce qui est refusé | Pourquoi |
|---|---|
| écrire dans `docs/archive/` | instantanés datés. On ne les réécrit jamais. |
| écrire dans `tests/scelles/` quand un lot est scellé | écrits **avant** le code, depuis le « Fini quand », contre `catalog.db` réel et jamais contre une fixture. |
| toucher à `app/src/` ou `catalog/` sans lot ouvert | le « Fini quand » s'écrit **avant**. |

`testeur` lance **les quatre commandes**, `npx vite build` compris ; la garde les exige toutes.
`ARCHITECTURE.md` (83 Ko), `PIEGES.md` (55 Ko), `decisions/04-design.md` : jamais en entier — `chercheur`. `ETAT.md` tient en 200 lignes depuis le 2026-09-08 : se lit en entier.
