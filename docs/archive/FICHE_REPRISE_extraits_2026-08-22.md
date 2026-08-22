# Blocs sortis de `FICHE_REPRISE.md` le 2026-08-22

> **Recopiés verbatim, jamais réécrits.** Ce sont des instantanés : vrais à leur date, et laissés
> tels quels. Septième dégonflage, après ceux des 08-03, 08-07, 08-09, 08-10, 08-11 et 08-14.

## Pourquoi ces six-là, et pas d'autres

⛔ **LE CRITÈRE DE TRI N'EST PAS L'ÂGE, C'EST LE DOUBLON.** La fiche s'était remise à porter des
faits d'état — cinq chantiers TERMINÉS y racontaient leur livraison en détail, alors que la règle
d'unicité veut qu'un fait vive à un seul endroit. Un lot fini n'est plus une prochaine étape : son
fait appartient à `ETAT.md` ou à son document de chantier.

La fiche faisait **167 lignes contre un plafond dur de 100**, qu'elle s'impose à sa propre ligne 3.

| Bloc sorti | Où son fait vit maintenant |
|---|---|
| 1 — les gestes illustrés | `ETAT.md` §8 et `CONCEPTION_GESTES_ILLUSTRES.md` |
| 2 — les clips | `ETAT.md` (comptes) et `CONCEPTION_GESTES_ILLUSTRES.md` |
| 3 — les photos de recettes | `CONCEPTION_PHOTOS_RECETTES.md` |
| 7 — le lot 66c | `ETAT.md` §8 et `CONCEPTION_INVARIANT_ORIGINE_ANIMALE.md` §8 |
| 8 — les lots 65b / 65b-bis / 65c | `ETAT.md` §3, §4 (décision 65) et §8 |
| les neuf questions ouvertes | `ETAT.md` §4, qui en est la source |

⚠️ **CE QUI N'A PAS ÉTÉ SORTI, ET POURQUOI.** Le bloc « travailler à plusieurs sessions » coûte
quinze lignes et reste : **une règle de survie qu'on déplace en archive est une règle qu'on ne lit
plus**, et cinq incidents ont déjà été payés dessus. Les entrées 4, 5 et 6 restent aussi — ce sont
des travaux À FAIRE, donc des prochaines étapes, pas des doublons.

⚠️ **UNE DES SIX N'ÉTAIT PAS UN LOT MAIS UNE RECOPIE** : le paragraphe des neuf questions ouvertes
redisait `ETAT.md` §4 en douze lignes, avec ses propres chiffres. Deux exemplaires d'une même liste
divergent toujours ; celui-ci l'avait déjà fait une fois, en 2026-08-04, sur la colonne « ouverte /
tranchée ».

---

## Bloc 1 — les gestes illustrés

```markdown
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
```

## Bloc 2 — les clips

```markdown
2. **🎬 Clips : le travail est FAIT** (compte en `ETAT.md`). ⛔ Reste actionnable : **7 gestes sans
   aucun candidat** (`piquer`, `blanchir`, `essorer`, `effeuiller`, `gratiner`, `chinois`,
   `ecosser`) — homonymes, cause nommée pour chacun. **Ne pas relancer de moisson à requête
   identique.** ⛔ **Et `suer` n'est PAS dans cette liste : il a 24 candidates et zéro segment
   encodé** — or c'est le geste qui justifiait le chantier (« suer » contre « revenir »). **La paire
   ne sera pas montrable à la fin des 4 lots.** ⚠️ **11 codes du lexique n'ont aucun dossier de
   clips, et 3 de plus n'y tombent qu'au tiret près** (`bain-marie`/`bain_marie`, `monter-blancs`,
   `tailler-des`) — c'est le lot geste 2 qui paiera, pas le lot geste 1.
```

## Bloc 3 — les photos de recettes

```markdown
3. **📷 Photos — elles s'AFFICHENT, et le cadre est lu à l'import** (`f3d4fa1`, fusionné dans `main`
   le 2026-08-17 — ⚠️ **le lot était vert SEUL depuis le 13, invisible sur l'arbre principal
   pendant quatre jours**). **129 sur 330** ; les 201 autres gardent l'aplat. ⛔ **La fiche détail
   d'une recette en montre une depuis le lot photo 3, livré le 2026-08-17 — plus aucun écran n'ignore la
   photo.** ⛔ **Ce qui reste bloque sur la SOURCE, pas sur le code** : le gisement de cadres est
   vide (**1 posé sur 129**, donc « carré » n'existe que sur une photo), le bac est épuisé et 19
   recettes n'ont AUCUNE candidate. ⛔ Bac épuisé — goulot = la source, pas le tri.
   ⛔ Build-qui-échoue-sans-photo **interdit avant 330/330**.
   ▶ [CONCEPTION_PHOTOS_RECETTES.md](./CONCEPTION_PHOTOS_RECETTES.md).
```

## Bloc 7 — le lot 66c, origine animale

```markdown
7. **✅ LOT 66c LIVRÉ le 2026-08-17 — l'invariant origine/provenance est clos sur les six cases
   connues.** Commit `e552ca1` sur `main`, posé le 2026-08-18. ⚠️ **HEAD est en avance sur
   `origin/main` : à pousser.**
   ⛔ **Il n'y avait pas une case ouverte mais TROIS** — un troisième axe existait (`undefined`), et
   deux des trois trous portaient sur des champs que trois documents déclaraient clos. **Aucune
   ligne de production n'a changé.** ⛔ **Deux moitiés de critère ne sont pas tenues** (preuve par
   mutation hors dépôt, libellé d'un test scellé surdit) — elles sont en dette, pas en suspens.
   ▶ `ETAT.md` §8 · [CONCEPTION_INVARIANT_ORIGINE_ANIMALE.md](./CONCEPTION_INVARIANT_ORIGINE_ANIMALE.md) §8.

```

## Bloc 8 — les lots 65b, 65b-bis et 65c, réservation matériel

```markdown
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

```

## Bloc les neuf questions ouvertes, recopiées de ETAT.md §4

```markdown
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
```
