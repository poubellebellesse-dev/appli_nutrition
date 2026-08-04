# Extraits datés de la fiche de reprise — sortis le 2026-08-03

> **Instantanés. Ne jamais réécrire, ne jamais s'en servir pour établir l'état courant** —
> celui-ci est dans `../FICHE_REPRISE.md` et `../ETAT.md`.
> Ces trois sections vivaient dans `FICHE_REPRISE.md` ; elles décrivent des faits vrais à leur
> date, pas l'état du projet. **Contenu repris à l'identique.**
> Les sujets restent traités au fond dans `../RETOUR_ESSAI_TELEPHONE.md` et `../SOURCES_RECETTES.md`.

---

## ✅ Les quatre défauts du 2026-08-01 sont corrigés (2026-08-02)

1. **`seed` est consommé.** PRNG seedé (`engine/selection/prng.ts`) qui tire dans une bande de 3 %
   sous le meilleur score, et `plan-week.ts` dérive un flux **par créneau** (`derive(seed, slotKey)`)
   — sinon les 14 créneaux partageaient la même suite. Mesuré : **20 créneaux différents sur 21**
   entre deux graines, plan strictement identique à graine égale.
2. **`readLatestPlan` trie sur une horloge.** Migration **v7** : `meal_plan.mis_a_jour_le`, renseignée
   par `savePlan`, qui prend l'horodatage **en paramètre** — le moteur ne lit jamais l'heure.
3. **`energieParPortion` rend la vraie valeur.** `Engine` expose `catalogue` (l'enrichi) et
   `socle.catalogue` lit CELUI-LÀ. 288,6 kcal sur `artichauts_vinaigrette`.
4. **La visite guidée est branchée.** Migration v7 : `user_display.visite_proposee`, posé dans les
   **deux** branches (accepter et refuser). Cibles d'étapes passées aux `data-visite` — l'étape 2
   était aussi fragile que la 3ᵉ signalée : elle visait `article` nu, réutilisé dans 4 écrans.

**Une suite laissée de côté, sciemment** : `savePlan` ne purge pas les plans obsolètes. La
**lecture** est juste même si de vieilles lignes traînent ; une purge toucherait des
`ON DELETE CASCADE`, donc à décider à part.


## 📱 Premier essai sur téléphone (2026-08-02)

Fait en preview LAN. Une quarantaine de remarques, **14 lots livrés dans la foulée** — récit complet :
[archive/RECAP_SESSION_10.md](./RECAP_SESSION_10.md). L'essentiel : les 12 suggestions qui ne
changeaient jamais (`diversify` ignorait la graine), le retour de fiche recette, les recettes sans
rapport dans le frigo, l'encart d'aide qui comptait les clics au lieu des plats vus, le rythme à
4 repas, le choix du créneau, « Mes recettes » avec modification / export / import, les filtres
(Service, Régime, Envergure — et « Plus de filtres » qui contient enfin *d'autres* filtres), le
tutoriel devenu participatif, et l'avertissement allergène sur les articles ajoutés à la main.
L'étape « Installez l'application », désactivée le 2026-08-01, est rétablie — c'est elle qui fait
accorder le stockage persistant.

⚠️ **Deux leçons de cette session, à ne pas repayer** (§3 du récit) : **six capacités étaient déjà
en place et jamais branchées** (`ON CONFLICT DO UPDATE` sur `saveUserRecipe`, `quantite`,
`source: 'importe'`, le créneau `gouter`, `note_allergene`, la facette `regime`) — chercher ce qui
existe avant d'écrire ; et **trois fonctions réclamées existaient déjà**, ce qui a ouvert un chantier
« découvrabilité » que personne n'avait demandé.

- ⚠️ **Le risque n°1 n'est TOUJOURS pas tranché.** Un essai en preview passe par Chrome, pas par la
  WebView Capacitor : le pari `rem` → police système à 150 % reste à vérifier là où il compte.
- ⚠️ **Une alerte « cet appareil ne permet pas d'enregistrer » en preview LAN est un ARTEFACT** :
  OPFS n'existe qu'en contexte sécurisé (`https://` ou `localhost`), pas sur `http://192.168.x.x`.
  Pour tester vraiment : `adb reverse tcp:4173 tcp:4173`, puis `http://localhost:4173` sur l'appareil.
- ⚠️ **Le reste du retour d'essai — une trentaine de demandes produit — est dans
  [RETOUR_ESSAI_TELEPHONE.md](../RETOUR_ESSAI_TELEPHONE.md)**, avec trois chantiers transverses
  (filtres, complétion à la saisie, tutoriels participatifs). ✅ **Les deux amendements qui
  attendaient un arbitrage sont tranchés** (2026-08-02, décisions 45 et 46) : l'alerte calorique
  **n'apparaît plus qu'en mode avancé** — `afficher_macros`, le réglage qui existait déjà, et **pas**
  un second drapeau ; les facettes **ne se déplient pas**, leurs valeurs fréquentes passent en
  pastilles dans le flux. ⚠️ La décision 45 est **la seule du projet qui retire une protection** :
  `ARCHITECTURE.md` §6.5 est amendé, la réserve est écrite aux deux endroits.


## 🧾 Provenance des recettes (2026-08-02, session 9)

**Les 241 recettes ont été écrites par un modèle de langage** — aucune source, aucun test. C'était
le seul contenu du dépôt sans traçabilité, et **rien ne le disait**. Récit complet :
[archive/RECAP_SESSION_9.md](./RECAP_SESSION_9.md) · chantier :
[SOURCES_RECETTES.md](../SOURCES_RECETTES.md).

Ce qui existe désormais : table **`recipe_source`** (N sources par recette, types `provenance` ⇄
`reference`), colonne **`recipe.teste_le`**, et le champ **`origine`, OBLIGATOIRE sur toute recette**
(2026-08-02). **41 recettes sourcées sur 241** (2026-08-03), **`teste_le` à 0 — mais 241 sur 241 ont
une origine.**

**`origine` répond à « d'où vient ce TEXTE », question que les sources ne posent pas.** Vocabulaire
fermé : `maison` (écrite pour cette application — les 241), `domaine_public`, `libre`. Le build refuse
une recette sans origine, refuse un `maison` portant une `provenance`, et refuse un
`domaine_public`/`libre` sans `provenance`. **Il ne demande AUCUNE recherche de source** : c'est ce
qui permet de couvrir 241/241 sans rien fabriquer.

⚠️ **Défaut corrigé du même coup, et il valait la peine** : la mention d'origine ne s'affichait que
si la recette n'avait AUCUNE source. **Vérifier une recette effaçait donc la phrase qui disait d'où
venait son texte** — sur les 14 recettes sourcées, le lecteur voyait « Consulté pour vérifier : *Le
Guide culinaire*, 1903 » et pouvait conclure que la blanquette en VENAIT. Elle s'affiche désormais
toujours.

⚠️ **`RecipeOrigine` couvre DEUX espaces de valeurs disjoints, à ne pas confondre.** `maison |
domaine_public | libre` pour le catalogue — seules acceptées par `build.mjs` et par le `CHECK` SQL ;
`utilisateur | partagee` pour les recettes de `user.db`, dérivées de `stockee.source` et **jamais
écrivables dans un YAML**. Une recette reçue par `.nutri-recipe` a prétendu « écrite pour cette
application » le temps d'une relecture : c'est exactement le mensonge que ce champ existe pour
empêcher.

⚠️ **Le refus des blogs culinaires est devenu MÉCANIQUE.** L'`url` d'une source doit être sur un
domaine de `DOMAINES_SOURCE_AUTORISES` (`build.mjs`) — comparaison sur le nom d'hôte parsé, avec
frontière de label, verrouillée par des tests de contournement. Ce n'était jusqu'ici qu'une phrase
dans `SOURCES_RECETTES.md` §6, que rien n'appliquait.

**Ce que la vérification a trouvé** : 8 recettes à risque sur 10 ne donnaient **aucun critère de
cuisson vérifiable** (corrigées d'après le guide du ministère de l'Agriculture et la FSA) ; la
blanquette n'avait **pas de liaison aux jaunes d'œufs** (Escoffier 1903 + Anctil 1915), le navarin
et le Marengo pas d'ail. **Les quantités, elles, étaient justes** — roux à 100 g au gramme près,
farine du navarin à 1 g/kg près. L'erreur n'était jamais dans les chiffres, toujours dans un geste.

⚠️ **`teste_le` est à 0 sur 241 : personne n'a jamais cuisiné une recette du catalogue.** Sourcer,
vérifier et tester sont trois choses différentes — voir RECAP_SESSION_9 §3.4.
⚠️ **Ne JAMAIS sourcer une recette après coup** pour faire disparaître la mention : une source
trouvée pour un texte qui n'en vient pas fabrique une provenance. C'est la règle des tips, en plus
fort.
