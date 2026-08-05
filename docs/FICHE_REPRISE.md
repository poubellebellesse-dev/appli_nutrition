# ⭐ Fiche de reprise — appli_nutrition

> **Une page, jamais plus.** État vérifié + prochaine étape, rien d'autre.
> Avancement détaillé, décisions et dette : [ETAT.md](./ETAT.md) · Index : [README.md](./README.md).
> Font foi : [ENGINE.md](./ENGINE.md) (moteur), [ARCHITECTURE.md](./ARCHITECTURE.md) (le reste).
> *Allégée le 2026-08-03 : 341 → ~95 lignes. Rien n'a été perdu — voir « Où chercher le reste ».*

## Le projet

Planificateur de repas **100 % local, sans IA, sans compte**. Moteur TypeScript pur, catalogue
SQLite construit au build, PWA React servie en statique.

## Où on en est

```
MOTEUR ✅ ─ CONTENU ✅ ─ user.db ✅ ─ DESIGN ✅ ─ 9 ÉCRANS ✅ ─ TESTS D'ÉCRAN ✅ ─▶ CONTENU & DISTRIBUTION ▓▓
                                                                                          ⬅ ICI
```

**Suite exécutée le 2026-08-03** : `npm test` → **1 253 passed (77 fichiers)** en 33,9 s ·
`npm run typecheck` propre · `node catalog/build.mjs` → **200 aliments, 241 recettes, 62 gestes,
73 tips, 8 fiches (33 positions)**. ✅ **Les ~25 fichiers non committés passent avec.**
*(Le relevé de la session 12 annonçait 1 249 / 76 : 4 tests et 1 fichier de retard.)*

**L'application fait sa boucle complète** : s'installer → déclarer ses allergies → voir une
suggestion → planifier sa semaine → sortir sa liste de courses → cuisiner. Plus « partir de ce
qu'on a », un lexique de 62 gestes, et l'onglet Savoir complet.

⚠️ **`git status -sb` donne l'état, jamais cette page** : un nombre écrit ici est faux dès le commit
suivant, et faux dans l'autre sens dès le `push`. Au 2026-08-02, rien n'attendait d'être poussé — et
c'est déjà peut-être faux. Restent **~25 fichiers modifiés + 8 nouveaux, non committés** (mesuré le 2026-08-03) : 18 recettes
de la vérification sanitaire, `ui/main.tsx`, `ui/theme.css`, `catalog-loader.test.ts`, `DESIGN.md`,
`SOURCES_RECETTES.md`. ⚠️ `git status` seul en annonce 136 — l'écart est du **bruit de fin de
ligne**, pas du travail : voir [reference/PIEGES.md](./reference/PIEGES.md). **Vert et cohérent** —
`npm test`, `typecheck` et `build.mjs` passent avec —, mais encore en cours : ne pas le commiter
sans son auteur.
**Claude committe, l'utilisateur pousse** — le shell agent ne peut pas s'authentifier auprès de
GitHub.

⚠️ **Trois pistes ont travaillé en parallèle sur la période 2026-07-31 → 2026-08-01**, dans trois
conversations séparées. Pour comprendre ce qui s'est passé, il faut lire les TROIS récits :
[archive/RECAP_SESSION_6.md](./archive/RECAP_SESSION_6.md) (contenu de Savoir),
[archive/RECAP_SESSION_7.md](./archive/RECAP_SESSION_7.md) (tests d'écran, correctifs d'usage) et
[archive/RECAP_SESSION_8.md](./archive/RECAP_SESSION_8.md) (revue design & accessibilité, décisions
photo obligatoire et Capacitor).

## ▶ La prochaine étape

✅ **La régression de plancher calorique du 2026-08-03 est CORRIGÉE le 2026-08-04** (décisions 53
et 54 d'`ETAT.md` §4). Cause : `planWeek` posait des PLATS là où `checkCalorieFloor` mesure une
JOURNÉE — la comparaison n'a jamais été homogène. Le planificateur pose désormais un accompagnement
en plus du plat aux repas principaux. Mesuré sur 20 graines × 7 jours (`npm run engine:plancher`) :
**min 813 → 1 302 kcal, médiane 1 023 → 1 528, et 0/20 → 20/20 semaines sans aucun avertissement**.

✅ **La décision 45 est tranchée le 2026-08-04 : on reste sur l'alerte MASQUÉE par défaut.** Ce n'est
plus une prémisse fausse mais un choix assumé et daté, ce que §6.5 ARCHITECTURE demandait. Ne pas
rouvrir sans élément neuf.

▶ **LE CHANTIER SUIVANT, ET IL EST DE CONTENU.** Le banc rend encore **5 avertissements en
végétalien 14 j et 9 en « végétalien + sans gluten »** : ces régimes n'ont pas assez
d'accompagnements (18 posés sur 28 attendus, 11 sur 56). **Écrire des accompagnements végétaliens et
sans gluten fait tomber ces deux chiffres**, et c'est la seule chose qui les fera tomber — aucun
réglage du moteur n'invente du contenu. Chantier en cours côté utilisateur.

**Ce qui reste n'est plus du code d'écran.** Trois chantiers, par ordre de dépendance :

1. **⛔ Relecture par un tiers du contenu Savoir** (§8.2 bis) — bloquante avant publication. Les
   73 tips et les 8 fiches « Comprendre » sont sourcés un par un, **aucun n'est relu**. Le build qui
   passe ne rend pas le contenu publiable.
2. **Vérifier sur un vrai téléphone.** `npx vite build && npx vite preview --host`, puis installer.
   Le service worker et l'installation **ne s'activent qu'en build de production** — `npm run dev`
   ne les monte pas. ⚠️ **Essai partiel le 2026-08-05, dans Chrome et NON dans la WebView**
   (`CONCEPTION_MODE_CUISINE.md` §7) : audio validé, vibration morte, **pari `rem` à 150 % NON
   MESURÉ** — le seul dont l'échec toucherait les neuf écrans. `http://` casse `wakeLock`.
3. **Empaquetage Capacitor, puis Play.** ⚠️ **La cible n'est plus TWA/Bubblewrap** — décision du
   2026-08-01, `archive/RECAP_SESSION_8.md` §3. `capacitor.config.ts` et `@capacitor/*` sont en
   place ; `npx cap add android` n'a jamais été lancé (pas de SDK sur la machine). **Ni origine
   HTTPS ni `/.well-known/assetlinks.json` ne sont requis** pour cette cible. Une version web reste
   utile — c'est le seul chemin vers un iPhone tant qu'il n'y a pas de Mac (§4 décision 9).

**Contenu qui reste** : **photos (0 sur 241 recettes — désormais OBLIGATOIRES, production en cours
côté utilisateur)**, lexique illustré, 27 tips pour la centaine visée, 8 fiches sur les 60-100 de
§8.2. Rien de tout cela n'est un problème de code.

▶ **LE MODE CUISINE EST EN COURS** (décision 8 fermée le 2026-08-04). Spec : `ARCHITECTURE.md`
§5bis · lots : **[CONCEPTION_MODE_CUISINE.md](./CONCEPTION_MODE_CUISINE.md)**. ✅ **L0 fait le
2026-08-05** — `recipe_step.nature`, 18 recettes, deux règles rouges au build. ▶ **Au suivant :
L1**, l'écran, qui n'attend PAS les 1 101 annotations du prérequis A. Motif : **512 minuteurs
buildés, chargés, affichés nulle part.**

✅ **La vérification sanitaire des recettes est terminée** (2026-08-03) : viandes et volailles
(§5 bis), poissons, œufs et coquillages (§5 quater), puis crus et œufs peu cuits (§5 quinquies —
**18 recettes** portent la mention des populations sensibles, sourcée ANSES et ministère de
l'Agriculture). ⚠️ **Deux trous restent déclarés, non comblés** : les céphalopodes (`calamar`,
`poulpe`), et le critère de cuisson de l'œuf qu'aucune autorité lue ne donne.


## Ce qu'il ne faut pas refaire

Trois impasses déjà payées — sources de recettes déjà écartées licence par licence, substitutions
qui ont rendu zéro couple deux fois, conséquences non traitées de la décision Capacitor — plus les
pièges de build, de navigateur, de moteur et d'interface, et la règle de sourçage du contenu Savoir :
➡️ **[reference/PIEGES.md](./reference/PIEGES.md)**. À ouvrir avant de rouvrir un de ces chantiers.

## Les invariants

Les **cinq acquis à ne pas défaire** vivent dans **[../CLAUDE.md](../CLAUDE.md)**, chargé
automatiquement à chaque session. Plus recopiés ici : un fait, un seul endroit.

## Où chercher le reste

| Question | Document |
|---|---|
| Avancement, **écrans un par un**, décisions, **dette connue** (§8) | [ETAT.md](./ETAT.md) |
| Comment marche une couche, un algorithme, l'API | [ENGINE.md](./ENGINE.md) |
| Périmètre produit, données, cadre légal | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Écrans, jetons visuels, badge de preuve | [DESIGN.md](./DESIGN.md) |
| Règles d'écriture du contenu Savoir | [../catalog/tips/README.md](../catalog/tips/README.md) · [../catalog/evidence/README.md](../catalog/evidence/README.md) |
| Stores, hébergement, modèle économique | [STRATEGIE_DISTRIBUTION.md](./STRATEGIE_DISTRIBUTION.md) |
| **Mode cuisine** : ordre des lots, prérequis, essai sur appareil | [CONCEPTION_MODE_CUISINE.md](./CONCEPTION_MODE_CUISINE.md) |
| Ce qui a été essayé **et écarté**, et pourquoi | [archive/](./archive/) |
| **Pièges, impasses, règle de sourçage du contenu** | [reference/PIEGES.md](./reference/PIEGES.md) |
| Les invariants du moteur, les commandes de vérification | [../CLAUDE.md](../CLAUDE.md) |
| Sections datées sorties de cette fiche le 2026-08-03 | [archive/FICHE_REPRISE_extraits_2026-08-03.md](./archive/FICHE_REPRISE_extraits_2026-08-03.md) |
