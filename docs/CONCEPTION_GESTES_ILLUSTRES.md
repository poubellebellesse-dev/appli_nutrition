# Conception — le lexique des gestes illustré

> Cadrage du 2026-08-14. **Lots 1 et 3 LIVRÉS le 2026-08-16** (`e259bcb`, `de2ba39`) · **lot 2
> PARTIEL, et volontairement** (`803fc42` — 3 gestes sur 51, décision de l'auteur) · **lot 4 à faire**.
> L'état chiffré vit dans `ETAT.md` ; ce document ne porte que le découpage et les questions.
> ⚠️ **Cet en-tête a annoncé « aucune ligne de code n'a été écrite » pendant que les lots 1 à 3
> étaient codés, verts et posés dans l'arbre.** Corrigé le 2026-08-16, au moment de leur commit.
> L'en-tête d'un document de conception se corrige dans le lot qui le dément, pas plus tard.

---

## 0. ⛔ Le motif de départ a été écarté — à lire avant le reste

Ce cadrage a d'abord été demandé pour une raison qui n'était pas la bonne : **Pexels a répondu le
2026-08-14 « send us a sample of the final outcome showing how the Pexels photos and video segments
appear within the application »**, et l'écran qui montrerait les clips n'existe pas. L'idée était de
le construire pour avoir quelque chose à leur envoyer.

✅ **CE MOTIF EST ABANDONNÉ, DÉCISION UTILISATEUR DU 2026-08-14 : le chantier se fait pour
lui-même, comme n'importe quel autre.** Cette section reste écrite parce que le raisonnement qui l'a
écartée vaut d'être conservé — et pour qu'on ne le refasse pas.

**Trois objections, et elles tiennent.**

1. ⛔ **La décision 69 est DÉJÀ FERMÉE** (§4, tranchée par l'utilisateur le 2026-08-14, le jour même
   de leur réponse). Le produit n'attend pas leur feu vert. Construire l'écran ne réduit **aucun**
   risque juridique — ça produit une capture d'écran. Et si la réponse est « retirez-les », le
   pipeline vidéo aura été bâti autour d'un contenu à éjecter.
2. ⛔ **Ce n'est pas nécessaire pour leur répondre.** La moitié « photo » de leur question a déjà une
   réponse réelle : les photos s'affichent (`f3d4fa1`). ⚠️ **Précision qui compte** : ce commit vit
   dans la branche `lot/photo-affichage` et **n'est PAS fusionné dans `main`** ; il n'illustre que
   l'écran des suggestions du jour, **pas la fiche détail**. La moitié « vidéo » a une réponse
   honnête en une phrase : **aucun clip n'est intégré au produit livré**. Ce n'est pas un trou à
   combler avant de répondre, c'est un fait à communiquer.
3. ⚠️ **Personne n'a examiné si montrer l'écran n'AGGRAVE pas la réponse.** L'architecture sert les
   médias par chemin référencé (§7.1), donc en fichiers individuels adressables. Si l'objection de
   fond de Pexels porte sur la facilité de récupérer leur fichier hors de l'application,
   **l'échantillon peut confirmer leur hypothèse au lieu de la lever.** À peser avant d'envoyer
   quoi que ce soit.

**⇒ Ce chantier ne doit PAS être fait pour répondre à un courriel.** Il a sa propre justification,
écrite au §1, et c'est la seule qui décide de son ordonnancement. ⚠️ **Corollaire à ne pas perdre :
la réponse à Pexels est désormais indépendante de ce chantier.** Elle se donne avec ce qui existe
et une phrase honnête sur ce qui n'existe pas — pas en attendant que le lot 3 soit livré.

---

## 1. Le problème

Le lexique définit **62 gestes par des mots seuls**, alors que plusieurs ne se distinguent que par
une **évolution dans le temps** qu'aucun texte ni aucune image fixe ne peut montrer.

Ce n'est pas une intuition, c'est mesuré (`ETAT.md` §3, l.609-614) : `suer` est « rendre son eau
**sans colorer** », c'est-à-dire `revenir` moins la coloration. Sur les **24 candidates photo de
`suer`, aucune n'était utilisable** ; sur 4 clips regardés en quatre images étalées sur leur durée,
la coloration se lit d'un coup d'œil. Même famille : `revenir`/`sauter`/`poeler`,
`mijoter`/`braiser`.

---

## 2. Ce qui est dans le périmètre

- Un **champ média** sur le lexique, de bout en bout : YAML source → `catalog/build.mjs` → colonne
  SQL → type `LexiconEntry` (`app/src/engine/domain/catalog.ts:664-669`, 4 champs aujourd'hui,
  aucun média).
- Un **script d'import** des clips depuis le bac externe vers le dépôt, **sur le modèle exact de
  `catalog/import-photos.mjs`** : même forme, même écriture dans les YAML, même régénération des
  crédits.
- Une **section vidéo dans `catalog/CREDITS.md`** — il n'en existe aucune aujourd'hui.
- L'**affichage** dans l'écran existant `app/src/ui/screens/savoir.tsx` : le lexique est déjà un
  accordéon (terme replié → définition dépliée). ✅ **L'écran n'est pas à créer**, seulement à
  enrichir.
- Le **passage par le service worker**, avec la répartition déjà décidée : **poster pré-caché, clip
  à la demande** (`ETAT.md` §3, l.601-608).

---

## 3. ⛔ Ce qui est HORS périmètre

Écrit **avant** le découpage en lots, exprès.

- ⛔ **La photo sur la fiche détail.** C'est le lot `photo-detail`, déjà briefé et testé dans
  `wt-photo-affichage`. Il a sa propre justification (c'est l'écran principal d'une application de
  recettes) et ne dépend pas de celui-ci. **Ne pas les fusionner.**
- ⛔ **Le mode cuisine.** `app/src/ui/gestes-etape.tsx` consomme déjà le lexique ; il n'affichera
  **aucun clip** dans ce chantier.
- ⛔ **Les galeries d'états** (cuisson, caramel) et le **clip « quand ça rate »** des gestes à
  risque, tous deux prévus au §3 mais hors de ce lot.
- ⛔ **Toute nouvelle récolte de clips.** On travaille avec les 98 segments déjà encodés, point.
- ⛔ **Le choix des sources.** La décision 69 est fermée ; on ne la rouvre pas ici.
- ⛔ **L'empaquetage Capacitor.** Le chantier vise le web ; l'APK est une porte de sortie, pas une
  cible de ce lot.

---

## 4. Décisions à prendre — je ne peux trancher aucune

### D1 — Le budget P6. ⛔ BLOQUANTE, rien ne commence sans elle

C'est la **décision 68**, ouverte depuis le 2026-08-10, et ce chantier la rend « non reportable »
(`ETAT.md:651-654`). Les chiffres, mesurés et non estimés :

| | poids |
|---|---|
| `dist/` à couverture photo complète (330 recettes) | **~16,0 Mo** |
| clips, AV1 + posters | **11,62 Mo** |
| clips, les deux formats + posters | **22,43 Mo** |
| **total projeté** | **~27,6 à 38 Mo** |
| **critère P6** | **15 Mo** |

⛔ **Aucun réglage de compression ne referme cet écart.** Options :

- **(a) Ne PAS compter les médias à la demande dans P6.** L'architecture §7.1 les sort déjà du
  pré-cache ; le critère mesurerait alors le **premier chargement**, ce pour quoi il a été écrit.
  **Coût : nul en code, mais il faut réécrire ce que P6 mesure** — et personne n'a vérifié que le
  reste du dépôt lit P6 dans ce sens.
- **(b) Relever le critère.** Il n'a jamais eu de justification mesurée sur appareil, et le plafond
  d'un AAB est de 150 Mo. **Coût : une décision, aucun code.**
- **(c) Livrer moins de segments.** 98 segments pour 51 gestes ; 21 gestes seulement ont pris
  `unique`. **Coût : on perd la démonstration avant/pendant/après, qui est la raison d'être du clip.**
- **(d) Un seul format.** Voir D2 — impossible en l'état.

### ~~D2~~ — Un format ou deux ? ✅ TRANCHÉE le 2026-08-14 : **LES DEUX**

**Deux `<source>` dans la balise `<video>`** — AV1 d'abord, repli H.264. Le navigateur choisit.
**Coût retenu en connaissance de cause : 22,43 Mo** (18,98 de vidéo + 3,45 de posters), contre
14,26 Mo pour un H.264 seul qui aurait été universel lui aussi. **L'écart de 8,2 Mo achète ~2,6 Mo
de bande passante en moins sur les appareils récents seulement.**

⛔ **Ce qui rendait AV1 seul impossible reste vrai et explique le choix** : Safari ne décode l'AV1
que sur matériel récent (`ETAT.md:655-657`) ; sans repli, un iPhone un peu ancien n'aurait affiché
que l'image fixe, **sans que l'utilisateur sache qu'il manque quelque chose**.

⚠️ **Conséquence pour le lot 2** : l'import copie **deux fichiers par segment**, pas un. Le compte
attendu est donc **196 fichiers vidéo + 98 posters**, et non 98 + 98.

### ~~D4~~ — Les binaires vidéo dans git ? ✅ TRANCHÉE le 2026-08-14 : **OUI, comme les photos**

Versionnés dans `app/public/catalog/gestes/`, exactement comme les 4,4 Mo de photos de
`app/public/catalog/images/`. Aucun outil supplémentaire, aucune configuration, cohérent avec
l'existant.

⛔ **CE QUE ÇA ENGAGE, ET C'EST IRRÉVERSIBLE** : **+22,43 Mo dans l'historique git, définitivement**
— combiné avec D2, pas les 14,26 Mo d'un format unique. Un `git clone` les téléchargera **même après
une suppression ultérieure**. ⚠️ **Les deux options écartées le sont pour de bonnes raisons, à ne
pas rouvrir sans fait nouveau** : git LFS impose un outil sur chaque poste et casse les worktrees
existants ; ne pas versionner ferait produire, sur toute autre machine, **un catalogue sans clips
sans lever la moindre erreur** — le bac source `G:\Claude\Dessinateur\gestes` n'existe que sur une
machine. C'est la famille d'échec silencieux que ce dépôt a déjà payée trois fois.

### ~~D3~~ — Un poster par geste, ou un par segment ? ✅ FERMÉE le 2026-08-14 : **UN PAR SEGMENT**

⛔ **Fermée non pas tranchée : le choix d'interface l'a rendue sans objet.** La variante retenue
(voir la décision d'interface ci-dessous) affiche une **bande de vignettes, une par moment**. Deux
vignettes identiques dans une bande dont le rôle est de les distinguer ne servent à rien. Le levier
chiffré **3,45 Mo → ~1,8 Mo** (`ETAT.md:648-650`), jamais tiré, ne peut donc plus l'être.

**Ce que ça coûte, dit une fois** : les 98 posters restent, soit **3,45 Mo** — pas 1,8. La vignette
de la ligne repliée **réutilise le poster du premier segment** : elle n'ajoute aucun fichier.

### ✅ D6 — Comment un geste s'affiche. TRANCHÉE PAR L'UTILISATEUR le 2026-08-14

Quatre mises en page ont été maquettées **avec les clips réels**, pas décrites :
[maquettes](https://claude.ai/code/artifact/f2cf92ae-eb53-47a3-a6fc-3e4623986277). Retenu :

> **Un cadre unique + la bande des moments (variante D), ET la vignette dans la ligne repliée
> (variante C).**

Trois conséquences, toutes portées ailleurs dans ce document :

1. **D3 est fermée** — un poster par segment, ci-dessus.
2. **Le schéma du lot 1 gagne une colonne `moment`.** La bande nomme ce qu'elle montre. Numéroter
   1-2-3 ne suffit pas : **`deglacer` ne porte que `milieu` et `fin`**, il afficherait « 1 » devant
   un milieu. Le nom existe déjà dans les fichiers encodés — **29 `debut`, 23 `milieu`, 25 `fin`,
   21 `unique`, 98 en tout** — il ne manque que la place où le poser.
3. ⚠️ **Les 11 gestes sans clip auront un carré vide dans la liste, en permanence.** C'était le
   coût nommé de la variante C au moment du choix ; il a été accepté. Ce n'est pas une dette, c'est
   un prix payé les yeux ouverts. **Ne pas rouvrir ce point sans un fait nouveau.**

### ~~D5~~ — Combien de gestes illustrés au premier passage ? ✅ TRANCHÉE le 2026-08-16 : **TROIS**

⛔ **CE DOCUMENT A ANNONCÉ 51/62 JUSQU'AU 2026-08-16. C'EST TROIS** — `deglacer`, `emincer`,
`reduire`, soit 6 segments et 18 fichiers. **Décision de l'auteur**, prise devant le coût
irréversible de D4 : chaque segment importé pèse dans l'historique git **pour toujours**, et les
98 segments font 22,43 Mo. L'échantillon prouve la chaîne de bout en bout sans graver le lot complet.

⇒ **Le lot 2 reste donc OUVERT**, et son « Fini quand » (51/62, 196 vidéos, 98 posters) n'est **pas**
atteint. Ce n'est pas un échec du lot : c'est sa portée qui a été réduite, les yeux ouverts.

⛔ **`suer` N'EST PAS DANS L'ÉCHANTILLON, ET C'EST LE GESTE QUI JUSTIFIAIT LE CHANTIER** (§1 :
« suer » contre « revenir »). 24 candidates photo, **zéro segment encodé**. La démonstration qui a
motivé tout ce travail n'est toujours pas montrable — ce n'est pas le lot 2 qui la livrera.

✅ **L'ÉCART « 99 DÉCIDÉS / 98 ENCODÉS » EST EXPLIQUÉ**, mesuré par l'import le 2026-08-16 : ce n'est
**pas** un segment jamais produit, c'est un **2→1 sur `emincer`**. La décision porte `debut` +
`milieu` ; le bac contient un unique `emincer-unique`, ré-encodé en un seul segment sans que la
décision soit reprise. ⇒ **Le fichier de décisions n'est pas un index de ce qui existe** : il dit
*si* on importe et *à qui* appartient la vidéo, le dossier `encode/` dit *ce qui existe*. Les
confondre importerait des chemins vers des fichiers absents.

---

## 5. Les lots

⚠️ Chaque « Fini quand » se vérifie **contre `catalog.db` réel**, jamais contre une fixture.

### Lot 1 — le champ média du lexique (données, aucun pixel) ✅ **LIVRÉ le 2026-08-16 (`e259bcb`)**

⚠️ **LE SCEAU A ÉTÉ LEVÉ SUR `gestes-champ-media.test.ts`, SUR DÉCISION DE L'AUTEUR, CONFIRMÉE.**
Deux assertions retirées — « les 62 fiches portent `clips` **et il est vide** » (critère 4) et « les
60 autres gestes ont **zéro** clip » (critère 6). Toutes deux portaient sur le **contenu du
catalogue**, jamais sur le sujet du lot : le « Fini quand » disait « vide partout **tant que le lot 2
n'a pas tourné** », le test ne portait pas la condition, et rendait donc le lot 1 structurellement
incompatible avec l'existence même d'un import. **Ce qui est gardé est ce qu'elles prouvaient
vraiment** : chaque fiche porte un **tableau**, jamais `null` ni absent ; et aucun geste n'hérite des
**témoins plantés**. Le pouvoir de détection est intact et devient **indépendant de ce que le
catalogue contient** — donc encore valable après le lot 2.

**Fini quand** :
1. `LexiconEntry` porte `clips: readonly LexiconClip[]` et `npm run typecheck` est propre.
2. `catalog.db` porte une table **`lexicon_clip`**, fille de `lexicon_entry`, avec
   `poster_path`, `av1_path`, `h264_path`, `moment`, `ordre`, et
   **`PRIMARY KEY (lexicon_entry_id, ordre)`**.
   ⛔ **Une table fille, pas des colonnes sur `lexicon_entry`** : un geste porte **1 à 3 segments**
   (22 gestes en ont 1, 11 en ont 2, 18 en ont 3). Trois colonnes plates écraseraient le deuxième
   segment en silence.
   ⛔ **`moment` est une colonne, pas un dérivé de `ordre`** — motif en D6 ci-dessus.
3. `node catalog/build.mjs` sort toujours **451 aliments, 330 recettes, 1 548 étapes, 62 gestes,
   73 tips, 8 fiches, 30 équipements** — inchangés.
   ⚠️ **Les SEPT comptes sont assertés par un test, pas seulement affichés.** Corrigé le
   2026-08-14 : la première rédaction promettait les sept et le test n'en vérifiait que trois
   (aliments, recettes, gestes). Casser le chargement des tips serait passé au vert. **Une promesse
   qui ne vit que dans la sortie console de `build.mjs` n'est lue par aucune machine.**
4. Un test lit `catalog.db` réel et vérifie que **les 62 fiches portent un tableau `clips`**,
   **vide** partout tant que le lot 2 n'a pas tourné.
   ⚠️ **Un tableau vide, pas `null`** — corrigé le 2026-08-14 : la première rédaction disait
   « valant `null` », ce qui ne veut rien dire pour une relation un-à-plusieurs.
5. ⛔ **Un test plante un clip À LA MAIN dans une COPIE de `catalog.db` et vérifie qu'il ressort
   tel quel.** Sans lui, une implémentation qui fabriquerait les chemins à partir du code du geste
   (`/catalog/gestes/${code}/poster.jpg`) satisferait tous les points ci-dessus sans lire une ligne
   de SQL.
6. ⛔ **Un test plante des clips sur DEUX gestes différents et vérifie que chacun ne voit que les
   siens — et que les 60 autres n'ont rien.** ⚠️ **Ajouté le 2026-08-14 après relecture, et c'est
   le point le plus important du lot** : les cinq critères précédents étaient tous satisfaits par un
   chargeur qui ferait `SELECT * FROM lexicon_clip ORDER BY ordre` **sans filtrer**, puis collerait
   le même tableau aux 62 fiches. Aucun n'exerçait deux gestes à la fois.
7. ⛔ **La clé composite est exercée, pas seulement lue.** Un second segment au même rang sur le
   même geste doit être **refusé** ; le même rang sur un **autre** geste doit rester **accepté**.
   ⚠️ Ajouté le 2026-08-14 : le critère 2 ne lisait la clé que dans le TEXTE du `CREATE TABLE`, où
   une clé neutralisée passe. Et une clé posée sur `ordre` seul passerait le refus tout en cassant
   l'import — **les 51 gestes ont tous un segment de rang 0**.
   ⚠️ **Et cet oubli n'est pas hypothétique, il est structurellement invité** : l'interface que
   `loadCatalogFrom` reçoit n'expose que `all(sql)` — **aucun paramètre lié**. On ne PEUT pas
   requêter geste par geste. La seule forme possible est une requête globale triée
   (`ORDER BY lexicon_entry_id, ordre`) **regroupée en `Map` côté JS**, et c'est exactement le
   regroupement qu'on oublie.

**Ce que le lot doit trancher, et qui n'était écrit nulle part** (relevé le 2026-08-14) :

- **`REFERENCES lexicon_entry(id)` est exigé**, comme sur `recipe_equipment` et
  `recipe_step_ingredient`. Sans lui, un clip survit à la disparition de son geste sans qu'aucune
  erreur se lève. ⚠️ Rappel du dépôt : `INSERT OR REPLACE` supprime la ligne avant de réinsérer et
  déclenche les `ON DELETE CASCADE` — utiliser `INSERT … ON CONFLICT DO UPDATE`.
- **`moment` PEUT porter un `CHECK`** sur `debut` / `milieu` / `fin` / `unique`, comme toutes les
  colonnes-énumérations de `build.mjs` (`origine`, `niveau`, `niveau_preuve`). ⚠️ **Les tests
  d'acceptation ont été corrigés pour le permettre** : leur valeur-témoin est légale, et ce qui
  discrimine est qu'elle soit **fausse pour son rang** (au rang 0, un code qui déduirait le nom
  rendrait « debut »). La première rédaction utilisait une chaîne inventée, qui aurait puni le
  codeur ayant suivi la convention du dépôt.
- **Le mapping s'écrit dans `catalog-loader.ts`**, partagé navigateur + Node.
  ⛔ **Pas dans `catalog-loader-node.ts`**, qui n'ouvre que le fichier — et **aucun import
  `node:*`** n'y entre : l'import est hoisté et casse le bundle même inutilisé.
- **`LexiconClip` expose `posterPath`, `av1Path`, `h264Path`, `moment` — et PAS `ordre`.** Le
  tableau est déjà rangé ; exposer le rang inviterait l'écran à retrier et à diverger de la base.
  Le numéro affiché par la bande est la position dans le tableau, pas une colonne.
  ▶ **Le type vit dans `app/src/engine/domain/catalog.ts`, à côté de `LexiconEntry`, exporté** —
  comme tous les types du domaine. `moment` est une **union littérale**
  (`'debut' | 'milieu' | 'fin' | 'unique'`), pas un `string` : c'est ce qui rend le `CHECK` SQL et
  le type d'accord, et ce qui fait échouer la compilation si un cinquième nom apparaît un jour.
- **`NOT NULL` sur `poster_path`, `av1_path`, `h264_path` et `moment`.** Un segment sans son H.264
  est inutilisable (décision D2), et un `moment` nul se lirait `null` à travers un type qui promet
  une chaîne — l'écran planterait au montage, pas au chargement.
- **Le regroupement en `Map` a déjà son outil : `groupByKey` dans `catalog-loader.ts`.** Il n'y a
  pas de précédent à inventer, seulement un helper à réutiliser.
- **Ordre d'insertion dans `build.mjs` : après `lexicon_entry`**, par analogie avec
  `recipe_equipment` inséré avant les recettes. `PRAGMA foreign_keys = ON` est déjà posé.
- ⚠️ **Relancer `node catalog/build.mjs` AVANT les tests scellés.** Ils lisent
  `app/public/catalog/catalog.db` **tel qu'il est sur le disque** et ne le régénèrent jamais. Un
  codeur qui modifie le schéma sans rebâtir verra « la table `lexicon_clip` n'existe pas » sans
  qu'aucun message ne lui dise que c'est son propre travail qu'il n'a pas compilé.

⚠️ **Piège nommé** : « un champ déclaré n'est pas un champ branché » — trois occurrences déjà payées
dans ce dépôt, dont `imagePath` lui-même. Ce lot déclare ; il ne prétend rien afficher.

### Lot 2 — l'import des clips ⏳ **PARTIEL le 2026-08-16 (`803fc42`) — LE LOT RESTE OUVERT**

⛔ **LE SCRIPT EST FINI, L'IMPORT NE L'EST PAS.** `catalog/import-clips.mjs` existe et fait les trois
gestes ensemble (copie, YAML, crédits) ; il n'a tourné que sur **3 gestes sur 51** — voir D5,
tranchée le 2026-08-16. Le « Fini quand » ci-dessous est **celui du lot complet** et n'est pas
atteint : il reste la référence du jour où l'import complet sera lancé, pas une promesse tenue.

**Fini quand** :
1. `node catalog/import-clips.mjs` copie les segments du bac vers `app/public/catalog/gestes/`,
   écrit les chemins dans les YAML du lexique, et **régénère une section « Clips de gestes » dans
   `catalog/CREDITS.md`** avec auteur, licence et source pour chaque fichier.
2. Le compte tombe, relevé sur `catalog.db` réel et non annoncé : **51 gestes illustrés sur 62**,
   **196 fichiers vidéo** (deux formats × 98 segments) et **98 posters**. ⛔ **Un compte qui ne
   tombe pas est un échec du lot, pas un détail à expliquer dans le rapport.**
3. `du -sh app/public/catalog/gestes` est **collé dans le rapport**, et `dist/` est **remesuré** —
   ⚠️ la règle « la mesure se prend sur `dist/`, jamais sur le bac » a déjà été enfreinte une fois
   par le lot qui l'avait écrite.

### Lot 3 — l'affichage ✅ **LIVRÉ le 2026-08-16 (`de2ba39`)** *(dépendait du lot 1 et du lot 2)*

⚠️ **UN CRITÈRE RESTE DÛ, ET IL NE SE PREND PAS ICI : le n° 7**, le nombre de requêtes au premier
affichage de l'écran Savoir. La vignette dans la ligne fait passer **62 images** au montage contre
**une** avant. Ni jsdom ni un navigateur de bureau ne le mesurent — il se prend **avec le chrono de
`#/recettes`**, sur le même appareil, au même moment. ▶ `RETOUR_ESSAI_TELEPHONE.md` §0.

⛔ **La mise en page n'est plus à décider : D6 l'a fixée le 2026-08-14** —
[maquettes](https://claude.ai/code/artifact/f2cf92ae-eb53-47a3-a6fc-3e4623986277), variante D plus
la vignette de C. Le « Fini quand » ci-dessous décrit **cette** mise en page et aucune autre ; la
première rédaction disait seulement « montre son poster », ce qui laissait le lot libre de choisir
n'importe laquelle des quatre.

**Fini quand** :
1. **La ligne repliée porte une vignette** — le poster du premier segment — pour les **51** gestes
   illustrés, et un **carré vide** pour les **11** autres. Vignette et carré vide font au moins
   `--spacing-tactile` de haut, et la vignette n'est **pas** une cible cliquable distincte : tout
   le rang ouvre le panneau.
2. **Déplié, un geste illustré montre UN cadre** — poster d'abord, lecture **au clic**, jamais en
   automatique.
3. **Sous le cadre, une bande de vignettes, une par segment, dans l'ordre de la colonne `ordre` et
   nommée par la colonne `moment`.** Cliquer une vignette change le segment joué sans replier le
   panneau. ⛔ **La bande n'apparaît pas quand il n'y a qu'un segment** — 22 gestes sur 51 sont dans
   ce cas, et une bande à un seul élément ne distingue rien.
4. Un geste **sans** média se déplie exactement comme aujourd'hui : ni cadre, ni bande, ni trou.
5. Le clip est **muet**, sans contrôles natifs ni téléchargement (`controlsList="nodownload"`) —
   contrepartie de la décision 69, « pas de bouton pour sortir le média ».
6. Un test d'écran monte le lexique sur `catalog.db` réel et **pilote jusqu'à un geste illustré à
   plusieurs segments**, sans jamais lire « le premier de la liste ». ⚠️ Piège déjà payé le
   2026-08-13. Il vérifie **le changement de segment au clic**, pas seulement la présence de la
   bande — c'est là que la variante D se distingue de toutes les autres.
7. ⚠️ **Le témoin qui coûte, à relever et à coller** : le nombre de requêtes au premier affichage de
   l'écran Savoir. La vignette dans la ligne fait passer **62 images** au montage, contre **une**
   aujourd'hui. ⛔ **Ce chiffre n'est mesurable ni en jsdom ni sur un navigateur de bureau** — il
   rejoint le chrono de `#/recettes` qui manque déjà pour fermer la décision 61, et se prend au
   même moment, sur le même appareil.

⛔ **TERRAIN NON BALISÉ, ET C'EST LE RISQUE PRINCIPAL DE CE LOT** : rien dans le dépôt ne documente
`<video>` sous jsdom, où `HTMLMediaElement.play()` lève. Il n'existe **aucun précédent de test
d'affichage de média** — `imagePath` n'étant lu par aucun écran, il n'y a rien à copier.

### Lot 4 — le hors-ligne ✅ **LIVRÉ le 2026-08-16** — *sans hash : pas encore commité*

> ⚠️ **PAS DE HASH, ET C'EST UNE INFORMATION.** Le travail n'a pas été commité : sur ce dépôt, Claude
> ne commite que sur ordre explicite. Tant que la ligne est vide, **la livraison n'est rattachée à
> rien** — c'est vrai pour ce lot comme pour tout autre. À remplir au commit, pas avant.
>
> ✅ **Les 12 critères sont verts** — 11 tests, `tests/scelles/gestes-hors-ligne.test.ts`.
> ⚠️ **Le sceau a été levé une fois APRÈS la livraison du code**, sur décision de l'auteur, pour
> quatre corrections qui ne touchent **aucune ligne de production** : armer le piège anti-proxy du
> critère 5 (qui échouait sur sa propre pré-condition, donc ne jugeait rien), exercer le prédicat en
> profondeur (critère 6), interdire un nom de cache versionné (critère 9), et rendre l'oubli de
> `.clone()` observable. Les quatre venaient de la **troisième** attaque. Le sceau a été remis.

> ⛔ **CE BRIEF A ÉTÉ ATTAQUÉ DEUX FOIS LE 2026-08-16, ET IL EST TOMBÉ DEUX FOIS.** Verdict identique
> les deux fois : *« ils ne discriminent pas »*. Ce qui suit est la **troisième** version.
>
> **Première attaque** — le balayage (1, 2, 3, 8) résistait ; **la conservation au runtime, sujet
> même du lot, se trichait trois fois** (5 par la taille du fichier, 6 par deux URL en dur, 7 parce
> qu'il lisait du TEXTE au lieu d'un comportement), dont le critère 7 censé être le garde-fou. Et
> elle a fait apparaître le critère **9**, qui n'existait pas : un trou de **conception**, pas de
> mesure, que rien n'aurait révélé avant la production.
>
> **Seconde attaque** — deux touches plus dures : **rien n'obligeait `generateBundle` à APPELER
> `mediasDeGestes`** (une liste des 6 URL réelles avec leurs empreintes collées passait 1 et 2 —
> quatrième occurrence du piège « déclaré ≠ branché », que le critère 7 fermait pour le prédicat et
> laissait ouvert pour le balayage) ; et le **critère 9 dégénérait** si l'on rangeait les clips dans
> `CACHE` lui-même, l'assertion devenant vraie par construction. Plus trois touches moins graves :
> `mtimeMs` remplaçait la taille au critère 5, un `cache.put` **détaché** passait le 7, et
> `includes('brouillons')` remplaçait un calcul de profondeur au 3 bis.
>
> ⚠️ **Ce qui a changé est écrit dans chaque critère concerné, en toutes lettres.** On ne réécrit pas
> un critère cassé en silence : sinon la même triche revient au lot suivant.
>
> ⚠️ **Le « Fini quand » d'origine faisait trois lignes et n'était pas chiffré.** Réécrit au brief,
> après avoir mesuré l'état réel du service worker. Les trois points sont conservés ; ce qui change
> est qu'ils sont devenus falsifiables, et qu'un **quatrième sujet a été trouvé** : la conservation
> après première lecture, exigée par `ARCHITECTURE.md` §7.1 l.982 et absente du plan.

**Ce que la mesure a trouvé, et qui n'était écrit nulle part** (relevé du 2026-08-16, `vite build`
réel) :

- ⛔ **`catalog/gestes` apparaît ZÉRO fois dans `dist/sw.js`.** Les 18 fichiers sont bien copiés dans
  `dist/`, mais **aucun n'est pré-caché ni ne compte dans la version du cache**. ⇒ **Hors ligne, les
  vignettes du lexique sont cassées** — c'est le lot 3 qui a introduit ce trou, et personne ne
  l'aurait vu en ligne.
- ⛔ **Le service worker ne fait AUCUN `cache.put`.** Il sert depuis le cache, et va au réseau quand
  il n'a rien — sans rien garder. ⇒ **Un clip regardé en ligne est perdu hors ligne**, alors que
  §7.1 l.982 dit « à la 1ʳᵉ consultation, **puis conservé** ».
- ⚠️ **Le critère « un nom de fichier porte une empreinte de contenu » CONTREDIT le mécanisme en
  place**, dont l'en-tête dit exactement l'inverse : « LA VERSION DU CACHE HACHE LE CONTENU, PAS LES
  NOMS ». **Tranché au brief : c'est le contenu qui est haché, pas le nom renommé** — voir critère 5.
- ⚠️ **Écart constaté et NON corrigé ici** : §7.1 range les **photos de recettes** dans l'étage « à la
  demande », mais `imagesPubliques()` les **pré-cache toutes** (116 aujourd'hui), avec un motif écrit.
  Le code dévie du document depuis le 2026-07-30. **Ce lot ne tranche pas cette déviation** ; il s'y
  conforme pour les posters, qui sont dans le même cas — 62 vignettes au montage de l'écran Savoir.

**Fini quand** — tout se vérifie sur un `vite build` **réel**, sur une fonction pure contre un dossier
temporaire, ou sur le **worker émis EXÉCUTÉ** dans un `node:vm` — **jamais sur une fixture qui
redirait la même chose, et jamais en lisant un texte quand un comportement est mesurable** :

1. ⛔ **LE BUILD TOURNE SUR UN `publicDir` TÉMOIN, ET DÉCOUVRE UN GESTE INVENTÉ.** `app/public` est
   copié dans un dossier temporaire (8,3 Mo), on y ajoute un geste `zzz-build-temoin` qui n'existe
   pas au catalogue, et Vite build là-dessus via son **API JS** en réutilisant `vite.config.ts` tel
   quel — seul `publicDir` change. `A_PRECACHER` doit contenir le poster de ce geste, tous les autres
   `*.jpg`, et **aucun** `.mp4`. ⚠️ **C'est ce qui oblige `generateBundle` à APPELER `mediasDeGestes`.**
   Sans ce point, une liste des 6 URL réelles avec leurs empreintes sha-256 collées une fois passait
   les critères 1 et 2 sans rien balayer — quatrième occurrence du piège « déclaré ≠ branché ».
   ⚠️ **Aucune écriture dans le dépôt** : modifier `app/public/` le temps d'un build aurait été plus
   court, et faux — les autres fichiers de test buildent en parallèle.
2. **Le compte monte exactement du nombre de posters, et pas d'une entrée de plus** : **131 → 137**
   sur l'arbre du 2026-08-16, **138 sur le `publicDir` témoin** (le geste inventé en ajoute un).
   ⛔ Plus haut veut dire qu'un clip est entré ; ce critère est ce qui distingue « les posters sont
   dedans » de « le dossier entier est dedans ». Le nombre se **compte sur le disque**, jamais gravé.
3. ⛔ **LE BALAYAGE EST PROUVÉ SUR UN DOSSIER INVENTÉ, PAS SUR LES SIX VRAIS.** Une fonction pure
   exportée, testée contre un dossier temporaire portant des gestes qui n'existent pas au catalogue,
   rend leurs posters et **pas** leurs clips. ⚠️ **C'est LE critère qui tue la triche** : une liste
   des 6 posters écrite à la main satisfait les critères 1 et 2 sans balayer quoi que ce soit.
   ▶ Précédent exact à copier : `imagesPubliques` et ses tests, `version-cache-sw.test.ts:85-137`.
3 bis. ⛔ **Exactement UN niveau de sous-dossiers sous `catalog/gestes/`**, un dossier par code de
   geste — assertion **de forme** : toute URL rendue vaut `/catalog/gestes/<geste>/<fichier>`.
   **Deux** sous-dossiers profonds attendent, de noms différents (`brouillons/` et `archive/`), et le
   second porte un nom de fichier parfaitement légitime. ⚠️ **Un `if (!chemin.includes('brouillons'))`
   passait la version précédente sans jamais compter un niveau** ; il tombe sur `archive/`. Et un
   dossier `catalog/gestes/` **absent** rend deux listes vides sans lever — même choix
   qu'`imagesPubliques`, sinon le build casse chez quiconque n'a pas lancé l'import.
3 ter. **Les deux listes sont INDÉPENDANTES : aucun appariement n'est supposé.** Le bac témoin porte
   un geste avec un clip et **sans** poster, et un geste avec un poster et **sans** clip. Cas ni
   exercé ni tranché jusqu'ici ; il l'est maintenant, et c'est le cas réel de `suer` (24 candidates,
   zéro segment encodé) qui arrivera un jour à l'envers.
4. ⛔ **Une LISTE BLANCHE d'extensions, pas une liste noire de noms.** Posters : `.jpg`. Clips :
   `.mp4`. **Six** intrus de six familles distinctes sont plantés dans le dossier témoin —
   `Thumbs.db`, `notes.txt`, `.DS_Store`, `desktop.ini`, `zzz-…jpg.bak`, `LISEZMOI` (sans extension)
   — et le test assère **positivement** que toute URL rendue porte une extension autorisée.
   ⚠️ **Deux intrus suffisaient à faire passer `if (nom === 'Thumbs.db' || nom === 'notes.txt')`**,
   qui n'exclut rien d'autre. ⚠️ Ce n'est pas théorique : `EXTENSIONS_IMAGE` existe déjà parce que
   l'explorateur Windows dépose des `Thumbs.db` dans les dossiers d'images.
5. ⛔ **Le CONTENU d'un clip entre dans la version du cache, à nom, TAILLE et MTIME identiques.**
   Ré-encoder un clip sans le renommer **doit** changer `versionDuCache`. **L'empreinte se calcule
   avec `empreinteDeFichier` (sha-256 des octets), pas avec un proxy.** ⚠️ **Trois proxys sont
   neutralisés, un par attaque successive** : le nom ne bouge pas ; la **taille** est identique des
   deux côtés (`String(statSync(f).size)` passait la v1, et deux ré-encodages de même poids sont
   banals en vidéo) ; le **mtime** est **restauré** après écriture (`String(statSync(f).mtimeMs)`
   passait la v2 — un `touch` aurait alors invalidé le cache pour rien, pendant qu'un checkout git
   uniformisant les dates aurait masqué un vrai changement). ⇒ **Il ne reste que le contenu.**
   ⚠️ **C'est la lecture retenue de « empreinte de contenu », et l'autre est refusée** : hacher le
   *nom* d'un `.mp4` ferait entrer un fichier de plus dans l'historique git à **chaque** ré-encodage,
   or D4 les y grave définitivement.
6. **Un clip consulté une fois est conservé** (§7.1 l.982). La décision « ce qui se conserve au
   runtime » est une **fonction pure exportée** de `vite-plugin-sw.ts`, comme `imagesPubliques` et
   `versionDuCache`. Elle rend **oui** pour les **12 clips réels du disque** *et* pour des clips de
   gestes **inventés** (`suer`, `blanchir`, les témoins) ; **non** pour un poster, `catalog.db`, une
   photo, un bundle `assets/`, une police, `/index.html`, `/`, et pour un `.mp4` **hors** du dossier
   des gestes. ⚠️ **Les gestes inventés sont ce qui tue la liste en dur** : deux URL littérales
   satisfaisaient la première version. C'est le levier du critère 3, appliqué au prédicat.
7. ⛔ **LE WORKER ÉMIS EST EXÉCUTÉ, PAS LU.** `dist/sw.js` est chargé dans un `node:vm` gréé en faux
   `ServiceWorkerGlobalScope` (`caches`, `self`, `fetch` bouchonnés), puis reçoit de vrais
   événements. **Le cache y est vide**, donc chaque requête atteint le point de décision. Attendu :
   un `cache.put` pour le clip, **zéro** pour le poster, `catalog.db`, un bundle, `/index.html`, une
   autre origine, et **zéro sur une réponse 404**. ⚠️ **La première version de ce critère lisait du
   TEXTE** — `sw.js.includes(source)` plus une regex `cache.put(` — et une constante jamais appelée
   plus un `put` **inconditionnel** la passaient au vert **en cachant tout**. Le garde-fou anti-triche
   était le plus facile à tricher. ⚠️ Piège nommé, payé trois fois ici, dont `imagePath` : un champ
   déclaré n'est pas un champ branché.
7 bis. ⛔ **L'ÉCRITURE EST MAINTENUE EN VIE, PAS DÉTACHÉE.** Le `cache.put` doit être **attendu dans
   la chaîne rendue à `respondWith`** *ou* **confié à `event.waitUntil`** — les deux styles sont
   acceptés, un `caches.open(…).then(c => c.put(…))` lâché dans le vide ne l'est pas : un vrai
   navigateur a le droit de le tuer dès la réponse rendue, et le clip ne serait jamais conservé.
   ⚠️ **Rendu observable par la forme du harnais** : `caches.open` et `cache.put` y résolvent sur
   **macrotâche**, comme une vraie entrée-sortie. Ce qui a fini avant qu'on lâche la main est
   protégé ; ce qui n'apparaît qu'après était détaché. **Vérifié dans les deux sens** — les deux
   styles corrects passent, le détaché tombe.
8. **Rien de l'existant ne régresse** : les **116** photos restent pré-cachées, et
   `tests/zero-requete-reseau.test.ts` et `tests/version-cache-sw.test.ts` restent verts **sans être
   modifiés**. Le lot **ajoute** un balayage, il n'en remplace aucun.
9. ⛔ **LE CACHE DES CLIPS EST NON VERSIONNÉ, ET SURVIT À UNE MONTÉE DE VERSION.** `activate` reçoit
   un cache périmé, le cache courant et le cache des clips : seul le périmé disparaît. **Le nom du
   cache des clips n'est pas imposé** — le test le découvre en regardant où le worker range le clip —
   **mais il doit différer du cache versionné**, et le test l'assère. ⚠️ **Sans cette inégalité le
   critère DÉGÉNÈRE** : ranger les clips dans `CACHE` lui-même réduit le triplet à un doublet, et
   l'assertion devient vraie par construction, pendant qu'à la montée de version suivante ce même
   cache devient l'ancien et se fait purger comme n'importe quel périmé. ⚠️ **Trou de CONCEPTION, pas
   de mesure, trouvé en attaquant ce brief** : `activate` supprime aujourd'hui tout cache dont le nom
   diffère du courant (`vite-plugin-sw.ts:146-155`). ⇒ **Règle positive à coder** : `activate` purge
   tout cache **sauf** le `CACHE` courant **et** le cache de conservation. C'est le seul critère qui
   vient d'un défaut, pas d'un manque.

**Ce que le brief PRESCRIT désormais, et que le codeur n'a plus à deviner** — chaque devinette est un
aller-retour payé plus tard, et ces cinq-là ont été trouvées en attaquant la première version :

| Ce qui manquait | Tranché |
|---|---|
| extensions des clips (pas d'équivalent d'`EXTENSIONS_IMAGE`) | **`.mp4` pour les clips, `.jpg` pour les posters** — liste blanche, critère 4 |
| profondeur du balayage | **un seul niveau** de sous-dossiers, un par code de geste — critère 3 bis |
| clip sans poster, poster sans clip | **les deux listes sont indépendantes**, aucun appariement — critère 3 ter |
| méthode de hachage de l'empreinte | **`empreinteDeFichier` imposé**, sha-256 des octets. Pas la taille, pas la date — critère 5 |
| `generateBundle` doit-il *appeler* `mediasDeGestes` | **oui**, et le build sur `publicDir` témoin l'y oblige — critère 1 |
| ce que reçoit `doitEtreConserve` | **le chemin** (`url.pathname`), pas l'URL absolue |
| nom du cache runtime des clips | **libre mais NON VERSIONNÉ**, et `activate` l'épargne explicitement — critère 9 |
| le `cache.put` doit-il être protégé | **oui** : attendu dans `respondWith` **ou** confié à `waitUntil` — critère 7 bis |
| filtrage des réponses avant `cache.put` | **une réponse en erreur ne se conserve pas** (404 testé) — critère 7 |

**Les tests d'acceptation** — `tests/scelles/gestes-hors-ligne.test.ts`, écrits le 2026-08-16 depuis
les critères seuls, **avant toute ligne de code**. **11 tests pour 12 critères** : `3 ter` est
vérifié dans le test du critère 3 (les listes du bac témoin le portent) et `7 bis` dans celui du
critère 7 (même consultation, deux constats). ⚠️ **Nommé d'après le lot et non `4.test.ts`** :
sur ce dépôt le nom du fichier scellé **est** le nom du lot, c'est ce qui a permis de retrouver le
lot 1 sous `gestes-champ-media`. ⚠️ **La moitié « sans être modifiés » du critère 8 n'est vérifiable
par aucun test** — elle se lit au `git diff --name-only` avant `/fin`, et nulle part ailleurs.

**Ce que le lot NE touche PAS** — hors périmètre, et le dire ferme la porte à l'élargissement :

- **`app/src/` en entier.** Le lot vit dans `vite-plugin-sw.ts`, à la racine. ⛔ Ni `savoir.tsx`, ni
  `catalog-loader.ts`, ni le moteur.
- **Le catalogue.** Aucun YAML, aucun `catalog/build.mjs`, aucun `.mp4` ni `.jpg` ajouté ou retiré.
  Les 6 posters et 12 clips du lot 2 sont pris **tels quels** ; les 51 gestes manquants restent
  manquants, c'est le lot 2 et il est arrêté par décision.
- **Le bouton « Tout télécharger pour le mode avion »** (§7.1 l.984). Il n'existe pas, ce lot ne le
  crée pas. Le pré-cache reste automatique, la conservation reste implicite à la consultation.
- **La déviation photos de recettes** (§7.1 « à la demande » *vs* `imagesPubliques` qui pré-cache les
  116). Constatée ci-dessus, **non tranchée ici** — la trancher changerait le premier chargement de
  tout le monde, et c'est une décision, pas un effet de bord.
- **La question 68** (budget P6 : 27,6 Mo contre un critère de 15). Le lot ajoute ~1,5 Mo de posters
  au pré-cache et laisse les clips hors pré-cache, ce qui va dans le sens du budget sans le fermer.
- **L'éviction LRU** nommée par §7.1. Conserver n'est pas gérer un quota ; un cache qui grossit sans
  limite est un défaut connu que ce lot laisse ouvert, et il vaut mieux l'écrire que le découvrir.
- **La sensibilité à la casse des noms entre Windows et Linux.** Signalée par la seconde attaque,
  écartée **sciemment** : il n'y a pas de CI Linux sur ce dépôt, les quatre commandes tournent sous
  Windows, et un critère pour une plateforme qui n'existe pas ici serait du bruit qui aurait l'air
  d'une garantie. ⚠️ **À rouvrir le jour où une CI Linux apparaît**, pas avant.

**Les témoins d'avant** — relevés le 2026-08-16, arbre `de2ba39` **plus le seul fichier de tests
scellés** (aucun code de production ajouté) :

| Témoin | Avant le lot 4 |
|---|---|
| `npm test` | **2 158 passed / 9 failed (2 167 tests, 115 fichiers)** en 39,84 s |
| dont le fichier scellé du lot 4 | **11 tests : 9 rouges, 2 verts** — les 2 verts sont les garde-fous (« sw.js est lisible », critère 8 de non-régression), qui doivent **rester** verts |
| `npm run typecheck` | propre |
| `npx vite build` | ✓ 2,83 s |
| `npm run engine:plan-stress` | **20/20** |
| `node catalog/build.mjs` | 451 aliments · 330 recettes · 1 548 étapes · 62 gestes · 73 tips · 8 fiches · 30 équipements — **hors périmètre, ne doit pas bouger** |
| `dist/sw.js` | **0** occurrence de `catalog/gestes` · 116 de `catalog/images` · **131 entrées** de pré-cache · version `nutrition-a35ffc368e04` |
| `dist/catalog/gestes` | 18 fichiers (6 `.jpg` + 12 `.mp4`), 2,1 Mo · `dist/` total 11 Mo |

⚠️ **L'écart 2 156 → 2 167 est attribué au fichier, pas déduit** : +11 tests et +1 fichier, tous dans
`tests/scelles/gestes-hors-ligne.test.ts`. Aucun autre fichier de test n'a été touché.

---

## 6. L'ordre, et les témoins

```
✅ D2 (deux formats)  ─┐
✅ D4 (versionné git) ─┼─→ ⏳ Lot 2 (import) ─→ ✅ Lot 3 (affichage) ─→ ▶ Lot 4 (hors-ligne)
✅ D3 (un par segment)─┤     3 gestes / 51           de2ba39              À FAIRE — c'est ICI
✅ D5 (trois, 08-16)  ─┘        ▲
                         ✅ Lot 1 (champ) ──┘
                            e259bcb

⏳ D1 (budget P6 / décision 68) ── ne bloque AUCUN lot, mais doit être tranchée
                                   avant de dire que le chantier est fini.
```

⛔ **LE LOT 4 EST LE SEUL LOT DÉBLOQUÉ DU CHANTIER, ET C'EST LA PROCHAINE ÉTAPE.** Le lot 2 n'est
pas *bloqué* : il est **volontairement arrêté à 3 gestes** (D5). Le rouvrir est une décision, pas
une suite.

⚠️ **D1 (la décision 68) a changé de statut : elle ne bloque plus l'ordre des lots.** Les clips sont
des **médias à la demande** au sens de `ARCHITECTURE.md` §7.1 — ils n'entrent pas dans le premier
chargement. Ce qui reste à trancher est **ce que le critère P6 mesure**, pas s'il faut coder.
⛔ **Mais elle doit être tranchée avant de déclarer le chantier livré** : sinon on aura ajouté
22,4 Mo à un budget dépassé sans jamais dire ce que le budget compte.

**Témoins à garder stables** — relevé du **2026-08-16**, **à revérifier au démarrage, pas à
recopier** (les précédents : 2 146/6 le 08-15, 2 124 / 109 fichiers le 08-11) :

| Témoin | Valeur attendue |
|---|---|
| `npm test` | **2 156 passed / 0 failed** — 2 156 tests, 114 fichiers, ~42 s |
| `npm run typecheck` | propre |
| `npx vite build` | ✓ (2,82 s) |
| `npm run engine:plan-stress` | **20/20** |
| `node catalog/build.mjs` | 451 aliments · 330 recettes · 1 548 étapes · **62 gestes** · 73 tips · 8 fiches · 30 équipements |
| `node catalog/audit-mapping.mjs` | 451 mappings · 9 candidats à relire |

✅ **LES 6 ROUGES SONT ÉTEINTS — le lot 1 les a fermés, comme annoncé.** Ils vivaient tous dans
`tests/scelles/gestes-champ-media.test.ts` (7 tests), écrits avant leur code. **Aucun rouge ailleurs :
le lot n'a pas débordé.**

**Écart de compte attribué fichier par fichier, jamais déduit** : 2 152 → 2 156 = **+4**, et
113 → 114 fichiers = **+1**, les deux étant `app/src/ui/screens/savoir.test.tsx` (lot 3). Les
7 tests scellés étaient **déjà comptés** dans les 2 152 ; seul leur résultat a changé.

⚠️ **`build.mjs` sort une alerte qui n'est PAS de ce chantier** : fiche `calcium-fractures`, source
`critique-zhao-2018` sans auteurs vérifiés. Aucun fichier de `catalog/evidence/` n'a été touché —
c'est du contenu Savoir, à traiter avec la relecture par un tiers.

⚠️ **`engine:plan-stress` est le témoin de la durée** : aucun lot de ce chantier ne touche au
solveur, donc **20/20 doit rester 20/20**. S'il bouge, c'est qu'on a touché à autre chose que ce
qui est écrit ici.

⚠️ **Cinquième commande, à la main et dans le dépôt principal uniquement** :
`node catalog/audit-mapping.mjs`, après le lot 2 — c'est le seul qui touche au contenu.
