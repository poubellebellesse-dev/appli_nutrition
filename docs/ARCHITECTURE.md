# Architecture — Application Nutrition & Santé

> Document de référence. Toute décision technique qui contredit ce document doit être
> discutée et le document mis à jour, pas contourné.

**Statut** : spécification v1, à valider
**Date** : 2026-07-22
**Contexte** : publication publique visée → le cadre réglementaire (§6) est contraignant, pas indicatif.

---

## 1. Principes directeurs

Six principes, par ordre de priorité. En cas de conflit, le plus haut gagne.

1. **Sécurité de l'utilisateur.** L'appli filtre et informe. Elle ne diagnostique pas, ne traite
   pas, ne remplace pas un professionnel de santé.
2. **Souveraineté des données.** Aucune donnée utilisateur ne quitte l'appareil. Pas de compte,
   pas de serveur, pas de télémétrie.
3. **Traçabilité.** Toute affirmation santé est rattachée à une source citée. Toute suggestion de
   repas est explicable en une phrase.
4. **Déterminisme.** Aucune IA générative. Le moteur est un solveur sous contraintes : mêmes
   entrées → mêmes sorties, auditable ligne par ligne.
5. **Fonctionnement hors-ligne intégral.** La connexion ne sert qu'à mettre à jour l'application
   et son catalogue.
6. **Informer, jamais juger.** L'application décrit un aliment, elle ne le note pas. Aucun score
   global, aucun code couleur, aucun aliment « sain » ou « mauvais ». Voir §6.5.

---

## 2. Périmètre

### v1 — Le produit utile
- Onboarding : consentement, installation, allergies/régime, découverte des goûts, rythme
- Catalogue de recettes avec photos
- Moteur de suggestion de repas (contraintes + scoring + explication)
- **Planning à fenêtre glissante de 2 à 14 jours**, à partir de n'importe quel jour
- Liste de courses générée depuis le planning, rangeable par rayon / repas / jour
- Ajustement des proportions
- **Mode « vider le frigo »**
- **Lexique de gestes de cuisine illustré**
- **Repas d'occasion** (fêtes nationales, saisonnières, religieuses — désactivables)
- **Mode avancé** : macros visibles, strictement descriptif (§6.5)
- Tip du jour
- Export / import de sauvegarde
- **Import d'une recette** (URL/collage, usage perso local — faits + lien source, §8.7) *(v1/v2 à confirmer)*
- **Partage de recette** entre utilisateurs par fichier autonome (P2P, sans serveur, §8.7) *(v1/v2 à confirmer)*
- **Favoris** · **commentaires locaux** par recette/étape, exportables avec le partage *(v1/v2 à confirmer)*
- **Mode cuisine** : étape courante, minuteurs et écran allumé, **une recette à la fois** *(v1,
  §5bis)* ; suivi **multi-recettes** et synchronisation du service *(v1.5, §5bis)*

> La fenêtre de planification descend à **2 jours** : un utilisateur qui part en week-end doit
> pouvoir ne planifier que samedi et dimanche, sans attendre le lundi suivant.

### v2 — La bibliothèque santé
- Fiches scientifiques vulgarisées avec niveau de preuve et sources
- **Thématiques santé consultables** (diabète type 2, hypertension…) : l'utilisateur navigue,
  l'appli ne demande rien. Voir §6.2.
- Filtre optionnel « appliquer ces critères à mes suggestions », activé manuellement
- Liaison recette ↔ fiche ↔ thématique

### v3 — Optionnel
- Estimation des coûts (référentiel de prix moyens embarqué + correction utilisateur)
- Gestion du garde-manger

### Hors périmètre — explicitement écarté
| Écarté | Raison |
|---|---|
| Scraping des prix supermarchés | Exige un backend → casse le principe 2. Fragile et juridiquement gris. |
| Comptes utilisateurs / synchronisation | Exige un serveur détenant des données de santé → risque maximal. |
| IA générative embarquée ou distante | Non déterministe, non auditable → viole les principes 3 et 4. |
| Objectifs de perte de poids, IMC affiché comme jugement | Vecteur documenté de troubles du comportement alimentaire. Voir §6.5. |
| Scan de code-barres (v1) | Dépend d'Open Food Facts en ligne. Reporté. |
| **Collecte de problèmes de santé** | Remplacée par les thématiques consultables (§6.2). L'appli ne demande, ne déduit et ne stocke aucune pathologie. |
| **Communauté hébergée** (feed, commentaires agrégés) | Exige un serveur → casse le principe 2. Remplacée par le partage P2P par fichier (§8.7). |

---

## 3. Stack technique

| Couche | Choix | Justification |
|---|---|---|
| **Cible** | PWA installable | Un codebase → mobile + PC. Pas de Mac requis pour iOS. Pas de store. |
| **Framework** | React 19 + Vite + TypeScript | Écosystème le plus large, meilleure compatibilité Capacitor. *Alternative plus légère : Svelte 5.* |
| **Routage** | React Router (mode SPA) | Pas de SSR : aucune donnée ne doit transiter par un serveur. |
| **UI** | Tailwind CSS + shadcn/ui | Composants copiés dans le repo, pas une dépendance opaque. Contrôle total du rendu. |
| **Base de données** | SQLite WASM (`@sqlite.org/sqlite-wasm`) sur OPFS | Catalogue livré en fichier `.db` pré-construit. Export = copie binaire du fichier. |
| **Offline** | Service worker (Workbox) | Cache applicatif complet. L'appli fonctionne avion. |
| **Tests** | Vitest | Le moteur (§5) doit être couvert à ≥90 %. |
| **Porte de sortie** | Capacitor | Empaquette le même code en app iOS/Android/desktop si besoin, sans réécriture. |

### Contrainte d'architecture non négociable

**Le moteur est du TypeScript pur, sans aucune dépendance UI ni DB.** Il reçoit des objets en
entrée, retourne des objets en sortie. Conséquences : testable sans navigateur, réutilisable si
l'UI change, et surtout **auditable** — condition nécessaire pour défendre le §6.

```
engine/  ← ne doit JAMAIS importer depuis react, sqlite, ou features/
```

---

## 4. Modèle de données

### 4.1 Séparation stricte catalogue / utilisateur

Deux bases SQLite distinctes. Cette séparation est la garantie qu'une mise à jour de l'appli ne
peut pas détruire les données personnelles.

| Base | Fichier | Cycle de vie |
|---|---|---|
| **Catalogue** | `catalog.db` (livré avec l'app, lecture seule) | Remplacé intégralement à chaque release |
| **Utilisateur** | `user.db` (OPFS, lecture/écriture) | Jamais touché par une mise à jour. Migrations versionnées uniquement. |

### 4.2 Tables catalogue (lecture seule)

```sql
nutrient(id, code, nom, unite, vnr_adulte, categorie, sens)
    -- sens ∈ {'cible','plancher','plafond'} : RÉEL depuis P1b-2 (CHECK en base, build.mjs).
    --   Dit à la couche `nutri` quel côté de l'écart pénalise : 'cible' punit les deux sens
    --   (énergie, macros) ; 'plancher' ne punit que le manque (fibres, fer, calcium, vitamine C) ;
    --   'plafond' ne punit que le dépassement (sodium). Corrige un écart auparavant SYMÉTRIQUE qui
    --   pénalisait un plat riche en fer pour sa richesse (docs/ENGINE.md §6.5 précision 1).
food(id, code_ciqual, nom, groupe, sous_famille?, saison_mois[], toute_annee, piquant?, origine_animale?, derive_de?)
    -- saison_mois[] + toute_annee : RÉELS depuis P1b-1 (build.mjs + loader). Deux dimensions
    --   INDÉPENDANTES et cumulables : saison_mois = pleine saison (production locale) ;
    --   toute_annee = disponibilité (rayon/conservation). Un légume de garde porte les deux.
    --   La couche `season` les combine en crédits pondérés par quantité (docs/ENGINE.md §6.5
    --   précision 3). Un aliment sans saison_mois est exclu du calcul de saison.
    -- sous_famille : RÉEL depuis 2026-07-27 (docs/ENGINE.md §6.6 quater), NULLABLE et renseigné
    --   seulement là où le catalogue contient plusieurs entrées du MÊME produit de base
    --   (poulet_blanc + poulet_cuisse → 'poulet') : 25 aliments sur 193, 12 familles. Sert la
    --   RÉCENCE de `variety`/`habit`, pas la similarité. Ce n'est PAS le `sous_groupe`
    --   taxonomique de l'esquisse initiale, qui n'existe toujours pas au schéma réel : celui-ci
    --   classerait TOUS les aliments, `sous_famille` n'en regroupe qu'une poignée.
    -- piquant : 0 a 4 (0 pas piquant, 4 extreme). NULL = non renseigne, JAMAIS « doux ».
    --   Pose le 2026-07-28, NON CABLE — aucune couche ne le lit encore.
    -- origine_animale + derive_de : D'OU VIENT L'ALIMENT, en cascade (2026-07-28, decision 39).
    --   origine_animale ∈ {mammifere, volaille, poisson, fruit_de_mer, insecte}, NULL = vegetal,
    --   mineral OU derive. derive_de pointe vers l'aliment source (beurre_doux -> lait_entier) et
    --   l'origine se PROPAGE le long de cette chaine.
    --   ⚠️ POURQUOI : `groupe` ne suffit pas. Le beurre est en « matieres grasses », le miel en
    --   « produits sucres » — aucun groupe animal. Une regime deduite du seul groupe declarait
    --   « Radis au beurre » vegetalienne, et une recette AU MIEL etait etiquetee `vegetalien` au
    --   catalogue. A l'inverse les boissons vegetales portent le groupe « lait et produits
    --   laitiers » sans etre animales.
    --   ⚠️ FACTUEL, PAS UN REGIME : DIET_CHAIN en deduit ce qu'elle veut, un futur filtre halal ou
    --   casher lira le meme champ pour en tirer autre chose. Ne pas y encoder le regime.
    --   La cle etrangere est DEFERRABLE : un derive peut preceder sa source dans foods.yaml.
food_nutrient(food_id, nutrient_id, valeur_pour_100g)
allergen(id, code, nom)                          -- 14 allergènes réglementaires UE
food_allergen(food_id, allergen_id, certitude)   -- 'contient' | 'traces'

recipe(id, nom, description, temps_prep_min, temps_cuisson_min, difficulte,
       portions_base, image_path, types_repas[], saison_mois[], envergure,
       conservation_jours, axe_sucre_sale, axe_leger_consistant,
       axe_chaud_froid, axe_texture)
    -- service : TYPE DE RECETTE (entree/plat/accompagnement/fromage/dessert), REEL depuis le
    --   2026-07-28. ⚠️ AXE ORTHOGONAL A types_repas, PAS une alternative : types_repas dit QUAND
    --   (petit-dejeuner, dejeuner, gouter, diner), service dit QUEL ROLE. Une puree est un
    --   `accompagnement` servi au `dejeuner` ET au `diner` — les deux dimensions se cumulent.
    --   Vouloir « sortir » un accompagnement des creneaux principaux le ferait DISPARAITRE de
    --   l'appli : MealSlot n'a pas de case « accompagnement ». Ordre de service francais, le
    --   fromage AVANT le dessert. Les 241 recettes sont annotees (144 plats, 39 entrees,
    --   37 desserts, 21 accompagnements, 0 fromage — mesure du 2026-07-29).
    -- piquant : idem food.piquant, mais EDITORIAL au niveau du plat — il ne se derive pas des
    --   ingredients (quantite d'epice, rapport au reste, mode de cuisson). NON CABLE.
    -- envergure ∈ {'quotidien','convivial','fete'}
    -- temps total = dérivé, JAMAIS une facette saisie (pas de désynchronisation possible)
recipe_ingredient(recipe_id, food_id, quantite_g, unite_affichage, optionnel)
recipe_step(recipe_id, ordre, texte, lexicon_ids[], timer_s, timer_type, nature)   -- timer_type ∈ {'cuisson','repos'} optionnel (mode cuisine §5bis)
    -- nature ∈ {'geste','avertissement'}, défaut 'geste'. Un avertissement se lit, ne se fait pas :
    -- hors de tout compteur d'étapes, et TOUJOURS en dernier (le build refuse l'inverse).
recipe_facet(recipe_id, facette, valeur)          -- cuisine | regime | occasion | style — vocabulaire fermé ('style' inclut 'loufoque')
recipe_equipment(recipe_id, equipment_id, niveau)  -- 'requis' (→ exclusion) | 'accelere' (→ score) | 'informatif' (ustensile, jamais chargé par le moteur)

equipment(id, code, nom, categorie, image_path)   -- categorie ∈ {'gros_electromenager','ustensile','moule','cuisson'}
    -- robot, mixeur, four (requis/accelere) ; fouet, fourchette (informatif → lexique matériel)

lexicon_entry(id, code, terme, definition)
lexicon_media(lexicon_id, ordre, role, media_path, media_type, legende, equipment_id)
    -- role ∈ {'avant','pendant','apres','echec','etat','variante'}
    -- media_type = 'webp-anime' (boucle 3 s, §8.5) | 'mp4' (clip 3 s, gestes à risque)
    -- equipment_id : relie une variante d'outil (ex. « battre au fouet ») à l'ustensile

recipe_media(recipe_id, ordre, type, media_path, media_type)
    -- type ∈ {'hero_photo','photo','hero_video'} — vidéo seulement sur les recettes du jour (§8.3)

substitution(food_id, alt_food_id, ratio, contexte)   -- échange d'ingrédient SECONDAIRE
    -- alimente scaleRecipe / suggestSubstitutions ; l'ingrédient principal n'est jamais substituable
    -- toute substitution déclenche un RECALCUL des allergènes de la recette

occasion(id, code, nom, famille, activee_par_defaut)
    -- famille ∈ {'nationale','religieuse','saisonniere','etrangere'}
occasion_date(occasion_id, annee, date)           -- table figée sur 10 ans (§8.6)
occasion_recipe(occasion_id, recipe_id)

evidence_sheet(id, titre, resume_vulgarise, niveau_preuve, date_revue, categorie)
    -- niveau_preuve ∈ {'forte','moderee','faible','preliminaire'}
evidence_source(sheet_id, titre_etude, auteurs, annee, revue, doi, url, type_etude)
evidence_link(sheet_id, cible_type, cible_id)     -- food | nutrient | health_topic

health_topic(id, code, titre, resume_vulgarise, autorite_reference,
             date_revue, diete_suggeree)
    -- chapitre de bibliothèque consultable, PAS un attribut de l'utilisateur
    -- diete_suggeree : renvoie vers un réglage de régime quand une éviction stricte
    --                  s'impose (ex. cœliaque → « sans gluten »). Voir §5.2.
topic_criterion(id, topic_id, sens, cible_type, cible_id, seuil, unite,
                evidence_sheet_id NOT NULL, autorite NOT NULL)
    -- sens ∈ {'LIMITE','PRIVILEGIE'} — jamais 'EVICTION' : critère de score, pas de filtre
topic_recipe(topic_id, recipe_id)                 -- exemples de repas illustrant le chapitre

tip(id, texte, categorie, source_url)             -- nutrition_humaine | nutrition_animale | biologie_aliment
```

> **`evidence_sheet_id NOT NULL` sur `topic_criterion` est une contrainte de sécurité, pas de
> modélisation.** Il devient structurellement impossible d'introduire un critère santé non sourcé.

> **`tip.source_url` suit la même logique, et est `NOT NULL` depuis le 2026-08-01.** La colonne
> figurait ici dès l'origine mais n'avait jamais été implémentée ; les 8 premiers tips ont été
> sourcés rétroactivement pour la rendre applicable. Le build refuse un tip sans lien http(s)
> (`catalog/build.mjs`, `validateCatalog`). La contrainte ne dit rien de la QUALITÉ de la source —
> le niveau d'exigence éditorial vit dans `catalog/tips/README.md`, et il est délibérément plus bas
> que celui de `catalog/evidence/`.

> **⚠️ SCHÉMA RÉEL DEPUIS 2026-07-31 — les tables `evidence_*` sont CODÉES, et étendues.** Exposer
> plusieurs points de vue par fiche (décision du 2026-07-31 : une fiche = une question + N positions
> sourcées) a imposé deux tables absentes ci-dessus, **`evidence_position`** (un niveau de preuve et
> un `porte_par` par position) et **`evidence_position_source`** (jonction position → sources), plus
> trois colonnes sur `evidence_source` : `consulte_le`, `effectif` et `financement`. Ce dernier
> reproduit la déclaration de financement publiée — c'est ce qui permet de savoir qu'une
> méta-analyse a été payée par le secteur qu'elle évalue. Le même raisonnement que ci-dessus s'y
> applique : **une position sans source fait échouer le build**. `health_topic` et `topic_criterion`
> n'existent toujours pas. Détail et règles d'écriture : `catalog/evidence/README.md`.

### 4.3 Tables utilisateur (lecture/écriture)

```sql
user_profile(id, tranche_age, sexe, taille_cm, poids_kg, niveau_activite,
             facteur_portion, cree_le)
user_allergy(allergen_id, severite)               -- contrainte d'éviction, pas une pathologie
    -- severite : texte LIBRE et NON LU par le moteur — engine/selection/allergenes.ts exclut dès
    --   qu'un allergène est déclaré, traces comprises, sans gradation (§5.2). Conservée pour
    --   l'affichage, jamais pour une décision.
user_diet(code)
    -- UNE SEULE ligne (id = 1 en base) : DIET_CHAIN est une chaîne d'inclusion, déclarer deux
    --   régimes n'a pas de sens, et `HardConstraints.diet` est un scalaire nullable.
user_excluded_food(food_id)                       -- AJOUT 2026-07-30 (CODÉ)
    -- Rejet personnel DURABLE d'un aliment, lu par la couche `exclusions` via
    --   `HardConstraints.excludedFoodIds`. Manquait à ce tableau : aucune table ne portait ce
    --   réglage, alors que le champ existe depuis P0. À ne PAS confondre avec `user_preference`
    --   à −2 (« je n'aime pas », pondéré) ni avec `MealContext.requiredFoodIds`, son miroir dur,
    --   qui est PONCTUEL et n'a donc volontairement aucune table (§6.5 ter ENGINE).
user_preference(cible_type, cible_id, score)      -- -2 (déteste) … +2 (adore)
    -- lignes cible_type='food' : lues par SuggestionRequest.preferences (ReadonlyMap<FoodId,
    --   number>, docs/ENGINE.md §8.1, CODÉ P1b-2) — champ OBLIGATOIRE consommé par la couche de
    --   score `preference` (§6.5 ENGINE précision 4). Map vide = aucune préférence connue.
user_active_topic(topic_id, active_le)            -- filtre d'affichage choisi, révocable (§5.3)
user_favorite(recipe_id, ajoute_le)               -- marque-page rapide ; n'influence pas le moteur par défaut
user_recipe_note(recipe_id, etape_ordre, texte, cree_le)  -- commentaire local par recette/étape
    -- etape_ordre NULL = note générale ; exportable (opt-in) avec le partage ; jamais sur un serveur
user_recipe(id, source, contenu_json, importe_le) -- recette perso/importée/variante, TOUJOURS « non vérifié »
    -- source ∈ {'perso','importe','variante'} ; contenu autonome, hors garanties du catalogue sourcé

user_signal(id, recipe_id, type, creneau, jour_semaine, mois, date)
    -- type ∈ {'aime','naime_pas','envie'} — SIGNAL DE PRÉFÉRENCE, PAS UN JOURNAL (§6.5)
    -- aucune quantité, aucune notion de repas manqué, saisie toujours facultative
user_pantry(food_id, quantite_approx)             -- « vider le frigo », effacé à volonté
user_equipment(equipment_id)                      -- ce que l'utilisateur possède
user_display(afficher_macros, occasions_actives[])  -- macros : false par défaut (§6.5)

meal_history(date, creneau, recipe_id, origine)    -- AJOUT 2026-07-30 (CODÉ)
    -- origine ∈ {'choisi','reste'}, NOT NULL. Manquait à ce tableau : l'origine était décrite en
    --   prose ci-dessous sans qu'aucune table ne puisse la porter, alors que `habit` et `variety`
    --   n'ont pas d'autre source. Clé (date, creneau, recipe_id) — un créneau porte plusieurs
    --   plats en mode repas.
    -- AUCUNE COLONNE DE QUANTITÉ, jamais : c'est ce qui sépare cette table d'un journal (§6.5).
    -- La fenêtre de 21 jours glissants (§13 ENGINE) est appliquée à la LECTURE
    --   (`data/user-store.ts`, readHistory) : aucune couche du moteur ne lit `windowDays`.

meal_plan(id, date_debut)
meal_plan_entry(plan_id, date, creneau, service, recipe_id, portions, verrouille, est_reste,
                hors_catalogue)
    -- hors_catalogue : AJOUT v9 (décision 51, 2026-08-05). Libellé libre d'un plat que
    --   l'application ne sait pas mesurer — plat préparé, traiteur, restaurant. Non-NULL =
    --   « créneau REMPLI, apport INCONNU », l'état qu'aucune colonne ne savait dire ; vide reste
    --   recipe_id NULL ET hors_catalogue NULL. Le libellé EST le marqueur : pas de booléen à
    --   côté, qui pourrait le contredire.
    -- ⚠️ CHECK (recipe_id IS NULL OR hors_catalogue IS NULL) — porter les deux est
    --   structurellement inexprimable, pas seulement découragé.
    -- ⚠️ AUCUNE COLONNE D'ÉNERGIE, et c'est l'arbitrage : l'issue (b) de la décision 51 a été
    --   écartée, un nombre tapé par l'utilisateur se mêlerait aux valeurs CIQUAL sans provenance
    --   (principe 3). La journée qui contient un tel créneau sort du contrôle §6.5 plutôt que
    --   d'y entrer avec un chiffre inventé.
    -- service : NULL en mode recette (un plat unique), sinon 'entree' | 'plat' | 'dessert' |
    --   'accompagnement' (mode repas, §2.7 CONCEPTION_B_VIN_REPAS) ; la clé s'étend à
    --   (plan_id, date, creneau, service)
    -- ⚠️ cette clé est un INDEX UNIQUE sur COALESCE(service, ''), PAS une PRIMARY KEY : SQLite
    --   laisse passer les doublons sur une colonne NULL d'une PK (deux NULL n'y sont jamais
    --   égaux), ce qui aurait autorisé deux plats sur le même créneau en mode recette.
    -- est_reste : AJOUT 2026-07-30 (CODÉ) — `MealPlanEntry.isLeftover` (§7.3 ENGINE) n'avait pas
    --   de colonne ; un plan relu depuis la base aurait perdu la trace de ses restes.
shopping_list(id, plan_id, genere_le)
shopping_list_item(list_id, food_id, quantite_totale, unite, coche, prix_estime)

-- Cuisson en cours — AJOUT v10 (mode cuisine §5bis, lot L1, 2026-08-05). CODÉ.
user_cuisine_session(id, recette_id, ordre_courant, ouverte_le)
    -- id = 1 : UNE seule cuisson. La v1 est mono-recette ; la v1.5 fera sauter la contrainte.
    -- ouverte_le en ms epoch — la péremption du bandeau de reprise (12 h) est une soustraction.
user_cuisine_timer(session_id, ordre, fin_ms, pause_restant_s)
    -- ⚠️ fin_ms est une ÉCHÉANCE ABSOLUE, JAMAIS un temps restant. Un restant se fige quand
    --   l'application est fermée ; la casserole, elle, ne fait pas de pause. Au retour, un
    --   restant figé afficherait « il reste 4 min » sur un plat qui cuit depuis quarante :
    --   l'appli mentirait à propos de nourriture. Voir §5bis point 7.
    -- ⚠️ CHECK ((fin_ms NOT NULL AND pause_restant_s NULL) OR (fin_ms NULL AND pause_restant_s
    --   NOT NULL)) — en marche il n'existe qu'une échéance, en pause qu'un reste. Les deux à la
    --   fois est structurellement inexprimable, comme hors_catalogue ci-dessus.
    -- ON DELETE CASCADE depuis la session → écriture par INSERT … ON CONFLICT DO UPDATE, JAMAIS
    --   INSERT OR REPLACE (reference/PIEGES.md : REPLACE supprime avant de réinsérer).

-- Articles NON alimentaires (conçu session 2, PAS CODÉ — à créer quand buildShoppingList
-- existera, P1c+). Table SÉPARÉE de food : aucun nutriment, aucun allergène structuré, jamais
-- éligible comme ingrédient de recette. Branchée uniquement sur la liste de courses.
shopping_extra_item(id, list_id, libelle, rayon, quantite, coche, note_allergene)
    -- rayon ∈ 10 valeurs (texte libre, pas d'enum figée) : hygiène & soin · cheveux/rasage/beauté
    --   · nettoyage & maison · lessive & linge · vaisselle & cuisine jetable · maison & bureau
    --   · animaux · bébé · pharmacie & premiers soins · vêtements & textile
    -- note_allergene : texte libre OPTIONNEL (« contient : arachide ») — informatif, jamais
    --   filtrant ; le système structuré des 14 allergènes UE reste réservé à food (ce qu'on mange)

user_price(food_id, prix_par_kg, saisi_le)        -- v3
consent(version_texte, accepte_le)
app_meta(schema_version, catalog_version, dernier_export_le)
```

**Historique — origine `choisi` / `reste`.** Chaque entrée d'historique consommée par le moteur
(`MealHistoryEntry`) porte une origine : `choisi` (le plat proposé a été retenu) ou `reste`
(placement automatique d'un reste, §7.3 ENGINE). La couche `variety` lit **toutes** les entrées
quelle que soit l'origine (un reste mangé lasse autant qu'un plat choisi) ; la couche `habit` ne
compte que les entrées `choisi` (un reste n'est pas une préférence exprimée) — §6.5 ter ENGINE,
§2.7 CONCEPTION_B_VIN_REPAS. Ces entrées vivent dans `meal_history` ci-dessus.

**Aucune clé étrangère vers le catalogue.** `food_id`, `recipe_id`, `allergen_id` et `topic_id` sont
du TEXT nu : les tables référencées vivent dans un **autre fichier** (`catalog.db`) et SQLite ne
contraint pas entre bases. C'est le prix de la séparation de §4.1 — un identifiant devenu inconnu
après une mise à jour du catalogue est un cas **normal**, à ignorer, jamais une erreur.

**Migrations.** `app_meta.schema_version` est le seul compteur (pas de `PRAGMA user_version`, deux
compteurs divergent). `app_meta` est bootstrappée à la version 0 avant la boucle de migration —
elle ne peut pas être créée par la migration qu'elle sert à choisir. Chaque migration s'applique
dans **sa propre transaction**, `UPDATE app_meta` compris : le DDL de SQLite étant transactionnel,
une migration interrompue laisse la base à sa version précédente, jamais à moitié migrée. Le schéma
complet de ce tableau est créé dès la **v1**, y compris les tables sans consommateur — une
migration est gratuite tant que la base est vide, et coûteuse ensuite.

**Base en mémoire, fichier sur OPFS — et non un VFS OPFS de SQLite.** Corrigé le 2026-07-30 après
échec en navigateur (« Missing required OPFS APIs »). Les **deux** VFS OPFS de sqlite-wasm
(`opfs` et `opfs-sahpool`) testent `FileSystemFileHandle.prototype.createSyncAccessHandle`, déclaré
`[Exposed=DedicatedWorker]` : la méthode **n'existe pas** hors d'un Worker dédié, quelles que soient
les en-têtes COOP/COEP. Déplacer SQLite dans un Worker rendrait tous les accès asynchrones, alors
que `data/user-store.ts`, ses tests et les écrans reposent sur des lectures **synchrones**.

`user.db` est donc chargé en mémoire au démarrage (`sqlite3_deserialize`, comme `catalog.db`) et
réécrit en entier sur OPFS après chaque modification, via `createWritable()` — disponible, elle, sur
le thread principal. Trois contreparties, à connaître :

- la base entière est réécrite à chaque écriture (sans conséquence à cette taille) ;
- l'écriture est différée d'un tour de boucle d'événements, indispensable pour ne pas exporter au
  milieu d'une transaction — une fermeture d'onglet dans cet intervalle perd la dernière modification ;
- deux onglets ont chacun leur copie et le dernier qui écrit gagne, **sans erreur**. À traiter par
  `navigator.locks` avant tout usage réel.

Un échec d'écriture est remonté à l'interface (`surErreurDePersistance`) : asynchrone et détaché du
geste de l'utilisateur, il serait sinon totalement muet.

**Pas de chiffrement applicatif.** Aucune donnée de santé n'étant collectée, `user.db` ne contient
que des préférences alimentaires et un gabarit corporel. Le chiffrement du système d'exploitation
suffit ; ajouter une clé applicative n'apporterait que de la complexité et un risque de perte de
données. L'exclusion des backups cloud (§6.6) reste en revanche obligatoire.

> `user_active_topic` mérite une nuance : mémoriser « filtre diabète actif » constitue une
> inférence sur l'utilisateur. C'est un **réglage d'affichage** qu'il a lui-même choisi, jamais
> une donnée déclarée, et il est révocable en un tap. La donnée ne quitte pas l'appareil.

---

## 5. Le moteur de suggestion

### 5.1 Nature du problème

Ce n'est pas de l'IA : c'est un **problème de satisfaction de contraintes suivi d'un classement
multi-objectifs**. Formulation en 4 étapes.

### 5.2 Étape 1 — Filtrage dur (élimination)

Une recette est **exclue sans appel** si l'une de ces conditions est vraie :

| Règle | Source |
|---|---|
| Contient un allergène déclaré | `user_allergy` |
| Incompatible avec le régime déclaré | `user_diet` |
| Contient un aliment personnellement exclu (ingrédient non-optionnel seulement) | `HardConstraints.excludedFoodIds` |
| Ne contient pas tous les aliments exigés (conjonctif ; un ingrédient optionnel satisfait l'exigence) | `MealContext.requiredFoodIds` — contexte « Aujourd'hui » seulement |
| Temps de préparation > temps disponible | contexte |

Ce filtre n'est **jamais** pondéré ni contournable. Une allergie n'est pas un critère de score.

> **Aucune thématique santé ne peut produire un filtre dur.** Un filtre dur signifierait « l'appli
> a jugé ce plat dangereux pour vous » — exactement l'individualisation que §6 écarte. Quand une
> éviction stricte est réellement nécessaire (maladie cœliaque → gluten), le chapitre renvoie vers
> le réglage de **régime** correspondant, que l'utilisateur active lui-même. La frontière reste
> nette : le régime est un choix déclaré, la thématique est une lecture.

### 5.3 Étape 2 — Scoring (0 à 100)

```
Score = Σ (poids_i × critère_i)
```

| Critère | Mesure |
|---|---|
| `S_nutri` | Adéquation aux apports de référence **restants** sur la journée / semaine |
| `S_pref` | Moyenne pondérée des préférences sur ingrédients et tags |
| `S_envie` | Distance sur les axes sensoriels demandés (sucré/salé, léger/consistant, chaud/froid, texture) |
| `S_variete` | Pénalité si la recette **ou un plat de composition proche** apparaît dans les N derniers jours. ⚠️ L'esquisse disait « son ingrédient principal » : **mesuré faux** — 194 paires sur 290 partageaient un ingrédient le plus lourd avec des compositions très différentes (une mousse au chocolat rendait « récentes » des galettes de sarrasin). Règle réelle : chevauchement de signature repliée par sous-famille, second déclencheur par famille, filtre de créneau — `ENGINE.md` §6.6 quater et quinquies |
| `S_saison` | Bonus produits de saison au mois courant |
| `S_criteres` | **Uniquement si une thématique est active** : bonus `PRIVILEGIE`, malus `LIMITE`. Jamais d'exclusion. Poids nul par défaut. |
| `S_cout` | v3 — pénalité au-delà du budget par repas |

`S_criteres` est le seul critère qui dépend d'un choix explicite : tant qu'aucune thématique n'est
activée, son poids vaut 0 et le moteur ignore complètement le volet santé.

Poids par défaut définis en constantes, ajustables via un petit jeu d'**archétypes nommés** —
choisis à l'onboarding, modifiables dans les Paramètres (P3). Généralise l'idée initiale de
« je privilégie : équilibre / plaisir / rapidité / budget » sans changer le principe : peu de
préréglages nommés, jamais un réglage curseur par critère. **Détail complet (liste ~6 proposée,
mécanique) : `docs/ENGINE.md` §6.3 bis** — décision de la session du 2026-07-24, pas encore codée.

> Le référentiel détaillé des critères de score (nommage, formules, précisions par couche) vit
> désormais dans `docs/ENGINE.md` §6.5, qui fait foi en cas d'écart avec la table ci-dessus —
> notamment sur `S_nutri` (l'écart pénalise selon le **sens** du nutriment — `cible`/`plancher`/
> `plafond`, §4.2 — et la cible du créneau est dérivée d'une table fixe de part par créneau, pas
> d'un partage égal entre créneaux) et sur `S_envie`/`craving`, dont le poids est **contextuel**
> (n°1 dans « Aujourd'hui » seulement, socle bas en planning semaine, §6.5 ENGINE).

### 5.4 Étape 3 — Diversification

Renvoyer les 5 meilleurs scores produit souvent 5 variations du même plat. Correction :
**pertinence marginale maximale (MMR)** — à chaque tour, on retient la recette qui maximise
`score − λ · similarité(r, déjà retenues)`.

> ⚠️ Cette esquisse décrivait auparavant un **regroupement** par ingrédient principal + famille de
> cuisine avec un représentant par groupe. Ce n'est pas ce qui a été implémenté : `docs/ENGINE.md`
> §6.6 spécifie une boucle MMR pondérée sur trois signaux, codée en P1c
> (`engine/selection/{similarity,diversify}.ts`), et **c'est ENGINE.md qui fait foi**. Différence de
> fond : le MMR arbitre en continu score contre redondance, là où un regroupement écarte d'office
> tout un groupe même quand ses membres sont excellents.
>
> ⚠️ **Les poids cités ici étaient faux** (« ingrédient principal 0,5 · sensoriel 0,3 · cuisine
> 0,2 »). MESURÉ le 2026-07-27 : cette répartition laissait le sensoriel et la cuisine fabriquer
> **50 % de similarité entre deux plats sans aucun ingrédient commun**. Valeurs réelles :
> **composition 0,80 · sensoriel 0,15 · cuisine 0,05** — et le premier signal n'est plus « le même
> ingrédient principal » (catégoriel) mais le chevauchement continu de deux signatures de
> 3 ingrédients. `ENGINE.md` §6.6 bis et ter.

### 5.5 Étape 4 — Explication

Pour chaque suggestion, les **3 critères de plus forte contribution** sont convertis en phrase :

> « Proposé car : riche en fer · correspond à votre envie de plat rapide · légumes de saison »

Quand une thématique est active, l'explication cite le critère **et son autorité** :

> « Correspond au critère *limiter les sucres rapides* — recommandations ANSES, diabète de type 2 »

Cette explication n'est pas cosmétique : c'est ce qui rend le système auditable par l'utilisateur
et défendable juridiquement.

> ⚠️ **CODÉ (P1c, `engine/selection/explain.ts`) — règle de non-citation, qui ÉTEND cette
> esquisse.** `explainSuggestion` reçoit l'ensemble des candidats scorés du créneau, pas une
> recette isolée : c'est ce qui permet de savoir quelles couches **discriminent réellement** entre
> eux. Une couche dont la contribution est identique sur tous les candidats — cas d'un profil neuf,
> où `preference`, `craving` et `variety` rendent alors le même score neutre à tout le monde — n'est
> **jamais citée**, quelle que soit sa contribution : citer « proche de vos goûts » à quelqu'un dont
> l'appli ne sait rien serait faux et contraire au principe 6. Moins de trois couches
> discriminantes → moins de trois phrases, jamais de remplissage ; aucune → liste vide. Détail
> complet : `docs/ENGINE.md` §6.7.

### 5.6 Planning 7 jours

Algorithme **glouton, jour par jour**, avec l'état nutritionnel cumulé de la semaine réinjecté à
chaque créneau. Chaque repas peut être verrouillé ou relancé individuellement.

> Une optimisation globale sur 21 repas est NP-difficile *et* incompréhensible pour l'utilisateur
> (changer une préférence rebat toutes les cartes). Le glouton + reroll manuel est le bon
> compromis : rapide, stable, contrôlable.

**Complexité** : `O(|recettes| × |critères|)` par créneau. Avec ~500 recettes → quelques
millisecondes. Aucune optimisation prématurée nécessaire.

### 5.7 Liste de courses

Agrégation des `recipe_ingredient` du planning → conversion en unités d'achat → regroupement par
rayon. Arrondi aux conditionnements courants (on n'achète pas 43 g de beurre).

### 5bis — Mode cuisine (couche UI, hors moteur)

Écran de présentation par-dessus le moteur : il ne calcule rien, il montre une recette **déjà
choisie** à quelqu'un qui a les mains occupées. **Découpé en deux livraisons** (décision 8 de
`ETAT.md`, tranchée le 2026-08-04) :

| | Périmètre | Statut |
|---|---|---|
| **v1** | Une recette à la fois : écran allumé, étape courante, minuteurs, quantité à la demande | À coder |
| **v1.5** | Plusieurs recettes en parallèle — entrée + plat + dessert, bascule et **synchronisation du service** | Différé |

Le découpage n'est pas un étalement du travail : la v1 ne demande **aucune donnée nouvelle du
moteur** et rend visible ce qui est déjà buildé, tandis que la synchronisation de service est un
problème d'ordonnancement à part entière (`CONCEPTION_B_VIN_REPAS.md` §5).

#### Les sept points de la v1

1. **L'écran ne s'éteint pas** — `navigator.wakeLock.request('screen')`, demandé à l'entrée dans
   l'écran, relâché à la sortie et **re-demandé sur `visibilitychange`**. ⚠️ **Le verrou tombe quand
   le document devient `hidden`, pas quand l'appli perd le focus** : en écran partagé ou sous une
   fenêtre flottante, l'appli reste visible et le verrou tient. Ce qui le relâche, c'est d'être
   entièrement recouverte, ou l'écran verrouillé. Dégradation silencieuse si l'API manque : l'écran
   ne reste pas allumé, rien d'autre ne change.
2. **Une étape à la fois, et l'utilisateur sait où il en est** — position affichée (« 3 sur 6 ») et
   jalons. ⚠️ **Les étapes n'avancent que sur appui** : ni minuterie de défilement, ni carrousel.
   C'est la règle déjà tranchée pour l'accueil (`RETOUR_ESSAI_TELEPHONE.md` §6.5), appliquée ici.
3. **Le minuteur est dans l'étape qui le porte** — `recipe_step.timer_s` / `timer_type`, **plusieurs
   décomptes en parallèle**, et un décompte **survit au changement d'étape**. Un minuteur lancé
   ailleurs reste donc visible depuis l'étape courante, étiqueté par son étape d'origine.
4. **La quantité se lit sans quitter l'étape** — appuyer sur un ingrédient cité par l'étape affiche
   son `unite_affichage`. Même principe que les gestes du lexique, déjà dépliés sur place
   (`detail-recette.tsx`) : personne ne doit perdre son étape pour savoir ce que « pocher » veut dire.
5. **Le minuteur sonne quand l'appli est visible** — **essayé sur appareil le 2026-08-05**, détail
   dans `CONCEPTION_MODE_CUISINE.md`. Trois règles en sont sorties :
   - ⚠️ **L'audio se déverrouille sur l'appui « Lancer », pas à l'expiration.** La WebView refuse une
     lecture sans geste utilisateur préalable et **ce refus ne lève aucune erreur** — un minuteur
     muet en production, sans rien dans les logs. Vérifié : un contexte déverrouillé le reste, le son
     sort bien plusieurs minutes après l'appui.
   - **Le signal visuel est l'INVERSION de tout l'écran**, ~2 Hz. Retenu à l'essai contre quatre
     autres (cadre, bandes latérales, plein écran, balayage) sur le seul critère qui compte : être vu
     **du coin de l'œil**, téléphone posé de côté. La vision périphérique ne perçoit ni détail ni
     couleur mais réagit aux écarts de luminance sur de grandes surfaces — l'inversion en donne le
     maximum **sans masquer le contenu**, contrairement à l'aplat plein écran.
   - **La vibration est un bonus, pas un canal sur lequel compter.** `navigator.vibrate` n'a rien
     produit sur l'appareil d'essai, ni immédiatement ni en différé. La voie native
     (`@capacitor/haptics`) est probablement la bonne, mais **elle n'est pas installée** et rien ne
     doit dépendre d'elle. L'alarme reste correcte avec le son et l'inversion seuls.
6. **L'alarme sonne jusqu'à ce qu'on l'arrête** — **un appui n'importe où sur l'écran**, pas
   seulement sur un bouton : avec les mains grasses, viser une cible précise est le geste qu'on rate,
   et le coût d'un arrêt accidentel est nul puisqu'on est devant. Garde-fou : **arrêt automatique à
   5 minutes**, pour ne pas laisser un téléphone clignoter sur un plan de travail vide. ⚠️ Une alarme
   qui s'éteint seule au bout de quelques secondes rate exactement la personne partie mettre la
   table — c'est-à-dire son cas d'usage.
7. **La cuisson se reprend** — l'étape atteinte et les minuteurs survivent à la fermeture de
   l'appli, et un bandeau « Reprendre la cuisson » les ramène depuis « Aujourd'hui ».
   ⚠️ **On stocke une ÉCHÉANCE ABSOLUE (`fin_ms`), jamais un temps restant.** Un restant suppose que
   quelqu'un décompte ; appli fermée, personne ne décompte, et le nombre se fige — l'écran
   annoncerait 8 minutes de pochage restantes sur des œufs trop cuits depuis un quart d'heure. La
   casserole, elle, ne fait pas de pause. Au retour, `fin_ms - Date.now()` donne soit le reste réel,
   soit « terminé il y a 4 min » — **jamais « ça vient de sonner »**. Seule la pause, déclenchée par
   l'utilisateur, stocke un reste figé. Schéma : `CONCEPTION_MODE_CUISINE.md`.

#### Ce que la v1 exige avant d'être codable

- ⚠️ **Le lien étape → ingrédient n'existe pas.** Le point 4 n'est pas du câblage. Il demande un
  champ **`etapes[].food_ids`** en YAML et une table `recipe_step_ingredient(recipe_id, ordre,
  food_id)`, **écrits à la main et validés au build** — exactement le régime de `lexicon_ids`
  (authored, puis build rouge sur un identifiant inconnu, `build.mjs:531`). ⚠️ **La dérivation
  automatique par rapprochement de texte a été envisagée et écartée** : `food` n'a ni synonyme ni
  alias, et le texte réel ne contient pas les noms du catalogue — « les poivrons » ne rapproche pas
  `poivron_rouge`, et « saler » ne rapproche rien du tout. Un rapprochement automatique
  silencieusement incomplet est pire que pas de rapprochement. Plan de montée :
  `CONCEPTION_MODE_CUISINE.md`.
- ✅ **Toutes les `recipe_step` ne sont pas des gestes — RÉSOLU le 2026-08-05 (lot L0).**
  `chakchouka` finissait sur un avertissement ANSES compté comme 6ᵉ étape : « 6 sur 6 » promettait un
  geste alors que le plat est servi. `recipe_step.nature` porte désormais la distinction, sur les
  **18 recettes** concernées ; le build refuse une nature inconnue **et** un avertissement ailleurs
  qu'en dernière position. La fiche recette numérote les 1 101 gestes et sort l'avertissement de la
  liste, dans un bloc `alerte-*`.

#### Hors périmètre, et pourquoi

- **Pilotage vocal / mains libres.** C'est ce que les gens réclament spontanément, et c'est ce qui
  échoue en cuisine réelle : neuf modes d'échec relevés sur douze foyers observés
  ([arXiv 2306.09992](https://arxiv.org/abs/2306.09992)) — perte de la vue d'ensemble, surcharge,
  fragmentation, « elle m'a ignoré ». S'y ajoute une raison propre au projet : une permission micro
  fissure le principe 2 (souveraineté) même si tout reste local.
- **Avancement automatique des étapes.** Interdit par le point 2 ci-dessus.
- **Sonner quand l'appli n'est pas visible** — **reporté, pas enterré**. Un minuteur exact en
  arrière-plan exige une alarme exacte Android, et les trois voies ont été vérifiées et coûtent
  toutes cher : `SCHEDULE_EXACT_ALARM` impose un aller-retour dans les réglages système (ce n'est
  **pas** une fenêtre d'autorisation), `USE_EXACT_ALARM` est réservée aux applis d'agenda et de
  réveil et **Play refuse la publication** hors de ces catégories, et un service de premier plan
  n'a **aucun `foregroundServiceType` adapté** (`shortService` plafonne à ~3 min) — il faudrait
  `specialUse`, qui se justifie en Play Console **vidéo à l'appui, à chaque mise à jour**. Le point 7
  couvre le besoin autrement : on ne sonne pas, mais au retour on dit la vérité. Comparatif des
  applis existantes et les quatre voies en détail : `CONCEPTION_MODE_CUISINE.md`.
- **Cuisine partagée sur plusieurs appareils** — deux cuisiniers, deux téléphones synchronisés.
  ⚠️ **Ce n'est PAS interdit par le principe 2** : l'appli fait déjà sortir des données de l'appareil
  à l'initiative de l'utilisateur (partage `.nutri-recipe`, §8.7, codé). La ligne est « pas de
  serveur, pas de collecte, rien sans geste explicite », pas « aucune donnée ne sort ». C'est le
  **coût** qui tranche : plugin natif Bluetooth, permissions à l'exécution, et surtout un problème
  d'état distribué (qui gagne si deux personnes avancent l'étape en même temps ?) pour un cas rare.
  Et le besoin est largement absorbé par un téléphone posé au milieu que tout le monde voit. **v2.**

⚠️ **La cible empaquetée est Android** (décision 9, `ETAT.md`) — Capacitor, `LocalNotifications`
déjà installé. Le web reste au plan pour iOS, où les timers en arrière-plan sont de toute façon non
fiables. **Wake Lock n'est pas un argument pour Capacitor** : l'API est portée par Chromium depuis la
version 84, donc par la WebView Android. ⚠️ **Non vérifié sur appareil**, et c'est la même famille
que le risque n°1 de la décision 9 — un échec y serait SILENCIEUX. L'interdiction de `Date.now` ne
vise que `engine/` ; l'UI utilise l'heure réelle, et le point 7 en dépend.

> Maquette cliquable de l'écran v1 (chakchouka, minuteurs réels, Wake Lock actif) :
> <https://claude.ai/code/artifact/00aae6df-f33d-4cb6-97cf-e11751419e0e>. Hors dépôt — elle illustre
> la spec, elle ne la remplace pas. Elle couvre les points 1 à 6 — **c'est elle qui a servi à
> l'essai du 2026-08-05** et qui a départagé les cinq signaux visuels. Seul le point 7 (la reprise)
> ne s'y voit pas : il suppose une base.

### Fonctionnalités conçues en session 2 — état d'implémentation par point, voir docs/archive/RECAP_SESSION_2.md

- **Rejet personnel d'aliments** — `HardConstraints.excludedFoodIds` est désormais LU par une 5ᵉ
  couche d'exclusion `exclusions` (exclusion dure). Son miroir `requiredFoodIds` (« je veux ça »)
  est désormais **CODÉ** — 6ᵉ couche d'exclusion `requis` (`app/src/engine/selection/requis.ts`) :
  filtre dur en contexte « Aujourd'hui » seulement. Le champ vit dans `MealContext`, pas dans
  `HardConstraints` : `WeekPlanRequest` n'ayant pas de `MealContext`, l'exigence devient
  structurellement inexprimable pour un plan de semaine (§6.5 ter ENGINE).
- **Courses non alimentaires** — table `shopping_extra_item` (10 rayons, ci-dessus) pour faire les
  courses complètes, pas seulement l'alimentaire. Conçue, non codée.
- **Roue des goûts (radar)** — lecture visuelle des 3 axes sensoriels en 6 pôles, par plat et par
  profil ; partage via la carte-image Canvas (§8.7). v1 = pôles sensoriels ; rayons cuisine = v2.
- **Conseils vin & modes recette/repas** (chantier B, en file) — conseil vin = métadonnée
  éditoriale, jamais dans le score ni le calcul nutritionnel, masquable. Mode recette (plat unique)
  vs repas (entrée+plat+dessert avec accords). Une boisson alcoolisée n'est jamais un aliment du
  repas ; un alcool employé **comme ingrédient** de cuisine est agrégé dans le calcul nutritionnel
  comme n'importe quel autre ingrédient (option A, `docs/CONCEPTION_B_VIN_REPAS.md` §1.7) ; comme
  boisson, c'est un article de courses.
- **Scan produit** (OpenFoodFacts, opt-in, jamais les notes façon Yuka) — v2+++++.

---

## 6. Cadre santé & réglementaire

> Section contraignante. Publication publique visée → ces règles conditionnent la légalité du
> produit dans l'UE.

### 6.1 Le choix structurant : bibliothèque, pas questionnaire

**L'application ne demande jamais à l'utilisateur ses problèmes de santé.** Elle propose des
chapitres consultables ; c'est lui qui navigue.

La qualification de dispositif médical (règlement UE 2017/745) ne dépend pas du fait de *parler* de
santé, mais du fait d'**agir sur des données au bénéfice d'un patient individuel**. Les guides
d'interprétation européens (MDCG 2019-11) excluent explicitement la simple **consultation et
recherche d'information**. La bascule est donc :

| Modèle | Nature | Exposition |
|---|---|---|
| ~~« Je suis diabétique » → l'appli calcule mes repas~~ | Traitement individualisé | Zone grise |
| « J'ouvre le chapitre *Diabète de type 2* » | **Encyclopédie** | Hors champ |

Trois conséquences en cascade :
1. **RGPD article 9** (données sensibles) ne s'applique plus — il n'y a rien à collecter.
2. **Le problème des combinaisons disparaît.** Un moteur de règles confronté à *diabète +
   insuffisance rénale* doit arbitrer entre des recommandations contradictoires (le potassium des
   légumes) — et il arbitrerait mal, silencieusement, sur un cas médical réel. Ici, l'utilisateur
   lit les deux chapitres et voit lui-même la tension.
3. **L'onboarding perd son questionnaire santé**, soit l'écran de plus forte perte d'utilisateurs.

Contrepartie assumée : l'appli ne protège personne automatiquement. C'est honnête — elle n'aurait
jamais été assez fiable pour servir de filet de sécurité médical, et l'illusion inverse était plus
dangereuse que son absence.

### 6.2 Règles de rédaction — l'appli n'affirme rien sur l'utilisateur

| ❌ Interdit | ✅ Correct |
|---|---|
| « Votre diabète » | « Recommandations ANSES — diabète de type 2 » |
| « Adapté à votre profil » | « Repas correspondant à ces critères » |
| « Vous devez limiter les sucres » | « Les autorités recommandent de limiter… » |
| « Mangez X pour traiter Y » | « À valider avec votre médecin » |

Vocabulaire **banni** de toute chaîne de caractères de l'application, en deux familles :

| Famille | Termes |
|---|---|
| **Thérapeutique** (§6.1) | *soigne · guérit · traite · prévient la maladie · remède · thérapie*, et tout possessif accolé à une pathologie |
| **Jugement** (principe 6) | *malsain · mauvais pour · à éviter · trop gras · cheat meal · se rattraper · plaisir coupable · aliment sain* |

→ vérifié par un test automatisé bloquant sur les fichiers de contenu (§9). Un seul test couvre les
deux familles.

> **Deux copies synchronisées, garde-fou moteur CODÉ (P1c).** Le lexique vit en source canonique
> dans `catalog/build.mjs` (`BANNED_TERMS`, bloquant sur le contenu édité au build) et en copie
> dupliquée dans `engine/guards/banned-terms.ts` — `engine/` ne peut structurellement pas importer
> `catalog/build.mjs` (§3 : `engine/` n'importe jamais depuis react/sqlite/`features/`, et
> `catalog/build.mjs` est un script Node hors de ce périmètre ; la barrière est vérifiée par
> `tests/engine-boundaries.test.ts`). La non-divergence des deux listes est garantie par
> `tests/banned-terms-consistency.test.mjs`, qui échoue si elles diffèrent — c'est ce test, pas la
> duplication elle-même, qui constitue la vraie garantie. `BANNED_TERMS` est exporté de
> `catalog/build.mjs`, protégé par une garde `isMainModule()` pour que l'import ne déclenche pas
> l'effet de bord `main()` du script de build. Côté moteur, `assertNoTherapeuticClaim`
> (`engine/guards/index.ts`, §5.2 ENGINE) est désormais **CODÉ** : il vérifie qu'aucune
> `Explanation.label` produite par `selection/explain.ts` (§5.5, §6.7 ENGINE) ne contient un terme
> de ce lexique.

### 6.3 Thématiques — liste blanche

Seuls sont acceptés les sujets disposant de **recommandations nutritionnelles publiées par une
autorité de santé** (ANSES, EFSA, HAS, OMS) : intolérances (lactose, gluten), diabète de type 2,
hypertension, hypercholestérolémie, insuffisance rénale, goutte, grossesse.

Tout sujet sans consensus documenté est **refusé**. Pas de « détox », pas de « candidose
chronique », pas de sensibilités non reconnues. Chaque chapitre porte sa `date_revue` et son
autorité de référence en tête.

**Poids et nutrition sportive = chapitres, jamais objectifs moteur.** Les sujets *« Comprendre poids
et alimentation »* et *« Nutrition sportive »* existent en **contenu consultable** (chapitres
sourcés, niveaux de preuve), pas en objectif pilotant les suggestions. Un objectif « perdre 5 kg »
qui ajuste le moteur serait de la restriction personnalisée — vecteur TCA n°1 et retour dans la
zone grise du dispositif médical. La bibliothèque informe ; elle ne fixe aucune cible chiffrée.

Structure de « Comprendre » en **deux niveaux** :

| Niveau 1 — familles | Exemples de chapitres (niveau 2) |
|---|---|
| Les nutriments | glucides · lipides · protéines · fibres |
| Vitamines et minéraux | fer · calcium · vitamine D · B12 |
| Les aliments | légumes · poissons · produits laitiers · ultra-transformés |
| Situations | grossesse · sport · âge · poids |

Un chapitre = un titre sous forme de question → une suite d'**affirmations courtes**, chacune
portant son badge de preuve et dépliable en résumé long + sources cliquables (titre, revue, année,
lien vérifiable). Un filtre en tête permet de n'afficher que les affirmations « preuve forte ».

**Structure d'un chapitre** : résumé vulgarisé → critères alimentaires sourcés → exemples de repas
illustrant ces critères → bouton *Appliquer ces critères à mes suggestions* (révocable) → sources
avec niveau de preuve → rappel de consultation médicale.

### 6.4 Consentement

- Écran d'acceptation **au premier lancement uniquement**, avec la version du texte enregistrée
- Re-consentement **seulement** si le texte change
- Lien discret mais **permanent** « Sources & limites » sur chaque écran de conseil

> Le rappel à chaque démarrage est contre-productif : au troisième lancement l'utilisateur clique
> sans lire, et le consentement perd sa valeur probante autant que son utilité. Un consentement lu
> une fois vaut mieux que dix ignorés.

### 6.5 Garde-fous troubles alimentaires

Les applications de nutrition sont un vecteur documenté de TCA. Contraintes de conception :

- **Plancher calorique** : 1 200 kcal/jour (femme) / 1 500 (homme). ⚠️ C'est un AVERTISSEMENT, pas
  un refus — `checkCalorieFloor` (engine/guards/) rapporte les jours concernés dans
  `WeekPlan.warnings` et le plan est rendu quand même. Une première implémentation levait une
  `EngineSafetyError` et faisait perdre sept jours de planning pour une seule journée légère : plus
  strict que ce texte, et hostile. Les quatre autres garde-fous, eux, annulent bien la sortie.
  ⚠️ **Ce point exigeait un « écran d'avertissement explicite ». Il a été AMENDÉ le 2026-08-02** —
  voir « Affichage de l'avertissement de plancher » plus bas. Le calcul, lui, n'a pas changé.
- **Pas d'IMC affiché** comme jugement de valeur ni de code couleur sur le poids
- **Pas d'objectif de perte de poids** en v1 — l'appli équilibre, elle ne restreint pas
- **Pas de série / streak** ni de culpabilisation en cas de repas non suivi

#### Affichage des macros — le mécanisme précis à interdire

L'affichage optionnel des calories et macros est acceptable. C'est **le compteur de reste
quotidien** qui est le vecteur de restriction, et lui seul doit être proscrit :

| ❌ Interdit | ✅ Autorisé |
|---|---|
| « Il te reste 340 kcal aujourd'hui » | « Cette portion : 520 kcal » |
| Objectif journalier présenté comme cible à atteindre | Apport de référence cité en note |
| Code couleur rouge / vert | Valeur brute, neutre |
| Cumul de la journée mis en avant | Bilan hebdomadaire qualitatif (§10.2 ENGINE) |

`user_display.afficher_macros` vaut **false par défaut**. L'information est consultable sur une
recette ; elle n'est jamais un budget à tenir.

**Le « mode avancé »** (destiné aux sportifs, dit aussi **« mode professionnel »** — c'est le MÊME
réglage, `user_display.afficher_macros`) est le seul réglage qui active cet affichage. Il rend
visibles calories et macros sur les recettes, le total du jour et le bilan de la semaine, **et
depuis le 2026-08-02 l'avertissement de plancher calorique** (voir plus bas).

> ⚠️ **UN SEUL INTERRUPTEUR, ET IL LE RESTE.** La tentation, à chaque nouveau réglage « pour les
> pros », est d'en créer un second. Deux drapeaux produisent quatre états dont deux n'ont aucun
> sens, et la question « ce détail est-il avancé ? » se retrouve tranchée écran par écran. Tout ce
> qui relève du mode avancé passe par `afficher_macros`.

⚠️ **À L'ÉCRAN, CE RÉGLAGE NE S'APPELLE NI « avancé » NI « professionnel ».** C'est la case
**« Afficher plus de détails »** du panneau *Réglages d'affichage* (`ui/screens/parametres.tsx`), et
c'est délibéré : l'amendement du 2026-07-28 exige que l'avancé soit **non mis en avant**, et la cible
du produit — « utilisable par des personnes peu à l'aise avec le numérique » — ne gagne rien à lire
« mode professionnel » dans ses réglages. **Ne cherchez pas un interrupteur portant ce nom : il n'y
en a pas, et c'est voulu.**

#### Objectifs caloriques personnels — AMENDEMENT du 2026-07-28

La version initiale de ce paragraphe interdisait tout objectif journalier, sans exception.
**Décision utilisateur : un objectif personnel devient possible, sous quatre conditions cumulatives.**

| Condition | Raison |
|---|---|
| **Opt-in explicite** | Personne ne le rencontre sans l'avoir cherché |
| **Jamais par défaut** | L'appli reste sans compteur pour qui ne demande rien |
| **Non mis en avant** | Ni onboarding, ni suggestion, ni écran d'accueil — enfoui dans les réglages avancés |
| **Aucun compteur de reste** | Voir ci-dessous : c'est LE mécanisme identifié comme dangereux |

> ⚠️ **La quatrième condition n'est pas négociable et ne relève pas d'une préférence.** Le tableau
> ci-dessus le dit : ce n'est pas l'affichage d'un chiffre qui pose problème, c'est **« il te reste
> 340 kcal aujourd'hui »**. Un objectif peut être affiché *à côté* du total du jour ; il ne doit
> jamais être présenté comme un solde qui se vide. La frontière descriptif / prescriptif reste la
> ligne à ne pas franchir — l'amendement déplace ce qui est permis, pas cette ligne.

#### Affichage de l'avertissement de plancher — AMENDEMENT du 2026-08-02

La version initiale du premier point de cette section exigeait, sous le plancher calorique, un
**« écran d'avertissement explicite »**, sans condition. **Décision utilisateur : l'avertissement
n'est plus affiché par défaut ; il n'apparaît qu'en mode avancé.**

| Ce qui change | Ce qui ne change PAS |
|---|---|
| L'affichage de `WeekPlan.warnings` sur l'écran Semaine | **Le calcul** — `checkCalorieFloor` tourne toujours, à chaque plan |
| Visible seulement si `afficher_macros` est vrai | **`WeekPlan.warnings`** — toujours peuplé, toujours lisible par l'API |
| `alertes_discretes` (v4) devient sans objet, sa case disparaît | Les **quatre autres garde-fous**, qui annulent toujours la sortie |

> ⚠️ **C'est le seul amendement de ce document qui RETIRE une protection au lieu d'en déplacer une,
> et il faut que ce soit écrit ici plutôt que découvert dans le code.** L'amendement du 2026-07-28
> (objectifs personnels) élargissait ce qui est permis sans toucher à la ligne descriptif /
> prescriptif ; celui-ci rend silencieux, pour l'utilisateur ordinaire, un signal que la version
> initiale de §6.5 jugeait nécessaire. La réserve a été posée avant la décision et écartée
> explicitement — `ETAT.md` décision 45.

**Ce qui borne la portée de l'amendement** — ⛔ **RÉÉCRIT LE 2026-08-04, la première version reposait
sur un chiffre faux.** Le texte disait : « la décision 34 a mesuré le cas nominal à 1 208 kcal
minimum, ZÉRO avertissement ; ce qui devient invisible par défaut est un cas rare ». Ce chiffre était
**une mesure sur UNE graine**. Remesuré le 2026-08-03 sur vingt : **0 graine sur 20** y parvenait, et
le cas nominal tournait à 830 kcal avec 4 avertissements sur 7 jours. **L'amendement a donc été
justifié, pendant deux jours, par une propriété que le moteur n'avait pas.** La leçon est consignée
dans `reference/PIEGES.md` : sur ce moteur, une mesure sur une graine ne prouve rien.

Ce qui est vrai, **mesuré le 2026-08-04 sur 20 graines × 7 jours** (`npm run engine:plancher`) :

- Le cas nominal ne déclenche **plus rien : 20/20 semaines sans aucun avertissement**, minimum
  1 331 kcal — depuis que le planificateur pose un accompagnement en plus du plat (`ETAT.md` n°54).
  La cause du déclenchement n'était pas le contenu : le plan comparait des **plats** à une
  **journée**.
- ⚠️ **Ça reste FAUX pour les régimes pauvres en accompagnements** : végétalien 14 j rend encore
  **5 avertissements**, « végétalien + sans gluten » **9**. Ce sont les utilisateurs pour qui
  l'information compte le plus, et ce sont eux qui ne la verront pas. **C'est une limite de CONTENU**,
  et le masquage ne la traite pas.
- Le plan a **toujours été rendu quand même** : l'avertissement n'a jamais bloqué personne. Le
  masquer retire une information, pas une possibilité.

> ⚠️ **CE QUE L'AVERTISSEMENT MESURE, ET CE QU'IL NE MESURE PAS** (précisé le 2026-08-04). Il
> additionne **les recettes posées au plan**, pas l'apport de la personne : ni le pain sur la table,
> ni un yaourt, ni un repas pris dehors — ni le petit-déjeuner quand le plan n'a que deux créneaux,
> **ce qui est le réglage par défaut de l'écran Semaine**. `PlanWarning.repasComptes` porte le nombre
> de créneaux additionnés pour que l'écran puisse écrire « vos 2 repas prévus » plutôt que « votre
> journée ». Et 1 200 kcal est un **seuil de vigilance**, jamais un apport de référence (≈ 2 000 pour
> une femme active) : l'écran a écrit « pour une référence de 1 200 kcal » jusqu'à cette date, ce qui
> présentait un plancher de sécurité comme une cible.

⚠️ **Ce que cet amendement N'AUTORISE PAS** : masquer les quatre autres garde-fous, masquer un
allergène déclaré, ou étendre le raisonnement « par défaut c'est plus sobre » à un signal de
sécurité. Le plancher calorique est un repère nutritionnel ; un allergène est une promesse centrale
du produit. Les deux ne se traitent pas pareil.

#### Encouragements — ton chaleureux, jamais retour de performance

| ✅ Autorisé | ❌ Interdit |
|---|---|
| « Bon appétit » | « 3 jours d'affilée, bravo » |
| « Belle idée pour un mardi soir » | « 5 repas cuisinés cette semaine » |

Le second est un *streak* déguisé. Aucun décompte d'assiduité, sous aucune forme.

#### Signaux de préférence ≠ journal alimentaire

`user_signal` enregistre ce que l'utilisateur **a aimé ou voulu**, jamais ce qu'il a consommé.
La frontière est structurelle, pas affaire de ton :

| ❌ Journal alimentaire | ✅ Signal de préférence |
|---|---|
| « Tu n'as rien enregistré aujourd'hui » | Aucune relance, jamais |
| Saisie attendue et exhaustive | Facultative, partielle, sans conséquence |
| Champ « quantité mangée » | Aucun |
| Notion de repas manqué | Aucune |

> Le jour où l'application demande *« qu'as-tu mangé hier ? »*, elle est devenue un tracker et viole
> ce paragraphe.

### 6.6 Confidentialité

- Zéro requête réseau après le chargement initial — vérifiable par test automatisé
- Zéro télémétrie, y compris analytics anonymes
- `user.db` **exclu des backups cloud** (`NSURLIsExcludedFromBackupKey` / `android:allowBackup=false`
  si empaquetage Capacitor). Sans cette exclusion, la promesse « 100 % local » est fausse.
- Aucun identifiant, aucun compte, aucune permission système au-delà du stockage

---

## 7. Persistance & sauvegarde

**C'est le point faible identifié de la PWA. Il doit être traité en v1, pas après.**

Safari efface les données web après 7 jours d'inactivité — **sauf si la PWA est installée sur
l'écran d'accueil**. Stratégie défensive obligatoire :

| Mesure | Détail |
|---|---|
| 1. Persistance | `navigator.storage.persist()` réclamé au premier lancement |
| 2. Installation avant saisie | Onboarding bloqué tant que l'app n'est pas installée (ou avertissement explicite si l'utilisateur refuse) |
| 3. Export manuel | Fichier `.nutri-backup` téléchargeable à tout moment |
| 4. Rappel automatique | Invite à sauvegarder si `dernier_export_le` > 14 jours |
| 5. Import | Restauration complète depuis un fichier de sauvegarde |
| 6. Détection | Bandeau d'alerte permanent si la persistance a été refusée |
| 7. Quota | Surveillance via `navigator.storage.estimate()` |

### 7.1 Stratégie de cache — deux étages (option B)

Découpler la taille du catalogue de celle de l'installation. **Médias hors du `.db`** (fichiers
référencés par chemin, jamais des blobs) → le service worker cache par URL à hash de contenu, donc
une mise à jour ne re-télécharge que ce qui a changé.

| Étage | Contenu | Quand |
|---|---|---|
| **Pré-caché** | shell · `catalog.db` · boucles WebP · photos d'ustensiles | à l'installation (~3-5 Mo, offline immédiat) |
| **À la demande** | photos de recettes · clips MP4 · galeries d'états | à la 1ʳᵉ consultation, puis conservé (éviction LRU) |

Bouton **« Tout télécharger pour le mode avion »** : précache complet sur choix explicite. Quatre
canaux de mise à jour distincts — fonctionnalités (shell/SW), données (`catalog.db`), médias
(fichiers statiques incrémentaux), données perso (`user.db`, jamais touchées).

---

## 8. Contenu

Le contenu représente **plus de travail que le code**. À planifier comme tel.

### 8.1 Sources de données — ne rien créer soi-même

| Donnée | Source | Licence |
|---|---|---|
| Composition nutritionnelle | **CIQUAL (ANSES)** — ~3 200 aliments, français | Licence ouverte, réutilisable |
| Alternative internationale | USDA FoodData Central | Domaine public |
| Produits emballés (v3) | Open Food Facts | ODbL — **attribution obligatoire** |
| Recommandations santé | ANSES, EFSA, HAS, OMS | Publications officielles citables |

### 8.2 Fiches scientifiques — règles éditoriales

1. **Indexer des méta-analyses et revues systématiques**, pas des études isolées. Il existe une
   étude pour affirmer à peu près tout et son contraire ; une revue Cochrane, non.
2. **Niveau de preuve visible** sur chaque fiche. C'est ce qui sépare l'appli d'un blog bien-être.
3. **Résumés rédigés par toi.** Les PDF et les abstracts intégraux sont couverts par le droit
   d'auteur. DOI + lien vers la source : oui. Copie : non.
4. **Date de revue** affichée. Une fiche de plus de 3 ans est signalée comme à réviser.

**Objectif réaliste : 60 à 100 fiches solides**, pas 5 000 scrapées. Compter ~1 h par fiche.

### 8.2 bis — Chapitres santé

**8 à 10 chapitres en v2**, pas davantage. Chacun agrège plusieurs fiches et demande ~4-6 h de
rédaction (résumé, critères sourcés, sélection des repas illustratifs, relecture du vocabulaire
§6.2). Ce sont les artefacts éditoriaux les plus coûteux du projet, et les plus exposés — ils
doivent être relus par un tiers avant publication.

Priorité suggérée : diabète type 2 · hypertension · cholestérol · intolérance au lactose · maladie
cœliaque · grossesse · goutte · insuffisance rénale.

### 8.3 Photos

- Budget : **40 Ko max par image**, format AVIF avec repli WebP. 200 recettes ≈ 8 Mo.
- Licences : Pexels / Unsplash (vérifier au cas par cas) ou photos personnelles. **Jamais Google
  Images.**
- Fichier `catalog/CREDITS.md` traçant l'origine de chaque image.
- **Vidéo « pour faire saliver » : seulement sur les 2-3 recettes du jour** (boucle MP4 muette
  2-3 s), jamais sur toutes — production et poids ingérables sinon. Portée par `recipe_media`.

### 8.4 Tips du jour

Trois catégories : `nutrition_humaine`, `nutrition_animale`, `biologie_aliment`.

> ⚠️ La nutrition animale détonne avec le reste du produit. À conserver comme **contenu culturel**,
> mais **visuellement distinct** des conseils actionnables — sinon l'utilisateur ne sait plus ce qui
> s'applique à lui.

### 8.5 Lexique de cuisine

Chaque geste technique cité dans une étape de recette (*monter en neige*, *émulsifier*, *blanchir*,
*déglacer*) renvoie à une entrée de lexique illustrée.

**Format retenu : WebP animée, boucle muette de 2-3 s, ~80 Ko.**

| Option | Poids / technique | Hors-ligne |
|---|---|---|
| Vidéo MP4 embarquée | ~500 Ko | ✅ mais 30 techniques = 15 Mo, soit tout le budget |
| **WebP animée** | **~80 Ko** | ✅ 30 techniques ≈ 2,4 Mo |
| Vidéo à la demande | 0 | ❌ viole le principe 5 |

Une boucle de 3 secondes montrant le geste est pédagogiquement plus efficace qu'une vidéo de 45 s,
se charge instantanément et tient hors-ligne. Le son n'apporte rien pour un geste.

**Gestes à risque — exception assumée.** Une douzaine de gestes échouent couramment (blancs en
neige, chantilly, émulsion froide, beurre blanc, caramel, tempérage du chocolat, crème anglaise,
roux/béchamel, œuf poché, cuisson à blanc, macaronnage, déglacer). Ils reçoivent **3 clips MP4 de
3 s** (avant → pendant → après, rejouables séparément) + un clip **« quand ça rate »**, plus des
**galeries d'états** en photos (cuisson bleu→cuit, stades du caramel) et des **variantes d'outil**.
Le MP4 bat la WebP animée dès qu'on filme la vraie matière sur 9 s. Budget lexique révisé ≈ 6-7 Mo,
absorbé par le cache à la demande (§7.1). Tous ces médias sont portés par `lexicon_media`.

Cible : **30 à 40 entrées** couvrant les gestes réellement employés dans le catalogue — la liste se
dérive automatiquement des `recipe_step.lexicon_ids` au build, et le build échoue si une étape
référence un terme absent du lexique.

### 8.6 Occasions et fêtes

Pâques, le Ramadan et le Nouvel An chinois se déplacent chaque année dans le calendrier grégorien.
Deux voies : les calculer (algorithmes lunaires, complexes et sources de bugs silencieux) ou
**embarquer une table figée**.

**Retenu : table sur 10 ans** — ~60 occasions × 10 ans = quelques kilo-octets, vérifiable à l'œil,
zéro bug de calcul. Un test échoue lorsque la couverture restante passe sous 2 ans.

Règles de présentation :
- Les occasions sont regroupées par **famille** (nationale, religieuse, saisonnière, étrangère) et
  chaque famille est **désactivable**
- Aucune famille religieuse n'est active par défaut
- Une occasion **suggère**, ne prescrit jamais : « Idées pour le Nouvel An chinois », pas
  « Aujourd'hui vous devriez cuisiner… »

> Proposer « Suggestion pour l'Aïd » à quelqu'un qui n'a rien demandé est intrusif. C'est une
> catégorie qu'on active, pas qu'on subit.

### 8.7 Import & partage de recettes — sans serveur

**Import.** L'utilisateur colle une URL ou un texte ; l'appli extrait le **noyau factuel**
(ingrédients, quantités, étapes) et **lie vers la source**, jamais la prose ni la photo. Une recette
à la fois, usage perso local. Parser le **JSON-LD schema.org** est plus défendable que scraper le
HTML. **Interdits** : scrap massif d'un site (droit d'auteur + droit *sui generis* des bases de
données UE + CGU) et API payantes type Spoonacular/Edamam (redistribution interdite + backend requis).

**Partage P2P.** Export d'un fichier `.nutri-recipe` **autonome** (recette + photo embarquée + notes
de l'auteur, opt-in) via le partage natif (Web Share API) ; l'utilisateur le publie sur *ses* canaux,
un autre l'importe → rendu comme dans l'appli. Une **carte-image** (Canvas, côté client) sert
d'accroche sur les réseaux. **Aucun serveur, aucun feed hébergé** — c'est ce qui préserve le
principe 2. Toute recette importée/partagée est **« non vérifié »**, hors garanties allergènes.

### 8.8 Multi-langue

Le **moteur est agnostique** (identifiants, pas de chaînes) — l'i18n ne le touche pas. **UI** via
framework i18n, locale active chargée seule. **Contenu** : un `catalog.<lang>.db` **par langue**
(build depuis des sources localisées `catalog/recipes/<lang>/`), téléchargé selon la langue → aucune
pénalité runtime. Unités abstraites (métrique/impérial), formats via `Intl`. **Juridique par
marché** : liste blanche santé fondée sur les autorités locales, allergènes réglementaires propres à
la juridiction, lexique banni ré-authoré et testé par langue. **v1 = français** ; le reste est un
chantier de contenu différé — l'atout « zéro donnée » voyage, lui, partout.

---

## 9. Structure du projet

> ⚠️ **Rectifié le 2026-08-03 contre le disque.** La version précédente annonçait `app/src/safety/`
> et `app/src/features/` — **ni l'un ni l'autre n'a jamais existé**. Le garde-fou de vocabulaire
> vivait en réalité dans `engine/guards/`, et les écrans dans `ui/screens/`. Un agent qui lisait ce
> paragraphe cherchait `features/`, ne le trouvait pas, et pouvait le créer.
> L'arbre ci-dessous est relevé sur le dépôt, pas rédigé de mémoire.

```
appli_nutrition/
├─ CLAUDE.md                    ← chargé à chaque session : invariants, commandes, carte de docs/
├─ docs/                        ← ARCHITECTURE · ENGINE (index) + reference/ · DESIGN · ETAT · FICHE_REPRISE
├─ app/
│  ├─ src/
│  │  ├─ engine/                ← TS pur, zéro dépendance UI/DB, ≥90 % de couverture
│  │  │  ├─ domain/             ← types, ids, marques, catalogue, requête, résultat, planning (12 f.)
│  │  │  ├─ nutrition/          ← L2 : agrégation, signatures, couverture, besoins, ingrédient caractéristique
│  │  │  ├─ selection/          ← L3 : exclusions (allergènes, régime, temps, équipement), passe de score,
│  │  │  │  │                      diversification, similarité, explication, archétypes, alternatives, PRNG
│  │  │  │  └─ scoring/         ← les 8 couches de score CODÉES : craving · habit · nutri · pantry ·
│  │  │  │                        preference · season · speed · variety  (occasion/topic/cost : déclarées, non codées)
│  │  │  ├─ planning/           ← L4 : plan-week · plan-leftovers · reroll-slot · scale-recipe · shopping-list
│  │  │  ├─ search/             ← recherche de recettes (normalisation accent-insensible)
│  │  │  ├─ guards/             ← les 5 garde-fous · **banned-terms.ts** = le lint du vocabulaire banni §6.2
│  │  │  └─ api/                ← L5 : la surface publique du moteur
│  │  ├─ data/                  ← accès SQLite, migrations, export/import, sources catalogue et user
│  │  ├─ ui/                    ← PWA : router, navigation, panneau (fenêtres), thème, visite guidée
│  │  │  └─ screens/            ← les 10 écrans : accueil · aujourdhui · courses · detail-recette ·
│  │  │                           editeur-recette · frigo · parametres · recettes · savoir · semaine
│  │  └─ cli/                   ← bancs de mesure : try-engine · try-planning · stress-planning ·
│  │                              mesure-similarite · diag-couverture · list-recipes
│  └─ public/catalog/catalog.db ← base livrée avec l'app, produite par `npm run build`
├─ catalog/                     ← sources éditables, versionnées en clair
│  ├─ sources/                  ← foods.yaml · ciqual-mapping.yaml · CIQUAL 2025
│  ├─ recipes/*.yaml            ← 241
│  ├─ evidence/*.md             ← 8 fiches « Comprendre » — frontmatter = métadonnées, corps = résumé
│  ├─ tips/*.yaml               ← 73
│  ├─ lexicon/*.yaml + *.webp   ← 62 gestes de cuisine illustrés (§8.5)
│  ├─ CREDITS.md
│  ├─ build.mjs                 ← génère catalog.db · build-icons.mjs · import-ciqual.mjs
│  └─ build.test.ts
├─ tests/                       ← intégration : frontières engine/, catalogue réel, cohérence régime & lexique
├─ vite.config.ts               ← build PWA (root: 'app', COOP/COEP pour OPFS)
└─ vitest.config.ts             ← ⚠️ SÉPARÉ EXPRÈS — `root: 'app'` faisait disparaître 44 tests
```

> ⚠️ **`occasions/` et `topics/` sont annoncés au §8 mais n'existent pas encore sur le disque** —
> cohérent avec les couches `occasion`/`topic` déclarées au registre et non codées.

**Le catalogue est éditable en texte, compilé en binaire.** Les recettes et fiches vivent en
YAML/Markdown (lisibles, versionnables, relisibles par un tiers) ; `build.mjs` produit le `.db`.
Éditer une base binaire à la main serait ingérable.

---

## 10. Risques

| Risque | Gravité | Mitigation |
|---|---|---|
| Qualification dispositif médical | 🟠 Élevé *(abaissé)* | §6.1 — bibliothèque consultable, aucune collecte de pathologie |
| Effacement des données iOS | 🔴 Critique | §7 — installation forcée + export |
| Coût éditorial des fiches et chapitres sous-estimé | 🟠 Élevé | v2, périmètre borné à 60-100 fiches + 8-10 chapitres |
| Contribution à un TCA | 🔴 Critique | §6.5 — garde-fous en dur dans le moteur |
| Dérive de vocabulaire dans le contenu | 🟠 Élevé | §6.2 — test automatisé bloquant sur le lexique banni |
| Fiches obsolètes | 🟠 Élevé | Date de revue affichée, alerte > 3 ans |
| Poids du bundle (photos) | 🟡 Moyen | §8.3 — budget 40 Ko/image |
| Catalogue écrasant les données perso | 🔴 Critique | §4.1 — deux bases séparées |

---

## 11. Décisions

### Tranchées
| # | Décision | Retenu |
|---|---|---|
| 1 | Framework | **React** + Vite + TypeScript |
| 2 | Recettes en v1 | ~~150-200~~ → **200-300** (revu le 2026-07-27, décision 4 ETAT §3 ; **atteint** : 212). Suffisant pour 7 jours sans répétition |
| 3 | Données de santé | **Aucune collecte.** Bibliothèque de thématiques consultables (§6.1) |
| 4 | Couplage thématique ↔ moteur | **Filtre optionnel activé manuellement**, poids nul par défaut, révocable |
| 5 | Chiffrement applicatif | **Sans objet** — dissous par la décision 3 |
| 6 | Modèle économique | **100 % gratuit, sans pub** — lien « à propos » vers site/réseaux, aucun don débloquant |
| 7 | Communauté | **P2P par fichier**, jamais de serveur ni de feed hébergé |

### Ouvertes
1. Hébergement de la PWA (Cloudflare Pages / Netlify / GitHub Pages — tous conviennent, statique)
2. Liste définitive des 8-10 chapitres santé de la v2
3. Revue juridique par un professionnel avant publication publique — recommandée, non bloquante
   pour le développement
4. ~~**Mode cuisine** en v1 ou v1.5~~ — **tranché le 2026-08-04** : mono-recette en v1,
   synchronisation multi-recettes en v1.5 (§5bis)
5. **Multi-langue** : structure prévue dès le schéma (§8.8) ; 1ʳᵉ langue = français ; 2ᵉ langue et
   localisation du contenu santé (par marché, juridique) = v2+
6. **Cible iOS** : **PWA** par défaut (gratuit, pas de Mac) ; Capacitor + App Store seulement si
   API native (Mac + 99 $/an + revue). Reco : rester PWA.
