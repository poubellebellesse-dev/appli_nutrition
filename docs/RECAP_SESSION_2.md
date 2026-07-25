# Récap de session 2 — P1b-1 codé, saison en crédits, catalogue élargi, 5ᵉ couche, conception variety/radar

> Récit narratif de la deuxième session de travail. Les décisions sont **répercutées** dans les
> docs de référence (`ENGINE.md`, `ARCHITECTURE.md`, `ETAT.md`, `DESIGN.md`) — **ce sont eux qui
> font foi**. Ce fichier raconte comment on y est arrivé et complète `RECAP_SESSION.md` (session 1,
> conception P1b). Point de reprise condensé : `FICHE_REPRISE.md`.

**Statut** : session close. **Date** : 2026-07-24.

---

## 1. Point de départ

Session 1 avait laissé P0 et P1a committés, et P1b (scoring) **conçu mais pas codé** (huit décisions
figées dans `ENGINE.md` §6.5). Cette session a : (1) codé P1b-1, (2) refondu la saisonnalité sur
demande de l'utilisateur, (3) élargi le catalogue de test, (4) branché le rejet personnel d'aliments,
(5) conçu — sans coder — la refonte de `variety` et la roue des goûts.

Méthode reconduite : **le code s'écrit via des agents Sonnet en effort high ; Claude planifie,
découpe en lots à fichiers disjoints, et vérifie (tests + typecheck + relecture des diffs).**

---

## 2. P1b-1 — le socle du scoring (3 lots)

Une correction de la fiche de reprise de session 1 dès l'entrée : elle affirmait que
`food.saison_mois` existait déjà au schéma réel. **Faux** — seule `recipe.saison_mois` existait. Le
lot 1 a donc dû ajouter *deux* colonnes à `food`, pas juste un flag.

| Lot | Livré |
|---|---|
| **1 — données saison/staple** | `food.saison_mois` + `food.toute_annee` au schéma (`build.mjs`, validation mois 1-12), 30 aliments annotés, propagation `Food` → loader |
| **2 — index dérivés** | `aggregateRecipe`, `computeRecipeNutrients` (**par portion**), `computeRecipeMainIngredient` (non-optionnel de plus forte quantité, tie-break `foodId`), `attachDerivedIndexes` — fonctions pures de `engine/nutrition/`, exécutées à l'init du moteur, pas au build |
| **3 — 7 fonctions de score** | `nutri` · `preference` · `craving` · `season` · `variety` · `speed` · `habit` (minimal), fonctions pures `→ [0,1]`, dans `engine/selection/scoring/`, + `NEUTRAL_SCORE = 0.5` |

Décisions tranchées en cours de route, toutes documentées dans le code :
- **`recipeNutrients` stocke le vecteur PAR PORTION** (`aggregateRecipe / portionsBase`), pas le
  total — c'est l'échelle que `nutri` compare à la part d'un créneau ; stocker le total exposerait à
  une erreur d'échelle silencieuse.
- **Ingrédients optionnels INCLUS** dans l'agrégation nutritionnelle (décision utilisateur : ils
  font partie du plat servi par défaut). Conséquence notée : `suggestAlternatives` (P1c) devra
  recalculer une variante, jamais relire l'index.
- **Recette sans ingrédient non-optionnel** → absente de `recipeMainIngredient` (Map partielle
  assumée, plus honnête qu'un faux principal).
- **Neutre = 0,5 partout, jamais 0** — un signal sans information ne pénalise pas.

Le lot 3 a connu un échec d'infrastructure (watchdog) sans dommage sur le dépôt, relancé et rendu
proprement. `createEngine` reste un **stub** : son assemblage est P1b-2.

Un document interactif consigne les sept formules avec leurs **valeurs réelles calculées sur le
catalogue** (pas d'exemples inventés) — artefact « Formules de score ».

---

## 3. Saison — de « tout ou rien » à des crédits

L'utilisateur a repéré le défaut : la première `season` excluait du calcul tout aliment marqué
« toute l'année ». Résultat prouvé sur le catalogue : **la soupe de carottes à l'ail scorait 0,500
douze mois sur douze** — carotte, oignon, ail tous marqués staple, plus rien à mesurer. Couche
aveugle sur la moitié du catalogue.

Cause : une confusion entre **être disponible toute l'année** et **être en pleine saison**. Une
carotte est les deux. Corrections apportées :

- **`toute_annee` et `saison_mois` deviennent indépendants et cumulables.** La validation « les deux
  à la fois = erreur de build » est retirée ; son test est renversé (le double marquage est
  désormais *vérifié comme accepté*).
- **`season` réécrite en crédits** : chaque ingrédient à `saison_mois` renseignée rapporte **1** en
  pleine saison, **0,5** hors saison mais `toute_annee`, **0** sinon ; les aliments sans saison
  (sel, huile, pâtes) sont exclus du calcul. Dénominateur vide → **0,5** neutre.
- Plus tard dans la session, `season` est **pondérée par la quantité** (même motif que
  `preference`) : 5 g de persil ne pèsent plus autant que 400 g de courgettes.

Effet : la soupe de carottes fait maintenant **1,0 de septembre à mars, 0,83 en avril, 0,5 en
mai-juin, 0,67 en juillet** — courbe réelle, conforme à la projection. Le demi-crédit distingue
« disponible mais pas à son meilleur » de « hors saison pour de bon ».

---

## 4. Catalogue de test — 30 → 76 aliments

Deux vagues : d'abord 30 → 60 (12 légumes, 10 fruits, 4 protéines, 4 épicerie + réannotation des 6
légumes de garde existants), puis 60 → 76 (5 fromages, 4 poissons, 4 fruits de mer, 3 alcools de
cuisine). Deux groupes nouveaux au vocabulaire ouvert : `fruits de mer`, `boissons alcoolisées`.

Valeurs nutritionnelles toujours en `PROV-` (ordres de grandeur, pas de vraie table CIQUAL). Cas
volontairement instructifs : **banane et orange** en `toute_annee` **sans** `saison_mois` (aucune
production métropolitaine — ils prouvent que « disponible » ≠ « de saison ») ; **saumon, truite,
crevette** en élevage/import.

Dette signalée : `roquefort` porte l'allergène `lait` mais pas `sulfites` (souvent présents dans le
vrai roquefort) — à revoir avec la table CIQUAL réelle.

---

## 5. Rejet personnel d'aliments — la 5ᵉ couche d'exclusion

`HardConstraints.excludedFoodIds` existait dans les types depuis P0 mais **aucune couche ne le
lisait**. Branché cette session :

- Nouvelle couche `exclusions` (`personalExclusionLayer`), **non critique** (choix perso
  désactivable, contrairement aux 🔒 `allergenes`/`regime`), **exclusion dure** — pas un score
  négatif contournable (cohérent avec §5.2 ARCHITECTURE).
- **Un aliment exclu en ingrédient optionnel n'exclut PAS la recette** (elle reste servable sans,
  via les alternatives P1c) ; seul un ingrédient non-optionnel déclenche le rejet.
- Ordre de priorité de motif : `allergenes → regime → exclusions → temps → equipement`.
- **Le registre passe de 14 à 15 couches** (5 exclusion + 10 score). Répercuté dans `layer-ids.ts`,
  `LAYER_DESCRIPTORS`, `exclusion-pass.ts`, la note `speed` (« 16ᵉ couche »), et les docs.

Son **miroir `requiredFoodIds`** (« je veux ça ») est décidé mais pas codé : filtre **dur en
contexte « Aujourd'hui »** seulement — exiger un aliment précis vide vite le panier, dangereux en
réglage permanent.

---

## 6. Conceptions livrées (sans code)

### `variety` — trois réglages séparés (artefact « Conception variety »)
La version P1b-1 confondait trois choses, désormais distinctes :
- **Vitesse d'oubli (TAU)** — réglable à trois crans **3 / 7 / 14 jours** (défaut 7). Répond à
  « l'habitude, c'est par semaine ou par quinzaine ? ». Un plat d'il y a 7 jours vaut 0,90 / 0,63 /
  0,39 selon le cran.
- **Rythme du changement** — bascule explicite (« Surprends-moi ») **brusque** (dès le repas
  suivant) ; dérive apprise des habitudes **graduelle** (~4 repas) et **repoussée** avec la refonte
  de `habit`. Le mode par défaut reste stable.
- **Restes** — un repas d'historique porte une **origine `choisi` / `reste`** : `variety` lit tout
  (un reste mangé lasse), `habit` ne compte que les `choisi` (un reste n'est pas une préférence).
  Champ à ajouter sur `MealHistoryEntry` avant que l'historique existe.

Deux horloges à ne pas confondre : TAU (oubli d'un plat, quelques jours) vs fenêtre d'historique
(profondeur d'apprentissage, 21 jours).

### Roue des goûts — radar (artefact « Conception radar »)
Un **radar, pas un camembert** (des intensités indépendantes, pas des parts d'un tout). Les 3 axes
sensoriels dépliés en 6 pôles (Salé↔Sucré · Léger↔Consistant · Chaud↔Froid), calculés sur les vrais
axes du catalogue, par plat **et** — moyennés — par profil. C'est une lecture visuelle de ce que
`habit` apprend déjà, pas un second calcul. Rayons cuisine/saveur = v2. Partage via la carte Canvas
(§8.7). Sur chaque fiche plat + dans le profil.

### Courses non alimentaires (artefact « Rayons courses »)
Pour éviter d'obliger l'utilisateur à jongler entre plusieurs applis. **Table séparée de `food`**
(aucun nutriment, jamais éligible comme ingrédient), branchée uniquement sur la liste de courses.
~150 articles classés ont montré que **6 rayons ne suffisent pas** ; découpage retenu : **10 rayons**
(Hygiène & soin · Cheveux/rasage/beauté · Nettoyage & maison · Lessive & linge · Vaisselle & cuisine
jetable · Maison & bureau · Animaux · Bébé · Pharmacie & premiers soins · **Vêtements & textile**).
Allergènes = **note libre optionnelle**, pas le système structuré des 14 allergènes UE (réservé à ce
qu'on mange). **Non codée** : pas de consommateur avant `buildShoppingList` (P1c) — la coder
maintenant serait spéculatif.

### Conseils vin + modes recette/repas — chantier B, en file
Conseil vin = **métadonnée éditoriale** (jamais dans le score, jamais nutritionnelle, masquable, ton
de service et non d'incitation). Mode **recette** (plat unique) vs **repas** (entrée+plat+dessert
avec accords entre plats) = extension de la planification. Document de conception à produire.

### Scan produit — v2+++++
Enrichissement **opt-in** via OpenFoodFacts (données ouvertes, local-first), **jamais** les notes/
jugements façon Yuka (à l'opposé du principe 6). Repoussé loin.

---

## 7. État de fin de session

`npm test` → **140 verts (22 fichiers)** · `npm run typecheck` propre · `npm run build` → 76
aliments, 10 recettes. **Rien n'est committé au-delà de P1a** — le gros paquet P1b-1 + saison +
contenu + 5ᵉ couche + docs attend un lot de commits, puis un push utilisateur.

Suite détaillée : `FICHE_REPRISE.md` § « Reprendre ici ».
