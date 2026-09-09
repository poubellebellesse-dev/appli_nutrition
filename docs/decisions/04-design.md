# Décisions figées — Design

> Sorti intégralement de `ETAT.md` §3 le 2026-09-08 (cure, P-14). Texte non réécrit. Ne pas rediscuter sans raison.
> Index : [README.md](./README.md) · questions numérotées : [registre.md](./registre.md).

## Design
- **5 onglets** stables v1→v2 : Aujourd'hui · Semaine · Courses · Recettes · Savoir.
- **Geste = accélérateur**, toujours doublé d'un contrôle visible.
- **Planning à fenêtre glissante 2-14 jours.**
- **Badge de preuve** neutre (jamais rouge/vert), différenciateur n°1.
- Palette : sable/terracotta, Newsreader + Instrument Sans.
- **Thèmes d'accent curatés** (pré-validés contraste clair/sombre), pas de nuanceur libre ; le
  badge de preuve reste neutre quel que soit le thème.
- **La photo de plat est OBLIGATOIRE** (2026-08-01, décision utilisateur —
  `archive/RECAP_SESSION_8.md` §2). Elle porte l'ambiance, ce qui **valide rétroactivement l'accent
  unique**. Trois conséquences non optionnelles : **(a)** `catalog/build.mjs` doit **échouer** si une
  recette du catalogue n'a pas de photo — une règle non vérifiée au build n'est pas une règle ;
  **(b)** la règle porte sur le **catalogue**, pas sur `user_recipe` ni sur les recettes importées,
  dont §3 « Communauté » exclut déjà la photo ; **(c)** ⚠️ **jamais de texte SUR la photo** — le
  contraste y est **non mesurable**, et une appli qui a documenté trois écarts au dixième ne peut pas
  abandonner la garantie là. Nom, heure et tags sur fond plein **sous** la photo. Spec de prise de
  vue (ratio, angle, lumière, fond) : `archive/RECAP_SESSION_8.md` §2.
- ⚠️ **Aucune échelle typographique n'existe** — 29 tailles arbitraires mesurées le 2026-08-01, et
  `theme.css` ne porte aucun jeton de texte. Échelle à 6 pas proposée et **non appliquée** :
  `archive/RECAP_SESSION_8.md` §5. La cause est une spec incomplète, pas une dérive d'intégration.
- **Mode cuisine découpé en deux** (2026-08-04, ex-décision ouverte n°8) : **v1 = une recette à la
  fois** (écran allumé, étape courante, minuteurs, quantité à la demande) ; **v1.5 = synchronisation
  multi-recettes**. Motif : la v1 ne demande aucune donnée nouvelle du moteur et rend visibles **512
  `timer_s` déjà écrits, buildés et chargés jusque dans `catalog-loader.ts`, mais jamais affichés** ;
  la synchronisation de service est, elle, un problème d'ordonnancement entier. **Le pilotage vocal
  est exclu**, pas différé — il échoue en cuisine réelle (neuf modes d'échec, arXiv 2306.09992) et
  une permission micro fissure le principe 2. Spec : `ARCHITECTURE.md` §5bis.
- ⛔ **CE PRÉREQUIS EST ROUVERT LE 2026-08-06 — décision 60 de §4.** Il disait : le lien
  étape → ingrédient, `etapes[].food_ids` **écrit à la main**, pas dérivé, sur les **1 101 gestes**
  *(la dérivation par rapprochement de texte a été envisagée et écartée : `food` n'a ni synonyme ni
  alias)*. **La parenthèse est fausse depuis le 2026-08-05** : `food.synonymes` existe, ajouté par la
  décision 58 le lendemain de cette décision-ci, par une piste parallèle. La justification a expiré
  sans que personne ne relise ce qu'elle portait. Spec : `ARCHITECTURE.md` §5bis. **Ordre des lots :
  `CONCEPTION_MODE_CUISINE.md`.**
- ✅ **Le second prérequis est levé — lot L0, 2026-08-05.** `recipe_step.nature` distingue le geste
  de l'avertissement sur les **18 recettes** qui comptaient une mention ANSES ou ministère de
  l'Agriculture comme une étape à faire. Deux règles rouges au build (nature inconnue ; avertissement
  ailleurs qu'en dernier) et la fiche recette qui sort la mention de la liste numérotée. Mesuré :
  **1 119 étapes, 1 101 gestes, 18 avertissements**.
- ✅ **L'écran du mode cuisine est codé — lot L1, 2026-08-05.** Écran allumé (`ecran-allume.ts`),
  une étape à la fois qui **n'avance jamais seule**, minuteurs parallèles qui survivent au changement
  d'étape, alarme au premier plan qui **sonne jusqu'à l'appui ou 5 min**, et reprise d'une cuisson
  (schéma **v10**) avec son bandeau sur Aujourd'hui. ⚠️ **Trois écarts assumés au plan**, tous
  documentés dans `CONCEPTION_MODE_CUISINE.md` : la migration est une **v10 et non une v9** (prise
  le même jour par la décision 51) ; les deux colonnes de `user_cuisine_timer` sont **mutuellement
  exclusives par CHECK** au lieu d'un simple discriminant nullable ; `parcours.ts` **n'a pas reçu
  d'entrée de visite guidée** — ✅ **tranché le 2026-08-07 : il n'en aura pas**, et ce n'est plus une
  dette. `lancerParcours` navigue vers `parcours.ecran` quand on choisit un tutoriel depuis Réglages ;
  pour le mode cuisine ce serait un `#/cuisine/<id>` en dur, et **ouvrir cet écran écrit
  `user_cuisine_session`**, qui ne tient qu'une ligne — revoir un tutoriel effacerait la cuisson en
  cours. `ecran: null` ne sauve rien : toutes les étapes seraient sautées, c'est le tutoriel fantôme
  que la règle 1 de `parcours.ts` interdit. **Ligne qui en découle : un parcours par écran atteignable
  depuis la barre d'onglets** — la fiche recette n'en a pas non plus, pour le même motif. Raisonnement
  complet au-dessus de la table `PARCOURS`, verrouillé par un test.
- ✅ **UN SEUL TUTORIEL DE PREMIÈRE OUVERTURE, QUI ENTRE DANS CHAQUE MENU — lot `retour-1b`,
  2026-08-21, `42491ea`.** Il nommait les cinq onglets sans entrer dans un seul ; il les traverse
  maintenant, 29 étapes, un seul parcours. Les neuf parcours d'écran restent lançables un par un :
  **ce lot ajoute un chemin, il n'en supprime aucun.** ⛔ **LE COMPOSÉ ENTRELACE, IL NE CONCATÈNE
  PAS**, et la différence n'est pas esthétique : mesuré, une concaténation rend les mêmes 29 objets
  dans le même compte — et un tutoriel MORT, qui reste sur le premier écran pendant que la table
  déroule les titres des autres. ⚠️ **Une étape « touchez Aujourd'hui » a été ajoutée, ce qui
  RENVERSE une décision écrite dans `parcours.ts`** (« c'est l'écran de départ le plus courant, le
  désigner n'apprendrait rien ») : elle se tenait tant que le tutoriel se contentait de NOMMER les
  onglets, elle tombe dès qu'il ENTRE dedans.
- ✅ **UNE CIBLE ABSENTE NE VEUT PLUS DIRE UNE SEULE CHOSE — même lot, et c'est le vrai fond.**
  `premierIndexValide` (`ui/visite.tsx`) sautait toute étape dont la cible manquait au DOM. ⛔ **OR
  CHAQUE ÉCRAN DE CE DÉPÔT DÉMARRE EN `phase: 'chargement'`** et n'affiche son ancre `data-visite`
  qu'après résolution d'une promesse : sauter à l'instant de l'arrivée écartait **tout le bloc** de
  l'écran d'un coup. Mesuré : le tutoriel traversait cinq écrans en n'en montrant qu'un, puis
  s'éteignait en silence sur le dernier. **Ce n'est pas un artefact de jsdom** — sur téléphone le
  chargement est plus lent, pas plus rapide. ▶ La règle est désormais double : **hors transition
  d'écran on saute** (la cible n'existera jamais sur ce compte, c'est voulu) ; **après une transition
  on ATTEND** (l'étape suivante est l'ouverture de l'écran, inconditionnelle par la règle 1 de
  `parcours.ts`, donc sûre par construction et non par pari). ⚠️ **PENDANT L'ATTENTE, RIEN NE
  S'AFFICHE** : une bulle posée sur une cible absente est exactement le tutoriel fantôme que ce
  garde-fou existe pour empêcher.
- ✅ **Les ingrédients sont dans le mode cuisine — 2026-08-06, schéma v11.** L'écran tenait la
  recette complète en mémoire et n'en affichait **aucun** ingrédient : « c'était combien d'ail ? »
  obligeait à quitter la cuisson pour rouvrir la fiche. Une fenêtre `Panneau` donne désormais la
  liste entière, quantités mises à l'échelle des portions, depuis n'importe quelle étape. ⚠️ **La
  liste et le sélecteur de portions sont EXTRAITS de `detail-recette.tsx`** (`ui/ingredients-recette.tsx`),
  pas recopiés — la règle de `ui/quantites.ts` est trop subtile pour vivre en deux exemplaires.
  **Migration v11** : colonne `portions` sur `user_cuisine_session`, **nullable = aucun choix
  exprimé**, jamais un défaut déguisé ; les portions réglées sur la fiche voyagent par
  `#/cuisine/<id>?portions=<n>` et sont ensuite tenues par la session. ⚠️ **La sonnerie ferme la
  fenêtre** : `Panneau` est un portail posé après l'écran, il recouvrirait la surface d'arrêt de
  l'alarme. ⛔ **Ce lot DÉSAMORCE le prérequis A** — voir la décision 60 de §4 : le lien
  étape → ingrédient n'est plus ce qui bloque l'usage, il devient un raffinement.
- ✅ **Le lien étape → ingrédient existe — lot L2, 2026-08-07, ET IL N'A DEMANDÉ AUCUNE ANNOTATION.**
  Le plan prévoyait 1 350 saisies à la main ; il y en a eu zéro. `catalog/lien-etape-ingredient.mjs`
  dérive le lien du texte au build : **93,2 % des gestes** trouvent au moins un ingrédient, 1,9 %
  sont ambigus. ⚠️ **93,2 et non 93,7 : le taux a BAISSÉ le 2026-08-08, et c'est une correction** —
  41 liens hérités à tort ont été retirés (voir la puce « l'antécédent d'un pronom » plus bas). Un
  taux de couverture qui monte n'est pas en soi une bonne nouvelle quand ce qu'il compte est faux. Cinq mécanismes, dont trois hors plan — mot de tête sur les DEUX premiers mots (le
  nom CIQUAL met le règne devant : « Veau, escalope »), hyperonyme résolu par le `groupe` de
  l'aliment (« les fruits » → pomme, orange, banane de CETTE recette), et héritage sur pronom
  (« les blanchir »), le déterminant étant distingué de l'article par l'infinitif qui suit.
  ⚠️ **Une ambiguïté fait TAIRE l'ingrédient** au lieu de le deviner, et **on n'hérite jamais d'un
  héritage** : une chaîne d'approximations n'est plus une donnée. ⛔ **L'INTERDIT QUI VA AVEC :
  cette table AJOUTE, elle ne FILTRE JAMAIS.** L'écran met la quantité sous l'étape et laisse la
  liste complète à un tap — c'est ce qui rend 93,7 % suffisants. Filtrer ferait afficher une liste
  vide sur une étape sur seize et cacherait 5 % des ingrédients : l'écran qui ment par omission.
  ▶ **La décision 60 est FERMÉE**, et L3 est abandonné, remplacé par cette ligne de quantités.
  Remesurer : `node catalog/mesure-liens-etapes.mjs`. ⚠️ **La sonde vit dans `catalog/` et non dans
  `atelier/`, qui est gitignoré** — une mesure qu'on ne committe pas ne prouve rien à personne
  d'autre, et cette décision-là s'est jouée sur ses chiffres.
- ✅ **La quantité est DANS la phrase de l'étape, plus seulement en badge dessous — 2026-08-08.**
  « Émincer l'oignon » devient « Émincer **1 gros oignon** », et le nombre suit le sélecteur de
  portions. **Aucune recette YAML n'a été touchée**, et c'est la contrainte qui commande tout le
  reste : un nombre écrit dans le catalogue serait figé et cesserait de s'échelonner. L'injection se
  fait donc au rendu (`app/src/ui/texte-etape.ts`, module pur, 47 tests), servi aux deux écrans.
  **Au 2026-08-09 : 1 866 liens posés, soit 1 111 gestes sur 1 407 (79,0 %)** — et, en écartant ce
  qui n'est pas chiffrable (fond de placard, « au goût »), **1 088 gestes sur 1 249 (87,1 %)**.
  ⚠️ **Le relevé précédent — 1 828 liens, 1 086 gestes sur 1 397 — a été pris sur un catalogue plus
  petit : ce n'est PAS un écart mesuré, ne pas le soustraire.** Le seul delta juste de ce lot est
  diffé ligne à ligne plus bas.
  ⛔ **CE MODULE NE DÉCIDE JAMAIS QUEL INGRÉDIENT UNE ÉTAPE UTILISE** — c'est le verdict du build
  (`RecipeStep.foodIds`, décision 60). Il cherche seulement *où* le nom est écrit, parce que
  `rapprocherEtape` travaille sur des mots normalisés et perd les positions de caractères. **Un
  échec de localisation est un no-op silencieux** : le badge reste, et l'invariant « la table AJOUTE,
  elle ne FILTRE JAMAIS » tient — l'union phrase + badges égale toujours `foodIds`.
  ⚠️ **La règle est grammaticale, pas cosmétique, et elle a deux branches.** Le déterminant est
  soit **remplacé** (« l'oignon » → « 1 gros oignon »), soit **accordé au nombre de la quantité**
  quand il appartient à un nom et ne peut pas disparaître : « le reste **du** beurre » → « le reste
  **des** 50 g de beurre », « **chaque** banane » → « **les** 4 bananes », « la moitié **de l'**
  oignon » → « la moitié **d'**1 gros oignon ». ⛔ **Le `de` NU régi par un verbe fait une troisième
  branche, et l'avoir prise pour la première a produit 85 phrases fausses** — voir `PIEGES.md`.
  ⚠️ **Ce qui reste hors de portée d'une règle** : 943 liens non injectés, dont **368 libellés sans
  nombre** (« au goût ») — irrécupérables par construction. ✅ **Le gisement des étapes où l'aliment
  n'est pas nommé est TOMBÉ de 17 à 1** le 2026-08-09 par la règle du nom de portion, puce suivante.
  ▶ **Remesurer : `npx tsx atelier/mesure-quantites-dans-etapes.mjs`** (couverture et ventilation
  des ratés) et **`atelier/phrases-suspectes.mjs`** (relit les 1 828 phrases produites, signale
  répétitions et prépositions mangées — c'est lui qui a trouvé les deux défauts).
  ⚠️ **Ces deux sondes sont dans `atelier/`, donc gitignorées, à l'inverse de celle de L2 — et
  c'est délibéré : elles décrivent le CATALOGUE, pas le code.** Leur chiffre bouge à chaque lot de
  contenu sans qu'aucune régression ait eu lieu ; le figer dans un test ferait rougir la suite au
  premier ajout de recette.
- ✅ **LE LIBELLÉ D'UN INGRÉDIENT DÉCLARE EN QUOI IL SE COMPTE — 2026-08-09, règle donnée par
  l'utilisateur.** « Poser **les filets** dans un plat » ne nommait aucun aliment : ni la dérivation
  ni l'injection ne voyaient d'églefin. Or `unite_affichage: "4 filets"` **le dit déjà** — dans
  CETTE recette, cette chair se compte en filets. Le mot de portion vaut donc nom d'aliment, aux
  deux bouts : `portionDuLibelle`/`portionEmployee` dans `catalog/lien-etape-ingredient.mjs`, forme
  cherchable **essayée en dernier** dans `ui/texte-etape.ts`. **C'est le mouvement d'`HYPERONYMES`,
  avec la ligne d'ingrédient pour source au lieu du `groupe`** — le catalogue portait l'information,
  personne ne la lisait. **Bilan diffé ligne à ligne** : liens **2 795 → 2 809 (+17 / −3)**, gestes
  chiffrés **1 097 → 1 111**, plus **11 phrases réécrites** ; le gisement à réécrire à la main passe
  de **17 à 1**. Les 3 liens perdus sont un gain — un héritage FAUX sur `pain_perdu #2` remplacé par
  le lien direct vers `pain_mie`.
  ⛔ **TROIS GARDES, ET AUCUN DES TROIS N'A ÉTÉ TROUVÉ PAR UN TEST** — deux par le diff du rendu, un
  par la relecture de l'utilisateur. Un même mot est un **nom** (« poser les filets »), un
  **participe passé** (« le poulet tranché ») et une **mesure** (« un filet d'huile ») : déterminant
  devant · complément qui nomme un **AUTRE** ingrédient · refus du singulier indéfini « une ». Détail
  et contre-exemples : `PIEGES.md`.
  ⚠️ **Le défaut le plus cher de ce lot n'était pas un lien manquant mais un NOMBRE FAUX** — « rouler
  chacune dans **une tranche** de jambon » rendu « dans **8 tranches** », et **le compte de liens
  MONTAIT**. Un lot de langue se mesure ligne à ligne sur le RENDU ; un total en hausse aurait
  présenté ce défaut comme un succès.
  ⚠️ **Le verdict rendu est `tete`, pas un cinquième verdict** — pour que la mécanique d'ambiguïté
  existante joue seule (deux chairs en filets dans la même recette ⇒ les deux se taisent).
  ⚠️ **Une portion ne vaut nommage que si c'est ELLE qui a été trouvée dans la phrase**, sinon
  « ajouter 1 filet **d'huile** » perd son complément : le libellé d'une huile *est* « 1 filet ».
  ⚠️ **Ce lot a cassé deux accords dans le catalogue, et c'est le YAML qui les porte** :
  « chaque tranche … sans **la** laisser » devient « les 8 tranches … sans **la** laisser »
  (`pain-perdu.yaml`, `chocolat-chaud-avoine-tartine.yaml`). **Aucun nombre n'a été écrit dans aucun
  YAML** — c'est la contrainte qui commande tout ce chantier.
  ▶ Tests : `catalog/lien-etape-ingredient.test.ts` (21) et `app/src/ui/texte-etape.test.ts` (47).
  Récit : [archive/…_quantites-portions.md](./archive/RECAP_SESSION_2026-08-09_quantites-portions.md).
- ✅ **L'antécédent d'un pronom n'est ni un verbe ni un fond de placard — 2026-08-08.** Deux défauts
  de `liensDeLaRecette`, trouvés par la RELECTURE HUMAINE des étapes à réécrire, pas par une sonde :
  aucune mesure ne les voyait, parce que tous deux produisent un lien **plausible**.
  **(a) LE FAUX INFINITIF.** `estInfinitif` n'est qu'un test de terminaison — tout mot de plus de
  trois lettres en `-er/-ir/-re`. Donc « **la chair** » se lisait « pronom + verbe », et à lui seul
  il déclenchait **8 héritages faux**, tous des cuissons de poisson (« jusqu'à ce que la chair se
  détache de l'arête »). Même piège pour « le beurre », « le sucre », « le centre », « l'autre face ».
  → `NOMS_EN_APPARENCE_INFINITIFS`, **liste relevée sur les 143 mots que le catalogue place
  réellement derrière un pronom**, pas devinée ; la compléter se fait de la même façon.
  **(b) L'ANTÉCÉDENT VOLÉ.** Ce qu'une étape EMPLOIE et ce que son pronom DÉSIGNERA ne sont pas la
  même chose. « LES plonger dans une eau salée et citronnée » emploie le sel et le citron ; « les »
  de l'étape suivante, ce sont toujours les artichauts. Les liens servaient d'antécédent, donc la
  référence dérivait vers l'assaisonnement et l'erreur se propageait. → l'antécédent écarte les
  ingrédients attrapés **par un verbe** et les **fonds de placard** ; si rien ne reste, la référence
  précédente tient. ⚠️ **L'étape garde tous ses liens** : seul l'antécédent est filtré.
  **Bilan, diffé ligne à ligne et non en totaux** : 47 liens partent, 2 arrivent, hérités 43 → 36.
  **L'injection de quantités ne perd rien** (1 828 liens avant comme après) — ce qui a été retiré
  n'était injecté nulle part, ce qui est la signature d'un lien faux. 8 pertes restantes sont
  justes : « Enfourner », « Servir aussitôt », « Retourner d'un coup » n'emploient aucun ingrédient.
  **4 étapes ont reçu un `food_ids` à la main** (`salade_crabe_avocat` 2, `langoustines…` 4,
  `omelette…` 4, `huitres…` 4) : le faux pronom y tombait juste par accident, et la soupape de la
  décision 60 est faite exactement pour ça. ⚠️ **Un `food_ids` n'est pas un nombre** — il n'introduit
  aucune quantité dans le YAML, donc rien qui puisse se figer.
  ⛔ **LE FOND DE PLACARD EST HORS DU CHANTIER DE RÉÉCRITURE, et c'est structurel** : sa quantité est
  FIGÉE. Tout ce travail existe pour qu'un nombre suive le sélecteur de portions — une pincée reste
  une pincée à 2 comme à 8 couverts. Ils restent des LIENS, donc des badges : écartés de la corvée,
  pas du catalogue. 31 des 114 étapes à réécrire n'existaient que pour eux.
  ▶ Tests : `catalog/lien-etape-ingredient.test.ts` (8, écrits en rouge d'abord). Rejouer le diff :
  `git show HEAD:catalog/lien-etape-ingredient.mjs > atelier/lien-avant.mjs && node atelier/diff-liens.mjs`.
- ✅ **Les gestes du lexique sont dans le mode cuisine — lot L1ter, 2026-08-07.** Même mesure que
  L1bis, un cran plus loin : l'écran tenait déjà le catalogue et les `lexiconIds` de chaque étape, les
  62 fiches du lexique existaient, et « c'est quoi émincer ? » imposait le même aller-retour vers la
  fiche que « c'était combien d'ail ? ». **Aucune donnée nouvelle, aucun schéma** — le dépliant est
  **extrait** vers `ui/gestes-etape.tsx` et servi aux deux écrans. ⚠️ **Il se déplie SUR PLACE et non
  en fenêtre, à l'inverse de L1bis et pour la raison inverse** : une liste se consulte à côté de
  l'étape, une définition se lit dedans — une fenêtre recouvrirait ce qu'on cherche à comprendre.
  Deux tests miroirs (`aria-haspopup` d'un côté, `aria-expanded` de l'autre) tiennent l'asymétrie
  contre une « harmonisation » future. ⚠️ **Le `key={etape.ordre}` a été vérifié en le retirant** :
  sans lui la définition se rouvrait toute seule au retour sur l'étape. ⚠️ **La fiche recette n'était
  couverte par aucun test sur ce dépliant** — l'extraction aurait pu la casser en silence ; c'est
  réparé. ▶ **Ce lot épuise ce que le mode cuisine gagnait sans donnée nouvelle** : L2, L3 et L4
  demandent tous du contenu ou un lot entier.
- ✅ **Deux défauts du mode cuisine corrigés — 2026-08-07. Aucun des deux n'était visible d'un test,
  et tous deux venaient du CATALOGUE, pas d'un cas limite imaginé.**
  **(1) Le format des durées n'avait pas de plafond.** `formaterDuree` rendait du `mm:ss` sans borne
  alors que **22 recettes portent un minuteur de plus d'une heure** — `coq-au-vin` en porte un de
  **43 200 s**. L'écran annonçait donc « Lancer le minuteur (**720:00**) » et décomptait
  « **719:59** » en 2,2 rem. Au-delà de l'heure, l'unité est désormais **écrite** (« 12 h 00 ») et les
  secondes tombent : une chaîne à deux-points **se lit comme des minutes** quand on y jette un œil, ce
  qui est tout l'usage de cet écran — `12:00:00` n'aurait réglé qu'à moitié, il ne diffère de `12:00`
  que par un suffixe qu'on rate de loin. ⚠️ **Un test entérinait le défaut** (`[3600, '60:00']`) :
  changer cette assertion-là était la correction, pas le contournement — elle encodait un format
  jamais confronté à ses données.
  **(2) La péremption se compte depuis la fin du dernier minuteur, plus depuis `ouverteLe`.** Le seuil
  de 12 h **égalait exactement** le plus long minuteur du catalogue : une marinade lancée à 20 h
  aboutissait à 8 h, et sa session périmait à 8 h — **à la seconde où elle avait quelque chose à
  annoncer**. Le bandeau « un minuteur est arrivé à terme » était inatteignable pour `coq_au_vin` et
  `hareng_pommes_terre_tiedes`. ▶ **Question D de `CONCEPTION_MODE_CUISINE.md` §8 FERMÉE**, et le
  nombre n'a pas bougé : **le point de référence était en cause, pas le seuil.** ⚠️ **Conséquence
  assumée : un minuteur en marche rend sa session impérissable** ; une pause, qui ne porte aucune
  échéance, ne prolonge rien.
- ✅ **Le garde-fou anti-sonnerie visait à côté — corrigé le 2026-08-07.** Il semait un `Set` des
  minuteurs échus **au montage**, donc il répondait à « l'écran vient-il d'être monté » quand la
  question est « **est-ce encore vrai** ». Deux trous opposés, **tous deux hors de portée de
  `jsdom`** : au **retour d'arrière-plan sans démontage**, le battement de seconde reprenait et la
  sonnerie partait pour un plat sorti du feu depuis quarante minutes — le mensonge même que ce
  garde-fou existait pour empêcher ; et à la **réouverture trois secondes après l'échéance**, le
  semis supprimait la sonnerie **en silence** alors qu'elle venait d'arriver. La règle est désormais
  `sonnerieEncoreJuste(depuisS)`, appliquée à **chaque battement**. ⚠️ **Son seuil n'est pas inventé :
  c'est `ARRET_AUTO_MS`, importé et non recopié** — « l'alarme serait-elle encore en train de sonner
  si quelqu'un avait été là ? ». Le `Set` reste, mais il n'empêche plus que la répétition.
  ⚠️ **Limite assumée** : l'acquittement n'est pas persisté, donc revenir sur l'écran dans les cinq
  minutes suivant une échéance refait sonner — une colonne de schéma pour ça serait disproportionné.
  ⚠️ **Falsification faite, pas déduite** : l'ancien code remis en place rend **4 tests rouges**, et
  son propre test de reprise restait **vert** — c'est ce qui montre que la suite ne pouvait pas voir
  le trou. Sans le seuil et sans le semis, c'est ce test-là qui tombe : la garantie est bien portée
  par la règle, pas par le montage.
- ✅ **« Étape 0 » ne s'affiche plus (2026-08-07).** Un minuteur dont l'étape n'existe plus — recette
  modifiée en cours de cuisson par l'éditeur, ou renumérotée par une mise à jour de catalogue — donnait
  `findIndex → -1`, rendu « Étape 0 — il reste 4:12 ». La ligne **perd son numéro et garde son
  décompte** : le faire disparaître serait pire, c'est un décompte qu'on oublie.
- ✅ **Trois finitions du mode cuisine — 2026-08-07.**
  **(1) Le bandeau de reprise a un battement.** Il lisait `Date.now()` AU RENDU et n'y revenait
  jamais : posé sur « Aujourd'hui » pendant que sa cuisson finit, on ne voyait **jamais** apparaître
  « un minuteur est arrivé à terme ». C'est précisément le reproche que la décision de ne pas sonner
  en arrière-plan s'était engagée à ne pas mériter. ⚠️ **L'intervalle ne tourne que s'il y a une
  cuisson** — sinon tout le monde paierait un timer permanent sur l'écran d'accueil.
  **(2) `scaleRecipe` n'est plus rappelé deux fois par seconde.** `quantitePour` était invoqué à
  chaque rendu, deux fois, sur le seul écran conçu pour rester allumé toute une cuisson : **7 200
  passes moteur et 7 200 `Map` neuves par heure** pour une valeur qui ne bouge qu'au changement de
  portions — plus autant de rendus forcés chez les enfants, l'identité de la `Map` changeant à chaque
  seconde. `useMemo`, donc **au-dessus des retours anticipés**, d'où le calcul de `portions` hissé.
  **(3) « Terminer la cuisson » ne jette plus un minuteur en cours sans le dire.** Le cas est banal :
  la dernière étape est souvent un repos, on lance son minuteur, et le bouton qui clôt le déroulé est
  juste à côté — `clearCuisineSession` emportait la ligne et ses enfants. ⚠️ **On ne demande rien
  quand il n'y a rien à perdre** : une confirmation systématique est une confirmation qu'on cesse de
  lire, et elle aurait alors coûté la seule chose qu'elle protège. La fenêtre **dit ce qu'on perd**
  (le nombre de décomptes), pas « êtes-vous sûr », et `aria-haspopup` est **conditionnel** — annoncer
  toujours une fenêtre mentirait une fois sur deux. Elle se ferme à la sonnerie, comme celle des
  ingrédients et pour le même motif de portail.
  ⚠️ **PIÈGE DE TEST PAYÉ ICI** : un intervalle posé par un effet dont la dépendance arrive **d'une
  promesse** (donc hors `act`) n'existe pas encore quand `advanceTimersByTime` est appelé dans le même
  bloc `act` — l'effet passif n'est rejoué qu'à la fermeture du bloc. Il faut un `await act(async
  () => {})` de vidange AVANT d'avancer l'horloge. `cuisine.test.tsx` n'a jamais eu ce piège : son
  intervalle a des dépendances vides, donc il est posé pendant le montage, que `render` enveloppe.
- ✅ **Le mode cuisine tient PLUSIEURS PLATS, et il dit quand les lancer — 2026-08-09, niveau 1 de
  `engine/cuisine/ordonnancement.ts`.** Entrée à plusieurs plats depuis la fiche recette, heure de
  service (une seule ligne en base, `user_cuisine_service` v13 : la fonctionnalité est de faire
  arriver ENSEMBLE des plats de durées différentes), frise des départs sous la barre d'onglets.
  Le moteur et la base portaient le niveau 1 depuis deux lots — **il ne manquait que l'écran, et
  c'est la cinquième occurrence de « un champ déclaré n'est pas un champ branché »**.
  ⛔ **LE FAIT DU LOT EST AILLEURS : LA DURÉE QUI ALIMENTAIT LA FRISE ÉTAIT FAUSSE SUR 143 RECETTES
  SUR 308.** `tempsPrepMin + tempsCuissonMin` ne compte pas les repos ; la frise annonçait « à lancer
  45 min avant le service » pour `hareng_pommes_terre_tiedes` et sa marinade de **douze heures**
  (`coq_au_vin` : 115 min annoncées, 838 réelles). Médiane de la correction **+12 min** — 87 des 143
  sous le quart d'heure, du bruit éditorial — mais **20 au-delà de l'heure** et un écart maximal de
  **11 h 40**. ⚠️ **Ce défaut n'a pas été trouvé en relisant le code mais en interrogeant
  `catalog.db`** : le code était cohérent avec lui-même et avec ses tests, c'est sa donnée d'entrée
  qui mentait, et `ordonnancement.ts` déclarait honnêtement la limite dans son en-tête.
  `dureeTotaleMin` rend désormais `tempsPrepMin + max(tempsCuissonMin, somme des minuteurs)` — pas
  une somme des trois : les minuteurs RECOUVRENT la cuisson déclarée (7 recettes seulement la
  dépassent, de 17 min au pire), la préparation est du temps de mains qui s'ajoute.
  **Approximation assumée** : les minuteurs sont sommés comme s'ils s'enchaînaient — elle penche du
  bon côté, on annonce un départ trop tôt et jamais trop tard.
  ⚠️ **Le seuil des « repos longs » (120 min) vient de la distribution du catalogue, pas du jugé** :
  73 des 81 étapes de repos tiennent en deux heures, **puis plus rien jusqu'à trois**, puis une queue
  de huit (3 h, 4 h, 6 h, 8 h, 12 h). Le creux est là. ⛔ **Et le seuil porte sur le CUMUL par
  recette, pas sur chaque repos** : la relecture a trouvé le trou puis l'a jugé « inatteignable par
  le catalogue actuel » — **quatre recettes y étaient déjà** (`sardines_marinees_citron` 180 min,
  `pain_maison` 160 en plusieurs levées, `poivrons_grilles_marines` 135, `gaspacho` 130), toutes
  muettes sur un départ décalé de deux à trois heures. *« Inatteignable en pratique » est une
  affirmation mesurable.* ⚠️ **Deux tests REDISAIENT la formule au lieu de l'appeler** et attendaient
  « 1 h 55 » pour le coq au vin ; ils n'ont protesté que parce que la frise affiche le nombre en
  toutes lettres. Récit complet, pièges d'horloge compris :
  [archive/RECAP_SESSION_2026-08-09_cuisine-multi-plats.md](./archive/RECAP_SESSION_2026-08-09_cuisine-multi-plats.md).
- **Le minuteur sonne au premier plan, pas en arrière-plan** (2026-08-04) — et **la reprise remplace
  la notification** : l'étape atteinte et les minuteurs survivent à la fermeture (schéma **v10**), un
  bandeau les ramène. ⚠️ **Échéance absolue (`fin_ms`), jamais un temps restant** : un restant se
  fige quand l'appli est fermée, et l'écran affirmerait quelque chose de faux sur de la nourriture.
  Motif du non-arrière-plan : les quatre voies Android ont été vérifiées et coûtent toutes plus
  qu'elles ne rapportent — `SCHEDULE_EXACT_ALARM` est un aller-retour dans les réglages système et
  non une fenêtre, `USE_EXACT_ALARM` est **bloquée à la publication Play** hors agenda/réveil, aucun
  `foregroundServiceType` ne convient à un minuteur. **Aucune permission Android nouvelle.** Le pari
  `USE_EXACT_ALARM` reste rejouable. Détail et comparatif des applis existantes :
  `CONCEPTION_MODE_CUISINE.md` §5-6.
- **Cuisine partagée multi-appareils : v2** (2026-08-04). ⚠️ **Le principe 2 ne l'interdit PAS** —
  le partage `.nutri-recipe` fait déjà sortir des données à l'initiative de l'utilisateur ; la ligne
  est « pas de serveur, pas de collecte, rien sans geste explicite », pas « aucune donnée ne sort ».
  C'est le coût qui tranche : plugin Bluetooth natif, permissions à l'exécution, état distribué. Un
  téléphone posé au milieu absorbe l'essentiel du besoin (§8 E de `CONCEPTION_MODE_CUISINE.md`).
- **Signal d'alarme : l'INVERSION de l'écran** (2026-08-05, **essayé sur appareil**) — retenue
  contre quatre autres (cadre, bandes latérales, plein écran, balayage) au seul critère qui compte :
  être vue **du coin de l'œil**, téléphone posé de côté. Elle donne l'écart de luminance maximal
  **sans masquer le contenu**. **L'alarme sonne jusqu'à l'arrêt** — appui n'importe où sur l'écran,
  garde-fou automatique à 5 min. ⚠️ **La vibration n'est PAS acquise** : `navigator.vibrate` n'a rien
  produit à l'essai ; l'alarme ne doit pas en dépendre. ⚠️ **Le pari `rem` à 150 % reste NON
  MESURÉ** — le premier essai visait le mauvais réglage (Android au lieu de Chrome). Compte rendu
  complet : `CONCEPTION_MODE_CUISINE.md` §7.

> ✅ **LES LIGNES QUI SUIVENT SONT DES DÉCISIONS, ET DEPUIS LE 2026-08-09 AU SOIR ELLES SONT AUSSI
> L'ÉTAT.** Le présent qu'elles emploient (« `pourSauces` est disjoint », « v14 ») décrivait ce qui
> **devait** être ; ①②③④ sont livrés et vérifiés commit par commit, voir §8. ⚠️ **Ne pas relire cet
> avertissement comme une garantie permanente** : ce qui est réellement livré se lit en §8, jamais
> ici. Confondre les deux est exactement ce qui a fait déclarer ce lot fermé pendant deux jours
> alors que son code n'existait dans aucun commit.
>
> ⚠️ **DEUX DÉCISIONS PORTENT LE NUMÉRO 62, et il faut le savoir avant de suivre une référence.**
> La 62 du tableau §4 (barrée, fermée le 2026-08-07) est « 23 recettes n'ont aucune facette
> `cuisine` » ; celle citée ici et en §8 est l'axe séparé des sauces, du 2026-08-08, **qui n'a jamais
> eu de rangée dans le tableau**. Le renvoi de §8 sur la similarité (« troisième point de mesure
> après la décision 62 ») désigne la PREMIÈRE. Non renuméroté : les deux numéros sont cités dans des
> commits déjà écrits, et renuméroter casserait ces renvois-là au lieu de les réparer.

- **Les sauces sont des recettes sur un AXE SÉPARÉ, pas une sixième valeur de `CourseKind`**
  (décision 62, 2026-08-08). Une sauce porte `est_sauce: true`, `types_repas: []` et **aucun
  `service`** — le build refuse les trois combinaisons contraires. ⚠️ **`CourseKind` a été écarté
  parce qu'une sauce n'a pas de rang dans l'ordre du service français** : la mettre dans
  `COURSE_ORDER` la placerait quelque part entre l'entrée et le dessert, l'en omettre la ferait
  disparaître en silence des écrans qui parcourent cet ordre. ⚠️ **`types_repas: []` est la garantie
  structurelle** (même esprit que `requiredFoodIds` dans `MealContext`) : sans créneau, une sauce
  n'entre jamais dans `recipesBySlot`, donc `suggestMeals` ne peut pas la proposer comme repas.
  **Elle ne suffisait pas** : `browseRecipes` et `searchByPantry` ne partent PAS d'un créneau mais de
  `catalog.recipes.keys()`, si bien qu'une vinaigrette était posable comme dîner depuis
  `ui/choisir-plat.tsx`. D'où `recettesHorsSauces` dans `engine/api/index.ts`, et le même retrait
  dans les trois fonctions de comptage de `engine/search/index.ts` — sinon la pastille de filtre
  annonce 236 pour 233 résultats. **Ce n'est pas de l'affichage, c'est le contrat.**
- **Une sauce se propose à TOUS les services SAUF le dessert** (2026-08-08, décision utilisateur).
  ⚠️ **Les entrées sont éligibles** — une première lecture les écartait avec les desserts, l'issue
  a été corrigée explicitement. Un plat qui vient déjà avec sa sauce n'en reçoit pas de seconde :
  `Recipe.porteDejaUneSauce` est un **tri-état** (`null` = personne n'a tranché → on dérive depuis
  les ingrédients marqués `sous_groupe: sauce`), même motif que `food_ids` sur une étape. ⚠️ **La
  dérivation seule ne suffirait pas** : elle voit le ketchup versé dans la recette, pas la sauce
  cuisinée au fil du plat — une blanquette nage dans la sienne sans qu'aucun ingrédient n'en soit
  une. Ne pas retirer le tri-état au motif que « la dérivation suffit ».
- **Les calories d'une sauce se comptent et s'affichent, sur leur PROPRE ligne** (2026-08-08).
  L'issue demandée était « ne pas prendre en compte les calories des sauces » ; retenue sous cette
  forme parce que **cacher le chiffre** contredirait le principe 3 et rouvrirait le précédent que la
  décision 3 de `CONCEPTION_B_VIN_REPAS.md` a fermé (« certains ingrédients ne comptent pas »).
  ⛔ **Rien n'en descend dans `engine/planning` ni dans `checkCalorieFloor`** : le plancher
  calorique continue de ne compter que les plats.
- **Le choix d'une sauce s'attache au PLAT, pas au créneau du plan** (2026-08-09, décision
  utilisateur, option B contre option A). `user_recipe_sauce (recipe_id, sauce_recipe_id)`, v14 :
  « je prends toujours cette sauce avec ce plat » est une **préférence durable**, elle vaut pour
  toutes les fois où le plat revient et **survit à la régénération du plan**. ⛔ **L'option A —
  `meal_plan_sauce` clé sur (plan, date, créneau, service) — a été explicitement écartée** : elle
  aurait fait redemander le même choix chaque semaine, et un replan aurait effacé le geste. Ne pas
  la rouvrir sans un besoin qui exige de saucer LE MÊME plat différemment selon le jour. ⚠️ **Ne
  jamais confondre `Recipe.sauceIds` et `user_recipe_sauce`** : le catalogue **propose**,
  l'utilisateur **choisit**. Acheter sur la proposition mettrait au panier les ingrédients de toutes
  les sauces suggérées de la semaine.
- **Les sauces ont une catégorie propre dans les rangements « Repas » ET « Jour » des courses, pas
  en « Rayon »** (2026-08-09, décision utilisateur : « ajouter sauces dans courses dans la catégorie
  repas, sinon traité comme les autres » — **étendue à « Jour » le 2026-08-09 au soir, décision
  utilisateur, sur mesure**). En « Rayon », un ingrédient de sauce est un article comme un autre :
  un yaourt de sauce se prend à la crèmerie avec les autres yaourts. **Motif du rayon** : les six
  rayons comptent le nombre de fois qu'on traverse un magasin, pas des familles d'aliments ; en
  sortir les sauces ferait revenir sur ses pas. En « Repas » la question n'est plus « où est-ce dans
  le magasin » mais « à quoi ça sert », et là la sauce est bien une catégorie.
  ⚠️ **« TRAITÉ COMME LES AUTRES » N'EST PAS ATTEIGNABLE EN « JOUR », ET C'EST CE QUI A ÉTENDU LA
  DÉCISION.** Mesuré, pas supposé : `grouper()` (`courses.tsx`) itère `pourSlots`, et un article de
  sauce porte `pourSlots: []` — une sauce n'est pas planifiée, elle suit son plat. Sans section, ces
  articles sont **achetés, comptés dans le total, et affichés dans AUCUNE section** : ils
  disparaissent en silence. Il n'existe pas de bucket « les autres » où les faire retomber en
  « Jour ». Le rayon, lui, range par `aisle` et n'a pas ce trou.
  ⚠️ **`pourSlots` et `pourSauces` sont DISJOINTS sur `ShoppingListItem`** : un citron réclamé par le
  plat ET par sa sauce est rangé une fois sous chacun, jamais deux fois sous le même titre.
  ⚠️ **La boucle des sauces est SOUS le garde `isLeftover`** — un reste ne se rachète pas (§7.3), sa
  sauce non plus. ⚠️ **Elle passe en SECONDE PASSE**, après celle des repas : `Map` conserve l'ordre
  d'insertion, donc les sections de sauce se rangent en pied de liste, là où l'on va chercher ce qui
  n'appartient à aucun repas (même parti que `ArticlesAjoutes` — « les ranger sous un repas
  inventerait une provenance »).
