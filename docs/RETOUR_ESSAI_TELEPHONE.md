# 📱 Retour du premier essai sur téléphone — 2026-08-02

> **Ce document est un backlog, pas un état.** Il consigne ce qu'un essai réel a produit et ce qui
> reste à faire. Ce qui est fait en sort (ou passe en §1 avec sa référence de commit) ; ce qui est
> tranché part dans `ETAT.md` §3 ou §4. Quand il sera vide, il rejoindra `archive/`.

**Méthode de l'essai.** Build de production servi en preview sur le réseau local
(`npx vite build && npx vite preview --host`), ouvert dans Chrome Android. Parcours libre des neuf
écrans, sans script.

⚠️ **Deux limites de cette méthode, à connaître avant de refaire l'exercice :**

- **Chrome n'est pas la WebView Capacitor.** Le risque n°1 du projet — le pari « `rem` → l'interface
  suit la police système à 150 % » — **n'est pas tranché** par cet essai. Il le sera par
  `npx cap add android` et une vraie build.
- **Une origine `http://192.168.x.x` n'est pas un contexte sécurisé**, donc OPFS y est indisponible
  et l'application bascule en mode mémoire. L'alerte « cet appareil ne permet pas d'enregistrer »
  vue pendant l'essai était **un artefact de la méthode**, pas un défaut. Pour tester le vrai
  stockage : `adb reverse tcp:4173 tcp:4173` puis `http://localhost:4173` **sur l'appareil** —
  `localhost` est un contexte sécurisé.

---

## §1. Corrigé le jour même — commits `3dbaf48`, `1f095bc` et suivants

1. **Les 12 suggestions ne changeaient jamais.** Deux causes : `seed: 1` codé en dur sur l'écran
   Aujourd'hui, et surtout `diversify` qui ignorait la graine — son glouton prend l'`argmax` de
   (score − λ·similarité), donc l'ordre d'entrée ne l'influence qu'à égalité exacte, et le tirage
   seedé de `rankScoredCandidates` y était intégralement neutralisé. Mesuré après correctif :
   **8 suggestions sur 12 changent** entre deux graines. Bouton « Proposer autre chose ».
2. **Le retour depuis une fiche recette** ramenait toujours sur Recettes. L'origine est encodée dans
   le hash (`?de=aujourdhui`), pas dans un état React — le service worker sert `index.html` sur toute
   navigation, un état React n'aurait pas survécu au rechargement.
3. **Le frigo affichait des recettes sans aucun rapport** : `searchByPantry` classait sans filtrer.
4. **« Réalisables maintenant »** → **« Sans rien acheter »**.
5. **L'encart d'aide après 7 plats** ne s'ouvrait jamais : il comptait les clics « Suivant », jamais
   « Précédent ». Il compte désormais les recettes **distinctes** vues depuis le dernier choix.
6. **L'ajout manuel aux Courses ne savait ajouter que du non-alimentaire** — ses 10 rayons étaient
   hygiène, lessive, animaux… et un aliment du catalogue ne pouvait pas être rangé en « fruits et
   légumes ». Le formulaire a désormais une **complétion sur le catalogue**, en **déduit le rayon**
   via `rayonDe()` tout en le laissant modifiable, et expose le **champ quantité** — dont la colonne
   dormait en base, inutilisée, et qu'`addExtraItem` acceptait déjà. La saisie libre continue de
   fonctionner pour le non-alimentaire. Aucune migration : tout existait, rien n'était branché.
7. **Le rythme peut aller à QUATRE repas** (petit-déjeuner, déjeuner, goûter, dîner). Le créneau
   `gouter` était déjà pleinement supporté — `FIN_DE_CRENEAU`, `TITRE_CRENEAU`, `MealSlot` — seule
   la table `CRENEAUX_PAR_NOMBRE` l'excluait. ⚠️ L'ordre de la liste est **chronologique** et non
   celui de la demande (« petit déjeuner, goûter, déjeuner, dîner ») : `creneauDuMoment` prend le
   premier créneau dont la fenêtre n'est pas close, un goûter placé avant le déjeuner aurait mangé
   sa fenêtre de midi. ⚠️ **`DESIGN.md` §4.2 a été amendé** (1-3 → 1-4) avec sa conséquence écrite :
   la maquette « tient dense à 3 », un 4ᵉ créneau la densifie encore et **rien n'a été réaménagé**.
8. **Le libellé du temps de cuisine levait mal l'ambiguïté** : « Temps pour cuisiner, en semaine »
   devient « Temps pour cuisiner **un repas**, en semaine ». Vérifié dans le code avant de
   reformuler — cette valeur alimente le `tempsDisponibleMin` d'une seule requête de suggestion,
   comparé au temps total d'une recette candidate. C'est bien par repas, pas un total hebdomadaire.
9. **Le créneau était déduit de l'horloge, sans recours.** Un sélecteur en pastilles (motif
   `Segment`, pas de déroulant) propose les créneaux **du rythme déclaré** — rien si le rythme n'en
   a qu'un, puisqu'il n'y a alors rien à choisir. « Vider le frigo » remonte dans l'en-tête, sans
   être dupliqué en bas.

10. **« Mes recettes » : fenêtre dédiée, modification, export.** Modifier sa propre recette était
    **impossible** — `detail-recette.tsx` masquait le seul chemin vers l'éditeur dès qu'une recette
    était perso. `#/composer/<id>` a maintenant deux sens selon l'id : un id du catalogue **décalque**
    (nouvel id, comportement d'avant), un id `perso:` **modifie sur place**. Pas de seconde route :
    « ouvrir l'éditeur sur X » est une seule intention, deux préfixes de hash auraient divergé.
    ⚠️ Le risque de ce lot était la **perte silencieuse** — un champ oublié au pré-remplissage
    disparaît au réenregistrement sans que personne le voie. Les champs non demandés par le
    formulaire (`source`, `baseRecipeId`, `facettesHeritees`, `service`, `piquant`) sont repris de
    la version précédente, et un test compare l'objet stocké entier avant/après en ne changeant que
    le nom.
    Export : `.nutri-recipe` JSON conforme à §8.7, Web Share API avec repli téléchargement quand
    `canShare` refuse les fichiers. Voir la réserve en §3.

11. **« Plus de filtres » contenait les mêmes filtres que l'écran.** Le reproche était exact et
    mesurable : le panneau affichait les deux mêmes facettes, seulement complètes. Trois axes
    filtrables ont été ajoutés au moteur (**service**, **envergure**, et le **régime** qui était déjà
    indexé mais jamais affiché), et l'écran a été réorganisé : **Cuisine, Régime, Service et Temps en
    accès direct**, chacun ouvrant sa fenêtre en UN geste ; **Style, Occasion, Envergure** dans
    « Plus de filtres », qui ne contient donc plus jamais un axe déjà présent à l'écran.
    ⚠️ **Décision : on n'a rien déplié.** La règle « plus aucun menu déroulant hors de l'accueil »
    vient de la contrainte d'âge, pas d'un goût. Le vrai reproche — « la cuisine est à deux gestes » —
    se traite en **retirant un geste**, pas en dépliant.
    ⚠️ Les valeurs offertes sont **dérivées du catalogue** : `fromage` existe au type `CourseKind`
    mais **0 recette** le porte, donc il n'est jamais proposé. Trois tests le vérifient depuis les
    données, aucun depuis une liste écrite à la main.

12. **Le tutoriel informait, il fait maintenant AGIR.** Une étape peut exiger un geste —
    `clic` sur une cible, ou `route` atteinte — et dans ce cas **le bouton « Suivant » disparaît** :
    on ne passe plus sans avoir fait. Le parcours « découvrir les menus » nomme un onglet,
    l'utilisateur le touche, on avance.
    ⚠️ **Le point structurant** : un tutoriel qui dit « touchez l'onglet Recettes » fait CHANGER
    d'écran. Monté dans un écran, il serait démonté à l'instant même où l'utilisateur réussit
    l'étape. Il vit donc **au-dessus du routeur** et lit la route par le hook existant.
    ⚠️ Détail non anticipé, trouvé à l'implémentation : le calque doit passer en
    `pointer-events-none` quand une étape attend un geste, sinon le clic n'atteint jamais
    l'application — la bulle reprend `pointer-events-auto` pour que « Passer » reste atteignable.
    « Passer » est présent à **chaque** étape : un tutoriel qui exige un geste et dont on ne peut
    pas sortir est un piège, pas un guide. Et une cible introuvable n'interrompt rien, elle est
    sautée. Accès **« Revoir le tutoriel »** dans Paramètres, indépendant de `visite_proposee` —
    un tutoriel qu'on ne peut faire qu'une fois ne sert qu'une fois.

13. **`note_allergene` était une colonne morte, sur la promesse centrale du produit.** Au schéma,
    lue par `readExtraItems`, écrite par personne : un utilisateur qui ajoutait à la main un aliment
    figurant dans ses allergènes déclarés **n'était averti nulle part**. La note est désormais
    écrite à l'insertion et affichée dans la liste.
    ⚠️ **Périmètre volontairement étroit** : on n'avertit que sur un aliment **choisi dans la
    complétion**, là où l'on tient un `FoodId` fiable. **Rien n'est promis sur le texte libre.**
    Tenter une correspondance textuelle sur « creme fraiche » tapé à la main produirait des **faux
    négatifs silencieux** — l'appli paraîtrait vérifier alors qu'elle devine, et ferait baisser la
    vigilance de qui compte dessus. Un périmètre étroit et honnête vaut mieux qu'un large et faux.
    ⚠️ On **avertit sans interdire** : l'utilisateur achète peut-être pour quelqu'un d'autre. Même
    principe que `checkCalorieFloor`, qui avertit au lieu d'annuler.
    ✅ **Vérifié au passage** : les articles calculés depuis le plan ne peuvent PAS porter
    d'allergène — ils viennent de `planWeek`/`suggestMeals`, qui passent par la couche d'exclusion
    avant toute retenue. L'ajout manuel était bien le seul trou.

Et l'étape « Installez l'application », désactivée le 2026-08-01, a été rétablie : elle est le seul
endroit du produit qui explique l'installation, et c'est l'installation qui fait accorder le stockage
persistant.

---

## §2. Quatre chantiers transverses

Les mêmes manques reviennent sur plusieurs écrans. Les traiter écran par écran produirait trois
implémentations divergentes.

### A. Le système de filtres

✅ **L'essentiel est fait** (§1, point 11). Ce qui reste ci-dessous est **bloqué par l'absence de
donnée**, pas par du travail d'interface.

- ⛔ **Filtrer par `sauce` et `apéro` est IMPOSSIBLE.** `CourseKind` vaut
  `entree | plat | accompagnement | fromage | dessert` — ni sauce ni apéro, et **aucune recette n'en
  porte**. Ce filtre suppose d'étendre le type du domaine **et** d'écrire le contenu. Les deux vous
  appartiennent, et dans cet ordre : un filtre ajouté avant le contenu s'afficherait vide.
  ⚠️ `fromage` est là pour l'illustrer : la valeur existe au type, **0 recette** la porte, et c'est
  pourquoi elle n'est pas proposée à l'écran — les valeurs offertes sont dérivées du catalogue.
- ⛔ **Filtrer par « viande », « gras », « avec ou sans légumes » est IMPOSSIBLE.** Les axes du
  catalogue sont sucré-salé, léger-consistant, chaud-froid, texture. « Léger » est donc filtrable,
  « gras » n'a aucune dimension qui le porte. Le dériver des ingrédients (groupe `viandes`,
  `légumes`) est faisable mais c'est un index nouveau, à décider.
- **L'écran Aujourd'hui n'est pas touché** : il passe par `suggestMeals` et ses axes d'envie, un
  autre mécanisme que la recherche à facettes. À unifier ou non — décision ouverte.

Demandé à l'origine sur **Aujourd'hui**, **Recettes** et **Courses** :

- **Filtrer par service** : entrée · plat · dessert · sauce · accompagnement · apéro — et
  « pour **tous** les filtres de l'appli », pas seulement un écran.
  ⚠️ La facette `recipe_facet` existe déjà (`ETAT.md` §4 décision 19, tranchée). Le mode repas est
  en v1.5 (décision 20) — mais **filtrer** par service n'est pas **composer** un repas, et ne
  dépend donc pas de cette décision.
- **Filtrer par aliment voulu** : « il manque les aliments voulus » dans « Plus de filtres ».
  ⚠️ `MealContext.requiredFoodIds` existe et est volontairement absent de `HardConstraints`
  (acquis n°2 : rendre l'exigence structurellement inexprimable dans un plan de semaine). Un filtre
  d'écran doit donc passer par le contexte, jamais par les contraintes.
- **Filtrer par envie** : « j'ai envie de viande, légumes, léger, gras, sans légumes, avec légumes ».
- **Filtrer par contexte** : « pour plusieurs, pour un événement, pour tout seul ».
- **Les facettes doivent se déplier sur place.** Verbatim : « pour les filtres exemple cuisine → ils
  doivent être dépliables pour mettre plus de, et non passer par plus de filtres ».
  ⚠️ **Heurte une décision de fond** : « plus aucun menu déroulant hors de l'accueil », parce qu'un
  dépliant pousse vers le bas tout ce qui le suit, et que c'est le mécanisme qui fait abandonner sur
  la contrainte d'âge du produit. À concilier — une fenêtre par facette, ou une exception assumée.
- **« Plus de filtres » doit contenir d'AUTRES filtres**, pas les mêmes : aliment, type de repas.

### B. La complétion à la saisie

⚠️ **« Un composant, trois branchements » était faux** — annoncé ainsi le 2026-08-02, démenti par la
lecture du code le jour même. La réalité est plus dispersée :

- **Composer une recette, aliments** : ✅ **la complétion existait déjà** (`editeur-recette.tsx:398`)
  — champ de recherche, liste maison, `normaliser()`, 6 résultats à partir de 2 caractères.
  **Reste à savoir pourquoi elle n'a pas été trouvée pendant l'essai** : si elle marche, le problème
  est sa visibilité, et le correctif n'est pas une complétion mais un travail d'affordance.
- **Composer une recette, ustensiles et gestes** : voir chantier C — **il n'y a rien à compléter**,
  les champs n'existent pas.
- **Courses** : ✅ fait (§1).
- **Savoir, recherche sur les études** : les **gestes** ont déjà leur recherche ; les fiches
  « Comprendre » n'ont qu'une case « preuve forte seulement », aucune recherche textuelle. Manque
  réel. Champs cherchables disponibles : `titre`, `resumeVulgarise`, et sur chaque position
  `affirmation` et `detail`.
  ⛔ **BLOQUÉ** : `app/src/ui/screens/savoir.tsx` fait partie des fichiers **non committés** du
  chantier `evidence`. Y toucher écraserait du travail en cours. À reprendre une fois poussé.

**Ce qui reste vrai** : `normaliser()` (`engine/search/index.ts:32`) est la fonction de comparaison
commune, déjà réemployée partout. Aucun composant de champ de recherche n'est mutualisé — chaque
écran réinvente le sien, en trois motifs différents (`<datalist>` sur Recettes, liste maison sur
l'éditeur et les courses, filtre direct sur Savoir). À unifier si un quatrième arrive.

### C. Les tutoriels

✅ **Le mécanisme est fait** (§1, point 12). **Ce qui reste est du contenu** : huit parcours à
écrire, un par écran. Ajouter un parcours est désormais **une entrée dans une table de données**,
pas du code — c'est ce que ce lot achète.

Verbatim : « tuto de 2-3 mins pour guider l'utilisateur aux différents menus », « l'utilisateur teste
en même temps », « ne doit pas que informer mais inciter l'utilisateur à utiliser aussi l'appli — si
il interagit, plus de chance qu'il reste », « je veux des tutos sur tous les menus ».

⚠️ **Ce n'est pas la visite guidée qui vient d'être branchée.** Celle-ci est informative : quatre
bulles qui désignent des éléments. Ce qui est demandé est **participatif** — on dit à l'utilisateur
de cliquer sur un menu, il clique ; on lui dit de changer l'image sur Aujourd'hui, il le fait. C'est
un autre objet, à concevoir avant de coder.

### D. La découvrabilité — le chantier que l'essai a révélé sans qu'on le demande

**Deux des demandes de l'essai portaient sur des fonctions qui EXISTENT DÉJÀ.**

| Demandé | Réalité |
|---|---|
| « geste vs flèches → filtre dans les paramètres » | Case à cocher dans Paramètres (`parametres.tsx:277`), lue par `aujourdhui.tsx:189` |
| « ajouter une complétion quand on tape pour les aliments » | Complétion en place dans l'éditeur de recette (`editeur-recette.tsx:398`) |
| « il manque les aliments voulus » dans les filtres | **La recherche indexe DÉJÀ les ingrédients** : taper « poulet » trouve les plats qui en contiennent sans le nommer. Testé sur le catalogue réel depuis avant l'essai (`tests/recherche-catalogue-reel.test.ts:72`) |

⚠️ **C'est un signal, pas une anecdote.** **Trois** fonctions sur une seule session d'essai, non
trouvées par quelqu'un qui connaît le produit mieux que personne. Un utilisateur ordinaire, sur un produit qui
vise une contrainte d'âge, en trouvera moins. Le réflexe naturel — « il suffit de le dire dans le
tutoriel » — est le mauvais : une fonction qu'il faut enseigner est une fonction mal placée.

**Investigation menée le 2026-08-02.** Résultat cas par cas :

**1. La recherche par ingrédient — ✅ DIAGNOSTIQUÉ ET CORRIGÉ.** Le champ s'intitulait
« Rechercher **un plat** » avec pour exemples « blanquette, tajine, gratin » : **trois noms de
plats**. L'affordance ne taisait pas la capacité, elle la **contredisait** — personne n'avait de
raison d'y taper « poulet ». Devenu « Rechercher un plat **ou un ingrédient** », exemples
« blanquette, **poulet**, gratin ». Un test verrouille le libellé, parce qu'une reformulation
future recacherait la capacité en silence — exactement le défaut qu'on vient de corriger.

**2. Le réglage de balayage — DIAGNOSTIQUÉ, non corrigé.** Le libellé est bon
(« Changer de plat en balayant l'écran », avec « Les flèches restent là dans tous les cas. »). Le
problème est **l'emplacement** : Paramètres → fenêtre « **Réglages d'affichage** » → case. Deux
gestes derrière un intitulé générique, et **rien sur l'écran Aujourd'hui — là où le geste
s'applique — ne laisse deviner qu'il existe**. Corriger demande de décider *où* un réglage se
propose : à froid dans Paramètres, ou au moment où il servirait. C'est une question de conception,
pas une chaîne à changer.

**3. La complétion de l'éditeur de recette — CAUSE INCONNUE, à reproduire.**
Réponse de l'utilisateur : « **trouvé mais pas de complétion** ». L'écran a donc bien été atteint et
la liste n'est pas apparue. Ce qui a été vérifié depuis, et qui n'explique rien :

- Le champ est le **3ᵉ élément de la page** (titre, « Nom du plat », puis les ingrédients) : il est
  visible sans défiler. **L'hypothèse « la liste est cachée derrière le clavier virtuel » est donc
  faible** — c'était la première piste, elle ne tient pas.
- Le code est en place : `type="search"`, placeholder « courgette, œufs, riz… », liste maison
  rendue dès `propositions.length > 0`.
- **Seuil de 2 caractères** (`if (cherche.length < 2) return []`) — une seule lettre ne propose rien.
- **Aucun `onFocus`, aucun `scrollIntoView`** sur ce champ.

⚠️ **Reproduire avant de corriger.** L'essai datait d'avant une douzaine de lots, et l'utilisateur
n'a pas retesté depuis. Un correctif écrit maintenant viserait une cause supposée. Ce qu'il faut :
rouvrir « Composer ma propre recette » sur l'appareil, taper **au moins deux lettres** d'un aliment
courant (« cour », « poul »), et dire ce qui s'affiche.

---

## §3. Écran par écran

### Page de bienvenue

- Reformuler le résumé des quatre engagements. Direction donnée : « vos données ne quittent pas cet
  appareil, pas de pub, pas de données à un tiers, rien ».
- **Une ligne d'explication pour chacun** — « petit mais complet ».

### Votre rythme (intro)

✅ **Fait** (§1, points 7 et 8).

- ~~**Exposer le réglage gestes de balayage vs flèches**~~ — ⚠️ **DEMANDE SANS OBJET, et j'avais
  écrit ici le contraire.** Ce réglage **existe déjà**, case à cocher dans Paramètres
  (`parametres.tsx:277`), lue par `aujourdhui.tsx:189`. Voir chantier D.

### Aujourd'hui

- **« Dites-moi ce que vous cherchez »** doit être **au-dessus** de la recette en grand.
- **« Dans le même esprit » ne tient pas ses promesses.** Verbatim : « pizza gratin tarte aux tomates
  sardine boulettes ??? le même esprit ??? ».
  ⚠️ **Ce n'est pas un bug, c'est un réglage jamais fait** : λ (diversification) n'est pas calibré
  (`ETAT.md` §8). Sa mesure date de 212 recettes, le catalogue en compte 241, et le banc n'affiche
  plus la similarité par recette — **à rétablir AVANT de calibrer**, sinon la mesure est aveugle.
- **Un menu pour les choix extravagants.**
- ✅ **Changer de créneau** et **« Vider le frigo » en haut** — fait (§1, point 9).

### Vider le frigo

Les trois remarques sont traitées (§1). Reste ouvert :

- Le lien avec les Courses mérite d'être **visible** : le garde-manger est bien persisté
  (`user_pantry`) et sert à retirer des articles de la liste, mais rien à l'écran ne le dit.

### Recettes

✅ Fenêtre « Mes recettes », modification et export — fait (§1, point 10).

- ⚠️ **Supprimer une recette perso reste IMPOSSIBLE, volontairement.** `deleteUserRecipe` existe
  (`user-recipe.ts:233`) mais **`meal_plan_entry.recipe_id` n'a aucune clé étrangère** et
  `user_recipe_note` aucun `ON DELETE CASCADE` : supprimer laisserait des créneaux de plan pointant
  vers une recette disparue, et des notes orphelines. Brancher un bouton « Supprimer » sans traiter
  ça produirait un plan cassé au prochain rechargement. À faire proprement ou pas du tout.
- Les filtres : voir chantier A.

### Composer une recette

- Complétion à la saisie : voir chantier B.

### Semaine

- **Le choix manuel des plats n'existe toujours pas.**
- **L'alerte « 5 journées apportent moins d'énergie » ne doit pas s'afficher par défaut.** Verbatim :
  « on a dit deux modes → un par défaut pour tout le monde → 1 pour les professionnels ».
  ⚠️ Voir §4.

### Courses

✅ **Fait** (§1, point 6). Reste ouvert, et ce n'est pas une demande de l'essai mais une trouvaille
faite en le traitant :

- ✅ **`note_allergene` n'est plus une colonne morte** — fait (§1, point 13).
- ~~⛔ **`shopping_extra_item.note_allergene` est une colonne MORTE.**~~ Elle existe au schéma
  (`user-schema.ts:242`), `readExtraItems` la lit — et **personne ne l'écrit, rien ne l'affiche**.
  Concrètement : **un utilisateur qui ajoute à la main un aliment figurant parmi ses allergènes
  déclarés n'est averti nulle part.**
  ⚠️ C'est la **deuxième fois** que ce projet rencontre exactement ce motif. La fiche de reprise le
  formule déjà : « *un garde-fou sans source de données ne garde rien — le filtre allergènes a
  tourné sur une liste VIDE jusqu'à ce que l'onboarding existe. Vérifier qu'un champ déclaré est
  bien REMPLI.* » Un champ déclaré et jamais rempli ressemble à une protection sans en être une, et
  c'est plus dangereux qu'une absence franche.
  **Décision produit à trancher** : avertir seulement quand l'article vient de la complétion (on a
  alors le `FoodId`), ou tenter aussi une correspondance sur le texte libre — au risque d'un faux
  négatif silencieux, qui est précisément le mode de défaillance que ce projet combat.

### Savoir

- **Une barre de recherche pour les études.**

### Divers

- **Des sauces à faire seules** et des **accompagnements** — contenu à écrire.
- ✅ **Exporter ses recettes** — fait (§1, point 10).
  ⚠️ **Mais c'est une sauvegarde, pas un partage.** `ARCHITECTURE.md §8.7` décrit un aller-retour :
  on exporte un `.nutri-recipe`, quelqu'un d'autre l'**importe**. **L'import n'existe pas.** Le
  fichier est bien formé et versionné, personne ne sait le relire. Utile pour ne pas perdre ses
  recettes — ce qui compte sur une appli sans compte ni synchronisation — mais la moitié de §8.7
  manque. L'import est le prochain morceau si le partage est voulu.

---

## §4. Ce qui vous appartient — deux amendements à acter

Ces deux points contredisent des décisions déjà prises. Ils ne sont pas bloqués techniquement ; ils
attendent un arbitrage explicite, parce que les revenir en arrière sans le dire effacerait la raison
qui les avait fait prendre.

1. **Deux modes, et l'alerte calorique cachée par défaut.** La décision 34 (`ETAT.md` §4) a
   précisément fait passer `checkCalorieFloor` d'un **refus** à un **avertissement**, après mesure.
   Le masquer par défaut est cohérent avec un positionnement grand public, mais introduit une notion
   de « mode professionnel » qui n'existe nulle part dans le produit aujourd'hui — et qui devra être
   définie une fois pour toutes, pas écran par écran.
2. **Les facettes dépliables sur place** (chantier A) contre la règle « plus aucun menu déroulant
   hors de l'accueil ». Cette règle n'est pas cosmétique : elle vient de la contrainte d'âge du
   produit, un dépliant poussant vers le bas tout ce qui le suit. Trois issues possibles — une
   fenêtre par facette, une exception assumée et documentée, ou une autre forme d'affichage.

---

## §5. Ce que cet essai n'a PAS tranché

- **Le risque n°1** — `rem` et la police système à 150 % **en WebView**. Non testé, et c'est le seul
  point capable de remettre en cause une partie du travail d'interface.
- **`env(safe-area-inset-bottom)` et la barre d'état** sur un écran à encoche.
- **Le fonctionnement hors ligne réel** — installation puis coupure du réseau. Non fait pendant
  l'essai (l'origine non sécurisée l'empêchait de toute façon).
- **Le message `non_persistant`** dit « Ajoutez l'application à votre écran d'accueil », ce qui
  n'aura aucun sens dans une application native Capacitor. Conséquence connue de la décision
  Capacitor, toujours non traitée.
