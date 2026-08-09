# Archive — instantanés datés

Ces documents ont été **écartés du dossier principal le 2026-07-28** parce qu'ils ne décrivent plus
l'état du projet. Ils ne sont **ni obsolètes ni faux** : ils sont *datés*, et vrais à leur date.

## Pourquoi les garder

La règle du projet (voir [../README.md](../README.md)) est qu'un récit ne se réécrit jamais — une
affirmation devenue fausse se corrige dans les documents de référence, pas dans le récit qui l'a
consignée. Les corriger falsifierait l'historique ; les supprimer effacerait **les raisonnements
abandonnés en route**, qui expliquent pourquoi telle piste a été écartée. Cette information ne se
reconstitue pas.

## Ce qu'il y a ici

| Document | Ce qu'il consigne |
|---|---|
| [RECAP_SESSION.md](./RECAP_SESSION.md) | Session 1 — mise sous git, P0/P1a, conception du scoring |
| [RECAP_SESSION_2.md](./RECAP_SESSION_2.md) | Session 2 — P1b-1 codé, saison en crédits, catalogue à 76 aliments, 5ᵉ couche |
| [RECAP_SESSION_3.md](./RECAP_SESSION_3.md) | Session 3 — P1b-2 et P1c : passe de score, archétypes, banc CLI, `suggestMeals` |
| [RECAP_SESSION_4.md](./RECAP_SESSION_4.md) | Session 4 — contenu à 241 recettes, planification, restes, courses, lexique à 62 gestes, première tranche de PWA. **Sa §2 « ce que la mesure a démenti » est la partie qui ne se reconstitue pas** |
| [RECAP_SESSION_5.md](./RECAP_SESSION_5.md) | Session 5 — `user.db`, système de design, **les 8 écrans**, installabilité. **§7 contient le journal des lots terminés**, repris d'`ETAT.md` |
| [RECAP_SESSION_6.md](./RECAP_SESSION_6.md) | Session 6 — le contenu de Savoir : 8 fiches « Comprendre », tips de 8 à 73, `tip.source_url` rendu obligatoire. **§2 consigne les trois tips que la vérification a démentis** et les sujets écartés faute de source lisible |
| [RECAP_SESSION_7.md](./RECAP_SESSION_7.md) | Session 7 — **piste parallèle à la session 6, même période**. Couverture de test des 9 écrans, plantage de « Aujourd'hui » sur garde-manger non vide, accueil réécrit, menus déroulants remplacés par des fenêtres. **§2 liste trois défauts trouvés et NON corrigés** ; **§3 est la partie qui ne se reconstitue pas** (pourquoi un commentaire ne garantit rien, pourquoi une copie ne détecte pas ce qui manque à l'original) |
| [RECAP_SESSION_8.md](./RECAP_SESSION_8.md) | Session 8 — **troisième piste parallèle, même période**. Revue design & accessibilité (aucun code écrit) et **deux décisions produit tranchées** : la photo de plat devient OBLIGATOIRE, et TWA → Capacitor. **§2 consigne la direction proposée puis abandonnée** (« la typographie porte l'ambiance ») et pourquoi elle est tombée ; **§3 liste ce que Capacitor invalide dans le livré** ; §6 signale `docs/test appli.txt`, entrée utilisateur NON instruite |
| [RECAP_SESSION_9.md](./RECAP_SESSION_9.md) | Session 9 (2026-08-02) — **la provenance des recettes**. Constat de départ : les 241 recettes viennent d'un modèle de langage et rien ne le disait. Table `recipe_source`, `teste_le`, 14 recettes vérifiées (10 cuissons à risque, 4 classiques contre Escoffier 1903). **§2.1 consigne un correctif proposé puis RETIRÉ avant d'être écrit** ; **§3.1 mesure ce que le domaine public culinaire ne couvre PAS** ; §3.4 distingue sourcer / vérifier / tester |
| [RECAP_SESSION_10.md](./RECAP_SESSION_10.md) | Session 10 (2026-08-02) — **piste parallèle à la 9**. Les quatre défauts du 2026-08-01 corrigés, puis **le premier essai sur un vrai téléphone** et les 14 lots qui en sortent. **§3 est la partie qui ne se reconstitue pas** : six capacités déjà présentes et jamais branchées, trois fonctions réclamées qui existaient déjà, et un tirage qui cassait son propre invariant parce qu'il échangeait au lieu de retirer. **§5 consigne mes erreurs**, dont une décision documentée contredite sans l'avoir vue |
| [RECAP_SESSION_2026-08-05_gardes_et_decisions.md](./RECAP_SESSION_2026-08-05_gardes_et_decisions.md) | Session du 2026-08-04 → 08-05 — **ce qui est affirmé sans que rien ne le vérifie**. Six cas fermés : un index qui disait « ouverte » là où le texte disait « tranchée », trois écrans qui annonçaient une recherche et comparaient des sous-chaînes, des rapports de contraste écrits en commentaire et jamais mesurés, un lexique de sécurité qui SOUS-bloquait autant qu'il sur-bloquait, et un test de non-divergence qui ne comparait que des listes. **Décisions 51 et 33 tranchées.** ⚠️ **§ « les deux erreurs » consigne un `main` poussé ROUGE** — index reconstruit à la main, quatre commandes vertes sur l'arbre — et **des tests verts qui ne testaient rien**. Écrit pendant qu'une SECONDE session travaillait dans le même dépôt |
| [RECAP_SESSION_2026-08-05_recherche-aliments.md](./RECAP_SESSION_2026-08-05_recherche-aliments.md) | Session du 2026-08-05 — **piste parallèle à la précédente, même journée** : trouver un aliment, et deux aliments qui n'étaient pas les bons. Décision 58 fermée en entier — synonymes, parcours de tout le catalogue (**352 aliments sur 450 étaient injoignables**), cause (3) close en « assumée ». Puis l'audit `catalog/audit-mapping.mjs` : **deux mappings Ciqual faux**, `canard_magret` (× 4,9 sur les lipides) et `jambon_blanc` (un rôti CRU), trouvés par accident puis systématiquement. **§2 est la partie qui ne se reconstitue pas** — cinq affirmations que la mesure a démenties, dont une cause mécanique fausse que j'avais écrite dans `ETAT.md`, et « on n'aura jamais de signal pour les synonymes » démenti par mon propre audit. **§3 porte la leçon** : vérifier la donnée AVANT de poser un synonyme, sinon on recouvre l'erreur. **§5 consigne mes erreurs**, dont un commit qui a emporté le lot d'une autre session |
| [RECAP_SESSION_2026-08-05_mode-cuisine.md](./RECAP_SESSION_2026-08-05_mode-cuisine.md) | Session du 2026-08-04 → 08-06 — **troisième piste de la même période** : le mode cuisine. La demande d'origine (« que la recette se lance toute seule ») **instruite puis refusée** — neuf modes d'échec sur douze foyers observés. Décision 8 fermée en la DÉCOUPANT (v1 mono-recette / v1.5 multi). Lots **L0** (`recipe_step.nature`, 18 recettes) et **L1** (l'écran `#/cuisine/<id>`) livrés. **§3 est la partie qui ne se reconstitue pas** : pourquoi aucune des quatre voies Android ne permet de sonner en arrière-plan — `SCHEDULE_EXACT_ALARM` n'est pas une fenêtre d'autorisation, `USE_EXACT_ALARM` est refusée **à la soumission Play**, aucun `foregroundServiceType` ne convient. **§2 liste sept affirmations que la mesure a démenties**, dont une corrigée par l'utilisateur (le principe 2 n'interdit pas la cuisine partagée) et **un résultat d'essai que j'ai refusé d'enregistrer** parce que l'instrument était en cause. **§4 consigne le protocole** qui a départagé cinq signaux visuels — de face, les cinq marchaient. ⛔ **§6 : L1 n'était PAS committé à la clôture**, et L0 a été emporté par le commit d'une autre session |
| [RECAP_SESSION_2026-08-07_photos.md](./RECAP_SESSION_2026-08-07_photos.md) | Session du 2026-08-06 → 08-07 — **le tri des photos de recettes**, dans `atelier/photos/` (gitignoré, hors `app/`). La passe propose, elle ne tranche pas. Barème d'acceptation **calibré sur quatre relectures** et non demandé ; **l'identité du plat se vérifie avant l'esthétique**. **§4 instruit pourquoi la récolte n'était pas ciblée** : `lire_csv` retombe en silence sur le slug quand la colonne de requête est vide — 254 dossiers ciblés, 159 au repli, 68 recettes jamais récoltées ; rendement mesuré **5,8 % contre 2,2 %**. **§5 est la partie qui ne se reconstitue pas** — « le repli par groupe ne l'a pas vue » **démenti par le hachage de 5 799 fichiers** (0 famille à cheval sur deux groupes), le défaut étant dans mon outil qui relisait le journal par clé ; et mon propre plan de récolte écrit **dans le bac**, qui a fait passer la réserve ciblée de 56 à 151. ⛔ **§6 consigne un `npm test` ROUGE** — 9 échecs sur 1 646 — **et l'attribution qui l'accompagne est fausse pour 2 d'entre eux** : 7 venaient bien du registre `piquant` étendu sans ses tables de garde, les 2 autres d'un lot de contenu, ce que la piste parallèle a **falsifié** le jour même. Plus le piège du `\| tail`, qui rend exit 0 sur une suite rouge |
| [RECAP_SESSION_2026-08-07_recettes-aliments.md](./RECAP_SESSION_2026-08-07_recettes-aliments.md) | Session du 2026-08-06 → 08-07 — **le contenu : recettes et aliments**. 51 recettes (241 → 297), 1 aliment (450 → 451), la garde d'origine animale au build. **§2 est la partie qui ne se reconstitue pas** — sept affirmations démenties par la mesure, dont **le chantier d'accompagnements dont le diagnostic était faux** : tripler les accompagnements végétaliens (11 → 29) n'a pas bougé le compteur d'une unité, parce que « 18 accompagnements posés » était **le nombre de PLATS compté sous un autre nom** ; et `regime-coherence.test.ts` **vert alors qu'il ne vérifiait rien**, laissant passer `nuoc_mam` pour végétalien. **§3 porte la leçon** : *un oracle qui partage la donnée du sujet qu'il vérifie ne vérifie rien* — trois formes du même défaut. **§4 consigne quatre aliments REFUSÉS** avec leur preuve (dont `morue_salee`, ×75 sur le sodium). ⛔ **§5 consigne mon erreur la plus chère** : `e3bc94c` committé après avoir vérifié **une sélection de fichiers au lieu du commit** — la branche est rouge, bissection à l'appui. **§6 instruit les 2 tests rouges** : l'écran offre 12 suggestions, l'encart en exige 11 distinctes, le test en parcourt 10 — **la marge était d'une recette** |
| [RECAP_SESSION_2026-08-09_cuisine-multi-plats.md](./RECAP_SESSION_2026-08-09_cuisine-multi-plats.md) | Session du 2026-08-09 — **le mode cuisine passe a plusieurs plats** : heure de service, frise des departs, lot L4. **Le sujet du recit nest pas la frise mais ce quelle a revele** —  **ne compte pas les repos** et etait faux sur **143 recettes sur 308**, jusqua **11 h 40** decart : « a lancer 45 min avant le service » pour une marinade de douze heures. **§2 porte le fait de methode** : le code etait coherent avec lui-meme ET avec ses tests, le defaut na ete vu quen interrogeant  — *une limite documentee nest pas une limite chiffree*,  declarait la sienne depuis toujours sans que personne nen mesure le cout. **§3 est la partie qui ne se reconstitue pas** : la relecture a trouve le trou du seuil puis la juge « inatteignable par le catalogue actuel » — **quatre recettes y etaient deja** ( 160 min en plusieurs levees,  180,  135,  130). *« Inatteignable en pratique » est une affirmation mesurable.* **§4 : deux tests REDISAIENT la formule au lieu de lappeler** et nont proteste que parce que la frise affiche le nombre en toutes lettres. ⛔ **§6 consigne un sous-agent qui a lance Saved working directory and index state WIP on main: f2c4df8 refactor(base) : supprimer les trois fonctions qui codaient `id = 1` en dur sur larbre partage** — 22 fichiers dune autre session disparus le temps dune fenetre — et **trois rouges attribues, aucun du lot** |
| [RECAP_SESSION_2026-08-09_photos-fin-du-tri.md](./RECAP_SESSION_2026-08-09_photos-fin-du-tri.md) | Session du 2026-08-08 → 08-09 — **suite directe du récit des photos du 08-07 : le bac de candidates est vidé**. Trois chiffres et pas d’autres : **88** recettes servies, **220** sans, **22** photos validées pour un plat hors catalogue. 2 740 couples jugés. **§3 mesure pourquoi les 220 n’ont rien reçu, et ce n’est pas le tri** : 201 d’entre elles ont vu **2 059 photos distinctes**, dont **94 en ont vu plus de dix sans en garder aucune** — le goulot est la récolte, non corrigée depuis. ⛔ **§5 est la partie qui ne se reconstitue pas, et elle CORRIGE une conclusion écrite le jour même** : « aucun convertisseur n’est nécessaire » avait été mesuré sur le poids des fichiers **à stocker** et non sur le budget **à expédier** — **2 photos sur 88** tiennent dans les 40 Ko de P6, et les 19,9 Mo dépassent seuls le « bundle < 15 Mo ». S’y ajoute une conséquence que personne n’avait vue : **`ASSETS_PUBLICS` de `vite-plugin-sw.ts` est une liste écrite à la main**, donc des images posées dans `public/` **ne seraient pas pré-cachées** — invisibles hors ligne. **§4 : 231 plats du bac n’existent pas au catalogue** (3 007 photos), le serveur **refuse structurellement** un `oui` dessus, et la liste penche vers le carné — les habiller laisserait la photothèque décider du contenu. ⛔ **§7 consigne un chiffre faux que j’ai annoncé** : « 556 couples jugés pour une recette déjà servie » valait **0** — la requête lisait `horodatage` là où le journal nomme le champ **`h`**, et `String(undefined)` bat toute date |
| [RECAP_SESSION_2026-08-09_quantites-portions.md](./RECAP_SESSION_2026-08-09_quantites-portions.md) | Session du 2026-08-08 → 08-09 — **une des quatre pistes de la même journée** : finir de mettre les quantités DANS la phrase des étapes. La règle qui débloque le dernier gisement vient de l'utilisateur en une phrase — **le libellé d'un ingrédient déclare en quoi il se compte** (`unite_affichage: "4 filets"` dit qu'ici l'églefin se compte en filets). Liens **2 795 → 2 809 (+17 / −3)**, gestes chiffrés **1 097 → 1 111**, chantier de réécriture **17 → 1**. **§2 est la partie qui ne se reconstitue pas** : « il manque 17 liens » était faux — **14 des 17 portaient déjà leur nombre**, c'était un mot que le code ne savait pas lire ; et **le défaut le plus cher n'était pas un lien manquant mais un NOMBRE FAUX** (« dans une tranche de jambon » rendu « dans **8 tranches** »), **avec un compte de liens qui MONTAIT**. **§3 porte la leçon** : un lot de langue se mesure ligne à ligne sur le RENDU, jamais en totaux. **§4 : trois gardes, aucun trouvé par un test** — un mot de portion est un nom, un participe passé (« le poulet tranché ») et une mesure (« un filet d'huile »). ⛔ **§6 laisse la décision 63 OUVERTE** : 14 textes rédigés par l'utilisateur, qui nomment le poisson, ne sont pas appliqués — arbitrage de contenu, pas de code |
| [FICHE_REPRISE_extraits_2026-08-07.md](./FICHE_REPRISE_extraits_2026-08-07.md) | Les blocs datés sortis de `FICHE_REPRISE.md` le 2026-08-07 (285 → 193 lignes), recopiés **verbatim**. Son en-tête dit, bloc par bloc, **où le fait durable vit maintenant** — c'est le critère de tri : pas l'âge, le **doublon**. Deuxième dégonflage après celui du 2026-08-03 |
| [AUDIT_2026-07-27.md](./AUDIT_2026-07-27.md) | Audit **extérieur** du 2026-07-27 (commit `e2625d3`, 112 recettes). Déplacé ici le 2026-07-31 : c'est un instantané daté comme les autres. **Deux constats restent vivants** — zéro photo, revue juridique |
| [RETOUR_TEST_APPLI_2026-08-01.txt](./RETOUR_TEST_APPLI_2026-08-01.txt) | **Verbatim utilisateur**, pas un récit — 21 demandes d'interface écrites pendant un essai de la session 8. S'appelait `docs/test appli.txt` et avait été **délibérément laissé hors archive** tant qu'il n'était pas instruit (8 §6). **Instruit le 2026-08-03**, déplacé ici le jour même : le dépouillement complet, demande par demande et avec sa preuve en `fichier:ligne`, est en [../RETOUR_ESSAI_TELEPHONE.md](../RETOUR_ESSAI_TELEPHONE.md) **§6** ; ce qui en est sorti comme décision est en [../ETAT.md](../ETAT.md) §4, **décisions 49 à 52**. ⚠️ Neuf des 21 demandes étaient **déjà satisfaites** quand on l'a ouvert — le fichier a dormi pendant que d'autres pistes le rattrapaient |

⚠️ **Le 2026-08-08 → 08-09 a porté QUATRE pistes parallèles** : le tri des photos, le lot
« sauces », la cuisine à plusieurs plats, et les quantités dans les étapes. **Aucune ne raconte le
travail des autres**, et elles se tiennent : le point ③ des sauces, budgété en changement de
schéma `user.db`, **a coûté un bouton parce que la piste « plusieurs plats » avait livré la v13
entre-temps**, sans que personne l'ait demandé.
⛔ **C'est aussi la journée où le partage d'arbre a le plus coûté.** Un rouge de `parcours.test.tsx`
a été vu par la piste « quantités » alors qu'il appartenait à une autre ; une session avait des
fichiers **indexés** qui n'étaient pas les siens ; et un **`git stash` a vidé l'arbre entier**,
emportant le lot d'une piste qui n'avait rien demandé — récupéré par `git checkout stash@{0} -- <chemins>`,
sans jamais dépiler la remise. **Un rouge s'attribue avant d'être réparé ; une remise ne se dépile
pas quand elle contient le travail de deux sessions.**

⚠️ **Le 2026-08-06 → 08-07 a porté TROIS pistes parallèles**, et deux d'entre elles ont un récit ici :
`RECAP_SESSION_2026-08-07_photos.md` (le tri des photos) et
`RECAP_SESSION_2026-08-07_recettes-aliments.md` (le contenu : 51 recettes, 1 aliment, la garde
d'origine animale). **La troisième n'est pas encore consignée** — c'est elle qui a écrit la couche de
score `piquant`, l'écran `aliment`, `gestes-etape.tsx` et L1ter.
⭐ **Ces trois-là s'expliquent mutuellement, et c'est la meilleure illustration de la règle « lire
les trois ».** Les 9 tests rouges de la §6 du récit des photos y sont attribués au registre
`piquant` : **7 le sont, les 2 autres NON**. Le récit `recettes-aliments` §6 les bissecte jusqu'à son
propre commit de contenu `e3bc94c`, et la troisième piste l'a **falsifié le jour même** en retirant
la couche `piquant` — les 2 tests restent rouges à l'identique. **Aucun des trois récits, seul, ne
donne la bonne réponse.**

⚠️ **Le 2026-08-05 a lui aussi porté TROIS pistes parallèles**, dans trois conversations séparées :
`gardes_et_decisions` (ce qui est affirmé sans que rien ne le vérifie), `recherche-aliments`
(trouver un aliment, et deux mappings Ciqual faux) et `mode-cuisine` (L0 et L1). Même règle que pour
les sessions 6-7-8 : aucune ne raconte le travail des autres, **il faut lire les trois**. Les deux
premières se recoupent sur les décisions 51 et 58 ; la troisième ne recoupe rien, sauf **les dégâts
du travail à deux dans un même dépôt**, consignés des deux côtés.

⚠️ **Les sessions 6, 7 et 8 couvrent la MÊME période sur trois pistes menées en parallèle**, dans
trois conversations séparées. Aucune ne raconte le travail des autres, et c'est délibéré : un récit
qui invente le raisonnement d'autrui vaut moins que le diff. Pour la période 2026-07-31 →
2026-08-01, **il faut lire les trois** — la 6 pour le contenu de Savoir, la 7 pour les tests d'écran
et les correctifs d'usage, la 8 pour les décisions de design et leurs conséquences.

⚠️ **Là où deux récits se recoupent, le plus détaillé fait foi.** Le score `/100` retiré est analysé
en 7 §3.6 (score *relatif à la passe*) et seulement mentionné en 8 §1 ; l'installation de Capacitor
est en 7, ses conséquences de conception en 8 §3.

## ⚠️ Ne pas s'en servir pour établir l'état courant

Ils contiennent **par construction** des chiffres et des décisions périmés : comptes de tests,
taille du catalogue, décisions depuis tranchées, blocages depuis levés. L'état courant est dans
[../FICHE_REPRISE.md](../FICHE_REPRISE.md) (30 secondes) et [../ETAT.md](../ETAT.md) (complet).

## Le cas de l'audit : archivé, mais ses constats sont vivants

`AUDIT_2026-07-27.md` a longtemps été gardé hors de ce dossier pour ne pas enterrer des points
ouverts. Il y a été déplacé le **2026-07-31** : sa place est ici comme instantané daté, à condition
que ses constats survivants soient suivis ailleurs. Ils le sont, dans [../ETAT.md](../ETAT.md) §9.

Ses chiffres sont dépassés (il mesurait 112 recettes, il y en a 241), et **deux de ses quatre
constats de contenu ont été traités depuis** — le lexique (4 → 62 gestes) et les trous de couverture
par créneau. **Deux restent vivants et non traités au 2026-08-01** : **zéro photo sur 241 recettes**
et la **revue juridique avant publication**, à quoi s'ajoute le constat de méthode (périmètre v1
large pour une personne seule).

⚠️ Le document lui-même n'est PAS corrigé — c'est un instantané daté, comme tous ceux de ce dossier.
