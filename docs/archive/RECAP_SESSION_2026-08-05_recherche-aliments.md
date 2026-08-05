# Récit de session — 2026-08-05 : trouver un aliment, et deux aliments qui n'étaient pas les bons

> **Instantané daté. Ne jamais réécrire** (voir [README.md](./README.md)). Les chiffres étaient vrais
> le 2026-08-05. État courant : [../FICHE_REPRISE.md](../FICHE_REPRISE.md) et [../ETAT.md](../ETAT.md).
>
> ⚠️ **DATÉ ET NON NUMÉROTÉ, délibérément.** Les récits vont de 1 à 10 ; les sessions 11 et 12 sont
> citées dans `FICHE_REPRISE.md` et `ETAT.md` mais **n'ont jamais été archivées**. Numéroter celui-ci
> « 13 » affirmerait un rang invérifiable. La date, elle, est un fait.

⚠️ **Piste parallèle, sur le même dépôt et le même jour.** Une autre conversation a mené le mode
cuisine (L0/L1 : `recipe_step.nature`, écran `#/cuisine/<id>`, schéma `user.db` v10) et une refonte
de `socle.ts` / `catalog-source.ts` / `router.tsx`. Les périmètres se recouvrent sur
`engine/domain/catalog.ts`, `data/catalog-loader.ts`, `catalog/build.mjs`, `data/user-recipe.test.ts`
et `ETAT.md`. Deux commits de cette session-ci ont dû être faits **fichier par fichier** ; un a
emporté leur lot, faute de pouvoir le séparer sans produire un commit rouge — c'est écrit dans son
message (§5).

---

## 1. Ce qui a été fait

Un fil unique : **quelqu'un tape ce qu'il a dans son frigo, et l'application ne le trouve pas.**
C'est la décision 58. Elle avait quatre causes ; trois n'étaient pas connues au départ.

| Commit | Ce qu'il change |
|---|---|
| `c17af24` | Champ `synonymes` — « lardon » trouve enfin la poitrine de porc |
| `dd94026` | `ui/parcours-aliments.tsx` — 352 aliments sur 450 étaient injoignables |
| `adae575` | « thon en boîte » rendait du thon cru ; découverte du défaut `jambon_blanc` |
| *(non committé)* | `canard_magret` et `jambon_blanc` repointés, `catalog/audit-mapping.mjs`, fermeture de la cause (3) |

### 1.1 Les synonymes (cause 2)

`chercherParNom` élargie à `{ nom, synonymes? }`, table `food_synonym`, champ **requis** sur `Food`.
Trois refus au build : entrée morte, terme revendiqué par deux aliments, terme vide.

**Le refus « `foodId` inexistant » n'a pas été écrit parce qu'il est inexprimable** : le synonyme vit
*sur* l'aliment, il n'y a pas d'identifiant à se tromper. Même geste que `requiredFoodIds` dans
`MealContext` — la garantie vient de la forme.

### 1.2 Le parcours (cause 4, contournée)

**352 aliments sur 450 étaient injoignables sans deviner le mot exact.** `chercherParNom` n'en rend
que 6 ; l'« Ajout rapide » de `frigo.tsx` — seul parcours existant — écarte tout aliment qu'aucune
recette n'utilise (250 à lui seul) puis coupe à 8 par famille : **98 atteignables**.

Et le tri était à l'envers du besoin : les 250 écartés sont les plus **récents**, donc les moins
connus, donc précisément ceux qu'on cherche sans savoir les nommer.

`ui/parcours-aliments.tsx` : fenêtre partagée par les trois écrans, familles dérivées du catalogue,
tous les aliments, alphabétique. `AjoutRapide` reste — deux gestes, pas une version dégradée.

### 1.3 L'audit des mappings

`catalog/audit-mapping.mjs` — 450 mappings, **2 vrais défauts**, tous deux des confusions
maigre/gras qu'aucun test ne pouvait voir :

```
canard_magret  36201 « Canard, viande crue »   → 36206 « Canard, magret cru »
               127 → 337 kcal · lipides 5,95 → 29,4 g   (× 4,9)

jambon_blanc   28700 « Jambon à rôtir » (CRU)  → 28900 « Jambon cuit, supérieur »
               163 → 113 kcal · lipides 9 → 2,83 g      (÷ 3,2)
```

Sept recettes en dépendaient. **Zéro recette modifiée** : les deux se corrigent par une ligne de
mapping, parce qu'une recette écrit `food_id` et ne connaît ni le code Ciqual ni les valeurs.

---

## 2. Ce que la mesure a démenti — la partie qui ne se reconstitue pas

### 2.1 « Le tri par longueur de mot explique les cinq faux amis » — FAUX, il en explique un

J'ai écrit cette cause mécanique dans `ETAT.md` avant de la vérifier nom par nom. Vérification faite :
**aucun nom du catalogue ne contient « tarte », « boîte » ni « jambon blanc »**. Donc tous les
candidats appariaient **le même mot unique**, avec rang, poids et position identiques — le départage
tombait sur la longueur du nom, faute de quoi que ce soit d'autre à comparer.

> **Une pondération par rareté n'y changerait rien : il n'y a rien à pondérer.**

Trois des cinq relevaient de la cause (2), un de la cause (3), un seul du classement. C'est ce qui a
fait renoncer au correctif de classement — pas un jugement de valeur, un décompte.

### 2.2 « On n'aura jamais de signal pour remplir les synonymes » — FAUX

Affirmé deux fois, en s'appuyant sur le principe 2 : pas de télémétrie, donc aucun moyen de savoir ce
que les gens tapent sans succès.

**L'audit l'a démenti.** Les identifiants de `ciqual-mapping.yaml` sont un vocabulaire courant écrit
par un humain décrivant le produit, et ils divergent des noms Ciqual **exactement là où les
utilisateurs divergeront**. Quatre échecs mesurés en sont sortis : `maïzena` et `magret` ne rendaient
**rien**, `crème liquide` rendait de la **crème de marron**, `thon frais` rendait une **fraise**
(« frais » → « frai », et « Fraise » commence par « frai »).

### 2.3 « Le lot jambon demande d'ajouter un aliment, de rebrancher 5 recettes et un arbitrage » — SURDIMENSIONNÉ

Les trois étaient faux. **Lire les cinq recettes a suffi** : toutes disent « jambon » sans
qualificatif — tranches, dés —, y compris `salade-melon-jambon`. Aucune ne veut de rôti cru, aucune
ne demandait d'arbitrage. Une ligne de mapping, zéro recette touchée.

### 2.4 « Aucun chemin de parcours n'existe » — FAUX en lettre, pire en substance

`AjoutRapide` existait. Mais en le lisant, le chiffre réel était pire que celui que j'annonçais :
98 atteignables, pas zéro parcours — et les invisibles étaient les plus utiles.

### 2.5 « Le sel est le principal écart du jambon » — FAUX

Hypothèse avancée avant mesure. Le sodium bouge de 870 à 788 : presque rien. **Le vrai écart est sur
les lipides (÷ 3,2).**

---

## 3. La leçon de méthode, et elle a failli être manquée

J'allais poser un synonyme « magret » sur `canard_magret`.

**Corriger le mapping a réparé la recherche tout seul** — et un synonyme « magret » serait désormais
**refusé par le build** comme entrée morte, puisque le nom contient le mot.

> **Vérifier la donnée AVANT de poser un synonyme.** L'inverse recouvre l'erreur au lieu de la
> corriger, et le résultat aurait eu l'air juste : « magret » aurait trouvé son aliment, qui aurait
> continué de porter les valeurs d'un canard maigre.

C'est le même mécanisme que le défaut signature du projet — un champ rempli mais faux — transposé aux
**données**. `jambon_blanc` a été trouvé **par accident**, en cherchant où poser un synonyme. D'où
l'audit systématique.

---

## 4. Ce qui a été écarté, et pourquoi

**La pondération par rareté (IDF) du classement.** Redresserait 1 cas sur 5, rebattrait les 450.
Le classement a déjà été cassé une fois (« Farine de riz » devant « Riz blanc »), et l'étalon de
mesure — les 33 saisies — est une **reconstruction faite le jour même**, pas la liste d'origine.
Juger un changement contre un étalon fabriqué pour l'occasion, c'est se donner raison.

**Importer tout le Ciqual (3 484 aliments).** Trois raisons, mesurées :
1. **Les allergènes** — le Ciqual donne la composition, jamais les allergènes. 3 000+ entrées que le
   filtre §5.2 tiendrait pour sûres. Le garde-fou ne serait pas contourné, il serait **vidé**.
2. **Ce n'est pas un catalogue de courses** — 407 plats composés, 325 boissons, 39 aliments
   infantiles ; et les ingrédients s'y multiplient par état de préparation (7 canards, 30+ jambons).
3. **La recherche empirerait** — un corpus plus dense fabrique plus de faux amis. Mesuré :
   `sauce tomate` → « Maquereau sauce tomate » est né de l'agrandissement du catalogue.

Et surtout : **5 des 6 aliments manquants mesurés sont absents du Ciqual aussi** (`kimchi`, `wasabi`,
`nduja`, `skyr`, `guanciale`). Le plafond n'est pas notre catalogue.

**Une seconde table de composition** (USDA, Open Food Facts). Coûts : comparabilité des mesures
(`scoreNutri` compare des recettes entre elles), licence (ODbL d'Open Food Facts porterait sur
`catalog.db`), et traçabilité par aliment. Le gain — quelques produits de niche — ne le paie pas.
⚠️ **Ce paragraphe vient de ma connaissance, PAS d'une vérification en ligne faite ce jour-là.**

**Un synonyme « pâte à tarte ».** Le terme désignerait brisée, feuilletée et filo : **le build le
refuserait** au titre du doublon. C'est un générique, et le catalogue n'a aucune notion de générique.
La règle a diagnostiqué le cas toute seule.

---

## 5. Mes erreurs

**J'ai écrit une cause mécanique fausse dans `ETAT.md` avant de la vérifier** (§2.1). Corrigée le
jour même, avec la mesure. C'est la faute la plus coûteuse de la session : elle aurait envoyé le
prochain lecteur refaire un correctif de classement pour un cas sur cinq.

**J'ai affirmé deux fois qu'aucun signal n'existerait jamais** pour les synonymes (§2.2). L'audit
que j'ai écrit trois heures plus tard l'a démenti.

**J'ai laissé un doublon de test** en remplaçant le garde-fou du magret par un `it.each` — un `it`
nommé « ANCIEN GARDE-FOU, conservé le temps de la relecture ». Supprimé dans la foulée : un nom
bâtard dans une suite est de la dette qui se lit comme une intention.

**Un commit (`c17af24`) a emporté le lot d'une autre session.** Les diffs étaient entrelacés dans
cinq fichiers ; les séparer aurait produit un commit **rouge** (`RecipeStep.nature` requis sans le
code qui le renseigne). Signalé à l'utilisateur avant, et écrit dans le message du commit. Les deux
suivants ont pu être faits proprement, fichier par fichier.

---

## 6. Ce qui reste ouvert à la fin de cette session

**Non committé** : `canard_magret` et `jambon_blanc` repointés, `catalog/audit-mapping.mjs`,
`catalog/CREDITS.md` corrigé, la fermeture de la cause (3) dans `ETAT.md`, et ce récit.

⚠️ **`npm test` est passé ROUGE puis VERT pendant la rédaction de ce récit, et ça vaut d'être noté.**
Au moment de la clôture : **200 échecs sur 13 fichiers**, textes d'écran introuvables (« Composer ma
semaine ») — la piste parallèle refactorait `socle.ts`, `catalog-source.ts`, `router.tsx` et
`semaine.tsx`. Vingt minutes plus tard, sans que ce lot-ci ait bougé : **1 492 passed (84 fichiers)**.

> **Dans un dépôt à deux sessions, `npm test` mesure l'ARBRE, pas ton lot.** Un rouge n'est pas
> forcément le tien, un vert ne prouve pas que le tien passe seul. Le seul relevé qui t'engage est
> celui de TES fichiers : ici `catalog/build.test.ts`, `tests/recherche-catalogue-reel.test.ts`,
> `app/src/ui/parcours-aliments.test.tsx`, `app/src/engine/search/index.test.ts` — **135 passed**,
> verts du début à la fin.

État final : `npm test` **1 492 passed (84 fichiers)** · `typecheck` **0 erreur** · `vite build` OK ·
`plan-stress` **20/20** · `catalog.db` **450 aliments, 241 recettes**.

**Le chantier des recettes attend deux réponses** — cuisine-libre.org et Santé publique France
(`COURRIERS_SOURCES.md`). Les 603 recettes CC0 + domaine public de cuisine-libre ne demandent
pourtant **aucune permission** : c'est la définition de CC0.

**`docs/prompt-synonymes.md`** est le brief de ce chantier, non versionné, désormais sans objet — la
décision qu'il portait vit dans `ETAT.md` §58. À supprimer ou archiver, au choix de l'utilisateur.

**L'audit ne peut pas devenir un test** : `documents Ciqual/` est gitignoré. À relancer **à la main**
après chaque lot de contenu, sinon la classe de défaut `jambon_blanc` reviendra sans bruit.
