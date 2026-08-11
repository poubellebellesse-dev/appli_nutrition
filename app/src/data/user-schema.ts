// data/user-schema.ts — schéma et migrations de `user.db` (docs/ARCHITECTURE.md §4.1, §4.3).
//
// ⚠️ CE FICHIER NE DOIT IMPORTER AUCUN MODULE NODE (voir l'en-tête de `user-db.ts`).
//
// POURQUOI DES MIGRATIONS VERSIONNÉES DÈS LA v1. §4.1 : « Jamais touché par une mise à jour.
// Migrations versionnées uniquement. » `catalog.db` est remplacé en bloc à chaque release ; ici
// c'est interdit — le fichier contient les seules données que l'utilisateur ne peut pas
// re-télécharger. Une migration ratée est une perte définitive, pas un rebuild.
//
// POURQUOI LE SCHÉMA COMPLET DE §4.3 EN v1, y compris des tables sans consommateur (`user_signal`,
// `user_recipe`, `shopping_extra_item`, `user_price`…). Décision reprise de RECAP_SESSION_3 §4 :
// une migration est GRATUITE tant que la base est vide, et coûte une migration versionnée sur
// données réelles ensuite. La fenêtre de tir est maintenant. Créer une table est du SQL
// déclaratif ; ce n'est pas de l'abstraction spéculative, il n'y a aucun code à maintenir derrière.
//
// TROIS TABLES / COLONNES AJOUTÉES À §4.3, qui n'y figuraient pas et sans lesquelles on ne peut pas
// reconstruire une `SuggestionRequest` (docs/ARCHITECTURE.md mis à jour en conséquence) :
//   1. `meal_history` — §4.3 décrivait l'origine `choisi`/`reste` en prose sans jamais donner de
//      table où l'écrire. Sans elle, les couches `habit` et `variety` n'ont pas de source.
//   2. `user_excluded_food` — `HardConstraints.excludedFoodIds` est un RÉGLAGE DURABLE (voir
//      engine/domain/request.ts) lu par la couche `exclusions`. Aucune table ne le portait.
//      `user_preference` à −2 est un « je n'aime pas » pondéré, pas une exclusion dure.
//   3. `meal_plan_entry.est_reste` — `MealPlanEntry.isLeftover` (§7.3 ENGINE) n'avait pas de
//      colonne. Un plan relu depuis la base aurait perdu la trace de ses restes.
//
// ⚠️ AUCUNE CLÉ ÉTRANGÈRE VERS LE CATALOGUE. `food_id`, `recipe_id`, `allergen_id`, `topic_id` sont
// du TEXT nu : les tables référencées vivent dans un AUTRE FICHIER (`catalog.db`), et SQLite ne
// contraint pas entre bases. C'est le prix de la séparation de §4.1 — la vérification d'existence
// appartient au code, pas au moteur SQL. Un identifiant devenu inconnu après une mise à jour du
// catalogue est un cas NORMAL, à ignorer silencieusement, jamais une erreur (voir `user-store.ts`).

import { withTransaction, type UserDb } from './user-db.js'

/** Version courante du schéma. Incrémenter EN MÊME TEMPS qu'on ajoute une entrée à `MIGRATIONS`. */
export const USER_SCHEMA_VERSION = 16

export interface Migration {
  readonly version: number
  /** Instructions UNIQUES, appliquées dans l'ordre, dans une transaction par migration. */
  readonly statements: readonly string[]
}

/**
 * `app_meta` doit exister AVANT de pouvoir lire la version qui décide des migrations à jouer —
 * elle ne peut donc pas être créée par la migration 1. Elle est bootstrappée ici, à la version 0
 * (= base vide), et c'est la seule table à porter `IF NOT EXISTS`.
 *
 * Pas de `PRAGMA user_version` : §4.3 fixe `app_meta.schema_version` comme source de vérité, et
 * deux compteurs de version divergent tôt ou tard.
 */
const BOOTSTRAP_SQL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS app_meta (
     id INTEGER PRIMARY KEY CHECK (id = 1),
     schema_version INTEGER NOT NULL,
     catalog_version TEXT,
     dernier_export_le TEXT
   )`,
  `INSERT OR IGNORE INTO app_meta (id, schema_version) VALUES (1, 0)`,
]

const V1_STATEMENTS: readonly string[] = [
  // --- Profil et contraintes dures -----------------------------------------------------------
  //
  // id = 1 verrouille le profil UNIQUE par appareil. L'appli n'a ni compte ni multi-profil (§2
  // ARCHITECTURE) ; l'exprimer en contrainte plutot qu'en discipline d'appelant evite un second
  // profil fantome cree par un bug d'insertion.
  `CREATE TABLE user_profile (
     id INTEGER PRIMARY KEY CHECK (id = 1),
     tranche_age TEXT NOT NULL CHECK (tranche_age IN ('18_29','30_49','50_64','65_plus')),
     sexe TEXT NOT NULL CHECK (sexe IN ('F','M','NP')),
     taille_cm REAL CHECK (taille_cm IS NULL OR taille_cm > 0),
     poids_kg REAL CHECK (poids_kg IS NULL OR poids_kg > 0),
     niveau_activite TEXT NOT NULL
       CHECK (niveau_activite IN ('sedentaire','peu_actif','actif','tres_actif')),
     facteur_portion REAL NOT NULL CHECK (facteur_portion BETWEEN 0.7 AND 1.5),
     cree_le TEXT NOT NULL
   )`,

  // severite : vocabulaire VOLONTAIREMENT OUVERT (aucun CHECK). Ni ARCHITECTURE ni ENGINE ne
  // definissent ses valeurs, et le moteur ne la lit PAS : engine/selection/allergenes.ts est
  // explicite — le filtre allergene n'est jamais pondere, meme les traces excluent. Figer ici une
  // enumeration inventee serait creer une regle que rien ne fait respecter.
  `CREATE TABLE user_allergy (
     allergen_id TEXT PRIMARY KEY,
     severite TEXT
   )`,

  // Un seul regime a la fois, et c'est structurel. DIET_CHAIN est une chaine d'inclusion
  // (vegetalien inclus dans vegetarien inclus dans pescetarien inclus dans omnivore) : declarer
  // deux regimes ne veut rien dire, le plus restrictif absorbe l'autre. `HardConstraints.diet` est
  // d'ailleurs un scalaire nullable, pas une liste.
  `CREATE TABLE user_diet (
     id INTEGER PRIMARY KEY CHECK (id = 1),
     code TEXT NOT NULL
   )`,

  // Rejet personnel DURABLE d'un aliment (couche `exclusions`). A ne pas confondre avec
  // `MealContext.requiredFoodIds`, son miroir, qui est ponctuel et n'a donc PAS de table.
  `CREATE TABLE user_excluded_food (
     food_id TEXT PRIMARY KEY
   )`,

  // --- Gouts, favoris, thematiques ------------------------------------------------------------
  //
  // score de -2 (deteste) a +2 (adore), lu par la couche `preference` pour cible_type = 'food'.
  `CREATE TABLE user_preference (
     cible_type TEXT NOT NULL CHECK (cible_type IN ('food','recipe')),
     cible_id TEXT NOT NULL,
     score INTEGER NOT NULL CHECK (score BETWEEN -2 AND 2),
     PRIMARY KEY (cible_type, cible_id)
   )`,

  `CREATE TABLE user_favorite (
     recipe_id TEXT PRIMARY KEY,
     ajoute_le TEXT NOT NULL
   )`,

  // Reglage d'AFFICHAGE choisi et revocable, jamais une donnee de sante declaree (§4.3, §5.3).
  `CREATE TABLE user_active_topic (
     topic_id TEXT PRIMARY KEY,
     active_le TEXT NOT NULL
   )`,

  // --- Signaux -------------------------------------------------------------------------------
  //
  // ⚠️ AUCUNE COLONNE DE QUANTITE, ET C'EST LA FRONTIERE. §6.5 ARCHITECTURE : « Signaux de
  // preference != journal alimentaire ». Ajouter ici une quantite mangee, une notion de repas
  // manque ou un champ « rempli / non rempli » transforme l'appli en tracker et viole le
  // paragraphe. La saisie est facultative, partielle, sans consequence et sans relance.
  `CREATE TABLE user_signal (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     recipe_id TEXT NOT NULL,
     type TEXT NOT NULL CHECK (type IN ('aime','naime_pas','envie')),
     creneau TEXT CHECK (creneau IN ('petit_dejeuner','dejeuner','gouter','diner')),
     jour_semaine INTEGER CHECK (jour_semaine IS NULL OR jour_semaine BETWEEN 0 AND 6),
     mois INTEGER CHECK (mois IS NULL OR mois BETWEEN 1 AND 12),
     date TEXT
   )`,

  // --- Historique des repas retenus ------------------------------------------------------------
  //
  // Table AJOUTEE a §4.3 (voir l'en-tete du fichier). Source unique des couches `habit` et
  // `variety`, dont l'asymetrie de lecture repose entierement sur `origine` :
  //   - `variety` lit TOUTES les lignes (un reste mange lasse autant qu'un plat choisi) ;
  //   - `habit` ne compte que `origine = 'choisi'` (un reste n'est pas une preference exprimee).
  // La colonne est donc NOT NULL sans defaut : une ligne sans origine casserait cette asymetrie en
  // silence, en gonflant `habit` de plats jamais choisis.
  //
  // ⚠️ AUCUNE COLONNE DE QUANTITE ICI NON PLUS, meme raison que `user_signal`. Cette table
  // enregistre « ce plat a ete retenu », jamais « voici ce que tu as mange ».
  //
  // Cle (date, creneau, recipe_id) : un creneau peut porter plusieurs plats en mode repas
  // (entree + plat + dessert), donc ni (date, creneau) ni recipe_id seuls ne suffisent.
  `CREATE TABLE meal_history (
     date TEXT NOT NULL,
     creneau TEXT NOT NULL CHECK (creneau IN ('petit_dejeuner','dejeuner','gouter','diner')),
     recipe_id TEXT NOT NULL,
     origine TEXT NOT NULL CHECK (origine IN ('choisi','reste')),
     PRIMARY KEY (date, creneau, recipe_id)
   )`,
  // La fenetre glissante de `MealHistory.windowDays` filtre TOUJOURS sur la date.
  `CREATE INDEX meal_history_date ON meal_history (date)`,

  // --- Garde-manger, equipement, affichage -----------------------------------------------------
  //
  // quantite_approx est INDICATIVE : `ShoppingOptions.pantryFoodIds` est du tout-ou-rien (§7.4
  // ENGINE), l'aliment sort de la liste ou n'en sort pas. Elle n'est jamais decomptee.
  `CREATE TABLE user_pantry (
     food_id TEXT PRIMARY KEY,
     quantite_approx TEXT
   )`,

  `CREATE TABLE user_equipment (
     equipment_id TEXT PRIMARY KEY
   )`,

  // afficher_macros a 0 PAR DEFAUT (§6.5 ARCHITECTURE : mode avance opt-in). Le defaut est dans le
  // schema, pas dans le code de lecture : une base ou la ligne existe sans valeur explicite ne
  // peut pas afficher les macros par accident.
  `CREATE TABLE user_display (
     id INTEGER PRIMARY KEY CHECK (id = 1),
     afficher_macros INTEGER NOT NULL DEFAULT 0 CHECK (afficher_macros IN (0,1))
   )`,
  // §4.3 note `occasions_actives[]` — SQLite n'a pas de type tableau. Table fille plutot que JSON
  // dans une colonne : une occasion reste interrogeable en SQL, un blob JSON ne l'est pas.
  `CREATE TABLE user_display_occasion (
     occasion_id TEXT PRIMARY KEY
   )`,

  // --- Planning --------------------------------------------------------------------------------
  `CREATE TABLE meal_plan (
     id TEXT PRIMARY KEY,
     date_debut TEXT NOT NULL
   )`,

  // service : NULL = mode recette (un plat unique) ; non-NULL = mode repas (§2.7
  // CONCEPTION_B_VIN_REPAS). est_reste : colonne AJOUTEE a §4.3 (voir l'en-tete).
  `CREATE TABLE meal_plan_entry (
     plan_id TEXT NOT NULL REFERENCES meal_plan(id) ON DELETE CASCADE,
     date TEXT NOT NULL,
     creneau TEXT NOT NULL CHECK (creneau IN ('petit_dejeuner','dejeuner','gouter','diner')),
     service TEXT CHECK (service IN ('entree','plat','accompagnement','fromage','dessert')),
     recipe_id TEXT,
     portions REAL NOT NULL CHECK (portions > 0),
     verrouille INTEGER NOT NULL DEFAULT 0 CHECK (verrouille IN (0,1)),
     est_reste INTEGER NOT NULL DEFAULT 0 CHECK (est_reste IN (0,1))
   )`,
  // ⚠️ INDEX UNIQUE AVEC COALESCE, PAS UNE PRIMARY KEY. §4.3 dit « la cle s'etend a (plan_id, date,
  // creneau, service) », mais `service` est NULL en mode recette — et SQLite laisse passer les
  // doublons sur une colonne NULL d'une PRIMARY KEY (deux NULL n'y sont jamais egaux). Une PK
  // aurait donc autorise deux plats sur le meme creneau, sans erreur.
  `CREATE UNIQUE INDEX meal_plan_entry_slot
     ON meal_plan_entry (plan_id, date, creneau, COALESCE(service, ''))`,

  // --- Courses ---------------------------------------------------------------------------------
  `CREATE TABLE shopping_list (
     id TEXT PRIMARY KEY,
     plan_id TEXT NOT NULL REFERENCES meal_plan(id) ON DELETE CASCADE,
     genere_le TEXT NOT NULL
   )`,

  `CREATE TABLE shopping_list_item (
     list_id TEXT NOT NULL REFERENCES shopping_list(id) ON DELETE CASCADE,
     food_id TEXT NOT NULL,
     quantite_totale REAL NOT NULL,
     unite TEXT NOT NULL,
     coche INTEGER NOT NULL DEFAULT 0 CHECK (coche IN (0,1)),
     prix_estime REAL,
     PRIMARY KEY (list_id, food_id)
   )`,

  // Articles NON alimentaires. Table SEPAREE de tout ce qui touche `food` : aucun nutriment, aucun
  // allergene structure, jamais eligible comme ingredient. `note_allergene` est du texte libre
  // INFORMATIF — le systeme des 14 allergenes UE reste reserve a ce qu'on mange (§4.3).
  `CREATE TABLE shopping_extra_item (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     list_id TEXT NOT NULL REFERENCES shopping_list(id) ON DELETE CASCADE,
     libelle TEXT NOT NULL,
     rayon TEXT,
     quantite TEXT,
     coche INTEGER NOT NULL DEFAULT 0 CHECK (coche IN (0,1)),
     note_allergene TEXT
   )`,

  // --- Recettes personnelles -------------------------------------------------------------------
  //
  // Contenu AUTONOME, hors garanties du catalogue source : toujours affiche « non verifie » (§4.3).
  `CREATE TABLE user_recipe (
     id TEXT PRIMARY KEY,
     source TEXT NOT NULL CHECK (source IN ('perso','importe','variante')),
     contenu_json TEXT NOT NULL,
     importe_le TEXT NOT NULL
   )`,

  // etape_ordre NULL = note generale sur la recette. Index unique avec COALESCE pour la meme raison
  // que meal_plan_entry ci-dessus : une PK contenant une colonne NULL ne dedoublonne pas.
  `CREATE TABLE user_recipe_note (
     recipe_id TEXT NOT NULL,
     etape_ordre INTEGER CHECK (etape_ordre IS NULL OR etape_ordre >= 0),
     texte TEXT NOT NULL,
     cree_le TEXT NOT NULL
   )`,
  `CREATE UNIQUE INDEX user_recipe_note_cible
     ON user_recipe_note (recipe_id, COALESCE(etape_ordre, -1))`,

  // --- v3 et consentement ----------------------------------------------------------------------
  `CREATE TABLE user_price (
     food_id TEXT PRIMARY KEY,
     prix_par_kg REAL NOT NULL CHECK (prix_par_kg >= 0),
     saisi_le TEXT NOT NULL
   )`,

  // Une ligne PAR VERSION acceptee, pas une ligne unique ecrasee : accepter la v2 ne doit pas
  // effacer la trace de l'acceptation de la v1 (§6.4 ARCHITECTURE).
  `CREATE TABLE consent (
     version_texte TEXT PRIMARY KEY,
     accepte_le TEXT NOT NULL
   )`,
]

/**
 * v2 — deux défauts de la v1 qui empêchaient d'écrire puis de relire un plan.
 *
 * 1. **`meal_plan` n'était pas relisible.** `WeekPlan` porte `days` et `seed` ; la table n'avait ni
 *    l'un ni l'autre. On pouvait déduire `days` du nombre de dates distinctes, mais c'est une
 *    inférence fragile ; et `seed` — la graine qui a produit ce plan, seule façon de reproduire un
 *    résultat surprenant — était perdue.
 *
 * 2. **`CHECK (portions > 0)` était FAUX.** Un créneau vide (`recipeId: null`) sort de `planWeek`
 *    avec `portions: 0` — c'est le cas normal d'un créneau que le glouton n'a pas pu remplir, pas
 *    une anomalie. La contrainte refusait donc d'enregistrer un plan parfaitement valide. Elle est
 *    remplacée par l'invariant RÉEL : une recette a des portions, un créneau vide n'en a aucune.
 *    Trouvé par le test d'aller-retour, jamais par la lecture du schéma.
 *
 * ⚠️ POURQUOI UNE v2 PLUTÔT QUE DE CORRIGER v1. La v1 est committée et a pu créer une base sur une
 * machine réelle, qui rapporte `schema_version = 1`. Modifier une migration déjà livrée est
 * exactement la façon d'abîmer une base : elle ne rejouerait pas la version qu'elle croit avoir, et
 * l'écart ne se verrait qu'à la première requête sur une colonne absente. Une migration livrée est
 * immuable, même vieille d'une heure — d'où la reconstruction de table ci-dessous plutôt qu'une
 * retouche du CREATE TABLE de la v1.
 *
 * `DEFAULT 0` sur `jours` : imposé par SQLite pour un `ADD COLUMN NOT NULL`. Aucune ligne existante
 * ne peut en hériter en pratique (rien n'écrivait encore de plan), et `readPlan` rejette `jours = 0`
 * comme un plan illisible plutôt que d'afficher une semaine de zéro jour.
 */
const V2_STATEMENTS: readonly string[] = [
  `ALTER TABLE meal_plan ADD COLUMN jours INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE meal_plan ADD COLUMN seed INTEGER NOT NULL DEFAULT 0`,

  // SQLite ne sait pas modifier un CHECK : il faut reconstruire la table. Aucune table ne
  // REFERENCE meal_plan_entry, le DROP est donc sans effet de bord (il emporte l'index, recréé
  // plus bas sous le même nom).
  `CREATE TABLE meal_plan_entry_v2 (
     plan_id TEXT NOT NULL REFERENCES meal_plan(id) ON DELETE CASCADE,
     date TEXT NOT NULL,
     creneau TEXT NOT NULL CHECK (creneau IN ('petit_dejeuner','dejeuner','gouter','diner')),
     service TEXT CHECK (service IN ('entree','plat','accompagnement','fromage','dessert')),
     recipe_id TEXT,
     portions REAL NOT NULL,
     verrouille INTEGER NOT NULL DEFAULT 0 CHECK (verrouille IN (0,1)),
     est_reste INTEGER NOT NULL DEFAULT 0 CHECK (est_reste IN (0,1)),
     -- L'invariant reel : une recette a des portions, un creneau vide n'en a aucune.
     CHECK ((recipe_id IS NULL AND portions = 0) OR (recipe_id IS NOT NULL AND portions > 0))
   )`,
  `INSERT INTO meal_plan_entry_v2
     (plan_id, date, creneau, service, recipe_id, portions, verrouille, est_reste)
   SELECT plan_id, date, creneau, service, recipe_id, portions, verrouille, est_reste
   FROM meal_plan_entry`,
  `DROP TABLE meal_plan_entry`,
  `ALTER TABLE meal_plan_entry_v2 RENAME TO meal_plan_entry`,
  `CREATE UNIQUE INDEX meal_plan_entry_slot
     ON meal_plan_entry (plan_id, date, creneau, COALESCE(service, ''))`,
]

/**
 * v3 — le rythme de l'utilisateur n'avait nulle part où aller.
 *
 * L'écran 5 du premier lancement (§4.8 DESIGN) collecte deux réglages que §4.3 ARCHITECTURE
 * n'avait pas prévus, et qui vivaient donc en dur dans le code :
 *   - le nombre de repas par jour n'existait qu'en état React dans l'écran Semaine, perdu à chaque
 *     rechargement ;
 *   - le temps disponible était codé `null` dans l'écran Aujourd'hui, si bien que la couche `temps`
 *     ne recevait JAMAIS rien — un réglage documenté mais sans source de données, exactement le
 *     défaut corrigé en P1b-2 sur la couche `preference`.
 *
 * Table à part et non des colonnes de `user_display` : le rythme n'est pas un réglage d'affichage,
 * il change les suggestions.
 *
 * `NULL` sur les deux temps = « pas de limite », qui est le neutre. Zéro serait faux (aucune
 * recette ne se cuisine en zéro minute) et interdirait de distinguer « je n'ai rien répondu » de
 * « je suis très pressé ».
 */
const V3_STATEMENTS: readonly string[] = [
  `CREATE TABLE user_rythme (
     id INTEGER PRIMARY KEY CHECK (id = 1),
     repas_par_jour INTEGER NOT NULL CHECK (repas_par_jour BETWEEN 1 AND 3),
     temps_semaine_min INTEGER CHECK (temps_semaine_min IS NULL OR temps_semaine_min > 0),
     temps_weekend_min INTEGER CHECK (temps_weekend_min IS NULL OR temps_weekend_min > 0)
   )`,
]

/**
 * v4 — les deux réglages qu'exige l'écran Paramètres.
 *
 * Colonnes de `user_display` et non une table à part : ce sont bien des réglages d'AFFICHAGE, ils ne
 * changent aucune suggestion. C'est la frontière déjà posée par la v3, qui a mis `user_rythme` à
 * part précisément parce que le rythme, lui, change les suggestions.
 *
 * `gestes_balayage` à 0 PAR DÉFAUT. §3 DESIGN — « aucune action uniquement gestuelle », chaque geste
 * est doublé d'un contrôle visible. Les flèches sont donc le mode normal et le balayage un
 * raccourci qu'on active ; l'inverse imposerait un geste invisible à qui ne le devine pas.
 *
 * `alertes_discretes` à 0 PAR DÉFAUT, et ce réglage NE FAIT PAS TAIRE l'alerte. §6.5 ARCHITECTURE :
 * l'avertissement prévient sans interdire — mais il doit prévenir. À 1, le bloc se réduit à son
 * marqueur et à une ligne ; il ne disparaît jamais, sinon un plan qui sous-alimente ne le dirait
 * plus à personne.
 */
const V4_STATEMENTS: readonly string[] = [
  `ALTER TABLE user_display
     ADD COLUMN gestes_balayage INTEGER NOT NULL DEFAULT 0 CHECK (gestes_balayage IN (0,1))`,
  `ALTER TABLE user_display
     ADD COLUMN alertes_discretes INTEGER NOT NULL DEFAULT 0 CHECK (alertes_discretes IN (0,1))`,
]

/**
 * v5 — le bandeau de persistance, une fois écarté, doit le rester.
 *
 * ⚠️ UNE v5 PLUTÔT QUE D'ÉTENDRE LA v4, alors que la v4 date de la même journée. La règle posée en
 * v2 ne fait pas d'exception d'ancienneté : une base de test a déjà pu rapporter `schema_version =
 * 4`, et elle ne rejouerait pas une v4 modifiée. L'écart ne se verrait qu'à la première requête sur
 * une colonne absente.
 *
 * ⚠️ NE VAUT QUE POUR L'ALERTE `non_persistant` — voir `main.tsx`. « Le navigateur ne garantit pas de
 * conserver vos données » est un état permanent qu'on peut avoir lu et accepté. « Cet appareil
 * n'enregistre rien » et « une modification n'a pas pu être enregistrée » décrivent une perte en
 * train de se produire : ceux-là ne se referment pas.
 */
const V5_STATEMENTS: readonly string[] = [
  `ALTER TABLE user_display
     ADD COLUMN bandeau_stockage_masque INTEGER NOT NULL DEFAULT 0
     CHECK (bandeau_stockage_masque IN (0,1))`,
]

/**
 * v6 — l'heure des repas, et l'interrupteur des rappels de préparation.
 *
 * ⚠️ AUCUNE HEURE N'ÉTAIT STOCKÉE NULLE PART. `user_rythme` sait combien de repas par jour et
 * combien de temps on a pour cuisiner, jamais À QUELLE HEURE on mange. Un rappel « il est temps de
 * lancer la cuisson » ne peut pas se calculer sans elle.
 *
 * Table fille plutôt que quatre colonnes sur `user_rythme` : le créneau est une clé, et une table
 * reste interrogeable en SQL là où quatre colonnes obligeraient à les nommer une par une à chaque
 * lecture. Même raison que `user_display_occasion`.
 *
 * `heure_min` = minutes depuis minuit (19 h 30 → 1170). Pas un `TEXT` « 19:30 » : une chaîne
 * demanderait d'être analysée à chaque lecture, et une chaîne malformée passerait le CHECK.
 *
 * ⚠️ `rappels_actifs` À 0 PAR DÉFAUT. Une notification qu'on n'a pas demandée est une intrusion —
 * et sur une application dont l'argument est « elle ne vous harcèle pas », le défaut ne peut pas
 * être autre chose. Le réglage vit dans `user_display` avec les autres opt-in d'interface : comme
 * eux, il ne change AUCUNE suggestion.
 */
const V6_STATEMENTS: readonly string[] = [
  `CREATE TABLE user_meal_time (
     creneau TEXT PRIMARY KEY
       CHECK (creneau IN ('petit_dejeuner','dejeuner','gouter','diner')),
     heure_min INTEGER NOT NULL CHECK (heure_min BETWEEN 0 AND 1439)
   )`,
  `ALTER TABLE user_display
     ADD COLUMN rappels_actifs INTEGER NOT NULL DEFAULT 0 CHECK (rappels_actifs IN (0,1))`,
]

/**
 * v7 — `readLatestPlan` ne pouvait pas distinguer deux plans de MÊME `date_debut`.
 *
 * ⚠️ BUG CORRIGÉ. `meal_plan.id` vaut `plan-${startDate}-${days}` (`engine/planning/plan-week.ts`).
 * Replanifier la même date avec un nombre de jours différent crée donc une SECONDE ligne au lieu de
 * remplacer la première, et `readLatestPlan` triait sur `date_debut DESC, id DESC` — un id plus
 * grand au sens du TEXTE (« …-7 » > « …-3 ») pouvait rouvrir l'ancien plan après un rechargement,
 * alors que l'écran affichait correctement le nouveau tant que React ne repassait pas par la base.
 * `mis_a_jour_le` est la seule façon de savoir laquelle des deux lignes est réellement la dernière
 * écrite — la table n'avait jusqu'ici aucune notion de date de modification.
 *
 * `DEFAULT ''` sur `mis_a_jour_le` : les lignes d'avant cette migration n'ont pas d'horodatage, et
 * une chaîne vide trie AVANT toute date ISO réelle en ordre décroissant — elles restent départagées
 * par `date_debut` puis `id`, exactement le tri d'avant v7, jamais promues devant un plan récent.
 *
 * `visite_proposee` — réglage de `user_display` consommé par un écran hors périmètre de cette
 * migration (voir la tâche qui l'a demandée). Ajoutée ici seulement parce que les deux colonnes
 * partagent la même version de schéma.
 */
const V7_STATEMENTS: readonly string[] = [
  `ALTER TABLE meal_plan ADD COLUMN mis_a_jour_le TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE user_display
     ADD COLUMN visite_proposee INTEGER NOT NULL DEFAULT 0 CHECK (visite_proposee IN (0,1))`,
]

/**
 * v8 — DATER LE GARDE-MANGER.
 *
 * ⚠️ POURQUOI CETTE COLONNE, et ce n'est pas du confort. `user_pantry` disait CE QU'ON A sans dire
 * DEPUIS QUAND, et deux écrans s'en servent pour affirmer des choses : l'écran Courses RETIRE de la
 * liste ce qu'on est censé avoir (on rentre sans crème), la fenêtre « Choisir un plat » propose des
 * recettes réalisables avec. Un garde-manger de trois semaines fait mentir les deux en silence.
 *
 * C'est le grief n°1 relevé sur les applications comparables (voir
 * `reference/CONCURRENCE_ET_ATTENTES.md`) : « on le remplit une semaine, puis plus jamais — et un
 * inventaire à moitié à jour est PIRE que pas d'inventaire, parce qu'on cesse d'y croire ».
 *
 * `DEFAULT ''` = date INCONNUE, pas « aujourd'hui ». Les lignes d'avant cette migration ont pu être
 * saisies il y a six mois ; les traiter comme fraîches serait précisément l'erreur que la colonne
 * existe pour empêcher. L'absence d'information n'est pas une information (§5.1 bis ENGINE) — une
 * date vide déclenche donc la demande de confirmation, comme une date ancienne.
 */
const V8_STATEMENTS: readonly string[] = [
  `ALTER TABLE user_pantry ADD COLUMN declare_le TEXT NOT NULL DEFAULT ''`,
]

/**
 * v9 — LES PLATS PRÉPARÉS (décision 51, tranchée le 2026-08-05, issue « (a) créneau exclu »).
 *
 * Un plat du commerce, un traiteur, un repas au restaurant : le créneau est REMPLI, et sa valeur
 * nutritionnelle est INCONNUE. Les deux à la fois — c'est ce qu'aucun état du schéma ne savait dire.
 *
 * ⚠️ UNE COLONNE, PAS UNE COLONNE ET UN DRAPEAU. Le libellé EST le marqueur : `hors_catalogue`
 * non-NULL signifie « rempli, immesurable ». Ajouter à côté un booléen `est_hors_catalogue`
 * créerait deux champs capables de se contredire, et il faudrait alors décider lequel fait foi —
 * la classe de défaut que ce projet paie en boucle. Les trois états sont lisibles sans ambiguïté :
 *
 *   recipe_id NOT NULL, hors_catalogue NULL  → une recette du catalogue ou une recette perso
 *   recipe_id NULL,     hors_catalogue NULL  → créneau VIDE (le plan n'a pas su le remplir)
 *   recipe_id NULL,     hors_catalogue NOT NULL → rempli par un plat qu'on ne sait pas mesurer
 *
 * ⚠️ LE `CHECK` REND LE QUATRIÈME ÉTAT INEXPRIMABLE, il ne se contente pas de le décourager. Porter
 * une recette ET un libellé libre poserait la question « lequel compte ? » à chaque lecture ; la
 * base refuse la ligne. Même raison de fond que `requiredFoodIds` dans `MealContext` plutôt que
 * dans `HardConstraints` : la garantie vient de la forme (acquis n°2 du CLAUDE.md).
 *
 * ⚠️ VÉRIFIÉ SUR SQLite AVANT D'ÊTRE ÉCRIT, comme l'index unique de v1 l'avait été : `ALTER TABLE
 * … ADD COLUMN … CHECK (…)` référençant une AUTRE colonne est accepté, et la contrainte mord —
 * les trois états ci-dessus passent, le quatrième lève « CHECK constraint failed ». Ce n'était pas
 * acquis : c'est exactement sur ce genre de détail qu'une `PRIMARY KEY` avait laissé passer des
 * doublons de créneau (voir l'index `meal_plan_entry_slot`).
 *
 * ⚠️ PAS DE COLONNE D'ÉNERGIE, ET C'EST L'ARBITRAGE LUI-MÊME. L'issue (b) de la décision 51 — une
 * saisie d'énergie facultative — a été écartée : un nombre tapé par l'utilisateur se mélangerait
 * aux valeurs CIQUAL dans les mêmes totaux sans marque de provenance (principe 3, traçabilité).
 * N'ajouter cette colonne « puisqu'on y est » rouvrirait la décision en passant.
 */
const V9_STATEMENTS: readonly string[] = [
  `ALTER TABLE meal_plan_entry
     ADD COLUMN hors_catalogue TEXT CHECK (recipe_id IS NULL OR hors_catalogue IS NULL)`,
]

/**
 * v10 — LA CUISSON EN COURS SURVIT À LA FERMETURE (lot L1, `CONCEPTION_MODE_CUISINE.md` §4.0).
 *
 * ⚠️ ANNONCÉE « v9 » DANS LE DOCUMENT DE PLAN, elle est une v10 : la v9 a été prise le même jour par
 * les plats préparés. La règle de v2 ne fait pas d'exception d'ancienneté, et deux migrations
 * portant le même numéro seraient la perte de données que ce fichier existe pour empêcher.
 *
 * ⚠️ `fin_ms` EST UNE ÉCHÉANCE ABSOLUE, JAMAIS UN TEMPS RESTANT — c'est le point 7 de §5bis
 * ARCHITECTURE, et c'est une garantie de sécurité, pas de confort. Un « restant » stocké se fige
 * quand l'application est fermée ; la casserole, elle, ne fait pas de pause. Au retour, un restant
 * figé afficherait « il reste 4 min » sur un plat qui cuit depuis quarante — l'appli mentirait à
 * propos de nourriture. Une échéance absolue rend l'erreur inexprimable : `fin_ms - maintenant` est
 * soit un reste réel, soit un dépassement.
 *
 * ⚠️ LES DEUX RÉGIMES SONT MUTUELLEMENT EXCLUSIFS PAR CONSTRUCTION, et le `CHECK` est ce qui le
 * rend vrai. En marche il n'existe qu'une échéance ; en pause il n'existe qu'un reste. Le document
 * de plan esquissait `fin_ms NOT NULL` + `pause_restant_s` nullable : une ligne en pause y aurait
 * gardé une échéance périmée, lisible par erreur — exactement l'état à deux champs contradictoires
 * que la v9 vient d'écarter sur `hors_catalogue`. La garantie vient de la forme (acquis n°2).
 *
 * `ouverte_le` en ms epoch, comme `fin_ms` : la péremption du bandeau se calcule par soustraction,
 * et une chaîne ISO demanderait une analyse à chaque lecture.
 *
 * `id = 1` — une seule session, la v1 est mono-recette. La v1.5 (synchronisation multi-recettes)
 * fera sauter cette contrainte, pas avant.
 */
const V10_STATEMENTS: readonly string[] = [
  `CREATE TABLE user_cuisine_session (
     id INTEGER PRIMARY KEY CHECK (id = 1),
     recette_id TEXT NOT NULL,
     ordre_courant INTEGER NOT NULL CHECK (ordre_courant >= 1),
     ouverte_le INTEGER NOT NULL
   )`,

  `CREATE TABLE user_cuisine_timer (
     session_id INTEGER NOT NULL DEFAULT 1
       REFERENCES user_cuisine_session(id) ON DELETE CASCADE,
     ordre INTEGER NOT NULL CHECK (ordre >= 1),
     fin_ms INTEGER,
     pause_restant_s INTEGER CHECK (pause_restant_s IS NULL OR pause_restant_s >= 0),
     -- En marche OU en pause, jamais les deux, jamais aucun des deux.
     CHECK ((fin_ms IS NOT NULL AND pause_restant_s IS NULL)
         OR (fin_ms IS NULL AND pause_restant_s IS NOT NULL)),
     PRIMARY KEY (session_id, ordre)
   )`,
]

/**
 * v11 — LES PORTIONS SUIVENT LA CUISSON.
 *
 * Régler 6 portions sur la fiche puis lancer le mode cuisine rouvrait le plat à 4 : l'état React de
 * la fiche meurt au démontage, un hash ne transporte qu'un identifiant, et la session v10 n'avait
 * pas de colonne où poser la valeur. On redemandait donc la même chose deux fois, la seconde les
 * mains dans la farine.
 *
 * ⚠️ NULLABLE, ET C'EST LE SENS DE LA COLONNE. `NULL` = « aucun choix exprimé », pas « 4 » : c'est
 * l'état des sessions ouvertes AVANT cette migration, et celui d'une reprise dont le lien ne porte
 * rien. L'écran retombe alors sur le `portionsBase` de la recette. Écrire un nombre par défaut ici
 * aurait inventé un choix que personne n'a fait — et un `ALTER TABLE … NOT NULL` l'aurait exigé,
 * puisque SQLite réclame une valeur par défaut, forcément la même pour toutes les recettes.
 *
 * Le `CHECK` refuse 0 et le négatif : `portions = 0` ferait disparaître la recette de sa propre
 * mise à l'échelle. Le routeur filtre déjà (`portionsDepuisRequete`), la base ne s'en remet pas à lui.
 */
const V11_STATEMENTS: readonly string[] = [
  `ALTER TABLE user_cuisine_session
     ADD COLUMN portions INTEGER CHECK (portions IS NULL OR portions >= 1)`,
]

/**
 * v12 — `user_profile.tolerance_piquant` (décision 35, tranchée le 2026-08-07).
 *
 * ⚠️ DANS `user_profile` ET PAS DANS `user_display`, malgré l'apparence : ce n'est pas un réglage
 * d'affichage mais un GOÛT durable, et `facteur_portion` — « je mange un peu plus / un peu moins » —
 * est le précédent exact d'une préférence personnelle logée dans cette table.
 *
 * ⚠️ ELLE N'ENTRE PAS DANS `UserProfile` (engine/domain/profile.ts), qui décrit une PHYSIOLOGIE. La
 * tolérance voyage sur `SuggestionRequest.tolerancePiquant`, à côté de `varietyMode`. Une colonne
 * de `user_profile` qui ne fait pas partie du type `UserProfile` n'est pas une anomalie : `cree_le`
 * est déjà dans ce cas, et se lit par un accesseur dédié.
 *
 * ⚠️ NULLABLE, ET C'EST LE SENS DE LA COLONNE. `NULL` = « jamais déclaré », PAS « tout ». Les deux
 * se comportent pareil pour le moteur — aucune pénalité — mais afficher « J'aime le piquant » à
 * quelqu'un qui n'a rien dit lui prêterait un choix qu'il n'a pas fait. Même règle que
 * `recipe.piquant`, dont l'absence ne vaut jamais « doux ». C'est aussi ce qui garde la couche
 * `piquant` à poids nul tant que personne n'a répondu.
 *
 * Le `CHECK` ferme le vocabulaire aux trois positions de `PiquantTolerance`. Il ne stocke PAS le
 * nombre 0-4 de l'échelle catalogue : le seuil se déduit de la position (voir `SEUIL_PAR_TOLERANCE`),
 * et écrire un chiffre ici figerait en base une correspondance qui appartient au moteur.
 */
const V12_STATEMENTS: readonly string[] = [
  `ALTER TABLE user_profile
     ADD COLUMN tolerance_piquant TEXT
     CHECK (tolerance_piquant IS NULL OR tolerance_piquant IN ('aucun','un_peu','tout'))`,
]

/**
 * v13 — PLUSIEURS CUISSONS À LA FOIS (lot L4, `CONCEPTION_MODE_CUISINE.md` §4.0).
 *
 * C'est la migration que la v10 annonçait en toutes lettres : « `id = 1` — une seule session, la v1
 * est mono-recette. La v1.5 fera sauter cette contrainte, pas avant. » La voici.
 *
 * ⚠️ POURQUOI CETTE DANSE DE TABLES PLUTÔT QU'UN `ALTER TABLE`. Trois faits se combinent, et aucun
 * ne se contourne :
 *   1. SQLite ne sait pas retirer un `CHECK` ; il faut recréer la table.
 *   2. La procédure officielle pour ça commence par `PRAGMA foreign_keys = OFF` — or ce pragma est
 *      IGNORÉ EN SILENCE à l'intérieur d'une transaction, et `migrate()` en ouvre une par migration.
 *   3. `PRAGMA foreign_keys` est ON (`user-store-node.ts`), donc `DROP TABLE user_cuisine_session`
 *      exécute un `DELETE FROM` implicite qui déclenche le `ON DELETE CASCADE` de la table des
 *      minuteurs. Le drop naïf EFFACERAIT TOUS LES MINUTEURS EN COURS — sur l'appareil de quelqu'un
 *      qui a une cuisson lancée, silencieusement, à la première ouverture après mise à jour.
 * D'où : les minuteurs sont copiés à l'abri, l'ENFANT est détaché EN PREMIER (plus aucune FK ne vise
 * la session, donc plus de cascade possible), la session est refaite, et l'enfant n'est recréé
 * qu'APRÈS le `RENAME` — sinon `ALTER TABLE … RENAME TO` réécrirait sa clause `REFERENCES` en cours
 * de route, ce qui marche mais rend la séquence illisible à la relecture.
 *
 * ⚠️ `recette_id … UNIQUE` : la même recette deux fois dans une cuisson est un défaut d'appelant.
 * `engine/cuisine/ordonnancement.ts` lève déjà une `Error` dessus ; la contrainte le rend
 * INEXPRIMABLE plutôt que rattrapé au vol. Acquis n°2 du projet — la garantie vient de la forme.
 *
 * ⚠️ `DEFAULT 1` RETIRÉ de `user_cuisine_timer.session_id`. Inoffensif tant qu'une seule session
 * existait, piège dès qu'il y en a trois : une écriture qui omettrait la colonne rattacherait le
 * minuteur à la première cuisson sans que rien ne proteste. Le store passe déjà `session_id`
 * explicitement — ce retrait ne casse aucun appelant, il ferme une porte avant qu'on la pousse.
 *
 * ⚠️ L'HEURE DE SERVICE DANS SA PROPRE TABLE À LIGNE UNIQUE, et non en colonne sur chaque session.
 * « À table à 20 h » est UNE propriété du repas, pas de chaque plat : une colonne par session, c'est
 * N copies de la même valeur et rien qui dise laquelle fait foi le jour où elles divergent. La
 * contrepartie est explicite et assumée — effacer une cuisson devra vider DEUX tables.
 *
 * ⚠️ `heure_service_ms` NULLABLE, et c'est le sens de la colonne. `NULL` = « aucune heure choisie »,
 * pas une valeur par défaut déguisée : c'est l'état de toute session migrée depuis la v12, et celui
 * de quelqu'un qui cuisine un seul plat sans viser d'heure. Même discipline que `portions` (v11) et
 * `tolerance_piquant` (v12).
 *
 * ⚠️ AUCUNE COLONNE D'ORDRE. Le rang de chaque plat est RECALCULÉ à l'affichage par
 * `ordonnancerCuissons`. Le stocker le laisserait dérailler dès l'ajout d'une cuisson, et un dérivé
 * périmé en base est plus dangereux qu'un calcul refait — celui-ci est pur et instantané.
 *
 * COMPATIBLE AVEC LE STORE ACTUEL, à dessein : `user-store.ts` code encore `id = 1` en dur partout,
 * et `1` reste un identifiant de session parfaitement valide. Cette migration ne casse donc aucun
 * appelant. La lecture et l'écriture de N sessions viennent au lot suivant.
 */
const V13_STATEMENTS: readonly string[] = [
  // 1 · Mettre les minuteurs à l'abri AVANT de toucher au parent (voir le point 3 ci-dessus).
  `CREATE TABLE tmp_cuisine_timer (
     session_id INTEGER, ordre INTEGER, fin_ms INTEGER, pause_restant_s INTEGER
   )`,
  `INSERT INTO tmp_cuisine_timer (session_id, ordre, fin_ms, pause_restant_s)
     SELECT session_id, ordre, fin_ms, pause_restant_s FROM user_cuisine_timer`,

  // 2 · Détacher l'enfant : plus aucune FK ne vise la session, donc plus de cascade au drop.
  `DROP TABLE user_cuisine_timer`,

  // 3 · La session, sans `CHECK (id = 1)` et avec une seule ligne par recette.
  `CREATE TABLE user_cuisine_session_neuve (
     id            INTEGER PRIMARY KEY,
     recette_id    TEXT NOT NULL UNIQUE,
     ordre_courant INTEGER NOT NULL CHECK (ordre_courant >= 1),
     ouverte_le    INTEGER NOT NULL,
     portions      INTEGER CHECK (portions IS NULL OR portions >= 1)
   )`,
  `INSERT INTO user_cuisine_session_neuve (id, recette_id, ordre_courant, ouverte_le, portions)
     SELECT id, recette_id, ordre_courant, ouverte_le, portions FROM user_cuisine_session`,
  `DROP TABLE user_cuisine_session`,
  `ALTER TABLE user_cuisine_session_neuve RENAME TO user_cuisine_session`,

  // 4 · Recréer l'enfant SANS `DEFAULT 1`, puis lui rendre ses minuteurs.
  `CREATE TABLE user_cuisine_timer (
     session_id INTEGER NOT NULL
       REFERENCES user_cuisine_session(id) ON DELETE CASCADE,
     ordre INTEGER NOT NULL CHECK (ordre >= 1),
     fin_ms INTEGER,
     pause_restant_s INTEGER CHECK (pause_restant_s IS NULL OR pause_restant_s >= 0),
     -- En marche OU en pause, jamais les deux, jamais aucun des deux (inchangé depuis la v10).
     CHECK ((fin_ms IS NOT NULL AND pause_restant_s IS NULL)
         OR (fin_ms IS NULL AND pause_restant_s IS NOT NULL)),
     PRIMARY KEY (session_id, ordre)
   )`,
  `INSERT INTO user_cuisine_timer (session_id, ordre, fin_ms, pause_restant_s)
     SELECT session_id, ordre, fin_ms, pause_restant_s FROM tmp_cuisine_timer`,
  `DROP TABLE tmp_cuisine_timer`,

  // 5 · L'heure de service : UNE valeur pour tout le repas, pas une par plat.
  `CREATE TABLE user_cuisine_service (
     id INTEGER PRIMARY KEY CHECK (id = 1),
     heure_service_ms INTEGER
   )`,
]

/**
 * v14 — « je prends toujours cette sauce avec ce plat ».
 *
 * ⚠️ À NE PAS CONFONDRE AVEC `recipe_sauce` DU CATALOGUE, qui vit dans l'autre fichier. Le catalogue
 * PROPOSE (`Recipe.sauceIds`, éditorial, remplacé à chaque mise à jour) ; cette table-ci enregistre
 * ce que L'UTILISATEUR a choisi, et rien ne doit jamais écrire dans l'une en croyant toucher
 * l'autre. Une sauce prise dans la section « Autres sauces » se choisit tout autant qu'une sauce
 * attachée : le lien de l'utilisateur ne dérive pas de celui du catalogue.
 *
 * ⚠️ PAR PLAT, PAS PAR CRÉNEAU. La variante `(plan_id, jour, creneau, sauce_id)` a été écartée : une
 * sauce retenue est une préférence durable, valable pour toutes les semaines à venir, régénérations
 * comprises. La clé par créneau aurait obligé à re-choisir la même sauce à chaque plan, et aurait
 * perdu le choix au premier « régénérer ma semaine ».
 *
 * ⚠️ PAS DE `CHECK` NI DE FK sur les deux colonnes : elles désignent des recettes de `catalog.db`,
 * un autre fichier — SQLite ne contraint pas entre bases (voir l'en-tête). Un id devenu inconnu
 * après une mise à jour du catalogue s'ignore en silence, à la lecture, comme partout ailleurs.
 */
const V14_STATEMENTS: readonly string[] = [
  `CREATE TABLE user_recipe_sauce (
     recipe_id       TEXT NOT NULL,
     sauce_recipe_id TEXT NOT NULL,
     PRIMARY KEY (recipe_id, sauce_recipe_id)
   )`,
]

/**
 * v15 — « les aliments que je ne veux pas », par GROUPE d'origine animale.
 *
 * Sert le végétarisme lacto- / ovo- sans toucher au filtre `regime`, qui reste 🔒 critique :
 * « végétarien » + retrait du groupe « Œufs » donne un lacto-végétarien, et le végétarien qui
 * refuse la présure retire le roquefort lui-même. Ce qui devient configurable, c'est ce que la
 * couche `exclusions` LIT — jamais le filtre.
 *
 * ⚠️ ON STOCKE LE GROUPE, PAS SES ALIMENTS, et c'est toute la décision. Enregistrer aujourd'hui les
 * 7 aliments du groupe « Œufs » servirait le huitième, ajouté au catalogue le mois prochain, à
 * quelqu'un qui avait justement coché « Œufs » — sans erreur, sans test rouge, sans rien à l'écran.
 * Le dépliage en aliments se fait donc à la LECTURE (`readExcludedFoodIdsDeplies`, user-store.ts),
 * contre le catalogue du jour.
 *
 * ⚠️ `user_group_exception` NE PORTE PAS DE COLONNE DE GROUPE. Un aliment tombe dans exactement un
 * groupe — invariant vérifié par test (engine/domain/groupes-animaux.test.ts et
 * tests/groupes-animaux-catalogue.test.ts) — et la stocker dupliquerait un fait dérivable, qui
 * périmerait au premier aliment reclassé par une mise à jour du catalogue. Une exception dont le
 * groupe n'est pas coché est INERTE : elle ne devient pas fausse, elle cesse de s'appliquer.
 *
 * ⚠️ LE `CHECK` SUR `groupe_id` NE PROTÈGE RIEN À L'EXÉCUTION, ET DOIT RESTER. Le seul id douteux
 * qui puisse arriver ici a été écrit par une version ANTÉRIEURE de l'app, donc valide au moment de
 * l'insertion ; une faute de frappe côté code est déjà arrêtée par le type `GroupeAnimalId`. Ce
 * CHECK est un FIL-PIÈGE, pas un garde-fou : il fige les sept valeurs en SQL, si bien que scinder ou
 * renommer un groupe force une reconstruction de table — donc une migration qu'on ne peut pas ne pas
 * écrire, et dans laquelle on réécrira les `groupe_id` déjà stockés. Sans elle, un groupe retiré
 * cesse SILENCIEUSEMENT de l'être (voir l'en-tête de `GroupeAnimalId`, engine/domain/).
 *
 * ⚠️ AUCUN CHECK NI FK SUR `food_id`, comme partout : il désigne `catalog.db`, un autre fichier.
 * Un aliment devenu inconnu s'ignore en silence à la lecture — ici c'est sans danger, un aliment
 * absent du catalogue n'est de toute façon proposé par personne.
 */
const V15_STATEMENTS: readonly string[] = [
  `CREATE TABLE user_excluded_group (
     groupe_id TEXT PRIMARY KEY
       CHECK (groupe_id IN ('laitiers','oeufs','miel','viande_mammifere','volaille','poisson','fruits_de_mer'))
   )`,

  `CREATE TABLE user_group_exception (
     food_id TEXT PRIMARY KEY
   )`,
]

/**
 * v16 — `user_admitted_food` : l'ALIMENT ADMIS PAR EXCEPTION AU RÉGIME. Le végétalien qui mange du
 * miel, le végétarien qui garde les huîtres. Lot D2 de `docs/CONCEPTION_REGIME_PERSONNALISE.md` ;
 * le chemin moteur est arrivé en D1 (`HardConstraints.admittedFoodIds`, couche `regime`).
 *
 * ⛔ NE PAS CONFONDRE AVEC `user_group_exception` (v15). Les deux mots « exception » se ressemblent
 * assez pour être lus l'un pour l'autre, et une seule des deux peut faire manger un produit animal
 * à quelqu'un qui a déclaré ne pas en manger :
 *
 *   | Table                       | Sens                                          | Direction   | Couche lue   |
 *   |-----------------------------|-----------------------------------------------|-------------|--------------|
 *   | `user_group_exception` (v15)| « j'ai coché le groupe Œufs, SAUF la caille » | RESTREINT   | `exclusions` |
 *   | `user_admitted_food`  (v16) | « je suis végétalien, SAUF le miel »          | ASSOUPLIT   | `regime`     |
 *
 * La première retire moins d'aliments à quelqu'un qui en avait retiré un groupe entier ; elle ne
 * touche jamais le filtre de régime. La seconde rend la couche 🔒 `regime` moins stricte, et elle
 * seule. Fusionner les deux tables reviendrait à faire circuler une admission de régime dans le
 * mécanisme d'exclusion, où P4 (lot D1) garantit précisément qu'elle n'entre pas.
 *
 * ⚠️ PRÉSÉANCE : `exclusion personnelle > admission`. Un aliment à la fois admis ici et exclu par
 * `user_excluded_food` (ou par un groupe coché) reste EXCLU. Rien n'est arbitré au stockage ni à la
 * lecture : les deux listes partent au moteur telles quelles, et ce sont les COUCHES qui tranchent —
 * `exclusions` écarte la recette quoi qu'en dise `regime`. Un arbitrage ici donnerait l'illusion que
 * c'est lui qui protège, et masquerait une régression de P4 le jour où il en surviendrait une.
 *
 * ⚠️ AUCUN `CHECK` NI FK SUR `food_id`, comme partout. Un `food_id` est une donnée de `catalog.db`,
 * un autre fichier, remplacé en bloc à chaque release : le figer en SQL imposerait une migration à
 * chaque aliment ajouté au catalogue. Le vocabulaire fermé (`groupe_id` en v15, `cible_type`,
 * `niveau_activite`) porte un CHECK parce qu'il est fermé ; celui-ci est ouvert.
 * Un aliment admis puis retiré du catalogue s'ignore alors en silence : la ligne survit, et plus
 * aucune recette ne cite cet identifiant, donc l'admission ne rattrape rien. Ni erreur, ni effet.
 */
const V16_STATEMENTS: readonly string[] = [
  `CREATE TABLE user_admitted_food (
     food_id TEXT PRIMARY KEY
   )`,
]

export const MIGRATIONS: readonly Migration[] = [
  { version: 1, statements: V1_STATEMENTS },
  { version: 2, statements: V2_STATEMENTS },
  { version: 3, statements: V3_STATEMENTS },
  { version: 4, statements: V4_STATEMENTS },
  { version: 5, statements: V5_STATEMENTS },
  { version: 6, statements: V6_STATEMENTS },
  { version: 7, statements: V7_STATEMENTS },
  { version: 8, statements: V8_STATEMENTS },
  { version: 9, statements: V9_STATEMENTS },
  { version: 10, statements: V10_STATEMENTS },
  { version: 11, statements: V11_STATEMENTS },
  { version: 12, statements: V12_STATEMENTS },
  { version: 13, statements: V13_STATEMENTS },
  { version: 14, statements: V14_STATEMENTS },
  { version: 15, statements: V15_STATEMENTS },
  { version: 16, statements: V16_STATEMENTS },
]

/** Version du schéma présente en base. `0` = base vide, aucune migration jouée. */
export function readSchemaVersion(db: UserDb): number {
  for (const sql of BOOTSTRAP_SQL) db.run(sql)
  const lignes = db.all<{ readonly schema_version: number }>('SELECT schema_version FROM app_meta WHERE id = 1')
  return lignes[0]?.schema_version ?? 0
}

/**
 * Amène la base à `USER_SCHEMA_VERSION` et rend la version atteinte. IDEMPOTENT : appelée sur une
 * base déjà à jour, elle ne fait rien.
 *
 * Chaque migration est appliquée dans SA PROPRE transaction, avec le `UPDATE app_meta` dedans — le
 * DDL de SQLite étant transactionnel, une migration interrompue laisse la base à sa version
 * précédente, jamais à moitié migrée. C'est la seule protection possible pour un fichier qui ne se
 * re-télécharge pas.
 */
export function migrate(db: UserDb): number {
  let version = readSchemaVersion(db)
  for (const migration of MIGRATIONS) {
    if (migration.version <= version) continue
    withTransaction(db, () => {
      for (const sql of migration.statements) db.run(sql)
      db.run('UPDATE app_meta SET schema_version = ? WHERE id = 1', [migration.version])
    })
    version = migration.version
  }
  return version
}
