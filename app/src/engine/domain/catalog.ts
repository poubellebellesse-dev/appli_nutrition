// engine/domain/catalog.ts
//
// Formes PROPRES en RAM du catalogue — pas les lignes SQL brutes. Le mapping DB → domaine est
// fait par data/ (hors engine), à partir du schéma réel produit par catalog/build.mjs
// (constante SCHEMA_SQL + référentiels NUTRIENTS/ALLERGENS). Voir docs/ENGINE.md §9.1 et
// docs/ARCHITECTURE.md §4.2.
//
// Écarts assumés par rapport aux documents, documentés au fil du fichier :
//  - `food` a `saison_mois` et `toute_annee` dans le schéma réel depuis P1b-1 (§4.2 ARCHITECTURE,
//    §6.5 ENGINE précision 3), et `sous_famille` depuis §6.6 quater. Toujours pas de `sous_groupe`
//    au sens taxonomique du §4.2 : `sous_famille` ne le remplace PAS — elle ne renseigne que les
//    aliments dont le catalogue contient plusieurs entrées du même produit de base, et sert un
//    besoin précis (la récence). Food suit le réel.
//  - Plusieurs champs texte (axe_texture, recipe_facet.valeur, régime) n'ont AUCUNE contrainte
//    CHECK en base : vocabulaire ouvert, typé `string` plutôt qu'en union littérale fermée.
//  - `topics`/`substitutions` sur Catalog n'ont pas encore de table dans catalog.db (v1.5/v2,
//    voir ARCHITECTURE §11 "Ouvertes" et §10.1 ENGINE) ; inclus quand même car §9.1 ENGINE les
//    spécifie explicitement sur Catalog — data/ retournera des Map vides tant que ces tables
//    n'existent pas au build.

import type {
  FoodId,
  RecipeId,
  NutrientId,
  AllergenId,
  LexiconEntryId,
  TopicId,
  EvidenceSheetId,
} from './ids.js'
import type { Grams, Minutes } from './units.js'

// --- Nutriments & allergènes (référentiels build.mjs NUTRIENTS / ALLERGENS) ------------------

/** Vecteur nutritionnel indexé par position dans `Catalog.nutrients` (§5.1, §9.1 ENGINE). */
export type NutrientVector = Float64Array

/** Valeurs observées dans build.mjs NUTRIENTS ; colonne `categorie` TEXT nullable en base. */
export type NutrientCategory = 'macronutriment' | 'mineral' | 'vitamine'

/**
 * Sens de l'écart nutritionnel — colonne `nutrient.sens`, CHECK en base sur ces trois valeurs
 * exactement (build.mjs SCHEMA_SQL) : union littérale FERMÉE, à la différence de `Texture` ou
 * `DietCode` qui restent des `string` ouverts faute de contrainte CHECK correspondante.
 *
 * Pourquoi ce champ existe : `scoreNutri` (engine/selection/scoring/nutri.ts) calculait un écart
 * SYMÉTRIQUE (`|recette − cible| / cible`) pour tous les nutriments, ce qui punit un dépassement
 * exactement comme un manque. Absurde pour un plancher (le fer, les fibres — plus n'est jamais
 * pire) ou un plafond (le sodium — moins n'est jamais pire) : le moteur finissait par préférer
 * structurellement les plats nutritionnellement moyens. `sens` dit à `scoreNutri` quel côté de
 * l'écart compte réellement :
 *  - `cible`    : viser la valeur pile — trop et pas assez pénalisent tous les deux (macros).
 *  - `plancher` : ne pas être EN DESSOUS — un excès ne pénalise jamais (fibres, fer, calcium,
 *    vitamine C : plus il y en a, mieux c'est en pratique).
 *  - `plafond`  : ne pas être AU-DESSUS — être en dessous ne pénalise jamais (sodium).
 */
export type NutrientSense = 'cible' | 'plancher' | 'plafond'

export interface Nutrient {
  readonly id: NutrientId
  readonly code: string
  readonly nom: string
  readonly unite: string
  readonly vnrAdulte: number | null
  readonly categorie: NutrientCategory | null
  readonly sens: NutrientSense
}

export type AllergenCertitude = 'contient' | 'traces'

export interface Allergen {
  readonly id: AllergenId
  readonly code: string
  readonly nom: string
}

export interface FoodAllergen {
  readonly allergenId: AllergenId
  readonly certitude: AllergenCertitude
}

/**
 * De quel animal un aliment provient — FACTUEL, indépendant des règles qui le lisent.
 *
 * ⚠️ CE N'EST PAS UN RÉGIME. Même leçon que `MealSlot` / `CourseKind` : le fait et la règle sont
 * deux axes. `DIET_CHAIN` (§6.3 ter) en DÉDUIT ce qu'elle veut — `poisson` et `fruit_de_mer`
 * autorisent le pescétarien, `mammifere` et `volaille` non — mais un futur filtre halal, casher ou
 * « sans porc » lira le même champ pour en tirer autre chose. Encoder directement le régime ici
 * fermerait la porte à tout le reste.
 *
 * `null` = origine végétale ou minérale. Ce n'est PAS « inconnu » : le champ est obligatoire et
 * chaque aliment du catalogue est annoté.
 */
export type AnimalOrigin = 'mammifere' | 'volaille' | 'poisson' | 'fruit_de_mer' | 'insecte'

// --- Aliments (table `food` + `food_nutrient` + `food_allergen`) -----------------------------

export interface Food {
  readonly id: FoodId
  readonly codeCiqual: string
  readonly nom: string
  /**
   * Noms d'USAGE supplémentaires du même aliment — « lardon » pour « Porc, poitrine crue »,
   * « gambas » pour « Crevette, crue ». Vide pour la très grande majorité.
   *
   * ⚠️ UN SYNONYME NE CRÉE JAMAIS D'ALIMENT et ne dit PAS qu'on peut remplacer A par B. C'est un
   * alias de recherche sur CET aliment, qui garde ses propres nutriments et ses propres allergènes
   * (le garde-fou §5.2 n'est pas traversé : on ne fait que le nommer autrement). Une substitution
   * est un tout autre objet — voir `Substitution`.
   *
   * ⚠️ AUCUNE SOURCE N'EST EXIGÉE, et c'est délibéré. Le critère est « quelqu'un qui a ce produit
   * dans son panier le désignerait-il par ce mot », pas « une institution l'a écrit » : la
   * décision 48 a brûlé trois passes de recherche sourcée pour rendre ZÉRO couple en exigeant une
   * source sur des équivalences culinaires. Ne pas rejouer ça ici.
   *
   * Requis, jamais optionnel : un champ optionnel s'omet sans erreur — ni au type, ni au test, ni
   * à l'écran. C'est le défaut signature de ce projet, quatre occurrences déjà payées.
   */
  readonly synonymes: readonly string[]
  readonly groupe: string
  /**
   * Sous-famille facultative — regroupe les aliments qui sont le MÊME produit de base
   * (`poulet_blanc` et `poulet_cuisse` → `poulet`). `null` quand l'aliment est seul de son espèce,
   * ce qui est le cas de la très grande majorité.
   *
   * ⚠️ N'est PAS une taxonomie : elle n'existe que là où le catalogue contient plusieurs entrées
   * du même produit, et sert un besoin précis — la récence de `variety`/`habit` (§6.6 quater
   * ENGINE). `groupe` ne peut pas jouer ce rôle : « viandes » mélange bœuf, poulet, porc et agneau,
   * ce qui a été mesuré et écarté.
   */
  readonly sousFamille: string | null
  /** `food_nutrient`, une ligne par nutriment — regroupé en Map propre, pas en lignes SQL. */
  readonly nutrimentsPour100g: ReadonlyMap<NutrientId, number>
  readonly allergenes: readonly FoodAllergen[]
  /**
   * Mois de PLEINE SAISON — production locale (P1b-1, §4.2 ARCHITECTURE). Vide = saisonnalité non
   * renseignée, ce qui exclut l'aliment du calcul de la couche `season` (staple au sens de §6.5
   * ENGINE précision 3 : pâtes, riz, huile, sel…). Indépendant de `touteAnnee`.
   */
  readonly saisonMois: readonly Month[]
  /**
   * DISPONIBILITÉ toute l'année (rayon, conservation longue) — dimension INDÉPENDANTE de
   * `saisonMois` : un légume de garde porte légitimement les deux. Module le crédit d'un
   * ingrédient hors saison dans `scoreSeason`, ne l'exclut pas.
   */
  readonly touteAnnee: boolean
  /**
   * Piquant de l'ALIMENT lui-même (§ `PiquantLevel`). `null` = non renseigné.
   * ⚠️ Le piquant d'une recette n'en est PAS la somme — voir `Recipe.piquant`.
   */
  readonly piquant: PiquantLevel | null
  /**
   * Poids MOYEN d'une pièce, en grammes — une carotte 120 g, un oignon 110 g, un œuf 60 g. `null` =
   * ne se compte pas à la pièce (farine, riz, épinards).
   *
   * ⚠️ UN SEUL POIDS, pas petit/moyen/gros. Trois tailles demanderaient à l'utilisateur laquelle il
   * trouvera en magasin — information qu'il n'a PAS au moment de planifier. Un poids moyen plus un
   * arrondi à la hausse suffit, et c'est ce que font les livres de cuisine.
   *
   * ⚠️ PRIME sur `conditionnementG` : « 3 carottes » est plus utile que « 350 g » devant le bac.
   */
  readonly poidsPieceG: number | null
  /**
   * Fond de placard — sel, poivre, épices sèches. Écarté de la liste de courses PAR DÉFAUT.
   *
   * ⚠️ CE N'EST PAS « on n'en a jamais besoin », c'est « on ne le rachète pas chaque semaine ».
   * `sel_fin` apparaît 163 fois « au goût » dans le catalogue : le lister à chaque virée noierait
   * les vraies lignes sous du bruit. `ShoppingOptions.inclureFondDePlacard` le réaffiche.
   */
  readonly fondDePlacard: boolean
  /**
   * Taille du CONDITIONNEMENT de vente, en grammes — plaquette de beurre 250 g, brique de lait
   * 1 000 g, œuf 60 g. `null` = vendu au poids (fruits, légumes, viande à la coupe).
   *
   * ⚠️ UN SEUL NOMBRE SUFFIT, pas une échelle de tailles. On achète `⌈besoin ÷ conditionnement⌉`
   * paquets : avec une plaquette de 250 g, 240 g d'un besoin donnent 1 plaquette (250 g) et 260 g
   * en donnent 2 (500 g). Une liste de tailles disponibles n'ajouterait rien — deux plaquettes de
   * 250 g valent une de 500 g au moment de payer.
   *
   * ⚠️ TOUJOURS AU-DESSUS, jamais au-dessous : il vaut mieux un reste de course qu'un ingrédient
   * manquant au moment de cuisiner.
   */
  readonly conditionnementG: number | null
  /**
   * Origine animale DIRECTE (§ `AnimalOrigin`). `null` = végétal, minéral, **ou dérivé** — dans ce
   * dernier cas l'origine se lit sur `deriveDe`. Toujours passer par `resolveAnimalOrigin`, jamais
   * lire ce champ seul : le beurre a `origineAnimale: null` et vient pourtant d'un mammifère.
   */
  readonly origineAnimale: AnimalOrigin | null
  /**
   * Aliment dont celui-ci est TIRÉ — `beurre_doux` → `lait_entier`. L'origine animale se propage le
   * long de cette chaîne : le beurre vient du lait, qui vient d'un mammifère, donc le beurre vient
   * d'un mammifère.
   *
   * ⚠️ C'est ce champ qui rattrape les dérivés que `Food.groupe` laisse passer. Le beurre est classé
   * en « matières grasses » et le miel en « produits sucrés » — aucun groupe animal. Une règle
   * fondée sur le seul groupe déclarait « Radis au beurre » végétalienne, et une recette au miel
   * s'est réellement retrouvée étiquetée `vegetalien` au catalogue (décision 38).
   */
  readonly deriveDe: FoodId | null
}

/**
 * Remonte la chaîne `deriveDe` jusqu'à trouver une origine animale déclarée. `null` = végétal ou
 * minéral, une fois la chaîne épuisée.
 *
 * ⚠️ GARDE ANTI-CYCLE. Une chaîne mal saisie (`a` dérive de `b` qui dérive de `a`) boucle sans fin.
 * Le build la refuse déjà, mais cette fonction est appelée sur des données qui peuvent venir
 * d'ailleurs : elle s'arrête et rend `null` plutôt que de figer l'appelant. Ne pas retirer cette
 * garde au motif que « le build vérifie » — le build vérifie SON catalogue, pas tous.
 */
export function resolveAnimalOrigin(
  food: Food | undefined,
  foods: ReadonlyMap<FoodId, Food>
): AnimalOrigin | null {
  const vus = new Set<FoodId>()
  let courant = food
  while (courant !== undefined) {
    if (courant.origineAnimale !== null) return courant.origineAnimale
    if (courant.deriveDe === null || vus.has(courant.id)) return null
    vus.add(courant.id)
    courant = foods.get(courant.deriveDe)
  }
  return null
}

// --- Recettes (table `recipe` + tables liées) -------------------------------------------------

export type RecipeEnvergure = 'quotidien' | 'convivial' | 'fete'

/**
 * `axe_texture` est un TEXT libre en base (aucun CHECK) : vocabulaire ouvert, pas une enum
 * fermée. Alias plutôt qu'union littérale pour ne pas mentir sur la contrainte réelle.
 */
export type Texture = string

export interface SensoryAxes {
  readonly sucreSale: number // -1 (salé) … +1 (sucré)
  readonly legerConsistant: number // -1 (léger) … +1 (consistant)
  readonly chaudFroid: number // -1 (froid) … +1 (chaud)
  readonly texture: Texture
}

export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

/**
 * `recipe.types_repas` est un TEXT JSON libre en base (aucun CHECK). Les 4 valeurs ci-dessous
 * sont celles observées dans les 10 recettes de test du catalogue. Fermé en union littérale
 * malgré tout car MealSlot sert de clé de Map (`CatalogIndexes.recipesBySlot`) — à élargir si
 * le catalogue réel introduit d'autres créneaux.
 */
export type MealSlot = 'petit_dejeuner' | 'dejeuner' | 'gouter' | 'diner'

/**
 * TYPE DE RECETTE — le rôle qu'elle joue dans un repas.
 *
 * ⚠️ AXE ORTHOGONAL À `MealSlot`, PAS UNE ALTERNATIVE. C'est la confusion qu'il faut éviter :
 *   - `MealSlot` répond à QUAND — petit-déjeuner, déjeuner, goûter, dîner ;
 *   - `CourseKind` répond à QUEL RÔLE — entrée, plat, accompagnement, fromage, dessert.
 * Une « Carottes Vichy » est un `accompagnement` servi au `dejeuner` ET au `diner`. Les deux
 * dimensions se cumulent ; aucune ne remplace l'autre. Croire le contraire mène à vouloir « sortir »
 * un accompagnement des créneaux principaux, ce qui le ferait disparaître de l'appli faute de
 * créneau d'accueil — `MealSlot` n'a pas de case « accompagnement ».
 *
 * L'ORDRE DE LA LISTE EST L'ORDRE DE SERVICE FRANÇAIS : entrée, plat, accompagnement, **fromage,
 * puis dessert**. Le fromage précède le dessert, contrairement à l'usage anglo-saxon — il servira
 * au mode repas de v1.5 (§2.1 CONCEPTION_B_VIN_REPAS).
 *
 * ⚠️ Un `accompagnement` PEUT être servi seul (décision utilisateur, 2026-07-28) — une purée ou des
 * légumes sautés font un dîner léger recevable, au même titre qu'un goûter salé. Ne pas coder de
 * règle « jamais seul » : elle serait fausse.
 */
export type CourseKind = 'entree' | 'plat' | 'accompagnement' | 'fromage' | 'dessert'

/** L'ordre de service (§2.1 CONCEPTION_B_VIN_REPAS) — figé ici pour ne pas être redéduit ailleurs. */
export const COURSE_ORDER: readonly CourseKind[] = ['entree', 'plat', 'accompagnement', 'fromage', 'dessert']

/**
 * Niveau de piquant, 0 à 4 : 0 pas piquant · 1 un peu · 2 moyen · 3 fort · 4 extrême.
 *
 * ⚠️ `null` = NON RENSEIGNÉ, jamais « doux ». Même principe que partout ailleurs dans ce moteur
 * (§5.1 bis) : l'absence d'information n'est pas une information.
 *
 * ⚠️ POURQUOI UN NIVEAU ÉDITORIAL ET PAS UN CALCUL. Le piquant d'un plat ne se dérive pas de ses
 * ingrédients : il dépend de la QUANTITÉ d'épice, de son RAPPORT au reste du plat, et du MODE DE
 * CUISSON — des épices jetées sur du riz sec ne diffusent pas comme un mijoté. Aucune source ne
 * tabule ce dernier facteur.
 *
 * Sources écartées et pourquoi : l'échelle de **Scoville** ne mesure que la capsaïcine, donc que le
 * piment — ni le poivre, ni la moutarde, ni le wasabi, ni le gingembre n'y figurent. Et la pungence
 * n'est pas un axe unique : capsaïcine et pipérine agissent sur le récepteur TRPV1, l'isothiocyanate
 * d'allyle (moutarde, wasabi) et l'allicine sur TRPA1 — d'où un wasabi qui monte au nez et retombe
 * là où un piment s'installe. Une échelle par famille de molécule a été envisagée puis ÉCARTÉE
 * (décision utilisateur) : trop fine pour être annotée honnêtement à la main.
 *
 * ⚠️ NON CÂBLÉ. Aucune couche ne lit ce champ aujourd'hui — la feature (seuil de tolérance,
 * exclusion ou score) viendra plus tard. Le champ est posé pour qu'elle ne reparte pas de zéro.
 */
export type PiquantLevel = 0 | 1 | 2 | 3 | 4

export interface RecipeIngredient {
  readonly foodId: FoodId
  readonly quantiteG: Grams
  readonly uniteAffichage: string
  readonly optionnel: boolean
}

export type TimerType = 'cuisson' | 'repos'

/**
 * Ce qu'une étape EST, pas ce qu'elle dit (docs/CONCEPTION_MODE_CUISINE.md §3).
 *
 * ⚠️ Un `avertissement` ne se fait pas, il se lit : il n'entre dans aucun compteur d'étapes et ne
 * s'affiche jamais comme une action restante. Il est TOUJOURS la dernière étape — le build refuse
 * l'inverse, parce qu'un avertissement au milieu casserait la numérotation du mode cuisine.
 */
export type StepNature = 'geste' | 'avertissement'

export interface RecipeStep {
  readonly ordre: number
  readonly texte: string
  /** Codes vers `LexiconEntry.code` (§8.5 ARCHITECTURE). */
  readonly lexiconIds: readonly string[]
  readonly timerS: number | null
  readonly timerType: TimerType | null
  readonly nature: StepNature
}

export type FacetteKind = 'cuisine' | 'regime' | 'occasion' | 'style'

/** `recipe_facet.valeur` est TEXT libre en base — vocabulaire ouvert (ex. 'vegetarien', 'francaise'). */
export interface RecipeFacet {
  readonly facette: FacetteKind
  readonly valeur: string
}

/** `recipe_facet.valeur` quand `facette === 'regime'`. Ouvert, pas de CHECK en base. */
export type DietCode = string

/**
 * D'ou vient le TEXTE de la recette — sans rapport avec les valeurs nutritionnelles, qui viennent
 * toujours de CIQUAL. Distinct de `RecipeSource['type']`, qui dit pourquoi une source est citee.
 *
 * - `maison` — ecrite pour ce projet (241/241 aujourd'hui).
 * - `domaine_public` — vient d'un ouvrage tombe dans le domaine public.
 * - `libre` — vient d'une source sous licence libre (CC0, CC BY, CC BY-SA…).
 *
 * ⚠️ `domaine_public` et `libre` exigent une source `provenance` ; `maison` l'interdit — le build
 * refuse la contradiction (docs/SOURCES_RECETTES.md).
 *
 * ⚠️ `utilisateur` et `partagee` NE PEUVENT JAMAIS APPARAÎTRE DANS LE CATALOGUE : `RECIPE_ORIGINES`
 * (catalog/build.mjs) et le `CHECK` SQL de `CREATE TABLE recipe` n'acceptent que les trois valeurs
 * ci-dessus, et doivent continuer de refuser celles-ci. Elles n'existent que pour les recettes
 * stockées dans `user.db` (`data/user-recipe.ts#versRecette`), qui n'entrent jamais en catalogue.
 * Le PIÈGE : `RecipeOrigine` sert donc à DEUX espaces de valeurs disjoints qui partagent un seul
 * type Recipe — une recette perso composée par l'utilisateur (`utilisateur`) n'a pas été « écrite
 * pour cette application » au sens de `maison` ; une recette reçue par fichier `.nutri-recipe` d'un
 * tiers (`partagee`) ne l'a pas été non plus, et il serait faux de le dire dans les deux cas.
 * - `utilisateur` — recette perso composée ou dérivée par la personne qui l'utilise (`perso` /
 *   `variante` côté `StoredUserRecipe.source`).
 * - `partagee` — recette perso reçue d'un tiers via `.nutri-recipe` (`importe`).
 */
export type RecipeOrigine = 'maison' | 'domaine_public' | 'libre' | 'utilisateur' | 'partagee'

export interface Recipe {
  readonly id: RecipeId
  readonly nom: string
  /** Voir `RecipeOrigine`. Affichee SYSTEMATIQUEMENT en tete de fiche, meme quand `sources` n'est pas vide. */
  readonly origine: RecipeOrigine
  readonly description: string
  readonly tempsPrepMin: Minutes
  readonly tempsCuissonMin: Minutes
  readonly difficulte: 1 | 2 | 3
  readonly portionsBase: number
  readonly imagePath: string | null
  readonly typesRepas: readonly MealSlot[]
  readonly saisonMois: readonly Month[]
  readonly envergure: RecipeEnvergure
  /** Pour la gestion des restes (§7.3 ENGINE). */
  readonly conservationJours: number
  readonly axes: SensoryAxes
  readonly ingredients: readonly RecipeIngredient[]
  readonly etapes: readonly RecipeStep[]
  readonly facettes: readonly RecipeFacet[]
  /**
   * TYPE DE RECETTE (§ `CourseKind`) — le rôle joué dans un repas, INDÉPENDANT de `typesRepas`.
   * `null` = non renseigné ; le moteur ne le lit pas encore, il ne fait qu'exposer l'information.
   */
  readonly service: CourseKind | null
  /**
   * Niveau de piquant PERÇU du plat (§ `PiquantLevel`). `null` = non renseigné, jamais « doux ».
   *
   * ⚠️ ÉDITORIAL, PAS DÉRIVÉ des ingrédients — il dépend de la quantité d'épice, de son rapport au
   * reste du plat et du mode de cuisson (des épices sur du riz sec ne diffusent pas comme un
   * mijoté). Ne surtout pas le recalculer depuis `Food.piquant` : ce serait faux.
   *
   * ⚠️ NON CÂBLÉ — aucune couche ne le lit. Posé pour la feature à venir.
   */
  readonly piquant: PiquantLevel | null
  /**
   * Sources de la recette — vide tant qu'elle n'a été ni importée ni vérifiée.
   *
   * ⚠️ Le moteur ne les lit JAMAIS. C'est de l'information destinée au lecteur, au même titre
   * que `Tip.sourceUrl` : aucune couche ne doit classer une recette sur le fait qu'elle est
   * sourcée, sinon la traçabilité deviendrait un critère de sélection déguisé.
   */
  readonly sources: readonly RecipeSource[]
  /**
   * Date à laquelle la recette a été RÉELLEMENT cuisinée et le résultat jugé. `null` = jamais
   * testée — le cas des 241 recettes du catalogue.
   *
   * ⚠️ Jamais une date approchée. C'est le champ qui porte la confiance ; une date inventée la
   * détruit plus sûrement que son absence.
   */
  readonly testeLe: string | null
}

/**
 * Ce qu'une source dit d'une recette. **Deux types, qui n'affirment pas la même chose :**
 *
 * - `provenance` — la recette **vient de là** (import d'une source libre). Revendique une origine,
 *   d'où `licence` et `auteur` obligatoires : on emprunte le travail de quelqu'un.
 * - `reference` — ouverte pour **vérifier** la recette. N'affirme aucune origine, c'est une
 *   bibliographie. Rien à créditer, donc `licence` et `auteur` restent `null`.
 *
 * ⚠️ **Les confondre serait un mensonge.** Les 241 recettes du catalogue sont écrites pour ce
 * projet ; leur attacher une `provenance` trouvée après coup fabriquerait une origine — la faute
 * exacte que `catalog/tips/README.md` interdit. Détail : `docs/SOURCES_RECETTES.md` §1.
 */
export interface RecipeSource {
  readonly type: 'provenance' | 'reference'
  readonly titre: string
  readonly url: string
  /** Date d'ouverture RÉELLE du lien. Une référence non ouverte ne se cite pas. */
  readonly consulteLe: string
  readonly licence: string | null
  readonly auteur: string | null
}

// --- Lexique de cuisine (table `lexicon_entry`) -----------------------------------------------

/** Catégories de §8.4 ARCHITECTURE. Fermée — une valeur inventée n'aurait aucun rendu à l'écran. */
export type TipCategorie = 'biologie_aliment' | 'nutrition_humaine' | 'nutrition_animale'

/**
 * Un « Le saviez-vous ? » (§4.7 DESIGN, §8.4 ARCHITECTURE).
 *
 * ⚠️ `nutrition_animale` est du contenu CULTUREL, pas un conseil applicable à l'utilisateur — §8.4
 * impose de le distinguer VISUELLEMENT du reste, « sinon l'utilisateur ne sait plus ce qui
 * s'applique à lui ». Ne pas fondre les trois catégories dans un même carrousel indifférencié.
 */
export interface Tip {
  readonly id: string
  readonly code: string
  readonly categorie: TipCategorie
  readonly texte: string
  /**
   * Référence publiée d'où le fait est tiré (§4.2 ARCHITECTURE). **Jamais `null`** : la colonne est
   * `NOT NULL` et le build refuse un tip sans source. Un fait court et affirmatif est précisément
   * celui qu'on recopie sans vérifier — c'est là que la traçabilité compte le plus.
   */
  readonly sourceUrl: string
}

export interface LexiconEntry {
  readonly id: LexiconEntryId
  readonly code: string
  readonly terme: string
  readonly definition: string
}

// --- Fiches scientifiques (tables `evidence_*`, §8.2 ARCHITECTURE, §4.7 DESIGN) ---------------

/**
 * Les quatre niveaux de §5 DESIGN — « l'élément le plus surveillé » du produit.
 *
 * ⚠️ CE N'EST PAS UNE NOTE. §5 interdit explicitement le rouge/vert, les étoiles et toute
 * hiérarchie de type feu tricolore : le badge qualifie la SOLIDITÉ D'UNE PREUVE, jamais la qualité
 * d'un aliment. Un rendu coloré transformerait une information en jugement.
 */
export type NiveauPreuve = 'forte' | 'moderee' | 'faible' | 'preliminaire'

/** Les quatre familles de niveau 1 de « Comprendre » (§6.3 ARCHITECTURE). CHECK en base. */
export type EvidenceCategorie = 'nutriments' | 'vitamines_mineraux' | 'aliments' | 'situations'

/**
 * Nature de la source. `commentaire_critique` n'apporte aucune donnée propre : il conteste celles
 * d'une autre source, et existe pour que la règle « une position contestée est citée AVEC sa
 * critique » soit représentable (voir catalog/evidence/README.md).
 */
export type TypeEtude =
  | 'meta_analyse'
  | 'revue_systematique'
  | 'essai_randomise'
  | 'cohorte'
  | 'rapport_autorite'
  | 'commentaire_critique'

/** `evidence_link.cible_type` (§4.2). ⚠️ `health_topic` n'a pas de table : aucun lien ne le vise. */
export type EvidenceCibleType = 'food' | 'nutrient' | 'health_topic'

/**
 * Une référence citée par une fiche.
 *
 * ⚠️ `auteurs` est NULLABLE, et c'est un choix de sincérité, pas un oubli de modélisation : quand la
 * page éditeur exige un compte, la liste d'auteurs n'a pas pu être vérifiée alors que titre, revue,
 * année et DOI l'ont été. `null` dit « non vérifié », ce qu'une chaîne plausible ne dirait pas.
 */
export interface EvidenceSource {
  /** Identifiant LOCAL à la fiche (`evidence_source.code`), pas un id global. */
  readonly code: string
  readonly titreEtude: string
  readonly auteurs: string | null
  readonly annee: number
  readonly revue: string
  readonly doi: string | null
  readonly url: string
  readonly typeEtude: TypeEtude
  /** Effectif, seulement s'il a été vérifié à la source. `null` dans le doute. */
  readonly effectif: string | null
  /** Déclaration de financement publiée, reproduite telle quelle. `null` si aucune. */
  readonly financement: string | null
  /** Date à laquelle `url` a été ouverte et vérifiée (règle 5 du README de catalog/evidence). */
  readonly consulteLe: string
}

/**
 * Une position : les « affirmations courtes, chacune avec badge de preuve » de §4.7.
 *
 * ⚠️ `portePar` EST OBLIGATOIRE. Une affirmation de santé sans son auteur (« OMS », « revue
 * Cochrane ») redevient une parole d'application — exactement ce que §6.1 interdit. Ne jamais y
 * mettre « les scientifiques ».
 */
export interface EvidencePosition {
  readonly code: string
  readonly niveauPreuve: NiveauPreuve
  readonly portePar: string
  readonly affirmation: string
  readonly detail: string
  /** Codes de `EvidenceSheet.sources` — jamais vide, la contrainte est vérifiée au build. */
  readonly sources: readonly string[]
}

export interface EvidenceLink {
  readonly cibleType: EvidenceCibleType
  /** `FoodId` ou `NutrientId` selon `cibleType` — polymorphe, donc `string` (pas d'FK en base). */
  readonly cibleId: string
}

/**
 * Un chapitre de « Comprendre » (§4.7 DESIGN, §8.2 ARCHITECTURE).
 *
 * ⚠️ `niveauPreuve` ici est celui du SOCLE DE CONSENSUS, et il n'est pas redondant avec celui des
 * positions : une fiche peut reposer sur un consensus fort tout en exposant une position faible et
 * contestée. §4.2 ARCHITECTURE ne prévoyait qu'un niveau par fiche ; l'exposition de plusieurs
 * points de vue a imposé `evidence_position`, dont chaque ligne porte le sien.
 */
export interface EvidenceSheet {
  readonly id: EvidenceSheetId
  readonly code: string
  /** Un titre-QUESTION (§4.7). Vérifié au build : sans « ? », le build échoue. */
  readonly titre: string
  readonly categorie: EvidenceCategorie
  readonly niveauPreuve: NiveauPreuve
  /** ISO `AAAA-MM-JJ`. §8.2 règle 4 : au-delà de 3 ans, la fiche est à réviser. */
  readonly dateRevue: string
  readonly resumeVulgarise: string
  /** Dans l'ordre d'affichage voulu par la fiche (`evidence_position.ordre`). */
  readonly positions: readonly EvidencePosition[]
  readonly sources: readonly EvidenceSource[]
  readonly liens: readonly EvidenceLink[]
}

// --- Types en attente de table catalogue (v1.5 / v2, voir commentaire d'en-tête) --------------

export interface HealthTopic {
  readonly id: TopicId
  readonly code: string
  readonly titre: string
  readonly resumeVulgarise: string
  readonly autoriteReference: string
  readonly dateRevue: string
  /** Renvoie vers un régime déclaré quand une éviction stricte s'impose (§5.2 ARCHITECTURE). */
  readonly dieteSuggeree: DietCode | null
}

export interface Substitution {
  readonly foodId: FoodId
  readonly altFoodId: FoodId
  readonly ratio: number
  readonly contexte: string
}

// --- Le catalogue en mémoire (§9.1 ENGINE) ------------------------------------------------------

/**
 * Signature de composition d'une recette : `foodId` → part de la masse (somme = 1), sur les
 * quelques ingrédients non optionnels les plus lourds. Déclarée ICI et pas dans nutrition/ parce
 * que `CatalogIndexes` en dépend et que domain/ (L1) ne peut rien importer de nutrition/ (L2) —
 * §2 ENGINE. Le calcul, lui, vit dans engine/nutrition/signature.ts.
 */
export type RecipeSignature = ReadonlyMap<FoodId, number>

/**
 * La même signature, mais chaque aliment replié sur sa `Food.sousFamille` quand elle existe
 * (§6.6 quater ENGINE). Les clés ne sont donc PAS des `FoodId` : ce sont des ids d'aliment OU des
 * noms de famille, d'où `string`. Type NOMMÉ ET DISTINCT de `RecipeSignature` exprès : comparer
 * une signature brute à une signature repliée n'a aucun sens (les clés ne désignent pas la même
 * chose). ⚠️ TypeScript ne peut PAS l'imposer — les deux Map restent structurellement compatibles,
 * `signatureOverlap` accepte donc les deux. Le nom porte l'intention, pas le compilateur : à
 * l'appel, les deux côtés doivent venir du même index.
 */
export type RecipeFamilySignature = ReadonlyMap<string, number>

export interface CatalogIndexes {
  readonly recipesByAllergen: ReadonlyMap<AllergenId, ReadonlySet<RecipeId>>
  readonly recipesByDiet: ReadonlyMap<DietCode, ReadonlySet<RecipeId>>
  readonly recipesBySlot: ReadonlyMap<MealSlot, ReadonlySet<RecipeId>>
  /** Calculé à l'init du moteur (`createEngine`), pas au build — `aggregateRecipe` est une fonction pure de engine/nutrition/ (§6.5 ENGINE précision 8). */
  readonly recipeNutrients: ReadonlyMap<RecipeId, NutrientVector>
  /**
   * Part de la masse dont la valeur est CONNUE, par nutriment, ∈ [0, 1] (§5.1 bis, décision 29).
   * Qualifie `recipeNutrients` : CIQUAL laisse des cases vides, et `aggregateRecipe` les compte
   * comme des zéros — ce vecteur dit combien il en manque, pour que `scoreNutri` puisse s'abstenir
   * plutôt que de noter sur une valeur inventée. Ratio, donc PAS divisé par `portionsBase`.
   */
  readonly recipeNutrientCoverage: ReadonlyMap<RecipeId, NutrientVector>
  /**
   * L'ingrédient non optionnel LE PLUS LOURD. ⚠️ Ce n'est PAS l'ingrédient qui définit le plat —
   * mesuré faux sur le catalogue réel (« mousse au chocolat » → œuf, « hachis de bœuf » → pomme de
   * terre). ⚠️ PLUS AUCUNE COUCHE NE LE LIT depuis §6.6 quater : la similarité est passée à
   * `recipeSignature`, `variety`/`habit` à `recipeFamilySignature`. Conservé le temps de vérifier
   * qu'aucun usage n'apparaît côté UI ; à supprimer sinon — c'est de la dette, pas un index actif.
   */
  readonly recipeMainIngredient: ReadonlyMap<RecipeId, FoodId>
  /**
   * Les 3 ingrédients non optionnels les plus lourds avec leur part normalisée — base de la
   * similarité (§6.6 ENGINE). Modèle CHOISI PAR MESURE, voir engine/nutrition/signature.ts.
   */
  readonly recipeSignature: ReadonlyMap<RecipeId, RecipeSignature>
  /**
   * La même signature, mais les aliments d'une même `Food.sousFamille` fusionnés (§6.6 quater).
   * Base de la RÉCENCE de `variety`/`habit` — « ai-je mangé du poulet hier » se moque du morceau,
   * alors que la diversification doit encore distinguer un blanc rôti d'un tajine de cuisses.
   * Clés : id d'aliment OU nom de famille, d'où `string` et non `FoodId`.
   */
  readonly recipeFamilySignature: ReadonlyMap<RecipeId, RecipeFamilySignature>
  /**
   * Les noms de sous-familles réellement déclarées (§6.6 quinquies). Les clés d'une
   * `RecipeFamilySignature` mélangent noms de famille et `foodId` bruts sans qu'on puisse les
   * distinguer ; ce jeu tranche. Catalogue-global, pas par recette — d'où l'absence de `RecipeId`.
   */
  readonly declaredFamilies: ReadonlySet<string>
  /**
   * L'aliment qu'un « plat frère » devrait remplacer (§8.4 ENGINE, décision 26). ⚠️ Ce n'est NI
   * `recipeMainIngredient` (le plus lourd, mesuré faux) NI la signature : le plus lourd d'un GROUPE
   * DÉFINISSANT, avec repli. « Hachis de bœuf aux pommes de terre » est un plat de bœuf.
   */
  readonly recipeCharacteristic: ReadonlyMap<RecipeId, FoodId>
}

export interface Catalog {
  readonly version: string
  readonly foods: ReadonlyMap<FoodId, Food>
  readonly recipes: ReadonlyMap<RecipeId, Recipe>
  /** Ordre = index dans NutrientVector (§9.1 ENGINE). */
  readonly nutrients: readonly Nutrient[]
  readonly allergens: ReadonlyMap<AllergenId, Allergen>
  readonly lexicon: ReadonlyMap<LexiconEntryId, LexiconEntry>
  readonly tips: readonly Tip[]
  /** Chapitres de « Comprendre » (§4.7). Sources éditables : `catalog/evidence/*.md`. */
  readonly evidence: ReadonlyMap<EvidenceSheetId, EvidenceSheet>
  readonly topics: ReadonlyMap<TopicId, HealthTopic>
  readonly substitutions: ReadonlyMap<FoodId, readonly Substitution[]>
  readonly indexes: CatalogIndexes
}
