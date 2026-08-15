# Session 2026-08-14 — l'invariant origine/provenance, et la case qui reste

> ⛔ **INSTANTANÉ DATÉ. NE JAMAIS RÉÉCRIRE, NE JAMAIS CITER COMME ÉTAT.**
> L'état vivant est dans `docs/ETAT.md`. Ce fichier raconte ce qui s'est passé ce jour-là et
> pourquoi ; il sera faux dès le lendemain, et c'est normal.
>
> Arbre au moment de l'écriture : `main`, commits `ad1ad47` (lot 66) puis `17b7700` (lot 66b).

## Ce qui a été livré

**Deux lots, une seule question :** peut-on encore décrire un aliment comme venant d'un animal
sans dire de quel animal, ou sans dire si on lui prend son corps ou sa production ?

- **Lot 66 (`ad1ad47`)** — la paire devient obligatoire *par la forme du type*.
  `Food.provenanceAnimale` disparaît ; `Food.origineAnimale` vaut désormais
  `{ origine, provenance }` ou `null`, jamais une moitié. Un seul constructeur dans tout le dépôt,
  production comprise. 15 fichiers, dont 12 fichiers de test convertis.
- **Lot 66b (`17b7700`)** — **aucune ligne de code de production.** Deux sondes de compilation,
  deux projets `tsc`, trois tests scellés. Le lot n'achète pas une correction : il achète
  l'impossibilité de défaire celle du 66 en silence.

## ⛔ LA LEÇON DE LA SESSION, ET ELLE A COÛTÉ TROIS RELECTURES

**Une paire de champs n'a pas deux cas de défaillance, elle en a QUATRE : deux champs × deux façons
de les vider (clé absente, valeur nulle).**

| | `origine` | `provenance` |
|---|---|---|
| **clé absente** (`?:`) | ⛔ **OUVERT** — lot 66c | ✅ fermé (lot 66) |
| **valeur nulle** (`\| null`) | ✅ fermé (lot 66b) | ✅ fermé (lot 66b) |

Chacune des trois cases fermées l'a été **après** qu'une relecture indépendante a demandé
« reste-t-il une autre façon ? ». Aucune n'a été trouvée en écrivant le lot. Le brief du 66b, en
particulier, ne portait qu'une seule case et se croyait complet.

⚠️ **La formule intermédiaire — « fermer un trou sur un champ ne dit rien de son jumeau » — était
elle-même trop courte.** Elle ne parlait que de l'axe *valeur*. C'est en la réutilisant qu'on a
manqué l'axe *présence*. Une leçon écrite trop étroitement se retourne contre celui qui l'applique.

## ⚠️ LA MÉTHODE QUI A TOUT TROUVÉ : LA PREUVE PAR MUTATION

Aucun de ces trous n'a été trouvé en lisant du code. Tous l'ont été en **cassant le type exprès et
en regardant si un test s'allumait**.

```
mutation posée   → les tests scellés d'alors : TOUS VERTS
sonde du trou    → tsc exit 0, le littéral interdit COMPILE
type remis       → sonde refusée, git diff sur catalog.ts VIDE
```

⛔ **CE QUI EST UNE DETTE, ET ELLE EST INSCRITE EN `ETAT.md` §8 : RIEN NE REJOUE ÇA TOUT SEUL.**
Les trois tests du 66b passent au premier essai — c'est assumé, ce sont des garde-fous de
régression et non des tests d'acceptation. Mais alors la règle « un test scellé doit échouer le jour
où on l'écrit » ne les filtre plus, et **seule la mutation manuelle distingue un vrai verrou d'une
assertion décorative.** C'est le même défaut que le lot D3 : la moitié d'un critère que rien ne
démontre. Deuxième fois. Ne pas le découvrir une troisième.

## Ce qui a été payé en chemin

- **Un test scellé insatisfaisable, et la règle a tenu.** Le premier test du 66 exigeait que `tsc`
  nomme le champ disparu. Il ne le nommait jamais : **TypeScript supprime l'erreur de propriété
  excédentaire dès qu'une propriété connue a déjà une erreur de type**. Deux tests scellés
  s'excluaient — ça ne se corrige pas en codant. Arrêt, exposé des deux options, décision de
  l'utilisateur, sceau levé puis remis. **La règle « si un scellé te paraît faux, tu t'arrêtes » a
  fait exactement son travail.**
- **Le brief du 66 se trompait sur l'ampleur.** Il annonçait quatre lecteurs de production à
  réparer ; **aucun n'a cassé** — ils passent tous par les résolveurs. L'encapsulation tenait déjà.
  Seules des fixtures de test sont tombées.
- **Un `git checkout --` refusé par la garde locale**, pendant une révision de mutation. Non
  contourné : révision à la main, puis `git diff` vérifié vide.

## Ménage fait ce jour-là

Deux alertes ont été **retirées de `CLAUDE.md`** parce qu'elles annonçaient un défaut qui n'existe
plus. Elles sont conservées ici, et nulle part ailleurs :

- **Le plancher « végétalien + sans gluten »** est passé de **27/28 à 28/28 accompagnements**,
  plancher **1 302 → 1 530 kcal** (lot « 8 plats végétaliens sans gluten »). ⚠️ **La cause mesurée
  n'était pas « il manque 1 plat » mais MARGE ZÉRO** : le catalogue portait exactement 28 plats
  végétaliens ET sans gluten utilisables au déjeuner ou au dîner, pour exactement 28 créneaux — une
  seule exclusion par une autre contrainte suffisait à vider un créneau. Ils sont **36**. **C'est la
  leçon qui survit : un banc qui passe de justesse ne passe pas, il attend.**
- **Les 2 échecs d'`aujourdhui.test.tsx`** sont fermés depuis `70e2493` — quatre tests pariaient sur
  la taille du catalogue, un lot de contenu les a cassés. ⚠️ **La mention « 2 failed » a survécu
  deux jours de plus que le défaut lui-même** ; c'est pour ça qu'on la retire d'un document vivant.

## Le relevé du jour — arbre `17b7700`, pris deux fois à 40 min d'intervalle, comptes identiques

```
npm test           Test Files  1 failed | 112 passed (113)
                   Tests       6 failed | 2146 passed (2152)      ~41 s
npm run typecheck  0 erreur
npx vite build     ✓ built in 2,95 s
engine:plan-stress 20/20 configurations saines
audit-mapping      451 mappings, 9 candidats (non relancé : le catalogue n'a pas bougé)
```

⛔ **Les 6 rouges sont TOUS dans `tests/scelles/gestes-champ-media.test.ts`** (7 tests, 6 rouges) —
lane média, tests scellés écrits avant leur code, donc rouges par construction. **Aucun n'est
imputable aux lots 66/66b.**

⚠️ **Écart 2 147 → 2 152, attribué fichier par fichier et jamais par déduction** : +3 pour le
fichier neuf du 66b, +2 ajoutés au sien par la lane média pendant la session. C'est la méthode que
le défaut du 2026-08-09 avait imposée — trois sessions dans le même arbre, chacune voyant l'écart
depuis SON relevé et l'imputant par défaut à sa voisine.

## Verdicts des relectures indépendantes

Trois passes de critique, aucune adoucie. **Verdict final : FRAGILE** — non pas parce que ce qui est
livré serait faux (les deux mutations que le 66b annonce fermer le sont réellement, vérifiées par
exécution directe de `tsc`), mais parce que **la quatrième case reste ouverte et que la preuve par
mutation n'est pas automatisée.**

## ▶ Ce qui reste sur ce sujet

**Lot 66c, à briefer** : une huitième sonde (`{ provenance }` sans `origine`) et un projet de
compilation de plus. ⚠️ Ni la sonde ni la correction du `README.md` des sondes ne peuvent être
écrites dans les scellés du 66 ou du 66b, qui sont fermés — **le 66c ajoute à côté**.
▶ Détail, mesures et dette : `docs/ETAT.md` §8 et
`docs/CONCEPTION_INVARIANT_ORIGINE_ANIMALE.md` §7.
