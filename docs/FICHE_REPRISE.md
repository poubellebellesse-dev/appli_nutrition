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

⚠️ **RELEVÉ DU 2026-08-20, SUR L'ARBRE COMMITÉ** (`4a9f373`, livraison du 65c) : `npm test` →
**2 254 passed / 0 failed (122 fichiers)** en 44,3 s · typecheck propre · `vite build` ✓ (2,98 s) ·
`engine:plan-stress` → **20/20** · `audit-mapping` **relancé** : 451 mappings, 9 candidats à
relire, **inchangé**.
⚠️ **L'écart 2 238 → 2 254 est d'UN SEUL lot** (65c) : seize clauses scellées neuves, aucun autre
fichier n'a gagné ni perdu de test. ⚠️ **Et le catalogue a bougé** : les occupations d'ustensile
passent de 92 à **377 sur 228 recettes**, la plaque en apportant 285 sur 166.

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

⭐ **PASSE AVANT TOUT LE RESTE DEPUIS LE 2026-08-21 : LE TEST SUR TÉLÉPHONE.** Une session d'usage
réel a produit une quarantaine d'observations, huit arbitrages (décisions 71 à 78, plus la 81) et
deux questions ouvertes (79, 80). ▶ Tout est dans
**[CONCEPTION_RETOURS_TEST.md](./CONCEPTION_RETOURS_TEST.md)** ; l'état des décisions est dans
`ETAT.md` §4, la dette dans §8.

**Ce qui vient tout de suite, dans cet ordre :**

- ⛔ **LA PASSE À L'ŒIL SUR LE TÉLÉPHONE — huit cases, et rien ne la remplacera.** Le lot
  `retour-1` a livré sept réparations d'affichage que **jsdom ne sait pas vérifier**. Le protocole
  est dans `CONCEPTION_RETOURS_TEST.md` §3. **Tant qu'elle n'est pas faite, on ne sait pas si le lot
  a marché** — on sait seulement qu'il n'a rien cassé.
- ▶ **`/brief retour-1b`** — le tutoriel qui traverse les menus (décision 81). Rien ne le bloque.
- ▶ Puis `retour-2` à `retour-8`, dans l'ordre des dépendances du document. ⚠️ **`retour-6` (les
  filtres d'envie deviennent durs) attend la décision 79**, pas seulement du code.


1. **▶ LOTS GESTE 1, GESTE 3 ET GESTE 4 LIVRÉS le 2026-08-16** (`e259bcb` le champ média, `de2ba39`
   l'affichage, `00f8e38` le hors-ligne). ⛔ **Il ne reste AUCUN lot débloqué dans ce chantier** : le
   lot geste 2 est le seul ouvert, et il est arrêté par décision. **La suite du chantier est un choix,
   pas une étape.** ▶ Ce que le lot geste 4 laisse derrière lui : `ETAT.md` §8.
   ⏳ **Le lot geste 2 est ARRÊTÉ À 3 GESTES SUR 51, volontairement** (`803fc42`, décision de l'auteur du
   2026-08-16) — D4 grave les binaires dans l'historique git **pour toujours**, et 22,43 Mo ne se
   dégravent pas. **Le rouvrir est une décision, pas une suite.**
   ⚠️ **Le sceau de `gestes-champ-media.test.ts` a été levé, confirmé** : deux assertions sur le
   *contenu du catalogue* retirées, le pouvoir de détection gardé. Motif dans le lot geste 1 du plan.
   ▶ Plan, « Fini quand » des 4 lots, décisions et pièges nommés :
   **[CONCEPTION_GESTES_ILLUSTRES.md](./CONCEPTION_GESTES_ILLUSTRES.md)**.
2. **🎬 Clips : le travail est FAIT** (compte en `ETAT.md`). ⛔ Reste actionnable : **7 gestes sans
   aucun candidat** (`piquer`, `blanchir`, `essorer`, `effeuiller`, `gratiner`, `chinois`,
   `ecosser`) — homonymes, cause nommée pour chacun. **Ne pas relancer de moisson à requête
   identique.** ⛔ **Et `suer` n'est PAS dans cette liste : il a 24 candidates et zéro segment
   encodé** — or c'est le geste qui justifiait le chantier (« suer » contre « revenir »). **La paire
   ne sera pas montrable à la fin des 4 lots.** ⚠️ **11 codes du lexique n'ont aucun dossier de
   clips, et 3 de plus n'y tombent qu'au tiret près** (`bain-marie`/`bain_marie`, `monter-blancs`,
   `tailler-des`) — c'est le lot geste 2 qui paiera, pas le lot geste 1.
3. **📷 Photos — elles s'AFFICHENT, et le cadre est lu à l'import** (`f3d4fa1`, fusionné dans `main`
   le 2026-08-17 — ⚠️ **le lot était vert SEUL depuis le 13, invisible sur l'arbre principal
   pendant quatre jours**). **129 sur 330** ; les 201 autres gardent l'aplat. ⛔ **La fiche détail
   d'une recette en montre une depuis le lot photo 3, livré le 2026-08-17 — plus aucun écran n'ignore la
   photo.** ⛔ **Ce qui reste bloque sur la SOURCE, pas sur le code** : le gisement de cadres est
   vide (**1 posé sur 129**, donc « carré » n'existe que sur une photo), le bac est épuisé et 19
   recettes n'ont AUCUNE candidate. ⛔ Bac épuisé — goulot = la source, pas le tri.
   ⛔ Build-qui-échoue-sans-photo **interdit avant 330/330**.
   ▶ [CONCEPTION_PHOTOS_RECETTES.md](./CONCEPTION_PHOTOS_RECETTES.md).
4. **⛔ Relecture par un tiers du contenu Savoir** (`ETAT.md` §8.2 bis) — **bloquante avant
   publication**. 73 tips et 8 fiches sourcés un par un, **aucun relu**.
5. **Vérifier sur un vrai téléphone** — protocole et seuil fixés à l'avance :
   [RETOUR_ESSAI_TELEPHONE.md](./RETOUR_ESSAI_TELEPHONE.md) §0. ⚠️ Le chrono de `#/recettes`, seul
   chiffre qui manque pour fermer la décision 61, **n'a toujours pas été pris** — jamais en jsdom.
6. **Empaquetage Capacitor, puis Play** — `capacitor.config.ts` en place, `npx cap add android`
   jamais lancé (pas de SDK). Le web reste le seul chemin vers un iPhone sans Mac.
7. **✅ LOT 66c LIVRÉ le 2026-08-17 — l'invariant origine/provenance est clos sur les six cases
   connues.** Commit `e552ca1` sur `main`, posé le 2026-08-18. ⚠️ **HEAD est en avance sur
   `origin/main` : à pousser.**
   ⛔ **Il n'y avait pas une case ouverte mais TROIS** — un troisième axe existait (`undefined`), et
   deux des trois trous portaient sur des champs que trois documents déclaraient clos. **Aucune
   ligne de production n'a changé.** ⛔ **Deux moitiés de critère ne sont pas tenues** (preuve par
   mutation hors dépôt, libellé d'un test scellé surdit) — elles sont en dette, pas en suspens.
   ▶ `ETAT.md` §8 · [CONCEPTION_INVARIANT_ORIGINE_ANIMALE.md](./CONCEPTION_INVARIANT_ORIGINE_ANIMALE.md) §8.

8. **✅ LOT 65b LIVRÉ le 2026-08-18 — on déclare son matériel dans les Paramètres, et ça n'enlève
   aucune recette tant qu'on n'a pas allumé le filtre.** Commit `d0c4bb3` sur `main`.
   ⛔ **CE LOT N'EST PAS CELUI QUI ÉTAIT ÉCRIT.** Il annonçait la quantité de feux et « débloque la
   plaque de cuisson » : mesuré, **aucune recette ne déclare occuper la plaque**, la quantité seule
   n'aurait rien affiché. Elle est partie au **65c**. Et deux pièces manquaient au plan — l'écran
   n'existait pas du tout (rien n'écrivait `user_equipment`), et l'écrire aurait réveillé une couche
   d'exclusion endormie : **264 recettes sur 330 retirées à la première case cochée.**
   ✅ **LA DETTE DU SCEAU EST FERMÉE le 2026-08-19 — lot 65b-bis.** Le réglage du filtre traverse
   désormais la fermeture de l'appli **sous garantie**, et pas seulement en fait.
   ✅ **65c LIVRÉ le 2026-08-20** (`4a9f373`) : la plaque existe enfin comme ustensile occupé, et qui
   déclare son nombre de feux est prévenu quand deux plats les demandent en même temps. ⛔ **Plus
   aucun lot ouvert dans ce chantier.** ⚠️ Deux clauses du 65b desserrées, champ visible sans test :
   `ETAT.md` §3 et §8.
   ▶ `ETAT.md` §3, §4 (décision 65) et §8 · [CONCEPTION_RESERVATION_MATERIEL.md](./CONCEPTION_RESERVATION_MATERIEL.md).

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
