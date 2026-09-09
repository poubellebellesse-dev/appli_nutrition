# Décisions figées — Média, stockage & modèle

> Sorti intégralement de `ETAT.md` §3 le 2026-09-08 (cure, P-14). Texte non réécrit. Ne pas rediscuter sans raison.
> Index : [README.md](./README.md) · questions numérotées : [registre.md](./registre.md).

## Média, stockage & modèle
- **Gestes de cuisine** : boucle WebP 3 s pour les gestes simples ; **3 clips MP4 de 3 s**
  (avant/pendant/après) + clip « quand ça rate » pour les gestes à risque ; galeries d'états
  (cuisson, caramel) en photos.
  ✅ **AMENDÉ LE 2026-08-10, DÉCISION UTILISATEUR — UNE PHOTO FIXE *ET* UN CLIP, PAS L'UN OU
  L'AUTRE.** La photo retenue devient l'**image d'appel** (poster affiché avant lecture, et seule
  image si le clip n'est pas chargé) ; le clip se déclenche au clic. La ligne ci-dessus ne parlait
  que de clips, et une passe de tri avait entre-temps produit 62 photos fixes : le désaccord est
  tranché en gardant les deux, chacun dans son rôle. ⚠️ **CE QUI MOTIVE LE COUPLAGE N'EST PAS
  L'ESTHÉTIQUE, C'EST LE BUDGET** : le poster est léger et pré-caché, le clip est un média lourd à
  la demande au sens du « cache à deux étages » ci-dessous. Un geste sans clip chargé reste donc
  illustré, hors ligne, sans requête.
  ⚠️ **CE QU'UNE IMAGE FIXE NE PEUT PAS DIRE, ET C'EST MESURÉ, PAS SUPPOSÉ.** Plusieurs gestes du
  lexique se définissent l'un CONTRE l'autre par une évolution dans le temps — `suer` est
  « rendre son eau **sans colorer** », c'est-à-dire `revenir` moins la coloration. Sur les
  24 candidates photo de `suer`, **aucune** n'était utilisable ; sur 4 clips regardés en quatre
  images étalées sur leur durée, la coloration se lit d'un coup d'œil et deux candidats se
  départagent. Même famille de couples : `revenir`/`sauter`/`poeler`, `mijoter`/`braiser`.
  ⚠️ **RIEN N'EST ENCORE PESÉ CÔTÉ CLIP.** Récolté le 2026-08-10 : **496 candidats sur 62/62 gestes,
  29 Mo de vignettes d'aperçu, ZÉRO vidéo téléchargée** (`atelier/gestes/moissonner-video.mjs`, qui
  ne tire que les images `video_pictures` publiées par l'API).
  ✅ **L'ESTIMATION DE POIDS EST REMPLACÉE PAR UNE MESURE (2026-08-10).** `ffmpeg` 9.0 est installé
  (winget `Gyan.FFmpeg`, sur ordre explicite de l'utilisateur ; libsvtav1 / libvpx-vp9 / libx264 /
  libwebp\_anim présents). Deux clips Pexels réellement encodés, 3 s, 480 px de large, 24 i/s, muets :
  | clip | AV1 (svt, crf 40) | H.264 (crf 28) | VP9 (crf 40) | WebP animé 12 i/s |
  |---|---|---|---|---|
  | `monter_blancs` pexels\_01 — **peu de mouvement** | **44,5 Ko** | 48,0 Ko | 45,3 Ko | 275,5 Ko |
  | `sauter` pexels\_05 — **fort mouvement** (riz projeté) | **100,2 Ko** | 119,0 Ko | — | — |
  Poster JPEG 720 px extrait du clip : **32–33 Ko** dans les deux cas. **L'estimation « ~400 Ko en
  H.264 » était fausse d'un facteur 4 à 8** — un clip court, muet et en 480 p pèse beaucoup moins
  que ce qui avait été avancé en discussion.
  ⛔ **LA PROJECTION QUI TENAIT ICI — « 62 gestes = 2,8 à 6,2 Mo d'AV1 + 2,0 Mo de posters » — EST
  REMPLACÉE PAR LE LOT RÉEL, ENCODÉ LE 2026-08-11. Elle était basse d'un facteur 3 à 4.**
  `atelier/gestes/encoder-clips.mjs`, 98 segments sur 51 gestes, sortie vérifiée à la sonde
  (480×480, 24 i/s, 72 images = 3,000 s, un seul flux, aucun son) :
  | | poids | l'unité |
  |---|---|---|
  | AV1 (svt, crf 40) | **8,17 Mo** | 85,4 Ko |
  | H.264 (x264, crf 28) | **10,81 Mo** | 113,0 Ko |
  | posters JPEG 720² | **3,45 Mo** | 36,0 Ko |
  | **AV1 + posters** | **11,62 Mo** | |
  | **les deux formats + posters** | **22,43 Mo** | |
  ⚠️ **TROIS FACTEURS SE MULTIPLIENT, ET AUCUN N'EST UNE DÉRIVE DE RÉGLAGE** — le CRF n'a pas bougé.
  (a) la vignette est **carrée**, décidée après le relevé de 2026-08-10 : ×2,0 sur le clip calme,
  ×1,5 à 1,7 sur le clip agité ; (b) **98 segments, pas 62 clips** — la découpe début/milieu/fin
  multiplie, 21 gestes seulement ont pris `unique` ; (c) **deux formats**, et ce choix-là n'est
  toujours pas tranché : le repli H.264 coûte **+32 %** par rapport à l'AV1 et livrer les deux
  **double** la facture.
  ⚠️ **Le mouvement fixe toujours le poids, mais l'écart s'est resserré de 2,3× à 1,7×** en carré
  (`monter_blancs` 88,9 Ko contre `sauter` 153,0 en AV1). Le rapport ne se recopie pas d'un format
  de cadre à l'autre.
  ⛔ **LEVIER MORT, ET IL NE FAUT PLUS L'ANNONCER COMME DISPONIBLE** : « un poster par GESTE au lieu
  d'un par segment, 3,45 Mo → ~1,8 Mo » a été **fermé le 2026-08-14 par le choix d'interface**
  (ci-dessous). La mise en page retenue affiche une **bande de vignettes, une par moment** : deux
  vignettes identiques dans une bande dont le seul rôle est de les distinguer ne servent à rien.
  **Les 98 posters restent, 3,45 Mo.** La vignette de la ligne repliée réutilise le poster du
  premier segment et n'ajoute aucun fichier. ⚠️ Ce levier est cité ailleurs dans ce document et dans
  `CONCEPTION_GESTES_ILLUSTRES.md` — **il y est barré aussi**. S'il réapparaît quelque part comme
  « non tiré », c'est une recopie d'avant le 08-14.
  ⛔ **CE LOT REND L'ARBITRAGE DE LA DÉCISION 68 NON REPORTABLE.** À couverture photo complète
  `dist/` est projeté à ~16 Mo pour un critère P6 de 15 Mo ; l'option la plus légère ici (AV1 seul
  + posters, 11,62 Mo) porte le total à ~27,6 Mo. **Aucun réglage de CRF ne referme cet écart** —
  il se joue sur le format livré, sur le nombre de segments, ou sur le critère P6 lui-même.
  ⚠️ **AV1 ne peut pas être le seul format livré** : Safari ne le décode que sur matériel récent.
  Le format de repli est H.264, soit +20 % environ.
  ✅ **TRANCHÉ LE 2026-08-14, DÉCISION UTILISATEUR — LES DEUX FORMATS, deux `<source>` dans la
  balise `<video>`**, AV1 d'abord, repli H.264. **Coût retenu en connaissance de cause : 22,43 Mo**
  (18,98 de vidéo + 3,45 de posters). ⚠️ **L'option écartée n'était pas « AV1 seul » mais
  « H.264 seul »** : universelle elle aussi, et à **14,26 Mo**. **Les 8,2 Mo d'écart achètent
  ~2,6 Mo de bande passante en moins, sur les appareils récents uniquement.** Le choix a été fait
  en voyant ce chiffre. ⛔ **Ce qui interdisait AV1 seul reste la raison du repli** : sans lui, un
  iPhone un peu ancien n'affiche que l'image fixe — **sans que l'utilisateur sache qu'il manque
  quelque chose**. ⚠️ **Conséquence d'import** : **deux fichiers par segment**, donc **196 fichiers
  vidéo + 98 posters**, pas 98 + 98.
  ✅ **TRANCHÉ LE MÊME JOUR — LES BINAIRES VIDÉO SONT VERSIONNÉS, comme les photos**, dans
  `app/public/catalog/gestes/`. ⛔ **IRRÉVERSIBLE : +22,43 Mo dans l'historique git, définitivement.**
  Un `git clone` les téléchargera **même après une suppression ultérieure**. ⚠️ **Les deux options
  écartées le sont pour de bonnes raisons, à ne pas rouvrir sans fait nouveau** : **git LFS** impose
  un outil sur chaque poste et casse les worktrees existants ; **ne pas versionner** ferait produire,
  sur toute autre machine, **un catalogue sans clips sans lever la moindre erreur** — le bac source
  `F:\Claude\Dessinateur\gestes` n'existe que sur une machine. C'est exactement la famille d'échec
  silencieux déjà payée trois fois ici. ▶ **Plan de montée, lots et « Fini quand » :
  `CONCEPTION_GESTES_ILLUSTRES.md`.**
  ✅ **TRANCHÉ LE MÊME JOUR, TROISIÈME DÉCISION — COMMENT UN GESTE S'AFFICHE.** Quatre mises en page
  ont été **maquettées avec les clips réels**, pas décrites :
  [maquettes](https://claude.ai/code/artifact/f2cf92ae-eb53-47a3-a6fc-3e4623986277). Retenu :
  **un cadre unique + une bande des moments sous lui (variante D), ET la vignette du geste dans la
  ligne repliée (variante C).** Trois conséquences, toutes déjà portées :
  **(1)** le levier des posters est mort, ci-dessus ; **(2)** le schéma du lexique gagne une colonne
  **`moment`** — la bande nomme ce qu'elle montre, et numéroter 1-2-3 ne suffit pas puisque
  **`deglacer` ne porte que `milieu` et `fin`** et afficherait « 1 » devant un milieu (les noms
  existent déjà dans les fichiers encodés : **29 `debut`, 23 `milieu`, 25 `fin`, 21 `unique`**) ;
  **(3)** ⚠️ **les 11 gestes sans clip auront un carré vide dans la liste, en permanence** — coût
  nommé au moment du choix et **accepté**. ⛔ **Ce n'est pas une dette : c'est un prix payé les yeux
  ouverts. Ne pas le rouvrir sans fait nouveau.**
  ⚠️ **Un témoin que ce choix rend obligatoire et qu'aucun test ne rendra** : la vignette dans la
  ligne fait passer l'écran Savoir de **1 image à 62** au premier affichage. **Ni jsdom ni un
  navigateur de bureau ne mesurent ça** — il se relève sur un vrai téléphone, au même moment que le
  chrono de `#/recettes` qui manque déjà pour fermer la **décision 61**.
  ⚠️ **WebP animé est écarté par la mesure** : 275 Ko pour le clip le PLUS LÉGER, soit 6× l'AV1,
  pour 12 i/s au lieu de 24. Il n'a d'intérêt que là où une balise vidéo est impossible.
  ⚠️ Vérifié à l'œil sur une image extraite de l'encodage AV1 du clip à fort mouvement : le geste
  reste lisible à ce réglage. **Un CRF ne se choisit pas sur un tableau de poids seul.**
  ✅ **LE POINT D'ACCROCHE EXISTE ET PORTE, DEPUIS LE 2026-08-16** — cette ligne disait « le lexique
  n'a toujours AUCUN champ pour porter un média », et c'est faux depuis les lots 1 et 3. Livré :
  table **`lexicon_clip`** fille de `lexicon_entry` (`poster_path`, `av1_path`, `h264_path`,
  `moment`, `ordre`, **PK composite**, FK), type **`LexiconClip`** dans `engine/domain/catalog.ts`,
  mapping groupé dans `catalog-loader.ts`, et l'écran Savoir qui l'affiche (`e259bcb`, `de2ba39`).
  ⛔ **UNE TABLE FILLE, PAS DES COLONNES PLATES** : un geste porte 1 à 3 segments, trois colonnes
  auraient écrasé le deuxième en silence.
  ⛔ **`moment` EST UNE DONNÉE, PAS UN DÉRIVÉ DU RANG** — `CHECK` SQL et union littérale côté type.
  ✅ **LE HORS-LIGNE EST FERMÉ DEPUIS LE 2026-08-16 (lot geste 4)** — les posters entrent dans le pré-cache
  et dans la version du cache, les clips **seulement dans la version**, et un clip consulté une fois
  est conservé. Avant ce lot, `catalog/gestes` apparaissait **ZÉRO fois** dans `dist/sw.js` : les
  18 fichiers étaient copiés dans `dist/` sans être pré-cachés, donc **les vignettes du lexique
  étaient cassées hors ligne** — trou ouvert par le lot geste 3, invisible en ligne.
  ⛔ **DEUX CACHES, ET LE SECOND NE PORTE PAS DE VERSION.** `nutrition-<empreinte>` est purgé à
  chaque activation, comme avant ; `nutrition-clips` en est **explicitement exempté**. Un clip a été
  téléchargé parce que quelqu'un l'a REGARDÉ : le purger à la mise à jour suivante ferait payer deux
  fois la même vidéo, et « puis conservé » (§7.1 ARCHITECTURE) ne conserverait rien. ⚠️ Un nom
  versionné (`nutrition-clips-<version>`) aurait le même défaut d'un cran plus loin — il change à
  chaque build et le worker suivant le purgerait comme un inconnu. **Verrouillé par test.**
  ⛔ **LE CONTENU DES CLIPS ENTRE DANS LA VERSION DU CACHE, PAS LEUR NOM.** Un `.mp4` a un nom fixe :
  sans cela un clip ré-encodé n'atteindrait jamais quelqu'un ayant installé l'application. C'est le
  défaut du 2026-07-30 sur `catalog.db`, à l'identique. **L'empreinte est un sha-256 des octets** —
  ni la taille, ni la date : les deux ont été essayées comme triches et sont refusées par test.
  ✅ **TRANCHÉ LE 2026-08-16, DÉCISION UTILISATEUR — L'IMPORT S'ARRÊTE À TROIS GESTES**, pas 51 :
  `deglacer`, `emincer`, `reduire`, soit **6 segments, 18 fichiers, 2,1 Mo** (`803fc42`). Motif :
  D4 est irréversible, et **22,43 Mo gravés dans l'historique git ne se dégravent pas**. L'échantillon
  prouve la chaîne de bout en bout sans engager le lot complet. ⇒ **Le lot geste 2 reste OUVERT** et son
  « Fini quand » (51/62) n'est pas atteint ; le rouvrir est une décision, pas une suite.
  ⛔ **ET `suer` N'EST PAS DEDANS — c'est le geste qui justifiait le chantier** (« suer » contre
  « revenir »), 24 candidates photo et **zéro segment encodé**. La démonstration reste non montrable.
  ✅ **TRANCHÉ LE MÊME JOUR — LE SCEAU DE `gestes-champ-media.test.ts` EST LEVÉ, CONFIRMÉ.** Deux
  assertions retirées, toutes deux sur le **contenu du catalogue** et non sur le sujet du lot : « les
  62 fiches portent `clips` **et il est vide** » et « les 60 autres gestes ont **zéro** clip ». Le
  « Fini quand » disait « vide **tant que le lot geste 2 n'a pas tourné** » ; le test ne portait pas la
  condition et rendait le lot geste 1 **structurellement incompatible avec l'existence d'un import**.
  Gardé : chaque fiche porte un **tableau** jamais `null`, et aucun geste n'hérite des **témoins
  plantés** — détection intacte, et désormais **indépendante de ce que le catalogue contient**.
  ✅ **L'ÉCART « 99 DÉCIDÉS / 98 ENCODÉS » EST EXPLIQUÉ** (mesuré par l'import) : ce n'est pas un
  segment jamais produit, c'est un **2→1 sur `emincer`**, ré-encodé en un seul segment sans que la
  décision soit reprise. ⇒ **Le fichier de décisions n'est pas un index de ce qui existe.**
- **Recettes** : 1 photo hero par recette ; **vidéo 2-3 s seulement sur les recettes du jour**.
- **Cache à deux étages (option B)** : socle léger pré-caché (shell + `catalog.db` + boucles +
  photos d'ustensiles), médias lourds à la demande + bouton « tout télécharger ». **Aucun média
  en blob dans le `.db`.**
  ⚠️ **AMENDÉ par la décision Capacitor (2026-08-01, §4 décision 9).** Ce modèle suppose un service
  worker et un réseau ; en Capacitor les assets sont **dans le binaire**. La contrainte ne disparaît
  pas, elle **change de nature** — et le budget « bundle < 15 Mo » du critère P6 était un budget de
  **premier chargement web**, pas une limite d'APK (plafond AAB 150 Mo). Estimation à vérifier avant
  de produire les photos : 241 × (hero ~120 Ko + vignette ~32 Ko) ≈ **36 Mo**, soit hors budget web
  et confortable en binaire. **À trancher avant la prise de vue** — `archive/RECAP_SESSION_8.md` §2.
  ✅ **L'ESTIMATION DE 36 Mo EST CADUQUE — REMPLACÉE PAR UNE MESURE le 2026-08-09.** Une hero AVIF
  pèse **33 Ko de médiane**, pas 120. Il n'y a **pas de vignette** — la même image sert partout,
  redimensionnée par le navigateur.
  ⛔ **RE-MESURÉ SUR `dist/` LE 2026-08-10, À 116 PHOTOS, ET LE BUDGET NE TIENT PLUS À TERME.**
  Décomposition en octets réels : `dist/` = **8,07 Mo**, dont **4,32 Mo de photos** et **3,75 Mo de
  reste**. À 37,2 Ko la photo, couvrir les **330 recettes** donne **12,3 Mo de photos ⇒ ~16,0 Mo de
  bundle** — **au-dessus des 15 Mo du critère P6**, et non 0,6 Mo en dessous comme l'annonçait la
  ligne précédente. ⚠️ **Ce n'est pas une dérive du lot, c'est l'ancienne extrapolation qui était
  fausse** : elle additionnait un `dist/` de 6,61 Mo qui contenait déjà ses 88 photos avec une
  projection de photos, donc les comptait deux fois — et retombait sous le seuil par compensation
  d'erreurs. ⚠️ **L'écart se creusera avec la couverture, pas avec les décisions d'à-côté** : à
  129/330 il reste 201 photos à produire, soit **~7,5 Mo de plus**. Une deuxième police ou un clip de
  geste ne sont plus la variable qui décide. **Le budget devient une décision à trancher — parquée
  en §4** ; d'ici là, la mesure se reprend à chaque lot de photos et **elle se prend sur `dist/`,
  jamais sur le bac.**
  ⚠️ **AU 2026-08-13, `dist/` N'A PAS ÉTÉ REMESURÉ APRÈS LE PASSAGE À 129 PHOTOS.** Le seul chiffre
  relevé ce jour-là est le dossier source `app/public/catalog/images/` : **4,12 → 4,9 Mo**. Ce n'est
  PAS `dist/` et ça ne s'y substitue pas — **la règle « la mesure se prend sur `dist/` » vaut aussi
  pour ce lot-ci.** Le prochain qui touche aux photos remesure `dist/` avant de citer 8,07 Mo.
- ✅ **ENCODEUR : `sharp` (devDependency), AVIF 1024 px, `quality: 45`, `effort: 6`** — décidé avec
  l'utilisateur le 2026-08-09, **sur mesure et non au jugé**. Les sources brutes font 25,9 Mo pour
  116 photos (médiane 185 Ko, max 1 713 Ko, **2 seulement sous 40 Ko**) : le ré-encodage n'est pas une
  optimisation, c'est ce qui rend le lot expédiable. ⚠️ **LE CHOIX AVIF/WebP NE SE COMPARE PAS À
  `quality` ÉGALE** — les échelles nominales des deux formats ne veulent pas dire la même chose. La
  comparaison a été refaite **à PSNR égal** contre la source redimensionnée, sur 22 photos : AVIF y
  rend **25 à 33 % de moins** que WebP. C'est ce qui a tranché, pas le nombre écrit dans l'appel.
  ⚠️ **CETTE DÉCISION VA CONTRE L'EN-TÊTE DE `catalog/build-icons.mjs`**, qui interdit `sharp` pour
  ne pas faire entrer de chaîne de compilation native. Tenue quand même : l'objection visait un
  script qui dessine deux cercles, `sharp` 0.35.3 livre des **binaires précompilés win32-x64**, et
  **la garantie de fond reste intacte — les artefacts sont commités, `npm run build` et `vite build`
  n'appellent JAMAIS `sharp`.** C'est un outil d'atelier à un coup, pas une dépendance de build ;
  `npm audit --omit=dev` rend 0 vulnérabilité. **Si un jour un build appelle `sharp`, cette phrase
  est le signal que quelque chose a dérivé.**
- ⛔ **98 DES 129 PHOTOS SONT SOUS CC BY OU CC BY-SA : L'ATTRIBUTION EST UNE OBLIGATION LÉGALE, PAS
  UNE POLITESSE.** Le bloc généré de `catalog/CREDITS.md` (entre les marqueurs `DÉBUT PHOTOS` /
  `FIN PHOTOS`, réécrit par `catalog/import-photos.mjs`) est le seul endroit où elle vit aujourd'hui.
  ⚠️ **Elle doit suivre l'image PARTOUT où l'image est rediffusée** — donc si le `.nutri-recipe` de
  §3 « Communauté » se met à embarquer la photo, il doit embarquer l'attribution avec, et la
  carte-image Canvas pour les réseaux aussi. **Non fait, parce que rien n'embarque encore de photo.**
  **Décompte relevé sur `CREDITS.md` le 2026-08-13, aux 129** : 67 CC BY · 31 CC BY-SA · 5 CC0 ·
  **16 Pexels** · **10 Pixabay Content License**. ⚠️ **Ces 26 dernières tombent sous la clause
  « Standalone use » — la MÊME ambiguïté que la décision 69**, qui n'avait été posée que pour les
  clips de gestes. **Elle concerne donc aussi des photos déjà embarquées.**
- ✅ **LE RECADRAGE CARRÉ EST HONORÉ QUAND IL EST POSÉ, ET JAMAIS APPLIQUÉ D'OFFICE** — tranché avec
  l'utilisateur le 2026-08-13, livré en `f3d4fa1`. Un recadrage centré automatique sur les 128 photos
  sans cadre couperait l'assiette **sans qu'un œil l'ait vu**, et le passage au carré s'est mesuré à
  **×1,5 à ×2,0** sur les clips de gestes — donc il pousserait aussi le poids contre un critère P6
  déjà dépassé (décision 68). **Une photo sans cadre garde le ratio de sa source.** ⚠️ **Conséquence
  assumée : l'application affiche des photos de formes différentes** ; c'est `object-cover` qui
  ajuste au cadre de l'écran, pas le fichier.
- ✅ **UNE RECETTE SANS PHOTO N'EST PAS UN TROU : c'est un aplat de couleur + son initiale**
  (`ui/vignette.ts`), tranché en même temps. Le repli couvre les **201** recettes sans photo et ne
  disparaîtra pas avec la couverture — il cesse seulement d'être le cas unique. ⚠️ **Jugé sur une
  carte, PAS en pleine page** : la fiche détail n'a pas encore été essayée avec.
- **Modèle : 100 % gratuit, sans pub.** Un simple lien « à propos » vers site perso / réseaux.
