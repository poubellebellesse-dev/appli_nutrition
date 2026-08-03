# Récit — session 8 (2026-08-01), revue design & accessibilité — troisième piste parallèle

> **Instantané daté. Ne jamais réécrire** (voir [README.md](./README.md)). Les chiffres ci-dessous
> étaient vrais le 2026-08-01 ; l'état courant est dans [../FICHE_REPRISE.md](../FICHE_REPRISE.md)
> et [../ETAT.md](../ETAT.md).

**Sujet : une revue extérieure du système visuel et de l'accessibilité, et deux décisions produit
tranchées par l'utilisateur.**

> ⚠️ **Troisième piste menée en parallèle sur la même période**, après
> [RECAP_SESSION_6.md](./RECAP_SESSION_6.md) (contenu de Savoir) et
> [RECAP_SESSION_7.md](./RECAP_SESSION_7.md) (couverture de test, accueil, fenêtres). Aucun des trois
> ne décrit le travail des autres. **Cette session n'a écrit aucun code** — uniquement de la revue,
> des décisions et de la documentation.
>
> ⚠️ **Le dépôt a bougé PENDANT la revue.** Deux écrans (Paramètres, Éditeur de recette), les tests
> d'écran et l'installation de Capacitor sont apparus entre le début et la fin de la relecture. Les
> chiffres ci-dessous ont été **remesurés à la clôture** ; ceux cités en cours d'échange sont plus bas
> et périmés. C'est la limite d'une revue menée en parallèle d'une piste de code.

---

## 1. Ce que la revue a mesuré

Périmètre lu : `docs/{DESIGN,ETAT,README}.md`, `Notes/Note designe.txt`, `app/src/ui/**`, les
maquettes extraites de `maquete claude design/…handoff.zip`, `package.json`, `vitest.config.ts`.
⚠️ **L'application rendue n'a pas été vue** — la seule capture du dépôt montre un écran d'erreur OPFS
du 2026-07-30. Les constats portent sur le code et les specs, pas sur un rendu.

| Constat | Mesure (2026-08-01, 10 écrans) |
|---|---|
| **Aucune échelle typographique** | **29 tailles distinctes** en valeurs arbitraires (`1.02` / `1.05` / `1.08` / `1.12rem`…) |
| **Aucun rythme vertical** | **9 valeurs `mt-` distinctes**, sans règle disant laquelle signifie quoi |
| Texte courant sous le défaut navigateur | `0.95rem` = 15,2 px, sur une appli dont la contrainte centrale est « toutes les tranches d'âge » |
| Rayon hors système | `rounded-[0.7rem]` coexiste avec `--radius-carte` (0,875rem) |
| `prefers-reduced-motion` | **0 occurrence** dans tout le projet |
| Focus au changement de route | **Absent** — `<main>` sans `tabIndex` (`main.tsx`) |
| Photos | **0 sur 241 recettes** (constat vivant depuis l'audit du 2026-07-27) |

⚠️ **La cause racine n'est pas l'intégration.** `theme.css` fixe des jetons pour la couleur, les
familles, la cible tactile et le rayon — **rien pour le texte**. Et les maquettes elles-mêmes portent
20+ tailles ad hoc. Le code a suivi une spec incomplète : le correctif appartient à `theme.css` +
`DESIGN.md`, pas aux écrans un par un. C'est le même schéma qu'au §3.1 de la session 7 — ce qui n'est
pas exprimé dans une structure vérifiable dérive sans que rien ne le signale.

**Ce qui a été trouvé bon, et ne doit pas être défait** : contrastes recalculés contre les maquettes
avec écarts mesurés et documentés (`theme.css` en-tête) · mode sombre par substitution de jetons
plutôt que variantes `dark:` · `rem` partout · libellé jamais retiré sous l'icône · `lang="fr"` ·
`min-h-tactile` 3rem · `:focus-visible` 3px · `<main>` + `<nav aria-label>` · `role="alert"` sur les
états d'erreur · **aucun faux bouton** · tous les champs enveloppés dans un `<label>`.

> Le score `/100` affiché sur un plat était le constat le plus grave de la revue. Il a été retiré par
> la piste parallèle avant que la revue soit rendue — voir [RECAP_SESSION_7.md](./RECAP_SESSION_7.md)
> §3.6, dont l'analyse est plus complète (le score est **relatif à la passe**).

---

## 2. Décision A — **la photo de plat est OBLIGATOIRE**

Tranchée par l'utilisateur, **contre la direction que la revue proposait**. L'utilisateur produit les
photos.

### Le raisonnement abandonné, et pourquoi il l'a été

La revue proposait l'inverse : *« la typographie porte l'ambiance, la photo est un bonus, jamais un
prérequis »*, avec cinq teintes de famille iso-valeur pour donner de la variété au catalogue sans
image. Motif : la direction « la photographie culinaire porte l'ambiance » (bloc commun des
maquettes) **n'a jamais été tenue nulle part** — le hero des maquettes est une hachure grise portant
« photo · déjeuner » (`Aujourd'hui.dc.html` l. 62-63), et le catalogue a 0 photo. Une direction dont
l'élément dominant est un `repeating-linear-gradient` est un report de décision, pas une direction.

**Ce raisonnement tombe dès que les photos arrivent réellement.** La proposition valait sous la
contrainte « pas de photos et aucune perspective d'en avoir » ; l'utilisateur a supprimé la
contrainte. La photo dominante est la bonne direction pour une appli de cuisine, c'était celle des
maquettes, et elle **valide rétroactivement l'accent unique** — conçu précisément pour que la photo
porte la couleur.

⚠️ **Ce qui survit des teintes de famille** : plus une direction, un **état transitoire**. Fond du
cadre pendant le chargement, et fond de carte pour une recette sans photo. Mieux : extraire au build
la **couleur dominante de chaque photo** et l'écrire au catalogue — le cadre prend la teinte exacte
de l'image qui arrive, la transition ne se voit pas. `build.mjs` traite déjà des images pour les
icônes.

### Trois conséquences qui ne sont pas optionnelles

**(a) « Obligatoire » doit être vérifié au build.** `catalog/build.mjs` doit échouer si une recette
du catalogue n'a pas de photo, comme il échoue déjà sur une incohérence de régime. Le projet a
rencontré **trois fois** le mode de défaillance silencieux que cela évite : l'étiquette végétalienne
oubliée (décision 38), les 44 tests disparus (`vitest.config.ts`), le lexique cohérent mais incomplet
(décision 43). Une règle non vérifiée au build n'est pas une règle.

**(b) La règle porte sur le CATALOGUE, pas sur les recettes utilisateur.** Trois cas où la photo
n'existera pas malgré tout, dont un **déjà tranché par le projet** :

| Cas | Statut |
|---|---|
| Pendant le chargement | Systématique |
| Recettes **importées du web** | `ETAT.md` §3 : « faits + lien source, **jamais la prose/photo** » |
| Recettes **créées par l'utilisateur** (`user_recipe`, éditeur livré session 7) | Structurel |

Formuler « photo obligatoire » sans cette restriction ferait contredire la règle par le produit
lui-même dès la première recette importée.

**(c) Le texte ne va PAS sur la photo.** Position tenue par la revue **contre la maquette**, qui pose
le nom sur un dégradé (`Aujourd'hui.dc.html` l. 64). ⚠️ **Le contraste sur une photo n'est pas
mesurable** — il dépend de la photo. Sur 241 images il y en aura une claire, et le nom deviendra
illisible sur le seul écran que l'appli existe pour afficher. Une appli qui a documenté trois écarts
de contraste au dixième ne peut pas abandonner la garantie précisément là. Et pour une personne
malvoyante, la photo plein écran ne transporte **aucune** information : le nom est le seul contenu de
l'écran. → **Photo en haut, nom / heure / tags sur fond plein en dessous.**

### Spécification de prise de vue

241 plats photographiés dans des conditions variables ne font pas un catalogue. C'est aussi un
problème d'accessibilité : un fond qui change à chaque carte détruit le repère visuel de qui navigue
de mémoire.

| Paramètre | Valeur | Raison |
|---|---|---|
| **Ratio** | **4:5** (hero), recadrage **1:1** centré (vignette) | Les deux formats sortent de la même prise |
| **Angle** | **45°, un seul** — jamais mélangé avec la plongée | Le mélange est la cause n°1 d'un catalogue qui semble cassé ; la plongée écrase un rôti |
| **Lumière** | **Une source, arrière-latérale ~135°, diffusée, toujours du même côté** | Le contre-jour donne la matière, la lumière frontale aplatit. Un côté qui change se voit immédiatement |
| **Fond** | **Une surface, une couleur**, mate, neutre chaud moyen | Pas de blanc (le projet refuse le « blanc clinique »), pas de noir |
| **Échelle** | L'assiette occupe **70-80 % de la largeur** | C'est ce qui fait un catalogue plutôt qu'un album |
| **Accessoires** | **Aucun**, ou un seul, toujours le même | Une fourchette ici, un torchon là = du désordre |
| **Balance des blancs** | **Fixe ~5200 K**, aucun filtre par photo | Un profil unique à l'export |

⚠️ **Le risque n'est pas la première photo, c'est la centième.** Shooter une **image de référence** et
comparer chaque nouveau lot à elle : la dérive sur plusieurs semaines est le mode de défaillance réel,
et il ne se voit qu'en mettant deux lots côte à côte.

### Budget — à mesurer avant de shooter

Deux tailles par plat, hero ~1080 px + vignette ~400 px :

```
hero webp q75 ≈ 120 Ko · vignette ≈ 32 Ko → 241 × 152 Ko ≈ 36 Mo
```

⚠️ **Estimation, pas une mesure.** Le poids réel dépend des images (fond uni ≫ nappe texturée).
**Shooter 5 plats, exporter, mesurer, multiplier par 241** — une heure, et ça évite de découvrir le
problème au 200ᵉ.

36 Mo passent dans un binaire Capacitor (plafond AAB 150 Mo) et **ne passent pas** dans le budget de
15 Mo du critère P6, qui était un budget de **premier chargement web**. Les deux décisions de cette
session se tiennent — mais une version web conservée à côté devra charger ses photos à la demande, et
les deux cibles n'auront pas le même comportement hors ligne.

---

## 3. Décision B — **TWA → Capacitor** pour le produit final

Tranchée par l'utilisateur pendant cette session. **Ferme la décision ouverte n°9** d'`ETAT.md` §4.

⚠️ **L'installation technique a été faite par la piste parallèle**, pas ici : `capacitor.config.ts`,
`@capacitor/{core,cli,android,local-notifications}` sont en place au 2026-08-01. Cette section ne
consigne que les **conséquences de conception**, qui elles ne sont pas traitées.

### Ce que ça invalide dans le livré

- ⛔ **`main.tsx` message `non_persistant`** : « Vos réglages sont enregistrés sur cet appareil, mais
  le navigateur ne garantit pas de les conserver. **Ajoutez l'application à votre écran d'accueil**
  pour ne rien perdre. » — s'afficherait **dans une appli native**, pour lui dire de s'installer.
  **Toujours présent au 2026-08-01.**
- ⛔ **`FICHE_REPRISE.md` étape n°3** annonçait « Origine HTTPS + `/.well-known/assetlinks.json` +
  Bubblewrap », c'est-à-dire une cible morte, dans le document qu'on lit en premier à chaque reprise.
  **Corrigé par cette session.**
- ✅ **§4.8 écran 2** (« ajoutez l'appli à l'écran d'accueil ») : déjà **désactivé sans être supprimé**
  par la piste parallèle (`accueil.tsx`). La décision Capacitor le rend définitif — dans une appli
  Capacitor, l'appli *est* installée.
- Le commentaire d'`app/index.html` justifie le manifest par « Bubblewrap l'exige pour empaqueter en
  TWA ». Justification morte ; le manifest reste utile si une version web est conservée.

### Le gain réel

Le risque « **éviction Safari à 7 jours** », classé **critique** dans `ARCHITECTURE.md` §7 et qui
justifiait tout l'écran 2, **tombe largement** : le stockage d'une WebView applicative vit tant que
l'appli est installée. C'est le vrai apport de la décision, plus que l'App Store.

### ⚠️ Le risque introduit — à vérifier AVANT tout le reste

**Tout le projet parie sur `rem` → l'interface suit la police système à 150 %.** C'est la contrainte
centrale du bloc commun, tenue avec discipline dans chaque fichier, et elle repose entièrement sur le
fait que le moteur de rendu applique le réglage système au contenu web. **Chrome le fait ; une
WebView applicative, ce n'est pas garanti.**

Si ça tombe, la garantie d'accessibilité la plus travaillée du projet disparaît **en silence** :
parfaite sur l'écran du développeur, inutilisable pour la personne de 72 ans qui a agrandi sa police.

> **Niveau de confiance : la revue n'a pas pu tester et ne l'affirme pas.** Elle signale où regarder.

**Trois régressions connues des WebView, à vérifier sur appareil** : `env(safe-area-inset-bottom)`
(`navigation.tsx` — la barre à 5 onglets peut passer sous l'indicateur d'accueil) · la barre d'état
devient native, les `meta theme-color` d'`index.html` ne la pilotent plus et le basculement
clair/sombre est à refaire par plugin · VoiceOver ≠ TalkBack ≠ Chrome sur la gestion de focus du lot A.

### ⚠️ Ce que Capacitor ne lève PAS

**La contrainte « pas de Mac »**, citée en motif de la décision 9. Construire et signer un IPA exige
macOS + Xcode + 99 €/an. Sans Mac, cette décision apporte un **conteneur Android**, pas l'iOS.
→ **Ne pas retirer la version web du plan** : elle reste le seul chemin vers un iPhone.

### Ce que ça déplace côté médias

`ETAT.md` §3 fige un « cache à deux étages : socle léger pré-caché, médias lourds à la demande ».
Ce modèle suppose un service worker et un réseau. En Capacitor les assets sont dans le binaire. La
contrainte se desserre mais **change de nature** — à trancher avant de produire les photos.

---

## 4. Le socle d'accessibilité — validé sur le principe, **NON EXÉCUTÉ**

### Lot A — focus au changement de route + lien d'évitement
`app/src/ui/main.tsx`, `app/src/ui/theme.css` · aucune dépendance

- `<main tabIndex={-1} ref={ancre}>`, `useEffect` sur `route` → `.focus({preventScroll:true})` +
  `window.scrollTo(0,0)`. **Ignorer le premier montage** : voler le focus au chargement annoncerait
  l'écran sans qu'on l'ait demandé. La remise à zéro du défilement corrige au passage un défaut réel
  — changer d'onglet en étant descendu atterrit au milieu du nouvel écran.
- Lien d'évitement en **premier élément focusable**, avant `<Navigation>` et avant
  `<LienParametres>`. Motif `.sr-only` par rognage — **jamais** `display:none` / `visibility:hidden`,
  qui le rendraient infocusable.
- ⚠️ **PIÈGE VÉRIFIÉ — ce doit être un `<button>`, pas un `<a href="#contenu">`.** Le routeur est
  **par hash** (`router.tsx`, justifié par le hors-ligne). Un ancrage déclencherait `hashchange`,
  `ONGLET_PAR_HASH` ne reconnaîtrait pas `#contenu`, et le repli documenté **renverrait l'utilisateur
  sur « Aujourd'hui »** — l'inverse exact de la fonction du lien.
- `theme.css` : `[tabindex="-1"]:focus { outline: none }`, sinon l'anneau de 3px encadre tout l'écran
  à chaque navigation.

### Lot B — mouvement + règles photo
`app/src/ui/theme.css`, `docs/DESIGN.md`

- `@media (prefers-reduced-motion: reduce)` dans `@layer base` : `animation-duration: 0.01ms
  !important`, `transition-duration: 0.01ms !important`, `scroll-behavior: auto`.
  ⚠️ **`0.01ms` et non `none`** — `none` supprime l'événement `animationend` et casse les composants
  qui l'écoutent.
  ⚠️ **Purement préventif : il n'y a aucune animation aujourd'hui.** C'est exactement pourquoi il faut
  le poser maintenant, avant les carrousels, boucles WebP 3 s et clips MP4 du §4.7 — après, il faudra
  repasser sur chaque média. Une boucle de 3 s qui tourne en permanence dépasse le seuil de 5 s de
  WCAG 2.2.2 : **chaque boucle a aussi un bouton lecture/pause visible.**
- Quatre règles à consigner dans `DESIGN.md`, non exprimables en CSS :
  1. **`alt=""` quand le nom du plat est adjacent.** Contre-intuitif mais correct : `alt="Blanquette
     de veau"` sous un titre identique fait annoncer le plat **deux fois**. La photo apporte
     l'appétit, pas une information transcriptible.
  2. **Jamais de photo sans nom visible** — §4.8 écran 4 fait glisser des photos sans nom, donc
     inutilisable sans vue. La bonne réponse n'est pas un meilleur `alt`.
  3. **Jamais de texte sur la photo** (voir §2c).
  4. **Toute boucle animée a un bouton lecture/pause visible.**
- Technique photo : `width`/`height` ou `aspect-ratio` sur chaque `<img>` — sinon la page saute sous
  le doigt, problème **moteur** et pas esthétique · `loading="lazy"` sauf le hero · webp.
- Mode sombre : une photo en pleine lumière sur `#1b1815` à 19h est un flash. Prévoir un voile ou
  `filter: brightness(0.85)` — coefficient à tester sur écran réel, pas à décider sur le papier.

### Lot C — filet `axe` — **dépendances non installées, accord requis (CLAUDE.md §4)**

État constaté : `vitest.config.ts` n'a **aucun environnement DOM**. La piste parallèle a depuis
introduit `ui/test-socle.ts`, qui change la donne — à réévaluer avant de choisir.

**Recommandation : Playwright + `@axe-core/playwright`, PAS jsdom.**
⚠️ **jsdom ne calcule aucun style : axe y abandonne le contrôle de contraste EN SILENCE** — le défaut
exact que documente l'en-tête de `vitest.config.ts` (« 572 tests devenus 528, sans le moindre
échec »). Playwright n'exige aucun mock puisque la vraie appli démarre.

Implique : 2 devDependencies + ~150 Mo de navigateurs · lancer `vite preview` et **non** `vite dev`
(le SW ne s'active qu'en prod) · ⚠️ **étape non évidente** : franchir l'accueil, `Coquille` bloque sur
`aConsenti()`.

⚠️ **Depuis la décision B, le lot C change de statut** : Playwright teste Chromium, plus le runtime de
production. Il reste utile comme filet de non-régression — **seul contrôle automatique de contraste
disponible** — mais **ne vaut plus validation**, qui passe par l'appareil.

**Couverture honnête : ~1/3 des vrais problèmes.** N'attrapera jamais un `alt` présent mais faux, ni
un focus perdu, ni un geste sans équivalent visible. Deux passes manuelles restent nécessaires :
clavier seul sur tous les écrans, puis **320 px / zoom 200 % / police système 150 % — trois tests
distincts**, dont la spec ne couvre aujourd'hui que le dernier.

**Ordre : A, puis B, puis C.** A et B sont indépendants, sans dépendance, sans risque de régression,
et **B doit précéder les photos**.

---

## 5. L'échelle typographique proposée — **non appliquée**

À poser dans `@theme` (`theme.css`) puis migrer les écrans. 6 pas, ratio 1,2, base 1,0625rem.

| Jeton | Valeur | px@16 | Usage |
|---|---|---|---|
| `--text-mention` | `0.875rem` | 14 | Libellés d'onglets, mentions, unités. **Plancher absolu** |
| `--text-corps` | `1.0625rem` | 17 | Tout le texte courant |
| `--text-lecture` | `1.25rem` | 20 | Étapes de recette, ingrédients, titre de carte (§4.6 « lu debout, de loin ») |
| `--text-section` | `1.5rem` | 24 | `h2` |
| `--text-ecran` | `1.8rem` | 28,8 | `h1` |
| `--text-plat` | `2.2rem` | 35,2 | Nom du plat en hero, **un seul par écran** |

Interlignage : 1,6 (`corps`), 1,55 (`lecture`), 1,12 (titres, déjà en place).
**Rythme vertical — 3 valeurs seulement**, l'écart encode la relation : `0.5rem` dans un objet ·
`1rem` entre objets d'un bloc · `2rem` entre sections.

⚠️ **Le nom du plat en hero à 2,2rem déborde à 150 % de police système** sur un nom long (« Boulgour
aux pois chiches et courgettes »). Prévoir un `clamp()` ou un repli sur `--text-ecran` au-delà d'une
longueur — cas fréquent précisément à cause de la contrainte d'âge, et non traité.

---

## 6. Entrée utilisateur NON TRAITÉE — `docs/test appli.txt`

⚠️ **Ce fichier n'est pas une documentation datée : c'est un lot de retours d'interface non
instruits**, qui se termine par « Réfléchie a toutes les propositions et présente moi des
corrections ». Il a été **délibérément laissé en place** plutôt qu'archivé — l'archiver l'aurait
enterré. `Notes/Note designe.txt` est son équivalent traité (`ETAT.md` §2, « ✅ Traité et intégré ») ;
celui-ci ne l'est pas.

Il contient *« je veux une interface comme tinder : une recette avec une grosse image qui prend la
majorité de l'écran »* — **c'est la source de la décision A**. Et une quinzaine d'autres demandes,
dont certaines **déjà traitées par la piste parallèle** :

| Demande | État au 2026-08-01 |
|---|---|
| Barre du bas trop fine sur certains téléphones | ✅ Faite (session 7, +5 mm) |
| Bandeau de stockage écartable | ✅ Faite (`ECARTABLE`, `main.tsx`) |
| Notifications de rappel de préparation | ◐ `@capacitor/local-notifications` installé |
| « Ce soir » affiché à 11h45 — l'écran ignore l'heure | ⛔ Non traité |
| Photos d'aliments dans la liste de courses | ⛔ Non traité |
| Où sont rangés les restes de la veille, et comment on les voit | ⛔ Non traité |
| Première utilisation : **aucune donnée pré-remplie** (semaine, frigo, calibrage) | ⛔ Non traité |
| Filtre temps visible directement dans Recettes | ⛔ Non traité |

**C'est une session de travail à part entière, pas une ligne de récap.**

---

## 7. Ce qui reste ouvert à la clôture

| Sujet | État |
|---|---|
| Lots A / B / C | Validés sur le principe, **aucun code écrit** |
| Échelle typographique | Proposée, **non appliquée** — la dérive s'est aggravée pendant la session (26 → 29 tailles) |
| `build.mjs` refuse une recette sans photo | Décidé en principe, **non codé** |
| Couleur dominante extraite au build | Proposé, non tranché |
| `main.tsx` message « ajoutez à l'écran d'accueil » | ⛔ **Contredit Capacitor, toujours en place** |
| `docs/test appli.txt` | **Non instruit**, laissé en place |
| Dépendances Playwright | **Non installées**, accord en attente |
| Police système 150 % en WebView | **Non vérifié** — risque n°1 de la décision B |
| OPFS en WebView Capacitor | Non vérifié |
| Photos | **0 sur 241**, production en cours côté utilisateur |
