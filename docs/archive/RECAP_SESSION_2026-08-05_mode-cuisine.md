# Récap — le mode cuisine (2026-08-04 → 2026-08-06)

> **Instantané daté. Ne jamais réécrire, ne jamais citer comme état courant.**
> L'état courant est dans [../FICHE_REPRISE.md](../FICHE_REPRISE.md) et [../ETAT.md](../ETAT.md).
> La spec fait foi dans [../ARCHITECTURE.md](../ARCHITECTURE.md) §5bis ; le plan de montée dans
> [../CONCEPTION_MODE_CUISINE.md](../CONCEPTION_MODE_CUISINE.md).

⚠️ **Piste parallèle.** Deux autres sessions ont travaillé dans le même dépôt sur la même période —
[gardes & décisions](./RECAP_SESSION_2026-08-05_gardes_et_decisions.md) et
[recherche d'aliments](./RECAP_SESSION_2026-08-05_recherche-aliments.md). Aucune ne raconte le
travail des autres. Ce que ce voisinage a coûté est en §5.

---

## 1. Le point de départ, et ce qu'il a fallu refuser

La demande tenait en une phrase : **« un mode sans contact, pour que la recette se lance toute
seule »**. Elle a été instruite, puis **refusée en tant que telle** — et c'est la décision qui tient
tout le reste.

Ce qui l'a tranchée n'est pas un avis : neuf modes d'échec relevés sur douze foyers observés
([arXiv 2306.09992](https://arxiv.org/abs/2306.09992)) — perte de la vue d'ensemble, surcharge
sonore, reprise de main au mauvais moment. L'avancement automatique est ce que les gens réclament
spontanément et ce qui échoue en cuisine réelle. Le pilotage vocal est **exclu, pas différé** : il
ajoute en prime une permission micro qui fissure le principe 2.

Ce qui a été livré à la place : **une étape à la fois, qui n'avance que sur un appui.**

⚠️ **Un test existe pour protéger cette décision contre une régression bien intentionnée**
(`screens/cuisine.test.tsx`, « les étapes n'avancent JAMAIS seules »). Quelqu'un réimplémentera
l'avancement automatique de bonne foi un jour : le test est là pour l'arrêter et le renvoyer ici.

---

## 2. Ce que la mesure a démenti — la partie qui ne se reconstitue pas

Sept affirmations que j'avais écrites ou pensées, et que la vérification a cassées. Elles sont
listées parce que chacune aurait produit du code ou de la doc faux si elle était passée.

| Ce que j'ai affirmé | Ce que la mesure a rendu |
|---|---|
| « Il faudra auditer les 241 recettes pour l'ordre du préchauffage » | **31 recettes** mentionnent un préchauffage, **29 dès l'étape 1**. L'audit était deux ordres de grandeur plus petit que ce que j'annonçais |
| « `recipe_step_ingredient` peut se dériver au build, comme `lexicon_ids` » | **Faux deux fois.** `food` n'a ni synonyme ni alias, et le texte des étapes n'emploie pas les identifiants du catalogue (« les poivrons » ≠ `poivron_rouge`, « saler » ne rapproche rien). Et `lexicon_ids` n'est pas dérivé : il est **écrit à la main** puis validé au build. Le prérequis A est donc du CONTENU, pas du câblage |
| « Le principe 2 interdit la cuisine partagée entre appareils » | **Corrigé par l'utilisateur**, et il avait raison : « hors ligne » veut dire *pas de serveur qui récupère les données*, pas *pas de radio*. L'appli fait DÉJÀ sortir des données à l'initiative de l'utilisateur (`.nutri-recipe`, codé). L'exclusion a été réécrite pour reposer sur le COÛT, pas sur un principe qu'elle ne violait pas |
| « Le Wake Lock tombe quand l'appli perd le focus » | Il tombe quand le document devient **`hidden`**. En fenêtres côte à côte, le document reste visible et **le verrou tient** — ce qui rend l'écran partagé utilisable, exactement ce qu'on croyait perdu |
| « 1 118 étapes à annoter » (écrit dans le plan) | **1 119**, et surtout **1 101 gestes** : les 18 avertissements n'ont pas d'ingrédient. Le build sort désormais le compte à chaque passage — il n'y a plus de chiffre à recopier |
| « La reprise sera une migration v9 » | La v9 a été prise **le même jour** par une autre piste. C'est une **v10**. Voir le piège consigné dans [../reference/PIEGES.md](../reference/PIEGES.md) |
| « `pause_restant_s` nullable suffit comme discriminant » (esquisse du plan) | Avec `fin_ms NOT NULL`, une ligne en pause **garde une échéance périmée, lisible par erreur**. Les deux colonnes sont nullables et mutuellement exclusives par `CHECK` |

### 2 bis. Un résultat d'essai que j'ai refusé d'enregistrer

L'utilisateur a rapporté deux échecs sur appareil : pas de vibration, et « les 150 % ne changent
rien ». **Je ne les ai pas consignés — l'instrument était en cause dans les deux cas.**

- Le test de vibration attendait 5 secondes après l'appui : l'activation utilisateur transitoire a
  pu expirer entre-temps. Refait avec un bouton « Vibrer MAINTENANT ».
- Le test de police visait la **taille de police d'Android**, alors que **Chrome a sa propre mise à
  l'échelle du texte** (⋮ → Paramètres → Accessibilité) ; et un `text-size-adjust: 100%` dans un
  reset l'aurait de toute façon neutralisée.

Après correction de la sonde : la vibration est **restée morte** (donc ce n'était pas l'expiration
de l'activation — hypothèse écartée), et **le pari `rem` n'a pas été remesuré**. Il est consigné
**NON MESURÉ**, ni réussi ni échoué. ⚠️ **C'est le seul résultat manquant dont l'échec déborderait
très au-delà du mode cuisine** : les neuf écrans reposent dessus.

---

## 3. Ce qui ne se reconstitue pas : pourquoi l'alarme ne sonne pas en arrière-plan

C'est le cœur de la session, et le raisonnement coûte plus cher à refaire qu'à lire.

**Le problème en une phrase :** un minuteur de cuisine doit sonner à la seconde pendant que le
téléphone dort, et **« posé, immobile, écran éteint » est la définition même du mode Doze**, qu'Android
a conçu pour supprimer exactement ces réveils. Le cas d'usage est le cas d'école que le système
combat.

Les quatre voies ont été instruites une par une :

| Voie | Pourquoi elle tombe |
|---|---|
| `allowWhileIdle` — **déjà en place** pour les rappels de repas | En Doze : **une notification toutes les 9 min par appli**. Correct à ±10 min pour un rappel ; inutilisable pour 8 min de pochage |
| `SCHEDULE_EXACT_ALARM` | ⚠️ **Ce n'est pas une fenêtre d'autorisation.** Aucun « Autoriser / Refuser » : l'appli ne peut que projeter l'utilisateur dans *Paramètres › Applis › Accès spécial › Alarmes et rappels*, où il doit trouver l'appli, basculer un interrupteur et revenir seul. Pour un public « toutes tranches d'âge », disqualifiant |
| `USE_EXACT_ALARM` | Aucune friction, accordée à l'installation — mais **Play refuse la publication** hors applis d'agenda et de réveil. Le test est « *core, user facing functionality* », et notre fiche Play dira « nutrition ». **Le refus tombe à la soumission, après tout le travail** |
| Service de premier plan | **Aucun `foregroundServiceType` ne convient** : `shortService` plafonne à ~3 min, les autres sont caméra / position / média / santé. Reste `specialUse` → déclaration en Play Console **avec lien vidéo**, re-jugée **à chaque mise à jour**. Et le plugin Capacitor existe mais est **payant** et annoncé pour Capacitor 4 quand le projet est en 8 |

⚠️ **Les Live Updates d'Android 16 ne sauvent pas la quatrième voie** — c'est l'**affichage**, pas le
moteur : le travail derrière tourne toujours sur un service de premier plan.

**Ce qui remplace l'alarme :** la reprise. On ne sonne pas, mais **au retour on ne ment pas**. C'est
le point 7 de §5bis, et c'est la seule règle du mode dont une erreur porterait sur de la nourriture.

⚠️ **Aucune de ces voies n'est enterrée.** `USE_EXACT_ALARM` reste rejouable — c'est une ligne de
manifeste, pas une réécriture.

### Ce que fait la concurrence, et pourquoi ce n'est pas un précédent

Paprika sonne appli fermée. Détail révélateur : **sa page d'aide ne demande à l'utilisateur de
toucher AUCUN réglage système** — donc elle ne passe pas par `SCHEDULE_EXACT_ALARM`. Reste
`USE_EXACT_ALARM` ou l'imprécision assumée. ⚠️ **Déduction, pas preuve : son manifeste n'a pas été
lu.** Et c'est une appli native payante, sans aucune de nos contraintes.

---

## 4. L'essai sur appareil — ce qu'il a tranché

Environnement : **Chrome Android, PAS la WebView applicative**, sur une maquette cliquable hors
dépôt portant les six vraies étapes de la chakchouka.

| Mesuré | Résultat |
|---|---|
| Déverrouillage audio sur le geste | ✅ **Validé.** Le son sort, et un contexte déverrouillé le reste — il sonne encore plusieurs minutes après l'appui. C'était le point le plus fragile de la spec |
| Signal visuel | ✅ **Inversion de tout l'écran retenue**, contre cadre clignotant, bandes latérales, aplat plein écran et balayage |
| Arrêt sur appui n'importe où | ✅ Validé |
| Vibration | ❌ **Rien.** Reste un bonus, jamais un canal |
| Pari `rem` à 150 % | ⚠️ **NON MESURÉ** (voir §2 bis) |

⚠️ **Le protocole compte autant que le résultat** : téléphone posé **de côté**, regard fixé devant.
**De face, les cinq variantes marchaient** — un essai de face n'aurait rien départagé. La vision
périphérique ne voit ni le détail ni la couleur : elle voit le **mouvement** et le **changement de
luminance sur une grande surface**. L'inversion change les deux d'un coup, d'où `steps(1)` et non un
fondu, qui étalerait le changement et perdrait ce que l'œil détecte.

---

## 5. Ce qui a été livré

### L0 — `recipe_step.nature` (2026-08-05)

18 recettes portaient un avertissement sanitaire compté comme une étape à faire. Sur la chakchouka,
la fiche annonçait « 6 » et promettait un geste **alors que le plat est servi**.

- Colonne `nature` (`geste` | `avertissement`, défaut `geste`), **facultative en YAML** — 223
  recettes n'en portent pas, et la rendre obligatoire aurait mis du bruit sur 1 101 lignes.
- **Deux règles rouges au build.** La seconde est la moins évidente et la plus utile : **un
  avertissement ailleurs qu'en dernière position casse le build**. Il passerait tout contrôle de
  forme, puis ferait annoncer un nombre d'étapes juste pour un déroulé faux.
- La fiche recette sort la mention de la liste numérotée, dans un bloc `alerte-*`.

Mesuré : **1 119 étapes · 1 101 gestes · 18 avertissements**.

⚠️ **L0 a été committé dans `c17af24`, dont le message ne parle que de la recherche** — voir §6.

### L1 — l'écran (2026-08-05)

`#/cuisine/<id>`, atteint par « Cuisiner pas à pas » sous la préparation.

| Fichier | Rôle |
|---|---|
| `data/user-schema.ts` | Migration **v10** : `user_cuisine_session` + `user_cuisine_timer` |
| `data/user-store.ts` | `readCuisineSession` / `writeCuisineSession` / `clearCuisineSession` |
| `ui/cuisine-session.ts` *(non prévu au plan)* | **La logique pure du point 7**, extraite pour être testable sans DOM |
| `ui/ecran-allume.ts` | Wake Lock, re-demandé sur `visibilitychange`, dégradation muette |
| `ui/alarme.ts` | Son + vibration + arrêt automatique à 5 min. **Aucun rendu** |
| `ui/reprise-cuisine.tsx` *(non prévu)* | Le bandeau, sorti d'`aujourdhui.tsx` |
| `ui/screens/cuisine.tsx` | L'écran |
| `ui/theme.css` | L'inversion, avec son `prefers-reduced-motion` |
| `ui/router.tsx`, `ui/main.tsx`, `screens/detail-recette.tsx`, `screens/aujourdhui.tsx` | Le branchement |

**Trois écarts assumés au plan**, tous consignés dans `CONCEPTION_MODE_CUISINE.md` :

1. **v10 et non v9** (§2).
2. **`fin_ms` et `pause_restant_s` mutuellement exclusifs par `CHECK`** — en marche il n'existe
   qu'une échéance, en pause qu'un reste. La garantie vient de la forme, comme `hors_catalogue`.
3. **`parcours.ts` n'a PAS reçu d'entrée de visite guidée**, contrairement au plan. La visite
   présente des écrans qu'on atteint par la barre d'onglets ; le mode cuisine s'ouvre depuis une
   fiche. ⚠️ **À trancher, pas à oublier.**

**Un neuvième test s'est imposé à l'écriture, absent du plan :** ⛔ **l'alarme ne sonne PAS pour un
minuteur déjà échu à l'ouverture.** Sans lui, reprendre une cuisson déclenche la sonnerie pour un
plat sorti du feu depuis quarante minutes — le mensonge du point 7 retourné en son contraire sonore.

### La question du routeur, rouverte puis refermée

`#/cuisine/<id>` est la **troisième route paramétrée**, et `router.tsx` exigeait de rouvrir à ce
seuil la question d'une bibliothèque de routage. **Rouverte, réponse : toujours non** — même motif
que les deux autres (préfixe + id encodé, aucune imbrication), six lignes, et `react-router-dom` est
bâti sur l'History API quand ce projet route par hash pour une raison qui ne changera pas (PWA
servie hors ligne, aucun serveur pour réécrire les URL). ⚠️ **Ce qui la rouvrirait vraiment : une
route qui en imbrique une autre**, pas un quatrième cas plat. Le raisonnement est **dans le
fichier**, pas seulement ici.

---

## 6. Mes erreurs

- **L1 a failli ne pas être committé.** Il l'a été en clôture, dans `2c10db4` — 21 fichiers, dont
  neuf neufs. ⚠️ **Deux corrections ont été nécessaires avant de pouvoir le faire**, et elles disent
  ce que coûte le travail à deux dans un même dépôt :
  1. **Mon propre fichier de test avait été modifié par l'autre piste** pour dépendre de son
     `confianceDeTest()` — non committé. Committer L1 seul aurait donné un arbre **rouge**. Découplé
     en fournissant une table de confiance vide, ce qui est juste ici : le mode cuisine n'affiche
     aucune valeur nutritionnelle, donc aucune provenance à coter.
  2. **Quatre documents étaient mixtes** (`FICHE_REPRISE`, `ETAT`, `PIEGES`, `archive/README`) :
     laissés hors du commit plutôt que découpés à la main — c'est le découpage manuel qui avait
     poussé `main` rouge la veille. L'autre piste les a committés ensuite, mon texte compris.
- ✅ **Le commit a été vérifié SUR LE COMMIT**, sorti dans un worktree isolé avec son catalogue
  rebâti : **1 492 passed (84 fichiers)**, typecheck propre, build ✓. ⚠️ **Un test a échoué au
  premier passage puis est passé au second** (`main.test.tsx`, dialogue de visite guidée, sous la
  charge du build) — **bascule de minutage à surveiller**, consignée plutôt que tue.

- **L0 a été emporté par le commit d'une autre session.** `c17af24 feat(recherche): « lardon »
  trouve enfin la poitrine de porc` contient **40 fichiers** : ses 9 et mes 31. Rien n'est perdu,
  mais **le journal ment par omission** — qui cherchera « quand `recipe_step.nature` est-il arrivé ? »
  lira un message qui parle de lardons. Décision de l'utilisateur : **laisser tel quel**, ne pas
  réécrire l'historique sur `main` avec une autre session active dessus.

- **J'ai fait pire avant.** Un commit antérieur de la même journée avait déjà emporté du travail
  d'autrui. La parade appliquée ensuite : **ne jamais `git add -A`**, stager les chemins un par un,
  et extraire au besoin le seul hunk qui m'appartient. ⚠️ Elle a ses propres dangers — voir
  `PIEGES.md` § « Ce qu'on commite n'est pas ce qu'on a testé ».

- **J'ai affirmé un volume d'audit sans le mesurer** (241 au lieu de 31) et **inventé un mécanisme
  de dérivation qui n'existe pas** (§2). Les deux ont été corrigés avant d'atteindre le code, mais
  les deux étaient dans la doc quand je les ai écrits.

- **J'ai attribué au principe 2 une interdiction qu'il ne porte pas**, et il a fallu que
  l'utilisateur me corrige. La correction est écrite **dans deux documents** pour que l'erreur ne
  soit pas re-commise par relecture.

---

## 7. Ce qui reste ouvert

| # | Question | État |
|---|---|---|
| — | **Committer L1** | ⛔ **Non fait.** Neuf fichiers non suivis + sept modifiés |
| — | **Essai sur appareil de l'écran RÉEL** | À faire, **en HTTPS** : son au premier appui, écran qui ne s'éteint pas, inversion vue de côté. L'instrument n'est plus la maquette |
| — | **Le pari `rem` à 150 %** | ⚠️ **NON MESURÉ.** Le seul dont l'échec toucherait les neuf écrans |
| — | **Entrée de visite guidée pour le mode cuisine** | À trancher (§5) |
| L2 | Prérequis A — `food_ids` sur **1 101 gestes** | Non commencé. **Du contenu, pas du code** ; méthode en 3 passes dans le document de conception |
| L3 | Quantité au tap sur un ingrédient | Dépend de L1 ✅ + L2 |
| L4 | v1.5 — synchronisation multi-recettes | Dépend de L1 ✅ |
| C | Démarrer une cuisson depuis « Aujourd'hui » autrement que pour reprendre | Dépend de L4 |
| D | Le seuil de péremption du bandeau (12 h) | Arbitraire, posé faute de mieux. À revoir au premier retour d'usage |
| E | Cuisine partagée sur plusieurs appareils | **v2.** ⚠️ Pas interdit par le principe 2 (§2) — bloqué par le coût |

---

## 8. Une phrase à retenir

**Le mode cuisine ne sonne pas quand l'appli est fermée, et c'est écrit noir sur blanc à quatre
endroits pour que personne ne le prenne pour un oubli.** Ce qu'il fait à la place — dire la vérité
au retour plutôt que d'afficher un décompte figé — est la seule partie du mode où une erreur
porterait sur de la nourriture. C'est aussi la seule dont la logique vit hors de React, pure et
testée sans navigateur.
