# Sondes des lots 66 et 66b — des fichiers dont on mesure la COMPILATION, pas l'exécution

Ces sept fichiers ne sont pas des tests. Ce sont les **entrées** d'un test : `66.test.ts` et
`66b.test.ts` lancent `tsc` dessus et regardent ce qu'il accepte et ce qu'il refuse.

⛔ **CINQ PROJETS DE COMPILATION, ET ILS N'APPARTIENNENT PAS AU MÊME LOT.** `tsconfig.accepte`,
`tsconfig.refuse` et `tsconfig.refuse-neuve` sont les entrées des tests **scellés du 66**, qui sont
clos : **ne rien y ajouter**, ce serait changer ce qu'un test scellé mesure. `tsconfig.refuse-nullable`
et `tsconfig.refuse-origine-nulle` appartiennent au **66b** et ne portent **qu'une sonde chacun** —
le refus que l'un produit ne peut donc venir de rien d'autre.

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

⚠️ **Ne pas les réécrire pour les faire passer.** Ce sont des tests scellés : leur forme EST le
critère de sortie.
