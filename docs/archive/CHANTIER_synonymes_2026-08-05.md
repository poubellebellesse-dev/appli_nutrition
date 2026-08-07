CHANTIER : synonymes d'aliments (décision 58, cause 2)

## Ce qui vient d'être fait, ne pas le refaire

La recherche d'aliments comparait des SOUS-CHAÎNES : `normaliser(nom).includes(saisie)`.
Elle échouait dès que la saisie était plus longue que le nom éditorial, ou dans un autre
ordre. « noix de saint-jacques » ne trouvait pas « Coquille Saint-Jacques, crue ».

C'est corrigé : `chercherParNom` dans app/src/engine/search/index.ts, utilisée par les
trois écrans qui interrogent le catalogue d'aliments (frigo.tsx, courses.tsx,
editeur-recette.tsx). Commits a4de62e et 7a1520a. Mesure : 7 saisies sans résultat sur
33 → 3.

## Ce qui reste, et que je te demande

Les 3 saisies restantes ne sont PAS un manque de catalogue. L'aliment est là, sous un
autre nom :

    lardon      → « Porc, poitrine crue »        (porc_poitrine)
    gambas      → « Crevette, crue »             (crevette)
    chipolata   → « Saucisse de Toulouse, crue » (vérifier l'id exact)

Aucun geste ne permet à quelqu'un qui a des lardons de le déclarer. Il conclut que
l'aliment n'existe pas.

Il faut un champ de synonymes : des noms d'usage supplémentaires, rattachés à un aliment
QUI EXISTE DÉJÀ, lus par `chercherParNom`.

## Contraintes non négociables

1. UN SYNONYME NE CRÉE JAMAIS D'ALIMENT. Il ne porte ni valeur nutritionnelle, ni
   allergène, ni id. C'est un alias de recherche sur un `FoodId` existant. Si l'aliment
   n'existe pas au catalogue, ce n'est pas ce chantier (c'est la cause 3 de la
   décision 58, non tranchée).

2. LE GARDE-FOU §5.2 N'EST PAS TOUCHÉ, et c'est ce qui rend ce lot faisable sans
   arbitrage : l'aliment porte déjà ses allergènes, on ne fait que le nommer autrement.
   Ne pas introduire de chemin où un terme saisi produit un aliment sans allergènes.

3. ⛔ NE PAS EXIGER DE SOURCE. Un synonyme dit « c'est un autre nom du même aliment »,
   pas « tu peux remplacer A par B ». Ce n'est PAS une substitution. La décision 48 a
   brûlé TROIS passes de recherche sourcée pour rendre ZÉRO couple, en exigeant une
   source institutionnelle sur des équivalences culinaires — et l'analyse a fini par
   conclure que la consigne elle-même était trop stricte. Ne pas rejouer ça ici. Le
   critère est : est-ce que quelqu'un qui a ce produit dans son panier le désignerait
   par ce mot ?

4. ⛔ LE CHAMP DOIT ÊTRE REMPLI *ET* LU. C'est le défaut signature de ce projet, quatre
   occurrences payées (`note_allergene`, filtre allergènes sur liste vide,
   `ratio`/`contexte` de Substitution, `Recipe.service` non lu par planWeek). Un champ
   déclaré et jamais lu ne produit AUCUNE erreur : ni au type, ni au test, ni à l'écran.
   Câbler la lecture dans le même lot que l'écriture, pas après.

5. UN TEST DE BUILD EST EXIGÉ, miroir de celui demandé par la décision 48 :
   - un synonyme sur un `foodId` inexistant → le build REFUSE
   - un synonyme identique au `nom` de son propre aliment → REFUSE (entrée morte)
   - deux aliments différents portant le même synonyme → REFUSE, ou décision explicite
     et écrite sur ce qu'on en fait (« steak » est le cas à vérifier)

## Implémentation

`chercherParNom` est générique sur `{ readonly nom: string }`. L'élargir à
`{ readonly nom: string; readonly synonymes?: readonly string[] }` et apparier sur nom
+ synonymes. Le classement existant ne bouge pas — lire le commentaire de la fonction,
le départage par POSITION est ce qui tient le résultat utile et il a déjà été cassé une
fois (« riz » rendait « Farine de riz » avant « Riz blanc, cru »).

Emplacement des données : `synonymes:` sur l'aliment dans catalog/sources/foods.yaml
(colocalisé avec l'aliment qu'il nomme), table `food_synonym(food_id, terme)` en base —
même forme que les autres champs multivalués.

## Portée

Ne PAS entreprendre une passe exhaustive sur les 450 aliments. Commencer par les trois
mesurés, plus ce que tu rencontres en écrivant du contenu. Une liste de synonymes écrite
à la main et jamais vérifiée pourrirait — c'est exactement ce que ce projet reproche aux
listes écrites à la main (PIEGES.md).

## Critère de réussite

Les 4 commandes vertes, sortie collée :
    npm test · npm run typecheck · npx vite build · npm run engine:plan-stress
Plus : taper « lardon », « gambas », « chipolata » dans l'écran Frigo rend l'aliment.

Et mettre à jour ETAT.md décision 58 : la cause (1) est close (commits ci-dessus), la
cause (2) devient close si ce lot passe, la cause (3) reste ouverte.

---

## ⚠️ ARCHIVÉ le 2026-08-07 — ce chantier est CLOS

Ce fichier vivait à `docs/prompt-synonymes.md`, à la racine des documents, comme s'il décrivait un
travail en cours. Il n'en décrivait plus : **la cause (2) de la décision 58 a été livrée le
2026-08-05** — `food.synonymes` existe (`foods.yaml` → `food_synonym` → `catalog-loader` →
`chercherParNom`), le build refuse une entrée morte, un terme revendiqué par deux aliments et un
terme vide.

⚠️ **Et sa fermeture a eu une conséquence que personne n'a vue pendant deux jours** : la décision 8
justifiait le lien étape → ingrédient « écrit à la main » par *« `food` n'a ni synonyme ni alias »*.
Cette prémisse est morte **le lendemain**, ici même. C'est la **décision 60**, rouverte le
2026-08-06.

**Conservé pour le raisonnement, pas pour l'état.** L'état vit dans [`../ETAT.md`](../ETAT.md).
