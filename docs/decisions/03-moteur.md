# Décisions figées — Moteur

> Sorti intégralement de `ETAT.md` §3 le 2026-09-08 (cure, P-14). Texte non réécrit. Ne pas rediscuter sans raison.
> Index : [README.md](./README.md) · questions numérotées : [registre.md](./registre.md).

## Moteur
- **Registre de 20 couches** à contrat commun (`SelectionLayer`), pas un pipeline figé (le code
  fait foi, voir `app/src/engine/domain/layer-ids.ts`). Une 5ᵉ couche d'exclusion `exclusions`
  (rejet perso, `excludedFoodIds`) a été ajoutée en session 2, une 6ᵉ couche `requis` (miroir
  dur, `MealContext.requiredFoodIds`) en session 3, puis `speed` a rejoint le registre comme 11ᵉ
  couche de SCORE, puis une 7ᵉ couche d'exclusion `favoris` (`onlyFavorites`) en session 4 —
  corrige aussi les anciennes mentions « 12 » puis « 14 » puis « 15 » puis « 16 » puis « 17 ».
  - Exclusion (7) : `allergenes` 🔒 · `regime` 🔒 · `exclusions` · `requis` · `temps` ·
    `equipement` · `favoris` (inerte hors `onlyFavorites`, motif le moins informatif → en dernier)
  - Score (11) : `nutri` · `preference` · `craving` · `variety` · `season` · `pantry` · `habit` ·
    `occasion` · `speed` · `topic` (v2, réserve) · `cost` (v3, réserve)
  - `speed` **EST désormais une couche du registre à part entière** (tranché et CODÉ) — poids par
    défaut nul, relevée par l'archétype « Rapide » (`app/src/engine/selection/scoring/speed.ts`).
    Voir `docs/ENGINE.md` §6.5.
- **Fonction pure synchrone**, catalogue en RAM. Pas de `Date.now`/`Math.random` (PRNG à graine,
  tie-break stable par id de recette).
- **Sécurité = post-conditions** : le moteur lève plutôt que de retourner un résultat non sûr.
  **Quatre garde-fous CODÉS** sur cinq (`assertNoDeclaredAllergen`,
  `assertScoringLayersNeverExclude`, `assertNoTherapeuticClaim`, `assertCriticalLayersRan`) — ne
  reste que `assertCalorieFloor`, en attente de `planWeek` — détail : `docs/ENGINE.md` §5.2.
- **Anticipation sans IA** = 4 statistiques locales (couche `habit`), réversibles.
- **Poids dynamiques** : `craving` passe **n°1 — CODÉ** dès qu'une envie est RÉELLEMENT exprimée,
  **uniquement dans le contexte « Aujourd'hui »** (suggestion ponctuelle) ; il reste à son socle
  bas en `planWeek` (pas de « moment T » pour les jours futurs — la semaine reste pilotée par
  `nutri`). Symétrie : **Aujourd'hui = envie · Semaine = équilibre.** `occasion` **devrait** passer
  n°2 pendant une occasion active (0 hors période) mais la couche `occasion` **n'est pas
  implémentée**. Détail complet : `docs/ENGINE.md` §6.5.
- **Équipement à trois niveaux** : `requis` (exclusion) · `accelere` (score) · `informatif`
  (ustensile, **n'exclut jamais**).
  ✅ **LIVRÉ le 2026-08-09, du YAML jusqu'à l'écran** — la ligne disait « jamais chargé par le
  moteur », ce n'est plus vrai. `catalog/equipment/` (**30 entrées**), tables `equipment` et
  `recipe_equipment`, **1 473 couples** sur 330 recettes (357 requis · 38 accélère · 1 078
  informatifs), aucun orphelin au référentiel. Côté app : `Catalog.equipment`, `Recipe.equipements`,
  `user_equipment` lu ET écrit, section « Matériel » sur la fiche recette.
  ⛔ **« ÉCRIT » A ÉTÉ FAUX DU 2026-08-09 AU 2026-08-18, ET PERSONNE NE L'AVAIT VU.** Jusqu'au lot
  65b, `writeOwnedEquipmentIds` n'avait **aucun appelant de production** — seul son propre test
  unitaire l'appelait, donc la table était vide chez tout le monde et la couche `equipement` était
  inerte par accident, pas par conception. La phrase est devenue vraie **le 2026-08-18**, quand
  l'écran de matériel est arrivé. ⚠️ **Ce n'est pas un détail de rédaction** : la ligne a servi neuf
  jours de preuve que le sujet était clos, alors qu'il n'était même pas ouvert.
- ⛔ **Le niveau vit sur le COUPLE recette × équipement, jamais sur l'ustensile.** Un mixeur est
  `requis` pour un velouté lisse et `informatif` pour une soupe rustique : c'est une propriété de la
  recette, pas de l'appareil. Un référentiel qui porterait le niveau forcerait la valeur la plus
  dure partout.
- ⛔ **`HardConstraints.ownedEquipmentIds` est un TRI-ÉTAT, et c'est structurel.** `null` = jamais
  déclaré → **couche inerte** ; `[]` = déclaré vide → exclut les `requis`. Confondre les deux
  supprimerait d'un coup les **107 recettes qui passent par un four** pour tout utilisateur n'ayant
  rien renseigné. Même parti que `temps.ts` (`availableMin === null`), `PiquantTolerance` et
  `porteDejaUneSauce`. **`engine:plan-stress` est le garde-fou** : il vire au rouge si le tri-état
  se replie en liste vide.
- ⛔ **`requis` est réservé à l'INFAISABLE SANS.** Un mixeur pour un velouté est `accelere` (moulin
  à légumes, presse-purée, tamis font le travail) ; tout ce qui se remplace par un ustensile de base
  est `informatif`. `ENGINE_4` §141 avertit : sans cette discipline, ne pas posséder de mixeur
  supprimerait la moitié du catalogue.
- **Archétypes — CODÉS (P1b-2), noms validés** : remplacent/généralisent l'idée initiale de
  « 4 préréglages nommés » — un vecteur de poids nommé sur les couches de score, jamais sur les
  couches critiques (`equilibre` défaut, `envie`, `decouverte`, `de_saison`, `mes_gouts`,
  `rapide`). Le sélecteur UI (onboarding/Paramètres) reste **P3**. Détail : `docs/ENGINE.md`
  §6.3 bis.
- **65a — l'occupation d'un four se dérive du texte des étapes, et un partage se déclare au
  catalogue. TRANCHÉ et CODÉ le 2026-08-13** (cinq lots A→E ; détail :
  `docs/CONCEPTION_RESERVATION_MATERIEL.md`). Trois choses sont figées. **(a) Une occupation est un
  intervalle, pas une étape** : `recipe_step_equipment` porte `(ordre_debut, ordre_fin)`, ce qui
  seul exprime qu'un four est LIBRE entre deux cuissons de la même recette — 13 recettes le
  demandent. **92 occupations sur 85 recettes, 4 déclarées et 88 dérivées** ; la colonne `origine`
  rend la dérivation visible au lieu de la fondre dans le déclaré, comme pour
  `recipe_step_ingredient`. **(b) La règle de détection est versionnée** (`catalog/`), pas enfouie
  dans une sonde de `atelier/` : c'était le reproche exact que la 65 faisait à l'inférence par les
  gestes. Une déclaration `occupe:` dans le YAML l'emporte toujours sur la dérivation. **(c) Le
  partage est une donnée à TROIS valeurs** — `jamais` / `selon_quantite` / `toujours` — et la
  troisième est celle qui fait tenir l'ensemble : elle nomme « je ne sais pas combien tu en as »
  sans y répondre. ⛔ **Une capacité inconnue rend `null`, et `null` n'est pas 1.** Le moteur se
  tait. C'est ce qui permet de livrer sans avoir tranché 65b.
- **65b — déclarer son matériel INFORME ; filtrer les recettes se DEMANDE. TRANCHÉ et CODÉ le
  2026-08-18** (plan : `docs/CONCEPTION_RESERVATION_MATERIEL.md` § « La redéfinition du 2026-08-18 »).
  Trois choses sont figées. **(a) Un interrupteur, éteint par défaut, décide seul si le matériel
  déclaré descend au moteur.** `readConstraints` ne transmet `ownedEquipmentIds` que s'il est
  allumé — sans quoi le premier écran capable d'écrire `user_equipment` aurait allumé la couche
  `equipement` : mesuré, cocher le seul four retirait **264 recettes sur 330**, en silence.
  **(b) L'interrupteur EST le marqueur de déclaration** que `readOwnedEquipmentIds` réclamait depuis
  P1a : allumé, il rend `[]` signifiant — « j'ai regardé, je ne possède rien » — là où une table vide
  ne distinguait pas « jamais ouvert » de « tout décoché ». Aucune ligne datée n'a été nécessaire.
  **(c) Une recette écartée n'invente aucun affichage** : l'entonnoir chiffré et le bloc « pourquoi
  pas ce plat ? » existaient déjà, et `LIBELLE_COUCHE` portait `equipement` sans jamais l'atteindre.
  ⛔ **La quantité de feux a été SORTIE de 65b le même jour** — aucune recette du catalogue ne
  déclare occuper la plaque, donc elle n'aurait rien affiché. Elle part au **65c**, avec la détection
  qui lui manque. ⚠️ **Le gain n'est pas le volume de
  fausses alertes évitées** : sur les paires de recettes à occupation de four, **2 831 sur 3 321 se
  chevauchent encore (85,2 %)**. Le gain est que l'écran dit **une plage** au lieu d'une liste de
  noms — un fait daté, pas un jugement (principe 6).
- **65c — un geste ambigu se tranche par CE QUI PRÉCÈDE, et la quantité déclarée est un
  TRI-ÉTAT. TRANCHÉ et CODÉ le 2026-08-20** (plan : `docs/CONCEPTION_RESERVATION_MATERIEL.md`
  § « Lot 65c », commit `4a9f373`). Quatre choses sont figées.
  **(a) La plaque se dérive de QUINZE gestes du lexique qui ne se font que sur un feu du dessus**,
  jamais d'un mot du texte : « faire revenir les oignons » ne nomme aucun ustensile. `vapeur` n'en
  est pas — ses deux étapes décrivent un risque et ne commandent rien.
  ⭐ **(b) `dorer` PREND L'INDICE DE SON ÉTAPE, ET À DÉFAUT CELUI DES QUATRE ÉTAPES QUI PRÉCÈDENT**
  — règle posée par l'auteur le 2026-08-19. C'est le geste le plus fréquent de la liste (64 étapes)
  et **23 sont au four** ; une règle qui lit l'étape SEULE en attrape 22 et sort la vingt-troisième
  d'un feu où elle n'est jamais allée. Un plat mis au four y reste jusqu'à ce qu'on l'en sorte.
  ⛔ **Onze `dorer` que rien ne tranche restent DEHORS** : la règle ne devine pas.
  **(c) La quantité déclarée est un TRI-ÉTAT, et l'absence fait TAIRE le moteur.** Colonne nullable,
  `NULL` = « je n'ai rien dit ». Un défaut à 1 ferait crier au conflit sur presque chaque paire de
  plats — **166 recettes tiennent la plaque**. C'est la propriété que 65a a payée pour obtenir.
  ⛔ **(d) UN TEST SCELLÉ NE GÈLE PAS LE FUTUR — deux clauses du 65b desserrées le 2026-08-20**,
  par décision de l'auteur. Elles écrivaient `toBe(17)` en dur : non pas « la v17 existe » mais
  « et il n'y en aura jamais de dix-huitième », que la prose du 65b ne mentionne nulle part. **Ce qui
  reste scellé est intact** — la 17 est toujours exigée dans la liste, la liste reste sans trou ni
  doublon, une base v16 remplie la traverse sans rien perdre et son interrupteur naît éteint. ▶ Le
  repère : **un sceau affirme un invariant, pas un instantané.** `Math.max(versions)` doit valoir
  la constante de version, pas un nombre écrit à la main.
- ✅ **UNE ORIGINE ANIMALE NE S'ÉCRIT PLUS SANS SA PROVENANCE — LA GARANTIE VIENT DE LA FORME**
  (décision 66, livrée le 2026-08-14). `Food.origineAnimale` est une paire
  `{ origine, provenance }` ou `null` ; `Food.provenanceAnimale` **n'existe plus**. Avant, deux
  champs nullables indépendants, et l'invariant n'était tenu que par les quatre refus de
  `catalog/build.mjs` — c'est-à-dire pour le catalogue LIVRÉ, et pour lui seul : une fixture, une
  recette perso ou un objet monté à la main écrivaient la moitié de paire sans qu'aucun type, aucun
  test ni aucun écran ne bronche. **Les refus du build restent** ; la forme les double d'un côté
  qu'ils ne voyaient pas. ⚠️ **UN SEUL CONSTRUCTEUR DANS TOUT LE DÉPÔT** (`venantDe`), production
  comprise : le chargeur y passe comme les tests. Un littéral rendrait le même objet — l'uniformité
  est le but, pas la correction. ⚠️ **LE SCHÉMA SQL ET LE YAML NE BOUGENT PAS** : `origine_animale`
  et `provenance_animale` restent deux colonnes et deux clés (une colonne composite n'existe pas en
  SQLite). Le recollement se fait à UN endroit, `catalog-loader.ts`, **qui teste les deux colonnes**
  — il ouvre aussi des bases construites ailleurs. ⚠️ **LES DEUX RÉSOLVEURS GARDENT LEUR SIGNATURE**
  et leur parcours partagé : leurs appelants lisent chacun UN des deux faits, jamais les deux.
  ✅ **CE QUE LA LIVRAISON A MESURÉ ET QUE LE BRIEF DISAIT FAUX : aucun lecteur de production n'a
  cassé.** Les quatre annoncés passent tous par les résolveurs. Le changement de type n'a fait tomber
  que des fixtures de test — **l'encapsulation tenait déjà**, et c'est une propriété à ne pas
  défaire. ⚠️ **LA POLARITÉ DE REPLI RESTE MESURÉE, PAR CAST EXPLICITE** : « origine sans provenance
  → `corps` et `omnivore` », jamais `production` ni `vegetarien`. Le cas est devenu inexprimable au
  type, pas impossible à l'exécution — ces fonctions tournent sur des recettes perso, contre un
  `user.db` sans clé étrangère vers le catalogue. ⛔ **NE PAS RENDRE `provenance` OPTIONNELLE NI
  ÉLARGIR LE TYPE EN `AnimalOrigin | AnimalSource`** : ces deux « compatibilités » rouvrent
  exactement le trou, et `tests/scelles/sondes-66/` existe pour les refuser.
- ✅ **NI L'ORIGINE NI LA PROVENANCE NE PEUVENT ÊTRE PRÉSENTES ET NULLES** (lot 66b, livré le
  2026-08-14). C'est la troisième façon de rouvrir le trou du 66, un cran plus bas que les deux
  ci-dessus : **une clé requise dont le TYPE inclut `null`**. TypeScript exige une clé requise quel
  que soit son type, donc les six tests scellés du 66 la laissaient passer en entier. ⚠️ **MESURÉ
  PAR MUTATION, JAMAIS DÉDUIT — et c'est ce qui a révélé que le trou était deux fois plus large que
  le brief ne le disait** : le brief ne portait que la provenance, et avec `origine` rendue nullable
  les **huit** tests d'alors sont restés VERTS. ⛔ **LA LEÇON DÉPASSE LE MOTEUR ET VAUT POUR TOUT LE
  DÉPÔT : FERMER UN TROU SUR UN CHAMP NE DIT RIEN DE SON JUMEAU. Une paire se teste des DEUX côtés,
  ou elle n'est testée qu'à moitié.** ⚠️ **ET CETTE PHRASE ELLE-MÊME ÉTAIT TROP COURTE : elle ne
  parle que de l'axe VALEUR.** Sur l'axe PRÉSENCE, la paire n'est toujours testée que d'un côté —
  `origine` rendue OPTIONNELLE laisse les neuf tests verts. ✅ **FERMÉ PAR LE 66c LE 2026-08-17, ET
  IL Y AVAIT TROIS TROUS, PAS UN** : un troisième axe existait, `undefined`, distinct de `null` et
  d'une clé absente sous `exactOptionalPropertyTypes`. Six cases, pas quatre — voir §8. ⚠️ **AUCUNE LIGNE DE CODE DE PRODUCTION N'A CHANGÉ** — le type
  livré par le 66 était déjà juste. Ce lot n'achète pas une correction, il achète l'impossibilité de
  la défaire en silence. ⚠️ **CE QUI PROUVE QUE CES TESTS DISCRIMINENT N'EST PAS DANS LE DÉPÔT** :
  ils passent au premier essai, et seule la mutation manuelle les distingue d'assertions
  décoratives — voir §8.

- ✅ **POSER UN RESTE À LA MAIN GARDE LES DEUX CRÉNEAUX, ET L'ANNULATION NE REND QUE CE QU'ELLE A
  PRIS** (décision ~~78~~, lot `retour-4`, livré le 2026-08-26, `7642492`). Le créneau qui reçoit le
  reste **et** celui de la CUISSON sont verrouillés par le même geste. ⚠️ **Sans le second verrou, la
  recomposition suivante déplace le plat source et la semaine porte le reste d'un plat cuisiné nulle
  part** — mesuré sur le code livré : `plan-week.ts` verse le `recipeId` de toute entrée verrouillée
  non-accompagnement dans `placedRecipeIds`, donc le reste y entre comme s'il était la cuisson, et la
  cuisson n'est plus programmée. La liste de courses écartant les restes, **rien n'est acheté pour ce
  repas**. ⚠️ **L'annulation ne relâche la cuisson que si plus AUCUN reste POSÉ À LA MAIN ne s'en
  nourrit** — et « posé à la main » se lit sur le verrou, pas sur `isLeftover`. ⛔ **La version large
  de ce prédicat a été écrite d'abord, et elle ne relâchait jamais rien** : la source d'un reste
  plaçable est presque toujours un plat que la pose automatique sert déjà ailleurs (trois restes sur
  l'unique source de la première cible, aux deux rythmes). **Un reste automatique se recalcule à
  chaque recomposition ; il n'a pas besoin d'un verrou, donc il ne doit pas en retenir un.**
- ⛔ **L'OFFRE « LES RESTES DE… » SE CALCULE SUR LES PLATS CUISINÉS DU PLAN, SANS DÉDUIRE CE QUE LA
  MACHINE A DÉJÀ POSÉ** (même lot). Mesuré avant d'écrire une ligne : la pose automatique consomme
  **toutes** les portions plaçables — **0 créneau** restait offrable à 1, 2 comme 3 convives. Une
  offre qui respecterait la même comptabilité serait **vide** sur chaque créneau d'une semaine
  fraîchement composée. ▶ **Le lot n'ajoute donc pas une capacité, il ajoute un CHOIX** : la machine
  plaçait déjà les restes, l'utilisateur ne décidait pas *où*. ⚠️ Contrepartie assumée, non mesurée
  à l'écran : le créneau qu'on transforme en reste était peut-être lui-même la cuisson d'autres
  restes, qui se retrouvent sans plat cuisiné jusqu'à la recomposition — voir §8.
