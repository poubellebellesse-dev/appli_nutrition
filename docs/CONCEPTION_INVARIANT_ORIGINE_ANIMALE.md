# Conception — l'invariant « origine animale ⟺ provenance animale », garanti par la forme

> Décision **66** de `ETAT.md` §4, ouverte le 2026-08-10. Brief écrit le 2026-08-13.
> **Un seul lot.** Ce document existe parce que la décision n'en avait aucun : elle vivait
> dans une ligne de tableau, et une ligne de tableau ne porte pas un « Fini quand ».

---

## ✅ 66 — LIVRÉ le 2026-08-14 · commit `ad1ad47` sur `main`

Les six tests scellés sont verts. `Food.origineAnimale` est une paire `{ origine, provenance }` ou
`null` ; `Food.provenanceAnimale` n'existe plus nulle part dans le dépôt. Une origine animale sans
sa provenance ne se compile plus — c'était tout l'objet de la décision.

**Relevé sur l'arbre livré :** `npm test` **2 147 tests, 2 143 passés, 4 rouges** (les quatre
appartiennent au brief en cours de la lane média, `gestes-champ-media.test.ts` — aucun n'est de ce
lot) · `typecheck` propre · `vite build` ✓ · `plan-stress` **20/20** · `audit-mapping`
**451 mappings, 9 candidats** (inchangé).

### Les trois écarts entre ce brief et ce qui a été livré

**① Le §3 avait raison sur la forme et tort sur le coût. Aucun lecteur de production n'a cassé.**
Le brief annonçait quatre lecteurs à reprendre (`groupes-animaux.ts`, `regime.ts`,
`shopping-list.ts`, `aliment.tsx`). **Zéro.** Tous passent par `resolveAnimalOrigin` /
`resolveAnimalProvenance`, jamais par le champ — et `aliment.tsx` ne le lit que pour un test de
nullité, qui survit au changement de type. Le seul lecteur direct du dépôt est
`sourceAnimale` lui-même. **L'encapsulation tenait déjà** ; le lot n'a fait tomber que des fixtures
de test.

**② Un test scellé était insatisfaisable, et ça ne se voyait pas avant d'avoir codé.**
Le 1ᵉʳ test exige que la sortie de `tsc` NOMME `provenanceAnimale`. La sonde portait alors DEUX
défauts sur le même objet — `origineAnimale: 'mammifere'` **et** `provenanceAnimale: null` — et
**TypeScript supprime l'erreur de propriété excédentaire dès qu'une propriété connue a déjà une
erreur de type**. Il ne rapportait donc que `TS2322: Type 'string' is not assignable to type
'AnimalSource'`. L'assertion n'était satisfaisable que par l'implémentation où `origineAnimale`
garde son ancien type, c'est-à-dire celle que `sonde-scalaire-nu.ts` refuse : **deux tests scellés
s'excluaient.** Mesuré sur banc isolé hors du projet :

```
type CHANGÉ    + propriété en trop → TS2322: Type 'string' is not assignable to type 'Paire'
type INCHANGÉ  + propriété en trop → TS2561: ... 'champB' does not exist in type 'Cible'
```

⛔ **Corrigé sur décision explicite de l'utilisateur, sceau levé pour cette seule écriture puis
remis.** La sonde ne déclare plus qu'un défaut ; son en-tête et le README des sondes portent le
raisonnement en entier. **Ce n'était pas rattrapable en codant** — c'est le mode de défaillance que
trois passes de critique sur le brief n'avaient pas pu voir, parce qu'il n'apparaît qu'une fois
l'implémentation écrite.

**③ Trois tests exerçaient volontairement l'incohérence. Ils survivent par cast, pas par hasard.**
`groupes-animaux.test.ts` (origine orpheline, provenance orpheline) et `regime.test.ts` (origine
sans provenance) mesurent une POLARITÉ de repli — en cas d'ignorance, rendre `corps` et `omnivore`
plutôt que `production` et `vegetarien`. Ces fonctions tournent aussi sur des recettes perso, contre
un `user.db` sans clé étrangère vers le catalogue : le garde-fou d'exécution garde son sens, seule
l'écriture accidentelle devient impossible. Les casts sont explicites et commentés à chaque endroit.
**En revanche un garde-fou d'exécution a été SUPPRIMÉ** dans `user-recipe.test.ts` : il levait une
exception sur l'origine sans provenance. Le compilateur fait désormais le même travail plus tôt ; le
commentaire qui reste interdit de le remettre.

---

## 1. Le problème, en une phrase

Un `Food` peut aujourd'hui déclarer **d'où vient l'animal** sans dire **ce qu'on lui prend** —
`origineAnimale: 'mammifere'` sans `provenanceAnimale`. Le type l'accepte. Le catalogue, lui, ne le
contient pas : c'est le build qui refuse, à l'exécution, après coup.

C'est l'acquis n°2 du projet appliqué à l'envers. `requiredFoodIds` vit dans `MealContext` et non
dans `HardConstraints` **pour rendre l'exigence structurellement inexprimable** — « la garantie vient
de la forme ». Ici, la garantie vient d'une vérification. Ce n'est pas la même chose : une
vérification protège **ce catalogue-là**, une forme protège **tous les `Food` qui existeront**.

---

## 2. Ce qui est mesuré, et qui change trois affirmations de la décision 66

Mesures prises le 2026-08-13 sur `catalog.db` réel et sur l'arbre `26d89ce`.

### Le catalogue est sain, et il n'a jamais été le problème

| | |
|---|---|
| aliments | **451** |
| origine animale **déclarée** | **129** |
| provenance animale **déclarée** | **129** |
| paire incohérente **en base** | **0** |
| origine **résolue** non nulle (déclarée + cascade `deriveDe`) | **167** |
| provenance **résolue** non nulle | **167** |
| désaccord entre les deux résolutions | **0** |
| aliments sans aucune source animale | **284** |

⚠️ **Le lot ne corrige AUCUNE donnée.** Il n'y a rien à corriger. Il ferme la possibilité d'écrire
la donnée fausse, ce qui est un travail entièrement différent — et un « Fini quand » qui parlerait
d'aliments corrigés serait un « Fini quand » qui ne peut pas être satisfait.

### ⛔ Le coût annoncé était « ~10 fichiers ». C'est 18, et la répartition est l'information

| | |
|---|---|
| fichiers touchant `origineAnimale` ou `provenanceAnimale` en TypeScript | **18** |
| dont **code de production** | **3** — `engine/domain/catalog.ts`, `data/catalog-loader.ts`, `ui/screens/aliment.tsx` |
| dont **tests et fixtures** | **15** |

✅ **ET C'EST UNE BONNE NOUVELLE, PAS UNE MAUVAISE.** Les **quatre** lecteurs de production passent
tous par `resolveAnimalOrigin` / `resolveAnimalProvenance`, exactement comme le commentaire du type
l'exige :

| Fichier | Ce qu'il en fait |
|---|---|
| `engine/domain/groupes-animaux.ts:104-107` | les 7 groupes animaux |
| `engine/selection/regime.ts:80,100` | l'étiquette de régime d'un aliment |
| `engine/planning/shopping-list.ts:86` | le rayon — `épicerie` ou `crèmerie` |
| `ui/screens/aliment.tsx:232` | la ligne « vient d'un mammifère » de la fiche |

**La discipline « ne jamais lire ce champ seul » tient à 100 % en production.** La fuite est
entièrement dans les tests.

⛔ **CETTE LISTE ÉTAIT FAUSSE DANS LA PREMIÈRE VERSION DU BRIEF, ET UNE RELECTURE INDÉPENDANTE L'A
TROUVÉE.** Elle citait `engine/guards/index.ts` — qui n'a **aucun** rapport avec l'origine animale,
sa seule occurrence du mot « provenance » étant un commentaire sans lien — et **omettait
`shopping-list.ts`**, un vrai lecteur. Un codeur qui aurait suivi cette liste pour vérifier son
travail après coup aurait inspecté un fichier hors sujet et manqué un fichier réel.

Sur les 3 fichiers qui touchent les **champs** eux-mêmes : `catalog.ts` les **déclare**,
`catalog-loader.ts` les **remplit** depuis SQL, `aliment.tsx:245` lit `origineAnimale === null`
directement — non pas par négligence, mais pour distinguer « déclare son origine » de « en hérite
par la cascade », ce qu'aucun résolveur ne dit. Cette lecture-là est légitime et doit survivre.

### ⛔ « Durcir les fabriques ne suffit pas » — confirmé, et voici le cas exact

`engine/planning/shopping-list.test.ts:8` déclare son propre helper :

```ts
function food(id: string, groupe: string, extra: Partial<Food> = {}): Food
```

puis, ligne 211 : `food('lait_entier', 'lait et produits laitiers', { origineAnimale: 'mammifere' })`
— **la paire incohérente, écrite noir sur blanc, dans un test vert.** Aucune fabrique commune n'est
traversée. Un `Partial<Food>` répandu sur un objet de base produira toujours la paire tant que les
deux champs sont indépendants. **C'est ce cas qui rend le lot nécessaire** : c'est le seul endroit
du dépôt où la donnée interdite existe vraiment.

⚠️ Il n'y produit **aucun faux résultat** : ce test porte sur les rayons de la liste de courses,
aucune question de régime n'y est posée. **Le défaut est une bombe non amorcée, pas un bug.** Le lot
se justifie par ce qu'il rend impossible, jamais par ce qu'il répare.

---

## 3. La forme retenue

`Food.origineAnimale` **cesse d'être une valeur et devient la paire**, `Food.provenanceAnimale`
disparaît :

```ts
export interface AnimalSource {
  readonly origine: AnimalOrigin
  readonly provenance: AnimalProvenance
}

// avant : readonly origineAnimale: AnimalOrigin | null
//         readonly provenanceAnimale: AnimalProvenance | null
// après  : readonly origineAnimale: AnimalSource | null
```

**Trois raisons de garder le nom `origineAnimale` plutôt que d'en inventer un.**

1. Le champ change de **type**, donc **tous les lecteurs cassent à la compilation**. C'est l'effet
   recherché : un renommage silencieux qui laisserait `provenanceAnimale` en place quelque part
   serait pire que pas de lot du tout.
2. `sourceAnimale` est **déjà pris** — c'est la fonction qui remonte la chaîne `deriveDe`. Un champ
   `food.sourceAnimale` à côté d'un `sourceAnimale(food, foods)` se lirait mal dans le même fichier.
3. Les documents, les commentaires et `ENGINE_*.md` nomment déjà `origineAnimale`. Le nom survit,
   sa forme change.

**Ce qui NE change pas, et il faut que ce soit explicite :**

- **Le schéma SQL.** `food.origine_animale` et `food.provenance_animale` restent deux colonnes.
  Elles sont vérifiées par le build, et une colonne composite en SQLite n'existe pas.
- **Le YAML du catalogue.** `origine_animale:` et `provenance_animale:` restent deux clés.
- **`catalog/build.mjs`.** Il travaille sur le YAML brut en `snake_case` : ses trois occurrences ne
  sont pas les champs du type. Ses quatre refus (origine sans provenance, provenance sans origine,
  provenance inconnue, origine irrésolue) **restent en place** — la forme ne les remplace pas, elle
  les double d'un côté que le build ne voit pas.
- **Le recollement se fait à UN seul endroit** : `data/catalog-loader.ts`, qui lit les deux colonnes
  et construit la paire ou `null`.

### Deux points d'API, tranchés ici pour que personne n'ait à deviner

**`resolveAnimalOrigin` et `resolveAnimalProvenance` restent DEUX fonctions, avec leur signature
actuelle.** Elles rendent toujours `AnimalOrigin | null` et `AnimalProvenance | null` ; seule leur
implémentation change, de `?.origineAnimale` à `?.origineAnimale?.origine`. **Motif** : leurs quatre
appelants de production lisent chacun UN des deux faits, jamais les deux ensemble — et le
commentaire de `catalog.ts` interdit explicitement de les réécrire séparément, parce qu'elles
partagent leur parcours (`sourceAnimale`) exprès. Fusionner en un `resolveAnimalSource` unique
obligerait les quatre à déballer une paire dont ils n'utilisent qu'une moitié, **pour un gain nul**.

**`AnimalSource` vit dans `engine/domain/catalog.ts`**, juste au-dessus de `interface Food`, à côté
de `AnimalOrigin` et `AnimalProvenance` — et **elle est exportée par le barrel** `engine/domain/index.ts`,
comme les deux types qu'elle assemble. Sans ça, les 15 fichiers de test devraient l'importer depuis
un chemin profond alors qu'ils importent déjà les résolveurs depuis le barrel.

**Les 15 fichiers de test passent par UN helper commun**, `venantDe`, posé dans le même fichier et
exporté par le même barrel :

```ts
export const venantDe = (origine: AnimalOrigin, provenance: AnimalProvenance): AnimalSource =>
  ({ origine, provenance })
```

⛔ **LE NOM `sourceAnimale` EST ÉCARTÉ, ET LA COLLISION EST TRANCHÉE ICI.** `catalog.ts` porte déjà
une fonction privée `sourceAnimale(food, foods)` — celle qui remonte la chaîne `deriveDe`. Elle
**garde son nom** : elle est citée dans les commentaires des deux résolveurs, dans `ETAT.md` §3 et
dans le README des sondes. C'est le helper neuf qui prend un autre nom. **Le codeur ne renomme
rien.**

**Le patron de réécriture, un seul, appliqué partout** :

```ts
// avant
{ origineAnimale: 'mammifere', provenanceAnimale: 'production' }
// après
{ origineAnimale: venantDe('mammifere', 'production') }

// avant — un aliment sans source animale
{ origineAnimale: null, provenanceAnimale: null }
// après
{ origineAnimale: null }
```

⛔ **`data/catalog-loader.ts` PASSE PAR `venantDe` LUI AUSSI.** C'est le seul endroit de production
qui construit la paire, et le §3 ne le disait pas — un codeur pouvait raisonnablement y poser un
littéral. Il n'y a alors **aucune différence de comportement**, et c'est précisément pourquoi il
faut trancher : sans règle, la moitié du dépôt construit la paire d'une façon et l'autre moitié
d'une autre. **Un seul constructeur de la paire dans tout le dépôt** — c'est la même logique que
« la garantie vient de la forme ».

⚠️ **Les fabriques LOCALES des fichiers de test ne changent pas de signature.**
`shopping-list.test.ts:8` garde son `food(id, groupe, extra: Partial<Food>)` : c'est l'objet passé
en `extra` qui change de forme, pas la fabrique. Toucher aux signatures ferait grossir le lot sans
rien garantir de plus.

⚠️ **Sans ce patron, 15 fichiers inventeront 15 façons d'écrire l'objet imbriqué et rien ne le
signalera** — les tests seraient verts, la convention perdue. C'est exactement ce qui rend une
conversion mécanique coûteuse six mois plus tard.

---

## 4. Fini quand

**Fini quand** : construire un `Food` qui déclare une origine animale sans provenance — ou l'inverse
— **ne compile plus**, et le refus est prouvé par une sortie de `tsc` qui **nomme la propriété
manquante** ; un `Food` végétal (aucune source animale) et un `Food` animal complet compilent tous
les deux, sans directive de suppression d'erreur ; `Food.provenanceAnimale` **n'existe plus** dans
le dépôt — aucun `.ts`, `.tsx` ni `.mjs` de `app/src`, `tests` et `catalog` ne porte le nom ; sur
`catalog.db` réel chargé par **le vrai chargeur**, chacun des aliments qui **déclarent** une origine
voit `resolveAnimalOrigin` et `resolveAnimalProvenance` rendre **les valeurs de sa propre ligne
SQL** — pas une constante — et les deux provenances `corps` et `production` survivent toutes les
deux ; les deux résolutions sont non nulles pour **le même nombre** d'aliments, avec **0 désaccord**
et une cascade qui résout encore ; **sur fixture**, un aliment dérivé d'un ancêtre `poisson` /
`corps` rend `poisson` et `corps` ; et les quatre commandes sont vertes, `catalog/build.mjs`
compris, **sans qu'une seule ligne de YAML ni une seule colonne SQL n'ait bougé**.

⛔ **AUCUN TOTAL N'EST SCELLÉ, ET C'EST UNE RÈGLE DU DÉPÔT.** Le relevé du 2026-08-13 dit
451 aliments, 167 résolus, 38 par cascade. Ces nombres sont **affichés** par le test, lisibles dans
la sortie de `npm test`, et **jamais assertés** : quatre tests ont déjà parié sur la taille du
catalogue et un lot de contenu les a cassés. Ce qui est scellé est **l'égalité des deux
résolutions**, pas leur valeur.

### ⛔ Ce que le catalogue réel NE PEUT PAS prouver — mesuré, et c'est la raison d'une fixture

Les **38** aliments dont l'origine vient de la cascade résolvent **tous** `mammifere` /
`production` : ils descendent tous de `lait_entier`. Conséquence directe et désagréable — **une
cascade qui rendrait cette paire EN DUR pour tout aliment dérivé serait juste sur la totalité du
catalogue.** Aucun test contre `catalog.db` ne peut l'attraper : ni ceux de ce lot, ni ceux des
autres, ni un oracle indépendant recalculé en SQL. La donnée elle-même ne discrimine pas.

**Et le trou est double : les 38 chaînes ont TOUTES la longueur 1.** Aucun aliment du catalogue ne
dérive d'un dérivé. Un résolveur qui ne remonterait **qu'un seul maillon** serait donc vert lui
aussi, sur les 451 aliments. La fixture du lot exerce pour cette raison une chaîne à **deux**
maillons — avec un seul, elle ne prouvait rien de plus que le catalogue.

C'est un trou de **donnée**, connu et déjà écrit — `ETAT.md` §3, lot A du chantier régime : « aucune
cascade `deriveDe` du côté carné n'existe dans le catalogue ». Il se fermera au premier dérivé carné
ajouté au catalogue.

⚠️ **C'est la seule raison pour laquelle ce lot s'autorise une fixture**, alors que la règle du
dépôt exige `catalog.db` réel. La règle vise les tests qui redisent ce que la donnée dit déjà ; ici
la donnée est **muette**, et une fixture est le seul moyen d'exercer la branche. La justification
est écrite dans le test lui-même, pas seulement ici.

### Ce qui rendrait ce critère faux — la liste, pour qu'on puisse la vérifier

- **Rendre les deux champs obligatoires.** La paire incohérente ne compilerait plus — et les
  284 aliments végétaux non plus. C'est pourquoi le critère exige qu'un `Food` végétal compile.
- **Rendre le type `any` ou `unknown` quelque part sur le chemin.** Le critère exige que la sortie
  de `tsc` **nomme la propriété**, pas seulement qu'elle soit non vide.
- ⛔ **Rendre `provenance` OPTIONNELLE dans `AnimalSource`** — `{ origine; provenance? }`. C'était le
  trou le plus profond des trois relectures, et il tenait debout : la sonde incohérente reste
  refusée, mais **pour propriété excédentaire** (`provenanceAnimale` n'existe plus), pas pour
  l'invariant. Le premier test passait donc pour une raison qui n'était pas la sienne.
- ⛔ **Élargir le type en `AnimalOrigin | AnimalSource | null` « pour la compatibilité ».** La paire
  complète reste un membre valide, `provenanceAnimale` disparaît bien du dépôt, le catalogue réel ne
  montre rien — et `origineAnimale: 'mammifere'` tout court reste écrivable partout. C'est le
  compromis qu'un codeur pressé de limiter la casse sur les 15 fichiers peut prendre sans le voir.

  ⚠️ **CES DEUX-LÀ FAISAIENT PASSER LES CINQ TESTS SCELLÉS.** Les sondes ne couvraient que
  l'ANCIENNE forme incohérente et les formes neuves ENTIÈREMENT valides ; **aucune n'exerçait la
  forme neuve incomplète.** Deux sondes de plus les ferment — `sonde-paire-incomplete.ts` et
  `sonde-scalaire-nu.ts` — et le test exige que la sortie de `tsc` **nomme les deux fichiers** : si
  une seule des deux formes était refusée, un seul nom apparaîtrait. Vérifié sur banc isolé, les
  deux implémentations fausses compilent, donc les deux sondes cesseraient d'être refusées.
- **Laisser `provenanceAnimale` sur le type « au cas où ».** Le critère exige sa disparition du
  dépôt, mesurable au `grep`.
- **Convertir les 3 fichiers de production et laisser les 15 tests derrière** avec un `as unknown as
  Food`. Le critère exige que les quatre commandes soient vertes, et un `as` traversant ferait
  passer le typecheck — **c'est le trou connu de ce critère**, et la relecture doit chercher les
  `as` ajoutés, pas seulement le vert.
- **Changer les 167 en 166 ou 168** par une conversion qui perd la cascade. Le critère est chiffré
  contre le catalogue réel, et le 38 par dérivation est ce qui garde la cascade honnête.
- ⛔ **Recoller la paire avec une provenance CONSTANTE dans le chargeur** — `{ origine:
  row.origine_animale, provenance: 'production' }`. Le type reste bon, les trois sondes ne voient
  rien (`provenance_animale` est du `snake_case`, il n'apparaît dans aucun grep du champ camelCase),
  et **109 aliments sur 129 changent de sens en silence** : viandes et poissons deviennent des
  produits laitiers, donc végétariens. ⚠️ **La première version du 4ᵉ test scellé ne l'attrapait
  pas** — elle réimplémentait la cascade en SQL au lieu d'appeler les résolveurs, alors que le
  « Fini quand » parle d'eux. Trouvé par une relecture indépendante, avant le sceau. Le test compare
  désormais chaque aliment à **sa** colonne, et vérifie que les deux provenances (`corps`,
  `production`) survivent toutes les deux.
- ⛔ **Casser la cascade `deriveDe` en rendant une paire constante pour tout aliment dérivé.** Le
  catalogue ne peut pas le voir — ses 38 dérivés portent tous la même paire. Le critère exige donc
  une vérification **sur fixture**, seule façon d'exercer un ancêtre autre que `lait_entier`.
  ⚠️ **La première version du 4ᵉ test ne comparait que les 129 déclarants directs** ; les 38 dérivés
  n'étaient confrontés à aucune valeur attendue. Trouvé par une seconde relecture indépendante,
  avant le sceau.

⚠️ **Aucun total d'aliments n'est scellé au-delà de ces trois nombres (451 / 167 / 38).** Un lot de
contenu qui ajoute un aliment animal les fera bouger ensemble, et c'est normal : ce qui est scellé
est **l'égalité des deux résolutions**, pas leur valeur.

---

### Les documents à corriger — hors test, mais dans le lot

Aucun test scellé ne peut vérifier ça sans devenir absurde : `docs/` parle légitimement du champ au
passé. Le lot le fait donc à la main, et `CLAUDE.md` l'exige — « si un document et le code
divergent : corriger le document, et le dire dans le message de commit ».

**Mesuré le 2026-08-13, la liste est courte** : `provenanceAnimale` n'apparaît que dans
`docs/ETAT.md` et dans le présent document. **Ni `ENGINE_*.md`, ni `ARCHITECTURE.md`, ni aucun
`.mjs`, ni aucun `.d.ts` ne le nomment.** Restent les commentaires de `catalog.ts` lignes 227-241,
qui décrivent les deux champs séparément — ceux-là sont dans un `.ts`, donc le 3ᵉ test scellé les
attrape tout seul.

## 5. Ce que le lot ne touche pas

`catalog/**/*.yaml` · le schéma SQL de `food` · `catalog/build.mjs` et ses quatre refus ·
`engine/selection/regime.ts` · `engine/domain/groupes-animaux.ts` · `engine/guards/index.ts` —
ces trois-là passent déjà par les résolveurs et ne doivent pas être réécrits · l'écran, au-delà de
la lecture de `aliment.tsx` · toute la lane média (`atelier/`, `catalog/lexicon`).

## 6. Les témoins d'avant, relevés sur `26d89ce`

```
npm test              → 2 136 passed / 0 failed, 110 fichiers
npm run typecheck     → propre
npx vite build        → ✓ 3,34 s
engine:plan-stress    → 20/20
node catalog/build.mjs → 451 aliments, 330 recettes, 1 548 étapes, 30 équipements
```

⚠️ **`npm test` bougera de +N** : les tests scellés du lot s'ajoutent. Le compte de production, lui,
ne doit **pas** bouger — si un test disparaît, c'est qu'un fichier a été converti en le supprimant.

---

## 7. Lot 66b — fermer le trou que les six tests scellés ne voient pas

## ✅ 66b — LIVRÉ le 2026-08-14 · commit `17b7700` sur `main`

> Ouvert le 2026-08-14, **après** la livraison du 66 (`ad1ad47`), sur une relecture indépendante de
> l'implémentation. **Aucune ligne de code de production ne change.** Ce lot n'achète pas une
> correction : il achète l'impossibilité de défaire la correction en silence.

### Les six points du « Fini quand », un par un — ce qui les démontre, et ce qui ne les démontre pas

| # | Démontré par | Verdict |
|---|---|---|
| 1 | `66b.test.ts` test 1 → `tsconfig.refuse-nullable` → `sonde-provenance-nulle.ts` | ✅ vert |
| 2 | `66b.test.ts` test 2 → `tsconfig.refuse-origine-nulle` → `sonde-origine-nulle.ts` | ✅ vert |
| 3 | `66b.test.ts` test 3 → `tsconfig.accepte` (LU, jamais modifié — il appartient au 66) | ✅ vert |
| 4 | la structure des deux `tsconfig` du lot : `"files"` à un seul élément chacun | ✅ par construction |
| 5 | `66.test.ts` : 6 tests, verts, aucun fichier de ses trois projets touché | ✅ vert |
| 6 | relevé ci-dessous | ✅ hors lane média |

⛔ **CE QUE CE TABLEAU NE DIT PAS, ET QUI COMPTE AUTANT : la preuve par mutation n'est pas dans le
dépôt.** Ce qui établit que ces trois tests DISCRIMINENT — qu'ils deviennent rouges quand le type
se relâche — a été fait **à la main**, deux fois, en cassant `catalog.ts` puis en le remettant. Rien
ne rejouera ça tout seul. C'est le pendant exact du défaut du lot D3 : la moitié d'un critère qui
n'est démontrée par aucun test.

**Le relevé de clôture, arbre complet, pris le 2026-08-14 :** `npm test` → **2 152 tests,
2 146 verts, 6 rouges** (113 fichiers, 39,87 s) · typecheck **0 erreur** · `vite build` **✓ 3,00 s**
· `plan-stress` **20/20**. ⚠️ **Les 6 rouges sont TOUS dans `tests/scelles/gestes-champ-media.test.ts`
(7 tests, 6 rouges), qui appartient à la lane média et non à ce lot.** Aucun rouge n'est imputable au
66b. Le catalogue n'a pas bougé : `audit-mapping` non relancé, sans objet ici.

⚠️ **Écart de compte depuis le relevé du 66 : +5, attribué fichier par fichier et jamais par
déduction** — +3 pour les trois tests d'ici (fichier neuf), +2 pour des tests que la lane média a
ajoutés au sien pendant ce temps. C'est exactement la méthode que le défaut du 2026-08-09 avait
imposée.

### ⛔ CE LOT NE FERME PAS LE SUJET — LA QUATRIÈME VOIE EST OUVERTE, ET MESURÉE

**Le 66b a été attaqué une seconde fois, après sa clôture.** La question posée exprès — « reste-t-il
une quatrième façon de rouvrir le trou ? » — a de nouveau rendu **oui**. Le lot a fermé la
**nullabilité** des deux champs. Il n'a rien fermé sur l'**optionnalité** :

```ts
readonly origine?: AnimalOrigin      // optionnelle, PAS nullable
```

⚠️ **Mesuré dans les deux sens, pas déduit.** Avec ce type : les **NEUF** tests scellés restent
VERTS, et `origineAnimale: { provenance: 'corps' }` — une source animale **sans origine du tout** —
compile (`tsc` exit 0). Type remis à l'identique : la même sonde est refusée
`TS2741: Property 'origine' is missing`, `git diff` vide.

⛔ **POURQUOI PERSONNE NE LA VOIT : `sonde-paire-incomplete.ts` teste « origine seule, provenance
absente » — jamais l'inverse.** La symétrie que ce lot croyait établir ne portait que sur l'axe
*valeur*. Sur l'axe *présence*, la paire n'est testée que d'un côté depuis le lot 66.

⛔ **LA LEÇON, DANS SA FORME COMPLÈTE, ET C'EST LA TROISIÈME FOIS QU'ON LA PAIE : UNE PAIRE A DEUX
CHAMPS ET DEUX AXES — PRÉSENCE ET VALEUR. QUATRE CASES. Le 66 en a fermé une, le 66b deux, il en
reste une.** ▶ Huitième sonde + un projet de compilation : **lot 66c, à briefer**. Ne pas la poser
dans les scellés du 66 ni du 66b, qui sont fermés. Le `README.md` des sondes présente les sept
comme exhaustives — il est scellé lui aussi, sa correction appartient au 66c.

### Le problème, en une phrase

Le lot 66 a rendu la moitié de paire inexprimable en supprimant le champ jumeau et en refusant
l'origine nue. Il reste **une troisième façon de rouvrir exactement le même trou**, un cran plus
bas — et les six tests scellés du 66 la laissent passer :

```ts
readonly provenance: AnimalProvenance | null    // clé REQUISE, valeur NULLABLE
```

### Pourquoi aucune sonde existante ne l'attrape — mesuré, pas supposé

Les cinq sondes du 66 mesurent toutes la **présence** de la clé, jamais sa **valeur**. TypeScript
exige une clé requise même quand son type inclut `null`, donc les trois refus tiennent encore sous
l'hypothèse nullable, et le littéral fautif passe :

```
interface Source { readonly origine: …; readonly provenance: Prov | null }

{ origine: 'mammifere' }                    → TS2741 refusé   (sonde-paire-incomplete : verte)
'mammifere'                                 → TS2322 refusé   (sonde-scalaire-nu      : verte)
{ origine: 'mammifere', provenance: null }  → COMPILE          ← aucune sonde ne l'exerce
```

⛔ **VÉRIFIÉ EN MUTANT LE TYPE LIVRÉ, PAS EN RAISONNANT.** Avec `provenance: AnimalProvenance | null`
posé dans `catalog.ts` : **`tests/scelles/66.test.ts` reste VERT en entier — six tests sur six** —
et `66b.test.ts` devient rouge. Le fichier de production a ensuite été remis à l'identique
(`git diff` vide sur `catalog.ts`). **C'est la seule preuve qui compte** : elle montre à la fois que
le trou est réel et que le nouveau test le voit.

### ⛔ Le brief ne portait qu'une moitié — l'attaque a trouvé la symétrique

**Première version de ce §7 : la provenance seule.** Le critique a demandé « reste-t-il une
quatrième façon de rouvrir le trou ? » et l'a trouvée en une ligne — **l'autre champ de la paire** :

```ts
readonly origine: AnimalOrigin | null    // jamais exercé par aucune sonde
```

⚠️ **Vérifié par mutation avant d'être cru : les HUIT tests d'alors — les six scellés du 66 et les
deux premiers du 66b — sont restés VERTS**, pendant que `{ origine: null, provenance: 'corps' }`
redevenait écrivable partout. Les six sondes exerçaient la clé `provenance` (présence, puis valeur)
et la forme entière ; **aucune n'exerçait la VALEUR de `origine`.**

⛔ **LA LEÇON DÉPASSE CE LOT, ET C'EST LA VRAIE PRISE DE LA JOURNÉE : fermer un trou sur un champ ne
dit RIEN de son jumeau.** Le 66 a fermé la présence, la première version du 66b fermait la valeur
d'un seul côté, et il a fallu qu'on demande explicitement « et l'autre côté ? » pour que la question
se pose. **Une paire de champs se teste des deux côtés, ou elle n'est testée qu'à moitié.**

### **Fini quand**

1. Une sonde écrit `origineAnimale: { origine: 'mammifere', provenance: null }` et **`tsc` la
   refuse**, en nommant le fichier, la valeur rejetée (`Type 'null' is not assignable`) et le type
   qui la rejette (`AnimalProvenance`) — pas seulement en refusant.
2. **La sonde symétrique** écrit `{ origine: null, provenance: 'corps' }` et est refusée de la même
   façon, `AnimalOrigin` nommé.
3. **La paire complète compile toujours**, vérifié dans le même fichier de test : sans cette moitié,
   le critère se satisfait en rendant la paire carrément inexprimable, emportant avec elle tous les
   aliments à source animale.
4. **Chaque sonde a son PROPRE projet de compilation** — l'inverse du choix du 66, pour une raison
   opposée. Le 66 groupe deux sondes parce que son test exige que les deux noms apparaissent ; ici
   les assertions lisent le TEXTE du diagnostic, et deux sondes dans un même projet ne garantiraient
   pas que le fichier, la valeur rejetée et le type qui la rejette viennent de la **même** erreur.
5. Les **six tests scellés du lot 66 restent verts et intouchés**, ainsi que leurs trois projets de
   compilation.
6. Les quatre commandes sont vertes, hors les rouges de la lane média.

### Les deux mutations, rejouées à la main après l'ajout de la sonde symétrique

```
type livré (sain)              → 66 : 6 verts · 66b : 3 verts        (9 au total)
origine    rendue nullable     → 66 : 6 verts · 66b : « ORIGINE NULLE » rouge
provenance rendue nullable     → 66 : 6 verts · 66b : « PROVENANCE NULLE » rouge
```

⚠️ **Chaque moitié est vue par SON test, pas par l'autre** — c'est ce qui distingue « le lot couvre
la paire » de « le lot couvre un cas et l'autre par accident ». `catalog.ts` a été remis à
l'identique après chaque mutation (`git diff` vide).

⚠️ **CE TEST PASSE DÈS LE PREMIER ESSAI, ET C'EST LA SEULE ENTORSE ASSUMÉE À LA RÈGLE DU SCEAU.**
« Un test scellé doit échouer le jour où on l'écrit » vise les tests d'**acceptation** : celui qui
passe avant que le code existe ne prouve rien. Ici il n'y a pas de code à écrire — le type livré est
déjà juste. Un garde-fou de **régression** qui passe tout de suite prouve exactement ce qu'il
annonce. La démonstration qu'il sait échouer est la mutation ci-dessus, pas un rouge de départ.

### Ce que le lot ne touche pas

`tests/scelles/66.test.ts` et ses trois `tsconfig.*.json` — **scellés et clos** · toute la
production, `catalog.ts` compris · le schéma SQL, le YAML, `catalog/build.mjs` · la lane média.

### Les témoins d'avant, relevés sur `685d263`

```
npm test              → 2 147 tests, 2 143 passed / 4 failed, 112 fichiers
                        (les 4 rouges = tests scellés de la lane média, rouges par construction)
npm run typecheck     → propre
npx vite build        → ✓ 2,93 s
engine:plan-stress    → 20/20
```

⚠️ **`npm test` doit monter de +2 exactement**, et le compte de production ne doit pas bouger d'un
test. Le catalogue n'est pas reconstruit : aucun YAML ni schéma n'est touché.

---

## 8. Lot 66c — la case qui restait en cachait deux autres

## ✅ 66c — LIVRÉ le 2026-08-17 · commit `e552ca1` sur `main`

⚠️ **Le commit a été posé le 2026-08-18, le travail et le relevé datent du 17.** La date qui fait
foi pour le lot est celle du relevé ; celle du commit est dans `git log`. Douze fichiers,
826 insertions, **aucune de production**.

⛔ **DEUX MOITIÉS DE CRITÈRE NE SONT PAS TENUES, ET C'EST ÉCRIT ICI PARCE QUE C'EST EXACTEMENT CE
QUI EST ARRIVÉ AU LOT D3** — un « Fini quand » dont la seconde moitié n'était démontrée par rien :

1. **La preuve par mutation n'est pas dans le dépôt** (voir plus bas, encadré rétracté). Les
   tableaux sont réels et invérifiables par un tiers.
2. **Le libellé du test nº 9 est surdit** et n'a pas été corrigé : la décision a été prise, la
   levée de sceau qu'elle exige ne l'a pas été. ▶ `ETAT.md` §8.

> Ouvert le 2026-08-17. **Aucune ligne de code de production ne change** — le type livré est déjà
> juste, et il l'était déjà quand le 66b s'est clos. Ce lot n'achète pas une correction : il achète
> l'impossibilité de la défaire en silence, sur les axes que le 66b croyait avoir couverts.

### ⛔ LE MODÈLE « DEUX CHAMPS × DEUX AXES = QUATRE CASES » ÉTAIT FAUX. IL Y EN A SIX.

Le §7 se clôt sur « le 66 en a fermé une, le 66b deux, il en reste une ». **Mesuré le 2026-08-17,
il en restait trois.** L'axe manquant n'est pas *présence* ni *valeur nulle* : c'est **`undefined`**,
qui sous `exactOptionalPropertyTypes: true` est un type distinct de `null` **et** distinct d'une clé
absente. Trois axes, deux champs, six cases :

| # | Champ | Axe | Sonde | Fermée par |
|---|---|---|---|---|
| 1 | `provenance` | clé absente | `sonde-paire-incomplete.ts` | lot 66 |
| 2 | `provenance` | valeur `null` | `sonde-provenance-nulle.ts` | lot 66b |
| 3 | `origine` | valeur `null` | `sonde-origine-nulle.ts` | lot 66b |
| 4 | **`origine`** | **clé absente** | `sonde-origine-absente.ts` | **66c** |
| 5 | **`origine`** | **valeur `undefined`** | `sonde-origine-indefinie.ts` | **66c** |
| 6 | **`provenance`** | **valeur `undefined`** | `sonde-provenance-indefinie.ts` | **66c** |

⛔ **LES CASES 5 ET 6 N'ÉTAIENT ÉCRITES NULLE PART** — ni dans le §7, ni dans `ETAT.md`, ni dans le
`README.md` des sondes. La case 6 porte sur `provenance`, que les trois documents déclarent close.
**Ce n'est pas une case oubliée par distraction : c'est le modèle d'analyse qui était incomplet.**

### La preuve par mutation, relevée le 2026-08-17 — la diagonale

`accepte` = `tsc` compile le projet. Pour une sonde de refus, `accepte` veut dire **trou ouvert**.

```
mutation de AnimalSource   refuse  neuve  nullable  orig-nulle  ACCEPTE | absente  orig-indéf  prov-indéf
                            (66)   (66)     (66b)     (66b)      (66)   |  (66c)     (66c)       (66c)
type livré (sain)          REFUSE REFUSE   REFUSE    REFUSE     accepte | REFUSE    REFUSE      REFUSE
origine?:                  REFUSE REFUSE   REFUSE    REFUSE     accepte | accepte   REFUSE      REFUSE
origine   | undefined      REFUSE REFUSE   REFUSE    REFUSE     accepte | REFUSE    accepte     REFUSE
provenance | undefined     REFUSE REFUSE   REFUSE    REFUSE     accepte | REFUSE    REFUSE      accepte
```

⛔ **LA COLONNE DE GAUCHE NE BOUGE JAMAIS : les NEUF tests scellés du 66 et du 66b restent VERTS
sous les trois mutations.** Relevé indépendamment par exécution des deux fichiers scellés — 9/9
verts pour chacune des trois. Seul `provenance?:` les fait rougir, et c'est la case 1, déjà close.

### La bijection — la preuve, et elle est plus forte que la diagonale ci-dessus

Le tableau `tsc` dit ce que le compilateur accepte. Celui-ci dit ce que les **tests** voient, et
c'est la seule chose qui protège le dépôt. Les **dix-sept** tests scellés (66 : 6 · 66b : 3 ·
66c : 8) lancés sous chacune des **six** mutations, une par case :

```
type livré (sain)       → 17/17 verts · AUCUN ROUGE
origine?:               → 16/17 verts · ROUGE : 66c « provenance sans origine »
origine    | undefined  → 16/17 verts · ROUGE : 66c « origine undefined »
provenance | undefined  → 16/17 verts · ROUGE : 66c « provenance undefined »
provenance?:            → 16/17 verts · ROUGE : 66  « la paire amputée »
origine    | null       → 16/17 verts · ROUGE : 66b « origine nulle »
provenance | null       → 16/17 verts · ROUGE : 66b « provenance nulle »
```

⚠️ **CE TABLEAU A D'ABORD ÉTÉ ÉCRIT SUR 14, ET C'ÉTAIT LE DÉFAUT QUE `CLAUDE.md` DÉCRIT EN TOUTES
LETTRES** — « un document mis à jour dans le même lot que le code qu'il ne compte pas encore ».
Le lot est passé de 5 à 8 tests quand le gel des assertions a été décidé ; la table est restée à
son dénominateur d'avant. Trouvé par une relecture indépendante, **après le sceau**. Corrigé en
**re-mesurant**, jamais en rectifiant l'arithmétique : la bijection tient, un seul rouge par
mutation, mais ce n'est pas parce qu'on l'a déduit — c'est parce qu'on l'a relancé.

⛔ **SIX MUTATIONS, SIX ROUGES, UN PAR TEST, JAMAIS DEUX.** C'est une bijection, et c'est ce qui
distingue « le lot couvre six cas » de « le lot couvre un cas et cinq par accident ». Aucun test ne
compte sur son voisin pour discriminer — la leçon que `66.test.ts` porte en en-tête depuis le
premier lot. Aucune des trois sondes neuves n'est redondante : chacune est la **seule** garde de sa
case, et sa suppression rouvrirait un trou que rien d'autre ne verrait.

⚠️ **Ce que cette table ne dit pas** : elle couvre les six cases du modèle à trois axes. Elle ne
prouve pas qu'il n'existe pas de quatrième axe — c'est précisément l'erreur que le 66 et le 66b ont
faite tous les deux. Elle prouve que les six connues sont gardées, rien de plus.

⚠️ `catalog.ts` a été remis à l'identique après chaque mutation, `git diff --stat` **vide**, vérifié
par le script lui-même dans un `finally` — pas à la main, pas de confiance accordée à l'opérateur.

### Les diagnostics exacts, lus sur `tsc`, jamais devinés

```
sonde-origine-absente.ts(36,3):     error TS2741: Property 'origine' is missing in type
                                    '{ provenance: "production"; }' but required in type 'AnimalSource'.
sonde-origine-indefinie.ts(38,21):  error TS2322: Type 'undefined' is not assignable to type 'AnimalOrigin'.
sonde-provenance-indefinie.ts(37,43): error TS2322: Type 'undefined' is not assignable to type 'AnimalProvenance'.
```

### **Fini quand**

1. `origineAnimale: { provenance: 'production' }` — **une source animale sans aucune origine** — est
   refusée par `tsc`, et le refus nomme le fichier de la sonde, le code **`TS2741`** et la propriété
   **`origine`**. Pas seulement « refusé » : le texte du diagnostic est lu.
2. `{ origine: undefined, provenance: 'production' }` est refusée, et le refus nomme le fichier, le
   code **`TS2322`**, la valeur rejetée (`Type 'undefined' is not assignable`) et le type qui la
   rejette (**`AnimalOrigin`**).
3. `{ origine: 'mammifere', provenance: undefined }` est refusée de la même façon, **`AnimalProvenance`**
   nommé. Sans cette moitié, le lot fermerait `origine` des deux côtés en laissant son jumeau ouvert
   sur l'axe neuf — exactement la faute que le §7 dit avoir payée trois fois.
4. **Chacun des trois refus est le SEUL diagnostic de son projet** : `tsc` sort exactement une ligne
   `error TS`. Sans ce point, une faute de frappe, un import cassé ou un `any` sur le chemin
   refuseraient aussi — et le test resterait vert le trou grand ouvert.
5. **La paire complète compile toujours**, vérifié dans le même fichier via `tsconfig.accepte.json`,
   qui appartient au 66 et n'est que LU. Sans cette moitié, le critère se satisfait en rendant la
   paire carrément inexprimable, emportant tous les aliments à source animale.
6. **`tsconfig.json` à la racine exclut toujours `tests/scelles/sondes-66`**, vérifié en lisant le
   fichier. Le lot fait passer ce dossier de 2 à 5 fichiers qui ne compilent pas volontairement : si
   l'exclusion saute, `npm run typecheck` devient rouge en permanence et la seule façon de le
   reverdir est de défaire le lot.
7. Les **neuf tests scellés du 66 et du 66b restent verts et intouchés**, ainsi que leurs cinq
   projets de compilation. ⚠️ **Ce point n'est PAS auto-porté par `66c.test.ts`** : rien dans ce
   fichier ne lance ses deux voisins. Il se démontre par le run complet, et par lui seul.
8. **La liste des SEPT assertions capables de fabriquer une paire est GELÉE**, par fichier et par
   nombre : `groupes-animaux.test.ts` 3, `regime.test.ts` 1, `66.test.ts` 3. Une huitième fait
   rougir. ⚠️ **Sans numéros de ligne, délibérément** : les geler rendrait le test rouge au premier
   commentaire ajouté au-dessus, et un test qui crie pour rien finit désarmé.
9. **`as any` reste à ZÉRO dans tout le dépôt** — relevé à la commande, le dépôt n'en contient
   aucun. Il contournerait les six cases d'un coup ; il se garde sans liste blanche à maintenir.
10. **Aucune directive `@ts-ignore` / `@ts-expect-error` dans `sondes-66/`.** Elle supprimerait le
    diagnostic que les tests lisent, et ils resteraient verts sur un dossier devenu muet. Le lot 66
    le demandait **en prose** dans son en-tête ; ce point le rend exécutable.
11. `npm test` rend **2 212 passed / 0 failed**, typecheck propre, `vite build` ✓, `plan-stress`
   20/20. ⚠️ **Écrit en chiffres exprès** : « les quatre commandes sont vertes » n'a de sens que
   rapporté à une convention externe — le 66 et le 66b devaient tous deux excepter les rouges de la
   lane média. Cette lane est éteinte depuis le 2026-08-16, donc **ici zéro rouge, sans exception à
   accorder**. Un lecteur du seul §8 n'a rien à aller chercher ailleurs.

### ⚠️ CE TEST PASSE DÈS LE PREMIER ESSAI — même entorse assumée qu'au 66b, même raison

« Un test scellé doit échouer le jour où on l'écrit » vise les tests d'**acceptation** : celui qui
passe avant que le code existe ne prouve rien. Ici il n'y a **pas de code à écrire**. Ce qu'on pose
est un garde-fou de **régression**, et sa démonstration qu'il sait échouer est la diagonale
ci-dessus, pas un rouge de départ.

⛔ **ET LA PREUVE PAR MUTATION N'EST TOUJOURS PAS DANS LE DÉPÔT — LE 66c REPRODUIT LE DÉFAUT DU 66b
AU LIEU DE LE CORRIGER.** Une première version de ce paragraphe annonçait le contraire : « cette
fois la mutation est scriptée et rejouable ». **C'était faux, et c'est une relecture indépendante
qui l'a relevé, après le sceau.** Les scripts existent — ils ont produit tous les tableaux
ci-dessus — mais ils vivent dans un **répertoire temporaire de session**, hors du dépôt, et ils
disparaîtront avec elle. Conséquence, écrite sans l'adoucir :

> **Personne d'autre que la session qui les a écrits ne peut rejouer ces chiffres.** Les tableaux
> `tsc`, la bijection et le relevé de discrimination sont des mesures réelles, prises et restaurées
> proprement — mais **invérifiables par un tiers**. Exactement le reproche que le §7 s'adressait à
> lui-même, mot pour mot, un lot plus tôt.

▶ Le rendre vrai demanderait de poser ces scripts **dans** le dépôt — hors de `tests/scelles/`, qui
est scellé, et hors des quatre commandes, qu'ils ne doivent pas ralentir. **Ce n'est pas fait, ce
n'est pas décidé, et ça ne doit pas être présenté comme acquis.**

### ⛔ CE QUE CE LOT NE FERME PAS — écrit ici pour qu'un lecteur du seul §8 ne croie pas le type étanche

Le brief a été attaqué avant d'être scellé. L'attaque **n'a trouvé aucune implémentation fausse**
qui rouvrirait le trou en laissant les 14 tests verts — six élargissements de plus ont été mutés
pour vérifier, au-delà des six cases :

```
AnimalSource | { origine }         →  7/14 verts · trou fermé
Partial<AnimalSource> sur le champ → 12/14 verts · TROU OUVERT, vu par 2 tests
signature d'index [k: string]      → 14/14 verts · trou fermé (rien à garder)
readonly retiré                    → 14/14 verts · trou fermé
AnimalSource | AnimalOrigin        →  7/14 verts · trou fermé
champ en `any`                     →  8/14 verts · TROU OUVERT, vu par 6 tests
```

⚠️ **`readonly` retiré ne rouvre PAS cet invariant — mesuré, pas supposé.** La relecture le
soupçonnait d'ouvrir une « dérive temporelle » ; le champ garde son type strict, `delete` est refusé
sur une propriété requise, et une réaffectation ne peut produire qu'une autre valeur **valide**.
`readonly` protège l'immuabilité, pas la paire. C'est une autre propriété, et aucun lot ne la garde.

⛔ **MAIS LE TROU PAR `as` RESTE GRAND OUVERT, ET IL N'EST PAS THÉORIQUE.** Le §4 le nomme « le trou
connu de ce critère » ; le §8 doit le redire, parce que **le dépôt en contient quatre occurrences
vivantes aujourd'hui**, relevées à la commande :

```
app/src/engine/domain/groupes-animaux.test.ts:72   { provenance: 'corps' } as unknown as AnimalSource
app/src/engine/domain/groupes-animaux.test.ts:122  { origine: 'mammifere' } as AnimalSource
app/src/engine/domain/groupes-animaux.test.ts:123  { origine: 'volaille' }  as AnimalSource
app/src/engine/selection/regime.test.ts:227        { origine: 'mammifere' } as AnimalSource
```

La première est **exactement la case 4** que `sonde-origine-absente.ts` rend inexprimable. Elle est
écrite, elle compile, et elle est légitime : ces tests vérifient que la résolution encaisse une
paire cassée. **Le type garantit la forme pour le code honnête ; il ne garantit rien contre une
assertion.**

✅ **DÉCISION PRISE LE 2026-08-17 PAR L'AUTEUR : la liste est GELÉE**, points 8 à 10 du « Fini
quand ». Le lot ne condamne pas ces sept assertions — elles sont légitimes — il les **compte**, pour
que la huitième soit une décision et non une découverte trois lots plus tard. Deux gardes gratuites
sont venues avec, l'inventaire ayant montré qu'elles ne coûtaient aucune liste blanche : **`as any`
à zéro dans tout le dépôt**, et **aucune directive de suppression dans `sondes-66/`**.

### ⚠️ Ce que le gel a appris en étant vérifié — deux défauts trouvés en le mesurant, pas en le relisant

1. **Le scanner s'est attrapé lui-même.** Les motifs surveillés apparaissent dans les titres et les
   messages d'erreur de `66c.test.ts` : `sansCommentaires` retire les commentaires, pas les chaînes.
   `66c.test.ts` s'exclut donc **nommément** — un seul chemin, un fichier scellé donc figé. Retirer
   aussi les chaînes aurait demandé de gérer `'`, `"`, les gabarits et les échappements, et **un
   bug là-dedans produit un faux négatif**, c'est-à-dire une assertion réelle rendue invisible. Un
   trou d'un fichier nommé vaut mieux qu'un trou silencieux de taille inconnue.
2. ⛔ **LE TEST DES DIRECTIVES ÉTAIT INCAPABLE DE ROUGIR, ET IL A FALLU LE PROUVER POUR LE VOIR.**
   Écrit sur la source nettoyée, il cherchait `@ts-expect-error` — qui vit **toujours** dans un
   commentaire, donc effacé avant d'être cherché. Vert par construction, pour toujours. **Un test
   qui ne peut pas échouer est pire qu'un test absent : il occupe la place d'une garde.** Corrigé
   par un drapeau qui lit aussi les commentaires. ▶ Relevé de discrimination, les trois gels :

```
aucun intrus (témoin)            → 8/8 verts · AUCUN ROUGE
8ᵉ assertion `as AnimalSource`   → 7/8 verts · ROUGE : le gel des sept
un `as any`                      → 7/8 verts · ROUGE : `as any` à zéro
une directive dans une sonde     → 7/8 verts · ROUGE : pas de bâillon
```

⚠️ **Ce que le gel ne couvre PAS**, et il faut que ce soit écrit sous peine de répéter la faute de
ce lot : `satisfies`, une interface étendue localement, un `JSON.parse` non typé, et le canal
parallèle ci-dessous. **Une énumération qui se déclare exhaustive n'est jamais une preuve
d'exhaustivité.**

⚠️ **Deuxième limite, du même genre** : rien n'interdit qu'un futur champ de `Food` reporte
l'information animale **à côté** de `origineAnimale`. Un canal parallèle contournerait les six
cases sans en toucher aucune. Non testé, non testable à peu de frais, nommé ici pour ne pas être
redécouvert au lot suivant.

⛔ **TROISIÈME LIMITE, ET ELLE CONTREDIT LE LIBELLÉ D'UN TEST SCELLÉ.** Le test nº 6 s'intitule
« `as any` reste à zéro **dans tout le dépôt** ». C'est **surdit** : `scannerMotif` ne parcourt que
`app/src`, `catalog` et `tests`. En sont absents `atelier/`, `vite.config.ts`, `vitest.config.ts`,
`.claude/*.mjs` et la racine — les trois gardes du gel (assertions, `as any`, directives) n'y voient
rien. ⚠️ **Sans effet aujourd'hui, vérifié à la commande** : aucune **source** hors de ces trois
racines ne mentionne `AnimalSource` ni `origineAnimale`, et aucun `as any` n'existe où que ce soit.
Les deux seules occurrences hors périmètre sont dans `app/dist/` et `dist/` — du **code généré par
le build**, pas des sources, et régénéré à chaque `vite build`. Mais le libellé promet plus que le
code ne tient.

✅ **LIBELLÉ REQUALIFIÉ LE 2026-08-18, SUR DÉCISION DE L'AUTEUR — le titre nomme désormais les trois
racines.** La session ne l'avait pas fait d'elle-même : la règle du dépôt veut qu'un test scellé qui
paraît faux se signale et arrête le travail, il ne se corrige pas et ne se double pas d'un second
test. **La décision appartenait à l'auteur, et elle a été prise deux fois.**

⚠️ **SEULS LE TITRE ET LE MESSAGE ONT CHANGÉ.** Assertion, motif et racines scannées sont identiques
au caractère près, et le relevé de discrimination a été **rejoué à l'identique** après la
requalification — les trois gardes rougissent toujours sur leur propre intrus, 7/8 à chaque fois.
On a corrigé un mensonge, pas une mesure.

⛔ **CE QUE ÇA NE RÉPARE PAS : la couverture.** Élargir les racines reste à faire et serait un autre
lot. ⛔ **Et la leçon dépasse ce test : UN INTITULÉ FAIT PARTIE DE CE QU'UN TEST AFFIRME.** Celui-ci
mesurait juste et se décrivait faux ; une suite verte ne l'aurait jamais dit. Seule une relecture
qui lit les titres l'a vu.

### Ce que le lot ne touche pas

`tests/scelles/66.test.ts`, `66b.test.ts` et leurs cinq `tsconfig.*.json` — **scellés et clos** ·
les sept sondes existantes · toute la production, `catalog.ts` compris · le schéma SQL, le YAML,
`catalog/build.mjs` · le catalogue, qui n'est pas reconstruit · la lane média · la lane photo.
**Seul écrit hors fichiers neufs : le `README.md` des sondes**, dont le tableau annonce sept sondes
exhaustives — le §7 assigne explicitement sa correction à ce lot.

### Les témoins, relevés sur `f5fb7ea` — arbre complet, sortie réelle

```
npm test              → 2 212 passed / 0 failed  (2 212 tests, 118 fichiers) en 42,55 s
npm run typecheck     → propre
npx vite build        → ✓ 2,76 s
engine:plan-stress    → 20/20
```

⛔ **LA BASE DOCUMENTÉE ÉTAIT PÉRIMÉE DE TROIS LOTS, ET IL A FALLU L'ATTRIBUER AVANT DE CONCLURE.**
`CLAUDE.md` et `FICHE_REPRISE.md` annonçaient **2 156 / 114**, relevé sur `de2ba39`. L'écart brut
était donc de **+53**, très au-dessus des +5 attendus — exactement le symptôme que le dépôt traite
comme un signal. Attribué par `git diff --name-only de2ba39..HEAD`, jamais par déduction :

| Fichier | Tests | Fichiers | Lot |
|---|---|---|---|
| `tests/scelles/gestes-hors-ligne.test.ts` | +11 | +1 | geste 4 (`00f8e38`) |
| `tests/scelles/photo-affichage.test.ts` | +7 | +1 | merge lot photo 1 (`147a45b`) |
| `tests/scelles/photo-fiche-detail.test.tsx` | +23 | +1 | lot photo 3 (`77ca4dc`) |
| `echelle-typo` · `aujourdhui` · `savoir` (modifiés) | +7 | — | mêmes lots |
| **`tests/scelles/66c.test.ts`** | **+8** | **+1** | **ce lot** |
| | **= 2 212** | **= 118** | |

✅ **Le compte tombe juste au test près et au fichier près. Aucune anomalie** — ce n'est pas le
défaut du 2026-08-08 qui reviendrait, c'est une base de référence qui n'avait pas suivi trois
livraisons. ⚠️ **La base à citer désormais est 2 204 / 117 avant ce lot**, pas 2 156 / 114.

⚠️ Le compte de production ne bouge pas d'un test : le lot n'ajoute que des fichiers scellés. Le
catalogue n'est pas reconstruit — `audit-mapping` est sans objet ici.
