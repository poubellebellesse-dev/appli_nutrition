# ⭐ Fiche de reprise — appli_nutrition

> **Une page, jamais plus — plafond dur : 100 lignes.** État vérifié + prochaine étape, rien d'autre.
> Avancement, décisions et dette : [ETAT.md](./ETAT.md) · Index : [README.md](./README.md) · Font
> foi : [ENGINE.md](./ENGINE.md) (moteur), [ARCHITECTURE.md](./ARCHITECTURE.md) (le reste).
> ⛔ **RÈGLE DE SURVIE, APPRISE AUX DÉPENS DE CETTE PAGE : un lot fini pose son fait dans `ETAT.md`
> ou dans son document de chantier, JAMAIS ici.** Sinon elle grossit seule, et **le critère de tri
> n'est pas l'âge mais le doublon**. Dégonflée six fois ; les blocs sortis sont en archive, dernière
> ligne du tableau ci-dessous — elle dit où leur fait vit et lesquels avaient tort.

## Le projet

Planificateur de repas **100 % local, sans IA, sans compte**. Moteur TypeScript pur, catalogue
SQLite construit au build, PWA React servie en statique. La boucle complète tourne : s'installer →
allergies → suggestion → semaine → liste de courses → cuisiner.

## Où on en est

```
MOTEUR ✅ ─ CONTENU ✅ ─ user.db ✅ ─ DESIGN ✅ ─ 12 ÉCRANS ✅ ─ TESTS D'ÉCRAN ✅ ─▶ CONTENU & DISTRIBUTION ▓▓
                                                                                          ⬅ ICI
```

⚠️ **RELEVÉ DU 2026-08-16, SUR L'ARBRE COMMITÉ** (`de2ba39`, lot 3 des gestes) : `npm test` →
**2 156 passed / 0 failed (2 156 tests, 114 fichiers)** en ~42 s · typecheck propre · `vite build` ✓
(2,82 s) · `engine:plan-stress` → **20/20** · `audit-mapping` → 451 / 9 candidats (inchangé).
✅ **LES 6 ROUGES SONT ÉTEINTS** — le lot 1 a fermé les scellés de `gestes-champ-media.test.ts`.
Écart 2 152 → 2 156 attribué fichier par fichier : **+4, tous dans `savoir.test.tsx`** (lot 3).

⚠️ **`git status -sb` donne l'état, jamais cette page.** ⚠️ **Piège de relevé** : `npm test 2>&1 |
tail -25` rend le code de sortie du **pipe**, donc 0. Lire `Tests N failed`, jamais `$?`.
⚠️ **Le compte d'écrans se lit en `ETAT.md` §5, qui en porte TROIS et interdit de les uniformiser** :
**8 spécifiés**, **12 codés**, **12 testés** — `savoir` était le dernier sans test, livré le 08-16.

## ⛔ Travailler à plusieurs sessions dans cet arbre

**Cinq incidents payés, dont un qui a vidé l'arbre entier.** Trois gestes, sans exception :

1. **Jamais `git commit -a`** — commiter ses fichiers nommés un par un. L'index est partagé : un
   `git add` trop large a fait déclarer livré un lot dont **aucune ligne de code n'existait**.
2. **Jamais `git stash`** — `-- <chemins>` limite ce qu'on remise, **rien ne limite ce qu'on rend**.
   Si le mal est fait : `git stash list` **avant** `git reflog`, puis `git checkout stash@{0} --
   <chemins>`, jamais `pop`.
3. **`git status -sb` avant chaque commit.**

⛔ **AUCUN ✅ SANS `git log --all -S` SUR UN IDENTIFIANT DU CODE CONCERNÉ.** Un compte vert ne prouve
rien : celui de 1 940 était vrai sur un arbre qui n'existe plus. **Un écart de compte s'attribue par
`git diff --name-only`, jamais par déduction.** ⚠️ **HEAD est EN AVANCE sur `origin/main`** : Claude
committe, l'utilisateur pousse. ▶ Méthode complète : **[reference/PIEGES.md](./reference/PIEGES.md)**.

## ▶ La prochaine étape

⛔ **LE HORS-LIGNE EST FERMÉ. CE QUI BLOQUE MAINTENANT, C'EST LE CONTENU.**

1. **▶ LOTS 1, 3 ET 4 LIVRÉS le 2026-08-16** (`e259bcb` le champ média, `de2ba39` l'affichage, le
   hors-ligne **pas encore commité**). ⛔ **Il ne reste AUCUN lot débloqué dans ce chantier** : le
   lot 2 est le seul ouvert, et il est arrêté par décision. **La suite du chantier est un choix, pas
   une étape.** ▶ Ce que le lot 4 laisse derrière lui : `ETAT.md` §8.
   ⏳ **Le lot 2 est ARRÊTÉ À 3 GESTES SUR 51, volontairement** (`803fc42`, décision de l'auteur du
   2026-08-16) — D4 grave les binaires dans l'historique git **pour toujours**, et 22,43 Mo ne se
   dégravent pas. **Le rouvrir est une décision, pas une suite.**
   ⚠️ **Le sceau de `gestes-champ-media.test.ts` a été levé, confirmé** : deux assertions sur le
   *contenu du catalogue* retirées, le pouvoir de détection gardé. Motif dans le lot 1 du plan.
   ▶ Plan, « Fini quand » des 4 lots, décisions et pièges nommés :
   **[CONCEPTION_GESTES_ILLUSTRES.md](./CONCEPTION_GESTES_ILLUSTRES.md)**.
2. **🎬 Clips : le travail est FAIT** (compte en `ETAT.md`). ⛔ Reste actionnable : **7 gestes sans
   aucun candidat** (`piquer`, `blanchir`, `essorer`, `effeuiller`, `gratiner`, `chinois`,
   `ecosser`) — homonymes, cause nommée pour chacun. **Ne pas relancer de moisson à requête
   identique.** ⛔ **Et `suer` n'est PAS dans cette liste : il a 24 candidates et zéro segment
   encodé** — or c'est le geste qui justifiait le chantier (« suer » contre « revenir »). **La paire
   ne sera pas montrable à la fin des 4 lots.** ⚠️ **11 codes du lexique n'ont aucun dossier de
   clips, et 3 de plus n'y tombent qu'au tiret près** (`bain-marie`/`bain_marie`, `monter-blancs`,
   `tailler-des`) — c'est le lot 2 qui paiera, pas le lot 1.
3. **📷 Photos — 116 importées · 13 décidées non importées · 201 recettes sans rien.** ⛔ **Pas un
   défaut de tri : bac épuisé, 19 recettes sans AUCUNE candidate** — goulot = la source. ⛔ Build-
   qui-échoue-sans-photo **interdit avant 330/330**. ▶ **Recadrage carré livré, PAS lu à l'import.**
4. **⛔ Relecture par un tiers du contenu Savoir** (`ETAT.md` §8.2 bis) — **bloquante avant
   publication**. 73 tips et 8 fiches sourcés un par un, **aucun relu**.
5. **Vérifier sur un vrai téléphone** — protocole et seuil fixés à l'avance :
   [RETOUR_ESSAI_TELEPHONE.md](./RETOUR_ESSAI_TELEPHONE.md) §0. ⚠️ Le chrono de `#/recettes`, seul
   chiffre qui manque pour fermer la décision 61, **n'a toujours pas été pris** — jamais en jsdom.
6. **Empaquetage Capacitor, puis Play** — `capacitor.config.ts` en place, `npx cap add android`
   jamais lancé (pas de SDK). Le web reste le seul chemin vers un iPhone sans Mac.
7. **`/brief 66c` — une case de l'invariant origine/provenance reste ouverte, et elle est mesurée.**
   `origine` rendue **optionnelle** laisse les neuf tests scellés verts pendant qu'une source animale
   sans origine compile. Une 8ᵉ sonde + un projet `tsc`, à poser **à côté** des scellés du 66/66b,
   qui sont fermés. ⚠️ Ne coûte rien à personne d'autre : aucun code de production. ▶ `ETAT.md` §8 ·
   [archive/RECAP_SESSION_2026-08-14_invariant-origine-animale.md](./archive/RECAP_SESSION_2026-08-14_invariant-origine-animale.md).

⚠️ **Deux trous sanitaires bloquent la publication au même titre que la relecture** : céphalopodes et
cuisson de l'œuf, qu'aucune autorité lue ne donne — le principe 3 interdit d'écrire sans source.
Comptes du contenu restant : `ETAT.md`.

**NEUF questions ouvertes en `ETAT.md` §4** (2, 5, 6, 11, 52, 58, 65, 68, 70 — recomptées à la
commande le 2026-08-14). ⚠️ **Trois seulement bloquent quelque chose de concret, les voici ; ne pas
lire « trois » comme le total.** **64, 67, 66 et 69 en sont SORTIES** (fermées les
08-10, 08-11, 08-14 et 08-14) : **65** (⚠️ **réduite le 2026-08-13 : 65a est livré, la
table d'occupations et le partage existent ; ne reste que la quantité de feux possédés** ·
[plan](./CONCEPTION_RESERVATION_MATERIEL.md) · état : `ETAT.md` §3 et §4), **68** (budget P6 — ⚠️ **forcée depuis le
2026-08-11** : photos + clips ≈ 27,6 Mo contre un critère de 15, mais ce seuil visait un **premier
chargement web**, avant le cache à deux étages et Capacitor), et les **366 doublons d'affichage**,
jamais posés. ⚠️ **La 70 est ENTRÉE le 2026-08-14** (export utilisateur *vs* médias du catalogue) :
elle ne bloque aucun lot, elle doit être tranchée avant celui qui en dépendra.

## Où chercher le reste

Les **six acquis à ne pas défaire** et les **quatre commandes qui font foi** vivent dans
**[../CLAUDE.md](../CLAUDE.md)**, chargé à chaque session — plus recopiés ici.

| Question | Document |
|---|---|
| Avancement, décisions, **dette connue** (§8) | [ETAT.md](./ETAT.md) |
| Couches, algorithmes, API du moteur | [ENGINE.md](./ENGINE.md) |
| Périmètre produit, données, cadre légal · Écrans et jetons visuels | [ARCHITECTURE.md](./ARCHITECTURE.md) · [DESIGN.md](./DESIGN.md) |
| **Pièges, impasses payées, règle de sourçage** — à ouvrir avant de rouvrir un chantier | [reference/PIEGES.md](./reference/PIEGES.md) |
| **Licences des médias embarqués** — clauses citées, et ce qui n'a PAS pu être vérifié | [reference/LICENCES_MEDIAS.md](./reference/LICENCES_MEDIAS.md) |
| **Mode cuisine** : lots, questions ouvertes, essai sur appareil | [CONCEPTION_MODE_CUISINE.md](./CONCEPTION_MODE_CUISINE.md) |
| Écriture du contenu Savoir · Distribution | [tips](../catalog/tips/README.md) · [evidence](../catalog/evidence/README.md) · [STRATEGIE](./STRATEGIE_DISTRIBUTION.md) |
| Tri des photos et des clips : barème, décisions, outils | `../atelier/photos/REPRISE.md` · `../atelier/gestes/` (hors dépôt) |
| Ce qui a été essayé **et écarté** | [archive/](./archive/) — [README](./archive/README.md) apparie les pistes parallèles |
| **Blocs sortis de cette fiche, et lesquels avaient tort** | [08-14](./archive/FICHE_REPRISE_extraits_2026-08-14.md) · [08-11](./archive/FICHE_REPRISE_extraits_2026-08-11.md) · [08-10](./archive/FICHE_REPRISE_extraits_2026-08-10.md) · [08-09](./archive/FICHE_REPRISE_extraits_2026-08-09.md) · [08-07](./archive/FICHE_REPRISE_extraits_2026-08-07.md) · [08-03](./archive/FICHE_REPRISE_extraits_2026-08-03.md) |
| **Récit de la session 66/66b — la paire origine/provenance** | [RECAP 08-14](./archive/RECAP_SESSION_2026-08-14_invariant-origine-animale.md) |
