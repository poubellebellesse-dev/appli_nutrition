# Ce que les gens demandent aux applications comparables

> Relevé le **2026-08-04** (§1 à §5, les **attentes**). **Réactualisé le 2026-08-16** (§6, le
> **paysage concurrentiel**). Avis App Store, Google Play, tests indépendants et blogs comparatifs.
> Réactualiser avant d'engager un chantier qui s'appuie dessus : un avis de 2025 sur une application
> qui a été refondue depuis ne dit plus rien d'utile.
>
> ⛔ **Le §6 porte le changement d'argumentaire le plus important du document** : ne plus vendre
> « sans IA », vendre **déterministe, auditable, sûr sur les allergies**. Et il porte les **trous** de
> sa propre passe (Reddit, Trustpilot et Google Play inaccessibles) — les lire avant de citer.

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

## 6. Réactualisation du 2026-08-16 — le marché, douze jours plus tard

> Passe de re-vérification par recherche web. **Rien de ce qui précède n'est démenti** ; §1 à §5
> restent valides. Ce qui suit ajoute le paysage concurrentiel, absent du relevé du 04-08 qui ne
> portait que sur les **attentes**.
>
> ⛔ **Fiabilité — à lire avant de citer.** Reddit, Trustpilot et Google Play ont **bloqué tous les
> accès**. Ce relevé repose presque entièrement sur l'**API publique de l'App Store iOS** (source
> primaire et datée, mais un seul canal, majoritairement marché **US**). **Aucun verbatim Reddit** :
> le rejet communautaire de l'« AI slop », attendu, n'a été **ni confirmé ni infirmé**.

### 6.1 Notre case est vide — et c'est le fait le plus utile de cette passe

**Aucune application trouvée ne combine : gratuite, sans compte, 100 % locale sur mobile, hors-ligne
intégral.**

- **Mealie, Tandoor, Grocy** sont gratuits, libres et « locaux » — mais **auto-hébergés**. C'est un
  serveur Docker qu'on fait tourner soi-même, pas une appli sur le téléphone de tout le monde.
  ⚠️ **Ne pas les compter comme des concurrents directs**, et ne pas se rassurer non plus : ils
  prouvent que la demande existe chez les techniciens.
- **Paprika** est le plus proche du modèle local (**achat unique 4,99 $ par plateforme**, pas
  d'abonnement, très bien reçu pour ça — « Buy once, have forever », 11/08/2026, 4,9/5 sur 53 466
  avis) mais il est **payant** et adossé à sa sync cloud.
- Toutes les applis françaises grand public (**Jow, Marmiton, 750g, Cuisine AZ**) exigent un compte
  cloud.

⚠️ **Le « sans IA » pur se raréfie même chez les libres** : **Mealie et Tandoor ont tous deux ajouté
de l'IA** (import de recette depuis une image ou une vidéo, extraction nutritionnelle) — en opt-in,
avec une clé API fournie par l'utilisateur.

### 6.2 « Vider le frigo » : promesse partout, exécution nulle part

C'est notre créneau, et il est **mal tenu par tout le monde** :

| Appli | État au 16/08/2026 |
|---|---|
| **SuperCook** | 4,82/5 sur 21 647 avis, mais plaintes récentes : « Not helpful — it's not allowing me to confirm ingredients » (20/05/2026), « Pure garbage » (02/04/2026) |
| **MyFridgeFood** | **3,23/5 sur 69 avis** — à l'abandon |
| **Cooklist** (le plus installé du créneau, ~11 300 avis) | Démoli sur la **qualité des données** : « half of the recipes are not completed either with ingredients or directions » (13/08/2026), « ingrédients manquants dans les listes d'achat » (13/08/2026) |
| **3 entrants IA « photo du frigo »** (2025-2026) | **0, 1 et 2 avis.** Aucune traction |
| **Frigo Magic** | Toujours gratuit et sans compte, mais copyright 2025 affiché — maintenance possiblement ralentie |

**Ce que ça dit** : le besoin est identifié par le marché (la vague d'imitation le prouve), et
personne ne l'exécute. Les défauts cités chez Cooklist — recettes incomplètes, doublons, ingrédients
manquants — sont exactement ceux qu'un **catalogue éditorialisé et un moteur déterministe** évitent
par construction.

### 6.3 ⛔ Le changement d'argumentaire : arrêter de vendre « sans IA »

**Le marché ne rejette pas l'IA.** Samsung Food, Tasty et SuperCook la revendiquent, avec de bonnes
notes. Vendre le principe 4 comme un refus de principe ne portera pas — et sonnera passéiste.

**Mais les échecs documentés de l'IA en production sont exactement ceux que le moteur empêche :**

> **Tasty a suggéré des crevettes à une utilisatrice ayant coché « éviter les crustacés »** — avis
> App Store du **27/07/2026**. Une IA qui ignore une allergie déclarée.

C'est notre argument, et il est **factuel, pas idéologique** : **déterministe, auditable, sûr sur les
allergies**, chaque suggestion explicable en une phrase (principes 1, 3 et 4 réunis). Formulation à
reprendre dans `STRATEGIE_DISTRIBUTION.md` §2 — pas « je refuse l'IA », mais **« je ne peux pas me
tromper sur ton allergie »**.

### 6.4 Deux fermetures à garder en réserve

- **Yummly est mort** : équipe licenciée en **avril 2024**, service coupé en **décembre 2024**, le
  domaine redirige vers KitchenAid (Whirlpool). Confirmé aussi par son absence des résultats App
  Store en 2026.
- Hors périmètre recettes mais même leçon : **Encircle Home Inventory** (17/12/2025) et **Centriq**
  ont fermé en moins d'un an, avec export imposé et perte des photos non téléchargées une par une.

→ L'argument **« local = jamais de fermeture, jamais d'export en urgence »** est désormais étayé par
des faits datés, au lieu d'être une conviction.

### 6.5 ⚠️ Jow — signal fort, NON CONFIRMÉ

Le flux d'avis officiel d'Apple montre une concentration de **1 étoile les 12-14 août 2026** :

> « Après des années à utiliser Jow gratuitement, on nous réclame un abonnement pour continuer. Cette
> perte de fonctionnalité est honteuse, on perd accès à des années de recettes et listes. »
> — *Jujumaze, 1★, 14/08/2026*
>
> « Je ne peux plus accéder à mes catégories et listes enregistrées sans souscrire un abonnement. »
> — *Mawinu, 1★, 12/08/2026*

⛔ **Une vérification ciblée n'a rien corroboré** : pas de communiqué Jow, `jow.fr/premium` en 404,
aucune couverture presse trouvée, Reddit et Trustpilot bloqués. Une fiche App Store montrait des
paliers de **2,99 €/mois à 34,99 €/an**, mais avec un contenu probablement en cache.

**À traiter comme un signal daté, pas comme un fait acquis** — et à revérifier à la main. Si ça se
confirme, le leader français du meal-planning gratuit vient de faire payer.

### 6.6 Sources ajoutées le 2026-08-16

- Paprika — [avis App Store (flux RSS officiel)](https://itunes.apple.com/us/rss/customerreviews/id=1303222868/sortBy=mostRecent/json)
- Cooklist — [avis App Store](https://itunes.apple.com/us/rss/customerreviews/id=1352600944/sortBy=mostRecent/json)
- Tasty (cas de l'allergie) — [avis App Store](https://itunes.apple.com/us/rss/customerreviews/id=1217456898/sortBy=mostRecent/json)
- SuperCook — [avis App Store](https://itunes.apple.com/us/rss/customerreviews/id=1477747816/sortBy=mostRecent/json)
- Jow — [avis App Store FR](https://itunes.apple.com/fr/rss/customerreviews/id=1301257625/sortBy=mostRecent/json) · [jow.fr](https://jow.fr)
- Yummly (fermeture) — [Wikipedia](https://en.wikipedia.org/wiki/Yummly)
- Mealie (IA) — [docs.mealie.io](https://docs.mealie.io/documentation/getting-started/features/) ·
  Tandoor (IA) — [docs.tandoor.dev](https://docs.tandoor.dev/features/ai/)
- Contexte complet et limites de la passe : `G:\Claude\strategie_applis\sessions\RECAP_2026-08-16.md` §9.1

---

## Sources

- SuperCook — [avis App Store](https://apps.apple.com/us/app/1477747816?see-all=reviews&platform=iphone) ·
  [JustUseApp](https://justuseapp.com/en/app/1477747816/supercook-recipe-by-ingredient/reviews)
- Marmiton — [notes et avis App Store](https://apps.apple.com/fr/app/marmiton-recettes-de-cuisine/id318796083?see-all=reviews&platform=iphone)
- Frigo Magic — [App Store](https://apps.apple.com/fr/app/frigo-magic-cuisine-antigaspi/id977681072) ·
  [test La Fée Biscotte](https://www.lafeebiscotte.com/test-avis-application-android/application-frigomagic/)
- ⛔ Sources intéressées, voir l'avertissement en tête : [Recipy](https://recipyapp.com/blog/best-pantry-tracking-apps-2026) ·
  [mise](https://trymise.app/blog/pantry-inventory-app) · [Pann](https://www.pann-app.com/blog/supercook-review) ·
  [Sously](https://sously.app/blog/best-pantry-inventory-app-real-kitchens/)
