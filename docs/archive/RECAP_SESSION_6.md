# Récit — session 6 (2026-07-31 → 2026-08-01)

> **Instantané daté. Ne jamais réécrire** (voir [README.md](./README.md)). Les chiffres ci-dessous
> étaient vrais le 2026-08-01 ; l'état courant est dans [../FICHE_REPRISE.md](../FICHE_REPRISE.md)
> et [../ETAT.md](../ETAT.md).

**Sujet de la session : le contenu de l'onglet Savoir, et sa traçabilité.** Deux chantiers,
« Comprendre » puis « Le saviez-vous ? », reliés par une même question — *comment un lecteur
vérifie-t-il ce qu'on lui affirme ?*

> ⚠️ **Périmètre de ce récit.** Plusieurs commits datés de la même période — écran d'accueil réécrit,
> Capacitor, éditeur de recette, et surtout **la couverture de test des 9 écrans** — proviennent d'un
> travail mené en parallèle, hors de cette conversation. Ils ne sont pas racontés ici : je n'en
> connais pas les arbitrages, et un récit qui invente le raisonnement d'autrui vaut moins que le
> diff. Voir `git log`.

## 0. État vérifié à la clôture

**Le 2026-08-01** : `npm test` → **939 verts (68 fichiers)** · `npm run typecheck` propre ·
`npm run build` → **199 aliments, 241 recettes, 62 gestes, 73 tips, 8 fiches (33 positions)**.

**89 fichiers modifiés ou nouveaux non committés**, dépôt **3 commits en avance** sur `origin/main`.

## 1. Ce qui a été construit

### « Comprendre » (§4.7 DESIGN, §8.2 ARCHITECTURE) — la dernière section vide de Savoir

- **8 fiches, 33 positions, 33 sources**, sources éditables en `catalog/evidence/*.md` (Markdown à
  frontmatter), compilées en **cinq tables** : `evidence_sheet`, `evidence_source`,
  `evidence_position`, `evidence_position_source`, `evidence_link`.
- Chaîne complète : types domaine → validation au build → loader → écran, avec tests aux deux bouts.
- **Badge de preuve typographique et neutre** — bordure et capitales, jamais de couleur, jamais
  d'étoiles (§5 DESIGN en fait « l'élément le plus surveillé » du produit).

### « Le saviez-vous ? » — de 8 à 73 tips

- **`tip.source_url` passé à `NOT NULL`.** La colonne figurait dans §4.2 ARCHITECTURE depuis
  l'origine et n'avait jamais été implémentée. Le build refuse désormais un tip sans lien http(s).
- **73 tips** : 51 `biologie_aliment`, 11 `nutrition_humaine`, 11 `nutrition_animale`. Les trois
  catégories de §8.4 sont ouvertes ; `nutrition_animale` n'avait jamais eu de contenu, donc son
  rendu distinct n'avait jamais été vu à l'écran.
- Le carrousel affiche **le domaine de la source** (`pmc.ncbi.nlm.nih.gov`, `efsa.europa.eu`) plutôt
  qu'un « Source » nu.

## 2. Ce que la session a appris

### Le risque n°1 d'un produit qui promet des sources, c'est la source inventée

Un DOI écrit de mémoire est un DOI inventé. Sur un produit dont la promesse tient à la traçabilité,
c'est la faute qui coûte le plus cher — et elle est indétectable par relecture, puisqu'un faux DOI
ressemble exactement à un vrai. D'où la règle adoptée puis tenue sur les deux chantiers : **toute
source est ouverte et lue avant écriture ; une source non vérifiée ⇒ le contenu n'est pas écrit.**

Le coût est réel et mesurable. Britannica, Smithsonian, UC Davis Postharvest, l'extension de
l'Oregon State et l'EFSA Journal via Wiley renvoient tous 403 ou 402 à une lecture automatisée.
Chaque fois, il a fallu trouver une source lisible ou renoncer au sujet.

### La vérification a démenti trois tips déjà livrés

Ce n'est pas un effet de bord : c'est le meilleur retour sur investissement de la règle.

| Tip | Affirmation retirée | Pourquoi |
|---|---|---|
| `miel-conservation` | « on en a retrouvé encore comestible dans des tombes égyptiennes » | Anecdote massivement recopiée, aucune source primaire trouvable |
| `oignon-larmes` | « un oignon réfrigéré fait moins pleurer » | La source (Univ. Bristol) donne l'astuce pour **contestée** |
| `piment-capsaicine` | « un corps gras l'emporte » | L'essai retenu (Nolden 2019, 7 boissons) montre que **le lait écrémé calme autant que l'entier** — c'est la protéine, pas le gras |

Même mécanique sur un chiffre : le safran est partout donné à « 150 000 fleurs par kilo » ; la revue
citée en donne 60 000. C'est celui-là qui est écrit, parce que c'est celui qu'on peut vérifier au
bout du lien.

### « Plusieurs points de vue » est une demande dangereuse si on l'applique naïvement

La demande initiale était d'exposer **différents points de vue** sur les études. Appliquée
littéralement, elle produit la fausse symétrie — une étude isolée face à un consensus d'autorité :
le procédé exact qui a fait douter du tabac, et que §8.2 règle 1 interdit explicitement (« il existe
une étude pour affirmer à peu près tout et son contraire »).

La demande n'a pas été refusée, elle a été **bornée**. Divergences admises : méta-analyse contre
méta-analyse, autorité contre autorité, position contestée **citée avec sa critique publiée dans la
même position**. Et quand il n'y a pas de désaccord, la fiche l'écrit au lieu d'inventer un
opposant — **3 fiches sur 8** sont dans ce cas.

### Vérifier une source change parfois ce qu'on croyait écrire

En ouvrant Weaver 2016 (calcium et fractures), on découvre un financement par une association du
secteur évalué, en contradiction avec ce que le titre laissait attendre. D'où un champ
**`financement`** ajouté au format des fiches : une méta-analyse financée par le secteur qu'elle
évalue reste citable, le lecteur doit simplement le savoir. Reproduire la déclaration publiée, sans
la commenter.

### Ne pas écrire est une issue normale

Plusieurs sujets solides n'ont **pas** de tip, et c'est consigné dans `catalog/tips/README.md` :

- **L'anneau vert du jaune d'œuf trop cuit** — seule référence trouvée : *Biochemical Journal* 1920,
  disponible uniquement en images scannées. Titre citable, contenu illisible.
- **« Le champignon est plus proche de l'animal que de la plante »** — la source la mieux placée
  (Stiller 2004) argumente précisément **contre** ce consensus. La citer pour affirmer l'inverse
  aurait été une falsification.
- **Quatre valeurs de référence EFSA** (calcium, fer, vitamine C, folates) — annoncées sur les pages
  de presse, chiffrées seulement dans des PDF illisibles.
- Le ratio **« 40 litres de sève pour 1 litre de sirop d'érable »**, omniprésent et absent de la
  source citée : remplacé par les deux concentrations mesurées, qui disent la même chose.

### Un test intermittent avait une cause précise, pas un aléa

Un échec isolé (1 test sur ~935) est apparu trois fois sans se reproduire. Diagnostic par lecture,
pas par relance :

`catalog/build.test.ts` appelait `runBuild([])` **sans `--out`** — donc écrivait dans
`app/public/catalog/catalog.db`. Or `build.mjs` **supprime** la sortie avant de la recréer, et
`app/src/ui/test-socle.ts` **ouvre ce même fichier** pour tous les tests d'écran. Vitest exécutant
les fichiers en parallèle, un test d'écran tombant dans cette fenêtre trouvait un fichier absent ou
à moitié écrit.

L'en-tête de `test-socle.ts` disait « ici on ne fait que lire ». Vrai, et insuffisant : **quelqu'un
d'autre écrivait**. Les suites de `tests/` avaient déjà la mitigation (sortie temporaire isolée) ;
`build.test.ts` était le seul à ne pas l'avoir — et c'était justement l'écrivain.

Corrigé en un fichier, sans perdre de garantie : le build réel écrit dans un dossier temporaire, et
une assertion séparée vérifie **en lecture seule** que le catalogue livré existe.

> ⚠️ **Le sujet n'est pas clos.** Un échec isolé de plus a été observé APRÈS ce correctif, sur une
> machine chargée, sans être capturé ni reproduit en dix exécutions ultérieures. L'hypothèse
> restante — non vérifiée — est un `waitFor` de test d'écran qui expire sous contention CPU. Voir
> `ETAT.md` §8.

## 3. Ce qui a été refusé, et pourquoi

- **Écrire les fiches et chercher les sources ensuite.** Produit inévitablement des sources qui
  « disent à peu près » ce qu'on avait en tête. L'ordre inverse coûte plus cher et c'est le prix.
- **Citer une page renvoyant 403.** Connaître l'URL n'est pas l'avoir lue. Aucune exception.
- **Aligner le niveau d'exigence des tips sur celui des fiches.** Un fait botanique n'a pas de
  méta-analyse. Les tips s'appuient sur des articles à comité de lecture, des textes d'autorité et
  des manuels de référence — **plus faible**, et écrit comme tel dans le README plutôt que laissé
  croire à l'équivalence.
- **Un lien « Source » nu dans le carrousel.** Ne rassure personne. Le domaine, lui, situe.

## 4. Décisions prises dans la session

| Décision | Portée |
|---|---|
| **`tip.source_url` NOT NULL** | Comble l'écart §4.2. Les 8 tips d'origine sourcés rétroactivement pour la rendre applicable |
| **Les 3 catégories de §8.4 sont ouvertes**, `nutrition_humaine` compris | Formulation strictement descriptive : « l'EFSA considère que… », jamais « il faut… ». C'est ce qui garde §6.1 intact |
| **Une fiche = une question + N positions**, chacune avec son niveau de preuve | Écart assumé au §4.2, qui ne prévoyait qu'un niveau par fiche |
| **Table de jonction `evidence_position_source`** | Rend vérifiable qu'aucune affirmation n'est publiée sans référence |
| **Champ `financement`** sur les sources | Renseigné dès qu'un conflit d'intérêts est déclaré |
| **Règle anti-fausse-symétrie** | Divergences admises : méta-analyse vs méta-analyse, autorité vs autorité, contestation **avec sa critique publiée** |
| **Sortie de build isolée dans `build.test.ts`** | Supprime une course sur `app/public/catalog/catalog.db` |

## 5. Ce qui reste

- **27 tips** pour atteindre l'ordre de grandeur de §8.2 (une centaine).
- **8 fiches sur les 60-100** visées par §8.2.
- ⛔ **Relecture par un tiers, exigée par §8.2 bis avant publication** — ni les 73 tips ni les
  8 fiches ne l'ont eue. Le fait que le build passe ne rend pas le contenu publiable.
- **3 réserves de sourçage** sur les fiches (DOI Messerli dérivé d'un PII vérifié, auteurs de
  `critique-zhao-2018` non vérifiés, URL française ANSES) — détail dans `ETAT.md` §8.
- **`evidence_link` est écrit et chargé, lu par personne** : aucune navigation inverse d'une recette
  ou d'un aliment vers les fiches qui en parlent.

## 6. La leçon de fond

**Une règle de sourçage se juge à ce qu'elle interdit, pas à ce qu'elle produit.**

Les 73 tips et les 8 fiches ne prouvent rien en eux-mêmes : n'importe quel modèle en écrit autant en
une heure. Ce qui distingue ce contenu, ce sont les tips **non écrits** — l'œuf, le champignon, les
quatre valeurs EFSA — et les trois affirmations déjà livrées que la vérification a **retirées**.

C'est aussi la limite du dispositif : le build vérifie qu'une URL existe et qu'elle est cliquable.
Il ne saura jamais si elle dit ce que le texte prétend. Cette garantie-là n'a pas d'automatisme —
elle tient à la règle éditoriale, et à la relecture par un tiers qui reste due.
