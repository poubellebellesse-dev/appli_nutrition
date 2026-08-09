# Récap session 2026-08-08 → 2026-08-09 — le tri des photos va au bout du bac

> **Instantané daté.** Vrai à sa date, jamais réécrit. L'état courant est dans
> [../FICHE_REPRISE.md](../FICHE_REPRISE.md) et [../ETAT.md](../ETAT.md).
>
> Suite directe de [RECAP_SESSION_2026-08-07_photos.md](./RECAP_SESSION_2026-08-07_photos.md),
> qui raconte le démarrage du chantier, la greffe de la passe sur l'outil de tri et la découverte
> du défaut de ciblage de la récolte. **Ce récit-ci raconte la fin du tri, pas son début** — le
> barème, l'architecture de l'outil et la règle « la passe propose, elle ne tranche pas » sont là-bas.
>
> ⚠️ **Piste parallèle, à nouveau.** Une autre session écrivait dans le même dépôt pendant toute
> la durée de celle-ci (mode cuisine : `cuisine-session.ts`, `ordonnancement.ts`, `screens/cuisine.tsx`,
> `texte-etape.ts`, `lien-etape-ingredient`). **Aucun fichier de code n'a été touché par cette
> session-ci** — elle n'a produit que des verdicts dans `atelier/` (hors dépôt) et ces deux documents.
> Ne pas lui attribuer les 38 fichiers modifiés que `git status` montrait le 2026-08-09.

## 1. Ce qui a été fait

Le bac de candidates a été vidé. Tous les couples (image × recette) qu'il pouvait produire ont été
jugés, lot après lot, l'utilisateur relisant chaque lot derrière la passe.

```
catalogue                     : 308 recettes
  photo tranchée par l'humain :  88
  photo proposée en attente   :   0   ← le bac est vide, il n'y a plus de lot à tirer
  sans aucune candidate       :  17

journal de la passe           : 2 740 couples (image × recette) jugés
                                2 631 non · 19 doute · 90 oui
décisions humaines            : 178
                                93 oui · 35 retirer · 23 mauvais-plat · 22 hors-catalogue · 5 non
```

**93 `oui` pour 88 recettes** : cinq recettes ont reçu deux photos validées. L'import devra en
choisir une — voir §5.

## 2. Les trois chiffres qui décrivent l'état, et rien d'autre

| | |
|---|---|
| **88** | recettes du catalogue avec une photo validée par l'humain |
| **22** | photos validées pour un plat **absent du catalogue** (§4) |
| **220** | recettes du catalogue **sans photo** (§3) |

⛔ **Ne pas confondre les 22 avec les 231 de §4.** Les 22 sont des verdicts *rendus* par l'humain
sur des images qu'il a ouvertes ; les 231 sont des dossiers de candidates *jamais jugés*, parce que
l'outil refuse structurellement de les proposer. Cette confusion a été faite une fois dans la
session et elle a coûté un échange entier.

## 3. Pourquoi 220 recettes n'ont rien reçu — la mesure, pas l'impression

**Ce n'est pas le tri qui a été trop sévère, c'est la récolte qui n'a pas rapporté.** Sur les
220 recettes sans photo :

- **19** n'ont jamais vu passer une seule candidate (dont 17 que l'outil déclare sans aucun
  dossier dans le bac) ;
- **201** en ont vu passer au moins une — **2 059 photos distinctes examinées pour elles seules**.

Répartition de ces 201, par nombre de candidates vues :

| candidates vues | 1-2 | 3-5 | 6-10 | 11-20 | 21+ |
|---|---|---|---|---|---|
| recettes | 30 | 25 | 52 | **76** | **18** |

**94 recettes sur 201 ont vu plus de dix photos et n'en ont gardé aucune.** Le goulot est en amont
du tri. Exemples relevés en jugeant : `magret-canard-miel` a reçu six canards vivants et un
gros-bec ; `chili-sin-carne` a reçu deux fois des grains de café ; `pizza-maison` a reçu huit
salades caprese. Le défaut de ciblage documenté dans le récap du 2026-08-07 (`lire_csv` retombant
en silence sur le slug de recette quand la colonne de requête est vide) explique une partie de ce
bruit, et il n'est **toujours pas corrigé**.

▶ **Conséquence pour la suite : relancer une récolte sous un troisième angle vaut mieux que
rejuger le bac.** Il n'y a plus rien à en tirer.

## 4. Le stock hors catalogue — 231 plats, 3 007 photos, et une barrière dans le code

Le bac contient des dossiers dont le plat n'existe pas dans le catalogue : **231 plats pour
3 007 photos**. Les huit mieux servis : `gratin_courgettes` (24), `bourguignon` (20),
`soupe_pistou` (20), `croustade_landaise` (19), `opera_gateau` (19), `profiteroles` (19),
`paella` (18), `salade_caprese` (18).

⛔ **Ces photos ne peuvent pas être validées, et la garantie est dans le code, pas dans la
discipline.** `construireOrphelines` (`atelier/photos/donnees.mjs:633`) préfixe ces groupes de
`hors:` et le serveur **refuse un `oui`** dessus. On ne peut leur donner qu'un titre libre.

⚠️ **Deux réserves avant d'en faire un chantier de contenu.** La liste penche lourdement vers les
plats carnés (bourguignon, paella, magret), ce qui **entre en tension avec la direction végétale
du catalogue** — écrire 231 recettes pour habiller 3 007 photos serait laisser la photothèque
décider du contenu. Et la commande de régénération de cette liste est dans
`atelier/photos/REPRISE.md`, décision en attente n°4.

**Les 22 verdicts `hors-catalogue` déjà rendus** vivent dans `atelier/photos/etat/decisions.json`
(`recette: null` + un titre libre tapé par l'humain) et sont recopiés dans
`atelier/photos/etat/paires-hors-catalogue.csv`. Les titres vont de `soupe potiron` à
`Flamiche picarde` en passant par `Tartelette rocher coco` — **c'est une liste de recettes à
écrire, pas des photos perdues.**

## 5. Ce que l'import n'aura pas à faire — mesuré le 2026-08-09

L'étape d'import (`image_path` dans les YAML, copie dans `app/public/`, crédits) **n'est toujours
pas écrite**. Mais deux obstacles supposés ont été mesurés et écartés :

- ✅ **Rien ne manque et rien n'est cassé.** Les 88 photos retenues (une par recette, la dernière
  par horodatage quand il y en avait deux) pèsent **19,9 Mo**, médiane **189 Ko**, largeur médiane
  **1 024 px**, **max 2 048 px**, **0 fichier manquant**.
  ⛔ **MAIS « aucun convertisseur n'est nécessaire » EST FAUX, ET C'EST MA CONCLUSION D'IL Y A
  UNE HEURE.** Je l'avais mesurée sur le mauvais critère : le poids des fichiers **à stocker**, pas
  le budget **à expédier**. Le critère de sortie P6 dit « bundle < 15 Mo », budget **40 Ko par
  image** (`ETAT.md:1261`). **2 photos sur 88 y satisfont.** Les 19,9 Mo dépassent le bundle entier
  à eux seuls, avant `catalog.db` (1,4 Mo) et le JS — et à 308 recettes la même règle donnerait
  ~70 Mo. **Le ré-encodage est donc requis, et il doit être décidé sur 88 photos, pas sur 308.**
  ⚠️ **Aucun encodeur n'est disponible sur la machine** : ni `sharp` dans `node_modules`, ni
  `magick`, ni `ffmpeg`, ni `cwebp`, ni `avifenc`, ni Pillow pour Python. (`convert` existe dans
  `system32` — c'est l'outil de conversion de **système de fichiers** de Windows, pas ImageMagick.)
- ✅ **Deux fichiers mal nommés, pas 212.** Sur la sélection validée : 91 JPEG, 1 PNG, 1 WEBP —
  deux extensions mentent, l'import doit lire l'entête et non le nom. Le chiffre de 212 portait
  sur le bac entier, pas sur la sélection.

Restent deux arbitrages **non tranchés**, tous deux à poser avant d'écrire l'import :

1. **20,5 Mo de binaires entrent dans l'historique git.** Réversible en apparence seulement :
   l'historique les garde après suppression.
2. **Où la photo s'affiche.** `ui/vignette.ts` (aplat coloré + initiale) ⚠️ **ne sert PAS
   « partout »** — un seul écran l'utilise, `screens/aujourdhui.tsx`. `screens/detail-recette.tsx`
   n'a **aucun bloc visuel** : y poser une photo est une décision de `DESIGN.md` (§4.1 veut une
   « photo dominante »), pas un branchement.

⚠️ Cinq recettes portent **deux** `oui`. Règle proposée, non validée : garder le dernier par
`horodatage`.

## 6. Ce que la passe a appris au barème

Le barème complet vit dans `atelier/photos/REPRISE.md` (hors dépôt) et dans la mémoire de session.
Trois points ajoutés pendant ces lots, qui valent au-delà des photos :

- **☠️ Un `doute` dont la règle est déjà écrite est une excuse déguisée.** Le taboulé a été perdu
  deux fois pour ça. Test : *« la règle qui condamne ce défaut est-elle déjà au barème ? Si oui,
  ce n'est pas une question, c'est un `non` »*.
- **✅ Le ⚠️ légitime informe l'arbitre ; l'illégitime lui délègue un refus.** 8 propositions sur 8
  acceptées, dont les trois qui portaient un ⚠️ — le mécanisme est sain, il ne faut pas s'en méfier.
- **Une signature d'auteur incrustée est une marque de tiers**, refus dur, aucune retouche possible
  (`spaghetti_bolognaise/openverse_13` porte « SHUBERT L. CIENCIA / Circa 2008 » en clair).

## 7. Un faux chiffre corrigé, à ne pas ressusciter

⛔ **« 556 couples jugés pour une recette déjà servie » est FAUX. Le vrai chiffre est 0.** La
requête comparait `l.horodatage` alors que le journal `ma-passe.jsonl` nomme ce champ **`h`** ;
`String(undefined)` vaut `"undefined"`, lexicographiquement supérieur à toute date, donc **toutes**
les lignes correspondaient. **L'outil ne re-propose jamais une recette servie.** Ce qui en donnait
l'impression : le même *dossier* d'images revient pour une *autre* recette — huit
`salade_tomate_mozzarella/*` proposées pour `pizza-maison` après que
`salade-tomate-mozzarella` eut sa photo. C'est le bon comportement : **le grain d'un verdict est
le couple (image × recette), jamais l'image seule.**
