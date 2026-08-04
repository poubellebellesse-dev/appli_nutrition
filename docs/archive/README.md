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
| [AUDIT_2026-07-27.md](./AUDIT_2026-07-27.md) | Audit **extérieur** du 2026-07-27 (commit `e2625d3`, 112 recettes). Déplacé ici le 2026-07-31 : c'est un instantané daté comme les autres. **Deux constats restent vivants** — zéro photo, revue juridique |
| [RETOUR_TEST_APPLI_2026-08-01.txt](./RETOUR_TEST_APPLI_2026-08-01.txt) | **Verbatim utilisateur**, pas un récit — 21 demandes d'interface écrites pendant un essai de la session 8. S'appelait `docs/test appli.txt` et avait été **délibérément laissé hors archive** tant qu'il n'était pas instruit (8 §6). **Instruit le 2026-08-03**, déplacé ici le jour même : le dépouillement complet, demande par demande et avec sa preuve en `fichier:ligne`, est en [../RETOUR_ESSAI_TELEPHONE.md](../RETOUR_ESSAI_TELEPHONE.md) **§6** ; ce qui en est sorti comme décision est en [../ETAT.md](../ETAT.md) §4, **décisions 49 à 52**. ⚠️ Neuf des 21 demandes étaient **déjà satisfaites** quand on l'a ouvert — le fichier a dormi pendant que d'autres pistes le rattrapaient |

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
