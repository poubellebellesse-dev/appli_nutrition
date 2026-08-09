# Crédits et licences

Toutes les ressources tierces embarquées dans l'application, avec leur licence. §8.1
ARCHITECTURE : « ne rien créer soi-même » — donc tout créditer.

> Ce fichier est **obligatoire avant publication** (critère de sortie de P6, §12 ENGINE). Il est
> incomplet tant que les photos de recettes n'existent pas.

---

## Polices

Auto-hébergées dans `app/public/fonts/`, jamais chargées depuis un service tiers : §6.6
ARCHITECTURE promet **zéro requête réseau après le chargement initial**, et un lien vers Google
Fonts casserait à la fois cette promesse et l'affichage hors ligne.

| Police | Auteurs | Licence | Fichier |
|---|---|---|---|
| **Newsreader** | Production Type (Jean-Baptiste Levée, Aleksandra Samuļenkova) | [SIL Open Font License 1.1](https://openfontlicense.org/) | `newsreader-latin.woff2` |
| **Instrument Sans** | Instrument, Rodrigo Fuenzalida, Jordan Egstad | [SIL Open Font License 1.1](https://openfontlicense.org/) | `instrument-sans-latin.woff2` |

L'OFL autorise explicitement l'usage, la redistribution et l'intégration, y compris commerciale, à
condition de conserver l'avis de licence et de ne pas vendre la police seule. Les deux fichiers sont
des **polices variables** (graisses 400 à 600 dans un seul fichier), restreintes au sous-ensemble
`latin` — qui contient les accents français et la ligature œ. Total : environ 160 Ko.

Source des fichiers : sous-ensembles servis par `fonts.gstatic.com`, téléchargés le 2026-07-30.

---

## Données nutritionnelles

| Source | Détenteur | Conditions |
|---|---|---|
| **Table CIQUAL 2025** | ANSES | Réutilisation libre avec mention de la source. Version et date d'extraction dans `catalog/sources/ciqual/`. |

Les valeurs ne sont **jamais saisies à la main** : `foods.yaml` + `ciqual-mapping.yaml`, puis
`npm run catalog:ciqual -- --write`.

---

## Bibliothèques

Licences complètes dans `node_modules/*/LICENSE`. Les dépendances d'exécution embarquées dans le
bundle sont React, React DOM et SQLite WASM.

| Bibliothèque | Licence |
|---|---|
| React, React DOM | MIT |
| SQLite (`@sqlite.org/sqlite-wasm`) | Domaine public |
| Tailwind CSS | MIT |
| Vite, Vitest, TypeScript | MIT / Apache-2.0 |

---

---

## Recettes

**Les 241 recettes du catalogue sont écrites pour ce projet** — aucune ne provient d'une source
externe, et il n'y a donc rien à créditer ici. Ce n'est pas un oubli : c'est le seul contenu du dépôt
sans source, et il ne faut pas lui en inventer une.

Les sources de recettes réutilisables (cuisine-libre.org, USDA MyPlate, Wikibooks Cookbook), leurs
licences et le coût réel d'un import sont recensés dans
[`docs/SOURCES_RECETTES.md`](../docs/SOURCES_RECETTES.md). **Toute recette qui en viendrait devra
être créditée ici, ligne à ligne** — auteur, licence, lien.

~~⚠️ `recipe` n'a aujourd'hui ni colonne auteur, ni source, ni licence : le crédit ne serait pas
affichable à l'écran. À traiter avant le premier import.~~

✅ **CORRIGÉ LE 2026-08-05 — C'ÉTAIT FAUX, et depuis un moment.** Tout le dispositif existe et il est
branché de bout en bout :

| Élément | État |
|---|---|
| `recipe.origine` | `maison \| domaine_public \| libre`, NOT NULL + CHECK |
| `recipe_source` | `type`, `titre`, `url`, `consulte_le`, **`licence`**, **`auteur`** |
| Validation au build | Bidirectionnelle : `maison` + `provenance` → **erreur** ; `domaine_public`/`libre` sans `provenance` → **erreur** |
| Affichage | `ui/screens/detail-recette.tsx` : « **D'après** *titre* — *auteur* · *licence* » |

Une recette importée sait donc se créditer à l'écran, et le build REFUSE une origine revendiquée
sans source. **Le premier import n'est plus bloqué par ce point.** Aujourd'hui 41 recettes portent
52 sources, **toutes de type `reference`** (consultées pour vérifier) et **aucune `provenance`** —
ce qui est cohérent avec « les 241 recettes sont écrites pour ce projet ».

---

<!-- DÉBUT PHOTOS — bloc généré par catalog/import-photos.mjs, ne pas éditer à la main -->

## Photos de recettes

**88 photos**, une par recette, ré-encodées en AVIF (1024 px au plus) par
`catalog/import-photos.mjs`. Les originaux ne sont pas versionnés ; ce tableau et le champ
`image_path` de chaque recette sont la seule trace de leur provenance.

⚠️ La majorité de ces photos sont sous licence Creative Commons **BY** ou **BY-SA** :
l'attribution ci-dessous est une **obligation de la licence**, et elle doit suivre l'image
partout où elle est redistribuée — y compris dans un partage `.nutri-recipe`.

| Recette | Auteur | Licence | Source |
|---|---|---|---|
| `betteraves-roties-chevre` | penelope waits | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/64148767@N00/14666095395) |
| `boeuf-bourguignon` | Wheeler Cowperthwaite | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/60756254@N07/51651084469) |
| `boisson-soja-cacao` | Jeremy Weate | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/73542590@N00/6199729357) |
| `boulettes-boeuf-tomate` | IainCameron | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/67872859@N00/17112155916) |
| `caldo-verde` | Michael | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [commons](https://commons.wikimedia.org/wiki/File:Caldo_Verde.jpg) |
| `camembert-roti-four` | whatleydude | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/85318305@N00/7574317468) |
| `chakchouka` | I Own My Food Art | [Pexels License](https://www.pexels.com/license/) | [pexels](https://www.pexels.com/photo/cooked-food-on-white-ceramic-plate-8996223/) |
| `chili-haricots-rouges` | Carstor | [CC BY-SA 2.5](https://creativecommons.org/licenses/by-sa/2.5/) | [openverse](https://commons.wikimedia.org/w/index.php?curid=338876) |
| `choux-bruxelles-poitrine` | adactio | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/74105777@N00/2139828257) |
| `coq-au-vin` | Drab Makyo | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/71503020@N00/1607132825) |
| `couscous-legumes` | moncif ait ahmed | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | [commons](https://commons.wikimedia.org/wiki/File:Couscous_Royal_Marocain.JPG) |
| `crepes` | Lalinah | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [commons](https://commons.wikimedia.org/wiki/File:Cr%C3%AApe_au_coco_0.jpg) |
| `crevettes-ail-persil` | Farhad Ibrahimzade | [Pexels License](https://www.pexels.com/license/) | [pexels](https://www.pexels.com/photo/cooked-food-on-black-ceramic-bowl-8697543/) |
| `crumble-rhubarbe-fraise` | Eastmain | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [commons](https://commons.wikimedia.org/wiki/File:Strawberry_crumble_dessert_partially_eaten_Easter_Sunday_2025.jpg) |
| `dahl-epinards-curcuma` | David Jackmanson | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/58301516@N00/18657496932) |
| `endives-braisees` | jlastras | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/22662305@N04/3177113181) |
| `endives-jambon-gratin` | jlastras | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/22662305@N04/3177115695) |
| `escalope-dinde-champignons` | ndrwfgg | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/69024001@N00/76652605) |
| `flageolets-ail-persil` | Jerry Pank | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | [openverse](https://commons.wikimedia.org/w/index.php?curid=149458630) |
| `flan-oeufs-caramel` | kurmanstaff | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/62558987@N07/49830326356) |
| `focaccia-romarin` | treehouse1977 | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) | [openverse](https://www.flickr.com/photos/13071852@N00/5894369347) |
| `galettes-sarrasin-jambon` | avlxyz | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) | [openverse](https://www.flickr.com/photos/10559879@N00/4367127177) |
| `gaspacho` | jlastras | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/22662305@N04/3681128795) |
| `granola-maison` | betsyweber | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/34666709@N00/2263634511) |
| `gratin-celeri-rave` | illustir | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/12505664@N00/15852602187) |
| `gratin-dauphinois` | Ludovic Péron | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | [commons](https://commons.wikimedia.org/wiki/File:Gratin_dauphinois.jpg) |
| `hachis-parmentier` | jules:stonesoup | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/58367355@N00/3500639454) |
| `haricots-verts-amandes` | BruceMatsunaga | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/94643613@N00/13987585848) |
| `houmous-pois-chiches` | Shameel mukkath | [Pexels License](https://www.pexels.com/license/) | [pexels](https://www.pexels.com/photo/close-up-photo-of-a-thick-soup-on-a-ceramic-bowl-14774984/) |
| `huitres-nature-citron` | Jay Moon | [Pexels License](https://www.pexels.com/license/) | [pexels](https://www.pexels.com/photo/fresh-oysters-on-ice-with-lemon-and-herbs-37794987/) |
| `lapin-moutarde-thym` | Girl Interrupted Eating | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/35468144810@N01/5608775729) |
| `lentilles-vertes-carottes` | Zantastik | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | [commons](https://commons.wikimedia.org/wiki/File:Rago%C3%BBt_aux_lentilles.jpg) |
| `moules-vin-blanc` | benbrown1 | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/43555307@N04/15378540250) |
| `mousse-avocat-cacao` | jules:stonesoup | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/58367355@N00/8359610445) |
| `muesli-amande-myrtilles` | eliduke | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) | [openverse](https://www.flickr.com/photos/80547277@N00/6014616953) |
| `oeufs-cocotte-epinards` | Andrea Goh | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/47845458@N08/7308574122) |
| `oeufs-coque-mouillettes` | Syced | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [commons](https://commons.wikimedia.org/wiki/File:Mouillette.jpg) |
| `oeufs-mimosa` | Rbreidbrown | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | [commons](https://commons.wikimedia.org/wiki/File:Assortment_of_Homemade_Contemporary_Deviled_Eggs.jpg) |
| `omelette-fines-herbes` | David Jackmanson | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/58301516@N00/51664299135) |
| `pain-maison` | Binnur  Zor | [Pexels License](https://www.pexels.com/license/) | [pexels](https://www.pexels.com/photo/rustic-bread-display-with-vintage-newspaper-30804068/) |
| `pates-ail-huile` | Spaghetti_aglio_olio_e_peperoncino_by_matsuyuki_retouched.jpg derivative work: Jbarta (talk) | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) | [openverse](https://commons.wikimedia.org/w/index.php?curid=16450281) |
| `pates-pesto-basilic` | avlxyz | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) | [openverse](https://www.flickr.com/photos/10559879@N00/3428591434) |
| `polenta-champignons-tomate` | Todd Huffman | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/99287245@N00/4155099957) |
| `pommes-terre-boulangere` | David Gierth | [Pexels License](https://www.pexels.com/license/) | [pexels](https://www.pexels.com/photo/close-up-shot-of-food-on-a-white-plate-3807027/) |
| `pommes-terre-sautees-persillade` | David Gierth | [Pexels License](https://www.pexels.com/license/) | [pexels](https://www.pexels.com/photo/close-up-shot-of-fried-potatoes-on-a-white-plate-3807030/) |
| `porridge-avoine-banane` | Ana Palade | [Pexels License](https://www.pexels.com/license/) | [pexels](https://www.pexels.com/photo/food-and-bananas-on-plate-16144664/) |
| `porridge-soja-banane` | zuleyha | [Pexels License](https://www.pexels.com/license/) | [pexels](https://www.pexels.com/photo/food-in-ceramic-bowl-13882288/) |
| `pot-au-feu` | Andre | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | [commons](https://commons.wikimedia.org/wiki/File:Pot-au-feu2.jpg) |
| `poulet-citron-olives` | Fzlaissi | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | [commons](https://commons.wikimedia.org/wiki/File:Poulet_chermoula_aux_olives_rouges.png) |
| `poulet-noix-cajou` | fifikins | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/25925793@N00/4315902194) |
| `poulet-teriyaki` | avlxyz | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) | [openverse](https://www.flickr.com/photos/10559879@N00/3428018378) |
| `pudding-chia-amande-myrtilles` | T.Tseng | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/68147320@N02/9862751086) |
| `puree-maison` | *_* | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/22539273@N00/31608232975) |
| `ratatouille` | Marcus Guimarães | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [commons](https://commons.wikimedia.org/wiki/File:Ratatouille.jpg) |
| `riz-au-lait` | RBerteig | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/51035786238@N01/481045627) |
| `riz-cantonais` | Guilhem Vellut from Paris, France | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [commons](https://commons.wikimedia.org/wiki/File:Cantonese_rice_@_Restaurant_Ph%C3%A9nix_@_Paris_(34406404351).jpg) |
| `riz-sauvage-champignons` | wonderyort | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) | [openverse](https://www.flickr.com/photos/11112304@N00/10552244293) |
| `rosti-pommes-terre` | jules:stonesoup | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/58367355@N00/8569922071) |
| `salade-avocat-crevettes` | Monica Arellano-Ongpin | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/22118036@N00/7121908693) |
| `salade-fenouil-orange` | judywitts | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/40687317@N00/4322168999) |
| `salade-fraises-basilic` | PersonalCreations.com | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/127294011@N07/15785175923) |
| `salade-grecque` | Farhad Ibrahimzade | [Pexels License](https://www.pexels.com/license/) | [pexels](https://www.pexels.com/photo/vegetable-salad-on-ceramic-bowl-8697517/) |
| `salade-lentilles-chevre` | suavehouse113 | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/94513428@N00/4569530715) |
| `salade-pates-pesto-froide` | inconnu | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [openverse](https://www.rawpixel.com/image/3282840/free-photo-image-dish-sauce-pasta) |
| `salade-raisin-roquefort-noix` | jenarrr | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/66961498@N05/8902807293) |
| `salade-tomate-mozzarella` | Rainer Zenz | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | [commons](https://commons.wikimedia.org/wiki/File:Caprese-1.jpg) |
| `saumon-grille-sesame-soja` | dam i | [Pexels License](https://www.pexels.com/license/) | [pexels](https://www.pexels.com/photo/delicious-grilled-salmon-with-vegetables-29748127/) |
| `smoothie-banane-mangue-amande` | Matthias Rhomberg | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/33772123@N03/3444207913) |
| `smoothie-banane-myrtille` | quinn.anya | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) | [openverse](https://www.flickr.com/photos/53326337@N00/3252207054) |
| `smoothie-fraise-banane-avoine` | woodleywonderworks | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/73645804@N00/6828826294) |
| `soupe-carotte-gingembre` | RLHyde | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) | [openverse](https://www.flickr.com/photos/36655009@N05/4339422274) |
| `soupe-carottes-ail` | Vegan Feast Catering | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/25128194@N02/4129540261) |
| `soupe-lentilles-corail-curcuma` | goblinbox_(queen_of_ad_hoc_bento) | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/25977089@N00/22700376355) |
| `soupe-oignon-gratinee` | avlxyz | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) | [openverse](https://www.flickr.com/photos/10559879@N00/539943342) |
| `soupe-petits-pois-menthe` | Breville USA | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/38102750@N06/15850473780) |
| `soupe-poireaux-pommes-terre` | Joelk75 | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/75001512@N00/5895850272) |
| `soupe-potiron-noisettes` | Farhad Ibrahimzade | [Pexels License](https://www.pexels.com/license/) | [pexels](https://www.pexels.com/photo/a-soup-in-a-ceramic-bowl-8743923/) |
| `soupe-potiron-topinambour` | Silverman68 | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/29120766@N07/5340310996) |
| `taboule-quinoa-menthe` | Shameel mukkath | [Pexels License](https://www.pexels.com/license/) | [pexels](https://www.pexels.com/photo/a-bowl-of-salad-with-tomatoes-lettuce-and-lemon-14774990/) |
| `tarte-citron` | avlxyz | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) | [openverse](https://www.flickr.com/photos/10559879@N00/3223875575) |
| `tarte-pommes` | AustinMatherne | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/25322599@N03/11501476556) |
| `tarte-rhubarbe` | lejoe | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/21458229@N00/5662152731) |
| `tarte-tomates-moutarde` | bcinfrance | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/61362347@N00/2832009725) |
| `tartine-avocat-oeuf` | Jane  T D. | [Pexels License](https://www.pexels.com/license/) | [pexels](https://www.pexels.com/photo/cooked-dish-on-black-plate-793782/) |
| `tofu-saute-brocoli` | sneakerdog | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/28267496@N00/3696452972) |
| `tortilla-espagnole` | Tamorlan | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | [commons](https://commons.wikimedia.org/wiki/File:Tortilla_de_Patatas_(Corte_transversal).jpg) |
| `veloute-butternut-curry` | Stacy Spensley | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/21001756@N06/6216655410) |
| `yaourt-miel-noix` | missmeng | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | [openverse](https://www.flickr.com/photos/41720539@N03/8126264276) |

<!-- FIN PHOTOS -->

---

## À compléter avant publication

- **Photos de recettes** — aucune à ce jour (0 sur 241). Chaque photo devra porter son auteur, sa
  licence et sa source.
- **Illustrations du lexique** — les 62 gestes sont en texte seul ; §8.5 les annonce illustrés.
- **Fiches de niveau de preuve** — chaque fiche cite déjà sa source dans son frontmatter ; à
  regrouper ici au moment de la revue juridique.
