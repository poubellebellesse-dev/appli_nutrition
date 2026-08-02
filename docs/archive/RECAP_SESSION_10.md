# Récit de session 10 — 2026-08-02 : les quatre défauts, puis le premier essai sur téléphone

> **Instantané daté. Ne jamais réécrire** (voir [README.md](./README.md)). Les chiffres étaient vrais
> le 2026-08-02. État courant : [../FICHE_REPRISE.md](../FICHE_REPRISE.md) et [../ETAT.md](../ETAT.md).
> Backlog ouvert par cette session : [../RETOUR_ESSAI_TELEPHONE.md](../RETOUR_ESSAI_TELEPHONE.md).

⚠️ **Piste parallèle.** Une autre conversation a travaillé sur le même dépôt pendant cette session —
provenance des recettes, `catalog/**`, `savoir.tsx`, `ETAT.md`, `ARCHITECTURE.md`, récit en
[RECAP_SESSION_9.md](./RECAP_SESSION_9.md). Les périmètres se recouvrent sur `user-recipe.ts`,
`detail-recette.tsx` et `engine/selection/test-fixtures.ts`. Chaque commit de cette session-ci a
vérifié ce qu'il prenait ; un a dû être indexé **par hunks** (voir §5).

**950 → 1080 tests verts** (69 → 75 fichiers). 14 lots.

---

## §1. Les quatre défauts laissés en plan le 2026-08-01

Corrigés en un lot (`efd270f`). Aucun n'était là où la fiche le disait.

1. **`seed` n'était consommé par aucune couche.** Le diagnostic annoncé — « il manque un
   branchement » — était faux. **Le moteur n'avait aucune source d'aléa** : le départage se faisait
   par identifiant alphabétique, et `seed` traversait six types pour finir recopié dans
   `EngineDiagnostics`. Il fallait donc en créer une, pas en rebrancher une. PRNG seedé
   (`selection/prng.ts`) tirant dans une bande de tolérance sous le meilleur score, plus un flux
   **dérivé par créneau** — les 14 créneaux partageaient sinon la même suite. Mesuré : 20 créneaux
   différents sur 21 entre deux graines.
2. **`readLatestPlan` triait les id en texte.** `meal_plan` n'avait **aucune** colonne de date :
   le tri n'avait rien à quoi se raccrocher. Migration v7, `mis_a_jour_le`, horodatage passé **en
   paramètre** à `savePlan` puisque le moteur ne lit jamais l'heure.
3. **`energieParPortion` rendait `null` sur les 241 recettes.** `createEngine` enrichissait le
   catalogue dans sa fermeture sans jamais le réexposer, et `socle.ts` retournait le brut. `Engine`
   expose désormais `catalogue`, et `socle.catalogue` lit celui-là : l'invariant tient par
   construction. 288,6 kcal vérifiés sur `artichauts_vinaigrette`.
4. **La visite guidée n'était pas branchée.** Migration v7, `visite_proposee`.

---

## §2. Le premier essai sur un vrai téléphone

Servi en preview LAN, ouvert dans Chrome Android. **Une quarantaine de remarques**, consignées et
triées dans [../RETOUR_ESSAI_TELEPHONE.md](../RETOUR_ESSAI_TELEPHONE.md).

⚠️ **Deux limites de la méthode, à ne pas refaire :**

- **Chrome n'est pas la WebView Capacitor.** Le risque n°1 du projet — `rem` et la police système à
  150 % — **n'a pas été tranché** et ne peut pas l'être ainsi.
- **`http://192.168.x.x` n'est pas un contexte sécurisé**, donc OPFS y est indisponible. L'alerte
  « cet appareil ne permet pas d'enregistrer » vue pendant l'essai était **un artefact de la
  méthode**. Bonne méthode : `adb reverse tcp:4173 tcp:4173` puis `http://localhost:4173`.

---

## §3. Ce que la session a appris — cinq motifs, tous récurrents

**(a) Une capacité anticipée et jamais branchée, six fois.** Ce n'est plus une coïncidence, c'est le
mode de fonctionnement du dépôt : la donnée ou l'API arrive avant l'usage, puis personne ne revient.

| Capacité | Depuis quand elle dormait |
|---|---|
| `saveUserRecipe` faisait déjà `ON CONFLICT DO UPDATE` | modifier sa recette était pourtant impossible |
| `StoredExtraItem.quantite` | colonne en base, absente du formulaire |
| `source: 'importe'` | autorisé par la contrainte SQL, absent du type TypeScript |
| `gouter` | `FIN_DE_CRENEAU`, `TITRE_CRENEAU`, `MealSlot` le connaissaient ; `CRENEAUX_PAR_NOMBRE` l'excluait |
| `note_allergene` | au schéma, lue, écrite par personne |
| `regime` | facette indexée et peuplée, jamais affichée |

**(b) Trois fonctions demandées existaient déjà.** Le réglage de balayage, la complétion de
l'éditeur, la recherche par ingrédient. **C'est un problème de découvrabilité, pas de
fonctionnalité** — et pour la recherche, la cause était nette : le champ s'intitulait « Rechercher
**un plat** » avec trois noms de plats en exemple. L'affordance ne taisait pas la capacité, **elle la
contredisait**.

**(c) Un commentaire n'est pas une garantie — deux fois de plus.** `socle.ts` affirmait que
`createEngine` calculait les index « une seule fois, ici » : vrai dans le moteur, faux pour le champ
exposé à côté. Et `recettes.tsx` justifiait « Rechercher un plat » comme délibéré (§5).

**(d) Un tirage qui ÉCHANGE au lieu de RETIRER casse son propre invariant.** Le premier jet du PRNG
échangeait l'élu avec la position courante, ce qui enterrait le meilleur restant plus loin : au tour
suivant le pivot n'était plus le maximum, et un candidat **hors bande** passait devant le meilleur.
Le test censé verrouiller cet invariant ne portait que sur **deux** candidats — il ne pouvait rien
voir. Trouvé en relecture, pas par les tests.

**(e) Un garde-fou sans source de données ne garde rien — deuxième fois.** `note_allergene` : un
utilisateur ajoutant à la main un aliment de ses allergènes déclarés n'était averti nulle part. Le
correctif a un **périmètre volontairement étroit** — on n'avertit que sur un aliment choisi dans la
complétion, où l'on tient un `FoodId`. Tenter une correspondance sur du texte libre produirait des
faux négatifs silencieux : l'appli paraîtrait vérifier alors qu'elle devine.

---

## §4. Décisions prises, et pourquoi

- **Les fenêtres restent, on ne déplie rien.** L'essai réclamait des facettes dépliables ; la règle
  « plus aucun menu déroulant hors de l'accueil » vient de la contrainte d'âge, pas d'un goût. Le
  vrai reproche — « la cuisine est à deux gestes » — a été traité en **retirant un geste** :
  Cuisine, Régime, Service et Temps en accès direct, chacun ouvrant sa fenêtre.
- **Le tutoriel vit au-dessus du routeur.** Une étape « touchez l'onglet Recettes » fait changer
  d'écran ; monté dans un écran, le tutoriel serait démonté à l'instant où l'utilisateur réussit.
  Détail non anticipé, trouvé à l'implémentation : le calque doit passer en `pointer-events-none`
  quand une étape attend un geste, sinon le clic n'atteint jamais l'application.
- **`#/composer/<id>` a deux sens selon l'id** — catalogue = décalque, `perso:` = modification sur
  place. Pas de seconde route : « ouvrir l'éditeur sur X » est une seule intention.
- **L'import refuse tout `foodId` inconnu.** Un ingrédient absent du catalogue n'apporte aucun
  allergène : la recette traverserait l'exclusion en paraissant sûre. Et **l'id du fichier n'est
  jamais repris**, sans quoi un fichier portant l'id d'une de vos recettes l'écraserait via
  `ON CONFLICT DO UPDATE`.
- **`DESIGN.md` §4.2 amendé** (1-3 → 1-4 repas) **avec sa conséquence écrite** : la maquette « tient
  dense à 3 », un 4ᵉ créneau la densifie encore, rien n'a été réaménagé.

---

## §5. Erreurs de cette session, consignées

- ⛔ **J'ai contredit une décision documentée sans la voir.** Le commit `faf156c` a changé le libellé
  du champ de recherche alors que l'en-tête de `recettes.tsx` justifiait explicitement l'ancien.
  Le changement est maintenu — « j'AI du poulet » est un inventaire, « je VEUX du poulet » est une
  envie, et l'argument d'origine confondait les deux — mais **le fichier s'est contredit lui-même
  jusqu'à ce que l'en-tête soit réécrit**. Lire les en-têtes avant de toucher aux libellés.
- ⛔ **Une interdiction incomplète a contaminé un fichier tiers.** Un agent a modifié
  `engine/selection/test-fixtures.ts`, qui portait déjà une modification du chantier `evidence`. Le
  commit `8a18e25` n'a dû prendre **que nos hunks**, via un patch filtré appliqué à l'index. Quand
  deux pistes travaillent en parallèle, l'interdiction doit énumérer **tous** les fichiers de
  l'autre, pas les plus évidents.
- ⚠️ **Un lot est resté une heure non committé** : `catalog/build.mjs` de la piste parallèle était
  syntaxiquement invalide, le catalogue ne pouvait plus être régénéré et 144 tests tombaient — dont
  ceux du lot. Ne pas commiter ce qu'on ne peut pas vérifier ; attendre.
- ⚠️ **Un flake diagnostiqué, pas contourné.** 144 échecs attribués par un agent à « la lenteur de
  la machine » venaient en réalité de **9 processus node concurrents**. L'hypothèse notée en
  `ETAT.md` §8 se trouve confirmée : ce sont les exécutions parallèles, pas les tests.

---

## §6. Ce qui attend l'utilisateur — rien de tout cela n'est du code

1. **Trancher l'alerte calorique** masquée par défaut : amende la décision 34, prise après mesure.
2. **Trancher les ustensiles et les gestes** : entités du catalogue ou non ? Aucun champ n'existe, et
   les ustensiles ne sont pas une entité — c'est un chantier de modèle, puis de contenu.
3. **`sauce` et `apero`** ne sont pas des valeurs de `CourseKind` et aucune recette n'en porte : le
   filtre demandé suppose d'étendre le domaine **puis** d'écrire le contenu, dans cet ordre.
4. **Retester sur l'appareil.** La complétion de l'éditeur n'a **aucune cause établie** — l'écran a
   été trouvé, la liste n'est pas apparue, et l'hypothèse du clavier ne tient pas (le champ est le
   3ᵉ élément de la page). Rouvrir, taper **au moins deux lettres**, et dire ce qui s'affiche.
5. **Le risque n°1 reste entier.**

Restent aussi bloqués : la **recherche sur les études** (`savoir.tsx` non committé par la piste
parallèle) et l'**import depuis une URL**, l'autre moitié de §8.7.
