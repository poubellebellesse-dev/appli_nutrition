# Récap de session — les clips des 62 gestes (2026-08-11)

> **Instantané daté. Ne jamais réécrire, ne jamais citer comme état.** L'état vit dans `ETAT.md`.
> Piste parallèle du même jour : le régime personnalisé (décision 67, lot D) — sans recouvrement.

**En une phrase** : le lexique de gestes passe de zéro média à **98 segments vidéo encodés, sourcés
et tranchés un par un par l'utilisateur** — et trois erreurs de mesure ont été trouvées en chemin,
dont deux que rien n'aurait signalées.

---

## 1. Ce qui est livré

| | |
|---|---|
| Gestes jugés | **62 / 62** |
| Gestes avec un clip retenu | **55** (52 « oui », 3 « doute » versés à la file) |
| Gestes sans aucun candidat | **7** — `piquer`, `blanchir`, `essorer`, `effeuiller`, `gratiner`, `chinois`, `ecosser` |
| Décisions humaines | **55** — 51 oui, 4 non (`vapeur`, `suer`, `carameliser`, `mouiller`) |
| Segments découpés | **98** sur 51 gestes — 29 début, 23 milieu, 25 fin, 21 unique |
| Cadres tracés | **3** — `eponger` (unique), `tailler_des` (milieu, fin) |
| Fichiers encodés | **294** — AV1 + H.264 + poster JPEG par segment, aucun manquant |
| Sources dans le bac | **548,3 Mo**, 55 clips, hors dépôt |

Outils écrits, tous dans `atelier/gestes/` (**gitignoré** — ces scripts ne sont pas au dépôt) :
`telecharger-clips.mjs`, `serveur-clips.mjs` + `ui/clips.html`, `encoder-clips.mjs`.

**Les 7 gestes sans clip sont fermés sur deux sources chacun, avec une cause nommée** — ce sont des
homonymes, pas une récolte paresseuse : *shelling* rend des coquilles puis des bombardements,
*spinner* un hochet anti-stress, *fine mesh* un maillage 3D, *ice bath* des glaciers, *under
broiler* des scènes sous-marines. ⛔ **Ne pas relancer une moisson sur ces sept-là sans changer la
requête** : la même question rendra les mêmes images.

---

## 2. ⛔ Le manifeste a menti sur 53 clips sur 55, et rien ne s'est affiché en rouge

**C'est le fait le plus cher de la session, et il s'est produit deux fois.**

`clips-retenus.json` déclarait `640×360` pendant que les fichiers sur le disque faisaient
`1920×1080`. Un fichier de 12,5 Mo annoncé en 640. Découvert par le poids, pas par une erreur.

**Cause** : quand un clip était déjà tiré à la bonne définition, le script sautait l'appel à l'API
Pexels — et retombait alors sur la définition du **catalogue de récolte** (640), qu'il réécrivait
par-dessus la vraie. Aucune exception, aucun test rouge : le recadrage se serait simplement cru
quatre fois plus serré qu'il ne l'est.

⛔ **ET LA PREMIÈRE CORRECTION A PROPAGÉ LE MENSONGE AU LIEU DE LE RÉPARER.** Elle reportait la
valeur du manifeste **précédent** — c'est-à-dire celui qui venait d'être faussé. Elle est correcte
pour l'avenir et inopérante sur le passé. **Une valeur ne se répare pas depuis la copie qu'on vient
de corrompre.**

**Ce qui a réparé** : reconstruire depuis les **fichiers**, seul témoin qui n'avait pas menti —
`ffprobe` pour les dimensions, l'API pour les liens. 53 dimensions corrigées, 53 liens rétablis,
puis **relecture un à un des 55 fichiers contre leur fiche : 0 désaccord**.

Deux pièges y attendent quiconque recommence, tous deux consignés dans `telecharger-clips.mjs` :

1. **`ffprobe -select_streams v:0` rend DEUX lignes sur six de ces clips** (double flux vidéo). Un
   `split('x')` naïf sort une hauteur `NaN`. Six clips sont restés faux un tour de plus pour ça, et
   le script a affiché « ffprobe muet » au lieu d'échouer. ⚠️ D'où le `-map 0:v:0` de l'encodeur :
   sans lui, ffmpeg choisit « le meilleur » flux, qui n'est pas forcément celui que le manifeste
   décrit.
2. **Le nombre dans `video-files/<n>/` est l'identifiant du FICHIER**, que `/videos/videos/{id}`
   refuse. Celui qu'attend l'API est en queue de l'URL de page. Les 53 liens échouaient là-dessus.

---

## 3. ⚠️ Une décision de disque avait silencieusement fermé une option de cadrage

La moisson n'enregistrait qu'**un** lien par clip, le plus petit (640×360), choisi pour économiser
du disque **avant** qu'on sache que le recadrage serait demandé. Or la sortie fait 480 px : depuis
un source 640, recadrer au-delà de 1,3× remonte une image interpolée.

Pexels publie du 1920 pour **tous** les clips vérifiés. Retirés en 1920 : **534 Mo de plus dans le
bac, zéro octet de plus livré** (la sortie ne change pas), et la marge de zoom passe de 1,3× à
**2,25×**. ⚠️ **Une économie prise sur un intermédiaire peut fermer une option en aval sans que
personne l'écrive.** Le bac est hors dépôt : il ne coûtait rien.

Vérifié après coup sur les 98 segments : **zéro zoom > 1**. Aucune image interpolée dans le lot.

---

## 4. La passe humaine — deux tours, et l'écran qui les a portés

`serveur-clips.mjs` + `ui/clips.html`, sur le modèle de la passe photos. Deux fichiers, **deux
autorités** : `clips-proposes.json` est écrit par Claude et **jamais** par le serveur ;
`clips-decisions.json` n'est écrit que par l'humain, en écriture atomique (`.tmp` + `rename`).

Ajouté au second tour, à la demande : une **frise** sous la vidéo pour marquer début et fin d'un
segment, un calage automatique sur 3 s, et le rôle (`début` / `milieu` / `fin` / `unique`) — ce qui
réalise la décision d'`ETAT.md` « 3 clips de 3 s plutôt qu'une boucle unique ». Plus un **cadre
carré tracé à la souris**, stocké en **fractions** et jamais en pixels.

⚠️ **Le cadre est en fractions POUR CETTE RAISON PRÉCISE** : la définition source a déjà changé une
fois dans cette même session (640 → 1920). Des pixels enregistrés auraient tous été à refaire.

Trois pièges d'écran, payés :

- **`object-fit: contain` letterboxe** : le cadre doit se dessiner sur le rectangle de l'IMAGE, pas
  sur celui de l'élément. Sinon il dérive sur les sources qui ne remplissent pas le cadre.
- **`<video>` ne se déplace pas dans un fichier de 60 s sans HTTP Range/206.** Le serveur le sert.
- Deux touches sur `3` (« caler 3 s » et « milieu ») — collision trouvée à l'usage, « caler » est
  passée sur `T`.

⚠️ **La durée du manifeste est un entier, celle du navigateur ne l'est pas** (21 contre 21,56) : la
validation des segments porte une tolérance de 2 s, avec la raison en commentaire. Sans elle, un
segment légitime en fin de clip aurait été refusé.

⚠️ **Le garde local a refusé les `POST` de vérification** — il n'a pas été contourné. La validation
a été éprouvée autrement : `essai-validation.mjs` extrait les fonctions du serveur livré et les
exerce sur **18 cas, 18 verts**. Un de ces cas était faux à l'écriture (un carré pleine hauteur ne
peut pas commencer ailleurs qu'en `y = 0`) : **le serveur avait raison, le test avait tort.**

---

## 5. L'encodage — et la projection fausse d'un facteur 3 à 4

Recette reprise telle quelle du relevé du 2026-08-10 (`ETAT.md` §3) : **3 s, 480 px, 24 i/s, muet**,
AV1 (svt, crf 40) livré, H.264 (x264, crf 28) en repli, poster JPEG 720 px. Sortie vérifiée à la
sonde : **480×480, 24 i/s, 72 images = 3,000 s, un seul flux, aucun son**.

| | poids | l'unité |
|---|---|---|
| AV1 | **8,17 Mo** | 85,4 Ko |
| H.264 | **10,81 Mo** | 113,0 Ko |
| posters | **3,45 Mo** | 36,0 Ko |
| **AV1 + posters** | **11,62 Mo** | |
| **les deux formats + posters** | **22,43 Mo** | |

⛔ **`ETAT.md` projetait « 2,8 à 6,2 Mo d'AV1 + 2,0 Mo de posters ». Faux d'un facteur 3 à 4 — et le
CRF n'a pas bougé d'un point.** Trois facteurs se multiplient : la vignette est devenue **carrée**
(×1,5 à 2,0), la découpe rend **98 segments et non 62 clips**, et **deux formats** sont produits là
où la projection en comptait un. ⚠️ **Aucune de ces trois causes n'est un réglage** : une projection
de poids se refait quand la FORME du livrable change, pas seulement quand le codec change.

⚠️ Le rapport « c'est le mouvement qui fixe le poids » **tient toujours mais s'est resserré**, de
2,3× à 1,7× en carré. Il ne se recopie pas d'un format de cadre à l'autre.

▶ **Levier chiffré, non tiré** : un poster par geste au lieu d'un par segment ramène 3,45 Mo à
~1,8 Mo. Il suppose la première image des trois segments interchangeable — **non vérifié**.

---

## 6. Licences — relevé de texte, pas d'intuition

Tout est dans `reference/LICENCES_MEDIAS.md`, avec URL et date pour chaque clause **et la liste de
ce qui n'a pas pu être vérifié** (`help.pexels.com` répond 403, `web.archive.org` est refusé par
l'outil : l'historique de la clause est indatable).

⛔ **Une affirmation antérieure de la session était fausse et a été corrigée** : la clause qui mord
n'est pas « autres plateformes de stock » (page `/license/`, inapplicable ici) mais **« Standalone »**
(conditions générales du 15 novembre 2024). Et elle est nommément contre nous : *« solely using a
filter, changing colors, **resizing or cropping** the Content **remains Standalone use** »*. Découper
à 3 s, recadrer et réduire **n'est pas** l'effort créatif qui fait sortir du régime. → **décision 69,
ouverte**, à trancher par une réponse écrite de Pexels et rien d'autre.

▶ **Règle de conception appliquée en attendant, sans rien coûter** : aucun clip n'est jamais offert
comme fichier séparé — pas de bouton « télécharger le média », pas d'export de pack.

▶ **Second volet, plus immédiat : le droit à l'image.** Pexels ne garantit **rien**. Dans une appli
de nutrition, un visage identifiable à côté d'un propos de santé se lit comme une caution. → à
qualité égale, **préférer les mains au visage** ; le recadrage carré sert d'abord à ça.

✅ **CapCut tranché, et il ne rouvre pas la 69** : accepté en exploration, **exclu de la production
des fichiers livrés** — pour la reproductibilité (52 exports manuels ne se refabriquent pas), et
parce qu'un seul élément CapCut rendrait fausse, en silence, l'affirmation de licence unique du
manifeste.

---

## 7. Ce qui n'est pas fait, et ce que ça bloque

1. ⛔ **Le lexique n'a AUCUN champ pour porter un média** — ni dans le YAML source, ni dans
   `catalog/build.mjs`, ni dans `LexiconEntry`, ni à l'écran. **Les 98 clips et les photos n'ont
   nulle part où s'accrocher.** C'est un lot de code à part entière, 4 fichiers au moins.
2. **La décision 68 (budget P6) n'est plus reportable.** Photos à couverture complète : ~16 Mo pour
   un critère de 15. Plus l'option la plus légère de clips : ~27,6 Mo. ⚠️ **Mais le vrai sujet est
   un périmètre, pas un sacrifice** : ce seuil a été écrit pour un **premier chargement web**, avant
   le cache à deux étages (les médias lourds n'y sont pas) et avant Capacitor (plafond AAB 150 Mo).
   On mesure un paquet complet contre un budget de socle.
3. **Demande utilisateur en attente de validation, non exécutée** : retirer les cadres **sauf**
   celui d'`eponger` (*Man drying a meat with tissue*), et sortir les clips **au rapport de la
   source** au lieu du carré. Cela impose de réencoder les 98 segments. ⚠️ La baisse de poids
   attendue (~12-13 Mo) est une **projection** — à remplacer par la mesure, la dernière projection
   de ce document s'étant trompée d'un facteur 3.
4. Les **4 commandes qui font foi n'ont pas été relancées** : aucune ligne d'`app/` ni de `catalog/`
   n'a été touchée de la session. Le dernier relevé vert reste celui du 2026-08-10.

---

## 8. Ce qu'il faut retenir, si on ne lit qu'un paragraphe

**Trois mesures fausses ont été trouvées dans cette session, et aucune des trois n'a fait rougir
quoi que ce soit** : un manifeste qui annonçait 640 pour du 1920, un `NaN` affiché en « muet », une
projection de poids basse d'un facteur 3. Elles ont été trouvées par des vérifications qui ne
cherchaient pas de bug — un poids de fichier qui détonnait, un compte qui ne tombait pas juste.
⛔ **Le vert n'est pas une preuve, et l'absence d'erreur encore moins.**
