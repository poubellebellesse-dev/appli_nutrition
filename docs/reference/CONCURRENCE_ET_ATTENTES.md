# Ce que les gens demandent aux applications comparables

> Relevé le **2026-08-04**. Avis App Store, Google Play, tests indépendants et blogs comparatifs.
> Réactualiser avant d'engager un chantier qui s'appuie dessus : un avis de 2025 sur une application
> qui a été refondue depuis ne dit plus rien d'utile.

## ⚠️ Fiabilité des sources — à lire avant de citer un chiffre

Trois qualités de source, à ne pas mélanger :

| Qualité | Ce que c'est | Comment s'en servir |
|---|---|---|
| **Solide** | Avis App Store / Google Play, tests de blogs culinaires sans produit à vendre | Citable tel quel |
| **Moyenne** | Articles de comparaison génériques | Utile pour repérer un motif, pas pour un chiffre |
| **⛔ Intéressée** | Blogs d'applications de garde-manger CONCURRENTES — Pann, Recipy, mise, Sously, Fango | **Ce sont des pages marketing.** Elles ont un intérêt direct à décrire les leaders comme pénibles |

Les formules les plus frappantes (« death spiral », « 70 % abandonnent en 100 jours ») viennent
toutes de la troisième catégorie. **Le motif qu'elles décrivent est corroboré par les avis réels ;
leurs chiffres ne le sont pas.** Ne pas les reprendre comme mesure.

---

## 1. Le grief n°1, et il écrase tous les autres : l'inventaire dérive

> « On le remplit avec entrain pendant une semaine, puis une fois, puis plus jamais — et **un
> inventaire à moitié à jour est pire que pas d'inventaire, parce qu'on cesse d'y croire**. »

Le mécanisme décrit partout est identique : 40 articles saisis le premier jour, 5 le deuxième, un
oubli en semaine 2, et en semaine 3 chaque suggestion porte sur des aliments qu'on n'a plus. Les
applications récentes répondent par le scan de ticket de caisse ou la photo d'étagère — c'est-à-dire
qu'elles **admettent que la saisie manuelle ne tient pas dans la durée**.

**Ce que ce projet en fait.** `ShoppingOptions.pantryFoodIds` pose depuis l'origine que le
garde-manger est « FACULTATIF ET PONCTUEL, jamais un inventaire à tenir : l'appli ne demande rien ».
La recherche valide cette ligne plus fort que prévu — c'est exactement le piège des autres. La
« gestion du garde-manger » reste en v3, distincte et non engagée.

**Ce qui a été ajouté le 2026-08-04** (décision utilisateur) : `user_pantry.declare_le` (migration
v8) et `ui/confirmer-frigo.tsx`. Au-delà de **7 jours**, la liste s'affiche à cocher ; décocher
retire pour de bon. La question n'est posée qu'au **moment de l'usage** — jamais en rappel, jamais en
notification, jamais en badge : le produit s'interdit de réclamer l'entretien d'un inventaire.

⚠️ **Les deux écrans concernés ne réagissent PAS pareil, et c'est délibéré.** Dans « Choisir un
plat », la question retient les résultats : un garde-manger périmé y rend la proposition *fausse*.
Dans Courses, elle n'empêche rien — le garde-manger ne fait qu'*enlever* des lignes, donc un
garde-manger douteux n'est pas appliqué du tout et la liste sort entière. Acheter une crème en double
se raye d'un trait ; rentrer sans gâche le repas. Voir décision 57 (`ETAT.md`).

## 2. « Il me manque toujours un ou deux ingrédients »

> « On coche uniquement ce qu'on a, et **presque chaque recette proposée demande 1 à 2 ingrédients de
> plus**. Ça annule l'intérêt de l'appli. » — reproche de fond fait à SuperCook

**Ce que ce projet en fait.** `searchByPantry` **classe et ne filtre pas** (voir son en-tête), rend
`manquants` explicitement, et `seulementRealisables` n'est jamais actif par défaut. La fenêtre
« Choisir un plat » écrit « Il vous manque : crème, thym ». Traité.

## 3. ⛔ La liste fermée d'ingrédients — NON TRAITÉ chez nous

> « Les ingrédients qu'on peut mettre dans son garde-manger ne sont pas des mots-clés qu'on choisit.
> **C'est une liste préétablie.** Ça limite lourdement ce qu'on peut déclarer, et donc les résultats. »

**MESURÉ sur notre catalogue le 2026-08-04 : 200 aliments, et `chorizo`, `lardon`, `noix de coco` en
sont absents.** `user_pantry.food_id` référence obligatoirement un aliment du catalogue et
l'autocomplétion de l'écran Frigo cherche dans ces 200 : **quelqu'un qui a des lardons n'a aucun
geste pour le dire.**

⚠️ **CE N'EST PAS UN MANQUE DE CONTENU, C'EST UNE IMPASSE DE MODÈLE**, et la nuance décide de la
correction. Allonger `foods.yaml` repousse le mur — chantier en cours côté utilisateur — mais aucun
catalogue fini ne le supprime : il n'existe aucun chemin pour déclarer un aliment que l'éditeur n'a
pas prévu. Le trou est d'ailleurs **d'autant moins visible que le catalogue grossit**, ce qui en fait
un défaut qui se découvre tard, chez l'utilisateur.

## 4. Les autres reproches, plus courts

- **« Une longue liste au lieu d'une décision »** (SuperCook). Nous sommes structurellement mieux
  placés : on remplit **un créneau précis**, pas « voici 200 idées ». ⚠️ Mais les 40 résultats non
  classés de l'onglet catalogue de `choisir-plat.tsx` vont dans le mauvais sens.
- **Frigo Magic** (français, 1,8 M de téléchargements, sans pub, sans compte, sans collecte — le plus
  proche de nous par les principes) : bien reçu ; reproche principal **« on ne peut sélectionner
  qu'un seul ingrédient »**.
- **Marmiton** : le mode frigo est *aimé*, l'application non — filtres cassés, défilement qui boucle
  sur les mêmes recettes, publicité, lenteur. **C'est de la pourriture technique, pas un problème de
  conception** : à ne pas lire comme un signal produit.
- **Manque cité chez SuperCook** : « pas d'option pour ajouter une recette trouvée à un plan de repas
  hebdomadaire ». C'est exactement ce que fait la décision 49, codée le 2026-08-04.

## 5. Ce qu'on en retire, et ce qu'on refuse d'en retirer

**Retenu** : dater et faire confirmer le garde-manger (§1) ; la liste fermée est un vrai trou à
trancher (§3).

⛔ **Écarté d'avance, et il faut que ce soit écrit ici** : le scan de ticket de caisse et la photo
d'étagère, que toutes les applications récentes présentent comme LA réponse au §1. Les deux
supposent un traitement d'image ou un OCR ; l'OCR embarqué reste discutable, **la photo d'étagère
suppose une reconnaissance qui n'existe pas sans IA générative** — interdite par le principe 4 — et
la version serveur enverrait une photo de votre cuisine ailleurs, ce que le principe 2 interdit.
Notre réponse au §1 ne peut donc pas être « automatiser la saisie » : elle est « ne pas prétendre que
la donnée est fraîche ».

## Sources

- SuperCook — [avis App Store](https://apps.apple.com/us/app/1477747816?see-all=reviews&platform=iphone) ·
  [JustUseApp](https://justuseapp.com/en/app/1477747816/supercook-recipe-by-ingredient/reviews)
- Marmiton — [notes et avis App Store](https://apps.apple.com/fr/app/marmiton-recettes-de-cuisine/id318796083?see-all=reviews&platform=iphone)
- Frigo Magic — [App Store](https://apps.apple.com/fr/app/frigo-magic-cuisine-antigaspi/id977681072) ·
  [test La Fée Biscotte](https://www.lafeebiscotte.com/test-avis-application-android/application-frigomagic/)
- ⛔ Sources intéressées, voir l'avertissement en tête : [Recipy](https://recipyapp.com/blog/best-pantry-tracking-apps-2026) ·
  [mise](https://trymise.app/blog/pantry-inventory-app) · [Pann](https://www.pann-app.com/blog/supercook-review) ·
  [Sously](https://sously.app/blog/best-pantry-inventory-app-real-kitchens/)
