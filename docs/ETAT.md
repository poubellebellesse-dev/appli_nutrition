# État du projet — appli_nutrition

> **Plafond : 200 lignes, tenu par la garde.** Ce fichier dit ce qui est construit, ce qui manque et
> où vit chaque chose. Il ne raconte pas comment on y est arrivé.
> **Cure du 2026-09-08 (problème P-14)** : 2 591 → 164 lignes. L'ancien fichier est **intégral** dans
> [archive/ETAT_2026-09-08_avant-cure.md](./archive/ETAT_2026-09-08_avant-cure.md) — rien n'a été jugé,
> tout a été déplacé. Les décisions (ex-§3, §4) vivent dans [decisions/](./decisions/README.md).
> L'état **vérifié du jour** et la prochaine étape vivent dans [FICHE_REPRISE.md](./FICHE_REPRISE.md) ;
> les quatre commandes qui font foi dans [../CLAUDE.md](../CLAUDE.md). Rien n'est recopié ici.

## 1. En une phrase

Planificateur de repas **100 % local, sans IA, sans compte**, téléphone et PC, toutes tranches d'âge.
Moteur TypeScript pur (solveur déterministe sous contraintes), catalogue SQLite construit au build
depuis des YAML/MD, PWA React statique, `user.db` en SQLite WASM sur OPFS. Capacitor en porte de sortie.
Six principes directeurs, dont le n° 1 : **la sécurité de l'utilisateur** (allergènes = contrainte
dure, aucune donnée sans source) et le n° 6 : informer, jamais juger.

## 2. Ce qui est construit

- **Moteur — complet.** Registre à 20 couches (8 exclusion + 12 score ; `occasion`, `topic`, `cost`
  déclarées non codées). `suggestMeals` avec diversification MMR et explication, `suggestAlternatives`,
  `planWeek`, `rerollSlot`, `planLeftovers`, `buildShoppingList`, `scaleRecipe`, 5 garde-fous.
  Quatre défauts corrigés **par mesure** (ingrédient caractéristique, pondération de similarité,
  récence, couverture nutritionnelle). Référence : [ENGINE.md](./ENGINE.md).
- **Catalogue — réel.** Valeurs CIQUAL 2025 (ANSES), plus aucun `PROV-`. Aliments, recettes, lexique de
  gestes, tips, fiches « Comprendre ». **Les comptes se lisent à la commande (`npm run build`, relevé de
  `CLAUDE.md` §« Vérifier »), jamais dans ce fichier.** Tips et fiches « Comprendre » **en base, sans écran** depuis le lot I (2026-09-26).
- **Données — `user.db`.** Schéma complet (§4.3 ARCHITECTURE), migrations versionnées, OPFS
  `opfs-sahpool`, export/import. Règle tenue : toute table que le store lit, il sait l'écrire. Les
  tables sans écran (`user_signal`, `meal_plan`, `shopping_list`, `user_recipe`…) existent déjà.
- **Interface — livrée.** 8 écrans spécifiés dans `DESIGN.md` §4, **12 codés, 12 testés**
  (recompter par `ls app/src/ui/screens/*.tsx`, jamais par cette phrase). Boucle complète :
  s'installer → allergies → suggestion → semaine → courses → cuisiner. PWA installable, service worker,
  socle d'accessibilité, routage par fragment, tutoriel qui traverse les menus.
- **Chantiers livrés** (chacun a son `CONCEPTION_*.md`) : mode cuisine, photos, gestes illustrés
  (clips), invariant origine animale (66/66b/66c), réservation matériel (65a-c), régime personnalisé,
  retours du test téléphone (`retour-1` → `retour-8` ; `retour-8` livré le 2026-09-11 (`6d26fef`) : un plat
  cuisiné dont le repas est passé peut prendre la place de son premier reste, « Non » est gardé en
  base, v20).

```
Concept ✅ ─ Architecture ✅ ─ Moteur ✅ ─ Contenu ✅ ─ user.db ✅ ─ Design ✅ ─ 12 écrans ✅ ─▶ CONTENU & DISTRIBUTION ⬅ ICI
```

## 3. Décisions figées → `decisions/`

Sorties intégralement le 2026-09-08 : [decisions/README.md](./decisions/README.md) (8 fichiers par
thème). Toute référence « `ETAT.md` §3 » antérieure pointe là.

## 4. Décisions encore ouvertes → `decisions/registre.md`

Questions numérotées 1 → 82, barrées quand fermées : [decisions/registre.md](./decisions/registre.md).
**Ouvertes au 2026-09-10 : 2, 5, 6, 11, 52, 58, 65, 68, 70 — neuf**, comptées sur les numéros
non barrés (73 barrées sur 82). **Deux** bloquent quelque chose : 65 (feux possédés), 68 (budget P6).
✅ **La 79 est FERMÉE le 2026-09-09** et codée par `retour-6` le 2026-09-10 ; déclencheur « vide »,
tranché par l'auteur le même jour.
✅ **La 80 est FERMÉE le 2026-09-10** : la déclaration de frigo s'efface **à la fin du repas en cours**,
sans geste ; codée par `retour-7` le 2026-09-11.
✅ **La 82 est FERMÉE le 2026-09-09**, sur la cause et sur la piste (d), livrée par `retour-5d` : la
clause « 6 froides sur 10 » de `retour-1` dépendait de **l'heure de la machine** — l'écran déduit son
créneau de `new Date().getHours()`, bascule à **14 h**, d'où **12/12 froides à 12 h** et **7/12 à
14 h**. Le test épingle désormais sa pastille et mesure les **deux** repas — 12/12 aux deux depuis
`retour-5e`, plancher scellé à 0,9. ⛔ **Deux choses qu'elle ne referme pas** : l'écran de production
déduit toujours son créneau de l'horloge — voulu, gardé sous témoin exécuté ; et le 8/12 d'août
contre 7/12 de septembre reste **inexpliqué**, les deux relevés comparant deux heures sans le savoir.
Ne pas citer la croissance du catalogue comme cause ; si le mécanisme ressort, ce sera par un rouge.

## 5. Les écrans

| § DESIGN | Écran | Moteur | Reste à faire (spec §4 DESIGN) |
|---|---|---|---|
| 4.1 | Aujourd'hui | `suggestMeals` | tags cliquables |
| 4.2 | Semaine | `planWeek` · `rerollSlot` · `planLeftovers` | carrousel « Changer », vue « 3 propositions », écarter, pouce-bas → `user_signal`, sélecteur convives (hors spec, nécessaire à `planLeftovers`) |
| 4.3 | Courses | `buildShoppingList` | autocomplétion sur le catalogue (ajout manuel = texte libre sans `FoodId`), impression/export, « Que cuisiner avec ? » |
| 4.4 | Recettes | `browseRecipes` · `engine/search/` | « Pourquoi pas ce plat ? » ; catégorie « Loufoque » absente du catalogue (contenu, pas code) |
| 4.5 | Vider le frigo | `searchByPantry` · couche `pantry` | substitution suggérée |
| 4.6 | Détail d'une recette | `scaleRecipe` · lexique | matériel, alternatives, notes |
| 4.7 | Gestes (ex-Savoir, lot I) | lexique | tips et « Comprendre » retirés de l'écran, gardés en base |
| 4.8 | Premier lancement | `user.db` · routeur · consentement | écran 4 « vos goûts » — `user_preference` travaille par aliment, l'écran propose des plats |
| — | Paramètres · Éditeur de recette · Mode cuisine · Fiche aliment | — | sans maquette dans `DESIGN.md` (P-15) |

Dev : `npm run dev`. Service worker et installation : `npx vite build && npx vite preview --host` seulement.

## 6. Structure des fichiers

```
docs/            FICHE_REPRISE.md ⭐ · ETAT.md (ce fichier) · decisions/ · PROBLEMES.md (registre P-nn)
                 ARCHITECTURE.md · ENGINE.md · DESIGN.md (font foi) · CONCEPTION_*.md (chantiers)
                 reference/ (PIEGES.md, licences, courriers) · archive/ (instantanés, jamais réécrits)
app/src/engine/  domain/ → nutrition/ guards/ → selection/ → planning/ → api/ (seule surface publique)
app/src/data/    catalog-loader.ts (navigateur, AUCUN import Node) · catalog-loader-node.ts (CLI, tests)
app/src/ui/      écrans, router.tsx, theme.css, user-store.ts
app/src/cli/     bancs de mesure (try-engine, stress-planning, compare-*, diag-*)
catalog/         sources/ (foods.yaml, ciqual-mapping.yaml) · recipes/ · lexicon/ · tips/ · build.mjs
tests/           intégration · tests/scelles/ (un fichier par lot, écrits AVANT le code)
atelier/         hors dépôt (gitignoré) : tri photos/clips, scripts de mesure
vite.config.ts · vitest.config.ts   SÉPARÉS EXPRÈS (root: 'app' faisait disparaître 44 tests)
```

Scripts : `npm test` · `npm run typecheck` · `npm run build` (catalog.db) · `npm run dev` / `preview` ·
`npm run catalog:ciqual -- --write` (seule écriture de valeurs nutritionnelles) · `engine:try` ·
`engine:plan` · `engine:plan-stress` · `engine:similarity` · `engine:couverture`.

## 7. Méthode

Vit dans `CLAUDE.md` (règles), `.claude/commands/` (cycle `/brief` → sceau → `/fin`) et
[reference/PIEGES.md](./reference/PIEGES.md) (index git partagé, `git stash` interdit, `git commit -F
-- <chemins>`, « aucun ✅ sans `git log --all -S` »). Rien n'est recopié ici.

## 8. Dette connue

Registre des **défauts** : [PROBLEMES.md](./PROBLEMES.md) (P-01 → P-21, audit du 06/09). Ci-dessous,
ce que les lots ont laissé ouvert **et qui n'y est pas encore** — une ligne chacune, le détail et les
mesures dans l'archive. Fermer une ligne = la retirer d'ici et le dire dans le lot qui la ferme.

**Sécurité et données**
- Le chemin OPFS (`installOpfsSAHPoolVfs`, survie au rechargement, `navigator.storage.persist`) n'a jamais tourné dans un vrai navigateur ; le seul essai téléphone passait par `vite preview` (P-17).
- La dernière écriture OPFS est différée d'un tour de boucle : fermer l'onglet dans l'intervalle la perd.
- `regimeExigePar` ne rend `omnivore` que pour `groupe === 'viandes'` : un extrait de viande hors groupe est classé laitier.
- La branche mammifère/volaille seule relit la provenance ; poissons, fruits de mer, miel : aucune vérification, erreur indétectable.
- `origine` est encore **optionnelle** (quatrième voie du 66b, ouverte) ; trois casts `as AnimalSource` dans les tests portent la forme interdite, voulu.
- Les gardes du gel (66c) ne voient que `app/src`, `catalog`, `tests` — pas `atelier/`, les configs, `.claude/`.
- `roquefort` : `lait` seul, tranché et sourcé (decisions/02) ; sulfites des fruits secs non tranchés (P-05).

**Moteur et planification**
- Le temps agrégé `prep + cuisson` ignore les repos — additionné en 8 sites. ⚠️ **Depuis le lot C (2026-09-14) ce total est la PREMIÈRE chose que la fiche annonce** : l'omission des repos est passée d'un détail interne à un chiffre lu en tête d'écran, et une recette à long repos y ment davantage qu'avant.
- `Recipe.difficulte` est chargé depuis le catalogue, posé **en dur à 1** par l'éditeur de recette perso (aucun champ de saisie), et **lu par aucun écran ni aucune couche** depuis le lot C, qui l'a retiré de la fiche au nom du principe 6 en le laissant en base. Troisième champ dans ce cas après `piquant` et `recipeMainIngredient` — à trancher en une fois, pas trois.
- `Food.piquant` rempli, non branché (assumé).
- `recipeMainIngredient` n'est lu par aucune couche (bancs seulement) — à supprimer si les bancs sont figés.
- Lexique banni en deux copies (`build.mjs`, moteur) ; la garantie de non-divergence ne portait que sur les listes ; il sur-bloque par sous-chaîne (« soigneusement », « extraite »).
- L'explication distingue peu : mêmes trois phrases, ordre différent.
- `NUTRI_MIN_COVERAGE = 0,7` est un seuil de jugement, jamais calibré.
- Marge de borne `+ margePlatsSimples` dans `planWeek`/`rerollSlot` : coût de calcul non mesuré (`plan-stress` n'a pas de budget de durée).
- `recetteDepuisStockee` pose `estPlatSimple: false` en dur (choix : catégorie éditoriale).
- Motif de case vide (`retour-5b`) : **trois couches d'exclusion sur huit** sont sous témoin exécuté (`allergenes`, `regime`, `exclusions`) ; les phrases `requis`, `temps`, `equipement`, `favoris` sont écrites et atteignables, **aucun test ne les exerce** — un libellé faux y passerait inaperçu ; celle d'`envie` (`retour-6`) est écrite et **inatteignable** (un plan de semaine ne porte pas d'envie).
- Relâchement d'envie (`retour-6`) : la phrase de dernier recours « voici d'autres plats » (trois axes lâchés, liste non vide), l'issue « tout lâché, toujours vide » et les plats proches calculés sur la requête relâchée ne sont exercés par **aucun test**.
- `CONCEPTION_B_VIN_REPAS.md` annonce encore « 18 couches » dans son schéma ; le registre en compte 20. Les documents du moteur avaient oublié `piquant` (décision 35) jusqu'au 2026-09-10.
- Restes orphelins possibles entre le geste « en reste » et la recomposition ; mesuré en mémoire, jamais à l'écran ; deux issues non tranchées (clause 3 de `retour-4`).
- La promesse de portions d'un reste n'est pas rejouée quand le réglage des convives change.
- Défaire « je mange dehors » / « en reste » meurt au rechargement (rien en base ne garde l'occupant précédent) ; un créneau qui portait un reste ne se défait pas (refus délibéré).
- L'écriture en base part même si l'écran a changé de créneau entre le clic et la réponse (l'affichage est gardé, pas l'écriture).
- « Changer » sur Semaine écrit le plan sans reprogrammer les rappels de préparation.
- Retrait posé avant un régime plus strict : les croisements porte × régime ne sont couverts par aucune clause (leçon `retour-2`).
- « Décaler ce plat ? » (`retour-8`) : « Proposer une autre semaine » garde le même `meal_plan.id`, donc un « Non » survit si le même plat retombe sur la même case ; la clé case + plat n'est distinguée par aucun test ; courses et rappels après un décalage, décalage défait, plus d'un convive : aucune clause.

**Interface et appareil**
- **La passe à l'œil sur téléphone a EU LIEU le 2026-09-12**, en APK natif (Poco F8 Ultra) et non en `vite preview` : ~40 observations, triées en lots A → H dans [CONCEPTION_RETOURS_APK.md](./CONCEPTION_RETOURS_APK.md) (A, B, C, E, H et I livrés ; F bloqué sur une séance de design). Le tutoriel n'a toujours jamais été vu tourner hors jsdom ; son garde-fou de 4 s est posé au jugé.
- La barre « Quitter » du mode cuisine est en `sticky top-0` : sous l'affichage bord à bord elle glisse sous la barre d'état, même défaut que celui corrigé par le lot A sur les deux conteneurs de la coquille. Laissé hors du lot A, à traiter.
- Capacitor : `npx cap add android` **est lancé** et un APK de débogage a été fabriqué puis installé (chaîne en mémoire, hors dépôt ; `android/` n'est ni commité ni ignoré — à trancher) ; message `non_persistant` inadapté au natif ; pari `rem` → police système non vérifié ; sensibilité à la casse du serveur de production non vérifiée.
- Cache des clips sans limite de taille (l'« éviction LRU » de §7.1 ARCHITECTURE n'existe pas) ; `cache.addAll` atomique à l'installation, rien ne le rattrape ; pas de bouton « tout télécharger pour le mode avion » ; déviation « photos de recettes » non tranchée.
- Aucun test ne garde le contraste (trois échecs AA corrigés par jetons) ; thèmes d'accent curatés non faits ; `cuisine.tsx` hors échelle typographique (exception nommée « dette »).
- Le bouton « Froid » est passé à gauche de « Chaud » sans qu'aucun test ne le sache ; le placement du retour sur la fiche recette n'est verrouillé par aucun test.
- Écran Recettes : un re-rendu de trop après la première peinture ; le chrono de `#/recettes` (décision 61) n'a jamais été pris.
- Une mise à jour n'atteint l'utilisateur qu'après fermeture complète, sans le lui dire.
- Frigo (`retour-7`) : un écran resté monté à la fin d'un repas garde l'ancienne liste jusqu'au geste ou remontage suivant (aucune minuterie) ; entre minuit et 2 h, « Choisir un plat » compare une case datée en UTC au jour local ; un rythme changé après la déclaration n'est couvert par aucune clause.
- Décocher un ustensile filtre allumé ne repasse par aucun garde-fou (choix) ; le sceau du 65b n'interdit pas d'oublier l'interrupteur à la fermeture ; `readOwnedEquipmentIds` rend `null` sur table vide ; champ « Combien en avez-vous ? » sans clause scellée.
- Mode cuisine (lot E, 2026-09-17) : une quantité n'est plus dite qu'à la première étape qui emploie l'ingrédient. Ce qui tenait la décision 60 par un commentaire de l'écran est tenu par la fenêtre « Voir les ingrédients », sous clause scellée. **Deux ingrédients d'une même recette au même libellé** ne sont gardés qu'en compte agrégé : le texte ne dit plus duquel il parle, aucune clause ne le sépare. L'effet de bord du vocabulaire partagé (retirer un ingrédient de l'étape lui retire son vocabulaire) est mesuré à 0 sur 1 545 gestes, donc sous aucun test.
- Injection des quantités (lot H, 2026-09-19) : la phrase garde désormais le mot que la recette avait choisi, et le critère d'effacement se calcule **mot à mot**. Restent **deux gaucheries antérieures au lot, qui viennent du calcul du DÉTERMINANT et non de l'effacement** : « Beurrer la face extérieure **2 tranches** » (`de chaque` remplacé au lieu d'être accordé — `extérieure` finit par `-re` et `estInfinitif` en fait un verbe, piège « la chair de la courge » déjà documenté) et « Faire rendre leur gras **aux 200 g en lardons** ». Aucune clause ne les garde ; elles se voient à l'œil et par rien d'autre. ⚠️ Les deux gardes de forme du lot (ordre des mots préservé, nom non redit devant sa quantité) sont **vertes sur les 1 545 gestes**, donc sous aucun défaut observable : elles interdisent une manière de réparer, elles ne mesurent rien du catalogue.
- Mode cuisine : la formulation « de 17 à 3 min avant le service » n'est pas scellée ; 94 recettes exigent la plaque sans qu'une étape l'occupe ; 18 `dorer` ne tiennent que par trois cas nommés.
- Drapeaux : 7 cuisines sur 26 sans drapeau (voulu) ; non rendus sous Windows.
- 62 fiches du lexique en texte seul (3 gestes illustrés sur 62 en base, lot geste 2 arrêté par D5) ; catalogue sans densité ni marqueur de liquide ; deux conversions grammes → unité coexistent (`shopping-list.ts`, `ui/quantites.ts`).
- Photos : goulot = la récolte, pas le tri ; les neuf bases de `retour-5` (végétaliennes, chaudes) n'en ont pas.

**Tests et preuve**
- Les tests d'écran non scellés du frigo (`frigo.test.tsx`, `courses.test.tsx`) déclarent à l'horloge réelle : lancés à cheval sur 10 h, 14 h, 17 h ou minuit, ils peuvent rougir sans défaut (`retour-7`). `semaine.test.tsx` « changer le nombre de jours » a rougi une fois le 2026-09-11 (7 jours au lieu de 3) pendant que build et `plan-stress` tournaient en parallèle, vert aux trois relances suivantes : son `waitFor` de 1 s lâche sous charge. **Un rouge NON IDENTIFIÉ le 2026-09-11 à 0 h 04** (1 sur 2 588, code inchangé depuis le relevé vert de 0 h 00), absent des deux relances de 0 h 05 et 0 h 07 : son nom n'a pas été capturé. **Le 2026-09-26, NOMMÉ** : `retour-8` clause 4 « semis » rougit à 15,2 s sous charge (plafond 15 s), à 13 h 33 (avant le lot I) et à 15 h 28 ; le rouge de 14 h 55 n'a pas été nommé ; une suite verte à 15 h 05 ; seul, vert en 10,8 s. Chaque suite du jour porte aussi l'erreur `Timeout calling "onTaskUpdate"` et dure 560-645 s contre 161 s le 2026-09-19 — machine chargée, cause non établie.
- ⚠️ **UNE PHRASE MASQUÉE PAR UN LOT PEUT ÊTRE LA POIGNÉE D'UN AUTRE — 42 rouges payés le 2026-09-14.** Le lot B éteint « Rien n'est obligatoire… » ; `retour-1` (8), `retour-5d` (8) et `retour-6` (26) s'en servaient comme repère d'ouverture de l'encart d'envie et mouraient dans leur `ouvrirEncart()` avant toute mesure. **Deux artefacts scellés se contredisaient.** Tranché et corrigé par l'auteur le même jour (sceau levé puis remis) : repère devenu « Combien de temps devant vous ? », structurel, sous aucun interrupteur. **Aucune assertion n'a bougé** — le compte de lignes de `retour-1` est resté à 324, ce que l'empreinte de `retour-5c` atteste. Avant de masquer un texte : chercher qui le lit comme repère. **Le balayage n'a pas été fait pour les cinq autres phrases de l'interrupteur 2.**
- **Arbre VERT au 2026-09-17 à 17 h 23 (livraison du lot E), zéro rouge** — le compte du jour vit dans `CLAUDE.md` § « Vérifier », pas ici ; précédents verts : le 2026-09-14 à 12 h 45 (lot C) et 09 h 59 (lot B), le 2026-09-11 à 0 h 00 (`retour-7`) : la clause « 6 froides sur 10 » de `retour-1` ne lit plus l'heure (`retour-5d`), les 10 compteurs de recettes sont éteints depuis `retour-5c`.
- **Une clause d'absence qui cherche un mot ne prouve que l'absence de ce mot, et le piège du `\b` a été payé une TROISIÈME fois** — les deux au lot C (2026-09-14, deux tours d'attaque). Mécanisme, contre-mesures et coût : désormais dans [reference/PIEGES.md](./reference/PIEGES.md) § « Les pièges qui ne se voient pas », d'où l'absence des deux premières occurrences avait laissé passer la troisième. **Effet sur l'arbre** : la suite passe de 60,7 s à 70,03 s, dont 28,5 s pour la seule clause différentielle du lot C. Le balayage des autres clauses d'absence lexicale des tests scellés **n'a pas été fait**. Lot I : sa clause 2 est un grep, une clé calculée (`catalogue['ti'+'ps']`) la contourne ; l'ordre du tutoriel de l'onglet et le contenu des tips en base (la clause 3 ne compte que leur nombre) ne sont sous aucune clause.
- **Trois clauses scellées figeaient `USER_SCHEMA_VERSION` en valeur absolue** (`retour-2` 7, `retour-3` 8, `retour-4` 10) : rouges dès qu'un AUTRE lot migre la base, sans que ce qu'elles gardent ait bougé. Corrigées le 2026-09-09 sur décision de l'auteur (cran `libre sceau`, remis ensuite) — **même défaut que les 10 compteurs de `retour-5c`, et le balayage des autres valeurs absolues survivantes n'a pas été fait.**
- Le piège « SQLite valide le `CHECK` d'un `ADD COLUMN` contre les lignes EXISTANTES » (payé par la v19) n'est écrit que dans `CONCEPTION_RETOURS_TEST.md` — pas encore dans `reference/PIEGES.md`.
- **Trois harnais séparés montent l'écran « Aujourd'hui »** : `retour-1` (créneau obligatoire depuis `retour-5d`), `retour-3` (le sien, antérieur), `aujourdhui.test.tsx`. Un montage partagé à créneau obligatoire rendrait l'oubli inexprimable — écarté du lot pour ne pas réécrire le harnais d'un fichier scellé.
- **`retour-5c` photographie `retour-1`** : toute clause ajoutée à l'un de ses six fichiers scellés rougit son empreinte. Rebasée **deux** fois sur décision de l'auteur : le 2026-09-09 (9 → 11 clauses, 23 → 30 `expect(`) et le 2026-09-14 (lot B, deux lignes de code, `lignes` inchangé à 324 — la seule des deux rebases où le compte de lignes prouve que rien n'a été ajouté).
- **Trois valeurs périmées survivent hors du périmètre de `retour-5c`**, qui ne pouvait toucher que ses six fichiers : un **titre de `it`** dans `photo-affichage.test.ts` (« les 201 recettes sans photo »), une chaîne dans `retour-4.test.tsx` (« 223 des 330 recettes ») et de la prose dans `65a.test.ts`. Aucune n'est assertée, donc aucune ne rougit — elles mentent en silence.
- Le test scellé de `retour-5c` a un angle mort mesuré : sa borne de mot rejette un nombre suivi d'un point ou d'une virgule, donc « … sur 330. » en fin de phrase lui échappe. Sans effet au 2026-09-09 (attrapé au balayage manuel), faux négatif réel ensuite.
- `node catalog/audit-mapping.mjs` **ne tourne plus dans le dépôt principal non plus** : `documents Ciqual/2025_11_03` y est absent (gitignoré). La cinquième commande de `CLAUDE.md` n'est mesurable nulle part en l'état.
- Une moitié de clause a été retirée du test scellé de `retour-4` (sceau levé puis remis, décision de l'auteur).
- ⚠️ **DEUX CLAUSES D'UN MÊME TEST SCELLÉ SE CONTREDISAIENT, ET SEUL LE CODE POUVAIT LE MONTRER** (lot E, 2026-09-17, sceau levé puis remis) : une recette sur 339 porte deux libellés emboîtés (« 80 g » et « 80 g bien froid ») employés à deux étapes ; la clause de compte exigeait le long là où la clause de place interdisait le court. Cause : le libellé était cherché **seul**, ce qui désactivait le tri par longueur décroissante prévu pour ce cas. Règle : sur ce projet, un libellé de quantité se cherche toujours dans la liste complète, du plus long au plus court. **Le balayage des autres recherches de libellé isolé dans les tests scellés n'a pas été fait.** Troisième artefact scellé corrigé après coup, après `retour-4` et les 42 rouges du lot B.
- Preuves par mutation et scripts de mesure **hors dépôt** (`atelier/`) : 65a, 65b, 65b-bis, 65c, 66b, 66c — cinq occurrences, à trancher une fois.
- `it.each` nourri par une table de production change le compte de tests sans diff de test (+90 sur `parcours.test.tsx`).
- Un test d'écran qui lit « la première carte » parie sur le catalogue ; la moitié « cadrage » du lot photos n'a qu'un témoin réel.
- Les assertions du 66b lisent le texte exact de `tsc` ; son 3ᵉ test lit `tsconfig.accepte.json` (scellé du 66) ; un garde-fou d'exécution a été retiré de `user-recipe.test.ts`.
- `getByRole` avec filtre de nom ≈ 480 ms par appel sur un écran chargé ; le test de propriété des allergènes n'énumère plus le powerset (à surveiller à chaque palier).
- `65b-bis` n'a pas de commit à lui (parti dans `d0c4bb3`).
- `vite-plugin-sw.ts` est classé binaire par git (`\0` littéral) ; un commentaire d'`export-recette.ts` est faux depuis les photos.
- `flan_oeufs_caramel` fond cuisson et repos en une étape ; le build ne vérifie que la forme d'une source.
- `retour-6` : les balayages 6a (silence) et 6b (zéro intrus) ne couvrent que le **déjeuner** — le dîner (250 recettes) n'est balayé par aucune clause. Vu au tour d'attaque du 2026-09-10, laissé hors du lot.
- `retour-6` : l'en-tête de son test scellé et l'introduction de son brief disent encore « l'écran lâche UN axe » ; la clause 4 bis et le code en lâchent autant qu'il faut tant que la liste est vide. Texte scellé : ne se corrige que sur décision de l'auteur.
- **Lot J (2026-09-30)** : barre d'état, installation masquée en natif, 3 repas par défaut, « Comment ça marche ? » retiré des écrans (seul Paramètres lance un tutoriel) — clauses dans [CONCEPTION_RETOURS_APK.md](./CONCEPTION_RETOURS_APK.md) § Lot J. Dette : défilement sous la barre d'état et « Retour » de Paramètres prouvés par aucun test (jsdom) → **passe APK** ; « Imprimer » inerte en natif → lot courses (export PDF, dépendance native à signaler) ; 8 tests d'écran non scellés citent encore `LienTutoriel` en commentaire ; `lot-J` absent de `.claude/lots.json` (→ `/plan`). **Lot D (même jour)** : le bouton retour d'Android ferme d'abord la fenêtre ou la visite, remonte l'historique, quitte sur Aujourd'hui (`@capacitor/app` ajouté). Dette : appuis rapides répétés et lien profond avec `canGoBack` vrai non couverts ; Échap ferme encore deux fenêtres empilées ; comportement réel **à voir sur APK**.

**Avant publication**
- Relecture par un tiers des 73 tips et 8 fiches : **plus bloquante depuis le lot I** (plus rien n'est affiché) ; redevient bloquante le jour où un lot les rallume.
- Deux trous sanitaires sans autorité lue : céphalopodes, cuisson de l'œuf.
- Revue juridique : « recommandée, non bloquante » en développement, pas pour une mise en ligne.
- `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, CI, linter, `npm audit` : P-10, P-11, P-21.

## 9. Ce qui est écarté

Voir [archive/README.md](./archive/README.md), qui apparie les pistes parallèles, et les blocs sortis
de `FICHE_REPRISE.md` (`archive/FICHE_REPRISE_extraits_*.md`).
