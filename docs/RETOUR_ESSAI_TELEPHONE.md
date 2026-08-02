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

## §1. Corrigé le jour même — commit `3dbaf48`

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

Et l'étape « Installez l'application », désactivée le 2026-08-01, a été rétablie : elle est le seul
endroit du produit qui explique l'installation, et c'est l'installation qui fait accorder le stockage
persistant.

---

## §2. Trois chantiers transverses

Les mêmes manques reviennent sur plusieurs écrans. Les traiter écran par écran produirait trois
implémentations divergentes.

### A. Le système de filtres

Demandé sur **Aujourd'hui**, **Recettes** et **Courses**.

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

Un seul composant, trois branchements.

- **Composer une recette** : complétion sur les **aliments**, les **ustensiles**, les **gestes de
  cuisine**.
- **Courses** : complétion dans la recherche.
- **Savoir** : une barre de recherche pour les études (n'existe pas du tout aujourd'hui).

### C. Les tutoriels

Verbatim : « tuto de 2-3 mins pour guider l'utilisateur aux différents menus », « l'utilisateur teste
en même temps », « ne doit pas que informer mais inciter l'utilisateur à utiliser aussi l'appli — si
il interagit, plus de chance qu'il reste », « je veux des tutos sur tous les menus ».

⚠️ **Ce n'est pas la visite guidée qui vient d'être branchée.** Celle-ci est informative : quatre
bulles qui désignent des éléments. Ce qui est demandé est **participatif** — on dit à l'utilisateur
de cliquer sur un menu, il clique ; on lui dit de changer l'image sur Aujourd'hui, il le fait. C'est
un autre objet, à concevoir avant de coder.

---

## §3. Écran par écran

### Page de bienvenue

- Reformuler le résumé des quatre engagements. Direction donnée : « vos données ne quittent pas cet
  appareil, pas de pub, pas de données à un tiers, rien ».
- **Une ligne d'explication pour chacun** — « petit mais complet ».

### Votre rythme (intro)

- **Proposer les quatre repas** : petit-déjeuner, déjeuner, goûter, dîner.
  ⚠️ Le moteur connaît déjà les quatre (`MealSlot`) — c'est l'écran qui ne les offre pas tous.
- **La description du temps de cuisine n'est pas parlante.** Verbatim : « que change le temps de
  cuisiner par semaine ? le week-end ? temps par jour dans la semaine ? ».
- **Exposer les préférences d'expérience dans les Paramètres**, à commencer par **gestes de balayage
  vs flèches**.
  ⚠️ `user_display.gestesBalayage` **existe déjà en base** et n'est branché à aucun réglage.

### Aujourd'hui

- **« Dites-moi ce que vous cherchez »** doit être **au-dessus** de la recette en grand.
- **« Dans le même esprit » ne tient pas ses promesses.** Verbatim : « pizza gratin tarte aux tomates
  sardine boulettes ??? le même esprit ??? ».
  ⚠️ **Ce n'est pas un bug, c'est un réglage jamais fait** : λ (diversification) n'est pas calibré
  (`ETAT.md` §8). Sa mesure date de 212 recettes, le catalogue en compte 241, et le banc n'affiche
  plus la similarité par recette — **à rétablir AVANT de calibrer**, sinon la mesure est aveugle.
- **Un menu pour les choix extravagants.**
- **Pouvoir changer de créneau** (« ce soir », « ce matin »…).
  ⚠️ Aujourd'hui le créneau est déduit de l'horloge système et n'est pas modifiable.
- **« Vider le frigo » accessible depuis le haut** de l'écran (il est aujourd'hui sous la carte).

### Vider le frigo

Les trois remarques sont traitées (§1). Reste ouvert :

- Le lien avec les Courses mérite d'être **visible** : le garde-manger est bien persisté
  (`user_pantry`) et sert à retirer des articles de la liste, mais rien à l'écran ne le dit.

### Recettes

- **Une fenêtre « mes recettes »** — celles que l'utilisateur a composées.
- **Pouvoir modifier ses propres recettes.**
- Les filtres : voir chantier A.

### Composer une recette

- Complétion à la saisie : voir chantier B.

### Semaine

- **Le choix manuel des plats n'existe toujours pas.**
- **L'alerte « 5 journées apportent moins d'énergie » ne doit pas s'afficher par défaut.** Verbatim :
  « on a dit deux modes → un par défaut pour tout le monde → 1 pour les professionnels ».
  ⚠️ Voir §4.

### Courses

- **Ajouter un article manuellement, avec sa quantité.**
- **Le rayon est calculé par l'appli**, sauf si l'utilisateur veut en imposer un.
- Complétion dans la recherche : voir chantier B.

### Savoir

- **Une barre de recherche pour les études.**

### Divers

- **Des sauces à faire seules** et des **accompagnements** — contenu à écrire.
- **Exporter ses recettes.**

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
