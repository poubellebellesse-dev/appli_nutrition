# Récap de session — 2026-08-14/15 · lane média : licences, maquettes, brief `gestes-champ-media`

> ⛔ **Instantané daté. Ne jamais réécrire, ne jamais citer comme état.** L'état vit dans
> `ETAT.md`, la prochaine étape dans `FICHE_REPRISE.md`, le plan du chantier dans
> `CONCEPTION_GESTES_ILLUSTRES.md`. Cette page dit ce qui s'est passé et **ce qui était faux**.

## 0. En une phrase

La lane média a fermé la question des licences vidéo, tranché trois décisions de chantier, maquetté
l'interface avec les vrais clips, et posé le brief du premier lot — **sept tests scellés, six
rouges, aucune ligne de code de production écrite.**

---

## 1. Les licences vidéo — la question est fermée, et la réponse n'est pas celle qu'on espérait

Deux documents neufs, sous `docs/reference/courriers/` :

- **`SOURCES_VIDEO.md`** — sept sources gratuites examinées. Wikimedia Commons : 137 fichiers,
  2 vidéos, aucun gros plan. Openverse : pas de vidéo. YouTube CC BY : les conditions de la
  plateforme interdisent le téléchargement, quelle que soit la licence du clip. Dareful : CC BY 4.0,
  **zéro vidéo de cuisine** (« we don't have "food" videos (yet) »). Coverr : **aucune clause
  "standalone"**, mais volume de cuisine non compté. Mixkit : interdit.
  ⚠️ **Sept sous-catégories de Commons n'ont PAS été comptées** — la garde locale a refusé la
  requête, et je ne l'ai pas contournée.
- **`SOURCES_PAYANTES.md`** — deux axes : la perpétuité après résiliation, et le droit d'embarquer.
  ⛔ **Conclusion mesurée, contre-intuitive : payer rend la position PIRE.** Sept licences lues,
  toutes avec des clauses anti-extraction **plus explicites** que celle de Pexels. VideoHive en
  ajoute une en licence Étendue (« must not permit an end user of the End Product to extract the
  Item »). iStock Étendue lève la revente, **pas** l'extraction.
  ▶ **La seule issue qui supprime la clause est le tournage sur commande.**

**Ce qui a été décidé** : on embarque quand même (décision 69, fermée le 2026-08-14). Risque accepté
en connaissance de cause, contrepartie tenue le jour même — aucun bouton télécharger, exporter,
partager ou enregistrer, aucune galerie.

## 2. ⛔ Ce que j'ai eu FAUX, et qu'il ne faut pas recopier

Trois erreurs, dont une structurelle.

1. **J'ai promu ma propre proposition en contrainte.** En enregistrant la décision 69, j'ai écrit
   qu'elle exigeait « aucune adresse directe vers un média ». **Personne n'avait décidé ça.** J'ai
   ensuite relu ma propre phrase, constaté que l'appli ne la respectait pas, et ouvert une dette —
   pour un problème que j'avais fabriqué. Trois vérifications l'ont démolie : elle contredit
   `ARCHITECTURE.md` §7.1 et §3, elle ne protège rien, et le conteneur qu'elle imposait rendrait
   l'extraction en masse **plus facile** (une requête SQL). Dette annulée le jour de son ouverture.
   ▶ Règle qui en sort, écrite en mémoire : **une piste que je propose ne devient pas une contrainte
   du projet.**
2. **J'ai annoncé « Coverr très probablement interdit » sans avoir lu la page.** Corrigé dans
   `LISEZMOI.md` et `SOURCES_PHOTOS.md`, correction laissée visible plutôt que supprimée.
3. **J'ai cité `requiredFoodIds` / `MealContext` comme preuve que « la garantie vient de la
   forme » marche.** Le test du dépôt lui-même (`tests/engine-boundaries.test.ts:180-188`) dit que
   cette affirmation était fausse pour le P4 du lot D1, et marque `requiredFoodIds` comme
   l'**exception**. La décision 70 a été reformulée.
4. **J'ai accusé la garde de garder en mémoire des fichiers d'un lot fermé.** Faux : elle les efface
   bien (`garde.mjs`, branche `fin`). Un lot `66b` était simplement ouvert.

## 3. Les décisions du chantier

| | Sujet | Sortie |
|---|---|---|
| D2 | un format vidéo ou deux ? | ✅ **les deux** — AV1 puis repli H.264, 22,43 Mo assumés |
| D4 | binaires dans git ? | ✅ **oui**, comme les photos — irréversible, +22,43 Mo d'historique |
| D3 | un poster par geste ou par segment ? | ⛔ **fermée sans être tranchée** — D6 l'a rendue sans objet |
| D6 | comment un geste s'affiche | ✅ **variante D + vignettes de C** |
| D1 | budget P6 | ouverte (c'est la décision 68) |
| D5 | combien de gestes au premier passage | ouverte, non bloquante — 51/62 |

**D6 s'est tranchée sur des maquettes, pas sur une description.** Quatre mises en page construites
avec les **vrais clips encodés** :
[maquettes](https://claude.ai/code/artifact/f2cf92ae-eb53-47a3-a6fc-3e4623986277).

⚠️ **Le coût de la variante C a été nommé avant le choix et accepté** : les 11 gestes sans clip
auront un carré vide dans la liste, en permanence. **Ce n'est pas une dette.**

## 4. Deux trous trouvés en fabriquant les maquettes, que le cadrage avait ratés

1. ⛔ **`suer` n'a pas de clip.** C'est le geste qui justifiait le chantier tout entier — « faire
   suer » contre « faire revenir », que seul le déroulement dans le temps sépare. Son dossier porte
   24 images candidates et **zéro segment encodé**. À la fin des quatre lots, **la paire ne sera
   toujours pas montrable** : seul « revenir » aura son clip. Ça n'enlève rien à l'utilité du
   chantier, mais ça change ce qu'on pourra en dire.
2. **14 codes du lexique ne tombent pas sur le nom du dossier de clips.** Trois se rattrapent par un
   tiret (`bain-marie`/`bain_marie`, `monter-blancs`, `tailler-des`), **onze sont de vrais manques**.
   C'est le lot 2 qui paiera.

**Chiffres relevés à la main sur le bac** (`G:\Claude\Dessinateur\gestes\videos`) : 98 segments pour
51 gestes — **22 gestes à 1 segment, 11 à 2, 18 à 3**. Noms de moments : **29 `debut`, 23 `milieu`,
25 `fin`, 21 `unique`**. Les 98 posters existent déjà, un par segment.

## 5. Le brief du lot 1, et ce que deux relectures y ont trouvé

`tests/scelles/gestes-champ-media.test.ts` — **7 tests, 6 rouges**, écrits avant tout code.
**Cinq des sept viennent d'une relecture, pas de la première rédaction.**

**Première attaque** — le trou qui comptait :

> « Un chargeur qui ferait `SELECT * FROM lexicon_clip ORDER BY ordre` **sans filtrer**, puis
> collerait le même tableau aux 62 fiches, passait les cinq tests. »

Aucun n'exerçait deux gestes à la fois. ⛔ **Et cet oubli est structurellement invité** :
l'interface que reçoit `loadCatalogFrom` n'expose qu'un `all(sql)` — **aucun paramètre lié**. On ne
PEUT pas requêter geste par geste ; la seule forme possible est une requête globale regroupée en
`Map`, et c'est ce regroupement qu'on saute.

**Seconde attaque** — quatre trous de plus :

- le « Fini quand » promettait « 73 tips, 8 fiches, 1 548 étapes inchangés » et **aucun n'était
  vérifié par un test** — ils ne vivaient que dans la sortie console de `build.mjs` ;
- les tests qui écrivent travaillaient sur une copie, celui qui vérifie le vide lisait la base
  réelle : **deux chemins différents**, donc un `if (chemin == base réelle) return []` passait tout ;
- le tri n'était exercé que sur les rangs 0/1/2 — un tri en chaîne passait par accident ;
- la clé composite n'était lue que dans le **texte** du `CREATE TABLE`, jamais exercée.

⚠️ **Ma valeur-témoin pour `moment` était une chaîne inventée** — elle aurait fait échouer le test
**chez le codeur qui suit la convention du dépôt** et pose un `CHECK`. Corrigée : la valeur est
légale, et ce qui discrimine est qu'elle soit **fausse pour son rang**.

## 6. Ce qui n'a PAS été fait, et pourquoi

- **Aucune ligne de code de production.** Le lot n'est pas scellé — c'est l'utilisateur qui tape
  `/sceller`, pas moi.
- **La réponse à Pexels n'est pas partie.** Ils demandent un échantillon de l'écran final. ⛔ Le
  motif « construire pour montrer à Pexels » a été **explicitement écarté** par l'utilisateur : le
  chantier se fait pour lui-même.
- **`catalog/CREDITS.md` n'a pas reçu la mention de partage à l'identique** des 31 photos CC BY-SA.
- **L'exposition au droit à l'image** de ce qui est déjà livré n'a pas été vérifiée.

## 7. Ce que cette session a payé sur la circulation, à ne pas refaire

⛔ **Le commit `ad1ad47` (« lot 66 ») a emporté mon travail sur `ETAT.md`** — décisions 69, 70, D6 et
le bloc média s'y trouvent, sous le message d'une autre lane. **Rien n'est perdu, l'historique
ment.** C'est exactement le défaut connu : l'index git est partagé, `git add` trop large emporte le
travail du voisin. La parade reste la seule qui marche : **nommer les chemins un par un**.

⚠️ Et pendant deux mesures prises à dix minutes d'écart sur le même arbre, un **+1** est resté
**non attribué**. Je ne l'ai pas deviné — c'était le lot 66b qui écrivait à côté.
