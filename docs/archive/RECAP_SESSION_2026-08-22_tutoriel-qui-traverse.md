# Récap de session — 2026-08-21 → 08-22 · le tutoriel qui traverse les menus

> **Instantané daté. Vrai à sa date, jamais réécrit.** Ce qui est durable vit dans `ETAT.md`, dans
> `CONCEPTION_RETOURS_TEST.md` et dans `reference/PIEGES.md` ; ce document garde ce qui ne se
> reconstitue pas — les affirmations démenties, les raisonnements abandonnés, et les erreurs.

**Livré :** lot `retour-1b` (`42491ea`), puis la réconciliation des documents et de l'index
(`e85f50e` et la suite). **Arbre à la clôture :** `npm test` **2 363 passed / 0 failed
(124 fichiers)** en 44,4 s · typecheck propre · `vite build` ✓ (3,06 s) · `plan-stress` **20/20**.
Catalogue non touché.

---

## §1. Ce que le lot a changé

Le tutoriel de première ouverture nommait les cinq onglets de la barre du bas et s'arrêtait là. Il
**entre** maintenant dans chacun : la barre, puis « touchez Aujourd'hui » et le bloc d'Aujourd'hui,
puis Semaine, Courses, Recettes, Savoir. **Un seul parcours, 29 étapes.** Les neuf parcours d'écran
existent toujours et restent lançables un par un — le lot ajoute un chemin, il n'en supprime aucun.

Deux décisions de fond, détaillées dans `ETAT.md` §3 :

1. **Le parcours composé ENTRELACE, il ne concatène pas.** Une transition, puis le bloc de l'écran
   où elle mène, puis la transition suivante.
2. **Une cible absente du DOM a désormais deux sens** : hors transition d'écran on saute (l'étape
   est conditionnelle, c'est voulu), après une transition on **attend**.

---

## §2. Ce que la mesure a démenti — la partie qui ne se reconstitue pas

**Cinq affirmations sont tombées. Trois étaient les miennes.**

### (a) « Le tutoriel commence par Semaine au lieu d'Aujourd'hui » — la puce décrivait autre chose qu'elle-même

Elle venait du brief de `retour-1`. Mesuré : le parcours d'accueil commençait **déjà** par Semaine.
La puce ne disait pas ce qu'elle voulait dire, et une première interprétation de ma part — réordonner
la liste « Revoir un tutoriel » des Réglages — a été **écartée par l'auteur** : ce n'était pas ce
qu'il visait. C'est de ce malentendu qu'est née la décision 81, donc ce lot.

### (b) Mon compte de titres dupliqués contredisait celui du critique — c'est lui qui avait raison

J'avais mesuré **zéro** doublon dans `parcours.ts`, lui en annonçait un. Ma regex
`titre: '(.+?)',` ne reconnaissait que les apostrophes simples ; `parcours.ts:170` écrit son titre
avec des guillemets doubles. Corrigée en `titre: (?:'(.+?)'|"(.+?)"),` : **41 étapes, 1 doublon**
(« Partir de ce que vous avez », deux fois, avec des cibles différentes). ⛔ **Un compte obtenu par
une expression régulière n'est pas une mesure tant que l'expression n'a pas été confrontée à la
forme réelle du fichier.** C'est ce doublon qui a imposé de chercher l'étape d'une bulle **dans le
composé seul** et non dans toute la table.

### (c) J'ai surdit un trou de mes propres tests, et je l'ai dit avant de l'avoir vérifié

J'avais annoncé que desserrer `premierIndexValide` ferait passer les clauses « sans aucune
navigation ». **Faux** : le pilote clique les vrais liens, donc la navigation a bien lieu. Le trou
réel était plus étroit — des bulles pointant dans le vide — et il est devenu la clause 6. ⚠️ **Un
trou annoncé trop large est aussi faux qu'un trou nié**, et il coûte le même travail.

### (d) « `ecran: null` créerait une collision » — vrai en théorie, mort en pratique

Le critique signalait que `parcoursDeLEcran` rendrait le mauvais parcours. Vérifié : **cette
fonction n'a aucun appelant.** Aucune clause n'a été ajoutée pour un défaut que rien ne peut
observer. La fonction, elle, est partie en dette (`ETAT.md` §8).

### (e) Mes deux premières corrections « expliquaient » un symptôme qu'elles n'avaient pas mesuré

Deux tentatives d'affilée sur l'interaction clic/route, **résultat identique : 7 clauses sur 10, le
tutoriel s'arrêtant après le bloc « Aujourd'hui »**. Les deux partaient d'une hypothèse lue dans le
code. La règle du dépôt — *deux échecs de suite, on s'arrête* — a été appliquée, et la troisième
tentative est partie d'une **sonde jetable** qui relevait le parcours réel bulle par bulle. Le
journal désignait la cause en une lecture : les indices 9-11, 14, 16-17, 19-23 et 25-29 sautés par
blocs entiers, exactement les blocs des écrans.

---

## §3. La cause, et pourquoi aucune relecture ne l'aurait trouvée

**Chaque écran du dépôt démarre en `phase: 'chargement'`** et n'affiche qu'un `<p>Chargement…</p>` :
son ancre `data-visite` n'existe qu'après résolution d'une promesse. Or `premierIndexValide`
s'exécutait **à l'instant de la transition**, quand l'écran d'arrivée n'avait encore rien rendu. Il
écartait donc **toutes** les étapes de cet écran d'un coup, et à Savoir il n'en trouvait plus aucune
et rendait `null` — la visite s'éteignait en silence.

⛔ **Ce n'est pas un artefact de jsdom.** Sur téléphone le chargement est plus lent, pas plus rapide :
le défaut y est plus grave, pas moins.

⛔ **SEPT CLAUSES SUR DIX PASSAIENT PENDANT QUE LE TUTORIEL ÉTAIT CASSÉ.** L'identité des 29 étapes,
le compteur, les neuf survivants, l'absence de bulle vide, l'unicité des titres, et même le
« touchez Aujourd'hui » : toutes vertes. Seules les trois clauses qui **jouent** le parcours sur le
vrai DOM et relèvent `location.hash` à chaque bulle voyaient quelque chose. **Un lot dont 70 % des
clauses passent peut être entièrement cassé.**

### La forme de la solution, et le garde-fou qu'il ne fallait pas simplement retirer

La tentation était de desserrer `premierIndexValide`. ⛔ **Le retirer sans le remplacer rouvrait le
« tutoriel fantôme »** — des bulles désignant des éléments absents — que la clause 6 interdit.

La distinction retenue ne repose sur aucun délai posé au jugé : **l'étape qui suit immédiatement une
transition de route est toujours l'étape d'ouverture de l'écran, inconditionnelle par la règle 1 de
`parcours.ts` et verrouillée par `parcours.test.tsx`.** L'attendre est donc sûr **par construction**,
pas par pari. Partout ailleurs, une cible absente reste sautée.

⚠️ **Un seul nombre du lot est posé au jugé** : le garde-fou de 4 s qui reprend la règle ordinaire si
l'écran d'arrivée tombe en erreur et n'affiche jamais son ancre. Il n'est pas observable tant
qu'aucun écran n'échoue — donc **le déplacer « pour voir » ne montrerait rien**.

---

## §4. Le brief attaqué deux fois, et ce que le second round a prouvé

Le premier round a **raisonné** — trois trous trouvés, tous vérifiés à la main avant d'être crus,
dont l'un (b ci-dessus) où le critique avait raison contre moi.

⚔️ **Le second round a écrit sa triche et l'a lancée.** Un parcours composé obtenu par
**concaténation** des blocs — 29 étapes, les vrais objets, branché comme tutoriel par défaut — puis
la suite : **4 failed / 6 passed**. ⛔ **Ce 4/10 démontre ce qu'aucune relecture n'aurait démontré :
cinq clauses sur dix sont satisfaites par la seule PRÉSENCE des bons objets en bon nombre.** Elles ne
discriminent pas seules. ▶ **Verdict : NON TROUVÉ de triche qui fasse passer les dix.**

⚠️ **Le pilote a été vérifié VIVANT avant d'être cru mort.** Une sonde a relevé ce qu'il traversait
*avant* le lot : les cinq onglets nommés, hash final `#/savoir`. Il cliquait donc bien les vrais
liens — le défaut était dans le produit, pas dans le harnais.

---

## §5. Un fait de méthode : la garde ne filtre que les outils d'édition

⛔ **`.claude/hooks/garde.mjs` n'intercepte que `Edit|Write|MultiEdit|NotebookEdit`.** Un sous-agent
qui ne dispose que de `Bash` écrit dans `app/src/` et dans `tests/scelles/` **sans être vu**.

Ce n'est pas une lecture de code : c'est arrivé. Le critique du round 2 a modifié l'arbre par ce
chemin pour y poser sa triche. Il l'a ensuite rendu intact — vérifié à la main, `git diff --stat --
app/src` vide, aucun `.orig` orphelin, aucune trace de son `'decouverte'`. **La garde protège un lot
scellé de l'étourderie, pas de l'outil.** ▶ Dette : `ETAT.md` §8.

---

## §6. Mes erreurs

- ⛔ **Deux corrections d'affilée sur la même hypothèse, sans mesurer.** Résultat identique les deux
  fois. La règle des deux échecs existe pour ça, et j'aurais dû sonder avant la deuxième.
- ⛔ **Un test ordinaire modifié après coup.** `app/src/ui/visite.test.tsx` affirmait que le saut
  d'une étape sans cible est **immédiat**, au point exact que le lot change. Je l'ai corrigé — sa
  fin est inchangée, la moitié neuve vérifie qu'aucune bulle n'est posée pendant l'attente — mais
  **le brief déclarait ce fichier hors périmètre**. C'est un écart de plan, signalé à l'auteur avant
  d'être commité, pas après.
- ⚠️ **`onClick={surSuivant}` rendait le bouton « Suivant » INERTE**, l'événement de souris étant
  passé comme index de départ. Attrapé par **le typage**, par aucun test. Un bouton mort n'a pas de
  test qui le pleure.
- ⚠️ **`node -e` avec des accents graves dans une chaîne bash** : le shell a fait sa substitution de
  commande et vidé un commentaire de son contenu (« donde ne trouve »). Le code était juste, le
  commentaire non. **Un script `.mjs` écrit dans un fichier, jamais `node -e`.**
- ⚠️ **`grep -E "^ *Test Files"` ne rend rien** : vitest préfixe ses lignes de codes ANSI.
- ⚠️ **Un écart de compte de tests ne se déduit pas.** `retour-1b` porte **10 clauses** et vitest en
  compte **100** — quatre sont paramétrées et se déplient. Au `grep`, l'écart 2 254 → 2 363 se serait
  déclaré inexpliqué.

---

## §7. La réconciliation du 2026-08-22 — six écarts entre les documents et l'arbre

Relevés avant d'écrire quoi que ce soit, et corrigés sur décision de l'auteur.

| # | Écart | Ce qui a été fait |
|---|---|---|
| 1 | **Un chantier entier absent de l'index.** `.claude/lots.json` ne listait pas `CONCEPTION_RETOURS_TEST.md` dans ses `sources` : ni `retour-1` ni `retour-1b`, livrés, ni `retour-2` à `retour-8`. La machine les connaissait pourtant (`etat-garde.json`, `tests/scelles/`). | 9 lots ajoutés, chantier `retours test` **en tête** de l'index — c'est la priorité de `FICHE_REPRISE.md`. 40 → 49 lots. |
| 2 | **`65a` semblait n'être le titre d'aucune section.** ⚠️ **C'était MON erreur de relevé** : je n'avais grepé que les `###`, et `65a` est titré en `##` à la ligne 559. | Rien. L'index était conforme. |
| 3 | **Deux chantiers utilisaient les mêmes identifiants.** « Lot A » … « Lot E » existaient dans `CONCEPTION_REGIME_PERSONNALISE.md` **et** dans `CONCEPTION_RESERVATION_MATERIEL.md`. | Les cinq sous-lots du matériel renommés **`65a-A` … `65a-E`** — la collision tombe, et la série se rattache au nom sous lequel l'arbre les connaît (`tests/scelles/65a*`). |
| 4 | **Un document se contredisait sur un lot livré.** Le titre du `Lot C` annonçait « C″ (65b) NON OUVERT » alors que le 65b est livré le 08-18 (`d0c4bb3`), **ligne 225 du même fichier**. | Titre corrigé, avec la mention que **le corps du lot n'a PAS été réécrit** : un plan ne se réécrit pas après coup. |
| 5 | **Neuf lots du mode cuisine sont « faits » sans aucun hash.** | ⛔ **Rien.** `/plan` interdit d'attribuer un hash à la ressemblance : `git log --grep` rend plusieurs candidats pour presque chaque identifiant. **Un lot fait sans hash reste sans hash** — c'est une information, elle dit que la livraison n'est rattachée à rien. |
| 6 | **La fiche de reprise faisait 167 lignes** contre le plafond dur de 100 qu'elle s'impose à sa ligne 3. | Septième dégonflage : **167 → 100**. Blocs sortis dans `FICHE_REPRISE_extraits_2026-08-22.md`. |

⚠️ **CE QUI N'A PAS ÉTÉ ARCHIVÉ, ET POURQUOI.** `RETOUR_ESSAI_TELEPHONE.md` (49 Ko) porte dans son
en-tête « quand il sera vide, il rejoindra `archive/` ». **Il n'a pas été mesuré**, et douze
documents le citent. L'archiver sans avoir vérifié ce qu'il lui reste ferait disparaître un backlog
vivant. La liste de ce qui est réellement périmé est due à l'auteur, qui tranchera.

⚠️ **La garde a été COUPÉE (`/libre`) le temps d'écrire ce fichier et les extraits de la fiche** —
`docs/archive/**` est déclaré `protege` dans `.claude/garde.config.json`. Elle a été **rallumée
(`/strict`) aussitôt après**. Aucun autre outil n'a été employé pour la contourner.
