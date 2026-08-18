# Sondes des lots 66, 66b et 66c — des fichiers dont on mesure la COMPILATION, pas l'exécution

Ces **dix** fichiers ne sont pas des tests. Ce sont les **entrées** d'un test : `66.test.ts`,
`66b.test.ts` et `66c.test.ts` lancent `tsc` dessus et regardent ce qu'il accepte et ce qu'il refuse.

⛔ **CE FICHIER A ANNONCÉ SEPT SONDES EXHAUSTIVES, ET ELLES NE L'ÉTAIENT PAS.** Le tableau et la
prose ci-dessous décrivaient un modèle à **deux axes** — présence de la clé, valeur `null` — et le
§7 du document en concluait qu'il restait *une* case. Mesuré le 2026-08-17 : il en restait **trois**.
L'axe oublié est **`undefined`**, qui sous `exactOptionalPropertyTypes: true` n'est ni `null` ni une
clé absente. Deux des trois cases portaient sur des champs déclarés clos. **La correction de cette
page appartenait au lot 66c, le §7 le disait explicitement ; c'est ce lot qui l'écrit.**

⛔ **HUIT PROJETS DE COMPILATION, ET ILS N'APPARTIENNENT PAS AU MÊME LOT.** `tsconfig.accepte`,
`tsconfig.refuse` et `tsconfig.refuse-neuve` sont les entrées des tests **scellés du 66**, qui sont
clos : **ne rien y ajouter**, ce serait changer ce qu'un test scellé mesure. `tsconfig.refuse-nullable`
et `tsconfig.refuse-origine-nulle` appartiennent au **66b** et ne portent **qu'une sonde chacun** —
le refus que l'un produit ne peut donc venir de rien d'autre. Les trois derniers
(`refuse-origine-absente`, `refuse-origine-indefinie`, `refuse-provenance-indefinie`) sont ceux du
**66c** et suivent la même règle : un fichier, une erreur.

⛔ **UN PROJET PAR SONDE DANS LE 66b, ET C'EST L'INVERSE DU CHOIX DU 66 — pour une raison opposée,
pas par inadvertance.** Le 66 groupe deux sondes parce que son test exige que les DEUX noms
apparaissent dans la sortie. Les tests du 66b lisent le **texte** du diagnostic
(`Type 'null' is not assignable`, `AnimalProvenance` / `AnimalOrigin`) : avec deux sondes dans un
même projet, rien ne garantirait que ces morceaux viennent de la **même** erreur.

⛔ **ILS SONT EXCLUS DE `tsconfig.json` À LA RACINE, ET IL FAUT QUE ÇA RESTE VRAI.** L'un d'eux est
écrit pour **ne pas compiler**. S'il rentrait dans le périmètre de `npm run typecheck`, une des
quatre commandes serait rouge en permanence, et la seule façon de la rendre verte serait de défaire
le lot.

| Fichier | Écrit dans quelle forme | Doit compiler après le lot |
|---|---|---|
| `sonde-vegetal.ts` | la **nouvelle** — un aliment sans aucune source animale | **oui** |
| `sonde-animal.ts` | la **nouvelle** — un aliment animal complet | **oui** |
| `sonde-incoherente.ts` | l'**ancienne** — le champ jumeau `provenanceAnimale`, seul défaut | **non** |
| `sonde-paire-incomplete.ts` | la **nouvelle, amputée** — `{ origine }` sans `provenance` | **non** |
| `sonde-scalaire-nu.ts` | l'**ancienne valeur nue** — `origineAnimale: 'mammifere'` | **non** |
| `sonde-provenance-nulle.ts` | la **nouvelle, à moitié vidée** — `{ origine, provenance: null }` | **non** |
| `sonde-origine-nulle.ts` | la **même, de l'autre côté** — `{ origine: null, provenance }` | **non** |
| `sonde-origine-absente.ts` | l'**amputée symétrique** — `{ provenance }` sans `origine` | **non** |
| `sonde-origine-indefinie.ts` | `{ origine: undefined, provenance }` — **ni nulle, ni absente** | **non** |
| `sonde-provenance-indefinie.ts` | `{ origine, provenance: undefined }` — le jumeau du même axe | **non** |

Les deux premières échouent **aujourd'hui** : elles omettent `provenanceAnimale`, qui est encore un
champ obligatoire. La troisième compile aujourd'hui, et c'est exactement le défaut que le lot ferme.

⛔ **`sonde-incoherente.ts` A ÉTÉ CORRIGÉE APRÈS LE SCEAU, sur décision explicite, et son en-tête
dit pourquoi en entier.** En résumé : elle déclarait deux défauts sur le même objet, et le premier
masquait le second — **TypeScript supprime l'erreur de propriété excédentaire dès qu'une propriété
connue a déjà une erreur de type**. Le test exige que `tsc` NOMME `provenanceAnimale` ; il ne le
nommait jamais. L'assertion n'était satisfaisable que par l'implémentation que `sonde-scalaire-nu.ts`
refuse. Deux tests scellés s'excluaient — ça ne se corrige pas en codant.

⛔ **LES DEUX DERNIÈRES ONT ÉTÉ AJOUTÉES À LA TROISIÈME RELECTURE, et sans elles le lot reposait sur
du vide.** Elles échouent déjà aujourd'hui — elles ne mesurent pas un progrès, elles interdisent une
régression. Ce qui les rend utiles est le cas où elles CESSERAIENT d'échouer : `provenance` rendue
optionnelle, ou le type élargi en `AnimalOrigin | AnimalSource | null`. Ces deux implémentations
passaient les cinq tests précédents, parce que **aucune sonde n'exerçait la forme neuve
incomplète** — seulement l'ancienne forme fausse et les formes neuves entièrement valides.

⛔ **LES DEUX DERNIÈRES ONT ÉTÉ AJOUTÉES PAR LE LOT 66b, ET ELLES FERMENT LA MÊME FAILLE SUR LES DEUX
CHAMPS DE LA PAIRE.** Les cinq autres mesurent toutes la **présence** de la clé `provenance`, jamais
la **valeur** de l'une ni de l'autre — or TypeScript exige une clé requise même quand son type
inclut `null`. Un type `provenance: AnimalProvenance | null` laisse donc les **six tests scellés du
66 verts** pendant que `{ origine: 'mammifere', provenance: null }` redevient écrivable partout.

⛔ **ET LA SEPTIÈME EST LA PLUS INSTRUCTIVE DES DEUX, PARCE QU'ELLE A FAILLI NE PAS EXISTER.** Le
brief du 66b ne portait d'abord que la provenance. Une relecture indépendante a demandé « reste-t-il
une quatrième façon de rouvrir le trou ? » et l'a trouvée en une ligne — **l'autre champ** :
`readonly origine: AnimalOrigin | null`. ⚠️ **Mesuré, pas déduit : les HUIT tests d'alors sont
restés VERTS**, six du 66 et deux du 66b. **Fermer un trou sur un champ ne dit RIEN de son jumeau ;
une paire se teste des DEUX côtés, ou elle n'est testée qu'à moitié.**

⚠️ **Les deux mutations ont été rejouées après l'ajout de la septième sonde**, et chaque moitié est
vue par SON test : origine nullable → seul « ORIGINE NULLE » rouge ; provenance nullable → seul
« PROVENANCE NULLE » rouge ; les six du 66 verts dans les deux cas. `catalog.ts` a été remis à
l'identique après chaque essai (`git diff` vide).

## ⛔ LES TROIS DERNIÈRES — LOT 66c, ET ELLES DISENT QUE CETTE PAGE AVAIT TORT

Le modèle qui a produit les sept premières est **deux champs × deux axes = quatre cases**. Il en
manquait un troisième : **`undefined`**. Sous `exactOptionalPropertyTypes: true`, il n'est ni `null`
ni une clé absente, et **aucune des sept ne l'exerçait**. Six cases, donc :

| # | Champ | Axe | Sonde | Lot |
|---|---|---|---|---|
| 1 | `provenance` | clé absente | `sonde-paire-incomplete.ts` | 66 |
| 2 | `provenance` | valeur `null` | `sonde-provenance-nulle.ts` | 66b |
| 3 | `origine` | valeur `null` | `sonde-origine-nulle.ts` | 66b |
| 4 | `origine` | **clé absente** | `sonde-origine-absente.ts` | **66c** |
| 5 | `origine` | **valeur `undefined`** | `sonde-origine-indefinie.ts` | **66c** |
| 6 | `provenance` | **valeur `undefined`** | `sonde-provenance-indefinie.ts` | **66c** |

⚠️ **Mesuré, jamais déduit — et la diagonale est la preuve.** Sous chacune des trois mutations
(`origine?:`, `origine | undefined`, `provenance | undefined`), les **NEUF tests scellés du 66 et du
66b restent VERTS**, et **une seule** sonde neuve bascule : la sienne. Trois sondes qui
basculeraient ensemble seraient trois copies ; celles-ci se partagent le travail sans se recouvrir.
Tableau complet en `docs/CONCEPTION_INVARIANT_ORIGINE_ANIMALE.md` §8.

⛔ **LA LEÇON, DANS SA FORME LA PLUS CHÈRE : CE N'EST PAS UNE CASE OUBLIÉE, C'EST LE MODÈLE
D'ANALYSE QUI ÉTAIT INCOMPLET.** Le 66 a fermé une case, le 66b deux, chacun en croyant clore le
sujet, et chacun a écrit noir sur blanc qu'il le clôturait. **Une énumération de cas qui se déclare
exhaustive n'est jamais une preuve d'exhaustivité** — seule la mutation en est une. S'il faut ouvrir
un 66d un jour, ce sera parce qu'un axe manque encore ici, et personne ne le trouvera en relisant ce
tableau.

⚠️ **Ne pas les réécrire pour les faire passer.** Ce sont des tests scellés : leur forme EST le
critère de sortie.

## ⚠️ LE STATUT DE CETTE PAGE ELLE-MÊME — question posée à la relecture du 66c, réponse ici

Ce fichier est de la **documentation**, pas une sonde : aucun test ne le lit, aucun `tsc` ne le
compile. Mais il vit sous `tests/scelles/`, donc **`.claude/hooks/garde.mjs` en refuse l'écriture
dès qu'un lot est scellé.** Conséquence pratique, et elle n'est pas théorique — c'est ce qui vient
d'arriver deux fois :

> **Une page qui décrit les sondes se corrige pendant le BRIEF du lot qui la corrige, jamais après
> le sceau.** Le §7 a dû assigner explicitement au 66c la correction d'un paragraphe faux écrit par
> le 66b. Si le 66c avait attendu sa clôture pour le faire, la garde l'aurait refusé et le
> paragraphe faux serait encore là.

⛔ **Le trou par `as` n'est fermé par AUCUNE de ces dix sondes.** Une sonde mesure ce que `tsc`
accepte d'un littéral **honnête** ; une assertion court-circuite le littéral. **Ne pas lire ce
dossier comme une preuve d'étanchéité.**

⚠️ **Ce qui le surveille est ailleurs, et ce n'est pas une sonde** : `66c.test.ts` GÈLE la liste des
**sept** assertions du dépôt capables de fabriquer une paire (`groupes-animaux.test.ts` 3,
`regime.test.ts` 1, `66.test.ts` 3), vérifie que **`as any` reste à zéro** partout, et interdit
toute directive `@ts-ignore` / `@ts-expect-error` **dans ce dossier-ci**. Ce dernier point était une
phrase dans l'en-tête de `66.test.ts` ; il est devenu exécutable le 2026-08-17.

⛔ **NE PAS POSER DE `@ts-expect-error` ICI POUR FAIRE TAIRE UNE SONDE.** Un test l'attrape
désormais. La directive supprimerait le diagnostic que `66.test.ts`, `66b.test.ts` et `66c.test.ts`
LISENT — ils resteraient verts sur un dossier devenu muet, ce qui est le pire des deux mondes :
l'apparence d'une garde, sans la garde.
