# Conception — l'invariant « origine animale ⟺ provenance animale », garanti par la forme

> Décision **66** de `ETAT.md` §4, ouverte le 2026-08-10. Brief écrit le 2026-08-13.
> **Un seul lot.** Ce document existe parce que la décision n'en avait aucun : elle vivait
> dans une ligne de tableau, et une ligne de tableau ne porte pas un « Fini quand ».

---

## ✅ 66 — LIVRÉ le 2026-08-14 · 15 fichiers · commit `<à écrire au commit>`

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
