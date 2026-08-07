# Récap session 2026-08-06 → 2026-08-07 — le tri des photos de recettes

> **Instantané daté.** Vrai à sa date, jamais réécrit. L'état courant est dans
> [../FICHE_REPRISE.md](../FICHE_REPRISE.md) et [../ETAT.md](../ETAT.md).
>
> ⚠️ **Piste parallèle.** Une autre session travaillait dans le même dépôt pendant toute la durée
> de celle-ci (couche de score `piquant`, écran `aliment`, `gestes-etape.tsx`, L1ter). Ce récit ne
> raconte pas son travail, et son travail explique les 9 tests rouges relevés en §6.

## 1. La demande

Reprendre le projet et **trier moi-même les photos** pour qu'elles puissent être rattachées aux
recettes, avec les deux passes Gemini (aveugle et nommée) **en appoint seulement**, l'utilisateur
relisant derrière. Greffer ma passe sur l'application de tri déjà construite plutôt qu'en écrire
une autre.

Le point qui structure tout le reste : **la passe propose, elle ne tranche pas.** Elle n'écrit que
dans `atelier/photos/etat/ma-passe.jsonl`, jamais dans `decisions.json`, et ne touche aucun fichier
image. C'est la règle déjà posée dans le README de l'atelier — le jugement d'un modèle classe une
file de travail, il ne décide pas.

## 2. Ce qui a été livré

**Trois correctifs dans l'outil** (`atelier/photos/`, hors du périmètre de build — `vite.config.ts`
pose `root: 'app'`) :

- `couplesJuges()` dans `ma-passe.mjs` — **le journal est écrit par CLÉ, il doit être relu par
  GROUPE.** La récolte a téléchargé la même image sous plusieurs noms de dossier ; ces copies
  partagent leur URL de crédit donc leur groupe, mais pas leur clé. Sans ce repli, l'écran reposait
  la même question deux fois. 15 des 144 lignes du journal d'alors étaient redondantes.
- Le filtre des fichiers fantômes dans `donnees.mjs` — **un fichier absent de `photos/` est un rejet
  déjà prononcé, pas une donnée manquante.** Ce sont les rejets rendus dans `trier.py`, qui
  déplaçait l'image vers `rebut/` sans jamais les écrire dans `decisions.json`. Sans le filtre,
  `reconnaissance.json` les gardait et l'écran servait des cartes à l'image cassée sur des questions
  déjà tranchées. **97 photos** dans ce cas au 2026-08-07. Le compte est remonté à l'appelant et
  affiché : une file qui rétrécit en silence se lit comme une file qu'on a couverte.
- Le rechargement à chaud de la passe dans `serveur.mjs` — `maPasse` est relu à chaque `/api/file`.
  Nouveaux verdicts visibles sans redémarrage. ⚠️ **Le catalogue, lui, reste en portée module** :
  quand l'autre session ajoute des recettes, il faut toujours redémarrer le serveur.

**La passe elle-même**, au 2026-08-07 :

```
journal        : 272 couples (image × recette) jugés — 254 non, 9 doute, 9 oui
catalogue      : 297 recettes
  sans aucune candidate      : 68   (aucun tri ne les servira)
  photo tranchée par l'humain : 10
  photo PROPOSÉE par la passe : 9   ← à confirmer à l'écran (touche P)
  encore à voir              : 211
décisions humaines : 86
sorties du bac     : 97 photos écartées (rejets de trier.py + anciennes images générées)
```

**Un fichier de récolte ciblée** : `G:\Claude\Dessinateur\recettes\recettes-appli.csv`, 224 lignes
`id;;requete_fr;requete_en`, vérifié en rejouant le filtre de `lire_csv` — 224 lues, 0 requête vide,
0 doublon, 0 sujet IA, toutes les recettes existent au catalogue. **Non lancé** : la récolte tape le
réseau et consomme les clés API de l'utilisateur.

## 3. Le barème, obtenu par la mesure et non par la question

Il n'a pas été demandé, il a été **calibré** : soumettre des propositions, lire les verdicts rendus,
recommencer. Quatre tours.

**L'identité du plat se vérifie AVANT l'esthétique.** Un ingrédient du titre qui n'est pas visible
fait un autre plat, quelle que soit la qualité de la photo.

| Accepté | Refusé |
|---|---|
| laide, terne, au flash, nappe hideuse | dressage de restaurant (fleur comestible, traits de sauce peints, carotte sculptée, décor de salle) |
| plat en cours de cuisson, casserole cabossée | un second plat net dans le cadre |
| une main qui entre dans le cadre | photo d'ingrédient (légume cru, non cuisiné) |
| un accessoire de garniture en trop ou en moins | autre préparation (brouillé ≠ poché, farci ≠ gratiné) |
| | viande dans une recette végétarienne |
| | **filigrane incrusté** — ajouté le 2026-08-07 |

⚠️ **Le filigrane est une découverte de cette session**, et ce n'est pas un défaut esthétique :
`www.linvoyage.com` était incrusté sur trois photos de `gaspacho/` et un logo rond sur une
quatrième. Une image embarquée dans l'appli porterait la marque d'un tiers. Refus dur.

**Discipline de lecture** : n'ouvrir l'image que quand c'est nécessaire, mais **jamais un `oui` sans
avoir ouvert**. On saute l'ouverture uniquement quand le titre déclaré par la banque **et** la passe
aveugle s'accordent sur quelque chose d'incompatible. Sur le dernier lot, 26 des 46 candidates sont
tombées sans ouverture — libellule, fleurs de *crepe jasmine*, burger, ragoût de bœuf, raita, bento,
bassines de tomates crues.

## 4. Pourquoi la récolte n'était pas ciblée — instruit, pas supposé

La question posée par l'utilisateur. Réponse mesurée, pas devinée :

**La récolte l'a été pour 254 dossiers sur 413, et ne l'a pas été pour 159.** `chercher_photos.py` a une
fonction `lire_csv` qui, quand la colonne de requête est vide, **retombe en silence** sur
`defaut = nom.replace("_", " ")`. Une seconde campagne de 159 dossiers est passée par ce repli :
le slug d'identifiant de recette est parti tel quel vers Pexels, Openverse et Commons — et
`replace("_", " ")` ne touche pas les tirets, donc `crepes` a ramené des fleurs de *crepe jasmine*
et une libellule. **68 recettes n'ont jamais été récoltées du tout.**

**La séparation est parfaite, et c'est la convention de nommage qui la trahit** : sur les 254
dossiers à requête curée, **0 porte un tiret** ; sur les 159 sans, **159 en portent un**. Les
premiers sont nommés à la main (`veloute_champignons`), les seconds sont des identifiants de recette
passés tels quels (`courgettes-farcies-riz-feta`). Aucun recouvrement.

⚠️ **La liste qui a lancé la mauvaise campagne n'existe plus.** L'hypothèse du CSV à deux colonnes
est une déduction, pas une preuve — elle est écrite comme telle.

**Rendement mesuré au 2026-08-07** : `oui` sur **5/90** des candidates issues d'un dossier à requête
curée (**5,6 %**), contre **4/182** sans (**2,2 %**). C'est ce qui a décidé l'ordre du travail —
épuiser d'abord la réserve ciblée. ⚠️ Petits effectifs : l'écart est un signal, pas une statistique.

⚠️ **Correctif recommandé, NON appliqué** (script de l'utilisateur, hors du dépôt de l'appli) : une
garde d'une ligne dans `lire_csv` qui refuse une colonne de requête vide au lieu d'y retomber.

## 5. Ce que la mesure a démenti — la partie qui ne se reconstitue pas

**5.1 « Le repli par groupe ne l'a pas vue » — faux, et je l'avais écrit dans plusieurs motifs.**
Vérification : hachage de 5 799 fichiers, comparaison des familles de contenu aux groupes d'URL.
**0 famille ne s'étend sur plus d'un groupe.** Le repli par URL est complet. Le défaut n'était pas
dans la donnée, il était dans mon propre outil, qui relisait le journal par clé.

**5.2 Mon fichier de récolte a pollué la mesure qui l'avait justifié.** `recettes-appli.csv` est
écrit **dans le bac**, et le script qui calcule les « récoltes curées » balaie tous les `*.csv` du
bac. Résultat : 224 recettes dont la récolte **n'a pas encore tourné** comptaient comme ciblées, et
la réserve annoncée passait de 56 à 151. Un plan de récolte n'est pas une récolte passée.

**5.3 L'outil avait raison contre moi, deux fois.** Ma liste de candidates ne se dédoublonnait pas
elle-même : `ma-passe.mjs verdict` a refusé 8 entrées sur 46 — **rien n'a été écrit**, refus en bloc
— parce que le repli par groupe les couvrait déjà. Le garde-fou a fonctionné comme prévu.

**5.4 Une proposition n'était pas servie par l'écran.** Diagnostic par horodatage : le YAML de
recette avait été écrit à 11:06:50, le serveur démarré à 10:56:33. **Une autre session ajoutait des
recettes** (282 → 292 → 297) et le catalogue du serveur était en portée module. C'est ce qui a
motivé le rechargement à chaud de la passe — et ce qui laisse la même dette sur le catalogue.

**5.5 Deux propositions sont tombées sur l'identité, et dans les deux cas j'avais écrit le défaut
dans mon propre motif avant de proposer quand même.** D'où la règle du §3, dans cet ordre-là.

## 6. Le relevé des quatre commandes — 2026-08-07, sur l'ARBRE DE TRAVAIL

⛔ **`npm test` EST ROUGE.** Relevé tel quel, sans arrangement :

```
npm test                → 9 failed | 1637 passed (1646)   ·   7 failed | 84 passed (91 fichiers)
                          Duration 49,91 s
npm run typecheck       → tsc --noEmit, exit 0, aucune sortie
npx vite build          → ✓ built in 6.67 s (144 modules)
npm run engine:plan-stress → 20/20 configurations saines
                             ⚠ 1 SIGNAL : végétalien + sans gluten, 27/28 accompagnements
node catalog/build.mjs  → 451 aliments, 297 recettes, 62 gestes, 73 tips, 8 fiches (33 positions)
                          recipe_step : 1368 étapes · recipe_step_ingredient : 2715 liens (93,7 %)
                          ⚠ fiche 'calcium-fractures' : source 'critique-zhao-2018' sans auteurs vérifiés
```

**Les 7 fichiers rouges :**

```
app/src/data/catalog-loader.test.ts        `piquant` vaut null partout tant que rien n'est annoté
app/src/engine/api/index.test.ts           layers expose les 18 descripteurs (× 2 cas)
app/src/engine/selection/explain.test.ts   la table couvre les onze couches de score
app/src/engine/selection/scoring/scoring-layers.test.ts   LAYER_DESCRIPTORS est à 18 entrées
app/src/engine/selection/scoring-pass.test.ts             SCORING_LAYERS contient exactement 8 couches
app/src/ui/screens/aliment.test.tsx        plafonne la liste et annonce le reste
app/src/ui/screens/aujourdhui.test.tsx     changer de créneau (× 2 cas)
```

**Une seule cause, et elle n'est pas dans le tri des photos.** Une couche de score `piquant` a été
ajoutée par la piste parallèle (`app/src/engine/selection/scoring/piquant.ts`, non suivi par git) :
`LAYER_DESCRIPTORS` passe de 18 à 19, les couches de score de 11 à 12, `SCORING_LAYERS` de 8 à 9.
Les tests de garde attendent encore les anciens comptes. **Ce sont des tests de registre qui font
exactement leur travail** — ils signalent un registre étendu sans que sa table de garde suive.

⚠️ **Le tri des photos vit entièrement dans `atelier/photos/`, qui est gitignoré et hors de
`app/`.** Aucune de ces 9 lignes rouges ne vient de ce chantier, et aucune ne peut en venir.

⚠️ **CE RELEVÉ A ÉTÉ DÉPASSÉ DANS LA JOURNÉE, ET MON ATTRIBUTION ÉTAIT PARTIELLEMENT FAUSSE.** La
piste parallèle a corrigé **7 des 9** dans les heures qui ont suivi — c'étaient bien des tables de
recensement en retard sur le registre. **Les 2 derniers ne venaient PAS de `piquant`**, et elle l'a
falsifié au lieu de le supposer : couche retirée de `SCORING_LAYERS`, les deux tests restent rouges
à l'identique. Cause réelle : un lot de contenu fait entrer *Pizza maison tomate-mozzarella*, qui
domine deux créneaux à la fois, et `aujourdhui.test.tsx` compare UN plat affiché pour prouver que la
liste change. **J'avais écrit « une seule cause » sans l'avoir testée.** État courant et arbitrage :
[../FICHE_REPRISE.md](../FICHE_REPRISE.md). Le relevé ci-dessus reste tel quel — il est vrai à
16:05, et c'est ce qu'un instantané daté doit être.

⚠️ **Piège rencontré et à ne pas refaire** : `npm test 2>&1 | tail -25` rend **le code de sortie du
pipe**, donc 0, et la suite paraît verte. Lire le compte `Tests N failed`, pas `$?`.

## 7. Ce qui reste ouvert

- **Lancer la récolte ciblée** — `python chercher_photos.py recettes-appli.csv 8 2`, puis relancer
  la reconnaissance pour que les nouvelles photos entrent dans la banque. **C'est à l'utilisateur** :
  réseau et clés API.
- **La file de relecture porte 3 propositions** : `gaspacho`, `crepes`,
  `soupe-haricots-blancs-chou-kale`.
- **La réserve ciblée est épuisée** : sur les 56 recettes récoltées avec une vraie requête, 54
  avaient toutes leurs candidates déjà jugées. Continuer sur les 157 dossiers à repli sur le slug
  rend ~2,2 %. **Récolter d'abord vaut mieux que trier plus.**
- **Le rechargement à chaud du CATALOGUE** dans `serveur.mjs` — proposé, non tranché.
- **La garde d'une ligne dans `lire_csv`** — signalée, non appliquée.
- **L'étape d'import n'est pas écrite** : c'est elle qui posera `image_path`, produira l'AVIF/WebP
  sous 40 Ko et les entrées de `CREDITS.md`. Rien n'a encore été fait dans cette direction.

## 8. Mes erreurs

1. **Affirmé sans mesurer** que le repli par groupe manquait des doublons (§5.1). La mesure a dit
   l'inverse et a désigné mon propre outil.
2. **Écrit mon plan de récolte dans le bac**, ce qui a faussé le calcul des récoltes curées (§5.2) —
   un compte de 151 au lieu de 56, découvert seulement parce que l'écart était trop gros pour être
   crédible.
3. **Proposé deux photos dont j'avais moi-même écrit le défaut d'identité dans le motif** (§5.5).
4. **Cru une suite verte sur un pipe** (§6) — le premier relevé de la journée annonçait « exit 0 »
   sur une suite à 9 échecs.
