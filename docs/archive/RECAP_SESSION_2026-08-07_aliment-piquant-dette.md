# Récap — 2026-08-07 · fiche aliment, piquant, et la dette qu'on croyait connaître

> **Instantané daté. Ne jamais réécrire, ne jamais citer comme état courant.**
> L'état vit dans [`ETAT.md`](../ETAT.md), la reprise dans [`FICHE_REPRISE.md`](../FICHE_REPRISE.md).
> Cette page raconte *pourquoi*, pas *où on en est*.
>
> ⚠️ **Piste parallèle le même jour** : une autre session travaillait sur les liens étape → ingrédient
> (`gestes-etape.tsx`, décision 60) **dans le même répertoire de travail**. Voir « Ce que le partage
> d'arbre a coûté » en bas.

## Ce qui a été livré

| Lot | Décision | Verrouillé par |
|---|---|---|
| Écran de détail par aliment, `#/aliment/<id>` | 33 (fermée) | `screens/aliment.test.tsx` (20), `router.test.ts` (+8), `saison.test.ts` (18), `ingredients-recette.test.tsx` (4) |
| Piquant : 297 fiches annotées, migration v12, 12ᵉ couche de score | 35 (fermée) | `scoring/piquant.test.ts` (11) + 18 sites nommés par le compilateur |
| Dette §8 : version du moteur, `--historique` au banc, piège à focus | — | `engine-version-consistency.test.mjs` (2), `panneau.test.tsx` (6) |

## ⛔ Le vrai enseignement du jour : trois faits « connus » étaient faux

Aucun des trois n'a été trouvé en cherchant un bug. Les trois sont sortis en **confrontant un
document au code ou à sa source**, parce qu'on en avait besoin pour autre chose.

### 1. Une affirmation recopiée trois fois, jamais vérifiée

L'en-tête de `catalog/sources/ciqual-confiance.yaml` affirmait :

> « A = valeur dosée, source française identifiée · D = valeur calculée, imputée ou empruntée. Une
> cote C ou D ne veut PAS dire "douteuse". »

Reprise telle quelle par la **décision 33** d'`ETAT.md`, puis par un premier jet de l'écran aliment
— qui inventait en plus des libellés pour B et C. **Trois copies, zéro source.**

La documentation officielle de l'export **réellement importé** (`documents Ciqual/2025_11_03`, donc
la bonne version) dit, tableau 6, mot pour mot :

> « code de confiance, qui indique la **fiabilité** de la teneur moyenne (de A=très fiable à
> D=moins fiable) »

**Le code annonce une fiabilité, pas une provenance.** Et l'ANSES **ne définit que ses deux bornes** :
B et C n'ont aucune définition publiée — leur en écrire une était inventer une source.

Ce qui reste vrai : les valeurs C/D viennent surtout de l'USDA (451) et d'un calcul Ciqual (368).
Mais cela décrit **d'où viennent** ces valeurs, pas **ce que le code signifie**.

⚠️ **Comment la source a été lue** : `WebFetch` a échoué six fois sur ce PDF (polices sous-ensemblées,
rendu binaire), et `pdftoppm` est absent de la machine. Ce qui a marché : `curl` puis
`zlib.inflateSync` sur les flux du PDF, et extraction des chaînes littérales. **Consigné dans
`reference/PIEGES.md`** — c'est reproductible et ça prend deux minutes.

➡️ Corrigé aux **quatre** endroits : le générateur `import-ciqual.mjs`, l'en-tête généré (17 lignes,
**0 cote touchée**), la décision 33, et l'écran — qui affiche désormais **la lettre nue** avec la
définition citée verbatim en dessous.

⚠️ **Conséquence non prévue** : l'énergie n'est plus exemptée de sa cote. Elle l'était au motif
qu'une mention constante sur 97 % du catalogue est du bruit — motif qui tombe quand la cote annonce
une fiabilité. Masquer « moins fiable » sur un chiffre est une décision éditoriale qu'on ne peut pas
prendre à la place de l'utilisateur ; l'écran **explique** la constance (calcul selon le règlement
UE n° 1169/2011) au lieu de la cacher.

⛔ **CE QUI N'A PAS ÉTÉ ROUVERT, ET QUI APPARTIENT À L'UTILISATEUR** : l'arbitrage « importer SANS
pondérer » de la décision 33 s'appuyait en partie sur cette prémisse fausse. Il n'a **pas** été
rouvert d'office — mais quiconque le relit doit savoir qu'un de ses appuis a cédé.

### 2. Une décision annoncée « chantier ouvert » alors qu'elle était livrée

La **décision 16** (courses non alimentaires, 10 rayons) portait « chantier ouvert, non planifié ».
`shopping_extra_item` était en base, `addExtraItem` l'écrivait, et `courses.tsx` en rendait le
formulaire — complétion catalogue, déduction du rayon, champ quantité — **depuis le 2026-07-28**.
La livraison était décrite dans `RETOUR_ESSAI_TELEPHONE.md` §6 et n'avait jamais reflué.

**Une ligne d'index peut sur-déclarer du travail restant autant qu'elle peut en cacher.**

### 3. §8 comptait faux, à six endroits, pour la même raison

Six entrées annonçaient « 241 recettes », une septième « 212 », une huitième « 9 fichiers de test »,
une neuvième « aucun test d'interface » — celle-ci contredisant « Les écrans sont testés » **cinq
sections plus haut, depuis une semaine**.

➡️ **Le correctif n'est pas de rafraîchir six chiffres.** §8 porte désormais **un** relevé daté en
tête, avec la requête pour le refaire, et les entrées y renvoient. Le catalogue est passé de **282 à
292 puis 297 recettes pendant la rédaction du paragraphe** — c'est écrit tel quel dans le document.

⚠️ **Un audit automatique ne dispense pas de vérifier** : l'agent d'audit a rendu « déjeuner = 199 »
là où la mesure directe donne **159**. Il avait en revanche raison sur deux fichiers dont j'avais
douté à tort. **Un verdict d'agent est une piste, dans les deux sens.**

## Décision 35 — la mesure a changé la question avant l'arbitrage

Avant de demander quoi que ce soit, on a compté. Sur 297 fiches :

| | Recettes |
|---|---|
| Ingrédient **brûlant** (cayenne, harissa, raifort) | **2** — et les deux en *pincée facultative* |
| `harissa` et `raifort` eux-mêmes | employés par **0** recette |
| **Moyen** (curry, gingembre frais, chorizo, moutarde) | 28 |
| **Assaisonnement de fond** (poivre, paprika, curcuma) | 79 |

**Aucune recette ne dépasse le niveau 1.** Les niveaux 2, 3 et 4 sont inutilisés.

C'est ce chiffre qui rend l'**exclusion dure indéfendable**, indépendamment du goût : `Recipe.piquant`
valait `null` partout, et une exclusion sur ce champ n'a que deux issues, toutes deux fausses —
exclure `null` **vide le catalogue**, laisser passer `null` **promet une protection qu'elle ne rend
pas**. Le score, lui, ne ment pas.

**Arbitrages rendus (utilisateur)** : score jamais exclusion · trois positions en toutes lettres.

### Ce qui a coûté le plus cher à concevoir : le poids

Les poids des couches sont **normalisés à Σ = 1**. Une 12ᵉ couche à poids fixe non nul aurait dilué
toutes les autres et **déplacé le classement de gens qui n'ont jamais parlé de piquant**.
`defaultWeight: 0` seul l'aurait rendue muette (règle 2 : une couche à poids ≤ 0 n'est même pas
configurée). ➡️ **Poids dynamique**, comme `craving` : relevé à `PIQUANT_DYNAMIC_WEIGHT = 0.25`
**seulement si une tolérance est déclarée**. Ne rien déclarer ne coûte rien, et c'est mesuré au banc.

### `tolerancePiquant` est REQUIS, contrairement à `varietyMode`

Délibéré, et ça coûte : le compilateur a nommé **18 sites de construction**. Un champ optionnel
oublié aurait produit un réglage **écrit en base, lu par les Paramètres, affiché à l'écran, et
n'atteignant jamais le moteur** — la 6ᵉ occurrence du défaut signature du projet. Le champ voyage
aussi sur `WeekPlanRequest` et `RerollContext` : sans ça il aurait marché sur Aujourd'hui et pas sur
la semaine, ce qui se lit comme un caprice de l'application, pas comme un bug.

### La couche n'est jamais citée

`EXPLANATION_LABELS.piquant = null`. Elle ne fait que **pénaliser**, donc elle ne peut jamais être la
raison qu'un plat ait été **retenu** — acquis n°3. « Convient à votre tolérance au piquant » sonnerait
comme un compliment fait à une carotte.

## Trois tests vérifiés par régression volontaire

Un test de cohérence jamais vu rouge ne prouve rien.

| Test | Cassé comment | Résultat |
|---|---|---|
| `engine-version-consistency` | `ENGINE_VERSION` passée à `0.1.1` | rouge (`expected '0.1.1' to be '0.1.0'`) |
| `panneau` (piège à focus) | `Tab` non borné | **3 rouges sur 6** |
| couche `piquant` | retirée de `SCORING_LAYERS` | les 2 échecs `aujourdhui` **restent** → pas de moi |

⛔ **Et un test a été RETIRÉ parce qu'il était vert pour rien.** « Aucune combinaison de `Tab` ne sort
de la fenêtre » passait **avec et sans** le piège : jsdom n'implémente pas le déplacement natif du
focus, donc sans piège le focus ne bougeait pas du tout. Le confinement réel reste à vérifier au
clavier sur un vrai navigateur.

## Dettes fermées, et une refusée

| Dette | Sort |
|---|---|
| `code_confiance` rempli et jamais lu | ✅ fermée — écran aliment |
| `ENGINE_VERSION` peut diverger | ✅ fermée par test (elles n'avaient pas divergé — la dette était le risque) |
| λ : mesure faite à 212 recettes | ✅ remesurée à 282 : **39 621 paires**, p99 36,5 %, 51 > 60 %. **Le résultat utile est la stabilité** — 0,134 % → 0,129 % : grossir le catalogue d'un tiers n'a pas déplacé la distribution |
| `varietyMode` non observable au banc | ✅ fermée — `--historique`. Mesuré : `variété` passe de **7,5 à plat** à **15,0 différencié** ; en injectant le top 3, les trois **disparaissent du top 5** |
| `Panneau` ne piège pas le focus | ✅ fermée — `aria-modal="true"` mentait |
| « Aucun test d'interface » | ✅ périmée depuis une semaine |
| Échec intermittent « non caractérisé » | ✅ l'était depuis la décision 61 |
| Similarité au banc (préalable de λ) | ⛔ **refusée** — les deux issues touchent un **type public**. Décision d'API, pas de ménage |
| `recipeMainIngredient` mort | ⛔ **non supprimé** — lecteurs vérifiés (2 bancs), mais « figer ces bancs » est une décision produit |
| `roquefort` sans `sulfites` | ⛔ **non touché** — l'entrée n'est **sourcée nulle part**. Après la leçon du jour, on ouvre la source avant de toucher à la donnée, **dans les deux sens** |

## Ce que le partage d'arbre a coûté

Deux sessions, **un seul répertoire de travail**. La branche a changé sous les pieds (`dev-features`
créée, puis HEAD passé à `recette-aliments` par l'autre piste). Conséquences réelles :

- `foods.yaml` était en cours d'édition d'en face → **`Food.piquant` n'a pas été annoté**, pour ne
  pas fabriquer un conflit. Ce n'est pas un oubli.
- `detail-recette.tsx` porte un hunk de chaque piste dans le même fichier.
- Le catalogue a bougé **trois fois** pendant la session (282 → 292 → 297), ce qui a fait tomber un
  test qui codait un compte en dur — **le mien**, corrigé pour dériver le compte du catalogue.
- Les deux échecs restants viennent du lot de contenu d'en face (`e3bc94c`), pas du code.

➡️ **Rien n'est commité.** Le découpage est à faire, et `reference/PIEGES.md` dit comment — surtout
pas avec `git apply --unidiff-zero`.
