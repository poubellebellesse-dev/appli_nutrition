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
- **Mode cuisine** : suivi multi-recettes + timers par étape *(v1/v1.5 à trancher, §5bis)*

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
nutrient(id, code, nom, unite, vnr_adulte, categorie)
food(id, code_ciqual, nom, groupe, sous_groupe, saison_mois[])
food_nutrient(food_id, nutrient_id, valeur_pour_100g)
allergen(id, code, nom)                          -- 14 allergènes réglementaires UE
food_allergen(food_id, allergen_id, certitude)   -- 'contient' | 'traces'

recipe(id, nom, description, temps_prep_min, temps_cuisson_min, difficulte,
       portions_base, image_path, types_repas[], saison_mois[], envergure,
       conservation_jours, axe_sucre_sale, axe_leger_consistant,
       axe_chaud_froid, axe_texture)
    -- envergure ∈ {'quotidien','convivial','fete'}
    -- temps total = dérivé, JAMAIS une facette saisie (pas de désynchronisation possible)
recipe_ingredient(recipe_id, food_id, quantite_g, unite_affichage, optionnel)
recipe_step(recipe_id, ordre, texte, lexicon_ids[], timer_s, timer_type)   -- geste illustré ; timer_type ∈ {'cuisson','repos'} optionnel (mode cuisine §5bis)
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

### 4.3 Tables utilisateur (lecture/écriture)

```sql
user_profile(id, tranche_age, sexe, taille_cm, poids_kg, niveau_activite,
             facteur_portion, cree_le)
user_allergy(allergen_id, severite)               -- contrainte d'éviction, pas une pathologie
user_diet(code)
user_preference(cible_type, cible_id, score)      -- -2 (déteste) … +2 (adore)
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

meal_plan(id, date_debut)
meal_plan_entry(plan_id, date, creneau, recipe_id, portions, verrouille)
shopping_list(id, plan_id, genere_le)
shopping_list_item(list_id, food_id, quantite_totale, unite, coche, prix_estime)

user_price(food_id, prix_par_kg, saisi_le)        -- v3
consent(version_texte, accepte_le)
app_meta(schema_version, catalog_version, dernier_export_le)
```

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
| `S_variete` | Pénalité si la recette ou son ingrédient principal apparaît dans les N derniers jours |
| `S_saison` | Bonus produits de saison au mois courant |
| `S_criteres` | **Uniquement si une thématique est active** : bonus `PRIVILEGIE`, malus `LIMITE`. Jamais d'exclusion. Poids nul par défaut. |
| `S_cout` | v3 — pénalité au-delà du budget par repas |

`S_criteres` est le seul critère qui dépend d'un choix explicite : tant qu'aucune thématique n'est
activée, son poids vaut 0 et le moteur ignore complètement le volet santé.

Poids par défaut définis en constantes, ajustables dans le profil (« je privilégie : équilibre /
plaisir / rapidité / budget »).

### 5.4 Étape 3 — Diversification

Renvoyer les 5 meilleurs scores produit souvent 5 variations du même plat. Correction :
regroupement par ingrédient principal + famille de cuisine, puis sélection du meilleur
représentant de chaque groupe (*maximal marginal relevance* simplifié).

### 5.5 Étape 4 — Explication

Pour chaque suggestion, les **3 critères de plus forte contribution** sont convertis en phrase :

> « Proposé car : riche en fer · correspond à votre envie de plat rapide · légumes de saison »

Quand une thématique est active, l'explication cite le critère **et son autorité** :

> « Correspond au critère *limiter les sucres rapides* — recommandations ANSES, diabète de type 2 »

Cette explication n'est pas cosmétique : c'est ce qui rend le système auditable par l'utilisateur
et défendable juridiquement.

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

Fonctionnalité de présentation par-dessus le moteur, à spécifier comme écran propre *(v1/v1.5 à
trancher)*. Trois besoins : **suivi de plusieurs recettes en parallèle** (entrée + plat + dessert,
bascule et synchronisation du service), **suivi d'étape** (taper une étape marque où on en est) et
**timers par étape** (`recipe_step.timer_s` / `timer_type`, plusieurs décomptes en parallèle).

⚠️ Sur **iOS-PWA les timers en arrière-plan sont non fiables** : garder l'écran allumé (Wake Lock
API), décompte in-app, notification best-effort. Argument de plus pour Capacitor si le mode cuisine
devient central. L'interdiction de `Date.now` ne vise que `engine/` — l'UI utilise l'heure réelle.

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

- **Plancher calorique dur** : aucune suggestion ne peut descendre sous 1 200 kcal/jour (femme) /
  1 500 (homme) sans écran d'avertissement explicite
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

**Le « mode avancé »** (destiné aux sportifs) est le seul réglage qui active cet affichage. Il rend
visibles calories et macros sur les recettes, le total du jour et le bilan de la semaine. Il reste
**descriptif** : aucun objectif journalier, aucun compteur de reste, aucun déficit. La frontière
descriptif / prescriptif est la ligne à ne jamais franchir.

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

```
appli_nutrition/
├─ ARCHITECTURE.md              ← ce document
├─ app/
│  ├─ src/
│  │  ├─ engine/                ← TS pur, zéro dépendance, ≥90 % de couverture
│  │  │  ├─ types.ts
│  │  │  ├─ filters.ts          ← contraintes dures (§5.2)
│  │  │  ├─ scoring.ts          ← contraintes souples (§5.3)
│  │  │  ├─ diversify.ts        ← (§5.4)
│  │  │  ├─ explain.ts          ← (§5.5)
│  │  │  ├─ planner.ts          ← planning 7 jours (§5.6)
│  │  │  └─ shopping.ts         ← (§5.7)
│  │  ├─ data/                  ← accès SQLite, migrations, export/import
│  │  ├─ safety/                ← consentement, disclaimers, garde-fous §6.5
│  │  │  └─ lint-contenu.test.ts ← échoue si le vocabulaire banni §6.2 apparaît
│  │  ├─ features/              ← écrans
│  │  └─ ui/                    ← composants
│  └─ public/catalog/catalog.db
├─ catalog/                     ← sources éditables, versionnées en clair
│  ├─ sources/ciqual/
│  ├─ recipes/*.yaml
│  ├─ evidence/*.md             ← frontmatter = métadonnées, corps = résumé
│  ├─ tips/*.yaml
│  ├─ topics/*.md               ← chapitres santé (§8.2 bis)
│  ├─ lexicon/*.yaml + *.webp   ← gestes de cuisine illustrés (§8.5)
│  ├─ occasions/dates.yaml      ← table figée sur 10 ans (§8.6)
│  ├─ CREDITS.md
│  └─ build.mjs                 ← génère catalog.db
└─ tests/
```

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
| 2 | Recettes en v1 | **150-200** — suffisant pour 7 jours sans répétition |
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
4. **Mode cuisine** en v1 ou v1.5 (feature nouvelle, sizeable — après le socle P0, §5bis)
5. **Multi-langue** : structure prévue dès le schéma (§8.8) ; 1ʳᵉ langue = français ; 2ᵉ langue et
   localisation du contenu santé (par marché, juridique) = v2+
6. **Cible iOS** : **PWA** par défaut (gratuit, pas de Mac) ; Capacitor + App Store seulement si
   API native (Mac + 99 $/an + revue). Reco : rester PWA.
