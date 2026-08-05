# Pièges et règles de contenu — appli_nutrition

> Extrait de `FICHE_REPRISE.md` le 2026-08-03. **Contenu repris à l'identique, rien de réécrit.**
> Ce fichier est de la RÉFÉRENCE : il ne décrit pas l'état du projet, il liste ce qui coûte cher
> quand on l'ignore. La fiche de reprise n'en garde qu'un renvoi.

---

## Avant de coder

- ⚠️ **Ne jamais lancer `git` depuis un montage Linux** (pont Cowork, WSL). Les fichiers sont en
  **CRLF sur disque et en LF dans git** : sans le filtre `core.autocrlf`, `git status` annonce
  **136 fichiers modifiés quand ~27 le sont vraiment**, et un commit passé de là écrirait ~110
  fichiers de pur churn de fin de ligne. Depuis un pont, lire `git diff --ignore-cr-at-eol
  --numstat`, jamais `git status` brut. Sur la machine de l'auteur (Windows), aucun problème.
- ⚠️ `git status -sb` — des commits peuvent ne pas être poussés. **Le compte vit là, pas dans ce
  document** : `git push` étant manuel, tout nombre recopié ici se périme en un geste.
- ⚠️ **Lire la maquette de l'écran AVANT de le coder** (`maquete claude design/`).
- Les valeurs nutritionnelles **ne s'écrivent JAMAIS à la main** : `foods.yaml` + `ciqual-mapping.yaml`,
  puis `npm run catalog:ciqual -- --write`.
- Méthode (`CLAUDE.md`) : plan ≤3 bullets avant toute tâche 2+ fichiers · TDD sur la logique moteur ·
  échec 2× → stop · jamais commit/push/install sans demande explicite.


## Les pièges qui ne se voient pas

**Chaîne de build**

- ⚠️ **`catalog-loader.ts` et les `user-*.ts` ne doivent importer AUCUN module Node.** L'import est
  **hoisté** : un `import 'node:sqlite'` casse le bundle navigateur même si la fonction n'est jamais
  appelée. Le message de Rollup ne désigne pas la cause. Seul `vite build` l'attrape.
- ⚠️ **`vitest.config.ts` est séparé de `vite.config.ts` exprès.** Y poser `root: 'app'` a fait
  passer la suite de **572 tests à 528 sans le moindre échec**.
- ⚠️ **Hacher les NOMS de fichiers n'invalide pas un cache.** Tout ce qui vit dans `public/`
  (`catalog.db`, polices, icônes) a un nom FIXE. → hacher le CONTENU.
- ⚠️ **Un test qui écrit `app/public/catalog/catalog.db` court contre les tests d'écran**, qui le
  lisent via `ui/test-socle.ts`. `build.mjs` supprime sa sortie avant de la recréer. Tout build
  lancé depuis un test va dans un dossier temporaire (`--out`) — corrigé le 2026-08-01.

**Ce qu'on commite n'est pas ce qu'on a testé**

- ⛔ **Les quatre commandes vérifient l'ARBRE DE TRAVAIL, jamais l'INDEX.** Tant que l'index est
  composé d'un `git add` de fichiers entiers, les deux coïncident et la distinction ne coûte rien.
  Dès qu'on compose l'index autrement — `git add -p`, un `git update-index` à la main, un fichier
  reconstruit — il devient un **TROISIÈME ÉTAT**, entre `HEAD` et l'arbre, que **rien ne vérifie**.
  Payé le 2026-08-05 : `main` a été poussé rouge avec 1 452 tests verts et un typecheck propre à
  l'écran, parce que les deux portaient sur l'arbre. → **vérifier le COMMIT lui-même**
  (`git worktree add --detach .verif <sha>`, puis `node catalog/build.mjs` et les quatre commandes
  dedans), pas l'arbre dont il est censé sortir.
- ⚠️ **Un arbre neuf n'a pas de `catalog.db`** : il est gitignoré. Une suite lancée dans un worktree
  frais rend ~168 échecs « unable to open database file » qui ne sont **pas** des régressions. Faire
  `node catalog/build.mjs` d'abord, sinon on diagnostique un fantôme.
- ⚠️ **Découper un bloc de code par recherche de `]` ou `}` est faux dès qu'il y a une annotation de
  type.** Le premier `]` après `const X: readonly string[] = [` est celui de `string[]`, pas la
  fermeture du littéral. C'est exactement ce qui a tronqué la migration v9 en
  `const V9_STATEMENTS: readonly string[]` — déclarée, VIDE, et une base neuve n'aurait jamais reçu
  sa colonne. Chercher la fermeture **en début de ligne** (`
]`), ou ne pas découper du tout.
- ⚠️ **Une session concurrente peut committer entre votre commit et sa vérification.** `HEAD~1` ne
  désigne alors plus ce qu'on croit : ce jour-là il pointait sur le commit cassé lui-même, et une
  « réparation » construite dessus l'aurait recopié. Relire `git log` avant de reconstruire quoi que
  ce soit — et **réparer en AVANT**, jamais en réécrivant un historique sur lequel quelqu'un
  construit déjà.

**Les bancs mentent par omission — ce qu'ils ne comptent pas**

- ⚠️ **`plan-stress` affiche « 20/20 configurations saines » avec DIX CRÉNEAUX VIDES de plus.**
  Constaté le 2026-08-03 : un filtre trop dur sur `Recipe.service` a fait retomber le végétalien
  14 j de **42/42 à 32/42** créneaux remplis, et le « végétalien + sans gluten » de 16 trous à 33 —
  banc **vert** d'un bout à l'autre. Il ne compte comme échec qu'un plantage, un doublon, un créneau
  manquant ou un non-déterminisme ; **un créneau VIDE est un résultat normal** pour lui (un
  catalogue à 7 petits-déjeuners ne peut pas en fournir 14). **Lire la colonne « remplis », pas le
  verdict.** Même famille que les 572 → 528 tests de `vitest.config.ts` : un compte qui baisse sans
  rouge est un signal, pas un hasard.
- ⚠️ **Un banc qui compte des LIGNES quand la donnée compte des CRÉNEAUX crie au feu sur du code
  juste.** Le 2026-08-04, `planWeek` s'est mis à poser deux entrées par repas principal (le plat et
  son accompagnement, décision 54). `plan-stress` est passé à **3/20 configurations saines** en
  affichant « 35 créneaux au lieu de 21 » et « DOUBLON (14) » — les deux assertions étaient
  simplement périmées : il comptait `plan.entries.length` au lieu des `(date, créneau)` distincts, et
  jugeait doublon une répétition d'accompagnement AUTORISÉE par construction. **Le réflexe dangereux
  est de « réparer » le moteur pour reverdir le banc.** Avant de toucher au code : vérifier que
  l'assertion mesure encore ce qu'elle croit mesurer. Trois autres endroits portaient exactement le
  même défaut au même moment — `semaine.test.tsx` (« 28 au lieu de 14 »), le compteur « repas
  prévus » de l'écran Semaine, et le `ORDER BY` de `readPlan` qui ne départageait pas deux lignes du
  même créneau.
- ⚠️ **Une mesure sur UNE graine ne prouve rien sur ce moteur.** La décision 34 a consigné
  « 1 208 kcal minimum, ZÉRO avertissement » comme un acquis ; c'était un tirage. Six jours plus
  tard, **0 graine sur 20** y parvenait, et le chiffre avait entre-temps servi à justifier de
  masquer une alerte de sécurité (décision 45). → `npm run engine:plancher` balaie vingt graines et
  affiche la dispersion. **Le classement est reproductible à graine égale, pas déterministe d'une
  graine à l'autre** — une seule mesure ne dit rien de la propriété.

**Navigateur**

- ⚠️ **Aucun VFS OPFS de SQLite ne tourne sur le thread principal.** Les deux testent
  `createSyncAccessHandle`, `[Exposed=DedicatedWorker]` — **aucune en-tête COOP/COEP n'y change
  rien**. → base en mémoire + fichier OPFS réécrit (`user-source.ts`).
- ⚠️ **Les drapeaux ne se rendent pas sous Windows** (« FR », « IT » à la place). Normal, pas un bug.

**Moteur et données**

- ⚠️ **Le classement n'est plus « déterministe », il est « reproductible à graine égale ».** Deux
  garanties différentes : `rankScoredCandidates` sans `alea` rend toujours le même ordre, avec `alea`
  il rend le même ordre POUR LA MÊME GRAINE. Ne pas réécrire l'en-tête dans l'autre sens.
- ⚠️ **Un tirage qui ÉCHANGE au lieu de RETIRER casse son propre invariant.** L'échange renvoie
  l'élément de la position courante — de score supérieur — plus loin dans le tableau, ce qui détruit
  le tri de la queue : au tour suivant le pivot n'est plus le meilleur restant, la bande est calculée
  trop bas et un candidat HORS bande passe devant le meilleur. Le `splice` préserve l'ordre, lui.
  Le test qui prétendait verrouiller ça ne portait que sur DEUX candidats et ne pouvait rien voir.
- ⚠️ **Un champ déclaré n'est pas un champ branché — TROIS occurrences, ne pas en payer une
  quatrième.** Le filtre allergènes a tourné sur une liste VIDE jusqu'à ce que l'onboarding existe ;
  `shopping_extra_item.note_allergene` était au schéma, lue, et écrite par personne ; et
  `ShoppingOptions.pantryFoodIds` — spécifié par la décision 41 (c) — n'était **jamais transmis** par
  `courses.tsx`, si bien que le garde-manger ne retirait rien de la liste de courses (corrigé le
  2026-08-02). ⚠️ **La fiche de retour d'essai affirmait le contraire** et se trompait : « le
  garde-manger sert à retirer des articles de la liste ». **Avant de conclure qu'il ne manque que de
  l'affichage, vérifier que le champ est REMPLI et LU** — un appelant qui omet une option optionnelle
  ne produit aucune erreur, ni au type, ni au test, ni à l'écran.
- ⛔ **La variante la plus discrète : un champ rempli ET lu, qui ne contient pas ce que son nom
  dit.** `user_pantry.declare_le` était censé porter « quand l'utilisateur a répondu de cet
  aliment ». `writePantry` réécrivant la table ENTIÈRE à chaque geste et l'écran Frigo passant la
  date du jour pour toutes les lignes, il portait en réalité « quand la ligne a été écrite » —
  ajouter un aliment ce matin certifiait fraîche une déclaration de trois semaines, et la
  confirmation ne se déclenchait plus jamais. Le champ existait, était rempli, était lu, et la
  fonctionnalité qu'il portait était morte dès le deuxième aliment. **Aucun type, aucun test, aucun
  écran ne pouvait le voir** : seule la SÉMANTIQUE était fausse. → dès qu'un écrivain remplace tout
  un ensemble, se demander ce que chaque ligne conservée doit GARDER de son état d'avant.
- ⚠️ **`MealHistory.windowDays` n'est lu par AUCUNE couche.** La fenêtre de 21 jours n'existe que
  parce que `readHistory` la borne en SQL.
- ⚠️ **Une PRIMARY KEY contenant une colonne NULL ne dédoublonne pas** dans SQLite. → index UNIQUE
  sur `COALESCE(service, '')`.
- ⚠️ **`INSERT OR REPLACE` SUPPRIME la ligne avant de réinsérer**, donc déclenche les
  `ON DELETE CASCADE`. → `INSERT … ON CONFLICT DO UPDATE` dès qu'une ligne a des enfants.
- ⚠️ **Un plan relu depuis `user.db` arrive SANS ses avertissements.** Repasser par `moteur.checkPlan`.
- ⚠️ **`uniteAffichage` est un texte figé, jamais mis à l'échelle par le moteur** — et c'est voulu.
  → `ui/quantites.ts`.

**Interface**

- ⚠️ **Plus aucun menu déroulant hors de l'accueil.** Menus, filtres et réglages ouvrent une fenêtre
  (`ui/panneau.tsx`, portail vers `document.body`, bouton « ← Retour »). Un dépliant pousse vers le
  bas tout ce qui le suit ; sur la contrainte d'âge du produit, c'est le mécanisme qui fait
  abandonner. **Deux exceptions assumées** : les quatre engagements de l'accueil, et le geste
  technique dans une étape de recette — ancré à ce qu'il explique, mains dans la préparation.
- ⚠️ **Le déclencheur d'une fenêtre porte `aria-haspopup="dialog"`, jamais `aria-expanded`** :
  celui-ci décrit un contenu qui se déplie EN PLACE. Les tests lisent la **présence du dialogue**,
  pas un attribut du bouton.
- ⚠️ **`Panneau` passe par un PORTAIL** : `screen.getByText` le voit, `container.querySelector` non.
  Et un même libellé peut exister à la fois dans la fenêtre et dans l'écran dessous → cibler avec
  `within(screen.getByRole('dialog'))`.
- ⚠️ **Ne jamais afficher le score du moteur.** C'est un score de CLASSEMENT, relatif aux autres
  candidats de la même passe. Un nombre sur 100 à côté d'un nom de plat se lit comme une note
  nutritionnelle — le jugement que §6.2 interdit.

**Méthode**

- ⚠️ **Un commentaire n'est pas une garantie.** L'en-tête d'`explain.ts` affirmait qu'une couche
  « n'apparaît jamais dans un breakdown réel » ; c'est devenu faux le jour de son implémentation, et
  l'exception a traversé jusqu'à l'écran. Les tables de ce genre sont désormais **totales** — un cas
  non traité est une erreur de compilation, pas un plantage chez l'utilisateur.
- ⚠️ **Une liste recopiée ne détecte pas ce qui manque à l'original.** Les tests de gabarit
  recopiaient les libellés attendus : ils ne POUVAIENT pas voir l'entrée absente. Dériver les cas de
  la table elle-même — avec une garde contre `it.each([])`, qui ne produit aucun test et laisse la
  suite verte.
- ⚠️ **`queryByText('X')` rend `null` si le libellé réel est `← X`.** Une assertion d'absence passe
  alors POUR LA MAUVAISE RAISON. Regex obligatoire pour tout « l'élément n'est pas là ».
- ⚠️ **Un flake se diagnostique avant de se corriger.** Des échecs intermittents dans des fichiers
  différents à chaque exécution venaient de **quatre agents lançant la suite en parallèle**, pas des
  tests. Trois exécutions à vide ont tranché.
- ⚠️ **La cohérence ne dit rien de la couverture.** Le lexique avait 43 fiches, zéro référence
  cassée — et des gestes courants annotés nulle part. Un test qui vérifie une liste écrite à la main
  ne vérifie que lui-même.
- ⚠️ **Les maquettes contredisent leur propre cahier des charges.** Leur bouton principal est à
  3,95:1, sous le seuil AA, alors que le même bundle exige 7:1. Écarts mesurés en §1 DESIGN.
- ⛔ **`cleanup()` ne démonte QUE ce que testing-library a monté.** `main.tsx` appelle
  `createRoot(...).render(...)` **à l'import** ; sa racine lui est donc inconnue. Avec
  `vi.resetModules()` + `import('./main.js')` à chaque test, `main.test.tsx` et
  `main-accessibilite.test.tsx` laissaient **quatre coquilles React vivantes** en fin de fichier —
  détachées du DOM (`document.body.innerHTML` est réécrit) mais **toujours abonnées à `window`**.
  Deux symptômes, tous deux intermittents, et c'est ce qui a fait perdre du temps : un `hashchange`
  entendu par toutes les racines à la fois (le `waitFor` sur le focus attend un `<main>` que ses
  voisines lui disputent, échec dans un test qui n'a rien fait de mal), et un réveil du planificateur
  React **après** la destruction de jsdom → `ReferenceError: window is not defined`, remonté en
  « Unhandled Error » avec **1315 tests au vert et un exit code 1**. **Un compte de tests vert avec
  un exit non nul n'est pas un flake, c'est une fuite** — lire la section « Unhandled Errors », elle
  nomme le fichier d'origine. Correctif : `main.tsx` **exporte sa racine**, les deux fichiers de test
  la démontent en `afterEach` sous `act()`. ⚠️ Ne pas aller chercher la racine par
  `import('./main.js')` DANS le nettoyage : sur un test qui a échoué avant de monter, ça la monterait
  au lieu de la rendre.


- **Un identifiant d'aliment peut CONTREDIRE sa ligne Ciqual, et rien ne rougit.** `jambon_blanc`
  pointait sur 28700 « Jambon de porc à cuire ou jambon à rôtir » — un rôti CRU. `canard_magret`
  pointait sur 36201 « Canard, viande crue », du canard maigre : **× 4,9 sur les lipides**, sur une
  recette nommée `magret-canard-miel`. Sept recettes portaient de fausses valeurs. Ni le build, ni le
  type, ni les tests, ni l'écran ne pouvaient le voir : `ciqual-mapping.yaml` est écrit ET RELU à la
  main, et le nom éditorial transcrivait fidèlement… la mauvaise ligne. C'est le défaut signature du
  projet — un champ rempli mais FAUX — transposé aux **données**.
  → **`node catalog/audit-mapping.mjs` après chaque lot de contenu.** Il compare les mots de
  l'identifiant au nom Ciqual réel et rend une liste à relire (10 candidats, 2 vrais défauts au
  premier passage). ⚠️ **Il ne peut pas devenir un test** : `documents Ciqual/` est gitignoré.
  ⚠️ Le premier des deux a été trouvé **par accident**, en cherchant où poser un synonyme.

- **VÉRIFIER LA DONNÉE AVANT DE POSER UN SYNONYME — sinon on recouvre l'erreur.** « magret » ne
  rendait rien ; le réflexe était d'ajouter un synonyme. En allant voir sur quel aliment le poser, on
  a trouvé que `canard_magret` portait le mauvais code. **Corriger le mapping a réparé la recherche
  tout seul**, et un synonyme « magret » serait désormais REFUSÉ au build comme entrée morte. Le
  poser d'abord aurait donné un résultat qui avait l'air juste : le mot aurait trouvé son aliment,
  qui aurait continué de porter les valeurs d'un canard maigre.

- **Agrandir le catalogue FABRIQUE des faux amis de recherche.** `sauce tomate` rend « Maquereau
  sauce tomate » en premier — le nom contient littéralement la saisie, le rang sous-chaîne fait son
  travail. Ce faux ami est né de l'ajout de `maquereau_tomate`, pas d'un défaut de `chercherParNom`.
  Le mécanisme se reproduira à chaque lot de contenu ; ce n'est pas une raison de ne pas en faire,
  c'en est une de **relancer la mesure des saisies** (`tests/recherche-catalogue-reel.test.ts`).

- **UN NUMÉRO DE MIGRATION ÉCRIT DANS UN DOCUMENT DE PLAN N'EST PAS RÉSERVÉ.**
  `CONCEPTION_MODE_CUISINE.md` annonçait la reprise de cuisson en **v9**, plan rédigé le 2026-08-04.
  Le 2026-08-05, une autre piste a livré la v9 pour les plats préparés (décision 51), et le lot du
  mode cuisine est parti en **v10**. Deux migrations portant le même numéro, c'est la perte de
  données que `user-schema.ts` existe pour empêcher : la base rapporte une version qu'elle n'a pas
  réellement jouée, et l'écart ne se voit qu'à la première requête sur une colonne absente.
  ➡️ **Relire `USER_SCHEMA_VERSION` au moment d'écrire la migration, jamais se fier au plan.**

- **`navigator.wakeLock` N'EXISTE PAS HORS CONTEXTE SÉCURISÉ, et l'échec ne le dit pas.** Servir un
  `dist/` sur `http://192.168.x.x` pour essayer sur un téléphone — le réflexe évident — fait
  disparaître l'API. Le symptôme est « l'écran s'éteint quand même », qui se lit comme un défaut de
  l'appareil ou du navigateur, et on part chercher au mauvais endroit. Même famille que la politique
  d'autoplay : **le refus est silencieux, il n'y a pas d'erreur à attraper.** ➡️ Tout essai du mode
  cuisine sur appareil se fait **en HTTPS**.

## Contenu : la règle qui tient tout l'onglet Savoir

**Toute source est ouverte et lue AVANT écriture. Une source non vérifiée ⇒ le contenu n'est pas
écrit.** Elle vaut pour `catalog/tips/*.yaml` comme pour `catalog/evidence/*.md`, et c'est elle qui
a fait retirer trois affirmations déjà livrées (miel/tombes égyptiennes, oignon/réfrigérateur,
piment/matière grasse — voir [archive/RECAP_SESSION_6.md](../archive/RECAP_SESSION_6.md) §2).

- ⚠️ **Le build ne vérifie que la FORME** d'une source : présence et format http(s). Il ne saura
  jamais si la page dit ce que le texte prétend. **Aucun automatisme ne remplace la relecture.**
- ⚠️ **La liste blanche de domaines filtre l'HÉBERGEUR, jamais la NATURE du contenu.**
  `verifierDomaine` (`build.mjs`) ne compare que le nom d'hôte : sur un domaine autorisé, **un
  commentaire d'utilisateur passe le build exactement comme un texte éditorial**. Rencontré le
  2026-08-03 : `cuisine-libre.org/endives-roulees-au-jambon` porte la phrase « Remplacer le gruyère
  par du comté. 100 g environ, dont 75 incorporé à la béchamel » — c'est un commentaire signé
  « paddy » (2010), et l'URL est dans la liste blanche. **Aucun filtre d'URL ne peut fermer ce
  trou** : la page elle-même est une vraie page éditoriale, le commentaire est *dessus*. Le seul
  garde mécanique possible serait de rendre la citation exacte obligatoire au schéma — **écarté le
  2026-08-03** (décision utilisateur), il faudrait compléter les 41 recettes déjà sourcées. Donc
  **la seule protection est la relecture : citer un domaine autorisé n'est pas citer la source.**
- ⚠️ **Beaucoup de domaines refusent la lecture automatisée** (Britannica, Smithsonian, extensions
  universitaires, EFSA Journal via Wiley : 403/402). Connaître l'URL n'est pas l'avoir lue.
- ⚠️ **Pas de fausse symétrie.** Une étude isolée face à un consensus d'autorité fabrique le doute.
  Divergences admises : méta-analyse vs méta-analyse, autorité vs autorité, position contestée
  **accompagnée de sa critique publiée**. Pas de désaccord ⇒ la fiche l'écrit.
- ⚠️ **Les tips `nutrition_humaine` sont strictement descriptifs** : « l'EFSA considère que… »,
  jamais « il faut… ». C'est ce qui garde §6.1 intact ; le lint §6.2 attrape le reste.
- ⚠️ Le lexique banni de §6.2 est **une correspondance de sous-chaîne** après retrait des accents :
  « traitement », « traité », « retraite » et « soigneusement » déclenchent tous le refus.


## Les chantiers où l'on tourne en rond

*Ces trois blocs viennent de la section « La prochaine étape » de la fiche. Ce ne sont pas des
étapes : ce sont des impasses déjà payées, et les consignes pour ne pas les repayer.*

⛔ **L'OCR d'Escoffier sépare les mots par DEUX espaces — un `grep` naïf ment.** Le texte intégral
d'archive.org (`bnf-bpt6k65768837_djvu.txt`, 1 984 936 octets) contient `haricots  verts`, jamais
`haricots verts`. Conséquence mesurée le 2026-08-05 : `grep "haricots verts"` rend **0**,
`grep -E "haricots[[:space:]]+verts"` rend **51**. Un premier balayage a produit **cinq faux zéros**
(haricots verts, purée de pommes, chou rouge, beurre noisette, riz au lait) avant correction du
motif. **Toujours `[[:space:]]+` entre les mots** — sans quoi on classera « absent d'Escoffier » un
plat qui y est. ✅ Les zéros déjà consignés dans `SOURCES_RECETTES.md` §5 ter ont été retestés avec
le motif tolérant : ratatouille, gratin dauphinois et coq au vin sont **réellement** absents.

⭐ **Pour Anctil 1915, ne pas imiter la méthode Escoffier — Wikisource la transcrit UNE PAGE PAR
RECETTE.** On liste les **372** sous-pages en une requête (`action=query&list=allpages&apprefix=350
recettes de cuisine/`), donc on voit ce que le livre contient au lieu de le deviner : pas d'OCR, pas
de faux zéro, citation propre du premier coup. ⚠️ Deux pièges d'API payés le 2026-08-05 :
`prop=extracts` rend du **vide** (pages transcluses depuis l'espace `Page:` → utiliser
`action=parse&prop=text` et dépouiller le HTML), et Wikimedia renvoie **403 Forbidden** sans
`User-Agent` (`urllib` nu échoue, `curl -A` passe).

⛔ **Une occurrence n'est pas une formule, et « milanaise » est un faux ami.** Trois échecs du même
genre sont déjà payés : le riz pilaf (38 occurrences de « Pilaw », **toutes en renvoi**), la sole
meunière (renvoi vers une « formule initiale » jamais atteinte en 4 tentatives), et les crêpes
(**huit** variantes renvoyant à un « appareil A/B/C » jamais défini). Pire, l'**escalope à la
milanaise** : chez Escoffier « milanaise » désigne une **garniture** de macaroni et tomate, pas une
escalope panée — même mot, autre plat. Compter les occurrences ne dit rien ; il faut lire la ligne.

**Suite du chantier provenance** (par ordre d'utilité, [SOURCES_RECETTES.md](../SOURCES_RECETTES.md)
§7) : écrire à **cuisine-libre.org** — désormais pour ses **~3 800 recettes**, plus seulement les 603 CC0/DP, le
CC BY-SA ayant été accepté le 2026-08-02 ; écrire à **Santé publique France** pour les ~2 000 recettes
de mangerbouger (droits réservés — sans autorisation, inutilisables) ; **cuisiner** et renseigner
`teste_le`. ⏸️ **Les « alternatives par substitution » sont tranchées SUR LA FORME et EN PAUSE sur le
fond** (décisions 47 puis **48**) — le contenu des recettes se travaille en parallèle, écrire ici
entrerait en collision. **Rien n'a été codé, rien n'a été écrit au catalogue.** Forme retenue : table
`substitution` avec **portée par recette** (`recipeIds`, liste d'INCLUSION). ⚠️ **TROIS passes de
recherche ont rendu ZÉRO couple, pour trois raisons différentes** — la première parce qu'un index par
aliment seul **ne peut pas exprimer « sauf »** (`beurre_doux` est dans 60 recettes dont 11 desserts ;
la pâte brisée est au catalogue, pas dans un manuel), la seconde parce que **les agences publient des
compositions, pas des équivalences de cuisine**. ⚠️ **La troisième, le 2026-08-03, a épuisé les deux
pistes que la décision 48 gardait en réserve — NE PAS LES RELANCER** : `gruyere` ↔ `comte_rape` n'a
pour toute source qu'un **commentaire de lecteur** (voir « la liste blanche filtre l'hébergeur »
ci-dessus) ; les **légumineuses en conserve n'ont pas de second aliment** — le catalogue porte
**un seul id par légumineuse**, déjà figé sur une forme (haricots, pois chiches et flageolets en
`appertisé, égoutté` ; lentilles en `sèche`), et garder ce choix a été tranché le 2026-08-03. La
seule source rapportée (Bognár 2002 sur `fao.org`, rendements 2,50 / 2,73 / 2,45) mesure **sec →
cuit**, quand la piste demandait **sec → conserve égouttée** : lui faire dire l'autre fabriquerait
une provenance. ⚠️ **À la reprise, ne pas repartir sur la même consigne** : les ouvrages culinaires
SONT des sources acceptées ici (le sourçage des recettes cite Escoffier 1903), et `ratio: 1.0` n'est
pas une affirmation à sourcer. **Il ne reste aucune piste en réserve : rouvrir ce chantier demande
d'apporter un couple candidat, pas de relancer une recherche.** ⚠️ **Rien n'en sera visible
à l'écran** : `suggestAlternatives` n'est câblée à aucun bouton — remplir la table remplit le MOTEUR.

⚠️ **Ne pas relancer une recherche de sources de recettes sans lire `SOURCES_RECETTES.md` §3.5.** Le
balayage du 2026-08-02 a écarté, licence lue page par page : mangerbouger, agriculture.gouv.fr, MAPAQ,
data.gouv.fr, NHS, Heart Foundation, FAO/OMS, USDA MyPlate (**site fermé le 2026-01-07**, le « miroir »
n'est pas institutionnel), et les datasets Recipe1M+/RecipeNLG/Food.com (**scraping avéré, écrit dans
leurs propres publications**). ⚠️ **L'hypothèse « les contenus publics français sont sous Licence
Ouverte Etalab » est FAUSSE** — l'ouverture porte sur les *données*, pas sur le contenu éditorial, sur
lequel les organismes gardent leur droit d'auteur. Refaire ce tour coûte cher et ne rend rien.

⚠️ **Trois conséquences de la décision Capacitor ne sont PAS traitées** (`RECAP_SESSION_8.md` §3) :
le message `non_persistant` de `main.tsx` dit encore « Ajoutez l'application à votre écran d'accueil »
— il s'afficherait **dans une appli native** ; le pari « `rem` → l'interface suit la police système à
150 % » **n'est pas vérifié en WebView** et c'est le risque n°1 du projet ; `env(safe-area-inset-bottom)`
et la barre d'état sont à revérifier sur appareil.
