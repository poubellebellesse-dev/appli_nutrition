# Sondes du lot 66 — des fichiers dont on mesure la COMPILATION, pas l'exécution

Ces trois fichiers ne sont pas des tests. Ce sont les **entrées** d'un test : `66.test.ts` lance
`tsc` dessus et regarde ce qu'il accepte et ce qu'il refuse.

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

⚠️ **Ne pas les réécrire pour les faire passer.** Ce sont des tests scellés : leur forme EST le
critère de sortie.
