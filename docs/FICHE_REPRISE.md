# ⭐ Fiche de reprise — appli_nutrition

> **Une page, jamais plus — plafond dur : 100 lignes.** État vérifié + prochaine étape, rien d'autre.
> Avancement, décisions et dette : [ETAT.md](./ETAT.md) · Index : [README.md](./README.md) · Font
> foi : [ENGINE.md](./ENGINE.md) (moteur), [ARCHITECTURE.md](./ARCHITECTURE.md) (le reste).
> ⛔ **RÈGLE DE SURVIE, APPRISE AUX DÉPENS DE CETTE PAGE : un lot fini pose son fait dans `ETAT.md`
> ou dans son document de chantier, JAMAIS ici** — **le critère de tri n'est pas l'âge, c'est le
> doublon**. Dégonflée sept fois ; les blocs sortis sont en archive (dernière ligne du tableau).

## Le projet, et où on en est

Planificateur de repas **100 % local, sans IA, sans compte**. Moteur TypeScript pur, catalogue SQLite
au build, PWA React statique. La boucle tourne en entier : s'installer → allergies → suggestion →
semaine → courses → cuisiner.

```
MOTEUR ✅ ─ CONTENU ✅ ─ user.db ✅ ─ DESIGN ✅ ─ 12 ÉCRANS ✅ ─ TESTS D'ÉCRAN ✅ ─▶ CONTENU & DISTRIBUTION ▓▓
                                                                                          ⬅ ICI
```

⚠️ **RELEVÉ DU 2026-08-26, APRÈS LE COMMIT DE `retour-4` (`7642492`)** : `npm test` → **2 411
passed / 0 failed (127 fichiers)** en 50,4 s · typecheck propre · `vite build` ✓ (3,11 s) ·
`plan-stress` **20/20**. ⚠️ **`audit-mapping` non relancé** : catalogue inchangé depuis le 08-20
(451 mappings, 9 à relire). ⚠️ **L'écart 2 392 → 2 411 est `retour-4` SEUL**, et il tient dans **un
seul fichier scellé neuf** (126 → 127, 19 tests) : aucun autre fichier n'a bougé.
⛔ **UN COMPTE PEUT BOUGER SANS QU'AUCUN FICHIER DE TEST NE CHANGE** — `it.each` nourri par une
table de production. C'est ce qui a ouvert un écart de 90 ici. ▶ `ETAT.md` §8, lot `retour-2`.

⚠️ **`git status -sb` donne l'état, jamais cette page.** ⚠️ **Piège de relevé** : `npm test 2>&1 |
tail` rend le code du **pipe**, donc 0 ; lire `Tests N failed`, jamais `$?`. ⚠️ **Le compte d'écrans
se lit en `ETAT.md` §5, qui en porte TROIS** : **8 spécifiés**, **12 codés**, **12 testés**.

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
⭐ **PASSE AVANT TOUT LE RESTE DEPUIS LE 2026-08-21 : LE TEST SUR TÉLÉPHONE.** Une session d'usage
réel a produit une quarantaine d'observations, neuf arbitrages (71 à 78, plus la 81) et deux
questions ouvertes (79, 80). ▶ **[CONCEPTION_RETOURS_TEST.md](./CONCEPTION_RETOURS_TEST.md)**.

- ⛔ **LA PASSE À L'ŒIL SUR LE TÉLÉPHONE — NEUF cases, et rien ne la remplacera.** Trois lots y ont
  ajouté de quoi voir (affichages, attente de chargement, champ de recherche et famille de 74
  lignes), **qu'aucun test jsdom ne sait vérifier**. Protocole : `CONCEPTION_RETOURS_TEST.md` §3.
  **Tant qu'elle n'est pas faite, on sait seulement que rien n'est cassé** — pas que ça marche.
- ▶ **`/brief retour-5`** — `retour-4` est livré (poser un reste à la main, écran Semaine). Puis
  `retour-6` à `retour-8`. ⚠️ **`retour-6` attend la décision 79**, pas que du code.
  ⚠️ **En ouvrant le brief : nommer les réglages persistants que l'écran lit, et dire lesquels les
  clauses font varier.** C'est ce qui a manqué à `retour-2` — `ETAT.md` §8.

**Les chantiers TERMINÉS ne sont plus détaillés ici** — leur fait vit dans `ETAT.md` et dans leur
document de chantier. ⚠️ **Gestes illustrés : 3 sur 62 en base** — lot geste 2 arrêté à trois par
la décision D5, TOUJOURS OUVERT, sa clause en demande 51. Clips récoltés (7 gestes sans candidat),
photos (129/330, source), origine animale (66c), matériel (65c), retours test (1, 1b, 2, 3, 4 livrés).

**Ce qui reste à faire, et qui n'attend que d'être commencé :**

1. **⛔ Relecture par un tiers du contenu Savoir** (`ETAT.md` §8.2 bis) — **bloquante avant
   publication**. 73 tips et 8 fiches sourcés un par un, **aucun relu**.
2. **Vérifier sur un vrai téléphone** — protocole et seuil fixés à l'avance :
   [RETOUR_ESSAI_TELEPHONE.md](./RETOUR_ESSAI_TELEPHONE.md) §0. ⚠️ Le chrono de `#/recettes`, seul
   chiffre qui manque pour fermer la décision 61, **n'a toujours pas été pris** — jamais en jsdom.
3. **Empaquetage Capacitor, puis Play** — `capacitor.config.ts` en place, `npx cap add android`
   jamais lancé (pas de SDK). Le web reste le seul chemin vers un iPhone sans Mac.

⚠️ **Deux trous sanitaires bloquent la publication au même titre que la relecture** : céphalopodes et
cuisson de l'œuf, qu'aucune autorité lue ne donne — le principe 3 interdit d'écrire sans source.
⚠️ **NEUF questions ouvertes en `ETAT.md` §4**, seule source — ne pas les recopier ici. Trois
bloquent quelque chose : **65** (feux possédés), **68** (budget P6), les **366 doublons d'affichage**.

## Où chercher le reste

Les **six acquis** et les **quatre commandes qui font foi** vivent dans **[../CLAUDE.md](../CLAUDE.md)**, chargé à chaque session.

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
| **Blocs sortis de cette fiche, et lesquels avaient tort** | [08-22](./archive/FICHE_REPRISE_extraits_2026-08-22.md) · [08-14](./archive/FICHE_REPRISE_extraits_2026-08-14.md) · [08-11](./archive/FICHE_REPRISE_extraits_2026-08-11.md) · [08-10](./archive/FICHE_REPRISE_extraits_2026-08-10.md) · [08-09](./archive/FICHE_REPRISE_extraits_2026-08-09.md) · [08-07](./archive/FICHE_REPRISE_extraits_2026-08-07.md) · [08-03](./archive/FICHE_REPRISE_extraits_2026-08-03.md) |
| **Récit de la session `retour-1b` — sept clauses vertes sur dix, et le tutoriel cassé** | [RECAP 08-22](./archive/RECAP_SESSION_2026-08-22_tutoriel-qui-traverse.md) |
